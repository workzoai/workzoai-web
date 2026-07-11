import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ ok: false, error: "Missing CV job id." }, { status: 400 });

  // This endpoint is intentionally DB-agnostic so it compiles in the current app.
  // Wire this to cv_processing_jobs once the migration is applied.
  return NextResponse.json({
    ok: true,
    jobId: id,
    status: "processing",
    message: "CV processing status endpoint is ready. Connect to cv_processing_jobs for production polling.",
  });
}
