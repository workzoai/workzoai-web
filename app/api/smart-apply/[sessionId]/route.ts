/*
 * app/api/smart-apply/[sessionId]/route.ts
 *
 * GET    read a session (with its latest documents), so the workspace survives a
 *        refresh (spec section 27).
 * PATCH  update the session status and/or notes, and optionally record the
 *        application in the tracker.
 */

import { NextRequest, NextResponse } from "next/server";
import { loadSmartApplyContext } from "@/app/api/smart-apply/[sessionId]/_shared";
import { updateSessionStatus, saveApplication } from "@/lib/smart-apply/persistence";
import { SMART_APPLY_STATUSES, type SmartApplyStatus } from "@/lib/smart-apply/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const ctx = await loadSmartApplyContext(sessionId, "smart_apply");
  if (!ctx.ok) return ctx.response;
  return NextResponse.json({ ok: true, session: ctx.session });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const ctx = await loadSmartApplyContext(sessionId, "smart_apply");
  if (!ctx.ok) return ctx.response;

  let body: { status?: string; notes?: string; recordApplication?: boolean };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const status = body.status as SmartApplyStatus | undefined;
  if (status && !SMART_APPLY_STATUSES.includes(status)) {
    return NextResponse.json({ ok: false, error: `Unknown status: ${status}` }, { status: 400 });
  }

  if (status) {
    const updated = await updateSessionStatus(ctx.userId, sessionId, status, body.notes);
    if (!updated) {
      return NextResponse.json({ ok: false, error: "Could not update the session." }, { status: 500 });
    }
  }

  /*
   * When the user marks a session "applied", mirror it into the tracker. The
   * fingerprint on the job powers the duplicate guard: applying to the same posting
   * twice is reported as a duplicate, not silently double-recorded.
   */
  let application: { saved: boolean; duplicate: boolean } | undefined;
  if (body.recordApplication && status === "applied") {
    const result = await saveApplication({
      userId: ctx.userId,
      sessionId,
      job: ctx.session.job,
      matchScore: ctx.session.match.score,
      status: "applied",
    });
    application = { saved: result.ok, duplicate: result.duplicate };
  }

  return NextResponse.json({ ok: true, status: status || ctx.session.status, application });
}
