
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


function stripRepeatedSpeech(value: string): string {
  const clean = cleanText(value, 2000);
  if (!clean) return "";

  const normalized = clean.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const words = normalized.split(" ").filter(Boolean);
  const originalWords = clean.split(/\s+/).filter(Boolean);

  if (words.length < 6) return clean;

  // Exact duplicated halves from STT/Vapi: "answer answer".
  if (words.length % 2 === 0) {
    const half = words.length / 2;
    const first = words.slice(0, half).join(" ");
    const second = words.slice(half).join(" ");
    if (first === second) return originalWords.slice(0, half).join(" ");
  }

  // Near duplicated halves with one or two filler-word differences.
  for (let half = Math.floor(words.length / 2) - 2; half <= Math.ceil(words.length / 2) + 2; half += 1) {
    if (half < 4 || half >= words.length) continue;
    const first = words.slice(0, half);
    const second = words.slice(half, half * 2);
    if (second.length < Math.max(4, first.length - 2)) continue;
    const overlap = first.filter((word, index) => second[index] === word).length / Math.max(first.length, second.length);
    if (overlap >= 0.82) return originalWords.slice(0, half).join(" ");
  }

  // Repeated sentence-like chunks without punctuation.
  const chunkSize = Math.floor(words.length / 2);
  if (chunkSize >= 5) {
    const firstChunk = words.slice(0, chunkSize).join(" ");
    const remaining = words.slice(chunkSize).join(" ");
    if (remaining.includes(firstChunk) || firstChunk.includes(remaining)) {
      return originalWords.slice(0, chunkSize).join(" ");
    }
  }

  return clean;
}

function cleanRoleLabel(value: unknown): string {
  const raw = cleanText(value, 140);
  if (!raw) return "this role";
  if (/^(interview role|role|job role|target role|position|this role)$/i.test(raw)) return "this role";
  return raw.replace(/\s+role$/i, "");
}

function hasMeaningfulJdOrCv(body: ReplyRequestBody): boolean {
  return Boolean(cleanText(body.cvText, 200).length > 80 || cleanText(body.jobDescription, 200).length > 80);
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
  const role = cleanRoleLabel(targetRole);

  if (language === "German") return `Mir geht es gut, danke der Nachfrage. Schön, dass es dir auch gut geht. Ich habe mir den Rollenkontext für ${role} angesehen. Zum Einstieg: Kannst du dich bitte kurz vorstellen und erklären, wie deine Erfahrung zu dieser Gelegenheit passt?`;
  if (language === "Dutch") return `Het gaat goed, dank je dat je het vraagt. Fijn om te horen dat het ook goed met jou gaat. Ik heb de rolcontext voor ${role} bekeken. Om te beginnen: kun je jezelf kort voorstellen en uitleggen hoe je ervaring aansluit op deze kans?`;
  if (language === "French") return `Je vais bien, merci de demander. Ravi d’entendre que vous allez bien aussi. J’ai consulté le contexte du poste ${role}. Pour commencer, pouvez-vous vous présenter brièvement et expliquer en quoi votre expérience correspond à cette opportunité ?`;
  if (language === "Spanish") return `Estoy bien, gracias por preguntar. Me alegra saber que tú también estás bien. He revisado el contexto del puesto ${role}. Para empezar, ¿puedes presentarte brevemente y explicar cómo tu experiencia encaja con esta oportunidad?`;
  if (language === "Italian") return `Sto bene, grazie per avermelo chiesto. Mi fa piacere sentire che stai bene anche tu. Ho letto il contesto del ruolo ${role}. Per iniziare, puoi presentarti brevemente e spiegare come la tua esperienza si collega a questa opportunità?`;
  if (language === "Portuguese") return `Estou bem, obrigado por perguntares. Fico feliz por saber que também estás bem. Analisei o contexto da função ${role}. Para começar, podes apresentar-te brevemente e explicar como a tua experiência se relaciona com esta oportunidade?`;
  if (language === "Hindi") return `मैं ठीक हूँ, पूछने के लिए धन्यवाद। अच्छा लगा कि आप भी ठीक हैं। मैंने ${role} भूमिका का संदर्भ देखा है। शुरुआत के लिए, कृपया अपना छोटा परिचय दें और बताएं कि आपका अनुभव इस अवसर से कैसे जुड़ता है।`;

  return `I’m doing well, thank you for asking. Glad to hear you’re doing well too. I've reviewed the role context you provided for ${role}. To get started, could you briefly introduce yourself and explain how your experience connects to this opportunity?`;
}

