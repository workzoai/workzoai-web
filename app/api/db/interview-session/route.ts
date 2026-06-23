import { NextResponse } from "next/server";
import { createWorkZoSupabaseServiceClient } from "@/lib/workzoSupabaseService";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { getWorkZoPlanLimits } from "@/lib/workzoPlanLimits";
import { assertNoFounderPersonalDetails, scrubFounderPersonalDetails } from "@/lib/workzoPrivacyCleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.replace(/\s+/g, " ").trim() || fallback;
}

function cleanScore(value: unknown) {
  const score = Number(value);
  if (!Number.isFinite(score)) return null;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export async function GET() {
  try {
    const resolved = await resolveWorkZoServerPlan();
    if (!resolved.authenticated || !resolved.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const supabase = createWorkZoSupabaseServiceClient();
    const { data, error } = await supabase
      .from("interview_sessions")
      .select("id, local_id, target_role, target_company, recruiter_name, recruiter_title, company_style, atmosphere, country, duration_seconds, overall_score, trust_score, verdict, summary, weakest_moment, created_at")
      .eq("user_id", resolved.userId)
      .order("created_at", { ascending: false })
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
    // Uses local_id (the client's "workzo-session-{timestamp}" string) to
    // detect whether this is a new session or an update to an existing one,
    // since the client never generates a real UUID — only a timestamp string.
    const localId = cleanText(body.localId || body.sessionId);

    if (localId) {
      const { data: existing } = await supabase
        .from("interview_sessions")
        .select("id")
        .eq("user_id", userId)
        .eq("local_id", localId)
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
            .gte("created_at", startOfMonth.toISOString());
          if (countError) throw countError;
          if ((count || 0) >= monthlyLimit) {
            console.warn(`[interview-session] Monthly limit reached — user=${userId} plan=${resolved.plan} used=${count} limit=${monthlyLimit}`);
            return NextResponse.json(
              { error: "interview_limit_reached", message: `You've used all ${monthlyLimit} interviews this month on the ${resolved.plan} plan.`, used: count, limit: monthlyLimit, plan: resolved.plan },
              { status: 403 },
            );
          }
        }
      }
    }

    // Extract setup from body — either a nested setup object or flat fields
    const setup = body.setup || {};

    // Write only to columns that actually exist in the interview_sessions table.
    // Extra runtime state (questionIndex, elapsedSeconds, recruiterMemory,
    // recoverySnapshot) is packed into the report JSON column so it's not lost.
    const row: Record<string, unknown> = {
      user_id: userId,
      local_id: localId || null,
      candidate_name: cleanText(body.candidateName || setup.candidateName) || null,
      target_role: cleanText(body.targetRole || setup.targetRole, "Interview Practice"),
      target_company: cleanText(body.targetCompany || setup.targetCompany) || null,
      recruiter_name: cleanText(body.recruiterName || setup.recruiterName, "AI Recruiter"),
      recruiter_title: cleanText(body.recruiterTitle || setup.recruiterTitle) || null,
      company_style: cleanText(body.companyStyle || setup.companyStyle) || null,
      atmosphere: cleanText(body.atmosphere || setup.atmosphere) || null,
      country: cleanText(body.country || setup.country) || null,
      duration_seconds: Math.max(0, Math.round(Number(body.elapsedSeconds || body.durationSeconds || 0))),
      overall_score: cleanScore(body.overallScore),
      trust_score: cleanScore(body.trustScore),
      verdict: body.verdict ?? null,
      summary: body.summary ?? null,
      weakest_moment: body.weakestMoment ?? null,
      transcript: Array.isArray(body.transcript) ? body.transcript : [],
      // Pack all extra runtime state into report so nothing is lost
      report: {
        questionIndex: body.questionIndex || 0,
        mode: body.mode || "standard",
        recruiterMemory: body.recruiterMemory || {},
        recoverySnapshot: body.recoverySnapshot || {},
        failureReason: body.failureReason || null,
        setup: body.setup || {},
        status: body.status || "active",
        savedAt: new Date().toISOString(),
      },
    };

    const { data, error } = await supabase
      .from("interview_sessions")
      .upsert(row, { onConflict: "user_id,local_id" })
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
