import { NextResponse } from "next/server";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { createWorkZoSupabaseServiceClient } from "@/lib/workzoSupabaseService";
import { getWorkZoPlanLimits } from "@/lib/workzoPlanLimits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const resolved = await resolveWorkZoServerPlan();

  let usage = {
    interviewsStarted: 0,
    interviewsCompleted: 0,
    interviewsRemaining: 2,
    interviewLimit: 2,
    canStartInterview: true,
  };

  try {
    const limits = getWorkZoPlanLimits(resolved.plan);
    const interviewLimit = limits.unlimitedVoiceInterviews ? 999999 : limits.interviewsPerMonth;
    let interviewsStarted = 0;
    let interviewsCompleted = 0;

    if (resolved.authenticated && resolved.userId) {
      const startOfMonth = new Date();
      startOfMonth.setUTCDate(1);
      startOfMonth.setUTCHours(0, 0, 0, 0);

      const supabase = createWorkZoSupabaseServiceClient();
      const { count: startedCount } = await supabase
        .from("interview_sessions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", resolved.userId)
        .gte("created_at", startOfMonth.toISOString());

      // Completion is reported by the result/report pipeline; quota only needs starts.
      const completedCount = 0;

      interviewsStarted = startedCount || 0;
      interviewsCompleted = completedCount || 0;
    }

    usage = {
      interviewsStarted,
      interviewsCompleted,
      interviewsRemaining: limits.unlimitedVoiceInterviews ? 999999 : Math.max(0, interviewLimit - interviewsStarted),
      interviewLimit,
      canStartInterview: limits.unlimitedVoiceInterviews || interviewsStarted < interviewLimit,
    };
  } catch (error) {
    console.warn("[account/plan] usage count failed", error);
  }

  const response = NextResponse.json({ ...resolved, usage });
  response.cookies.set("workzo_plan", resolved.plan, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  response.cookies.set("workzo_plan_type", resolved.plan, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  return response;
}
