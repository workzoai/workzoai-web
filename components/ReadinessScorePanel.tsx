"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Crown,
  Lock,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  buildReadinessScore,
  buildReadinessHistoryEntry,
  computeReadinessTrend,
  type ReadinessScoreInput,
  type ReadinessScoreOutput,
  type ReadinessHistoryEntry,
  type ReadinessDimension,
} from "@/lib/workzoReadinessEngine";
import type { TechnicalAssessmentResult } from "@/lib/workzoTechnicalAssessmentEngine";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function clamp(v: number) { return Math.max(0, Math.min(100, v)); }

// ── Sub-components ─────────────────────────────────────────────────────────────

function DimensionBar({
  dim,
  showDetail,
}: {
  dim: ReadinessDimension;
  showDetail: boolean;
}) {
  const color =
    !dim.available ? "bg-white/10" :
    dim.score >= 80 ? "bg-emerald-400" :
    dim.score >= 62 ? "bg-blue-400" :
    dim.score >= 45 ? "bg-amber-400" : "bg-rose-400";

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-black text-white">{dim.label}</span>
        <div className="flex items-center gap-2">
          {dim.available && (
            <span className={cn(
              "rounded-lg px-2 py-0.5 text-[10px] font-black",
              dim.grade === "A" ? "bg-emerald-400/10 text-emerald-300" :
              dim.grade === "B" ? "bg-blue-400/10 text-blue-300" :
              dim.grade === "C" ? "bg-amber-400/10 text-amber-300" :
              "bg-rose-400/10 text-rose-300",
            )}>
              {dim.grade}
            </span>
          )}
          <span className="text-sm font-black text-white w-16 text-right">
            {dim.available ? `${dim.score}/100` : "—"}
          </span>
        </div>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: dim.available ? `${clamp(dim.score)}%` : "0%" }}
        />
      </div>
      {showDetail && dim.available && dim.topInsight && (
        <p className="mt-1.5 text-xs leading-5 text-slate-400">{dim.topInsight}</p>
      )}
      {showDetail && !dim.available && (
        <p className="mt-1.5 text-xs text-slate-500">{dim.topInsight}</p>
      )}
    </div>
  );
}

function ReadinessRing({ score, label }: { score: number; label: string }) {
  const deg = clamp(score) * 3.6;
  const color =
    score >= 85 ? "#10b981" :
    score >= 72 ? "#3b82f6" :
    score >= 58 ? "#f59e0b" :
    "#f43f5e";

  return (
    <div
      className="grid h-32 w-32 shrink-0 place-items-center rounded-full"
      style={{ background: `conic-gradient(${color} ${deg}deg, rgba(255,255,255,0.08) 0deg)` }}
    >
      <div className="grid h-[6rem] w-[6rem] place-items-center rounded-full bg-[#0a0a1a] text-center">
        <div>
          <p className="text-3xl font-black text-white">{score}</p>
          <p className="text-[10px] font-black text-slate-400">/100</p>
          <p className="text-[10px] font-black text-blue-300 mt-0.5">{label}</p>
        </div>
      </div>
    </div>
  );
}

// ── History sparkline ─────────────────────────────────────────────────────────

