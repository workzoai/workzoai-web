import { NextResponse } from "next/server";
import {
  createWorkZoSupabaseServiceClient,
  getWorkZoUserIdFromRequest,
} from "@/lib/workzoSupabaseService";
import { assertNoFounderPersonalDetails, scrubFounderPersonalDetails } from "@/lib/workzoPrivacyCleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const userId = await getWorkZoUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = scrubFounderPersonalDetails(await request.json());
    assertNoFounderPersonalDetails(body, "interview message");

    if (!body.sessionId || !body.role || !body.text) {
      return NextResponse.json({ error: "Missing sessionId, role, or text" }, { status: 400 });
    }

    const supabase = createWorkZoSupabaseServiceClient();
    const { data, error } = await supabase
      .from("interview_messages")
      .insert({
        session_id: body.sessionId,
        user_id: userId,
        role: body.role,
        speaker: body.speaker || null,
        message: body.text,
        message_index: Number(body.messageIndex || 0),
        metadata: body.metadata || {},
      })
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, message: data });
  } catch (error) {
    console.error("POST interview-message db error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save interview message" },
      { status: 500 },
    );
  }
}
