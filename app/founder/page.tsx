"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type AnalyticsEvent = {
  id?: number | string;
  session_id?: string | null;
  event?: string | null;
  path?: string | null;
  source?: string | null;
  device?: string | null;
  recruiter?: string | null;
  mode?: string | null;
  role?: string | null;
  market?: string | null;
  created_at?: string | null;
  timestamp?: string | null;
  metadata?: Record<string, unknown> | null;
};

type Summary = {
  totalEvents: number;
  uniqueSessions: number;
  interviewStarts: number;
  interviewCompleted: number;
  completionRate: number;
  mobileEvents: number;
  desktopEvents: number;
  tabletEvents: number;
  unknownDeviceEvents: number;
  mobileSessions: number;
  desktopSessions: number;
  tabletSessions: number;
  unknownDeviceSessions: number;
  recruiterCounts: Record<string, number>;
  eventCounts: Record<string, number>;
  errors: AnalyticsEvent[];
  dropOffSignals: AnalyticsEvent[];
};

type AnalyticsResponse = {
  success?: boolean;
  error?: string;
  details?: string;
  hint?: string;
  summary?: Partial<Summary>;
  stats?: Partial<Summary>;
  recentEvents?: AnalyticsEvent[];
  events?: AnalyticsEvent[];
  generatedAt?: string;
};

const EMPTY_SUMMARY: Summary = {
  totalEvents: 0,
  uniqueSessions: 0,
  interviewStarts: 0,
  interviewCompleted: 0,
  completionRate: 0,
  mobileEvents: 0,
  desktopEvents: 0,
  tabletEvents: 0,
  unknownDeviceEvents: 0,
  mobileSessions: 0,
  desktopSessions: 0,
  tabletSessions: 0,
  unknownDeviceSessions: 0,
  recruiterCounts: {},
  eventCounts: {},
  errors: [],
  dropOffSignals: [],
};

const FUNNEL_EVENTS = [
  ["landing_viewed", "Landing viewed"],
  ["onboarding_started", "Onboarding started"],
  ["cv_uploaded", "CV uploaded"],
  ["interview_room_viewed", "Interview room viewed"],
  ["interview_started", "Interview started"],
  ["interview_completed", "Interview completed"],
  ["results_viewed", "Results viewed"],
] as const;

