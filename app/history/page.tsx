import Link from "next/link";
import { ArrowLeft, BarChart3, CalendarDays, Crown, Lock, LockKeyhole, RotateCcw, ShieldCheck, Star, FileText } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import HistoryAnalyticsPing from "./HistoryAnalyticsPing";
import HistoryScoreSummary from "./HistoryScoreSummary";

async function getPlanFromServer(): Promise<string> {
  // Use server-backed DB plan: cannot be spoofed via devtools cookie manipulation.
  // Falls back to cookie if the DB call fails (e.g. during Supabase maintenance).
  try {
    const resolved = await resolveWorkZoServerPlan();
    if (resolved.authenticated && resolved.plan) return resolved.plan;
  } catch {}
  // Cookie fallback: lower security but better than showing nothing
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

type TranscriptTurn = { role?: string; speaker?: string; text?: string; timestamp?: string; created_at?: string; message_index?: number };

type MessageRow = {
  session_id: string | null;
  role: string | null;
  speaker: string | null;
  text: string | null;
  message_index: number | null;
  created_at: string | null;
};

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
  transcript: TranscriptTurn[] | null;
  candidate_name: string | null;
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
 *  Falls back to rawResult.durationSeconds when duration_seconds is 0 or null -
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

/** Returns the overall score for a session row, falling back to the packed
 *  report/rawResult (or an average of category scores) when overall_score is
 *  null, this covers sessions that ended before the results write landed, so
 *  the card shows a real number instead of a dash. */
function effectiveOverall(session: SessionRow): number | null {
  const col = session.overall_score;
  if (col != null && Number.isFinite(Number(col))) return Number(col);
  const raw = session.report as Record<string, unknown> | null;
  const rawResult = (raw?.rawResult as Record<string, unknown> | null) || raw;
  const candidates = [
    rawResult?.overallScore,
    rawResult?.overall,
    (rawResult?.scores as Record<string, unknown> | undefined)?.overall,
    session.trust_score, // last resort: trust is better than an empty dash
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return Math.max(0, Math.min(100, Math.round(n)));
  }
  return null;
}

function scoreTone(score?: number | null) {
  if (score == null) return "text-muted";
  if (score >= 78) return "text-success";
  if (score >= 65) return "text-brand";
  if (score >= 50) return "text-warning";
  return "text-danger";
}


function normalizeTranscript(value: unknown): TranscriptTurn[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): TranscriptTurn | null => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const text = String(row.text ?? row.message ?? row.content ?? row.body ?? "").trim();
      if (!text) return null;
      const role = String(row.role ?? row.type ?? "").trim();
      const speaker = String(row.speaker ?? row.name ?? "").trim();
      const timestamp = String(row.timestamp ?? row.time ?? row.created_at ?? "").trim();
      return {
        role: role || undefined,
        speaker: speaker || undefined,
        text,
        timestamp: timestamp || undefined,
        created_at: typeof row.created_at === "string" ? row.created_at : undefined,
        message_index: Number.isFinite(Number(row.message_index)) ? Number(row.message_index) : undefined,
      };
    })
    .filter(Boolean) as TranscriptTurn[];
}

function transcriptFromReport(session: SessionRow): TranscriptTurn[] {
  const report = session.report as Record<string, unknown> | null;
  const rawResult = (report?.rawResult as Record<string, unknown> | null) || report;
  return (
    normalizeTranscript(session.transcript).length > 0
      ? normalizeTranscript(session.transcript)
      : normalizeTranscript(rawResult?.transcript) ||
        normalizeTranscript(rawResult?.conversation) ||
        normalizeTranscript(rawResult?.messages)
  );
}

function completionStatus(session: SessionRow, transcript: TranscriptTurn[]) {
  const report = session.report as Record<string, unknown> | null;
  const rawResult = (report?.rawResult as Record<string, unknown> | null) || report;
  const explicit = String(rawResult?.completionStatus ?? rawResult?.status ?? "").toLowerCase();
  if (explicit.includes("complete") || explicit.includes("closed")) return { label: "Completed", tone: "text-success border-success/20 bg-success/10" };
  if (explicit.includes("drop") || explicit.includes("disconnect") || explicit.includes("error")) return { label: "Interrupted", tone: "text-warning border-warning/20 bg-warning/10" };
  const duration = effectiveDuration(session);
  if (duration >= 60 && transcript.length > 2) return { label: "Saved", tone: "text-brand border-brand/20 bg-brand/10" };
  return { label: "Saved report", tone: "text-muted border-line bg-fg/[0.04]" };
}

