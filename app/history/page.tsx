import Link from "next/link";
import { ArrowLeft, BarChart3, CalendarDays, Crown, Lock, LockKeyhole, RotateCcw, ShieldCheck, Star } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import HistoryAnalyticsPing from "./HistoryAnalyticsPing";

async function getPlanFromServer(): Promise<string> {
  // Use server-backed DB plan — cannot be spoofed via devtools cookie manipulation.
  // Falls back to cookie if the DB call fails (e.g. during Supabase maintenance).
  try {
    const resolved = await resolveWorkZoServerPlan();
    if (resolved.authenticated && resolved.plan) return resolved.plan;
  } catch {}
  // Cookie fallback — lower security but better than showing nothing
  try {
    const cookieStore = await cookies();
    const planCookie =
      cookieStore.get("workzo_plan")?.value ||
      cookieStore.get("workzo_plan_type")?.value ||
      "";
    if (planCookie.includes("premium_pro") || planCookie.includes("pro")) return "premium_pro";
    if (planCookie.includes("premium")) return "premium";
  } catch {}
  return "free";
}

function getPlanLimits(plan: string) {
  if (plan === "premium_pro") return { historyLimit: 999, label: "Premium Pro", icon: "star" };
  if (plan === "premium") return { historyLimit: 999, label: "Premium", icon: "crown" };
  return { historyLimit: 3, label: "Free", icon: "free" };
}

export const dynamic = "force-dynamic";

type SessionRow = {
  id: string;
  target_role: string | null;
  target_company: string | null;
  recruiter_name: string | null;
  recruiter_title: string | null;
  company_style: string | null;
  atmosphere: string | null;
  country: string | null;
  duration_seconds: number | null;
  overall_score: number | null;
  trust_score: number | null;
  verdict: Record<string, unknown> | null;
  summary: Record<string, unknown> | null;
  weakest_moment: Record<string, unknown> | null;
  created_at: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "Recent";
  try {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "Recent";
  }
}

