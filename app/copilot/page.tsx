"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  ArrowLeft,
  Bot,
  Briefcase,
  FileText,
  Loader2,
  Mail,
  MessageSquareText,
  Plus,
  Send,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";

import { getRecruiterProfile } from "@/lib/launchIntelligenceEngine";
import { trackWorkZoLaunchEvent } from "@/lib/workzoLaunchAnalytics";

// ── Types ─────────────────────────────────────────────────────────────────────

type SavedSetup = {
  cvText?: string;
  jobDescription?: string;
  targetRole?: string;
  targetMarket?: string;
  recruiterPersonality?: string;
  resumeProfile?: {
    basics?: { name?: string; headline?: string };
    experience?: Array<{ title?: string; company?: string; dates?: string }>;
    skills?: string[];
  } | null;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
};

type MemoryItem = {
  label: string;
  value: string;
  kind: "name" | "role" | "company" | "skill" | "jd";
};

// ── Storage helpers ───────────────────────────────────────────────────────────

const HISTORY_KEY = "workzo-copilot-history-v1";
const MAX_CONVS = 30;

function readSetup(): SavedSetup {
  if (typeof window === "undefined") return {};
  for (const key of ["workzo-latest-interview-setup", "workzo-interview-setup-v4", "workzo-interview-setup-latest"]) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as SavedSetup;
      if (!parsed.resumeProfile) {
        try {
          const c = JSON.parse(window.localStorage.getItem("workzoInterviewSetup") || "{}") as SavedSetup;
          if (c.resumeProfile) parsed.resumeProfile = c.resumeProfile;
        } catch { /* ignore */ }
      }
      return parsed;
    } catch { /* ignore */ }
  }
  return {};
}

function loadHistory(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HISTORY_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return (parsed as Conversation[])
      .filter((c) => c && typeof c.id === "string" && Array.isArray(c.messages))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch { return []; }
}

function persistHistory(history: Conversation[]) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_CONVS))); } catch { /* ignore */ }
}

function makeTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user")?.content || "";
  const t = first.replace(/\s+/g, " ").trim();
  return t.length > 50 ? t.slice(0, 50) + "…" : t || "New chat";
}

function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

