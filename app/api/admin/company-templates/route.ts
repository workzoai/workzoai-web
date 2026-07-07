/**
 * app/api/admin/company-templates/route.ts
 *
 *   GET  ?org=&key=   built-in templates + this organization's custom
 *                     templates
 *   POST ?org=&key=   create a custom organization interview template
 *
 * Built-in templates live in code (lib/interview/companyTemplates.ts)
 * so they version with the app. Custom templates live in
 * organization_interview_templates.
 */

import { NextResponse } from "next/server";
import { authorizeOrgScoring } from "@/lib/scoring/orgScoringAuth";
import { COMPANY_INTERVIEW_TEMPLATES } from "@/lib/interview/companyTemplates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authorizeOrgScoring(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const { data: custom, error } = await auth.db
      .from("organization_interview_templates")
      .select("*")
      .eq("organization_id", auth.orgId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      builtIn: COMPANY_INTERVIEW_TEMPLATES,
      custom: custom || [],
    });
  } catch (error) {
    console.error("[company-templates] GET failed", error);
    return NextResponse.json({ ok: false, error: "query_failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await authorizeOrgScoring(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });

    const interviewFlow = Array.isArray(body.interviewFlow) ? body.interviewFlow : [];
    if (interviewFlow.length === 0) {
      return NextResponse.json({ ok: false, error: "interview_flow_required" }, { status: 400 });
    }

    const recruiterPersona =
      body.recruiterPersona && typeof body.recruiterPersona === "object"
        ? body.recruiterPersona
        : { tone: "professional", style: "structured", pressureLevel: "medium" };

    const questionStrategy =
      body.questionStrategy && typeof body.questionStrategy === "object"
        ? body.questionStrategy
        : { followUpDepth: "standard", focus: [] };

    /* Optional link to a scoring profile, org-scoped. */
    let scoringProfileId: string | null = null;
    if (body.scoringProfileId) {
      const { data: profile } = await auth.db
        .from("organization_scoring_profiles")
        .select("id")
        .eq("id", String(body.scoringProfileId))
        .eq("organization_id", auth.orgId)
        .maybeSingle();
      if (!profile) return NextResponse.json({ ok: false, error: "invalid_scoring_profile" }, { status: 400 });
      scoringProfileId = profile.id;
    }

    const { data, error } = await auth.db
      .from("organization_interview_templates")
      .insert({
        organization_id: auth.orgId,
        name,
        company_name: body.companyName ? String(body.companyName) : null,
        role_family: body.roleFamily ? String(body.roleFamily) : null,
        industry: body.industry ? String(body.industry) : null,
        interview_flow: interviewFlow,
        recruiter_persona: recruiterPersona,
        question_strategy: questionStrategy,
        scoring_profile_id: scoringProfileId,
        is_active: true,
      })
      .select("*")
      .single();
    if (error) throw error;

    return NextResponse.json({ ok: true, template: data });
  } catch (error) {
    console.error("[company-templates] POST failed", error);
    return NextResponse.json({ ok: false, error: "create_failed" }, { status: 500 });
  }
}
