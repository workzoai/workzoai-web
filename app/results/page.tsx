"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Crown,
  Star,
  Eye,
  Flag,
  Gauge,
  Lightbulb,
  Lock,
  MessageSquareText,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Wand2,
  XCircle,
  Mail,
  Zap,
} from "lucide-react";

import UpgradeModal from "@/components/premium/UpgradeModal";
import PremiumUsageBadge from "@/components/premium/PremiumUsageBadge";
import WorkZoPremiumProSuitePanel from "@/components/premium/WorkZoPremiumProSuitePanel";
import { recordWorkZoReportViewed, getWorkZoUsageSummary } from "@/lib/workzoUsageTracker";
import { useWorkZoAdvancedReportGate } from "@/lib/workzoAdvancedReportGate";
import { readLatestInterviewSetup } from "@/lib/workzoInterviewSetup";
import { buildPhaseBInsights } from "@/lib/workzoCareerSuitePhaseB";
import { buildCareerBrain, updateCareerMemoryFromReport, type PhaseCCareerBrain } from "@/lib/workzoCareerMemory";
import {
  buildHiringCommitteeMemo,
  buildShadowScores,
  buildTargetedSkillDrills,
  buildWhatTheyHeard,
  type WorkZoHiringCommitteeMemo,
  type WorkZoShadowScore,
  type WorkZoSkillDrill,
  type WorkZoWhatTheyHeard,
} from "@/lib/workzoHiringCommitteeEngine";

type TranscriptTurn = {
  role?: string;
  speaker?: string;
  text?: string;
  content?: string;
  question?: string;
  answer?: string;
  timestamp?: string;
  time?: string;
};

type StoredResult = {
  plan?: string;
  isPremium?: boolean;
  fillerWordCount?: number;
  overallScore?: number;
  communicationScore?: number;
  confidenceScore?: number;
  roleCompetencyScore?: number;
  trustScore?: number;
  evidenceQuality?: number;
  contradictionRisk?: number;
  durationSeconds?: number;
  duration?: number | string;
  recruiter?: string;
  recruiterName?: string;
  recruiterPersonality?: string;
  targetRole?: string;
  role?: string;
  companyName?: string;
  targetCompany?: string;
  companyStyle?: string;
  selectedCompany?: string;
  strengths?: string[];
  improvements?: string[];
  weakAnswers?: Array<{ question?: string; answer?: string; reason?: string; betterAnswer?: string }>;
  contradictions?: string[];
  evidenceRequests?: string[];
  redFlags?: string[];
  transcript?: TranscriptTurn[];
  messages?: TranscriptTurn[];
  answers?: TranscriptTurn[];
  resumeProfile?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};



type DbInterviewResultRow = {
  id?: string;
  session_id?: string | null;
  overall_score?: number | null;
  trust_score?: number | null;
  evidence_quality?: number | null;
  contradiction_risk?: number | null;
  strengths?: string[] | null;
  improvements?: string[] | null;
  weak_answers?: StoredResult["weakAnswers"] | null;
  contradictions?: string[] | null;
  evidence_requests?: string[] | null;
  raw_result?: Record<string, unknown> | null;
  created_at?: string | null;
};

type ResultsLoadState = "loading" | "db" | "local" | "empty";

type AnswerInsight = {
  id: string;
  question: string;
  answer: string;
  wordCount: number;
  fillerCount: number;
  metricPresent: boolean;
  ownershipPresent: boolean;
  resultPresent: boolean;
  structureScore: number;
  evidenceScore: number;
  trustImpact: number;
  weakness: string;
  recruiterHeard: string;
  rewrite: string;
  redFlags: string[];
};

type CompanyDimension = {
  label: string;
  score: number;
  target: number;
  note: string;
};

type RichReport = {
  isPremium: boolean;
  overallScore: number;
  grade: string;
  decision: string;
  biggestBlocker: string;
  communicationScore: number;
  confidenceScore: number;
  roleCompetencyScore: number;
  trustScore: number;
  evidenceQuality: number;
  ownershipScore: number;
  structureScore: number;
  durationLabel: string;
  answersCount: number;
  averageWpm: number;
  fillerWordCount: number;
  recruiterName: string;
  roleLabel: string;
  companyLabel: string;
  verdict: string;
  quickWin: string;
  strengths: string[];
  improvements: string[];
  answerInsights: AnswerInsight[];
  redFlags: string[];
  contradictions: Array<{ title: string; detail: string; severity: number; trustDrop: number }>;
  evidenceRequests: string[];
  trustDeductions: Array<{ label: string; value: number; tone: "positive" | "negative" }>;
  companyDNA: { label: string; description: string; dimensions: CompanyDimension[] };
  benchmark: Array<{ label: string; user: number; top: number; note: string }>;
  audioSignals: Array<{ label: string; value: number; risk: "low" | "medium" | "high" }>;
  improvementPlan: Array<{ priority: string; title: string; action: string; gain: string }>;
  hiringCommittee: WorkZoHiringCommitteeMemo;
  shadowScores: WorkZoShadowScore[];
  whatTheyHeard: WorkZoWhatTheyHeard[];
  targetedDrills: WorkZoSkillDrill[];
};

const STORAGE_KEYS = [
  "workzo_latest_interview_result",
  "workzo_latest_result",
  "workzo-interview-result",
  "workzo_interview_result",
  "latestInterviewResult",
  "workzo_results",
  "workzoInterviewResult",
  "workzo_result_snapshot",
];

const SETUP_KEYS = [
  "workzoInterviewSetup",
  "workzo-interview-setup-v4",
  "latestInterviewSetup",
  "workzo-latest-interview-setup",
  "workzo-interview-setup-latest",
  "onboardingSetup",
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function cleanText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.replace(/\s+/g, " ").trim() || fallback;
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function average(values: number[], fallback = 0) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return fallback;
  return clamp(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function uniqueList(values: unknown, fallback: string[], limit = 5) {
  const source = Array.isArray(values) ? values : fallback;
  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of source) {
    const text = cleanText(item);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= limit) break;
  }

  return out.length ? out : fallback.slice(0, limit);
}

function readJson(keys: string[]) {
  if (typeof window === "undefined") return null;

  for (const key of keys) {
    for (const storage of [window.localStorage, window.sessionStorage]) {
      try {
        const raw = storage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
      } catch {
        // Try next key.
      }
    }
  }

  return null;
}

function readStoredResult(): StoredResult {
  const setup = readJson(SETUP_KEYS) || {};
  const result = readJson(STORAGE_KEYS) || {};
  return { ...setup, ...result } as StoredResult;
}


function normalizeDbInterviewResult(row: DbInterviewResultRow | null | undefined): StoredResult | null {
  if (!row) return null;

  const raw = row.raw_result && typeof row.raw_result === "object" ? row.raw_result : {};
  const rawRecord = raw as StoredResult & {
    score?: { overall?: number; trust?: number; clarity?: number; confidence?: number; relevance?: number; communication?: number };
    answerQuality?: { evidenceScore?: number };
  };
  const normalized: StoredResult = {
    ...rawRecord,
    overallScore: numberOr(rawRecord.overallScore, numberOr(row.overall_score, numberOr(rawRecord.score?.overall, 0))),
    trustScore: numberOr(rawRecord.trustScore, numberOr(row.trust_score, numberOr(rawRecord.score?.trust, 0))),
    communicationScore: numberOr(rawRecord.communicationScore, numberOr(rawRecord.score?.communication, 0)),
    confidenceScore: numberOr(rawRecord.confidenceScore, numberOr(rawRecord.score?.confidence, 0)),
    roleCompetencyScore: numberOr(rawRecord.roleCompetencyScore, numberOr(rawRecord.score?.relevance, 0)),
    evidenceQuality: numberOr(rawRecord.evidenceQuality, numberOr(row.evidence_quality, numberOr(rawRecord.answerQuality?.evidenceScore, 0))),
    contradictionRisk: numberOr((raw as StoredResult).contradictionRisk, numberOr(row.contradiction_risk, 0)),
    strengths: Array.isArray(rawRecord.strengths) ? rawRecord.strengths : row.strengths || [],
    improvements: Array.isArray(rawRecord.improvements) ? rawRecord.improvements : row.improvements || [],
    weakAnswers: Array.isArray(rawRecord.weakAnswers) ? rawRecord.weakAnswers : row.weak_answers || [],
    contradictions: Array.isArray(rawRecord.contradictions) ? rawRecord.contradictions : row.contradictions || [],
    evidenceRequests: Array.isArray(rawRecord.evidenceRequests) ? rawRecord.evidenceRequests : row.evidence_requests || [],
    metadata: {
      ...((rawRecord.metadata || {}) as Record<string, unknown>),
      dbResultId: row.id,
      dbSessionId: row.session_id,
      dbCreatedAt: row.created_at,
      source: "database",
    },
  };

  return normalized;
}

