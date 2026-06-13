"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  WORKZO_PLAN_LIMITS,
  WORKZO_PLAN_ORDER,
  canUseWorkZoFeature,
  getWorkZoFeatureRequiredPlan,
  type WorkZoFeatureKey,
  type WorkZoPlanType,
} from "@/lib/workzoPlanLimits";
import {
  setWorkZoCurrentPlan,
  getWorkZoDevPlanOverride,
  clearWorkZoDevPlanOverride,
} from "@/lib/workzoUsageTracker";
import { fetchWorkZoAuthoritativePlan } from "@/lib/workzoClientPlan";

/**
 * Internal dev tool — protected by middleware.ts (FOUNDER_ALLOWED_EMAILS).
 *
 * Lets you override the client-side "plan" used by PremiumFeatureGate /
 * useWorkZoAuthoritativePlan, so you can click through the app as if you
 * were on Free, Premium, or Premium Pro — without needing a real Stripe
 * subscription in each state.
 *
 * This ONLY affects feature-gating on the client. It does not change your
 * real plan in the database or in Stripe.
 */

// Every page worth testing, with the feature key (if any) that gates it via
// PremiumFeatureGate. Pages without a featureKey are open to all plans, but
// may still render different content based on plan (handled inside the page).
type PageEntry = {
  href: string;
  label: string;
  featureKey?: WorkZoFeatureKey;
  note?: string;
};

const PAGES: PageEntry[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/onboarding", label: "Onboarding / CV upload" },
  { href: "/interview", label: "Interview room", note: "Voice interview is free; some recruiters/personas are Premium Pro." },
  { href: "/results", label: "Interview results", note: "Advanced report sections are Premium-gated inline (see UpgradeModal)." },
  { href: "/cv", label: "Improve CV", featureKey: "improve_cv" },
  { href: "/cover-letter", label: "Cover letter", featureKey: "cover_letter" },
  { href: "/jobs", label: "Find jobs / Job Assist", featureKey: "job_assist" },
  { href: "/copilot", label: "Work-O-Bot (full page)", featureKey: "career_brain" },
  { href: "/history", label: "Interview history", featureKey: "interview_history" },
  { href: "/account", label: "Account / billing" },
  { href: "/settings", label: "Settings" },
  { href: "/pricing", label: "Pricing" },
];

function planAllows(plan: WorkZoPlanType, page: PageEntry) {
  if (!page.featureKey) return true;
  return canUseWorkZoFeature(plan, page.featureKey);
}