function formatTime(value?: string | null) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  } catch {
    return value;
  }
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
    .select("id, target_role, target_company, recruiter_name, recruiter_title, company_style, atmosphere, country, duration_seconds, overall_score, trust_score, verdict, summary, weakest_moment, report, transcript, candidate_name, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (sessions || []) as SessionRow[];
  const displayRows = rows.slice(0, planLimits.historyLimit);

  // Fallback transcript source: older sessions may have saved turn-by-turn messages
  // in interview_messages even when interview_sessions.transcript is empty.
  // This makes the history page useful for both old and future sessions.
  const messagesBySession = new Map<string, TranscriptTurn[]>();
  const visibleSessionIds = displayRows.map((row) => row.id).filter(Boolean);
  if (visibleSessionIds.length > 0) {
    try {
      const { data: messageRows } = await supabase
        .from("interview_messages")
        .select("session_id, role, speaker, text, message_index, created_at")
        .in("session_id", visibleSessionIds)
        .order("message_index", { ascending: true })
        .order("created_at", { ascending: true });
      ((messageRows || []) as MessageRow[]).forEach((row) => {
        if (!row.session_id || !row.text) return;
        const list = messagesBySession.get(row.session_id) || [];
        list.push({
          role: row.role || undefined,
          speaker: row.speaker || undefined,
          text: row.text,
          created_at: row.created_at || undefined,
          message_index: row.message_index ?? undefined,
        });
        messagesBySession.set(row.session_id, list);
      });
    } catch {
      // Non-fatal. History still renders saved reports even if the optional
      // messages table is not present in this deployment.
    }
  }

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
            Settings
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
              <p className={`text-xs font-bold uppercase tracking-[0.18em] ${isProPlan ? "text-muted" : "text-muted"}`}>
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
                <p className={`mt-1 truncate text-sm font-black ${isProPlan ? "text-muted" : isPaidPlan ? "text-muted" : "text-muted"}`}>{planLimits.label}</p>
              </div>
            </div>
          </div>
        </section>

        <HistoryScoreSummary />

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
                <p className="text-xs font-black uppercase tracking-[0.18em] text-muted">Free plan: limited history</p>
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
          {displayRows.map((session) => {
            const fallbackTranscript = messagesBySession.get(session.id) || [];
            const transcript = transcriptFromReport(session).length > 0 ? transcriptFromReport(session) : fallbackTranscript;
            const status = completionStatus(session, transcript);
            const duration = effectiveDuration(session);
            const title = session.target_role || "Interview Practice";
            const company = session.target_company || "";
            const recruiter = session.recruiter_name || "AI Recruiter";
            return (
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

                  <h2 className="mt-2 text-2xl font-black">{title}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {company ? `${company} · ` : ""}{recruiter}
                    {session.recruiter_title ? ` · ${session.recruiter_title}` : ""}
                  </p>

                  <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{getVerdictText(session)}</p>
                </div>

                <div className="grid w-full grid-cols-3 gap-3 sm:min-w-[360px] lg:w-auto">
                  <div className="rounded-2xl border border-line bg-canvas-soft p-3">
                    <p className="text-xs text-subtle">Overall</p>
                    <p className={`mt-1 text-2xl font-black ${scoreTone(effectiveOverall(session))}`}>{effectiveOverall(session) ?? "-"}</p>
                  </div>
                  <div className="rounded-2xl border border-line bg-canvas-soft p-3">
                    <p className="text-xs text-subtle">Trust</p>
                    <p className={`mt-1 text-2xl font-black ${scoreTone(session.trust_score)}`}>{session.trust_score ?? "-"}</p>
                  </div>
                  <div className="rounded-2xl border border-line bg-canvas-soft p-3">
                    <p className="text-xs text-subtle">Duration</p>
                    <p className="mt-1 text-lg font-black">{duration > 0 ? formatDuration(duration) : "-"}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${status.tone}`}>
                  <BarChart3 className="h-3.5 w-3.5" />
                  {status.label}
                </div>
                {session.atmosphere ? (
                  <div className="rounded-full border border-line bg-fg/[0.04] px-3 py-1.5 text-xs font-bold text-muted">
                    {session.atmosphere}
                  </div>
                ) : null}
                {company ? (
                  <div className="rounded-full border border-line bg-fg/[0.04] px-3 py-1.5 text-xs font-bold text-muted">
                    {company}
                  </div>
                ) : null}
                {transcript.length > 0 ? (
                  <details className="group w-full">
                    <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-full border border-line bg-fg/[0.04] px-3 py-1.5 text-xs font-bold text-muted hover:text-fg">
                      <FileText className="h-3.5 w-3.5 text-brand" />
                      View transcript
                      <span className="text-subtle">({transcript.length} turns)</span>
                    </summary>
                    <div className="mt-3 max-h-[28rem] overflow-y-auto rounded-xl border border-line bg-canvas-soft p-4">
                      {transcript.map((turn, i) => {
                        const role = (turn.role || "").toLowerCase();
                        const isRecruiter = role === "recruiter" || role === "assistant" || role === "ai";
                        const who =
                          turn.speaker ||
                          (isRecruiter
                            ? recruiter || "Recruiter"
                            : session.candidate_name || "You");
                        const time = formatTime(turn.created_at || turn.timestamp || null);
                        return (
                          <div key={i} className="mb-4 rounded-2xl border border-line bg-fg/[0.025] p-3 last:mb-0">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className={`text-[11px] font-black uppercase tracking-[0.14em] ${isRecruiter ? "text-brand" : "text-muted"}`}>
                                {who}
                              </p>
                              {time ? <span className="text-[11px] font-bold text-subtle">{time}</span> : null}
                            </div>
                            <p className="mt-1 text-sm leading-6 text-fg whitespace-pre-wrap">{turn.text}</p>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                ) : (
                  <div className="w-full rounded-xl border border-line bg-fg/[0.025] p-3 text-xs text-muted">
                    Transcript was not captured for this older session. Future interviews will save transcript and duration automatically.
                  </div>
                )}
              </div>
            </article>
          );})}
        </section>
      </div>
    </main>
  );
}
