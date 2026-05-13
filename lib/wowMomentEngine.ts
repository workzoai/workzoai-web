import type {
  RecruiterMemory,
  RecruiterMood,
  RecruiterScore,
} from "@/lib/recruiterPsychologyEngine";

export type WowMomentInput = {
  answer: string;
  currentQuestion?: string;
  cvText?: string;
  jobDescription?: string;
  targetRole?: string;
  targetMarket?: string;
  recruiterName?: string;
  recruiterRole?: string;
  mood: RecruiterMood;
  score: RecruiterScore;
  recruiterTrust: number;
  previousTrust?: number;
  pressure: number;
  memory: RecruiterMemory;
  transcript?: Array<{ role?: string; text?: string; time?: string }>;
  contradictions?: string[];
};

export type WowMomentResult = {
  shouldTrigger: boolean;
  type:
    | "cv_mismatch"
    | "missing_metric"
    | "ownership_gap"
    | "memory_callback"
    | "trust_recovery"
    | "trust_drop"
    | "pressure_escalation"
    | "final_pattern"
    | "none";
  line: string;
  emotionalTag: string;
  intensity: "low" | "medium" | "high";
};

function hasMetric(text: string) {
  return /(\d+%|\d+\s?(x|times|days|hours|hrs|minutes|min|weeks|months|years|users|customers|tickets|cases|projects|€|\$|kpi|sla|nps|csat|revenue|cost|time))/i.test(text);
}

function claimsImprovement(text: string) {
  return /\b(improved|increased|reduced|optimized|decreased|saved|grew|boosted|accelerated|resolved|delivered|achieved|raised|lowered)\b/i.test(text);
}

function hasOwnership(text: string) {
  return /\b(i led|i owned|i built|i created|i designed|i implemented|i analyzed|i resolved|i improved|my role was|i was responsible|i handled|i drove)\b/i.test(text);
}

function vagueOwnership(text: string) {
  return /\b(we|our team|team worked|supported|helped|involved|participated|contributed)\b/i.test(text) && !hasOwnership(text);
}

function latestCandidateAnswers(transcript?: Array<{ role?: string; text?: string }>) {
  return (transcript || [])
    .filter((item) => item.role === "candidate" || item.role === "user")
    .map((item) => item.text || "")
    .filter(Boolean)
    .slice(-4);
}

function findEarlierWeakPattern(input: WowMomentInput) {
  const answers = latestCandidateAnswers(input.transcript);
  const earlier = answers.slice(0, -1).join(" ");

  if (!earlier) return "";

  if (claimsImprovement(earlier) && !hasMetric(earlier)) {
    return "Earlier, you also mentioned improvement without giving a measurable result.";
  }

  if (vagueOwnership(earlier)) {
    return "Earlier, your ownership was also unclear.";
  }

  if (input.memory.repeatedPatterns.length) {
    return `I am noticing a repeated pattern: ${input.memory.repeatedPatterns[input.memory.repeatedPatterns.length - 1]}.`;
  }

  return "";
}

function trustDelta(input: WowMomentInput) {
  if (typeof input.previousTrust !== "number") return 0;
  return input.recruiterTrust - input.previousTrust;
}

export function createWowMoment(input: WowMomentInput): WowMomentResult {
  const answer = input.answer;
  const delta = trustDelta(input);
  const latestContradiction = input.contradictions?.[0] || input.memory.contradictions.at(-1);

  if (latestContradiction) {
    return {
      shouldTrigger: true,
      type: "cv_mismatch",
      line: `Wait — I need to stop here because this does not fully match what I have from your CV or earlier answer. ${latestContradiction}`,
      emotionalTag: "Recruiter detected a mismatch",
      intensity: "high",
    };
  }

  const earlierWeakPattern = findEarlierWeakPattern(input);
  if (earlierWeakPattern && (claimsImprovement(answer) && !hasMetric(answer))) {
    return {
      shouldTrigger: true,
      type: "memory_callback",
      line: `${earlierWeakPattern} You are doing it again here. What exact number, result, or before-and-after change proves this impact?`,
      emotionalTag: "Recruiter remembered a repeated weakness",
      intensity: "high",
    };
  }

  if (earlierWeakPattern && vagueOwnership(answer)) {
    return {
      shouldTrigger: true,
      type: "memory_callback",
      line: `${earlierWeakPattern} This answer still sounds team-owned. What did you personally own from start to finish?`,
      emotionalTag: "Recruiter remembered ownership weakness",
      intensity: "high",
    };
  }

  if (delta >= 12 && input.previousTrust && input.previousTrust < 55) {
    return {
      shouldTrigger: true,
      type: "trust_recovery",
      line: "That answer is stronger than your earlier one. You gave me clearer ownership and I can see the impact more easily now.",
      emotionalTag: "Recruiter trust recovered",
      intensity: "medium",
    };
  }

  if (delta <= -14) {
    return {
      shouldTrigger: true,
      type: "trust_drop",
      line: "I am going to be direct: that answer lowered my confidence because I still do not see enough proof behind the claim.",
      emotionalTag: "Recruiter trust dropped",
      intensity: "high",
    };
  }

  if (claimsImprovement(answer) && !hasMetric(answer)) {
    return {
      shouldTrigger: true,
      type: "missing_metric",
      line: "This is the moment I need specifics. You said you improved something, but I still do not know by how much or how you measured it.",
      emotionalTag: "Missing measurable impact",
      intensity: "medium",
    };
  }

  if (vagueOwnership(answer)) {
    return {
      shouldTrigger: true,
      type: "ownership_gap",
      line: "I hear what the team did, but I am interviewing you. What was your personal contribution?",
      emotionalTag: "Ownership unclear",
      intensity: "medium",
    };
  }

  if (input.pressure >= 70 && input.score.evidence < 45) {
    return {
      shouldTrigger: true,
      type: "pressure_escalation",
      line: "I am going to push harder here because the answer still sounds general. Give me one concrete incident, one action you took, and one result.",
      emotionalTag: "Pressure increased",
      intensity: "high",
    };
  }

  if (input.memory.repeatedPatterns.length >= 2) {
    return {
      shouldTrigger: true,
      type: "final_pattern",
      line: `I am seeing a pattern now: ${input.memory.repeatedPatterns.at(-1)}. Fix that in the next answer.`,
      emotionalTag: "Repeated pattern detected",
      intensity: "medium",
    };
  }

  return {
    shouldTrigger: false,
    type: "none",
    line: "",
    emotionalTag: "No wow moment needed",
    intensity: "low",
  };
}

export function buildPostInterviewWowSummary(memory: RecruiterMemory, trustHistory: number[]) {
  const startTrust = trustHistory[0] ?? 46;
  const endTrust = trustHistory.at(-1) ?? startTrust;
  const trustDirection =
    endTrust > startTrust + 10
      ? "Recruiter trust improved during the interview."
      : endTrust < startTrust - 10
        ? "Recruiter trust dropped during the interview."
        : "Recruiter trust stayed mostly stable.";

  return {
    trustDirection,
    strongestSignal: memory.strengths.at(-1) || "No strong signal captured yet.",
    weakestPattern:
      memory.repeatedPatterns.at(-1) ||
      memory.weaknesses.at(-1) ||
      "No repeated weak pattern captured yet.",
    finalPerception:
      endTrust >= 70
        ? "Strong candidate signal. Recruiter would likely continue."
        : endTrust >= 45
          ? "Mixed candidate signal. Recruiter may continue if the next answers improve."
          : "Weak candidate signal. Recruiter needs clearer proof, ownership, and relevance.",
  };
}
