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
  FileText,
  Home,
  Mail,
  Menu,
  Mic,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: Home },
  { label: "Improve CV", href: "/pricing?intent=upgrade", icon: FileText },
  { label: "Cover Letter", href: "/pricing?intent=upgrade", icon: Mail },
  { label: "Find Jobs", href: "/pricing?intent=upgrade", icon: Briefcase },
  { label: "Real Interview AI", href: "/interview", icon: Mic },
  { label: "Results", href: "/results", icon: BarChart3 },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

const actionCards = [
  {
    title: "Improve CV",
    detail: "ATS score: 85 · 3 fixes available",
    href: "/pricing?intent=upgrade",
    icon: FileText,
    tone: "emerald",
    cta: "Review CV",
  },
  {
    title: "Cover Letter",
    detail: "Create a focused letter from CV + job context",
    href: "/pricing?intent=upgrade",
    icon: Mail,
    tone: "violet",
    cta: "Create letter",
  },
  {
    title: "Find Jobs",
    detail: "12 matching roles prepared from your profile",
    href: "/pricing?intent=upgrade",
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
    tag: "Strength",
    tagColor: "bg-emerald-400/15 text-emerald-300",
    title: "Support experience is your strongest signal",
    detail: "Use customer-facing stories when answering Sales, Success, or Analyst role questions.",
  },
  {
    tag: "Improve",
    tagColor: "bg-yellow-400/15 text-yellow-300",
    title: "Add measurable impact",
    detail: "Recruiters need numbers, scale, time saved, quality improved, or customer outcome.",
  },
  {
    tag: "Action",
    tagColor: "bg-blue-400/15 text-blue-300",
    title: "Prepare one ownership story",
    detail: "Choose one example with pressure, your action, and the final result.",
  },
];


function toneClasses(tone: string) {
  if (tone === "emerald") return "bg-emerald-400/10 text-emerald-300 border-emerald-400/20";
  if (tone === "violet") return "bg-violet-400/10 text-violet-300 border-violet-400/20";
  return "bg-blue-400/10 text-blue-300 border-blue-400/20";
}

function toneAccent(tone: string) {
  if (tone === "emerald") return "bg-gradient-to-r from-emerald-500/40 via-emerald-400/20 to-transparent";
  if (tone === "violet") return "bg-gradient-to-r from-violet-500/40 via-violet-400/20 to-transparent";
  return "bg-gradient-to-r from-blue-500/40 via-blue-400/20 to-transparent";
}

function toneGlow(tone: string) {
  if (tone === "emerald") return "hover:shadow-[0_8px_32px_rgba(52,211,153,0.08)]";
  if (tone === "violet") return "hover:shadow-[0_8px_32px_rgba(167,139,250,0.08)]";
  return "hover:shadow-[0_8px_32px_rgba(96,165,250,0.08)]";
}

const RING_R = 30;
const RING_CIRC = 2 * Math.PI * RING_R;

