"use client";

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
  Video,
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
import MobileInterviewRoom from "@/components/interview/MobileInterviewRoom";

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

type ElevenLabsVoiceRequest = {
  recruiterId: RecruiterId;
  text: string;
};

async function fetchElevenLabsAudio({
  recruiterId,
  text,
}: ElevenLabsVoiceRequest) {
  const response = await fetch("/api/elevenlabs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ recruiterId, text }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(details || "ElevenLabs voice request failed");
  }

  const arrayBuffer = await response.arrayBuffer();
  return new Blob([arrayBuffer], { type: "audio/mpeg" });
}

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

const naturalInterviewQuestions = [
  "Tell me about a project where you personally improved a process or outcome.",
  "Walk me through a situation where you had to solve a difficult problem.",
  "Describe a time you handled a customer or stakeholder under pressure.",
  "Give me an example where you used data or evidence to make a better decision.",
  "Tell me about a time you had to learn something quickly for work.",
  "Tell me about a mistake you made and how you handled it.",
  "How do you usually communicate progress when work is unclear or changing?",
  "Why are you interested in this role, and what makes you a strong fit?",
];

const lightFollowUpQuestions = [
  "What made that situation difficult?",
  "What did you personally do in that situation?",
  "How did you know your approach worked?",
  "What would you do differently if you had to handle it again?",
];

function getCandidateAnswerCount(items: TranscriptItem[]) {
  return items.filter((item) => item.role === "candidate").length;
}

function pickNaturalNextQuestion({
  answerCount,
  currentQuestion,
}: {
  answerCount: number;
  currentQuestion: string;
}) {
  // Real interviews should not dissect every answer. Most of the time, move the
  // conversation forward. Only occasionally ask a light follow-up.
  const shouldAskLightFollowUp = answerCount > 3 && answerCount % 4 === 0;

  if (shouldAskLightFollowUp) {
    const followUpIndex =
      Math.floor(answerCount / 4) % lightFollowUpQuestions.length;
    return lightFollowUpQuestions[followUpIndex];
  }

  const normalizedCurrent = currentQuestion.trim().toLowerCase();
  const currentIndex = naturalInterviewQuestions.findIndex(
    (question) => question.trim().toLowerCase() === normalizedCurrent,
  );

  const nextIndex =
    currentIndex >= 0 ? currentIndex + 1 : Math.max(0, answerCount - 2);
  return naturalInterviewQuestions[
    nextIndex % naturalInterviewQuestions.length
  ];
}

