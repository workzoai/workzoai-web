"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Bell,
  Bookmark,
  Briefcase,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileText,
  Gift,
  Home,
  LineChart,
  Lock,
  MessageSquare,
  Plus,
  Settings,
  Sparkles,
  Star,
  Target,
  Users,
} from "lucide-react";

import { readLatestInterviewSetup, type WorkZoInterviewSetup } from "@/lib/workzoInterviewSetup";

type ResultPayload = {
  overallScore?: number;
  recruiterTrust?: number;
  pressure?: number;
  transcript?: Array<{ role: string; text: string; time?: string }>;
  scores?: Record<string, number>;
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

const navItems = [
  { label: "Dashboard", icon: Home, active: true, href: "/dashboard" },
  { label: "Interviews", icon: Sparkles, href: "/interview" },
  { label: "Practice", icon: Target, href: "/interview" },
  { label: "CV & Resumes", icon: FileText, href: "/onboarding" },
  { label: "Job Roles", icon: Briefcase, href: "/onboarding" },
  { label: "Analytics", icon: BarChart3, href: "/results" },
  { label: "Feedback", icon: MessageSquare, href: "/results" },
  { label: "Bookmarks", icon: Bookmark, href: "#" },
  { label: "Settings", icon: Settings, href: "#" },
];

const skillsFallback = [
  { label: "Evidence & Metrics", score: 68, width: "68%" },
  { label: "Role Fit", score: 70, width: "70%" },
  { label: "Communication", score: 72, width: "72%" },
  { label: "Answer Structure", score: 64, width: "64%" },
];

const chartPoints = [
  [0, 154],
  [52, 92],
  [105, 122],
  [158, 82],
  [210, 60],
  [263, 66],
  [315, 32],
  [368, 24],
  [420, 48],
  [472, 35],
  [525, 30],
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function safeText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function safeNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(100, Math.round(numeric)));
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

function getCandidateName(setup: Partial<WorkZoInterviewSetup>, results: ResultPayload | null) {
  const profile =
    setup.recruiterMemoryProfile ||
    results?.setup?.recruiterMemoryProfile ||
    null;

  if (profile && typeof profile === "object" && "candidateName" in profile) {
    const name = (profile as { candidateName?: unknown }).candidateName;
    if (typeof name === "string" && name.trim()) return name.trim();
  }

  return "Candidate";
}

function getRole(setup: Partial<WorkZoInterviewSetup>, results: ResultPayload | null) {
  const jobProfile =
    setup.jobMemoryProfile ||
    results?.setup?.jobMemoryProfile ||
    null;

  if (jobProfile && typeof jobProfile === "object" && "roleTitle" in jobProfile) {
    const roleTitle = (jobProfile as { roleTitle?: unknown }).roleTitle;
    if (typeof roleTitle === "string" && roleTitle.trim()) {
      return roleTitle.trim();
    }
  }

  const role = safeText(setup.targetRole || results?.setup?.targetRole, "Target Role");

  return role.length > 24 ? `${role.slice(0, 22)}…` : role;
}

function getCompany(setup: Partial<WorkZoInterviewSetup>, results: ResultPayload | null) {
  const jobProfile =
    setup.jobMemoryProfile ||
    results?.setup?.jobMemoryProfile ||
    null;

  if (jobProfile && typeof jobProfile === "object" && "companyName" in jobProfile) {
    const companyName = (jobProfile as { companyName?: unknown }).companyName;
    if (typeof companyName === "string" && companyName.trim()) return companyName.trim();
  }

  return "Your selected job";
}

function getMarket(setup: Partial<WorkZoInterviewSetup>, results: ResultPayload | null) {
  return safeText(setup.targetMarket || results?.setup?.targetMarket, "Global");
}

function getScore(results: ResultPayload | null) {
  const overall = safeNumber(results?.overallScore, 0);
  const trust = safeNumber(results?.recruiterTrust, 0);
  if (overall > 0) return overall;
  if (trust > 0) return trust;
  return 72;
}

function getTranscriptCount(results: ResultPayload | null) {
  return Array.isArray(results?.transcript) ? results.transcript.length : 0;
}

function getPracticeMinutes(results: ResultPayload | null) {
  const count = getTranscriptCount(results);
  if (!count) return "0m";
  const minutes = Math.max(4, Math.round(count * 1.6));
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
}

function buildSkillRows(results: ResultPayload | null) {
  const scores = results?.scores || {};
  const rows = [
    { label: "Clarity", score: safeNumber(scores.clarity, 0) },
    { label: "Relevance", score: safeNumber(scores.relevance, 0) },
    { label: "Evidence & Metrics", score: safeNumber(scores.evidence, 0) },
    { label: "Answer Structure", score: safeNumber(scores.structure, 0) },
  ].filter((item) => item.score > 0);

  if (!rows.length) return skillsFallback;

  return rows.map((item) => ({
    ...item,
    width: `${item.score}%`,
  }));
}

function MetricCard({
  label,
  value,
  suffix,
  trend,
  icon: Icon,
}: {
  label: string;
  value: string;
  suffix?: string;
  trend: string;
  icon: typeof Users;
}) {
  return (
    <div className="h-[104px] rounded-[20px] border border-white/10 bg-white/[0.045] p-4 shadow-[0_14px_50px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-blue-500/12 text-blue-300">
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-5 text-slate-300">{label}</p>
          <div className="mt-2 flex items-end gap-1">
            <p className="text-[28px] font-black leading-none tracking-tight text-white">{value}</p>
            {suffix && <span className="pb-0.5 text-base font-medium text-slate-400">{suffix}</span>}
          </div>
          <p className="mt-1.5 text-[12px] font-semibold text-emerald-300">{trend}</p>
        </div>
      </div>
    </div>
  );
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
  const companyName = getCompany(dashboardState.setup, dashboardState.results);
  const market = getMarket(dashboardState.setup, dashboardState.results);
  const score = getScore(dashboardState.results);
  const transcriptCount = getTranscriptCount(dashboardState.results);
  const practiceTime = getPracticeMinutes(dashboardState.results);
  const skillRows = buildSkillRows(dashboardState.results);
  const hasSetup = Boolean(dashboardState.setup?.cvText || dashboardState.setup?.jobDescription || dashboardState.results);

  const recentInterviews = useMemo(
    () => [
      {
        role: targetRole,
        company: companyName,
        status: dashboardState.results ? "Completed" : hasSetup ? "Ready" : "Setup Needed",
        score: dashboardState.results ? `${score}/100` : "—",
        date: dashboardState.results ? "Latest session" : "Not started",
        avatar: "👤",
      },
      {
        role: "Behavioral Practice",
        company: market,
        status: "Suggested",
        score: "—",
        date: "Next",
        avatar: "💬",
      },
      {
        role: "Pressure Round",
        company: "Recruiter simulation",
        status: "Suggested",
        score: "—",
        date: "Next",
        avatar: "🔥",
      },
      {
        role: "Evidence Drill",
        company: "Metrics and ownership",
        status: "Suggested",
        score: "—",
        date: "Next",
        avatar: "📊",
      },
    ],
    [companyName, dashboardState.results, hasSetup, market, score, targetRole]
  );

  const metrics = [
    {
      label: "Interview Sessions",
      value: dashboardState.results ? "1" : "0",
      trend: dashboardState.results ? "Latest session saved" : "Start your first session",
      icon: Users,
    },
    {
      label: "Average Trust Score",
      value: String(score),
      suffix: "/100",
      trend: dashboardState.results ? "Latest recruiter signal" : "Estimated baseline",
      icon: Lock,
    },
    {
      label: "Target Role",
      value: targetRole === "Target Role" ? "—" : "1",
      trend: targetRole === "Target Role" ? "Role not selected" : targetRole,
      icon: Briefcase,
    },
    {
      label: "Practice Time",
      value: practiceTime,
      trend: transcriptCount ? `${transcriptCount} transcript moments` : "No session yet",
      icon: Clock3,
    },
    {
      label: "Feedback Items",
      value: String(
        (dashboardState.results?.memory?.improvements?.length || 0) +
          (dashboardState.results?.memory?.weaknesses?.length || 0)
      ),
      trend: dashboardState.results ? "From recruiter feedback" : "Ready after interview",
      icon: MessageSquare,
    },
  ];

  const linePath = chartPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point[0]} ${point[1]}`)
    .join(" ");

  return (
    <main className="h-screen overflow-hidden bg-[linear-gradient(180deg,#06111f_0%,#050816_100%)] text-white">
      <div className="flex h-full w-full">
        <aside className="hidden h-screen w-[250px] shrink-0 flex-col border-r border-white/[0.06] bg-[#061225]/86 px-5 py-6 backdrop-blur-2xl lg:flex">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/workzo_icon.png" alt="WorkZo AI" width={40} height={40} className="rounded-xl" />
            <span className="text-[22px] font-black tracking-tight">
              WorkZo <span className="text-blue-400">AI</span>
            </span>
          </Link>

          <nav className="mt-7 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "flex h-[46px] items-center justify-between rounded-[14px] px-4 text-[15px] font-semibold transition",
                    item.active
                      ? "bg-gradient-to-r from-blue-500 to-violet-600 text-white shadow-[0_14px_36px_rgba(59,130,246,0.28)]"
                      : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                  )}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </span>
                  <ChevronRight className="h-4 w-4 opacity-70" />
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-[20px] border border-white/10 bg-white/[0.045] p-4">
            <div className="flex items-center gap-3">
              <Star className="h-4 w-4 fill-yellow-300 text-yellow-300" />
              <p className="text-base font-black">Upgrade to Pro</p>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-300">
              Unlimited interviews and deeper analytics.
            </p>
            <button className="mt-3 h-10 w-full rounded-2xl bg-gradient-to-r from-blue-500 to-violet-600 text-sm font-black text-white">
              Upgrade Now
            </button>
          </div>

          <div className="mt-6 flex items-center gap-3 border-t border-white/10 pt-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-xl">👤</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black">{candidateName}</p>
              <p className="text-xs text-blue-300">{market}</p>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </div>
        </aside>

        <section className="min-w-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 lg:px-6">
          <div className="mx-auto max-w-[1600px]">
            <header className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h1 className="text-[28px] font-black leading-tight tracking-tight lg:text-[34px]">
                  Welcome back, {candidateName}! 👋
                </h1>
                <p className="mt-1.5 text-[15px] text-slate-300">
                  {hasSetup
                    ? `Your ${targetRole} interview setup is ready.`
                    : "Upload your CV and start your first realistic interview."}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button className="hidden h-10 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] px-4 text-sm font-bold text-white md:flex">
                  <Gift className="h-4 w-4 text-blue-300" />
                  Invite
                </button>
                <button className="relative hidden h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] md:flex">
                  <Bell className="h-5 w-5" />
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-violet-500 text-xs font-black">3</span>
                </button>
                <Link
                  href="/onboarding"
                  className="inline-flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-violet-600 px-5 text-sm font-black text-white shadow-[0_18px_55px_rgba(59,130,246,0.28)]"
                >
                  <Plus className="h-5 w-5" />
                  New Interview
                </Link>
              </div>
            </header>

            <section className="grid gap-[14px] md:grid-cols-2 xl:grid-cols-5">
              {metrics.map((item) => (
                <MetricCard key={item.label} {...item} />
              ))}
            </section>

            <section className="mt-[16px] grid gap-[16px] xl:grid-cols-[58%_42%]">
              <div className="h-[350px] rounded-[22px] border border-white/10 bg-white/[0.045] p-4 shadow-[0_18px_70px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[20px] font-black">Recent Interviews</h2>
                  <Link href="/results" className="flex h-9 items-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-white">
                    View all
                  </Link>
                </div>

                <div className="divide-y divide-white/10">
                  {recentInterviews.map((item) => (
                    <div key={`${item.role}-${item.company}`} className="grid h-[60px] grid-cols-[1fr_104px_88px_104px_22px] items-center gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-lg">{item.avatar}</div>
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-black">{item.role}</p>
                          <p className="truncate text-[12px] text-slate-400">{item.company}</p>
                        </div>
                      </div>

                      <span
                        className={cn(
                          "w-fit rounded-xl px-3 py-1 text-xs font-bold",
                          item.status === "Completed"
                            ? "bg-emerald-400/10 text-emerald-300"
                            : item.status === "Ready" || item.status === "Suggested"
                              ? "bg-blue-400/10 text-blue-300"
                              : "bg-white/8 text-slate-300"
                        )}
                      >
                        {item.status}
                      </span>

                      <div>
                        <p className="text-xs text-slate-400">Trust</p>
                        <p className={cn("text-sm font-black", item.score === "—" ? "text-slate-400" : "text-emerald-300")}>{item.score}</p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-400">Date</p>
                        <p className="text-[13px] text-slate-200">{item.date}</p>
                      </div>

                      <ChevronRight className="h-5 w-5 text-slate-400" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="h-[350px] rounded-[22px] border border-white/10 bg-white/[0.045] p-4 shadow-[0_18px_70px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-[20px] font-black">Performance Overview</h2>
                  <button className="flex h-9 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-bold">
                    This Month
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>

                <div className="relative h-[178px] rounded-2xl">
                  <svg viewBox="0 0 540 210" className="h-full w-full overflow-visible">
                    {[0, 1, 2, 3].map((line) => (
                      <line
                        key={line}
                        x1="20"
                        y1={20 + line * 45}
                        x2="525"
                        y2={20 + line * 45}
                        stroke="rgba(255,255,255,0.08)"
                      />
                    ))}
                    <path d={`${linePath} L 525 185 L 0 185 Z`} fill="url(#chartFill)" opacity="0.72" />
                    <path d={linePath} fill="none" stroke="url(#chartLine)" strokeWidth="5" strokeLinecap="round" />
                    <circle cx="525" cy="30" r="6" fill="#7a5cff" />
                    <defs>
                      <linearGradient id="chartLine" x1="0" x2="1">
                        <stop offset="0%" stopColor="#20c8ff" />
                        <stop offset="100%" stopColor="#7a5cff" />
                      </linearGradient>
                      <linearGradient id="chartFill" y1="0" y2="1">
                        <stop offset="0%" stopColor="#5947ff" stopOpacity="0.55" />
                        <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.02" />
                      </linearGradient>
                    </defs>
                  </svg>

                  <div className="absolute right-3 top-2 rounded-xl bg-violet-500 px-3 py-2 text-sm font-black">
                    {score}
                  </div>
                </div>

                <div className="mt-3 flex h-[70px] items-center justify-between rounded-[18px] border border-white/10 bg-white/[0.04] px-5">
                  <div>
                    <p className="text-[14px] text-slate-200">
                      {dashboardState.results
                        ? "Your latest recruiter trust score is saved."
                        : "Start an interview to unlock real performance data."}
                    </p>
                    <p className="mt-1.5 text-sm text-slate-400">Practice with measurable proof to reach 80+</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/12 text-emerald-300">
                    <LineChart className="h-6 w-6" />
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-[16px] grid gap-[16px] xl:grid-cols-[58%_42%]">
              <div className="h-[190px] rounded-[22px] border border-white/10 bg-white/[0.045] p-4 shadow-[0_18px_70px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-3 text-[20px] font-black">
                    <CalendarDays className="h-5 w-5 text-violet-300" />
                    Next Practice Plan
                  </h2>
                  <Link href="/interview" className="flex h-9 items-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-bold">
                    Start now
                  </Link>
                </div>

                <div className="space-y-2">
                  {[
                    { day: "1", title: `${targetRole} recruiter simulation`, note: companyName, time: "12 min" },
                    { day: "2", title: "Retry weakest answer", note: "Improve evidence and ownership", time: "8 min" },
                  ].map((item) => (
                    <div key={item.day} className="grid h-[54px] grid-cols-[52px_1fr_80px_112px] items-center gap-4 border-b border-white/10 last:border-0">
                      <div className="flex h-10 w-10 flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                        <span className="text-xs font-black text-blue-300">STEP</span>
                        <span className="text-base font-black">{item.day}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-black">{item.title}</p>
                        <p className="mt-0.5 truncate text-sm text-slate-400">{item.note}</p>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Clock3 className="h-4 w-4" />
                        {item.time}
                      </div>
                      <Link href="/interview" className="flex h-9 items-center justify-center rounded-2xl bg-white/[0.06] text-sm font-black text-white hover:bg-white/10">
                        Start
                      </Link>
                    </div>
                  ))}
                </div>
              </div>

              <div className="h-[220px] overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.045] p-4 shadow-[0_18px_70px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-[20px] font-black">Top Skills to Improve</h2>
                  <Link href="/results" className="flex h-9 items-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-bold">
                    View
                  </Link>
                </div>

                <div className="space-y-2.5">
                  {skillRows.map((skill) => (
                    <div key={skill.label} className="grid h-7 grid-cols-[132px_1fr_58px] items-center gap-4">
                      <p className="truncate text-sm font-semibold text-slate-100">{skill.label}</p>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500" style={{ width: skill.width }} />
                      </div>
                      <p className="text-right text-sm text-slate-300">{skill.score}/100</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
