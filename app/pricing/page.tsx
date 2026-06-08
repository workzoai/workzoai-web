"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Gift, Loader2, ShieldCheck, Sparkles, Tag } from "lucide-react";
import { disableWorkZoFounderTestMode, recordWorkZoUpgradeClick, resetWorkZoTestingUsage, setWorkZoCurrentPlan } from "@/lib/workzoUsageTracker";
import { getWorkZoDisplayPrice } from "@/lib/workzoLocalizedPricing";
import AuthNavButton from "@/components/auth/AuthNavButton";

type PromoState = {
  code: string;
  valid: boolean;
  message: string;
  discountLabel: string;
};

const PREMIUM_REGULAR_PRICE = "€29.99";
const PREMIUM_OPENING_PRICE = "€14.99";

const VALID_PROMOS: Record<string, { message: string; discountLabel: string }> = {
  EARLYACCESS: {
    message: "Early access code applied. Your discount will be carried into checkout.",
    discountLabel: "Early access discount",
  },
  WORKZOEARLY: {
    message: "WorkZo early-user code applied. Your discount will be carried into checkout.",
    discountLabel: "Early-user discount",
  },
  FOUNDERFRIEND: {
    message: "Founder friend code applied for testing. This stores your promo for checkout.",
    discountLabel: "Founder friend access",
  },
};

const freeFeatures = [
  "2 full AI voice interviews",
  "CV + job aware interview",
  "Dynamic recruiter follow-ups",
  "Interview score preview",
];

const premiumFeatures = [
  "25 interviews/month",
  "AI Video Recruiter",
  "Full interview reports",
  "Interview history",
  "Improve CV",
  "Cover Letter Generator",
  "Job Assist",
];

function readStoredPromo(validPromo?: PromoState) {
  if (validPromo?.valid) return validPromo.code;
  if (typeof window === "undefined") return "";

  try {
    const raw = window.localStorage.getItem("workzo_promo_code");
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { code?: string };
    return typeof parsed.code === "string" ? parsed.code : "";
  } catch {
    return "";
  }
}

function savePendingCheckout(promoCode: string, status: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      "workzo_pending_checkout",
      JSON.stringify({
        plan: "premium",
        source: "pricing",
        next: "/billing/checkout?plan=premium",
        regularPrice: `${PREMIUM_REGULAR_PRICE}/month`,
        openingOfferPrice: `${PREMIUM_OPENING_PRICE}/month`,
        promoCode,
        status,
        createdAt: new Date().toISOString(),
      }),
    );
    document.cookie = `workzo_after_login=${encodeURIComponent("/billing/checkout?plan=premium")}; Max-Age=900; Path=/; SameSite=Lax`;
  } catch {}
}

