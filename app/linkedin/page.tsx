"use client";

/**
 * AI LinkedIn Career Optimizer - items 2 and 3.
 *
 * This page reads the CV through `resolveCvSource()` and nothing else. It never
 * re-parses text, never reads the interview setup store directly, and never
 * assumes a profile exists. If the canonical profile is absent it renders
 * CvSourcePanel and waits, exactly like Improve CV now does.
 *
 * That constraint is the reason this feature is buildable at all: the value of
 * a consistency checker is entirely downstream of the CV being parsed correctly.
 * A LinkedIn optimizer sitting on a corrupted profile does not produce a weaker
 * report - it produces a confidently wrong one, telling the candidate their
 * LinkedIn disagrees with a CV we mis-read.
 */

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Copy,
  FileUp,
  Info,
  Loader2,
  Lock,
  Plus,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import CvSourcePanel from "@/components/CvSourcePanel";
import { resolveCvSource } from "@/lib/workzoCvSource";
import { useWorkZoAuthoritativePlan } from "@/lib/workzoClientPlan";
import { canUseWorkZoFeature } from "@/lib/workzoPlanLimits";
import type { ResumeProfile } from "@/lib/workzoResumeParser";
import type {
  ConsistencyFinding,
  ConsistencySeverity,
  KeywordFinding,
  LinkedInAnalysis,
} from "@/lib/workzoLinkedInEngine";
import type { LinkedInProfile } from "@/lib/workzoLinkedInParser";
import type { GuardViolation } from "@/lib/workzoLinkedInRewriteGuard";

type RewriteResult = {
  headline: string;
  about: string;
  violations: GuardViolation[];
  keywordsApplied: string[];
  keywordsRefused: string[];
  matchScoreBefore: number;
  matchScoreTarget: number;
  experienceRefinements?: { company?: string; current?: string; suggestedUpdate?: string }[];
  featuredSectionAdvice?: string;
};

const SEVERITY_STYLES: Record<ConsistencySeverity, { chip: string; label: string }> = {
  high: { chip: "bg-danger/10 text-danger", label: "Recruiters notice this" },
  medium: { chip: "bg-warning/10 text-warning", label: "Worth fixing" },
  low: { chip: "bg-fg/10 text-muted", label: "Minor" },
};

