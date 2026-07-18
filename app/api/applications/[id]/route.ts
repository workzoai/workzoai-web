/*
 * app/api/applications/[id]/route.ts
 *
 * PATCH  update one tracked application's status or notes.
 *
 * The tracker page needs to move a card from "applied" to "interviewing" to "offer".
 * The persistence layer already scopes every write to the authenticated user, so a
 * user can only ever touch their own rows: passing someone else's application id
 * updates nothing and returns 404.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { updateApplicationStatus, deleteApplication } from "@/lib/smart-apply/persistence";
import { JOB_APPLICATION_STATUSES, type JobApplicationStatus } from "@/lib/smart-apply/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await resolveWorkZoServerPlan();
  if (!account.authenticated || !account.userId) {
    return NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 });
  }

  let body: { status?: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const status = body.status as JobApplicationStatus | undefined;
  if (!status || !JOB_APPLICATION_STATUSES.includes(status)) {
    return NextResponse.json({ ok: false, error: `Unknown status: ${status}` }, { status: 400 });
  }

  const ok = await updateApplicationStatus(account.userId, id, status, body.notes);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "Application not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, status });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await resolveWorkZoServerPlan();
  if (!account.authenticated || !account.userId) {
    return NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 });
  }
  const ok = await deleteApplication(account.userId, id);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "Application not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
