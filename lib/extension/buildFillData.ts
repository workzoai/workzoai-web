/*
 * lib/extension/buildFillData.ts
 *
 * Assembles everything the extension needs to autofill a job application form for one
 * session: identity fields, and evidence-backed answers to the common application
 * questions.
 *
 * THE ONE RULE THAT MATTERS
 *
 * A form field is not safer than a CV bullet. If the tailored CV refused to claim
 * Kubernetes, a "Rate your Kubernetes 1-5" field must not be filled with a 4, and a
 * "Why are you a fit?" box must not mention Kubernetes. The evidence guarantee that
 * governs the documents governs the form, or it does not govern anything: an
 * applicant tracking system reads the form, not the attached CV, first.
 *
 * So every GENERATED answer here is built from verdict.supported only. Identity fields
 * (name, email, phone) are copied verbatim. Skill/experience answers are gated. And
 * every generated field is marked so the extension can visibly flag it for the user
 * to confirm before they submit: fill and highlight, never fill and hide.
 */

import type { ResumeProfile } from "@/lib/workzoResumeParser";
import type { JobMatchResult, WorkZoJob } from "@/lib/jobs/types";
import { assessEvidence } from "@/lib/smart-apply/validateEvidence";
import { deriveYearsOfExperience } from "@/lib/jobs/evidenceMatcher";

/*
 * A single fillable value. `confidence` drives how the extension presents it:
 *   verbatim  copied from the user's profile, safe to fill quietly (name, email)
 *   verified  generated but backed by CV evidence, fill AND highlight for review
 *   review    generated where evidence is thin, fill highlighted with a warning
 * There is deliberately no "confident guess" tier. We do not guess on a form that goes
 * to an employer.
 */
export type FillConfidence = "verbatim" | "verified" | "review";

export type FillField = {
  /** Canonical field key the content script maps to real inputs (see fieldMap). */
  key: string;
  value: string;
  confidence: FillConfidence;
  /** Shown to the user when they inspect a highlighted field. */
  note?: string;
};

export type FillData = {
  sessionId: string;
  job: { title: string; company: string };
  fields: FillField[];
  /*
   * Claims the extension must NEVER type into any field, even a free-text one, and
   * even if the page seems to ask for them. Passed through so the content script can
   * scrub them from anything it fills, as a second line of defence.
   */
  forbiddenClaims: string[];
  generatedAt: string;
};

/* ── identity (verbatim) ───────────────────────────────────────────────────── */

function identityFields(profile: ResumeProfile): FillField[] {
  const b = profile.basics || ({} as ResumeProfile["basics"]);
  const out: FillField[] = [];
  const add = (key: string, value: string) => {
    const v = (value || "").trim();
    if (v) out.push({ key, value: v, confidence: "verbatim" });
  };

  const name = (b.name || "").trim();
  add("full_name", name);
  const parts = name.split(/\s+/);
  if (parts.length >= 2) {
    add("first_name", parts[0]);
    add("last_name", parts.slice(1).join(" "));
  }
  add("email", b.email || "");
  add("phone", b.phone || "");
  add("location", b.location || "");
  add("linkedin", b.linkedin || "");

  // Current title comes from the most recent role, not the headline (the headline is
  // aspirational; a form asking "current title" wants the real one).
  const latest = (profile.experience || [])[0];
  if (latest?.title) add("current_title", latest.title);
  if (latest?.company) add("current_company", latest.company);

  return out;
}

/* ── generated, evidence-gated answers ─────────────────────────────────────── */

function firstQuantifiedBullet(profile: ResumeProfile): string | null {
  for (const role of profile.experience || []) {
    for (const bullet of role.bullets || []) {
      if (/\b\d+\s*(%|percent|k\b|m\b|hours?|users?|customers?|tickets?|projects?|beds?)/i.test(bullet)) {
        return bullet.replace(/\s*\([^)]*\)\s*$/, "").trim();
      }
    }
  }
  return (profile.experience || [])[0]?.bullets?.[0]?.trim() || null;
}

function buildWhyFit(profile: ResumeProfile, job: WorkZoJob, supported: JobMatchResult["requirements"]): FillField | null {
  const strengths = supported
    .filter((r) => r.evidence.length > 0)
    .slice(0, 3)
    .map((r) => r.requirement);

  if (!strengths.length) {
    // No evidenced strengths means we have nothing honest to say. We do not fabricate
    // enthusiasm; we leave the field for the user.
    return null;
  }

  const proof = firstQuantifiedBullet(profile);
  const company = (job.company || "your team").trim();

  const answer =
    `My background in ${strengths.join(", ")} lines up closely with this ${job.title} role at ${company}.` +
    (proof ? ` For example: ${proof}.` : "") +
    ` I would welcome the chance to go into more detail.`;

  return {
    key: "why_fit",
    value: answer,
    confidence: "verified",
    note: "Drafted from skills your CV proves. Read it in your own voice before you submit.",
  };
}

function buildYearsExperience(profile: ResumeProfile): FillField | null {
  const years = deriveYearsOfExperience(profile);
  if (years === null) return null;
  return {
    key: "years_experience",
    value: String(years),
    confidence: "verified",
    note: `Derived from the dated roles on your CV (about ${years} years). Adjust if your total differs.`,
  };
}

/* ── the builder ───────────────────────────────────────────────────────────── */

export function buildFillData(session: {
  id: string;
  job: WorkZoJob;
  match: JobMatchResult;
}, profile: ResumeProfile): FillData {
  const verdict = assessEvidence(session.match);

  const fields: FillField[] = [];
  fields.push(...identityFields(profile));

  const why = buildWhyFit(profile, session.job, verdict.supported);
  if (why) fields.push(why);

  const years = buildYearsExperience(profile);
  if (years) fields.push(years);

  /*
   * A short, evidence-only skills summary for "key skills" fields. Only skills the CV
   * supports for THIS job, so an ATS keyword scan sees exactly what the CV can back up,
   * no more. Keyword stuffing is the anti-pattern the whole product avoids.
   */
  const supportedSkills = verdict.supported
    .filter((r) => r.category === "technical" || r.category === "domain")
    .map((r) => r.requirement);
  if (supportedSkills.length) {
    fields.push({
      key: "key_skills",
      value: supportedSkills.slice(0, 12).join(", "),
      confidence: "verified",
      note: "Only skills your CV evidences for this job. We did not add keywords you cannot back up.",
    });
  }

  /*
   * The forbidden list: every requirement the CV does NOT support. The content script
   * scrubs these from anything it fills, so even a page that pre-fills a "skills" box
   * with JD keywords cannot trick us into leaving an unevidenced claim in place.
   */
  const forbiddenClaims = verdict.blocked
    .filter((r) => r.category !== "location" && r.status !== "not_verifiable")
    .map((r) => r.requirement.replace(/\s*\(.*\)\s*$/, "").trim())
    .filter((n) => n.length >= 3);

  return {
    sessionId: session.id,
    job: { title: session.job.title, company: session.job.company },
    fields,
    forbiddenClaims,
    generatedAt: new Date().toISOString(),
  };
}
