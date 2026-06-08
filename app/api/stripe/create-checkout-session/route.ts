import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createWorkZoStripeClient, getWorkZoAbsoluteUrl, getWorkZoStripeConfig } from "@/lib/workzoStripe";
import { getCurrentWorkZoUserSubscription, upsertWorkZoSubscription } from "@/lib/workzoSubscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safePath(value: unknown, fallback: string) {
  const text = typeof value === "string" ? value : "";
  if (!text || !text.startsWith("/") || text.startsWith("//")) return fallback;
  return text;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Please sign in before upgrading." }, { status: 401 });
    }

    const stripe = createWorkZoStripeClient();
    const config = getWorkZoStripeConfig();
    const existing = await getCurrentWorkZoUserSubscription();

    let customerId = existing?.stripe_customer_id || undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: {
          workzo_user_id: user.id,
          product: "workzo_ai",
        },
      });
      customerId = customer.id;
      await upsertWorkZoSubscription({
        userId: user.id,
        stripeCustomerId: customer.id,
        stripeStatus: "incomplete",
      });
    }

    const successPath = safePath(body.successPath, "/billing/success");
    const cancelPath = safePath(body.cancelPath, "/billing/cancel");

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: config.premiumMonthlyPriceId,
          quantity: 1,
        },
      ],
      success_url: `${getWorkZoAbsoluteUrl(successPath)}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: getWorkZoAbsoluteUrl(cancelPath),
      allow_promotion_codes: true,
      client_reference_id: user.id,
      metadata: {
        workzo_user_id: user.id,
        promo_code: typeof body.promoCode === "string" ? body.promoCode : "",
        feature: typeof body.feature === "string" ? body.feature : "premium",
      },
      subscription_data: {
        metadata: {
          workzo_user_id: user.id,
          product: "workzo_ai",
        },
      },
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (error) {
    console.error("workzo_stripe_checkout_error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start checkout." },
      { status: 500 },
    );
  }
}
