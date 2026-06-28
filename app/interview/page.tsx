"use client";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

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
  RotateCcw,
  Volume2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import UpgradeModal from "@/components/premium/UpgradeModal";
import PremiumUsageBadge from "@/components/premium/PremiumUsageBadge";
import {
  checkWorkZoInterviewAllowed,
  recordWorkZoInterviewStarted,
  recordWorkZoTavusInterviewStarted,
} from "@/lib/workzoUsageTracker";
import { getWorkZoPlanLimits } from "@/lib/workzoPlanLimits";
import { buildWorkZoRecruiterReplyV2 } from "@/lib/workzoRecruiterIntelligenceV2";
import { shouldInterruptLive } from "@/lib/liveInterruptionEngine";
import {
  getWorkZoLiveReaction,
  decideWorkZoInterruption,
  updateWorkZoEmotionalMemory,
  createWorkZoEmotionalMemory,
  type WorkZoEmotionalMemory,
  type WorkZoRecruiterVisualState,
} from "@/lib/workzoPremiumExperienceEngine";
import { detectShareableMoment } from "@/lib/shareableMoments";

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
import { buildAdaptiveFollowUpQuestion } from "@/lib/companySimulationEngine";
import { formatWorkZoCompanyBlueprintForPrompt } from "@/lib/workzoCompanyBlueprint";
import { speakWithElevenLabs } from "@/lib/workzoElevenLabs";
import { fetchWorkZoAuthoritativePlan } from "@/lib/workzoClientPlan";
import {
  readLatestInterviewSetup,
  normalizeCandidateName as normalizeStoredCandidateName,
} from "@/lib/workzoInterviewSetup";
import type { ResumeProfile } from "@/lib/workzoResumeParser";
import dynamic from "next/dynamic";

// Lazy-load Monaco — doesn't affect initial bundle for non-technical users
const CodePanel = dynamic(() => import("@/components/interview/CodePanel"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[300px] items-center justify-center rounded-lg border border-white/10 bg-[#0d1117]">
      <span className="text-xs text-slate-600 font-black uppercase tracking-widest animate-pulse">
        Loading editor…
      </span>
    </div>
  ),
});
import {
  analyzeWorkZoActiveDisruption,
  buildWorkZoPersonaOpeningQuestion,
  buildWorkZoWaitingRoomSteps,
  createWorkZoDisruptionMemory,
  getWorkZoSimulationPersona,
  updateWorkZoDisruptionMemory,
  type WorkZoDisruptionMemory,
} from "@/lib/workzoInterviewFlightSimulator";

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
  resumeProfile?: ResumeProfile | null;
  companyBlueprint?: any;
  companyName?: string;
};

const recruiterProfiles: Record<
  string,
  {
    name: string;
    title: string;
    image: string;
    voiceHint: string;
    companyArchetype: string;
    focusAreas: string[];
    pressureStyle: string;
  }
> = {
  friendly_hr: {
    name: "Sarah Chen",
    title: "Senior Talent Partner",
    image: "/recruiters/sarah.png",
    voiceHint: "female",
    companyArchetype: "Structured global company",
    focusAreas: [
      "motivation",
      "communication",
      "role fit",
      "specific examples",
    ],
    pressureStyle: "Warm first, then precise follow-ups",
  },
  sarah: {
    name: "Sarah Chen",
    title: "Senior Talent Partner",
    image: "/recruiters/sarah.png",
    voiceHint: "female",
    companyArchetype: "Structured global company",
    focusAreas: [
      "motivation",
      "communication",
      "role fit",
      "specific examples",
    ],
    pressureStyle: "Warm first, then precise follow-ups",
  },
  startup_recruiter: {
    name: "Priya Raman",
    title: "Startup Talent Lead",
    image: "/recruiters/priya.png",
    voiceHint: "female",
    companyArchetype: "Fast-moving startup",
    focusAreas: ["speed", "initiative", "ambiguity", "business impact"],
    pressureStyle: "Pushes for speed, ambiguity handling, and resourcefulness",
  },
  priya: {
    name: "Priya Raman",
    title: "Startup Talent Lead",
    image: "/recruiters/priya.png",
    voiceHint: "female",
    companyArchetype: "Fast-moving startup",
    focusAreas: ["speed", "initiative", "ambiguity", "business impact"],
    pressureStyle: "Pushes for speed, ambiguity handling, and resourcefulness",
  },
  analytical_hiring_manager: {
    name: "Daniel Reed",
    title: "Senior Hiring Manager",
    image: "/recruiters/daniel.png",
    voiceHint: "male",
    companyArchetype: "Metrics-driven hiring team",
    focusAreas: [
      "metrics",
      "trade-offs",
      "technical reasoning",
      "decision quality",
    ],
    pressureStyle: "Drills into numbers, trade-offs, and individual ownership",
  },
  daniel: {
    name: "Daniel Reed",
    title: "Senior Hiring Manager",
    image: "/recruiters/daniel.png",
    voiceHint: "male",
    companyArchetype: "Metrics-driven hiring team",
    focusAreas: [
      "metrics",
      "trade-offs",
      "technical reasoning",
      "decision quality",
    ],
    pressureStyle: "Drills into numbers, trade-offs, and individual ownership",
  },
  german_corporate: {
    name: "Markus Weber",
    title: "Corporate Hiring Lead",
    image: "/recruiters/markus.png",
    voiceHint: "male",
    companyArchetype: "Process-oriented enterprise",
    focusAreas: ["process", "risk", "documentation", "consistency"],
    pressureStyle: "Tests consistency, documentation, and accountability",
  },
  markus: {
    name: "Markus Weber",
    title: "Corporate Hiring Lead",
    image: "/recruiters/markus.png",
    voiceHint: "male",
    companyArchetype: "Process-oriented enterprise",
    focusAreas: ["process", "risk", "documentation", "consistency"],
    pressureStyle: "Tests consistency, documentation, and accountability",
  },

  faang_hiring_manager: {
    name: "Alex Chen",
    title: "FAANG Hiring Manager",
    image: "/recruiters/alex.png",
    voiceHint: "male",
    companyArchetype: "Big Tech / FAANG",
    focusAreas: [
      "technical depth",
      "structured thinking",
      "metrics",
      "trade-offs",
    ],
    pressureStyle: "Technical, systematic, and probes every assumption",
  },
  alex: {
    name: "Alex Chen",
    title: "FAANG Hiring Manager",
    image: "/recruiters/alex.png",
    voiceHint: "male",
    companyArchetype: "Big Tech / FAANG",
    focusAreas: [
      "technical depth",
      "structured thinking",
      "metrics",
      "trade-offs",
    ],
    pressureStyle: "Technical, systematic, and probes every assumption",
  },
  startup_founder: {
    name: "Zoe Park",
    title: "Startup Founder",
    image: "/recruiters/zoe.png",
    voiceHint: "female",
    companyArchetype: "Founder-led startup",
    focusAreas: ["ownership", "speed", "failure recovery", "scaling decisions"],
    pressureStyle: "Fast, direct, and challenges buzzwords",
  },
  zoe: {
    name: "Zoe Park",
    title: "Startup Founder",
    image: "/recruiters/zoe.png",
    voiceHint: "female",
    companyArchetype: "Founder-led startup",
    focusAreas: ["ownership", "speed", "failure recovery", "scaling decisions"],
    pressureStyle: "Fast, direct, and challenges buzzwords",
  },
  consulting_partner: {
    name: "James Harrington",
    title: "Consulting Partner",
    image: "/recruiters/james.png",
    voiceHint: "male",
    companyArchetype: "Strategy consulting",
    focusAreas: [
      "case structure",
      "stakeholder logic",
      "recommendations",
      "clarity",
    ],
    pressureStyle: "Redirects rambling answers into structured reasoning",
  },
  james: {
    name: "James Harrington",
    title: "Consulting Partner",
    image: "/recruiters/james.png",
    voiceHint: "male",
    companyArchetype: "Strategy consulting",
    focusAreas: [
      "case structure",
      "stakeholder logic",
      "recommendations",
      "clarity",
    ],
    pressureStyle: "Redirects rambling answers into structured reasoning",
  },
  sales_director: {
    name: "Noah Jones",
    title: "Sales Director",
    image: "/recruiters/marcus.png",
    voiceHint: "male",
    companyArchetype: "Commercial sales organization",
    focusAreas: ["revenue", "quota", "deal size", "commercial ownership"],
    pressureStyle: "Numbers-first and pushes for quantified impact",
  },
  marcus: {
    name: "Noah Jones",
    title: "Sales Director",
    image: "/recruiters/marcus.png",
    voiceHint: "male",
    companyArchetype: "Commercial sales organization",
    focusAreas: ["revenue", "quota", "deal size", "commercial ownership"],
    pressureStyle: "Numbers-first and pushes for quantified impact",
  },
  product_leader: {
    name: "Aisha Patel",
    title: "Product Leader",
    image: "/recruiters/aisha.png",
    voiceHint: "female",
    companyArchetype: "Product-led technology company",
    focusAreas: [
      "user evidence",
      "prioritisation",
      "product sense",
      "cross-functional influence",
    ],
    pressureStyle: "Tests product judgment and user-backed decisions",
  },
  aisha: {
    name: "Aisha Patel",
    title: "Product Leader",
    image: "/recruiters/aisha.png",
    voiceHint: "female",
    companyArchetype: "Product-led technology company",
    focusAreas: [
      "user evidence",
      "prioritisation",
      "product sense",
      "cross-functional influence",
    ],
    pressureStyle: "Tests product judgment and user-backed decisions",
  },
  executive_recruiter: {
    name: "Victoria Stern",
    title: "Executive Recruiter",
    image: "/recruiters/victoria.png",
    voiceHint: "female",
    companyArchetype: "Executive search",
    focusAreas: [
      "leadership narrative",
      "strategic maturity",
      "executive presence",
      "self-awareness",
    ],
    pressureStyle: "Calm, senior-level, and deeply strategic",
  },
  victoria: {
    name: "Victoria Stern",
    title: "Executive Recruiter",
    image: "/recruiters/victoria.png",
    voiceHint: "female",
    companyArchetype: "Executive search",
    focusAreas: [
      "leadership narrative",
      "strategic maturity",
      "executive presence",
      "self-awareness",
    ],
    pressureStyle: "Calm, senior-level, and deeply strategic",
  },
  enterprise_recruiter: {
    name: "David Kimura",
    title: "Enterprise Recruiter",
    image: "/recruiters/david.png",
    voiceHint: "male",
    companyArchetype: "Enterprise HR / governance",
    focusAreas: ["process", "stakeholders", "escalation", "governance"],
    pressureStyle: "Structured, calm, and process-focused",
  },
  david: {
    name: "David Kimura",
    title: "Enterprise Recruiter",
    image: "/recruiters/david.png",
    voiceHint: "male",
    companyArchetype: "Enterprise HR / governance",
    focusAreas: ["process", "stakeholders", "escalation", "governance"],
    pressureStyle: "Structured, calm, and process-focused",
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

// ── CV-aware fallback questions ─────────────────────────────────────────────
// These are used by the rule-engine fallback (when the LLM times out or the
// Vapi path is unavailable). They are built dynamically from the candidate's
// actual CV data so even the fallback path feels personalised — not generic.
// No hardcoded names, roles, or companies: everything comes from setup.
function buildCvAwareQuestions(setup: InterviewSetup): string[] {
  const role = setup.targetRole || "this role";
  const profile = setup.resumeProfile as
    | { experience?: Array<{ title?: string; company?: string; dates?: string; bullets?: string[] }>; skills?: string[]; education?: Array<{ degree?: string; institution?: string }> }
    | null
    | undefined;

  const mostRecentJob = profile?.experience?.[0];
  const secondJob = profile?.experience?.[1];
  const topSkills = profile?.skills?.slice(0, 3).join(", ");
  const recentTitle = mostRecentJob?.title || "your most recent role";
  const recentCompany = mostRecentJob?.company;
  const recentBullet = mostRecentJob?.bullets?.[0];

  const q1 = recentCompany
    ? `Walk me through your background — starting with your time as ${recentTitle}${recentCompany ? ` at ${recentCompany}` : ""} — and explain what makes you right for ${role}.`
    : `Walk me through your background and explain what specifically makes you right for ${role}.`;

  const q2 = recentBullet
    ? `You mentioned ${recentBullet.toLowerCase().slice(0, 60)}… — give me one concrete example of that in action: the situation, what you did personally, and the outcome.`
    : recentTitle
    ? `Give me one concrete example from your time as ${recentTitle}: the situation, what you personally did, and the measurable outcome.`
    : "Give me one concrete situation from your experience: what the problem was, what you personally did, and what changed as a result.";

  const q3 = secondJob
    ? `You've worked across ${recentTitle} and ${secondJob.title || "other roles"} — what was the most difficult challenge you personally had to solve, and how did you approach it?`
    : "What was the hardest problem you personally had to solve in your career, and what exactly did you do?";

  const q4 = topSkills
    ? `You have experience with ${topSkills}. Walk me through a specific situation where that directly created a measurable result — not for the team, but for you personally.`
    : "What is the single most measurable result your work has produced? Give me the number, the context, and your exact contribution.";

  const q5 = `Looking back at your experience, what would you do differently today — and how does that make you better prepared for ${role}?`;

  return [q1, q2, q3, q4, q5];
}

// Fallback: static questions used only if setup has no CV data at all
const recruiterQuestionsFallback = [
  "Walk me through your background and what makes you the right fit for this role.",
  "Give me one concrete example from your experience: the situation, what you personally did, and the outcome.",
  "What was the hardest problem you personally had to solve, and how did you approach it?",
  "What is the most measurable result your work has produced? Give me a number.",
  "What would you do differently today, and how does that make you better prepared for this role?",
];

function getRecruiterQuestions(setup: InterviewSetup): string[] {
  try {
    const dynamic = buildCvAwareQuestions(setup);
    if (dynamic.every(q => q.length > 20)) return dynamic;
  } catch {}
  return recruiterQuestionsFallback;
}

// Legacy alias kept for the few call sites that reference recruiterQuestions directly
// (live copilot panel, snapshot display). These are read-only and non-critical.
const recruiterQuestions = recruiterQuestionsFallback;

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
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
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
  const key = raw.replace(/·/g, " ").replace(/-/g, "_").replace(/\s+/g, "_");

  if (!raw) return "friendly_hr";

  if (
    key === "friendly_hr" ||
    raw.includes("sarah") ||
    raw.includes("friendly")
  ) {
    return "friendly_hr";
  }

  if (key === "startup_recruiter" || raw.includes("priya")) {
    return "startup_recruiter";
  }

  if (
    key === "analytical_hiring_manager" ||
    raw.includes("daniel") ||
    raw.includes("analytical_hiring")
  ) {
    return "analytical_hiring_manager";
  }

  if (
    key === "german_corporate" ||
    raw.includes("markus") ||
    raw.includes("german_corporate")
  ) {
    return "german_corporate";
  }

  if (
    key === "faang_hiring_manager" ||
    raw.includes("alex") ||
    raw.includes("faang")
  ) {
    return "faang_hiring_manager";
  }

  if (
    key === "startup_founder" ||
    raw.includes("zoe") ||
    raw.includes("startup_founder")
  ) {
    return "startup_founder";
  }

  if (
    key === "consulting_partner" ||
    raw.includes("james") ||
    raw.includes("harrington") ||
    raw.includes("consulting")
  ) {
    return "consulting_partner";
  }

  if (
    key === "sales_director" ||
    raw.includes("marcus webb") ||
    raw.includes("noah jones") ||
    raw.includes("sales_director")
  ) {
    return "sales_director";
  }

  if (
    key === "product_leader" ||
    raw.includes("aisha") ||
    raw.includes("product_leader")
  ) {
    return "product_leader";
  }

  if (
    key === "executive_recruiter" ||
    raw.includes("victoria") ||
    raw.includes("stern") ||
    raw.includes("executive_recruiter")
  ) {
    return "executive_recruiter";
  }

  if (
    key === "enterprise_recruiter" ||
    raw.includes("david") ||
    raw.includes("kimura") ||
    raw.includes("enterprise_recruiter")
  ) {
    return "enterprise_recruiter";
  }

  return key || "friendly_hr";
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

function getNestedObject(source: unknown, paths: string[]) {
  if (!source || typeof source !== "object") return null;

  for (const path of paths) {
    let current: unknown = source;

    for (const part of path.split(".")) {
      if (!current || typeof current !== "object") {
        current = null;
        break;
      }

      current = (current as Record<string, unknown>)[part];
    }

    if (current && typeof current === "object")
      return current as Record<string, unknown>;
  }

  return null;
}

function stringList(value: unknown, limit = 10) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => safeText(item))
    .filter(Boolean)
    .slice(0, limit);
}

function buildReadableResumeContextFromProfile(
  profile: unknown,
  fallbackCvText: string,
) {
  if (!profile || typeof profile !== "object") return fallbackCvText;

  const data = profile as Record<string, unknown>;
  const basics =
    data.basics && typeof data.basics === "object"
      ? (data.basics as Record<string, unknown>)
      : {};
  const lines: string[] = [];

  const name = normalizeStoredCandidateName(basics.name);
  const headline = safeText(basics.headline);
  const email = safeText(basics.email);
  const phone = safeText(basics.phone);
  const location = safeText(basics.location);
  const linkedin = safeText(basics.linkedin);
  const summary = safeText(data.summary);

  if (name) lines.push(`Candidate name: ${name}`);
  if (headline) lines.push(`Headline: ${headline}`);
  if (email || phone || location || linkedin)
    lines.push(
      `Contact: ${[email, phone, location, linkedin].filter(Boolean).join(" • ")}`,
    );
  if (summary) lines.push(`Summary: ${summary}`);

  const experience = Array.isArray(data.experience)
    ? data.experience.slice(0, 6)
    : [];
  if (experience.length) {
    lines.push("Experience:");
    for (const item of experience) {
      if (!item || typeof item !== "object") continue;
      const exp = item as Record<string, unknown>;
      const title = safeText(exp.title || exp.role || exp.position, "Role");
      const company = safeText(exp.company || exp.organization);
      const dates = safeText(exp.dates || exp.period);
      const bullets = stringList(
        exp.bullets || exp.highlights || exp.responsibilities,
        4,
      );
      lines.push(`- ${[title, company, dates].filter(Boolean).join(" • ")}`);
      bullets.forEach((bullet) => lines.push(`  • ${bullet}`));
    }
  }

  const education = Array.isArray(data.education)
    ? data.education.slice(0, 4)
    : [];
  if (education.length) {
    lines.push("Education:");
    for (const item of education) {
      if (!item || typeof item !== "object") continue;
      const edu = item as Record<string, unknown>;
      lines.push(
        `- ${[safeText(edu.degree), safeText(edu.institution), safeText(edu.dates)].filter(Boolean).join(" • ")}`,
      );
    }
  }

  const skills = stringList(data.skills, 18);
  if (skills.length) lines.push(`Skills: ${skills.join(", ")}`);

  const projects = Array.isArray(data.projects)
    ? data.projects.slice(0, 4)
    : [];
  if (projects.length) {
    lines.push("Projects:");
    for (const item of projects) {
      if (!item || typeof item !== "object") continue;
      const project = item as Record<string, unknown>;
      const projectName = safeText(project.name, "Project");
      const bullets = stringList(project.bullets || project.highlights, 3);
      lines.push(`- ${projectName}`);
      bullets.forEach((bullet) => lines.push(`  • ${bullet}`));
    }
  }

  const languages = stringList(data.languages, 8);
  if (languages.length) lines.push(`Languages: ${languages.join(", ")}`);

  const context = lines.join("\n").trim();
  return context || fallbackCvText;
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

function findFirstStringDeep(
  source: unknown,
  keys: string[],
  depth = 0,
): string {
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

  if (market.includes("germany") || market.includes("deutschland"))
    return "German";
  if (
    market.includes("netherlands") ||
    market.includes("dutch") ||
    market.includes("nederland")
  )
    return "Dutch";
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
  if (
    /\b(resume|cv|curriculum|profile|summary|experience|education|skills|project|projects|sales|manager|executive|engineer|analyst|bootcamp|school|college|university|institute|academy|data|science|technology|technologies|software|solutions|services|support|specialist|consultant|developer|coordinator|administrator|director|assistant|associate|officer|partner|talent|recruiter|hiring|technical|business|customer|senior|junior|lead|head|chief|principal|intern|graduate|bachelor|master|degree|certificate|certification|diploma|training|course|program|bootcamp|coding|marketing|finance|accounting|operations|design|research|development|product|strategy|communications|program|management|digital|growth|success)\b/i.test(
      cleaned,
    )
  ) {
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

  // Skip formatted context strings (produced by buildReadableResumeContextFromProfile)
  // These start with "Candidate name:" / "Experience:" / "Skills:" etc.
  // Only look in the first 15 lines of truly raw text
  const rawLines = lines.slice(0, 15);

  const firstLine = rawLines.find((line) => {
    if (line.length < 3 || line.length > 50) return false;
    // Skip structured context keys
    if (
      /^(candidate name|headline|contact|summary|experience|education|skills|projects|languages|cv fact memory|raw cv|jd fact memory):/i.test(
        line,
      )
    )
      return false;
    if (/@|www|http|\+|\d/.test(line)) return false;
    // Skip lines that contain common CV section headers or job titles
    if (
      /\b(resume|curriculum|profile|summary|experience|education|skills|bootcamp|school|college|university|data science|data analyst|engineer|manager|specialist|consultant|support|developer|coordinator|director|partner|recruiter|technical|business|customer|senior|junior|lead|head|chief|intern|graduate)\b/i.test(
        line,
      )
    )
      return false;
    // Must look like a person's name: 2-4 words, all letters/hyphens/apostrophes
    const parts = line.split(/\s+/).filter(Boolean);
    if (parts.length < 2 || parts.length > 4) return false;
    return parts.every((part) => /^[A-Za-zÀ-ÖØ-öø-ÿ' .-]{2,}$/.test(part));
  });

  return firstLine || "";
}

function buildSetupFromStorage(): InterviewSetup {
  const canonicalStored = readLatestInterviewSetup();
  const stored = canonicalStored || findSetupFromLocalStorage();

  const state =
    stored && typeof stored === "object" && "state" in stored
      ? (stored as Record<string, unknown>).state
      : stored;

  const rawCvText = getNestedValue(state, [
    "cvText",
    "uploadedCvText",
    "resumeText",
    "candidateCv",
    "candidate.cvText",
    "setup.cvText",
    "profile.cvText",
  ]);

  const resumeProfile = getNestedObject(state, [
    "resumeProfile",
    "profile.resumeProfile",
    "candidate.resumeProfile",
    "setup.resumeProfile",
  ]);

  const cvText = buildReadableResumeContextFromProfile(
    resumeProfile,
    rawCvText,
  );

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

  const profileCandidateName = normalizeCandidateName(
    getNestedValue(state, [
      "resumeProfile.basics.name",
      "profile.resumeProfile.basics.name",
      "candidate.resumeProfile.basics.name",
      "setup.resumeProfile.basics.name",
    ]),
  );
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
  const candidateName =
    profileCandidateName || storedCandidateName || cvCandidateName || "";

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

  const profile =
    recruiterProfiles[recruiterId] || recruiterProfiles.friendly_hr;

  // Always derive from profile; only accept stored name if it matches this recruiter
  const storedRecruiterName = getNestedValue(state, [
    "recruiterName",
    "setup.recruiterName",
    "recruiter.name",
    "selectedRecruiter.name",
  ]);
  const storedNameBelongsToProfile =
    storedRecruiterName &&
    profile.name &&
    String(storedRecruiterName)
      .toLowerCase()
      .includes(profile.name.split(" ")[0].toLowerCase());
  const recruiterName =
    (storedNameBelongsToProfile ? storedRecruiterName : null) || profile.name;

  const storedRecruiterTitle = getNestedValue(state, [
    "recruiterTitle",
    "setup.recruiterTitle",
    "recruiter.title",
    "selectedRecruiter.title",
  ]);
  const recruiterTitle =
    (storedNameBelongsToProfile ? storedRecruiterTitle : null) || profile.title;

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
    resumeProfile: (resumeProfile as ResumeProfile | null) || null,
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
  if (value.includes("daniel") || value.includes("analytical"))
    return "50% 28%";
  if (value.includes("markus") || value.includes("corporate")) return "50% 28%";
  if (value.includes("priya") || value.includes("startup_recruiter"))
    return "50% 26%";
  if (value.includes("alex") || value.includes("faang")) return "50% 27%";
  if (value.includes("zoe") || value.includes("startup_founder"))
    return "50% 26%";
  if (value.includes("james") || value.includes("consulting")) return "50% 28%";
  if (
    value.includes("marcus") ||
    value.includes("noah") ||
    value.includes("sales")
  )
    return "50% 28%";
  if (value.includes("aisha") || value.includes("product")) return "50% 26%";
  if (value.includes("victoria") || value.includes("executive"))
    return "50% 27%";
  if (value.includes("david") || value.includes("enterprise")) return "50% 28%";
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

function trackWorkZoInterviewEvent(
  eventName: string,
  payload: Record<string, unknown> = {},
) {
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
      isLocal:
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1",
      environment: process.env.NODE_ENV,
      recruiter:
        typeof payload.recruiter === "string" ? payload.recruiter : undefined,
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
  if (typeof window === "undefined")
    return [] as Array<Record<string, unknown>>;

  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as Array<Record<string, unknown>>;
  }
}

function isWorkZoPremiumUnlocked(plan: "free" | "premium" | "premium_pro") {
  // Free users get premium intelligence and personas — only session count is limited.
  return true;
}

function pushWorkZoLocalEvent(
  key: string,
  eventName: string,
  payload: Record<string, unknown> = {},
  limit = 500,
) {
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
    window.localStorage.setItem(
      key,
      JSON.stringify([event, ...list].slice(0, limit)),
    );
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
  pushWorkZoLocalEvent(
    WORKZO_FAILURE_EVENTS_KEY,
    eventName,
    { severity, ...payload },
    500,
  );
  trackWorkZoInterviewEvent(eventName, { severity, ...payload });
}

function trackWorkZoErrorEvent(
  eventName: string,
  error: unknown,
  payload: Record<string, unknown> = {},
  severity: WorkZoFailureSeverity = "medium",
) {
  const errorMessage = normalizeErrorMessage(error);

  pushWorkZoLocalEvent(
    WORKZO_ERROR_EVENTS_KEY,
    eventName,
    {
      severity,
      errorMessage,
      ...payload,
    },
    500,
  );

  trackWorkZoFailureEvent(eventName, { errorMessage, ...payload }, severity);
}

function classifyAnswerQuality(
  answer: string,
  setup?: InterviewSetup,
): WorkZoAnswerQuality {
  const signal = analyzeAnswerSignals(answer, setup);

  if (signal.unsupported || signal.admission || signal.short || signal.vague)
    return "weak";
  if (
    signal.metric &&
    signal.ownership &&
    signal.outcome &&
    signal.wordCount >= 35
  )
    return "excellent";
  if (
    (signal.metric && signal.ownership) ||
    (signal.ownership && signal.outcome)
  )
    return "strong";
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

function summarizeAnswerQuality(
  transcript: TranscriptItem[],
  setup?: InterviewSetup,
) {
  const records = transcript
    .filter((item) => item.role === "candidate")
    .map((item) => buildAnswerQualityRecord(item.text, setup));

  const summary = records.reduce(
    (acc, item) => {
      acc[item.quality] += 1;
      return acc;
    },
    { weak: 0, average: 0, strong: 0, excellent: 0 } as Record<
      WorkZoAnswerQuality,
      number
    >,
  );

  return { records, summary };
}

function persistCandidatePatterns(
  memory: RecruiterMemoryState,
  setup: InterviewSetup,
) {
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
      const key =
        typeof item.id === "string"
          ? item.id
          : normalizeClaimText(String(item.pattern || ""));
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

    window.localStorage.setItem(
      WORKZO_CANDIDATE_PATTERNS_KEY,
      JSON.stringify(Array.from(merged.values()).slice(0, 40)),
    );
  } catch (error) {
    trackWorkZoErrorEvent(
      "candidate_pattern_persist_failed",
      error,
      { role: setup.targetRole },
      "low",
    );
  }
}

function readActiveInterviewSnapshot() {
  if (typeof window === "undefined") return null;

  try {
    const raw =
      window.localStorage.getItem(WORKZO_ACTIVE_INTERVIEW_KEY) ||
      window.localStorage.getItem(WORKZO_INTERVIEW_SNAPSHOT_KEY);
    if (!raw) return null;

    const snapshot = JSON.parse(raw) as Partial<WorkZoInterviewSnapshot>;
    if (!snapshot || snapshot.version !== 1) return null;
    if (
      !Array.isArray(snapshot.transcript) ||
      !snapshot.transcript.some(
        (item) => item.role === "recruiter" || item.role === "candidate",
      )
    )
      return null;
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
    trackWorkZoErrorEvent(
      "state_recovery_write_failed",
      error,
      { role: snapshot.setup.targetRole },
      "medium",
    );
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
  const questions = snapshot.transcript.filter(
    (item) => item.role === "recruiter",
  ).length;

  if (answers > 0)
    return `${answers} answer${answers === 1 ? "" : "s"} completed`;
  if (questions > 0)
    return `${questions} recruiter question${questions === 1 ? "" : "s"} saved`;
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

function recruiterStatusLabel(
  signal: RecruiterSignalState,
  scoreReady: boolean,
) {
  if (!scoreReady) return "Ready";
  if (signal.mood === "Impressed") return "Impressed";
  if (signal.mood === "Engaged") return "Interested";
  if (signal.mood === "Concerned") return "Concerned";
  if (signal.mood === "Doubtful") return "Skeptical";
  return "Neutral";
}

function recruiterStatusTone(
  signal: RecruiterSignalState,
  scoreReady: boolean,
) {
  if (!scoreReady) return "border-blue-300/20 bg-blue-400/10 text-blue-200";
  if (signal.mood === "Impressed")
    return "border-emerald-300/20 bg-emerald-400/10 text-emerald-200";
  if (signal.mood === "Engaged")
    return "border-blue-300/20 bg-blue-400/10 text-blue-200";
  if (signal.mood === "Concerned")
    return "border-amber-300/20 bg-amber-400/10 text-amber-200";
  if (signal.mood === "Doubtful")
    return "border-red-300/20 bg-red-400/10 text-red-200";
  return "border-slate-300/20 bg-slate-400/10 text-slate-200";
}

function buildLiveRecruiterThoughts(
  signal: RecruiterSignalState,
  memory: RecruiterMemoryState,
  scoreReady: boolean,
) {
  if (!scoreReady) {
    return [
      "Waiting for first answer",
      "Will check evidence",
      "Will listen for impact",
    ];
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

// A short, soft "go ahead" tone played exactly when the mic genuinely starts
// capturing. The Web Speech API has an inherent cold-start lag between
// .start() and actually receiving audio — that's a browser/engine limitation,
// not something fixable in app logic alone. The standard, proven mitigation
// (same one Alexa/Google Assistant/Siri use) is a clear, consistent audio
// cue people learn to wait for — it doesn't eliminate the underlying lag,
// but it eliminates the *guessing*, which is what actually causes people to
// start talking too early and lose their first words.
function playListeningChime() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.02);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.13);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.14);
    oscillator.onended = () => {
      try {
        ctx.close();
      } catch {}
    };
  } catch {
    // Non-critical — silently skip if audio context isn't available.
  }
}

// Catches answers that are technically 3+ words (so the raw word-count gate
// misses them) but carry essentially no real content — audio-check fragments
// like "hey can you" or "to you can you hear me" mid-interview. Strips known
// filler/audio-check phrases out and checks what's actually left.
function isLowContentAnswerFragment(value: string): boolean {
  const clean = value
    .toLowerCase()
    .replace(/[^a-zà-ÿ0-9\s']/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return true;
  const filler =
    /\b(hey+|hi+|hello+|okay+|ok+|yes+|no+|yeah+|sure+|right+|um+|uh+|to you|can you|hear me|do you|are you|there|please|sorry|wait|thanks?|thank you)\b/gi;
  const stripped = clean.replace(filler, " ").replace(/\s+/g, " ").trim();
  const strippedWordCount = stripped.split(/\s+/).filter(Boolean).length;
  return strippedWordCount <= 2;
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
  const value =
    `${setup.recruiterId} ${setup.recruiterName} ${setup.recruiterTitle}`.toLowerCase();

  return (
    value.includes("daniel") ||
    value.includes("markus") ||
    value.includes("alex") ||
    value.includes("james") ||
    value.includes("marcus") ||
    value.includes("noah") ||
    value.includes("david") ||
    value.includes("faang") ||
    value.includes("consulting") ||
    value.includes("sales") ||
    value.includes("enterprise") ||
    value.includes("male")
  );
}
function getAvailableVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !window.speechSynthesis)
    return Promise.resolve([]);

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

function preferredVoiceForRecruiter(
  voices: SpeechSynthesisVoice[],
  setup: InterviewSetup,
) {
  return getFallbackVoiceForLanguage(voices, setup);
}

// Scans CV text for date ranges like "2018 - 2020", "06/2016 to 2018",
// "Jan 2019 – Present", and sums their durations in years. Used as a
// fallback when a candidate's claimed years of experience isn't stated as
// a literal phrase in the CV — most CVs only show per-job date ranges, not
// a precomputed total, so without this the verification check would flag
// almost every honest candidate as "unverified" purely due to CV format.
function estimateTotalYearsFromDateRanges(cvText: string): number | null {
  const currentYear = new Date().getFullYear();
  // Matches "2018 - 2020", "2018-2020", "2018 to 2020", "2018 – present",
  // "06/2016 - 12/2018", etc. Captures the two 4-digit years (or "present"/
  // "current"/"now"/"heute"/"présent"/"aktuell" for the open-ended case).
  const rangePattern =
    /\b(?:\d{1,2}[/.])?(\d{4})\s*[-–—]\s*(?:\d{1,2}[/.])?(\d{4}|present|current|now|heute|présent|aktuell|actuellement)\b/gi;

  const ranges: Array<[number, number]> = [];
  let match: RegExpExecArray | null;
  while ((match = rangePattern.exec(cvText)) !== null) {
    const start = Number(match[1]);
    const endRaw = match[2].toLowerCase();
    const end = /^\d{4}$/.test(endRaw) ? Number(endRaw) : currentYear;
    if (
      start >= 1970 &&
      start <= currentYear &&
      end >= start &&
      end <= currentYear + 1
    ) {
      ranges.push([start, end]);
    }
  }

  if (ranges.length === 0) return null;

  // Merge overlapping ranges so concurrent roles aren't double-counted,
  // then sum the merged spans for a reasonable total-experience estimate.
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const [start, end] of ranges) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }

  const totalYears = merged.reduce(
    (sum, [start, end]) => sum + (end - start),
    0,
  );
  return totalYears > 0 ? totalYears : null;
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
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
    twenty: 20,
    "twenty one": 21,
    "twenty two": 22,
    "twenty three": 23,
    "twenty four": 24,
    "twenty five": 25,
    "twenty six": 26,
    "twenty seven": 27,
    "twenty eight": 28,
    "twenty nine": 29,
    thirty: 30,
  };

  // Check compound numbers ("twenty five") before single words ("twenty"),
  // since "twenty" alone would otherwise match first inside "twenty five".
  const sortedWords = Object.entries(words).sort(
    (a, b) => b[0].length - a[0].length,
  );

  for (const [word, value] of sortedWords) {
    if (
      new RegExp(
        `\\b${word.replace(" ", "[\\s-]+")}\\s+(?:years?|yrs?)\\b`,
      ).test(lower)
    )
      return value;
  }

  return null;
}

function normalizedEvidenceText(setup: InterviewSetup) {
  return `${setup.cvText || ""} ${setup.jobDescription || ""}`
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// CV-only evidence — used when checking claims about the candidate's OWN
// background (companies worked at, roles held, years of experience).
// Using cvText + jobDescription for these checks is a loophole: job
// descriptions are full of the target role's title and required skills
// (e.g. "Customer Success Manager"), so a candidate could claim to already
// BE whatever the JD asks for and have it "verified" by the JD itself. The
// JD describes what the employer wants, not what the candidate has done.
function cvOnlyEvidenceText(setup: InterviewSetup) {
  return `${setup.cvText || ""}`.toLowerCase().replace(/\s+/g, " ").trim();
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

  if (compactClaim.length >= 4 && compactEvidence.includes(compactClaim))
    return true;

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
        .replace(
          /\b(as|where|for|with|and|but|during|from|in|on|when|while)\b.*$/i,
          "",
        )
        .trim();

      if (
        value &&
        value.length >= 3 &&
        !/\b(years?|months?|experience|role|position|sales|executive|manager|engineer|analyst|support|customer|software|saas)\b/i.test(
          value,
        )
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
        /\b(executive|manager|engineer|analyst|developer|consultant|specialist|lead|support|sales|marketing|product|designer|recruiter|success)\b/i.test(
          role,
        )
      ) {
        roles.add(role);
      }
    }
  }

  return Array.from(roles);
}

