"use client";

/*
 * ResumeTemplatesClient - a stateless, no-login gallery of clean, single-column,
 * ATS-friendly resume templates. Each template is a plain-text skeleton the user
 * can copy and fill in. No data is stored; everything runs in the browser.
 *
 * ATS-friendly by construction: single column, standard section headings, plain
 * bullets, no tables or text boxes. That is exactly what the ATS Resume Checker
 * rewards, so the two tools reinforce each other.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Copy, Download } from "lucide-react";

type Template = {
  id: string;
  name: string;
  bestFor: string;
  notes: string[];
  body: string;
};

const TEMPLATES: Template[] = [
  {
    id: "professional",
    name: "Professional (Reverse-Chronological)",
    bestFor: "Most roles with a steady work history.",
    notes: [
      "The default recruiters and ATS expect.",
      "Leads with recent, relevant experience.",
      "Front-load impact and numbers in each bullet.",
    ],
    body: `FULL NAME
City, Country | +00 000 000 0000 | you@email.com | linkedin.com/in/your-handle

PROFESSIONAL SUMMARY
[Role] with [X]+ years across [skill], [skill], and [skill]. Known for
[measurable result]. Now focused on [target role] where [what you deliver].

SKILLS
[Skill], [Skill], [Skill], [Skill], [Skill], [Skill], [Skill], [Skill]

EXPERIENCE
[Job Title] - [Company], [Location]                        [Mon YYYY] - [Mon YYYY]
- [Action verb] [what you did] which [result, with a number].
- [Action verb] [what you did] which [result, with a number].
- [Action verb] [what you did] which [result, with a number].

[Job Title] - [Company], [Location]                        [Mon YYYY] - [Mon YYYY]
- [Action verb] [what you did] which [result, with a number].
- [Action verb] [what you did] which [result, with a number].

EDUCATION
[Degree], [Field] - [University], [Location]                            [YYYY]

CERTIFICATIONS
[Certification] - [Issuer], [YYYY]`,
  },
  {
    id: "graduate",
    name: "Graduate / Entry-Level",
    bestFor: "Students, first job, or bootcamp graduates.",
    notes: [
      "Puts education and projects above thin experience.",
      "Projects count: describe them like real work.",
      "Keep it to one page.",
    ],
    body: `FULL NAME
City, Country | +00 000 000 0000 | you@email.com | linkedin.com/in/your-handle | github.com/you

SUMMARY
[Field] graduate with hands-on experience in [skill] and [skill] through
[projects/internships]. Looking to apply [strength] as a [target role].

EDUCATION
[Degree], [Field] - [University], [Location]                    [YYYY] - [YYYY]
Relevant coursework: [Course], [Course], [Course]

PROJECTS
[Project Name] - [Tech/Tools used]
- [What you built] and [what it achieved, with a number if possible].
- [Key decision or challenge] and how you solved it.

[Project Name] - [Tech/Tools used]
- [What you built] and [what it achieved].

SKILLS
[Skill], [Skill], [Skill], [Skill], [Skill], [Skill]

EXPERIENCE
[Role / Internship] - [Company], [Location]                    [Mon YYYY] - [Mon YYYY]
- [Action verb] [what you did] which [result].

CERTIFICATIONS
[Certification] - [Issuer], [YYYY]`,
  },
  {
    id: "career-change",
    name: "Career Change (Skills-Forward)",
    bestFor: "Switching industries or functions.",
    notes: [
      "Leads with transferable skills, then history.",
      "Reframe past work in the language of the new role.",
      "Add a short 'why the change' line in the summary.",
    ],
    body: `FULL NAME
City, Country | +00 000 000 0000 | you@email.com | linkedin.com/in/your-handle

SUMMARY
[Current background] moving into [target role]. [X] years building
[transferable skill] and [transferable skill], with a track record of
[measurable result]. Making the switch to [why, one line].

CORE SKILLS (mapped to [target role])
[Target-role skill] - evidenced by [past experience]
[Target-role skill] - evidenced by [past experience]
[Target-role skill] - evidenced by [past experience]

EXPERIENCE
[Job Title] - [Company], [Location]                        [Mon YYYY] - [Mon YYYY]
- [Action verb] [what you did], framed for the new role, with a [number].
- [Action verb] [what you did], framed for the new role, with a [number].

EDUCATION & LEARNING
[Degree or course], [Field] - [Institution]                            [YYYY]
[Recent course/certification relevant to the new field] - [Issuer], [YYYY]

SKILLS
[Skill], [Skill], [Skill], [Skill], [Skill], [Skill]`,
  },
  {
    id: "technical",
    name: "Technical / Engineering",
    bestFor: "Engineers, data, and technical roles.",
    notes: [
      "Puts a tech stack block near the top for keyword match.",
      "Quantify scale: users, latency, uptime, cost.",
      "Link a portfolio or GitHub.",
    ],
    body: `FULL NAME
City, Country | +00 000 000 0000 | you@email.com | github.com/you | linkedin.com/in/your-handle

SUMMARY
[Senior?] [Role] with [X]+ years building [type of systems]. Strong in
[language/stack] with a focus on [reliability/scale/performance].

TECH STACK
Languages: [ ... ]
Frameworks: [ ... ]
Data/Infra: [ ... ]
Tools: [ ... ]

EXPERIENCE
[Job Title] - [Company], [Location]                        [Mon YYYY] - [Mon YYYY]
- Built [system/feature] handling [scale: users/requests], improving [metric] by [number].
- [Action verb] [technical work] which [result, with a number].
- Collaborated with [teams] to [outcome].

[Job Title] - [Company], [Location]                        [Mon YYYY] - [Mon YYYY]
- [Action verb] [technical work] which [result, with a number].

PROJECTS
[Project] - [Stack]: [what it does] ([link])

EDUCATION
[Degree], [Field] - [University]                                        [YYYY]`,
  },
];

export default function ResumeTemplatesClient() {
  const [activeId, setActiveId] = useState(TEMPLATES[0].id);
  const [copied, setCopied] = useState(false);

  const active = useMemo(
    () => TEMPLATES.find((t) => t.id === activeId) || TEMPLATES[0],
    [activeId],
  );

  function copy() {
    navigator.clipboard?.writeText(active.body).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  function download() {
    const blob = new Blob([active.body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workzo-resume-${active.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      {/* Template picker */}
      <div className="space-y-2.5">
        {TEMPLATES.map((t) => {
          const isActive = t.id === active.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveId(t.id)}
              className={`w-full rounded-2xl border p-4 text-left transition ${
                isActive
                  ? "border-brand/50 bg-brand/[0.06]"
                  : "border-line bg-surface/60 hover:border-brand/30 hover:bg-surface"
              }`}
            >
              <p className="text-sm font-black text-fg">{t.name}</p>
              <p className="mt-1 text-xs leading-5 text-muted">{t.bestFor}</p>
            </button>
          );
        })}
      </div>

      {/* Active template */}
      <div className="rounded-[1.75rem] border border-line bg-surface/70 p-5 shadow-2xl shadow-black/10 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-black tracking-tight text-fg">{active.name}</h3>
            <ul className="mt-2 space-y-1.5">
              {active.notes.map((n, i) => (
                <li key={i} className="flex items-start gap-2 text-xs leading-5 text-muted">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-fg/5 px-3 py-2 text-xs font-black text-fg transition hover:bg-fg/10"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={download}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-fg/5 px-3 py-2 text-xs font-black text-fg transition hover:bg-fg/10"
            >
              <Download className="h-3.5 w-3.5" /> .txt
            </button>
          </div>
        </div>

        <pre className="mt-5 overflow-x-auto whitespace-pre-wrap rounded-xl border border-line bg-canvas p-4 font-mono text-[12.5px] leading-6 text-fg">
{active.body}
        </pre>

        <div className="mt-5 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-subtle">
            Fill the brackets with your details, then check it scores well.
          </p>
          <Link
            href="/tools/ats-checker"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-black text-on-brand transition hover:bg-brand-strong"
          >
            Check my ATS score <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
