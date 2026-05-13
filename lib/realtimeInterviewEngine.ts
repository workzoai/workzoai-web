import type {
  RecruiterMemory,
  RecruiterMood,
  RecruiterScore,
} from "@/lib/recruiterPsychologyEngine";

export type RealTimeSignal = {
  type:
    | "listening"
    | "thinking"
    | "interrupt"
    | "pressure"
    | "skeptical"
    | "impressed"
    | "recovery"
    | "clarify"
    | "calm";
  label: string;
  message: string;
  intensity: "low" | "medium" | "high";
  delayMs: number;
};

export type TrustTimelineEvent = {
  time: string;
  direction: "up" | "down" | "stable";
  value: number;
  reason: string;
};

export type InterviewArc = {
  phase: "opening" | "probing" | "pressure" | "recovery" | "closing";
  instruction: string;
};

export type PostInterviewPsychologyReport = {
  finalDecision: "continue" | "borderline" | "reject";
  finalPerception: string;
  trustTimeline: TrustTimelineEvent[];
  strongestSignal: string;
  weakestPattern: string;
  recoveryMoment: string;
  biggestTrustDrop: string;
  nextPracticeAction: string;
};

function nowLabel() {
  return new Date().toISOString();
}

export function detectRealTimeSignals({
  partialAnswer,
  elapsedSeconds,
  memory,
  score,
  mood,
  pressure,
}: {
  partialAnswer: string;
  elapsedSeconds: number;
  memory: RecruiterMemory;
  score: RecruiterScore;
  mood: RecruiterMood;
  pressure: number;
}): RealTimeSignal[] {
  const text = partialAnswer.toLowerCase();
  const signals: RealTimeSignal[] = [];

  if (elapsedSeconds > 55 && !/\d|%|result|impact|outcome/.test(text)) {
    signals.push({
      type: "interrupt",
      label: "Interruption likely",
      message: "Pause there. Start with the result first.",
      intensity: "high",
      delayMs: 250,
    });
  }

  if (/\b(we|our team|helped|supported|involved)\b/i.test(partialAnswer) && !/\b(i led|i owned|i built|i implemented|i handled|i drove)\b/i.test(partialAnswer)) {
    signals.push({
      type: "clarify",
      label: "Ownership unclear",
      message: "Recruiter will ask what you personally did.",
      intensity: "medium",
      delayMs: 450,
    });
  }

  if (/\b(improved|increased|reduced|optimized|saved|delivered)\b/i.test(partialAnswer) && !/(\d+%|\d+\s?(days|hours|users|tickets|customers|€|\$)|kpi|sla|nps|csat)/i.test(partialAnswer)) {
    signals.push({
      type: "pressure",
      label: "Metric missing",
      message: "Recruiter will ask how you measured it.",
      intensity: "medium",
      delayMs: 550,
    });
  }

  if (pressure >= 70 || mood === "skeptical" || mood === "impatient") {
    signals.push({
      type: "skeptical",
      label: "Recruiter skeptical",
      message: "Answer needs stronger proof.",
      intensity: "high",
      delayMs: 650,
    });
  }

  if (score.evidence >= 70 && score.confidence >= 65) {
    signals.push({
      type: "impressed",
      label: "Strong signal",
      message: "Recruiter trust is improving.",
      intensity: "medium",
      delayMs: 350,
    });
  }

  if (memory.repeatedPatterns.length) {
    signals.push({
      type: "pressure",
      label: "Pattern remembered",
      message: `Recruiter remembers: ${memory.repeatedPatterns.at(-1)}`,
      intensity: "high",
      delayMs: 500,
    });
  }

  if (!signals.length) {
    signals.push({
      type: "listening",
      label: "Listening",
      message: "Recruiter is evaluating clarity, proof, and ownership.",
      intensity: "low",
      delayMs: 300,
    });
  }

  return signals.slice(0, 3);
}

