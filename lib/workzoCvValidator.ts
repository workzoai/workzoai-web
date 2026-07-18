/**
 * WorkZo CV Validator — READ-ONLY validation layer.
 * ============================================================================
 * Sits between AI Extraction and the Canonical Builder, and is ALSO run as a
 * post-condition on the builder's output. It NEVER mutates a profile. It
 * observes and reports.
 *
 * Every rule here was derived from a REAL production failure in the uploaded
 * logs. But no rule names a CV, a person, a filename or a template. Each is a
 * STRUCTURAL or SELF-REFERENTIAL invariant that holds for any resume on earth:
 *
 *   log evidence                          -> rule
 *   -------------------------------------------------------------------------
 *   parser 7 -> final 4 (11 of 13 CVs)    -> experience_count_decreased
 *   parser 5 -> final 3                   -> education/projects_count_decreased
 *   headline "Project Management"         -> headline_is_skill
 *   headline "Ex-Technical support ..."   -> headline_is_summary_fragment
 *   headline "Würzburg, Germany devel..." -> headline_contains_address
 *   headline "Manager"                    -> headline_is_header_fragment
 *   name "Harithavijayakumar Itsupport"   -> name_contaminated_by_headline
 *   languages ["English - FLUENT",
 *              "English (Fluent)"]        -> languages_duplicated
 *   languages 3 -> 1                      -> languages_dropped
 *
 * The validator is the safety net. The Canonical Builder is the fix. If the
 * builder is correct the validator never fires — which is exactly what
 * eval/regression_cv_production_logs.ts asserts.
 * ============================================================================
 */

import type { ResumeProfile } from "@/lib/workzoResumeParser";
import {
  canonicalizeExperience,
  canonicalizeEducation,
  canonicalizeProjects,
  splitLanguageEntry,
  splitPackedLanguages,
  canonicalLanguageName,
  isLanguageNameShaped,
  isSectionComposite,
  exactKey,
  letterBlob,
  tidy,
  SECTION_NAMES,
} from "@/lib/workzoCvCanonicalBuilder";

export type ValidationSeverity = "error" | "warning";

export type ValidationViolation = {
  rule: string;
  severity: ValidationSeverity;
  detail: string;
};

export type ValidationReport = {
  ok: boolean;
  violations: ValidationViolation[];
};

