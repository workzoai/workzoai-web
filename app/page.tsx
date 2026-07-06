"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUp,
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
import { SectionHeading } from "@/components/marketing/kit";
import B2BLeadForm from "@/components/marketing/B2BLeadForm";
import { getWorkZoDisplayPrices } from "@/lib/workzoLocalizedPricing";

const trustItems = [
  "Reads the CV. Knows the role.",
  "Pressure. Follow-ups. Real feedback.",
  "Used in 10+ countries",
];

const quickFeatures = [
  { title: "Recruiter That Reads Your CV", text: "Questions are built from your actual background. Gaps get probed.", icon: Mic },
  { title: "Role and Market Aware", text: "DACH, US, and UK recruiters behave differently. So does WorkZo.", icon: FileText },
  { title: "Live Copilot", text: "Mid-session guidance on what to say, and what not to.", icon: Zap },
  { title: "Trust Score Timeline", text: "See the exact question where the recruiter's confidence dropped.", icon: BarChart3 },
];

const TESTIMONIALS = [
  {
    quote: "Finally, an interview practice tool that feels like talking to a real recruiter. The feedback was actionable, and I felt more prepared after just a few sessions.",
    name: "Eliana Teixeira",
    role: "Data Analyst",
    location: "Portugal",
    score: 87,
    avatar: "/testimonials/eliana-teixeira.jpg",
  },
];

// Real, verifiable product facts shown alongside the testimonial. As more
// genuine user quotes arrive (with permission), add them to TESTIMONIALS —
// never add invented names or AI-generated faces: fabricated reviews are
// illegal under German UWG / the EU Omnibus Directive and would end any
// university or B2B procurement conversation instantly.
const PRODUCT_FACTS = [
  { value: "11", label: "recruiter personas, from friendly HR screens to principal-engineer system design" },
  { value: "15", label: "interview languages with native question generation" },
  { value: "CV + JD", label: "every question grounded in your real background and the actual job posting" },
  { value: "0", label: "generic question banks - interviews are generated per session" },
];

