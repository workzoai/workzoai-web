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

function readStoredSetupCandidate(): Record<string, unknown> {
  if (typeof window === "undefined") return {};

  const keys = [
    "workzo-interview-setup-v4",
    "workzo-latest-interview-setup",
    "workzo-interview-setup-latest",
    "workzo-interview-setup-v3",
    "workzo-interview-setup-v2",
    "workzo-interview-setup",
    "workzo_setup",
    "workzo-onboarding",
    "workzo_onboarding",
  ];

  for (const key of keys) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const setup = (parsed.setup || parsed.interviewSetup || parsed) as Record<
        string,
        unknown
      >;
      if (
        setup?.cvText ||
        setup?.jobDescription ||
        setup?.targetRole ||
        setup?.recruiterMemoryProfile ||
        setup?.jobMemoryProfile ||
        setup?.cvProfile ||
        setup?.jobProfile
      ) {
        return setup;
      }
    } catch {
      // Ignore malformed/localStorage data and try the next known key.
    }
  }

  return {};
}

function asCleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const clean = asCleanString(value);
    if (clean) return clean;
  }
  return "";
}

function firstObject(...values: unknown[]) {
  for (const value of values) {
    if (value && typeof value === "object") return value;
  }
  return null;
}

function normalizeSetup(
  input?: Partial<WorkZoInterviewSetup> | null,
): WorkZoInterviewSetup {
  const stored = input || readLatestInterviewSetup();
  const fallback = readStoredSetupCandidate();
  const storedSource = stored as Partial<WorkZoInterviewSetup> &
    Record<string, unknown>;
  const source = {
    ...fallback,
    ...storedSource,
  } as Partial<WorkZoInterviewSetup> & Record<string, unknown>;
  const recruiterPersonality = resolveRecruiterPersonality(source);

  const recruiterMemoryProfile = firstObject(
    storedSource.recruiterMemoryProfile,
    fallback.recruiterMemoryProfile,
    source.cvProfile,
    source.structuredCv,
    source.candidateProfile,
  );
  const jobMemoryProfile = firstObject(
    storedSource.jobMemoryProfile,
    fallback.jobMemoryProfile,
    source.jobProfile,
    source.structuredJob,
    source.roleProfile,
  );

  return {
    cvText: firstString(
      storedSource.cvText,
      fallback.cvText,
      source.resumeText,
      source.cv,
      source.resume,
      source.extractedCvText,
    ),
    jobDescription: firstString(
      storedSource.jobDescription,
      fallback.jobDescription,
      source.jdText,
      source.jobDescriptionText,
      source.jd,
      source.jobPost,
    ),
    targetRole:
      firstString(
        storedSource.targetRole,
        fallback.targetRole,
        source.role,
        source.position,
        (jobMemoryProfile as { roleTitle?: unknown } | null)?.roleTitle,
      ) || "General Role",
    targetMarket:
      firstString(
        storedSource.targetMarket,
        fallback.targetMarket,
        source.country,
        source.market,
        source.location,
      ) || "Global",
    companyStyle:
      firstString(
        storedSource.companyStyle,
        fallback.companyStyle,
        source.recruiterStyle,
      ) || "Realistic",
    recruiterPersonality,
    language:
      firstString(storedSource.language, fallback.language) || "English",
    recruiterMemoryProfile:
      recruiterMemoryProfile as WorkZoInterviewSetup["recruiterMemoryProfile"],
    jobMemoryProfile:
      jobMemoryProfile as WorkZoInterviewSetup["jobMemoryProfile"],
    source:
      (source.source as WorkZoInterviewSetup["source"]) || "latest-upload",
    setupVersion: 4,
    setupId: firstString(storedSource.setupId, fallback.setupId),
    updatedAt: firstString(storedSource.updatedAt, fallback.updatedAt),
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

function stableTextHash(text: string) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function memoryTurnIndex(memory: RecruiterMemory) {
  return (
    (memory.weakMetrics || 0) +
    (memory.ownershipIssues || 0) +
    (memory.vagueAnswers || 0) +
    (memory.strongRecoveries || 0) +
    (memory.rememberedWeaknesses?.length || 0) +
    (memory.rememberedStrengths?.length || 0)
  );
}

function pickHumanLine(
  lines: string[],
  seedSource: string,
  memory?: RecruiterMemory,
) {
  const offset = memory ? memoryTurnIndex(memory) : 0;
  return lines[(stableTextHash(seedSource) + offset) % lines.length];
}

function trimQuestionLead(text: string) {
  return text
    .replace(/^(Okay,? thanks\.?\s*)+/i, "")
    .replace(/^(Good to hear\.?\s*)+/i, "")
    .replace(/^(Good\s*[—-]\s*)+/i, "")
    .replace(/^(Alright\.?\s*)+/i, "")
    .replace(/^(That is more convincing[^.]*\.\s*)+/i, "")
    .replace(/^(Now I can see ownership and impact\.\s*)+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildHumanBridge({
  recruiterId,
  state,
  signal,
  seed,
  memory,
}: {
  recruiterId: RecruiterId;
  state: RecruiterState;
  signal?: AnswerAnalysis["signal"];
  seed: string;
  memory: RecruiterMemory;
}) {
  if (state === "recovering_trust") {
    return pickHumanLine(
      [
        "That lands better.",
        "Okay, that gives me more confidence.",
        "That version is clearer.",
        "I can follow your role more easily now.",
      ],
      seed,
      memory,
    );
  }

  if (
    state === "skeptical" ||
    state === "pressuring" ||
    state === "losing_confidence"
  ) {
    return pickHumanLine(
      [
        "Let me push on that for a moment.",
        "I want to test that a little.",
        "I’m not fully there yet.",
        "Hold on — I need to separate your role from the team’s work.",
      ],
      seed,
      memory,
    );
  }

  if (signal === "strong_metrics") {
    return pickHumanLine(
      [
        "That gives me something concrete to work with.",
        "Okay, that sounds more grounded.",
        "That is useful context.",
        "Now I’m getting a clearer picture.",
      ],
      seed,
      memory,
    );
  }

  if (recruiterId === "startup_recruiter") {
    return pickHumanLine(
      ["Got it.", "Okay.", "Right.", "Makes sense."],
      seed,
      memory,
    );
  }

  if (recruiterId === "german_corporate") {
    return pickHumanLine(
      ["Understood.", "Thank you.", "Okay.", "That helps."],
      seed,
      memory,
    );
  }

  return pickHumanLine(
    ["Okay.", "I see.", "That helps.", "Fair enough.", "Right."],
    seed,
    memory,
  );
}

function buildNaturalIntroQuestion(
  recruiterId: RecruiterId,
  answer: string,
  setup?: WorkZoInterviewSetup,
) {
  const snippet = getAnswerSnippet(answer);
  const seed = `${recruiterId}:${answer}`;
  const role = setup ? getRole(setup) : "this role";
  const jobFocus =
    setup?.jobMemoryProfile?.interviewFocus?.[0] ||
    setup?.jobMemoryProfile?.responsibilities?.[0] ||
    "the role requirements";

  if (recruiterId === "startup_recruiter") {
    return pickHumanLine(
      [
        `Let’s make this practical. Give me one recent example where you had to solve a messy problem${snippet ? ` related to ${snippet}` : ""}.`,
        `For ${role}, I care about ${jobFocus}. Give me one example that proves you can handle that in practice.`,
        "I want to move from background to evidence. Tell me about one situation where you had real responsibility.",
        "Let’s use a real example now. What is one piece of work where you clearly owned the outcome?",
      ],
      seed,
    );
  }

  if (recruiterId === "friendly_hr") {
    return pickHumanLine(
      [
        "Thanks, that gives me a starting point. Could you walk me through one real example from your recent experience?",
        `For ${role}, I want to connect your background to ${jobFocus}. What example should I look at first?`,
        "I’d like to understand how you work in practice. Tell me about one situation you handled well.",
        `Let’s stay with that background for a moment${snippet ? ` — especially ${snippet}` : ""}. What is one example that shows how you work?`,
      ],
      seed,
    );
  }

  if (recruiterId === "german_corporate") {
    return pickHumanLine(
      [
        "Thank you. Let’s move from overview to evidence. Please describe one concrete situation, your responsibility, and the result.",
        `For ${role}, one area I will test is ${jobFocus}. Please give me a concrete example that shows this.`,
        "Understood. Now give me one structured example: situation, what you personally did, and what changed afterwards.",
        "Let’s make it specific. Choose one recent example where your contribution can be clearly evaluated.",
      ],
      seed,
    );
  }

  return pickHumanLine(
    [
      "Thanks. Now I want to understand how you work, not just what you’ve done. Give me one real example.",
      `For ${role}, I’m going to test ${jobFocus}. Give me one situation where your experience connects to that.`,
      "Okay. Let’s go into one situation where you had to make a decision or take ownership.",
      "That gives me the overview. Pick one example from your experience and walk me through what happened.",
    ],
    seed,
  );
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

type WowMomentKind =
  | "quiet_progression"
  | "curiosity_spike"
  | "skeptical_pause"
  | "trust_drop"
  | "trust_recovery"
  | "panel_whisper"
  | "memory_callback"
  | "topic_switch";

type RecruiterMoodSnapshot = {
  kind: WowMomentKind;
  trust: number;
  interest: number;
  skepticism: number;
  patience: number;
  energy: number;
  caption: string;
  bridge: string;
  followUp?: string;
};

function clampScore(value: number, min = 8, max = 94) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function buildRecruiterMoodSnapshot({
  analysis,
  previousTrust,
  nextTrust,
  answer,
  memory,
  recruiterId,
  question,
  setup,
}: {
  analysis: AnswerAnalysis;
  previousTrust: number;
  nextTrust: number;
  answer: string;
  memory: RecruiterMemory;
  recruiterId: RecruiterId;
  question: string;
  setup: WorkZoInterviewSetup;
}): RecruiterMoodSnapshot {
  const clean = answer.replace(/\s+/g, " ").trim();
  const lower = clean.toLowerCase();
  const turn = memoryTurnIndex(memory) + 1;
  const seed = `${recruiterId}:${turn}:${previousTrust}:${nextTrust}:${question}:${clean}`;
  const delta = nextTrust - previousTrust;
  const hasSpecificWork =
    /customer|client|ticket|stakeholder|dashboard|analysis|support|project|process|data|report|automation|migration|incident|escalation|sales|revenue|conversion|retention|sla|api|sql|python|excel|power bi|tableau/i.test(
      clean,
    );
  const hasLeadershipSignal =
    /led|owned|decided|coordinated|managed|prioriti[sz]ed|handled|resolved|designed|implemented|launched|improved|reduced|increased/i.test(
      clean,
    );
  const hasMetricSignal =
    /\d|percent|%|hours?|days?|weeks?|months?|saved|reduced|increased|improved|faster|tickets?|customers?|users?|revenue|cost|sla|accuracy/i.test(
      clean,
    );
  const hasAvoidance =
    /not sure|maybe|kind of|sort of|basically|i think|we usually|we did|helped with|involved in/i.test(
      lower,
    );
  const context =
    `${summarizeCandidateExperience(setup)} ${summarizeJobContext(setup)}`.toLowerCase();
  const canCallback =
    turn >= 3 && stableTextHash(seed) % 6 === 0 && context.length > 40;
  const canPanelWhisper = turn >= 4 && stableTextHash(seed) % 9 === 0;
  const canTopicSwitch = turn >= 5 && stableTextHash(seed) % 7 === 0;

  let kind: WowMomentKind = "quiet_progression";
  if (delta <= -7 || analysis.state === "losing_confidence")
    kind = "trust_drop";
  else if (analysis.state === "recovering_trust" || delta >= 7)
    kind = "trust_recovery";
  else if (
    analysis.state === "skeptical" ||
    analysis.state === "pressuring" ||
    hasAvoidance
  )
    kind = "skeptical_pause";
  else if (canPanelWhisper && (hasSpecificWork || hasLeadershipSignal))
    kind = "panel_whisper";
  else if (canCallback) kind = "memory_callback";
  else if (canTopicSwitch) kind = "topic_switch";
  else if (hasSpecificWork || hasLeadershipSignal || hasMetricSignal)
    kind = "curiosity_spike";

  const skepticism = clampScore(
    45 +
      (previousTrust - nextTrust) * 1.5 +
      (hasAvoidance ? 16 : 0) +
      (analysis.state === "skeptical" || analysis.state === "pressuring"
        ? 12
        : 0),
  );
  const interest = clampScore(
    42 +
      (hasSpecificWork ? 15 : 0) +
      (hasLeadershipSignal ? 12 : 0) +
      (hasMetricSignal ? 10 : 0) +
      Math.max(0, delta) * 1.2 -
      (analysis.signal === "rambling" ? 12 : 0),
  );
  const patience = clampScore(
    70 -
      (analysis.signal === "rambling" ? 18 : 0) -
      (analysis.signal === "too_short" ? 9 : 0) -
      (kind === "trust_drop" ? 14 : 0) +
      (kind === "trust_recovery" ? 8 : 0),
  );
  const energy = clampScore(48 + interest * 0.35 - skepticism * 0.18);

  const callbacks = extractSafeCvSignals(setup);
  const callbackLine = callbacks.length
    ? pickHumanLine(
        callbacks.map(
          (item) =>
            `I’m connecting this back to your ${item.toLowerCase()} experience.`,
        ),
        seed,
        memory,
      )
    : "I’m connecting this back to what you told me earlier.";

  const panelWhisper = pickHumanLine(
    [
      "A hiring manager would probably pause on that point.",
      "Someone on the panel might ask you to prove that more tightly.",
      "That is the kind of detail a second interviewer would likely pick up.",
      "In a real panel, that answer would probably trigger one more follow-up.",
    ],
    seed,
    memory,
  );

  const bridgeByKind: Record<WowMomentKind, string[]> = {
    quiet_progression: [
      "Alright.",
      "Okay, I’m following.",
      "Right, let’s keep going.",
      "That gives me enough to move forward.",
    ],
    curiosity_spike: [
      "That part is interesting.",
      "There’s something useful in that example.",
      "I want to stay with that point for a second.",
      "That gives me a better signal than the overview.",
    ],
    skeptical_pause: [
      "Hmm. I’m not fully there yet.",
      "Let me slow you down there.",
      "I need to separate the story from the proof.",
      "I can see the situation, but not the weight of your contribution yet.",
    ],
    trust_drop: [
      "I’m going to be honest — that answer made me less certain.",
      "I’m losing the thread a little here.",
      "That sounded less convincing than your earlier answer.",
      "I need a cleaner answer before I can judge the strength of that example.",
    ],
    trust_recovery: [
      "That was a stronger recovery.",
      "Okay, now your role is clearer.",
      "That answer brought the conversation back on track.",
      "That landed much better than the first version.",
    ],
    panel_whisper: [panelWhisper],
    memory_callback: [callbackLine],
    topic_switch: [
      "I have enough on that for now.",
      "Let’s park that and test a different angle.",
      "I’m going to change direction for a moment.",
      "Let’s move away from that example and look at judgment.",
    ],
  };

  const captionByKind: Record<WowMomentKind, string> = {
    quiet_progression: "Recruiter is moving the conversation forward",
    curiosity_spike: "Recruiter attention increased",
    skeptical_pause: "Recruiter is testing believability",
    trust_drop: "Recruiter confidence dropped",
    trust_recovery: "Recruiter confidence is recovering",
    panel_whisper: "Panel-pressure moment triggered",
    memory_callback: "Recruiter connected earlier context",
    topic_switch: "Recruiter is changing direction",
  };

  const bridge = pickHumanLine(bridgeByKind[kind], seed, memory);
  return {
    kind,
    trust: nextTrust,
    interest,
    skepticism,
    patience,
    energy,
    caption: captionByKind[kind],
    bridge,
  };
}

function buildWowFollowUp({
  mood,
  baseFollowUp,
  answer,
  recruiterId,
  setup,
  memory,
  question,
}: {
  mood: RecruiterMoodSnapshot;
  baseFollowUp: string;
  answer: string;
  recruiterId: RecruiterId;
  setup: WorkZoInterviewSetup;
  memory: RecruiterMemory;
  question: string;
}) {
  const clean = answer.replace(/\s+/g, " ").trim();
  const seed = `${mood.kind}:${recruiterId}:${question}:${clean}:${memoryTurnIndex(memory)}`;
  const role = getRole(setup);
  const jobFocus =
    setup.jobMemoryProfile?.interviewFocus?.[0] ||
    setup.jobMemoryProfile?.responsibilities?.[0] ||
    setup.jobMemoryProfile?.requiredSkills?.[0] ||
    "the role";

  if (mood.kind === "trust_drop") {
    return pickHumanLine(
      [
        "Give me one specific moment from that situation where your decision changed the outcome.",
        "Let’s reset that answer. What exactly did you own, and what changed because of it?",
        "Narrow it to one real example. What happened, what did you do, and what was the result?",
      ],
      seed,
      memory,
    );
  }

  if (mood.kind === "skeptical_pause") {
    return pickHumanLine(
      [
        "What would your manager say was your personal contribution there?",
        "What part of that was actually difficult, not just routine?",
        "How do I know that was your impact and not just the team’s normal process?",
        "What evidence would prove that this worked?",
      ],
      seed,
      memory,
    );
  }

  if (mood.kind === "trust_recovery") {
    return pickHumanLine(
      [
        `Now connect that same clarity to ${role}. Where would this help you in the first 90 days?`,
        "Good. Let’s raise the difficulty: tell me about a time the answer was not obvious.",
        "That was clearer. Now give me one example where you had to handle pressure without a perfect solution.",
      ],
      seed,
      memory,
    );
  }

  if (mood.kind === "panel_whisper") {
    return pickHumanLine(
      [
        "If I brought in the hiring manager now, what detail would you want them to remember from that answer?",
        "Let’s imagine the hiring manager challenges that. What would you say in one sentence?",
        "What is the business reason that example matters?",
      ],
      seed,
      memory,
    );
  }

  if (mood.kind === "memory_callback") {
    return pickHumanLine(
      [
        `Earlier context matters here. How does that experience make you stronger for ${jobFocus}?`,
        "Connect the dots for me: what did that earlier experience teach you that applies here?",
        "Was that a one-time example, or is that how you normally handle similar situations?",
      ],
      seed,
      memory,
    );
  }

  if (mood.kind === "topic_switch") {
    return pickHumanLine(
      [
        "Tell me about a judgment call where there was no perfect answer.",
        "Let’s switch to pressure. Describe a moment where something went wrong and you had to recover.",
        `For ${role}, I need to understand how you think. Walk me through a decision you made with incomplete information.`,
      ],
      seed,
      memory,
    );
  }

  if (mood.kind === "curiosity_spike") {
    return pickHumanLine(
      [
        "What made that example harder than it sounds?",
        "What did you personally notice before others did?",
        "What changed after you handled it?",
        "Why was that the right approach at the time?",
      ],
      seed,
      memory,
    );
  }

  return baseFollowUp;
}

function upgradeAnalysisWithWowLayer({
  analysis,
  previousTrust,
  nextTrust,
  answer,
  memory,
  recruiterId,
  question,
  setup,
}: {
  analysis: AnswerAnalysis;
  previousTrust: number;
  nextTrust: number;
  answer: string;
  memory: RecruiterMemory;
  recruiterId: RecruiterId;
  question: string;
  setup: WorkZoInterviewSetup;
}): AnswerAnalysis {
  const mood = buildRecruiterMoodSnapshot({
    analysis,
    previousTrust,
    nextTrust,
    answer,
    memory,
    recruiterId,
    question,
    setup,
  });

  return {
    ...analysis,
    caption: mood.caption,
    bridge: mood.bridge,
    followUp: buildWowFollowUp({
      mood,
      baseFollowUp: analysis.followUp,
      answer,
      recruiterId,
      setup,
      memory,
      question,
    }),
  };
}

function buildOpeningContextAwareQuestion(
  recruiterId: RecruiterId,
  setup: WorkZoInterviewSetup,
) {
  const role = getRole(setup);
  const company = getCompany(setup);
  const experience = summarizeCandidateExperience(setup);
  const job = summarizeJobContext(setup);
  const seed = `${recruiterId}:${role}:${company}:${experience}:${job}`;

  if (experience && job) {
    return pickHumanLine(
      [
        `I have your background and the ${role} context in front of me. Start with the part of your experience that best explains why this role makes sense now.`,
        `Before we go into examples, connect your recent experience to ${role}. What should I pay attention to?`,
        `I can see some useful signals in your profile. Give me the short version of your background, but keep it close to ${role}.`,
      ],
      seed,
    );
  }

  if (experience) {
    return pickHumanLine(
      [
        "I have your background in front of me. Start with the part of your experience you think matters most for this interview.",
        "Walk me through your recent work, but focus on the parts you would want a recruiter to remember.",
        "Give me the short version of your background and the kind of work you want to be evaluated for.",
      ],
      seed,
    );
  }

  return "Tell me a little about yourself and what you have been working on recently.";
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
  if (preferred) {
    if (runtimeVoice.gender === "female" && isLikelyMaleVoice(preferred)) {
      // Some browsers expose ambiguous English defaults that can be male.
      // Do not let a female recruiter map to a clearly male browser voice.
    } else {
      return preferred;
    }
  }

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
  const question = trimQuestionLead(screenQuestion.replace(/\s+/g, " ").trim());
  const seed = `${recruiterId}:${state}:${trust}:${question}`;

  if (isOpening) {
    const firstName = getFirstName(candidateName);

    if (/how are you/i.test(question)) {
      if (recruiterId === "startup_recruiter")
        return firstName
          ? `Hi ${firstName}. Can you hear me clearly?`
          : "Hi. Can you hear me clearly?";
      if (recruiterId === "friendly_hr")
        return firstName
          ? `Hi ${firstName}, nice to meet you. How are you today?`
          : "Hi, nice to meet you. How are you today?";
      if (recruiterId === "german_corporate")
        return firstName
          ? `Hello ${firstName}. Before we begin, how are you today?`
          : "Hello. Before we begin, how are you today?";
      return firstName
        ? `Hi ${firstName}. How are you today?`
        : "Hi. How are you today?";
    }

    if (/tell me a little about yourself/i.test(question)) {
      if (recruiterId === "startup_recruiter")
        return pickHumanLine(
          [
            "Great. Give me the short version of your background — recent work, what you handled, and why this role makes sense now.",
            "Okay. Start with your recent work and the kind of problems you usually handle.",
            "Good. Walk me through your background briefly, but keep it close to this role.",
          ],
          seed,
          memory,
        );
      if (recruiterId === "friendly_hr")
        return pickHumanLine(
          [
            "Good to hear. Let’s start with your background — what have you been working on recently?",
            "Nice. Tell me a little about yourself, especially the experience that connects to this role.",
            "Alright. I’d like to understand your story first — how did your recent experience lead you here?",
          ],
          seed,
          memory,
        );
      if (recruiterId === "german_corporate")
        return pickHumanLine(
          [
            "Thank you. Let’s begin with your background. Please keep it structured: recent work, key strengths, and relevance to this role.",
            "Good. Start with your recent professional experience and the main reason this position fits your profile.",
            "Alright. Give me a concise overview of your background and the parts most relevant for this role.",
          ],
          seed,
          memory,
        );
      return pickHumanLine(
        [
          "Good. Walk me through your recent experience and what brings you to this role.",
          "Okay. Start with your background, but focus on the work that matters most for this position.",
          "Let’s begin with you. What have you been doing recently, and why does this role fit?",
        ],
        seed,
        memory,
      );
    }

    return softenRecruiterSpeech(question);
  }

  const spokenQuestion = softenRecruiterSpeech(question);
  const spokenBridge = bridge
    ? softenRecruiterSpeech(trimQuestionLead(bridge))
    : buildHumanBridge({ recruiterId, state, seed, memory });
  const shouldOnlyAsk =
    state === "engaged" && trust > 72 && stableTextHash(seed) % 5 === 0;
  if (shouldOnlyAsk) return spokenQuestion;

  const naturalBridge =
    spokenBridge || buildHumanBridge({ recruiterId, state, seed, memory });
  return `${naturalBridge} ${spokenQuestion}`
    .replace(/\bOkay, thanks\.\s*/gi, "")
    .replace(/\bGood to hear\.\s*/gi, "")
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
  const seed = `${recruiterId}:${currentQuestion}:${clean}:${memoryTurnIndex(memory)}`;

  const hasNumber =
    /\d|percent|percentage|hours?|days?|weeks?|months?|customers?|tickets?|users?|reduced|increased|saved|improved|faster|slower|revenue|cost|accuracy|quality|volume|sla|kpi/i.test(
      clean,
    );
  const ownershipWords =
    /\bi\b|\bmy\b|\bpersonally\b|\bled\b|\bbuilt\b|\bcreated\b|\bowned\b|\bhandled\b|\bresolved\b|\bimplemented\b|\banalyzed\b|\bdesigned\b|\bimproved\b|\bdecided\b|\bcoordinated\b/i.test(
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
  const bridgeFor = (
    signal?: AnswerAnalysis["signal"],
    state: RecruiterState = "interested",
  ) => buildHumanBridge({ recruiterId, state, signal, seed, memory });

  if (words.length < 8 && !isLikelyInterviewAnswer(clean)) {
    return {
      signal: "good_ownership",
      state: "interested",
      trustDelta: 0,
      caption: "Recruiter is keeping the conversation natural",
      bridge: bridgeFor("good_ownership"),
      followUp: pickHumanLine(
        [
          "Could you give me a little more context so I can understand your answer properly?",
          "Say a bit more about that — what was the situation?",
          "Help me understand the background first.",
        ],
        seed,
        memory,
      ),
    };
  }

  if (words.length < 18 && isLikelyInterviewAnswer(clean)) {
    return {
      signal: "too_short",
      state: "interested",
      trustDelta: 0,
      caption: "Recruiter is inviting more context",
      bridge: bridgeFor("too_short"),
      followUp: pickHumanLine(
        [
          "Stay with that example for a moment — what was happening around it?",
          "What was the situation, and what were you expected to handle?",
          "Can you walk me through it from the beginning?",
        ],
        seed,
        memory,
      ),
    };
  }

  if (words.length > 160) {
    return {
      signal: "rambling",
      state: "interested",
      trustDelta: -3,
      caption: "Recruiter is guiding the answer gently",
      bridge: pickHumanLine(
        [
          "There’s a lot in that answer.",
          "Let me narrow this down a little.",
          "I’m going to pull one thread from that.",
        ],
        seed,
        memory,
      ),
      followUp: pickHumanLine(
        [
          "What was the most important decision you personally made there?",
          "Which part of that outcome depended most on you?",
          "What should I remember from that example?",
        ],
        seed,
        memory,
      ),
      weakness: "Answer could be more focused.",
    };
  }

  if (!ownershipWords) {
    const nextState: RecruiterState = repeatedOwnershipIssue
      ? "skeptical"
      : "interested";
    return {
      signal: "unclear_ownership",
      state: nextState,
      trustDelta: repeatedOwnershipIssue ? -4 : -2,
      caption: "Recruiter is exploring ownership",
      bridge: bridgeFor("unclear_ownership", nextState),
      followUp: pickHumanLine(
        [
          "Where exactly did your responsibility begin and end?",
          "What part of that was actually handled by you?",
          "If I asked your manager, what would they say you personally owned?",
          "Were you leading that, supporting it, or executing a specific part?",
        ],
        seed,
        memory,
      ),
      weakness: "Ownership needs clearer detail.",
    };
  }

  if (!hasNumber) {
    const nextState: RecruiterState = repeatedMetricsIssue
      ? "skeptical"
      : "interested";
    return {
      signal: "missing_metrics",
      state: nextState,
      trustDelta: repeatedMetricsIssue ? -4 : -2,
      caption: "Recruiter is exploring impact",
      bridge: bridgeFor("missing_metrics", nextState),
      followUp: pickHumanLine(
        [
          "How did you know it worked?",
          "What changed after your work — even roughly?",
          "What was the visible result for the team, customer, or business?",
          "Was there any sign that the situation improved because of what you did?",
        ],
        seed,
        memory,
      ),
      weakness: "Impact could be more measurable.",
    };
  }

  if (vagueWords && words.length < 70) {
    return {
      signal: "too_generic",
      state: "interested",
      trustDelta: -2,
      caption: "Recruiter is asking for a concrete example",
      bridge: bridgeFor("too_generic"),
      followUp: pickHumanLine(
        [
          "Can you anchor that in one specific moment?",
          "Give me the actual situation, not the general idea.",
          "What is one example you remember clearly?",
        ],
        seed,
        memory,
      ),
      weakness: "Answer could use a more concrete example.",
    };
  }

  if (previousTrust < 50) {
    return {
      signal: "recovery",
      state: "recovering_trust",
      trustDelta: 10,
      caption: "Recruiter sees recovery",
      bridge: bridgeFor("recovery", "recovering_trust"),
      followUp: pickHumanLine(
        [
          "Let’s see if that holds in another situation. Tell me about a time you had to handle pressure.",
          "That helps. Now give me an example where things did not go smoothly.",
          "Okay. Take another example where you had to convince someone or make a difficult choice.",
        ],
        seed,
        memory,
      ),
      strength: "Recovered with clearer evidence.",
    };
  }

  if (hasNumber && ownershipWords) {
    const topic = currentQuestion.toLowerCase().includes("conflict")
      ? "that situation"
      : currentQuestion.toLowerCase().includes("project")
        ? "that project"
        : "that example";
    return {
      signal: "strong_metrics",
      state: "engaged",
      trustDelta: 7,
      caption: "Recruiter is engaged by concrete evidence",
      bridge: bridgeFor("strong_metrics", "engaged"),
      followUp: pickHumanLine(
        [
          `What was the part of ${topic} that could have gone wrong?`,
          `What did you have to decide for yourself in ${topic}?`,
          `Who else was involved, and how did you influence them?`,
          `If you had to do ${topic} again, what would you change?`,
          "Let’s switch angle for a second — tell me about a time you disagreed with someone at work.",
        ],
        seed,
        memory,
      ),
      strength: "Clear ownership with measurable impact.",
    };
  }

  return {
    signal: "good_ownership",
    state: "interested",
    trustDelta: 5,
    caption: "Recruiter engaged by specifics",
    bridge: bridgeFor("good_ownership"),
    followUp: pickHumanLine(
      [
        "What was the hardest part of that for you?",
        "How did other people respond to your approach?",
        "What did you learn from that situation?",
        "What would have happened if you had not stepped in?",
      ],
      seed,
      memory,
    ),
    strength: "Answer showed useful specificity.",
  };
}
function isInterviewControlQuestion(answer: string) {
  const lower = answer.replace(/\s+/g, " ").trim().toLowerCase();
  if (!lower) return false;

  return (
    /\b(what do i need to do|what should i do|what am i supposed to do|how does this work|what happens now|what is next|what should i answer|how should i answer)\b/.test(lower) ||
    /\b(can you repeat|repeat the question|say that again|what was the question|explain the question|i didn'?t understand the question|help me understand)\b/.test(lower) ||
    /\b(start again|restart|reset the interview|pause the interview|stop the interview)\b/.test(lower)
  );
}

function isGreetingOrCourtesy(answer: string) {
  const lower = answer.replace(/\s+/g, " ").trim().toLowerCase();
  if (!lower) return false;

  if (/^(hi|hello|hey|good morning|good afternoon|good evening)[!. ]*$/.test(lower)) return true;
  if (/^(i'?m|i am)?\s*(good|fine|great|okay|ok|doing well|well)\s*(thank you|thanks|thankyou)?[,.! ]*(and you|how are you|what about you)?[?.! ]*$/.test(lower)) return true;
  if (/\b(how are you|how are you doing|nice to meet you|thank you|thanks)\b/.test(lower) && lower.split(/\s+/).length <= 12) return true;

  return false;
}

function isClarificationOrMetaQuestion(answer: string) {
  const lower = answer.replace(/\s+/g, " ").trim().toLowerCase();
  if (!lower) return false;

  if (isInterviewControlQuestion(answer)) return true;

  const clarificationPatterns = [
    /\b(can|could|do|did) you (see|read|have|access|look at|review)\b.*\b(resume|cv|job description|jd|job|role)\b/,
    /\b(resume|cv|job description|jd)\b.*\b(see|read|review|access|available|loaded|uploaded)\b/,
    /\bwhat\b.*\b(role|company|job|position|interview|question|task)\b/,
    /\bwhich\b.*\b(role|company|job|position|interview|question)\b/,
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

function joinHumanList(items: string[], limit = 4) {
  const clean = items
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
  if (!clean.length) return "";
  if (clean.length === 1) return clean[0];
  return `${clean.slice(0, -1).join(", ")} and ${clean[clean.length - 1]}`;
}

function summarizeCandidateExperience(setup: WorkZoInterviewSetup) {
  const profile = setup.recruiterMemoryProfile;
  const parts: string[] = [];

  if (profile?.experience?.length) {
    const experience = profile.experience
      .slice(0, 2)
      .map((item) => {
        const role = item.role || "experience";
        const company = item.company ? ` at ${item.company}` : "";
        const highlight = item.highlights?.[0]
          ? ` — ${item.highlights[0]}`
          : "";
        return `${role}${company}${highlight}`;
      })
      .filter(Boolean);
    if (experience.length) parts.push(`experience: ${experience.join("; ")}`);
  }

  const technical = joinHumanList(profile?.skills?.technical || [], 5);
  const business = joinHumanList(profile?.skills?.business || [], 4);
  const tools = joinHumanList(profile?.skills?.tools || [], 4);
  if (technical) parts.push(`technical skills: ${technical}`);
  if (business) parts.push(`business/support skills: ${business}`);
  if (tools) parts.push(`tools: ${tools}`);

  if (profile?.projects?.length) {
    const projects = profile.projects
      .slice(0, 2)
      .map((project) => project.name || project.summary)
      .filter(Boolean);
    if (projects.length) parts.push(`projects: ${projects.join(", ")}`);
  }

  if (parts.length) return parts.join(". ");

  const cv = buildCandidateContext(setup);
  if (!cv) return "";
  return cv.slice(0, 650).replace(/\s+/g, " ");
}

function summarizeJobContext(setup: WorkZoInterviewSetup) {
  const job = setup.jobMemoryProfile;
  const parts: string[] = [];

  const role = job?.roleTitle || getRole(setup);
  if (role && role !== "General Role" && role !== "Target Role") {
    parts.push(`role: ${role}`);
  }

  const responsibilities = joinHumanList(job?.responsibilities || [], 4);
  const requiredSkills = joinHumanList(job?.requiredSkills || [], 5);
  const softSkills = joinHumanList(job?.softSkills || [], 4);
  const focus = joinHumanList(job?.interviewFocus || [], 3);
  if (job?.businessContext)
    parts.push(`business context: ${job.businessContext}`);
  if (responsibilities) parts.push(`responsibilities: ${responsibilities}`);
  if (requiredSkills) parts.push(`required skills: ${requiredSkills}`);
  if (softSkills) parts.push(`soft skills: ${softSkills}`);
  if (focus) parts.push(`interview focus: ${focus}`);

  if (parts.length) return parts.join(". ");

  const jd = buildJobContext(setup);
  if (!jd) return "";
  return jd.slice(0, 650).replace(/\s+/g, " ");
}

function asksForExactAvailableContext(answer: string) {
  const lower = answer.replace(/\s+/g, " ").toLowerCase();
  return (
    /\bwhat\b.*\b(experience|cv|resume|background|jd|job description|role details|details)\b.*\b(see|read|have|know|available|loaded)\b/.test(
      lower,
    ) ||
    /\b(what|which)\b.*\b(experience|jd|job description|resume|cv)\b/.test(
      lower,
    ) ||
    /\bshow\b.*\b(cv|resume|jd|job description|experience|details)\b/.test(
      lower,
    )
  );
}

function buildAvailableContextReply(setup: WorkZoInterviewSetup) {
  const experience = summarizeCandidateExperience(setup);
  const job = summarizeJobContext(setup);
  const role = getRole(setup);

  if (experience && job) {
    return `Yes — I can see both sides. From your profile, I’m seeing ${experience}. From the job description, I’m seeing ${job}. So I’ll interview you for ${role}, and I’ll check whether your examples prove the role requirements rather than just repeating your CV.`;
  }

  if (experience) {
    return `I can see your candidate background. The main signals I have are: ${experience}. I don’t have a strong job-description text loaded, so I’ll ask role-fit questions more broadly for ${role}.`;
  }

  if (job) {
    return `I can see the job context. The main role signals are: ${job}. I don’t have enough CV detail loaded, so I’ll ask you to explain your experience directly and I’ll compare it against this role.`;
  }

  return "I can see the interview setup, but I don’t have enough readable CV or job-description detail loaded. That means I should not pretend I know your background. Tell me the role and one or two key experiences, and I’ll interview from there.";
}

type RecruiterKnowledgeHit = {
  name: string;
  short: string;
  interviewAngle: string;
};

type CandidateIntent =
  | "interview_answer"
  | "context_question"
  | "company_question"
  | "concept_question"
  | "correction_or_fact_check"
  | "sense_check"
  | "small_talk";

const recruiterKnowledgeBase: RecruiterKnowledgeHit[] = [
  {
    name: "Tesla",
    short:
      "Tesla is known for electric vehicles, batteries, energy products, charging infrastructure, and software-heavy manufacturing.",
    interviewAngle:
      "For a Tesla-style interview, I would listen for speed, ownership, problem-solving under pressure, and measurable execution.",
  },
  {
    name: "Microsoft",
    short:
      "Microsoft is known for Azure, Microsoft 365, Windows, developer tools, security, gaming, and enterprise AI products.",
    interviewAngle:
      "For a Microsoft-style interview, I would listen for structured thinking, collaboration, customer impact, and learning mindset.",
  },
  {
    name: "Amazon",
    short:
      "Amazon is known for e-commerce, AWS, logistics, marketplace operations, devices, advertising, and operational excellence.",
    interviewAngle:
      "For an Amazon-style interview, I would expect ownership, metrics, customer impact, trade-offs, and concise behavioral examples.",
  },
  {
    name: "Google",
    short:
      "Google is known for search, ads, Android, YouTube, cloud, AI, and large-scale consumer and enterprise products.",
    interviewAngle:
      "For a Google-style interview, I would listen for problem-solving clarity, collaboration, technical reasoning, and user impact.",
  },
  {
    name: "Apple",
    short:
      "Apple is known for consumer hardware, software, services, privacy positioning, design quality, and ecosystem thinking.",
    interviewAngle:
      "For an Apple-style interview, I would listen for product judgment, attention to detail, execution quality, and customer experience.",
  },
  {
    name: "Meta",
    short:
      "Meta is known for Facebook, Instagram, WhatsApp, ads, AI, and large-scale social products.",
    interviewAngle:
      "For a Meta-style interview, I would listen for speed, experimentation, product sense, measurable impact, and comfort with change.",
  },
  {
    name: "Zoho",
    short:
      "Zoho is a SaaS company known for business software across CRM, support, finance, collaboration, analytics, and productivity tools.",
    interviewAngle:
      "For Zoho-related experience, I would listen for customer communication, product understanding, troubleshooting depth, ownership, and how you handled B2B and B2C users differently.",
  },
  {
    name: "eBay",
    short:
      "eBay is an online marketplace known for buyer-seller commerce, payments, trust and safety, seller tools, and marketplace operations.",
    interviewAngle:
      "For an eBay-style role, I would listen for marketplace thinking, customer trust, operational judgment, data awareness, and practical problem-solving.",
  },
  {
    name: "LinkedIn",
    short:
      "LinkedIn is a professional network focused on hiring, careers, learning, ads, and professional identity.",
    interviewAngle:
      "For LinkedIn-style roles, I would listen for user empathy, professional communication, data-informed decisions, and trust in product experience.",
  },
  {
    name: "Salesforce",
    short:
      "Salesforce is known for CRM, enterprise cloud software, sales, service, marketing, analytics, and platform tools.",
    interviewAngle:
      "For Salesforce-style roles, I would listen for enterprise customer understanding, stakeholder management, CRM knowledge, and measurable business impact.",
  },
  {
    name: "SAP",
    short:
      "SAP is known for enterprise resource planning, business applications, supply chain, finance, HR, analytics, and cloud ERP.",
    interviewAngle:
      "For SAP-style roles, I would listen for enterprise process understanding, structured communication, precision, and cross-functional collaboration.",
  },
  {
    name: "Netflix",
    short:
      "Netflix is known for streaming, content technology, personalization, entertainment platforms, and data-driven product decisions.",
    interviewAngle:
      "For Netflix-style roles, I would listen for judgment, ownership, impact, clarity, and comfort with high-performance expectations.",
  },
  {
    name: "OpenAI",
    short:
      "OpenAI is known for AI models, ChatGPT, developer APIs, safety research, and AI products for consumers and businesses.",
    interviewAngle:
      "For OpenAI-style roles, I would listen for technical curiosity, user impact, careful judgment, communication clarity, and responsible execution.",
  },

  {
    name: "IBM",
    short:
      "IBM is known for enterprise technology, consulting, cloud, AI, cybersecurity, infrastructure, and large-scale business transformation.",
    interviewAngle:
      "For IBM-style roles, I would listen for structured problem-solving, enterprise customer handling, technical clarity, and stakeholder communication.",
  },
  {
    name: "Oracle",
    short:
      "Oracle is known for databases, enterprise software, cloud infrastructure, ERP, HCM, and business applications.",
    interviewAngle:
      "For Oracle-style roles, I would listen for enterprise product understanding, precision, customer impact, and technical-commercial communication.",
  },
  {
    name: "Adobe",
    short:
      "Adobe is known for creative software, document tools, marketing cloud, analytics, and digital experience products.",
    interviewAngle:
      "For Adobe-style roles, I would listen for product empathy, user experience thinking, measurable impact, and cross-functional collaboration.",
  },
  {
    name: "Uber",
    short:
      "Uber is known for mobility, delivery, marketplace operations, logistics, pricing, maps, and real-time platform reliability.",
    interviewAngle:
      "For Uber-style roles, I would listen for operational judgment, data-driven decisions, ambiguity handling, and fast execution.",
  },
  {
    name: "Airbnb",
    short:
      "Airbnb is known for travel, hosting, marketplace trust, design-led product experience, and community-driven hospitality.",
    interviewAngle:
      "For Airbnb-style roles, I would listen for trust, customer empathy, product judgment, and handling complex stakeholder needs.",
  },
  {
    name: "Spotify",
    short:
      "Spotify is known for music streaming, personalization, recommendations, creator tools, ads, and subscription products.",
    interviewAngle:
      "For Spotify-style roles, I would listen for user empathy, experimentation, product thinking, and measurable growth or engagement impact.",
  },
  {
    name: "Stripe",
    short:
      "Stripe is known for payments infrastructure, developer tools, fintech products, risk, compliance, and global internet business enablement.",
    interviewAngle:
      "For Stripe-style roles, I would listen for clarity, systems thinking, customer obsession, precision, and strong written communication.",
  },
  {
    name: "PayPal",
    short:
      "PayPal is known for digital payments, wallets, merchant services, risk management, fraud prevention, and consumer finance products.",
    interviewAngle:
      "For PayPal-style roles, I would listen for trust, risk awareness, customer impact, operational discipline, and clear communication.",
  },
  {
    name: "Accenture",
    short:
      "Accenture is known for consulting, technology services, digital transformation, cloud, data, operations, and enterprise delivery.",
    interviewAngle:
      "For Accenture-style roles, I would listen for client communication, structured delivery, adaptability, stakeholder handling, and project ownership.",
  },
  {
    name: "Deloitte",
    short:
      "Deloitte is known for consulting, audit, tax, risk advisory, technology transformation, and business services.",
    interviewAngle:
      "For Deloitte-style roles, I would listen for structured thinking, client readiness, communication maturity, and practical business judgment.",
  },
];

const commonCompanyAliases: Record<string, string> = {
  ebay: "eBay",
  zoho: "Zoho",
  tesla: "Tesla",
  amazon: "Amazon",
  microsoft: "Microsoft",
  google: "Google",
  apple: "Apple",
  meta: "Meta",
  facebook: "Meta",
  instagram: "Meta",
  linkedin: "LinkedIn",
  salesforce: "Salesforce",
  sap: "SAP",
  netflix: "Netflix",
  openai: "OpenAI",
  ibm: "IBM",
  oracle: "Oracle",
  adobe: "Adobe",
  uber: "Uber",
  airbnb: "Airbnb",
  spotify: "Spotify",
  stripe: "Stripe",
  paypal: "PayPal",
  accenture: "Accenture",
  deloitte: "Deloitte",
};

const companyQuestionPattern =
  /\b(do you know|do u know|have you heard of|have you heard about|know about|what is|what are|tell me about|can you explain|do you understand|are you aware of)\b/i;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeCompanyName(value: string) {
  const cleaned = value
    .replace(/[^a-zA-Z0-9&.\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";

  const lower = cleaned.toLowerCase();
  if (commonCompanyAliases[lower]) return commonCompanyAliases[lower];

  return cleaned
    .split(" ")
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => {
      const alias = commonCompanyAliases[word.toLowerCase()];
      if (alias) return alias;
      if (word.length <= 3 && word === word.toUpperCase()) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function detectRecruiterKnowledgeHits(answer: string) {
  const lower = answer.toLowerCase();
  return recruiterKnowledgeBase.filter((item) => {
    const escapedName = escapeRegExp(item.name.toLowerCase());
    return new RegExp(`\\b${escapedName}\\b`).test(lower);
  });
}

function extractAskedCompanyNames(answer: string) {
  const lower = answer.replace(/\s+/g, " ").trim().toLowerCase();
  const names = new Set<string>();

  detectRecruiterKnowledgeHits(answer).forEach((item) => names.add(item.name));

  Object.entries(commonCompanyAliases).forEach(([alias, display]) => {
    if (new RegExp(`\\b${escapeRegExp(alias)}\\b`, "i").test(answer)) {
      names.add(display);
    }
  });

  const directMatch = answer.match(
    /(?:do you know|do u know|have you heard of|have you heard about|know about|what is|what are|tell me about|can you explain|do you understand|are you aware of)\s+(.+?)(?:\?|$)/i,
  );

  if (directMatch?.[1]) {
    const raw = directMatch[1]
      .replace(
        /\b(company|companies|startup|startups|firm|firms|organization|organisations|organizations)\b/gi,
        " ",
      )
      .replace(/\b(or|and) other\b.*$/i, " ");

    raw
      .split(/,|\/|\bor\b|\band\b/gi)
      .map(normalizeCompanyName)
      .filter(
        (name) =>
          name.length >= 2 && !/^(it|that|this|them|those)$/i.test(name),
      )
      .forEach((name) => names.add(name));
  }

  // If the candidate says only a company name with a question mark, treat it as a company question.
  if (lower.endsWith("?") && lower.split(" ").length <= 4) {
    const guessed = normalizeCompanyName(answer.replace("?", ""));
    if (guessed) names.add(guessed);
  }

  return Array.from(names).slice(0, 4);
}

function asksIfRecruiterKnowsCompany(answer: string) {
  const lower = answer.replace(/\s+/g, " ").trim().toLowerCase();
  if (!lower) return false;
  if (/\b(b2b|b2c|sla|ats|crm|kpi|api|saas)\b/.test(lower)) return false;

  if (
    companyQuestionPattern.test(lower) &&
    extractAskedCompanyNames(answer).length > 0
  )
    return true;

  const hasKnownCompany = detectRecruiterKnowledgeHits(answer).length > 0;
  if (hasKnownCompany && /\?/.test(answer)) return true;

  // Short questions such as "Zoho?", "eBay?", "What about IBM?" should be treated
  // as recruiter-world/company context, not as interview answers.
  if (/\?$/.test(lower) && lower.split(" ").length <= 6) {
    const stripped = lower
      .replace(/\?|what about|and|or|also|then|next/gi, " ")
      .trim();
    if (stripped.length >= 2 && !/^(why|how|when|where|who)$/.test(stripped))
      return true;
  }

  return false;
}

function buildCompanyKnowledgeReply(answer: string) {
  const hits = detectRecruiterKnowledgeHits(answer);
  const askedNames = extractAskedCompanyNames(answer);
  const hitByName = new Map(
    hits.map((item) => [item.name.toLowerCase(), item]),
  );

  if (!askedNames.length) {
    return "Yes — I can discuss companies at a recruiter level. I’ll keep it brief and interview-relevant, not a long company lecture. Which company and role are you preparing for?";
  }

  if (askedNames.length === 1) {
    const asked = askedNames[0];
    const known = hitByName.get(asked.toLowerCase());

    if (known) {
      return `Yes — I know ${known.name}. Recruiter view: ${known.interviewAngle.replace(/^For .*?, I would listen for /, "I’d listen for ")} What role are you connecting ${known.name} to?`;
    }

    return `Yes — I know ${asked} at a general recruiter level. I’ll avoid pretending I have live company research in this browser interview, but I can still prepare you properly: we would connect the role to ${asked}’s product, customers, business model, and the proof in your examples. What role are you targeting there?`;
  }

  const shortList = askedNames.map((name) => {
    const known = hitByName.get(name.toLowerCase());
    if (known) return known.name;
    return name;
  });

  return `Yes — I can discuss ${joinHumanList(shortList, 4)} at an interview-prep level. I’ll keep this short: pick one company and one role, then I’ll interview you as if that recruiter is testing your fit.`;
}

function buildConceptReply(answer: string) {
  const lower = answer.toLowerCase();

  if (asksIfRecruiterKnowsCompany(answer)) {
    return buildCompanyKnowledgeReply(answer);
  }

  if (/\bb2b\b/.test(lower) || /\bb2c\b/.test(lower)) {
    return "Yes. B2B means business-to-business: the customer is another company, so interviews often look for stakeholder handling, accounts, contracts, SLAs, integrations, and escalation judgment. B2C means business-to-consumer: the customer is an individual user, so speed, empathy, clarity, and customer satisfaction matter more. If you mention both, I’ll expect one example showing how your communication changed between them.";
  }

  if (/\bsla\b/.test(lower)) {
    return "Yes. SLA means service-level agreement — the expected response or resolution standard. In support roles, I would listen for priority handling, escalation, ownership, and customer communication when an SLA was at risk.";
  }

  if (/\bats\b/.test(lower)) {
    return "Yes. ATS means applicant tracking system. In this interview, I care less about the term and more about whether your CV examples clearly match the role for both software screening and a human recruiter.";
  }

  if (/\bcrm\b/.test(lower)) {
    return "Yes. CRM means customer relationship management. In an interview, I’d connect it to how you tracked customers, handled follow-ups, managed accounts, or understood the customer lifecycle.";
  }

  if (/\bkpi\b/.test(lower)) {
    return "Yes. KPI means key performance indicator. In your answers, KPIs matter because they prove scale: response time, resolution rate, CSAT, revenue impact, conversion, quality, or efficiency.";
  }

  if (/\bapi\b/.test(lower)) {
    return "Yes. API means application programming interface. For interviews, I’d expect you to explain it practically: how systems exchange data, what problem it solved, and what your role was in using or troubleshooting it.";
  }

  if (/\bsaas\b/.test(lower)) {
    return "Yes. SaaS means software as a service. For interview prep, I’d listen for subscription-product thinking, customer retention, support quality, onboarding, renewals, and product adoption.";
  }

  return "Yes — I can answer that briefly. I’ll keep it interview-focused: definition first, then how you used it in a real situation. Ask me the term, and then I’ll bring us back to the interview.";
}

type RecruiterTruthCheck = {
  reply: string;
  severity: "light" | "firm";
};

const likelySpellingCorrections: Array<{
  pattern: RegExp;
  correct: string;
  context?: string;
}> = [
  { pattern: /\bzooho\b|\bzohoo\b|\bzohho\b|\bzoh0\b/i, correct: "Zoho" },
  { pattern: /\bebey\b|\bebayy\b|\be bay\b/i, correct: "eBay" },
  { pattern: /\bamazn\b|\bamazone\b|\bamzon\b/i, correct: "Amazon" },
  { pattern: /\bteslsa\b|\btesela\b|\btelsa\b/i, correct: "Tesla" },
  {
    pattern: /\bmicrosft\b|\bmicrosof\b|\bmicro soft\b/i,
    correct: "Microsoft",
  },
  { pattern: /\bgooogle\b|\bgogle\b/i, correct: "Google" },
  { pattern: /\blinkdin\b|\blinked in\b/i, correct: "LinkedIn" },
  {
    pattern: /\bsales force\b/i,
    correct: "Salesforce",
    context: "as the company/product name",
  },
  {
    pattern: /\bopen ai\b/i,
    correct: "OpenAI",
    context: "as the company name",
  },
  {
    pattern: /\bpay pal\b/i,
    correct: "PayPal",
    context: "as the company name",
  },
];


const knownInterviewEntities = [
  "Zoho",
  "eBay",
  "Amazon",
  "Tesla",
  "Microsoft",
  "Google",
  "LinkedIn",
  "Salesforce",
  "OpenAI",
  "PayPal",
  "HubSpot",
  "Shopify",
  "Netflix",
  "Meta",
  "Apple",
  "Oracle",
  "SAP",
  "ServiceNow",
  "Zendesk",
  "Freshworks",
  "Atlassian",
  "Jira",
  "Slack",
  "Notion",
  "Figma",
  "Canva",
  "Stripe",
  "Airbnb",
  "Uber",
  "Adobe",
  "GitHub",
  "ChatGPT",
  "Salesforce CRM",
  "Zoho CRM",
];

function normalizeEntityToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function levenshteinDistance(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0),
  );
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[a.length][b.length];
}

function detectFuzzyEntityCorrection(answer: string): RecruiterTruthCheck | null {
  const rawTokens = answer.match(/\b[A-Za-z][A-Za-z0-9-]{2,}\b/g) ?? [];
  const tokens = Array.from(new Set(rawTokens)).slice(0, 18);

  for (const token of tokens) {
    const normalizedToken = normalizeEntityToken(token);
    if (normalizedToken.length < 4) continue;

    for (const entity of knownInterviewEntities) {
      const normalizedEntity = normalizeEntityToken(entity);
      if (normalizedToken === normalizedEntity) continue;
      if (Math.abs(normalizedToken.length - normalizedEntity.length) > 2) continue;

      const distance = levenshteinDistance(normalizedToken, normalizedEntity);
      const threshold = normalizedEntity.length <= 5 ? 1 : 2;
      if (distance > 0 && distance <= threshold) {
        return {
          severity: "light",
          reply: `Small correction — I think you mean ${entity}. I’m not saying this to be strict; in a real interview, confident naming matters. Continue, but phrase it accurately.`,
        };
      }
    }
  }

  return null;
}

function detectLikelySpellingCorrection(
  answer: string,
): RecruiterTruthCheck | null {
  for (const item of likelySpellingCorrections) {
    if (item.pattern.test(answer)) {
      return {
        severity: "light",
        reply: `Small correction — I think you mean ${item.correct}${item.context ? ` ${item.context}` : ""}. That matters in an interview because names should sound precise. Go on — what were you connecting it to?`,
      };
    }
  }
  return null;
}

const factCorrectionRules: Array<{
  pattern: RegExp;
  reply: string;
  severity: "light" | "firm";
}> = [
  {
    pattern:
      /\btesla\b.{0,120}\b(engine|combustion engine|petrol engine|gas engine|diesel engine)\b|\b(engine|combustion engine|petrol engine|gas engine|diesel engine)\b.{0,120}\btesla\b/i,
    severity: "firm",
    reply:
      "I’m going to stop you there because that sounds inaccurate. Tesla is primarily an electric vehicle company, so saying you designed an ‘engine’ there is not the right wording unless you mean electric motor, powertrain, battery system, thermal system, or manufacturing component. In a real interview, that kind of claim would immediately need clarification. What exactly did you design, and was this a real role or a hypothetical example?",
  },
  {
    pattern:
      /\b(i|i\s+have|i\s+had|i\s+was)\b.{0,60}\b(designed|built|created|invented|launched)\b.{0,70}\b(chatgpt|gpt-4|iphone|windows|google search|amazon prime|tesla autopilot|tesla engine|facebook|instagram|youtube)\b/i,
    severity: "firm",
    reply:
      "I need to challenge that. That sounds like a very large public-product claim, and a real interviewer would not accept it without precise evidence. Be careful: if the claim is exaggerated or hypothetical, say so. If it is true, explain your exact scope, team, dates, and contribution in one sentence.",
  },
  {
    pattern:
      /\b(i\s+was|i\s+worked\s+as|my\s+role\s+was)\b.{0,60}\b(ceo|cto|founder|head of|vp|director)\b.{0,80}\b(amazon|tesla|microsoft|google|apple|meta|netflix|openai)\b/i,
    severity: "firm",
    reply:
      "I’m going to treat that carefully. That is a senior public-company claim, so in a real interview I would ask for verification and exact scope before accepting it. If you mean a project title, internship, team role, or simulation, phrase it accurately. What was your actual position and responsibility?",
  },
  {
    pattern:
      /\btesla\b.{0,60}\b(found|founded|started|created)\b.{0,40}\b(elon|musk)\b|\b(elon|musk)\b.{0,40}\b(found|founded|started|created)\b.{0,60}\btesla\b/i,
    severity: "firm",
    reply:
      "Small correction before we continue: Tesla was founded by Martin Eberhard and Marc Tarpenning. Elon Musk joined very early, invested, and later became CEO — but saying he founded it would be inaccurate in an interview.",
  },
  {
    pattern:
      /\bamazon\b.{0,70}\b(found|founded|started|created)\b.{0,45}\b(elon|musk|bill gates|steve jobs)\b|\b(elon|musk|bill gates|steve jobs)\b.{0,45}\b(found|founded|started|created)\b.{0,70}\bamazon\b/i,
    severity: "firm",
    reply:
      "Careful — Amazon was founded by Jeff Bezos. If you mention company background in an interview, keep it accurate and very brief.",
  },
  {
    pattern:
      /\bmicrosoft\b.{0,70}\b(found|founded|started|created)\b.{0,45}\b(steve jobs|elon|musk|jeff bezos)\b|\b(steve jobs|elon|musk|jeff bezos)\b.{0,45}\b(found|founded|started|created)\b.{0,70}\bmicrosoft\b/i,
    severity: "firm",
    reply:
      "Small correction: Microsoft was founded by Bill Gates and Paul Allen. I’d avoid mixing founder facts during an interview — it weakens credibility quickly.",
  },
  {
    pattern:
      /\bapple\b.{0,70}\b(found|founded|started|created)\b.{0,45}\b(bill gates|elon|musk|jeff bezos)\b|\b(bill gates|elon|musk|jeff bezos)\b.{0,45}\b(found|founded|started|created)\b.{0,70}\bapple\b/i,
    severity: "firm",
    reply:
      "Small correction: Apple was founded by Steve Jobs, Steve Wozniak, and Ronald Wayne. That kind of detail should be accurate if you bring it up.",
  },
  {
    pattern:
      /\bgoogle\b.{0,70}\b(found|founded|started|created)\b.{0,45}\b(bill gates|elon|musk|jeff bezos|steve jobs)\b|\b(bill gates|elon|musk|jeff bezos|steve jobs)\b.{0,45}\b(found|founded|started|created)\b.{0,70}\bgoogle\b/i,
    severity: "firm",
    reply:
      "Small correction: Google was founded by Larry Page and Sergey Brin. I’m pointing it out because interviewers do notice confident but incorrect claims.",
  },
  {
    pattern:
      /\bebay\b.{0,70}\b(found|founded|started|created)\b.{0,45}\b(elon|musk|jeff bezos|bill gates|steve jobs)\b|\b(elon|musk|jeff bezos|bill gates|steve jobs)\b.{0,45}\b(found|founded|started|created)\b.{0,70}\bebay\b/i,
    severity: "firm",
    reply:
      "Small correction: eBay was founded by Pierre Omidyar. If you use company examples, keep the factual parts tight and accurate.",
  },
  {
    pattern:
      /\bzoho\b.{0,80}\b(only|mainly)\b.{0,30}\b(b2c|consumer)\b|\bzoho\b.{0,80}\bnot\b.{0,25}\b(b2b|saas|business software)\b/i,
    severity: "firm",
    reply:
      "I’d correct that: Zoho is strongly B2B/SaaS-focused, with products for businesses across CRM, support, finance, collaboration, and operations. That distinction matters if you describe your Zoho experience.",
  },
  {
    pattern:
      /\bb2b\b.{0,40}\b(individual customers|normal consumers|single users)\b|\bb2c\b.{0,40}\b(companies|business customers|enterprise clients)\b/i,
    severity: "firm",
    reply:
      "Quick correction: B2B is business-to-business, while B2C is business-to-consumer. In interviews, that changes how you explain stakeholders, urgency, communication, and impact.",
  },
  {
    pattern:
      /\bapi\b.{0,50}\b(app|application)\b.{0,15}\binstalled\b|\bapi\b.{0,50}\buser interface\b/i,
    severity: "light",
    reply:
      "Small correction: an API is not the user interface itself. It is a way for systems to communicate. If you mention APIs, explain the system interaction and your role in using or troubleshooting it.",
  },
  {
    pattern:
      /\bcrm\b.{0,50}\bcustomer service team\b(?!\s*software)|\bcrm\b.{0,50}\bonly\b.{0,20}\bemail\b/i,
    severity: "light",
    reply:
      "Tiny correction: CRM usually means customer relationship management — often software and process together, not just a support team or email inbox. In an interview, connect it to customer history, follow-ups, account handling, or lifecycle visibility.",
  },
];

function detectKnownFactCorrection(answer: string): RecruiterTruthCheck | null {
  const spelling = detectLikelySpellingCorrection(answer);
  if (spelling) return spelling;

  const fuzzyEntity = detectFuzzyEntityCorrection(answer);
  if (fuzzyEntity) return fuzzyEntity;

  for (const rule of factCorrectionRules) {
    if (rule.pattern.test(answer)) {
      return { severity: rule.severity, reply: rule.reply };
    }
  }

  return null;
}

function buildTruthCorrectionReply(answer: string) {
  const correction = detectKnownFactCorrection(answer);
  if (!correction)
    return "Small correction — I’m not fully convinced that fact is accurate. I’d phrase it more carefully in a real interview, then connect it back to your actual experience.";

  if (correction.severity === "firm") {
    return `${correction.reply} Now continue, but keep it practical: what was your actual role or example there?`;
  }

  return correction.reply;
}

function shouldTruthCheckBeforeScoring(answer: string) {
  const lower = answer.replace(/\s+/g, " ").trim().toLowerCase();
  if (!lower) return false;

  // Do not interrupt normal answers for vague uncertainty. Only intervene for clear factual or naming issues.
  if (detectKnownFactCorrection(answer)) return true;

  // Also catch short company/concept statements that look like the user is testing recruiter knowledge.
  if (
    /\b(isn'?t|is|are|was|were)\b/.test(lower) &&
    /\b(tesla|amazon|microsoft|google|apple|zoho|ebay|b2b|b2c|api|crm|saas)\b/.test(
      lower,
    )
  ) {
    return factCorrectionRules.some((rule) => rule.pattern.test(answer));
  }

  return false;
}

function isConceptOrKnowledgeQuestion(answer: string) {
  const lower = answer.replace(/\s+/g, " ").trim().toLowerCase();
  if (!lower) return false;

  if (asksIfRecruiterKnowsCompany(answer)) return true;

  const looksLikeQuestion =
    lower.includes("?") ||
    /\b(what is|what are|do you know|does it know|meaning of|means|define|difference between|tell me about|know about|can you explain)\b/.test(
      lower,
    );

  if (!looksLikeQuestion) return false;

  return /\b(b2b|b2c|sla|ats|crm|kpi|api|saas)\b/.test(lower);
}

function looksLikeCandidateInterruption(answer: string) {
  const lower = answer.replace(/\s+/g, " ").trim().toLowerCase();
  if (!lower) return false;
  return /\b(wait|hold on|sorry|one second|can i interrupt|let me stop you|i want to ask|before you continue|pause)\b/.test(
    lower,
  );
}


function inferTargetRoleFromQuestion(question: string) {
  const clean = question.replace(/\s+/g, " ").trim();
  const patterns = [
    /\bfor\s+(?:a|an|the)?\s*([A-Z][A-Za-z /&+-]{2,70}?)(?:\s+interview|\s+role|\s+position|\.|\?|$)/i,
    /\bto\s+(?:a|an|the)?\s*([A-Z][A-Za-z /&+-]{2,70}?)(?:\s+role|\s+position|\.|\?|$)/i,
    /\bconnect(?:\s+your)?\s+experience\s+to\s+(?:a|an|the)?\s*([A-Z][A-Za-z /&+-]{2,70}?)(?:\.|\?|$)/i,
    /\bthis\s+([A-Z][A-Za-z /&+-]{2,70}?)\s+(?:interview|role|position)\b/i,
  ];

  for (const pattern of patterns) {
    const match = clean.match(pattern);
    if (match?.[1]) {
      return match[1]
        .replace(/\binterview\b|\brole\b|\bposition\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
    }
  }

  if (/customer success/i.test(clean)) return "Customer Success Manager";
  if (/data analyst/i.test(clean)) return "Data Analyst";
  if (/technical support/i.test(clean)) return "Technical Support";
  if (/product manager/i.test(clean)) return "Product Manager";
  if (/software engineer|developer/i.test(clean)) return "Software Engineer";
  return "this role";
}

function roleKeywordFamily(role: string) {
  const lower = role.toLowerCase();
  if (/customer success|account manager|client success|customer support|customer experience|support/i.test(lower)) {
    return {
      family: "customer-facing",
      positive: /\b(customer|client|account|renewal|retention|onboarding|stakeholder|support|relationship|success|adoption|churn|csat|nps|ticket|escalation|sla|b2b|b2c|communication|empathy)\b/i,
      challenge: "customers, accounts, onboarding, retention, stakeholder handling, escalations, or business impact",
    };
  }
  if (/data analyst|analytics|business analyst|bi/i.test(lower)) {
    return {
      family: "analytics",
      positive: /\b(data|sql|dashboard|analysis|metric|kpi|report|insight|excel|python|tableau|power bi|stakeholder|trend|dataset|visualization|forecast|experiment)\b/i,
      challenge: "data, metrics, analysis, dashboards, business questions, or measurable insights",
    };
  }
  if (/product manager|product owner/i.test(lower)) {
    return {
      family: "product",
      positive: /\b(user|customer|roadmap|priorit|requirement|stakeholder|metric|experiment|feature|launch|research|trade-off|backlog|adoption|retention)\b/i,
      challenge: "users, product decisions, trade-offs, stakeholders, launch outcomes, or metrics",
    };
  }
  if (/software engineer|developer|frontend|backend|full stack|fullstack/i.test(lower)) {
    return {
      family: "engineering",
      positive: /\b(code|api|system|architecture|bug|deploy|database|frontend|backend|performance|testing|repository|debug|security|scalability)\b/i,
      challenge: "technical scope, systems, code, debugging, architecture, or measurable engineering impact",
    };
  }

  return {
    family: "general",
    positive: /\b(role|team|project|stakeholder|result|impact|customer|business|manager|problem|solution|metric|responsibility|decision)\b/i,
    challenge: "the role responsibilities, stakeholders, decisions, and measurable outcomes",
  };
}

const highCredibilityClaimPattern =
  /\b(i|we|my team)\b.{0,80}\b(built|created|invented|designed|launched|founded|led|owned|fixed|saved|scaled|managed)\b.{0,100}\b(global|entire|whole|all|every|millions|billion|unicorn|fortune 500|ceo|cto|vp|director|head of|public company|famous|world'?s biggest|industry leading)\b/i;

function looksLikeUnsupportedHighCredibilityClaim(answer: string) {
  const clean = answer.replace(/\s+/g, " ").trim();
  if (!highCredibilityClaimPattern.test(clean)) return false;
  return !/\b(team of|as part of|contributed|supported|helped|intern|student project|prototype|simulation|under supervision|one module|my part|responsible for)\b/i.test(clean);
}

type SenseCheckResult = {
  severity: "light" | "firm";
  reason: string;
  reply: string;
};


function isCandidateQuestionNotInterviewAnswer(answer: string) {
  const clean = answer.replace(/\s+/g, " ").trim();
  const lower = clean.toLowerCase();
  if (!clean) return false;

  // Real interviewers distinguish candidate questions from answers.
  // These must never advance the interview counter or get judged as a poor answer.
  if (isInterviewControlQuestion(clean) || isClarificationOrMetaQuestion(clean)) return true;
  if (asksIfRecruiterKnowsCompany(clean) || isConceptOrKnowledgeQuestion(clean)) return true;

  const shortQuestion = clean.endsWith("?") && clean.split(/\s+/).length <= 18;
  const candidateQuestionLead = /^(what|why|how|when|where|which|who|can|could|do|does|did|are|is|will|would|should)\b/i.test(clean);
  const asksAboutProcess = /\b(interview|question|answer|role|company|jd|job description|resume|cv|task|need to do|supposed to do|should i)\b/i.test(lower);

  return Boolean((shortQuestion || candidateQuestionLead) && asksAboutProcess);
}

function currentQuestionNeedsRealAnswer(currentQuestion: string) {
  const q = currentQuestion.replace(/\s+/g, " ").trim().toLowerCase();
  if (!q) return false;
  return (
    /\b(tell me about yourself|walk me through|introduce yourself|your background|your experience|describe a time|tell me about a time|give me an example|what happened|how did you|why did you|what was your role|what did you do|what was the outcome)\b/.test(q)
  );
}

function answerDirectlyAddressesQuestion(answer: string, currentQuestion: string) {
  const clean = answer.replace(/\s+/g, " ").trim();
  const lower = clean.toLowerCase();
  const q = currentQuestion.replace(/\s+/g, " ").trim().toLowerCase();
  const words = clean.split(/\s+/).filter(Boolean);

  if (!clean) return false;
  if (isGreetingOrCourtesy(clean) || isCandidateQuestionNotInterviewAnswer(clean)) return false;

  // If the interviewer asked for a self-introduction, the answer should contain
  // at least some candidate/work signal. Otherwise we guide, not score.
  if (/\b(tell me about yourself|walk me through|introduce yourself|your background|your experience)\b/.test(q)) {
    return (
      words.length >= 10 &&
      /\b(i|i'm|i am|my|worked|work|experience|background|role|support|customer|data|project|team|company|handled|built|managed|learned|responsible)\b/i.test(clean)
    );
  }

  // If the interviewer asks for an example/situation, require a real-work signal.
  if (/\b(describe a time|tell me about a time|give me an example|specific example|situation|moment)\b/.test(q)) {
    return (
      words.length >= 12 &&
      /\b(i|we|my|our|customer|client|team|manager|project|ticket|issue|problem|handled|resolved|built|created|managed|led|improved|result|outcome)\b/i.test(clean)
    );
  }

  if (!currentQuestionNeedsRealAnswer(currentQuestion)) return true;
  return words.length >= 8;
}

function buildHumanNotAnswerReply(currentQuestion: string) {
  const activeQuestion = currentQuestion || "the question I asked";
  return `No problem — but I won’t treat that as an interview answer. For this question, answer directly: “${activeQuestion}” Give me the real situation, your role, what you did, and the result. Take a moment and answer naturally.`;
}

function detectAnswerSenseProblem(
  answer: string,
  currentQuestion = "",
  setup?: WorkZoInterviewSetup,
): SenseCheckResult | null {
  const clean = answer.replace(/\s+/g, " ").trim();
  const lower = clean.toLowerCase();
  if (!clean) return null;

  if (
    isGreetingOrCourtesy(clean) ||
    isClarificationOrMetaQuestion(clean) ||
    asksIfRecruiterKnowsCompany(clean) ||
    isConceptOrKnowledgeQuestion(clean)
  ) {
    return null;
  }

  const words = clean.split(/\s+/).filter(Boolean);

  if (currentQuestionNeedsRealAnswer(currentQuestion) && !answerDirectlyAddressesQuestion(clean, currentQuestion)) {
    return {
      severity: "light",
      reason: "not_an_interview_answer",
      reply: buildHumanNotAnswerReply(currentQuestion),
    };
  }

  const uniqueRatio =
    new Set(words.map((word) => word.toLowerCase())).size /
    Math.max(1, words.length);
  const repeatedShortLoop = words.length >= 10 && uniqueRatio < 0.38;
  const fillerOnly =
    words.length >= 6 &&
    !/\b(i|we|my|our|customer|team|project|role|result|issue|problem|resolved|built|created|managed|led|improved|reduced|increased|because|therefore|so)\b/i.test(
      clean,
    );

  if (repeatedShortLoop || fillerOnly) {
    return {
      severity: "firm",
      reason: "unclear_or_word_salad",
      reply:
        "Let me stop you there for a second — I’m not able to follow that answer clearly. In a real interview, that would make me worry that you’re not answering the question. Give me one concrete situation, what happened, and what you personally did.",
    };
  }

  const impossibleImpactPatterns = [
    /\b(increased|improved|reduced|decreased|saved|grew)\b.{0,50}\b(1000|10000|million|billion)\s*%\b/i,
    /\b(single[-\s]?handedly|alone|by myself)\b.{0,80}\b(entire|whole|global|company[-\s]?wide)\b/i,
    /\b(fixed|solved|built|created|launched)\b.{0,80}\b(all|every)\b.{0,30}\b(bug|issue|problem|customer complaint|ticket)s?\b.{0,40}\b(one day|overnight|in an hour)\b/i,
    /\bnever made a mistake\b|\bno weakness\b|\bi have no weakness\b|\bi know everything\b/i,
  ];

  if (impossibleImpactPatterns.some((pattern) => pattern.test(clean))) {
    return {
      severity: "firm",
      reason: "implausible_claim",
      reply:
        "I’m going to challenge that, because it sounds exaggerated. A real interviewer would not fully trust that claim without evidence. Give me the realistic version: what was the scale, what exactly changed, and how do you know it was your work?",
    };
  }

  const contradictionPatterns = [
    /\bi\s+(never|did not|didn'?t)\s+(work|worked|handle|handled|lead|led|manage|managed).{0,70}\b(but|however)\b.{0,70}\bi\s+(led|managed|handled|owned|built|created)/i,
    /\b(no experience|never used|don'?t know)\b.{0,60}\bbut\b.{0,60}\b(expert|advanced|led|owned|managed|trained others)\b/i,
    /\bnot involved\b.{0,70}\b(my decision|i decided|i owned|i led)\b/i,
  ];

  if (contradictionPatterns.some((pattern) => pattern.test(clean))) {
    return {
      severity: "firm",
      reason: "internal_contradiction",
      reply:
        "I need to pause you there — that answer contradicts itself a little. First you reduce your involvement, then you describe ownership. Which one is accurate? Give me the clean version, because consistency matters in a real interview.",
    };
  }

  // General real-world recruiter check: do not politely accept claims that are
  // unsupported, unrelated to the target role, or too high-stakes without scope.
  // This is intentionally role-agnostic, so we do not hard-code one example.
  const roleQuestionSignals = /\b(tell me about yourself|background|experience|walk me through your profile|introduce yourself|connect your experience)\b/i.test(
    currentQuestion,
  );
  const setupRole = setup ? getRole(setup) : "";
  const targetRole = setupRole && setupRole !== "General Role" && setupRole !== "Target Role"
    ? setupRole
    : inferTargetRoleFromQuestion(currentQuestion);
  const roleFamily = roleKeywordFamily(targetRole);
  const jobContextForBridge = setup ? buildJobContext(setup) : "";
  const answerHasRoleBridge =
    roleFamily.positive.test(clean) ||
    Boolean(jobContextForBridge && roleFamily.positive.test(jobContextForBridge) && roleFamily.positive.test(clean));
  const famousCompanyOrProduct = /\b(tesla|amazon|microsoft|google|apple|meta|openai|netflix|ebay|zoho|salesforce|chatgpt|iphone|windows|youtube|instagram|facebook|autopilot|prime|aws|azure)\b/i.test(
    clean,
  );
  const unrelatedIdentityClaim =
    /\b(i\s+(worked|work)\s+as|my\s+role\s+was|i\s+am|i\s+was)\b.{0,70}\b(engineer|designer|doctor|lawyer|scientist|architect|founder|ceo|cto|director|pilot|professor|researcher)\b/i.test(
      clean,
    );
  const creationOwnershipClaim = /\b(i|we)\b.{0,60}\b(designed|built|created|invented|launched|founded|owned|led)\b/i.test(
    clean,
  );

  if (
    roleQuestionSignals &&
    !answerHasRoleBridge &&
    (famousCompanyOrProduct || unrelatedIdentityClaim || creationOwnershipClaim)
  ) {
    return {
      severity: "firm",
      reason: "role_fit_claim_needs_verification",
      reply: `Let me pause you there. I’m not rejecting the experience, but I don’t yet see how it connects to ${targetRole}. In a real interview, I would need the believable bridge to ${roleFamily.challenge}. Was that your real role, what was your exact scope, and why does it make you stronger for this position?`,
    };
  }

  if (looksLikeUnsupportedHighCredibilityClaim(clean)) {
    return {
      severity: "firm",
      reason: "unsupported_high_credibility_claim",
      reply:
        "I need to challenge the scale of that claim. It sounds too broad to accept without proof. In a real interview, I’d ask you to narrow it down: what exactly was your part, what team were you in, what dates, and what measurable result can you personally stand behind?",
    };
  }

  const currentLower = currentQuestion.toLowerCase();
  const asksForExample =
    /\b(time|example|situation|moment|describe|tell me about)\b/.test(
      currentLower,
    );
  const candidateGivesDefinitionOnly =
    words.length >= 10 &&
    /\bmeans|is when|refers to|definition|basically|generally\b/i.test(clean) &&
    !/\b(i|we|my|our|customer|team|manager|client|project)\b/i.test(clean);

  if (asksForExample && candidateGivesDefinitionOnly) {
    return {
      severity: "light",
      reason: "definition_instead_of_example",
      reply:
        "That explains the idea, but it doesn’t answer the interview question yet. I asked for a real example. Pick one situation you actually experienced and walk me through your role.",
    };
  }

  const offTopicSignals =
    /\b(weather|movie|food|cricket|football|song|holiday|recipe|politics)\b/i.test(
      clean,
    );
  const hasWorkSignal =
    /\b(work|job|role|customer|team|project|company|manager|client|product|issue|ticket|data|analysis|support|interview)\b/i.test(
      clean,
    );
  if (words.length >= 8 && offTopicSignals && !hasWorkSignal) {
    return {
      severity: "light",
      reason: "off_topic",
      reply:
        "I’ll bring you back to the interview. That answer doesn’t connect to the role or the question. Give me a work-related example instead.",
    };
  }

  return null;
}

function shouldSenseCheckBeforeScoring(
  answer: string,
  currentQuestion = "",
  setup?: WorkZoInterviewSetup,
) {
  return Boolean(detectAnswerSenseProblem(answer, currentQuestion, setup));
}

function buildSenseCheckReply(
  answer: string,
  currentQuestion = "",
  setup?: WorkZoInterviewSetup,
) {
  const problem = detectAnswerSenseProblem(answer, currentQuestion, setup);
  if (problem) return problem.reply;
  return "I’m not fully following that answer. Let’s reset it like a real interview: one situation, your role, the action you took, and the result.";
}

function classifyCandidateIntent(
  answer: string,
  currentQuestion = "",
  setup?: WorkZoInterviewSetup,
): CandidateIntent {
  const lower = answer.replace(/\s+/g, " ").trim().toLowerCase();
  if (!lower) return "interview_answer";
  if (isGreetingOrCourtesy(answer) || /^(hi|hello|hey|are you there|can you hear me)\??$/i.test(lower)) {
    return "small_talk";
  }
  if (looksLikeCandidateInterruption(answer) || isCandidateQuestionNotInterviewAnswer(answer)) {
    return "context_question";
  }
  if (
    asksForExactAvailableContext(answer) ||
    isClarificationOrMetaQuestion(answer)
  ) {
    return "context_question";
  }
  if (asksIfRecruiterKnowsCompany(answer)) return "company_question";
  if (isConceptOrKnowledgeQuestion(answer)) return "concept_question";
  if (shouldTruthCheckBeforeScoring(answer)) return "correction_or_fact_check";
  if (shouldSenseCheckBeforeScoring(answer, currentQuestion, setup))
    return "sense_check";
  return "interview_answer";
}

function buildClarificationReply(
  answer: string,
  setup: WorkZoInterviewSetup,
  recruiterId: RecruiterId,
  currentQuestion = "",
) {
  const lower = answer.toLowerCase();

  if (asksForExactAvailableContext(answer)) {
    return buildAvailableContextReply(setup);
  }
  const role = getRole(setup);
  const company = getCompany(setup);
  const cvSignals = extractSafeCvSignals(setup);
  const hasCv = hasUsableCv(setup);
  const hasJob = buildJobContext(setup).length > 80;

  if (isInterviewControlQuestion(answer)) {
    const activeQuestion = currentQuestion || "the question on screen";
    return `No problem. Just answer naturally as if this is a real interview. For this step, respond to: “${activeQuestion}” Keep it simple: your situation, your role, what you did, and the result. I won’t count this as an interview answer — take your time and answer when you’re ready.`;
  }

  if (/\b(can you hear me|are you there|hello|hi)\b/i.test(lower) || isGreetingOrCourtesy(answer)) {
    if (/\bhow are you\b/i.test(lower) || /\b(good|fine|great|doing well)\b/i.test(lower)) {
      return "I’m good, thank you. Let’s begin properly now — I’ll ask the questions, and you can answer naturally like you would in a real interview.";
    }
    return recruiterId === "startup_recruiter"
      ? "Yes, I can hear you. We’ll keep this natural — answer the question on screen when you’re ready."
      : "Yes, I’m here and I can hear you. We’ll keep this natural — answer the question on screen when you’re ready.";
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
    if (hasCv || hasJob) {
      const signalLine = cvSignals.length
        ? ` I can clearly see signals like ${cvSignals.join(", ")}.`
        : "";
      return `${buildAvailableContextReply(setup)}${signalLine ? ` ${signalLine.trim()}` : ""}`;
    }

    return "I don’t have enough clear resume or job-description detail available, so I won’t pretend I’ve read details that are not loaded. Tell me the role and the experience you want me to evaluate, and I’ll continue from there.";
  }

  if (cleanQuestionIntent(lower)) {
    const activeQuestion = currentQuestion || "the question on screen";
    return `Good question. What you need to do now is answer this like a real interview, not perfectly — just clearly. For this step, respond to: “${activeQuestion}” I’m listening for your actual experience, your role, and the result.`;
  }

  return "Good question. I’ll answer briefly, then we’ll continue the interview. I’m using the available role and background context, but I’ll only judge a message as an answer when it actually answers the interview question.";
}

function cleanQuestionIntent(lower: string) {
  return /(what|how|why|when|where|which|who|can|could|do|does|did|are|is|will|would|should)/.test(lower);
}


type BestRecruiterBrainReply = {
  question?: string;
  feedback?: string;
  recruiterState?: unknown;
  analysis?: unknown;
  interruption?: {
    shouldInterrupt?: boolean;
    interruptionMessage?: string;
    severity?: "low" | "medium" | "high";
  };
};

function isUsefulAiRecruiterQuestion(value: unknown) {
  if (typeof value !== "string") return false;
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length < 12 || clean.length > 520) return false;
  if (/^(ok|okay|thanks|thank you)[.!]?$/i.test(clean)) return false;
  if (/as an ai|language model|i cannot|i can'?t help/i.test(clean)) return false;
  return true;
}

function buildLocalRecruiterReasoningPrompt(input: {
  answer: string;
  currentQuestion: string;
  setup: WorkZoInterviewSetup;
  transcript: TranscriptItem[];
}) {
  const role = getRole(input.setup);
  const company = getCompany(input.setup);
  return {
    targetRole: role,
    targetCompany: company,
    cvText: buildCandidateContext(input.setup),
    jobDescription: buildJobContext(input.setup),
    setup: {
      cvText: buildCandidateContext(input.setup),
      jobDescription: buildJobContext(input.setup),
      targetRole: role,
      companyStyle: input.setup.companyStyle,
      recruiterPersonality: input.setup.recruiterPersonality,
      recruiterMemoryProfile: input.setup.recruiterMemoryProfile,
      jobMemoryProfile: input.setup.jobMemoryProfile,
    },
    answer: input.answer,
    currentQuestion: input.currentQuestion,
    transcript: input.transcript.slice(-10),
  };
}

async function askBestRecruiterBrain(input: {
  answer: string;
  currentQuestion: string;
  setup: WorkZoInterviewSetup;
  transcript: TranscriptItem[];
  timeoutMs?: number;
}): Promise<BestRecruiterBrainReply | null> {
  if (typeof window === "undefined") return null;

  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    input.timeoutMs ?? 2800,
  );

  try {
    const response = await fetch("/api/interview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildLocalRecruiterReasoningPrompt(input)),
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const data = (await response.json()) as BestRecruiterBrainReply;
    if (!isUsefulAiRecruiterQuestion(data.question)) return null;
    return data;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

function makeRecruiterReplyMoreHuman(value: string) {
  return value
    .replace(/\bYour answer is too generic\b/gi, "I’m not fully seeing the real example yet")
    .replace(/\bYour answer is too short\b/gi, "I need a little more context before I can judge that")
    .replace(/\bI noticed this pattern earlier\b/gi, "I’m seeing the same concern again")
    .replace(/\bCan you elaborate further\??\b/gi, "Walk me through the real situation")
    .replace(/\bPlease provide\b/gi, "Give me")
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

function isProgressCandidateAnswer(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return false;
  if (isGreetingOrCourtesy(clean)) return false;
  if (isClarificationOrMetaQuestion(clean)) return false;
  if (asksIfRecruiterKnowsCompany(clean)) return false;
  if (isConceptOrKnowledgeQuestion(clean)) return false;
  if (shouldTruthCheckBeforeScoring(clean)) return false;
  return clean.split(/\s+/).filter(Boolean).length >= 3;
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
      transcript.filter((item) => item.role === "candidate" && isProgressCandidateAnswer(item.text)).length + 1,
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
  const isSpeakingRef = useRef(false);
  const isLiveRef = useRef(false);
  const questionRef = useRef(question);
  const transcriptRef = useRef<TranscriptItem[]>([]);
  const memoryRef = useRef<RecruiterMemory>(recruiterMemory);
  const trustRef = useRef(recruiterTrust);
  const recruiterStateRef = useRef<RecruiterState>(recruiterState);
  const silenceTimerRef = useRef<number | null>(null);
  const finalizationTimerRef = useRef<number | null>(null);
  const pendingAnswerRef = useRef("");
  const lockedBrowserVoiceRef = useRef<{
    recruiterId: RecruiterId;
    gender: "female" | "male";
    name: string;
    voiceURI: string;
    lang: string;
  } | null>(null);
  const hasGreetedRef = useRef(false);
  const interviewStepRef = useRef<"greeting" | "intro" | "deep_dive">(
    "greeting",
  );
  const handleCandidateAnswerRef = useRef<(answer: string) => void>(() => {});

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    // Warm browser voices before the first recruiter sentence.
    // This prevents Chrome/Edge from using a random default voice on the first attempt.
    const warmVoices = () => {
      window.speechSynthesis.getVoices();
    };

    warmVoices();
    window.speechSynthesis.addEventListener("voiceschanged", warmVoices);

    const warmTimer = window.setTimeout(warmVoices, 900);

    return () => {
      window.clearTimeout(warmTimer);
      window.speechSynthesis.removeEventListener("voiceschanged", warmVoices);
    };
  }, []);

  const recruiterProfile = useMemo(
    () => getRecruiterVoiceProfile(activeSetup.recruiterPersonality),
    [activeSetup.recruiterPersonality],
  );

  const recruiterId = activeSetup.recruiterPersonality as RecruiterId;

  useEffect(() => {
    // Freeze means: one recruiter = one browser voice for the whole session.
    // If the user changes recruiter personality, clear the lock and choose again.
    if (lockedBrowserVoiceRef.current?.recruiterId !== recruiterId) {
      lockedBrowserVoiceRef.current = null;
    }
  }, [recruiterId]);

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
      try {
        recognitionRef.current?.abort?.();
        recognitionRef.current?.stop();
      } catch {}
      window.speechSynthesis?.cancel();
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

  const addTranscript = useCallback((item: TranscriptItem) => {
    setTranscript((items) => [...items, item].slice(-40));
  }, []);

  const speakRecruiter = useCallback(
    (text: string, afterSpeak?: () => void) => {
      if (
        typeof window === "undefined" ||
        !window.speechSynthesis ||
        !speakerOn
      ) {
        afterSpeak?.();
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

      const isMobileBrowser = /iphone|ipad|ipod|android/i.test(
        navigator.userAgent || "",
      );

      let didFinish = false;
      let finishTimer: number | null = null;

      const finishSpeech = () => {
        if (didFinish) return;
        didFinish = true;
        if (finishTimer) window.clearTimeout(finishTimer);
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        setVoiceStatus("Listening to your answer");
        afterSpeak?.();
      };

      const speakNow = (allowVoiceWait = false) => {
        const utterance = new SpeechSynthesisUtterance(text);
        const runtimeVoice = recruiterRuntimeVoice(recruiterId);
        const availableVoices = window.speechSynthesis.getVoices();

        const lockedVoice = lockedBrowserVoiceRef.current;
        let voice =
          lockedVoice?.recruiterId === recruiterId
            ? availableVoices.find(
                (candidate) =>
                  candidate.voiceURI === lockedVoice.voiceURI ||
                  candidate.name === lockedVoice.name,
              ) || null
            : null;

        if (!voice) {
          voice = selectBrowserVoice(recruiterId);

          if (voice) {
            lockedBrowserVoiceRef.current = {
              recruiterId,
              gender: runtimeVoice.gender,
              name: voice.name,
              voiceURI: voice.voiceURI,
              lang: voice.lang || "",
            };
          }
        }

        // On mobile, do not wait for a preferred voice. Waiting can break the
        // user-gesture audio chain and make speech silent. Use the best available
        // voice immediately, or the browser default.
        // Important: once a voice is selected, keep the same voice for the session
        // so Sarah/Priya cannot suddenly switch to a male browser voice mid-interview.
        if (voice) utterance.voice = voice;

        utterance.pitch = runtimeVoice.pitch;
        utterance.rate =
          recruiterStateRef.current === "pressuring" ||
          recruiterStateRef.current === "skeptical"
            ? Math.min(0.96, runtimeVoice.rate + 0.04)
            : runtimeVoice.rate;
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
          Math.max(3600, text.split(/\s+/).length * 360),
        );
        finishTimer = window.setTimeout(finishSpeech, estimatedMs + 1500);

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
          if (voice && allowVoiceWait && runtimeVoice.gender !== "female") {
            try {
              const fallback = new SpeechSynthesisUtterance(text);
              fallback.pitch = runtimeVoice.pitch;
              fallback.rate = runtimeVoice.rate;
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
      };

      const voices = window.speechSynthesis.getVoices();
      const selectedVoice = selectBrowserVoice(recruiterId);

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
        window.setTimeout(speakOnce, 700);
        return;
      }

      speakNow(true);
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
      recognitionRef.current?.abort?.();
      recognitionRef.current?.stop();
    } catch {}

    if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
    if (finalizationTimerRef.current)
      window.clearTimeout(finalizationTimerRef.current);
    pendingAnswerRef.current = "";

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = activeSetup.language?.toLowerCase().startsWith("de")
      ? "de-DE"
      : "en-US";

    recognition.onstart = () => {
      if (isSpeakingRef.current) {
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
        if (!isLiveRef.current || isSpeakingRef.current) return;
        setVoiceStatus("Take your time — answer naturally");
      }, 9000);
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      const error = event.error || "";
      if (error === "no-speech") {
        setVoiceStatus("I’m still listening. Try answering again.");
        window.setTimeout(() => listenForAnswer(), 900);
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
        isLiveRef.current &&
        !isSpeakingRef.current &&
        !pendingAnswerRef.current
      ) {
        setVoiceStatus("Waiting for your answer...");
      }
    };

    recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
      if (isSpeakingRef.current) return;

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
      }, 2800);
    };

    recognitionRef.current = recognition;

    // Start recognition only after recruiter speech has fully ended.
    window.setTimeout(() => {
      if (!isLiveRef.current || isSpeakingRef.current) return;
      try {
        recognition.start();
      } catch {
        setVoiceStatus("Listening paused. Tap mic to continue.");
      }
    }, 250);
  }, [activeSetup.language]);

  const handleCandidateAnswer = useCallback(
    async (answer: string) => {
      if (!isLiveRef.current) return;

      const candidateItem: TranscriptItem = {
        role: "candidate",
        text: answer,
        time: timeLabel(),
      };

      addTranscript(candidateItem);

      const currentStep = interviewStepRef.current;
      const candidateIntent = classifyCandidateIntent(
        answer,
        questionRef.current,
        activeSetup,
      );

      if (
        candidateIntent === "company_question" ||
        candidateIntent === "concept_question" ||
        candidateIntent === "correction_or_fact_check" ||
        candidateIntent === "sense_check"
      ) {
        const conceptReply =
          candidateIntent === "correction_or_fact_check"
            ? buildTruthCorrectionReply(answer)
            : candidateIntent === "sense_check"
              ? buildSenseCheckReply(answer, questionRef.current, activeSetup)
              : buildConceptReply(answer);

        setRecruiterState(
          candidateIntent === "correction_or_fact_check" ||
            candidateIntent === "sense_check"
            ? "skeptical"
            : "engaged",
        );
        setVoiceStatus(
          candidateIntent === "company_question"
            ? "Recruiter is answering company context..."
            : candidateIntent === "correction_or_fact_check"
              ? "Recruiter is correcting the detail..."
              : candidateIntent === "sense_check"
                ? "Recruiter is checking the answer..."
                : "Recruiter is answering briefly...",
        );

        window.setTimeout(
          () => {
            if (!isLiveRef.current) return;
            const recruiterReply: TranscriptItem = {
              role: "recruiter",
              text: conceptReply,
              time: timeLabel(),
            };
            addTranscript(recruiterReply);
            speakRecruiter(conceptReply, () => {
              window.setTimeout(() => listenForAnswer(), 420);
            });
          },
          candidateIntent === "correction_or_fact_check" ||
            candidateIntent === "sense_check"
            ? 680
            : 520,
        );
        return;
      }

      if (
        candidateIntent === "context_question" ||
        candidateIntent === "small_talk"
      ) {
        const clarificationReply = buildClarificationReply(
          answer,
          activeSetup,
          recruiterId,
          questionRef.current,
        );

        setRecruiterState("engaged");
        setVoiceStatus("Recruiter is clarifying context...");

        window.setTimeout(() => {
          if (!isLiveRef.current) return;
          let replyText = clarificationReply;
          if (candidateIntent === "small_talk" && currentStep === "greeting") {
            interviewStepRef.current = "intro";
            const introQuestion = buildOpeningContextAwareQuestion(recruiterId, activeSetup);
            setQuestion(introQuestion);
            replyText = `${clarificationReply} Let’s start with this: ${introQuestion}`;
          }
          const recruiterReply: TranscriptItem = {
            role: "recruiter",
            text: replyText,
            time: timeLabel(),
          };
          addTranscript(recruiterReply);
          speakRecruiter(replyText, () => {
            window.setTimeout(() => listenForAnswer(), 420);
          });
        }, 600);
        return;
      }

      if (currentStep === "greeting") {
        interviewStepRef.current = "intro";
        const introQuestion = buildOpeningContextAwareQuestion(
          recruiterId,
          activeSetup,
        );
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
            window.setTimeout(() => listenForAnswer(), 420);
          });
        }, 850);
        return;
      }

      if (currentStep === "intro") {
        if (!answerDirectlyAddressesQuestion(answer, questionRef.current)) {
          const guidance = buildHumanNotAnswerReply(questionRef.current);
          setRecruiterState("engaged");
          setVoiceStatus("Recruiter is guiding the answer...");
          window.setTimeout(() => {
            if (!isLiveRef.current) return;
            const recruiterReply: TranscriptItem = {
              role: "recruiter",
              text: guidance,
              time: timeLabel(),
            };
            addTranscript(recruiterReply);
            speakRecruiter(guidance, () => {
              window.setTimeout(() => listenForAnswer(), 420);
            });
          }, 520);
          return;
        }

        interviewStepRef.current = "deep_dive";
        const transitionQuestion = buildNaturalIntroQuestion(
          recruiterId,
          answer,
          activeSetup,
        );
        const transitionSpeech = transitionQuestion;

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
            window.setTimeout(() => listenForAnswer(), 420);
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

      const rawAnalysis = analyzeAnswer(
        answer,
        baseMemory,
        previousTrust,
        recruiterId,
        questionRef.current,
      );

      const nextTrust = Math.max(
        12,
        Math.min(92, previousTrust + rawAnalysis.trustDelta),
      );
      const analysis = upgradeAnalysisWithWowLayer({
        analysis: rawAnalysis,
        previousTrust,
        nextTrust,
        answer,
        memory: baseMemory,
        recruiterId,
        question: questionRef.current,
        setup: activeSetup,
      });
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

      let nextQuestion = analysis.followUp;
      let spokenReply = buildConversationalRecruiterSpeech({
        recruiterId,
        candidateName,
        screenQuestion: nextQuestion,
        bridge: analysis.bridge,
        memory: nextMemory,
        state: analysis.state,
        trust: nextTrust,
      });

      setVoiceStatus("Recruiter is thinking...");

      // Best-intelligence layer: when the server/OpenAI brain is available, let it
      // reason over the full CV/JD/transcript and replace the local fallback with
      // a sharper recruiter response. If it is slow or unavailable, the stable
      // local engine continues immediately. This does not touch voice transport.
      const aiBrain = await askBestRecruiterBrain({
        answer,
        currentQuestion: questionRef.current,
        setup: activeSetup,
        transcript: [...transcript, candidateItem],
        timeoutMs: 2200,
      });

      if (aiBrain?.question && isUsefulAiRecruiterQuestion(aiBrain.question)) {
        nextQuestion = makeRecruiterReplyMoreHuman(aiBrain.question);
        spokenReply = makeRecruiterReplyMoreHuman(nextQuestion);
      }

      const thinkingDelay = aiBrain ? 420 : buildHumanPauseMs(analysis);

      if (aiBrain) setVoiceStatus("Recruiter is responding with context...");

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
          window.setTimeout(() => listenForAnswer(), 350);
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
      activeSetup,
      activeSetup.setupId,
      addTranscript,
      candidateName,
      listenForAnswer,
      market,
      recruiterId,
      recruiterProfile.name,
      role,
      speakRecruiter,
      transcript,
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
      window.setTimeout(() => listenForAnswer(), 400);
    });
  }, [addTranscript, listenForAnswer, speakRecruiter]);

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
      recognitionRef.current?.abort?.();
      recognitionRef.current?.stop();
    } catch {}
    window.speechSynthesis?.cancel();

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
    if (isLive) {
      // Human-like interruption support: if the candidate taps mic while
      // recruiter is speaking, stop the recruiter and give the floor back.
      // This keeps the existing stable voice pipeline intact, but allows
      // natural "wait, can I ask something?" moments.
      if (isSpeaking) {
        try {
          window.speechSynthesis?.cancel();
        } catch {}
        try {
          recognitionRef.current?.abort?.();
          recognitionRef.current?.stop();
        } catch {}
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        setIsListening(false);
        setVoiceStatus("Paused — go ahead");
        window.setTimeout(() => listenForAnswer(), 220);
        return;
      }

      if (!isListening) {
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
      window.speechSynthesis?.cancel();
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
          <div className="absolute inset-x-0 bottom-28 z-50 mx-auto max-w-xl rounded-[26px] border border-violet-300/15 bg-violet-500/10 p-5 text-center backdrop-blur-2xl">
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
      )}
    </main>
  );
}
