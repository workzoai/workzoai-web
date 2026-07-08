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

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Copy, Loader2, Sparkles } from "lucide-react";
import type { FreeTool } from "@/lib/free-tools";

type Field = {
  key: "cvText" | "resumeText" | "jobDescription" | "targetRole" | "companyName";
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
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const missingRequired = fields.some((f) => f.required && !values[f.key]?.trim());

  async function run() {
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
        body: JSON.stringify(values),
      });
      const data = (await res.json().catch(() => ({}))) as Result;
      if (!res.ok || data.ok === false) {
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

  return (
    <div className="rounded-[1.75rem] border border-line bg-surface/70 p-5 shadow-2xl shadow-black/10 sm:p-7">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-brand">
        <Sparkles className="h-4 w-4" /> Try it free, no signup
      </div>

      {!result ? (
        <div className="mt-5 space-y-4">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="text-sm font-black text-fg">
                {field.label}
                {field.required ? <span className="text-brand"> *</span> : null}
              </label>
              {field.type === "textarea" ? (
                <textarea
                  value={values[field.key] || ""}
                  onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  rows={6}
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
          ))}

          {error ? (
            <p className="rounded-xl border border-danger/20 bg-danger/10 px-3.5 py-2.5 text-sm font-bold text-danger">{error}</p>
          ) : null}

          <button
            type="button"
            onClick={run}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3.5 text-sm font-black text-on-brand shadow-lg shadow-brand/20 transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Working…" : tool.hero.primaryCta}
          </button>
          <p className="text-center text-xs text-subtle">Free · runs instantly · we don't sell your data.</p>
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
              Get the full version <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
