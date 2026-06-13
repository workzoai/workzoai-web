"use client";

import { getWorkZoAnalyticsSessionId, getWorkZoVisitorId, trackWorkZoEvent } from "@/lib/workzoAnalytics";

export type WorkZoTelemetryEventName =
  | "interview_started"
  | "interview_completed"
  | "interview_abandoned"
  | "vapi_connected"
  | "vapi_failed"
  | "fallback_activated"
  | "reconnect_attempted"
  | "runtime_issue";

export type WorkZoTelemetryEvent = {
  id: string;
  event: WorkZoTelemetryEventName;
  createdAt: string;
  visitorId: string;
  sessionId: string;
  deviceType: "mobile" | "tablet" | "desktop" | "unknown";
  userAgent?: string;
  data?: Record<string, unknown>;
};

export type WorkZoFounderTelemetrySummary = {
  version: 2;
  updatedAt: string;
  counters: {
    interviewsStarted: number;
    interviewsCompleted: number;
    interviewsAbandoned: number;
    vapiFailures: number;
    fallbackActivated: number;
    reconnectAttempts: number;
    runtimeIssues: number;
  };
  events: WorkZoTelemetryEvent[];
};

const STORAGE_KEY = "workzo-founder-telemetry-v2";
const OLD_STORAGE_KEY = "workzo-founder-telemetry-v1";
const MAX_EVENTS = 500;

function getDeviceType(): WorkZoTelemetryEvent["deviceType"] {
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

function createEmptyTelemetry(): WorkZoFounderTelemetrySummary {
  return {
    version: 2,
    updatedAt: "",
    counters: {
      interviewsStarted: 0,
      interviewsCompleted: 0,
      interviewsAbandoned: 0,
      vapiFailures: 0,
      fallbackActivated: 0,
      reconnectAttempts: 0,
      runtimeIssues: 0,
    },
    events: [],
  };
}

function normalizeTelemetry(raw: unknown): WorkZoFounderTelemetrySummary {
  const empty = createEmptyTelemetry();

  if (!raw || typeof raw !== "object") return empty;
  const parsed = raw as Partial<WorkZoFounderTelemetrySummary> & { version?: number };
  const visitorId = typeof window !== "undefined" ? getWorkZoVisitorId() : "";
  const sessionId = typeof window !== "undefined" ? getWorkZoAnalyticsSessionId() : "";

  return {
    version: 2,
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    counters: {
      ...empty.counters,
      ...(parsed.counters || {}),
    },
    events: Array.isArray(parsed.events)
      ? parsed.events.slice(0, MAX_EVENTS).map((event: any) => ({
          id: String(event?.id || `${event?.event || "event"}-${event?.createdAt || Date.now()}`),
          event: event?.event || "runtime_issue",
          createdAt: String(event?.createdAt || new Date().toISOString()),
          visitorId: String(event?.visitorId || visitorId),
          sessionId: String(event?.sessionId || sessionId),
          deviceType: event?.deviceType || "unknown",
          userAgent: event?.userAgent || "",
          data: event?.data && typeof event.data === "object" ? event.data : {},
        }))
      : [],
  };
}

export function readFounderTelemetry(): WorkZoFounderTelemetrySummary {
  if (typeof window === "undefined") return createEmptyTelemetry();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeTelemetry(JSON.parse(raw));

    const oldRaw = window.localStorage.getItem(OLD_STORAGE_KEY);
    if (oldRaw) {
      const migrated = normalizeTelemetry(JSON.parse(oldRaw));
      saveFounderTelemetry(migrated);
      return migrated;
    }

    return createEmptyTelemetry();
  } catch {
    return createEmptyTelemetry();
  }
}

export function saveFounderTelemetry(next: WorkZoFounderTelemetrySummary) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...next,
        version: 2,
        updatedAt: new Date().toISOString(),
        events: next.events.slice(0, MAX_EVENTS),
      }),
    );
  } catch {
    // Do not let analytics ever affect the interview runtime.
  }
}

export function recordFounderTelemetryEvent(
  event: WorkZoTelemetryEventName,
  data: Record<string, unknown> = {},
) {
  if (typeof window === "undefined") return;

  const current = readFounderTelemetry();
  const createdAt = new Date().toISOString();
  const visitorId = getWorkZoVisitorId();
  const sessionId = getWorkZoAnalyticsSessionId();

  const nextEvent: WorkZoTelemetryEvent = {
    id: `${event}-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    event,
    createdAt,
    visitorId,
    sessionId,
    deviceType: getDeviceType(),
    userAgent: navigator.userAgent || "",
    data,
  };

  saveFounderTelemetry({
    ...current,
    updatedAt: createdAt,
    events: [nextEvent, ...current.events].slice(0, MAX_EVENTS),
  });

  trackWorkZoEvent({
    event,
    visitorId,
    sessionId,
    metadata: {
      telemetry: true,
      ...data,
    },
  });
}

export function incrementFounderTelemetryCounter(
  counterName: keyof WorkZoFounderTelemetrySummary["counters"],
  amount = 1,
) {
  if (typeof window === "undefined") return;

  const current = readFounderTelemetry();

  saveFounderTelemetry({
    ...current,
    counters: {
      ...current.counters,
      [counterName]: Math.max(0, (current.counters[counterName] || 0) + amount),
    },
    updatedAt: new Date().toISOString(),
  });
}

export function recordFounderTelemetryRuntimeIssue(
  event: Extract<WorkZoTelemetryEventName, "vapi_failed" | "reconnect_attempted" | "runtime_issue">,
  error: unknown,
  data: Record<string, unknown> = {},
) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : (() => {
            try {
              return JSON.stringify(error);
            } catch {
              return String(error || "unknown_error");
            }
          })();

  if (event === "vapi_failed") {
    incrementFounderTelemetryCounter("vapiFailures");
  } else if (event === "reconnect_attempted") {
    incrementFounderTelemetryCounter("reconnectAttempts");
  } else {
    incrementFounderTelemetryCounter("runtimeIssues");
  }

  recordFounderTelemetryEvent(event, {
    ...data,
    errorMessage: String(message || "unknown_error").slice(0, 700),
  });
}

export function clearFounderTelemetry() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(OLD_STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
