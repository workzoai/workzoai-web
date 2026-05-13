"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Volume2,
  Zap,
} from "lucide-react";

import { useInterviewStore } from "@/store/interviewStore";
import {
  getRecruiterSystemBehavior,
  getRecruiterVoiceProfile,
  getVapiAssistantIdForRecruiter,
} from "@/lib/recruiterVoiceConfig";

type InterviewSetup = {
  cvText?: string;
  targetRole?: string;
  jobDescription?: string;
  targetMarket?: string;
  country?: string;
  companyStyle?: string;
  recruiterStyle?: string;
  recruiterPersonality?: string;
  language?: string;
};

type ScoreSet = {
  confidence: number;
  clarity: number;
  relevance: number;
  evidence: number;
  structure: number;
};

type MemoryBlock = {
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  risks: string[];
  contradictions?: string[];
  missingMetrics?: string[];
  vagueAnswers?: string[];
  repeatedPatterns?: string[];
  confidenceTrend?: number[];
  trustHistory?: number[];
  recruiterMoodHistory?: string[];
};

type Interruption = {
  shouldInterrupt: boolean;
  interruptionMessage: string;
  severity: "low" | "medium" | "high";
};

type TranscriptItem = {
  role: "recruiter" | "candidate" | "system";
  text: string;
  time: string;
};

type WowMoment = {
  shouldTrigger?: boolean;
  type?: string;
  line?: string;
  emotionalTag?: string;
  intensity?: "low" | "medium" | "high";
};

type TrustTimelineEvent = {
  time?: string;
  direction?: "up" | "down" | "stable";
  value?: number;
  reason?: string;
};

type RealtimeSignal = {
  type?: string;
  label?: string;
  message?: string;
  intensity?: "low" | "medium" | "high";
  delayMs?: number;
};

type LiveUiState = {
  theme?: string;
  glow?: string;
  recruiterExpression?: string;
  motion?: string;
  label?: string;
};

type InterviewArc = {
  phase?: "opening" | "probing" | "pressure" | "recovery" | "closing";
  instruction?: string;
};

type PsychologyReport = {
  finalDecision?: "continue" | "borderline" | "reject";
  finalPerception?: string;
  trustTimeline?: TrustTimelineEvent[];
  strongestSignal?: string;
  weakestPattern?: string;
  recoveryMoment?: string;
  biggestTrustDrop?: string;
  nextPracticeAction?: string;
};

type InterviewApiResponse = {
  question?: string;
  recruiterMessage?: string;
  followUpQuestion?: string;
  feedback?: string;
  mood?: string;
  emotion?: string;
  pressure?: number;
  recruiterTrust?: number;
  score?: Partial<ScoreSet>;
  scores?: Partial<ScoreSet>;
  memory?: Partial<MemoryBlock>;
  contradiction?: string;
  contradictions?: string[];
  interruption?: Interruption | string | null;
  wowMoment?: WowMoment;
  arc?: InterviewArc;
  trustTimeline?: TrustTimelineEvent[];
  liveUiState?: LiveUiState;
  realtimeSignals?: RealtimeSignal[];
  postInterviewPsychologyReport?: PsychologyReport;
};

type StoreLike = {
  setup?: InterviewSetup;
  interviewSetup?: InterviewSetup;
  setSetup?: (setup: InterviewSetup) => void;
  updateSetup?: (setup: InterviewSetup) => void;
  addAnswer?: (answer: string) => void;
  setResults?: (result: unknown) => void;
  updateResults?: (result: unknown) => void;
  resetInterview?: () => void;
};

const DEFAULT_QUESTION =
  "Good to meet you. Let’s begin. Tell me about yourself and keep it relevant to this position.";

const defaultMemory: MemoryBlock = {
  strengths: [],
  weaknesses: [],
  improvements: [],
  risks: [],
  contradictions: [],
  missingMetrics: [],
  vagueAnswers: [],
  repeatedPatterns: [],
  confidenceTrend: [],
  trustHistory: [],
  recruiterMoodHistory: [],
};

const defaultScores: ScoreSet = {
  confidence: 0,
  clarity: 0,
  relevance: 0,
  evidence: 0,
  structure: 0,
};

const waveform = [
  8, 18, 27, 12, 21, 34, 16, 24, 10, 29, 19, 36, 13, 23, 17, 31, 11, 22,
  15, 30, 18, 25, 12, 28, 14, 21, 9, 18, 13, 26, 11, 19, 8, 16,
];

const emotionTheme: Record<
  string,
  {
    glow: string;
    border: string;
    badge: string;
    label: string;
    wave: string;
  }
