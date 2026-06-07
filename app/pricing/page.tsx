"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Gift,
  Lock,
  ShieldCheck,
  Sparkles,
  Tag,
  Video,
  Zap,
} from "lucide-react";
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
const PREMIUM_SAVING = "Save 50%";

const VALID_PROMOS: Record<string, { message: string; discountLabel: string }> = {
  EARLYACCESS: {
    message: "Early access code applied. Your discount will be carried into checkout when payments are enabled.",
    discountLabel: "Early access discount",
  },
  WORKZOEARLY: {
    message: "WorkZo early-user code applied. Your discount will be carried into checkout when payments are enabled.",
    discountLabel: "Early-user discount",
  },
  FOUNDERFRIEND: {
    message: "Founder friend code applied for testing. This stores your promo for checkout.",
    discountLabel: "Founder friend access",
  },
};

const freeFeatures = [
  "Upload CV and job context",
  "2 realistic AI voice interviews",
  "CV + job-aware recruiter questions",
  "Adaptive follow-up questions",
  "Free recruiter-style results snapshot",
  "Premium report previews with locked insights",
];

const premiumFeatures = [
  "25 recruiter-style interviews per month",
  "AI Voice + Video Recruiters",
  "Company-specific interview modes",
  "Full recruiter timeline and transcript",
  "Trust score and contradiction audit",
  "Answer rewrites and recruiter interpretation",
  "Interview history and progress tracking",
  "Improve CV, Cover Letter, and Job Assistant",
];

const comparisonRows = [
  { label: "Recruiter-style interviews", free: "2/month", premium: "25/month" },
  { label: "CV + JD aware questions", free: "Included", premium: "Included" },
  { label: "Free score snapshot", free: "Included", premium: "Included" },
  { label: "Full timeline report", free: "Preview only", premium: "Unlocked" },
  { label: "Trust + contradiction audit", free: "Locked", premium: "Unlocked" },
  { label: "Answer rewrites", free: "Locked", premium: "Unlocked" },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function PricingPage() {
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<PromoState>({
    code: "",
    valid: false,
    message: "",
    discountLabel: "",
  });

  const normalizedPromo = useMemo(
    () => promoInput.trim().toUpperCase().replace(/\s+/g, ""),
    [promoInput],
  );

  function applyPromo() {
    if (!normalizedPromo) {
      setPromo({
        code: "",
        valid: false,
        message: "Enter a promo code.",
        discountLabel: "",
      });
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

  function choosePremiumBeforeStripe() {
    recordWorkZoUpgradeClick();

    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "workzo_pending_checkout",
        JSON.stringify({
          plan: "premium",
          source: "pricing",
          next: "/onboarding",
          regularPrice: `${PREMIUM_REGULAR_PRICE}/month`,
          openingOfferPrice: `${PREMIUM_OPENING_PRICE}/month`,
          promoCode: promo.valid ? promo.code : "",
          promoLabel: promo.valid ? promo.discountLabel : "",
          status: "stripe_not_connected_yet",
          createdAt: new Date().toISOString(),
        }),
      );

      window.location.href = "/login?next=/pricing&plan=premium";
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#050a12] px-5 py-8 text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.13),transparent_32%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.2),rgba(2,6,23,0.95))]" />

      <div className="mx-auto max-w-6xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-black text-slate-300 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back home
        </Link>

        <section className="mt-10 text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-cyan-100">
            <Sparkles className="h-4 w-4" />
            Opening offer for early users
          </div>

          <h1 className="mx-auto mt-5 max-w-4xl text-4xl font-black tracking-[-0.05em] sm:text-6xl">
            Start free. Unlock the full recruiter intelligence when you are ready.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
            Practice with a realistic AI recruiter, then upgrade for the full timeline, trust audit, contradiction analysis, answer rewrites, and company-specific coaching.
          </p>
        </section>

        <section className="mx-auto mt-8 max-w-3xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-200">
              <Tag className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-black text-white">Have a promo code?</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Enter your code here. It will be saved and used when Premium checkout is connected.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  value={promoInput}
                  onChange={(event) => setPromoInput(event.target.value)}
                  placeholder="Enter promo code"
                  className="min-h-12 flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/50"
                />
                <button
                  type="button"
                  onClick={applyPromo}
                  className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300"
                >
                  Apply code
                </button>
              </div>
              {promo.message ? (
                <p className={cn("mt-3 text-sm font-bold", promo.valid ? "text-emerald-300" : "text-rose-300")}>
                  {promo.message}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-[2rem] border border-emerald-300/20 bg-emerald-400/[0.06] p-7 shadow-2xl shadow-black/20">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-300">Free trial</p>
                <h2 className="mt-3 text-3xl font-black">2 AI Voice Interviews</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Try the core recruiter experience with your CV and target role before paying.
                </p>
              </div>
              <div className="rounded-2xl bg-emerald-400/10 px-4 py-3 text-2xl font-black text-emerald-100">€0</div>
            </div>

            <ul className="mt-7 space-y-3">
              {freeFeatures.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-6 text-slate-200">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={startFreeInterview}
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 text-sm font-black text-slate-950 transition hover:bg-slate-200"
            >
              Start Free Interview
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="relative overflow-hidden rounded-[2rem] border border-blue-300/25 bg-gradient-to-br from-blue-500/25 via-blue-500/[0.12] to-cyan-400/[0.08] p-7 shadow-2xl shadow-blue-950/25">
            <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-500" />
            <div className="absolute right-5 top-5 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-100">
              Early Access • 50% Off
            </div>

            <div className="pr-24">
              <p className="text-sm font-black uppercase tracking-[0.22em] text-blue-100">Premium</p>
              <h2 className="mt-3 text-3xl font-black">Full recruiter intelligence</h2>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <span className="text-lg font-black text-slate-400 line-through decoration-2">
                  {PREMIUM_REGULAR_PRICE}/month
                </span>
                <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-emerald-200">
                  Opening offer
                </span>
              </div>

              <p className="mt-2 text-5xl font-black tracking-[-0.04em]">
                {PREMIUM_OPENING_PRICE}<span className="text-xl text-white/55">/month</span>
              </p>
              <p className="mt-2 text-sm font-black text-emerald-300">
                {PREMIUM_SAVING} as an early WorkZo AI user.
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Price is planned to increase to {PREMIUM_REGULAR_PRICE}/month after Early Access ends.
              </p>

              {promo.valid ? (
                <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-200">
                  <Gift className="h-3.5 w-3.5" />
                  {promo.discountLabel} applied
                </p>
              ) : null}
            </div>

            <ul className="mt-7 grid gap-3 sm:grid-cols-2">
              {premiumFeatures.map((item) => (
                <li key={item} className="flex gap-3 rounded-2xl border border-white/10 bg-black/15 p-3 text-sm leading-6 text-slate-100">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-blue-200" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={choosePremiumBeforeStripe}
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 px-5 py-4 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400"
            >
              Get Premium Opening Offer
              <Lock className="h-4 w-4" />
            </button>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <p className="flex items-center gap-2 text-xs leading-5 text-slate-400">
                <Video className="h-3.5 w-3.5 shrink-0" />
                Secure checkout will connect to this button.
              </p>
              <p className="flex items-center gap-2 text-xs leading-5 text-slate-400 sm:justify-end">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                Cancel anytime after billing is enabled.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
