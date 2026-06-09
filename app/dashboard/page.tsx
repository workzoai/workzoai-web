"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Briefcase,
  CheckCircle2,
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
import { WORKZO_PLAN_LIMITS, canUseWorkZoFeature, getWorkZoPlanLimits, normalizeWorkZoPlan, type WorkZoPlanType } from "@/lib/workzoPlanLimits";
import { getWorkZoCurrentPlan, getWorkZoUsageSummary } from "@/lib/workzoUsageTracker";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function planTone(plan: WorkZoPlanType) {
  if (plan === "premium_pro") return "border-violet-300/25 bg-violet-500/10 text-violet-100";
  if (plan === "premium") return "border-blue-300/25 bg-blue-500/10 text-blue-100";
  return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
}

function lockedHref(requiredPlan: WorkZoPlanType) {
  return `/pricing?intent=upgrade&plan=${requiredPlan}`;
}

const baseNav = [
  { label: "Dashboard", href: "/dashboard", icon: Home, feature: "voice_interview" as const },
  { label: "Real Interview AI", href: "/interview", icon: Mic, feature: "voice_interview" as const },
  { label: "Results", href: "/results", icon: BarChart3, feature: "basic_reports" as const },
  { label: "History", href: "/history", icon: History, feature: "interview_history" as const },
  { label: "Improve CV", href: "/cv", icon: FileText, feature: "improve_cv" as const },
  { label: "Cover Letter", href: "/cover-letter", icon: Mail, feature: "cover_letter" as const },
  { label: "Job Assist", href: "/jobs", icon: Briefcase, feature: "job_assist" as const },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, feature: "voice_interview" as const },
];

const proTools = [
  { title: "AI Career Coach", detail: "Personal coaching priorities from your history", icon: BrainCircuit, feature: "career_coach" as const },
  { title: "Live AI Recruiter", detail: "60 video recruiter minutes per month", icon: Video, feature: "video_recruiter" as const },
  { title: "Career Roadmaps", detail: "30 / 60 / 90 day improvement plans", icon: TrendingUp, feature: "career_roadmaps" as const },
  { title: "Replay Intelligence", detail: "Best moments, weak moments, and missed opportunities", icon: PlayCircle, feature: "replay_intelligence" as const },
];

