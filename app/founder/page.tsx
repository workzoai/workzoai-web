"use client";

import { useEffect, useMemo, useState } from "react";

type AnalyticsEvent = {
  id?: number | string;
  session_id?: string;
  sessionId?: string;
  event?: string;
  path?: string;
  source?: string;
  device?: string;
  recruiter?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  timestamp?: string | number;
};

type Funnel = {
  landingViewed: number;
  onboardingStarted: number;
  cvUploaded: number;
  interviewStarted: number;
  interviewCompleted: number;
  resultsViewed: number;
};

type Summary = {
  totalEvents: number;
  uniqueSessions: number;
  interviewStarts: number;
  interviewCompleted: number;
  completionRate: number;
  mobileUsers: number;
  desktopUsers: number;
  tabletUsers: number;
  unknownDeviceUsers: number;
  recruiterCounts: Record<string, number>;
  recentErrors: AnalyticsEvent[];
  dropOffSignals: Record<string, number>;
  funnel: Funnel;
};

type ApiResponse = {
  success?: boolean;
  summary?: Partial<Summary>;
  stats?: Partial<Summary>;
  recentEvents?: AnalyticsEvent[];
  events?: AnalyticsEvent[];
  error?: unknown;
};

const EMPTY_FUNNEL: Funnel = {
  landingViewed: 0,
  onboardingStarted: 0,
  cvUploaded: 0,
  interviewStarted: 0,
  interviewCompleted: 0,
  resultsViewed: 0,
};

const EMPTY_SUMMARY: Summary = {
  totalEvents: 0,
  uniqueSessions: 0,
  interviewStarts: 0,
  interviewCompleted: 0,
  completionRate: 0,
  mobileUsers: 0,
  desktopUsers: 0,
  tabletUsers: 0,
  unknownDeviceUsers: 0,
  recruiterCounts: {},
  recentErrors: [],
  dropOffSignals: {},
  funnel: EMPTY_FUNNEL,
};

function mergeSummary(data: ApiResponse | null): Summary {
  const source = data?.summary || data?.stats || {};

  return {
    ...EMPTY_SUMMARY,
    ...source,
    recruiterCounts: source.recruiterCounts || {},
    recentErrors: Array.isArray(source.recentErrors) ? source.recentErrors : [],
    dropOffSignals: source.dropOffSignals || {},
    funnel: {
      ...EMPTY_FUNNEL,
      ...(source.funnel || {}),
    },
  };
}

function formatDate(value?: string | number) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function safeEventName(value?: string) {
  return value || "unknown_event";
}

