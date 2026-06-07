"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Crown,
  Eye,
  Flag,
  Gauge,
  Lightbulb,
  Lock,
  MessageSquareText,
  Mic2,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Wand2,
} from "lucide-react";

import UpgradeModal from "@/components/premium/UpgradeModal";
import PremiumUsageBadge from "@/components/premium/PremiumUsageBadge";
import { getWorkZoPlanLimits } from "@/lib/workzoPlanLimits";
import {
  getWorkZoCurrentPlan,
  recordWorkZoReportViewed,
} from "@/lib/workzoUsageTracker";

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

type WeakAnswer = {
  question?: string;
  answer?: string;
  reason?: string;
  betterAnswer?: string;
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
  weakAnswers?: WeakAnswer[];
  contradictions?: string[];
  evidenceRequests?: string[];
  redFlags?: string[];
  trustTimeline?: Array<{ label?: string; score?: number; reason?: string; evidence?: string }>;
  transcript?: TranscriptTurn[];
  messages?: TranscriptTurn[];
  answers?: TranscriptTurn[];
  transcriptTimeline?: TranscriptTurn[];
  report?: Record<string, unknown>;
  intelligence?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

type AnswerInsight = {
  id: string;
  question: string;
  answer: string;
  wordCount: number;
  estimatedWpm: number;
  fillerCount: number;
  pauseRisk: "low" | "medium" | "high";
  metricPresent: boolean;
  ownershipPresent: boolean;
  resultPresent: boolean;
  structurePresent: boolean;
  roleRelevancePresent: boolean;
  blameShiftDetected: boolean;
  vagueLanguageDetected: boolean;
  structureScore: number;
  evidenceScore: number;
  confidenceScore: number;
  trustImpact: number;
  weakness: string;
  whatRecruiterHeard: string;
  betterAnswer: string;
  redFlags: string[];
  benchmarkGap: string;
};

type CompanyDNA = {
  label: string;
  description: string;
  interviewerMode: string;
  dimensions: Array<{ label: string; score: number; target: number; note: string }>;
};

type ContradictionAudit = {
  severity: number;
  title: string;
  detail: string;
  trustDrop: number;
  challengePrompt: string;
};

type RichReport = {
  overallScore: number;
  grade: string;
  communicationScore: number;
  confidenceScore: number;
  roleCompetencyScore: number;
  trustScore: number;
  evidenceQuality: number;
  contradictionRisk: number;
  durationLabel: string;
  durationSeconds: number;
  answersCount: number;
  averageWpm: number;
  recruiterName: string;
  roleLabel: string;
  companyLabel: string;
  verdictTitle: string;
  verdictBody: string;
  sentiment: string;
  quickWin: string;
  strengths: string[];
  improvements: string[];
  answerInsights: AnswerInsight[];
  contradictions: ContradictionAudit[];
  redFlags: string[];
  evidenceRequests: string[];
  companyDNA: CompanyDNA;
  benchmark: Array<{ label: string; user: number; top: number; note: string }>;
  vocalFillers: Array<{ label: string; count: number; risk: "low" | "medium" | "high" }>;
  improvementPlan: Array<{ title: string; action: string }>;
  trustTimeline: Array<{ label: string; score: number; reason: string; evidence: string }>;
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

function average(values: number[], fallback = 0) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return fallback;
  return clamp(clean.reduce((sum, value) => sum + value, 0) / clean.length);
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function cleanText(value: unknown, max = 6000) {
  return typeof value === "string"
    ? value.replace(/\u0000/g, " ").replace(/\s+/g, " ").trim().slice(0, max)
    : "";
}

function normalizeList(value: unknown, fallback: string[], limit = 6) {
  if (Array.isArray(value)) {
    const items = value.map((item) => cleanText(item, 300)).filter(Boolean);
    if (items.length) return Array.from(new Set(items)).slice(0, limit);
  }
  return fallback.slice(0, limit);
}

function readJsonFromStorage(keys: string[]) {
  if (typeof window === "undefined") return null;

  for (const key of keys) {
    try {
      const local = window.localStorage.getItem(key);
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
      }

      const session = window.sessionStorage.getItem(key);
      if (session) {
        const parsed = JSON.parse(session);
        if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
      }
    } catch {
      // Continue to the next key.
    }
  }

  return null;
}

function readResultFromStorage(): StoredResult {
  const result = readJsonFromStorage(STORAGE_KEYS);
  const setup = readJsonFromStorage(SETUP_KEYS);
  return {
    ...(setup || {}),
    ...(result || {}),
  } as StoredResult;
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
  if (!text) return 0;

  const minuteMatch = text.match(/(\d+)\s*m/i);
  const secondMatch = text.match(/(\d+)\s*s/i);
  if (minuteMatch || secondMatch) {
    return Number(minuteMatch?.[1] || 0) * 60 + Number(secondMatch?.[1] || 0);
  }

  return 0;
}

function formatDuration(seconds: number) {
  if (!seconds) return "Not captured";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (!mins) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function getText(turn: TranscriptTurn) {
  return cleanText(turn.text || turn.content || turn.answer || turn.question || "");
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
    : Array.isArray(result.transcriptTimeline)
      ? result.transcriptTimeline
      : Array.isArray(result.messages)
        ? result.messages
        : Array.isArray(result.answers)
          ? result.answers
          : [];

  if (!source.length && Array.isArray(result.weakAnswers)) {
    return result.weakAnswers.map((item, index) => ({
      question: cleanText(item.question) || `Interview question ${index + 1}`,
      answer: cleanText(item.answer) || "Answer not captured.",
    }));
  }

  const pairs: Array<{ question: string; answer: string }> = [];
  let pendingQuestion = "";

  for (const turn of source) {
    const text = getText(turn);
    if (!text) continue;

    if (turn.question && turn.answer) {
      pairs.push({ question: cleanText(turn.question), answer: cleanText(turn.answer) });
      continue;
    }

    if (isRecruiterTurn(turn)) {
      pendingQuestion = text;
      continue;
    }

    if (isCandidateTurn(turn)) {
      pairs.push({
        question: pendingQuestion || `Interview question ${pairs.length + 1}`,
        answer: text,
      });
      pendingQuestion = "";
    }
  }

  return pairs.slice(0, 14);
}

function countWords(text: string) {
  return (text.match(/\b[\w'+-]+\b/g) || []).length;
}

function countFillers(text: string) {
  return (text.match(/\b(um|uh|like|basically|actually|sort of|kind of|you know|i mean)\b/gi) || []).length;
}

function hasMetric(text: string) {
  return /\b\d+\s*(%|percent|k|m|million|thousand|x|times|users|customers|hours|days|weeks|months|tickets|cases|revenue|cost|sla|nps|csat|projects|reports|calls|leads)\b/i.test(text);
}

function hasOwnership(text: string) {
  return /\b(i|my|me)\b/i.test(text) && /\b(led|owned|built|created|designed|implemented|resolved|improved|managed|delivered|automated|analyzed|analysed|coordinated|handled|drove|initiated)\b/i.test(text);
}

function hasResult(text: string) {
  return /\b(result|outcome|impact|improved|reduced|increased|saved|achieved|delivered|therefore|as a result|because of this|led to)\b/i.test(text) || hasMetric(text);
}

function hasStructure(text: string) {
  return /\b(situation|task|action|result|challenge|approach|outcome|impact|first|then|finally|because|therefore|as a result)\b/i.test(text);
}

function hasRoleRelevance(text: string) {
  return /\b(customer|client|stakeholder|team|technical|business|data|product|sales|support|engineering|delivery|quality|process|report|dashboard|system|user|revenue|operation|project)\b/i.test(text);
}

function detectBlameShift(text: string) {
  return /\b(they failed|team failed|manager failed|because of them|not my fault|they did not|they didn'?t|wasn'?t my responsibility)\b/i.test(text);
}

function detectVagueLanguage(text: string) {
  return /\b(stuff|things|various|many things|some tasks|helped with|worked on things|good communication|hard working|etcetera|etc\.)\b/i.test(text);
}

function detectRedFlags(answer: string) {
  const flags: string[] = [];
  if (/\b(my manager told me|just did what i was told|not my responsibility)\b/i.test(answer)) {
    flags.push("May sound low-ownership unless clarified.");
  }
  if (detectBlameShift(answer)) flags.push("Possible blame-shifting signal.");
  if (countWords(answer) < 18) flags.push("Answer may be too short for recruiter confidence.");
  if (countWords(answer) > 260) flags.push("Answer may be too long and unfocused.");
  if (!hasMetric(answer)) flags.push("No measurable outcome detected.");
  if (!hasOwnership(answer)) flags.push("Personal ownership is not clear enough.");
  if (detectVagueLanguage(answer)) flags.push("Vague wording may reduce credibility.");
  return flags.slice(0, 5);
}

function classifyPauseRisk(wordCount: number) {
  if (wordCount < 20) return "high" as const;
  if (wordCount > 220) return "medium" as const;
  return "low" as const;
}

function whatHeard(answer: string) {
  const words = countWords(answer);
  const metric = hasMetric(answer);
  const ownership = hasOwnership(answer);
  const result = hasResult(answer);
  const blame = detectBlameShift(answer);

  if (words < 22) return "The recruiter may feel the answer ended before enough proof was provided.";
  if (blame) return "The recruiter may hear a risk of blame-shifting rather than ownership under pressure.";
  if (!ownership && !metric) return "The recruiter hears useful background, but not enough proof of personal impact.";
  if (!metric) return "The recruiter may believe the story, but still wonder how impact was measured.";
  if (!ownership) return "The recruiter may not know which part was personally owned versus handled by the wider team.";
  if (!result) return "The recruiter hears action, but needs a clearer final outcome.";
  return "The recruiter hears a credible example with evidence, ownership, and role-relevant impact.";
}

function rewriteAnswer(question: string, answer: string) {
  if (!answer || /not captured/i.test(answer)) {
    return "Use a short STAR answer: situation, task, action, measurable result, and one sentence connecting it to the target role.";
  }

  const intro = /tell me about yourself|introduce|background/i.test(question)
    ? "My background is strongest when I connect my experience directly to this role."
    : "In that situation, I would structure the answer around the business problem, my ownership, and the measurable result.";

  const metricLine = hasMetric(answer)
    ? "I would keep the metric and make the result the final sentence so the recruiter remembers it."
    : "I would add one measurable outcome, such as time saved, tickets resolved, revenue impact, quality improved, or customer satisfaction change.";

  const ownershipLine = hasOwnership(answer)
    ? "I would make the ownership statement even clearer by saying exactly what I personally decided, built, or handled."
    : "I would add a clear ownership phrase: ‘I personally handled…’, ‘I owned…’, or ‘I led…’.";

  return `${intro} I would explain the context in one sentence, describe the exact action I personally took, and close with the outcome. ${ownershipLine} ${metricLine}`;
}

function analyzeAnswer(question: string, answer: string, index: number): AnswerInsight {
  const words = countWords(answer);
  const fillerCount = countFillers(answer);
  const metricPresent = hasMetric(answer);
  const ownershipPresent = hasOwnership(answer);
  const resultPresent = hasResult(answer);
  const structurePresent = hasStructure(answer);
  const roleRelevancePresent = hasRoleRelevance(answer);
  const blameShiftDetected = detectBlameShift(answer);
  const vagueLanguageDetected = detectVagueLanguage(answer);

  const structureScore = clamp(
    28 +
      (words >= 35 ? 14 : 0) +
      (words <= 180 && words > 0 ? 14 : 0) +
      (structurePresent ? 18 : 0) +
      (ownershipPresent ? 14 : 0) +
      (resultPresent ? 12 : 0) -
      (words > 260 ? 18 : 0),
  );

  const evidenceScore = clamp(
    25 +
      (metricPresent ? 28 : 0) +
      (ownershipPresent ? 18 : 0) +
      (resultPresent ? 17 : 0) +
      (roleRelevancePresent ? 12 : 0) -
      (vagueLanguageDetected ? 12 : 0),
  );

  const confidenceScore = clamp(
    40 +
      (words >= 35 ? 12 : -10) +
      (fillerCount <= 2 ? 10 : -8) +
      (ownershipPresent ? 14 : 0) +
      (structurePresent ? 10 : 0) -
      (blameShiftDetected ? 18 : 0),
  );

  const redFlags = detectRedFlags(answer);
  const trustImpact = clamp(average([structureScore, evidenceScore, confidenceScore], 55) - redFlags.length * 5);

  let weakness = "Good foundation; make the answer sharper with stronger structure.";
  if (!metricPresent) weakness = "Missing measurable evidence.";
  if (!ownershipPresent) weakness = "Personal ownership is not clear.";
  if (words < 18) weakness = "Answer is too short to evaluate deeply.";
  if (words > 260) weakness = "Answer is too long and may lose recruiter attention.";
  if (blameShiftDetected) weakness = "The answer may sound like blame-shifting under pressure.";

  let benchmarkGap = "Top candidates answer with a concrete situation, personal action, and measurable result.";
  if (!metricPresent) benchmarkGap = "Top candidates quantify the result instead of describing effort only.";
  if (!ownershipPresent) benchmarkGap = "Top candidates make personal decision-making and ownership unmistakable.";
  if (!structurePresent) benchmarkGap = "Top candidates organize answers with clear STAR flow.";

  return {
    id: `answer-${index + 1}`,
    question,
    answer,
    wordCount: words,
    estimatedWpm: words ? clamp(words / 1.4, 50, 210) : 0,
    fillerCount,
    pauseRisk: classifyPauseRisk(words),
    metricPresent,
    ownershipPresent,
    resultPresent,
    structurePresent,
    roleRelevancePresent,
    blameShiftDetected,
    vagueLanguageDetected,
    structureScore,
    evidenceScore,
    confidenceScore,
    trustImpact,
    weakness,
    whatRecruiterHeard: whatHeard(answer),
    betterAnswer: rewriteAnswer(question, answer),
    redFlags,
    benchmarkGap,
  };
}

function companyDNA(company: string, role: string, insights: AnswerInsight[]): CompanyDNA {
  const source = `${company} ${role}`.toLowerCase();
  const avgEvidence = average(insights.map((item) => item.evidenceScore), 62);
  const avgStructure = average(insights.map((item) => item.structureScore), 64);
  const avgTrust = average(insights.map((item) => item.trustImpact), 66);
  const avgConfidence = average(insights.map((item) => item.confidenceScore), 64);

  if (/amazon|aws/.test(source)) {
    return {
      label: "Amazon Bar Raiser Alignment",
      description: "Mapped to Amazon-style leadership signal expectations: ownership, evidence, customer impact, and ability to dive deep.",
      interviewerMode: "Bar Raiser: direct, evidence-heavy, skeptical of unsupported claims.",
      dimensions: [
        { label: "Customer Obsession", score: clamp(avgEvidence + 4), target: 88, note: "Needs customer/user impact evidence." },
        { label: "Ownership", score: avgTrust, target: 90, note: "Strong only when personal contribution is explicit." },
        { label: "Dive Deep", score: avgEvidence, target: 86, note: "Metrics, root-cause detail, and specificity matter heavily." },
        { label: "Bias for Action", score: clamp(avgStructure + 2), target: 84, note: "Clear action steps improve this score." },
      ],
    };
  }

  if (/mckinsey|consulting|consultant|bcg|bain/.test(source)) {
    return {
      label: "Consulting / MECE Alignment",
      description: "Mapped to consulting-style expectations: structured thinking, concise reasoning, quantified business impact, and executive communication.",
      interviewerMode: "Case-style interviewer: expects structured, MECE answers and clear trade-offs.",
      dimensions: [
        { label: "Structured Thinking", score: avgStructure, target: 90, note: "Answers need clean situation-task-action-result flow." },
        { label: "Business Impact", score: avgEvidence, target: 88, note: "Quantified outcomes are critical." },
        { label: "Executive Clarity", score: clamp(avgConfidence + 3), target: 86, note: "Lead with the conclusion and reduce rambling." },
        { label: "Prioritization", score: clamp(avgStructure - 2), target: 84, note: "Explain why your approach was the right one." },
      ],
    };
  }

  if (/google|meta|microsoft|software|engineer|developer|technical/.test(source)) {
    return {
      label: "Technical Company Alignment",
      description: "Mapped to technical-company expectations: problem solving, scale, collaboration, ownership, and measurable impact.",
      interviewerMode: "Technical hiring manager: tests clarity, trade-offs, depth, and evidence.",
      dimensions: [
        { label: "Technical Depth", score: avgEvidence, target: 86, note: "Use concrete systems, tools, constraints, or scale." },
        { label: "Ownership", score: avgTrust, target: 86, note: "Clarify what you personally built or decided." },
        { label: "Collaboration", score: clamp(avgStructure + 3), target: 82, note: "Explain stakeholders and trade-offs." },
        { label: "Impact", score: avgEvidence, target: 88, note: "Quantify user, speed, cost, quality, or revenue impact." },
      ],
    };
  }

  if (/startup|founder|early|scale|growth/.test(source)) {
    return {
      label: "Startup Readiness Alignment",
      description: "Mapped to startup expectations: ownership, speed, adaptability, customer learning, and measurable execution.",
      interviewerMode: "Startup recruiter: practical, fast-paced, ownership-first.",
      dimensions: [
        { label: "Ownership", score: avgTrust, target: 86, note: "Startups need self-directed execution." },
        { label: "Speed", score: avgStructure, target: 82, note: "Show fast decisions and iteration." },
        { label: "Customer Learning", score: avgEvidence, target: 84, note: "Connect work to users or market signal." },
        { label: "Adaptability", score: avgConfidence, target: 82, note: "Explain how you handled ambiguity." },
      ],
    };
  }

  return {
    label: "Role-Specific Company Alignment",
    description: "Mapped to general hiring expectations: clarity, ownership, role relevance, evidence, and communication maturity.",
    interviewerMode: "Professional recruiter: checks fit, consistency, motivation, and proof.",
    dimensions: [
      { label: "Role Fit", score: avgEvidence, target: 84, note: "Connect examples directly to the target role." },
      { label: "Ownership", score: avgTrust, target: 84, note: "Make personal contribution clearer." },
      { label: "Communication", score: avgStructure, target: 82, note: "Structure answers tightly." },
      { label: "Hiring Confidence", score: avgConfidence, target: 84, note: "Reduce vague or hesitant language." },
    ],
  };
}

function buildContradictions(result: StoredResult, insights: AnswerInsight[]): ContradictionAudit[] {
  const provided = normalizeList(result.contradictions, [], 6).map((item, index) => ({
    severity: index === 0 ? 4 : 3,
    title: "Consistency concern detected",
    detail: item,
    trustDrop: index === 0 ? 15 : 8,
    challengePrompt: `Earlier you said something that may conflict with this: ${item}. Can you clarify the exact context and your real responsibility?`,
  }));

  if (provided.length) return provided;

  const audits: ContradictionAudit[] = [];
  const allAnswers = insights.map((item) => item.answer).join(" ").toLowerCase();
  if (/\bled\b|\bmanaged\b|\bteam of\b/.test(allAnswers) && /\bno management\b|\bnever managed\b|\bdid not manage\b/.test(allAnswers)) {
    audits.push({
      severity: 5,
      title: "Leadership claim conflict",
      detail: "The interview contains both leadership/management language and a denial of management responsibility.",
      trustDrop: 18,
      challengePrompt: "Earlier you mentioned leadership or management, but later you seemed to deny management responsibility. What exactly did you own?",
    });
  }

  if (/\b\d+\+?\s*years\b/.test(allAnswers)) {
    const years = [...allAnswers.matchAll(/\b(\d{1,2})\+?\s*years\b/g)].map((match) => Number(match[1])).filter(Number.isFinite);
    if (years.length >= 2 && Math.max(...years) - Math.min(...years) >= 4) {
      audits.push({
        severity: 4,
        title: "Experience timeline changed",
        detail: `Experience length varied between ${Math.min(...years)} and ${Math.max(...years)} years during the interview.`,
        trustDrop: 12,
        challengePrompt: "Your experience timeline sounded different across answers. Can you give the exact years and role scope?",
      });
    }
  }

  return audits;
}

function buildTrustTimeline(result: StoredResult, insights: AnswerInsight[]) {
  if (Array.isArray(result.trustTimeline) && result.trustTimeline.length) {
    return result.trustTimeline.slice(0, 8).map((item, index) => ({
      label: cleanText(item.label) || `Moment ${index + 1}`,
      score: clamp(numberOr(item.score, 65)),
      reason: cleanText(item.reason) || "Recruiter confidence changed based on answer quality.",
      evidence: cleanText(item.evidence) || "Evidence not captured.",
    }));
  }

  return insights.slice(0, 8).map((item, index) => ({
    label: `Q${index + 1}: ${item.metricPresent ? "Evidence gained" : item.redFlags.length ? "Trust pressure" : "Neutral signal"}`,
    score: item.trustImpact,
    reason: item.weakness,
    evidence: item.answer.slice(0, 150),
  }));
}

function buildRichReport(result: StoredResult): RichReport {
  const pairs = buildPairs(result);
  const answerInsights = pairs.map((pair, index) => analyzeAnswer(pair.question, pair.answer, index));
  const answersCount = answerInsights.length;
  const durationSeconds = numberOr(result.durationSeconds, durationToSeconds(result.duration));
  const averageWpm = answersCount ? average(answerInsights.map((item) => item.estimatedWpm), 0) : 0;

  const computedCommunication = average(answerInsights.map((item) => item.structureScore), 68);
  const computedConfidence = average(answerInsights.map((item) => item.confidenceScore), 66);
  const computedRole = average(answerInsights.map((item) => item.evidenceScore), 70);
  const computedTrust = average(answerInsights.map((item) => item.trustImpact), 68);

  const communicationScore = clamp(numberOr(result.communicationScore, computedCommunication));
  const confidenceScore = clamp(numberOr(result.confidenceScore, computedConfidence));
  const roleCompetencyScore = clamp(numberOr(result.roleCompetencyScore, computedRole));
  const trustScore = clamp(numberOr(result.trustScore, numberOr(result.recruiterTrust, computedTrust)));
  const evidenceQuality = clamp(numberOr(result.evidenceQuality, average(answerInsights.map((item) => item.evidenceScore), 68)));

  const contradictions = buildContradictions(result, answerInsights);
  const contradictionRisk = clamp(numberOr(result.contradictionRisk, contradictions.length ? Math.max(...contradictions.map((item) => item.severity * 18)) : 15));

  const overallScore = clamp(
    numberOr(
      result.overallScore,
      communicationScore * 0.22 + confidenceScore * 0.18 + roleCompetencyScore * 0.25 + trustScore * 0.2 + evidenceQuality * 0.15 - contradictions.length * 4,
    ),
  );

  const recruiterName = cleanText(result.recruiterName || result.recruiter || result.recruiterPersonality) || "Daniel";
  const roleLabel = cleanText(result.targetRole || result.role) || "Target role";
  const companyLabel = cleanText(result.companyName || result.targetCompany || result.selectedCompany || result.companyStyle) || "target company";

  const verdictTitle =
    overallScore >= 84
      ? "Strong signal — likely to continue"
      : overallScore >= 72
        ? "Promising, but not fully convincing yet"
        : overallScore >= 60
          ? "Borderline — needs sharper evidence"
          : "Not ready yet — recruiter confidence is low";

  const verdictBody =
    overallScore >= 84
      ? `${recruiterName} would likely continue the process, but still test consistency and depth in the next round.`
      : overallScore >= 72
        ? `${recruiterName} sees role fit, but would need clearer metrics, ownership, and answer structure before fully recommending you.`
        : overallScore >= 60
          ? `${recruiterName} heard useful background, but the answers did not yet create enough proof for a confident next-round decision.`
          : `${recruiterName} did not receive enough concrete, role-specific evidence yet. A retry should focus on one strong proof story per answer.`;

  const redFlags = Array.from(
    new Set([
      ...normalizeList(result.redFlags, [], 8),
      ...answerInsights.flatMap((item) => item.redFlags),
    ]),
  ).slice(0, 10);

  const evidenceRequests = Array.from(
    new Set([
      ...normalizeList(result.evidenceRequests, [], 8),
      ...answerInsights
        .filter((item) => !item.metricPresent || !item.ownershipPresent || !item.resultPresent)
        .map((item) => `For ${item.id.toUpperCase()}, add ${!item.metricPresent ? "one metric" : !item.ownershipPresent ? "clear personal ownership" : "a final outcome"}.`),
    ]),
  ).slice(0, 8);

  const quickWin =
    answerInsights[0]?.weakness && answersCount
      ? `On ${answerInsights[0].id.toUpperCase()}, ${answerInsights[0].weakness.toLowerCase()} Rewrite it with one situation, one personal action, and one measurable result.`
      : "Complete a full interview to receive your first personalized quick win.";

  const strengths = normalizeList(
    result.strengths,
    [
      answerInsights.some((item) => item.roleRelevancePresent)
        ? "You gave recruiter-relevant context for the target role."
        : "You showed useful background signal for the target role.",
      answerInsights.some((item) => item.ownershipPresent)
        ? "At least one answer included personal ownership signal."
        : "You showed motivation to improve and prepare seriously.",
      answerInsights.some((item) => item.metricPresent)
        ? "At least one answer included measurable proof."
        : "Your answers contained at least some recruiter-relevant context.",
    ],
    4,
  );

  const improvements = normalizeList(
    result.improvements,
    [
      "Make your answers more measurable and structured.",
      "Make your personal ownership clearer.",
      "Use a sharper STAR structure for every major answer.",
    ],
    4,
  );

  const companyProfile = companyDNA(companyLabel, roleLabel, answerInsights);

  return {
    overallScore,
    grade: gradeFromScore(overallScore),
    communicationScore,
    confidenceScore,
    roleCompetencyScore,
    trustScore,
    evidenceQuality,
    contradictionRisk,
    durationLabel: formatDuration(durationSeconds),
    durationSeconds,
    answersCount,
    averageWpm,
    recruiterName,
    roleLabel,
    companyLabel,
    verdictTitle,
    verdictBody,
    sentiment: `You showed useful role fit, but ${recruiterName} still needs sharper metrics, ownership, and structure before fully trusting the signal.`,
    quickWin,
    strengths,
    improvements,
    answerInsights,
    contradictions,
    redFlags,
    evidenceRequests,
    companyDNA: companyProfile,
    benchmark: [
      { label: "Pacing", user: averageWpm ? clamp(100 - Math.abs(145 - averageWpm) / 1.4) : 45, top: 86, note: "Top candidates stay concise without sounding rushed." },
      { label: "Metric usage", user: average(answerInsights.map((item) => (item.metricPresent ? 85 : 42)), 42), top: 88, note: "Top candidates quantify impact in most major answers." },
      { label: "Ownership", user: average(answerInsights.map((item) => (item.ownershipPresent ? 86 : 45)), 45), top: 90, note: "Top candidates make personal contribution obvious." },
      { label: "Structure", user: communicationScore, top: 87, note: "Top candidates use clear STAR-style flow." },
      { label: "Trust", user: trustScore, top: 90, note: "Top candidates sound consistent and evidence-backed." },
    ],
    vocalFillers: [
      { label: "Filler words", count: answerInsights.reduce((sum, item) => sum + item.fillerCount, 0), risk: answerInsights.some((item) => item.fillerCount >= 4) ? "high" : "low" },
      { label: "Long/short answer risk", count: answerInsights.filter((item) => item.wordCount < 18 || item.wordCount > 260).length, risk: answerInsights.some((item) => item.wordCount < 18 || item.wordCount > 260) ? "medium" : "low" },
      { label: "Pause risk estimate", count: answerInsights.filter((item) => item.pauseRisk !== "low").length, risk: answerInsights.some((item) => item.pauseRisk === "high") ? "high" : "low" },
    ],
    improvementPlan: [
      { title: "Rewrite your weakest answer", action: answerInsights[0]?.betterAnswer || "Use STAR with one measurable result." },
      { title: "Prepare two metric-backed stories", action: "Have one customer/user impact story and one ownership story ready before the next interview." },
      { title: "Reduce recruiter doubt", action: contradictions[0]?.challengePrompt || "Clarify timeline, role scope, and personal contribution before the recruiter has to ask." },
    ],
    trustTimeline: buildTrustTimeline(result, answerInsights),
  };
}

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  return (
    <div className="relative flex h-36 w-36 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20">
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: `conic-gradient(#3b82f6 ${score * 3.6}deg, rgba(255,255,255,0.12) 0deg)` }}
      />
      <div className="relative flex h-28 w-28 flex-col items-center justify-center rounded-full bg-[#130b37] shadow-inner shadow-black/30">
        <span className="text-4xl font-black text-white">{score}</span>
        <span className="text-sm font-bold text-blue-100">{grade} · /100</span>
      </div>
    </div>
  );
}

function MetricCard({ label, value, note, Icon }: { label: string; value: string; note: string; Icon: typeof Gauge }) {
  return (
    <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.035] p-5">
      <Icon className="mb-7 h-6 w-6 text-blue-300" />
      <p className="text-xs font-black uppercase tracking-[0.35em] text-slate-500">{label}</p>
      <p className="mt-4 text-4xl font-black text-white">{value}</p>
      <p className="mt-3 text-sm leading-6 text-blue-100/75">{note}</p>
    </div>
  );
}

function ProgressLine({ label, score, target, note }: { label: string; score: number; target?: number; note?: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-bold text-slate-100">{label}</span>
        <span className="font-black text-blue-200">{score}%{target ? ` / ${target}%` : ""}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-300 to-emerald-300" style={{ width: `${clamp(score)}%` }} />
      </div>
      {note ? <p className="text-xs leading-5 text-slate-400">{note}</p> : null}
    </div>
  );
}

function LockedPreview({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-purple-300/15 bg-gradient-to-br from-[#12142f] to-[#100b27] p-6 shadow-2xl shadow-purple-950/10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.35em] text-blue-200">Premium Preview</p>
          <h3 className="mt-4 text-2xl font-black text-white">{title}</h3>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100/85">{description}</p>
        </div>
        <div className="rounded-2xl border border-yellow-200/10 bg-yellow-300/15 p-4 text-yellow-100">
          <Lock className="h-6 w-6" />
        </div>
      </div>
      <div className="mt-6 select-none blur-md pointer-events-none">{children}</div>
      <button
        type="button"
        className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-blue-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400"
      >
        <Crown className="h-4 w-4" />
        Upgrade to unlock
      </button>
    </section>
  );
}

function FreeTimelinePreview({ report }: { report: RichReport }) {
  const previews = report.answerInsights.length
    ? report.answerInsights.slice(0, 3)
    : [
        {
          id: "answer-1",
          question: "Tell me about a time you handled a difficult situation.",
          weakness: "Locked recruiter interpretation",
          trustImpact: 0,
        } as AnswerInsight,
      ];

  return (
    <LockedPreview
      title="Question-by-question feedback timeline"
      description="See every question, answer, recruiter interpretation, rewrite, and trust impact."
    >
      <div className="space-y-4 rounded-3xl bg-black/25 p-4">
        {previews.map((item, index) => (
          <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Q{index + 1}</p>
            <p className="mt-2 font-bold text-white">{item.question}</p>
            <p className="mt-3 text-sm text-slate-400">Recruiter heard: {item.weakness}</p>
            <p className="mt-1 text-sm text-slate-400">Trust impact: {item.trustImpact}/100</p>
          </div>
        ))}
      </div>
    </LockedPreview>
  );
}

function FreeResults({ report, onUpgrade }: { report: RichReport; onUpgrade: () => void }) {
  return (
    <>
      <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#111733] via-[#15112d] to-[#052229] p-6 shadow-2xl shadow-black/25 lg:p-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-100">
              <Sparkles className="h-4 w-4" /> Free Interview Snapshot
            </span>
            <h1 className="mt-7 max-w-4xl text-4xl font-black tracking-tight text-white lg:text-5xl">
              Interview Complete — {report.roleLabel}
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-blue-100/90">{report.verdictBody}</p>
          </div>
          <ScoreRing score={report.overallScore} grade={report.grade} />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-4">
        <MetricCard label="Communication" value={`${report.communicationScore}%`} note="Clarity, answer length, and structure." Icon={MessageSquareText} />
        <MetricCard label="Confidence" value={`${report.confidenceScore}%`} note="Pace, ownership, and certainty signals." Icon={Gauge} />
        <MetricCard label="Role Competency" value={`${report.roleCompetencyScore}%`} note="How relevant your answers sounded for the role." Icon={Target} />
        <MetricCard label="Trust Signal" value={`${report.trustScore}%`} note="Visible score. Detailed trust audit is premium." Icon={ShieldCheck} />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
          <h2 className="flex items-center gap-3 text-2xl font-black text-white">
            <ShieldCheck className="h-6 w-6 text-emerald-300" /> Recruiter verdict
          </h2>
          <p className="mt-4 text-xl font-black text-white">{report.verdictTitle}</p>
          <p className="mt-3 text-base leading-8 text-blue-100/90">{report.sentiment}</p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-black/20 p-4">
              <p className="text-xs text-slate-400">Avg. pace</p>
              <p className="mt-2 text-2xl font-black text-white">{report.averageWpm ? `${report.averageWpm} WPM` : "— WPM"}</p>
            </div>
            <div className="rounded-2xl bg-black/20 p-4">
              <p className="text-xs text-slate-400">Duration</p>
              <p className="mt-2 text-2xl font-black text-white">{report.durationLabel}</p>
            </div>
            <div className="rounded-2xl bg-black/20 p-4">
              <p className="text-xs text-slate-400">Answers</p>
              <p className="mt-2 text-2xl font-black text-white">{report.answersCount}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-emerald-300/15 bg-emerald-400/10 p-6">
          <h2 className="flex items-center gap-3 text-2xl font-black text-white">
            <Lightbulb className="h-6 w-6 text-emerald-200" /> Your free actionable win
          </h2>
          <p className="mt-5 text-base leading-8 text-emerald-50">{report.quickWin}</p>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
          <h2 className="flex items-center gap-3 text-2xl font-black text-white">
            <CheckCircle2 className="h-6 w-6 text-emerald-300" /> Strengths
          </h2>
          <div className="mt-5 space-y-3">
            {report.strengths.map((item) => (
              <p key={item} className="rounded-2xl bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-50">{item}</p>
            ))}
          </div>
        </div>
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
          <h2 className="flex items-center gap-3 text-2xl font-black text-white">
            <Target className="h-6 w-6 text-blue-300" /> Improvements
          </h2>
          <div className="mt-5 space-y-3">
            {report.improvements.map((item) => (
              <p key={item} className="rounded-2xl bg-blue-500/10 p-4 text-sm leading-6 text-blue-50">{item}</p>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-yellow-300/20 bg-gradient-to-r from-yellow-300/10 via-purple-500/10 to-blue-500/10 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.32em] text-yellow-100">Upgrade to unlock premium</p>
            <h2 className="mt-3 text-3xl font-black text-white">Your full recruiter masterclass is ready.</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-blue-100/85">
              Unlock the trust audit, red flags, contradictions, company DNA alignment, top 10% rewrites, and question-by-question coaching timeline.
            </p>
          </div>
          <button
            type="button"
            onClick={onUpgrade}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-500 px-6 py-4 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400"
          >
            <Crown className="h-5 w-5" /> Upgrade to unlock full report
          </button>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <LockedPreview
          title="Detected red flags & contradictions"
          description={`We check communication risk, missing evidence, low ownership, contradictions, and confidence signals. Premium found ${report.redFlags.length} red flag(s) and ${report.contradictions.length} contradiction concern(s).`}
        >
          <div className="space-y-3 rounded-3xl bg-black/25 p-4">
            {(report.redFlags.length ? report.redFlags : ["Missing measurable evidence", "Ownership clarity risk"]).slice(0, 3).map((item) => (
              <p key={item} className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-100">{item}</p>
            ))}
          </div>
        </LockedPreview>
        <FreeTimelinePreview report={report} />
      </section>
    </>
  );
}

function PremiumResults({ report }: { report: RichReport }) {
  return (
    <>
      <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#111733] via-[#15112d] to-[#052229] p-6 shadow-2xl shadow-black/25 lg:p-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-yellow-300/20 bg-yellow-300/10 px-4 py-2 text-sm font-black text-yellow-100">
              <Crown className="h-4 w-4" /> Premium Interview Debrief
            </span>
            <h1 className="mt-7 max-w-4xl text-4xl font-black tracking-tight text-white lg:text-5xl">
              Masterclass diagnostic — {report.roleLabel}
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-blue-100/90">{report.verdictBody}</p>
          </div>
          <ScoreRing score={report.overallScore} grade={report.grade} />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
          <h2 className="flex items-center gap-3 text-2xl font-black text-white">
            <BarChart3 className="h-6 w-6 text-cyan-300" /> Benchmarking & Company DNA
          </h2>
          <p className="mt-3 text-sm leading-7 text-blue-100/80">{report.companyDNA.description}</p>
          <p className="mt-2 rounded-2xl bg-blue-500/10 p-3 text-sm font-bold text-blue-100">{report.companyDNA.interviewerMode}</p>
          <div className="mt-5 space-y-5">
            {report.companyDNA.dimensions.map((item) => (
              <ProgressLine key={item.label} label={item.label} score={item.score} target={item.target} note={item.note} />
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
          <h2 className="flex items-center gap-3 text-2xl font-black text-white">
            <ShieldAlert className="h-6 w-6 text-yellow-200" /> Trust & Integrity Audit
          </h2>
          <div className="mt-5 grid gap-3">
            <ProgressLine label="Credibility" score={report.trustScore} note="Evidence, consistency, and recruiter confidence." />
            <ProgressLine label="Evidence Quality" score={report.evidenceQuality} note="Metrics, ownership, and result clarity." />
            <ProgressLine label="Contradiction Risk" score={100 - report.contradictionRisk} note="Higher means fewer consistency concerns." />
          </div>
          {report.contradictions.length ? (
            <div className="mt-5 rounded-2xl border border-red-300/15 bg-red-500/10 p-4">
              <p className="font-black text-red-100">Contradiction detected</p>
              <p className="mt-2 text-sm leading-6 text-red-50/90">{report.contradictions[0].detail}</p>
              <p className="mt-3 text-xs font-bold text-yellow-100">Challenge prompt: {report.contradictions[0].challengePrompt}</p>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-emerald-300/15 bg-emerald-400/10 p-4 text-sm text-emerald-50">
              No major contradiction detected in the captured answers.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
        <h2 className="flex items-center gap-3 text-2xl font-black text-white">
          <TrendingUp className="h-6 w-6 text-blue-300" /> Top 10% Candidate Overlay
        </h2>
        <div className="mt-6 grid gap-5 lg:grid-cols-5">
          {report.benchmark.map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="font-black text-white">{item.label}</p>
              <div className="mt-4 space-y-3">
                <ProgressLine label="You" score={item.user} />
                <ProgressLine label="Top 10%" score={item.top} />
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-400">{item.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
        <h2 className="flex items-center gap-3 text-2xl font-black text-white">
          <Mic2 className="h-6 w-6 text-purple-300" /> Audio & Presentation Timeline Analysis
        </h2>
        <p className="mt-3 text-sm leading-7 text-blue-100/80">
          WorkZo currently estimates delivery risk from transcript length and filler words. Real audio/camera analysis can be connected later without changing this report structure.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {report.vocalFillers.map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-bold text-slate-300">{item.label}</p>
              <p className="mt-2 text-3xl font-black text-white">{item.count}</p>
              <p className={cn("mt-2 text-xs font-black uppercase", item.risk === "high" ? "text-red-200" : item.risk === "medium" ? "text-yellow-200" : "text-emerald-200")}>{item.risk} risk</p>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-7 text-slate-300">
          <Eye className="mb-3 h-5 w-5 text-blue-300" /> Presence & eye-contact metrics are not captured yet. The report is ready for future camera signals, but it does not pretend to analyze video that was not recorded.
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
        <h2 className="flex items-center gap-3 text-2xl font-black text-white">
          <MessageSquareText className="h-6 w-6 text-cyan-300" /> Interactive Transcript & Coaching Debrief
        </h2>
        <div className="mt-6 space-y-5">
          {(report.answerInsights.length ? report.answerInsights : [analyzeAnswer("Interview question", "Answer not captured yet.", 0)]).map((item, index) => (
            <article key={item.id} className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-200">Question {index + 1}</p>
                  <h3 className="mt-2 text-xl font-black text-white">{item.question}</h3>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-blue-100">Trust impact {item.trustImpact}/100</span>
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                <div className="rounded-2xl bg-white/[0.04] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Your Answer</p>
                  <p className="mt-3 text-sm leading-7 text-slate-200">{item.answer}</p>
                </div>
                <div className="rounded-2xl border border-yellow-300/15 bg-yellow-300/10 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-yellow-100">What the Recruiter Heard</p>
                  <p className="mt-3 text-sm leading-7 text-yellow-50/90">{item.whatRecruiterHeard}</p>
                  <p className="mt-3 text-xs leading-5 text-yellow-100/75">Gap: {item.benchmarkGap}</p>
                </div>
                <div className="rounded-2xl border border-emerald-300/15 bg-emerald-400/10 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-100">Top 10% Rewrite</p>
                  <p className="mt-3 text-sm leading-7 text-emerald-50/90">{item.betterAnswer}</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <ProgressLine label="Structure" score={item.structureScore} />
                <ProgressLine label="Evidence" score={item.evidenceScore} />
                <ProgressLine label="Confidence" score={item.confidenceScore} />
                <ProgressLine label="Trust" score={item.trustImpact} />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
          <h2 className="flex items-center gap-3 text-2xl font-black text-white">
            <Flag className="h-6 w-6 text-red-300" /> Red Flags & Evidence Requests
          </h2>
          <div className="mt-5 space-y-3">
            {(report.redFlags.length ? report.redFlags : ["No major red flag detected in captured answers."]).map((item) => (
              <p key={item} className="rounded-2xl bg-red-500/10 p-4 text-sm leading-6 text-red-50">{item}</p>
            ))}
            {report.evidenceRequests.slice(0, 4).map((item) => (
              <p key={item} className="rounded-2xl bg-blue-500/10 p-4 text-sm leading-6 text-blue-50">{item}</p>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
          <h2 className="flex items-center gap-3 text-2xl font-black text-white">
            <Wand2 className="h-6 w-6 text-purple-300" /> Improvement Plan
          </h2>
          <div className="mt-5 space-y-3">
            {report.improvementPlan.map((item) => (
              <div key={item.title} className="rounded-2xl bg-purple-500/10 p-4">
                <p className="font-black text-white">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-purple-50/85">{item.action}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export default function ResultsPage() {
  const [result, setResult] = useState<StoredResult | null>(null);
  const [plan, setPlan] = useState("free");
  const [showUpgrade, setShowUpgrade] = useState(false);

  useEffect(() => {
    setResult(readResultFromStorage());
    const currentPlan = getWorkZoCurrentPlan();
    setPlan(currentPlan);
    recordWorkZoReportViewed();
  }, []);

  const report = useMemo(() => buildRichReport(result || {}), [result]);
  const isPremium = Boolean(result?.isPremium || result?.plan === "premium" || plan === "premium");
  const limits = getWorkZoPlanLimits(plan);

  return (
    <main className="min-h-screen bg-[#020817] px-5 py-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-slate-100 transition hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" /> Back home
          </Link>

          <div className="flex items-center gap-3">
            <PremiumUsageBadge label={isPremium ? "Premium report" : `Free · ${limits.interviewsPerMonth ?? 2}/2 interviews left`} />
            <button
              type="button"
              onClick={() => setShowUpgrade(true)}
              className="rounded-2xl bg-blue-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400"
            >
              {isPremium ? "Manage plan" : "Pricing"}
            </button>
          </div>
        </header>

        {isPremium ? <PremiumResults report={report} /> : <FreeResults report={report} onUpgrade={() => setShowUpgrade(true)} />}

        <section className="flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-white/10 bg-white/[0.035] p-5">
          <div>
            <p className="text-sm font-black text-white">Next best action</p>
            <p className="mt-1 text-sm text-slate-400">Retry the interview using the improvement plan and compare your next score.</p>
          </div>
          <Link
            href="/interview"
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-blue-50"
          >
            <RefreshCcw className="h-4 w-4" /> Retry interview
          </Link>
        </section>
      </div>

      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </main>
  );
}
