import { NextResponse } from "next/server";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { createWorkZoSupabaseServiceClient } from "@/lib/workzoSupabaseService";
import { averageWiri, computeWorkZoWiri, consistencyFromScores, improvementFromScores, clampWiriScore } from "@/lib/workzoWiri";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getRaw(row: any): any {
  return row?.raw_result && typeof row.raw_result === "object" ? row.raw_result : {};
}

function scoreFromRaw(row: any, key: string, fallback: unknown = 0): number {
  const raw = getRaw(row);
  const score = raw?.score || raw?.scores || {};
  const rubric = raw?.computedRubric || raw?.computed_rubric || raw?.rubric || {};
  if (key === "communication") return clampWiriScore(rubric.communication ?? score.communication ?? score.clarity ?? fallback);
  if (key === "jobFit") return clampWiriScore(rubric.jobFit ?? rubric.relevance ?? score.relevance ?? fallback);
  if (key === "technicalCompetency") return clampWiriScore(rubric.experience ?? row?.evidence_quality ?? score.trust ?? fallback);
  if (key === "evidenceQuality") return clampWiriScore(rubric.evidenceImpact ?? row?.evidence_quality ?? score.trust ?? fallback);
  if (key === "confidence") return clampWiriScore(score.confidence ?? fallback);
  return clampWiriScore(fallback);
}

export async function GET() {
  const empty = {
    ok: true,
    hasData: false,
    wiri: null,
    visibility: "private",
    message: "Complete one realistic CV + JD interview to unlock your Interview Readiness score.",
  };

  try {
    const resolved = await resolveWorkZoServerPlan();
    if (!resolved.authenticated || !resolved.userId) return NextResponse.json(empty);

    const supabase = createWorkZoSupabaseServiceClient();
    const { data, error } = await supabase
      .from("interview_results")
      .select("id,overall_score,evidence_quality,raw_result,created_at")
      .eq("user_id", resolved.userId)
      .order("created_at", { ascending: true })
      .limit(50);

    if (error || !data || data.length === 0) return NextResponse.json(empty);

    const rows = data as any[];
    const overallScores = rows.map((r) => clampWiriScore(r.overall_score)).filter((n) => n > 0);
    if (overallScores.length === 0) return NextResponse.json(empty);

    const latest = rows[rows.length - 1];
    const interviewPerformance = averageWiri(overallScores);
    const result = computeWorkZoWiri({
      cvQuality: 75,
      jobFit: scoreFromRaw(latest, "jobFit", interviewPerformance),
      interviewPerformance,
      communication: scoreFromRaw(latest, "communication", interviewPerformance),
      technicalCompetency: scoreFromRaw(latest, "technicalCompetency", interviewPerformance),
      confidence: scoreFromRaw(latest, "confidence", interviewPerformance),
      evidenceQuality: scoreFromRaw(latest, "evidenceQuality", interviewPerformance),
      improvementTrend: improvementFromScores(overallScores),
      interviewConsistency: consistencyFromScores(overallScores),
    });

    return NextResponse.json({
      ok: true,
      hasData: true,
      visibility: "private",
      wiri: result,
      history: {
        interviews: overallScores.length,
        averageInterviewScore: interviewPerformance,
        bestInterviewScore: Math.max(...overallScores),
        latestInterviewScore: overallScores[overallScores.length - 1],
      },
    });
  } catch (error) {
    console.warn("[account/wiri] failed", error);
    return NextResponse.json(empty);
  }
}