function formatDuration(seconds?: number | null) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}m ${secs}s`;
}

function scoreTone(score?: number | null) {
  if (score == null) return "text-slate-300";
  if (score >= 78) return "text-emerald-300";
  if (score >= 65) return "text-blue-300";
  if (score >= 50) return "text-amber-300";
  return "text-red-300";
}

function getVerdictText(session: SessionRow) {
  const verdictDecision = session.verdict?.decision;
  const summaryVerdict = session.summary?.verdict;
  if (typeof verdictDecision === "string" && verdictDecision.trim()) return verdictDecision;
  if (typeof summaryVerdict === "string" && summaryVerdict.trim()) return summaryVerdict;
  return "Saved interview report";
}

export default async function HistoryPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const plan = await getPlanFromServer();
  const planLimits = getPlanLimits(plan);

  if (!user) {
    return (
      <main className="min-h-screen bg-[#050b14] px-5 py-8 text-white">
        <HistoryAnalyticsPing isSignedIn={false} savedCount={0} />
        <div className="mx-auto max-w-4xl">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>

          <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-8">
            <LockKeyhole className="h-8 w-8 text-blue-200" />
            <h1 className="mt-4 text-3xl font-black">Sign in to view history</h1>
            <p className="mt-3 text-slate-300">Your saved interview reports will appear here after login.</p>
            <Link href="/login?redirect=/history" className="mt-6 inline-flex rounded-2xl bg-blue-500 px-5 py-3 text-sm font-black">
              Sign in
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const { data: sessions, error } = await supabase
    .from("interview_sessions")
    .select("id, target_role, target_company, recruiter_name, recruiter_title, company_style, atmosphere, country, duration_seconds, overall_score, trust_score, verdict, summary, weakest_moment, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (sessions || []) as SessionRow[];
  const displayRows = rows.slice(0, planLimits.historyLimit);
  const hiddenCount = Math.max(0, rows.length - displayRows.length);
  const isPaidPlan = plan === "premium" || plan === "premium_pro";
  const isProPlan = plan === "premium_pro";

  return (
    <main className="min-h-screen bg-[#050b14] px-4 py-6 text-white sm:px-6">
      <HistoryAnalyticsPing isSignedIn={true} savedCount={rows.length} />
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>

          <Link href="/interview" className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-black">
            <RotateCcw className="h-4 w-4" />
            Practice again
          </Link>
        </div>

        <section className={`mt-6 rounded-xl border p-5 sm:p-7 ${
          isProPlan ? "border-violet-300/20 bg-gradient-to-br from-violet-500/15 via-violet-500/8 to-white/[0.03]"
          : isPaidPlan ? "border-blue-300/15 bg-gradient-to-br from-blue-500/12 via-violet-500/8 to-white/[0.03]"
          : "border-white/10 bg-gradient-to-br from-blue-500/10 via-violet-500/6 to-white/[0.03]"
        }`}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className={`text-xs font-bold uppercase tracking-[0.18em] ${isProPlan ? "text-violet-300" : "text-blue-200"}`}>
                {isProPlan ? "Premium Pro · Unlimited history" : isPaidPlan ? "Premium · Full history" : "Free plan · 3 sessions"}
              </p>
              <h1 className="mt-2 text-3xl font-black sm:text-4xl">Interview History</h1>
              <p className="mt-2 max-w-2xl text-slate-300">
                Review your past interview reports, scores, recruiter signals, and weakest moments.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:min-w-[360px]">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <p className="text-xs text-slate-400">Sessions</p>
                <p className="mt-1 text-2xl font-black">{rows.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <p className="text-xs text-slate-400">Visible</p>
                <p className="mt-1 text-2xl font-black">{displayRows.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <p className="text-xs text-slate-400">Plan</p>
                <p className={`mt-1 truncate text-sm font-black ${isProPlan ? "text-violet-300" : isPaidPlan ? "text-blue-300" : "text-slate-400"}`}>{planLimits.label}</p>
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <section className="mt-5 rounded-3xl border border-red-300/20 bg-red-400/[0.07] p-5 text-red-100">
            <h2 className="font-black">Could not load interview history</h2>
            <p className="mt-2 text-sm leading-6">{error.message}</p>
          </section>
        ) : null}

        {rows.length === 0 && !error ? (
          <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-blue-200" />
            <h2 className="mt-4 text-2xl font-black">No saved interviews yet</h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-300">
              Complete an interview while signed in. Your report will be saved here automatically after the Results page opens.
            </p>
            <Link href="/interview" className="mt-6 inline-flex rounded-2xl bg-blue-500 px-5 py-3 text-sm font-black">
              Start interview
            </Link>
          </section>
        ) : null}

        {hiddenCount > 0 && !isPaidPlan ? (
          <section className="mt-5 rounded-3xl border border-blue-300/20 bg-blue-500/[0.07] p-6">
            <div className="flex items-start gap-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-blue-400/15 text-blue-200">
                <Lock className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-300">Free plan — limited history</p>
                <h2 className="mt-2 text-xl font-black text-white">
                  {hiddenCount} older interview{hiddenCount === 1 ? "" : "s"} are locked
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                  Free shows your 3 most recent sessions. Premium unlocks full unlimited history, cross-session patterns, performance trends, and long-term tracking.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href="/pricing?plan=premium" className="inline-flex items-center gap-2 rounded-2xl bg-blue-500 px-5 py-3 text-sm font-black text-white hover:bg-blue-400">
                    <Crown className="h-4 w-4" /> Unlock with Premium
                  </Link>
                  <Link href="/pricing?plan=premium_pro" className="inline-flex items-center gap-2 rounded-2xl border border-violet-300/20 bg-violet-500/10 px-5 py-3 text-sm font-black text-violet-200 hover:bg-violet-500/20">
                    <Star className="h-4 w-4" /> Or get Premium Pro
                  </Link>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {["Full interview history", "Cross-session pattern tracking", "Score and trust trend charts"].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-slate-400">
                  <Lock className="mb-2 h-4 w-4 text-blue-300/50" />
                  {item}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-5 grid gap-4">
          {displayRows.map((session) => (
            <article key={session.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition hover:bg-white/[0.05]">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDate(session.created_at)}
                    </span>
                    {session.country ? <span>· {session.country}</span> : null}
                    {session.company_style ? <span>· {session.company_style}</span> : null}
                  </div>

                  <h2 className="mt-2 text-2xl font-black">{session.target_role || "Interview Practice"}</h2>
                  <p className="mt-1 text-sm text-slate-300">
                    {session.recruiter_name || "AI Recruiter"}
                    {session.recruiter_title ? ` · ${session.recruiter_title}` : ""}
                    {session.target_company ? ` · ${session.target_company}` : ""}
                  </p>

                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">{getVerdictText(session)}</p>
                </div>

                <div className="grid w-full grid-cols-3 gap-3 sm:min-w-[360px] lg:w-auto">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-xs text-slate-500">Overall</p>
                    <p className={`mt-1 text-2xl font-black ${scoreTone(session.overall_score)}`}>{session.overall_score ?? "—"}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-xs text-slate-500">Trust</p>
                    <p className={`mt-1 text-2xl font-black ${scoreTone(session.trust_score)}`}>{session.trust_score ?? "—"}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-xs text-slate-500">Duration</p>
                    <p className="mt-1 text-lg font-black">{formatDuration(session.duration_seconds)}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-slate-300">
                  <BarChart3 className="h-3.5 w-3.5 text-blue-200" />
                  Saved report
                </div>
                {session.atmosphere ? (
                  <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-slate-300">
                    {session.atmosphere}
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
