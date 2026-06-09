import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  createWorkZoStripeClient,
  getWorkZoStripeConfig,
  getWorkZoBillingCycleFromStripePriceId,
  getWorkZoPlanFromStripePriceId,
} from "@/lib/workzoStripe";
import {
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
