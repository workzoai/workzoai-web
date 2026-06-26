"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Brain,
  CheckCircle2,
  Clock,
  Eye,
  Mic,
  MicOff,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Upload,
  Users,
  Zap,
  AlertCircle,
} from "lucide-react";

type AnyRecord = Record<string, unknown>;

type AnalyticsResponse = {
  ok?: boolean;
  configured?: boolean;
  summary?: AnyRecord;
  metrics?: AnyRecord;
  events?: AnyRecord[];
  error?: string;
  reason?: string;
};

const emptyData: AnalyticsResponse = { ok: true, configured: true, summary: {}, metrics: {}, events: [] };

function n(v: unknown) { const x = Number(v || 0); return Number.isFinite(x) ? x : 0; }
function fmt(v: unknown) { return n(v).toLocaleString(); }
function pct(v: unknown) { return `${Math.round(n(v))}%`; }
function entries(obj: unknown): [string, number][] {
  if (!obj || typeof obj !== "object") return [];
  return Object.entries(obj as Record<string, unknown>)
    .map(([k, v]) => [k, n(v)] as [string, number])
    .filter(([k, v]) => k.trim() && v > 0)
    .sort((a, b) => b[1] - a[1]);
}

// Compute daily buckets from raw events for a sparkline
function dailyBuckets(events: AnyRecord[], key: string, days = 14) {
  const now = Date.now();
  const buckets: number[] = Array(days).fill(0);
  for (const ev of events) {
    if (ev.event !== key) continue;
    const ts = new Date(String(ev.timestamp || ev.receivedAt || "")).getTime();
    if (!ts) continue;
    const daysAgo = Math.floor((now - ts) / 86400000);
    if (daysAgo >= 0 && daysAgo < days) buckets[days - 1 - daysAgo]++;
  }
  return buckets;
}

