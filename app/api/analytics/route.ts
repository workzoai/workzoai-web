import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AnalyticsRow = {
  id?: number | string;
  host?: string | null;
  origin?: string | null;
  isLocal?: boolean | null;
  is_local?: boolean | null;
  environment?: string | null;
  deployment?: string | null;
  session_id?: string | null;
  sessionId?: string | null;
  event?: string | null;
  path?: string | null;
  source?: string | null;
  device?: string | null;
  recruiter?: string | null;
  mode?: string | null;
  role?: string | null;
  market?: string | null;
  created_at?: string | null;
  timestamp?: string | null;
  metadata?: Record<string, unknown> | null;
  details?: Record<string, unknown> | null;
};

type AnalyticsPayload = {
  sessionId?: string;
  host?: string;
  origin?: string;
  isLocal?: boolean;
  is_local?: boolean;
  environment?: string;
  deployment?: string;
  session_id?: string;
  event?: string;
  path?: string;
  source?: string;
  device?: string;
  recruiter?: string;
  mode?: string;
  role?: string;
  market?: string;
  metadata?: Record<string, unknown>;
  details?: Record<string, unknown>;
};

type FounderSummary = {
  totalEvents: number;
  uniqueSessions: number;
  interviewStarts: number;
  interviewCompleted: number;
  completionRate: number;

  // Event totals by device. Useful for volume, but not user/session counts.
  mobileEvents: number;
  desktopEvents: number;
  tabletEvents: number;
  unknownDeviceEvents: number;

  // Unique sessions by device. Use these for founder decisions about mobile/desktop adoption.
  mobileSessions: number;
  desktopSessions: number;
  tabletSessions: number;
  unknownDeviceSessions: number;

  recruiterCounts: Record<string, number>;
  eventCounts: Record<string, number>;
  errors: AnalyticsRow[];
  dropOffSignals: AnalyticsRow[];
};

const TABLE_NAME = "workzo_analytics_events";

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) return null;

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getHostnameFromUrl(value?: string | null) {
  if (!value) return "";
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return String(value).replace(/^https?:\/\//i, "").split("/")[0].split(":")[0].toLowerCase();
  }
}