function relativeTime(ts: number): string {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  const h = Math.floor(d / 3600000);
  const dy = Math.floor(d / 86400000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (dy < 7) return `${dy}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ── Memory ────────────────────────────────────────────────────────────────────

function buildMemory(setup: SavedSetup): MemoryItem[] {
  const items: MemoryItem[] = [];
  const p = setup.resumeProfile;
  const name = p?.basics?.name;
  if (name && name !== "Candidate") items.push({ label: "Candidate", value: name, kind: "name" });
  const headline = p?.basics?.headline;
  if (headline && headline !== "Professional") items.push({ label: "Role", value: headline, kind: "role" });
  for (const job of (p?.experience || []).slice(0, 2)) {
    if (job.title && job.company)
      items.push({ label: job.dates || "Experience", value: `${job.title} · ${job.company}`, kind: "company" });
  }
  const skills = (p?.skills || []).slice(0, 5);
  if (skills.length) items.push({ label: "Skills", value: skills.join(", "), kind: "skill" });
  if (setup.targetRole) items.push({ label: "Applying for", value: setup.targetRole, kind: "jd" });
  if (setup.jobDescription?.trim()) {
    const first = setup.jobDescription.split("\n")[0]?.trim() || "";
    items.push({ label: "JD", value: first.length < 70 ? first : `${setup.jobDescription.length} chars`, kind: "jd" });
  }
  return items.slice(0, 7);
}

// ── Suggestions ───────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  { label: "How strong is my CV for this role?", action: "cv_improve" },
  { label: "What questions will they ask?", action: "interview_coach" },
  { label: "Write me a cover letter", action: "cover_letter" },
  { label: "Should I apply for this job?", action: "job_fit" },
  { label: "Help me find matching job titles", action: "find_jobs_strategy" },
  { label: "Write a LinkedIn message to a recruiter", action: "linkedin_message" },
  { label: "Give me a 30-day career plan", action: "career_plan" },
  { label: "Help me negotiate my salary", action: "career_chat" },
];

const FEATURE_LINKS = [
  { href: "/cv", label: "Improve CV", icon: FileText },
  { href: "/cover-letter", label: "Cover letter", icon: Mail },
  { href: "/jobs", label: "Find jobs", icon: Briefcase },
  { href: "/interview", label: "Interview room", icon: MessageSquareText },
];

// ── Component ─────────────────────────────────────────────────────────────────

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
        return <strong key={idx} className="font-semibold text-fg">{part.slice(2, -2)}</strong>;
      }
      if ((part.startsWith("*") && part.endsWith("*") && part.length > 2) ||
          (part.startsWith("_") && part.endsWith("_") && part.length > 2)) {
        return <em key={idx} className="italic text-muted">{part.slice(1, -1)}</em>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={idx} className="rounded bg-fg/10 px-1 py-0.5 font-mono text-[11px] text-brand">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  }

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.replace(STRIP_EMOJI, "");

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={i} className="my-3 border-line" />);
      i++; continue;
    }

    // Headers — strip leading emoji/symbols from header text
    const hMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (hMatch) {
      const level = hMatch[1].length;
      const cls = level === 1
        ? "mt-4 mb-2 text-base font-black text-brand"
        : level === 2
          ? "mt-3 mb-1.5 text-[13px] font-black text-fg"
          : "mt-2.5 mb-1 text-[11px] font-black uppercase tracking-wide text-muted";
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
        <blockquote key={`bq-${blockKey}`} className="my-2 rounded-r-xl border-l-2 border-brand/50 bg-fg/[0.03] py-2 pl-3 pr-2 text-[12px] italic leading-6 text-muted">
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
          <div key={`tbl-${tableKey}`} className="my-3 overflow-x-auto rounded-lg border border-line text-[12px]">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-fg/[0.06]">
                  {rows[0].map((cell, ci) => (
                    <th key={ci} className="border-b border-line px-3 py-2 text-left font-bold text-fg">
                      {inlineFormat(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(1).map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? "" : "bg-fg/[0.025]"}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="border-b border-line px-3 py-2 text-muted">
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
          <span className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? "border-brand bg-brand/20 text-brand" : "border-line bg-fg/[0.04] text-transparent"}`}>
            {checked && <span className="text-[9px] font-black">✓</span>}
          </span>
          <span className={checked ? "text-subtle line-through" : "text-muted"}>{inlineFormat(checkMatch[3])}</span>
        </div>
      );
      i++; continue;
    }

    // Bullet list
    const bulletMatch = raw.match(/^(\s*)[-*+] (.+)/);
    if (bulletMatch) {
      const isNested = bulletMatch[1].length > 0;
      nodes.push(
        <div key={i} className={`flex items-start gap-2 text-[13px] leading-6 text-muted ${isNested ? "ml-5 mt-0.5" : "mt-1"}`}>
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand/70" />
          <span>{inlineFormat(bulletMatch[2])}</span>
        </div>
      );
      i++; continue;
    }

    // Numbered list
    const numMatch = raw.match(/^(\d+)\. (.+)/);
    if (numMatch) {
      nodes.push(
        <div key={i} className="mt-1 flex items-start gap-2.5 text-[13px] leading-6 text-muted">
          <span className="min-w-[18px] shrink-0 font-bold text-muted/80">{numMatch[1]}.</span>
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
      <p key={i} className="text-[13px] leading-6 text-fg">
        {inlineFormat(line)}
      </p>
    );
    i++;
  }

  return nodes;
}

