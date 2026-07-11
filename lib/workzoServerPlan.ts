import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkZoUserSubscription, upsertWorkZoSubscription, type WorkZoSubscriptionRecord } from "@/lib/workzoSubscription";
import { normalizeWorkZoPlan, type WorkZoPlanType } from "@/lib/workzoPlanLimits";
import { isWorkZoFounderDevEmail } from "@/lib/workzoFounderAccess";

export type WorkZoResolvedPlan = {
  authenticated: boolean;
  userId: string | null;
  email: string | null;
  plan: WorkZoPlanType;
  billingCycle: string | null;
  status: string;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};


const cookieFallbackLogKeys = new Set<string>();

function shouldLogPlanFallback(key: string) {
  if (process.env.NODE_ENV !== "development") return false;
  if (cookieFallbackLogKeys.has(key)) return false;
  cookieFallbackLogKeys.add(key);
  return true;
}

function planFromSubscription(subscription: WorkZoSubscriptionRecord | null): WorkZoPlanType {
  if (!subscription) return "free";
  // Status must be "premium" (active), cancelled/expired/past_due all return free.
  if (subscription.status !== "premium") return "free";
  return normalizeWorkZoPlan(subscription.plan_tier || subscription.plan || "free");
}

// SECURITY: the plan cookie is NOT an authorization source.
//
// A previous version trusted a `workzo_plan` cookie when the DB said "free"
// (and even when there was no session at all). Cookies are client-controlled,
// so anyone could set workzo_plan=premium_pro in devtools and receive Premium
// Pro for free. A user who never paid also has no stripe_subscription_id, so
// the "cancelled subscriber" check did not stop them either.
//
// The real problem the cookie was papering over is a missed Stripe webhook.
// The correct fix is to ask STRIPE, which is authoritative and cannot be
// forged by the client. If Stripe confirms an active subscription we trust it
// (and heal the DB); otherwise we fail CLOSED to "free".
/** Find a Stripe customer by email. Needed when the webhook never fired at all,
 *  so the DB has no subscription row and therefore no stripe_customer_id to look
 *  up. Server-side only; the client cannot influence this. */
async function stripeCustomerIdByEmail(email: string | null | undefined): Promise<string | null> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret || !email) return null;
  try {
    const res = await fetch(
      `https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=1`,
      { headers: { Authorization: `Bearer ${secret}` }, cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: Array<{ id?: string }> };
    return data.data?.[0]?.id || null;
  } catch {
    return null;
  }
}

async function planFromStripe(
  stripeCustomerId: string | null | undefined,
): Promise<{ plan: WorkZoPlanType; subscriptionId: string; priceId: string } | null> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret || !stripeCustomerId) return null;
  try {
    const res = await fetch(
      `https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(stripeCustomerId)}&status=active&limit=1`,
      { headers: { Authorization: `Bearer ${secret}` }, cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      data?: Array<{ id?: string; items?: { data?: Array<{ price?: { id?: string } }> } }>;
    };
    const sub = data.data?.[0];
    if (!sub?.id) return null;

    const priceId = sub.items?.data?.[0]?.price?.id || "";
    const plan: WorkZoPlanType =
      priceId && priceId === process.env.STRIPE_PREMIUM_PRO_PRICE_ID
        ? "premium_pro"
        : priceId && priceId === process.env.STRIPE_PREMIUM_PRICE_ID
          ? "premium"
          : "premium";

    return { plan, subscriptionId: sub.id, priceId };
  } catch {
    return null;
  }
}

