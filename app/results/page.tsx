"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle2,
  ChevronRight,
  Flame,
  Gauge,
  Lightbulb,
  MessageSquareText,
  RefreshCcw,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  UserRound,
  Zap,
} from "lucide-react";

import BetaPrivacyNotice from "@/components/BetaPrivacyNotice";
import FeedbackCapture from "@/components/FeedbackCapture";
import { trackWorkZoLaunchEvent } from "@/lib/workzoLaunchAnalytics";
import {
  buildResultsInsight,
  compareRetryAnswer,
  type ResultPayload,
  type TrustTimelinePoint,
} from "@/lib/workzoResultsEngine";

const recruiterNames: Record<string, string> = {
  friendly_hr: "Sarah",
  analytical_hiring_manager: "Daniel",
  startup_recruiter: "Priya",
  german_corporate: "Markus",
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function readResults(): ResultPayload {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem("workzo-last-results");
    if (!raw) return {};
    return JSON.parse(raw) as ResultPayload;
  } catch {
    return {};
  }
}

function recruiterName(value?: string) {
  if (!value) return "Recruiter";
  return recruiterNames[value] || recruiterNames[value.replace(/-/g, "_")] || "Recruiter";
}

function toneForTrust(value: number) {
  if (value >= 84) return "from-emerald-300 via-cyan-300 to-blue-400";
  if (value >= 72) return "from-cyan-300 via-blue-400 to-violet-400";
  if (value >= 58) return "from-amber-200 via-orange-300 to-cyan-300";
  return "from-red-300 via-orange-300 to-amber-200";
}

function timelineTone(type: TrustTimelinePoint["type"]) {
  if (type === "drop") {
    return {
      shell: "border-red-300/15 bg-red-500/[0.055]",
      text: "text-red-200",
      icon: TrendingDown,
      dot: "bg-red-300 shadow-[0_0_18px_rgba(248,113,113,.55)]",
    };
  }
  if (type === "increase") {
    return {
      shell: "border-emerald-300/15 bg-emerald-400/[0.055]",
      text: "text-emerald-200",
      icon: TrendingUp,
      dot: "bg-emerald-300 shadow-[0_0_18px_rgba(52,211,153,.45)]",
    };
  }
  if (type === "recovery") {
    return {
      shell: "border-cyan-300/15 bg-cyan-400/[0.06]",
      text: "text-cyan-200",
      icon: CheckCircle2,
      dot: "bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,.45)]",
    };
  }
  return {
    shell: "border-white/[0.07] bg-white/[0.035]",
    text: "text-slate-300",
    icon: Sparkles,
    dot: "bg-slate-300 shadow-[0_0_18px_rgba(148,163,184,.35)]",
  };
}

