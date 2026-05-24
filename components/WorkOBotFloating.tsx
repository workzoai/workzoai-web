"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  Briefcase,
  FileText,
  Loader2,
  MessageSquareText,
  Minimize2,
  Send,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";

import { cn } from "@/components/interview/uiHelpers";

type CopilotMode =
  | "career"
  | "interview"
  | "cv"
  | "jobs"
  | "cover_letter"
  | "message";

type SavedSetup = {
  cvText?: string;
  jobDescription?: string;
  targetRole?: string;
  targetMarket?: string;
  recruiterPersonality?: string;
};

type WorkOBotFloatingProps = {
  defaultOpen?: boolean;
  compact?: boolean;
  contextLabel?: string;
  initialMode?: CopilotMode;
};

const modeOptions: Array<{
  id: CopilotMode;
  label: string;
  helper: string;
  icon: typeof Sparkles;
}> = [
  {
    id: "career",
    label: "Career",
    helper: "Plan your next best move.",
    icon: Sparkles,
  },
  {
    id: "interview",
    label: "Interview",
    helper: "Prepare or rescue answers.",
    icon: Bot,
  },
  {
    id: "cv",
    label: "CV",
    helper: "Improve profile and bullets.",
    icon: FileText,
  },
  {
    id: "jobs",
    label: "Jobs",
    helper: "Find role strategy.",
    icon: Briefcase,
  },
  {
    id: "cover_letter",
    label: "Cover letter",
    helper: "Draft focused applications.",
    icon: Wand2,
  },
  {
    id: "message",
    label: "Messages",
    helper: "LinkedIn, HR, recruiter replies.",
    icon: MessageSquareText,
  },
];

function readSetup(): SavedSetup {
  if (typeof window === "undefined") return {};

  const keys = [
    "workzo-latest-interview-setup",
    "workzo-interview-setup-v4",
    "workzo-interview-setup-latest",
  ];

  for (const key of keys) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as SavedSetup;
    } catch {
      // Ignore broken localStorage values.
    }
  }

  return {};
}

function placeholderForMode(mode: CopilotMode) {
  switch (mode) {
    case "interview":
      return "Ask: What is this recruiter testing? Or paste your answer to improve it...";
    case "cv":
      return "Ask: Improve my CV headline, summary, or bullets for this role...";
    case "jobs":
      return "Ask: What roles should I apply for next based on my CV?";
    case "cover_letter":
      return "Ask: Create a focused cover letter for this job...";
    case "message":
      return "Ask: Write a LinkedIn message, recruiter reply, or HR email...";
    default:
      return "Ask Work-O-Bot anything about your career journey...";
  }
}

function starterPrompt(mode: CopilotMode, role: string) {
  switch (mode) {
    case "interview":
      return `Help me prepare a strong interview answer for ${role}.`;
    case "cv":
      return `Review my CV positioning for ${role} and tell me the top 3 fixes.`;
    case "jobs":
      return `Based on my profile, what job titles should I search for next?`;
    case "cover_letter":
      return `Draft a truthful cover letter structure for ${role}.`;
    case "message":
      return `Write a short recruiter message for ${role}.`;
    default:
      return `What is my next best career move for ${role}?`;
  }
}