function scoreTier(score: number) {
  if (score >= 80) return { label: "Optimized", stroke: "stroke-success", text: "text-success", track: "text-success/15" };
  if (score >= 60) return { label: "Needs polish", stroke: "stroke-warning", text: "text-warning", track: "text-warning/15" };
  return { label: "Urgent audit", stroke: "stroke-danger", text: "text-danger", track: "text-danger/15" };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightedText({ text, keywords, className = "" }: { text: string; keywords: string[]; className?: string }) {
  const cleanKeywords = Array.from(new Set(keywords.map((item) => item.trim()).filter((item) => item.length >= 2)))
    .sort((a, b) => b.length - a.length)
    .slice(0, 24);
  if (!cleanKeywords.length) return <span className={className}>{text}</span>;
  const pattern = new RegExp(`(${cleanKeywords.map(escapeRegExp).join("|")})`, "gi");
  const keywordSet = new Set(cleanKeywords.map((item) => item.toLowerCase()));
  return (
    <span className={className}>
      {text.split(pattern).map((part, index) =>
        keywordSet.has(part.toLowerCase()) ? (
          <mark key={`${part}-${index}`} className="rounded bg-success/12 px-0.5 font-bold text-success">
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </span>
  );
}

function ScoreCard({
  label,
  score,
  potential,
  caption,
}: {
  label: string;
  score: number;
  potential?: number;
  caption: string;
}) {
  const tier = scoreTier(score);
  const circumference = 2 * Math.PI * 38;
  const offset = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference;
  return (
    <div className="rounded-2xl border border-line bg-canvas p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="relative h-24 w-24 shrink-0">
          <svg viewBox="0 0 96 96" className="h-24 w-24 -rotate-90">
            <circle cx="48" cy="48" r="38" fill="none" stroke="currentColor" strokeWidth="8" className={tier.track} />
            <circle
              cx="48"
              cy="48"
              r="38"
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className={tier.stroke}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <span className="text-2xl font-black text-fg">{score}</span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide text-muted">{label}</p>
          <p className={`mt-1 text-xs font-black ${tier.text}`}>{tier.label}</p>
          {typeof potential === "number" && potential > score ? (
            <span className="mt-1 inline-flex items-center gap-1 text-xs font-black text-success">
              <TrendingUp className="h-3.5 w-3.5" /> {potential} achievable
            </span>
          ) : null}
        </div>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-fg/[0.06]">
        <div
          className={`h-full rounded-full ${score >= 80 ? "bg-success" : score >= 60 ? "bg-warning" : "bg-danger"}`}
          style={{ width: `${Math.max(4, Math.min(100, score))}%` }}
        />
      </div>
      <p className="mt-3 text-xs leading-5 text-muted">{caption}</p>
    </div>
  );
}

function KeywordList({
  title,
  description,
  tone,
  icon,
  items,
}: {
  title: string;
  description: string;
  tone: string;
  icon: ReactNode;
  items: KeywordFinding[];
}) {
  if (!items.length) return null;
  return (
    <div className="rounded-2xl border border-line bg-canvas p-5">
      <p className={`inline-flex items-center gap-2 text-sm font-black ${tone}`}>
        {icon} {title}
      </p>
      <p className="mt-1 text-xs text-muted">{description}</p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.keyword} className="rounded-lg border border-line px-3 py-2">
            <p className="text-sm font-black text-fg">{item.keyword}</p>
            <p className="mt-0.5 text-xs text-muted">{item.action}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FindingRow({ finding }: { finding: ConsistencyFinding }) {
  const style = SEVERITY_STYLES[finding.severity];
  const copyValue = finding.cv || finding.linkedin || finding.message;
  const canSync = Boolean(finding.cv && finding.linkedin);
  const panelBase = "min-h-[92px] rounded-xl border p-4 text-left";
  return (
    <li className="overflow-hidden rounded-2xl border border-line bg-canvas shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-fg/[0.015] px-5 py-4">
        <div>
          <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-black ${style.chip}`}>
            {style.label}
          </span>
          <p className="mt-2 text-sm font-black text-fg">{finding.message}</p>
        </div>
        {copyValue ? (
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(copyValue)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-canvas px-3 py-2 text-xs font-black text-fg hover:border-brand"
          >
            <Copy className="h-3.5 w-3.5" /> Copy clean text
          </button>
        ) : null}
      </div>

      {finding.cv || finding.linkedin ? (
        <div className="grid items-stretch lg:grid-cols-[1fr_56px_1fr]">
          <div className="p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-subtle">CV source of truth</p>
            <div className={`${panelBase} mt-2 border-line bg-fg/[0.02]`}>
              <p className="text-sm font-semibold leading-6 text-fg">{finding.cv || "Not listed"}</p>
            </div>
          </div>
          <div className="relative hidden place-items-center lg:grid">
            <span className="absolute left-0 right-0 top-1/2 border-t border-dashed border-line" aria-hidden="true" />
            <span className="relative z-10 rounded-full border border-line bg-canvas px-2 py-1 text-xs font-black text-muted">⇄</span>
          </div>
          <div className="border-t border-line p-5 lg:border-l-0 lg:border-t-0">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-subtle">Current LinkedIn</p>
            <div
              className={`${panelBase} mt-2 ${
                finding.severity === "high"
                  ? "border-danger/35 bg-danger/[0.035]"
                  : "border-warning/30 bg-warning/[0.035]"
              }`}
            >
              <p className="text-sm font-semibold leading-6 text-fg">{finding.linkedin || "Not listed"}</p>
            </div>
            {canSync ? (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(finding.cv || "")}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-xs font-black text-on-brand hover:bg-brand-strong"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Use CV wording
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {finding.items?.length ? (
        <div className="flex flex-wrap gap-1.5 px-5 py-4">
          {finding.items.map((item) => (
            <span key={item} className="rounded-md border border-line bg-fg/[0.03] px-2 py-1 text-xs font-bold text-fg">
              {item}
            </span>
          ))}
        </div>
      ) : null}
    </li>
  );
}

function CorpusKeywordGroups({ items }: { items: NonNullable<LinkedInAnalysis["corpus"]>["singleJobCvKeywords"] }) {
  const labels: Record<string, string> = {
    technical: "Technical stack",
    operations: "Operational methods",
    client: "Client context",
    business: "Business context",
    other: "Other role signals",
  };
  const groups = items.reduce<Record<string, typeof items>>((acc, item) => {
    const category = item.category || "other";
    (acc[category] ||= []).push(item);
    return acc;
  }, {});
  if (!items.length) return <span className="text-xs text-muted">No isolated single-job terms detected.</span>;
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      {Object.entries(groups).map(([category, values]) => (
        <div key={category} className="rounded-xl border border-line bg-fg/[0.015] p-4">
          <p className="text-xs font-black uppercase tracking-wide text-muted">{labels[category] || labels.other}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {values.map((item) => (
              <span
                key={item.normalized}
                className="rounded-lg border border-warning/30 bg-warning/[0.06] px-2.5 py-1.5 text-xs font-bold text-warning"
                title={item.action}
              >
                {item.keyword} · {item.supportCount}/{item.totalJds}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LinkedInOptimizerPage() {
  const [profile, setProfile] = useState<ResumeProfile | null>(null);
  const [cvText, setCvText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [jobDescriptions, setJobDescriptions] = useState<string[]>(["", "", ""]);
  const [linkedinText, setLinkedinText] = useState("");
  const [mode, setMode] = useState<"paste" | "pdf">("paste");
  const [imported, setImported] = useState<LinkedInProfile | null>(null);
  const [importNotice, setImportNotice] = useState("");
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [analysis, setAnalysis] = useState<LinkedInAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [rewrite, setRewrite] = useState<RewriteResult | null>(null);
  const [rewriting, setRewriting] = useState(false);
  const [rewriteError, setRewriteError] = useState("");

  const planState = useWorkZoAuthoritativePlan();
  const canRewrite = canUseWorkZoFeature(planState.plan, "linkedin_rewrite");

  useEffect(() => {
    const source = resolveCvSource();
    setProfile(source.profile);
    setCvText(source.rawCvText);
    setJobDescription(source.jobDescription);
    setTargetRole(source.targetRole || source.profile?.basics?.headline || "");
  }, []);

  const cvReady = Boolean(profile);
  const linkedinReady = mode === "pdf" ? Boolean(imported) : linkedinText.trim().length >= 80;
  const activeJds = useMemo(() => jobDescriptions.map((jd) => jd.trim()).filter((jd) => jd.length >= 80).slice(0, 5), [jobDescriptions]);
  const canRun = cvReady && linkedinReady;

  /** Whichever input the user chose. The PDF path is already structured. */
  function linkedinPayload() {
    return mode === "pdf" ? { linkedinProfile: imported } : { linkedinText };
  }

  const jdMatch = analysis?.jdMatch ?? null;
  const consistency = analysis?.consistency ?? null;

  const highIssues = useMemo(
    () => consistency?.findings.filter((f) => f.severity === "high").length ?? 0,
    [consistency],
  );

  async function handleAnalyze() {
    if (!canRun || !profile) return;
    setLoading(true);
    setError("");
    setAnalysis(null);
    setRewrite(null);
    setRewriteError("");
    try {
      const response = await fetch("/api/linkedin/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...linkedinPayload(), jobDescription: activeJds[0] || jobDescription, jobDescriptionCorpus: activeJds, targetRole, cvText, resumeProfile: profile }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Analysis failed.");
      setAnalysis(data as LinkedInAnalysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleImportPdf(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setError("");
    setImported(null);
    setImportNotice("");
    setFileName(file.name);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/linkedin/import-pdf", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Could not read that PDF.");
      setImported(data.linkedinProfile as LinkedInProfile);
      setImportNotice(String(data.notice || ""));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that PDF.");
      setFileName("");
    } finally {
      setImporting(false);
      if (event.target) event.target.value = "";
    }
  }

  async function handleRewrite() {
    if (!profile || (!jobDescription.trim() && !activeJds.length)) return;
    setRewriting(true);
    setRewriteError("");
    setRewrite(null);
    try {
      const response = await fetch("/api/linkedin/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...linkedinPayload(), jobDescription: activeJds[0] || jobDescription, jobDescriptionCorpus: activeJds, targetRole, cvText, resumeProfile: profile }),
      });
      const data = await response.json().catch(() => null);
      if (response.status === 403 || data?.error === "upgrade_required") {
        throw new Error("Rewriting your profile is a Premium feature.");
      }
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Rewrite failed.");
      setRewrite(data as RewriteResult);
    } catch (err) {
      setRewriteError(err instanceof Error ? err.message : "Rewrite failed.");
    } finally {
      setRewriting(false);
    }
  }

  function updateJobDescription(index: number, value: string) {
    setJobDescriptions((current) => current.map((item, i) => (i === index ? value : item)));
  }

  function addJobDescriptionBox() {
    setJobDescriptions((current) => (current.length >= 5 ? current : [...current, ""]));
  }

  return (
    <main className={`mx-auto max-w-6xl px-4 py-10 sm:px-6 ${analysis ? "pb-28" : ""}`}>
      <header className="mb-8">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-2 rounded-xl border border-line bg-canvas px-3 py-2 text-xs font-black text-fg hover:border-brand"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
        </Link>
        <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-brand">
          <Sparkles className="h-4 w-4" /> LinkedIn Optimizer
        </span>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-fg sm:text-4xl">
          Make your LinkedIn agree with your CV, and with the job.
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
          Recruiters cross-check your profile against your CV in seconds. WorkZo finds every mismatch,
          shows the keywords you are missing for your target roles, and rewrites your headline and
          About section, without inventing anything you cannot back up.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            ["1", "Connect your CV", "Reused from your last upload. No re-typing."],
            ["2", "Add your LinkedIn", "Paste it or upload the PDF export."],
            ["3", "Paste 3 to 5 target JDs", "WorkZo keeps only the signals that repeat across roles."],
          ].map(([n, title, text]) => (
            <div key={n} className="flex items-start gap-3 rounded-2xl border border-line bg-fg/[0.02] p-4">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand/10 text-xs font-black text-brand">
                {n}
              </span>
              <span>
                <span className="block text-sm font-black text-fg">{title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-muted">{text}</span>
              </span>
            </div>
          ))}
        </div>
      </header>

      {!cvReady ? (
        <section className="mb-6">
          <CvSourcePanel
            heading="Add your CV first"
            subheading="The consistency check compares your LinkedIn profile against your real CV. Upload it once and every WorkZo tool reuses it."
            initialJobDescription={jobDescription}
            onLoaded={(result) => {
              setProfile(result.resumeProfile);
              setCvText(result.rawCvText);
              setJobDescription(result.jobDescription);
              setTargetRole(result.targetRole || result.resumeProfile.basics?.headline || "");
            }}
          />
        </section>
      ) : null}

      <section className="rounded-2xl border border-line bg-fg/[0.02] p-5 sm:p-6">
        <p className="text-base font-black tracking-tight text-fg">Add your LinkedIn profile</p>
        <p className="mt-1 text-sm text-muted">
          Pasting is the most complete. The PDF export is faster, but LinkedIn only puts your top
          skills in it.
        </p>

        <div className="mt-4 inline-flex rounded-xl border border-line bg-canvas p-1 text-xs font-black">
          <button
            onClick={() => setMode("paste")}
            className={`rounded-lg px-3 py-1.5 ${mode === "paste" ? "bg-brand text-on-brand" : "text-muted hover:text-fg"}`}
          >
            Paste profile
          </button>
          <button
            onClick={() => setMode("pdf")}
            className={`rounded-lg px-3 py-1.5 ${mode === "pdf" ? "bg-brand text-on-brand" : "text-muted hover:text-fg"}`}
          >
            Upload LinkedIn PDF
          </button>
        </div>

        {mode === "paste" ? (
          <>
            <p className="mt-4 text-sm text-muted">
              Open your profile, select the whole page, and copy. Duplicated lines are expected - we
              handle them.
            </p>
            <textarea
              value={linkedinText}
              onChange={(event) => setLinkedinText(event.target.value)}
              rows={10}
              placeholder="Your name, headline, About, Experience, Education, Skills…"
              className="mt-2 w-full rounded-xl border border-line bg-canvas px-4 py-3 text-sm text-fg placeholder:text-subtle focus:border-brand focus:outline-none"
            />
          </>
        ) : (
          <div className="mt-4">
            <p className="text-sm text-muted">
              On LinkedIn, open your profile → <span className="font-black text-fg">More</span> (or
              Resources) → <span className="font-black text-fg">Save to PDF</span>. Upload that file.
              Nothing is scraped; you export your own data.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              onChange={handleImportPdf}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-canvas px-4 py-6 text-sm font-black text-fg hover:border-brand disabled:opacity-50"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
              {importing ? "Reading your profile…" : fileName ? `Replace ${fileName}` : "Choose Profile.pdf"}
            </button>

            {imported ? (
              <div className="mt-3 rounded-xl border border-line bg-fg/[0.02] p-4">
                <p className="inline-flex items-center gap-2 text-sm font-black text-success">
                  <CheckCircle2 className="h-4 w-4" /> Imported {imported.name || "your profile"}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {imported.experience.length} roles · {imported.skills.length} skills ·{" "}
                  {imported.education.length} education entries
                </p>
                {/* The export's limits are stated up front, not discovered later
                    in a report that quietly omits a check. */}
                {importNotice ? (
                  <p className="mt-2 inline-flex items-start gap-2 text-xs text-muted">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {importNotice}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        <div className="mt-5 rounded-2xl border border-line bg-canvas p-4">
          <p className="text-sm font-black text-fg">Target role corpus</p>
          <p className="mt-1 text-xs text-muted">
            Paste 3-5 jobs for the same target direction. WorkZo promotes only terms with 60%+ support into the permanent LinkedIn strategy.
          </p>
          <input
            value={targetRole}
            onChange={(event) => setTargetRole(event.target.value)}
            placeholder="Target role, e.g. Junior Data Analyst, IT Support Engineer, Customer Success Manager"
            className="mt-3 w-full rounded-xl border border-line bg-fg/[0.02] px-4 py-3 text-sm text-fg placeholder:text-subtle focus:border-brand focus:outline-none"
          />
          <div className="mt-3 grid gap-3">
            {jobDescriptions.map((jd, index) => (
              <textarea
                key={index}
                value={jd}
                onChange={(event) => updateJobDescription(index, event.target.value)}
                rows={index === 0 ? 5 : 3}
                placeholder={`Target JD ${index + 1}${index < 3 ? " - recommended" : " - optional"}`}
                className="w-full rounded-xl border border-line bg-fg/[0.02] px-4 py-3 text-sm text-fg placeholder:text-subtle focus:border-brand focus:outline-none"
              />
            ))}
          </div>
          {jobDescriptions.length < 5 ? (
            <button
              type="button"
              onClick={addJobDescriptionBox}
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-xs font-black text-fg hover:border-brand"
            >
              <Plus className="h-3.5 w-3.5" /> Add another target JD
            </button>
          ) : null}
          <p className="mt-2 text-xs text-muted">
            Active corpus: <span className="font-black text-fg">{activeJds.length}</span> JD{activeJds.length === 1 ? "" : "s"}. You can still analyze with fewer while testing.
          </p>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={!canRun || loading}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-black text-on-brand hover:bg-brand-strong disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
          {loading ? "Analyzing…" : "Analyze my LinkedIn"}
        </button>

        {error ? (
          <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-2 text-xs font-bold text-danger">
            <AlertTriangle className="h-3.5 w-3.5" /> {error}
          </p>
        ) : null}
      </section>

      {analysis && consistency ? (
        <>
          <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ScoreCard
              label="Overall Career Brand"
              score={analysis.careerBrandHealth.overallCareerBrand}
              caption="Unified score across search, CV consistency, and recruiter skim strength."
            />
            <ScoreCard
              label="Search Discoverability"
              score={analysis.careerBrandHealth.searchDiscoverability}
              potential={jdMatch?.potentialScore}
              caption={jdMatch ? `Across ${jdMatch.termCount} macro-role keywords.` : analysis.corpus ? "No 60%+ macro keywords detected yet; no risky SEO gaps counted." : "Add target JDs to calculate search visibility."}
            />
            <ScoreCard
              label="Profile Consistency"
              score={analysis.careerBrandHealth.profileConsistency}
              caption={highIssues ? `${highIssues} high-risk inconsistency found.` : "Your CV and LinkedIn tell the same story."}
            />
            <ScoreCard
              label="20-sec recruiter skim"
              score={analysis.careerBrandHealth.recruiterBlindImpression}
              caption={analysis.blindImpression.summary}
            />
          </section>

          {analysis.corpus ? (
            <section className="mt-8 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-line bg-canvas p-5">
                <p className="text-sm font-black text-fg">Global Profile Promotion</p>
                <p className="mt-1 text-xs text-muted">
                  These terms reached the 60%+ support threshold across {analysis.corpus.jdCount} target JDs. Add only the CV-backed ones to your permanent LinkedIn profile.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {analysis.corpus.globalProfileKeywords.length ? analysis.corpus.globalProfileKeywords.map((item) => (
                    <span key={item.normalized} className="rounded-md bg-success/10 px-2 py-1 text-xs font-bold text-success">
                      {item.keyword} · {item.supportCount}/{item.totalJds}
                    </span>
                  )) : <span className="text-xs text-muted">Your current profile successfully balances these target roles. No missing macro-keywords crossed the 60% threshold.</span>}
                </div>
              </div>
              <div className="rounded-2xl border border-line bg-canvas p-5">
                <p className="text-sm font-black text-fg">Single-Job CV Tailoring</p>
                <p className="mt-1 text-xs text-muted">
                  These appeared below the 60% threshold. Use them only when tailoring a CV for that exact company; do not permanently add them to LinkedIn unless your CV proves them.
                </p>
                <CorpusKeywordGroups items={analysis.corpus.singleJobCvKeywords.slice(0, 18)} />
              </div>
            </section>
          ) : null}

          {analysis.corpus?.recruiterQueries?.length ? (
            <section className="mt-8 rounded-2xl border border-line bg-fg/[0.02] p-5">
              <h2 className="text-lg font-black tracking-tight text-fg">Recruiter search reverse-engineering</h2>
              <p className="mt-1 text-sm text-muted">Boolean-style searches you are visible or invisible for based on the top macro-role signals.</p>
              <div className="mt-4 grid gap-3">
                {analysis.corpus.recruiterQueries.map((query, index) => (
                  <div key={index} className="rounded-xl border border-line bg-canvas p-4">
                    <p className="text-sm font-bold text-fg">{query.query}</p>
                    <p className={`mt-1 text-xs font-black ${query.visible ? "text-success" : "text-danger"}`}>
                      {query.visible ? "Visible" : `Invisible because missing: ${query.missingTerms.join(", ")}`}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-8 rounded-2xl border border-line bg-canvas p-5">
            <h2 className="text-lg font-black tracking-tight text-fg">20-second recruiter blind impression</h2>
            <p className="mt-1 text-sm text-muted">
              Verdict: <span className={`font-black ${analysis.blindImpression.verdict === "message" ? "text-success" : analysis.blindImpression.verdict === "maybe" ? "text-warning" : "text-danger"}`}>
                {analysis.blindImpression.verdict === "message" ? "CONTINUE READING" : analysis.blindImpression.verdict === "maybe" ? "BORDERLINE" : "LIKELY SKIP"}
              </span> - {analysis.blindImpression.summary}
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-muted">Why I may skip</p>
                <ul className="mt-2 space-y-2">
                  {analysis.blindImpression.skipReasons.map((reason, index) => (
                    <li key={index} className="rounded-lg bg-danger/10 px-3 py-2 text-xs font-bold text-danger">{reason}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-muted">Why I may keep reading</p>
                <ul className="mt-2 space-y-2">
                  {analysis.blindImpression.nextClickReasons.map((reason, index) => (
                    <li key={index} className="rounded-lg bg-success/10 px-3 py-2 text-xs font-bold text-success">{reason}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-black tracking-tight text-fg">
              Where your CV and LinkedIn disagree
            </h2>
            {!consistency.skillsChecked ? (
              <p className="mt-2 inline-flex items-start gap-2 rounded-lg bg-fg/[0.03] px-3 py-2 text-xs text-muted">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> The PDF export carries only your top
                skills, so the skills check was skipped rather than guessed. Paste your profile to run
                it.
              </p>
            ) : null}
            {consistency.findings.length ? (
              <ul className="mt-4 space-y-3">
                {consistency.findings.map((finding, index) => (
                  <FindingRow key={`${finding.code}-${index}`} finding={finding} />
                ))}
              </ul>
            ) : (
              <p className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-success">
                <CheckCircle2 className="h-4 w-4" /> No inconsistencies found across{" "}
                {consistency.matchedRoles} matched roles.
              </p>
            )}
          </section>

          {jdMatch ? (
            <section className="mt-8">
              <h2 className="text-lg font-black tracking-tight text-fg">
                What recruiters search for, and what they find
              </h2>
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <KeywordList
                  title="Add these now"
                  description="Your CV proves each one. Putting them on LinkedIn costs nothing and risks nothing."
                  tone="text-success"
                  icon={<Plus className="h-4 w-4" />}
                  items={jdMatch.add}
                />
                <KeywordList
                  title="Move these up"
                  description="Already on your profile, buried where LinkedIn search barely weighs them."
                  tone="text-warning"
                  icon={<TrendingUp className="h-4 w-4" />}
                  items={jdMatch.promote}
                />
                <KeywordList
                  title="Real gaps"
                  description="These are real target-role gaps only. WorkZo filters out conversational JD filler and never tells you to claim unsupported skills."
                  tone="text-danger"
                  icon={<AlertTriangle className="h-4 w-4" />}
                  items={jdMatch.gaps}
                />
              </div>

              {jdMatch.matched.length ? (
                <div className="mt-4 rounded-2xl border border-line bg-fg/[0.02] p-5">
                  <p className="inline-flex items-center gap-2 text-sm font-black text-fg">
                    <CheckCircle2 className="h-4 w-4 text-success" /> Already visible to recruiter
                    search
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {jdMatch.matched.map((item) => (
                      <span
                        key={item.keyword}
                        className="rounded-md bg-success/10 px-2 py-1 text-xs font-bold text-success"
                      >
                        {item.keyword}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {/* Rewrite center: static context only. The action itself lives in the single bottom bar. */}
          <section className="mt-8 rounded-2xl border border-brand/15 bg-brand/[0.025] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="inline-flex items-center gap-2 text-sm font-black text-fg">
                  {canRewrite ? <Sparkles className="h-4 w-4 text-brand" /> : <Lock className="h-4 w-4" />}
                  Rewrite center
                </p>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                  WorkZo builds a recruiter-search-ready headline, About section, experience refinements, and featured-section advice from your verified CV and active target-role corpus. Unsupported claims are removed automatically.
                </p>
              </div>
              {rewrite ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1.5 text-xs font-black text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Rewrite ready
                </span>
              ) : null}
            </div>
            {rewriteError ? (
              <div className="mt-4 rounded-xl border border-danger/20 bg-danger/[0.04] p-4">
                <p className="inline-flex items-center gap-2 text-sm font-black text-danger">
                  <AlertTriangle className="h-4 w-4" /> Rewrite needs attention
                </p>
                <p className="mt-1 text-xs leading-5 text-muted">{rewriteError}</p>
              </div>
            ) : null}
          </section>

          {rewrite ? (
            <section className="mt-6 space-y-4">
              <div className="overflow-hidden rounded-2xl border border-line bg-canvas">
                <div className="border-b border-line px-5 py-4">
                  <p className="text-xs font-black uppercase tracking-wide text-muted">Recommended LinkedIn headline</p>
                  <p className="mt-1 text-xs text-muted">Highlighted phrases are target-role keywords already supported by your CV.</p>
                </div>
                <div className="border-l-4 border-success bg-success/[0.025] px-5 py-5">
                  <p className="text-sm font-bold leading-6 text-fg">
                    <HighlightedText text={rewrite.headline} keywords={rewrite.keywordsApplied || []} />
                  </p>
                </div>
                <div className="flex justify-end border-t border-line px-5 py-3">
                  <button
                    onClick={() => navigator.clipboard.writeText(rewrite.headline)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-black text-fg hover:border-brand"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy headline
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-line bg-canvas">
                <div className="border-b border-line px-5 py-4">
                  <p className="text-xs font-black uppercase tracking-wide text-muted">Recommended About section</p>
                  <p className="mt-1 text-xs text-muted">Structured for recruiter scanning while preserving only verified evidence.</p>
                </div>
                <div className="border-l-4 border-success bg-success/[0.025] px-5 py-5">
                  <div className="whitespace-pre-wrap text-sm leading-7 text-fg">
                    <HighlightedText text={rewrite.about} keywords={rewrite.keywordsApplied || []} />
                  </div>
                </div>
                <div className="flex justify-end border-t border-line px-5 py-3">
                  <button
                    onClick={() => navigator.clipboard.writeText(rewrite.about)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-black text-fg hover:border-brand"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy About
                  </button>
                </div>
              </div>

              {rewrite.experienceRefinements?.length ? (
                <div className="rounded-2xl border border-line bg-canvas p-5">
                  <p className="text-xs font-black uppercase tracking-wide text-muted">Experience section updates</p>
                  <div className="mt-4 space-y-4">
                    {rewrite.experienceRefinements.map((item, index) => (
                      <div key={index} className="overflow-hidden rounded-xl border border-line">
                        <div className="border-b border-line bg-fg/[0.015] px-4 py-3">
                          <p className="text-sm font-black text-fg">{item.company || `Role ${index + 1}`}</p>
                        </div>
                        {item.current ? (
                          <div className="border-l-4 border-danger bg-danger/[0.025] px-4 py-3">
                            <p className="text-[11px] font-black uppercase tracking-wide text-danger">Current</p>
                            <p className="mt-1 text-sm leading-6 text-fg">{item.current}</p>
                          </div>
                        ) : null}
                        <div className="border-l-4 border-success bg-success/[0.025] px-4 py-4">
                          <p className="text-[11px] font-black uppercase tracking-wide text-success">Premium approved output</p>
                          <p className="mt-1 text-sm font-semibold leading-6 text-fg">
                            <HighlightedText text={item.suggestedUpdate || ""} keywords={rewrite.keywordsApplied || []} />
                          </p>
                        </div>
                        <div className="flex justify-end border-t border-line px-4 py-3">
                          <button
                            onClick={() => navigator.clipboard.writeText(item.suggestedUpdate || "")}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-black text-fg hover:border-brand"
                          >
                            <Copy className="h-3.5 w-3.5" /> Copy update
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {rewrite.featuredSectionAdvice ? (
                <div className="overflow-hidden rounded-2xl border border-line bg-canvas">
                  <div className="border-b border-line px-5 py-4">
                    <p className="text-xs font-black uppercase tracking-wide text-muted">Featured section advisor</p>
                  </div>
                  <div className="border-l-4 border-brand bg-brand/[0.025] px-5 py-5">
                    <p className="text-sm font-semibold leading-6 text-fg">{rewrite.featuredSectionAdvice}</p>
                  </div>
                  <div className="flex justify-end border-t border-line px-5 py-3">
                    <button
                      onClick={() => navigator.clipboard.writeText(rewrite.featuredSectionAdvice || "")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-black text-fg hover:border-brand"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy advice
                    </button>
                  </div>
                </div>
              ) : null}

              {rewrite.violations.length ? (
                <div className="rounded-2xl border border-line bg-fg/[0.02] p-5">
                  <p className="inline-flex items-center gap-2 text-sm font-black text-fg">
                    <ShieldCheck className="h-4 w-4 text-warning" /> What WorkZo refused to write
                  </p>
                  <p className="mt-1 text-xs text-muted">Unsupported skills and invented numbers were removed before you saw the output.</p>
                  <ul className="mt-3 space-y-2">
                    {rewrite.violations.map((violation, index) => (
                      <li key={index} className="rounded-lg border border-line px-3 py-2">
                        <p className="text-xs font-black text-warning">
                          {violation.reason === "forbidden_keyword"
                            ? `Unproven skill: "${violation.offender}"`
                            : `Invented number: "${violation.offender}"`}
                        </p>
                        <p className="mt-0.5 text-xs italic text-muted">“{violation.removed}”</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          ) : null}

          {analysis ? (
            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-brand/20 bg-canvas/80 px-4 py-3 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-lg">
              <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="inline-flex items-center gap-2 truncate text-sm font-black text-fg">
                    {canRewrite ? <Sparkles className="h-4 w-4 shrink-0 text-brand" /> : <Lock className="h-4 w-4 shrink-0" />}
                    Rewrite my headline and About
                    <span className="hidden font-medium text-muted sm:inline">— Ready to synthesize</span>
                  </p>
                </div>
                {!activeJds.length && !jobDescription.trim() ? (
                  <span className="text-xs font-bold text-warning">Add a target JD first</span>
                ) : canRewrite ? (
                  <button
                    onClick={handleRewrite}
                    disabled={rewriting}
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-black text-on-brand hover:bg-brand-strong disabled:opacity-50"
                  >
                    {rewriting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {rewriting ? "Rewriting…" : rewrite ? "Regenerate" : "Rewrite my profile"}
                  </button>
                ) : (
                  <a
                    href="/pricing?plan=premium&feature=linkedin_rewrite"
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-black text-on-brand hover:bg-brand-strong"
                  >
                    Unlock rewrite <ArrowUpRight className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          ) : null}


        </>
      ) : null}
    </main>
  );
}
