"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  BrainCircuit,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Crown,
  FileText,
  History,
  Home,
  Lock,
  Mail,
  Menu,
  Mic,
  PlayCircle,
  Rocket,
  Settings,
  Sparkles,
  Star,
  TrendingUp,
  UserRound,
  Video,
  X,
} from "lucide-react";
import WorkOBotFloating from "@/components/WorkOBotFloating";
import WorkZoPremiumProSuitePanel from "@/components/premium/WorkZoPremiumProSuitePanel";
import {
  WORKZO_PLAN_LIMITS,
  canUseWorkZoFeature,
  getWorkZoPlanLimits,
  type WorkZoPlanType,
} from "@/lib/workzoPlanLimits";
import { getWorkZoUsageSummary } from "@/lib/workzoUsageTracker";
import { useWorkZoAuthoritativePlan } from "@/lib/workzoClientPlan";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function planTone(plan: WorkZoPlanType) {
  if (plan === "premium_pro") return "border-violet-300/25 bg-violet-500/10 text-violet-100";
  if (plan === "premium") return "border-blue-300/25 bg-blue-500/10 text-blue-100";
  return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
}

type DashboardActionCard = {
  title: string;
  detail: string;
  href: string;
  icon: typeof Mic;
  cta: string;
  accent: string;
  locked?: boolean;
  requiredPlan?: WorkZoPlanType;
};

const baseNav = [
  { label: "Dashboard", href: "/dashboard", icon: Home, feature: "voice_interview" as const },
  { label: "Start Interview", href: "/interview", icon: Mic, feature: "voice_interview" as const },
  { label: "Results", href: "/results", icon: BarChart3, feature: "basic_reports" as const },
  { label: "History", href: "/history", icon: History, feature: "interview_history" as const },
  { label: "Improve CV", href: "/cv", icon: FileText, feature: "improve_cv" as const },
  { label: "Cover Letter", href: "/cover-letter", icon: Mail, feature: "cover_letter" as const },
  { label: "Job Assist", href: "/jobs", icon: Briefcase, feature: "job_assist" as const },
  { label: "Work-O-Bot", href: "/copilot", icon: BrainCircuit, feature: "career_brain" as const },
  { label: "Features", href: "/features/interview-practice", icon: BookOpen, feature: "voice_interview" as const },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, feature: "voice_interview" as const },
];

// ── Per-plan action cards ─────────────────────────────────────────────────────
const FREE_ACTIONS: DashboardActionCard[] = [
  { title: "Start free interview", detail: "2 interviews/month · browser voice · AI recruiter", href: "/interview", icon: Mic, cta: "Start now", accent: "blue" },
  { title: "View your results", detail: "Basic score, weakest answer, and improvement tips", href: "/results", icon: BarChart3, cta: "See report", accent: "slate" },
  { title: "Improve CV", detail: "ATS keywords, gap analysis, and formatting advice", href: "/cv", icon: FileText, cta: "Unlock in Premium", accent: "locked", locked: true, requiredPlan: "premium" as WorkZoPlanType },
  { title: "Cover Letter", detail: "Role-specific letter from your CV and job description", href: "/cover-letter", icon: Mail, cta: "Unlock in Premium", accent: "locked", locked: true, requiredPlan: "premium" as WorkZoPlanType },
  { title: "Job Assist", detail: "AI fit score, role gaps, and 7 likely interview questions", href: "/jobs", icon: Briefcase, cta: "Unlock in Premium", accent: "locked", locked: true, requiredPlan: "premium" as WorkZoPlanType },
];

const PREMIUM_ACTIONS: DashboardActionCard[] = [
  { title: "Start interview", detail: "50 interviews/month · advanced recruiter intelligence", href: "/interview", icon: Mic, cta: "Start interview", accent: "blue" },
  { title: "Improve your CV", detail: "ATS keyword gap · matched, partial, missing chips · score", href: "/cv", icon: FileText, cta: "Open CV tools", accent: "emerald" },
  { title: "Cover Letter", detail: "AI-generated from your CV + job description", href: "/cover-letter", icon: Mail, cta: "Generate letter", accent: "violet" },
  { title: "Job Assist", detail: "Fit score, gaps, and 7 likely questions per role", href: "/jobs", icon: Briefcase, cta: "Browse jobs", accent: "amber" },
  { title: "Interview history", detail: "Last 50 sessions with recruiter scores and trends", href: "/history", icon: History, cta: "View history", accent: "slate" },
  { title: "Results report", detail: "Trust timeline, contradictions, and improvement roadmap", href: "/results", icon: BarChart3, cta: "View results", accent: "cyan" },
];

