import { NextResponse } from "next/server";
import OpenAI from "openai";

import {
  buildRecruiterSystemPrompt,
  evaluateRecruiterPsychology,
  mergeMemory,
  type RecruiterMemory,
} from "@/lib/recruiterPsychologyEngine";
import {
  buildPostInterviewWowSummary,
  createWowMoment,
} from "@/lib/wowMomentEngine";
import {
  buildPostInterviewPsychologyReport,
  createLiveUiState,
  createTrustTimelineEvent,
  detectRealTimeSignals,
  getInterviewArc,
  type TrustTimelineEvent,
} from "@/lib/realtimeInterviewEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  answer?: string;
  partialAnswer?: string;
  elapsedSeconds?: number;
  mode?: "final" | "realtime" | "realtime-interview";
  currentQuestion?: string;
  transcript?: Array<{ role?: string; text?: string; time?: string }>;
  messages?: Array<{ role?: string; content?: string; text?: string }>;
  setup?: {
    cvText?: string;
    targetRole?: string;
    jobDescription?: string;
    targetMarket?: string;
    country?: string;
    companyStyle?: string;
    recruiterStyle?: string;
    recruiterPersonality?: string;
    language?: string;
  };
  cvText?: string;
  jobDescription?: string;
  targetRole?: string;
  targetMarket?: string;
  country?: string;
  companyStyle?: string;
  recruiterPersonality?: string;
  pressure?: number;
  trust?: number;
  recruiterTrust?: number;
  scores?: {
    confidence?: number;
    clarity?: number;
    relevance?: number;
    evidence?: number;
    structure?: number;
    overall?: number;
  };
  memory?: Partial<RecruiterMemory>;
  contradictions?: string[];
  trustTimeline?: TrustTimelineEvent[];
  productDirection?: string;
};

type ModelJsonResponse = {
  recruiterMessage?: string;
  followUpQuestion?: string;
  feedback?: string;
  question?: string;
  reply?: string;
  message?: string;
  content?: string;
};

function cleanJsonText(value: string) {
  return value
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();
}

function toTranscript(body: RequestBody) {
  if (Array.isArray(body.transcript) && body.transcript.length > 0) {
    return body.transcript;
  }

  if (Array.isArray(body.messages) && body.messages.length > 0) {
    return body.messages.map((item) => ({
      role:
        item.role === "recruiter"
          ? "assistant"
          : item.role === "candidate"
            ? "user"
            : item.role,
      text: item.text || item.content || "",
      time: "",
    }));
  }

  return [];
}

function safeNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function fallbackQuestion(
  psychology: ReturnType<typeof evaluateRecruiterPsychology>
) {
  if (psychology.contradictions.length) {
    return `Wait — I need to clarify this before we continue. ${psychology.contradictions[0]}`;
  }

  if (psychology.memory.missingMetrics.length) {
    return "Hmm… you mentioned improvement, but I still do not know how you measured it. What was the actual result or number?";
  }

  if (psychology.memory.vagueAnswers.length) {
    return "Okay, but your ownership is still unclear. What exactly did YOU do, not the team?";
  }

  if (psychology.score.structure < 40) {
    return "Let me stop you there. Give me the same answer again, but start with the result first and then one example.";
  }

  if (psychology.score.relevance < 40) {
    return "I understand the example, but I need you to connect it to this role. Why would that experience matter for this position?";
  }

  return "Interesting. Now give me one specific example where your action created a measurable result.";
}

function parseModelResponse(
  raw: string,
  psychology: ReturnType<typeof evaluateRecruiterPsychology>
) {
  try {
    const parsed = JSON.parse(cleanJsonText(raw)) as ModelJsonResponse;

    return {
      recruiterMessage:
        parsed.recruiterMessage ||
        parsed.reply ||
        parsed.message ||
        psychology.recruiterReaction,
      followUpQuestion:
        parsed.followUpQuestion ||
        parsed.question ||
        parsed.content ||
        fallbackQuestion(psychology),
      feedback: parsed.feedback || psychology.psychologicalInsight,
    };
  } catch {
    return {
      recruiterMessage: psychology.recruiterReaction,
      followUpQuestion: raw?.trim() || fallbackQuestion(psychology),
      feedback: psychology.psychologicalInsight,
    };
  }
}

