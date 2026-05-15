"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  Bookmark,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileText,
  Home,
  Maximize2,
  MessageSquare,
  Mic,
  MicOff,
  PhoneOff,
  Settings,
  ShieldCheck,
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
import {
  getRecruiterVoiceProfile,
  getVapiAssistantIdForRecruiter,
} from "@/lib/recruiterVoiceConfig";
import { trackWorkZoEvent } from "@/lib/workzoAnalytics";

const TavusRecruiterPanel = dynamic(
  () => import("@/components/interview/TavusRecruiterPanel"),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center bg-[#060b18]">
        <div className="rounded-[22px] border border-white/[0.06] bg-white/[0.05] p-5 text-center">
          <Video className="mx-auto h-7 w-7 text-cyan-200" />
          <p className="mt-3 text-sm font-black text-white">
            Preparing live video...
          </p>
        </div>
      </div>
    ),
  },
);

type TranscriptItem = {
  role: "recruiter" | "candidate" | "system";
  text: string;
  time: string;
};

type VapiClient = {
  start: (
    assistantId: string,
    options?: Record<string, unknown>,
  ) => Promise<unknown> | unknown;
  stop: () => void;
  on: (event: string, callback: (...args: unknown[]) => void) => void;
};

type InterviewMode = "standard" | "video";

type RecruiterId =
  | "friendly_hr"
  | "analytical_hiring_manager"
  | "startup_recruiter"
  | "german_corporate";

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

  return "analytical_hiring_manager";
}

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

