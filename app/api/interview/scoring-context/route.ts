/**
 * app/api/interview/scoring-context/route.ts
 *
 * GET (candidate-authenticated, no org key needed)
 *
 * Resolves the signed-in candidate's organization by email domain and
 * returns a FROZEN scoring snapshot for the interview about to start:
 * the active scoring profile, its active version, the weights and
 * thresholds, and a pre-rendered recruiter prompt block.
 *
 * The client calls this ONCE at interview start and pins the result
 * for the whole session, so:
 *   - no per-turn database query is added to the tight voice path
 *   - if the admin changes the rubric mid-interview, the candidate's
 *     active session stays pinned to the rubric they started with
 *
 * Returns { hasProfile: false } for the common consumer case (no org
 * or no active profile), so the interview runs on WorkZo defaults.
 */

import { NextResponse } from "next/server";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { createWorkZoSupabaseServiceClient } from "@/lib/workzoSupabaseService";
import { resolveActiveScoringForUser } from "@/lib/scoring/orgScoringAuth";
import { renderOrganizationRubricForPrompt, sanitizeWeights, sanitizeThresholds } from "@/lib/scoring/customRubric";
import { getCompanyTemplate } from "@/lib/interview/companyTemplates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const empty = { ok: true, hasProfile: false, snapshot: null as unknown, organizationRubricPrompt: "" };

  try {
    const resolved = await resolveWorkZoServerPlan();
    if (!resolved.authenticated || !resolved.userId) return NextResponse.json(empty);

    const db = createWorkZoSupabaseServiceClient();
    const active = await resolveActiveScoringForUser(db, resolved.email);
    if (!active || !active.version) return NextResponse.json(empty);

    const weights = sanitizeWeights(active.version.weights);
    const thresholds = sanitizeThresholds(active.version.thresholds);
    const promptGuidance = (active.version.prompt_guidance || {}) as Record<string, any>;

    const companyTemplate = active.profile.company_template ? getCompanyTemplate(String(active.profile.company_template)) : null;
    const promptInstructions = promptGuidance.promptInstructions || companyTemplate?.promptInstructions || null;

    const organizationRubricPrompt = renderOrganizationRubricForPrompt({
      profileName: active.profile.name,
      weights,
      promptInstructions,
      companyTemplateName: companyTemplate?.companyName || null,
    });

    /* The pinned snapshot the client attaches to every reply turn and
       to the final saved result. Deliberately small: metadata + weights
       + thresholds + the rendered prompt. No secrets, no candidate PII. */
    const snapshot = {
      organizationId: active.organizationId,
      orgSlug: active.orgSlug,
      scoringProfileId: String(active.profile.id),
      scoringProfileVersionId: active.version.id ? String(active.version.id) : null,
      scoringProfileVersionNumber: active.version.version_number ?? null,
      profileName: active.profile.name,
      companyTemplateId: active.profile.company_template || null,
      weights,
      thresholds,
    };

    return NextResponse.json({ ok: true, hasProfile: true, snapshot, organizationRubricPrompt });
  } catch (error) {
    console.warn("[interview/scoring-context] failed", error);
    return NextResponse.json(empty);
  }
}
