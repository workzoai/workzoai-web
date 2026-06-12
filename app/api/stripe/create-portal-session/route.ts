import { NextResponse } from "next/server";
import { createWorkZoStripeClient, getWorkZoAbsoluteUrl } from "@/lib/workzoStripe";
import { getCurrentWorkZoUserSubscription } from "@/lib/workzoSubscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const subscription = await getCurrentWorkZoUserSubscription();
    if (!subscription?.stripe_customer_id) {
      return NextResponse.json({ error: "No Stripe customer found for this account." }, { status: 404 });
    }

    const stripe = createWorkZoStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: getWorkZoAbsoluteUrl("/billing/manage"),
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (error) {
    console.error("workzo_stripe_portal_error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not open billing portal." }, { status: 500 });
  }
}