const RECRUITER_PERSONAS = [
  // Standard tier (Free / Premium)
  {
    name: "Sarah",
    title: "Friendly HR",
    image: "/recruiters/sarah.png",
    emoji: null,
    style: "Warm · Supportive",
    description: "Puts you at ease but still probes communication, culture fit, and role clarity. Great for warming up before tougher rounds.",
    difficulty: 2,
    tag: "Free",
    tagStyle: "border-fg/20 bg-fg/5 text-muted",
    borderStyle: "border-fg/10",
    bgStyle: "bg-fg/[0.03]",
    accentStyle: "text-muted",
  },
  {
    name: "Daniel",
    title: "Hiring Manager",
    image: "/recruiters/daniel.png",
    emoji: null,
    style: "Evidence-driven · Direct",
    description: "Pushes hard on proof and ownership. Won't let a vague answer pass. 'What was the measurable outcome?' is his signature follow-up.",
    difficulty: 5,
    tag: "Free",
    tagStyle: "border-fg/20 bg-fg/5 text-muted",
    borderStyle: "border-fg/10",
    bgStyle: "bg-fg/[0.03]",
    accentStyle: "text-muted",
  },
  {
    name: "Priya",
    title: "Startup Recruiter",
    image: "/recruiters/priya.png",
    emoji: null,
    style: "Fast-paced · Impact-driven",
    description: "Cares about ownership, speed, and execution. Cut the buzzwords — show what you personally shipped and how fast.",
    difficulty: 4,
    tag: "Free",
    tagStyle: "border-fg/20 bg-fg/5 text-muted",
    borderStyle: "border-fg/10",
    bgStyle: "bg-fg/[0.03]",
    accentStyle: "text-muted",
  },
  {
    name: "Markus",
    title: "Corporate Recruiter",
    image: "/recruiters/markus.png",
    emoji: null,
    style: "Structured · Process-oriented",
    description: "Expects organised, concise answers. DACH-style precision: relevance first, no rambling, clear professional framing at every step.",
    difficulty: 4,
    tag: "Free",
    tagStyle: "border-fg/20 bg-fg/5 text-muted",
    borderStyle: "border-fg/10",
    bgStyle: "bg-fg/[0.03]",
    accentStyle: "text-muted",
  },
  {
    name: "Alex Chen",
    title: "Technical Interviewer",
    image: "/recruiters/alex.png",
    emoji: null,
    style: "Deep-dive · CV-grounded",
    description: "Asks about your actual projects by name. Probes trade-offs, complexity, and why you chose X over Y. No generic 'design for 10M users' questions.",
    difficulty: 5,
    tag: "Premium",
    tagStyle: "border-brand/20 bg-brand/10 text-brand",
    borderStyle: "border-brand/20",
    bgStyle: "bg-brand/[0.06]",
    accentStyle: "text-brand",
  },
  // Pro tier
  {
    name: "Zoe Park",
    title: "Startup Founder",
    image: "/recruiters/zoe.png",
    emoji: null,
    style: "Radical ownership · No fluff",
    description: "Built and scaled teams herself. Wants to know what you'd do day one, how you handle ambiguity, and whether you can move without instructions.",
    difficulty: 5,
    tag: "Pro",
    tagStyle: "border-warning/20 bg-warning/10 text-warning",
    borderStyle: "border-warning/20",
    bgStyle: "bg-warning/[0.06]",
    accentStyle: "text-warning",
  },
  {
    name: "James Harrington",
    title: "Consulting Partner",
    image: "/recruiters/james.png",
    emoji: null,
    style: "Case-style · Framework pressure",
    description: "Expects structured thinking, clear hypotheses, and client-ready communication. Rambling answers get redirected fast.",
    difficulty: 4,
    tag: "Pro",
    tagStyle: "border-warning/20 bg-warning/10 text-warning",
    borderStyle: "border-warning/20",
    bgStyle: "bg-warning/[0.06]",
    accentStyle: "text-warning",
  },
  {
    name: "Noah Jones",
    title: "Sales Director",
    image: "/recruiters/noah.png",
    emoji: null,
    style: "Numbers-first · Commercial",
    description: "Wants quota, deal size, and pipeline discipline. Give vague revenue claims and he'll push until you have an exact figure.",
    difficulty: 4,
    tag: "Pro",
    tagStyle: "border-warning/20 bg-warning/10 text-warning",
    borderStyle: "border-warning/20",
    bgStyle: "bg-warning/[0.06]",
    accentStyle: "text-warning",
  },
  {
    name: "Aisha Patel",
    title: "Product Leader",
    image: "/recruiters/aisha.png",
    emoji: null,
    style: "User-empathy · Data-driven",
    description: "Probes prioritisation discipline, cross-functional influence, and metric-driven decisions. Wants you to defend the trade-offs you made.",
    difficulty: 4,
    tag: "Pro",
    tagStyle: "border-warning/20 bg-warning/10 text-warning",
    borderStyle: "border-warning/20",
    bgStyle: "bg-warning/[0.06]",
    accentStyle: "text-warning",
  },
  {
    name: "Victoria Stern",
    title: "Executive Recruiter",
    image: "/recruiters/victoria.png",
    emoji: null,
    style: "Board-ready · Leadership narrative",
    description: "Places C-suite and VP-level leaders. Assesses executive presence, organisational impact, and whether your leadership story actually holds up.",
    difficulty: 4,
    tag: "Pro",
    tagStyle: "border-warning/20 bg-warning/10 text-warning",
    borderStyle: "border-warning/20",
    bgStyle: "bg-warning/[0.06]",
    accentStyle: "text-warning",
  },
  {
    name: "David Kimura",
    title: "Principal Engineer",
    image: "/recruiters/david.png",
    emoji: null,
    style: "System design · Trade-offs",
    description: "Interviews senior engineers on architecture judgment: why that design, what breaks at scale, and how you brought the team with you.",
    difficulty: 5,
    tag: "Pro",
    tagStyle: "border-warning/20 bg-warning/10 text-warning",
    borderStyle: "border-warning/20",
    bgStyle: "bg-warning/[0.06]",
    accentStyle: "text-warning",
  },
];

const COMPARISON_ROWS = [
  ["CV-Aware Interviews", "Reads your actual CV: questions reference your real experience", "Generic role filter only"],
  ["Job Description Awareness", "Probes the exact skills and gaps in the posting you paste", "Role type only, not the specific job"],
  ["Recruiter Trust Analysis", "Live trust score per answer with a timeline showing why it dropped", "Not available"],
  ["Dynamic Follow-Ups", "Recruiter reacts to your specific answer, not a fixed script", "Preset question order"],
  ["Weakest Answer Detection", "Flags your lowest-scoring answer with a specific, actionable fix", "Not available"],
  ["Recruiter Personalities", "11 recruiter personas with distinct styles and pressure levels", "Not available"],
  ["Trust Timeline", "Visual graph of recruiter confidence question by question", "Not available"],
  ["Improvement Plan", "Specific metrics, ownership, and structure fixes tied to your session", "Generic tips"],
];

// Module-level constant, not recreated on every TrustTimeline render
const FIXED_TRUST_PTS = [[0,42],[20,36],[40,39],[60,28],[80,23],[110,26]];

const TRUST_STAGES = [
  { score: 74, delta: "+26 pts", lastY: 20, color: "text-success", badge: "border-success/20 bg-success/10 text-success" },
  { score: 71, delta: "+23 pts", lastY: 22, color: "text-success", badge: "border-success/20 bg-success/10 text-success" },
  { score: 79, delta: "+31 pts", lastY: 15, color: "text-success", badge: "border-success/20 bg-success/10 text-success" },
  { score: 76, delta: "+28 pts", lastY: 18, color: "text-success", badge: "border-success/20 bg-success/10 text-success" },
];