function isBlockedAnalyticsHost(hostname?: string | null) {
  const host = String(hostname || "").toLowerCase().trim();
  if (!host) return false;

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

function isInternalAnalyticsPayload(value: Partial<AnalyticsPayload | AnalyticsRow>) {
  const metadata = ((value as AnalyticsPayload).metadata || (value as AnalyticsPayload).details || {}) as Record<string, unknown>;
  const host =
    (value as AnalyticsPayload).host ||
    getHostnameFromUrl((value as AnalyticsPayload).origin) ||
    getHostnameFromUrl(metadata.host as string | undefined) ||
    getHostnameFromUrl(metadata.origin as string | undefined);

  const environment = String((value as AnalyticsPayload).environment || metadata.environment || "").toLowerCase();
  const deployment = String((value as AnalyticsPayload).deployment || metadata.deployment || "").toLowerCase();
  const isLocal = Boolean(
    (value as AnalyticsPayload).isLocal ||
      (value as AnalyticsPayload).is_local ||
      metadata.isLocal ||
      metadata.is_local
  );

  return (
    isLocal ||
    isBlockedAnalyticsHost(host) ||
    environment === "development" ||
    environment === "test" ||
    deployment === "preview" ||
    deployment === "development"
  );
}

function normalizeDevice(value?: string | null) {
  const text = String(value || "").toLowerCase();
  if (text.includes("tablet") || text.includes("ipad")) return "tablet";
  if (
    text.includes("mobile") ||
    text.includes("iphone") ||
    text.includes("android") ||
    text.includes("safari mobile")
  ) {
    return "mobile";
  }
  if (text.includes("desktop") || text.includes("windows") || text.includes("mac") || text.includes("linux")) {
    return "desktop";
  }
  return "unknown";
}

function normalizeEvent(row: AnalyticsRow): AnalyticsRow {
  return {
    ...row,
    host: row.host || getHostnameFromUrl(row.origin) || null,
    origin: row.origin || null,
    isLocal: Boolean(row.isLocal || row.is_local),
    session_id: row.session_id || row.sessionId || "unknown-session",
    event: row.event || "unknown_event",
    path: row.path || "/",
    source: row.source || "Direct / unknown",
    device: normalizeDevice(row.device),
    recruiter: row.recruiter || null,
    mode: row.mode || null,
    role: row.role || null,
    market: row.market || null,
    created_at: row.created_at || row.timestamp || null,
    metadata: row.metadata || row.details || {},
  };
}

function increment(map: Record<string, number>, key?: string | null) {
  const clean = (key || "Unknown").trim() || "Unknown";
  map[clean] = (map[clean] || 0) + 1;
}

function buildSummary(rows: AnalyticsRow[]): FounderSummary {
  const productionRows = rows.filter((row) => !isInternalAnalyticsPayload(row));
  const normalized = productionRows.map(normalizeEvent);
  const eventCounts: Record<string, number> = {};
  const recruiterCounts: Record<string, number> = {};
  const sessions = new Set<string>();
  const sessionDevices = new Map<string, "desktop" | "mobile" | "tablet" | "unknown">();

  let mobileEvents = 0;
  let desktopEvents = 0;
  let tabletEvents = 0;
  let unknownDeviceEvents = 0;

  for (const row of normalized) {
    increment(eventCounts, row.event);
    if (row.recruiter) increment(recruiterCounts, row.recruiter);
    if (row.session_id) sessions.add(row.session_id);

    const device = normalizeDevice(row.device) as "desktop" | "mobile" | "tablet" | "unknown";
    if (device === "mobile") mobileEvents += 1;
    else if (device === "desktop") desktopEvents += 1;
    else if (device === "tablet") tabletEvents += 1;
    else unknownDeviceEvents += 1;

    const sessionId = row.session_id || "unknown-session";
    const currentDevice = sessionDevices.get(sessionId);

    // Prefer a real device over unknown for the same session. If a session appears
    // on multiple device types, keep the first known device to avoid double-counting.
    if (!currentDevice || currentDevice === "unknown") {
      sessionDevices.set(sessionId, device);
    }
  }

  let mobileSessions = 0;
  let desktopSessions = 0;
  let tabletSessions = 0;
  let unknownDeviceSessions = 0;

  for (const device of sessionDevices.values()) {
    if (device === "mobile") mobileSessions += 1;
    else if (device === "desktop") desktopSessions += 1;
    else if (device === "tablet") tabletSessions += 1;
    else unknownDeviceSessions += 1;
  }

  const interviewStarts =
    (eventCounts.interview_started || 0) +
    (eventCounts.start_interview || 0) +
    (eventCounts.voice_interview_started || 0);

  const interviewCompleted =
    (eventCounts.interview_completed || 0) +
    (eventCounts.interview_ended || 0) +
    (eventCounts.results_viewed || 0);

  const completionRate = interviewStarts > 0 ? Math.round((interviewCompleted / interviewStarts) * 100) : 0;

  const errors = normalized.filter((row) => {
    const event = String(row.event || "").toLowerCase();
    return event.includes("error") || event.includes("failed") || event.includes("voice_error");
  });

  const dropOffSignals = normalized.filter((row) => {
    const event = String(row.event || "").toLowerCase();
    return event.includes("drop") || event.includes("abandon") || event.includes("interrupted") || event.includes("fallback");
  });

  return {
    totalEvents: normalized.length,
    uniqueSessions: sessions.size,
    interviewStarts,
    interviewCompleted,
    completionRate,
    mobileEvents,
    desktopEvents,
    tabletEvents,
    unknownDeviceEvents,
    mobileSessions,
    desktopSessions,
    tabletSessions,
    unknownDeviceSessions,
    recruiterCounts,
    eventCounts,
    errors: errors.slice(0, 25),
    dropOffSignals: dropOffSignals.slice(0, 25),
  };
}

function detectDeviceFromRequest(req: NextRequest, explicit?: string) {
  if (explicit) return normalizeDevice(explicit);
  const ua = req.headers.get("user-agent") || "";
  return normalizeDevice(ua);
}

function getSource(req: NextRequest, explicit?: string) {
  if (explicit) return explicit;
  const ref = req.headers.get("referer") || "";
  if (ref.includes("producthunt")) return "Product Hunt";
  if (ref.includes("linkedin")) return "LinkedIn";
  if (ref.includes("instagram")) return "Instagram";
  if (ref.includes("google")) return "Google";
  return "Direct / unknown";
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Supabase env vars missing" }, { status: 500 });
    }

    const body = (await req.json().catch(() => ({}))) as AnalyticsPayload;
    const metadata = { ...(body.metadata || body.details || {}) };

    if (isInternalAnalyticsPayload(body)) {
      return NextResponse.json({ success: true, skipped: true, reason: "internal_or_preview_traffic" });
    }

    const payload = {
      session_id: body.session_id || body.sessionId || crypto.randomUUID(),
      event: body.event || "unknown_event",
      path: body.path || req.nextUrl.pathname || "/",
      source: getSource(req, body.source),
      device: detectDeviceFromRequest(req, body.device),
      recruiter: body.recruiter || null,
      mode: body.mode || null,
      role: body.role || null,
      market: body.market || null,
      metadata: {
        ...metadata,
        host: body.host || null,
        origin: body.origin || null,
        isLocal: Boolean(body.isLocal || body.is_local),
        environment: body.environment || process.env.NODE_ENV || null,
        deployment: body.deployment || process.env.VERCEL_ENV || null,
      },
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from(TABLE_NAME).insert(payload);

    if (error) {
      console.error("WorkZo analytics insert failed:", error);
      return NextResponse.json(
        { success: false, error: error.message, details: error.details, hint: error.hint },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown analytics POST error";
    console.error("WorkZo analytics POST crashed:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      const emptySummary = buildSummary([]);
      return NextResponse.json({
        success: false,
        error: "Supabase env vars missing",
        summary: emptySummary,
        stats: emptySummary,
        recentEvents: [],
        events: [],
      });
    }

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      console.error("WorkZo analytics fetch failed:", error);
      const emptySummary = buildSummary([]);
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          details: error.details,
          hint: error.hint,
          summary: emptySummary,
          stats: emptySummary,
          recentEvents: [],
          events: [],
        },
        { status: 200 }
      );
    }

    const rows = Array.isArray(data) ? (data as AnalyticsRow[]) : [];
    const productionRows = rows.filter((row) => !isInternalAnalyticsPayload(row));
    const summary = buildSummary(productionRows);

    return NextResponse.json({
      success: true,
      summary,
      stats: summary,
      recentEvents: productionRows.slice(0, 50).map(normalizeEvent),
      events: productionRows.map(normalizeEvent),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown analytics GET error";
    console.error("WorkZo analytics GET crashed:", error);
    const emptySummary = buildSummary([]);
    return NextResponse.json(
      {
        success: false,
        error: message,
        summary: emptySummary,
        stats: emptySummary,
        recentEvents: [],
        events: [],
      },
      { status: 200 }
    );
  }
}
