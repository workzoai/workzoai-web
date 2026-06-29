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
  report: Record<string, unknown> | null; // packed runtime state including rawResult
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

/** Returns the real duration in seconds for a session row.
 *  Falls back to rawResult.durationSeconds when duration_seconds is 0 or null —
 *  this covers ECONNRESET drops where the session completion write never landed. */
function effectiveDuration(session: SessionRow): number {
  const col = Number(session.duration_seconds ?? 0);
  if (col > 0) return col;
  // Try packed rawResult inside report JSON
  const raw = session.report as Record<string, unknown> | null;
  const rawResult = raw?.rawResult as Record<string, unknown> | null | undefined;
  const fromRaw = Number(rawResult?.durationSeconds ?? raw?.durationSeconds ?? 0);
  return fromRaw > 0 ? fromRaw : 0;
}

function scoreTone(score?: number | null) {
  if (score == null) return "text-muted";
  if (score >= 78) return "text-success";
  if (score >= 65) return "text-brand";
  if (score >= 50) return "text-warning";
  return "text-danger";
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
      <main className="min-h-screen bg-canvas px-5 py-8 text-fg">
        <HistoryAnalyticsPing isSignedIn={false} savedCount={0} />
        <div className="mx-auto max-w-4xl">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>

          <section className="mt-10 rounded-3xl border border-line bg-fg/[0.03] p-8">
            <LockKeyhole className="h-8 w-8 text-brand" />
            <h1 className="mt-4 text-3xl font-black">Sign in to view history</h1>
            <p className="mt-3 text-muted">Your saved interview reports will appear here after login.</p>
            <Link href="/login?redirect=/history" className="mt-6 inline-flex rounded-2xl bg-brand px-5 py-3 text-sm font-black">
              Sign in
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const { data: sessions, error } = await supabase
    .from("interview_sessions")
    .select("id, target_role, target_company, recruiter_name, recruiter_title, company_style, atmosphere, country, duration_seconds, overall_score, trust_score, verdict, summary, weakest_moment, report, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (sessions || []) as SessionRow[];
  const displayRows = rows.slice(0, planLimits.historyLimit);
  const hiddenCount = Math.max(0, rows.length - displayRows.length);
  const isPaidPlan = plan === "premium" || plan === "premium_pro";
  const isProPlan = plan === "premium_pro";

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 text-fg sm:px-6">
      <HistoryAnalyticsPing isSignedIn={true} savedCount={rows.length} />
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <Link href="/onboarding" className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-black text-on-brand hover:bg-brand">
            <RotateCcw className="h-4 w-4" />
            New interview
          </Link>
        </div>

        <section className={`mt-6 rounded-xl border p-5 sm:p-7 ${
          isProPlan ? "border-brand/20 bg-gradient-to-br from-brand/15 via-brand/8 to-white/[0.03]"
          : isPaidPlan ? "border-brand/15 bg-gradient-to-br from-brand/12 via-brand/8 to-white/[0.03]"
          : "border-line bg-gradient-to-br from-brand/10 via-brand/6 to-white/[0.03]"
        }`}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className={`text-xs font-bold uppercase tracking-[0.18em] ${isProPlan ? "text-brand" : "text-brand"}`}>
                {isProPlan ? "Premium Pro · Unlimited history" : isPaidPlan ? "Premium · Full history" : "Free plan · 3 sessions"}
              </p>
              <h1 className="mt-2 text-3xl font-black sm:text-4xl">Interview History</h1>
              <p className="mt-2 max-w-2xl text-muted">
                Review your past interview reports, scores, recruiter signals, and weakest moments.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:min-w-[360px]">
              <div className="rounded-2xl border border-line bg-canvas-soft p-3">
                <p className="text-xs text-muted">Sessions</p>
                <p className="mt-1 text-2xl font-black">{rows.length}</p>
              </div>
              <div className="rounded-2xl border border-line bg-canvas-soft p-3">
                <p className="text-xs text-muted">Visible</p>
                <p className="mt-1 text-2xl font-black">{displayRows.length}</p>
              </div>
              <div className="rounded-2xl border border-line bg-canvas-soft p-3">
                <p className="text-xs text-muted">Plan</p>
                <p className={`mt-1 truncate text-sm font-black ${isProPlan ? "text-brand" : isPaidPlan ? "text-brand" : "text-muted"}`}>{planLimits.label}</p>
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <section className="mt-5 rounded-3xl border border-danger/20 bg-danger/[0.07] p-5 text-danger">
            <h2 className="font-black">Could not load interview history</h2>
            <p className="mt-2 text-sm leading-6">{error.message}</p>
          </section>
        ) : null}

        {rows.length === 0 && !error ? (
          <section className="mt-5 rounded-3xl border border-line bg-fg/[0.03] p-8 text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-brand" />
            <h2 className="mt-4 text-2xl font-black">No saved interviews yet</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted">
              Complete an interview while signed in. Your report will be saved here automatically after the Results page opens.
            </p>
            <Link href="/interview" className="mt-6 inline-flex rounded-2xl bg-brand px-5 py-3 text-sm font-black">
              Start interview
            </Link>
          </section>
        ) : null}

        {hiddenCount > 0 && !isPaidPlan ? (
          <section className="mt-5 rounded-3xl border border-brand/20 bg-brand/[0.07] p-6">
            <div className="flex items-start gap-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand/15 text-brand">
                <Lock className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-brand">Free plan — limited history</p>
                <h2 className="mt-2 text-xl font-black text-fg">
                  {hiddenCount} older interview{hiddenCount === 1 ? "" : "s"} are locked
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                  Free shows your 3 most recent sessions. Premium unlocks full unlimited history, cross-session patterns, performance trends, and long-term tracking.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href="/pricing?plan=premium" className="inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-black text-on-brand hover:bg-brand">
                    <Crown className="h-4 w-4" /> Unlock with Premium
                  </Link>
                  <Link href="/pricing?plan=premium_pro" className="inline-flex items-center gap-2 rounded-2xl border border-brand/20 bg-brand/10 px-5 py-3 text-sm font-black text-brand hover:bg-brand/20">
                    <Star className="h-4 w-4" /> Or get Premium Pro
                  </Link>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {["Full interview history", "Cross-session pattern tracking", "Score and trust trend charts"].map((item) => (
                <div key={item} className="rounded-2xl border border-line bg-canvas-soft p-3 text-sm text-muted">
                  <Lock className="mb-2 h-4 w-4 text-brand/50" />
                  {item}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-5 grid gap-4">
          {displayRows.map((session) => (
            <article key={session.id} className="rounded-3xl border border-line bg-fg/[0.03] p-5 transition hover:bg-fg/[0.05]">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-subtle">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDate(session.created_at)}
                    </span>
                    {session.country ? <span>· {session.country}</span> : null}
                    {session.company_style ? <span>· {session.company_style}</span> : null}
                  </div>

                  <h2 className="mt-2 text-2xl font-black">{session.target_role || "Interview Practice"}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {session.recruiter_name || "AI Recruiter"}
                    {session.recruiter_title ? ` · ${session.recruiter_title}` : ""}
                    {session.target_company ? ` · ${session.target_company}` : ""}
                  </p>

                  <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{getVerdictText(session)}</p>
                </div>

                <div className="grid w-full grid-cols-3 gap-3 sm:min-w-[360px] lg:w-auto">
                  <div className="rounded-2xl border border-line bg-canvas-soft p-3">
                    <p className="text-xs text-subtle">Overall</p>
                    <p className={`mt-1 text-2xl font-black ${scoreTone(session.overall_score)}`}>{session.overall_score ?? "—"}</p>
                  </div>
                  <div className="rounded-2xl border border-line bg-canvas-soft p-3">
                    <p className="text-xs text-subtle">Trust</p>
                    <p className={`mt-1 text-2xl font-black ${scoreTone(session.trust_score)}`}>{session.trust_score ?? "—"}</p>
                  </div>
                  <div className="rounded-2xl border border-line bg-canvas-soft p-3">
                    <p className="text-xs text-subtle">Duration</p>
                    <p className="mt-1 text-lg font-black">{(() => { const d = effectiveDuration(session); return d > 0 ? formatDuration(d) : "—"; })()}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-line bg-fg/[0.04] px-3 py-1.5 text-xs font-bold text-muted">
                  <BarChart3 className="h-3.5 w-3.5 text-brand" />
                  Saved report
                </div>
                {session.atmosphere ? (
                  <div className="rounded-full border border-line bg-fg/[0.04] px-3 py-1.5 text-xs font-bold text-muted">
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
