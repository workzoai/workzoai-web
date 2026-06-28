import { NextResponse } from "next/server";
import { createWorkZoSupabaseServiceClient } from "@/lib/workzoSupabaseService";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { assertNoFounderPersonalDetails, scrubFounderPersonalDetails } from "@/lib/workzoPrivacyCleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const resolved = await resolveWorkZoServerPlan();
    if (!resolved.authenticated || !resolved.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const supabase = createWorkZoSupabaseServiceClient();
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

    // The client sends "workzo-session-{timestamp}" as sessionId — not a UUID.
    // Resolve it to the real DB UUID via local_id, or leave session_id null.
    // NEVER pass the raw string to a UUID column — that's the invalid input error.
    let realSessionId: string | null = null;
    if (body.sessionId) {
      const { data: sessionRow } = await supabase
        .from("interview_sessions")
        .select("id")
        .eq("user_id", userId)
        .eq("local_id", body.sessionId)
        .maybeSingle();
      realSessionId = sessionRow?.id || null;
    }

    const { data, error } = await supabase
      .from("interview_results")
      .insert({
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
      })
      .select("*")
      .single();

    if (error) throw error;

    // Patch the session row's duration_seconds if it is 0 or null.
    // This handles the common case where persistInterviewSessionToDb("completed")
    // was dropped by ECONNRESET — the result write succeeds but the session
    // completion write (which carries the real duration) fails silently.
    // We use the durationSeconds field the interview page now sends here.
    const durationFromResult = Math.max(0, Math.round(Number(body.durationSeconds || body.rawResult?.durationSeconds || 0)));
    if (realSessionId && durationFromResult > 0) {
      // Only update if the session currently has duration=0 or null — never overwrite a real value.
      try {
        await supabase
          .from("interview_sessions")
          .update({ duration_seconds: durationFromResult })
          .eq("id", realSessionId)
          .or("duration_seconds.is.null,duration_seconds.eq.0");
      } catch {
        // best-effort patch — never block the result response
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