function count(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

/* ==========================================================================
 * Count parity
 * --------------------------------------------------------------------------
 * The ONLY legal reason a count may shrink is exact-duplicate removal. We
 * recompute the legal floor independently rather than trusting the pipeline.
 * ======================================================================== */

function checkCounts(
  parsed: ResumeProfile,
  final: ResumeProfile,
  out: ValidationViolation[],
): void {
  const cases: Array<[string, number, number]> = [
    ["experience", canonicalizeExperience(parsed.experience).length, count(final.experience)],
    ["education", canonicalizeEducation(parsed.education).length, count(final.education)],
    ["projects", canonicalizeProjects(parsed.projects).length, count(final.projects)],
  ];

  for (const [field, legal, actual] of cases) {
    if (actual < legal) {
      out.push({
        rule: `${field}_count_decreased`,
        severity: "error",
        detail:
          `${field}: parser yields ${legal} record(s) after exact-duplicate removal, ` +
          `final profile has ${actual}. ${legal - actual} record(s) were destroyed ` +
          `by a stage that is not permitted to write.`,
      });
    }
    if (actual > legal) {
      out.push({
        rule: `${field}_count_increased`,
        severity: "error",
        detail: `${field}: final has ${actual} but parser only supports ${legal}. Records were invented.`,
      });
    }
  }
}

/* ==========================================================================
 * Languages
 * ======================================================================== */

/**
 * The identity of a language, computed EXACTLY as the builder computes it.
 *
 * This previously used the raw letter blob, so the validator believed
 * "Deutsch - B2" -> "German (B2)" had DESTROYED a language: it compared the
 * endonym "deutsch" against the canonical "german" and saw a missing key. It
 * also never split packed entries, so
 * "English (Fluent) - German (Intermediate) - Spanish (Native)" produced the
 * phantom key "englishfluentgermanintermediatespanish".
 *
 * Both were false alarms on CORRECT builder output. A validator that does not
 * share the producer's notion of identity cannot check preservation — it just
 * reports its own disagreement about naming. Identity now comes from one place.
 */
function languageIdentities(input: unknown): Map<string, string> {
  const out = new Map<string, string>();
  for (const entry of Array.isArray(input) ? input : []) {
    for (const chunk of splitPackedLanguages(String(entry))) {
      const { name } = splitLanguageEntry(chunk);
      if (!name || !isLanguageNameShaped(name)) continue;
      const key = letterBlob(canonicalLanguageName(name));
      if (key && !out.has(key)) out.set(key, String(entry));
    }
  }
  return out;
}

function checkLanguages(
  parsed: ResumeProfile,
  final: ResumeProfile,
  out: ValidationViolation[],
): void {
  const seen = new Map<string, string>();
  for (const entry of Array.isArray(final.languages) ? final.languages : []) {
    const { name } = splitLanguageEntry(String(entry));
    const key = letterBlob(canonicalLanguageName(name));
    if (!key) continue;
    if (seen.has(key)) {
      out.push({
        rule: "languages_duplicated",
        severity: "error",
        detail: `language "${name}" appears twice: "${seen.get(key)}" and "${entry}". One language, one level.`,
      });
    } else {
      seen.set(key, String(entry));
    }
  }

  // A language IDENTITY present in parser output must survive to the final
  // profile. Identity, not raw string: "Deutsch - B2" and "German (B2)" are the
  // same language and merging them is the builder doing its job.
  const parsedNames = languageIdentities(parsed.languages);
  for (const [key, original] of parsedNames) {
    if (!seen.has(key)) {
      out.push({
        rule: "languages_dropped",
        severity: "error",
        detail: `language "${original}" (identity "${key}") is in parser output but missing from the final profile.`,
      });
    }
  }
}

/* ==========================================================================
 * Headline
 * ======================================================================== */

const ADDRESS_RE =
  /\b\d{4,6}\b|\b(stra(?:ss|ß)e|weg|allee|platz|street|road|avenue|lane|postal|zip)\b/i;

function checkHeadline(final: ResumeProfile, out: ValidationViolation[]): void {
  const headline = tidy(final.basics?.headline);
  if (!headline) return; // blank is a legal ladder outcome

  const key = exactKey(headline);

  // Rule: the headline may never be one of the profile's own skills.
  for (const skill of Array.isArray(final.skills) ? final.skills : []) {
    if (exactKey(skill) === key) {
      out.push({
        rule: "headline_is_skill",
        severity: "error",
        detail: `headline "${headline}" is also listed as a skill. A skill is not a job title.`,
      });
      break;
    }
  }

  // Rule: the headline may never be a section heading.
  if (SECTION_NAMES.some((section) => exactKey(section) === key)) {
    out.push({
      rule: "headline_is_section_name",
      severity: "error",
      detail: `headline "${headline}" is a section heading.`,
    });
  }

  // Rule: the headline may never BE the opening of the summary.
  //
  // This used `includes` and therefore fired on almost every correct profile —
  // a real headline routinely appears inside its own summary ("Experienced
  // Cloud Architect with..."). The validator was contradicting correct builder
  // output, which is the same class of bug as the languages_dropped false
  // alarm. Identity of the rule must match the builder's: PREFIX only.
  const summaryBlob = letterBlob(final.summary);
  const headlineBlob = letterBlob(headline);
  const headlineWords = headline.split(/\s+/).filter(Boolean);
  if (
    headlineBlob.length >= 20 &&
    headlineWords.length >= 7 &&
    summaryBlob &&
    summaryBlob.startsWith(headlineBlob)
  ) {
    out.push({
      rule: "headline_is_summary_fragment",
      severity: "error",
      detail: `headline "${headline}" is a long prose opening copied from the summary.`,
    });
  }

  // Rule: the headline may never be a project name.
  for (const project of Array.isArray(final.projects) ? final.projects : []) {
    if (project?.name && exactKey(project.name) === key) {
      out.push({
        rule: "headline_is_project_name",
        severity: "error",
        detail: `headline "${headline}" is a project name.`,
      });
      break;
    }
  }

  // Rule: the headline may never contain an address.
  if (ADDRESS_RE.test(headline)) {
    out.push({
      rule: "headline_contains_address",
      severity: "error",
      detail: `headline "${headline}" contains address-shaped tokens.`,
    });
  }

  // Rule: the headline may never be sentence-shaped prose.
  if (/[.!?]$/.test(headline) || headline.split(/\s+/).length > 10) {
    out.push({
      rule: "headline_is_prose",
      severity: "error",
      detail: `headline "${headline}" is sentence-shaped, not a title.`,
    });
  }

  // Rule: the headline may never equal the candidate's own name.
  if (final.basics?.name && exactKey(final.basics.name) === key) {
    out.push({
      rule: "headline_is_name",
      severity: "error",
      detail: `headline "${headline}" is the candidate's own name.`,
    });
  }
}

/**
 * Rule: the headline may not be a strict fragment of a longer title-shaped line
 * in the source document. This is what turned a letter-spaced
 * "J U N I O R  C U S T O M E R  S U C C E S S  M A N A G E R" header into the
 * single word "Manager". Structural: compare letter blobs against source lines.
 */
function checkHeadlineTruncation(
  final: ResumeProfile,
  rawText: string,
  out: ValidationViolation[],
): void {
  const headline = tidy(final.basics?.headline);
  const blob = letterBlob(headline);
  if (!blob || blob.length < 3) return;

  // Only the HEADER REGION counts. Everything from the first section heading
  // onward is body content, and an experience entry legitimately repeats a job
  // title ("AUG 2022 - HEUTE PRODUCT DESIGN ENGINEER"). Treating those as
  // truncated headers produced a warning on every correct headline.
  const allLines = String(rawText || "").split(/\r?\n/);
  let headerEnd = allLines.length;
  for (let i = 0; i < allLines.length; i += 1) {
    if (i > 0 && isSectionComposite(allLines[i])) { headerEnd = i; break; }
  }

  for (const line of allLines.slice(0, headerEnd)) {
    const lineBlob = letterBlob(line);
    if (lineBlob.length <= blob.length) continue;
    if (!lineBlob.endsWith(blob) && !lineBlob.startsWith(blob)) continue;
    // A line carrying a date is an experience entry, not a header.
    if (/\b(19|20)\d{2}\b/.test(line)) continue;
    // The source line is title-shaped and strictly longer -> the headline is a
    // fragment. Shape is measured on the LETTER BLOB, because a letter-spaced
    // header ("J U N I O R  M A N A G E R") has one token per glyph and would
    // never pass a word-count test.
    if (lineBlob.length <= 60 && !/[.!?]$/.test(tidy(line))) {
      out.push({
        rule: "headline_is_header_fragment",
        severity: "warning",
        detail: `headline "${headline}" is a fragment of the longer header line "${tidy(line)}".`,
      });
      return;
    }
  }
}

/* ==========================================================================
 * Name
 * ======================================================================== */

function checkName(final: ResumeProfile, out: ValidationViolation[]): void {
  const name = tidy(final.basics?.name);
  if (!name) return; // empty + needsConfirmation is a legal, honest outcome

  const nameKey = exactKey(name);

  // Rule: the name may never be a section heading.
  if (SECTION_NAMES.some((section) => exactKey(section) === nameKey)) {
    out.push({
      rule: "name_is_section_name",
      severity: "error",
      detail: `name "${name}" is a section heading.`,
    });
  }

  // Rule: no token of the name may be a prefix of the headline's letter blob.
  // This is what produced "Harithavijayakumar Itsupport" — the letter-spaced
  // headline "I T  S U P P O R T  S P E C I A L I S T" collapsed into the name.
  const headlineBlob = letterBlob(final.basics?.headline);
  if (headlineBlob.length >= 4) {
    for (const token of name.split(/\s+/)) {
      const tokenBlob = letterBlob(token);
      if (tokenBlob.length >= 4 && headlineBlob.startsWith(tokenBlob)) {
        out.push({
          rule: "name_contaminated_by_headline",
          severity: "error",
          detail: `name token "${token}" is a prefix of the headline "${final.basics?.headline}". The header bled into the name.`,
        });
        break;
      }
    }
  }

  // Rule: a location/address may never be published as a person name.
  if (
    /\b\d{4,6}\b|\b(?:street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|weg|str(?:asse|aße)?|allee|platz|postal|zip)\b/iu.test(name) ||
    (/^[\p{L}.'’ -]{2,40},\s*[\p{L}.'’ -]{2,40}$/u.test(name) && !/\b(?:de|da|del|van|von)\b/i.test(name))
  ) {
    out.push({
      rule: "name_is_location",
      severity: "error",
      detail: `name "${name}" is location/address-shaped.`,
    });
  }

  // Rule: the name may never contain contact-shaped tokens.
  if (/@|https?:|www\.|linkedin|\+\d|\b\d{4,}\b/i.test(name)) {
    out.push({
      rule: "name_contains_contact",
      severity: "error",
      detail: `name "${name}" contains contact-shaped tokens.`,
    });
  }

  // Rule: the name may never be sentence-shaped.
  if (name.split(/\s+/).length > 6 || /[.!?]$/.test(name)) {
    out.push({
      rule: "name_is_prose",
      severity: "error",
      detail: `name "${name}" is prose, not a name.`,
    });
  }

  // Rule: the name may never be one of the profile's own skills.
  for (const skill of Array.isArray(final.skills) ? final.skills : []) {
    if (exactKey(skill) === nameKey) {
      out.push({
        rule: "name_is_skill",
        severity: "error",
        detail: `name "${name}" is also listed as a skill.`,
      });
      break;
    }
  }

  // Rule: no TOKEN of the name may be one of the profile's own skills.
  //
  // Whole-string comparison missed every real failure in production, because
  // the extractor assembles names out of the skills sidebar rather than copying
  // one skill verbatim: "Tableau Api", "Tools Ticketing-systeme". Each token is
  // a skill; the concatenation is not. Comparing tokens against the profile's
  // OWN skills catches all of them and needs no vocabulary of its own.
  //
  // Accepted trade-off: a candidate genuinely named after a technology (a
  // "Ruby" who also lists Ruby as a skill) is flagged. The outcome of a flag is
  // a confirmation prompt, not data loss — and the brief is explicit that a
  // name must never be a skill or a technology. Asking that person to confirm
  // is far cheaper than shipping "Tableau Api" as a human being's name.
  const skillKeys = new Set(
    (Array.isArray(final.skills) ? final.skills : []).map(exactKey).filter(Boolean),
  );
  for (const token of name.split(/\s+/)) {
    const key = exactKey(token);
    if (key.length >= 3 && skillKeys.has(key)) {
      out.push({
        rule: "name_token_is_skill",
        severity: "error",
        detail: `name token "${token}" is one of the profile's own skills. The name was assembled from the skills section.`,
      });
      break;
    }
  }

  // Rule: the name may never be built out of section vocabulary ("Key Projects",
  // "Profile Summary"). Catches the whole-string and letter-spaced forms.
  if (isSectionComposite(name)) {
    out.push({
      rule: "name_is_section_composite",
      severity: "error",
      detail: `name "${name}" is composed of section headings.`,
    });
  } else {
    for (const token of name.split(/\s+/)) {
      if (isSectionComposite(token) && exactKey(token).length >= 4) {
        out.push({
          rule: "name_is_section_composite",
          severity: "error",
          detail: `name token "${token}" is a section heading.`,
        });
        break;
      }
    }
  }
}

/* ==========================================================================
 * Summary
 * ======================================================================== */

function checkSummary(
  parsed: ResumeProfile,
  final: ResumeProfile,
  out: ValidationViolation[],
): void {
  const before = tidy(parsed.summary);
  const after = tidy(final.summary);
  if (before && after !== before) {
    out.push({
      rule: "summary_rewritten",
      severity: "error",
      detail: "summary differs from parser output beyond whitespace normalization. It must never be rewritten.",
    });
  }
}

/* ==========================================================================
 * Public API
 * ======================================================================== */

/**
 * Validate a final profile against the parser output it came from.
 * READ-ONLY. Returns a report; never throws, never mutates.
 */
export function validateCanonicalProfile(input: {
  parsed: ResumeProfile;
  final: ResumeProfile;
  rawText?: string;
}): ValidationReport {
  const violations: ValidationViolation[] = [];
  const parsed = input.parsed || ({} as ResumeProfile);
  const final = input.final || ({} as ResumeProfile);

  checkCounts(parsed, final, violations);
  checkLanguages(parsed, final, violations);
  checkHeadline(final, violations);
  checkHeadlineTruncation(final, String(input.rawText || final.rawText || ""), violations);
  checkName(final, violations);
  checkSummary(parsed, final, violations);

  return {
    ok: violations.every((v) => v.severity !== "error"),
    violations,
  };
}

/** Compact one-line log form. */
export function formatValidationReport(report: ValidationReport): string {
  if (!report.violations.length) return "ok";
  return report.violations.map((v) => `[${v.severity}] ${v.rule}: ${v.detail}`).join(" | ");
}
