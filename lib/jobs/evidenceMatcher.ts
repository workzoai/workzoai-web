/*
 * lib/jobs/evidenceMatcher.ts
 *
 * Decides whether the canonical CV actually SUPPORTS a job requirement, and
 * returns the verbatim CV text that proves it.
 *
 * WHY EVIDENCE, NOT A BOOLEAN
 *
 * The old ranking did this:
 *
 *     if (cvText.includes(requirement)) matched.push(requirement);
 *
 * A substring test can tell you a word appears. It cannot tell you WHERE, so it
 * can never answer the only two questions that matter downstream:
 *
 *   - The match card (spec 28) promises to say "REST API troubleshooting is only
 *     partially proven". Partially proven WHERE? You need the bullet.
 *   - The evidence-first rule (spec 2.2) forbids inventing a skill in a tailored
 *     CV or cover letter. To ENFORCE that, generation must be able to ask "what
 *     is my proof for this claim?" and get a citation back, not a boolean.
 *
 * So every match carries the CV lines it came from. A requirement with no
 * evidence cannot be written into a document. That is the whole safety model,
 * and it only works if the evidence is real, quoted, and traceable.
 *
 * A substring test is also how "not Java" ends up matching "Java": we match on
 * word boundaries and known token shapes, never on raw `includes`.
 */

import type { ResumeProfile } from "@/lib/workzoResumeParser";
import type { ExtractedRequirement } from "@/lib/jobs/requirementExtractor";
import type { JobRequirementMatch, JobRequirementStatus } from "@/lib/jobs/types";
import { contentStems, containsPhrase } from "@/lib/jobs/textStems";

/* ─────────────────────────────── CV evidence index ───────────────────────── */

type EvidenceEntry = {
  /** Verbatim CV text, quotable straight into an explanation. */
  text: string;
  /** Where in the CV it came from. Skills carry less weight than lived bullets. */
  origin: "skills" | "experience" | "projects" | "summary" | "education" | "certifications" | "languages";
  /** Lowercased haystack for matching. */
  haystack: string;
};

/*
 * Build a flat, searchable index of everything the CV actually claims.
 *
 * Note what is NOT in here: rawText. Matching against the whole blob is how the
 * old code "proved" a skill that appeared only inside the job description the
 * user had pasted into the same field, or inside a company's name. Every entry
 * here is a structured, attributable claim.
 */
function buildEvidenceIndex(profile: ResumeProfile): EvidenceEntry[] {
  const index: EvidenceEntry[] = [];
  const push = (text: string, origin: EvidenceEntry["origin"]) => {
    const clean = (text || "").trim();
    if (clean.length < 2) return;
    index.push({ text: clean, origin, haystack: clean.toLowerCase() });
  };

  for (const skill of profile.skills || []) push(skill, "skills");

  for (const role of profile.experience || []) {
    // The role header itself is evidence: a title and employer are claims.
    const header = [role.title, role.company, role.dates].filter(Boolean).join(", ");
    push(header, "experience");
    for (const bullet of role.bullets || []) {
      // Attribute the bullet to its role, so an explanation can say WHERE.
      const attributed = role.company ? `${bullet} (${role.title || "role"}, ${role.company})` : bullet;
      push(attributed, "experience");
    }
  }

  for (const project of profile.projects || []) {
    push(project.name, "projects");
    for (const bullet of project.bullets || []) push(bullet, "projects");
  }

  if (profile.summary) push(profile.summary, "summary");
  for (const item of profile.additionalEvidence || []) push(item, "summary");

  for (const edu of profile.education || []) {
    push([edu.degree, edu.institution, edu.dates].filter(Boolean).join(", "), "education");
  }
  for (const cert of profile.certifications || []) push(cert, "certifications");
  for (const lang of profile.languages || []) push(lang, "languages");

  return index;
}

/* ──────────────────────────────── token matching ─────────────────────────── */

/* ───────────────────────── years of experience, from the CV ───────────────── */

