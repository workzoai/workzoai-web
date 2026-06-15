import { NextRequest, NextResponse } from "next/server";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { buildWorkZoCompanyBlueprint } from "@/lib/workzoCompanyBlueprint";

export async function POST(request: NextRequest) {
  // ── Auth gate (pure JS, no LLM cost, but exposes company/role data) ───────
  let resolved;
  try {
    resolved = await resolveWorkZoServerPlan();
  } catch {
    return NextResponse.json({ error: "Could not resolve account plan." }, { status: 500 });
  }
  if (!resolved.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // ─────────────────────────────────────────────────────────────────────────

  try {
    const body = await request.json().catch(() => ({}));
    const blueprint = buildWorkZoCompanyBlueprint({
      companyName: body.companyName || body.targetCompany,
      targetRole: body.targetRole || body.role,
      jobDescription: body.jobDescription || body.jdText,
      cvText: body.cvText || body.resumeText,
      market: body.market || body.targetMarket || body.country,
      companyStyle: body.companyStyle,
    });
    return NextResponse.json({ ok: true, blueprint });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Could not build company blueprint." }, { status: 500 });
  }
}
