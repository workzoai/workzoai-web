import type { LiveAnswerAnalysis } from "@/lib/liveAnswerAnalyzer";
import {
  moodInstruction,
  type RecruiterPersonalityConfig,
  type RecruiterState,
} from "@/lib/recruiterStateEngine";

export type RecruiterEmotionState =
  | "neutral"
  | "engaged"
  | "skeptical"
  | "impatient"
  | "impressed"
  | "confused"
  | "cold";

export type PressureAnalysis = {
  emotion: RecruiterEmotionState;
  recruiterLine?: string;
  pressureDelta: number;
  trustDelta: number;
  shouldInterrupt?: boolean;
  issues: string[];
  strengths: string[];
  confidenceScore: number;
};

export type RecruiterBehaviorDecision = {
  shouldInterrupt: boolean;
  interruptionMessage: string;
  responseMode:
    | "continue"
    | "probe"
    | "challenge"
    | "interrupt"
    | "move_on"
    | "recover";
  pressureInstruction: string;
  followUpFocus: string;
  stateDelta: {
    trust: number;
    patience: number;
    skepticism: number;
    engagement: number;
    pressure: number;
    warmth: number;
    confidenceInCandidate: number;
    weakAnswer: boolean;
    strongAnswer: boolean;
  };
};

const interruptionPool = [
  "You still haven’t answered my question.",
  "That sounds prepared. Give me a real example.",
  "Be specific. What exactly did YOU do?",
  "You’re speaking too broadly.",
  "Give me numbers.",
  "I need one concrete metric.",
  "You’re avoiding the actual question.",
];

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function analyzeRecruiterPressure(answer: string): PressureAnalysis {
  const text = answer.trim();
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const fillerCount =
    lower.match(
      /\b(um|uh|like|basically|actually|you know|kind of|sort of|maybe|probably|i think|i guess)\b/g
    )?.length || 0;

  const hasMetric =
    /\d|%|percent|reduced|improved|saved|revenue|tickets|users|customers|cost|time|hours|days|weeks|months/i.test(
      text
    );

  const hasOwnership =
    /\b(i|my|me|i led|i built|i resolved|i created|i improved|i handled|i automated|i analyzed|my role|my contribution)\b/i.test(
      text
    );

  const hasOutcome =
    /\b(result|impact|outcome|therefore|so that|which helped|improved|reduced|increased|saved|boosted|cut)\b/i.test(
      text
    ) || hasMetric;

  const vagueWords =
    /team player|hardworking|passionate|fast learner|good communication|worked on many things|helped with|responsible for/i.test(
      text
    );

  const issues: string[] = [];
  const strengths: string[] = [];

  if (!hasMetric) issues.push("missing measurable impact");
  if (!hasOwnership) issues.push("unclear ownership");
  if (!hasOutcome) issues.push("unclear outcome");
  if (wordCount > 140) issues.push("rambling");
  if (wordCount < 25) issues.push("too brief");
  if (fillerCount >= 3) issues.push("hesitation/filler words");
  if (vagueWords) issues.push("generic wording");

  if (hasMetric) strengths.push("measurable proof");
  if (hasOwnership) strengths.push("clear ownership");
  if (hasOutcome) strengths.push("outcome-focused");
  if (wordCount >= 40 && wordCount <= 120) strengths.push("good answer length");

  const confidenceScore = clamp(
    72 -
      fillerCount * 9 -
      (wordCount < 25 ? 16 : 0) -
      (wordCount > 140 ? 12 : 0) +
      (hasMetric ? 8 : 0) +
      (hasOwnership ? 8 : 0)
  );

  if (wordCount > 140) {
    return {
      emotion: "impatient",
      recruiterLine: "You’re rambling. Give me the result first.",
      pressureDelta: 18,
      trustDelta: -10,
      shouldInterrupt: true,
      issues,
      strengths,
      confidenceScore,
    };
  }

  if (!hasMetric && wordCount > 70) {
    return {
      emotion: "skeptical",
      recruiterLine: "I still don’t hear measurable impact.",
      pressureDelta: 14,
      trustDelta: -8,
      shouldInterrupt: true,
      issues,
      strengths,
      confidenceScore,
    };
  }

  if (!hasOwnership && wordCount > 45) {
    return {
      emotion: "skeptical",
      recruiterLine: "I still don’t know what YOU specifically did.",
      pressureDelta: 12,
      trustDelta: -7,
      shouldInterrupt: true,
      issues,
      strengths,
      confidenceScore,
    };
  }

  if (fillerCount >= 4) {
    return {
      emotion: "cold",
      recruiterLine: "You sound uncertain. Give me one confident example.",
      pressureDelta: 12,
      trustDelta: -7,
      shouldInterrupt: true,
      issues,
      strengths,
      confidenceScore,
    };
  }

  if (vagueWords) {
    return {
      emotion: "skeptical",
      recruiterLine: "That sounds generic. What exactly did YOU do?",
      pressureDelta: 10,
      trustDelta: -6,
      shouldInterrupt: true,
      issues,
      strengths,
      confidenceScore,
    };
  }

  if (hasMetric && hasOwnership && hasOutcome && wordCount >= 40 && wordCount <= 120) {
    return {
      emotion: "impressed",
      recruiterLine: "That’s much clearer. Continue.",
      pressureDelta: -10,
      trustDelta: 12,
      issues,
      strengths,
      confidenceScore,
    };
  }

  return {
    emotion: issues.length ? "skeptical" : "engaged",
    recruiterLine: issues.length ? interruptionPool[issues.length % interruptionPool.length] : "That is clearer.",
    pressureDelta: issues.length ? 4 : -2,
    trustDelta: strengths.length >= 2 ? 4 : issues.length ? -2 : 1,
    shouldInterrupt: issues.length >= 3,
    issues,
    strengths,
    confidenceScore,
  };
}

