/**
 * lib/stripe/webhookHandler.ts
 *
 * THE SINGLE Stripe webhook implementation.
 *
 * There were previously TWO byte-identical route files:
 *   app/api/stripe/webhook/route.ts
 *   app/api/webhooks/stripe/route.ts
 *
 * Both verified the same secret, so whichever URL was registered in Stripe
 * worked, and a fix applied to one silently missed the other. Both routes now
 * re-export this handler, so they cannot diverge. Register only ONE of them in
 * the Stripe dashboard, otherwise every event is processed twice.
 *
 * WHAT WAS BROKEN
 *
 * `checkout.session.completed` only acted when `session.subscription` was set.
 * A voice minute top-up is a ONE-TIME payment (mode: "payment"), so its session
 * carries no subscription and the handler fell straight through. The top-up
 * metadata was never read and `voice_topup_purchases` was never written, so the
 * customer paid and received zero minutes, with no error surfaced anywhere.
 *
 * Fulfilment now branches on the purchase KIND before it looks at subscriptions.
 */

import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { WORKZO_TOPUP_KIND, WORKZO_TOPUP_METADATA_KEYS } from "@/lib/workzoVoiceTopUps";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-01-27" as any,
});

function planFromSubscription(subscription: Stripe.Subscription): string {
  const priceId = subscription.items.data[0]?.price?.id || "";
  if (priceId && process.env.STRIPE_PRICE_PREMIUM_PRO && priceId === process.env.STRIPE_PRICE_PREMIUM_PRO) return "premium_pro";
  if (priceId && process.env.STRIPE_PRICE_PREMIUM && priceId === process.env.STRIPE_PRICE_PREMIUM) return "premium";
  const lookup = subscription.items.data[0]?.price?.lookup_key || "";
  if (/pro/i.test(lookup)) return "premium_pro";
  if (/premium/i.test(lookup)) return "premium";
  return "premium_pro";
}

async function resolveUserId(customerId: string): Promise<string | null> {
  const customer = await stripe.customers.retrieve(customerId);
  if (!customer || customer.deleted) return null;
  const metadata: any = (customer as any).metadata || {};
  if (metadata.userId) return metadata.userId;
  if (metadata.user_id) return metadata.user_id;
  const email = (customer as any).email;
  if (email) {
    const { data } = await supabaseAdmin.from("profiles").select("id").eq("email", email).maybeSingle();
    return data?.id || null;
  }
  return null;
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const customerId = String(subscription.customer || "");
  const userId = await resolveUserId(customerId);
  if (!userId) {
    console.warn("[Stripe webhook] No userId for customer", customerId);
    return;
  }
  const status = subscription.status;
  const active = ["active", "trialing"].includes(status);
  const plan = active ? planFromSubscription(subscription) : "free";

  const update = {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    subscription_status: status,
    plan_tier: plan,
    plan: plan,
    updated_at: new Date().toISOString(),
  } as any;

  const { error } = await supabaseAdmin.from("profiles").update(update).eq("id", userId);
  if (error) throw error;
}

/**
 * Voice minute top-up fulfilment.
 *
 * Idempotent by construction: `voice_topup_purchases.stripe_session_id` carries
 * a UNIQUE constraint, so a Stripe retry (or both webhook URLs firing) can only
 * ever produce one row per paid session. We upsert on that column rather than
 * insert, so a replay is a no-op instead of a 500 that makes Stripe retry
 * forever.
 *
 * Nothing here trusts the client: minutes, pack, and user all come from the
 * metadata WE attached in app/api/stripe/topup/route.ts, on a session Stripe has
 * now told us is paid.
 */
async function fulfilVoiceTopUp(session: Stripe.Checkout.Session): Promise<boolean> {
  const metadata = (session.metadata || {}) as Record<string, string>;
  if (metadata[WORKZO_TOPUP_METADATA_KEYS.kind] !== WORKZO_TOPUP_KIND) return false;

  // Only credit a session Stripe has actually collected money for.
  if (session.payment_status !== "paid") {
    console.warn("[Stripe webhook] top-up session not paid, skipping", session.id, session.payment_status);
    return true;
  }

  const minutes = Number.parseInt(metadata[WORKZO_TOPUP_METADATA_KEYS.minutes] || "0", 10);
  const userId = metadata[WORKZO_TOPUP_METADATA_KEYS.userId] || String(session.client_reference_id || "");
  const packId = metadata[WORKZO_TOPUP_METADATA_KEYS.packId] || null;

  if (!Number.isFinite(minutes) || minutes <= 0 || !userId) {
    // Loud, because this means a paying customer is owed minutes we cannot route.
    console.error("[Stripe webhook] UNFULFILLABLE top-up, manual reconciliation needed", {
      sessionId: session.id,
      minutes,
      userId,
      packId,
    });
    return true;
  }

  const { error } = await supabaseAdmin
    .from("voice_topup_purchases")
    .upsert(
      {
        user_id: userId,
        minutes,
        pack_id: packId,
        stripe_session_id: session.id,
        amount_total: session.amount_total ?? null,
        currency: session.currency ?? null,
      },
      { onConflict: "stripe_session_id", ignoreDuplicates: true },
    );

  // Throw so the outer handler returns 500 and Stripe retries: a DB blip must
  // not silently swallow a purchase.
  if (error) throw error;

  console.log("[Stripe webhook] credited top-up", { userId, minutes, packId, sessionId: session.id });
  return true;
}

export async function handleStripeWebhook(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new NextResponse("Missing stripe-signature", { status: 400 });

  let event: Stripe.Event;
  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET || "");
  } catch (err: any) {
    console.error("Stripe webhook signature failed", err?.message || err);
    return new NextResponse(`Webhook Error: ${err?.message || "invalid signature"}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // A one-time purchase (voice top-up) has NO subscription. Check kind first.
        const wasTopUp = await fulfilVoiceTopUp(session);
        if (wasTopUp) break;

        if (session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(String(session.subscription));
          await syncSubscription(subscription);
        }
        break;
      }

      // Safety net: if a top-up session is completed asynchronously (delayed
      // payment methods), Stripe fires this once the payment actually clears.
      case "checkout.session.async_payment_succeeded": {
        await fulfilVoiceTopUp(event.data.object as Stripe.Checkout.Session);
        break;
      }

      default:
        break;
    }
    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("Stripe webhook handler failed", err?.message || err);
    // Return 500 so Stripe retries actual DB failures.
    return new NextResponse(`Webhook handler failed: ${err?.message || "unknown"}`, { status: 500 });
  }
}
