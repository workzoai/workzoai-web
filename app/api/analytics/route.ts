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
  environment?: string | null;
  deployment?: string | null;
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

type UsageEvent = {
  user_id: string | null;
  event_name: string | null;
  plan: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type UsageSummary = {
  configured: boolean;
  signedInUsers: number;
  activeSignedInUsers7d: number;
  activeSignedInUsers30d: number;
  totalUsageEvents: number;
  featureCounts: Record<string, number>;
  planCounts: Record<string, number>;
  reason?: string;
};

type SubscriptionRow = {
  user_id: string | null;
  plan: string | null;
  plan_tier?: string | null;
  status: string | null;
  stripe_subscription_id: string | null;
};

type PaidSubscriptionSummary = {
  configured: boolean;
  paidUsers: number;
  planCounts: Record<string, number>;
  reason?: string;
};

function cleanText(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function cleanMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  try {
    return JSON.parse(JSON.stringify(value).slice(0, 8000));
  } catch {
    return {};
  }
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeEvent(body: AnalyticsBody, request: Request) {
  const headers = request.headers;
  const forwardedFor = headers.get("x-forwarded-for") || "";
  const ipHashSource =
    forwardedFor.split(",")[0]?.trim() || headers.get("x-real-ip") || "";

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
    // These columns may exist in production. Keeping them in the inserted payload
    // lets the founder dashboard separate local/dev traffic without relying only
    // on hostname.
    environment: cleanText((body as any).environment, 80) || null,
    deployment: cleanText((body as any).deployment, 80) || null,
    device_type: cleanText(body.deviceType, 50) || "unknown",
    user_agent: cleanText(body.userAgent || headers.get("user-agent"), 1000),
    role: cleanText(body.role, 180),
    market: cleanText(body.market, 120),
    recruiter: cleanText(body.recruiter, 160),
    mode: cleanText(body.mode, 80),
    score: cleanNumber(body.score),
    trust: cleanNumber(body.trust),
    pressure: cleanNumber(body.pressure),
    metadata: {
      ...cleanMetadata(body.metadata),
      ipHashSource: ipHashSource ? "present" : "missing",
    },
    client_timestamp: cleanText(body.timestamp, 80) || null,
  };
}

const INTERNAL_TEST_ROLE_RE =
  /^(professional experience|interview role|general role|professional|unknown|supported the marketing team|educationwork experience|work experience|profile summary)$/i;
const ROLE_FRAGMENT_RE =
  /^(j|ju|jun|juni|junio|junior|junior s|junior so|junior sof|junior soft|junior softw|junior softwa|junior softwar|junior software d|junior software de|junior software dev|junior software deve|junior software devel|junior software develo|junior software develop)$/i;

function titleCaseRole(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((word) => {
      if (/^(it|ai|ui|ux|hr|qa|csm|crm|api|sql|aws|gcp|saas)$/i.test(word))
        return word.toUpperCase();
      if (/^(m\/f\/d|m\/w\/d)$/i.test(word)) return word.toLowerCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ")
    .replace(/\bAnd\b/g, "and")
    .replace(/\bOf\b/g, "of")
    .replace(/\bFor\b/g, "for");
}

function normalizeRoleForAnalytics(value: unknown): string {
  const raw = cleanText(value, 180)
    .replace(/[_|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!raw) return "";
  const lower = raw.toLowerCase();
  if (raw.length < 6) return "";
  if (raw.length > 70) return "";
  if (INTERNAL_TEST_ROLE_RE.test(raw)) return "";
  if (ROLE_FRAGMENT_RE.test(raw)) return "";
  if (
    /\b(conducting research on industry trends|professional summary|profile summary|work experience|education)\b/i.test(
      raw,
    )
  )
    return "";

  if (/customer success|customer support manager|client success/i.test(raw))
    return "Customer Success Manager";
  if (/technical support|it support|service desk|help.?desk/i.test(raw))
    return "IT Support Specialist";
  if (/product design engineer|cad designer|mechanical design/i.test(raw))
    return "Product Design Engineer";
  if (/production control supervisor/i.test(raw))
    return "Production Control Supervisor";
  if (
    /full.?stack|frontend|backend|software developer|software engineer/i.test(
      raw,
    )
  )
    return "Software Developer";
  if (/marketing manager|marketing strategist|marketing specialist/i.test(raw))
    return "Marketing Manager";
  if (/cybersecurity|security engineer|soc analyst/i.test(raw))
    return "Cybersecurity Engineer";
  if (/data analyst|data scientist|business intelligence/i.test(raw))
    return "Data Analyst";

  return titleCaseRole(raw);
}

function normalizeRecruiterForAnalytics(value: unknown): string {
  const raw = cleanText(value, 160).replace(/\s+/g, " ").trim();
  const lower = raw.toLowerCase();
  if (!raw) return "";
  if (lower.includes("sarah")) return "Sarah Chen";
  if (lower.includes("daniel")) return "Daniel Reed";
  if (lower.includes("priya")) return "Priya Raman";
  if (lower.includes("markus")) return "Markus Weber";
  return raw;
}

function normalizedCountBy(values: string[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    const key = value.trim();
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function countUniqueSessionsByNormalizedField(
  events: DbAnalyticsEvent[],
  getValue: (item: DbAnalyticsEvent) => string,
  preferredEventNames: string[] = [
    "interview_started",
    "onboarding_viewed",
    "cv_uploaded",
  ],
) {
  const bySession = new Map<string, string>();
  const ordered = [
    ...events.filter((item) => preferredEventNames.includes(eventName(item))),
    ...events,
  ];

  for (const item of ordered) {
    const session =
      item.session_id ||
      item.visitor_id ||
      `${item.created_at}-${eventName(item)}`;
    if (bySession.has(session)) continue;
    const value = getValue(item).trim();
    if (!value) continue;
    bySession.set(session, value);
  }

  return normalizedCountBy(Array.from(bySession.values()));
}

function metadataHasTemplateOrInternalSignals(
  metadata: Record<string, unknown> | null | undefined,
) {
  if (!metadata || typeof metadata !== "object") return false;
  const values = Object.values(metadata).flatMap((value) => {
    if (Array.isArray(value)) return value.map((v) => String(v).toLowerCase());
    if (value && typeof value === "object")
      return [JSON.stringify(value).toLowerCase()];
    return [String(value).toLowerCase()];
  });
  return values.some(
    (value) =>
      value.includes("template_or_placeholder_content_detected") ||
      value.includes("reallygreatsite") ||
      value.includes("lorem ipsum") ||
      value.includes("founder_test") ||
      value.includes("internal_test") ||
      value.includes("qa_test"),
  );
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
  const clean = values.filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );
  if (!clean.length) return null;
  return Math.round(
    clean.reduce((sum, value) => sum + value, 0) / clean.length,
  );
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function isAfter(value: string | null | undefined, threshold: Date) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= threshold.getTime();
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

function isInternalAnalyticsEvent(item: DbAnalyticsEvent): boolean {
  const metadata = item.metadata || {};
  const source = String(
    metadata.source ||
      metadata.analyticsSource ||
      metadata.userType ||
      metadata.actor ||
      "",
  ).toLowerCase();
  const email = String(
    metadata.email || metadata.userEmail || "",
  ).toLowerCase();
  const host = String(item.host || metadata.host || "").toLowerCase();
  const origin = String(item.origin || metadata.origin || "").toLowerCase();
  const path = String(item.path || "").toLowerCase();
  // Missing visitor/session ids are data-quality issues, not proof that an event
  // is internal. Do not filter them here, otherwise the founder dashboard can
  // undercount production visitors. Invalid ids are excluded only when building
  // visitor/session sets.
  const internalEmails = (process.env.FOUNDER_ANALYTICS_INTERNAL_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return Boolean(
    metadataHasTemplateOrInternalSignals(metadata) ||
    item.is_local ||
    host.includes("localhost") ||
    host.includes("127.0.0.1") ||
    origin.includes("localhost") ||
    origin.includes("127.0.0.1") ||
    path.startsWith("/dev-tools") ||
    path.includes("dev-tools") ||
    metadata.devOverrideActive ||
    metadata.isInternalUser ||
    metadata.internalTest ||
    metadata.founderTest ||
    metadata.qaTest ||
    metadata.testEvent ||
    metadata.debug ||
    [
      "founder",
      "internal",
      "qa",
      "tester",
      "freelancer",
      "dev",
      "development",
      "localhost",
    ].includes(source) ||
    (email && internalEmails.includes(email)),
  );
}

function isVoiceFailureEventName(name: string) {
  return [
    "voice_failed",
    "vapi_failed",
    "vapi_connection_failed",
    "voice_connect_failed",
    "speech_recognition_error",
  ].includes(name);
}

function isVoiceStartEventName(name: string) {
  return ["voice_started", "vapi_connected", "vapi_connection_slow"].includes(
    name,
  );
}

function weakSignalsFrom(events: DbAnalyticsEvent[]) {
  const ignored = new Set([
    "ended",
    "paused",
    "completed",
    "finished",
    "done",
    "good answer. recruiter is ready to go deeper.",
  ]);
  const signals: string[] = [];
  for (const item of events) {
    const metadata = item.metadata || {};
    const raw =
      metadata.weakSignal ||
      metadata.weakness ||
      metadata.concern ||
      metadata.issue ||
      metadata.reason ||
      "";
    if (typeof raw !== "string") continue;
    const cleaned = raw.trim().slice(0, 80);
    if (!cleaned || ignored.has(cleaned.toLowerCase())) continue;
    signals.push(cleaned);
  }
  return countBy(signals);
}

function buildModePerformance(events: DbAnalyticsEvent[]) {
  const modes = Array.from(
    new Set(events.map((item) => item.mode || "unknown").filter(Boolean)),
  );
  return modes.reduce<
    Record<
      string,
      {
        starts: number;
        completions: number;
        voiceFailures: number;
        results: number;
        avgTrust: number | null;
      }
    >
  >((acc, mode) => {
    const modeEvents = events.filter(
      (item) => (item.mode || "unknown") === mode,
    );
    acc[mode] = {
      starts: modeEvents.filter(
        (item) => eventName(item) === "interview_started",
      ).length,
      completions: modeEvents.filter(
        (item) => eventName(item) === "interview_completed",
      ).length,
      voiceFailures: modeEvents.filter((item) =>
        isVoiceFailureEventName(eventName(item)),
      ).length,
      results: modeEvents.filter((item) => eventName(item) === "results_viewed")
        .length,
      avgTrust: avg(modeEvents.map((item) => item.trust)),
    };
    return acc;
  }, {});
}

// Per-plan breakdown, lets the founder see how Free vs Premium vs Premium Pro
// sessions behave differently (completion rate, voice reliability, etc).
// "plan" is read from event.metadata.plan, which trackWorkZoEvent() now
// attaches client-side based on the active plan / dev-tools override.
const PLAN_ORDER = ["free", "premium", "premium_pro"] as const;

function buildPlanBreakdown(
  events: DbAnalyticsEvent[],
  paidPlanCounts: Record<string, number> = {},
) {
  return PLAN_ORDER.reduce<
    Record<
      string,
      {
        sessions: number;
        uploads: number;
        interviewsStarted: number;
        completedInterviews: number;
        resultsViewed: number;
        voiceFailures: number;
        completionRate: number;
        avgTrust: number | null;
        paidUsers: number;
      }
    >
  >((acc, plan) => {
    const planEvents = events.filter((item) => planFrom(item) === plan);
    const sessions = new Set(
      planEvents.map((item) => item.session_id).filter(isValidSessionId),
    ).size;
    const interviewsStarted = planEvents.filter(
      (item) => eventName(item) === "interview_started",
    ).length;
    const completedInterviews = planEvents.filter(
      (item) => eventName(item) === "interview_completed",
    ).length;

    acc[plan] = {
      sessions,
      uploads: planEvents.filter((item) => eventName(item) === "cv_uploaded")
        .length,
      interviewsStarted,
      completedInterviews,
      resultsViewed: planEvents.filter(
        (item) => eventName(item) === "results_viewed",
      ).length,
      voiceFailures: planEvents.filter((item) =>
        isVoiceFailureEventName(eventName(item)),
      ).length,
      completionRate: pct(completedInterviews, interviewsStarted),
      avgTrust: avg(planEvents.map((item) => item.trust)),
      paidUsers: paidPlanCounts[plan] || 0,
    };
    return acc;
  }, {});
}

function buildUsageSummary(
  usageEvents: UsageEvent[] = [],
  configured = true,
  reason?: string,
): UsageSummary {
  const withUser = usageEvents.filter((item) => item.user_id);
  const signedInUsers = new Set(
    withUser.map((item) => item.user_id).filter(Boolean),
  ).size;
  const activeSignedInUsers7d = new Set(
    withUser
      .filter((item) => isAfter(item.created_at, daysAgo(7)))
      .map((item) => item.user_id)
      .filter(Boolean),
  ).size;
  const activeSignedInUsers30d = new Set(
    withUser
      .filter((item) => isAfter(item.created_at, daysAgo(30)))
      .map((item) => item.user_id)
      .filter(Boolean),
  ).size;

  return {
    configured,
    signedInUsers,
    activeSignedInUsers7d,
    activeSignedInUsers30d,
    totalUsageEvents: usageEvents.length,
    featureCounts: countBy(
      usageEvents.map((item) => item.event_name || "unknown_event"),
    ),
    planCounts: countBy(usageEvents.map((item) => item.plan || "free")),
    ...(reason ? { reason } : {}),
  };
}

function normalizePlanKey(value: unknown) {
  const plan = String(value || "free")
    .trim()
    .toLowerCase();
  if (plan === "pro") return "premium_pro";
  if (plan === "premiumpro" || plan === "premium-pro") return "premium_pro";
  if (plan === "premium") return "premium";
  return "free";
}

function isRealPaidSubscription(row: SubscriptionRow) {
  const plan = normalizePlanKey(row.plan_tier || row.plan);
  return Boolean(
    row.user_id &&
    row.stripe_subscription_id &&
    (plan === "premium" || plan === "premium_pro"),
  );
}

function buildPaidSubscriptionSummary(
  rows: SubscriptionRow[] = [],
  configured = true,
  reason?: string,
): PaidSubscriptionSummary {
  const uniqueByUserAndPlan = new Map<string, SubscriptionRow>();

  for (const row of rows) {
    if (!isRealPaidSubscription(row)) continue;
    const plan = normalizePlanKey(row.plan_tier || row.plan);
    uniqueByUserAndPlan.set(`${row.user_id}:${plan}`, row);
  }

  const planCounts = countBy(
    Array.from(uniqueByUserAndPlan.values()).map((row) =>
      normalizePlanKey(row.plan_tier || row.plan),
    ),
  );

  return {
    configured,
    paidUsers: Array.from(uniqueByUserAndPlan.values()).length,
    planCounts,
    ...(reason ? { reason } : {}),
  };
}

async function readPaidSubscriptionSummary(
  supabase: ReturnType<typeof getSupabaseAdmin>,
): Promise<PaidSubscriptionSummary> {
  if (!supabase) {
    return buildPaidSubscriptionSummary([], false, "supabase_not_configured");
  }

  try {
    const { data, error } = await supabase
      .from("workzo_subscriptions")
      .select("user_id, plan, plan_tier, status, stripe_subscription_id")
      .limit(10000);
    if (error) {
      return buildPaidSubscriptionSummary([], false, error.message);
    }
    return buildPaidSubscriptionSummary(
      (data || []) as SubscriptionRow[],
      true,
    );
  } catch (error) {
    return buildPaidSubscriptionSummary(
      [],
      false,
      error instanceof Error ? error.message : String(error),
    );
  }
}

function isValidVisitorId(value: string | null | undefined) {
  const id = String(value || "")
    .trim()
    .toLowerCase();
  return Boolean(
    id && id !== "unknown_visitor" && id !== "null" && id !== "undefined",
  );
}

function isValidSessionId(value: string | null | undefined) {
  const id = String(value || "")
    .trim()
    .toLowerCase();
  return Boolean(
    id && id !== "unknown_session" && id !== "null" && id !== "undefined",
  );
}

async function readAllAnalyticsEvents(
  supabase: ReturnType<typeof getSupabaseAdmin>,
): Promise<{ rows: DbAnalyticsEvent[]; error: any | null }> {
  if (!supabase) return { rows: [], error: null };

  const pageSize = 1000;
  const maxRows = 50000;
  let from = 0;
  const rows: DbAnalyticsEvent[] = [];

  while (from < maxRows) {
    const to = Math.min(from + pageSize - 1, maxRows - 1);
    const { data, error } = await supabase
      .from("workzo_analytics_events")
      .select(
        "event, visitor_id, session_id, path, source, referrer, host, origin, is_local, environment, deployment, device_type, user_agent, role, market, recruiter, mode, score, trust, pressure, metadata, client_timestamp, created_at",
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) return { rows, error };

    const batch = (data || []) as DbAnalyticsEvent[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return { rows, error: null };
}

async function readUsageSummary(
  supabase: ReturnType<typeof getSupabaseAdmin>,
): Promise<UsageSummary> {
  if (!supabase) return buildUsageSummary([], false, "supabase_not_configured");

  try {
    const { data, error } = await supabase
      .from("workzo_usage_events")
      .select("user_id, event_name, plan, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(3000);

    if (error) {
      return buildUsageSummary(
        [],
        false,
        error.message || "usage_table_read_failed",
      );
    }

    return buildUsageSummary((data || []) as UsageEvent[], true);
  } catch (error) {
    return buildUsageSummary(
      [],
      false,
      error instanceof Error ? error.message : String(error),
    );
  }
}

function buildAnalyticsResponse(
  allEvents: DbAnalyticsEvent[],
  usageSummary: UsageSummary = buildUsageSummary([]),
  includeLocal = false,
  paidSummary: PaidSubscriptionSummary = buildPaidSubscriptionSummary([]),
) {
  // Exclude founder/internal/QA/freelancer test events from production metrics.
  // When includeLocal=true (founder viewing from localhost or with ?all=1),
  // localhost events are INCLUDED so the founder can see their own test sessions.
  const isInternal = (item: DbAnalyticsEvent) => {
    if (includeLocal) {
      // When founder opts in, only filter true internal signals (qa_test, template CVs etc)
      // but NOT localhost, the founder IS on localhost.
      const metadata = item.metadata || {};
      return Boolean(
        metadataHasTemplateOrInternalSignals(metadata) ||
        metadata.devOverrideActive ||
        metadata.isInternalUser ||
        metadata.internalTest ||
        metadata.founderTest ||
        metadata.qaTest ||
        metadata.testEvent,
      );
    }
    return isInternalAnalyticsEvent(item);
  };
  const internalEvents = allEvents.filter(isInternal);
  const events = allEvents.filter((item) => !isInternal(item));

  const counts = countBy(events.map(eventName));
  const sessions = new Set(
    events.map((item) => item.session_id).filter(isValidSessionId),
  );
  const visitors = new Set(
    events.map((item) => item.visitor_id).filter(isValidVisitorId),
  );
  const activeVisitors7d = new Set(
    events
      .filter((item) => isAfter(item.created_at, daysAgo(7)))
      .map((item) => item.visitor_id)
      .filter(isValidVisitorId),
  );
  const activeVisitors30d = new Set(
    events
      .filter((item) => isAfter(item.created_at, daysAgo(30)))
      .map((item) => item.visitor_id)
      .filter(isValidVisitorId),
  );

  // Merge usage_events counts into funnel metrics.
  // workzo_usage_events receives events from recordWorkZoInterviewStarted() etc -
  // these are sent from the client regardless of localhost/dev host.
  // workzo_analytics_events cv_uploaded is blocked on localhost by shouldSkipProductionAnalytics().
  // Using Math.max means we always surface the real count from whichever table has it.
  const usageFC = usageSummary.featureCounts || {};
  const uploads = Math.max(counts.cv_uploaded || 0, usageFC.cv_uploaded || 0);
  const interviewsStarted = Math.max(
    counts.interview_started || 0,
    usageFC.interview_started || 0,
  );
  const answersSubmitted = Math.max(
    counts.answer_submitted || 0,
    usageFC.answer_submitted || 0,
  );
  const voiceStarts = Object.entries(counts)
    .filter(([name]) => isVoiceStartEventName(name))
    .reduce((sum, [, count]) => sum + count, 0);
  const voiceFailures = Object.entries(counts)
    .filter(([name]) => isVoiceFailureEventName(name))
    .reduce((sum, [, count]) => sum + count, 0);
  const voicePaused = counts.voice_paused || 0;
  const voiceRecovered = counts.voice_recovered || 0;
  const completedInterviews = Math.max(
    counts.interview_completed || 0,
    usageFC.interview_completed || 0,
  );
  const resultsViewed = Math.max(
    counts.results_viewed || 0,
    usageFC.results_viewed || 0,
  );
  const dropoffFunnel = [
    { stage: "Page views", count: counts.page_view || 0 },
    { stage: "CV uploads", count: uploads },
    { stage: "Interview starts", count: interviewsStarted },
    { stage: "Answers submitted", count: answersSubmitted },
    { stage: "Completed interviews", count: completedInterviews },
    { stage: "Results viewed", count: resultsViewed },
  ];
  const weakSignals = weakSignalsFrom(events);
  const topWeakness =
    Object.entries(weakSignals).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    "Not enough data yet";
  const completionRate = pct(completedInterviews, interviewsStarted);
  const resultRate = pct(
    resultsViewed,
    completedInterviews || interviewsStarted,
  );
  const answerRate = pct(answersSubmitted, interviewsStarted);
  const voiceFailureRate = pct(voiceFailures, voiceStarts || interviewsStarted);
  let insight = "No analytics collected yet.";
  if (events.length > 0) {
    if (interviewsStarted === 0)
      insight =
        "Visitors are reaching WorkZo, but interview starts are not being tracked yet.";
    else if (completionRate < 35)
      insight =
        "Interview completion is low. Check onboarding friction, voice reliability, and interview room clarity.";
    else if (voiceFailureRate > 15)
      insight =
        "Voice failure rate is high. Prioritize Vapi/fallback reliability before launch.";
    else
      insight =
        "Analytics are live. Track completion rate, voice failures, and result views after each tester session.";
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
    totalEvents: allEvents.length,
    productionEvents: events.length,
    internalEvents: internalEvents.length,
    totalUniqueVisitors: visitors.size,
    uniqueVisitorsAllTime: visitors.size,
    uniqueVisitors: visitors.size,
    activeVisitors7d: activeVisitors7d.size,
    activeVisitors30d: activeVisitors30d.size,
    signedInUsers: usageSummary.signedInUsers,
    activeSignedInUsers7d: usageSummary.activeSignedInUsers7d,
    activeSignedInUsers30d: usageSummary.activeSignedInUsers30d,
    totalUsageEvents: usageSummary.totalUsageEvents,
    usageFeatureCounts: usageSummary.featureCounts,
    usagePlanCounts: usageSummary.planCounts,
    usageConfigured: usageSummary.configured,
    usageReason: usageSummary.reason || "",
    paidUsers: paidSummary.paidUsers,
    paidPlanCounts: paidSummary.planCounts,
    paidConfigured: paidSummary.configured,
    paidReason: paidSummary.reason || "",
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
    recruiters: countUniqueSessionsByNormalizedField(
      events,
      (item) => normalizeRecruiterForAnalytics(item.recruiter),
      ["interview_started", "interview_room_viewed", "interview_completed"],
    ),
    roles: countUniqueSessionsByNormalizedField(
      events,
      (item) => normalizeRoleForAnalytics(item.role),
      ["interview_started", "cv_uploaded", "onboarding_viewed"],
    ),
    rawRoles: countBy(events.map((item) => item.role || "").filter(Boolean)),
    modes: countBy(events.map((item) => item.mode || "unknown")),
    trafficSources: countBy(
      events.map((item) => item.source || "Direct / unknown"),
    ),
    weakSignals,
    dropoffFunnel,
    modePerformance: buildModePerformance(events),
    planBreakdown: buildPlanBreakdown(events, paidSummary.planCounts),
    internalTestEvents: internalEvents.length,
    devTestEvents: internalEvents.length,
    topWeakness,
    insight,
  };

  return {
    ok: true,
    configured: true,
    summary,
    metrics: {
      totalEvents: allEvents.length,
      productionEvents: events.length,
      internalEvents: internalEvents.length,
      totalUniqueVisitors: visitors.size,
      uniqueVisitorsAllTime: visitors.size,
      uniqueVisitors: visitors.size,
      activeVisitors7d: activeVisitors7d.size,
      activeVisitors30d: activeVisitors30d.size,
      signedInUsers: usageSummary.signedInUsers,
      activeSignedInUsers7d: usageSummary.activeSignedInUsers7d,
      activeSignedInUsers30d: usageSummary.activeSignedInUsers30d,
      totalUsageEvents: usageSummary.totalUsageEvents,
      paidUsers: paidSummary.paidUsers,
      paidPlanCounts: paidSummary.planCounts,
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
    if (!supabase)
      return NextResponse.json({
        ok: true,
        stored: false,
        reason: "supabase_not_configured",
      });
    const event = normalizeEvent(body, request);
    const { error } = await supabase
      .from("workzo_analytics_events")
      .insert(event);
    if (error) {
      console.error("[WorkZo analytics] insert failed", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      return NextResponse.json({
        ok: true,
        stored: false,
        reason: "insert_failed",
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
    }
    return NextResponse.json({ ok: true, stored: true });
  } catch (error) {
    console.error("[WorkZo analytics] route failed", error);
    return NextResponse.json({
      ok: true,
      stored: false,
      reason: "route_failed",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function isFounderAuthorized(request: Request): boolean {
  // Allow localhost (dev)
  if (isLocalRequestFromHeaders(request.headers)) return true;
  // Allow requests that present the FOUNDER_ANALYTICS_SECRET header
  const secret = request.headers.get("x-founder-secret");
  const envSecret = process.env.FOUNDER_ANALYTICS_SECRET;
  if (envSecret && secret === envSecret) return true;
  // Allow requests with ?secret=xxx query param (for bookmarklet use)
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  if (envSecret && querySecret === envSecret) return true;
  return false;
}

export async function GET(request: Request) {
  try {
    if (!isFounderAuthorized(request)) {
      return NextResponse.json(
        { ok: false, reason: "unauthorized" },
        { status: 404 },
      );
    }
    const supabase = getSupabaseAdmin();
    if (!supabase)
      return NextResponse.json({
        ok: true,
        configured: false,
        summary: buildAnalyticsResponse(
          [],
          buildUsageSummary([], false, "supabase_not_configured"),
        ).summary,
        metrics: buildAnalyticsResponse(
          [],
          buildUsageSummary([], false, "supabase_not_configured"),
        ).metrics,
        events: [],
        reason: "supabase_not_configured",
      });
    const usageSummary = await readUsageSummary(supabase);
    const paidSummary = await readPaidSubscriptionSummary(supabase);
    const { rows: data, error } = await readAllAnalyticsEvents(supabase);
    if (error) {
      console.error("[WorkZo analytics] metrics read failed", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      return NextResponse.json({
        ok: true,
        configured: true,
        summary: buildAnalyticsResponse([], usageSummary, false, paidSummary)
          .summary,
        metrics: buildAnalyticsResponse([], usageSummary, false, paidSummary)
          .metrics,
        events: [],
        reason: "read_failed",
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
    }
    // ?all=1, include localhost/dev sessions in the founder view.
    // Useful when the founder is testing locally and wants to see their own sessions.
    // Only available to authenticated founders (already gated above).
    const url2 = new URL(request.url);
    const includeLocal = url2.searchParams.get("all") === "1";

    return NextResponse.json(
      buildAnalyticsResponse(
        (data || []) as DbAnalyticsEvent[],
        usageSummary,
        includeLocal,
        paidSummary,
      ),
    );
  } catch (error) {
    console.error("[WorkZo analytics] metrics route failed", error);
    return NextResponse.json({
      ok: true,
      configured: false,
      summary: buildAnalyticsResponse(
        [],
        buildUsageSummary([], false, "route_failed"),
      ).summary,
      metrics: buildAnalyticsResponse(
        [],
        buildUsageSummary([], false, "route_failed"),
      ).metrics,
      events: [],
      reason: "route_failed",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
