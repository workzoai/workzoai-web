"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  FileText,
  Home,
  MessageSquareText,
  PenLine,
  Search,
  Settings,
  Sparkles,
  Target,
  Wand2,
} from "lucide-react";

import WorkOBotFloating from "@/components/WorkOBotFloating";
import {
  readLatestInterviewSetup,
  type WorkZoInterviewSetup,
} from "@/lib/workzoInterviewSetup";

type ResultPayload = {
  overallScore?: number;
  recruiterTrust?: number;
  transcript?: Array<{ role: string; text: string; time?: string }>;
  memory?: {
    strengths?: string[];
    weaknesses?: string[];
    improvements?: string[];
    risks?: string[];
  };
  setup?: Partial<WorkZoInterviewSetup>;
};

type DashboardState = {
  setup: Partial<WorkZoInterviewSetup>;
  results: ResultPayload | null;
};

type JourneyStep = {
  label: string;
  description: string;
  done: boolean;
};

const navItems = [
  { label: "Dashboard", icon: Home, active: true, href: "/dashboard" },
  { label: "Improve CV", icon: FileText, href: "/onboarding" },
  { label: "Generate Cover Letter", icon: PenLine, href: "/copilot?mode=cover_letter" },
  { label: "Find Jobs", icon: Search, href: "/copilot?mode=jobs" },
  { label: "Real Interview AI", icon: Sparkles, href: "/interview" },
  { label: "Results", icon: Target, href: "/results" },
  { label: "Settings", icon: Settings, href: "#settings" },
];

