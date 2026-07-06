"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  TrendingUp, 
  Lock, 
  Sparkles, 
  Calendar, 
  CheckCircle2, 
  Circle, 
  ChevronRight, 
  FileText 
} from "lucide-react";
import { fetchWorkZoAuthoritativePlan } from "@/lib/workzoClientPlan";
import { normalizeWorkZoPlan } from "@/lib/workzoPlanLimits";

interface PlanItem {
  week: string;
  focus: string;
  action: string;
}

export default function CareerPlanPage() {
  const [isPro, setIsPro] = useState(false);
  const [plan, setPlan] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});

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
        "workzo_latest_interview_result", 
        "workzo_latest_result",
        "workzo-interview-result", 
        "latestInterviewResult",
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

  const toggleStep = (index: number) => {
    setCompletedSteps(prev => ({ ...prev, [index]: !prev[index] }));
  };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
    </div>
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 text-fg">
      {/* Navigation */}
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg mb-8 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Link>

      {/* Hero Header */}
      <div className="flex items-center justify-between border-b border-line pb-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand shadow-sm">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand bg-brand/10 px-2 py-0.5 rounded-md">Premium Pro Tier</p>
            </div>
            <h1 className="text-2xl font-black tracking-tight mt-0.5">Career Roadmap</h1>
          </div>
        </div>
        <p className="hidden sm:block text-xs text-muted text-right max-w-[240px] leading-5">
          A granular milestone pipeline targeting the exact gaps recruiters surface during simulations.
        </p>
      </div>

      {/* State 1: Strict Paywall Check */}
      {!isPro ? (
        <div className="rounded-2xl border border-brand/20 bg-gradient-to-b from-brand/[0.04] to-transparent p-10 text-center shadow-sm">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand/10 text-brand mb-4">
            <Lock className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-black tracking-tight">Unlock Your Tactical Milestones</h2>
          <p className="mt-2 text-sm text-muted max-w-md mx-auto mb-6 leading-relaxed">
            Stop guessing what to build or fix next. Premium Pro dynamically maps out a structured 30-day architectural timeline directly calibrated to your historical pipeline failures.
          </p>
          <Link href="/pricing?plan=premium_pro" className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-black text-white hover:opacity-95 shadow-lg shadow-brand/20 transition-all transform hover:-translate-y-0.5">
            Upgrade to Premium Pro
          </Link>
        </div>
      ) : !plan.length ? (
        /* State 2: Member but Empty State */
        <div className="rounded-2xl border border-line bg-fg/[0.01] p-10 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-fg/[0.05] text-muted mb-4">
            <Calendar className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-black tracking-tight">Timeline Engine Dormant</h2>
          <p className="mt-2 text-sm text-muted max-w-md mx-auto mb-6 leading-relaxed">
            We haven't parsed an active roadmap data block yet. Run an operational simulation pass to auto-build your first chronological sprint.
          </p>
          <Link href="/onboarding" className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-black text-white hover:opacity-95 shadow-md transition-all">
            Initiate Interview
          </Link>
        </div>
      ) : (
        /* State 3: Active Premium Pro Roadmap Layout */
        <div className="space-y-6">
          
          {/* Interactive Sprint Timeline Tracker */}
          <div className="relative space-y-4 before:absolute before:inset-y-2 before:left-[19px] before:w-[2px] before:bg-gradient-to-b before:from-brand/40 before:to-line">
            {plan.map((item, i) => {
              const isDone = !!completedSteps[i];
              return (
                <div 
                  key={i} 
                  className={`flex gap-4 relative group transition-all duration-200 ${
                    isDone ? "opacity-60 scale-[0.99]" : ""
                  }`}
                >
                  {/* Action Marker/Checkbox Hook */}
                  <button 
                    onClick={() => toggleStep(i)}
                    className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-canvas border border-line hover:border-brand text-muted hover:text-brand shadow-sm transition-all focus:outline-none"
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-5 w-5 text-brand" />
                    ) : (
                      <span className="text-xs font-mono font-black">{i + 1}</span>
                    )}
                  </button>

                  {/* Operational Detail Block */}
                  <div className={`w-full bg-canvas/40 border rounded-2xl p-5 transition-colors ${
                    isDone ? "border-line/40 bg-fg/[0.01]" : "border-line hover:border-brand/20 shadow-sm"
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                      <div>
                        <p className="text-[10px] font-mono font-black uppercase tracking-[0.15em] text-brand/80">
                          {item.week || `Sprint Phase 0${i + 1}`}
                        </p>
                        <h3 className={`text-base font-black tracking-tight mt-0.5 ${isDone ? "line-through text-muted" : "text-fg"}`}>
                          {item.focus}
                        </h3>
                      </div>
                      <span className="text-[10px] font-black uppercase bg-fg/[0.04] text-muted px-2 py-0.5 rounded-md self-start sm:self-auto">
                        Target Action
                      </span>
                    </div>
                    
                    <p className="text-xs sm:text-sm leading-6 text-muted pl-0">
                      {item.action}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Persistent Dynamic Warning Footer */}
          <div className="rounded-2xl border border-brand/10 bg-brand/[0.02] p-4 flex items-start gap-3 mt-8">
            <Sparkles className="h-4 w-4 text-brand shrink-0 mt-0.5 animate-pulse" />
            <div>
              <p className="text-xs font-bold text-fg">Continuous Synchronization Active</p>
              <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                This sprint schedule tracks live iterations. Running an upgraded audio or video simulation automatically overrides completed milestones to re-index urgent tactical bottlenecks.
              </p>
            </div>
          </div>

          {/* Deep link pass back to analysis engine */}
          <div className="pt-4 flex justify-center">
            <Link 
              href="/results" 
              className="inline-flex items-center gap-2 text-xs font-black text-brand tracking-wider uppercase hover:gap-3 transition-all"
            >
              <FileText className="h-3.5 w-3.5" /> Analyze Core Evaluation Reports <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}