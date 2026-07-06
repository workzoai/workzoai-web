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
  // Accept `sessionId` as the session identifier too, see the identical fix
  // in /api/db/interview-session: clients send sessionId, and without it every
  // save inserts a duplicate row and multi-counts the voice-minute meter.
  const localId = cleanText(body.localId) || cleanText((body as { sessionId?: string }).sessionId);

  // ── Plan gates ────────────────────────────────────────────────────────────
  // This route writes to the same interview_sessions table as
  // /api/db/interview-session. workzoInterviewQuota.ts documents that BOTH
  // routes must run these checks, this one previously ran neither, making
  // it a live bypass of both the session cap and the minute pool. Existing
  // localId rows (autosaves of in-flight sessions) are skipped inside each
  // check so completed results are never lost at a pool boundary.
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
      console.warn("[interview-sessions] quota check failed, allowing", error);
    }

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
      console.warn("[interview-sessions] voice-minute check failed, allowing", error);
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
    org_code: cleanText((body as { orgCode?: string }).orgCode) || null,
    overall_score: cleanScore(body.overallScore),
    trust_score: cleanScore(body.trustScore),
    verdict: body.verdict ?? null,
    summary: body.summary ?? null,
    weakest_moment: body.weakestMoment ?? null,
    transcript: Array.isArray(body.transcript) ? body.transcript : [],
    report: body.report ?? body,
  };

  const query = supabase.from("interview_sessions");
  const runSave = (r: typeof row) =>
    localId
      ? query.upsert(r, { onConflict: "user_id,local_id" }).select("id").single()
      : query.insert(r).select("id").single();

  let { data, error } = await runSave(row);

  // If the optional `org_code` column hasn't been added yet, the write fails
  // with a "column does not exist" error. Retry once without org_code so saving
  // a session NEVER breaks just because the migration hasn't been run.
  if (error && /org_code/i.test(error.message || "")) {
    const { org_code: _omit, ...rowWithoutOrg } = row;
    void _omit;
    ({ data, error } = await runSave(rowWithoutOrg as typeof row));
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data?.id });
}
