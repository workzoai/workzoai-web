"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Brain,
  CheckCircle2,
  Mic,
  RefreshCw,
  TrendingDown,
  Upload,
  Users,
  Zap,
} from "lucide-react";

type FunnelStage = { stage: string; count: number };
type ModePerformance = { starts: number; completions: number; voiceFailures: number; results: number; avgTrust: number | null };

type AnalyticsResponse = {
  ok?: boolean;
  configured?: boolean;
  reason?: string;
  error?: string;
  summary: {
    totalEvents: number;
    productionEvents?: number;
    totalUniqueVisitors?: number;
    uniqueVisitorsAllTime?: number;
    uniqueSessions: number;
    uploads: number;
    interviewsStarted: number;
    answersSubmitted: number;
    voiceStarts: number;
    voiceFailures: number;
    voicePaused: number;
    voiceRecovered: number;
    completedInterviews: number;
    resultsViewed: number;
    answerRate: number;
    resultRate: number;
    completionRate: number;
    voiceFailureRate: number;
    counts: Record<string, number>;
    recruiters: Record<string, number>;
    roles: Record<string, number>;
    modes: Record<string, number>;
    trafficSources: Record<string, number>;
    weakSignals: Record<string, number>;
    dropoffFunnel: FunnelStage[];
    modePerformance: Record<string, ModePerformance>;
    topWeakness: string;
    insight: string;
  };
  events: Array<{
    event: string;
    sessionId: string;
    visitorId?: string;
    role: string;
    market: string;
    recruiter: string;
    mode: string;
    score: number | null;
    trust: number | null;
    pressure: number | null;
    path: string;
    source: string;
    timestamp: string;
    receivedAt: string;
    metadata?: Record<string, unknown>;
  }>;
};

const emptyData: AnalyticsResponse = {
  ok: true,
  configured: false,
  summary: {
    totalEvents: 0,
    productionEvents: 0,
    totalUniqueVisitors: 0,
    uniqueVisitorsAllTime: 0,
    uniqueSessions: 0,
    uploads: 0,
    interviewsStarted: 0,
    answersSubmitted: 0,
    voiceStarts: 0,
    voiceFailures: 0,
    voicePaused: 0,
    voiceRecovered: 0,
    completedInterviews: 0,
    resultsViewed: 0,
    answerRate: 0,
    resultRate: 0,
    completionRate: 0,
    voiceFailureRate: 0,
    counts: {},
    recruiters: {},
    roles: {},
    modes: {},
    trafficSources: {},
    weakSignals: {},
    dropoffFunnel: [],
    modePerformance: {},
    topWeakness: "Not enough data yet",
    insight: "No analytics collected yet.",
  },
  events: [],
};

function normalizeAnalyticsResponse(json: any): AnalyticsResponse {
  if (json?.summary) {
    return {
      ...emptyData,
      ...json,
      summary: { ...emptyData.summary, ...json.summary },
      events: Array.isArray(json.events) ? json.events : [],
    };
  }

  if (json?.metrics) {
    return {
      ...emptyData,
      ok: json.ok,
      configured: json.configured,
      reason: json.reason,
      error: json.error,
      summary: {
        ...emptyData.summary,
        totalEvents: json.metrics.totalEvents || 0,
        productionEvents: json.metrics.productionEvents || json.metrics.totalEvents || 0,
        totalUniqueVisitors: json.metrics.totalUniqueVisitors || 0,
        uniqueVisitorsAllTime: json.metrics.uniqueVisitorsAllTime || json.metrics.totalUniqueVisitors || 0,
        uniqueSessions: json.metrics.uniqueSessions || 0,
        uploads: json.metrics.cvUploads || json.metrics.uploads || 0,
        interviewsStarted: json.metrics.interviewsStarted || json.metrics.interviewStarts || 0,
        completedInterviews: json.metrics.completed || json.metrics.interviewCompletions || 0,
        resultsViewed: json.metrics.resultsViewed || 0,
        completionRate: json.metrics.completionRate || 0,
        resultRate: json.metrics.resultViewRate || 0,
        answerRate: json.metrics.answerRate || 0,
        voiceFailureRate: json.metrics.voiceFailureRate || 0,
        insight: json.metrics.totalEvents ? "Live Supabase analytics are connected." : "Supabase analytics are connected, but no events have been collected yet.",
      },
      events: [],
    };
  }

  return { ...emptyData, ok: json?.ok, configured: json?.configured, reason: json?.reason, error: json?.error };
}

