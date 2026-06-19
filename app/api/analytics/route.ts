export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { isLocalRequestFromHeaders } from "../../../lib/localOnly";
import { createClient } from "@supabase/supabase-js";

type AnalyticsBody = {
  event?: string;
  visitorId?: string;
  sessionId?: string;
  path?: string;
  source?: string;
  referrer?: string;
  host?: string;
  origin?: string;
  isLocal?: boolean;
  deviceType?: string;
  userAgent?: string;
  role?: string;
  market?: string;
  recruiter?: string;
  mode?: string;
  score?: number;
  trust?: number;
  pressure?: number;
  metadata?: Record<string, unknown>;
  timestamp?: string;
};

type DbAnalyticsEvent = {
  event: string | null;
  visitor_id: string | null;
  session_id: string | null;
  path: string | null;
  source: string | null;
  referrer: string | null;
  host: string | null;
  origin: string | null;
  is_local: boolean | null;
  device_type: string | null;
  user_agent: string | null;
  role: string | null;
  market: string | null;
  recruiter: string | null;
  mode: string | null;
  score: number | null;
  trust: number | null;
  pressure: number | null;
  metadata: Record<string, unknown> | null;
  client_timestamp: string | null;
  created_at: string;
};

function cleanText(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function cleanMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  try { return JSON.parse(JSON.stringify(value).slice(0, 8000)); } catch { return {}; }
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function normalizeEvent(body: AnalyticsBody, request: Request) {
  const headers = request.headers;
  const forwardedFor = headers.get("x-forwarded-for") || "";
  const ipHashSource = forwardedFor.split(",")[0]?.trim() || headers.get("x-real-ip") || "";

  return {
    event: cleanText(body.event, 120) || "unknown_event",
    visitor_id: cleanText(body.visitorId, 160) || "unknown_visitor",
    session_id: cleanText(body.sessionId, 160) || "unknown_session",
    path: cleanText(body.path, 500) || "/",
    source: cleanText(body.source, 160) || "Direct / unknown",
    referrer: cleanText(body.referrer, 800),
    host: cleanText(body.host, 200),
    origin: cleanText(body.origin, 300),
    is_local: Boolean(body.isLocal),
    device_type: cleanText(body.deviceType, 50) || "unknown",
    user_agent: cleanText(body.userAgent || headers.get("user-agent"), 1000),
    role: cleanText(body.role, 180),
    market: cleanText(body.market, 120),
    recruiter: cleanText(body.recruiter, 160),
    mode: cleanText(body.mode, 80),
    score: cleanNumber(body.score),
    trust: cleanNumber(body.trust),
    pressure: cleanNumber(body.pressure),
    metadata: { ...cleanMetadata(body.metadata), ipHashSource: ipHashSource ? "present" : "missing" },
    client_timestamp: cleanText(body.timestamp, 80) || null,
  };
}

function countBy(items: string[]) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = item || "Unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function pct(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}

function avg(values: Array<number | null | undefined>) {
  const clean = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!clean.length) return null;
  return Math.round(clean.reduce((sum, value) => sum + value, 0) / clean.length);
}

function eventName(item: DbAnalyticsEvent) {
  return item.event || "unknown_event";
}

function eventTime(item: DbAnalyticsEvent) {
  return item.client_timestamp || item.created_at;
}

function planFrom(item: DbAnalyticsEvent): string {
  const metadata = item.metadata || {};
  const raw = metadata.plan;
  if (typeof raw === "string" && raw.trim()) return raw.trim().toLowerCase();
  return "free";
}

function isDevOverrideEvent(item: DbAnalyticsEvent): boolean {
  return Boolean((item.metadata || {}).devOverrideActive);
}

function weakSignalsFrom(events: DbAnalyticsEvent[]) {
  const signals: string[] = [];
  for (const item of events) {
    const metadata = item.metadata || {};
    const raw = metadata.weakSignal || metadata.weakness || metadata.concern || metadata.reason || metadata.issue || "";
    if (typeof raw === "string" && raw.trim()) signals.push(raw.trim().slice(0, 80));
  }
  return countBy(signals);
}

function buildModePerformance(events: DbAnalyticsEvent[]) {
  const modes = Array.from(new Set(events.map((item) => item.mode || "unknown").filter(Boolean)));
  return modes.reduce<Record<string, { starts: number; completions: number; voiceFailures: number; results: number; avgTrust: number | null }>>((acc, mode) => {
    const modeEvents = events.filter((item) => (item.mode || "unknown") === mode);
    acc[mode] = {
      starts: modeEvents.filter((item) => eventName(item) === "interview_started").length,
      completions: modeEvents.filter((item) => eventName(item) === "interview_completed").length,
      voiceFailures: modeEvents.filter((item) => ["voice_failed", "vapi_failed"].includes(eventName(item))).length,
      results: modeEvents.filter((item) => eventName(item) === "results_viewed").length,
      avgTrust: avg(modeEvents.map((item) => item.trust)),
    };
    return acc;
  }, {});
}

