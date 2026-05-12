import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

import {
  behaviorSummary,
  getBehaviorProfile,
} from "@/lib/globalBehaviorEngine";
import {
  detectCandidateContradictions,
  extractCandidateFacts,
  factsToPrompt,
  type Contradiction,
} from "@/lib/candidateFactEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Speaker = "user" | "recruiter" | "candidate" | "assistant" | "system";

type TranscriptItem = {
  id?: string;
  speaker?: Speaker;
  role?: Speaker;
  text?: string;
  content?: string;
  timestamp?: string;
};

type MemoryItem = {
  id?: string;
  label: string;
  value: string;
  importance: "low" | "medium" | "high";
};

type InterviewSetup = {
  cvText?: string;
  jobDescription?: string;
  targetRole?: string;
  companyName?: string;
  country?: string;
  targetMarket?: string;
  language?: string;
  recruiterPersonality?: string;
  recruiterStyle?: string;
  companyStyle?: string;
  pressureMode?: string;
};

type LiveScore = {
  confidence: number;
  relevance: number;
  structure: number;
  evidence: number;
  clarity: number;
  overall: number;
};

type InterviewRequestBody = {
  mode?: "start" | "answer" | "next" | "score" | "finish";
  answer?: string;
  currentQuestion?: string;
  question?: string;
  setup?: InterviewSetup;
  transcript?: TranscriptItem[];
  recruiterMemory?: MemoryItem[];
  pressureLevel?: number;
  emotionState?: string;
  cvText?: string;
  jobDescription?: string;
  targetRole?: string;
  targetMarket?: string;
  roleTitle?: string;
  companyName?: string;
  country?: string;
  language?: string;
  recruiterPersonality?: string;
  recruiterStyle?: string;
  companyStyle?: string;
  pressureMode?: string;
};