const quickActions = [
  {
    title: "Improve CV",
    description: "Clean up structure, sharpen bullets, and prepare your CV for the target role.",
    href: "/onboarding",
    icon: FileText,
    accent: "from-blue-500 to-cyan-400",
  },
  {
    title: "Generate Cover Letter",
    description: "Create a focused, truthful cover letter using your CV and job description.",
    href: "/copilot?mode=cover_letter",
    icon: PenLine,
    accent: "from-violet-500 to-fuchsia-500",
  },
  {
    title: "Find Jobs",
    description: "Get job search direction, role keywords, and next application targets.",
    href: "/copilot?mode=jobs",
    icon: Search,
    accent: "from-cyan-500 to-emerald-400",
  },
  {
    title: "Real Interview AI",
    description: "Practice a realistic recruiter call based on your CV, role, and job context.",
    href: "/interview",
    icon: Sparkles,
    accent: "from-blue-500 to-violet-600",
  },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function scoreValue(results: ResultPayload | null) {
  const value = Number(results?.overallScore || results?.recruiterTrust || 0);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getCandidateName(setup: Partial<WorkZoInterviewSetup>, results: ResultPayload | null) {
  const profile = setup.recruiterMemoryProfile || results?.setup?.recruiterMemoryProfile || null;

  if (profile && typeof profile === "object" && "candidateName" in profile) {
    const value = (profile as { candidateName?: unknown }).candidateName;
    if (typeof value === "string" && value.trim()) return value.trim().split(/\s+/)[0];
  }

  return "there";
}

function getRole(setup: Partial<WorkZoInterviewSetup>, results: ResultPayload | null) {
  const job = setup.jobMemoryProfile || results?.setup?.jobMemoryProfile || null;

  if (job && typeof job === "object" && "roleTitle" in job) {
    const value = (job as { roleTitle?: unknown }).roleTitle;
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return safeText(setup.targetRole || results?.setup?.targetRole, "Target role");
}

function getMarket(setup: Partial<WorkZoInterviewSetup>, results: ResultPayload | null) {
  return safeText(setup.targetMarket || results?.setup?.targetMarket, "Global");
}

function buildNextAction({
  hasCv,
  hasJob,
  hasResults,
  score,
}: {
  hasCv: boolean;
  hasJob: boolean;
  hasResults: boolean;
  score: number;
}) {
  if (!hasCv) {
    return {
      title: "Add your CV first",
      description: "WorkZo needs your CV to improve your profile, suggest jobs, and prepare realistic interviews.",
      cta: "Upload CV",
      href: "/onboarding",
    };
  }

  if (!hasJob) {
    return {
      title: "Add a real job target",
      description: "Paste a job description so WorkZo can tailor your CV, cover letter, and interview practice.",
      cta: "Prepare job target",
      href: "/copilot?mode=jobs",
    };
  }

  if (!hasResults) {
    return {
      title: "Practice your first real interview",
      description: "Your setup is ready. Start a recruiter simulation and get emotional feedback after the session.",
      cta: "Start Real Interview",
      href: "/interview",
    };
  }

  if (score && score < 72) {
    return {
      title: "Recover recruiter trust",
      description: "Your last interview showed weak proof or unclear ownership. Retry the weakest answer before applying.",
      cta: "Review results",
      href: "/results",
    };
  }

  return {
    title: "Prepare your application package",
    description: "Your interview signal is improving. Generate a focused cover letter and apply with a stronger story.",
    cta: "Generate cover letter",
    href: "/copilot?mode=cover_letter",
  };
}

function buildJourneySteps({
  hasCv,
  hasJob,
  hasResults,
}: {
  hasCv: boolean;
  hasJob: boolean;
  hasResults: boolean;
}): JourneyStep[] {
  return [
    {
      label: "CV added",
      description: hasCv ? "Profile context ready" : "Upload or paste your CV",
      done: hasCv,
    },
    {
      label: "Job target added",
      description: hasJob ? "Role context available" : "Add JD or target role",
      done: hasJob,
    },
    {
      label: "Interview practiced",
      description: hasResults ? "Latest session saved" : "Run Real Interview AI",
      done: hasResults,
    },
    {
      label: "Next action ready",
      description: "Work-O-Bot can guide the next step",
      done: hasCv || hasJob || hasResults,
    },
  ];
}

export default function DashboardPage() {
  const [dashboardState, setDashboardState] = useState<DashboardState>({
    setup: {},
    results: null,
  });

  useEffect(() => {
    const setup = readLatestInterviewSetup();
    const results = readJson<ResultPayload>("workzo-last-results");

    setDashboardState({
      setup: results?.setup ? { ...setup, ...results.setup } : setup,
      results,
    });
  }, []);

  const candidateName = getCandidateName(dashboardState.setup, dashboardState.results);
  const targetRole = getRole(dashboardState.setup, dashboardState.results);
  const market = getMarket(dashboardState.setup, dashboardState.results);
  const score = scoreValue(dashboardState.results);
  const hasCv = Boolean(dashboardState.setup.cvText);
  const hasJob = Boolean(dashboardState.setup.jobDescription || targetRole !== "Target role");
  const hasResults = Boolean(dashboardState.results);
  const journey = useMemo(
    () => buildJourneySteps({ hasCv, hasJob, hasResults }),
    [hasCv, hasJob, hasResults],
  );
  const nextAction = useMemo(
    () => buildNextAction({ hasCv, hasJob, hasResults, score }),
    [hasCv, hasJob, hasResults, score],
  );

  const weakness =
    dashboardState.results?.memory?.weaknesses?.[0] ||
    dashboardState.results?.memory?.improvements?.[0] ||
    "Add measurable proof and clearer ownership to your next answer.";

  return (
    <main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.16),transparent_34%),linear-gradient(180deg,#06111f_0%,#050816_100%)] text-white">
      <div className="flex min-h-screen w-full">
        <aside className="hidden w-[268px] shrink-0 flex-col border-r border-white/[0.07] bg-[#061225]/88 px-5 py-5 shadow-[18px_0_70px_rgba(0,0,0,0.16)] backdrop-blur-2xl lg:flex">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/workzo_icon.png" alt="WorkZo AI" width={42} height={42} className="rounded-xl" />
            <span className="text-[24px] font-black tracking-tight">
              WorkZo <span className="text-blue-400">AI</span>
            </span>
          </Link>

          <div className="mt-6 rounded-[22px] border border-cyan-300/14 bg-cyan-400/[0.055] p-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">
              Guided workspace
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              CV → Jobs → Interview → Results, with Work-O-Bot beside you.
            </p>
          </div>

          <nav className="mt-5 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "flex min-h-[48px] items-center justify-between rounded-[16px] px-4 text-[14px] font-bold transition",
                    item.active
                      ? "bg-gradient-to-r from-blue-500 to-violet-600 text-white shadow-[0_14px_36px_rgba(59,130,246,0.26)]"
                      : "text-slate-300 hover:bg-white/[0.06] hover:text-white",
                  )}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </span>
                  <ChevronRight className="h-4 w-4 opacity-60" />
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-[22px] border border-white/[0.08] bg-white/[0.045] p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <p className="font-black">Work-O-Bot</p>
                <p className="text-xs font-bold text-cyan-200">Floating copilot</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-400">
              Ask for CV help, cover letters, job search, interview prep, and recruiter messages.
            </p>
          </div>
        </aside>

        <section className="min-w-0 flex-1 px-4 py-4 sm:px-5 lg:px-7">
          <div className="mx-auto max-w-[1440px] pb-28">
            <header className="flex flex-col gap-4 rounded-[28px] border border-white/[0.07] bg-white/[0.045] p-4 shadow-[0_22px_80px_rgba(0,0,0,0.24)] backdrop-blur-2xl md:flex-row md:items-center md:justify-between md:p-5">
              <div className="flex items-center gap-3 lg:hidden">
                <Image src="/workzo_icon.png" alt="WorkZo AI" width={38} height={38} className="rounded-xl" />
                <span className="text-xl font-black">
                  WorkZo <span className="text-blue-400">AI</span>
                </span>
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200/80">
                  Career workspace
                </p>
                <h1 className="mt-2 text-[32px] font-black leading-[1.02] tracking-[-0.04em] md:text-[46px]">
                  Welcome back, {candidateName}. 👋
                </h1>
                <p className="mt-3 max-w-3xl text-base leading-7 text-slate-300">
                  {hasCv
                    ? `You are preparing for ${targetRole} in ${market}. WorkZo will guide your next best step.`
                    : "Start with your CV so WorkZo can guide your job search, interview practice, and applications."}
                </p>
              </div>

              <Link
                href="/interview"
                className="inline-flex h-13 min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-violet-600 px-6 text-sm font-black text-white shadow-[0_18px_55px_rgba(59,130,246,0.28)]"
              >
                <Sparkles className="h-5 w-5" />
                Start Interview
              </Link>
            </header>

            <section className="mt-4 grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
              <div className="rounded-[30px] border border-white/[0.07] bg-[#071225]/82 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-200/80">
                      Recommended next step
                    </p>
                    <h2 className="mt-3 text-3xl font-black tracking-[-0.03em]">
                      {nextAction.title}
                    </h2>
                    <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
                      {nextAction.description}
                    </p>
                  </div>

                  <Link
                    href={nextAction.href}
                    className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-2xl bg-white text-sm font-black text-slate-950 px-5 hover:bg-cyan-50"
                  >
                    {nextAction.cta}
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {journey.map((step, index) => (
                    <div
                      key={step.label}
                      className={cn(
                        "rounded-[22px] border p-4",
                        step.done
                          ? "border-emerald-300/22 bg-emerald-400/[0.075]"
                          : "border-white/[0.07] bg-white/[0.035]",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-2xl bg-white/[0.06] text-sm font-black">
                          {step.done ? <CheckCircle2 className="h-5 w-5 text-emerald-200" /> : index + 1}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em]",
                            step.done
                              ? "bg-emerald-400/12 text-emerald-200"
                              : "bg-white/[0.06] text-slate-400",
                          )}
                        >
                          {step.done ? "Done" : "Next"}
                        </span>
                      </div>
                      <p className="mt-4 font-black">{step.label}</p>
                      <p className="mt-1 text-sm leading-5 text-slate-400">{step.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[30px] border border-cyan-300/14 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.16),transparent_36%),rgba(7,18,37,0.82)] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200/80">
                      Latest recruiter signal
                    </p>
                    <h2 className="mt-3 text-3xl font-black tracking-[-0.03em]">
                      {hasResults ? `${score || 72}/100 trust` : "No interview yet"}
                    </h2>
                  </div>
                  <div className="grid h-16 w-16 place-items-center rounded-[24px] border border-white/[0.08] bg-white/[0.045]">
                    <Target className="h-7 w-7 text-cyan-200" />
                  </div>
                </div>

                <p className="mt-4 text-base leading-7 text-slate-300">
                  {hasResults
                    ? weakness
                    : "After your first interview, this area will show where recruiter trust dropped, recovered, and what to practice next."}
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Link
                    href="/results"
                    className="rounded-2xl border border-white/[0.08] bg-white/[0.045] p-4 hover:bg-white/[0.07]"
                  >
                    <p className="font-black">View Results</p>
                    <p className="mt-1 text-sm text-slate-400">Trust timeline and weak moments</p>
                  </Link>
                  <Link
                    href="/copilot?mode=interview"
                    className="rounded-2xl border border-white/[0.08] bg-white/[0.045] p-4 hover:bg-white/[0.07]"
                  >
                    <p className="font-black">Ask Work-O-Bot</p>
                    <p className="mt-1 text-sm text-slate-400">Recover your weakest answer</p>
                  </Link>
                </div>
              </div>
            </section>

            <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.title}
                    href={action.href}
                    className="group rounded-[28px] border border-white/[0.07] bg-white/[0.045] p-5 shadow-[0_18px_70px_rgba(0,0,0,0.22)] backdrop-blur-2xl transition hover:-translate-y-0.5 hover:bg-white/[0.065]"
                  >
                    <div
                      className={`grid h-13 w-13 place-items-center rounded-[22px] bg-gradient-to-br ${action.accent} shadow-[0_0_34px_rgba(59,130,246,0.22)]`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="mt-5 text-xl font-black tracking-[-0.02em]">
                      {action.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {action.description}
                    </p>
                    <div className="mt-5 inline-flex items-center gap-2 text-sm font-black text-cyan-200">
                      Open
                      <ChevronRight className="h-4 w-4 transition group-hover:translate-x-1" />
                    </div>
                  </Link>
                );
              })}
            </section>

            <section className="mt-4 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-[28px] border border-white/[0.07] bg-white/[0.045] p-5 shadow-[0_18px_70px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/14 text-blue-200">
                    <MessageSquareText className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black">Work-O-Bot can help with</h2>
                    <p className="text-sm text-slate-400">Career help without leaving your flow</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {[
                    "Rewrite my CV summary",
                    "Draft a cover letter",
                    "Find job titles to search",
                    "Prepare interview stories",
                    "Write a recruiter message",
                    "Explain why my answer was weak",
                  ].map((item) => (
                    <div key={item} className="rounded-2xl border border-white/[0.07] bg-black/18 px-4 py-3 text-sm font-semibold text-slate-300">
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div id="settings" className="rounded-[28px] border border-white/[0.07] bg-white/[0.045] p-5 shadow-[0_18px_70px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/14 text-violet-200">
                    <Settings className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black">Workspace settings</h2>
                    <p className="text-sm text-slate-400">Simple for now. More controls later.</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/[0.07] bg-black/18 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Market</p>
                    <p className="mt-2 font-black">{market}</p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.07] bg-black/18 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Role</p>
                    <p className="mt-2 truncate font-black">{targetRole}</p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.07] bg-black/18 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Mode</p>
                    <p className="mt-2 font-black">Beta</p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>

      <WorkOBotFloating contextLabel="Ask about CV, jobs, cover letters, interview prep" />
    </main>
  );
}
