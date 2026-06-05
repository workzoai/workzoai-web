"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Lock, Sparkles } from "lucide-react";
import { enableWorkZoFounderTestMode, resetWorkZoTestingUsage, setWorkZoCurrentPlan } from "@/lib/workzoUsageTracker";
import { WORKZO_PLAN_LIMITS } from "@/lib/workzoPlanLimits";

function continueFree() {
  if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("test") === "1") {
    enableWorkZoFounderTestMode();
    resetWorkZoTestingUsage();
  }
  setWorkZoCurrentPlan("free");

  if (typeof window !== "undefined") {
    window.localStorage.setItem("workzo_selected_plan_intent", "free_interview");
    window.location.href = "/onboarding";
  }
}

function continuePremium() {
  if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("test") === "1") {
    enableWorkZoFounderTestMode();
    resetWorkZoTestingUsage();
  }
  setWorkZoCurrentPlan("premium");

  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      "workzo_pending_checkout",
      JSON.stringify({
        plan: "premium",
        source: "pricing",
        next: "/onboarding",
        createdAt: new Date().toISOString(),
      }),
    );

    // Production flow: Premium -> Login -> Stripe Checkout -> Confirm -> Onboarding -> Interview.
    // Stripe can replace this with a real checkout route later.
    window.location.href = "/login?next=/onboarding&plan=premium";
  }
}

export default function PricingPage() {
  const intent = useMemo(() => {
    if (typeof window === "undefined") return "interview";
    return new URLSearchParams(window.location.search).get("intent") || "interview";
  }, []);

  return (
    <main className="min-h-screen bg-[#050a12] px-5 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-300 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>

          <Link href="/demo" className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-black text-slate-200 hover:bg-white/10">
            Try Demo
          </Link>
        </header>

        <section className="mt-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-100">
            <Sparkles className="h-4 w-4" />
            Choose your interview plan
          </div>

          <h1 className="mt-5 text-5xl font-black tracking-tight">
            Start free, then upgrade when you want the full WorkZo experience.
          </h1>

          <p className="mt-5 text-lg leading-8 text-slate-300">
            Free users get 2 full voice interviews with CV and job context. Premium unlocks 25 interviews/month,
            AI video recruiter interviews, full reports, interview history, and career tools.
          </p>
        </section>

        <section className="mt-10 grid gap-5 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-slate-400">Free</p>
            <p className="mt-4 text-4xl font-black">€0</p>
            <p className="mt-2 text-sm text-slate-400">Best for trying the real CV-based interview.</p>

            <ul className="mt-6 space-y-3 text-sm leading-6 text-slate-200">
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />2 full voice interviews</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />CV + job based interview</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />Results preview</li>
              <li className="flex gap-2"><Lock className="mt-0.5 h-4 w-4 text-slate-400" />Full history and premium tools locked</li>
            </ul>

            <button
              type="button"
              onClick={continueFree}
              className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-slate-950 hover:bg-slate-200"
            >
              Start Free Interview
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="rounded-[2rem] border border-blue-300/30 bg-blue-500/10 p-6 shadow-2xl">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-blue-200">Premium</p>
            <p className="mt-4 text-4xl font-black">{WORKZO_PLAN_LIMITS.premium.priceLabel}</p>
            <p className="mt-2 text-sm text-blue-100">For serious interview preparation.</p>

            <ul className="mt-6 space-y-3 text-sm leading-6 text-slate-100">
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-blue-200" />25 interviews/month</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-blue-200" />AI video recruiter interviews</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-blue-200" />Full reports, history, and progress tracking</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-blue-200" />Improve CV, cover letter, job assist</li>
            </ul>

            <button
              type="button"
              onClick={continuePremium}
              className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 px-5 text-sm font-black text-white hover:bg-blue-400"
            >
              Upgrade to Premium
              <ArrowRight className="h-4 w-4" />
            </button>

            <p className="mt-3 text-center text-xs text-blue-100/80">
              You will log in, complete payment, then continue to onboarding.
            </p>
          </div>
        </section>

        {intent === "interview" ? (
          <p className="mt-6 text-center text-sm text-slate-400">
            Not ready to choose? <Link href="/demo" className="font-black text-cyan-200">Try the voice demo first</Link>.
          </p>
        ) : null}
      </div>
    </main>
  );
}