export default function DashboardPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [botOpen, setBotOpen] = useState(false);
  const plan = typeof window !== "undefined" ? getWorkZoCurrentPlan() : "free";
  const normalizedPlan = normalizeWorkZoPlan(plan);
  const limits = getWorkZoPlanLimits(normalizedPlan);
  const usage = typeof window !== "undefined" ? getWorkZoUsageSummary(normalizedPlan) : null;

  const dashboardMode = useMemo(() => {
    if (normalizedPlan === "premium_pro") return {
      eyebrow: "Premium Pro active",
      title: "Full career support workspace",
      subtitle: "You have AI Career Coach, Live AI Recruiter minutes, premium personas, roadmaps, and replay intelligence unlocked.",
      cta: "Start Pro Interview",
      ctaHref: "/onboarding?mode=pro",
      Icon: Star,
    };
    if (normalizedPlan === "premium") return {
      eyebrow: "Premium active",
      title: "Complete interview and application preparation",
      subtitle: "You have 50 voice interviews, CV improvement, cover letters, Job Assist, Career Brain, and advanced reports unlocked.",
      cta: "Start Premium Interview",
      ctaHref: "/onboarding?mode=premium",
      Icon: Crown,
    };
    return {
      eyebrow: "Free plan active",
      title: "Try your first recruiter-style interview",
      subtitle: "Free includes limited voice interviews, recruiter intelligence, follow-ups, basic reports, and limited history.",
      cta: "Start Free Interview",
      ctaHref: "/onboarding?mode=free",
      Icon: Rocket,
    };
  }, [normalizedPlan]);

  const actionCards = [
    { title: "Start Interview", detail: normalizedPlan === "free" ? "Use one of your 2 free interviews" : normalizedPlan === "premium" ? "50 voice interviews per month" : "Unlimited voice interviews", href: "/onboarding", icon: Mic, feature: "voice_interview" as const, required: "free" as WorkZoPlanType },
    { title: "Improve CV", detail: "Target your CV to the job and fix weak evidence", href: "/cv", icon: FileText, feature: "improve_cv" as const, required: "premium" as WorkZoPlanType },
    { title: "Cover Letter", detail: "Generate a role-specific letter from CV + JD", href: "/cover-letter", icon: Mail, feature: "cover_letter" as const, required: "premium" as WorkZoPlanType },
    { title: "Job Assist", detail: "Analyze job fit, missing requirements, and likely questions", href: "/jobs", icon: Briefcase, feature: "job_assist" as const, required: "premium" as WorkZoPlanType },
  ];

  return (
    <main className="min-h-screen bg-[#050a12] text-white">
      <WorkOBotFloating />

      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-[#07111f]/90 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <aside className="fixed inset-y-0 left-0 hidden w-[260px] border-r border-white/10 bg-[#07111f]/95 p-5 lg:block">
        <Sidebar plan={normalizedPlan} />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 bg-black/70 lg:hidden">
          <div className="h-full w-[280px] bg-[#07111f] p-5">
            <button type="button" onClick={() => setMobileOpen(false)} className="mb-4 grid h-10 w-10 place-items-center rounded-xl border border-white/10">
              <X className="h-5 w-5" />
            </button>
            <Sidebar plan={normalizedPlan} />
          </div>
        </div>
      ) : null}

      <section className="px-5 pb-10 pt-20 lg:ml-[260px] lg:px-10 lg:pt-8">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-7 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em]", planTone(normalizedPlan))}>
              <dashboardMode.Icon className="h-3.5 w-3.5" />
              {dashboardMode.eyebrow}
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-[-0.04em] sm:text-4xl">Welcome back! 👋</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{dashboardMode.subtitle}</p>
          </div>
          <Link href={dashboardMode.ctaHref} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 hover:bg-blue-50">
            {dashboardMode.cta}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </header>

        <section className="mt-7 grid gap-4 md:grid-cols-3">
          <MetricCard label="Voice interviews" value={limits.unlimitedVoiceInterviews ? "Unlimited" : `${usage?.usage.interviewsStarted || 0}/${limits.voiceInterviewsPerMonth}`} detail={normalizedPlan === "premium_pro" ? "Premium Pro" : "This month"} />
          <MetricCard label="Video minutes" value={limits.tavus ? `${usage?.tavusMinutesUsed || 0}/${limits.tavusMinutesPerMonth}` : "Locked"} detail={limits.tavus ? "Live AI Recruiter" : "Premium Pro only"} />
          <MetricCard label="Career support" value={limits.careerCoach ? "Full" : limits.careerBrain ? "Advanced" : "Basic"} detail={limits.careerCoach ? "Coach + roadmap" : limits.careerBrain ? "Career Brain" : "Interview trial"} />
        </section>

        {normalizedPlan !== "premium_pro" ? (
          <section className="mt-5 rounded-[1.5rem] border border-blue-300/20 bg-blue-500/10 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-200">
                  {normalizedPlan === "free" ? "Upgrade to Premium" : "Upgrade to Premium Pro"}
                </p>
                <h2 className="mt-2 text-xl font-black text-white">
                  {normalizedPlan === "free" ? "Unlock complete career preparation" : "Unlock AI Career Coach + Live AI Recruiter"}
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  {normalizedPlan === "free"
                    ? "Premium unlocks CV improvement, cover letters, Job Assist, Career Brain, advanced reports, and 50 voice interviews per month."
                    : "Premium Pro unlocks unlimited voice interviews, 60 Live AI Recruiter minutes, premium personas, roadmaps, replay intelligence, and priority models."}
                </p>
              </div>
              <Link href={normalizedPlan === "free" ? "/pricing?plan=premium" : "/pricing?plan=premium_pro"} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-blue-500 px-5 py-3 text-sm font-black text-white hover:bg-blue-400">
                View plans
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        ) : null}

        <section className="mt-8 grid gap-4 lg:grid-cols-4">
          {actionCards.map((card) => {
            const allowed = canUseWorkZoFeature(normalizedPlan, card.feature);
            const Icon = card.icon;
            return (
              <Link key={card.title} href={allowed ? card.href : lockedHref(card.required)} className="group rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-5 transition hover:bg-white/[0.06]">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/8 text-blue-100">
                    <Icon className="h-5 w-5" />
                  </div>
                  {!allowed ? <Lock className="h-4 w-4 text-slate-500" /> : <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:text-white" />}
                </div>
                <h3 className="mt-4 text-lg font-black">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{allowed ? card.detail : `Requires ${WORKZO_PLAN_LIMITS[card.required].label}`}</p>
              </Link>
            );
          })}
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">Your plan behavior</p>
                <h2 className="mt-2 text-2xl font-black">{dashboardMode.title}</h2>
              </div>
              <CheckCircle2 className="h-6 w-6 text-emerald-300" />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {(normalizedPlan === "free" ? ["Basic recruiter", "Basic follow-ups", "Basic reports", "Limited history"] : normalizedPlan === "premium" ? ["Advanced recruiter memory", "Role-specific questions", "Advanced reports", "50 voice interviews/month"] : ["AI Career Coach", "Live AI Recruiter", "Premium personas", "Replay intelligence"]).map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm font-bold text-slate-200">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-200">Premium Pro layer</p>
            <h2 className="mt-2 text-2xl font-black">Career coach tools</h2>
            <div className="mt-5 grid gap-3">
              {proTools.map((tool) => {
                const allowed = canUseWorkZoFeature(normalizedPlan, tool.feature);
                const Icon = tool.icon;
                return (
                  <div key={tool.title} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", allowed ? "bg-violet-400/15 text-violet-200" : "bg-white/5 text-slate-500")}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-black text-white">{tool.title}</p>
                        {!allowed ? <Lock className="h-3.5 w-3.5 text-slate-500" /> : null}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{tool.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function Sidebar({ plan }: { plan: WorkZoPlanType }) {
  return (
    <div className="flex h-full flex-col">
      <Link href="/" className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-500 text-white">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <p className="text-base font-black">WorkZo AI</p>
          <p className="text-xs text-slate-500">Career workspace</p>
        </div>
      </Link>

      <div className={cn("mt-5 rounded-2xl border px-3 py-2 text-xs font-black uppercase tracking-[0.16em]", planTone(plan))}>
        {WORKZO_PLAN_LIMITS[plan].label}
      </div>

      <nav className="mt-6 space-y-2">
        {baseNav.map((item) => {
          const Icon = item.icon;
          const allowed = canUseWorkZoFeature(plan, item.feature);
          return (
            <Link key={item.label} href={allowed ? item.href : `/pricing?intent=${item.feature}`} className="flex items-center justify-between gap-3 rounded-2xl px-3 py-3 text-sm font-bold text-slate-300 hover:bg-white/[0.06] hover:text-white">
              <span className="flex items-center gap-3">
                <Icon className="h-4 w-4" />
                {item.label}
              </span>
              {!allowed ? <Lock className="h-3.5 w-3.5 text-slate-600" /> : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-2xl border border-white/10 bg-white/[0.035] p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/8 text-slate-200">
            <UserRound className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-black">Account</p>
            <Link href="/logout" className="text-xs font-bold text-slate-400 hover:text-white">Logout</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
      <p className="mt-1 text-sm text-slate-400">{detail}</p>
    </div>
  );
}
