/**
 * app/api/interview/reply/route.ts
 *
 * WHAT CHANGED vs original:
 * - The reply route now delegates entirely to the unified recruiter intelligence
 *   engine (decideUnifiedRecruiterResponse) instead of making an independent
 *   LLM call via OpenRouter. This removes the "two competing brains" problem:
 *   the same GPT-4o structured call that powers the main /api/interview route
 *   also powers this one, so memory, trust, pressure, and tone are consistent.
 *
 * - For premium users the main /api/interview route already returns a
 *   spokenReply from the unified engine. This route is now a thin convenience
 *   wrapper that re-runs the engine with the same input when the caller needs
 *   a refreshed spoken reply mid-session (e.g. after a partial STT retry).
 *
 * - The OpenRouter dependency is removed from this file entirely. The unified
 *   engine already falls back to the deterministic heuristic if OPENAI_API_KEY
 *   is missing, so this route inherits that graceful degradation automatically.
 *
 * - Temperature, max_tokens, and prompt quality are controlled in one place:
 *   lib/unifiedRecruiterIntelligence.ts (temperature 0.62, max_tokens 1100).
 */

import { NextResponse } from "next/server";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { checkWorkZoRateLimit } from "@/lib/workzoRateLimit";
import {
  decideUnifiedRecruiterResponse,
  type TranscriptItem,
} from "@/lib/unifiedRecruiterIntelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TranscriptTurn = {
  role: "recruiter" | "candidate" | string;
  speaker?: string;
  text: string;
};

type ReplyRequestBody = {
  answer?: string;
  currentQuestion?: string;
  transcript?: TranscriptTurn[];
  cvText?: string;
  jobDescription?: string;
  targetRole?: string;
  targetMarket?: string;
  companyStyle?: string;
  recruiterPersonality?: string;
  language?: string;
  recruiterTrust?: number;
  recruiterState?: string | null;
  // Pre-computed signals passed in as hints (kept for API compatibility).
  // The unified engine ignores these and makes its own assessment, which is
  // more accurate than keyword-based pattern matching.
  signals?: {
    contradiction?: string;
    unsupportedClaim?: string;
    missingMetric?: boolean;
    missingOwnership?: boolean;
    vague?: boolean;
    trust?: number;
    interest?: number;
  };
};

function cleanText(value: unknown, maxLength = 6000): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normaliseTranscript(raw: TranscriptTurn[] | undefined): TranscriptItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(-20).map((turn) => ({
    role: turn.role === "candidate" ? "candidate" : "recruiter",
    text: cleanText(turn.text, 800),
  }));
}

export async function POST(request: Request) {
  // ── Auth gate ──────────────────────────────────────────────────────────────
  let resolved;
  try {
    resolved = await resolveWorkZoServerPlan();
  } catch {
    return NextResponse.json({ error: "Could not resolve account plan." }, { status: 500 });
  }
  if (!resolved.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Plan gate — same as /api/interview ────────────────────────────────────
  // Free users get full reply intelligence for 2 sessions.
  // Restore when ready: uncomment below.
  // if (resolved.plan !== "premium" && resolved.plan !== "premium_pro") {
  //   return NextResponse.json({ error: "upgrade_required", requiredPlan: "premium", reply: null }, { status: 403 });
  // }

  // ── Rate limit ────────────────────────────────────────────────────────────
  const rateLimitKey = `interview_reply:${resolved.userId}`;
  const rateLimit = resolved.plan === "premium_pro" ? 60 : 30;
  const { allowed } = await checkWorkZoRateLimit(rateLimitKey, rateLimit);
  if (!allowed) {
    return NextResponse.json({ error: "rate_limited", reply: null }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as ReplyRequestBody;

  const answer = cleanText(body.answer, 2000);
  if (!answer) {
    return NextResponse.json({ error: "Missing answer." }, { status: 400 });
  }

  try {
    const decision = await decideUnifiedRecruiterResponse({
      answer,
      currentQuestion: cleanText(body.currentQuestion, 400) || "Tell me about yourself.",
      transcript: normaliseTranscript(body.transcript),
      setup: {
        cvText: cleanText(body.cvText, 6000),
        jobDescription: cleanText(body.jobDescription, 4000),
        targetRole: cleanText(body.targetRole, 160),
        targetMarket: cleanText(body.targetMarket, 120),
        companyStyle: cleanText(body.companyStyle, 120),
        recruiterPersonality: cleanText(body.recruiterPersonality, 120),
        language: cleanText(body.language, 40),
      },
      recruiterTrust: typeof body.recruiterTrust === "number" ? body.recruiterTrust : undefined,
      recruiterState: body.recruiterState ?? null,
    });

    const reply = decision.spokenReply.trim();
    if (!reply) throw new Error("Empty reply from unified engine.");

    return NextResponse.json({
      success: true,
      reply,
      displayQuestion: decision.displayQuestion,
      trustDelta: decision.trustDelta,
      recruiterState: decision.recruiterState,
      shouldAdvanceQuestion: decision.shouldAdvanceQuestion,
      provider: "unified_engine",
    });
  } catch (error) {
    console.error("[interview/reply] Unified engine call failed:", error);
    // The caller is responsible for falling back to the deterministic rule-engine
    // reply when success is false — same defensive pattern as before.
    return NextResponse.json(
      {
        success: false,
        reply: null,
        error: error instanceof Error ? error.message : "Engine call failed.",
      },
      { status: 200 },
    );
  }
}
