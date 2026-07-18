/*
 * app/api/smart-apply/[sessionId]/cv/route.ts
 *
 * Generate a tailored CV for this session. Deterministic: reorders and re-emphasises
 * the canonical CV against the job, and refuses to add any claim the CV does not
 * evidence. The client sends the parsed profile (canonical CV is client-side today);
 * the match already lives on the session.
 */

import { NextRequest, NextResponse } from "next/server";
import { loadSmartApplyContext } from "@/app/api/smart-apply/[sessionId]/_shared";
import { tailorCvForJob } from "@/lib/smart-apply/tailorCv";
import { saveDocument } from "@/lib/smart-apply/persistence";
import { formatResumeProfileText } from "@/lib/workzoResumeFactGuard";
import type { CandidateContext } from "@/lib/jobs/types";
import type { ResumeProfile } from "@/lib/workzoResumeParser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const ctx = await loadSmartApplyContext(sessionId, "smart_apply_documents");
  if (!ctx.ok) return ctx.response;

  let body: { profile?: ResumeProfile; candidate?: CandidateContext };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const profile = body.profile;
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "cv_missing", message: "Confirm your CV before generating a tailored version." },
      { status: 422 },
    );
  }

  const candidate: CandidateContext = body.candidate || {
    skills: profile.skills || [],
    role: profile.basics?.headline || "",
    languages: profile.languages || [],
    location: profile.basics?.location || "",
  };

  const result = tailorCvForJob(profile, ctx.session.job, ctx.session.match, candidate);
  const plainText = formatResumeProfileText(result.profile);

  const doc = await saveDocument({
    userId: ctx.userId,
    sessionId,
    type: "cv",
    payload: { profile: result.profile, changes: result.changes, matchBefore: result.matchBefore, projectedMatchAfter: result.projectedMatchAfter },
    plainText,
    evidenceWarnings: [...result.blockedClaims, ...result.warnings],
  });

  if (!doc) {
    return NextResponse.json({ ok: false, error: "Could not save the tailored CV." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    document: doc,
    changes: result.changes,
    blockedClaims: result.blockedClaims,
    matchBefore: result.matchBefore,
    projectedMatchAfter: result.projectedMatchAfter,
  });
}
