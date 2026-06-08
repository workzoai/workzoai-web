"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  BrainCircuit,
  CheckCircle2,
  FileText,
  Gift,
  History,
  Loader2,
  MessageSquare,
  Mic,
  Pencil,
  Sparkles,
  Tag,
  TrendingUp,
  Video,
  Zap,
} from "lucide-react";

import AuthNavButton from "@/components/auth/AuthNavButton";
import { getWorkZoDisplayPrice } from "@/lib/workzoLocalizedPricing";
import {
  disableWorkZoFounderTestMode,
  recordWorkZoUpgradeClick,
  resetWorkZoTestingUsage,
  setWorkZoCurrentPlan,
} from "@/lib/workzoUsageTracker";

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
  "Trust Score preview",
  "Weakest Answer analysis",
];

const premiumFeatures: Array<{ label: string; icon: ReactNode }> = [
  { label: "Unlimited AI interviews", icon: <Zap className="h-4 w-4" /> },
  { label: "Full recruiter reports", icon: <FileText className="h-4 w-4" /> },
  { label: "Trust Timeline", icon: <BarChart2 className="h-4 w-4" /> },
  { label: "Recruiter memory", icon: <BrainCircuit className="h-4 w-4" /> },
  { label: "AI Video Recruiter", icon: <Video className="h-4 w-4" /> },
  { label: "Improve CV", icon: <Pencil className="h-4 w-4" /> },
  { label: "Job Assist", icon: <TrendingUp className="h-4 w-4" /> },
  { label: "Cover Letter Generator", icon: <MessageSquare className="h-4 w-4" /> },
  { label: "Interview history", icon: <History className="h-4 w-4" /> },
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

    document.cookie = `workzo_after_login=${encodeURIComponent(
      "/billing/checkout?plan=premium",
    )}; Max-Age=900; Path=/; SameSite=Lax`;
  } catch {
    // Ignore client storage/cookie failures. Checkout can still proceed.
  }
}

