"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, RefreshCw, Users, UserCheck, CreditCard, Eye, Upload, Mic,
  PlayCircle, CheckCircle2, AlertTriangle, Radio, GraduationCap,
  Activity, RotateCcw, FileText, Search, BarChart3, Save, CircleAlert, LogIn,
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


type ActivityTone = "success" | "info" | "warning" | "neutral" | "danger";
type ActivityCategory = "interview" | "cv" | "jobs" | "navigation" | "system" | "auth";
type ActivityItem = {
  key: string;
  rawEvent: string;
  title: string;
  description: string;
  category: ActivityCategory;
  tone: ActivityTone;
  icon: typeof Activity;
  count: number;
  timestamp?: string;
  role?: string;
  recruiter?: string;
  source?: unknown;
  referrer?: unknown;
};

const ACTIVITY_LABELS: Record<string, Omit<ActivityItem, "key" | "rawEvent" | "count">> = {
  interview_started: { title: "Interview started", description: "A candidate entered the interview room.", category: "interview", tone: "info", icon: PlayCircle },
  interview_completed: { title: "Interview completed", description: "The interview reached a completed result.", category: "interview", tone: "success", icon: CheckCircle2 },
  interview_saved: { title: "Interview saved", description: "Interview progress and answers were saved.", category: "interview", tone: "neutral", icon: Save },
  answer_quality_detected: { title: "Interview answers evaluated", description: "Candidate answers were assessed for quality and relevance.", category: "interview", tone: "info", icon: Activity },
  state_recovery_available: { title: "Interview recovery available", description: "Saved interview progress was found and can be resumed.", category: "interview", tone: "warning", icon: RotateCcw },
  active_interview_replaced: { title: "Previous interview replaced", description: "A new interview setup replaced the active saved session.", category: "interview", tone: "warning", icon: RotateCcw },
  interview_room_viewed: { title: "Interview room opened", description: "A candidate opened the live interview room.", category: "interview", tone: "neutral", icon: Mic },
  onboarding_viewed: { title: "Interview setup opened", description: "A candidate viewed interview onboarding.", category: "interview", tone: "neutral", icon: PlayCircle },
  results_viewed: { title: "Interview results viewed", description: "A candidate opened their interview feedback.", category: "interview", tone: "success", icon: BarChart3 },
  sign_in: { title: "Signed in", description: "A visitor signed in.", category: "auth", tone: "info", icon: LogIn },
  cv_uploaded: { title: "CV uploaded", description: "A candidate uploaded a CV for analysis.", category: "cv", tone: "info", icon: Upload },
  cv_improved: { title: "CV improved", description: "A tailored or improved CV was generated.", category: "cv", tone: "success", icon: FileText },
  cover_letter_generated: { title: "Cover letter generated", description: "A tailored cover letter was created.", category: "cv", tone: "success", icon: FileText },
  jobs_searched: { title: "Live jobs searched", description: "A candidate searched for live job openings.", category: "jobs", tone: "info", icon: Search },
  job_search: { title: "Live jobs searched", description: "A candidate searched for live job openings.", category: "jobs", tone: "info", icon: Search },
  page_view: { title: "Page viewed", description: "A page was opened in WorkZo.", category: "navigation", tone: "neutral", icon: Eye },
  error: { title: "Application error", description: "A tracked application error occurred.", category: "system", tone: "danger", icon: CircleAlert },
};

const ACTIVITY_TONES: Record<ActivityTone, string> = {
  success: "border-success/30 bg-success/10 text-success",
  info: "border-brand/30 bg-brand/10 text-brand",
  warning: "border-warning/30 bg-warning/10 text-warning",
  neutral: "border-line bg-fg/[0.04] text-muted",
  danger: "border-danger/30 bg-danger/10 text-danger",
};