function buildWowAwarePrompt(
  psychologyInput: Parameters<typeof buildRecruiterSystemPrompt>[0],
  psychology: ReturnType<typeof evaluateRecruiterPsychology>,
  wowMoment: ReturnType<typeof createWowMoment>,
  arc: ReturnType<typeof getInterviewArc>
) {
  const basePrompt = buildRecruiterSystemPrompt(psychologyInput, psychology);

  return `
${basePrompt}

INTERVIEW ARC:
- Current phase: ${arc.phase}
- Phase instruction: ${arc.instruction}

WOW MOMENT REQUIREMENT:
The product must make the candidate feel: "This AI actually understood me."

Current wow moment:
- Triggered: ${wowMoment.shouldTrigger ? "yes" : "no"}
- Type: ${wowMoment.type}
- Emotional tag: ${wowMoment.emotionalTag}
- Recruiter line: ${wowMoment.line || "None"}

If wow moment is triggered:
1. Use the recruiter line naturally.
2. Do not soften it too much.
3. Then ask exactly one focused follow-up question.
4. Make the candidate feel the recruiter remembered or understood something specific.

If trust dropped:
- Be direct and explain what is missing.

If trust recovered:
- Acknowledge that this answer was stronger than the earlier answer.

If repeated weakness exists:
- Call it out naturally.

Return JSON only:
{
  "recruiterMessage": "short realistic recruiter reaction",
  "followUpQuestion": "exactly one focused follow-up question",
  "feedback": "one sentence explaining what changed in recruiter perception"
}
`.trim();
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as RequestBody;
    const setup = body.setup || {};
    const transcript = toTranscript(body);

    const cvText = body.cvText || setup.cvText || "";
    const jobDescription = body.jobDescription || setup.jobDescription || "";
    const targetRole = body.targetRole || setup.targetRole || "General Role";
    const targetMarket =
      body.targetMarket ||
      body.country ||
      setup.targetMarket ||
      setup.country ||
      "Global";
    const companyStyle =
      body.companyStyle ||
      setup.companyStyle ||
      setup.recruiterStyle ||
      "Realistic";
    const recruiterPersonality =
      body.recruiterPersonality ||
      setup.recruiterPersonality ||
      "analytical_hiring_manager";

    const previousTrust = safeNumber(
      body.recruiterTrust ?? body.trust,
      58
    );

    const previousMemory = mergeMemory({
      ...body.memory,
      contradictions: [
        ...(body.memory?.contradictions || []),
        ...(body.contradictions || []),
      ],
    });

    if (body.mode === "realtime") {
      const realtimeSignals = detectRealTimeSignals({
        partialAnswer: body.partialAnswer || "",
        elapsedSeconds: safeNumber(body.elapsedSeconds, 0),
        memory: previousMemory,
        score: {
          confidence: safeNumber(body.scores?.confidence, 0),
          clarity: safeNumber(body.scores?.clarity, 0),
          relevance: safeNumber(body.scores?.relevance, 0),
          evidence: safeNumber(body.scores?.evidence, 0),
          structure: safeNumber(body.scores?.structure, 0),
        },
        mood: previousMemory.recruiterMoodHistory.at(-1) || "neutral",
        pressure: safeNumber(body.pressure, 35),
      });

      return NextResponse.json({
        mode: "realtime",
        realtimeSignals,
        primarySignal: realtimeSignals[0] || null,
      });
    }

    const answer = body.answer?.trim();

    if (!answer) {
      return NextResponse.json(
        { error: "Answer is required." },
        { status: 400 }
      );
    }

    const psychologyInput = {
      answer,
      currentQuestion: body.currentQuestion,
      cvText,
      jobDescription,
      targetRole,
      targetMarket,
      companyStyle,
      recruiterPersonality,
      previousMemory,
      previousTrust,
      previousPressure: body.pressure,
      previousScores: body.scores,
      transcript,
    };

    const psychology = evaluateRecruiterPsychology(psychologyInput);

    const answerCount =
      transcript.filter(
        (item) => item.role === "candidate" || item.role === "user"
      ).length + 1;

    const arc = getInterviewArc(
      answerCount,
      psychology.recruiterTrust,
      psychology.pressure
    );

    const wowMoment = createWowMoment({
      answer,
      currentQuestion: body.currentQuestion,
      cvText,
      jobDescription,
      targetRole,
      targetMarket,
      recruiterName: psychology.recruiterProfile.name,
      recruiterRole: psychology.recruiterProfile.role,
      mood: psychology.mood,
      score: psychology.score,
      recruiterTrust: psychology.recruiterTrust,
      previousTrust,
      pressure: psychology.pressure,
      memory: psychology.memory,
      transcript,
      contradictions: psychology.contradictions,
    });

    const trustEvent = createTrustTimelineEvent({
      previousTrust,
      currentTrust: psychology.recruiterTrust,
      reason: wowMoment.shouldTrigger
        ? wowMoment.emotionalTag
        : psychology.psychologicalInsight,
    });

    const trustTimeline = [...(body.trustTimeline || []), trustEvent].slice(-12);

    const liveUiState = createLiveUiState({
      mood: psychology.mood,
      pressure: psychology.pressure,
      trust: psychology.recruiterTrust,
    });

    let recruiterMessage = wowMoment.shouldTrigger
      ? wowMoment.line
      : psychology.recruiterReaction;

    let followUpQuestion = fallbackQuestion(psychology);

    let feedback = wowMoment.shouldTrigger
      ? wowMoment.emotionalTag
      : psychology.psychologicalInsight;

    if (process.env.OPENAI_API_KEY) {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_INTERVIEW_MODEL || "gpt-4o-mini",
        temperature: 0.55,
        max_tokens: 520,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: buildWowAwarePrompt(
              psychologyInput,
              psychology,
              wowMoment,
              arc
            ),
          },
          {
            role: "user",
            content: JSON.stringify({
              currentQuestion: body.currentQuestion,
              candidateAnswer: answer,
              cvExcerpt: cvText.slice(0, 3200),
              jobDescriptionExcerpt: jobDescription.slice(0, 2200),
              recentTranscript: transcript.slice(-8),
              memory: psychology.memory,
              trust: psychology.recruiterTrust,
              pressure: psychology.pressure,
              arc,
              wowMoment,
            }),
          },
        ],
      });

      const raw = completion.choices[0]?.message?.content || "";
      const parsed = parseModelResponse(raw, psychology);

      recruiterMessage = wowMoment.shouldTrigger
        ? wowMoment.line
        : parsed.recruiterMessage;

      followUpQuestion = parsed.followUpQuestion;

      feedback = wowMoment.shouldTrigger
        ? `${wowMoment.emotionalTag}. ${parsed.feedback}`
        : parsed.feedback;
    }

    const finalQuestion = psychology.interruption.shouldInterrupt
      ? psychology.interruption.interruptionMessage
      : `${recruiterMessage} ${followUpQuestion}`.trim();

    const postInterviewWowSummary = buildPostInterviewWowSummary(
      psychology.memory,
      psychology.memory.trustHistory
    );

    const postInterviewPsychologyReport = buildPostInterviewPsychologyReport({
      memory: psychology.memory,
      trustTimeline,
      finalTrust: psychology.recruiterTrust,
      score: psychology.score,
    });

    const realtimeSignals = detectRealTimeSignals({
      partialAnswer: answer,
      elapsedSeconds: 60,
      memory: psychology.memory,
      score: psychology.score,
      mood: psychology.mood,
      pressure: psychology.pressure,
    });

    return NextResponse.json({
      recruiterName: psychology.recruiterProfile.name,
      recruiterRole: psychology.recruiterProfile.role,
      recruiterPersonality: psychology.recruiterProfile.key,

      recruiterMessage,
      question: finalQuestion,
      reply: finalQuestion,
      message: finalQuestion,
      content: finalQuestion,
      followUpQuestion: finalQuestion,
      feedback,

      mood: psychology.mood,
      emotion: psychology.mood,
      pressure: psychology.pressure,
      recruiterTrust: psychology.recruiterTrust,
      trust: psychology.recruiterTrust,
      score: psychology.score,
      scores: psychology.score,

      memory: psychology.memory,
      contradictions: psychology.memory.contradictions,
      contradiction: psychology.contradictions[0] || "",
      interruption: psychology.interruption,
      psychologicalInsight: psychology.psychologicalInsight,

      wowMoment,
      arc,
      trustTimeline,
      liveUiState,
      realtimeSignals,
      postInterviewWowSummary,
      postInterviewPsychologyReport,

      recruiterMemory: [
        {
          label: "Wow moment",
          value: wowMoment.shouldTrigger
            ? wowMoment.line
            : "No major wow moment needed yet.",
          importance: wowMoment.shouldTrigger ? "high" : "medium",
        },
        {
          label: "Interview arc",
          value: `${arc.phase}: ${arc.instruction}`,
          importance: "high",
        },
        {
          label: "Current recruiter impression",
          value: psychology.psychologicalInsight,
          importance: "high",
        },
        {
          label: "Trust",
          value: `${psychology.recruiterTrust}/100`,
          importance: "medium",
        },
        {
          label: "Pressure",
          value: `${psychology.pressure}/100`,
          importance: "medium",
        },
      ],
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Interview engine failed.";

    return NextResponse.json(
      {
        error: message,
        recruiterMessage: "Hmm... something went wrong on my side.",
        question:
          "Let us continue simply. Give me one specific example with your action and measurable result.",
        reply:
          "Let us continue simply. Give me one specific example with your action and measurable result.",
      },
      { status: 500 }
    );
  }
}
