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
import { buildWorkZoRecruiterReplyV2 } from "@/lib/workzoRecruiterIntelligenceV2";

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
  candidateName?: string;
  targetCompany?: string;
  recruiterName?: string;
  recruiterTitle?: string;
  recruiterTrust?: number;
  recruiterState?: string | null;
  questionIndex?: number;
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
  // V2 persistent memory — enables competency tracking, concern resolution,
  // topic progression, and JD gaps to persist across turns.
  recruiterMemoryV2?: unknown;
};

function cleanText(value: unknown, maxLength = 6000): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}


function normalizeLanguageLabel(value: unknown): string {
  const raw = cleanText(value, 80).toLowerCase();
  if (raw.includes("german") || raw.includes("deutsch") || raw === "de" || raw === "de-de") return "German";
  if (raw.includes("dutch") || raw.includes("nederlands") || raw === "nl" || raw === "nl-nl") return "Dutch";
  if (raw.includes("french") || raw.includes("français") || raw.includes("francais") || raw === "fr" || raw === "fr-fr") return "French";
  if (raw.includes("spanish") || raw.includes("español") || raw.includes("espanol") || raw === "es" || raw === "es-es") return "Spanish";
  if (raw.includes("italian") || raw.includes("italiano") || raw === "it" || raw === "it-it") return "Italian";
  if (raw.includes("portuguese") || raw.includes("portugu") || raw === "pt" || raw === "pt-pt" || raw === "pt-br") return "Portuguese";
  if (raw.includes("hindi") || raw === "hi" || raw === "hi-in") return "Hindi";
  return "English";
}

