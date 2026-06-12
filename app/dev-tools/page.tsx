"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  disableWorkZoFounderTestMode,
  enableWorkZoFounderTestMode,
  getWorkZoCurrentPlan,
  getWorkZoUsageSummary,
  resetWorkZoTestingUsage,
  setWorkZoCurrentPlan,
  clearWorkZoDevPlanOverride,
  getWorkZoDevPlanOverride,
} from "@/lib/workzoUsageTracker";
import { getWorkZoPlanLimits, normalizeWorkZoPlan, type WorkZoPlanType } from "@/lib/workzoPlanLimits";

type DevSummary = ReturnType<typeof getWorkZoUsageSummary>;

const TEST_USAGE_KEY = "workzo_usage_state_v2";
const CHECKOUT_KEYS = [
  "workzo_pending_checkout",
  "workzo_selected_plan_intent",
  "workzo_pending_upgrade_route",
  "workzo_allow_standard_start_once",
  "workzo_after_login",
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function safeNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function setUsagePatch(patch: Record<string, unknown>) {
  if (typeof window === "undefined") return;

  try {
    const raw = window.localStorage.getItem(TEST_USAGE_KEY);
    const existing = raw ? JSON.parse(raw) : {};
    window.localStorage.setItem(
      TEST_USAGE_KEY,
      JSON.stringify({
        ...existing,
        monthKey:
          existing?.monthKey ||
          `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
        ...patch,
        lastUpdatedAt: new Date().toISOString(),
      }),
    );
  } catch {
    // Ignore localStorage errors in dev tools.
  }
}

export default function DevToolsPage() {
  const [mounted, setMounted] = useState(false);
  const [summary, setSummary] = useState<DevSummary | null>(null);
  const [plan, setPlan] = useState<WorkZoPlanType>("free");
  const [devOverrideActive, setDevOverrideActive] = useState(false);

  function refresh() {
    if (typeof window === "undefined") return;
    const currentPlan = normalizeWorkZoPlan(getWorkZoCurrentPlan());
    setSummary(getWorkZoUsageSummary(currentPlan));
    setPlan(currentPlan);
    setDevOverrideActive(Boolean(getWorkZoDevPlanOverride()));
  }

  function clearCheckoutState() {
    if (typeof window === "undefined") return;
    for (const key of CHECKOUT_KEYS) {
      window.localStorage.removeItem(key);
    }
    document.cookie = "workzo_after_login=; Max-Age=0; Path=/; SameSite=Lax";
    refresh();
  }

  // Full reset — clears the dev plan override so the real DB plan
  // (from /api/account/plan) takes effect again on next page load.
  function resetToRealAccountPlan() {
    if (typeof window === "undefined") return;
    clearWorkZoDevPlanOverride();
    clearCheckoutState();
    window.location.reload();
  }

  function setPlanForTesting(nextPlan: WorkZoPlanType) {
    disableWorkZoFounderTestMode();
    // isDevOverride=true: this plan persists even after pages call
    // fetchWorkZoAuthoritativePlan() and get "free" back from the DB.
    setWorkZoCurrentPlan(nextPlan, true);
    resetWorkZoTestingUsage();
    clearCheckoutState();
    refresh();
  }

  function testAsFounderUnlimited() {
    enableWorkZoFounderTestMode();
    setWorkZoCurrentPlan("premium_pro", true);
    resetWorkZoTestingUsage();
    clearCheckoutState();
    refresh();
  }

  function resetOnlyTavusMinutes() {
    setUsagePatch({
      tavusInterviewsStarted: 0,
      tavusMinutesUsed: 0,
    });
    refresh();
  }

  function simulateFreeLimitReached() {
    setWorkZoCurrentPlan("free", true);
    setUsagePatch({
      interviewsStarted: 2,
      tavusInterviewsStarted: 0,
      tavusMinutesUsed: 0,
    });
    refresh();
  }

  function simulatePremiumLimitReached() {
    setWorkZoCurrentPlan("premium", true);
    setUsagePatch({
      interviewsStarted: 50,
      tavusInterviewsStarted: 0,
      tavusMinutesUsed: 0,
    });
    refresh();
  }

  function simulateProTavusExpired() {
    setWorkZoCurrentPlan("premium_pro", true);
    setUsagePatch({
      tavusInterviewsStarted: 999,
      tavusMinutesUsed: 60,
    });
    refresh();
  }

  useEffect(() => {
    setMounted(true);
    refresh();
  }, []);

  const limits = useMemo(() => getWorkZoPlanLimits(plan), [plan]);
  const summaryAny = summary as any;

  const displayPlan = mounted ? plan : "free";
  const founderMode = mounted && summaryAny?.testMode ? "enabled" : "disabled";
  const usage = summaryAny?.usage || {};
  const interviewsUsed = safeNumber(usage.interviewsStarted);
  const interviewsLeft = safeNumber(summaryAny?.interviewsRemaining);
  const tavusUsed = safeNumber(usage.tavusMinutesUsed);
  const tavusLimit = safeNumber(limits.tavusMinutesPerMonth);
  const tavusLeft = Math.max(0, tavusLimit - tavusUsed);
  const voiceLimit = limits.unlimitedVoiceInterviews ? "Unlimited" : String(limits.voiceInterviewsPerMonth);

  const planCards: Array<{
    plan: WorkZoPlanType;
    title: string;
    description: string;
    tone: string;
  }> = [
    {
      plan: "free",
      title: "Test Free",
      description: "2 voice interviews, basic report, locked premium tools.",
      tone: "border-emerald-300/20 bg-emerald-400/10 text-emerald-100",
    },
    {
      plan: "premium",
      title: "Test Premium",
      description: "50 voice interviews, CV tools, Job Assist, Career Brain.",
      tone: "border-blue-300/20 bg-blue-400/10 text-blue-100",
    },
    {
      plan: "premium_pro",
      title: "Test Premium Pro",
      description: "Unlimited voice interviews, 60 Tavus minutes, Career Coach.",
      tone: "border-violet-300/20 bg-violet-400/10 text-violet-100",
    },
  ];

  return (
    <main className="min-h-screen bg-[#050a12] px-5 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="text-sm font-black text-slate-300 hover:text-white">
          ← Back home
        </Link>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-cyan-200">
            Founder testing
          </p>
          <h1 className="mt-3 text-4xl font-black">WorkZo Dev Tools</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Switch between Free, Premium, and Premium Pro without Stripe. Use this page to test dashboard gating,
            onboarding recruiter locks, interview limits, results gating, Tavus minute behavior, and Premium Pro features.
          </p>

          <div className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-7 text-slate-200 sm:grid-cols-2 lg:grid-cols-6">
            <p>
              Plan: <strong>{displayPlan}</strong>
            </p>
            <p>
              Override: <strong className={devOverrideActive ? "text-amber-300" : "text-slate-500"}>{devOverrideActive ? "Active" : "None"}</strong>
            </p>
            <p>
              Founder mode: <strong>{founderMode}</strong>
            </p>
            <p>
              Voice used: <strong>{interviewsUsed}</strong>
            </p>
            <p>
              Voice limit: <strong>{voiceLimit}</strong>
            </p>
            <p>
              Voice left: <strong>{limits.unlimitedVoiceInterviews ? "∞" : interviewsLeft}</strong>
            </p>
            <p>
              Tavus: <strong>{tavusUsed}/{tavusLimit}</strong>
            </p>
          </div>

          {devOverrideActive && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/20 bg-amber-400/[0.07] p-4">
              <div>
                <p className="text-sm font-black text-amber-200">Dev plan override active: {displayPlan}</p>
                <p className="mt-1 text-xs leading-5 text-amber-100/80">
                  Every page will show this plan, even after calling /api/account/plan. This persists across page loads until cleared.
                </p>
              </div>
              <button
                type="button"
                onClick={resetToRealAccountPlan}
                className="shrink-0 rounded-xl border border-amber-300/25 bg-amber-400/10 px-4 py-2 text-xs font-black text-amber-100 hover:bg-amber-400/15"
              >
                Clear override — use real account plan
              </button>
            </div>
          )}

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {planCards.map((card) => (
              <button
                key={card.plan}
                type="button"
                onClick={() => setPlanForTesting(card.plan)}
                className={cn(
                  "rounded-2xl border p-5 text-left transition hover:scale-[1.01]",
                  card.tone,
                  plan === card.plan && "ring-2 ring-white/30",
                )}
              >
                <p className="text-lg font-black">{card.title}</p>
                <p className="mt-2 text-sm leading-6 opacity-80">{card.description}</p>
                <p className="mt-3 text-xs font-black uppercase tracking-[0.18em] opacity-70">
                  {plan === card.plan ? "Current test plan" : "Switch plan"}
                </p>
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-violet-300/15 bg-violet-500/[0.06] p-5">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-violet-200">
              Premium Pro Tavus testing
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Tavus minutes used</p>
                <p className="mt-2 text-3xl font-black">{tavusUsed}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Tavus monthly limit</p>
                <p className="mt-2 text-3xl font-black">{tavusLimit}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Tavus minutes left</p>
                <p className="mt-2 text-3xl font-black">{tavusLeft}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={resetOnlyTavusMinutes}
                className="rounded-2xl border border-white/10 px-5 py-4 text-sm font-black text-slate-200 hover:bg-white/10"
              >
                Reset Tavus Minutes
              </button>
              <button
                type="button"
                onClick={simulateProTavusExpired}
                className="rounded-2xl border border-red-300/20 bg-red-500/10 px-5 py-4 text-sm font-black text-red-100 hover:bg-red-500/15"
              >
                Simulate Tavus Expired
              </button>
              <Link
                href="/interview?test=1&mode=tavus"
                className="rounded-2xl border border-violet-300/20 bg-violet-400/10 px-5 py-4 text-center text-sm font-black text-violet-100 hover:bg-violet-400/15"
              >
                Test Tavus Room
              </Link>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-300">
              Limit simulation
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={simulateFreeLimitReached}
                className="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-5 py-4 text-sm font-black text-amber-100 hover:bg-amber-400/15"
              >
                Simulate Free Limit
              </button>
              <button
                type="button"
                onClick={simulatePremiumLimitReached}
                className="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-5 py-4 text-sm font-black text-amber-100 hover:bg-amber-400/15"
              >
                Simulate Premium Limit
              </button>
              <button
                type="button"
                onClick={testAsFounderUnlimited}
                className="rounded-2xl border border-violet-300/20 bg-violet-400/10 px-5 py-4 text-sm font-black text-violet-100 hover:bg-violet-400/15"
              >
                Founder Unlimited
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <button
              type="button"
              onClick={() => {
                resetWorkZoTestingUsage();
                refresh();
              }}
              className="rounded-2xl border border-white/10 px-5 py-4 text-sm font-black text-slate-200 hover:bg-white/10"
            >
              Reset All Usage
            </button>
            <button
              type="button"
              onClick={clearCheckoutState}
              className="rounded-2xl border border-white/10 px-5 py-4 text-sm font-black text-slate-200 hover:bg-white/10"
            >
              Clear Checkout State
            </button>
            <Link
              href="/pricing?intent=interview&test=1"
              className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-5 py-4 text-center text-sm font-black text-cyan-100 hover:bg-cyan-400/15"
            >
              Pricing Flow
            </Link>
            <Link
              href="/billing/checkout?plan=premium&billing=monthly"
              className="rounded-2xl border border-blue-300/20 bg-blue-400/10 px-5 py-4 text-center text-sm font-black text-blue-100 hover:bg-blue-400/15"
            >
              Premium Checkout
            </Link>
            <Link
              href="/billing/checkout?plan=premium_pro&billing=monthly"
              className="rounded-2xl border border-violet-300/20 bg-violet-400/10 px-5 py-4 text-center text-sm font-black text-violet-100 hover:bg-violet-400/15"
            >
              Pro Checkout
            </Link>
            <Link
              href="/onboarding"
              className="rounded-2xl bg-white px-5 py-4 text-center text-sm font-black text-slate-950 hover:bg-slate-200"
            >
              Onboarding
            </Link>
            <Link
              href="/interview?test=1"
              className="rounded-2xl border border-white/10 px-5 py-4 text-center text-sm font-black text-slate-200 hover:bg-white/10"
            >
              Voice Interview
            </Link>
            <Link
              href="/results"
              className="rounded-2xl border border-white/10 px-5 py-4 text-center text-sm font-black text-slate-200 hover:bg-white/10"
            >
              Results
            </Link>
            <Link
              href="/dashboard"
              className="rounded-2xl border border-white/10 px-5 py-4 text-center text-sm font-black text-slate-200 hover:bg-white/10"
            >
              Dashboard
            </Link>
            <Link
              href="/history"
              className="rounded-2xl border border-white/10 px-5 py-4 text-center text-sm font-black text-slate-200 hover:bg-white/10"
            >
              History
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
