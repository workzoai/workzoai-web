"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  Home,
  Mail,
  Menu,
  Mic,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Star,
  TrendingUp,
  X,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: Home },
  { label: "Improve CV", href: "/cv", icon: FileText },
  { label: "Cover Letter", href: "/cover-letter", icon: Mail },
  { label: "Find Jobs", href: "/jobs", icon: Briefcase },
  { label: "Real Interview AI", href: "/interview", icon: Mic },
  { label: "Results", href: "/results", icon: BarChart3 },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

const actionCards = [
  {
    title: "Improve CV",
    detail: "ATS score: 85 · 3 fixes available",
    href: "/cv",
    icon: FileText,
    tone: "emerald",
    cta: "Review CV",
  },
  {
    title: "Cover Letter",
    detail: "Create a focused letter from CV + job context",
    href: "/cover-letter",
    icon: Mail,
    tone: "violet",
    cta: "Create letter",
  },
  {
    title: "Find Jobs",
    detail: "12 matching roles prepared from your profile",
    href: "/jobs",
    icon: Search,
    tone: "blue",
    cta: "Find roles",
  },
];

const journeyItems = [
  { label: "CV uploaded", done: true },
  { label: "Job context added", done: true },
  { label: "Interview prepared", done: true },
  { label: "Feedback reviewed", done: false },
];

const insights = [
  {
    color: "bg-emerald-300",
    title: "Support experience is your strongest signal",
    detail: "Use customer-facing stories when answering Sales, Success, or Analyst role questions.",
  },
  {
    color: "bg-yellow-300",
    title: "Add measurable impact",
    detail: "Recruiters need numbers, scale, time saved, quality improved, or customer outcome.",
  },
  {
    color: "bg-blue-400",
    title: "Prepare one ownership story",
    detail: "Choose one example with pressure, your action, and the final result.",
  },
];

const quickLinks = [
  { label: "Interview history", href: "/history", icon: Clock3 },
  { label: "Saved cover letters", href: "/cover-letter", icon: FileText },
  { label: "Job matches", href: "/jobs", icon: Briefcase },
  { label: "Recommended roles", href: "/jobs", icon: Star },
];

function toneClasses(tone: string) {
  if (tone === "emerald") return "bg-emerald-400/10 text-emerald-200 border-emerald-300/20";
  if (tone === "violet") return "bg-violet-400/10 text-violet-200 border-violet-300/20";
  return "bg-blue-400/10 text-blue-200 border-blue-300/20";
}

function MiniTrendChart() {
  const points = [45, 60, 72, 85];
  const width = 360;
  const height = 130;
  const coords = points.map((value, index) => {
    const x = 34 + index * 96;
    const y = 108 - (value / 100) * 78;
    return { x, y, value };
  });
  const path = coords.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  return (
    <div className="rounded-2xl border border-white/8 bg-black/15 p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[130px] w-full" role="img" aria-label="Performance trend">
        {[28, 54, 80, 106].map((y) => (
          <line key={y} x1="24" y1={y} x2="340" y2={y} stroke="rgba(148,163,184,0.16)" strokeWidth="1" />
        ))}
        <path d={path} fill="none" stroke="rgb(59,130,246)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((point, index) => (
          <g key={point.value}>
            <circle cx={point.x} cy={point.y} r="8" fill="#061225" stroke="rgb(96,165,250)" strokeWidth="5" />
            <text x={point.x} y={point.y - 18} textAnchor="middle" fill="rgb(147,197,253)" fontSize="16" fontWeight="800">
              {point.value}
            </text>
            <text x={point.x} y="124" textAnchor="middle" fill="rgb(148,163,184)" fontSize="13" fontWeight="600">
              W{index + 1}
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-1 flex items-center justify-center gap-2 text-xs font-semibold text-slate-400">
        <span className="h-1 w-8 rounded-full bg-blue-400" /> Overall score
      </div>
    </div>
  );
}

