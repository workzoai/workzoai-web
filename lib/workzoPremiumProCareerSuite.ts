import {
  buildCareerBrain,
  readCareerMemory,
  saveCareerMemory,
  type CareerRoadmapItem,
  type PhaseCCareerBrain,
  type PhaseCCareerBrainInput,
  type WorkZoCareerMemory,
} from "@/lib/workzoCareerMemory";

export type WorkZoPremiumProReplayMoment = {
  id: string;
  label: "Best moment" | "Weak moment" | "Missed opportunity" | "Recovery moment";
  question: string;
  answer: string;
  insight: string;
  coachingAction: string;
  trustImpact: number;
};

export type WorkZoPremiumProRoadmap = {
  days30: CareerRoadmapItem[];
  days60: CareerRoadmapItem[];
  days90: CareerRoadmapItem[];
};

export type WorkZoPremiumProSuite = {
  coachSummary: string;
  weeklyPriorities: Array<{ title: string; action: string; reason: string }>;
  roadmap: WorkZoPremiumProRoadmap;
  progressTracking: {
    scoreTrend: number[];
    trustTrend: number[];
    evidenceTrend: number[];
    ownershipTrend: number[];
    trendSummary: string;
  };
  replayIntelligence: WorkZoPremiumProReplayMoment[];
  recruiterChallenges: string[];
  hiringReadiness: {
    current: number;
    afterCv: number;
    afterPrep: number;
    label: string;
    reasons: string[];
  };
  careerBrain: PhaseCCareerBrain;
};

type AnswerInsightLike = {
  id?: string;
  question?: string;
  answer?: string;
  metricPresent?: boolean;
  ownershipPresent?: boolean;
  resultPresent?: boolean;
  structureScore?: number;
  evidenceScore?: number;
  trustImpact?: number;
  weakness?: string;
  recruiterHeard?: string;
  rewrite?: string;
  redFlags?: string[];
};

function clean(value: unknown, fallback = "") {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() || fallback : fallback;
}

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function scoreDelta(values: number[]) {
  if (values.length < 2) return 0;
  return values[values.length - 1] - values[0];
}

function roadmapItem(id: string, priority: string, title: string, action: string, source: CareerRoadmapItem["source"], estimatedGain: string): CareerRoadmapItem {
  return { id, priority, title, action, source, estimatedGain, completed: false, updatedAt: new Date().toISOString() };
}

function buildWeeklyPriorities(brain: PhaseCCareerBrain, input: PhaseCCareerBrainInput) {
  const weakness = brain.persistentWeaknesses[0];
  const role = clean(input.targetRole, "your target role");
  const priorities = [
    {
      title: weakness ? `Fix ${weakness.label.toLowerCase()}` : "Strengthen measurable proof",
      action: weakness?.coachLine || "Add truthful metrics, scale, time saved, quality improvement, or customer impact to your top stories.",
      reason: weakness ? `Repeated ${weakness.count} time${weakness.count === 1 ? "" : "s"} across recent interview evidence.` : "Recruiters trust specific proof faster than broad claims.",
    },
    {
      title: `Prepare 3 ${role} proof stories`,
      action: "Create one STAR story for customer impact, one for conflict/pressure, and one for measurable delivery.",
      reason: "Premium Pro should prepare you for repeated recruiter pressure, not just one question.",
    },
    {
      title: "Run one focused follow-up interview",
      action: "Practice only the weak area and stop each answer after situation, action, result, and role connection.",
      reason: "Focused repetition improves recruiter trust faster than random practice.",
    },
  ];
  return priorities.slice(0, 3);
}

function buildRoadmap(brain: PhaseCCareerBrain, input: PhaseCCareerBrainInput): WorkZoPremiumProRoadmap {
  const base = brain.roadmap.length ? brain.roadmap : [
    roadmapItem("metrics", "Priority 1", "Add proof to your strongest stories", "Rewrite your top 3 examples with metrics, ownership, result, and role connection.", "interview", "+8 to +12 pts"),
    roadmapItem("star", "Priority 2", "Tighten STAR delivery", "Practice concise 60-90 second answers without over-explaining.", "interview", "+5 to +8 pts"),
  ];

  const days30 = base.slice(0, 4);
  const days60 = [
    ...base.slice(0, 3),
    roadmapItem("job_targeting_60", "Priority 4", "Connect job targeting to interview practice", "Use Job Assist to identify missing skills and practice questions around those gaps.", "job", "+5 to +9 pts"),
    roadmapItem("cv_alignment_60", "Priority 5", "Align CV, cover letter, and interview proof", "Make your CV bullets, cover letter proof paragraph, and interview stories tell the same evidence-backed story.", "global", "+6 to +10 pts"),
  ].slice(0, 6);

  const days90 = [
    ...days60,
    roadmapItem("persona_pressure_90", "Priority 6", "Practice premium recruiter personas", "Rotate between Founder, Executive Recruiter, Technical Lead, and FAANG-style pressure to remove weak patterns.", "interview", "+6 to +12 pts"),
    roadmapItem("application_system_90", "Priority 7", "Create an application rhythm", "Track target companies, tailor CV and cover letters, and retry interviews based on each job type.", "global", "+8 to +15 pts"),
  ].slice(0, 8);

  return { days30, days60, days90 };
}

