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
  TrendingUp,
  Wand2,
  XCircle,
} from "lucide-react";

import UpgradeModal from "@/components/premium/UpgradeModal";
import PremiumUsageBadge from "@/components/premium/PremiumUsageBadge";
import { getWorkZoCurrentPlan, recordWorkZoReportViewed } from "@/lib/workzoUsageTracker";

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
};

const STORAGE_KEYS = [
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

  const evidenceQuality = numberOr(result.evidenceQuality, average(answerInsights.map((item) => item.evidenceScore), 58));
  const trustScore = numberOr(result.trustScore, average(answerInsights.map((item) => item.trustImpact), 62));
  const structureScore = average(answerInsights.map((item) => item.structureScore), 60);
  const ownershipScore = average(answerInsights.map((item) => item.ownershipPresent ? 78 : 48), 58);

  const communicationScore = numberOr(result.communicationScore, clamp(structureScore + (averageWpm >= 110 && averageWpm <= 170 ? 8 : -4)));
  const confidenceScore = numberOr(result.confidenceScore, clamp(trustScore - (answerInsights.some((item) => item.fillerCount >= 4) ? 8 : 0) + (ownershipScore >= 70 ? 4 : -3)));
  const roleCompetencyScore = numberOr(result.roleCompetencyScore, clamp((evidenceQuality * 0.58) + (structureScore * 0.22) + (ownershipScore * 0.2)));

  const overallScore = numberOr(
    result.overallScore,
    clamp((communicationScore * 0.22) + (confidenceScore * 0.18) + (roleCompetencyScore * 0.28) + (trustScore * 0.2) + (evidenceQuality * 0.12)),
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

  const trustDeductions = [
    { label: "Missing measurable impact", value: answerInsights.some((item) => !item.metricPresent) ? -12 : 5, tone: answerInsights.some((item) => !item.metricPresent) ? "negative" : "positive" as const },
    { label: "Personal ownership clarity", value: answerInsights.some((item) => !item.ownershipPresent) ? -8 : 6, tone: answerInsights.some((item) => !item.ownershipPresent) ? "negative" : "positive" as const },
    { label: "STAR structure", value: structureScore < 68 ? -7 : 5, tone: structureScore < 68 ? "negative" : "positive" as const },
    { label: "Consistency check", value: contradictions.length ? -10 : 4, tone: contradictions.length ? "negative" : "positive" as const },
  ];

  const companyDNA = buildCompanyDNA(companyLabel, roleLabel, answerInsights);

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
  };
}

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const angle = clamp(score) * 3.6;
  return (
    <div
      className="grid h-36 w-36 shrink-0 place-items-center rounded-full"
      style={{ background: `conic-gradient(#3b82f6 ${angle}deg, rgba(255,255,255,0.14) 0deg)` }}
    >
      <div className="grid h-28 w-28 place-items-center rounded-full bg-[#120b3d] text-center">
        <div>
          <p className="text-4xl font-black text-white">{score}</p>
          <p className="text-sm font-black text-blue-100">{grade} · /100</p>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, note }: { icon: typeof Gauge; label: string; value: number; note: string }) {
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-5">
      <Icon className="h-6 w-6 text-blue-300" />
      <p className="mt-6 text-xs font-black uppercase tracking-[0.28em] text-slate-500">{label}</p>
      <p className="mt-3 text-4xl font-black text-white">{value}%</p>
      <p className="mt-3 text-sm leading-6 text-slate-400">{note}</p>
    </div>
  );
}