function normalizeClaimForEvidence(value: string) {
  return safeText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\bcorporation\b/g, "corp")
    .replace(/\bcompany\b/g, "co")
    .replace(/\blimited\b/g, "ltd")
    .replace(/\bprivate\b/g, "pvt")
    .replace(/\btechnologies\b/g, "technology")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function claimRootAlias(value: string) {
  const normalized = normalizeClaimForEvidence(value);
  if (!normalized) return "";

  // STT distortions: strip common company suffixes so "Acme Corp" and "Acme"
  // both normalize to the same root token for matching.
  // This is generic — it works for any company name, not specific ones.
  const withoutSuffix = normalized.replace(/(?:corp|gmbh|ltd|inc|llc|co|group|ag|ug|kg|solutions|technologies|technology|systems|services|software|digital|global|international)$/, "").trim();
  if (withoutSuffix && withoutSuffix.length >= 3) return withoutSuffix;

  return normalized;
}

function claimMatchesVerifiedFact(claim: string, facts: string[]) {
  const claimNorm = normalizeClaimForEvidence(claim);
  const claimAlias = claimRootAlias(claim);
  if (!claimNorm || !claimAlias) return false;

  return facts.some((fact) => {
    const factNorm = normalizeClaimForEvidence(fact);
    const factAlias = claimRootAlias(fact);
    if (!factNorm || !factAlias) return false;

    if (claimNorm === factNorm || claimAlias === factAlias) return true;
    if (claimNorm.length >= 4 && factNorm.includes(claimNorm)) return true;
    if (factNorm.length >= 4 && claimNorm.includes(factNorm)) return true;

    // If both names share a strong first token, treat it as supported. This
    // prevents false challenges when STT mishears any employer suffix,
    // while still avoiding random two-letter matches.
    const claimFirst =
      safeText(claim)
        .toLowerCase()
        .split(/\s+/)[0]
        ?.replace(/[^a-z0-9]/g, "") || "";
    const factFirst =
      safeText(fact)
        .toLowerCase()
        .split(/\s+/)[0]
        ?.replace(/[^a-z0-9]/g, "") || "";
    return claimFirst.length >= 4 && claimFirst === factFirst;
  });
}

function verifiedResumeFactBlock(setup: InterviewSetup) {
  const cvFacts = extractCvFactMemory(setup);
  const profile = setup.resumeProfile as
    | Record<string, unknown>
    | null
    | undefined;
  const experience = Array.isArray(profile?.experience)
    ? (profile.experience as Array<Record<string, unknown>>)
        .map((job) => {
          const title = safeText(job.title);
          const company = safeText(job.company);
          const dates = safeText(job.dates);
          return [title, company, dates].filter(Boolean).join(" • ");
        })
        .filter(Boolean)
        .slice(0, 8)
    : [];

  return [
    "VERIFIED RESUME FACTS — AUTHORITATIVE:",
    cvFacts.companies.length
      ? `Verified companies/employers: ${cvFacts.companies.join(", ")}.`
      : "Verified companies/employers: none extracted.",
    cvFacts.roles.length
      ? `Verified roles/titles: ${cvFacts.roles.join(", ")}.`
      : "Verified roles/titles: none extracted.",
    experience.length
      ? `Verified experience timeline: ${experience.join(" | ")}.`
      : "Verified experience timeline: none extracted.",
    cvFacts.skills.length
      ? `Verified skills/signals: ${cvFacts.skills.join(", ")}.`
      : "Verified skills/signals: none extracted.",
    "MANDATORY RULE: Never say you do not see, cannot verify, cannot confirm, do not see enough detail, not listed, not reflected in the CV, or need to pause for a company, employer, role, years-of-experience claim, education entry, project, achievement, responsibility, or skill if it is listed above or appears as a close speech-to-text variant of a listed fact.",
    "Speech-to-text variants are common — if the candidate names a company that sounds like a verified employer, treat it as that employer and continue normally.",
    "If the candidate says a verified company or role, ask about responsibilities, ownership, examples, challenges, metrics, and outcomes instead of challenging whether it exists or whether there is enough CV detail.",
  ].join("\n");
}

function extractUnsupportedClaimReason(answer: string, setup: InterviewSetup) {
  const evidence = normalizedEvidenceText(setup);
  if (!evidence) return "";

  const cvEvidence = cvOnlyEvidenceText(setup);
  const lower = answer.toLowerCase();

  if (
    /\b(i lied|i made that up|i made it up|not true|wasn't true|that is false|i exaggerated|sorry.*lie|i just lied|i was lying|fake)\b/i.test(
      lower,
    )
  ) {
    return "The candidate admitted the claim is false or exaggerated.";
  }

  const cvFacts = extractCvFactMemory(setup);

  const companyClaims = extractCompanyClaims(answer);
  for (const company of companyClaims) {
    if (claimMatchesVerifiedFact(company, cvFacts.companies)) continue;
    if (!evidenceIncludesClaim(cvEvidence, company)) {
      return `The company "${company}" is not visible in the candidate's CV.`;
    }
  }

  const roleClaims = extractRoleClaims(answer);
  for (const role of roleClaims) {
    if (claimMatchesVerifiedFact(role, cvFacts.roles)) continue;
    if (!evidenceIncludesClaim(cvEvidence, role)) {
      return `The role "${role}" is not clearly supported by the CV.`;
    }
  }

  const yearsClaim = extractYearsClaim(answer);
  if (yearsClaim) {
    const directDigit = new RegExp(
      `\\b${yearsClaim}\\s*(?:\\+?\\s*)?(?:years?|yrs?)\\b`,
      "i",
    );
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
      16: "sixteen",
      17: "seventeen",
      18: "eighteen",
      19: "nineteen",
      20: "twenty",
      21: "twenty one",
      22: "twenty two",
      23: "twenty three",
      24: "twenty four",
      25: "twenty five",
      26: "twenty six",
      27: "twenty seven",
      28: "twenty eight",
      29: "twenty nine",
      30: "thirty",
    };

    const word = wordMap[yearsClaim];
    const directWord = word
      ? new RegExp(`\\b${word}\\s+(?:years?|yrs?)\\b`, "i")
      : null;

    const literalMatch =
      directDigit.test(cvEvidence) ||
      Boolean(directWord && directWord.test(cvEvidence));

    if (!literalMatch) {
      // Fall back to summing employment date ranges found in the CV
      // (e.g. "2018 - 2020", "2016 to 2018") before concluding the claim
      // is unverified. Many CVs state duration only as date ranges per
      // job, never as a literal "N years" phrase — without this check,
      // a candidate whose CV genuinely supports their claimed experience
      // gets falsely challenged purely because of how their CV is worded.
      const totalYearsFromRanges = estimateTotalYearsFromDateRanges(cvEvidence);
      // Allow some slack — total claimed experience often spans roles not
      // captured as clean ranges (internships, freelance gaps, rounding),
      // so treat the claim as supported if it's within ~1.5 years of the
      // CV's own date-range total, rather than requiring an exact match.
      const rangeSupportsClaim =
        totalYearsFromRanges !== null &&
        Math.abs(totalYearsFromRanges - yearsClaim) <= 1.5;

      if (!rangeSupportsClaim) {
        return `${yearsClaim} years of experience is not clearly stated in the CV text`;
      }
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
    return "Quick check before we continue — what evidence from your background supports that?";
  }

  // The years-of-experience case is the most common source of false
  // positives (CVs phrase duration in many ways a CV-text match can't
  // anticipate), so it gets a noticeably gentler framing than company/role
  // mismatches, which are more clearly either right or wrong.
  if (/years of experience is not clearly stated/i.test(reason)) {
    return `Quick check — ${reason}. Could you walk me through the roles or dates that add up to that, so I can follow along?`;
  }

  return `I want to make sure I understood that correctly. ${reason} Could you briefly clarify where this fits in your background, and then give me one concrete example from that experience?`;
}

function selectedLanguageCode(setup: InterviewSetup) {
  return normalizeInterviewLanguage(setup.language).code;
}

function selectedLanguageIsoCode(setup: InterviewSetup) {
  const code = selectedLanguageCode(setup).toLowerCase();
  if (code.startsWith("zh")) return "zh";
  if (code.startsWith("pt")) return "pt";
  return code.split("-")[0] || "en";
}

function buildVapiTranscriberOverride(setup: InterviewSetup) {
  const language = normalizeInterviewLanguage(setup.language);
  const isoLanguage = selectedLanguageIsoCode(setup);

  // IMPORTANT: Vapi/Daily transcripts were being decoded as English for
  // German/French/etc. interviews, producing garbage such as
  // "Danker for dinner" instead of real German. Lock STT to the selected
  // interview language for every call; never rely on auto-detect.
  return {
    provider: "deepgram",
    model: "nova-2",
    language: isoLanguage,
    smartFormat: true,
    // Vapi maximum endpointing is 500ms. Values above 500 cause a 400 Bad Request.
    // English: 350ms (faster responses, natural cadence)
    // Non-English: 480ms (slightly more time for non-native speech patterns, stays under 500)
    endpointing: language.code.toLowerCase().startsWith("en") ? 350 : 480,
  };
}

function buildLocalizedGreeting(setup: InterviewSetup) {
  const language = normalizeInterviewLanguage(setup.language);
  const name = safeGreetingName(setup.candidateName);
  const hasRealName = name !== "there" && name.length > 1;

  switch (language.code) {
    case "de-DE":
      return hasRealName ? `Hallo ${name}. Danke, dass du heute hier bist. Wie geht es dir?` : `Hallo. Danke, dass du heute hier bist. Wie geht es dir?`;
    case "nl-NL":
      return hasRealName ? `Hallo ${name}. Bedankt dat je er vandaag bent. Hoe gaat het met je?` : `Hallo. Bedankt dat je er vandaag bent. Hoe gaat het met je?`;
    case "fr-FR":
      return hasRealName ? `Bonjour ${name}. Merci d'être là aujourd'hui. Comment allez-vous ?` : `Bonjour. Merci d'être là aujourd'hui. Comment allez-vous ?`;
    case "es-ES":
      return hasRealName ? `Hola ${name}. Gracias por estar aquí hoy. ¿Cómo estás?` : `Hola. Gracias por estar aquí hoy. ¿Cómo estás?`;
    case "it-IT":
      return hasRealName ? `Ciao ${name}. Grazie per essere qui oggi. Come stai?` : `Ciao. Grazie per essere qui oggi. Come stai?`;
    case "pt-PT":
      return hasRealName ? `Olá ${name}. Obrigado por estares aqui hoje. Como estás?` : `Olá. Obrigado por estares aqui hoje. Como estás?`;
    case "zh-CN":
      return hasRealName ? `${name}，你好。感谢你今天参加面试。你现在感觉怎么样？` : `你好。感谢你今天参加面试。你现在感觉怎么样？`;
    case "ja-JP":
      return hasRealName ? `${name}さん、本日はありがとうございます。ご気分はいかがですか？` : `本日はありがとうございます。ご気分はいかがですか？`;
    case "ko-KR":
      return hasRealName ? `${name}님, 오늘 참석해 주셔서 감사합니다. 지금 기분은 어떠신가요?` : `오늘 참석해 주셔서 감사합니다. 지금 기분은 어떠신가요?`;
    case "ar-SA":
      return hasRealName ? `مرحبًا ${name}. شكرًا لانضمامك اليوم. كيف حالك؟` : `مرحبًا. شكرًا لانضمامك اليوم. كيف حالك؟`;
    case "pl-PL":
      return hasRealName ? `Cześć ${name}. Dziękuję, że jesteś dzisiaj. Jak się masz?` : `Cześć. Dziękuję, że jesteś dzisiaj. Jak się masz?`;
    case "ru-RU":
      return hasRealName ? `Здравствуйте, ${name}. Спасибо, что присоединились сегодня. Как вы себя чувствуете?` : `Здравствуйте. Спасибо, что присоединились сегодня. Как вы себя чувствуете?`;
    case "tr-TR":
      return hasRealName ? `Merhaba ${name}. Bugün katıldığın için teşekkür ederim. Nasılsın?` : `Merhaba. Bugün katıldığın için teşekkür ederim. Nasılsın?`;
    case "hi-IN":
      return hasRealName ? `नमस्ते ${name}. आज इंटरव्यू में शामिल होने के लिए धन्यवाद। आप कैसे हैं?` : `नमस्ते। आज इंटरव्यू में शामिल होने के लिए धन्यवाद। आप कैसे हैं?`;
    case "ta-IN":
      return hasRealName ? `வணக்கம் ${name}. இன்று நேர்காணலில் சேர்ந்ததற்கு நன்றி. எப்படி இருக்கிறீர்கள்?` : `வணக்கம். இன்று நேர்காணலில் சேர்ந்ததற்கு நன்றி. எப்படி இருக்கிறீர்கள்?`;
    default:
      return `Hi ${name}. I'm ${setup.recruiterName || "Sarah"}, ${setup.recruiterTitle || "Senior Talent Partner"}. Thanks for joining today — how are you doing?`;
  }
}

function buildLocalizedIntroQuestion(setup: InterviewSetup) {
  const language = normalizeInterviewLanguage(setup.language);
  const role = setup.targetRole || "this role";

  switch (language.code) {
    case "de-DE":
      return `Schön. Ich habe mir deinen Lebenslauf und die Rolle ${role} angesehen. Zum Einstieg: Kannst du dich bitte kurz vorstellen und erklären, wie deine Erfahrung zu dieser Gelegenheit passt?`;
    case "nl-NL":
      return `Fijn. Ik heb je cv en de rol ${role} bekeken. Om te beginnen: kun je jezelf kort voorstellen en uitleggen hoe je ervaring aansluit op deze kans?`;
    case "fr-FR":
      return `Très bien. J’ai consulté votre CV et le poste ${role}. Pour commencer, pouvez-vous vous présenter brièvement et expliquer en quoi votre expérience correspond à cette opportunité ?`;
    case "es-ES":
      return `Perfecto. He revisado tu CV y el puesto de ${role}. Para empezar, ¿puedes presentarte brevemente y explicar cómo tu experiencia encaja con esta oportunidad?`;
    case "it-IT":
      return `Perfetto. Ho letto il tuo CV e il ruolo ${role}. Per iniziare, puoi presentarti brevemente e spiegare come la tua esperienza si collega a questa opportunità?`;
    case "pt-PT":
      return `Ótimo. Analisei o teu CV e a função ${role}. Para começar, podes apresentar-te brevemente e explicar como a tua experiência se relaciona com esta oportunidade?`;
    case "zh-CN":
      return `好的。我看过你的简历和${role}这个职位。我们先从自我介绍开始：请你简要介绍一下自己，并说明你的经验如何匹配这个机会。`;
    case "ja-JP":
      return `ありがとうございます。履歴書と${role}の職務内容を確認しました。まず、簡単に自己紹介をして、このポジションにご自身の経験がどうつながるか説明していただけますか？`;
    case "ko-KR":
      return `좋습니다. 이력서와 ${role} 역할을 검토했습니다. 먼저 간단히 자기소개를 해주시고, 본인의 경험이 이 기회와 어떻게 연결되는지 설명해 주시겠어요?`;
    case "ar-SA":
      return `جيد. لقد راجعت سيرتك الذاتية ودور ${role}. لنبدأ: هل يمكنك تقديم نفسك باختصار وشرح كيف ترتبط خبرتك بهذه الفرصة؟`;
    case "pl-PL":
      return `Dobrze. Zapoznałem się z twoim CV i rolą ${role}. Na początek: przedstaw się krótko i wyjaśnij, jak twoje doświadczenie pasuje do tej możliwości.`;
    case "ru-RU":
      return `Хорошо. Я посмотрел ваше резюме и роль ${role}. Для начала коротко представьтесь и объясните, как ваш опыт связан с этой возможностью.`;
    case "tr-TR":
      return `Güzel. Özgeçmişini ve ${role} rolünü inceledim. Başlamak için kendini kısaca tanıtıp deneyiminin bu fırsatla nasıl bağlantılı olduğunu açıklar mısın?`;
    case "hi-IN":
      return `अच्छा। मैंने आपका CV और ${role} भूमिका देखी है। शुरुआत के लिए, कृपया अपना छोटा परिचय दें और बताएं कि आपका अनुभव इस अवसर से कैसे जुड़ता है।`;
    case "ta-IN":
      return `சரி. உங்கள் CV மற்றும் ${role} பொறுப்பை பார்த்தேன். ஆரம்பமாக, உங்களைச் சுருக்கமாக அறிமுகப்படுத்தி, உங்கள் அனுபவம் இந்த வாய்ப்புடன் எப்படி தொடர்புடையது என்பதை சொல்ல முடியுமா?`;
    default:
      return `Great. I’ve had a look at your background and I can see you’re targeting a ${role} position. To get started, tell me about yourself — what you’ve been doing and what’s driving you toward this direction.`;
  }
}

function buildLocalizedGentleClarification(setup: InterviewSetup) {
  const language = normalizeInterviewLanguage(setup.language);

  switch (language.code) {
    case "de-DE":
      return "Kein Problem. Nimm dir kurz Zeit. Bitte stell dich in zwei bis drei Sätzen vor und nenne eine Erfahrung, die für diese Rolle relevant ist.";
    case "nl-NL":
      return "Geen probleem. Neem even de tijd. Stel jezelf in twee of drie zinnen voor en noem één ervaring die relevant is voor deze rol.";
    case "fr-FR":
      return "Pas de problème. Prenez un instant. Présentez-vous en deux ou trois phrases et donnez une expérience pertinente pour ce poste.";
    case "es-ES":
      return "No pasa nada. Tómate un momento. Preséntate en dos o tres frases y menciona una experiencia relevante para este puesto.";
    case "it-IT":
      return "Nessun problema. Prenditi un momento. Presentati in due o tre frasi e cita un’esperienza rilevante per questo ruolo.";
    case "pt-PT":
      return "Sem problema. Tira um momento. Apresenta-te em duas ou três frases e menciona uma experiência relevante para esta função.";
    case "hi-IN":
      return "कोई बात नहीं। थोड़ा समय लें। दो या तीन वाक्यों में अपना परिचय दें और इस भूमिका से जुड़ा एक अनुभव बताएं।";
    case "ta-IN":
      return "பரவாயில்லை. சிறிது நேரம் எடுத்துக் கொள்ளுங்கள். இரண்டு அல்லது மூன்று வாக்கியங்களில் உங்களை அறிமுகப்படுத்தி, இந்த பொறுப்புக்கு தொடர்பான ஒரு அனுபவத்தைச் சொல்லுங்கள்.";
    default:
      return "No problem. Take a moment. Please introduce yourself in two or three sentences and mention one experience that is relevant to this role.";
  }
}

function isGreetingOrLanguageCheck(answer: string) {
  const lower = answer.toLowerCase().trim();
  return (
    answer.trim().split(/\s+/).filter(Boolean).length <= 12 &&
    /\b(hello|hi|hey|how are you|can you hear me|do you hear me|namaste|नमस्ते|hallo|bonjour|hola|ciao|olá|ola|வணக்கம்)\b/i.test(
      lower,
    )
  );
}

function isConfusedOrNeedsRepeat(answer: string) {
  return /\b(i don'?t understand|not understand|repeat|again|confused|समझ नहीं|समझ नही|samajh|नहीं समझ|nicht verstanden|nochmal|répéter|repete|no entiendo|non capisco)\b/i.test(
    answer,
  );
}

function earlyInterviewReply(
  answer: string,
  questionIndex: number,
  setup: InterviewSetup,
) {
  if (questionIndex <= 1) return buildLocalizedIntroQuestion(setup);
  if (questionIndex <= 2 && isConfusedOrNeedsRepeat(answer))
    return buildLocalizedGentleClarification(setup);
  if (questionIndex <= 2 && isGreetingOrLanguageCheck(answer))
    return buildLocalizedIntroQuestion(setup);
  return "";
}

function buildOpeningFlowInstruction(setup: InterviewSetup) {
  const language = normalizeInterviewLanguage(setup.language);
  return [
    `OPENING FLOW — speak in ${language.label}.`,
    "First message must only greet the candidate and ask how they are doing.",
    "After the candidate responds, acknowledge naturally and ask for a short self-introduction connected to the target role.",
    "Do not ask for metrics, proof, pressure questions, or challenges until after the candidate has given a real introduction answer.",
    "If the candidate asks to use another language, acknowledge the language request first and continue in the selected/requested language.",
  ].join(" ");
}