function normaliseTranscript(raw: TranscriptTurn[] | undefined): TranscriptItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(-20).map((turn) => ({
    role: turn.role === "candidate" ? "candidate" : "recruiter",
    text: stripRepeatedSpeech(cleanText(turn.text, 800)),
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

  // Kill the old robotic metric loop globally. The recruiter can ask for evidence,
  // but not this repeated template sentence.
  if (/give me one concrete metric or proof point|time saved, tickets reduced, customer impact|before-and-after result/i.test(reply)) {
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

function buildSafeFallbackRecruiterReply(body: ReplyRequestBody, answer: string, transcript: TranscriptItem[]) {
  const role = cleanRoleLabel(body.targetRole);
  const low = answer.toLowerCase();
  const recentRecruiter = transcript.filter((turn) => turn.role === "recruiter").map((turn) => normalizeForSimilarity(turn.text)).slice(-4);

  const alreadyAskedCustomer = recentRecruiter.some((text) => /difficult customer|customer situation|customer.*handled|personally did/.test(text));
  const alreadyAskedTransition = recentRecruiter.some((text) => /transition|readiness|ready for|not just interest|different direction/.test(text));
  const alreadyAskedDepth = recentRecruiter.some((text) => /one level deeper|hardest decision|technical|diagnosed|resolved/.test(text));

  const hasCustomerEvidence = /customer|client|csat|satisfaction|rapport|relationship|trust|b2b|b2c|de[- ]?escalat|frustrated|happy|feedback|5\s*(?:\/|out of)?\s*5|95|96|97|98/i.test(answer);
  const hasTechnicalEvidence = /api|latency|seconds?|milliseconds?|router|firmware|remote|troubleshoot|debug|diagnos|sql|python|server|network|ticket|incident|integration/i.test(answer);
  const hasOutcome = /reduced|improved|saved|fixed|resolved|faster|happy|satisfied|from .* to|25 seconds|millisecond|result|impact|agreed|closed/i.test(answer);
  const hasOwnership = /\bi\b|personally|my|handled|built|fixed|resolved|diagnosed|created|led|improved|reduced/i.test(answer);

  if (hasCustomerEvidence && !alreadyAskedCustomer) {
    return `That customer-facing experience is relevant for ${role}. Can you walk me through one difficult customer situation — briefly covering the situation, what you personally did, and what changed afterwards?`;
  }

  if (hasCustomerEvidence && alreadyAskedCustomer) {
    return `That gives me a clearer example. Let’s move to another part of ${role}: how would you manage an ongoing customer relationship after the first issue is solved — for example adoption, follow-ups, retention, or preventing the same problem from happening again?`;
  }

  if (hasTechnicalEvidence && hasOutcome && !alreadyAskedDepth) {
    return `That is a useful technical impact example. Take me one level deeper: what was the hardest decision you personally made in that situation, and why did it improve the result?`;
  }

  if (/switch|shift|change|transition|move into|interested in|want to/i.test(low) && !alreadyAskedTransition) {
    return `I understand the transition you are aiming for. What practical experience, project, customer work, or training gives you confidence that you can perform well in ${role}?`;
  }

  if (!hasOwnership) {
    return `Let me make your answer easier to assess. What was your personal responsibility in that example, and what was handled by the team or another person?`;
  }

  if (!hasOutcome) {
    return `That gives me context. What changed after your work — even qualitatively, such as a calmer customer, a resolved issue, faster response, better handover, or improved trust?`;
  }

  return `That helps. Let’s move to a new area: what part of ${role} do you feel strongest in today, and what part would need the most ramp-up?`;
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

  const answer = stripRepeatedSpeech(cleanText(body.answer, 2000));
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
        targetRole: cleanRoleLabel(body.targetRole),
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

    const deterministicReply = buildSafeFallbackRecruiterReply(body, answer, transcript);
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
    const reply = buildSafeFallbackRecruiterReply(body, answer, transcript);
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
