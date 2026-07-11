"use client";

/*
 * FreeToolRunner, runs a free career tool inline, with no login required.
 *
 * It POSTs to the tool's public /api/free-tools/<slug> endpoint (deterministic,
 * unauthenticated) and renders the result in place. The full, premium version
 * of each tool is offered as a secondary link, never as a wall.
 *
 * Input fields and result rendering are driven by the tool id, so the same
 * component serves every tool in the registry.
 */

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { ArrowRight, Check, Copy, FileUp, Loader2, Sparkles, UserRound } from "lucide-react";
import type { FreeTool } from "@/lib/free-tools";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { persistCvSource, resolveCvSource } from "@/lib/workzoCvSource";
import type { ResumeProfile } from "@/lib/workzoResumeParser";

type Field = {
  key: "cvText" | "resumeText" | "jobDescription" | "targetRole" | "companyName" | "experienceText";
  label: string;
  placeholder: string;
  type: "text" | "textarea";
  required: boolean;
};

const FIELDS: Record<string, Field[]> = {
  "cv-review": [
    { key: "cvText", label: "Your CV / resume text", placeholder: "Paste your CV text here…", type: "textarea", required: true },
    { key: "jobDescription", label: "Target job description (optional)", placeholder: "Paste the job posting to sharpen the review…", type: "textarea", required: false },
  ],
  "resume-tailor": [
    { key: "cvText", label: "Your resume text", placeholder: "Paste your current resume…", type: "textarea", required: true },
    { key: "jobDescription", label: "Job description", placeholder: "Paste the job posting you're targeting…", type: "textarea", required: true },
  ],
  "cover-letter": [
    { key: "cvText", label: "Your CV / resume text", placeholder: "Paste your CV text here…", type: "textarea", required: true },
    { key: "targetRole", label: "Target role", placeholder: "e.g. Data Analyst", type: "text", required: false },
    { key: "companyName", label: "Company (optional)", placeholder: "e.g. Siemens", type: "text", required: false },
    { key: "jobDescription", label: "Job description (optional)", placeholder: "Paste the posting for a sharper letter…", type: "textarea", required: false },
  ],
  "interview-questions": [
    { key: "targetRole", label: "Target role", placeholder: "e.g. Product Manager", type: "text", required: true },
    { key: "jobDescription", label: "Job description (optional)", placeholder: "Paste the posting for role-specific questions…", type: "textarea", required: false },
  ],
  "professional-summary": [
    { key: "cvText", label: "Your CV / resume text", placeholder: "Paste your CV text here…", type: "textarea", required: true },
    { key: "targetRole", label: "Target role (optional)", placeholder: "e.g. Data Analyst", type: "text", required: false },
    { key: "jobDescription", label: "Job description (optional)", placeholder: "Paste the posting to sharpen the wording…", type: "textarea", required: false },
  ],
  "star-story": [
    { key: "experienceText", label: "Describe the achievement or situation", placeholder: "e.g. Our support backlog was out of control, so I built a triage system that cut response time…", type: "textarea", required: true },
    { key: "targetRole", label: "Target role (optional)", placeholder: "e.g. Operations Manager", type: "text", required: false },
  ],
  "resume-headline": [
    { key: "targetRole", label: "Target role", placeholder: "e.g. Product Manager", type: "text", required: true },
    { key: "cvText", label: "Your CV / resume text (optional)", placeholder: "Paste your CV to pull in your real skills…", type: "textarea", required: false },
    { key: "jobDescription", label: "Job description (optional)", placeholder: "Paste the posting to match its keywords…", type: "textarea", required: false },
  ],
  "ats-checker": [
    { key: "cvText", label: "Your resume text", placeholder: "Paste your full resume text here…", type: "textarea", required: true },
    { key: "jobDescription", label: "Job description (optional)", placeholder: "Paste the posting for a keyword-match score…", type: "textarea", required: false },
  ],
};

type Result = Record<string, unknown> & { ok?: boolean; message?: string };

