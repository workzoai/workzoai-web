import { NextResponse } from "next/server";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Tavus Live AI Recruiter is a Premium Pro exclusive feature.
// The 60-minute monthly limit is enforced here server-side via the
// workzo_subscriptions.tavus_minutes_used column in Supabase.
// Client-side tracking in localStorage is kept for real-time UI only
// and must never be the sole enforcement layer.

const TAVUS_MINUTES_LIMIT = 60; // matches spec: 60 Tavus minutes/month for Premium Pro

type TavusRequest = {
  recruiterName?: string;
  recruiterTrust?: number;
  pressure?: number;
};

type TavusEndRequest = {
  conversationId?: string;
  reason?: string;
};

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`${name} is missing in .env.local`);
  }
  return value.trim();
}

/** Read Tavus minutes consumed this billing cycle from Supabase. */
async function getTavusMinutesUsed(userId: string): Promise<number> {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await supabase
    .from("workzo_subscriptions")
    .select("tavus_minutes_used, billing_cycle_start")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return 0;

  // Reset counter if we've moved past the billing cycle start month
  if (data.billing_cycle_start) {
    const cycleStart = new Date(data.billing_cycle_start);
    const now = new Date();
    const sameMonth =
      cycleStart.getFullYear() === now.getFullYear() &&
      cycleStart.getMonth() === now.getMonth();
    if (!sameMonth) return 0;
  }

  return Number(data.tavus_minutes_used || 0);
}

export async function POST(request: Request) {
  // ── Auth + plan gate ────────────────────────────────────────────────────────
  let resolved;
  try {
    resolved = await resolveWorkZoServerPlan();
  } catch {
    return NextResponse.json({ error: "Could not resolve account plan." }, { status: 500 });
  }

  if (!resolved.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (resolved.plan !== "premium_pro") {
    return NextResponse.json(
      {
        error: "premium_pro_required",
        message: "Live AI Recruiter requires Premium Pro.",
        requiredPlan: "premium_pro",
      },
      { status: 403 },
    );
  }

  // ── Server-side Tavus minute limit check ────────────────────────────────────
  // userId is guaranteed non-null here because authenticated is true and
  // premium_pro plans always have a real Supabase user.
  const userId = resolved.userId!;
  let minutesUsed = 0;
  try {
    minutesUsed = await getTavusMinutesUsed(userId);
  } catch (err) {
    console.warn("[tavus] Could not read minutes used from DB, proceeding:", err);
  }

  if (minutesUsed >= TAVUS_MINUTES_LIMIT) {
    return NextResponse.json(
      {
        error: "tavus_minutes_exhausted",
        minutesUsed,
        minutesLimit: TAVUS_MINUTES_LIMIT,
        message: `You have used all ${TAVUS_MINUTES_LIMIT} Live AI Recruiter minutes for this billing cycle. Continuing in Vapi voice mode.`,
        fallbackToVapi: true,
      },
      { status: 403 },
    );
  }
  // ────────────────────────────────────────────────────────────────────────────

  try {
    const body = (await request.json().catch(() => ({}))) as TavusRequest;

    const apiKey = requiredEnv("TAVUS_API_KEY");
    const replicaId = requiredEnv("TAVUS_REPLICA_ID");
    const personaId = requiredEnv("TAVUS_PERSONA_ID");

    const recruiterName = body.recruiterName || "Recruiter";
    const recruiterTrust =
      typeof body.recruiterTrust === "number" ? body.recruiterTrust : 50;
    const pressure = typeof body.pressure === "number" ? body.pressure : 50;

    const response = await fetch("https://tavusapi.com/v2/conversations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        replica_id: replicaId,
        persona_id: personaId,
        conversation_name: `WorkZo Interview - ${recruiterName}`,
        conversational_context: `
You are ${recruiterName}, a realistic recruiter inside WorkZo AI.

Current recruiter trust: ${recruiterTrust}/100
Current pressure: ${pressure}/100

Stay professional, realistic, analytical, skeptical, and emotionally believable.
Ask one question at a time.
Challenge vague answers.
Ask for measurable impact, ownership, and proof.
If the candidate rambles, interrupt politely.
Do not behave like a coach.
Do not give long explanations.
Do not say you are an AI assistant.
        `.trim(),
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data?.message ||
            data?.error ||
            "Live recruiter unavailable. Continuing interview.",
          raw: data,
        },
        { status: response.status },
      );
    }

    const conversationUrl =
      data?.conversation_url ||
      data?.conversationUrl ||
      data?.daily_room_url ||
      data?.dailyRoomUrl ||
      data?.url ||
      data?.conversation?.url ||
      "";

    return NextResponse.json({
      conversationUrl,
      conversationId:
        data?.conversation_id ||
        data?.conversationId ||
        data?.id ||
        data?.conversation?.id ||
        "",
      minutesUsed,
      minutesRemaining: TAVUS_MINUTES_LIMIT - minutesUsed,
      minutesLimit: TAVUS_MINUTES_LIMIT,
      raw: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Live recruiter unavailable. Continuing interview.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  // Auth required to end a conversation too
  let resolved;
  try {
    resolved = await resolveWorkZoServerPlan();
  } catch {
    return NextResponse.json({ error: "Could not resolve account plan." }, { status: 500 });
  }

  if (!resolved.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as TavusEndRequest;
    const conversationId = body.conversationId?.trim();

    if (!conversationId) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "No conversationId provided.",
      });
    }

    const apiKey = requiredEnv("TAVUS_API_KEY");

    const response = await fetch(
      `https://tavusapi.com/v2/conversations/${encodeURIComponent(conversationId)}/end`,
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
        },
      },
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: data?.message || data?.error || "Could not end video conversation.",
          raw: data,
        },
        { status: response.status },
      );
    }

    return NextResponse.json({
      ok: true,
      conversationId,
      reason: body.reason || "manual",
      raw: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Could not end video conversation",
      },
      { status: 500 },
    );
  }
}