function Bar({ value, target, label, note }: { value: number; target?: number; label: string; note?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="font-black text-white">{label}</p>
        <p className="font-black text-blue-100">{value}%{typeof target === "number" ? ` / ${target}%` : ""}</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-300" style={{ width: `${clamp(value)}%` }} />
      </div>
      {note ? <p className="mt-2 text-sm leading-6 text-slate-400">{note}</p> : null}
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
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/20">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-4 p-5 text-left"
      >
        <div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-blue-200">Question {index + 1}</p>
          <h3 className="mt-2 text-xl font-black text-white">{item.question}</h3>
          <p className="mt-2 text-sm text-slate-400">Evidence {item.evidenceScore}% · Trust impact {item.trustImpact}% · {item.weakness}</p>
        </div>
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-slate-300 transition", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="grid gap-4 border-t border-white/10 p-5 xl:grid-cols-3">
          <div className="rounded-2xl bg-white/[0.04] p-4">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Your answer</p>
            <p className="mt-3 text-sm leading-7 text-slate-200">{item.answer}</p>
          </div>
          <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-amber-200">What the recruiter heard</p>
            <p className="mt-3 text-sm leading-7 text-amber-50">{item.recruiterHeard}</p>
          </div>
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-200">Top 10% rewrite</p>
            <p className="mt-3 text-sm leading-7 text-emerald-50">{item.rewrite}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ResultsPage() {
  const [mounted, setMounted] = useState(false);
  const [result, setResult] = useState<StoredResult>({});
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  useEffect(() => {
    setResult(readStoredResult());
    setMounted(true);
    try {
      recordWorkZoReportViewed();
    } catch {
      // Analytics should never block the report.
    }
  }, []);

  const isPremium = useMemo(() => {
    if (result.isPremium) return true;
    if (String(result.plan || "").toLowerCase().includes("premium")) return true;
    try {
      return getWorkZoCurrentPlan() === "premium";
    } catch {
      return false;
    }
  }, [result]);

  const report = useMemo(() => buildRichReport(result, isPremium), [result, isPremium]);

  if (!mounted) {
    return <main className="min-h-screen bg-[#050a12] text-white" />;
  }

  return (
    <main className="min-h-screen bg-[#050a12] px-5 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-slate-200 hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
            Back home
          </Link>

          <div className="flex items-center gap-3">
            <PremiumUsageBadge compact={false} label={isPremium ? "Premium report" : "Free report"} />
            <Link href="/pricing" className="rounded-2xl bg-blue-500 px-5 py-3 text-sm font-black text-white hover:bg-blue-400">
              {isPremium ? "Manage plan" : "Upgrade"}
            </Link>
          </div>
        </div>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-gradient-to-br from-violet-500/15 via-blue-500/10 to-cyan-500/10 p-7 md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-sm font-black text-amber-100">
                {isPremium ? <Crown className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                {isPremium ? "Premium Interview Debrief" : "Free Interview Snapshot"}
              </div>

              <h1 className="mt-6 max-w-5xl text-4xl font-black tracking-[-0.05em] sm:text-6xl">
                {isPremium ? "Recruiter decision simulation" : "Your recruiter-style feedback report"}
              </h1>

              <p className="mt-5 max-w-4xl text-lg leading-8 text-blue-100">
                Current hiring confidence: <span className="font-black text-white">{report.decision}</span>. Biggest blocker: <span className="font-black text-white">{report.biggestBlocker}</span>.
              </p>

              <p className="mt-4 max-w-4xl text-base leading-8 text-slate-300">
                {report.verdict}
              </p>
            </div>

            <ScoreRing score={report.overallScore} grade={report.grade} />
          </div>
        </section>

        <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={MessageSquareText} label="Communication" value={report.communicationScore} note="Clarity, answer length, and structure." />
          <MetricCard icon={Gauge} label="Confidence" value={report.confidenceScore} note="Pace, ownership, certainty, and delivery signals." />
          <MetricCard icon={Target} label="Role Competency" value={report.roleCompetencyScore} note="How relevant your evidence sounded for the role." />
          <MetricCard icon={ShieldCheck} label="Trust Signal" value={report.trustScore} note="Consistency, ownership, and proof strength." />
        </section>

        {!isPremium ? (
          <>
            <section className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
                <h2 className="flex items-center gap-3 text-2xl font-black"><ShieldCheck className="h-6 w-6 text-emerald-300" />Sentiment snapshot</h2>
                <p className="mt-4 text-base leading-8 text-slate-200">You showed useful role fit, but the recruiter still needs sharper metrics, ownership, or structure.</p>
                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl bg-black/20 p-4"><p className="text-sm text-slate-400">Avg. pace</p><p className="mt-2 text-2xl font-black">{report.averageWpm || "—"} WPM</p></div>
                  <div className="rounded-2xl bg-black/20 p-4"><p className="text-sm text-slate-400">Duration</p><p className="mt-2 text-2xl font-black">{report.durationLabel}</p></div>
                  <div className="rounded-2xl bg-black/20 p-4"><p className="text-sm text-slate-400">Answers</p><p className="mt-2 text-2xl font-black">{report.answersCount}</p></div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-emerald-300/20 bg-emerald-400/10 p-6">
                <h2 className="flex items-center gap-3 text-2xl font-black"><Lightbulb className="h-6 w-6 text-emerald-200" />One quick win</h2>
                <p className="mt-4 text-base leading-8 text-emerald-50">{report.quickWin}</p>
              </div>
            </section>

            <section className="mt-6 grid gap-5 lg:grid-cols-2">
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
                <h2 className="flex items-center gap-3 text-2xl font-black"><CheckCircle2 className="h-6 w-6 text-emerald-300" />Strengths</h2>
                <div className="mt-5 space-y-3">{report.strengths.map((item) => <p key={item} className="rounded-2xl bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-50">{item}</p>)}</div>
              </div>
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
                <h2 className="flex items-center gap-3 text-2xl font-black"><Target className="h-6 w-6 text-blue-300" />Improvements</h2>
                <div className="mt-5 space-y-3">{report.improvements.map((item) => <p key={item} className="rounded-2xl bg-blue-400/10 p-4 text-sm leading-6 text-blue-50">{item}</p>)}</div>
              </div>
            </section>

            <section className="mt-6 grid gap-5 lg:grid-cols-2">
              <LockedPreview title="Detected red flags & contradictions" count={`${report.redFlags.length} red flag signal(s), ${report.contradictions.length} contradiction concern(s)`}>
                <div className="space-y-3">
                  <p className="rounded-2xl bg-white/10 p-4">Trust deduction audit</p>
                  <p className="rounded-2xl bg-white/10 p-4">Contradiction timeline</p>
                  <p className="rounded-2xl bg-white/10 p-4">Evidence request script</p>
                </div>
              </LockedPreview>
              <LockedPreview title="Question-by-question feedback timeline" count={`${report.answersCount || 1} answer(s) analyzed`}>
                <div className="space-y-3">
                  {report.answerInsights.slice(0, 3).map((item, index) => (
                    <div key={item.id} className="rounded-2xl bg-white/10 p-4">
                      <p>Q{index + 1}: {item.question}</p>
                      <p className="mt-2">Recruiter interpretation and rewrite locked.</p>
                    </div>
                  ))}
                </div>
              </LockedPreview>
            </section>
          </>
        ) : (
          <>
            <section className="mt-6 grid gap-5 lg:grid-cols-2">
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
                <h2 className="flex items-center gap-3 text-2xl font-black"><BarChart3 className="h-6 w-6 text-cyan-300" />Benchmarking & Company DNA</h2>
                <p className="mt-4 text-base leading-8 text-slate-300">{report.companyDNA.description}</p>
                <div className="mt-5 rounded-2xl bg-blue-400/10 p-4 text-sm font-black text-blue-100">{report.companyDNA.label}</div>
                <div className="mt-6 space-y-5">{report.companyDNA.dimensions.map((item) => <Bar key={item.label} label={item.label} value={item.score} target={item.target} note={item.note} />)}</div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
                <h2 className="flex items-center gap-3 text-2xl font-black"><ShieldCheck className="h-6 w-6 text-amber-200" />Trust & Integrity Audit</h2>
                <div className="mt-6 space-y-5">
                  <Bar label="Credibility" value={report.trustScore} note="Evidence, consistency, and recruiter confidence." />
                  <Bar label="Evidence Quality" value={report.evidenceQuality} note="Metrics, ownership, and result clarity." />
                  <Bar label="Contradiction Safety" value={report.contradictions.length ? clamp(100 - report.contradictions[0].trustDrop * 4) : 92} note="Higher means fewer consistency concerns." />
                </div>
                <div className="mt-6 space-y-3">
                  {report.trustDeductions.map((item) => (
                    <div key={item.label} className={cn("flex items-center justify-between rounded-2xl p-4 text-sm font-bold", item.tone === "negative" ? "bg-rose-400/10 text-rose-100" : "bg-emerald-400/10 text-emerald-100")}>
                      <span>{item.label}</span>
                      <span>{item.value > 0 ? `+${item.value}` : item.value} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
              <h2 className="flex items-center gap-3 text-2xl font-black"><TrendingUp className="h-6 w-6 text-blue-300" />Top 10% Candidate Overlay</h2>
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {report.benchmark.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="font-black text-white">{item.label}</p>
                    <div className="mt-4 space-y-3">
                      <Bar label="You" value={item.user} />
                      <Bar label="Top 10%" value={item.top} />
                    </div>
                    <p className="mt-4 text-sm leading-6 text-slate-400">{item.note}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-6 grid gap-5 lg:grid-cols-2">
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
                <h2 className="flex items-center gap-3 text-2xl font-black"><Flag className="h-6 w-6 text-rose-300" />Red Flags & Evidence Requests</h2>
                <div className="mt-6 space-y-3">
                  {report.redFlags.length ? report.redFlags.map((item) => <p key={item} className="rounded-2xl bg-rose-400/10 p-4 text-sm leading-6 text-rose-50">{item}</p>) : (
                    <div className="space-y-3">
                      <p className="rounded-2xl bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-50">No critical red flag detected in captured answers.</p>
                      {["No blame-shifting language detected", "No toxic communication pattern detected", "No major contradiction detected", "Professional communication tone maintained"].map((item) => <p key={item} className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 className="h-4 w-4 text-emerald-300" />{item}</p>)}
                    </div>
                  )}
                </div>
                <div className="mt-6 space-y-3">
                  {report.evidenceRequests.map((item) => <p key={item} className="rounded-2xl bg-amber-400/10 p-4 text-sm leading-6 text-amber-50">Recruiter would ask: {item}</p>)}
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
                <h2 className="flex items-center gap-3 text-2xl font-black"><Wand2 className="h-6 w-6 text-violet-300" />Improvement Roadmap</h2>
                <div className="mt-6 space-y-4">
                  {report.improvementPlan.map((item) => (
                    <div key={item.priority} className="rounded-2xl bg-violet-400/10 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.25em] text-violet-200">{item.priority} · {item.gain}</p>
                      <h3 className="mt-2 font-black text-white">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{item.action}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
              <h2 className="flex items-center gap-3 text-2xl font-black"><Eye className="h-6 w-6 text-blue-300" />Audio & Presentation Timeline Analysis</h2>
              <p className="mt-4 text-sm leading-7 text-slate-300">WorkZo currently estimates delivery risk from transcript length and filler words. Real audio/camera analysis can be connected later without changing this report structure.</p>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {report.audioSignals.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="font-black text-white">{item.label}</p>
                    <p className="mt-3 text-3xl font-black">{item.value}</p>
                    <p className={cn("mt-2 text-xs font-black uppercase", item.risk === "high" ? "text-rose-300" : item.risk === "medium" ? "text-amber-300" : "text-emerald-300")}>{item.risk} risk</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-7 text-slate-300">
                Presence & eye-contact metrics are not captured yet. This section is ready for future camera signals, but it does not pretend to analyze video that was not recorded.
              </div>
            </section>

            <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
              <h2 className="flex items-center gap-3 text-2xl font-black"><MessageSquareText className="h-6 w-6 text-cyan-300" />Interactive Transcript & Coaching Debrief</h2>
              <div className="mt-6 space-y-4">
                {report.answerInsights.map((item, index) => <TranscriptCard key={item.id} item={item} index={index} />)}
              </div>
            </section>
          </>
        )}

        <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-black text-white">Next best action</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">Retry the interview using the improvement roadmap and compare your next score.</p>
            </div>
            <Link href="/interview" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 text-sm font-black text-slate-950 hover:bg-slate-200">
              <RefreshCcw className="h-4 w-4" /> Retry interview
            </Link>
          </div>
        </section>
      </div>

      <UpgradeModal open={upgradeOpen} feature="advanced interview report" onClose={() => setUpgradeOpen(false)} />
    </main>
  );
}
