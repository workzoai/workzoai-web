/*
 * app/api/applications/route.ts
 *
 * POST  manually add an application the user is tracking but did not prepare through
 *       Smart Apply. Everything else about the tracker (listing) lives on
 *       GET /api/smart-apply, which already returns the user's applications.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { canUseWorkZoFeature } from "@/lib/workzoPlanLimits";
import { createManualApplication } from "@/lib/smart-apply/persistence";
import { JOB_APPLICATION_STATUSES, type JobApplicationStatus } from "@/lib/smart-apply/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const account = await resolveWorkZoServerPlan();
  if (!account.authenticated || !account.userId) {
    return NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 });
  }
  if (!canUseWorkZoFeature(account.plan, "smart_apply")) {
    return NextResponse.json({ ok: false, error: "Upgrade required." }, { status: 403 });
  }

  let body: { jobTitle?: string; companyName?: string; location?: string; applyUrl?: string; status?: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const jobTitle = (body.jobTitle || "").trim();
  const companyName = (body.companyName || "").trim();
  if (!jobTitle || !companyName) {
    return NextResponse.json({ ok: false, error: "A job title and company are required." }, { status: 400 });
  }

  const status = body.status as JobApplicationStatus | undefined;
  if (status && !JOB_APPLICATION_STATUSES.includes(status)) {
    return NextResponse.json({ ok: false, error: `Unknown status: ${status}` }, { status: 400 });
  }

  const result = await createManualApplication({
    userId: account.userId,
    jobTitle,
    companyName,
    location: body.location,
    applyUrl: body.applyUrl,
    status,
    notes: body.notes,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "Could not add the application." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: result.id });
}
