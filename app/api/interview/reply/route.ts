
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

import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Post-generation translation ──────────────────────────────────────────────
// The interview engine always generates in English (where GPT-4o is reliable
// and natural). For non-English interviews, a dedicated fast translation call
// converts the output. This is better than instructing the engine to generate
// in another language directly, which produces unreliable results — the model
// knows English interview patterns deeply, non-English is hit-or-miss.
async function translateReply(text: string, targetLanguage: string): Promise<string> {
  if (!text || !targetLanguage || /^en/i.test(targetLanguage) || /^english$/i.test(targetLanguage)) {
    return text;
  }
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Fast, cheap translation — no need for full 4o
      temperature: 0,
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content: `You are a professional interpreter for a job interview app. If the text is already in ${targetLanguage}, return it unchanged. Otherwise translate it into natural, professional ${targetLanguage}. Output ONLY the final candidate-facing recruiter reply — no explanations, no quotes, no preamble. Preserve the recruiter tone and meaning.`,
        },
        { role: "user", content: text },
      ],
    });
    const translated = response.choices[0]?.message?.content?.trim();
    return translated || text; // Fall back to English on any failure
  } catch {
    return text; // Non-fatal — return English if translation fails
  }
}

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

  const hasSubstantiveContent = /\b(experience|background|worked|years?|role|position|company|skill|project|studied|degree|responsible|managed|built|developed|led|created|handled|support|engineer|analyst|manager|specialist|supervisor|design|technical)\b/i.test(clean);

  // BUG FIXED: this used to return true for ANY answer ≤12 words on the
  // opening turn regardless of content — a genuine, substantive answer like
  // "I have 12 years of experience as a product design engineer" (exactly
  // 12 words) was misclassified as small talk and got the canned opening
  // line repeated verbatim instead of being treated as a real answer.
  // Anything under 12 words on the opening turn is treated as small talk.
  // Real interview answers to "tell me about yourself" are 20+ words minimum.
  // This catches: "hi I'm good and how are you" (7w), "doing great thanks for having me" (6w), etc.
  // Previously was ≤6 which let 7-11 word greetings through to GPT-4o unnecessarily.
  if (words.length <= 12 && !hasSubstantiveContent) return true;
  if (words.length > 30) return false;

  // Longer answers that are still pure social openers (up to 30 words)
  // e.g. "I'm doing really well thank you so much I'm a bit nervous but excited to be here"
  const greetingDensity = (clean.match(/\b(good|well|fine|great|okay|ok|nervous|excited|happy|glad|thank|thanks|appreciate|nice|wonderful|fantastic|hi|hello|hey|how are you|how about you|doing well|i'm good|im good|i am good)\b/g) || []).length;

  // High greeting density + no substantive content = social opener
  if (greetingDensity >= 2 && !hasSubstantiveContent) return true;

  // STT filler fragments
  if (/^(sure|yes|yeah|yep|okay|ok|right|got it|let me|uh|um|er|ah|so|and|alright|go ahead|ready|let'?s go|test test|can you hear|audio test)[\s,.]*/.test(clean) && words.length <= 15 && !hasSubstantiveContent) {
    return true;
  }

  return false;
}

// Opening turns are almost always short ("can you hear me", "I'm good how are
// you"), but they are NOT all the same message — a candidate who only checked
// audio should not get the exact same reply as one who also asked "how are
// you". This reads the actual words instead of returning one static string
// regardless of input, so the opening doesn't feel like it ignored half of
// what was said.
function buildOpeningIntroReply(languageValue: unknown, targetRole: unknown, answer = ""): string {
  const language = normalizeLanguageLabel(languageValue);
  const role = cleanRoleLabel(targetRole);
  const clean = answer.toLowerCase();

  const askedCanYouHear = /\b(can|do|could) you hear me\b|\bhear me (ok|okay|fine|clearly)?\b|\baudio (ok|okay|test|working)\b|\bcan you see me\b/.test(clean);
  const askedHowAreYou = /\bhow are you\b|\bhow(?:'?s| is) it going\b|\bhow are things\b|\bhow you doing\b/.test(clean);
  const saidGreetingOnly = /\b(hi|hello|hey)\b/.test(clean) && !askedHowAreYou;

  const PARTS: Record<string, { hear: string; wellbeingAsked: string; wellbeingMutual: string; greetingOnly: string; body: string }> = {
    German: {
      hear: "Ja, ich kann dich gut hören. ",
      wellbeingAsked: "Mir geht es gut, danke der Nachfrage. ",
      wellbeingMutual: "Schön, dass es dir auch gut geht. ",
      greetingOnly: "Danke für die Begrüßung. ",
      body: `Ich habe mir den Rollenkontext für ${role} angesehen. Zum Einstieg: Kannst du dich bitte kurz vorstellen und erklären, wie deine Erfahrung zu dieser Gelegenheit passt?`,
    },
    Dutch: {
      hear: "Ja, ik kan je goed horen. ",
      wellbeingAsked: "Het gaat goed, dank je dat je het vraagt. ",
      wellbeingMutual: "Fijn om te horen dat het ook goed met jou gaat. ",
      greetingOnly: "Bedankt voor de begroeting. ",
      body: `Ik heb de rolcontext voor ${role} bekeken. Om te beginnen: kun je jezelf kort voorstellen en uitleggen hoe je ervaring aansluit op deze kans?`,
    },
    French: {
      hear: "Oui, je vous entends bien. ",
      wellbeingAsked: "Je vais bien, merci de demander. ",
      wellbeingMutual: "Ravi d’entendre que vous allez bien aussi. ",
      greetingOnly: "Merci pour votre message. ",
      body: `J’ai consulté le contexte du poste ${role}. Pour commencer, pouvez-vous vous présenter brièvement et expliquer en quoi votre expérience correspond à cette opportunité ?`,
    },
    Spanish: {
      hear: "Sí, te escucho bien. ",
      wellbeingAsked: "Estoy bien, gracias por preguntar. ",
      wellbeingMutual: "Me alegra saber que tú también estás bien. ",
      greetingOnly: "Gracias por el saludo. ",
      body: `He revisado el contexto del puesto ${role}. Para empezar, ¿puedes presentarte brevemente y explicar cómo tu experiencia encaja con esta oportunidad?`,
    },
    Italian: {
      hear: "Sì, ti sento bene. ",
      wellbeingAsked: "Sto bene, grazie per avermelo chiesto. ",
      wellbeingMutual: "Mi fa piacere sentire che stai bene anche tu. ",
      greetingOnly: "Grazie per il saluto. ",
      body: `Ho letto il contesto del ruolo ${role}. Per iniziare, puoi presentarti brevemente e spiegare come la tua esperienza si collega a questa opportunità?`,
    },
    Portuguese: {
      hear: "Sim, consigo ouvir-te bem. ",
      wellbeingAsked: "Estou bem, obrigado por perguntares. ",
      wellbeingMutual: "Fico feliz por saber que também estás bem. ",
      greetingOnly: "Obrigado pelo cumprimento. ",
      body: `Analisei o contexto da função ${role}. Para começar, podes apresentar-te brevemente e explicar como a tua experiência se relaciona com esta oportunidade?`,
    },
    Hindi: {
      hear: "हाँ, मैं आपको साफ़ सुन पा रही हूँ। ",
      wellbeingAsked: "मैं ठीक हूँ, पूछने के लिए धन्यवाद। ",
      wellbeingMutual: "अच्छा लगा कि आप भी ठीक हैं। ",
      greetingOnly: "नमस्ते कहने के लिए धन्यवाद। ",
      body: `मैंने ${role} भूमिका का संदर्भ देखा है। शुरुआत के लिए, कृपया अपना छोटा परिचय दें और बताएं कि आपका अनुभव इस अवसर से कैसे जुड़ता है।`,
    },
    English: {
      hear: "Yes, I can hear you clearly. ",
      wellbeingAsked: "I’m doing well, thank you for asking. ",
      wellbeingMutual: "Glad to hear you’re doing well too. ",
      greetingOnly: "Thanks for the hello. ",
      body: `I've reviewed the role context you provided for ${role}. To get started, could you briefly introduce yourself and explain how your experience connects to this opportunity?`,
    },
  };

  const set = PARTS[language] || PARTS.English;
  let prefix = "";
  if (askedCanYouHear) prefix += set.hear;
  if (askedHowAreYou) prefix += set.wellbeingAsked + set.wellbeingMutual;
  else if (saidGreetingOnly && !askedCanYouHear) prefix += set.greetingOnly;

  return `${prefix}${set.body}`;
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

function getBadRecruiterReplyReason(reply: string, transcript: TranscriptItem[]): string | null {
  const clean = normalizeForSimilarity(reply);
  if (!clean) return "empty_reply";
  const repeatedShortPhrase = clean.match(/^(.{4,80})\s+\1$/i);
  if (repeatedShortPhrase) return "repeated_short_phrase";
  const wordsForRepeat = clean.split(/\s+/).filter(Boolean);
  if (wordsForRepeat.length >= 2 && wordsForRepeat.length <= 8) {
    const half = Math.floor(wordsForRepeat.length / 2);
    if (half > 0 && wordsForRepeat.slice(0, half).join(" ") === wordsForRepeat.slice(half, half * 2).join(" ")) return "repeated_short_phrase";
  }

  // Never let CV layout artifacts leak into the spoken interview.
  if (/\b(professional experience contact|experience contact|skills contact|education contact|profile summary|core competencies|tools ticketing|gans e scooter|candidate\b|public\b)\b/i.test(reply)) {
    return "cv_layout_artifact";
  }

  // Kill the old robotic metric loop globally. The recruiter can ask for evidence,
  // but not this repeated template sentence.
  if (/give me one concrete metric or proof point|time saved, tickets reduced, customer impact|before-and-after result/i.test(reply)) {
    return "banned_metric_template";
  }

  const recentRecruiter = transcript
    .filter((turn) => turn.role === "recruiter")
    .map((turn) => normalizeForSimilarity(turn.text))
    .filter(Boolean)
    .slice(-3);

  for (const previous of recentRecruiter) {
    if (previous === clean) return "exact_repeat";
    const words = clean.split(" ").filter((word) => word.length > 4);
    if (words.length >= 7) {
      const overlap = words.filter((word) => previous.includes(word)).length / words.length;
      if (overlap >= 0.72) return "near_repeat";
    }
  }

  return null;
}

function isBadRecruiterReply(reply: string, transcript: TranscriptItem[]) {
  return getBadRecruiterReplyReason(reply, transcript) !== null;
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

// Structured, greppable logging so a degraded/failed LLM turn is always
// visible in server logs — never just a silent client-side fallback.
// Search server logs for "[interview/reply]" to see every turn's outcome.
function logReplyOutcome(info: {
  userId?: string | null;
  outcome: "opening_guard" | "unified_engine" | "deterministic_guard" | "deterministic_fallback" | "hard_failure";
  durationMs: number;
  reason?: string | null;
  questionIndex?: number;
}) {
  const line = `[interview/reply] outcome=${info.outcome} durationMs=${info.durationMs} user=${info.userId || "unknown"} q=${info.questionIndex ?? "?"}${info.reason ? ` reason=${info.reason}` : ""}`;
  if (info.outcome === "unified_engine" || info.outcome === "opening_guard") {
    console.log(line);
  } else {
    // deterministic_guard / deterministic_fallback / hard_failure all mean the
    // candidate did NOT get the real LLM reply this turn — always a warning.
    console.warn(line);
  }
}

export async function POST(request: Request) {
  const requestStartedAt = Date.now();
  // ── Auth gate ──────────────────────────────────────────────────────────────
  let resolved;
  try {
    resolved = await resolveWorkZoServerPlan();
  } catch (error) {
    console.error("[interview/reply] resolveWorkZoServerPlan failed — client will silently fall back to rule engine.", error);
    return NextResponse.json({ error: "Could not resolve account plan." }, { status: 500 });
  }
  if (!resolved.authenticated) {
    console.warn("[interview/reply] Unauthenticated request — client will silently fall back to rule engine.");
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
    console.warn(`[interview/reply] Rate limited — user=${resolved.userId} plan=${resolved.plan} limit=${rateLimit}/min. Client will silently fall back to rule engine.`);
    return NextResponse.json({ error: "rate_limited", reply: null }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as ReplyRequestBody;

  const answer = stripRepeatedSpeech(cleanText(body.answer, 2000));
  if (!answer) {
    return NextResponse.json({ error: "Missing answer." }, { status: 400 });
  }

  const transcript = normaliseTranscript(body.transcript);
  const candidateTurnCount = transcript.filter((turn) => turn.role === "candidate").length;
  // BUG FIXED: this used to also trigger on body.questionIndex <= 1, but the
  // client sends questionIndex BEFORE incrementing it for the current turn
  // (increment happens only after the reply comes back) — so the second
  // real candidate answer was still sent with questionIndex=1, incorrectly
  // extending the opening-turn guard to it. Confirmed from live testing: a
  // genuine 12-word self-introduction ("I have 12 years of experience as a
  // product design engineer...") got treated as opening small talk and the
  // exact same intro question was asked again verbatim. candidateTurnCount
  // is computed fresh from the actual transcript at request time and isn't
  // subject to that lag — the transcript sent already includes the current
  // turn, so candidateTurnCount === 1 only for the literal first turn.
  const isOpeningTurn = candidateTurnCount <= 1;

  // Critical first-turn guard: short rapport answers must never get swallowed by
  // the LLM/state engine. This guarantees the interview moves from greeting to
  // the real self-introduction question.
  if (isOpeningTurn && isOpeningSmallTalk(answer)) {
    const reply = buildOpeningIntroReply(body.language, body.targetRole, answer);
    // Also initialise V2 memory for a clean slate when the opening guard fires.
    const v2Opening = buildWorkZoRecruiterReplyV2({
      answer,
      setup: {
        cvText: cleanText(body.cvText, 6000),
        jobDescription: cleanText(body.jobDescription, 4000),
        targetRole: cleanRoleLabel(body.targetRole),
        targetMarket: cleanText(body.targetMarket, 120),
        recruiterPersonality: cleanText(body.recruiterPersonality, 120),
        language: cleanText(body.language, 40),
        recruiterName: cleanText(body.recruiterName, 120),
        recruiterTitle: cleanText(body.recruiterTitle, 120),
      },
      memory: body.recruiterMemoryV2 || undefined,
    });
    logReplyOutcome({ userId: resolved.userId, outcome: "opening_guard", durationMs: Date.now() - requestStartedAt, questionIndex: body.questionIndex });
    return NextResponse.json({
      success: true,
      reply,
      displayQuestion: reply,
      trustDelta: 0,
      recruiterState: "interested",
      shouldAdvanceQuestion: true,
      provider: "opening_guard",
      // Return V2 memory even on opening turn so first real answer is tracked
      recruiterMemoryV2: v2Opening.memory,
    });
  }

  try {
    // ── Step 1: Run V2 engine to update persistent state ──────────────────
    // V2 tracks: competency coverage (never re-tests covered dimensions),
    // concern resolution (moves on when evidence given), topic progression
    // (structured roadmap), JD gaps, candidate goals, metrics, strengths.
    // The memory is returned to the client and sent back next turn —
    // this is what prevents repeated questions across the full interview.
    const cvText = cleanText(body.cvText, 6000);
    const jobDescription = cleanText(body.jobDescription, 4000);
    const targetRole = cleanRoleLabel(body.targetRole);

    const v2 = buildWorkZoRecruiterReplyV2({
      answer,
      currentQuestion: cleanText(body.currentQuestion, 400) || "Tell me about yourself.",
      transcript,
      setup: {
        cvText,
        jobDescription,
        targetRole,
        targetMarket: cleanText(body.targetMarket, 120),
        companyStyle: cleanText(body.companyStyle, 120),
        recruiterPersonality: cleanText(body.recruiterPersonality, 120),
        language: cleanText(body.language, 40),
        candidateName: cleanText(body.candidateName, 120),
        targetCompany: cleanText(body.targetCompany, 160),
        recruiterName: cleanText(body.recruiterName, 120),
        recruiterTitle: cleanText(body.recruiterTitle, 120),
      },
      trust: typeof body.recruiterTrust === "number" ? body.recruiterTrust : undefined,
      memory: body.recruiterMemoryV2 || undefined,
    });

    // ── Step 2: Build brain context from V2 memory ─────────────────────────
    // This tells GPT-4o exactly what's been covered, what concerns remain,
    // what JD gaps are open, and what topic to move to next. The recruiter
    // uses this to avoid repeating questions and to thread answers naturally.
    const mem = v2.memory as Record<string, unknown>;
    const lines: string[] = [];

    const answeredCompetencies = Array.isArray(mem.answeredCompetencies) ? mem.answeredCompetencies as string[] : [];
    const activeConcerns = Array.isArray(mem.activeConcerns) ? mem.activeConcerns as Array<{id:string;score:number;askedCount:number}> : [];
    const resolvedConcerns = Array.isArray(mem.resolvedConcerns) ? mem.resolvedConcerns as string[] : [];
    const jdMissingSkills = Array.isArray(mem.jdMissingSkills) ? mem.jdMissingSkills as string[] : [];
    const jdMatchedSkills = Array.isArray(mem.jdMatchedSkills) ? mem.jdMatchedSkills as string[] : [];
    const topicOrder = Array.isArray(mem.interviewTopicOrder) ? mem.interviewTopicOrder as string[] : [];
    const topicIndex = typeof mem.currentTopicIndex === "number" ? mem.currentTopicIndex : 0;
    const metrics = Array.isArray(mem.metrics) ? mem.metrics as string[] : [];
    const candidateGoals = Array.isArray(mem.candidateGoals) ? mem.candidateGoals as string[] : [];
    const strengths = Array.isArray(mem.strengths) ? mem.strengths as string[] : [];
    const companies = Array.isArray(mem.companies) ? mem.companies as string[] : [];
    const contradictions = Array.isArray(mem.contradictions) ? mem.contradictions as string[] : [];

    if (answeredCompetencies.length)
      lines.push("COMPETENCIES COVERED — DO NOT RE-TEST: " + answeredCompetencies.join(", "));
    if (activeConcerns.length)
      lines.push("ACTIVE CONCERNS (address once if score >40, then move on): " +
        activeConcerns.map((c) => `${c.id} (score:${c.score}/100, asked:${c.askedCount}x)`).join(", "));
    if (resolvedConcerns.length)
      lines.push("RESOLVED CONCERNS — NEVER REVISIT: " + resolvedConcerns.join(", "));
    if (jdMissingSkills.length)
      lines.push("JD SKILLS NOT YET EVIDENCED — probe naturally: " + jdMissingSkills.join(", "));
    if (jdMatchedSkills.length)
      lines.push("JD SKILLS EVIDENCED: " + jdMatchedSkills.join(", "));
    const nextTopic = topicOrder[topicIndex];
    if (nextTopic) lines.push("NEXT INTERVIEW TOPIC — follow this: " + nextTopic);
    if (metrics.length) lines.push("CANDIDATE METRICS TO REFERENCE: " + metrics.slice(0, 3).join(", "));
    if (candidateGoals.length) lines.push("CANDIDATE GOALS: " + candidateGoals.join("; "));
    if (strengths.length) lines.push("DEMONSTRATED STRENGTHS: " + strengths.join(", "));
    if (companies.length) lines.push("COMPANIES MENTIONED: " + companies.join(", "));
    if (contradictions.length) lines.push("CONTRADICTIONS DETECTED: " + contradictions.join(" | "));

    const recruiterBrainContext = lines.length
      ? "=== RECRUITER MEMORY STATE ===\n" + lines.join("\n") + "\n=== END MEMORY STATE ==="
      : "";

    // ── Step 3: Call GPT-4o with the full context ──────────────────────────
    const decision = await decideUnifiedRecruiterResponse({
      answer,
      currentQuestion: cleanText(body.currentQuestion, 400) || "Tell me about yourself.",
      transcript,
      setup: {
        cvText,
        jobDescription,
        targetRole,
        targetMarket: cleanText(body.targetMarket, 120),
        companyStyle: cleanText(body.companyStyle, 120),
        recruiterPersonality: cleanText(body.recruiterPersonality, 120),
        language: cleanText(body.language, 40),
        candidateName: cleanText(body.candidateName, 120),
        targetCompany: cleanText(body.targetCompany, 160),
        recruiterName: cleanText(body.recruiterName, 120),
        recruiterTitle: cleanText(body.recruiterTitle, 120),
        // V2 brain state injected directly into the LLM system prompt
        recruiterBrainContext,
      },
      recruiterTrust: typeof body.recruiterTrust === "number" ? body.recruiterTrust : undefined,
      recruiterState: body.recruiterState ?? null,
    });

    const unifiedReply = decision.spokenReply.trim();
    if (!unifiedReply) throw new Error("Empty reply from unified engine.");

    const badReplyReason = getBadRecruiterReplyReason(unifiedReply, transcript);
    const deterministicReply = badReplyReason ? buildSafeFallbackRecruiterReply(body, answer, transcript) : null;
    const reply = badReplyReason && deterministicReply ? deterministicReply : unifiedReply;

    logReplyOutcome({
      userId: resolved.userId,
      outcome: reply === unifiedReply ? "unified_engine" : "deterministic_guard",
      durationMs: Date.now() - requestStartedAt,
      reason: badReplyReason,
      questionIndex: body.questionIndex,
    });

    // Update V2 trust from LLM decision
    (v2.memory as Record<string, unknown>).trustScore =
      Math.max(0, Math.min(100, ((v2.memory as Record<string, unknown>).trustScore as number ?? 70) + (decision.trustDelta || 0)));

    // ── Translate to target language if non-English ─────────────────────
    const targetLanguage = normalizeLanguageLabel(body.language);
    const finalReply = targetLanguage !== "English"
      ? await translateReply(reply, targetLanguage)
      : reply;

    return NextResponse.json({
      success: true,
      reply: finalReply,
      displayQuestion: finalReply,
      trustDelta: decision.trustDelta,
      recruiterState: decision.recruiterState,
      shouldAdvanceQuestion: decision.shouldAdvanceQuestion,
      provider: reply === unifiedReply ? "unified_engine" : "deterministic_guard",
      durationMs: Date.now() - requestStartedAt,
      // ── V2 memory — client MUST persist and send back next turn ──────────
      // Without this, all memory resets to zero every question.
      recruiterMemoryV2: v2.memory,
    });
  } catch (error) {
    const durationMs = Date.now() - requestStartedAt;
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[interview/reply] HARD FAILURE — falling back to rule engine. user=${resolved.userId || "unknown"} durationMs=${durationMs} questionIndex=${body.questionIndex ?? "?"} answerPreview="${answer.slice(0, 80)}" error=${message}`,
      error instanceof Error ? error.stack : error,
    );
    const reply = buildSafeFallbackRecruiterReply(body, answer, transcript);
    if (reply) {
      const targetLanguage = normalizeLanguageLabel(body.language);
      const finalReply = targetLanguage !== "English" ? await translateReply(reply, targetLanguage) : reply;
      logReplyOutcome({ userId: resolved.userId, outcome: "deterministic_fallback", durationMs, reason: message, questionIndex: body.questionIndex });
      return NextResponse.json({
        success: true,
        reply: finalReply,
        displayQuestion: finalReply,
        trustDelta: 0,
        recruiterState: "engaged",
        shouldAdvanceQuestion: true,
        provider: "deterministic_fallback",
        durationMs,
      });
    }

    logReplyOutcome({ userId: resolved.userId, outcome: "hard_failure", durationMs, reason: message, questionIndex: body.questionIndex });
    return NextResponse.json(
      {
        success: false,
        reply: null,
        error: message,
        durationMs,
      },
      { status: 200 },
    );
  }
}