function TrustTimeline() {
  const [idx, setIdx] = useState(0);
  // Unique IDs per instance: safe if TrustTimeline ever renders more than once
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
          <p className="mb-0.5 text-xs text-muted">/ 100 trust score</p>
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
          <p className="text-[10px] text-muted">Q1</p>
          <p className="text-[10px] text-muted">Q7</p>
        </div>
      </div>
    </div>
  );
}

function PlatformBento() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">

        {/* ── Card 1: Interview Room: large, 2 cols × 2 rows ── */}
        <div className="overflow-hidden rounded-lg border border-brand/[0.22] bg-canvas-soft shadow-[0_0_40px_rgba(59,130,246,0.07)] backdrop-blur-sm md:col-span-2 md:row-span-2">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-fg/10 ring-1 ring-line">
                <UserRound className="h-4 w-4 text-muted" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted">Live interview</p>
                <p className="text-sm font-black">Sarah · Hiring Manager</p>
              </div>
            </div>
            <span className="rounded-full border border-success/20 bg-success/10 px-2.5 py-0.5 text-[11px] font-black text-success">Interested</span>
          </div>
          {/* Body */}
          <div className="grid gap-3 p-4 sm:grid-cols-[180px_1fr]">
            {/* Recruiter video tile: tall, dominant */}
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
                <p className="text-[10px] text-muted">Senior Hiring Manager</p>
              </div>
            </div>
            {/* Right panels */}
            <div className="space-y-2.5">
              <div className="rounded-xl border border-line bg-fg/[0.05] p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted">Current question</p>
                <p className="mt-1.5 text-sm leading-5 text-fg">Tell me about a customer situation where you influenced the outcome.</p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-line bg-fg/[0.05] p-3">
                  <p className="text-[11px] text-muted">Trust</p>
                  <p className="mt-1 text-2xl font-black text-fg">74</p>
                </div>
                <div className="rounded-xl border border-line bg-fg/[0.05] p-3">
                  <p className="text-[11px] text-muted">Progress</p>
                  <p className="mt-1 text-2xl font-black text-success">7/12</p>
                </div>
              </div>
              <div className="rounded-xl border border-warning/20 bg-warning/[0.07] p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-warning">Recruiter note</p>
                <p className="mt-1.5 text-xs leading-4 text-fg">Needs stronger metrics and clearer ownership.</p>
              </div>
              <div className="rounded-xl border border-line bg-fg/[0.05] p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted">Live Copilot</p>
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

        {/* ── Card 3: Trust Timeline: live ── */}
        <TrustTimeline />

        {/* ── Card 4: Progress Dashboard ── */}
        <div className="overflow-hidden rounded-lg border border-line bg-canvas-soft backdrop-blur-sm">
          <div className="border-b border-line px-4 py-3">
            <p className="text-sm font-black">Your Progress</p>
          </div>
          <div className="space-y-2.5 p-4">
            {[["Sessions", "12"], ["Avg Score", "71"], ["Best Score", "84"], ["Streak", "3 days"]].map(([label, val]) => (
              <div key={label} className="flex items-center justify-between">
                <p className="text-xs text-muted">{label}</p>
                <p className="text-sm font-black text-fg">{val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Card 5: Interview Report: 2 cols ── */}
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
                      <span className="text-muted">{l}</span>
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
  const [step, setStep] = useState(0);
  const [trust, setTrust] = useState(50);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const conversation = [
    {
      role: "recruiter",
      text: "Walk me through a dashboard or report you built that actually changed how someone made a decision.",
      trust: 50,
      feedback: null,
    },
    {
      role: "candidate",
      text: "Yeah so we built a sales dashboard. The team used it and it helped them see the data better. It was quite useful for the business.",
      trust: 34,
      feedback: { label: "Trust dropped 16 pts", reason: "No ownership. No metric. Vague outcome. 'We' not 'I'.", color: "danger" },
    },
    {
      role: "recruiter",
      text: "What did YOU specifically build, and what decision did it change?",
      trust: 34,
      feedback: null,
    },
    {
      role: "candidate",
      text: "I built a Python pipeline that pulled from three data sources into BigQuery, then designed a Looker dashboard tracking churn signals by cohort. The sales lead used it to reprioritise 40 at-risk accounts. Within 6 weeks, churn in that segment dropped from 18% to 11%.",
      trust: 81,
      feedback: { label: "Trust jumped 47 pts", reason: "Tools named. Personal ownership clear. Decision identified. Metric concrete.", color: "success" },
    },
    {
      role: "recruiter",
      text: "Good. How did you decide which churn signals to track?",
      trust: 81,
      feedback: null,
    },
  ];

  useEffect(() => {
    if (!running) return;
    if (step >= conversation.length) {
      setRunning(false);
      setDone(true);
      return;
    }
    const delay = step === 0 ? 400 : conversation[step].role === "candidate" ? 1800 : 1200;
    const t = window.setTimeout(() => {
      setTrust(conversation[step].trust);
      setStep((s) => s + 1);
    }, delay);
    return () => window.clearTimeout(t);
  }, [running, step]);

  function startDemo() {
    setStep(0);
    setTrust(50);
    setDone(false);
    setRunning(true);
  }

  const visibleSteps = conversation.slice(0, step);
  const trustColor = trust >= 70 ? "#22c55e" : trust >= 55 ? "#3b82f6" : "#f59e0b";
  const trustLabel = trust >= 70 ? "Strong signal" : trust >= 55 ? "Neutral" : "Weak signal";

  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <SectionLabel>Live demo</SectionLabel>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            Watch the trust score change in real time
          </h2>
          <p className="mt-4 text-lg text-muted">
            Same candidate, same role. One vague answer drops the score. One specific answer with tools and metrics brings it back.
          </p>
        </div>

        <div className="mt-12 overflow-hidden rounded-2xl border border-line bg-canvas shadow-xl shadow-black/[0.08]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line bg-canvas-soft px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className={`h-2 w-2 rounded-full ${running ? "animate-pulse bg-success" : done ? "bg-success" : "bg-muted/40"}`} />
              <span className="text-xs font-black uppercase tracking-[0.18em] text-muted">
                {running ? "Interview in progress" : done ? "Session complete" : "Ready to start"}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="hidden text-xs text-muted sm:block">Alex Chen · Technical Interviewer</span>
              <div className="flex items-center gap-1.5 rounded-full border border-line bg-canvas px-3 py-1">
                <span className="text-[11px] font-black text-muted">Trust</span>
                <span className="text-[11px] font-black text-fg" style={{color: trustColor}}>{trust}</span>
                <span className="text-[9px] text-muted">/100</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px]">
            {/* Conversation */}
            <div className="min-h-[380px] space-y-4 border-b border-line p-5 lg:border-b-0 lg:border-r">
              {step === 0 && !running && (
                <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-6 text-center">
                  <div className="space-y-2">
                    <p className="text-sm font-black text-fg">See exactly what kills a candidate&apos;s chances</p>
                    <p className="text-xs text-muted">Watch the trust score drop on a vague answer, then recover when they fix it.</p>
                  </div>
                  <button
                    onClick={startDemo}
                    className="inline-flex items-center gap-2.5 rounded-xl bg-fg px-6 py-3 text-sm font-black text-canvas shadow-lg transition hover:scale-[1.02] hover:bg-brand hover:text-on-brand"
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"/>
                    </svg>
                    Play demo
                  </button>
                  <p className="text-[11px] text-muted">Takes 15 seconds</p>
                </div>
              )}

              {visibleSteps.map((s, i) => (
                <div key={i} className={`flex flex-col gap-2 ${s.role === "candidate" ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                    s.role === "recruiter"
                      ? "rounded-tl-sm bg-fg/[0.06] text-fg"
                      : "rounded-tr-sm bg-brand text-white"
                  }`}>
                    {s.role === "recruiter" && (
                      <p className="mb-1 text-[10px] font-black uppercase tracking-wide text-muted">Sarah Chen</p>
                    )}
                    {s.text}
                  </div>
                  {s.feedback && (
                    <div className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs max-w-[85%] ${
                      s.feedback.color === "success"
                        ? "border-success/20 bg-success/[0.07] text-success"
                        : "border-warning/20 bg-warning/[0.07] text-warning"
                    }`}>
                      <span className="mt-0.5 shrink-0 font-black">{s.feedback.color === "success" ? "+" : "−"}</span>
                      <div>
                        <p className="font-black">{s.feedback.label}</p>
                        <p className="mt-0.5 opacity-80">{s.feedback.reason}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {running && step < conversation.length && (
                <div className={`flex ${conversation[step]?.role === "candidate" ? "justify-end" : "justify-start"}`}>
                  <div className="flex items-center gap-1.5 rounded-2xl bg-fg/[0.06] px-4 py-3">
                    {[0,1,2].map(i => (
                      <div key={i} className="h-1.5 w-1.5 rounded-full bg-muted animate-bounce" style={{animationDelay:`${i*0.15}s`}} />
                    ))}
                  </div>
                </div>
              )}

              {done && (
                <div className="rounded-xl border border-line bg-canvas-soft p-4 text-center">
                  <p className="text-xs font-black text-fg">Ready to practice this yourself?</p>
                  <Link href="/onboarding" className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-fg px-4 py-2 text-xs font-black text-canvas transition hover:bg-brand hover:text-on-brand">
                    Start your interview
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
                  </Link>
                </div>
              )}
            </div>

            {/* Live score panel */}
            <div className="p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Recruiter trust score</p>

              {/* Big score */}
              <div className="mt-4 flex items-end gap-2">
                <span className="text-5xl font-black tabular-nums transition-all duration-700" style={{color: trustColor}}>{trust}</span>
                <span className="mb-1.5 text-sm text-muted">/100</span>
              </div>
              <p className="mt-1 text-xs font-black" style={{color: trustColor}}>{trustLabel}</p>

              {/* Trust bar */}
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-fg/[0.07]">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{width:`${trust}%`, backgroundColor: trustColor}}
                />
              </div>

              {/* Score history */}
              <div className="mt-6">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted">This session</p>
                <div className="mt-3 flex items-end gap-1 h-16">
                  {[50, ...(visibleSteps.filter(s => s.trust !== undefined).map(s => s.trust))].map((v, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm transition-all duration-500"
                      style={{
                        height:`${(v/100)*100}%`,
                        backgroundColor: v >= 70 ? "#22c55e" : v >= 55 ? "#3b82f6" : "#f59e0b",
                        opacity: 0.7
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* What recruiters look for */}
              <div className="mt-6 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted">What Alex notices</p>
                {[
                  { label: "Tools named (Python, BigQuery, Looker)", ok: step >= 4 },
                  { label: "Personal ownership clear", ok: step >= 4 },
                  { label: "Metric with before/after", ok: step >= 4 },
                  { label: "Business decision linked", ok: step >= 4 },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 transition-colors duration-500 ${
                      item.ok ? "border-success bg-success" : "border-line bg-transparent"
                    }`}>
                      {item.ok && (
                        <svg className="h-full w-full text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                        </svg>
                      )}
                    </div>
                    <span className={`text-xs transition-colors duration-500 ${item.ok ? "font-black text-fg" : "text-muted"}`}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>

              {done && (
                <button
                  onClick={startDemo}
                  className="mt-6 w-full rounded-lg border border-line bg-fg/[0.04] py-2 text-xs font-black text-muted transition hover:bg-fg/[0.08]"
                >
                  Replay
                </button>
              )}
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted">
          This is what WorkZo shows you after every answer. Your real session uses your CV and the actual job.
        </p>
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
          {/* Verifiable product facts shown alongside the real testimonial.
              These replaced two previously fabricated quotes — real quotes
              get added to TESTIMONIALS as users grant permission. */}
          <div className="flex flex-col justify-center gap-5 rounded-xl border border-line bg-canvas-soft p-6 backdrop-blur-sm">
            {PRODUCT_FACTS.slice(0, 2).map((f) => (
              <div key={f.label}>
                <div className="text-2xl font-black text-fg">{f.value}</div>
                <div className="mt-1 text-sm leading-6 text-muted">{f.label}</div>
              </div>
            ))}
          </div>
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
                  <p className="text-[11px] text-muted">{t.role} · {t.location}</p>
                </div>
              </div>
            </div>
          ))}
          <div className="flex flex-col justify-center gap-5 rounded-xl border border-line bg-canvas-soft p-6 backdrop-blur-sm">
            {PRODUCT_FACTS.slice(2).map((f) => (
              <div key={f.label}>
                <div className="text-2xl font-black text-fg">{f.value}</div>
                <div className="mt-1 text-sm leading-6 text-muted">{f.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function RecruiterCard({ p }: { p: typeof RECRUITER_PERSONAS[number] }) {
  return (
    <div className={`relative flex flex-col rounded-xl border ${p.borderStyle} ${p.bgStyle} p-6 backdrop-blur-sm`}>
      {/* Plan badge */}
      <span className={`absolute right-4 top-4 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] ${p.tagStyle}`}>
        {p.tag}
      </span>

      {/* Avatar */}
      {p.image ? (
        <img src={p.image} alt={p.name} className="h-14 w-14 rounded-full ring-1 ring-line" />
      ) : (
        <span className="grid h-14 w-14 place-items-center rounded-full bg-fg/[0.07] text-2xl ring-1 ring-line">
          {p.emoji}
        </span>
      )}

      {/* Name + title */}
      <p className="mt-4 text-base font-black text-fg">{p.name}</p>
      <p className={`mt-0.5 text-[11px] font-black uppercase tracking-[0.14em] ${p.accentStyle}`}>{p.title}</p>

      {/* Style tag */}
      <p className="mt-1 text-[11px] text-muted">{p.style}</p>

      {/* Description */}
      <p className="mt-3 flex-1 text-xs leading-5 text-muted">{p.description}</p>

      {/* Difficulty dots */}
      <div className="mt-4 flex items-center gap-2">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted">Difficulty</p>
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < p.difficulty ? "bg-fg/70" : "bg-fg/15"}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

function RecruiterPersonasSection() {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? RECRUITER_PERSONAS : RECRUITER_PERSONAS.slice(0, 4);
  const hidden = RECRUITER_PERSONAS.length - 4;

  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <SectionLabel>Meet your interviewers</SectionLabel>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-3xl">
            11 AI recruiters. Each one built to expose something different.
          </h2>
          <p className="mt-4 text-lg leading-8 text-muted">
            Every recruiter has a distinct style, pressure level, and way of exposing weak answers.
            Practice across all 11 before the real interview.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {visible.map((p) => (
            <RecruiterCard key={p.name} p={p} />
          ))}
        </div>

        {!expanded && (
          <div className="mt-6 flex flex-col items-center gap-3">
            {/* Peek row — avatar stack of hidden personas */}
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {RECRUITER_PERSONAS.slice(4).map((p) => (
                  p.image ? (
                    <img
                      key={p.name}
                      src={p.image}
                      alt={p.name}
                      className="h-7 w-7 rounded-full ring-2 ring-canvas"
                    />
                  ) : (
                    <span
                      key={p.name}
                      className="grid h-7 w-7 place-items-center rounded-full bg-fg/[0.07] text-sm ring-2 ring-canvas"
                    >
                      {p.emoji}
                    </span>
                  )
                ))}
              </div>
              <span className="text-sm text-muted">+{hidden} more recruiters unlocked with Premium &amp; Pro</span>
            </div>
            <button
              onClick={() => setExpanded(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-canvas-soft px-5 py-2.5 text-sm font-black text-fg transition hover:bg-fg/[0.06]"
            >
              See all 11 recruiters
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        )}

        {expanded && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => setExpanded(false)}
              className="inline-flex items-center gap-2 text-sm font-black text-muted transition hover:text-fg"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              </svg>
              Show less
            </button>
          </div>
        )}

        <p className="mt-8 text-center text-sm text-muted">
          Free personas available on all plans · Premium personas on Premium · Pro personas on Premium Pro
        </p>
      </div>
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-black uppercase tracking-[0.20em] text-muted">{children}</p>;
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
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 700);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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
        {/* Cinematic glow: deep blue spotlight from above, fades to nothing */}
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

              {/* Invisible bridge prevents hover gap between button and menu */}
              <div className="absolute left-0 top-full h-3 w-full" />
              <div className="invisible absolute left-0 top-full z-50 mt-1 w-72 translate-y-1 rounded-lg border border-line bg-canvas/95 p-3 opacity-0 shadow-2xl shadow-black/30 backdrop-blur-xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
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
                    className="block rounded-xl px-3 py-2.5 transition hover:bg-fg/10 cursor-pointer"
                  >
                    <span className="block text-sm font-black text-fg">{title}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted">{text}</span>
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
                For Education
                <ChevronDown className="h-4 w-4" />
              </button>

              {/* Invisible bridge prevents hover gap between button and menu */}
              <div className="absolute left-1/2 top-full h-3 w-[760px] -translate-x-1/2" />
              <div className="invisible absolute left-1/2 top-full z-50 mt-1 w-[760px] -translate-x-1/2 translate-y-1 rounded-2xl border border-line bg-canvas/95 p-6 opacity-0 shadow-2xl shadow-black/30 backdrop-blur-xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    ["Overview", "/for-education", "See how WorkZo AI improves interview readiness for groups and cohorts."],
                    ["Coding Bootcamps", "/for-education/coding-bootcamps", "Prepare graduates for technical interviews, HR screens, and hiring days."],
                    ["Universities & Career Services", "/for-education/universities-career-services", "Help students build interview confidence before internships and graduate roles."],
                    ["Training Academies", "/for-education/training-academies", "Support learners across certification, reskilling, and career programs."],
                    ["Enterprise Hiring", "/for-education/enterprise-hiring", "Standardize interview preparation for internal mobility and talent programs."],
                    ["Recruitment Agencies", "/for-education/recruitment-agencies", "Help candidates practice before client interviews and final submissions."],
                    ["Admin Dashboard", "/for-education/admin-dashboard", "Track engagement, usage, readiness trends, and progress across groups."],
                    ["Security & Privacy", "/for-education/security-privacy", "Review GDPR-friendly data handling, privacy controls, and enterprise readiness."],
                  ].map(([title, href, text]) => (
                    <Link
                      key={title}
                      href={href}
                      className="group/item grid grid-cols-[56px_1fr] gap-4 rounded-xl p-3 transition hover:bg-fg/10"
                    >
                      <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand/10 text-brand transition group-hover/item:bg-brand group-hover/item:text-on-brand">
                        <UserRound className="h-5 w-5" />
                      </span>
                      <span>
                        <span className="flex items-center gap-2 text-sm font-black text-fg">
                          {title} <ArrowRight className="h-4 w-4 transition group-hover/item:translate-x-1" />
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-muted">{text}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="group relative">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 transition hover:text-fg"
              >
                Resources
                <ChevronDown className="h-4 w-4" />
              </button>

              {/* Invisible bridge prevents hover gap */}
              <div className="absolute left-0 top-full h-3 w-full" />
              <div className="invisible absolute left-0 top-full z-50 mt-1 w-72 translate-y-1 rounded-lg border border-line bg-canvas/95 p-3 opacity-0 shadow-2xl shadow-black/30 backdrop-blur-xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
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
                    <span className="mt-0.5 block text-xs leading-5 text-muted">{text}</span>
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
              WorkZo reads the CV, the role, and the company. Then it asks the exact questions a recruiter would, with follow-ups, pressure, and a live trust score that shows exactly where the interview turned.
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
              ["11", "recruiter personas"],
              ["15", "supported languages"],
              ["3", "plan tiers"],
              ["Free", "to try, no card needed"],
            ].map(([number, label]) => (
              <div key={label} className="rounded-lg border border-line bg-canvas-soft p-6 text-center backdrop-blur-sm">
                <p className="text-4xl font-black text-fg">{number}</p>
                <p className="mt-1 text-sm text-muted">{label}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-muted">
            Built to show what recruiters notice, and what candidates never see coming.
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
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted">Candidate Answer</p>
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
              <p className="mb-4 text-sm font-black uppercase tracking-[0.18em] text-muted">{card.title}</p>
              <div className="space-y-3">
                <div className="rounded-xl bg-fg/[0.05] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted">Candidate</p>
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

        <p className="mx-auto mt-8 max-w-xl text-center text-sm leading-7 text-muted">
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
              {/* Left: Trust Score + Timeline */}
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full border-[8px] border-brand/50 bg-brand/10">
                    <p className="text-4xl font-black">71</p>
                  </div>
                  <div>
                    <p className="text-sm font-black text-fg">Recruiter Trust Score</p>
                    <p className="mt-0.5 text-xs text-muted">/ 100</p>
                  </div>
                </div>

                <div className="rounded-lg border border-line bg-fg/[0.03] p-4">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-muted">
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
                        <p className="w-5 shrink-0 text-[11px] text-muted">{q}</p>
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

              {/* Right: Weakest Answer, Recruiter Thoughts, Improvement Plan */}
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
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-muted">
                    Recruiter Thoughts
                  </p>
                  <p className="text-sm text-muted">Candidate sounds experienced.</p>
                  <p className="mt-1 text-sm text-muted">Evidence is missing.</p>
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
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted">Feature</p>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brand">WorkZo AI</p>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted">Typical Apps</p>
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
      <section className="px-4 py-20 sm:px-6 lg:px-8" id="pricing">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <SectionLabel>Pricing</SectionLabel>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-3xl">
              Choose the interview preparation plan that fits your career journey.
            </h2>
            <p className="mt-4 text-base leading-7 text-muted">
              Free helps you try WorkZo. Premium is for daily audio practice. Pro adds video and coaching. Enterprise scales interview readiness for cohorts.
            </p>
          </div>

          <div className="mt-10 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                badge: "Free forever",
                tier: "Free",
                title: "Try WorkZo",
                price: localizedPlans.free.amount,
                suffix: "",
                text: "Perfect for trying one realistic AI interview before committing.",
                features: ["1 complete AI voice interview", "CV-aware recruiter questions", "Basic interview report", "Basic STAR scorecard", "Standard recruiter personas"],
                cta: "Get Started",
                href: "/onboarding",
                featured: false,
              },
              {
                badge: "Most popular",
                tier: "Premium",
                title: "Practice Daily",
                price: localizedPlans.premium.amount,
                regular: localizedPlans.premium.regular,
                suffix: "/month",
                text: "For active job seekers who want daily interview practice and full application tools.",
                features: ["120 AI voice minutes / month (top-ups available)", "Unlimited Resume / CV optimization", "Unlimited ATS analysis", "Unlimited cover letters", "Basic progress tracking", "All languages"],
                cta: "Upgrade Now",
                href: "/pricing?plan=premium",
                featured: true,
              },
              {
                badge: "Best for serious candidates",
                tier: "Premium Pro",
                title: "Master Interviews",
                price: localizedPlans.premiumPro.amount,
                regular: localizedPlans.premiumPro.regular,
                suffix: "/month",
                text: "For high-stakes interviews where face-to-face delivery and coaching matter.",
                features: ["240 AI voice minutes / month (top-ups available)", "60 AI video minutes / month (early access)", "Detailed interview feedback", "Advanced performance analysis", "Multi-session interview history", "AI improvement suggestions"],
                cta: "Go Pro",
                href: "/pricing?plan=premium_pro",
                featured: false,
              },
              {
                badge: "Institutional",
                tier: "Enterprise & Education",
                title: "Train Cohorts",
                price: "Custom",
                suffix: "/annual",
                text: "For universities, bootcamps, and hiring teams managing interview readiness at scale.",
                features: ["Shared voice & video minute pools", "Custom recruiter personas", "Team management", "Dedicated onboarding", "Priority support", "Volume pricing"],
                cta: "Request Demo",
                href: "mailto:support@workzoai.com?subject=WorkZo%20AI%20Enterprise%20%2F%20Education%20Demo%20Request",
                featured: false,
                enterprise: true,
              },
            ].map((plan) => (
              <div
                key={plan.tier}
                id={plan.enterprise ? "enterprise" : undefined}
                className={`flex flex-col rounded-xl border p-6 ${
                  plan.featured
                    ? "border-2 border-brand/50 bg-canvas shadow-xl shadow-brand/10"
                    : plan.enterprise
                      ? "border-fg/25 bg-fg/[0.05]"
                      : "border-line bg-fg/[0.03]"
                }`}
              >
                <div className="mb-5 h-6">
                  <span className={`inline-flex items-center rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] ${
                    plan.featured ? "bg-brand/20 text-brand" : "border border-line bg-fg/5 text-muted"
                  }`}>
                    {plan.badge}
                  </span>
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted">{plan.tier}</p>
                <h3 className="mt-1.5 text-lg font-black leading-snug text-fg">{plan.title}</h3>
                <div className="mt-4 flex flex-wrap items-baseline gap-2">
                  {plan.regular ? <span className="text-sm font-black text-subtle line-through decoration-2">{plan.regular}</span> : null}
                  <span className="text-4xl font-black text-fg sm:text-3xl">{plan.price}</span>
                  {plan.suffix ? <span className="text-base text-muted">{plan.suffix}</span> : null}
                </div>
                <p className="mt-3 text-sm leading-6 text-muted">{plan.text}</p>
                {plan.featured ? <p className="mt-2 text-xs font-black text-success">24-hour free trial · cancel anytime before charged</p> : null}
                <div className="my-5 h-px bg-fg/[0.07]" />
                <div className="flex-1 space-y-2.5">
                  {plan.features.map((item) => (
                    <div key={item} className="flex items-start gap-2.5">
                      <CheckCircle2 className="mt-0.5 h-[15px] w-[15px] shrink-0 text-brand" />
                      <span className="text-sm leading-[1.45] text-fg">{item}</span>
                    </div>
                  ))}
                </div>
                <Link
                  href={plan.href}
                  className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-black transition ${
                    plan.featured
                      ? "bg-brand text-on-brand hover:bg-brand"
                      : plan.enterprise
                        ? "border-2 border-fg/30 bg-transparent text-fg hover:border-fg hover:bg-fg/5"
                        : "border border-line bg-fg/10 text-fg hover:bg-fg/20"
                  }`}
                >
                  {plan.cta} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>

          <p className="mx-auto mt-10 max-w-3xl text-center text-sm font-bold text-fg/80">
            Every plan: interview questions are generated from <span className="text-fg">your CV and the actual job description</span>, never generic question banks.
          </p>

          <div className="mx-auto mt-6 flex max-w-4xl flex-wrap items-center justify-center gap-x-7 gap-y-3 text-xs font-bold text-muted">
            <span>✓ Cancel anytime</span>
            <span>✓ Secure payments</span>
            <span>✓ GDPR-friendly</span>
            <span>✓ No CV data sold</span>
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
              ["Is WorkZo just another question bank?", "No. The recruiter reacts to exactly what was said. Follow-up questions, pushback, and trust scores change based on each answer. There are no preset scripts."],
              ["How realistic are the recruiters?", "Each persona is built on real hiring patterns. German recruiters probe timelines and scope. US recruiters want ownership and metrics. The pressure is not random. It follows a logic."],
              ["What does the trust score actually measure?", "Recruiter confidence, updated after each answer. A drop means something was vague, ownership was unclear, or a claim went unproven. The timeline shows exactly which answer caused it."],
              ["Does it read my actual CV?", "Yes. Upload or paste a CV and the recruiter asks about the specific roles, gaps, and claims in it. Generic prep tools cannot do that."],
              ["What does the report show?", "Trust score per question, the exact moment confidence dropped, the follow-up that would have come next, and a specific improvement plan, not general tips."],
              ["Which languages work?", "English, German, Dutch, French, Spanish, Italian, Portuguese, Chinese, Hindi, Arabic, Japanese, Korean, Polish, Russian, and Turkish. The recruiter speaks in the selected language, not just the interface."],
            ].map(([question, answer]) => (
              <FaqItem key={question} question={question} answer={answer} />
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Request a demo"
          title="Bring WorkZo AI to your team or cohort"
          intro="Running interview prep for a bootcamp, university, or hiring team? Tell us your cohort size and goals — we reply within one business day and shape a pilot around you."
        />
        <div className="mt-8">
          <B2BLeadForm source="landing" />
        </div>
      </section>

      <WorkZoFooter />

      <button
        type="button"
        aria-label="Back to top"
        onClick={scrollToTop}
        className={`fixed bottom-6 right-6 z-[60] grid h-12 w-12 place-items-center rounded-full border border-line bg-brand text-on-brand shadow-2xl shadow-black/25 transition hover:bg-brand-strong ${
          showBackToTop ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
        }`}
      >
        <ArrowUp className="h-5 w-5" />
      </button>
    </main>
  );
}
