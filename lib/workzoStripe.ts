import Stripe from "stripe";

export const WORKZO_PREMIUM_PRODUCT_NAME = "WorkZo AI Premium";

export type WorkZoStripeConfig = {
  secretKey: string;
  webhookSecret: string;
  premiumMonthlyPriceId: string;
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
    appUrl: process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || vercelUrl || "http://localhost:3000",
  };
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
    default:
      return "free";
  }
}
