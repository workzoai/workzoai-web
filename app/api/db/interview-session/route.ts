import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { checkWorkZoInterviewQuota } from "@/lib/workzoInterviewQuota";
import { checkWorkZoServerVoiceMinutes } from "@/lib/workzoServerVoiceMinutes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type InterviewSessionPayload = {
  localId?: string;
  candidateName?: string;
  targetRole?: string;
  targetCompany?: string;
  recruiterName?: string;
  recruiterTitle?: string;
  companyStyle?: string;
  atmosphere?: string;
  country?: string;
  durationSeconds?: number;
  overallScore?: number | null;
  trustScore?: number | null;
  verdict?: unknown;
  summary?: unknown;
  weakestMoment?: unknown;
  transcript?: unknown;
  report?: unknown;
};

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
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("interview_sessions")
    .select("id, target_role, target_company, recruiter_name, recruiter_title, company_style, atmosphere, country, duration_seconds, overall_score, trust_score, verdict, summary, weakest_moment, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sessions: data || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: InterviewSessionPayload;
  try {
    body = (await request.json()) as InterviewSessionPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const targetRole = cleanText(body.targetRole, "Interview Practice");
  // The interview page sends its stable per-interview identifier as
  // `sessionId`, not `localId`, this route only ever read `localId`, so the
  // identifier was always empty and EVERY autosave inserted a brand-new row
  // instead of upserting. That was the root cause of duplicate history
  // entries (previously patched in the UI, not here) and it makes the
  // voice-minute meter multi-count: each autosave snapshot's duration gets
  // summed as if it were a separate interview. Accept either field.
  const localId = cleanText(body.localId) || cleanText((body as { sessionId?: string }).sessionId);

  // Same monthly interview cap as /api/db/interview-session, this route
  // writes to the same interview_sessions table, so it must not be a
  // second, unguarded door into it. See workzoInterviewQuota.ts.
  const resolved = await resolveWorkZoServerPlan();
  if (resolved.authenticated && resolved.userId) {
    try {
      const quota = await checkWorkZoInterviewQuota(resolved.userId, resolved.plan, localId);
      if (quota.blocked) {
        return NextResponse.json(
          { error: "interview_limit_reached", message: `You've used all ${quota.limit} interviews this month on the ${quota.plan} plan.`, used: quota.used, limit: quota.limit, plan: quota.plan },
          { status: 403 },
        );
      }
    } catch (error) {
      console.warn("[interview-sessions] quota check failed, failing closed is not appropriate here, allowing", error);
    }

    // Voice-minute pool gate: sessions are also capped by monthly minutes
    // (300 Premium / 600 Pro), not just session count. Skips existing
    // localId rows (autosaves) inside the check itself. Fails open on
    // infrastructure errors, see workzoServerVoiceMinutes.ts.
    try {
      const minuteGate = await checkWorkZoServerVoiceMinutes(resolved.plan, localId);
      if (!minuteGate.allowed && minuteGate.reason === "voice_minutes_limit") {
        return NextResponse.json(
          {
            error: "voice_minutes_limit",
            message: `You've used all ${minuteGate.minutesLimit} AI voice minutes this month on the ${minuteGate.plan} plan.`,
            minutesUsed: minuteGate.minutesUsed,
            minutesLimit: minuteGate.minutesLimit,
            plan: minuteGate.plan,
          },
          { status: 403 },
        );
      }
    } catch (error) {
      console.warn("[interview-session] voice-minute check failed, allowing", error);
    }
  }

  const row = {
    user_id: user.id,
    local_id: localId || null,
    candidate_name: cleanText(body.candidateName) || null,
    target_role: targetRole,
    target_company: cleanText(body.targetCompany) || null,
    recruiter_name: cleanText(body.recruiterName, "AI Recruiter"),
    recruiter_title: cleanText(body.recruiterTitle) || null,
    company_style: cleanText(body.companyStyle) || null,
    atmosphere: cleanText(body.atmosphere) || null,
    country: cleanText(body.country) || null,
    duration_seconds: Math.max(0, Math.round(Number(body.durationSeconds) || 0)),
    overall_score: cleanScore(body.overallScore),
    trust_score: cleanScore(body.trustScore),
    verdict: body.verdict ?? null,
    summary: body.summary ?? null,
    weakest_moment: body.weakestMoment ?? null,
    transcript: Array.isArray(body.transcript) ? body.transcript : [],
    report: body.report ?? body,
  };

  const query = supabase.from("interview_sessions");
  const { data, error } = localId
    ? await query.upsert(row, { onConflict: "user_id,local_id" }).select("id").single()
    : await query.insert(row).select("id").single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data?.id });
}