function SidebarContent({
  pathname,
  onNavClick,
  botOpen,
  onBotToggle,
}: {
  pathname: string;
  onNavClick?: () => void;
  botOpen: boolean;
  onBotToggle: () => void;
}) {
  return (
    <>
      <Link href="/dashboard" className="flex items-center gap-3" onClick={onNavClick}>
        <Image src="/workzo_icon.png" alt="WorkZo AI" width={44} height={44} priority className="rounded-2xl" />
        <div>
          <div className="text-xl font-black tracking-tight">WorkZo <span className="text-blue-400">AI</span></div>
          <div className="mt-0.5 text-[9px] font-black uppercase tracking-[0.24em] text-cyan-200">Career OS</div>
        </div>
      </Link>

      <nav className="mt-7 space-y-1.5" aria-label="Main navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={onNavClick}
              aria-current={isActive ? "page" : undefined}
              className={`flex h-10 items-center gap-3 rounded-xl px-3 text-[12px] font-black transition ${
                isActive
                  ? "bg-gradient-to-r from-blue-500 to-violet-600 text-white shadow-[0_16px_40px_rgba(37,99,235,0.22)]"
                  : "text-slate-300 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-4">
        <div className="rounded-[16px] border border-cyan-300/15 bg-cyan-300/[0.045] p-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[13px] font-black leading-tight">Work-O-Bot</div>
              <div className="text-[10px] font-bold text-cyan-200">Career assistant</div>
            </div>
          </div>
          <button
            onClick={onBotToggle}
            className="mt-2.5 h-8 w-full rounded-xl bg-white/10 text-[11px] font-black text-white transition hover:bg-white/[0.14]"
          >
            {botOpen ? "Close assistant" : "Open assistant"}
          </button>
          {botOpen && (
            <p className="mt-2 rounded-lg bg-white/5 px-3 py-2 text-[11px] leading-5 text-cyan-100">
              Work-O-Bot is coming soon. You&apos;ll be able to ask career questions, get CV tips, and prep for interviews here.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2.5 border-t border-white/10 pt-3">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-100 to-slate-300" />
          <div className="min-w-0">
            <div className="truncate text-xs font-black">Haritha Vijayakumar</div>
            <div className="truncate text-[10px] text-slate-400">Data Science Enthusiast</div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function DashboardPage() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [botOpen, setBotOpen] = useState(false);

  return (
    <main className="min-h-screen bg-[#050b14] text-white">
      {/* ── Mobile top bar ── */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-white/10 bg-[#07111f] px-4 lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <Image src="/workzo_icon.png" alt="WorkZo AI" width={32} height={32} priority className="rounded-xl" />
          <span className="text-base font-black tracking-tight">WorkZo <span className="text-blue-400">AI</span></span>
        </Link>
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation menu"
          className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.06] hover:bg-white/[0.1]"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* ── Mobile drawer ── */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-white/10 bg-[#07111f] px-5 py-6 lg:hidden">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <SidebarContent
                  pathname={pathname}
                  onNavClick={() => setDrawerOpen(false)}
                  botOpen={botOpen}
                  onBotToggle={() => setBotOpen((v) => !v)}
                />
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation menu"
                className="ml-2 mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/[0.06] hover:bg-white/[0.1]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </aside>
        </>
      )}

      <div className="flex min-h-screen">
        {/* ── Desktop sidebar ── */}
        <aside className="fixed inset-y-0 left-0 hidden w-[248px] flex-col border-r border-white/10 bg-[#07111f]/92 px-5 py-6 lg:flex">
          <SidebarContent
            pathname={pathname}
            botOpen={botOpen}
            onBotToggle={() => setBotOpen((v) => !v)}
          />
        </aside>

        {/* ── Main content ── */}
        <section className="w-full px-5 pt-20 pb-7 lg:ml-[248px] lg:px-10 lg:pt-7 xl:px-14">

          {/* Header */}
          <header className="flex flex-col gap-5 border-b border-white/10 pb-7 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.42em] text-cyan-200">Career Workspace</p>
              <h1 className="mt-2.5 text-4xl font-black tracking-[-0.04em] sm:text-5xl">Welcome back, Haritha! 👋</h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300">Your focused workspace for interview practice, CV improvement, and job preparation.</p>
            </div>
            {/* Single primary CTA — Start Interview is surfaced in the hero card below */}
            <div className="flex shrink-0 items-center xl:mt-1">
              <Link
                href="/onboarding"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[0.035] px-6 text-sm font-black transition hover:bg-white/[0.06]"
              >
                <RefreshCw className="h-4 w-4" /> Update CV
              </Link>
            </div>
          </header>

          {/* Row 1 — Hero CTA + Journey */}
          <div className="mt-8 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
            {/* Hero: primary CTA lives here, not duplicated in header */}
            <section className="rounded-[24px] border border-blue-300/15 bg-gradient-to-br from-blue-500/[0.13] via-[#0b1527] to-[#0a1020] p-7">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-cyan-100">Next Best Action</div>
                  <h2 className="mt-4 text-2xl font-black leading-snug tracking-[-0.03em]">Practice your first realistic recruiter call</h2>
                  <p className="mt-2.5 max-w-2xl text-sm leading-7 text-slate-300">Your CV and job context are ready. Start one interview and get feedback on trust, clarity, ownership, and measurable impact.</p>
                </div>
                <Link
                  href="/interview"
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-slate-950 transition hover:bg-slate-100"
                >
                  Start practice <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </section>

            <section className="rounded-[24px] border border-white/10 bg-[#0b1527] p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-200">Journey</p>
                  <h2 className="mt-1.5 text-2xl font-black">75% ready</h2>
                </div>
                <div className="grid h-16 w-16 place-items-center rounded-full border-[8px] border-blue-500 bg-[#07111f] text-base font-black">75%</div>
              </div>
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-1">
                {journeyItems.map((item, index) => (
                  <div key={item.label} className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-black/15 px-3 py-2.5">
                    <span
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black ${item.done ? "bg-emerald-400/20 text-emerald-200" : "bg-slate-600/40 text-slate-300"}`}
                      aria-label={item.done ? "Completed" : `Step ${index + 1}`}
                    >
                      {item.done ? <Check className="h-4 w-4" /> : index + 1}
                    </span>
                    <span className="text-sm font-bold text-slate-200">{item.label}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Row 2 — Action cards */}
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {actionCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link key={card.title} href={card.href} className="group rounded-[22px] border border-white/10 bg-[#0b1527] p-5 transition hover:border-blue-300/30 hover:bg-[#0d192e]">
                  <div className={`grid h-11 w-11 place-items-center rounded-xl border ${toneClasses(card.tone)}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-black tracking-[-0.02em]">{card.title}</h3>
                  <p className="mt-2 min-h-[40px] text-sm leading-6 text-slate-300">{card.detail}</p>
                  <div className="mt-4 inline-flex items-center gap-2 text-sm font-black text-blue-300">
                    {card.cta} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Row 3 — Recent interview + Recruiter insights */}
          <div className="mt-6 grid items-start gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-[22px] border border-white/10 bg-[#0b1527] p-5">
              <h2 className="text-lg font-black">Recent interview</h2>
              <div className="mt-4 rounded-2xl border border-white/8 bg-black/15 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-4">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5"><Mic className="h-4 w-4 text-blue-200" /></div>
                    <div>
                      <h3 className="font-black">Data Analyst · Product</h3>
                      <p className="mt-1 text-sm text-slate-400">Practice session · 12 minutes</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-blue-500/20 px-3 py-1 text-sm font-black text-blue-200">72%</span>
                </div>
                <Link href="/results" className="mt-4 inline-flex items-center gap-2 text-sm font-black text-blue-300">View result <ArrowRight className="h-4 w-4" /></Link>
              </div>
            </section>

            <section className="rounded-[22px] border border-white/10 bg-[#0b1527] p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black">Recruiter insights</h2>
                <Link href="/results" className="rounded-lg px-2 py-1 text-sm font-black text-blue-300 hover:bg-white/[0.04]">View all</Link>
              </div>
              <div className="mt-4 grid gap-3">
                {insights.map((item) => (
                  <div key={item.title} className="rounded-2xl border border-white/8 bg-black/15 p-4">
                    <div className="flex gap-3">
                      <span className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${item.color}`} />
                      <div>
                        <h3 className="font-black">{item.title}</h3>
                        <p className="mt-1.5 text-sm leading-6 text-slate-300">{item.detail}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Row 4 — Performance trend + Activity summary + Quick links */}
          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            <section className="rounded-[22px] border border-white/10 bg-[#0b1527] p-5">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-black">Performance trend</h2>
                <span className="rounded-full border border-white/10 px-4 py-1.5 text-xs font-black text-slate-300">This month</span>
              </div>
              <div className="mt-4"><MiniTrendChart /></div>
              <p className="mt-3 flex items-center gap-2 text-sm text-slate-300"><TrendingUp className="h-4 w-4 text-blue-300" /> Interview clarity improved by 40 points across recent practice.</p>
            </section>

            <section className="rounded-[22px] border border-white/10 bg-[#0b1527] p-5">
              <h2 className="text-lg font-black">Activity summary</h2>
              <div className="mt-5 divide-y divide-white/10 text-sm">
                {[
                  ["Interviews practiced", "8"],
                  ["Avg. score", "68%"],
                  ["Strongest skill", "Communication"],
                  ["Focus area", "Technical depth"],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between py-3">
                    <span className="text-slate-300">{label}</span>
                    <span className="font-black text-white">{value}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[22px] border border-white/10 bg-[#0b1527] p-5">
              <h2 className="text-lg font-black">Quick links</h2>
              <div className="mt-4 divide-y divide-white/10">
                {quickLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.label} href={item.href} className="flex items-center justify-between py-3 text-sm text-slate-200 hover:text-white">
                      <span className="flex items-center gap-3"><Icon className="h-4 w-4 text-slate-400" /> {item.label}</span>
                      <ArrowRight className="h-4 w-4 text-slate-500" />
                    </Link>
                  );
                })}
              </div>
            </section>
          </div>

          <footer className="mt-10 flex flex-col gap-3 pb-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>© 2026 WorkZo AI. All rights reserved.</span>
            <div className="flex gap-6"><span>Privacy Policy</span><span>Terms of Service</span><span>Contact</span></div>
          </footer>
        </section>
      </div>
    </main>
  );
}
