export type WorkZoWiriTier = "employer-ready" | "minor-coaching" | "needs-improvement" | "early-stage";

export type WorkZoWiriBreakdown = {
  cvQuality: number;
  jobFit: number;
  interviewPerformance: number;
  communication: number;
  technicalCompetency: number;
  confidence: number;
  evidenceQuality: number;
  improvementTrend: number;
  interviewConsistency: number;
};

export type WorkZoWiriResult = {
  score: number;
  tier: WorkZoWiriTier;
  label: string;
  userLabel: string;
  nextAction: string;
  breakdown: WorkZoWiriBreakdown;
  source: "historical" | "mixed" | "new-rubric" | "insufficient";
};

export const WORKZO_WIRI_WEIGHTS: Record<keyof WorkZoWiriBreakdown, number> = {
  cvQuality: 0.1,
  jobFit: 0.15,
  interviewPerformance: 0.18,
  communication: 0.14,
  technicalCompetency: 0.12,
  confidence: 0.1,
  evidenceQuality: 0.1,
  improvementTrend: 0.06,
  interviewConsistency: 0.05,
};

export function clampWiriScore(value: unknown, fallback = 0): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function averageWiri(values: number[]): number {
  const clean = values.filter((n) => Number.isFinite(n));
  return clean.length ? Math.round(clean.reduce((sum, n) => sum + n, 0) / clean.length) : 0;
}

export function wiriTier(score: number): WorkZoWiriTier {
  if (score >= 90) return "employer-ready";
  if (score >= 80) return "minor-coaching";
  if (score >= 60) return "needs-improvement";
  return "early-stage";
}

export function wiriTierLabel(tier: WorkZoWiriTier): string {
  if (tier === "employer-ready") return "Employer Ready";
  if (tier === "minor-coaching") return "Ready with Minor Coaching";
  if (tier === "needs-improvement") return "Needs Improvement";
  return "Early Preparation Stage";
}

export function studentWiriLabel(score: number): string {
  if (score >= 90) return "Interview ready";
  if (score >= 80) return "Almost interview ready";
  if (score >= 60) return "Improving";
  return "Keep practicing";
}

export function studentWiriNextAction(score: number, breakdown: Partial<WorkZoWiriBreakdown>): string {
  const entries = Object.entries(breakdown).filter(([, v]) => Number.isFinite(Number(v))) as [keyof WorkZoWiriBreakdown, number][];
  const weakest = entries.sort((a, b) => a[1] - b[1])[0]?.[0];
  if (score >= 90) return "You are ready to apply. Keep one fresh practice interview before employer calls.";
  if (weakest === "communication") return "Practice concise openings and STAR answers in your next interview.";
  if (weakest === "jobFit") return "Paste the exact job description and practice role-fit answers.";
  if (weakest === "technicalCompetency") return "Do one technical explanation round and explain your decisions out loud.";
  if (weakest === "evidenceQuality") return "Add measurable results to your examples: numbers, scope, tools, and impact.";
  if (weakest === "confidence") return "Repeat a short confidence round and focus on clear closing sentences.";
  return "Complete another CV + JD interview to improve your readiness score.";
}

export function consistencyFromScores(scores: number[]): number {
  const clean = scores.filter((n) => Number.isFinite(n));
  if (clean.length === 0) return 0;
  if (clean.length === 1) return 75;
  const mean = clean.reduce((s, n) => s + n, 0) / clean.length;
  const variance = clean.reduce((s, n) => s + Math.pow(n - mean, 2), 0) / clean.length;
  return clampWiriScore(100 - Math.round(Math.sqrt(variance) * 2.2));
}

export function improvementFromScores(scores: number[]): number {
  const clean = scores.filter((n) => Number.isFinite(n));
  if (clean.length < 2) return clean.length === 1 ? 70 : 0;
  const midpoint = Math.max(1, Math.floor(clean.length / 2));
  const older = averageWiri(clean.slice(0, midpoint));
  const recent = averageWiri(clean.slice(midpoint));
  return clampWiriScore(70 + (recent - older) * 2);
}

export function computeWorkZoWiri(input: Partial<WorkZoWiriBreakdown>): WorkZoWiriResult {
  const breakdown: WorkZoWiriBreakdown = {
    cvQuality: clampWiriScore(input.cvQuality, 70),
    jobFit: clampWiriScore(input.jobFit, input.interviewPerformance || 0),
    interviewPerformance: clampWiriScore(input.interviewPerformance, 0),
    communication: clampWiriScore(input.communication, input.interviewPerformance || 0),
    technicalCompetency: clampWiriScore(input.technicalCompetency, input.evidenceQuality || input.interviewPerformance || 0),
    confidence: clampWiriScore(input.confidence, input.interviewPerformance || 0),
    evidenceQuality: clampWiriScore(input.evidenceQuality, input.technicalCompetency || input.interviewPerformance || 0),
    improvementTrend: clampWiriScore(input.improvementTrend, 70),
    interviewConsistency: clampWiriScore(input.interviewConsistency, 75),
  };

  const score = clampWiriScore(
    Object.entries(WORKZO_WIRI_WEIGHTS).reduce((sum, [key, weight]) => {
      return sum + (breakdown[key as keyof WorkZoWiriBreakdown] || 0) * weight;
    }, 0),
  );
  const tier = wiriTier(score);
  return {
    score,
    tier,
    label: wiriTierLabel(tier),
    userLabel: studentWiriLabel(score),
    nextAction: studentWiriNextAction(score, breakdown),
    breakdown,
    source: "mixed",
  };
}

export function wiriMetricLabel(key: keyof WorkZoWiriBreakdown): string {
  const labels: Record<keyof WorkZoWiriBreakdown, string> = {
    cvQuality: "CV Quality",
    jobFit: "Job Fit",
    interviewPerformance: "Interview Performance",
    communication: "Communication",
    technicalCompetency: "Technical Competency",
    confidence: "Confidence",
    evidenceQuality: "Evidence Quality",
    improvementTrend: "Improvement Trend",
    interviewConsistency: "Interview Consistency",
  };
  return labels[key];
}