// Per-plan breakdown — lets the founder see how Free vs Premium vs Premium Pro
// sessions behave differently (completion rate, voice reliability, etc).
// "plan" is read from event.metadata.plan, which trackWorkZoEvent() now
// attaches client-side based on the active plan / dev-tools override.
const PLAN_ORDER = ["free", "premium", "premium_pro"] as const;

function buildPlanBreakdown(events: DbAnalyticsEvent[]) {
  return PLAN_ORDER.reduce<Record<string, {
    sessions: number;
    uploads: number;
    interviewsStarted: number;
    completedInterviews: number;
    resultsViewed: number;
    voiceFailures: number;
    completionRate: number;
    avgTrust: number | null;
  }>>((acc, plan) => {
    const planEvents = events.filter((item) => planFrom(item) === plan);
    const sessions = new Set(planEvents.map((item) => item.session_id).filter(Boolean)).size;
    const interviewsStarted = planEvents.filter((item) => eventName(item) === "interview_started").length;
    const completedInterviews = planEvents.filter((item) => eventName(item) === "interview_completed").length;

    acc[plan] = {
      sessions,
      uploads: planEvents.filter((item) => eventName(item) === "cv_uploaded").length,
      interviewsStarted,
      completedInterviews,
      resultsViewed: planEvents.filter((item) => eventName(item) === "results_viewed").length,
      voiceFailures: planEvents.filter((item) => ["voice_failed", "vapi_failed"].includes(eventName(item))).length,
      completionRate: pct(completedInterviews, interviewsStarted),
      avgTrust: avg(planEvents.map((item) => item.trust)),
    };
    return acc;
  }, {});
}

