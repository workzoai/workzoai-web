"use client";

import { getWorkZoDevPlanOverride } from "@/lib/workzoUsageTracker";
import { normalizeWorkZoPlan } from "@/lib/workzoPlanLimits";

export type WorkZoEventName =
  | "page_view"
  | "cv_uploaded"
  | "cv_memory_ready"
  | "interview_room_viewed"
  | "interview_started"
  | "interview_completed"
  | "interview_abandoned"
  | "answer_submitted"
  | "voice_started"
  | "voice_stopped"
  | "voice_failed"
  | "voice_paused"
  | "voice_recovered"
  | "voice_interruption"
  | "vapi_connected"
  | "vapi_failed"
  | "fallback_activated"
  | "reconnect_attempted"
  | "runtime_issue"
  | "results_viewed"
  | "setup_cleared"
  | "product_hunt_asset_viewed";

export type WorkZoAnalyticsPayload = {
  event: WorkZoEventName;
  sessionId?: string;
  visitorId?: string;
  setupId?: string;
  role?: string;
  market?: string;
  recruiter?: string;
  mode?: "text" | "voice" | "video";
  score?: number;
  trust?: number;
  pressure?: number;
  metadata?: Record<string, unknown>;
};

const VISITOR_ID_KEY = "workzo-visitor-id-v1";
const SESSION_ID_KEY = "workzo-analytics-session-v2";
const SESSION_STARTED_AT_KEY = "workzo-analytics-session-started-at-v2";
const LOCAL_EVENTS_KEY = "workzo-founder-local-events";
const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_LOCAL_EVENTS = 1500;

function createId(prefix: string) {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  return `${prefix}_${id}`;
}

function safeLocalStorageGet(key: string) {
  try {
    return window.localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function safeLocalStorageSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Analytics must never break the product.
  }
}

function isBlockedAnalyticsHost(hostname: string) {
  const host = hostname.toLowerCase().trim();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.startsWith("192.168.") ||
    host.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
    host.endsWith(".local") ||
    host.endsWith(".test") ||
    host.endsWith(".localhost")
  );
}

function shouldSendServerAnalytics() {
  if (typeof window === "undefined") return false;
  if (process.env.NEXT_PUBLIC_WORKZO_DISABLE_ANALYTICS === "true") return false;
  // Allow localhost when NEXT_PUBLIC_WORKZO_ANALYTICS_LOCAL=true in .env.local
  if (isBlockedAnalyticsHost(window.location.hostname)) {
    return process.env.NEXT_PUBLIC_WORKZO_ANALYTICS_LOCAL === "true";
  }
  return true;
}

function trafficSource() {
  if (typeof window === "undefined") return "Direct / unknown";

  const params = new URLSearchParams(window.location.search);
  const explicit =
    params.get("utm_source") ||
    params.get("ref") ||
    params.get("source") ||
    params.get("referrer");

  if (explicit) return explicit;

  const referrer = document.referrer.toLowerCase();
  if (referrer.includes("producthunt")) return "Product Hunt";
  if (referrer.includes("linkedin")) return "LinkedIn";
  if (referrer.includes("instagram")) return "Instagram";
  if (referrer.includes("reddit")) return "Reddit";
  if (referrer.includes("twitter") || referrer.includes("x.com")) return "X/Twitter";
  if (referrer.includes("google")) return "Google";
  if (referrer.includes("bing")) return "Bing";

  return "Direct / unknown";
}

export function getWorkZoVisitorId() {
  if (typeof window === "undefined") return "";

  const existing = safeLocalStorageGet(VISITOR_ID_KEY);
  if (existing) return existing;

  const visitorId = createId("visitor");
  safeLocalStorageSet(VISITOR_ID_KEY, visitorId);
  return visitorId;
}

function getOrCreateSessionId() {
  if (typeof window === "undefined") return "";

  const existing = safeLocalStorageGet(SESSION_ID_KEY);
  const startedAtRaw = safeLocalStorageGet(SESSION_STARTED_AT_KEY);
  const startedAt = Number(startedAtRaw || 0);
  const now = Date.now();

  if (existing && Number.isFinite(startedAt) && now - startedAt < SESSION_TTL_MS) {
    return existing;
  }

  const sessionId = createId("session");
  safeLocalStorageSet(SESSION_ID_KEY, sessionId);
  safeLocalStorageSet(SESSION_STARTED_AT_KEY, String(now));
  return sessionId;
}

