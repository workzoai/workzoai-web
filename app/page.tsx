"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  FileText,
  Mic,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  UserRound,
  Zap,
} from "lucide-react";
import WorkZoFooter from "@/components/WorkZoFooter";
import AuthNavButton from "@/components/auth/AuthNavButton";
import { getWorkZoDisplayPrices } from "@/lib/workzoLocalizedPricing";

const trustItems = [
  "CV + job based practice",
  "Dynamic recruiter follow-ups",
  "Trust timeline + weakest answer",
];

const quickFeatures = [
  { title: "Real Recruiter AI", text: "Follow-up questions based on your answers.", icon: Mic },
  { title: "CV + Job Aware", text: "Practice for the exact role you want.", icon: FileText },
  { title: "Live Copilot", text: "Know what to say next during practice.", icon: Zap },
  { title: "Recruiter Feedback", text: "See score, trust, verdict, and weak answers.", icon: BarChart3 },
];

// Module-level constant — not recreated on every TrustTimeline render
const FIXED_TRUST_PTS = [[0,42],[20,36],[40,39],[60,28],[80,23],[110,26]];

const TRUST_STAGES = [
  { score: 74, delta: "+26 pts", lastY: 20, color: "text-emerald-300", badge: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" },
  { score: 71, delta: "+23 pts", lastY: 22, color: "text-emerald-300", badge: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" },
  { score: 79, delta: "+31 pts", lastY: 15, color: "text-emerald-300", badge: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" },
  { score: 76, delta: "+28 pts", lastY: 18, color: "text-emerald-300", badge: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" },
];

function TrustTimeline() {
  const [idx, setIdx] = useState(0);
  // Unique IDs per instance — safe if TrustTimeline ever renders more than once
  const uid = useId().replace(/:/g, "");
  const fillId = `tFill${uid}`;
  const strokeId = `tStroke${uid}`;
  const stage = TRUST_STAGES[idx];
  const allPts = [...FIXED_TRUST_PTS, [140, stage.lastY]];
  const polyPts = allPts.map(([x,y]) => `${x},${y}`).join(" ");
  const fillPath = `M0,42 L20,36 L40,39 L60,28 L80,23 L110,26 L140,${stage.lastY} L140,64 L0,64 Z`;

  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % TRUST_STAGES.length), 2500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.10] bg-black/30 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
        <p className="text-sm font-black">Trust Timeline</p>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black transition-all duration-500 ${stage.badge}`}>
          ↑ {stage.delta}
        </span>
      </div>
      <div className="p-4">
        <div className="mb-3 flex items-end gap-2">
          <p className={`text-3xl font-black leading-none transition-all duration-500 ${stage.color}`}>
            {stage.score}
          </p>
          <p className="mb-0.5 text-xs text-white/40">/ 100 trust score</p>
        </div>
        <svg viewBox="0 0 140 64" className="w-full" preserveAspectRatio="none" style={{ height: "64px" }}>
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(52,211,153,0.22)" />
              <stop offset="100%" stopColor="rgba(96,165,250,0.02)" />
            </linearGradient>
            <linearGradient id={strokeId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(96,165,250,0.7)" />
              <stop offset="100%" stopColor="rgba(52,211,153,0.95)" />
            </linearGradient>
          </defs>
          <path d={fillPath} fill={`url(#${fillId})`} />
          <polyline points={polyPts} fill="none" stroke={`url(#${strokeId})`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {allPts.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="2.5" fill="rgba(147,197,253,0.75)" />
          ))}
          {/* Live end dot */}
          <circle cx="140" cy={stage.lastY} r="4" fill="rgb(52,211,153)" className="transition-all duration-500" />
          <circle cx="140" cy={stage.lastY} r="8" fill="rgba(52,211,153,0.18)" className="transition-all duration-500" />
        </svg>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-[10px] text-white/30">Q1</p>
          <p className="text-[10px] text-white/30">Q7</p>
        </div>
      </div>
    </div>
  );
}

function PlatformBento() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">

        {/* ── Card 1: Interview Room — large, 2 cols × 2 rows ── */}
        <div className="overflow-hidden rounded-2xl border border-blue-400/[0.22] bg-black/30 shadow-[0_0_40px_rgba(59,130,246,0.07)] backdrop-blur-sm md:col-span-2 md:row-span-2">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 ring-1 ring-white/20">
                <UserRound className="h-4 w-4 text-white/70" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Live interview</p>
                <p className="text-sm font-black">Sarah · Hiring Manager</p>
              </div>
            </div>
            <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-black text-emerald-200">Interested</span>
          </div>
          {/* Body */}
          <div className="grid gap-3 p-4 sm:grid-cols-[180px_1fr]">
            {/* Recruiter video tile — tall, dominant */}
            <div className="relative h-64 overflow-hidden rounded-xl ring-1 ring-blue-400/20 sm:h-full sm:min-h-[260px]">
              <div className="absolute inset-0 bg-[linear-gradient(175deg,#0d1e3a,#071020_55%,#040810)]" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_100%_at_50%_50%,transparent_48%,rgba(0,0,0,0.5)_100%)]" />
              <Image src="/hero-interviewer.png" alt="Sarah Mitchell" fill className="object-cover object-top" sizes="180px" />
              {/* Speaking indicator */}
              <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/50 px-2 py-1 backdrop-blur-sm">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                </span>
                <span className="text-[9px] font-black tracking-widest text-white/70">LIVE</span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent px-3 pb-3 pt-10">
                <p className="text-sm font-black text-white">Sarah Mitchell</p>
                <p className="text-[10px] text-white/50">Senior Hiring Manager</p>
              </div>
            </div>
            {/* Right panels */}
            <div className="space-y-2.5">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.05] p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">Current question</p>
                <p className="mt-1.5 text-sm leading-5 text-white/90">Tell me about a customer situation where you influenced the outcome.</p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.05] p-3">
                  <p className="text-[11px] text-white/40">Trust</p>
                  <p className="mt-1 text-2xl font-black text-white">74</p>
                </div>
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.05] p-3">
                  <p className="text-[11px] text-white/40">Progress</p>
                  <p className="mt-1 text-2xl font-black text-emerald-300">7/12</p>
                </div>
              </div>
              <div className="rounded-xl border border-amber-300/20 bg-amber-400/[0.07] p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">Recruiter note</p>
                <p className="mt-1.5 text-xs leading-4 text-white/80">Needs stronger metrics and clearer ownership.</p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.05] p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">Live Copilot</p>
                <p className="mt-1.5 text-xs leading-4 text-white/80">Anchor your answer with a result the recruiter can verify.</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Card 2: Live Transcript ── */}
        <div className="overflow-hidden rounded-2xl border border-white/[0.10] bg-black/30 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
            <p className="text-sm font-black">Live Transcript</p>
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
          </div>
          <div className="space-y-3 p-3">
            {[
              { role: "Sarah", color: "text-violet-300", msg: "Tell me about a difficult stakeholder you managed." },
              { role: "You", color: "text-blue-300", msg: "In my last role I worked with a VP whose priorities conflicted with our team goals..." },
              { role: "Sarah", color: "text-violet-300", msg: "What was the measurable outcome?" },
            ].map((item, i) => (
              <div key={i}>
                <p className={`text-[11px] font-black ${item.color}`}>{item.role}</p>
                <p className="mt-0.5 text-xs leading-4 text-white/65">{item.msg}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Card 3: Trust Timeline — live ── */}
        <TrustTimeline />

        {/* ── Card 4: Progress Dashboard ── */}
        <div className="overflow-hidden rounded-2xl border border-white/[0.10] bg-black/30 backdrop-blur-sm">
          <div className="border-b border-white/[0.08] px-4 py-3">
            <p className="text-sm font-black">Your Progress</p>
          </div>
          <div className="space-y-2.5 p-4">
            {[["Sessions", "12"], ["Avg Score", "71"], ["Best Score", "84"], ["Streak", "3 days"]].map(([label, val]) => (
              <div key={label} className="flex items-center justify-between">
                <p className="text-xs text-white/50">{label}</p>
                <p className="text-sm font-black text-white">{val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Card 5: Interview Report — 2 cols ── */}
        <div className="overflow-hidden rounded-2xl border border-white/[0.10] bg-black/30 backdrop-blur-sm md:col-span-2">
          <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
            <p className="text-sm font-black">Interview Report</p>
            <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-black text-emerald-200">Engaged</span>
          </div>
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-[7px] border-blue-500/50 bg-blue-500/10">
                <p className="text-lg font-black">74</p>
              </div>
              <div className="flex-1 space-y-2">
                {[["Confidence", 80], ["Clarity", 70], ["Relevance", 78]].map(([l, v]) => (
                  <div key={l as string}>
                    <div className="mb-1 flex justify-between text-[11px]">
                      <span className="text-white/50">{l}</span>
                      <span className="text-white/70">{v}</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-blue-400/60" style={{ width: `${v}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-amber-300/15 bg-amber-400/[0.07] p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">Weakest answer</p>
              <p className="mt-2 text-xs leading-5 text-white/70">Too broad. Add one verified metric and explain your personal action in the outcome.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-black uppercase tracking-[0.20em] text-white/50">{children}</p>;
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.10] bg-black/20 backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="text-sm font-black text-white">{question}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-white/40 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-white/[0.08] px-5 pb-4 pt-3">
          <p className="text-sm leading-6 text-white/60">{answer}</p>
        </div>
      )}
    </div>
  );
}

export default function LandingPage() {
  const localizedPlans = useMemo(() => getWorkZoDisplayPrices("monthly"), []);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let rafId = 0;
    const handleMouseMove = (e: MouseEvent) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (glowRef.current) {
          glowRef.current.style.background = `radial-gradient(700px at ${e.clientX}px ${e.clientY}px, rgba(29, 78, 216, 0.11), transparent 75%)`;
        }
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#020a18] text-white">
      {/* Cursor glow overlay */}
      <div ref={glowRef} className="pointer-events-none fixed inset-0 z-50 transition-[background] duration-200 ease-out" />

      {/* ── Hero ── */}
      <section className="relative isolate overflow-hidden">
        {/* Cinematic glow — deep blue spotlight from above, fades to nothing */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_110%_65%_at_50%_-5%,rgba(37,99,235,0.38)_0%,rgba(14,50,140,0.18)_40%,transparent_70%)]" />
        <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative h-[42px] w-[42px] shrink-0 overflow-hidden rounded-xl">
              <Image src="/workzo_icon.png" alt="WorkZo AI" fill priority className="object-cover" />
            </div>
            <span className="text-xl font-black tracking-tight sm:text-2xl">
              WorkZo <span className="text-white/70">AI</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-semibold text-white/60 md:flex">
            <div className="group relative">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 transition hover:text-white"
              >
                Features
                <ChevronDown className="h-4 w-4" />
              </button>

              <div className="invisible absolute left-0 top-full z-50 mt-4 w-72 translate-y-2 rounded-2xl border border-white/10 bg-[#071120]/95 p-3 opacity-0 shadow-2xl shadow-black/30 backdrop-blur-xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                {[
                  ["Real Interview AI", "/features/interview-practice", "See how recruiter-style practice works."],
                  ["Improve CV", "/features/improve-cv", "View CV optimization details before upgrading."],
                  ["Cover Letter", "/features/cover-letter", "See how tailored letters are generated."],
                  ["Job Assist", "/features/job-assist", "Understand role-preparation tools."],
                  ["Results Report", "/features/results-intelligence", "Preview trust, score, and weak-answer reports."],
                ].map(([title, href, text]) => (
                  <Link
                    key={title}
                    href={href}
                    className="block rounded-xl px-3 py-2.5 transition hover:bg-white/10"
                  >
                    <span className="block text-sm font-black text-white">{title}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-white/50">{text}</span>
                  </Link>
                ))}
              </div>
            </div>

            <a href="#how" className="transition hover:text-white">How it works</a>
            <Link href="/pricing" className="transition hover:text-white">Pricing</Link>

            <div className="group relative">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 transition hover:text-white"
              >
                Resources
                <ChevronDown className="h-4 w-4" />
              </button>

              <div className="invisible absolute left-0 top-full z-50 mt-4 w-72 translate-y-2 rounded-2xl border border-white/10 bg-[#071120]/95 p-3 opacity-0 shadow-2xl shadow-black/30 backdrop-blur-xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                {[
                  ["Resources", "/resources", "Interview, CV, and job-search guides."],
                  ["About", "/about", "Meet Haritha and the WorkZo AI story."],
                  ["FAQ", "/faq", "Answers to common product questions."],
                  ["Help Center", "/help", "Support and troubleshooting basics."],
                  ["Roadmap", "/roadmap", "What is planned next."],
                  ["Changelog", "/changelog", "Latest product updates."],
                  ["Contact", "/contact", "Support, feedback, and partnerships."],
                ].map(([title, href, text]) => (
                  <Link
                    key={title}
                    href={href}
                    className="block rounded-xl px-3 py-2.5 transition hover:bg-white/10"
                  >
                    <span className="block text-sm font-black text-white">{title}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-white/50">{text}</span>
                  </Link>
                ))}
              </div>
            </div>
          </nav>

          <AuthNavButton />
        </header>

        <div className="mx-auto max-w-7xl px-4 pb-20 pt-14 sm:px-6 lg:px-8 lg:pb-24 lg:pt-20">
          <div className="flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.20em] text-white/80 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Real Interview AI
            </div>

            <h1 className="mt-6 max-w-4xl text-4xl font-black leading-[1.02] tracking-tight sm:text-6xl lg:text-[68px]">
              Practice real interviews<br className="hidden sm:block" /> before the real one.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/70 sm:text-xl">
              WorkZo AI rehearses recruiter-style interviews based on your CV and target job, then shows exactly where recruiter trust dropped.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/pricing?intent=interview" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-7 py-4 text-base font-black text-slate-900 shadow-xl shadow-black/20 transition hover:scale-[1.02] hover:bg-blue-50">
                Start Interview
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link href="/demo" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-7 py-4 text-base font-black text-white backdrop-blur transition hover:bg-white/20">
                <PlayCircle className="h-5 w-5 text-white/70" />
                Try Demo
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2">
              {trustItems.map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm font-semibold text-white/60">
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-16 lg:mt-20">
            <PlatformBento />
          </div>
        </div>
      </section>

      {/* ── Trust Bar ── */}
      <section className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              ["66+", "Beta Testers"],
              ["500+", "AI Interviews Practiced"],
              ["10+", "Countries Represented"],
              ["4", "AI Recruiters"],
            ].map(([number, label]) => (
              <div key={label} className="rounded-2xl border border-white/[0.10] bg-black/20 p-6 text-center backdrop-blur-sm">
                <p className="text-4xl font-black text-white">{number}</p>
                <p className="mt-1 text-sm text-white/50">{label}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-white/40">
            Helping candidates prepare smarter before real interviews.
          </p>
        </div>
      </section>

      {/* ── Real Interview Walkthrough ── */}
      <section id="how" className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <div className="text-center">
            <SectionLabel>See it in action</SectionLabel>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
              See How WorkZo Works
            </h2>
            <p className="mt-4 text-lg leading-8 text-white/60">
              A realistic recruiter conversation with live trust analysis.
            </p>
          </div>

          <div className="relative mt-10">
            {/* Vertical connector line */}
            <div className="absolute left-[15px] top-4 h-[calc(100%-2rem)] w-px bg-white/[0.08]" />

            <div className="space-y-4">
              {/* Step 1: Recruiter Question */}
              <div className="relative flex gap-5">
                <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500 ring-4 ring-blue-500/20">
                  <span className="text-[9px] font-black text-white">01</span>
                </div>
                <div className="flex-1 rounded-2xl border border-blue-400/30 bg-blue-500/[0.07] px-4 py-3 backdrop-blur-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-300">Recruiter Question</p>
                  <p className="mt-1.5 text-sm leading-6 text-white/80">
                    Tell me about a difficult customer situation you handled.
                  </p>
                </div>
              </div>

              {/* Step 2: Candidate Answer */}
              <div className="relative flex gap-5">
                <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 ring-4 ring-white/[0.08]">
                  <span className="text-[9px] font-black text-white/80">02</span>
                </div>
                <div className="flex-1 rounded-2xl border border-white/[0.10] bg-black/20 px-4 py-3 backdrop-blur-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/50">Candidate Answer</p>
                  <p className="mt-1.5 text-sm leading-6 text-white/60 italic">
                    &ldquo;I handled many difficult customers and always tried to resolve issues quickly.&rdquo;
                  </p>
                </div>
              </div>

              {/* Step 3: WorkZo Analysis */}
              <div className="relative flex gap-5">
                <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-400 ring-4 ring-emerald-400/20">
                  <span className="text-[9px] font-black text-white">03</span>
                </div>
                <div className="flex-1 overflow-hidden rounded-2xl border border-emerald-400/30 bg-emerald-500/[0.07] backdrop-blur-sm">
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">WorkZo Analysis</p>
                    <span className="shrink-0 rounded-full border border-red-400/30 bg-red-500/15 px-2.5 py-0.5 text-[11px] font-black text-red-300">
                      Trust −18%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-white/[0.06] border-t border-white/[0.06]">
                    <div className="px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-red-300/80">Why it dropped</p>
                      <p className="mt-1 text-xs leading-5 text-white/60">No evidence, no ownership, too generic</p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300">Fix</p>
                      <p className="mt-1 text-xs leading-5 text-white/60">Use STAR · add metrics · show ownership</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why Good Candidates Get Rejected ── */}
      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <SectionLabel>The problem</SectionLabel>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
            Why Good Candidates Still Get Rejected
          </h2>
          <p className="mt-4 text-lg leading-8 text-white/60">
            Most candidates are rejected for communication problems, not technical ability.
          </p>
        </div>

        <div className="mx-auto mt-8 grid max-w-7xl gap-5 md:grid-cols-2">
          {[
            {
              title: "No Evidence",
              candidate: "I improved customer satisfaction.",
              recruiter: "By how much?",
            },
            {
              title: "Weak Ownership",
              candidate: "We worked on it.",
              recruiter: "What exactly did YOU do?",
            },
            {
              title: "Generic Answers",
              candidate: "I am hardworking.",
              recruiter: "Everyone says that.",
            },
            {
              title: "No Structure",
              candidate: "Candidate rambles.",
              recruiter: "Recruiter loses confidence.",
            },
          ].map((card) => (
            <div key={card.title} className="rounded-3xl border border-white/[0.10] bg-black/20 p-6 backdrop-blur-sm">
              <p className="mb-4 text-sm font-black uppercase tracking-[0.18em] text-white/40">{card.title}</p>
              <div className="space-y-3">
                <div className="rounded-xl bg-white/[0.05] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">Candidate</p>
                  <p className="mt-1 text-sm leading-5 text-white/70">&ldquo;{card.candidate}&rdquo;</p>
                </div>
                <div className="rounded-xl border border-red-400/20 bg-red-500/[0.07] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-red-300">Recruiter</p>
                  <p className="mt-1 text-sm leading-5 text-white/70">{card.recruiter}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-xl text-center text-sm leading-7 text-white/50">
          WorkZo catches these mistakes before the real interview.
        </p>
      </section>

      {/* ── Results Preview ── */}
      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <SectionLabel>Your report</SectionLabel>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
            See What Happens After Every Interview
          </h2>
          <p className="mt-4 text-lg leading-8 text-white/60">
            WorkZo shows exactly where recruiter confidence increased or dropped.
          </p>
        </div>

        <div className="mx-auto mt-8 max-w-7xl">
          <div className="overflow-hidden rounded-3xl border border-blue-400/[0.22] bg-black/30 shadow-[0_0_60px_rgba(59,130,246,0.08)] backdrop-blur-sm">
            {/* Card header */}
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3.5">
              <p className="text-sm font-black">Interview Report</p>
              <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-black text-emerald-200">
                Engaged
              </span>
            </div>

            {/* Card body */}
            <div className="grid gap-5 p-5 md:grid-cols-2">
              {/* Left — Trust Score + Timeline */}
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full border-[8px] border-blue-500/50 bg-blue-500/10">
                    <p className="text-4xl font-black">71</p>
                  </div>
                  <div>
                    <p className="text-sm font-black text-white">Recruiter Trust Score</p>
                    <p className="mt-0.5 text-xs text-white/40">/ 100</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-white/40">
                    Trust Timeline
                  </p>
                  <div className="space-y-2.5">
                    {[
                      { q: "Q1", v: 92, color: "bg-blue-400/60", drop: false },
                      { q: "Q2", v: 84, color: "bg-blue-400/60", drop: false },
                      { q: "Q3", v: 61, color: "bg-amber-400/60", drop: true },
                      { q: "Q4", v: 58, color: "bg-red-400/60", drop: true },
                      { q: "Q5", v: 74, color: "bg-blue-400/60", drop: false },
                    ].map(({ q, v, color, drop }) => (
                      <div key={q} className="flex items-center gap-3">
                        <p className="w-5 shrink-0 text-[11px] text-white/40">{q}</p>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                          <div className={`h-full rounded-full ${color}`} style={{ width: `${v}%` }} />
                        </div>
                        <div className="flex w-14 items-center justify-end gap-1">
                          <p className={`text-[11px] font-black ${drop ? "text-red-300" : "text-white/60"}`}>{v}%</p>
                          {drop && <span className="text-[10px] text-red-300">↓</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right — Weakest Answer, Recruiter Thoughts, Improvement Plan */}
              <div className="space-y-4">
                <div className="rounded-2xl border border-amber-300/20 bg-amber-400/[0.07] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">
                    Weakest Answer
                  </p>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    You described responsibilities but gave no measurable proof.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/40">
                    Recruiter Thoughts
                  </p>
                  <p className="text-sm text-white/70">Candidate sounds experienced.</p>
                  <p className="mt-1 text-sm text-white/50">Evidence is missing.</p>
                </div>

                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] p-4">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300">
                    Improvement Plan
                  </p>
                  <ul className="space-y-1.5">
                    {["Add measurable outcomes", "Demonstrate ownership", "Use STAR structure"].map((item) => (
                      <li key={item} className="flex items-center gap-2 text-xs text-white/70">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/70" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/pricing?intent=interview"
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-4 text-base font-black text-slate-900 shadow-xl shadow-black/20 transition hover:scale-[1.02] hover:bg-blue-50"
            >
              Start Your Interview
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Why WorkZo ── */}
      <section id="features" className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <SectionLabel>Why WorkZo</SectionLabel>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">More than interview questions.</h2>
          <p className="mt-4 text-lg leading-8 text-white/60">
            WorkZo focuses on recruiter realism: follow-ups, proof, ownership, metrics, and confidence under pressure.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-7xl gap-5 md:grid-cols-4">
          {quickFeatures.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.title} className="rounded-3xl border border-white/[0.10] bg-black/20 p-6 backdrop-blur-sm transition hover:-translate-y-1 hover:bg-black/30">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-white ring-1 ring-white/20">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-black">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/60">{card.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Why WorkZo Is Different ── */}
      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <SectionLabel>The difference</SectionLabel>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
            Built For Real Interviews
          </h2>
        </div>

        <div className="mx-auto mt-8 max-w-4xl overflow-hidden rounded-3xl border border-white/[0.10] bg-black/20 backdrop-blur-sm">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_110px_120px] border-b border-white/[0.08] bg-white/[0.04] px-5 py-3.5">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Feature</p>
            <p className="text-center text-[11px] font-black uppercase tracking-[0.18em] text-blue-300">WorkZo AI</p>
            <p className="text-center text-[11px] font-black uppercase tracking-[0.18em] text-white/30">Typical Apps</p>
          </div>

          {[
            ["CV-Aware Interviews", "YES", "LIMITED"],
            ["Job Description Awareness", "YES", "LIMITED"],
            ["Recruiter Trust Analysis", "YES", "NO"],
            ["Dynamic Follow-Ups", "YES", "LIMITED"],
            ["Weakest Answer Detection", "YES", "NO"],
            ["Recruiter Personalities", "YES", "NO"],
            ["Trust Timeline", "YES", "NO"],
            ["Improvement Plan", "DETAILED", "BASIC"],
          ].map(([feature, workzo, typical], i) => (
            <div
              key={feature}
              className={`grid grid-cols-[1fr_110px_120px] items-center border-b border-white/[0.05] px-5 py-3.5 last:border-0 ${i % 2 === 1 ? "bg-white/[0.02]" : ""}`}
            >
              <p className="text-sm text-white/80">{feature}</p>
              <div className="flex items-center justify-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <p className="text-sm font-black text-emerald-300">{workzo}</p>
              </div>
              <p className={`text-center text-sm font-black ${typical === "NO" ? "text-red-300/70" : typical === "BASIC" ? "text-amber-300/60" : "text-amber-300/60"}`}>
                {typical}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <SectionLabel>Pricing</SectionLabel>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
              Start free. Upgrade when you need deeper support.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-300">
              Free lets you try the interview engine. Premium unlocks complete preparation. Premium Pro adds AI Career Coach and Live AI Recruiter minutes.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            <div className="flex flex-col rounded-[2rem] border border-emerald-300/20 bg-emerald-400/[0.06] p-7 backdrop-blur-sm">
              <p className="text-sm font-black uppercase tracking-[0.20em] text-emerald-300">Free</p>
              <h3 className="mt-3 text-2xl font-black">Try WorkZo AI</h3>
              <p className="mt-4 text-5xl font-black">{localizedPlans.free.amount}</p>
              <p className="mt-3 min-h-[48px] text-sm leading-6 text-white/60">
                Try realistic voice interview practice before upgrading.
              </p>
              <ul className="mt-5 space-y-2.5">
                {[
                  "2 Voice AI Interviews / month",
                  "Recruiter intelligence trial",
                  "Realistic follow-up questions",
                  "Basic interview report",
                  "Limited interview history",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-white/80">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />{item}
                  </li>
                ))}
              </ul>
              <Link href="/pricing?intent=interview" className="mt-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-black text-slate-900 shadow-lg transition hover:scale-[1.02] hover:bg-blue-50">
                Start Free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="relative flex flex-col rounded-[2rem] border border-blue-300/25 bg-blue-500/[0.10] p-7 shadow-2xl shadow-blue-950/20 backdrop-blur-sm">
              <div className="absolute right-5 top-5 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-200">
                Most Popular
              </div>
              <p className="text-sm font-black uppercase tracking-[0.20em] text-blue-200">Premium</p>
              <h3 className="mt-3 pr-24 text-2xl font-black text-white">Complete Preparation</h3>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <span className="text-lg font-black text-white/40 line-through decoration-2">{localizedPlans.premium.regular}</span>
                <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-emerald-200">Launch offer</span>
              </div>
              <p className="mt-2 text-5xl font-black">
                {localizedPlans.premium.amount}<span className="text-xl text-white/50">/month</span>
              </p>
              <p className="mt-3 min-h-[48px] text-sm leading-6 text-white/60">
                50 voice interviews, CV improvement, cover letters, Job Assist, Career Brain, and advanced reports.
              </p>
              <ul className="mt-5 space-y-2.5">
                {[
                  "50 Voice AI Interviews / month",
                  "Advanced recruiter intelligence",
                  "CV Improvement + ATS Optimization",
                  "Cover Letter Generator",
                  "Job Assist",
                  "Career Brain + performance tracking",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-white/80">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-blue-200" />{item}
                  </li>
                ))}
              </ul>
              <Link href="/pricing?plan=premium" className="mt-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-500 px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:scale-[1.02] hover:bg-blue-400">
                Choose Premium
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="relative flex flex-col rounded-[2rem] border border-violet-300/25 bg-violet-500/[0.10] p-7 shadow-2xl shadow-violet-950/20 backdrop-blur-sm">
              <div className="absolute right-5 top-5 rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-violet-100">
                Best Experience
              </div>
              <p className="text-sm font-black uppercase tracking-[0.20em] text-violet-200">Premium Pro</p>
              <h3 className="mt-3 pr-24 text-2xl font-black text-white">AI Career Coach + Live Recruiter</h3>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <span className="text-lg font-black text-white/40 line-through decoration-2">{localizedPlans.premiumPro.regular}</span>
                <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-emerald-200">Launch offer</span>
              </div>
              <p className="mt-2 text-5xl font-black">
                {localizedPlans.premiumPro.amount}<span className="text-xl text-white/50">/month</span>
              </p>
              <p className="mt-3 min-h-[48px] text-sm leading-6 text-white/60">
                Full career support with unlimited voice interviews and 60 Live AI Recruiter minutes per month.
              </p>
              <ul className="mt-5 space-y-2.5">
                {[
                  "Everything in Premium",
                  "Unlimited Voice AI Interviews",
                  "60 Live AI Recruiter Minutes / month",
                  "Live AI Video Recruiter",
                  "Premium recruiter personas",
                  "AI Career Coach + roadmaps",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-white/80">
                    <Sparkles className="h-4 w-4 shrink-0 text-violet-200" />{item}
                  </li>
                ))}
              </ul>
              <Link href="/pricing?plan=premium_pro" className="mt-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-500 px-6 py-3 text-sm font-black text-white shadow-lg shadow-violet-500/20 transition hover:scale-[1.02] hover:bg-violet-400">
                Choose Premium Pro
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 text-center">
            <SectionLabel>FAQ</SectionLabel>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
              Common Questions
            </h2>
          </div>
          <div className="space-y-2">
            {[
              ["Is WorkZo just a question bank?", "No. WorkZo is a dynamic AI recruiter that reacts to exactly what you say — follow-up questions, pressure, and trust scores change based on your answers."],
              ["How realistic are the AI recruiters?", "Each recruiter has a distinct personality based on real hiring patterns — they push for evidence, ownership, and specifics just like real interviewers do."],
              ["What does the trust score measure?", "Recruiter confidence in your answers across the full interview, updated question by question. A drop means the recruiter needed more proof or specifics."],
              ["Can I use my actual CV?", "Yes. Paste or upload your resume and WorkZo tailors every question to your real background and the target role."],
              ["What is in a full interview report?", "Trust timeline per question, weakest answer, recruiter thoughts on your performance, and a detailed improvement plan."],
              ["Which languages are supported?", "English. More languages are on the roadmap."],
            ].map(([question, answer]) => (
              <FaqItem key={question} question={question} answer={answer} />
            ))}
          </div>
        </div>
      </section>

      <WorkZoFooter />
    </main>
  );
}