const PRO_ACTIONS: DashboardActionCard[] = [
  { title: "Start Pro interview", detail: "Unlimited · Vapi AI voice · premium recruiter personas", href: "/interview?mode=pro", icon: Mic, cta: "Start interview", accent: "violet" },
  { title: "Live AI Recruiter", detail: "60 min/month · face-to-face video · Tavus-powered", href: "/onboarding?mode=tavus", icon: Video, cta: "Start video session", accent: "violet" },
  { title: "Improve CV", detail: "ATS keyword gap, scoring, and job-specific targeting", href: "/cv", icon: FileText, cta: "Open CV tools", accent: "emerald" },
  { title: "Cover Letter", detail: "AI-generated, CV-aware, role-specific in seconds", href: "/cover-letter", icon: Mail, cta: "Generate letter", accent: "cyan" },
  { title: "Job Assist", detail: "Fit score, gaps, likely questions — per job listing", href: "/jobs", icon: Briefcase, cta: "Browse jobs", accent: "amber" },
  { title: "Interview history", detail: "Unlimited sessions · cross-session pattern tracking", href: "/history", icon: History, cta: "View history", accent: "slate" },
];

const ACCENT_STYLES: Record<string, string> = {
  blue: "border-blue-400/30 bg-blue-500/10 text-blue-200",
  emerald: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  violet: "border-violet-400/30 bg-violet-500/10 text-violet-200",
  amber: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  cyan: "border-cyan-400/30 bg-cyan-500/10 text-cyan-200",
  slate: "border-white/10 bg-white/[0.04] text-slate-300",
  locked: "border-white/[0.06] bg-white/[0.02] text-slate-500",
};

const ICON_ACCENT: Record<string, string> = {
  blue: "bg-blue-500/15 text-blue-200",
  emerald: "bg-emerald-500/15 text-emerald-200",
  violet: "bg-violet-500/15 text-violet-200",
  amber: "bg-amber-500/15 text-amber-200",
  cyan: "bg-cyan-500/15 text-cyan-200",
  slate: "bg-white/[0.07] text-slate-300",
  locked: "bg-white/[0.04] text-slate-600",
};

// ── What each plan includes — shown per-plan, not generic ─────────────────────
const PLAN_INCLUDES = {
  free: [
    { label: "2 voice interviews / month", ok: true },
    { label: "AI recruiter intelligence", ok: true },
    { label: "Basic score and improvement tips", ok: true },
    { label: "Limited interview history", ok: true },
    { label: "Improve CV, Cover Letter, Job Assist", ok: false },
    { label: "Advanced reports and trust timeline", ok: false },
    { label: "Career Brain cross-session memory", ok: false },
  ],
  premium: [
    { label: "50 voice interviews / month", ok: true },
    { label: "Full advanced interview reports", ok: true },
    { label: "Improve CV + ATS keyword analysis", ok: true },
    { label: "AI Cover Letter generator", ok: true },
    { label: "Job Assist with fit scores + questions", ok: true },
    { label: "Career Brain cross-session memory", ok: true },
    { label: "Interview history (50 sessions)", ok: true },
    { label: "Live AI Recruiter (video)", ok: false },
    { label: "AI Career Coach + roadmaps", ok: false },
  ],
  premium_pro: [
    { label: "Unlimited voice interviews", ok: true },
    { label: "60 Live AI Recruiter minutes / month", ok: true },
    { label: "7 premium recruiter personas", ok: true },
    { label: "AI Career Coach — weekly priorities", ok: true },
    { label: "30 / 60 / 90 day career roadmaps", ok: true },
    { label: "Replay Intelligence", ok: true },
    { label: "All Premium features included", ok: true },
  ],
};

