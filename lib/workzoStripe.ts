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

function optionalEnv(name: string) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : "";
}

export function normalizeWorkZoStripeCurrency(currency?: unknown) {
  const value = typeof currency === "string" ? currency.trim().toUpperCase() : "";
  if (["EUR", "USD", "GBP", "INR", "CAD", "AUD"].includes(value)) return value;
  return "EUR";
}

function regionalPriceEnvName(plan: WorkZoPlanType, billingCycle: WorkZoBillingCycle, currency: string) {
  const planKey = plan === "premium_pro" ? "PREMIUM_PRO" : "PREMIUM";
  const cycleKey = billingCycle === "yearly" ? "YEARLY" : "MONTHLY";
  return `STRIPE_${planKey}_${cycleKey}_PRICE_ID_${currency}`;
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
  currency?: unknown,
) {
  const config = getWorkZoStripeConfig();
  const normalizedPlan = normalizeWorkZoPlan(plan);
  const normalizedCycle = normalizeWorkZoBillingCycle(billingCycle);
  const normalizedCurrency = normalizeWorkZoStripeCurrency(currency);

  if (normalizedPlan === "free") {
    throw new Error("Free plan does not have a Stripe price ID.");
  }

  // Country-specific Stripe prices. Example env names:
  // STRIPE_PREMIUM_MONTHLY_PRICE_ID_EUR
  // STRIPE_PREMIUM_PRO_MONTHLY_PRICE_ID_USD
  // If a regional env var is missing, we safely fall back to your default Stripe price IDs.
  const regionalPriceId = optionalEnv(regionalPriceEnvName(normalizedPlan, normalizedCycle, normalizedCurrency));
  if (regionalPriceId) return regionalPriceId;

  if (normalizedPlan === "premium_pro") {
    return normalizedCycle === "yearly"
      ? config.premiumProYearlyPriceId
      : config.premiumProMonthlyPriceId;
  }

  return normalizedCycle === "yearly"
    ? config.premiumYearlyPriceId
    : config.premiumMonthlyPriceId;
}

function configuredPriceIds(plan: WorkZoPlanType, billingCycle: WorkZoBillingCycle) {
  const config = getWorkZoStripeConfig();
  const fallback = plan === "premium_pro"
    ? billingCycle === "yearly" ? config.premiumProYearlyPriceId : config.premiumProMonthlyPriceId
    : billingCycle === "yearly" ? config.premiumYearlyPriceId : config.premiumMonthlyPriceId;

  const regional = ["EUR", "USD", "GBP", "INR", "CAD", "AUD"]
    .map((currency) => optionalEnv(regionalPriceEnvName(plan, billingCycle, currency)))
    .filter(Boolean);

  return [fallback, ...regional];
}

export function getWorkZoPlanFromStripePriceId(priceId?: string | null): WorkZoPlanType {
  if (!priceId) return "free";

  if (
    configuredPriceIds("premium_pro", "monthly").includes(priceId) ||
    configuredPriceIds("premium_pro", "yearly").includes(priceId)
  ) {
    return "premium_pro";
  }

  if (
    configuredPriceIds("premium", "monthly").includes(priceId) ||
    configuredPriceIds("premium", "yearly").includes(priceId)
  ) {
    return "premium";
  }

  return "free";
}

export function getWorkZoBillingCycleFromStripePriceId(
  priceId?: string | null,
): WorkZoBillingCycle {
  if (!priceId) return "monthly";

  if (
    configuredPriceIds("premium", "yearly").includes(priceId) ||
    configuredPriceIds("premium_pro", "yearly").includes(priceId)
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
