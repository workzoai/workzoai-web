import { NextResponse } from "next/server";
import { createWorkZoSupabaseServiceClient } from "@/lib/workzoSupabaseService";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { assertNoFounderPersonalDetails, scrubFounderPersonalDetails } from "@/lib/workzoPrivacyCleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // Same auth fix as interview-session: getWorkZoUserIdFromRequest only
    // checks for a Bearer token the client never sends — always 401'd.
    const resolved = await resolveWorkZoServerPlan();
    if (!resolved.authenticated || !resolved.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = resolved.userId;

    const supabase = createWorkZoSupabaseServiceClient();
    const { data, error } = await supabase
      .from("interview_results")
      .select("*")
      .eq("user_id", userId)
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

    const { data, error } = await supabase
      .from("interview_results")
      .insert({
        session_id: body.sessionId || null,
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
    return NextResponse.json({ ok: true, result: data });
  } catch (error) {
    console.error("POST interview-result db error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save interview result" },
      { status: 500 },
    );
  }
}