function List({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-subtle">{title}</p>
      <ul className="mt-2 space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm leading-6 text-fg">
            <Check className="mt-1 h-[14px] w-[14px] shrink-0 text-brand" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Pills({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-subtle">{title}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span key={i} className="rounded-full border border-line bg-fg/[0.04] px-2.5 py-1 text-xs font-bold text-muted">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function ResultView({ data }: { data: Result }) {
  const [copied, setCopied] = useState(false);

  // STAR story
  if (data.starStory && typeof data.starStory === "object") {
    const s = data.starStory as { situation: string; task: string; action: string; result: string };
    const story = (data.story as string) || "";
    const rows: [string, string][] = [
      ["Situation", s.situation],
      ["Task", s.task],
      ["Action", s.action],
      ["Result", s.result],
    ];
    return (
      <div className="space-y-5">
        <div className="grid gap-3">
          {rows.map(([label, text]) => (
            <div key={label} className="rounded-xl border border-line bg-canvas p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-brand">{label}</p>
              <p className="mt-1.5 text-sm leading-6 text-fg">{text}</p>
            </div>
          ))}
        </div>
        {story ? (
          <div className="rounded-xl border border-line bg-canvas p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-subtle">Say it as one answer</p>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(story).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1600);
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-fg/5 px-2.5 py-1.5 text-xs font-black text-fg transition hover:bg-fg/10"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="mt-3 text-sm leading-6 text-fg">{story}</p>
          </div>
        ) : null}
        <Pills title="Skills highlighted" items={data.highlights as string[]} />
        <List title="Why this works" items={data.whyItWorks as string[]} />
        <List title="Deliver it well" items={data.tips as string[]} />
      </div>
    );
  }

  // Resume headlines
  if (Array.isArray(data.headlines)) {
    const headlines = data.headlines as string[];
    return (
      <div className="space-y-5">
        <div className="space-y-2.5">
          {headlines.map((h, i) => (
            <div key={i} className="flex items-start justify-between gap-3 rounded-xl border border-line bg-canvas p-3.5">
              <p className="text-sm font-bold leading-6 text-fg">{h}</p>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(h).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1600);
                  });
                }}
                className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-fg/5 px-2.5 py-1.5 text-xs font-black text-fg transition hover:bg-fg/10"
              >
                <Copy className="h-3.5 w-3.5" /> Copy
              </button>
            </div>
          ))}
        </div>
        <Pills title="Front-loaded skills" items={data.highlights as string[]} />
        <List title="Why this works" items={data.whyItWorks as string[]} />
        <List title="Make it yours" items={data.tips as string[]} />
      </div>
    );
  }

  // ATS checker
  if (typeof data.atsScore === "number") {
    const checks = (data.checks as Array<{ label: string; pass: boolean; detail: string }>) || [];
    const keywordScore = data.keywordScore as number | null;
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-canvas p-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-brand/20 bg-brand/10">
            <span className="text-2xl font-black text-brand">{data.atsScore as number}</span>
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-subtle">ATS verdict</p>
            <p className="text-base font-black text-fg">{data.verdict as string}</p>
            <p className="mt-0.5 text-xs text-muted">
              Structure {data.structureScore as number}/100{typeof keywordScore === "number" ? ` · Keyword match ${keywordScore}/100` : ""}
            </p>
          </div>
        </div>
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-subtle">Checks</p>
          <ul className="mt-2 space-y-2">
            {checks.map((c, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm leading-6 text-fg">
                {c.pass ? (
                  <Check className="mt-1 h-[14px] w-[14px] shrink-0 text-success" />
                ) : (
                  <span className="mt-1.5 h-[10px] w-[10px] shrink-0 rounded-full border-2 border-danger" />
                )}
                <span>
                  <span className="font-bold">{c.label}.</span> <span className="text-muted">{c.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <Pills title="Keywords you match" items={data.matchedSkills as string[]} />
        <Pills title="Missing keywords (add with proof)" items={data.missingSkills as string[]} />
        <List title="Fix these first" items={data.fixes as string[]} />
        <List title="Next steps" items={data.nextSteps as string[]} />
      </div>
    );
  }

  // Professional summary
  if (typeof data.summary === "string") {
    const summary = data.summary as string;
    const shortSummary = data.shortSummary as string | undefined;
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-line bg-canvas p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-subtle">Your professional summary</p>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(summary).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                });
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-fg/5 px-2.5 py-1.5 text-xs font-black text-fg transition hover:bg-fg/10"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-3 text-sm leading-6 text-fg">{summary}</p>
        </div>
        {shortSummary ? (
          <div className="rounded-xl border border-line bg-canvas p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-subtle">LinkedIn-style headline</p>
            <p className="mt-2 text-sm font-bold leading-6 text-fg">{shortSummary}</p>
          </div>
        ) : null}
        <Pills title="Front-loaded strengths" items={data.highlights as string[]} />
        <List title="Why this works" items={data.whyItWorks as string[]} />
        <List title="Make it yours" items={data.tips as string[]} />
      </div>
    );
  }

  // Cover letter
  if (typeof data.letter === "string") {
    const letter = data.letter as string;
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-line bg-canvas p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-subtle">Your cover letter</p>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(letter).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                });
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-fg/5 px-2.5 py-1.5 text-xs font-black text-fg transition hover:bg-fg/10"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6 text-fg">{letter}</pre>
        </div>
        <List title="Before you send" items={data.checklist as string[]} />
      </div>
    );
  }

  // Interview questions
  if (Array.isArray(data.recommendedQuestions)) {
    const questions = data.recommendedQuestions as Array<{ category: string; question: string; followUp?: string }>;
    return (
      <div className="space-y-5">
        <div className="space-y-3">
          {questions.map((q, i) => (
            <div key={i} className="rounded-xl border border-line bg-canvas p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-brand">{q.category}</p>
              <p className="mt-1.5 text-sm font-bold leading-6 text-fg">{q.question}</p>
              {q.followUp ? <p className="mt-1.5 text-xs leading-5 text-muted">Follow-up: {q.followUp}</p> : null}
            </div>
          ))}
        </div>
        <List title="Practice tips" items={data.practiceTips as string[]} />
      </div>
    );
  }

  // Resume tailor
  if (typeof data.tailoredSummary === "string") {
    const alignment = (data.keywordAlignment as { matched?: string[]; recommendedToAddWithProof?: string[]; jdKeywords?: string[] }) || {};
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-line bg-canvas p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-subtle">Tailored summary</p>
          <p className="mt-2 text-sm leading-6 text-fg">{data.tailoredSummary as string}</p>
        </div>
        <List title="Tailored bullets" items={data.tailoredBullets as string[]} />
        <Pills title="Keywords you already match" items={alignment.matched || []} />
        <Pills title="Add these (with honest proof)" items={alignment.recommendedToAddWithProof || []} />
        <List title="ATS suggestions" items={data.atsSuggestions as string[]} />
      </div>
    );
  }

  // CV review
  if (typeof data.score === "number") {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-4 rounded-xl border border-line bg-canvas p-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-brand/20 bg-brand/10">
            <span className="text-2xl font-black text-brand">{data.score as number}</span>
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-subtle">Verdict</p>
            <p className="text-base font-black text-fg">{data.verdict as string}</p>
          </div>
        </div>
        <List title="Strengths" items={data.strengths as string[]} />
        <List title="Improvements" items={data.improvements as string[]} />
        <Pills title="Skills you match" items={data.matchedSkills as string[]} />
        <Pills title="Consider adding (with proof)" items={data.missingSkills as string[]} />
        <List title="Next steps" items={data.nextSteps as string[]} />
      </div>
    );
  }

  return null;
}