function StatCard({ label, value, icon, tone = "default" }: { label: string; value: string | number; icon: React.ReactNode; tone?: "default" | "good" | "warn" | "danger" }) {
  const toneClass =
    tone === "good" ? "from-emerald-500/12 to-cyan-400/8 text-emerald-200" :
    tone === "warn" ? "from-amber-500/14 to-orange-400/8 text-amber-200" :
    tone === "danger" ? "from-red-500/14 to-pink-400/8 text-red-200" :
    "from-blue-500/12 to-violet-500/8 text-cyan-200";

  return (
    <div className={`rounded-[24px] border border-white/10 bg-gradient-to-br ${toneClass} p-4 shadow-[0_18px_70px_rgba(0,0,0,0.22)]`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{label}</p>
        <div>{icon}</div>
      </div>
      <p className="mt-3 text-3xl font-black text-white">{value}</p>
    </div>
  );
}

function SortList({ title, data, empty }: { title: string; data: Array<[string, number]>; empty: string }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.28)]">
      <h2 className="text-xl font-black">{title}</h2>
      <div className="mt-4 space-y-2">
        {data.length ? data.map(([label, count]) => (
          <div key={label} className="flex justify-between gap-3 rounded-2xl bg-white/[0.04] p-3 text-sm">
            <span className="truncate text-slate-200">{label}</span><b>{count}</b>
          </div>
        )) : <p className="text-sm text-slate-500">{empty}</p>}
      </div>
    </div>
  );
}

function completionTone(value: number): "good" | "warn" | "danger" {
  if (value >= 60) return "good";
  if (value >= 35) return "warn";
  return "danger";
}

