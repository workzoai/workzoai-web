"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Briefcase,
  CheckCircle2,
  Clock,
  Crown,
  FileText,
  History,
  Lock,
  Mail,
  Menu,
  Mic,
  PlayCircle,
  Rocket,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  UserRound,
  Video,
  X,
  Zap,
} from "lucide-react";
import { WORKZO_PLAN_LIMITS, canUseWorkZoFeature, getWorkZoPlanLimits, normalizeWorkZoPlan, type WorkZoPlanType } from "@/lib/workzoPlanLimits";
import { getWorkZoCurrentPlan, getWorkZoUsageSummary } from "@/lib/workzoUsageTracker";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function planBadgeStyle(plan: WorkZoPlanType) {
  if (plan === "premium_pro") return "border-brand/30 bg-brand/15 text-brand";
  if (plan === "premium") return "border-brand/30 bg-brand/15 text-brand";
  return "border-success/25 bg-success/10 text-success";
}

function planLabel(plan: WorkZoPlanType) {
  if (plan === "premium_pro") return "Premium Pro";
  if (plan === "premium") return "Premium";
  return "Free";
}

// ── Action cards — all plans see all cards, locked ones go to pricing ────
const actionCards = [
  {
    title: "Start Interview",
    detail: "Practice with AI recruiters",
    href: "/onboarding",
    icon: Mic,
    feature: "voice_interview" as const,
    required: "free" as WorkZoPlanType,
    accent: "text-brand",
    bg: "bg-brand/10",
  },
  {
    title: "Improve CV",
    detail: "Target your CV for maximum impact",
    href: "/cv",
    icon: FileText,
    feature: "improve_cv" as const,
    required: "premium" as WorkZoPlanType,
    accent: "text-brand",
    bg: "bg-brand/10",
  },
  {
    title: "Cover Letter",
    detail: "Generate role-specific cover letters",
    href: "/cover-letter",
    icon: Mail,
    feature: "cover_letter" as const,
    required: "premium" as WorkZoPlanType,
    accent: "text-brand",
    bg: "bg-brand/10",
  },
  {
    title: "Job Assist",
    detail: "Analyze job fit and likely questions",
    href: "/jobs",
    icon: Briefcase,
    feature: "job_assist" as const,
    required: "premium" as WorkZoPlanType,
    accent: "text-warning",
    bg: "bg-warning/10",
  },
  {
    title: "Career Brain",
    detail: "AI coaching from your interview history",
    href: "/copilot",
    icon: BrainCircuit,
    feature: "career_brain" as const,
    required: "premium" as WorkZoPlanType,
    accent: "text-pink-200",
    bg: "bg-pink-500/10",
  },
  {
    title: "View History",
    detail: "Your past sessions and scores",
    href: "/history",
    icon: History,
    feature: "interview_history" as const,
    required: "free" as WorkZoPlanType,
    accent: "text-muted",
    bg: "bg-fg/5",
  },
];

// ── Pro-only tools ────────────────────────────────────────────────────────
const proTools = [
  { title: "AI Career Coach", detail: "Personal coaching priorities from your history", icon: BrainCircuit, feature: "career_coach" as const },
  { title: "Live AI Recruiter", detail: "60 video recruiter minutes per month", icon: Video, feature: "video_recruiter" as const },
  { title: "Career Roadmaps", detail: "30 / 60 / 90 day improvement plans", icon: TrendingUp, feature: "career_roadmaps" as const },
  { title: "Replay Intelligence", detail: "Best moments, weak moments, and missed opportunities", icon: PlayCircle, feature: "replay_intelligence" as const },
];

// ── Sidebar nav ───────────────────────────────────────────────────────────
const navItems = [
  { label: "Start Interview", href: "/onboarding", icon: Mic },
  { label: "View History", href: "/history", icon: History },
  { label: "Improve CV", href: "/cv", icon: FileText },
  { label: "Cover Letter", href: "/cover-letter", icon: Mail },
  { label: "Job Assist", href: "/jobs", icon: Briefcase },
  { label: "Career Brain", href: "/copilot", icon: BrainCircuit },
];

