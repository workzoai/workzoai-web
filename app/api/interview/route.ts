import { NextResponse } from "next/server";
import {
  decideUnifiedRecruiterResponse,
  type TranscriptItem,
} from "@/lib/unifiedRecruiterIntelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InterviewRequest = {
  answer?: string;
  currentQuestion?: string;
  transcript?: TranscriptItem[];
  setup?: {
    cvText?: string;
    candidateProfileSummary?: string;
    jobDescription?: string;
    jobProfileSummary?: string;
    targetRole?: string;
    targetMarket?: string;
    companyStyle?: string;
    recruiterPersonality?: string;
    language?: string;
    recruiterMemoryProfile?: unknown;
    jobMemoryProfile?: unknown;
  };
  cvText?: string;
  jobDescription?: string;
  targetRole?: string;
  targetMarket?: string;
  companyStyle?: string;
  recruiterPersonality?: string;
  recruiterTrust?: number;
  recruiterState?: string | null;
  recruiterMemorySummary?: string;
};

function text(value: unknown, maxChars = 1800) {
  const clean = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return clean.slice(0, maxChars);
}

function compactTranscript(items: TranscriptItem[] | undefined) {
  return (items || [])
    .slice(-4)
    .map((item) => ({
      role: item.role,
      text: text(item.text, 420),
      time: item.time,
    }))
    .filter((item) => item.text);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as InterviewRequest;
    const setup = body.setup || {};
    const answer = text(body.answer);

    if (!answer) {
      return NextResponse.json(
        { error: "Candidate answer is required." },
        { status: 400 },
      );
    }

    const compactCv = text(
      setup.candidateProfileSummary || body.cvText || setup.cvText,
      1200,
    );
    const compactJob = text(
      setup.jobProfileSummary || body.jobDescription || setup.jobDescription,
      1200,
    );

    const decision = await decideUnifiedRecruiterResponse({
      answer,
      currentQuestion: text(body.currentQuestion, 500),
      transcript: compactTranscript(body.transcript),
      recruiterTrust: typeof body.recruiterTrust === "number" ? body.recruiterTrust : 58,
      recruiterState: body.recruiterState || null,
      setup: {
        cvText: compactCv,
        jobDescription: compactJob,
        targetRole: text(body.targetRole || setup.targetRole, 120),
        targetMarket: text(body.targetMarket || setup.targetMarket, 80),
        companyStyle: text(body.companyStyle || setup.companyStyle, 120),
        recruiterPersonality: text(body.recruiterPersonality || setup.recruiterPersonality, 80),
        language: text(setup.language, 40),
        recruiterMemoryProfile: body.recruiterMemorySummary
          ? { summary: text(body.recruiterMemorySummary, 700) }
          : undefined,
        jobMemoryProfile: undefined,
      },
    });

    return NextResponse.json({
      question: decision.spokenReply,
      displayQuestion: decision.displayQuestion,
      feedback: decision.feedback,
      intent: decision.intent,
      shouldAdvanceQuestion: decision.shouldAdvanceQuestion,
      shouldCountAsAnswer: decision.shouldCountAsAnswer,
      shouldStayOnCurrentQuestion: decision.shouldStayOnCurrentQuestion,
      trustDelta: decision.trustDelta,
      recruiterState: decision.recruiterState,
      correction: decision.correction || "",
      concern: decision.concern || "",
      psychology: decision.psychology,
      cvRead: decision.cvRead || null,
      recruiterMemory: decision.recruiterMemory || null,
      memoryEvents: decision.memoryEvents || [],
      pressure: decision.pressure || null,
      honestFeedback: decision.honestFeedback || null,
      recruiterMemoryInsight: decision.recruiterMemoryInsight || null,
      livePressureSimulation: decision.livePressureSimulation || null,
      marketExpectation: decision.marketExpectation || null,
      humanImperfection: decision.humanImperfection || null,
      socialSignals: decision.socialSignals || null,
      cinematicRealism: decision.cinematicRealism || null,
      conversationStage: decision.conversationStage || null,
      interruption: {
        shouldInterrupt:
          decision.intent === "nonsense" ||
          decision.intent === "possible_exaggeration" ||
          decision.intent === "contradiction",
        interruptionMessage: decision.concern || decision.correction || "",
        severity:
          decision.intent === "nonsense" || decision.intent === "contradiction"
            ? "medium"
            : "low",
      },
      scores: {
        relevance: decision.shouldCountAsAnswer ? Math.max(40, Math.min(92, decision.psychology.interest)) : 0,
        clarity: decision.intent === "interview_answer" ? Math.max(38, Math.min(90, decision.psychology.engagement)) : 0,
        structure: decision.intent === "interview_answer" ? Math.max(34, Math.min(88, decision.psychology.patience)) : 0,
        evidence:
          decision.intent === "possible_exaggeration" || decision.intent === "contradiction" || decision.intent === "nonsense"
            ? 22
            : decision.shouldCountAsAnswer
              ? Math.max(42, Math.min(90, decision.psychology.confidenceInCandidate))
              : 0,
        confidence: decision.psychology.confidenceInCandidate,
        pressure: decision.pressure?.level ?? 45,
        overall: decision.psychology.trust,
      },
      liveUiState: {
        label:
          decision.intent === "candidate_question"
            ? "Clarifying"
            : decision.intent === "possible_exaggeration" || decision.intent === "nonsense" || decision.intent === "contradiction"
              ? "Recruiter is checking consistency"
              : decision.pressure?.label === "intense" || decision.pressure?.label === "high"
                ? "Pressure increased"
                : decision.recruiterState === "skeptical"
                  ? "Skepticism rising"
                  : decision.shouldCountAsAnswer
                    ? "Answer accepted"
                    : "Staying on question",
        theme: decision.recruiterState,
        pressure: decision.pressure || null,
        honestFeedback: decision.honestFeedback || null,
        recruiterMemoryInsight: decision.recruiterMemoryInsight || null,
        livePressureSimulation: decision.livePressureSimulation || null,
        marketExpectation: decision.marketExpectation || null,
        humanImperfection: decision.humanImperfection || null,
        socialSignals: decision.socialSignals || null,
        cinematicRealism: decision.cinematicRealism || null,
      },
      trustTimeline: [
        {
          type: decision.trustDelta < 0 ? "drop" : decision.trustDelta > 0 ? "gain" : "steady",
          delta: decision.trustDelta,
          reason: decision.pressure?.reason || decision.feedback,
        },
      ],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Interview intelligence failed.",
      },
      { status: 500 },
    );
  }
}
