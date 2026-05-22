"use client";

export type WorkZoEventName =
  | "page_view"
  | "cv_uploaded"
  | "cv_memory_ready"
  | "interview_room_viewed"
  | "interview_started"
  | "answer_submitted"
  | "voice_started"
  | "voice_stopped"
  | "voice_failed"
  | "voice_paused"
  | "voice_recovered"
  | "voice_interruption"
  | "results_viewed"
  | "setup_cleared"
  | "product_hunt_asset_viewed";

export type WorkZoAnalyticsPayload = {
  event: WorkZoEventName;
  sessionId?: string;
  setupId?: string;
  role?: string;
  market?: string;
  recruiter?: string;
  mode?: "text" | "voice";
  score?: number;
  trust?: number;
  pressure?: number;
  metadata?: Record<string, unknown>;
};

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
    host.endsWith(".localhost") ||
    host.includes("vercel.app")
  );
}

function shouldSkipProductionAnalytics() {
  if (typeof window === "undefined") return true;
  if (process.env.NODE_ENV !== "production") return true;
  if (process.env.NEXT_PUBLIC_WORKZO_DISABLE_ANALYTICS === "true") return true;
  if (isBlockedAnalyticsHost(window.location.hostname)) return true;
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

function getOrCreateSessionId() {
  if (typeof window === "undefined") return "";

  const key = "workzo-analytics-session";
  const existing = window.localStorage.getItem(key);

  if (existing) return existing;

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  window.localStorage.setItem(key, id);
  return id;
}

function storeLocalAnalyticsEvent(body: Record<string, unknown>) {
  try {
    const key = "workzo-founder-local-events";
    const existing = JSON.parse(window.localStorage.getItem(key) || "[]") as unknown[];
    existing.push(body);
    window.localStorage.setItem(key, JSON.stringify(existing.slice(-1000)));
  } catch {}
}

export function trackWorkZoEvent(payload: WorkZoAnalyticsPayload) {
  if (typeof window === "undefined") return;

  const isInternal = shouldSkipProductionAnalytics();

  const body = {
    ...payload,
    sessionId: payload.sessionId || getOrCreateSessionId(),
    path: window.location.pathname,
    referrer: document.referrer,
    source: trafficSource(),
    host: window.location.hostname,
    origin: window.location.origin,
    isLocal: isInternal,
    environment: process.env.NODE_ENV,
    deployment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || null,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
  };

  storeLocalAnalyticsEvent(body);

  if (isInternal) return;

  try {
    const serialized = JSON.stringify(body);

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

export function getWorkZoAnalyticsSessionId() {
  return getOrCreateSessionId();
}