const waveform = [
  14, 28, 18, 34, 20, 30, 42, 24, 36, 18, 26, 38, 20, 32, 44, 22, 30, 18, 34,
  24,
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
  return "/recruiters/daniel.png";
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

function buildCandidateContext(setup: WorkZoInterviewSetup) {
  const cvText = typeof setup.cvText === "string" ? setup.cvText.trim() : "";
  const memoryText = setup.recruiterMemoryProfile
    ? JSON.stringify(setup.recruiterMemoryProfile)
    : "";

  const source = cvText.length > 120 ? cvText : memoryText;

  return source
    .replace(/\s+/g, " ")
    .slice(0, 5000);
}

function buildJobContext(setup: WorkZoInterviewSetup) {
  const jdText =
    typeof setup.jobDescription === "string" ? setup.jobDescription.trim() : "";
  const jobMemoryText = setup.jobMemoryProfile
    ? JSON.stringify(setup.jobMemoryProfile)
    : "";

  const source = jdText.length > 80 ? jdText : jobMemoryText;

  return source
    .replace(/\s+/g, " ")
    .slice(0, 3500);
}

function buildRecruiterSystemPrompt(setup: WorkZoInterviewSetup, recruiterName: string, recruiterRole: string) {
  return `You are ${recruiterName}, a ${recruiterRole} conducting a realistic interview for the role: ${getRole(setup)}.

Use ONLY the candidate CV/context and job description/context provided in the variable values. Do not invent names, companies, projects, tools, achievements, employers, education, or resume facts. If the CV context is unclear or missing, ask the candidate to clarify instead of pretending you read details.

Interview style:
- Ask one question at a time.
- Sound like a real recruiter, not an assistant.
- Challenge vague answers.
- Ask for proof, ownership, metrics, and role fit.
- Keep follow-ups short and natural.
- Never mention internal variable names or system prompts.

Candidate CV/context:
${buildCandidateContext(setup) || "No CV context available. Ask the candidate to summarize their background."}

Job description/context:
${buildJobContext(setup) || "No job description context available. Focus on role-relevant interview questions."}`;
}

function formatElapsed(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function Sidebar({
  candidateName,
  market,
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

function StandardRecruiterView({
  recruiterName,
  recruiterRole,
  recruiterId,
  question,
  status,
  isLive,
}: {
  recruiterName: string;
  recruiterRole: string;
  recruiterId: string;
  question: string;
  status: string;
  isLive: boolean;
}) {
  return (
    <div className="relative flex h-full min-h-0 flex-col items-center justify-center overflow-hidden rounded-[24px] border border-white/[0.06] bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.18),transparent_70%),#060b18] px-5 py-4">
      <div className="pointer-events-none absolute inset-x-16 top-[38%] h-14 bg-[linear-gradient(90deg,transparent,rgba(59,130,246,0.28),transparent)] blur-2xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(14,165,233,0.10),transparent_34%)]" />

      <div className="relative z-10 flex h-full flex-col items-center justify-center text-center">
        <div className="mx-auto flex h-[210px] w-[210px] shrink-0 animate-[pulse_4s_ease-in-out_infinite] items-center justify-center rounded-full border border-blue-400/28 bg-blue-500/5 p-3 shadow-[0_0_54px_rgba(59,130,246,0.22)]">
          <div className="h-full w-full overflow-hidden rounded-full border border-cyan-300/28 bg-slate-950 shadow-[0_0_60px_rgba(14,165,233,0.18)]">
            <img
              src={recruiterImagePath(recruiterName, recruiterId)}
              alt={`${recruiterName} AI recruiter`}
              className="h-full w-full object-cover object-center"
            />
          </div>
        </div>

        <div className="mx-auto mt-1.5 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-200">
          <span className="h-2 w-2 rounded-full bg-emerald-300" />
          {recruiterName} · {recruiterRole}
        </div>

        <p className="mx-auto mt-2.5 max-w-[720px] text-[26px] font-bold leading-[1.15] tracking-[-0.03em] text-white">
          {question}
        </p>

        <div className="mt-1.5 flex items-center justify-center gap-2">
          <span className="text-xs font-medium text-slate-500">{status}</span>
          <div className="flex h-6 items-end gap-1">
            {waveform.slice(0, 8).map((height, index) => (
              <span
                key={index}
                className={cn(
                  "w-1.5 rounded-full bg-gradient-to-t from-blue-500 via-cyan-300 to-violet-400",
                  isLive && "animate-pulse",
                )}
                style={{ height: Math.max(6, height * 0.5) }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailCard({
  role,
  company,
  market,
}: {
  role: string;
  company: string;
  market: string;
  language?: string;
}) {
  const rows = [
    ["Role", role],
    ["Company", company],
    ["Market", market],
    ["Type", "Behavioral + Technical"],
  ];

  return (
    <section className="h-[118px] rounded-[18px] border border-white/[0.06] bg-white/[0.045] p-3.5 shadow-[0_16px_60px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
      <h2 className="text-sm font-black">Interview Details</h2>
      <div className="mt-1 grid grid-cols-1 gap-1">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="grid grid-cols-[58px_1fr] gap-2 text-[11px] leading-4"
          >
            <p className="text-slate-400">{label}</p>
            <p className="truncate text-right text-[12px] font-semibold text-white">
              {value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function NotesCard({ recruiterName }: { recruiterName: string }) {
  const notes = [
    `${recruiterName} listens for proof and role fit.`,
    "Use one concrete example.",
    "Add measurable impact.",
  ];

  return (
    <section className="h-[128px] rounded-[18px] border border-white/[0.06] bg-white/[0.045] p-3.5 shadow-[0_14px_48px_rgba(0,0,0,0.20)] backdrop-blur-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black">AI Notes</h2>
        <span className="rounded-xl bg-violet-500/20 p-2 text-violet-200">
          <Sparkles className="h-4 w-4" />
        </span>
      </div>
      <ul className="mt-2 space-y-1 text-xs leading-4 text-slate-300">
        {notes.map((note) => (
          <li key={note} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-300" />
            {note}
          </li>
        ))}
      </ul>
    </section>
  );
}

function TranscriptCard({ transcript, recruiterName, recruiterRole }: { transcript: TranscriptItem[]; recruiterName: string; recruiterRole: string }) {
  const items = transcript.length
    ? transcript
    : [
        {
          role: "recruiter" as const,
          text: "Tell me about a challenging project you worked on and how you handled it.",
          time: "00:12",
        },
      ];

  return (
    <section className="min-h-0 flex-1 rounded-[18px] border border-white/[0.06] bg-white/[0.045] p-3.5 shadow-[0_16px_60px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
      <h2 className="text-sm font-black">Live Transcript</h2>
      <div className="mt-2 h-[calc(100%-28px)] min-h-0 space-y-3 overflow-y-auto pr-1">
        {items.slice(-10).map((item, index) => (
          <div
            key={`${item.time}-${index}`}
            className="border-l-2 border-violet-400/60 pl-3"
          >
            <div className="flex items-center gap-3">
              <p
                className={cn(
                  "text-sm font-black",
                  item.role === "candidate" ? "text-white" : "text-violet-200",
                )}
              >
                {item.role === "candidate"
                  ? "You"
                  : item.role === "system"
                    ? "System"
                    : "AI Recruiter"}
              </p>
              <p className="text-xs text-slate-500">{item.time}</p>
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-300">{item.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function InterviewPage() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [activeSetup, setActiveSetup] = useState<WorkZoInterviewSetup>(() =>
    normalizeSetup(readLatestInterviewSetup()),
  );
  const [mode, setMode] = useState<InterviewMode>("standard");
  const [isLive, setIsLive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [voiceStatus, setVoiceStatus] = useState("Ready to start");
  const [voiceError, setVoiceError] = useState("");
  const [question, setQuestion] = useState(
    "Tell me about a challenging project you worked on and how you handled it.",
  );
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);

  const vapiRef = useRef<VapiClient | null>(null);

  useEffect(() => {
    const originalConsoleError = console.error;

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

      const ignoredErrors = [
        "Error unloading krisp processor",
        "WASM_OR_WORKER_NOT_READY",
        "Meeting ended in error",
        "Meeting ended due to ejection",
        "Meeting has ended",
      ];

      if (ignoredErrors.some((errorText) => message.includes(errorText))) {
        return;
      }

      originalConsoleError(...args);
    };

    return () => {
      console.error = originalConsoleError;
    };
  }, []);

  const recruiterProfile = useMemo(
    () => getRecruiterVoiceProfile(activeSetup.recruiterPersonality),
    [activeSetup.recruiterPersonality],
  );

  const role = getRole(activeSetup);
  const company = getCompany(activeSetup);
  const market = activeSetup.targetMarket || "Global";
  const candidateName = getCandidateName(activeSetup);

  useEffect(() => {
    const latest = normalizeSetup(readLatestInterviewSetup());
    setActiveSetup(latest);
    setIsHydrated(true);

    trackWorkZoEvent({
      event: "interview_room_viewed",
      setupId: latest.setupId,
      role: getRole(latest),
      market: latest.targetMarket,
      recruiter: getRecruiterVoiceProfile(latest.recruiterPersonality).name,
    });

    return () => {
      try {
        (vapiRef.current as VapiClient | null)?.stop();
      } catch {
        // ignore stale cleanup
      }

      vapiRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isLive) return;

    const timer = window.setInterval(() => {
      setElapsed((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isLive]);

  const persistResults = useCallback(() => {
    try {
      window.localStorage.setItem(
        "workzo-last-results",
        JSON.stringify({
          setup: activeSetup,
          overallScore: 0,
          recruiterTrust: 72,
          pressure: mode === "video" ? 42 : 36,
          transcript,
          scores: {},
          memory: {
            strengths: ["Session started with recruiter simulation."],
            weaknesses: [],
            improvements: ["Add measurable results and clear ownership."],
            risks: [],
          },
        }),
      );
    } catch {
      // ignore storage errors
    }
  }, [activeSetup, mode, transcript]);

  const startStandardVoice = useCallback(async () => {
    setVoiceError("");
    setVoiceStatus("Connecting...");
    setElapsed(0);
    setQuestion("Tell me about yourself and connect your background to this role.");
    setTranscript([]);

    const setup = saveLatestInterviewSetup(
      normalizeSetup(readLatestInterviewSetup()),
    );
    setActiveSetup(setup);

    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
      const assistantId = getVapiAssistantIdForRecruiter(
        setup.recruiterPersonality,
      );

      if (!publicKey) {
        throw new Error("Standard voice is missing NEXT_PUBLIC_VAPI_PUBLIC_KEY.");
      }

      if (!assistantId) {
        throw new Error("Standard voice is missing the Vapi assistant ID for this recruiter.");
      }

      try {
        (vapiRef.current as VapiClient | null)?.stop();
      } catch {
        // ignore
      }

      const VapiModule = await import("@vapi-ai/web");
      const Vapi = VapiModule.default;
      const vapi = new Vapi(publicKey) as unknown as VapiClient;

      vapiRef.current = vapi;

      vapi.on("call-start", () => {
        setIsLive(true);
        setVoiceStatus("Listening...");
        setTranscript((items) => [
          ...items,
          {
            role: "recruiter",
            text: "Tell me about yourself and connect your background to this role.",
            time: timeLabel(),
          },
        ]);

        trackWorkZoEvent({
          event: "voice_started",
          setupId: setup.setupId,
          role: getRole(setup),
          market: setup.targetMarket,
          recruiter: recruiterProfile.name,
          mode: "voice",
        });
      });

      vapi.on("call-end", () => {
        setIsLive(false);
        setVoiceStatus("Interview ended");
        persistResults();
      });

      vapi.on("message", (message: unknown) => {
        const payload = message as {
          type?: string;
          transcript?: string;
          role?: "assistant" | "user";
          transcriptType?: string;
        };

        if (
          payload.type === "transcript" &&
          payload.transcript &&
          payload.transcriptType === "final"
        ) {
          const transcriptRole: TranscriptItem["role"] =
            payload.role === "assistant" ? "recruiter" : "candidate";

          if (transcriptRole === "recruiter") setQuestion(payload.transcript);

          setTranscript((items): TranscriptItem[] =>
            [
              ...items,
              {
                role: transcriptRole,
                text: payload.transcript || "",
                time: timeLabel(),
              },
            ].slice(-40),
          );
        }
      });

      vapi.on("error", (error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Standard voice failed.";
        setVoiceError(message);
        setVoiceStatus("Voice unavailable");
        setIsLive(false);
      });

      const liveRecruiterProfile = getRecruiterVoiceProfile(setup.recruiterPersonality);
      const startPayload = {
        variableValues: {
          recruiterName: liveRecruiterProfile.name,
          recruiterRole: liveRecruiterProfile.role,
          targetRole: getRole(setup),
          targetMarket: setup.targetMarket || "Global",
          candidateCv: buildCandidateContext(setup),
          jobDescription: buildJobContext(setup),
          recruiterInstructions: buildRecruiterSystemPrompt(
            setup,
            liveRecruiterProfile.name,
            liveRecruiterProfile.role,
          ),
        },
      };

      try {
        await vapi.start(assistantId, startPayload);
      } catch {
        // Some Vapi assistant configurations reject runtime variable payloads.
        // Fall back to assistant-only start so the voice call can still begin.
        await vapi.start(assistantId);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not start standard voice. Check Vapi public key and assistant ID.";
      setVoiceError(message || "Standard voice failed. Check Vapi public key and assistant ID.");
      setVoiceStatus("Voice unavailable");
      setIsLive(false);
    }
  }, [persistResults]);

  const endInterview = useCallback(() => {
    try {
      (vapiRef.current as VapiClient | null)?.stop();
    } catch {
      // ignore
    }

    vapiRef.current = null;
    persistResults();
    setIsLive(false);
    setVoiceStatus("Interview ended");

    trackWorkZoEvent({
      event: "voice_stopped",
      setupId: activeSetup.setupId,
      role,
      market,
      recruiter: recruiterProfile.name,
      mode: "voice",
    });
  }, [
    activeSetup.setupId,
    market,
    persistResults,
    recruiterProfile.name,
    role,
  ]);

  if (!isHydrated) {
    return (
      <main className="h-screen bg-[#020712] p-4 text-white">
        <div className="h-full animate-pulse rounded-[24px] border border-white/[0.06] bg-white/[0.045]" />
      </main>
    );
  }

  return (
    <main className="h-screen overflow-hidden bg-[linear-gradient(180deg,#06111f_0%,#050816_100%)] p-4 text-white">
      <div className="grid h-[calc(100vh-24px)] grid-cols-1 gap-4 overflow-hidden xl:grid-cols-[240px_minmax(0,1fr)_300px]">
        <Sidebar candidateName={candidateName} market={market} setupId={activeSetup.setupId} />

        <section className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
          <header className="mb-0 flex h-[46px] shrink-0 items-center justify-between gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-3 text-sm font-medium text-slate-300 hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
              Back to Interviews
            </Link>

            <div className="hidden text-center sm:block">
              <p className="flex items-center justify-center gap-2 text-sm font-black">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    isLive ? "bg-emerald-300" : "bg-slate-500",
                  )}
                />
                {isLive ? "Interview in Progress" : "Interview Room Ready"}
              </p>
              <p className="mt-1 flex items-center justify-center gap-2 text-xs text-slate-300">
                <span className="h-2 w-2 rounded-full bg-emerald-300" />
                {formatElapsed(elapsed)}
              </p>
            </div>

            <button
              type="button"
              onClick={endInterview}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-red-400/40 bg-red-500/8 px-5 text-sm font-black text-red-300 hover:bg-red-500/14"
            >
              <PhoneOff className="h-4 w-4" />
              End Interview
            </button>
          </header>

          <section className="grid min-h-0 flex-1 grid-rows-[48px_auto_minmax(0,1fr)_44px] overflow-hidden rounded-[22px] border border-white/[0.06] bg-white/[0.04] p-3 shadow-[0_20px_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
            <div className="flex min-h-0 items-start justify-between gap-4">
              <div>
                <h1 className="line-clamp-2 max-w-[430px] text-[18px] font-black leading-tight">
                  {role}
                </h1>
                <p className="mt-1 text-xs text-slate-300">{company}</p>
              </div>

              <div className="flex h-[42px] w-[300px] items-center justify-center rounded-full border border-white/[0.06] bg-black/20 p-1">
                <button
                  type="button"
                  onClick={() => setMode("standard")}
                  className={cn(
                    "h-full flex-1 rounded-full text-sm font-black transition",
                    mode === "standard"
                      ? "bg-white/10 text-white"
                      : "text-slate-400 hover:text-white",
                  )}
                >
                  <Mic className="mr-2 inline h-4 w-4" />
                  Standard Voice
                </button>
                <button
                  type="button"
                  onClick={() => setMode("video")}
                  className={cn(
                    "h-full flex-1 rounded-full text-sm font-black transition",
                    mode === "video"
                      ? "bg-violet-500/25 text-white"
                      : "text-slate-400 hover:text-white",
                  )}
                >
                  <Video className="mr-2 inline h-4 w-4" />
                  Live Video
                </button>
              </div>

              <div className="flex gap-3">
                <button className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.045]">
                  <Maximize2 className="h-5 w-5" />
                </button>
                <button className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.045]">
                  <Settings className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
              <p className="inline-flex items-center gap-2 text-xs font-black text-emerald-200">
                <ShieldCheck className="h-4 w-4" />
                Smart fallback enabled
              </p>
              <p className="text-xs text-slate-300">
                If video is unavailable, WorkZo continues in Standard Voice.
              </p>
            </div>

            <div className="relative min-h-0 overflow-hidden">
              {mode === "video" ? (
                <div className="absolute inset-0 overflow-hidden rounded-[24px] bg-[#060b18]">
                  <TavusRecruiterPanel
                    recruiterName={recruiterProfile.name}
                    recruiterTrust={72}
                    pressure={42}
                    onStarted={() => {
                      setIsLive(true);
                      setElapsed(0);
                      setVoiceStatus("Video interview live");
                    }}
                    onEnded={() => {
                      setIsLive(false);
                      setVoiceStatus("Video interview ended");
                      persistResults();
                    }}
                    onUnavailable={() => {
                      setMode("standard");
                      setVoiceStatus("Standard voice ready");
                    }}
                  />
                </div>
              ) : (
                <StandardRecruiterView
                  recruiterName={recruiterProfile.name}
                  recruiterRole={recruiterProfile.role}
                  recruiterId={activeSetup.recruiterPersonality}
                  question={question}
                  status={voiceStatus}
                  isLive={isLive}
                />
              )}
            </div>

            {voiceError && (
              <div className="mt-2 rounded-xl border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                {voiceError}
              </div>
            )}

            <div className="mt-3 grid shrink-0 grid-cols-5 gap-4">
              <button
                type="button"
                onClick={() => setIsMuted((value) => !value)}
                className="flex h-[40px] items-center justify-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.045] text-sm font-black hover:bg-white/[0.07]"
              >
                {isMuted ? (
                  <MicOff className="h-5 w-5" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
                {isMuted ? "Muted" : "Mic On"}
                <span className="h-2 w-2 rounded-full bg-emerald-300" />
              </button>

              <button
                type="button"
                onClick={() => setSpeakerOn((value) => !value)}
                className="flex h-[40px] items-center justify-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.045] text-sm font-black hover:bg-white/[0.07]"
              >
                {speakerOn ? (
                  <Volume2 className="h-5 w-5" />
                ) : (
                  <VolumeX className="h-5 w-5" />
                )}
                Speaker
                <span className="h-2 w-2 rounded-full bg-emerald-300" />
              </button>

              {isLive ? (
                <button
                  type="button"
                  onClick={endInterview}
                  className="flex h-[46px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-500 to-rose-600 text-sm font-black text-white shadow-[0_18px_55px_rgba(244,63,94,0.28)]"
                >
                  <PhoneOff className="h-5 w-5" />
                  End Interview
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startStandardVoice}
                  className="flex h-[42px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-violet-600 text-sm font-black text-white shadow-[0_10px_26px_rgba(59,130,246,0.18)]"
                >
                  <Mic className="h-5 w-5" />
                  Start Voice
                </button>
              )}

              <button className="flex h-[40px] items-center justify-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.045] text-sm font-black hover:bg-white/[0.07]">
                <FileText className="h-5 w-5" />
                Notes
              </button>

              <button className="flex h-[40px] items-center justify-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.045] text-sm font-black hover:bg-white/[0.07]">
                <Settings className="h-5 w-5" />
                Settings
              </button>
            </div>
          </section>
        </section>

        <aside className="hidden h-full min-h-0 flex-col gap-3 overflow-hidden xl:flex">
          <DetailCard
            role={role}
            company={company}
            market={market}
          />
          <NotesCard recruiterName={recruiterProfile.name} />
          <TranscriptCard transcript={transcript} recruiterName={recruiterProfile.name} recruiterRole={recruiterProfile.role} />
        </aside>
      </div>
    </main>
  );
}
