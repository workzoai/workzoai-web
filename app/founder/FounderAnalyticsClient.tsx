"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Brain,
  CheckCircle2,
  Clock,
  CreditCard,
  Database,
  Eye,
  FileText,
  Globe2,
  Mic,
  MousePointerClick,
  RefreshCw,
  Rocket,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Upload,
  Users,
  Zap,
} from "lucide-react";

type FunnelStage = { stage: string; count: number };
type ModePerformance = { starts: number; completions: number; voiceFailures: number; results: number; avgTrust: number | null };
type PlanPerformance = {
  sessions: number;
  uploads: number;
  interviewsStarted: number;
  completedInterviews: number;
  resultsViewed: number;
  voiceFailures: number;
  completionRate: number;
  avgTrust: number | null;
};
type AnalyticsEvent = {
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
};
type AnalyticsResponse = {
  ok?: boolean;
  configured?: boolean;
  reason?: string;
  summary: {
    totalEvents: number;
    productionEvents?: number;
    internalEvents?: number;
    internalTestEvents?: number;
    devTestEvents?: number;
    totalUniqueVisitors?: number;
    uniqueVisitors?: number;
    activeVisitors7d?: number;
    activeVisitors30d?: number;
    signedInUsers?: number;
    activeSignedInUsers7d?: number;
    activeSignedInUsers30d?: number;
    totalUsageEvents?: number;
    usageFeatureCounts?: Record<string, number>;
    usagePlanCounts?: Record<string, number>;
    usageConfigured?: boolean;
    usageReason?: string;
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
    planBreakdown: Record<string, PlanPerformance>;
    topWeakness: string;
    insight: string;
  };
  metrics?: Record<string, unknown>;
  events: AnalyticsEvent[];
};

const emptyData: AnalyticsResponse = {
  ok: true,
  configured: false,
  summary: {
    totalEvents: 0,
    productionEvents: 0,
    internalEvents: 0,
    internalTestEvents: 0,
    devTestEvents: 0,
    totalUniqueVisitors: 0,
    uniqueVisitors: 0,
    activeVisitors7d: 0,
    activeVisitors30d: 0,
    signedInUsers: 0,
    activeSignedInUsers7d: 0,
    activeSignedInUsers30d: 0,
    totalUsageEvents: 0,
    usageFeatureCounts: {},
    usagePlanCounts: {},
    usageConfigured: false,
    usageReason: "",
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
    planBreakdown: {},
    topWeakness: "Not enough data yet",
    insight: "No analytics collected yet.",
  },
  events: [],
};

type Tone = "blue" | "green" | "amber" | "red" | "violet";

function safeNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function percent(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function shortDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function entries(data?: Record<string, number>, limit = 8) {
  return Object.entries(data || {})
    .filter(([label]) => label && label !== "Unknown")
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function toneClass(tone: Tone) {
  switch (tone) {
    case "green": return "border-emerald-300/20 bg-emerald-400/[0.07] text-emerald-100";
    case "amber": return "border-amber-300/20 bg-amber-400/[0.07] text-amber-100";
    case "red": return "border-red-300/20 bg-red-400/[0.07] text-red-100";
    case "violet": return "border-violet-300/20 bg-violet-400/[0.07] text-violet-100";
    default: return "border-cyan-300/20 bg-cyan-400/[0.07] text-cyan-100";
  }
}

function KpiCard({ label, value, helper, icon, tone = "blue" }: { label: string; value: string | number; helper?: string; icon: React.ReactNode; tone?: Tone }) {
  return (
    <div className={`rounded-2xl border p-4 shadow-[0_18px_60px_rgba(0,0,0,0.24)] ${toneClass(tone)}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
        <span className="text-current opacity-90">{icon}</span>
      </div>
      <p className="mt-3 text-3xl font-black tracking-tight text-white">{value}</p>
      {helper && <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">{helper}</p>}
    </div>
  );
}

function Section({ title, subtitle, icon, children }: { title: string; subtitle?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.035] p-5 shadow-[0_22px_80px_rgba(0,0,0,0.26)] backdrop-blur-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {icon && <span className="text-cyan-200">{icon}</span>}
            <h2 className="text-xl font-black tracking-tight text-white">{title}</h2>
          </div>
          {subtitle && <p className="mt-1 text-sm leading-6 text-slate-400">{subtitle}</p>}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function BarList({ data, empty = "No data yet." }: { data: Array<[string, number]>; empty?: string }) {
  const max = Math.max(...data.map(([, value]) => value), 1);
  if (!data.length) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <div className="space-y-3">
      {data.map(([label, value]) => (
        <div key={label}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-bold text-slate-200">{label}</span>
            <span className="font-black text-white">{value}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.07]">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500" style={{ width: `${Math.max(5, (value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Funnel({ stages }: { stages: FunnelStage[] }) {
  if (!stages.length) return <p className="text-sm text-slate-500">No funnel data yet.</p>;
  const max = Math.max(...stages.map((stage) => stage.count), 1);
  return (
    <div className="space-y-3">
      {stages.map((stage, index) => {
        const previous = index > 0 ? stages[index - 1]?.count || 0 : stage.count;
        const conversion = index === 0 ? 100 : percent(stage.count, previous);
        const drop = index === 0 ? 0 : Math.max(0, 100 - conversion);
        return (
          <div key={stage.stage} className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-white">{stage.stage}</p>
                <p className="mt-0.5 text-xs text-slate-500">{index === 0 ? "Entry stage" : `${conversion}% continued • ${drop}% drop-off`}</p>
              </div>
              <p className="text-2xl font-black text-white">{stage.count}</p>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/[0.07]">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500" style={{ width: `${Math.max(4, (stage.count / max) * 100)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AlertBox({ tone, title, text }: { tone: Tone; title: string; text: string }) {
  return (
    <div className={`rounded-2xl border p-4 ${toneClass(tone)}`}>
      <p className="text-sm font-black text-white">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-300">{text}</p>
    </div>
  );
}

function Table({ children }: { children: React.ReactNode }) {
  return <div className="overflow-auto rounded-2xl border border-white/10 bg-black/20">{children}</div>;
}

export default function FounderAnalyticsClient() {
  const [data, setData] = useState<AnalyticsResponse>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams(window.location.search);
      const secret = params.get("secret");
      const url = secret ? `/api/analytics?secret=${encodeURIComponent(secret)}` : "/api/analytics";
      const response = await fetch(url, { cache: "no-store" });
      const json = (await response.json()) as AnalyticsResponse;
      if (!response.ok || json?.ok === false) throw new Error(json?.reason || "Unable to load analytics");
      setData(json?.summary ? json : emptyData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load analytics");
      setData(emptyData);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const s = data.summary;
  const visitors = safeNumber(s.uniqueVisitors ?? s.totalUniqueVisitors);
  const productionEvents = safeNumber(s.productionEvents ?? s.totalEvents);
  const internalEvents = safeNumber(s.internalEvents ?? s.internalTestEvents ?? s.devTestEvents);
  const uploadRate = percent(s.uploads, visitors);
  const startRate = percent(s.interviewsStarted, visitors);
  const completionRate = safeNumber(s.completionRate);
  const resultRate = safeNumber(s.resultRate);
  const voiceFailureRate = safeNumber(s.voiceFailureRate);
  const upgradeClicks = safeNumber(s.usageFeatureCounts?.upgrade_clicked ?? s.counts?.upgrade_clicked);
  const paidEvents = safeNumber((s.usagePlanCounts?.premium || 0) + (s.usagePlanCounts?.premium_pro || 0));
  const freeEvents = safeNumber(s.usagePlanCounts?.free || 0);

  const topSources = useMemo(() => entries(s.trafficSources, 7), [s.trafficSources]);
  const topRoles = useMemo(() => entries(s.roles, 8), [s.roles]);
  const topRecruiters = useMemo(() => entries(s.recruiters, 8), [s.recruiters]);
  const topWeakSignals = useMemo(() => entries(s.weakSignals, 8), [s.weakSignals]);
  const topEvents = useMemo(() => entries(s.counts, 10), [s.counts]);
  const modeRows = useMemo(() => Object.entries(s.modePerformance || {}).sort((a, b) => b[1].starts - a[1].starts), [s.modePerformance]);
  const planRows = useMemo(() => Object.entries(s.planBreakdown || {}).sort((a, b) => b[1].sessions - a[1].sessions), [s.planBreakdown]);
  const liveEvents = useMemo(() => (data.events || []).slice(0, 20), [data.events]);

  const alerts = useMemo(() => {
    const rows: Array<{ tone: Tone; title: string; text: string }> = [];
    if (resultRate === 0 && s.completedInterviews > 0) rows.push({ tone: "red", title: "Results tracking is broken", text: `${s.completedInterviews} completed interviews but ${s.resultsViewed} result views. Fire results_viewed on the results page.` });
    if (s.interviewsStarted > s.uploads * 5 && s.uploads > 0) rows.push({ tone: "amber", title: "Funnel is inflated by repeat/test sessions", text: `${s.interviewsStarted} starts vs ${s.uploads} CV uploads. Deduplicate by visitor/session for conversion.` });
    if (voiceFailureRate > 10) rows.push({ tone: "red", title: "Voice reliability needs attention", text: `Voice failure rate is ${voiceFailureRate}%. Review Vapi errors and fallback events.` });
    if (!rows.length) rows.push({ tone: "green", title: "Analytics are healthy", text: "No urgent tracking issue detected from the current event summary." });
    return rows;
  }, [resultRate, s.completedInterviews, s.resultsViewed, s.interviewsStarted, s.uploads, voiceFailureRate]);

  return (
    <main className="min-h-screen bg-[#020712] px-4 py-5 text-white sm:px-6">
      <div className="mx-auto max-w-[1500px]">
        <header className="sticky top-0 z-20 rounded-2xl border border-white/10 bg-[#050a16]/90 p-4 shadow-[0_18px_80px_rgba(0,0,0,0.32)] backdrop-blur-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-black text-slate-200 hover:bg-white/[0.08]">
              <ArrowLeft className="h-4 w-4" /> Home
            </Link>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-emerald-300/20 bg-emerald-400/[0.08] px-3 py-1.5 text-xs font-black text-emerald-200">
                Production: {productionEvents}
              </span>
              <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-black text-white hover:bg-blue-400">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
              </button>
            </div>
          </div>
        </header>

        <section className="mt-5 rounded-[32px] border border-white/10 bg-gradient-to-br from-blue-600/18 via-white/[0.045] to-cyan-400/10 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.42)] sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Founder control center</p>
              <h1 className="mt-2 text-4xl font-black tracking-tight text-white sm:text-5xl">WorkZo Analytics</h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
                A clean founder dashboard for growth, funnel conversion, interview quality, voice reliability, plans, and live product health.
              </p>
            </div>
            <div className="rounded-2xl border border-cyan-200/10 bg-black/20 p-4 text-right">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Last refreshed</p>
              <p className="mt-1 text-sm font-black text-white">{new Date().toLocaleTimeString()}</p>
            </div>
          </div>

          {error && <div className="mt-5 rounded-2xl border border-red-300/20 bg-red-400/[0.08] p-4 text-sm text-red-100">{error}</div>}

          <div className="mt-5 rounded-2xl border border-cyan-200/10 bg-cyan-300/[0.045] p-4">
            <div className="flex items-start gap-3">
              <Brain className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" />
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-200">Founder insight</p>
                <p className="mt-2 text-sm leading-6 text-slate-200">{s.insight}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard label="Visitors" value={visitors} helper={`${s.activeVisitors7d ?? 0} active in 7d`} icon={<Users className="h-5 w-5" />} />
          <KpiCard label="CV uploads" value={s.uploads} helper={`${uploadRate}% of visitors`} icon={<Upload className="h-5 w-5" />} tone="violet" />
          <KpiCard label="Interviews" value={s.interviewsStarted} helper={`${startRate}% visitor → start`} icon={<Rocket className="h-5 w-5" />} />
          <KpiCard label="Completion" value={`${completionRate}%`} helper={`${s.completedInterviews} completed`} icon={<CheckCircle2 className="h-5 w-5" />} tone={completionRate >= 60 ? "green" : completionRate >= 35 ? "amber" : "red"} />
          <KpiCard label="Results viewed" value={`${resultRate}%`} helper={`${s.resultsViewed} result views`} icon={<Eye className="h-5 w-5" />} tone={resultRate > 40 ? "green" : resultRate > 0 ? "amber" : "red"} />
          <KpiCard label="Signed-in users" value={s.signedInUsers ?? 0} helper={`${s.activeSignedInUsers30d ?? 0} active 30d`} icon={<ShieldCheck className="h-5 w-5" />} tone="green" />
          <KpiCard label="Upgrade clicks" value={upgradeClicks} helper="Upgrade intent" icon={<MousePointerClick className="h-5 w-5" />} tone="amber" />
          <KpiCard label="Paid activity" value={paidEvents} helper={`${freeEvents} free events`} icon={<CreditCard className="h-5 w-5" />} tone="green" />
          <KpiCard label="Voice failure" value={`${voiceFailureRate}%`} helper={`${s.voiceFailures} failures`} icon={<Mic className="h-5 w-5" />} tone={voiceFailureRate > 10 ? "red" : voiceFailureRate > 3 ? "amber" : "green"} />
          <KpiCard label="Internal tests" value={internalEvents} helper="Excluded from production" icon={<Database className="h-5 w-5" />} tone={internalEvents > 0 ? "amber" : "green"} />
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-3">
          {alerts.map((alert) => <AlertBox key={alert.title} tone={alert.tone} title={alert.title} text={alert.text} />)}
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
          <Section title="Conversion funnel" subtitle="Clean step-by-step view of where people drop off." icon={<TrendingDown className="h-5 w-5" />}>
            <Funnel stages={s.dropoffFunnel || []} />
          </Section>
          <Section title="Acquisition" subtitle="Which channels bring users into WorkZo." icon={<Globe2 className="h-5 w-5" />}>
            <BarList data={topSources} empty="No traffic source data yet." />
          </Section>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-3">
          <Section title="AI answer weaknesses" subtitle="Use this to improve coaching and feedback." icon={<Brain className="h-5 w-5" />}>
            <BarList data={topWeakSignals} empty="No weakness data yet." />
          </Section>
          <Section title="Recruiter usage" subtitle="Which interviewer persona users choose most." icon={<Users className="h-5 w-5" />}>
            <BarList data={topRecruiters} empty="No recruiter data yet." />
          </Section>
          <Section title="Top roles" subtitle="What your users are practicing for." icon={<FileText className="h-5 w-5" />}>
            <BarList data={topRoles} empty="No role data yet." />
          </Section>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-2">
          <Section title="Interview modes" subtitle="Starts, completions, results, voice failures, and trust by mode." icon={<Activity className="h-5 w-5" />}>
            <Table>
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-slate-500">
                  <tr><th className="p-3">Mode</th><th className="p-3">Starts</th><th className="p-3">Completed</th><th className="p-3">Results</th><th className="p-3">Voice fail</th><th className="p-3">Trust</th></tr>
                </thead>
                <tbody>
                  {modeRows.length ? modeRows.map(([mode, row]) => (
                    <tr key={mode} className="border-b border-white/5 last:border-0">
                      <td className="p-3 font-black text-white capitalize">{mode}</td>
                      <td className="p-3 text-slate-300">{row.starts}</td>
                      <td className="p-3 text-slate-300">{row.completions}</td>
                      <td className="p-3 text-slate-300">{row.results}</td>
                      <td className="p-3 text-slate-300">{row.voiceFailures}</td>
                      <td className="p-3 text-slate-300">{row.avgTrust ?? "—"}</td>
                    </tr>
                  )) : <tr><td colSpan={6} className="p-4 text-slate-500">No mode data yet.</td></tr>}
                </tbody>
              </table>
            </Table>
          </Section>

          <Section title="Plan performance" subtitle="Free vs Premium vs Premium Pro behavior." icon={<CreditCard className="h-5 w-5" />}>
            <Table>
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-slate-500">
                  <tr><th className="p-3">Plan</th><th className="p-3">Sessions</th><th className="p-3">Uploads</th><th className="p-3">Starts</th><th className="p-3">Completed</th><th className="p-3">Completion</th></tr>
                </thead>
                <tbody>
                  {planRows.length ? planRows.map(([plan, row]) => (
                    <tr key={plan} className="border-b border-white/5 last:border-0">
                      <td className="p-3 font-black text-white capitalize">{plan.replace("_", " ")}</td>
                      <td className="p-3 text-slate-300">{row.sessions}</td>
                      <td className="p-3 text-slate-300">{row.uploads}</td>
                      <td className="p-3 text-slate-300">{row.interviewsStarted}</td>
                      <td className="p-3 text-slate-300">{row.completedInterviews}</td>
                      <td className="p-3 text-slate-300">{row.completionRate}%</td>
                    </tr>
                  )) : <tr><td colSpan={6} className="p-4 text-slate-500">No plan data yet.</td></tr>}
                </tbody>
              </table>
            </Table>
          </Section>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
          <Section title="Event health" subtitle="Raw event categories, grouped cleanly." icon={<Zap className="h-5 w-5" />}>
            <BarList data={topEvents} empty="No events yet." />
          </Section>

          <Section title="Live activity" subtitle="Recent production activity without the raw JSON clutter." icon={<Clock className="h-5 w-5" />}>
            <div className="space-y-2">
              {liveEvents.length ? liveEvents.map((event, index) => (
                <div key={`${event.sessionId}-${event.receivedAt}-${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-black text-white">{event.event.replaceAll("_", " ")}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{event.source || "Direct"} • {event.path || "/"} {event.role ? `• ${event.role}` : ""}</p>
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    <p>{shortDate(event.receivedAt || event.timestamp)}</p>
                    {event.recruiter && <p className="mt-0.5">{event.recruiter}</p>}
                  </div>
                </div>
              )) : <p className="text-sm text-slate-500">No live events yet.</p>}
            </div>
          </Section>
        </section>

        <section className="mt-5 rounded-[28px] border border-white/10 bg-white/[0.035] p-5 shadow-[0_22px_80px_rgba(0,0,0,0.26)]">
          <details>
            <summary className="cursor-pointer text-sm font-black uppercase tracking-[0.18em] text-slate-400">Developer raw JSON</summary>
            <pre className="mt-4 max-h-[420px] overflow-auto rounded-2xl bg-black/40 p-4 text-xs leading-5 text-slate-300">
              {JSON.stringify({ summary: s, events: liveEvents.slice(0, 5) }, null, 2)}
            </pre>
          </details>
        </section>
      </div>
    </main>
  );
}
