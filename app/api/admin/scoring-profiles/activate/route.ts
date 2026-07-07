/**
 * app/api/admin/scoring-profiles/activate/route.ts
 *
 * POST ?org=&key=  body: { profileId }
 *
 * Activates one scoring profile for the organization. Exactly one
 * profile can be the active default at a time, so activation first
 * clears is_active and is_default across the org, then sets both on
 * the target. Deactivation: body { profileId, deactivate: true }.
 */

import { NextResponse } from "next/server";
import { authorizeOrgScoring } from "@/lib/scoring/orgScoringAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await authorizeOrgScoring(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const body = await request.json().catch(() => ({}));
    const profileId = String(body.profileId || body.id || "").trim();
    if (!profileId) return NextResponse.json({ ok: false, error: "profile_id_required" }, { status: 400 });

    /* Org scoping check: profile must belong to this org. */
    const { data: profile } = await auth.db
      .from("organization_scoring_profiles")
      .select("id,name")
      .eq("id", profileId)
      .eq("organization_id", auth.orgId)
      .maybeSingle();
    if (!profile) return NextResponse.json({ ok: false, error: "profile_not_found" }, { status: 404 });

    if (body.deactivate === true) {
      const { error } = await auth.db
        .from("organization_scoring_profiles")
        .update({ is_active: false, is_default: false, updated_at: new Date().toISOString() })
        .eq("id", profileId);
      if (error) throw error;
      return NextResponse.json({ ok: true, active: null });
    }

    /* Only one active default per organization. */
    await auth.db
      .from("organization_scoring_profiles")
      .update({ is_active: false, is_default: false })
      .eq("organization_id", auth.orgId);

    const { data: activated, error } = await auth.db
      .from("organization_scoring_profiles")
      .update({ is_active: true, is_default: true, updated_at: new Date().toISOString() })
      .eq("id", profileId)
      .select("*")
      .single();
    if (error) throw error;

    return NextResponse.json({ ok: true, active: activated });
  } catch (error) {
    console.error("[scoring-profiles/activate] failed", error);
    return NextResponse.json({ ok: false, error: "activate_failed" }, { status: 500 });
  }
}
