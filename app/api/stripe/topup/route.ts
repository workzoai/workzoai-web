import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createWorkZoStripeClient } from "@/lib/workzoStripe";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { getCurrentWorkZoUserSubscription } from "@/lib/workzoSubscription";
import {
  getWorkZoTopUpPack,
  normalizeTopUpCurrency,
  planCanBuyTopUps,
  WORKZO_TOPUP_KIND,
  WORKZO_TOPUP_METADATA_KEYS,
} from "@/lib/workzoVoiceTopUps";

export const runtime = "nodejs";

/**
 * POST /api/stripe/topup
 * Body: { packId: "boost_30" | "boost_60" | "boost_150", currency?, successPath?, cancelPath? }
 *
 * Creates a ONE-TIME payment Checkout session (mode: "payment", inline
 * price_data — no pre-created Stripe Price objects needed). Fulfilment
 * happens exclusively in the webhook on checkout.session.completed, keyed by
 * the metadata below, so a session that never completes grants nothing.
 *
 * Eligibility is enforced server-side from the resolved plan: top-ups are an
 * overflow product for paying subscribers, never a substitute for a plan.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      packId?: string;
      currency?: string;
      successPath?: string;
      cancelPath?: string;
    };

    const pack = getWorkZoTopUpPack(body.packId);
    if (!pack) {
      return NextResponse.json({ error: "Unknown top-up pack." }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    }

    // Server-resolved plan, never from the request body.
    const resolved = await resolveWorkZoServerPlan();
    if (!planCanBuyTopUps(resolved.plan)) {
      return NextResponse.json(
        { error: "Voice top-ups are available on Premium and Premium Pro. Upgrade first to unlock them.", code: "plan_required" },
        { status: 403 },
      );
    }

    const currency = normalizeTopUpCurrency(body.currency);
    const unitAmount = pack.unitAmount[currency] ?? pack.unitAmount.eur;

    const stripe = createWorkZoStripeClient();
    const existing = await getCurrentWorkZoUserSubscription();
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://workzoai.com").replace(/\/$/, "");
    const safePath = (value: unknown, fallback: string) => {
      const path = String(value || "");
      return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
    };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: existing?.stripe_customer_id || undefined,
      customer_email: existing?.stripe_customer_id ? undefined : user.email || undefined,
      client_reference_id: user.id,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: unitAmount,
            product_data: {
              name: `WorkZo AI — ${pack.label}`,
              description: `${pack.minutes} extra AI voice interview minutes. Credits never expire and are used after your monthly plan minutes.`,
            },
          },
        },
      ],
      metadata: {
        [WORKZO_TOPUP_METADATA_KEYS.kind]: WORKZO_TOPUP_KIND,
        [WORKZO_TOPUP_METADATA_KEYS.packId]: pack.id,
        [WORKZO_TOPUP_METADATA_KEYS.minutes]: String(pack.minutes),
        [WORKZO_TOPUP_METADATA_KEYS.userId]: user.id,
      },
      success_url: `${appUrl}${safePath(body.successPath, "/billing/success")}?topup=${pack.id}`,
      cancel_url: `${appUrl}${safePath(body.cancelPath, "/pricing")}`,
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error("[stripe/topup] checkout creation failed:", error);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
  }
}
