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
  premium: { monthly: "€19.99", yearly: "€149.99", regularMonthly: "€39.99", regularYearly: "€239.88", savings: "Save about 37% yearly" },
  premium_pro: { monthly: "€39.99", yearly: "€299.99", regularMonthly: "€59.99", regularYearly: "€479.88", savings: "Save about 37% yearly" },
};

const REGIONAL_PRICES: Record<string, RegionalPriceSet> = {
  EUR: EUR_PRICES,
  USD: {
    countryHint: "United States",
    currency: "USD",
    free: { monthly: "$0", yearly: "$0" },
    premium: { monthly: "$19.99", yearly: "$149.99", regularMonthly: "$39.99", regularYearly: "$239.88", savings: "Save about 37% yearly" },
    premium_pro: { monthly: "$39.99", yearly: "$299.99", regularMonthly: "$59.99", regularYearly: "$479.88", savings: "Save about 37% yearly" },
  },
  GBP: {
    countryHint: "United Kingdom",
    currency: "GBP",
    free: { monthly: "£0", yearly: "£0" },
    premium: { monthly: "£16.99", yearly: "£129.99", regularMonthly: "£32.99", regularYearly: "£203.88", savings: "Save with yearly" },
    premium_pro: { monthly: "£34.99", yearly: "£249.99", regularMonthly: "£49.99", regularYearly: "£419.88", savings: "Save with yearly" },
  },
  INR: {
    countryHint: "India",
    currency: "INR",
    free: { monthly: "₹0", yearly: "₹0" },
    premium: { monthly: "₹1,699", yearly: "₹12,499", regularMonthly: "₹3,399", regularYearly: "₹20,388", savings: "Save with yearly" },
    premium_pro: { monthly: "₹3,399", yearly: "₹24,999", regularMonthly: "₹4,999", regularYearly: "₹40,788", savings: "Save with yearly" },
  },
  CAD: {
    countryHint: "Canada",
    currency: "CAD",
    free: { monthly: "CA$0", yearly: "CA$0" },
    premium: { monthly: "CA$27.99", yearly: "CA$199.99", regularMonthly: "CA$54.99", regularYearly: "CA$335.88", savings: "Save with yearly" },
    premium_pro: { monthly: "CA$54.99", yearly: "CA$399.99", regularMonthly: "CA$79.99", regularYearly: "CA$659.88", savings: "Save with yearly" },
  },
  AUD: {
    countryHint: "Australia",
    currency: "AUD",
    free: { monthly: "A$0", yearly: "A$0" },
    premium: { monthly: "A$29.99", yearly: "A$229.99", regularMonthly: "A$59.99", regularYearly: "A$359.88", savings: "Save with yearly" },
    premium_pro: { monthly: "A$59.99", yearly: "A$449.99", regularMonthly: "A$89.99", regularYearly: "A$719.88", savings: "Save with yearly" },
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
    regular: premium.regular || "€39.99",
    opening: premium.amount,
    billingNote: "Charged in the Stripe price configured for your selected plan.",
  };
}