function buildNaturalInterviewBridge({
  recruiterId,
  answerCount,
  nextQuestion,
}: {
  recruiterId: RecruiterId;
  answerCount: number;
  nextQuestion: string;
}) {
  const transitions =
    recruiterId === "startup_recruiter"
      ? [
          "Okay, thanks. Let’s move to the next part.",
          "Got it. I’ll switch direction slightly.",
          "Alright. Let’s look at another situation.",
          "Thanks. I want to understand another side of your experience.",
        ]
      : recruiterId === "friendly_hr"
        ? [
            "Thank you, that helps. Let’s continue.",
            "Okay, I understand. Let’s move to another example.",
            "That gives me useful context. I’d like to ask about something else.",
            "Thanks for explaining that. Let’s continue.",
          ]
        : recruiterId === "german_corporate"
          ? [
              "Thank you. Let’s continue with the next area.",
              "Understood. I’ll move to another question now.",
              "That gives me context. Let’s keep this structured.",
              "Thank you. I’d like to cover another situation.",
            ]
          : [
              "Okay, thanks. Let’s go to the next area.",
              "Understood. I want to explore another example.",
              "That gives me some context. Let’s continue.",
              "Thanks. I’ll move the interview forward.",
            ];

  const transition = transitions[answerCount % transitions.length];
  return cleanLiveRecruiterSpeech(`${transition} ${nextQuestion}`);
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function timeLabel() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
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

function getCandidateName(setup: WorkZoInterviewSetup) {
  const profile = setup.recruiterMemoryProfile;
  if (profile && typeof profile === "object" && "candidateName" in profile) {
    const value = (profile as { candidateName?: unknown }).candidateName;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "Candidate";
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
  // Keep the live interview moving like a real conversation.
  // Deeper critique is saved for the results page, not spoken mid-call.
  if (analysis.signal === "rambling") return 900;
  if (
    analysis.signal === "strong_metrics" ||
    analysis.signal === "good_ownership"
  )
    return 520;
  if (analysis.signal === "recovery") return 620;
  return 680;
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
        "Google US English",
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
        "Google US English",
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

function openAiVoiceIdForRecruiter(recruiterId: RecruiterId) {
  return recruiterRuntimeVoice(recruiterId).voiceId;
}

function isMobileBrowser() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod|android|mobile/i.test(navigator.userAgent || "");
}

function speakWithSystemVoiceFallback({
  recruiterId,
  text,
  onDone,
}: {
  recruiterId: RecruiterId;
  text: string;
  onDone: () => void;
}) {
  if (typeof window === "undefined" || !window.speechSynthesis) return false;

  try {
    const utterance = new SpeechSynthesisUtterance(text);
    const runtimeVoice = recruiterRuntimeVoice(recruiterId);
    utterance.pitch = runtimeVoice.pitch;
    utterance.rate = Math.min(0.94, runtimeVoice.rate);
    utterance.volume = 1;
    utterance.onend = onDone;
    utterance.onerror = onDone;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

function recruiterQuestionLead(
  recruiterId: RecruiterId,
  state: RecruiterState,
) {
  if (recruiterId === "startup_recruiter") return "Okay, thanks.";
  if (recruiterId === "friendly_hr") return "Thank you, that helps.";
  if (recruiterId === "german_corporate") return "Understood.";
  return "Okay, I understand.";
}

function cleanLiveRecruiterSpeech(text: string) {
  return softenRecruiterSpeech(text)
    .replace(/let me stop you there(?: for a second)?\.?/gi, "")
    .replace(/i noticed this pattern earlier too:?/gi, "")
    .replace(/answer was too short[^.?!]*[.?!]?/gi, "")
    .replace(/answer is too generic[^.?!]*[.?!]?/gi, "")
    .replace(/too generic[^.?!]*[.?!]?/gi, "")
    .replace(/missing measurable impact[^.?!]*[.?!]?/gi, "")
    .replace(/answer (?:was|is) (?:too )?(?:short|generic|vague)[^.?!]*[.?!]?/gi, "")
    .replace(/pattern earlier[^.?!]*[.?!]?/gi, "")
    .replace(/i still don[’']t hear[^.?!]*[.?!]?/gi, "")
    .replace(/impact could be more measurable[^.?!]*[.?!]?/gi, "")
    .replace(/ownership needs clearer detail[^.?!]*[.?!]?/gi, "")
    .replace(/i'?m going to be direct here\.?/gi, "")
    .replace(/recruiter is (exploring|inviting|guiding|asking|keeping|listening)[^.?!]*[.?!]?/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([.?!,])/g, "$1")
    .replace(/\.\s*\./g, ".")
    .trim();
}

function extractAnswerFocus(answer: string) {
  const clean = answer
    .replace(/\s+/g, " ")
    .replace(/[^a-zA-Z0-9%.,\- ]/g, "")
    .trim();

  if (!clean) return "";

  const lower = clean.toLowerCase();
  const knownSignals = [
    "onboarding",
    "customer support",
    "support tickets",
    "ticketing",
    "dashboard",
    "sql",
    "python",
    "excel",
    "automation",
    "reporting",
    "stakeholders",
    "incident",
    "process",
    "workflow",
    "data analysis",
    "customer issue",
    "team",
    "project",
  ];

  const signal = knownSignals.find((item) => lower.includes(item));
  if (signal) return signal;

  const actionMatch = clean.match(
    /(?:worked on|built|created|handled|improved|managed|resolved|implemented|analyzed|led|owned)\s+([^,.]{6,70})/i,
  );
  if (actionMatch?.[1]) return actionMatch[1].trim();

  const words = clean.split(" ").filter(Boolean);
  if (words.length >= 7) return words.slice(0, 7).join(" ");
  return "";
}

function buildHumanReactiveFollowUp({
  recruiterId,
  answer,
  answerCount,
  nextQuestion,
  analysis,
  memory,
}: {
  recruiterId: RecruiterId;
  answer: string;
  answerCount: number;
  nextQuestion: string;
  analysis: AnswerAnalysis;
  memory?: RecruiterMemory;
}) {
  const focus = extractAnswerFocus(answer);
  const hasUsefulFocus = Boolean(focus && focus.length >= 4);
  const hasNumber = /\d|percent|percentage|hours?|days?|weeks?|months?|customers?|tickets?|users?|reduced|increased|saved|improved|faster|slower|revenue|cost/i.test(answer);
  const hasOwnership = /\bi\b|\bmy\b|\bpersonally\b|\bled\b|\bbuilt\b|\bcreated\b|\bowned\b|\bhandled\b|\bresolved\b|\bimplemented\b|\banalyzed\b|\bdesigned\b|\bimproved\b/i.test(answer);

  const acknowledgements =
    recruiterId === "startup_recruiter"
      ? ["Okay, that helps.", "Got it.", "That gives me context.", "Alright, useful."]
      : recruiterId === "friendly_hr"
        ? ["Thank you, that helps.", "Okay, I understand.", "That gives me useful context.", "Thanks for explaining that."]
        : recruiterId === "german_corporate"
          ? ["Understood.", "Thank you, that gives me context.", "Okay.", "That is helpful."]
          : ["Okay, that makes sense.", "Understood.", "That gives me a clearer picture.", "Thanks, that helps."];

  const ack = acknowledgements[answerCount % acknowledgements.length];

  // Restore the wow factor: sometimes stay with the candidate's answer and ask
  // a human follow-up based on their words. Keep it occasional so it feels like
  // a real recruiter, not an AI analyzer.
  const shouldStayOnAnswer = hasUsefulFocus && (answerCount <= 3 || answerCount % 3 === 0);
  const shouldUseMemoryCallback =
    Boolean(memory) &&
    answerCount >= 5 &&
    answerCount % 5 === 0 &&
    ((memory?.rememberedStrengths?.length || 0) > 0 ||
      (memory?.rememberedWeaknesses?.length || 0) > 0);

  if (shouldUseMemoryCallback) {
    const rememberedStrength = memory?.rememberedStrengths?.[0];
    const rememberedWeakness = memory?.rememberedWeaknesses?.[0];
    const naturalCallback = rememberedStrength
      ? `Earlier you gave a stronger example around ${rememberedStrength.toLowerCase()}. I want the same level of clarity here.`
      : rememberedWeakness
        ? `I want to come back to something from earlier, but in a practical way.`
        : "I want to connect this with what you said earlier.";

    const followUp = hasUsefulFocus
      ? `When you mention ${focus}, what was the most important decision you made there?`
      : nextQuestion;

    return cleanLiveRecruiterSpeech(`${ack} ${naturalCallback} ${followUp}`);
  }

  if (shouldStayOnAnswer) {
    const focusQuestions =
      recruiterId === "startup_recruiter"
        ? hasNumber
          ? [
              `You mentioned ${focus}. What drove that result?`,
              `On ${focus}, what was the trade-off you had to make?`,
              `That part about ${focus} is interesting. What made it difficult?`,
            ]
          : [
              `You mentioned ${focus}. What was the hardest part to get right there?`,
              `On ${focus}, what did you personally change or decide?`,
              `Stay with ${focus} for a moment. What was the real challenge?`,
            ]
        : recruiterId === "friendly_hr"
          ? [
              `When you mention ${focus}, what was your role in that situation?`,
              `What did you learn from that ${focus} experience?`,
              `How did you work with others around ${focus}?`,
            ]
          : recruiterId === "german_corporate"
            ? [
                `For ${focus}, what was your exact responsibility?`,
                `How did you structure your work around ${focus}?`,
                `What result came out of that ${focus} work?`,
              ]
            : [
                `When you say ${focus}, what was the key technical or business challenge?`,
                `What decision did you make around ${focus}?`,
                `How did you know the work around ${focus} was successful?`,
              ];

    return cleanLiveRecruiterSpeech(
      `${ack} ${focusQuestions[answerCount % focusQuestions.length]}`,
    );
  }

  // If the candidate is still building the answer, invite continuation rather
  // than judging them. Detailed coaching belongs in the results page.
  if (analysis.signal === "too_short") {
    return cleanLiveRecruiterSpeech(
      `${ack} Continue that thought a bit more. What happened next?`,
    );
  }

  if (analysis.signal === "unclear_ownership" && !hasOwnership) {
    return cleanLiveRecruiterSpeech(
      `${ack} And in that situation, which part was directly handled by you?`,
    );
  }

  const naturalTransitions =
    analysis.signal === "strong_metrics" || analysis.signal === "good_ownership" || analysis.signal === "recovery"
      ? [
          `Good. Let’s go one level deeper. ${nextQuestion}`,
          `That is useful context. I want to explore another angle. ${nextQuestion}`,
          `Okay, thanks. Let’s continue. ${nextQuestion}`,
          `That gives me a clearer picture. ${nextQuestion}`,
        ]
      : [
          `Okay, I understand. Let’s look at this from another angle. ${nextQuestion}`,
          `Thanks. I’ll move the conversation forward. ${nextQuestion}`,
          `That gives me context. Let’s continue. ${nextQuestion}`,
          `Understood. I want to ask about a different situation now. ${nextQuestion}`,
        ];

  return cleanLiveRecruiterSpeech(
    naturalTransitions[answerCount % naturalTransitions.length],
  );
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
  const lead = recruiterQuestionLead(recruiterId, state);

  if (isOpening) {
    const firstName = getFirstName(candidateName);

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

  const spokenQuestion = cleanLiveRecruiterSpeech(question);
  const spokenBridge = cleanLiveRecruiterSpeech(bridge || lead);
  return cleanLiveRecruiterSpeech(`${spokenBridge} ${spokenQuestion}`);
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
      caption: "Recruiter is listening",
      bridge: "Okay, I’m following you.",
      followUp:
        "Take a moment and continue that example from where you were going.",
    };
  }

  if (words.length > 160) {
    return {
      signal: "rambling",
      state: "interested",
      trustDelta: -3,
      caption: "Recruiter is listening",
      bridge: "Thanks, that gives me a lot of context.",
      followUp:
        "What would you say was the most important part of your contribution in that story?",
      weakness: "Answer could be more focused in the final structure.",
    };
  }

  if (!ownershipWords) {
    return {
      signal: "unclear_ownership",
      state: "interested",
      trustDelta: repeatedOwnershipIssue ? -4 : -2,
      caption: "Recruiter is listening",
      bridge: "That helps me understand the situation.",
      followUp: "Which part of that work did you handle yourself?",
      weakness: "Ownership could be clearer in the final answer.",
    };
  }

  if (!hasNumber) {
    return {
      signal: "missing_metrics",
      state: "interested",
      trustDelta: repeatedMetricsIssue ? -4 : -2,
      caption: "Recruiter is listening",
      bridge: "Got it — that gives me the story.",
      followUp:
        "What changed after that work? A rough estimate is fine.",
      weakness: "Impact could be more measurable in the final answer.",
    };
  }

  if (vagueWords && words.length < 70) {
    return {
      signal: "too_generic",
      state: "interested",
      trustDelta: -2,
      caption: "Recruiter is listening",
      bridge: "Okay, I see the direction.",
      followUp:
        "What was one specific situation that comes to mind?",
      weakness: "Answer could use a more concrete example in the final answer.",
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
      caption: "Recruiter engaged",
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
    caption: "Recruiter engaged",
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
      ? "Yes, I can hear you. Let’s continue."
      : "Yes, I’m here and I can hear you. Let’s continue.";
  }

  if (
    lower.includes("role") ||
    lower.includes("company") ||
    lower.includes("job")
  ) {
    return `Yes. We are interviewing for ${role}${company && company !== "Selected Company" ? ` at ${company}` : ""}. I’ll keep that context in mind as we continue.`;
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
      return `Yes — I have your resume context and the job description available.${signalLine} I’ll keep both in mind as we continue the conversation.`;
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
  onMicClick,
  onEndInterview,
  speakerOn,
  onToggleSpeaker,
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
  onMicClick: () => void;
  onEndInterview: () => void;
  speakerOn: boolean;
  onToggleSpeaker: () => void;
}) {
  const stateLabel = recruiterStateLabel(recruiterState, recruiterTrust);
  const compactHint = recruiterPressureLine(
    recruiterId,
    recruiterState,
    recruiterTrust,
  );
  const latestCaption =
    transcript
      .slice()
      .reverse()
      .find((item) => item.role === "recruiter")?.text || compactHint;

  const progressStep = Math.min(
    12,
    Math.max(
      1,
      transcript.filter((item) => item.role === "candidate").length + 1,
    ),
  );
  const progressPercent = Math.min(100, Math.max(12, progressStep * 8.3));
  const confidence = Math.min(92, Math.max(34, recruiterTrust + 12));
  const clarity = Math.min(88, Math.max(32, recruiterTrust + 8));

  const pulseLines = [
    recruiterTrust < 42 ? "Waiting for proof" : "Listening for impact",
    recruiterState === "pressuring" ? "Pressure rising" : "Controlled pace",
    recruiterState === "recovering_trust"
      ? "Recovery signal possible"
      : stateLabel,
    confidence > 70 ? "Answer confidence: Strong" : "Answer confidence: Medium",
  ];

  return (
    <div className="relative h-full min-h-screen w-full overflow-hidden bg-[#020617] pb-[160px] text-white">
      <style>{`
        @keyframes workzoBreath { 0%, 100% { transform: translate(-50%, 0) scale(1); } 50% { transform: translate(-50%, -3px) scale(1.01); } }
        @keyframes workzoBlink { 0%, 91%, 100% { opacity: 1; filter: brightness(1.08) contrast(1.08); } 93% { opacity: .90; filter: brightness(.88) contrast(1.02); } 94.5% { opacity: 1; filter: brightness(1.08) contrast(1.08); } }
        @keyframes workzoWave { 0%,100% { transform: scaleY(.58); opacity: .50; } 50% { transform: scaleY(1.16); opacity: 1; } }
        @keyframes workzoRing { 0% { transform: translate(-50%, -50%) rotate(0deg); } 100% { transform: translate(-50%, -50%) rotate(360deg); } }
        @keyframes workzoCaption { 0%,100% { opacity:.52; transform: translateY(0); } 50% { opacity:.82; transform: translateY(-1px); } }
        @media (max-height: 900px) {
          .wz-stage { top: 88px !important; }
          .wz-status { top: 382px !important; }
          .wz-wave { top: 426px !important; }
          .wz-caption { top: 462px !important; }
          .wz-question { top: 500px !important; height: 142px !important; padding: 21px 34px !important; }
          .wz-question-title { font-size: 25px !important; }
        }
        @media (max-height: 820px) {
          .wz-stage { top: 80px !important; height: 232px !important; }
          .wz-status { top: 348px !important; }
          .wz-wave { top: 388px !important; }
          .wz-caption { top: 424px !important; }
          .wz-question { top: 458px !important; width: 730px !important; height: 130px !important; padding: 18px 30px !important; }
          .wz-question-title { font-size: 23px !important; }
          .wz-main-mic { height: 88px !important; width: 88px !important; }
          .wz-mic-label { bottom: 2px !important; font-size: 12px !important; }
        }
        @media (max-width: 1535px) {
          .wz-side { display: none !important; }
          .wz-question { max-width: calc(100vw - 48px) !important; }
        }
        @media (max-width: 820px) {
          .wz-mode-toggle { top: 14px !important; width: calc(100vw - 28px) !important; height: 48px !important; font-size: 12px !important; }
          .wz-mode-toggle button { height: 38px !important; width: 50% !important; padding-left: 8px !important; padding-right: 8px !important; }
          .wz-stage { top: 70px !important; width: 108vw !important; height: 220px !important; transform: translateX(-50%) scale(.70) !important; transform-origin: top center !important; }
          .wz-status { top: 258px !important; width: calc(100vw - 28px) !important; justify-content: center !important; text-align: center !important; font-size: 13px !important; line-height: 1.35 !important; }
          .wz-wave { top: 300px !important; width: 144px !important; gap: 7px !important; }
          .wz-caption { top: 332px !important; width: calc(100vw - 30px) !important; font-size: 12px !important; opacity: .58 !important; }
          .wz-question { top: 370px !important; width: calc(100vw - 28px) !important; max-width: calc(100vw - 28px) !important; height: auto !important; min-height: 138px !important; padding: 18px !important; border-radius: 22px !important; }
          .wz-question-title { white-space: normal !important; font-size: 21px !important; line-height: 1.12 !important; display: -webkit-box !important; -webkit-line-clamp: 3 !important; -webkit-box-orient: vertical !important; overflow: hidden !important; }
          .wz-question-meta { display: none !important; }
          .wz-main-mic { height: 92px !important; width: 92px !important; }
          .wz-main-mic > span { height: 72px !important; width: 72px !important; }
          .wz-mic-label { bottom: 18px !important; width: calc(100vw - 40px) !important; font-size: 12px !important; }
          .wz-utility-dock { right: 14px !important; bottom: 18px !important; transform: scale(.92); transform-origin: bottom right; }
        }
        @media (max-width: 420px) {
          .wz-stage { top: 66px !important; transform: translateX(-50%) scale(.64) !important; }
          .wz-status { top: 240px !important; }
          .wz-wave { top: 282px !important; }
          .wz-caption { top: 313px !important; }
          .wz-question { top: 348px !important; min-height: 132px !important; }
          .wz-question-title { font-size: 20px !important; }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_31%,rgba(37,99,235,0.22),transparent_31%),linear-gradient(180deg,rgba(2,6,23,0.02),rgba(2,6,23,0.96))]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.13] [background-image:linear-gradient(90deg,transparent_0%,rgba(148,163,184,.12)_48%,transparent_100%),radial-gradient(circle_at_30%_38%,rgba(15,23,42,.8),transparent_24%),radial-gradient(circle_at_70%_40%,rgba(30,64,175,.20),transparent_30%)]" />
      <div className="pointer-events-none absolute left-[23%] top-[29%] h-[124px] w-[210px] rounded-[34px] border border-white/[0.025] bg-white/[0.012] blur-[1px]" />
      <div className="pointer-events-none absolute right-[23%] top-[29%] h-[132px] w-[220px] rounded-[34px] border border-cyan-200/[0.025] bg-cyan-200/[0.012] blur-[1px]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:radial-gradient(circle_at_center,white_0.65px,transparent_0.8px)] [background-size:4px_4px]" />

      <div className="wz-mode-toggle absolute left-1/2 top-6 z-30 flex h-[58px] w-[410px] -translate-x-1/2 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.045] p-1 text-[14px] font-black tracking-[0.02em] text-slate-400 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur-[20px]">
        <button
          type="button"
          onClick={() => onSelectMode("standard")}
          className={cn(
            "flex h-[46px] w-[190px] items-center justify-center rounded-full px-6 py-2.5 transition",
            selectedMode === "standard"
              ? "bg-blue-500/28 text-white shadow-[0_0_30px_rgba(59,130,246,0.18)]"
              : "hover:text-white",
          )}
        >
          Standard Interview
        </button>
        <button
          type="button"
          onClick={() => onSelectMode("video")}
          className={cn(
            "flex h-[46px] w-[190px] items-center justify-center rounded-full px-6 py-2.5 transition",
            selectedMode === "video"
              ? "bg-violet-500/22 text-white shadow-[0_0_30px_rgba(139,92,246,0.18)]"
              : "hover:text-white",
          )}
        >
          Live Interview
        </button>
      </div>

      <aside className="wz-side pointer-events-none absolute left-9 top-[94px] z-20 w-[270px] space-y-[12px]">
        <section className="h-[168px] rounded-[24px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(15,23,42,0.90),rgba(7,12,25,0.80))] p-5 text-left shadow-[0_10px_40px_rgba(0,0,0,0.20)] backdrop-blur-2xl">
          <p className="text-sm font-semibold text-slate-300">
            Interview Progress
          </p>
          <div className="mt-4 flex items-center gap-4">
            <div
              className="grid h-[92px] w-[92px] place-items-center rounded-full"
              style={{
                background: `conic-gradient(rgb(56 189 248) ${progressPercent}%, rgba(148,163,184,.10) ${progressPercent}% 100%)`,
              }}
            >
              <div className="grid h-[70px] w-[70px] place-items-center rounded-full bg-[#07111f]">
                <div className="text-center">
                  <p className="text-2xl font-black text-white">
                    {progressStep}
                  </p>
                  <p className="text-[11px] text-slate-300">/ 12 Questions</p>
                </div>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500">Stage</p>
              <p className="mt-1 text-sm font-semibold text-white">
                Core Experience
              </p>
            </div>
          </div>
        </section>

        <section className="h-[184px] rounded-[24px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(15,23,42,0.90),rgba(7,12,25,0.80))] p-5 text-left shadow-[0_10px_40px_rgba(0,0,0,0.20)] backdrop-blur-2xl">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-300">
              Recruiter Intelligence
            </p>
            <span className="text-xs text-cyan-300">Live</span>
          </div>
          <div className="mt-3 space-y-2.5 text-[13px] text-slate-300">
            {pulseLines.map((line) => (
              <div
                key={line}
                className="flex items-center justify-between gap-3"
              >
                <span>{line}</span>
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              </div>
            ))}
          </div>
        </section>

        <section className="h-[116px] overflow-hidden rounded-[24px] border border-amber-300/10 bg-[linear-gradient(180deg,rgba(30,23,10,0.82),rgba(7,12,25,0.78))] p-5 text-left shadow-[0_10px_40px_rgba(0,0,0,0.20)] backdrop-blur-2xl">
          <p className="text-sm font-black text-amber-200">Pro Tip</p>
          <p className="mt-2 text-[13px] leading-5 text-slate-300">
            Give situation, personal action, measurable result.
          </p>
        </section>
      </aside>

      <aside className="wz-side pointer-events-none absolute right-9 top-[94px] z-20 w-[300px] space-y-[12px]">
        <section className="h-[226px] rounded-[24px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(15,23,42,0.90),rgba(7,12,25,0.80))] p-5 text-left shadow-[0_10px_40px_rgba(0,0,0,0.20)] backdrop-blur-2xl">
          <p className="text-[12px] font-black uppercase tracking-[0.18em] text-slate-400">
            Recruiter Guide
          </p>
          <div className="mt-4 space-y-3.5 text-[13px]">
            <div>
              <p className="font-bold text-white">Current pressure</p>
              <p className="mt-1 text-slate-400">{compactHint}</p>
            </div>
            <div>
              <p className="font-bold text-white">Memory callback</p>
              <p className="mt-1 text-slate-400">
                {transcript.length > 4
                  ? "Recruiter will compare this answer with earlier patterns."
                  : "Recruiter is building first impression."}
              </p>
            </div>
            <div>
              <p className="font-bold text-white">Mode</p>
              <p className="mt-1 text-slate-400">
                {selectedMode === "video"
                  ? "Live video layer is experimental."
                  : "Stable interview flow for launch."}
              </p>
            </div>
          </div>
        </section>

        <section className="h-[146px] rounded-[24px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(15,23,42,0.90),rgba(7,12,25,0.80))] p-5 text-left shadow-[0_10px_40px_rgba(0,0,0,0.20)] backdrop-blur-2xl">
          <p className="text-sm font-semibold text-slate-300">Your Stats</p>
          <div className="mt-4 space-y-3 text-[13px] text-slate-300">
            <div className="flex items-center justify-between">
              <span>Time</span>
              <span className="text-white">{formatElapsed(elapsed)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Hiring Signal</span>
              <span className="font-black text-emerald-300">{confidence}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Clarity Score</span>
              <span className="font-black text-amber-200">{clarity}%</span>
            </div>
          </div>
        </section>

        <section className="h-[128px] overflow-hidden rounded-[24px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(15,23,42,0.90),rgba(7,12,25,0.80))] p-5 text-left shadow-[0_10px_40px_rgba(0,0,0,0.20)] backdrop-blur-2xl">
          <p className="text-sm font-semibold text-slate-300">Recruiter</p>
          <p className="mt-3 font-semibold text-white">
            {recruiterName} · {recruiterRole}
          </p>
          <p className="mt-2 text-sm leading-5 text-slate-400">{stateLabel}</p>
        </section>
      </aside>

      <div
        className="wz-stage absolute left-1/2 top-[94px] z-10 h-[250px] w-[520px] overflow-hidden rounded-[64px]"
        style={{ animation: "workzoBreath 5.8s ease-in-out infinite" }}
      >
        <div className="absolute left-1/2 top-1/2 h-[222px] w-[455px] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-blue-500/[0.08] blur-[22px]" />
        <div className="absolute left-1/2 top-1/2 h-[244px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-blue-200/18" />
        <div
          className="absolute left-1/2 top-1/2 h-[236px] w-[480px] rounded-[50%] border-t-[4px] border-r-[4px] border-t-cyan-300/95 border-r-blue-500/70 border-b-transparent border-l-transparent shadow-[0_0_34px_rgba(34,211,238,0.24)]"
          style={{ animation: "workzoRing 34s linear infinite" }}
        />
        <div
          className="absolute left-1/2 top-1/2 h-[210px] w-[440px] rounded-[50%] border-b-[4px] border-l-[4px] border-b-blue-500/85 border-l-cyan-300/85 border-r-transparent border-t-transparent shadow-[0_0_30px_rgba(59,130,246,0.18)]"
          style={{ animation: "workzoRing 42s linear infinite reverse" }}
        />
        <div className="absolute left-1/2 top-1/2 z-10 h-[220px] w-[420px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[999px] border border-blue-200/25 bg-slate-950 shadow-[0_0_68px_rgba(37,99,235,0.34)]">
          <img
            src={recruiterImagePath(recruiterName, recruiterId)}
            alt={`${recruiterName} AI recruiter`}
            className={cn(
              "h-full w-full object-cover object-center brightness-110 contrast-110 transition duration-700",
              isLive ? "scale-[1.035]" : "scale-[1.01]",
              isSpeaking && "scale-[1.045] saturate-110",
              recruiterState === "pressuring" && "scale-[1.045] saturate-110",
              recruiterState === "losing_confidence" &&
                "scale-[1.015] saturate-[.90]",
            )}
            style={{ animation: "workzoBlink 7.8s ease-in-out infinite" }}
          />
        </div>
      </div>

      <div className="wz-status absolute left-1/2 top-[394px] z-10 flex -translate-x-1/2 items-center gap-2 text-[16px] font-semibold text-slate-300">
        <Clock3 className="h-4 w-4 text-sky-400" />
        <span>{status || stateLabel}</span>
      </div>

      <div
        className="wz-wave absolute left-1/2 top-[440px] z-10 flex h-[28px] w-[170px] -translate-x-1/2 items-end justify-center gap-[9px]"
        aria-hidden="true"
      >
        {waveform.map((height, index) => (
          <span
            key={index}
            className={cn(
              "w-[7px] rounded-full bg-gradient-to-t shadow-[0_0_16px_rgba(56,189,248,0.52)]",
              isListening
                ? "from-emerald-500 via-cyan-300 to-blue-400"
                : "from-blue-500 via-cyan-300 to-violet-400",
            )}
            style={{
              height: Math.max(8, height * (isLive ? 0.74 : 0.52)),
              animation: `workzoWave ${0.82 + index * 0.07}s ease-in-out infinite`,
              animationDelay: `${index * 0.055}s`,
            }}
          />
        ))}
      </div>

      <div
        className="wz-caption absolute left-1/2 top-[480px] z-10 min-h-[22px] w-[540px] -translate-x-1/2 rounded-full border border-white/[0.03] bg-white/[0.014] px-4 py-1 text-center text-[13px] font-medium text-slate-400/65 opacity-[0.54] shadow-[0_10px_28px_rgba(0,0,0,0.16)] backdrop-blur-[12px]"
        style={{ animation: "workzoCaption 4.8s ease-in-out infinite" }}
      >
        {latestCaption.length > 92
          ? `${latestCaption.slice(0, 92)}...`
          : latestCaption}
      </div>

      <section className="wz-question absolute left-1/2 top-[492px] z-10 h-[138px] w-[760px] max-w-[760px] -translate-x-1/2 rounded-[26px] border border-white/[0.055] bg-[#07111f]/82 px-[32px] py-[20px] text-left shadow-[0_20px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-cyan-300/85">
          Current Question
        </p>
        <h1 className="wz-question-title mt-3 max-w-[690px] line-clamp-2 text-[24px] font-bold leading-[1.08] tracking-[-0.03em] text-white">
          {question}
        </h1>
        <div className="wz-question-meta mt-[12px] flex items-center gap-4 overflow-hidden whitespace-nowrap text-[12.5px] font-medium text-slate-400">
          <span className="inline-flex items-center gap-2">
            <Clock3 className="h-4 w-4" />
            Recruiter expects measurable impact
          </span>
          <span className="h-5 w-px bg-white/10" />
          <span className="inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Keep answer under 90 seconds
          </span>
          <span className="h-5 w-px bg-white/10" />
          <span className="inline-flex items-center gap-2 text-cyan-200">
            <Mic className="h-4 w-4" />
            {isListening ? "Listening now" : "Speak confidently"}
          </span>
        </div>
      </section>

      <div className="absolute bottom-[8px] left-1/2 z-40 -translate-x-1/2">
        <button
          type="button"
          onClick={onMicClick}
          className={cn(
            "wz-main-mic grid h-[108px] w-[108px] place-items-center rounded-full border text-white shadow-[0_0_60px_rgba(59,130,246,0.35)] transition hover:scale-[1.03]",
            isLive
              ? "border-emerald-300/35 bg-emerald-500/15"
              : "border-cyan-200/25 bg-blue-500/20",
          )}
          aria-label={isLive ? "Continue listening" : "Start interview"}
        >
          <span className="grid h-[84px] w-[84px] place-items-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
            {isLive && isListening ? (
              <MicOff className="h-9 w-9" />
            ) : (
              <Mic className="h-9 w-9" />
            )}
          </span>
        </button>
      </div>

      <p className="wz-mic-label pointer-events-none absolute bottom-[0px] left-1/2 z-40 -translate-x-1/2 text-center text-xs font-medium text-slate-400">
        {isLive
          ? isListening
            ? "Listening to your answer"
            : isSpeaking
              ? "Recruiter speaking"
              : "Tap mic when you are ready to answer"
          : "Tap mic to start interview"}
      </p>

      <div className="wz-utility-dock absolute bottom-6 right-7 z-40 flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleSpeaker}
          className="grid h-11 w-11 place-items-center rounded-full border border-white/[0.08] bg-white/[0.045] text-slate-300 backdrop-blur-xl hover:bg-white/10"
          aria-label="Toggle speaker"
        >
          {speakerOn ? (
            <Volume2 className="h-5 w-5" />
          ) : (
            <VolumeX className="h-5 w-5" />
          )}
        </button>
        <button
          type="button"
          onClick={onEndInterview}
          className="grid h-11 w-11 place-items-center rounded-full border border-red-300/15 bg-red-500/10 text-red-200 backdrop-blur-xl hover:bg-red-500/20"
          aria-label="End interview"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

export default function InterviewPage() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [activeSetup, setActiveSetup] = useState<WorkZoInterviewSetup>(() =>
    normalizeSetup(null),
  );
  const [mode, setMode] = useState<InterviewMode>("standard");
  const [isLive, setIsLive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [voiceStatus, setVoiceStatus] = useState("Ready for interview");
  const [question, setQuestion] = useState(fallbackQuestions[0]);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [recruiterMemory, setRecruiterMemory] = useState<RecruiterMemory>(() =>
    createInitialRecruiterMemory(),
  );
  const [recruiterState, setRecruiterState] =
    useState<RecruiterState>("neutral");
  const [recruiterTrust, setRecruiterTrust] = useState(58);

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const currentRecruiterAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const recruiterAudioUnlockedRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const isLiveRef = useRef(false);
  const questionRef = useRef(question);
  const transcriptRef = useRef<TranscriptItem[]>([]);
  const memoryRef = useRef<RecruiterMemory>(recruiterMemory);
  const trustRef = useRef(recruiterTrust);
  const recruiterStateRef = useRef<RecruiterState>(recruiterState);
  const silenceTimerRef = useRef<number | null>(null);
  const hasGreetedRef = useRef(false);
  const interviewStepRef = useRef<"greeting" | "intro" | "deep_dive">(
    "greeting",
  );
  const handleCandidateAnswerRef = useRef<(answer: string) => void>(() => {});
  const pendingAnswerRef = useRef("");
  const finalizationTimerRef = useRef<number | null>(null);

  // Standard Interview now uses ElevenLabs TTS for recruiter speech.
  // Browser SpeechRecognition is still used only for candidate answers.

  const recruiterProfile = useMemo(
    () => getRecruiterVoiceProfile(activeSetup.recruiterPersonality),
    [activeSetup.recruiterPersonality],
  );

  const recruiterId = activeSetup.recruiterPersonality as RecruiterId;
  const role = getRole(activeSetup);
  const company = getCompany(activeSetup);
  const market = activeSetup.targetMarket || "Global";
  const candidateName = getCandidateName(activeSetup);

  useEffect(() => {
    clearExpiredInterviewState();
    touchWorkZoSession();

    const latest = normalizeSetup(readLatestInterviewSetup());
    setActiveSetup(latest);

    const savedMemory = loadRecruiterMemory();
    setRecruiterMemory(savedMemory);
    setRecruiterTrust(savedMemory.recruiterTrust || 58);

    setIsHydrated(true);

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
      pendingAnswerRef.current = "";
      try {
        recognitionRef.current?.stop();
      } catch {}
      try {
        currentAudioSourceRef.current?.stop();
        currentAudioSourceRef.current = null;
      } catch {}
      try {
        const audio = currentRecruiterAudioRef.current;
        audio?.pause();
        if (audio?.parentNode) audio.parentNode.removeChild(audio);
        currentRecruiterAudioRef.current = null;
      } catch {}
    };
  }, []);

  useEffect(() => {
    if (!isLive) return;
    const timer = window.setInterval(() => {
      setElapsed((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isLive]);

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

  const unlockRecruiterAudio = useCallback(() => {
    if (typeof window === "undefined") return;
    if (recruiterAudioUnlockedRef.current) return;

    try {
      const AudioContextConstructor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;

      if (AudioContextConstructor && !audioContextRef.current) {
        audioContextRef.current = new AudioContextConstructor();
      }

      void audioContextRef.current?.resume().then(() => {
        recruiterAudioUnlockedRef.current = true;
      });
    } catch {
      // Continue to the HTMLAudio fallback below.
    }

    try {
      const audio = currentRecruiterAudioRef.current || new Audio();
      audio.preload = "auto";
      audio.volume = 0;
      audio.muted = true;
      audio.setAttribute("playsinline", "true");
      (audio as HTMLAudioElement & { playsInline?: boolean }).playsInline =
        true;
      if (typeof document !== "undefined" && !audio.isConnected) {
        audio.setAttribute("data-workzo-recruiter-audio", "true");
        audio.style.position = "fixed";
        audio.style.left = "-9999px";
        audio.style.width = "1px";
        audio.style.height = "1px";
        audio.style.opacity = "0";
        document.body.appendChild(audio);
      }
      audio.src =
        "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQQAAAAAAA==";
      currentRecruiterAudioRef.current = audio;

      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === "function") {
        playPromise
          .then(() => {
            recruiterAudioUnlockedRef.current = true;
            audio.pause();
            audio.currentTime = 0;
            audio.muted = false;
            audio.volume = 1;
          })
          .catch(() => {
            audio.muted = false;
            audio.volume = 1;
          });
      } else {
        recruiterAudioUnlockedRef.current = true;
        audio.muted = false;
        audio.volume = 1;
      }
    } catch {
      // Ignore unlock failures; the normal play path will still try.
    }
  }, []);

  const addTranscript = useCallback((item: TranscriptItem) => {
    setTranscript((items) => [...items, item].slice(-40));
  }, []);

  const speakRecruiter = useCallback(
    async (text: string, afterSpeak?: () => void) => {
      if (!speakerOn) {
        afterSpeak?.();
        return;
      }

      const cleanText = softenRecruiterSpeech(text);

      try {
        currentAudioSourceRef.current?.stop();
        currentAudioSourceRef.current = null;
      } catch {}

      try {
        currentRecruiterAudioRef.current?.pause();
      } catch {}

      let didFinish = false;
      let safetyTimeout: number | null = null;

      const finishSpeech = () => {
        if (didFinish) return;
        didFinish = true;

        if (safetyTimeout) {
          window.clearTimeout(safetyTimeout);
          safetyTimeout = null;
        }

        try {
          currentAudioSourceRef.current?.disconnect();
        } catch {}

        currentAudioSourceRef.current = null;
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        setVoiceStatus("Listening...");
        afterSpeak?.();
      };

      const playWithHtmlAudio = async (audioBlob: Blob) => {
        const audioUrl = URL.createObjectURL(
          audioBlob.type === "audio/mpeg"
            ? audioBlob
            : new Blob([await audioBlob.arrayBuffer()], { type: "audio/mpeg" }),
        );
        const audio = currentRecruiterAudioRef.current || new Audio();
        currentRecruiterAudioRef.current = audio;

        // Mobile Safari/Chrome are much more reliable when the audio element
        // is attached to the DOM and reused after the first mic tap.
        if (typeof document !== "undefined" && !audio.isConnected) {
          audio.setAttribute("data-workzo-recruiter-audio", "true");
          audio.style.position = "fixed";
          audio.style.left = "-9999px";
          audio.style.width = "1px";
          audio.style.height = "1px";
          audio.style.opacity = "0";
          document.body.appendChild(audio);
        }

        audio.pause();
        audio.src = audioUrl;
        audio.preload = "auto";
        audio.autoplay = false;
        audio.muted = false;
        audio.volume = 1;
        audio.setAttribute("playsinline", "true");
        (audio as HTMLAudioElement & { playsInline?: boolean }).playsInline =
          true;

        const cleanup = () => {
          try {
            URL.revokeObjectURL(audioUrl);
          } catch {}
          finishSpeech();
        };

        audio.onended = cleanup;
        audio.onerror = cleanup;

        try {
          audio.load();
        } catch {}

        const mobileFallbackTimer = window.setTimeout(() => {
          // If mobile says it is playing but no progress starts, fall back to
          // system speech instead of leaving the user in silent “speaking” state.
          if (isMobileBrowser() && !didFinish && audio.currentTime < 0.05) {
            try {
              audio.pause();
            } catch {}
            try {
              URL.revokeObjectURL(audioUrl);
            } catch {}
            const fallbackStarted = speakWithSystemVoiceFallback({
              recruiterId,
              text: cleanText,
              onDone: finishSpeech,
            });
            if (!fallbackStarted) finishSpeech();
          }
        }, 1200);

        const previousCleanup = cleanup;
        audio.onended = () => {
          window.clearTimeout(mobileFallbackTimer);
          previousCleanup();
        };
        audio.onerror = () => {
          window.clearTimeout(mobileFallbackTimer);
          previousCleanup();
        };

        await audio.play();
      };

      const playWithAudioContext = async (audioBlob: Blob) => {
        const AudioContextConstructor =
          typeof window !== "undefined"
            ? window.AudioContext ||
              (window as Window & { webkitAudioContext?: typeof AudioContext })
                .webkitAudioContext
            : null;

        if (!AudioContextConstructor) {
          await playWithHtmlAudio(audioBlob);
          return;
        }

        const context =
          audioContextRef.current || new AudioContextConstructor();
        audioContextRef.current = context;
        await context.resume();

        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioBuffer = await context.decodeAudioData(arrayBuffer.slice(0));
        const source = context.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(context.destination);
        source.onended = finishSpeech;
        currentAudioSourceRef.current = source;
        source.start(0);
      };

      isSpeakingRef.current = true;
      setIsSpeaking(true);
      setIsListening(false);
      setVoiceStatus("Recruiter speaking...");

      safetyTimeout = window.setTimeout(
        finishSpeech,
        Math.min(30000, Math.max(7000, cleanText.length * 120)),
      );

      try {
        const audioBlob = await fetchElevenLabsAudio({
          recruiterId,
          text: cleanText,
        });

        // Mobile browsers are stricter about WebAudio autoplay. Use the
        // already-unlocked HTMLAudioElement first on mobile, and use
        // AudioContext only on desktop for lower latency.
        if (isMobileBrowser()) {
          await playWithHtmlAudio(audioBlob);
        } else {
          try {
            await playWithAudioContext(audioBlob);
          } catch {
            await playWithHtmlAudio(audioBlob);
          }
        }
      } catch (error) {
        console.warn("WorkZo ElevenLabs voice failed:", error);

        // Never show a scary error during the interview. If ElevenLabs or
        // mobile playback fails, use system speech as an audible fallback and
        // keep the interview moving naturally.
        const fallbackStarted = speakWithSystemVoiceFallback({
          recruiterId,
          text: cleanText,
          onDone: finishSpeech,
        });

        if (!fallbackStarted) {
          finishSpeech();
        }
      }
    },
    [recruiterId, speakerOn],
  );

  const listenForAnswer = useCallback(() => {
    if (!isLiveRef.current || isSpeakingRef.current) return;

    const Recognition = getRecognitionConstructor();
    if (!Recognition) {
      setVoiceStatus(
        "Browser speech recognition is unavailable. Type mode coming soon.",
      );
      return;
    }

    try {
      recognitionRef.current?.stop();
    } catch {}

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = activeSetup.language?.toLowerCase().startsWith("de")
      ? "de-DE"
      : "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceStatus("Listening...");
      if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = window.setTimeout(() => {
        if (!isLiveRef.current || isSpeakingRef.current) return;
        setVoiceStatus("Waiting for your answer...");
      }, 7000);
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      const error = event.error || "";
      if (error === "no-speech") {
        setVoiceStatus("I’m still listening. Try answering again.");
        window.setTimeout(() => listenForAnswer(), 700);
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
      if (isLiveRef.current && !isSpeakingRef.current) {
        setVoiceStatus("Waiting for your answer...");
      }
    };

    recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
      let capturedText = "";

      // Build the full current recognition buffer, not only the latest chunk.
      // This prevents the recruiter from reacting to half a sentence.
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        capturedText += `${result[0]?.transcript || ""} `;
      }

      const answer = capturedText.replace(/\s+/g, " ").trim();
      if (!answer || answer.length < 3) return;

      pendingAnswerRef.current = answer;
      setVoiceStatus("Listening to your answer...");

      if (finalizationTimerRef.current) {
        window.clearTimeout(finalizationTimerRef.current);
      }

      // Wait longer before treating the answer as complete. Real candidates
      // pause while thinking, so the recruiter should not jump in immediately.
      finalizationTimerRef.current = window.setTimeout(() => {
        const finalAnswer = pendingAnswerRef.current
          .replace(/\s+/g, " ")
          .trim();

        if (!finalAnswer) return;

        try {
          recognition.stop();
        } catch {}

        pendingAnswerRef.current = "";
        setIsListening(false);
        handleCandidateAnswerRef.current(finalAnswer);
      }, 7200);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [activeSetup.language]);

  const handleCandidateAnswer = useCallback(
    (answer: string) => {
      if (!isLiveRef.current) return;

      const candidateItem: TranscriptItem = {
        role: "candidate",
        text: answer,
        time: timeLabel(),
      };

      addTranscript(candidateItem);

      const currentStep = interviewStepRef.current;
      const isMetaQuestion = isClarificationOrMetaQuestion(answer);

      if (isMetaQuestion) {
        const clarificationReply = buildClarificationReply(
          answer,
          activeSetup,
          recruiterId,
        );

        setRecruiterState("engaged");
        setVoiceStatus("Recruiter is clarifying context...");

        window.setTimeout(() => {
          if (!isLiveRef.current) return;
          const recruiterReply: TranscriptItem = {
            role: "recruiter",
            text: clarificationReply,
            time: timeLabel(),
          };
          addTranscript(recruiterReply);
          speakRecruiter(clarificationReply, () => {
            window.setTimeout(() => listenForAnswer(), 650);
          });
        }, 650);
        return;
      }

      if (currentStep === "greeting") {
        interviewStepRef.current = "intro";
        const introQuestion =
          "Tell me a little about yourself and what you have been working on recently.";
        const spokenIntro = buildConversationalRecruiterSpeech({
          recruiterId,
          candidateName,
          screenQuestion: introQuestion,
          memory: memoryRef.current,
          state: "interested",
          trust: trustRef.current,
          isOpening: true,
        });

        setRecruiterState("interested");
        setVoiceStatus("Recruiter is listening naturally...");

        window.setTimeout(() => {
          if (!isLiveRef.current) return;
          const recruiterReply: TranscriptItem = {
            role: "recruiter",
            text: spokenIntro,
            time: timeLabel(),
          };
          addTranscript(recruiterReply);
          setQuestion(introQuestion);
          speakRecruiter(spokenIntro, () => {
            window.setTimeout(() => listenForAnswer(), 650);
          });
        }, 850);
        return;
      }

      if (currentStep === "intro") {
        interviewStepRef.current = "deep_dive";
        const transitionQuestion = naturalInterviewQuestions[0];
        const transitionSpeech =
          recruiterId === "startup_recruiter"
            ? `Okay, thanks. Let’s move from background to one practical example. ${transitionQuestion}`
            : recruiterId === "friendly_hr"
              ? `Thanks, that helps. I’d like to understand one real example from your experience now. ${transitionQuestion}`
              : recruiterId === "german_corporate"
                ? `Thank you. Let’s move from background to a concrete work example. ${transitionQuestion}`
                : `Thanks. Let’s move from responsibilities to one specific example. ${transitionQuestion}`;

        setRecruiterState("engaged");
        setVoiceStatus("Recruiter is moving deeper...");

        window.setTimeout(() => {
          if (!isLiveRef.current) return;
          const recruiterReply: TranscriptItem = {
            role: "recruiter",
            text: transitionSpeech,
            time: timeLabel(),
          };
          addTranscript(recruiterReply);
          setQuestion(transitionQuestion);
          speakRecruiter(transitionSpeech, () => {
            window.setTimeout(() => listenForAnswer(), 650);
          });
        }, 1050);
        return;
      }

      const previousTrust = trustRef.current;
      const currentMemory = memoryRef.current;

      let baseMemory = currentMemory;
      try {
        const signals = updateRecruiterMemory(currentMemory, answer);
        baseMemory = signals.memory;
      } catch {
        baseMemory = currentMemory;
      }

      const analysis = analyzeAnswer(
        answer,
        baseMemory,
        previousTrust,
        recruiterId,
        questionRef.current,
      );

      const nextTrust = Math.max(
        12,
        Math.min(92, previousTrust + analysis.trustDelta),
      );
      const nextMemory = updateMemoryWithAnalysis(
        baseMemory,
        analysis,
        nextTrust,
      );

      setRecruiterTrust(nextTrust);
      setRecruiterState(analysis.state);
      setRecruiterMemory(nextMemory);
      saveRecruiterMemory(nextMemory);
      setVoiceStatus(analysis.caption);

      const answerCount = getCandidateAnswerCount(transcriptRef.current) + 1;
      const nextQuestion = pickNaturalNextQuestion({
        answerCount,
        currentQuestion: questionRef.current,
      });
      const spokenReply = buildHumanReactiveFollowUp({
        recruiterId,
        answer,
        answerCount,
        nextQuestion,
        analysis,
        memory: nextMemory,
      });

      const thinkingDelay = Math.min(
        650,
        Math.max(250, Math.round(buildHumanPauseMs(analysis) * 0.45)),
      );

      setVoiceStatus("Recruiter is thinking...");

      window.setTimeout(() => {
        if (!isLiveRef.current) return;

        const recruiterReply: TranscriptItem = {
          role: "recruiter",
          text: spokenReply,
          time: timeLabel(),
        };

        addTranscript(recruiterReply);
        setQuestion(nextQuestion);
        speakRecruiter(spokenReply, () => {
          window.setTimeout(() => listenForAnswer(), 650);
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
          action: "browser_recruiter_intelligence",
          signal: analysis.signal,
          trust: nextTrust,
        },
      });
    },
    [
      activeSetup.setupId,
      addTranscript,
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

  const startStandardInterview = useCallback(async () => {
    const setup = saveLatestInterviewSetup(
      normalizeSetup(readLatestInterviewSetup()),
    );
    setActiveSetup(setup);

    try {
      await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
    } catch {
      setVoiceStatus("Microphone permission is needed to start.");
      return;
    }

    unlockRecruiterAudio();

    const profile = getRecruiterVoiceProfile(setup.recruiterPersonality);
    const recruiterVoiceId = openAiVoiceIdForRecruiter(
      setup.recruiterPersonality as RecruiterId,
    );
    try {
      console.info("WorkZo recruiter voice mapping", {
        recruiter: profile.name,
        standardVoiceEngine: "ElevenLabs",
        mappedVoice: recruiterVoiceId,
        mode: "voice",
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
    setElapsed(0);
    setRecruiterMemory(memory);
    setRecruiterTrust(memory.recruiterTrust || 58);
    setRecruiterState("interested");
    setQuestion(firstQuestion);
    setVoiceStatus("Recruiter opening...");
    saveRecruiterMemory(memory);
    hasGreetedRef.current = true;
    interviewStepRef.current = "greeting";
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
      window.setTimeout(() => listenForAnswer(), 650);
    });
  }, [addTranscript, listenForAnswer, speakRecruiter, unlockRecruiterAudio]);

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
    try {
      recognitionRef.current?.stop();
    } catch {}
    try {
      const audio = currentRecruiterAudioRef.current;
      audio?.pause();
      if (audio?.parentNode) audio.parentNode.removeChild(audio);
      currentRecruiterAudioRef.current = null;
    } catch {}

    try {
      window.localStorage.setItem(
        "workzo-last-results",
        JSON.stringify({
          setup: activeSetup,
          recruiterTrust,
          transcript,
          scores: {
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
          },
          memory: recruiterMemory,
        }),
      );
    } catch {}

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
    market,
    recruiterMemory,
    recruiterProfile.name,
    recruiterTrust,
    role,
    transcript,
  ]);

  const handleMicClick = useCallback(() => {
    unlockRecruiterAudio();

    if (isLive) {
      if (!isSpeaking) {
        listenForAnswer();
      }
      return;
    }
    void startStandardInterview();
  }, [
    isLive,
    isSpeaking,
    listenForAnswer,
    startStandardInterview,
    unlockRecruiterAudio,
  ]);

  const handleModeChange = useCallback(
    (nextMode: InterviewMode) => {
      if (isLiveRef.current) stopInterview();
      setMode(nextMode);
      setVoiceStatus(
        nextMode === "video"
          ? "Live video mode is available for premium testing"
          : "Ready for interview",
      );
    },
    [stopInterview],
  );

  const handleToggleSpeaker = useCallback(() => {
    setSpeakerOn((value) => !value);
    if (speakerOn) {
      try {
        currentAudioSourceRef.current?.stop();
        currentAudioSourceRef.current = null;
      } catch {}
      try {
        currentRecruiterAudioRef.current?.pause();
        currentRecruiterAudioRef.current = null;
      } catch {}
      isSpeakingRef.current = false;
      setIsSpeaking(false);
    }
  }, [speakerOn]);

  const recruiterName = recruiterProfile.name || "Priya";
  const recruiterRole = recruiterProfile.role || "Startup Recruiter";

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
    <main className="relative h-screen w-full overflow-hidden bg-[#020617] p-0 text-white">
      <Link
        href="/dashboard"
        className="absolute left-7 top-6 z-50 hidden h-[46px] items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.045] px-5 text-sm font-black text-slate-200 backdrop-blur-xl hover:bg-white/10 lg:flex"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      {mode === "video" ? (
        <div className="relative h-full min-h-screen overflow-hidden bg-[#020617]">
          <div className="block h-full lg:hidden">
            <MobileInterviewRoom
              recruiterName={recruiterName}
              recruiterRole={recruiterRole}
              recruiterImageSrc={recruiterImagePath(recruiterName, recruiterId)}
              question="Live Interview is ready. Use Standard Interview for the stable Product Hunt demo."
              status={voiceStatus}
              isLive={false}
              isSpeaking={false}
              isListening={false}
              recruiterState={recruiterState}
              recruiterTrust={recruiterTrust}
              selectedMode={mode}
              onSelectMode={handleModeChange}
              elapsed={elapsed}
              transcript={transcript}
              onMicClick={() => handleModeChange("standard")}
              onEndInterview={stopInterview}
              speakerOn={speakerOn}
              onToggleSpeaker={handleToggleSpeaker}
            />
          </div>
          <div className="hidden h-full lg:block">
            <InterviewRoom
              recruiterName={recruiterName}
              recruiterRole={recruiterRole}
              recruiterId={recruiterId}
              question="Live Interview is ready. Use Standard Interview for the stable Product Hunt demo."
              status={voiceStatus}
              isLive={false}
              isSpeaking={false}
              isListening={false}
              isMuted={false}
              recruiterState={recruiterState}
              recruiterTrust={recruiterTrust}
              selectedMode={mode}
              onSelectMode={handleModeChange}
              elapsed={elapsed}
              transcript={transcript}
              onMicClick={() => handleModeChange("standard")}
              onEndInterview={stopInterview}
              speakerOn={speakerOn}
              onToggleSpeaker={handleToggleSpeaker}
            />
          </div>
          <div className="absolute inset-x-0 bottom-28 z-50 mx-auto hidden max-w-xl rounded-[26px] border border-violet-300/15 bg-violet-500/10 p-5 text-center backdrop-blur-2xl lg:block">
            <Video className="mx-auto h-7 w-7 text-violet-200" />
            <p className="mt-3 text-lg font-black text-white">
              Live video mode is ready for Tavus testing.
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              For the Product Hunt demo, start with Standard Interview first,
              then record Live Interview separately if Tavus is enabled.
            </p>
            <button
              type="button"
              onClick={() => handleModeChange("standard")}
              className="mt-4 rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950"
            >
              Use Standard Interview
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="block h-full lg:hidden">
            <MobileInterviewRoom
              recruiterName={recruiterName}
              recruiterRole={recruiterRole}
              recruiterImageSrc={recruiterImagePath(recruiterName, recruiterId)}
              question={question}
              status={voiceStatus}
              isLive={isLive}
              isSpeaking={isSpeaking}
              isListening={isListening}
              recruiterState={recruiterState}
              recruiterTrust={recruiterTrust}
              selectedMode={mode}
              onSelectMode={handleModeChange}
              elapsed={elapsed}
              transcript={transcript}
              onMicClick={handleMicClick}
              onEndInterview={stopInterview}
              speakerOn={speakerOn}
              onToggleSpeaker={handleToggleSpeaker}
            />
          </div>
          <div className="hidden h-full lg:block">
            <InterviewRoom
              recruiterName={recruiterName}
              recruiterRole={recruiterRole}
              recruiterId={recruiterId}
              question={question}
              status={voiceStatus}
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
              onMicClick={handleMicClick}
              onEndInterview={stopInterview}
              speakerOn={speakerOn}
              onToggleSpeaker={handleToggleSpeaker}
            />
          </div>
        </>
      )}
    </main>
  );
}