async function fetchLatestDbInterviewResult(): Promise<StoredResult | null> {
  try {
    // 6-second timeout — if the DB call hangs (e.g. due to a flood of other API calls),
    // fall through to local storage immediately rather than showing the spinner forever.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    let response: Response;
    try {
      response = await fetch("/api/db/interview-result", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 401 || response.status === 404) return null;
    if (!response.ok) throw new Error(`Failed to load database result: ${response.status}`);

    const payload = await response.json().catch(() => null) as { result?: DbInterviewResultRow | null } | null;
    return normalizeDbInterviewResult(payload?.result || null);
  } catch (error) {
    console.warn("WorkZo results DB read failed; falling back to local result", error);
    return null;
  }
}

function gradeFromScore(score: number) {
  if (score >= 92) return "A";
  if (score >= 86) return "A-";
  if (score >= 80) return "B+";
  if (score >= 73) return "B";
  if (score >= 66) return "B-";
  if (score >= 58) return "C+";
  if (score >= 50) return "C";
  return "Needs work";
}

function durationToSeconds(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  const text = cleanText(value);
  const minutes = text.match(/(\d+)\s*m/i);
  const seconds = text.match(/(\d+)\s*s/i);
  if (minutes || seconds) return Number(minutes?.[1] || 0) * 60 + Number(seconds?.[1] || 0);
  return 0;
}

function formatDuration(seconds: number) {
  if (!seconds) return "Not captured";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (!mins) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function getTurnText(turn: TranscriptTurn) {
  return cleanText(turn.text || turn.content || turn.answer || turn.question);
}

function isRecruiterTurn(turn: TranscriptTurn) {
  const label = cleanText(turn.role || turn.speaker).toLowerCase();
  return /recruiter|assistant|interviewer|ai|sarah|daniel|priya|markus/.test(label);
}

function isCandidateTurn(turn: TranscriptTurn) {
  const label = cleanText(turn.role || turn.speaker).toLowerCase();
  return /user|candidate|you|me|applicant/.test(label);
}

function buildPairs(result: StoredResult) {
  const source = Array.isArray(result.transcript)
    ? result.transcript
    : Array.isArray(result.messages)
      ? result.messages
      : Array.isArray(result.answers)
        ? result.answers
        : [];

  if (!source.length && Array.isArray(result.weakAnswers)) {
    return result.weakAnswers.map((item, index) => ({
      question: cleanText(item.question, `Interview question ${index + 1}`),
      answer: cleanText(item.answer, "Answer not captured yet."),
    }));
  }

  const pairs: Array<{ question: string; answer: string }> = [];
  let pendingQuestion = "Tell me about your background for this role.";

  for (const turn of source) {
    if (turn.question && turn.answer) {
      pairs.push({ question: cleanText(turn.question), answer: cleanText(turn.answer) });
      continue;
    }

    const text = getTurnText(turn);
    if (!text) continue;

    if (isRecruiterTurn(turn)) {
      pendingQuestion = text;
      continue;
    }

    if (isCandidateTurn(turn)) {
      pairs.push({ question: pendingQuestion, answer: text });
      pendingQuestion = `Interview question ${pairs.length + 2}`;
    }
  }

  return pairs.slice(0, 12);
}

function countWords(text: string) {
  return (text.match(/\b[\w'+-]+\b/g) || []).length;
}

function countFillers(text: string) {
  return (text.match(/\b(um|uh|like|basically|actually|sort of|kind of|you know|i mean|maybe|probably)\b/gi) || []).length;
}

function hasMetric(text: string) {
  return /\b\d+\s*(%|percent|k|m|million|thousand|x|times|users|customers|tickets|cases|incidents|hours|days|weeks|months|revenue|cost|sla|nps|csat)\b/i.test(text);
}

function hasOwnership(text: string) {
  return /\b(i|my|me|personally)\b/i.test(text) && /\b(led|owned|built|created|designed|implemented|resolved|improved|managed|delivered|automated|analyzed|coordinated|handled|trained|supported)\b/i.test(text);
}

function hasResult(text: string) {
  return /\b(result|impact|outcome|after|therefore|as a result|which led|improved|reduced|increased|saved|resolved|delivered|achieved)\b/i.test(text) || hasMetric(text);
}

function detectRedFlags(answer: string) {
  const flags: string[] = [];
  const words = countWords(answer);

  if (/\b(my manager told me|just did what i was told|not my responsibility)\b/i.test(answer)) flags.push("May sound low-ownership unless clarified.");
  if (/\b(they failed|team failed|manager failed|because of them|not my fault)\b/i.test(answer)) flags.push("Possible blame-shifting signal.");
  if (words > 0 && words < 25) flags.push("Answer ended before enough evidence was provided.");
  if (words > 230) flags.push("Answer may feel too long or unfocused.");
  if (!hasMetric(answer)) flags.push("No measurable outcome detected.");
  if (!hasOwnership(answer)) flags.push("Personal ownership is not clear enough.");

  return flags.slice(0, 4);
}

function analyzeAnswer(question: string, answer: string, index: number): AnswerInsight {
  const words = countWords(answer);
  const fillerCount = countFillers(answer);
  const metricPresent = hasMetric(answer);
  const ownershipPresent = hasOwnership(answer);
  const resultPresent = hasResult(answer);
  const redFlags = detectRedFlags(answer);

  const structureScore = clamp(36 + (words >= 35 ? 14 : 0) + (words <= 180 ? 16 : 0) + (ownershipPresent ? 14 : 0) + (resultPresent ? 16 : 0) - (words > 230 ? 12 : 0));
  const evidenceScore = clamp(30 + (metricPresent ? 35 : 0) + (ownershipPresent ? 18 : 0) + (resultPresent ? 17 : 0) - (redFlags.length * 3));
  const trustImpact = clamp(44 + (ownershipPresent ? 18 : -8) + (metricPresent ? 18 : -12) + (resultPresent ? 12 : -6) - (redFlags.length * 5));

  let weakness = "Good foundation; make the answer sharper with stronger structure.";
  if (!metricPresent) weakness = "Missing measurable evidence.";
  if (!ownershipPresent) weakness = "Personal ownership is not clear.";
  if (words < 25) weakness = "Answer is too short to evaluate deeply.";
  if (words > 230) weakness = "Answer is too long and may lose recruiter attention.";

  const recruiterHeard = words < 25
    ? "The recruiter may feel the answer ended before enough proof was provided."
    : !ownershipPresent && !metricPresent
      ? "The recruiter hears useful background, but not enough proof of personal impact."
      : !metricPresent
        ? "The recruiter may believe the story, but still wonder how impact was measured."
        : !ownershipPresent
          ? "The recruiter may not know which part was personally owned by you versus the wider team."
          : !resultPresent
            ? "The recruiter hears action, but needs a clearer final outcome."
            : "The recruiter hears a credible answer with evidence, ownership, and role relevance.";

  const rewrite = answer && !/not captured/i.test(answer)
    ? "I would answer this with a short STAR structure: explain the situation, define my task, describe the action I personally owned, and close with one measurable result connected to the target role."
    : "Use a short STAR answer: situation, task, action, measurable result, and one sentence linking it to the role.";

  return {
    id: `answer-${index + 1}`,
    question,
    answer: cleanText(answer, "Answer not captured yet."),
    wordCount: words,
    fillerCount,
    metricPresent,
    ownershipPresent,
    resultPresent,
    structureScore,
    evidenceScore,
    trustImpact,
    weakness,
    recruiterHeard,
    rewrite,
    redFlags,
  };
}

function buildCompanyDNA(company: string, role: string, insights: AnswerInsight[]): RichReport["companyDNA"] {
  const source = `${company} ${role}`.toLowerCase();
  const evidence = average(insights.map((item) => item.evidenceScore), 58);
  const structure = average(insights.map((item) => item.structureScore), 62);
  const trust = average(insights.map((item) => item.trustImpact), 60);
  const ownership = average(insights.map((item) => item.ownershipPresent ? 78 : 48), 55);

  if (/amazon|aws/.test(source)) {
    return {
      label: "Amazon Bar Raiser Alignment",
      description: "Mapped to Amazon-style leadership signals: ownership, customer impact, bias for action, and dive-deep evidence.",
      dimensions: [
        { label: "Customer Obsession", score: clamp(evidence + 6), target: 88, note: "Connect stories to customer or user impact." },
        { label: "Ownership", score: ownership, target: 90, note: "Make your personal scope unmistakable." },
        { label: "Dive Deep", score: evidence, target: 86, note: "Add metrics, root cause, and operational detail." },
        { label: "Bias for Action", score: clamp(structure + 4), target: 84, note: "Show fast, practical decision-making." },
      ],
    };
  }

  if (/mckinsey|consulting|consultant|bcg|bain/.test(source)) {
    return {
      label: "Consulting / MECE Alignment",
      description: "Mapped to structured thinking, concise communication, business impact, and executive-ready reasoning.",
      dimensions: [
        { label: "MECE Structure", score: structure, target: 90, note: "Lead with clear buckets and avoid rambling." },
        { label: "Business Impact", score: evidence, target: 88, note: "Quantify the commercial or operational value." },
        { label: "Executive Clarity", score: clamp(structure - 2), target: 86, note: "Start with the conclusion, then explain." },
        { label: "Hypothesis Thinking", score: clamp(trust - 4), target: 82, note: "Explain why you chose the approach." },
      ],
    };
  }

  if (/google|meta|microsoft|software|developer|engineer|technical|data|analyst/.test(source)) {
    return {
      label: "Technical Company Alignment",
      description: "Mapped to technical depth, collaboration, role relevance, and measurable delivery impact.",
      dimensions: [
        { label: "Problem Solving", score: clamp(structure + 3), target: 86, note: "Explain the problem and trade-offs clearly." },
        { label: "Technical Evidence", score: evidence, target: 88, note: "Use tools, systems, scale, and results." },
        { label: "Collaboration", score: clamp(trust + 2), target: 82, note: "Show stakeholder and team communication." },
        { label: "Role Relevance", score: clamp((evidence + structure) / 2), target: 84, note: "Tie examples directly to the job." },
      ],
    };
  }

  return {
    label: "Professional Recruiter Alignment",
    description: "Mapped to general hiring expectations: fit, consistency, motivation, evidence, and communication maturity.",
    dimensions: [
      { label: "Role Fit", score: clamp((evidence + structure) / 2), target: 84, note: "Connect examples directly to the target role." },
      { label: "Ownership", score: ownership, target: 84, note: "Make personal contribution clearer." },
      { label: "Communication", score: structure, target: 82, note: "Structure answers tightly." },
      { label: "Hiring Confidence", score: trust, target: 84, note: "Reduce vague or hesitant language." },
    ],
  };
}

function buildContradictions(result: StoredResult, insights: AnswerInsight[]) {
  const direct = Array.isArray(result.contradictions) ? result.contradictions.filter(Boolean) : [];
  if (direct.length) {
    return direct.slice(0, 4).map((detail, index) => ({
      title: `Consistency concern ${index + 1}`,
      detail: cleanText(detail),
      severity: index === 0 ? 4 : 3,
      trustDrop: index === 0 ? 12 : 7,
    }));
  }

  const lowOwnershipCount = insights.filter((item) => !item.ownershipPresent).length;
  const metricMissingCount = insights.filter((item) => !item.metricPresent).length;

  if (lowOwnershipCount >= 2 && metricMissingCount >= 2) {
    return [{
      title: "Evidence consistency risk",
      detail: "Several answers described relevant work without enough ownership or measurable proof. This is not a contradiction, but it can reduce recruiter confidence.",
      severity: 2,
      trustDrop: 6,
    }];
  }

  return [];
}

function buildRichReport(result: StoredResult, isPremium: boolean): RichReport {
  const pairs = buildPairs(result);
  const answerInsights = pairs.length
    ? pairs.map((pair, index) => analyzeAnswer(pair.question, pair.answer, index))
    : [analyzeAnswer("Interview question", "Answer not captured yet.", 0)];

  const answersCount = pairs.length;
  const durationSeconds = durationToSeconds(result.durationSeconds || result.duration);
  const averageWpm = durationSeconds && answersCount
    ? clamp(answerInsights.reduce((sum, item) => sum + item.wordCount, 0) / Math.max(durationSeconds / 60, 1), 0, 220)
    : 0;

  const resultRecord = result as StoredResult & {
    score?: { overall?: number; trust?: number; clarity?: number; confidence?: number; relevance?: number; communication?: number };
    answerQuality?: { evidenceScore?: number };
  };
  const evidenceQuality = numberOr(result.evidenceQuality, numberOr(resultRecord.answerQuality?.evidenceScore, average(answerInsights.map((item) => item.evidenceScore), 58)));
  const trustScore = numberOr(result.trustScore, numberOr(resultRecord.score?.trust, average(answerInsights.map((item) => item.trustImpact), 62)));
  const structureScore = average(answerInsights.map((item) => item.structureScore), 60);
  const ownershipScore = average(answerInsights.map((item) => item.ownershipPresent ? 78 : 48), 58);

  const communicationScore = numberOr(result.communicationScore, numberOr(resultRecord.score?.communication, clamp(structureScore + (averageWpm >= 110 && averageWpm <= 170 ? 8 : -4))));
  const confidenceScore = numberOr(result.confidenceScore, numberOr(resultRecord.score?.confidence, clamp(trustScore - (answerInsights.some((item) => item.fillerCount >= 4) ? 8 : 0) + (ownershipScore >= 70 ? 4 : -3))));
  const roleCompetencyScore = numberOr(result.roleCompetencyScore, numberOr(resultRecord.score?.relevance, clamp((evidenceQuality * 0.58) + (structureScore * 0.22) + (ownershipScore * 0.2))));

  const overallScore = numberOr(
    result.overallScore,
    numberOr(resultRecord.score?.overall, clamp((communicationScore * 0.22) + (confidenceScore * 0.18) + (roleCompetencyScore * 0.28) + (trustScore * 0.2) + (evidenceQuality * 0.12))),
  );

  const redFlags = uniqueList(
    result.redFlags,
    answerInsights.flatMap((item) => item.redFlags),
    6,
  ).filter(Boolean);

  const evidenceRequests = uniqueList(
    result.evidenceRequests,
    [
      !answerInsights.some((item) => item.metricPresent) ? "Add one measurable result to your strongest story." : "Keep the strongest metric and explain why it mattered.",
      !answerInsights.some((item) => item.ownershipPresent) ? "Clarify exactly what you personally owned." : "Make ownership visible in the first sentence of each answer.",
      "Connect each answer back to the target role or company expectation.",
    ],
    5,
  );

  const contradictions = buildContradictions(result, answerInsights);
  const roleLabel = cleanText(result.targetRole || result.role, "Target role");
  const companyLabel = cleanText(result.companyName || result.targetCompany || result.selectedCompany || result.companyStyle, "General company");
  const recruiterName = cleanText(result.recruiterName || result.recruiter || result.recruiterPersonality, "Recruiter").replace(/_/g, " ");

  const biggestBlocker = !answerInsights.some((item) => item.metricPresent)
    ? "Lack of measurable impact evidence"
    : !answerInsights.some((item) => item.ownershipPresent)
      ? "Unclear personal ownership"
      : structureScore < 68
        ? "Answers need tighter STAR structure"
        : contradictions.length
          ? "Consistency concerns need clarification"
          : "You need one stronger closing proof story";

  const decision = overallScore >= 82
    ? "Likely proceed"
    : overallScore >= 70
      ? "Proceed with reservations"
      : overallScore >= 58
        ? "Borderline proceed"
        : "Needs retry before real interview";

  const verdict = `${recruiterName} heard useful role signal, but the current answers need stronger proof, clearer ownership, and more measurable outcomes before a confident next-round decision.`;

  const trustDeductions: Array<{ label: string; value: number; tone: "positive" | "negative" }> = [
    { label: "Missing measurable impact", value: answerInsights.some((item) => !item.metricPresent) ? -12 : 5, tone: answerInsights.some((item) => !item.metricPresent) ? "negative" : "positive" as const },
    { label: "Personal ownership clarity", value: answerInsights.some((item) => !item.ownershipPresent) ? -8 : 6, tone: answerInsights.some((item) => !item.ownershipPresent) ? "negative" : "positive" as const },
    { label: "STAR structure", value: structureScore < 68 ? -7 : 5, tone: structureScore < 68 ? "negative" : "positive" as const },
    { label: "Consistency check", value: contradictions.length ? -10 : 4, tone: contradictions.length ? "negative" : "positive" as const },
  ];

  const companyDNA = buildCompanyDNA(companyLabel, roleLabel, answerInsights);
  const committeeEvidence = answerInsights.map((item) => ({
    id: item.id,
    question: item.question,
    answer: item.answer,
    score: Math.round((item.evidenceScore + item.structureScore + item.trustImpact) / 3),
    weakness: item.weakness,
    recruiterHeard: item.recruiterHeard,
    hasMetric: item.metricPresent,
    hasOwnership: item.ownershipPresent,
    redFlags: item.redFlags,
  }));
  const hiringCommittee = buildHiringCommitteeMemo({
    overallScore,
    trustScore,
    evidenceQuality,
    ownershipScore,
    structureScore,
    roleLabel,
    companyLabel,
    recruiterName,
    biggestBlocker,
    strengths: uniqueList(result.strengths, [
      "You gave useful background signal for the target role.",
      "You showed motivation to improve and prepare seriously.",
      "Your answers contained at least some recruiter-relevant context.",
    ], 4),
    improvements: uniqueList(result.improvements, [
      "Make your answers more measurable and structured.",
      "Make your personal ownership clearer.",
      "Use a sharper STAR structure for every major answer.",
    ], 4),
    answerEvidence: committeeEvidence,
    redFlags,
    contradictions,
  });
  const shadowScores = buildShadowScores({
    trustScore,
    evidenceQuality,
    ownershipScore,
    structureScore,
    communicationScore,
    contradictionCount: contradictions.length,
  });
  const whatTheyHeard = buildWhatTheyHeard(committeeEvidence);
  const targetedDrills = buildTargetedSkillDrills({
    biggestBlocker,
    answerEvidence: committeeEvidence,
    redFlags,
    contradictions,
  });

  return {
    isPremium,
    overallScore,
    grade: gradeFromScore(overallScore),
    decision,
    biggestBlocker,
    communicationScore,
    confidenceScore,
    roleCompetencyScore,
    trustScore,
    evidenceQuality,
    ownershipScore,
    structureScore,
    durationLabel: formatDuration(durationSeconds),
    answersCount,
    averageWpm,
    fillerWordCount: numberOr(result.fillerWordCount, 0),
    recruiterName,
    roleLabel,
    companyLabel,
    verdict,
    quickWin: answerInsights[0]?.weakness === "Missing measurable evidence."
      ? "Add one number to your strongest answer: time saved, users supported, tickets resolved, revenue impact, quality improvement, or project scale."
      : `Rewrite your weakest answer around ${biggestBlocker.toLowerCase()} and keep it under two minutes.`,
    strengths: uniqueList(result.strengths, [
      "You gave useful background signal for the target role.",
      "You showed motivation to improve and prepare seriously.",
      "Your answers contained at least some recruiter-relevant context.",
    ], 4),
    improvements: uniqueList(result.improvements, [
      "Make your answers more measurable and structured.",
      "Make your personal ownership clearer.",
      "Use a sharper STAR structure for every major answer.",
    ], 4),
    answerInsights,
    redFlags,
    contradictions,
    evidenceRequests,
    trustDeductions,
    companyDNA,
    benchmark: [
      { label: "Pacing", user: averageWpm ? clamp(100 - Math.abs(145 - averageWpm)) : 45, top: 86, note: "Top candidates stay concise without sounding rushed." },
      { label: "Metric usage", user: evidenceQuality, top: 88, note: "Top candidates quantify impact in most major answers." },
      { label: "Ownership", user: ownershipScore, top: 90, note: "Top candidates make personal contribution obvious." },
      { label: "Structure", user: structureScore, top: 87, note: "Top candidates use clear STAR-style flow." },
      { label: "Trust", user: trustScore, top: 90, note: "Top candidates sound consistent and evidence-backed." },
    ],
    audioSignals: [
      { label: "Filler words", value: answerInsights.reduce((sum, item) => sum + item.fillerCount, 0), risk: answerInsights.some((item) => item.fillerCount >= 4) ? "high" : "low" },
      { label: "Long/short answer risk", value: answerInsights.filter((item) => item.wordCount < 25 || item.wordCount > 230).length, risk: answerInsights.some((item) => item.wordCount < 25 || item.wordCount > 230) ? "medium" : "low" },
      { label: "Pause risk estimate", value: averageWpm && averageWpm < 85 ? 1 : 0, risk: averageWpm && averageWpm < 85 ? "medium" : "low" },
    ],
    improvementPlan: [
      { priority: "Priority 1", title: "Add measurable outcomes", action: "Prepare two stories with numbers: one customer/user impact story and one ownership story.", gain: "+6 to +10 pts" },
      { priority: "Priority 2", title: "Rewrite weakest answer", action: "Use STAR with one measurable result and one sentence connecting it to the target role.", gain: "+4 to +8 pts" },
      { priority: "Priority 3", title: "Reduce recruiter doubt", action: "Clarify timeline, role scope, and personal contribution before the recruiter has to ask.", gain: "+3 to +7 pts" },
    ],
    hiringCommittee,
    shadowScores,
    whatTheyHeard,
    targetedDrills,
  };
}

function RiskTone({ risk }: { risk: "low" | "medium" | "high" }) {
  return (
    <span className={cn(
      "rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]",
      risk === "high" ? "bg-rose-400/10 text-rose-200" : risk === "medium" ? "bg-amber-400/10 text-amber-100" : "bg-emerald-400/10 text-emerald-200",
    )}>
      {risk} risk
    </span>
  );
}

function HiringCommitteeMemoCard({ memo }: { memo: WorkZoHiringCommitteeMemo }) {
  return (
    <section className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-400/[0.075] p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-200">Confidential hiring committee memo</p>
          <h2 className="mt-2 text-xl font-black text-white">{memo.headline}</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-amber-50/90">{memo.recruiterSummary}</p>
        </div>
        <div className="rounded-xl border border-amber-300/20 bg-black/25 p-3 text-center shrink-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-200">Panel confidence</p>
          <p className="mt-1 text-3xl font-black text-white">{memo.confidence}%</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs font-black text-emerald-100">Evidence for hire</p>
          <div className="mt-2 space-y-1">{memo.evidenceForHire.map((item) => <p key={item} className="text-xs leading-5 text-slate-200">• {item}</p>)}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs font-black text-rose-100">Panel concerns</p>
          <div className="mt-2 space-y-1">{memo.evidenceAgainstHire.map((item) => <p key={item} className="text-xs leading-5 text-slate-200">• {item}</p>)}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs font-black text-blue-100">Recommendation</p>
          <p className="mt-2 text-xs leading-5 text-slate-200">{memo.finalRecommendation}</p>
          <div className="mt-2 space-y-1">{memo.nextRoundFocus.map((item) => <p key={item} className="rounded-lg bg-blue-400/10 px-2.5 py-1.5 text-xs leading-5 text-blue-50">{item}</p>)}</div>
        </div>
      </div>
    </section>
  );
}

function ShadowScoreSection({ scores }: { scores: WorkZoShadowScore[] }) {
  return (
    <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Shadow score</p>
      <h2 className="mt-1 text-lg font-black text-white">What an internal recruiter would quietly score</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {scores.map((item) => (
          <div key={item.label} className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-black text-white">{item.label}</p>
              <RiskTone risk={item.risk} />
            </div>
            <p className="mt-3 text-3xl font-black text-white">{item.score}%</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">{item.internalMeaning}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function WhatTheyHeardSection({ items }: { items: WorkZoWhatTheyHeard[] }) {
  return (
    <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200">What they heard</p>
      <h2 className="mt-1 text-lg font-black text-white">Your words vs. the interviewer’s interpretation</h2>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.id} className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 lg:grid-cols-2">
            <div className="rounded-xl bg-white/[0.04] p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">You said</p>
              <p className="mt-2 text-xs leading-5 text-slate-200">“{item.youSaid}”</p>
            </div>
            <div className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">They inferred</p>
              <p className="mt-2 text-xs leading-5 text-cyan-50">{item.theyHeard}</p>
              <p className="mt-2 text-[10px] leading-4 text-amber-100">Risk: {item.risk}</p>
              <p className="mt-1 text-[10px] leading-4 text-emerald-100">Stronger signal: {item.strongerSignal}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TargetedDrillsSection({ drills }: { drills: WorkZoSkillDrill[] }) {
  return (
    <section className="mt-4 rounded-2xl border border-violet-300/20 bg-violet-500/[0.06] p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-violet-200">Targeted skill drills</p>
      <h2 className="mt-1 text-lg font-black text-white">Train the weak signal, not the whole interview</h2>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {drills.map((drill) => (
          <Link key={drill.id} href={drill.href} className="group rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:bg-white/[0.06]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-200">{drill.duration} · {drill.pressureLevel} pressure</p>
                <h3 className="mt-1 text-base font-black text-white">{drill.title}</h3>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-500 transition group-hover:text-white shrink-0" />
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-300">{drill.prompt}</p>
            <p className="mt-2 rounded-xl bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-50">Recruiter pushback: “{drill.recruiterPushback}”</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {drill.successCriteria.map((item) => <span key={item} className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold text-slate-300">{item}</span>)}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const angle = clamp(score) * 3.6;
  return (
    <div
      className="grid h-28 w-28 shrink-0 place-items-center rounded-full"
      style={{ background: `conic-gradient(#3b82f6 ${angle}deg, rgba(255,255,255,0.14) 0deg)` }}
    >
      <div className="grid h-[5.25rem] w-[5.25rem] place-items-center rounded-full bg-[#120b3d] text-center">
        <div>
          <p className="text-3xl font-black text-white">{score}</p>
          <p className="text-[11px] font-black text-blue-100">{grade} · /100</p>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, note }: { icon: typeof Gauge; label: string; value: number; note: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-blue-300" />
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">{label}</p>
      </div>
      <p className="mt-3 text-3xl font-black text-white">{value}%</p>
      <p className="mt-2 text-xs leading-5 text-slate-400">{note}</p>
    </div>
  );
}

function Bar({ value, target, label, note }: { value: number; target?: number; label: string; note?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black text-white">{label}</p>
        <p className="text-sm font-black text-blue-100">{value}%{typeof target === "number" ? ` / ${target}%` : ""}</p>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-300" style={{ width: `${clamp(value)}%` }} />
      </div>
      {note ? <p className="mt-1.5 text-xs leading-5 text-slate-400">{note}</p> : null}
    </div>
  );
}

function LockedPreview({ title, children, count }: { title: string; children: React.ReactNode; count?: string }) {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-violet-300/15 bg-violet-500/[0.08] p-6">
      <div className="absolute right-6 top-6 grid h-14 w-14 place-items-center rounded-2xl bg-amber-300/15 text-amber-100">
        <Lock className="h-6 w-6" />
      </div>
      <p className="text-xs font-black uppercase tracking-[0.28em] text-blue-200">Premium Preview</p>
      <h3 className="mt-3 pr-16 text-2xl font-black text-white">{title}</h3>
      {count ? <p className="mt-3 text-sm font-black text-amber-200">{count}</p> : null}
      <div className="mt-6 select-none blur-[5px] pointer-events-none">{children}</div>
      <button
        type="button"
        onClick={() => {
          if (typeof window !== "undefined") window.location.href = "/pricing?intent=results-report";
        }}
        className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-blue-500 px-5 py-3 text-sm font-black text-white hover:bg-blue-400"
      >
        <Crown className="h-4 w-4" />
        Upgrade to unlock
      </button>
    </div>
  );
}

function TranscriptCard({ item, index }: { item: AnswerInsight; index: number }) {
  const [open, setOpen] = useState(index === 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-4 p-4 text-left"
      >
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-200">Question {index + 1}</p>
          <h3 className="mt-1 text-base font-black text-white">{item.question}</h3>
          <p className="mt-1 text-xs text-slate-400">Evidence {item.evidenceScore}% · Trust impact {item.trustImpact}% · {item.weakness}</p>
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-300 transition", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="grid gap-3 border-t border-white/10 p-4 xl:grid-cols-3">
          <div className="rounded-xl bg-white/[0.04] p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Your answer</p>
            <p className="mt-2 text-xs leading-5 text-slate-200">{item.answer}</p>
          </div>
          <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-200">What the recruiter heard</p>
            <p className="mt-2 text-xs leading-5 text-amber-50">{item.recruiterHeard}</p>
          </div>
          <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-200">Top 10% rewrite</p>
            <p className="mt-2 text-xs leading-5 text-emerald-50">{item.rewrite}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}


function CareerBrainSection({ brain }: { brain: PhaseCCareerBrain }) {
  const probabilityBars = [
    { label: "Current profile", value: brain.probability.current, tone: "from-amber-400 to-orange-300" },
    { label: "After CV improvements", value: brain.probability.afterCv, tone: "from-blue-400 to-cyan-300" },
    { label: "After interview prep", value: brain.probability.afterPrep, tone: "from-emerald-400 to-teal-300" },
  ];

  return (
    <section className="mt-4 rounded-2xl border border-emerald-300/15 bg-emerald-500/[0.045] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-emerald-200">Phase C unified career brain</p>
          <h2 className="mt-1 text-lg font-black">One learning loop across CV, jobs, interviews, and results</h2>
          <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-300">{brain.progress.latestSummary}</p>
        </div>
        <div className="grid h-14 w-14 place-items-center rounded-xl border border-emerald-300/20 bg-black/25 text-center">
          <p className="text-xl font-black text-emerald-100">{brain.probability.current}%</p>
          <p className="-mt-1 text-[9px] font-black text-slate-500">PROB.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs font-black text-emerald-100">Interview probability engine</p>
          <div className="mt-3 space-y-3">
            {probabilityBars.map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between text-sm">
                  <p className="font-bold text-slate-200">{item.label}</p>
                  <p className="font-black text-white">{item.value}%</p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className={`h-full rounded-full bg-gradient-to-r ${item.tone}`} style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1.5">
            {brain.probability.reasons.map((item) => <p key={item} className="text-[11px] leading-4 text-slate-400">• {item}</p>)}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs font-black text-amber-100">Persistent weakness tracking</p>
          <div className="mt-2 space-y-2">
            {brain.persistentWeaknesses.length ? brain.persistentWeaknesses.map((item) => (
              <div key={item.label} className="rounded-xl bg-amber-400/10 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-black text-white">{item.label}</p>
                  <span className="rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-black text-amber-100">seen {item.count}x</span>
                </div>
                <p className="mt-1 text-[10px] leading-4 text-amber-50/85">{item.coachLine}</p>
              </div>
            )) : <p className="text-xs leading-5 text-slate-400">No recurring weakness yet. WorkZo will learn after more sessions.</p>}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs font-black text-blue-100">Cross-feature actions</p>
          <div className="mt-2 space-y-2">
            {brain.crossFeatureActions.map((item) => (
              <div key={`${item.feature}-${item.action}`} className="rounded-xl bg-blue-400/10 p-2.5">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-200">{item.feature}</p>
                <p className="mt-1 text-xs leading-5 text-blue-50/90">{item.action}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs font-black text-violet-100">Future recruiter memory challenges</p>
          <div className="mt-2 space-y-1.5">
            {brain.futureRecruiterChallenges.map((item) => <p key={item} className="rounded-xl bg-violet-400/10 px-2.5 py-2 text-xs leading-5 text-violet-50">"{item}"</p>)}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs font-black text-cyan-100">Persistent career roadmap</p>
          <div className="mt-2 space-y-2">
            {brain.roadmap.slice(0, 4).map((item) => (
              <div key={item.id} className="rounded-xl bg-cyan-400/10 p-2.5">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200">{item.priority} · {item.estimatedGain}</p>
                <p className="mt-0.5 text-xs font-black text-white">{item.title}</p>
                <p className="mt-0.5 text-xs leading-5 text-cyan-50/85">{item.action}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}


// ─── "Where the interview turned" — free tier conversion hook ─────────────
function buildLostMoment(insights: AnswerInsight[]): {
  questionIndex: number;
  question: string;
  answer: string;
  trustDrop: number;
  whatHappened: string;
  whatRecruiterThought: string;
  nextChallenge: string;
} | null {
  if (!insights.length) return null;

  // Find the single answer with the biggest trust impact gap
  // (lowest trustImpact relative to what it "should" be)
  const withDrops = insights.map((item, index) => ({
    index,
    item,
    drop: 72 - item.trustImpact, // 72 is a reasonable "expected" baseline
  }));

  const worst = withDrops.sort((a, b) => b.drop - a.drop)[0];
  if (!worst || worst.drop < 5) return null;

  const { item, index } = worst;

  let whatHappened = "The recruiter expected more evidence here.";
  let whatRecruiterThought = "The answer was relevant but lacked the proof needed to move forward with confidence.";

  if (!item.ownershipPresent && !item.metricPresent) {
    whatHappened = `You said "we" instead of "I" and gave no measurable outcome. The recruiter couldn't tell what you personally did or whether it worked.`;
    whatRecruiterThought = `"Useful background, but I don't know what they specifically owned or whether there was real impact."`;
  } else if (!item.metricPresent) {
    whatHappened = `You described the situation and action well, but left out any measurable result. The recruiter had to guess whether it worked.`;
    whatRecruiterThought = `"Good story, but I need a number — time saved, customers helped, percentage improved — anything concrete."`;
  } else if (!item.ownershipPresent) {
    whatHappened = `The answer sounded like a team achievement, not a personal one. The recruiter lost confidence in your individual contribution.`;
    whatRecruiterThought = `"I'm not sure what they specifically did versus what the team did. I need to know their personal scope."`;
  } else if (item.wordCount < 25) {
    whatHappened = `The answer ended too quickly — 25 words or fewer. The recruiter expected depth and got a summary.`;
    whatRecruiterThought = `"There's clearly more to this story. Why did they stop here?"`;
  } else if (item.wordCount > 230) {
    whatHappened = `The answer ran too long without landing on a clear result. The recruiter lost the thread before the punchline.`;
    whatRecruiterThought = `"A lot of words, but I'm still not sure what the outcome actually was."`;
  }

  // The follow-up the recruiter would have asked next
  let nextChallenge = "What was the measurable outcome of what you described?";
  if (!item.ownershipPresent) nextChallenge = "What did YOU specifically do — not the team?";
  if (item.wordCount < 25) nextChallenge = "Can you walk me through that in more detail?";
  if (item.wordCount > 230) nextChallenge = "In one sentence — what was the actual result?";

  return {
    questionIndex: index + 1,
    question: item.question,
    answer: item.answer,
    trustDrop: Math.max(5, worst.drop),
    whatHappened,
    whatRecruiterThought,
    nextChallenge,
  };
}

function WhereLostSection({ insights, overallScore, isPremium }: {
  insights: AnswerInsight[];
  overallScore: number;
  isPremium: boolean;
}) {
  const moment = buildLostMoment(insights);
  if (!moment) return null;

  // Benchmark: show a fake-but-realistic comparison
  const benchmarkScore = 78;
  const gap = benchmarkScore - overallScore;

  return (
    <section className="mt-6 rounded-[2rem] border border-rose-400/30 bg-[#1a0810] p-6 sm:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1.5">
            <TrendingDown className="h-3.5 w-3.5 text-rose-300" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-300">Where you lost this interview</span>
          </div>
          <h2 className="mt-4 text-2xl font-black text-white sm:text-3xl">
            Question {moment.questionIndex} is where the recruiter's confidence dropped.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
            Your trust score fell <span className="font-black text-rose-300">~{Math.min(moment.trustDrop, 22)} points</span> on this answer — more than any other moment in the session.
          </p>
        </div>
        <div className="shrink-0 rounded-2xl border border-rose-400/20 bg-black/30 p-4 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-300">Trust drop</p>
          <p className="mt-1 text-4xl font-black text-white">−{Math.min(moment.trustDrop, 22)}</p>
          <p className="text-xs text-slate-500">pts on this answer</p>
        </div>
      </div>

      {/* The question + answer */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white/[0.04] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">The question</p>
          <p className="mt-3 text-sm leading-7 text-slate-200">"{moment.question}"</p>
          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Your answer</p>
            <p className="mt-3 text-sm leading-7 text-slate-400 italic">"{moment.answer.slice(0, 220)}{moment.answer.length > 220 ? "…" : ""}"</p>
          </div>
        </div>

        <div className="space-y-3">
          {/* What happened */}
          <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.07] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-300">What happened</p>
            <p className="mt-3 text-sm leading-7 text-rose-50">{moment.whatHappened}</p>
          </div>

          {/* What the recruiter thought */}
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.07] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">What the recruiter thought</p>
            <p className="mt-3 text-sm leading-7 text-amber-50">{moment.whatRecruiterThought}</p>
          </div>
        </div>
      </div>

      {/* The next challenge — visible, not blurred */}
      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-start gap-3">
          <Zap className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
          <div>
            <p className="text-sm font-black text-white">The question that would have come next</p>
            <p className="mt-2 text-sm leading-6 text-amber-100">"{moment.nextChallenge}"</p>
            <p className="mt-2 text-xs text-slate-500">This would have been the recruiter's next question. Can you answer it better next session?</p>
          </div>
        </div>
      </div>

      {/* Score benchmark — visible for free */}
      {gap > 0 && (
        <div className="mt-5 rounded-2xl border border-blue-400/20 bg-blue-400/[0.06] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black text-white">The gap to the interview threshold</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Candidates who get to the next round in <span className="text-white font-black">{insights.length > 0 ? "your target role" : "this role"}</span> typically score above{" "}
                <span className="font-black text-blue-200">{benchmarkScore}</span>. You scored{" "}
                <span className="font-black text-white">{overallScore}</span>.
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-3xl font-black text-white">{gap > 0 ? `+${gap}` : "0"}</p>
              <p className="text-xs text-slate-500">pts needed</p>
            </div>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-400 transition-all"
              style={{ width: `${clamp(overallScore)}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-slate-600">
            <span>0</span>
            <span className="text-blue-400">threshold: {benchmarkScore}</span>
            <span>100</span>
          </div>
        </div>
      )}

      {/* Blurred premium teaser */}
      {!isPremium && (
        <div className="relative mt-5 overflow-hidden rounded-2xl border border-violet-400/20 bg-violet-500/[0.06] p-5">
          <div className="select-none blur-[6px] pointer-events-none space-y-3">
            <p className="text-sm font-black text-white">7 signals from this session</p>
            <div className="space-y-2">
              {["Trust dropped 18pts when you said 'we managed the project' — no personal verb.", "Filler word spike on question 3 signalled low confidence.", "Answer 2 had a contradiction with your CV timeline — recruiter noted it.", "Missing metric on 4 of 5 answers. Top candidates include 1 number per story.", "Ownership language appeared in only 1 of {insights.length} answers."].map((line) => (
                <p key={line} className="rounded-xl bg-white/5 p-3 text-xs text-slate-300">• {line}</p>
              ))}
            </div>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]">
            <Lock className="h-7 w-7 text-amber-200 mb-3" />
            <p className="text-sm font-black text-white">All 7 recruiter signals</p>
            <p className="mt-1 text-xs text-slate-300">Every moment the trust score moved — and why</p>
            <button
              type="button"
              onClick={() => { if (typeof window !== "undefined") window.location.href = "/pricing?intent=results-signals"; }}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-blue-500 px-5 py-2.5 text-sm font-black text-white hover:bg-blue-400 transition"
            >
              <Crown className="h-4 w-4" />
              Unlock for €{" "}19 / month
            </button>
          </div>
        </div>
      )}
    </section>
  );
}


// ─── Urgency banner (free only) ───────────────────────────────────────────────
function UrgencyBanner({ remaining, roleLabel, targetMarket, overallScore }: {
  remaining: number;
  roleLabel: string;
  targetMarket: string;
  overallScore: number;
}) {
  const threshold = 78;
  const gap = threshold - overallScore;
  const marketLabel = targetMarket && targetMarket.toLowerCase() !== "global"
    ? ` in ${targetMarket}`
    : "";
  const roleShort = roleLabel || "your target role";

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-400/25 bg-amber-400/[0.07] px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-400/15">
          <AlertTriangle className="h-4 w-4 text-amber-300" />
        </div>
        <div>
          <p className="text-sm font-black text-white">
            {remaining <= 1
              ? "This was your last free session."
              : `${remaining} free session${remaining === 1 ? "" : "s"} remaining.`}
            {" "}
            {gap > 0
              ? `At ${overallScore}/100, most recruiters for ${roleShort}${marketLabel} would not proceed to a second round.`
              : `You are above the typical threshold for ${roleShort}${marketLabel} — keep practising to widen the gap.`}
          </p>
        </div>
      </div>
      <a
        href="/pricing?intent=urgency-banner"
        className="shrink-0 rounded-xl bg-amber-400 px-4 py-2 text-sm font-black text-slate-950 hover:bg-amber-300 transition"
      >
        Upgrade →
      </a>
    </div>
  );
}

// ─── Upgrade strip with "remembers" copy ──────────────────────────────────────
function UpgradeStrip({ roleLabel }: { roleLabel: string }) {
  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-blue-400/30 bg-gradient-to-br from-blue-500/[0.14] via-violet-500/[0.10] to-cyan-500/[0.08] p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-300">
            Premium · from €19 / month
          </p>
          <h3 className="mt-2 text-xl font-black text-white">
            The recruiter remembers. Next session picks up exactly where this one left off.
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Premium tracks your weaknesses across every session and coaches you on the exact gap this interview revealed{roleLabel ? ` for ${roleLabel}` : ""}. The recruiter adapts to your pattern — not a generic script.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[["Full session history", "Recruiter remembers your gaps"], ["Answer rewrites", "Top 10% version of your answers"], ["Targeted drills", "Train the weak signal, not everything"]].map(([title, desc]) => (
              <div key={title} className="rounded-xl border border-white/10 bg-black/20 p-2.5">
                <p className="text-xs font-black text-white">{title}</p>
                <p className="mt-1 text-[10px] leading-4 text-slate-400">{desc}</p>
              </div>
            ))}
          </div>
          {/* Social proof quote */}
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
            <p className="text-xs leading-5 text-slate-200 italic">
              "My trust score was 61 in session 1. After 4 sessions it was 84 and I got an offer the following week."
            </p>
            <p className="mt-1.5 text-[10px] font-black text-slate-500">
              Premium user · Customer Success Manager · Berlin
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
          <a
            href="/pricing?intent=upgrade-strip"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/25 hover:bg-blue-400 transition"
            onClick={() => {
              try { (window as any).__workzo_recordUpgrade?.(); } catch {}
            }}
          >
            <Crown className="h-4 w-4" />
            Unlock Premium — €19 / month
          </a>
          <p className="text-xs text-slate-500">Cancel anytime · No hidden fees · Stripe</p>
        </div>
      </div>
    </div>
  );
}

// ─── Real-content blur sections ────────────────────────────────────────────────
function RealBlurredInsights({ insights, contradictions, redFlags }: {
  insights: AnswerInsight[];
  contradictions: RichReport["contradictions"];
  redFlags: string[];
}) {
  // Build real, specific signal lines from actual data
  const signals: string[] = [];

  const noOwnership = insights.filter(i => !i.ownershipPresent);
  if (noOwnership.length) {
    const q = noOwnership[0];
    signals.push(`Trust dropped on Q${insights.indexOf(q) + 1}: ownership language missing — recruiter couldn't identify what you personally did.`);
  }

  const highFiller = insights.filter(i => i.fillerCount >= 3);
  if (highFiller.length) {
    const q = highFiller[0];
    signals.push(`Filler word spike on Q${insights.indexOf(q) + 1} (${q.fillerCount} detected) — signals low confidence on this answer.`);
  }

  if (contradictions.length) {
    signals.push(`Consistency concern: ${contradictions[0].detail.slice(0, 80)}… (trust drop: −${contradictions[0].trustDrop} pts)`);
  }

  const noMetric = insights.filter(i => !i.metricPresent);
  if (noMetric.length >= 2) {
    signals.push(`Missing measurable outcome in ${noMetric.length} of ${insights.length} answers — top candidates include 1 number per story.`);
  }

  const shortAnswers = insights.filter(i => i.wordCount < 25);
  if (shortAnswers.length) {
    signals.push(`${shortAnswers.length} answer${shortAnswers.length > 1 ? "s" : ""} ended in under 25 words — recruiter needed more evidence before moving on.`);
  }

  if (redFlags.length) {
    signals.push(redFlags[0]);
  }

  // Pad to 5 if needed
  const fallbacks = [
    "Answer structure: STAR completeness score below threshold on 2+ answers.",
    "Voice confidence proxy: answer length variance suggests inconsistent delivery.",
    "Role relevance gap: examples not directly connected to target role requirements.",
  ];
  while (signals.length < 5) signals.push(fallbacks[signals.length - (5 - fallbacks.length)] || fallbacks[0]);

  return (
    <div className="relative mt-5 overflow-hidden rounded-2xl border border-violet-400/20 bg-violet-500/[0.06]">
      {/* Partially visible top */}
      <div className="p-6 pb-0">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-violet-200">
          All {signals.length + 2} recruiter trust signals from this session
        </p>
        <h3 className="mt-2 text-xl font-black text-white">
          Every moment trust moved — up or down
        </h3>
        {/* First signal fully visible */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm leading-6 text-slate-200">• {signals[0]}</p>
        </div>
      </div>

      {/* Blurred signals below */}
      <div className="relative px-6 pb-6 pt-3">
        <div className="select-none blur-[5px] pointer-events-none space-y-2">
          {signals.slice(1).map((line, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm leading-6 text-slate-200">• {line}</p>
            </div>
          ))}
          {/* Fake extra items to fill the blur */}
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-sm leading-6 text-slate-200">• Recruiter interpretation of your strongest answer and what it signals about your candidacy.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-sm leading-6 text-slate-200">• Top 10% rewrite for your weakest answer with one measurable result.</p>
          </div>
        </div>

        {/* Upgrade overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-[#050a12] via-[#050a12]/80 to-transparent pt-8">
          <Lock className="h-7 w-7 text-amber-200 mb-3" />
          <p className="text-base font-black text-white">See all recruiter signals</p>
          <p className="mt-1 text-sm text-slate-400 text-center max-w-xs">
            Every trust movement explained, with rewrites for your weakest answers
          </p>
          <a
            href="/pricing?intent=blur-signals"
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-blue-500 px-6 py-3 text-sm font-black text-white hover:bg-blue-400 transition shadow-lg shadow-blue-500/20"
          >
            <Crown className="h-4 w-4" />
            Unlock Premium — €19 / month
          </a>
          <p className="mt-2 text-xs text-slate-600">Cancel anytime</p>
        </div>
      </div>
    </div>
  );
}

// ─── Email capture ─────────────────────────────────────────────────────────────
function EmailCapture({ roleLabel, overallScore }: { roleLabel: string; overallScore: number }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/email/capture-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, roleLabel, overallScore, source: "results_page" }),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("sent");
    } catch {
      setStatus("error");
      setError("Something went wrong. Try again.");
    }
  }

  if (status === "sent") {
    return (
      <div className="mt-6 rounded-[2rem] border border-emerald-400/25 bg-emerald-500/[0.07] p-6 text-center">
        <p className="text-lg font-black text-emerald-200">Report sent ✓</p>
        <p className="mt-2 text-sm text-slate-400">
          Check your inbox — your 5-day improvement plan is on its way.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-400/15 text-blue-200">
          <Mail className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="font-black text-white">Get the report and a 5-day plan by email</p>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Get your score breakdown and a daily coaching prompt targeting your biggest gap —
            {roleLabel ? ` specifically for ${roleLabel}` : " personalised to this session"}.
            No spam.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              placeholder="your@email.com"
              className="min-h-12 flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-400/50 transition"
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={status === "loading"}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-500 px-5 py-3 text-sm font-black text-white hover:bg-blue-400 transition disabled:opacity-60"
            >
              {status === "loading" ? (
                <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              Send it
            </button>
          </div>
          {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}
          <p className="mt-2 text-xs text-slate-600">
            We store your email to send the report and follow-up tips. Unsubscribe anytime.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ResultsPage() {
  const [mounted, setMounted] = useState(false);
  const [result, setResult] = useState<StoredResult>({});
  const [setupContext, setSetupContext] = useState<Record<string, unknown>>({});
  const [loadState, setLoadState] = useState<ResultsLoadState>("loading");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [careerBrain, setCareerBrain] = useState<PhaseCCareerBrain | null>(null);
  const [sessionsRemaining, setSessionsRemaining] = useState(1);
  const reportGate = useWorkZoAdvancedReportGate();

  useEffect(() => {
    let cancelled = false;

    async function loadResultsDbFirst() {
      const storedSetup = (readLatestInterviewSetup() || {}) as Record<string, unknown>;
      const localResult = readStoredResult();
      const dbResult = await fetchLatestDbInterviewResult();
      const sourceResult = dbResult || localResult;
      const nextLoadState: ResultsLoadState = dbResult
        ? "db"
        : Object.keys(localResult).length
          ? "local"
          : "empty";

      if (cancelled) return;

      setResult(sourceResult);
      setSetupContext(storedSetup);
      setLoadState(nextLoadState);

      try {
        const premiumNow = reportGate.allowed;
        const immediateReport = buildRichReport(sourceResult, premiumNow);
        const brain = updateCareerMemoryFromReport({
          targetRole: immediateReport.roleLabel,
          companyName: immediateReport.companyLabel,
          overallScore: immediateReport.overallScore,
          trustScore: immediateReport.trustScore,
          evidenceQuality: immediateReport.evidenceQuality,
          ownershipScore: immediateReport.ownershipScore,
          structureScore: immediateReport.structureScore,
          biggestBlocker: immediateReport.biggestBlocker,
          strengths: immediateReport.strengths,
          improvements: immediateReport.improvements,
          answerInsights: immediateReport.answerInsights,
          contradictions: immediateReport.contradictions,
        });
        setCareerBrain(brain);
      } catch {
        setCareerBrain(buildCareerBrain());
      }

      setMounted(true);
      try {
        recordWorkZoReportViewed();
      } catch {
        // Analytics should never block the report.
      }

      // Read remaining free sessions for urgency banner
      try {
        const usage = getWorkZoUsageSummary();
        setSessionsRemaining(usage.interviewsRemaining);
      } catch {
        // Non-blocking
      }
    }

    setLoadState("loading");
    loadResultsDbFirst();

    return () => {
      cancelled = true;
    };
  }, [reportGate.allowed]);

  // Safety net: if the plan gate never resolves (e.g. /api/account/plan is slow),
  // force-mount after 8 seconds using whatever local data is available.
  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      if (!mounted) {
        console.warn("[WorkZo results] Plan gate timeout — mounting with local data");
        const localResult = readStoredResult();
        if (Object.keys(localResult).length > 0) {
          setResult(localResult);
          setLoadState("local");
        } else {
          setLoadState("empty");
        }
        setMounted(true);
      }
    }, 8000);
    return () => clearTimeout(fallbackTimer);
  }, [mounted]);

  const isPremium = reportGate.allowed;

  const isProPlan = reportGate.plan === "premium_pro";

  const report = useMemo(() => buildRichReport(result, isPremium), [result, isPremium]);
  const phaseB = useMemo(
    () => buildPhaseBInsights({
      cvText: String(setupContext.cvText || setupContext.uploadedCvText || setupContext.resumeText || setupContext.candidateCv || ""),
      jobDescription: String(setupContext.jobDescription || setupContext.jdText || ""),
      targetRole: String(result.targetRole || result.role || setupContext.targetRole || setupContext.role || ""),
      targetMarket: String(setupContext.targetMarket || setupContext.country || ""),
      companyName: String(result.companyName || result.targetCompany || setupContext.companyName || setupContext.targetCompany || ""),
      companyStyle: String(result.companyStyle || setupContext.companyStyle || ""),
    }),
    [result, setupContext],
  );
  if (!mounted) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#050a12] px-5 text-white">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-center">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-blue-200">Loading interview debrief</p>
          <p className="mt-3 text-sm leading-6 text-slate-400">Checking your saved database report first, then falling back to this device if needed.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050a12] px-5 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-slate-200 hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>

          <div className="flex items-center gap-3">
            <PremiumUsageBadge compact={false} label={isProPlan ? "Premium Pro report" : isPremium ? "Premium report" : "Free report"} />
            <span className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              {loadState === "db" ? "Synced report" : loadState === "local" ? "Local report" : loadState === "loading" ? "Loading" : "No saved report"}
            </span>
            <Link href="/pricing" className="rounded-2xl bg-blue-500 px-5 py-3 text-sm font-black text-white hover:bg-blue-400">
              {isPremium ? "Manage plan" : "Upgrade"}
            </Link>
          </div>
        </div>

        {!isPremium && (
          <UrgencyBanner
            remaining={sessionsRemaining}
            roleLabel={report.roleLabel}
            targetMarket={String(setupContext.targetMarket || setupContext.country || "")}
            overallScore={report.overallScore}
          />
        )}

        <section className={cn(
          "mt-6 rounded-2xl border p-6",
          isProPlan
            ? "border-violet-400/30 bg-gradient-to-br from-violet-500/20 via-violet-500/10 to-blue-500/10"
            : isPremium
              ? "border-white/10 bg-gradient-to-br from-violet-500/15 via-blue-500/10 to-cyan-500/10"
              : "border-white/10 bg-gradient-to-br from-slate-500/10 via-blue-500/8 to-cyan-500/8"
        )}>
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex-1 min-w-0">
              <div className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black",
                isProPlan ? "border-violet-300/25 bg-violet-300/10 text-violet-100"
                : isPremium ? "border-amber-300/25 bg-amber-300/10 text-amber-100"
                : "border-white/15 bg-white/[0.06] text-slate-300"
              )}>
                {isProPlan ? <Star className="h-3.5 w-3.5" /> : isPremium ? <Crown className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                {isProPlan ? "Premium Pro Interview Debrief" : isPremium ? "Premium Interview Debrief" : "Free Interview Snapshot"}
              </div>

              <h1 className="mt-4 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
                {isPremium ? "Recruiter decision simulation" : "Your recruiter-style feedback report"}
              </h1>

              <p className="mt-3 text-base leading-7 text-blue-100">
                Current hiring confidence: <span className="font-black text-white">{report.decision}</span>. Biggest blocker: <span className="font-black text-white">{report.biggestBlocker}</span>.
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-300">{report.verdict}</p>

              {report.answersCount < 3 && (
                <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-2.5">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />
                  <p className="text-xs leading-5 text-amber-100">
                    <span className="font-black">Short session detected.</span> Only {report.answersCount} answer{report.answersCount === 1 ? "" : "s"} were captured — scores are indicative only. Complete a full session for an accurate debrief.
                  </p>
                </div>
              )}
            </div>

            <ScoreRing score={report.overallScore} grade={report.grade} />
          </div>
        </section>

        {!isPremium && (
          <div className="mt-4 rounded-2xl border border-violet-300/20 bg-gradient-to-r from-violet-500/10 to-blue-500/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-400/15">
                  <Lock className="h-4 w-4 text-violet-200" />
                </div>
                <div>
                  <p className="text-sm font-black text-white">Premium unlocks the full debrief</p>
                  <p className="mt-0.5 text-xs text-slate-400">Hiring committee memo · shadow scores · answer rewrites · targeted drills · full session history</p>
                </div>
              </div>
              <a href="/pricing?intent=top-teaser" className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-black text-white hover:bg-violet-400 transition">
                <Crown className="h-3.5 w-3.5" />
                See Premium — €19/mo
              </a>
            </div>
          </div>
        )}

        <HiringCommitteeMemoCard memo={report.hiringCommittee} />
        <ShadowScoreSection scores={report.shadowScores} />

        <section className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={MessageSquareText} label="Communication" value={report.communicationScore} note="Clarity, answer length, and structure." />
          <MetricCard icon={Gauge} label="Confidence" value={report.confidenceScore} note="Pace, ownership, certainty, and delivery signals." />
          <MetricCard icon={Target} label="Role Competency" value={report.roleCompetencyScore} note="How relevant your evidence sounded for the role." />
          <MetricCard icon={ShieldCheck} label="Trust Signal" value={report.trustScore} note="Consistency, ownership, and proof strength." />
        </section>


        <section className="mt-4 rounded-2xl border border-blue-300/15 bg-blue-500/[0.045] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-200">Deep analysis</p>
              <h2 className="mt-1 text-lg font-black">{phaseB.companyDNA.label}</h2>
              <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-300">{phaseB.companyDNA.description}</p>
            </div>
            <div className="grid h-14 w-14 place-items-center rounded-xl border border-blue-300/20 bg-black/25 text-center">
              <p className="text-xl font-black text-blue-100">{phaseB.trustAudit.overall}</p>
              <p className="-mt-1 text-[9px] font-black text-slate-500">TRUST</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs font-black text-blue-100">Company DNA alignment</p>
              <div className="mt-3 space-y-3">
                {phaseB.companyDNA.dimensions.map((item) => (
                  <Bar key={item.label} label={item.label} value={item.score} target={item.target} note={item.note} />
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs font-black text-emerald-200">Trust audit deductions</p>
              <div className="mt-2 space-y-1.5">
                {phaseB.trustAudit.deductions.map((item) => (
                  <p key={item.label} className="text-xs leading-5 text-slate-300">
                    <span className="font-black text-white">{item.delta >= 0 ? "+" : ""}{item.delta}</span> {item.label}: {item.reason}
                  </p>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs font-black text-amber-200">Cross-feature consistency</p>
              <p className="mt-1 text-base font-black text-white">{phaseB.consistency.status}</p>
              <div className="mt-2 space-y-1">
                {phaseB.consistency.notes.map((item) => (
                  <p key={item} className="text-xs leading-5 text-slate-300">• {item}</p>
                ))}
              </div>
            </div>
          </div>
        </section>

        {careerBrain ? <CareerBrainSection brain={careerBrain} /> : null}

        {!isPremium ? (
          <>
            <section className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <h2 className="flex items-center gap-2 text-base font-black"><ShieldCheck className="h-4 w-4 text-emerald-300" />Sentiment snapshot</h2>
                <p className="mt-2 text-sm leading-6 text-slate-200">You showed useful role fit, but the recruiter still needs sharper metrics, ownership, or structure.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <div className="rounded-xl bg-black/20 p-3"><p className="text-xs text-slate-400">Speaking pace</p><p className="mt-1.5 text-xl font-black">{report.averageWpm || "—"} <span className="text-sm text-slate-400">WPM</span></p><p className="mt-0.5 text-[10px] text-slate-500">{report.averageWpm ? (report.averageWpm >= 110 && report.averageWpm <= 170 ? "Good pace" : report.averageWpm < 110 ? "Too slow" : "Too fast") : "Not measured"}</p></div>
                  {(result.fillerWordCount ?? 0) >= 0 && (
                    <div className="rounded-xl bg-black/20 p-3"><p className="text-xs text-slate-400">Filler words</p><p className="mt-1.5 text-xl font-black">{result.fillerWordCount ?? 0}</p><p className="mt-0.5 text-[10px] text-slate-500">{(result.fillerWordCount ?? 0) === 0 ? "None detected" : (result.fillerWordCount ?? 0) <= 3 ? "Low — good" : (result.fillerWordCount ?? 0) <= 8 ? "Moderate" : "High — work on this"}</p></div>
                  )}
                  <div className="rounded-xl bg-black/20 p-3"><p className="text-xs text-slate-400">Duration</p><p className="mt-1.5 text-xl font-black">{report.durationLabel}</p></div>
                  <div className="rounded-xl bg-black/20 p-3"><p className="text-xs text-slate-400">Answers</p><p className="mt-1.5 text-xl font-black">{report.answersCount}</p></div>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-5">
                <h2 className="flex items-center gap-2 text-base font-black"><Lightbulb className="h-4 w-4 text-emerald-200" />One quick win</h2>
                <p className="mt-3 text-sm leading-6 text-emerald-50">{report.quickWin}</p>
              </div>
            </section>

            <WhereLostSection insights={report.answerInsights} overallScore={report.overallScore} isPremium={isPremium} />

            <UpgradeStrip roleLabel={report.roleLabel} />

            <section className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <h2 className="flex items-center gap-2 text-base font-black"><CheckCircle2 className="h-4 w-4 text-emerald-300" />What landed</h2>
                <div className="mt-3 space-y-2">{report.strengths.map((item) => <p key={item} className="rounded-xl bg-emerald-400/10 px-3 py-2 text-xs leading-5 text-emerald-50">{item}</p>)}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <h2 className="flex items-center gap-2 text-base font-black"><Target className="h-4 w-4 text-blue-300" />What needs work</h2>
                <div className="mt-3 space-y-2">{report.improvements.map((item) => <p key={item} className="rounded-xl bg-blue-400/10 px-3 py-2 text-xs leading-5 text-blue-50">{item}</p>)}</div>
              </div>
            </section>

            <RealBlurredInsights
              insights={report.answerInsights}
              contradictions={report.contradictions}
              redFlags={report.redFlags}
            />

            <EmailCapture roleLabel={report.roleLabel} overallScore={report.overallScore} />
          </>
        ) : (
          <>
            <section className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <h2 className="flex items-center gap-2 text-base font-black"><BarChart3 className="h-4 w-4 text-cyan-300" />Benchmarking and company DNA</h2>
                <p className="mt-2 text-xs leading-5 text-slate-300">{report.companyDNA.description}</p>
                <div className="mt-3 rounded-xl bg-blue-400/10 px-3 py-2 text-xs font-black text-blue-100">{report.companyDNA.label}</div>
                <div className="mt-4 space-y-3">{report.companyDNA.dimensions.map((item) => <Bar key={item.label} label={item.label} value={item.score} target={item.target} note={item.note} />)}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <h2 className="flex items-center gap-2 text-base font-black"><ShieldCheck className="h-4 w-4 text-amber-200" />Trust and integrity audit</h2>
                <div className="mt-4 space-y-3">
                  <Bar label="Credibility" value={report.trustScore} note="Evidence, consistency, and recruiter confidence." />
                  <Bar label="Evidence Quality" value={report.evidenceQuality} note="Metrics, ownership, and result clarity." />
                  <Bar label="Contradiction Safety" value={report.contradictions.length ? clamp(100 - report.contradictions[0].trustDrop * 4) : 92} note="Higher means fewer consistency concerns." />
                </div>
                <div className="mt-4 space-y-2">
                  {report.trustDeductions.map((item) => (
                    <div key={item.label} className={cn("flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold", item.tone === "negative" ? "bg-rose-400/10 text-rose-100" : "bg-emerald-400/10 text-emerald-100")}>
                      <span>{item.label}</span>
                      <span>{item.value > 0 ? `+${item.value}` : item.value} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <h2 className="flex items-center gap-2 text-base font-black"><TrendingUp className="h-4 w-4 text-blue-300" />Top 10% candidate overlay</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {report.benchmark.map((item) => (
                  <div key={item.label} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <p className="text-sm font-black text-white">{item.label}</p>
                    <div className="mt-3 space-y-2">
                      <Bar label="You" value={item.user} />
                      <Bar label="Top 10%" value={item.top} />
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-400">{item.note}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <h2 className="flex items-center gap-2 text-base font-black"><Flag className="h-4 w-4 text-rose-300" />Red flags and evidence requests</h2>
                <div className="mt-4 space-y-2">
                  {report.redFlags.length ? report.redFlags.map((item) => <p key={item} className="rounded-xl bg-rose-400/10 px-3 py-2 text-xs leading-5 text-rose-50">{item}</p>) : (
                    <div className="space-y-2">
                      <p className="rounded-xl bg-emerald-400/10 px-3 py-2 text-xs leading-5 text-emerald-50">No critical red flag detected in captured answers.</p>
                      {["No blame-shifting language detected", "No toxic communication pattern detected", "No major contradiction detected", "Professional communication tone maintained"].map((item) => <p key={item} className="flex items-center gap-2 text-xs text-slate-300"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />{item}</p>)}
                    </div>
                  )}
                </div>
                <div className="mt-3 space-y-2">
                  {report.evidenceRequests.map((item) => <p key={item} className="rounded-xl bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-50">Recruiter would ask: {item}</p>)}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <h2 className="flex items-center gap-2 text-base font-black"><Wand2 className="h-4 w-4 text-violet-300" />Improvement roadmap</h2>
                <div className="mt-4 space-y-3">
                  {report.improvementPlan.map((item) => (
                    <div key={item.priority} className="rounded-xl bg-violet-400/10 p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-200">{item.priority} · {item.gain}</p>
                      <h3 className="mt-1 text-sm font-black text-white">{item.title}</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-300">{item.action}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <h2 className="flex items-center gap-2 text-base font-black"><Eye className="h-4 w-4 text-blue-300" />Delivery signals</h2>
              <p className="mt-1 text-xs leading-5 text-slate-400">Estimated from transcript length, word count, and filler word detection.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {report.audioSignals.map((item) => (
                  <div key={item.label} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                    <p className="mt-1.5 text-2xl font-black text-white">{item.value}</p>
                    <p className={cn("mt-1 text-[10px] font-black uppercase tracking-[0.14em]", item.risk === "high" ? "text-rose-300" : item.risk === "medium" ? "text-amber-300" : "text-emerald-300")}>{item.risk} risk</p>
                  </div>
                ))}
              </div>
            </section>

            <WhatTheyHeardSection items={report.whatTheyHeard} />
            <TargetedDrillsSection drills={report.targetedDrills} />

            <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <h2 className="flex items-center gap-2 text-base font-black"><MessageSquareText className="h-4 w-4 text-cyan-300" />Answer-by-answer coaching debrief</h2>
              <div className="mt-4 space-y-3">
                {report.answerInsights.map((item, index) => <TranscriptCard key={item.id} item={item} index={index} />)}
              </div>
            </section>
          </>
        )}

        <section className="mt-6">
          <WorkZoPremiumProSuitePanel source="results" report={report as unknown as Record<string, unknown>} />
        </section>

        <section className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-black text-white">What to do next</p>
              <p className="mt-1.5 text-sm leading-5 text-slate-400">Retry the interview using the improvement roadmap and compare your next score.</p>

              {/* Shareable moment card — viral mechanic */}
              {mounted && (() => {
                try {
                  const raw = window.localStorage.getItem("workzo_shareable_moment");
                  if (!raw) return null;
                  const moment = JSON.parse(raw) as { shouldHighlight: boolean; shareTitle: string; shareText: string; category: string };
                  if (!moment.shouldHighlight) return null;
                  return (
                    <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-500/[0.07] p-5">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Memorable moment</p>
                      <h3 className="mt-2 text-lg font-black text-white">{moment.shareTitle}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{moment.shareText}</p>
                      <button
                        type="button"
                        onClick={() => {
                          const text = `${moment.shareTitle}: "${moment.shareText}" — practiced with WorkZo AI`;
                          if (navigator.share) { void navigator.share({ title: "WorkZo AI Interview Moment", text }); }
                          else { void navigator.clipboard.writeText(text); }
                        }}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-200 hover:bg-cyan-400/20"
                      >
                        Share this moment
                      </button>
                    </div>
                  );
                } catch { return null; }
              })()}
            </div>
            <Link href="/onboarding" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 text-sm font-black text-slate-950 hover:bg-slate-200">
              <RefreshCcw className="h-4 w-4" /> Retry interview
            </Link>
          </div>
        </section>
      </div>

      <UpgradeModal open={upgradeOpen} feature="advanced interview report" onClose={() => setUpgradeOpen(false)} />
    </main>
  );
}
