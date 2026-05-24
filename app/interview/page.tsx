"use client";

import LiveCopilotPanel from "@/components/interview/LiveCopilotPanel";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  Bookmark,
  Briefcase,
  ChevronRight,
  Clock3,
  FileText,
  Home,
  MessageSquare,
  Mic,
  MicOff,
  PhoneOff,
  Settings,
  Sparkles,
  Target,
  Volume2,
  VolumeX,
  Wand2,
} from "lucide-react";

import {
  readLatestInterviewSetup,
  saveLatestInterviewSetup,
  type WorkZoInterviewSetup,
} from "@/lib/workzoInterviewSetup";
import { getRecruiterVoiceProfile } from "@/lib/recruiterVoiceConfig";
import { trackWorkZoEvent } from "@/lib/workzoAnalytics";
import { trackWorkZoLaunchEvent } from "@/lib/workzoLaunchAnalytics";
import {
  buildOpeningWowMoment,
  createInitialRecruiterMemory,
  loadRecruiterMemory,
  resetLiveInterviewState,
  saveRecruiterMemory,
  updateRecruiterMemory,
  type RecruiterMemory,
  type RecruiterState,
} from "@/lib/workzoRecruiterPsychologyEngine";
import {
  clearExpiredInterviewState,
  touchWorkZoSession,
} from "@/lib/workzoStorage";
import type { WorkZoVapiClient } from "@/lib/workzoVapiVoice";
import {
  calculateWorkZoThinkingPauseMs,
  getBrowserSpeechPitch,
  getBrowserSpeechRate,
  humanizeRecruiterSpokenText,
} from "@/lib/workzoVoiceHumanizer";

type TranscriptItem = {
  role: "recruiter" | "candidate" | "system";
  text: string;
  time: string;
};

type InterviewMode = "standard" | "video";

type RecruiterId =
  | "friendly_hr"
  | "analytical_hiring_manager"
  | "startup_recruiter"
  | "german_corporate";

type BrowserSpeechRecognitionResult = {
  isFinal: boolean;
  0: { transcript: string };
};

type BrowserSpeechRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<BrowserSpeechRecognitionResult>;
};

type BrowserSpeechRecognitionErrorEvent = {
  error?: string;
  message?: string;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type WindowWithSpeechRecognition = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

type AnswerAnalysis = {
  signal:
    | "strong_metrics"
    | "good_ownership"
    | "too_generic"
    | "missing_metrics"
    | "unclear_ownership"
    | "rambling"
    | "too_short"
    | "recovery";
  state: RecruiterState;
  trustDelta: number;
  caption: string;
  bridge: string;
  followUp: string;
  weakness?: string;
  strength?: string;
};

type UnifiedRecruiterApiResponse = {
  question?: string;
  displayQuestion?: string;
  feedback?: string;
  intent?: string;
  shouldAdvanceQuestion?: boolean;
  shouldCountAsAnswer?: boolean;
  shouldStayOnCurrentQuestion?: boolean;
  trustDelta?: number;
  recruiterState?: RecruiterState;
  correction?: string;
  concern?: string;
  psychology?: {
    trust?: number;
    interest?: number;
    skepticism?: number;
    patience?: number;
    engagement?: number;
    confidenceInCandidate?: number;
  };
  cinematicRealism?: {
    pauseBeforeSpeakingMs?: number;
    naturalTransition?: string;
    shouldUseSilence?: boolean;
  };
  conversationStage?: string;
  pressure?: {
    level?: number;
    label?: string;
    reason?: string;
    behaviorShift?: string;
  };
  recruiterMemory?: {
    summary?: string;
    weakMoments?: string[];
    strongMoments?: string[];
    openDoubts?: string[];
    roleFitSignals?: string[];
  } | null;
  memoryEvents?: unknown[];
  recruiterMemoryInsight?: {
    callbackLine?: string;
    openDoubt?: string;
    strongestMoment?: string;
    weakestMoment?: string;
    recallMode?: string;
  };
  honestFeedback?: {
    headline?: string;
    recruiterRead?: string;
    risk?: string;
    nextFix?: string;
  };
  livePressureSimulation?: {
    pressureMode?: string;
    pacingCue?: string;
    warmthCue?: string;
    silenceCue?: string;
    nextFollowUpStyle?: string;
    interruptionRisk?: string;
  };
};

const recruiterAliasMap: Record<string, RecruiterId> = {
  sarah: "friendly_hr",
  friendly_hr: "friendly_hr",
  friendlyhr: "friendly_hr",
  friendly: "friendly_hr",
  hr: "friendly_hr",
  daniel: "analytical_hiring_manager",
  analytical_hiring_manager: "analytical_hiring_manager",
  analytical: "analytical_hiring_manager",
  hiring_manager: "analytical_hiring_manager",
  priya: "startup_recruiter",
  startup_recruiter: "startup_recruiter",
  startup: "startup_recruiter",
  markus: "german_corporate",
  german_corporate: "german_corporate",
  corporate: "german_corporate",
};

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: Home },
  { label: "Interviews", href: "/interview", icon: Sparkles, active: true },
  { label: "Practice", href: "/interview", icon: Target },
  { label: "CV & Resumes", href: "/onboarding", icon: FileText },
  { label: "Job Roles", href: "/onboarding", icon: Briefcase },
  { label: "Analytics", href: "/results", icon: BarChart3 },
  { label: "Feedback", href: "/results", icon: MessageSquare },
  { label: "Bookmarks", href: "#", icon: Bookmark },
  { label: "Settings", href: "#", icon: Settings },
];

const waveform = [14, 28, 18, 34, 20, 30, 42, 24, 36];

const fallbackQuestions = [
  "Tell me about a project where you personally improved a process or outcome.",
  "Walk me through a situation where you had to solve a difficult problem.",
  "Describe a time you handled a customer or stakeholder under pressure.",
  "Give me an example where you used data or evidence to make a better decision.",
  "Tell me about a mistake you made and how you recovered from it.",
  "Why are you a strong fit for this role?",
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function timeLabel() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeTurnText(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim()
    .toLowerCase();
}

function buildTurnSignature(question: string, answer: string) {
  const normalizedQuestion = normalizeTurnText(question).slice(0, 160);
  const normalizedAnswer = normalizeTurnText(answer).slice(0, 260);
  return `${normalizedQuestion}::${normalizedAnswer}`;
}

function isDuplicateCandidateTurn(
  previousSignature: string | null,
  nextSignature: string,
  previousAt: number,
  windowMs = 18000,
) {
  return Boolean(
    previousSignature &&
    previousSignature === nextSignature &&
    Date.now() - previousAt < windowMs,
  );
}

function isProbablySameRecruiterPrompt(reply: string, currentQuestion: string) {
  const a = normalizeTurnText(reply);
  const b = normalizeTurnText(currentQuestion);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;

  const aWords = new Set(a.split(/\s+/).filter((word) => word.length > 3));
  const bWords = b.split(/\s+/).filter((word) => word.length > 3);
  if (!aWords.size || !bWords.length) return false;

  const overlap = bWords.filter((word) => aWords.has(word)).length;
  return overlap / Math.max(1, bWords.length) > 0.72;
}

function isIntroRapportQuestionText(question: string) {
  const lower = question.replace(/\s+/g, " ").trim().toLowerCase();
  return /\b(how are you|how are you today|can you hear me|nice to meet you)\b/.test(
    lower,
  );
}

function isRapportSmallTalkText(answer: string) {
  const lower = answer.replace(/\s+/g, " ").trim().toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean);
  if (!lower) return false;
  if (
    /\b(nervous|anxious|excited|fine|good|okay|ok|ready|doing well|all good|can hear you|i can hear you|yes i can hear|yeah i can hear)\b/.test(
      lower,
    ) &&
    words.length <= 18
  )
    return true;
  if (/\b(no,?\s*)?i just said\b/.test(lower)) return true;
  return false;
}

function getWorkZoVapiErrorMessage(error: unknown): string {
  if (!error) return "";

  if (typeof error === "string") return error;

  if (error instanceof Error) {
    return [error.name, error.message, error.stack].filter(Boolean).join(" ");
  }

  if (typeof error === "object") {
    const record = error as Record<string, unknown>;
    const parts: string[] = [];

    for (const key of [
      "message",
      "reason",
      "type",
      "stage",
      "status",
      "statusText",
      "error",
    ]) {
      const value = record[key];
      if (typeof value === "string") parts.push(value);
      else if (value && typeof value === "object") {
        const nested = value as Record<string, unknown>;
        for (const nestedKey of ["message", "reason", "type", "name"]) {
          const nestedValue = nested[nestedKey];
          if (typeof nestedValue === "string") parts.push(nestedValue);
        }
      }
    }

    try {
      parts.push(JSON.stringify(error));
    } catch {}

    return parts.filter(Boolean).join(" ");
  }

  return String(error);
}

function isBenignVapiEndedError(error: unknown): boolean {
  const message = getWorkZoVapiErrorMessage(error).toLowerCase();

  return /meeting has ended|meeting ended|call has ended|call ended|ended due to ejection|due to ejection|ejection|participant.*ejected|room.*not.*found|no-room|no room|room lookup|daily.*meeting/i.test(
    message,
  );
}

function isVapiStartNetworkError(error: unknown): boolean {
  const message = getWorkZoVapiErrorMessage(error).toLowerCase();
  return /failed to fetch|cors|networkerror|network error|load failed|timeout|timed out/i.test(
    message,
  );
}

function safeLogVapiIssue(label: string, error: unknown) {
  const message = getWorkZoVapiErrorMessage(error);
  if (isBenignVapiEndedError(error)) {
    console.info(label, message || error);
    return;
  }

  console.warn(label, message || error);
}

function createVapiStartTimeout(ms = 14000) {
  return new Promise<never>((_, reject) => {
    window.setTimeout(() => {
      reject(
        new Error(
          `Vapi did not connect within ${Math.round(
            ms / 1000,
          )} seconds. Falling back to browser TTS.`,
        ),
      );
    }, ms);
  });
}

function isMobileBrowserRuntime() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod|android|mobile/i.test(navigator.userAgent || "");
}

function isIOSBrowserRuntime() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent || "");
}

async function unlockMobileAudioForSpeech() {
  if (typeof window === "undefined") return;

  try {
    const AudioContextConstructor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (AudioContextConstructor) {
      const audioContext = new AudioContextConstructor();
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      gain.gain.value = 0.00001;
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(0);
      oscillator.stop(audioContext.currentTime + 0.035);
      window.setTimeout(() => void audioContext.close().catch(() => {}), 160);
    }
  } catch {}

  try {
    // iOS Safari needs a real user-gesture media unlock. This tiny silent wav
    // prevents the first real recruiter line from being swallowed.
    const silentAudio = new Audio(
      "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQQAAAAAAA==",
    );
    silentAudio.muted = false;
    silentAudio.volume = 0.001;
    await silentAudio.play();
    silentAudio.pause();
    silentAudio.removeAttribute("src");
    silentAudio.load();
  } catch {}

  try {
    // iOS Safari must be unlocked from the SAME tap gesture.
    // Never cancel speech here. Cancelling during the tap chain can swallow the
    // first real recruiter sentence on iPhone/Chrome/Safari.
    window.speechSynthesis?.resume?.();
    window.speechSynthesis?.getVoices?.();
  } catch {}
}

function normalizeRecruiterId(value: unknown): RecruiterId | "" {
  if (typeof value !== "string") return "";
  const raw = value.trim().toLowerCase();
  if (!raw) return "";
  const key = raw.replace(/·/g, " ").replace(/-/g, "_").replace(/\s+/g, "_");
  if (recruiterAliasMap[key]) return recruiterAliasMap[key];
  if (raw.includes("sarah")) return "friendly_hr";
  if (raw.includes("priya")) return "startup_recruiter";
  if (raw.includes("markus")) return "german_corporate";
  if (raw.includes("daniel")) return "analytical_hiring_manager";
  return "";
}

function resolveRecruiterPersonality(
  source: Partial<WorkZoInterviewSetup> & Record<string, unknown>,
): RecruiterId {
  const possibleValues = [
    source.recruiterPersonality,
    source.selectedRecruiter,
    source.recruiter,
    source.recruiterId,
    source.recruiterName,
    source.interviewer,
    source.interviewerName,
  ];

  for (const value of possibleValues) {
    const normalized = normalizeRecruiterId(value);
    if (normalized) return normalized;
  }

  return "startup_recruiter";
}

function normalizeSetup(
  input?: Partial<WorkZoInterviewSetup> | null,
): WorkZoInterviewSetup {
  const stored = input || readLatestInterviewSetup();
  const source = stored as Partial<WorkZoInterviewSetup> &
    Record<string, unknown>;
  const recruiterPersonality = resolveRecruiterPersonality(source);

  return {
    cvText: source.cvText || "",
    jobDescription: source.jobDescription || "",
    targetRole: source.targetRole || "General Role",
    targetMarket: source.targetMarket || "Global",
    companyStyle: source.companyStyle || "Realistic",
    recruiterPersonality,
    language: source.language || "English",
    recruiterMemoryProfile: source.recruiterMemoryProfile || null,
    jobMemoryProfile: source.jobMemoryProfile || null,
    source: source.source || "latest-upload",
    setupVersion: 4,
    setupId: source.setupId || "",
    updatedAt: source.updatedAt || "",
  };
}

function recruiterImagePath(name: string, recruiterId?: string) {
  const lower = `${name} ${recruiterId || ""}`.toLowerCase();
  if (lower.includes("sarah") || lower.includes("friendly_hr"))
    return "/recruiters/sarah.png";
  if (lower.includes("priya") || lower.includes("startup_recruiter"))
    return "/recruiters/priya.png";
  if (lower.includes("markus") || lower.includes("german_corporate"))
    return "/recruiters/markus.png";
  if (lower.includes("daniel") || lower.includes("analytical_hiring_manager"))
    return "/recruiters/daniel.png";
  return "/recruiters/priya.png";
}

function recruiterIdleVideoPath(name: string, recruiterId?: string) {
  const lower = `${name} ${recruiterId || ""}`.toLowerCase();
  if (lower.includes("sarah") || lower.includes("friendly_hr"))
    return "/recruiters/sarah-idle.mp4";
  if (lower.includes("priya") || lower.includes("startup_recruiter"))
    return "/recruiters/priya-idle.mp4";
  if (lower.includes("markus") || lower.includes("german_corporate"))
    return "/recruiters/markus-idle.mp4";
  if (lower.includes("daniel") || lower.includes("analytical_hiring_manager"))
    return "/recruiters/daniel-idle.mp4";
  return "/recruiters/sarah-idle.mp4";
}

function recruiterVideoPathForState(
  name: string,
  recruiterId: string | undefined,
  _visualState: "idle" | "present" | "speaking" | "listening" | "thinking",
) {
  const lower = `${name} ${recruiterId || ""}`.toLowerCase();
  const folder =
    lower.includes("sarah") || lower.includes("friendly_hr")
      ? "sarah"
      : lower.includes("priya") || lower.includes("startup_recruiter")
        ? "priya"
        : lower.includes("markus") || lower.includes("german_corporate")
          ? "markus"
          : lower.includes("daniel") ||
              lower.includes("analytical_hiring_manager")
            ? "daniel"
            : "sarah";

  // IMPORTANT: keep the same recruiter MP4 alive through all states.
  // If we switch to /speaking.mp4 or /listening.mp4 before those files exist,
  // the browser fires onError and falls back to the static poster exactly when
  // the interview starts. State-specific behavior is created with glow, zoom,
  // waveform, transcript streaming, and overlays. Later, if you add state MP4s,
  // this can be safely upgraded to choose them.
  return `/recruiters/${folder}/idle.mp4`;
}

