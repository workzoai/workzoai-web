import "server-only";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkZoUserSubscription, type WorkZoSubscriptionRecord } from "@/lib/workzoSubscription";
import { normalizeWorkZoPlan, type WorkZoPlanType } from "@/lib/workzoPlanLimits";

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

function planFromSubscription(subscription: WorkZoSubscriptionRecord | null): WorkZoPlanType {
  if (!subscription) return "free";
  // Status must be "premium" (active) — cancelled/expired/past_due all return free.
  if (subscription.status !== "premium") return "free";
  return normalizeWorkZoPlan(subscription.plan_tier || subscription.plan || "free");
}

// Read the plan cookie set by /api/account/plan as a trusted fallback.
// This is NOT used as the primary source of truth — Supabase DB is — but
// if the Supabase session is temporarily unavailable (missing middleware,
// token refresh lag), this prevents a valid paid user from being gated as free.
async function planFromCookieFallback(): Promise<WorkZoPlanType | null> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("workzo_plan")?.value || cookieStore.get("workzo_plan_type")?.value;
    if (!raw) return null;
    const normalized = normalizeWorkZoPlan(raw);
    return normalized !== "free" ? normalized : null;
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
    // No Supabase session — check if a valid plan cookie exists from a recent
    // /api/account/plan call. If so, treat as authenticated with that plan.
    // This handles cases where the session token needs middleware refresh.
    const cookiePlan = await planFromCookieFallback();
    if (cookiePlan) {
      console.warn("[workzoServerPlan] No Supabase session but plan cookie found:", cookiePlan, "— using cookie as fallback");
      return {
        authenticated: true,
        userId: null,
        email: null,
        plan: cookiePlan,
        billingCycle: null,
        status: "premium",
        currentPeriodEnd: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      };
    }
    return {
      authenticated: false,
      userId: null,
      email: null,
      plan: "free",
      billingCycle: null,
      status: "signed_out",
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
  // The workzo_plan cookie is set server-side by /api/account/plan after
  // Stripe redirects back — so it's a reliable signal of payment intent.
  //
  // We trust the cookie fallback ONLY when ALL of these are true:
  //   1. User has a valid Supabase session (authenticated)
  //   2. DB resolves to "free"
  //   3. The DB row has NO stripe_subscription_id (webhook never fired at all,
  //      vs. a legitimately cancelled subscription which WOULD have an ID)
  //   4. Cookie says "premium" or "premium_pro"
  //
  // This prevents a cancelled subscriber from gaming the system via a stale
  // cookie — cancelled subs always have a stripe_subscription_id in the DB.
  if (plan === "free") {
    const hasNoStripeRecord = !subscription?.stripe_subscription_id;
    const cookiePlan = await planFromCookieFallback();

    if (cookiePlan && hasNoStripeRecord) {
      console.warn(
        "[workzoServerPlan] COOKIE FALLBACK ACTIVATED for user", user.id,
        "— DB has no Stripe subscription ID, cookie says:", cookiePlan,
        "— Stripe webhook likely missed. Fix: check Stripe webhook logs and resend",
        "customer.subscription.created / customer.subscription.updated events."
      );
      plan = cookiePlan;
    } else if (cookiePlan && !hasNoStripeRecord) {
      // Has a Stripe record but still free — legitimately cancelled/expired.
      console.warn(
        "[workzoServerPlan] DB plan=free with Stripe record for user", user.id,
        "— subscription status:", subscription?.status,
        "— NOT using cookie fallback (subscription exists, may be cancelled)."
      );
    }
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