export async function resolveWorkZoServerPlan(): Promise<WorkZoResolvedPlan> {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError) {
    console.warn("[workzoServerPlan] Supabase auth error:", authError.message);
  }

  if (!user) {
    // No Supabase session means NOT authenticated. Never grant a paid plan from
    // a client-controlled cookie: that allowed anyone to set
    // workzo_plan=premium_pro in devtools and receive Premium Pro for free.
    return {
      authenticated: false,
      userId: null,
      email: null,
      plan: "free",
      billingCycle: null,
      status: "free",
      currentPeriodEnd: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    };
  }

  const subscription = await getCurrentWorkZoUserSubscription();
  let plan = planFromSubscription(subscription);

  // Cookie-based fallback for webhook-missed subscriptions.
  //
  // When Stripe webhooks fail to fire (network issues, misconfigured endpoint,
  // first-time setup), the DB row stays "free" even though the user paid.
  //
  // We trust the cookie fallback ONLY when ALL of these are true:
  //   1. User has a valid Supabase session (authenticated)
  //   2. DB resolves to "free"
  //   3. The DB row has NO stripe_subscription_id (webhook never fired at all,
  //      vs. a legitimately cancelled subscription which WOULD have an ID)
  //   4. Cookie says "premium" or "premium_pro"
  //
  // Webhook-missed recovery, done SAFELY.
  //
  // If the DB says "free" but Stripe says the customer has an ACTIVE
  // subscription, the webhook was missed. We ask Stripe directly (server-side,
  // with the secret key) instead of trusting a client cookie, then heal the DB
  // so the next request does not need the extra call.
  if (plan === "free") {
    // The row may be missing entirely (webhook never fired), so fall back to
    // locating the Stripe customer by the signed-in user's email.
    const customerId =
      subscription?.stripe_customer_id || (await stripeCustomerIdByEmail(user.email));
    const verified = customerId ? await planFromStripe(customerId) : null;
    if (verified && customerId) {
      if (shouldLogPlanFallback(`${user.id}:${verified.plan}:stripe_verified`)) {
        console.warn(
          "[workzoServerPlan] Stripe reports an ACTIVE subscription but the DB row is free for user",
          user.id,
          "- the Stripe webhook was missed. Granting", verified.plan,
          "from verified Stripe state and healing the DB row.",
        );
      }
      plan = verified.plan;
      // Self-heal so this is a one-time cost, not a per-request Stripe call.
      try {
        await upsertWorkZoSubscription({
          userId: user.id,
          stripeCustomerId: customerId,
          stripeSubscriptionId: verified.subscriptionId,
          stripePriceId: verified.priceId,
          stripeStatus: "active",
          plan: verified.plan,
        });
      } catch {
        /* non-fatal: the plan is still correct for this request */
      }
    }
  }


  // Partner trial: if the user isn't already Pro, grant Premium Pro when
  // they have an active, non-exhausted partner trial grant (by email, or
  // auto-activated for their domain). Purely additive: this only ever
  // upgrades, never downgrades a paying subscriber, and fails safe (any
  // error leaves the normal plan untouched). Real Stripe billing is not
  // touched here.
  if (plan !== "premium_pro" && user.email) {
    try {
      const { getActivePartnerTrialGrant } = await import("@/lib/workzoPartnerTrial");
      const trial = await getActivePartnerTrialGrant(user.id, user.email);
      if (trial) {
        return {
          authenticated: true,
          userId: user.id,
          email: user.email || null,
          plan: "premium_pro",
          billingCycle: "trial",
          status: "partner_trial",
          currentPeriodEnd: trial.expiresAt,
          stripeCustomerId: subscription?.stripe_customer_id || null,
          stripeSubscriptionId: subscription?.stripe_subscription_id || null,
        };
      }
    } catch (err) {
      console.warn("[workzoServerPlan] partner trial check failed", err);
    }
  }

  // Founder/dev account: always unlock Premium Pro server-side for testing.
  // This bypasses Stripe/subscription gates only for the explicit internal email.
  if (isWorkZoFounderDevEmail(user.email)) {
    return {
      authenticated: true,
      userId: user.id,
      email: user.email || null,
      plan: "premium_pro",
      billingCycle: "monthly",
      status: "founder_test",
      currentPeriodEnd: null,
      stripeCustomerId: subscription?.stripe_customer_id || null,
      stripeSubscriptionId: subscription?.stripe_subscription_id || null,
    };
  }

  return {
    authenticated: true,
    userId: user.id,
    email: user.email || null,
    plan,
    billingCycle: subscription?.billing_cycle || null,
    status: subscription?.status || "free",
    currentPeriodEnd: subscription?.current_period_end || null,
    stripeCustomerId: subscription?.stripe_customer_id || null,
    stripeSubscriptionId: subscription?.stripe_subscription_id || null,
  };
}