export default function DashboardPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [plan, setPlan] = useState<WorkZoPlanType>("free");
  const [firstName, setFirstName] = useState("");
  const [greetingText, setGreetingText] = useState("Welcome");
  const [usage, setUsage] = useState<ReturnType<typeof getWorkZoUsageSummary> | null>(null);

  useEffect(() => {
    const p = normalizeWorkZoPlan(getWorkZoCurrentPlan());
    setPlan(p);
    setUsage(getWorkZoUsageSummary(p));
    setGreetingText(greeting());
      // Try to get first name from stored setup
      try {
        const keys = ["workzo-interview-setup-latest", "workzo_interview_setup", "workzoInterviewSetup"];
        for (const k of keys) {
          const raw = localStorage.getItem(k) || sessionStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            const name = parsed?.candidateName || parsed?.state?.candidateName || "";
            const first = name.split(" ")[0];
            if (first && first.length > 1 && !/unknown|section|header/i.test(first)) {
              setFirstName(first);
              break;
            }
          }
        }
      } catch {}
  }, []);

  const limits = getWorkZoPlanLimits(plan);
  const isPremium = plan === "premium" || plan === "premium_pro";
  const isPro = plan === "premium_pro";

  const interviewsUsed = usage?.usage.interviewsStarted ?? 0;
  const interviewsLeft = isPro ? "∞" : isPremium ? `${Math.max(0, 50 - interviewsUsed)} left` : `${Math.max(0, 2 - interviewsUsed)} left`;

  return (
    <main className="min-h-screen bg-canvas text-fg">

      {/* ── Mobile menu button ── */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 grid h-11 w-11 place-items-center rounded-2xl border border-line bg-canvas/90 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* ── Desktop sidebar ── */}
      <aside className="fixed inset-y-0 left-0 hidden w-[240px] border-r border-line bg-canvas p-5 lg:flex lg:flex-col">
        <Sidebar plan={plan} />
      </aside>

      {/* ── Mobile sidebar ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative h-full w-[260px] bg-canvas p-5" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setMobileOpen(false)} className="mb-4 grid h-10 w-10 place-items-center rounded-xl border border-line hover:bg-fg/5">
              <X className="h-5 w-5" />
            </button>
            <Sidebar plan={plan} />
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="px-5 pb-16 pt-20 lg:ml-[240px] lg:px-10 lg:pt-8">

        {/* ── Header ── */}
        <header className="flex flex-wrap items-start justify-between gap-5 border-b border-line pb-7">
          <div>
            <p className="text-sm text-subtle">{greetingText}{firstName ? `, ${firstName}` : ""}! 👋</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Your career workspace</h1>
            <p className="mt-2 text-sm text-muted">Track your progress and close the gap to your next offer.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn("rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em]", planBadgeStyle(plan))}>
              {planLabel(plan)} plan
            </span>
            <Link href="/onboarding" className="inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-black text-on-brand hover:bg-brand">
              <Mic className="h-4 w-4" />
              New Interview
            </Link>
          </div>
        </header>

        {/* ── Score metric cards ── */}
        <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Interviews"
            value={String(interviewsUsed)}
            sub={interviewsLeft}
            icon={Mic}
            color="text-brand"
            locked={false}
          />
          <MetricCard
            label="Avg score"
            value="—"
            sub={isPremium ? "Complete interviews to track" : "Complete an interview"}
            icon={BarChart3}
            color="text-brand"
            locked={false}
          />
          <MetricCard
            label="CV score"
            value={isPremium ? "—" : "Locked"}
            sub={isPremium ? "Upload your CV to score" : "Upgrade to unlock"}
            icon={FileText}
            color="text-brand"
            locked={!isPremium}
            lockedHref="/pricing?plan=premium"
          />
          <MetricCard
            label="Readiness"
            value={isPremium ? "—" : "Locked"}
            sub={isPremium ? "Builds after 3+ sessions" : "Upgrade to unlock"}
            icon={Target}
            color="text-warning"
            locked={!isPremium}
            lockedHref="/pricing?plan=premium"
          />
        </section>

        {/* ── Upgrade banner for free/premium ── */}
        {!isPro && (
          <section className={cn(
            "mt-5 rounded-2xl border p-5",
            isPremium
              ? "border-brand/20 bg-brand/[0.08]"
              : "border-brand/20 bg-brand/[0.08]"
          )}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className={cn("text-[11px] font-black uppercase tracking-[0.2em]", isPremium ? "text-brand" : "text-brand")}>
                  {isPremium ? "Upgrade to Premium Pro" : "Upgrade to Premium"}
                </p>
                <h2 className="mt-1.5 text-lg font-black">
                  {isPremium
                    ? "Unlock AI Career Coach + Live AI Recruiter"
                    : "Unlock complete career preparation"}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {isPremium
                    ? "Unlimited interviews, 60 live recruiter minutes, premium personas, roadmaps, and replay intelligence."
                    : "50 voice interviews, CV improvement, cover letters, Job Assist, Career Brain, and advanced reports."}
                </p>
              </div>
              <Link
                href={isPremium ? "/pricing?plan=premium_pro" : "/pricing?plan=premium"}
                className={cn("inline-flex shrink-0 items-center gap-2 rounded-xl px-5 py-3 text-sm font-black",
                  isPremium ? "bg-brand text-on-brand hover:bg-brand" : "bg-brand text-on-brand hover:bg-brand")}
              >
                See plans <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        )}

        {/* ── Action cards — all visible, locked if not on right plan ── */}
        <section className="mt-8">
          <h2 className="text-xs font-black uppercase tracking-[0.22em] text-subtle">Your tools</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {actionCards.map((card) => {
              const allowed = canUseWorkZoFeature(plan, card.feature);
              const Icon = card.icon;
              const dest = allowed ? card.href : `/pricing?intent=upgrade&plan=${card.required}`;
              return (
                <Link
                  key={card.title}
                  href={dest}
                  className={cn(
                    "group relative rounded-2xl border p-5 transition",
                    allowed
                      ? "border-line bg-fg/[0.035] hover:bg-fg/[0.06]"
                      : "border-line bg-fg/[0.02] cursor-pointer hover:border-line"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className={cn("grid h-10 w-10 place-items-center rounded-xl", allowed ? card.bg : "bg-fg/[0.04]")}>
                      <Icon className={cn("h-5 w-5", allowed ? card.accent : "text-subtle")} />
                    </div>
                    {allowed
                      ? <ArrowRight className="h-4 w-4 text-subtle transition group-hover:text-muted" />
                      : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-line bg-fg/5 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-subtle">
                          <Lock className="h-2.5 w-2.5" />
                          {WORKZO_PLAN_LIMITS[card.required].label}
                        </span>
                      )
                    }
                  </div>
                  <h3 className={cn("mt-4 text-base font-black", allowed ? "text-fg" : "text-subtle")}>{card.title}</h3>
                  <p className={cn("mt-1.5 text-sm leading-5", allowed ? "text-muted" : "text-subtle")}>
                    {allowed ? card.detail : `Unlock with ${WORKZO_PLAN_LIMITS[card.required].label}`}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ── Bottom two-column section ── */}
        <section className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">

          {/* Recent sessions */}
          <div className="rounded-2xl border border-line bg-fg/[0.028] p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-subtle">Recent activity</p>
                <h2 className="mt-1 text-xl font-black">Your last sessions</h2>
              </div>
              <Link href="/history" className="text-xs font-black text-brand hover:text-brand">View all</Link>
            </div>
            <RecentSessions plan={plan} />
          </div>

          {/* Premium Pro tools */}
          <div className="rounded-2xl border border-line bg-fg/[0.028] p-6">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-brand" />
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-brand">Premium Pro tools</p>
            </div>
            <h2 className="mt-1 text-xl font-black">Advanced career layer</h2>
            <div className="mt-4 space-y-3">
              {proTools.map((tool) => {
                const allowed = canUseWorkZoFeature(plan, tool.feature);
                const Icon = tool.icon;
                return (
                  <div key={tool.title} className={cn(
                    "flex items-start gap-3 rounded-xl border p-3.5",
                    allowed ? "border-brand/20 bg-brand/[0.07]" : "border-line bg-fg/[0.02]"
                  )}>
                    <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", allowed ? "bg-brand/15 text-brand" : "bg-fg/[0.04] text-subtle")}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={cn("text-sm font-black", allowed ? "text-fg" : "text-subtle")}>{tool.title}</p>
                        {!allowed && <Lock className="h-3 w-3 text-subtle" />}
                      </div>
                      <p className={cn("mt-0.5 text-xs leading-4", allowed ? "text-muted" : "text-subtle")}>{tool.detail}</p>
                    </div>
                    {allowed && <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-brand" />}
                  </div>
                );
              })}
            </div>
            {!isPro && (
              <Link href="/pricing?plan=premium_pro" className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-brand/20 bg-brand/10 px-4 py-3 text-sm font-black text-brand hover:bg-brand/20">
                <Zap className="h-4 w-4" />
                Unlock Premium Pro
              </Link>
            )}
          </div>
        </section>

        {/* ── Daily tip ── */}
        <section className="mt-5 rounded-2xl border border-line bg-fg/[0.028] p-5">
          <div className="flex items-start gap-4">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brand">Interview tip</p>
              <p className="mt-1 text-sm leading-6 text-muted">
                Use the STAR method — Situation, Task, Action, Result — to structure every behavioural answer.
                Lead with the result first if your audience is senior. Recruiters remember the outcome, not the process.
              </p>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}

// ── Recent sessions — reads from localStorage ─────────────────────────────
function RecentSessions({ plan }: { plan: WorkZoPlanType }) {
  const [sessions, setSessions] = useState<Array<{ id: string; targetRole: string; recruiterName: string; score: number | null; savedAt: string }>>([]);

  useEffect(() => {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith("workzo") && k.includes("result"));
      const found: typeof sessions = [];
      for (const k of keys.slice(0, 10)) {
        try {
          const raw = localStorage.getItem(k);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          const arr = Array.isArray(parsed) ? parsed : [parsed];
          for (const item of arr) {
            if (item?.targetRole || item?.recruiterName) {
              found.push({ id: item.id || k, targetRole: item.targetRole || "Interview", recruiterName: item.recruiterName || "AI Recruiter", score: item.score ?? null, savedAt: item.savedAt || "" });
            }
          }
        } catch {}
      }
      found.sort((a, b) => (b.savedAt > a.savedAt ? 1 : -1));
      setSessions(found.slice(0, 4));
    } catch {}
  }, []);

  const isPremium = plan === "premium" || plan === "premium_pro";

  if (sessions.length === 0) {
    return (
      <div className="mt-5 rounded-xl border border-line bg-fg/[0.02] p-6 text-center">
        <Mic className="mx-auto h-8 w-8 text-subtle" />
        <p className="mt-3 text-sm font-black text-muted">No sessions yet</p>
        <p className="mt-1 text-xs text-subtle">Complete an interview to see your history here.</p>
        <Link href="/onboarding" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-black text-on-brand hover:bg-brand">
          Start first interview
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {sessions.map((s, idx) => (
        <Link key={`${s.id}-${idx}`} href="/results" className="group flex items-center justify-between gap-3 rounded-xl border border-line bg-fg/[0.02] p-3.5 transition hover:bg-fg/[0.05]">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
              <Mic className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-black text-fg">{s.targetRole}</p>
              <p className="text-xs text-subtle">{s.recruiterName}</p>
            </div>
          </div>
          <div className="text-right">
            {s.score !== null && isPremium ? (
              <p className="text-sm font-black text-fg">
                {typeof s.score === "object" ? (s.score as Record<string,number>)?.overall ?? "—" : s.score}
                <span className="text-xs text-subtle">/100</span>
              </p>
            ) : s.score !== null ? (
              <p className="text-sm font-black text-subtle">Score hidden</p>
            ) : null}
            <ArrowRight className="ml-auto mt-1 h-3.5 w-3.5 text-subtle transition group-hover:text-muted" />
          </div>
        </Link>
      ))}
    </div>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────────────
function Sidebar({ plan }: { plan: WorkZoPlanType }) {
  const premiumItems = new Set(["Improve CV", "Cover Letter", "Job Assist", "Career Brain"]);
  const proItems = new Set<string>([]);

  function isLocked(label: string) {
    if (premiumItems.has(label) && plan === "free") return true;
    if (proItems.has(label) && plan !== "premium_pro") return true;
    return false;
  }

  return (
    <div className="flex h-full flex-col pb-4">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand">
          <Sparkles className="h-4 w-4 text-fg" />
        </div>
        <div>
          <p className="text-sm font-black">WorkZo <span className="text-brand">AI</span></p>
          <p className="text-[10px] text-subtle">Career workspace</p>
        </div>
      </Link>

      {/* Plan badge */}
      <div className={cn("mt-4 rounded-xl border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em]", planBadgeStyle(plan))}>
        {planLabel(plan)} plan active
      </div>

      {/* Nav */}
      <nav className="mt-5 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const locked = isLocked(item.label);
          const href = locked ? `/pricing?intent=upgrade&feature=${item.label.toLowerCase().replace(/ /g, "_")}` : item.href;
          return (
            <Link
              key={item.label}
              href={href}
              className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-bold text-muted transition hover:bg-fg/[0.06] hover:text-fg"
            >
              <span className="flex items-center gap-3">
                <Icon className="h-4 w-4" />
                {item.label}
              </span>
              {locked && <Lock className="h-3 w-3 text-subtle" />}
            </Link>
          );
        })}
      </nav>

      {/* Upgrade CTA for free users */}
      {plan === "free" && (
        <div className="mt-6 rounded-2xl border border-brand/20 bg-brand/10 p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">Upgrade to Premium</p>
          <p className="mt-1.5 text-xs leading-5 text-muted">50 interviews, CV tools, cover letters, Job Assist, and advanced reports.</p>
          <Link href="/pricing?plan=premium" className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-xs font-black text-on-brand hover:bg-brand">
            <Crown className="h-3.5 w-3.5" /> Upgrade — €19.99/mo
          </Link>
        </div>
      )}

      {plan === "premium" && (
        <div className="mt-6 rounded-2xl border border-brand/20 bg-brand/10 p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">Upgrade to Pro</p>
          <p className="mt-1.5 text-xs leading-5 text-muted">AI Career Coach, Live AI Recruiter, roadmaps, and replay intelligence.</p>
          <Link href="/pricing?plan=premium_pro" className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-xs font-black text-on-brand hover:bg-brand">
            <Star className="h-3.5 w-3.5" /> Upgrade — €39.99/mo
          </Link>
        </div>
      )}

      {/* Account */}
      <div className="mt-4 shrink-0 rounded-2xl border border-line bg-fg/[0.025] p-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-fg/[0.06]">
            <UserRound className="h-4 w-4 text-muted" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-black text-fg">Account</p>
            <Link href="/dashboard/settings" className="text-[10px] text-subtle hover:text-muted">Manage settings</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────
function MetricCard({
  label, value, sub, icon: Icon, color, locked, lockedHref,
}: {
  label: string; value: string; sub: string; icon: React.ElementType; color: string; locked: boolean; lockedHref?: string;
}) {
  const content = (
    <div className={cn(
      "rounded-2xl border p-5 transition",
      locked ? "border-line bg-fg/[0.02]" : "border-line bg-fg/[0.035] hover:bg-fg/[0.05]"
    )}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-subtle">{label}</p>
        {locked ? <Lock className="h-3.5 w-3.5 text-subtle" /> : <Icon className={cn("h-4 w-4", color)} />}
      </div>
      <p className={cn("mt-3 text-3xl font-black", locked ? "text-subtle" : "text-fg")}>{locked ? "—" : value}</p>
      <p className={cn("mt-1 text-xs", locked ? "text-subtle/70" : "text-subtle")}>{locked ? "Upgrade to unlock" : sub}</p>
    </div>
  );

  return locked && lockedHref ? <Link href={lockedHref}>{content}</Link> : <div>{content}</div>;
}