export default function WorkOBotCopilotPage() {
  const [setup, setSetup] = useState<SavedSetup>({});
  const [history, setHistory] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Mount: load setup + history
  useEffect(() => {
    setSetup(readSetup());
    const h = loadHistory();
    setHistory(h);
    if (h.length > 0) {
      setActiveId(h[0].id);
      setMessages(h[0].messages);
    }
  }, []);

  // Auto-save: persist whenever messages change
  useEffect(() => {
    if (messages.length === 0) return;
    const now = Date.now();
    const title = makeTitle(messages);
    setHistory((prev) => {
      const convId = activeId ?? uid();
      if (!activeId) setActiveId(convId);
      const existing = prev.find((c) => c.id === convId);
      const next: Conversation[] = existing
        ? prev.map((c) => c.id === convId ? { ...c, title, messages: messages.slice(-60), updatedAt: now } : c)
        : [{ id: convId, title, messages: messages.slice(-60), createdAt: now, updatedAt: now }, ...prev];
      persistHistory(next);
      return next.sort((a, b) => b.updatedAt - a.updatedAt);
    });
  }, [messages]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const targetRole = setup.targetRole || "";
  const cvText = setup.cvText || "";
  const jobDescription = setup.jobDescription || "";
  const recruiter = getRecruiterProfile(setup.recruiterPersonality);
  const memory = useMemo(() => buildMemory(setup), [setup]);

  useEffect(() => {
    trackWorkZoLaunchEvent({ event: "copilot_opened", role: targetRole, recruiter: recruiter.name, mode: "copilot" });
  }, [targetRole, recruiter.name]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  async function send(text: string, action = "career_chat") {
    const prompt = text.trim();
    if (!prompt || loading) return;

    const userMsg: ChatMessage = { id: uid(), role: "user", content: prompt };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setError("");

    try {
      setLoading(true);
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          message: prompt,
          cvText,
          jobDescription,
          targetRole: targetRole || "General Role",
          targetMarket: setup.targetMarket || "Global",
          recruiterName: recruiter.name,
          recruiterRole: recruiter.role,
          history: next.slice(-9, -1).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = (await res.json().catch(() => null)) as { success?: boolean; output?: string; error?: string; requiredPlan?: string; action?: string } | null;

      if (!res.ok || !data?.success) {
        if (data?.error === "upgrade_required" || data?.error === "upgrade_required_rate_limit") {
          // Show the correct upgrade message based on which plan is actually required.
          // career_plan, career coaching, roadmaps → Premium Pro only.
          // CV rewriting, cover letter, job analysis → Premium.
          // Generic rate limit → whichever plan they need next.
          const requiredPlan = data?.requiredPlan || "premium";
          const isPro = requiredPlan === "premium_pro";
          const upgradeMsg = isPro
            ? "This feature is part of Premium Pro — AI Career Coach, 30/60/90 day roadmaps, salary coaching, and replay intelligence are all included. Upgrade to Premium Pro to unlock it."
            : "This feature requires Premium. CV rewriting, cover letters, ATS optimisation, job fit analysis, and more are all included. Upgrade to Premium to unlock it.";
          setMessages((p) => [...p, { id: uid(), role: "assistant", content: upgradeMsg }]);
          return;
        }
        if (data?.error === "upgrade_required_rate_limit") {
          setMessages((p) => [...p, { id: uid(), role: "assistant", content: "You've reached your usage limit for this period. Upgrade for higher limits." }]);
          return;
        }
        throw new Error(data?.error || "Work-O-Bot could not respond.");
      }

      const reply = (data.output || "").trim();
      if (!reply) throw new Error("Empty response.");
      setMessages((p) => [...p, { id: uid(), role: "assistant", content: reply }]);

      trackWorkZoLaunchEvent({ event: "copilot_action_used", role: targetRole, recruiter: recruiter.name, mode: "copilot", metadata: { action } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Work-O-Bot could not respond.");
    } finally {
      setLoading(false);
    }
  }

  function startNewChat() {
    setActiveId(null);
    setMessages([]);
    setError("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function loadConversation(conv: Conversation) {
    setActiveId(conv.id);
    setMessages(conv.messages);
    setError("");
  }

  function deleteConversation(id: string, e: MouseEvent) {
    e.stopPropagation();
    setHistory((prev) => {
      const next = prev.filter((c) => c.id !== id);
      persistHistory(next);
      return next;
    });
    if (activeId === id) { setActiveId(null); setMessages([]); }
  }

  const isEmpty = messages.length === 0;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas text-fg">

      {/* Top bar */}
      <header className="flex shrink-0 items-center justify-between border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="grid h-9 w-9 place-items-center rounded-xl border border-line text-muted transition hover:text-fg">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand shadow-[0_0_20px_rgba(37, 99, 235,0.3)]">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black">Work-O-Bot</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted/70">Career copilot</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1.5 sm:flex">
            {FEATURE_LINKS.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="flex items-center gap-1.5 rounded-xl border border-line bg-fg/[0.04] px-3 py-1.5 text-xs font-bold text-muted transition hover:bg-fg/[0.08] hover:text-fg">
                <Icon className="h-3.5 w-3.5" />{label}
              </Link>
            ))}
          </div>
          <button type="button" onClick={startNewChat} className="flex items-center gap-1.5 rounded-xl border border-line bg-fg/[0.04] px-3 py-1.5 text-xs font-bold text-muted transition hover:text-fg">
            <Plus className="h-3.5 w-3.5" />New chat
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1">

        {/* ── Left sidebar: history + memory ───────────────────────────── */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-canvas lg:flex">

          {/* New chat */}
          <div className="shrink-0 border-b border-line p-3">
            <button type="button" onClick={startNewChat} className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-fg/[0.04] px-3 py-2.5 text-xs font-black text-muted transition hover:bg-fg/[0.07] hover:text-fg">
              <Plus className="h-3.5 w-3.5" />New chat
            </button>
          </div>

          {/* Conversation history */}
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {history.length > 0 ? (
              <>
                <p className="mb-1 px-2 pt-1 text-[10px] font-black uppercase tracking-[0.2em] text-subtle">Recent</p>
                {history.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => loadConversation(conv)}
                    className={`group relative mb-0.5 flex cursor-pointer items-start rounded-xl px-3 py-2.5 transition ${activeId === conv.id ? "bg-fg/[0.08] text-fg" : "text-muted hover:bg-fg/[0.04] hover:text-fg"}`}
                  >
                    <div className="min-w-0 flex-1 pr-5">
                      <p className="truncate text-xs font-semibold leading-5">{conv.title}</p>
                      <p className="text-[10px] text-subtle">{relativeTime(conv.updatedAt)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => deleteConversation(conv.id, e)}
                      className="absolute right-2 top-2.5 opacity-0 transition group-hover:opacity-100 text-subtle hover:text-danger"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </>
            ) : (
              <div className="px-3 py-4 text-center">
                <p className="text-xs text-subtle">No conversations yet.</p>
                <p className="mt-0.5 text-[11px] text-subtle">Start chatting to build history.</p>
              </div>
            )}
          </div>

          {/* Memory panel */}
          {memory.length > 0 && (
            <div className="shrink-0 border-t border-line p-3">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-subtle">What I know</p>
              <div className="space-y-1.5">
                {memory.map((item, i) => (
                  <div key={i} className={`rounded-xl border px-3 py-1.5 ${item.kind === "name" ? "border-line bg-fg/[0.05]" : item.kind === "jd" ? "border-brand/15 bg-brand/[0.05]" : "border-line bg-fg/[0.02]"}`}>
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-subtle">{item.label}</p>
                    <p className={`mt-0.5 truncate text-xs leading-5 ${item.kind === "name" ? "font-bold text-fg" : item.kind === "jd" ? "text-muted/80" : "text-muted"}`}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* ── Chat area ────────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col">

          {/* Thread */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
            {isEmpty ? (
              <div className="mx-auto max-w-2xl">
                <div className="mb-8 text-center">
                  <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand shadow-[0_0_40px_rgba(37, 99, 235,0.3)]">
                    <Bot className="h-8 w-8" />
                  </div>
                  <h1 className="text-2xl font-black">Ask Work-O-Bot anything</h1>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Career advice, interview prep, salary negotiation, job search strategy — whatever you need.
                    {memory.length > 0 && " I already have your CV and JD loaded."}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map(({ label, action }) => (
                    <button key={label} type="button" onClick={() => void send(label, action)}
                      className="rounded-lg border border-line bg-fg/[0.03] px-4 py-3 text-left text-sm text-muted transition hover:border-brand/25 hover:bg-brand/[0.06] hover:text-on-brand">
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-6 text-center text-xs text-subtle">
                  For structured tools, use{" "}
                  {FEATURE_LINKS.map(({ href, label }, i) => (
                    <span key={href}><Link href={href} className="text-subtle underline hover:text-muted">{label}</Link>{i < FEATURE_LINKS.length - 1 ? ", " : ""}</span>
                  ))}.
                </p>
              </div>
            ) : (
              <div className="mx-auto max-w-2xl space-y-4">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${msg.role === "user" ? "bg-fg/[0.08]" : "bg-gradient-to-br from-brand to-brand shadow-[0_0_16px_rgba(37, 99, 235,0.25)]"}`}>
                      {msg.role === "user" ? <User className="h-4 w-4 text-muted" /> : <Bot className="h-4 w-4 text-fg" />}
                    </div>
                    <div className={`max-w-[85%] rounded-xl px-4 py-3 ${msg.role === "user" ? "rounded-tr-md bg-brand/15 text-sm leading-6 text-brand whitespace-pre-line" : "rounded-tl-md border border-line bg-fg/[0.04]"}`}>
                      {msg.role === "user"
                        ? msg.content
                        : <div className="space-y-0.5">{renderMarkdown(msg.content)}</div>
                      }
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-brand shadow-[0_0_16px_rgba(37, 99, 235,0.25)]">
                      <Bot className="h-4 w-4 text-fg" />
                    </div>
                    <div className="flex items-center gap-2 rounded-xl rounded-tl-md border border-line bg-fg/[0.04] px-4 py-3 text-sm text-muted">
                      <Loader2 className="h-4 w-4 animate-spin text-brand" />Thinking…
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-line bg-canvas/80 px-4 py-4 backdrop-blur-xl">
            <div className="mx-auto max-w-2xl">
              {error && <p className="mb-2 text-xs font-semibold text-warning">{error}</p>}
              <div className="flex items-end gap-3">
                <div className="relative flex-1">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }}
                    placeholder="Ask anything about your career, CV, interviews, salary, applications…"
                    rows={1}
                    className="max-h-36 min-h-[52px] w-full resize-none rounded-lg border border-line bg-fg/[0.05] px-4 py-3.5 pr-10 text-sm leading-6 text-fg outline-none placeholder:text-subtle focus:border-brand/35 focus:bg-fg/[0.07]"
                  />
                  <Sparkles className="absolute bottom-4 right-3 h-3.5 w-3.5 text-subtle" />
                </div>
                <button type="button" onClick={() => void send(input)} disabled={loading || !input.trim()}
                  className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-lg bg-gradient-to-r from-brand to-brand text-on-brand shadow-[0_8px_30px_rgba(14,165,233,0.3)] transition hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-40">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </button>
              </div>
              <p className="mt-2 text-center text-[10px] text-subtle">
                Work-O-Bot uses your CV and JD context · Shift+Enter for new line · Answers are AI-generated
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