function storeLocalAnalyticsEvent(body: Record<string, unknown>) {
  if (typeof window === "undefined") return;

  try {
    const existing = JSON.parse(window.localStorage.getItem(LOCAL_EVENTS_KEY) || "[]") as unknown[];
    const list = Array.isArray(existing) ? existing : [];
    list.push(body);
    window.localStorage.setItem(LOCAL_EVENTS_KEY, JSON.stringify(list.slice(-MAX_LOCAL_EVENTS)));
  } catch {
    // ignore
  }
}

function getDeviceType() {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent || "";

  const isTablet =
    /ipad|tablet/i.test(ua) ||
    (/android/i.test(ua) && !/mobile/i.test(ua)) ||
    (typeof window !== "undefined" && window.innerWidth >= 700 && window.innerWidth <= 1180 && /touch/i.test(ua));

  if (isTablet) return "tablet";
  if (/iphone|ipod|android|mobile/i.test(ua)) return "mobile";
  return "desktop";
}

function cleanMetadata(metadata: Record<string, unknown> | undefined) {
  if (!metadata || typeof metadata !== "object") return {};

  try {
    return JSON.parse(JSON.stringify(metadata).slice(0, 7000)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// Resolve the plan to attach to every analytics event, so founder analytics
// can be segmented by Free / Premium / Premium Pro without a DB migration —
// it's just an extra field inside the existing `metadata` JSON column.
// Priority: an active dev-tools plan override (so test sessions are clearly
// labeled), then the last plan resolved by useWorkZoAuthoritativePlan
// (cached in localStorage as "workzo_plan"), falling back to "free".
function currentPlanForAnalytics(): string {
  if (typeof window === "undefined") return "free";

  try {
    const override = getWorkZoDevPlanOverride();
    if (override) return normalizeWorkZoPlan(override);
  } catch {
    // Ignore — fall through to stored plan.
  }

  try {
    const stored = window.localStorage.getItem("workzo_plan") || window.localStorage.getItem("workzo_plan_type");
    if (stored) return normalizeWorkZoPlan(stored);
  } catch {
    // Ignore — default to free.
  }

  return "free";
}

export function trackWorkZoEvent(payload: WorkZoAnalyticsPayload) {
  if (typeof window === "undefined") return;

  const visitorId = payload.visitorId || getWorkZoVisitorId();
  const sessionId = payload.sessionId || getOrCreateSessionId();
  const isLocal = !shouldSendServerAnalytics();
  const plan = currentPlanForAnalytics();
  const devOverrideActive = Boolean(getWorkZoDevPlanOverride());

  const body = {
    ...payload,
    visitorId,
    sessionId,
    event: payload.event,
    path: window.location.pathname,
    referrer: document.referrer,
    source: trafficSource(),
    host: window.location.hostname,
    origin: window.location.origin,
    isLocal,
    deviceType: getDeviceType(),
    environment: process.env.NODE_ENV,
    deployment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || null,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    metadata: { ...cleanMetadata(payload.metadata), plan, devOverrideActive },
  };

  storeLocalAnalyticsEvent(body);

  if (isLocal) return;

  try {
    const serialized = JSON.stringify(body);

    if (navigator.sendBeacon) {
      const ok = navigator.sendBeacon(
        "/api/analytics",
        new Blob([serialized], { type: "application/json" }),
      );
      if (ok) return;
    }

    void fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: serialized,
      keepalive: true,
    });
  } catch {
    // Analytics must never break the user flow.
  }
}

export function getWorkZoAnalyticsSessionId() {
  return getOrCreateSessionId();
}

export function readWorkZoLocalAnalyticsEvents() {
  if (typeof window === "undefined") return [] as Array<Record<string, unknown>>;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(LOCAL_EVENTS_KEY) || "[]");
    return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [];
  } catch {
    return [] as Array<Record<string, unknown>>;
  }
}