export default function FreeToolRunner({ tool }: { tool: FreeTool }) {
  const fields = FIELDS[tool.id] || [];
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [uploadingCv, setUploadingCv] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [rememberedCvName, setRememberedCvName] = useState("");
  const [rememberedProfile, setRememberedProfile] = useState<ResumeProfile | null>(null);

  const needsCv = fields.some((field) => field.key === "cvText" || field.key === "resumeText");

  useEffect(() => {
    let active = true;

    async function hydrate() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getUser();
        if (!active) return;
        const isSignedIn = Boolean(data.user);
        setSignedIn(isSignedIn);

        if (isSignedIn) {
          const source = resolveCvSource();
          const cvText = source.rawCvText || source.profile?.rawText || "";
          if (cvText.trim()) {
            setValues((current) => ({
              ...current,
              cvText: current.cvText || cvText,
              resumeText: current.resumeText || cvText,
              targetRole: current.targetRole || source.targetRole || source.profile?.basics?.headline || "",
              jobDescription: current.jobDescription || source.jobDescription || "",
            }));
            setRememberedCvName(source.fileName || source.profile?.basics?.name || "Saved CV");
            setRememberedProfile(source.profile);
          }
        }
      } catch {
        if (active) setSignedIn(false);
      } finally {
        if (active) setAuthLoading(false);
      }
    }

    void hydrate();
    return () => {
      active = false;
    };
  }, []);

  const missingRequired = fields.some((f) => f.required && !values[f.key]?.trim());

  async function handleCvUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingCv(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/cv", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const data = await response.json().catch(() => null);
      if (response.status === 401) {
        setSignedIn(false);
        throw new Error("Please sign in before uploading your CV.");
      }
      if (!response.ok) throw new Error(data?.error || "Could not read that CV.");

      const rawCvText = String(
        data?.text || data?.cvText || data?.content || data?.resumeText || data?.extractedText || "",
      ).trim();
      const profile = (data?.resumeProfile || data?.profile || null) as ResumeProfile | null;
      if (!rawCvText && !profile) throw new Error("No readable CV content was found.");

      persistCvSource({
        rawCvText,
        profile,
        fileName: file.name,
        targetRole: values.targetRole || profile?.basics?.headline || "",
        jobDescription: values.jobDescription || "",
        origin: "tools-page-upload",
        source: "tools-page-upload",
        needsReupload: false,
      });

      setValues((current) => ({
        ...current,
        cvText: rawCvText || current.cvText || "",
        resumeText: rawCvText || current.resumeText || "",
        targetRole: current.targetRole || profile?.basics?.headline || "",
      }));
      setRememberedCvName(file.name);
      setRememberedProfile(profile);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not read that CV.");
    } finally {
      setUploadingCv(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function run() {
    if (!signedIn) {
      setError("Please sign in to use this tool.");
      return;
    }
    if (missingRequired) {
      setError("Please fill in the required fields.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(tool.apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      });
      const data = (await res.json().catch(() => ({}))) as Result;
      if (res.status === 401) {
        setSignedIn(false);
        setError("Your session expired. Please sign in again.");
      } else if (!res.ok || data.ok === false) {
        setError((data.message as string) || "Something went wrong. Please try again.");
      } else {
        setResult(data);
      }
    } catch {
      setError("Could not reach the tool. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="rounded-[1.75rem] border border-line bg-surface/70 p-7 shadow-2xl shadow-black/10">
        <div className="h-5 w-48 animate-pulse rounded bg-fg/10" />
        <div className="mt-5 h-28 animate-pulse rounded-2xl bg-fg/5" />
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="rounded-[1.75rem] border border-line bg-surface/70 p-6 shadow-2xl shadow-black/10 sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-brand/20 bg-brand/10 text-brand">
          <UserRound className="h-5 w-5" />
        </div>
        <h2 className="mt-5 text-2xl font-black tracking-tight text-fg">Sign in to continue</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
          Your CV and results stay connected across WorkZo, so the next tool can reuse what you already uploaded.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/login?next=${encodeURIComponent(tool.href)}`}
            className="inline-flex items-center justify-center rounded-xl bg-brand px-5 py-3 text-sm font-black text-on-brand hover:bg-brand-strong"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-xl border border-line bg-fg/5 px-5 py-3 text-sm font-black text-fg hover:bg-fg/10"
          >
            Create account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[1.75rem] border border-line bg-surface/70 p-5 shadow-2xl shadow-black/10 sm:p-7">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-brand">
        <Sparkles className="h-4 w-4" /> Career tool
      </div>

      {!result ? (
        <div className="mt-5 space-y-4">
          {needsCv ? (
            <div className="rounded-2xl border border-line bg-canvas p-4">
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp"
                onChange={handleCvUpload}
                className="hidden"
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black text-fg">
                    {rememberedCvName ? `Using ${rememberedCvName}` : "Add your CV"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    {rememberedCvName
                      ? `${rememberedProfile?.experience?.length || 0} roles and ${rememberedProfile?.skills?.length || 0} skills are available across WorkZo.`
                      : "Upload once and WorkZo will reuse the verified CV across tools."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingCv}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-line bg-fg/5 px-4 py-2.5 text-sm font-black text-fg hover:bg-fg/10 disabled:opacity-60"
                >
                  {uploadingCv ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                  {uploadingCv ? "Reading CV…" : rememberedCvName ? "Replace CV" : "Upload CV"}
                </button>
              </div>
            </div>
          ) : null}

          {fields.map((field) => {
            const isCvField = field.key === "cvText" || field.key === "resumeText";
            return (
              <div key={field.key}>
                <label className="text-sm font-black text-fg">
                  {isCvField && rememberedCvName ? "CV text (loaded from your saved CV)" : field.label}
                  {field.required ? <span className="text-brand"> *</span> : null}
                </label>
                {field.type === "textarea" ? (
                  <textarea
                    value={values[field.key] || ""}
                    onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    rows={isCvField && rememberedCvName ? 4 : 6}
                    className="mt-2 w-full resize-y rounded-xl border border-line bg-canvas px-3.5 py-3 text-sm leading-6 text-fg outline-none transition focus:border-brand/50"
                  />
                ) : (
                  <input
                    type="text"
                    value={values[field.key] || ""}
                    onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="mt-2 w-full rounded-xl border border-line bg-canvas px-3.5 py-3 text-sm text-fg outline-none transition focus:border-brand/50"
                  />
                )}
              </div>
            );
          })}

          {error ? (
            <p className="rounded-xl border border-danger/20 bg-danger/10 px-3.5 py-2.5 text-sm font-bold text-danger">{error}</p>
          ) : null}

          <button
            type="button"
            onClick={run}
            disabled={loading || uploadingCv}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3.5 text-sm font-black text-on-brand shadow-lg shadow-brand/20 transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Working…" : tool.hero.primaryCta.replace(/\bfree\b/gi, "").replace(/\s+/g, " ").trim()}
          </button>
          <p className="text-center text-xs text-subtle">Saved to your WorkZo workspace for reuse across tools.</p>
        </div>
      ) : (
        <div className="mt-5">
          <ResultView data={result} />

          <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setError("");
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-fg/5 px-5 py-2.5 text-sm font-black text-fg transition hover:bg-fg/10"
            >
              Run again
            </button>
            <Link
              href={tool.cta.primaryHref}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-fg px-5 py-2.5 text-sm font-black text-canvas transition hover:bg-brand hover:text-on-brand"
            >
              Open full workspace <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

