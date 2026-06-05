import { NextResponse } from "next/server";
import {
  createWorkZoSupabaseServiceClient,
  getWorkZoUserIdFromRequest,
} from "@/lib/workzoSupabaseService";
import { assertNoFounderPersonalDetails, scrubFounderPersonalDetails } from "@/lib/workzoPrivacyCleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const userId = await getWorkZoUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createWorkZoSupabaseServiceClient();
    const { data, error } = await supabase
      .from("interview_sessions")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["active", "draft"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ ok: true, session: data || null });
  } catch (error) {
    console.error("GET interview-session db error", error);
    return NextResponse.json({ error: "Failed to read interview session" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getWorkZoUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = scrubFounderPersonalDetails(await request.json());
    assertNoFounderPersonalDetails(body, "interview session");

    const supabase = createWorkZoSupabaseServiceClient();

    const payload = {
      ...(body.sessionId ? { id: body.sessionId } : {}),
      user_id: userId,
      setup: body.setup || {},
      status: body.status || "active",
      mode: body.mode || "standard",
      question_index: Number(body.questionIndex || 0),
      elapsed_seconds: Number(body.elapsedSeconds || 0),
      trust_score: Number(body.trustScore || 70),
      interest_score: Number(body.interestScore || 70),
      recruiter_memory: body.recruiterMemory || {},
      recovery_snapshot: body.recoverySnapshot || {},
      failure_reason: body.failureReason || null,
      started_at: body.startedAt || new Date().toISOString(),
      completed_at: body.completedAt || null,
    };

    const { data, error } = await supabase
      .from("interview_sessions")
      .upsert(payload)
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, session: data });
  } catch (error) {
    console.error("POST interview-session db error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save interview session" },
      { status: 500 },
    );
  }
}
