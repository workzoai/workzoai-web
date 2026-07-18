/*
 * app/api/smart-apply/route.ts
 *
 * POST  create a Smart Apply session for a job.
 * GET   list the caller's application tracker.
 *
 * The canonical CV currently lives client-side (localStorage), so the client sends
 * the resolved job, the candidate context, and optionally the parsed profile. The
 * server recomputes the match from those inputs rather than trusting a client-sent
 * score: the score is the thing the whole feature rests on, and a spoofed 95 would
 * defeat the honesty the product is built around.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { canUseWorkZoFeature, getWorkZoFeatureRequiredPlan } from "@/lib/workzoPlanLimits";
import { checkWorkZoRateLimit } from "@/lib/workzoRateLimit";
import { rankJob } from "@/lib/jobs/ranking";
import { createJobFingerprint } from "@/lib/jobs/dedupe";
import { createSession, listApplications } from "@/lib/smart-apply/persistence";
import type { CandidateContext, WorkZoJob } from "@/lib/jobs/types";
import type { ResumeProfile } from "@/lib/workzoResumeParser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const account = await resolveWorkZoServerPlan();
  if (!account.authenticated || !account.userId) {
    return NextResponse.json({ ok: false, error: "Please sign in to use Smart Apply." }, { status: 401 });
  }
  if (!canUseWorkZoFeature(account.plan, "smart_apply")) {
    return NextResponse.json(
      { ok: false, error: "Upgrade required.", requiredPlan: getWorkZoFeatureRequiredPlan("smart_apply"), plan: account.plan },
      { status: 403 },
    );
  }

  const rate = await checkWorkZoRateLimit(`smart_apply_create:${account.userId}`, 20, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ ok: false, error: "Too many sessions started. Please wait a moment." }, { status: 429 });
  }

  let body: {
    job?: WorkZoJob;
    candidate?: CandidateContext;
    profile?: ResumeProfile | null;
    canonicalProfileVersion?: string;
  };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const job = body.job;
  if (!job || !job.title || !job.company) {
    return badRequest("A job with a title and company is required.");
  }

  /*
   * The canonical CV is mandatory (spec section 2.1). Without it Smart Apply stops
   * and asks the user to upload or confirm, rather than proceeding on a blank
   * profile and producing a match that means nothing.
   */
  const profile = body.profile || null;
  const candidate: CandidateContext = body.candidate || { skills: [] };
  if (!profile && !(candidate.cvText || (candidate.skills && candidate.skills.length))) {
    return NextResponse.json(
      { ok: false, error: "cv_missing", message: "Upload or confirm your CV before starting Smart Apply." },
      { status: 422 },
    );
  }

  // Ensure the job carries a fingerprint for the tracker's duplicate guard.
  const fingerprintedJob: WorkZoJob = {
    ...job,
    fingerprint: job.fingerprint || createJobFingerprint(job) || undefined,
  };

  // Recompute the match server-side. Never trust a client-sent score.
  const match = rankJob(fingerprintedJob, candidate, profile);

  const session = await createSession({
    userId: account.userId,
    job: fingerprintedJob,
    match,
    canonicalProfileVersion: body.canonicalProfileVersion,
  });

  if (!session) {
    return NextResponse.json({ ok: false, error: "Could not start the session. Please try again." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    sessionId: session.id,
    status: session.status,
    job: session.job,
    match: session.match,
  });
}

export async function GET() {
  const account = await resolveWorkZoServerPlan();
  if (!account.authenticated || !account.userId) {
    return NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 });
  }
  const applications = await listApplications(account.userId);
  return NextResponse.json({ ok: true, applications });
}
