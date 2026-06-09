import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createWorkZoStripeClient,
  getWorkZoAbsoluteUrl,
  getWorkZoStripePriceId,
} from "@/lib/workzoStripe";
import {
  getCurrentWorkZoUserSubscription,
  upsertWorkZoSubscription,
} from "@/lib/workzoSubscription";
import {
  getWorkZoPlanLimits,
  normalizeWorkZoBillingCycle,
  normalizeWorkZoPlan,
  type WorkZoBillingCycle,
  type WorkZoPlanType,
} from "@/lib/workzoPlanLimits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckoutBody = {
  plan?: unknown;
  planTier?: unknown;
  billing?: unknown;
  billingCycle?: unknown;
  cycle?: unknown;
  successPath?: unknown;
  cancelPath?: unknown;
  promoCode?: unknown;
  feature?: unknown;
  source?: unknown;
};

function safePath(value: unknown, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || !text.startsWith("/") || text.startsWith("//")) return fallback;
  return text;
}

function safeMetadataValue(value: unknown) {
  if (typeof value !== "string") return "";
  return value.slice(0, 450);
}

function buildPlanMetadata(input: {
  userId: string;
  plan: WorkZoPlanType;
  billingCycle: WorkZoBillingCycle;
  priceId: string;
  promoCode?: unknown;
  feature?: unknown;
  source?: unknown;
}) {
  const limits = getWorkZoPlanLimits(input.plan);

  return {
    workzo_user_id: input.userId,
    product: "workzo_ai",
    plan: input.plan,
    plan_tier: input.plan,
    billing_cycle: input.billingCycle,
    stripe_price_id: input.priceId,
    promo_code: safeMetadataValue(input.promoCode),
    feature: safeMetadataValue(input.feature) || input.plan,
    source: safeMetadataValue(input.source) || "workzo_checkout",
    voice_interviews_per_month: String(limits.voiceInterviewsPerMonth),
    unlimited_voice_interviews: String(limits.unlimitedVoiceInterviews),
    tavus_minutes_per_month: String(limits.tavusMinutesPerMonth),
    video_recruiter: String(limits.videoRecruiter),
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as CheckoutBody;
    const plan = normalizeWorkZoPlan(body.plan || body.planTier || "premium");
    const billingCycle = normalizeWorkZoBillingCycle(
      body.billingCycle || body.billing || body.cycle || "monthly",
    );

    if (plan === "free") {
      return NextResponse.json(
        { error: "Free plan does not require checkout." },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Please sign in before upgrading." },
        { status: 401 },
      );
    }

    const stripe = createWorkZoStripeClient();
    const existing = await getCurrentWorkZoUserSubscription();
    const priceId = getWorkZoStripePriceId(plan, billingCycle);
    const planMetadata = buildPlanMetadata({
      userId: user.id,
      plan,
      billingCycle,
      priceId,
      promoCode: body.promoCode,
      feature: body.feature,
      source: body.source,
    });

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
        plan,
        billingCycle,
        stripePriceId: priceId,
      });
    }

    const successPath = safePath(body.successPath, "/billing/success");
    const cancelPath = safePath(body.cancelPath, "/billing/cancel");

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${getWorkZoAbsoluteUrl(successPath)}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: getWorkZoAbsoluteUrl(cancelPath),
      allow_promotion_codes: true,
      client_reference_id: user.id,
      metadata: planMetadata,
      subscription_data: {
        metadata: planMetadata,
      },
    });

    return NextResponse.json({
      ok: true,
      url: session.url,
      plan,
      billingCycle,
      priceId,
    });
  } catch (error) {
    console.error("workzo_stripe_checkout_error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start checkout." },
      { status: 500 },
    );
  }
}
