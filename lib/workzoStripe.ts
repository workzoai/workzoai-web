import Stripe from "stripe";
import {
  normalizeWorkZoBillingCycle,
  normalizeWorkZoPlan,
  type WorkZoBillingCycle,
  type WorkZoPlanType,
} from "@/lib/workzoPlanLimits";

export const WORKZO_PREMIUM_PRODUCT_NAME = "WorkZo AI Premium";
export const WORKZO_PREMIUM_PRO_PRODUCT_NAME = "WorkZo AI Premium Pro";

export type WorkZoStripeConfig = {
  secretKey: string;
  webhookSecret: string;
  premiumMonthlyPriceId: string;
  premiumYearlyPriceId: string;
  premiumProMonthlyPriceId: string;
  premiumProYearlyPriceId: string;
  appUrl: string;
};

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export function getWorkZoStripeConfig(): WorkZoStripeConfig {
  const vercelUrl = process.env.VERCEL_URL
    ? process.env.VERCEL_URL.startsWith("http")
      ? process.env.VERCEL_URL
      : `https://${process.env.VERCEL_URL}`
    : "";

  return {
    secretKey: requiredEnv("STRIPE_SECRET_KEY"),
    webhookSecret: requiredEnv("STRIPE_WEBHOOK_SECRET"),
    premiumMonthlyPriceId: requiredEnv("STRIPE_PREMIUM_MONTHLY_PRICE_ID"),
    premiumYearlyPriceId: requiredEnv("STRIPE_PREMIUM_YEARLY_PRICE_ID"),
    premiumProMonthlyPriceId: requiredEnv("STRIPE_PREMIUM_PRO_MONTHLY_PRICE_ID"),
    premiumProYearlyPriceId: requiredEnv("STRIPE_PREMIUM_PRO_YEARLY_PRICE_ID"),
    appUrl:
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      vercelUrl ||
      "http://localhost:3000",
  };
}

export function getWorkZoStripePriceId(
  plan: unknown,
  billingCycle: unknown = "monthly",
) {
  const config = getWorkZoStripeConfig();
  const normalizedPlan = normalizeWorkZoPlan(plan);
  const normalizedCycle = normalizeWorkZoBillingCycle(billingCycle);

  if (normalizedPlan === "premium_pro") {
    return normalizedCycle === "yearly"
      ? config.premiumProYearlyPriceId
      : config.premiumProMonthlyPriceId;
  }

  if (normalizedPlan === "premium") {
    return normalizedCycle === "yearly"
      ? config.premiumYearlyPriceId
      : config.premiumMonthlyPriceId;
  }

  throw new Error("Free plan does not have a Stripe price ID.");
}

export function getWorkZoPlanFromStripePriceId(priceId?: string | null): WorkZoPlanType {
  if (!priceId) return "free";

  const config = getWorkZoStripeConfig();

  if (
    priceId === config.premiumProMonthlyPriceId ||
    priceId === config.premiumProYearlyPriceId
  ) {
    return "premium_pro";
  }

  if (
    priceId === config.premiumMonthlyPriceId ||
    priceId === config.premiumYearlyPriceId
  ) {
    return "premium";
  }

  return "free";
}

export function getWorkZoBillingCycleFromStripePriceId(
  priceId?: string | null,
): WorkZoBillingCycle {
  if (!priceId) return "monthly";

  const config = getWorkZoStripeConfig();

  if (
    priceId === config.premiumYearlyPriceId ||
    priceId === config.premiumProYearlyPriceId
  ) {
    return "yearly";
  }

  return "monthly";
}

export function createWorkZoStripeClient() {
  return new Stripe(getWorkZoStripeConfig().secretKey, {
    typescript: true,
  });
}

export function getWorkZoAbsoluteUrl(path = "/") {
  const config = getWorkZoStripeConfig();
  const base = config.appUrl.replace(/\/$/, "");
  const safePath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${safePath}`;
}

export function normalizeStripeSubscriptionStatus(status?: string | null) {
  switch (status) {
    case "active":
    case "trialing":
      return "premium";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
      return "cancelled";
    case "incomplete_expired":
      return "expired";
    case "incomplete":
      return "free";
    default:
      return "free";
  }
}
