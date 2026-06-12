import { NextResponse } from "next/server";
import { createWorkZoStripeClient, getWorkZoAbsoluteUrl } from "@/lib/workzoStripe";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const plan = await resolveWorkZoServerPlan();
    if (!plan.authenticated) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    if (!plan.stripeCustomerId) return NextResponse.json({ error: "No Stripe customer found for this account." }, { status: 404 });
    const stripe = createWorkZoStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: plan.stripeCustomerId,
      return_url: getWorkZoAbsoluteUrl("/billing/manage"),
    });
    return NextResponse.json({ ok: true, url: session.url });
  } catch (error) {
    console.error("workzo_customer_portal_error", error);
    return NextResponse.json({ error: "Could not open billing portal." }, { status: 500 });
  }
}
