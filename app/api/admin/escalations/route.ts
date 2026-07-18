/**
 * app/api/admin/escalations/route.ts
 *
 * Human-in-the-loop review queue. A recruiter (or an automated rule) flags a
 * completed interview for human review; the row lands in interview_escalations
 * and a Slack/Teams/ATS notification fires via lib/notify/dispatch.
 *
 *   GET  ?org=&key=[&status=]   review queue for the org (+ status counts)
 *   POST ?org=&key=            body.action:
 *       "flag" (default)  create an escalation, then dispatch notifications
 *       "update_status"   move an escalation open→reviewing→resolved/dismissed
 *
 * Auth mirrors /api/admin/cohort: founder secret OR the org's HMAC key, so
 * existing partner links work unchanged.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";
import { dispatchNotification } from "@/lib/notify/dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Same derivation as /api/admin/cohort and lib/scoring/orgScoringAuth, so keys
// minted for the cohort dashboard authorize here too.
function orgKey(org: string): string {
  const secret = process.env.FOUNDER_ANALYTICS_SECRET || "";
  return createHmac("sha256", secret).update(`org:${org.toLowerCase().trim()}`).digest("hex").slice(0, 32);
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  try {
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

function authorize(url: URL): { ok: true; orgId: string } | { ok: false; status: number; error: string } {
  const orgId = ((url.searchParams.get("org") || url.searchParams.get("code") || "")).toLowerCase().trim();
  const key = url.searchParams.get("key") || "";
  const secret = url.searchParams.get("secret") || "";
  const founderSecret = process.env.FOUNDER_ANALYTICS_SECRET || "";
  const isFounder = founderSecret.length > 0 && safeEqual(secret, founderSecret);
  if (!orgId) return { ok: false, status: 400, error: "missing_org" };
  const authorized = isFounder || (key.length > 0 && safeEqual(key, orgKey(orgId)));
  if (!authorized) return { ok: false, status: 401, error: "unauthorized" };
  return { ok: true, orgId };
}

const SEVERITIES = new Set(["low", "medium", "high", "exceptional"]);
const STATUSES = new Set(["open", "reviewing", "resolved", "dismissed"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const auth = authorize(url);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const db = serviceClient();
  if (!db) return NextResponse.json({ ok: true, configured: false, escalations: [], counts: {} });

  try {
    const status = (url.searchParams.get("status") || "").toLowerCase().trim();
    let query = db
      .from("interview_escalations")
      .select("*")
      .eq("organization_id", auth.orgId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (status && STATUSES.has(status)) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ ok: false, error: "query_failed", detail: error.message }, { status: 200 });

    const escalations = data || [];
    const counts = escalations.reduce<Record<string, number>>((acc, e) => {
      const s = String((e as { status?: string }).status || "open");
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});
    return NextResponse.json({ ok: true, org: auth.orgId, escalations, counts, total: escalations.length });
  } catch (err) {
    return NextResponse.json({ ok: false, error: "server_error", detail: err instanceof Error ? err.message : "unknown" }, { status: 200 });
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const auth = authorize(url);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const db = serviceClient();
  if (!db) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 200 });

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const action = String(body.action || "flag");

  try {
    if (action === "update_status") {
      const id = String(body.id || "");
      const status = String(body.status || "").toLowerCase();
      if (!id || !STATUSES.has(status)) {
        return NextResponse.json({ ok: false, error: "invalid_status_or_id" }, { status: 400 });
      }
      const patch: Record<string, unknown> = { status };
      if (status === "resolved" || status === "dismissed") {
        patch.resolved_at = new Date().toISOString();
        patch.resolved_by = String(body.resolvedBy || body.actor || "recruiter");
      }
      if (body.assignedTo) patch.assigned_to = String(body.assignedTo);
      const { data, error } = await db
        .from("interview_escalations")
        .update(patch)
        .eq("organization_id", auth.orgId)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) return NextResponse.json({ ok: false, error: "update_failed", detail: error.message }, { status: 200 });
      return NextResponse.json({ ok: true, escalation: data });
    }

    // Default: flag an interview for human review.
    const severity = String(body.severity || "medium").toLowerCase();
    const record = {
      organization_id: auth.orgId,
      candidate_user_id: body.candidateUserId ? String(body.candidateUserId) : null,
      interview_result_id: body.interviewResultId ? String(body.interviewResultId) : null,
      session_id: body.sessionId ? String(body.sessionId) : null,
      candidate_name: body.candidateName ? String(body.candidateName) : null,
      role: body.role ? String(body.role) : null,
      reason: String(body.reason || "flagged_for_review"),
      severity: SEVERITIES.has(severity) ? severity : "medium",
      status: "open",
      wiri: Number.isFinite(Number(body.wiri)) ? Math.round(Number(body.wiri)) : null,
      note: body.note ? String(body.note) : null,
      flagged_by: String(body.flaggedBy || body.actor || "recruiter"),
    };

    const { data: created, error } = await db
      .from("interview_escalations")
      .insert(record)
      .select("*")
      .single();
    if (error) return NextResponse.json({ ok: false, error: "insert_failed", detail: error.message }, { status: 200 });

    // Fire outbound notifications (best-effort; never blocks the flag).
    const label = record.candidate_name || "A candidate";
    const sevLabel = record.severity === "exceptional" ? "⭐ Exceptional" : record.severity === "high" ? "🔴 High" : record.severity === "medium" ? "🟠 Medium" : "🟡 Low";
    const dispatch = await dispatchNotification({
      db,
      organizationId: auth.orgId,
      event: "interview_escalation",
      title: `${sevLabel}: ${label} flagged for review`,
      lines: [
        record.role ? `Role: ${record.role}` : "",
        record.wiri != null ? `WIRI: ${record.wiri}` : "",
        record.reason ? `Reason: ${record.reason.replace(/_/g, " ")}` : "",
        record.note ? `Note: ${record.note}` : "",
      ].filter(Boolean),
      url: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/admin?org=${encodeURIComponent(auth.orgId)}` : null,
      entityType: "escalation",
      entityId: (created as { id?: string })?.id || null,
    });

    return NextResponse.json({ ok: true, escalation: created, dispatch });
  } catch (err) {
    return NextResponse.json({ ok: false, error: "server_error", detail: err instanceof Error ? err.message : "unknown" }, { status: 200 });
  }
}
