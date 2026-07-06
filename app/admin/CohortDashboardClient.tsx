"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users, GaugeCircle, CalendarClock, AlertTriangle, TrendingUp, CheckCircle2,
  Clock, Search, ArrowUpRight, RefreshCw, Building2,
} from "lucide-react";

/**
 * Partner / organization cohort admin dashboard.
 *
 * • Opened with ?org=<domain>&key=<orgKey> (or ?secret=<founder>), it loads that
 *   organization's REAL learner data from /api/admin/cohort.
 * • Opened with no params, it shows a labelled sample cohort so partners and
 *   sales can see exactly what they get, plus a form to load a live cohort.
 */

type Status = "ready" | "improving" | "at-risk";
type Learner = {
  name: string; role: string; sessions: number; readiness: number;
  trend: number; lastActive: string; status: Status;
};
type Stats = { totalLearners: number; activeLearners: number; avgReadiness: number; sessionsThisMonth: number; atRisk: number };

const SAMPLE: Learner[] = [
  { name: "Aisha Rahman", role: "Data Analyst", sessions: 9, readiness: 88, trend: 6, lastActive: "2h ago", status: "ready" },
  { name: "Marco Feld", role: "IT Support", sessions: 7, readiness: 82, trend: 4, lastActive: "1d ago", status: "ready" },
  { name: "Chen Wei", role: "Frontend Engineer", sessions: 11, readiness: 79, trend: 9, lastActive: "5h ago", status: "ready" },
  { name: "Priya Nair", role: "Customer Success", sessions: 5, readiness: 71, trend: 3, lastActive: "3h ago", status: "improving" },
  { name: "Tom Becker", role: "Sales Development", sessions: 4, readiness: 64, trend: 5, lastActive: "2d ago", status: "improving" },
  { name: "Lucia Rossi", role: "Product Analyst", sessions: 6, readiness: 61, trend: -2, lastActive: "1d ago", status: "improving" },
  { name: "Jonas Vogel", role: "Cloud Engineer", sessions: 2, readiness: 44, trend: 1, lastActive: "4d ago", status: "at-risk" },
  { name: "Sara Haddad", role: "Data Analyst", sessions: 1, readiness: 38, trend: 0, lastActive: "6d ago", status: "at-risk" },
  { name: "Diego Alvarez", role: "IT Support", sessions: 0, readiness: 0, trend: 0, lastActive: "never", status: "at-risk" },
];
const SAMPLE_ENGAGEMENT = [12, 18, 9, 22, 27, 19, 31, 24, 28, 35, 30, 41, 38, 44];

const statusMeta: Record<Status, { label: string; cls: string; dot: string }> = {
  ready: { label: "Ready", cls: "text-success", dot: "bg-success" },
  improving: { label: "Improving", cls: "text-warning", dot: "bg-warning" },
  "at-risk": { label: "Needs coaching", cls: "text-danger", dot: "bg-danger" },
};

function statsFrom(learners: Learner[]): Stats {
  const active = learners.filter((l) => l.sessions > 0);
  return {
    totalLearners: learners.length,
    activeLearners: active.length,
    avgReadiness: active.length ? Math.round(active.reduce((s, l) => s + l.readiness, 0) / active.length) : 0,
    sessionsThisMonth: learners.reduce((s, l) => s + l.sessions, 0),
    atRisk: learners.filter((l) => l.status === "at-risk").length,
  };
}

function Stat({ icon: Icon, label, value, sub, tone = "brand" }: {
  icon: typeof Users; label: string; value: string; sub?: string; tone?: string;
}) {
  const iconCls = tone === "success" ? "bg-success/10 text-success"
    : tone === "warning" ? "bg-warning/10 text-warning"
    : tone === "danger" ? "bg-danger/10 text-danger" : "bg-brand/10 text-brand";
  return (
    <div className="rounded-2xl border border-line bg-surface/70 p-5">
      <div className={`grid h-9 w-9 place-items-center rounded-lg ${iconCls}`}><Icon className="h-4 w-4" /></div>
      <p className="mt-4 text-2xl font-black tabular-nums tracking-tight">{value}</p>
      <p className="mt-0.5 text-xs font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
      {sub ? <p className="mt-1 text-xs text-subtle">{sub}</p> : null}
    </div>
  );
}