export default function PricingPage() {
  const localizedPrice = useMemo(() => getWorkZoDisplayPrice(), []);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<PromoState>({ code: "", valid: false, message: "", discountLabel: "" });
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  const normalizedPromo = useMemo(() => promoInput.trim().toUpperCase().replace(/\s+/g, ""), [promoInput]);

  function applyPromo() {
    if (!normalizedPromo) {
      setPromo({ code: "", valid: false, message: "Enter a promo code.", discountLabel: "" });
      return;
    }

    const match = VALID_PROMOS[normalizedPromo];
    if (!match) {
      setPromo({ code: normalizedPromo, valid: false, message: "This promo code is not valid.", discountLabel: "" });
      return;
    }

    setPromo({ code: normalizedPromo, valid: true, message: match.message, discountLabel: match.discountLabel });

    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "workzo_promo_code",
        JSON.stringify({ code: normalizedPromo, discountLabel: match.discountLabel, createdAt: new Date().toISOString() }),
      );
    }
  }

  function startFreeInterview() {
    disableWorkZoFounderTestMode();
    setWorkZoCurrentPlan("free");
    resetWorkZoTestingUsage();

    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "workzo_selected_plan_intent",
        JSON.stringify({ plan: "free", source: "pricing", next: "/onboarding", createdAt: new Date().toISOString() }),
      );
      window.location.href = "/onboarding";
    }
  }

  async function choosePremium() {
    if (checkoutLoading) return;

    recordWorkZoUpgradeClick();
    setCheckoutError("");
    setCheckoutLoading(true);

    const promoCode = readStoredPromo(promo);
    savePendingCheckout(promoCode, "checkout_started");

    try {
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "premium", source: "pricing", promoCode }),
      });

      if (response.status === 401 || response.status === 403) {
        savePendingCheckout(promoCode, "login_required");
        window.location.href = `/login?redirect=${encodeURIComponent("/billing/checkout?plan=premium")}&checkout=1&plan=premium`;
        return;
      }

      const data = await response.json().catch(() => ({})) as { url?: string; checkoutUrl?: string; sessionUrl?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not create checkout session.");

      const checkoutUrl = data.url || data.checkoutUrl || data.sessionUrl;
      if (!checkoutUrl) throw new Error("Stripe checkout URL was not returned.");

      window.location.href = checkoutUrl;
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Checkout failed. Please try again.");
      setCheckoutLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#020a18] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_110%_65%_at_50%_-5%,rgba(37,99,235,0.32)_0%,rgba(14,50,140,0.15)_40%,transparent_70%)]" />

      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-black text-slate-300 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Back home
          </Link>
          <AuthNavButton />
        </div>

        <section className="mx-auto mt-10 max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.20em] text-white/80 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            Opening offer for early users
          </div>

          <h1 className="mt-6 text-4xl font-black leading-[1.02] tracking-tight sm:text-6xl">
            Start free. Upgrade when you need deeper coaching.
          </h1>
          <p className="mt-6 text-lg leading-8 text-white/70">
            Practice with a realistic AI recruiter first. Unlock full reports, recruiter memory, video interviews, and job preparation tools when you are ready.
          </p>
        </section>

        <section className="mx-auto mt-8 max-w-3xl rounded-[2rem] border border-white/10 bg-black/20 p-5 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-200">
              <Tag className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-black text-white">Have a promo code?</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">Enter your code here. It will be saved and used during Premium checkout.</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  value={promoInput}
                  onChange={(event) => setPromoInput(event.target.value)}
                  placeholder="Enter promo code"
                  className="min-h-12 flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/50"
                />
                <button type="button" onClick={applyPromo} className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300">
                  Apply code
                </button>
              </div>
              {promo.message ? <p className={`mt-3 text-sm font-bold ${promo.valid ? "text-emerald-300" : "text-rose-300"}`}>{promo.message}</p> : null}
            </div>
          </div>
        </section>

        <section className="mt-14 grid gap-5 lg:grid-cols-2">
          <div className="flex flex-col rounded-[2rem] border border-emerald-300/20 bg-emerald-400/[0.06] p-8 backdrop-blur-sm">
            <p className="text-sm font-black uppercase tracking-[0.20em] text-emerald-300">Free</p>
            <h2 className="mt-3 text-3xl font-black">2 Free AI Voice Interviews</h2>
            <p className="mt-3 text-white/60">Experience realistic recruiter interviews with AI voice before upgrading.</p>
            <ul className="mt-5 space-y-2">
              {freeFeatures.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-white/80">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                  {item}
                </li>
              ))}
            </ul>
            <button type="button" onClick={startFreeInterview} className="mt-8 inline-flex items-center gap-2 self-start rounded-2xl bg-white px-6 py-3 text-sm font-black text-slate-900 shadow-lg transition hover:scale-[1.02] hover:bg-blue-50">
              Start Free Interview
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="relative flex flex-col rounded-[2rem] border border-blue-300/25 bg-blue-500/[0.08] p-8 backdrop-blur-sm">
            <div className="absolute right-5 top-5 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-200">Opening Offer</div>

            <p className="text-sm font-black uppercase tracking-[0.20em] text-blue-200">Premium</p>
            <h2 className="mt-3 text-3xl font-black text-white">Unlock AI Video Recruiter</h2>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className="text-lg font-black text-white/40 line-through decoration-2">{localizedPrice.regular}/month</span>
              <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-emerald-200">Save 50%</span>
            </div>

            <p className="mt-2 text-5xl font-black">{localizedPrice.opening}<span className="text-xl text-white/50">/month</span></p>
            <p className="mt-2 text-sm font-black text-emerald-300">Early-user launch price.</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">Detected pricing: {localizedPrice.countryHint} · {localizedPrice.currency}. {localizedPrice.billingNote}</p>

            {promo.valid ? (
              <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-200">
                <Gift className="h-3.5 w-3.5" />
                {promo.discountLabel} applied
              </p>
            ) : null}

            <p className="mt-4 text-white/60">Practice with realistic AI recruiter avatars, full interview reports, recruiter memory, CV tools, and job preparation features.</p>
            <ul className="mt-5 space-y-2">
              {premiumFeatures.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-white/80">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-blue-200" />
                  {item}
                </li>
              ))}
            </ul>

            <button type="button" onClick={choosePremium} disabled={checkoutLoading} className="mt-8 inline-flex items-center gap-2 self-start rounded-2xl bg-blue-500 px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:scale-[1.02] hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60">
              {checkoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {checkoutLoading ? "Connecting…" : "Upgrade to Premium"}
            </button>

            {checkoutError ? <p className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm font-bold text-rose-100">{checkoutError}</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