> = {
  neutral: {
    glow: "from-blue-500/26 via-cyan-500/8 to-transparent",
    border: "border-blue-300/20",
    badge: "bg-blue-400/12 text-blue-100",
    label: "Recruiter is listening closely",
    wave: "from-blue-500 via-cyan-300 to-emerald-300",
  },
  skeptical: {
    glow: "from-amber-500/35 via-blue-500/8 to-transparent",
    border: "border-amber-300/35",
    badge: "bg-amber-400/14 text-amber-100",
    label: "Recruiter is not fully convinced",
    wave: "from-amber-500 via-orange-300 to-cyan-300",
  },
  pressure: {
    glow: "from-rose-500/38 via-blue-500/8 to-transparent",
    border: "border-rose-300/40",
    badge: "bg-rose-400/14 text-rose-100",
    label: "Pressure is increasing",
    wave: "from-rose-500 via-orange-300 to-cyan-300",
  },
  impressed: {
    glow: "from-emerald-500/35 via-blue-500/8 to-transparent",
    border: "border-emerald-300/35",
    badge: "bg-emerald-400/14 text-emerald-100",
    label: "Recruiter confidence is improving",
    wave: "from-emerald-500 via-cyan-300 to-blue-300",
  },
  clarifying: {
    glow: "from-cyan-500/34 via-blue-500/8 to-transparent",
    border: "border-cyan-300/35",
    badge: "bg-cyan-400/14 text-cyan-100",
    label: "Recruiter is checking consistency",
    wave: "from-cyan-500 via-blue-300 to-emerald-300",
  },
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function safeNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function timeLabel() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSetupFromStore(store: StoreLike): InterviewSetup {
  return store.setup || store.interviewSetup || {};
}

function normalizeMemory(memory?: Partial<MemoryBlock>): MemoryBlock {
  return {
    strengths: memory?.strengths || [],
    weaknesses: memory?.weaknesses || [],
    improvements: memory?.improvements || [],
    risks: memory?.risks || [],
    contradictions: memory?.contradictions || [],
    missingMetrics: memory?.missingMetrics || [],
    vagueAnswers: memory?.vagueAnswers || [],
    repeatedPatterns: memory?.repeatedPatterns || [],
    confidenceTrend: memory?.confidenceTrend || [],
    trustHistory: memory?.trustHistory || [],
    recruiterMoodHistory: memory?.recruiterMoodHistory || [],
  };
}

function normalizeInterruption(value: InterviewApiResponse["interruption"]): Interruption | null {
  if (!value) return null;

  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return null;
    return {
      shouldInterrupt: true,
      interruptionMessage: text,
      severity: "medium",
    };
  }

  if (!value.interruptionMessage?.trim()) return null;

  return {
    shouldInterrupt: Boolean(value.shouldInterrupt),
    interruptionMessage: value.interruptionMessage,
    severity: value.severity || "medium",
  };
}

function getOverallScore(scores: ScoreSet) {
  const values = [
    scores.confidence,
    scores.clarity,
    scores.relevance,
    scores.evidence,
    scores.structure,
  ];
  const active = values.filter((item) => item > 0);
  if (!active.length) return 0;
  return Math.round(active.reduce((sum, item) => sum + item, 0) / active.length);
}

function getPressureLabel(pressure: number) {
  if (pressure >= 72) return "High pressure";
  if (pressure >= 42) return "Probing deeper";
  return "Calm pressure";
}

function recruiterEmoji(name: string) {
  if (name === "Sarah") return "👩🏻‍💼";
  if (name === "Priya") return "👩🏽‍💼";
  if (name === "Markus") return "👨🏼‍💼";
  return "👨🏻‍💼";
}

function normalizeThemeKey(state?: LiveUiState, mood?: string, pressure?: number, trust?: number) {
  const raw = (state?.theme || mood || "neutral").toLowerCase();

  if (raw.includes("pressure") || raw.includes("interrupt") || (pressure || 0) >= 70) return "pressure";
  if (raw.includes("skept") || raw.includes("doubt") || (trust || 50) < 42) return "skeptical";
  if (raw.includes("impress") || (trust || 0) >= 70) return "impressed";
  if (raw.includes("clarif")) return "clarifying";
  return "neutral";
}

function getSignalPhrase(label: string, value: number) {
  const normalized = label.toLowerCase();

  if (normalized.includes("pressure")) {
    if (value >= 70) return "High pressure";
    if (value >= 40) return "Probing deeper";
    return "Calm";
  }

  if (normalized.includes("trust")) {
    if (value >= 70) return "Trust rising";
    if (value >= 40) return "Still evaluating";
    return "Needs proof";
  }

  if (value >= 70) return "Strong";
  if (value >= 40) return "Building";
  if (value > 0) return "Weak";
  return "Awaiting answer";
}

