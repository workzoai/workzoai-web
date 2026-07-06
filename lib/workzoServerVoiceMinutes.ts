import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWorkZoPlanLimits, type WorkZoPlanType } from "@/lib/workzoPlanLimits";
import { isWorkZoFounderDevEmail, WORKZO_FOUNDER_DEV_LIMITS } from "@/lib/workzoFounderAccess";

export type WorkZoServerVoiceMinutesCheck = {
  allowed: boolean;
  reason: "ok" | "ok_using_topup_credits" | "voice_minutes_limit" | "session_limit_reached" | "unauthenticated" | "check_unavailable";
  minutesUsed: number;
  minutesLimit: number;
  minutesRemaining: number;
  sessionsUsed: number;
  sessionsLimit: number;
  plan: WorkZoPlanType;
  /** Purchased top-up minutes still available (never expire, roll over). */
  topUpMinutesRemaining: number;
};

/**
 * ── Top-up credit accounting (pay-as-you-go) ─────────────────────────────────
 * Purchases live in `voice_topup_purchases` (written only by the Stripe
 * webhook). Consumption is COMPUTED, never mutated: credits are burned only
 * by usage that exceeded the monthly plan allowance, so
 *
 *   creditsConsumed  = Σ over calendar months  max(0, monthMinutes − planLimit)
 *   creditsRemaining = totalPurchased − creditsConsumed
 *
 * This keeps the gate idempotent and write-free on the read path (the same
 * property that made the monthly pool reliable), at the cost of one extra
 * query for users who have ever bought a pack. Plan changes are valued at the
 * CURRENT plan limit for past months — a deliberate simplification that can
 * only ever round in the user's favor after an upgrade.
 */
async function computeTopUpCredits(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  planLimit: number,
): Promise<{ purchased: number; remaining: number; earliestPurchase: string | null }> {
  const { data: purchases, error } = await supabase
    .from("voice_topup_purchases")
    .select("minutes, created_at")
    .eq("user_id", userId);

  if (error || !purchases || purchases.length === 0) {
    return { purchased: 0, remaining: 0, earliestPurchase: null };
  }

  const purchased = purchases.reduce(
    (sum: number, row: { minutes: number | null }) => sum + Math.max(0, Number(row.minutes) || 0),
    0,
  );
  const earliestPurchase = purchases
    .map((row: { created_at: string | null }) => row.created_at || "")
    .filter(Boolean)
    .sort()[0] || null;
  if (!purchased || !earliestPurchase) return { purchased, remaining: purchased, earliestPurchase };

  // Overage only starts counting from the first purchase month: usage before
  // the user ever bought credits can't retroactively consume them.
  const overageStart = new Date(earliestPurchase);
  overageStart.setUTCDate(1);
  overageStart.setUTCHours(0, 0, 0, 0);

  const { data: sessions, error: sessionsError } = await supabase
    .from("interview_sessions")
    .select("duration_seconds, created_at")
    .eq("user_id", userId)
    .gte("created_at", overageStart.toISOString());

  if (sessionsError) {
    // Fail open on the credit side too: report full balance rather than
    // blocking a paying user on an infrastructure hiccup.
    console.error("[workzoServerVoiceMinutes] top-up overage query failed, assuming full balance:", sessionsError.message);
    return { purchased, remaining: purchased, earliestPurchase };
  }

  const byMonth = new Map<string, number>();
  for (const row of sessions || []) {
    const created = row.created_at ? new Date(row.created_at) : null;
    if (!created || Number.isNaN(created.getTime())) continue;
    const key = `${created.getUTCFullYear()}-${created.getUTCMonth()}`;
    const minutes = Math.ceil(Math.max(0, Number(row.duration_seconds) || 0) / 60);
    byMonth.set(key, (byMonth.get(key) || 0) + minutes);
  }
  let consumed = 0;
  for (const monthMinutes of byMonth.values()) {
    consumed += Math.max(0, monthMinutes - planLimit);
  }
  return { purchased, remaining: Math.max(0, purchased - consumed), earliestPurchase };
}