export function getInterviewArc(answerCount: number, trust: number, pressure: number): InterviewArc {
  if (answerCount <= 1) {
    return {
      phase: "opening",
      instruction:
        "Start professional and realistic. Ask for relevant background and establish baseline confidence.",
    };
  }

  if (answerCount <= 3 && pressure < 60) {
    return {
      phase: "probing",
      instruction:
        "Probe for proof, ownership, measurable impact, role relevance, and consistency with the CV.",
    };
  }

  if (pressure >= 60 || trust < 42) {
    return {
      phase: "pressure",
      instruction:
        "Increase pressure. Ask shorter, sharper follow-ups. Challenge vague claims and contradictions.",
    };
  }

  if (trust >= 65 && answerCount >= 3) {
    return {
      phase: "recovery",
      instruction:
        "Acknowledge stronger answers and test whether the candidate can maintain clarity under deeper follow-up.",
    };
  }

  return {
    phase: "probing",
    instruction:
      "Continue with focused follow-ups based on memory and recruiter expectations.",
  };
}

export function createTrustTimelineEvent({
  previousTrust,
  currentTrust,
  reason,
}: {
  previousTrust?: number;
  currentTrust: number;
  reason: string;
}): TrustTimelineEvent {
  const previous = typeof previousTrust === "number" ? previousTrust : currentTrust;
  const delta = currentTrust - previous;

  return {
    time: nowLabel(),
    direction: delta > 4 ? "up" : delta < -4 ? "down" : "stable",
    value: currentTrust,
    reason,
  };
}

export function buildPostInterviewPsychologyReport({
  memory,
  trustTimeline,
  finalTrust,
  score,
}: {
  memory: RecruiterMemory;
  trustTimeline: TrustTimelineEvent[];
  finalTrust: number;
  score: RecruiterScore;
}): PostInterviewPsychologyReport {
  const biggestDrop = [...trustTimeline]
    .reverse()
    .find((event) => event.direction === "down");

  const recovery = [...trustTimeline]
    .reverse()
    .find((event) => event.direction === "up");

  const weakestPattern =
    memory.repeatedPatterns.at(-1) ||
    memory.weaknesses.at(-1) ||
    memory.missingMetrics.at(-1) ||
    "No repeated weakness captured yet.";

  const strongestSignal =
    memory.strengths.at(-1) ||
    (score.evidence >= 70 ? "Candidate provided measurable evidence." : "") ||
    (score.confidence >= 70 ? "Candidate showed clear ownership." : "") ||
    "No strong signal captured yet.";

  const finalDecision =
    finalTrust >= 70 && score.evidence >= 55
      ? "continue"
      : finalTrust >= 45
        ? "borderline"
        : "reject";

  const finalPerception =
    finalDecision === "continue"
      ? "Strong candidate signal. Recruiter would likely continue the process."
      : finalDecision === "borderline"
        ? "Mixed candidate signal. Recruiter needs stronger proof, ownership, and role relevance."
        : "Weak candidate signal. Recruiter confidence dropped due to unclear proof, ownership, or consistency.";

  return {
    finalDecision,
    finalPerception,
    trustTimeline,
    strongestSignal,
    weakestPattern,
    recoveryMoment: recovery?.reason || "No clear recovery moment yet.",
    biggestTrustDrop: biggestDrop?.reason || "No major trust drop yet.",
    nextPracticeAction:
      weakestPattern !== "No repeated weakness captured yet."
        ? `Retry the weakest pattern now: ${weakestPattern}`
        : "Practice one answer with result first, clear ownership, and measurable impact.",
  };
}

export function createLiveUiState({
  mood,
  pressure,
  trust,
}: {
  mood: RecruiterMood;
  pressure: number;
  trust: number;
}) {
  if (mood === "interrupting" || pressure >= 75) {
    return {
      theme: "pressure",
      glow: "rose",
      recruiterExpression: "challenging",
      motion: "sharp",
      label: "Recruiter is pressing harder",
    };
  }

  if (mood === "skeptical" || trust < 42) {
    return {
      theme: "skeptical",
      glow: "amber",
      recruiterExpression: "skeptical",
      motion: "tense",
      label: "Recruiter is not convinced yet",
    };
  }

  if (mood === "impressed" || trust >= 70) {
    return {
      theme: "impressed",
      glow: "emerald",
      recruiterExpression: "positive",
      motion: "calm",
      label: "Recruiter confidence is improving",
    };
  }

  if (mood === "clarifying") {
    return {
      theme: "clarifying",
      glow: "cyan",
      recruiterExpression: "focused",
      motion: "focused",
      label: "Recruiter is checking consistency",
    };
  }

  return {
    theme: "neutral",
    glow: "blue",
    recruiterExpression: "listening",
    motion: "calm",
    label: "Recruiter is listening closely",
  };
}