export default function InterviewPage() {
  const router = useRouter();
  const store = useInterviewStore() as unknown as StoreLike;
  const setup = getSetupFromStore(store);

  const recruiterProfile = getRecruiterVoiceProfile(setup.recruiterPersonality);
  const recruiterBehavior = getRecruiterSystemBehavior(setup.recruiterPersonality);

  const [answer, setAnswer] = useState("");
  const [question, setQuestion] = useState(DEFAULT_QUESTION);
  const [feedback, setFeedback] = useState("");
  const [mood, setMood] = useState("neutral");
  const [pressure, setPressure] = useState(35);
  const [recruiterTrust, setRecruiterTrust] = useState(46);
  const [scores, setScores] = useState<ScoreSet>(defaultScores);
  const [memory, setMemory] = useState<MemoryBlock>(defaultMemory);
  const [contradictions, setContradictions] = useState<string[]>([]);
  const [interruption, setInterruption] = useState<Interruption | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [voiceStatus, setVoiceStatus] = useState("Voice ready");
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [clientTime, setClientTime] = useState("--:--");
  const [liveUiState, setLiveUiState] = useState<LiveUiState | null>(null);
  const [trustTimeline, setTrustTimeline] = useState<TrustTimelineEvent[]>([]);
  const [realtimeSignals, setRealtimeSignals] = useState<RealtimeSignal[]>([
    {
      type: "listening",
      label: "Listening",
      message: "Recruiter is evaluating clarity, proof, and ownership.",
      intensity: "low",
    },
  ]);
  const [wowMoment, setWowMoment] = useState<WowMoment | null>(null);
  const [interviewArc, setInterviewArc] = useState<InterviewArc | null>({
    phase: "opening",
    instruction: "Start professional and establish baseline confidence.",
  });
  const [postInterviewPsychologyReport, setPostInterviewPsychologyReport] =
    useState<PsychologyReport | null>(null);
  const [recruiterThinking, setRecruiterThinking] = useState(false);
  const [liveStatus, setLiveStatus] = useState("Recruiter is listening closely");
  const [transcript, setTranscript] = useState<TranscriptItem[]>([
    {
      role: "recruiter",
      text: DEFAULT_QUESTION,
      time: "--:--",
    },
  ]);

  const vapiRef = useRef<unknown>(null);
  const realtimeAbortRef = useRef<AbortController | null>(null);

  const role = setup.targetRole || "General Role";
  const market = setup.targetMarket || setup.country || "Global";
  const companyStyle = setup.companyStyle || setup.recruiterStyle || "Realistic";
  const overallScore = useMemo(() => getOverallScore(scores), [scores]);

  const themeKey = normalizeThemeKey(liveUiState || undefined, mood, pressure, recruiterTrust);
  const theme = emotionTheme[themeKey] || emotionTheme.neutral;

  const speakingText = recruiterThinking
    ? "Hmm... let me think about that for a moment."
    : interruption?.shouldInterrupt
      ? interruption.interruptionMessage
      : question;

  const arcLabel = interviewArc?.phase
    ? interviewArc.phase.charAt(0).toUpperCase() + interviewArc.phase.slice(1)
    : "Opening";

  useEffect(() => {
    setClientTime(timeLabel());
    const interval = window.setInterval(() => setClientTime(timeLabel()), 30_000);

    setTranscript((items) =>
      items.map((item, index) =>
        index === 0 && item.time === "--:--" ? { ...item, time: timeLabel() } : item
      )
    );

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const saved =
      window.localStorage.getItem("workzo-interview-setup") ||
      window.localStorage.getItem("workzo_setup");

    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as InterviewSetup;

      if (!setup.cvText && parsed.cvText) {
        if (typeof store.setSetup === "function") store.setSetup(parsed);
        else if (typeof store.updateSetup === "function") store.updateSetup(parsed);
      }
    } catch {
      // Ignore invalid storage.
    }
  }, []);

  useEffect(() => {
    if (!answer.trim() || answer.trim().length < 24) return;

    const timer = window.setTimeout(() => {
      realtimeAbortRef.current?.abort();

      const controller = new AbortController();
      realtimeAbortRef.current = controller;

      fetch("/api/interview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          mode: "realtime",
          partialAnswer: answer,
          elapsedSeconds: Math.min(120, Math.round(answer.trim().split(/\s+/).length / 2.1)),
          pressure,
          recruiterTrust,
          scores,
          memory,
        }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data?.realtimeSignals?.length) {
            setRealtimeSignals(data.realtimeSignals);
            setLiveStatus(data.primarySignal?.message || data.realtimeSignals[0]?.message || liveStatus);
          }
        })
        .catch(() => {
          // Ignore live signal failures so typing remains smooth.
        });
    }, 650);

    return () => window.clearTimeout(timer);
  }, [answer, pressure, recruiterTrust, scores, memory, liveStatus]);

  async function submitAnswer(event?: FormEvent) {
    event?.preventDefault();

    const candidateAnswer = answer.trim();
    if (!candidateAnswer || isSubmitting) return;

    setIsSubmitting(true);
    setRecruiterThinking(true);
    setLiveStatus("Recruiter is thinking");
    setFeedback("");
    setInterruption(null);
    setWowMoment(null);

    const nextTranscript: TranscriptItem[] = [
      ...transcript,
      {
        role: "candidate",
        text: candidateAnswer,
        time: clientTime !== "--:--" ? clientTime : timeLabel(),
      },
    ];

    setTranscript(nextTranscript);
    setAnswer("");

    try {
      if (typeof store.addAnswer === "function") store.addAnswer(candidateAnswer);

      await new Promise((resolve) => window.setTimeout(resolve, 850));

      const response = await fetch("/api/interview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          answer: candidateAnswer,
          currentQuestion: question,
          transcript: nextTranscript,
          setup,
          cvText: setup.cvText || "",
          jobDescription: setup.jobDescription || "",
          targetRole: role,
          country: market,
          targetMarket: market,
          companyStyle,
          recruiterPersonality: setup.recruiterPersonality,
          recruiterBehavior,
          recruiterName: recruiterProfile.name,
          recruiterRole: recruiterProfile.role,
          pressure,
          recruiterTrust,
          scores,
          memory,
          contradictions,
          trustTimeline,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as InterviewApiResponse;

      if (!response.ok) {
        throw new Error(data?.feedback || "Interview response failed");
      }

      const normalizedInterruption = normalizeInterruption(data.interruption);
      const nextQuestion =
        data.followUpQuestion ||
        data.question ||
        data.recruiterMessage ||
        "Let me push further. What was your specific contribution, and what changed because of it?";

      const mergedScores: ScoreSet = {
        confidence: safeNumber(data.score?.confidence ?? data.scores?.confidence, scores.confidence),
        clarity: safeNumber(data.score?.clarity ?? data.scores?.clarity, scores.clarity),
        relevance: safeNumber(data.score?.relevance ?? data.scores?.relevance, scores.relevance),
        evidence: safeNumber(data.score?.evidence ?? data.scores?.evidence, scores.evidence),
        structure: safeNumber(data.score?.structure ?? data.scores?.structure, scores.structure),
      };

      const uniqueContradictions = Array.from(
        new Set([
          ...contradictions,
          ...(data.contradiction ? [data.contradiction] : []),
          ...(data.contradictions || []),
        ].filter(Boolean))
      ).slice(-6);

      const normalizedMemory = normalizeMemory(data.memory);
      const recruiterText = normalizedInterruption?.shouldInterrupt
        ? normalizedInterruption.interruptionMessage
        : nextQuestion;

      const finalTranscript: TranscriptItem[] = [
        ...nextTranscript,
        {
          role: "recruiter",
          text: recruiterText,
          time: timeLabel(),
        },
      ];

      setQuestion(nextQuestion);
      setFeedback(data.feedback || "");
      setMood(data.mood || data.emotion || "neutral");
      setPressure(safeNumber(data.pressure, pressure));
      setRecruiterTrust(safeNumber(data.recruiterTrust, recruiterTrust));
      setScores(mergedScores);
      setMemory(normalizedMemory);
      setContradictions(uniqueContradictions);
      setInterruption(normalizedInterruption);
      setTranscript(finalTranscript);
      setWowMoment(data.wowMoment || null);
      setInterviewArc(data.arc || null);
      setTrustTimeline(data.trustTimeline || trustTimeline);
      setLiveUiState(data.liveUiState || null);
      setRealtimeSignals(data.realtimeSignals?.length ? data.realtimeSignals : realtimeSignals);
      setPostInterviewPsychologyReport(data.postInterviewPsychologyReport || null);
      setLiveStatus(data.liveUiState?.label || data.wowMoment?.emotionalTag || "Recruiter is listening closely");

      const resultsPayload = {
        setup,
        overallScore: getOverallScore(mergedScores),
        scores: mergedScores,
        memory: normalizedMemory,
        contradictions: uniqueContradictions,
        transcript: finalTranscript,
        recruiter: recruiterProfile,
        pressure: safeNumber(data.pressure, pressure),
        recruiterTrust: safeNumber(data.recruiterTrust, recruiterTrust),
        feedback: data.feedback || "",
        wowMoment: data.wowMoment || null,
        arc: data.arc || null,
        trustTimeline: data.trustTimeline || trustTimeline,
        liveUiState: data.liveUiState || null,
        realtimeSignals: data.realtimeSignals || [],
        postInterviewPsychologyReport: data.postInterviewPsychologyReport || null,
      };

      if (typeof store.setResults === "function") store.setResults(resultsPayload);
      if (typeof store.updateResults === "function") store.updateResults(resultsPayload);

      try {
        window.localStorage.setItem("workzo-last-results", JSON.stringify(resultsPayload));
      } catch {
        // Ignore storage issues.
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "The recruiter could not respond.";

      setFeedback(message);
      setTranscript([
        ...nextTranscript,
        {
          role: "system",
          text: message,
          time: timeLabel(),
        },
      ]);
    } finally {
      setRecruiterThinking(false);
      setIsSubmitting(false);
    }
  }

  async function startVoiceInterview() {
    setVoiceError("");

    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
      const assistantId = getVapiAssistantIdForRecruiter(setup.recruiterPersonality);

      if (!publicKey || !assistantId) {
        throw new Error(
          "Missing Vapi key or recruiter assistant ID. Add NEXT_PUBLIC_VAPI_PUBLIC_KEY and recruiter assistant IDs in .env.local."
        );
      }

      const VapiModule = await import("@vapi-ai/web");
      const Vapi = VapiModule.default;
      const vapi = new Vapi(publicKey);

      vapiRef.current = vapi;
      setVoiceStatus(`${recruiterProfile.name} voice connecting...`);
      setLiveStatus(`${recruiterProfile.name} voice connecting`);

      vapi.on("call-start", () => {
        setVoiceActive(true);
        setVoiceStatus(`${recruiterProfile.name} is listening`);
        setLiveStatus(`${recruiterProfile.name} is listening`);
      });

      vapi.on("call-end", () => {
        setVoiceActive(false);
        setVoiceStatus("Voice interview stopped");
        setLiveStatus("Recruiter is listening closely");
      });

      vapi.on("message", (message: unknown) => {
        const payload = message as {
          type?: string;
          transcript?: string;
          role?: "assistant" | "user";
          transcriptType?: string;
        };

        if (payload.type === "transcript" && payload.transcript && payload.transcriptType === "final") {
          setTranscript((items) => [
            ...items,
            {
              role: payload.role === "assistant" ? "recruiter" : "candidate",
              text: payload.transcript || "",
              time: timeLabel(),
            },
          ]);
        }
      });

      vapi.on("error", (error: unknown) => {
        const message = error instanceof Error ? error.message : "Voice interview error";
        setVoiceError(message);
        setVoiceStatus("Voice issue");
        setVoiceActive(false);
      });

      await vapi.start(assistantId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start voice interview.";
      setVoiceError(message);
      setVoiceStatus("Voice unavailable");
      setVoiceActive(false);
    }
  }

  async function stopVoiceInterview() {
    const current = vapiRef.current as { stop?: () => void } | null;
    current?.stop?.();
    setVoiceActive(false);
    setVoiceStatus("Voice interview stopped");
    setLiveStatus("Recruiter is listening closely");
  }

  function startFresh() {
    setAnswer("");
    setQuestion(DEFAULT_QUESTION);
    setFeedback("");
    setMood("neutral");
    setPressure(35);
    setRecruiterTrust(46);
    setScores(defaultScores);
    setMemory(defaultMemory);
    setContradictions([]);
    setInterruption(null);
    setTranscriptOpen(false);
    setLiveUiState(null);
    setTrustTimeline([]);
    setRealtimeSignals([
      {
        type: "listening",
        label: "Listening",
        message: "Recruiter is evaluating clarity, proof, and ownership.",
        intensity: "low",
      },
    ]);
    setWowMoment(null);
    setInterviewArc({
      phase: "opening",
      instruction: "Start professional and establish baseline confidence.",
    });
    setPostInterviewPsychologyReport(null);
    setRecruiterThinking(false);
    setLiveStatus("Recruiter is listening closely");
    setTranscript([
      {
        role: "recruiter",
        text: DEFAULT_QUESTION,
        time: clientTime !== "--:--" ? clientTime : timeLabel(),
      },
    ]);

    if (typeof store.resetInterview === "function") store.resetInterview();
  }

  function goToResults() {
    router.push("/results");
  }

  return (
    <main className="min-h-screen overflow-y-auto bg-[#020712] text-white lg:h-screen lg:overflow-hidden">
      <style jsx global>{`
        @keyframes wzPulseBar {
          0%, 100% { transform: scaleY(0.72); opacity: 0.68; }
          50% { transform: scaleY(1.18); opacity: 1; }
        }

        @keyframes wzLivePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.42); }
          50% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
        }

        @keyframes wzCameraBreath {
          0%, 100% { transform: scale(1) translateY(0); }
          50% { transform: scale(1.014) translateY(-2px); }
        }

        @keyframes wzEyeFocus {
          0%, 100% { opacity: .04; transform: translateX(-8px); }
          50% { opacity: .16; transform: translateX(10px); }
        }

        @keyframes wzTrustLine {
          from { stroke-dashoffset: 180; }
          to { stroke-dashoffset: 0; }
        }

        @keyframes wzScan {
          0% { transform: translateY(-80%); opacity: 0; }
          25% { opacity: 0.28; }
          60% { opacity: 0.52; }
          100% { transform: translateY(520%); opacity: 0; }
        }

        @keyframes wzTextPulse {
          0%, 100% { opacity: .78; }
          50% { opacity: 1; }
        }
      `}</style>

      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-260px] top-[-220px] h-[560px] w-[560px] rounded-full bg-blue-600/15 blur-[130px]" />
        <div className="absolute right-[-220px] top-[-160px] h-[580px] w-[580px] rounded-full bg-cyan-400/12 blur-[140px]" />
        <div className="absolute bottom-[-280px] left-1/2 h-[580px] w-[580px] -translate-x-1/2 rounded-full bg-indigo-600/12 blur-[140px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1540px] flex-col px-3 py-3 sm:px-5 lg:h-screen lg:min-h-0">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/[0.045] px-3 py-3 shadow-[0_20px_90px_rgba(0,0,0,0.32)] backdrop-blur-2xl sm:px-5 lg:h-[60px] lg:flex-nowrap lg:py-0">
          <Link href="/dashboard" className="flex items-center gap-3">
            <Image
              src="/workzo_icon.png"
              alt="WorkZo AI"
              width={38}
              height={38}
              className="rounded-2xl shadow-[0_0_28px_rgba(14,165,233,0.32)]"
            />
            <div>
              <p className="text-base font-black leading-tight sm:text-lg">WorkZo AI</p>
              <p className="hidden text-xs text-slate-400 sm:block">
                Real Interview AI · recruiter memory active
              </p>
            </div>
          </Link>

          <div className="hidden items-center gap-2 lg:flex">
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-bold text-slate-300">
              {role}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-bold text-slate-300">
              {market}
            </span>
            <span className={cn("rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.18em]", theme.badge, theme.border)}>
              {arcLabel}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-black text-slate-200 transition hover:bg-white/10 sm:px-4"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <button
              onClick={startFresh}
              className="inline-flex items-center gap-2 rounded-2xl border border-red-300/20 bg-red-500/10 px-3 py-2 text-sm font-black text-red-100 transition hover:bg-red-500/15 sm:px-4"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">Start Fresh</span>
            </button>
            <button
              onClick={goToResults}
              className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-black text-white transition hover:bg-white/10 sm:px-4"
            >
              Results
            </button>
          </div>
        </header>

        <section className="grid flex-1 gap-3 py-3 lg:min-h-0 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_390px]">
          <div className="grid gap-3 lg:min-h-0 lg:grid-rows-[minmax(0,1fr)_178px]">
            <section className={cn("relative h-[430px] overflow-hidden rounded-[26px] border bg-white/[0.045] shadow-[0_34px_120px_rgba(0,0,0,0.46)] backdrop-blur-2xl sm:h-[500px] lg:h-auto lg:min-h-0", theme.border)}>
              <div className="absolute inset-0">
                <Image
                  src="/workzo_recruiter_hero.png"
                  alt={`${recruiterProfile.name} recruiter interview`}
                  fill
                  priority
                  sizes="(min-width: 1024px) 70vw, 100vw"
                  className={cn(
                    "object-cover object-[center_34%] opacity-92 [animation:wzCameraBreath_9s_ease-in-out_infinite] sm:object-[center_37%]",
                    recruiterThinking && "scale-[1.01]"
                  )}
                />
                <div className={cn("absolute inset-0 bg-gradient-to-br opacity-80 transition-all duration-700", theme.glow)} />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,7,18,.68)_0%,rgba(2,7,18,.18)_38%,rgba(2,7,18,.26)_100%),linear-gradient(180deg,rgba(2,7,18,.06)_0%,rgba(2,7,18,.12)_44%,rgba(2,7,18,.78)_100%)]" />
                <div className="absolute inset-0 shadow-[inset_0_0_110px_rgba(0,0,0,.70)]" />
                <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-cyan-300/7 to-transparent [animation:wzScan_4s_ease-in-out_infinite]" />
                <div className="absolute left-[47%] top-[28%] h-20 w-44 rounded-full bg-white [animation:wzEyeFocus_5.5s_ease-in-out_infinite] blur-3xl" />
              </div>

              <div className="relative z-10 flex h-full min-h-0 flex-col justify-between p-3 sm:p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="rounded-2xl border border-white/8 bg-black/30 p-2 shadow-2xl backdrop-blur-md sm:p-2.5">
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-500/18 text-lg">
                        {recruiterEmoji(recruiterProfile.name)}
                        <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-slate-950 bg-emerald-400 [animation:wzLivePulse_1.8s_ease-in-out_infinite]" />
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">
                          AI Recruiter
                        </p>
                        <p className="mt-0.5 text-base font-black">{recruiterProfile.name}</p>
                        <p className="text-xs text-slate-300">{recruiterProfile.role}</p>
                      </div>
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-emerald-400/12 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
                        {voiceActive ? "Listening" : "Ready"}
                      </span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", theme.badge)}>
                        {liveStatus}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/28 px-3 py-2 backdrop-blur-md sm:px-4 sm:py-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
                      <Clock3 className="h-4 w-4 text-slate-400" />
                      {clientTime}
                    </div>
                  </div>
                </div>

                <div className="max-w-[680px] rounded-[20px] border border-white/10 bg-slate-950/62 px-5 py-3 shadow-[0_22px_75px_rgba(0,0,0,0.56)] backdrop-blur-2xl">
                  <div className="mb-2.5 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-emerald-400/12 px-3 py-1 text-xs font-black text-emerald-200">
                      Recruiter says
                    </span>
                    <span className={cn("rounded-full px-3 py-1 text-xs font-black", theme.badge)}>
                      {theme.label}
                    </span>
                    {interruption?.shouldInterrupt && (
                      <span className="rounded-full bg-red-400/14 px-3 py-1 text-xs font-black text-red-100">
                        Interruption
                      </span>
                    )}
                  </div>

                  <p className="text-[14px] font-black leading-[1.35] tracking-tight text-white sm:text-[16px] xl:text-[18px] [animation:wzTextPulse_2.2s_ease-in-out_infinite]">
                    “{speakingText}”
                  </p>

                  <div className={cn("mt-2 flex h-5 items-end gap-1 overflow-hidden", pressure >= 70 && "animate-pulse")}>
                    {waveform.map((height, index) => (
                      <span
                        key={index}
                        className={cn("w-1.5 shrink-0 origin-bottom rounded-full bg-gradient-to-t shadow-[0_0_10px_rgba(34,211,238,.28)]", theme.wave)}
                        style={{
                          height: Math.max(6, Math.round(height * (pressure >= 70 ? 1 : 0.78))),
                          animation: `wzPulseBar ${1.1 + (index % 5) * 0.12}s ease-in-out infinite`,
                          animationDelay: `${index * 0.035}s`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="grid min-h-0 gap-3 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_390px]">
              <form
                onSubmit={submitAnswer}
                className="flex min-h-[260px] flex-col rounded-[22px] border border-white/10 bg-white/[0.045] p-3 shadow-[0_18px_70px_rgba(0,0,0,0.24)] backdrop-blur-2xl lg:min-h-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-black sm:text-lg">Your answer</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      {answer.trim().split(/\s+/).filter(Boolean).length > 110 ? "You may be losing the point." : answer.trim().split(/\s+/).filter(Boolean).length > 30 ? "Daniel is listening for proof." : "Answer directly with result, action, impact."}
                    </p>
                  </div>
                  <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-200">
                    Text mode
                  </span>
                </div>

                <textarea
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  placeholder="Answer directly. Example: I reduced ticket resolution time by 25% by..."
                  className="mt-2 min-h-[130px] flex-1 resize-none rounded-3xl lg:min-h-0 border border-white/10 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.08),transparent_34%),#050b16] p-4 text-sm leading-6 text-white outline-none placeholder:text-slate-600 transition focus:border-cyan-300/50 focus:shadow-[0_0_26px_rgba(34,211,238,0.10)]"
                  onKeyDown={(event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                      void submitAnswer();
                    }
                  }}
                />

                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">
                    {recruiterThinking ? "Recruiter is thinking..." : "Tip: result → action → measurable impact."}
                  </p>
                  <button
                    type="submit"
                    disabled={!answer.trim() || isSubmitting}
                    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2 text-sm font-black text-white shadow-[0_0_30px_rgba(34,211,238,0.25)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {isSubmitting ? "Thinking..." : "Submit"}
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </form>

              <div className="rounded-[22px] border border-white/10 bg-white/[0.045] p-3 shadow-[0_18px_70px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-base font-black sm:text-lg">Voice mode</h2>
                    <p className="mt-1 text-sm text-slate-400">{voiceStatus}</p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-black",
                      voiceActive ? "bg-emerald-400/12 text-emerald-200" : "bg-white/8 text-slate-300"
                    )}
                  >
                    {voiceActive ? "Live" : "Ready"}
                  </span>
                </div>

                <div className="mt-2.5 rounded-3xl border border-white/10 bg-slate-950/60 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">
                        Recruiter voice
                      </p>
                      <p className="mt-1 font-black">
                        {recruiterProfile.name} · {recruiterProfile.voiceGender}
                      </p>
                    </div>
                    <Volume2 className="h-5 w-5 text-cyan-200" />
                  </div>

                  <div className="mt-2 flex h-6 items-end gap-1 overflow-hidden rounded-2xl bg-black/18 px-3 py-1">
                    {waveform.slice(0, 24).map((height, index) => (
                      <span
                        key={index}
                        className={cn("w-1 shrink-0 origin-bottom rounded-full bg-gradient-to-t", voiceActive ? theme.wave : "from-blue-500 to-cyan-300")}
                        style={{
                          height: Math.max(5, Math.round(height * 0.48)),
                          animation: `wzPulseBar ${1.1 + (index % 5) * 0.12}s ease-in-out infinite`,
                          animationDelay: `${index * 0.04}s`,
                        }}
                      />
                    ))}
                  </div>

                  {voiceError && (
                    <div className="mt-2.5 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
                      {voiceError}
                    </div>
                  )}

                  <button
                    onClick={voiceActive ? stopVoiceInterview : startVoiceInterview}
                    className={cn(
                      "mt-2.5 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-2 text-sm font-black text-white shadow-[0_16px_38px_rgba(14,165,233,.24)] transition hover:scale-[1.01]",
                      voiceActive
                        ? "bg-gradient-to-r from-red-500 to-rose-500"
                        : "bg-gradient-to-r from-blue-500 to-cyan-400"
                    )}
                  >
                    {voiceActive ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    {voiceActive ? "Stop Voice" : "Start Voice"}
                  </button>
                </div>
              </div>
            </section>
          </div>

          <aside className="grid gap-3 lg:min-h-0 lg:grid-rows-[196px_minmax(0,1fr)]">
            <section className="rounded-[22px] border border-white/10 bg-white/[0.045] p-3 shadow-[0_18px_70px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-black sm:text-lg">Recruiter perception</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {liveUiState?.label || "Live signals from this answer."}
                  </p>
                </div>
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", theme.badge)}>
                  <Brain className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-2.5 grid gap-2">
                {realtimeSignals.slice(0, 2).map((signal, index) => (
                  <div key={`${signal.label}-${index}`} className="rounded-2xl border border-white/10 bg-slate-950/46 p-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-white">{signal.label || "Listening"}</p>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-black", signal.intensity === "high" ? "bg-rose-400/14 text-rose-100" : signal.intensity === "medium" ? "bg-amber-400/14 text-amber-100" : "bg-blue-400/14 text-blue-100")}>
                        {signal.intensity || "low"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{signal.message}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="min-h-0 overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.045] p-3 shadow-[0_18px_70px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black">Recruiter memory</h2>
                <Brain className="h-5 w-5 text-cyan-200" />
              </div>
              <p className="mt-1 text-sm text-slate-400">
                What the recruiter is learning about you.
              </p>

              <div className="mt-2.5 grid gap-2">
                {wowMoment?.shouldTrigger && (
                  <div className="rounded-2xl border border-rose-300/25 bg-rose-500/12 p-3">
                    <div className="flex items-center gap-2 text-sm font-black text-rose-100">
                      <Zap className="h-4 w-4" />
                      Recruiter challenge
                    </div>
                    <p className="mt-2 text-sm leading-5 text-rose-50/90">{wowMoment.line}</p>
                  </div>
                )}

                {contradictions.length > 0 && (
                  <div className="rounded-2xl border border-red-300/20 bg-red-500/12 p-3">
                    <div className="flex items-center gap-2 text-sm font-black text-red-100">
                      <ShieldAlert className="h-4 w-4" />
                      Contradiction detected
                    </div>
                    <p className="mt-2 text-sm leading-5 text-red-50/90">
                      {contradictions[contradictions.length - 1]}
                    </p>
                  </div>
                )}

                <MemoryCard
                  title="What feels strong"
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  items={memory.strengths}
                  fallback={`${recruiterProfile.name} is waiting for one strong proof point.`}
                  color="emerald"
                />
                <MemoryCard
                  title="What worries the recruiter"
                  icon={<ShieldAlert className="h-4 w-4" />}
                  items={memory.weaknesses}
                  fallback={`${recruiterProfile.name} has not spotted a repeated weakness yet.`}
                  color="rose"
                />
                <MemoryCard
                  title="Fix next"
                  icon={<Sparkles className="h-4 w-4" />}
                  items={memory.improvements}
                  fallback={feedback || "Your next improvement will appear here."}
                  color="amber"
                />

                <div className="rounded-2xl border border-white/10 bg-slate-950/46 p-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
                      Recruiter trust
                    </p>
                    <span className="text-xs font-black text-slate-300">{recruiterTrust}/100</span>
                  </div>

                  <TrustSparkline values={trustTimeline.length ? trustTimeline.slice(-8).map((event) => event.value || recruiterTrust) : [46, recruiterTrust]} />

                  <div className="mt-2 space-y-2">
                    {trustTimeline.length ? (
                      trustTimeline.slice(-2).map((event, index) => (
                        <div key={`${event.time}-${index}`} className="rounded-xl bg-white/[0.04] px-3 py-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5 font-black text-white">
                              {event.direction === "up" ? <TrendingUp className="h-3.5 w-3.5 text-emerald-200" /> : event.direction === "down" ? <TrendingDown className="h-3.5 w-3.5 text-rose-200" /> : <Brain className="h-3.5 w-3.5 text-blue-200" />}
                              {event.direction === "up" ? "Trust improved" : event.direction === "down" ? "Trust dropped" : "Trust stable"}
                            </span>
                            <span className="text-slate-400">{event.value || recruiterTrust}/100</span>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-slate-400">{event.reason}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs leading-5 text-slate-400">Timeline starts after your first answer.</p>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setTranscriptOpen((value) => !value)}
                className="mt-2.5 inline-flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-2.5 text-sm font-black text-white transition hover:bg-white/12"
              >
                Transcript · {transcript.length} lines
                <ChevronDown className={cn("h-4 w-4 transition", transcriptOpen && "rotate-180")} />
              </button>

              {transcriptOpen && (
                <div className="mt-2 max-h-[180px] overflow-y-auto rounded-2xl lg:max-h-[120px] border border-white/10 bg-slate-950/55 p-3">
                  <div className="space-y-3">
                    {transcript.slice(-6).map((item, index) => (
                      <div key={`${item.time}-${index}`}>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                          {item.role} · {item.time}
                        </p>
                        <p className="mt-1 text-sm leading-5 text-slate-200">{item.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={goToResults}
                className="mt-2.5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-black text-white transition hover:bg-white/14"
              >
                View full report
                <ArrowRight className="h-4 w-4" />
              </button>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}


function TrustSparkline({ values }: { values: number[] }) {
  const normalized = values.length ? values : [46, 46];
  const width = 280;
  const height = 54;
  const step = width / Math.max(1, normalized.length - 1);
  const points = normalized
    .map((value, index) => {
      const x = index * step;
      const y = height - (Math.max(0, Math.min(100, value)) / 100) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg className="mt-3 h-[54px] w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="trustLineGradient" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="52%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke="url(#trustLineGradient)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        style={{ strokeDasharray: 180, animation: "wzTrustLine 1.3s ease-out both" }}
      />
      {normalized.map((value, index) => {
        const x = index * step;
        const y = height - (Math.max(0, Math.min(100, value)) / 100) * height;
        return <circle key={index} cx={x} cy={y} r="3.4" fill="#67e8f9" />;
      })}
    </svg>
  );
}

function MemoryCard({
  title,
  icon,
  items,
  fallback,
  color,
}: {
  title: string;
  icon: ReactNode;
  items: string[];
  fallback: string;
  color: "emerald" | "rose" | "amber";
}) {
  const colorClass = {
    emerald: "bg-emerald-500/11 text-emerald-100 border-emerald-300/10",
    rose: "bg-rose-500/11 text-rose-100 border-rose-300/10",
    amber: "bg-amber-500/11 text-amber-100 border-amber-300/10",
  }[color];

  return (
    <div className={cn("rounded-2xl border p-2.5", colorClass)}>
      <div className="flex items-center gap-2 text-sm font-black">
        {icon}
        {title}
      </div>
      <div className="mt-2 space-y-1">
        {items.length ? (
          items.slice(0, 2).map((item) => (
            <p key={item} className="text-sm leading-5 text-white/86">
              {item}
            </p>
          ))
        ) : (
          <p className="text-sm leading-5 text-white/76">{fallback}</p>
        )}
      </div>
    </div>
  );
}
