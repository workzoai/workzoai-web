/*
 * app/api/extension/fill-data/route.ts
 *
 * POST  return evidence-gated fill data for one session.
 *
 * Authenticated by the SCOPED FILL TOKEN, not the session cookie. The extension sends
 * the token it was issued plus a sessionId; we return the fields to fill.
 *
 * The profile is sent by the extension because the canonical CV lives client-side
 * today (the same tradeoff flagged in the audit). We recompute nothing about identity,
 * but every generated answer is re-gated here server-side against the session's stored
 * match, so a tampered profile in the request cannot smuggle an unevidenced claim into
 * a form: the match is the server's, the gate is the server's.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyFillToken } from "@/lib/extension/fillToken";
import { getSession } from "@/lib/smart-apply/persistence";
import { buildFillData } from "@/lib/extension/buildFillData";
import type { ResumeProfile } from "@/lib/workzoResumeParser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * CORS. The request comes from a content script whose Origin is the JOB SITE
 * (greenhouse.io, lever.co, ...), not our domain, so this route must answer preflight.
 * We reflect the extension's request but require the token, so an open CORS policy is
 * acceptable here: without a valid scoped token the endpoint returns nothing, and the
 * token is the real access control, not the Origin.
 */
function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "600",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const verified = verifyFillToken(token);
  if (!verified) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: corsHeaders() });
  }

  let body: { sessionId?: string; profile?: ResumeProfile };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400, headers: corsHeaders() });
  }

  if (!body.sessionId) {
    return NextResponse.json({ ok: false, error: "missing sessionId" }, { status: 400, headers: corsHeaders() });
  }
  if (!body.profile) {
    return NextResponse.json({ ok: false, error: "missing profile" }, { status: 422, headers: corsHeaders() });
  }

  // The token's userId scopes the session lookup: the extension can only ever pull
  // fill data for a session that belongs to the token's owner.
  const session = await getSession(verified.userId, body.sessionId);
  if (!session) {
    return NextResponse.json({ ok: false, error: "session not found" }, { status: 404, headers: corsHeaders() });
  }

  const fillData = buildFillData({ id: session.id, job: session.job, match: session.match }, body.profile);
  return NextResponse.json({ ok: true, fillData }, { headers: corsHeaders() });
}