/**
 * Authoritative, server-side check of the monthly voice-minute pool.
 *
 * The client-side tracker (workzoUsageTracker) is a UX convenience only -
 * localStorage can be cleared or edited. This check sums the real
 * `duration_seconds` values from `interview_sessions` for the current
 * calendar month, so it is the source of truth for gating session starts.
 *
 * Structural by design: it reads durations from the DB, never persona-,
 * user-, or sample-specific values.
 *
 * FAIL-OPEN POLICY: if the DB query itself errors (not "no rows", an actual
 * failure), we allow the session and log loudly. Blocking paying customers on
 * an infrastructure hiccup is worse than absorbing a few minutes of compute.
 *
 * Usage (in the route that starts a voice interview, before creating the
 * Vapi call):
 *
 *   const gate = await checkWorkZoServerVoiceMinutes(resolvedPlan);
 *   if (!gate.allowed) {
 *     return NextResponse.json(
 *       { error: "voice_minutes_limit", ...gate },
 *       { status: 403 },
 *     );
 *   }
 */
export async function checkWorkZoServerVoiceMinutes(
  plan: WorkZoPlanType,
  /** Client session identifier. When a row with this user_id + local_id
   * already exists, the incoming write is an autosave/update of an existing
   * session, NOT a new interview, and must never be blocked, or a
   * completed session's results would be silently lost at the pool boundary. */
  localId?: string,
): Promise<WorkZoServerVoiceMinutesCheck> {
  const limits = getWorkZoPlanLimits(plan);
  const minutesLimit = limits.voiceMinutesPerMonth;
  const sessionsLimit = limits.unlimitedVoiceInterviews ? 999999 : limits.voiceInterviewsPerMonth;

  const base: Omit<WorkZoServerVoiceMinutesCheck, "allowed" | "reason"> = {
    minutesUsed: 0,
    minutesLimit,
    minutesRemaining: minutesLimit,
    sessionsUsed: 0,
    sessionsLimit,
    plan,
    topUpMinutesRemaining: 0,
  };

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { ...base, allowed: false, reason: "unauthenticated" };
    }

    if (isWorkZoFounderDevEmail(user.email)) {
      return {
        ...base,
        allowed: true,
        reason: "ok",
        minutesLimit: WORKZO_FOUNDER_DEV_LIMITS.voiceMinutesLimit,
        minutesRemaining: WORKZO_FOUNDER_DEV_LIMITS.voiceMinutesRemaining,
        sessionsLimit: WORKZO_FOUNDER_DEV_LIMITS.interviewLimit,
      };
    }

    if (localId) {
      const { data: existing } = await supabase
        .from("interview_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("local_id", localId)
        .maybeSingle();
      if (existing) {
        return { ...base, allowed: true, reason: "ok" };
      }
    }

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("interview_sessions")
      .select("duration_seconds")
      .eq("user_id", user.id)
      .gte("created_at", monthStart.toISOString());

    if (error) {
      console.error("[workzoServerVoiceMinutes] DB query failed, failing open:", error.message);
      return { ...base, allowed: true, reason: "check_unavailable" };
    }

    const rows = data || [];
    const sessionsUsed = rows.length;
    // Round each session up to a whole minute, matches the client tracker
    // so the two never disagree at pool boundaries.
    const minutesUsed = rows.reduce(
      (sum: number, row: { duration_seconds: number | null }) =>
        sum + Math.ceil(Math.max(0, Number(row.duration_seconds) || 0) / 60),
      0,
    );
    const minutesRemaining = Math.max(0, minutesLimit - minutesUsed);

    if (sessionsUsed >= sessionsLimit) {
      return { ...base, sessionsUsed, minutesUsed, minutesRemaining, allowed: false, reason: "session_limit_reached" };
    }
    if (minutesUsed >= minutesLimit) {
      // Monthly allowance exhausted: purchased top-up credits keep the
      // session allowed. Only queried at the boundary, so users who never
      // bought a pack pay zero extra queries.
      const credits = await computeTopUpCredits(supabase, user.id, minutesLimit);
      if (credits.remaining > 0) {
        return {
          ...base,
          sessionsUsed,
          minutesUsed,
          minutesRemaining: 0,
          topUpMinutesRemaining: credits.remaining,
          allowed: true,
          reason: "ok_using_topup_credits",
        };
      }
      return { ...base, sessionsUsed, minutesUsed, minutesRemaining: 0, allowed: false, reason: "voice_minutes_limit" };
    }

    return { ...base, sessionsUsed, minutesUsed, minutesRemaining, allowed: true, reason: "ok" };
  } catch (error) {
    console.error("[workzoServerVoiceMinutes] Unexpected failure, failing open:", error);
    return { ...base, allowed: true, reason: "check_unavailable" };
  }
}
