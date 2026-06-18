import { NextResponse } from "next/server";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Tavus Live AI Recruiter is a Premium Pro exclusive feature.
// Server-side monthly minute limit is enforced here via Supabase.
const TAVUS_MINUTES_LIMIT = 60;

type RecruiterKey =
  | "sarah"
  | "priya"
  | "daniel"
  | "markus"
  | "alex"
  | "zoe"
  | "james"
  | "marcus"
  | "aisha"
  | "victoria"
  | "david";

type TavusRequest = {
  recruiterId?: string;
  recruiterKey?: string;
  recruiterName?: string;
  recruiterTrust?: number;
  pressure?: number;
  language?: string;
  candidateName?: string;
  targetRole?: string;
};

type TavusEndRequest = {
  conversationId?: string;
  reason?: string;
};

const TAVUS_PERSONAS: Record<RecruiterKey, string> = {
  david: "p43f0c088687",
  victoria: "pd868e6866a6",
  aisha: "pe6d26b20dc4",
  marcus: "pe8bd4a87f3f",
  james: "p997cb0136a1",
  zoe: "p86be1b8d8d2",
  alex: "p12858de5285",
  priya: "pccddb0236d3",
  markus: "p5edfc9facad",
  daniel: "p6861f513449",
  sarah: "p6861f513449",
};

const RECRUITER_DISPLAY_NAMES: Record<RecruiterKey, string> = {
  sarah: "Sarah Chen",
  priya: "Priya Raman",
  daniel: "Daniel Reed",
  markus: "Markus Weber",
  alex: "Alex Chen",
  zoe: "Zoe Park",
  james: "James Harrington",
  marcus: "Marcus Webb",
  aisha: "Aisha Patel",
  victoria: "Victoria Stern",
  david: "David Kimura",
};

const RECRUITER_GENDER: Record<RecruiterKey, "female" | "male"> = {
  sarah: "female",
  priya: "female",
  zoe: "female",
  aisha: "female",
  victoria: "female",
  daniel: "male",
  markus: "male",
  alex: "male",
  james: "male",
  marcus: "male",
  david: "male",
};

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`${name} is missing in .env.local`);
  }
  return value.trim();
}

function optionalEnv(name: string) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : "";
}

function normalizeRecruiterKey(input?: string): RecruiterKey {
  const raw = String(input || "")
    .trim()
    .toLowerCase()
    .replace(/·/g, " ")
    .replace(/-/g, "_")
    .replace(/\s+/g, "_");

  if (!raw) return "sarah";

  if (raw.includes("friendly_hr") || raw.includes("sarah") || raw.includes("chen")) return "sarah";
  if (raw.includes("startup_recruiter") || raw.includes("priya") || raw.includes("raman")) return "priya";
  if (raw.includes("analytical_hiring_manager") || raw.includes("daniel") || raw.includes("reed")) return "daniel";
  if (raw.includes("german_corporate") || raw.includes("corporate") || raw.includes("markus") || raw.includes("weber")) return "markus";
  if (raw.includes("faang_hiring_manager") || raw.includes("faang") || raw.includes("alex")) return "alex";
  if (raw.includes("startup_founder") || raw.includes("zoe") || raw.includes("park")) return "zoe";
  if (raw.includes("consulting_partner") || raw.includes("james") || raw.includes("harrington") || raw.includes("consulting")) return "james";
  if (raw.includes("sales_director") || raw.includes("marcus") || raw.includes("webb") || raw.includes("sales")) return "marcus";
  if (raw.includes("product_leader") || raw.includes("aisha") || raw.includes("patel") || raw.includes("product")) return "aisha";
  if (raw.includes("executive_recruiter") || raw.includes("victoria") || raw.includes("stern") || raw.includes("executive")) return "victoria";
  if (raw.includes("enterprise_recruiter") || raw.includes("david") || raw.includes("kimura") || raw.includes("enterprise")) return "david";

  if (raw in TAVUS_PERSONAS) return raw as RecruiterKey;
  return "sarah";
}

function resolveRecruiterKey(body: TavusRequest): RecruiterKey {
  return normalizeRecruiterKey(
    body.recruiterId || body.recruiterKey || body.recruiterName || "sarah",
  );
}

function resolvePersonaId(recruiterKey: RecruiterKey) {
  return TAVUS_PERSONAS[recruiterKey] || TAVUS_PERSONAS.sarah;
}

function resolveReplicaId(recruiterKey: RecruiterKey) {
  const gender = RECRUITER_GENDER[recruiterKey] || "female";

  const genderSpecificReplica =
    gender === "female"
      ? optionalEnv("TAVUS_FEMALE_REPLICA_ID")
      : optionalEnv("TAVUS_MALE_REPLICA_ID");

  // Backward-compatible fallback if you only configured one Tavus replica.
  return genderSpecificReplica || requiredEnv("TAVUS_REPLICA_ID");
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

function buildConversationContext(input: {
  recruiterName: string;
  recruiterTrust: number;
  pressure: number;
  language: string;
  candidateName: string;
  targetRole: string;
}) {
  return `
You are ${input.recruiterName}, a realistic recruiter inside WorkZo AI.

Candidate name: ${input.candidateName || "Candidate"}
Target role: ${input.targetRole || "the selected role"}
Interview language: ${input.language || "English"}
Current recruiter trust: ${input.recruiterTrust}/100
Current pressure: ${input.pressure}/100

Stay professional, realistic, emotionally believable, and recruiter-like.
Ask one question at a time.
Challenge vague answers.
Ask for measurable impact, ownership, proof, and role relevance.
If the candidate rambles, interrupt politely and redirect.
Do not behave like a coach.
Do not give long explanations.
Do not say you are an AI assistant.
`.trim();
}

export async function POST(request: Request) {
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

  try {
    const body = (await request.json().catch(() => ({}))) as TavusRequest;

    const apiKey = requiredEnv("TAVUS_API_KEY");
    const recruiterKey = resolveRecruiterKey(body);
    const replicaId = resolveReplicaId(recruiterKey);
    const personaId = resolvePersonaId(recruiterKey);

    const recruiterName = body.recruiterName || RECRUITER_DISPLAY_NAMES[recruiterKey] || "Recruiter";
    const recruiterTrust = typeof body.recruiterTrust === "number" ? body.recruiterTrust : 50;
    const pressure = typeof body.pressure === "number" ? body.pressure : 50;
    const language = body.language || "English";
    const candidateName = body.candidateName || "Candidate";
    const targetRole = body.targetRole || "Interview Role";

    const response = await fetch("https://tavusapi.com/v2/conversations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        replica_id: replicaId,
        // persona_id removed — it overrides the replica's visual appearance.
        // Without it, the replica defines the correct avatar (male vs female).
        conversation_name: `WorkZo Interview - ${recruiterName}`,
        conversational_context: buildConversationContext({
          recruiterName,
          recruiterTrust,
          pressure,
          language,
          candidateName,
          targetRole,
        }),
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
      recruiterKey,
      recruiterName,
      personaId,
      replicaGender: RECRUITER_GENDER[recruiterKey],
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