function normalizeSummary(data: AnalyticsResponse | null): Summary {
  const raw = data?.summary || data?.stats || {};
  return {
    ...EMPTY_SUMMARY,
    ...raw,
    recruiterCounts: raw.recruiterCounts || {},
    eventCounts: raw.eventCounts || {},
    errors: Array.isArray(raw.errors) ? raw.errors : [],
    dropOffSignals: Array.isArray(raw.dropOffSignals) ? raw.dropOffSignals : [],
  };
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function FounderDashboard() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/analytics?ts=${Date.now()}`, {
        cache: "no-store",
      });
      const json = (await response.json().catch(() => ({}))) as AnalyticsResponse;
      setData(json);
      if (!json.success) {
        setErrorMessage(json.error || "Analytics API returned an error");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Analytics could not load");
      setData({ success: false, summary: EMPTY_SUMMARY, recentEvents: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const summary = useMemo(() => normalizeSummary(data), [data]);
  const recentEvents = Array.isArray(data?.recentEvents) ? data?.recentEvents || [] : [];
  const maxFunnel = Math.max(...FUNNEL_EVENTS.map(([key]) => summary.eventCounts[key] || 0), 1);

  return (
    <main className="min-h-screen bg-[#050816] px-4 py-6 text-white md:px-10">
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.45em] text-cyan-300">Founder Analytics</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">WorkZo AI Dashboard</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-blue-100/80 md:text-lg">
              Real launch analytics from Supabase: interviews, completion, devices, recruiters, errors, and recent activity.
            </p>
          </div>
          <button
            onClick={() => void loadAnalytics()}
            className="rounded-2xl border border-white/10 bg-white/10 px-6 py-4 font-black text-white shadow-lg transition hover:bg-white/15"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </section>

      {errorMessage && (
        <section className="mt-8 rounded-3xl border border-red-500/30 bg-red-950/30 p-6 text-red-100">
          <h2 className="font-black">Analytics API warning</h2>
          <p className="mt-2 text-sm text-red-100/80">{errorMessage}</p>
          {data?.hint && <p className="mt-2 text-xs text-red-100/60">Hint: {data.hint}</p>}
        </section>
      )}

      <section className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total Events" value={summary.totalEvents} />
        <StatCard label="Unique Sessions" value={summary.uniqueSessions} />
        <StatCard label="Interview Starts" value={summary.interviewStarts} />
        <StatCard label="Completed" value={summary.interviewCompleted} />
        <StatCard label="Completion Rate" value={`${summary.completionRate}%`} highlight />
        <StatCard label="Mobile Sessions" value={summary.mobileSessions} />
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.8fr]">
        <Panel title="Launch Funnel" subtitle="Track where users move through the product.">
          <div className="space-y-5">
            {FUNNEL_EVENTS.map(([key, label]) => {
              const count = summary.eventCounts[key] || 0;
              return <ProgressRow key={key} label={label} value={count} max={maxFunnel} />;
            })}
          </div>
        </Panel>

        <Panel title="Device Split" subtitle="Unique sessions by device. Event volume is shown in small text below each card.">
          <div className="grid grid-cols-2 gap-4">
            <MiniCard label="Desktop sessions" value={summary.desktopSessions} subvalue={`${summary.desktopEvents} events`} />
            <MiniCard label="Mobile sessions" value={summary.mobileSessions} subvalue={`${summary.mobileEvents} events`} />
            <MiniCard label="Tablet sessions" value={summary.tabletSessions} subvalue={`${summary.tabletEvents} events`} />
            <MiniCard label="Unknown sessions" value={summary.unknownDeviceSessions} subvalue={`${summary.unknownDeviceEvents} events`} />
          </div>
        </Panel>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-2">
        <Panel title="Recruiter Popularity" subtitle="Which recruiter users actually test.">
          {Object.keys(summary.recruiterCounts).length === 0 ? (
            <EmptyText>No recruiter data yet.</EmptyText>
          ) : (
            <div className="space-y-3">
              {Object.entries(summary.recruiterCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([name, count]) => (
                  <div key={name} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-4">
                    <span className="font-bold">{name}</span>
                    <span className="text-lg font-black text-cyan-200">{count}</span>
                  </div>
                ))}
            </div>
          )}
        </Panel>

        <Panel title="Recent Errors / Drop-off Signals" subtitle="Voice failures, fallbacks, interruptions and user exits.">
          {[...summary.errors, ...summary.dropOffSignals].length === 0 ? (
            <EmptyText>No errors or drop-off signals found.</EmptyText>
          ) : (
            <div className="space-y-3">
              {[...summary.errors, ...summary.dropOffSignals].slice(0, 10).map((event, index) => (
                <EventRow key={`${event.id || index}-${event.event}`} event={event} />
              ))}
            </div>
          )}
        </Panel>
      </section>

      <section className="mt-8">
        <Panel title="Recent Activity" subtitle="Latest events saved in Supabase.">
          {recentEvents.length === 0 ? (
            <EmptyText>No activity yet. Start and end an interview to verify tracking.</EmptyText>
          ) : (
            <div className="space-y-3">
              {recentEvents.slice(0, 30).map((event, index) => (
                <EventRow key={`${event.id || index}-${event.event}`} event={event} />
              ))}
            </div>
          )}
        </Panel>
      </section>
    </main>
  );
}

function StatCard({ label, value, highlight = false }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/20">
      <p className="text-xs font-black uppercase tracking-[0.35em] text-blue-200/70">{label}</p>
      <p className={`mt-5 text-4xl font-black ${highlight ? "text-emerald-300" : "text-white"}`}>{value}</p>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-black/20">
      <h2 className="text-2xl font-black">{title}</h2>
      <p className="mt-2 text-sm text-blue-100/70">{subtitle}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function ProgressRow({ label, value, max }: { label: string; value: number; max: number }) {
  const width = Math.max(2, Math.round((value / max) * 100));
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4 text-sm">
        <span className="text-blue-50">{label}</span>
        <span className="font-black text-white">{value}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function MiniCard({ label, value, subvalue }: { label: string; value: string | number; subvalue?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <p className="text-sm text-blue-100/80">{label}</p>
      <p className="mt-4 text-3xl font-black">{value}</p>
      {subvalue && <p className="mt-2 text-xs font-semibold text-blue-100/45">{subvalue}</p>}
    </div>
  );
}

function EventRow({ event }: { event: AnalyticsEvent }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-black text-white">{event.event || "unknown_event"}</p>
          <p className="mt-1 text-sm text-blue-100/60">{event.path || "/"}</p>
        </div>
        <div className="text-left text-xs text-blue-100/50 md:text-right">
          <p>{formatDate(event.created_at || event.timestamp)}</p>
          <p>{event.device || "unknown"} · {event.source || "Direct / unknown"}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-white/10 bg-black/20 p-5 text-blue-100/60">{children}</p>;
}