export function decideRecruiterBehavior(input: {
  analysis: LiveAnswerAnalysis;
  recruiterState: RecruiterState;
  personality: RecruiterPersonalityConfig;
}) {
  const { analysis, recruiterState, personality } = input;

  const weak =
    analysis.overallQuality < 50 ||
    analysis.vagueScore >= 55 ||
    analysis.avoidanceScore >= 52 ||
    (!analysis.hasMetric && !analysis.hasExample && analysis.wordCount > 50);

  const strong =
    analysis.overallQuality >= 74 &&
    analysis.hasMetric &&
    analysis.hasOwnership &&
    analysis.hasOutcome;

  const repeatedWeak = recruiterState.weakAnswerStreak >= 1 && weak;

  const shouldInterrupt =
    analysis.ramblingScore >= 62 ||
    analysis.fillerCount >= 4 ||
    analysis.avoidanceScore >= 62 ||
    (analysis.vagueScore >= 62 &&
      recruiterState.patience < personality.interruptionTolerance + 15) ||
    repeatedWeak;

  const interruptionMessage = getInterruptionMessage(analysis, recruiterState);

  const responseMode: RecruiterBehaviorDecision["responseMode"] = shouldInterrupt
    ? "interrupt"
    : repeatedWeak
      ? "challenge"
      : weak
        ? "probe"
        : strong
          ? "recover"
          : "continue";

  const followUpFocus = getFollowUpFocus(analysis, responseMode);
  const pressureInstruction = buildPressureInstruction({
    analysis,
    recruiterState,
    responseMode,
  });

  const stateDelta = {
    trust: strong ? 10 : repeatedWeak ? -14 : weak ? -10 : 1,
    patience: strong ? 5 : repeatedWeak ? -16 : weak ? -12 : -2,
    skepticism: strong ? -8 : repeatedWeak ? 14 : weak ? 10 : 1,
    engagement: strong ? 8 : repeatedWeak ? -9 : weak ? -7 : 2,
    pressure: strong ? -5 : repeatedWeak ? 12 : weak ? 9 : 1,
    warmth: strong ? 3 : repeatedWeak ? -7 : weak ? -5 : 0,
    confidenceInCandidate: strong ? 11 : repeatedWeak ? -15 : weak ? -12 : 2,
    weakAnswer: weak,
    strongAnswer: strong,
  };

  return {
    shouldInterrupt,
    interruptionMessage,
    responseMode,
    pressureInstruction,
    followUpFocus,
    stateDelta,
  } satisfies RecruiterBehaviorDecision;
}

function getInterruptionMessage(
  analysis: LiveAnswerAnalysis,
  recruiterState: RecruiterState
) {
  if (analysis.ramblingScore >= 62) {
    return "You’re speaking too broadly. Give me the result first.";
  }

  if (analysis.fillerCount >= 4) {
    return "You sound uncertain. Give me one concrete example.";
  }

  if (analysis.avoidanceScore >= 62) {
    return "You’re avoiding the actual question. Answer it directly.";
  }

  if (!analysis.hasMetric && analysis.wordCount > 55) {
    return "Give me numbers. I need one concrete metric.";
  }

  if (!analysis.hasOwnership && analysis.wordCount > 40) {
    return "I still don’t know what YOU specifically did.";
  }

  if (analysis.vagueScore >= 62 || recruiterState.weakAnswerStreak >= 1) {
    return "That sounds generic. What exactly did YOU do?";
  }

  return "Let me stop you there. Make the answer more specific.";
}

function getFollowUpFocus(
  analysis: LiveAnswerAnalysis,
  mode: RecruiterBehaviorDecision["responseMode"]
) {
  if (mode === "interrupt") return "Interrupt and ask for a direct, specific answer.";
  if (!analysis.hasOwnership) return "Ask what the candidate personally owned or delivered.";
  if (!analysis.hasMetric) return "Ask for numbers, scale, impact, or measurable outcome.";
  if (!analysis.hasExample) return "Ask for one concrete example.";
  if (analysis.relevanceScore < 50) return "Redirect answer back to the role and job description.";
  if (analysis.fillerCount >= 3) return "Ask the candidate to slow down and answer with confidence.";
  if (mode === "challenge") return "Challenge the answer and ask for proof.";
  if (mode === "recover") return "Acknowledge the stronger answer briefly and ask a deeper follow-up.";
  return "Ask one focused follow-up.";
}

function buildPressureInstruction(input: {
  analysis: LiveAnswerAnalysis;
  recruiterState: RecruiterState;
  responseMode: RecruiterBehaviorDecision["responseMode"];
}) {
  const { analysis, recruiterState, responseMode } = input;

  const rules = [
    moodInstruction(recruiterState.mood),
    "You are a recruiter, not a coach.",
    "Ask only one question.",
    "Keep the response short: 1-3 sentences.",
    "Do not over-explain.",
    "Be realistic, skeptical, and harder to impress.",
  ];

  if (responseMode === "interrupt") {
    rules.push("Interrupt firmly but professionally. Make the candidate answer directly.");
  }

  if (responseMode === "challenge") {
    rules.push("Become more skeptical. Mention what is missing and ask for evidence.");
  }

  if (analysis.vagueScore >= 55) {
    rules.push("Say that the answer is still too broad or high-level.");
  }

  if (!analysis.hasMetric) {
    rules.push("Ask for measurable impact or scale.");
  }

  if (!analysis.hasOwnership) {
    rules.push("Ask what the candidate personally did, not what the team did.");
  }

  if (analysis.ramblingScore >= 60) {
    rules.push("Ask for a concise version in 45 seconds or less.");
  }

  return rules.join("\n");
}
