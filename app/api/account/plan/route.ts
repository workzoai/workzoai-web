import { NextResponse } from "next/server";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { createWorkZoSupabaseServiceClient } from "@/lib/workzoSupabaseService";
import { getWorkZoPlanLimits } from "@/lib/workzoPlanLimits";
import { isWorkZoFounderDevEmail, WORKZO_FOUNDER_DEV_LIMITS } from "@/lib/workzoFounderAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const resolved = await resolveWorkZoServerPlan();

  let usage = {
    interviewsStarted: 0,
    interviewsCompleted: 0,
    interviewsRemaining: 1,
    interviewLimit: 1,
    canStartInterview: true,
    voiceMinutesUsed: 0,
    voiceMinutesRemaining: 15,
    voiceMinutesLimit: 15,
    videoMinutesUsed: 0,
    videoMinutesRemaining: 0,
    videoMinutesLimit: 0,
    devUnlimited: false,
  };

  try {
    const limits = getWorkZoPlanLimits(resolved.plan);
    const founderDev = isWorkZoFounderDevEmail(resolved.email);
    const interviewLimit = founderDev ? 999999 : limits.unlimitedVoiceInterviews ? 999999 : limits.interviewsPerMonth;
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
      interviewsRemaining: founderDev ? WORKZO_FOUNDER_DEV_LIMITS.interviewsRemaining : limits.unlimitedVoiceInterviews ? 999999 : Math.max(0, interviewLimit - interviewsStarted),
      interviewLimit,
      canStartInterview: founderDev || limits.unlimitedVoiceInterviews || interviewsStarted < interviewLimit,
      voiceMinutesUsed: 0,
      voiceMinutesRemaining: founderDev ? WORKZO_FOUNDER_DEV_LIMITS.voiceMinutesRemaining : limits.voiceMinutesPerMonth,
      voiceMinutesLimit: founderDev ? WORKZO_FOUNDER_DEV_LIMITS.voiceMinutesLimit : limits.voiceMinutesPerMonth,
      videoMinutesUsed: 0,
      videoMinutesRemaining: founderDev ? WORKZO_FOUNDER_DEV_LIMITS.videoMinutesRemaining : limits.videoMinutesPerMonth,
      videoMinutesLimit: founderDev ? WORKZO_FOUNDER_DEV_LIMITS.videoMinutesLimit : limits.videoMinutesPerMonth,
      devUnlimited: founderDev,
    };
  } catch (error) {
    console.warn("[account/plan] usage count failed", error);
  }

  // Partner trial: surface the remaining interview count and expiry so the
  // dashboard can show "X of 7 interviews left" instead of unlimited-Pro
  // minutes, and cap the interview usage numbers to the trial allowance.
  let trial: Awaited<ReturnType<typeof import("@/lib/workzoPartnerTrial").readActiveTrialStatus>> = null;
  if (resolved.authenticated && resolved.userId && resolved.status === "partner_trial") {
    try {
      const { readActiveTrialStatus } = await import("@/lib/workzoPartnerTrial");
      trial = await readActiveTrialStatus(resolved.userId);
      if (trial) {
        usage = {
          ...usage,
          interviewLimit: trial.interviewsLimit,
          interviewsStarted: trial.interviewsUsed,
          interviewsRemaining: trial.interviewsLeft,
          canStartInterview: trial.interviewsLeft > 0,
        };
      }
    } catch (err) {
      console.warn("[account/plan] trial status failed", err);
    }
  }

  const response = NextResponse.json({ ...resolved, usage, trial });
  response.cookies.set("workzo_plan", resolved.plan, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  response.cookies.set("workzo_plan_type", resolved.plan, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  return response;
}
