"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, RefreshCw, Users, UserCheck, CreditCard, Eye, Upload, Mic,
  PlayCircle, CheckCircle2, AlertTriangle, Radio,
} from "lucide-react";

type AnyRecord = Record<string, unknown>;
type AnalyticsResponse = {
  ok?: boolean; configured?: boolean; summary?: AnyRecord; events?: AnyRecord[];
  error?: string; reason?: string;
};

const empty: AnalyticsResponse = { ok: true, configured: true, summary: {}, events: [] };

const num = (v: unknown) => { const x = Number(v || 0); return Number.isFinite(x) ? x : 0; };
const fmt = (v: unknown) => num(v).toLocaleString();
const pct = (v: unknown) => `${Math.round(num(v))}%`;

function entries(obj: unknown, limit = 8): [string, number][] {
  if (!obj || typeof obj !== "object") return [];
  return Object.entries(obj as Record<string, unknown>)
    .map(([k, v]) => [k, num(v)] as [string, number])
    .filter(([k, v]) => k.trim() && v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

// Turn a raw source/referrer (a UTM value, a domain, a referrer URL, or
// "Direct / unknown") into a clean channel label like "LinkedIn" or "Google".
function sourceLabel(raw: unknown, referrer?: unknown): string {
  let v = String(raw || "").toLowerCase().trim();
  if (!v || v === "direct / unknown" || v === "unknown" || v === "direct") {
    v = String(referrer || "").toLowerCase().trim();
  }
  if (!v) return "Direct";
  const has = (...ks: string[]) => ks.some((k) => v.includes(k));
  if (has("linkedin", "lnkd.in")) return "LinkedIn";
  if (has("google")) return "Google";
  if (has("bing", "duckduckgo", "yahoo", "ecosia")) return "Search";
  if (has("producthunt", "product-hunt", "product_hunt")) return "Product Hunt";
  if (has("twitter", "x.com", "t.co")) return "X / Twitter";
  if (has("facebook", "fb.com", "fb.me")) return "Facebook";
  if (has("instagram")) return "Instagram";
  if (has("reddit")) return "Reddit";
  if (has("youtube", "youtu.be")) return "YouTube";
  if (has("tiktok")) return "TikTok";
  if (has("github")) return "GitHub";
  if (has("indiehackers")) return "Indie Hackers";
  if (has("whatsapp", "telegram", "t.me")) return "Messaging";
  if (has("gmail", "outlook", "mail.", "email", "newsletter", "utm_medium=email")) return "Email";
  if (has("direct")) return "Direct";
  // Fall back to the bare domain, e.g. "news.ycombinator.com" -> "Ycombinator"
  const domain = v.replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
  const core = domain.split(".").slice(-2, -1)[0] || domain;
  return core ? core.charAt(0).toUpperCase() + core.slice(1) : "Direct";
}

const SOURCE_COLORS: Record<string, string> = {
  LinkedIn: "border-brand/30 bg-brand/10 text-brand",
  Google: "border-danger/30 bg-danger/10 text-danger",
  Search: "border-line bg-fg/[0.05] text-muted",
  "Product Hunt": "border-warning/30 bg-warning/10 text-warning",
  "X / Twitter": "border-line bg-fg/[0.05] text-fg",
  Email: "border-success/30 bg-success/10 text-success",
  Direct: "border-line bg-fg/[0.04] text-subtle",
};

function dailyBuckets(events: AnyRecord[], key: string, days = 14) {
  const now = Date.now();
  const b: number[] = Array(days).fill(0);
  for (const ev of events) {
    if (ev.event !== key) continue;
    const ts = new Date(String(ev.timestamp || ev.receivedAt || "")).getTime();
    if (!ts) continue;
    const ago = Math.floor((now - ts) / 86400000);
    if (ago >= 0 && ago < days) b[days - 1 - ago]++;
  }
  return b;
}

function Spark({ data }: { data: number[] }) {
  const max = Math.max(1, ...data);
  const w = 96, h = 30;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(" ");
  const area = `0,${h} ${pts} ${w},${h}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polygon points={area} fill="var(--wz-brand)" opacity="0.10" />
      <polyline points={pts} fill="none" stroke="var(--wz-brand)" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Kpi({
  icon: Icon, label, value, sub, spark,
}: {
  icon: typeof Users; label: string; value: string; sub?: string; spark?: number[];
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface/70 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand/10 text-brand">
          <Icon className="h-4 w-4" />
        </div>
        {spark ? <Spark data={spark} /> : null}
      </div>
      <p className="mt-4 text-2xl font-black tabular-nums tracking-tight">{value}</p>
      <p className="mt-0.5 text-xs font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
      {sub ? <p className="mt-1 text-xs text-subtle">{sub}</p> : null}
    </div>
  );
}

function RateBar({ label, value, tone = "brand" }: { label: string; value: number; tone?: "brand" | "success" | "danger" }) {
  const bar = tone === "success" ? "bg-success" : tone === "danger" ? "bg-danger" : "bg-brand";
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-bold text-fg">{label}</span>
        <span className="font-black tabular-nums text-muted">{pct(value)}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(100, Math.max(0, num(value)))}%` }} />
      </div>
    </div>
  );
}

