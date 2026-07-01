// lib/workzoHiringCommitteeEngine.ts
// Phase 3/4/5: hiring committee memo, shadow score, interpretation layer, targeted skill drills.

export type WorkZoPlanDecision =
  | "Strong Hire"
  | "Hire"
  | "Leaning Hire"
  | "Leaning No Hire"
  | "No Hire";

export type WorkZoAnswerEvidence = {
  id: string;
  question: string;
  answer: string;
  score: number;
  weakness: string;
  recruiterHeard: string;
  hasMetric?: boolean;
  hasOwnership?: boolean;
  redFlags?: string[];
};

export type WorkZoHiringCommitteeMemo = {
  decision: WorkZoPlanDecision;
  confidence: number;
  headline: string;
  recruiterSummary: string;
  hiringManagerConcern: string;
  evidenceForHire: string[];
  evidenceAgainstHire: string[];
  finalRecommendation: string;
  nextRoundFocus: string[];
};

export type WorkZoShadowScore = {
  label: string;
  score: number;
  internalMeaning: string;
  risk: "low" | "medium" | "high";
};

export type WorkZoWhatTheyHeard = {
  id: string;
  youSaid: string;
  theyHeard: string;
  risk: string;
  strongerSignal: string;
};

export type WorkZoSkillDrill = {
  id: string;
  title: string;
  duration: string;
  pressureLevel: "Low" | "Medium" | "High";
  weaknessTargeted: string;
  prompt: string;
  recruiterPushback: string;
  successCriteria: string[];
  href: string;
};

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function clean(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.replace(/\s+/g, " ").trim() || fallback;
}

// BUG FIX: a flat character-count slice (e.g. `.slice(0, 180)`) chops quoted
// candidate evidence mid-sentence, mid-word, or mid-thought — confirmed from
// a live report quoting "...to tell me the time where..." as the "strongest
// evidence" because the cut landed exactly at char 180. This truncates at
// the last full sentence (or clause, falling back to the last space) that
// fits within the limit, so quoted evidence always reads as a complete
// thought rather than a fragment.
function truncateAtSentence(text: string, maxLength: number): string {
  const cleaned = clean(text);
  if (cleaned.length <= maxLength) return cleaned;

  const slice = cleaned.slice(0, maxLength);
  // Prefer cutting at the last sentence-ending punctuation within the slice.
  const lastSentenceEnd = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? "),
  );
  if (lastSentenceEnd > maxLength * 0.4) {
    return `${slice.slice(0, lastSentenceEnd + 1).trim()}`;
  }
  // No good sentence break found: fall back to the last clause break (comma)
  // or, failing that, the last whole word — never cut mid-word.
  const lastComma = slice.lastIndexOf(", ");
  if (lastComma > maxLength * 0.5) {
    return `${slice.slice(0, lastComma).trim()}…`;
  }
  const lastSpace = slice.lastIndexOf(" ");
  return `${slice.slice(0, lastSpace > 0 ? lastSpace : maxLength).trim()}…`;
}

function decisionFromScore(score: number, redFlagCount = 0, contradictionCount = 0): WorkZoPlanDecision {
  const penalty = redFlagCount * 2 + contradictionCount * 5;
  const adjusted = clamp(score - penalty);
  if (adjusted >= 88) return "Strong Hire";
  if (adjusted >= 78) return "Hire";
  if (adjusted >= 68) return "Leaning Hire";
  if (adjusted >= 56) return "Leaning No Hire";
  return "No Hire";
}

