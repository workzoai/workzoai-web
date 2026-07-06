"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  BrainCircuit, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Lock, 
  ChevronRight, 
  PlayCircle, 
  Sparkles, 
  Send 
} from "lucide-react";
import { buildCareerBrain, type PhaseCCareerBrain } from "@/lib/workzoCareerMemory";
import { fetchWorkZoAuthoritativePlan } from "@/lib/workzoClientPlan";
import { normalizeWorkZoPlan } from "@/lib/workzoPlanLimits";
import { readLatestInterviewSetup } from "@/lib/workzoInterviewSetup";

type CoachTurn = { role: "user" | "assistant"; content: string };

export default function CareerCoachPage() {
  const [brain, setBrain] = useState<PhaseCCareerBrain | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeWeakness, setActiveWeakness] = useState<number | null>(null);
  const [coachQuery, setCoachQuery] = useState("");
  const [coachTurns, setCoachTurns] = useState<CoachTurn[]>([]);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState("");

  async function askCoach() {
    const prompt = coachQuery.trim();
    if (!prompt || coachLoading) return;

    const history = [...coachTurns, { role: "user" as const, content: prompt }];
    setCoachTurns(history);
    setCoachQuery("");
    setCoachError("");
    setCoachLoading(true);

    try {
      const setup = (readLatestInterviewSetup() || {}) as Record<string, unknown>;
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "career",
          action: "career_chat",
          message: prompt,
          cvText: (setup.cvText as string) || "",
          jobDescription: (setup.jobDescription as string) || "",
          targetRole: (setup.targetRole as string) || (setup.role as string) || "",
          targetMarket: (setup.targetMarket as string) || "Global",
          history: history.slice(-9, -1).map((t) => ({ role: t.role, content: t.content })),
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        success?: boolean;
        output?: string;
        error?: string;
        requiredPlan?: string;
      } | null;

      if (!response.ok || !data?.success) {
        if (data?.error === "upgrade_required" || data?.error === "upgrade_required_rate_limit") {
          setCoachTurns((cur) => [
            ...cur,
            {
              role: "assistant",
              content:
                "Deep Memory Consult is part of Premium Pro. Upgrade to unlock your AI career coach, roadmaps, and replay intelligence.",
            },
          ]);
          return;
        }
        throw new Error("The coach couldn't respond just now. Please try again.");
      }

      setCoachTurns((cur) => [
        ...cur,
        { role: "assistant", content: data.output || "No response was generated." },
      ]);
    } catch (err) {
      setCoachError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setCoachLoading(false);
    }
  }

  useEffect(() => {
    fetchWorkZoAuthoritativePlan()
      .then((r) => setIsPro(normalizeWorkZoPlan(r.plan) === "premium_pro"))
      .catch(() => {});
    setBrain(buildCareerBrain());
    setLoading(false);
  }, []);

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
            <BrainCircuit className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand bg-brand/10 px-2 py-0.5 rounded-md">Premium Pro Tier</p>
            </div>
            <h1 className="text-2xl font-black tracking-tight mt-0.5">AI Career Coach</h1>
          </div>
        </div>
        <p className="hidden sm:block text-xs text-muted text-right max-w-[220px] leading-5">
          Synchronized intelligence updating automatically after every simulation.
        </p>
      </div>

      {/* State 1: Strict Paywall Check */}
      {!isPro ? (
        <div className="rounded-2xl border border-brand/20 bg-gradient-to-b from-brand/[0.04] to-transparent p-10 text-center shadow-sm">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand/10 text-brand mb-4">
            <Lock className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-black tracking-tight">Unlock Your Multi-Session Intelligence</h2>
          <p className="mt-2 text-sm text-muted max-w-md mx-auto mb-6 leading-relaxed">
            Standard accounts only see single-session reports. Premium Pro synthesizes historical data across every interview to trace hidden behavioral risks, trends, and execution roadmaps.
          </p>
          <Link href="/pricing?plan=premium_pro" className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-black text-white hover:opacity-95 shadow-lg shadow-brand/20 transition-all transform hover:-translate-y-0.5">
            Upgrade to Premium Pro
          </Link>
        </div>
      ) : !brain || !brain.persistentWeaknesses?.length ? (
        /* State 2: Member but Empty State */
        <div className="rounded-2xl border border-line bg-fg/[0.01] p-10 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-fg/[0.05] text-muted mb-4">
            <BrainCircuit className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-black tracking-tight">Your Career Brain is Cold</h2>
          <p className="mt-2 text-sm text-muted max-w-md mx-auto mb-6 leading-relaxed">
            Your profile metrics are currently blank. Complete your first high-stakes simulation setup to populate the cross-feature diagnostic layer.
          </p>
          <Link href="/onboarding" className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-black text-white hover:opacity-95 shadow-md transition-all">
            Start First Simulation
          </Link>
        </div>
      ) : (
        /* State 3: Fully Hydrated Premium Pro State */
        <div className="space-y-6">
          
          {/* Grid Layout: Probability & Cross-Feature Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            
            {/* Probability Engine (3/5 Columns) */}
            {brain.probability && (
              <section className="md:col-span-3 rounded-2xl border border-line bg-fg/[0.01] p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-4 w-4 text-brand" />
                  <h2 className="text-xs font-black uppercase tracking-[0.18em] text-muted">Interview Probability Engine</h2>
                </div>
                <div className="space-y-4">
                  {[
                    { label: "Current Profile Baseline", value: brain.probability.current, color: "bg-warning", desc: "Based on unquantified outcomes" },
                    { label: "After Targeted CV Adjustments", value: brain.probability.afterCv, color: "bg-brand", desc: "Fixes missing structural anchors" },
                    { label: "After Complete Simulation Prep", value: brain.probability.afterPrep, color: "bg-success", desc: "Achieved via strict STAR alignment" },
                  ].map((row) => (
                    <div key={row.label} className="group">
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-xs font-medium text-fg group-hover:text-brand transition-colors">{row.label}</span>
                        <span className="text-sm font-black text-fg">{row.value}%</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-fg/[0.05] p-[2px]">
                        <div className={`h-full rounded-full ${row.color} transition-all duration-700 ease-out`} style={{ width: `${row.value}%` }} />
                      </div>
                      <p className="text-[10px] text-muted mt-0.5 tracking-wide">{row.desc}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Cross-Feature Interlocks (2/5 Columns) */}
            {brain.crossFeatureActions?.length && (
              <section className="md:col-span-2 rounded-2xl border border-line bg-fg/[0.01] p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-4 w-4 text-brand" />
                    <h2 className="text-xs font-black uppercase tracking-[0.18em] text-muted">Cross-App Optimization</h2>
                  </div>
                  <div className="space-y-2">
                    {brain.crossFeatureActions.slice(0, 3).map((a, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded-xl bg-canvas border border-line/40 hover:border-brand/30 transition-colors">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                        <div className="min-w-0">
                          <p className="text-[9px] font-black uppercase tracking-wider text-brand">{a.feature}</p>
                          <p className="text-[11px] leading-4 text-muted truncate">{a.action}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* Interactive Persistent Weaknesses Container */}
          <section className="rounded-2xl border border-warning/20 bg-warning/[0.02] p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <h2 className="text-xs font-black uppercase tracking-[0.18em] text-warning">Persistent Behavioral Flaws Detected</h2>
            </div>
            
            <div className="space-y-3">
              {brain.persistentWeaknesses.map((w, i) => {
                const isOpen = activeWeakness === i;
                return (
                  <div key={i} className={`rounded-xl border transition-all ${isOpen ? 'border-warning/40 bg-canvas-soft shadow-sm' : 'border-line/60 bg-canvas/40 hover:border-warning/30'}`}>
                    <button 
                      onClick={() => setActiveWeakness(isOpen ? null : i)}
                      className="w-full flex items-center justify-between p-4 text-left focus:outline-none"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`h-2 w-2 rounded-full ${w.count >= 4 ? 'bg-danger animate-pulse' : 'bg-warning'}`} />
                        <p className="text-sm font-black text-fg truncate pr-2">{w.label}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[10px] font-mono font-black uppercase bg-warning/10 text-warning px-2 py-0.5 rounded-md">seen {w.count}x</span>
                        <ChevronRight className={`h-4 w-4 text-muted transition-transform duration-200 ${isOpen ? 'rotate-90 text-warning' : ''}`} />
                      </div>
                    </button>
                    
                    {isOpen && (
                      <div className="px-4 pb-4 pt-1 border-t border-line/40 bg-fg/[0.01] rounded-b-xl space-y-3">
                        <p className="text-xs leading-5 text-muted">{w.coachLine}</p>
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-[10px] text-muted-soft italic">Context locked via multi-session memory path</span>
                          <button className="inline-flex items-center gap-1.5 rounded-lg bg-warning/10 text-warning hover:bg-warning/20 px-3 py-1.5 text-xs font-black transition-colors">
                            <PlayCircle className="h-3.5 w-3.5" /> Launch Focused Audio Drill
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Chronological System Priorities */}
          {brain.roadmap?.length ? (
            <section className="rounded-2xl border border-line bg-fg/[0.01] p-5 shadow-sm">
              <h2 className="text-xs font-black uppercase tracking-[0.18em] text-muted mb-4">Strategic Execution Roadmap</h2>
              <div className="space-y-4 relative before:absolute before:inset-y-1 before:left-[11px] before:w-[1px] before:bg-line">
                {brain.roadmap.map((p, i) => (
                  <div key={p.id || i} className="flex gap-4 relative group">
                    <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-[10px] font-black text-white shadow-sm group-hover:scale-105 transition-transform z-10">
                      {i + 1}
                    </div>
                    <div className="bg-canvas/50 border border-line/40 rounded-xl p-3.5 w-full">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                        <p className="text-sm font-black text-fg">{p.title}</p>
                        {p.estimatedGain && (
                          <span className="text-[10px] font-black text-success bg-success/10 px-2 py-0.5 rounded-md self-start sm:self-auto">
                            {p.estimatedGain}
                          </span>
                        )}
                      </div>
                      <p className="text-xs leading-5 text-muted">{p.action}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* Interactive AI Playground (The Interactive Pivot) */}
          <section className="rounded-2xl border border-brand/20 bg-gradient-to-r from-brand/[0.02] to-transparent p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <BrainCircuit className="h-4 w-4 text-brand" />
              <h2 className="text-xs font-black uppercase tracking-[0.18em] text-brand">Deep Memory Consult (Beta)</h2>
            </div>
            <p className="text-xs text-muted leading-5 mb-4">
              Query your compiled historical profile directly. Ask your coach for contextual strategy trends or role adjustments.
            </p>

            {(coachTurns.length > 0 || coachLoading) && (
              <div className="mb-4 space-y-3">
                {coachTurns.map((turn, i) => (
                  <div
                    key={i}
                    className={
                      turn.role === "user"
                        ? "ml-8 rounded-xl rounded-tr-sm border border-line bg-brand/[0.06] px-3.5 py-2.5"
                        : "mr-8 rounded-xl rounded-tl-sm border border-line bg-canvas px-3.5 py-2.5"
                    }
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted">
                      {turn.role === "user" ? "You" : "Coach"}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-xs leading-6 text-fg">{turn.content}</p>
                  </div>
                ))}
                {coachLoading && (
                  <div className="mr-8 flex items-center gap-2 rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-xs text-muted">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                    Consulting your history…
                  </div>
                )}
              </div>
            )}

            {coachError && <p className="mb-3 text-xs font-bold text-danger">{coachError}</p>}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void askCoach();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={coachQuery}
                onChange={(e) => setCoachQuery(e.target.value)}
                disabled={coachLoading}
                placeholder="e.g., 'How should I fix my structural metrics before my next mock?'"
                className="w-full rounded-xl border border-line bg-canvas px-3.5 py-2 text-xs text-fg placeholder:text-muted/60 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={coachLoading || !coachQuery.trim()}
                aria-label="Send message to coach"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </section>

          <p className="text-center text-[11px] text-muted/60 tracking-wide mt-8">
            Adaptive synchronization processing complete. Analytics update on next session termination.
          </p>
        </div>
      )}
    </main>
  );
}