function isOpeningSmallTalk(answer: string): boolean {
  const clean = answer.toLowerCase().replace(/[^a-z\u00c0-\u024f0-9\s']/gi, " ").replace(/\s+/g, " ").trim();
  if (!clean) return false;
  const words = clean.split(/\s+/).filter(Boolean);

  // Anything under 12 words on the opening turn is treated as small talk.
  // Real interview answers to "tell me about yourself" are 20+ words minimum.
  // This catches: "hi I'm good and how are you" (7w), "doing great thanks for having me" (6w), etc.
  // Previously was ≤6 which let 7-11 word greetings through to GPT-4o unnecessarily.
  if (words.length <= 12) return true;
  if (words.length > 30) return false;

  // Longer answers that are still pure social openers (up to 30 words)
  // e.g. "I'm doing really well thank you so much I'm a bit nervous but excited to be here"
  const greetingDensity = (clean.match(/\b(good|well|fine|great|okay|ok|nervous|excited|happy|glad|thank|thanks|appreciate|nice|wonderful|fantastic|hi|hello|hey|how are you|how about you|doing well|i'm good|im good|i am good)\b/g) || []).length;
  const hasSubstantiveContent = /\b(experience|background|worked|years|role|position|company|skill|project|studied|degree|responsible|managed|built|developed|led|created|handled|support|engineer|analyst|manager|specialist)\b/i.test(clean);

  // High greeting density + no substantive content = social opener
  if (greetingDensity >= 2 && !hasSubstantiveContent) return true;

  // STT filler fragments
  if (/^(sure|yes|yeah|yep|okay|ok|right|got it|let me|uh|um|er|ah|so|and|alright|go ahead|ready|let'?s go|test test|can you hear|audio test)[\s,.]*/.test(clean) && words.length <= 15) {
    return true;
  }

  return false;
}

function buildOpeningIntroReply(languageValue: unknown, targetRole: unknown): string {
  const language = normalizeLanguageLabel(languageValue);
  const role = cleanText(targetRole, 140) || "this role";

  if (language === "German") return `Mir geht es gut, danke der Nachfrage. Schön, dass es dir auch gut geht. Ich habe mir deinen Lebenslauf und die Rolle ${role} angesehen. Zum Einstieg: Kannst du dich bitte kurz vorstellen und erklären, wie deine Erfahrung zu dieser Gelegenheit passt?`;
  if (language === "Dutch") return `Het gaat goed, dank je dat je het vraagt. Fijn om te horen dat het ook goed met jou gaat. Ik heb je cv en de rol ${role} bekeken. Om te beginnen: kun je jezelf kort voorstellen en uitleggen hoe je ervaring aansluit op deze kans?`;
  if (language === "French") return `Je vais bien, merci de demander. Ravi d’entendre que vous allez bien aussi. J’ai consulté votre CV et le poste ${role}. Pour commencer, pouvez-vous vous présenter brièvement et expliquer en quoi votre expérience correspond à cette opportunité ?`;
  if (language === "Spanish") return `Estoy bien, gracias por preguntar. Me alegra saber que tú también estás bien. He revisado tu CV y el puesto de ${role}. Para empezar, ¿puedes presentarte brevemente y explicar cómo tu experiencia encaja con esta oportunidad?`;
  if (language === "Italian") return `Sto bene, grazie per avermelo chiesto. Mi fa piacere sentire che stai bene anche tu. Ho letto il tuo CV e il ruolo ${role}. Per iniziare, puoi presentarti brevemente e spiegare come la tua esperienza si collega a questa opportunità?`;
  if (language === "Portuguese") return `Estou bem, obrigado por perguntares. Fico feliz por saber que também estás bem. Analisei o teu CV e a função ${role}. Para começar, podes apresentar-te brevemente e explicar como a tua experiência se relaciona com esta oportunidade?`;
  if (language === "Hindi") return `मैं ठीक हूँ, पूछने के लिए धन्यवाद। अच्छा लगा कि आप भी ठीक हैं। मैंने आपका CV और ${role} भूमिका देखी है। शुरुआत के लिए, कृपया अपना छोटा परिचय दें और बताएं कि आपका अनुभव इस अवसर से कैसे जुड़ता है।`;

  return `I’m doing well, thank you for asking. Glad to hear you’re doing well too. I had a chance to review your resume and the ${role} role. To get started, could you briefly introduce yourself and explain how your experience connects to this opportunity?`;
}

function normaliseTranscript(raw: TranscriptTurn[] | undefined): TranscriptItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(-20).map((turn) => ({
    role: turn.role === "candidate" ? "candidate" : "recruiter",
    text: cleanText(turn.text, 800),
  }));
}


function normalizeForSimilarity(value: string) {
  return cleanText(value, 1200)
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isBadRecruiterReply(reply: string, transcript: TranscriptItem[]) {
  const clean = normalizeForSimilarity(reply);
  if (!clean) return true;

  // Never let CV layout artifacts leak into the spoken interview.
  if (/\b(professional experience contact|experience contact|skills contact|education contact|profile summary|core competencies|tools ticketing|gans e scooter|candidate\b|public\b)\b/i.test(reply)) {
    return true;
  }

  const recentRecruiter = transcript
    .filter((turn) => turn.role === "recruiter")
    .map((turn) => normalizeForSimilarity(turn.text))
    .filter(Boolean)
    .slice(-3);

  for (const previous of recentRecruiter) {
    if (previous === clean) return true;
    const words = clean.split(" ").filter((word) => word.length > 4);
    if (words.length >= 7) {
      const overlap = words.filter((word) => previous.includes(word)).length / words.length;
      if (overlap >= 0.72) return true;
    }
  }

  return false;
}

function buildDeterministicRecruiterReply(body: ReplyRequestBody, answer: string, transcript: TranscriptItem[]) {
  const decision = buildWorkZoRecruiterReplyV2({
    answer,
    currentQuestion: cleanText(body.currentQuestion, 400) || "Tell me about yourself.",
    transcript,
    setup: {
      cvText: cleanText(body.cvText, 6000),
      jobDescription: cleanText(body.jobDescription, 4000),
      targetRole: cleanText(body.targetRole, 160),
      targetMarket: cleanText(body.targetMarket, 120),
      companyStyle: cleanText(body.companyStyle, 120),
      recruiterPersonality: cleanText(body.recruiterPersonality, 120),
      language: cleanText(body.language, 40),
    },
    trust: typeof body.recruiterTrust === "number" ? body.recruiterTrust : undefined,
  });

  return cleanText(decision.spokenReply || decision.reply || decision.question, 900);
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

  const transcript = normaliseTranscript(body.transcript);
  const candidateTurnCount = transcript.filter((turn) => turn.role === "candidate").length;
  const isOpeningTurn = (typeof body.questionIndex === "number" && body.questionIndex <= 1) || candidateTurnCount <= 1;

  // Critical first-turn guard: short rapport answers must never get swallowed by
  // the LLM/state engine. This guarantees the interview moves from greeting to
  // the real self-introduction question.
  if (isOpeningTurn && isOpeningSmallTalk(answer)) {
    const reply = buildOpeningIntroReply(body.language, body.targetRole);
    return NextResponse.json({
      success: true,
      reply,
      displayQuestion: reply,
      trustDelta: 0,
      recruiterState: "interested",
      shouldAdvanceQuestion: true,
      provider: "opening_guard",
    });
  }

  try {
    const decision = await decideUnifiedRecruiterResponse({
      answer,
      currentQuestion: cleanText(body.currentQuestion, 400) || "Tell me about yourself.",
      transcript,
      setup: {
        cvText: cleanText(body.cvText, 6000),
        jobDescription: cleanText(body.jobDescription, 4000),
        targetRole: cleanText(body.targetRole, 160),
        targetMarket: cleanText(body.targetMarket, 120),
        companyStyle: cleanText(body.companyStyle, 120),
        recruiterPersonality: cleanText(body.recruiterPersonality, 120),
        language: cleanText(body.language, 40),
        candidateName: cleanText(body.candidateName, 120),
        targetCompany: cleanText(body.targetCompany, 160),
        recruiterName: cleanText(body.recruiterName, 120),
        recruiterTitle: cleanText(body.recruiterTitle, 120),
      },
      recruiterTrust: typeof body.recruiterTrust === "number" ? body.recruiterTrust : undefined,
      recruiterState: body.recruiterState ?? null,
    });

    const unifiedReply = decision.spokenReply.trim();
    if (!unifiedReply) throw new Error("Empty reply from unified engine.");

    const deterministicReply = buildDeterministicRecruiterReply(body, answer, transcript);
    const reply = isBadRecruiterReply(unifiedReply, transcript) && deterministicReply
      ? deterministicReply
      : unifiedReply;

    return NextResponse.json({
      success: true,
      reply,
      displayQuestion: reply,
      trustDelta: decision.trustDelta,
      recruiterState: decision.recruiterState,
      shouldAdvanceQuestion: decision.shouldAdvanceQuestion,
      provider: reply === unifiedReply ? "unified_engine" : "deterministic_guard",
    });
  } catch (error) {
    console.error("[interview/reply] Unified engine call failed:", error);
    const reply = buildDeterministicRecruiterReply(body, answer, transcript);
    if (reply) {
      return NextResponse.json({
        success: true,
        reply,
        displayQuestion: reply,
        trustDelta: 0,
        recruiterState: "engaged",
        shouldAdvanceQuestion: true,
        provider: "deterministic_fallback",
      });
    }

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