export default function FounderAnalyticsPage() {
  const [data, setData] = useState<AnalyticsResponse>(emptyData);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/analytics", { cache: "no-store", headers: { "Cache-Control": "no-store" } });
      const json = await response.json();
      setData(normalizeAnalyticsResponse(json));
    } catch (error) {
      setData({ ...emptyData, summary: { ...emptyData.summary, insight: error instanceof Error ? error.message : "Could not load analytics." } });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const topRoles = useMemo(() => Object.entries(data.summary.roles || {}).sort((a, b) => b[1] - a[1]).slice(0, 8), [data.summary.roles]);
  const topRecruiters = useMemo(() => Object.entries(data.summary.recruiters || {}).sort((a, b) => b[1] - a[1]).slice(0, 8), [data.summary.recruiters]);
  const topSources = useMemo(() => Object.entries(data.summary.trafficSources || {}).sort((a, b) => b[1] - a[1]).slice(0, 8), [data.summary.trafficSources]);
  const topWeakSignals = useMemo(() => Object.entries(data.summary.weakSignals || {}).sort((a, b) => b[1] - a[1]).slice(0, 8), [data.summary.weakSignals]);
  const modeRows = useMemo(() => Object.entries(data.summary.modePerformance || {}).sort((a, b) => b[1].starts - a[1].starts), [data.summary.modePerformance]);
  const maxFunnel = Math.max(...data.summary.dropoffFunnel.map((item) => item.count), 1);

  return (
    <main className="min-h-screen bg-[#020712] px-4 py-5 text-white sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/[0.045] p-4 backdrop-blur-2xl">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-black text-slate-200"><ArrowLeft className="h-4 w-4" />Dashboard</Link>
          <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2 text-sm font-black"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</button>
        </header>

        <section className="mt-5 rounded-[32px] border border-white/10 bg-gradient-to-br from-blue-600/18 via-white/[0.045] to-cyan-400/10 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.42)] sm:p-8">
          <div className="flex items-center gap-3"><BarChart3 className="h-7 w-7 text-cyan-200" /><h1 className="text-3xl font-black tracking-tight sm:text-5xl">Founder analytics</h1></div>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">Tracks launch readiness, funnel drop-off, voice stability, recruiter usage, weak answer patterns, and traffic sources.</p>
          <div className="mt-5 rounded-3xl border border-cyan-200/10 bg-cyan-300/[0.045] p-4">
            <div className="flex items-start gap-3"><Brain className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" /><div><p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-200">Founder insight</p><p className="mt-2 text-sm leading-6 text-slate-200">{data.summary.insight}</p>{data.reason || data.error ? <p className="mt-2 text-xs text-amber-200">{data.reason ? `Reason: ${data.reason}` : ""} {data.error ? `Error: ${data.error}` : ""}</p> : null}</div></div>
          </div>
        </section>

        <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="All-time visitors" value={data.summary.totalUniqueVisitors || data.summary.uniqueVisitorsAllTime || 0} icon={<Users className="h-5 w-5" />} />
          <StatCard label="Sessions" value={data.summary.uniqueSessions} icon={<Users className="h-5 w-5" />} />
          <StatCard label="Production events" value={data.summary.productionEvents || data.summary.totalEvents} icon={<Activity className="h-5 w-5" />} />
          <StatCard label="CV uploads" value={data.summary.uploads} icon={<Upload className="h-5 w-5" />} />
          <StatCard label="Interviews" value={data.summary.interviewsStarted} icon={<Activity className="h-5 w-5" />} />
          <StatCard label="Completions" value={`${data.summary.completionRate}%`} icon={<CheckCircle2 className="h-5 w-5" />} tone={completionTone(data.summary.completionRate)} />
          <StatCard label="Voice starts" value={data.summary.voiceStarts} icon={<Mic className="h-5 w-5" />} />
          <StatCard label="Voice failure" value={`${data.summary.voiceFailureRate}%`} icon={<AlertTriangle className="h-5 w-5" />} tone={data.summary.voiceFailureRate > 20 ? "danger" : data.summary.voiceFailureRate > 8 ? "warn" : "good"} />
          <StatCard label="Answer rate" value={`${data.summary.answerRate}%`} icon={<Zap className="h-5 w-5" />} tone={completionTone(data.summary.answerRate)} />
          <StatCard label="Results rate" value={`${data.summary.resultRate}%`} icon={<BarChart3 className="h-5 w-5" />} tone={completionTone(data.summary.resultRate)} />
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.28)]">
            <div className="flex items-center gap-2"><TrendingDown className="h-5 w-5 text-amber-200" /><h2 className="text-xl font-black">Drop-off funnel</h2></div>
            <div className="mt-5 space-y-4">
              {data.summary.dropoffFunnel.length ? data.summary.dropoffFunnel.map((stage) => (
                <div key={stage.stage}><div className="mb-2 flex items-center justify-between text-sm"><span className="font-bold text-slate-200">{stage.stage}</span><span className="text-slate-400">{stage.count}</span></div><div className="h-3 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" style={{ width: `${Math.max(4, (stage.count / maxFunnel) * 100)}%` }} /></div></div>
              )) : <p className="text-sm text-slate-500">No funnel data yet.</p>}
            </div>
          </div>
          <SortList title="Weak answer signals" data={topWeakSignals} empty="No weakness data yet." />
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-3">
          <SortList title="Top roles" data={topRoles} empty="No role data yet." />
          <SortList title="Recruiter usage" data={topRecruiters} empty="No recruiter data yet." />
          <SortList title="Traffic sources" data={topSources} empty="No traffic-source data yet." />
        </section>

        <section className="mt-5 rounded-[28px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.28)]">
          <h2 className="text-xl font-black">Standard vs Live mode</h2>
          <div className="mt-4 overflow-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-xs uppercase tracking-[0.18em] text-slate-500"><tr><th className="p-3">Mode</th><th className="p-3">Starts</th><th className="p-3">Completions</th><th className="p-3">Results</th><th className="p-3">Voice failures</th><th className="p-3">Avg trust</th></tr></thead><tbody>{modeRows.length ? modeRows.map(([mode, row]) => (<tr key={mode} className="border-t border-white/10"><td className="p-3 font-black capitalize">{mode}</td><td className="p-3 text-slate-300">{row.starts}</td><td className="p-3 text-slate-300">{row.completions}</td><td className="p-3 text-slate-300">{row.results}</td><td className="p-3 text-slate-300">{row.voiceFailures}</td><td className="p-3 text-slate-300">{row.avgTrust ?? "—"}</td></tr>)) : <tr><td className="p-3 text-slate-500" colSpan={6}>No mode data yet.</td></tr>}</tbody></table></div>
        </section>

        <section className="mt-5 rounded-[28px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.28)]">
          <h2 className="text-xl font-black">Recent events</h2>
          <div className="mt-4 max-h-[520px] overflow-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="text-xs uppercase tracking-[0.18em] text-slate-500"><tr><th className="p-3">Event</th><th className="p-3">Role</th><th className="p-3">Recruiter</th><th className="p-3">Mode</th><th className="p-3">Source</th><th className="p-3">Trust</th><th className="p-3">Time</th></tr></thead><tbody>{data.events.slice(0, 120).map((event, index) => (<tr key={`${event.receivedAt}-${event.event}-${index}`} className="border-t border-white/10"><td className="p-3 font-black">{event.event}</td><td className="p-3 text-slate-300">{event.role}</td><td className="p-3 text-slate-300">{event.recruiter}</td><td className="p-3 text-slate-300">{event.mode}</td><td className="p-3 text-slate-300">{event.source}</td><td className="p-3 text-slate-300">{event.trust ?? ""}</td><td className="p-3 text-slate-500">{event.receivedAt ? new Date(event.receivedAt).toLocaleString() : ""}</td></tr>))}{!data.events.length ? <tr><td className="p-3 text-slate-500" colSpan={7}>No recent events yet.</td></tr> : null}</tbody></table></div>
        </section>
      </div>
    </main>
  );
}
