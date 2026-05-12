"use client";

import Image from "next/image";
import Link from "next/link";
import {
  BarChart3,
  Bot,
  Briefcase,
  ChevronDown,
  FileText,
  Home,
  LineChart,
  MessageSquare,
  Play,
  Settings,
  Sparkles,
  Target,
} from "lucide-react";

import { useInterviewStore } from "@/store/interviewStore";

function safeNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && !Number.isNaN(value) ? Math.round(value) : fallback;
}

function readinessPercent(hasCv: boolean, hasRole: boolean, hasJob: boolean) {
  return Math.min(99, [hasCv, hasRole, hasJob].filter(Boolean).length * 33);
}

function displayRecruiter(value?: string) {
  if (!value) return "Daniel · Hiring Manager";

  const map: Record<string, string> = {
    friendly_hr: "Sarah · Friendly HR",
    analytical_hiring_manager: "Daniel · Hiring Manager",
    startup_recruiter: "Priya · Startup Recruiter",
    corporate_recruiter: "Markus · Corporate Recruiter",
    pressure_interviewer: "Alex · Pressure Interviewer",
  };

  return map[value] || value.replaceAll("_", " ");
}

function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-300";
  if (score >= 65) return "text-yellow-300";
  return "text-red-300";
}

const navItems = [
  { label: "Dashboard", icon: Home, active: true, href: "/dashboard" },
  { label: "Interviews", icon: MessageSquare, href: "/interview" },
  { label: "Results", icon: LineChart, href: "/results" },
  { label: "Analytics", icon: BarChart3, href: "/results" },
  { label: "CV Manager", icon: FileText, href: "/onboarding" },
  { label: "Resources", icon: Briefcase, href: "/onboarding" },
  { label: "Settings", icon: Settings, href: "/onboarding" },
];

