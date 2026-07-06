import { NextResponse } from "next/server";
import { createWorkZoSupabaseServiceClient } from "@/lib/workzoSupabaseService";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { assertNoFounderPersonalDetails, scrubFounderPersonalDetails } from "@/lib/workzoPrivacyCleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const resolved = await resolveWorkZoServerPlan();
    if (!resolved.authenticated || !resolved.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const supabase = createWorkZoSupabaseServiceClient();
    const { searchParams } = new URL(request.url);
    const localId = searchParams.get("sessionId");

    // 1. If caller provides a session ID, find the result for that exact session
    if (localId) {
      const { data: sessionRow } = await supabase
        .from("interview_sessions")
        .select("id")
        .eq("user_id", resolved.userId)
        .eq("local_id", localId)
        .maybeSingle();

      if (sessionRow?.id) {
        const { data: sessionResult } = await supabase
          .from("interview_results")
          .select("*")
          .eq("user_id", resolved.userId)
          .eq("session_id", sessionRow.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (sessionResult) {
          return NextResponse.json({ ok: true, result: sessionResult });
        }
      }

      // Fallback for orphaned rows saved before session linking existed:
      // match by the local_id embedded in raw_result.id (the client-generated id).
      const { data: orphanedResult } = await supabase
        .from("interview_results")
        .select("*")
        .eq("user_id", resolved.userId)
        .contains("raw_result", { id: localId })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (orphanedResult) {
        return NextResponse.json({ ok: true, result: orphanedResult });
      }
    }

    // 2. Fall back to the most recent row. Do NOT prefer an older scored row here:
    // very short/in-progress saves can have 0/null score, but they still belong to
    // the latest session. Preferring a scored row caused stale reports such as
    // "Alex Chen" and "0 answers captured" to appear after Sarah/Priya/Markus sessions.
    const { data, error } = await supabase
      .from("interview_results")
      .select("*")
      .eq("user_id", resolved.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({ ok: true, result: data || null });
  } catch (error) {
    console.error("GET interview-result db error", error);
    return NextResponse.json({ error: "Failed to read interview result" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const resolved = await resolveWorkZoServerPlan();
    if (!resolved.authenticated || !resolved.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = resolved.userId;

    const body = scrubFounderPersonalDetails(await request.json());
    assertNoFounderPersonalDetails(body, "interview result");

    const supabase = createWorkZoSupabaseServiceClient();

    // The client sends "workzo-session-{timestamp}" as sessionId, not a UUID.
    // Resolve it to the real DB UUID via local_id. If no session row exists yet
    // (e.g. a very short session that ended before any message was persisted),
    // create one now via upsert so this result links correctly.
    let realSessionId: string | null = null;
    if (body.sessionId) {
      const { data: sessionRow } = await supabase
        .from("interview_sessions")
        .select("id")
        .eq("user_id", userId)
        .eq("local_id", body.sessionId)
        .maybeSingle();

      if (sessionRow?.id) {
        realSessionId = sessionRow.id;
      } else {
        const { data: createdRow } = await supabase
          .from("interview_sessions")
          .upsert(
            {
              user_id: userId,
              local_id: body.sessionId,
              target_role: "Interview Practice",
              recruiter_name: "AI Recruiter",
            },
            { onConflict: "user_id,local_id" },
          )
          .select("id")
          .single();
        realSessionId = createdRow?.id || null;
      }
    }

    const resultPayload = {
      session_id: realSessionId,
      user_id: userId,
      overall_score: body.overallScore || null,
      trust_score: body.trustScore || null,
      evidence_quality: body.evidenceQuality || null,
      contradiction_risk: body.contradictionRisk || null,
      strengths: body.strengths || [],
      improvements: body.improvements || [],
      weak_answers: body.weakAnswers || [],
      contradictions: body.contradictions || [],
      evidence_requests: body.evidenceRequests || [],
      raw_result: body.rawResult || body || {},
    };

    // Idempotent save: the interview page can legitimately call this route more
    // than once (normal completion, route change cleanup, retry after slow DB).
    // Duplicate inserts caused stale history rows and occasional ECONNRESET logs.
    // If we can link to a session, update the latest row for that session; only
    // insert when no row exists.
    let data: any = null;
    let error: any = null;

    if (realSessionId) {
      const { data: existing } = await supabase
        .from("interview_results")
        .select("id")
        .eq("user_id", userId)
        .eq("session_id", realSessionId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        const updated = await supabase
          .from("interview_results")
          .update(resultPayload)
          .eq("id", existing.id)
          .select("*")
          .single();
        data = updated.data;
        error = updated.error;
      } else {
        const inserted = await supabase
          .from("interview_results")
          .insert(resultPayload)
          .select("*")
          .single();
        data = inserted.data;
        error = inserted.error;
      }
    } else {
      const inserted = await supabase
        .from("interview_results")
        .insert(resultPayload)
        .select("*")
        .single();
      data = inserted.data;
      error = inserted.error;
    }

    if (error) throw error;

    // Patch the session row's duration_seconds if it is 0 or null.
    // This handles the common case where persistInterviewSessionToDb("completed")
    // was dropped by ECONNRESET, the result write succeeds but the session
    // completion write (which carries the real duration) fails silently.
    // We use the durationSeconds field the interview page now sends here.
    const durationFromResult = Math.max(0, Math.round(Number(body.durationSeconds || body.rawResult?.durationSeconds || 0)));
    if (realSessionId && durationFromResult > 0) {
      // Only update if the session currently has duration=0 or null, never overwrite a real value.
      try {
        await supabase
          .from("interview_sessions")
          .update({ duration_seconds: durationFromResult })
          .eq("id", realSessionId)
          .or("duration_seconds.is.null,duration_seconds.eq.0");
      } catch {
        // best-effort patch, never block the result response
      }
    }

    return NextResponse.json({ ok: true, result: data });
  } catch (error) {
    console.error("POST interview-result db error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save interview result" },
      { status: 500 },
    );
  }
}
