import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cv/status?id=<jobId>
 *
 * NOT IMPLEMENTED, and it now says so.
 *
 * This route used to return `{ status: "processing" }` unconditionally, for any
 * id, forever. It never consulted a database and had no terminal state, so any
 * client that polled it would have spun until the tab was closed while reporting
 * a healthy-looking "processing" the whole time. Nothing calls it today, which is
 * the only reason that was never seen in production.
 *
 * The CV pipeline is currently synchronous (see app/api/cv/route.ts), so there is
 * no job to poll. If async CV processing lands, wire this to the
 * `cv_processing_jobs` table (the migration already exists) and return a real
 * status with a terminal state, rather than reinstating an optimistic constant.
 */
export async function GET(_req: NextRequest) {
  return NextResponse.json(
    {
      ok: false,
      code: "not_implemented",
      message: "Async CV status polling is not enabled. /api/cv returns the parsed profile directly.",
    },
    { status: 501 },
  );
}
