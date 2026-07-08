import { NextResponse } from "next/server";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { redeemPartnerTrial } from "@/lib/workzoPartnerTrial";

/**
 * Partner redeems a trial code. Must be signed in. Grants 7 interviews /
 * 14 days / Premium Pro to the current user (or confirms their existing
 * grant). Entitlement itself is applied at plan-resolution time.
 *
 * POST { code }
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const resolved = await resolveWorkZoServerPlan();
  if (!resolved.authenticated || !resolved.userId) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const code = String(body.code || "").trim();
  if (!code) return NextResponse.json({ ok: false, error: "code_required" }, { status: 400 });

  const result = await redeemPartnerTrial({ code, userId: resolved.userId, email: resolved.email });
  if (!result.ok) {
    const status = result.error === "invalid_code" ? 404 : result.error === "email_mismatch" || result.error === "domain_mismatch" ? 403 : 400;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    alreadyActive: result.alreadyActive,
    expiresAt: result.expiresAt,
    interviewsLimit: result.interviewsLimit,
  });
}