function humanizeEvent(raw: string) {
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function eventTimestamp(ev: AnyRecord): string | undefined {
  const value = ev.timestamp || ev.receivedAt || ev.created_at;
  return value ? String(value) : undefined;
}

function activityFromEvent(ev: AnyRecord, index: number): ActivityItem {
  const rawEvent = String(ev.event || "event");
  const configured = ACTIVITY_LABELS[rawEvent];
  const timestamp = eventTimestamp(ev);
  return {
    key: `${rawEvent}:${timestamp || index}:${index}`,
    rawEvent,
    title: configured?.title || humanizeEvent(rawEvent),
    description: configured?.description || "A tracked WorkZo activity occurred.",
    category: configured?.category || "system",
    tone: configured?.tone || "neutral",
    icon: configured?.icon || Activity,
    count: 1,
    timestamp,
    role: ev.role ? String(ev.role) : undefined,
    recruiter: ev.recruiter ? String(ev.recruiter) : undefined,
    source: ev.source,
    referrer: ev.referrer,
  };
}

function groupActivity(events: AnyRecord[]): ActivityItem[] {
  const result: ActivityItem[] = [];
  const groupedNames = new Set(["answer_quality_detected", "page_view"]);

  events.slice(0, 120).forEach((ev, index) => {
    const current = activityFromEvent(ev, index);
    const previous = result[result.length - 1];
    const currentTime = current.timestamp ? new Date(current.timestamp).getTime() : 0;
    const previousTime = previous?.timestamp ? new Date(previous.timestamp).getTime() : 0;
    const closeInTime = currentTime > 0 && previousTime > 0 && Math.abs(previousTime - currentTime) <= 30 * 60 * 1000;
    const sameContext = previous?.rawEvent === current.rawEvent
      && previous.role === current.role
      && previous.recruiter === current.recruiter;

    if (previous && groupedNames.has(current.rawEvent) && sameContext && closeInTime) {
      previous.count += 1;
      if (current.timestamp && (!previous.timestamp || currentTime > previousTime)) previous.timestamp = current.timestamp;
      return;
    }

    result.push(current);
  });

  return result.slice(0, 60);
}


type PartnerTrialActivity = {
  status?: string;
  label?: string;
  target?: string;
  scope?: string;
  email?: string;
  code?: string;
  interviewsUsed?: number;
  interviewsLimit?: number;
  daysRemaining?: number;
  timestamp?: string;
};

type PartnerTrialSummaryClient = {
  configured?: boolean;
  activeOffers?: number;
  totalOffers?: number;
  invitationsSent?: number;
  activatedTrials?: number;
  activeTrials?: number;
  completedTrials?: number;
  expiredTrials?: number;
  interviewsUsed?: number;
  interviewsLimit?: number;
  recentActivity?: PartnerTrialActivity[];
  reason?: string;
};

function statusTone(status: string) {
  if (status === "completed") return "border-success/30 bg-success/10 text-success";
  if (status === "expired") return "border-danger/30 bg-danger/10 text-danger";
  if (status === "used") return "border-brand/30 bg-brand/10 text-brand";
  return "border-warning/30 bg-warning/10 text-warning";
}

function EducationTrialsCard({ trials }: { trials: PartnerTrialSummaryClient }) {
  const recent = Array.isArray(trials.recentActivity) ? trials.recentActivity : [];
  const used = num(trials.interviewsUsed);
  const limit = num(trials.interviewsLimit);
  const usagePct = limit > 0 ? Math.round((used / limit) * 100) : 0;

  return (
    <section className="rounded-2xl border border-line bg-surface/70 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand">
            <GraduationCap className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-muted">Education trials</p>
            <h2 className="mt-1 text-xl font-black tracking-tight">Partner trial link activity</h2>
            <p className="mt-1 text-sm text-subtle">See which institutes activated your 14-day Premium Pro trial links and how many interviews they used.</p>
          </div>
        </div>
        <div className="rounded-lg border border-brand/25 bg-brand/10 px-3 py-1.5 text-xs font-black text-brand">
          Education Evaluation Program
        </div>
      </div>

      {!trials.configured && trials.reason ? (
        <div className="mt-4 rounded-xl border border-warning/25 bg-warning/10 px-4 py-3 text-sm font-bold text-warning">
          Partner trial tracking is not fully configured yet: {trials.reason}
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-line bg-canvas p-4">
          <p className="text-2xl font-black tabular-nums">{fmt(trials.invitationsSent)}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-muted">Trial links created</p>
        </div>
        <div className="rounded-xl border border-line bg-canvas p-4">
          <p className="text-2xl font-black tabular-nums">{fmt(trials.activatedTrials)}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-muted">Activated by users</p>
        </div>
        <div className="rounded-xl border border-line bg-canvas p-4">
          <p className="text-2xl font-black tabular-nums">{fmt(trials.activeTrials)}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-muted">Active now</p>
        </div>
        <div className="rounded-xl border border-line bg-canvas p-4">
          <p className="text-2xl font-black tabular-nums">{fmt(trials.completedTrials)}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-muted">Completed allowance</p>
        </div>
        <div className="rounded-xl border border-line bg-canvas p-4">
          <p className="text-2xl font-black tabular-nums">{fmt(used)} / {fmt(limit)}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-muted">Interviews used</p>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, Math.max(0, usagePct))}%` }} />
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-black uppercase tracking-[0.14em] text-muted">Recent institute trial activity</h3>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-subtle">No trial link activations yet. Once a school uses a trial link, it will appear here.</p>
        ) : (
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {recent.slice(0, 8).map((item, index) => {
              const status = String(item.status || "activated");
              return (
                <div key={`${item.email || item.target || index}-${item.timestamp || index}`} className="rounded-xl border border-line bg-canvas px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-fg">{String(item.label || item.target || "Partner trial")}</p>
                      <p className="mt-0.5 truncate text-xs text-subtle">
                        {item.email ? String(item.email) : `${String(item.scope || "email")} · ${String(item.target || "")}`}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-black uppercase ${statusTone(status)}`}>
                      {status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                    <span className="font-bold tabular-nums">{fmt(item.interviewsUsed)} / {fmt(item.interviewsLimit)} interviews</span>
                    <span>{fmt(item.daysRemaining)} days left</span>
                    {item.timestamp ? <span>{new Date(String(item.timestamp)).toLocaleString()}</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export default function FounderAnalyticsClient() {
  const [data, setData] = useState<AnalyticsResponse>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [includeLocal, setIncludeLocal] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activityFilter, setActivityFilter] = useState<"all" | ActivityCategory>("all");

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
  const partnerTrials = ((s.partnerTrials || {}) as PartnerTrialSummaryClient);

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

  const groupedActivity = useMemo(() => groupActivity(events), [events]);
  const visibleActivity = useMemo(() =>
    activityFilter === "all"
      ? groupedActivity
      : groupedActivity.filter((item) => item.category === activityFilter),
  [activityFilter, groupedActivity]);

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
            <AlertTriangle className="h-5 w-5 shrink-0" /> {error}, check your founder secret in the URL.
          </div>
        ) : null}

        <EducationTrialsCard trials={partnerTrials} />

        {/* Acquisition */}
        <section>
          <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-muted">Audience</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi icon={Users} label="Unique visitors" value={fmt(s.uniqueVisitors)} sub={`${fmt(s.activeVisitors7d)} active in 7d`} />
            {/* RELABELLED. This is derived from distinct user_id in
                workzo_usage_events, i.e. signed-in users who completed a
                tracked product action. It never measured sign-ins. The
                Sign-ins tile below is the real number. */}
            <Kpi icon={UserCheck} label="Active signed-in users" value={fmt(s.signedInUsers)} sub={`${fmt(s.activeSignedInUsers7d)} active in 7d`} />
            <Kpi icon={LogIn} label="Sign-ins" value={fmt(s.signIns)} sub="auth callback events" />
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
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.14em] text-muted">Recent activity</h3>
              <p className="mt-1 text-sm text-subtle">Founder-friendly activity summaries. Repeated answer checks and page views are grouped automatically.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {([
                ["all", "All"],
                ["auth", "Sign-ins"],
                ["interview", "Interviews"],
                ["cv", "CV & letters"],
                ["jobs", "Jobs"],
                ["navigation", "Navigation"],
                ["system", "System"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setActivityFilter(value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-black transition ${
                    activityFilter === value
                      ? "border-brand/40 bg-brand/10 text-brand"
                      : "border-line bg-canvas text-muted hover:text-fg"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {visibleActivity.length === 0 ? (
            <p className="mt-4 text-sm text-subtle">No recent activity for this filter.</p>
          ) : (
            <div className="mt-5 max-h-[520px] space-y-2 overflow-auto pr-1">
              {visibleActivity.map((item) => {
                const source = sourceLabel(item.source, item.referrer);
                const sourceChip = SOURCE_COLORS[source] || "border-line bg-fg/[0.05] text-muted";
                const Icon = item.icon;
                const countSuffix = item.count > 1 ? ` · ${item.count} events grouped` : "";
                return (
                  <article key={item.key} className="rounded-xl border border-line/70 bg-canvas px-4 py-3">
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${ACTIVITY_TONES[item.tone]}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="font-black text-fg">{item.title}</p>
                          {item.count > 1 ? (
                            <span className="rounded-md border border-brand/25 bg-brand/10 px-2 py-0.5 text-[10px] font-black text-brand">
                              {item.count}
                            </span>
                          ) : null}
                          {item.role ? <span className="text-xs text-muted">· {item.role}</span> : null}
                          {item.recruiter ? <span className="text-xs text-muted">· {item.recruiter}</span> : null}
                        </div>
                        <p className="mt-1 text-xs text-subtle">{item.description}{countSuffix}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-black ${sourceChip}`}>{source}</span>
                        <time className="text-[11px] text-subtle">
                          {item.timestamp ? new Date(item.timestamp).toLocaleString() : ""}
                        </time>
                      </div>
                    </div>
                  </article>
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
