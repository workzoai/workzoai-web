import { sendWorkZoPurchaseConfirmation } from "@/lib/workzoEmail";
import { getWorkZoPlanLimits } from "@/lib/workzoPlanLimits";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

/** Service-role client for webhook-side writes (same pattern as workzoSubscription). */
function createTopUpServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
import {
  createWorkZoStripeClient,
  getWorkZoStripeConfig,
  getWorkZoBillingCycleFromStripePriceId,
  getWorkZoPlanFromStripePriceId,
} from "@/lib/workzoStripe";
import {
  resetAndClaimWorkZoPurchaseEmailSend,
  getWorkZoUserIdByStripeCustomer,
  markWorkZoSubscriptionCancelled,
  upsertWorkZoSubscription,
} from "@/lib/workzoSubscription";
import {
  normalizeWorkZoBillingCycle,
  normalizeWorkZoPlan,
  type WorkZoBillingCycle,
  type WorkZoPlanType,
} from "@/lib/workzoPlanLimits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StripeSubscriptionRuntime = Stripe.Subscription & {
  current_period_end?: number | null;
  current_period_start?: number | null;
  cancel_at_period_end?: boolean | null;
  cancel_at?: number | null;
  canceled_at?: number | null;
};

type StripeInvoiceRuntime = Stripe.Invoice & {
  subscription?: string | Stripe.Subscription | null;
  customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null;
};

function getCustomerId(value: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined) {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.id || null;
}

function getSubscriptionId(value: string | Stripe.Subscription | null | undefined) {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.id || null;
}

function getFirstSubscriptionPriceId(subscription: StripeSubscriptionRuntime) {
  return subscription.items.data[0]?.price?.id || null;
}

function getPlanFromMetadataOrPrice(input: {
  metadata?: Stripe.Metadata | null;
  priceId?: string | null;
}): WorkZoPlanType {
  const metadataPlan = input.metadata?.plan_tier || input.metadata?.plan;
  if (metadataPlan) return normalizeWorkZoPlan(metadataPlan);
  return getWorkZoPlanFromStripePriceId(input.priceId);
}

function getBillingCycleFromMetadataOrPrice(input: {
  metadata?: Stripe.Metadata | null;
  priceId?: string | null;
}): WorkZoBillingCycle {
  const metadataCycle = input.metadata?.billing_cycle || input.metadata?.billingCycle;
  if (metadataCycle) return normalizeWorkZoBillingCycle(metadataCycle);
  return getWorkZoBillingCycleFromStripePriceId(input.priceId);
}

async function syncSubscription(subscriptionInput: Stripe.Subscription) {
  const subscription = subscriptionInput as StripeSubscriptionRuntime;
  const customerId = getCustomerId(subscription.customer);
  const priceId = getFirstSubscriptionPriceId(subscription);
  const plan = getPlanFromMetadataOrPrice({ metadata: subscription.metadata, priceId });
  const billingCycle = getBillingCycleFromMetadataOrPrice({ metadata: subscription.metadata, priceId });

  const userId =
    typeof subscription.metadata?.workzo_user_id === "string" && subscription.metadata.workzo_user_id
      ? subscription.metadata.workzo_user_id
      : customerId
        ? await getWorkZoUserIdByStripeCustomer(customerId)
        : null;

  if (!userId) {
    console.warn("workzo_stripe_webhook_missing_user", {
      subscriptionId: subscription.id,
      customerId,
      priceId,
      plan,
      billingCycle,
    });
    return;
  }

  await upsertWorkZoSubscription({
    userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    stripeStatus: subscription.status,
    currentPeriodEnd:
      typeof subscription.current_period_end === "number"
        ? subscription.current_period_end
        : null,
    plan,
    billingCycle,
  });
}

export async function POST(request: Request) {
  const stripe = createWorkZoStripeClient();
  const config = getWorkZoStripeConfig();
  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, config.webhookSecret);
  } catch (error) {
    console.error("workzo_stripe_webhook_signature_error", error);
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // ── Voice top-up fulfilment (one-time payments) ────────────────────
        // Top-up sessions are mode:"payment" and carry workzo_purchase_kind
        // metadata. They must NEVER fall through to the subscription upsert
        // below (a one-time payment has no plan and would corrupt the
        // subscription row). Insert is idempotent on stripe_session_id so
        // Stripe's webhook retries can't double-credit.
        if (session.metadata?.workzo_purchase_kind === "voice_topup") {
          const topUpUserId = session.client_reference_id || session.metadata?.workzo_user_id || null;
          const topUpMinutes = Math.max(0, Math.floor(Number(session.metadata?.workzo_topup_minutes) || 0));
          if (topUpUserId && topUpMinutes > 0 && session.payment_status === "paid") {
            const { error: topUpError } = await createTopUpServiceClient()
              .from("voice_topup_purchases")
              .upsert(
                {
                  user_id: topUpUserId,
                  minutes: topUpMinutes,
                  pack_id: session.metadata?.workzo_topup_pack_id || null,
                  stripe_session_id: session.id,
                  amount_total: session.amount_total ?? null,
                  currency: session.currency ?? null,
                },
                { onConflict: "stripe_session_id", ignoreDuplicates: true },
              );
            if (topUpError) {
              console.error("workzo_topup_fulfilment_error", topUpError.message);
            }
          }
          break;
        }

        const userId = session.client_reference_id || session.metadata?.workzo_user_id || null;
        const customerId = getCustomerId(session.customer);
        const subscriptionId = getSubscriptionId(session.subscription);
        const priceId = typeof session.metadata?.stripe_price_id === "string" ? session.metadata.stripe_price_id : null;
        const plan = getPlanFromMetadataOrPrice({ metadata: session.metadata, priceId });
        const billingCycle = getBillingCycleFromMetadataOrPrice({ metadata: session.metadata, priceId });

        if (userId && customerId) {
          await upsertWorkZoSubscription({
            userId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            stripePriceId: priceId,
            stripeStatus: session.payment_status === "paid" ? "active" : "incomplete",
            plan,
            billingCycle,
          });

          if (session.payment_status === "paid") {
            try {
              const canSend = await resetAndClaimWorkZoPurchaseEmailSend(userId);
              if (canSend) {
                const email = session.customer_details?.email || session.customer_email || undefined;
                const limits = getWorkZoPlanLimits(plan);
                await sendWorkZoPurchaseConfirmation({
                  to: email,
                  planLabel: limits.label,
                  plan,
                  startUrl: `${config.appUrl.replace(/\/$/, "")}/onboarding`,
                  manageUrl: `${config.appUrl.replace(/\/$/, "")}/billing/manage`,
                });
              }
            } catch (emailError) {
              console.error("workzo_purchase_email_error", emailError);
            }
          }
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await markWorkZoSubscriptionCancelled({
          stripeCustomerId: getCustomerId(subscription.customer),
          stripeSubscriptionId: subscription.id,
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as StripeInvoiceRuntime;
        const customerId = getCustomerId(invoice.customer);
        const subscriptionId = getSubscriptionId(invoice.subscription);
        const userId = customerId ? await getWorkZoUserIdByStripeCustomer(customerId) : null;

        if (userId) {
          await upsertWorkZoSubscription({
            userId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            stripeStatus: "past_due",
          });
        }
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("workzo_stripe_webhook_handler_error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook handler failed" },
      { status: 500 },
    );
  }
}