export default function DevToolsPage() {
  const [override, setOverride] = useState<WorkZoPlanType | null>(null);
  const [realPlan, setRealPlan] = useState<WorkZoPlanType | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setOverride(getWorkZoDevPlanOverride());

    fetchWorkZoAuthoritativePlan()
      .then((state) => {
        setRealPlan(state.plan);
        setEmail(state.email);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function applyOverride(plan: WorkZoPlanType) {
    setWorkZoCurrentPlan(plan, true);
    setOverride(plan);
  }

  function clearOverride() {
    clearWorkZoDevPlanOverride();
    setOverride(null);
  }

  const effectivePlan: WorkZoPlanType = override || realPlan || "free";

  return (
    <main className="min-h-screen bg-[#050a12] px-5 py-10 text-white">
      <section className="mx-auto max-w-2xl">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-200">
          Internal · Dev Tools
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.03em]">
          Subscription plan tester
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Temporarily override the plan used for feature gating throughout
          the app (dashboard, copilot, CV tools, etc.) so you can test each
          tier's experience. This is stored in your browser only and never
          touches Stripe or the database.
        </p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm">
          <p className="text-slate-400">
            Signed in as{" "}
            <span className="font-bold text-white">
              {loading ? "…" : email || "not signed in"}
            </span>
          </p>
          <p className="mt-1 text-slate-400">
            Real plan (from database):{" "}
            <span className="font-bold text-white">
              {loading ? "…" : realPlan || "unknown"}
            </span>
          </p>
          <p className="mt-1 text-slate-400">
            Active override:{" "}
            <span className="font-bold text-violet-300">
              {override || "none — using real plan"}
            </span>
          </p>
        </div>

        <div className="mt-6 grid gap-3">
          {WORKZO_PLAN_ORDER.map((plan) => {
            const meta = WORKZO_PLAN_LIMITS[plan];
            const active = override === plan;
            return (
              <button
                key={plan}
                onClick={() => applyOverride(plan)}
                className={`rounded-2xl border px-5 py-4 text-left transition ${
                  active
                    ? "border-violet-400 bg-violet-500/15"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                }`}
              >
                <p className="font-black">{meta.label}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {meta.shortLabel} · {meta.interviewsPerMonth >= 999999
                    ? "Unlimited"
                    : meta.interviewsPerMonth}{" "}
                  interviews / month
                </p>
              </button>
            );
          })}

          <button
            onClick={clearOverride}
            className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-slate-300 hover:bg-white/[0.06] hover:text-white"
          >
            Clear override (use real plan)
          </button>
        </div>

        <div className="mt-8 flex gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-2xl border border-white/10 px-5 py-3 text-sm font-black text-slate-300 hover:bg-white/[0.06] hover:text-white"
          >
            Go to dashboard
          </Link>
          <Link
            href="/founder-dashboard"
            className="inline-flex items-center justify-center rounded-2xl border border-white/10 px-5 py-3 text-sm font-black text-slate-300 hover:bg-white/[0.06] hover:text-white"
          >
            Founder dashboard
          </Link>
          <Link
            href="/founder/analytics"
            className="inline-flex items-center justify-center rounded-2xl border border-white/10 px-5 py-3 text-sm font-black text-slate-300 hover:bg-white/[0.06] hover:text-white"
          >
            Analytics
          </Link>
        </div>
      </section>

      {/* ── Page tester matrix ─────────────────────────────────────────── */}
      <section className="mx-auto mt-12 max-w-4xl">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
          Page tester
        </p>
        <h2 className="mt-3 text-2xl font-black tracking-[-0.02em]">
          Click through every page as {WORKZO_PLAN_LIMITS[effectivePlan].label}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Open any page below in the plan currently active above. Pages that
          are gated by <code className="rounded bg-white/10 px-1">PremiumFeatureGate</code>{" "}
          show whether the active plan can access them — switch the plan
          above and reload a page to see the locked vs. unlocked state.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {PAGES.map((page) => {
            const allowed = planAllows(effectivePlan, page);
            const requiredPlan = page.featureKey ? getWorkZoFeatureRequiredPlan(page.featureKey) : "free";

            return (
              <Link
                key={page.href}
                href={page.href}
                target="_blank"
                className={`rounded-2xl border p-4 transition hover:bg-white/[0.06] ${
                  allowed
                    ? "border-emerald-400/25 bg-emerald-400/[0.06]"
                    : "border-amber-400/25 bg-amber-400/[0.06]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-black">{page.label}</p>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                      allowed ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/15 text-amber-200"
                    }`}
                  >
                    {allowed ? "Unlocked" : `Needs ${WORKZO_PLAN_LIMITS[requiredPlan].label}`}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{page.href}</p>
                {page.note && <p className="mt-2 text-xs leading-5 text-slate-400">{page.note}</p>}
              </Link>
            );
          })}
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-5 text-slate-400">
          <p className="font-black text-slate-300">Plan matrix reference</p>
          <p className="mt-2">
            Free → Premium → Premium Pro is the upgrade order. A page&apos;s
            required plan is taken live from{" "}
            <code className="rounded bg-white/10 px-1">getWorkZoFeatureRequiredPlan</code>, so if you
            change a feature&apos;s required plan in{" "}
            <code className="rounded bg-white/10 px-1">workzoPlanLimits.ts</code>, this matrix updates
            automatically.
          </p>
        </div>
      </section>
    </main>
  );
}