type InterviewApiResponse = {
  ok: true;
  mode: string;
  recruiterReply: string;
  recruiterReaction: string;
  question: string;
  nextQuestion: string;
  interruption:
    | {
        shouldInterrupt: boolean;
        interruptionMessage: string;
        severity: "low" | "medium" | "high";
      }
    | "";
  contradictions: string[];
  contradictionDetails: Contradiction[];
  recruiterMood: "Analytical" | "Skeptical" | "Interested" | "Neutral" | "Supportive";
  emotionState: "skeptical" | "interested" | "neutral" | "supportive" | "concerned";
  pressureLevel: number;
  liveScore: LiveScore;
  score: LiveScore;
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  risks: string[];
  recruiterMemory: MemoryItem[];
  memoryUpdates: MemoryItem[];
  memoryConfidence: number;
  resultSnapshot: {
    overall: number;
    readiness: "Interview ready" | "Almost ready" | "Needs practice";
    recruiterTrust: number;
    strongestSignal: string;
    weakestSignal: string;
    nextAction: string;
  };
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function clamp(value: number, min = 0, max = 100) {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function getSetup(body: InterviewRequestBody): Required<InterviewSetup> {
  const country =
    cleanText(body.setup?.country ?? body.setup?.targetMarket ?? body.country ?? body.targetMarket) ||
    "Global";

  const companyStyle =
    cleanText(body.setup?.companyStyle ?? body.setup?.recruiterStyle ?? body.companyStyle ?? body.recruiterStyle) ||
    "Realistic";

  return {
    cvText: cleanText(body.setup?.cvText ?? body.cvText),
    jobDescription: cleanText(body.setup?.jobDescription ?? body.jobDescription),
    targetRole: cleanText(body.setup?.targetRole ?? body.targetRole ?? body.roleTitle) || "General Role",
    companyName: cleanText(body.setup?.companyName ?? body.companyName) || "Target Company",
    country,
    targetMarket: country,
    language: cleanText(body.setup?.language ?? body.language) || "English",
    recruiterPersonality:
      cleanText(body.setup?.recruiterPersonality ?? body.recruiterPersonality) || "analytical_hiring_manager",
    recruiterStyle: companyStyle,
    companyStyle,
    pressureMode: cleanText(body.setup?.pressureMode ?? body.pressureMode) || "Realistic",
  };
}

function normalizeTranscript(items: TranscriptItem[] = []) {
  return items
    .map((item) => {
      const speaker = item.speaker ?? item.role ?? "system";
      const text = cleanText(item.text ?? item.content);
      return { speaker, text };
    })
    .filter((item) => item.text)
    .slice(-8);
}

function previousUserAnswers(items: TranscriptItem[] = []) {
  return normalizeTranscript(items)
    .filter((item) => item.speaker === "user" || item.speaker === "candidate")
    .map((item) => item.text)
    .slice(-6);
}

function issueText(issue: Contradiction) {
  return `${issue.field}: candidate said "${issue.candidateClaim}", but ${issue.resumeEvidence}`;
}

function strongestIssue(issues: Contradiction[]) {
  return (
    issues.find((issue) => issue.severity === "high") ||
    issues.find((issue) => issue.severity === "medium") ||
    issues[0]
  );
}

function readinessFromScore(score: number): "Interview ready" | "Almost ready" | "Needs practice" {
  if (score >= 80) return "Interview ready";
  if (score >= 65) return "Almost ready";
  return "Needs practice";
}

function chooseAdaptiveFollowup(answer: string, profile: ReturnType<typeof getBehaviorProfile>) {
  const lower = answer.toLowerCase();

  if (profile.companyStyle === "Startup") {
    if (!/(owned|built|launched|shipped|decided|initiated)/i.test(answer)) {
      return "I’m missing ownership. What did you personally own from start to finish?";
    }
    return "How quickly did you move from problem to action?";
  }

  if (profile.companyStyle === "Corporate") {
    if (!/(stakeholder|team|process|escalat|communicat|align)/i.test(answer)) {
      return "In a corporate setting, stakeholder handling matters. Who was involved and how did you manage expectations?";
    }
    return "What process did you follow and how did you reduce risk?";
  }

  if (profile.companyStyle === "Technical") {
    if (!/(implemented|debugged|architecture|api|data|system|logic|tradeoff|technical)/i.test(answer)) {
      return "I need more technical depth. What exactly did you implement or analyze?";
    }
    return "What technical tradeoff did you make and why?";
  }

  if (profile.companyStyle === "Consulting") {
    if (!/(first|second|third|framework|structured|prioritized|stakeholder|client)/i.test(answer)) {
      return "Structure that like a consultant: what were the three steps you followed?";
    }
    return "What was the stakeholder or client impact?";
  }

  if (profile.market === "Germany" && !/(process|timeline|responsibility|precise|documented|structured)/i.test(answer)) {
    return "For this market, I need more precision. What was the exact process, timeline, and your responsibility?";
  }

  if (profile.market === "US" && !/(impact|result|increased|reduced|saved|growth|revenue|customer)/i.test(lower)) {
    return "I’m not hearing enough business impact. What changed because of your work?";
  }

  if (profile.market === "Netherlands" && answer.split(/\s+/).length > 110) {
    return "Let’s make that more direct. What did you do, what changed, and why does it matter?";
  }

  return profile.followUpExamples[0] || "Can you make that more specific?";
}

function recruiterFollowup(answer: string, contradictions: Contradiction[], profile: ReturnType<typeof getBehaviorProfile>) {
  if (contradictions.length > 0) {
    const top = strongestIssue(contradictions);
    return top.clarificationQuestion;
  }

  const lower = answer.toLowerCase();
  const wordCount = answer.split(/\s+/).filter(Boolean).length;

  if (!lower.includes("%") && !/\b\d+\b/.test(lower) && !/(improved|reduced|increased|saved|delivered|resolved|built)/i.test(answer)) {
    if (profile.market === "US" || profile.companyStyle === "Startup") {
      return "I still don’t hear the business impact or measurable result. What changed because of your work?";
    }

    return "I still don’t understand the measurable impact. Give me one result you can defend.";
  }

  if (wordCount < 25) {
    return "That answer is too short. Give me a more structured example.";
  }

  if (/\bmaybe|i think|probably|not sure|kind of\b/i.test(answer)) {
    return "You sound uncertain there. Say it with stronger ownership, or clarify what you actually did.";
  }

  return chooseAdaptiveFollowup(answer, profile);
}

function scoreAnswer(answer: string, contradictions: Contradiction[], profile: ReturnType<typeof getBehaviorProfile>): LiveScore {
  const weights = profile.scoringWeights;
  const wordCount = answer.split(/\s+/).filter(Boolean).length;
  const hasMetric = /%|\b\d+\b|customers?|users?|tickets?|cases?|hours?|days?|weeks?|months?|revenue|cost|saved/i.test(answer);
  const hasImpactVerb = /\bimproved|reduced|increased|saved|resolved|built|automated|delivered|supported\b/i.test(answer);
  const hasStructure = /\bfirst|second|finally|situation|task|action|result|because|therefore|for example\b/i.test(answer);
  const uncertainty = /\bmaybe|i think|probably|not sure|kind of\b/i.test(answer);

  const penalty = contradictions.reduce((total, item) => {
    if (item.severity === "high") return total + 18;
    if (item.severity === "medium") return total + 11;
    return total + 5;
  }, 0);

  const raw = {
    evidence: clamp((hasMetric ? 78 : 48) + (hasImpactVerb ? 8 : 0) - penalty),
    structure: clamp((wordCount > 40 ? 76 : 52) + (hasStructure ? 10 : 0) - contradictions.length * 4),
    confidence: clamp((uncertainty ? 45 : 74) - penalty),
    relevance: clamp(72 + (hasImpactVerb ? 6 : 0) - penalty),
    clarity: clamp((wordCount >= 25 && wordCount <= 140 ? 76 : 62) - (uncertainty ? 6 : 0) - contradictions.length * 4),
  };

  const totalWeight =
    weights.confidence + weights.relevance + weights.structure + weights.evidence + weights.clarity;

  const overall = clamp(
    (raw.confidence * weights.confidence +
      raw.relevance * weights.relevance +
      raw.structure * weights.structure +
      raw.evidence * weights.evidence +
      raw.clarity * weights.clarity) /
      totalWeight
  );

  return { ...raw, overall };
}

function buildMemory({
  existingMemory,
  followup,
  contradictions,
  score,
  profile,
  memoryConfidence,
}: {
  existingMemory: MemoryItem[];
  followup: string;
  contradictions: Contradiction[];
  score: LiveScore;
  profile: ReturnType<typeof getBehaviorProfile>;
  memoryConfidence: number;
}) {
  const updates: MemoryItem[] = [];

  contradictions.forEach((issue) => {
    updates.push({
      label: "CV contradiction detected",
      value: issueText(issue),
      importance: issue.severity === "high" ? "high" : "medium",
    });
  });

  updates.push({
    label: "Recruiter behavior context",
    value: `${profile.market} / ${profile.companyStyle}: ${profile.followUpStyle}`,
    importance: "medium" as const,
  });

  updates.push({
    label: "Memory confidence",
    value: `${memoryConfidence}/100 recruiter trust in candidate consistency`,
    importance: memoryConfidence < 60 ? "high" : "medium",
  });

  updates.push({
    label: "Recent recruiter observation",
    value: followup,
    importance: contradictions.length > 0 || score.overall < 65 ? "high" : "medium",
  });

  if (score.evidence < 60) {
    updates.push({
      label: "Weak evidence pattern",
      value: "Candidate needs stronger measurable proof and concrete business impact.",
      importance: "high" as const,
    });
  }

  return {
    recruiterMemory: [...existingMemory, ...updates].slice(-18),
    memoryUpdates: updates,
  };
}

function localEngine(body: InterviewRequestBody): InterviewApiResponse {
  const setup = getSetup(body);
  const profile = getBehaviorProfile(setup.country, setup.companyStyle, setup.recruiterPersonality);
  const mode = body.mode ?? "answer";
  const answer = cleanText(body.answer);
  const pressureLevel = clamp(Number(body.pressureLevel ?? 35), 0, 100);
  const existingMemory = Array.isArray(body.recruiterMemory) ? body.recruiterMemory : [];
  const facts = extractCandidateFacts(setup.cvText);

  const neutralScore: LiveScore = {
    confidence: 65,
    relevance: 65,
    structure: 65,
    evidence: 65,
    clarity: 65,
    overall: 65,
  };

  if (mode === "start" || !answer) {
    const firstQuestion =
      cleanText(body.currentQuestion ?? body.question) ||
      `I reviewed your CV for the ${setup.targetRole} role. Tell me about yourself and keep it relevant to this position.`;

    return {
      ok: true,
      mode,
      recruiterReply: `Good to meet you. I’ll interview you with a ${profile.market} market lens and a ${profile.companyStyle.toLowerCase()} company style.`,
      recruiterReaction: `Good to meet you. I’ll interview you with a ${profile.market} market lens and a ${profile.companyStyle.toLowerCase()} company style.`,
      question: firstQuestion,
      nextQuestion: firstQuestion,
      interruption: "",
      contradictions: [],
      contradictionDetails: [],
      recruiterMood: "Analytical",
      emotionState: "neutral",
      pressureLevel,
      liveScore: neutralScore,
      score: neutralScore,
      strengths: [],
      weaknesses: [],
      improvements: [`Answer in a ${profile.preferredAnswerStyle} way.`],
      risks: [],
      recruiterMemory: [
        ...existingMemory,
        {
          label: "Candidate facts extracted",
          value: factsToPrompt(facts),
          importance: "high" as const,
        },
      ].slice(-18),
      memoryUpdates: [],
      memoryConfidence: 82,
      resultSnapshot: {
        overall: 65,
        readiness: "Almost ready",
        recruiterTrust: 68,
        strongestSignal: `${profile.market} + ${profile.companyStyle} interview context loaded.`,
        weakestSignal: "No answer assessed yet.",
        nextAction: "Answer the first question with a result-first structure.",
      },
    };
  }

  const memoryCheck = detectCandidateContradictions({
    answer,
    cvText: setup.cvText,
    previousUserAnswers: previousUserAnswers(body.transcript),
    sensitivity: profile.contradictionSensitivity,
  });

  const contradictionDetails = memoryCheck.contradictions;
  const hasContradiction = contradictionDetails.length > 0;
  const top = hasContradiction ? strongestIssue(contradictionDetails) : null;
  const followup = recruiterFollowup(answer, contradictionDetails, profile);
  const score = scoreAnswer(answer, contradictionDetails, profile);
  const memoryConfidence = clamp(
    82 -
      contradictionDetails.length * 16 -
      memoryCheck.riskSignals.length * 6 +
      memoryCheck.confidenceSignals.length * 4
  );

  const pressureDelta = hasContradiction ? 24 : answer.length < 90 ? 10 : -5;
  const updatedPressure = clamp(pressureLevel + pressureDelta * profile.pressureMultiplier, 0, 100);
  const memory = buildMemory({
    existingMemory,
    followup,
    contradictions: contradictionDetails,
    score,
    profile,
    memoryConfidence,
  });

  const contradictionTexts = contradictionDetails.map(issueText);

  const nextQuestion = top
    ? top.clarificationQuestion
    : score.evidence < 60
      ? "What measurable result or business impact can you attach to that example?"
      : score.structure < 65
        ? "Can you repeat that using Situation, Action, and Result in under 60 seconds?"
        : chooseAdaptiveFollowup(answer, profile);

  const interruption = hasContradiction
    ? {
        shouldInterrupt: true,
        interruptionMessage: `Let me stop you there. ${followup}`,
        severity: top?.severity || "medium",
      }
    : score.overall < 62
      ? {
          shouldInterrupt: true,
          interruptionMessage: followup,
          severity: "medium" as const,
        }
      : "";

  return {
    ok: true,
    mode,
    recruiterReply: hasContradiction ? `Let me stop you there. ${followup}` : followup,
    recruiterReaction: hasContradiction ? `Let me stop you there. ${followup}` : followup,
    question: nextQuestion,
    nextQuestion,
    interruption,
    contradictions: contradictionTexts,
    contradictionDetails,
    recruiterMood: hasContradiction ? "Skeptical" : score.overall > 78 ? "Interested" : "Neutral",
    emotionState: hasContradiction ? "skeptical" : score.overall > 78 ? "interested" : "neutral",
    pressureLevel: updatedPressure,
    liveScore: score,
    score,
    strengths:
      score.overall >= 75
        ? ["Relevant answer", "Good confidence", score.evidence >= 70 ? "Some measurable proof" : "Clear intent"]
        : ["Stayed engaged with the question"],
    weaknesses: [
      ...(hasContradiction ? ["Answer conflicts with CV context"] : []),
      ...(score.evidence < 65 ? ["Missing measurable proof"] : []),
      ...(score.structure < 65 ? ["Needs stronger answer structure"] : []),
      ...profile.redFlags.slice(0, 1),
    ].slice(0, 4),
    improvements: [
      hasContradiction
        ? "Clarify the mismatch before continuing. Do not invent or exaggerate details."
        : `Answer in a ${profile.preferredAnswerStyle} style.`,
      profile.followUpExamples[0] || "Add truthful metrics you can defend.",
      "Tie the answer directly to the job description.",
    ],
    risks: [...contradictionTexts, ...memoryCheck.riskSignals].slice(0, 4),
    recruiterMemory: memory.recruiterMemory,
    memoryUpdates: memory.memoryUpdates,
    memoryConfidence,
    resultSnapshot: {
      overall: score.overall,
      readiness: readinessFromScore(score.overall),
      recruiterTrust: clamp((score.confidence + score.relevance + score.structure + score.evidence) / 4 - contradictionDetails.length * 10),
      strongestSignal:
        score.evidence >= 75 ? "Used measurable evidence" : score.confidence >= 72 ? "Confident delivery" : "Stayed engaged",
      weakestSignal: hasContradiction ? "CV contradiction or unsupported claim" : score.evidence < 60 ? "Missing measurable proof" : profile.redFlags[0] || "Needs deeper role relevance",
      nextAction: hasContradiction
        ? "Clarify the CV mismatch and retry the answer truthfully."
        : score.overall >= 75
          ? `Continue with ${profile.followUpStyle}.`
          : `Retry this answer using ${profile.preferredAnswerStyle}.`,
    },
  };
}

function compactOpenAIPrompt(body: InterviewRequestBody, local: InterviewApiResponse) {
  const setup = getSetup(body);
  const profile = getBehaviorProfile(setup.country, setup.companyStyle, setup.recruiterPersonality);
  const answer = cleanText(body.answer);
  const currentQuestion = cleanText(body.currentQuestion ?? body.question);
  const transcript = normalizeTranscript(body.transcript);
  const facts = extractCandidateFacts(setup.cvText);

  return `
You are WorkZo AI's Real Interview engine.

Return ONLY JSON. Keep recruiterReply short: max 35 words.

CRITICAL:
If local contradictions exist, you MUST stop and clarify. Do not continue normally.

Behavior:
${behaviorSummary(profile)}

Candidate facts:
${factsToPrompt(facts)}

Question:
${currentQuestion || "No active question."}

Latest answer:
${answer}

Recent transcript:
${transcript.map((item) => `${item.speaker}: ${item.text}`).join("\n") || "none"}

Local result to preserve:
${JSON.stringify({
  recruiterReply: local.recruiterReply,
  nextQuestion: local.nextQuestion,
  contradictions: local.contradictions,
  contradictionDetails: local.contradictionDetails,
  pressureLevel: local.pressureLevel,
  liveScore: local.liveScore,
  memoryConfidence: local.memoryConfidence,
}, null, 2)}

JSON shape:
{
  "recruiterReply": "short recruiter response",
  "recruiterReaction": "short recruiter response",
  "question": "next question",
  "nextQuestion": "next question",
  "strengths": ["max 3"],
  "weaknesses": ["max 3"],
  "improvements": ["max 3"]
}
`;
}

function parseJsonObject(text: string) {
  const cleaned = text.trim().replace(/^```json/i, "").replace(/^```/i, "").replace(/```$/i, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }

    throw new Error("OpenAI did not return valid JSON.");
  }
}

function mergeAiResponse(local: InterviewApiResponse, ai: Partial<InterviewApiResponse>): InterviewApiResponse {
  const hasContradiction = local.contradictionDetails.length > 0;
  const top = hasContradiction ? strongestIssue(local.contradictionDetails) : null;

  return {
    ...local,
    recruiterReply: hasContradiction
      ? local.recruiterReply
      : cleanText(ai.recruiterReply ?? ai.recruiterReaction) || local.recruiterReply,
    recruiterReaction: hasContradiction
      ? local.recruiterReaction
      : cleanText(ai.recruiterReaction ?? ai.recruiterReply) || local.recruiterReaction,
    question: hasContradiction
      ? top?.clarificationQuestion || local.question
      : cleanText(ai.question ?? ai.nextQuestion) || local.question,
    nextQuestion: hasContradiction
      ? top?.clarificationQuestion || local.nextQuestion
      : cleanText(ai.nextQuestion ?? ai.question) || local.nextQuestion,
    strengths: Array.isArray(ai.strengths)
      ? ai.strengths.map(cleanText).filter(Boolean).slice(0, 3)
      : local.strengths,
    weaknesses: Array.isArray(ai.weaknesses)
      ? [...local.weaknesses, ...ai.weaknesses.map(cleanText).filter(Boolean)].slice(0, 4)
      : local.weaknesses,
    improvements: Array.isArray(ai.improvements)
      ? [...local.improvements, ...ai.improvements.map(cleanText).filter(Boolean)].slice(0, 4)
      : local.improvements,
  };
}

export async function POST(request: NextRequest) {
  let body: InterviewRequestBody;

  try {
    body = (await request.json()) as InterviewRequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const local = localEngine(body);

  if (local.contradictionDetails.length > 0) {
    return NextResponse.json(local);
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      ...local,
      recruiterMemory: [
        ...local.recruiterMemory,
        {
          label: "AI fallback mode",
          value: "OPENAI_API_KEY is missing. WorkZo used the fast local recruiter engine.",
          importance: "medium" as const,
        },
      ].slice(-18),
    });
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.18,
      max_tokens: 450,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a fast JSON-only recruiter engine. Keep answers short. Never ignore contradictions already found by local analysis.",
        },
        {
          role: "user",
          content: compactOpenAIPrompt(body, local),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    const ai = parseJsonObject(raw) as Partial<InterviewApiResponse>;
    return NextResponse.json(mergeAiResponse(local, ai));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown OpenAI error.";

    return NextResponse.json({
      ...local,
      recruiterMemory: [
        ...local.recruiterMemory,
        {
          label: "OpenAI fallback",
          value: `OpenAI call failed, so WorkZo used the fast local recruiter engine. ${message}`,
          importance: "medium" as const,
        },
      ].slice(-18),
    });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "WorkZo AI Interview API",
    status: "ready",
    intelligence: "fast-fact-extraction-contradiction-memory",
  });
}