const YEAR_RE = /\b(19|20)\d{2}\b/g;

/*
 * Derive years of experience from the DATES on the experience entries, not from a
 * self-reported number. A CV that says "10 years of experience" in its summary and
 * shows two years of employment history should not be credited with ten.
 *
 * Returns null when the CV has no parseable dates: that is "not verifiable", which
 * is a genuinely different answer from "does not meet it", and the two must not be
 * collapsed. Penalising a candidate for a requirement we could not check is how you
 * tell a qualified nurse she is a poor match because her CV used a date format the
 * parser did not recognise.
 */
export function deriveYearsOfExperience(profile: ResumeProfile): number | null {
  const spans: Array<[number, number]> = [];
  const now = new Date().getFullYear();

  for (const role of profile.experience || []) {
    const dates = String(role.dates || "");
    const years = (dates.match(YEAR_RE) || []).map(Number).filter((y) => y >= 1950 && y <= now + 1);
    const ongoing = /\b(present|current|now|heute|aktuell|actuel|actualidad|today)\b/i.test(dates);

    if (years.length >= 2) spans.push([Math.min(...years), Math.max(...years)]);
    else if (years.length === 1) spans.push([years[0], ongoing ? now : years[0] + 1]);
  }

  if (!spans.length) return null;

  // Merge overlapping spans: two concurrent part-time roles are not double time.
  spans.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [spans[0]];
  for (const [start, end] of spans.slice(1)) {
    const last = merged[merged.length - 1];
    if (start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }

  return merged.reduce((total, [start, end]) => total + Math.max(0, end - start), 0);
}

function requiredYears(requirement: string, sourceLine: string): number | null {
  const m = `${requirement} ${sourceLine}`.match(/\b(\d{1,2})\s*\+?\s*(?:years?|yrs?|jahre|ans|a[ñn]os)\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 && n < 50 ? n : null;
}

/* ──────────────────────────────── the matcher ────────────────────────────── */

function matchOne(
  req: ExtractedRequirement,
  index: EvidenceEntry[],
  profile: ResumeProfile,
): JobRequirementMatch {
  const phrase = req.requirement.trim();
  const base = { requirement: phrase, category: req.category, criticality: req.criticality };

  /*
   * Experience requirements are ARITHMETIC, not text. "5+ years of experience"
   * is never going to appear verbatim in a CV, so the old substring test marked
   * every single one of them as missing, on every CV, for every job.
   */
  if (req.category === "experience") {
    const needed = requiredYears(phrase, req.sourceLine);
    if (needed !== null) {
      const have = deriveYearsOfExperience(profile);
      if (have === null) {
        return { ...base, status: "not_verifiable", evidence: [] };
      }
      const evidence = [`CV shows approximately ${have} year(s) of dated experience`];
      if (have >= needed) return { ...base, status: "matched", evidence };
      // Close enough to be worth an application, and honest about the shortfall.
      if (have >= needed - 1) return { ...base, status: "partial", evidence };
      return { ...base, status: "missing", evidence };
    }
    // A seniority word with no number ("senior", "track record") falls through to
    // the normal text path below.
  }

  /*
   * Location and work model cannot be settled from a CV alone. A CV does not say
   * whether someone will relocate. Marking these "missing" would penalise every
   * candidate for a fact the CV was never asked to contain.
   */
  if (req.category === "location") {
    const home = (profile.basics?.location || "").toLowerCase();
    if (home && containsPhrase(home, phrase.toLowerCase())) {
      return { ...base, status: "matched", evidence: [`Location on CV: ${profile.basics.location}`] };
    }
    return { ...base, status: "not_verifiable", evidence: [] };
  }

  /*
   * Language: match the LANGUAGE, not the LEVEL.
   *
   * The ad says "Fluent German is required", so the requirement reads
   * "German (FLUENT)". A CV's language section says "German". Matching the full
   * requirement string meant the level had to appear in the CV too, so a candidate
   * who genuinely speaks German was told German was missing and charged the
   * 18-point missing-language penalty. Almost no CV states a CEFR level.
   *
   * Listing a language on a CV IS the claim. We verify the claim exists. We do not
   * pretend to verify the fluency, and we do not punish the candidate for our
   * inability to.
   */
  if (req.category === "language") {
    const languageName = phrase.replace(/\s*\(.*\)\s*$/, "").trim();
    for (const entry of index) {
      if (containsPhrase(entry.haystack, languageName.toLowerCase())) {
        return { ...base, status: "matched", evidence: [entry.text] };
      }
    }
    return { ...base, status: "missing", evidence: [] };
  }

  /* Everything else is an evidence lookup. */
  const exact: string[] = [];
  const full: string[] = [];
  const partial: string[] = [];

  const reqStems = contentStems(phrase);

  for (const entry of index) {
    /* Verbatim phrase: the strongest possible proof. */
    if (containsPhrase(entry.haystack, phrase)) {
      exact.push(entry.text);
      continue;
    }

    if (!reqStems.length) continue;

    /*
     * Stem coverage within a SINGLE entry.
     *
     * Full coverage counts as matched, not merely partial. "valid nursing licence"
     * against "Registered Nurse licence, Bavaria" carries every content stem
     * (nurs, licenc) in one entry, and a licensed nurse must not be told she has no
     * licence because the ad wrote "nursing" and her CV wrote "Nurse".
     *
     * Coverage is measured per entry, never pooled across the whole CV: pooling lets
     * "Python" in one bullet and "developer" in another combine to "prove" a
     * requirement for "Python developer" that nothing in the CV actually supports.
     */
    const entryStems = new Set(contentStems(entry.text));
    const hits = reqStems.filter((s) => entryStems.has(s)).length;
    const ratio = hits / reqStems.length;

    if (ratio >= 1) {
      full.push(entry.text);
      continue;
    }

    /*
     * A credential is BINARY. You hold a nursing licence or you do not; there is no
     * "partially licensed". Without this, an unlicensed candidate earned partial
     * credit for a required credential purely because a job title shared a stem with
     * it, and partial credit carries no penalty, so the hardest gate in the ad quietly
     * stopped costing anything.
     *
     * (Languages are also binary, but they never reach this path: language
     * requirements return from their own branch above.)
     */
    const allowPartial = req.category !== "education";
    if (allowPartial && reqStems.length >= 2 && ratio >= 0.5) partial.push(entry.text);
  }

  const quote = (items: string[]) => Array.from(new Set(items)).slice(0, 3).map((s) => s.slice(0, 240));

  if (exact.length) return { ...base, status: "matched", evidence: quote(exact) };
  if (full.length) return { ...base, status: "matched", evidence: quote(full) };
  if (partial.length) return { ...base, status: "partial", evidence: quote(partial) };
  return { ...base, status: "missing", evidence: [] };
}

export function matchRequirementsAgainstCv(
  requirements: ExtractedRequirement[],
  profile: ResumeProfile | null | undefined,
): JobRequirementMatch[] {
  if (!profile) {
    // No CV means nothing is verifiable. It emphatically does not mean the
    // candidate is missing everything, and scoring must not read it that way.
    return requirements.map((req) => ({
      requirement: req.requirement,
      category: req.category,
      criticality: req.criticality,
      status: "not_verifiable" as JobRequirementStatus,
      evidence: [],
    }));
  }

  const index = buildEvidenceIndex(profile);
  return requirements.map((req) => matchOne(req, index, profile));
}

/**
 * The evidence-first gate.
 *
 * Generation (tailored CV, cover letter) may only assert a requirement that this
 * returns true for. Everything else belongs in the gaps panel, never in the
 * document. This is the single function that spec 2.2 hangs on, so it is
 * deliberately strict: "partial" is not proof.
 */
export function isSupportedByEvidence(match: JobRequirementMatch): boolean {
  return match.status === "matched" && match.evidence.length > 0;
}