function enforceRuntimeLanguageForReply(setup: InterviewSetup, reply: string) {
  const language = normalizeInterviewLanguage(setup.language);
  const text = safeText(reply);
  if (!text || language.code === "en-US") return text;

  if (language.code === "de-DE") {
    if (/^Yes, I can hear you/i.test(text))
      return "Ja, ich kann dich hören. Lass uns richtig beginnen. Gib mir bitte einen kurzen Überblick über deinen Hintergrund und warum diese Rolle für dich relevant ist.";
    if (/I’m following you, but I need more detail/i.test(text))
      return "Ich folge dir, aber ich brauche mehr Details, bevor ich die Passung beurteilen kann. Gib mir eine konkrete Situation, was du persönlich getan hast und was sich danach verändert hat.";
    if (/The answer still sounds team-level/i.test(text))
      return "Die Antwort klingt noch zu sehr nach Teamleistung. Was genau hast du persönlich entschieden, gebaut, gelöst oder verantwortet?";
    if (/measurable impact|Now add measurable/i.test(text))
      return "Die Geschichte ist klar. Jetzt brauche ich messbare Wirkung. Was hat sich nach deiner Arbeit verändert — Zeitersparnis, weniger Fehler, bessere Qualität, Kundenzufriedenheit oder ein Geschäftsergebnis?";
    if (/I need to pause there/i.test(text))
      return "Ich muss hier kurz stoppen. Diese Aussage kann ich aus deinem CV nicht klar verifizieren. Kannst du erklären, ob das offizielle Berufserfahrung, freiberufliche Arbeit, freiwillige Erfahrung, übertragbare Erfahrung oder nur ein Beispielszenario war?";
  }

  if (language.code === "nl-NL") {
    if (/^Yes, I can hear you/i.test(text))
      return "Ja, ik kan je horen. Laten we goed beginnen. Geef me kort een overzicht van je achtergrond en waarom deze rol relevant voor je is.";
    if (/I’m following you, but I need more detail/i.test(text))
      return "Ik volg je, maar ik heb meer details nodig voordat ik de fit kan beoordelen. Geef één concrete situatie, wat jij persoonlijk deed en wat er daarna veranderde.";
    if (/The answer still sounds team-level/i.test(text))
      return "Het antwoord klinkt nog te veel als teamniveau. Wat heb jij persoonlijk besloten, gebouwd, opgelost of geleverd?";
    if (/measurable impact|Now add measurable/i.test(text))
      return "Het verhaal is duidelijk. Nu wil ik meetbare impact. Wat veranderde er na jouw werk — tijdwinst, minder fouten, betere kwaliteit, klanttevredenheid of een bedrijfsresultaat?";
  }

  if (language.code === "fr-FR") {
    if (/^Yes, I can hear you/i.test(text))
      return "Oui, je t’entends. Commençons correctement. Présente brièvement ton parcours et explique pourquoi ce poste est pertinent pour toi.";
    if (/I’m following you, but I need more detail/i.test(text))
      return "Je te suis, mais j’ai besoin de plus de détails pour évaluer la pertinence. Donne-moi une situation concrète, ce que tu as fait personnellement et ce qui a changé ensuite.";
    if (/The answer still sounds team-level/i.test(text))
      return "La réponse semble encore trop collective. Qu’as-tu personnellement décidé, construit, résolu ou livré ?";
    if (/measurable impact|Now add measurable/i.test(text))
      return "L’histoire est claire. Maintenant, ajoute un impact mesurable. Qu’est-ce qui a changé après ton travail ?";
  }

  if (language.code === "es-ES") {
    if (/^Yes, I can hear you/i.test(text))
      return "Sí, puedo escucharte. Empecemos bien. Dame un breve resumen de tu trayectoria y por qué este puesto es relevante para ti.";
    if (/I’m following you, but I need more detail/i.test(text))
      return "Te sigo, pero necesito más detalle para evaluar el encaje. Dame una situación concreta, lo que hiciste personalmente y qué cambió después.";
    if (/The answer still sounds team-level/i.test(text))
      return "La respuesta todavía suena demasiado a trabajo de equipo. ¿Qué decidiste, construiste, resolviste o entregaste tú personalmente?";
    if (/measurable impact|Now add measurable/i.test(text))
      return "La historia está clara. Ahora añade impacto medible. ¿Qué cambió después de tu trabajo?";
  }

  if (language.code === "it-IT") {
    if (/^Yes, I can hear you/i.test(text))
      return "Sì, ti sento. Iniziamo bene. Raccontami brevemente il tuo percorso e perché questo ruolo è rilevante per te.";
    if (/I’m following you, but I need more detail/i.test(text))
      return "Ti seguo, ma ho bisogno di più dettagli per valutare l’idoneità. Dammi una situazione concreta, cosa hai fatto personalmente e cosa è cambiato dopo.";
    if (/The answer still sounds team-level/i.test(text))
      return "La risposta sembra ancora troppo a livello di team. Cosa hai deciso, costruito, risolto o consegnato personalmente?";
    if (/measurable impact|Now add measurable/i.test(text))
      return "La storia è chiara. Ora aggiungi un impatto misurabile. Cosa è cambiato dopo il tuo lavoro?";
  }

  if (language.code === "pt-PT") {
    if (/^Yes, I can hear you/i.test(text))
      return "Sim, consigo ouvir-te. Vamos começar corretamente. Dá-me um breve resumo do teu percurso e explica porque esta função é relevante para ti.";
    if (/I’m following you, but I need more detail/i.test(text))
      return "Estou a acompanhar, mas preciso de mais detalhes antes de avaliar o encaixe. Dá-me uma situação concreta, o que fizeste pessoalmente e o que mudou depois.";
    if (/The answer still sounds team-level/i.test(text))
      return "A resposta ainda soa demasiado ao nível da equipa. O que decidiste, construíste, resolveste ou entregaste pessoalmente?";
    if (/measurable impact|Now add measurable/i.test(text))
      return "A história está clara. Agora adiciona impacto mensurável. O que mudou depois do teu trabalho?";
  }

  if (language.code === "zh-CN") {
    if (/^Yes, I can hear you/i.test(text))
      return "好的，我能听到你。让我们正式开始。请简要介绍一下你的背景，以及为什么这个职位对你来说是合适的。";
    if (/I'm following you, but I need more detail/i.test(text))
      return "我在听，但在评估匹配度之前，我需要更多细节。请给我一个具体的情境——你个人做了什么，以及之后发生了什么变化。";
    if (/The answer still sounds team-level/i.test(text))
      return "这个回答听起来还是停留在团队层面。你个人具体决定、构建、解决或交付了什么？";
    if (/measurable impact|Now add measurable/i.test(text))
      return "故事很清晰。现在请加上可量化的影响。你的工作之后发生了什么变化？";
  }

  if (language.code === "ar-SA") {
    if (/^Yes, I can hear you/i.test(text))
      return "نعم، أسمعك. لنبدأ بشكل صحيح. أخبرني باختصار عن خلفيتك ولماذا هذا الدور مناسب لك.";
    if (/I'm following you, but I need more detail/i.test(text))
      return "أتابعك، لكنني أحتاج إلى مزيد من التفاصيل. أعطني موقفًا محددًا، وما الذي فعلته شخصيًا، وما الذي تغير بعد ذلك.";
    if (/The answer still sounds team-level/i.test(text))
      return "الإجابة لا تزال تبدو على مستوى الفريق. ماذا قررت أو بنيت أو حللت أو قدمت بشكل شخصي؟";
    if (/measurable impact|Now add measurable/i.test(text))
      return "القصة واضحة. الآن أضف تأثيرًا قابلًا للقياس. ماذا تغير بعد عملك؟";
  }

  if (language.code === "pl-PL") {
    if (/^Yes, I can hear you/i.test(text))
      return "Tak, słyszę cię. Zacznijmy właściwie. Opowiedz mi krótko o swoim doświadczeniu i dlaczego ta rola jest dla ciebie odpowiednia.";
    if (/I'm following you, but I need more detail/i.test(text))
      return "Rozumiem cię, ale potrzebuję więcej szczegółów. Podaj mi konkretną sytuację, co ty osobiście zrobiłeś i co się potem zmieniło.";
    if (/The answer still sounds team-level/i.test(text))
      return "Odpowiedź nadal brzmi jak praca zespołowa. Co ty osobiście zdecydowałeś, zbudowałeś, rozwiązałeś lub dostarczyłeś?";
    if (/measurable impact|Now add measurable/i.test(text))
      return "Historia jest jasna. Teraz dodaj mierzalny wpływ. Co zmieniło się po twojej pracy?";
  }

  if (language.code === "hi-IN") {
    if (/^Yes, I can hear you/i.test(text))
      return "हाँ, मैं आपको सुन पा रही हूँ। चलिए सही तरीके से शुरू करते हैं। कृपया अपने बारे में संक्षेप में बताइए और यह भूमिका आपके लिए क्यों उपयुक्त है।";
    if (/I’m following you, but I need more detail/i.test(text))
      return "मैं समझ रही हूँ, लेकिन बेहतर आकलन के लिए मुझे और विवरण चाहिए। एक वास्तविक स्थिति बताइए, आपने व्यक्तिगत रूप से क्या किया और उसके बाद क्या बदला।";
    if (/The answer still sounds team-level/i.test(text))
      return "यह उत्तर अभी भी टीम-स्तर का लग रहा है। आपने व्यक्तिगत रूप से क्या निर्णय लिया, बनाया, हल किया या डिलीवर किया?";
    if (
      /measurable impact|Now add measurable|Give me one concrete metric/i.test(
        text,
      )
    )
      return "उदाहरण समझ आया। अब मापने योग्य प्रभाव बताइए — समय, टिकट, गुणवत्ता, ग्राहक संतुष्टि, लागत या परिणाम में क्या बदलाव आया?";
    if (/I need to pause there/i.test(text))
      return "मुझे यहाँ थोड़ी देर रुकना होगा। यह दावा आपके CV से स्पष्ट रूप से सत्यापित नहीं हो रहा है। कृपया बताएं कि यह आधिकारिक नौकरी, freelance काम, volunteer अनुभव, transferable experience या सिर्फ example scenario था?";
    if (/Thank you for being honest/i.test(text))
      return "ईमानदारी के लिए धन्यवाद। चलिए अब केवल आपके CV में दिख रहे verified experience पर आगे बढ़ते हैं। किसी एक वास्तविक project, customer issue या responsibility के बारे में बताइए।";
  }

  if (language.code === "ta-IN") {
    if (/^Yes, I can hear you/i.test(text))
      return "ஆம், உங்களை கேட்க முடிகிறது. சரியாக தொடங்கலாம். உங்கள் பின்னணி மற்றும் இந்த பொறுப்பு ஏன் உங்களுக்கு பொருத்தமானது என்பதைச் சுருக்கமாக சொல்லுங்கள்.";
    if (/I’m following you, but I need more detail/i.test(text))
      return "நான் புரிந்துகொள்கிறேன், ஆனால் பொருத்தத்தை மதிப்பிட மேலும் விவரம் தேவை. ஒரு குறிப்பிட்ட சூழ்நிலை, நீங்கள் தனிப்பட்ட முறையில் செய்தது, அதன் பிறகு மாறியது என்ன என்பதைச் சொல்லுங்கள்.";
    if (/The answer still sounds team-level/i.test(text))
      return "இந்த பதில் இன்னும் குழு அளவில் இருக்கிறது. நீங்கள் தனிப்பட்ட முறையில் என்ன முடிவு செய்தீர்கள், உருவாக்கினீர்கள், சரிசெய்தீர்கள் அல்லது வழங்கினீர்கள்?";
    if (
      /measurable impact|Now add measurable|Give me one concrete metric/i.test(
        text,
      )
    )
      return "உதாரணம் தெளிவாக உள்ளது. இப்போது அளவிடக்கூடிய தாக்கத்தைச் சொல்லுங்கள் — நேரம், தரம், வாடிக்கையாளர் திருப்தி, செலவு அல்லது முடிவில் என்ன மாறியது?";
  }

  // ── Languages added to complete full coverage ───────────────────────────────

  if (language.code === "ja-JP") {
    if (/^Yes, I can hear you/i.test(text))
      return "はい、はっきり聞こえます。では始めましょう。あなたの経歴と、なぜこのポジションに関心があるのかを簡単にお聞かせください。";
    if (/I'm following you, but I need more detail/i.test(text))
      return "お話はわかりますが、適合性を評価するためにもう少し詳細が必要です。具体的な状況、あなたが個人として何をしたか、その後何が変わったかを教えてください。";
    if (/The answer still sounds team-level/i.test(text))
      return "その回答はまだチームレベルに聞こえます。あなたが個人として決定・構築・解決・提供したものは何ですか？";
    if (
      /measurable impact|Now add measurable|Give me one concrete metric/i.test(
        text,
      )
    )
      return "ストーリーは明確です。次に測定可能な成果を教えてください。あなたの取り組みの後に何が変わりましたか？";
    if (/I need to pause there/i.test(text))
      return "少し確認させてください。それはご経歴から明確に確認できない点があります。公式な職歴なのか、フリーランス、ボランティア、転用可能な経験、それとも例として挙げたシナリオなのかを教えていただけますか？";
  }

  if (language.code === "ko-KR") {
    if (/^Yes, I can hear you/i.test(text))
      return "네, 잘 들립니다. 시작해 보겠습니다. 본인의 배경과 이 포지션에 관심을 갖게 된 이유를 간략히 말씀해 주시겠어요?";
    if (/I'm following you, but I need more detail/i.test(text))
      return "이해는 되지만, 적합성을 평가하기 위해 좀 더 구체적인 내용이 필요합니다. 구체적인 상황, 본인이 직접 한 일, 그리고 그 이후 무엇이 달라졌는지 말씀해 주세요.";
    if (/The answer still sounds team-level/i.test(text))
      return "답변이 아직 팀 수준으로 들립니다. 본인이 직접 결정하거나, 구축하거나, 해결하거나, 전달한 것이 무엇인지 말씀해 주세요.";
    if (
      /measurable impact|Now add measurable|Give me one concrete metric/i.test(
        text,
      )
    )
      return "이야기는 명확합니다. 이제 측정 가능한 성과를 알려 주세요. 본인의 업무 이후 무엇이 변화했나요?";
    if (/I need to pause there/i.test(text))
      return "잠깐 확인이 필요합니다. 해당 내용을 이력서에서 명확히 확인하기 어렵습니다. 공식 경력인지, 프리랜서, 자원봉사, 전이 가능한 경험인지, 아니면 예시 시나리오인지 설명해 주시겠어요?";
  }

  if (language.code === "ru-RU") {
    if (/^Yes, I can hear you/i.test(text))
      return "Да, я вас хорошо слышу. Давайте начнём. Расскажите кратко о своём опыте и о том, почему вас интересует эта позиция.";
    if (/I'm following you, but I need more detail/i.test(text))
      return "Я понимаю вас, но для оценки соответствия мне нужно больше деталей. Приведите конкретную ситуацию: что именно вы сделали лично и что изменилось после этого.";
    if (/The answer still sounds team-level/i.test(text))
      return "Ответ всё ещё звучит на уровне команды. Что конкретно вы лично решили, создали, решили или реализовали?";
    if (
      /measurable impact|Now add measurable|Give me one concrete metric/i.test(
        text,
      )
    )
      return "История понятна. Теперь добавьте измеримый результат. Что изменилось после вашей работы — время, качество, удовлетворённость клиентов, стоимость или бизнес-показатель?";
    if (/I need to pause there/i.test(text))
      return "Мне нужно уточнить. Это утверждение я не могу чётко подтвердить по вашему резюме. Поясните: это было официальное трудоустройство, фриланс, волонтёрство, переносимый опыт или просто пример?";
  }

  if (language.code === "tr-TR") {
    if (/^Yes, I can hear you/i.test(text))
      return "Evet, sizi net duyuyorum. Başlayalım. Deneyiminizi ve bu pozisyona neden ilgi duyduğunuzu kısaca anlatır mısınız?";
    if (/I'm following you, but I need more detail/i.test(text))
      return "Sizi anlıyorum, ancak uyumu değerlendirmek için daha fazla ayrıntıya ihtiyacım var. Somut bir durum, kişisel olarak ne yaptığınız ve ardından ne değiştiği hakkında bilgi verir misiniz?";
    if (/The answer still sounds team-level/i.test(text))
      return "Yanıt hâlâ ekip düzeyinde geliyor. Kişisel olarak neye karar verdiniz, ne inşa ettiniz, ne çözdünüz veya ne teslim ettiniz?";
    if (
      /measurable impact|Now add measurable|Give me one concrete metric/i.test(
        text,
      )
    )
      return "Hikâye net. Şimdi ölçülebilir bir etki ekleyin. Çalışmanızdan sonra ne değişti — zaman, kalite, müşteri memnuniyeti, maliyet veya bir iş sonucu?";
    if (/I need to pause there/i.test(text))
      return "Burada durmam gerekiyor. Bunu CV'nizden net olarak doğrulayamıyorum. Bunun resmi istihdam, serbest çalışma, gönüllülük, aktarılabilir deneyim mi yoksa yalnızca bir örnek senaryo mu olduğunu açıklar mısınız?";
  }

  if (language.code === "zh-CN") {
    if (/I need to pause there/i.test(text))
      return "我需要在这里确认一下。我无法从您的简历中清楚地核实这一点。请说明这是正式工作经历、自由职业、志愿者经验、可迁移经验，还是仅仅是一个示例场景？";
    if (/Give me one concrete metric/i.test(text))
      return "故事很清晰。现在请加上可量化的影响——节省的时间、减少的错误、客户满意度、成本或业务成果。";
  }

  if (language.code === "ar-SA") {
    if (/I'm following you, but I need more detail/i.test(text))
      return "أتابعك، لكنني أحتاج إلى مزيد من التفاصيل لتقييم المطابقة. أعطني موقفًا محددًا — ما الذي فعلته شخصيًا وما الذي تغير بعد ذلك.";
    if (/The answer still sounds team-level/i.test(text))
      return "الإجابة لا تزال تبدو على مستوى الفريق. ماذا قررت أو بنيت أو حللت أو قدمت بشكل شخصي؟";
    if (/measurable impact|Give me one concrete metric/i.test(text))
      return "القصة واضحة. الآن أضف تأثيرًا قابلًا للقياس — وقت موفر، أخطاء مخففة، رضا العملاء، تكلفة أو نتيجة أعمال.";
    if (/I need to pause there/i.test(text))
      return "أحتاج إلى التوقف هنا. لا يمكنني التحقق من ذلك بوضوح من سيرتك الذاتية. هل يمكنك توضيح ما إذا كان هذا توظيفًا رسميًا أم عملًا حرًا أم تطوعًا أم خبرة قابلة للنقل أم مجرد سيناريو مثال؟";
  }

  if (language.code === "pl-PL") {
    if (/I'm following you, but I need more detail/i.test(text))
      return "Rozumiem cię, ale potrzebuję więcej szczegółów, aby ocenić dopasowanie. Podaj konkretną sytuację — co ty osobiście zrobiłeś i co się po tym zmieniło.";
    if (/The answer still sounds team-level/i.test(text))
      return "Odpowiedź nadal brzmi jak praca zespołowa. Co ty osobiście zdecydowałeś, zbudowałeś, rozwiązałeś lub dostarczyłeś?";
    if (/measurable impact|Give me one concrete metric/i.test(text))
      return "Historia jest jasna. Teraz dodaj mierzalny wpływ — zaoszczędzony czas, zmniejszone błędy, satysfakcja klientów, koszt lub wynik biznesowy.";
    if (/I need to pause there/i.test(text))
      return "Muszę się tu zatrzymać. Nie mogę tego wyraźnie zweryfikować na podstawie twojego CV. Czy możesz wyjaśnić, czy to było oficjalne zatrudnienie, praca freelancerska, wolontariat, przenoszalne doświadczenie, czy tylko przykładowy scenariusz?";
  }
  return text;
}

function buildRecruiterReply(
  answer: string,
  questionIndex: number,
  setup: InterviewSetup,
  memory: RecruiterMemoryState = defaultRecruiterMemory,
) {
  const lower = answer.toLowerCase();
  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;

  const earlyReply = earlyInterviewReply(answer, questionIndex, setup);
  if (earlyReply) return earlyReply;

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

  if (
    /\b(can you hear me|do you hear me|hello|hi|how are you)\b/i.test(lower) &&
    wordCount <= 10
  ) {
    return "Yes, I can hear you. Let’s begin properly. Give me a short overview of your background and why this role is relevant for you.";
  }

  if (
    /\b(can you hear me|do you hear me|hello|hi|how are you)\b/i.test(lower) &&
    wordCount <= 10
  ) {
    return "Yes, I can hear you. Let’s begin properly. Give me a short overview of your background and why this role is relevant for you.";
  }

  const dynamicQuestions = getRecruiterQuestions(setup);
  const intelligenceV2 = buildWorkZoRecruiterReplyV2({
    answer,
    currentQuestion:
      dynamicQuestions[
        Math.min(questionIndex, dynamicQuestions.length - 1)
      ] || "",
    setup,
    memory,
    currentTrust: memory.trustTimeline.at(-1)?.trust,
  });

  if (intelligenceV2.shouldOverride) {
    return intelligenceV2.spokenReply;
  }

  const runtimeMemory =
    typeof window !== "undefined"
      ? (
          window as unknown as {
            __workzoDisruptionMemory?: WorkZoDisruptionMemory;
          }
        ).__workzoDisruptionMemory || createWorkZoDisruptionMemory()
      : createWorkZoDisruptionMemory();
  const disruption = analyzeWorkZoActiveDisruption({
    answer,
    setup: setup as unknown as Record<string, unknown>,
    memory: runtimeMemory,
    questionIndex,
  });
  if (typeof window !== "undefined") {
    (
      window as unknown as { __workzoDisruptionMemory?: WorkZoDisruptionMemory }
    ).__workzoDisruptionMemory = updateWorkZoDisruptionMemory(
      runtimeMemory,
      answer,
    );
  }
  if (disruption.shouldDisrupt) {
    return disruption.line;
  }

  if (wordCount < 12) {
    return "I’m following you, but I need more detail before I can judge the fit. Give me one specific situation, what you personally did, and what changed after that.";
  }

  if (
    !/\b(i|my|me|personally|owned|built|handled|created|led|resolved|analyzed|improved|reduced|increased)\b/i.test(
      answer,
    )
  ) {
    return "The answer still sounds team-level. What exactly did you personally own or do? Give me your action, not just the team result.";
  }

  if (
    !/\d|percent|customers?|tickets?|hours?|days?|saved|reduced|increased|improved|revenue|cost|time|quality|sla|csat|nps/i.test(
      answer,
    )
  ) {
    return "That gives me the story. What was the visible outcome — customer satisfaction, fewer escalations, faster resolution, better quality, or a clearer handover?";
  }

  if (
    !/\b(result|impact|outcome|after|so|therefore|which led|improved|reduced|increased|saved)\b/i.test(
      answer,
    )
  ) {
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
  return (
    /\b(tesla|google|microsoft|amazon|meta|apple|salesforce|sap|oracle|accenture|bearingpoint)\b/i.test(
      answer,
    ) ||
    /\b(1|2|3|4|5|6|7|8|9|10|11|12|13|14|15)\s*\+?\s*(years?|yrs?)\b/i.test(
      answer,
    )
  );
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

  return {
    wordCount,
    metric,
    ownership,
    outcome,
    admission,
    unsupported,
    short,
    long,
    vague,
    delta,
    concern,
  };
}

function updateRecruiterSignalState(
  previous: RecruiterSignalState,
  answer: string,
  setup?: InterviewSetup,
): RecruiterSignalState {
  const signal = analyzeAnswerSignals(answer, setup);
  const trustDelta = signal.admission
    ? -12
    : signal.unsupported
      ? -20
      : signal.metric && signal.ownership
        ? 4
        : signal.short || signal.vague
          ? -4
          : 1;
  const interestDelta = signal.unsupported
    ? -12
    : signal.metric && signal.outcome
      ? 5
      : signal.short || signal.vague
        ? -5
        : signal.ownership
          ? 2
          : -1;

  const trust = scoreClamp(previous.trust + trustDelta);
  const interest = scoreClamp(previous.interest + interestDelta);
  const clarity = scoreClamp(
    previous.clarity +
      (signal.vague || signal.short ? -5 : signal.wordCount > 30 ? 3 : 0),
  );
  const confidence = scoreClamp(
    previous.confidence + (signal.ownership ? 3 : -2),
  );
  const relevance = scoreClamp(
    previous.relevance +
      (signal.metric || signal.outcome ? 2 : signal.short ? -2 : 0),
  );
  const communication = scoreClamp(
    previous.communication + (signal.outcome ? 3 : signal.vague ? -3 : 1),
  );
  const overall = scoreClamp(
    (trust + interest + clarity + confidence + relevance + communication) / 6,
  );

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

function detectCompanyInterviewStyle(
  setup: InterviewSetup,
): CompanyInterviewStyle {
  const text =
    `${setup.targetCompany || ""} ${setup.jobDescription || ""} ${setup.targetRole || ""}`.toLowerCase();

  if (
    /\b(startup|founder|seed|series a|series b|fast-paced|0 to 1|ownership|early stage)\b/i.test(
      text,
    )
  ) {
    return "Startup";
  }

  if (
    /\b(big tech|scale|distributed systems|millions|large-scale|platform|faang|google|amazon|microsoft|meta|apple)\b/i.test(
      text,
    )
  ) {
    return "Big Tech";
  }

  if (
    /\b(consulting|consultant|client-facing|stakeholder|strategy|transformation|advisory|project delivery)\b/i.test(
      text,
    )
  ) {
    return "Consulting";
  }

  if (
    /\b(corporate|enterprise|process|compliance|governance|cross-functional|matrix|structured)\b/i.test(
      text,
    )
  ) {
    return "Corporate";
  }

  return "Global realistic interview";
}

function recruiterPersonalityInstructions(setup: InterviewSetup) {
  const key =
    `${setup.recruiterId} ${setup.recruiterName} ${setup.recruiterTitle}`.toLowerCase();

  if (key.includes("alex") || key.includes("faang")) {
    return "Act like Alex Chen: a FAANG hiring manager. Probe technical depth, exact trade-offs, metrics, assumptions, decision quality, and structured reasoning. Stay calm, analytical, and demanding.";
  }

  if (key.includes("zoe") || key.includes("startup_founder")) {
    return "Act like Zoe Park: a startup founder. Move fast, challenge buzzwords, probe radical ownership, failures, speed, and what the candidate would do at 10x scale.";
  }

  if (key.includes("james") || key.includes("consulting")) {
    return "Act like James Harrington: a consulting partner. Force structure, situation, stakes, options, recommendation, stakeholder impact, and concise executive communication.";
  }

  if (
    key.includes("marcus") ||
    key.includes("noah") ||
    key.includes("sales_director")
  ) {
    return "Act like Noah Jones: a sales director. Push for revenue impact, quota, deal size, conversion, pipeline, customer impact, and exact commercial numbers.";
  }

  if (key.includes("aisha") || key.includes("product_leader")) {
    return "Act like Aisha Patel: a product leader. Probe user evidence, prioritisation, what was not built, product judgment, cross-functional influence, and measurable product impact.";
  }

  if (key.includes("victoria") || key.includes("executive")) {
    return "Act like Victoria Stern: an executive recruiter. Ask senior-level strategic questions, evaluate leadership narrative, communication maturity, self-awareness, and board-ready clarity.";
  }

  if (key.includes("david") || key.includes("enterprise")) {
    return "Act like David Kimura: an enterprise recruiter. Probe governance, process, stakeholder management, escalation paths, risk, and structured cross-functional examples.";
  }

  if (key.includes("daniel") || key.includes("analytical")) {
    return "Act like Daniel: analytical hiring manager. Probe metrics, decision-making, ownership, tradeoffs, and exact reasoning. Be calm but skeptical when answers lack proof.";
  }

  if (key.includes("priya") || key.includes("startup")) {
    return "Act like Priya: startup recruiter. Probe ownership, speed, ambiguity, initiative, customer impact, and whether the candidate can operate without perfect structure.";
  }

  if (
    key.includes("markus") ||
    key.includes("corporate") ||
    key.includes("german")
  ) {
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

  if (
    raw.includes("german") ||
    raw.includes("deutsch") ||
    raw === "de" ||
    raw === "de-de"
  ) {
    return {
      code: "de-DE",
      label: "German",
      instruction:
        "Conduct the entire interview in German. Use professional, natural German throughout — questions, follow-ups, and feedback.",
    };
  }
  if (
    raw.includes("dutch") ||
    raw.includes("nederlands") ||
    raw === "nl" ||
    raw === "nl-nl"
  ) {
    return {
      code: "nl-NL",
      label: "Dutch",
      instruction:
        "Conduct the entire interview in Dutch. Use professional, natural Dutch throughout.",
    };
  }
  if (
    raw.includes("french") ||
    raw.includes("français") ||
    raw.includes("francais") ||
    raw === "fr" ||
    raw === "fr-fr"
  ) {
    return {
      code: "fr-FR",
      label: "French",
      instruction:
        "Conduct the entire interview in French. Use professional, natural French throughout.",
    };
  }
  if (
    raw.includes("spanish") ||
    raw.includes("español") ||
    raw.includes("espanol") ||
    raw === "es" ||
    raw === "es-es"
  ) {
    return {
      code: "es-ES",
      label: "Spanish",
      instruction:
        "Conduct the entire interview in Spanish. Use professional, natural Spanish throughout.",
    };
  }
  if (
    raw.includes("italian") ||
    raw.includes("italiano") ||
    raw === "it" ||
    raw === "it-it"
  ) {
    return {
      code: "it-IT",
      label: "Italian",
      instruction:
        "Conduct the entire interview in Italian. Use professional, natural Italian throughout.",
    };
  }
  if (
    raw.includes("portuguese") ||
    raw.includes("portugu") ||
    raw === "pt" ||
    raw === "pt-pt" ||
    raw === "pt-br"
  ) {
    return {
      code: "pt-PT",
      label: "Portuguese",
      instruction:
        "Conduct the entire interview in Portuguese. Use professional, natural Portuguese throughout.",
    };
  }
  if (
    raw.includes("chinese") ||
    raw.includes("mandarin") ||
    raw.includes("zh") ||
    raw.includes("中文")
  ) {
    return {
      code: "zh-CN",
      label: "Chinese",
      instruction:
        "Conduct the entire interview in Mandarin Chinese (普通话). Use professional, natural Chinese throughout.",
    };
  }
  if (
    raw.includes("arabic") ||
    raw.includes("عربية") ||
    raw === "ar" ||
    raw === "ar-sa"
  ) {
    return {
      code: "ar-SA",
      label: "Arabic",
      instruction:
        "Conduct the entire interview in Arabic. Use professional, natural Arabic throughout.",
    };
  }
  if (
    raw.includes("polish") ||
    raw.includes("polski") ||
    raw === "pl" ||
    raw === "pl-pl"
  ) {
    return {
      code: "pl-PL",
      label: "Polish",
      instruction:
        "Conduct the entire interview in Polish. Use professional, natural Polish throughout.",
    };
  }
  if (raw.includes("japanese") || raw === "ja" || raw === "ja-jp") {
    return {
      code: "ja-JP",
      label: "Japanese",
      instruction:
        "Conduct the entire interview in Japanese. Use professional, natural Japanese (keigo where appropriate) throughout.",
    };
  }
  if (raw.includes("korean") || raw === "ko" || raw === "ko-kr") {
    return {
      code: "ko-KR",
      label: "Korean",
      instruction:
        "Conduct the entire interview in Korean. Use professional, natural Korean throughout.",
    };
  }
  if (
    raw.includes("russian") ||
    raw.includes("русский") ||
    raw === "ru" ||
    raw === "ru-ru"
  ) {
    return {
      code: "ru-RU",
      label: "Russian",
      instruction:
        "Conduct the entire interview in Russian. Use professional, natural Russian throughout.",
    };
  }
  if (
    raw.includes("turkish") ||
    raw.includes("türkçe") ||
    raw === "tr" ||
    raw === "tr-tr"
  ) {
    return {
      code: "tr-TR",
      label: "Turkish",
      instruction:
        "Conduct the entire interview in Turkish. Use professional, natural Turkish throughout.",
    };
  }
  if (raw.includes("hindi") || raw === "hi" || raw === "hi-in") {
    return {
      code: "hi-IN",
      label: "Hindi",
      instruction:
        "Conduct the entire interview in Hindi using natural, professional Hindi. Do not answer in English unless the candidate explicitly asks for English.",
    };
  }
  if (raw.includes("tamil") || raw === "ta" || raw === "ta-in") {
    return {
      code: "ta-IN",
      label: "Tamil",
      instruction:
        "Conduct the entire interview in Tamil using natural, professional Tamil. Do not answer in English unless the candidate explicitly asks for English.",
    };
  }
  if (raw.includes("auto")) {
    return {
      code: "en-US",
      label: "Auto",
      instruction:
        "Use the candidate's selected or detected language. If unsure, default to English.",
    };
  }
  return {
    code: "en-US",
    label: "English",
    instruction: "Conduct the interview in English.",
  };
}

function getSpeechRecognitionLang(setup: InterviewSetup) {
  return normalizeInterviewLanguage(setup.language).code;
}

function getSpeechSynthesisLang(setup: InterviewSetup) {
  return normalizeInterviewLanguage(setup.language).code;
}

function getFallbackVoiceForLanguage(
  voices: SpeechSynthesisVoice[],
  setup: InterviewSetup,
) {
  const language = normalizeInterviewLanguage(setup.language);
  const wantsMale = recruiterLooksMale(setup);
  const languageVoices = voices.filter((voice) =>
    voice.lang
      ?.toLowerCase()
      .startsWith(language.code.split("-")[0].toLowerCase()),
  );

  const preferredPool = languageVoices.length ? languageVoices : voices;
  const femaleNames =
    /aria|jenny|samantha|zira|susan|victoria|karen|moira|tessa|female|helena|hortense|lucie|paulina|sabina/i;
  const maleNames =
    /david|mark|guy|george|daniel|alex|fred|tom|male|thomas|paul|jorge|luciano/i;

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

function localizedUnsupportedClaimChallenge(setup: InterviewSetup) {
  const language = normalizeInterviewLanguage(setup.language);
  switch (language.code) {
    case "de-DE":
      return "Ich muss kurz unterbrechen. Ich kann das in deinem CV nicht klar verifizieren. Kannst du erklären, ob das offizielle Berufserfahrung, freiberufliche Arbeit, freiwillige Erfahrung, übertragbare Erfahrung oder nur ein Beispielszenario war?";
    case "fr-FR":
      return "Je dois m’arrêter un instant. Je ne peux pas vérifier cela clairement dans votre CV. Pouvez-vous préciser s’il s’agissait d’un emploi officiel, d’un travail freelance, d’une expérience bénévole, d’une expérience transférable ou simplement d’un exemple ?";
    case "es-ES":
      return "Necesito detenerme un momento. No puedo verificar eso claramente en tu CV. ¿Puedes aclarar si fue empleo oficial, trabajo freelance, experiencia voluntaria, experiencia transferible o solo un ejemplo?";
    case "nl-NL":
      return "Ik moet je daar even onderbreken. Ik kan dat niet duidelijk verifiëren in je cv. Kun je uitleggen of dit officiële werkervaring, freelancewerk, vrijwilligerservaring, overdraagbare ervaring of alleen een voorbeeldscenario was?";
    default:
      return "I need to pause there. I cannot verify that from your CV. Can you clarify whether this was official employment, freelance work, volunteer experience, transferable experience, or just an example scenario?";
  }
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
  return buildLocalizedGreeting(setup);
}

function buildContextQualityNotice(setup: InterviewSetup) {
  const hasCv = Boolean(safeText(setup.cvText));
  const hasJd = Boolean(safeText(setup.jobDescription));

  if (hasCv && hasJd)
    return "CV and job description are available. Use both as verified context.";
  if (hasCv)
    return "CV context is available, but the job description is missing or incomplete. Ask role-relevant follow-ups, but do not invent JD requirements.";
  if (hasJd)
    return "Job description is available, but CV context is missing or incomplete. Ask the candidate to verify their background before assuming experience.";
  return "CV and job description context are missing or incomplete. Keep the interview useful, but clearly ask the candidate to provide missing context when needed.";
}

function uniqueLimited(values: string[], limit = 8) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  ).slice(0, limit);
}

function extractCapitalizedPhrases(text: string) {
  const matches =
    text.match(
      /\b[A-Z][A-Za-z0-9&.+#'/-]*(?:\s+[A-Z][A-Za-z0-9&.+#'/-]*){0,4}\b/g,
    ) || [];
  return uniqueLimited(
    matches.filter(
      (item) =>
        item.length >= 3 &&
        !/^(The|And|For|From|With|This|That|WorkZo|AI|CV|JD|Resume)$/i.test(
          item,
        ),
    ),
    10,
  );
}

// ── CV credibility scan ──────────────────────────────────────────────────────
// Generic, structure-based checks against the parsed resumeProfile (not the
// candidate's spoken answers). These produce short factual flags the
// recruiter can naturally weave into follow-up questions, e.g. overlapping
// jobs, duplicate degrees, or a CV that doesn't show the seniority the JD
// asks for. Works for any CV — no hardcoded company/person names.

const MONTH_NAMES: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

type DateRange = { start: number; end: number; label: string };

/**
 * parseDateRange — turns a free-text "dates" field (e.g. "Jan 2020 - Present",
 * "2018-2020", "Mar 2018 – Jul 2022", "10/2015 - 06/2018") into a numeric
 * [start, end] range in "months since year 0" for easy overlap comparison.
 * Returns null if no recognizable year is found.
 */
function parseDateRange(value: string): DateRange | null {
  const text = safeText(value);
  if (!text) return null;

  const lower = text.toLowerCase();
  const now = new Date();
  const nowMonths = now.getFullYear() * 12 + now.getMonth();

  // Find all "Month Year" or "MM/YYYY" or bare "YYYY" tokens in order.
  const tokenRe =
    /\b(?:(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)[a-z]*\.?\s*)?(\d{1,2}\/)?(\d{4})\b/gi;
  const points: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(lower))) {
    const monthName = match[1];
    const monthNum = match[2];
    const year = Number(match[3]);
    if (!Number.isFinite(year) || year < 1950 || year > now.getFullYear() + 1)
      continue;

    let month = 0;
    if (monthName && MONTH_NAMES[monthName] !== undefined)
      month = MONTH_NAMES[monthName];
    else if (monthNum)
      month = Math.max(0, Math.min(11, Number(monthNum.replace("/", "")) - 1));

    points.push(year * 12 + month);
  }

  if (!points.length) return null;

  const isPresent = /\b(present|current|heute|now|aktuell|ongoing)\b/i.test(
    lower,
  );
  const start = Math.min(...points);
  const end = isPresent
    ? nowMonths
    : points.length > 1
      ? Math.max(...points)
      : start;

  return { start, end: Math.max(start, end), label: text };
}

function formatMonthIndex(months: number) {
  const year = Math.floor(months / 12);
  const month = ((months % 12) + 12) % 12;
  const monthLabel = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ][month];
  return `${monthLabel} ${year}`;
}

type CvCredibilityFlag = {
  topic: string;
  note: string;
};

/**
 * extractCvCredibilityFlags — static, structure-based scan of the parsed
 * resumeProfile for things worth probing in an interview:
 *  - Two or more jobs/education entries with significantly overlapping date
 *    ranges (could be legitimate part-time/concurrent roles, but worth
 *    asking about).
 *  - Duplicate-looking degree entries (same degree title appearing more than
 *    once, e.g. copy-paste errors or two simultaneous full-time master's
 *    programs).
 *  - A large gap between the candidate's most senior CV title and the
 *    seniority implied by the job description (e.g. CV shows only "Intern"
 *    / "Assistant" titles but the JD is for a "Manager"/"Lead"/"Senior" role).
 *
 * Each flag is a short, factual note — never an accusation — so the
 * recruiter persona can turn it into a natural, curious follow-up question.
 */
function extractCvCredibilityFlags(setup: InterviewSetup): CvCredibilityFlag[] {
  const profile = setup.resumeProfile;
  const flags: CvCredibilityFlag[] = [];
  if (!profile || typeof profile !== "object") return flags;

  // ── Overlapping experience entries ────────────────────────────────────────
  const experience = Array.isArray(profile.experience)
    ? profile.experience
    : [];
  const expRanges = experience
    .map((job) => ({
      label: [job.title, job.company].filter(Boolean).join(" at ") || "a role",
      range: parseDateRange(job.dates || ""),
    }))
    .filter((item) => item.range);

  for (let i = 0; i < expRanges.length; i += 1) {
    for (let j = i + 1; j < expRanges.length; j += 1) {
      const a = expRanges[i].range!;
      const b = expRanges[j].range!;
      const overlapStart = Math.max(a.start, b.start);
      const overlapEnd = Math.min(a.end, b.end);
      const overlapMonths = overlapEnd - overlapStart;

      // Ignore trivial 1-month overlaps from rounding (e.g. "Dec 2019" /
      // "Jan 2020" boundary entries) — only flag overlaps of 3+ months,
      // which suggest genuinely concurrent roles.
      if (overlapMonths >= 3) {
        flags.push({
          topic: "cv_overlapping_dates",
          note: `The CV shows "${expRanges[i].label}" (${expRanges[i].range!.label}) and "${expRanges[j].label}" (${expRanges[j].range!.label}) overlapping for about ${overlapMonths} months.`,
        });
      }
    }
  }

  // ── Duplicate-looking education entries ───────────────────────────────────
  const education = Array.isArray(profile.education) ? profile.education : [];
  const eduRanges = education
    .map((edu) => ({
      degree: safeText(edu.degree),
      institution: safeText(edu.institution),
      range: parseDateRange(edu.dates || ""),
    }))
    .filter((item) => item.degree);

  const seenDegrees = new Map<
    string,
    { institution: string; range: DateRange | null }
  >();
  for (const item of eduRanges) {
    const key = item.degree
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    if (!key) continue;

    const existing = seenDegrees.get(key);
    if (existing) {
      const sameInstitution =
        existing.institution.toLowerCase() === item.institution.toLowerCase();
      const overlaps =
        existing.range && item.range
          ? Math.min(existing.range.end, item.range.end) -
              Math.max(existing.range.start, item.range.start) >=
            0
          : false;

      if (!sameInstitution && overlaps) {
        flags.push({
          topic: "cv_duplicate_degree",
          note: `The CV lists "${item.degree}" twice, at "${existing.institution}" and "${item.institution}", with overlapping dates.`,
        });
      }
    } else {
      seenDegrees.set(key, {
        institution: item.institution,
        range: item.range,
      });
    }
  }

  // ── Seniority gap vs. job description ─────────────────────────────────────
  const jd = safeText(setup.jobDescription).toLowerCase();
  if (jd) {
    const SENIOR_JD_RE =
      /\b(senior|lead|principal|head of|manager|director|staff)\b/i;
    const jdWantsSenior = SENIOR_JD_RE.test(jd);

    const titles = experience.map((job) => safeText(job.title)).filter(Boolean);
    const cvHasSeniorTitle = titles.some((title) => SENIOR_JD_RE.test(title));
    const cvOnlyJuniorTitles =
      titles.length > 0 &&
      titles.every(
        (title) =>
          /\b(intern|junior|trainee|assistant|graduate|working student|entry[- ]level)\b/i.test(
            title,
          ) || !SENIOR_JD_RE.test(title),
      );

    if (
      jdWantsSenior &&
      !cvHasSeniorTitle &&
      cvOnlyJuniorTitles &&
      titles.length
    ) {
      flags.push({
        topic: "cv_seniority_gap",
        note: `The job description suggests a senior/lead-level role, but the CV's titles (${titles.slice(0, 3).join(", ")}) read as junior or individual-contributor level.`,
      });
    }
  }

  return flags.slice(0, 6);
}

function extractCvFactMemory(setup: InterviewSetup) {
  const cv = safeText(setup.cvText);
  const evidence = normalizedEvidenceText(setup);

  // Prefer reading companies and roles directly from the structured resumeProfile.
  // extractCompanyClaims() uses regex that requires a preposition ("at|with|for|in Company")
  // but the structured CV text uses bullet format "- Title • Company • Dates" which has
  // no preposition. This caused employer names to be missed or incorrectly normalised,
  // making the model falsely challenge valid company claims.
  const profile = setup.resumeProfile as
    | Record<string, unknown>
    | null
    | undefined;
  const profileExperience = Array.isArray(
    (profile as Record<string, unknown> | null)?.experience,
  )
    ? ((profile as Record<string, unknown>).experience as Array<
        Record<string, unknown>
      >)
    : [];

  const profileCompanies = profileExperience
    .map((exp) => safeText(exp.company))
    .filter((c) => c.length >= 2);
  const profileRoles = profileExperience
    .map((exp) => safeText(exp.title))
    .filter((r) => r.length >= 2);
  const profileSkills = Array.isArray(
    (profile as Record<string, unknown> | null)?.skills,
  )
    ? ((profile as Record<string, unknown>).skills as string[])
        .map((item) => safeText(item))
        .filter((s) => s.length >= 2)
    : [];

  // Fall back to regex extraction only when no structured profile is available
  const companies = uniqueLimited(
    profileCompanies.length ? profileCompanies : extractCompanyClaims(cv),
    10,
  );
  const roles = uniqueLimited(
    profileRoles.length ? profileRoles : extractRoleClaims(cv),
    10,
  );

  const namedPhrases = extractCapitalizedPhrases(cv)
    .filter(
      (item) =>
        !companies.some((c) => c.toLowerCase() === item.toLowerCase()) &&
        !roles.some((r) => r.toLowerCase() === item.toLowerCase()),
    )
    .slice(0, 8);
  const years = Array.from(
    new Set(
      (cv.match(/\b\d{1,2}\s*\+?\s*(?:years?|yrs?)\b/gi) || []).map((item) =>
        item.trim(),
      ),
    ),
  ).slice(0, 6);
  const metrics = extractMetricSnippets(cv).slice(0, 8);
  const skills = uniqueLimited(
    profileSkills.length
      ? profileSkills.slice(0, 14)
      : [
          "sql",
          "python",
          "excel",
          "power bi",
          "tableau",
          "crm",
          "salesforce",
          "zendesk",
          "freshdesk",
          "jira",
          "customer support",
          "technical support",
          "data analysis",
          "stakeholder management",
          "project management",
          "api",
          "saas",
        ].filter((skill) => evidence.includes(skill)),
    14,
  );

  return {
    companies,
    roles,
    namedPhrases,
    years,
    metrics,
    skills,
    hasCv: Boolean(cv),
  };
}

function extractJdFactMemory(setup: InterviewSetup) {
  const jd = safeText(setup.jobDescription);
  const lower = jd.toLowerCase();
  const requiredSignals = uniqueLimited(
    [
      "communication",
      "stakeholder",
      "customer",
      "sales",
      "support",
      "crm",
      "sql",
      "python",
      "excel",
      "analytics",
      "reporting",
      "leadership",
      "ownership",
      "collaboration",
      "problem solving",
      "project management",
      "agile",
      "api",
      "saas",
      "documentation",
      "english",
      "german",
      "dutch",
    ].filter((skill) => lower.includes(skill)),
    14,
  );
  const responsibilities = uniqueLimited(
    jd
      .split(/[\n.;]/)
      .map((line) => line.trim())
      .filter((line) => line.length >= 24 && line.length <= 150)
      .filter((line) =>
        /responsib|manage|support|analy|build|create|lead|communicat|collaborat|improv|deliver|customer|stakeholder/i.test(
          line,
        ),
      ),
    6,
  );

  return { requiredSignals, responsibilities, hasJd: Boolean(jd) };
}

function buildFactualMemoryBrief(setup: InterviewSetup) {
  const cvFacts = extractCvFactMemory(setup);
  const jdFacts = extractJdFactMemory(setup);
  const credibilityFlags = extractCvCredibilityFlags(setup);

  return [
    verifiedResumeFactBlock(setup),
    buildContextQualityNotice(setup),
    cvFacts.companies.length
      ? `CV companies: ${cvFacts.companies.join(", ")}.`
      : "CV companies: none clearly extracted.",
    cvFacts.roles.length
      ? `CV roles: ${cvFacts.roles.join(", ")}.`
      : "CV roles: none clearly extracted.",
    cvFacts.skills.length
      ? `CV skills/signals: ${cvFacts.skills.join(", ")}.`
      : "CV skills/signals: none clearly extracted.",
    cvFacts.metrics.length
      ? `CV metrics/results: ${cvFacts.metrics.join(", ")}.`
      : "CV metrics/results: none clearly extracted.",
    jdFacts.requiredSignals.length
      ? `JD requirements/signals: ${jdFacts.requiredSignals.join(", ")}.`
      : "JD requirements/signals: none clearly extracted.",
    jdFacts.responsibilities.length
      ? `JD responsibilities: ${jdFacts.responsibilities.slice(0, 3).join(" | ")}.`
      : "JD responsibilities: none clearly extracted.",
    ...(credibilityFlags.length
      ? [
          "Possible CV inconsistencies worth a curious, non-accusatory follow-up (verify before judging):",
          ...credibilityFlags.map((flag) => `- ${flag.note}`),
        ]
      : []),
  ].join("\n");
}

function buildCredibilityFollowUp(
  setup: InterviewSetup,
  memory: RecruiterMemoryState,
) {
  const flags = extractCvCredibilityFlags(setup);
  const flag = flags.find(
    (item) =>
      !wasTopicCovered(
        memory,
        `${item.topic}_${normalizeClaimText(item.note)}`,
      ),
  );
  if (!flag) return "";

  if (flag.topic === "cv_overlapping_dates") {
    return `I noticed your CV shows two roles with overlapping dates. ${flag.note} Can you walk me through how that worked — were these concurrent, or is one of the dates a typo?`;
  }

  if (flag.topic === "cv_duplicate_degree") {
    return `Quick clarification on your education: ${flag.note} Could you explain how these two relate — was one a transfer, an exchange program, or something else?`;
  }

  if (flag.topic === "cv_seniority_gap") {
    return `${flag.note} Tell me about a time you took on responsibilities beyond your formal title — that would help me understand your readiness for this level.`;
  }

  return "";
}

function detectCredibilityTopic(
  setup: InterviewSetup,
  memory: RecruiterMemoryState,
) {
  const flags = extractCvCredibilityFlags(setup);
  const flag = flags.find(
    (item) =>
      !wasTopicCovered(
        memory,
        `${item.topic}_${normalizeClaimText(item.note)}`,
      ),
  );
  return flag ? `${flag.topic}_${normalizeClaimText(flag.note)}` : "";
}

function buildFactAwareFollowUp(
  setup: InterviewSetup,
  memory: RecruiterMemoryState,
) {
  const credibilityFollowUp = buildCredibilityFollowUp(setup, memory);
  if (credibilityFollowUp) return credibilityFollowUp;

  const cvFacts = extractCvFactMemory(setup);
  const jdFacts = extractJdFactMemory(setup);
  const company = cvFacts.companies.find(
    (item) =>
      !wasTopicCovered(memory, `cv_company_${normalizeClaimText(item)}`),
  );
  const skill = jdFacts.requiredSignals.find(
    (item) => !wasTopicCovered(memory, `jd_skill_${normalizeClaimText(item)}`),
  );
  const role = cvFacts.roles.find(
    (item) => !wasTopicCovered(memory, `cv_role_${normalizeClaimText(item)}`),
  );

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

function detectNextFactTopic(
  setup: InterviewSetup,
  memory: RecruiterMemoryState,
) {
  const cvFacts = extractCvFactMemory(setup);
  const jdFacts = extractJdFactMemory(setup);
  const company = cvFacts.companies.find(
    (item) =>
      !wasTopicCovered(memory, `cv_company_${normalizeClaimText(item)}`),
  );
  if (company) return `cv_company_${normalizeClaimText(company)}`;
  const skill = jdFacts.requiredSignals.find(
    (item) => !wasTopicCovered(memory, `jd_skill_${normalizeClaimText(item)}`),
  );
  if (skill) return `jd_skill_${normalizeClaimText(skill)}`;
  const role = cvFacts.roles.find(
    (item) => !wasTopicCovered(memory, `cv_role_${normalizeClaimText(item)}`),
  );
  if (role) return `cv_role_${normalizeClaimText(role)}`;
  return "";
}

function detectAnswerTopics(answer: string) {
  const topics = new Set<string>();
  const lower = answer.toLowerCase();

  if (
    /\b(router|range extender|upsell|cross sell|sell|sold|sales|conversion|customer buy|purchase)\b/i.test(
      lower,
    )
  )
    topics.add("sales_conversion");
  if (
    /\b(objection|hesitant|not willing|scam|trust|convince|rapport|worried|force)\b/i.test(
      lower,
    )
  )
    topics.add("objection_handling");
  if (
    /\b(crm|ticket|pipeline|follow up|tracking|previous technician|pending|organized)\b/i.test(
      lower,
    )
  )
    topics.add("crm_tracking");
  if (/\b(python|sql|script|query|database|service desk)\b/i.test(lower))
    topics.add("technical_learning");
  if (/\b(priority|critical|deadline|multiple|manage|queue|sla)\b/i.test(lower))
    topics.add("prioritization");
  if (
    /\b(customer handling|rapport|patient|step by step|not tech savvy|satisfied|support)\b/i.test(
      lower,
    )
  )
    topics.add("customer_handling");
  if (hasMetricSignal(answer)) topics.add("metrics");
  if (hasOwnershipSignal(answer)) topics.add("ownership");
  if (hasOutcomeSignal(answer)) topics.add("outcome");

  return Array.from(topics);
}

function extractMetricSnippets(answer: string) {
  const matches = answer.match(
    /\b(?:\d+\s*(?:out of|\/)\s*\d+|\d+\s*%|\d+\s*(?:customers?|routers?|tickets?|months?|years?)|twice|once|every\s+\w+)\b/gi,
  );
  return matches ? matches.slice(0, 4) : [];
}

function detectStrengthSnippets(answer: string) {
  const strengths: string[] = [];

  if (
    /\b(customer handling|rapport|convincing|patient|step by step)\b/i.test(
      answer,
    )
  ) {
    strengths.push("customer handling");
  }

  if (/\b(quick learner|learned|python|sql|new tool)\b/i.test(answer)) {
    strengths.push("quick learner");
  }

  if (/\b(sold|conversion|router|range extender|buy)\b/i.test(answer)) {
    strengths.push("sales conversion");
  }

  if (/\b(priority|critical|manage multiple|deadline)\b/i.test(answer)) {
    strengths.push("prioritization");
  }

  return strengths;
}

function rememberAskedTopic(
  memory: RecruiterMemoryState,
  topic: string,
): RecruiterMemoryState {
  if (memory.askedTopics.includes(topic)) return memory;
  return {
    ...memory,
    askedTopics: [...memory.askedTopics, topic].slice(-14),
  };
}

function wasTopicCovered(memory: RecruiterMemoryState, topic: string) {
  return (
    memory.askedTopics.includes(topic) || memory.answeredTopics.includes(topic)
  );
}

function buildClosingChallenge(
  setup: InterviewSetup,
  memory: RecruiterMemoryState,
) {
  const strengths = memory.strengthsMentioned.length
    ? memory.strengthsMentioned.slice(0, 2).join(" and ")
    : "your strongest relevant experience";

  return `Before we wrap up, I want one final answer from you. Why should we choose you for this ${setup.targetRole} role over another candidate — using ${strengths} and one specific result? After that, do you have any questions for me about the role or next steps?`;
}

function cleanRecruiterFinalText(text: string, setup: InterviewSetup) {
  const firstName = safeFirstName(setup.candidateName);

  return (
    cleanVisibleTranscriptText(text)
      .replace(/\bMichel,?\s*/gi, "")
      .replace(/\bthe first few time,?\s*/gi, "")
      // Hard-block the old robotic metric prompt if any legacy assistant still emits it.
      .replace(
        /Give me one concrete metric or proof point:\s*time saved, tickets reduced, customer impact, quality improvement, revenue, cost, or before-and-after result\.?/gi,
        "That gives me some useful context. Let me go one level deeper: what did you personally decide or change, and what happened after that?",
      )
      .replace(
        /\bwe'll be in touch soon.*$/i,
        `we'll be in touch soon. Have a great day, ${firstName}.`,
      )
      .replace(
        /\bthanks for your time.*$/i,
        `Thank you for your time, ${firstName}. We'll be in touch soon. Have a great day.`,
      )
      .trim()
  );
}

function updateRecruiterMemoryState(
  previous: RecruiterMemoryState,
  answer: string,
  setup: InterviewSetup,
  signal: RecruiterSignalState,
): RecruiterMemoryState {
  const analysis = analyzeAnswerSignals(answer, setup);
  const unsupportedReason = extractUnsupportedClaimReason(answer, setup);

  const vagueAnswers =
    previous.vagueAnswers + (analysis.vague || analysis.short ? 1 : 0);
  const missingMetrics = previous.missingMetrics + (!analysis.metric ? 1 : 0);
  const missingOwnership =
    previous.missingOwnership + (!analysis.ownership ? 1 : 0);
  const unsupportedClaims =
    previous.unsupportedClaims + (unsupportedReason ? 1 : 0);
  const strongAnswers =
    previous.strongAnswers +
    (analysis.metric && analysis.ownership && analysis.outcome ? 1 : 0);

  const patterns = new Set(previous.patterns);
  const answeredTopics = new Set(previous.answeredTopics);
  detectAnswerTopics(answer).forEach((topic) => answeredTopics.add(topic));

  const metricsMentioned = Array.from(
    new Set([...previous.metricsMentioned, ...extractMetricSnippets(answer)]),
  ).slice(-10);

  const strengthsMentioned = Array.from(
    new Set([
      ...previous.strengthsMentioned,
      ...detectStrengthSnippets(answer),
    ]),
  ).slice(-8);

  if (vagueAnswers >= 2)
    patterns.add("Candidate has given multiple vague or short answers.");
  if (missingMetrics >= 2)
    patterns.add("Candidate repeatedly avoids measurable impact.");
  if (missingOwnership >= 2)
    patterns.add("Personal ownership is not consistently clear.");
  if (unsupportedClaims >= 1)
    patterns.add(
      "Unsupported claim detected; recruiter trust should recover only with verified details.",
    );
  if (strongAnswers >= 2)
    patterns.add(
      "Candidate is starting to provide stronger evidence-based answers.",
    );

  let liveNote = signal.concern;
  if (unsupportedReason) liveNote = unsupportedReason;
  else if (missingMetrics >= 2)
    liveNote = "Pattern detected: metrics are missing across answers.";
  else if (missingOwnership >= 2)
    liveNote = "Pattern detected: personal ownership needs to be clearer.";
  else if (vagueAnswers >= 2)
    liveNote = "Pattern detected: answers are still too broad.";
  else if (strongAnswers >= 2)
    liveNote =
      "Positive pattern: stronger evidence and ownership are emerging.";

  const nextQuestionCount = previous.askedTopics.length;
  const needsClosingChallenge =
    nextQuestionCount >= 10 && !previous.closingAsked;
  // readyForResults gates the end-of-interview transition.
  // A raw question count alone is not enough — the recruiter must have
  // issued a closing invitation ("do you have any questions") AND the
  // candidate must have replied. The count-only fallback is raised to 20
  // so a natural conversation is never cut short mid-exchange.
  const readyForResults =
    (previous.closingAsked && nextQuestionCount >= 8) ||
    nextQuestionCount >= 20 ||
    previous.readyForResults;

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
    // Mark closingAsked once the recruiter has actually issued the closing
    // invitation. This gates readyForResults so the interview only ends
    // after the candidate has had a chance to ask their own questions.
    closingAsked: previous.closingAsked || needsClosingChallenge,
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
  const earlyReply = earlyInterviewReply(answer, questionIndex, setup);
  if (earlyReply) return earlyReply;

  const unsupported = extractUnsupportedClaimReason(answer, setup);
  if (unsupported) {
    return buildUnsupportedClaimChallenge(answer, setup);
  }

  const intelligenceV2 = buildWorkZoRecruiterReplyV2({
    answer,
    currentQuestion:
      getRecruiterQuestions(setup)[
        Math.min(questionIndex, getRecruiterQuestions(setup).length - 1)
      ] || "",
    setup,
    memory,
    currentTrust: memory.trustTimeline.at(-1)?.trust,
  });

  if (intelligenceV2.shouldOverride) {
    return intelligenceV2.spokenReply;
  }

  const style = detectCompanyInterviewStyle(setup);
  const analysis = analyzeAnswerSignals(answer, setup);

  if (questionIndex >= 11 && !memory.closingAsked) {
    return buildClosingChallenge(setup, memory);
  }

  if (
    memory.unsupportedClaims > 0 &&
    !analysis.metric &&
    !wasTopicCovered(memory, "trust_recovery")
  ) {
    return memory.unsupportedClaims > 1
      ? "I still don't have a verified example. Tell me about one specific situation from your CV, what you did, and what changed as a result."
      : "I need to rebuild confidence here. Give me one verified example from your CV, with a specific result or measurable outcome.";
  }

  if (
    memory.missingMetrics >= 2 &&
    !wasTopicCovered(memory, "metrics_recovery")
  ) {
    return memory.missingMetrics > 3
      ? "Let's try a different angle — pick any task you did regularly. Roughly how often, how long, or by how much did it change something?"
      : "You’ve given useful context. Do you have any rough scale for it — volume handled, response time, customer rating, tickets, or frequency? A rough number is enough.";
  }

  if (
    memory.missingOwnership >= 2 &&
    !wasTopicCovered(memory, "ownership_recovery")
  ) {
    return memory.missingOwnership > 3
      ? "Tell me about a moment where you, specifically, made a call or took an action without being told to. What was it?"
      : "I still need clearer ownership. In that example, what did you personally decide, build, fix, lead, or deliver?";
  }

  if (
    memory.vagueAnswers >= 2 &&
    !wasTopicCovered(memory, "specificity_recovery")
  ) {
    return memory.vagueAnswers > 3
      ? "Pick just one moment — a single conversation, ticket, or task. What happened, step by step?"
      : "Let me stop you there and make this specific. Give me one real situation, one action you personally took, and one result.";
  }

  const topicPlan = [
    {
      topic: "sales_conversion",
      question:
        "You mentioned sales-related work. Walk me through one conversion from customer issue to product recommendation, step by step.",
    },
    {
      topic: "objection_handling",
      question:
        "Now let's move to objection handling. Tell me about a customer who hesitated to buy and how you handled that conversation.",
    },
    {
      topic: "crm_tracking",
      question:
        "In sales, follow-up discipline matters. How have you tracked customers, tickets, or follow-ups in a system, even if it was not a formal sales CRM?",
    },
    {
      topic: "prioritization",
      question:
        "Sales roles involve multiple leads and urgent follow-ups. How do you prioritize when several customers or tasks need attention at once?",
    },
    {
      topic: "technical_learning",
      question:
        "You mentioned learning tools quickly. Give one example of a tool or technical skill you learned fast and how it helped your work.",
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

function buildInterviewVerdict(
  score: RecruiterSignalState | null,
  memory: RecruiterMemoryState,
) {
  if (!score) {
    return {
      decision: "Not enough signal",
      reason: "The interview ended before enough answers were evaluated.",
    };
  }

  if (memory.unsupportedClaims > 0 && score.trust < 62) {
    return {
      decision: "Would not proceed yet",
      reason:
        "Unsupported or inconsistent claims reduced recruiter trust. Candidate should clarify verified experience.",
    };
  }

  if (score.overall >= 78 && memory.strongAnswers >= 2) {
    return {
      decision: "Would proceed",
      reason:
        "Candidate gave enough evidence, ownership, and role-relevant examples to continue.",
    };
  }

  if (score.overall >= 65) {
    return {
      decision: "Maybe / needs another round",
      reason:
        "Candidate shows potential, but the recruiter still needs stronger proof, metrics, or clearer ownership.",
    };
  }

  return {
    decision: "Would not proceed yet",
    reason:
      "Answers need more structure, evidence, measurable impact, and verified details.",
  };
}

function findWeakestInterviewMoment(
  transcript: TranscriptItem[],
  memory: RecruiterMemoryState,
) {
  const candidateAnswers = transcript.filter(
    (item) => item.role === "candidate",
  );

  if (!candidateAnswers.length) {
    return {
      answer: "",
      problem: "No candidate answer was captured.",
      advice:
        "Run a complete interview to receive a meaningful weakest-answer review.",
    };
  }

  const weakest =
    candidateAnswers.find((item) =>
      /tesla|google|microsoft|amazon|meta|apple|fake|lied|not true|fifteen|15 years/i.test(
        item.text,
      ),
    ) ||
    candidateAnswers.find((item) => item.text.split(/\s+/).length < 18) ||
    candidateAnswers.find((item) => !hasMetricSignal(item.text)) ||
    candidateAnswers[0];

  let problem = "This answer needs more evidence.";
  if (extractUnsupportedClaimReason(weakest.text, setupRefSafeFallback()))
    problem = "This answer contains a claim that may not be verified.";
  else if (weakest.text.split(/\s+/).length < 18)
    problem = "This answer is too short to judge.";
  else if (!hasMetricSignal(weakest.text))
    problem = "This answer lacks measurable impact.";

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
    candidateName: "",
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

function removeRepeatedSpeechChunks(value: string) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";

  // Vapi/STT sometimes returns the same final utterance twice:
  // "I'm good how are you I'm good how are you".
  // Remove exact repeated halves without changing normal answers.
  const words = cleaned.split(" ").filter(Boolean);
  if (words.length >= 6 && words.length % 2 === 0) {
    const half = words.length / 2;
    const first = words.slice(0, half).join(" ").toLowerCase();
    const second = words.slice(half).join(" ").toLowerCase();
    if (first === second) return words.slice(0, half).join(" ");
  }

  // Remove repeated short phrase at the end, but only when the repeated phrase
  // is long enough to be accidental duplication, not natural emphasis.
  for (
    let size = Math.min(14, Math.floor(words.length / 2));
    size >= 4;
    size -= 1
  ) {
    const tail = words.slice(-size).join(" ").toLowerCase();
    const beforeTail = words
      .slice(-size * 2, -size)
      .join(" ")
      .toLowerCase();
    if (tail && tail === beforeTail) {
      return words.slice(0, -size).join(" ").trim();
    }
  }

  return cleaned;
}

function cleanVisibleTranscriptText(text: string) {
  return (
    removeRepeatedSpeechChunks(text)
      .replace(/\s+/g, " ")
      .replace(/\bhigh\s+/i, "Hi ")
      // Founder-specific STT corrections removed — do not add personal names here
      .replace(/\bHi,?\s+surrender\b/gi, "Hi there")
      .replace(/\bsurrender\b/gi, "there")
      .replace(/\s+([,.!?])/g, "$1")
      .trim()
  );
}

function countFillerWords(text: string): number {
  const fillerPattern =
    /\b(um+|uh+|er+|hmm+|like[,\s]|you know[,\s]|basically[,\s]|literally[,\s]|sort of[,\s]|kind of[,\s])\b/gi;
  return (text.match(fillerPattern) || []).length;
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
  msSincePreviousRecruiterMessage?: number,
  hasHadCandidateTurnSinceLastRecruiter?: boolean,
) {
  if (!previous) return false;
  if (previous.role !== next.role) return false;
  if (previous.speaker !== next.speaker) return false;
  if (next.role === "system") return false;
  if (next.role === "candidate") return true;

  // Recruiter-to-recruiter: only merge if this is a rapid streaming fragment
  // from the SAME reply (Vapi chunking), AND no candidate turn happened between
  // the two recruiter messages. If a candidate spoke, these are definitionally
  // two separate exchanges and must never merge — confirmed from live testing
  // where the greeting merged with the follow-up question after the candidate's
  // "Hi, how are you?" because both arrived within 4 seconds.
  if (hasHadCandidateTurnSinceLastRecruiter) return false;

  const RAPID_FRAGMENT_WINDOW_MS = 4000;
  if (
    next.role === "recruiter" &&
    typeof msSincePreviousRecruiterMessage === "number" &&
    msSincePreviousRecruiterMessage <= RAPID_FRAGMENT_WINDOW_MS
  ) {
    return true;
  }

  return false;
}

function safeFirstName(name: string) {
  const cleaned = safeText(name, "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.split(" ")[0] || "";
}

function safeGreetingName(name: string) {
  const firstName = safeFirstName(name);
  if (!firstName) return "there";
  // Global guard: never greet with auth visibility labels, CV section headers,
  // job titles, technologies, skills, or extracted project/company words.
  if (
    /^(public|private|candidate|user|there|unknown|anonymous|guest|resume|cv|profile|summary|contact|skills?|experience|education|projects?|languages?|surrender|data|science|technical|business|customer|senior|junior|lead|head|chief|intern|graduate|bootcamp|school|university|college|institute|marketing|finance|product|digital|growth|success|manager|engineer|analyst|specialist|consultant|developer|coordinator|director|assistant|associate|officer|partner|talent|recruiter|hiring|support|tools?|programming|python|sql|javascript|typescript|java|cloud|gcp|aws|azure|machine|learning|tableau|matplotlib|seaborn|tensorflow|sklearn|langchain|api|nlp|rag|system|integration)$/i.test(
      firstName,
    )
  )
    return "there";
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ' .-]{2,24}$/.test(firstName)) return "there";
  return firstName;
}

function safePromptCandidateName(name: string) {
  const greeting = safeGreetingName(name);
  return greeting === "there" ? "there" : greeting;
}

function isProgressWorthyRecruiterTurn(text: string) {
  const cleaned = cleanVisibleTranscriptText(text).toLowerCase();
  if (!cleaned) return false;

  // Do not count greetings or small-talk as interview progress.
  if (
    /\b(how are you|good morning|good afternoon|good evening|hello|hi[, ]|let'?s begin)\b/i.test(
      cleaned,
    ) &&
    cleaned.length < 120
  ) {
    return false;
  }

  return (
    /\?$/.test(cleaned) ||
    /\b(tell me|walk me through|give me|describe|explain|what|why|how|can you|could you|share an example|specific example|measurable impact|hardest part|improve if)\b/i.test(
      cleaned,
    )
  );
}

function getWorkZoLiveCopilotInsight(input: {
  status: string;
  transcriptCount: number;
  questionIndex: number;
  currentQuestion: string;
  interimText: string;
  recruiterConcern?: string;
  recruiterMood?: string;
  trust?: number;
  interest?: number;
}) {
  const answer = input.interimText.trim();
  const lower = answer.toLowerCase();
  const wordCount = answer.split(/\s+/).filter(Boolean).length;
  const hasMetric =
    /\d|%|percent|customers?|tickets?|hours?|days?|weeks?|months?|saved|reduced|increased|improved|revenue|cost|time|quality|sla|csat|nps/i.test(
      answer,
    );
  const hasOwnership =
    /\b(i|my|me|personally|owned|built|handled|created|led|resolved|analyzed|analysed|improved|reduced|increased|implemented|designed|managed|coordinated|delivered)\b/i.test(
      answer,
    );
  const hasOutcome =
    /\b(result|impact|outcome|after|therefore|which led|so that|improved|reduced|increased|saved|achieved|delivered|helped|enabled)\b/i.test(
      answer,
    );
  const tooGeneric =
    /\b(things|stuff|many|some|good|nice|various|etc|responsible for|worked on)\b/i.test(
      lower,
    );

  if (input.status === "idle" || input.status === "ended") {
    return {
      headline: "Before you start",
      sayNext:
        "Keep each answer simple: situation, your action, proof, result.",
      recruiterConcern:
        "The recruiter will look for ownership, evidence, and role relevance.",
      liveTip:
        "Use one real example from your CV instead of a generic summary.",
      tone: "neutral",
    };
  }

  if (input.status === "recruiter-speaking") {
    return {
      headline: "Listen for the hidden test",
      sayNext:
        "Identify what the recruiter is really testing before answering.",
      recruiterConcern:
        input.currentQuestion ||
        "The recruiter is setting up the next evaluation point.",
      liveTip: "Prepare a 45-60 second answer with one measurable proof point.",
      tone: "listening",
    };
  }

  if (input.status === "listening") {
    if (!answer) {
      return {
        headline: "Answer structure",
        sayNext:
          "Start with: “In my previous role, I handled…” then give one specific example.",
        recruiterConcern:
          input.recruiterConcern ||
          "Waiting for evidence, ownership, and clear relevance.",
        liveTip: "Avoid starting too broad. Give one real situation first.",
        tone: "ready",
      };
    }

    if (wordCount < 18) {
      return {
        headline: "Too short",
        sayNext:
          "Add one specific situation, your personal action, and what changed after it.",
        recruiterConcern: "The recruiter cannot judge fit from a short answer.",
        liveTip: "Extend this answer with one concrete detail from your CV.",
        tone: "warning",
      };
    }

    if (!hasOwnership) {
      return {
        headline: "Ownership unclear",
        sayNext: "Use “I” and explain exactly what you personally did.",
        recruiterConcern:
          "The answer sounds team-level instead of candidate-level.",
        liveTip:
          "Replace “we worked on” with “I handled / I built / I resolved…”.",
        tone: "warning",
      };
    }

    if (!hasMetric) {
      return {
        headline: "Missing proof",
        sayNext:
          "Add a number: tickets, users, time saved, quality improvement, SLA, revenue, or before/after result.",
        recruiterConcern:
          "The recruiter may not trust the impact without evidence.",
        liveTip: "Even an approximate metric is better than no proof.",
        tone: "warning",
      };
    }

    if (!hasOutcome) {
      return {
        headline: "Outcome missing",
        sayNext:
          "Finish with the result: what improved, who benefited, and how you know it worked.",
        recruiterConcern:
          "The answer explains activity but not business impact.",
        liveTip: "Close the answer with one clear result sentence.",
        tone: "warning",
      };
    }

    if (tooGeneric) {
      return {
        headline: "Make it sharper",
        sayNext:
          "Replace vague words with one exact task, tool, customer issue, or result.",
        recruiterConcern: "The answer may sound rehearsed or generic.",
        liveTip: "Use a named project, system, process, or measurable outcome.",
        tone: "warning",
      };
    }

    return {
      headline: "Strong answer forming",
      sayNext: "Now close confidently with the result and what you learned.",
      recruiterConcern:
        "The recruiter is likely checking depth and consistency.",
      liveTip: "Do not keep adding details. Finish with a clear outcome.",
      tone: "positive",
    };
  }

  return {
    headline: "Processing answer",
    sayNext:
      "Get ready for the follow-up — prepare a specific, evidence-based response.",
    recruiterConcern:
      input.recruiterConcern || "The recruiter is evaluating your last answer.",
    liveTip: "Think of one metric or outcome you can add to your next answer.",
    tone: "neutral",
  };
}

export default function InterviewPage() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const marker = "__workzoConsoleNoiseFilterInstalled";
    const scopedWindow = window as unknown as Window & {
      [key: string]: unknown;
    };

    if (scopedWindow[marker]) return;
    scopedWindow[marker] = true;

    const originalError = console.error;

    console.error = (...args: unknown[]) => {
      const message = args
        .map((item) => {
          if (typeof item === "string") return item;
          if (item instanceof Error) return item.message;
          try {
            return JSON.stringify(item);
          } catch {
            return "";
          }
        })
        .join(" ");

      // Suppress all Krisp/Daily noise-cancellation runtime messages.
      // These are emitted by the Daily.js WebRTC layer and are not actionable
      // — they indicate transient CPU load or processor lifecycle events, not
      // bugs in WorkZo code. Matching case-insensitively on "krisp" catches
      // all variants: "Error unloading krisp processor", "Krisp error: system
      // overload", "WASM_OR_WORKER_NOT_READY", etc.
      const harmlessKrispNoise =
        /krisp/i.test(message) ||
        message.includes("WASM_OR_WORKER_NOT_READY") ||
        message.includes("daily-js version") ||
        /processor.*not.*ready/i.test(message);

      const harmlessMeetingEnded =
        /meeting ended/i.test(message) ||
        /meeting has ended/i.test(message) ||
        /due to ejection/i.test(message);

      if (harmlessKrispNoise || harmlessMeetingEnded) return;

      originalError(...args);
    };

    return () => {
      console.error = originalError;
      scopedWindow[marker] = false;
    };
  }, []);
  const [setupLoaded, setSetupLoaded] = useState(false);

  const [upgradeModalFeature, setUpgradeModalFeature] = useState<string>("");
  const upgradeModalOpen = Boolean(upgradeModalFeature);
  const [setup, setSetup] = useState<InterviewSetup>({
    candidateName: "",
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
  const [premiumVoiceStatus, setPremiumVoiceStatus] =
    useState<PremiumVoiceStatus>("idle");
  const [premiumVoiceError, setPremiumVoiceError] = useState("");
  const [recruiterSignal, setRecruiterSignal] = useState<RecruiterSignalState>(
    defaultRecruiterSignal,
  );
  const [recruiterMemory, setRecruiterMemory] = useState<RecruiterMemoryState>(
    defaultRecruiterMemory,
  );
  const [scoreFlash, setScoreFlash] = useState<"up" | "down" | null>(null);
  const [scoreReady, setScoreReady] = useState(false);
  const scoreItems = useMemo(
    () => [
      {
        label: "Confidence",
        value: scoreReady ? `${recruiterSignal.confidence}/100` : "Pending",
        icon: ShieldCheck,
        tone: "emerald",
      },
      {
        label: "Clarity",
        value: scoreReady ? `${recruiterSignal.clarity}/100` : "Pending",
        icon: Sparkles,
        tone: "blue",
      },
      {
        label: "Relevance",
        value: scoreReady ? `${recruiterSignal.relevance}/100` : "Pending",
        icon: Star,
        tone: "violet",
      },
      {
        label: "Communication",
        value: scoreReady ? `${recruiterSignal.communication}/100` : "Pending",
        icon: User,
        tone: "orange",
      },
    ],
    [recruiterSignal, scoreReady],
  );
  const [questionIndex, setQuestionIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [interimText, setInterimText] = useState("");
  const [transcript, setTranscript] =
    useState<TranscriptItem[]>(initialTranscript);
  const liveCopilotInsight = useMemo(
    () =>
      getWorkZoLiveCopilotInsight({
        status,
        transcriptCount: transcript.length,
        questionIndex,
        currentQuestion:
          recruiterQuestionsFallback[
            Math.min(questionIndex, recruiterQuestionsFallback.length - 1)
          ] || "",
        interimText,
        recruiterConcern: recruiterSignal.concern,
        recruiterMood: recruiterSignal.mood,
        trust: recruiterSignal.trust,
        interest: recruiterSignal.interest,
      }),
    [status, transcript.length, questionIndex, interimText, recruiterSignal],
  );

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [serverPlan, setServerPlan] = useState<
    "free" | "premium" | "premium_pro"
  >("free");
  const [planLoading, setPlanLoading] = useState(true);
  // Technical mode — premium/premium_pro only
  const [technicalMode, setTechnicalMode] = useState(false);
  const [codeSnapshot, setCodeSnapshot] = useState("");
  const [codeLanguage, setCodeLanguage] = useState("python");
  const codeSnapshotRef = useRef("");
  const codeLanguageRef = useRef("python");
  // First-time user hint — shown after the recruiter's opening line, dismissed permanently
  const [showFirstTimeHint, setShowFirstTimeHint] = useState(false);
  const interviewSessionIdRef = useRef<string>(`workzo-session-${Date.now()}`);
  const [moreOpen, setMoreOpen] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showCopilot, setShowCopilot] = useState(true);
  const [waitingRoomActive, setWaitingRoomActive] = useState(false);
  const [waitingRoomStep, setWaitingRoomStep] = useState(0);
  const waitingRoomSteps = useMemo(
    () =>
      buildWorkZoWaitingRoomSteps(setup as unknown as Record<string, unknown>),
    [setup],
  );
  const simulationPersona = useMemo(
    () =>
      getWorkZoSimulationPersona(setup as unknown as Record<string, unknown>),
    [setup],
  );
  const [autoScrollTranscript, setAutoScrollTranscript] = useState(true);
  const [interviewStyle, setInterviewStyle] = useState<
    "Supportive" | "Realistic" | "Challenging" | "Brutal"
  >("Realistic");
  const [voiceSpeed, setVoiceSpeed] = useState(0.84);
  const [copilotAggressiveness, setCopilotAggressiveness] = useState<
    "Low" | "Medium" | "High"
  >("Medium");
  const [recoverySnapshot, setRecoverySnapshot] =
    useState<WorkZoInterviewSnapshot | null>(null);
  // Orphaned engines now wired
  const [emotionalMemory, setEmotionalMemory] = useState<WorkZoEmotionalMemory>(
    createWorkZoEmotionalMemory(),
  );
  const [recruiterVisualState, setRecruiterVisualState] =
    useState<WorkZoRecruiterVisualState>("waiting");
  const [fillerWordCount, setFillerWordCount] = useState(0);
  const [shareableMoment, setShareableMoment] = useState<{
    title: string;
    text: string;
    category: string;
  } | null>(null);
  const emotionalMemoryRef = useRef<WorkZoEmotionalMemory>(
    createWorkZoEmotionalMemory(),
  );
  const [recoveryNoticeDismissed, setRecoveryNoticeDismissed] = useState(false);
  const [recoveredSessionReady, setRecoveredSessionReady] = useState(false);
  const [premiumUnlocked, setPremiumUnlocked] = useState(false);
  // Live reaction text shown in copilot panel
  const [liveReactionText, setLiveReactionText] = useState("");
  // Filler word running count for current answer
  const [fillerCount, setFillerCount] = useState(0);
  // Company simulation mode
  const [companyMode, setCompanyMode] = useState<
    "global" | "google" | "mckinsey" | "startup" | "corporate"
  >("global");

  useEffect(() => {
    setPremiumUnlocked(isWorkZoPremiumUnlocked(serverPlan));
  }, [serverPlan]);

  useEffect(() => {
    // Show first-time hint if never dismissed
    if (typeof window !== "undefined") {
      const dismissed = localStorage.getItem("workzo_interview_hint_dismissed");
      if (!dismissed) setShowFirstTimeHint(true);
    }

    let active = true;
    fetchWorkZoAuthoritativePlan()
      .then((resolved) => {
        if (!active) return;
        setServerPlan(resolved.plan);
      })
      .catch(() => active && setServerPlan("free"))
      .finally(() => active && setPlanLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const handlePremiumGateClick = useCallback(
    (feature: string) => {
      trackWorkZoInterviewEvent("premium_gate_clicked", {
        feature,
        role: setup.targetRole,
        recruiter: setup.recruiterName,
      });
    },
    [setup.recruiterName, setup.targetRole],
  );

  const applyRecruiterFromSettings = useCallback(
    (recruiterId: string) => {
      const profile =
        recruiterProfiles[recruiterId] || recruiterProfiles.friendly_hr;

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
        premium:
          recruiterId === "startup_recruiter" ||
          recruiterId === "german_corporate",
      });
    },
    [setup.targetRole],
  );

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const listeningRef = useRef(false);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const answerBufferRef = useRef("");
  const questionIndexRef = useRef(0);
  const stopRequestedRef = useRef(false);
  const startListeningRef = useRef<(() => void | Promise<void>) | null>(null);

  // Stops the recruiter speaking immediately — called by the interrupt button.
  // Important: this callback is declared before startListening, so it must call
  // startListening through a ref. Adding startListening directly to this
  // dependency array causes a runtime TDZ error:
  // "Cannot access 'startListening' before initialization".
  const stopRecruiterSpeaking = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    if (typeof window !== "undefined") {
      try {
        window.speechSynthesis?.cancel();
      } catch {}
    }
    if (status === "recruiter-speaking") {
      setStatus("listening");
      window.setTimeout(() => {
        startListeningRef.current?.();
      }, 150);
    }
  }, [status]);
  const setupRef = useRef(setup);
  const recruiterMemoryRef = useRef(defaultRecruiterMemory);
  const transcriptRef = useRef<TranscriptItem[]>([]);
  const recruiterSignalRef = useRef(defaultRecruiterSignal);
  const scoreReadyRef = useRef(false);
  const elapsedRef = useRef(0);
  const recoverySnapshotRef = useRef<WorkZoInterviewSnapshot | null>(null);
  const recoveredSessionRef = useRef<WorkZoInterviewSnapshot | null>(null);
  const premiumVoiceEnabledRef = useRef(premiumVoiceEnabled);
  const audioEnabledRef = useRef(audioEnabled);
  const vapiClientRef = useRef<WorkZoVapiClient | null>(null);
  // Stores the currently playing TTS Audio element so the user can interrupt
  // the recruiter mid-speech by tapping the new stop button.
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  // V2 recruiter memory — persists competency tracker, concern resolution,
  // topic progression, and JD gaps across every turn of the interview.
  const recruiterMemoryV2Ref = useRef<unknown>(null);
  const vapiConnectedRef = useRef(false);
  const vapiStartingRef = useRef(false);
  const vapiFallbackStartedRef = useRef(false);
  // True only while WorkZo itself is intentionally stopping a Vapi/Daily call.
  // Daily emits an "ejected / Meeting has ended" error during a normal stop;
  // without this guard that harmless event was logged as a real Vapi failure
  // and could start the browser fallback even though WorkZo caused the stop.
  const vapiIntentionalStopRef = useRef(false);
  const vapiTimeoutRef = useRef<number | null>(null);
  const vapiFinalUserTextRef = useRef("");
  const vapiQuestionSignatureRef = useRef("");
  const lastInterimTextRef = useRef("");
  const lastInterimUpdateAtRef = useRef(0);
  const lastAssistantTranscriptRef = useRef("");
  // Tracks when the last RECRUITER transcript entry was added (raw ms, not
  // the formatted display string). Used to merge same-speaker fragments
  // that arrive in quick succession with no candidate turn between them —
  // a real, observed pattern from live Vapi voice testing where one logical
  // reply gets split into several separate transcript events by Vapi's
  // streaming (e.g. "Could you clarify... One... Two... Three...", six
  // separate bubbles in under 30 seconds). This is NOT the same as the
  // earlier bug where two genuinely DIFFERENT, unrelated replies got glued
  // together with no separator — that fix (only merging candidate turns)
  // stays in place. This adds back a narrow, time-boxed exception:
  // recruiter-to-recruiter merging is now allowed, but ONLY within a few
  // seconds of the previous recruiter line, which is what actually
  // distinguishes "Vapi splitting one reply into chunks" from "two
  // unrelated replies that happened to land back to back."
  const lastRecruiterMessageAtRef = useRef(0);
  const lastUserTranscriptRef = useRef("");

  const hasStartedInterview = transcript.some(
    (item) => item.role === "recruiter",
  );
  const visibleTranscriptItems = getVisibleTranscriptItems(transcript).filter(
    (item) => !(item.role === "system" && item.id === "initial-ready"),
  );
  const transcriptMessageCount =
    visibleTranscriptItems.filter((item) => item.role !== "system").length +
    (interimText ? 1 : 0);
  const visibleQuestionNumber = hasStartedInterview
    ? Math.max(1, Math.min(questionIndex, 20))
    : 0;
  const progress = hasStartedInterview
    ? Math.round((visibleQuestionNumber / 20) * 100)
    : 0;
  const interviewComplete: boolean =
    visibleQuestionNumber >= 20 || recruiterMemory.readyForResults;
  const headerTitle = setup.targetCompany
    ? `${setup.targetRole} – ${setup.targetCompany}`
    : setup.targetRole;
  const recruiterImagePosition = recruiterObjectPosition(
    setup.recruiterId,
    setup.recruiterName,
  );
  const liveRecruiterThoughts = buildLiveRecruiterThoughts(
    recruiterSignal,
    recruiterMemory,
    scoreReady,
  );
  const recruiterStatus = recruiterStatusLabel(recruiterSignal, scoreReady);
  const hasRecoveredSessionReady =
    recoveredSessionReady &&
    transcript.some(
      (item) => item.role === "recruiter" || item.role === "candidate",
    );

  useEffect(() => {
    const nextSetup = buildSetupFromStorage();
    setSetup(nextSetup);
    setupRef.current = nextSetup;
    setSetupLoaded(true);

    // Map stored companyStyle into simulation mode for companySimulationEngine
    const storedStyle = String(
      (nextSetup as Record<string, unknown>).companyStyle || "",
    ).toLowerCase();
    if (storedStyle.includes("startup")) setCompanyMode("startup");
    else if (storedStyle.includes("corporate")) setCompanyMode("corporate");
    else if (
      storedStyle.includes("consulting") ||
      storedStyle.includes("big tech") ||
      storedStyle.includes("technical")
    )
      setCompanyMode("mckinsey");
    else setCompanyMode("global");

    trackWorkZoInterviewEvent("interview_room_viewed", {
      role: nextSetup.targetRole,
      recruiter: nextSetup.recruiterName,
      company: nextSetup.targetCompany || "",
    });

    const snapshot = readActiveInterviewSnapshot();
    if (snapshot) {
      setRecoverySnapshot(snapshot);
      recoverySnapshotRef.current = snapshot;
      trackWorkZoFailureEvent(
        "state_recovery_available",
        {
          role: snapshot.setup.targetRole,
          recruiter: snapshot.setup.recruiterName,
          transcriptItems: snapshot.transcript.length,
          questionIndex: snapshot.questionIndex,
        },
        "low",
      );
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
    const activeTranscript = transcript.filter(
      (item) => item.role === "recruiter" || item.role === "candidate",
    );
    const shouldPersist =
      status !== "idle" && status !== "ended" && activeTranscript.length > 0;

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
  }, [
    elapsed,
    questionIndex,
    recruiterMemory,
    recruiterSignal,
    scoreReady,
    setup,
    status,
    transcript,
  ]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      const activeTranscript = transcript.filter(
        (item) => item.role === "recruiter" || item.role === "candidate",
      );
      if (
        status === "idle" ||
        status === "ended" ||
        activeTranscript.length === 0
      )
        return;

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

      pushWorkZoLocalEvent(
        WORKZO_FAILURE_EVENTS_KEY,
        "page_refresh_during_interview",
        {
          role: setup.targetRole,
          recruiter: setup.recruiterName,
          transcriptItems: activeTranscript.length,
        },
        500,
      );
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [
    elapsed,
    questionIndex,
    recruiterMemory,
    recruiterSignal,
    scoreReady,
    setup,
    status,
    transcript,
  ]);

  useEffect(() => {
    if (status === "idle") return;

    const timer = window.setInterval(() => {
      setElapsed((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [status]);


  useEffect(() => {
    if (autoScrollTranscript)
      transcriptEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
  }, [transcript, interimText, autoScrollTranscript]);

  const persistInterviewSessionToDb = useCallback(
    async (statusValue: "active" | "completed" | "paused" = "active") => {
      const sessionId = interviewSessionIdRef.current;
      try {
        const response = await fetch("/api/db/interview-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            sessionId,
            setup: setupRef.current,
            status: statusValue === "completed" ? "completed" : "active",
            mode: serverPlan === "premium_pro" ? "pro" : "standard",
            questionIndex: questionIndexRef.current,
            elapsedSeconds: elapsedRef.current,
            trustScore: recruiterSignalRef.current.trust,
            interestScore: recruiterSignalRef.current.interest,
            recruiterMemory: recruiterMemoryRef.current,
            recoverySnapshot: recoverySnapshotRef.current || {},
            completedAt:
              statusValue === "completed" ? new Date().toISOString() : null,
          }),
        });
        if (response.status === 403) {
          const data = await response.json().catch(() => null);
          if (data?.error === "interview_limit_reached") {
            return {
              sessionId,
              blocked: true as const,
              used: data.used,
              limit: data.limit,
              plan: data.plan,
            };
          }
        }
      } catch {
        // Network failure shouldn't block the interview — the server-side
        // limit is a backstop, not the only line of defense (client-side
        // check still runs first). Fail open here, not closed.
      }
      return { sessionId, blocked: false as const };
    },
    [serverPlan],
  );

  const persistInterviewMessageToDb = useCallback(
    (item: Omit<TranscriptItem, "id" | "time">, messageIndex: number) => {
      if (item.role === "system") return;
      fetch("/api/db/interview-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sessionId: interviewSessionIdRef.current,
          role: item.role,
          speaker: item.speaker,
          text: item.text,
          messageIndex,
          metadata: { source: "interview_room" },
        }),
      }).catch(() => undefined);
    },
    [],
  );

  const persistInterviewResultToDb = useCallback(
    (session: Record<string, any>) => {
      fetch("/api/db/interview-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sessionId: interviewSessionIdRef.current,
          overallScore:
            session.score?.overall ?? session.summary?.trust ?? null,
          trustScore: session.score?.trust ?? null,
          evidenceQuality: session.answerQuality?.evidenceScore ?? null,
          contradictionRisk: session.memory?.unsupportedClaims ?? null,
          strengths: session.verdict?.strengths || [],
          improvements: session.verdict?.improvements || [],
          weakAnswers: session.weakestMoment ? [session.weakestMoment] : [],
          contradictions: session.memory?.patterns || [],
          evidenceRequests: session.answerQuality?.evidenceRequests || [],
          rawResult: session,
        }),
      }).catch(() => undefined);
    },
    [],
  );

  const addTranscript = useCallback(
    (item: Omit<TranscriptItem, "id" | "time">) => {
      const cleanedText = cleanVisibleTranscriptText(item.text);

      // Keep visible transcript clean. System connection messages should not appear here.
      if (item.role === "system") return;

      // Ignore short STT fragments like "Swinging" that AI voice may emit before final text.
      if (item.role === "candidate" && isTinyVisibleSpeechFragment(cleanedText))
        return;

      const cleanedItem = {
        ...item,
        text: cleanedText,
      };

      persistInterviewMessageToDb(cleanedItem, transcript.length);
      setTranscript((current) => {
        const previous = current[current.length - 1];
        const now = Date.now();
        const msSincePreviousRecruiterMessage =
          cleanedItem.role === "recruiter" && previous?.role === "recruiter"
            ? now - lastRecruiterMessageAtRef.current
            : undefined;

        if (cleanedItem.role === "recruiter") {
          lastRecruiterMessageAtRef.current = now;
        }

        // Check if a candidate turn happened between the previous recruiter
        // message and this one — if so, these are separate exchanges, never merge.
        const lastRecruiterIndex =
          cleanedItem.role === "recruiter"
            ? current.map((e) => e.role).lastIndexOf("recruiter")
            : -1;
        const hasCandidateSinceLastRecruiter =
          lastRecruiterIndex >= 0 &&
          current
            .slice(lastRecruiterIndex + 1)
            .some((e) => e.role === "candidate");

        if (
          shouldMergeVisibleTranscript(
            previous,
            cleanedItem,
            msSincePreviousRecruiterMessage,
            hasCandidateSinceLastRecruiter,
          )
        ) {
          return current.map((entry, index) =>
            index === current.length - 1
              ? {
                  ...entry,
                  text: cleanVisibleTranscriptText(
                    `${entry.text} ${cleanedItem.text}`,
                  ),
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
    },
    [persistInterviewMessageToDb, transcript.length],
  );

  const stopListening = useCallback(() => {
    listeningRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {}
  }, []);

  const getStableCandidateAnswer = useCallback(() => {
    const finalAnswer = answerBufferRef.current.trim();
    const visibleInterim = lastInterimTextRef.current.trim();

    // Chrome/Web Speech sometimes keeps short opening replies like
    // "I'm good, how are you?" as interim text and never promotes them to
    // isFinal before our silence timer stops recognition. Without this fallback
    // the interview stays active but never moves to the next recruiter turn.
    const merged = `${finalAnswer} ${visibleInterim}`
      .replace(/\s+/g, " ")
      .trim();

    return merged || finalAnswer || visibleInterim;
  }, []);

  const isValidOpeningOrSmallTalkAnswer = useCallback((value: string) => {
    const clean = value
      .toLowerCase()
      .replace(/[^a-zÀ-ÿ0-9\s']/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!clean) return false;

    return /\b(i'?m good|im good|i am good|doing good|doing well|i'?m fine|im fine|i am fine|fine|good|great|okay|ok|not bad|all good|how are you|how about you|thank you|thanks|yes i can hear|i can hear|can hear you|hello|hi|hey|hallo|bonjour|hola|namaste)\b/i.test(
      clean,
    );
  }, []);

  // Keep a ref mirror of the transcript so closures (recorder.onstop, async
  // speech-recognition handlers) can read the latest conversation history
  // without stale-closure issues — same reasoning as questionIndexRef etc.
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // ── Live recruiter reply: real LLM for paid plans, rule engine for free ──
  // Free tier intentionally keeps the existing fast/free deterministic
  // engine (buildRecruiterReply) — it's already a reasonable "try before
  // you buy" experience. Premium and Premium Pro get genuinely responsive,
  // LLM-generated replies that react to what was actually said instead of
  // selecting from a fixed list of canned strings. If the LLM call fails
  // or times out for any reason, this transparently falls back to the same
  // rule engine free users get, so a flaky API call never breaks the
  // interview — it just quietly degrades to the old behavior for that turn.
  const getRecruiterReply = useCallback(
    async (answer: string): Promise<string> => {
      const currentSetup = setupRef.current;
      const callStartedAt = Date.now();
      const fallback = (reason: string) => {
        const durationMs = Date.now() - callStartedAt;
        console.error(
          `[interview] LLM reply NOT used this turn — using rule-engine fallback. reason="${reason}" durationMs=${durationMs}`,
        );
        trackWorkZoErrorEvent(
          "interview_reply_fallback",
          reason,
          {
            role: currentSetup.targetRole,
            recruiter: currentSetup.recruiterName,
            questionIndex: questionIndexRef.current,
            durationMs,
          },
          "medium",
        );
        return buildRecruiterReply(
          answer,
          questionIndexRef.current,
          currentSetup,
          recruiterMemoryRef.current,
        );
      };

      // Free users get full GPT-4o intelligence — session count is enforced by /api/db/interview-session.

      try {
        const signalAnalysis = analyzeAnswerSignals(answer, currentSetup);
        const unsupportedReason = extractUnsupportedClaimReason(
          answer,
          currentSetup,
        );

        const response = await fetch("/api/interview/reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          // 8000ms was too tight — confirmed in live testing the LLM call
          // legitimately takes >8s sometimes (more so as transcript/context
          // grows), which was dumping real answers into the robotic
          // deterministic fallback. 13s gives the call room to finish while
          // still bounding worst-case wait.
          // 13s still failed once in testing (13021ms) — right at the edge.
          // Combined with the role-knowledge prompt trim (only the matching
          // role block is sent now, not all ~7), this should hit far less
          // often, but the cap itself needed more headroom regardless.
          signal: AbortSignal.timeout(28000),
          body: JSON.stringify({
            answer,
            // BUG FIXED: currentQuestion was never sent at all, so the server
            // always fell back to its hardcoded default ("Tell me about
            // yourself"), regardless of what was actually just asked. That
            // caused real, on-topic answers to get rejected as "not
            // addressing the question" — they were being compared against
            // the wrong question. This sends the actual last thing the
            // recruiter said, which is the real active question.
            currentQuestion:
              [...transcriptRef.current]
                .reverse()
                .find((item) => item.role === "recruiter")?.text || "",
            // Only the last 10 turns are sent — GPT-4o needs recent thread
            // context, not the entire interview transcript. Sending the full
            // history made every request's input larger (and slower) as the
            // interview progressed, compounding the latency problem.
            transcript: transcriptRef.current
              .slice(-10)
              .map((item) => ({
                role: item.role,
                speaker: item.speaker,
                text: item.text,
              })),
            cvText: currentSetup.cvText,
            jobDescription: currentSetup.jobDescription,
            targetRole: currentSetup.targetRole,
            targetCompany:
              currentSetup.targetCompany || currentSetup.companyName,
            candidateName: currentSetup.candidateName,
            recruiterName: currentSetup.recruiterName,
            recruiterTitle: currentSetup.recruiterTitle,
            language: currentSetup.language,
            // Send structured profile so /api/interview/reply can build an explicit
            // verified-employers list — preventing false "I cannot verify [employer]" challenges
            resumeProfile: currentSetup.resumeProfile || null,
            pressureStyle:
              recruiterProfiles[currentSetup.recruiterId]?.pressureStyle ||
              recruiterProfiles[currentSetup.recruiterName]?.pressureStyle,
            questionIndex: questionIndexRef.current,
            // Technical mode: send code snapshot so the recruiter can react to it
            ...(codeSnapshotRef.current.trim()
              ? {
                  codeSnapshot: codeSnapshotRef.current,
                  codeLanguage: codeLanguageRef.current,
                }
              : {}),
            signals: {
              contradiction: undefined,
              unsupportedClaim: unsupportedReason || undefined,
              missingMetric: !signalAnalysis.metric,
              missingOwnership: !signalAnalysis.ownership,
              vague: signalAnalysis.vague,
              trust: recruiterSignalRef.current?.trust,
              interest: recruiterSignalRef.current?.interest,
            },
            recruiterMemoryV2: recruiterMemoryV2Ref.current || undefined,
          }),
        });

        const data = await response.json().catch(() => null);
        const durationMs = Date.now() - callStartedAt;

        if (
          response.ok &&
          data?.success &&
          typeof data.reply === "string" &&
          data.reply.trim()
        ) {
          if (data.recruiterMemoryV2) {
            recruiterMemoryV2Ref.current = data.recruiterMemoryV2;
          }
          if (
            data.provider &&
            data.provider !== "unified_engine" &&
            data.provider !== "opening_guard"
          ) {
            // The server itself fell back to its rule engine — still real text,
            // but worth knowing about. Not a hard failure, so no fallback() call.
            console.warn(
              `[interview] Server used "${data.provider}" instead of GPT-4o this turn. durationMs=${durationMs}`,
            );
          } else {
            console.log(`[interview] LLM reply used. durationMs=${durationMs}`);
          }
          const serverReply = data.reply.trim();
          // Client-side language guard: if the reply starts with English opener phrases
          // and the interview is in a non-English language, enforce the language locally
          const enforcedReply = enforceRuntimeLanguageForReply(
            currentSetup,
            serverReply,
          );
          return enforcedReply;
        }

        return fallback(`http_${response.status}_${data?.error || "no_reply"}`);
      } catch (error) {
        return fallback(
          error instanceof Error
            ? `${error.name}: ${error.message}`
            : "unknown_error",
        );
      }
    },
    [serverPlan],
  );

  // Keep refs in sync so the interview API call always has the latest code
  // without needing to add codeSnapshot to every useCallback dependency array.
  const dismissFirstTimeHint = useCallback(() => {
    setShowFirstTimeHint(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("workzo_interview_hint_dismissed", "1");
    }
  }, []);

  const handleCodeChange = useCallback((code: string, language: string) => {
    setCodeSnapshot(code);
    setCodeLanguage(language);
    codeSnapshotRef.current = code;
    codeLanguageRef.current = language;
  }, []);

  const startListening = useCallback(async () => {
    if (stopRequestedRef.current) return;

    const Recognition = getRecognitionConstructor();

    if (!Recognition) {
      setStatus("listening");
      addTranscript({
        role: "system",
        speaker: "System",
        text: "Browser speech recognition is unavailable. Recording a short answer and transcribing it securely instead.",
      });

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const recorder = new MediaRecorder(stream);
        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        recorder.onstop = async () => {
          stream.getTracks().forEach((track) => track.stop());
          const audioBlob = new Blob(chunks, {
            type: recorder.mimeType || "audio/webm",
          });
          const formData = new FormData();
          formData.append("audio", audioBlob, "candidate-answer.webm");
          // Send BCP-47 code to Whisper for best STT accuracy (not the label string)
          const sttLangCode = selectedLanguageIsoCode(setupRef.current);
          formData.append("language", sttLangCode || "en");

          const response = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
            credentials: "include",
          });
          const data = await response.json().catch(() => ({}));
          const answer = String(data?.text || "").trim();

          // Corruption detected by server-side Whisper output check
          if (data?.corrupted) {
            const lang = normalizeInterviewLanguage(setupRef.current.language);
            const clarificationMsg = buildLocalizedGentleClarification(
              setupRef.current,
            );
            speakRecruiter(clarificationMsg);
            setStatus("listening");
            return;
          }

          if (!answer || stopRequestedRef.current) {
            setStatus("listening");
            return;
          }

          addTranscript({ role: "candidate", speaker: "You", text: answer });
          applyRecruiterSignalUpdate(answer);
          const reaction = getWorkZoLiveReaction(answer);
          setRecruiterVisualState(reaction.visualState);
          setLiveReactionText(reaction.text);
          const nextEmoMem = updateWorkZoEmotionalMemory(
            emotionalMemoryRef.current,
            answer,
          );
          emotionalMemoryRef.current = nextEmoMem;
          setEmotionalMemory(nextEmoMem);
          setStatus("thinking");

          const interruptDecision = decideWorkZoInterruption(answer);
          if (interruptDecision.shouldInterrupt) {
            const wc = answer.trim().split(/\s+/).filter(Boolean).length;
            console.warn(
              `[interview] decideWorkZoInterruption fired (recorder fallback) — reason=${interruptDecision.reason} wordCount=${wc} answerLength=${answer.length} answer="${answer}"`,
            );
          }
          const baseReply = interruptDecision.shouldInterrupt
            ? interruptDecision.line
            : await getRecruiterReply(answer);
          const reply = enforceRuntimeLanguageForReply(
            setupRef.current,
            baseReply,
          );
          // 150ms: state settles fast enough, silence already provides the pause.
          window.setTimeout(() => {
            if (stopRequestedRef.current) return;
            setQuestionIndex((value) => Math.min(value + 1, 20));
            speakRecruiter(reply);
          }, 150);
        };
        recorder.start();

        // Real silence detection instead of a fixed cutoff. The old code
        // hard-stopped recording at exactly 9 seconds regardless of content —
        // any answer longer than that (most real interview answers are
        // 20-60s+) was silently truncated and submitted as if it were
        // complete, then the interview advanced anyway. This watches actual
        // mic volume via the Web Audio API and stops only after sustained
        // silence, mirroring the SILENCE_MS behavior of the primary
        // SpeechRecognition path above. A generous hard cap remains only as
        // a last-resort safety backstop, not the normal stop condition.
        const SILENCE_THRESHOLD_RMS = 0.012;
        const SILENCE_STOP_MS = 2000;
        const MIN_RECORDING_MS = 800; // ignore the initial silence while the mic warms up
        const HARD_CAP_MS = 90000; // backstop only — should essentially never be hit
        // Same "paused right after starting" problem as the primary path —
        // this path has no live transcript to count words from, so total
        // detected speech time is used as the proxy instead. One grace
        // extension only.
        const GRACE_SPEECH_MS_THRESHOLD = 2000;
        const GRACE_EXTENSION_MS = 2800;
        let speechDetectedMs = 0;
        let graceUsed = false;
        let graceDeadline: number | null = null;

        const audioContext = new (
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext
        )();
        const sourceNode = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        sourceNode.connect(analyser);
        const buffer = new Uint8Array(analyser.fftSize);

        const recordingStartedAt = Date.now();
        let lastSpeechAt = Date.now();
        let stopped = false;

        const stopRecording = () => {
          if (stopped) return;
          stopped = true;
          window.clearInterval(silenceCheckInterval);
          try {
            sourceNode.disconnect();
            audioContext.close();
          } catch {}
          if (recorder.state !== "inactive") recorder.stop();
        };

        const silenceCheckInterval = window.setInterval(() => {
          analyser.getByteTimeDomainData(buffer);
          let sumSquares = 0;
          for (let i = 0; i < buffer.length; i += 1) {
            const normalized = (buffer[i] - 128) / 128;
            sumSquares += normalized * normalized;
          }
          const rms = Math.sqrt(sumSquares / buffer.length);
          const elapsedSinceStart = Date.now() - recordingStartedAt;

          if (rms > SILENCE_THRESHOLD_RMS) {
            lastSpeechAt = Date.now();
            speechDetectedMs += 150;
          }

          const silentFor = Date.now() - lastSpeechAt;
          const silenceThresholdHit =
            elapsedSinceStart > MIN_RECORDING_MS && silentFor > SILENCE_STOP_MS;

          if (
            silenceThresholdHit &&
            !graceUsed &&
            speechDetectedMs > 0 &&
            speechDetectedMs < GRACE_SPEECH_MS_THRESHOLD
          ) {
            graceUsed = true;
            graceDeadline = Date.now() + GRACE_EXTENSION_MS;
          }

          if (graceDeadline !== null) {
            if (rms > SILENCE_THRESHOLD_RMS) {
              graceDeadline = null; // they kept talking — cancel the grace deadline, normal flow resumes
            } else if (Date.now() > graceDeadline) {
              stopRecording();
            }
            return;
          }

          if (silenceThresholdHit) {
            stopRecording();
          } else if (elapsedSinceStart > HARD_CAP_MS) {
            stopRecording();
          }
        }, 150);
      } catch (error) {
        trackWorkZoErrorEvent(
          "server_transcription_fallback_failed",
          error,
          {
            role: setupRef.current.targetRole,
            recruiter: setupRef.current.recruiterName,
          },
          "medium",
        );
        setStatus("listening");
      }
      return;
    }

    try {
      recognitionRef.current?.abort?.();
    } catch {}

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = getSpeechRecognitionLang(setupRef.current);

    // Silence timer — fires onend after sustained silence to submit the full answer.
    // continuous=true means the browser keeps listening through natural pauses;
    // we manually stop after sustained silence to submit the full answer.
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;
    // Real interview answers include thinking pauses (people pause mid-story
    // while recalling details). 1400ms was tuned purely for responsiveness and
    // was cutting candidates off mid-answer — confirmed from live testing.
    // 2000ms is closer to a natural "I'm actually done" pause without
    // reintroducing the noticeable lag the original 2200ms had.
    const SILENCE_MS = 2000;
    // People very often pause right after starting a hard question — "The
    // hardest part was... [pause to think]" — confirmed from live testing
    // where this produced a 3-word fragment ("this part is") submitted as a
    // complete answer. A flat silence threshold can't distinguish "done
    // talking" from "thinking about what to say next" when only a few words
    // have been captured. One extra grace window, granted only once per
    // turn and only when the buffer is still this short, fixes exactly that
    // case without slowing down every normal answer.
    const GRACE_WORD_THRESHOLD = 6;
    const GRACE_EXTENSION_MS = 2800;
    let graceUsed = false;

    function resetSilenceTimer() {
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        const wordsSoFar = answerBufferRef.current
          .trim()
          .split(/\s+/)
          .filter(Boolean).length;
        if (
          !graceUsed &&
          wordsSoFar > 0 &&
          wordsSoFar <= GRACE_WORD_THRESHOLD
        ) {
          graceUsed = true;
          silenceTimer = setTimeout(() => {
            if (recognitionRef.current && listeningRef.current) {
              recognitionRef.current.stop();
            }
          }, GRACE_EXTENSION_MS);
          return;
        }
        if (recognitionRef.current && listeningRef.current) {
          recognitionRef.current.stop();
        }
      }, SILENCE_MS);
    }

    recognition.onstart = () => {
      listeningRef.current = true;
      setStatus("listening");
      setInterimText("");
      answerBufferRef.current = "";
      resetSilenceTimer();
    };

    recognition.onresult = (event) => {
      let finalText = "";
      let interim = "";

      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        const result = event.results[index];
        const text = result[0]?.transcript || "";
        if (result.isFinal) finalText += text;
        else interim += text;
      }

      // Any new speech resets the silence timer — candidate is still speaking
      resetSilenceTimer();

      if (interim.trim()) {
        const cleanInterim = interim.trim();
        lastInterimTextRef.current = cleanInterim;
        lastInterimUpdateAtRef.current = Date.now();
        setInterimText(cleanInterim);
        // Live filler word counter — updates copilot panel in real time
        setFillerCount(
          countFillerWords(`${answerBufferRef.current} ${cleanInterim}`.trim()),
        );
      }
      if (finalText.trim()) {
        answerBufferRef.current =
          `${answerBufferRef.current} ${finalText}`.trim();
        setFillerCount(countFillerWords(answerBufferRef.current));
      }
    };

    recognition.onerror = (event) => {
      listeningRef.current = false;
      setInterimText("");
      trackWorkZoErrorEvent(
        "speech_recognition_error",
        event?.error || event?.message || "Speech recognition error",
        {
          role: setupRef.current.targetRole,
          recruiter: setupRef.current.recruiterName,
        },
        "medium",
      );
      if (!stopRequestedRef.current) setStatus("listening");
    };

    recognition.onend = async () => {
      listeningRef.current = false;
      if (silenceTimer) clearTimeout(silenceTimer);
      // De-duplicate here, once, before this text is used for ANYTHING —
      // word counts, the interrupt check, and the LLM call all read this same
      // variable. Previously only the *displayed* transcript text was
      // deduplicated (inside addTranscript), while the interrupt check and
      // the LLM submission used the raw, still-duplicated buffer. That meant
      // a single ~90-word answer accidentally double-captured by the Web
      // Speech API (a known continuous-mode quirk) could silently read as
      // ~180 words to the interrupt check and cross the rambling threshold,
      // while looking completely normal on screen — confirmed from live
      // testing where a clean, complete answer got cut off immediately.
      const answer = removeRepeatedSpeechChunks(getStableCandidateAnswer());
      answerBufferRef.current = answer;
      lastInterimTextRef.current = "";
      lastInterimUpdateAtRef.current = 0;
      setInterimText("");

      if (!answer || stopRequestedRef.current) {
        if (!stopRequestedRef.current) {
          setStatus("listening");
          window.setTimeout(() => startListening(), 350);
        }
        return;
      }

      // Minimum word threshold. Short opening replies such as "good, how are you?"
      // must still advance the first turn. Previously these were treated as too
      // short/partial and the interview kept running without moving forward.
      const wordCount = answer.split(/\s+/).filter(Boolean).length;
      // BUG FIXED: this used to apply at ANY question index, which meant
      // "okay okay", "hey", "yes" etc. mid-interview were treated as
      // complete, real answers instead of being rejected as too short —
      // confirmed from live testing where "okay okay" was submitted as the
      // answer to "tell me about your background." An audio-check phrase is
      // only a legitimate non-answer during the opening handshake.
      const isAudioCheck =
        questionIndexRef.current <= 1 &&
        /^(can you hear|hello|hi|hey|test|check|is this|are you|okay|ok|yes|no|good|fine|great|thanks|thank you)/i.test(
          answer,
        );
      const isOpeningSmallTalk =
        questionIndexRef.current <= 1 &&
        isValidOpeningOrSmallTalkAnswer(answer);
      // Catches things like "hey can you" or "to you can you hear me" —
      // technically 3+ words so the raw word-count check alone misses them,
      // but they carry no real content at any point past the opening turn.
      const isLowContentFragment =
        questionIndexRef.current > 1 && isLowContentAnswerFragment(answer);

      if (
        (wordCount < 3 && !isAudioCheck && !isOpeningSmallTalk) ||
        isLowContentFragment
      ) {
        setStatus("listening");
        if (isLowContentFragment) {
          // Speak the acknowledgment instead of silently re-listening —
          // silent re-prompting is exactly what reads as "it's not
          // listening to me." A quick spoken nudge confirms it heard
          // something, just not enough to go on.
          window.setTimeout(
            () =>
              speakRecruiter(
                "Sorry, I didn't quite catch that — go ahead and continue.",
              ),
            150,
          );
        } else {
          window.setTimeout(() => startListening(), 200);
        }
        return;
      }

      addTranscript({
        role: "candidate",
        speaker: "You",
        text: answer,
      });

      applyRecruiterSignalUpdate(answer);
      setFillerCount(0); // reset for next answer

      // Emotional memory engine — tracks vague answers, missing metrics, ownership patterns
      const reaction = getWorkZoLiveReaction(answer);
      setRecruiterVisualState(reaction.visualState);
      setLiveReactionText(reaction.text);
      const nextEmoMem = updateWorkZoEmotionalMemory(
        emotionalMemoryRef.current,
        answer,
      );
      emotionalMemoryRef.current = nextEmoMem;
      setEmotionalMemory(nextEmoMem);
      setStatus("thinking");

      // Live interruption engine — recruiter can cut off rambling answers
      const interruptDecision = decideWorkZoInterruption(answer);
      if (interruptDecision.shouldInterrupt) {
        const wc = answer.trim().split(/\s+/).filter(Boolean).length;
        console.warn(
          `[interview] decideWorkZoInterruption fired — reason=${interruptDecision.reason} wordCount=${wc} answerLength=${answer.length} answer="${answer}"`,
        );
      }
      const baseReply = interruptDecision.shouldInterrupt
        ? interruptDecision.line
        : await getRecruiterReply(answer);

      // Company simulation engine — adaptive pressure follow-ups based on detected mode.
      // Only applies on the free-tier rule-engine path: paid plans already get a
      // genuinely responsive LLM reply via getRecruiterReply, and overriding that
      // with a generic templated question here would silently undo the point of
      // the LLM integration — this was also the exact condition (missingMetrics >= 2)
      // behind the "repeats the same sentence" bug found earlier in testing.
      const isFreeRuleEnginePath = false; // Free gets premium intelligence
      const simStyle =
        companyMode === "google"
          ? "analytical"
          : companyMode === "mckinsey"
            ? "pressure"
            : companyMode === "startup"
              ? "pressure"
              : "supportive";
      const adaptiveFollowUp =
        isFreeRuleEnginePath &&
        !interruptDecision.shouldInterrupt &&
        nextEmoMem.missingMetrics >= 2
          ? buildAdaptiveFollowUpQuestion({
              style: simStyle,
              targetRole: setupRef.current.targetRole,
              weaknessSignals: nextEmoMem.weakMoments,
              previousAnswer: answer,
            })
          : null;

      const reply = enforceRuntimeLanguageForReply(
        setupRef.current,
        adaptiveFollowUp || baseReply,
      );

      // 150ms is enough for state to settle before speaking.
      // The natural pause already happened in the silence detection timer.
      // The old 650ms added perceived lag without adding realism.
      window.setTimeout(() => {
        if (stopRequestedRef.current) return;
        setQuestionIndex((value) => Math.min(value + 1, 20));
        setRecruiterVisualState(
          interruptDecision.shouldInterrupt ? "interrupting" : "listening",
        );
        speakRecruiter(reply);
      }, 150);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      trackWorkZoErrorEvent(
        "speech_recognition_start_failed",
        error,
        {
          role: setupRef.current.targetRole,
          recruiter: setupRef.current.recruiterName,
        },
        "medium",
      );
      setStatus("listening");
    }
  }, [addTranscript]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  const speakRecruiter = useCallback(
    async (text: string) => {
      const activeSetup = setupRef.current;

      addTranscript({
        role: "recruiter",
        speaker: `${activeSetup.recruiterName} · ${getWorkZoSimulationPersona(activeSetup as unknown as Record<string, unknown>).title}`,
        text,
      });

      // Block browser TTS only while AI voice is actually starting/connected.
      if (
        premiumVoiceEnabledRef.current &&
        audioEnabledRef.current &&
        premiumVoiceStatus !== "fallback" &&
        (vapiStartingRef.current || vapiConnectedRef.current)
      ) {
        return;
      }

      if (!audioEnabled) {
        // All startListening() delays below were reduced from 280-650ms to
        // 50ms — eager candidates often start answering the instant the
        // recruiter stops talking, and the old delay was losing those first
        // words before the mic was even live. 50ms is just enough for React
        // state to settle, not a perceptible pause. The listening chime
        // (added separately) still gives a clear "go" signal regardless of
        // this timing, so this isn't relying on timing alone.
        window.setTimeout(() => startListening(), 50);
        return;
      }

      // Tier 2: ElevenLabs TTS — richer voice when browser TTS is active and key is set
      if (
        typeof window !== "undefined" &&
        process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY &&
        premiumVoiceStatus === "fallback"
      ) {
        try {
          await speakWithElevenLabs(activeSetup.recruiterId, text);
          window.setTimeout(() => startListening(), 50);
          return;
        } catch {
          // ElevenLabs failed — fall through to browser TTS
        }
      }

      // Server-side OpenAI TTS route — keeps keys off the client and makes /api/tts the production fallback.
      if (audioEnabled && premiumVoiceStatus === "fallback") {
        try {
          const ttsRes = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              text,
              recruiterId: activeSetup.recruiterId,
              recruiterState: recruiterVisualState,
              mode: serverPlan,
            }),
          });
          if (ttsRes.ok) {
            const audioBlob = await ttsRes.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            currentAudioRef.current = audio;
            setStatus("recruiter-speaking");
            await new Promise<void>((resolve) => {
              audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                currentAudioRef.current = null;
                resolve();
              };
              audio.onerror = () => {
                URL.revokeObjectURL(audioUrl);
                currentAudioRef.current = null;
                resolve();
              };
              audio.play().catch(() => resolve());
            });
            window.setTimeout(() => startListening(), 50);
            return;
          }
        } catch {
          // Fall through to browser speechSynthesis.
        }
      }

      if (typeof window === "undefined" || !window.speechSynthesis) {
        window.setTimeout(() => startListening(), 50);
        return;
      }
      // ── ElevenLabs tier-2 voice (better than browser, lighter than Vapi) ──
      if (audioEnabled && typeof window !== "undefined") {
        try {
          const el11Res = await fetch("/api/elevenlabs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              text,
              recruiterId: activeSetup.recruiterId,
              recruiterName: activeSetup.recruiterId,
            }),
          });
          if (el11Res.ok) {
            const audioBlob = await el11Res.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            currentAudioRef.current = audio;
            setStatus("recruiter-speaking");
            audio.onended = () => {
              URL.revokeObjectURL(audioUrl);
              currentAudioRef.current = null;
              if (!stopRequestedRef.current)
                window.setTimeout(() => startListening(), 50);
            };
            audio.onerror = () => {
              URL.revokeObjectURL(audioUrl);
              currentAudioRef.current = null;
              // Fall through to browser TTS below
            };
            await audio.play().catch(() => null);
            if (!audio.paused) return; // ElevenLabs is playing — skip browser TTS
          }
        } catch {
          // ElevenLabs unavailable — fall through to browser TTS
        }
      }

      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.resume();

        const voices = await getAvailableVoices();
        if (stopRequestedRef.current) return;

        const utterance = new SpeechSynthesisUtterance(text);
        const wantsMale = recruiterLooksMale(activeSetup);

        utterance.rate = wantsMale
          ? Math.max(0.7, voiceSpeed - 0.08)
          : Math.max(0.72, voiceSpeed - 0.04);
        utterance.pitch = wantsMale ? 0.86 : 1.08;
        utterance.lang =
          normalizeInterviewLanguage(activeSetup.language).code || "en-US";

        const preferred = preferredVoiceForRecruiter(voices, activeSetup);
        if (preferred) utterance.voice = preferred;

        setStatus("recruiter-speaking");

        let released = false;
        const releaseToListening = () => {
          if (released || stopRequestedRef.current) return;
          released = true;
          window.setTimeout(() => startListening(), 50);
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
    [
      addTranscript,
      audioEnabled,
      premiumVoiceStatus,
      startListening,
      voiceSpeed,
    ],
  );

  const applyRecruiterSignalUpdate = useCallback(
    (answer: string) => {
      setRecruiterSignal((current) => {
        const baseline = scoreReady ? current : defaultRecruiterSignal;
        const next = updateRecruiterSignalState(
          baseline,
          answer,
          setupRef.current,
        );
        const direction = next.overall >= baseline.overall ? "up" : "down";

        setRecruiterMemory((memory) => {
          const updated = updateRecruiterMemoryState(
            memory,
            answer,
            setupRef.current,
            next,
          );
          recruiterMemoryRef.current = updated;
          return updated;
        });

        // ── Wire orphaned engines ─────────────────────────────────────────────
        // 1. Recruiter visual state + emotional memory
        const reaction = getWorkZoLiveReaction(answer);
        setRecruiterVisualState(reaction.visualState);
        setEmotionalMemory((prev) => {
          const updated = updateWorkZoEmotionalMemory(prev, answer);
          emotionalMemoryRef.current = updated;
          return updated;
        });

        // 2. Filler word counter
        const fillers = (
          answer.match(
            /\b(um+|uh+|like|you know|sort of|kind of|basically|literally|right\?|so\.\.\.)\b/gi,
          ) || []
        ).length;
        if (fillers > 0) setFillerWordCount((c) => c + fillers);

        // 3. Shareable moment detection
        const contradiction = extractUnsupportedClaimReason(
          answer,
          setupRef.current,
        );
        const moment = detectShareableMoment({
          wowMoment: contradiction
            ? {
                shouldTrigger: true,
                line: contradiction,
                emotionalTag: "contradiction",
              }
            : undefined,
          trust: next.trust,
          pressure: next.overall < 50 ? 80 : 20,
          contradiction: contradiction || undefined,
        });
        if (moment.shouldHighlight) {
          setShareableMoment({
            title: moment.shareTitle,
            text: moment.shareText,
            category: moment.category,
          });
        }

        // Push a real-time fact-check signal into the live Vapi call. The
        // deterministic check above is more reliable than asking the voice
        // LLM to notice contradictions purely from its system prompt — this
        // gives it an explicit verdict to act on for its very next reply,
        // instead of relying on it to catch the mismatch unprompted.
        if (contradiction) {
          try {
            vapiClientRef.current?.send?.({
              type: "add-message",
              message: {
                role: "system",
                content: `FACT-CHECK ALERT: The candidate's last answer appears to contain a claim that is not supported by the verified resume facts or job description. Specifically: ${contradiction} First check the VERIFIED RESUME FACTS already provided in cvSummary/cvText. If the claim is a close speech-to-text variant of a verified fact, do NOT challenge it; correct it mentally and continue. Only if it is genuinely absent, ask one brief clarification.`,
              },
            });
          } catch {
            // If the SDK version doesn't support send(), the prompt-level
            // instructions remain the only safeguard — fail silently.
          }
        }

        setScoreReady(true);

        const answerQuality = classifyAnswerQuality(answer, setupRef.current);
        trackWorkZoFailureEvent(
          "answer_quality_detected",
          {
            role: setupRef.current.targetRole,
            recruiter: setupRef.current.recruiterName,
            quality: answerQuality,
            trust: next.trust,
            interest: next.interest,
            concern: next.concern,
          },
          answerQuality === "weak" ? "medium" : "low",
        );

        setScoreFlash(direction);
        window.setTimeout(() => setScoreFlash(null), 900);

        return next;
      });
    },
    [scoreReady],
  );

  const stopPremiumVoice = useCallback(() => {
    vapiConnectedRef.current = false;
    vapiStartingRef.current = false;
    vapiIntentionalStopRef.current = true;

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

    // Give Daily/Vapi enough time to emit its normal "meeting ended" cleanup
    // event, then allow future genuine errors to be handled again.
    window.setTimeout(() => {
      vapiIntentionalStopRef.current = false;
    }, 1200);
  }, []);

  const analyzeVapiUserAnswer = useCallback((answer: string) => {
    if (!answer.trim()) return;

    // Emotional memory engine — same as browser path
    const reaction = getWorkZoLiveReaction(answer);
    setRecruiterVisualState(reaction.visualState);
    setLiveReactionText(reaction.text);
    const nextEmoMem = updateWorkZoEmotionalMemory(
      emotionalMemoryRef.current,
      answer,
    );
    emotionalMemoryRef.current = nextEmoMem;
    setEmotionalMemory(nextEmoMem);

    // Filler word count from Vapi transcript
    setFillerCount((prev) => prev + countFillerWords(answer));

    // Interruption check — if Vapi's answer is rambling, record it
    const interruptDecision = decideWorkZoInterruption(answer);
    if (interruptDecision.shouldInterrupt) {
      setRecruiterVisualState("interrupting");
    }
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

  function openUpgradeModal(feature: string) {
    setUpgradeModalFeature(feature);
  }

  function closeUpgradeModal() {
    setUpgradeModalFeature("");
  }

  function handleUpgradeInterest() {
    setUpgradeModalFeature("");
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "workzo_pending_upgrade_route",
        JSON.stringify({
          feature: upgradeModalFeature || "premium",
          createdAt: new Date().toISOString(),
        }),
      );
    }
  }

  const startPremiumVoice = useCallback(
    async (activeSetup: InterviewSetup) => {
      // Vapi = voice interviews for Premium+. Tavus = video for Pro only. Never mix these checks.
      if (vapiStartingRef.current || vapiConnectedRef.current) return true;

      // Reset stale client/call state first, then mark this new AI voice start attempt.
      stopPremiumVoice();
      vapiIntentionalStopRef.current = false;
      vapiStartingRef.current = true;

      if (!premiumVoiceEnabled || !audioEnabled) {
        vapiStartingRef.current = false;
        setPremiumVoiceStatus("not_configured");
        return false;
      }

      const config = getWorkZoVapiConfig(
        activeSetup.recruiterId,
        activeSetup.recruiterName,
      );
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
        // BUG FIXED: this used to fail completely silently — no transcript
        // message, nothing visible, only a console.info easy to miss. That's
        // exactly why "fallback instead of Vapi" was confusing: there was no
        // way to tell WHY without opening devtools. Now it says specifically
        // which piece is missing.
        const missingPieces = [
          !config.publicKey ? "NEXT_PUBLIC_VAPI_PUBLIC_KEY" : null,
          !config.assistantId
            ? `the Vapi assistant ID for this recruiter (${config.recruiterKey})`
            : null,
        ].filter(Boolean);
        console.warn(
          `[interview] Vapi not configured — using fallback voice. Missing: ${missingPieces.join(", ") || "unknown (check NEXT_PUBLIC_WORKZO_VOICE_PROVIDER)"}`,
        );
        addTranscript({
          role: "system",
          speaker: "System",
          text: "Live AI voice isn't available right now — continuing with standard voice.",
        });
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
          if (stopRequestedRef.current || vapiFallbackStartedRef.current)
            return;

          const normalizedMessage = normalizeErrorMessage(error);
          const lowerMessage = normalizedMessage.toLowerCase();
          const isDailyMeetingCleanup =
            lowerMessage.includes("meeting has ended") ||
            lowerMessage.includes("meeting ended") ||
            lowerMessage.includes('"type":"ejected"') ||
            lowerMessage.includes("due to ejection");
          const isKrispProcessorNoise =
            lowerMessage.includes("krisp") ||
            lowerMessage.includes("worklet_not_supported") ||
            lowerMessage.includes("unable to load a worklet") ||
            lowerMessage.includes("error applying mic processor");

          // Krisp/Daily processor warnings are common in localhost/dev and do
          // not always mean the Vapi call failed. Also ignore the Daily
          // "meeting ended" event if WorkZo intentionally stopped the call.
          if (
            isKrispProcessorNoise ||
            (isDailyMeetingCleanup && vapiIntentionalStopRef.current)
          )
            return;

          console.warn(
            "WORKZO VAPI CONNECTION FAILED — switching to browser fallback",
            {
              message: normalizedMessage,
              role: activeSetup.targetRole,
              recruiter: activeSetup.recruiterName,
              language: activeSetup.language,
              assistantId: config.assistantId,
              recruiterKey: config.recruiterKey,
            },
          );
          classifyVoiceError(error);
          trackWorkZoErrorEvent(
            "vapi_connection_failed",
            error,
            {
              role: activeSetup.targetRole,
              recruiter: activeSetup.recruiterName,
              language: activeSetup.language,
              assistantId: config.assistantId,
            },
            "high",
          );
          setPremiumVoiceStatus("failed");
          setPremiumVoiceError(
            "Live voice is unavailable. Continuing with standard voice.",
          );
          stopPremiumVoice();
          if (!vapiFallbackStartedRef.current)
            void startBrowserFallbackInterview(activeSetup);
        };

        client.on?.("call-start", () => {
          vapiIntentionalStopRef.current = false;
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
          setPremiumVoiceStatus((current) =>
            current === "connected" ? "idle" : current,
          );
          if (!stopRequestedRef.current) setStatus("idle");
        });

        client.on?.("error", releaseToFallback);

        client.on?.("message", (message: unknown) => {
          const transcriptMessage = normalizeVapiTranscriptMessage(message);
          if (!transcriptMessage) return;

          if (!transcriptMessage.isFinal) {
            if (transcriptMessage.role === "user") {
              const interim = cleanVisibleTranscriptText(
                transcriptMessage.text,
              );
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
            if (
              vapiFinalUserTextRef.current === finalText ||
              lastUserTranscriptRef.current === finalText
            )
              return;
            vapiFinalUserTextRef.current = finalText;
            lastUserTranscriptRef.current = finalText;

            // Live interruption check — surfaced visually via recruiter visual state
            const liveInterrupt = shouldInterruptLive({
              transcript: finalText,
              duration: 0,
            });
            if (liveInterrupt.interrupt) {
              setRecruiterVisualState("interrupting");
              setLiveReactionText(
                liveInterrupt.message || "Let me stop you there.",
              );
            }

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
            const recruiterText = cleanRecruiterFinalText(
              finalText,
              activeSetup,
            );
            if (lastAssistantTranscriptRef.current === recruiterText) return;
            lastAssistantTranscriptRef.current = recruiterText;

            if (isProgressWorthyRecruiterTurn(recruiterText)) {
              const signature = recruiterText.toLowerCase().slice(0, 140);
              if (vapiQuestionSignatureRef.current !== signature) {
                vapiQuestionSignatureRef.current = signature;
                setQuestionIndex((value) => Math.min(value + 1, 20));
              }
            }

            addTranscript({
              role: "recruiter",
              speaker: `${activeSetup.recruiterName} · ${getWorkZoSimulationPersona(activeSetup as unknown as Record<string, unknown>).title}`,
              text: recruiterText,
            });
          }
        });

        const selectedLanguage = normalizeInterviewLanguage(
          activeSetup.language,
        );
        const isEnglishInterview = selectedLanguage.code
          .toLowerCase()
          .startsWith("en");
        const unsupportedClaimChallenge =
          localizedUnsupportedClaimChallenge(activeSetup);

        // Build variableValues — ONLY include fields that the Vapi assistant
        // template references as {{variables}}. Sending large instruction blobs
        // here (workzoStrictGrounding, pacingRules, etc.) pushes the payload
        // over Vapi's ~10KB limit and causes a 400 error on every call.
        // All static instruction text lives in the assistant's system prompt
        // on the Vapi Dashboard instead.
        const variableValues = buildWorkZoVapiVariableValues({
          language: selectedLanguage.code,
          languageLabel: selectedLanguage.label,
          openingGreeting: buildLocalizedGreeting(activeSetup),
          openingIntroQuestion: buildLocalizedIntroQuestion(activeSetup),
          candidateName: safePromptCandidateName(activeSetup.candidateName),
          recruiterName: activeSetup.recruiterName,
          recruiterRole: activeSetup.recruiterTitle,
          targetRole: activeSetup.targetRole,
          targetMarket: "Global",
          companyStyle: detectCompanyInterviewStyle(activeSetup),
          companyName: activeSetup.targetCompany || "the company",
          recruiterPersonality: recruiterPersonalityInstructions(activeSetup),
          companyStyleInstructions: companyStyleInstructions(
            detectCompanyInterviewStyle(activeSetup),
          ),
          // Pass structured profile so VAPI gets exact company names directly from
          // resumeProfile.experience[].company — not from regex on cvText which
          // strips company names when they appear after a job title on the same line.
          resumeProfile: activeSetup.resumeProfile || null,
          // Global CV/JD grounding fix:
          // Pass verified factual memory + the fullest available CV/JD context to
          // buildWorkZoVapiVariableValues(). That helper performs final compacting
          // and adds fuzzy company-name handling, so the assistant does not miss
          // any employer name because of transcript STT noise.
          cvText: [
            enforceSelectedLanguagePrefix(activeSetup),
            buildFactualMemoryBrief(activeSetup),
            "FULL RAW CV CONTEXT (secondary; verified facts above are authoritative):",
            activeSetup.cvText ||
              (activeSetup as any).rawCvText ||
              (activeSetup as any).resumeText ||
              (activeSetup as any).candidateCv ||
              "",
          ].join("\n"),
          jobDescription: [
            buildLanguageInstruction(activeSetup),
            "FULL JOB DESCRIPTION CONTEXT:",
            activeSetup.jobDescription || (activeSetup as any).jdText || "",
          ].join("\n"),
          // Core grounding rules — kept concise
          workzoStrictGrounding: `${buildLanguageInstruction(activeSetup)} You are WorkZo AI's recruiter. The VERIFIED RESUME FACTS in cvSummary/cvText are authoritative. Never say you do not see, cannot verify, do not see enough detail, not listed, not reflected in the CV, or need to pause for an employer, role, timeline, education, project, skill, achievement, responsibility, or years-of-experience already listed there, including close speech-to-text variants of any listed employer name. For verified facts, ask positively about responsibilities, ownership, challenges, metrics, JD fit, and outcomes. If the answer is short, say "I see that listed; walk me through the responsibilities and results there" rather than challenging the CV. Challenge only claims that are truly absent from verified facts and raw CV context. Ask one question per turn. ${unsupportedClaimChallenge}`,
          strictGroundingRules: `${buildOpeningFlowInstruction(activeSetup)} VERIFIED RESUME FACTS are authoritative. Never challenge companies/roles/years listed there and never say the CV lacks detail for verified facts. Treat speech-to-text variants of listed employers as supported. Challenge only genuinely unsupported new claims. Ask one concise follow-up at a time.`,
          recruiterMustChallengeUnsupportedClaims:
            "only_if_absent_from_verified_resume_facts",
          antiHallucinationMode: "verified_resume_authoritative",
        });

        vapiTimeoutRef.current = window.setTimeout(() => {
          if (
            !vapiConnectedRef.current &&
            !stopRequestedRef.current &&
            !vapiFallbackStartedRef.current
          ) {
            console.warn("WORKZO VAPI STILL CONNECTING", {
              role: activeSetup.targetRole,
              recruiter: activeSetup.recruiterName,
            });
            trackWorkZoFailureEvent(
              "vapi_connection_slow",
              {
                role: activeSetup.targetRole,
                recruiter: activeSetup.recruiterName,
              },
              "medium",
            );
            setPremiumVoiceStatus("connecting");
            setPremiumVoiceError(
              "Live voice is still connecting. Please wait — WorkZo will not switch to fallback unless the call truly fails.",
            );

            // Localhost/dev, cold starts, and Daily room creation can take
            // longer than 30 seconds. The previous code stopped Vapi at ~30s,
            // which itself produced Daily's `ejected / Meeting has ended` error
            // and forced the fallback voice. Keep the Vapi call alive much
            // longer, and only fall back after a genuine extended timeout.
            window.setTimeout(() => {
              if (
                !vapiConnectedRef.current &&
                !stopRequestedRef.current &&
                !vapiFallbackStartedRef.current
              ) {
                console.warn("WORKZO VAPI EXTENDED CONNECTION TIMEOUT", {
                  role: activeSetup.targetRole,
                  recruiter: activeSetup.recruiterName,
                });
                trackWorkZoFailureEvent(
                  "vapi_connection_extended_timeout",
                  {
                    role: activeSetup.targetRole,
                    recruiter: activeSetup.recruiterName,
                  },
                  "high",
                );
                setPremiumVoiceStatus("failed");
                setPremiumVoiceError(
                  "Live voice could not connect after an extended wait. Switching to standard voice.",
                );
                vapiIntentionalStopRef.current = true;
                stopPremiumVoice();
                if (!vapiFallbackStartedRef.current)
                  void startBrowserFallbackInterview(activeSetup);
              }
            }, 60000);
          }
        }, 15000);

        // ── Vapi safe call-start payload ──────────────────────────────────
        // Vapi Web SDK start() accepts: client.start(assistantId, assistantOverrides).
        // variableValues, firstMessage, and transcriber must be direct fields of
        // the second argument — never nested inside `assistantOverrides`.
        const localizedFirstMessage = buildLocalizedGreeting(activeSetup);

        const vapiStartOptions: Record<string, unknown> = {
          variableValues,
          firstMessage: localizedFirstMessage,
          transcriber: buildVapiTranscriberOverride(activeSetup),
        };

        // Debug log: verify what CV data VAPI actually receives
        // Diagnostic: log everything that reaches the Vapi call
        const cvFactsForLog = extractCvFactMemory(activeSetup);
        const _rpExp = (activeSetup.resumeProfile as any)?.experience || [];
        console.info("WORKZO VAPI CV CONTEXT", {
          candidateName: activeSetup.candidateName,
          hasResumeProfile: Boolean(activeSetup.resumeProfile),
          resumeProfileExperienceCount: _rpExp.length,
          resumeProfileCompanies: _rpExp.map((e: any) => e.company).filter(Boolean),
          cvFactCompanies: cvFactsForLog.companies,
          cvFactRoles: cvFactsForLog.roles,
          cvTextLength: (activeSetup.cvText || "").length,
          rawCvTextLength: ((activeSetup as any).rawCvText || activeSetup.cvText || "").length,
          variableValueKeys: Object.keys(variableValues),
          cvSummaryFirst300: String((variableValues as any).cvSummary || "").slice(0, 300),
          interviewStyleFirst300: String((variableValues as any).interviewStyle || "").slice(0, 300),
        });
        console.info("WORKZO VAPI LANGUAGE LOCK", {
          interviewLanguage: selectedLanguage.label,
          vapiTranscriberLanguage: selectedLanguageIsoCode(activeSetup),
          assistantId: config.assistantId,
          recruiterKey: config.recruiterKey,
        });

        await client.start(config.assistantId, vapiStartOptions);

        return true;
      } catch (error) {
        console.warn(
          "WORKZO VAPI START FAILED — switching to browser fallback",
          {
            message: normalizeErrorMessage(error),
            role: activeSetup.targetRole,
            recruiter: activeSetup.recruiterName,
            language: activeSetup.language,
            assistantId: config.assistantId,
            recruiterKey: config.recruiterKey,
          },
        );
        classifyVoiceError(error);
        trackWorkZoErrorEvent(
          "voice_connect_failed",
          error,
          {
            role: activeSetup.targetRole,
            recruiter: activeSetup.recruiterName,
            language: activeSetup.language,
            assistantId: config.assistantId,
          },
          "high",
        );
        vapiStartingRef.current = false;
        setPremiumVoiceStatus("failed");
        setPremiumVoiceError(
          "Live voice is unavailable. Continuing with standard voice.",
        );
        stopPremiumVoice();
        if (!vapiFallbackStartedRef.current)
          void startBrowserFallbackInterview(activeSetup);
        return false;
      }
    },
    [
      addTranscript,
      analyzeVapiUserAnswer,
      applyRecruiterSignalUpdate,
      audioEnabled,
      premiumVoiceEnabled,
      startBrowserFallbackInterview,
      stopPremiumVoice,
    ],
  );

  useEffect(() => {
    return () => {
      stopPremiumVoice();
    };
  }, [stopPremiumVoice]);

  const startInterview = useCallback(async () => {
    stopRequestedRef.current = false;

    // ── Plan interview limit check ───────────────────────────────────────────
    if (planLoading) {
      addTranscript({
        role: "system",
        speaker: "System",
        text: "Preparing your interview access. Please tap Start again in a moment.",
      });
      return;
    }
    const currentPlan = serverPlan;
    const interviewCheck = checkWorkZoInterviewAllowed(currentPlan);
    if (!interviewCheck.allowed) {
      const gateFeature =
        currentPlan === "premium" ? "premium_pro_interview" : "interview_limit";
      openUpgradeModal(gateFeature);
      addTranscript({
        role: "system",
        speaker: "System",
        text:
          currentPlan === "premium"
            ? `You have used all ${interviewCheck.limit} interviews this month. Upgrade to Premium Pro for unlimited voice interviews.`
            : `You have used all ${interviewCheck.limit} free interviews this month. Upgrade to Premium for 50 interviews per month.`,
      });
      return;
    }
    // Record this interview start so the usage counter increments correctly
    recordWorkZoInterviewStarted();
    fetch("/api/transcribe", { method: "OPTIONS" }).catch(() => undefined);

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
      const candidateAnswers = countCandidateAnswers(
        restoredSnapshot.transcript,
      );

      trackWorkZoFailureEvent(
        "interview_recovered_and_resumed",
        {
          role: restoredSnapshot.setup.targetRole,
          recruiter: restoredSnapshot.setup.recruiterName,
          transcriptItems: restoredSnapshot.transcript.length,
          questionIndex: restoredSnapshot.questionIndex,
        },
        "low",
      );

      setRecoveredSessionReady(false);
      recoveredSessionRef.current = null;
      recoverySnapshotRef.current = null;
      setRecoverySnapshot(null);
      setRecoveryNoticeDismissed(false);
      setPremiumVoiceError("");

      // Important: restored interviews must not auto-drop into browser TTS fallback.
      // Recovery restores state first; AI voice should reconnect only through the normal
      // premium voice path, and if it cannot reconnect we keep the interview idle.
      vapiFallbackStartedRef.current = false;
      vapiStartingRef.current = false;
      vapiConnectedRef.current = false;
      setPremiumVoiceStatus("idle");

      const nextQuestionIndex = Math.max(
        restoredSnapshot.questionIndex,
        Math.min(20, candidateAnswers + 1),
      );

      questionIndexRef.current = nextQuestionIndex;
      setQuestionIndex(nextQuestionIndex);

      const currentPlanForRestore = serverPlan;
      const restoreVapiEligible =
        currentPlanForRestore === "free" ||
        currentPlanForRestore === "premium" ||
        currentPlanForRestore === "premium_pro";
      if (
        restoreVapiEligible &&
        premiumVoiceEnabledRef.current &&
        audioEnabledRef.current
      ) {
        const reconnectedPremiumVoice = await startPremiumVoice(restoredSetup);

        if (reconnectedPremiumVoice) {
          addTranscript({
            role: "system",
            speaker: "System",
            text: "Interview restored. Live AI voice reconnected.",
          });
          setStatus("listening");
          return;
        }

        addTranscript({
          role: "system",
          speaker: "System",
          text: "Interview restored. Voice reconnect failed — continuing with browser voice.",
        });
        startBrowserFallbackInterview(restoredSetup);
        return;
      }

      addTranscript({
        role: "system",
        speaker: "System",
        text: "Interview restored. Tap Start to reconnect voice and continue.",
      });
      setStatus("idle");
      return;
    }

    const freshSetup = buildSetupFromStorage();
    interviewSessionIdRef.current = `workzo-session-${Date.now()}`;
    setSetup(freshSetup);
    setupRef.current = freshSetup;
    if (typeof window !== "undefined") {
      (
        window as unknown as {
          __workzoDisruptionMemory?: WorkZoDisruptionMemory;
        }
      ).__workzoDisruptionMemory = createWorkZoDisruptionMemory();
    }

    setWaitingRoomActive(true);
    setWaitingRoomStep(0);
    for (
      let stepIndex = 0;
      stepIndex <
      buildWorkZoWaitingRoomSteps(
        freshSetup as unknown as Record<string, unknown>,
      ).length;
      stepIndex += 1
    ) {
      setWaitingRoomStep(stepIndex);
      await new Promise((resolve) =>
        window.setTimeout(resolve, stepIndex === 0 ? 320 : 620),
      );
    }
    setWaitingRoomActive(false);

    if (recoverySnapshotRef.current) {
      trackWorkZoFailureEvent(
        "active_interview_replaced",
        {
          previousRole: recoverySnapshotRef.current.setup.targetRole,
          previousTranscriptItems:
            recoverySnapshotRef.current.transcript.length,
        },
        "low",
      );
    }

    clearActiveInterviewSnapshot();
    recoveredSessionRef.current = null;
    setRecoveredSessionReady(false);
    setRecoverySnapshot(null);
    setRecoveryNoticeDismissed(false);

    const sessionPersistResult = await persistInterviewSessionToDb("active");
    if (sessionPersistResult.blocked) {
      // Server-side limit reached — the client-side localStorage check at
      // the top of this function can be bypassed (clearing site data,
      // private window), but this cannot, since it's tied to the
      // authenticated user and DB-resolved plan. Stop the interview from
      // actually starting.
      const blockedPlan = sessionPersistResult.plan || serverPlan;
      const gateFeature =
        blockedPlan === "premium" ? "premium_pro_interview" : "interview_limit";
      openUpgradeModal(gateFeature);
      addTranscript({
        role: "system",
        speaker: "System",
        text:
          blockedPlan === "premium"
            ? `You've used all ${sessionPersistResult.limit} interviews this month. Upgrade to Premium Pro for unlimited voice interviews.`
            : `You've used all ${sessionPersistResult.limit} free interviews this month. Upgrade to Premium for 50 interviews per month.`,
      });
      setStatus("idle");
      return;
    }

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
    // Reset orphaned engine state
    const freshMemory = createWorkZoEmotionalMemory();
    setEmotionalMemory(freshMemory);
    emotionalMemoryRef.current = freshMemory;
    setRecruiterVisualState("waiting");
    setFillerWordCount(0);
    setShareableMoment(null);

    // ── Plan-gated voice routing ─────────────────────────────────────────────
    // Temporary launch setting:
    // Free:         Vapi voice → browser fallback on failure
    // Premium:      Vapi voice → browser fallback on failure
    // Premium Pro:  Vapi voice → browser fallback on failure  (Tavus handled separately)
    // currentPlan already declared above for the limit check — reuse it
    const isVapiEligible =
      currentPlan === "free" ||
      currentPlan === "premium" ||
      currentPlan === "premium_pro";

    if (
      isVapiEligible &&
      premiumVoiceEnabledRef.current &&
      audioEnabledRef.current
    ) {
      const startedPremiumVoice = await startPremiumVoice(freshSetup);

      if (startedPremiumVoice) {
        addTranscript({
          role: "system",
          speaker: "System",
          text: "Live AI voice connected.",
        });
        setStatus("listening");
        return;
      }

      // Vapi failed — fall back to browser voice automatically
      addTranscript({
        role: "system",
        speaker: "System",
        text: "Live AI voice unavailable. Switching to browser voice.",
      });
      startBrowserFallbackInterview(freshSetup);
      return;
    }

    // Safety fallback: if Vapi is disabled/unavailable, continue with browser voice instead of blocking the interview.
    startBrowserFallbackInterview(freshSetup);
  }, [
    addTranscript,
    planLoading,
    serverPlan,
    startBrowserFallbackInterview,
    startPremiumVoice,
    persistInterviewSessionToDb,
  ]);

  const saveInterviewResult = useCallback(
    (reason: "ended" | "paused" = "ended") => {
      if (typeof window === "undefined") return;
      const finalTranscript = transcript;

      const finalScore = scoreReady ? recruiterSignal : null;
      const verdict = buildInterviewVerdict(
        finalScore,
        recruiterMemoryRef.current,
      );
      const weakestMoment = findWeakestInterviewMoment(
        finalTranscript,
        recruiterMemoryRef.current,
      );
      const answerQuality = summarizeAnswerQuality(
        finalTranscript,
        setupRef.current,
      );

      persistCandidatePatterns(recruiterMemoryRef.current, setupRef.current);

      // Calculate speaking pace (WPM)
      const candidateWords = finalTranscript
        .filter((item) => item.role === "candidate")
        .reduce(
          (acc, item) =>
            acc + item.text.trim().split(/\s+/).filter(Boolean).length,
          0,
        );
      const durationMins = elapsed > 0 ? elapsed / 60 : 1;
      const averageWpm = Math.round(candidateWords / durationMins);

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
        averageWpm,
        fillerWordCount,
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
          averageWpm,
          fillerWordCount,
        },
      };

      try {
        const existingRaw = window.localStorage.getItem(
          "workzo_interview_results",
        );
        const existing = existingRaw ? JSON.parse(existingRaw) : [];
        const list = Array.isArray(existing) ? existing : [];

        window.localStorage.setItem(
          "workzo_interview_results",
          JSON.stringify([session, ...list].slice(0, 20)),
        );
        window.localStorage.setItem(
          "workzo_latest_interview_result",
          JSON.stringify(session),
        );
        persistInterviewSessionToDb("completed");
        persistInterviewResultToDb(session as unknown as Record<string, any>);
        clearActiveInterviewSnapshot();

        // Detect shareable moment for post-session social card
        const shareable = detectShareableMoment({
          trust: session.score?.trust ?? 0,
          pressure: recruiterMemoryRef.current.unsupportedClaims > 0 ? 80 : 40,
          contradiction:
            session.memory.patterns.find((p) =>
              p.toLowerCase().includes("unsupported"),
            ) || "",
        });
        if (shareable.shouldHighlight) {
          setShareableMoment({
            title: shareable.shareTitle,
            text: shareable.shareText,
            category: shareable.category,
          });
          window.localStorage.setItem(
            "workzo_shareable_moment",
            JSON.stringify(shareable),
          );
        }

        trackWorkZoInterviewEvent("interview_completed", {
          reason,
          role: session.targetRole,
          recruiter: session.recruiterName,
          durationSeconds: session.durationSeconds,
          score: session.score?.overall ?? null,
          trust: session.score?.trust ?? null,
          verdict: session.verdict?.decision ?? "",
          answers: session.transcript.filter(
            (item) => item.role === "candidate",
          ).length,
        });

        trackWorkZoInterviewEvent("interview_saved", {
          reason,
          role: session.targetRole,
          recruiter: session.recruiterName,
          durationSeconds: session.durationSeconds,
          score: session.score?.overall ?? null,
          trust: session.score?.trust ?? null,
          verdict: session.verdict?.decision ?? "",
          answers: session.transcript.filter(
            (item) => item.role === "candidate",
          ).length,
        });
      } catch (error) {
        trackWorkZoErrorEvent(
          "interview_save_failed",
          error,
          {
            role: setupRef.current.targetRole,
            recruiter: setupRef.current.recruiterName,
          },
          "high",
        );
      }
    },
    [
      elapsed,
      recruiterSignal,
      recruiterMemory,
      scoreReady,
      transcript,
      persistInterviewResultToDb,
      persistInterviewSessionToDb,
    ],
  );

  const endInterview = useCallback(() => {
    window.setTimeout(() => {
      window.location.href = "/results";
    }, 250);

    listeningRef.current = false;
    try {
      recognitionRef.current?.stop?.();
    } catch {}
    if (typeof window !== "undefined") window.speechSynthesis.cancel();

    setStatus("ended");

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

  // ── Graceful, engine-agnostic interview completion ──────────────────────
  // BUG FIXED: there was no automatic completion logic anywhere. The
  // question counter visually caps at "12 of 12" (Math.min(value + 1, 12)),
  // but nothing was ever wired to actually END the interview when reached —
  // confirmed from live testing where the interview kept running
  // indefinitely past 12/12 until the candidate manually clicked "Exit
  // Interview." This watches the transcript content itself rather than
  // hooking into any one engine's reply path, so it works identically
  // whether the recruiter is the GPT-4o text engine, the browser-STT
  // fallback, OR live Vapi voice — all three write into the same
  // `transcript` state via addTranscript.
  //
  // Trigger: once the recruiter has asked the closing "do you have any
  // questions for me" invitation AND the candidate has given their next
  // response to it, the interview wraps up with a warm closing line and
  // then ends — not abruptly mid-question, and not by silently looping
  // forever. This deliberately waits for that full exchange (rather than
  // cutting off the instant question 12 is reached) specifically so an
  // in-progress answer is never cut off unfinished.
  const closingInvitationSeenRef = useRef(false);
  const closingHandledRef = useRef(false);
  // Backstop: the closing invitation is the preferred trigger, but a
  // conversation can get stuck (e.g. an extended CV-verification loop that
  // never naturally progresses to closing — confirmed from live testing).
  // Counts candidate turns that happen once the question count is already
  // capped at 12, without a closing invitation showing up. After a
  // generous number of extra turns, force the same graceful wrap-up rather
  // than risk running forever.
  const turnsPastCapRef = useRef(0);
  const TURNS_PAST_CAP_BEFORE_FORCED_CLOSE = 10;

  useEffect(() => {
    if (closingHandledRef.current) return;
    if (status === "idle" || status === "ended") return;
    if (transcript.length === 0) return;

    const last = transcript[transcript.length - 1];

    if (last.role === "recruiter") {
      // Detect any natural closing or wrap-up language from the recruiter.
      // This covers both the structured browser-engine closing invitation
      // ("do you have any questions") and the freeform Vapi recruiter phrases
      // ("that covers everything", "thank you for your time", "we'll be in
      // touch", "best of luck", etc.). Broad matching ensures the closing
      // exchange is detected regardless of how each recruiter persona words it.
      const isClosingInvitation =
        /do you have any questions|any questions for me|questions about the role|questions for me before we wrap/i.test(last.text);
      const isNaturalWrapUp =
        /thank you for your time|thanks for your time|that('s| is) all (from my|on my) side|that covers everything|we'?ll (be in touch|follow up|reach out|get back|email|call)|best of luck|good luck with|look forward to (speaking|talking|connecting)|have a (great|good|wonderful) day|take care|bye/i.test(last.text);

      if (isClosingInvitation || isNaturalWrapUp) {
        closingInvitationSeenRef.current = true;
        return;
      }
    }

    const candidateExchangeAfterInvitation =
      closingInvitationSeenRef.current && last.role === "candidate";
    const forcedCloseDueToStuckLoop =
      !closingInvitationSeenRef.current &&
      last.role === "candidate" &&
      questionIndexRef.current >= 18 &&
      (turnsPastCapRef.current += 1) >= TURNS_PAST_CAP_BEFORE_FORCED_CLOSE;

    if (candidateExchangeAfterInvitation || forcedCloseDueToStuckLoop) {
      closingHandledRef.current = true;
      closingInvitationSeenRef.current = false;

      // Stop the normal listen/reply loop before speaking the closing line —
      // speakRecruiter's TTS completion callbacks check this flag before
      // re-arming the mic, so this must come first.
      stopRequestedRef.current = true;
      stopListening();

      // Build a personalised closing line using the recruiter's name and
      // the candidate's first name. Always spoken — never a silent navigation.
      const recruiterFirstName = (setupRef.current.recruiterName || "").split(" ")[0] || "I";
      const candidateFirst = safeFirstName(setupRef.current.candidateName);
      const closingLine = candidateFirst
        ? `That brings us to the end of our session, ${candidateFirst}. Thank you so much for your time today — it was great learning more about your background. We'll be in touch soon with next steps. Take care!`
        : `That brings us to the end of our session. Thank you so much for your time today — it was a pleasure. We'll be in touch soon with next steps. Take care!`;

      addTranscript({
        role: "recruiter",
        speaker: `${setupRef.current.recruiterName} · ${setupRef.current.recruiterTitle}`,
        text: closingLine,
      });

      if (audioEnabledRef.current && status !== "recruiter-speaking") {
        speakRecruiter(closingLine);
        // Wait for TTS to finish before navigating — closing line is ~15 words,
        // roughly 6–8 seconds at normal speech pace.
        window.setTimeout(() => { endInterview(); }, 9000);
      } else {
        window.setTimeout(() => { endInterview(); }, 4000);
      }
    }
  }, [
    transcript,
    status,
    speakRecruiter,
    addTranscript,
    endInterview,
    stopListening,
  ]);

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


  // ── Keyboard shortcuts ────────────────────────────────────────────────
  // Space = Push to Talk, R = Repeat last question
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      if (e.code === "Space" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        toggleMic();
        return;
      }

      if ((e.key === "r" || e.key === "R") && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const last = [...transcript].reverse().find((t) => t.role === "recruiter");
        if (last?.text) speakRecruiter(last.text);
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleMic, speakRecruiter, transcript]);

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

    trackWorkZoFailureEvent(
      "state_recovery_used",
      {
        role: snapshot.setup.targetRole,
        recruiter: snapshot.setup.recruiterName,
        transcriptItems: snapshot.transcript.length,
        questionIndex: snapshot.questionIndex,
      },
      "low",
    );

    // Do not auto-start after restore. Auto-start was forcing the restored session
    // into browser TTS fallback on some devices. The user can tap Start to reconnect
    // AI voice through the normal voice path.
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

    trackWorkZoFailureEvent(
      "state_recovery_discarded",
      {
        role: snapshot?.setup.targetRole || setupRef.current.targetRole,
        transcriptItems: snapshot?.transcript.length || 0,
      },
      "low",
    );
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
          <section className="w-full max-w-md rounded-lg border border-white/10 bg-white/[0.03] p-6 shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-lg border border-blue-300/20 bg-blue-400/10">
                <Mic className="h-7 w-7 text-blue-200" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">
                  Preparing interview room
                </p>
                <h1 className="mt-1 text-2xl font-black">
                  Preparing your interview room…
                </h1>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="h-3 w-3/4 animate-pulse rounded-full bg-white/10" />
              <div className="h-3 w-1/2 animate-pulse rounded-full bg-white/10" />
              <div className="min-h-[220px] animate-pulse rounded-lg border border-white/10 bg-black/20" />
            </div>

            <p className="mt-5 text-base leading-6 text-white leading-7 font-medium">
              Setting up your recruiter, CV context, and interview
              configuration.
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#050b14] text-white lg:h-screen lg:overflow-hidden">
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
              <span
                className={`hidden rounded-full border px-2.5 py-1 text-xs font-black uppercase sm:block ${recruiterStatusTone(recruiterSignal, scoreReady)}`}
              >
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
                <PremiumUsageBadge compact />
                End
              </button>
            )}

            <button
              onClick={() => setAudioEnabled((value) => !value)}
              className="hidden h-10 w-12 place-items-center rounded-xl border border-white/10 bg-white/[0.03] sm:grid"
            >
              <Volume2
                className={`h-5 w-5 ${audioEnabled ? "" : "text-slate-200"}`}
              />
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
                <div className="absolute right-0 top-12 z-50 max-h-[min(620px,calc(100vh-108px))] w-[320px] overflow-y-auto rounded-lg workzo-hide-scrollbar border border-white/10 bg-[#091323]/95 p-4 shadow-2xl backdrop-blur-xl">
                  <div className="mb-3">
                    <p className="text-sm font-black text-white">
                      Interview Settings
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Adjust only this interview room.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {/* Technical Mode toggle — premium only */}
                    {premiumUnlocked && (
                      <section>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-violet-200">
                            Technical Mode
                          </p>
                          <span className="rounded-full border border-violet-300/20 bg-violet-400/10 px-2 py-0.5 text-[10px] font-black text-violet-200">
                            Premium
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTechnicalMode((v) => !v)}
                          className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition ${
                            technicalMode
                              ? "border-violet-400/30 bg-violet-500/10"
                              : "border-white/10 bg-white/[0.03]"
                          }`}
                        >
                          <div>
                            <p className="text-xs font-black text-white">
                              💻 Code workspace
                            </p>
                            <p className="mt-0.5 text-[10px] leading-4 text-slate-400">
                              Show a live code editor. The recruiter reacts to
                              your code.
                            </p>
                          </div>
                          <span
                            className={`ml-3 shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${
                              technicalMode
                                ? "bg-violet-400/20 text-violet-200"
                                : "bg-white/10 text-slate-500"
                            }`}
                          >
                            {technicalMode ? "On" : "Off"}
                          </span>
                        </button>
                      </section>
                    )}
                    <section>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-200">
                          Recruiter
                        </p>
                        {!premiumUnlocked ? (
                          <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-0.5 text-[10px] font-black text-amber-200">
                            Premium available
                          </span>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {(
                          [
                            {
                              id: "friendly_hr",
                              name: "Sarah Chen",
                              label: "Talent Partner",
                              premium: false,
                            },
                            {
                              id: "analytical_hiring_manager",
                              name: "Daniel Reed",
                              label: "Hiring Manager",
                              premium: false,
                            },
                            {
                              id: "startup_recruiter",
                              name: "Priya Raman",
                              label: "Startup Lead",
                              premium: true,
                            },
                            {
                              id: "german_corporate",
                              name: "Markus Weber",
                              label: "Corporate Lead",
                              premium: true,
                            },
                          ] as const
                        ).map((recruiter) => {
                          const locked = recruiter.premium && !premiumUnlocked;
                          const selected =
                            setup.recruiterName === recruiter.name ||
                            setup.recruiterId === recruiter.id;

                          return (
                            <button
                              key={recruiter.id}
                              type="button"
                              onClick={() => {
                                if (locked) {
                                  handlePremiumGateClick(
                                    `recruiter_${recruiter.name.toLowerCase()}`,
                                  );
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
                                {locked ? (
                                  <span className="text-[10px] text-amber-200">
                                    PRO
                                  </span>
                                ) : null}
                              </span>
                              <span className="mt-0.5 block text-[11px] font-semibold text-slate-200">
                                {recruiter.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </section>

                    <section>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-200">
                          Interview Atmosphere
                        </p>
                        {!premiumUnlocked ? (
                          <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-0.5 text-[10px] font-black text-amber-200">
                            Premium pressure
                          </span>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {(
                          [
                            "Supportive",
                            "Realistic",
                            "Challenging",
                            "Brutal",
                          ] as const
                        ).map((style) => {
                          const locked =
                            (style === "Challenging" || style === "Brutal") &&
                            !premiumUnlocked;

                          return (
                            <button
                              key={style}
                              type="button"
                              onClick={() => {
                                if (locked) {
                                  handlePremiumGateClick(
                                    `atmosphere_${style.toLowerCase()}`,
                                  );
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
                                {locked ? (
                                  <span className="text-[10px] text-amber-200">
                                    PRO
                                  </span>
                                ) : null}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {!premiumUnlocked ? (
                        <p className="mt-2 rounded-xl border border-amber-300/15 bg-amber-400/[0.06] p-2 text-xs leading-5 text-amber-100/80">
                          Free interviews include Sarah, Daniel, Supportive, and
                          Realistic. Premium unlocks Priya, Markus, Challenging,
                          and Brutal interview pressure.
                        </p>
                      ) : null}
                    </section>

                    <section className="space-y-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-200">
                        Voice Settings
                      </p>
                      <button
                        type="button"
                        onClick={() => setAudioEnabled((value) => !value)}
                        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm"
                      >
                        <span>Voice On/Off</span>
                        <span className="text-slate-400">
                          {audioEnabled ? "On" : "Off"}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPremiumVoiceEnabled((value) => !value)
                        }
                        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm"
                      >
                        <span>Live AI voice</span>
                        <span className="text-slate-400">
                          {premiumVoiceEnabled ? "On" : "Off"}
                        </span>
                      </button>
                      <label className="block rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm">
                        <div className="mb-2 flex items-center justify-between">
                          <span>Voice Speed</span>
                          <span className="text-slate-400">
                            {voiceSpeed.toFixed(2)}x
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.70"
                          max="1.00"
                          step="0.03"
                          value={voiceSpeed}
                          onChange={(event) =>
                            setVoiceSpeed(Number(event.target.value))
                          }
                          className="w-full"
                        />
                      </label>
                    </section>

                    <section className="space-y-2">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-200">
                        Transcript
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowTranscript((value) => !value)}
                        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm workzo-transcript-panel"
                      >
                        <span>
                          {showTranscript
                            ? "Hide Transcript"
                            : "Show Live Transcript"}
                        </span>
                        <span className="text-slate-400">
                          {showTranscript ? "On" : "Off"}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setAutoScrollTranscript((value) => !value)
                        }
                        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm workzo-transcript-body"
                      >
                        <span>Auto-scroll Transcript</span>
                        <span className="text-slate-400">
                          {autoScrollTranscript ? "On" : "Off"}
                        </span>
                      </button>
                    </section>

                    <section
                      style={{ display: showCopilot ? undefined : "none" }}
                      className="rounded-lg border border-white/10 bg-[#0b1527] p-3.5 overflow-visible"
                    >
                      <div className="flex items-center justify-between">
                        <h2 className="text-base font-black text-blue-300">
                          Live Copilot
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
                          <p
                            className={`mt-0.5 text-base font-black ${recruiterMoodColor(recruiterSignal.mood)}`}
                          >
                            {scoreReady ? recruiterSignal.mood : "Waiting"}
                          </p>
                        </div>
                        <div className="text-right text-[11px] text-slate-300">
                          <p>
                            Trust{" "}
                            <span className="font-bold text-white">
                              {scoreReady ? recruiterSignal.trust : "—"}
                            </span>
                          </p>
                          <p>
                            Interest{" "}
                            <span className="font-bold text-white">
                              {scoreReady ? recruiterSignal.interest : "—"}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="mt-2 rounded-xl border border-emerald-300/15 bg-emerald-400/[0.07] px-3 py-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">
                          Say next
                        </p>
                        <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-slate-100">
                          {scoreReady
                            ? recruiterSignal.trust < 60
                              ? "Clarify the claim, then give one verified example."
                              : "Give one specific example with a clear result."
                            : "Answer with one clear, role-relevant example."}
                        </p>
                      </div>

                      <div className="mt-2 rounded-xl border border-amber-300/15 bg-amber-400/[0.07] px-3 py-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-200">
                          Recruiter concern
                        </p>
                        <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-slate-100">
                          {scoreReady
                            ? recruiterMemory.liveNote ||
                              recruiterSignal.concern
                            : "Waiting for evidence, ownership, and measurable impact."}
                        </p>
                        {recruiterMemory.patterns.length ? (
                          <p className="mt-1 line-clamp-1 text-[11px] text-amber-100/80">
                            Patterns detected:{" "}
                            {
                              recruiterMemory.patterns[
                                recruiterMemory.patterns.length - 1
                              ]
                            }
                          </p>
                        ) : null}
                      </div>

                      <div className="mt-2 rounded-xl border border-blue-300/15 bg-blue-400/[0.07] px-3 py-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-200">
                          Live recruiter thoughts
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {liveRecruiterThoughts.map((thought) => (
                            <span
                              key={thought}
                              className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-slate-200"
                            >
                              {thought}
                            </span>
                          ))}
                        </div>
                      </div>
                    </section>

                    <section className="space-y-2">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-200">
                        Interview Controls
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={stopListening}
                          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm font-bold text-slate-200"
                        >
                          Pause
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            speakRecruiter(
                              getRecruiterQuestions(setupRef.current)[Math.max(0, questionIndex)],
                            )
                          }
                          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm font-bold text-slate-200"
                        >
                          Restart question
                        </button>
                      </div>
                    </section>

                    <section>
                      <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-200">
                        Accessibility
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm font-bold text-slate-200"
                        >
                          Larger text
                        </button>
                        <button
                          type="button"
                          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm font-bold text-slate-200"
                        >
                          High contrast
                        </button>
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
                <div className="absolute right-0 top-12 z-50 w-52 rounded-lg border border-white/10 bg-[#091323]/95 p-2 shadow-2xl backdrop-blur-xl">
                  {[
                    "Take Notes",
                    "Report Issue",
                    "Help Center",
                    "Exit Interview",
                  ].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={
                        item === "Exit Interview" ? endInterview : undefined
                      }
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-200 hover:bg-white/[0.06]"
                    >
                      {item}
                      <ChevronRight className="h-4 w-4 text-slate-200" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {shareableMoment && status !== "idle" ? (
          <div className="mx-3 mt-2 flex items-center justify-between gap-3 rounded-lg border border-violet-300/20 bg-violet-500/[0.08] px-4 py-2.5 lg:mx-4">
            <div className="min-w-0">
              <p className="text-xs font-black text-violet-200">
                {shareableMoment.title}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-400">
                {shareableMoment.text}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => {
                  if (typeof navigator !== "undefined" && navigator.share) {
                    void navigator.share({
                      title: shareableMoment.title,
                      text: `${shareableMoment.text} — Practice interview on WorkZo AI`,
                    });
                  } else if (typeof navigator !== "undefined") {
                    void navigator.clipboard.writeText(
                      `${shareableMoment.text} — Practice interview on WorkZo AI`,
                    );
                  }
                }}
                className="rounded-xl bg-violet-500 px-3 py-1.5 text-xs font-black text-white hover:bg-violet-400"
              >
                Share
              </button>
              <button
                type="button"
                onClick={() => setShareableMoment(null)}
                className="text-slate-400 hover:text-white text-xs px-2"
              >
                ✕
              </button>
            </div>
          </div>
        ) : null}

        {recoverySnapshot && !recoveryNoticeDismissed && status === "idle" ? (
          <section className="mx-3 mt-3 rounded-lg border border-amber-300/25 bg-amber-400/10 p-4 text-amber-50 lg:mx-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black">Resume previous interview?</p>
                <p className="mt-1 text-xs leading-5 text-amber-100/80">
                  Role: {recoverySnapshot.setup.targetRole || "Interview Role"}{" "}
                  · Recruiter:{" "}
                  {recoverySnapshot.setup.recruiterName || "AI Recruiter"} ·{" "}
                  {getRecoveryProgressLabel(recoverySnapshot)} ·{" "}
                  {getRecoverySavedLabel(recoverySnapshot)}
                </p>
                <p className="mt-1 text-xs leading-5 text-amber-100/70">
                  Click Resume Interview to restore the transcript, trust score,
                  recruiter memory, and continue from the last saved question.
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

        {/* First-time user hint — shown once, dismissed permanently */}
        {showFirstTimeHint && (
          <div className="mx-4 mt-3 flex items-start gap-3 rounded-lg border border-blue-400/20 bg-blue-400/[0.06] px-4 py-3">
            <span className="mt-0.5 shrink-0 text-base text-blue-300">💡</span>
            <p className="flex-1 text-xs leading-5 text-blue-200">
              The recruiter will ask questions — respond as you would in a real
              interview. Speak naturally, then pause. WorkZo listens
              automatically.
            </p>
            <button
              type="button"
              onClick={dismissFirstTimeHint}
              aria-label="Dismiss hint"
              className="ml-2 shrink-0 text-white/30 transition hover:text-white/70"
            >
              ✕
            </button>
          </div>
        )}

        {/* Technical mode: show code panel between recruiter video and sidebar */}
        {technicalMode && premiumUnlocked && (
          <div className="border-b border-white/[0.06] bg-[#060d18] px-4 pb-3 pt-2">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-violet-400">
              Code Workspace · Technical Mode
            </p>
            <div className="h-[340px] lg:h-[420px]">
              <CodePanel onCodeChange={handleCodeChange} />
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 overflow-x-hidden lg:min-h-0 lg:h-full lg:grid-cols-[200px_1fr_320px] lg:overflow-hidden">

          {/* ── LEFT SIDEBAR: Interview flow + tips ── */}
          <aside className="hidden border-r border-white/[0.07] bg-[#040810] lg:flex lg:flex-col lg:min-h-0 lg:overflow-y-auto">
            {/* Interview flow steps */}
            <div className="p-4 border-b border-white/[0.07]">
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-600">Interview flow</p>
              <div className="mt-3 space-y-1">
                {[
                  { n: 1, label: "Introduction", done: questionIndex >= 1 },
                  { n: 2, label: "Background", done: questionIndex >= 3 },
                  { n: 3, label: "Experience", done: questionIndex >= 6, active: questionIndex >= 3 && questionIndex < 6 },
                  { n: 4, label: "Skills", done: questionIndex >= 9, active: questionIndex >= 6 && questionIndex < 9 },
                  { n: 5, label: "Strengths", done: questionIndex >= 12, active: questionIndex >= 9 && questionIndex < 12 },
                  { n: 6, label: "Closing", done: false, active: questionIndex >= 12 },
                ].map((step) => (
                  <div key={step.n} className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs transition",
                    step.done ? "text-emerald-300" : step.active ? "bg-blue-500/10 text-blue-200 font-black" : "text-slate-600"
                  )}>
                    <span className={cn(
                      "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[9px] font-black border",
                      step.done ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-300" :
                      step.active ? "border-blue-400/40 bg-blue-500/20 text-blue-300" :
                      "border-white/[0.08] text-slate-600"
                    )}>
                      {step.done ? "✓" : step.n}
                    </span>
                    <span className="font-bold">{step.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Interview tips */}
            <div className="p-4 border-b border-white/[0.07]">
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-600 mb-3">Tips</p>
              <div className="space-y-2">
                {[
                  "Use the STAR method",
                  "Be specific with examples",
                  "Quantify your impact",
                  "Stay focused and concise",
                ].map((tip) => (
                  <div key={tip} className="flex items-start gap-2 text-xs text-slate-500">
                    <span className="mt-0.5 text-emerald-500">✓</span>
                    {tip}
                  </div>
                ))}
              </div>
            </div>

            {/* Keyboard shortcuts */}
            <div className="p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-600 mb-3">Shortcuts</p>
              <div className="space-y-2">
                {[
                  { key: "Space", label: "Push to talk" },
                  { key: "R", label: "Repeat question" },
                  { key: "T", label: "Toggle transcript" },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span>{label}</span>
                    <kbd className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-black text-slate-400">{key}</kbd>
                  </div>
                ))}
              </div>
            </div>

            {/* Connection status at bottom */}
            <div className="mt-auto border-t border-white/[0.07] p-4">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Connection good
              </div>
            </div>
          </aside>

          <div className="flex flex-col lg:h-full lg:min-h-0">
            <section className="relative shrink-0 overflow-hidden bg-[#08101c] h-[300px] sm:h-[360px] lg:h-[50%] lg:min-h-[260px] lg:max-h-[460px]">
              <div className="absolute inset-x-[18%] bottom-8 top-6 rounded-full bg-blue-500/20 blur-3xl" />
              <div className="absolute inset-0">
                <Image
                  src={setup.recruiterImage}
                  alt={`${setup.recruiterName}, interview recruiter`}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 850px"
                  className="object-cover"
                  style={{ objectPosition: recruiterImagePosition }}
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/86 via-black/10 to-black/0" />

              {waitingRoomActive ? (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#050b14]/80 p-4 backdrop-blur-md">
                  <div className="w-full max-w-xl rounded-xl border border-white/10 bg-[#0b1527]/95 p-5 shadow-2xl">
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-200">
                      Interview waiting room
                    </p>
                    <h2 className="mt-2 text-xl font-black text-white">
                      {simulationPersona.name} is preparing your interview
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {simulationPersona.openingFrame}
                    </p>
                    <div className="mt-5 space-y-3">
                      {waitingRoomSteps.map((step, index) => {
                        const active = index === waitingRoomStep;
                        const done = index < waitingRoomStep;
                        return (
                          <div
                            key={step.label}
                            className={`rounded-lg border p-3 transition ${active ? "border-blue-300/35 bg-blue-500/10" : done ? "border-emerald-300/25 bg-emerald-500/10" : "border-white/10 bg-white/[0.03]"}`}
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={`grid h-7 w-7 place-items-center rounded-full text-xs font-black ${done ? "bg-emerald-400 text-slate-950" : active ? "bg-blue-400 text-slate-950 animate-pulse" : "bg-white/10 text-slate-400"}`}
                              >
                                {done ? "✓" : index + 1}
                              </span>
                              <div>
                                <p className="text-sm font-black text-white">
                                  {step.label}
                                </p>
                                <p className="mt-0.5 text-xs leading-5 text-slate-400">
                                  {step.detail}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Recruiter visual state overlay — powered by workzoPremiumExperienceEngine */}
              {recruiterVisualState !== "waiting" &&
                recruiterVisualState !== "listening" &&
                status !== "idle" && (
                  <div
                    className={`absolute left-1/2 top-[28%] -translate-x-1/2 rounded-full border px-4 py-1.5 text-xs font-black backdrop-blur-sm transition-all duration-500 ${
                      recruiterVisualState === "skeptical"
                        ? "border-amber-300/30 bg-amber-400/20 text-amber-200"
                        : recruiterVisualState === "interested"
                          ? "border-emerald-300/30 bg-emerald-400/20 text-emerald-200"
                          : recruiterVisualState === "interrupting"
                            ? "border-red-300/40 bg-red-500/25 text-red-200 animate-pulse"
                            : recruiterVisualState === "typing_notes"
                              ? "border-blue-300/30 bg-blue-400/20 text-blue-200"
                              : recruiterVisualState === "thinking"
                                ? "border-slate-300/20 bg-slate-400/15 text-slate-300"
                                : "border-white/10 bg-black/30 text-slate-300"
                    }`}
                  >
                    {recruiterVisualState === "skeptical" && "🤔 Sceptical"}
                    {recruiterVisualState === "interested" && "✓ Interested"}
                    {recruiterVisualState === "interrupting" && "✋ Hold on"}
                    {recruiterVisualState === "typing_notes" &&
                      "📝 Taking notes"}
                    {recruiterVisualState === "thinking" && "Thinking..."}
                  </div>
                )}

              <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-black/50 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-emerald-300 backdrop-blur-sm">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(52,211,153,0.9)]" />{" "}
                {waitingRoomActive
                  ? "CONNECTING"
                  : status === "recruiter-speaking"
                    ? "SPEAKING"
                    : status === "listening"
                      ? "LISTENING"
                      : status === "thinking"
                        ? "THINKING"
                        : "READY"}
                {status === "recruiter-speaking" && (
                  <button
                    type="button"
                    onClick={stopRecruiterSpeaking}
                    className="ml-3 inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-0.5 text-[11px] font-black uppercase tracking-wider text-amber-300 ring-1 ring-amber-400/30 transition hover:bg-amber-400/25 active:scale-95"
                    aria-label="Interrupt recruiter"
                  >
                    ✋ Interrupt
                  </button>
                )}
              </div>

              {/* Recruiter visual state overlay — emotional reaction ring */}
              {scoreReady &&
                recruiterVisualState !== "waiting" &&
                recruiterVisualState !== "listening" && (
                  <div
                    className={`absolute inset-0 pointer-events-none transition-all duration-700 ${
                      recruiterVisualState === "interested"
                        ? "ring-4 ring-inset ring-emerald-400/45"
                        : recruiterVisualState === "skeptical"
                          ? "ring-4 ring-inset ring-amber-400/45"
                          : recruiterVisualState === "interrupting"
                            ? "ring-[6px] ring-inset ring-red-500/60"
                            : recruiterVisualState === "typing_notes"
                              ? "ring-4 ring-inset ring-blue-400/35"
                              : ""
                    }`}
                  />
                )}
              {/* Recruiter reaction bubble */}
              {scoreReady &&
                liveReactionText &&
                recruiterVisualState !== "waiting" &&
                recruiterVisualState !== "listening" && (
                  <div
                    className={`absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap rounded-lg border px-4 py-2 text-xs font-black shadow-2xl backdrop-blur-md z-10 transition-all duration-300 ${
                      recruiterVisualState === "interested"
                        ? "border-emerald-300/25 bg-emerald-950/80 text-emerald-200"
                        : recruiterVisualState === "interrupting"
                          ? "border-red-300/25 bg-red-950/85 text-red-200"
                          : recruiterVisualState === "skeptical"
                            ? "border-amber-300/25 bg-amber-950/80 text-amber-200"
                            : "border-white/10 bg-black/70 text-slate-200"
                    }`}
                  >
                    {liveReactionText}
                  </div>
                )}

              {premiumVoiceError ? (
                <div className="absolute right-4 top-5 hidden max-w-[320px] rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100 lg:block">
                  {premiumVoiceError}
                </div>
              ) : null}

              <div className="absolute bottom-[4.5rem] left-5">
                <div className="flex items-center gap-2 text-lg font-black">
                  {setup.recruiterName}
                  <CheckCircle2 className="h-5 w-5 fill-blue-500 text-blue-500" />
                </div>
                <p className="mt-1 truncate text-xs text-white/80 sm:text-sm">
                  {setup.recruiterTitle}
                </p>
                <p className="mt-2 text-xs font-bold text-emerald-200">
                  {waitingRoomActive
                    ? "Reviewing your resume"
                    : scoreReady
                      ? recruiterStatus
                      : "Ready for first answer"}
                </p>
              </div>

            </section>

            <section
              className="border-t border-white/[0.08] bg-[#05090f] flex flex-col lg:flex-1 lg:min-h-0 lg:overflow-hidden"
              id="workzo-transcript-section"
            >
              <button
                type="button"
                onClick={() => {
                  setShowTranscript((value) => {
                    const next = !value;
                    if (next) {
                      // Without this, the transcript can be technically
                      // "shown" but sit entirely below the visible
                      // viewport on phones, since the video panel above it
                      // already consumes most of a typical mobile screen.
                      window.setTimeout(() => {
                        document
                          .getElementById("workzo-transcript-section")
                          ?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                      }, 50);
                    }
                    return next;
                  });
                }}
                className="flex h-11 w-full items-center justify-between border-b border-white/[0.07] px-5 text-left"
                aria-expanded={showTranscript}
              >
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-black text-slate-200">
                    Transcript
                  </h2>
                  <span className="h-2 w-2 rounded-full bg-red-400" />
                  <span className="text-base text-white leading-7 font-medium">
                    {transcriptMessageCount} message
                    {transcriptMessageCount === 1 ? "" : "s"}
                  </span>
                </div>
                <span className="text-[10px] font-black text-slate-500 lg:hidden">
                  {showTranscript ? "▲" : "▼"}
                </span>
              </button>

              {showTranscript ||
              (typeof window !== "undefined" && window.innerWidth >= 1024) ? (
                <>
                  <div className="hidden h-10 items-center justify-end border-b border-white/10 px-5 sm:flex">
                    <div className="flex items-center gap-3 text-base text-white leading-7 font-medium">
                      Auto-scroll
                      <button
                        type="button"
                        onClick={() =>
                          setAutoScrollTranscript((value) => !value)
                        }
                        className={`relative h-5 w-9 rounded-full ${autoScrollTranscript ? "bg-blue-500" : "bg-white/15"}`}
                      >
                        <span
                          className={`absolute top-1 h-3 w-3 rounded-full bg-white transition ${autoScrollTranscript ? "right-1" : "left-1"}`}
                        />
                      </button>
                    </div>
                  </div>

                  <div
                    className="overflow-y-auto px-4 py-1 lg:flex-1 lg:min-h-0 workzo-hide-scrollbar"
                    style={{ maxHeight: "100%" }}
                  >
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
                            <span className="leading-6 text-slate-100 max-sm:line-clamp-none sm:line-clamp-2">
                              {line.text}
                            </span>
                          </div>
                        ))}

                        {interimText ? (
                          <div className="grid grid-cols-[80px_150px_1fr] gap-3 py-1 text-sm opacity-70 max-sm:grid-cols-1 max-sm:gap-1">
                            <span className="text-slate-400">listening</span>
                            <span className="font-semibold text-blue-300">
                              You
                            </span>
                            <span className="leading-6 text-slate-100">
                              {interimText}
                            </span>
                          </div>
                        ) : null}

                        <div ref={transcriptEndRef} />
                      </div>
                    ) : (
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-base leading-6 text-white leading-7 font-medium">
                        <p className="font-bold text-slate-100">
                          Interview transcript will appear here.
                        </p>
                        <p className="mt-1">
                          The recruiter will ask the first question after you
                          press Start.
                        </p>
                        <div ref={transcriptEndRef} />
                      </div>
                    )}
                  </div>

                  <div className="flex min-h-9 flex-wrap items-center justify-between gap-2 border-t border-white/10 px-4 py-1.5 text-xs text-slate-400 sm:px-5">
                    <span>AI-generated transcript — may contain errors.</span>
                    <button
                      onClick={() => setTranscript([])}
                      className="hover:text-white"
                    >
                      Clear Transcript
                    </button>
                  </div>
                </>
              ) : (
                <div className="px-4 py-3 text-base text-white sm:px-5 leading-7 font-medium">
                  Transcript will appear here as the recruiter and candidate
                  speak.
                </div>
              )}
            </section>

            {/* ── BOTTOM CONTROLS BAR — settings removed (in header), progress removed (in right panel) ── */}
            <div className="hidden lg:flex shrink-0 items-center justify-center gap-6 border-t border-white/[0.08] bg-[#04080f] px-6 py-2.5">
              <button
                type="button"
                onClick={() => {
                  const last = [...transcript].reverse().find(t => t.role === "recruiter");
                  if (last?.text) speakRecruiter(last.text);
                }}
                className="flex flex-col items-center gap-1 text-slate-500 hover:text-slate-300 transition"
                title="Repeat last question (R)"
              >
                <div className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/[0.04]">
                  <RotateCcw className="h-3.5 w-3.5" />
                </div>
                <span className="text-[9px] font-black uppercase tracking-wide">Repeat</span>
              </button>

              <button
                onClick={toggleMic}
                className="flex flex-col items-center gap-1 transition group"
              >
                <div className={`grid h-12 w-12 place-items-center rounded-full shadow-2xl transition-all active:scale-95 ${
                  status === "listening"
                    ? "bg-blue-500 text-white ring-4 ring-blue-400/30 shadow-[0_0_24px_rgba(59,130,246,0.4)]"
                    : "bg-white text-slate-950 hover:bg-blue-50"
                }`}>
                  {status === "listening" ? (
                    <MicOff className="h-5 w-5" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </div>
                <span className="text-[9px] font-black uppercase tracking-wide text-slate-400 group-hover:text-white transition">
                  {status === "listening" ? "Stop" : "Push to Talk"}
                  {status !== "listening" && <span className="ml-1 text-slate-600">(Space)</span>}
                </span>
              </button>

              <button
                onClick={endInterview}
                className="flex flex-col items-center gap-1 text-slate-500 hover:text-red-400 transition group"
                title="End interview"
              >
                <div className="grid h-8 w-8 place-items-center rounded-full border border-red-500/30 bg-red-500/10 text-red-400 transition group-hover:bg-red-500/20">
                  <PhoneOff className="h-3.5 w-3.5" />
                </div>
                <span className="text-[9px] font-black uppercase tracking-wide">End</span>
              </button>
            </div>

          </div>

          <aside className="flex flex-col gap-0 border-l border-white/[0.07] lg:min-h-0 lg:overflow-y-auto">
            <section className="border-b border-white/[0.07] bg-[#05090f] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-1.5">
                <span className="text-blue-400">▌</span> Live Feedback
              </p>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div
                  className={`grid h-[72px] w-[72px] shrink-0 place-items-center rounded-full border-[5px] bg-[#03070e] transition-all duration-500 ${scoreFlash === "up" ? "border-emerald-400 shadow-[0_0_0_6px_rgba(52,211,153,0.12)]" : scoreFlash === "down" ? "border-amber-400 shadow-[0_0_0_6px_rgba(251,191,36,0.12)]" : "border-blue-500/60"}`}
                >
                  <div className="text-center">
                    {scoreReady ? (
                      <>
                        <div className="text-2xl font-black tabular-nums leading-none">
                          {recruiterSignal.overall}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          /100
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-2xl font-black text-slate-600">
                          ·
                        </div>
                      </>
                    )}
                    {scoreFlash ? (
                      <div
                        className={`mt-1 text-[10px] font-black uppercase ${scoreFlash === "up" ? "text-emerald-300" : "text-amber-300"}`}
                      >
                        {scoreFlash === "up" ? "improved" : "check proof"}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="w-full min-w-0 flex-1 space-y-1.5">
                  {scoreItems.map((item) => {
                    const Icon = item.icon;
                    const numVal = scoreReady
                      ? parseInt(String(item.value))
                      : 0;
                    return (
                      <div key={item.label}>
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span
                            className={`text-[11px] ${scoreReady ? "text-slate-400" : "text-slate-600"}`}
                          >
                            {item.label}
                          </span>
                          <span
                            className={`text-[11px] font-black ${scoreReady ? "text-white" : "text-slate-600"}`}
                          >
                            {item.value}
                          </span>
                        </div>
                        <div className="h-1 overflow-hidden rounded-full bg-white/[0.07]">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              toneClass(item.tone)
                                .split(" ")
                                .find((c) => c.startsWith("bg-")) ||
                              "bg-blue-400"
                            }`}
                            style={{
                              width: scoreReady
                                ? `${Math.min(100, numVal)}%`
                                : "0%",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section
              style={{ display: showCopilot ? undefined : "none" }}
              className="flex-1 border-b border-white/[0.07] bg-[#05090f] p-4 overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Session signals
                </p>
                <span className="inline-block h-2 w-2 rounded-full bg-blue-400" />
              </div>

              <div className="mt-3 flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                    Mood
                  </p>
                  <p
                    className={`mt-1 text-base font-black ${recruiterMoodColor(recruiterSignal.mood)}`}
                  >
                    {scoreReady ? recruiterSignal.mood : "Waiting"}
                  </p>
                </div>
                <div className="text-right text-xs text-slate-300">
                  <p>
                    Trust{" "}
                    <span className="font-bold text-white">
                      {scoreReady ? recruiterSignal.trust : "—"}
                    </span>
                  </p>
                  <p>
                    Interest{" "}
                    <span className="font-bold text-white">
                      {scoreReady ? recruiterSignal.interest : "—"}
                    </span>
                  </p>
                </div>
              </div>

              {/* Filler word count — observational only, no coaching hints during interview */}
              {fillerWordCount > 0 && (
                <div className="mt-2 rounded-xl border border-amber-300/15 bg-amber-400/[0.07] px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">
                    Filler words
                  </p>
                  <p className="mt-1 text-sm font-black text-white">
                    {fillerWordCount}
                    <span className="ml-1 text-xs font-normal text-slate-400">
                      detected this session
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-600">
                    Reviewed in full after the interview.
                  </p>
                </div>
              )}
            </section>

            <section className="bg-[#05090f] p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Progress
                </p>
                <span className="tabular-nums text-sm font-black text-white">
                  {visibleQuestionNumber}
                  <span className="text-slate-500">/12</span>
                </span>
              </div>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-[10px] text-slate-600">{progress}%</p>
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
          <div className="fixed bottom-20 left-3 right-3 z-40 rounded-lg border border-blue-300/20 bg-[#07111f]/95 px-4 py-3 shadow-2xl backdrop-blur-xl lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">
                  Session signals
                </p>
                <p
                  className={`truncate text-sm font-black ${recruiterMoodColor(recruiterSignal.mood)}`}
                >
                  {scoreReady ? recruiterSignal.mood : "Waiting"}
                </p>
              </div>
              <div className="shrink-0 text-right text-xs text-slate-300">
                <p>
                  Trust{" "}
                  <span className="font-black text-white">
                    {scoreReady ? recruiterSignal.trust : "—"}
                  </span>
                </p>
                <p>
                  Interest{" "}
                  <span className="font-black text-white">
                    {scoreReady ? recruiterSignal.interest : "—"}
                  </span>
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <UpgradeModal
        open={upgradeModalOpen}
        feature={upgradeModalFeature}
        onClose={closeUpgradeModal}
        onUpgrade={handleUpgradeInterest}
      />

      {settingsOpen && (
        <div
          className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setSettingsOpen(false)}
        >
          <section
            className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto rounded-t-[2rem] border border-white/10 bg-[#07111f] p-5 text-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/20" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-200">
                  Interview settings
                </p>
                <h2 className="mt-1 text-xl font-black">Mobile controls</h2>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Adjust the most important interview controls without opening
                  the desktop side panel.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded-lg border border-white/10 px-3 py-2 text-sm font-black text-slate-300"
              >
                Close
              </button>
            </div>
            <div className="mt-5 grid gap-3">
              <button
                type="button"
                onClick={() => setAudioEnabled((value) => !value)}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-left"
              >
                <span>
                  <span className="block text-sm font-black">
                    Recruiter voice
                  </span>
                  <span className="block text-xs text-slate-400">
                    Use spoken recruiter prompts
                  </span>
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${audioEnabled ? "bg-emerald-400/15 text-emerald-200" : "bg-white/10 text-slate-400"}`}
                >
                  {audioEnabled ? "On" : "Off"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShowTranscript((value) => !value)}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-left"
              >
                <span>
                  <span className="block text-sm font-black">Transcript</span>
                  <span className="block text-xs text-slate-400">
                    Show or collapse live transcript
                  </span>
                </span>
                <span className="rounded-full bg-blue-400/15 px-3 py-1 text-xs font-black text-blue-200">
                  {showTranscript ? "Shown" : "Hidden"}
                </span>
              </button>
              <Link
                href="/dashboard"
                className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-slate-300"
              >
                Back to dashboard
              </Link>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
