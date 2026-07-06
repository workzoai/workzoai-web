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
    <main className="min-h-screen bg-canvas px-5 py-10 text-fg">
      <section className="mx-auto max-w-2xl">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-brand">
          Internal · Dev Tools
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.03em]">
          Subscription plan tester
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Temporarily override the plan used for feature gating throughout
          the app (dashboard, copilot, CV tools, etc.) so you can test each
          tier's experience. This is stored in your browser only and never
          touches Stripe or the database.
        </p>

        <div className="mt-6 rounded-lg border border-line bg-fg/[0.04] p-5 text-sm">
          <p className="text-muted">
            Signed in as{" "}
            <span className="font-bold text-fg">
              {loading ? "…" : email || "not signed in"}
            </span>
          </p>
          <p className="mt-1 text-muted">
            Real plan (from database):{" "}
            <span className="font-bold text-fg">
              {loading ? "…" : realPlan || "unknown"}
            </span>
          </p>
          <p className="mt-1 text-muted">
            Active override:{" "}
            <span className="font-bold text-brand">
              {override || "none, using real plan"}
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
                className={`rounded-lg border px-5 py-4 text-left transition ${
                  active
                    ? "border-brand bg-brand/15"
                    : "border-line bg-fg/[0.03] hover:bg-fg/[0.06]"
                }`}
              >
                <p className="font-black">{meta.label}</p>
                <p className="mt-1 text-xs text-muted">
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
            className="rounded-lg border border-line px-5 py-3 text-sm font-bold text-muted hover:bg-fg/[0.06] hover:text-fg"
          >
            Clear override (use real plan)
          </button>
        </div>

        <div className="mt-8 flex gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg border border-line px-5 py-3 text-sm font-black text-muted hover:bg-fg/[0.06] hover:text-fg"
          >
            Go to dashboard
          </Link>
          <Link
            href="/founder-dashboard"
            className="inline-flex items-center justify-center rounded-lg border border-line px-5 py-3 text-sm font-black text-muted hover:bg-fg/[0.06] hover:text-fg"
          >
            Founder dashboard
          </Link>
          <Link
            href="/dev-tools/enterprise"
            className="inline-flex items-center justify-center rounded-lg border border-line px-5 py-3 text-sm font-black text-muted hover:bg-fg/[0.06] hover:text-fg"
          >
            Enterprise portal (mock)
          </Link>
          <Link
            href="/founder/analytics"
            className="inline-flex items-center justify-center rounded-lg border border-line px-5 py-3 text-sm font-black text-muted hover:bg-fg/[0.06] hover:text-fg"
          >
            Analytics
          </Link>
        </div>
      </section>

      {/* ── Page tester matrix ─────────────────────────────────────────── */}
      <section className="mx-auto mt-12 max-w-4xl">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-brand">
          Page tester
        </p>
        <h2 className="mt-3 text-2xl font-black tracking-[-0.02em]">
          Click through every page as {WORKZO_PLAN_LIMITS[effectivePlan].label}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Open any page below in the plan currently active above. Pages that
          are gated by <code className="rounded bg-fg/10 px-1">PremiumFeatureGate</code>{" "}
          show whether the active plan can access them, switch the plan
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
                className={`rounded-lg border p-4 transition hover:bg-fg/[0.06] ${
                  allowed
                    ? "border-success/25 bg-success/[0.06]"
                    : "border-warning/25 bg-warning/[0.06]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-black">{page.label}</p>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                      allowed ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                    }`}
                  >
                    {allowed ? "Unlocked" : `Needs ${WORKZO_PLAN_LIMITS[requiredPlan].label}`}
                  </span>
                </div>
                <p className="mt-1 text-xs text-subtle">{page.href}</p>
                {page.note && <p className="mt-2 text-xs leading-5 text-muted">{page.note}</p>}
              </Link>
            );
          })}
        </div>

        <div className="mt-6 rounded-lg border border-line bg-fg/[0.03] p-4 text-xs leading-5 text-muted">
          <p className="font-black text-muted">Plan matrix reference</p>
          <p className="mt-2">
            Free → Premium → Premium Pro is the upgrade order. A page&apos;s
            required plan is taken live from{" "}
            <code className="rounded bg-fg/10 px-1">getWorkZoFeatureRequiredPlan</code>, so if you
            change a feature&apos;s required plan in{" "}
            <code className="rounded bg-fg/10 px-1">workzoPlanLimits.ts</code>, this matrix updates
            automatically.
          </p>
        </div>
      </section>

    </main>
  );
}