function BreakdownCard({ title, data }: { title: string; data: [string, number][] }) {
  const max = Math.max(1, ...data.map((d) => d[1]));
  return (
    <div className="rounded-2xl border border-line bg-surface/70 p-5">
      <h3 className="text-sm font-black uppercase tracking-[0.14em] text-muted">{title}</h3>
      {data.length === 0 ? (
        <p className="mt-4 text-sm text-subtle">No data yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {data.map(([k, v]) => (
            <div key={k}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-bold text-fg" title={k}>{k}</span>
                <span className="shrink-0 font-black tabular-nums text-muted">{fmt(v)}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-brand/70" style={{ width: `${(v / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FounderAnalyticsClient() {
  const [data, setData] = useState<AnalyticsResponse>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [includeLocal, setIncludeLocal] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async (withLocal: boolean) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams(window.location.search);
      const secret = params.get("secret") || "";
      const url = `/api/analytics?secret=${encodeURIComponent(secret)}${withLocal ? "&all=1" : ""}`;
      const res = await fetch(url, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as AnalyticsResponse | null;
      if (!res.ok || !json?.ok) throw new Error(json?.error || json?.reason || `${res.status}`);
      setData(json);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics.");
      setData(empty);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(includeLocal);
    const id = window.setInterval(() => void load(includeLocal), 60000);
    return () => window.clearInterval(id);
  }, [includeLocal, load]);

  const s = (data.summary || {}) as AnyRecord;
  const events = Array.isArray(data.events) ? data.events : [];

  const uploadSpark = useMemo(() => dailyBuckets(events, "cv_uploaded"), [events]);
  const startSpark = useMemo(() => dailyBuckets(events, "interview_started"), [events]);
  const completeSpark = useMemo(() => dailyBuckets(events, "interview_completed"), [events]);

  // Re-bucket raw traffic sources into friendly channels (LinkedIn, Google…).
  const channels = useMemo(() => {
    const raw = (s.trafficSources || {}) as Record<string, unknown>;
    const agg: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw)) {
      const label = sourceLabel(k);
      agg[label] = (agg[label] || 0) + num(v);
    }
    return entries(agg);
  }, [s.trafficSources]);

  return (
    <main className="min-h-screen bg-canvas text-fg">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,rgba(37,99,235,0.14),transparent_70%)]" />

      {/* Topbar */}
      <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3.5 sm:px-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-black text-muted hover:text-fg">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand/15 text-brand">
              <Radio className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-black leading-none">Founder Analytics</p>
              <p className="mt-1 text-[11px] text-subtle">
                {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Loading…"} · auto-refresh 60s
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIncludeLocal((v) => !v)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-black transition ${
                includeLocal ? "border-brand/40 bg-brand/10 text-brand" : "border-line bg-fg/[0.04] text-muted hover:text-fg"
              }`}
            >
              {includeLocal ? "Including local" : "Production only"}
            </button>
            <button
              type="button"
              onClick={() => void load(includeLocal)}
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-fg/[0.04] px-3 py-1.5 text-xs font-black text-fg hover:bg-fg/[0.08]"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] space-y-6 px-5 py-6 sm:px-8">
        {error ? (
          <div className="flex items-center gap-3 rounded-xl border border-danger/25 bg-danger/[0.08] px-5 py-4 text-sm font-bold text-danger">
            <AlertTriangle className="h-5 w-5 shrink-0" /> {error} — check your founder secret in the URL.
          </div>
        ) : null}

        {/* Acquisition */}
        <section>
          <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-muted">Audience</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi icon={Users} label="Unique visitors" value={fmt(s.uniqueVisitors)} sub={`${fmt(s.activeVisitors7d)} active in 7d`} />
            <Kpi icon={UserCheck} label="Signed-in users" value={fmt(s.signedInUsers)} sub={`${fmt(s.activeSignedInUsers7d)} active in 7d`} />
            <Kpi icon={CreditCard} label="Paid users" value={fmt(s.paidUsers)} />
            <Kpi icon={Eye} label="Results viewed" value={fmt(s.resultsViewed)} />
          </div>
        </section>

        {/* Activation funnel */}
        <section>
          <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-muted">Activation</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi icon={Upload} label="CV uploads" value={fmt(s.uploads)} spark={uploadSpark} />
            <Kpi icon={PlayCircle} label="Interviews started" value={fmt(s.interviewsStarted)} spark={startSpark} />
            <Kpi icon={CheckCircle2} label="Completed" value={fmt(s.completedInterviews)} spark={completeSpark} />
            <Kpi icon={Mic} label="Voice starts" value={fmt(s.voiceStarts)} sub={`${fmt(s.voiceFailures)} failures`} />
          </div>
        </section>

        {/* Rates */}
        <section className="grid gap-6 rounded-2xl border border-line bg-surface/70 p-6 sm:grid-cols-2 xl:grid-cols-4">
          <RateBar label="Answer rate" value={num(s.answerRate)} />
          <RateBar label="Completion rate" value={num(s.completionRate)} tone="success" />
          <RateBar label="Result view rate" value={num(s.resultRate)} />
          <RateBar label="Voice failure rate" value={num(s.voiceFailureRate)} tone="danger" />
        </section>

        {/* Breakdowns */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <BreakdownCard title="Recruiters" data={entries(s.recruiters)} />
          <BreakdownCard title="Roles" data={entries(s.roles)} />
          <BreakdownCard title="Interview modes" data={entries(s.modes)} />
          <BreakdownCard title="Traffic sources" data={channels} />
          <BreakdownCard title="Feature usage" data={entries(s.usageFeatureCounts)} />
          <BreakdownCard title="Plans" data={entries(s.usagePlanCounts)} />
        </section>

        {/* Recent activity */}
        <section className="rounded-2xl border border-line bg-surface/70 p-6">
          <h3 className="text-sm font-black uppercase tracking-[0.14em] text-muted">Recent activity</h3>
          {events.length === 0 ? (
            <p className="mt-4 text-sm text-subtle">No recent events.</p>
          ) : (
            <div className="mt-4 max-h-[420px] space-y-1.5 overflow-auto pr-1">
              {events.slice(0, 60).map((ev, i) => {
                const label = sourceLabel(ev.source, ev.referrer);
                const chip = SOURCE_COLORS[label] || "border-line bg-fg/[0.05] text-muted";
                return (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-line/60 bg-canvas px-3 py-2 text-xs">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand/70" />
                    <span className="font-bold text-fg">{String(ev.event || "event")}</span>
                    {ev.role ? <span className="text-muted">· {String(ev.role)}</span> : null}
                    {ev.recruiter ? <span className="text-muted">· {String(ev.recruiter)}</span> : null}
                    <span className={`ml-auto shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-black ${chip}`}>
                      {label}
                    </span>
                    <span className="shrink-0 text-subtle">
                      {ev.timestamp ? new Date(String(ev.timestamp)).toLocaleString() : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <p className="pb-4 text-center text-xs text-subtle">
          {fmt(s.productionEvents)} production events · {fmt(s.totalEvents)} total
        </p>
      </div>
    </main>
  );
}