export function buildHiringCommitteeMemo(input: {
  overallScore: number;
  trustScore: number;
  evidenceQuality: number;
  ownershipScore: number;
  structureScore: number;
  roleLabel: string;
  companyLabel: string;
  recruiterName: string;
  biggestBlocker: string;
  strengths: string[];
  improvements: string[];
  answerEvidence: WorkZoAnswerEvidence[];
  redFlags: string[];
  contradictions: Array<{ title?: string; detail?: string }>;
}): WorkZoHiringCommitteeMemo {
  const decision = decisionFromScore(input.overallScore, input.redFlags.length, input.contradictions.length);
  const confidence = clamp((input.trustScore * 0.42) + (input.evidenceQuality * 0.34) + (input.ownershipScore * 0.24));
  const best = [...input.answerEvidence].sort((a, b) => b.score - a.score)[0];
  const weakest = [...input.answerEvidence].sort((a, b) => a.score - b.score)[0];

  const evidenceForHire = [
    best?.answer ? `Strongest evidence: ${truncateAtSentence(best.answer, 260)}` : "Candidate gave some role-relevant background.",
    ...(input.strengths || []).slice(0, 3),
  ].filter(Boolean);

  const evidenceAgainstHire = [
    weakest?.weakness || input.biggestBlocker,
    ...input.redFlags.slice(0, 3),
    ...input.contradictions.slice(0, 2).map((item) => clean(item.detail || item.title, "Consistency concern detected.")),
  ].filter(Boolean);

  return {
    decision,
    confidence,
    headline: `${decision} for ${input.roleLabel}`,
    recruiterSummary: `${input.recruiterName} would likely see a candidate with useful potential for ${input.roleLabel}, but the hiring signal depends on whether the candidate can support claims with evidence, ownership, and concise structure.`,
    hiringManagerConcern: input.biggestBlocker || "The hiring manager may ask for stronger evidence before moving forward.",
    evidenceForHire: evidenceForHire.slice(0, 5),
    evidenceAgainstHire: evidenceAgainstHire.slice(0, 5),
    finalRecommendation: decision === "Strong Hire" || decision === "Hire"
      ? `Proceed, but validate ${input.biggestBlocker.toLowerCase()} in the next round.`
      : decision === "Leaning Hire"
        ? `Proceed only if the next round confirms measurable impact and role depth.`
        : `Do not rely on this interview yet. Run targeted drills first, then retry the simulation.`,
    nextRoundFocus: [
      "Ask for measurable impact and exact scope of ownership.",
      "Pressure-test the weakest story with two follow-up questions.",
      `Check alignment with ${input.companyLabel} expectations.`,
    ],
  };
}

export function buildShadowScores(input: {
  trustScore: number;
  evidenceQuality: number;
  ownershipScore: number;
  structureScore: number;
  communicationScore: number;
  contradictionCount: number;
}): WorkZoShadowScore[] {
  return [
    {
      label: "Trust Under Pressure",
      score: clamp(input.trustScore - input.contradictionCount * 8),
      internalMeaning: "Would the interviewer trust the answer after follow-up pressure?",
      risk: input.trustScore < 62 || input.contradictionCount > 0 ? "high" : input.trustScore < 76 ? "medium" : "low",
    },
    {
      label: "Proof Density",
      score: clamp(input.evidenceQuality),
      internalMeaning: "How much of the answer is supported by examples, metrics, and outcomes?",
      risk: input.evidenceQuality < 58 ? "high" : input.evidenceQuality < 75 ? "medium" : "low",
    },
    {
      label: "Ownership Signal",
      score: clamp(input.ownershipScore),
      internalMeaning: "Can the hiring panel tell what the candidate personally owned?",
      risk: input.ownershipScore < 58 ? "high" : input.ownershipScore < 75 ? "medium" : "low",
    },
    {
      label: "Executive Clarity",
      score: clamp((input.structureScore * 0.65) + (input.communicationScore * 0.35)),
      internalMeaning: "Would a senior interviewer understand the answer quickly?",
      risk: input.structureScore < 60 ? "high" : input.structureScore < 76 ? "medium" : "low",
    },
  ];
}

export function buildWhatTheyHeard(answerEvidence: WorkZoAnswerEvidence[]): WorkZoWhatTheyHeard[] {
  return answerEvidence.slice(0, 8).map((item, index) => {
    const answer = clean(item.answer, "Answer not captured.");
    const risk = !item.hasMetric
      ? "May sound like a claim without measurable proof."
      : !item.hasOwnership
        ? "May make the interviewer unsure what you personally did."
        : item.redFlags?.length
          ? item.redFlags[0]
          : "Generally credible, but can still be made sharper.";
    const strongerSignal = !item.hasMetric
      ? "Add one number: time saved, tickets handled, users supported, quality improved, or revenue/cost impact."
      : !item.hasOwnership
        ? "Start with your personal action: ‘I owned…’, ‘I led…’, or ‘I implemented…’."
        : "End with a one-line result and link it directly to the target role.";

    return {
      id: item.id || `heard-${index + 1}`,
      youSaid: truncateAtSentence(answer, 220),
      theyHeard: item.recruiterHeard || "The interviewer is forming a signal based on proof, ownership, and consistency.",
      risk,
      strongerSignal,
    };
  });
}

