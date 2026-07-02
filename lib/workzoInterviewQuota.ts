import "server-only";
import { createWorkZoSupabaseServiceClient } from "@/lib/workzoSupabaseService";
import { getWorkZoPlanLimits } from "@/lib/workzoPlanLimits";
import type { WorkZoPlanType } from "@/lib/workzoPlanLimits";

export type WorkZoInterviewQuotaResult =
  | { blocked: false }
  | { blocked: true; used: number; limit: number; plan: WorkZoPlanType };

/**
 * Enforces the monthly voice-interview cap server-side.
 *
 * IMPORTANT: this must be called from EVERY route that can create a new
 * interview_sessions row for a user (currently /api/db/interview-session
 * and /api/interview-sessions). It used to live inline in only one of
 * those routes — any endpoint that skips this check is a live bypass of
 * the plan limit, not just a display inconsistency, since nothing else
 * stops a new row from being written.
 *
 * `localId` is the client's session identifier. If a row with this
 * user_id + local_id already exists, this is an update to an existing
 * session (e.g. periodic autosave), not a new interview — so it must not
 * count against the quota again.
 */
export async function checkWorkZoInterviewQuota(
  userId: string,
  plan: WorkZoPlanType,
  localId: string,
): Promise<WorkZoInterviewQuotaResult> {
  const supabase = createWorkZoSupabaseServiceClient();

  if (localId) {
    const { data: existing } = await supabase
      .from("interview_sessions")
      .select("id")
      .eq("user_id", userId)
      .eq("local_id", localId)
      .maybeSingle();
    if (existing) return { blocked: false };
  }

  const limits = getWorkZoPlanLimits(plan);
  const monthlyLimit = limits.unlimitedVoiceInterviews ? Infinity : limits.interviewsPerMonth;
  if (!Number.isFinite(monthlyLimit)) return { blocked: false };

  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from("interview_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfMonth.toISOString());

  if (error) throw error;

  const used = count || 0;
  if (used >= monthlyLimit) {
    return { blocked: true, used, limit: monthlyLimit, plan };
  }
  return { blocked: false };
}
