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
  // V2 persistent memory — sent from client each turn, updated and returned.
  // Enables competency tracking, concern resolution, topic progression, JD gaps
  // to persist across the entire interview instead of resetting every turn.
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
  const clean = answer.toLowerCase().replace(/[^a-zÀ-ÿ0-9\s']/gi, " ").replace(/\s+/g, " ").trim();
  if (!clean) return false;
  const words = clean.split(/\s+/).filter(Boolean);

  // Very short answers (≤6 words) that don't contain substantive content are
  // always treated as small talk / STT noise — never as interview answers.
  // This catches: "sure so sure so", "yes okay", "uh sure", "let me start", etc.
  if (words.length <= 6) return true;
  if (words.length > 18) return false;

  // Standard greetings and social responses
  if (/\b(i'?m good|im good|i am good|doing good|doing well|i'?m fine|im fine|i am fine|fine|good|great|okay|ok|not bad|all good|how are you|how about you|thank you|thanks|yes i can hear|i can hear|can hear you|hello|hi|hey|hallo|bonjour|hola|namaste)\b/i.test(clean)) {
    return true;
  }

  // STT filler fragments: repeated words, pure affirmatives, audio check phrases
  if (/^(sure|yes|yeah|yep|okay|ok|right|got it|let me|uh|um|er|ah|so|and|sure so|yes so|okay so|right so|alright|go ahead|ready|let'?s go|test test|can you hear|audio test)[\s,.]*(sure|yes|yeah|yep|okay|ok|right|got it|let me|uh|um|er|ah|so|and|sure so|yes so|okay so|right so|alright|go ahead|ready|let'?s go)?[\s,.]*$/.test(clean)) {
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

  // The recruiter introduces herself by name and role before asking anything.
  // "I had a chance to review your resume" was removed — the candidate entered
  // a role name, not an actual job posting. Claiming to "review" it sounds fake.
  const recruiterName = cleanText(body.recruiterName, 60) || "Sarah";
  const recruiterTitle = cleanText(body.recruiterTitle, 80) || "Senior Talent Partner";
  return `I'm doing well, thank you. I'm ${recruiterName}, ${recruiterTitle}. I've had a look at your background and I can see you're targeting a ${role} position. Tell me about yourself — what you've been doing and what's driving you toward this direction right now.`;
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
    // Step 1: Run V2 engine to get persistent memory state.
    // This tracks: answeredCompetencies (P4), concern resolution (P2),
    // topic progression (P3), JD gaps (P5), candidate goals/metrics (P6).
    // The memory is returned to the client and sent back next turn.
    const v2 = buildWorkZoRecruiterReplyV2({
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
      trust: typeof body.recruiterTrust === "number" ? body.recruiterTrust : undefined,
      memory: body.recruiterMemoryV2 || undefined,
    });

    // Step 2: Build brain context from V2 memory and inject into LLM prompt.
    // This tells GPT-4o exactly what's been covered, what concerns remain,
    // what JD gaps are open, and what topic to address next.
    const mem = v2.memory as {
      answeredCompetencies?: string[];
      activeConcerns?: Array<{ id: string; score: number; askedCount: number }>;
      resolvedConcerns?: string[];
      jdMissingSkills?: string[];
      jdMatchedSkills?: string[];
      interviewTopicOrder?: string[];
      currentTopicIndex?: number;
      metrics?: string[];
      candidateGoals?: string[];
      strengths?: string[];
      companies?: string[];
      contradictions?: string[];
    };

    const lines: string[] = [];
    if (mem.answeredCompetencies?.length)
      lines.push("COMPETENCIES ALREADY COVERED — DO NOT RE-TEST: " + mem.answeredCompetencies.join(", "));
    if (mem.activeConcerns?.length)
      lines.push("ACTIVE CONCERNS (address once more if score > 40, then move on): " + mem.activeConcerns.map((c) => `${c.id} (score: ${c.score}/100, asked: ${c.askedCount}x)`).join(", "));
    if (mem.resolvedConcerns?.length)
      lines.push("RESOLVED CONCERNS — DO NOT REVISIT: " + mem.resolvedConcerns.join(", "));
    if (mem.jdMissingSkills?.length)
      lines.push("JD SKILLS NOT YET EVIDENCED — probe naturally: " + mem.jdMissingSkills.join(", "));
    if (mem.jdMatchedSkills?.length)
      lines.push("JD SKILLS ALREADY EVIDENCED: " + mem.jdMatchedSkills.join(", "));
    const nextTopic = mem.interviewTopicOrder?.[mem.currentTopicIndex ?? 0];
    if (nextTopic) lines.push("NEXT INTERVIEW TOPIC (follow this): " + nextTopic);
    if (mem.metrics?.length) lines.push("CANDIDATE METRICS TO REFERENCE: " + mem.metrics.slice(0, 3).join(", "));
    if (mem.candidateGoals?.length) lines.push("CANDIDATE STATED GOALS: " + mem.candidateGoals.join("; "));
    if (mem.strengths?.length) lines.push("DEMONSTRATED STRENGTHS: " + mem.strengths.join(", "));
    if (mem.companies?.length) lines.push("COMPANIES MENTIONED: " + mem.companies.join(", "));
    if (mem.contradictions?.length) lines.push("CONTRADICTIONS DETECTED: " + mem.contradictions.join(" | "));

    const recruiterBrainContext = lines.length
      ? "=== RECRUITER BRAIN STATE ===\n" + lines.join("\n") + "\n=== END BRAIN STATE ==="
      : "";

    // Step 3: Call GPT-4o with the full brain context injected.
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
        recruiterBrainContext,
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
      // Return V2 memory — client must persist this and send back next turn.
      // Without this, all P2-P6 intelligence resets to zero every question.
      recruiterMemoryV2: v2.memory,
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