export default function PricingPage() {
  const localizedPrice = useMemo(() => getWorkZoDisplayPrice(), []);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<PromoState>({
    code: "",
    valid: false,
    message: "",
    discountLabel: "",
  });
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  const normalizedPromo = useMemo(
    () => promoInput.trim().toUpperCase().replace(/\s+/g, ""),
    [promoInput],
  );

  function applyPromo() {
    if (!normalizedPromo) {
      setPromo({ code: "", valid: false, message: "Enter a promo code.", discountLabel: "" });
      return;
    }

    const match = VALID_PROMOS[normalizedPromo];

    if (!match) {
      setPromo({
        code: normalizedPromo,
        valid: false,
        message: "This promo code is not valid.",
        discountLabel: "",
      });
      return;
    }

    setPromo({
      code: normalizedPromo,
      valid: true,
      message: match.message,
      discountLabel: match.discountLabel,
    });

    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "workzo_promo_code",
        JSON.stringify({
          code: normalizedPromo,
          discountLabel: match.discountLabel,
          createdAt: new Date().toISOString(),
        }),
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
        JSON.stringify({
          plan: "free",
          source: "pricing",
          next: "/onboarding",
          createdAt: new Date().toISOString(),
        }),
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
        window.location.href = `/login?redirect=${encodeURIComponent(
          "/billing/checkout?plan=premium",
        )}&checkout=1&plan=premium`;
        return;
      }

      const data = (await response.json().catch(() => ({}))) as {
        url?: string;
        checkoutUrl?: string;
        sessionUrl?: string;
        error?: string;
      };

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
    <main
      className="min-h-screen px-4 py-8 text-white sm:px-6 lg:px-8"
      style={{ background: "oklch(0.13 0.04 260)" }}
    >
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, color-mix(in oklab, oklch(0.55 0.22 265) 25%, transparent), transparent), radial-gradient(ellipse 60% 40% at 90% 100%, color-mix(in oklab, oklch(0.85 0.17 200) 12%, transparent), transparent)",
        }}
      />

      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-black text-white/50 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back home
          </Link>
          <AuthNavButton />
        </div>

        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[1fr_420px]">
          <div>
            <div
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em]"
              style={{
                borderColor: "oklch(1 0 0 / 12%)",
                background: "oklch(1 0 0 / 6%)",
                color: "oklch(0.85 0.17 200)",
              }}
            >
              <Sparkles className="h-3 w-3" />
              Founding member pricing
            </div>

            <h1 className="mt-5 text-5xl font-black leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              Start free.
              <br />
              <span style={{ color: "oklch(0.65 0.04 260)" }}>Upgrade when you need</span>
              <br />
              deeper coaching.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7" style={{ color: "oklch(0.7 0.03 256)" }}>
              Practice with a realistic AI recruiter first. Unlock full reports, recruiter memory, video interviews,
              and job preparation tools when you are ready.
            </p>
          </div>

          <div
            className="rounded-2xl border p-5 backdrop-blur-sm"
            style={{ background: "oklch(0.18 0.04 260)", borderColor: "oklch(1 0 0 / 8%)" }}
          >
            <div className="flex items-start gap-3">
              <div
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                style={{
                  background: "color-mix(in oklab, oklch(0.85 0.17 200) 15%, transparent)",
                  color: "oklch(0.85 0.17 200)",
                }}
              >
                <Tag className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-sm font-black text-white">Have a promo code?</p>
                <p className="mt-0.5 text-xs leading-5" style={{ color: "oklch(0.7 0.03 256)" }}>
                  Save it now — we&apos;ll apply it at Premium checkout.
                </p>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <input
                value={promoInput}
                onChange={(event) => setPromoInput(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && applyPromo()}
                placeholder="Enter promo code"
                className="min-h-11 flex-1 rounded-xl border px-4 text-sm font-semibold text-white outline-none placeholder:text-white/30 transition focus:border-[oklch(0.85_0.17_200)/50]"
                style={{ background: "oklch(1 0 0 / 6%)", borderColor: "oklch(1 0 0 / 10%)" }}
              />
              <button
                type="button"
                onClick={applyPromo}
                className="rounded-xl px-4 py-2.5 text-sm font-black transition hover:brightness-110 active:scale-95"
                style={{ background: "oklch(0.85 0.17 200)", color: "oklch(0.18 0.05 230)" }}
              >
                Apply
              </button>
            </div>

            {promo.message ? (
              <p className={`mt-3 text-xs font-bold ${promo.valid ? "text-emerald-300" : "text-rose-300"}`}>
                {promo.message}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-[3fr_2fr]">
          <div
            className="relative flex flex-col overflow-hidden rounded-[2rem] border p-8 backdrop-blur-sm"
            style={{
              background: "oklch(0.17 0.05 265)",
              borderColor: "color-mix(in oklab, oklch(0.55 0.22 265) 35%, transparent)",
              boxShadow: "0 0 60px color-mix(in oklab, oklch(0.55 0.22 265) 12%, transparent)",
            }}
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent, oklch(0.55 0.22 265 / 0.5), transparent)" }}
            />

            <div className="flex items-center justify-between gap-3">
              <span
                className="text-[11px] font-black uppercase tracking-[0.20em]"
                style={{ color: "oklch(0.75 0.15 250)" }}
              >
                Premium
              </span>
              <span
                className="rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.14em]"
                style={{
                  background: "color-mix(in oklab, oklch(0.78 0.18 160) 15%, transparent)",
                  color: "oklch(0.78 0.18 160)",
                  border: "1px solid color-mix(in oklab, oklch(0.78 0.18 160) 30%, transparent)",
                }}
              >
                Founding Member
              </span>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <div
                className="grid h-9 w-9 place-items-center rounded-xl"
                style={{
                  background: "color-mix(in oklab, oklch(0.55 0.22 265) 25%, transparent)",
                  color: "oklch(0.75 0.15 250)",
                }}
              >
                <Video className="h-4.5 w-4.5" />
              </div>
              <h2 className="text-2xl font-black text-white sm:text-3xl">Unlock Full Recruiter Intelligence</h2>
            </div>

            <div className="mt-5 flex flex-wrap items-baseline gap-3">
              <span className="text-5xl font-black text-white sm:text-6xl">{localizedPrice.opening}</span>
              <span className="text-base font-semibold" style={{ color: "oklch(0.7 0.03 256)" }}>
                /mo
              </span>
              <span
                className="text-sm font-bold line-through decoration-2"
                style={{ color: "oklch(0.55 0.04 260)" }}
              >
                {localizedPrice.regular}
              </span>
              <span
                className="rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase tracking-[0.12em]"
                style={{
                  background: "color-mix(in oklab, oklch(0.78 0.18 160) 15%, transparent)",
                  color: "oklch(0.78 0.18 160)",
                  border: "1px solid color-mix(in oklab, oklch(0.78 0.18 160) 25%, transparent)",
                }}
              >
                Save 50%
              </span>
            </div>

            <p className="mt-1.5 text-sm font-black" style={{ color: "oklch(0.78 0.18 160)" }}>
              Early-user launch price.
            </p>
            <p className="mt-1 text-xs leading-5" style={{ color: "oklch(0.62 0.03 256)" }}>
              Detected pricing: {localizedPrice.countryHint} · {localizedPrice.currency}. {localizedPrice.billingNote}
            </p>
            <p className="mt-2 text-sm" style={{ color: "oklch(0.7 0.03 256)" }}>
              Everything you need to prepare for real interviews.
            </p>

            {promo.valid ? (
              <p
                className="mt-3 inline-flex items-center gap-1.5 self-start rounded-full border px-3 py-1 text-xs font-black text-emerald-200"
                style={{ borderColor: "oklch(0.78 0.18 160 / 0.25)", background: "oklch(0.78 0.18 160 / 0.08)" }}
              >
                <Gift className="h-3 w-3" />
                {promo.discountLabel} applied
              </p>
            ) : null}

            <div className="mt-6 grid grid-cols-2 gap-2.5">
              {premiumFeatures.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5"
                  style={{ background: "oklch(1 0 0 / 5%)", border: "1px solid oklch(1 0 0 / 6%)" }}
                >
                  <span style={{ color: "oklch(0.75 0.15 250)" }}>{item.icon}</span>
                  <span className="text-xs font-semibold text-white/80">{item.label}</span>
                </div>
              ))}
            </div>

            {checkoutError ? (
              <p className="mt-4 rounded-xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm font-bold text-rose-100">
                {checkoutError}
              </p>
            ) : null}

            <button
              type="button"
              onClick={choosePremium}
              disabled={checkoutLoading}
              className="mt-7 inline-flex items-center gap-2 self-start rounded-2xl px-7 py-3.5 text-sm font-black text-white transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                background: "linear-gradient(135deg, oklch(0.55 0.22 265), oklch(0.45 0.20 280))",
                boxShadow: "0 14px 40px oklch(0.55 0.22 265 / 0.28)",
              }}
            >
              {checkoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {checkoutLoading ? "Connecting…" : "Upgrade to Premium"}
            </button>
          </div>

          <div
            className="flex flex-col rounded-[2rem] border p-8 backdrop-blur-sm"
            style={{ background: "oklch(0.18 0.04 260)", borderColor: "oklch(1 0 0 / 8%)" }}
          >
            <span
              className="text-[11px] font-black uppercase tracking-[0.20em]"
              style={{ color: "oklch(0.78 0.18 160)" }}
            >
              Free
            </span>

            <div className="mt-3 flex items-start gap-3">
              <div
                className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                style={{
                  background: "color-mix(in oklab, oklch(0.78 0.18 160) 15%, transparent)",
                  color: "oklch(0.78 0.18 160)",
                }}
              >
                <Mic className="h-4.5 w-4.5" />
              </div>
              <h2 className="text-2xl font-black text-white sm:text-3xl">2 Free AI Voice Interviews</h2>
            </div>

            <p className="mt-3 text-sm leading-6" style={{ color: "oklch(0.7 0.03 256)" }}>
              Experience realistic recruiter interviews with AI voice before upgrading.
            </p>

            <ul className="mt-5 space-y-2.5">
              {freeFeatures.map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-white/80">
                  <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "oklch(0.78 0.18 160)" }} />
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-auto pt-8">
              <button
                type="button"
                onClick={startFreeInterview}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border bg-white/90 px-6 py-3.5 text-sm font-black text-slate-900 shadow-sm transition hover:bg-white active:scale-95"
              >
                Start Free Interview
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
