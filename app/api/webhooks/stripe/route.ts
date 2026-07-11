import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new NextResponse("Missing stripe-signature", { status: 400 });

  let event: Stripe.Event;
  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET || "");
  } catch (err: any) {
    console.error("❌ Stripe webhook signature failed", err?.message || err);
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
        if (session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(String(session.subscription));
          await syncSubscription(subscription);
        }
        break;
      }
      default:
        break;
    }
    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("❌ Stripe webhook handler failed", err?.message || err);
    // Return 500 so Stripe retries actual DB failures.
    return new NextResponse(`Webhook handler failed: ${err?.message || "unknown"}`, { status: 500 });
  }
}