function HistorySparkline({ history }: { history: ReadinessHistoryEntry[] }) {
  if (history.length < 2) return null;
  const scores = history.slice(-8).map((h) => h.overall);
  const min = Math.min(...scores);
  const max = Math.max(...scores, min + 1);
  const w = 140;
  const h = 36;
  const pad = 4;
  const points = scores.map((s, i) => {
    const x = pad + (i / (scores.length - 1)) * (w - pad * 2);
    const y = h - pad - ((s - min) / (max - min)) * (h - pad * 2);
    return `${x},${y}`;
  });

  const trend = computeReadinessTrend(history);

  return (
    <div className="flex items-center gap-3">
      <svg width={w} height={h} className="overflow-visible">
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke={trend.trend === "improving" ? "#10b981" : trend.trend === "declining" ? "#f43f5e" : "#3b82f6"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => {
          const [x, y] = p.split(",").map(Number);
          return <circle key={i} cx={x} cy={y} r="2.5" fill={i === points.length - 1 ? "#fff" : "rgba(255,255,255,0.3)"} />;
        })}
      </svg>
      <div>
        <p className={cn(
          "text-xs font-black",
          trend.trend === "improving" ? "text-emerald-300" :
          trend.trend === "declining" ? "text-rose-300" : "text-slate-300",
        )}>
          {trend.trend === "improving" ? `+${trend.delta} pts` :
           trend.trend === "declining" ? `${trend.delta} pts` : "Stable"}
        </p>
        <p className="text-[10px] text-slate-500">{history.length} sessions</p>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

type ReadinessScorePanelProps = {
  isPremium: boolean;
  // Pass computed scores in from the parent (results page or dashboard)
  interviewScore?: number;
  communicationScore?: number;
  confidenceScore?: number;
  trustScore?: number;
  ownershipScore?: number;
  structureScore?: number;
  evidenceScore?: number;
  cvScore?: number;
  jdMatchPercent?: number;
  matchedSkillCount?: number;
  missingSkillCount?: number;
  targetRole?: string;
  transcript?: Array<{ role?: string; text?: string }>;
  // Compact mode for dashboard widget
  compact?: boolean;
};

export default function ReadinessScorePanel({
  isPremium,
  interviewScore,
  communicationScore,
  confidenceScore,
  trustScore,
  ownershipScore,
  structureScore,
  evidenceScore,
  cvScore,
  jdMatchPercent,
  matchedSkillCount,
  missingSkillCount,
  targetRole,
  transcript,
  compact = false,
}: ReadinessScorePanelProps) {
  const [readiness, setReadiness] = useState<ReadinessScoreOutput | null>(null);
  const [history, setHistory] = useState<ReadinessHistoryEntry[]>([]);
  const [showDetail, setShowDetail] = useState(!compact);

  useEffect(() => {
    // Load technical result from localStorage (set by technical assessment page)
    let technicalResult: TechnicalAssessmentResult | undefined;
    try {
      const raw = window.localStorage.getItem("workzo_technical_result");
      if (raw) technicalResult = JSON.parse(raw);
    } catch {}

    // Load readiness history from localStorage
    try {
      const rawHistory = window.localStorage.getItem("workzo_readiness_history");
      if (rawHistory) setHistory(JSON.parse(rawHistory));
    } catch {}

    const input: ReadinessScoreInput = {
      cvScore,
      interviewScore,
      communicationScore,
      confidenceScore,
      trustScore,
      ownershipScore,
      structureScore,
      evidenceScore,
      technicalResult,
      jdMatchPercent,
      matchedSkillCount,
      missingSkillCount,
      targetRole,
      transcript,
    };

    const r = buildReadinessScore(input);
    setReadiness(r);

    // Persist history entry if we have interview data
    if (interviewScore && targetRole) {
      try {
        const entry = buildReadinessHistoryEntry(r, targetRole);
        const prevHistory: ReadinessHistoryEntry[] = [];
        const rawHistory = window.localStorage.getItem("workzo_readiness_history");
        if (rawHistory) prevHistory.push(...JSON.parse(rawHistory));
        const updated = [...prevHistory, entry].slice(-20); // keep last 20
        window.localStorage.setItem("workzo_readiness_history", JSON.stringify(updated));
        setHistory(updated);
      } catch {}
    }
  }, [interviewScore, communicationScore, confidenceScore, trustScore, ownershipScore,
      structureScore, evidenceScore, cvScore, jdMatchPercent, matchedSkillCount,
      missingSkillCount, targetRole, transcript]);

  if (!readiness) return null;

  const dims = readiness.dimensions;

  // ── Compact mode (dashboard widget) ─────────────────────────────────────────
  if (compact) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-300">Readiness Score</p>
            <p className="mt-0.5 text-sm text-slate-400">{readiness.label}</p>
          </div>
          <ReadinessRing score={readiness.overall} label={readiness.grade} />
        </div>

        {/* Mini bars — just labels and scores */}
        <div className="space-y-2 mb-4">
          {([dims.cv, dims.interview, dims.technical, dims.communication, dims.jdFit] as ReadinessDimension[]).map((dim) => (
            <div key={dim.label} className="flex items-center gap-2">
              <span className="w-24 text-xs text-slate-400">{dim.label}</span>
              <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full",
                    !dim.available ? "bg-white/5" :
                    dim.score >= 80 ? "bg-emerald-400" :
                    dim.score >= 62 ? "bg-blue-400" :
                    dim.score >= 45 ? "bg-amber-400" : "bg-rose-400"
                  )}
                  style={{ width: dim.available ? `${clamp(dim.score)}%` : "0%" }}
                />
              </div>
              <span className="w-10 text-right text-xs font-black text-white">
                {dim.available ? `${dim.score}` : "—"}
              </span>
            </div>
          ))}
        </div>

        {history.length >= 2 && <HistorySparkline history={history} />}

        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-slate-500 max-w-[60%]">{readiness.nextAction}</p>
          <Link href="/results" className="inline-flex items-center gap-1.5 text-xs font-black text-blue-300 hover:text-blue-100">
            Full report <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  // ── Full mode (results page) ──────────────────────────────────────────────────
  return (
    <section className="mt-6 rounded-2xl border border-blue-400/20 bg-blue-500/[0.05] p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-5">
          <ReadinessRing score={readiness.overall} label={readiness.grade} />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-300">Interview Readiness Score</p>
            <h2 className="mt-1 text-2xl font-black text-white">{readiness.label}</h2>
            <p className={cn(
              "mt-1 text-sm font-black",
              readiness.readyForLiveInterview ? "text-emerald-300" : "text-amber-300",
            )}>
              {readiness.readyForLiveInterview ? "✓ Ready for live interviews" : "⚡ More practice recommended"}
            </p>
            {readiness.estimatedOfferProbability > 0 && (
              <p className="mt-1 text-xs text-slate-400">
                Estimated offer probability: <span className="font-black text-white">{readiness.estimatedOfferProbability}%</span>
              </p>
            )}
          </div>
        </div>
        {history.length >= 2 && (
          <div className="shrink-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Progress</p>
            <HistorySparkline history={history} />
          </div>
        )}
      </div>

      {/* Five dimensions */}
      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Score Breakdown</p>
          <button
            type="button"
            onClick={() => setShowDetail(!showDetail)}
            className="text-[10px] font-black text-slate-500 hover:text-slate-300"
          >
            {showDetail ? "Hide detail" : "Show detail"}
          </button>
        </div>
        <DimensionBar dim={dims.cv} showDetail={showDetail} />
        <DimensionBar dim={dims.interview} showDetail={showDetail} />
        <DimensionBar dim={dims.technical} showDetail={showDetail} />
        <DimensionBar dim={dims.communication} showDetail={showDetail} />
        <DimensionBar dim={dims.jdFit} showDetail={showDetail} />
      </div>

      {/* Insights row */}
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300 mt-0.5" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300">Top strength</p>
              <p className="mt-1.5 text-xs leading-5 text-emerald-50">{readiness.topStrength}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
          <div className="flex items-start gap-2">
            <Zap className="h-4 w-4 shrink-0 text-amber-300 mt-0.5" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-300">Biggest gap</p>
              <p className="mt-1.5 text-xs leading-5 text-amber-50">{readiness.biggestGap}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Next action */}
      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
        <div className="flex items-start gap-3">
          <TrendingUp className="h-4 w-4 shrink-0 text-blue-300 mt-0.5" />
          <div>
            <p className="text-xs font-black text-white">Next action to improve your score</p>
            <p className="mt-1 text-xs leading-5 text-slate-300">{readiness.nextAction}</p>
          </div>
        </div>
      </div>

      {/* CTA: technical assessment if not done */}
      {!dims.technical.available && (
        <div className="mt-4 rounded-xl border border-violet-400/20 bg-violet-500/[0.07] p-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <BarChart3 className="h-4 w-4 shrink-0 text-violet-300 mt-0.5" />
            <div>
              <p className="text-xs font-black text-violet-200">Technical score not yet assessed</p>
              <p className="mt-1 text-xs text-slate-400">Complete the technical assessment to unlock your full readiness profile. It takes {isPremium ? "10–12" : "5"} minutes.</p>
            </div>
          </div>
          <Link
            href="/technical-assessment"
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-violet-500 px-3.5 py-2 text-xs font-black text-white hover:bg-violet-400 transition"
          >
            Take test <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Premium gate for full breakdown */}
      {!isPremium && (
        <div className="mt-4 relative overflow-hidden rounded-xl border border-violet-400/20 bg-violet-500/[0.06] p-4">
          <div className="select-none blur-[4px] pointer-events-none space-y-2">
            <p className="text-xs font-black text-white">Readiness trend over 8 sessions</p>
            <div className="h-8 bg-white/10 rounded-full" />
            <p className="text-xs text-slate-300">Improvement target: +12 pts to reach 'Interview Ready'</p>
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
            <div className="text-center">
              <Lock className="h-5 w-5 text-amber-200 mx-auto mb-2" />
              <p className="text-xs font-black text-white">Trend tracking — Premium</p>
              <Link href="/pricing?intent=readiness-trend" className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-black text-white hover:bg-blue-400">
                <Crown className="h-3.5 w-3.5" /> Upgrade
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
