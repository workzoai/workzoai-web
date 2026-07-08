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
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  useEffect(() => {
    fetchWorkZoAuthoritativePlan()
      .then((r) => {
        const p = normalizeWorkZoPlan(r.plan);
        setIsPro(p === "premium_pro");
      })
      .catch(() => {});

    // Prefer a previously generated roadmap; fall back to the last interview's
    // 30-day plan so the page is never empty when data exists.
    try {
      const savedRoadmap = localStorage.getItem("workzo_career_roadmap");
      if (savedRoadmap) {
        const parsed = JSON.parse(savedRoadmap);
        if (Array.isArray(parsed) && parsed.length) {
          setPlan(parsed);
          setLoading(false);
          return;
        }
      }
    } catch { /* ignore */ }

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

  function readSetup(): Record<string, unknown> {
    for (const key of ["workzo-latest-interview-setup", "workzo-interview-setup-v4", "workzo-interview-setup-latest", "workzoInterviewSetup"]) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const p = JSON.parse(raw);
        if (p && (p.resumeProfile || p.targetRole)) return p;
      } catch { /* ignore */ }
    }
    return {};
  }

  function parsePlan(text: string): PlanItem[] {
    // 1. Preferred: a JSON array of {week, focus, action}.
    try {
      const start = text.indexOf("[");
      const end = text.lastIndexOf("]");
      if (start !== -1 && end > start) {
        const arr = JSON.parse(text.slice(start, end + 1));
        if (Array.isArray(arr)) {
          const items = arr
            .map((x) => ({ week: String(x?.week || "").trim(), focus: String(x?.focus || "").trim(), action: String(x?.action || "").trim() }))
            .filter((x) => x.focus || x.action)
            .slice(0, 12);
          if (items.length) return items;
        }
      }
    } catch { /* fall through to markdown */ }

    // 2. Fallback: parse a markdown 30/60/90 roadmap — group tasks under the
    // nearest heading (### Week / **Phase**) so any prose format still renders.
    const items: PlanItem[] = [];
    let phase = "";
    for (const rawLine of text.split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;
      const head = line.match(/^#{1,4}\s+(.*)$/) || line.match(/^\*\*(.+?)\*\*$/);
      if (head) { phase = head[1].replace(/[:*]+$/, "").trim(); continue; }
      const task = line.match(/^[-*]\s*(?:\[[ xX]?\]\s*)?(.+)$/) || line.match(/^\d+[.)]\s+(.+)$/);
      if (task) {
        const action = task[1].replace(/^\*\*|\*\*$/g, "").trim();
        if (action.length < 3) continue;
        const focus = action.length > 60 ? `${action.slice(0, 57).replace(/\s\S*$/, "")}…` : action;
        items.push({ week: phase || `Phase ${items.length + 1}`, focus, action });
        if (items.length >= 12) break;
      }
    }
    return items;
  }

  async function generatePlan() {
    setGenerating(true);
    setGenError("");
    try {
      const setup = readSetup();
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "career_plan",
          resumeProfile: setup.resumeProfile,
          targetRole: setup.targetRole,
          jobDescription: setup.jobDescription,
          message:
            "Generate my career roadmap. Return ONLY a JSON array (no prose, no markdown fences) of 6-8 milestones, each object exactly: {\"week\":\"e.g. Days 1-15\",\"focus\":\"short milestone title\",\"action\":\"1-2 sentence concrete action\"}. Order chronologically across a 90-day horizon and target my real interview gaps.",
        }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) {
        setGenError(
          data?.error === "upgrade_required"
            ? "Premium Pro is required to generate a roadmap."
            : "Could not generate the roadmap. Please try again.",
        );
        return;
      }
      const items = parsePlan(String(data.output || ""));
      if (items.length) {
        setPlan(items);
        setCompletedSteps({});
        try { localStorage.setItem("workzo_career_roadmap", JSON.stringify(items)); } catch { /* ignore */ }
      } else {
        setGenError("The roadmap came back in an unexpected format. Please try again.");
      }
    } catch {
      setGenError("Something went wrong generating your roadmap.");
    } finally {
      setGenerating(false);
    }
  }

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
        /* State 2: Member, no roadmap yet — generate one */
        <div className="rounded-2xl border border-line bg-fg/[0.01] p-10 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-fg/[0.05] text-muted mb-4">
            <Calendar className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-black tracking-tight">Build your career roadmap</h2>
          <p className="mt-2 text-sm text-muted max-w-md mx-auto mb-6 leading-relaxed">
            Generate a personalized 90-day roadmap calibrated to your CV, target role, and your real interview performance so far.
          </p>
          <button
            onClick={generatePlan}
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-black text-white hover:opacity-95 shadow-md transition-all disabled:opacity-60"
          >
            {generating ? (
              <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Generating…</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Generate my roadmap</>
            )}
          </button>
          {genError ? <p className="mt-4 text-xs text-red-500">{genError}</p> : null}
          <p className="mt-4 text-[11px] text-muted">
            Or <Link href="/onboarding" className="text-brand font-bold">run an interview</Link> first for an even sharper plan.
          </p>
        </div>
      ) : (
        /* State 3: Active Premium Pro Roadmap Layout */
        <div className="space-y-6">

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted">{plan.length} milestones · calibrated to your interview performance</p>
            <button
              onClick={generatePlan}
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-xl border border-brand/30 bg-brand/5 px-3 py-2 text-xs font-black text-brand hover:bg-brand/10 disabled:opacity-60 transition-colors"
            >
              {generating ? (
                <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand border-t-transparent" /> Regenerating…</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5" /> Regenerate</>
              )}
            </button>
          </div>
          {genError ? <p className="text-xs text-red-500">{genError}</p> : null}

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