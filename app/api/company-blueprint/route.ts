import { NextRequest, NextResponse } from "next/server";
import { buildWorkZoCompanyBlueprint } from "@/lib/workzoCompanyBlueprint";

export async function POST(request: NextRequest) {
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
