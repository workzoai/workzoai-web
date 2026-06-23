/**
 * lib/workzoReadinessEngine.ts
 *
 * Phase 3 of the WorkZo roadmap: Interview Readiness Score.
 *
 * Combines all available signals into one unified Readiness Score (0–100):
 *
 *   CV Score          — quality and JD match of the uploaded CV
 *   Interview Score   — performance in the AI interview session
 *   Technical Score   — result of the technical assessment (Phase 2)
 *   Communication     — clarity, structure, ownership language across answers
 *   JD Fit            — how well the candidate matches the job description
 *
 * Each dimension is independently computable so the score degrades gracefully
 * when only some signals are available (e.g. no technical assessment yet).
 *
 * Designed to plug directly into:
 *   - results/page.tsx (post-interview display)
 *   - dashboard/page.tsx (progress tracking over time)
 *   - workzoCareerMemory.ts (longitudinal tracking)
 */

import type { PhaseAInsights } from "./workzoCareerSuitePhaseA";
import type { TechnicalAssessmentResult } from "./workzoTechnicalAssessmentEngine";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type ReadinessDimension = {
  label: string;
  score: number;            // 0–100
  weight: number;           // 0–1, sum of all weights = 1
  available: boolean;       // false = not yet assessed, shown as "--"
  grade: "A" | "B" | "C" | "D" | "F" | "—";
  topInsight: string;       // 1-line actionable note
  improvementTarget: string;// what a 10-point gain would require
};

export type ReadinessScoreInput = {
  // From CV analysis (Phase A)
  cvScore?: number;                         // 0–100 from PhaseA readinessScore
  cvInsights?: PhaseAInsights;

  // From interview session
  interviewScore?: number;                  // overallScore from results
  communicationScore?: number;
  confidenceScore?: number;
  trustScore?: number;
  ownershipScore?: number;
  structureScore?: number;
  evidenceScore?: number;

  // From technical assessment
  technicalResult?: TechnicalAssessmentResult;

  // From JD analysis
  jdMatchPercent?: number;                  // 0–100, from workzoInterviewEvidencePlanner matchedSkills/total
  missingSkillCount?: number;
  matchedSkillCount?: number;

  // Context
  targetRole?: string;
  cvText?: string;
  jobDescription?: string;
  transcript?: Array<{ role?: string; text?: string; time?: string }>;
};

export type ReadinessScoreOutput = {
  overall: number;                          // 0–100 weighted composite
  grade: "A" | "B" | "C" | "D" | "F";
  label: "Interview Ready" | "Nearly Ready" | "Developing" | "Needs Work" | "Not Ready";
  dimensions: {
    cv: ReadinessDimension;
    interview: ReadinessDimension;
    technical: ReadinessDimension;
    communication: ReadinessDimension;
    jdFit: ReadinessDimension;
  };
  topStrength: string;
  biggestGap: string;
  nextAction: string;
  progressMessage: string;
  readyForLiveInterview: boolean;
  estimatedOfferProbability: number;        // 0–100, rough signal
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function clamp(v: number, min = 0, max = 100): number {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.round(v)));
}

function gradeFrom(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 88) return "A";
  if (score >= 75) return "B";
  if (score >= 62) return "C";
  if (score >= 48) return "D";
  return "F";
}

function weightedScore(
  pairs: Array<{ score: number; weight: number; available: boolean }>,
): number {
  const available = pairs.filter((p) => p.available);
  if (!available.length) return 0;
  const totalWeight = available.reduce((s, p) => s + p.weight, 0);
  const weightedSum = available.reduce((s, p) => s + p.score * p.weight, 0);
  return clamp(weightedSum / totalWeight);
}

// ─────────────────────────────────────────────────────────────────────────────
// DIMENSION: CV SCORE
// ─────────────────────────────────────────────────────────────────────────────