function TrustDial({ value }: { value: number }) {
  return (
    <div className="relative flex h-[174px] w-[174px] shrink-0 items-center justify-center rounded-full border border-white/[0.07] bg-slate-950/50 shadow-[0_0_80px_rgba(59,130,246,0.18)]">
      <div
        className="absolute inset-3 rounded-full"
        style={{
          background: `conic-gradient(#38bdf8 ${value * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
        }}
      />
      <div className="absolute inset-6 rounded-full border border-white/[0.06] bg-[#07101f]" />
      <div className="relative text-center">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Trust</p>
        <p className="mt-1 text-5xl font-black tracking-[-0.06em]">{value}</p>
        <p className="text-xs font-bold text-slate-500">/100</p>
      </div>
    </div>
  );
}

function TrustGraph({ timeline, finalTrust }: { timeline: TrustTimelinePoint[]; finalTrust: number }) {
  const width = 640;
  const height = 200;
  const padding = 28;
  const points = [
    { label: "Start", score: Math.max(42, Math.min(68, finalTrust - 12)) },
    ...timeline.map((item, index) => ({ label: `Q${index + 1}`, score: item.score })),
    { label: "Final", score: finalTrust },
  ];

  const coords = points.map((point, index) => {
    const x = padding + (index / Math.max(1, points.length - 1)) * (width - padding * 2);
    const y = height - padding - (point.score / 100) * (height - padding * 2);
    return { ...point, x, y };
  });

  const path = coords.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const fillPath = `${path} L ${coords[coords.length - 1]?.x || width - padding} ${height - padding} L ${coords[0]?.x || padding} ${height - padding} Z`;

  return (
    <section className="rounded-[30px] border border-white/[0.07] bg-white/[0.04] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.26)] backdrop-blur-2xl sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-300/85">Trust timeline</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">Where confidence changed</h2>
        </div>
        <div className="w-fit rounded-2xl border border-white/[0.07] bg-white/[0.045] px-4 py-2 text-sm font-black">
          Final {finalTrust}/100
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-[26px] border border-white/[0.06] bg-black/18">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[174px] w-full">
          {[25, 50, 75].map((line) => {
            const y = height - padding - (line / 100) * (height - padding * 2);
            return <line key={line} x1={padding} y1={y} x2={width - padding} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />;
          })}
          <path d={fillPath} fill="url(#resultsTrustFill)" opacity="0.8" />
          <path d={path} fill="none" stroke="url(#resultsTrustLine)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          {coords.map((point) => (
            <g key={`${point.label}-${point.x}`}>
              <circle cx={point.x} cy={point.y} r="6" fill="#7dd3fc" />
              <circle cx={point.x} cy={point.y} r="12" fill="rgba(125,211,252,0.14)" />
            </g>
          ))}
          <defs>
            <linearGradient id="resultsTrustLine" x1="0" x2="1">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="55%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
            <linearGradient id="resultsTrustFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(59,130,246,0.42)" />
              <stop offset="100%" stopColor="rgba(59,130,246,0)" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">
        {points.map((point) => (
          <div key={`${point.label}-${point.score}`} className="rounded-2xl bg-white/[0.035] px-3 py-2">
            <p className="text-[11px] text-slate-500">{point.label}</p>
            <p className="text-sm font-black">{point.score}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ResultsPage() {
  const [payload, setPayload] = useState<ResultPayload>({});
  const [retryAnswer, setRetryAnswer] = useState("");

  useEffect(() => {
    setPayload(readResults());
  }, []);

  const insight = useMemo(() => buildResultsInsight(payload), [payload]);
  const comparison = retryAnswer.trim() ? compareRetryAnswer(insight.weakestAnswer.answer, retryAnswer) : null;

  const setup = payload.setup || {};
  const targetRole = setup.targetRole || "Target role";
  const targetMarket = setup.targetMarket || "Global";
  const recruiter = recruiterName(setup.recruiterPersonality || setup.recruiterId);

  useEffect(() => {
    trackWorkZoLaunchEvent({
      event: "results_viewed",
      role: setup.targetRole,
      market: setup.targetMarket,
      metadata: { trust: insight.trust, hiringSignal: insight.hiringSignal },
    });
  }, [insight.hiringSignal, insight.trust, setup.targetMarket, setup.targetRole]);

  useEffect(() => {
    if (!comparison) return;
    trackWorkZoLaunchEvent({
      event: "weak_answer_retried",
      role: setup.targetRole,
      market: setup.targetMarket,
      metadata: {
        oldScore: comparison.oldScore,
        newScore: comparison.newScore,
        trustDelta: comparison.trustDelta,
      },
    });
  }, [comparison, setup.targetMarket, setup.targetRole]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.18),transparent_31%),radial-gradient(circle_at_88%_10%,rgba(34,211,238,0.12),transparent_27%),linear-gradient(180deg,#06111f_0%,#040712_100%)] px-4 py-4 text-white sm:px-5">
      <div className="mx-auto max-w-[1460px]">
        <header className="flex min-h-[72px] items-center justify-between gap-3 rounded-[24px] border border-white/[0.07] bg-white/[0.045] px-4 shadow-[0_18px_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:px-5">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-black text-slate-300 transition hover:text-white">
            <ArrowLeft className="h-5 w-5" />
            Dashboard
          </Link>

          <div className="hidden text-center md:block">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-200">Post-interview intelligence</p>
            <p className="mt-1 text-sm text-slate-400">{targetRole} · {targetMarket} · {recruiter}</p>
          </div>

          <Link href="/interview" className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-violet-600 px-4 text-sm font-black text-white shadow-[0_14px_44px_rgba(59,130,246,0.25)] sm:px-5">
            Practice again
            <ArrowRight className="h-4 w-4" />
          </Link>
        </header>

        <section className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="space-y-4">
            <section className="relative overflow-hidden rounded-[34px] border border-white/[0.07] bg-white/[0.045] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.30)] backdrop-blur-2xl sm:p-7">
              <div className={cn("absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gradient-to-br opacity-20 blur-3xl", toneForTrust(insight.trust))} />
              <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/8 px-3 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-cyan-200">
                    <Flame className="h-4 w-4" />
                    Recruiter verdict
                  </div>
                  <h1 className="mt-5 max-w-2xl text-[clamp(40px,5vw,72px)] font-black leading-[0.95] tracking-[-0.06em]">
                    {insight.hiringSignal} <span className="text-cyan-200">hiring signal</span>
                  </h1>
                  <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">{insight.recruiterSummary}</p>
                  <div className="mt-5 rounded-[26px] border border-white/[0.07] bg-slate-950/42 p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200" />
                      <div>
                        <p className="text-sm font-black text-white">Would the recruiter continue?</p>
                        <p className="mt-1 text-sm leading-6 text-slate-300">{insight.continuationVerdict}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <TrustDial value={insight.trust} />
              </div>

              <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
                <MetricCard label="Target role" value={targetRole} icon={Target} />
                <MetricCard label="Recruiter" value={recruiter} icon={UserRound} />
                <MetricCard label="Market" value={targetMarket} icon={Gauge} />
              </div>
            </section>

            <section className="rounded-[30px] border border-white/[0.07] bg-white/[0.04] p-4 shadow-[0_22px_80px_rgba(0,0,0,0.24)] backdrop-blur-2xl sm:p-5">
              <div className="flex items-center gap-3">
                <Brain className="h-5 w-5 text-cyan-200" />
                <h2 className="text-2xl font-black tracking-[-0.03em]">What the recruiter remembers</h2>
              </div>
              <div className="mt-4 grid gap-3">
                {insight.recruiterMemory.map((item) => (
                  <div key={item.label} className="rounded-[24px] border border-white/[0.06] bg-slate-950/42 p-4">
                    <div className="flex items-start gap-3">
                      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl", item.tone === "positive" ? "bg-emerald-400/10" : item.tone === "warning" ? "bg-red-400/10" : "bg-cyan-400/10")}>
                        {item.tone === "positive" ? <TrendingUp className="h-5 w-5 text-emerald-200" /> : item.tone === "warning" ? <ShieldAlert className="h-5 w-5 text-red-200" /> : <Brain className="h-5 w-5 text-cyan-200" />}
                      </div>
                      <div>
                        <p className="font-black">{item.label}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-300">{item.value}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>



            <section className="rounded-[30px] border border-white/[0.07] bg-white/[0.04] p-4 shadow-[0_22px_80px_rgba(0,0,0,0.24)] backdrop-blur-2xl sm:p-5">
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-5 w-5 text-amber-200" />
                <h2 className="text-2xl font-black tracking-[-0.03em]">Why trust changed</h2>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <InsightList
                  title="Trust dropped because"
                  tone="warning"
                  items={insight.trustDropReasons}
                  fallback="No major trust drop reason was detected yet."
                />
                <InsightList
                  title="Trust recovered because"
                  tone="positive"
                  items={insight.trustRecoveryReasons}
                  fallback="No clear recovery moment was detected yet."
                />
              </div>
            </section>

            <section className="rounded-[30px] border border-white/[0.07] bg-white/[0.04] p-4 shadow-[0_22px_80px_rgba(0,0,0,0.24)] backdrop-blur-2xl sm:p-5">
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 text-violet-200" />
                <h2 className="text-2xl font-black tracking-[-0.03em]">Patterns to fix</h2>
              </div>
              <div className="mt-4 grid gap-3">
                {insight.repeatedPatterns.length > 0 ? (
                  insight.repeatedPatterns.map((pattern) => (
                    <div key={pattern.label} className="rounded-[24px] border border-white/[0.06] bg-slate-950/42 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-black">{pattern.label}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-300">{pattern.reason}</p>
                        </div>
                        <span className="rounded-full border border-white/[0.08] bg-white/[0.045] px-3 py-1 text-xs font-black text-slate-300">
                          {pattern.count}x
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-[24px] border border-white/[0.06] bg-slate-950/42 p-4 text-sm leading-6 text-slate-300">
                    No repeated weak pattern detected yet. Complete a longer interview to unlock deeper pattern memory.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-[30px] border border-red-300/16 bg-red-500/[0.045] p-4 shadow-[0_22px_80px_rgba(0,0,0,0.24)] backdrop-blur-2xl sm:p-5">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-200" />
                <h2 className="text-2xl font-black tracking-[-0.03em]">Weakest answer</h2>
              </div>
              <div className="mt-4 grid gap-3">
                <EvidenceBlock label="Question" value={insight.weakestAnswer.question} />
                <EvidenceBlock label="Answer" value={insight.weakestAnswer.answer} />
              </div>
              <p className="mt-4 rounded-3xl border border-red-200/10 bg-black/16 p-4 text-sm leading-6 text-red-100/90">
                Recruiter doubt: {insight.weakestMoment}
              </p>
            </section>

            <BetaPrivacyNotice className="hidden xl:block" />
          </section>

          <section className="space-y-4">
            <TrustGraph timeline={insight.trustTimeline} finalTrust={insight.trust} />

            <section className="rounded-[30px] border border-white/[0.07] bg-white/[0.04] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.26)] backdrop-blur-2xl sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-black tracking-[-0.03em]">Recruiter trust moments</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-400">The moments where the recruiter became convinced, skeptical, or open to recovery.</p>
                </div>
                <div className="w-fit rounded-2xl border border-white/[0.07] bg-white/[0.045] px-3 py-2 text-xs font-black text-slate-300">
                  {insight.trustTimeline.length} moments
                </div>
              </div>

              <div className="mt-4 space-y-2.5">
                {insight.trustTimeline.map((event) => {
                  const tone = timelineTone(event.type);
                  const Icon = tone.icon;
                  return (
                    <div key={event.id} className={cn("rounded-[24px] border p-3.5 transition hover:bg-white/[0.06]", tone.shell)}>
                      <div className="flex gap-4">
                        <div className="relative">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06]">
                            <Icon className={cn("h-5 w-5", tone.text)} />
                          </div>
                          <span className={cn("absolute -right-1 -top-1 h-3 w-3 rounded-full", tone.dot)} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-black">{event.label}</p>
                            <span className={cn("rounded-full border border-white/[0.08] px-2 py-0.5 text-[11px] font-black", tone.text)}>{event.recruiterMood}</span>
                            <span className="rounded-full border border-white/[0.08] px-2 py-0.5 text-[11px] font-black text-slate-400">
                              {event.delta > 0 ? "+" : ""}{event.delta} trust
                            </span>
                          </div>
                          <p className="mt-1 text-sm leading-6 text-slate-300">{event.reason}</p>
                          <p className="mt-2 line-clamp-2 rounded-2xl bg-black/14 px-3 py-2 text-xs leading-5 text-slate-500">“{event.evidence}”</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-[30px] border border-white/[0.07] bg-white/[0.04] p-4 shadow-[0_22px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl sm:p-5">
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-5 w-5 text-blue-200" />
                  <h2 className="text-xl font-black tracking-[-0.02em]">Score breakdown</h2>
                </div>
                <div className="mt-4 grid gap-3">
                  {insight.scoreCards.map((card) => (
                    <ScoreRow key={card.label} label={card.label} value={card.value} note={card.note} />
                  ))}
                </div>
              </section>

              <section className="rounded-[30px] border border-emerald-300/18 bg-emerald-400/[0.055] p-4 shadow-[0_22px_80px_rgba(0,0,0,0.24)] backdrop-blur-2xl sm:p-5">
                <div className="flex items-center gap-3">
                  <Lightbulb className="h-5 w-5 text-emerald-200" />
                  <h2 className="text-xl font-black tracking-[-0.02em]">Next practice plan</h2>
                </div>
                <div className="mt-4 space-y-3">
                  {insight.topFixesBeforeRealInterview.map((item, index) => (
                    <div key={`${item}-${index}`} className="flex gap-3 rounded-2xl border border-white/[0.07] bg-black/16 p-3 text-sm leading-6 text-slate-300">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-400/12 text-xs font-black text-emerald-200">{index + 1}</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <section className="rounded-[30px] border border-cyan-300/18 bg-cyan-400/[0.055] p-4 shadow-[0_22px_80px_rgba(0,0,0,0.24)] backdrop-blur-2xl sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <RefreshCcw className="h-5 w-5 text-cyan-200" />
                  <div>
                    <h2 className="text-2xl font-black tracking-[-0.03em]">Retry weakest answer</h2>
                    <p className="mt-1 text-sm text-slate-400">Rewrite once. See whether recruiter trust improves.</p>
                  </div>
                </div>
                {comparison && (
                  <div className={cn("w-fit rounded-2xl border px-4 py-2 text-sm font-black", comparison.improved ? "border-emerald-300/18 bg-emerald-400/10 text-emerald-200" : "border-red-300/18 bg-red-400/10 text-red-200")}>
                    {comparison.trustDelta > 0 ? "+" : ""}{comparison.trustDelta} trust
                  </div>
                )}
              </div>

              <textarea
                value={retryAnswer}
                onChange={(event) => setRetryAnswer(event.target.value)}
                placeholder="Rewrite your answer here using STAR, metrics, and ownership..."
                className="mt-4 h-32 w-full resize-none rounded-3xl border border-white/[0.07] bg-slate-950/56 p-4 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
              />

              {comparison && (
                <div className="mt-4 grid gap-3 xl:grid-cols-[0.86fr_1.14fr]">
                  <div className="rounded-3xl border border-white/[0.07] bg-black/16 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Score movement</p>
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <ScoreBox label="Old" value={comparison.oldScore} />
                      <ScoreBox label="New" value={comparison.newScore} />
                      <ScoreBox label="Delta" value={`${comparison.trustDelta > 0 ? "+" : ""}${comparison.trustDelta}`} />
                    </div>
                  </div>
                  <div className="rounded-3xl border border-white/[0.07] bg-black/16 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Recruiter reaction</p>
                    <p className="mt-3 text-sm leading-6 text-slate-300">{comparison.message}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {comparison.checklist.map((item) => (
                        <span key={item} className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-bold text-slate-300">{item}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </section>
        </section>


        {insight.unsupportedClaimSignals.length > 0 && (
          <section className="mt-4 rounded-[30px] border border-amber-300/18 bg-amber-400/[0.045] p-4 shadow-[0_18px_70px_rgba(0,0,0,0.20)] backdrop-blur-2xl sm:p-5">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-amber-200" />
              <h2 className="text-xl font-black tracking-[-0.02em]">CV consistency moments</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              These are moments where the recruiter needed clarification because an answer did not clearly align with the CV or career timeline.
            </p>
            <div className="mt-4 grid gap-3">
              {insight.unsupportedClaimSignals.map((item, index) => (
                <div key={`${item}-${index}`} className="rounded-2xl border border-white/[0.07] bg-black/16 p-3 text-sm leading-6 text-amber-50/90">
                  “{item}”
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_0.85fr]">
          <FeedbackCapture source="results" />
          <div className="rounded-[30px] border border-white/[0.07] bg-white/[0.04] p-4 shadow-[0_18px_70px_rgba(0,0,0,0.20)] backdrop-blur-2xl sm:p-5">
            <div className="flex items-center gap-3">
              <MessageSquareText className="h-5 w-5 text-violet-200" />
              <h2 className="text-xl font-black tracking-[-0.02em]">The WorkZo loop</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-400">Weak answer → recruiter trust drops → retry answer → trust recovery. This is the feedback loop that makes the interview feel alive.</p>
            <div className="mt-4 grid gap-2">
              {insight.atmosphere.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-black/16 p-3">
                  <p className="text-sm text-slate-400">{item.label}</p>
                  <p className="text-sm font-black">{item.value}</p>
                </div>
              ))}
            </div>
            <Link href="/copilot" className="mt-4 inline-flex h-11 items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.055] px-4 text-sm font-black text-white hover:bg-white/10">
              Open Work-O-Bot
              <Zap className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}


function InsightList({
  title,
  items,
  fallback,
  tone,
}: {
  title: string;
  items: string[];
  fallback: string;
  tone: "positive" | "warning";
}) {
  const Icon = tone === "positive" ? CheckCircle2 : AlertTriangle;
  const iconClass = tone === "positive" ? "text-emerald-200" : "text-amber-200";
  const shellClass = tone === "positive" ? "border-emerald-300/14 bg-emerald-400/[0.045]" : "border-amber-300/14 bg-amber-400/[0.045]";
  const values = items.length ? items : [fallback];

  return (
    <div className={cn("rounded-[24px] border p-4", shellClass)}>
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", iconClass)} />
        <p className="font-black">{title}</p>
      </div>
      <div className="mt-3 space-y-2">
        {values.map((item, index) => (
          <div key={`${title}-${index}-${item}`} className="rounded-2xl border border-white/[0.07] bg-black/14 px-3 py-2 text-sm leading-6 text-slate-300">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Target }) {
  return (
    <div className="rounded-[24px] border border-white/[0.07] bg-slate-950/45 p-4">
      <Icon className="h-5 w-5 text-blue-200" />
      <p className="mt-3 text-xs font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 line-clamp-2 text-sm font-black leading-6">{value}</p>
    </div>
  );
}

function EvidenceBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/[0.07] bg-black/16 p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{value}</p>
    </div>
  );
}

function ScoreRow({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/16 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black">{label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{note}</p>
        </div>
        <p className="text-xl font-black">{value}</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-blue-500" style={{ width: `${Math.max(8, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function ScoreBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-white/[0.045] p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}
