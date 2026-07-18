"use client";

import { getWorkZoVisitorId } from "@/lib/workzoAnalytics";

export type WorkZoEventName =
  | "landing_viewed"
  | "onboarding_viewed"
  | "cv_uploaded"
  | "jd_added"
  | "interview_started"
  | "interview_completed"
  | "voice_started"
  | "voice_failed"
  | "voice_error"
  | "voice_paused"
  | "voice_recovered"
  | "video_failed"
  | "video_fallback_used"
  | "copilot_opened"
  | "copilot_action_used"
  | "results_viewed"
  | "weak_answer_retried"
  | "feedback_submitted"
  | "waitlist_joined"
  /* Smart Apply funnel (spec section 23). Payloads carry NO PII: no CV text, no
     cover-letter text, no email. See lib/smart-apply/analytics.ts, which is the only
     thing that should emit these and enforces that rule at the boundary. */
  | "smart_apply_started"
  | "smart_apply_cv_generated"
  | "smart_apply_cover_letter_generated"
  | "smart_apply_interview_prepared"
  | "smart_apply_linkedin_advice_viewed"
  | "smart_apply_external_apply_clicked";

export type WorkZoAnalyticsPayload = {
  event: WorkZoEventName;
  setupId?: string;
  role?: string;
  market?: string;
  recruiter?: string;
  mode?: "voice" | "vapi" | "video" | "standard" | "copilot";
  score?: number;
  trust?: number;
  pressure?: number;
  metadata?: Record<string, string | number | boolean | null | undefined>;
};

const STORAGE_KEY = "workzo-beta-analytics-events";

function safeNow() {
  return new Date().toISOString();
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

function shouldSkipProductionAnalytics() {
  if (typeof window === "undefined") return true;
  if (process.env.NEXT_PUBLIC_WORKZO_DISABLE_ANALYTICS === "true") return true;
  // Allow localhost when founder debugging is explicitly enabled.
  // Set NEXT_PUBLIC_WORKZO_ANALYTICS_LOCAL=true in .env.local to send events from localhost.
  if (isBlockedAnalyticsHost(window.location.hostname)) {
    return process.env.NEXT_PUBLIC_WORKZO_ANALYTICS_LOCAL !== "true";
  }
  return false;
}

function trafficSource() {
  if (typeof window === "undefined") return "Direct / unknown";
  const params = new URLSearchParams(window.location.search);
  const explicit = params.get("utm_source") || params.get("ref") || params.get("source");
  if (explicit) return explicit;
  const referrer = document.referrer.toLowerCase();
  if (referrer.includes("producthunt")) return "Product Hunt";
  if (referrer.includes("linkedin")) return "LinkedIn";
  if (referrer.includes("instagram")) return "Instagram";
  if (referrer.includes("reddit")) return "Reddit";
  if (referrer.includes("twitter") || referrer.includes("x.com")) return "X/Twitter";
  return "Direct / unknown";
}

function getSessionId() {
  if (typeof window === "undefined") return "server";

  const key = "workzo-session-id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;

  const sessionId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `session_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  window.localStorage.setItem(key, sessionId);
  return sessionId;
}

function sendToFounderApi(item: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  if (shouldSkipProductionAnalytics()) return;
  try {
    const serialized = JSON.stringify(item);
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics", new Blob([serialized], { type: "application/json" }));
      return;
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

export function trackWorkZoLaunchEvent(payload: WorkZoAnalyticsPayload) {
  if (typeof window === "undefined") return;

  const isInternal = shouldSkipProductionAnalytics();

  const item = {
    ...payload,
    visitorId: getWorkZoVisitorId(),
    sessionId: getSessionId(),
    timestamp: safeNow(),
    path: window.location.pathname,
    referrer: document.referrer,
    source: trafficSource(),
    host: window.location.hostname,
    origin: window.location.origin,
    isLocal: isInternal,
    environment: process.env.NODE_ENV,
    deployment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || null,
    userAgent: navigator.userAgent,
  };

  try {
    const existing = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]") as unknown[];
    existing.push(item);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.slice(-500)));
  } catch {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([item]));
  }

  sendToFounderApi(item);

  if (process.env.NODE_ENV !== "production") {
    console.info("[WorkZo launch analytics]", item);
  }
}

export function readWorkZoLaunchEvents() {
  if (typeof window === "undefined") return [];

  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]") as unknown[];
  } catch {
    return [];
  }
}
