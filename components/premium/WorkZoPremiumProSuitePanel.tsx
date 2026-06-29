"use client";

import Link from "next/link";
import { useMemo } from "react";
import { BrainCircuit, CheckCircle2, Lock, PlayCircle, Route, Sparkles, Target, TrendingUp } from "lucide-react";
import { buildWorkZoPremiumProSuite, type WorkZoPremiumProSuite } from "@/lib/workzoPremiumProCareerSuite";
import type { PhaseCCareerBrainInput } from "@/lib/workzoCareerMemory";
import { useWorkZoAuthoritativePlan } from "@/lib/workzoClientPlan";
import { canUseWorkZoFeature } from "@/lib/workzoPlanLimits";

type PanelProps = {
  source?: "dashboard" | "results" | "history";
  report?: Record<string, unknown> | null;
  compact?: boolean;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function numberValue(source: Record<string, unknown> | null | undefined, keys: string[], fallback = 0) {
  if (!source) return fallback;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return fallback;
}

function stringValue(source: Record<string, unknown> | null | undefined, keys: string[], fallback = "") {
  if (!source) return fallback;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
}

function arrayValue<T>(source: Record<string, unknown> | null | undefined, keys: string[]): T[] {
  if (!source) return [];
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) return value as T[];
  }
  return [];
}

type CareerCoachAnswerInsightInput = NonNullable<PhaseCCareerBrainInput["answerInsights"]>[number];
type CareerCoachContradictionInput = { detail?: string; title?: string };

function booleanValue(source: Record<string, unknown>, keys: string[], fallback = false) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "boolean") return value;
  }
  return fallback;
}

function normalizeAnswerInsight(value: unknown): CareerCoachAnswerInsightInput | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  return {
    answer: stringValue(record, ["answer", "text", "content"], ""),
    metricPresent: booleanValue(record, ["metricPresent", "hasMetric"]),
    ownershipPresent: booleanValue(record, ["ownershipPresent", "hasOwnership"]),
    resultPresent: booleanValue(record, ["resultPresent", "hasResult"]),
    structureScore: numberValue(record, ["structureScore"], 0),
    evidenceScore: numberValue(record, ["evidenceScore"], 0),
    trustImpact: numberValue(record, ["trustImpact"], 0),
    weakness: stringValue(record, ["weakness", "reason", "issue"], ""),
    redFlags: arrayValue<string>(record, ["redFlags", "flags"]),
  };
}

function normalizeContradiction(value: unknown): CareerCoachContradictionInput | null {
  if (typeof value === "string" && value.trim()) {
    return { detail: value.trim(), title: "Possible contradiction" };
  }

  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const detail = stringValue(record, ["detail", "reason", "text", "description"], "");
  const title = stringValue(record, ["title", "label"], "Possible contradiction");

  return detail || title ? { detail, title } : null;
}

function buildInputFromReport(report?: Record<string, unknown> | null): PhaseCCareerBrainInput {
  const answerInsights = arrayValue<unknown>(report, ["answerInsights"])
    .map(normalizeAnswerInsight)
    .filter((item): item is CareerCoachAnswerInsightInput => Boolean(item));

  const contradictions = arrayValue<unknown>(report, ["contradictions"])
    .map(normalizeContradiction)
    .filter((item): item is CareerCoachContradictionInput => Boolean(item));

  return {
    targetRole: stringValue(report, ["targetRole", "role", "roleLabel"], "Target role"),
    companyName: stringValue(report, ["companyName", "targetCompany", "companyLabel"], "Target company"),
    overallScore: numberValue(report, ["overallScore"], 68),
    trustScore: numberValue(report, ["trustScore"], 66),
    evidenceQuality: numberValue(report, ["evidenceQuality"], 62),
    ownershipScore: numberValue(report, ["ownershipScore"], 62),
    structureScore: numberValue(report, ["structureScore"], 62),
    biggestBlocker: stringValue(report, ["biggestBlocker", "quickWin"], "Missing measurable evidence"),
    strengths: arrayValue<string>(report, ["strengths"]),
    improvements: arrayValue<string>(report, ["improvements"]),
    answerInsights,
    contradictions,
  };
}

