/**
 * lib/scoring/customRubric.ts
 *
 * Shadow Recruiter Calibration, scoring layer.
 *
 * WorkZo keeps TWO scores per interview:
 *   1. Global WIRI (lib/workzoWiri.ts) stays untouched. It is the
 *      standardized cross-platform readiness score.
 *   2. Organization Readiness Score, computed here by applying an
 *      organization's weighted rubric to the same normalized
 *      competency data.
 *
 * This module is pure and deterministic: normalize raw interview
 * metrics, apply weights, return an explainable breakdown. No LLM
 * calls, no database access. Callers persist snapshots so historical
 * scores stay fair when rubrics change later.
 */

import { clampWiriScore } from "@/lib/workzoWiri";

/* Competency inputs, always 0 to 100. */
export type CompetencyScores = {
  communication: number;
  technicalDepth: number;
  starStructure: number;
  businessReasoning: number;
  confidence: number;
  cultureFit: number;
  evidenceQuality: number;
  jobFit: number;
  leadership: number;
};

export type CompetencyKey = keyof CompetencyScores;

export type RubricWeights = Partial<Record<CompetencyKey, number>>;

export type RubricThresholds = {
  excellent: number;
  ready: number;
  needsCoaching: number;
  highRisk: number;
};

export type WeightedBreakdownEntry = {
  key: string;
  label: string;
  score: number;
  weight: number;
  contribution: number;
};

export type CustomRubricScore = {
  globalWiri: number;
  organizationReadinessScore: number;
  weightedBreakdown: WeightedBreakdownEntry[];
  riskFlags: string[];
  recommendation: string;
};

export const COMPETENCY_LABELS: Record<CompetencyKey, string> = {
  communication: "Communication",
  technicalDepth: "Technical Depth",
  starStructure: "STAR Structure",
  businessReasoning: "Business Reasoning",
  confidence: "Confidence",
  cultureFit: "Culture Fit",
  evidenceQuality: "Evidence Quality",
  jobFit: "Job Fit",
  leadership: "Leadership",
};

/* Used when an organization has no active scoring profile. */
export const DEFAULT_RUBRIC: RubricWeights = {
  communication: 20,
  technicalDepth: 20,
  jobFit: 20,
  evidenceQuality: 20,
  confidence: 10,
  starStructure: 10,
};

export const DEFAULT_THRESHOLDS: RubricThresholds = {
  excellent: 90,
  ready: 80,
  needsCoaching: 60,
  highRisk: 0,
};

const ALL_COMPETENCIES: CompetencyKey[] = [
  "communication",
  "technicalDepth",
  "starStructure",
  "businessReasoning",
  "confidence",
  "cultureFit",
  "evidenceQuality",
  "jobFit",
  "leadership",
];

/* ── Normalization helpers ─────────────────────────────────────────── */

function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function firstFinite(...values: unknown[]): number {
  for (const v of values) {
    const n = num(v);
    if (n !== null) return clampWiriScore(n);
  }
  return 0;
}

