/**
 * app/api/admin/scoring-profiles/route.ts
 *
 * Scoring profile CRUD for Shadow Recruiter Calibration.
 *
 *   GET    ?org=&key=            list profiles with their active version
 *   POST   ?org=&key=            create profile + version 1
 *   PATCH  ?org=&key=            update profile: NEVER overwrites the old
 *                                version, always appends a new
 *                                scoring_profile_versions row
 *
 * Auth: founder secret or org HMAC key (lib/scoring/orgScoringAuth).
 */

import { NextResponse } from "next/server";
import { authorizeOrgScoring } from "@/lib/scoring/orgScoringAuth";
import {
  sanitizeWeights,
  sanitizeThresholds,
  validateWeights,
  COMPETENCY_LABELS,
  DEFAULT_RUBRIC,
  DEFAULT_THRESHOLDS,
} from "@/lib/scoring/customRubric";
import { getCompanyTemplate } from "@/lib/interview/companyTemplates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadProfilesWithVersions(db: any, orgId: string) {
  const { data: profiles, error } = await db
    .from("organization_scoring_profiles")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const ids = (profiles || []).map((p: any) => p.id);
  let versions: any[] = [];
  if (ids.length > 0) {
    const { data } = await db
      .from("scoring_profile_versions")
      .select("*")
      .in("scoring_profile_id", ids)
      .order("version_number", { ascending: false });
    versions = data || [];
  }

  return (profiles || []).map((p: any) => {
    const own = versions.filter((v) => v.scoring_profile_id === p.id);
    const active = own.find((v) => v.is_active) || own[0] || null;
    return {
      ...p,
      activeVersion: active,
      versionCount: own.length,
    };
  });
}

export async function GET(request: Request) {
  const auth = await authorizeOrgScoring(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const profiles = await loadProfilesWithVersions(auth.db, auth.orgId);
    return NextResponse.json({
      ok: true,
      org: auth.orgSlug,
      profiles,
      defaults: { weights: DEFAULT_RUBRIC, thresholds: DEFAULT_THRESHOLDS, labels: COMPETENCY_LABELS },
    });
  } catch (error) {
    console.error("[scoring-profiles] GET failed", error);
    return NextResponse.json({ ok: false, error: "query_failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await authorizeOrgScoring(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const body = await request.json().catch(() => ({}));

    /* A company template can seed weights and metadata. */
    const template = body.companyTemplateId ? getCompanyTemplate(String(body.companyTemplateId)) : null;

    const name = String(body.name || (template ? `${template.companyName} Readiness Rubric` : "")).trim();
    if (!name) return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });

    const weights = sanitizeWeights(body.weights || template?.defaultWeights || DEFAULT_RUBRIC);
    const check = validateWeights(weights);
    if (!check.ok) return NextResponse.json({ ok: false, error: check.error, total: check.total }, { status: 400 });

    const thresholds = sanitizeThresholds(body.thresholds);

    const { data: profile, error: pErr } = await auth.db
      .from("organization_scoring_profiles")
      .insert({
        organization_id: auth.orgId,
        name,
        description: body.description ? String(body.description) : null,
        profile_type: template ? "company_template" : String(body.profileType || "custom"),
        target_role: body.targetRole ? String(body.targetRole) : null,
        company_template: template?.id || null,
        industry: body.industry ? String(body.industry) : null,
        is_active: false,
        is_default: false,
      })
      .select("*")
      .single();
    if (pErr) throw pErr;

    const { data: version, error: vErr } = await auth.db
      .from("scoring_profile_versions")
      .insert({
        scoring_profile_id: profile.id,
        version_number: 1,
        weights,
        thresholds,
        competency_labels: COMPETENCY_LABELS,
        prompt_guidance: template
          ? { promptInstructions: template.promptInstructions, companyTemplateId: template.id }
          : body.promptGuidance || null,
        evaluation_guidance: body.evaluationGuidance || null,
        is_active: true,
      })
      .select("*")
      .single();
    if (vErr) throw vErr;

    return NextResponse.json({ ok: true, profile: { ...profile, activeVersion: version, versionCount: 1 } });
  } catch (error) {
    console.error("[scoring-profiles] POST failed", error);
    return NextResponse.json({ ok: false, error: "create_failed" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await authorizeOrgScoring(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const body = await request.json().catch(() => ({}));
    const profileId = String(body.profileId || body.id || "").trim();
    if (!profileId) return NextResponse.json({ ok: false, error: "profile_id_required" }, { status: 400 });

    /* Org scoping: the profile must belong to THIS organization. */
    const { data: profile } = await auth.db
      .from("organization_scoring_profiles")
      .select("*")
      .eq("id", profileId)
      .eq("organization_id", auth.orgId)
      .maybeSingle();
    if (!profile) return NextResponse.json({ ok: false, error: "profile_not_found" }, { status: 404 });

    /* Metadata edits are in-place; scoring logic edits create a new version. */
    const metaPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name) metaPatch.name = String(body.name).trim();
    if (body.description !== undefined) metaPatch.description = body.description ? String(body.description) : null;
    if (body.targetRole !== undefined) metaPatch.target_role = body.targetRole ? String(body.targetRole) : null;

    const wantsNewVersion = body.weights || body.thresholds || body.promptGuidance || body.evaluationGuidance;
    let newVersion: any = null;

    if (wantsNewVersion) {
      const { data: latest } = await auth.db
        .from("scoring_profile_versions")
        .select("*")
        .eq("scoring_profile_id", profileId)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      const weights = sanitizeWeights(body.weights || latest?.weights || DEFAULT_RUBRIC);
      const check = validateWeights(weights);
      if (!check.ok) return NextResponse.json({ ok: false, error: check.error, total: check.total }, { status: 400 });

      const thresholds = sanitizeThresholds(body.thresholds || latest?.thresholds);
      const nextNumber = (latest?.version_number || 0) + 1;

      /* Deactivate previous versions, then append. The old rows stay
         forever so historical snapshots keep their exact model. */
      await auth.db
        .from("scoring_profile_versions")
        .update({ is_active: false })
        .eq("scoring_profile_id", profileId);

      const { data: created, error: vErr } = await auth.db
        .from("scoring_profile_versions")
        .insert({
          scoring_profile_id: profileId,
          version_number: nextNumber,
          weights,
          thresholds,
          competency_labels: latest?.competency_labels || COMPETENCY_LABELS,
          prompt_guidance: body.promptGuidance || latest?.prompt_guidance || null,
          evaluation_guidance: body.evaluationGuidance || latest?.evaluation_guidance || null,
          is_active: true,
        })
        .select("*")
        .single();
      if (vErr) throw vErr;
      newVersion = created;
    }

    const { data: updated, error: uErr } = await auth.db
      .from("organization_scoring_profiles")
      .update(metaPatch)
      .eq("id", profileId)
      .select("*")
      .single();
    if (uErr) throw uErr;

    return NextResponse.json({ ok: true, profile: updated, newVersion });
  } catch (error) {
    console.error("[scoring-profiles] PATCH failed", error);
    return NextResponse.json({ ok: false, error: "update_failed" }, { status: 500 });
  }
}
