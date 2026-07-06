import { normalizeWorkZoBillingCycle, normalizeWorkZoPlan, type WorkZoBillingCycle, type WorkZoPlanType } from "@/lib/workzoPlanLimits";

export type WorkZoLocalizedPlanPrice = {
  plan: WorkZoPlanType;
  billingCycle: WorkZoBillingCycle;
  countryHint: string;
  currency: string;
  amount: string;
  regular?: string;
  savings?: string;
};

export type WorkZoDisplayPrice = {
  countryHint: string;
  currency: string;
  regular: string;
  opening: string;
  billingNote: string;
};

type RegionalPriceSet = {
  countryHint: string;
  currency: string;
  free: { monthly: string; yearly: string };
  premium: { monthly: string; yearly: string; regularMonthly: string; regularYearly: string; savings: string };
  premium_pro: { monthly: string; yearly: string; regularMonthly: string; regularYearly: string; savings: string };
};

const EUR_PRICES: RegionalPriceSet = {
  countryHint: "EU",
  currency: "EUR",
  free: { monthly: "€0", yearly: "€0" },
  premium: { monthly: "€29.99", yearly: "€224.99", regularMonthly: "€49.99", regularYearly: "€359.88", savings: "Save about 37% yearly" },
  premium_pro: { monthly: "€59.99", yearly: "€449.99", regularMonthly: "€99.99", regularYearly: "€719.88", savings: "Save about 37% yearly" },
};

const REGIONAL_PRICES: Record<string, RegionalPriceSet> = {
  EUR: EUR_PRICES,
  USD: {
    countryHint: "United States",
    currency: "USD",
    free: { monthly: "$0", yearly: "$0" },
    premium: { monthly: "$29.99", yearly: "$224.99", regularMonthly: "$49.99", regularYearly: "$359.88", savings: "Save about 37% yearly" },
    premium_pro: { monthly: "$59.99", yearly: "$449.99", regularMonthly: "$99.99", regularYearly: "$719.88", savings: "Save about 37% yearly" },
  },
  GBP: {
    countryHint: "United Kingdom",
    currency: "GBP",
    free: { monthly: "£0", yearly: "£0" },
    premium: { monthly: "£24.99", yearly: "£189.99", regularMonthly: "£42.99", regularYearly: "£299.88", savings: "Save about 37% yearly" },
    premium_pro: { monthly: "£49.99", yearly: "£374.99", regularMonthly: "£79.99", regularYearly: "£599.88", savings: "Save about 37% yearly" },
  },
  INR: {
    countryHint: "India",
    currency: "INR",
    free: { monthly: "₹0", yearly: "₹0" },
    premium: { monthly: "₹2,499", yearly: "₹18,999", regularMonthly: "₹4,199", regularYearly: "₹29,988", savings: "Save about 37% yearly" },
    premium_pro: { monthly: "₹4,999", yearly: "₹37,499", regularMonthly: "₹8,299", regularYearly: "₹59,988", savings: "Save about 37% yearly" },
  },
  CAD: {
    countryHint: "Canada",
    currency: "CAD",
    free: { monthly: "CA$0", yearly: "CA$0" },
    premium: { monthly: "CA$41.99", yearly: "CA$314.99", regularMonthly: "CA$69.99", regularYearly: "CA$503.88", savings: "Save about 37% yearly" },
    premium_pro: { monthly: "CA$79.99", yearly: "CA$599.99", regularMonthly: "CA$129.99", regularYearly: "CA$959.88", savings: "Save about 37% yearly" },
  },
  AUD: {
    countryHint: "Australia",
    currency: "AUD",
    free: { monthly: "A$0", yearly: "A$0" },
    premium: { monthly: "A$44.99", yearly: "A$339.99", regularMonthly: "A$74.99", regularYearly: "A$539.88", savings: "Save about 37% yearly" },
    premium_pro: { monthly: "A$89.99", yearly: "A$674.99", regularMonthly: "A$149.99", regularYearly: "A$1,079.88", savings: "Save about 37% yearly" },
  },
};

function getTimezone() {
  if (typeof Intl === "undefined") return "";
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

function getLocale() {
  if (typeof navigator === "undefined") return "";
  return [navigator.language, ...(navigator.languages || [])].join(" ").toLowerCase();
}

export function getWorkZoRegionalPriceSet(): RegionalPriceSet {
  const timezone = getTimezone().toLowerCase();
  const locale = getLocale();
  const signal = `${timezone} ${locale}`;

  if (/india|kolkata|calcutta|\bin\b|hi-|ta-|te-|ml-|kn-/.test(signal)) return REGIONAL_PRICES.INR;
  if (/america\/|united states|\ben-us\b|\bus\b/.test(signal)) return REGIONAL_PRICES.USD;
  if (/london|united kingdom|\ben-gb\b|\bgb\b/.test(signal)) return REGIONAL_PRICES.GBP;
  if (/toronto|vancouver|canada|\ben-ca\b|\bca\b/.test(signal)) return REGIONAL_PRICES.CAD;
  if (/sydney|melbourne|australia|\ben-au\b|\bau\b/.test(signal)) return REGIONAL_PRICES.AUD;

  return EUR_PRICES;
}

export function getWorkZoLocalizedPlanPrice(plan: unknown, billingCycle: unknown = "monthly"): WorkZoLocalizedPlanPrice {
  const prices = getWorkZoRegionalPriceSet();
  const normalizedPlan = normalizeWorkZoPlan(plan);
  const normalizedCycle = normalizeWorkZoBillingCycle(billingCycle);
  const selected = prices[normalizedPlan];

  const regularPrice =
    "regularMonthly" in selected
      ? normalizedCycle === "monthly"
        ? selected.regularMonthly
        : selected.regularYearly
      : selected[normalizedCycle];

  return {
    plan: normalizedPlan,
    billingCycle: normalizedCycle,
    countryHint: prices.countryHint,
    currency: prices.currency,
    amount: selected[normalizedCycle],
    regular: regularPrice,
    savings: "savings" in selected ? selected.savings : "",
  };
}

export function getWorkZoDisplayPrices(billingCycle: unknown = "monthly") {
  return {
    free: getWorkZoLocalizedPlanPrice("free", billingCycle),
    premium: getWorkZoLocalizedPlanPrice("premium", billingCycle),
    premiumPro: getWorkZoLocalizedPlanPrice("premium_pro", billingCycle),
  };
}

// Backward-compatible helper used by older landing/pricing code.
export function getWorkZoDisplayPrice(): WorkZoDisplayPrice {
  const premium = getWorkZoLocalizedPlanPrice("premium", "monthly");
  return {
    countryHint: premium.countryHint,
    currency: premium.currency,
    regular: premium.regular || "€49.99",
    opening: premium.amount,
    billingNote: "Charged in the Stripe price configured for your selected plan.",
  };
}
