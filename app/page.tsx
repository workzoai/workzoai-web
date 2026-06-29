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
  Star,
  UserRound,
  Zap,
} from "lucide-react";
import WorkZoFooter from "@/components/WorkZoFooter";
import AuthNavButton from "@/components/auth/AuthNavButton";
import { getWorkZoDisplayPrices } from "@/lib/workzoLocalizedPricing";

const trustItems = [
  "Reads the CV. Knows the role.",
  "Pressure. Follow-ups. Real feedback.",
  "Used in 10+ countries",
];

const quickFeatures = [
  { title: "Recruiter That Reads Your CV", text: "Questions are built from your actual background. Gaps get probed.", icon: Mic },
  { title: "Role and Market Aware", text: "DACH, US, and UK recruiters behave differently. So does WorkZo.", icon: FileText },
  { title: "Live Copilot", text: "Mid-session guidance on what to say — and what not to.", icon: Zap },
  { title: "Trust Score Timeline", text: "See the exact question where the recruiter's confidence dropped.", icon: BarChart3 },
];

const TESTIMONIALS = [
  {
    quote: "I’d been getting to final rounds and bombing. WorkZo showed me my trust score dropped every time I answered ownership questions. Two sessions later I had a framework — got an offer the following week.",
    name: "Fayaz Ahmed",
    role: "Product Manager",
    location: "London",
    score: 84,
    // Stable AI-generated face via randomuser.me — replace with real photo when available
    avatar: "",
  },
  {
    quote: "The follow-up questions are what got me. I’d give an answer I thought was fine, then Sarah would ask ‘what was the measurable outcome?’ and I’d realise I had nothing. Fixed that in three sessions.",
    name: "Johanna De Vries",
    role: "Senior Data Analyst",
    location: "Amsterdam",
    score: 79,
    avatar: "",
  },
  {
    quote: "Finally, an interview practice tool that feels like talking to a real recruiter. The feedback was actionable, and I felt more prepared after just a few sessions.",
    name: "Eliana Teixeira",
    role: "Data Analyst",
    location: "Portugal",
    score: 87,
    avatar: "/testimonials/eliana-teixeira.jpg",
  },
];

const RECRUITER_PERSONAS = [
  {
    name: "Sarah M.",
    title: "Senior Hiring Manager",
    image: "/recruiters/sarah.png",
    style: "Sceptical · Evidence-driven",
    description: "Pushes hard on proof and ownership. Won't let a vague answer pass — follow-ups like 'What was the measurable outcome?' are her signature.",
    difficulty: 4,
    color: "blue",
    tag: "Standard",
    tagStyle: "border-brand/20 bg-brand/10 text-brand",
    borderStyle: "border-brand/20",
    bgStyle: "bg-brand/[0.06]",
    accentStyle: "text-brand",
  },
  {
    name: "James K.",
    title: "Tech Recruiter",
    image: "/recruiters/markus.png",
    style: "Fast-paced · No-nonsense",
    description: "Moves quickly and wants clean, structured answers. Loses interest fast if you ramble — keep it tight and evidence-backed.",
    difficulty: 3,
    color: "emerald",
    tag: "Standard",
    tagStyle: "border-success/20 bg-success/10 text-success",
    borderStyle: "border-success/20",
    bgStyle: "bg-success/[0.06]",
    accentStyle: "text-success",
  },
  {
    name: "Priya N.",
    title: "Culture & Values Lead",
    image: "/recruiters/priya.png",
    style: "Empathetic · Values-focused",
    description: "Digs deep into motivations, team fit, and soft skills. 'Why this role specifically?' is her favourite — surface-level answers won't satisfy her.",
    difficulty: 3,
    color: "violet",
    tag: "Premium",
    tagStyle: "border-brand/20 bg-brand/10 text-brand",
    borderStyle: "border-brand/20",
    bgStyle: "bg-brand/[0.06]",
    accentStyle: "text-brand",
  },
  {
    name: "Daniel R.",
    title: "Executive Search Partner",
    image: "/recruiters/daniel.png",
    style: "Strategic · High-stakes",
    description: "Senior-level interviews with strategic questions. Expects industry fluency, clear leadership examples, and commercial awareness at every answer.",
    difficulty: 5,
    color: "amber",
    tag: "Premium",
    tagStyle: "border-warning/20 bg-warning/10 text-warning",
    borderStyle: "border-warning/20",
    bgStyle: "bg-warning/[0.06]",
    accentStyle: "text-warning",
  },
];

const COMPARISON_ROWS = [
  ["CV-Aware Interviews", "Reads your actual CV — questions reference your real experience", "Generic role filter only"],
  ["Job Description Awareness", "Probes the exact skills and gaps in the posting you paste", "Role type only, not the specific job"],
  ["Recruiter Trust Analysis", "Live trust score per answer with a timeline showing why it dropped", "Not available"],
  ["Dynamic Follow-Ups", "Recruiter reacts to your specific answer — not a fixed script", "Preset question order"],
  ["Weakest Answer Detection", "Flags your lowest-scoring answer with a specific, actionable fix", "Not available"],
  ["Recruiter Personalities", "4 recruiter personas with distinct styles and pressure levels", "Not available"],
  ["Trust Timeline", "Visual graph of recruiter confidence question by question", "Not available"],
  ["Improvement Plan", "Specific metrics, ownership, and structure fixes tied to your session", "Generic tips"],
];

