/**
 * app/api/scoring/custom-rubric/route.ts
 *
 * POST ?org=&key=  body: { interviewResultId, scoringProfileId?, persist? }
 *
 * Scores one interview result against an organization scoring profile.
 * Global WIRI is preserved untouched; the rubric only produces the
 * Organization Readiness Score plus an explainable breakdown.
 *
 * Profile resolution order:
 *   1. scoringProfileId from the body (must belong to this org)
 *   2. the organization's active default profile
 *   3. DEFAULT_RUBRIC fallback
 *
 * persist: true additionally writes an interview_scoring_snapshots
 * row. Admin preview calls leave persist off so previews never pollute
 * history.
 */

import { NextResponse } from "next/server";
import { authorizeOrgScoring } from "@/lib/scoring/orgScoringAuth";
import {
  computeCustomRubricScore,
  extractCompetencyScores,
  DEFAULT_RUBRIC,
  DEFAULT_THRESHOLDS,
  type RubricWeights,
  type RubricThresholds,
} from "@/lib/scoring/customRubric";
import { computeWorkZoWiri, clampWiriScore } from "@/lib/workzoWiri";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function wiriForRow(row: any, comps: ReturnType<typeof extractCompetencyScores>): number {
  const raw = row?.raw_result && typeof row.raw_result === "object" ? row.raw_result : {};
  const snapshot = raw?.wiri_snapshot || raw?.wiriSnapshot;
  const snapScore = clampWiriScore(snapshot?.score, 0);
  if (snapScore > 0) return snapScore;

  const overall = clampWiriScore(row?.overall_score, 0);
  return computeWorkZoWiri({
    cvQuality: 75,
    jobFit: comps.jobFit || overall,
    interviewPerformance: overall,
    communication: comps.communication || overall,
    technicalCompetency: comps.technicalDepth || overall,
    confidence: comps.confidence || overall,
    evidenceQuality: comps.evidenceQuality || overall,
  }).score;
}

/** Verify the interview result belongs to this organization. */
async function resultBelongsToOrg(db: any, row: any, orgSlug: string): Promise<boolean> {
  if (row?.session_id) {
    const { data: session } = await db
      .from("interview_sessions")
      .select("org_code")
      .eq("id", row.session_id)
      .maybeSingle();
    const code = String(session?.org_code || "").toLowerCase().trim();
    if (code && code === orgSlug) return true;
  }
  if (row?.user_id) {
    try {
      const { data } = await db.auth.admin.getUserById(String(row.user_id));
      const email = String(data?.user?.email || "").toLowerCase();
      if (email.endsWith(`@${orgSlug}`) || email.endsWith(`.${orgSlug}`)) return true;
    } catch {
      /* lookup failure falls through to rejection */
    }
  }
  return false;
}

export async function POST(request: Request) {
  const auth = await authorizeOrgScoring(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const body = await request.json().catch(() => ({}));
    const interviewResultId = String(body.interviewResultId || "").trim();
    if (!interviewResultId) {
      return NextResponse.json({ ok: false, error: "interview_result_id_required" }, { status: 400 });
    }

    const { data: row, error: rErr } = await auth.db
      .from("interview_results")
      .select("id,session_id,user_id,overall_score,trust_score,evidence_quality,weak_answers,improvements,raw_result,created_at")
      .eq("id", interviewResultId)
      .maybeSingle();
    if (rErr) throw rErr;
    if (!row) return NextResponse.json({ ok: false, error: "result_not_found" }, { status: 404 });

    if (!auth.isFounder) {
      const allowed = await resultBelongsToOrg(auth.db, row, auth.orgSlug);
      if (!allowed) return NextResponse.json({ ok: false, error: "result_not_in_organization" }, { status: 403 });
    }

    /* Resolve profile and its active version. */
    let profile: any = null;
    let version: any = null;

    if (body.scoringProfileId) {
      const { data } = await auth.db
        .from("organization_scoring_profiles")
        .select("*")
        .eq("id", String(body.scoringProfileId))
        .eq("organization_id", auth.orgId)
        .maybeSingle();
      if (!data) return NextResponse.json({ ok: false, error: "invalid_scoring_profile" }, { status: 400 });
      profile = data;
    } else {
      const { data } = await auth.db
        .from("organization_scoring_profiles")
        .select("*")
        .eq("organization_id", auth.orgId)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      profile = data || null;
    }

    if (profile) {
      const { data } = await auth.db
        .from("scoring_profile_versions")
        .select("*")
        .eq("scoring_profile_id", profile.id)
        .eq("is_active", true)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      version = data || null;
    }

    const weights: RubricWeights = (version?.weights as RubricWeights) || DEFAULT_RUBRIC;
    const thresholds: RubricThresholds = (version?.thresholds as RubricThresholds) || DEFAULT_THRESHOLDS;

    const competencies = extractCompetencyScores(row);
    const globalWiri = wiriForRow(row, competencies);

    const result = computeCustomRubricScore({
      competencies,
      weights,
      thresholds,
      globalWiri,
      labels: version?.competency_labels || null,
    });

    let snapshotId: string | null = null;
    if (body.persist === true) {
      const { data: snap, error: sErr } = await auth.db
        .from("interview_scoring_snapshots")
        .insert({
          interview_result_id: row.id,
          organization_id: auth.orgId,
          scoring_profile_id: profile?.id || null,
          scoring_profile_version_id: version?.id || null,
          global_wiri: result.globalWiri,
          organization_readiness_score: result.organizationReadinessScore,
          competency_scores: competencies,
          weighted_breakdown: result.weightedBreakdown,
          risk_flags: result.riskFlags,
          recommendation: result.recommendation,
        })
        .select("id")
        .single();
      if (!sErr) snapshotId = snap?.id || null;
      else console.warn("[custom-rubric] snapshot insert failed", sErr.message);
    }

    return NextResponse.json({
      ok: true,
      globalWiri: result.globalWiri,
      organizationReadinessScore: result.organizationReadinessScore,
      weightedBreakdown: result.weightedBreakdown,
      riskFlags: result.riskFlags,
      recommendation: result.recommendation,
      competencies,
      profile: profile ? { id: profile.id, name: profile.name, versionNumber: version?.version_number || null } : { id: null, name: "WorkZo Default Rubric", versionNumber: null },
      snapshotId,
    });
  } catch (error) {
    console.error("[custom-rubric] POST failed", error);
    return NextResponse.json({ ok: false, error: "scoring_failed" }, { status: 500 });
  }
}
