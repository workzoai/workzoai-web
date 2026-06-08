export type WorkZoDisplayPrice = {
  countryHint: string;
  currency: string;
  regular: string;
  opening: string;
  billingNote: string;
};

const DEFAULT_PRICE: WorkZoDisplayPrice = {
  countryHint: "EU",
  currency: "EUR",
  regular: "€29.99",
  opening: "€14.99",
  billingNote: "Charged monthly. Taxes may apply.",
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

export function getWorkZoDisplayPrice(): WorkZoDisplayPrice {
  const timezone = getTimezone().toLowerCase();
  const locale = getLocale();
  const signal = `${timezone} ${locale}`;

  if (/india|kolkata|calcutta|\bin\b|hi-|ta-|te-|ml-|kn-/.test(signal)) {
    return {
      countryHint: "India",
      currency: "INR",
      regular: "₹2,499",
      opening: "₹1,249",
      billingNote: "Approximate local display. Checkout may charge in the configured Stripe currency until regional prices are added.",
    };
  }

  if (/america\/|united states|\ben-us\b|\bus\b/.test(signal)) {
    return {
      countryHint: "United States",
      currency: "USD",
      regular: "$29.99",
      opening: "$14.99",
      billingNote: "Shown in USD for US visitors. Use matching Stripe USD prices when ready.",
    };
  }

  if (/london|united kingdom|\ben-gb\b|\bgb\b/.test(signal)) {
    return {
      countryHint: "United Kingdom",
      currency: "GBP",
      regular: "£24.99",
      opening: "£12.99",
      billingNote: "Approximate local display. Use matching Stripe GBP prices when ready.",
    };
  }

  if (/toronto|vancouver|canada|\ben-ca\b|\bca\b/.test(signal)) {
    return {
      countryHint: "Canada",
      currency: "CAD",
      regular: "CA$39.99",
      opening: "CA$19.99",
      billingNote: "Approximate local display. Use matching Stripe CAD prices when ready.",
    };
  }

  if (/sydney|melbourne|australia|\ben-au\b|\bau\b/.test(signal)) {
    return {
      countryHint: "Australia",
      currency: "AUD",
      regular: "A$44.99",
      opening: "A$22.99",
      billingNote: "Approximate local display. Use matching Stripe AUD prices when ready.",
    };
  }

  return DEFAULT_PRICE;
}