// Module-level constant — not recreated on every TrustTimeline render
const FIXED_TRUST_PTS = [[0,42],[20,36],[40,39],[60,28],[80,23],[110,26]];

const TRUST_STAGES = [
  { score: 74, delta: "+26 pts", lastY: 20, color: "text-success", badge: "border-success/20 bg-success/10 text-success" },
  { score: 71, delta: "+23 pts", lastY: 22, color: "text-success", badge: "border-success/20 bg-success/10 text-success" },
  { score: 79, delta: "+31 pts", lastY: 15, color: "text-success", badge: "border-success/20 bg-success/10 text-success" },
  { score: 76, delta: "+28 pts", lastY: 18, color: "text-success", badge: "border-success/20 bg-success/10 text-success" },
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
    <div className="overflow-hidden rounded-lg border border-line bg-canvas-soft backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
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
          <p className="mb-0.5 text-xs text-subtle">/ 100 trust score</p>
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
          <p className="text-[10px] text-subtle">Q1</p>
          <p className="text-[10px] text-subtle">Q7</p>
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
        <div className="overflow-hidden rounded-lg border border-brand/[0.22] bg-canvas-soft shadow-[0_0_40px_rgba(59,130,246,0.07)] backdrop-blur-sm md:col-span-2 md:row-span-2">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-fg/10 ring-1 ring-line">
                <UserRound className="h-4 w-4 text-muted" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-subtle">Live interview</p>
                <p className="text-sm font-black">Sarah · Hiring Manager</p>
              </div>
            </div>
            <span className="rounded-full border border-success/20 bg-success/10 px-2.5 py-0.5 text-[11px] font-black text-success">Interested</span>
          </div>
          {/* Body */}
          <div className="grid gap-3 p-4 sm:grid-cols-[180px_1fr]">
            {/* Recruiter video tile — tall, dominant */}
            <div className="relative h-64 overflow-hidden rounded-xl ring-1 ring-brand/20 sm:h-full sm:min-h-[260px]">
              <div className="absolute inset-0 dark:bg-[linear-gradient(175deg,#0d1e3a,#071020_55%,#040810)]" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_100%_at_50%_50%,transparent_48%,rgba(0,0,0,0.5)_100%)]" />
              <Image src="/hero-interviewer.png" alt="Sarah Mitchell" fill className="object-cover object-top" sizes="180px" />
              {/* Speaking indicator */}
              <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full border border-line bg-canvas-soft px-2 py-1 backdrop-blur-sm">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute h-full w-full animate-ping rounded-full bg-danger opacity-75" />
                  <span className="h-1.5 w-1.5 rounded-full bg-danger" />
                </span>
                <span className="text-[9px] font-black tracking-widest text-muted">LIVE</span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent px-3 pb-3 pt-10">
                <p className="text-sm font-black text-fg">Sarah Mitchell</p>
                <p className="text-[10px] text-subtle">Senior Hiring Manager</p>
              </div>
            </div>
            {/* Right panels */}
            <div className="space-y-2.5">
              <div className="rounded-xl border border-line bg-fg/[0.05] p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-subtle">Current question</p>
                <p className="mt-1.5 text-sm leading-5 text-fg">Tell me about a customer situation where you influenced the outcome.</p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-line bg-fg/[0.05] p-3">
                  <p className="text-[11px] text-subtle">Trust</p>
                  <p className="mt-1 text-2xl font-black text-fg">74</p>
                </div>
                <div className="rounded-xl border border-line bg-fg/[0.05] p-3">
                  <p className="text-[11px] text-subtle">Progress</p>
                  <p className="mt-1 text-2xl font-black text-success">7/12</p>
                </div>
              </div>
              <div className="rounded-xl border border-warning/20 bg-warning/[0.07] p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-warning">Recruiter note</p>
                <p className="mt-1.5 text-xs leading-4 text-fg">Needs stronger metrics and clearer ownership.</p>
              </div>
              <div className="rounded-xl border border-line bg-fg/[0.05] p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-subtle">Live Copilot</p>
                <p className="mt-1.5 text-xs leading-4 text-fg">Anchor your answer with a result the recruiter can verify.</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Card 2: Live Transcript ── */}
        <div className="overflow-hidden rounded-lg border border-line bg-canvas-soft backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-black">Live Transcript</p>
            <span className="h-2 w-2 animate-pulse rounded-full bg-danger" />
          </div>
          <div className="space-y-3 p-3">
            {[
              { role: "Sarah", color: "text-brand", msg: "Tell me about a difficult stakeholder you managed." },
              { role: "You", color: "text-brand", msg: "In my last role I worked with a VP whose priorities conflicted with our team goals..." },
              { role: "Sarah", color: "text-brand", msg: "What was the measurable outcome?" },
            ].map((item, i) => (
              <div key={i}>
                <p className={`text-[11px] font-black ${item.color}`}>{item.role}</p>
                <p className="mt-0.5 text-xs leading-4 text-muted">{item.msg}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Card 3: Trust Timeline — live ── */}
        <TrustTimeline />

        {/* ── Card 4: Progress Dashboard ── */}
        <div className="overflow-hidden rounded-lg border border-line bg-canvas-soft backdrop-blur-sm">
          <div className="border-b border-line px-4 py-3">
            <p className="text-sm font-black">Your Progress</p>
          </div>
          <div className="space-y-2.5 p-4">
            {[["Sessions", "12"], ["Avg Score", "71"], ["Best Score", "84"], ["Streak", "3 days"]].map(([label, val]) => (
              <div key={label} className="flex items-center justify-between">
                <p className="text-xs text-subtle">{label}</p>
                <p className="text-sm font-black text-fg">{val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Card 5: Interview Report — 2 cols ── */}
        <div className="overflow-hidden rounded-lg border border-line bg-canvas-soft backdrop-blur-sm md:col-span-2">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-black">Interview Report</p>
            <span className="rounded-full border border-success/20 bg-success/10 px-2.5 py-0.5 text-[11px] font-black text-success">Engaged</span>
          </div>
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-[7px] border-brand/50 bg-brand/10">
                <p className="text-lg font-black">74</p>
              </div>
              <div className="flex-1 space-y-2">
                {[["Confidence", 80], ["Clarity", 70], ["Relevance", 78]].map(([l, v]) => (
                  <div key={l as string}>
                    <div className="mb-1 flex justify-between text-[11px]">
                      <span className="text-subtle">{l}</span>
                      <span className="text-muted">{v}</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-fg/10">
                      <div className="h-full rounded-full bg-brand/60" style={{ width: `${v}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-warning/15 bg-warning/[0.07] p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-warning">Weakest answer</p>
              <p className="mt-2 text-xs leading-5 text-muted">Too broad. Add one verified metric and explain your personal action in the outcome.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function DemoSection() {
  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-3xl text-center">
          <SectionLabel>How it works</SectionLabel>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-3xl">
            Watch a live session
          </h2>
          <p className="mt-4 text-lg leading-8 text-muted">
            Two minutes. Real recruiter follow-ups. Trust score updating in real time.
          </p>
        </div>

        {/* Video container */}
        <div className="relative mt-10 overflow-hidden rounded-xl border border-line bg-canvas-soft backdrop-blur-sm">
          {/* Aspect ratio wrapper 16:9 */}
          <div className="relative aspect-video w-full">

            {/* Animated mock interview UI — shown when no video is available */}
            <div className="absolute inset-0 flex flex-col">
              {/* Header bar */}
              <div className="flex items-center justify-between border-b border-line bg-canvas-soft px-5 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-success">Live session</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-subtle">Sarah M. · Senior Hiring Manager</span>
                  <div className="flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/10 px-2.5 py-1">
                    <span className="text-[11px] font-black text-brand">Trust</span>
                    <span className="text-[11px] font-black text-fg">76</span>
                  </div>
                </div>
              </div>

              {/* Main area */}
              <div className="flex flex-1 gap-0 overflow-hidden">
                {/* Recruiter side */}
                <div className="flex w-1/2 flex-col items-center justify-center gap-4 border-r border-line p-6">
                  <div className="relative">
                    <img
                      src="/recruiters/sarah.png"
                      alt="Sarah — AI Recruiter"
                      className="h-20 w-20 rounded-full object-cover ring-2 ring-brand/30 sm:h-24 sm:w-24"
                    />
                    <div className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-brand">
                      <svg className="h-3 w-3 text-fg" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg>
                    </div>
                  </div>
                  <div className="w-full max-w-[260px] space-y-2">
                    <div className="rounded-lg rounded-tl-sm bg-fg/[0.06] px-4 py-3">
                      <p className="text-[11px] leading-5 text-muted">
                        That gives me the story. Now I need a measurable result — time saved, fewer issues, or a customer outcome. What changed after your work?
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {[1,2,3].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full bg-brand/40`} style={{animationDelay:`${i*0.15}s`}} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Candidate + copilot side */}
                <div className="flex w-1/2 flex-col justify-between p-4">
                  {/* Live copilot */}
                  <div className="rounded-lg border border-success/15 bg-success/[0.07] p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-success">Live copilot</p>
                    <p className="mt-1 text-[11px] leading-4 text-fg">Add one metric. E.g. &ldquo;reduced response time by 40%&rdquo; or &ldquo;resolved 95% of tickets first contact.&rdquo;</p>
                  </div>

                  {/* Trust timeline mini */}
                  <div className="mt-3 flex-1 rounded-lg border border-line bg-canvas-soft p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-subtle">Trust timeline</p>
                    <div className="mt-2 flex items-end gap-1 h-10">
                      {[55,60,58,72,68,76,74,78].map((v,i) => (
                        <div
                          key={i}
                          className={`flex-1 rounded-sm ${v >= 70 ? 'bg-success/60' : v >= 60 ? 'bg-brand/50' : 'bg-warning/50'}`}
                          style={{height:`${(v/100)*100}%`}}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Mic indicator */}
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-fg/[0.04] px-3 py-2">
                    <div className="h-2 w-2 rounded-full bg-danger animate-pulse" />
                    <p className="text-[11px] text-muted">Candidate responding...</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Play overlay — links to demo page */}
            <a
              href="/demo"
              className="absolute inset-0 flex items-center justify-center bg-black/30 transition hover:bg-black/20 group"
              aria-label="Try interactive demo"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="grid h-16 w-16 place-items-center rounded-full border border-line bg-fg/10 shadow-2xl backdrop-blur-sm transition group-hover:scale-110 group-hover:bg-fg/20">
                  <svg className="h-6 w-6 translate-x-0.5 text-fg" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="rounded-full border border-line bg-canvas-soft px-4 py-1.5 text-xs font-black text-fg backdrop-blur-sm">
                  Try interactive demo
                </span>
              </div>
            </a>
          </div>
        </div>

        {/* Caption row */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-[11px] text-subtle">
          {["Questions built from the actual CV", "Live trust score per answer", "Follow-ups based on what was said", "Weakest moment flagged with reasoning"].map((label) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="h-1 w-1 rounded-full bg-brand/60" />
              {label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <SectionLabel>What candidates say</SectionLabel>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-3xl">
            What changes after the first session
          </h2>
          <p className="mt-4 text-lg leading-8 text-muted">
            The trust score drop is usually the moment it clicks.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="flex flex-col rounded-xl border border-line bg-canvas-soft p-6 backdrop-blur-sm"
            >
              {/* Stars */}
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-warning text-warning" />
                ))}
              </div>

              {/* Quote */}
              <p className="mt-4 flex-1 text-sm leading-7 text-muted italic">
                “{t.quote}”
              </p>

              {/* Score pill */}
              <div className="mt-5 mb-4 inline-flex items-center gap-2 self-start rounded-full border border-success/20 bg-success/10 px-3 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                <span className="text-[11px] font-black text-success">Trust score reached {t.score}</span>
              </div>

              {/* Author */}
              <div className="flex items-center gap-3">
                {t.avatar ? (
                  <img
                    src={t.avatar}
                    alt={t.name}
                    className="h-10 w-10 rounded-full object-cover ring-1 ring-line"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/20 ring-1 ring-line text-sm font-black text-brand">
                    {t.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                  </div>
                )}
                <div>
                  <p className="text-sm font-black text-fg">{t.name}</p>
                  <p className="text-[11px] text-subtle">{t.role} · {t.location}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RecruiterPersonasSection() {
  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <SectionLabel>Meet your interviewers</SectionLabel>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-3xl">
            4 AI recruiters. Each one harder than the last.
          </h2>
          <p className="mt-4 text-lg leading-8 text-muted">
            Every recruiter has a distinct style, pressure level, and way of exposing weak answers.
            Practice against all four before the real interview.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {RECRUITER_PERSONAS.map((p) => (
            <div
              key={p.name}
              className={`relative flex flex-col rounded-xl border ${p.borderStyle} ${p.bgStyle} p-6 backdrop-blur-sm`}
            >
              {/* Plan badge */}
              <span className={`absolute right-4 top-4 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] ${p.tagStyle}`}>
                {p.tag}
              </span>

              {/* Avatar */}
              <img
                src={p.image}
                alt={p.name}
                className="h-14 w-14 rounded-full ring-1 ring-line"
              />

              {/* Name + title */}
              <p className="mt-4 text-base font-black text-fg">{p.name}</p>
              <p className={`mt-0.5 text-[11px] font-black uppercase tracking-[0.14em] ${p.accentStyle}`}>{p.title}</p>

              {/* Style tag */}
              <p className="mt-1 text-[11px] text-subtle">{p.style}</p>

              {/* Description */}
              <p className="mt-3 flex-1 text-xs leading-5 text-muted">{p.description}</p>

              {/* Difficulty dots */}
              <div className="mt-4 flex items-center gap-2">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-subtle">Difficulty</p>
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 w-1.5 rounded-full ${i < p.difficulty ? "bg-fg/70" : "bg-fg/15"}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-subtle">
          Standard personas available on all plans · Premium personas included in Premium Pro
        </p>
      </div>
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-black uppercase tracking-[0.20em] text-subtle">{children}</p>;
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-canvas-soft backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="text-sm font-black text-fg">{question}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-subtle transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-line px-5 pb-4 pt-3">
          <p className="text-sm leading-6 text-muted">{answer}</p>
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
    <main className="relative min-h-screen overflow-x-hidden bg-canvas text-fg">
      {/* Cursor glow overlay */}
      <div ref={glowRef} className="pointer-events-none fixed inset-0 z-50 transition-[background] duration-200 ease-out" />

      {/* ── Hero ── */}
      <section className="relative isolate overflow-hidden">
        {/* Cinematic glow — deep blue spotlight from above, fades to nothing */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_110%_65%_at_50%_-5%,rgba(37,99,235,0.38)_0%,rgba(14,50,140,0.18)_40%,transparent_70%)]" />
        <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative h-[42px] w-[42px] shrink-0 overflow-hidden rounded-xl">
              <Image src="/workzo_icon.png" alt="WorkZo AI" fill priority className="object-cover" sizes="42px" />
            </div>
            <span className="text-xl font-black tracking-tight sm:text-2xl">
              WorkZo <span className="text-muted">AI</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-semibold text-muted md:flex">
            <div className="group relative">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 transition hover:text-fg"
              >
                Features
                <ChevronDown className="h-4 w-4" />
              </button>

              <div className="invisible absolute left-0 top-full z-50 mt-4 w-72 translate-y-2 rounded-lg border border-line bg-canvas/95 p-3 opacity-0 shadow-2xl shadow-black/30 backdrop-blur-xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                {[
                  ["How it works", "/features/interview-practice", "See how the recruiter reads the CV and where offers are lost."],
                  ["Improve CV", "/features/improve-cv", "View CV optimization details before upgrading."],
                  ["Cover Letter", "/features/cover-letter", "See how tailored letters are generated."],
                  ["Job Assist", "/features/job-assist", "Understand role-preparation tools."],
                  ["Results Report", "/features/results-intelligence", "Preview trust, score, and weak-answer reports."],
                ].map(([title, href, text]) => (
                  <Link
                    key={title}
                    href={href}
                    className="block rounded-xl px-3 py-2.5 transition hover:bg-fg/10"
                  >
                    <span className="block text-sm font-black text-fg">{title}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-subtle">{text}</span>
                  </Link>
                ))}
              </div>
            </div>

            <a href="#how" className="transition hover:text-fg">How it works</a>
            <Link href="/pricing" className="transition hover:text-fg">Pricing</Link>

            <div className="group relative">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 transition hover:text-fg"
              >
                Resources
                <ChevronDown className="h-4 w-4" />
              </button>

              <div className="invisible absolute left-0 top-full z-50 mt-4 w-72 translate-y-2 rounded-lg border border-line bg-canvas/95 p-3 opacity-0 shadow-2xl shadow-black/30 backdrop-blur-xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
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
                    className="block rounded-xl px-3 py-2.5 transition hover:bg-fg/10"
                  >
                    <span className="block text-sm font-black text-fg">{title}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-subtle">{text}</span>
                  </Link>
                ))}
              </div>
            </div>
          </nav>

          <AuthNavButton />
        </header>

        <div className="mx-auto max-w-7xl px-4 pb-20 pt-14 sm:px-6 lg:px-8 lg:pb-24 lg:pt-20">
          <div className="flex flex-col items-center text-center">
            <h1 className="mt-6 max-w-4xl text-4xl font-black leading-[1.02] tracking-tight sm:text-4xl lg:text-[68px]">
              Find out why the offer went to someone else.<br className="hidden sm:block" /> Before a real recruiter shows you.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted sm:text-xl">
              WorkZo reads the CV, the role, and the company. Then it asks the exact questions a recruiter would — with follow-ups, pressure, and a live trust score that shows exactly where the interview turned.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/onboarding" className="inline-flex items-center justify-center gap-2 rounded-lg bg-fg px-7 py-4 text-base font-black text-canvas shadow-xl shadow-black/20 transition hover:scale-[1.02] hover:bg-brand hover:text-on-brand">
                See Where Offers Are Lost
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link href="/demo" className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-fg/10 px-7 py-4 text-base font-black text-fg backdrop-blur transition hover:bg-fg/20">
                <PlayCircle className="h-5 w-5 text-muted" />
                Try Demo
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2">
              {trustItems.map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm font-semibold text-muted">
                  <CheckCircle2 className="h-4 w-4 text-success" />
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
              ["500+", "sessions run"],
              ["74", "Avg. trust improvement"],
              ["10+", "Countries"],
              ["4", "recruiter personas"],
            ].map(([number, label]) => (
              <div key={label} className="rounded-lg border border-line bg-canvas-soft p-6 text-center backdrop-blur-sm">
                <p className="text-4xl font-black text-fg">{number}</p>
                <p className="mt-1 text-sm text-subtle">{label}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-subtle">
            Built to show what recruiters notice — and what candidates never see coming.
          </p>
        </div>
      </section>

      {/* ── Real Interview Walkthrough ── */}
      <section id="how" className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <div className="text-center">
            <SectionLabel>How it works</SectionLabel>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-3xl">
              How the flight simulator works
            </h2>
            <p className="mt-4 text-lg leading-8 text-muted">
              A company-aware interview simulation with pressure, follow-ups, and hiring-signal analysis.
            </p>
          </div>

          <div className="relative mt-10">
            {/* Vertical connector line */}
            <div className="absolute left-[15px] top-4 h-[calc(100%-2rem)] w-px bg-fg/[0.08]" />

            <div className="space-y-4">
              {/* Step 1: Recruiter Question */}
              <div className="relative flex gap-5">
                <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand ring-4 ring-brand/20">
                  <span className="text-[9px] font-black text-fg">01</span>
                </div>
                <div className="flex-1 rounded-lg border border-brand/30 bg-brand/[0.07] px-4 py-3 backdrop-blur-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">Recruiter Question</p>
                  <p className="mt-1.5 text-sm leading-6 text-fg">
                    Tell me about a difficult customer situation you handled.
                  </p>
                </div>
              </div>

              {/* Step 2: Candidate Answer */}
              <div className="relative flex gap-5">
                <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fg/20 ring-4 ring-line">
                  <span className="text-[9px] font-black text-fg">02</span>
                </div>
                <div className="flex-1 rounded-lg border border-line bg-canvas-soft px-4 py-3 backdrop-blur-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-subtle">Candidate Answer</p>
                  <p className="mt-1.5 text-sm leading-6 text-muted italic">
                    &ldquo;I handled many difficult customers and always tried to resolve issues quickly.&rdquo;
                  </p>
                </div>
              </div>

              {/* Step 3: WorkZo Analysis */}
              <div className="relative flex gap-5">
                <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success ring-4 ring-success/20">
                  <span className="text-[9px] font-black text-fg">03</span>
                </div>
                <div className="flex-1 overflow-hidden rounded-lg border border-success/30 bg-success/[0.07] backdrop-blur-sm">
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-success">WorkZo Analysis</p>
                    <span className="shrink-0 rounded-full border border-danger/30 bg-danger/15 px-2.5 py-0.5 text-[11px] font-black text-danger">
                      Trust −18%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-line border-t border-line">
                    <div className="px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-danger/80">Why it dropped</p>
                      <p className="mt-1 text-xs leading-5 text-muted">No evidence, no ownership, too generic</p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-success">Fix</p>
                      <p className="mt-1 text-xs leading-5 text-muted">Use STAR · add metrics · show ownership</p>
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
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-3xl">
            Why strong candidates still get rejected
          </h2>
          <p className="mt-4 text-lg leading-8 text-muted">
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
            <div key={card.title} className="rounded-xl border border-line bg-canvas-soft p-6 backdrop-blur-sm">
              <p className="mb-4 text-sm font-black uppercase tracking-[0.18em] text-subtle">{card.title}</p>
              <div className="space-y-3">
                <div className="rounded-xl bg-fg/[0.05] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-subtle">Candidate</p>
                  <p className="mt-1 text-sm leading-5 text-muted">&ldquo;{card.candidate}&rdquo;</p>
                </div>
                <div className="rounded-xl border border-danger/20 bg-danger/[0.07] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-danger">Recruiter</p>
                  <p className="mt-1 text-sm leading-5 text-muted">{card.recruiter}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-xl text-center text-sm leading-7 text-subtle">
          WorkZo catches these mistakes before the real interview.
        </p>
      </section>

      {/* ── Results Preview ── */}
      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <SectionLabel>Your report</SectionLabel>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-3xl">
            What your report shows after every interview
          </h2>
          <p className="mt-4 text-lg leading-8 text-muted">
            WorkZo shows exactly where recruiter confidence increased or dropped.
          </p>
        </div>

        <div className="mx-auto mt-8 max-w-7xl">
          <div className="overflow-hidden rounded-xl border border-brand/[0.22] bg-canvas-soft shadow-[0_0_60px_rgba(59,130,246,0.08)] backdrop-blur-sm">
            {/* Card header */}
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <p className="text-sm font-black">Interview Report</p>
              <span className="rounded-full border border-success/20 bg-success/10 px-2.5 py-0.5 text-[11px] font-black text-success">
                Engaged
              </span>
            </div>

            {/* Card body */}
            <div className="grid gap-5 p-5 md:grid-cols-2">
              {/* Left — Trust Score + Timeline */}
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full border-[8px] border-brand/50 bg-brand/10">
                    <p className="text-4xl font-black">71</p>
                  </div>
                  <div>
                    <p className="text-sm font-black text-fg">Recruiter Trust Score</p>
                    <p className="mt-0.5 text-xs text-subtle">/ 100</p>
                  </div>
                </div>

                <div className="rounded-lg border border-line bg-fg/[0.03] p-4">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-subtle">
                    Trust Timeline
                  </p>
                  <div className="space-y-2.5">
                    {[
                      { q: "Q1", v: 92, color: "bg-brand/60", drop: false },
                      { q: "Q2", v: 84, color: "bg-brand/60", drop: false },
                      { q: "Q3", v: 61, color: "bg-warning/60", drop: true },
                      { q: "Q4", v: 58, color: "bg-danger/60", drop: true },
                      { q: "Q5", v: 74, color: "bg-brand/60", drop: false },
                    ].map(({ q, v, color, drop }) => (
                      <div key={q} className="flex items-center gap-3">
                        <p className="w-5 shrink-0 text-[11px] text-subtle">{q}</p>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fg/10">
                          <div className={`h-full rounded-full ${color}`} style={{ width: `${v}%` }} />
                        </div>
                        <div className="flex w-14 items-center justify-end gap-1">
                          <p className={`text-[11px] font-black ${drop ? "text-danger" : "text-muted"}`}>{v}%</p>
                          {drop && <span className="text-[10px] text-danger">↓</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right — Weakest Answer, Recruiter Thoughts, Improvement Plan */}
              <div className="space-y-4">
                <div className="rounded-lg border border-warning/20 bg-warning/[0.07] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-warning">
                    Weakest Answer
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    You described responsibilities but gave no measurable proof.
                  </p>
                </div>

                <div className="rounded-lg border border-line bg-fg/[0.04] p-4">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-subtle">
                    Recruiter Thoughts
                  </p>
                  <p className="text-sm text-muted">Candidate sounds experienced.</p>
                  <p className="mt-1 text-sm text-subtle">Evidence is missing.</p>
                </div>

                <div className="rounded-lg border border-success/20 bg-success/[0.07] p-4">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-success">
                    Improvement Plan
                  </p>
                  <ul className="space-y-1.5">
                    {["Add measurable outcomes", "Demonstrate ownership", "Use STAR structure"].map((item) => (
                      <li key={item} className="flex items-center gap-2 text-xs text-muted">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success/70" />
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
              href="/onboarding"
              className="inline-flex items-center gap-2 rounded-lg bg-fg px-7 py-4 text-base font-black text-canvas shadow-xl shadow-black/20 transition hover:scale-[1.02] hover:bg-brand hover:text-on-brand"
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
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-3xl">More than interview questions.</h2>
          <p className="mt-4 text-lg leading-8 text-muted">
            WorkZo focuses on recruiter realism: follow-ups, proof, ownership, metrics, and confidence under pressure.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-7xl gap-5 md:grid-cols-4">
          {quickFeatures.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.title} className="rounded-xl border border-line bg-canvas-soft p-6 backdrop-blur-sm transition hover:-translate-y-1 hover:bg-canvas-soft">
                <div className="grid h-12 w-12 place-items-center rounded-lg bg-fg/10 text-fg ring-1 ring-line">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-black">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{card.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Why WorkZo Is Different ── */}
      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <SectionLabel>The difference</SectionLabel>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-3xl">
            Built for real interviews
          </h2>
        </div>

        <div className="mx-auto mt-8 max-w-4xl overflow-hidden rounded-xl border border-line bg-canvas-soft backdrop-blur-sm">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_1fr_1fr] border-b border-line bg-fg/[0.04] px-5 py-3.5">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-subtle">Feature</p>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brand">WorkZo AI</p>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-subtle">Typical Apps</p>
          </div>

          {COMPARISON_ROWS.map(([feature, workzo, typical], i) => (
            <div
              key={feature}
              className={`grid grid-cols-[1fr_1fr_1fr] items-start border-b border-line px-5 py-4 last:border-0 ${i % 2 === 1 ? "bg-fg/[0.02]" : ""}`}
            >
              <p className="text-sm font-black text-fg">{feature}</p>
              <div className="flex items-start gap-1.5 pr-4">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                <p className="text-xs leading-5 text-success/90">{workzo}</p>
              </div>
              <p className={`text-xs leading-5 ${typical === "Not available" ? "text-danger/60" : "text-warning/60"}`}>
                {typical}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Demo Video ── */}
      <DemoSection />

      {/* ── Recruiter Personas ── */}
      <RecruiterPersonasSection />

      {/* ── Testimonials ── */}
      <TestimonialsSection />

      {/* ── Pricing ── */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <SectionLabel>Pricing</SectionLabel>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-3xl">
              Know what the offer costs. Then close the gap.
            </h2>
            <p className="mt-4 text-base leading-7 text-muted">
              Free shows where the gap is. Premium closes it. Premium Pro builds on every session until the offer lands.
            </p>
          </div>

          <div className="mt-10 grid items-stretch gap-4 lg:grid-cols-3">

            {/* Free */}
            <div className="flex flex-col rounded-xl border border-line bg-fg/[0.03] p-6">
              <div className="mb-5 h-6">
                <span className="inline-flex items-center rounded-full border border-line bg-fg/5 px-3 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-subtle">
                  Free forever
                </span>
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-subtle">Free</p>
              <h3 className="mt-1.5 text-lg font-black leading-snug text-fg">Start here</h3>
              <p className="mt-4 text-4xl font-black text-fg sm:text-3xl">{localizedPlans.free.amount}</p>
              <p className="mt-3 text-sm leading-6 text-muted">
                Two sessions. Enough to find the question that would have cost the offer.
              </p>
              <div className="my-5 h-px bg-fg/[0.07]" />
              <div className="flex-1 space-y-2.5">
                {[
                  "2 voice interviews / month",
                  "CV-aware recruiter questions",
                  "Follow-ups based on what was said",
                  "Post-session breakdown",
                  "3 recruiter personas",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-[15px] w-[15px] shrink-0 text-success" />
                    <span className="text-sm leading-[1.45] text-fg">{item}</span>
                  </div>
                ))}
                <div className="mt-4 space-y-2.5 border-t border-line pt-4">
                  {["Session history", "CV diagnostics", "Live AI recruiter"].map((item) => (
                    <div key={item} className="flex items-start gap-2.5">
                      <div className="mt-[5px] h-[6px] w-[6px] shrink-0 rounded-full bg-fg/15" />
                      <span className="text-sm leading-[1.45] text-subtle">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <Link
                href="/onboarding"
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-fg/10 px-6 py-3 text-sm font-black text-fg transition hover:bg-fg/20"
              >
                Start Free <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Premium */}
            <div className="flex flex-col rounded-xl border-2 border-brand/50 bg-canvas p-6">
              <div className="mb-5 h-6">
                <span className="inline-flex items-center rounded-full bg-brand/20 px-3 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-brand">
                  Most popular
                </span>
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-subtle">Premium</p>
              <h3 className="mt-1.5 text-lg font-black leading-snug text-fg">Full readiness system</h3>
              <div className="mt-4 flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-black text-subtle line-through decoration-2">{localizedPlans.premium.regular}</span>
                <span className="text-4xl font-black text-fg sm:text-3xl">{localizedPlans.premium.amount}</span>
                <span className="text-base text-subtle">/month</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted">
                Everything needed to close the gap — sessions, CV diagnostics, cover letters, and full history.
              </p>
              <p className="mt-2 text-xs font-black text-success">
                24-hour free trial · cancel anytime before charged
              </p>
              <div className="my-5 h-px bg-fg/[0.07]" />
              <div className="flex-1 space-y-2.5">
                {[
                  "50 voice interviews / month",
                  "Trust score timeline per session",
                  "Full session history",
                  "CV diagnostics + ATS optimisation",
                  "Cover letter builder",
                  "Job analysis tool",
                  "Career Brain + performance tracking",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-[15px] w-[15px] shrink-0 text-brand" />
                    <span className="text-sm leading-[1.45] text-fg">{item}</span>
                  </div>
                ))}
              </div>
              <Link
                href="/pricing?plan=premium"
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-6 py-3 text-sm font-black text-on-brand transition hover:bg-brand"
              >
                Choose Premium <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Premium Pro */}
            <div className="flex flex-col rounded-xl border border-brand/30 bg-fg/[0.03] p-6">
              <div className="mb-5 h-6">
                <span className="inline-flex items-center rounded-full bg-brand/15 px-3 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-brand">
                  Full system
                </span>
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-subtle">Premium Pro</p>
              <h3 className="mt-1.5 text-lg font-black leading-snug text-fg">Long-term career system</h3>
              <div className="mt-4 flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-black text-subtle line-through decoration-2">{localizedPlans.premiumPro.regular}</span>
                <span className="text-4xl font-black text-fg sm:text-3xl">{localizedPlans.premiumPro.amount}</span>
                <span className="text-base text-subtle">/month</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted">
                For candidates who want more than one-off prep. Builds session to session.
              </p>
              <p className="mt-2 text-xs font-black text-brand">
                2 free live recruiter minutes included
              </p>
              <div className="my-5 h-px bg-fg/[0.07]" />
              <div className="flex-1 space-y-2.5">
                {[
                  "Everything in Premium",
                  "Unlimited voice interviews",
                  "Live AI video recruiter",
                  "60 live recruiter minutes / month",
                  "Premium recruiter personas",
                  "AI career coach",
                  "30/60/90 day roadmaps",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-[15px] w-[15px] shrink-0 text-brand" />
                    <span className="text-sm leading-[1.45] text-fg">{item}</span>
                  </div>
                ))}
              </div>
              <Link
                href="/pricing?plan=premium_pro"
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-6 py-3 text-sm font-black text-on-brand transition hover:bg-brand"
              >
                Choose Premium Pro <ArrowRight className="h-4 w-4" />
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
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-3xl">
              Common questions
            </h2>
          </div>
          <div className="space-y-2">
            {[
              ["Is WorkZo just another question bank?", "No. The recruiter reacts to exactly what was said — follow-up questions, pushback, and trust scores change based on each answer. There are no preset scripts."],
              ["How realistic are the recruiters?", "Each persona is built on real hiring patterns. German recruiters probe timelines and scope. US recruiters want ownership and metrics. The pressure is not random — it follows a logic."],
              ["What does the trust score actually measure?", "Recruiter confidence, updated after each answer. A drop means something was vague, ownership was unclear, or a claim went unproven. The timeline shows exactly which answer caused it."],
              ["Does it read my actual CV?", "Yes. Upload or paste a CV and the recruiter asks about the specific roles, gaps, and claims in it. Generic prep tools cannot do that."],
              ["What does the report show?", "Trust score per question, the exact moment confidence dropped, the follow-up that would have come next, and a specific improvement plan — not general tips."],
              ["Which languages work?", "English, German, Dutch, French, Spanish, Italian, and Portuguese. The recruiter speaks in the selected language — not just the interface."],
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
