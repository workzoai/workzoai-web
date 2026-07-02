"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, TrendingUp, Lock, Sparkles } from "lucide-react";
import { fetchWorkZoAuthoritativePlan } from "@/lib/workzoClientPlan";
import { normalizeWorkZoPlan } from "@/lib/workzoPlanLimits";
import { buildCareerBrain } from "@/lib/workzoCareerMemory";

export default function CareerPlanPage() {
  const [isPro, setIsPro] = useState(false);
  const [plan, setPlan] = useState<{ week: string; focus: string; action: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkZoAuthoritativePlan()
      .then((r) => {
        const p = normalizeWorkZoPlan(r.plan);
        setIsPro(p === "premium_pro");
      })
      .catch(() => {});

    // Read 30-day plan from the latest stored result
    try {
      const RESULT_KEYS = [
        "workzo_latest_interview_result", "workzo_latest_result",
        "workzo-interview-result", "latestInterviewResult",
      ];
      for (const key of RESULT_KEYS) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const result = JSON.parse(raw);
        if (result?.thirtyDayPlan?.length) {
          setPlan(result.thirtyDayPlan);
          break;
        }
      }
    } catch { /* ignore */ }

    setLoading(false);
  }, []);

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
    </div>
  );

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg mb-8">
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand/15 text-brand">
          <TrendingUp className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Premium Pro</p>
          <h1 className="text-2xl font-black">Career Roadmap</h1>
        </div>
      </div>
      <p className="mb-8 text-sm leading-6 text-muted">
        A week-by-week improvement plan built from what actually happened in your last interview session.
      </p>

      {!isPro ? (
        <div className="rounded-2xl border border-brand/20 bg-brand/[0.05] p-8 text-center">
          <Lock className="mx-auto h-8 w-8 text-brand mb-3" />
          <h2 className="text-lg font-black">Unlock Career Roadmaps</h2>
          <p className="mt-2 text-sm text-muted mb-5">Get a personalised 30-day improvement plan after every interview, targeting the exact gaps the recruiter found.</p>
          <Link href="/pricing?plan=premium_pro" className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-black text-white hover:opacity-90">
            Upgrade to Premium Pro
          </Link>
        </div>
      ) : !plan.length ? (
        <div className="rounded-2xl border border-line bg-fg/[0.03] p-8 text-center">
          <TrendingUp className="mx-auto h-8 w-8 text-muted mb-3" />
          <h2 className="text-lg font-black">No plan yet</h2>
          <p className="mt-2 text-sm text-muted mb-5">Complete an interview to generate your first personalised roadmap.</p>
          <Link href="/onboarding" className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-black text-white hover:opacity-90">
            Start Interview
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {plan.map((item, i) => (
            <div key={i} className="rounded-2xl border border-line bg-fg/[0.03] p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand/15 text-xs font-black text-brand">
                  {i + 1}
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">{item.week}</p>
                  <p className="text-base font-black text-fg">{item.focus}</p>
                </div>
              </div>
              <p className="text-sm leading-6 text-muted pl-11">{item.action}</p>
            </div>
          ))}
          <div className="rounded-xl border border-brand/15 bg-brand/[0.05] px-4 py-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand shrink-0" />
            <p className="text-xs text-muted">This plan updates after every interview session based on what the recruiter found.</p>
          </div>
          <div className="pt-2 text-center">
            <Link href="/results" className="text-sm font-black text-brand hover:opacity-80">
              View full interview report →
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
