"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Briefcase,
  FileText,
  Loader2,
  MessageSquareText,
  Minimize2,
  Send,
  Sparkles,
  User,
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

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: CopilotMode;
};

type WorkOBotFloatingProps = {
  defaultOpen?: boolean;
  compact?: boolean;
  contextLabel?: string;
  initialMode?: CopilotMode;
};

const STORAGE_KEY = "workzo-workobot-chat-v1";
const MAX_STORED_MESSAGES = 40;

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

function readStoredChat(): ChatMessage[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string",
    );
  } catch {
    return [];
  }
}

function saveStoredChat(messages: ChatMessage[]) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)));
  } catch {
    // Ignore storage errors — chat just won't persist across reloads.
  }
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
      return "Ask Work-O-Bot anything about your career...";
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

function actionForMode(mode: CopilotMode) {
  switch (mode) {
    case "interview":
      return "magic";
    case "cv":
      return "cv_improve";
    case "jobs":
      return "find_jobs_strategy";
    case "cover_letter":
      return "cover_letter";
    case "message":
      return "linkedin_message";
    default:
      return "career_chat";
  }
}

// Lightweight markdown → React renderer.
// Handles headers, bold, italic, inline code, tables, bullet/numbered lists,
// checkboxes, blockquotes, horizontal rules. No external dependencies needed.
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;

  // Strip decorative emoji that clutter structured output
  const STRIP_EMOJI = /[🔹🔴✅❌⚠️👋🤖📅🗺️👉💡🎯🚀⭐🔧🔑📌📋🗓️]/gu;

  function cleanText(str: string) {
    return str.replace(STRIP_EMOJI, "").replace(/^\s+/, "");
  }

  function inlineFormat(str: string): React.ReactNode {
    const cleaned = cleanText(str);
    const parts = cleaned.split(/(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`)/g);
    return parts.map((part, idx) => {
      if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
        return <strong key={idx} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
      }
      if ((part.startsWith("*") && part.endsWith("*") && part.length > 2) ||
          (part.startsWith("_") && part.endsWith("_") && part.length > 2)) {
        return <em key={idx} className="italic text-slate-300">{part.slice(1, -1)}</em>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={idx} className="rounded bg-white/10 px-1 py-0.5 font-mono text-[11px] text-cyan-300">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  }

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.replace(STRIP_EMOJI, "");

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={i} className="my-3 border-white/[0.08]" />);
      i++; continue;
    }

    // Headers — strip leading emoji/symbols from header text
    const hMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (hMatch) {
      const level = hMatch[1].length;
      const cls = level === 1
        ? "mt-4 mb-2 text-base font-black text-cyan-100"
        : level === 2
          ? "mt-3 mb-1.5 text-[13px] font-black text-slate-100"
          : "mt-2.5 mb-1 text-[11px] font-black uppercase tracking-wide text-slate-300";
      nodes.push(<p key={i} className={cls}>{inlineFormat(hMatch[2])}</p>);
      i++; continue;
    }

    // Blockquote — collect consecutive > lines into one block
    // Also handles blockquotes immediately after list items (no blank line)
    if (line.trimStart().startsWith(">")) {
      const blockKey = i; // capture before loop advances i
      const qLines: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith(">")) {
        qLines.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      nodes.push(
        <blockquote key={`bq-${blockKey}`} className="my-2 rounded-r-xl border-l-2 border-cyan-400/50 bg-white/[0.03] py-2 pl-3 pr-2 text-[12px] italic leading-6 text-slate-300">
          {qLines.map((ql, qi) => (
            <span key={qi}>{inlineFormat(ql)}{qi < qLines.length - 1 ? <br /> : null}</span>
          ))}
        </blockquote>
      );
      continue;
    }

    // Table — collect all | lines
    if (line.trim().startsWith("|")) {
      const tableKey = i; // capture before loop advances i
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i].replace(STRIP_EMOJI, ""));
        i++;
      }
      const rows = tableLines
        .filter(r => !/^\|[\s|:-]+\|$/.test(r.trim()))
        .map(r => r.split("|").slice(1, -1).map(c => c.trim()));
      if (rows.length > 0) {
        nodes.push(
          <div key={`tbl-${tableKey}`} className="my-3 overflow-x-auto rounded-lg border border-white/10 text-[12px]">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-white/[0.06]">
                  {rows[0].map((cell, ci) => (
                    <th key={ci} className="border-b border-white/10 px-3 py-2 text-left font-bold text-slate-100">
                      {inlineFormat(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(1).map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? "" : "bg-white/[0.025]"}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="border-b border-white/[0.05] px-3 py-2 text-slate-300">
                        {inlineFormat(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // Checkbox list item — [ ] or [x]
    const checkMatch = raw.match(/^(\s*)- \[( |x|X)\] (.+)/);
    if (checkMatch) {
      const checked = checkMatch[2].toLowerCase() === "x";
      const isNested = checkMatch[1].length > 0;
      nodes.push(
        <div key={i} className={`flex items-start gap-2.5 text-[13px] leading-6 ${isNested ? "ml-5 mt-0.5" : "mt-1"}`}>
          <span className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? "border-cyan-400 bg-cyan-400/20 text-cyan-300" : "border-white/20 bg-white/[0.04] text-transparent"}`}>
            {checked && <span className="text-[9px] font-black">✓</span>}
          </span>
          <span className={checked ? "text-slate-500 line-through" : "text-slate-300"}>{inlineFormat(checkMatch[3])}</span>
        </div>
      );
      i++; continue;
    }

    // Bullet list
    const bulletMatch = raw.match(/^(\s*)[-*+] (.+)/);
    if (bulletMatch) {
      const isNested = bulletMatch[1].length > 0;
      nodes.push(
        <div key={i} className={`flex items-start gap-2 text-[13px] leading-6 text-slate-300 ${isNested ? "ml-5 mt-0.5" : "mt-1"}`}>
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400/70" />
          <span>{inlineFormat(bulletMatch[2])}</span>
        </div>
      );
      i++; continue;
    }

    // Numbered list
    const numMatch = raw.match(/^(\d+)\. (.+)/);
    if (numMatch) {
      nodes.push(
        <div key={i} className="mt-1 flex items-start gap-2.5 text-[13px] leading-6 text-slate-300">
          <span className="min-w-[18px] shrink-0 font-bold text-cyan-400/80">{numMatch[1]}.</span>
          <span>{inlineFormat(numMatch[2])}</span>
        </div>
      );
      i++; continue;
    }

    // Empty line
    if (line.trim() === "") {
      nodes.push(<div key={i} className="h-2" />);
      i++; continue;
    }

    // Plain paragraph
    nodes.push(
      <p key={i} className="text-[13px] leading-6 text-slate-200">
        {inlineFormat(line)}
      </p>
    );
    i++;
  }

  return nodes;
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSetup(readSetup());
    setMessages(readStoredChat());
  }, []);

  useEffect(() => {
    saveStoredChat(messages);
  }, [messages]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, open, minimized]);

  const targetRole = setup.targetRole || "your target role";
  const targetMarket = setup.targetMarket || "Global";

  const activeMode = useMemo(
    () => modeOptions.find((item) => item.id === mode) || modeOptions[0],
    [mode],
  );

  async function sendMessage(rawText?: string, modeOverride?: CopilotMode) {
    const prompt = (rawText ?? message).trim();
    if (!prompt || loading) return;

    const activeModeId = modeOverride ?? mode;
    const userMessage: ChatMessage = { id: createId(), role: "user", content: prompt, mode: activeModeId };

    const history = [...messages, userMessage];
    setMessages(history);
    setMessage("");
    setError("");

    try {
      setLoading(true);

      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: activeModeId,
          action: actionForMode(activeModeId),
          message: prompt,
          question: activeModeId === "interview" ? prompt : "",
          answer: activeModeId === "interview" ? prompt : "",
          cvText: setup.cvText || "",
          jobDescription: setup.jobDescription || "",
          targetRole,
          targetMarket,
          recruiterName: "Work-O-Bot",
          recruiterRole: "Career Copilot",
          // Send recent turns so follow-ups ("make it shorter", "what about X?")
          // are understood in context, instead of each message being treated
          // as a one-off, unrelated request.
          history: history.slice(-9, -1).map((item) => ({ role: item.role, content: item.content })),
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        success?: boolean;
        output?: string;
        error?: string;
        requiredPlan?: string;
      } | null;

      if (!response.ok || !data?.success) {
        // Handle plan gate errors with a friendly, actionable message
        // instead of showing the raw error string to the user.
        if (data?.error === "upgrade_required" || data?.error === "upgrade_required_rate_limit") {
          const isPro = data?.requiredPlan === "premium_pro";
          const upgradeMsg = isPro
            ? "This feature is part of Premium Pro — AI Career Coach, 30/60/90 day roadmaps, salary coaching, and replay intelligence are all included.\n\nUpgrade to Premium Pro to unlock it, or open the full Work-O-Bot page for features available on your current plan."
            : "This feature requires Premium — CV rewriting, cover letters, ATS optimisation, job fit analysis, and more are all included.\n\nUpgrade to Premium to unlock it, or open the full Work-O-Bot page.";
          setMessages((current) => [
            ...current,
            { id: createId(), role: "assistant", content: upgradeMsg, mode: activeModeId },
          ]);
          return;
        }
        throw new Error("Work-O-Bot could not respond. Please try again.");
      }

      const replyText = data.output || "Work-O-Bot could not generate a response.";
      setMessages((current) => [...current, { id: createId(), role: "assistant", content: replyText, mode: activeModeId }]);
    } catch (err) {
      const fallback = err instanceof Error ? err.message : "Work-O-Bot could not respond.";
      setError(fallback);
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: "assistant",
          content: fallback,
          mode: activeModeId,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function clearChat() {
    setMessages([]);
    setError("");
    saveStoredChat([]);
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
        "fixed z-[90] flex flex-col overflow-hidden border border-white/[0.08] bg-[#061225]/94 text-white shadow-[0_30px_100px_rgba(0,0,0,0.46)] backdrop-blur-2xl",
        compact
          ? "inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+14px)] h-[min(640px,calc(100vh-100px))] rounded-[26px] sm:left-auto sm:right-5 sm:w-[390px]"
          : "inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+14px)] h-[min(680px,calc(100vh-100px))] rounded-[28px] sm:left-auto sm:right-5 sm:w-[430px]",
        minimized && "h-auto sm:w-[340px]",
      )}
    >
      <header className="flex items-center justify-between border-b border-white/[0.07] bg-white/[0.035] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 shadow-[0_0_28px_rgba(34,211,238,0.30)]">
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
          {messages.length > 0 && !minimized && (
            <button
              type="button"
              onClick={clearChat}
              className="hidden rounded-xl border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-black text-slate-300 hover:text-white sm:block"
              aria-label="Clear conversation"
            >
              New chat
            </button>
          )}
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
        <>
          {/* Quick-action mode chips — these just set the "lens" for the next
              message (and are sent to the API as a hint), they no longer
              gate or reset the conversation. */}
          <div className="flex gap-2 overflow-x-auto border-b border-white/[0.06] bg-white/[0.02] px-3 py-2 [scrollbar-width:none]">
            {modeOptions.map((item) => {
              const Icon = item.icon;
              const active = item.id === mode;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMode(item.id)}
                  title={item.helper}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-black transition",
                    active
                      ? "border-cyan-300/35 bg-cyan-400/15 text-cyan-100"
                      : "border-white/[0.07] bg-white/[0.03] text-slate-400 hover:text-slate-200",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
            <Link
              href={`/copilot?mode=${encodeURIComponent(mode)}`}
              className="ml-auto flex shrink-0 items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[11px] font-black text-cyan-100 hover:bg-white/[0.07]"
            >
              Full page
            </Link>
          </div>

          {/* Chat thread */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="rounded-xl border border-cyan-300/14 bg-cyan-400/[0.055] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black">{activeMode.label} mode</p>
                    <p className="mt-1 text-xs leading-5 text-slate-300">
                      Context: {targetRole} · {targetMarket}
                    </p>
                  </div>
                </div>

                <p className="mt-3 text-xs leading-5 text-slate-400">
                  Ask anything career-related — CV feedback, interview answers, job search
                  strategy, cover letters, recruiter messages, salary talk, or general advice.
                  Switch the chip above any time to change focus.
                </p>

                <button
                  type="button"
                  onClick={() => sendMessage(starterPrompt(mode, targetRole))}
                  className="mt-3 w-full rounded-lg border border-white/[0.07] bg-white/[0.045] px-3 py-2 text-left text-xs font-semibold text-slate-200 hover:bg-white/[0.075]"
                >
                  Try: {starterPrompt(mode, targetRole)}
                </button>
              </div>
            ) : (
              messages.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-start gap-2.5",
                    item.role === "user" ? "flex-row-reverse" : "flex-row",
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full",
                      item.role === "user"
                        ? "bg-white/[0.08] text-slate-300"
                        : "bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-[0_0_18px_rgba(34,211,238,0.30)]",
                    )}
                  >
                    {item.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                  </div>
                  <div
                    className={cn(
                      "max-w-[82%] rounded-xl px-4 py-2.5",
                      item.role === "user"
                        ? "rounded-tr-md bg-cyan-400/15 text-sm leading-6 text-cyan-50 whitespace-pre-line"
                        : "rounded-tl-md border border-white/[0.07] bg-black/24",
                    )}
                  >
                    {item.role === "user"
                      ? item.content
                      : <div className="space-y-0.5">{renderMarkdown(item.content)}</div>
                    }
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-[0_0_18px_rgba(34,211,238,0.30)]">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="flex items-center gap-2 rounded-xl rounded-tl-md border border-white/[0.07] bg-black/24 px-4 py-2.5 text-sm text-slate-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-200" />
                  Thinking…
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-white/[0.06] bg-white/[0.02] p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder={placeholderForMode(mode)}
                rows={1}
                className="max-h-28 min-h-[44px] flex-1 resize-none rounded-lg border border-white/[0.08] bg-slate-950/70 p-3 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/35"
              />
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={loading || !message.trim()}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-[0_16px_42px_rgba(14,165,233,0.26)] transition hover:scale-[1.04] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
            {error && <p className="mt-2 text-[11px] font-semibold text-amber-300">{error}</p>}
          </div>
        </>
      )}
    </section>
  );
}
