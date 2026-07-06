"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, PlayCircle, Lock, TrendingDown, TrendingUp, Lightbulb } from "lucide-react";
import { fetchWorkZoAuthoritativePlan } from "@/lib/workzoClientPlan";
import { normalizeWorkZoPlan } from "@/lib/workzoPlanLimits";

type ReplayData = {
  strongestAnswer?: { question: string; why: string; score: number };
  weakestAnswer?: { question: string; what: string; trustDrop: number };
  missedOpportunities?: string[];
  starCoaching?: { question: string; whatYouSaid: string; missingComponent: string; coachingTip: string; howToAnswer: string }[];
  recruiterSummary?: string;
  overallScore?: number;
  recruiterName?: string;
  targetRole?: string;
};

export default function ReplayPage() {
  const [isPro, setIsPro] = useState(false);
  const [data, setData] = useState<ReplayData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkZoAuthoritativePlan()
      .then((r) => setIsPro(normalizeWorkZoPlan(r.plan) === "premium_pro"))
      .catch(() => {});

    try {
      const RESULT_KEYS = [
        "workzo_latest_interview_result", "workzo_latest_result",
        "workzo-interview-result", "latestInterviewResult",
      ];
      for (const key of RESULT_KEYS) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const result = JSON.parse(raw);
        if (result?.recruiterName || result?.starCoaching || result?.missedOpportunities) {
          setData({
            recruiterName: result.recruiterName,
            targetRole: result.targetRole,
            overallScore: result.overallScore,
            recruiterSummary: result.recruiterSummary,
            strongestAnswer: result.committeeEvidence?.sort((a: any, b: any) => b.score - a.score)[0]
              ? { question: result.committeeEvidence[0].question, why: result.committeeEvidence[0].recruiterHeard, score: result.committeeEvidence[0].score }
              : undefined,
            weakestAnswer: result.committeeEvidence?.sort((a: any, b: any) => a.score - b.score)[0]
              ? { question: result.committeeEvidence[0].question, what: result.committeeEvidence[0].weakness, trustDrop: result.committeeEvidence[0].score }
              : undefined,
            missedOpportunities: result.missedOpportunities,
            starCoaching: result.starCoaching,
          });
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
          <PlayCircle className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Premium Pro</p>
          <h1 className="text-2xl font-black">Replay Intelligence</h1>
        </div>
      </div>
      <p className="mb-8 text-sm leading-6 text-muted">
        The moments that defined your last interview, where trust was built and where it dropped.
      </p>

      {!isPro ? (
        <div className="rounded-2xl border border-brand/20 bg-brand/[0.05] p-8 text-center">
          <Lock className="mx-auto h-8 w-8 text-brand mb-3" />
          <h2 className="text-lg font-black">Unlock Replay Intelligence</h2>
          <p className="mt-2 text-sm text-muted mb-5">See every moment trust moved up or down, your strongest and weakest answers, and the missed opportunities from each session.</p>
          <Link href="/pricing?plan=premium_pro" className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-black text-white hover:opacity-90">
            Upgrade to Premium Pro
          </Link>
        </div>
      ) : !data ? (
        <div className="rounded-2xl border border-line bg-fg/[0.03] p-8 text-center">
          <PlayCircle className="mx-auto h-8 w-8 text-muted mb-3" />
          <h2 className="text-lg font-black">No session yet</h2>
          <p className="mt-2 text-sm text-muted mb-5">Complete an interview to see your replay intelligence.</p>
          <Link href="/onboarding" className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-black text-white hover:opacity-90">
            Start Interview
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Session header */}
          {data.recruiterName && (
            <div className="flex items-center justify-between rounded-xl border border-line bg-fg/[0.03] px-4 py-3">
              <div>
                <p className="text-xs text-muted">Last session with {data.recruiterName}</p>
                <p className="text-sm font-black">{data.targetRole || "Interview practice"}</p>
              </div>
              {data.overallScore && (
                <div className="grid h-12 w-12 place-items-center rounded-full border-2 border-brand text-lg font-black text-fg">
                  {data.overallScore}
                </div>
              )}
            </div>
          )}

          {/* Recruiter summary */}
          {data.recruiterSummary && (
            <section className="rounded-2xl border border-line bg-fg/[0.03] p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted mb-2">What the recruiter thought</p>
              <p className="text-sm leading-6 text-fg italic">"{data.recruiterSummary}"</p>
            </section>
          )}

          {/* Best and worst side by side */}
          <div className="grid gap-4 sm:grid-cols-2">
            {data.strongestAnswer && (
              <section className="rounded-2xl border border-success/20 bg-success/[0.05] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-success" />
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-success">Strongest moment</p>
                </div>
                <p className="text-xs font-black text-fg mb-1 line-clamp-2">{data.strongestAnswer.question}</p>
                <p className="text-xs leading-5 text-muted">{data.strongestAnswer.why}</p>
              </section>
            )}
            {data.weakestAnswer && (
              <section className="rounded-2xl border border-danger/20 bg-danger/[0.05] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="h-4 w-4 text-danger" />
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-danger">Where trust dropped</p>
                </div>
                <p className="text-xs font-black text-fg mb-1 line-clamp-2">{data.weakestAnswer.question}</p>
                <p className="text-xs leading-5 text-muted">{data.weakestAnswer.what}</p>
              </section>
            )}
          </div>

          {/* Missed opportunities */}
          {data.missedOpportunities?.length ? (
            <section className="rounded-2xl border border-line bg-fg/[0.03] p-5">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="h-4 w-4 text-brand" />
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted">Missed opportunities</p>
              </div>
              <div className="space-y-2">
                {data.missedOpportunities.map((item, i) => (
                  <p key={i} className="rounded-lg bg-canvas-soft px-3 py-2 text-xs leading-5 text-fg">{item}</p>
                ))}
              </div>
            </section>
          ) : null}

          {/* STAR coaching */}
          {data.starCoaching?.length ? (
            <section className="rounded-2xl border border-line bg-fg/[0.03] p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted mb-3">Answer coaching</p>
              <div className="space-y-3">
                {data.starCoaching.map((item, i) => (
                  <div key={i} className="rounded-xl border border-line bg-canvas-soft p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted mb-1.5 line-clamp-1">{item.question}</p>
                    <p className="text-xs italic text-muted mb-2">"{item.whatYouSaid}"</p>
                    <p className="text-xs font-black text-danger">{item.missingComponent}</p>
                    <p className="mt-1 text-xs leading-5 text-fg">{item.coachingTip}</p>
                    {item.howToAnswer && (
                      <div className="mt-2 rounded-lg border border-brand/15 bg-brand/[0.05] px-3 py-2">
                        <p className="text-[10px] font-black text-brand mb-1">How to answer this</p>
                        <p className="text-xs leading-5 text-fg">{item.howToAnswer}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

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