function buildAnalyticsResponse(allEvents: DbAnalyticsEvent[]) {
  // Exclude events generated while a founder/dev-tools plan override was
  // active — these are test sessions clicking through the app as a fake
  // plan, not real user behavior, and would otherwise skew completion
  // rates, voice-failure rates, etc.
  const devTestEvents = allEvents.filter(isDevOverrideEvent);
  const events = allEvents.filter((item) => !isDevOverrideEvent(item));

  const counts = countBy(events.map(eventName));
  const sessions = new Set(events.map((item) => item.session_id).filter(Boolean));
  const visitors = new Set(events.map((item) => item.visitor_id).filter(Boolean));
  const uploads = counts.cv_uploaded || 0;
  const interviewsStarted = counts.interview_started || 0;
  const answersSubmitted = counts.answer_submitted || 0;
  const voiceStarts = counts.voice_started || counts.vapi_connected || 0;
  const voiceFailures = counts.voice_failed || counts.vapi_failed || 0;
  const voicePaused = counts.voice_paused || 0;
  const voiceRecovered = counts.voice_recovered || 0;
  const completedInterviews = counts.interview_completed || 0;
  const resultsViewed = counts.results_viewed || 0;
  const dropoffFunnel = [
    { stage: "Page views", count: counts.page_view || 0 },
    { stage: "CV uploads", count: uploads },
    { stage: "Interview starts", count: interviewsStarted },
    { stage: "Answers submitted", count: answersSubmitted },
    { stage: "Completed interviews", count: completedInterviews },
    { stage: "Results viewed", count: resultsViewed },
  ];
  const weakSignals = weakSignalsFrom(events);
  const topWeakness = Object.entries(weakSignals).sort((a, b) => b[1] - a[1])[0]?.[0] || "Not enough data yet";
  const completionRate = pct(completedInterviews, interviewsStarted);
  const resultRate = pct(resultsViewed, completedInterviews || interviewsStarted);
  const answerRate = pct(answersSubmitted, interviewsStarted);
  const voiceFailureRate = pct(voiceFailures, voiceStarts || interviewsStarted);
  let insight = "No analytics collected yet.";
  if (events.length > 0) {
    if (interviewsStarted === 0) insight = "Visitors are reaching WorkZo, but interview starts are not being tracked yet.";
    else if (completionRate < 35) insight = "Interview completion is low. Check onboarding friction, voice reliability, and interview room clarity.";
    else if (voiceFailureRate > 15) insight = "Voice failure rate is high. Prioritize Vapi/fallback reliability before launch.";
    else insight = "Analytics are live. Track completion rate, voice failures, and result views after each tester session.";
  }

  const recentEvents = events.slice(0, 200).map((item) => ({
    event: eventName(item),
    sessionId: item.session_id || "",
    visitorId: item.visitor_id || "",
    role: item.role || "",
    market: item.market || "",
    recruiter: item.recruiter || "",
    mode: item.mode || "",
    score: item.score,
    trust: item.trust,
    pressure: item.pressure,
    path: item.path || "",
    source: item.source || "Direct / unknown",
    timestamp: eventTime(item),
    receivedAt: item.created_at,
    metadata: item.metadata || {},
  }));

  const summary = {
    totalEvents: events.length,
    productionEvents: events.length,
    totalUniqueVisitors: visitors.size,
    uniqueVisitorsAllTime: visitors.size,
    uniqueSessions: sessions.size,
    uploads,
    interviewsStarted,
    answersSubmitted,
    voiceStarts,
    voiceFailures,
    voicePaused,
    voiceRecovered,
    completedInterviews,
    resultsViewed,
    answerRate,
    resultRate,
    completionRate,
    voiceFailureRate,
    counts,
    recruiters: countBy(events.map((item) => item.recruiter || "").filter(Boolean)),
    roles: countBy(events.map((item) => item.role || "").filter(Boolean)),
    modes: countBy(events.map((item) => item.mode || "unknown")),
    trafficSources: countBy(events.map((item) => item.source || "Direct / unknown")),
    weakSignals,
    dropoffFunnel,
    modePerformance: buildModePerformance(events),
    planBreakdown: buildPlanBreakdown(events),
    devTestEvents: devTestEvents.length,
    topWeakness,
    insight,
  };

  return {
    ok: true,
    configured: true,
    summary,
    metrics: {
      totalEvents: events.length,
      productionEvents: events.length,
      totalUniqueVisitors: visitors.size,
      uniqueVisitorsAllTime: visitors.size,
      uniqueSessions: sessions.size,
      cvUploads: uploads,
      uploads,
      interviewStarts: interviewsStarted,
      interviewsStarted,
      interviewCompletions: completedInterviews,
      completed: completedInterviews,
      resultsViewed,
      completionRate,
      resultViewRate: resultRate,
      answerRate,
      voiceFailureRate,
    },
    events: recentEvents,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as AnalyticsBody;
    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ ok: true, stored: false, reason: "supabase_not_configured" });
    const event = normalizeEvent(body, request);
    const { error } = await supabase.from("workzo_analytics_events").insert(event);
    if (error) {
      console.error("[WorkZo analytics] insert failed", { message: error.message, details: error.details, hint: error.hint, code: error.code });
      return NextResponse.json({ ok: true, stored: false, reason: "insert_failed", error: error.message, details: error.details, hint: error.hint, code: error.code });
    }
    return NextResponse.json({ ok: true, stored: true });
  } catch (error) {
    console.error("[WorkZo analytics] route failed", error);
    return NextResponse.json({ ok: true, stored: false, reason: "route_failed", error: error instanceof Error ? error.message : String(error) });
  }
}

export async function GET(request: Request) {
  try {
    if (!isLocalRequestFromHeaders(request.headers)) {
      return NextResponse.json({ ok: false, reason: "local_only" }, { status: 404 });
    }
    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ ok: true, configured: false, summary: buildAnalyticsResponse([]).summary, metrics: buildAnalyticsResponse([]).metrics, events: [], reason: "supabase_not_configured" });
    const { data, error } = await supabase
      .from("workzo_analytics_events")
      .select("event, visitor_id, session_id, path, source, referrer, host, origin, is_local, device_type, user_agent, role, market, recruiter, mode, score, trust, pressure, metadata, client_timestamp, created_at")
      .order("created_at", { ascending: false })
      .limit(10000);
    if (error) {
      console.error("[WorkZo analytics] metrics read failed", { message: error.message, details: error.details, hint: error.hint, code: error.code });
      return NextResponse.json({ ok: true, configured: true, summary: buildAnalyticsResponse([]).summary, metrics: buildAnalyticsResponse([]).metrics, events: [], reason: "read_failed", error: error.message, details: error.details, hint: error.hint, code: error.code });
    }
    return NextResponse.json(buildAnalyticsResponse((data || []) as DbAnalyticsEvent[]));
  } catch (error) {
    console.error("[WorkZo analytics] metrics route failed", error);
    return NextResponse.json({ ok: true, configured: false, summary: buildAnalyticsResponse([]).summary, metrics: buildAnalyticsResponse([]).metrics, events: [], reason: "route_failed", error: error instanceof Error ? error.message : String(error) });
  }
}
