"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";import {
  ArrowLeft,
  Brain,
  CheckCircle2,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";

type TrustTimelineEvent = {
  time?: string;
  direction?: "up" | "down" | "stable";
  value?: number;
  reason?: string;
};

type PsychologyReport = {
  finalDecision?: "continue" | "borderline" | "reject";
  finalPerception?: string;
  trustTimeline?: TrustTimelineEvent[];
  strongestSignal?: string;
  weakestPattern?: string;
  recoveryMoment?: string;
  biggestTrustDrop?: string;
  nextPracticeAction?: string;
};

type ResultsPayload = {
  overallScore?: number;
  recruiterTrust?: number;
  pressure?: number;
  feedback?: string;
  postInterviewPsychologyReport?: PsychologyReport;
  trustTimeline?: TrustTimelineEvent[];
  wowMoment?: {
    shouldTrigger?: boolean;
    line?: string;
    emotionalTag?: string;
  };
  memory?: {
    strengths?: string[];
    weaknesses?: string[];
    improvements?: string[];
    repeatedPatterns?: string[];
  };
  recruiter?: {
    name?: string;
    role?: string;
  };
  setup?: {
    targetRole?: string;
    targetMarket?: string;
    country?: string;
  };
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function decisionStyle(decision?: string) {
  if (decision === "continue") {
    return "border-emerald-300/20 bg-emerald-500/12 text-emerald-100";
  }

  if (decision === "reject") {
    return "border-rose-300/20 bg-rose-500/12 text-rose-100";
  }

  return "border-amber-300/20 bg-amber-500/12 text-amber-100";
}

export default function ResultsPage() {
  const [result, setResult] = useState<ResultsPayload | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("workzo-last-results");
      if (saved) setResult(JSON.parse(saved) as ResultsPayload);
    } catch {
      setResult(null);
    }
  }, []);

  const report = result?.postInterviewPsychologyReport;
  const timeline = useMemo(
    () => report?.trustTimeline || result?.trustTimeline || [],
    [report?.trustTimeline, result?.trustTimeline]
  );

  const decision = report?.finalDecision || "borderline";
  const recruiterName = result?.recruiter?.name || "Recruiter";
  const recruiterRole = result?.recruiter?.role || "AI Recruiter";

  return (
    <main className="min-h-screen bg-[#020712] px-5 py-5 text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-220px] top-[-180px] h-[520px] w-[520px] rounded-full bg-blue-600/16 blur-[120px]" />
        <div className="absolute right-[-180px] top-[-160px] h-[560px] w-[560px] rounded-full bg-cyan-400/12 blur-[130px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1280px]">
        <header className="flex items-center justify-between rounded-3xl border border-white/10 bg-white/[0.045] px-5 py-4 shadow-[0_20px_90px_rgba(0,0,0,0.32)] backdrop-blur-2xl">
          <Link href="/interview" className="inline-flex items-center gap-2 text-sm font-black text-slate-200">
            <ArrowLeft className="h-4 w-4" />
            Back to interview
          </Link>

          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-black text-white transition hover:bg-white/10"
          >
            <RotateCcw className="h-4 w-4" />
            New interview
          </Link>
        </header>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_390px]">
          <div className="rounded-[32px] border border-white/10 bg-white/[0.045] p-7 shadow-[0_34px_120px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
            <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-cyan-100">
              Psychological interview report
            </div>

            <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight md:text-5xl">
              {report?.finalPerception || "Your recruiter perception report is ready."}
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">
              This report focuses on what changed the recruiter's trust: proof, ownership,
              consistency, pressure response, and recovery.
            </p>

            <div className="mt-7 grid gap-4 md:grid-cols-3">
              <MetricCard
                title="Recruiter decision"
                value={decision === "continue" ? "Continue" : decision === "reject" ? "Reject" : "Borderline"}
                className={decisionStyle(decision)}
              />
              <MetricCard
                title="Recruiter trust"
                value={`${result?.recruiterTrust ?? 46}/100`}
                className="border-blue-300/20 bg-blue-500/12 text-blue-100"
              />
              <MetricCard
                title="Overall signal"
                value={result?.overallScore ? `${result.overallScore}%` : "Calibrating"}
                className="border-cyan-300/20 bg-cyan-500/12 text-cyan-100"
              />
            </div>

            <div className="mt-7 grid gap-4 md:grid-cols-2">
              <InsightCard
                icon={<CheckCircle2 className="h-5 w-5" />}
                title="Strongest signal"
                text={report?.strongestSignal || result?.memory?.strengths?.[0] || "No strong signal captured yet."}
                tone="emerald"
              />
              <InsightCard
                icon={<ShieldAlert className="h-5 w-5" />}
                title="Weakest pattern"
                text={report?.weakestPattern || result?.memory?.weaknesses?.[0] || "No repeated weak pattern captured yet."}
                tone="rose"
              />
              <InsightCard
                icon={<TrendingUp className="h-5 w-5" />}
                title="Recovery moment"
                text={report?.recoveryMoment || "No clear recovery moment yet."}
                tone="blue"
              />
              <InsightCard
                icon={<TrendingDown className="h-5 w-5" />}
                title="Biggest trust drop"
                text={report?.biggestTrustDrop || "No major trust drop yet."}
                tone="amber"
              />
            </div>

            {result?.wowMoment?.shouldTrigger && (
              <div className="mt-7 rounded-3xl border border-rose-300/20 bg-rose-500/12 p-5">
                <div className="flex items-center gap-2 text-sm font-black text-rose-100">
                  <Zap className="h-5 w-5" />
                  Wow moment
                </div>
                <p className="mt-3 text-lg font-bold leading-8 text-white">
                  {result.wowMoment.line}
                </p>
              </div>
            )}
          </div>

          <aside className="rounded-[32px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_34px_120px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/16 text-blue-100">
                <Brain className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-black">Trust timeline</h2>
                <p className="text-sm text-slate-400">{recruiterName} · {recruiterRole}</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {timeline.length ? (
                timeline.map((event, index) => (
                  <div key={`${event.time}-${index}`} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-black">
                        {event.direction === "up"
                          ? "Trust improved"
                          : event.direction === "down"
                            ? "Trust dropped"
                            : "Trust stable"}
                      </p>
                      <span
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-black",
                          event.direction === "up"
                            ? "bg-emerald-400/12 text-emerald-100"
                            : event.direction === "down"
                              ? "bg-rose-400/12 text-rose-100"
                              : "bg-blue-400/12 text-blue-100"
                        )}
                      >
                        {event.value ?? result?.recruiterTrust ?? 46}/100
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{event.reason}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm leading-6 text-slate-400">
                  Trust timeline will appear after at least one completed answer.
                </div>
              )}
            </div>

            <div className="mt-5 rounded-3xl border border-amber-300/20 bg-amber-500/10 p-5">
              <div className="flex items-center gap-2 text-sm font-black text-amber-100">
                <Sparkles className="h-5 w-5" />
                Next practice action
              </div>
              <p className="mt-3 text-sm leading-6 text-amber-50/90">
                {report?.nextPracticeAction ||
                  result?.memory?.improvements?.[0] ||
                  "Retry your weakest answer with result first, clear ownership, and measurable impact."}
              </p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  title,
  value,
  className,
}: {
  title: string;
  value: string;
  className: string;
}) {
  return (
    <div className={cn("rounded-3xl border p-5", className)}>
      <p className="text-xs font-black uppercase tracking-[0.22em] opacity-70">{title}</p>
      <p className="mt-3 text-2xl font-black">{value}</p>
    </div>
  );
}

function InsightCard({
  icon,
  title,
  text,
  tone,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  tone: "emerald" | "rose" | "blue" | "amber";
}) {
  const toneClass = {
    emerald: "border-emerald-300/20 bg-emerald-500/10 text-emerald-100",
    rose: "border-rose-300/20 bg-rose-500/10 text-rose-100",
    blue: "border-blue-300/20 bg-blue-500/10 text-blue-100",
    amber: "border-amber-300/20 bg-amber-500/10 text-amber-100",
  }[tone];

  return (
    <div className={cn("rounded-3xl border p-5", toneClass)}>
      <div className="flex items-center gap-2 text-sm font-black">
        {icon}
        {title}
      </div>
      <p className="mt-3 text-sm leading-6 text-white/86">{text}</p>
    </div>
  );
}