export default function DashboardPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const planState = useWorkZoAuthoritativePlan();
  const plan = planState.plan;

  useEffect(() => {
    setMounted(!planState.loading);
  }, [planState.loading]);

  const limits = getWorkZoPlanLimits(plan);
  const usage = mounted ? getWorkZoUsageSummary(plan) : null;

  const dashboardMode = useMemo(() => {
    if (plan === "premium_pro") return {
      eyebrow: "Premium Pro · Career growth platform",
      title: "Your personal AI career coach is active",
      subtitle: "Unlimited voice interviews, 60 Live AI Recruiter minutes, premium personas, AI coaching priorities, 30/60/90 day roadmaps, and replay intelligence.",
      cta: "Start Pro Interview",
      ctaHref: "/interview?mode=pro",
      Icon: Star,
      color: "violet" as const,
    };
    if (plan === "premium") return {
      eyebrow: "Premium · Complete preparation",
      title: "Everything you need to prepare and apply",
      subtitle: "50 voice interviews, CV improvement, Cover Letter, Job Assist, Career Brain, ATS optimization, advanced reports, and performance tracking.",
      cta: "Start Interview",
      ctaHref: "/interview",
      Icon: Crown,
      color: "blue" as const,
    };
    return {
      eyebrow: "Free plan",
      title: "Try your first recruiter-style interview",
      subtitle: "2 voice interviews per month with AI recruiter intelligence, realistic follow-ups, and a basic interview report.",
      cta: "Start Free Interview",
      ctaHref: "/interview",
      Icon: Rocket,
      color: "emerald" as const,
    };
  }, [plan]);

  const actionCards = plan === "premium_pro" ? PRO_ACTIONS : plan === "premium" ? PREMIUM_ACTIONS : FREE_ACTIONS;
  const planIncludes = PLAN_INCLUDES[plan];

  // Interviews used / remaining display
  const interviewsUsed = usage?.usage.interviewsStarted ?? 0;
  const interviewsTotal = limits.unlimitedVoiceInterviews ? "∞" : String(limits.voiceInterviewsPerMonth);
  const tavusUsed = usage?.tavusMinutesUsed ?? 0;
  const tavusTotal = limits.tavusMinutesPerMonth;

  return (
    <main className="min-h-screen bg-[#050a12] text-white">
      {mounted && plan !== "free" && <WorkOBotFloating />}

      {/* Mobile menu toggle */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 grid h-11 w-11 place-items-center rounded-lg border border-white/10 bg-[#07111f]/90 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Sidebar — desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-[260px] flex-col border-r border-white/10 bg-[#07111f]/95 p-5 lg:flex">
        <Sidebar plan={plan} mounted={mounted} />
      </aside>

      {/* Sidebar — mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="h-full w-[280px] bg-[#07111f] p-5" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setMobileOpen(false)} className="mb-4 grid h-10 w-10 place-items-center rounded-xl border border-white/10">
              <X className="h-5 w-5" />
            </button>
            <Sidebar plan={plan} mounted={mounted} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="px-5 pb-16 pt-20 lg:ml-[260px] lg:px-8 lg:pt-8">

        {/* ── Header ── */}
        <header className="flex flex-col gap-5 border-b border-white/10 pb-7 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em]", planTone(plan))}>
              <dashboardMode.Icon className="h-3.5 w-3.5" />
              {dashboardMode.eyebrow}
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-[-0.03em] sm:text-4xl">{dashboardMode.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{dashboardMode.subtitle}</p>
          </div>
          <Link
            href={dashboardMode.ctaHref}
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-black transition hover:scale-[1.02]",
              plan === "premium_pro" ? "bg-violet-500 text-white shadow-lg shadow-violet-500/20 hover:bg-violet-400"
              : plan === "premium" ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-400"
              : "bg-white text-slate-950 hover:bg-blue-50"
            )}
          >
            {dashboardMode.cta}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </header>

        {/* ── Usage metrics ── */}
        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          {/* Interviews */}
          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-5">
            <div className="flex items-start justify-between">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/15">
                <Mic className="h-5 w-5 text-blue-300" />
              </div>
              <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]", planTone(plan))}>
                {WORKZO_PLAN_LIMITS[plan].label}
              </span>
            </div>
            <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Voice interviews</p>
            <p className="mt-1.5 text-3xl font-black text-white">{interviewsUsed}<span className="text-lg text-slate-500">/{interviewsTotal}</span></p>
            <p className="mt-1 text-sm text-slate-400">
              {limits.unlimitedVoiceInterviews ? "Unlimited this month" : `${Math.max(0, limits.voiceInterviewsPerMonth - interviewsUsed)} remaining this month`}
            </p>
            {!limits.unlimitedVoiceInterviews && (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${Math.min(100, (interviewsUsed / limits.voiceInterviewsPerMonth) * 100)}%` }}
                />
              </div>
            )}
          </div>

          {/* Live AI Recruiter / Tavus */}
          <div className={cn("rounded-xl border p-5", limits.tavus ? "border-violet-300/20 bg-violet-500/[0.06]" : plan === "premium" ? "border-violet-300/15 bg-violet-500/[0.04]" : "border-white/10 bg-white/[0.035]")}>
            <div className="flex items-start justify-between">
              <div className={cn("grid h-10 w-10 place-items-center rounded-xl", limits.tavus ? "bg-violet-500/15" : plan === "premium" ? "bg-violet-500/10" : "bg-white/[0.05]")}>
                <Video className={cn("h-5 w-5", limits.tavus ? "text-violet-300" : plan === "premium" ? "text-violet-400/60" : "text-slate-600")} />
              </div>
              {!limits.tavus && plan === "premium" && <span className="rounded-full border border-violet-300/20 bg-violet-500/10 px-2 py-0.5 text-[10px] font-black text-violet-300">Pro only</span>}
              {!limits.tavus && plan === "free" && <Lock className="h-4 w-4 text-slate-600" />}
            </div>
            <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Live AI Recruiter</p>
            {limits.tavus ? (
              <>
                <p className="mt-1.5 text-3xl font-black text-white">{tavusUsed}<span className="text-lg text-slate-500">/{tavusTotal} min</span></p>
                <p className="mt-1 text-sm text-slate-400">{Math.max(0, tavusTotal - tavusUsed)} minutes remaining</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                  <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${Math.min(100, (tavusUsed / tavusTotal) * 100)}%` }} />
                </div>
              </>
            ) : plan === "premium" ? (
              <>
                <p className="mt-1.5 text-xl font-black text-violet-300/70">Face-to-face AI interviews</p>
                <p className="mt-1 text-sm text-slate-500">60 min/month with Premium Pro</p>
                <Link href="/pricing?plan=premium_pro" className="mt-3 inline-flex items-center gap-1 text-xs font-black text-violet-300 hover:text-violet-200">
                  Upgrade to Pro to unlock <ChevronRight className="h-3 w-3" />
                </Link>
              </>
            ) : (
              <>
                <p className="mt-1.5 text-xl font-black text-slate-500">Locked</p>
                <p className="mt-1 text-sm text-slate-500">Premium Pro only</p>
                <Link href="/pricing?plan=premium_pro" className="mt-3 inline-flex items-center gap-1 text-xs font-black text-violet-300 hover:text-violet-200">
                  Upgrade to unlock <ChevronRight className="h-3 w-3" />
                </Link>
              </>
            )}
          </div>

          {/* Career support level */}
          <div className={cn(
            "rounded-xl border p-5",
            limits.careerCoach ? "border-violet-300/20 bg-violet-500/[0.06]"
            : limits.careerBrain ? "border-emerald-300/15 bg-emerald-500/[0.04]"
            : "border-white/10 bg-white/[0.035]"
          )}>
            <div className={cn(
              "grid h-10 w-10 place-items-center rounded-xl",
              limits.careerCoach ? "bg-violet-500/15" : limits.careerBrain ? "bg-emerald-500/15" : "bg-white/[0.05]"
            )}>
              <BrainCircuit className={cn(
                "h-5 w-5",
                limits.careerCoach ? "text-violet-300" : limits.careerBrain ? "text-emerald-300" : "text-slate-600"
              )} />
            </div>
            <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Career support</p>
            <p className={cn(
              "mt-1.5 text-xl font-black",
              limits.careerCoach ? "text-violet-100" : limits.careerBrain ? "text-emerald-100" : "text-slate-400"
            )}>
              {limits.careerCoach ? "AI Coach + Roadmaps" : limits.careerBrain ? "Career Brain active" : "Interview trial"}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {limits.careerCoach ? "Priorities, roadmaps, replay" : limits.careerBrain ? "Cross-session memory" : "Basic report included"}
            </p>
            {!limits.careerBrain && (
              <Link href="/pricing?plan=premium" className="mt-3 inline-flex items-center gap-1 text-xs font-black text-blue-300 hover:text-blue-200">
                Unlock with Premium <ChevronRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </section>

        {/* ── Upgrade nudge — only for non-Pro ── */}
        {plan !== "premium_pro" && (
          <section className={cn(
            "mt-5 rounded-xl border p-5",
            plan === "free" ? "border-blue-300/20 bg-blue-500/[0.07]" : "border-violet-300/20 bg-violet-500/[0.07]"
          )}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className={cn("text-xs font-black uppercase tracking-[0.22em]", plan === "free" ? "text-blue-200" : "text-violet-200")}>
                  {plan === "free" ? "Upgrade to Premium" : "Upgrade to Premium Pro"}
                </p>
                <h2 className="mt-1 text-lg font-black text-white">
                  {plan === "free"
                    ? "Unlock CV tools, Cover Letter, Job Assist, and 50 interviews"
                    : "Unlock AI Career Coach, Live AI Recruiter, and premium personas"}
                </h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(plan === "free"
                    ? ["50 interviews/month", "CV improvement", "Cover Letter", "Job Assist", "Career Brain"]
                    : ["Unlimited interviews", "60 Live AI Recruiter min", "7 Pro personas", "AI Career Coach", "Career roadmaps"]
                  ).map((item) => (
                    <span key={item} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-bold text-slate-300">
                      <Sparkles className={cn("h-3 w-3", plan === "free" ? "text-blue-300" : "text-violet-300")} />{item}
                    </span>
                  ))}
                </div>
              </div>
              <Link
                href={plan === "free" ? "/pricing?plan=premium" : "/pricing?plan=premium_pro"}
                className={cn(
                  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-black text-white",
                  plan === "free" ? "bg-blue-500 hover:bg-blue-400" : "bg-violet-500 hover:bg-violet-400"
                )}
              >
                View plans <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        )}

        {/* ── Action cards — plan-specific, all clickable ── */}
        <section className="mt-7">
          <div className="mb-4 flex items-center gap-3">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Your tools</p>
            {plan === "premium_pro" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-300/25 bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-black text-violet-300">
                <Star className="h-3 w-3" /> Pro
              </span>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {actionCards.map((card) => {
              const Icon = card.icon;
              const isLocked = "locked" in card && card.locked;
              const accentKey = card.accent;
              // Pro-exclusive cards (first 2 in PRO_ACTIONS)
              const isProExclusive = plan === "premium_pro" && (card.title === "Start Pro interview" || card.title === "Live AI Recruiter");

              return isLocked ? (
                <Link
                  key={card.title}
                  href={`/pricing?plan=${card.requiredPlan ?? "premium"}`}
                  className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition hover:bg-white/[0.04]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/[0.04] text-slate-600">
                      <Icon className="h-5 w-5" />
                    </div>
                    <Lock className="h-4 w-4 text-slate-600" />
                  </div>
                  <h3 className="mt-4 text-base font-black text-slate-500">{card.title}</h3>
                  <p className="mt-1.5 text-sm leading-5 text-slate-600">{card.detail}</p>
                  <p className="mt-3 text-xs font-black text-blue-400 group-hover:text-blue-300">
                    {card.cta} →
                  </p>
                </Link>
              ) : (
                <Link
                  key={card.title}
                  href={card.href}
                  className={cn(
                    "group rounded-xl border p-5 transition hover:scale-[1.01]",
                    isProExclusive
                      ? "border-violet-400/40 bg-violet-500/[0.08] text-violet-200 shadow-sm shadow-violet-500/10"
                      : ACCENT_STYLES[accentKey] || ACCENT_STYLES.slate
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className={cn(
                      "grid h-11 w-11 place-items-center rounded-xl",
                      isProExclusive ? "bg-violet-500/20 text-violet-200" : ICON_ACCENT[accentKey] || ICON_ACCENT.slate
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex items-center gap-2">
                      {isProExclusive && (
                        <span className="rounded-full border border-violet-300/30 bg-violet-500/15 px-2 py-0.5 text-[10px] font-black text-violet-300">PRO</span>
                      )}
                      <ArrowRight className="h-4 w-4 opacity-40 transition group-hover:opacity-100" />
                    </div>
                  </div>
                  <h3 className="mt-4 text-base font-black text-white">{card.title}</h3>
                  <p className="mt-1.5 text-sm leading-5 text-slate-400">{card.detail}</p>
                  <p className="mt-3 text-xs font-black opacity-60 group-hover:opacity-100">
                    {card.cta} →
                  </p>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ── Plan includes — what you have right now ── */}
        <section className="mt-8 grid gap-5 lg:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">What your plan includes</p>
            <h2 className="mt-2 text-xl font-black">
              {plan === "premium_pro" ? "Premium Pro features" : plan === "premium" ? "Premium features" : "Free plan features"}
            </h2>
            <div className="mt-5 space-y-2.5">
              {planIncludes.map((item) => (
                <div key={item.label} className="flex items-center gap-3 text-sm">
                  {item.ok
                    ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    : <Lock className="h-4 w-4 shrink-0 text-slate-600" />
                  }
                  <span className={item.ok ? "text-slate-200" : "text-slate-600"}>{item.label}</span>
                </div>
              ))}
            </div>
            {plan !== "premium_pro" && (
              <Link
                href={plan === "free" ? "/pricing?plan=premium" : "/pricing?plan=premium_pro"}
                className="mt-5 inline-flex items-center gap-2 text-sm font-black text-blue-300 hover:text-white"
              >
                {plan === "free" ? "Upgrade to Premium" : "Upgrade to Premium Pro"} <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>

          {/* Quick start guide or Pro tools */}
          {plan === "premium_pro" ? (
            <div className="rounded-xl border border-violet-300/20 bg-violet-500/[0.06] p-6">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-200">Premium Pro tools</p>
              <h2 className="mt-2 text-xl font-black">Career acceleration tools</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">These tools make Premium Pro a full career growth platform — not just interview practice.</p>
              <div className="mt-5 space-y-3">
                {[
                  { Icon: BrainCircuit, title: "AI Career Coach", detail: "Weekly priorities, biggest blocker, improvement focus", href: "/results#coach" },
                  { Icon: Video, title: "Live AI Recruiter", detail: "60 min/month · face-to-face video · Tavus-powered", href: "/onboarding?mode=tavus" },
                  { Icon: TrendingUp, title: "Career Roadmaps", detail: "30/60/90 day plans based on CV, goals, and patterns", href: "/results#roadmap" },
                  { Icon: PlayCircle, title: "Replay Intelligence", detail: "Best answer, weakest answer, trust drops, missed opportunities", href: "/results#replay" },
                ].map((tool) => (
                  <Link key={tool.title} href={tool.href} className="flex items-start gap-3 rounded-lg border border-white/[0.07] bg-black/20 p-3 transition hover:bg-white/[0.06]">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-200">
                      <tool.Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-white">{tool.title}</p>
                      <p className="mt-0.5 text-xs leading-5 text-slate-400">{tool.detail}</p>
                    </div>
                    <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-slate-600" />
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/[0.035] p-6">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Quick start</p>
              <h2 className="mt-2 text-xl font-black">How to get the most out of WorkZo</h2>
              <div className="mt-5 space-y-4">
                {[
                  { step: "1", label: "Upload your CV", detail: "WorkZo reads your real experience and asks role-specific follow-ups.", href: "/onboarding", icon: FileText },
                  { step: "2", label: "Run an interview", detail: "Answer as you would in a real interview. The recruiter will push back.", href: "/interview", icon: Mic },
                  { step: "3", label: "Review results", detail: "See trust timeline, weakest answer, and exactly what to fix.", href: "/results", icon: BarChart3 },
                  ...(plan === "premium"
                    ? [{ step: "4", label: "Improve your CV", detail: "Fix keyword gaps based on the job description you're targeting.", href: "/cv", icon: FileText }]
                    : [{ step: "4", label: "Upgrade for more", detail: "Premium unlocks 50 interviews, CV tools, Cover Letter, and Job Assist.", href: "/pricing?plan=premium", icon: Sparkles }]
                  ),
                ].map((step) => (
                  <Link key={step.step} href={step.href} className="flex items-start gap-4 rounded-lg border border-white/[0.07] bg-black/20 p-3 transition hover:bg-white/[0.06]">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-blue-500/15 text-xs font-black text-blue-200">
                      {step.step}
                    </div>
                    <div>
                      <p className="text-sm font-black text-white">{step.label}</p>
                      <p className="mt-0.5 text-xs leading-5 text-slate-400">{step.detail}</p>
                    </div>
                    <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-slate-600" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Premium Pro Suite Panel — AI Career Coach / Roadmap / Replay ── */}
        <section className="mt-8">
          <WorkZoPremiumProSuitePanel source="dashboard" />
        </section>

      </div>
    </main>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ plan, mounted }: { plan: WorkZoPlanType; mounted: boolean }) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Logo */}
      <Link href="/" className="flex shrink-0 items-center gap-3">
        <img src="/workzo_icon.png" alt="WorkZo AI" width={32} height={32} className="rounded-xl" />
        <div>
          <p className="text-sm font-black">WorkZo AI</p>
          <p className="text-xs text-slate-500">Career workspace</p>
        </div>
      </Link>

      {/* Plan badge */}
      <div className={cn("mt-4 shrink-0 rounded-xl border px-3 py-1.5 text-center text-xs font-black uppercase tracking-[0.16em]", planTone(plan))}>
        {mounted ? WORKZO_PLAN_LIMITS[plan].label : "Loading…"}
      </div>

      {/* Nav — scrollable if needed */}
      <nav className="mt-4 min-h-0 flex-1 overflow-y-auto space-y-0.5 pb-2" aria-label="Dashboard navigation">
        {baseNav.map((item) => {
          const Icon = item.icon;
          const allowed = canUseWorkZoFeature(plan, item.feature);
          return (
            <Link
              key={item.label}
              href={allowed ? item.href : `/pricing?intent=${item.feature}`}
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-bold transition",
                allowed ? "text-slate-300 hover:bg-white/[0.07] hover:text-white" : "text-slate-600 hover:bg-white/[0.04]"
              )}
            >
              <span className="flex items-center gap-3">
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </span>
              {!allowed && <Lock className="h-3.5 w-3.5 shrink-0 text-slate-700" />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section — always visible, never overlaps */}
      <div className="mt-2 shrink-0 space-y-2">
        {/* Plan upgrade CTA */}
        {plan !== "premium_pro" && (
          <Link
            href={plan === "free" ? "/pricing?plan=premium" : "/pricing?plan=premium_pro"}
            className={cn(
              "block rounded-xl border px-3 py-2.5 text-xs font-black transition",
              plan === "free"
                ? "border-blue-300/20 bg-blue-500/10 text-blue-200 hover:bg-blue-500/15"
                : "border-violet-300/20 bg-violet-500/10 text-violet-200 hover:bg-violet-500/15"
            )}
          >
            <p>{plan === "free" ? "Upgrade to Premium" : "Upgrade to Pro"}</p>
            <p className="mt-0.5 text-[10px] font-bold opacity-70">
              {plan === "free" ? "€19.99/mo · CV tools + 50 interviews" : "€39.99/mo · AI Coach + Live Recruiter"}
            </p>
          </Link>
        )}

        {/* Account card */}
        <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.07] text-slate-300">
              <UserRound className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black">Account</p>
              <Link href="/logout" className="text-[11px] font-bold text-slate-500 hover:text-white">Sign out</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
