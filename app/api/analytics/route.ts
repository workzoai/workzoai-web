import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type AnalyticsEvent = {
  id?: number;
  session_id?: string | null;
  event?: string | null;
  path?: string | null;
  source?: string | null;
  device?: string | null;
  recruiter?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};

const TABLE_NAME = "workzo_analytics_events";

function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) return null;

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeDevice(value: unknown, userAgent = "") {
  const raw = `${typeof value === "string" ? value : ""} ${userAgent}`.toLowerCase();

  if (/ipad|tablet/.test(raw)) return "tablet";
  if (/iphone|android|mobile|ios/.test(raw)) return "mobile";
  if (/windows|macintosh|linux|desktop|chrome/.test(raw)) return "desktop";
  return "unknown";
}

function isErrorEvent(eventName: string) {
  return /error|failed|failure|interrupted|voice_failed|audio_failed|timeout|crash/i.test(eventName);
}

function buildSummary(events: AnalyticsEvent[]) {
  const totalEvents = events.length;
  const sessions = new Set<string>();
  const recruiterCounts: Record<string, number> = {};
  const dropOffSignals: Record<string, number> = {};
  const sessionEvents = new Map<string, Set<string>>();

  let mobileUsers = 0;
  let desktopUsers = 0;
  let tabletUsers = 0;
  let unknownDeviceUsers = 0;

  const funnel = {
    landingViewed: 0,
    onboardingStarted: 0,
    cvUploaded: 0,
    interviewStarted: 0,
    interviewCompleted: 0,
    resultsViewed: 0,
  };

  for (const item of events) {
    const event = cleanText(item.event, "unknown_event");
    const sessionId = cleanText(item.session_id, "unknown_session");
    const device = normalizeDevice(item.device);

    sessions.add(sessionId);

    if (!sessionEvents.has(sessionId)) sessionEvents.set(sessionId, new Set<string>());
    sessionEvents.get(sessionId)?.add(event);

    if (device === "mobile") mobileUsers += 1;
    else if (device === "desktop") desktopUsers += 1;
    else if (device === "tablet") tabletUsers += 1;
    else unknownDeviceUsers += 1;

    const recruiter = cleanText(item.recruiter);
    if (recruiter) recruiterCounts[recruiter] = (recruiterCounts[recruiter] || 0) + 1;

    if (event === "landing_viewed" || event === "page_viewed") funnel.landingViewed += 1;
    if (event === "onboarding_started") funnel.onboardingStarted += 1;
    if (event === "cv_uploaded") funnel.cvUploaded += 1;
    if (event === "interview_started") funnel.interviewStarted += 1;
    if (event === "interview_completed") funnel.interviewCompleted += 1;
    if (event === "results_viewed") funnel.resultsViewed += 1;
  }

  for (const [, names] of sessionEvents) {
    if (names.has("interview_started") && !names.has("interview_completed")) {
      dropOffSignals.interview_started_not_completed = (dropOffSignals.interview_started_not_completed || 0) + 1;
    }
    if (names.has("onboarding_started") && !names.has("interview_started")) {
      dropOffSignals.onboarding_not_started_interview = (dropOffSignals.onboarding_not_started_interview || 0) + 1;
    }
    if (names.has("cv_uploaded") && !names.has("interview_started")) {
      dropOffSignals.cv_uploaded_not_started_interview = (dropOffSignals.cv_uploaded_not_started_interview || 0) + 1;
    }
  }

  const interviewStarts = funnel.interviewStarted;
  const interviewCompleted = funnel.interviewCompleted;
  const completionRate = interviewStarts > 0 ? Math.round((interviewCompleted / interviewStarts) * 100) : 0;

  const recentErrors = events.filter((event) => isErrorEvent(cleanText(event.event))).slice(0, 20);

  return {
    totalEvents,
    uniqueSessions: sessions.size,
    interviewStarts,
    interviewCompleted,
    completionRate,
    mobileUsers,
    desktopUsers,
    tabletUsers,
    unknownDeviceUsers,
    recruiterCounts,
    recentErrors,
    dropOffSignals,
    funnel,
  };
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();

    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Missing Supabase environment variables" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const userAgent = req.headers.get("user-agent") || "";

    const payload = {
      session_id: cleanText(body.sessionId || body.session_id, crypto.randomUUID()),
      event: cleanText(body.event, "unknown_event"),
      path: cleanText(body.path, "/"),
      source: cleanText(body.source, "Direct / unknown"),
      device: normalizeDevice(body.device, userAgent),
      recruiter: cleanText(body.recruiter) || null,
      metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata : {},
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from(TABLE_NAME).insert(payload);

    if (error) {
      console.error("Analytics insert failed:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Analytics POST failed:", error);
    return NextResponse.json({ success: false, error: "Analytics POST failed" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = getSupabase();

    if (!supabase) {
      const emptySummary = buildSummary([]);
      return NextResponse.json({
        success: true,
        summary: emptySummary,
        stats: emptySummary,
        recentEvents: [],
        warning: "Missing Supabase environment variables",
      });
    }

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      console.error("Analytics read failed:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const events = (Array.isArray(data) ? data : []) as AnalyticsEvent[];
    const summary = buildSummary(events);

    return NextResponse.json({
      success: true,
      summary,
      stats: summary,
      recentEvents: events.slice(0, 50),
    });
  } catch (error) {
    console.error("Analytics GET failed:", error);
    return NextResponse.json({ success: false, error: "Analytics GET failed" }, { status: 500 });
  }
}
