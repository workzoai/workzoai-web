"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ChevronRight,
  ArrowLeft,
  BarChart3,
  Briefcase,
  CheckCircle2,
  Clock3,
  FileText,
  HelpCircle,
  Home,
  Mail,
  Mic,
  MicOff,
  MoreVertical,
  PhoneOff,
  Play,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  User,
  Volume2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildWorkZoVapiVariableValues,
  createWorkZoVapiClient,
  getWorkZoVapiConfig,
  normalizeVapiTranscriptMessage,
  type WorkZoVapiClient,
} from "@/lib/workzoVapiVoice";
import {
  classifyVoiceError,
  requestMicrophoneAccess,
} from "@/lib/workzoVoiceReliability";

type TranscriptRole = "recruiter" | "candidate" | "system";

type TranscriptItem = {
  id: string;
  time: string;
  role: TranscriptRole;
  speaker: string;
  text: string;
};

type InterviewStatus =
  | "idle"
  | "recruiter-speaking"
  | "listening"
  | "thinking"
  | "ended";

type PremiumVoiceStatus =
  | "idle"
  | "not_configured"
  | "checking_microphone"
  | "connecting"
  | "connected"
  | "fallback"
  | "failed";

type RecruiterSignalState = {
  overall: number;
  confidence: number;
  clarity: number;
  relevance: number;
  communication: number;
  trust: number;
  interest: number;
  mood: "Impressed" | "Engaged" | "Neutral" | "Concerned" | "Doubtful";
  concern: string;
};

type RecruiterMemoryState = {
  vagueAnswers: number;
  missingMetrics: number;
  missingOwnership: number;
  unsupportedClaims: number;
  strongAnswers: number;
  lastConcern: string;
  liveNote: string;
  patterns: string[];
  askedTopics: string[];
  answeredTopics: string[];
  metricsMentioned: string[];
  strengthsMentioned: string[];
  needsClosingChallenge: boolean;
  closingAsked: boolean;
  readyForResults: boolean;
  trustTimeline: Array<{
    time: string;
    trust: number;
    interest: number;
    note: string;
  }>;
};

type CompanyInterviewStyle =
  | "Global realistic interview"
  | "Startup"
  | "Big Tech"
  | "Consulting"
  | "Corporate";

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorLike = {
  error?: string;
  message?: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type WindowWithSpeechRecognition = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

type InterviewSetup = {
  candidateName: string;
  targetRole: string;
  targetCompany?: string;
  recruiterId: string;
  recruiterName: string;
  recruiterTitle: string;
  recruiterImage: string;
  language: string;
  cvText?: string;
  jobDescription?: string;
};

const recruiterProfiles: Record<
  string,
  { name: string; title: string; image: string; voiceHint: string }
> = {
  friendly_hr: {
    name: "Sarah",
    title: "Friendly HR Recruiter",
    image: "/recruiters/sarah.png",
    voiceHint: "female",
  },
  sarah: {
    name: "Sarah",
    title: "Friendly HR Recruiter",
    image: "/recruiters/sarah.png",
    voiceHint: "female",
  },
  startup_recruiter: {
    name: "Priya",
    title: "Startup Recruiter",
    image: "/recruiters/priya.png",
    voiceHint: "female",
  },
  priya: {
    name: "Priya",
    title: "Startup Recruiter",
    image: "/recruiters/priya.png",
    voiceHint: "female",
  },
  analytical_hiring_manager: {
    name: "Daniel",
    title: "Analytical Hiring Manager",
    image: "/recruiters/daniel.png",
    voiceHint: "male",
  },
  daniel: {
    name: "Daniel",
    title: "Analytical Hiring Manager",
    image: "/recruiters/daniel.png",
    voiceHint: "male",
  },
  german_corporate: {
    name: "Markus",
    title: "Structured Corporate Recruiter",
    image: "/recruiters/markus.png",
    voiceHint: "male",
  },
  markus: {
    name: "Markus",
    title: "Structured Corporate Recruiter",
    image: "/recruiters/markus.png",
    voiceHint: "male",
  },
};

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: Home },
  { label: "Improve CV", href: "/cv", icon: FileText },
  { label: "Cover Letter", href: "/cover-letter", icon: Mail },
  { label: "Find Jobs", href: "/jobs", icon: Briefcase },
  { label: "Real Interview AI", href: "/interview", icon: Mic, active: true },
  { label: "Results", href: "/results", icon: BarChart3 },
];


const recruiterQuestions = [
  "Can you walk me through your background and what makes you interested in this role?",
  "Tell me about one relevant situation from your experience.",
  "What was the hardest part, and how did you solve it?",
  "What measurable impact did your work create?",
  "What would you improve if you handled the same situation again?",
];


function getVisibleTranscriptItems(transcript: TranscriptItem[]) {
  return transcript.filter((item) => {
    if (!item || typeof item.text !== "string") return false;
    return item.text.trim().length > 0;
  });
}


function formatTranscriptTime(date: Date) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const initialTranscript: TranscriptItem[] = [
  {
    id: "initial-ready",
    time: "--:--:--",
    role: "system",
    speaker: "System",
    text: "Ready to start your interview.",
  },
];

function MessageIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function safeText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeRecruiterId(value: unknown) {
  const raw = safeText(value, "friendly_hr").toLowerCase();
  if (raw.includes("priya") || raw.includes("startup")) return "startup_recruiter";
  if (raw.includes("daniel") || raw.includes("analytical") || raw.includes("hiring")) return "analytical_hiring_manager";
  if (raw.includes("markus") || raw.includes("german") || raw.includes("corporate")) return "german_corporate";
  if (raw.includes("sarah") || raw.includes("friendly") || raw.includes("hr")) return "friendly_hr";
  return raw.replace(/[^a-z0-9]+/g, "_");
}

function getNestedValue(source: unknown, paths: string[]) {
  if (!source || typeof source !== "object") return "";

  for (const path of paths) {
    let current: unknown = source;

    for (const part of path.split(".")) {
      if (!current || typeof current !== "object") {
        current = "";
        break;
      }

      current = (current as Record<string, unknown>)[part];
    }

    if (typeof current === "string" && current.trim()) return current.trim();
  }

  return "";
}

function readJsonFromStorage(key: string) {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}


function findFirstStringDeep(source: unknown, keys: string[], depth = 0): string {
  if (!source || typeof source !== "object" || depth > 5) return "";
  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  for (const value of Object.values(record)) {
    if (value && typeof value === "object") {
      const found = findFirstStringDeep(value, keys, depth + 1);
      if (found) return found;
    }
  }

  return "";
}

function resolvePersistedInterviewLanguage(state: unknown) {
  const direct = findFirstStringDeep(state, [
    "language",
    "interviewLanguage",
    "selectedLanguage",
    "interview_language",
    "preferredLanguage",
    "voiceLanguage",
  ]);

  if (direct) return direct;

  const market = findFirstStringDeep(state, [
    "market",
    "targetMarket",
    "country",
    "targetCountry",
    "interviewMarket",
  ]).toLowerCase();

  if (market.includes("germany") || market.includes("deutschland")) return "German";
  if (market.includes("netherlands") || market.includes("dutch") || market.includes("nederland")) return "Dutch";
  if (market.includes("france")) return "French";
  if (market.includes("spain")) return "Spanish";
  if (market.includes("italy")) return "Italian";
  if (market.includes("portugal")) return "Portuguese";

  return "English";
}

function normalizeStoredLanguageForRuntime(value: string) {
  const language = normalizeInterviewLanguage(value);
  return language.label === "Auto" ? "English" : language.label;
}


function findSetupFromLocalStorage() {
  if (typeof window === "undefined") return null;

  const directKeys = [
    "workzo_interview_setup",
    "workzoInterviewSetup",
    "interviewSetup",
    "workzo_setup",
    "workzoSetup",
    "workzo_active_setup",
    "workzoActiveSetup",
    "workzoOnboarding",
    "workzo_onboarding",
    "interview-store",
    "interviewStore",
  ];

  for (const key of directKeys) {
    const parsed = readJsonFromStorage(key);
    if (parsed) return parsed;
  }

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index) || "";
      if (!/workzo|interview|setup|onboarding/i.test(key)) continue;

      const parsed = readJsonFromStorage(key);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch {}

  return null;
}

function normalizeCandidateName(name: string) {
  const cleaned = safeText(name)
    .replace(/\s+/g, " ")
    .replace(/[^A-Za-zÀ-ÖØ-öø-ÿ' .-]/g, "")
    .trim();

  if (!cleaned || cleaned.length < 2) return "";
  if (/\b(resume|cv|curriculum|profile|summary|experience|education|skills|project|sales|manager|executive|engineer|analyst)\b/i.test(cleaned)) {
    return "";
  }

  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length > 4) return "";
  return cleaned;
}

function extractNameFromCvText(cvText: string) {
  const lines = cvText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const firstLine = lines.find((line) => {
    if (line.length < 3 || line.length > 60) return false;
    if (/@|www|http|\+|\d/.test(line)) return false;
    if (/\b(resume|curriculum|profile|summary|experience|education|skills)\b/i.test(line)) return false;
    return /^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/.test(line);
  });

  return firstLine || "";
}

function buildSetupFromStorage(): InterviewSetup {
  const stored = findSetupFromLocalStorage();

  const state =
    stored && typeof stored === "object" && "state" in stored
      ? (stored as Record<string, unknown>).state
      : stored;

  const cvText = getNestedValue(state, [
    "cvText",
    "resumeText",
    "candidate.cvText",
    "setup.cvText",
    "profile.cvText",
  ]);

  const jobDescription = getNestedValue(state, [
    "jobDescription",
    "jdText",
    "jd",
    "job.description",
    "job.jobDescription",
    "setup.jobDescription",
    "setup.jdText",
    "selectedJob.description",
    "selectedJob.jobDescription",
  ]);

  const storedCandidateName = normalizeCandidateName(
    getNestedValue(state, [
      "candidateName",
      "name",
      "userName",
      "candidate.name",
      "profile.name",
      "setup.candidateName",
      "setup.name",
    ]),
  );
  const cvCandidateName = normalizeCandidateName(extractNameFromCvText(cvText));
  const candidateName = storedCandidateName || cvCandidateName || "Candidate";

  const targetRole =
    getNestedValue(state, [
      "targetRole",
      "role",
      "jobTitle",
      "selectedRole",
      "setup.targetRole",
      "setup.role",
      "job.title",
      "job.role",
      "jobDescriptionTitle",
    ]) || "Interview Role";

  const targetCompany =
    getNestedValue(state, [
      "targetCompany",
      "company",
      "companyName",
      "setup.targetCompany",
      "job.company",
      "job.companyName",
    ]) || "";

  const recruiterId = normalizeRecruiterId(
    getNestedValue(state, [
      "recruiterId",
      "selectedRecruiter",
      "recruiter",
      "recruiterPersonality",
      "setup.recruiterId",
      "setup.selectedRecruiter",
      "setup.recruiter",
      "setup.recruiterPersonality",
    ]),
  );

  const profile = recruiterProfiles[recruiterId] || recruiterProfiles.friendly_hr;

  const recruiterName =
    getNestedValue(state, [
      "recruiterName",
      "setup.recruiterName",
      "recruiter.name",
      "selectedRecruiter.name",
    ]) || profile.name;

  const recruiterTitle =
    getNestedValue(state, [
      "recruiterTitle",
      "setup.recruiterTitle",
      "recruiter.title",
      "selectedRecruiter.title",
    ]) || profile.title;

  const recruiterImage =
    getNestedValue(state, [
      "recruiterImage",
      "setup.recruiterImage",
      "recruiter.image",
      "selectedRecruiter.image",
      "recruiter.avatar",
    ]) || profile.image;

  const language = normalizeStoredLanguageForRuntime(
    resolvePersistedInterviewLanguage(state),
  );

  return {
    candidateName,
    targetRole,
    targetCompany,
    recruiterId,
    recruiterName,
    recruiterTitle,
    recruiterImage,
    language,
    cvText,
    jobDescription,
  };
}

function toneClass(tone: string) {
  if (tone === "emerald") return "bg-emerald-400/15 text-emerald-300";
  if (tone === "blue") return "bg-blue-400/15 text-blue-300";
  if (tone === "violet") return "bg-violet-400/15 text-violet-300";
  if (tone === "orange") return "bg-orange-400/15 text-orange-300";
  return "bg-white/10 text-slate-300";
}


function recruiterObjectPosition(recruiterId: string, recruiterName: string) {
  const value = `${recruiterId} ${recruiterName}`.toLowerCase();

  // Safe portrait crop: keeps the face fully visible while filling the frame.
  if (value.includes("daniel") || value.includes("analytical")) return "50% 28%";
  if (value.includes("markus") || value.includes("corporate")) return "50% 28%";
  if (value.includes("priya") || value.includes("startup")) return "50% 26%";
  return "50% 26%";
}

function timeLabel() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function createClientId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getWorkZoAnalyticsSessionId() {
  if (typeof window === "undefined") return "server-session";

  try {
    const existing = window.localStorage.getItem("workzo_analytics_session_id");
    if (existing) return existing;

    const next = createClientId();
    window.localStorage.setItem("workzo_analytics_session_id", next);
    return next;
  } catch {
    return createClientId();
  }
}

function trackWorkZoInterviewEvent(eventName: string, payload: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;

  try {
    const event = {
      id: createClientId(),
      eventName,
      createdAt: new Date().toISOString(),
      ...payload,
    };

    const raw = window.localStorage.getItem("workzo_founder_events");
    const existing = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(existing) ? existing : [];

    window.localStorage.setItem(
      "workzo_founder_events",
      JSON.stringify([event, ...list].slice(0, 500)),
    );
  } catch {}

  fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: getWorkZoAnalyticsSessionId(),
      event: eventName,
      path: window.location.pathname,
      origin: window.location.origin,
      host: window.location.hostname,
      isLocal: window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1",
      environment: process.env.NODE_ENV,
      recruiter: typeof payload.recruiter === "string" ? payload.recruiter : undefined,
      role: typeof payload.role === "string" ? payload.role : undefined,
      metadata: payload,
    }),
  }).catch(() => {});
}


type WorkZoAnswerQuality = "weak" | "average" | "strong" | "excellent";
type WorkZoFailureSeverity = "low" | "medium" | "high" | "critical";

type WorkZoInterviewSnapshot = {
  version: 1;
  id: string;
  updatedAt: string;
  status: InterviewStatus;
  elapsed: number;
  questionIndex: number;
  scoreReady: boolean;
  setup: InterviewSetup;
  recruiterSignal: RecruiterSignalState;
  recruiterMemory: RecruiterMemoryState;
  transcript: TranscriptItem[];
};

const WORKZO_ACTIVE_INTERVIEW_KEY = "workzo_active_interview";
const WORKZO_INTERVIEW_SNAPSHOT_KEY = "workzo_interview_snapshot";
const WORKZO_ERROR_EVENTS_KEY = "workzo_error_events";
const WORKZO_FAILURE_EVENTS_KEY = "workzo_failure_events";
const WORKZO_CANDIDATE_PATTERNS_KEY = "workzo_candidate_patterns";

function safeLocalStorageList(key: string) {
  if (typeof window === "undefined") return [] as Array<Record<string, unknown>>;

  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as Array<Record<string, unknown>>;
  }
}

function isWorkZoPremiumUnlocked() {
  if (typeof window === "undefined") return false;

  try {
    const directFlags = [
      "workzo_premium_unlocked",
      "workzoPremiumUnlocked",
      "workzo_pro_unlocked",
      "workzoProUnlocked",
    ];

    for (const key of directFlags) {
      const value = window.localStorage.getItem(key);
      if (value === "true" || value === "1" || value === "yes") return true;
    }

    const rawSubscription =
      window.localStorage.getItem("workzo_subscription") ||
      window.localStorage.getItem("workzoSubscription") ||
      window.localStorage.getItem("subscription");

    if (!rawSubscription) return false;

    const subscription = JSON.parse(rawSubscription) as Record<string, unknown>;
    const plan = String(subscription.plan || subscription.tier || subscription.status || "").toLowerCase();
    return /premium|pro|paid|active/.test(plan);
  } catch {
    return false;
  }
}

function pushWorkZoLocalEvent(key: string, eventName: string, payload: Record<string, unknown> = {}, limit = 500) {
  if (typeof window === "undefined") return;

  try {
    const event = {
      id: createClientId(),
      eventName,
      createdAt: new Date().toISOString(),
      sessionId: getWorkZoAnalyticsSessionId(),
      path: window.location.pathname,
      ...payload,
    };

    const list = safeLocalStorageList(key);
    window.localStorage.setItem(key, JSON.stringify([event, ...list].slice(0, limit)));
  } catch {}
}

function normalizeErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

function trackWorkZoFailureEvent(
  eventName: string,
  payload: Record<string, unknown> = {},
  severity: WorkZoFailureSeverity = "medium",
) {
  pushWorkZoLocalEvent(WORKZO_FAILURE_EVENTS_KEY, eventName, { severity, ...payload }, 500);
  trackWorkZoInterviewEvent(eventName, { severity, ...payload });
}

function trackWorkZoErrorEvent(
  eventName: string,
  error: unknown,
  payload: Record<string, unknown> = {},
  severity: WorkZoFailureSeverity = "medium",
) {
  const errorMessage = normalizeErrorMessage(error);

  pushWorkZoLocalEvent(WORKZO_ERROR_EVENTS_KEY, eventName, {
    severity,
    errorMessage,
    ...payload,
  }, 500);

  trackWorkZoFailureEvent(eventName, { errorMessage, ...payload }, severity);
}

function classifyAnswerQuality(answer: string, setup?: InterviewSetup): WorkZoAnswerQuality {
  const signal = analyzeAnswerSignals(answer, setup);

  if (signal.unsupported || signal.admission || signal.short || signal.vague) return "weak";
  if (signal.metric && signal.ownership && signal.outcome && signal.wordCount >= 35) return "excellent";
  if ((signal.metric && signal.ownership) || (signal.ownership && signal.outcome)) return "strong";
  return "average";
}