export default function CohortDashboardClient() {
  const [live, setLive] = useState<{ learners: Learner[]; stats: Stats; engagement: number[]; org: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orgInput, setOrgInput] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | Status>("all");

  const loadOrg = useCallback(async (org: string, key: string, secret: string) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams();
      if (org.includes("@") || org.includes(".")) params.set("org", org); else params.set("code", org);
      if (key) params.set("key", key);
      if (secret) params.set("secret", secret);
      const res = await fetch(`/api/admin/cohort?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.error === "unauthorized" ? "That access key isn't valid for this organization." : (json?.detail || "Could not load this cohort."));
      if (json?.empty) { setLive({ learners: [], stats: statsFrom([]), engagement: Array(14).fill(0), org: json.org }); return; }
      setLive({ learners: json.learners, stats: json.stats, engagement: json.engagement, org: json.org });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cohort.");
      setLive(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const org = p.get("org") || p.get("code") || "";
    const key = p.get("key") || "";
    const secret = p.get("secret") || "";
    if (org && (key || secret)) { setOrgInput(org); void loadOrg(org, key, secret); }
  }, [loadOrg]);

  const isLive = !!live;
  const learners = isLive ? live!.learners : SAMPLE;
  const engagement = isLive ? live!.engagement : SAMPLE_ENGAGEMENT;
  const stats = isLive ? live!.stats : statsFrom(SAMPLE);
  const orgTitle = isLive ? live!.org : "Spring 2026 · Data & IT cohort";

  const ready = learners.filter((l) => l.status === "ready").length;
  const improving = learners.filter((l) => l.status === "improving").length;
  const atRisk = learners.filter((l) => l.status === "at-risk").length;
  const maxEng = Math.max(1, ...engagement);

  const rows = useMemo(() => learners
    .filter((l) => (filter === "all" ? true : l.status === filter))
    .filter((l) => (q ? (l.name + l.role).toLowerCase().includes(q.toLowerCase()) : true))
    .sort((a, b) => a.readiness - b.readiness), [learners, filter, q]);

  return (
    <main className="min-h-screen bg-canvas text-fg">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,rgba(37,99,235,0.14),transparent_70%)]" />

      <div className="mx-auto max-w-[1400px] px-5 py-8 sm:px-8">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">Admin Dashboard</p>
              {isLive ? (
                <span className="rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-success">Live · {orgTitle}</span>
              ) : (
                <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-warning">Sample cohort</span>
              )}
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight">{isLive ? `${orgTitle} · cohort` : orgTitle}</h1>
            <p className="mt-1 text-sm text-muted">Readiness, engagement, and early-warning flags across your program.</p>
          </div>
          {isLive ? (
            <button onClick={() => { const p = new URLSearchParams(window.location.search); void loadOrg(p.get("org") || p.get("code") || "", p.get("key") || "", p.get("secret") || ""); }}
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-fg/[0.04] px-5 py-3 text-sm font-black text-fg hover:bg-fg/[0.08]">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
          ) : (
            <a href="mailto:support@workzoai.com?subject=WorkZo%20AI%20Admin%20Dashboard%20Access"
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-black text-on-brand shadow-[0_8px_24px_-8px_rgba(37,99,235,0.6)] transition hover:bg-brand-strong">
              Connect your cohort <ArrowUpRight className="h-4 w-4" />
            </a>
          )}
        </div>

        {/* Load-your-cohort form (only in sample/preview mode) */}
        {!isLive && (
          <form
            onSubmit={(e) => { e.preventDefault(); if (orgInput.trim()) void loadOrg(orgInput.trim(), keyInput.trim(), ""); }}
            className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface/60 p-4"
          >
            <Building2 className="h-5 w-5 text-brand" />
            <div>
              <label className="text-[11px] font-black uppercase tracking-wide text-muted">Organization</label>
              <input value={orgInput} onChange={(e) => setOrgInput(e.target.value)} placeholder="students.myuni.edu"
                className="mt-1 block w-56 rounded-lg border border-line bg-canvas px-3 py-2 text-sm focus:border-brand focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] font-black uppercase tracking-wide text-muted">Access key</label>
              <input value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="partner access key"
                className="mt-1 block w-56 rounded-lg border border-line bg-canvas px-3 py-2 text-sm focus:border-brand focus:outline-none" />
            </div>
            <button type="submit" disabled={loading || !orgInput.trim()}
              className="rounded-lg bg-brand px-5 py-2 text-sm font-black text-on-brand disabled:opacity-40">
              {loading ? "Loading…" : "Load cohort"}
            </button>
            {error && <p className="w-full text-sm font-bold text-danger">{error}</p>}
          </form>
        )}

        {/* KPIs */}
        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={Users} label="Learners" value={`${stats.totalLearners}`} sub={`${stats.activeLearners} active`} />
          <Stat icon={GaugeCircle} label="Avg readiness" value={`${stats.avgReadiness}`} sub="active learners" tone="success" />
          <Stat icon={CalendarClock} label="Sessions (30d)" value={`${stats.sessionsThisMonth}`} />
          <Stat icon={AlertTriangle} label="Need coaching" value={`${stats.atRisk}`} sub="flagged" tone="danger" />
        </section>

        {isLive && learners.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-line bg-surface/70 p-10 text-center">
            <p className="text-sm font-black text-fg">No sessions yet for {orgTitle}</p>
            <p className="mt-1 text-sm text-muted">Once learners in this organization run interviews, their readiness will appear here.</p>
          </div>
        ) : (
          <>
            <section className="mt-4 grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-line bg-surface/70 p-6">
                <h3 className="text-sm font-black uppercase tracking-[0.14em] text-muted">Readiness distribution</h3>
                <div className="mt-5 space-y-4">
                  {([["ready", ready], ["improving", improving], ["at-risk", atRisk]] as [Status, number][]).map(([st, count]) => {
                    const meta = statusMeta[st];
                    const w = learners.length ? Math.round((count / learners.length) * 100) : 0;
                    return (
                      <div key={st}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 font-bold text-fg"><span className={`h-2 w-2 rounded-full ${meta.dot}`} /> {meta.label}</span>
                          <span className="font-black tabular-nums text-muted">{count} · {w}%</span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line"><div className={`h-full rounded-full ${meta.dot}`} style={{ width: `${w}%` }} /></div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-surface/70 p-6 lg:col-span-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-[0.14em] text-muted">Practice sessions · last 14 days</h3>
                  <span className="inline-flex items-center gap-1 text-xs font-black text-muted"><TrendingUp className="h-3.5 w-3.5" /> daily</span>
                </div>
                <div className="mt-6 flex h-32 items-end gap-1.5">
                  {engagement.map((v, i) => (
                    <div key={i} className="flex-1 rounded-t bg-brand/80" style={{ height: `${Math.max(2, (v / maxEng) * 100)}%` }} title={`${v} sessions`} />
                  ))}
                </div>
              </div>
            </section>

            {atRisk > 0 && (
              <section className="mt-4 rounded-2xl border border-danger/25 bg-danger/[0.06] p-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
                  <div>
                    <p className="text-sm font-black text-fg">{atRisk} learners need coaching before the next hiring day</p>
                    <p className="mt-1 text-sm text-muted">Low engagement or readiness below 50. Reach out now while there&apos;s still time to help.</p>
                  </div>
                </div>
              </section>
            )}

            {/* Learner table */}
            <section className="mt-4 rounded-2xl border border-line bg-surface/70">
              <div className="flex flex-wrap items-center gap-3 border-b border-line p-5">
                <h3 className="text-sm font-black uppercase tracking-[0.14em] text-muted">Learners</h3>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-1.5">
                    <Search className="h-3.5 w-3.5 text-muted" />
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="w-32 bg-transparent text-sm focus:outline-none" />
                  </div>
                  {(["all", "at-risk", "improving", "ready"] as const).map((f) => (
                    <button key={f} onClick={() => setFilter(f)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-black capitalize transition ${filter === f ? "border-brand/40 bg-brand/10 text-brand" : "border-line bg-fg/[0.04] text-muted hover:text-fg"}`}>
                      {f === "at-risk" ? "Needs coaching" : f}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-black uppercase tracking-[0.1em] text-subtle">
                      <th className="px-5 py-3">Learner</th><th className="px-5 py-3">Target role</th><th className="px-5 py-3">Sessions</th>
                      <th className="px-5 py-3">Readiness</th><th className="px-5 py-3">Last active</th><th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((l, i) => {
                      const meta = statusMeta[l.status];
                      return (
                        <tr key={`${l.name}-${i}`} className="border-b border-line/60 last:border-0 hover:bg-fg/[0.02]">
                          <td className="px-5 py-3.5 font-black text-fg">{l.name}</td>
                          <td className="px-5 py-3.5 text-muted">{l.role}</td>
                          <td className="px-5 py-3.5 tabular-nums text-muted">{l.sessions}</td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-line"><div className={`h-full rounded-full ${meta.dot}`} style={{ width: `${l.readiness}%` }} /></div>
                              <span className="tabular-nums font-bold text-fg">{l.readiness || "—"}</span>
                              {l.trend !== 0 && <span className={`text-[11px] font-black ${l.trend > 0 ? "text-success" : "text-danger"}`}>{l.trend > 0 ? "+" : ""}{l.trend}</span>}
                            </div>
                          </td>
                          <td className="px-5 py-3.5"><span className="inline-flex items-center gap-1.5 text-muted"><Clock className="h-3.5 w-3.5" /> {l.lastActive}</span></td>
                          <td className="px-5 py-3.5"><span className={`inline-flex items-center gap-1.5 font-black ${meta.cls}`}><span className={`h-2 w-2 rounded-full ${meta.dot}`} /> {meta.label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {!isLive && (
          <section className="mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl border border-brand/20 bg-brand/[0.05] p-6 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
              <div>
                <p className="text-sm font-black text-fg">This is a sample cohort</p>
                <p className="mt-1 text-sm text-muted">Enter your organization and partner access key above to load live learner data, or request a pilot.</p>
              </div>
            </div>
            <a href="mailto:support@workzoai.com?subject=WorkZo%20AI%20Admin%20Dashboard%20Pilot"
              className="shrink-0 rounded-xl border border-line bg-fg/[0.04] px-5 py-3 text-sm font-black text-fg hover:bg-fg/[0.08]">Request a pilot</a>
          </section>
        )}
      </div>
    </main>
  );
}