function SmallTrend({ label, values }: { label: string; values: number[] }) {
  const safeValues = values.length ? values : [0, 0, 0];
  const latest = safeValues[safeValues.length - 1] || 0;
  return (
    <div className="rounded-lg border border-line bg-canvas-soft p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-subtle">{label}</p>
        <p className="text-lg font-black text-fg">{latest || "—"}</p>
      </div>
      <div className="mt-3 flex h-10 items-end gap-1">
        {safeValues.map((value, index) => (
          <span
            key={`${label}-${index}`}
            className="flex-1 rounded-t bg-brand/50"
            style={{ height: `${Math.max(8, Math.min(100, value || 10))}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function LockedPanel() {
  return (
    <section className="rounded-lg border border-brand/20 bg-brand/[0.08] p-6">
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-brand/15 text-brand">
          <Lock className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-brand">Premium Pro</p>
          <h2 className="mt-2 text-2xl font-black text-fg">Unlock AI Career Coach + Replay Intelligence</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Premium Pro adds a long-term AI Career Coach, 30/60/90 day career roadmaps, progress trends, interview replay intelligence, premium recruiter challenges, and Live AI Recruiter minutes.
          </p>
          <Link href="/pricing?plan=premium_pro&intent=career_coach" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-black text-on-brand hover:bg-brand">
            Upgrade to Premium Pro
            <Sparkles className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function WorkZoPremiumProSuitePanel({ source = "dashboard", report = null, compact = false }: PanelProps) {
  const { plan } = useWorkZoAuthoritativePlan();
  const allowed = canUseWorkZoFeature(plan, "career_coach");
  const suite: WorkZoPremiumProSuite = useMemo(() => buildWorkZoPremiumProSuite(buildInputFromReport(report)), [report]);

  if (!allowed) return <LockedPanel />;

  return (
    <section className={cn("rounded-lg border border-brand/20 bg-brand/[0.075] p-6 shadow-2xl shadow-brand/10", compact && "p-5")}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-brand">Premium Pro career layer</p>
          <h2 className="mt-2 flex items-center gap-3 text-2xl font-black text-fg">
            <BrainCircuit className="h-6 w-6 text-brand" /> AI Career Coach
          </h2>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-muted">{suite.coachSummary}</p>
        </div>
        <div className="rounded-lg border border-line bg-canvas-soft p-4 text-center">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-subtle">Hiring readiness</p>
          <p className="mt-2 text-4xl font-black text-fg">{suite.hiringReadiness.current}%</p>
          <p className="mt-1 text-xs font-black uppercase text-brand">{suite.hiringReadiness.label}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {suite.weeklyPriorities.map((item) => (
          <div key={item.title} className="rounded-lg border border-line bg-canvas-soft p-4">
            <p className="text-sm font-black text-fg">{item.title}</p>
            <p className="mt-2 text-sm leading-6 text-muted">{item.action}</p>
            <p className="mt-3 text-xs leading-5 text-subtle">{item.reason}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <div className="rounded-lg border border-line bg-canvas-soft p-5">
          <h3 className="flex items-center gap-2 text-lg font-black text-fg"><Route className="h-5 w-5 text-brand" />30 / 60 / 90 day roadmap</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {([
              ["30 days", suite.roadmap.days30],
              ["60 days", suite.roadmap.days60],
              ["90 days", suite.roadmap.days90],
            ] as const).map(([label, items]) => (
              <div key={label} className="rounded-lg border border-line bg-fg/[0.035] p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-brand">{label}</p>
                <div className="mt-3 space-y-3">
                  {items.slice(0, 3).map((item) => (
                    <div key={`${label}-${item.id}`}>
                      <p className="text-sm font-black text-fg">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-muted">{item.action}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-line bg-canvas-soft p-5">
          <h3 className="flex items-center gap-2 text-lg font-black text-fg"><TrendingUp className="h-5 w-5 text-success" />Progress tracking</h3>
          <p className="mt-2 text-sm leading-6 text-muted">{suite.progressTracking.trendSummary}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <SmallTrend label="Score" values={suite.progressTracking.scoreTrend} />
            <SmallTrend label="Trust" values={suite.progressTracking.trustTrend} />
            <SmallTrend label="Evidence" values={suite.progressTracking.evidenceTrend} />
            <SmallTrend label="Ownership" values={suite.progressTracking.ownershipTrend} />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="rounded-lg border border-line bg-canvas-soft p-5">
          <h3 className="flex items-center gap-2 text-lg font-black text-fg"><PlayCircle className="h-5 w-5 text-brand" />Replay intelligence</h3>
          <div className="mt-4 space-y-3">
            {suite.replayIntelligence.slice(0, source === "dashboard" ? 3 : 6).map((moment) => (
              <div key={moment.id} className="rounded-lg border border-line bg-fg/[0.035] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-fg">{moment.label}</p>
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-black", moment.trustImpact < 0 ? "bg-danger/10 text-danger" : "bg-success/10 text-success")}>{moment.trustImpact > 0 ? "+" : ""}{moment.trustImpact}</span>
                </div>
                <p className="mt-2 text-xs font-bold text-muted">{moment.question}</p>
                <p className="mt-2 text-sm leading-6 text-muted">{moment.insight}</p>
                <p className="mt-3 rounded-xl bg-brand/10 p-3 text-xs leading-5 text-brand">Coach: {moment.coachingAction}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-line bg-canvas-soft p-5">
          <h3 className="flex items-center gap-2 text-lg font-black text-fg"><Target className="h-5 w-5 text-warning" />Next recruiter challenges</h3>
          <div className="mt-4 space-y-3">
            {suite.recruiterChallenges.map((challenge) => (
              <p key={challenge} className="rounded-lg border border-line bg-fg/[0.035] p-4 text-sm leading-6 text-fg">“{challenge}”</p>
            ))}
          </div>
          <div className="mt-5 rounded-lg border border-success/15 bg-success/10 p-4">
            <p className="flex items-center gap-2 text-sm font-black text-success"><CheckCircle2 className="h-4 w-4" />Full career support active</p>
            <p className="mt-2 text-xs leading-5 text-success/70">This connects interviews, CV improvement, cover letters, Job Assist, progress tracking, and recruiter memory into one Premium Pro coaching loop.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