function buildAnswerQualityRecord(answer: string, setup?: InterviewSetup) {
  const signal = analyzeAnswerSignals(answer, setup);
  const quality = classifyAnswerQuality(answer, setup);

  return {
    id: createClientId(),
    createdAt: new Date().toISOString(),
    quality,
    wordCount: signal.wordCount,
    hasMetric: signal.metric,
    hasOwnership: signal.ownership,
    hasOutcome: signal.outcome,
    unsupported: signal.unsupported,
    concern: signal.concern,
    answer,
  };
}

function summarizeAnswerQuality(transcript: TranscriptItem[], setup?: InterviewSetup) {
  const records = transcript
    .filter((item) => item.role === "candidate")
    .map((item) => buildAnswerQualityRecord(item.text, setup));

  const summary = records.reduce(
    (acc, item) => {
      acc[item.quality] += 1;
      return acc;
    },
    { weak: 0, average: 0, strong: 0, excellent: 0 } as Record<WorkZoAnswerQuality, number>,
  );

  return { records, summary };
}

function persistCandidatePatterns(memory: RecruiterMemoryState, setup: InterviewSetup) {
  if (typeof window === "undefined") return;

  try {
    const existing = safeLocalStorageList(WORKZO_CANDIDATE_PATTERNS_KEY);
    const now = new Date().toISOString();

    const incoming = memory.patterns.map((pattern) => ({
      id: normalizeClaimText(pattern) || createClientId(),
      pattern,
      targetRole: setup.targetRole,
      recruiterName: setup.recruiterName,
      lastSeenAt: now,
      count: 1,
    }));

    const merged = [...incoming, ...existing].reduce((acc, item) => {
      const key = typeof item.id === "string" ? item.id : normalizeClaimText(String(item.pattern || ""));
      if (!key) return acc;

      const current = acc.get(key);
      if (current) {
        acc.set(key, {
          ...current,
          count: Number(current.count || 1) + Number(item.count || 1),
          lastSeenAt: now,
        });
      } else {
        acc.set(key, item);
      }

      return acc;
    }, new Map<string, Record<string, unknown>>());

    window.localStorage.setItem(WORKZO_CANDIDATE_PATTERNS_KEY, JSON.stringify(Array.from(merged.values()).slice(0, 40)));
  } catch (error) {
    trackWorkZoErrorEvent("candidate_pattern_persist_failed", error, { role: setup.targetRole }, "low");
  }
}

function readActiveInterviewSnapshot() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(WORKZO_ACTIVE_INTERVIEW_KEY) || window.localStorage.getItem(WORKZO_INTERVIEW_SNAPSHOT_KEY);
    if (!raw) return null;

    const snapshot = JSON.parse(raw) as Partial<WorkZoInterviewSnapshot>;
    if (!snapshot || snapshot.version !== 1) return null;
    if (!Array.isArray(snapshot.transcript) || !snapshot.transcript.some((item) => item.role === "recruiter" || item.role === "candidate")) return null;
    if (snapshot.status === "ended") return null;

    return snapshot as WorkZoInterviewSnapshot;
  } catch (error) {
    trackWorkZoErrorEvent("state_recovery_read_failed", error, {}, "medium");
    return null;
  }
}

function writeActiveInterviewSnapshot(snapshot: WorkZoInterviewSnapshot) {
  if (typeof window === "undefined") return;

  try {
    const value = JSON.stringify(snapshot);
    window.localStorage.setItem(WORKZO_ACTIVE_INTERVIEW_KEY, value);
    window.localStorage.setItem(WORKZO_INTERVIEW_SNAPSHOT_KEY, value);
  } catch (error) {
    trackWorkZoErrorEvent("state_recovery_write_failed", error, { role: snapshot.setup.targetRole }, "medium");
  }
}

function clearActiveInterviewSnapshot() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(WORKZO_ACTIVE_INTERVIEW_KEY);
  } catch {}
}


function countCandidateAnswers(transcript: TranscriptItem[]) {
  return transcript.filter((item) => item.role === "candidate").length;
}

function getLastRecruiterQuestion(transcript: TranscriptItem[]) {
  const lastRecruiter = [...transcript]
    .reverse()
    .find((item) => item.role === "recruiter" && item.text.trim());

  return lastRecruiter?.text.trim() || "";
}

function getLastCandidateAnswer(transcript: TranscriptItem[]) {
  const lastCandidate = [...transcript]
    .reverse()
    .find((item) => item.role === "candidate" && item.text.trim());

  return lastCandidate?.text.trim() || "";
}

function getRecoveryProgressLabel(snapshot: WorkZoInterviewSnapshot) {
  const answers = countCandidateAnswers(snapshot.transcript);
  const questions = snapshot.transcript.filter((item) => item.role === "recruiter").length;

  if (answers > 0) return `${answers} answer${answers === 1 ? "" : "s"} completed`;
  if (questions > 0) return `${questions} recruiter question${questions === 1 ? "" : "s"} saved`;
  return `${snapshot.transcript.length} transcript item${snapshot.transcript.length === 1 ? "" : "s"}`;
}

function getRecoverySavedLabel(snapshot: WorkZoInterviewSnapshot) {
  const updated = Date.parse(snapshot.updatedAt);
  if (!Number.isFinite(updated)) return "Saved recently";

  const diffSeconds = Math.max(0, Math.round((Date.now() - updated) / 1000));
  if (diffSeconds < 60) return "Saved just now";

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `Saved ${diffMinutes} min ago`;

  const diffHours = Math.round(diffMinutes / 60);
  return `Saved ${diffHours} hr ago`;
}

function recruiterStatusLabel(signal: RecruiterSignalState, scoreReady: boolean) {
  if (!scoreReady) return "Ready";
  if (signal.mood === "Impressed") return "Impressed";
  if (signal.mood === "Engaged") return "Interested";
  if (signal.mood === "Concerned") return "Concerned";
  if (signal.mood === "Doubtful") return "Skeptical";
  return "Neutral";
}

function recruiterStatusTone(signal: RecruiterSignalState, scoreReady: boolean) {
  if (!scoreReady) return "border-blue-300/20 bg-blue-400/10 text-blue-200";
  if (signal.mood === "Impressed") return "border-emerald-300/20 bg-emerald-400/10 text-emerald-200";
  if (signal.mood === "Engaged") return "border-blue-300/20 bg-blue-400/10 text-blue-200";
  if (signal.mood === "Concerned") return "border-amber-300/20 bg-amber-400/10 text-amber-200";
  if (signal.mood === "Doubtful") return "border-red-300/20 bg-red-400/10 text-red-200";
  return "border-slate-300/20 bg-slate-400/10 text-slate-200";
}

function buildLiveRecruiterThoughts(
  signal: RecruiterSignalState,
  memory: RecruiterMemoryState,
  scoreReady: boolean,
) {
  if (!scoreReady) {
    return ["Waiting for first answer", "Will check evidence", "Will listen for impact"];
  }

  const thoughts: string[] = [];

  if (memory.unsupportedClaims > 0) thoughts.push("Needs verified claims");
  if (memory.missingMetrics >= 2) thoughts.push("Needs metrics");
  if (memory.missingOwnership >= 2) thoughts.push("Ownership unclear");
  if (memory.vagueAnswers >= 2) thoughts.push("Answers too broad");
  if (memory.strongAnswers >= 2) thoughts.push("Evidence improving");
  if (signal.trust < 60) thoughts.push("Trust needs recovery");
  if (signal.interest >= 75) thoughts.push("Strong role signal");

  if (!thoughts.length) thoughts.push(signal.concern || "Ready to go deeper");

  return thoughts.slice(0, 3);
}

function getRecognitionConstructor() {
  if (typeof window === "undefined") return null;
  const speechWindow = window as WindowWithSpeechRecognition;
  return (
    speechWindow.SpeechRecognition ||
    speechWindow.webkitSpeechRecognition ||
    null
  );
}


function recruiterLooksMale(setup: InterviewSetup) {
  const value = `${setup.recruiterId} ${setup.recruiterName} ${setup.recruiterTitle}`.toLowerCase();
  return value.includes("daniel") || value.includes("markus") || value.includes("male");
}

function getAvailableVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !window.speechSynthesis) return Promise.resolve([]);

  const currentVoices = window.speechSynthesis.getVoices();
  if (currentVoices.length) return Promise.resolve(currentVoices);

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      resolve(window.speechSynthesis.getVoices());
    }, 500);

    window.speechSynthesis.onvoiceschanged = () => {
      window.clearTimeout(timeout);
      resolve(window.speechSynthesis.getVoices());
    };
  });
}

function preferredVoiceForRecruiter(voices: SpeechSynthesisVoice[], setup: InterviewSetup) {
  return getFallbackVoiceForLanguage(voices, setup);
}

function extractYearsClaim(answer: string) {
  const lower = answer.toLowerCase();
  const digitMatch = lower.match(/\b(\d{1,2})\s*(?:\+?\s*)?(?:years?|yrs?)\b/);
  if (digitMatch) return Number(digitMatch[1]);

  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
  };

  for (const [word, value] of Object.entries(words)) {
    if (new RegExp(`\\b${word}\\s+(?:years?|yrs?)\\b`).test(lower)) return value;
  }

  return null;
}


function normalizedEvidenceText(setup: InterviewSetup) {
  return `${setup.cvText || ""} ${setup.jobDescription || ""}`
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeClaimText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+.#& -]/g, " ")
    .replace(/\b(the|a|an|company|role|position|job|team|department)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function evidenceIncludesClaim(evidence: string, claim: string) {
  const normalized = normalizeClaimText(claim);
  if (!normalized || normalized.length < 3) return true;

  if (evidence.includes(normalized)) return true;

  const compactEvidence = evidence.replace(/[^a-z0-9]/g, "");
  const compactClaim = normalized.replace(/[^a-z0-9]/g, "");

  if (compactClaim.length >= 4 && compactEvidence.includes(compactClaim)) return true;

  const words = normalized
    .split(" ")
    .map((word) => word.trim())
    .filter((word) => word.length >= 4);

  if (!words.length) return true;

  return words.every((word) => evidence.includes(word));
}

function extractCompanyClaims(answer: string) {
  const claims = new Set<string>();
  const patterns = [
    /\b(?:at|with|for|from|in)\s+([A-Z][A-Za-z0-9&.\- ]{2,45})(?=[,.!?]|$|\s+(?:as|where|for|with|and|but|during|from|in|on|when|while))/g,
    /\b(?:worked|working|employed|interned|consulted)\s+(?:at|with|for|in)\s+([A-Z][A-Za-z0-9&.\- ]{2,45})(?=[,.!?]|$|\s+(?:as|where|for|with|and|but|during|from|in|on|when|while))/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(answer))) {
      const value = match[1]
        .replace(/\b(as|where|for|with|and|but|during|from|in|on|when|while)\b.*$/i, "")
        .trim();

      if (
        value &&
        value.length >= 3 &&
        !/\b(years?|months?|experience|role|position|sales|executive|manager|engineer|analyst|support|customer|software|saas)\b/i.test(value)
      ) {
        claims.add(value);
      }
    }
  }

  const knownCompanies = [
    "tesla",
    "google",
    "microsoft",
    "amazon",
    "meta",
    "apple",
    "zoho",
    "salesforce",
    "sap",
    "oracle",
    "accenture",
    "bearingpoint",
    "ibm",
    "deloitte",
    "tcs",
    "infosys",
    "wipro",
  ];

  for (const company of knownCompanies) {
    if (new RegExp(`\\b${company}\\b`, "i").test(answer)) claims.add(company);
  }

  return Array.from(claims);
}

function extractRoleClaims(answer: string) {
  const roles = new Set<string>();
  const patterns = [
    /\b(?:as|as a|as an|role as|position as|worked as|working as)\s+(?:a\s+|an\s+)?([A-Za-z][A-Za-z /&+\-]{3,50})(?=[,.!?]|$|\s+(?:at|with|for|where|and|but|during))/gi,
    /\b(?:i am|i was|i have been)\s+(?:a\s+|an\s+)?([A-Za-z][A-Za-z /&+\-]{3,50})(?=[,.!?]|$|\s+(?:at|with|for|where|and|but|during))/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(answer))) {
      const role = match[1]
        .replace(/\b(at|with|for|where|and|but|during)\b.*$/i, "")
        .trim();

      if (
        role &&
        role.length >= 4 &&
        /\b(executive|manager|engineer|analyst|developer|consultant|specialist|lead|support|sales|marketing|product|designer|recruiter|success)\b/i.test(role)
      ) {
        roles.add(role);
      }
    }
  }

  return Array.from(roles);
}

function extractUnsupportedClaimReason(answer: string, setup: InterviewSetup) {
  const evidence = normalizedEvidenceText(setup);
  if (!evidence) return "";

  const lower = answer.toLowerCase();

  if (
    /\b(i lied|i made that up|i made it up|not true|wasn't true|that is false|i exaggerated|sorry.*lie|i just lied|i was lying|fake)\b/i.test(
      lower,
    )
  ) {
    return "The candidate admitted the claim is false or exaggerated.";
  }

  const companyClaims = extractCompanyClaims(answer);
  for (const company of companyClaims) {
    if (!evidenceIncludesClaim(evidence, company)) {
      return `The company "${company}" is not visible in the CV or job context.`;
    }
  }

  const roleClaims = extractRoleClaims(answer);
  for (const role of roleClaims) {
    if (!evidenceIncludesClaim(evidence, role)) {
      return `The role "${role}" is not clearly supported by the CV.`;
    }
  }

  const yearsClaim = extractYearsClaim(answer);
  if (yearsClaim) {
    const directDigit = new RegExp(`\\b${yearsClaim}\\s*(?:\\+?\\s*)?(?:years?|yrs?)\\b`, "i");
    const wordMap: Record<number, string> = {
      1: "one",
      2: "two",
      3: "three",
      4: "four",
      5: "five",
      6: "six",
      7: "seven",
      8: "eight",
      9: "nine",
      10: "ten",
      11: "eleven",
      12: "twelve",
      13: "thirteen",
      14: "fourteen",
      15: "fifteen",
    };

    const word = wordMap[yearsClaim];
    const directWord = word ? new RegExp(`\\b${word}\\s+(?:years?|yrs?)\\b`, "i") : null;

    if (!directDigit.test(evidence) && !(directWord && directWord.test(evidence))) {
      return `${yearsClaim} years of experience is not verified in the CV.`;
    }
  }

  return "";
}

function hasEvidenceForClaim(answer: string, setup: InterviewSetup) {
  return !extractUnsupportedClaimReason(answer, setup);
}

function buildUnsupportedClaimChallenge(answer: string, setup: InterviewSetup) {
  const reason = extractUnsupportedClaimReason(answer, setup);

  if (!reason) {
    return "I need to pause there. I cannot clearly verify that claim from your CV. Can you clarify what evidence supports it?";
  }

  return `I need to pause there. ${reason} Before we continue, can you clarify whether this was official employment, freelance work, volunteer experience, transferable experience, or just an example scenario? I want to evaluate only experience that can be supported.`;
}



function enforceRuntimeLanguageForReply(setup: InterviewSetup, reply: string) {
  const language = normalizeInterviewLanguage(setup.language);
  const text = safeText(reply);
  if (!text || language.code === "en-US") return text;

  if (language.code === "de-DE") {
    if (/^Yes, I can hear you/i.test(text)) return "Ja, ich kann dich hören. Lass uns richtig beginnen. Gib mir bitte einen kurzen Überblick über deinen Hintergrund und warum diese Rolle für dich relevant ist.";
    if (/I’m following you, but I need more detail/i.test(text)) return "Ich folge dir, aber ich brauche mehr Details, bevor ich die Passung beurteilen kann. Gib mir eine konkrete Situation, was du persönlich getan hast und was sich danach verändert hat.";
    if (/The answer still sounds team-level/i.test(text)) return "Die Antwort klingt noch zu sehr nach Teamleistung. Was genau hast du persönlich entschieden, gebaut, gelöst oder verantwortet?";
    if (/measurable impact|Now add measurable/i.test(text)) return "Die Geschichte ist klar. Jetzt brauche ich messbare Wirkung. Was hat sich nach deiner Arbeit verändert — Zeitersparnis, weniger Fehler, bessere Qualität, Kundenzufriedenheit oder ein Geschäftsergebnis?";
    if (/I need to pause there/i.test(text)) return "Ich muss hier kurz stoppen. Diese Aussage kann ich aus deinem CV nicht klar verifizieren. Kannst du erklären, ob das offizielle Berufserfahrung, freiberufliche Arbeit, freiwillige Erfahrung, übertragbare Erfahrung oder nur ein Beispielszenario war?";
  }

  if (language.code === "nl-NL") {
    if (/^Yes, I can hear you/i.test(text)) return "Ja, ik kan je horen. Laten we goed beginnen. Geef me kort een overzicht van je achtergrond en waarom deze rol relevant voor je is.";
    if (/I’m following you, but I need more detail/i.test(text)) return "Ik volg je, maar ik heb meer details nodig voordat ik de fit kan beoordelen. Geef één concrete situatie, wat jij persoonlijk deed en wat er daarna veranderde.";
    if (/The answer still sounds team-level/i.test(text)) return "Het antwoord klinkt nog te veel als teamniveau. Wat heb jij persoonlijk besloten, gebouwd, opgelost of geleverd?";
    if (/measurable impact|Now add measurable/i.test(text)) return "Het verhaal is duidelijk. Nu wil ik meetbare impact. Wat veranderde er na jouw werk — tijdwinst, minder fouten, betere kwaliteit, klanttevredenheid of een bedrijfsresultaat?";
  }

  if (language.code === "fr-FR") {
    if (/^Yes, I can hear you/i.test(text)) return "Oui, je t’entends. Commençons correctement. Présente brièvement ton parcours et explique pourquoi ce poste est pertinent pour toi.";
    if (/I’m following you, but I need more detail/i.test(text)) return "Je te suis, mais j’ai besoin de plus de détails pour évaluer la pertinence. Donne-moi une situation concrète, ce que tu as fait personnellement et ce qui a changé ensuite.";
    if (/The answer still sounds team-level/i.test(text)) return "La réponse semble encore trop collective. Qu’as-tu personnellement décidé, construit, résolu ou livré ?";
    if (/measurable impact|Now add measurable/i.test(text)) return "L’histoire est claire. Maintenant, ajoute un impact mesurable. Qu’est-ce qui a changé après ton travail ?";
  }

  if (language.code === "es-ES") {
    if (/^Yes, I can hear you/i.test(text)) return "Sí, puedo escucharte. Empecemos bien. Dame un breve resumen de tu trayectoria y por qué este puesto es relevante para ti.";
    if (/I’m following you, but I need more detail/i.test(text)) return "Te sigo, pero necesito más detalle para evaluar el encaje. Dame una situación concreta, lo que hiciste personalmente y qué cambió después.";
    if (/The answer still sounds team-level/i.test(text)) return "La respuesta todavía suena demasiado a trabajo de equipo. ¿Qué decidiste, construiste, resolviste o entregaste tú personalmente?";
    if (/measurable impact|Now add measurable/i.test(text)) return "La historia está clara. Ahora añade impacto medible. ¿Qué cambió después de tu trabajo?";
  }

  if (language.code === "it-IT") {
    if (/^Yes, I can hear you/i.test(text)) return "Sì, ti sento. Iniziamo bene. Raccontami brevemente il tuo percorso e perché questo ruolo è rilevante per te.";
    if (/I’m following you, but I need more detail/i.test(text)) return "Ti seguo, ma ho bisogno di più dettagli per valutare l’idoneità. Dammi una situazione concreta, cosa hai fatto personalmente e cosa è cambiato dopo.";
    if (/The answer still sounds team-level/i.test(text)) return "La risposta sembra ancora troppo a livello di team. Cosa hai deciso, costruito, risolto o consegnato personalmente?";
    if (/measurable impact|Now add measurable/i.test(text)) return "La storia è chiara. Ora aggiungi un impatto misurabile. Cosa è cambiato dopo il tuo lavoro?";
  }

  if (language.code === "pt-PT") {
    if (/^Yes, I can hear you/i.test(text)) return "Sim, consigo ouvir-te. Vamos começar corretamente. Dá-me um breve resumo do teu percurso e explica porque esta função é relevante para ti.";
    if (/I’m following you, but I need more detail/i.test(text)) return "Estou a acompanhar, mas preciso de mais detalhes antes de avaliar o encaixe. Dá-me uma situação concreta, o que fizeste pessoalmente e o que mudou depois.";
    if (/The answer still sounds team-level/i.test(text)) return "A resposta ainda soa demasiado ao nível da equipa. O que decidiste, construíste, resolveste ou entregaste pessoalmente?";
    if (/measurable impact|Now add measurable/i.test(text)) return "A história está clara. Agora adiciona impacto mensurável. O que mudou depois do teu trabalho?";
  }

  return text;
}


