"use client";

/*
 * app/jobs/[jobId]/apply/ApplyWorkspace.tsx
 *
 * The workspace itself. Five stages, one at a time, with a persistent rail showing
 * where you are. The through-line is the evidence panel: at every stage the user
 * sees what their CV supports, what it does not, and what we therefore refused to
 * write. That honesty is the product, so it is the most visible element on screen,
 * not a disclaimer at the bottom.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  ShieldCheck,
  ShieldAlert,
  FileText,
  Mail,
  MessageSquare,
  ExternalLink,
  Loader2,
  Copy,
  Check,
  Download,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import PremiumFeatureGate from "@/components/PremiumFeatureGate";
import type { JobMatchResult, JobRequirementMatch, WorkZoJob, CandidateContext } from "@/lib/jobs/types";
import type { ResumeProfile } from "@/lib/workzoResumeParser";
import type { SmartApplyInterviewPlan, SmartApplyLinkedInAdvice } from "@/lib/smart-apply/types";
import {
  resolveWorkspaceContext,
  createSmartApplySession,
  generateTailoredCv,
  generateCoverLetterDoc,
  generateInterviewPlan,
  generateLinkedInAdvice,
  markApplied,
} from "./workspaceClient";
import { smartApplyAnalytics } from "@/lib/smart-apply/analytics";

type Stage = "analysis" | "cv" | "cover_letter" | "interview" | "review";

const STAGES: Array<{ id: Stage; label: string; icon: typeof FileText }> = [
  { id: "analysis", label: "Fit analysis", icon: ShieldCheck },
  { id: "cv", label: "Tailored CV", icon: FileText },
  { id: "cover_letter", label: "Cover letter", icon: Mail },
  { id: "interview", label: "Interview prep", icon: MessageSquare },
  { id: "review", label: "Review and apply", icon: ExternalLink },
];

/* ── small shared pieces ───────────────────────────────────────────────────── */

function scoreTone(score: number): { text: string; bg: string; label: string } {
  if (score >= 85) return { text: "text-success", bg: "bg-success/15", label: "Strong match" };
  if (score >= 68) return { text: "text-brand", bg: "bg-brand/15", label: "Worth applying" };
  if (score >= 50) return { text: "text-warning", bg: "bg-warning/15", label: "Stretch" };
  return { text: "text-danger", bg: "bg-danger/15", label: "Low match" };
}

/*
 * When we could barely read the ad, confidence is near zero and the score is capped
 * upstream. The badge must not present that as a fit verdict at all: showing "55,
 * Stretch" still implies we assessed the fit, when we did not. Below this threshold we
 * present "Not enough detail" instead of any score-based label.
 */
const LOW_CONFIDENCE = 0.3;

function scoreLabel(score: number, confidence: number): { text: string; bg: string; label: string; showScore: boolean } {
  if (confidence < LOW_CONFIDENCE) {
    return { text: "text-muted", bg: "bg-fg/5", label: "Not enough detail to score", showScore: false };
  }
  return { ...scoreTone(score), showScore: true };
}

/*
 * The scraped job data can carry em/en dashes and double hyphens (a job board wrote
 * "Analyst – Remote"). WorkZo's copy rule forbids those in user-facing text, so we
 * clean anything we display that came from outside. Comma or single hyphen depending
 * on context; a spaced en dash reads best as a comma.
 */
function cleanText(value: string | undefined | null): string {
  return (value || "")
    .replace(/\s+[–—]\s+/g, ", ")
    .replace(/[–—]/g, "-")
    .replace(/--+/g, "-")
    .trim();
}

/*
 * We cannot know from the client whether an apply URL is live (that would need a
 * request that CORS usually blocks), but we CAN reject the obviously unusable: empty,
 * non-http, or a relative path. This stops the "Open the employer's page" button from
 * sending the user to a blank or malformed destination. A dead-but-well-formed URL will
 * still open (and 404 on the employer's side), which is no worse than any stale link.
 */
function isLikelyValidUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function StatusChip({ status }: { status: JobRequirementMatch["status"] }) {
  const map = {
    matched: { text: "text-success", bg: "bg-success/15", label: "Proven" },
    partial: { text: "text-warning", bg: "bg-warning/15", label: "Partial" },
    missing: { text: "text-danger", bg: "bg-danger/15", label: "Not in CV" },
    not_verifiable: { text: "text-muted", bg: "bg-fg/5", label: "Confirm yourself" },
  }[status];
  return <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${map.bg} ${map.text}`}>{map.label}</span>;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        });
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-fg/[0.04] px-3 py-1.5 text-xs font-black text-muted hover:text-fg"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/*
 * The evidence panel. The heart of the workspace: what the CV proves, what it does
 * not, and what we refused to write because of it. Shown at every stage.
 */
function EvidencePanel({ match }: { match: JobMatchResult }) {
  const grouped = useMemo(() => {
    const order: JobRequirementMatch["status"][] = ["missing", "partial", "matched", "not_verifiable"];
    return order
      .map((status) => ({
        status,
        items: match.requirements.filter((r) => r.status === status).sort((a, b) => (a.criticality === "required" ? -1 : 1) - (b.criticality === "required" ? -1 : 1)),
      }))
      .filter((g) => g.items.length);
  }, [match]);

  return (
    <div className="rounded-2xl border border-line bg-surface/60 p-5">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-brand" />
        <h3 className="text-sm font-black text-fg">What your CV supports</h3>
      </div>
      <p className="mb-4 text-xs leading-5 text-muted">
        Every tailored line and letter below is built only from what you can prove. Anything marked not in your CV was left out, not invented.
      </p>
      <div className="space-y-4">
        {grouped.map((group) => (
          <div key={group.status}>
            <div className="space-y-2">
              {group.items.map((req, i) => (
                <div key={`${req.requirement}-${i}`} className="rounded-lg border border-line bg-canvas/40 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-fg">
                        {req.requirement}
                        {req.criticality === "required" && <span className="ml-2 text-[10px] font-black uppercase tracking-wide text-danger">Required</span>}
                      </p>
                      {req.evidence.length > 0 && (
                        <p className="mt-1 text-xs leading-5 text-muted">
                          <span className="font-black text-success">Your proof: </span>
                          {req.evidence[0]}
                        </p>
                      )}
                    </div>
                    <StatusChip status={req.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BlockedClaims({ claims }: { claims: string[] }) {
  if (!claims.length) return null;
  return (
    <div className="rounded-xl border border-warning/30 bg-warning/[0.06] p-4">
      <div className="mb-2 flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-warning" />
        <h4 className="text-sm font-black text-fg">Left out on purpose</h4>
      </div>
      <ul className="space-y-1.5">
        {claims.map((c, i) => (
          <li key={i} className="text-xs leading-5 text-muted">{c}</li>
        ))}
      </ul>
    </div>
  );
}

/* ── the workspace ─────────────────────────────────────────────────────────── */

export default function ApplyWorkspace({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<WorkZoJob | null>(null);
  const [profile, setProfile] = useState<ResumeProfile | null>(null);
  const [candidate, setCandidate] = useState<CandidateContext>({ skills: [] });
  const [cvReady, setCvReady] = useState(true);
  const [stale, setStale] = useState(false);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [match, setMatch] = useState<JobMatchResult | null>(null);
  const [stage, setStage] = useState<Stage>("analysis");

  const [starting, setStarting] = useState(true);
  const [startError, setStartError] = useState<string | null>(null);

  // Per-stage generated artefacts.
  const [cvResult, setCvResult] = useState<{ text: string; changes: any[]; blocked: string[]; before: number; after: number } | null>(null);
  const [letter, setLetter] = useState<{ text: string; blocked: string[]; removed: string[] } | null>(null);
  const [plan, setPlan] = useState<SmartApplyInterviewPlan | null>(null);
  const [linkedin, setLinkedin] = useState<SmartApplyLinkedInAdvice | null>(null);

  const [busy, setBusy] = useState<Stage | null>(null);
  const [applied, setApplied] = useState<{ done: boolean; duplicate: boolean } | null>(null);

  // Resolve job + CV from existing storage, then open a session.
  useEffect(() => {
    const ctx = resolveWorkspaceContext(jobId);
    setJob(ctx.job);
    setProfile(ctx.profile);
    setCandidate(ctx.candidate);
    setCvReady(ctx.cvReady);
    setStale(ctx.staleSelection);

    if (!ctx.job) {
      setStartError("no_job");
      setStarting(false);
      return;
    }
    if (!ctx.cvReady) {
      setStartError("cv_missing");
      setStarting(false);
      return;
    }

    let cancelled = false;
    createSmartApplySession({ job: ctx.job, candidate: ctx.candidate, profile: ctx.profile }).then((res) => {
      if (cancelled) return;
      if (res.ok && res.data) {
        setSessionId(res.data.sessionId);
        setMatch(res.data.match);
        smartApplyAnalytics.started({
          jobId: ctx.job?.id,
          provider: ctx.job?.provider,
          score: res.data.match.score,
          recommendation: res.data.match.recommendation,
          targetRole: ctx.job?.title,
          country: ctx.job?.country,
          confidence: res.data.match.confidence,
        });
      } else {
        setStartError(res.error || "start_failed");
      }
      setStarting(false);
    });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  // Bridge to the WorkZo Autofill extension, if installed. When a session is open we
  // hand the extension the sessionId and the profile, so its popup can fill forms on
  // the employer's page. This is a no-op when the extension is absent. We send only
  // what the extension needs, and it fetches the actual evidence-gated fill data from
  // the server itself using a scoped token, so the page never holds anything sensitive
  // beyond the profile the user already owns.
  useEffect(() => {
    const w = window as unknown as { chrome?: { runtime?: { sendMessage?: (id: string, msg: unknown) => void } } };
    // The extension's ID, exposed as a public env var (it is not a secret: anyone can
    // read an installed extension's ID). Set NEXT_PUBLIC_WORKZO_EXTENSION_ID in env.
    const extId = process.env.NEXT_PUBLIC_WORKZO_EXTENSION_ID;
    if (!extId || !w.chrome?.runtime?.sendMessage) return;

    // Push the profile as soon as we have it, session or not. This is what lets the
    // extension do Tier 2 (scrape + tailored fill) on EXTERNAL job sites the user finds
    // on their own: it needs the canonical CV cached, and the canonical CV lives
    // client-side, so a WorkZo page is the only place it can come from.
    if (profile) {
      try {
        w.chrome.runtime.sendMessage(extId, { type: "WORKZO_SET_PROFILE", profile });
      } catch {
        /* extension absent; ignore */
      }
    }

    // When a session is open, hand that over too (the in-app fill flow).
    if (sessionId && profile) {
      try {
        w.chrome.runtime.sendMessage(extId, { type: "WORKZO_SET_SESSION", sessionId, profile });
      } catch {
        /* ignore */
      }
    }
  }, [sessionId, profile]);

  async function runCv() {
    if (!sessionId || !profile) return;
    setBusy("cv");
    const res = await generateTailoredCv(sessionId, profile, candidate);
    if (res.ok && res.data) {
      setCvResult({
        text: res.data.document.plainText,
        changes: res.data.changes,
        blocked: res.data.blockedClaims,
        before: res.data.matchBefore,
        after: res.data.projectedMatchAfter,
      });
      smartApplyAnalytics.cvGenerated({
        jobId: job?.id,
        score: res.data.projectedMatchAfter,
        blockedClaimCount: res.data.blockedClaims.length,
        changeCount: res.data.changes.length,
      });
    }
    setBusy(null);
  }

  async function runLetter() {
    if (!sessionId || !profile) return;
    setBusy("cover_letter");
    const res = await generateCoverLetterDoc(sessionId, profile);
    if (res.ok && res.data) {
      setLetter({ text: res.data.document.plainText, blocked: res.data.blockedClaims, removed: res.data.removedClaims });
      smartApplyAnalytics.coverLetterGenerated({ jobId: job?.id, blockedClaimCount: res.data.blockedClaims.length });
    }
    setBusy(null);
  }

  async function runInterview() {
    if (!sessionId || !profile) return;
    setBusy("interview");
    const res = await generateInterviewPlan(sessionId, profile);
    if (res.ok && res.data) {
      setPlan(res.data.plan);
      smartApplyAnalytics.interviewPrepared({ jobId: job?.id, score: match?.score });
    }
    // LinkedIn advice is cheap and belongs in the same step; fetch it alongside.
    const li = await generateLinkedInAdvice(sessionId, []);
    if (li.ok && li.data) {
      setLinkedin(li.data.advice);
      smartApplyAnalytics.linkedinAdviceViewed({ jobId: job?.id });
    }
    setBusy(null);
  }

  async function confirmApplied() {
    if (!sessionId) return;
    const res = await markApplied(sessionId);
    if (res.ok) setApplied({ done: true, duplicate: Boolean(res.data?.application?.duplicate) });
  }

  const stageIndex = STAGES.findIndex((s) => s.id === stage);
  const canAdvance = stageIndex < STAGES.length - 1;

  return (
    <PremiumFeatureGate
      feature="smart_apply"
      title="Smart Apply is a Premium feature"
      description="Prepare a tailored, evidence-backed application, one job at a time."
    >
      <main className="min-h-screen bg-canvas text-fg">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between gap-4">
            <Link href="/jobs" className="inline-flex items-center gap-2 text-sm font-black text-muted hover:text-fg">
              <ArrowLeft className="h-4 w-4" /> Back to jobs
            </Link>
            {match && (
              <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black ${scoreLabel(match.score, match.confidence).bg} ${scoreLabel(match.score, match.confidence).text}`}>
                {scoreLabel(match.score, match.confidence).showScore
                  ? `${match.score} · ${scoreLabel(match.score, match.confidence).label}`
                  : scoreLabel(match.score, match.confidence).label}
              </div>
            )}
          </div>

          {stale && job && (
            <div className="mb-6 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/[0.06] p-3">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <p className="text-xs leading-5 text-muted">
                This is the last job you opened, which may not be the one in this link. Preparing an application for <span className="font-black text-fg">{cleanText(job.title)}</span> at {cleanText(job.company)}. If that is not right, go back and open the job again.
              </p>
            </div>
          )}

          {job && (
            <div className="mb-8">
              <h1 className="text-2xl font-black leading-tight text-fg sm:text-3xl">{cleanText(job.title)}</h1>
              <p className="mt-1 text-sm font-bold text-muted">
                {cleanText(job.company)}
                {job.location ? ` · ${cleanText(job.location)}` : ""}
              </p>
            </div>
          )}

          {/* Loading / error states */}
          {starting && (
            <div className="grid place-items-center rounded-2xl border border-line bg-surface/60 py-20">
              <div className="flex items-center gap-3 text-sm font-black text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Analysing this job against your CV…
              </div>
            </div>
          )}

          {!starting && startError && (
            <StartError error={startError} />
          )}

          {!starting && !startError && match && (
            <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
              {/* Stage rail */}
              <nav className="hidden lg:block">
                <ol className="sticky top-6 space-y-1">
                  {STAGES.map((s, i) => {
                    const Icon = s.icon;
                    const active = s.id === stage;
                    const done = i < stageIndex;
                    return (
                      <li key={s.id}>
                        <button
                          onClick={() => setStage(s.id)}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-black transition ${
                            active ? "bg-brand/15 text-brand" : done ? "text-fg hover:bg-fg/5" : "text-muted hover:bg-fg/5"
                          }`}
                        >
                          {done ? <CheckCircle2 className="h-4 w-4 text-success" /> : active ? <Icon className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                          {s.label}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </nav>

              {/* Stage content */}
              <div className="min-w-0 space-y-6">
                {stage === "analysis" && <AnalysisStage match={match} />}
                {stage === "cv" && <CvStage result={cvResult} busy={busy === "cv"} onGenerate={runCv} match={match} sessionId={sessionId} />}
                {stage === "cover_letter" && <LetterStage letter={letter} busy={busy === "cover_letter"} onGenerate={runLetter} match={match} />}
                {stage === "interview" && <InterviewStage plan={plan} linkedin={linkedin} busy={busy === "interview"} onGenerate={runInterview} job={job} />}
                {stage === "review" && (
                  <ReviewStage
                    job={job}
                    cvReady={Boolean(cvResult)}
                    letterReady={Boolean(letter)}
                    applied={applied}
                    onConfirmApplied={confirmApplied}
                  />
                )}

                {/* Stage nav */}
                <div className="flex items-center justify-between border-t border-line pt-5">
                  <button
                    onClick={() => stageIndex > 0 && setStage(STAGES[stageIndex - 1].id)}
                    disabled={stageIndex === 0}
                    className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-black text-muted disabled:opacity-40 hover:text-fg"
                  >
                    <ArrowLeft className="h-4 w-4" /> Back
                  </button>
                  {canAdvance && (
                    <button
                      onClick={() => setStage(STAGES[stageIndex + 1].id)}
                      className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-black text-on-brand hover:opacity-90"
                    >
                      Next: {STAGES[stageIndex + 1].label} <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </PremiumFeatureGate>
  );
}

/* ── stages ────────────────────────────────────────────────────────────────── */

function AnalysisStage({ match }: { match: JobMatchResult }) {
  const lowConfidence = match.confidence < LOW_CONFIDENCE;
  const tone = lowConfidence ? { text: "text-muted", bg: "bg-fg/5", label: "" } : scoreTone(match.score);
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line bg-surface/60 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-muted">Honest fit</p>
            {lowConfidence ? (
              <>
                <p className="mt-1 text-3xl font-black text-muted">Not enough detail</p>
                <p className="text-sm font-bold text-muted">This ad was too thin to score your fit against.</p>
              </>
            ) : (
              <>
                <p className={`mt-1 text-5xl font-black ${tone.text}`}>{match.score}</p>
                <p className={`text-sm font-black ${tone.text}`}>{tone.label}</p>
              </>
            )}
          </div>
          <div className="max-w-xs text-right">
            <p className="text-xs font-bold text-muted">
              Confidence {Math.round(match.confidence * 100)}%
            </p>
            <p className="mt-1 text-[11px] leading-4 text-muted">
              How much of this job ad we could read and check against your CV.
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-fg">{match.explanation}</p>
      </div>

      {match.concerns.length > 0 && (
        <div className="rounded-xl border border-line bg-canvas/40 p-4">
          <div className="mb-2 flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 text-warning" />
            <h4 className="text-sm font-black text-fg">Before you apply</h4>
          </div>
          <ul className="space-y-1.5">
            {match.concerns.map((c, i) => (
              <li key={i} className="text-xs leading-5 text-muted">{c}</li>
            ))}
          </ul>
        </div>
      )}

      <EvidencePanel match={match} />
    </div>
  );
}

function GenerateCard({ title, blurb, cta, busy, onGenerate, icon: Icon }: { title: string; blurb: string; cta: string; busy: boolean; onGenerate: () => void; icon: typeof FileText }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-line bg-surface/40 px-6 py-14 text-center">
      <Icon className="mb-3 h-7 w-7 text-brand" />
      <h3 className="text-lg font-black text-fg">{title}</h3>
      <p className="mt-1 max-w-md text-sm leading-6 text-muted">{blurb}</p>
      <button
        onClick={onGenerate}
        disabled={busy}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-black text-on-brand disabled:opacity-60 hover:opacity-90"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {busy ? "Working…" : cta}
      </button>
    </div>
  );
}

function CvStage({ result, busy, onGenerate, match, sessionId }: { result: any; busy: boolean; onGenerate: () => void; match: JobMatchResult; sessionId: string | null }) {
  if (!result) {
    return (
      <GenerateCard
        icon={FileText}
        title="Tailor your CV to this job"
        blurb="We reorder and re-emphasise what you already have so the most relevant experience is read first. Nothing is invented: your employers, dates, and titles stay exactly as they are."
        cta="Generate tailored CV"
        busy={busy}
        onGenerate={onGenerate}
      />
    );
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-canvas/40 p-4">
        <div className="text-sm font-bold text-muted">
          Match, reordered for this job: <span className="font-black text-fg">{result.before}</span>{" "}
          <ArrowRight className="inline h-3 w-3" /> <span className="font-black text-success">{result.after}</span>
        </div>
        {sessionId && (
          <div className="flex items-center gap-2">
            <a
              href={`/api/smart-apply/${sessionId}/export?format=pdf`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-black text-on-brand hover:opacity-90"
            >
              <Download className="h-3.5 w-3.5" /> PDF
            </a>
            <a
              href={`/api/smart-apply/${sessionId}/export?format=docx`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-fg/[0.04] px-3 py-1.5 text-xs font-black text-fg hover:bg-fg/[0.08]"
            >
              <Download className="h-3.5 w-3.5" /> Word
            </a>
          </div>
        )}
      </div>

      {result.changes.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface/60 p-5">
          <h3 className="mb-3 text-sm font-black text-fg">What changed</h3>
          <ul className="space-y-3">
            {result.changes.map((c: any, i: number) => (
              <li key={i} className="border-l-2 border-brand/40 pl-3">
                <p className="text-xs font-black text-fg">{c.section}</p>
                <p className="text-xs leading-5 text-muted">{c.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <BlockedClaims claims={result.blocked} />

      <div className="rounded-2xl border border-line bg-surface/60 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-black text-fg">Tailored CV</h3>
          <CopyButton text={result.text} />
        </div>
        <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-lg bg-canvas/50 p-4 text-xs leading-5 text-fg">{result.text}</pre>
      </div>

      <EvidencePanel match={match} />
    </div>
  );
}

function LetterStage({ letter, busy, onGenerate, match }: { letter: any; busy: boolean; onGenerate: () => void; match: JobMatchResult }) {
  if (!letter) {
    return (
      <GenerateCard
        icon={Mail}
        title="Draft a cover letter"
        blurb="Built only from achievements your CV proves, so you never have to defend a claim you cannot back up. This is a first draft to edit in your own voice, not a finished letter."
        cta="Generate cover letter"
        busy={busy}
        onGenerate={onGenerate}
      />
    );
  }
  return (
    <div className="space-y-6">
      <BlockedClaims claims={letter.blocked} />
      <div className="rounded-2xl border border-line bg-surface/60 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-black text-fg">Cover letter (draft)</h3>
          <CopyButton text={letter.text} />
        </div>
        <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-lg bg-canvas/50 p-4 text-sm leading-6 text-fg">{letter.text}</pre>
        <p className="mt-3 text-[11px] leading-4 text-muted">
          Edit this in your own words before sending. A letter that sounds like you beats a polished one that does not.
        </p>
      </div>
      <EvidencePanel match={match} />
    </div>
  );
}

function InterviewStage({ plan, linkedin, busy, onGenerate, job }: { plan: SmartApplyInterviewPlan | null; linkedin: SmartApplyLinkedInAdvice | null; busy: boolean; onGenerate: () => void; job: WorkZoJob | null }) {
  if (!plan) {
    return (
      <GenerateCard
        icon={MessageSquare}
        title="Prepare for the interview"
        blurb="Likely questions for this exact role, the CV evidence to lean on, and honest ways to handle the gaps a screener will probe. Built from this job, not a generic list."
        cta="Build interview prep"
        busy={busy}
        onGenerate={onGenerate}
      />
    );
  }
  return (
    <div className="space-y-5">
      <PlanBlock title="Likely questions" items={plan.likelyQuestions} />
      {plan.gapDefenseQuestions.length > 0 && (
        <div className="rounded-2xl border border-warning/30 bg-warning/[0.06] p-5">
          <h3 className="mb-3 text-sm font-black text-fg">Handling the gaps, honestly</h3>
          <ul className="space-y-2">
            {plan.gapDefenseQuestions.map((q, i) => (
              <li key={i} className="text-xs leading-5 text-muted">{q}</li>
            ))}
          </ul>
        </div>
      )}
      <PlanBlock title="Technical scenarios to expect" items={plan.technicalScenarios} />
      {plan.storiesToPrepare.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface/60 p-5">
          <h3 className="mb-3 text-sm font-black text-fg">Stories to prepare</h3>
          <ul className="space-y-2.5">
            {plan.storiesToPrepare.map((s, i) => (
              <li key={i} className="border-l-2 border-brand/40 pl-3">
                <p className="text-xs font-black text-fg">{s.competency}</p>
                <p className="text-xs leading-5 text-muted">{s.evidence}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      <PlanBlock title="What a recruiter may flag" items={plan.recruiterRisks} tone="muted" />

      {linkedin && (linkedin.considerPermanent.length > 0 || linkedin.tailoredCvOnly.length > 0) && (
        <div className="rounded-2xl border border-line bg-surface/60 p-5">
          <h3 className="mb-2 text-sm font-black text-fg">LinkedIn</h3>
          <p className="mb-3 text-xs leading-5 text-muted">{linkedin.reasoning}</p>
          {linkedin.considerPermanent.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-black text-success">Worth adding permanently</p>
              <p className="text-xs leading-5 text-muted">{linkedin.considerPermanent.join(", ")}</p>
            </div>
          )}
          {linkedin.tailoredCvOnly.length > 0 && (
            <div>
              <p className="text-xs font-black text-muted">This application only</p>
              <p className="text-xs leading-5 text-muted">{linkedin.tailoredCvOnly.join(", ")}</p>
            </div>
          )}
        </div>
      )}

      <Link
        href="/interview"
        className="inline-flex items-center gap-2 rounded-xl border border-brand bg-brand/10 px-5 py-2.5 text-sm font-black text-brand hover:bg-brand/15"
      >
        Practise this interview <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function PlanBlock({ title, items, tone }: { title: string; items: string[]; tone?: "muted" }) {
  if (!items.length) return null;
  return (
    <div className="rounded-2xl border border-line bg-surface/60 p-5">
      <h3 className="mb-3 text-sm font-black text-fg">{title}</h3>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className={`text-xs leading-5 ${tone === "muted" ? "text-muted" : "text-fg"}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function ReviewStage({ job, cvReady, letterReady, applied, onConfirmApplied }: { job: WorkZoJob | null; cvReady: boolean; letterReady: boolean; applied: { done: boolean; duplicate: boolean } | null; onConfirmApplied: () => void }) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line bg-surface/60 p-6">
        <h3 className="text-sm font-black text-fg">Your application, ready to send</h3>
        <ul className="mt-4 space-y-2.5">
          <ReadyRow ok={cvReady} label="Tailored CV" hint="reorders your real experience for this job" />
          <ReadyRow ok={letterReady} label="Cover letter draft" hint="built from proven achievements" />
        </ul>
        <p className="mt-4 text-xs leading-5 text-muted">
          WorkZo does not submit anything for you. You apply on the employer's own page, in full control of what you send.
        </p>
      </div>

      {isLikelyValidUrl(job?.applyUrl) ? (
        <a
          href={job!.applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            smartApplyAnalytics.externalApplyClicked({
              jobId: job!.id,
              provider: job!.provider,
              recommendation: undefined,
            })
          }
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-black text-on-brand hover:opacity-90"
        >
          Open the employer's application page <ExternalLink className="h-4 w-4" />
        </a>
      ) : (
        <div className="rounded-xl border border-line bg-canvas/40 p-4">
          <p className="text-sm font-bold text-fg">No direct application link for this job.</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            This posting did not include a working apply link. Search the company's careers page for the role, then use your tailored CV and cover letter above.
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-line bg-canvas/40 p-5">
        {applied?.done ? (
          <div className="flex items-center gap-2 text-sm font-black text-success">
            <CheckCircle2 className="h-4 w-4" />
            {applied.duplicate ? "Already tracked. You applied to this one before." : "Saved to your application tracker."}
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm font-bold text-fg">Applied? Track it so you can follow up.</p>
            <button
              onClick={onConfirmApplied}
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-fg/[0.04] px-5 py-2.5 text-sm font-black text-fg hover:bg-fg/[0.08]"
            >
              <Check className="h-4 w-4" /> I applied to this job
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ReadyRow({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <li className="flex items-center gap-3">
      {ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" /> : <Circle className="h-4 w-4 shrink-0 text-muted" />}
      <span className="text-sm font-black text-fg">{label}</span>
      <span className="text-xs text-muted">{hint}</span>
    </li>
  );
}

function StartError({ error }: { error: string }) {
  const content =
    error === "no_job"
      ? { title: "Pick a job first", body: "Open a job from your search results to start Smart Apply.", cta: "Browse jobs", href: "/jobs" }
      : error === "cv_missing"
        ? { title: "Add your CV first", body: "Smart Apply builds everything from your CV, so it needs one to work from.", cta: "Upload your CV", href: "/cv" }
        : { title: "Could not start", body: "Something went wrong opening this session. Please try again from your job results.", cta: "Back to jobs", href: "/jobs" };

  return (
    <div className="grid place-items-center rounded-2xl border border-line bg-surface/60 py-16 text-center">
      <TriangleAlert className="mb-3 h-7 w-7 text-warning" />
      <h3 className="text-lg font-black text-fg">{content.title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-6 text-muted">{content.body}</p>
      <Link href={content.href} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-black text-on-brand hover:opacity-90">
        {content.cta} <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