export default function WorkOBotFloating({
  defaultOpen = false,
  compact = false,
  contextLabel = "Career copilot",
  initialMode = "career",
}: WorkOBotFloatingProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [minimized, setMinimized] = useState(false);
  const [mode, setMode] = useState<CopilotMode>(initialMode);
  const [setup, setSetup] = useState<SavedSetup>({});
  const [message, setMessage] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSetup(readSetup());
  }, []);

  const targetRole = setup.targetRole || "your target role";
  const targetMarket = setup.targetMarket || "Global";

  const activeMode = useMemo(
    () => modeOptions.find((item) => item.id === mode) || modeOptions[0],
    [mode],
  );

  async function askWorkOBot(nextMessage?: string) {
    const prompt = (nextMessage || message).trim();
    if (!prompt) return;

    try {
      setLoading(true);
      setOutput("");

      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          action: mode === "interview" ? "magic" : "magic",
          prompt,
          question: prompt,
          answer: prompt,
          cvText: setup.cvText || "",
          jobDescription: setup.jobDescription || "",
          targetRole,
          targetMarket,
          recruiterName: "Work-O-Bot",
          recruiterRole: "Career Copilot",
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        success?: boolean;
        output?: string;
        error?: string;
      } | null;

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Work-O-Bot could not respond.");
      }

      setOutput(data.output || "Work-O-Bot could not generate a response.");
      setMessage("");
    } catch (error) {
      const fallback =
        error instanceof Error ? error.message : "Work-O-Bot could not respond.";
      setOutput(
        `${fallback}\n\nTry opening the full copilot page, or check that /api/copilot is deployed with OPENAI_API_KEY.`,
      );
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setMinimized(false);
        }}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+22px)] right-5 z-[80] flex h-16 items-center gap-3 rounded-full border border-cyan-300/25 bg-[#061225]/92 px-5 text-white shadow-[0_22px_70px_rgba(14,165,233,0.30)] backdrop-blur-2xl transition hover:scale-[1.02] active:scale-[0.98]"
        aria-label="Open Work-O-Bot"
      >
        <span className="relative grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 shadow-[0_0_34px_rgba(34,211,238,0.34)]">
          <Bot className="h-6 w-6" />
          <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#061225] bg-emerald-300" />
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-black">Work-O-Bot</span>
          <span className="block text-xs font-semibold text-cyan-200/80">
            {contextLabel}
          </span>
        </span>
      </button>
    );
  }

  return (
    <section
      className={cn(
        "fixed z-[90] overflow-hidden border border-white/[0.08] bg-[#061225]/94 text-white shadow-[0_30px_100px_rgba(0,0,0,0.46)] backdrop-blur-2xl",
        compact
          ? "inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+14px)] rounded-[26px] sm:left-auto sm:right-5 sm:w-[390px]"
          : "inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+14px)] rounded-[28px] sm:left-auto sm:right-5 sm:w-[430px]",
        minimized && "sm:w-[340px]",
      )}
    >
      <header className="flex items-center justify-between border-b border-white/[0.07] bg-white/[0.035] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 shadow-[0_0_28px_rgba(34,211,238,0.30)]">
            <Bot className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-black">Work-O-Bot</p>
            <p className="truncate text-xs font-bold uppercase tracking-[0.18em] text-cyan-200/80">
              {contextLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMinimized((value) => !value)}
            className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-300 hover:text-white"
            aria-label="Minimize Work-O-Bot"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-300 hover:text-white"
            aria-label="Close Work-O-Bot"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {!minimized && (
        <div className="p-4">
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {modeOptions.map((item) => {
              const Icon = item.icon;
              const active = item.id === mode;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMode(item.id)}
                  className={cn(
                    "rounded-2xl border p-3 text-left transition hover:bg-white/[0.07]",
                    active
                      ? "border-cyan-300/28 bg-cyan-400/10 text-white"
                      : "border-white/[0.07] bg-white/[0.035] text-slate-300",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-cyan-200" />
                    <span className="text-xs font-black">{item.label}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-400">
                    {item.helper}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="rounded-3xl border border-cyan-300/14 bg-cyan-400/[0.055] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black">{activeMode.label} mode</p>
                <p className="mt-1 text-xs leading-5 text-slate-300">
                  Context: {targetRole} · {targetMarket}
                </p>
              </div>
              <Link
                href={`/copilot?mode=${encodeURIComponent(mode)}`}
                className="rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 py-2 text-xs font-black text-cyan-100 hover:bg-white/[0.08]"
              >
                Full page
              </Link>
            </div>

            <button
              type="button"
              onClick={() => askWorkOBot(starterPrompt(mode, targetRole))}
              className="mt-3 w-full rounded-2xl border border-white/[0.07] bg-white/[0.045] px-3 py-2 text-left text-xs font-semibold text-slate-200 hover:bg-white/[0.075]"
            >
              Try: {starterPrompt(mode, targetRole)}
            </button>
          </div>

          <div className="mt-3">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={placeholderForMode(mode)}
              className="h-28 w-full resize-none rounded-3xl border border-white/[0.08] bg-slate-950/70 p-4 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/35"
            />
            <button
              type="button"
              onClick={() => askWorkOBot()}
              disabled={loading || !message.trim()}
              className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-400 text-sm font-black text-white shadow-[0_16px_42px_rgba(14,165,233,0.26)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Ask Work-O-Bot
            </button>
          </div>

          <div className="mt-3 max-h-[260px] overflow-y-auto whitespace-pre-line rounded-3xl border border-white/[0.07] bg-black/24 p-4 text-sm leading-6 text-slate-200">
            {loading ? (
              <div className="flex h-[140px] items-center justify-center text-center text-slate-400">
                <div>
                  <Loader2 className="mx-auto h-7 w-7 animate-spin text-cyan-200" />
                  <p className="mt-3 text-sm">Thinking like a career coach...</p>
                </div>
              </div>
            ) : output ? (
              output
            ) : (
              <div className="text-slate-400">
                <p className="font-semibold text-slate-200">What can I help you with?</p>
                <p className="mt-2">
                  Ask about your CV, jobs, cover letters, interview answers, recruiter messages, or your next career step.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