function buildRecruiterReply(answer: string, questionIndex: number, setup: InterviewSetup, memory: RecruiterMemoryState = defaultRecruiterMemory) {
  const lower = answer.toLowerCase();
  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;

  if (
    /\b(i lied|i made that up|i made it up|not true|wasn't true|that is false|i exaggerated|sorry.*lie|i just lied)\b/i.test(
      lower,
    )
  ) {
    return "Thank you for being honest. I appreciate the correction, but recruiter trust drops slightly when details change. Let’s continue only with verified experience from your CV. Tell me about one real project, customer issue, or responsibility you can confidently support.";
  }

  if (!hasEvidenceForClaim(answer, setup)) {
    return buildUnsupportedClaimChallenge(answer, setup);
  }

  if (/\b(can you hear me|do you hear me|hello|hi|how are you)\b/i.test(lower) && wordCount <= 10) {
    return "Yes, I can hear you. Let’s begin properly. Give me a short overview of your background and why this role is relevant for you.";
  }

  if (wordCount < 12) {
    return "I’m following you, but I need more detail before I can judge the fit. Give me one specific situation, what you personally did, and what changed after that.";
  }

  if (!/\b(i|my|me|personally|owned|built|handled|created|led|resolved|analyzed|improved|reduced|increased)\b/i.test(answer)) {
    return "The answer still sounds team-level. What exactly did you personally own or do? Give me your action, not just the team result.";
  }

  if (
    !/\d|percent|customers?|tickets?|hours?|days?|saved|reduced|increased|improved|revenue|cost|time|quality|sla|csat|nps/i.test(
      answer,
    )
  ) {
    return "That gives me the story. Now add measurable impact. What changed after your work — time saved, fewer issues, quality improved, customer satisfaction, or business outcome?";
  }

  if (!/\b(result|impact|outcome|after|so|therefore|which led|improved|reduced|increased|saved)\b/i.test(answer)) {
    return "You explained the action, but I still need the result. What was different after you handled it?";
  }

  return buildMemoryAwareFollowUp(answer, questionIndex, setup, memory);
}


function scoreClamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function hasMetricSignal(answer: string) {
  return /\d|percent|%|customers?|users?|tickets?|hours?|days?|weeks?|months?|saved|reduced|increased|improved|revenue|cost|time|quality|sla|csat|nps|conversion|retention/i.test(
    answer,
  );
}

function hasOwnershipSignal(answer: string) {
  return /\b(i|my|me|personally|owned|built|handled|created|led|resolved|analyzed|improved|reduced|increased|designed|implemented|managed|supported|debugged|troubleshot)\b/i.test(
    answer,
  );
}

function hasOutcomeSignal(answer: string) {
  return /\b(result|impact|outcome|after|therefore|which led|improved|reduced|increased|saved|resolved|delivered|achieved)\b/i.test(
    answer,
  );
}

function hasAdmissionSignal(answer: string) {
  return /\b(i lied|i made that up|i made it up|not true|wasn't true|that is false|i exaggerated|sorry.*lie|i just lied|i was lying)\b/i.test(
    answer,
  );
}

function hasUnsupportedClaimSignal(answer: string, setup?: InterviewSetup) {
  if (setup) return Boolean(extractUnsupportedClaimReason(answer, setup));
  return /\b(tesla|google|microsoft|amazon|meta|apple|salesforce|sap|oracle|accenture|bearingpoint)\b/i.test(answer) || /\b(1|2|3|4|5|6|7|8|9|10|11|12|13|14|15)\s*\+?\s*(years?|yrs?)\b/i.test(answer);
}

function analyzeAnswerSignals(answer: string, setup?: InterviewSetup) {
  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;
  const metric = hasMetricSignal(answer);
  const ownership = hasOwnershipSignal(answer);
  const outcome = hasOutcomeSignal(answer);
  const admission = hasAdmissionSignal(answer);
  const unsupported = hasUnsupportedClaimSignal(answer, setup);
  const short = wordCount > 0 && wordCount < 14;
  const long = wordCount > 150;
  const vague =
    /\b(stuff|things|many things|good|nice|various|some|helped|worked on|responsible for|involved in)\b/i.test(
      answer,
    ) && !metric;

  let delta = 0;
  if (metric) delta += 5;
  if (ownership) delta += 4;
  if (outcome) delta += 4;
  if (wordCount >= 35 && wordCount <= 120) delta += 3;
  if (short) delta -= 7;
  if (vague) delta -= 6;
  if (long) delta -= 4;
  if (unsupported) delta -= 10;
  if (admission) delta -= 8;

  let concern = "Waiting for a specific answer with proof.";
  if (admission) concern = "Candidate corrected a false or exaggerated claim.";
  else if (unsupported) concern = "A claim may not be supported by the CV.";
  else if (short) concern = "Answer is too short to judge.";
  else if (vague) concern = "Answer sounds generic without evidence.";
  else if (!ownership) concern = "Personal ownership is still unclear.";
  else if (!metric) concern = "Measurable impact is missing.";
  else if (!outcome) concern = "Outcome is not clear.";
  else concern = "Good answer. Recruiter is ready to go deeper.";

  return { wordCount, metric, ownership, outcome, admission, unsupported, short, long, vague, delta, concern };
}

function updateRecruiterSignalState(previous: RecruiterSignalState, answer: string, setup?: InterviewSetup): RecruiterSignalState {
  const signal = analyzeAnswerSignals(answer, setup);
  const trustDelta = signal.admission ? -12 : signal.unsupported ? -20 : signal.metric && signal.ownership ? 4 : signal.short || signal.vague ? -4 : 1;
  const interestDelta = signal.unsupported ? -12 : signal.metric && signal.outcome ? 5 : signal.short || signal.vague ? -5 : signal.ownership ? 2 : -1;

  const trust = scoreClamp(previous.trust + trustDelta);
  const interest = scoreClamp(previous.interest + interestDelta);
  const clarity = scoreClamp(previous.clarity + (signal.vague || signal.short ? -5 : signal.wordCount > 30 ? 3 : 0));
  const confidence = scoreClamp(previous.confidence + (signal.ownership ? 3 : -2));
  const relevance = scoreClamp(previous.relevance + (signal.metric || signal.outcome ? 2 : signal.short ? -2 : 0));
  const communication = scoreClamp(previous.communication + (signal.outcome ? 3 : signal.vague ? -3 : 1));
  const overall = scoreClamp((trust + interest + clarity + confidence + relevance + communication) / 6);

  let mood: RecruiterSignalState["mood"] = "Neutral";
  if (trust >= 78 && interest >= 78) mood = "Impressed";
  else if (trust >= 68 && interest >= 65) mood = "Engaged";
  else if (trust < 45 || interest < 45) mood = "Doubtful";
  else if (trust < 60 || interest < 58) mood = "Concerned";

  return {
    overall,
    confidence,
    clarity,
    relevance,
    communication,
    trust,
    interest,
    mood,
    concern: signal.concern,
  };
}

function recruiterMoodColor(mood: RecruiterSignalState["mood"]) {
  if (mood === "Impressed") return "text-emerald-300";
  if (mood === "Engaged") return "text-blue-300";
  if (mood === "Concerned") return "text-amber-300";
  if (mood === "Doubtful") return "text-red-300";
  return "text-slate-300";
}



const defaultRecruiterSignal: RecruiterSignalState = {
  overall: 78,
  confidence: 82,
  clarity: 75,
  relevance: 80,
  communication: 76,
  trust: 74,
  interest: 72,
  mood: "Engaged",
  concern: "Waiting for a specific answer with proof.",
};

function getWaitingRecruiterSignal(): RecruiterSignalState {
  return {
    ...defaultRecruiterSignal,
    mood: "Neutral",
    concern: "Waiting for the first answer.",
  };
}

const defaultRecruiterMemory: RecruiterMemoryState = {
  vagueAnswers: 0,
  missingMetrics: 0,
  missingOwnership: 0,
  unsupportedClaims: 0,
  strongAnswers: 0,
  lastConcern: "Waiting for the first answer.",
  liveNote: "Waiting for the first answer.",
  patterns: [],
  askedTopics: [],
  answeredTopics: [],
  metricsMentioned: [],
  strengthsMentioned: [],
  needsClosingChallenge: false,
  closingAsked: false,
  readyForResults: false,
  trustTimeline: [],
};

function detectCompanyInterviewStyle(setup: InterviewSetup): CompanyInterviewStyle {
  const text = `${setup.targetCompany || ""} ${setup.jobDescription || ""} ${setup.targetRole || ""}`.toLowerCase();

  if (/\b(startup|founder|seed|series a|series b|fast-paced|0 to 1|ownership|early stage)\b/i.test(text)) {
    return "Startup";
  }

  if (/\b(big tech|scale|distributed systems|millions|large-scale|platform|faang|google|amazon|microsoft|meta|apple)\b/i.test(text)) {
    return "Big Tech";
  }

  if (/\b(consulting|consultant|client-facing|stakeholder|strategy|transformation|advisory|project delivery)\b/i.test(text)) {
    return "Consulting";
  }

  if (/\b(corporate|enterprise|process|compliance|governance|cross-functional|matrix|structured)\b/i.test(text)) {
    return "Corporate";
  }

  return "Global realistic interview";
}

function recruiterPersonalityInstructions(setup: InterviewSetup) {
  const key = `${setup.recruiterId} ${setup.recruiterName} ${setup.recruiterTitle}`.toLowerCase();

  if (key.includes("daniel") || key.includes("analytical")) {
    return "Act like Daniel: analytical hiring manager. Probe metrics, decision-making, ownership, tradeoffs, and exact reasoning. Be calm but skeptical when answers lack proof.";
  }

  if (key.includes("priya") || key.includes("startup")) {
    return "Act like Priya: startup recruiter. Probe ownership, speed, ambiguity, initiative, customer impact, and whether the candidate can operate without perfect structure.";
  }

  if (key.includes("markus") || key.includes("corporate") || key.includes("german")) {
    return "Act like Markus: structured corporate interviewer. Probe process, precision, collaboration, stakeholder communication, reliability, and evidence. Be measured and formal.";
  }

  return "Act like Sarah: friendly HR recruiter. Be warm and encouraging, but still challenge unsupported claims and ask for clear examples.";
}

function companyStyleInstructions(style: CompanyInterviewStyle) {
  if (style === "Startup") {
    return "Company style: Startup. Prioritize ownership, speed, ambiguity, practical execution, and learning fast.";
  }

  if (style === "Big Tech") {
    return "Company style: Big Tech. Prioritize scale, structured thinking, tradeoffs, clarity, collaboration, and measurable impact.";
  }

  if (style === "Consulting") {
    return "Company style: Consulting. Prioritize stakeholder management, problem framing, business impact, communication, and delivery under pressure.";
  }

  if (style === "Corporate") {
    return "Company style: Corporate. Prioritize process, reliability, documentation, collaboration, compliance, and structured examples.";
  }

  return "Company style: Global realistic interview. Adapt questions to the role, country, company, and job description when available.";
}

function normalizeInterviewLanguage(value?: string) {
  const raw = safeText(value, "en-US").toLowerCase();

  if (raw.includes("de") || raw.includes("german") || raw.includes("deutsch")) {
    return { code: "de-DE", label: "German", instruction: "Conduct the interview in German. Keep recruiter questions natural, professional, and concise." };
  }

  if (raw.includes("nl") || raw.includes("dutch") || raw.includes("nederlands")) {
    return { code: "nl-NL", label: "Dutch", instruction: "Conduct the interview in Dutch. Keep recruiter questions natural, professional, and concise." };
  }

  if (raw.includes("hi") || raw.includes("hindi")) {
    return { code: "hi-IN", label: "Hindi", instruction: "Conduct the interview in Hindi when possible. If voice support is limited, use clear simple English with Hindi-friendly phrasing." };
  }

  if (raw.includes("ta") || raw.includes("tamil")) {
    return { code: "ta-IN", label: "Tamil", instruction: "Conduct the interview in Tamil when possible. If voice support is limited, use clear simple English with Tamil-friendly phrasing." };
  }

  if (raw.includes("auto")) {
    return { code: "en-US", label: "Auto", instruction: "Use the candidate's selected or detected language. If unsure, default to English." };
  }

  return { code: "en-US", label: "English", instruction: "Conduct the interview in English." };
}


function getSpeechRecognitionLang(setup: InterviewSetup) {
  return normalizeInterviewLanguage(setup.language).code;
}

function getSpeechSynthesisLang(setup: InterviewSetup) {
  return normalizeInterviewLanguage(setup.language).code;
}

function getFallbackVoiceForLanguage(voices: SpeechSynthesisVoice[], setup: InterviewSetup) {
  const language = normalizeInterviewLanguage(setup.language);
  const wantsMale = recruiterLooksMale(setup);
  const languageVoices = voices.filter((voice) =>
    voice.lang?.toLowerCase().startsWith(language.code.split("-")[0].toLowerCase()),
  );

  const preferredPool = languageVoices.length ? languageVoices : voices;
  const femaleNames = /aria|jenny|samantha|zira|susan|victoria|karen|moira|tessa|female|helena|hortense|lucie|paulina|sabina/i;
  const maleNames = /david|mark|guy|george|daniel|alex|fred|tom|male|thomas|paul|jorge|luciano/i;

  if (wantsMale) {
    return (
      preferredPool.find((voice) => maleNames.test(voice.name)) ||
      preferredPool.find((voice) => !femaleNames.test(voice.name)) ||
      preferredPool[0] ||
      voices[0]
    );
  }

  return (
    preferredPool.find((voice) => femaleNames.test(voice.name)) ||
    preferredPool.find((voice) => !maleNames.test(voice.name)) ||
    preferredPool[0] ||
    voices[0]
  );
}

function enforceSelectedLanguagePrefix(setup: InterviewSetup) {
  const language = normalizeInterviewLanguage(setup.language);
  return [
    `INTERVIEW LANGUAGE: ${language.label}.`,
    language.instruction,
    "This instruction is mandatory for recruiter questions, follow-ups, fallback TTS, and visible transcript.",
    "Do not default to English unless the selected language is English or the candidate explicitly asks to switch.",
  ].join(" ");
}



function buildLanguageInstruction(setup: InterviewSetup) {
  const language = normalizeInterviewLanguage(setup.language);
  return [
    `MANDATORY INTERVIEW LANGUAGE: ${language.label}.`,
    language.instruction,
    "All recruiter questions, follow-ups, clarifications, pressure moments, transcript messages, and fallback TTS replies must use this selected language.",
    "Do not default to English unless the selected language is English or the candidate explicitly asks to switch.",
    "Evaluate internally however needed, but speak to the candidate in the selected language.",
  ].join(" ");
}

function localizedOpeningQuestion(setup: InterviewSetup) {
  const language = normalizeInterviewLanguage(setup.language);
  const name = safeGreetingName(setup.candidateName);
  const role = setup.targetRole || "this role";

  if (language.code === "de-DE") {
    return `Hallo ${name}. Beginnen wir mit deinem Interview für die Rolle ${role}. Kannst du mir kurz deinen Hintergrund erklären und warum diese Rolle für dich relevant ist?`;
  }

  if (language.code === "nl-NL") {
    return `Hallo ${name}. Laten we beginnen met je interview voor de rol ${role}. Kun je kort je achtergrond toelichten en uitleggen waarom deze rol relevant voor je is?`;
  }

  if (language.code === "hi-IN") {
    return `Hi ${name}. Let’s begin your interview for the ${role} role. Please answer in Hindi or English, whichever feels natural. ${recruiterQuestions[0]}`;
  }

  if (language.code === "ta-IN") {
    return `Hi ${name}. Let’s begin your interview for the ${role} role. Please answer in Tamil or English, whichever feels natural. ${recruiterQuestions[0]}`;
  }

  return `Hi ${name}. Let’s begin your interview for the ${role} role. ${recruiterQuestions[0]}`;
}