function buildCvDimension(input: ReadinessScoreInput): ReadinessDimension {
  const available = input.cvScore !== undefined && input.cvScore > 0;
  const score = available ? clamp(input.cvScore!) : 0;
  const insights = input.cvInsights;

  const concerns = insights?.recruiterScan?.concerns || [];
  const topInsight = concerns.length
    ? `CV risk: ${concerns[0]}`
    : score >= 80
      ? "CV signals are strong for this role."
      : score >= 65
        ? "CV is adequate but has gaps a recruiter will probe."
        : "CV has significant gaps relative to the JD.";

  const improvementTarget =
    score < 70
      ? "Add quantified achievements (numbers, percentages, scope) to at least 3 roles."
      : score < 85
        ? "Address the top JD skill gap in your CV summary or skills section."
        : "CV is well-optimised. Focus on interview preparation.";

  return {
    label: "CV",
    score: available ? score : 0,
    weight: 0.20,
    available,
    grade: available ? gradeFrom(score) : "—",
    topInsight,
    improvementTarget,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DIMENSION: INTERVIEW SCORE
// ─────────────────────────────────────────────────────────────────────────────

function buildInterviewDimension(input: ReadinessScoreInput): ReadinessDimension {
  const available =
    input.interviewScore !== undefined &&
    input.interviewScore > 0;

  const score = available ? clamp(input.interviewScore!) : 0;

  const topInsight =
    !available
      ? "Complete an interview to unlock this score."
      : score >= 80
        ? "Interview performance is strong — evidence and ownership are clear."
        : score >= 65
          ? "Interview is solid. Work on adding metrics to claims."
          : score >= 50
            ? "Answers lack evidence and ownership. Practice STAR structure."
            : "Significant interview gaps. Focus on specific examples with measurable outcomes.";

  const improvementTarget =
    score < 65
      ? "For every claim you make, add a number, a scope, and your personal role."
      : score < 80
        ? "Reduce vague ownership ('we did') — replace with personal actions ('I built / I led')."
        : "Push for depth on your strongest examples. Anticipate follow-up questions.";

  return {
    label: "Interview",
    score,
    weight: 0.30,
    available,
    grade: available ? gradeFrom(score) : "—",
    topInsight,
    improvementTarget,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DIMENSION: TECHNICAL SCORE
// ─────────────────────────────────────────────────────────────────────────────

function buildTechnicalDimension(input: ReadinessScoreInput): ReadinessDimension {
  const available = input.technicalResult !== undefined;
  const score = available ? clamp(input.technicalResult!.technicalScore) : 0;
  const result = input.technicalResult;

  const topInsight = !available
    ? "Take the technical assessment to unlock this score."
    : score >= 80
      ? `Strong technical foundation. Best skill: ${result!.strongestSkill}.`
      : score >= 65
        ? `Technical base is adequate. Weak area: ${result!.weakestSkill}.`
        : `Technical gaps in: ${result!.bySkill.filter(r => !r.passed).map(r => r.skill).join(", ") || result!.weakestSkill}.`;

  const improvementTarget = !available
    ? "Complete the technical assessment."
    : result!.bySkill
        .filter((r) => !r.passed)
        .map((r) => r.gaps[0])
        .filter(Boolean)[0] || `Deepen ${result!.weakestSkill} to pass the ${result!.targetRole} bar.`;

  return {
    label: "Technical",
    score,
    weight: 0.25,
    available,
    grade: available ? gradeFrom(score) : "—",
    topInsight,
    improvementTarget,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DIMENSION: COMMUNICATION
// ─────────────────────────────────────────────────────────────────────────────

function buildCommunicationDimension(input: ReadinessScoreInput): ReadinessDimension {
  const hasInterviewData =
    input.communicationScore !== undefined ||
    input.structureScore !== undefined ||
    input.confidenceScore !== undefined;

  const available = hasInterviewData || (input.transcript && input.transcript.length > 3);

  // Compute from available signals
  let score = 0;
  if (input.communicationScore) score = clamp(input.communicationScore);
  else if (hasInterviewData) {
    const parts = [
      input.structureScore,
      input.confidenceScore,
      input.ownershipScore,
    ].filter((v): v is number => v !== undefined);
    score = parts.length ? clamp(parts.reduce((a, b) => a + b, 0) / parts.length) : 0;
  } else if (input.transcript) {
    // Compute from transcript text
    score = computeCommunicationFromTranscript(input.transcript);
  }

  const topInsight =
    !available
      ? "Complete an interview to unlock communication scoring."
      : score >= 80
        ? "Answers are clear, structured, and confident."
        : score >= 65
          ? "Generally clear but some answers lack structure or ramble."
          : "Communication needs work — answers are too vague or too long.";

  const improvementTarget =
    score < 65
      ? "Use the STAR structure: Situation (1 sentence), Task, Action (specific 'I' language), Result (with a number)."
      : score < 80
        ? "Start each answer with the outcome, then give one supporting example."
        : "Communication is strong. Focus on consistency across all question types.";

  return {
    label: "Communication",
    score: available ? score : 0,
    weight: 0.12,
    available: available ?? false,
    grade: (available ?? false) ? gradeFrom(score) : "—",
    topInsight,
    improvementTarget,
  };
}

function computeCommunicationFromTranscript(
  transcript: Array<{ role?: string; text?: string }>,
): number {
  const candidateAnswers = transcript
    .filter((t) => /candidate|user/i.test(String(t.role || "")))
    .map((t) => String(t.text || ""));

  if (!candidateAnswers.length) return 0;

  const allText = candidateAnswers.join(" ");
  let score = 50;

  const avgWords =
    candidateAnswers.reduce((s, a) => s + a.split(/\s+/).length, 0) /
    candidateAnswers.length;

  if (avgWords >= 40 && avgWords <= 140) score += 12; // right length
  if (avgWords < 15) score -= 15; // too short
  if (avgWords > 200) score -= 12; // rambling

  const structureSignals = (allText.match(/\b(first|then|finally|as a result|which meant|the outcome|so that|because|therefore)\b/gi) || []).length;
  score += Math.min(structureSignals * 3, 12);

  const ownershipSignals = (allText.match(/\b(i built|i led|i created|i designed|i implemented|i resolved|i improved|i owned)\b/gi) || []).length;
  score += Math.min(ownershipSignals * 4, 16);

  const vagueSignals = (allText.match(/\b(generally|usually|kind of|sort of|i guess|maybe|probably|we tend to|i think maybe)\b/gi) || []).length;
  score -= Math.min(vagueSignals * 3, 18);

  return clamp(score);
}

// ─────────────────────────────────────────────────────────────────────────────
// DIMENSION: JD FIT
// ─────────────────────────────────────────────────────────────────────────────

function buildJdFitDimension(input: ReadinessScoreInput): ReadinessDimension {
  const hasJdData =
    input.jdMatchPercent !== undefined ||
    (input.matchedSkillCount !== undefined && input.missingSkillCount !== undefined);

  const available = hasJdData && !!input.jobDescription;

  let score = 0;
  if (input.jdMatchPercent !== undefined) {
    score = clamp(input.jdMatchPercent);
  } else if (input.matchedSkillCount !== undefined && input.missingSkillCount !== undefined) {
    const total = input.matchedSkillCount + input.missingSkillCount;
    score = total > 0 ? clamp((input.matchedSkillCount / total) * 100) : 0;
  }

  const missingCount = input.missingSkillCount || 0;

  const topInsight = !available
    ? "Upload a job description to unlock JD Fit scoring."
    : score >= 85
      ? "Excellent JD match — your profile covers the core requirements."
      : score >= 70
        ? `Good match with ${missingCount} skill gap${missingCount !== 1 ? "s" : ""} to address.`
        : score >= 55
          ? `Moderate JD fit — ${missingCount} required skills not evidenced in your CV.`
          : `Low JD fit — significant skill gaps versus what the employer needs.`;

  const improvementTarget = !available
    ? "Upload a job description."
    : score < 70
      ? `Address the missing JD skills — especially any marked as 'required'. Add evidence or transferable experience.`
      : `Address remaining ${missingCount} gap${missingCount !== 1 ? "s" : ""} with concrete examples in interview answers.`;

  return {
    label: "JD Fit",
    score: available ? score : 0,
    weight: 0.13,
    available,
    grade: available ? gradeFrom(score) : "—",
    topInsight,
    improvementTarget,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MASTER SCORE BUILDER
// ─────────────────────────────────────────────────────────────────────────────

export function buildReadinessScore(input: ReadinessScoreInput): ReadinessScoreOutput {
  const cv = buildCvDimension(input);
  const interview = buildInterviewDimension(input);
  const technical = buildTechnicalDimension(input);
  const communication = buildCommunicationDimension(input);
  const jdFit = buildJdFitDimension(input);

  const overall = weightedScore([cv, interview, technical, communication, jdFit]);
  const grade = gradeFrom(overall);

  const label: ReadinessScoreOutput["label"] =
    overall >= 85 ? "Interview Ready" :
    overall >= 72 ? "Nearly Ready" :
    overall >= 58 ? "Developing" :
    overall >= 42 ? "Needs Work" : "Not Ready";

  // Find top strength and biggest gap from available dimensions
  const availableDims = [cv, interview, technical, communication, jdFit].filter(
    (d) => d.available,
  );
  const sortedByScore = [...availableDims].sort((a, b) => b.score - a.score);
  const topDim = sortedByScore[0];
  const worstDim = sortedByScore[sortedByScore.length - 1];

  const topStrength = topDim
    ? `${topDim.label} (${topDim.score}/100) — ${topDim.topInsight}`
    : "Complete your interview and technical assessment to identify strengths.";

  const biggestGap = worstDim && worstDim.score < 70
    ? `${worstDim.label} (${worstDim.score}/100) — ${worstDim.improvementTarget}`
    : "No critical gaps detected.";

  // Next action — most impactful thing the candidate can do right now
  const nextAction = buildNextAction(cv, interview, technical, jdFit, overall);

  const progressMessage = buildProgressMessage(overall, label, topDim, worstDim);

  const readyForLiveInterview = overall >= 72 && interview.available && interview.score >= 68;

  // Rough offer probability estimate
  const offerFactors = availableDims.map((d) => d.score);
  const estimatedOfferProbability = offerFactors.length
    ? clamp(
        (offerFactors.reduce((a, b) => a + b, 0) / offerFactors.length) * 0.85 +
          (overall >= 80 ? 12 : overall >= 65 ? 5 : -8),
      )
    : 0;

  return {
    overall,
    grade,
    label,
    dimensions: { cv, interview, technical, communication, jdFit },
    topStrength,
    biggestGap,
    nextAction,
    progressMessage,
    readyForLiveInterview,
    estimatedOfferProbability,
  };
}

function buildNextAction(
  cv: ReadinessDimension,
  interview: ReadinessDimension,
  technical: ReadinessDimension,
  jdFit: ReadinessDimension,
  overall: number,
): string {
  if (!cv.available) return "Upload your CV to unlock your full readiness profile.";
  if (!jdFit.available) return "Upload the job description you're targeting to get a JD Fit score.";
  if (!interview.available) return "Start your first AI interview — it's the highest-impact action right now.";
  if (!technical.available) return "Take the technical assessment to complete your readiness profile.";

  // All available — give the most targeted improvement
  const dims = [cv, interview, technical, jdFit].sort((a, b) => a.score - b.score);
  const worst = dims[0];
  return worst.improvementTarget;
}

function buildProgressMessage(
  overall: number,
  label: ReadinessScoreOutput["label"],
  topDim: ReadinessDimension | undefined,
  worstDim: ReadinessDimension | undefined,
): string {
  if (overall >= 85) {
    return `You're interview-ready. Your ${topDim?.label || "performance"} is strong. Keep practising to stay sharp.`;
  }
  if (overall >= 72) {
    return `Almost there. A ${worstDim?.label || "few areas"} improvement would move you into ready territory.`;
  }
  if (overall >= 58) {
    return `You're building momentum. Focus on ${worstDim?.label || "your weakest area"} — that's your biggest unlock.`;
  }
  if (overall >= 42) {
    return `Work to do, but you're moving. Complete the full assessment to see exactly what to prioritise.`;
  }
  return `Start with the basics — complete an interview and technical assessment to get a full picture.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SERIALIZER — for injecting into LLM prompt or results page
// ─────────────────────────────────────────────────────────────────────────────

export function serializeReadinessScore(result: ReadinessScoreOutput): string {
  const dims = result.dimensions;
  const lines = [
    `READINESS SCORE (${result.label}): ${result.overall}/100 (${result.grade})`,
    `  CV:            ${dims.cv.available ? `${dims.cv.score}/100 (${dims.cv.grade})` : "— not assessed"}`,
    `  Interview:     ${dims.interview.available ? `${dims.interview.score}/100 (${dims.interview.grade})` : "— not assessed"}`,
    `  Technical:     ${dims.technical.available ? `${dims.technical.score}/100 (${dims.technical.grade})` : "— not assessed"}`,
    `  Communication: ${dims.communication.available ? `${dims.communication.score}/100 (${dims.communication.grade})` : "— not assessed"}`,
    `  JD Fit:        ${dims.jdFit.available ? `${dims.jdFit.score}/100 (${dims.jdFit.grade})` : "— not assessed"}`,
    `  Top strength:  ${result.topStrength}`,
    `  Biggest gap:   ${result.biggestGap}`,
    `  Next action:   ${result.nextAction}`,
    `  Ready for live interview: ${result.readyForLiveInterview ? "YES" : "NOT YET"}`,
  ];
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY TRACKER — persists readiness progress across sessions
// ─────────────────────────────────────────────────────────────────────────────

export type ReadinessHistoryEntry = {
  date: string;
  targetRole: string;
  overall: number;
  cv: number;
  interview: number;
  technical: number;
  communication: number;
  jdFit: number;
  label: ReadinessScoreOutput["label"];
};

export function buildReadinessHistoryEntry(
  result: ReadinessScoreOutput,
  targetRole: string,
): ReadinessHistoryEntry {
  const d = result.dimensions;
  return {
    date: new Date().toISOString(),
    targetRole,
    overall: result.overall,
    cv: d.cv.available ? d.cv.score : 0,
    interview: d.interview.available ? d.interview.score : 0,
    technical: d.technical.available ? d.technical.score : 0,
    communication: d.communication.available ? d.communication.score : 0,
    jdFit: d.jdFit.available ? d.jdFit.score : 0,
    label: result.label,
  };
}

export function computeReadinessTrend(
  history: ReadinessHistoryEntry[],
): {
  trend: "improving" | "declining" | "stable" | "insufficient_data";
  delta: number;
  sessions: number;
} {
  if (history.length < 2) {
    return { trend: "insufficient_data", delta: 0, sessions: history.length };
  }
  const sorted = [...history].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const first = sorted[0].overall;
  const last = sorted[sorted.length - 1].overall;
  const delta = last - first;
  return {
    trend: delta >= 4 ? "improving" : delta <= -4 ? "declining" : "stable",
    delta,
    sessions: history.length,
  };
}
