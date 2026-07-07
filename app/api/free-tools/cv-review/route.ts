import { NextRequest, NextResponse } from "next/server";
import { buildFreeCvReview } from "@/lib/workzoFreeToolsEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = buildFreeCvReview(body?.input || body);
    return NextResponse.json(result, { status: result.ok === false ? 400 : 200 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not review CV." }, { status: 500 });
  }
}