function Sparkline({ data, color = "#22d3ee" }: { data: number[]; color?: string }) {
  const max = Math.max(1, ...data);
  const w = 80; const h = 28;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (v / max) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="opacity-70">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function Delta({ value, reverse = false }: { value: number; reverse?: boolean }) {
  if (value === 0) return <span className="text-slate-500 text-xs">—</span>;
  const good = reverse ? value < 0 : value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-black ${good ? "text-emerald-400" : "text-red-400"}`}>
      {good ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(value)}%
    </span>
  );
}

function Kpi({
  label, value, hint, tone = "default", sparkData, sparkColor, delta, deltaReverse,
}: {
  label: string; value: string | number; hint?: string;
  tone?: "default" | "good" | "warn" | "danger";
  sparkData?: number[]; sparkColor?: string;
  delta?: number; deltaReverse?: boolean;
}) {
  const border = tone === "good" ? "border-emerald-400/20" : tone === "warn" ? "border-amber-400/20" : tone === "danger" ? "border-red-400/20" : "border-white/10";
  const bg = tone === "good" ? "bg-emerald-400/[0.06]" : tone === "warn" ? "bg-amber-400/[0.06]" : tone === "danger" ? "bg-red-400/[0.06]" : "bg-white/[0.04]";
  return (
    <div className={`rounded-2xl border ${border} ${bg} p-4 flex flex-col gap-2`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
        {sparkData && <Sparkline data={sparkData} color={sparkColor} />}
      </div>
      <div className="flex items-end justify-between">
        <p className="text-2xl font-black text-white leading-none">{value}</p>
        {delta !== undefined && <Delta value={delta} reverse={deltaReverse} />}
      </div>
      {hint && <p className="text-xs text-slate-400 leading-5">{hint}</p>}
    </div>
  );
}

function FunnelBar({ stages }: { stages: { label: string; count: number; sub?: string }[] }) {
  const first = Math.max(1, stages[0]?.count || 1);
  return (
    <div className="space-y-3">
      {stages.map((stage, i) => {
        const prev = stages[i - 1]?.count ?? 0;
        // Only show step % when both this step and previous have data.
        // When prev=0 and current>0, the % is meaningless (infinite) — hide it.
        const hasStepPct = i > 0 && prev > 0;
        const stepPct = hasStepPct ? Math.round((stage.count / prev) * 100) : null;
        const totalPct = first > 0 ? Math.round((stage.count / first) * 100) : 0;
        const w = Math.max(4, totalPct);
        const stepTone = stepPct === null ? "" : stepPct < 40 ? "text-red-400" : stepPct < 70 ? "text-amber-400" : "text-emerald-400";
        return (
          <div key={stage.label}>
            <div className="flex items-center justify-between mb-1.5 text-sm">
              <div className="flex items-center gap-3">
                <span className="w-5 text-right text-[11px] font-black text-slate-600">{String(i + 1).padStart(2, "0")}</span>
                <span className="font-black text-slate-200">{stage.label}</span>
                {stage.sub && <span className="text-xs text-slate-500">{stage.sub}</span>}
              </div>
              <div className="flex items-center gap-3">
                {stepPct !== null && <span className={`text-xs font-black ${stepTone}`}>{stepPct}% from prev</span>}
                {i > 0 && stepPct === null && stage.count > 0 && <span className="text-xs text-slate-600">prev step = 0</span>}
                <span className="font-black text-white w-12 text-right">{stage.count.toLocaleString()}</span>
              </div>
            </div>
            <div className="h-2 rounded-full bg-white/[0.07] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 transition-all duration-500"
                style={{ width: `${w}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BarList({ rows, max = 8, empty = "No data yet." }: { rows: [string, number][]; max?: number; empty?: string }) {
  const data = rows.slice(0, max);
  const highest = Math.max(1, ...data.map(([, v]) => v));
  if (!data.length) return <p className="text-sm text-slate-500 italic">{empty}</p>;
  return (
    <div className="space-y-2.5">
      {data.map(([label, value]) => (
        <div key={label}>
          <div className="flex items-center justify-between mb-1 text-sm">
            <span className="truncate font-medium text-slate-300 max-w-[75%]" title={label}>{label}</span>
            <span className="font-black text-white">{value.toLocaleString()}</span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.07] overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-400"
              style={{ width: `${Math.max(4, (value / highest) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function PlanTable({ planBreakdown }: { planBreakdown: AnyRecord }) {
  const plans = ["free", "premium", "premium_pro"];
  const labels: Record<string, string> = { free: "Free", premium: "Premium", premium_pro: "Pro" };
  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-white/[0.04] border-b border-white/10">
            {["Plan", "Sessions", "CV uploads", "Interviews", "Completed", "Completion", "Avg trust"].map(h => (
              <th key={h} className="px-3 py-2.5 text-left text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {plans.map(plan => {
            const d = (planBreakdown[plan] || {}) as AnyRecord;
            const comp = n(d.completionRate);
            return (
              <tr key={plan} className="border-t border-white/[0.06] hover:bg-white/[0.025]">
                <td className="px-3 py-2.5 font-black text-white">{labels[plan]}</td>
                <td className="px-3 py-2.5 text-slate-300">{fmt(d.sessions)}</td>
                <td className="px-3 py-2.5 text-slate-300">{fmt(d.uploads)}</td>
                <td className="px-3 py-2.5 text-slate-300">{fmt(d.interviewsStarted)}</td>
                <td className="px-3 py-2.5 text-slate-300">{fmt(d.completedInterviews)}</td>
                <td className="px-3 py-2.5">
                  <span className={`font-black ${comp >= 60 ? "text-emerald-400" : comp >= 35 ? "text-amber-400" : "text-red-400"}`}>
                    {comp}%
                  </span>
                </td>
                <td className="px-3 py-2.5 text-slate-300">{d.avgTrust ? `${fmt(d.avgTrust)}/100` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AlertBanner({ insight }: { insight: string }) {
  if (!insight || insight.includes("No analytics")) return null;
  const isWarn = insight.toLowerCase().includes("low") || insight.toLowerCase().includes("high");
  return (
    <div className={`flex items-start gap-3 rounded-2xl border p-4 ${isWarn ? "border-amber-400/20 bg-amber-400/[0.06]" : "border-cyan-400/20 bg-cyan-400/[0.06]"}`}>
      <AlertCircle className={`mt-0.5 h-4 w-4 shrink-0 ${isWarn ? "text-amber-400" : "text-cyan-400"}`} />
      <p className="text-sm text-slate-300">{insight}</p>
    </div>
  );
}

function Section({ title, subtitle, icon, children, accent }: {
  title: string; subtitle?: string; icon?: React.ReactNode; children: React.ReactNode; accent?: string;
}) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-white/[0.03] p-5`}>
      <div className="mb-4 flex items-start gap-3">
        {icon && <div className={`mt-0.5 ${accent || "text-slate-400"}`}>{icon}</div>}
        <div>
          <h2 className="text-base font-black text-white">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function FounderAnalyticsClient() {
  const [data, setData] = useState<AnalyticsResponse>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showDev, setShowDev] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [includeLocal, setIncludeLocal] = useState(false);

  async function load(withLocal?: boolean) {
    setLoading(true);
    setError("");
    const useLocal = withLocal ?? includeLocal;
    try {
      const params = new URLSearchParams(window.location.search);
      const secret = params.get("secret") || "";
      const url = `/api/analytics?secret=${encodeURIComponent(secret)}${useLocal ? "&all=1" : ""}`;
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json().catch(() => null) as AnalyticsResponse | null;
      if (!res.ok || !json?.ok) throw new Error(json?.error || json?.reason || `${res.status}`);
      setData(json);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics.");
      setData(emptyData);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(includeLocal), 60000);
    return () => window.clearInterval(id);
  }, []);

  const s = data.summary || {};
  const events = Array.isArray(data.events) ? data.events : [];

  // Sparklines from raw events
  const uploadSpark = useMemo(() => dailyBuckets(events, "cv_uploaded"), [events]);
  const startSpark = useMemo(() => dailyBuckets(events, "interview_started"), [events]);
  const completeSpark = useMemo(() => dailyBuckets(events, "interview_completed"), [events]);

  // Core metrics
  const visitors = n(s.uniqueVisitors);
  const active7d = n(s.activeVisitors7d);
  const signedIn = n(s.signedInUsers);
  const uploads = n(s.uploads);
  const started = n(s.interviewsStarted);
  const completed = n(s.completedInterviews);
  const results = n(s.resultsViewed);
  const completion = n(s.completionRate);
  const voiceFailRate = n(s.voiceFailureRate);
  const internalCount = n(s.internalEvents || s.internalTestEvents);

  // Funnel
  const funnel = [
    { label: "Visitors", count: visitors },
    { label: "CV uploads", count: uploads, sub: "onboarding step 1" },
    { label: "JD added", count: n(s.counts?.jd_added), sub: "onboarding step 2" },
    { label: "Interview started", count: started },
    { label: "Completed", count: completed },
    { label: "Results viewed", count: results },
  ];

  // Upload → Interview conversion
  const uploadToStart = uploads ? Math.round((started / uploads) * 100) : 0;
  const startToComplete = started ? Math.round((completed / started) * 100) : 0;
  const completeToResults = completed ? Math.round((results / completed) * 100) : 0;

  // Plan breakdown
  const planBreakdown = (s.planBreakdown || {}) as AnyRecord;

  // Top weakness
  const weakSignalRows = entries(s.weakSignals).slice(0, 6);

  // Recent events — group by session for readability
  const recentRows = events.slice(0, 40);

  function cleanEvt(v: string) {
    return v.replace(/_/g, " ").replace(/\b\w/g, m => m.toUpperCase());
  }

  const timeAgo = lastUpdated
    ? (() => {
        const secs = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
        if (secs < 60) return `${secs}s ago`;
        return `${Math.floor(secs / 60)}m ago`;
      })()
    : null;

  return (
    <main className="min-h-screen bg-[#020812] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-5">

        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-black text-slate-500 hover:text-slate-300 transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
            </Link>
            <h1 className="mt-3 text-2xl font-black tracking-tight">Founder Analytics</h1>
            <p className="mt-1 text-xs text-slate-500">
              {includeLocal
                ? "Localhost sessions included · test/QA events still excluded"
                : "Internal/localhost/test events excluded"
              } · {fmt(internalCount)} filtered
              {timeAgo && <span className="ml-3 text-slate-600">Updated {timeAgo}</span>}
            </p>
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-black text-white hover:bg-white/10 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button
            onClick={() => {
              const next = !includeLocal;
              setIncludeLocal(next);
              void load(next);
            }}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-black transition-colors ${
              includeLocal
                ? "border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/15"
                : "border-white/10 bg-white/[0.05] text-slate-400 hover:text-white hover:bg-white/10"
            }`}
          >
            {includeLocal ? "Showing local sessions" : "Include local sessions"}
          </button>
        </header>

        {error && (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/[0.07] p-4 text-sm text-red-200">{error}</div>
        )}

        {/* Insight banner */}
        <AlertBanner insight={String(s.insight || "")} />

        {/* Top KPIs — 4 most important */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label="Unique visitors"
            value={fmt(visitors)}
            hint={`${fmt(active7d)} active last 7 days`}
            sparkData={uploadSpark}
            sparkColor="#6366f1"
          />
          <Kpi
            label="CV → Interview"
            value={`${uploadToStart}%`}
            hint={`${fmt(uploads)} uploads → ${fmt(started)} starts`}
            tone={uploadToStart >= 60 ? "good" : uploadToStart >= 35 ? "warn" : "danger"}
          />
          <Kpi
            label="Completion rate"
            value={`${completion}%`}
            hint={`${fmt(completed)} of ${fmt(started)} finished`}
            sparkData={completeSpark}
            sparkColor="#10b981"
            tone={completion >= 60 ? "good" : completion >= 35 ? "warn" : "danger"}
          />
          <Kpi
            label="Voice failure"
            value={`${voiceFailRate}%`}
            hint={`${fmt(s.voiceFailures)} failures / ${fmt(s.voiceStarts)} starts`}
            tone={voiceFailRate <= 8 ? "good" : voiceFailRate <= 20 ? "warn" : "danger"}
          />
        </div>

        {/* Secondary KPIs */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Signed-in users" value={fmt(signedIn)} hint={`${fmt(s.activeSignedInUsers7d)} active 7d · ${fmt(s.activeSignedInUsers30d)} active 30d`} />
          <Kpi label="CV uploads" value={fmt(uploads)} hint="Real production CVs" sparkData={uploadSpark} sparkColor="#22d3ee" />
          <Kpi label="Results viewed" value={fmt(results)} hint={`${completeToResults}% of completions`} sparkData={startSpark} sparkColor="#a78bfa" />
          <Kpi label="Upgrade intent" value={fmt(s.usageFeatureCounts?.upgrade_clicked)} hint="Upgrade button clicks" tone={n(s.usageFeatureCounts?.upgrade_clicked) > 0 ? "good" : "default"} />
        </div>

        {/* Conversion KPIs */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Upload → Interview</p>
            <p className="mt-2 text-3xl font-black text-white">{uploadToStart}%</p>
            <p className="mt-1 text-xs text-slate-400">Of people who upload a CV, how many start an interview</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Start → Complete</p>
            <p className={`mt-2 text-3xl font-black ${startToComplete >= 60 ? "text-emerald-400" : startToComplete >= 35 ? "text-amber-400" : "text-red-400"}`}>{startToComplete}%</p>
            <p className="mt-1 text-xs text-slate-400">Of interviews started, how many reach the end</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Complete → Results</p>
            <p className={`mt-2 text-3xl font-black ${completeToResults >= 70 ? "text-emerald-400" : "text-slate-300"}`}>{completeToResults}%</p>
            <p className="mt-1 text-xs text-slate-400">Of completions, how many view their full report</p>
          </div>
        </div>

        {/* Funnel */}
        <Section title="Conversion funnel" subtitle="Step-by-step drop-off with % from previous step" icon={<TrendingDown className="h-4 w-4" />} accent="text-blue-400">
          <FunnelBar stages={funnel} />
        </Section>

        {/* Roles + Recruiters + Traffic */}
        <div className="grid gap-5 xl:grid-cols-3">
          <Section title="Top roles" subtitle="Cleaned, deduplicated" icon={<BarChart3 className="h-4 w-4" />} accent="text-violet-400">
            <BarList rows={entries(s.roles)} empty="No role data yet." />
          </Section>
          <Section title="Recruiter usage" subtitle="Which persona gets picked most" icon={<Users className="h-4 w-4" />} accent="text-cyan-400">
            <BarList rows={entries(s.recruiters)} empty="No recruiter data yet." />
          </Section>
          <Section title="Traffic sources" subtitle="Acquisition channel breakdown" icon={<ArrowUpRight className="h-4 w-4" />} accent="text-emerald-400">
            <BarList rows={entries(s.trafficSources)} empty="No source data yet." />
          </Section>
        </div>

        {/* Plan breakdown */}
        <Section title="Plan performance" subtitle="Completion rate, trust scores, and activity by plan tier" icon={<Zap className="h-4 w-4" />} accent="text-amber-400">
          <PlanTable planBreakdown={planBreakdown} />
        </Section>

        {/* Weaknesses + Voice health */}
        <div className="grid gap-5 xl:grid-cols-2">
          <Section title="Candidate weaknesses" subtitle="Most common signals that lowered recruiter trust — use to improve coaching" icon={<Brain className="h-4 w-4" />} accent="text-rose-400">
            {weakSignalRows.length ? (
              <div className="space-y-2">
                {weakSignalRows.map(([label, count], i) => (
                  <div key={label} className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
                    <span className="mt-0.5 text-[11px] font-black text-slate-600 w-4 shrink-0">{i + 1}</span>
                    <span className="flex-1 text-sm text-slate-300">{label}</span>
                    <span className="text-sm font-black text-white">{count}×</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-slate-500 italic">No weakness signals tracked yet.</p>}
          </Section>

          <Section title="Voice health" subtitle="Vapi reliability and fallback metrics" icon={<Mic className="h-4 w-4" />} accent="text-sky-400">
            <div className="grid grid-cols-2 gap-3">
              <Kpi label="Voice starts" value={fmt(s.voiceStarts)} />
              <Kpi label="Voice failures" value={fmt(s.voiceFailures)} tone={voiceFailRate <= 8 ? "good" : voiceFailRate <= 20 ? "warn" : "danger"} />
              <Kpi label="Vapi failures" value={fmt((s.counts as AnyRecord)?.vapi_connection_failed)} />
              <Kpi label="Speech errors" value={fmt((s.counts as AnyRecord)?.speech_recognition_error)} />
              <Kpi label="Voice paused" value={fmt(s.voicePaused)} />
              <Kpi label="Voice recovered" value={fmt(s.voiceRecovered)} tone={n(s.voiceRecovered) > 0 ? "good" : "default"} />
            </div>
          </Section>
        </div>

        {/* Activity feed */}
        <Section title="Live activity" subtitle="Recent production events — 40 most recent" icon={<Eye className="h-4 w-4" />} accent="text-slate-400">
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[700px] text-sm border-collapse">
              <thead>
                <tr className="bg-white/[0.04] border-b border-white/10">
                  {["Time", "Event", "Role", "Recruiter", "Score", "Trust", "Source"].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentRows.map((ev, i) => {
                  const isKey = ["interview_started", "interview_completed", "cv_uploaded", "results_viewed"].includes(String(ev.event));
                  return (
                    <tr key={i} className={`border-t border-white/[0.05] ${isKey ? "bg-white/[0.02]" : ""}`}>
                      <td className="px-3 py-2 text-[11px] text-slate-500 whitespace-nowrap">
                        {ev.timestamp ? new Date(String(ev.timestamp)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                      <td className={`px-3 py-2 font-black whitespace-nowrap ${isKey ? "text-cyan-300" : "text-slate-300"}`}>
                        {cleanEvt(String(ev.event || ""))}
                      </td>
                      <td className="px-3 py-2 text-slate-400 max-w-[140px] truncate" title={String(ev.role || "")}>{String(ev.role || "—")}</td>
                      <td className="px-3 py-2 text-slate-400">{String(ev.recruiter || "—")}</td>
                      <td className="px-3 py-2 text-slate-300">{ev.score != null ? String(ev.score) : "—"}</td>
                      <td className="px-3 py-2 text-slate-300">{ev.trust != null ? String(ev.trust) : "—"}</td>
                      <td className="px-3 py-2 text-[11px] text-slate-500 max-w-[120px] truncate">{String(ev.source || "Direct")}</td>
                    </tr>
                  );
                })}
                {!recentRows.length && (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-600">No production activity yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Dev section */}
        <Section title="Developer" subtitle="Raw event counts and plan breakdown" icon={<Zap className="h-4 w-4" />} accent="text-slate-600">
          <button onClick={() => setShowDev(v => !v)} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-black text-slate-400 hover:text-white transition-colors">
            {showDev ? "Hide" : "Show"} raw event counts
          </button>
          {showDev && (
            <div className="mt-4 grid gap-5 xl:grid-cols-2">
              <div>
                <p className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-slate-600">All event types</p>
                <BarList rows={entries(s.counts)} max={16} />
              </div>
              <div>
                <p className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-slate-600">Feature usage (signed-in)</p>
                <BarList rows={entries(s.usageFeatureCounts)} max={12} />
              </div>
            </div>
          )}
        </Section>

      </div>
    </main>
  );
}
