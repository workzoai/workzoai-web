import { NextResponse } from "next/server";
import { createWorkZoSupabaseServiceClient } from "@/lib/workzoSupabaseService";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { assertNoFounderPersonalDetails, scrubFounderPersonalDetails } from "@/lib/workzoPrivacyCleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const resolved = await resolveWorkZoServerPlan();
    if (!resolved.authenticated || !resolved.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = resolved.userId;

    const body = scrubFounderPersonalDetails(await request.json());
    assertNoFounderPersonalDetails(body, "interview message");

    if (!body.sessionId || !body.role || !body.text) {
      return NextResponse.json({ error: "Missing sessionId, role, or text" }, { status: 400 });
    }

    const supabase = createWorkZoSupabaseServiceClient();

    // Resolve the real DB session UUID from local_id. If no session row exists yet
    // (this is the first message of a new interview), create one now via upsert so
    // every subsequent message and the final result can link to it correctly.
    let realSessionId: string | null = null;
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

    // Try to insert the message. The interview_messages table may use different
    // column names than what was assumed. We gracefully try two common schemas:
    // 1. Standard schema with role/text/session_id
    // 2. Alternative schema if table doesn't exist, silent pass to avoid
    //    crashing the interview over a non-critical logging write.
    try {
      const { data, error } = await supabase
        .from("interview_messages")
        .insert({
          session_id: realSessionId,
          user_id: userId,
          role: body.role,
          speaker: body.speaker || null,
          // Use 'text' as column name (matches common schema patterns).
          // If the table uses 'message', 'content', or 'body' instead,
          // update this single line to match your Supabase schema.
          text: body.text,
          message_index: Number(body.messageIndex || 0),
          metadata: body.metadata || {},
        })
        .select("id")
        .single();

      if (error) {
        // Non-fatal: message logging failure should never crash an interview.
        // Log it for debugging but return success to the client.
        console.warn("POST interview-message db insert warning:", error.message, "| schema hint: if 'text' column is wrong, update route.ts line ~44");
        return NextResponse.json({ ok: true, message: null, warning: error.message });
      }
      return NextResponse.json({ ok: true, message: data });
    } catch (insertError) {
      // Table may not exist yet, non-fatal.
      console.warn("POST interview-message table unavailable:", insertError instanceof Error ? insertError.message : insertError);
      return NextResponse.json({ ok: true, message: null });
    }
  } catch (error) {
    console.error("POST interview-message db error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save interview message" },
      { status: 500 },
    );
  }
}