function buildProgressTracking(brain: PhaseCCareerBrain) {
  const { scoreTrend, trustTrend, evidenceTrend, ownershipTrend } = brain.progress;
  const scoreMove = scoreDelta(scoreTrend);
  const trustMove = scoreDelta(trustTrend);
  const evidenceMove = scoreDelta(evidenceTrend);
  const ownershipMove = scoreDelta(ownershipTrend);

  const movement = [
    scoreMove ? `score ${scoreMove > 0 ? "+" : ""}${scoreMove}` : "score stable",
    trustMove ? `trust ${trustMove > 0 ? "+" : ""}${trustMove}` : "trust stable",
    evidenceMove ? `evidence ${evidenceMove > 0 ? "+" : ""}${evidenceMove}` : "evidence stable",
    ownershipMove ? `ownership ${ownershipMove > 0 ? "+" : ""}${ownershipMove}` : "ownership stable",
  ].join(" · ");

  return {
    scoreTrend,
    trustTrend,
    evidenceTrend,
    ownershipTrend,
    trendSummary: scoreTrend.length >= 2 ? `Recent movement: ${movement}.` : "Complete more interviews to unlock meaningful progress trends.",
  };
}

function classifyMoment(item: AnswerInsightLike, index: number): WorkZoPremiumProReplayMoment["label"] {
  const trustImpact = Number(item.trustImpact || 0);
  const evidence = Number(item.evidenceScore || 0);
  const structure = Number(item.structureScore || 0);
  if (trustImpact >= 8 || (evidence >= 78 && structure >= 76)) return "Best moment";
  if (trustImpact <= -8 || evidence < 55 || structure < 55) return "Weak moment";
  if (!item.metricPresent || !item.ownershipPresent || !item.resultPresent) return "Missed opportunity";
  return index % 2 === 0 ? "Recovery moment" : "Missed opportunity";
}

function buildReplayIntelligence(input: PhaseCCareerBrainInput): WorkZoPremiumProReplayMoment[] {
  const answers = (input.answerInsights || []) as AnswerInsightLike[];
  const moments = answers
    .filter((item) => clean(item.answer) && !/not captured/i.test(clean(item.answer)))
    .map((item, index) => {
      const label = classifyMoment(item, index);
      const question = clean(item.question, `Interview question ${index + 1}`);
      const answer = clean(item.answer, "Answer not captured.");
      const weakness = clean(item.weakness, "The recruiter needed clearer proof, ownership, or structure.");
      const rewrite = clean(item.rewrite, "Rewrite this answer using STAR and add one measurable result.");
      const trustImpact = clamp(Number(item.trustImpact || 0), -30, 30);
      const missing = [
        item.metricPresent === false ? "metric" : "",
        item.ownershipPresent === false ? "ownership" : "",
        item.resultPresent === false ? "result" : "",
      ].filter(Boolean).join(", ");

      return {
        id: clean(item.id, `replay_${index + 1}`),
        label,
        question,
        answer,
        trustImpact,
        insight: label === "Best moment" ? "This answer created stronger recruiter confidence because it had clearer evidence or structure." : missing ? `This answer missed: ${missing}. ${weakness}` : weakness,
        coachingAction: rewrite,
      };
    });

  if (moments.length) return moments.slice(0, 6);

  return [
    {
      id: "replay_placeholder_1",
      label: "Missed opportunity",
      question: "Replay intelligence will appear after a completed interview.",
      answer: "No completed transcript was found yet.",
      insight: "WorkZo needs captured answers to identify best moments, weak moments, and missed opportunities.",
      coachingAction: "Complete one interview and open results again to generate replay intelligence.",
      trustImpact: 0,
    },
  ];
}

function buildCoachSummary(brain: PhaseCCareerBrain, input: PhaseCCareerBrainInput) {
  const role = clean(input.targetRole, "your target role");
  const topWeakness = brain.persistentWeaknesses[0]?.label;
  const topStrength = brain.recurringStrengths[0];
  const probability = brain.probability.current;

  if (topWeakness) {
    return `Your AI Career Coach sees ${topWeakness.toLowerCase()} as the main blocker for ${role}. Current readiness is ${probability}%. This week, focus on proof, ownership, and shorter STAR delivery.`;
  }

  if (topStrength && !/will identify/i.test(topStrength)) {
    return `Your strongest signal is: ${topStrength}. Current readiness is ${probability}%. Premium Pro should now push harder interviews and consistency across CV, cover letter, and job targeting.`;
  }

  return `Your AI Career Coach is ready. Current readiness is ${probability}%. Complete more interviews to personalize priorities, roadmaps, progress trends, and replay intelligence.`;
}

export function buildWorkZoPremiumProSuite(input: PhaseCCareerBrainInput = {}, memory: WorkZoCareerMemory = readCareerMemory()): WorkZoPremiumProSuite {
  const careerBrain = buildCareerBrain(input, memory);
  return {
    coachSummary: buildCoachSummary(careerBrain, input),
    weeklyPriorities: buildWeeklyPriorities(careerBrain, input),
    roadmap: buildRoadmap(careerBrain, input),
    progressTracking: buildProgressTracking(careerBrain),
    replayIntelligence: buildReplayIntelligence(input),
    recruiterChallenges: careerBrain.futureRecruiterChallenges,
    hiringReadiness: {
      current: careerBrain.probability.current,
      afterCv: careerBrain.probability.afterCv,
      afterPrep: careerBrain.probability.afterPrep,
      label: careerBrain.probability.label,
      reasons: careerBrain.probability.reasons,
    },
    careerBrain,
  };
}

export function saveWorkZoPremiumProSuiteSnapshot(input: PhaseCCareerBrainInput = {}) {
  const suite = buildWorkZoPremiumProSuite(input);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem("workzo-premium-pro-suite-v1", JSON.stringify({ ...suite, savedAt: new Date().toISOString() }));
      saveCareerMemory(suite.careerBrain.memory);
    } catch {}
  }
  return suite;
}
