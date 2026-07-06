/**
 * lib/workzoVoiceTopUps.ts
 *
 * Pay-as-you-go voice minute packs.
 *
 * ── Pricing model (why these numbers) ────────────────────────────────────────
 * Estimated blended serving cost per voice minute (Vapi platform + ElevenLabs
 * TTS + STT + LLM): ~$0.13/min. UPDATE WORKZO_ESTIMATED_COST_PER_MINUTE_USD
 * whenever real invoices say otherwise — the margin comments below assume it.
 *
 *   Pack     Price     €/min    Est. cost   Net after Stripe*   Gross margin
 *   30 min   €7.99     €0.266   ~$3.90      ~€7.50 (~$8.10)     ~52%
 *   60 min   €14.99    €0.250   ~$7.80      ~€14.30 (~$15.45)   ~49%
 *   150 min  €32.99    €0.220   ~$19.50     ~€31.75 (~$34.30)   ~43%
 *   (*Stripe ≈ 2.9% + €0.25)
 *
 * Guard rails:
 * - Top-ups are ONLY purchasable on paid plans (premium / premium_pro). Free
 *   users must upgrade first, so packs can never replace a subscription.
 * - Per-minute pack pricing sits at or above the Premium effective rate
 *   (€29.99 / 120 min = €0.25/min), so the subscription always stays the
 *   better baseline deal and packs are genuine overflow.
 * - Credits never expire and roll over: they are only consumed AFTER the
 *   monthly plan allowance is exhausted (see workzoServerVoiceMinutes).
 * - No pack below €7.99: Stripe's fixed fee makes smaller one-time payments
 *   disproportionately expensive.
 */

export const WORKZO_ESTIMATED_COST_PER_MINUTE_USD = 0.13;

export type WorkZoTopUpPackId = "boost_30" | "boost_60" | "boost_150";

export type WorkZoTopUpPack = {
  id: WorkZoTopUpPackId;
  minutes: number;
  label: string;
  description: string;
  /** Minor units (cents) per supported currency, for Stripe price_data. */
  unitAmount: Record<string, number>;
  /** Display strings keyed by currency code. */
  display: Record<string, string>;
};

export const WORKZO_TOPUP_CURRENCIES = ["eur", "usd", "gbp", "inr", "cad", "aud"] as const;
export type WorkZoTopUpCurrency = (typeof WORKZO_TOPUP_CURRENCIES)[number];

export const WORKZO_TOPUP_PACKS: WorkZoTopUpPack[] = [
  {
    id: "boost_30",
    minutes: 30,
    label: "30-minute boost",
    description: "About two extra full mock interviews.",
    unitAmount: { eur: 799, usd: 799, gbp: 699, inr: 69900, cad: 1099, aud: 1199 },
    display: { eur: "€7.99", usd: "$7.99", gbp: "£6.99", inr: "₹699", cad: "CA$10.99", aud: "A$11.99" },
  },
  {
    id: "boost_60",
    minutes: 60,
    label: "60-minute boost",
    description: "A focused final-round prep week.",
    unitAmount: { eur: 1499, usd: 1499, gbp: 1299, inr: 129900, cad: 1999, aud: 2199 },
    display: { eur: "€14.99", usd: "$14.99", gbp: "£12.99", inr: "₹1,299", cad: "CA$19.99", aud: "A$21.99" },
  },
  {
    id: "boost_150",
    minutes: 150,
    label: "150-minute boost",
    description: "Full interview-season coverage on top of your plan.",
    unitAmount: { eur: 3299, usd: 3299, gbp: 2799, inr: 279900, cad: 4399, aud: 4799 },
    display: { eur: "€32.99", usd: "$32.99", gbp: "£27.99", inr: "₹2,799", cad: "CA$43.99", aud: "A$47.99" },
  },
];

export function getWorkZoTopUpPack(id: unknown): WorkZoTopUpPack | null {
  const key = String(id || "").trim();
  return WORKZO_TOPUP_PACKS.find((pack) => pack.id === key) || null;
}

export function normalizeTopUpCurrency(value: unknown): WorkZoTopUpCurrency {
  const key = String(value || "").trim().toLowerCase();
  return (WORKZO_TOPUP_CURRENCIES as readonly string[]).includes(key)
    ? (key as WorkZoTopUpCurrency)
    : "eur";
}

/** Plans allowed to buy packs. Free users must upgrade first (see header). */
export function planCanBuyTopUps(plan: string | null | undefined): boolean {
  return plan === "premium" || plan === "premium_pro";
}

/** Metadata keys carried on the Stripe Checkout session for the webhook. */
export const WORKZO_TOPUP_METADATA_KEYS = {
  kind: "workzo_purchase_kind", // set to "voice_topup"
  packId: "workzo_topup_pack_id",
  minutes: "workzo_topup_minutes",
  userId: "workzo_user_id",
} as const;

export const WORKZO_TOPUP_KIND = "voice_topup";