function ProgressRing({ pct }: { pct: number }) {
  const filled = (pct / 100) * RING_CIRC;
  return (
    <div className="relative h-[76px] w-[76px] shrink-0" role="img" aria-label={`${pct}% of journey complete`}>
      <svg viewBox="0 0 76 76" className="h-[76px] w-[76px] -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(59,130,246)" />
            <stop offset="100%" stopColor="rgb(34,211,238)" />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx="38" cy="38" r={RING_R}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="5"
        />
        {/* Progress arc — gradient + glow */}
        <circle
          cx="38" cy="38" r={RING_R}
          fill="none"
          stroke="url(#ring-gradient)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${filled.toFixed(1)} ${RING_CIRC.toFixed(1)}`}
          style={{ filter: "drop-shadow(0 0 6px rgba(59,130,246,0.65))" }}
        />
      </svg>
      {/* Centre label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span className="text-base font-black leading-none tracking-tight">{pct}%</span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">done</span>
      </div>
    </div>
  );
}

function MiniTrendChart() {
  const data = [
    { week: "W1", score: 45 },
    { week: "W2", score: 60 },
    { week: "W3", score: 72 },
    { week: "W4", score: 85 },
  ];

  const W = 360, H = 148;
  const padL = 28, padR = 20, padT = 30, padB = 30;
  const cW = W - padL - padR;
  const cH = H - padT - padB;

  const coords = data.map((d, i) => ({
    x: padL + (i / (data.length - 1)) * cW,
    y: padT + cH - (d.score / 100) * cH,
    ...d,
  }));

  // Smooth cubic bezier: midpoint control points
  const linePath = coords.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x},${pt.y}`;
    const prev = coords[i - 1];
    const mx = (prev.x + pt.x) / 2;
    return `${acc} C ${mx},${prev.y} ${mx},${pt.y} ${pt.x},${pt.y}`;
  }, "");

  const baseY = padT + cH;
  const areaPath = `${linePath} L ${coords[coords.length - 1].x},${baseY} L ${coords[0].x},${baseY} Z`;

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: H }}
        role="img"
        aria-label={`Score trend: ${data.map(d => `${d.week} ${d.score}`).join(", ")}`}
      >
        <defs>
          <linearGradient id="line-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(59,130,246)" />
            <stop offset="100%" stopColor="rgb(34,211,238)" />
          </linearGradient>
          <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(59,130,246)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="rgb(59,130,246)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Dashed grid lines */}
        {[0.25, 0.5, 0.75].map((t) => {
          const y = padT + cH * (1 - t);
          return (
            <line
              key={t}
              x1={padL} y1={y} x2={W - padR} y2={y}
              stroke="rgba(148,163,184,0.1)"
              strokeWidth="1"
              strokeDasharray="4 5"
            />
          );
        })}

        {/* Area fill */}
        <path d={areaPath} fill="url(#area-grad)" />

        {/* Smooth line with glow */}
        <path
          d={linePath}
          fill="none"
          stroke="url(#line-grad)"
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ filter: "drop-shadow(0 0 5px rgba(59,130,246,0.55))" }}
        />

        {/* Dots + labels */}
        {coords.map((pt) => (
          <g key={pt.week}>
            {/* Glow halo */}
            <circle cx={pt.x} cy={pt.y} r="7" fill="rgba(59,130,246,0.12)" />
            {/* Dot */}
            <circle cx={pt.x} cy={pt.y} r="3.5" fill="#0d1829" stroke="rgb(96,165,250)" strokeWidth="2" />
            {/* Score label */}
            <text
              x={pt.x} y={pt.y - 13}
              textAnchor="middle"
              fill="rgb(147,197,253)"
              fontSize="12"
              fontWeight="800"
            >
              {pt.score}
            </text>
            {/* Week label */}
            <text
              x={pt.x} y={H - 8}
              textAnchor="middle"
              fill="rgb(100,116,139)"
              fontSize="11"
              fontWeight="600"
            >
              {pt.week}
            </text>
          </g>
        ))}
      </svg>

      <div className="mt-1 flex items-center justify-center gap-2 text-xs font-semibold text-slate-500">
        <span className="h-0.5 w-6 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" />
        Overall score
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
        <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.045] p-3">
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
            <div className="truncate text-xs font-black">Candidate</div>
            <div className="truncate text-[10px] text-slate-400">WorkZo AI User</div>
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

  const journeyDone = journeyItems.filter((s) => s.done).length;
  const journeyPct = Math.round((journeyDone / journeyItems.length) * 100);

  return (
    <main className="min-h-screen bg-[#050b14] text-white">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-sm focus:font-black focus:text-white"
      >
        Skip to main content
      </a>

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
        <section id="main-content" className="w-full px-5 pt-20 pb-7 lg:ml-[248px] lg:px-10 lg:pt-7 xl:px-14">

          {/* Header — eyebrow removed, h1 is the anchor */}
          <header className="flex flex-col gap-5 border-b border-white/10 pb-7 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.42em] text-cyan-200">Career Workspace</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">Welcome back! 👋</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Your focused workspace for interview practice, CV improvement, and job preparation.</p>
            </div>
            <div className="flex shrink-0 items-center xl:mt-1">
              <Link
                href="/onboarding"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[0.035] px-6 text-sm font-black transition hover:bg-white/[0.06]"
              >
                <RefreshCw className="h-4 w-4" /> Update CV
              </Link>
            </div>
          </header>
            <div className="mt-5 rounded-[1.5rem] border border-blue-300/20 bg-blue-500/10 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-200">Free plan active</p>
                  <h2 className="mt-2 text-xl font-black text-white">Upgrade to unlock Premium tools</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-300">
                    Premium unlocks AI Video Recruiter, full interview history, advanced reports, Improve CV, Cover Letter, and Job Assist.
                  </p>
                </div>
                <Link
                  href="/pricing?intent=upgrade"
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-blue-500 px-5 py-3 text-sm font-black text-white hover:bg-blue-400"
                >
                  Upgrade
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>


          {/* Row 1 — Hero CTA + Journey */}
          <div className="mt-8 grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
            <section className="rounded-2xl border border-blue-300/15 bg-gradient-to-br from-blue-500/[0.13] via-[#0b1527] to-[#0a1020] p-7">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-cyan-100">
                    Next Best Action
                  </div>
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

            {/* Journey — real SVG ring + clear path to step 4 */}
            <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-[#0b1527] p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-200">Journey</p>
                  <h2 className="mt-1.5 text-2xl font-black">{journeyPct}% ready</h2>
                  <p className="mt-0.5 text-xs text-slate-500">{journeyDone} of {journeyItems.length} steps done</p>
                </div>
                <ProgressRing pct={journeyPct} />
              </div>
              <ol className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1" aria-label="Journey steps">
                {journeyItems.map((item, index) => (
                  <li
                    key={item.label}
                    className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 ${
                      item.done ? "border-white/8 bg-black/15" : "border-blue-400/20 bg-blue-500/[0.07]"
                    }`}
                  >
                    <span
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black ${
                        item.done ? "bg-emerald-400/20 text-emerald-200" : "bg-blue-500/20 text-blue-300"
                      }`}
                      aria-label={item.done ? "Completed" : `Step ${index + 1} — incomplete`}
                    >
                      {item.done ? <Check className="h-4 w-4" /> : index + 1}
                    </span>
                    <span className="flex-1 text-sm font-bold text-slate-200">{item.label}</span>
                    {!item.done && (
                      <Link href="/interview" className="text-[11px] font-black text-blue-300 hover:text-blue-200">
                        Start →
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
              {/* Clear path to 100% */}
              <Link
                href="/interview"
                className="mt-4 flex items-center justify-between rounded-xl bg-blue-500/10 px-4 py-2.5 transition hover:bg-blue-500/15"
              >
                <span className="text-xs font-black text-blue-200">Do an interview to reach 100%</span>
                <ArrowRight className="h-3.5 w-3.5 text-blue-300" />
              </Link>
            </section>
          </div>

          {/* Row 2 — Action cards */}
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {actionCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.title}
                  href={card.href}
                  className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-[#0b1527] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 ${toneGlow(card.tone)}`}
                >
                  {/* Tone accent line at top */}
                  <div className={`absolute inset-x-0 top-0 h-px ${toneAccent(card.tone)}`} />

                  <div className={`grid h-12 w-12 place-items-center rounded-xl border ${toneClasses(card.tone)}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-black tracking-[-0.02em]">{card.title}</h3>
                  <p className="mt-2 min-h-[40px] text-sm leading-6 text-slate-400">{card.detail}</p>
                  <div className="mt-5 flex items-center gap-2 text-sm font-black text-blue-300">
                    {card.cta} <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Row 3 — Recent interview + Recruiter insights */}
          <div className="mt-6 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-[#0b1527] p-5">
              <h2 className="text-lg font-black">Recent interview</h2>
              <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 ring-1 ring-blue-400/20">
                      <Mic className="h-4 w-4 text-blue-300" />
                    </div>
                    <div>
                      <h3 className="font-black">Data Analyst · Product</h3>
                      <p className="mt-1 text-xs text-slate-400">Practice session · 12 min</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-lg bg-blue-500/15 px-2.5 py-1 text-sm font-black text-blue-300 ring-1 ring-blue-400/20">72%</span>
                </div>
                <div className="mt-4 border-t border-white/[0.06] pt-3">
                  <Link href="/results" className="inline-flex items-center gap-1.5 text-sm font-black text-blue-300 hover:text-blue-200">
                    View result <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </section>

            {/* Recruiter insights */}
            <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-[#0b1527] p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black">Recruiter insights</h2>
                <Link href="/results" className="inline-flex min-h-[36px] items-center rounded-lg px-3 py-2 text-sm font-black text-blue-300 hover:bg-white/[0.04]">View all</Link>
              </div>
              <div className="mt-4 grid gap-2.5">
                {insights.map((item) => (
                  <div
                    key={item.title}
                    className={`rounded-xl border border-white/[0.07] bg-white/[0.03] p-4 ${
                      item.tag === "Strength" ? "border-l-2 border-l-emerald-500/40" :
                      item.tag === "Improve"  ? "border-l-2 border-l-yellow-500/40" :
                                                "border-l-2 border-l-blue-500/40"
                    }`}
                  >
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${item.tagColor}`}>
                      {item.tag}
                    </span>
                    <h3 className="mt-2 text-sm font-black leading-snug">{item.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{item.detail}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Row 4 — Performance trend + Activity summary */}
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-[#0b1527] p-5">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-black">Performance trend</h2>
                <span className="text-xs text-slate-500">This month</span>
              </div>
              <div className="mt-4"><MiniTrendChart /></div>
              <p className="mt-3 flex items-center gap-2 rounded-xl bg-blue-500/[0.07] px-3 py-2 text-xs text-slate-300 ring-1 ring-blue-400/10">
                <TrendingUp className="h-3.5 w-3.5 shrink-0 text-blue-300" /> Interview clarity improved by 40 points across recent practice.
              </p>
            </section>

            <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-[#0b1527] p-5">
              <h2 className="text-lg font-black">Activity summary</h2>
              <div className="mt-4 grid gap-2">
                {[
                  { label: "Interviews practiced", value: "8", highlight: false },
                  { label: "Avg. score", value: "68%", highlight: true },
                  { label: "Strongest skill", value: "Communication", highlight: false },
                  { label: "Focus area", value: "Technical depth", highlight: false },
                ].map(({ label, value, highlight }) => (
                  <div key={label} className="flex items-center justify-between rounded-xl px-3 py-2.5 odd:bg-white/[0.025]">
                    <span className="text-sm text-slate-400">{label}</span>
                    <span className={`text-sm font-black ${highlight ? "text-blue-300" : "text-white"}`}>{value}</span>
                  </div>
                ))}
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