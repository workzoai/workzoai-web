/*
 * app/api/smart-apply/[sessionId]/cover-letter/route.ts
 *
 * Generate a job-specific cover letter, assembled only from verified CV evidence.
 * If the output scan finds any blocked claim that leaked into the draft, the
 * offending sentences are stripped before the letter is saved: the guarantee holds
 * even when the generator surprises us.
 */

import { NextRequest, NextResponse } from "next/server";
import { loadSmartApplyContext } from "@/app/api/smart-apply/[sessionId]/_shared";
import { generateCoverLetter } from "@/lib/smart-apply/generateCoverLetter";
import { assessEvidence, stripUnsupportedSentences } from "@/lib/smart-apply/validateEvidence";
import { saveDocument } from "@/lib/smart-apply/persistence";
import type { ResumeProfile } from "@/lib/workzoResumeParser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const ctx = await loadSmartApplyContext(sessionId, "smart_apply_documents");
  if (!ctx.ok) return ctx.response;

  let body: { profile?: ResumeProfile };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  if (!body.profile) {
    return NextResponse.json(
      { ok: false, error: "cv_missing", message: "Confirm your CV before generating a cover letter." },
      { status: 422 },
    );
  }

  const result = generateCoverLetter(body.profile, ctx.session.job, ctx.session.match);

  let plainText = result.plainText;
  let removed: string[] = [];
  if (result.violations.length) {
    // A blocked claim reached the draft (usually quoted inside an evidence line).
    // Strip the sentences carrying it rather than ship it.
    const verdict = assessEvidence(ctx.session.match);
    const stripped = stripUnsupportedSentences(plainText, verdict);
    plainText = stripped.text;
    removed = stripped.removed;
  }

  const doc = await saveDocument({
    userId: ctx.userId,
    sessionId,
    type: "cover_letter",
    payload: { paragraphs: result.paragraphs, removedClaims: removed },
    plainText,
    evidenceWarnings: result.evidenceWarnings,
  });

  if (!doc) {
    return NextResponse.json({ ok: false, error: "Could not save the cover letter." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    document: doc,
    blockedClaims: result.evidenceWarnings,
    removedClaims: removed,
  });
}