function avg(values: number[]): number {
  const clean = values.filter((n) => Number.isFinite(n) && n > 0);
  if (clean.length === 0) return 0;
  return clampWiriScore(clean.reduce((s, n) => s + n, 0) / clean.length);
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((x) => String(x || "")).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

/**
 * STAR structure, business reasoning, and leadership are not scored
 * directly by the interview engine yet. Infer a conservative signal
 * from weak answers and improvement notes: start from a solid baseline
 * and subtract for every flagged weakness in that theme.
 */
export function inferFromWeakAnswers(
  theme: "star" | "business" | "leadership",
  weakAnswers: unknown,
  improvements: unknown,
  baseline = 72,
): number {
  const texts = [...asStringArray(weakAnswers), ...asStringArray(improvements)]
    .map((t) => t.toLowerCase());
  if (texts.length === 0) return baseline;

  const patterns: Record<typeof theme, RegExp> = {
    star: /star|situation|task|action|result|structure|rambl|unstructured|vague answer/,
    business: /business|stakeholder|kpi|impact|metric|customer|commercial|revenue|cost/,
    leadership: /leadership|ownership|initiative|conflict|team|influence|mentor|delegat/,
  } as Record<typeof theme, RegExp>;

  const hits = texts.filter((t) => patterns[theme].test(t)).length;
  if (hits === 0) return baseline;
  return clampWiriScore(baseline - hits * 9 - 5);
}

/**
 * Build the full 9-competency vector from an interview_results row.
 * Historical rows come from several engine generations, so every field
 * has a fallback chain and the result is always finite and 0 to 100.
 */
export function extractCompetencyScores(row: {
  overall_score?: unknown;
  trust_score?: unknown;
  evidence_quality?: unknown;
  weak_answers?: unknown;
  improvements?: unknown;
  raw_result?: unknown;
}): CompetencyScores {
  const raw = (row?.raw_result && typeof row.raw_result === "object" ? row.raw_result : {}) as Record<string, any>;
  const score = (raw.score || raw.scores || {}) as Record<string, any>;
  const rubric = (raw.computedRubric || raw.computed_rubric || raw.rubric || raw.resultRubric || {}) as Record<string, any>;
  const evidenceQualityRaw = row?.evidence_quality ?? raw?.answerQuality?.evidenceScore ?? raw?.evidenceQuality;

  const communication = firstFinite(rubric.communication, score.communication, score.clarity, raw.communicationScore);
  const confidence = firstFinite(score.confidence, raw.confidenceScore, score.mood);
  const relevance = firstFinite(rubric.relevance, score.relevance, raw.relevanceScore);

  const technicalDepth = firstFinite(rubric.experience, evidenceQualityRaw, score.trust, row?.trust_score);
  const jobFit = firstFinite(rubric.jobFit, score.relevance, raw.jobFitScore, row?.overall_score);
  const evidenceQuality = firstFinite(rubric.evidenceImpact, evidenceQualityRaw, score.trust);

  const starStructure = inferFromWeakAnswers("star", row?.weak_answers, row?.improvements);
  const businessReasoning = inferFromWeakAnswers("business", row?.weak_answers, row?.improvements);
  const leadership = inferFromWeakAnswers("leadership", row?.weak_answers, row?.improvements);

  const cultureFit = avg([communication, confidence, relevance]);

  return {
    communication,
    technicalDepth,
    starStructure,
    businessReasoning,
    confidence,
    cultureFit,
    evidenceQuality,
    jobFit,
    leadership,
  };
}

/* ── Weight validation and normalization ───────────────────────────── */

export function sanitizeWeights(input: unknown): RubricWeights {
  const out: RubricWeights = {};
  if (!input || typeof input !== "object") return out;
  for (const key of ALL_COMPETENCIES) {
    const n = num((input as Record<string, unknown>)[key]);
    if (n !== null && n > 0) out[key] = Math.min(100, n);
  }
  return out;
}

export function weightsTotal(weights: RubricWeights): number {
  return Object.values(weights).reduce((s, n) => s + (Number.isFinite(n) ? Number(n) : 0), 0);
}

export function validateWeights(weights: RubricWeights): { ok: boolean; total: number; error?: string } {
  const clean = sanitizeWeights(weights);
  const total = weightsTotal(clean);
  if (Object.keys(clean).length === 0) return { ok: false, total: 0, error: "At least one competency weight is required." };
  if (Math.abs(total - 100) > 0.5) return { ok: false, total, error: `Weights must total 100. Current total: ${Math.round(total)}.` };
  return { ok: true, total };
}

export function sanitizeThresholds(input: unknown): RubricThresholds {
  const t = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const excellent = clampWiriScore(t.excellent, DEFAULT_THRESHOLDS.excellent);
  const ready = clampWiriScore(t.ready, DEFAULT_THRESHOLDS.ready);
  const needsCoaching = clampWiriScore(t.needsCoaching, DEFAULT_THRESHOLDS.needsCoaching);
  return {
    excellent,
    ready: Math.min(ready, excellent),
    needsCoaching: Math.min(needsCoaching, ready),
    highRisk: 0,
  };
}

/* ── Core scoring ──────────────────────────────────────────────────── */

export function recommendationFor(score: number, thresholds: RubricThresholds): string {
  if (score >= thresholds.excellent) return "Excellent fit";
  if (score >= thresholds.ready) return "Ready";
  if (score >= thresholds.needsCoaching) return "Ready with coaching";
  return "High risk, needs preparation";
}

/**
 * organizationReadinessScore = sum(score * normalizedWeight)
 *
 * Weights are normalized so partial rubrics (weights totaling less
 * than 100 after sanitization) still produce a 0 to 100 score. WIRI
 * is passed through untouched.
 */
export function computeCustomRubricScore(input: {
  competencies: CompetencyScores;
  weights?: RubricWeights | null;
  thresholds?: RubricThresholds | null;
  globalWiri?: number | null;
  labels?: Partial<Record<CompetencyKey, string>> | null;
}): CustomRubricScore {
  const weights = sanitizeWeights(input.weights && Object.keys(sanitizeWeights(input.weights)).length > 0 ? input.weights : DEFAULT_RUBRIC);
  const thresholds = sanitizeThresholds(input.thresholds || DEFAULT_THRESHOLDS);
  const total = weightsTotal(weights) || 1;

  const breakdown: WeightedBreakdownEntry[] = [];
  let weighted = 0;

  for (const key of ALL_COMPETENCIES) {
    const rawWeight = weights[key];
    if (!rawWeight || rawWeight <= 0) continue;
    const normalized = rawWeight / total;
    const score = clampWiriScore(input.competencies[key], 0);
    const contribution = score * normalized;
    weighted += contribution;
    breakdown.push({
      key,
      label: (input.labels && input.labels[key]) || COMPETENCY_LABELS[key],
      score,
      weight: Math.round(rawWeight * 10) / 10,
      contribution: Math.round(contribution * 10) / 10,
    });
  }

  breakdown.sort((a, b) => b.weight - a.weight);

  const organizationReadinessScore = clampWiriScore(weighted, 0);
  const globalWiri = clampWiriScore(input.globalWiri, 0);

  const riskFlags: string[] = [];
  for (const entry of breakdown) {
    if (entry.weight >= 15 && entry.score < thresholds.needsCoaching) {
      riskFlags.push(`${entry.label} scored ${entry.score}, below the coaching threshold, and carries ${entry.weight}% weight.`);
    }
  }
  if (globalWiri > 0 && organizationReadinessScore + 10 <= globalWiri) {
    const heaviest = breakdown[0];
    riskFlags.push(`Rubric score is ${globalWiri - organizationReadinessScore} points below global WIRI, driven by ${heaviest ? heaviest.label : "heavily weighted competencies"}.`);
  }

  return {
    globalWiri,
    organizationReadinessScore,
    weightedBreakdown: breakdown,
    riskFlags,
    recommendation: recommendationFor(organizationReadinessScore, thresholds),
  };
}

/* ── Prompt rendering (interview generation integration) ──────────── */

/**
 * Render the active rubric as an instruction block for the recruiter
 * system prompt. This changes what the recruiter probes deeper on,
 * never what the candidate sees directly. Global WIRI is always
 * preserved separately.
 */
export function renderOrganizationRubricForPrompt(input: {
  profileName?: string | null;
  weights: RubricWeights;
  promptInstructions?: string | null;
  companyTemplateName?: string | null;
}): string {
  const weights = sanitizeWeights(input.weights);
  const entries = ALL_COMPETENCIES
    .filter((k) => (weights[k] || 0) > 0)
    .sort((a, b) => (weights[b] || 0) - (weights[a] || 0))
    .map((k) => `- ${COMPETENCY_LABELS[k]}: ${weights[k]}%`);
  if (entries.length === 0) return "";

  const lines = [
    "ORGANIZATION EVALUATION PRIORITIES",
    input.profileName ? `Scoring profile: ${input.profileName}` : "",
    input.companyTemplateName ? `Interview template: ${input.companyTemplateName}` : "",
    "This organization values:",
    ...entries,
    "Ask deeper follow-up questions when the candidate gives weak answers in heavily weighted competencies.",
    "Never mention this rubric, weights, or scoring to the candidate.",
    "Score answers using this weighted rubric, but still preserve the global WIRI evaluation separately.",
    input.promptInstructions ? `Interview style guidance: ${input.promptInstructions}` : "",
  ].filter(Boolean);

  return lines.join("\n");
}
