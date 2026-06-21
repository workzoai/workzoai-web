import { NextResponse } from "next/server";
import { createWorkZoSupabaseServiceClient } from "@/lib/workzoSupabaseService";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { getWorkZoPlanLimits } from "@/lib/workzoPlanLimits";
import { assertNoFounderPersonalDetails, scrubFounderPersonalDetails } from "@/lib/workzoPrivacyCleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // BUG FIXED: this used to call getWorkZoUserIdFromRequest(request), which
    // only checks for an "Authorization: Bearer <token>" header. The client
    // never sends one anywhere — it authenticates via cookies
    // (credentials: "include"). That meant this route returned 401 for
    // EVERY user, always, regardless of login state — confirmed from live
    // testing. resolveWorkZoServerPlan() reads the actual cookie-based
    // Supabase session, which is what the client is really sending.
    const resolved = await resolveWorkZoServerPlan();
    if (!resolved.authenticated || !resolved.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = resolved.userId;

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
    const resolved = await resolveWorkZoServerPlan();
    if (!resolved.authenticated || !resolved.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = resolved.userId;

    const body = scrubFounderPersonalDetails(await request.json());
    assertNoFounderPersonalDetails(body, "interview session");

    const supabase = createWorkZoSupabaseServiceClient();

    // ── Server-side monthly interview limit ─────────────────────────────────
    // Previously this limit only existed client-side via localStorage
    // (checkWorkZoInterviewAllowed), which any user could bypass by clearing
    // site data or opening a private window — no account changes needed.
    // This enforces it server-side, tied to the authenticated user and the
    // plan resolved from the database (not anything the client claims).
    //
    // A session counts toward the monthly limit the first time it's ever
    // persisted. Every subsequent save of the SAME session (progress
    // updates, status changes) must NOT count again — so this only checks
    // the limit when the incoming sessionId doesn't already exist for this
    // user.
    if (body.sessionId) {
      const { data: existing } = await supabase
        .from("interview_sessions")
        .select("id")
        .eq("id", body.sessionId)
        .eq("user_id", userId)
        .maybeSingle();

      if (!existing) {
        const limits = getWorkZoPlanLimits(resolved.plan);
        const monthlyLimit = limits.unlimitedVoiceInterviews ? Infinity : limits.interviewsPerMonth;

        if (Number.isFinite(monthlyLimit)) {
          const startOfMonth = new Date();
          startOfMonth.setUTCDate(1);
          startOfMonth.setUTCHours(0, 0, 0, 0);

          const { count, error: countError } = await supabase
            .from("interview_sessions")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .gte("started_at", startOfMonth.toISOString());

          if (countError) throw countError;

          if ((count || 0) >= monthlyLimit) {
            console.warn(`[interview-session] Monthly limit reached — user=${userId} plan=${resolved.plan} used=${count} limit=${monthlyLimit}`);
            return NextResponse.json(
              {
                error: "interview_limit_reached",
                message: `You've used all ${monthlyLimit} interviews this month on the ${resolved.plan} plan.`,
                used: count,
                limit: monthlyLimit,
                plan: resolved.plan,
              },
              { status: 403 },
            );
          }
        }
      }
    }

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
