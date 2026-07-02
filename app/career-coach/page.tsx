"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BrainCircuit, TrendingUp, AlertTriangle, CheckCircle2, Lock } from "lucide-react";
import { buildCareerBrain, type PhaseCCareerBrain } from "@/lib/workzoCareerMemory";
import { fetchWorkZoAuthoritativePlan } from "@/lib/workzoClientPlan";
import { normalizeWorkZoPlan } from "@/lib/workzoPlanLimits";

export default function CareerCoachPage() {
  const [brain, setBrain] = useState<PhaseCCareerBrain | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkZoAuthoritativePlan()
      .then((r) => setIsPro(normalizeWorkZoPlan(r.plan) === "premium_pro"))
      .catch(() => {});
    setBrain(buildCareerBrain());
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
          <BrainCircuit className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Premium Pro</p>
          <h1 className="text-2xl font-black">AI Career Coach</h1>
        </div>
      </div>
      <p className="mb-8 text-sm leading-6 text-muted">
        Your personal coaching system built from every interview session. The more you practice, the sharper it gets.
      </p>

      {!isPro ? (
        <div className="rounded-2xl border border-brand/20 bg-brand/[0.05] p-8 text-center">
          <Lock className="mx-auto h-8 w-8 text-brand mb-3" />
          <h2 className="text-lg font-black">Unlock AI Career Coach</h2>
          <p className="mt-2 text-sm text-muted mb-5">Complete at least one interview to activate your coaching profile, then upgrade to Premium Pro to access cross-session coaching priorities.</p>
          <Link href="/pricing?plan=premium_pro" className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-black text-white hover:opacity-90">
            Upgrade to Premium Pro
          </Link>
        </div>
      ) : !brain || !brain.persistentWeaknesses?.length ? (
        <div className="rounded-2xl border border-line bg-fg/[0.03] p-8 text-center">
          <BrainCircuit className="mx-auto h-8 w-8 text-muted mb-3" />
          <h2 className="text-lg font-black">No sessions yet</h2>
          <p className="mt-2 text-sm text-muted mb-5">Complete your first interview to start building your coaching profile.</p>
          <Link href="/onboarding" className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-black text-white hover:opacity-90">
            Start Interview
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Probability engine */}
          {brain.probabilityEngine && (
            <section className="rounded-2xl border border-line bg-fg/[0.03] p-5">
              <h2 className="text-sm font-black uppercase tracking-[0.18em] text-muted mb-4">Interview probability</h2>
              <div className="space-y-3">
                {[
                  { label: "Current profile", value: brain.probabilityEngine.currentProbability, color: "bg-warning" },
                  { label: "After CV improvements", value: brain.probabilityEngine.afterCvImprovements, color: "bg-brand" },
                  { label: "After interview prep", value: brain.probabilityEngine.afterInterviewPrep, color: "bg-success" },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted">{row.label}</span>
                      <span className="font-black text-fg">{row.value}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-fg/[0.07]">
                      <div className={`h-full rounded-full ${row.color} transition-all`} style={{ width: `${row.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Persistent weaknesses */}
          <section className="rounded-2xl border border-warning/20 bg-warning/[0.05] p-5">
            <h2 className="text-sm font-black uppercase tracking-[0.18em] text-warning mb-4">Persistent patterns to fix</h2>
            <div className="space-y-3">
              {brain.persistentWeaknesses.map((w, i) => (
                <div key={i} className="rounded-xl border border-warning/15 bg-canvas-soft p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-black text-fg">{w.label}</p>
                    <span className="text-[10px] font-black text-warning">seen {w.sessionCount}x</span>
                  </div>
                  <p className="text-xs leading-5 text-muted">{w.coachingNote}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Career roadmap */}
          {brain.careerRoadmap?.priorities?.length && (
            <section className="rounded-2xl border border-line bg-fg/[0.03] p-5">
              <h2 className="text-sm font-black uppercase tracking-[0.18em] text-muted mb-4">Coaching priorities</h2>
              <div className="space-y-3">
                {brain.careerRoadmap.priorities.map((p, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand/15 text-[10px] font-black text-brand">{i + 1}</div>
                    <div>
                      <p className="text-sm font-black text-fg">{p.title}</p>
                      <p className="text-xs leading-5 text-muted">{p.action}</p>
                      {p.expectedGain && <p className="mt-0.5 text-[10px] font-black text-success">{p.expectedGain}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Cross-feature actions */}
          {brain.crossFeatureActions?.length && (
            <section className="rounded-2xl border border-line bg-fg/[0.03] p-5">
              <h2 className="text-sm font-black uppercase tracking-[0.18em] text-muted mb-4">Next actions across WorkZo</h2>
              <div className="space-y-2">
                {brain.crossFeatureActions.map((a, i) => (
                  <div key={i} className="flex items-start gap-2.5 rounded-lg bg-canvas-soft px-3 py-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-brand">{a.feature} </span>
                      <span className="text-xs text-muted">{a.action}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <p className="text-center text-xs text-muted">Updates automatically after each interview session.</p>
        </div>
      )}
    </main>
  );
}
