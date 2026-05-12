"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Vapi from "@vapi-ai/web";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bot,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Mic,
  MicOff,
  PhoneOff,
  Radio,
  Send,
  ShieldAlert,
  Sparkles,
  Timer,
  Volume2,
  Zap,
} from "lucide-react";

import { useInterviewStore } from "@/store/interviewStore";

type VoiceState = "idle" | "starting" | "listening" | "speaking" | "muted";
type Speaker = "user" | "assistant" | null;

type RecruiterProfile = {
  id: string;
  name: string;
  title: string;
  avatar: string;
  tone: string;
  questionStyle: string;
  pressureBias: number;
  interruptionBias: number;
  feedbackStyle: string;
};

type InterviewApiResponse = {
  question?: string;
  nextQuestion?: string;
  recruiterReaction?: string;
  recruiterReply?: string;
  score?: {
    clarity?: number;
    relevance?: number;
    confidence?: number;
    structure?: number;
    evidence?: number;
    overall?: number;
  };
  liveScore?: {
    clarity?: number;
    relevance?: number;
    confidence?: number;
    structure?: number;
    evidence?: number;
    overall?: number;
  };
  memoryUpdates?: {
    label: string;
    value: string;
    importance: "low" | "medium" | "high";
  }[];
  recruiterMemory?: {
    label: string;
    value: string;
    importance: "low" | "medium" | "high";
  }[];
  pressureLevel?: number;
  emotionState?: string;
  strengths?: string[];
  weaknesses?: string[];
  improvements?: string[];
  risks?: string[];
  recruiterProfile?: RecruiterProfile;
  interruption?:
    | {
        shouldInterrupt: boolean;
        interruptionMessage: string;
        severity: "low" | "medium" | "high";
      }
    | string;
  contradictions?: string[];
};

const recruiterProfiles: Record<
  string,
  {
    name: string;
    title: string;
    avatar: string;
    quote: string;
    accent: string;
  }
> = {
  friendly_hr: {
    name: "Sarah",
    title: "Friendly HR",
    avatar: "👩🏻‍💼",
    quote: "I want to understand how you communicate and work with people.",
    accent: "from-emerald-400 to-cyan-300",
  },
  analytical_hiring_manager: {
    name: "Daniel",
    title: "Hiring Manager",
    avatar: "👨🏻‍💼",
    quote: "Can you prove the measurable impact behind that answer?",
    accent: "from-blue-400 to-cyan-300",
  },
  startup_recruiter: {
    name: "Priya",
    title: "Startup Recruiter",
    avatar: "👩🏽‍💼",
    quote: "What did you specifically own, and how fast did you execute?",
    accent: "from-fuchsia-400 to-orange-300",
  },
  corporate_recruiter: {
    name: "Markus",
    title: "Corporate Recruiter",
    avatar: "👨🏼‍💼",
    quote: "Keep the answer concise, structured, and relevant.",
    accent: "from-slate-300 to-blue-300",
  },
  pressure_interviewer: {
    name: "Alex",
    title: "Pressure Interviewer",
    avatar: "🧑🏻‍💼",
    quote: "Let me stop you there. I still do not understand the impact.",
    accent: "from-red-400 to-orange-300",
  },
};

function isNormalVapiEnd(error: unknown) {
  const message = String((error as any)?.message || error || "");

  return (
    message.includes("Meeting ended due to ejection") ||
    message.includes("Meeting has ended") ||
    message.includes("Customer/Silence") ||
    message.includes("Silence") ||
    message.includes("meeting has ended")
  );
}

function safeArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string" && item.trim().length > 0)
    : [];
}

function safeNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && !Number.isNaN(value) ? Math.round(value) : fallback;
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function emotionLabel(value?: string) {
  if (!value) return "Neutral";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function pressureCopy(value: number) {
  if (value >= 75) return "High pressure";
  if (value >= 45) return "Medium pressure";
  return "Calm pressure";
}

function pressureColor(value: number) {
  if (value >= 75) return "from-red-500 to-orange-400";
  if (value >= 45) return "from-amber-400 to-orange-400";
  return "from-blue-500 to-cyan-300";
}

function scoreLabel(score: number) {
  if (score >= 80) return "Strong";
  if (score >= 65) return "Improving";
  if (score >= 45) return "Needs proof";
  return "Weak";
}

function normalizeInterruption(
  interruption: InterviewApiResponse["interruption"] | null
): {
  shouldInterrupt: boolean;
  interruptionMessage: string;
  severity: "low" | "medium" | "high";
} | null {
  if (!interruption) return null;

  if (typeof interruption === "string") {
    return {
      shouldInterrupt: interruption.trim().length > 0,
      interruptionMessage: interruption,
      severity: "medium",
    };
  }

  return interruption;
}

function Waveform({
  active,
  intense = false,
  bars = 36,
}: {
  active: boolean;
  intense?: boolean;
  bars?: number;
}) {
  return (
    <div className="flex h-14 items-end gap-1.5">
      {Array.from({ length: bars }).map((_, index) => (
        <span
          key={index}
          className={`w-1.5 rounded-full bg-gradient-to-t ${
            intense ? "from-orange-500 to-red-300" : "from-blue-500 to-cyan-300"
          } ${active ? "animate-pulse" : ""}`}
          style={{
            height: `${12 + ((index * 11) % 36)}px`,
            animationDelay: `${index * 55}ms`,
          }}
        />
      ))}
    </div>
  );
}

function ScoreBar({
  label,
  value,
  hot = false,
}: {
  label: string;
  value: number;
  hot?: boolean;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-slate-400">{label}</span>
        <span className="font-bold text-white">{safeNumber(value)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${
            hot ? pressureColor(value) : "from-blue-500 to-cyan-300"
          }`}
          style={{ width: `${Math.max(4, Math.min(100, safeNumber(value)))}%` }}
        />
      </div>
    </div>
  );
}

export default function InterviewPage() {
  const {
    setup,
    mode,
    vapiStatus,
    vapiError,
    currentQuestion,
    transcript,
    recruiterMemory,
    liveScore,
    pressureLevel,
    emotionState,
    setMode,
    setVapiStatus,
    setVapiError,
    startSession,
    endSession,
    setCurrentQuestion,
    setLastUserAnswer,
    addTranscript,
    addRecruiterMemory,
    updateLiveScore,
    setPressureLevel,
    setEmotionState,
    recordAnswerHistory,
    recordInterruption,
  } = useInterviewStore();

  const [answer, setAnswer] = useState("");
  const [aiReply, setAiReply] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isAnalyzingVoice, setIsAnalyzingVoice] = useState(false);

  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [liveSpeaker, setLiveSpeaker] = useState<Speaker>(null);

  const [strengths, setStrengths] = useState<string[]>([]);
  const [weaknesses, setWeaknesses] = useState<string[]>([]);
  const [improvements, setImprovements] = useState<string[]>([]);
  const [risks, setRisks] = useState<string[]>([]);
  const [contradictions, setContradictions] = useState<string[]>([]);
  const [interruption, setInterruption] =
    useState<InterviewApiResponse["interruption"] | null>(null);
  const [recruiterProfile, setRecruiterProfile] =
    useState<RecruiterProfile | null>(null);

  const vapiRef = useRef<Vapi | null>(null);
  const vapiStartedRef = useRef(false);
  const mountedRef = useRef(false);
  const lastVoiceAnswerRef = useRef("");
  const voiceAnalysisTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
  const defaultAssistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;
  const maleAssistantId = process.env.NEXT_PUBLIC_VAPI_MALE_ASSISTANT_ID;
  const femaleAssistantId = process.env.NEXT_PUBLIC_VAPI_FEMALE_ASSISTANT_ID;

  const targetRole = setup.targetRole || "Target role";
  const targetMarket = setup.targetMarket || "Global";
  const companyStyle = setup.companyStyle || "Realistic";
  const recruiterPersonality = setup.recruiterPersonality || "Professional";
  const cvText = setup.cvText || "";
  const jobDescription = setup.jobDescription || "";

  const recruiter = useMemo(() => {
    if (recruiterProfile) {
      return {
        name: recruiterProfile.name || "AI Recruiter",
        title: recruiterProfile.title || "Hiring Manager",
        avatar: recruiterProfile.avatar || "👨🏻‍💼",
        quote: recruiterProfile.questionStyle || "I will test your answers like a real recruiter.",
        accent: "from-blue-400 to-cyan-300",
      };
    }

    return (
      recruiterProfiles[recruiterPersonality] ||
      recruiterProfiles.analytical_hiring_manager
    );
  }, [recruiterPersonality, recruiterProfile]);

  const recruiterVoiceGender =
    recruiterPersonality === "friendly_hr" || recruiterPersonality === "startup_recruiter"
      ? "female"
      : "male";

  const assistantId =
    recruiterVoiceGender === "male"
      ? maleAssistantId || defaultAssistantId
      : femaleAssistantId || defaultAssistantId;

  const normalizedInterruption = normalizeInterruption(interruption);
  const trustScore = safeNumber(
    (liveScore.confidence + liveScore.relevance + liveScore.structure + liveScore.evidence) / 4,
    52
  );

  const speakingActive =
    voiceState === "speaking" ||
    isThinking ||
    isAnalyzingVoice ||
    Boolean(aiReply);

  const transcriptPreview = transcript.slice(-8);
  const latestRecruiterLine =
    liveSpeaker === "assistant" && liveTranscript
      ? liveTranscript
      : aiReply || currentQuestion || recruiter.quote;

  const memorySummary =
    recruiterMemory.length > 0
      ? recruiterMemory.map((item) => `${item.label}: ${item.value}`).join(" ")
      : "Memory is building during the interview.";

  const topicsMentioned = transcript
    .filter((item) => item.speaker === "user")
    .flatMap((item) =>
      item.text
        .split(/[,.]/)
        .map((part) => part.trim())
        .filter((part) => part.length > 8)
    )
    .slice(-5);

  useEffect(() => {
    mountedRef.current = true;
    startSession();

    if (!currentQuestion) {
      const firstQuestion = `Good to meet you. Let’s begin with the ${targetRole} role. Tell me about yourself and keep it relevant to this position.`;
      setCurrentQuestion(firstQuestion);
      addTranscript({ speaker: "recruiter", text: firstQuestion });
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isNormalVapiEnd(event.reason)) {
        event.preventDefault();
        setVapiStatus("ended");
        setVapiError(null);
        setVoiceMode(false);
        setVoiceState("idle");
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);

      if (voiceAnalysisTimerRef.current) {
        clearTimeout(voiceAnalysisTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, liveTranscript, aiReply]);

  async function analyzeAnswer(userAnswer: string, source: "text" | "voice") {
    const cleanAnswer = userAnswer.trim();

    if (!cleanAnswer) return;

    if (source === "voice") {
      setIsAnalyzingVoice(true);
    } else {
      setIsThinking(true);
    }

    try {
      const response = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: source === "voice" ? "answer" : "answer",
          answer: cleanAnswer,
          currentQuestion,
          question: currentQuestion,
          setup: {
            cvText,
            jobDescription,
            targetRole,
            country: targetMarket,
            recruiterPersonality,
            recruiterStyle: companyStyle,
            pressureMode: pressureCopy(pressureLevel),
          },
          targetRole,
          targetMarket,
          companyStyle,
          recruiterPersonality,
          cvText,
          jobDescription,
          transcript,
          recruiterMemory,
          lastUserAnswer: cleanAnswer,
          pressureLevel,
          emotionState,
        }),
      });

      if (!response.ok) {
        throw new Error(`Interview API failed with ${response.status}`);
      }

      const data = (await response.json()) as InterviewApiResponse;

      const recruiterReaction =
        data.recruiterReaction ||
        data.recruiterReply ||
        "Interesting. I want to understand the evidence behind that answer.";

      const nextQuestion =
        data.question ||
        data.nextQuestion ||
        "Can you give me one specific example with situation, action, and result?";

      if (source === "text") {
        setAiReply(`${recruiterReaction}\n\n${nextQuestion}`);

        addTranscript({ speaker: "recruiter", text: recruiterReaction });
        addTranscript({ speaker: "recruiter", text: nextQuestion });
      }

      setCurrentQuestion(nextQuestion);

      setStrengths(safeArray(data.strengths));
      setWeaknesses(safeArray(data.weaknesses));
      setImprovements(safeArray(data.improvements));
      setRisks(safeArray(data.risks));
      setContradictions(safeArray(data.contradictions));

      if (data.recruiterProfile) {
        setRecruiterProfile(data.recruiterProfile);
      }

      if (data.interruption) {
        setInterruption(data.interruption);

        const normalized = normalizeInterruption(data.interruption);
        if (normalized?.shouldInterrupt) {
          recordInterruption(
            normalized.interruptionMessage,
            normalized.severity
          );
        }

        setTimeout(() => {
          setInterruption(null);
        }, 5200);
      }

      recordAnswerHistory(cleanAnswer, source);

      const score = data.score || data.liveScore;

      if (score) {
        updateLiveScore({
          clarity: safeNumber(score.clarity, liveScore.clarity),
          relevance: safeNumber(score.relevance, liveScore.relevance),
          confidence: safeNumber(score.confidence, liveScore.confidence),
          structure: safeNumber(score.structure, liveScore.structure),
          evidence: safeNumber(score.evidence, liveScore.evidence),
          overall: safeNumber(score.overall, liveScore.overall),
        });
      }

      if (typeof data.pressureLevel === "number") {
        setPressureLevel(data.pressureLevel);
      }

      if (data.emotionState) {
        setEmotionState(data.emotionState);
      }

      const updates = Array.isArray(data.memoryUpdates)
        ? data.memoryUpdates
        : Array.isArray(data.recruiterMemory)
          ? data.recruiterMemory
          : [];

      updates.forEach((item) => {
        addRecruiterMemory({
          label: item.label,
          value: item.value,
          importance: item.importance,
        });
      });
    } catch (error) {
      console.error(error);

      if (source === "text") {
        setAiReply("The recruiter connection failed. Please try again.");
      }
    } finally {
      if (source === "voice") {
        setIsAnalyzingVoice(false);
      } else {
        setIsThinking(false);
      }
    }
  }

  const handleTextSubmit = async () => {
    if (!answer.trim() || isThinking) return;

    const userAnswer = answer.trim();

    addTranscript({ speaker: "user", text: userAnswer });
    setLastUserAnswer(userAnswer);
    setAnswer("");

    await analyzeAnswer(userAnswer, "text");
  };

  function handleVoiceUserTranscript(text: string) {
    const cleanText = text.trim();

    if (cleanText.length < 12) return;

    const normalized = normalizeText(cleanText);
    const previous = normalizeText(lastVoiceAnswerRef.current);

    if (normalized === previous) return;

    if (previous && normalized.includes(previous)) {
      lastVoiceAnswerRef.current = cleanText;
    } else {
      lastVoiceAnswerRef.current = cleanText;

      addTranscript({
        speaker: "user",
        text: cleanText,
      });
    }

    setLastUserAnswer(cleanText);

    if (voiceAnalysisTimerRef.current) {
      clearTimeout(voiceAnalysisTimerRef.current);
    }

    voiceAnalysisTimerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      void analyzeAnswer(cleanText, "voice");
    }, 900);
  }

  const startVoiceMode = async () => {
    if (!publicKey || !assistantId) {
      setVapiStatus("error");
      setVapiError("Missing Vapi keys in .env.local");
      setLiveTranscript("Missing Vapi keys in .env.local");
      setLiveSpeaker("assistant");
      return;
    }

    if (
      vapiStartedRef.current ||
      vapiStatus === "starting" ||
      vapiStatus === "active"
    ) {
      return;
    }

    try {
      setMode("voice");
      setVapiError(null);
      setVapiStatus("starting");
      setVoiceMode(true);
      setVoiceState("starting");
      setLiveTranscript("Requesting microphone access...");
      setLiveSpeaker("assistant");

      await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (!vapiRef.current) {
        vapiRef.current = new Vapi(publicKey);
      }

      const vapi = vapiRef.current;
      vapiStartedRef.current = true;

      vapi.removeAllListeners?.();

      vapi.on("call-start", () => {
        if (!mountedRef.current) return;

        setVoiceMode(true);
        setVoiceState("listening");
        setVapiStatus("active");
        setVapiError(null);
        setLiveTranscript("Voice interview started. Speak after the recruiter finishes.");
        setLiveSpeaker("assistant");
      });

      vapi.on("speech-start", () => {
        if (!mountedRef.current) return;
        setVoiceState("speaking");
      });

      vapi.on("speech-end", () => {
        if (!mountedRef.current) return;
        setVoiceState("listening");
      });

      vapi.on("call-end", () => {
        if (!mountedRef.current) return;

        vapiStartedRef.current = false;
        setVoiceMode(false);
        setVoiceState("idle");
        setVapiStatus("ended");
        setVapiError(null);
        setLiveTranscript("Voice interview session ended.");
        setLiveSpeaker("assistant");
        endSession();
      });

      vapi.on("message", (message: any) => {
        if (!mountedRef.current) return;

        if (message?.type === "transcript") {
          const text = String(message?.transcript || "").trim();
          if (!text) return;

          const speaker = message.role === "user" ? "user" : "assistant";
          const isFinal =
            message.transcriptType === "final" ||
            message.isFinal === true ||
            message.final === true ||
            message.type === "transcript";

          setLiveSpeaker(speaker);
          setLiveTranscript(text);

          if (speaker === "assistant") {
            const previousLast =
              transcript.length > 0 ? transcript[transcript.length - 1]?.text : "";

            if (normalizeText(previousLast || "") !== normalizeText(text)) {
              addTranscript({
                speaker: "recruiter",
                text,
              });
            }
          }

          if (speaker === "user" && isFinal) {
            handleVoiceUserTranscript(text);
          }
        }

        if (message?.type === "end-of-call-report") {
          const reason = message?.endedReason || "unknown";
          setLiveTranscript(`Voice interview ended. Reason: ${reason}`);
          setLiveSpeaker("assistant");
        }
      });

      void vapi
        .start(assistantId, {
          variableValues: {
            targetRole,
            targetMarket,
            companyStyle,
            recruiterPersonality,
            recruiterName: recruiter.name,
            recruiterTitle: recruiter.title,
            recruiterVoiceGender,
            recruiterInstruction:
              recruiterVoiceGender === "male"
                ? "Use a professional male recruiter voice and tone."
                : "Use a professional female recruiter voice and tone.",
            recruiterMemory:
              recruiterMemory.length > 0
                ? recruiterMemory
                    .map((item) => `${item.label}: ${item.value}`)
                    .join("\n")
                : "No recruiter memory yet.",
            cvSummary: cvText
              ? cvText.slice(0, 2500)
              : "No CV uploaded. Ask role-relevant interview questions.",
            jobDescription: jobDescription
              ? jobDescription.slice(0, 2500)
              : "No job description provided.",
          },
        })
        .catch((error: unknown) => {
          if (!mountedRef.current) return;

          if (isNormalVapiEnd(error)) {
            setVapiStatus("ended");
            setVapiError(null);
            setLiveTranscript("Voice interview ended.");
          } else {
            const message = String((error as any)?.message || error || "");
            setVapiStatus("error");
            setVapiError(message || "Voice session could not start.");
            setLiveTranscript("Voice session could not start. Please try again.");
          }

          vapiStartedRef.current = false;
          setVoiceMode(false);
          setVoiceState("idle");
          setLiveSpeaker("assistant");
        });
    } catch (error) {
      if (isNormalVapiEnd(error)) {
        setVapiStatus("ended");
        setVapiError(null);
      } else {
        const message = String((error as any)?.message || error || "");
        setVapiStatus("error");
        setVapiError(message || "Microphone permission failed.");
        setLiveTranscript("Microphone permission failed. Please allow microphone access.");
      }

      vapiStartedRef.current = false;
      setVoiceMode(false);
      setVoiceState("idle");
      setLiveSpeaker("assistant");
    }
  };

  const startFreshInterview = () => {
    try {
      stopVoiceMode();
    } catch {
      // Voice session may already be stopped.
    }

    try {
      const keysToRemove: string[] = [];

      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (!key) continue;

        const lowerKey = key.toLowerCase();

        if (
          lowerKey.includes("workzo") ||
          lowerKey.includes("interview") ||
          lowerKey.includes("zustand")
        ) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach((key) => window.localStorage.removeItem(key));
      window.sessionStorage.clear();
    } catch {
      // Storage may be blocked in private mode.
    }

    window.location.href = "/onboarding";
  };

  const stopVoiceMode = () => {
    try {
      vapiStartedRef.current = false;
      setVapiStatus("ending");
      vapiRef.current?.stop();
    } catch (error) {
      if (isNormalVapiEnd(error)) {
        setVapiStatus("ended");
        setVapiError(null);
      } else {
        const message = String((error as any)?.message || error || "");
        setVapiStatus("error");
        setVapiError(message || "Voice interview could not stop cleanly.");
      }
    } finally {
      setVoiceMode(false);
      setVoiceState("idle");
      setLiveTranscript("Voice interview stopped.");
      setLiveSpeaker("assistant");
      endSession();
    }
  };

  const toggleMute = () => {
    if (!vapiRef.current) return;

    if (voiceState === "muted") {
      vapiRef.current.setMuted(false);
      setVoiceState("listening");
    } else {
      vapiRef.current.setMuted(true);
      setVoiceState("muted");
    }
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#020817] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-180px] top-[-120px] h-[520px] w-[520px] rounded-full bg-blue-600/18 blur-[130px]" />
        <div className="absolute right-[-180px] top-[-80px] h-[620px] w-[620px] rounded-full bg-cyan-400/10 blur-[150px]" />
        <div className="absolute bottom-[-260px] left-1/3 h-[520px] w-[520px] rounded-full bg-indigo-600/12 blur-[150px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
      </div>

      {normalizedInterruption?.shouldInterrupt && (
        <div className="fixed inset-x-4 top-24 z-50 mx-auto max-w-4xl rounded-[2rem] border border-red-400/35 bg-red-950/80 p-5 shadow-[0_24px_90px_rgba(239,68,68,0.22)] backdrop-blur-2xl">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-500/20">
              <ShieldAlert className="h-6 w-6 text-red-200" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.24em] text-red-200">
                Recruiter interruption
              </p>
              <p className="mt-2 text-xl font-black leading-8 text-white">
                “{normalizedInterruption.interruptionMessage}”
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1680px] flex-col px-4 py-4 md:px-6">
        <header className="mb-4 flex items-center justify-between rounded-[1.7rem] border border-white/10 bg-white/[0.055] px-4 py-3 shadow-2xl shadow-black/20 backdrop-blur-2xl md:px-5">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-blue-500/20">
              <Image
                src="/workzo_icon.png"
                alt="WorkZo AI"
                width={44}
                height={44}
                className="h-full w-full object-cover"
                priority
              />
            </div>
            <div>
              <h1 className="text-base font-black leading-tight md:text-xl">WorkZo AI</h1>
              <p className="text-xs text-slate-400">Real Interview AI · session memory active</p>
            </div>
          </Link>

          <div className="hidden items-center gap-3 md:flex">
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
              {targetRole}
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
              {targetMarket}
            </div>
            <div
              className={`rounded-full bg-gradient-to-r ${pressureColor(
                pressureLevel
              )} px-4 py-2 text-sm font-black text-white`}
            >
              {pressureCopy(pressureLevel)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-white/10 sm:flex"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <button
              onClick={startFreshInterview}
              className="hidden rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-100 transition hover:bg-red-500/20 md:block"
            >
              Start Fresh
            </button>

            <Link
              href="/results"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-white/10"
            >
              Results
            </Link>
          </div>
        </header>

        <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_410px] 2xl:grid-cols-[minmax(0,1fr)_440px]">
          <section className="grid gap-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="relative min-h-[520px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#050b16] shadow-2xl lg:min-h-[560px]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(59,130,246,0.28),rgba(2,6,23,0.26)_36%,rgba(2,6,23,0.98)_100%)]" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/70" />

                <div className="absolute left-5 top-5 z-10 rounded-2xl border border-white/10 bg-black/35 p-4 backdrop-blur-xl">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/20">
                      <Bot className="h-5 w-5 text-blue-200" />
                    </div>
                    <div>
                      <p className="text-sm font-black">AI Recruiter</p>
                      <p className="text-xs text-slate-400">
                        {voiceMode ? "Using Vapi Voice" : "Text + Voice ready"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-emerald-300">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                    {vapiStatus === "active" ? "Live" : "Ready"}
                  </div>
                </div>

                <div className="absolute right-5 top-5 z-10 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm backdrop-blur-xl">
                  <div className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-slate-400" />
                    <span>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>

                <div className="absolute inset-x-6 top-24 flex justify-center">
                  <div className="relative flex h-[390px] w-full max-w-[560px] items-end justify-center overflow-hidden rounded-b-[2.4rem]">
                    <div className="absolute inset-x-16 bottom-0 h-[330px] rounded-t-full bg-gradient-to-b from-slate-700/80 via-slate-900 to-black shadow-[0_0_100px_rgba(14,165,233,0.22)]" />
                    <div className="relative mb-8 flex h-56 w-56 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 via-orange-200 to-orange-600 text-8xl shadow-2xl">
                      {recruiter.avatar}
                      {speakingActive && (
                        <span className="absolute inset-[-12px] animate-ping rounded-full border border-cyan-300/35" />
                      )}
                    </div>
                    <div className="absolute bottom-0 h-40 w-[440px] rounded-t-[6rem] bg-gradient-to-br from-slate-100 via-slate-300 to-slate-700" />
                    <div className="absolute bottom-0 h-32 w-72 rounded-t-[4rem] bg-gradient-to-b from-white to-slate-300" />
                  </div>
                </div>

                <div className="absolute bottom-5 left-5 right-5 z-10">
                  <div className="rounded-[1.5rem] border border-white/10 bg-black/65 p-4 shadow-2xl backdrop-blur-2xl">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                      <div className="min-w-0">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-200">
                            {voiceState === "speaking"
                              ? "Recruiter speaking"
                              : voiceState === "listening"
                                ? "Listening"
                                : isThinking || isAnalyzingVoice
                                  ? "Analyzing"
                                  : "Recruiter says"}
                          </span>
                          <span className="rounded-full bg-amber-400/10 px-3 py-1.5 text-xs font-bold text-amber-200">
                            {pressureCopy(pressureLevel)}
                          </span>
                          <span className="rounded-full bg-purple-400/10 px-3 py-1.5 text-xs font-bold text-purple-200">
                            {emotionLabel(emotionState)}
                          </span>
                        </div>
                        <p className="text-lg font-black leading-7 text-white md:text-xl md:leading-8">
                          “{latestRecruiterLine}”
                        </p>
                      </div>
                      <Waveform
                        active={voiceState === "speaking" || isThinking || isAnalyzingVoice}
                        intense={pressureLevel > 70}
                        bars={28}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <aside className="hidden rounded-[2rem] border border-white/10 bg-white/[0.05] p-5 backdrop-blur-2xl xl:block">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-bold text-cyan-200">Recruiter state</p>
                    <h2 className="mt-2 text-2xl font-black">
                      {recruiter.name}
                    </h2>
                    <p className="text-sm text-slate-400">{recruiter.title}</p>
                  </div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/15 text-3xl">
                    {recruiter.avatar}
                  </div>
                </div>

                <div className="mt-6 rounded-3xl border border-white/10 bg-black/25 p-4">
                  <p className="text-sm italic leading-7 text-slate-300">
                    “{recruiter.quote}”
                  </p>
                </div>

                <div className="mt-6 space-y-5">
                  <ScoreBar label="Recruiter trust" value={trustScore} />
                  <ScoreBar label="Pressure" value={pressureLevel} hot />
                  <ScoreBar label="Evidence" value={liveScore.evidence} />
                  <ScoreBar label="Structure" value={liveScore.structure} />
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-black/25 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Score
                    </p>
                    <p className="mt-2 text-3xl font-black">{safeNumber(liveScore.overall)}%</p>
                  </div>
                  <div className="rounded-2xl bg-black/25 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Status
                    </p>
                    <p className="mt-2 text-lg font-black">{scoreLabel(liveScore.overall)}</p>
                  </div>
                </div>
              </aside>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.05] p-4 backdrop-blur-2xl md:p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-black md:text-xl">Your answer</h2>
                    <p className="text-sm text-slate-400">
                      Keep it specific, truthful, and tied to the role.
                    </p>
                  </div>
                  <button
                    onClick={() => setMode("text")}
                    className={`hidden rounded-2xl px-4 py-2 text-sm font-bold transition sm:block ${
                      mode === "text"
                        ? "bg-cyan-400/10 text-cyan-200"
                        : "bg-white/8 text-slate-300 hover:bg-white/12"
                    }`}
                  >
                    Text mode
                  </button>
                </div>

                <textarea
                  rows={4}
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                      void handleTextSubmit();
                    }
                  }}
                  placeholder="Type your answer here... Example: In my previous role, I reduced ticket resolution time by..."
                  className="min-h-[110px] w-full resize-none rounded-3xl border border-white/10 bg-[#050b16] p-4 text-base leading-7 outline-none placeholder:text-slate-600 focus:border-blue-400"
                />

                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-slate-500">
                    Tip: Press Ctrl/⌘ + Enter to submit.
                  </p>
                  <button
                    onClick={handleTextSubmit}
                    disabled={isThinking || !answer.trim()}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-400 px-6 py-3 font-black text-white shadow-[0_16px_38px_rgba(14,165,233,0.28)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isThinking ? "Recruiter thinking..." : "Submit Answer"}
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-white/[0.05] p-4 backdrop-blur-2xl md:p-5">
                <h2 className="text-lg font-black md:text-xl">Voice controls</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Use Vapi for a live recruiter call.
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  {!voiceMode ? (
                    <button
                      onClick={startVoiceMode}
                      className="col-span-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-400 px-5 py-4 font-black text-white shadow-[0_16px_38px_rgba(14,165,233,0.25)] transition hover:scale-[1.01]"
                    >
                      <Mic className="h-5 w-5" />
                      Start Voice Interview
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={toggleMute}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-4 py-4 font-bold transition hover:bg-white/12"
                      >
                        {voiceState === "muted" ? (
                          <Mic className="h-5 w-5" />
                        ) : (
                          <MicOff className="h-5 w-5" />
                        )}
                        {voiceState === "muted" ? "Unmute" : "Mute"}
                      </button>

                      <button
                        onClick={stopVoiceMode}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-4 font-bold text-red-200 transition hover:bg-red-500/20"
                      >
                        <PhoneOff className="h-5 w-5" />
                        Stop
                      </button>
                    </>
                  )}
                </div>

                {vapiError && (
                  <p className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {vapiError}
                  </p>
                )}

                {liveTranscript && (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                      {liveSpeaker === "user" ? "You are saying" : "Live transcript"}
                    </p>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-200">
                      {liveTranscript}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="grid gap-4 lg:grid-rows-[auto_minmax(320px,1fr)_auto]">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.05] p-5 backdrop-blur-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black">Live intelligence</h2>
                  <p className="text-sm text-slate-400">Scoring updates after each answer.</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/15">
                  <BarChart3 className="h-6 w-6 text-blue-200" />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-black/25 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Overall
                  </p>
                  <p className="mt-2 text-4xl font-black">{safeNumber(liveScore.overall)}%</p>
                </div>
                <div className="rounded-2xl bg-black/25 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Emotion
                  </p>
                  <p className="mt-2 text-xl font-black">{emotionLabel(emotionState)}</p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <ScoreBar label="Confidence" value={liveScore.confidence} />
                <ScoreBar label="Clarity" value={liveScore.clarity} />
                <ScoreBar label="Relevance" value={liveScore.relevance} />
                <ScoreBar label="Evidence" value={liveScore.evidence} />
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.05] p-5 backdrop-blur-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black">Transcript</h2>
                <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-slate-400">
                  {transcript.length} lines
                </span>
              </div>

              <div className="mt-4 max-h-[360px] space-y-3 overflow-y-auto pr-1">
                {transcriptPreview.length > 0 ? (
                  transcriptPreview.map((item, index) => (
                    <div
                      key={item.id || `${item.speaker}-${index}-${item.text?.slice(0, 10)}`}
                      className={`rounded-2xl p-4 text-sm leading-6 ${
                        item.speaker === "user"
                          ? "ml-7 bg-blue-500 text-white"
                          : "mr-7 border border-white/10 bg-black/25 text-slate-200"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-xs font-black uppercase tracking-[0.18em] opacity-70">
                          {item.speaker === "user" ? "You" : "Recruiter"}
                        </p>
                        {item.speaker !== "user" && (
                          <span className="rounded-full bg-white/8 px-2 py-1 text-[10px] text-cyan-200">
                            {emotionLabel(emotionState)}
                          </span>
                        )}
                      </div>
                      {item.text}
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm leading-6 text-slate-400">
                    Transcript appears during the interview.
                  </div>
                )}

                {(isThinking || isAnalyzingVoice) && (
                  <div className="mr-7 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">
                    <div className="flex items-center gap-3">
                      <Radio className="h-4 w-4 animate-pulse" />
                      Recruiter is analyzing your answer...
                    </div>
                  </div>
                )}

                <div ref={transcriptEndRef} />
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.05] p-5 backdrop-blur-2xl">
              <div className="flex items-center gap-3">
                <Brain className="h-5 w-5 text-cyan-300" />
                <h2 className="text-xl font-black">Recruiter memory</h2>
              </div>

              <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-400">
                {memorySummary}
              </p>

              <div className="mt-4 grid gap-3">
                {[
                  {
                    label: "Strengths",
                    value: strengths.length ? strengths.join(", ") : "Not enough signal yet.",
                    tone: "green",
                    icon: CheckCircle2,
                  },
                  {
                    label: "Weaknesses",
                    value: weaknesses.length ? weaknesses.join(", ") : "No repeated weakness yet.",
                    tone: "red",
                    icon: AlertTriangle,
                  },
                  {
                    label: "Improvements",
                    value: improvements.length ? improvements.join(", ") : "Answer once to receive targeted improvement.",
                    tone: "amber",
                    icon: Sparkles,
                  },
                  {
                    label: "Risks",
                    value:
                      risks.length || contradictions.length
                        ? [...risks, ...contradictions].join(", ")
                        : "No major risk detected yet.",
                    tone: "purple",
                    icon: Zap,
                  },
                ].map((card) => {
                  const Icon = card.icon;
                  const toneClass =
                    card.tone === "green"
                      ? "bg-emerald-500/10 text-emerald-200"
                      : card.tone === "red"
                        ? "bg-red-500/10 text-red-200"
                        : card.tone === "amber"
                          ? "bg-amber-500/10 text-amber-200"
                          : "bg-purple-500/10 text-purple-200";

                  return (
                    <div key={card.label} className={`rounded-2xl p-4 ${toneClass}`}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <p className="text-sm font-black">{card.label}</p>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-300">
                        {card.value}
                      </p>
                    </div>
                  );
                })}
              </div>

              {topicsMentioned.length > 0 && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                    Topics mentioned
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-300">
                    {topicsMentioned.join(", ")}
                  </p>
                </div>
              )}

              <Link
                href="/results"
                className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm font-black transition hover:bg-white/12"
              >
                View full report
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </aside>
        </div>
      </div>

      <div className="pointer-events-none fixed bottom-5 left-1/2 z-20 hidden -translate-x-1/2 rounded-full border border-white/10 bg-black/60 px-4 py-2 text-xs text-slate-400 backdrop-blur-xl md:block">
        <span className="inline-flex items-center gap-2">
          <Timer className="h-3.5 w-3.5" />
          Real Interview AI · memory, pressure, interruptions, voice
        </span>
      </div>
    </main>
  );
}