export function buildTargetedSkillDrills(input: {
  biggestBlocker: string;
  answerEvidence: WorkZoAnswerEvidence[];
  redFlags: string[];
  contradictions: Array<{ title?: string; detail?: string }>;
}): WorkZoSkillDrill[] {
  const missingMetrics = input.answerEvidence.filter((item) => !item.hasMetric).length;
  const missingOwnership = input.answerEvidence.filter((item) => !item.hasOwnership).length;
  const vague = input.answerEvidence.filter((item) => /short|vague|missing|unclear/i.test(item.weakness)).length;
  const drills: WorkZoSkillDrill[] = [];

  if (missingMetrics || /metric|measurable|evidence/i.test(input.biggestBlocker)) {
    drills.push({
      id: "metrics-pressure-drill",
      title: "Metrics Pressure Drill",
      duration: "2 min",
      pressureLevel: "High",
      weaknessTargeted: "Missing measurable impact",
      prompt: "Explain one project or achievement using one metric, one baseline, and one final outcome.",
      recruiterPushback: "Let’s pause there. What exactly changed, by how much, and how do you know your work caused it?",
      successCriteria: ["Includes baseline", "Includes measurable result", "Explains your direct contribution"],
      href: "/onboarding?drill=metrics-pressure-drill",
    });
  }

  if (missingOwnership || /ownership/i.test(input.biggestBlocker)) {
    drills.push({
      id: "ownership-clarity-drill",
      title: "Ownership Clarity Drill",
      duration: "3 min",
      pressureLevel: "Medium",
      weaknessTargeted: "Unclear personal contribution",
      prompt: "Retell your strongest team story, but every major action must clarify what you personally owned.",
      recruiterPushback: "I understand what the team did. What was specifically yours?",
      successCriteria: ["Uses ‘I’ for personal scope", "Separates team result from your contribution", "Names the decision you made"],
      href: "/onboarding?drill=ownership-clarity-drill",
    });
  }

  if (input.contradictions.length) {
    drills.push({
      id: "consistency-defense-drill",
      title: "Consistency Defense Drill",
      duration: "2 min",
      pressureLevel: "High",
      weaknessTargeted: "Contradiction handling",
      prompt: "Clarify two statements that may appear inconsistent and explain the context behind both.",
      recruiterPushback: "Earlier you framed this differently. Which version should I trust?",
      successCriteria: ["Acknowledges the difference", "Explains context", "Restores a clear timeline"],
      href: "/onboarding?drill=consistency-defense-drill",
    });
  }

  if (vague || input.redFlags.length) {
    drills.push({
      id: "pushback-resilience-drill",
      title: "Pushback Resilience Drill",
      duration: "4 min",
      pressureLevel: "High",
      weaknessTargeted: "Handling recruiter friction",
      prompt: "Answer a behavioral question while the interviewer challenges vague phrases and unsupported claims.",
      recruiterPushback: "That sounds polished, but not specific. Give me the concrete example.",
      successCriteria: ["Stays calm", "Answers the actual pushback", "Adds proof instead of repeating the same claim"],
      href: "/onboarding?drill=pushback-resilience-drill",
    });
  }

  drills.push({
    id: "star-compression-drill",
    title: "STAR Compression Drill",
    duration: "2 min",
    pressureLevel: "Medium",
    weaknessTargeted: "Concise structured storytelling",
    prompt: "Give a complete STAR answer in under 90 seconds without losing the result.",
    recruiterPushback: "Summarize the impact in one sentence.",
    successCriteria: ["Situation under 15 seconds", "Action is specific", "Result is measurable or clearly observable"],
    href: "/onboarding?drill=star-compression-drill",
  });

  return drills.slice(0, 4);
}
