"use client";

import Image from "next/image";
import Link from "next/link";
import {
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
  Video,
  Volume2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

const scoreItems = [
  { label: "Confidence", value: "82/100", icon: ShieldCheck, tone: "emerald" },
  { label: "Clarity", value: "75/100", icon: Sparkles, tone: "blue" },
  { label: "Relevance", value: "80/100", icon: Star, tone: "violet" },
  { label: "Communication", value: "76/100", icon: User, tone: "orange" },
];

const recruiterQuestions = [
  "Can you walk me through your background and what makes you interested in this role?",
  "Tell me about one relevant situation from your experience.",
  "What was the hardest part, and how did you solve it?",
  "What measurable impact did your work create?",
  "What would you improve if you handled the same situation again?",
];

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
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
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

  const candidateName =
    getNestedValue(state, [
      "candidateName",
      "name",
      "userName",
      "candidate.name",
      "profile.name",
      "setup.candidateName",
      "setup.name",
    ]) ||
    extractNameFromCvText(cvText) ||
    "Candidate";

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

  const language =
    getNestedValue(state, ["language", "setup.language", "interviewLanguage"]) || "en-US";

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
  const wantsMale = recruiterLooksMale(setup);
  const englishVoices = voices.filter((voice) => voice.lang?.toLowerCase().startsWith("en"));

  const femaleNames = /aria|jenny|samantha|zira|susan|victoria|karen|moira|tessa|female/i;
  const maleNames = /david|mark|guy|george|daniel|alex|fred|tom|male/i;

  if (wantsMale) {
    return (
      englishVoices.find((voice) => maleNames.test(voice.name)) ||
      englishVoices.find((voice) => !femaleNames.test(voice.name)) ||
      englishVoices[0] ||
      voices[0]
    );
  }

  return (
    englishVoices.find((voice) => femaleNames.test(voice.name)) ||
    englishVoices.find((voice) => !maleNames.test(voice.name)) ||
    englishVoices[0] ||
    voices[0]
  );
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

function hasEvidenceForClaim(answer: string, setup: InterviewSetup) {
  const evidence = `${setup.cvText || ""} ${setup.jobDescription || ""}`.toLowerCase();
  const lower = answer.toLowerCase();

  const companyClaims = ["tesla", "google", "microsoft", "amazon", "meta", "apple", "zoho"];
  const claimedCompany = companyClaims.find((company) => lower.includes(company));
  if (claimedCompany && evidence && !evidence.includes(claimedCompany)) return false;

  const yearsClaim = extractYearsClaim(answer);
  if (yearsClaim && yearsClaim >= 7 && evidence) {
    const directDigit = new RegExp(`\\b${yearsClaim}\\s*(?:\\+?\\s*)?(?:years?|yrs?)\\b`, "i");
    const wordMap: Record<number, string> = {
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

    if (!directDigit.test(evidence) && !(directWord && directWord.test(evidence))) return false;
  }

  return true;
}


function buildRecruiterReply(answer: string, questionIndex: number, setup: InterviewSetup) {
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
    return "Let me clarify that before we move on. I heard a claim that I cannot verify from the resume or job context. Was this an official role, an unlisted responsibility, or transferable experience? Please answer using only experience you can support.";
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

  return recruiterQuestions[Math.min(questionIndex + 1, recruiterQuestions.length - 1)].replace(
    "this role",
    setup.targetRole,
  );
}

export default function InterviewPage() {
  const [setup, setSetup] = useState<InterviewSetup>({
    candidateName: "Candidate",
    targetRole: "Interview Role",
    recruiterId: "friendly_hr",
    recruiterName: "Sarah",
    recruiterTitle: "Friendly HR Recruiter",
    recruiterImage: "/recruiters/sarah.png",
    language: "en-US",
    cvText: "",
    jobDescription: "",
  });
  const [status, setStatus] = useState<InterviewStatus>("idle");
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [interimText, setInterimText] = useState("");
  const [transcript, setTranscript] = useState<TranscriptItem[]>(initialTranscript);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const listeningRef = useRef(false);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const answerBufferRef = useRef("");
  const questionIndexRef = useRef(0);
  const stopRequestedRef = useRef(false);
  const setupRef = useRef(setup);

  const progress = Math.round(((questionIndex + 1) / 12) * 100);
  const headerTitle = setup.targetCompany
    ? `${setup.targetRole} – ${setup.targetCompany}`
    : setup.targetRole;
  const recruiterImagePosition = recruiterObjectPosition(setup.recruiterId, setup.recruiterName);

  useEffect(() => {
    const nextSetup = buildSetupFromStorage();
    setSetup(nextSetup);
    setupRef.current = nextSetup;

    const handleStorage = () => {
      const updated = buildSetupFromStorage();
      setSetup(updated);
      setupRef.current = updated;
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
    questionIndexRef.current = questionIndex;
  }, [questionIndex]);

  useEffect(() => {
    if (status === "idle" || status === "ended") return;

    const timer = window.setInterval(() => {
      setElapsed((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [transcript, interimText]);

  const addTranscript = useCallback((item: Omit<TranscriptItem, "id" | "time">) => {
    setTranscript((current) => [
      ...current,
      {
        ...item,
        id: createClientId(),
        time: timeLabel(),
      },
    ]);
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
    recognition.lang = setupRef.current.language || "en-US";

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

    recognition.onerror = () => {
      listeningRef.current = false;
      setInterimText("");
      if (!stopRequestedRef.current) setStatus("listening");
    };

    recognition.onend = () => {
      listeningRef.current = false;
      const answer = answerBufferRef.current.trim();
      setInterimText("");

      if (!answer || stopRequestedRef.current) {
        if (!stopRequestedRef.current) setStatus("listening");
        return;
      }

      addTranscript({
        role: "candidate",
        speaker: "You",
        text: answer,
      });

      setStatus("thinking");

      const reply = buildRecruiterReply(answer, questionIndexRef.current, setupRef.current);

      window.setTimeout(() => {
        if (stopRequestedRef.current) return;
        setQuestionIndex((value) => Math.min(value + 1, 11));
        speakRecruiter(reply);
      }, 650);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
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

        utterance.rate = wantsMale ? 0.9 : 0.94;
        utterance.pitch = wantsMale ? 0.86 : 1.08;
        utterance.lang = activeSetup.language || "en-US";

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
    [addTranscript, audioEnabled, startListening],
  );

  const startInterview = useCallback(() => {
    const freshSetup = buildSetupFromStorage();
    setSetup(freshSetup);
    setupRef.current = freshSetup;

    stopRequestedRef.current = false;
    setElapsed(0);
    setQuestionIndex(0);
    setInterimText("");
    setTranscript([]);

    speakRecruiter(
      `Hi ${freshSetup.candidateName}. Let’s begin your interview for the ${freshSetup.targetRole} role. ${recruiterQuestions[0]}`,
    );
  }, [speakRecruiter]);

  const endInterview = useCallback(() => {
    stopRequestedRef.current = true;
    stopListening();

    try {
      window.speechSynthesis?.cancel();
    } catch {}

    setStatus("ended");
    setInterimText("");
    addTranscript({
      role: "system",
      speaker: "System",
      text: "Interview ended. You can review the transcript or start again.",
    });
  }, [addTranscript, stopListening]);

  const toggleMic = useCallback(() => {
    if (status === "listening" && listeningRef.current) {
      stopListening();
      return;
    }

    if (status === "idle" || status === "ended") {
      startInterview();
      return;
    }

    if (status !== "recruiter-speaking") startListening();
  }, [startInterview, startListening, status, stopListening]);

  const formattedElapsed = useMemo(() => {
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }, [elapsed]);

  return (
    <main className="h-screen overflow-hidden bg-[#050b14] text-white">
      <style jsx global>{`
        @keyframes workzoRecruiterBreath {
          0%, 100% {
            transform: scale(1.018) translate3d(0, 0, 0);
            filter: saturate(1) brightness(1);
          }
          50% {
            transform: scale(1.055) translate3d(0, 5px, 0);
            filter: saturate(1.08) brightness(1.04);
          }
        }

        @keyframes workzoRecruiterMicroMove {
          0%, 100% {
            transform: translate3d(-3px, 0, 0);
          }
          50% {
            transform: translate3d(3px, 2px, 0);
          }
        }

        .workzo-recruiter-breath {
          animation: workzoRecruiterBreath 5s ease-in-out infinite;
          transform-origin: center 40%;
          will-change: transform, filter;
        }

        .workzo-recruiter-micro {
          animation: workzoRecruiterMicroMove 7s ease-in-out infinite;
          will-change: transform;
        }


        50% {
            transform: scale(1.045) translateY(4px);
            filter: saturate(1.07) brightness(1.035);
          }
        }
          50% {
            transform: scale(1.16) translate3d(0, 3px, 0);
            filter: saturate(1.06) brightness(1.03);
          }
        }
          50% { transform: scale(1.025) translate3d(0, 3px, 0); filter: saturate(1.04) brightness(1.03); }
        }
          50% {
            transform: translate3d(0, 8px, 0) scale(1.055);
            filter: saturate(1.08) brightness(1.04);
          }
        }
          50% { transform: scale(1.018) translate3d(0, -3px, 0); filter: saturate(1.08); }
        }

        @keyframes workzoRecruiterPresence {
          0%, 100% { opacity: .18; transform: scale(.98); }
          50% { opacity: .42; transform: scale(1.02); }
        }

        @keyframes workzoStatusPulse {
          0%, 100% { transform: scale(1); opacity: .8; }
          50% { transform: scale(1.35); opacity: 1; }
        }

        50% { transform: translate3d(2px, 2px, 0); }
        }

        @keyframes workzoBlink {
          0%, 91%, 100% { opacity: 0; transform: translateX(-50%) scaleY(1); }
          93% { opacity: .65; transform: translateX(-50%) scaleY(.1); }
          95% { opacity: 0; transform: translateX(-50%) scaleY(1); }
        }

        .workzo-recruiter-presence {
          animation: workzoRecruiterPresence 4.2s ease-in-out infinite;
        }

        .workzo-status-pulse {
          animation: workzoStatusPulse 1.7s ease-in-out infinite;
        }

        .workzo-blink {
          animation: workzoBlink 4.6s infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .workzo-recruiter-presence,
          .workzo-recruiter-breath,
          .workzo-recruiter-micro,
          .workzo-blink {
            animation: none !important;
          }
        }
      `}</style>

      <section className="grid h-full grid-rows-[70px_1fr]">
        <header className="flex items-center justify-between border-b border-white/10 px-5">
          <div className="flex min-w-0 items-center gap-5">
            <Link href="/dashboard" className="flex shrink-0 items-center gap-3">
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

            <div className="h-9 w-px bg-white/10" />

            <div className="flex min-w-0 items-center gap-3">
              <h1 className="truncate text-base font-black sm:text-lg lg:text-xl">
                {headerTitle}
              </h1>
              <span className="hidden h-2.5 w-2.5 rounded-full bg-emerald-400 sm:block" />
              <span className="hidden text-sm font-bold uppercase text-emerald-300 sm:block">
                Live
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 lg:gap-4">
            <div className="hidden items-center gap-2 text-sm text-slate-200 md:flex">
              <Clock3 className="h-4 w-4" />
              {formattedElapsed}
            </div>

            {status === "idle" || status === "ended" ? (
              <button
                onClick={startInterview}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 px-4 text-sm font-black"
              >
                <Play className="h-4 w-4" />
                Start
              </button>
            ) : (
              <button
                onClick={endInterview}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-500/40 px-4 text-sm font-black text-red-300 lg:px-5"
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
            <button className="hidden h-10 w-12 place-items-center rounded-xl border border-white/10 bg-white/[0.03] sm:grid">
              <Settings className="h-5 w-5" />
            </button>
            <button className="hidden h-10 w-12 place-items-center rounded-xl border border-white/10 bg-white/[0.03] md:grid">
              <MoreVertical className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="grid min-h-0 grid-cols-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[1fr_400px] lg:overflow-hidden lg:p-4">
          <div className="grid min-h-0 gap-3 lg:grid-rows-[62vh_28vh]">
            <section className="relative h-[280px] overflow-hidden rounded-2xl border border-white/10 bg-[#0b1527] sm:h-[390px] lg:h-auto">
              <div className="absolute inset-x-[18%] bottom-8 top-6 rounded-full bg-blue-500/20 blur-3xl workzo-recruiter-presence" />
              <div className="absolute inset-0 will-change-transform workzo-recruiter-breath">
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
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(52,211,153,0.9)] workzo-status-pulse" /> {status === "recruiter-speaking" ? "SPEAKING" : status === "listening" ? "LISTENING" : status === "thinking" ? "THINKING" : "LIVE"}
              </div>

              <div className="absolute bottom-5 left-5">
                <div className="flex items-center gap-2 text-lg font-black">
                  {setup.recruiterName}
                  <CheckCircle2 className="h-5 w-5 fill-blue-500 text-blue-500" />
                </div>
                <p className="mt-1 text-sm text-white/85">{setup.recruiterTitle}</p>
              </div>

              <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-3 sm:bottom-5 sm:gap-4">
                <button
                  onClick={toggleMic}
                  className={`grid h-11 w-11 place-items-center rounded-full shadow-2xl sm:h-14 sm:w-14 ${
                    status === "listening" ? "bg-blue-500 text-white" : "bg-white text-slate-950"
                  }`}
                >
                  {status === "listening" ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                </button>
                <button className="grid h-11 w-11 place-items-center rounded-full bg-white text-slate-950 shadow-2xl sm:h-14 sm:w-14">
                  <Video className="h-6 w-6" />
                </button>
                <button className="grid h-11 w-11 place-items-center rounded-full bg-white text-slate-950 shadow-2xl sm:h-14 sm:w-14">
                  <Settings className="h-6 w-6" />
                </button>
                <button
                  onClick={endInterview}
                  className="grid h-11 w-11 place-items-center rounded-full bg-red-500 text-white shadow-2xl sm:h-14 sm:w-14"
                >
                  <PhoneOff className="h-6 w-6" />
                </button>
              </div>
            </section>

            <section className="min-h-[210px] rounded-2xl border border-white/10 bg-[#0b1527]/95 lg:min-h-0">
              <div className="flex h-12 items-center justify-between border-b border-white/10 px-5">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-black">Live Transcript</h2>
                  <span className="h-2 w-2 rounded-full bg-red-400" />
                  <span className="text-sm text-slate-300">Live</span>
                </div>
                <div className="hidden items-center gap-3 text-sm text-slate-300 sm:flex">
                  Auto-scroll
                  <span className="relative h-5 w-9 rounded-full bg-blue-500">
                    <span className="absolute right-1 top-1 h-3 w-3 rounded-full bg-white" />
                  </span>
                </div>
              </div>

              <div className="h-[190px] overflow-y-auto px-4 py-2 lg:h-[calc(100%-86px)]">
                <div className="divide-y divide-white/8">
                  {transcript.map((line) => (
                    <div
                      key={line.id}
                      className="grid grid-cols-[82px_170px_1fr] gap-3 py-2.5 text-sm max-sm:grid-cols-1 max-sm:gap-1 max-sm:py-3"
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
                      <span className="line-clamp-2 leading-6 text-slate-100">{line.text}</span>
                    </div>
                  ))}

                  {interimText ? (
                    <div className="grid grid-cols-[82px_170px_1fr] gap-3 py-2.5 text-sm opacity-70 max-sm:grid-cols-1 max-sm:gap-1">
                      <span className="text-slate-400">listening</span>
                      <span className="font-semibold text-blue-300">You</span>
                      <span className="leading-6 text-slate-100">{interimText}</span>
                    </div>
                  ) : null}

                  <div ref={transcriptEndRef} />
                </div>
              </div>

              <div className="flex h-10 items-center justify-between border-t border-white/10 px-5 text-xs text-slate-400">
                <span>Transcript is AI-generated and may not be 100% accurate.</span>
                <button onClick={() => setTranscript([])} className="hover:text-white">
                  Clear Transcript
                </button>
              </div>
            </section>
          </div>

          <aside className="grid min-h-0 gap-3 lg:grid-rows-[250px_minmax(0,1fr)_110px]">
            <section className="rounded-2xl border border-white/10 bg-[#0b1527] p-4">
              <h2 className="text-lg font-black">Interview Score</h2>
              <div className="mt-3 flex items-center gap-4">
                <div className="grid h-28 w-28 place-items-center rounded-full border-[10px] border-blue-500 bg-[#07111f] shadow-[0_0_0_10px_rgba(124,58,237,0.2)]">
                  <div className="text-center">
                    <div className="text-4xl font-black">78</div>
                    <div className="text-sm text-slate-300">/100</div>
                  </div>
                </div>

                <div className="min-w-0 flex-1 space-y-2.5">
                  {scoreItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className={`grid h-7 w-7 place-items-center rounded-lg ${toneClass(item.tone)}`}>
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="text-sm">{item.label}</span>
                        </div>
                        <span className="text-sm text-slate-200">{item.value}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <p className="mt-4 text-sm text-slate-300">
                <span className="text-emerald-300">●</span> Overall Performance:{" "}
                <span className="font-bold text-emerald-300">Good</span>
              </p>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#0b1527] p-4">
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

              <p className="mt-3 text-sm font-semibold text-slate-200">Live guidance</p>
              <div className="mt-2 max-h-[calc(100%-58px)] space-y-2 overflow-y-auto pr-1">
                <div className="rounded-xl border border-emerald-300/15 bg-emerald-400/[0.07] px-3 py-1.5">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-200">Say next</p>
                  <p className="mt-1 text-[13px] leading-5 text-slate-100">Use one real example and state the result.</p>
                </div>
                <div className="rounded-xl border border-violet-300/15 bg-violet-400/[0.07] px-3 py-1.5">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-violet-200">Add proof</p>
                  <p className="mt-1 text-[13px] leading-5 text-slate-100">Add numbers, scale, time saved, or customer impact.</p>
                </div>
                <div className="rounded-xl border border-amber-300/15 bg-amber-400/[0.07] px-3 py-1.5">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-200">Recruiter concern</p>
                  <p className="mt-1 text-[13px] leading-5 text-slate-100">Answer may sound generic without evidence.</p>
                </div>
                <div className="rounded-xl border border-blue-300/15 bg-blue-400/[0.07] px-3 py-1.5">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-200">Likely follow-up</p>
                  <p className="mt-1 text-[13px] leading-5 text-slate-100">“How did you measure the impact?”</p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#0b1527] p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black">Interview Progress</h2>
                <span className="text-sm text-slate-300">
                  Question {Math.min(questionIndex + 1, 12)} of 12
                </span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-slate-300">{progress}% Completed</p>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}
