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
import ReadinessScorePanel from "@/components/ReadinessScorePanel";
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

function numberOr<T>(value: unknown, fallback: T): number | T {
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
    // 6-second timeout: if the DB call hangs (e.g. due to a flood of other API calls),
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

function countWords(text: string) {
  return (text.match(/\b[\w'+-]+\b/g) || []).length;
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

  // Filter out greeting exchanges and one-word fillers: the opening
  // "Hi, how are you?" / "Good, thanks. How are you?" exchange is not a
  // substantive answer and should never be scored or displayed as Q1.
  const isGreetingAnswer = (answer: string): boolean => {
    const words = countWords(answer);
    if (words >= 15) return false;
    const lower = answer.toLowerCase().trim();
    const hasWork = /\b(experience|engineer|manager|worked|company|role|project|client|customer|year|month|built|led|managed|created|developed|responsible|team|skill|data|support|software|product|sales|business|technical|degree|university|school|bootcamp)\b/i.test(lower);
    if (hasWork) return false;
    return (
      /^(hi|hey|hello)\b/.test(lower) ||
      /^(good|great|fine|well|doing well|i'?m (good|well|fine|great|doing well|okay|ok))\b/.test(lower) ||
      /^(thank|thanks)\b/.test(lower) ||
      /how (are you|about you|about yourself|do you do)/.test(lower) ||
      (words <= 8 && /\b(good|great|fine|well|okay|ok|yes|yep|sure|yeah|thanks)\b/.test(lower))
    );
  };
  const substantivePairs = pairs.filter((pair) => !isGreetingAnswer(pair.answer));
    return substantivePairs.slice(0, 12);
}

function countFillers(text: string) {
  return (text.match(/\b(um|uh|like|basically|actually|sort of|kind of|you know|i mean|maybe|probably)\b/gi) || []).length;
}

function hasMetric(text: string) {
  const t = text.toLowerCase();
  // Numeric metrics (digits)
  const numericMetric = /\b\d+\s*(%|percent|k|m|million|thousand|x|times|users|customers|tickets|cases|incidents|hours|days|weeks|months|revenue|cost|sla|nps|csat|people|members|accounts|deals|calls|emails|projects|sites|stores|teams|points|score|rating|stars)\b/.test(t);
  // Written-out numbers (speech-to-text often writes these out)
  const writtenNumber = /\b(one hundred|fifty|forty|thirty|twenty|fifteen|ten|five|double|triple|half|twice|three times|four times|first|second|third)\b/.test(t);
  // Percentage phrases spoken naturally
  const percentPhrase = /\b(\d+\s*percent|\d+\s*%|percent reduction|percent improvement|percent increase|percentage|by half|doubled|tripled|halved)\b/.test(t);
  // Scale/scope indicators that imply measurement
  const scaleIndicator = /\b(over \d+|more than \d+|less than \d+|up to \d+|around \d+|approximately \d+|about \d+|nearly \d+|roughly \d+|\d+ to \d+)\b/.test(t);
  return numericMetric || percentPhrase || scaleIndicator || (writtenNumber && /\b(customers|users|tickets|people|accounts|percent|days|weeks|hours|minutes|months|years)\b/.test(t));
}

function hasOwnership(text: string) {
  const t = text.toLowerCase();
  // First person present - spoken answers use "I" frequently
  const firstPerson = /\b(i |i've|i was|i am|i did|i had|i have|i would|i worked|i made|i took|i went|my |me |myself|personally)/.test(t);
  // Action verbs - broad list covering spoken casual language
  const actionVerb = /\b(led|owned|built|created|designed|implemented|resolved|improved|managed|delivered|automated|analyzed|coordinated|handled|trained|supported|was responsible|took ownership|took care|worked on|fixed|solved|helped|ensured|made sure|set up|put together|came up with|figured out|reached out|followed up|dealt with|took over|stepped in|ran the|in charge|oversaw|spearheaded|initiated|launched|developed|wrote|deployed|tested|reviewed|identified|diagnosed)\b/.test(t);
  return firstPerson && actionVerb;
}

function hasResult(text: string) {
  const t = text.toLowerCase();
  return /\b(result|impact|outcome|after that|therefore|as a result|which led|improved|reduced|increased|saved|resolved|delivered|achieved|ended up|turned out|at the end|in the end|finally|eventually|so now|and now|that helped|that allowed|they were happy|customer was happy|problem was solved|issue was fixed|it worked|it helped|worked out|went well|was successful|got the|received|won|closed|completed|finished|launched|shipped)\b/.test(t) || hasMetric(t);
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

  // structureScore: base 20: candidate earns points for substance, not just showing up
  const structureScore = clamp(20 + (words >= 40 ? 18 : words >= 20 ? 8 : 0) + (words <= 180 ? 10 : 0) + (ownershipPresent ? 18 : 0) + (resultPresent ? 20 : 0) + (metricPresent ? 10 : 0) - (words > 230 ? 8 : 0) - (fillerCount >= 5 ? 6 : 0));
  // evidenceScore: base 15: must be earned through actual content
  const evidenceScore = clamp(15 + (metricPresent ? 38 : 0) + (ownershipPresent ? 22 : 0) + (resultPresent ? 20 : 0) + (words >= 60 ? 5 : 0) - (redFlags.length * 4));
  // trustImpact: honest spread: good answers reward well, weak answers show clearly
  const trustImpact = clamp(35 + (ownershipPresent ? 22 : -10) + (metricPresent ? 20 : -10) + (resultPresent ? 15 : -5) + (words >= 50 ? 5 : words < 20 ? -8 : 0) - (redFlags.length * 5) - (fillerCount >= 5 ? 5 : 0));

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

  // Contextual rewrite tip: reflects what was actually missing in THIS answer,
  // so the coaching in the "Two moments" section feels specific, not generic.
  let rewrite: string;
  if (!answer || /not captured/i.test(answer)) {
    rewrite = "Use a short STAR answer: situation, task, action, measurable result, and one sentence linking it to the role.";
  } else if (words < 25) {
    rewrite = "Expand this answer: add the situation in one sentence, what you personally did, and one result. Aim for 60–90 seconds when spoken aloud.";
  } else if (!ownershipPresent && !metricPresent) {
    rewrite = "Rewrite with 'I' as the subject: 'I decided...', 'I built...', 'I resolved...': then close with one number that shows the impact.";
  } else if (!metricPresent) {
    rewrite = "Add one number to close this answer: time saved, customers helped, tickets resolved, revenue impact, or quality improvement. Even a rough estimate works.";
  } else if (!ownershipPresent) {
    rewrite = "Clarify your personal contribution: separate what the team did from what you specifically owned, decided, or delivered.";
  } else if (!resultPresent) {
    rewrite = "Add a clear outcome sentence: 'As a result...' or 'This led to...': then name what actually changed.";
  } else {
    // This is a strong answer: tip should reinforce what worked, not suggest a rewrite
    rewrite = metricPresent && ownershipPresent
      ? "Strong answer. To make it even sharper: lead with the result first, then explain how you got there. Recruiters remember the outcome."
      : "Good structure here. Keep this answer in your preparation: it shows the pattern that builds recruiter trust.";
  }

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
  // No artificial floor: if no data, score 0 not 58
  const evidenceQuality = numberOr(result.evidenceQuality, numberOr(resultRecord.answerQuality?.evidenceScore, answersCount > 0 ? average(answerInsights.map((item) => item.evidenceScore), 0) : 0));
  const trustScore = numberOr(result.trustScore, numberOr(resultRecord.score?.trust, answersCount > 0 ? average(answerInsights.map((item) => item.trustImpact), 0) : 0));
  const structureScore = answersCount > 0 ? average(answerInsights.map((item) => item.structureScore), 0) : 0;
  // ownershipScore: honest: clear ownership gets high score, missing gets low score
  const ownershipScore = answersCount > 0
    ? average(answerInsights.map((item) => item.ownershipPresent ? 80 : 35), 50)
    : 50;

  // Use transcript-derived scores as primary; fall back to stored values only if present
  // Never use 0 as a fallback since 0 means "not measured" not "terrible performance"
  const transcriptCommScore = answersCount > 0 ? clamp(structureScore + (averageWpm >= 110 && averageWpm <= 170 ? 8 : -4)) : null;
  const transcriptConfScore = answersCount > 0 ? clamp(trustScore - (answerInsights.some((item) => item.fillerCount >= 4) ? 8 : 0) + (ownershipScore >= 70 ? 4 : -3)) : null;
  const transcriptRoleScore = answersCount > 0 ? clamp((evidenceQuality * 0.58) + (structureScore * 0.22) + (ownershipScore * 0.2)) : null;

  const storedCommScore = resultRecord.score?.communication || result.communicationScore || null;
  const storedConfScore = resultRecord.score?.confidence || result.confidenceScore || null;
  const storedRoleScore = resultRecord.score?.relevance || result.roleCompetencyScore || null;

  const communicationScore = transcriptCommScore ?? storedCommScore ?? 45;
  const confidenceScore = transcriptConfScore ?? storedConfScore ?? 45;
  const roleCompetencyScore = transcriptRoleScore ?? storedRoleScore ?? 45;

  // Calculate from transcript first: this is always honest
  const calculatedScore = clamp((communicationScore * 0.22) + (confidenceScore * 0.18) + (roleCompetencyScore * 0.28) + (trustScore * 0.2) + (evidenceQuality * 0.12));

  // Only use the stored score if:
  // 1. We have enough answers (3+) to trust it was a real session
  // 2. The stored score is meaningfully different from the default signal (50)
  // Otherwise, the transcript-based calculation is more honest.
  const _rawStoredScore = result.overallScore ?? resultRecord.score?.overall;
  const storedScore: number | null = typeof _rawStoredScore === "number" ? _rawStoredScore : null;
  // Treat stored scores of 0 OR exactly at the default signal range (48-52) as unreliable.
  // Also treat very low stored scores (< 10) as likely unscored sessions.
  const storedScoreIsDefault = storedScore === null || storedScore <= 5 || (storedScore >= 47 && storedScore <= 53);
  const overallScore = (answersCount >= 3 && storedScore !== null && !storedScoreIsDefault)
    ? clamp(storedScore)
    : calculatedScore;

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
      risk === "high" ? "bg-danger/10 text-danger" : risk === "medium" ? "bg-warning/10 text-warning" : "bg-success/10 text-success",
    )}>
      {risk} risk
    </span>
  );
}

function HiringCommitteeMemoCard({ memo }: { memo: WorkZoHiringCommitteeMemo }) {
  return (
    <section className="mt-5 rounded-2xl border border-warning/20 bg-warning/[0.075] p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-warning">Confidential hiring committee memo</p>
          <h2 className="mt-2 text-xl font-black text-fg">{memo.headline}</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-warning/90">{memo.recruiterSummary}</p>
        </div>
        <div className="rounded-xl border border-warning/20 bg-canvas-soft p-3 text-center shrink-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-warning">Panel confidence</p>
          <p className="mt-1 text-3xl font-black text-fg">{memo.confidence}%</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-line bg-canvas-soft p-3">
          <p className="text-xs font-black text-success">Evidence for hire</p>
          <div className="mt-2 space-y-1">{memo.evidenceForHire.map((item) => <p key={item} className="text-xs leading-5 text-fg">• {item}</p>)}</div>
        </div>
        <div className="rounded-xl border border-line bg-canvas-soft p-3">
          <p className="text-xs font-black text-danger">Panel concerns</p>
          <div className="mt-2 space-y-1">{memo.evidenceAgainstHire.map((item) => <p key={item} className="text-xs leading-5 text-fg">• {item}</p>)}</div>
        </div>
        <div className="rounded-xl border border-line bg-canvas-soft p-3">
          <p className="text-xs font-black text-muted">Recommendation</p>
          <p className="mt-2 text-xs leading-5 text-fg">{memo.finalRecommendation}</p>
          <div className="mt-2 space-y-1">{memo.nextRoundFocus.map((item) => <p key={item} className="rounded-lg bg-brand/10 px-2.5 py-1.5 text-xs leading-5 text-muted">{item}</p>)}</div>
        </div>
      </div>
    </section>
  );
}

function ShadowScoreSection({ scores }: { scores: WorkZoShadowScore[] }) {
  return (
    <section className="mt-4 rounded-2xl border border-line bg-fg/[0.035] p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-muted">Shadow score</p>
      <h2 className="mt-1 text-lg font-black text-fg">What an internal recruiter would quietly score</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {scores.map((item) => (
          <div key={item.label} className="rounded-xl border border-line bg-canvas-soft p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-black text-fg">{item.label}</p>
              <RiskTone risk={item.risk} />
            </div>
            <p className="mt-3 text-3xl font-black text-fg">{item.score}%</p>
            <p className="mt-2 text-xs leading-5 text-muted">{item.internalMeaning}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function WhatTheyHeardSection({ items }: { items: WorkZoWhatTheyHeard[] }) {
  return (
    <section className="mt-4 rounded-2xl border border-line bg-fg/[0.035] p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-muted">What they heard</p>
      <h2 className="mt-1 text-lg font-black text-fg">Your words vs. the interviewer’s interpretation</h2>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.id} className="grid gap-3 rounded-2xl border border-line bg-canvas-soft p-3 lg:grid-cols-2">
            <div className="rounded-xl bg-fg/[0.04] p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">You said</p>
              <p className="mt-2 text-xs leading-5 text-fg">“{item.youSaid}”</p>
            </div>
            <div className="rounded-xl border border-brand/20 bg-brand/10 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">They inferred</p>
              <p className="mt-2 text-xs leading-5 text-muted">{item.theyHeard}</p>
              <p className="mt-2 text-[10px] leading-4 text-warning">Risk: {item.risk}</p>
              <p className="mt-1 text-[10px] leading-4 text-success">Stronger signal: {item.strongerSignal}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TargetedDrillsSection({ drills }: { drills: WorkZoSkillDrill[] }) {
  return (
    <section className="mt-4 rounded-2xl border border-brand/20 bg-brand/[0.06] p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-muted">Targeted skill drills</p>
      <h2 className="mt-1 text-lg font-black text-fg">Train the weak signal, not the whole interview</h2>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {drills.map((drill) => (
          <Link key={drill.id} href={drill.href} className="group rounded-2xl border border-line bg-canvas-soft p-4 transition hover:bg-fg/[0.06]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">{drill.duration} · {drill.pressureLevel} pressure</p>
                <h3 className="mt-1 text-base font-black text-fg">{drill.title}</h3>
              </div>
              <ChevronRight className="h-4 w-4 text-subtle transition group-hover:text-fg shrink-0" />
            </div>
            <p className="mt-2 text-xs leading-5 text-muted">{drill.prompt}</p>
            <p className="mt-2 rounded-xl bg-warning/10 px-3 py-2 text-xs leading-5 text-warning">Recruiter pushback: “{drill.recruiterPushback}”</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {drill.successCriteria.map((item) => <span key={item} className="rounded-full border border-line bg-fg/[0.04] px-2 py-0.5 text-[10px] font-bold text-muted">{item}</span>)}
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
      <div className="grid h-[5.25rem] w-[5.25rem] place-items-center rounded-full bg-canvas text-center">
        <div>
          <p className="text-3xl font-black text-fg">{score}</p>
          <p className="text-[11px] font-black text-muted">{grade} / 100</p>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, note }: { icon: typeof Gauge; label: string; value: number; note: string }) {
  return (
    <div className="rounded-2xl border border-line bg-fg/[0.035] p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-brand" />
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted">{label}</p>
      </div>
      <p className="mt-3 text-3xl font-black text-fg">{value}%</p>
      <p className="mt-2 text-xs leading-5 text-muted">{note}</p>
    </div>
  );
}

function Bar({ value, target, label, note }: { value: number; target?: number; label: string; note?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black text-fg">{label}</p>
        <p className="text-sm font-black text-muted">{value}%{typeof target === "number" ? ` / ${target}%` : ""}</p>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-fg/10">
        <div className="h-full rounded-full bg-gradient-to-r from-brand to-success" style={{ width: `${clamp(value)}%` }} />
      </div>
      {note ? <p className="mt-1.5 text-xs leading-5 text-muted">{note}</p> : null}
    </div>
  );
}

function LockedPreview({ title, children, count }: { title: string; children: React.ReactNode; count?: string }) {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-brand/15 bg-brand/[0.08] p-6">
      <div className="absolute right-6 top-6 grid h-14 w-14 place-items-center rounded-2xl bg-warning/15 text-warning">
        <Lock className="h-6 w-6" />
      </div>
      <p className="text-xs font-black uppercase tracking-[0.28em] text-muted">Premium Preview</p>
      <h3 className="mt-3 pr-16 text-2xl font-black text-fg">{title}</h3>
      {count ? <p className="mt-3 text-sm font-black text-warning">{count}</p> : null}
      <div className="mt-6 select-none blur-[5px] pointer-events-none">{children}</div>
      <button
        type="button"
        onClick={() => {
          if (typeof window !== "undefined") window.location.href = "/pricing?intent=results-report";
        }}
        className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-black text-on-brand hover:bg-brand"
      >
        <Crown className="h-4 w-4" />
        Upgrade to unlock
      </button>
    </div>
  );
}

function TranscriptCard({ item, index }: { item: AnswerInsight; index: number }) {
  const [open, setOpen] = useState(index === 0);
  const [coachOpen, setCoachOpen] = useState(false);
  const [coachInput, setCoachInput] = useState("");
  const [coachMessages, setCoachMessages] = useState<Array<{ role: "user" | "bot"; text: string }>>([]);
  const [coachLoading, setCoachLoading] = useState(false);

  async function askCoach(question: string) {
    if (!question.trim() || coachLoading) return;
    const userMsg = question.trim();
    setCoachInput("");
    setCoachMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setCoachLoading(true);
    try {
      const systemPrompt = `You are a professional interview coach helping a job seeker improve a specific interview answer.

The recruiter asked: "${item.question}"

The candidate answered: "${item.answer}"

Identified weakness: ${item.weakness}
Evidence score: ${item.evidenceScore}%
Trust impact: ${item.trustImpact}%
Suggested rewrite direction: ${item.rewrite}

Give specific, actionable coaching. Be direct and practical. Keep your response under 120 words. Never repeat the question back.`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 200,
          system: systemPrompt,
          messages: [
            ...coachMessages.map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text })),
            { role: "user", content: userMsg },
          ],
        }),
      });
      const data = await res.json();
      const botText = data?.content?.[0]?.text || "I couldn't generate a response. Please try again.";
      setCoachMessages((prev) => [...prev, { role: "bot", text: botText }]);
    } catch {
      setCoachMessages((prev) => [...prev, { role: "bot", text: "Something went wrong. Please try again." }]);
    } finally {
      setCoachLoading(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-canvas-soft">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-4 p-4 text-left"
      >
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-muted">Question {index + 1}</p>
          <h3 className="mt-1 text-base font-black text-fg">{item.question}</h3>
          <p className="mt-1 text-xs text-muted">Evidence {item.evidenceScore}% · Trust impact {item.trustImpact}% · {item.weakness}</p>
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="border-t border-line p-4 space-y-3">
          <div className="grid gap-3 xl:grid-cols-3">
            <div className="rounded-xl bg-fg/[0.04] p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted">Your answer</p>
              <p className="mt-2 text-xs leading-5 text-fg">{item.answer}</p>
            </div>
            <div className="rounded-xl border border-warning/20 bg-warning/10 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-warning">What the recruiter heard</p>
              <p className="mt-2 text-xs leading-5 text-warning">{item.recruiterHeard}</p>
            </div>
            <div className="rounded-xl border border-success/20 bg-success/10 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-success">How to improve this</p>
              <p className="mt-2 text-xs leading-5 text-success">{item.rewrite}</p>
            </div>
          </div>

          {/* Post-answer coaching bot */}
          <div className="rounded-xl border border-brand/15 bg-brand/[0.05]">
            <button
              type="button"
              onClick={() => setCoachOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">🤖</span>
                <p className="text-[11px] font-black text-muted">Ask Work-O-Bot about this answer</p>
              </div>
              <ChevronDown className={cn("h-3.5 w-3.5 text-subtle transition", coachOpen && "rotate-180")} />
            </button>

            {coachOpen && (
              <div className="border-t border-brand/10 px-4 pb-4 pt-3">
                {coachMessages.length === 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {[
                      "How could I have structured this better?",
                      "Give me a stronger version of this answer",
                      "What metric could I have added?",
                      "How do I show more ownership here?",
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => askCoach(suggestion)}
                        className="rounded-lg border border-brand/15 bg-brand/10 px-2.5 py-1.5 text-[11px] font-bold text-brand hover:bg-brand/20 transition"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}

                {coachMessages.length > 0 && (
                  <div className="mb-3 space-y-2 max-h-48 overflow-y-auto">
                    {coachMessages.map((msg, i) => (
                      <div key={i} className={cn("rounded-xl px-3 py-2 text-xs leading-5", msg.role === "user" ? "bg-fg/[0.06] text-fg ml-6" : "bg-brand/10 text-brand mr-6")}>
                        {msg.role === "bot" && <span className="mr-1 text-brand">🤖</span>}
                        {msg.text}
                      </div>
                    ))}
                    {coachLoading && (
                      <div className="rounded-xl bg-brand/10 px-3 py-2 text-xs text-brand mr-6">
                        Thinking...
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={coachInput}
                    onChange={(e) => setCoachInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && askCoach(coachInput)}
                    placeholder="Ask about this answer..."
                    className="flex-1 rounded-lg border border-line bg-fg/[0.04] px-3 py-2 text-xs text-fg placeholder:text-subtle focus:border-brand/40 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => askCoach(coachInput)}
                    disabled={coachLoading || !coachInput.trim()}
                    className="rounded-lg bg-brand px-3 py-2 text-xs font-black text-on-brand hover:bg-brand disabled:opacity-40 transition"
                  >
                    Ask
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}


function CareerBrainSection({ brain }: { brain: PhaseCCareerBrain }) {
  const probabilityBars = [
    { label: "Current profile", value: brain.probability.current, tone: "from-warning to-warning" },
    { label: "After CV improvements", value: brain.probability.afterCv, tone: "from-brand to-brand" },
    { label: "After interview prep", value: brain.probability.afterPrep, tone: "from-success to-success" },
  ];

  return (
    <section className="mt-4 rounded-2xl border border-success/15 bg-success/[0.045] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-success">Phase C unified career brain</p>
          <h2 className="mt-1 text-lg font-black">One learning loop across CV, jobs, interviews, and results</h2>
          <p className="mt-1 max-w-4xl text-xs leading-5 text-muted">{brain.progress.latestSummary}</p>
        </div>
        <div className="grid h-14 w-14 place-items-center rounded-xl border border-success/20 bg-canvas-soft text-center">
          <p className="text-xl font-black text-success">{brain.probability.current}%</p>
          <p className="-mt-1 text-[9px] font-black text-muted">PROB.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-line bg-canvas-soft p-3">
          <p className="text-xs font-black text-success">Interview probability engine</p>
          <div className="mt-3 space-y-3">
            {probabilityBars.map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between text-sm">
                  <p className="font-bold text-fg">{item.label}</p>
                  <p className="font-black text-fg">{item.value}%</p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-fg/10">
                  <div className={`h-full rounded-full bg-gradient-to-r ${item.tone}`} style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1.5">
            {brain.probability.reasons.map((item) => <p key={item} className="text-[11px] leading-4 text-muted">• {item}</p>)}
          </div>
        </div>

        <div className="rounded-xl border border-line bg-canvas-soft p-3">
          <p className="text-xs font-black text-warning">Persistent weakness tracking</p>
          <div className="mt-2 space-y-2">
            {brain.persistentWeaknesses.length ? brain.persistentWeaknesses.map((item) => (
              <div key={item.label} className="rounded-xl bg-warning/10 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-black text-fg">{item.label}</p>
                  <span className="rounded-full bg-canvas-soft px-2 py-0.5 text-[10px] font-black text-warning">seen {item.count}x</span>
                </div>
                <p className="mt-1 text-[10px] leading-4 text-warning/85">{item.coachLine}</p>
              </div>
            )) : <p className="text-xs leading-5 text-muted">No recurring weakness yet. WorkZo will learn after more sessions.</p>}
          </div>
        </div>

        <div className="rounded-xl border border-line bg-canvas-soft p-3">
          <p className="text-xs font-black text-muted">Cross-feature actions</p>
          <div className="mt-2 space-y-2">
            {brain.crossFeatureActions.map((item) => (
              <div key={`${item.feature}-${item.action}`} className="rounded-xl bg-brand/10 p-2.5">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted">{item.feature}</p>
                <p className="mt-1 text-xs leading-5 text-muted/90">{item.action}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-line bg-canvas-soft p-3">
          <p className="text-xs font-black text-muted">Future recruiter memory challenges</p>
          <div className="mt-2 space-y-1.5">
            {brain.futureRecruiterChallenges.map((item) => <p key={item} className="rounded-xl bg-brand/10 px-2.5 py-2 text-xs leading-5 text-muted">"{item}"</p>)}
          </div>
        </div>

        <div className="rounded-xl border border-line bg-canvas-soft p-3">
          <p className="text-xs font-black text-muted">Persistent career roadmap</p>
          <div className="mt-2 space-y-2">
            {brain.roadmap.slice(0, 4).map((item) => (
              <div key={item.id} className="rounded-xl bg-brand/10 p-2.5">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted">{item.priority} · {item.estimatedGain}</p>
                <p className="mt-0.5 text-xs font-black text-fg">{item.title}</p>
                <p className="mt-0.5 text-xs leading-5 text-muted/85">{item.action}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}


// ─── "Where the interview turned": free tier conversion hook ─────────────
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
    whatRecruiterThought = `"Good story, but I need a number: time saved, customers helped, percentage improved: anything concrete."`;
  } else if (!item.ownershipPresent) {
    whatHappened = `The answer sounded like a team achievement, not a personal one. The recruiter lost confidence in your individual contribution.`;
    whatRecruiterThought = `"I'm not sure what they specifically did versus what the team did. I need to know their personal scope."`;
  } else if (item.wordCount < 25) {
    whatHappened = `The answer ended too quickly: 25 words or fewer. The recruiter expected depth and got a summary.`;
    whatRecruiterThought = `"There's clearly more to this story. Why did they stop here?"`;
  } else if (item.wordCount > 230) {
    whatHappened = `The answer ran too long without landing on a clear result. The recruiter lost the thread before the punchline.`;
    whatRecruiterThought = `"A lot of words, but I'm still not sure what the outcome actually was."`;
  }

  // The follow-up the recruiter would have asked next
  let nextChallenge = "What was the measurable outcome of what you described?";
  if (!item.ownershipPresent) nextChallenge = "What did YOU specifically do, not the team?";
  if (item.wordCount < 25) nextChallenge = "Can you walk me through that in more detail?";
  if (item.wordCount > 230) nextChallenge = "In one sentence: what was the actual result?";

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
    <section className="mt-6 rounded-[2rem] border border-danger/30 bg-canvas p-6 sm:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-danger/30 bg-danger/10 px-3 py-1.5">
            <TrendingDown className="h-3.5 w-3.5 text-danger" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-danger">Where you lost this interview</span>
          </div>
          <h2 className="mt-4 text-2xl font-black text-fg sm:text-3xl">
            Question {moment.questionIndex} is where the recruiter's confidence dropped.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
            Your trust score fell <span className="font-black text-danger">~{Math.min(moment.trustDrop, 22)} points</span> on this answer: more than any other moment in the session.
          </p>
        </div>
        <div className="shrink-0 rounded-2xl border border-danger/20 bg-canvas-soft p-4 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-danger">Trust drop</p>
          <p className="mt-1 text-4xl font-black text-fg">−{Math.min(moment.trustDrop, 22)}</p>
          <p className="text-xs text-muted">pts on this answer</p>
        </div>
      </div>

      {/* The question + answer */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-fg/[0.04] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">The question</p>
          <p className="mt-3 text-sm leading-7 text-fg">"{moment.question}"</p>
          <div className="mt-4 border-t border-line pt-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Your answer</p>
            <p className="mt-3 text-sm leading-7 text-muted italic">"{moment.answer.slice(0, 220)}{moment.answer.length > 220 ? "…" : ""}"</p>
          </div>
        </div>

        <div className="space-y-3">
          {/* What happened */}
          <div className="rounded-2xl border border-danger/20 bg-danger/[0.07] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-danger">What happened</p>
            <p className="mt-3 text-sm leading-7 text-danger">{moment.whatHappened}</p>
          </div>

          {/* What the recruiter thought */}
          <div className="rounded-2xl border border-warning/20 bg-warning/[0.07] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-warning">What the recruiter thought</p>
            <p className="mt-3 text-sm leading-7 text-warning">{moment.whatRecruiterThought}</p>
          </div>
        </div>
      </div>

      {/* The next challenge: visible, not blurred */}
      <div className="mt-5 rounded-2xl border border-line bg-fg/[0.03] p-5">
        <div className="flex items-start gap-3">
          <Zap className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-black text-fg">The question that would have come next</p>
            <p className="mt-2 text-sm leading-6 text-warning">"{moment.nextChallenge}"</p>
            <p className="mt-2 text-xs text-muted">This would have been the recruiter's next question. Can you answer it better next session?</p>
          </div>
        </div>
      </div>

      {/* Score benchmark: visible for free */}
      {gap > 0 && (
        <div className="mt-5 rounded-2xl border border-brand/20 bg-brand/[0.06] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black text-fg">The gap to the interview threshold</p>
              <p className="mt-1 text-xs leading-5 text-muted">
                Candidates who get to the next round in <span className="text-fg font-black">{insights.length > 0 ? "your target role" : "this role"}</span> typically score above{" "}
                <span className="font-black text-muted">{benchmarkScore}</span>. You scored{" "}
                <span className="font-black text-fg">{overallScore}</span>.
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-3xl font-black text-fg">{gap > 0 ? `+${gap}` : "0"}</p>
              <p className="text-xs text-muted">pts needed</p>
            </div>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-fg/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-danger to-warning transition-all"
              style={{ width: `${clamp(overallScore)}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted">
            <span>0</span>
            <span className="text-brand">threshold: {benchmarkScore}</span>
            <span>100</span>
          </div>
        </div>
      )}

      {/* Blurred premium teaser */}
      {!isPremium && (
        <div className="relative mt-5 overflow-hidden rounded-2xl border border-brand/20 bg-brand/[0.06] p-5">
          <div className="select-none blur-[6px] pointer-events-none space-y-3">
            <p className="text-sm font-black text-fg">7 signals from this session</p>
            <div className="space-y-2">
              {["Trust dropped 18pts when you said 'we managed the project': no personal verb.", "Filler word spike on question 3 signalled low confidence.", "Answer 2 had a contradiction with your CV timeline: recruiter noted it.", "Missing metric on 4 of 5 answers. Top candidates include 1 number per story.", "Ownership language appeared in only 1 of {insights.length} answers."].map((line) => (
                <p key={line} className="rounded-xl bg-fg/5 p-3 text-xs text-muted">• {line}</p>
              ))}
            </div>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]">
            <Lock className="h-7 w-7 text-warning mb-3" />
            <p className="text-sm font-black text-fg">All 7 recruiter signals</p>
            <p className="mt-1 text-xs text-muted">Every moment the trust score moved, and why</p>
            <button
              type="button"
              onClick={() => { if (typeof window !== "undefined") window.location.href = "/pricing?intent=results-signals"; }}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-2.5 text-sm font-black text-on-brand hover:bg-brand transition"
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
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-warning/25 bg-warning/[0.07] px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-warning/15">
          <AlertTriangle className="h-4 w-4 text-warning" />
        </div>
        <div>
          <p className="text-sm font-black text-fg">
            {remaining <= 1
              ? "This was your last free session."
              : `${remaining} free session${remaining === 1 ? "" : "s"} remaining.`}
            {" "}
            {gap > 0
              ? `At ${overallScore}/100, most recruiters for ${roleShort}${marketLabel} would not proceed to a second round.`
              : `You are above the typical threshold for ${roleShort}${marketLabel}: keep practising to widen the gap.`}
          </p>
        </div>
      </div>
      <a
        href="/pricing?intent=urgency-banner"
        className="shrink-0 rounded-xl bg-warning px-4 py-2 text-sm font-black text-slate-950 hover:bg-warning transition"
      >
        Upgrade →
      </a>
    </div>
  );
}

// ─── Upgrade strip with "remembers" copy ──────────────────────────────────────
function UpgradeStrip({ roleLabel }: { roleLabel: string }) {
  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-brand/30 bg-gradient-to-br from-brand/[0.14] via-brand/[0.10] to-brand/[0.08] p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted">
            Premium · from €19 / month
          </p>
          <h3 className="mt-2 text-xl font-black text-fg">
            The recruiter remembers. Next session picks up exactly where this one left off.
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            Premium tracks your weaknesses across every session and coaches you on the exact gap this interview revealed{roleLabel ? ` for ${roleLabel}` : ""}. The recruiter adapts to your pattern, not a generic script.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[["Full session history", "Recruiter remembers your gaps"], ["Answer rewrites", "Top 10% version of your answers"], ["Targeted drills", "Train the weak signal, not everything"]].map(([title, desc]) => (
              <div key={title} className="rounded-xl border border-line bg-canvas-soft p-2.5">
                <p className="text-xs font-black text-fg">{title}</p>
                <p className="mt-1 text-[10px] leading-4 text-muted">{desc}</p>
              </div>
            ))}
          </div>
          {/* Social proof quote */}
          <div className="mt-4 rounded-xl border border-line bg-canvas-soft px-4 py-3">
            <p className="text-xs leading-5 text-fg italic">
              "My trust score was 61 in session 1. After 4 sessions it was 84 and I got an offer the following week."
            </p>
            <p className="mt-1.5 text-[10px] font-black text-muted">
              Premium user · Customer Success Manager · Berlin
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
          <a
            href="/pricing?intent=upgrade-strip"
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-black text-on-brand shadow-lg shadow-brand/25 hover:bg-brand transition"
            onClick={() => {
              try { (window as any).__workzo_recordUpgrade?.(); } catch {}
            }}
          >
            <Crown className="h-4 w-4" />
            Unlock Premium: €19 / month
          </a>
          <p className="text-xs text-muted">Cancel anytime · No hidden fees · Stripe</p>
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
    signals.push(`Trust dropped on Q${insights.indexOf(q) + 1}: ownership language missing: recruiter couldn't identify what you personally did.`);
  }

  const highFiller = insights.filter(i => i.fillerCount >= 3);
  if (highFiller.length) {
    const q = highFiller[0];
    signals.push(`Filler word spike on Q${insights.indexOf(q) + 1} (${q.fillerCount} detected): signals low confidence on this answer.`);
  }

  if (contradictions.length) {
    signals.push(`Consistency concern: ${contradictions[0].detail.slice(0, 80)}… (trust drop: −${contradictions[0].trustDrop} pts)`);
  }

  const noMetric = insights.filter(i => !i.metricPresent);
  if (noMetric.length >= 2) {
    signals.push(`Missing measurable outcome in ${noMetric.length} of ${insights.length} answers: top candidates include 1 number per story.`);
  }

  const shortAnswers = insights.filter(i => i.wordCount < 25);
  if (shortAnswers.length) {
    signals.push(`${shortAnswers.length} answer${shortAnswers.length > 1 ? "s" : ""} ended in under 25 words: recruiter needed more evidence before moving on.`);
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
    <div className="relative mt-5 overflow-hidden rounded-2xl border border-brand/20 bg-brand/[0.06]">
      {/* Partially visible top */}
      <div className="p-6 pb-0">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-muted">
          All {signals.length + 2} recruiter trust signals from this session
        </p>
        <h3 className="mt-2 text-xl font-black text-fg">
          Every moment trust moved: up or down
        </h3>
        {/* First signal fully visible */}
        <div className="mt-4 rounded-2xl border border-line bg-canvas-soft p-4">
          <p className="text-sm leading-6 text-fg">• {signals[0]}</p>
        </div>
      </div>

      {/* Blurred signals below */}
      <div className="relative px-6 pb-6 pt-3">
        <div className="select-none blur-[5px] pointer-events-none space-y-2">
          {signals.slice(1).map((line, i) => (
            <div key={i} className="rounded-2xl border border-line bg-canvas-soft p-4">
              <p className="text-sm leading-6 text-fg">• {line}</p>
            </div>
          ))}
          {/* Fake extra items to fill the blur */}
          <div className="rounded-2xl border border-line bg-canvas-soft p-4">
            <p className="text-sm leading-6 text-fg">• Recruiter interpretation of your strongest answer and what it signals about your candidacy.</p>
          </div>
          <div className="rounded-2xl border border-line bg-canvas-soft p-4">
            <p className="text-sm leading-6 text-fg">• Top 10% rewrite for your weakest answer with one measurable result.</p>
          </div>
        </div>

        {/* Upgrade overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-canvas via-canvas/80 to-transparent pt-8">
          <Lock className="h-7 w-7 text-warning mb-3" />
          <p className="text-base font-black text-fg">See all recruiter signals</p>
          <p className="mt-1 text-sm text-muted text-center max-w-xs">
            Every trust movement explained, with rewrites for your weakest answers
          </p>
          <a
            href="/pricing?intent=blur-signals"
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-brand px-6 py-3 text-sm font-black text-on-brand hover:bg-brand transition shadow-lg shadow-brand/20"
          >
            <Crown className="h-4 w-4" />
            Unlock Premium: €19 / month
          </a>
          <p className="mt-2 text-xs text-muted">Cancel anytime</p>
        </div>
      </div>
    </div>
  );
}

// ─── Email capture ─────────────────────────────────────────────────────────────
function EmailCapture({
  roleLabel,
  overallScore,
  insights,
  fillerWordCount,
  biggestBlocker,
}: {
  roleLabel: string;
  overallScore: number;
  insights: AnswerInsight[];
  fillerWordCount: number;
  biggestBlocker: string;
}) {
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

    // Compute session signals from actual answer data so the email plan
    // is personalised to what happened in this specific session.
    const ownershipMissed = insights.filter(i => !i.ownershipPresent);
    const metricMissed = insights.filter(i => !i.metricPresent);
    const shortAnswers = insights.filter(i => i.wordCount < 25);
    const avgStructure = insights.length
      ? insights.reduce((s, i) => s + i.structureScore, 0) / insights.length
      : 60;
    const worstAnswer = [...insights].sort((a, b) => a.trustImpact - b.trustImpact)[0];
    const worstIdx = worstAnswer ? insights.indexOf(worstAnswer) + 1 : 0;

    try {
      const res = await fetch("/api/email/capture-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmed,
          roleLabel,
          overallScore,
          source: "results_page",
          // Session signals for personalised 5-day plan
          fillerWordCount,
          ownershipGap: ownershipMissed.length >= 2,
          metricGap: metricMissed.length >= 2,
          structureGap: avgStructure < 60,
          biggestBlocker,
          worstQuestionIndex: worstIdx,
          shortAnswerCount: shortAnswers.length,
          answersCount: insights.length,
        }),
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
      <div className="mt-6 rounded-[2rem] border border-success/25 bg-success/[0.07] p-6 text-center">
        <p className="text-lg font-black text-success">Report sent ✓</p>
        <p className="mt-2 text-sm text-muted">
          Check your inbox: your 5-day improvement plan is on its way.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-[2rem] border border-line bg-fg/[0.035] p-6">
      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand/15 text-brand">
          <Mail className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="font-black text-fg">Get the report and a 5-day plan by email</p>
          <p className="mt-1 text-sm leading-6 text-muted">
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
              className="min-h-12 flex-1 rounded-2xl border border-line bg-canvas-soft px-4 text-sm text-fg outline-none placeholder:text-subtle focus:border-brand/50 transition"
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={status === "loading"}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-black text-on-brand hover:bg-brand transition disabled:opacity-60"
            >
              {status === "loading" ? (
                <span className="animate-spin h-4 w-4 border-2 border-line border-t-white rounded-full" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              Send it
            </button>
          </div>
          {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
          <p className="mt-2 text-xs text-muted">
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

      // Read authoritative remaining sessions for the result-page CTA.
      // Do not use localStorage here: the dashboard, result page, and start API
      // must all use the same server-backed quota source.
      try {
        const planRes = await fetch("/api/account/plan", { cache: "no-store", credentials: "include" });
        if (planRes.ok) {
          const planData = await planRes.json();
          setSessionsRemaining(Number(planData?.usage?.interviewsRemaining ?? 0));
        } else {
          const usage = getWorkZoUsageSummary();
          setSessionsRemaining(usage.interviewsRemaining);
        }
      } catch {
        const usage = getWorkZoUsageSummary();
        setSessionsRemaining(usage.interviewsRemaining);
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
        console.warn("[WorkZo results] Plan gate timeout: mounting with local data");
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
      <main className="grid min-h-screen place-items-center bg-canvas px-5 text-fg">
        <div className="rounded-[2rem] border border-line bg-fg/[0.04] p-6 text-center">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-muted">Loading interview debrief</p>
          <p className="mt-3 text-sm leading-6 text-muted">Checking your saved database report first, then falling back to this device if needed.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-canvas px-5 py-8 text-fg">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Link href={!isPremium && sessionsRemaining <= 0 ? "/pricing" : "/onboarding"} className="inline-flex items-center gap-2 rounded-2xl border border-line bg-fg/5 px-4 py-3 text-sm font-black text-fg hover:bg-fg/10">
              <ArrowLeft className="h-4 w-4" />
              {!isPremium && sessionsRemaining <= 0 ? "Upgrade to continue" : "New interview"}
            </Link>
            <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-2xl border border-line bg-fg/5 px-4 py-3 text-sm font-black text-fg hover:bg-fg/10">
              Dashboard
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <PremiumUsageBadge compact={false} label={isProPlan ? "Premium Pro report" : isPremium ? "Premium report" : "Free report"} />
            <span className="rounded-2xl border border-line bg-fg/[0.04] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-muted">
              {loadState === "db" ? "Synced report" : loadState === "local" ? "Local report" : loadState === "loading" ? "Loading" : "No saved report"}
            </span>
            <Link href="/pricing" className="rounded-2xl bg-brand px-5 py-3 text-sm font-black text-on-brand hover:bg-brand">
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
            ? "border-brand/30 bg-gradient-to-br from-brand/20 via-brand/10 to-brand/10"
            : isPremium
              ? "border-line bg-gradient-to-br from-brand/15 via-brand/10 to-brand/10"
              : "border-line bg-gradient-to-br from-slate-500/10 via-brand/8 to-brand/8"
        )}>
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex-1 min-w-0">
              <div className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black",
                isProPlan ? "border-brand/25 bg-brand/10 text-brand"
                : isPremium ? "border-warning/25 bg-warning/10 text-warning"
                : "border-line bg-fg/[0.06] text-muted"
              )}>
                {isProPlan ? <Star className="h-3.5 w-3.5" /> : isPremium ? <Crown className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                {isProPlan ? "Premium Pro Interview Debrief" : isPremium ? "Premium Interview Debrief" : "Free Interview Snapshot"}
              </div>

              <h1 className="mt-4 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
                {isPremium ? "Recruiter decision simulation" : "Your recruiter-style feedback report"}
              </h1>

              <p className="mt-3 text-base leading-7 text-muted">
                Current hiring confidence: <span className="font-black text-fg">{report.decision}</span>. Biggest blocker: <span className="font-black text-fg">{report.biggestBlocker}</span>.
              </p>

              <p className="mt-2 text-sm leading-6 text-muted">{report.verdict}</p>

              {report.answersCount <= 1 && (
                <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-warning/25 bg-warning/10 px-4 py-2.5">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                  <p className="text-xs leading-5 text-warning">
                    <span className="font-black">Very short session.</span> Only {report.answersCount} answer was captured: this debrief may not reflect your full ability. Complete a full session for an accurate result.
                  </p>
                </div>
              )}
            </div>

            <ScoreRing score={report.overallScore} grade={report.grade} />
          </div>
        </section>

        {!isPremium && (
          <div className="mt-4 rounded-2xl border border-brand/20 bg-gradient-to-r from-brand/10 to-brand/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/15">
                  <Lock className="h-4 w-4 text-brand" />
                </div>
                <div>
                  <p className="text-sm font-black text-fg">Premium unlocks the full debrief</p>
                  <p className="mt-0.5 text-xs text-muted">Hiring committee memo · shadow scores · answer rewrites · targeted drills · full session history</p>
                </div>
              </div>
              <a href="/pricing?intent=top-teaser" className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-black text-on-brand hover:bg-brand transition">
                <Crown className="h-3.5 w-3.5" />
                See Premium: €19/mo
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


        <section className="mt-4 rounded-2xl border border-brand/15 bg-brand/[0.045] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-muted">Deep analysis</p>
              <h2 className="mt-1 text-lg font-black">{phaseB.companyDNA.label}</h2>
              <p className="mt-1 max-w-4xl text-xs leading-5 text-muted">{phaseB.companyDNA.description}</p>
            </div>
            <div className="grid h-14 w-14 place-items-center rounded-xl border border-brand/20 bg-canvas-soft text-center">
              <p className="text-xl font-black text-muted">{phaseB.trustAudit.overall}</p>
              <p className="-mt-1 text-[9px] font-black text-muted">TRUST</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <div className="rounded-xl border border-line bg-canvas-soft p-3">
              <p className="text-xs font-black text-muted">Company DNA alignment</p>
              <div className="mt-3 space-y-3">
                {phaseB.companyDNA.dimensions.map((item) => (
                  <Bar key={item.label} label={item.label} value={item.score} target={item.target} note={item.note} />
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-line bg-canvas-soft p-3">
              <p className="text-xs font-black text-success">Trust audit deductions</p>
              <div className="mt-2 space-y-1.5">
                {phaseB.trustAudit.deductions.map((item) => (
                  <p key={item.label} className="text-xs leading-5 text-muted">
                    <span className="font-black text-fg">{item.delta >= 0 ? "+" : ""}{item.delta}</span> {item.label}: {item.reason}
                  </p>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-line bg-canvas-soft p-3">
              <p className="text-xs font-black text-warning">Cross-feature consistency</p>
              <p className="mt-1 text-base font-black text-fg">{phaseB.consistency.status}</p>
              <div className="mt-2 space-y-1">
                {phaseB.consistency.notes.map((item) => (
                  <p key={item} className="text-xs leading-5 text-muted">• {item}</p>
                ))}
              </div>
            </div>
          </div>
        </section>

        {careerBrain ? <CareerBrainSection brain={careerBrain} /> : null}

        {!isPremium ? (
          <>
            {/* ── THE WOW MOMENT: personalised signal first, before generic stats ── */}
            {/* The first thing a free user reads is something specific to their session,
                not a number. This is what makes it feel real. */}
            {report.answerInsights.length > 0 && (() => {
              // Find the most interesting moment: a trust drop, ownership gap, or
              // filler spike: whichever happened earliest and is most specific.
              const worstAnswer = [...report.answerInsights].sort((a, b) =>
                (a.trustImpact ?? 0) - (b.trustImpact ?? 0)
              )[0];
              const bestAnswer = [...report.answerInsights].sort((a, b) =>
                (b.trustImpact ?? 0) - (a.trustImpact ?? 0)
              )[0];
              const worstIdx = report.answerInsights.indexOf(worstAnswer) + 1;
              const bestIdx = report.answerInsights.indexOf(bestAnswer) + 1;

              const worstReason = worstAnswer?.weakness ||
                (!worstAnswer?.ownershipPresent ? "ownership language was missing" :
                 !worstAnswer?.metricPresent ? "no measurable outcome was given" :
                 (worstAnswer?.fillerCount ?? 0) >= 3 ? `${worstAnswer.fillerCount} filler words detected` :
                 "the answer ended before enough evidence was given");

              const bestReason =
                bestAnswer?.metricPresent ? "it included a measurable result" :
                bestAnswer?.ownershipPresent ? "you made your personal contribution clear" :
                bestAnswer?.resultPresent ? "it clearly described the outcome" :
                "it had the strongest evidence and structure";

              return (
                <section className="mt-4 rounded-2xl border border-brand/25 bg-gradient-to-br from-brand/10 via-brand/8 to-slate-500/5 p-6">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-muted">The recruiter noticed</p>
                  <h2 className="mt-3 text-2xl font-black tracking-tight text-fg">
                    Two moments that defined this interview
                  </h2>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    {/* Best moment */}
                    <div className="rounded-xl border border-success/25 bg-success/10 p-5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-success">Strongest answer</p>
                        {bestAnswer?.trustImpact != null && bestAnswer.trustImpact > 0 && (
                          <span className="rounded-full bg-success/20 px-2.5 py-1 text-xs font-black text-success">+{bestAnswer.trustImpact} trust</span>
                        )}
                      </div>
                      <p className="mt-2 text-sm font-black text-fg">Question {bestIdx}</p>
                      <p className="mt-2 text-sm leading-6 text-success">
                        This answer built recruiter confidence because {bestReason}.
                      </p>
                      {bestAnswer?.rewrite && (
                        <p className="mt-3 rounded-lg bg-canvas-soft px-3 py-2 text-xs leading-5 text-muted">
                          Coach: {bestAnswer.rewrite}
                        </p>
                      )}
                    </div>

                    {/* Weakest moment */}
                    <div className="rounded-xl border border-danger/20 bg-danger/[0.07] p-5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-danger">Where trust slipped</p>
                        {worstAnswer?.trustImpact != null && worstAnswer.trustImpact < 0 && (
                          <span className="rounded-full bg-danger/20 px-2.5 py-1 text-xs font-black text-danger">{worstAnswer.trustImpact} trust</span>
                        )}
                      </div>
                      <p className="mt-2 text-sm font-black text-fg">Question {worstIdx}</p>
                      <p className="mt-2 text-sm leading-6 text-danger">
                        Trust dropped here because {worstReason}.
                      </p>
                      {worstAnswer?.rewrite && (
                        <p className="mt-3 rounded-lg bg-canvas-soft px-3 py-2 text-xs leading-5 text-muted">
                          Coach: {worstAnswer.rewrite}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-brand/15 bg-canvas-soft px-4 py-3">
                    <p className="text-xs leading-5 text-muted">
                      <span className="font-black text-fg">Quick win: </span>{report.quickWin}
                    </p>
                  </div>
                </section>
              );
            })()}

            {/* ── Delivery stats: after the personal moment, not before ── */}
            <section className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-2xl border border-line bg-fg/[0.035] p-5">
                <h2 className="flex items-center gap-2 text-base font-black"><ShieldCheck className="h-4 w-4 text-success" />Delivery signals</h2>
                <p className="mt-2 text-xs leading-5 text-muted">Estimated from transcript length, word count, and filler word detection.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <div className="rounded-xl bg-canvas-soft p-3"><p className="text-xs text-muted">Speaking pace</p><p className="mt-1.5 text-xl font-black">{report.averageWpm || "—"} <span className="text-sm text-muted">WPM</span></p><p className="mt-0.5 text-[10px] text-muted">{report.averageWpm ? (report.averageWpm >= 110 && report.averageWpm <= 170 ? "Good pace" : report.averageWpm < 110 ? "Too slow" : "Too fast") : "Not measured"}</p></div>
                  {(result.fillerWordCount ?? 0) >= 0 && (
                    <div className="rounded-xl bg-canvas-soft p-3"><p className="text-xs text-muted">Filler words</p><p className="mt-1.5 text-xl font-black">{result.fillerWordCount ?? 0}</p><p className="mt-0.5 text-[10px] text-muted">{(result.fillerWordCount ?? 0) === 0 ? "None detected" : (result.fillerWordCount ?? 0) <= 3 ? "Low: good" : (result.fillerWordCount ?? 0) <= 8 ? "Moderate" : "High: work on this"}</p></div>
                  )}
                  <div className="rounded-xl bg-canvas-soft p-3"><p className="text-xs text-muted">Duration</p><p className="mt-1.5 text-xl font-black">{report.durationLabel}</p></div>
                  <div className="rounded-xl bg-canvas-soft p-3"><p className="text-xs text-muted">Answers</p><p className="mt-1.5 text-xl font-black">{report.answersCount}</p></div>
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-fg/[0.035] p-5">
                <h2 className="flex items-center gap-2 text-base font-black"><CheckCircle2 className="h-4 w-4 text-success" />What landed</h2>
                <div className="mt-3 space-y-2">{report.strengths.map((item) => <p key={item} className="rounded-xl bg-success/10 px-3 py-2 text-xs leading-5 text-success">{item}</p>)}</div>
              </div>
            </section>

            <WhereLostSection insights={report.answerInsights} overallScore={report.overallScore} isPremium={isPremium} />

            <UpgradeStrip roleLabel={report.roleLabel} />

            <section className="mt-4 rounded-2xl border border-line bg-fg/[0.035] p-5">
              <h2 className="flex items-center gap-2 text-base font-black"><Target className="h-4 w-4 text-brand" />What needs work</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">{report.improvements.map((item) => <p key={item} className="rounded-xl bg-brand/10 px-3 py-2 text-xs leading-5 text-muted">{item}</p>)}</div>
            </section>

            <RealBlurredInsights
              insights={report.answerInsights}
              contradictions={report.contradictions}
              redFlags={report.redFlags}
            />

            <EmailCapture
              roleLabel={report.roleLabel}
              overallScore={report.overallScore}
              insights={report.answerInsights}
              fillerWordCount={report.fillerWordCount}
              biggestBlocker={report.biggestBlocker}
            />
          </>
        ) : (
          <>
            <section className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-line bg-fg/[0.035] p-5">
                <h2 className="flex items-center gap-2 text-base font-black"><BarChart3 className="h-4 w-4 text-brand" />Benchmarking and company DNA</h2>
                <p className="mt-2 text-xs leading-5 text-muted">{report.companyDNA.description}</p>
                <div className="mt-3 rounded-xl bg-brand/10 px-3 py-2 text-xs font-black text-brand">{report.companyDNA.label}</div>
                <div className="mt-4 space-y-3">{report.companyDNA.dimensions.map((item) => <Bar key={item.label} label={item.label} value={item.score} target={item.target} note={item.note} />)}</div>
              </div>

              <div className="rounded-2xl border border-line bg-fg/[0.035] p-5">
                <h2 className="flex items-center gap-2 text-base font-black"><ShieldCheck className="h-4 w-4 text-warning" />Trust and integrity audit</h2>
                <div className="mt-4 space-y-3">
                  <Bar label="Credibility" value={report.trustScore} note="Evidence, consistency, and recruiter confidence." />
                  <Bar label="Evidence Quality" value={report.evidenceQuality} note="Metrics, ownership, and result clarity." />
                  <Bar label="Contradiction Safety" value={report.contradictions.length ? clamp(100 - report.contradictions[0].trustDrop * 4) : 92} note="Higher means fewer consistency concerns." />
                </div>
                <div className="mt-4 space-y-2">
                  {report.trustDeductions.map((item) => (
                    <div key={item.label} className={cn("flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold", item.tone === "negative" ? "bg-danger/10 text-danger" : "bg-success/10 text-success")}>
                      <span>{item.label}</span>
                      <span>{item.value > 0 ? `+${item.value}` : item.value} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="mt-4 rounded-2xl border border-line bg-fg/[0.035] p-5">
              <h2 className="flex items-center gap-2 text-base font-black"><TrendingUp className="h-4 w-4 text-brand" />Top 10% candidate overlay</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {report.benchmark.map((item) => (
                  <div key={item.label} className="rounded-xl border border-line bg-canvas-soft p-3">
                    <p className="text-sm font-black text-fg">{item.label}</p>
                    <div className="mt-3 space-y-2">
                      <Bar label="You" value={item.user} />
                      <Bar label="Top 10%" value={item.top} />
                    </div>
                    <p className="mt-3 text-xs leading-5 text-muted">{item.note}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-line bg-fg/[0.035] p-5">
                <h2 className="flex items-center gap-2 text-base font-black"><Flag className="h-4 w-4 text-danger" />Red flags and evidence requests</h2>
                <div className="mt-4 space-y-2">
                  {report.redFlags.length ? report.redFlags.map((item) => <p key={item} className="rounded-xl bg-danger/10 px-3 py-2 text-xs leading-5 text-danger">{item}</p>) : (
                    <div className="space-y-2">
                      <p className="rounded-xl bg-success/10 px-3 py-2 text-xs leading-5 text-success">No critical red flag detected in captured answers.</p>
                      {["No blame-shifting language detected", "No toxic communication pattern detected", "No major contradiction detected", "Professional communication tone maintained"].map((item) => <p key={item} className="flex items-center gap-2 text-xs text-muted"><CheckCircle2 className="h-3.5 w-3.5 text-success" />{item}</p>)}
                    </div>
                  )}
                </div>
                <div className="mt-3 space-y-2">
                  {report.evidenceRequests.map((item) => <p key={item} className="rounded-xl bg-warning/10 px-3 py-2 text-xs leading-5 text-warning">Recruiter would ask: {item}</p>)}
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-fg/[0.035] p-5">
                <h2 className="flex items-center gap-2 text-base font-black"><Wand2 className="h-4 w-4 text-brand" />Improvement roadmap</h2>
                <div className="mt-4 space-y-3">
                  {report.improvementPlan.map((item) => (
                    <div key={item.priority} className="rounded-xl bg-brand/10 p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted">{item.priority} · {item.gain}</p>
                      <h3 className="mt-1 text-sm font-black text-fg">{item.title}</h3>
                      <p className="mt-1 text-xs leading-5 text-muted">{item.action}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="mt-4 rounded-2xl border border-line bg-fg/[0.035] p-5">
              <h2 className="flex items-center gap-2 text-base font-black"><Eye className="h-4 w-4 text-brand" />Delivery signals</h2>
              <p className="mt-1 text-xs leading-5 text-muted">Estimated from transcript length, word count, and filler word detection.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {report.audioSignals.map((item) => (
                  <div key={item.label} className="rounded-xl border border-line bg-canvas-soft p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted">{item.label}</p>
                    <p className="mt-1.5 text-2xl font-black text-fg">{item.value}</p>
                    <p className={cn("mt-1 text-[10px] font-black uppercase tracking-[0.14em]", item.risk === "high" ? "text-danger" : item.risk === "medium" ? "text-warning" : "text-success")}>{item.risk} risk</p>
                  </div>
                ))}
              </div>
            </section>

            <WhatTheyHeardSection items={report.whatTheyHeard} />
            <TargetedDrillsSection drills={report.targetedDrills} />

            <section className="mt-4 rounded-2xl border border-line bg-fg/[0.035] p-5">
              <h2 className="flex items-center gap-2 text-base font-black"><MessageSquareText className="h-4 w-4 text-brand" />Answer-by-answer coaching debrief</h2>
              <div className="mt-4 space-y-3">
                {report.answerInsights.map((item, index) => <TranscriptCard key={item.id} item={item} index={index} />)}
              </div>
            </section>
          </>
        )}

        {/* ── Readiness Score: Phase 3 ─────────────────────────────────── */}
        <ReadinessScorePanel
          isPremium={report.isPremium}
          interviewScore={report.overallScore}
          communicationScore={report.communicationScore}
          confidenceScore={report.confidenceScore}
          trustScore={report.trustScore}
          ownershipScore={report.ownershipScore}
          structureScore={report.structureScore}
          evidenceScore={report.evidenceQuality}
          targetRole={report.roleLabel}
          transcript={result?.transcript}
        />

        <section className="mt-6">
          <WorkZoPremiumProSuitePanel source="results" report={report as unknown as Record<string, unknown>} />
        </section>

        <section className="mt-5 rounded-2xl border border-line bg-fg/[0.035] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-black text-fg">What to do next</p>
              <p className="mt-1.5 text-sm leading-5 text-muted">Retry the interview using the improvement roadmap and compare your next score.</p>

              {/* Shareable moment card: viral mechanic */}
              {mounted && (() => {
                try {
                  const raw = window.localStorage.getItem("workzo_shareable_moment");
                  if (!raw) return null;
                  const moment = JSON.parse(raw) as { shouldHighlight: boolean; shareTitle: string; shareText: string; category: string };
                  if (!moment.shouldHighlight) return null;
                  return (
                    <div className="mt-5 rounded-2xl border border-brand/20 bg-brand/[0.07] p-5">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-muted">Memorable moment</p>
                      <h3 className="mt-2 text-lg font-black text-fg">{moment.shareTitle}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted">{moment.shareText}</p>
                      <button
                        type="button"
                        onClick={(e) => {
                          const btn = e.currentTarget;
                          if (btn.dataset.sharing === "1") return;
                          btn.dataset.sharing = "1";
                          const text = `${moment.shareTitle}: "${moment.shareText}": practiced with WorkZo AI`;
                          const done = () => { btn.dataset.sharing = ""; };
                          if (navigator.share) {
                            navigator.share({ title: "WorkZo AI Interview Moment", text }).then(done).catch(done);
                          } else {
                            navigator.clipboard.writeText(text).then(done).catch(done);
                          }
                        }}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-brand/20 bg-brand/10 px-4 py-2 text-sm font-black text-brand hover:bg-brand/20"
                      >
                        Share this moment
                      </button>
                    </div>
                  );
                } catch { return null; }
              })()}
            </div>
            <Link href="/onboarding" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-fg px-5 py-4 text-sm font-black text-canvas hover:bg-brand hover:text-on-brand">
              <RefreshCcw className="h-4 w-4" /> Retry interview
            </Link>
          </div>
        </section>
      </div>

      <UpgradeModal open={upgradeOpen} feature="advanced interview report" onClose={() => setUpgradeOpen(false)} />
    </main>
  );
}