export default function FounderDashboard() {
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [recentEvents, setRecentEvents] = useState<AnalyticsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAnalytics() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/analytics", {
        method: "GET",
        cache: "no-store",
      });

      const json: ApiResponse = await res.json();

      if (!res.ok || json.success === false) {
        throw new Error("Analytics API returned an error");
      }

      setSummary(mergeSummary(json));
      setRecentEvents(Array.isArray(json.recentEvents) ? json.recentEvents : Array.isArray(json.events) ? json.events : []);
    } catch (err) {
      setSummary(EMPTY_SUMMARY);
      setRecentEvents([]);
      setError(err instanceof Error ? err.message : "Unable to load analytics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics();
  }, []);

  const recruiterRows = useMemo(() => {
    return Object.entries(summary.recruiterCounts).sort((a, b) => b[1] - a[1]);
  }, [summary.recruiterCounts]);

  const dropOffRows = useMemo(() => {
    return Object.entries(summary.dropOffSignals).sort((a, b) => b[1] - a[1]);
  }, [summary.dropOffSignals]);

  return (
    <main className="min-h-screen bg-[#050713] px-4 py-6 text-white sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-blue-950/30 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.35em] text-cyan-300">Founder Analytics</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">WorkZo AI Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400 md:text-base">
              Real launch analytics from Supabase: interviews, completion, devices, recruiters, errors, and recent activity.
            </p>
          </div>

          <button
            onClick={loadAnalytics}
            className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-bold text-white hover:bg-white/15"
          >
            Refresh
          </button>
        </header>

        {error ? (
          <div className="mb-6 rounded-3xl border border-red-500/30 bg-red-500/10 p-5 text-red-100">
            <p className="font-bold">Analytics could not load.</p>
            <p className="mt-1 text-sm text-red-200/80">{error}</p>
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-slate-300">Loading analytics...</div>
        ) : (
          <>
            <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
              <StatCard label="Total Events" value={summary.totalEvents} />
              <StatCard label="Unique Sessions" value={summary.uniqueSessions} />
              <StatCard label="Interview Starts" value={summary.interviewStarts} />
              <StatCard label="Completed" value={summary.interviewCompleted} />
              <StatCard label="Completion Rate" value={`${summary.completionRate}%`} accent />
              <StatCard label="Mobile Events" value={summary.mobileUsers} />
            </section>

            <section className="mb-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <Panel title="Launch Funnel" subtitle="Track where users move through the product.">
                <div className="space-y-3">
                  <FunnelRow label="Landing viewed" value={summary.funnel.landingViewed} max={summary.totalEvents} />
                  <FunnelRow label="Onboarding started" value={summary.funnel.onboardingStarted} max={summary.totalEvents} />
                  <FunnelRow label="CV uploaded" value={summary.funnel.cvUploaded} max={summary.totalEvents} />
                  <FunnelRow label="Interview started" value={summary.funnel.interviewStarted} max={summary.totalEvents} />
                  <FunnelRow label="Interview completed" value={summary.funnel.interviewCompleted} max={summary.totalEvents} />
                  <FunnelRow label="Results viewed" value={summary.funnel.resultsViewed} max={summary.totalEvents} />
                </div>
              </Panel>

              <Panel title="Device Split" subtitle="Mobile polish decisions should come from this.">
                <div className="grid grid-cols-2 gap-3">
                  <MiniCard label="Desktop" value={summary.desktopUsers} />
                  <MiniCard label="Mobile" value={summary.mobileUsers} />
                  <MiniCard label="Tablet" value={summary.tabletUsers} />
                  <MiniCard label="Unknown" value={summary.unknownDeviceUsers} />
                </div>
              </Panel>
            </section>

            <section className="mb-6 grid gap-4 lg:grid-cols-2">
              <Panel title="Recruiter Popularity" subtitle="Which recruiter users interact with most.">
                {recruiterRows.length === 0 ? (
                  <EmptyText>No recruiter data yet.</EmptyText>
                ) : (
                  <div className="space-y-3">
                    {recruiterRows.map(([name, count]) => (
                      <div key={name} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-4">
                        <span className="font-bold">{name}</span>
                        <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-sm font-black text-emerald-300">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel title="Errors & Drop-off Signals" subtitle="Watch this during Product Hunt traffic.">
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-sm font-black uppercase tracking-[0.18em] text-slate-400">Recent errors</p>
                    {summary.recentErrors.length === 0 ? (
                      <EmptyText>No recent errors tracked.</EmptyText>
                    ) : (
                      <div className="space-y-2">
                        {summary.recentErrors.slice(0, 5).map((event, index) => (
                          <EventLine key={`${event.id || index}-error`} event={event} />
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-black uppercase tracking-[0.18em] text-slate-400">Drop-offs</p>
                    {dropOffRows.length === 0 ? (
                      <EmptyText>No drop-off signals yet.</EmptyText>
                    ) : (
                      <div className="space-y-2">
                        {dropOffRows.map(([name, count]) => (
                          <div key={name} className="flex justify-between rounded-xl bg-white/[0.04] px-4 py-3 text-sm">
                            <span>{name}</span>
                            <span className="font-bold text-amber-300">{count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Panel>
            </section>

            <Panel title="Recent Events" subtitle="Latest Supabase analytics rows.">
              {recentEvents.length === 0 ? (
                <EmptyText>No events yet.</EmptyText>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-white/10">
                  <div className="hidden grid-cols-[1.3fr_1fr_1fr_1fr_1.2fr] gap-3 bg-white/[0.06] px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-400 md:grid">
                    <span>Event</span>
                    <span>Path</span>
                    <span>Device</span>
                    <span>Recruiter</span>
                    <span>Time</span>
                  </div>
                  <div className="divide-y divide-white/10">
                    {recentEvents.slice(0, 30).map((event, index) => (
                      <div key={`${event.id || index}-event`} className="grid gap-2 px-4 py-4 text-sm md:grid-cols-[1.3fr_1fr_1fr_1fr_1.2fr] md:gap-3">
                        <span className="font-bold text-white">{safeEventName(event.event)}</span>
                        <span className="text-slate-400">{event.path || "/"}</span>
                        <span className="text-slate-400">{event.device || "unknown"}</span>
                        <span className="text-slate-400">{event.recruiter || "—"}</span>
                        <span className="text-slate-500">{formatDate(event.created_at || event.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Panel>
          </>
        )}
      </div>
    </main>
  );
}

function StatCard({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-xl shadow-black/20">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={accent ? "mt-2 text-3xl font-black text-emerald-300" : "mt-2 text-3xl font-black text-white"}>{value}</p>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/20">
      <div className="mb-5">
        <h2 className="text-xl font-black text-white">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function MiniCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

function FunnelRow({ label, value, max }: { label: string; value: number; max: number }) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="font-bold text-white">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function EventLine({ event }: { event: AnalyticsEvent }) {
  return (
    <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-100">
      <p className="font-bold">{safeEventName(event.event)}</p>
      <p className="text-red-200/70">{event.path || "/"} · {formatDate(event.created_at || event.timestamp)}</p>
    </div>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-slate-500">{children}</p>;
}
