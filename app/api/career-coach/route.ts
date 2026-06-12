import { NextRequest, NextResponse } from "next/server";
import { buildWorkZoPremiumProSuite } from "@/lib/workzoPremiumProCareerSuite";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const resolved = await resolveWorkZoServerPlan();

    if (resolved.plan !== "premium_pro") {
      return NextResponse.json(
        {
          ok: false,
          code: "premium_pro_required",
          message: "AI Career Coach, career roadmaps, progress tracking, and replay intelligence require Premium Pro.",
        },
        { status: 403 },
      );
    }

    const suite = buildWorkZoPremiumProSuite(body?.input || body?.report || body || {});
    return NextResponse.json({ ok: true, suite });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not build career coach." },
      { status: 500 },
    );
  }
}
