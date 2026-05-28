"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bot,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Mail,
  Mic,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import {
  readCandidateIdentity,
  syncCandidateIdentityFromSetup,
  type WorkZoCandidateIdentity,
} from "@/lib/workzoCandidateIdentity";
import { readLatestInterviewSetup } from "@/lib/workzoInterviewSetup";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: Sparkles, active: true },
  { label: "Improve CV", href: "/cv", icon: FileText },
  { label: "Cover Letter", href: "/cover-letter", icon: Mail },
  { label: "Find Jobs", href: "/jobs", icon: Search },
  { label: "Real Interview AI", href: "/interview", icon: Mic },
  { label: "Results", href: "/results", icon: ClipboardCheck },
  { label: "Settings", href: "/settings", icon: Settings },
];

function firstName(fullName: string) {
  const clean = String(fullName || "Candidate").trim();
  if (!clean || /^candidate$/i.test(clean)) return "Candidate";
  return clean.split(/\s+/)[0];
}

function isRealCandidateName(name = "") {
  return Boolean(name.trim()) && !/^candidate$/i.test(name.trim());
}

function WorkZoLogo() {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl shadow-lg shadow-cyan-500/25">
      <img
        src="/workzo_icon.png"
        alt="WorkZo AI"
        className="h-full w-full object-cover"
      />
    </div>
  );
}

function BrandLockup() {
  return (
    <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
      <WorkZoLogo />
      <div className="min-w-0 leading-none">
        <p className="whitespace-nowrap text-lg font-black tracking-tight text-white">
          WorkZo <span className="text-blue-300">AI</span>
        </p>
        <p className="mt-1 whitespace-nowrap text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200">
          Career OS
        </p>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const [candidate, setCandidate] = useState<WorkZoCandidateIdentity>(() => readCandidateIdentity());

  useEffect(() => {
    const setup = readLatestInterviewSetup();
    const synced = syncCandidateIdentityFromSetup(setup);
    const latest = isRealCandidateName(synced.name) ? synced : readCandidateIdentity();
    setCandidate(latest);
  }, []);

  const displayName = isRealCandidateName(candidate.name) ? candidate.name : "Candidate";
  const displayFirstName = firstName(displayName);

  const progress = useMemo(
    () => [
      { label: "CV uploaded", done: isRealCandidateName(candidate.name) },
      { label: "Job context added", done: true },
      { label: "Interview prepared", done: true },
      { label: "Feedback reviewed", done: false },
    ],
    [candidate.name],
  );

  const recruiterSignals = [
    { label: "Trust", value: "58/100" },
    { label: "Pressure", value: "Medium" },
    { label: "Trend", value: "Recovering" },
    { label: "Focus", value: "Metrics" },
  ];

  return (
    <main className="min-h-screen bg-[#020817] px-4 py-4 text-white sm:px-5">
      <div className="mx-auto grid max-w-[1480px] gap-5 xl:grid-cols-[275px_minmax(0,1fr)]">
        <aside className="rounded-[26px] border border-white/10 bg-[#071120]/95 p-5 shadow-2xl shadow-black/25 xl:sticky xl:top-4 xl:h-[calc(100vh-32px)]">
          <div className="mb-6 overflow-visible">
            <BrandLockup />
          </div>

          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={[
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black transition",
                    item.active
                      ? "bg-gradient-to-r from-blue-500 to-violet-600 text-white shadow-lg shadow-blue-600/20"
                      : "text-slate-300 hover:bg-white/[0.08]",
                  ].join(" ")}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <section className="mt-7 rounded-3xl border border-cyan-300/15 bg-cyan-400/[0.08] p-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600">
                <Bot className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className="font-black">Work-O-Bot</p>
                <p className="text-xs font-bold text-cyan-200">Career assistant</p>
              </div>
            </div>
            <Link
              href="/copilot"
              className="block rounded-2xl bg-white/10 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-white/15"
            >
              Open assistant
            </Link>
          </section>
        </aside>

        <section className="min-w-0 space-y-5">
          <header className="rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950 p-5 shadow-2xl shadow-blue-950/20 sm:p-6 lg:p-7">
            <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
              <div className="min-w-0">
                <div className="mb-5 flex items-center gap-3 xl:hidden">
                  <BrandLockup />
                </div>

                <p className="mb-3 text-xs font-black uppercase tracking-[0.32em] text-cyan-200">
                  Career Workspace
                </p>
                <h1 className="max-w-5xl text-[34px] font-black leading-[1.02] tracking-tight sm:text-5xl xl:text-[56px]">
                  Welcome back, {displayFirstName} <span className="inline-block">👋</span>
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                  Start a realistic recruiter room with follow-ups, pressure, and feedback based on the uploaded CV and job context.
                </p>
              </div>

              <Link
                href="/interview"
                className="inline-flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-blue-500 to-violet-600 px-6 py-3.5 text-sm font-black text-white shadow-xl shadow-blue-600/25 transition hover:scale-[1.01] sm:text-base"
              >
                Start Real Interview
                <span className="text-xl leading-none">→</span>
              </Link>
            </div>
          </header>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
            <section className="rounded-[28px] border border-cyan-300/15 bg-gradient-to-br from-cyan-950/30 via-slate-950 to-violet-950/40 p-5 sm:p-6 lg:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.25em] text-cyan-200">
                  Hero Feature
                </span>
                <span className="rounded-full border border-emerald-300/15 bg-emerald-300/10 px-3.5 py-1.5 text-xs font-black text-emerald-200">
                  Recruiter simulation ready
                </span>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
                <div className="min-w-0">
                  <h2 className="text-[40px] font-black leading-[0.98] tracking-tight sm:text-5xl xl:text-[54px]">
                    Real<br />Interview<br />AI
                  </h2>
                  <p className="mt-5 max-w-md text-base leading-7 text-slate-300">
                    Practice with an AI recruiter that challenges vague answers, asks follow-ups, and shows where trust changed.
                  </p>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-black/20 p-4 sm:p-5">
                  <p className="mb-4 text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
                    Latest Recruiter Signal
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {recruiterSignals.map((signal) => (
                      <div key={signal.label} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
                        <p className="text-xs font-bold text-slate-400">{signal.label}</p>
                        <p className="mt-1 whitespace-normal break-words text-base font-black leading-tight text-white sm:text-lg">
                          {signal.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 sm:p-6 lg:p-6">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.26em] text-cyan-200">
                Your Job Journey
              </p>
              <h2 className="mb-4 text-2xl font-black">Progress snapshot</h2>

              <div className="space-y-3">
                {progress.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5"
                  >
                    <span
                      className={[
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                        item.done ? "bg-emerald-400/10 text-emerald-300" : "bg-slate-400/10 text-slate-500",
                      ].join(" ")}
                    >
                      <CheckCircle2 className="h-4.5 w-4.5" />
                    </span>
                    <span className="text-sm font-black">{item.label}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