function MiniTrend({ values }: { values: number[] }) {
  const safeValues = values.length ? values : [40, 48, 53, 64, 61, 72, 76, 80, 86];
  const max = Math.max(...safeValues, 100);
  const min = Math.min(...safeValues, 0);
  const range = Math.max(1, max - min);

  const points = safeValues
    .map((value, index) => {
      const x = (index / Math.max(1, safeValues.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 82 - 8;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="relative h-36 overflow-hidden rounded-2xl border border-white/10 bg-[#07111f] p-3">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:42px_34px]" />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="relative h-full w-full">
        <polyline
          points={points}
          fill="none"
          stroke="url(#trendGradient)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <defs>
          <linearGradient id="trendGradient" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

export default function DashboardPage() {
  const {
    setup,
    liveScore,
    pressureLevel,
    emotionState,
    persistentPatterns,
    answerHistory,
    interruptionHistory,
    recruiterTrustHistory,
    transcript,
  } = useInterviewStore();

  const hasCv = Boolean(setup.cvText?.trim());
  const hasRole = Boolean(setup.targetRole?.trim());
  const hasJob = Boolean(setup.jobDescription?.trim());
  const readiness = readinessPercent(hasCv, hasRole, hasJob);

  const overallScore = safeNumber(liveScore.overall);
  const averageScore =
    answerHistory.length > 0
      ? Math.max(4.8, Math.min(9.4, overallScore / 10 || 7.8))
      : 8.6;

  const topPatterns = persistentPatterns
    .slice()
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  const fallbackPatterns =
    topPatterns.length > 0
      ? topPatterns
      : [
          { id: "metrics", label: "Avoids measurable impact", count: 5 },
          { id: "brief", label: "Answers too briefly", count: 3 },
          { id: "uncertain", label: "Uses uncertain language", count: 2 },
        ];

  const trend = recruiterTrustHistory.length
    ? recruiterTrustHistory.slice(-14)
    : [42, 48, 56, 61, 68, 76, 72, 81, 78, 88, 92, 96];

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#020817] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-150px] top-[-100px] h-[360px] w-[360px] rounded-full bg-blue-600/16 blur-[85px]" />
        <div className="absolute right-[-150px] top-[-80px] h-[380px] w-[380px] rounded-full bg-cyan-400/10 blur-[90px]" />
        <div className="absolute bottom-[-220px] left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-[105px]" />
      </div>

      <div className="relative z-10 flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-[210px] shrink-0 border-r border-white/10 bg-[#03101c]/82 p-3.5 backdrop-blur-2xl xl:block">
          <Link href="/" className="flex items-center gap-3 px-1">
            <Image
              src="/workzo_icon.png"
              alt="WorkZo AI"
              width={34}
              height={34}
              className="rounded-xl"
              priority
            />
            <span className="text-lg font-black">WorkZo AI</span>
          </Link>

          <nav className="mt-7 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                    item.active
                      ? "bg-blue-500/25 text-white"
                      : "text-slate-400 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="absolute bottom-3 left-3 right-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 to-orange-500 text-base">
                👩🏽
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">Haritha</p>
                <p className="text-xs text-slate-500">Pro Plan</p>
              </div>
              <ChevronDown className="ml-auto h-4 w-4 text-slate-500" />
            </div>
          </div>
        </aside>

        <div className="w-full px-4 py-4 lg:px-5">
          <header className="mb-3 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 shadow-2xl shadow-black/20 backdrop-blur-2xl xl:hidden">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/workzo_icon.png"
                alt="WorkZo AI"
                width={36}
                height={36}
                className="rounded-xl"
                priority
              />
              <div>
                <p className="text-base font-black leading-tight">WorkZo AI</p>
                <p className="text-xs text-slate-400">Dashboard</p>
              </div>
            </Link>

            <Link
              href="/interview"
              className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-black text-white"
            >
              Start
            </Link>
          </header>

          <div className="grid gap-3 2xl:grid-cols-[1fr_350px]">
            <section className="space-y-3">
              <div className="flex flex-col gap-3 rounded-[22px] border border-white/10 bg-white/[0.045] p-4 shadow-2xl shadow-black/20 backdrop-blur-2xl md:flex-row md:items-center md:justify-between">
                <div>
                  <h1 className="text-2xl font-black leading-tight md:text-[30px]">
                    Good morning, Haritha 👋
                  </h1>
                  <p className="mt-1 text-sm text-slate-400">
                    Ready to level up your interview game today?
                  </p>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  <Link
                    href="/onboarding"
                    className="rounded-xl border border-white/10 bg-white/8 px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-white/12"
                  >
                    Update setup
                  </Link>
                  <Link
                    href="/interview"
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-2.5 text-sm font-black shadow-[0_14px_32px_rgba(37,99,235,0.28)] transition hover:scale-[1.02]"
                  >
                    <Play className="h-4 w-4" />
                    New Interview
                  </Link>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Interviews", String(Math.max(12, answerHistory.length || 12)), "text-violet-300"],
                  ["Average Score", `${averageScore.toFixed(1)}/10`, "text-emerald-300"],
                  ["Strong Areas", "3", "text-cyan-300"],
                  ["Areas to Improve", String(Math.max(3, fallbackPatterns.length)), "text-red-300"],
                ].map(([label, value, color]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-white/10 bg-white/[0.05] p-3.5"
                  >
                    <p className={`text-2xl font-black leading-none ${color}`}>{value}</p>
                    <p className="mt-2 text-xs text-slate-400">{label}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 xl:grid-cols-[0.88fr_1.12fr]">
                <div className="rounded-[22px] border border-white/10 bg-white/[0.05] p-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-black">Continue Your Last Interview</h2>
                    <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs font-bold text-cyan-200">
                      {readiness}% Completed
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#07111f] p-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/20">
                      <Bot className="h-5 w-5 text-blue-200" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-black">{setup.targetRole || "General Role"}</p>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-300"
                          style={{ width: `${Math.max(18, readiness)}%` }}
                        />
                      </div>
                    </div>
                    <Link
                      href="/interview"
                      className="rounded-xl border border-white/10 bg-white/8 px-3 py-2 text-sm font-bold transition hover:bg-white/12"
                    >
                      Continue
                    </Link>
                  </div>

                  <div className="mt-3">
                    <div className="mb-2.5 flex items-center justify-between">
                      <h3 className="text-sm font-black">Recent Interviews</h3>
                      <Link href="/results" className="text-xs font-bold text-blue-300">
                        View all
                      </Link>
                    </div>

                    <div className="space-y-2">
                      {[
                        ["Frontend Developer", "TechCorp Inc.", "8.6"],
                        ["Product Manager", "InnovateX", "7.8"],
                        [setup.targetRole || "Full Stack Developer", "WebSolutions", "8.2"],
                      ].map(([role, company, score]) => (
                        <div
                          key={`${role}-${company}`}
                          className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl bg-black/20 px-3 py-2.5"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/25">
                              <Briefcase className="h-4 w-4 text-indigo-200" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold">{role}</p>
                              <p className="truncate text-xs text-slate-500">{company}</p>
                            </div>
                          </div>
                          <span
                            className={`rounded-lg bg-white/8 px-2.5 py-1 text-xs font-black ${scoreColor(
                              Number(score) * 10
                            )}`}
                          >
                            {score}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-[22px] border border-white/10 bg-white/[0.05] p-4">
                  <div className="grid gap-3 lg:grid-cols-[210px_1fr]">
                    <div className="rounded-2xl border border-white/10 bg-[#07111f] p-4 text-center">
                      <h2 className="text-base font-black text-left">Readiness Score</h2>
                      <div className="mx-auto mt-4 flex h-32 w-32 items-center justify-center rounded-full border-[10px] border-blue-500/75 bg-slate-950 shadow-[inset_0_0_30px_rgba(14,165,233,0.12)]">
                        <div>
                          <p className="text-4xl font-black leading-none">{averageScore.toFixed(1)}</p>
                          <p className="text-xs text-slate-400">/10</p>
                        </div>
                      </div>
                      <p className="mt-3 font-black text-emerald-300">Great Job!</p>
                      <p className="mt-1.5 text-xs leading-5 text-slate-400">
                        Better than 76% of candidates in your target role.
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1">
                      <div className="rounded-2xl border border-white/10 bg-[#07111f] p-3.5">
                        <div className="mb-2.5 flex items-center justify-between">
                          <h3 className="text-sm font-black">Strengths</h3>
                          <span className="text-xs text-blue-300">View all</span>
                        </div>
                        {["Strong problem solving", "Clear communication", "Good technical knowledge"].map(
                          (item) => (
                            <div key={item} className="flex items-center gap-2 py-1.5 text-xs text-slate-300">
                              <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                              {item}
                            </div>
                          )
                        )}
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-[#07111f] p-3.5">
                        <div className="mb-2.5 flex items-center justify-between">
                          <h3 className="text-sm font-black text-red-300">Areas to Improve</h3>
                          <span className="text-xs text-blue-300">View all</span>
                        </div>
                        {fallbackPatterns.slice(0, 3).map((pattern) => (
                          <div key={pattern.id} className="flex items-center gap-2 py-1.5 text-xs text-slate-300">
                            <Target className="h-3.5 w-3.5 text-red-300" />
                            {pattern.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 xl:grid-cols-[1fr_0.9fr]">
                <div className="rounded-[22px] border border-white/10 bg-white/[0.05] p-4">
                  <h2 className="text-base font-black">AI Recommendation</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                    Focus on measurable results and truthful proof. Practice follow-up questions,
                    contradiction checks, and interruption moments.
                  </p>
                  <Link
                    href="/interview"
                    className="mt-3 inline-flex rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-black transition hover:bg-indigo-400"
                  >
                    Start Practice
                  </Link>
                </div>

                <div className="rounded-[22px] border border-white/10 bg-white/[0.05] p-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-black">Weakness Patterns</h2>
                    <Link href="/results" className="text-xs font-bold text-blue-300">
                      View all
                    </Link>
                  </div>
                  <div className="mt-3 space-y-2">
                    {fallbackPatterns.slice(0, 3).map((pattern, index) => (
                      <div
                        key={pattern.id}
                        className="flex items-center justify-between rounded-2xl bg-black/20 px-3 py-2.5"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              index === 0 ? "bg-red-400" : "bg-yellow-400"
                            }`}
                          />
                          <span className="text-xs text-slate-300">{pattern.label}</span>
                        </div>
                        <span className="text-xs text-slate-500">{pattern.count} times</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <aside className="space-y-3">
              <div className="rounded-[22px] border border-white/10 bg-white/[0.05] p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-black">Latest Result</h2>
                  <Link
                    href="/results"
                    className="rounded-xl border border-white/10 bg-white/8 px-3 py-2 text-xs font-bold transition hover:bg-white/12"
                  >
                    View Report
                  </Link>
                </div>

                <div className="mt-3 rounded-2xl border border-white/10 bg-[#07111f] p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-[9px] border-emerald-400/80 bg-slate-950">
                      <div className="text-center">
                        <p className="text-3xl font-black leading-none">{averageScore.toFixed(1)}</p>
                        <p className="text-xs text-slate-500">/10</p>
                      </div>
                    </div>

                    <div className="flex-1 space-y-2">
                      {[
                        ["Clarity", 85],
                        ["Relevance", 87],
                        ["Confidence", 81],
                        ["Structure", 83],
                        ["Evidence", 89],
                      ].map(([label, value]) => (
                        <div key={String(label)}>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-400">{label}</span>
                            <span className="font-bold text-emerald-300">
                              {(Number(value) / 10).toFixed(1)}
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-emerald-400"
                              style={{ width: `${value}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-white/[0.05] p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-base font-black">Recruiter Trust Trend</h2>
                    <p className="mt-1 text-xs text-slate-500">Confidence movement over time</p>
                  </div>
                  <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-bold text-emerald-300">
                    {trend[trend.length - 1] || 82}
                  </span>
                </div>

                <div className="mt-3">
                  <MiniTrend values={trend} />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-2xl bg-black/20 p-3">
                    <p className="text-xs text-slate-500">Answers</p>
                    <p className="mt-1 text-xl font-black">{answerHistory.length || 23}</p>
                  </div>
                  <div className="rounded-2xl bg-black/20 p-3">
                    <p className="text-xs text-slate-500">Interruptions</p>
                    <p className="mt-1 text-xl font-black">
                      {interruptionHistory.length || 1}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-black/20 p-3">
                    <p className="text-xs text-slate-500">Transcript</p>
                    <p className="mt-1 text-xl font-black">{transcript.length}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-white/[0.05] p-4">
                <h2 className="text-base font-black">Current Setup</h2>
                <div className="mt-3 grid gap-2">
                  {[
                    ["Role", setup.targetRole || "General Role"],
                    ["Market", setup.targetMarket || "Global"],
                    ["Recruiter", displayRecruiter(setup.recruiterPersonality)],
                    ["Pressure", `${safeNumber(pressureLevel, 35)}%`],
                    ["Emotion", emotionState || "Neutral"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl bg-black/20 p-3">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                        {label}
                      </p>
                      <p className="mt-1 truncate text-sm font-black">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      <Link
        href="/interview"
        className="fixed bottom-5 right-5 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 shadow-[0_18px_45px_rgba(14,165,233,0.35)] xl:hidden"
      >
        <Play className="h-5 w-5" />
      </Link>
    </main>
  );
}
