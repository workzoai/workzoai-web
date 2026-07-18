/*
 * app/api/smart-apply/[sessionId]/interview/route.ts
 *
 * Build a job-specific interview plan from the session's CV evidence, the JD
 * requirements, and the KNOWN gaps. Premium Pro (spec section 19), in line with the
 * voice interview simulation living at Pro.
 *
 * Also returns a `prefill` block so the "Practice interview" button can launch the
 * existing interview flow already populated with role, company, JD, and market
 * (spec section 15), instead of asking the user to type it all again.
 */

import { NextRequest, NextResponse } from "next/server";
import { loadSmartApplyContext } from "@/app/api/smart-apply/[sessionId]/_shared";
import { buildInterviewPlan } from "@/lib/smart-apply/buildInterviewPlan";
import type { ResumeProfile } from "@/lib/workzoResumeParser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const ctx = await loadSmartApplyContext(sessionId, "smart_apply_interview");
  if (!ctx.ok) return ctx.response;

  let body: { profile?: ResumeProfile };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  if (!body.profile) {
    return NextResponse.json(
      { ok: false, error: "cv_missing", message: "Confirm your CV before preparing interview questions." },
      { status: 422 },
    );
  }

  const plan = buildInterviewPlan(body.profile, ctx.session.job, ctx.session.match);

  return NextResponse.json({
    ok: true,
    plan,
    // Everything the existing interview flow needs to start, so the user does not
    // re-enter it. The JD comes from the job we already have on the session.
    prefill: {
      targetRole: ctx.session.job.title,
      company: ctx.session.job.company,
      jobDescription: ctx.session.job.description,
      market: ctx.session.job.country || "",
    },
  });
}