function cleanPossibleCandidateName(value: unknown) {
  if (typeof value !== "string") return "";
  const cleaned = value
    .replace(/candidate name:?/i, "")
    .replace(/name:?/i, "")
    .replace(/[^a-zA-ZÀ-ž .'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "";
  if (
    /candidate|resume|curriculum|profile|email|phone|linkedin|github|address/i.test(
      cleaned,
    )
  ) {
    return "";
  }

  const words = cleaned.split(" ").filter(Boolean);
  if (words.length < 1 || words.length > 4) return "";
  if (words.some((word) => word.length < 2 || word.length > 24)) return "";

  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function inferCandidateNameFromSetup(setup: WorkZoInterviewSetup) {
  const profile = setup.recruiterMemoryProfile;
  if (profile && typeof profile === "object" && "candidateName" in profile) {
    const value = (profile as { candidateName?: unknown }).candidateName;
    const cleaned = cleanPossibleCandidateName(value);
    if (cleaned) return cleaned;
  }

  const cvLines = (setup.cvText || "")
    .split(/\n|\r/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);

  for (const line of cvLines) {
    const cleaned = cleanPossibleCandidateName(line);
    if (cleaned) return cleaned;
  }

  if (typeof window !== "undefined") {
    const keys = ["workzo-candidate-name", "candidateName", "workzo_user_name"];

    for (const key of keys) {
      try {
        const cleaned = cleanPossibleCandidateName(
          window.localStorage.getItem(key),
        );
        if (cleaned) return cleaned;
      } catch {}
    }
  }

  return "";
}

function getCandidateName(setup: WorkZoInterviewSetup) {
  return inferCandidateNameFromSetup(setup) || "there";
}

function getRole(setup: WorkZoInterviewSetup) {
  const job = setup.jobMemoryProfile;
  if (job && typeof job === "object" && "roleTitle" in job) {
    const value = (job as { roleTitle?: unknown }).roleTitle;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return setup.targetRole || "Target Role";
}

function getCompany(setup: WorkZoInterviewSetup) {
  const job = setup.jobMemoryProfile;
  if (job && typeof job === "object" && "companyName" in job) {
    const value = (job as { companyName?: unknown }).companyName;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "Selected Company";
}

function formatElapsed(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function getFirstName(name?: string | null) {
  if (!name) return "";
  return name.trim().split(/\s+/)[0] || "";
}

function getAnswerSnippet(answer: string) {
  const clean = answer
    .replace(/\s+/g, " ")
    .replace(/[\n\r]+/g, " ")
    .trim();
  if (!clean) return "";

  const words = clean.split(" ").slice(0, 12).join(" ");
  return words.length < clean.length ? `${words}...` : words;
}

function buildHumanPauseMs(analysis: AnswerAnalysis) {
  if (analysis.state === "losing_confidence") return 1850;
  if (analysis.state === "pressuring") return 1450;
  if (analysis.state === "skeptical") return 1250;
  if (analysis.state === "recovering_trust") return 950;
  if (analysis.state === "engaged" || analysis.state === "interested")
    return 650;
  return 1050;
}

function softenRecruiterSpeech(text: string) {
  return text
    .replace(/\bCurrent Question\b/gi, "")
    .replace(/\bRecruiter expects measurable impact\b/gi, "")
    .replace(/\bKeep answer under 90 seconds\b/gi, "")
    .replace(/\bSpeak confidently\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function recruiterStateLabel(state: RecruiterState, trust: number) {
  if (state === "losing_confidence" || trust < 38) return "Trust dropping";
  if (state === "pressuring" || state === "skeptical" || trust < 48)
    return "Recruiter unconvinced";
  if (state === "recovering_trust") return "Recovery window open";
  if (state === "interested" || state === "engaged" || trust >= 68)
    return "Recruiter engaged";
  return "Listening for proof";
}

function recruiterPressureLine(
  recruiterId: string,
  state: RecruiterState,
  trust: number,
) {
  if (state === "losing_confidence" || state === "pressuring" || trust < 42) {
    if (recruiterId === "german_corporate")
      return "Be precise: task, responsibility, measurable result.";
    if (recruiterId === "startup_recruiter")
      return "Move faster: outcome, ownership, proof.";
    if (recruiterId === "friendly_hr")
      return "Stay concrete. I need to understand your contribution.";
    return "What evidence supports that answer?";
  }

  if (state === "recovering_trust")
    return "Your next answer can recover the hiring signal.";
  if (state === "interested" || state === "engaged" || trust >= 68)
    return "This is getting stronger. Keep the proof specific.";
  return "Answer like this is a real final-round conversation.";
}

type RecruiterRuntimeVoice = {
  voiceId: "shimmer" | "alloy" | "echo";
  gender: "female" | "male";
  pitch: number;
  rate: number;
  browserVoiceNames: string[];
};

function recruiterRuntimeVoice(
  recruiterId: RecruiterId,
): RecruiterRuntimeVoice {
  if (recruiterId === "friendly_hr") {
    return {
      voiceId: "shimmer",
      gender: "female",
      pitch: 1.08,
      rate: 0.9,
      browserVoiceNames: [
        "Microsoft Aria",
        "Microsoft Jenny",
        "Microsoft Zira",
        "Google UK English Female",
        "Samantha",
        "Victoria",
        "Karen",
        "Moira",
        "Tessa",
        "Serena",
        "Ava",
        "Emma",
      ],
    };
  }

  if (recruiterId === "startup_recruiter") {
    return {
      voiceId: "shimmer",
      gender: "female",
      pitch: 1.08,
      rate: 0.92,
      browserVoiceNames: [
        "Microsoft Aria",
        "Microsoft Jenny",
        "Microsoft Zira",
        "Google UK English Female",
        "Samantha",
        "Victoria",
        "Karen",
        "Moira",
        "Tessa",
        "Serena",
        "Ava",
        "Emma",
      ],
    };
  }

  if (recruiterId === "german_corporate") {
    return {
      voiceId: "alloy",
      gender: "male",
      pitch: 0.96,
      rate: 0.88,
      browserVoiceNames: [
        "Microsoft Guy",
        "Microsoft David",
        "Google UK English Male",
        "Google US English",
        "Alex",
        "Daniel",
        "Arthur",
        "Fred",
        "Tom",
      ],
    };
  }

  return {
    voiceId: "echo",
    gender: "male",
    pitch: 0.94,
    rate: 0.88,
    browserVoiceNames: [
      "Microsoft Guy",
      "Microsoft David",
      "Google UK English Male",
      "Google US English",
      "Alex",
      "Daniel",
      "Arthur",
      "Fred",
      "Tom",
    ],
  };
}

function isLikelyFemaleVoice(voice: SpeechSynthesisVoice) {
  return /shimmer|aria|jenny|samantha|victoria|zira|sonia|natasha|susan|hazel|karen|moira|tessa|veena|serena|ava|emma|female/i.test(
    `${voice.name} ${voice.voiceURI}`,
  );
}

function isLikelyMaleVoice(voice: SpeechSynthesisVoice) {
  return /alloy|echo|daniel|david|mark|george|alex|fred|tom|arthur|guy|male/i.test(
    `${voice.name} ${voice.voiceURI}`,
  );
}

function findVoiceByPreferredName(
  voices: SpeechSynthesisVoice[],
  preferredNames: string[],
) {
  for (const preferredName of preferredNames) {
    const exact = voices.find((voice) =>
      `${voice.name} ${voice.voiceURI}`
        .toLowerCase()
        .includes(preferredName.toLowerCase()),
    );
    if (exact) return exact;
  }

  return null;
}

function browserVoiceSignature(voice: SpeechSynthesisVoice) {
  return `${voice.name}|||${voice.voiceURI}|||${voice.lang}`;
}

function voiceMatchesRuntimeGender(
  voice: SpeechSynthesisVoice,
  runtimeVoice: RecruiterRuntimeVoice,
) {
  // Female recruiters must not accidentally fall back to ambiguous/default voices
  // such as "Google US English", which can sound male on some browsers.
  // Lock only clearly female browser voices for Sarah/Priya.
  if (runtimeVoice.gender === "female") return isLikelyFemaleVoice(voice);
  return isLikelyMaleVoice(voice) || !isLikelyFemaleVoice(voice);
}

function selectBrowserVoice(recruiterId: RecruiterId) {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;

  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const runtimeVoice = recruiterRuntimeVoice(recruiterId);
  const englishVoices = voices.filter((voice) =>
    voice.lang?.toLowerCase().startsWith("en"),
  );
  const pool = englishVoices.length ? englishVoices : voices;

  const preferred = findVoiceByPreferredName(
    pool,
    runtimeVoice.browserVoiceNames,
  );
  if (preferred) return preferred;

  if (runtimeVoice.gender === "female") {
    return (
      pool.find(isLikelyFemaleVoice) ||
      voices.find(isLikelyFemaleVoice) ||
      pool.find((voice) => !isLikelyMaleVoice(voice)) ||
      null
    );
  }

  return pool.find(isLikelyMaleVoice) || voices.find(isLikelyMaleVoice) || null;
}

function openAiVoiceIdForRecruiter(recruiterId: RecruiterId) {
  return recruiterRuntimeVoice(recruiterId).voiceId;
}

function recruiterQuestionLead(
  recruiterId: RecruiterId,
  state: RecruiterState,
) {
  if (state === "losing_confidence") {
    if (recruiterId === "german_corporate") return "I need to be direct here.";
    if (recruiterId === "startup_recruiter")
      return "I’m going to push you a bit.";
    if (recruiterId === "friendly_hr")
      return "Let me pause you there for a second.";
    return "I’m not convinced yet.";
  }

  if (state === "pressuring" || state === "skeptical") {
    if (recruiterId === "german_corporate") return "Be precise here.";
    if (recruiterId === "startup_recruiter") return "Let’s move quickly.";
    if (recruiterId === "friendly_hr") return "Stay concrete for me.";
    return "Let’s test the evidence.";
  }

  if (state === "recovering_trust") return "That was a better direction.";
  if (state === "engaged" || state === "interested")
    return "Good, let’s build on that.";

  if (recruiterId === "german_corporate") return "Let’s keep this structured.";
  if (recruiterId === "startup_recruiter")
    return "Alright, let’s get practical.";
  if (recruiterId === "friendly_hr")
    return "I’d like to understand your experience better.";
  return "I want to understand your thinking.";
}

function buildConversationalRecruiterSpeech({
  recruiterId,
  candidateName,
  screenQuestion,
  bridge,
  memory,
  state,
  trust,
  isOpening = false,
}: {
  recruiterId: RecruiterId;
  candidateName: string;
  screenQuestion: string;
  bridge?: string;
  memory: RecruiterMemory;
  state: RecruiterState;
  trust: number;
  isOpening?: boolean;
}) {
  const question = screenQuestion.replace(/\s+/g, " ").trim();
  const weakness = memory.rememberedWeaknesses?.[0];
  const strength = memory.rememberedStrengths?.[0];
  const lead = recruiterQuestionLead(recruiterId, state);

  if (isOpening) {
    const firstName = getFirstName(candidateName);

    // Natural recruiter opening: no onboarding narration, no repeated full name, no reading UI labels.
    if (/how are you/i.test(question)) {
      if (recruiterId === "startup_recruiter") {
        return firstName
          ? `Hi ${firstName}. Can you hear me clearly?`
          : "Hi. Can you hear me clearly?";
      }
      if (recruiterId === "friendly_hr") {
        return firstName
          ? `Hi ${firstName}, nice to meet you. How are you today?`
          : "Hi, nice to meet you. How are you today?";
      }
      if (recruiterId === "german_corporate") {
        return firstName
          ? `Hello ${firstName}. Before we begin, how are you today?`
          : "Hello. Before we begin, how are you today?";
      }
      return firstName
        ? `Hi ${firstName}. How are you today?`
        : "Hi. How are you today?";
    }

    if (/tell me a little about yourself/i.test(question)) {
      if (recruiterId === "startup_recruiter") {
        return "Good. Before we get into examples, give me the short version of your background and what you have been working on recently.";
      }
      if (recruiterId === "friendly_hr") {
        return "Good to hear. Let’s start naturally: tell me a little about yourself and how your experience connects to this role.";
      }
      if (recruiterId === "german_corporate") {
        return "Good. Let’s start with your background. Please keep it structured: your recent work, your main strengths, and why this role fits.";
      }
      return "Good. Let’s start with your background. Walk me through your recent experience and the kind of work you want to do next.";
    }

    return softenRecruiterSpeech(question);
  }

  // Keep live interview speech natural. Do not speak diagnostic coaching such as
  // "missing measurable impact" or "answer too short" during the call; save that
  // for the result page. Live speech should sound curious, not corrective.
  const gentleStatePrefix =
    state === "recovering_trust"
      ? "Good, that is clearer. "
      : state === "engaged" || state === "interested"
        ? "Okay. "
        : state === "skeptical" ||
            state === "pressuring" ||
            state === "losing_confidence"
          ? "Let’s be more specific. "
          : "";

  const spokenQuestion = softenRecruiterSpeech(question);
  const spokenBridge = bridge ? softenRecruiterSpeech(bridge) : lead;

  return `${gentleStatePrefix}${spokenBridge} ${spokenQuestion}`
    .replace(/\s+/g, " ")
    .replace(/\s+\./g, ".")
    .trim();
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

function analyzeAnswer(
  answer: string,
  memory: RecruiterMemory,
  previousTrust: number,
  recruiterId: RecruiterId,
  currentQuestion: string,
): AnswerAnalysis {
  const clean = answer.replace(/\s+/g, " ").trim();
  const words = clean.split(" ").filter(Boolean);
  const lower = clean.toLowerCase();

  if (
    isIntroRapportQuestionText(currentQuestion) &&
    isRapportSmallTalkText(clean)
  ) {
    return {
      signal: "good_ownership",
      state: "interested",
      trustDelta: 0,
      caption: "Recruiter is keeping the opening human",
      bridge: /nervous|anxious/i.test(clean)
        ? "That’s completely normal — let’s ease into it."
        : "Good to hear.",
      followUp:
        "Tell me a little about yourself and how your recent experience connects to this role.",
    };
  }

  const hasNumber =
    /\d|percent|percentage|hours?|days?|weeks?|months?|customers?|tickets?|users?|reduced|increased|saved|improved|faster|slower|revenue|cost/i.test(
      clean,
    );
  const ownershipWords =
    /\bi\b|\bmy\b|\bpersonally\b|\bled\b|\bbuilt\b|\bcreated\b|\bowned\b|\bhandled\b|\bresolved\b|\bimplemented\b|\banalyzed\b|\bdesigned\b|\bimproved\b/i.test(
      clean,
    );
  const vagueWords =
    /\bthings\b|\bstuff\b|\bsomething\b|\bvarious\b|\bmany\b|\ba lot\b|\bgood\b|\bnice\b|\bhelped\b|\bworked on\b/i.test(
      lower,
    );

  const repeatedMetricsIssue = memory.rememberedWeaknesses.some((item) =>
    /metric|number|impact|measurable/i.test(item),
  );
  const repeatedOwnershipIssue = memory.rememberedWeaknesses.some((item) =>
    /ownership|contribution|personally/i.test(item),
  );

  if (words.length < 8 && !isLikelyInterviewAnswer(clean)) {
    return {
      signal: "good_ownership",
      state: "interested",
      trustDelta: 0,
      caption: "Recruiter is keeping the conversation natural",
      bridge: "Okay.",
      followUp:
        "Can you give me a bit more context so I can evaluate the answer properly?",
    };
  }

  if (words.length < 18 && isLikelyInterviewAnswer(clean)) {
    return {
      signal: "too_short",
      state: "interested",
      trustDelta: 0,
      caption: "Recruiter is inviting more context",
      bridge: "Okay, I’m following you.",
      followUp:
        "Can you continue that example and give me a little more context about the situation and your role?",
    };
  }

  if (words.length > 160) {
    return {
      signal: "rambling",
      state: "interested",
      trustDelta: -3,
      caption: "Recruiter is guiding the answer gently",
      bridge: "Thanks, that gives me a lot of context.",
      followUp:
        "What would you say was the most important part of your contribution in that story?",
      weakness: "Answer could be more focused.",
    };
  }

  if (!ownershipWords) {
    return {
      signal: "unclear_ownership",
      state: "interested",
      trustDelta: repeatedOwnershipIssue ? -4 : -2,
      caption: "Recruiter is exploring ownership",
      bridge: "That helps me understand the situation.",
      followUp: "What part of that work was directly handled by you?",
      weakness: "Ownership needs clearer detail.",
    };
  }

  if (!hasNumber) {
    return {
      signal: "missing_metrics",
      state: "interested",
      trustDelta: repeatedMetricsIssue ? -4 : -2,
      caption: "Recruiter is exploring impact",
      bridge: "Got it — that gives me the story.",
      followUp:
        "What changed after your work? It can be time saved, fewer issues, better quality, or even a rough estimate.",
      weakness: "Impact could be more measurable.",
    };
  }

  if (vagueWords && words.length < 70) {
    return {
      signal: "too_generic",
      state: "interested",
      trustDelta: -2,
      caption: "Recruiter is asking for a concrete example",
      bridge: "Okay, I see the direction.",
      followUp:
        "Can you make it more concrete with one specific situation you remember?",
      weakness: "Answer could use a more concrete example.",
    };
  }

  if (previousTrust < 50) {
    return {
      signal: "recovery",
      state: "recovering_trust",
      trustDelta: 12,
      caption: "Recruiter sees recovery",
      bridge: "That was stronger — now I can actually see more evidence.",
      followUp:
        "Now give me another example where you showed the same level of ownership.",
      strength: "Recovered with clearer evidence.",
    };
  }

  if (hasNumber && ownershipWords) {
    const questionContext = currentQuestion.toLowerCase().includes("project")
      ? "project"
      : "example";
    return {
      signal: hasNumber ? "strong_metrics" : "good_ownership",
      state: "engaged",
      trustDelta: 9,
      caption: "Strong ownership signal detected",
      bridge:
        "That is more convincing because you gave me ownership and impact.",
      followUp: `Let’s go one level deeper: what was the hardest decision you made in that ${questionContext}?`,
      strength: "Clear ownership with measurable impact.",
    };
  }

  return {
    signal: "good_ownership",
    state: "interested",
    trustDelta: 5,
    caption: "Recruiter engaged by specifics",
    bridge: "Good, that is clearer.",
    followUp:
      "What would your manager or stakeholder say was the strongest part of your contribution?",
    strength: "Answer showed useful specificity.",
  };
}

function isClarificationOrMetaQuestion(answer: string) {
  const lower = answer.replace(/\s+/g, " ").trim().toLowerCase();
  if (!lower) return false;

  const clarificationPatterns = [
    /\b(can|could|do|did) you (see|read|have|access|look at|review)\b.*\b(resume|cv|job description|jd|job|role)\b/,
    /\b(resume|cv|job description|jd)\b.*\b(see|read|review|access|available|loaded|uploaded)\b/,
    /\bwhat\b.*\b(role|company|job|position)\b/,
    /\bwhich\b.*\b(role|company|job|position)\b/,
    /\bcan you hear me\b/,
    /\bare you there\b/,
    /\bhello\b/,
    /\bhi\b/,
  ];

  return clarificationPatterns.some((pattern) => pattern.test(lower));
}

function isLikelyInterviewAnswer(answer: string) {
  const clean = answer.replace(/\s+/g, " ").trim();
  if (!clean) return false;
  const words = clean.split(" ").filter(Boolean);
  const lower = clean.toLowerCase();

  if (isClarificationOrMetaQuestion(clean)) return false;
  if (isRapportSmallTalkText(clean)) return false;
  if (words.length >= 12) return true;

  return /\b(i|my|we|our|project|worked|built|handled|resolved|improved|created|managed|led|analyzed|implemented|customer|team|process|result|impact)\b/i.test(
    lower,
  );
}

function extractSafeCvSignals(setup: WorkZoInterviewSetup) {
  const cv = buildCandidateContext(setup);
  if (!cv || cv.length < 120) return [];

  const lower = cv.toLowerCase();
  const signals: string[] = [];

  if (lower.includes("support") || lower.includes("customer")) {
    signals.push("customer-facing/support experience");
  }

  if (lower.includes("sql")) {
    signals.push("SQL exposure");
  }

  if (lower.includes("python")) {
    signals.push("Python exposure");
  }

  if (
    lower.includes("ticket") ||
    lower.includes("incident") ||
    lower.includes("service desk")
  ) {
    signals.push("ticketing/service workflow experience");
  }

  if (lower.includes("excel") || lower.includes("spreadsheet")) {
    signals.push("Excel/spreadsheet experience");
  }

  if (lower.includes("project")) {
    signals.push("project experience");
  }

  return Array.from(new Set(signals)).slice(0, 3);
}

function buildCandidateContext(setup: WorkZoInterviewSetup) {
  const cvText = typeof setup.cvText === "string" ? setup.cvText.trim() : "";
  const memoryText = setup.recruiterMemoryProfile
    ? JSON.stringify(setup.recruiterMemoryProfile)
    : "";

  const source = cvText.length > 120 ? cvText : memoryText;

  return source.replace(/\s+/g, " ").slice(0, 5000);
}

function buildJobContext(setup: WorkZoInterviewSetup) {
  const jdText =
    typeof setup.jobDescription === "string" ? setup.jobDescription.trim() : "";

  const memoryText = setup.jobMemoryProfile
    ? JSON.stringify(setup.jobMemoryProfile)
    : "";

  const source = jdText.length > 80 ? jdText : memoryText;

  return source.replace(/\s+/g, " ").slice(0, 4000);
}

function hasUsableCv(setup: WorkZoInterviewSetup) {
  return buildCandidateContext(setup).length > 180;
}

function buildClarificationReply(
  answer: string,
  setup: WorkZoInterviewSetup,
  recruiterId: RecruiterId,
) {
  const lower = answer.toLowerCase();
  const role = getRole(setup);
  const company = getCompany(setup);
  const cvSignals = extractSafeCvSignals(setup);
  const hasCv = hasUsableCv(setup);
  const hasJob = buildJobContext(setup).length > 80;

  if (/\b(can you hear me|are you there|hello|hi)\b/i.test(lower)) {
    return recruiterId === "startup_recruiter"
      ? "Yes, I can hear you. Let’s continue — give me a focused answer to the question."
      : "Yes, I’m here and I can hear you. Let’s continue with the interview question.";
  }

  if (
    lower.includes("role") ||
    lower.includes("company") ||
    lower.includes("job")
  ) {
    return `Yes. We are interviewing for ${role}${company && company !== "Selected Company" ? ` at ${company}` : ""}. I’ll use that context as I evaluate your answers.`;
  }

  if (
    lower.includes("resume") ||
    lower.includes("cv") ||
    lower.includes("job description") ||
    lower.includes("jd")
  ) {
    if (hasCv && hasJob) {
      const signalLine = cvSignals.length
        ? ` I can clearly see signals like ${cvSignals.join(", ")}.`
        : "";
      return `Yes — I have your resume context and the job description available.${signalLine} I’ll only refer to details I can clearly verify, and I’ll use the role requirements to guide the interview.`;
    }

    if (hasCv) {
      return "I have your resume context available. I don’t have enough clear job-description detail, so I’ll ask you to clarify role-specific points when needed.";
    }

    if (hasJob) {
      return "I have the job-description context available. I don’t have enough clear resume detail, so I’ll ask you to explain your background directly.";
    }

    return "I don’t have enough clear resume or job-description detail available, so I’ll ask you to clarify your background and the role as we go.";
  }

  return "Good question. I’ll answer briefly, then we’ll continue the interview. Yes, I’m using the available role and background context to guide this conversation.";
}

function isEarlyMultiIntentRapport(answer: string) {
  const clean = answer.replace(/\s+/g, " ").trim().toLowerCase();
  if (!clean) return false;
  const asksName =
    /\b(your name|who are you|what'?s your name|what is your name|let me know your name|may i know your name)\b/i.test(
      clean,
    );
  const audioCheck =
    /\b(can you hear me|i can hear you|can hear you|can'?t hear|cannot hear|can not hear|no audio|voice is not audible|are you there)\b/i.test(
      clean,
    );
  const asksHow =
    /\b(how are you|how are you doing|what about you|and you)\b/i.test(clean);
  const saysGood =
    /\b(good|fine|okay|ok|great|well|ready|nervous|thank you|thanks)\b/i.test(
      clean,
    );
  const hasWorkEvidence =
    /\b(worked|experience|technical support|customer|client|ticket|project|handled|resolved|managed|led|built|improved|role|support engineer|customer success)\b/i.test(
      clean,
    );
  const wordCount = clean.split(/\s+/).filter(Boolean).length;
  return (
    (asksName || audioCheck || asksHow || saysGood) &&
    (wordCount <= 30 || !hasWorkEvidence)
  );
}

function buildEarlyMultiIntentRapportReply(
  answer: string,
  recruiterName: string,
  targetRole: string,
) {
  const clean = answer.replace(/\s+/g, " ").trim().toLowerCase();
  const parts: string[] = [];
  if (
    /\b(your name|who are you|what'?s your name|what is your name|let me know your name|may i know your name)\b/i.test(
      clean,
    )
  ) {
    parts.push(
      `Of course — I’m ${recruiterName}, your recruiter for this interview.`,
    );
  }
  if (
    /\b(can you hear me|i can hear you|can hear you|are you there)\b/i.test(
      clean,
    )
  ) {
    parts.push("Yes, I can hear you clearly.");
  }
  if (
    /\b(can'?t hear|cannot hear|can not hear|no audio|voice is not audible)\b/i.test(
      clean,
    )
  ) {
    parts.push(
      "Thanks for telling me. I’ll keep the transcript visible as well while the audio catches up.",
    );
  }
  if (
    /\b(how are you|how are you doing|what about you|and you)\b/i.test(clean)
  ) {
    parts.push("I’m doing well, thank you for asking.");
  }
  if (/\b(nervous|anxious|excited)\b/i.test(clean)) {
    parts.push("That’s completely normal at the start, so let’s ease into it.");
  } else if (
    /\b(good|fine|okay|ok|great|well|ready|thank you|thanks)\b/i.test(clean)
  ) {
    parts.push("Good to hear.");
  }
  const unique = Array.from(new Set(parts)).slice(0, 4);
  return `${unique.join(" ")} To start, tell me a little about your background and what makes you interested in ${targetRole}.`
    .replace(/\s+/g, " ")
    .trim();
}

function updateMemoryWithAnalysis(
  memory: RecruiterMemory,
  analysis: AnswerAnalysis,
  newTrust: number,
): RecruiterMemory {
  const next: RecruiterMemory = {
    ...memory,
    recruiterTrust: newTrust,
  };

  if (analysis.weakness) {
    next.rememberedWeaknesses = [
      analysis.weakness,
      ...(memory.rememberedWeaknesses || []).filter(
        (item) => item !== analysis.weakness,
      ),
    ].slice(0, 5);
  }

  if (analysis.strength) {
    next.rememberedStrengths = [
      analysis.strength,
      ...(memory.rememberedStrengths || []).filter(
        (item) => item !== analysis.strength,
      ),
    ].slice(0, 5);
  }

  if (analysis.signal === "missing_metrics") {
    next.weakMetrics = (memory.weakMetrics || 0) + 1;
  }

  if (analysis.signal === "unclear_ownership") {
    next.ownershipIssues = (memory.ownershipIssues || 0) + 1;
  }

  if (analysis.signal === "too_generic" || analysis.signal === "rambling") {
    next.vagueAnswers = (memory.vagueAnswers || 0) + 1;
  }

  if (analysis.signal === "recovery" || analysis.signal === "strong_metrics") {
    next.strongRecoveries = (memory.strongRecoveries || 0) + 1;
  }

  return next;
}

function Sidebar({
  setupId,
}: {
  candidateName: string;
  market: string;
  setupId?: string;
}) {
  return (
    <aside className="hidden h-full w-[240px] shrink-0 flex-col overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#061225]/86 px-5 py-3 shadow-[0_24px_80px_rgba(0,0,0,0.34)] backdrop-blur-2xl xl:flex">
      <Link href="/" className="flex items-center gap-3">
        <Image
          src="/workzo_icon.png"
          alt="WorkZo AI"
          width={40}
          height={40}
          className="rounded-xl"
        />
        <span className="text-[28px] font-black leading-none tracking-tight">
          WorkZo <span className="text-blue-400">AI</span>
        </span>
      </Link>

      <nav className="mt-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex h-[42px] items-center justify-between rounded-[14px] px-4 text-[15px] font-semibold transition",
                item.active
                  ? "bg-gradient-to-r from-blue-500 to-violet-600 text-white shadow-[0_14px_36px_rgba(59,130,246,0.28)]"
                  : "text-slate-300 hover:bg-white/[0.06] hover:text-white",
              )}
            >
              <span className="flex items-center gap-3">
                <Icon className="h-[18px] w-[18px]" />
                {item.label}
              </span>
              <ChevronRight className="h-4 w-4 opacity-70" />
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-[18px] border border-white/[0.06] bg-white/[0.045] p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-500/14 text-blue-200">
            <Wand2 className="h-5 w-5" />
          </div>
          <div>
            <p className="font-black">Work-O-Bot</p>
            <p className="text-xs font-bold text-blue-300">BETA</p>
          </div>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-300">
          Career copilot for role prep and answer rewrites.
        </p>
        <Link
          href={`/copilot${setupId ? `?setupId=${encodeURIComponent(setupId)}` : ""}`}
          className="mt-2 flex h-[36px] w-full items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.05] text-sm font-black text-white hover:bg-white/10"
        >
          Open Copilot
        </Link>
      </div>
    </aside>
  );
}

function InterviewRoom({
  recruiterName,
  recruiterRole,
  recruiterId,
  question,
  status,
  isLive,
  isSpeaking,
  isListening,
  isMuted,
  recruiterState,
  recruiterTrust,
  selectedMode,
  onSelectMode,
  elapsed,
  transcript,
  answeredQuestionCount,
  onMicClick,
  onEndInterview,
  speakerOn,
  onToggleSpeaker,
  needsMobileAudioStart,
  hasUnlockedMobileAudio,
}: {
  recruiterName: string;
  recruiterRole: string;
  recruiterId: RecruiterId;
  question: string;
  status: string;
  isLive: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  isMuted: boolean;
  recruiterState: RecruiterState;
  recruiterTrust: number;
  selectedMode: InterviewMode;
  onSelectMode: (mode: InterviewMode) => void;
  elapsed: number;
  transcript: TranscriptItem[];
  answeredQuestionCount: number;
  onMicClick: () => void;
  onEndInterview: () => void;
  speakerOn: boolean;
  onToggleSpeaker: () => void;
  needsMobileAudioStart: boolean;
  hasUnlockedMobileAudio: boolean;
}) {
  const isCinematicLive = true;
  const [recruiterVideoFailed, setRecruiterVideoFailed] = useState(false);
  const recruiterPosterSrc = recruiterImagePath(recruiterName, recruiterId);

  const normalizedStatus = status.toLowerCase();
  const recruiterVisualState = isSpeaking
    ? "speaking"
    : isListening
      ? "listening"
      : normalizedStatus.includes("thinking") ||
          normalizedStatus.includes("analyzing") ||
          normalizedStatus.includes("preparing")
        ? "thinking"
        : isLive
          ? "present"
          : "idle";

  const recruiterVideoSrc = recruiterVideoPathForState(
    recruiterName,
    recruiterId,
    recruiterVisualState,
  );

  useEffect(() => {
    setRecruiterVideoFailed(false);
  }, [recruiterName, recruiterId, recruiterVideoSrc]);

  const stateLabel = recruiterStateLabel(recruiterState, recruiterTrust);
  const latestRecruiterLine =
    transcript
      .slice()
      .reverse()
      .find((item) => item.role === "recruiter")?.text ||
    "Hi, nice to meet you. How are you today?";

  const [visibleRecruiterLine, setVisibleRecruiterLine] =
    useState(latestRecruiterLine);

  useEffect(() => {
    if (recruiterVisualState !== "speaking") {
      setVisibleRecruiterLine(latestRecruiterLine);
      return;
    }

    let index = 0;
    setVisibleRecruiterLine("");
    const timer = window.setInterval(() => {
      index += Math.max(2, Math.ceil(latestRecruiterLine.length / 36));
      setVisibleRecruiterLine(latestRecruiterLine.slice(0, index));
      if (index >= latestRecruiterLine.length) window.clearInterval(timer);
    }, 70);

    return () => window.clearInterval(timer);
  }, [latestRecruiterLine, recruiterVisualState]);

  const liveStatusLabel = needsMobileAudioStart
    ? "Tap to start audio"
    : recruiterVisualState === "speaking"
      ? "Recruiter speaking"
      : recruiterVisualState === "listening"
        ? "Listening closely"
        : recruiterVisualState === "thinking"
          ? "Analyzing response..."
          : isCinematicLive
            ? "Live recruiter room"
            : "Ready to begin";

  const recruiterCue =
    recruiterState === "pressuring"
      ? "This is getting stronger. Keep the proof specific."
      : recruiterState === "recovering_trust"
        ? "Good recovery signal. Keep the story concrete."
        : recruiterState === "losing_confidence"
          ? "Recruiter needs clearer evidence."
          : "Answer like this is a real final-round conversation.";

  const progressStep = Math.min(12, Math.max(1, answeredQuestionCount + 1));
  const pressureLevel =
    recruiterState === "pressuring" || recruiterTrust < 55
      ? "Medium"
      : recruiterTrust > 76
        ? "Low"
        : "Medium";
  const confidenceLabel =
    recruiterTrust > 78
      ? "Strong"
      : recruiterTrust < 55
        ? "Doubtful"
        : "Recovering";
  const overallGrade =
    recruiterTrust >= 82
      ? "A-"
      : recruiterTrust >= 70
        ? "B+"
        : recruiterTrust >= 58
          ? "B"
          : "C+";
  const clarity = Math.min(92, Math.max(42, recruiterTrust - 4));

  const displayTranscript =
    transcript.length > 0
      ? transcript.slice(-8)
      : [
          {
            role: "recruiter" as const,
            text: latestRecruiterLine,
            time: "00:08",
          },
        ];

  const micLabel = needsMobileAudioStart
    ? "Tap once to enable recruiter audio"
    : isLive
      ? isListening
        ? "Listening to your answer"
        : isSpeaking
          ? "Recruiter speaking"
          : isCinematicLive
            ? "Speak naturally when ready"
            : "Tap mic to answer"
      : isCinematicLive
        ? "Start cinematic live room"
        : "Tap mic to start interview";

  return (
    <div
      className={cn(
        "wz-mobile-root relative h-screen w-full overflow-hidden bg-[#020617] text-white",
        isCinematicLive && "wz-cinematic-mode",
        recruiterVisualState === "speaking" && "wz-speaking",
        recruiterVisualState === "listening" && "wz-listening",
        recruiterVisualState === "thinking" && "wz-thinking",
      )}
    >
      <style>{`
        @keyframes wzAvatarBreathe {
          0%, 100% { transform: scale(1.035) translateY(0) rotate(-0.18deg); filter: brightness(1.06) contrast(1.06) saturate(1.06); }
          42% { transform: scale(1.068) translateY(-7px) rotate(0.18deg); filter: brightness(1.18) contrast(1.11) saturate(1.14); }
          72% { transform: scale(1.048) translateY(-3px) rotate(0deg); filter: brightness(1.11) contrast(1.08) saturate(1.10); }
        }
        @keyframes wzAvatarSpeak {
          0%, 100% { transform: scale(1.055) translateY(0) rotate(-0.12deg); filter: brightness(1.20) contrast(1.13) saturate(1.18); }
          38% { transform: scale(1.092) translateY(-8px) rotate(0.16deg); filter: brightness(1.40) contrast(1.20) saturate(1.30); }
          70% { transform: scale(1.070) translateY(-3px) rotate(0deg); filter: brightness(1.28) contrast(1.16) saturate(1.22); }
        }
        @keyframes wzAvatarListen {
          0%, 100% { transform: scale(1.038) translateY(0) rotate(-0.10deg); filter: brightness(1.06) contrast(1.07); }
          50% { transform: scale(1.070) translateY(-6px) rotate(0.14deg); filter: brightness(1.16) contrast(1.11); }
        }
        @keyframes wzFrameAlive {
          0%, 100% { transform: translateY(0) scale(1); box-shadow: 0 0 70px rgba(37,99,235,.22); }
          50% { transform: translateY(-2px) scale(1.006); box-shadow: 0 0 105px rgba(34,211,238,.30); }
        }
        @keyframes wzFrameSpeak {
          0%, 100% { transform: translateY(0) scale(1.004); box-shadow: 0 0 110px rgba(34,211,238,.36); }
          48% { transform: translateY(-2px) scale(1.014); box-shadow: 0 0 155px rgba(34,211,238,.56); }
        }
        @keyframes wzFrameListen {
          0%, 100% { transform: translateY(0) scale(1); box-shadow: 0 0 95px rgba(16,185,129,.22); }
          50% { transform: translateY(-1px) scale(1.005); box-shadow: 0 0 120px rgba(16,185,129,.34); }
        }
        @keyframes wzBlinkMask {
          0%, 86%, 100% { opacity: 0; transform: translateX(-50%) scaleY(.12); }
          88% { opacity: .34; transform: translateX(-50%) scaleY(1); }
          89.5% { opacity: 0; transform: translateX(-50%) scaleY(.12); }
          95% { opacity: .22; transform: translateX(-50%) scaleY(.7); }
          96% { opacity: 0; transform: translateX(-50%) scaleY(.12); }
        }
        @keyframes wzMouthGlow {
          0%, 100% { opacity: .14; transform: translate(-50%, -50%) scaleX(.72) scaleY(.75); }
          45% { opacity: .88; transform: translate(-50%, -50%) scaleX(1.38) scaleY(1.12); }
        }
        @keyframes wzRoomPulse {
          0%, 100% { opacity: .28; transform: scale(.96); }
          50% { opacity: .78; transform: scale(1.05); }
        }
        @keyframes wzHaloSpin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes wzHaloPulse {
          0%, 100% { opacity: .28; transform: translate(-50%, -50%) scale(.94) rotate(-3deg); }
          50% { opacity: .86; transform: translate(-50%, -50%) scale(1.08) rotate(3deg); }
        }
        @keyframes wzWaveLow {
          0%, 100% { transform: scaleY(.40); opacity: .42; }
          45% { transform: scaleY(1.05); opacity: .82; }
        }
        @keyframes wzWaveSpeak {
          0%, 100% { transform: scaleY(.70); opacity: .68; box-shadow: 0 0 10px rgba(59,130,246,.34); }
          42% { transform: scaleY(1.85); opacity: 1; box-shadow: 0 0 24px rgba(34,211,238,.58); }
          72% { transform: scaleY(1.10); opacity: .92; }
        }
        @keyframes wzWaveListen {
          0%, 100% { transform: scaleY(.55); opacity: .55; }
          50% { transform: scaleY(1.45); opacity: .98; }
        }
        @keyframes wzParticleFloat {
          0% { transform: translate3d(0, 12px, 0) scale(.8); opacity: .08; }
          45% { opacity: .55; }
          100% { transform: translate3d(24px, -34px, 0) scale(1.22); opacity: .12; }
        }
        @keyframes wzScanLine {
          0% { transform: translateY(-120%) rotate(8deg); opacity: 0; }
          22% { opacity: .30; }
          55% { opacity: .62; }
          100% { transform: translateY(135%) rotate(8deg); opacity: 0; }
        }

        @keyframes wzFaceFocus {
          0%, 100% { opacity: .10; transform: translate(-50%, -50%) scale(.92); }
          50% { opacity: .24; transform: translate(-50%, -50%) scale(1.04); }
        }
        @keyframes wzShoulderLife {
          0%, 100% { opacity: .10; transform: translate(-50%, 0) scaleX(.92); }
          50% { opacity: .26; transform: translate(-50%, -3px) scaleX(1.06); }
        }

        @keyframes wzAliveLightSweep {
          0% { transform: translateX(-145%) rotate(12deg); opacity: 0; }
          24% { opacity: .18; }
          55% { opacity: .36; }
          100% { transform: translateX(145%) rotate(12deg); opacity: 0; }
        }
        @keyframes wzSubtleNod {
          0%, 100% { transform: translateY(0) scaleY(1); opacity: .09; }
          50% { transform: translateY(-4px) scaleY(1.06); opacity: .20; }
        }
        @keyframes wzSpeakingAura {
          0%, 100% { opacity: .22; transform: scale(.96); }
          50% { opacity: .62; transform: scale(1.06); }
        }
        @keyframes wzTypingCursor { 0%, 48% { opacity: 1; } 49%, 100% { opacity: .12; } }
        @keyframes wzTranscriptGlow {
          0%, 100% { opacity: .80; filter: drop-shadow(0 0 0 rgba(34,211,238,0)); }
          50% { opacity: 1; filter: drop-shadow(0 0 10px rgba(34,211,238,.22)); }
        }
        @keyframes wzTrustLine {
          0%, 100% { transform: translateY(0); opacity: .75; }
          50% { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes wzMicGlow {
          0%, 100% { box-shadow: 0 0 34px rgba(59,130,246,.35), inset 0 1px 0 rgba(255,255,255,.18); }
          50% { box-shadow: 0 0 78px rgba(139,92,246,.72), inset 0 1px 0 rgba(255,255,255,.28); }
        }
        .wz-avatar-frame { animation-name: wzFrameAlive; animation-duration: 5.2s; animation-timing-function: ease-in-out; animation-iteration-count: infinite; transform-origin: center center; }
        .wz-avatar-frame-speaking { animation-name: wzFrameSpeak; animation-duration: 1.5s; animation-timing-function: ease-in-out; animation-iteration-count: infinite; transform-origin: center center; }
        .wz-avatar-frame-listening { animation-name: wzFrameListen; animation-duration: 2.8s; animation-timing-function: ease-in-out; animation-iteration-count: infinite; transform-origin: center center; }
        .wz-avatar-img { animation-name: wzAvatarBreathe; animation-duration: 5.8s; animation-timing-function: ease-in-out; animation-iteration-count: infinite; transform-origin: center center; }
        .wz-avatar-img-speaking { animation-name: wzAvatarSpeak; animation-duration: 1.9s; animation-timing-function: ease-in-out; animation-iteration-count: infinite; transform-origin: center center; }
        .wz-avatar-img-listening { animation-name: wzAvatarListen; animation-duration: 3.2s; animation-timing-function: ease-in-out; animation-iteration-count: infinite; transform-origin: center center; }
        .wz-halo-spin { animation-name: wzHaloSpin; animation-duration: 16s; animation-timing-function: linear; animation-iteration-count: infinite; }
        .wz-halo-pulse { animation-name: wzHaloPulse; animation-duration: 4.2s; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
        .wz-room-pulse { animation-name: wzRoomPulse; animation-duration: 3.4s; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
        .wz-wave-bar { animation-name: wzWaveLow; animation-duration: 1.8s; animation-timing-function: ease-in-out; animation-iteration-count: infinite; transform-origin: bottom; }
        .wz-speaking .wz-wave-bar { animation-name: wzWaveSpeak; animation-duration: .82s; }
        .wz-listening .wz-wave-bar { animation-name: wzWaveListen; animation-duration: 1.08s; }
        .wz-wave-bar:nth-child(2) { animation-delay: .08s; }
        .wz-wave-bar:nth-child(3) { animation-delay: .16s; }
        .wz-wave-bar:nth-child(4) { animation-delay: .24s; }
        .wz-wave-bar:nth-child(5) { animation-delay: .32s; }
        .wz-wave-bar:nth-child(6) { animation-delay: .40s; }
        .wz-wave-bar:nth-child(7) { animation-delay: .48s; }
        .wz-wave-bar:nth-child(8) { animation-delay: .56s; }
        .wz-wave-bar:nth-child(9) { animation-delay: .64s; }
        .wz-blink-mask { animation-name: wzBlinkMask; animation-duration: 5.8s; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
        .wz-mouth-glow { animation-name: wzMouthGlow; animation-duration: .72s; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
        .wz-transcript-live { animation-name: wzTranscriptGlow; animation-duration: 1.6s; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
        .wz-face-focus { animation-name: wzFaceFocus; animation-duration: 4.4s; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
        .wz-shoulder-life { animation-name: wzShoulderLife; animation-duration: 5.2s; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
        .wz-speaking-aura { animation-name: wzSpeakingAura; animation-duration: 1.35s; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }

        .wz-particle { animation-name: wzParticleFloat; animation-duration: 7s; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
        .wz-particle:nth-child(2) { animation-delay: 1.2s; }
        .wz-particle:nth-child(3) { animation-delay: 2.4s; }
        .wz-particle:nth-child(4) { animation-delay: 3.6s; }
        .wz-scan-line { animation-name: wzScanLine; animation-duration: 5.5s; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
        .wz-trust-line { animation-name: wzTrustLine; animation-duration: 2.8s; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
        .wz-mic-live { animation-name: wzMicGlow; animation-duration: 2.2s; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }

        .wz-thinking .wz-avatar-img { filter: brightness(.72) contrast(1.06) saturate(.92) !important; }
        .wz-thinking .wz-wave-bar { animation-name: wzWaveLow; animation-duration: 2.8s; opacity: .32; }
        .wz-speaking .wz-avatar-shell, .wz-speaking .wz-avatar-frame { box-shadow: 0 0 155px rgba(34,211,238,.50), inset 0 0 70px rgba(34,211,238,.10); }
        .wz-listening .wz-avatar-shell, .wz-listening .wz-avatar-frame { box-shadow: 0 0 110px rgba(16,185,129,.26), inset 0 0 44px rgba(16,185,129,.08); }

        /* PH performance mode: keep the cinematic feel, but remove expensive continuous blur/particle animations. */
        .wz-room-pulse,
        .wz-halo-spin,
        .wz-halo-pulse,
        .wz-particle,
        .wz-scan-line,
        .wz-face-focus,
        .wz-shoulder-life,
        .wz-speaking-aura,
        .wz-blink-mask,
        .wz-mouth-glow {
          animation-name: none !important;
        }
        .wz-particle,
        .wz-scan-line,
        .wz-blink-mask {
          display: none !important;
        }
        .wz-avatar-frame,
        .wz-avatar-frame-speaking,
        .wz-avatar-frame-listening,
        .wz-avatar-img,
        .wz-avatar-img-speaking,
        .wz-avatar-img-listening {
          animation-duration: 7.5s !important;
          will-change: transform;
        }
        .wz-wave-bar { animation-duration: 1.45s !important; }
        .wz-speaking .wz-wave-bar { animation-duration: 1.05s !important; }
        .wz-listening .wz-wave-bar { animation-duration: 1.35s !important; }
        .wz-mic-live { animation-duration: 3.2s !important; }

        .wz-side-panel::-webkit-scrollbar, .wz-transcript-scroll::-webkit-scrollbar { width: 6px; }
        .wz-side-panel::-webkit-scrollbar-thumb, .wz-transcript-scroll::-webkit-scrollbar-thumb { background: rgba(148,163,184,.28); border-radius: 999px; }
        @media (max-height: 820px) { .wz-avatar-shell { height: min(42vh, 380px) !important; min-height: 300px !important; } }

        @media (max-width: 1180px) {
          .wz-room-grid { grid-template-columns: 1fr !important; height: auto !important; }
          body { overflow: auto; }
          .wz-side-panel { display: none !important; }
        }
        @media (max-width: 760px) {
          .wz-mobile-root { height: auto !important; min-height: 100dvh !important; overflow-y: auto !important; overflow-x: hidden !important; }
          .wz-mobile-page { height: auto !important; min-height: 100dvh !important; overflow: visible !important; padding: 12px 12px calc(env(safe-area-inset-bottom) + 34px) !important; }
          .wz-topbar { height: auto !important; min-height: 118px !important; margin-bottom: 10px !important; align-items: center !important; gap: 8px !important; flex-wrap: wrap !important; }
          .wz-topbar a { max-width: 46% !important; padding: 10px 14px !important; font-size: 13px !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }
          .wz-topbar .wz-room-title { position: static !important; transform: none !important; order: 3 !important; width: 100% !important; justify-content: center !important; margin-top: 4px !important; }
          .wz-topbar .wz-room-title > div { width: min(100%, 360px) !important; border-radius: 999px !important; text-align: center !important; padding: 10px 18px !important; font-size: 14px !important; line-height: 1.25 !important; }
          .wz-topbar .wz-end-actions { margin-left: auto !important; gap: 8px !important; }
          .wz-topbar .wz-end-actions button:first-child { display: none !important; }
          .wz-topbar .wz-end-actions button:last-child { padding: 10px 14px !important; font-size: 13px !important; }
          .wz-room-grid { grid-template-columns: 1fr !important; height: auto !important; min-height: 0 !important; gap: 12px !important; }
          .wz-recruiter-stage { min-height: 0 !important; height: auto !important; overflow: visible !important; padding-bottom: 12px !important; border-radius: 24px !important; }
          .wz-avatar-shell { width: calc(100% - 16px) !important; height: clamp(305px, 50vh, 430px) !important; min-height: 305px !important; margin-top: 18px !important; border-radius: 22px !important; }
          .wz-avatar-shell video, .wz-avatar-shell img { object-position: center top !important; }
          .wz-avatar-shell .wz-name-block { left: 18px !important; bottom: 18px !important; max-width: 56% !important; }
          .wz-avatar-shell .wz-name-block h2 { font-size: 30px !important; }
          .wz-avatar-shell .wz-state-card { right: 12px !important; bottom: 18px !important; max-width: 126px !important; padding: 10px !important; }
          .wz-avatar-shell .wz-state-card p:last-child { font-size: 13px !important; line-height: 1.25 !important; }
          .wz-live-badge { left: 22px !important; top: 18px !important; padding: 8px 12px !important; }
          .wz-live-status-badge { right: 18px !important; top: 18px !important; max-width: calc(100% - 142px) !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; padding: 8px 12px !important; }
          .wz-status-line { margin-top: 14px !important; font-size: 14px !important; }
          .wz-subtitle-pill { width: calc(100% - 28px) !important; margin: 8px auto 0 !important; }
          .wz-bottom-controls { position: relative !important; bottom: auto !important; width: calc(100% - 24px) !important; margin: 10px auto 0 !important; transform: none !important; padding: 12px !important; gap: 10px !important; z-index: 20 !important; }
          .wz-bottom-controls button { min-width: 0 !important; }
          .wz-bottom-controls .wz-mic-wrap { order: -1 !important; width: 100% !important; }
          .wz-bottom-controls .wz-mic-wrap button { height: 68px !important; width: 68px !important; margin-left: auto !important; margin-right: auto !important; }
          .wz-metrics-row { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; padding: 10px !important; gap: 8px !important; }
          .wz-metrics-row > div { border-right: 0 !important; border-radius: 18px !important; background: rgba(15,23,42,.42) !important; padding: 12px !important; }
          .wz-transcript-panel { display: block !important; min-height: 340px !important; max-height: none !important; }
          .wz-side-panel { display: none !important; }
          .wz-status-line { min-height: 20px !important; }
          .wz-subtitle-pill { max-height: 76px !important; overflow-y: auto !important; }
          .wz-mobile-page * { -webkit-tap-highlight-color: transparent; }

          /* Phase 1.5 priority 5: compact, stable mobile interview room. */
          .wz-mobile-page { padding-top: max(8px, env(safe-area-inset-top)) !important; }
          .wz-topbar { gap: 8px !important; margin-bottom: 8px !important; }
          .wz-topbar a, .wz-topbar button { flex-shrink: 0 !important; }
          .wz-topbar .wz-end-actions { width: 100% !important; justify-content: space-between !important; }
          .wz-live-badge, .wz-live-status-badge { max-width: 42vw !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; padding: 7px 10px !important; letter-spacing: .10em !important; font-size: 10px !important; }
          .wz-room-grid { gap: 10px !important; }
          .wz-avatar-shell { min-height: 255px !important; height: 38vh !important; max-height: 340px !important; border-radius: 24px !important; }
          .wz-name-block h2 { font-size: 18px !important; line-height: 1.1 !important; }
          .wz-name-block p { font-size: 11px !important; }
          .wz-state-card { padding: 9px 11px !important; max-width: 46vw !important; }
          .wz-state-card p:first-child { font-size: 9px !important; letter-spacing: .12em !important; }
          .wz-state-card p:last-child { font-size: 11px !important; }
          .wz-bottom-controls { position: sticky !important; bottom: calc(env(safe-area-inset-bottom) + 8px) !important; z-index: 50 !important; width: min(94vw, 420px) !important; margin-top: 8px !important; padding: 8px 10px !important; border-radius: 22px !important; }
          .wz-bottom-controls .wz-mic-wrap button { height: 58px !important; width: 58px !important; }
          .wz-bottom-controls .wz-mic-wrap p { max-width: 78vw !important; margin-left: auto !important; margin-right: auto !important; line-height: 1.25 !important; }
          .wz-metrics-row { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 0 !important; padding: 8px 6px !important; border-radius: 0 0 22px 22px !important; }
          .wz-metrics-row > div { border-right: 0 !important; padding: 8px 10px !important; }
          .wz-metrics-row p { font-size: 11px !important; }
          .wz-metrics-row p:nth-child(2) { font-size: 18px !important; }
          .wz-transcript-panel { min-height: 360px !important; max-height: none !important; border-radius: 22px !important; }
          .wz-transcript-panel > div:first-child { overflow-x: auto !important; padding-left: 10px !important; padding-right: 10px !important; }
          .wz-transcript-panel button { white-space: nowrap !important; font-size: 12px !important; padding-left: 10px !important; padding-right: 10px !important; }
          .wz-transcript-scroll { max-height: 54vh !important; padding: 10px 12px !important; }
          .wz-transcript-scroll p { font-size: 14px !important; line-height: 1.6 !important; }
          .wz-side-panel { display: none !important; }


          /* Launch-safe mobile layout: no clipped title pill, no horizontal drift, less cramped top area. */
          .wz-topbar { display: grid !important; grid-template-columns: 1fr 1fr !important; min-height: 64px !important; margin-bottom: 8px !important; }
          .wz-topbar .wz-room-title { display: none !important; }
          .wz-topbar a { max-width: 100% !important; justify-content: center !important; border-radius: 22px !important; }
          .wz-topbar .wz-end-actions { width: 100% !important; justify-content: stretch !important; }
          .wz-topbar .wz-end-actions button:last-child { width: 100% !important; justify-content: center !important; border-radius: 22px !important; }
          .wz-room-grid { width: 100% !important; overflow: visible !important; }
          .wz-recruiter-stage { width: 100% !important; padding-top: 6px !important; }
          .wz-avatar-shell { width: calc(100% - 10px) !important; height: clamp(285px, 43vh, 370px) !important; min-height: 285px !important; margin-top: 8px !important; }
          .wz-avatar-shell .wz-name-block h2 { font-size: 28px !important; }
          .wz-avatar-shell .wz-name-block p { font-size: 13px !important; line-height: 1.25 !important; }
          .wz-live-status-badge { max-width: calc(100% - 132px) !important; }
          .wz-bottom-controls { margin-top: 8px !important; padding: 10px !important; }
          .wz-metrics-row { margin-top: 10px !important; }


          /* Phase 1.5 v68 mobile polish: tighter spacing, stable scrolling, clearer transcript, persistent mic. */
          .wz-mobile-page {
            padding: max(8px, env(safe-area-inset-top)) 10px calc(env(safe-area-inset-bottom) + 18px) !important;
            height: auto !important;
            min-height: 100dvh !important;
            overflow-y: auto !important;
            overscroll-behavior-y: contain !important;
          }
          .wz-topbar {
            min-height: 50px !important;
            margin-bottom: 6px !important;
            gap: 7px !important;
          }
          .wz-topbar a, .wz-topbar .wz-end-actions button:last-child {
            min-height: 42px !important;
            padding: 9px 10px !important;
            font-size: 12px !important;
          }
          .wz-recruiter-stage {
            border-radius: 22px !important;
            padding-bottom: 8px !important;
          }
          .wz-avatar-shell {
            width: calc(100% - 8px) !important;
            height: clamp(230px, 34vh, 310px) !important;
            min-height: 230px !important;
            max-height: 310px !important;
            margin-top: 6px !important;
            border-radius: 22px !important;
          }
          .wz-avatar-shell video, .wz-avatar-shell img {
            object-position: center 18% !important;
          }
          .wz-avatar-shell .wz-name-block {
            left: 14px !important;
            bottom: 14px !important;
            max-width: 54% !important;
          }
          .wz-avatar-shell .wz-name-block h2 {
            font-size: 21px !important;
          }
          .wz-avatar-shell .wz-name-block p {
            font-size: 11px !important;
          }
          .wz-avatar-shell .wz-state-card {
            right: 10px !important;
            bottom: 14px !important;
            max-width: 132px !important;
            padding: 8px 9px !important;
            border-radius: 16px !important;
          }
          .wz-status-line {
            margin-top: 8px !important;
            padding-left: 10px !important;
            padding-right: 10px !important;
            font-size: 12px !important;
          }
          .wz-subtitle-pill {
            width: calc(100% - 16px) !important;
            max-height: 64px !important;
            margin-top: 6px !important;
            padding: 9px 12px !important;
            font-size: 12px !important;
            line-height: 1.45 !important;
          }
          .wz-bottom-controls {
            position: sticky !important;
            bottom: calc(env(safe-area-inset-bottom) + 8px) !important;
            z-index: 70 !important;
            width: min(94vw, 390px) !important;
            margin: 8px auto 0 !important;
            padding: 8px 9px !important;
            border-radius: 20px !important;
            box-shadow: 0 18px 48px rgba(0,0,0,.34), 0 0 28px rgba(59,130,246,.18) !important;
          }
          .wz-bottom-controls .wz-mic-wrap button {
            height: 54px !important;
            width: 54px !important;
          }
          .wz-bottom-controls .wz-mic-wrap p {
            font-size: 11px !important;
            line-height: 1.2 !important;
            margin-top: 5px !important;
          }
          .wz-metrics-row {
            margin-top: 8px !important;
            padding: 6px !important;
            gap: 6px !important;
            border-radius: 0 0 20px 20px !important;
          }
          .wz-metrics-row > div {
            padding: 8px !important;
            border-radius: 14px !important;
          }
          .wz-metrics-row p {
            font-size: 10px !important;
          }
          .wz-metrics-row p:nth-child(2) {
            font-size: 16px !important;
          }
          .wz-transcript-panel {
            margin-top: 10px !important;
            min-height: 430px !important;
            border-radius: 20px !important;
          }
          .wz-transcript-panel > div:first-child {
            min-height: 52px !important;
            padding: 10px !important;
            gap: 6px !important;
          }
          .wz-transcript-panel button {
            font-size: 11px !important;
            padding: 7px 9px !important;
          }
          .wz-transcript-scroll {
            max-height: min(58vh, 520px) !important;
            padding: 10px !important;
            scroll-behavior: smooth !important;
          }
          .wz-transcript-scroll p {
            font-size: 14px !important;
            line-height: 1.65 !important;
            letter-spacing: -0.01em !important;
          }
          .wz-transcript-scroll .rounded-2xl {
            border-radius: 16px !important;
          }
          .wz-live-badge, .wz-live-status-badge {
            top: 12px !important;
            font-size: 9px !important;
            padding: 6px 9px !important;
          }

        }
        @media (max-width: 920px) {
          .wz-mobile-root { overflow-x: hidden !important; }
          .wz-mobile-page { padding-left: 10px !important; padding-right: 10px !important; overflow-x: hidden !important; }
          .wz-topbar { display: grid !important; grid-template-columns: 1fr 1fr !important; min-height: 58px !important; gap: 8px !important; margin-bottom: 8px !important; }
          .wz-topbar .wz-room-title { display: none !important; }
          .wz-topbar a { max-width: 100% !important; width: 100% !important; justify-content: center !important; padding: 10px 12px !important; font-size: 13px !important; }
          .wz-topbar .wz-end-actions { width: 100% !important; margin-left: 0 !important; }
          .wz-topbar .wz-end-actions button:first-child { display: none !important; }
          .wz-topbar .wz-end-actions button:last-child { width: 100% !important; justify-content: center !important; padding: 10px 12px !important; font-size: 13px !important; }
          .wz-avatar-shell { max-width: 100% !important; overflow: hidden !important; }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_42%_8%,rgba(56,189,248,0.18),transparent_34%),radial-gradient(circle_at_80%_40%,rgba(124,58,237,0.16),transparent_30%),linear-gradient(180deg,rgba(2,6,23,0.2),#020617_85%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] [background-size:22px_22px]" />

      <div className="wz-mobile-page relative z-10 h-screen overflow-hidden px-6 pb-3 pt-3">
        <div className="wz-topbar mb-2 flex h-[50px] items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.055] px-5 py-3 text-sm font-bold text-slate-200 backdrop-blur-xl hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>

          <div className="wz-room-title absolute left-1/2 top-5 flex -translate-x-1/2 rounded-full border border-cyan-300/15 bg-slate-900/80 p-1 shadow-[0_0_44px_rgba(34,211,238,0.18)] backdrop-blur-xl">
            <div className="rounded-full bg-gradient-to-r from-blue-600/80 to-violet-600/80 px-9 py-2.5 text-sm font-black text-white shadow-lg">
              Live Recruiter Room
            </div>
          </div>

          <div className="wz-end-actions ml-auto flex items-center gap-3">
            <button className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[0.045] text-slate-300">
              <Settings className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={onEndInterview}
              className="inline-flex items-center gap-3 rounded-full border border-red-400/20 bg-red-500/10 px-5 py-3 text-sm font-black text-red-200 hover:bg-red-500/20"
            >
              <PhoneOff className="h-4 w-4" />
              End Interview
            </button>
          </div>
        </div>

        <div className="wz-room-grid grid h-[calc(100vh-72px)] min-h-0 grid-cols-[minmax(680px,1.52fr)_minmax(430px,0.9fr)_235px] gap-3">
          <main className="flex h-full min-h-0 flex-col gap-3">
            <section
              className={cn(
                "wz-recruiter-stage relative flex h-full min-h-0 flex-col overflow-hidden rounded-[26px] border bg-slate-950/70 shadow-[0_22px_90px_rgba(2,6,23,0.55)] backdrop-blur-xl",
                isCinematicLive ? "border-cyan-400/20" : "border-white/10",
              )}
            >
              <div className="wz-live-badge absolute left-7 top-7 z-30 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.8)]" />
                Live
              </div>
              <div className="wz-live-status-badge absolute right-7 top-7 z-30 rounded-full border border-white/10 bg-slate-950/70 px-5 py-2 text-xs font-black uppercase tracking-[0.24em] text-cyan-100 shadow-[0_0_26px_rgba(34,211,238,0.12)]">
                {liveStatusLabel}
              </div>

              {isCinematicLive && (
                <>
                  <div className="wz-room-pulse pointer-events-none absolute left-1/2 top-[34%] h-[520px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
                  <div className="wz-halo-spin pointer-events-none absolute left-1/2 top-[33%] h-[500px] w-[760px] rounded-[50%] border border-cyan-300/18" />
                  <div className="wz-halo-pulse pointer-events-none absolute left-1/2 top-[33%] h-[440px] w-[700px] rounded-[50%] border border-blue-400/20" />
                  <div className="wz-particle pointer-events-none absolute left-[22%] top-[18%] h-2 w-2 rounded-full bg-cyan-200/40 blur-[1px]" />
                  <div className="wz-particle pointer-events-none absolute left-[72%] top-[20%] h-2 w-2 rounded-full bg-violet-200/35 blur-[1px]" />
                  <div className="wz-particle pointer-events-none absolute left-[82%] top-[56%] h-2 w-2 rounded-full bg-cyan-200/30 blur-[1px]" />
                  <div className="wz-particle pointer-events-none absolute left-[38%] top-[62%] h-1.5 w-1.5 rounded-full bg-blue-200/35 blur-[1px]" />
                </>
              )}

              <div
                className={cn(
                  "wz-avatar-shell relative mx-auto mt-9 h-[min(45vh,430px)] min-h-[320px] w-[calc(100%-44px)] max-w-[980px] overflow-hidden rounded-[30px] border bg-black shadow-[0_0_38px_rgba(37,99,235,0.16)] transition-all duration-700",
                  isCinematicLive &&
                    "wz-avatar-frame border-cyan-300/20 shadow-[0_0_54px_rgba(34,211,238,0.16)]",
                  recruiterVisualState === "speaking" &&
                    "wz-avatar-frame-speaking shadow-[0_0_74px_rgba(34,211,238,0.24)]",
                  recruiterVisualState === "listening" &&
                    "wz-avatar-frame-listening border-emerald-300/25 shadow-[0_0_60px_rgba(16,185,129,0.18)]",
                )}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_24%,transparent_0%,rgba(2,6,23,0.04)_32%,rgba(2,6,23,0.80)_100%)]" />
                <div className="absolute inset-0 overflow-hidden">
                  {!recruiterVideoFailed && (
                    <video
                      className={cn(
                        "absolute inset-0 h-full w-full object-cover object-center transition-all duration-700 will-change-transform",
                        isCinematicLive && "wz-avatar-img",
                        recruiterVisualState === "speaking" &&
                          "wz-avatar-img-speaking",
                        recruiterVisualState === "listening" &&
                          "wz-avatar-img-listening",
                      )}
                      src={recruiterVideoSrc}
                      poster={recruiterPosterSrc}
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      onError={() => setRecruiterVideoFailed(true)}
                    />
                  )}
                  <Image
                    src={recruiterPosterSrc}
                    alt={`${recruiterName} recruiter`}
                    fill
                    priority
                    sizes="(max-width: 900px) 100vw, 55vw"
                    className={cn(
                      "object-cover object-center transition-all duration-700 will-change-transform",
                      !recruiterVideoFailed && isCinematicLive
                        ? "opacity-0"
                        : "opacity-100",
                      isCinematicLive && "wz-avatar-img",
                      recruiterVisualState === "speaking" &&
                        "wz-avatar-img-speaking",
                      recruiterVisualState === "listening" &&
                        "wz-avatar-img-listening",
                    )}
                  />
                </div>

                {isCinematicLive && (
                  <>
                    <div
                      className={cn(
                        "wz-speaking-aura pointer-events-none absolute inset-0 rounded-[30px] bg-[radial-gradient(circle_at_50%_35%,rgba(34,211,238,0.20),transparent_34%)]",
                        recruiterVisualState === "speaking"
                          ? "opacity-100"
                          : "opacity-40",
                      )}
                    />
                    <div className="wz-face-focus pointer-events-none absolute left-1/2 top-[28%] h-24 w-56 rounded-full bg-cyan-200/20 blur-2xl" />
                    <div className="wz-shoulder-life pointer-events-none absolute bottom-[19%] left-1/2 h-16 w-[55%] rounded-full bg-blue-400/16 blur-2xl" />
                    <div
                      className="pointer-events-none absolute left-1/2 top-[47%] h-40 w-[48%] -translate-x-1/2 rounded-full bg-cyan-300/10 blur-3xl"
                      style={{
                        animationName: "wzSubtleNod",
                        animationDuration: "4.2s",
                        animationTimingFunction: "ease-in-out",
                        animationIterationCount: "infinite",
                      }}
                    />
                    <div
                      className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-transparent via-cyan-200/18 to-transparent blur-xl"
                      style={{
                        animationName: "wzAliveLightSweep",
                        animationDuration:
                          recruiterVisualState === "speaking" ? "2.4s" : "5.8s",
                        animationTimingFunction: "ease-in-out",
                        animationIterationCount: "infinite",
                      }}
                    />
                    <div className="wz-scan-line pointer-events-none absolute -left-10 top-0 h-[160%] w-24 bg-gradient-to-b from-transparent via-cyan-200/18 to-transparent blur-xl" />
                    <div className="wz-blink-mask pointer-events-none absolute left-1/2 top-[28%] h-4 w-36 rounded-full bg-slate-950/55 blur-sm" />
                    <div
                      className={cn(
                        "pointer-events-none absolute left-1/2 top-[48%] h-12 w-28 rounded-full bg-cyan-300/0 blur-xl",
                        recruiterVisualState === "speaking" &&
                          "wz-mouth-glow bg-cyan-200/40",
                      )}
                    />
                    <div
                      className={cn(
                        "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_34%,rgba(34,211,238,0.12),transparent_22%),linear-gradient(180deg,transparent_42%,rgba(2,6,23,0.90)_100%)] transition-opacity duration-500",
                        recruiterVisualState === "speaking"
                          ? "opacity-100"
                          : "opacity-70",
                      )}
                    />
                  </>
                )}

                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent p-6 pt-24">
                  <div className="flex items-end justify-between gap-5">
                    <div className="wz-name-block">
                      <div className="mb-3 h-12 w-1 rounded-full bg-gradient-to-b from-violet-400 to-cyan-300" />
                      <h2 className="text-2xl font-black tracking-tight">
                        {recruiterName}
                      </h2>
                      <p className="mt-1 text-sm text-slate-300">
                        {recruiterRole}
                      </p>
                      <p className="text-xs text-slate-400">
                        12+ years of hiring experience
                      </p>
                    </div>
                    <div className="wz-state-card rounded-2xl border border-white/10 bg-slate-950/70 px-5 py-4 text-right backdrop-blur-xl">
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
                        State
                      </p>
                      <p className="mt-1 text-sm font-bold text-white">
                        {liveStatusLabel}
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className={cn(
                    "absolute bottom-6 left-1/2 h-[44px] w-[82%] -translate-x-1/2 overflow-hidden rounded-full opacity-95",
                    recruiterVisualState === "speaking" && "opacity-100",
                  )}
                >
                  <div className="absolute inset-x-0 bottom-3 flex items-end justify-center gap-[4px]">
                    {waveform.slice(0, 12).map((height, index) => (
                      <span
                        key={`stage-wave-${index}`}
                        className={cn(
                          "wz-wave-bar block w-[4px] rounded-full bg-gradient-to-t from-blue-500 via-cyan-200 to-violet-400",
                          recruiterVisualState === "speaking" &&
                            "shadow-[0_0_12px_rgba(34,211,238,0.45)]",
                        )}
                        style={{
                          height: `${Math.max(8, height - (index % 3) * 4)}px`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div
                className={cn(
                  "mt-2 text-center",
                  recruiterVisualState === "speaking" && "text-cyan-100",
                )}
              >
                <p className="inline-flex items-center gap-2 rounded-full bg-slate-950/45 px-5 py-2 text-sm font-bold text-slate-300">
                  <Clock3 className="h-4 w-4 text-cyan-300" />
                  {isLive
                    ? recruiterVisualState === "speaking"
                      ? "Recruiter is speaking"
                      : recruiterVisualState === "thinking"
                        ? "Recruiter is thinking"
                        : recruiterVisualState === "listening"
                          ? "Listening to your answer"
                          : "Your turn — answer naturally"
                    : isCinematicLive
                      ? "Cinematic recruiter room is live"
                      : "Ready for interview"}
                </p>
              </div>

              <div className="mx-auto mt-2 w-[82%] max-w-[820px] rounded-full border border-white/5 bg-slate-950/45 px-5 py-2 text-center text-xs text-slate-400">
                <span
                  className={cn(
                    recruiterVisualState === "speaking" &&
                      "wz-transcript-live text-cyan-100",
                  )}
                >
                  {recruiterVisualState === "thinking"
                    ? "Analyzing response..."
                    : visibleRecruiterLine}
                </span>
                {recruiterVisualState === "speaking" && (
                  <span className="ml-1 inline-block animate-pulse text-cyan-300">
                    |
                  </span>
                )}
              </div>

              <div className="wz-bottom-controls mx-auto mt-2 flex w-[82%] max-w-[760px] items-center justify-center gap-4 rounded-3xl border border-white/10 bg-slate-950/55 px-4 py-2 shadow-[0_14px_45px_rgba(2,6,23,.35)] backdrop-blur-xl">
                <button
                  type="button"
                  onClick={onToggleSpeaker}
                  className="hidden h-10 min-w-[118px] items-center justify-center gap-2 rounded-full border border-white/10 bg-slate-950/70 px-4 text-xs font-bold text-slate-300 backdrop-blur-xl md:inline-flex"
                >
                  {speakerOn ? (
                    <Volume2 className="h-4 w-4" />
                  ) : (
                    <VolumeX className="h-4 w-4" />
                  )}
                  {speakerOn ? "Audio On" : "Audio Off"}
                </button>
                <div className="wz-mic-wrap text-center">
                  <button
                    type="button"
                    onClick={onMicClick}
                    className={cn(
                      "wz-mic-live grid h-[54px] w-[54px] place-items-center rounded-full border text-white transition hover:scale-[1.03]",
                      isListening
                        ? "border-emerald-300/50 bg-emerald-500/20"
                        : "border-blue-200/30 bg-gradient-to-br from-blue-500 to-violet-600",
                    )}
                    aria-label={
                      isLive ? "Continue listening" : "Start interview"
                    }
                  >
                    {isLive && isListening ? (
                      <MicOff className="h-6 w-6" />
                    ) : (
                      <Mic className="h-6 w-6" />
                    )}
                  </button>
                  <p className="mt-1 text-[11px] font-medium text-slate-400">
                    {micLabel}
                  </p>
                </div>
                <button className="hidden h-10 min-w-[118px] items-center justify-center gap-2 rounded-full border border-white/10 bg-slate-950/70 px-4 text-xs font-bold text-slate-300 backdrop-blur-xl md:inline-flex">
                  <VolumeX className="h-4 w-4 text-red-300" />
                  Camera Off
                </button>
              </div>

              <div className="wz-metrics-row mt-2 grid grid-cols-4 gap-0 border-t border-white/[0.06] bg-slate-950/34 px-5 py-2">
                <div className="border-r border-white/[0.06] px-4">
                  <p className="text-xs text-slate-400">🔥 Pressure Level</p>
                  <p className="mt-1 text-xl font-black text-amber-300">
                    {pressureLevel}
                  </p>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-800">
                    <div className="h-full w-[64%] rounded-full bg-amber-400" />
                  </div>
                </div>
                <div className="border-r border-white/[0.06] px-4">
                  <p className="text-xs text-slate-400">🛡 Trust Score</p>
                  <p className="mt-1 text-xl font-black text-emerald-300">
                    {recruiterTrust}%
                  </p>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-emerald-400"
                      style={{ width: `${recruiterTrust}%` }}
                    />
                  </div>
                </div>
                <div className="border-r border-white/[0.06] px-4">
                  <p className="text-xs text-slate-400">〽 Trust trend</p>
                  <p className="mt-1 text-base font-black text-blue-300">
                    {confidenceLabel}
                  </p>
                  <div className="wz-trust-line mt-2 h-6 rounded-xl bg-gradient-to-r from-blue-500/20 via-violet-500/25 to-cyan-400/20" />
                </div>
                <div className="px-4">
                  <p className="text-xs text-slate-400">Overall Performance</p>
                  <p className="mt-2 text-2xl font-black text-white">
                    {overallGrade}
                  </p>
                  <p className="text-xs text-slate-400">Good progress</p>
                </div>
              </div>
            </section>
          </main>

          <section className="wz-transcript-panel flex h-full min-h-0 flex-col rounded-[28px] border border-white/10 bg-slate-950/70 shadow-[0_22px_90px_rgba(2,6,23,0.45)] backdrop-blur-xl">
            <div className="flex border-b border-white/10 px-7 pt-4">
              <button className="border-b-2 border-violet-400 px-4 pb-3 text-sm font-black text-violet-200">
                Live Transcript
              </button>
              <button className="px-4 pb-3 text-sm font-semibold text-slate-400">
                Interview Notes
              </button>
              <button className="px-4 pb-3 text-sm font-semibold text-slate-400">
                Recruiter Memory
              </button>
            </div>
            <div className="wz-transcript-scroll min-h-0 flex-1 space-y-0 overflow-y-auto px-6 py-4">
              {displayTranscript.map((item, index) => {
                const isRecruiter = item.role === "recruiter";
                return (
                  <div
                    key={`${item.time}-${index}`}
                    className="border-b border-white/[0.07] py-5 last:border-b-0"
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={cn(
                          "grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full",
                          isRecruiter ? "bg-slate-800" : "bg-violet-600",
                        )}
                      >
                        {isRecruiter ? (
                          <Image
                            src={recruiterImagePath(recruiterName, recruiterId)}
                            alt="recruiter"
                            width={42}
                            height={42}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-sm font-black">You</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="font-semibold text-slate-200">
                            {isRecruiter
                              ? `${recruiterName} (Recruiter)`
                              : "You"}
                          </p>
                          <span className="text-xs text-slate-500">
                            {item.time}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap text-[15px] leading-7 text-slate-200">
                          {item.text}
                        </p>
                        {index === displayTranscript.length - 1 &&
                          recruiterVisualState === "thinking" &&
                          isRecruiter && (
                            <p className="mt-3 text-sm text-slate-400">
                              Thinking...{" "}
                              <span className="text-violet-300">•••</span>
                            </p>
                          )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="wz-side-panel h-full min-h-0 space-y-3 overflow-y-auto pr-1 pb-2">
            <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 backdrop-blur-xl">
              <p className="text-xs font-black uppercase tracking-[0.30em] text-slate-400">
                Recruiter Guide
              </p>
              <div className="mt-6 space-y-5 text-sm leading-6">
                <div>
                  <p className="font-black text-white">Current pressure</p>
                  <p className="mt-1 text-slate-400">{recruiterCue}</p>
                </div>
                <div>
                  <p className="font-black text-white">Memory callback</p>
                  <p className="mt-1 text-slate-400">
                    Recruiter is building first impression.
                  </p>
                </div>
                <div>
                  <p className="font-black text-white">Mode</p>
                  <p className="mt-1 text-slate-400">
                    {isCinematicLive
                      ? "Pseudo-live cinematic recruiter room."
                      : "Stable manual interview flow."}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 backdrop-blur-xl">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Your Stats
              </p>
              <div className="mt-5 space-y-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Time</span>
                  <span className="font-bold">{formatElapsed(elapsed)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Hiring Signal</span>
                  <span className="font-black text-emerald-300">
                    {recruiterTrust}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Clarity Score</span>
                  <span className="font-black text-amber-200">{clarity}%</span>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 backdrop-blur-xl">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Recruiter
              </p>
              <h3 className="mt-5 text-xl font-black">
                {recruiterName} <span className="text-emerald-300">•</span>
              </h3>
              <p className="mt-1 text-sm text-slate-400">{recruiterRole}</p>
              <p className="mt-4 inline-flex rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-200">
                Recruiter engaged
              </p>
            </div>
            <div className="rounded-3xl border border-cyan-300/10 bg-slate-950/70 p-5 backdrop-blur-xl">
              <p className="font-black text-amber-200">💡 Quick Tips</p>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                Give situation, personal action, measurable results.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default function InterviewPage() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [activeSetup, setActiveSetup] = useState<WorkZoInterviewSetup>(() =>
    normalizeSetup(null),
  );
  const [mode, setMode] = useState<InterviewMode>("video");
  const [isLive, setIsLive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [needsMobileAudioStart, setNeedsMobileAudioStart] = useState(false);
  const [hasUnlockedMobileAudio, setHasUnlockedMobileAudio] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [voiceStatus, setVoiceStatus] = useState(
    "Cinematic recruiter room is live",
  );
  const [question, setQuestion] = useState(fallbackQuestions[0]);
  const [answeredQuestionCount, setAnsweredQuestionCount] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [recruiterMemory, setRecruiterMemory] = useState<RecruiterMemory>(() =>
    createInitialRecruiterMemory(),
  );
  const [recruiterState, setRecruiterState] =
    useState<RecruiterState>("neutral");
  const [recruiterTrust, setRecruiterTrust] = useState(58);

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const isSpeakingRef = useRef(false);
  const lockedVoiceSignatureRef = useRef<string | null>(null);
  const lockedVoiceRecruiterRef = useRef<RecruiterId | null>(null);
  const isLiveRef = useRef(false);
  const modeRef = useRef<InterviewMode>(mode);
  const questionRef = useRef(question);
  const transcriptRef = useRef<TranscriptItem[]>([]);
  const memoryRef = useRef<RecruiterMemory>(recruiterMemory);
  const trustRef = useRef(recruiterTrust);
  const recruiterStateRef = useRef<RecruiterState>(recruiterState);
  const silenceTimerRef = useRef<number | null>(null);
  const finalizationTimerRef = useRef<number | null>(null);
  const pendingAnswerRef = useRef("");
  const hasGreetedRef = useRef(false);
  const interviewStepRef = useRef<"greeting" | "intro" | "deep_dive">(
    "greeting",
  );
  const handleCandidateAnswerRef = useRef<(answer: string) => void>(() => {});
  const isProcessingAnswerRef = useRef(false);
  const answerProcessingUnlockTimerRef = useRef<number | null>(null);
  const pendingRecruiterReplyTimerRef = useRef<number | null>(null);
  const lastProcessedAnswerSignatureRef = useRef<string | null>(null);
  const lastProcessedAnswerAtRef = useRef(0);
  const listenSessionIdRef = useRef(0);
  const manualListenRequestedRef = useRef(false);
  const autoCinematicStartedRef = useRef(false);
  const mobileAudioUnlockedRef = useRef(false);
  const mobileTtsAudioRef = useRef<HTMLAudioElement | null>(null);
  const mobileTtsObjectUrlRef = useRef<string | null>(null);
  const vapiClientRef = useRef<WorkZoVapiClient | null>(null);
  const vapiCallActiveRef = useRef(false);
  const vapiStartingRef = useRef(false);
  const vapiFallbackActivatedRef = useRef(false);
  const lastVapiStartRef = useRef(0);
  const vapiTranscriptKeysRef = useRef<Set<string>>(new Set());
  const [voiceProvider, setVoiceProvider] = useState<"vapi" | "tts-fallback">(
    "tts-fallback",
  );

  useEffect(() => {
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;

    const shouldSuppressVapiConsoleNoise = (args: unknown[]) =>
      args.some((arg) => {
        if (isBenignVapiEndedError(arg)) return true;

        const text =
          typeof arg === "string"
            ? arg
            : arg instanceof Error
              ? `${arg.name} ${arg.message} ${arg.stack || ""}`
              : (() => {
                  try {
                    return JSON.stringify(arg);
                  } catch {
                    return String(arg || "");
                  }
                })();

        return /meeting ended due to ejection|meeting has ended|daily-js.*meeting|call ended|room.*not.*found|no-room|krisp processor|krispiniterror|error applying mic processor|audioworkletnode|no execution context available|wasm_or_worker_not_ready|error unloading krisp/i.test(
          text,
        );
      });

    console.error = (...args: unknown[]) => {
      if (shouldSuppressVapiConsoleNoise(args)) {
        console.info("Suppressed benign Vapi/Daily end log", ...args);
        return;
      }
      originalConsoleError(...args);
    };

    console.warn = (...args: unknown[]) => {
      if (shouldSuppressVapiConsoleNoise(args)) {
        console.info("Suppressed benign Vapi/Daily warning", ...args);
        return;
      }
      originalConsoleWarn(...args);
    };

    const suppressBenignVapiRejection = (event: PromiseRejectionEvent) => {
      const shouldSuppress =
        isBenignVapiEndedError(event.reason) ||
        shouldSuppressVapiConsoleNoise([event.reason]);

      if (!shouldSuppress) return;

      event.preventDefault();
      safeLogVapiIssue(
        "Suppressed benign Vapi/Daily audio cleanup event",
        event.reason,
      );

      // Do not switch to browser fallback for benign Daily/Vapi startup noise.
      // Keep Vapi as the primary voice unless the explicit Vapi start call
      // or Vapi error handler reports a hard failure.
      if (vapiStartingRef.current && !vapiCallActiveRef.current) {
        setVoiceStatus("Vapi recruiter voice is still connecting...");
      }
    };

    const suppressBenignVapiWindowError = (event: ErrorEvent) => {
      const error = event.error || event.message;
      const shouldSuppress =
        isBenignVapiEndedError(error) ||
        shouldSuppressVapiConsoleNoise([error, event.message]);

      if (!shouldSuppress) return;

      event.preventDefault();
      safeLogVapiIssue(
        "Suppressed benign Vapi/Daily audio cleanup window error",
        error,
      );

      // Do not switch to browser fallback for benign Daily/Vapi startup noise.
      // Keep Vapi as the primary voice unless the explicit Vapi start call
      // or Vapi error handler reports a hard failure.
      if (vapiStartingRef.current && !vapiCallActiveRef.current) {
        setVoiceStatus("Vapi recruiter voice is still connecting...");
      }
    };

    window.addEventListener("unhandledrejection", suppressBenignVapiRejection);
    window.addEventListener("error", suppressBenignVapiWindowError);

    return () => {
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
      window.removeEventListener(
        "unhandledrejection",
        suppressBenignVapiRejection,
      );
      window.removeEventListener("error", suppressBenignVapiWindowError);
    };
  }, []);

  const cleanupMobileTtsUrl = useCallback(() => {
    if (mobileTtsObjectUrlRef.current) {
      try {
        URL.revokeObjectURL(mobileTtsObjectUrlRef.current);
      } catch {}
      mobileTtsObjectUrlRef.current = null;
    }
  }, []);

  const recruiterProfile = useMemo(
    () => getRecruiterVoiceProfile(activeSetup.recruiterPersonality),
    [activeSetup.recruiterPersonality],
  );

  const recruiterId = activeSetup.recruiterPersonality as RecruiterId;
  const role = getRole(activeSetup);
  const company = getCompany(activeSetup);
  const market = activeSetup.targetMarket || "Global";
  const candidateName = getCandidateName(activeSetup);

  const getLockedBrowserVoice = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return null;

    const runtimeVoice = recruiterRuntimeVoice(recruiterId);
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;

    if (lockedVoiceRecruiterRef.current !== recruiterId) {
      lockedVoiceRecruiterRef.current = recruiterId;
      lockedVoiceSignatureRef.current = null;
    }

    const lockedSignature = lockedVoiceSignatureRef.current;
    if (lockedSignature) {
      const locked =
        voices.find(
          (voice) => browserVoiceSignature(voice) === lockedSignature,
        ) ||
        voices.find((voice) => lockedSignature.startsWith(`${voice.name}|||`));

      if (locked && voiceMatchesRuntimeGender(locked, runtimeVoice)) {
        return locked;
      }

      lockedVoiceSignatureRef.current = null;
    }

    let selected = selectBrowserVoice(recruiterId);

    if (selected && !voiceMatchesRuntimeGender(selected, runtimeVoice)) {
      const englishVoices = voices.filter((voice) =>
        voice.lang?.toLowerCase().startsWith("en"),
      );
      const pool = englishVoices.length ? englishVoices : voices;
      selected =
        runtimeVoice.gender === "female"
          ? pool.find(isLikelyFemaleVoice) ||
            voices.find(isLikelyFemaleVoice) ||
            pool.find((voice) => !isLikelyMaleVoice(voice)) ||
            null
          : pool.find(isLikelyMaleVoice) ||
            voices.find(isLikelyMaleVoice) ||
            null;
    }

    if (selected) {
      lockedVoiceSignatureRef.current = browserVoiceSignature(selected);
      lockedVoiceRecruiterRef.current = recruiterId;
    }

    return selected;
  }, [recruiterId]);

  useEffect(() => {
    lockedVoiceSignatureRef.current = null;
    lockedVoiceRecruiterRef.current = recruiterId;
  }, [recruiterId]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    // Warm browser voices before the first recruiter sentence.
    // This prevents Chrome/Edge from using a random default voice on the first attempt.
    const warmVoices = () => {
      window.speechSynthesis.getVoices();
      getLockedBrowserVoice();
    };

    warmVoices();
    window.speechSynthesis.addEventListener("voiceschanged", warmVoices);

    const warmTimer = window.setTimeout(warmVoices, 900);

    return () => {
      window.clearTimeout(warmTimer);
      window.speechSynthesis.removeEventListener("voiceschanged", warmVoices);
    };
  }, [getLockedBrowserVoice]);

  useEffect(() => {
    clearExpiredInterviewState();
    touchWorkZoSession();

    const latest = normalizeSetup(readLatestInterviewSetup());
    setActiveSetup(latest);

    const savedMemory = loadRecruiterMemory();
    setRecruiterMemory(savedMemory);
    setRecruiterTrust(savedMemory.recruiterTrust || 58);

    setIsHydrated(true);
    const mobileRuntime = isMobileBrowserRuntime();
    setNeedsMobileAudioStart(mobileRuntime);
    setHasUnlockedMobileAudio(!mobileRuntime);
    mobileAudioUnlockedRef.current = !mobileRuntime;

    trackWorkZoEvent({
      event: "interview_room_viewed",
      setupId: latest.setupId,
      role: getRole(latest),
      market: latest.targetMarket,
      recruiter: getRecruiterVoiceProfile(latest.recruiterPersonality).name,
    });

    return () => {
      isLiveRef.current = false;
      if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
      if (finalizationTimerRef.current)
        window.clearTimeout(finalizationTimerRef.current);
      if (answerProcessingUnlockTimerRef.current)
        window.clearTimeout(answerProcessingUnlockTimerRef.current);
      if (pendingRecruiterReplyTimerRef.current)
        window.clearTimeout(pendingRecruiterReplyTimerRef.current);
      try {
        recognitionRef.current?.abort?.();
        recognitionRef.current?.stop();
      } catch {}
      window.speechSynthesis?.cancel();
      try {
        mobileTtsAudioRef.current?.pause();
      } catch {}
      cleanupMobileTtsUrl();
      try {
        vapiClientRef.current?.stop?.();
      } catch {}
      vapiCallActiveRef.current = false;
    };
  }, [cleanupMobileTtsUrl]);

  useEffect(() => {
    if (!isLive) return;
    const timer = window.setInterval(() => {
      setElapsed((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isLive]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    questionRef.current = question;
  }, [question]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    memoryRef.current = recruiterMemory;
  }, [recruiterMemory]);

  useEffect(() => {
    trustRef.current = recruiterTrust;
  }, [recruiterTrust]);

  useEffect(() => {
    recruiterStateRef.current = recruiterState;
  }, [recruiterState]);

  const addTranscript = useCallback((item: TranscriptItem) => {
    setTranscript((items) => [...items, item].slice(-40));
  }, []);

  const playRecruiterMobileTts = useCallback(
    async (text: string, afterSpeak?: () => void) => {
      if (typeof window === "undefined" || !speakerOn) {
        afterSpeak?.();
        return;
      }

      try {
        recognitionRef.current?.abort?.();
        recognitionRef.current?.stop();
      } catch {}

      if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
      if (finalizationTimerRef.current)
        window.clearTimeout(finalizationTimerRef.current);
      pendingAnswerRef.current = "";
      setIsListening(false);
      isSpeakingRef.current = true;
      setIsSpeaking(true);
      setVoiceStatus("Recruiter speaking...");
      const spokenText = humanizeRecruiterSpokenText(text, {
        recruiterId,
        recruiterState: recruiterStateRef.current,
        allowFiller: true,
      });

      let didFinish = false;
      let finishTimer: number | null = null;

      const finish = () => {
        if (didFinish) return;
        didFinish = true;
        if (finishTimer) window.clearTimeout(finishTimer);
        try {
          mobileTtsAudioRef.current?.pause();
        } catch {}
        cleanupMobileTtsUrl();
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        setIsListening(false);
        setVoiceStatus("Your turn — answer naturally");
        afterSpeak?.();
      };

      try {
        cleanupMobileTtsUrl();
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: spokenText,
            voice: openAiVoiceIdForRecruiter(recruiterId),
            recruiterId,
            recruiterState: recruiterStateRef.current,
            mode: "fallback_tts",
          }),
        });

        if (!response.ok) throw new Error("TTS request failed");

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        mobileTtsObjectUrlRef.current = objectUrl;

        const audio = mobileTtsAudioRef.current || new Audio();
        mobileTtsAudioRef.current = audio;
        audio.preload = "auto";
        (audio as HTMLAudioElement & { playsInline?: boolean }).playsInline =
          true;
        audio.muted = false;
        audio.volume = 1;
        audio.src = objectUrl;
        audio.onended = finish;
        audio.onerror = finish;

        finishTimer = window.setTimeout(
          finish,
          Math.min(18000, Math.max(2600, spokenText.split(/\s+/).length * 260)),
        );

        await audio.play();
      } catch (error) {
        // Keep the flow moving even if iOS blocks audio or the TTS endpoint fails.
        // The transcript still shows the recruiter line and the mic opens after a short pause.
        console.warn("WorkZo mobile TTS failed", error);
        finishTimer = window.setTimeout(finish, 900);
      }
    },
    [cleanupMobileTtsUrl, recruiterId, speakerOn],
  );

  const speakRecruiter = useCallback(
    (text: string, afterSpeak?: () => void) => {
      // When Vapi is active, Vapi owns the recruiter voice. Never also speak
      // with browser/server TTS, because that creates slow duplicated turns.
      if (vapiCallActiveRef.current || voiceProvider === "vapi") {
        afterSpeak?.();
        return;
      }

      if (
        typeof window === "undefined" ||
        !window.speechSynthesis ||
        !speakerOn
      ) {
        afterSpeak?.();
        return;
      }

      const spokenText = humanizeRecruiterSpokenText(text, {
        recruiterId,
        recruiterState: recruiterStateRef.current,
        allowFiller: true,
      });

      // On iOS/mobile, browser SpeechSynthesis is unreliable and often goes silent
      // after mic permission. Use server TTS + HTMLAudioElement instead.
      if (isMobileBrowserRuntime()) {
        void playRecruiterMobileTts(spokenText, afterSpeak);
        return;
      }

      // IMPORTANT: never let the microphone listen while the recruiter is speaking.
      // Mobile browsers often mute/duck speech output if recognition is already active.
      try {
        recognitionRef.current?.abort?.();
        recognitionRef.current?.stop();
      } catch {}

      if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
      if (finalizationTimerRef.current)
        window.clearTimeout(finalizationTimerRef.current);
      pendingAnswerRef.current = "";

      window.speechSynthesis.cancel();
      setIsListening(false);

      const isMobileBrowser = isMobileBrowserRuntime();
      const isIOSBrowser = isIOSBrowserRuntime();

      let didFinish = false;
      let finishTimer: number | null = null;

      const finishSpeech = () => {
        if (didFinish) return;
        didFinish = true;
        if (finishTimer) window.clearTimeout(finishTimer);
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        setIsListening(false);
        setVoiceStatus("Your turn — answer naturally");
        afterSpeak?.();
      };

      const speakNow = (allowVoiceWait = false) => {
        try {
          window.speechSynthesis.resume?.();
        } catch {}
        const utterance = new SpeechSynthesisUtterance(spokenText);
        utterance.lang = "en-US";
        const runtimeVoice = recruiterRuntimeVoice(recruiterId);
        const voice = getLockedBrowserVoice();

        // For female recruiters, avoid a browser-default male fallback mid-session.
        // If no clearly female browser voice is available yet, keep the recruiter
        // in a short visual "speaking/preparing" state instead of jumping straight
        // to listening with a random male/default voice.
        if (!voice && runtimeVoice.gender === "female" && !isMobileBrowser) {
          setVoiceStatus("Preparing recruiter voice...");
          isSpeakingRef.current = true;
          setIsSpeaking(true);
          setIsListening(false);
          window.setTimeout(() => {
            const retryVoice = getLockedBrowserVoice();
            if (retryVoice && !didFinish) {
              const retry = new SpeechSynthesisUtterance(spokenText);
              retry.lang = "en-US";
              retry.voice = retryVoice;
              retry.pitch = getBrowserSpeechPitch({
                basePitch: runtimeVoice.pitch,
                recruiterId,
                recruiterState: recruiterStateRef.current,
              });
              retry.rate = getBrowserSpeechRate({
                baseRate: runtimeVoice.rate,
                recruiterId,
                recruiterState: recruiterStateRef.current,
              });
              retry.volume = 1;
              retry.onstart = () => {
                isSpeakingRef.current = true;
                setIsSpeaking(true);
                setIsListening(false);
                setVoiceStatus("Recruiter speaking...");
              };
              retry.onend = finishSpeech;
              retry.onerror = finishSpeech;
              window.speechSynthesis.cancel();
              window.speechSynthesis.speak(retry);
              return;
            }
            finishSpeech();
          }, 350);
          return;
        }

        // On mobile, do not wait for a preferred voice. Waiting can break the
        // user-gesture audio chain and make speech silent. Use the best available
        // voice immediately, or the browser default.
        if (voice) utterance.voice = voice;

        utterance.pitch = getBrowserSpeechPitch({
          basePitch: runtimeVoice.pitch,
          recruiterId,
          recruiterState: recruiterStateRef.current,
        });
        utterance.rate = getBrowserSpeechRate({
          baseRate: runtimeVoice.rate,
          recruiterId,
          recruiterState: recruiterStateRef.current,
        });
        utterance.volume = 1;

        try {
          console.info("WorkZo recruiter speech", {
            recruiterId,
            expectedVoice: runtimeVoice.voiceId,
            browserVoice: voice?.name || "browser-default",
            mobile: isMobileBrowser,
          });
        } catch {}

        isSpeakingRef.current = true;
        setIsSpeaking(true);
        setIsListening(false);
        setVoiceStatus("Recruiter speaking...");

        const estimatedMs = Math.min(
          22000,
          Math.max(2200, spokenText.split(/\s+/).length * 240),
        );
        finishTimer = window.setTimeout(finishSpeech, estimatedMs + 500);

        utterance.onstart = () => {
          isSpeakingRef.current = true;
          setIsSpeaking(true);
          setIsListening(false);
          setVoiceStatus("Recruiter speaking...");
        };

        utterance.onend = finishSpeech;

        utterance.onerror = () => {
          // If a selected voice fails, retry once with the browser default.
          // Do not immediately start listening, otherwise mobile appears silent.
          if (voice && allowVoiceWait) {
            try {
              const fallbackVoice = getLockedBrowserVoice();
              if (!fallbackVoice && runtimeVoice.gender === "female") {
                finishSpeech();
                return;
              }
              const fallback = new SpeechSynthesisUtterance(spokenText);
              fallback.lang = "en-US";
              if (fallbackVoice) fallback.voice = fallbackVoice;
              fallback.pitch = getBrowserSpeechPitch({
                basePitch: runtimeVoice.pitch,
                recruiterId,
                recruiterState: recruiterStateRef.current,
              });
              fallback.rate = getBrowserSpeechRate({
                baseRate: runtimeVoice.rate,
                recruiterId,
                recruiterState: recruiterStateRef.current,
              });
              fallback.volume = 1;
              fallback.onend = finishSpeech;
              fallback.onerror = finishSpeech;
              window.speechSynthesis.cancel();
              window.speechSynthesis.speak(fallback);
              return;
            } catch {}
          }
          finishSpeech();
        };

        window.speechSynthesis.speak(utterance);
        if (isIOSBrowser) {
          // Safari sometimes pauses speech right after speak(); resume twice,
          // but never cancel here.
          window.setTimeout(() => {
            try {
              window.speechSynthesis.resume?.();
            } catch {}
          }, 60);
          window.setTimeout(() => {
            try {
              window.speechSynthesis.resume?.();
            } catch {}
          }, 220);
        }
      };

      const voices = window.speechSynthesis.getVoices();
      const selectedVoice = getLockedBrowserVoice();

      if (!isMobileBrowser && (!voices.length || !selectedVoice)) {
        let didSpeak = false;
        const speakOnce = () => {
          if (didSpeak) return;
          didSpeak = true;
          window.speechSynthesis.removeEventListener(
            "voiceschanged",
            speakOnce,
          );
          speakNow(true);
        };

        window.speechSynthesis.addEventListener("voiceschanged", speakOnce);
        window.setTimeout(speakOnce, 500);
        return;
      }

      speakNow(true);
    },
    [
      getLockedBrowserVoice,
      playRecruiterMobileTts,
      recruiterId,
      speakerOn,
      voiceProvider,
    ],
  );

  const listenForAnswer = useCallback(() => {
    if (!isLiveRef.current || isSpeakingRef.current) return;

    // Standard mode stays intentional: recruiter speaks → user taps mic.
    // Cinematic Live is pseudo-live: after recruiter speech, listening opens automatically
    // so the candidate can respond naturally without clicking the mic every turn.
    const autoListenEnabled =
      modeRef.current === "video" ||
      !isMobileBrowserRuntime() ||
      mobileAudioUnlockedRef.current;
    if (!manualListenRequestedRef.current && !autoListenEnabled) {
      setIsListening(false);
      setVoiceStatus("Your turn — answer naturally");
      return;
    }
    manualListenRequestedRef.current = false;

    const Recognition = getRecognitionConstructor();
    if (!Recognition) {
      setVoiceStatus(
        "Browser speech recognition is unavailable. Type mode coming soon.",
      );
      return;
    }

    try {
      recognitionRef.current?.abort?.();
      recognitionRef.current?.stop();
    } catch {}

    if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
    if (finalizationTimerRef.current)
      window.clearTimeout(finalizationTimerRef.current);
    pendingAnswerRef.current = "";

    const listenSessionId = listenSessionIdRef.current + 1;
    listenSessionIdRef.current = listenSessionId;

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = activeSetup.language?.toLowerCase().startsWith("de")
      ? "de-DE"
      : "en-US";

    recognition.onstart = () => {
      if (listenSessionIdRef.current !== listenSessionId) {
        try {
          recognition.abort?.();
          recognition.stop();
        } catch {}
        return;
      }
      if (isSpeakingRef.current || isProcessingAnswerRef.current) {
        try {
          recognition.abort?.();
          recognition.stop();
        } catch {}
        return;
      }
      setIsListening(true);
      setVoiceStatus("Listening to your answer");
      if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = window.setTimeout(() => {
        if (listenSessionIdRef.current !== listenSessionId) return;
        if (
          !isLiveRef.current ||
          isSpeakingRef.current ||
          isProcessingAnswerRef.current
        )
          return;
        setVoiceStatus("Take your time — answer naturally");
      }, 5000);
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      const error = event.error || "";
      if (error === "no-speech") {
        setVoiceStatus(
          modeRef.current === "video"
            ? "Still listening — speak naturally"
            : "I’m still listening. Try answering again.",
        );
        if (modeRef.current === "video" && !isMobileBrowserRuntime())
          window.setTimeout(() => {
            if (
              listenSessionIdRef.current === listenSessionId &&
              !isProcessingAnswerRef.current
            ) {
              listenForAnswer();
            }
          }, 900);
        return;
      }
      if (error === "not-allowed") {
        setVoiceStatus("Microphone permission blocked.");
        return;
      }
      setVoiceStatus("Listening paused. Tap mic to continue.");
    };

    recognition.onend = () => {
      setIsListening(false);
      if (
        listenSessionIdRef.current === listenSessionId &&
        isLiveRef.current &&
        !isSpeakingRef.current &&
        !isProcessingAnswerRef.current &&
        !pendingAnswerRef.current
      ) {
        setVoiceStatus("Waiting for your answer...");
      }
    };

    recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
      if (listenSessionIdRef.current !== listenSessionId) return;
      if (isSpeakingRef.current || isProcessingAnswerRef.current) return;

      let transcriptText = "";
      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        transcriptText += event.results[index][0].transcript;
      }

      const clean = transcriptText.replace(/\s+/g, " ").trim();
      if (!clean) return;

      pendingAnswerRef.current = clean;
      setVoiceStatus("Listening — finish your answer naturally");

      if (finalizationTimerRef.current) {
        window.clearTimeout(finalizationTimerRef.current);
      }

      finalizationTimerRef.current = window.setTimeout(() => {
        if (listenSessionIdRef.current !== listenSessionId) return;
        if (isProcessingAnswerRef.current || isSpeakingRef.current) return;
        const finalAnswer = pendingAnswerRef.current.trim();
        const wordCount = finalAnswer.split(/\s+/).filter(Boolean).length;

        if (!finalAnswer || wordCount < 5) {
          setVoiceStatus("Continue your answer naturally");
          return;
        }

        pendingAnswerRef.current = "";
        try {
          recognition.stop();
        } catch {}

        setIsListening(false);
        handleCandidateAnswerRef.current(finalAnswer);
      }, 750);
    };

    recognitionRef.current = recognition;

    // Start recognition only after recruiter speech has fully ended.
    window.setTimeout(() => {
      if (listenSessionIdRef.current !== listenSessionId) return;
      if (
        !isLiveRef.current ||
        isSpeakingRef.current ||
        isProcessingAnswerRef.current
      )
        return;
      try {
        recognition.start();
      } catch {
        setVoiceStatus("Listening paused. Tap mic to continue.");
      }
    }, 50);
  }, [activeSetup.language]);

  const handleCandidateAnswer = useCallback(
    async (answer: string) => {
      if (!isLiveRef.current) return;

      const cleanAnswer = answer.replace(/\s+/g, " ").trim();
      const wordCount = cleanAnswer.split(/\s+/).filter(Boolean).length;

      if (!cleanAnswer || wordCount < 5) {
        setVoiceStatus("Continue your answer naturally");
        return;
      }

      const latestRecruiterQuestion = [...transcriptRef.current]
        .reverse()
        .find(
          (item) =>
            item.role === "recruiter" &&
            /\?|tell me|walk me|describe|why|what|how|give me|can you/i.test(
              item.text || "",
            ),
        )?.text;

      // v75: use the latest recruiter spoken line as the active question and
      // lock each candidate turn to that question. This prevents partial speech
      // results or duplicate browser recognition events from re-processing the
      // same answer and causing the recruiter to repeat the intro question.
      const currentQuestion =
        latestRecruiterQuestion?.replace(/\s+/g, " ").trim() ||
        questionRef.current;
      const turnSignature = buildTurnSignature(currentQuestion, cleanAnswer);

      if (
        isProcessingAnswerRef.current ||
        isDuplicateCandidateTurn(
          lastProcessedAnswerSignatureRef.current,
          turnSignature,
          lastProcessedAnswerAtRef.current,
        )
      ) {
        setVoiceStatus("Recruiter is already processing your answer...");
        return;
      }

      isProcessingAnswerRef.current = true;
      lastProcessedAnswerSignatureRef.current = turnSignature;
      lastProcessedAnswerAtRef.current = Date.now();
      listenSessionIdRef.current += 1;

      if (answerProcessingUnlockTimerRef.current) {
        window.clearTimeout(answerProcessingUnlockTimerRef.current);
      }
      answerProcessingUnlockTimerRef.current = window.setTimeout(() => {
        isProcessingAnswerRef.current = false;
      }, 26000);

      try {
        recognitionRef.current?.abort?.();
        recognitionRef.current?.stop();
      } catch {}
      if (finalizationTimerRef.current)
        window.clearTimeout(finalizationTimerRef.current);
      if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
      if (pendingRecruiterReplyTimerRef.current)
        window.clearTimeout(pendingRecruiterReplyTimerRef.current);
      pendingAnswerRef.current = "";
      setIsListening(false);

      const candidateItem: TranscriptItem = {
        role: "candidate",
        text: cleanAnswer,
        time: timeLabel(),
      };

      addTranscript(candidateItem);

      const currentTranscript = [...transcriptRef.current, candidateItem];
      const previousTrust = trustRef.current;
      const currentMemory = memoryRef.current;

      setVoiceStatus("Recruiter is thinking...");

      let intelligence: UnifiedRecruiterApiResponse | null = null;

      // v73 safety guard: answer audio checks / name questions locally before any
      // analysis can misread them as interview evidence. This protects the live flow
      // even if the API/LLM returns an over-eager interview follow-up.
      if (isEarlyMultiIntentRapport(cleanAnswer)) {
        const targetRole = getRole(activeSetup);
        intelligence = {
          question: buildEarlyMultiIntentRapportReply(
            cleanAnswer,
            recruiterProfile.name,
            targetRole,
          ),
          displayQuestion: `Tell me a little about yourself and connect your recent experience to ${targetRole}.`,
          feedback: "Handled rapport/audio/name turn without scoring.",
          intent: "smalltalk",
          shouldAdvanceQuestion: false,
          shouldCountAsAnswer: false,
          shouldStayOnCurrentQuestion: true,
          trustDelta: 0,
          recruiterState: "interested",
        };
      }

      if (!intelligence)
        try {
          const interviewApiController = new AbortController();
          const interviewApiTimeout = window.setTimeout(() => {
            interviewApiController.abort();
          }, 7000);

          const response = await fetch("/api/interview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: interviewApiController.signal,
            body: JSON.stringify({
              answer: cleanAnswer,
              currentQuestion,
              transcript: currentTranscript,
              setup: activeSetup,
              cvText: activeSetup.cvText || "",
              jobDescription: activeSetup.jobDescription || "",
              targetRole: getRole(activeSetup),
              targetMarket: activeSetup.targetMarket || "Global",
              companyStyle: activeSetup.companyStyle || "Global Corporate",
              recruiterPersonality:
                activeSetup.recruiterPersonality || recruiterId,
              recruiterTrust: previousTrust,
              recruiterState: recruiterStateRef.current,
            }),
          });

          window.clearTimeout(interviewApiTimeout);

          if (response.ok) {
            intelligence =
              (await response.json()) as UnifiedRecruiterApiResponse;
          }
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            console.warn(
              "WorkZo interview AI response was slow; using local recruiter fallback for this turn.",
            );
          }
          intelligence = null;
        }

      const fallbackAnalysis = analyzeAnswer(
        cleanAnswer,
        currentMemory,
        previousTrust,
        recruiterId,
        currentQuestion,
      );

      let spokenReply =
        intelligence?.question?.replace(/\s+/g, " ").trim() ||
        buildConversationalRecruiterSpeech({
          recruiterId,
          candidateName,
          screenQuestion: fallbackAnalysis.followUp,
          bridge: fallbackAnalysis.bridge,
          memory: currentMemory,
          state: fallbackAnalysis.state,
          trust: previousTrust,
        });

      let displayQuestion =
        intelligence?.displayQuestion?.replace(/\s+/g, " ").trim() ||
        fallbackAnalysis.followUp;

      const fallbackShouldCountAsAnswer =
        fallbackAnalysis.signal === "strong_metrics" ||
        fallbackAnalysis.signal === "good_ownership" ||
        fallbackAnalysis.signal === "recovery";

      const shouldCountAsAnswer =
        typeof intelligence?.shouldCountAsAnswer === "boolean"
          ? intelligence.shouldCountAsAnswer
          : fallbackShouldCountAsAnswer;
      const trustDelta =
        typeof intelligence?.trustDelta === "number"
          ? intelligence.trustDelta
          : fallbackAnalysis.trustDelta;
      const nextTrust = Math.max(12, Math.min(92, previousTrust + trustDelta));
      const nextState = intelligence?.recruiterState || fallbackAnalysis.state;

      if (
        shouldCountAsAnswer &&
        isProbablySameRecruiterPrompt(spokenReply, currentQuestion)
      ) {
        const repairedFollowUp =
          fallbackAnalysis.followUp ||
          fallbackQuestions[answeredQuestionCount % fallbackQuestions.length];
        spokenReply = `${fallbackAnalysis.bridge} ${repairedFollowUp}`
          .replace(/\s+/g, " ")
          .trim();
        displayQuestion = repairedFollowUp;
      }

      let nextMemory = currentMemory;

      if (intelligence?.recruiterMemory) {
        const apiMemory = intelligence.recruiterMemory;

        nextMemory = {
          ...currentMemory,
          recruiterTrust: nextTrust,
          lastReaction:
            intelligence.feedback ||
            apiMemory.summary ||
            currentMemory.lastReaction ||
            "Recruiter updated memory.",

          rememberedWeaknesses: Array.from(
            new Set([
              ...(apiMemory.weakMoments || []),
              ...(apiMemory.openDoubts || []),
              ...(currentMemory.rememberedWeaknesses || []),
            ]),
          ).slice(0, 5),

          rememberedStrengths: Array.from(
            new Set([
              ...(apiMemory.strongMoments || []),
              ...(apiMemory.roleFitSignals || []),
              ...(currentMemory.rememberedStrengths || []),
            ]),
          ).slice(0, 5),

          weakMetrics:
            currentMemory.weakMetrics +
            ((apiMemory.weakMoments || []).some((item) =>
              /metric|number|impact|measurable/i.test(item),
            )
              ? 1
              : 0),

          ownershipIssues:
            currentMemory.ownershipIssues +
            ((apiMemory.weakMoments || []).some((item) =>
              /ownership|personally|contribution/i.test(item),
            )
              ? 1
              : 0),

          vagueAnswers:
            currentMemory.vagueAnswers +
            ((apiMemory.weakMoments || []).some((item) =>
              /vague|generic|unclear|broad/i.test(item),
            )
              ? 1
              : 0),

          strongRecoveries:
            currentMemory.strongRecoveries +
            ((apiMemory.strongMoments || []).length > 0 ? 1 : 0),
        };
      } else if (shouldCountAsAnswer) {
        try {
          const signals = updateRecruiterMemory(currentMemory, cleanAnswer);
          nextMemory = {
            ...signals.memory,
            recruiterTrust: nextTrust,
            lastReaction: intelligence?.feedback || signals.reaction,
          };
        } catch {
          nextMemory = {
            ...currentMemory,
            recruiterTrust: nextTrust,
            lastReaction: intelligence?.feedback || fallbackAnalysis.caption,
          };
        }
      } else {
        nextMemory = {
          ...currentMemory,
          recruiterTrust: nextTrust,
          lastReaction:
            intelligence?.feedback ||
            "Recruiter handled the conversation without counting it as an answer.",
        };
      }

      if (shouldCountAsAnswer) {
        setAnsweredQuestionCount((count) => Math.min(12, count + 1));
      }

      setRecruiterTrust(nextTrust);
      setRecruiterState(nextState);
      setRecruiterMemory(nextMemory);
      saveRecruiterMemory(nextMemory);
      setVoiceStatus(
        intelligence?.intent === "candidate_question"
          ? "Recruiter is answering briefly..."
          : intelligence?.intent === "clarification" ||
              intelligence?.intent === "smalltalk" ||
              intelligence?.intent === "greeting"
            ? "Recruiter is guiding the conversation..."
            : intelligence?.intent === "possible_exaggeration" ||
                intelligence?.intent === "nonsense" ||
                intelligence?.intent === "contradiction"
              ? "Recruiter is checking realism..."
              : shouldCountAsAnswer
                ? intelligence?.conversationStage === "background" ||
                  intelligence?.conversationStage === "role_fit"
                  ? "Recruiter is building the conversation..."
                  : "Recruiter accepted the answer..."
                : "Recruiter is staying on this question...",
      );

      const apiPause =
        typeof intelligence?.cinematicRealism?.pauseBeforeSpeakingMs ===
        "number"
          ? intelligence.cinematicRealism.pauseBeforeSpeakingMs
          : null;

      const baseThinkingDelay = calculateWorkZoThinkingPauseMs({
        text: spokenReply,
        recruiterId,
        recruiterState: nextState,
        isFollowUp: shouldCountAsAnswer,
        apiPauseMs: apiPause,
      });

      const thinkingDelay =
        modeRef.current === "video"
          ? Math.min(baseThinkingDelay, 220)
          : Math.min(baseThinkingDelay, 340);

      pendingRecruiterReplyTimerRef.current = window.setTimeout(() => {
        if (!isLiveRef.current) {
          isProcessingAnswerRef.current = false;
          return;
        }

        const recruiterReply: TranscriptItem = {
          role: "recruiter",
          text: spokenReply,
          time: timeLabel(),
        };

        addTranscript(recruiterReply);
        setQuestion(displayQuestion);
        speakRecruiter(spokenReply, () => {
          if (answerProcessingUnlockTimerRef.current) {
            window.clearTimeout(answerProcessingUnlockTimerRef.current);
            answerProcessingUnlockTimerRef.current = null;
          }
          isProcessingAnswerRef.current = false;
          window.setTimeout(() => listenForAnswer(), 120);
        });
      }, thinkingDelay);

      trackWorkZoLaunchEvent({
        event: "copilot_action_used",
        setupId: activeSetup.setupId,
        role,
        market,
        recruiter: recruiterProfile.name,
        mode: "voice",
        metadata: {
          action: "unified_recruiter_intelligence",
          intent: intelligence?.intent || "fallback",
          countedAsAnswer: shouldCountAsAnswer,
          trust: nextTrust,
          pressure: intelligence?.pressure?.level ?? null,
          pressureLabel: intelligence?.pressure?.label ?? null,
          pressureReason: intelligence?.pressure?.reason ?? null,
          recruiterMood:
            intelligence?.livePressureSimulation?.pressureMode ?? null,
          memoryRecall:
            intelligence?.recruiterMemoryInsight?.recallMode ?? null,
        },
      });
    },
    [
      activeSetup,
      addTranscript,
      answeredQuestionCount,
      candidateName,
      listenForAnswer,
      market,
      recruiterId,
      recruiterProfile.name,
      role,
      speakRecruiter,
    ],
  );

  useEffect(() => {
    handleCandidateAnswerRef.current = handleCandidateAnswer;
  }, [handleCandidateAnswer]);

  const stopVapiCall = useCallback(() => {
    try {
      vapiClientRef.current?.removeAllListeners?.();
    } catch {}
    try {
      vapiClientRef.current?.stop?.();
    } catch {}
    vapiCallActiveRef.current = false;
    vapiStartingRef.current = false;
    vapiFallbackActivatedRef.current = false;
    setVoiceProvider("tts-fallback");
  }, []);

  const startVapiInterview = useCallback(async () => {
    if (typeof window === "undefined") return false;

    const {
      buildWorkZoVapiVariableValues,
      createWorkZoVapiClient,
      getWorkZoVapiConfig,
      normalizeVapiTranscriptMessage,
    } = await import("@/lib/workzoVapiVoice");

    const config = getWorkZoVapiConfig(recruiterId, recruiterProfile.name);
    if (!config.enabled) return false;

    if (vapiCallActiveRef.current || vapiStartingRef.current) {
      setVoiceStatus("Vapi recruiter voice is already connecting...");
      return true;
    }

    const now = Date.now();
    if (now - lastVapiStartRef.current < 4000) {
      setVoiceStatus(
        "Vapi recruiter voice is still resetting. Please wait a moment...",
      );
      return true;
    }

    lastVapiStartRef.current = now;
    vapiStartingRef.current = true;
    vapiFallbackActivatedRef.current = false;

    try {
      const setup = saveLatestInterviewSetup(
        normalizeSetup(readLatestInterviewSetup()),
      );
      const profile = getRecruiterVoiceProfile(setup.recruiterPersonality);
      const memory = createInitialRecruiterMemory();

      resetLiveInterviewState();
      setActiveSetup(setup);
      setTranscript([]);
      setAnsweredQuestionCount(0);
      setElapsed(0);
      setRecruiterMemory(memory);
      setRecruiterTrust(memory.recruiterTrust || 58);
      setRecruiterState("interested");
      setQuestion("Live recruiter conversation");
      setVoiceStatus("Connecting to Vapi recruiter voice...");
      saveRecruiterMemory(memory);
      hasGreetedRef.current = true;
      interviewStepRef.current = "greeting";
      manualListenRequestedRef.current = false;
      isLiveRef.current = true;
      setIsLive(true);
      setVoiceProvider("vapi");
      setIsSpeaking(false);
      setIsListening(false);
      vapiTranscriptKeysRef.current = new Set();

      try {
        recognitionRef.current?.abort?.();
        recognitionRef.current?.stop();
      } catch {}
      try {
        window.speechSynthesis?.cancel?.();
      } catch {}
      try {
        mobileTtsAudioRef.current?.pause();
      } catch {}
      cleanupMobileTtsUrl();

      const client = await createWorkZoVapiClient(config.publicKey);
      try {
        vapiClientRef.current?.removeAllListeners?.();
      } catch {}
      try {
        vapiClientRef.current?.stop?.();
      } catch {}
      vapiClientRef.current = client;

      const markVapiEnded = (reason: string) => {
        vapiCallActiveRef.current = false;
        vapiStartingRef.current = false;
        setIsSpeaking(false);
        setIsListening(false);
        setVoiceStatus(reason);
      };

      const activateStartFallback = (reason: string) => {
        if (vapiFallbackActivatedRef.current) return;
        vapiFallbackActivatedRef.current = true;
        vapiCallActiveRef.current = false;
        vapiStartingRef.current = false;
        setVoiceProvider("tts-fallback");
        setIsSpeaking(false);
        setIsListening(false);
        setVoiceStatus(reason);
      };

      const onCallStart = () => {
        vapiStartingRef.current = false;
        vapiCallActiveRef.current = true;
        vapiFallbackActivatedRef.current = false;
        setVoiceProvider("vapi");
        setVoiceStatus("Vapi recruiter voice connected");
        setIsLive(true);
        isLiveRef.current = true;
      };

      const onCallEnd = () => {
        // Normal Vapi/Daily call-end should not trigger browser TTS takeover.
        // If the user selected Vapi mode, keep the modes separated and simply
        // mark the live voice session as ended.
        markVapiEnded("Vapi voice session ended");
      };

      const onSpeechStart = () => {
        setIsSpeaking(true);
        setIsListening(false);
        setVoiceStatus("Recruiter speaking...");
      };

      const onSpeechEnd = () => {
        setIsSpeaking(false);
        setIsListening(true);
        setVoiceStatus("Listening to your answer");
      };

      const onMessage = (message: unknown) => {
        const normalized = normalizeVapiTranscriptMessage(message);
        if (!normalized || !normalized.isFinal) return;

        const role = normalized.role === "user" ? "candidate" : "recruiter";
        const key = `${role}|${normalized.text}`.toLowerCase();
        if (vapiTranscriptKeysRef.current.has(key)) return;
        vapiTranscriptKeysRef.current.add(key);

        const item: TranscriptItem = {
          role,
          text: normalized.text,
          time: timeLabel(),
        };
        addTranscript(item);

        if (role === "candidate") {
          setVoiceStatus("Recruiter is preparing a reply...");
        } else {
          setQuestion(normalized.text);
          setVoiceStatus("Recruiter speaking...");
        }
      };

      const onError = (error: unknown) => {
        const message = getWorkZoVapiErrorMessage(error);
        const isEndedNoise = isBenignVapiEndedError(error);

        safeLogVapiIssue(
          isEndedNoise
            ? "WorkZo Vapi session ended; fallback remains available"
            : "WorkZo Vapi voice failed; fallback available",
          error,
        );

        if (vapiStartingRef.current && !vapiCallActiveRef.current) {
          if (isEndedNoise) {
            // Daily sometimes emits benign end/ejection noise while negotiating
            // devices on desktop. Do not immediately replace the real Vapi voice
            // with browser TTS unless Vapi explicitly hard-fails.
            setVoiceStatus("Vapi recruiter voice is still connecting...");
            return;
          }

          activateStartFallback(
            isVapiStartNetworkError(error)
              ? "Vapi network issue. Using reliable fallback voice."
              : "Vapi voice unavailable before connecting. Using reliable fallback voice.",
          );
        } else {
          markVapiEnded(
            isEndedNoise
              ? "Vapi voice session ended"
              : "Vapi voice disconnected",
          );
        }

        trackWorkZoLaunchEvent({
          event: "voice_error",
          setupId: setup.setupId,
          role: getRole(setup),
          market: setup.targetMarket || "Global",
          recruiter: profile.name,
          mode: "vapi",
          metadata: {
            provider: "vapi",
            fallback: "tts",
            reason: message || "unknown",
            endedNoise: isEndedNoise,
          },
        });
      };

      client.on?.("call-start", onCallStart);
      client.on?.("call-end", onCallEnd);
      client.on?.("call-ended", onCallEnd);
      client.on?.("call-end-error", onError);
      client.on?.("speech-start", onSpeechStart);
      client.on?.("speech-end", onSpeechEnd);
      client.on?.("message", onMessage);
      client.on?.("error", onError);

      const variableValues = buildWorkZoVapiVariableValues({
        candidateName: getCandidateName(setup),
        recruiterName: profile.name,
        recruiterRole: profile.role,
        targetRole: getRole(setup),
        targetMarket: setup.targetMarket || "Global",
        companyStyle: setup.companyStyle || "Realistic",
        companyName: getCompany(setup),
        cvText: setup.cvText || "",
        jobDescription: setup.jobDescription || "",
      });

      trackWorkZoLaunchEvent({
        event: "interview_started",
        setupId: setup.setupId,
        role: getRole(setup),
        market: setup.targetMarket || "Global",
        recruiter: profile.name,
        mode: "vapi",
        metadata: {
          provider: "vapi",
          fallbackAvailable: true,
          assistantId: config.assistantId,
          recruiterKey: config.recruiterKey,
        },
      });

      const vapiStarter = client as {
        start: (
          assistantId: string,
          assistantOverrides?: {
            variableValues?: Record<string, string>;
            recordingEnabled?: boolean;
            artifactPlan?: { videoRecordingEnabled?: boolean };
            backgroundSpeechDenoisingPlan?: {
              smartDenoisingPlan?: { enabled?: boolean };
              fourierDenoisingPlan?: {
                enabled?: boolean;
                mediaDetectionEnabled?: boolean;
              };
            };
          },
        ) => Promise<unknown>;
      };

      await vapiStarter.start(config.assistantId, {
        variableValues,
        recordingEnabled: false,
        artifactPlan: { videoRecordingEnabled: false },
        // WorkZo disables Vapi/Daily Krisp processing from the client override.
        // Krisp can fail in Chrome/Next dev/prod hydration with
        // "AudioWorkletNode cannot be created: No execution context available",
        // which then destabilizes the call. The assistant should use raw mic
        // audio + Vapi endpointing instead of client-side noise processing.
        backgroundSpeechDenoisingPlan: {
          smartDenoisingPlan: { enabled: false },
          fourierDenoisingPlan: {
            enabled: false,
            mediaDetectionEnabled: false,
          },
        },
      });
      setVoiceProvider("vapi");
      setVoiceStatus("Vapi connected. Waiting for recruiter...");

      window.setTimeout(() => {
        if (!isLiveRef.current) return;
        if (!vapiCallActiveRef.current && vapiStartingRef.current) {
          setVoiceStatus("Vapi connected. Waiting for recruiter...");
        }
      }, 12000);

      return true;
    } catch (error) {
      safeLogVapiIssue("WorkZo Vapi start failed; using TTS fallback", error);
      try {
        vapiClientRef.current?.removeAllListeners?.();
      } catch {}
      try {
        if (!isBenignVapiEndedError(error)) {
          vapiClientRef.current?.stop?.();
        }
      } catch {}
      vapiCallActiveRef.current = false;
      vapiStartingRef.current = false;
      vapiFallbackActivatedRef.current = true;
      isLiveRef.current = false;
      setIsLive(false);
      setIsSpeaking(false);
      setIsListening(false);
      setVoiceProvider("tts-fallback");
      setVoiceStatus(
        isBenignVapiEndedError(error)
          ? "Vapi meeting ended before connecting. Starting reliable fallback voice..."
          : isVapiStartNetworkError(error)
            ? "Vapi network issue. Starting reliable fallback voice..."
            : "Using reliable fallback voice...",
      );
      return false;
    }
  }, [addTranscript, cleanupMobileTtsUrl, recruiterId, recruiterProfile.name]);

  const startStandardInterview = useCallback(async () => {
    if (!isLiveRef.current && modeRef.current === "video") {
      const startedWithVapi = await startVapiInterview();
      if (startedWithVapi) return;
    }

    if (isMobileBrowserRuntime() && !mobileAudioUnlockedRef.current) {
      mobileAudioUnlockedRef.current = true;
      setHasUnlockedMobileAudio(true);
      setNeedsMobileAudioStart(false);
      void unlockMobileAudioForSpeech();
      // Keep the first recruiter speech close to the tap gesture on iOS Safari.
    }

    const setup = saveLatestInterviewSetup(
      normalizeSetup(readLatestInterviewSetup()),
    );
    setActiveSetup(setup);

    // Do not start microphone before the recruiter speaks.
    // On mobile, active mic/recognition can suppress browser speech output.

    const profile = getRecruiterVoiceProfile(setup.recruiterPersonality);
    const recruiterVoiceId = openAiVoiceIdForRecruiter(
      setup.recruiterPersonality as RecruiterId,
    );
    const browserVoice = selectBrowserVoice(
      setup.recruiterPersonality as RecruiterId,
    );
    try {
      console.info("WorkZo recruiter voice mapping", {
        recruiter: profile.name,
        expectedDashboardVoice: recruiterVoiceId,
        browserVoice: browserVoice?.name || "browser-default",
        mode: "voice",
        note: "Standard Interview uses browser speech for stability. Vapi dashboard voice changes apply only to Live Interview.",
      });
    } catch {}
    const memory = createInitialRecruiterMemory();
    const openingInsight = buildOpeningWowMoment({
      recruiterName: profile.name,
      role: getRole(setup),
      cvText: setup.cvText || "",
    });
    const firstQuestion = "Hi, how are you today?";
    const spokenOpening = buildConversationalRecruiterSpeech({
      recruiterId: setup.recruiterPersonality as RecruiterId,
      candidateName: getCandidateName(setup),
      screenQuestion: firstQuestion,
      memory,
      state: "interested",
      trust: memory.recruiterTrust || 58,
      isOpening: true,
    });

    resetLiveInterviewState();
    setTranscript([]);
    setAnsweredQuestionCount(0);
    setElapsed(0);
    setRecruiterMemory(memory);
    setRecruiterTrust(memory.recruiterTrust || 58);
    setRecruiterState("interested");
    setQuestion(firstQuestion);
    setVoiceStatus(
      modeRef.current === "video"
        ? "Cinematic recruiter opening..."
        : "Recruiter opening...",
    );
    saveRecruiterMemory(memory);
    hasGreetedRef.current = true;
    interviewStepRef.current = "greeting";
    manualListenRequestedRef.current = false;
    isLiveRef.current = true;
    setIsLive(true);

    const openingItem: TranscriptItem = {
      role: "recruiter",
      text: spokenOpening,
      time: timeLabel(),
    };
    addTranscript(openingItem);

    trackWorkZoLaunchEvent({
      event: "interview_started",
      setupId: setup.setupId,
      role: getRole(setup),
      market: setup.targetMarket || "Global",
      recruiter: profile.name,
      mode: "voice",
    });

    speakRecruiter(spokenOpening, () => {
      window.setTimeout(() => listenForAnswer(), 400);
    });
  }, [addTranscript, listenForAnswer, speakRecruiter, startVapiInterview]);

  const stopInterview = useCallback(() => {
    isLiveRef.current = false;
    setIsLive(false);
    setIsListening(false);
    setIsSpeaking(false);
    setVoiceStatus("Alright. That gives me enough context for now.");
    if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
    if (finalizationTimerRef.current)
      window.clearTimeout(finalizationTimerRef.current);
    pendingAnswerRef.current = "";
    manualListenRequestedRef.current = false;
    try {
      recognitionRef.current?.abort?.();
      recognitionRef.current?.stop();
    } catch {}
    try {
      vapiClientRef.current?.stop?.();
    } catch {}
    vapiCallActiveRef.current = false;
    setVoiceProvider("tts-fallback");
    window.speechSynthesis?.cancel();
    try {
      mobileTtsAudioRef.current?.pause();
    } catch {}
    cleanupMobileTtsUrl();

    const finalScores = {
      recruiterTrust,
      hiringSignal: recruiterTrust,
      ownershipClarity: Math.max(
        0,
        100 - (recruiterMemory.ownershipIssues || 0) * 14,
      ),
      impactEvidence: Math.max(
        0,
        100 - (recruiterMemory.weakMetrics || 0) * 14,
      ),
      recoveryAbility: Math.min(
        100,
        50 + (recruiterMemory.strongRecoveries || 0) * 12,
      ),
    };

    const completedSessionPayload = {
      setupId: activeSetup.setupId || "local-session",
      targetRole: role,
      targetMarket: market,
      companyStyle: activeSetup.companyStyle || "Realistic",
      recruiterId,
      recruiterName: recruiterProfile.name,
      mode: "voice",
      durationSeconds: elapsed,
      answeredQuestionCount,
      recruiterTrust,
      scores: finalScores,
      memory: recruiterMemory,
      transcript,
      completedAt: new Date().toISOString(),
      source: "workzo-interview-room",
    };

    try {
      window.localStorage.setItem(
        "workzo-last-results",
        JSON.stringify({
          setup: activeSetup,
          recruiterTrust,
          transcript,
          scores: finalScores,
          memory: recruiterMemory,
        }),
      );
    } catch {}

    // Phase 2: persist completed interviews to Supabase through a server route.
    // This is intentionally fire-and-forget so ending the interview never feels slow
    // and never blocks users from seeing their results.
    void fetch("/api/interview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(completedSessionPayload),
    }).catch((error) => {
      console.warn("WorkZo interview history save failed", error);
      try {
        window.localStorage.setItem(
          "workzo-last-interview-save-error",
          String(error?.message || error || "unknown_error"),
        );
      } catch {}
    });

    trackWorkZoLaunchEvent({
      event: "interview_completed",
      setupId: activeSetup.setupId,
      role,
      market,
      recruiter: recruiterProfile.name,
      mode: "voice",
    });
  }, [
    activeSetup,
    answeredQuestionCount,
    elapsed,
    market,
    recruiterId,
    recruiterMemory,
    recruiterProfile.name,
    recruiterTrust,
    role,
    transcript,
    cleanupMobileTtsUrl,
  ]);

  const handleMicClick = useCallback(() => {
    if (vapiCallActiveRef.current) {
      setVoiceStatus("Vapi voice session is active — speak naturally");
      return;
    }

    if (isMobileBrowserRuntime() && !mobileAudioUnlockedRef.current) {
      // CRITICAL for iOS/Chrome mobile: do not wait for an async unlock promise
      // before starting SpeechSynthesis. Waiting moves the real speech outside
      // the user gesture and the recruiter becomes visually active but silent.
      mobileAudioUnlockedRef.current = true;
      setHasUnlockedMobileAudio(true);
      setNeedsMobileAudioStart(false);
      setVoiceStatus("Starting recruiter audio...");
      void unlockMobileAudioForSpeech();

      if (!isLiveRef.current) {
        void startStandardInterview();
      } else if (!isSpeakingRef.current && !isListening) {
        manualListenRequestedRef.current = true;
        listenForAnswer();
      }
      return;
    }

    if (isLive) {
      // During a live session the mic button is only a manual resume.
      // It must never start listening while the recruiter is speaking.
      if (!isSpeaking && !isListening) {
        manualListenRequestedRef.current = true;
        listenForAnswer();
      }
      return;
    }
    void startStandardInterview();
  }, [
    isLive,
    isListening,
    isSpeaking,
    listenForAnswer,
    startStandardInterview,
  ]);

  const handleModeChange = useCallback(
    (nextMode: InterviewMode) => {
      if (isLiveRef.current) stopInterview();
      setMode(nextMode);
      modeRef.current = nextMode;
      setVoiceStatus(
        nextMode === "video"
          ? "Cinematic recruiter room is live"
          : "Ready for interview",
      );

      // Make Cinematic Live feel different from Standard Interview.
      // Selecting it starts the pseudo-live recruiter room and enables hands-free replies.
      if (nextMode === "video") {
        window.setTimeout(() => {
          if (!isLiveRef.current && modeRef.current === "video") {
            void startStandardInterview();
          }
        }, 350);
      }
    },
    [startStandardInterview, stopInterview],
  );

  useEffect(() => {
    if (!isHydrated || mode !== "video" || autoCinematicStartedRef.current)
      return;
    autoCinematicStartedRef.current = true;
    const timer = window.setTimeout(() => {
      if (isMobileBrowserRuntime()) {
        setVoiceStatus("Tap mic to start recruiter audio");
        setNeedsMobileAudioStart(true);
        return;
      }
      if (!isLiveRef.current && modeRef.current === "video") {
        void startStandardInterview();
      }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [isHydrated, mode, startStandardInterview]);

  const handleToggleSpeaker = useCallback(() => {
    setSpeakerOn((value) => !value);
    if (speakerOn) {
      window.speechSynthesis?.cancel();
      try {
        mobileTtsAudioRef.current?.pause();
      } catch {}
      try {
        vapiClientRef.current?.stop?.();
      } catch {}
      vapiCallActiveRef.current = false;
      setVoiceProvider("tts-fallback");
      isSpeakingRef.current = false;
      setIsSpeaking(false);
    }
  }, [speakerOn]);

  const recruiterName = recruiterProfile.name || "Priya";
  const recruiterRole = recruiterProfile.role || "Startup Recruiter";
  const latestCandidateAnswer =
    transcript
      .slice()
      .reverse()
      .find((item) => item.role === "candidate")?.text || "";

  if (!isHydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-blue-500/30" />
          <p className="mt-4 text-sm font-semibold text-slate-300">
            Preparing interview room...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen w-full overflow-x-hidden bg-[#020617] p-0 text-white">
      <Link
        href="/dashboard"
        className="absolute left-7 top-6 z-50 hidden h-[46px] items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.045] px-5 text-sm font-black text-slate-200 backdrop-blur-xl hover:bg-white/10 lg:flex"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      <InterviewRoom
        recruiterName={recruiterName}
        recruiterRole={recruiterRole}
        recruiterId={recruiterId}
        question={question}
        status={
          mode === "video" && !isLive
            ? "Cinematic recruiter room is live"
            : voiceStatus
        }
        isLive={isLive}
        isSpeaking={isSpeaking}
        isListening={isListening}
        isMuted={false}
        recruiterState={recruiterState}
        recruiterTrust={recruiterTrust}
        selectedMode={mode}
        onSelectMode={handleModeChange}
        elapsed={elapsed}
        transcript={transcript}
        answeredQuestionCount={answeredQuestionCount}
        onMicClick={handleMicClick}
        onEndInterview={stopInterview}
        speakerOn={speakerOn}
        onToggleSpeaker={handleToggleSpeaker}
        needsMobileAudioStart={needsMobileAudioStart}
        hasUnlockedMobileAudio={hasUnlockedMobileAudio}
      />

      <LiveCopilotPanel
        question={question}
        latestAnswer={latestCandidateAnswer}
        recruiterState={recruiterState}
        recruiterTrust={recruiterTrust}
        targetRole={getRole(activeSetup)}
        recruiterId={activeSetup.recruiterPersonality}
      />
    </main>
  );
}
