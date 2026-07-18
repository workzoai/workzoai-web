/*
 * app/api/smart-apply/[sessionId]/linkedin/route.ts
 *
 * LinkedIn advice for this application. Separates "safe for this tailored CV only"
 * from "worth making permanent on your profile", where permanent recommendations
 * require the requirement to recur across the user's wider target-role corpus
 * (spec section 16).
 *
 * The corpus is optional: the client may pass recent matches for the same target
 * role. With none, nothing is recommended permanently, which is the safe default.
 */

import { NextRequest, NextResponse } from "next/server";
import { loadSmartApplyContext } from "@/app/api/smart-apply/[sessionId]/_shared";
import { buildLinkedInAdvice } from "@/lib/smart-apply/buildLinkedInAdvice";
import type { JobMatchResult } from "@/lib/jobs/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  // LinkedIn advice is a Premium capability alongside the other documents.
  const ctx = await loadSmartApplyContext(sessionId, "smart_apply_documents");
  if (!ctx.ok) return ctx.response;

  let body: { corpusMatches?: JobMatchResult[] };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const corpus = Array.isArray(body.corpusMatches) ? body.corpusMatches : [];
  const advice = buildLinkedInAdvice(ctx.session.match, corpus);

  return NextResponse.json({ ok: true, advice });
}
