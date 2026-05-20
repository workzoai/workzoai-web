import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const payload = {
      session_id: body.sessionId || crypto.randomUUID(),
      event: body.event || "unknown_event",
      path: body.path || "/",
      source: body.source || "Direct / unknown",
      device: body.device || "unknown",
      recruiter: body.recruiter || null,
      metadata: body.metadata || {},
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("workzo_analytics_events")
      .insert(payload);

    if (error) {
      console.error("Analytics insert failed:", error);
      return NextResponse.json(
        { success: false, error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { success: false },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("workzo_analytics_events")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error },
        { status: 500 }
      );
    }

    const totalEvents = data.length;

    const interviewStarts = data.filter(
      (e) => e.event === "interview_started"
    ).length;

    const interviewCompleted = data.filter(
      (e) => e.event === "interview_completed"
    ).length;

    const completionRate =
      interviewStarts > 0
        ? Math.round(
            (interviewCompleted / interviewStarts) * 100
          )
        : 0;

    const mobileUsers = data.filter(
      (e) =>
        typeof e.device === "string" &&
        e.device.toLowerCase().includes("mobile")
    ).length;

    const desktopUsers = totalEvents - mobileUsers;

    const recruiterCounts: Record<string, number> = {};

    data.forEach((event) => {
      if (event.recruiter) {
        recruiterCounts[event.recruiter] =
          (recruiterCounts[event.recruiter] || 0) + 1;
      }
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalEvents,
        interviewStarts,
        interviewCompleted,
        completionRate,
        mobileUsers,
        desktopUsers,
        recruiterCounts,
      },
      recentEvents: data.slice(0, 20),
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { success: false },
      { status: 500 }
    );
  }
}