function buildContextQualityNotice(setup: InterviewSetup) {
  const hasCv = Boolean(safeText(setup.cvText));
  const hasJd = Boolean(safeText(setup.jobDescription));

  if (hasCv && hasJd) return "CV and job description are available. Use both as verified context.";
  if (hasCv) return "CV context is available, but the job description is missing or incomplete. Ask role-relevant follow-ups, but do not invent JD requirements.";
  if (hasJd) return "Job description is available, but CV context is missing or incomplete. Ask the candidate to verify their background before assuming experience.";
  return "CV and job description context are missing or incomplete. Keep the interview useful, but clearly ask the candidate to provide missing context when needed.";
}

function uniqueLimited(values: string[], limit = 8) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, limit);
}

function extractCapitalizedPhrases(text: string) {
  const matches = text.match(/\b[A-Z][A-Za-z0-9&.+#'/-]*(?:\s+[A-Z][A-Za-z0-9&.+#'/-]*){0,4}\b/g) || [];
  return uniqueLimited(
    matches.filter((item) =>
      item.length >= 3 &&
      !/^(The|And|For|From|With|This|That|WorkZo|AI|CV|JD|Resume)$/i.test(item),
    ),
    10,
  );
}

function extractCvFactMemory(setup: InterviewSetup) {
  const cv = safeText(setup.cvText);
  const evidence = normalizedEvidenceText(setup);
  const companies = uniqueLimited(extractCompanyClaims(cv), 8);
  const roles = uniqueLimited(extractRoleClaims(cv), 8);
  const namedPhrases = extractCapitalizedPhrases(cv).filter((item) => !companies.includes(item) && !roles.includes(item)).slice(0, 8);
  const years = Array.from(new Set((cv.match(/\b\d{1,2}\s*\+?\s*(?:years?|yrs?)\b/gi) || []).map((item) => item.trim()))).slice(0, 6);
  const metrics = extractMetricSnippets(cv).slice(0, 8);
  const skills = uniqueLimited(
    [
      "sql", "python", "excel", "power bi", "tableau", "crm", "salesforce", "zendesk", "freshdesk", "jira", "customer support", "technical support", "data analysis", "stakeholder management", "project management", "api", "saas",
    ].filter((skill) => evidence.includes(skill)),
    14,
  );

  return { companies, roles, namedPhrases, years, metrics, skills, hasCv: Boolean(cv) };
}

function extractJdFactMemory(setup: InterviewSetup) {
  const jd = safeText(setup.jobDescription);
  const lower = jd.toLowerCase();
  const requiredSignals = uniqueLimited(
    [
      "communication", "stakeholder", "customer", "sales", "support", "crm", "sql", "python", "excel", "analytics", "reporting", "leadership", "ownership", "collaboration", "problem solving", "project management", "agile", "api", "saas", "documentation", "english", "german", "dutch",
    ].filter((skill) => lower.includes(skill)),
    14,
  );
  const responsibilities = uniqueLimited(
    jd
      .split(/[\n.;]/)
      .map((line) => line.trim())
      .filter((line) => line.length >= 24 && line.length <= 150)
      .filter((line) => /responsib|manage|support|analy|build|create|lead|communicat|collaborat|improv|deliver|customer|stakeholder/i.test(line)),
    6,
  );

  return { requiredSignals, responsibilities, hasJd: Boolean(jd) };
}

function buildFactualMemoryBrief(setup: InterviewSetup) {
  const cvFacts = extractCvFactMemory(setup);
  const jdFacts = extractJdFactMemory(setup);

  return [
    buildContextQualityNotice(setup),
    cvFacts.companies.length ? `CV companies: ${cvFacts.companies.join(", ")}.` : "CV companies: none clearly extracted.",
    cvFacts.roles.length ? `CV roles: ${cvFacts.roles.join(", ")}.` : "CV roles: none clearly extracted.",
    cvFacts.skills.length ? `CV skills/signals: ${cvFacts.skills.join(", ")}.` : "CV skills/signals: none clearly extracted.",
    cvFacts.metrics.length ? `CV metrics/results: ${cvFacts.metrics.join(", ")}.` : "CV metrics/results: none clearly extracted.",
    jdFacts.requiredSignals.length ? `JD requirements/signals: ${jdFacts.requiredSignals.join(", ")}.` : "JD requirements/signals: none clearly extracted.",
    jdFacts.responsibilities.length ? `JD responsibilities: ${jdFacts.responsibilities.slice(0, 3).join(" | ")}.` : "JD responsibilities: none clearly extracted.",
  ].join("\n");
}

function buildFactAwareFollowUp(setup: InterviewSetup, memory: RecruiterMemoryState) {
  const cvFacts = extractCvFactMemory(setup);
  const jdFacts = extractJdFactMemory(setup);
  const company = cvFacts.companies.find((item) => !wasTopicCovered(memory, `cv_company_${normalizeClaimText(item)}`));
  const skill = jdFacts.requiredSignals.find((item) => !wasTopicCovered(memory, `jd_skill_${normalizeClaimText(item)}`));
  const role = cvFacts.roles.find((item) => !wasTopicCovered(memory, `cv_role_${normalizeClaimText(item)}`));

  if (company && skill) {
    return `Your CV mentions ${company}, and the job description appears to value ${skill}. Give me one verified example from ${company} that shows ${skill}, including your action and result.`;
  }

  if (company) {
    return `Your CV mentions ${company}. Tell me about one specific responsibility or project there, what you personally did, and what changed after your work.`;
  }

  if (skill) {
    return `The job description appears to value ${skill}. Give me one real example that proves you can handle that requirement.`;
  }

  if (role) {
    return `Your CV shows experience as ${role}. What was one situation in that role where your personal ownership made a measurable difference?`;
  }

  if (!cvFacts.hasCv || !jdFacts.hasJd) {
    return "Some CV or job context seems incomplete. Before I judge fit, give me one verified example from your real experience that is directly relevant to this role.";
  }

  return "";
}

function detectNextFactTopic(setup: InterviewSetup, memory: RecruiterMemoryState) {
  const cvFacts = extractCvFactMemory(setup);
  const jdFacts = extractJdFactMemory(setup);
  const company = cvFacts.companies.find((item) => !wasTopicCovered(memory, `cv_company_${normalizeClaimText(item)}`));
  if (company) return `cv_company_${normalizeClaimText(company)}`;
  const skill = jdFacts.requiredSignals.find((item) => !wasTopicCovered(memory, `jd_skill_${normalizeClaimText(item)}`));
  if (skill) return `jd_skill_${normalizeClaimText(skill)}`;
  const role = cvFacts.roles.find((item) => !wasTopicCovered(memory, `cv_role_${normalizeClaimText(item)}`));
  if (role) return `cv_role_${normalizeClaimText(role)}`;
  return "";
}


function detectAnswerTopics(answer: string) {
  const topics = new Set<string>();
  const lower = answer.toLowerCase();

  if (/\b(router|range extender|upsell|cross sell|sell|sold|sales|conversion|customer buy|purchase)\b/i.test(lower)) topics.add("sales_conversion");
  if (/\b(objection|hesitant|not willing|scam|trust|convince|rapport|worried|force)\b/i.test(lower)) topics.add("objection_handling");
  if (/\b(crm|ticket|pipeline|follow up|tracking|previous technician|pending|organized)\b/i.test(lower)) topics.add("crm_tracking");
  if (/\b(python|sql|script|query|database|service desk)\b/i.test(lower)) topics.add("technical_learning");
  if (/\b(priority|critical|deadline|multiple|manage|queue|sla)\b/i.test(lower)) topics.add("prioritization");
  if (/\b(customer handling|rapport|patient|step by step|not tech savvy|satisfied|support)\b/i.test(lower)) topics.add("customer_handling");
  if (hasMetricSignal(answer)) topics.add("metrics");
  if (hasOwnershipSignal(answer)) topics.add("ownership");
  if (hasOutcomeSignal(answer)) topics.add("outcome");

  return Array.from(topics);
}

function extractMetricSnippets(answer: string) {
  const matches = answer.match(/\b(?:\d+\s*(?:out of|\/)\s*\d+|\d+\s*%|\d+\s*(?:customers?|routers?|tickets?|months?|years?)|twice|once|every\s+\w+)\b/gi);
  return matches ? matches.slice(0, 4) : [];
}

function detectStrengthSnippets(answer: string) {
  const strengths: string[] = [];

  if (/(customer handling|rapport|convincing|patient|step by step)/i.test(answer)) {
    strengths.push("customer handling");
  }

  if (/(quick learner|learned|python|sql|new tool)/i.test(answer)) {
    strengths.push("quick learner");
  }

  if (/(sold|conversion|router|range extender|buy)/i.test(answer)) {
    strengths.push("sales conversion");
  }

  if (/(priority|critical|manage multiple|deadline)/i.test(answer)) {
    strengths.push("prioritization");
  }

  return strengths;
}

function rememberAskedTopic(memory: RecruiterMemoryState, topic: string): RecruiterMemoryState {
  if (memory.askedTopics.includes(topic)) return memory;
  return {
    ...memory,
    askedTopics: [...memory.askedTopics, topic].slice(-14),
  };
}

function wasTopicCovered(memory: RecruiterMemoryState, topic: string) {
  return memory.askedTopics.includes(topic) || memory.answeredTopics.includes(topic);
}

function buildClosingChallenge(setup: InterviewSetup, memory: RecruiterMemoryState) {
  const strengths = memory.strengthsMentioned.length
    ? memory.strengthsMentioned.slice(0, 2).join(" and ")
    : "your strongest relevant experience";

  return `Before we finish, I want one final concise answer. Why should we choose you for this ${setup.targetRole} role over another candidate, using ${strengths} and one verified result?`;
}

function cleanRecruiterFinalText(text: string, setup: InterviewSetup) {
  const firstName = safeFirstName(setup.candidateName);

  return cleanVisibleTranscriptText(text)
    .replace(/\bMichel,?\s*/gi, "")
    .replace(/\bthe first few time,?\s*/gi, "")
    .replace(/\bwe'll be in touch soon.*$/i, `we'll be in touch soon. Have a great day, ${firstName}.`)
    .replace(/\bthanks for your time.*$/i, `Thank you for your time, ${firstName}. We'll be in touch soon. Have a great day.`)
    .trim();
}

function updateRecruiterMemoryState(
  previous: RecruiterMemoryState,
  answer: string,
  setup: InterviewSetup,
  signal: RecruiterSignalState,
): RecruiterMemoryState {
  const analysis = analyzeAnswerSignals(answer, setup);
  const unsupportedReason = extractUnsupportedClaimReason(answer, setup);

  const vagueAnswers = previous.vagueAnswers + (analysis.vague || analysis.short ? 1 : 0);
  const missingMetrics = previous.missingMetrics + (!analysis.metric ? 1 : 0);
  const missingOwnership = previous.missingOwnership + (!analysis.ownership ? 1 : 0);
  const unsupportedClaims = previous.unsupportedClaims + (unsupportedReason ? 1 : 0);
  const strongAnswers = previous.strongAnswers + (analysis.metric && analysis.ownership && analysis.outcome ? 1 : 0);

  const patterns = new Set(previous.patterns);
  const answeredTopics = new Set(previous.answeredTopics);
  detectAnswerTopics(answer).forEach((topic) => answeredTopics.add(topic));

  const metricsMentioned = Array.from(
    new Set([...previous.metricsMentioned, ...extractMetricSnippets(answer)]),
  ).slice(-10);

  const strengthsMentioned = Array.from(
    new Set([...previous.strengthsMentioned, ...detectStrengthSnippets(answer)]),
  ).slice(-8);

  if (vagueAnswers >= 2) patterns.add("Candidate has given multiple vague or short answers.");
  if (missingMetrics >= 2) patterns.add("Candidate repeatedly avoids measurable impact.");
  if (missingOwnership >= 2) patterns.add("Personal ownership is not consistently clear.");
  if (unsupportedClaims >= 1) patterns.add("Unsupported claim detected; recruiter trust should recover only with verified details.");
  if (strongAnswers >= 2) patterns.add("Candidate is starting to provide stronger evidence-based answers.");

  let liveNote = signal.concern;
  if (unsupportedReason) liveNote = unsupportedReason;
  else if (missingMetrics >= 2) liveNote = "Pattern detected: metrics are missing across answers.";
  else if (missingOwnership >= 2) liveNote = "Pattern detected: personal ownership needs to be clearer.";
  else if (vagueAnswers >= 2) liveNote = "Pattern detected: answers are still too broad.";
  else if (strongAnswers >= 2) liveNote = "Positive pattern: stronger evidence and ownership are emerging.";

  const nextQuestionCount = previous.askedTopics.length;
  const needsClosingChallenge = nextQuestionCount >= 10 && !previous.closingAsked;
  const readyForResults = nextQuestionCount >= 12 || previous.readyForResults;

  return {
    vagueAnswers,
    missingMetrics,
    missingOwnership,
    unsupportedClaims,
    strongAnswers,
    lastConcern: signal.concern,
    liveNote,
    patterns: Array.from(patterns).slice(-6),
    askedTopics: previous.askedTopics,
    answeredTopics: Array.from(answeredTopics).slice(-14),
    metricsMentioned,
    strengthsMentioned,
    needsClosingChallenge,
    closingAsked: previous.closingAsked,
    readyForResults,
    trustTimeline: [
      ...previous.trustTimeline,
      {
        time: formatTranscriptTime(new Date()),
        trust: signal.trust,
        interest: signal.interest,
        note: liveNote,
      },
    ].slice(-20),
  };
}

function buildMemoryAwareFollowUp(
  answer: string,
  questionIndex: number,
  setup: InterviewSetup,
  memory: RecruiterMemoryState,
) {
  const unsupported = extractUnsupportedClaimReason(answer, setup);
  if (unsupported) {
    return buildUnsupportedClaimChallenge(answer, setup);
  }

  const style = detectCompanyInterviewStyle(setup);
  const analysis = analyzeAnswerSignals(answer, setup);

  if (questionIndex >= 11 && !memory.closingAsked) {
    return buildClosingChallenge(setup, memory);
  }

  if (memory.unsupportedClaims > 0 && !analysis.metric && !wasTopicCovered(memory, "trust_recovery")) {
    return "I need to rebuild confidence here. Give me one verified example from your CV, with a specific result or measurable outcome.";
  }

  if (memory.missingMetrics >= 2 && !wasTopicCovered(memory, "metrics_recovery")) {
    return "You've now given a few answers without numbers. Give me one concrete metric: volume, time saved, customer impact, revenue, quality, tickets, or conversion.";
  }

  if (memory.missingOwnership >= 2 && !wasTopicCovered(memory, "ownership_recovery")) {
    return "I still need clearer ownership. In that example, what did you personally decide, build, fix, lead, or deliver?";
  }

  if (memory.vagueAnswers >= 2 && !wasTopicCovered(memory, "specificity_recovery")) {
    return "Let me stop you there and make this specific. Give me one real situation, one action you personally took, and one result.";
  }

  const topicPlan = [
    {
      topic: "sales_conversion",
      question: "You mentioned sales-related work. Walk me through one conversion from customer issue to product recommendation, step by step.",
    },
    {
      topic: "objection_handling",
      question: "Now let's move to objection handling. Tell me about a customer who hesitated to buy and how you handled that conversation.",
    },
    {
      topic: "crm_tracking",
      question: "In sales, follow-up discipline matters. How have you tracked customers, tickets, or follow-ups in a system, even if it was not a formal sales CRM?",
    },
    {
      topic: "prioritization",
      question: "Sales roles involve multiple leads and urgent follow-ups. How do you prioritize when several customers or tasks need attention at once?",
    },
    {
      topic: "technical_learning",
      question: "You mentioned learning tools quickly. Give one example of a tool or technical skill you learned fast and how it helped your work.",
    },
    {
      topic: "motivation",
      question: `Why do you want to move into a dedicated ${setup.targetRole} role now, and what makes you confident this is the right direction?`,
    },
    {
      topic: "closing_challenge",
      question: buildClosingChallenge(setup, memory),
    },
  ];

  if (style === "Startup" && !wasTopicCovered(memory, "startup_ambiguity")) {
    return "In a fast-moving startup situation, how would you handle ambiguity when the process is unclear and nobody gives you perfect instructions?";
  }

  if (style === "Big Tech" && !wasTopicCovered(memory, "scale_tradeoffs")) {
    return "Now explain the same experience at scale. What tradeoff did you make, and how did you know it was the right decision?";
  }

  if (style === "Consulting" && !wasTopicCovered(memory, "stakeholders")) {
    return "Let’s make this client-facing. How did you manage stakeholders and show business impact?";
  }

  if (style === "Corporate" && !wasTopicCovered(memory, "structured_process")) {
    return "Walk me through the process you followed. How did you keep the work reliable, documented, and aligned with others?";
  }

  const factTopic = detectNextFactTopic(setup, memory);
  const factAwareQuestion = buildFactAwareFollowUp(setup, memory);
  if (factAwareQuestion && factTopic && !wasTopicCovered(memory, factTopic)) {
    return factAwareQuestion;
  }

  const next = topicPlan.find((item) => !wasTopicCovered(memory, item.topic));

  if (next) {
    return next.question;
  }

  return buildClosingChallenge(setup, memory);
}

function buildInterviewVerdict(score: RecruiterSignalState | null, memory: RecruiterMemoryState) {
  if (!score) {
    return {
      decision: "Not enough signal",
      reason: "The interview ended before enough answers were evaluated.",
    };
  }

  if (memory.unsupportedClaims > 0 && score.trust < 62) {
    return {
      decision: "Would not proceed yet",
      reason: "Unsupported or inconsistent claims reduced recruiter trust. Candidate should clarify verified experience.",
    };
  }

  if (score.overall >= 78 && memory.strongAnswers >= 2) {
    return {
      decision: "Would proceed",
      reason: "Candidate gave enough evidence, ownership, and role-relevant examples to continue.",
    };
  }

  if (score.overall >= 65) {
    return {
      decision: "Maybe / needs another round",
      reason: "Candidate shows potential, but the recruiter still needs stronger proof, metrics, or clearer ownership.",
    };
  }

  return {
    decision: "Would not proceed yet",
    reason: "Answers need more structure, evidence, measurable impact, and verified details.",
  };
}

function findWeakestInterviewMoment(transcript: TranscriptItem[], memory: RecruiterMemoryState) {
  const candidateAnswers = transcript.filter((item) => item.role === "candidate");

  if (!candidateAnswers.length) {
    return {
      answer: "",
      problem: "No candidate answer was captured.",
      advice: "Run a complete interview to receive a meaningful weakest-answer review.",
    };
  }

  const weakest =
    candidateAnswers.find((item) => /tesla|google|microsoft|amazon|meta|apple|fake|lied|not true|fifteen|15 years/i.test(item.text)) ||
    candidateAnswers.find((item) => item.text.split(/\s+/).length < 18) ||
    candidateAnswers.find((item) => !hasMetricSignal(item.text)) ||
    candidateAnswers[0];

  let problem = "This answer needs more evidence.";
  if (extractUnsupportedClaimReason(weakest.text, setupRefSafeFallback())) problem = "This answer contains a claim that may not be verified.";
  else if (weakest.text.split(/\s+/).length < 18) problem = "This answer is too short to judge.";
  else if (!hasMetricSignal(weakest.text)) problem = "This answer lacks measurable impact.";

  return {
    answer: weakest.text,
    problem,
    advice:
      "Retry with STAR structure: situation, task, action, result. Add one verified metric and make your personal ownership clear.",
  };
}

// Used only as a safe fallback for static helper calls where setupRef is not available.
function setupRefSafeFallback(): InterviewSetup {
  return {
    candidateName: "Candidate",
    targetRole: "Interview Role",
    recruiterId: "friendly_hr",
    recruiterName: "Sarah",
    recruiterTitle: "Friendly HR Recruiter",
    recruiterImage: "/recruiters/sarah.png",
    language: "en-US",
    cvText: "",
    jobDescription: "",
  };
}


function cleanVisibleTranscriptText(text: string) {
  return text
    .replace(/\s+/g, " ")
    .replace(/\bhigh\s+/i, "Hi ")
    .replace(/\bherathivudayakuma\b/gi, "Haritha")
    .replace(/\bharithavijayakumar\b/gi, "Haritha Vijayakumar")
    .replace(/\bHi,?\s+surrender\b/gi, "Hi there")
    .replace(/\bsurrender\b/gi, "there")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
}

function isTinyVisibleSpeechFragment(text: string) {
  const cleaned = cleanVisibleTranscriptText(text).toLowerCase();
  const words = cleaned.split(/\s+/).filter(Boolean);

  if (!cleaned) return true;
  if (words.length <= 1) return true;

  const ignored = new Set([
    "swinging",
    "hmm",
    "um",
    "uh",
    "okay",
    "ok",
    "yes",
    "yeah",
    "no",
    "right",
    "sure",
    "fine",
  ]);

  return words.length <= 2 && ignored.has(cleaned);
}

function shouldMergeVisibleTranscript(
  previous: TranscriptItem | undefined,
  next: Omit<TranscriptItem, "id" | "time">,
) {
  if (!previous) return false;
  if (previous.role !== next.role) return false;
  if (previous.speaker !== next.speaker) return false;
  if (next.role === "system") return false;
  return true;
}

function safeFirstName(name: string) {
  const cleaned = safeText(name, "Candidate").replace(/\s+/g, " ").trim();
  return cleaned.split(" ")[0] || "Candidate";
}

function safeGreetingName(name: string) {
  const firstName = safeFirstName(name);
  if (!firstName || /^(candidate|user|there|unknown|resume|cv|profile|surrender)$/i.test(firstName)) return "there";
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ' .-]{2,24}$/.test(firstName)) return "there";
  return firstName;
}

function isProgressWorthyRecruiterTurn(text: string) {
  const cleaned = cleanVisibleTranscriptText(text).toLowerCase();
  if (!cleaned) return false;

  // Do not count greetings or small-talk as interview progress.
  if (/\b(how are you|good morning|good afternoon|good evening|hello|hi[, ]|let'?s begin)\b/i.test(cleaned) && cleaned.length < 120) {
    return false;
  }

  return (
    /\?$/.test(cleaned) ||
    /\b(tell me|walk me through|give me|describe|explain|what|why|how|can you|could you|share an example|specific example|measurable impact|hardest part|improve if)\b/i.test(cleaned)
  );
}


export default function InterviewPage() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const marker = "__workzoKrispConsoleFilterInstalled";
    const scopedWindow = window as unknown as Window & { [key: string]: unknown };

    if (scopedWindow[marker]) return;
    scopedWindow[marker] = true;

    const originalError = console.error;

    console.error = (...args: unknown[]) => {
      const message = args
        .map((arg) => {
          if (arg instanceof Error) return arg.message;
          if (typeof arg === "string") return arg;
          try {
            return JSON.stringify(arg);
          } catch {
            return "";
          }
        })
        .join(" ");

      if (
        message.includes("Error unloading krisp processor") ||
        message.includes("WASM_OR_WORKER_NOT_READY")
      ) {
        return;
      }

      originalError(...args);
    };

    return () => {
      console.error = originalError;
      scopedWindow[marker] = false;
    };
  }, []);
  const [setupLoaded, setSetupLoaded] = useState(false);
  const [setup, setSetup] = useState<InterviewSetup>({
    candidateName: "Candidate",
    targetRole: "Interview Role",
    recruiterId: "friendly_hr",
    recruiterName: "Loading recruiter",
    recruiterTitle: "Preparing interview room",
    recruiterImage: "",
    language: "en-US",
    cvText: "",
    jobDescription: "",
  });
  const [status, setStatus] = useState<InterviewStatus>("idle");
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [premiumVoiceEnabled, setPremiumVoiceEnabled] = useState(true);
  const [premiumVoiceStatus, setPremiumVoiceStatus] = useState<PremiumVoiceStatus>("idle");
  const [premiumVoiceError, setPremiumVoiceError] = useState("");
  const [recruiterSignal, setRecruiterSignal] = useState<RecruiterSignalState>(defaultRecruiterSignal);
  const [recruiterMemory, setRecruiterMemory] = useState<RecruiterMemoryState>(defaultRecruiterMemory);
  const [scoreFlash, setScoreFlash] = useState<"up" | "down" | null>(null);
  const [scoreReady, setScoreReady] = useState(false);
  const scoreItems = useMemo(
    () => [
      { label: "Confidence", value: scoreReady ? `${recruiterSignal.confidence}/100` : "Pending", icon: ShieldCheck, tone: "emerald" },
      { label: "Clarity", value: scoreReady ? `${recruiterSignal.clarity}/100` : "Pending", icon: Sparkles, tone: "blue" },
      { label: "Relevance", value: scoreReady ? `${recruiterSignal.relevance}/100` : "Pending", icon: Star, tone: "violet" },
      { label: "Communication", value: scoreReady ? `${recruiterSignal.communication}/100` : "Pending", icon: User, tone: "orange" },
    ],
    [recruiterSignal, scoreReady],
  );


  const [questionIndex, setQuestionIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [interimText, setInterimText] = useState("");
  const [transcript, setTranscript] = useState<TranscriptItem[]>(initialTranscript);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showCopilot, setShowCopilot] = useState(true);
  const [autoScrollTranscript, setAutoScrollTranscript] = useState(true);
  const [interviewStyle, setInterviewStyle] = useState<"Supportive" | "Realistic" | "Challenging" | "Brutal">("Realistic");
  const [voiceSpeed, setVoiceSpeed] = useState(0.84);
  const [copilotAggressiveness, setCopilotAggressiveness] = useState<"Low" | "Medium" | "High">("Medium");
  const [recoverySnapshot, setRecoverySnapshot] = useState<WorkZoInterviewSnapshot | null>(null);
  const [recoveryNoticeDismissed, setRecoveryNoticeDismissed] = useState(false);
  const [recoveredSessionReady, setRecoveredSessionReady] = useState(false);
  const [premiumUnlocked, setPremiumUnlocked] = useState(false);

  useEffect(() => {
    setPremiumUnlocked(isWorkZoPremiumUnlocked());
  }, []);

  const handlePremiumGateClick = useCallback((feature: string) => {
    trackWorkZoInterviewEvent("premium_gate_clicked", {
      feature,
      role: setup.targetRole,
      recruiter: setup.recruiterName,
    });
  }, [setup.recruiterName, setup.targetRole]);

  const applyRecruiterFromSettings = useCallback((recruiterId: string) => {
    const profile = recruiterProfiles[recruiterId] || recruiterProfiles.friendly_hr;

    setSetup((previous) => ({
      ...previous,
      recruiterId,
      recruiterName: profile.name,
      recruiterTitle: profile.title,
      recruiterImage: profile.image,
    }));

    trackWorkZoInterviewEvent("interview_recruiter_changed", {
      recruiter: profile.name,
      role: setup.targetRole,
      premium: recruiterId === "startup_recruiter" || recruiterId === "german_corporate",
    });
  }, [setup.targetRole]);


  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const listeningRef = useRef(false);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const answerBufferRef = useRef("");
  const questionIndexRef = useRef(0);
  const stopRequestedRef = useRef(false);
  const setupRef = useRef(setup);
  const recruiterMemoryRef = useRef(defaultRecruiterMemory);
  const recruiterSignalRef = useRef(defaultRecruiterSignal);
  const scoreReadyRef = useRef(false);
  const elapsedRef = useRef(0);
  const recoverySnapshotRef = useRef<WorkZoInterviewSnapshot | null>(null);
  const recoveredSessionRef = useRef<WorkZoInterviewSnapshot | null>(null);
  const premiumVoiceEnabledRef = useRef(premiumVoiceEnabled);
  const audioEnabledRef = useRef(audioEnabled);
  const vapiClientRef = useRef<WorkZoVapiClient | null>(null);
  const vapiConnectedRef = useRef(false);
  const vapiStartingRef = useRef(false);
  const vapiFallbackStartedRef = useRef(false);
  const vapiTimeoutRef = useRef<number | null>(null);
  const vapiFinalUserTextRef = useRef("");
  const vapiQuestionSignatureRef = useRef("");
  const lastInterimTextRef = useRef("");
  const lastInterimUpdateAtRef = useRef(0);
  const lastAssistantTranscriptRef = useRef('');
  const lastUserTranscriptRef = useRef('');

  const hasStartedInterview = transcript.some((item) => item.role === "recruiter");
  const visibleTranscriptItems = getVisibleTranscriptItems(transcript).filter((item) => !(item.role === "system" && item.id === "initial-ready"));
  const transcriptMessageCount = visibleTranscriptItems.filter((item) => item.role !== "system").length + (interimText ? 1 : 0);
  const visibleQuestionNumber = hasStartedInterview ? Math.max(1, Math.min(questionIndex, 12)) : 0;
  const progress = hasStartedInterview ? Math.round((visibleQuestionNumber / 12) * 100) : 0;
  const interviewComplete: boolean =
    visibleQuestionNumber >= 12 || recruiterMemory.readyForResults;
  const headerTitle = setup.targetCompany
    ? `${setup.targetRole} – ${setup.targetCompany}`
    : setup.targetRole;
  const recruiterImagePosition = recruiterObjectPosition(setup.recruiterId, setup.recruiterName);
  const liveRecruiterThoughts = buildLiveRecruiterThoughts(recruiterSignal, recruiterMemory, scoreReady);
  const recruiterStatus = recruiterStatusLabel(recruiterSignal, scoreReady);
  const hasRecoveredSessionReady = recoveredSessionReady && transcript.some((item) => item.role === "recruiter" || item.role === "candidate");

  useEffect(() => {
    const nextSetup = buildSetupFromStorage();
    setSetup(nextSetup);
    setupRef.current = nextSetup;
    setSetupLoaded(true);

    trackWorkZoInterviewEvent("interview_room_viewed", {
      role: nextSetup.targetRole,
      recruiter: nextSetup.recruiterName,
      company: nextSetup.targetCompany || "",
    });

    const snapshot = readActiveInterviewSnapshot();
    if (snapshot) {
      setRecoverySnapshot(snapshot);
      recoverySnapshotRef.current = snapshot;
      trackWorkZoFailureEvent("state_recovery_available", {
        role: snapshot.setup.targetRole,
        recruiter: snapshot.setup.recruiterName,
        transcriptItems: snapshot.transcript.length,
        questionIndex: snapshot.questionIndex,
      }, "low");
    }

    const handleStorage = () => {
      const updated = buildSetupFromStorage();
      setSetup(updated);
      setupRef.current = updated;
      setSetupLoaded(true);
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleStorage);
    };
  }, []);

  useEffect(() => {
    setupRef.current = setup;
  }, [setup]);

  useEffect(() => {
    recruiterSignalRef.current = recruiterSignal;
  }, [recruiterSignal]);

  useEffect(() => {
    scoreReadyRef.current = scoreReady;
  }, [scoreReady]);

  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);

  useEffect(() => {
    recoverySnapshotRef.current = recoverySnapshot;
  }, [recoverySnapshot]);

  useEffect(() => {
    recruiterMemoryRef.current = recruiterMemory;
  }, [recruiterMemory]);

  useEffect(() => {
    premiumVoiceEnabledRef.current = premiumVoiceEnabled;
  }, [premiumVoiceEnabled]);

  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
  }, [audioEnabled]);

  useEffect(() => {
    questionIndexRef.current = questionIndex;
  }, [questionIndex]);

  useEffect(() => {
    const activeTranscript = transcript.filter((item) => item.role === "recruiter" || item.role === "candidate");
    const shouldPersist = status !== "idle" && status !== "ended" && activeTranscript.length > 0;

    if (!shouldPersist) return;

    writeActiveInterviewSnapshot({
      version: 1,
      id: recoverySnapshotRef.current?.id || `snapshot-${Date.now()}`,
      updatedAt: new Date().toISOString(),
      status,
      elapsed,
      questionIndex,
      scoreReady,
      setup,
      recruiterSignal,
      recruiterMemory,
      transcript,
    });
  }, [elapsed, questionIndex, recruiterMemory, recruiterSignal, scoreReady, setup, status, transcript]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      const activeTranscript = transcript.filter((item) => item.role === "recruiter" || item.role === "candidate");
      if (status === "idle" || status === "ended" || activeTranscript.length === 0) return;

      writeActiveInterviewSnapshot({
        version: 1,
        id: recoverySnapshotRef.current?.id || `snapshot-${Date.now()}`,
        updatedAt: new Date().toISOString(),
        status,
        elapsed,
        questionIndex,
        scoreReady,
        setup,
        recruiterSignal,
        recruiterMemory,
        transcript,
      });

      pushWorkZoLocalEvent(WORKZO_FAILURE_EVENTS_KEY, "page_refresh_during_interview", {
        role: setup.targetRole,
        recruiter: setup.recruiterName,
        transcriptItems: activeTranscript.length,
      }, 500);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [elapsed, questionIndex, recruiterMemory, recruiterSignal, scoreReady, setup, status, transcript]);

  useEffect(() => {
    if (status === "idle") return;

    const timer = window.setInterval(() => {
      setElapsed((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (autoScrollTranscript) transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [transcript, interimText, autoScrollTranscript]);

  const addTranscript = useCallback((item: Omit<TranscriptItem, "id" | "time">) => {
    const cleanedText = cleanVisibleTranscriptText(item.text);

    // Keep visible transcript clean. System connection messages should not appear here.
    if (item.role === "system") return;

    // Ignore short STT fragments like "Swinging" that Vapi may emit before final text.
    if (item.role === "candidate" && isTinyVisibleSpeechFragment(cleanedText)) return;

    const cleanedItem = {
      ...item,
      text: cleanedText,
    };

    setTranscript((current) => {
      const previous = current[current.length - 1];

      if (shouldMergeVisibleTranscript(previous, cleanedItem)) {
        return current.map((entry, index) =>
          index === current.length - 1
            ? {
                ...entry,
                text: cleanVisibleTranscriptText(`${entry.text} ${cleanedItem.text}`),
                time: formatTranscriptTime(new Date()),
              }
            : entry,
        );
      }

      return [
        ...current,
        {
          ...cleanedItem,
          id: createClientId(),
          time: formatTranscriptTime(new Date()),
        },
      ].slice(-80);
    });
  }, []);

  const stopListening = useCallback(() => {
    listeningRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {}
  }, []);

  const startListening = useCallback(() => {
    if (stopRequestedRef.current) return;

    const Recognition = getRecognitionConstructor();

    if (!Recognition) {
      setStatus("listening");
      addTranscript({
        role: "system",
        speaker: "System",
        text: "Speech recognition is not available in this browser. Use Chrome for live voice transcript.",
      });
      return;
    }

    try {
      recognitionRef.current?.abort?.();
    } catch {}

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = getSpeechRecognitionLang(setupRef.current);

    recognition.onstart = () => {
      listeningRef.current = true;
      setStatus("listening");
      setInterimText("");
      answerBufferRef.current = "";
    };

    recognition.onresult = (event) => {
      let finalText = "";
      let interim = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0]?.transcript || "";
        if (result.isFinal) finalText += text;
        else interim += text;
      }

      if (interim.trim()) setInterimText(interim.trim());
      if (finalText.trim()) {
        answerBufferRef.current = `${answerBufferRef.current} ${finalText}`.trim();
      }
    };

    recognition.onerror = (event) => {
      listeningRef.current = false;
      setInterimText("");
      trackWorkZoErrorEvent("speech_recognition_error", event?.error || event?.message || "Speech recognition error", {
        role: setupRef.current.targetRole,
        recruiter: setupRef.current.recruiterName,
      }, "medium");
      if (!stopRequestedRef.current) setStatus("listening");
    };

    recognition.onend = () => {
      listeningRef.current = false;
      const answer = answerBufferRef.current.trim();
      setInterimText("");

      if (!answer || stopRequestedRef.current) {
        if (!stopRequestedRef.current) {
          setStatus("listening");
          window.setTimeout(() => startListening(), 350);
        }
        return;
      }

      addTranscript({
        role: "candidate",
        speaker: "You",
        text: answer,
      });

      applyRecruiterSignalUpdate(answer);

      setStatus("thinking");

      const reply = enforceRuntimeLanguageForReply(setupRef.current, buildRecruiterReply(answer, questionIndexRef.current, setupRef.current, recruiterMemoryRef.current));

      window.setTimeout(() => {
        if (stopRequestedRef.current) return;
        setQuestionIndex((value) => Math.min(value + 1, 12));
        speakRecruiter(reply);
      }, 650);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      trackWorkZoErrorEvent("speech_recognition_start_failed", error, {
        role: setupRef.current.targetRole,
        recruiter: setupRef.current.recruiterName,
      }, "medium");
      setStatus("listening");
    }
  }, [addTranscript]);

  const speakRecruiter = useCallback(
    async (text: string) => {
      const activeSetup = setupRef.current;

      addTranscript({
        role: "recruiter",
        speaker: `${activeSetup.recruiterName} (AI Recruiter)`,
        text,
      });

      // Block browser TTS only while Vapi is actually starting/connected.
      // When status is fallback, browser TTS must be audible.
      if (
        premiumVoiceEnabledRef.current &&
        audioEnabledRef.current &&
        premiumVoiceStatus !== "fallback" &&
        (vapiStartingRef.current || vapiConnectedRef.current)
      ) {
        return;
      }

      if (!audioEnabled || typeof window === "undefined" || !window.speechSynthesis) {
        window.setTimeout(() => startListening(), 650);
        return;
      }

      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.resume();

        const voices = await getAvailableVoices();
        if (stopRequestedRef.current) return;

        const utterance = new SpeechSynthesisUtterance(text);
        const wantsMale = recruiterLooksMale(activeSetup);

        utterance.rate = wantsMale ? Math.max(0.70, voiceSpeed - 0.08) : Math.max(0.72, voiceSpeed - 0.04);
        utterance.pitch = wantsMale ? 0.86 : 1.08;
        utterance.lang = normalizeInterviewLanguage(activeSetup.language).code || "en-US";

        const preferred = preferredVoiceForRecruiter(voices, activeSetup);
        if (preferred) utterance.voice = preferred;

        setStatus("recruiter-speaking");

        let released = false;
        const releaseToListening = () => {
          if (released || stopRequestedRef.current) return;
          released = true;
          window.setTimeout(() => startListening(), 280);
        };

        utterance.onend = releaseToListening;
        utterance.onerror = releaseToListening;

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);

        window.setTimeout(releaseToListening, Math.max(3200, text.length * 76));
      } catch {
        setStatus("listening");
        startListening();
      }
    },
    [addTranscript, audioEnabled, premiumVoiceStatus, startListening, voiceSpeed],
  );


  const applyRecruiterSignalUpdate = useCallback((answer: string) => {
    setRecruiterSignal((current) => {
      const baseline = scoreReady ? current : defaultRecruiterSignal;
      const next = updateRecruiterSignalState(baseline, answer, setupRef.current);
      const direction = next.overall >= baseline.overall ? "up" : "down";

      setRecruiterMemory((memory) => {
        const updated = updateRecruiterMemoryState(memory, answer, setupRef.current, next);
        recruiterMemoryRef.current = updated;
        return updated;
      });

      setScoreReady(true);

      const answerQuality = classifyAnswerQuality(answer, setupRef.current);
      trackWorkZoFailureEvent("answer_quality_detected", {
        role: setupRef.current.targetRole,
        recruiter: setupRef.current.recruiterName,
        quality: answerQuality,
        trust: next.trust,
        interest: next.interest,
        concern: next.concern,
      }, answerQuality === "weak" ? "medium" : "low");

      setScoreFlash(direction);
      window.setTimeout(() => setScoreFlash(null), 900);

      return next;
    });
  }, [scoreReady]);

  const stopPremiumVoice = useCallback(() => {
    vapiConnectedRef.current = false;
    vapiStartingRef.current = false;

    if (vapiTimeoutRef.current) {
      window.clearTimeout(vapiTimeoutRef.current);
      vapiTimeoutRef.current = null;
    }

    try {
      vapiClientRef.current?.removeAllListeners?.();
    } catch {}

    try {
      vapiClientRef.current?.stop();
    } catch {}

    vapiClientRef.current = null;
  }, []);

  const analyzeVapiUserAnswer = useCallback((answer: string) => {
    // Transcript-only Vapi path for now.
    // Browser/local interview logic remains the scoring source, so Vapi instability cannot break scoring.
    if (!answer.trim()) return;
  }, []);

  const startBrowserFallbackInterview = useCallback(
    (activeSetup: InterviewSetup) => {
      if (vapiFallbackStartedRef.current || stopRequestedRef.current) return;

      vapiFallbackStartedRef.current = true;
      vapiStartingRef.current = false;
      vapiConnectedRef.current = false;
      setPremiumVoiceStatus("fallback");
      setPremiumVoiceError("");

      try {
        window.speechSynthesis?.cancel();
      } catch {}

      window.setTimeout(() => {
        setQuestionIndex(1);
        speakRecruiter(localizedOpeningQuestion(activeSetup));
      }, 120);
    },
    [speakRecruiter],
  );

  const startPremiumVoice = useCallback(
    async (activeSetup: InterviewSetup) => {
      if (vapiStartingRef.current || vapiConnectedRef.current) return true;

      // Reset stale client/call state first, then mark this new Vapi start attempt.
      stopPremiumVoice();
      vapiStartingRef.current = true;

      if (!premiumVoiceEnabled || !audioEnabled) {
        vapiStartingRef.current = false;
        setPremiumVoiceStatus("not_configured");
        return false;
      }

      const config = getWorkZoVapiConfig(activeSetup.recruiterId, activeSetup.recruiterName);
      console.info("WORKZO VAPI CONFIG", {
        enabled: config.enabled,
        assistantIdExists: Boolean(config.assistantId),
        publicKeyExists: Boolean(config.publicKey),
        recruiterKey: config.recruiterKey,
      });

      if (!config.enabled) {
        vapiStartingRef.current = false;
        setPremiumVoiceStatus("not_configured");
        setPremiumVoiceError("");
        return false;
      }

      setPremiumVoiceStatus("checking_microphone");
      setPremiumVoiceError("");
      try {
        window.speechSynthesis?.cancel();
      } catch {}

      try {
        await requestMicrophoneAccess();

        setPremiumVoiceStatus("connecting");

        const client = await createWorkZoVapiClient(config.publicKey);
        vapiClientRef.current = client;

        const releaseToFallback = (error: unknown) => {
          if (stopRequestedRef.current) return;
          console.error("WORKZO VAPI CONNECTION FAILED", error);
          classifyVoiceError(error);
          trackWorkZoErrorEvent("vapi_connection_failed", error, {
            role: activeSetup.targetRole,
            recruiter: activeSetup.recruiterName,
          }, "high");
          setPremiumVoiceStatus("failed");
          setPremiumVoiceError("Premium voice could not connect. You can retry voice or continue with the text interview.");
          stopPremiumVoice();
        };

        client.on?.("call-start", () => {
          vapiStartingRef.current = false;
          vapiConnectedRef.current = true;
          vapiFallbackStartedRef.current = false;
          setPremiumVoiceStatus("connected");
          setPremiumVoiceError("");
          if (vapiTimeoutRef.current) {
            window.clearTimeout(vapiTimeoutRef.current);
            vapiTimeoutRef.current = null;
          }
        });

        client.on?.("call-end", () => {
          vapiConnectedRef.current = false;
          vapiStartingRef.current = false;
          setPremiumVoiceStatus((current) => (current === "connected" ? "idle" : current));
          if (!stopRequestedRef.current) setStatus("idle");
        });

        client.on?.("error", releaseToFallback);

        client.on?.("message", (message: unknown) => {
          const transcriptMessage = normalizeVapiTranscriptMessage(message);
          if (!transcriptMessage) return;

          if (!transcriptMessage.isFinal) {
            if (transcriptMessage.role === "user") {
              const interim = cleanVisibleTranscriptText(transcriptMessage.text);
              const now = Date.now();

              if (
                interim &&
                !isTinyVisibleSpeechFragment(interim) &&
                interim !== lastInterimTextRef.current &&
                now - lastInterimUpdateAtRef.current > 320
              ) {
                lastInterimTextRef.current = interim;
                lastInterimUpdateAtRef.current = now;
                setInterimText(interim);
              }
            }
            return;
          }

          const finalText = cleanVisibleTranscriptText(transcriptMessage.text);
          lastInterimTextRef.current = "";
          lastInterimUpdateAtRef.current = 0;
          setInterimText("");

          if (transcriptMessage.role === "user") {
            if (isTinyVisibleSpeechFragment(finalText)) return;
            if (vapiFinalUserTextRef.current === finalText || lastUserTranscriptRef.current === finalText) return;
            vapiFinalUserTextRef.current = finalText;
            lastUserTranscriptRef.current = finalText;

            addTranscript({
              role: "candidate",
              speaker: "You",
              text: finalText,
            });

            const strictUnsupportedClaimHint = Boolean(
              extractUnsupportedClaimReason(finalText, setupRef.current),
            );

            if (strictUnsupportedClaimHint) {
              setRecruiterSignal((current) => ({
                ...current,
                trust: Math.max(0, current.trust - 20),
                interest: Math.max(0, current.interest - 12),
                mood: "Concerned",
                concern:
                  extractUnsupportedClaimReason(finalText, setupRef.current) ||
                  "Unsupported or inconsistent claim detected. Recruiter should ask for verified CV evidence.",
              }));
            }

            applyRecruiterSignalUpdate(finalText);
            analyzeVapiUserAnswer(finalText);
            return;
          }

          if (transcriptMessage.role === "assistant") {
            const recruiterText = cleanRecruiterFinalText(finalText, activeSetup);
            if (lastAssistantTranscriptRef.current === recruiterText) return;
            lastAssistantTranscriptRef.current = recruiterText;

            if (isProgressWorthyRecruiterTurn(recruiterText)) {
              const signature = recruiterText.toLowerCase().slice(0, 140);
              if (vapiQuestionSignatureRef.current !== signature) {
                vapiQuestionSignatureRef.current = signature;
                setQuestionIndex((value) => Math.min(value + 1, 12));
              }
            }

            addTranscript({
              role: "recruiter",
              speaker: `${activeSetup.recruiterName} (AI Recruiter)`,
              text: recruiterText,
            });
          }
        });

        const variableValues = buildWorkZoVapiVariableValues({
          workzoStrictGrounding: `${buildLanguageInstruction(activeSetup)} ${buildContextQualityNotice(activeSetup)} Use the factual memory brief to ask CV/JD-specific follow-ups. You are WorkZo AI's realistic recruiter. Treat the CV/resume and job description as the only verified facts. Never accept unsupported claims as true. Before any positive follow-up, check whether the candidate's claim is supported by the CV/JD. If the candidate claims a company, role, title, years of experience, certification, degree, achievement, or metric that is not visible in the CV/JD, challenge it immediately and politely. Use this exact style: 'I need to pause there. I cannot verify that from your CV. Can you clarify whether this was official employment, freelance work, volunteer experience, transferable experience, or just an example scenario?' Example: if CV does not mention Tesla or 15 years and candidate says 'I have fifteen years of experience at Tesla', do not say thanks or ask achievements. Challenge the mismatch first. Do not validate fake or exaggerated inputs. Ask one concise follow-up at a time. Prioritize evidence, ownership, STAR structure, metrics, and role relevance. Before ending, ask one final closing challenge: why should we choose you over another candidate using one verified result. Do not end abruptly. Do not invent farewell names or phrases. End only with: 'Thank you for your time, {candidateName}. We will be in touch soon. Have a great day.'`,
          strictGroundingRules: "You are WorkZo AI's realistic recruiter. Treat the CV/resume and job description as the only verified facts. Never accept unsupported claims as true. Before any positive follow-up, check whether the candidate's claim is supported by the CV/JD. If the candidate claims a company, role, title, years of experience, certification, degree, achievement, or metric that is not visible in the CV/JD, challenge it immediately and politely. Use this exact style: 'I need to pause there. I cannot verify that from your CV. Can you clarify whether this was official employment, freelance work, volunteer experience, transferable experience, or just an example scenario?' Example: if CV does not mention Tesla or 15 years and candidate says 'I have fifteen years of experience at Tesla', do not say thanks or ask achievements. Challenge the mismatch first. Do not validate fake or exaggerated inputs. Ask one concise follow-up at a time. Prioritize evidence, ownership, STAR structure, metrics, and role relevance.",
          recruiterMustChallengeUnsupportedClaims: "true",
          antiHallucinationMode: "strict",
          candidateName: safeGreetingName(activeSetup.candidateName),
          recruiterName: activeSetup.recruiterName,
          recruiterRole: activeSetup.recruiterTitle,
          targetRole: activeSetup.targetRole,
          targetMarket: "Global",
          companyStyle: detectCompanyInterviewStyle(activeSetup),
          companyName: activeSetup.targetCompany || "the company",
          recruiterPersonality: recruiterPersonalityInstructions(activeSetup),
          companyStyleInstructions: companyStyleInstructions(detectCompanyInterviewStyle(activeSetup)),
          cvText: [
            enforceSelectedLanguagePrefix(activeSetup),
            buildFactualMemoryBrief(activeSetup),
            "CV fact memory:",
            JSON.stringify(extractCvFactMemory(activeSetup)),
            "",
            "Raw CV/resume context:",
            activeSetup.cvText || "",
          ].join("\n"),
          jobDescription: [
            enforceSelectedLanguagePrefix(activeSetup),
            buildContextQualityNotice(activeSetup),
            buildLanguageInstruction(activeSetup),
            "JD fact memory:",
            JSON.stringify(extractJdFactMemory(activeSetup)),
            "",
            "Raw job description context:",
            activeSetup.jobDescription || "",
          ].join("\n"),
        });

        vapiTimeoutRef.current = window.setTimeout(() => {
          if (!vapiConnectedRef.current && !stopRequestedRef.current) {
            console.warn("WORKZO VAPI STILL CONNECTING", {
              role: activeSetup.targetRole,
              recruiter: activeSetup.recruiterName,
            });
            trackWorkZoFailureEvent("vapi_connection_slow", {
              role: activeSetup.targetRole,
              recruiter: activeSetup.recruiterName,
            }, "medium");
            setPremiumVoiceStatus("connecting");
            setPremiumVoiceError("Voice is still connecting. You can wait, retry voice, or continue without voice.");

            window.setTimeout(() => {
              if (!vapiConnectedRef.current && !stopRequestedRef.current) {
                console.warn("WORKZO VAPI CONNECTION TIMEOUT", {
                  role: activeSetup.targetRole,
                  recruiter: activeSetup.recruiterName,
                });
                trackWorkZoFailureEvent("vapi_connection_timeout", {
                  role: activeSetup.targetRole,
                  recruiter: activeSetup.recruiterName,
                }, "high");
                setPremiumVoiceStatus("failed");
                setPremiumVoiceError("Voice connection is taking too long. Retry voice or continue with the text interview.");
                stopPremiumVoice();
              }
            }, 18000);
          }
        }, 12000);

        await client.start(config.assistantId, {
          variableValues,
          metadata: {
            product: "WorkZo AI",
            page: "interview-room",
            recruiter: config.recruiterKey,
            voiceMode: "lazy-vapi",
          },
        });

        return true;
      } catch (error) {
        console.error("WORKZO VAPI START FAILED", error);
        classifyVoiceError(error);
        trackWorkZoErrorEvent("voice_connect_failed", error, {
          role: activeSetup.targetRole,
          recruiter: activeSetup.recruiterName,
        }, "high");
        vapiStartingRef.current = false;
        setPremiumVoiceStatus("failed");
        setPremiumVoiceError("Premium voice could not start. Check the console for WORKZO VAPI START FAILED.");
        stopPremiumVoice();
        return false;
      }
    },
    [addTranscript, analyzeVapiUserAnswer, applyRecruiterSignalUpdate, audioEnabled, premiumVoiceEnabled, startBrowserFallbackInterview, stopPremiumVoice],
  );

  useEffect(() => {
    return () => {
      stopPremiumVoice();
    };
  }, [stopPremiumVoice]);


  const startInterview = useCallback(async () => {
    stopRequestedRef.current = false;

    const restoredSnapshot = recoveredSessionRef.current;

    if (restoredSnapshot) {
      const restoredSetup = restoredSnapshot.setup;
      setSetup(restoredSetup);
      setupRef.current = restoredSetup;
      recruiterMemoryRef.current = restoredSnapshot.recruiterMemory;
      recruiterSignalRef.current = restoredSnapshot.recruiterSignal;
      scoreReadyRef.current = restoredSnapshot.scoreReady;
      elapsedRef.current = restoredSnapshot.elapsed;
      questionIndexRef.current = restoredSnapshot.questionIndex;

      setTranscript(restoredSnapshot.transcript);
      setRecruiterMemory(restoredSnapshot.recruiterMemory);
      setRecruiterSignal(restoredSnapshot.recruiterSignal);
      setScoreReady(restoredSnapshot.scoreReady);
      setElapsed(restoredSnapshot.elapsed);
      setQuestionIndex(restoredSnapshot.questionIndex);
      setInterimText("");
      const candidateAnswers = countCandidateAnswers(restoredSnapshot.transcript);

      trackWorkZoFailureEvent("interview_recovered_and_resumed", {
        role: restoredSnapshot.setup.targetRole,
        recruiter: restoredSnapshot.setup.recruiterName,
        transcriptItems: restoredSnapshot.transcript.length,
        questionIndex: restoredSnapshot.questionIndex,
      }, "low");

      setRecoveredSessionReady(false);
      recoveredSessionRef.current = null;
      recoverySnapshotRef.current = null;
      setRecoverySnapshot(null);
      setRecoveryNoticeDismissed(false);
      setPremiumVoiceError("");

      // Important: restored interviews must not auto-drop into browser TTS fallback.
      // Recovery restores state first; Vapi should reconnect only through the normal
      // premium voice path, and if it cannot reconnect we keep the interview idle.
      vapiFallbackStartedRef.current = false;
      vapiStartingRef.current = false;
      vapiConnectedRef.current = false;
      setPremiumVoiceStatus("idle");

      const nextQuestionIndex = Math.max(
        restoredSnapshot.questionIndex,
        Math.min(12, candidateAnswers + 1),
      );

      questionIndexRef.current = nextQuestionIndex;
      setQuestionIndex(nextQuestionIndex);

      if (premiumVoiceEnabledRef.current && audioEnabledRef.current) {
        const reconnectedPremiumVoice = await startPremiumVoice(restoredSetup);

        if (reconnectedPremiumVoice) {
          addTranscript({
            role: "system",
            speaker: "System",
            text: "Interview restored. Premium voice reconnected.",
          });
          setStatus("listening");
          return;
        }

        addTranscript({
          role: "system",
          speaker: "System",
          text: "Interview restored. Premium voice is not connected yet. Tap Start again when you are ready to reconnect voice.",
        });
        setStatus("idle");
        return;
      }

      addTranscript({
        role: "system",
        speaker: "System",
        text: "Interview restored. Voice is idle. Tap Start when you are ready to continue.",
      });
      setStatus("idle");
      return;
    }

    const freshSetup = buildSetupFromStorage();
    setSetup(freshSetup);
    setupRef.current = freshSetup;

    if (recoverySnapshotRef.current) {
      trackWorkZoFailureEvent("active_interview_replaced", {
        previousRole: recoverySnapshotRef.current.setup.targetRole,
        previousTranscriptItems: recoverySnapshotRef.current.transcript.length,
      }, "low");
    }

    clearActiveInterviewSnapshot();
    recoveredSessionRef.current = null;
    setRecoveredSessionReady(false);
    setRecoverySnapshot(null);
    setRecoveryNoticeDismissed(false);

    trackWorkZoInterviewEvent("interview_started", {
      role: freshSetup.targetRole,
      recruiter: freshSetup.recruiterName,
      company: freshSetup.targetCompany || "",
      premiumVoiceEnabled: premiumVoiceEnabledRef.current,
      hasCvContext: Boolean(freshSetup.cvText),
      hasJobDescription: Boolean(freshSetup.jobDescription),
    });

    setElapsed(0);
    setQuestionIndex(0);
    setInterimText("");
    setTranscript([]);
    vapiFallbackStartedRef.current = false;
    vapiStartingRef.current = false;
    vapiConnectedRef.current = false;
    vapiQuestionSignatureRef.current = "";
    lastInterimTextRef.current = "";
    lastInterimUpdateAtRef.current = 0;
    setPremiumVoiceError("");
    setScoreReady(false);
    setRecruiterSignal(defaultRecruiterSignal);
    setRecruiterMemory(defaultRecruiterMemory);
    recruiterMemoryRef.current = defaultRecruiterMemory;

    if (premiumVoiceEnabledRef.current && audioEnabledRef.current) {
      const startedPremiumVoice = await startPremiumVoice(freshSetup);

      if (startedPremiumVoice) {
        addTranscript({
          role: "system",
          speaker: "System",
          text: "Premium voice connected.",
        });
        setStatus("listening");
        return;
      }

      setStatus("idle");
      return;
    }

    startBrowserFallbackInterview(freshSetup);
  }, [addTranscript, speakRecruiter, startBrowserFallbackInterview, startPremiumVoice]);

  const saveInterviewResult = useCallback(
    (reason: "ended" | "paused" = "ended") => {
      if (typeof window === "undefined") return;
      const finalTranscript = transcript;

      const finalScore = scoreReady ? recruiterSignal : null;
      const verdict = buildInterviewVerdict(finalScore, recruiterMemoryRef.current);
      const weakestMoment = findWeakestInterviewMoment(finalTranscript, recruiterMemoryRef.current);
      const answerQuality = summarizeAnswerQuality(finalTranscript, setupRef.current);

      persistCandidatePatterns(recruiterMemoryRef.current, setupRef.current);

      const session = {
        id: `workzo-${Date.now()}`,
        savedAt: new Date().toISOString(),
        reason,
        candidateName: setupRef.current.candidateName,
        targetRole: setupRef.current.targetRole,
        targetCompany: setupRef.current.targetCompany || "",
        recruiterName: setupRef.current.recruiterName,
        recruiterTitle: setupRef.current.recruiterTitle,
        companyStyle: detectCompanyInterviewStyle(setupRef.current),
        durationSeconds: elapsed,
        score: finalScore,
        transcript: finalTranscript,
        memory: recruiterMemoryRef.current,
        trustTimeline: recruiterMemoryRef.current.trustTimeline,
        weakestMoment,
        verdict,
        answerQuality,
        summary: {
          mood: scoreReady ? recruiterSignal.mood : "Waiting",
          trust: scoreReady ? recruiterSignal.trust : null,
          interest: scoreReady ? recruiterSignal.interest : null,
          concern: recruiterSignal.concern,
          liveNote: recruiterMemoryRef.current.liveNote,
          patterns: recruiterMemoryRef.current.patterns,
          answerQuality: answerQuality.summary,
          verdict: verdict.decision,
        },
      };

      try {
        const existingRaw = window.localStorage.getItem("workzo_interview_results");
        const existing = existingRaw ? JSON.parse(existingRaw) : [];
        const list = Array.isArray(existing) ? existing : [];

        window.localStorage.setItem(
          "workzo_interview_results",
          JSON.stringify([session, ...list].slice(0, 20)),
        );
        window.localStorage.setItem("workzo_latest_interview_result", JSON.stringify(session));
        clearActiveInterviewSnapshot();

        trackWorkZoInterviewEvent("interview_completed", {
          reason,
          role: session.targetRole,
          recruiter: session.recruiterName,
          durationSeconds: session.durationSeconds,
          score: session.score?.overall ?? null,
          trust: session.score?.trust ?? null,
          verdict: session.verdict?.decision ?? "",
          answers: session.transcript.filter((item) => item.role === "candidate").length,
        });

        trackWorkZoInterviewEvent("interview_saved", {
          reason,
          role: session.targetRole,
          recruiter: session.recruiterName,
          durationSeconds: session.durationSeconds,
          score: session.score?.overall ?? null,
          trust: session.score?.trust ?? null,
          verdict: session.verdict?.decision ?? "",
          answers: session.transcript.filter((item) => item.role === "candidate").length,
        });
      } catch (error) {
        trackWorkZoErrorEvent("interview_save_failed", error, {
          role: setupRef.current.targetRole,
          recruiter: setupRef.current.recruiterName,
        }, "high");
      }
    },
    [elapsed, recruiterSignal, recruiterMemory, scoreReady, transcript],
  );

  const endInterview = useCallback(() => {
    stopRequestedRef.current = true;
    stopListening();
    stopPremiumVoice();
    vapiFallbackStartedRef.current = false;

    try {
      window.speechSynthesis?.cancel();
    } catch {}

    saveInterviewResult("ended");
    setStatus("ended");
    setInterimText("");
    addTranscript({
      role: "system",
      speaker: "System",
      text: "Interview ended. You can review the transcript or start again.",
    });
  }, [addTranscript, saveInterviewResult, stopListening, stopPremiumVoice]);

  const toggleMic = useCallback(() => {
    if (status === "listening" && listeningRef.current) {
      stopListening();
      return;
    }

    if (status === "idle") {
      startInterview();
      return;
    }

    if (status !== "recruiter-speaking") startListening();
  }, [startInterview, startListening, status, stopListening]);

  const restoreInterviewSnapshot = useCallback(() => {
    const snapshot = recoverySnapshotRef.current || recoverySnapshot;
    if (!snapshot) return;

    stopRequestedRef.current = true;
    stopListening();
    stopPremiumVoice();

    try {
      window.speechSynthesis?.cancel();
    } catch {}

    setupRef.current = snapshot.setup;
    recruiterMemoryRef.current = snapshot.recruiterMemory;
    recruiterSignalRef.current = snapshot.recruiterSignal;
    scoreReadyRef.current = snapshot.scoreReady;
    elapsedRef.current = snapshot.elapsed;
    questionIndexRef.current = snapshot.questionIndex;
    recoveredSessionRef.current = snapshot;
    stopRequestedRef.current = false;

    setSetup(snapshot.setup);
    setTranscript(snapshot.transcript);
    setRecruiterMemory(snapshot.recruiterMemory);
    setRecruiterSignal(snapshot.recruiterSignal);
    setScoreReady(snapshot.scoreReady);
    setElapsed(snapshot.elapsed);
    setQuestionIndex(snapshot.questionIndex);
    setInterimText("");
    setStatus("idle");
    setRecoveredSessionReady(true);
    setRecoverySnapshot(null);
    setRecoveryNoticeDismissed(false);

    trackWorkZoFailureEvent("state_recovery_used", {
      role: snapshot.setup.targetRole,
      recruiter: snapshot.setup.recruiterName,
      transcriptItems: snapshot.transcript.length,
      questionIndex: snapshot.questionIndex,
    }, "low");

    // Do not auto-start after restore. Auto-start was forcing the restored session
    // into browser TTS fallback on some devices. The user can tap Start to reconnect
    // Vapi through the normal voice path.
    vapiFallbackStartedRef.current = false;
    vapiStartingRef.current = false;
    vapiConnectedRef.current = false;
    setPremiumVoiceStatus("idle");
    setPremiumVoiceError("");
  }, [recoverySnapshot, stopListening, stopPremiumVoice]);

  const discardInterviewSnapshot = useCallback(() => {
    const snapshot = recoverySnapshotRef.current || recoverySnapshot;
    clearActiveInterviewSnapshot();
    recoveredSessionRef.current = null;
    setRecoveredSessionReady(false);
    setRecoverySnapshot(null);
    setRecoveryNoticeDismissed(true);

    trackWorkZoFailureEvent("state_recovery_discarded", {
      role: snapshot?.setup.targetRole || setupRef.current.targetRole,
      transcriptItems: snapshot?.transcript.length || 0,
    }, "low");
  }, [recoverySnapshot]);

  const formattedElapsed = useMemo(() => {
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }, [elapsed]);

  if (!setupLoaded) {
    return (
      <main className="min-h-screen overflow-x-hidden bg-[#050b14] text-white">
        <div className="grid min-h-screen place-items-center px-5">
          <section className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-2xl border border-blue-300/20 bg-blue-400/10">
                <Mic className="h-7 w-7 text-blue-200" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">Preparing interview room</p>
                <h1 className="mt-1 text-2xl font-black">Loading your recruiter…</h1>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="h-3 w-3/4 animate-pulse rounded-full bg-white/10" />
              <div className="h-3 w-1/2 animate-pulse rounded-full bg-white/10" />
              <div className="h-24 animate-pulse rounded-2xl border border-white/10 bg-black/20" />
            </div>

            <p className="mt-5 text-sm leading-6 text-slate-400">
              WorkZo is loading your selected recruiter and interview setup before showing the room.
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#050b14] text-white lg:h-screen lg:overflow-hidden">
      <style jsx global>{`

        .workzo-hide-scrollbar {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .workzo-hide-scrollbar::-webkit-scrollbar {
          display: none;
        }

        @media (max-width: 1023px) {
          html,
          body {
            overflow-x: hidden;
          }

          main {
            min-height: 100dvh;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .,
          .,
          .workzo-status-pulse {
            animation: none !important;
          }
        }
      `}</style>

      <section className="grid min-h-screen grid-rows-[64px_1fr] lg:h-full lg:min-h-0 lg:grid-rows-[70px_1fr]">
        <header className="flex items-center justify-between gap-2 border-b border-white/10 px-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2 sm:gap-5">
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => window.history.back()}
                className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-200 transition hover:bg-white/[0.08] hover:text-white"
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              <Link href="/" className="flex items-center gap-3">
                <Image
                  src="/workzo_icon.png"
                  alt="WorkZo AI"
                  width={42}
                  height={42}
                  priority
                  className="rounded-xl"
                />
                <span className="hidden text-2xl font-black tracking-tight sm:inline">
                  WorkZo <span className="text-blue-400">AI</span>
                </span>
              </Link>
            </div>

            <div className="hidden h-9 w-px bg-white/10 sm:block" />

            <div className="flex min-w-0 items-center gap-3">
              <div className="min-w-0">
                <h1 className="line-clamp-2 max-w-[190px] text-sm font-black leading-tight sm:max-w-[520px] sm:truncate sm:text-lg sm:leading-normal lg:max-w-[680px] lg:text-xl">
                  {headerTitle}
                </h1>
                <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300 sm:hidden">
                  {recruiterStatus}
                </p>
              </div>
              <span className="hidden h-2.5 w-2.5 rounded-full bg-emerald-400 sm:block" />
              <span className={`hidden rounded-full border px-2.5 py-1 text-xs font-black uppercase sm:block ${recruiterStatusTone(recruiterSignal, scoreReady)}`}>
                {recruiterStatus}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 lg:gap-4">
            <div className="hidden items-center gap-2 text-sm text-slate-200 md:flex">
              <Clock3 className="h-4 w-4" />
              {formattedElapsed}
            </div>

            {interviewComplete ? (
              <Link
                href="/results"
                onClick={() => saveInterviewResult("paused")}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-blue-500 px-3 text-sm font-black sm:h-10 sm:gap-2 sm:px-4"
              >
                Results
              </Link>
            ) : status === "idle" ? (
              <button
                onClick={startInterview}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 px-3 text-sm font-black sm:h-10 sm:gap-2 sm:px-4"
              >
                <Play className="h-4 w-4" />
                {hasRecoveredSessionReady ? "Resume" : "Start"}
              </button>
            ) : (
              <button
                onClick={endInterview}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-red-500/40 px-3 text-sm font-black text-red-300 sm:h-10 sm:gap-2 sm:px-4 lg:px-5"
              >
                <PhoneOff className="h-4 w-4" />
                End Interview
              </button>
            )}

            <button
              onClick={() => setAudioEnabled((value) => !value)}
              className="hidden h-10 w-12 place-items-center rounded-xl border border-white/10 bg-white/[0.03] sm:grid"
            >
              <Volume2 className={`h-5 w-5 ${audioEnabled ? "" : "text-slate-500"}`} />
            </button>
            <div className="relative hidden sm:block">
                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen((value) => !value);
                    setMoreOpen(false);
                  }}
                  className="grid h-10 w-12 place-items-center rounded-xl border border-white/10 bg-white/[0.03] transition hover:bg-white/[0.08]"
                  aria-label="Interview settings"
                >
                  <Settings className="h-5 w-5" />
                </button>

                {settingsOpen ? (
                  <div className="absolute right-0 top-12 z-50 max-h-[min(620px,calc(100vh-108px))] w-[320px] overflow-y-auto rounded-2xl workzo-hide-scrollbar border border-white/10 bg-[#091323]/95 p-4 shadow-2xl backdrop-blur-xl">
                    <div className="mb-3">
                      <p className="text-sm font-black text-white">Interview Settings</p>
                      <p className="mt-1 text-xs text-slate-400">Adjust only this interview room.</p>
                    </div>

                    <div className="space-y-3">
                      <section>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-200">Recruiter</p>
                          {!premiumUnlocked ? (
                            <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-0.5 text-[10px] font-black text-amber-200">Premium available</span>
                          ) : null}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            { id: "friendly_hr", name: "Sarah", label: "Friendly HR", premium: false },
                            { id: "analytical_hiring_manager", name: "Daniel", label: "Analytical", premium: false },
                            { id: "startup_recruiter", name: "Priya", label: "Startup", premium: true },
                            { id: "german_corporate", name: "Markus", label: "Corporate", premium: true },
                          ] as const).map((recruiter) => {
                            const locked = recruiter.premium && !premiumUnlocked;
                            const selected = setup.recruiterName === recruiter.name || setup.recruiterId === recruiter.id;

                            return (
                              <button
                                key={recruiter.id}
                                type="button"
                                onClick={() => {
                                  if (locked) {
                                    handlePremiumGateClick(`recruiter_${recruiter.name.toLowerCase()}`);
                                    return;
                                  }

                                  applyRecruiterFromSettings(recruiter.id);
                                }}
                                className={`rounded-xl border px-3 py-2 text-left text-sm font-bold ${
                                  selected
                                    ? "border-blue-400/60 bg-blue-500/15 text-white"
                                    : locked
                                      ? "border-amber-300/20 bg-amber-400/[0.06] text-amber-100/80"
                                      : "border-white/10 bg-white/[0.03] text-slate-300"
                                }`}
                              >
                                <span className="flex items-center justify-between gap-2">
                                  <span>{recruiter.name}</span>
                                  {locked ? <span className="text-[10px] text-amber-200">PRO</span> : null}
                                </span>
                                <span className="mt-0.5 block text-[11px] font-semibold text-slate-500">{recruiter.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </section>

                      <section>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-200">Interview Atmosphere</p>
                          {!premiumUnlocked ? (
                            <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-0.5 text-[10px] font-black text-amber-200">Premium pressure</span>
                          ) : null}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {(["Supportive", "Realistic", "Challenging", "Brutal"] as const).map((style) => {
                            const locked = (style === "Challenging" || style === "Brutal") && !premiumUnlocked;

                            return (
                              <button
                                key={style}
                                type="button"
                                onClick={() => {
                                  if (locked) {
                                    handlePremiumGateClick(`atmosphere_${style.toLowerCase()}`);
                                    return;
                                  }

                                  setInterviewStyle(style);
                                }}
                                className={`rounded-xl border px-3 py-2 text-left text-sm font-bold ${
                                  interviewStyle === style
                                    ? "border-violet-400/60 bg-violet-500/15 text-white"
                                    : locked
                                      ? "border-amber-300/20 bg-amber-400/[0.06] text-amber-100/80"
                                      : "border-white/10 bg-white/[0.03] text-slate-300"
                                }`}
                              >
                                <span className="flex items-center justify-between gap-2">
                                  <span>{style}</span>
                                  {locked ? <span className="text-[10px] text-amber-200">PRO</span> : null}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        {!premiumUnlocked ? (
                          <p className="mt-2 rounded-xl border border-amber-300/15 bg-amber-400/[0.06] p-2 text-xs leading-5 text-amber-100/80">
                            Free interviews include Sarah, Daniel, Supportive, and Realistic. Premium unlocks Priya, Markus, Challenging, and Brutal interview pressure.
                          </p>
                        ) : null}
                      </section>

                      <section className="space-y-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-200">Voice Settings</p>
                        <button
                          type="button"
                          onClick={() => setAudioEnabled((value) => !value)}
                          className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm"
                        >
                          <span>Voice On/Off</span>
                          <span className="text-slate-400">{audioEnabled ? "On" : "Off"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPremiumVoiceEnabled((value) => !value)}
                          className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm"
                        >
                          <span>Premium Voice (Vapi)</span>
                          <span className="text-slate-400">{premiumVoiceEnabled ? "On" : "Off"}</span>
                        </button>
                        <label className="block rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm">
                          <div className="mb-2 flex items-center justify-between">
                            <span>Voice Speed</span>
                            <span className="text-slate-400">{voiceSpeed.toFixed(2)}x</span>
                          </div>
                          <input
                            type="range"
                            min="0.70"
                            max="1.00"
                            step="0.03"
                            value={voiceSpeed}
                            onChange={(event) => setVoiceSpeed(Number(event.target.value))}
                            className="w-full"
                          />
                        </label>
                      </section>

                      <section className="space-y-2">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-200">Transcript</p>
                        <button type="button" onClick={() => setShowTranscript((value) => !value)} className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm">
                          <span>{showTranscript ? "Hide Transcript" : "Show Live Transcript"}</span>
                          <span className="text-slate-400">{showTranscript ? "On" : "Off"}</span>
                        </button>
                        <button type="button" onClick={() => setAutoScrollTranscript((value) => !value)} className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm">
                          <span>Auto-scroll Transcript</span>
                          <span className="text-slate-400">{autoScrollTranscript ? "On" : "Off"}</span>
                        </button>
                      </section>

                      <section
              style={{ display: showCopilot ? undefined : "none" }}
              className="rounded-2xl border border-white/10 bg-[#0b1527] p-3.5 overflow-visible"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-black text-blue-300">
                  Live Copilot{" "}
                  <span className="ml-2 rounded-full bg-violet-400/15 px-2 py-1 text-[10px] text-violet-200">
                    Beta
                  </span>
                </h2>
                <button
                  type="button"
                  onClick={() => setShowCopilot((value) => !value)}
                  className="relative h-6 w-11 rounded-full bg-blue-500"
                  aria-label="Toggle Live Copilot"
                >
                  <span className="absolute right-1 top-1 h-4 w-4 rounded-full bg-white" />
                </button>
              </div>

              <div className="mt-2 grid grid-cols-[1fr_auto] gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                    Recruiter mood
                  </p>
                  <p className={`mt-0.5 text-base font-black ${recruiterMoodColor(recruiterSignal.mood)}`}>
                    {scoreReady ? recruiterSignal.mood : "Waiting"}
                  </p>
                </div>
                <div className="text-right text-[11px] text-slate-300">
                  <p>Trust <span className="font-bold text-white">{scoreReady ? recruiterSignal.trust : "—"}</span></p>
                  <p>Interest <span className="font-bold text-white">{scoreReady ? recruiterSignal.interest : "—"}</span></p>
                </div>
              </div>

              <div className="mt-2 rounded-xl border border-emerald-300/15 bg-emerald-400/[0.07] px-3 py-2">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">Say next</p>
                <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-slate-100">
                  {scoreReady
                    ? recruiterSignal.trust < 60
                      ? "Clarify the claim, then give one verified example."
                      : "Give one specific example with a clear result."
                    : "Answer with one clear, role-relevant example."}
                </p>
              </div>

              <div className="mt-2 rounded-xl border border-amber-300/15 bg-amber-400/[0.07] px-3 py-2">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-200">Recruiter concern</p>
                <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-slate-100">
                  {scoreReady ? recruiterMemory.liveNote || recruiterSignal.concern : "Waiting for evidence, ownership, and measurable impact."}
                </p>
                {recruiterMemory.patterns.length ? (
                  <p className="mt-1 line-clamp-1 text-[11px] text-amber-100/80">
                    Patterns detected: {recruiterMemory.patterns[recruiterMemory.patterns.length - 1]}
                  </p>
                ) : null}
              </div>

              <div className="mt-2 rounded-xl border border-blue-300/15 bg-blue-400/[0.07] px-3 py-2">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-200">Live recruiter thoughts</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {liveRecruiterThoughts.map((thought) => (
                    <span key={thought} className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-slate-200">
                      {thought}
                    </span>
                  ))}
                </div>
              </div>
            </section>

                      <section className="space-y-2">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-200">Interview Controls</p>
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" onClick={stopListening} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm font-bold text-slate-200">Pause</button>
                          <button type="button" onClick={() => speakRecruiter(recruiterQuestions[Math.max(0, questionIndex)])} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm font-bold text-slate-200">Restart question</button>
                        </div>
                      </section>

                      <section>
                        <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-200">Accessibility</p>
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm font-bold text-slate-200">Larger text</button>
                          <button type="button" className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm font-bold text-slate-200">High contrast</button>
                        </div>
                      </section>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="relative hidden md:block">
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen((value) => !value);
                    setSettingsOpen(false);
                  }}
                  className="grid h-10 w-12 place-items-center rounded-xl border border-white/10 bg-white/[0.03] transition hover:bg-white/[0.08]"
                  aria-label="More interview actions"
                >
                  <MoreVertical className="h-5 w-5" />
                </button>

                {moreOpen ? (
                  <div className="absolute right-0 top-12 z-50 w-52 rounded-2xl border border-white/10 bg-[#091323]/95 p-2 shadow-2xl backdrop-blur-xl">
                    {["Take Notes", "Report Issue", "Help Center", "Exit Interview"].map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={item === "Exit Interview" ? endInterview : undefined}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-200 hover:bg-white/[0.06]"
                      >
                        {item}
                        <ChevronRight className="h-4 w-4 text-slate-500" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            {premiumVoiceStatus !== "not_configured" && premiumVoiceStatus !== "idle" ? (
              <div className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300 lg:flex">
                <span className="text-slate-500">Voice:</span>
                <span
                  className={
                    premiumVoiceStatus === "connected"
                      ? "text-emerald-300"
                      : premiumVoiceStatus === "fallback" || premiumVoiceStatus === "failed"
                        ? "text-amber-300"
                        : "text-slate-300"
                  }
                >
                  {premiumVoiceStatus === "connected" ? "connected" : premiumVoiceStatus.replaceAll("_", " ")}
                </span>
              </div>
            ) : null}
          </div>
        </header>

        {recoverySnapshot && !recoveryNoticeDismissed && status === "idle" ? (
          <section className="mx-3 mt-3 rounded-2xl border border-amber-300/25 bg-amber-400/10 p-4 text-amber-50 lg:mx-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black">Resume previous interview?</p>
                <p className="mt-1 text-xs leading-5 text-amber-100/80">
                  Role: {recoverySnapshot.setup.targetRole || "Interview Role"} · Recruiter: {recoverySnapshot.setup.recruiterName || "AI Recruiter"} · {getRecoveryProgressLabel(recoverySnapshot)} · {getRecoverySavedLabel(recoverySnapshot)}
                </p>
                <p className="mt-1 text-xs leading-5 text-amber-100/70">
                  Click Resume Interview to restore the transcript, trust score, recruiter memory, and continue from the last saved question.
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={restoreInterviewSnapshot}
                  className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-black text-slate-950"
                >
                  Resume Interview
                </button>
                <button
                  type="button"
                  onClick={discardInterviewSnapshot}
                  className="rounded-xl border border-amber-200/25 px-4 py-2 text-sm font-black text-amber-50"
                >
                  Start Fresh
                </button>
              </div>
            </div>
          </section>
        ) : null}

        <div className="grid grid-cols-1 gap-3 overflow-x-hidden p-3 pb-24 lg:min-h-0 lg:grid-cols-[1fr_368px] lg:overflow-hidden lg:p-4">
          <div className="grid gap-3 lg:min-h-0 lg:grid-rows-[69vh_18vh]">
            <section className="relative h-[260px] overflow-hidden rounded-2xl border border-white/10 bg-[#0b1527] sm:h-[390px] lg:h-auto">
              <div className="absolute inset-x-[18%] bottom-8 top-6 rounded-full bg-blue-500/20 blur-3xl" />
              <div className="absolute inset-0">
                <Image
                  src={setup.recruiterImage}
                  alt={`${setup.recruiterName}, AI recruiter`}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 850px"
                  className="object-cover"
                  style={{ objectPosition: recruiterImagePosition }}
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/86 via-black/10 to-black/0" />

              <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-lg border border-emerald-400/50 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-300">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(52,211,153,0.9)]" /> {status === "recruiter-speaking" ? "SPEAKING" : status === "listening" ? "LISTENING" : status === "thinking" ? "THINKING" : "LIVE"}
              </div>

              {premiumVoiceError ? (
                <div className="absolute right-4 top-5 hidden max-w-[320px] rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100 lg:block">
                  {premiumVoiceError}
                </div>
              ) : null}

              <div className="absolute bottom-4 left-3 max-w-[145px] sm:bottom-5 sm:left-5 sm:max-w-none">
                <div className="flex items-center gap-2 text-lg font-black">
                  {setup.recruiterName}
                  <CheckCircle2 className="h-5 w-5 fill-blue-500 text-blue-500" />
                </div>
                <p className="mt-1 truncate text-xs text-white/80 sm:text-sm">{setup.recruiterTitle}</p>
                <p className="mt-2 text-xs font-bold text-emerald-200">
                  {scoreReady ? recruiterStatus : "Ready for first answer"}
                </p>
              </div>

              <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2 sm:bottom-5 sm:gap-4">
                <button
                  onClick={toggleMic}
                  className={`grid h-10 w-10 place-items-center rounded-full sm:h-14 sm:w-14 shadow-2xl ${
                    status === "listening" ? "bg-blue-500 text-white" : "bg-white text-slate-950"
                  }`}
                >
                  {status === "listening" ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="grid h-10 w-10 place-items-center rounded-full sm:h-14 sm:w-14 bg-white text-slate-950 shadow-2xl sm:h-14 sm:w-14"
                  aria-label="Interview settings"
                >
                  <Settings className="h-6 w-6" />
                </button>
                <button
                  onClick={endInterview}
                  className="grid h-10 w-10 place-items-center rounded-full sm:h-14 sm:w-14 bg-red-500 text-white shadow-2xl sm:h-14 sm:w-14"
                >
                  <PhoneOff className="h-6 w-6" />
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#0b1527]/95 lg:min-h-0">
              <button
                type="button"
                onClick={() => setShowTranscript((value) => !value)}
                className="flex h-12 w-full items-center justify-between border-b border-white/10 px-5 text-left"
                aria-expanded={showTranscript}
              >
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-black">Live Transcript</h2>
                  <span className="h-2 w-2 rounded-full bg-red-400" />
                  <span className="text-sm text-slate-300">{transcriptMessageCount} message{transcriptMessageCount === 1 ? "" : "s"}</span>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-black text-blue-200">
                  {showTranscript ? "Collapse" : "Expand"}
                </span>
              </button>

              {showTranscript ? (
                <>
                  <div className="hidden h-10 items-center justify-end border-b border-white/10 px-5 sm:flex">
                    <div className="flex items-center gap-3 text-sm text-slate-300">
                      Auto-scroll
                      <button
                        type="button"
                        onClick={() => setAutoScrollTranscript((value) => !value)}
                        className={`relative h-5 w-9 rounded-full ${autoScrollTranscript ? "bg-blue-500" : "bg-white/15"}`}
                      >
                        <span className={`absolute top-1 h-3 w-3 rounded-full bg-white transition ${autoScrollTranscript ? "right-1" : "left-1"}`} />
                      </button>
                    </div>
                  </div>

                  <div className="overflow-hidden px-4 py-1 lg:h-[calc(100%-114px)] lg:max-h-none">
                    {visibleTranscriptItems.length || interimText ? (
                      <div className="divide-y divide-white/8">
                        {visibleTranscriptItems.map((line) => (
                          <div
                            key={line.id}
                            className="grid grid-cols-[80px_150px_1fr] gap-3 py-1 text-sm max-sm:grid-cols-1 max-sm:gap-1 max-sm:py-3"
                          >
                            <span className="text-slate-400">{line.time}</span>
                            <span
                              className={`font-semibold ${
                                line.role === "candidate"
                                  ? "text-blue-300"
                                  : line.role === "recruiter"
                                    ? "text-violet-300"
                                    : "text-slate-400"
                              }`}
                            >
                              {line.speaker}
                            </span>
                            <span className="leading-6 text-slate-100 max-sm:line-clamp-none sm:line-clamp-2">{line.text}</span>
                          </div>
                        ))}

                        {interimText ? (
                          <div className="grid grid-cols-[80px_150px_1fr] gap-3 py-1 text-sm opacity-70 max-sm:grid-cols-1 max-sm:gap-1">
                            <span className="text-slate-400">listening</span>
                            <span className="font-semibold text-blue-300">You</span>
                            <span className="leading-6 text-slate-100">{interimText}</span>
                          </div>
                        ) : null}

                        <div ref={transcriptEndRef} />
                      </div>
                    ) : (
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-slate-300">
                        <p className="font-bold text-slate-100">Interview transcript will appear here.</p>
                        <p className="mt-1">The recruiter will ask the first question after you press Start.</p>
                        <div ref={transcriptEndRef} />
                      </div>
                    )}
                  </div>

                  <div className="flex min-h-9 flex-wrap items-center justify-between gap-2 border-t border-white/10 px-4 py-1.5 text-xs text-slate-400 sm:px-5">
                    <span>Transcript is AI-generated and may not be 100% accurate.</span>
                    <button onClick={() => setTranscript([])} className="hover:text-white">
                      Clear Transcript
                    </button>
                  </div>
                </>
              ) : (
                <div className="px-4 py-3 text-sm text-slate-400 sm:px-5">
                  No transcript messages yet. Start the interview or wait for the recruiter question.
                </div>
              )}
            </section>
          </div>

          <aside className="grid gap-3 lg:min-h-0 lg:grid-rows-[190px_270px_82px]">
            <section className="rounded-2xl border border-white/10 bg-[#0b1527] p-3.5">
              <h2 className="text-base font-black">Interview Score</h2>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className={`grid h-[78px] w-[78px] place-items-center rounded-full border-[7px] bg-[#07111f] transition-all duration-500 ${scoreFlash === "up" ? "border-emerald-400 shadow-[0_0_0_10px_rgba(52,211,153,0.18)]" : scoreFlash === "down" ? "border-amber-400 shadow-[0_0_0_10px_rgba(251,191,36,0.18)]" : "border-blue-500 shadow-[0_0_0_10px_rgba(124,58,237,0.2)]"}`}>
                  <div className="text-center">
                    {scoreReady ? (
                      <>
                        <div className="text-2xl font-black">{recruiterSignal.overall}</div>
                        <div className="text-xs text-slate-300">/100</div>
                      </>
                    ) : (
                      <>
                        <div className="text-sm font-black uppercase tracking-[0.14em] text-blue-100">Ready</div>
                        <div className="text-[10px] text-slate-400">first answer</div>
                      </>
                    )}
                    {scoreFlash ? (
                      <div className={`mt-1 text-[10px] font-black uppercase ${scoreFlash === "up" ? "text-emerald-300" : "text-amber-300"}`}>
                        {scoreFlash === "up" ? "improved" : "check proof"}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="w-full min-w-0 flex-1 space-y-2">
                  {scoreItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className={`grid h-6 w-6 place-items-center rounded-lg ${toneClass(item.tone)}`}>
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="text-sm">{item.label}</span>
                        </div>
                        <span className="text-xs text-slate-200">{item.value}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-300">
                <span className="text-emerald-300">●</span> Overall Performance:{" "}
                <span className={`font-bold ${recruiterMoodColor(recruiterSignal.mood)}`}>{scoreReady ? recruiterSignal.mood : "Waiting"}</span>
              </p>
            </section>

            <section style={{ display: showCopilot ? undefined : "none" }} className="rounded-2xl border border-white/10 bg-[#0b1527] p-3.5 overflow-hidden">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black text-blue-300">
                  Live Copilot{" "}
                  <span className="ml-2 rounded-full bg-violet-400/15 px-2 py-1 text-xs text-violet-200">
                    Beta
                  </span>
                </h2>
                <span className="relative h-6 w-11 rounded-full bg-blue-500">
                  <span className="absolute right-1 top-1 h-4 w-4 rounded-full bg-white" />
                </span>
              </div>

              <div className="mt-3 grid grid-cols-[1fr_auto] gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Recruiter mood</p>
                  <p className={`mt-1 text-base font-black ${recruiterMoodColor(recruiterSignal.mood)}`}>
                    {scoreReady ? recruiterSignal.mood : "Waiting"}
                  </p>
                </div>
                <div className="text-right text-xs text-slate-300">
                  <p>Trust <span className="font-bold text-white">{scoreReady ? recruiterSignal.trust : "—"}</span></p>
                  <p>Interest <span className="font-bold text-white">{scoreReady ? recruiterSignal.interest : "—"}</span></p>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <div className="rounded-xl border border-emerald-300/15 bg-emerald-400/[0.07] px-3 py-1.5">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-200">Say next</p>
                  <p className="mt-1 line-clamp-1 text-[13px] leading-5 text-slate-100">
                    {scoreReady
                      ? recruiterSignal.trust < 60
                        ? "Clarify the claim first, then give one verified example."
                        : "Use one real example and state the result."
                      : "Answer the recruiter with one clear, role-relevant example."}
                  </p>
                </div>

                <div className="rounded-xl border border-amber-300/15 bg-amber-400/[0.07] px-3 py-1.5">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-200">Recruiter concern</p>
                  <p className="mt-1 line-clamp-1 text-[13px] leading-5 text-slate-100">
                    {scoreReady ? recruiterSignal.concern : "The recruiter is waiting for evidence, ownership, and impact."}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#0b1527] p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-black">Interview Progress</h2>
                <span className="text-sm text-slate-300">
                  Question {visibleQuestionNumber} of 12
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-300">{progress}% Completed</p>
                {interviewComplete ? (
                  <Link
                    href="/results"
                    onClick={() => saveInterviewResult("paused")}
                    className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-black text-emerald-200"
                  >
                    View Results
                  </Link>
                ) : null}
              </div>
            </section>
          </aside>
        </div>

        {showCopilot && status !== "idle" ? (
          <div className="fixed bottom-20 left-3 right-3 z-40 rounded-2xl border border-blue-300/20 bg-[#07111f]/95 px-4 py-3 shadow-2xl backdrop-blur-xl lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">Live Copilot</p>
                <p className={`truncate text-sm font-black ${recruiterMoodColor(recruiterSignal.mood)}`}>
                  {scoreReady ? recruiterSignal.mood : "Waiting"}
                </p>
              </div>
              <div className="shrink-0 text-right text-xs text-slate-300">
                <p>Trust <span className="font-black text-white">{scoreReady ? recruiterSignal.trust : "—"}</span></p>
                <p>Interest <span className="font-black text-white">{scoreReady ? recruiterSignal.interest : "—"}</span></p>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
