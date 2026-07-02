import { NextResponse } from "next/server";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { createWorkZoSupabaseServiceClient } from "@/lib/workzoSupabaseService";
import type { WorkZoAccountScores } from "@/lib/workzoCvScore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Real, all-time average interview score for the signed-in user, computed
 * from interview_sessions.overall_score — the same column the History page
 * already displays per-session. This intentionally does NOT scope to the
 * current calendar month (unlike /api/account/plan's usage counters, which
 * exist for quota enforcement, not progress tracking).
 */
export async function GET() {
  const empty: WorkZoAccountScores = {
    avgInterviewScore: null,
    bestInterviewScore: null,
    scoredInterviewCount: 0,
  };

  try {
    const resolved = await resolveWorkZoServerPlan();
    if (!resolved.authenticated || !resolved.userId) {
      return NextResponse.json(empty);
    }

    const supabase = createWorkZoSupabaseServiceClient();
    const { data, error } = await supabase
      .from("interview_sessions")
      .select("overall_score")
      .eq("user_id", resolved.userId)
      .not("overall_score", "is", null);

    if (error || !data) {
      console.warn("[account/scores] query failed", error);
      return NextResponse.json(empty);
    }

    const scores = data
      .map((row) => Number((row as { overall_score: number | null }).overall_score))
      .filter((n) => Number.isFinite(n) && n > 0);

    if (scores.length === 0) {
      return NextResponse.json(empty);
    }

    const avg = Math.round(scores.reduce((sum, n) => sum + n, 0) / scores.length);
    const best = Math.round(Math.max(...scores));

    return NextResponse.json({
      avgInterviewScore: avg,
      bestInterviewScore: best,
      scoredInterviewCount: scores.length,
    } satisfies WorkZoAccountScores);
  } catch (error) {
    console.warn("[account/scores] unexpected error", error);
    return NextResponse.json(empty);
  }
}
