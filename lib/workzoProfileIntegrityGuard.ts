/*
 * workzoProfileIntegrityGuard.ts
 *
 * A structural, last-line guard against SECTION CROSS-CONTAMINATION in a parsed
 * resume profile.
 *
 * Multi-column and spatially-scrambled PDFs regularly cause a heuristic parser
 * to file content under the wrong heading. The failures are always the same
 * shapes, regardless of whose CV it is:
 *
 *   - a sentence from the SUMMARY gets filed as an EDUCATION entry
 *     ("Maternity, I Completed A Data Science Bootcamp In Germany...")
 *   - a PROJECT title leaks into an EXPERIENCE bullet
 *   - an entry name collapses to a placeholder ("Candidate", "Professional")
 *   - a degree is truncated to a single meaningless token ("Data")
 *
 * This module detects those SHAPES, never specific content. There are no
 * hardcoded person names, company names, schools, or CV vocabulary here, so it
 * works on any CV in any language that uses Latin script.
 *
 * It runs at the end of completeResumeProfile(), which is the single choke point
 * every surface (Improve CV, LinkedIn Optimizer, Cover Letter, interview setup)
 * reads through. Fixing it here fixes it everywhere.
 */

type AnyProfile = {
  summary?: string;
  basics?: { name?: string; headline?: string } | null;
  experience?: Array<{ title?: string; company?: string; dates?: string; bullets?: string[] }>;
  education?: Array<{ degree?: string; institution?: string; dates?: string }>;
  projects?: Array<{ name?: string; bullets?: string[] }>;
  [key: string]: unknown;
};

/** Placeholder values a parser emits when it could not read a real one. */
const PLACEHOLDER_RE = /^(candidate|professional|unknown|n\/?a|none|null|undefined|-{1,}|education|experience|projects?)$/i;

/** First-person prose markers. A heading or a degree never says "I".
 *  Multilingual: EN, DE, FR, ES, PT, IT, NL. A CV summary sentence that leaks
 *  into a structured section almost always carries one of these. */
const FIRST_PERSON_RE =
  /\b(i|my|me|we|our|ich|mein|meine|mir|wir|unser|je|mon|ma|mes|nous|notre|yo|mi|mis|nosotros|eu|meu|minha|nós|io|mio|mia|noi|nostro|ik|mijn|wij|onze)\b/i;

/** Signals a line is genuinely about education. Multilingual so a French or
 *  Spanish degree is not mistaken for contamination and dropped. */
const EDUCATION_SIGNAL_RE =
  /\b(bachelor|bachelors|master|masters|phd|doctorate|mba|bsc|msc|ba|bs|ms|diploma|degree|certificate|certification|bootcamp|university|college|school|institute|academy|akademie|universit|hochschule|fachhochschule|ausbildung|abitur|studium|licence|licenciatura|maitrise|maîtrise|ingenieur|ingénieur|laurea|diplome|diplôme|escuela|universidad|faculdade|scuola|opleiding)\b/i;

function norm(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function wordCount(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

/** Normalized comparison key so "A B." and "a  b" compare equal. */
function key(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isPlaceholder(value: string): boolean {
  return !value || PLACEHOLDER_RE.test(value.trim());
}

/**
 * Prose, not a field. A degree, project name, or job title is a LABEL: short,
 * no first-person pronouns, no sentence punctuation mid-string. A sentence that
 * escaped from the summary is the opposite.
 */
function looksLikeProse(value: string): boolean {
  const v = norm(value);
  if (!v) return false;
  if (FIRST_PERSON_RE.test(v)) return true;
  // Long, and reads like a sentence rather than a title.
  if (wordCount(v) >= 9 && /[,;]/.test(v)) return true;
  if (wordCount(v) >= 14) return true;
  return false;
}

/**
 * Content that also appears inside the summary is contamination: the parser
 * filed a slice of the summary under a structured section.
 */
function containedInSummary(value: string, summaryKey: string): boolean {
  const k = key(value);
  // Only meaningful for reasonably long strings; short tokens ("Data") collide
  // with normal summary words by chance.
  if (!k || summaryKey.length < 40 || k.length < 25) return false;
  return summaryKey.includes(k);
}

/** Words legitimately found inside a date field. Anything else is prose. */
const DATE_WORD_RE =
  /^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december|present|current|now|heute|today|to|until|bis|seit|since|and|of)$/i;

/**
 * A `dates` field must contain dates, nothing else.
 *
 * Internal QA annotations and parser notes have leaked into rendered date fields
 * before (e.g. "2014 (dates unverified - check original CV)" printing on a
 * user's exported CV). Fixing the writer stops NEW corruption, but profiles
 * already cached from an earlier parse keep their bad text forever. Sanitising
 * here, at the read choke point, cleans stored data too.
 *
 * Structural: it strips ANY parenthetical made of prose, not one known string,
 * so future leaks of any wording are caught as well.
 */
export function sanitizeDates(value: unknown): string {
  let v = norm(value);
  if (!v) return "";

  v = v.replace(/\([^)]*\)/g, (group) => {
    const inner = group.slice(1, -1);
    const words = inner.split(/[\s,;-]+/).filter((w) => /[a-zA-Z]/.test(w));
    // Keep the parenthetical only if every word in it is date vocabulary.
    const prose = words.filter((w) => !DATE_WORD_RE.test(w));
    return prose.length ? "" : group;
  });

  return v.replace(/\s{2,}/g, " ").replace(/\s*[-–—,]\s*$/, "").trim();
}

export type ProfileIntegrityReport = {
  removedEducation: string[];
  removedProjects: string[];
  removedExperience: string[];
  removedBullets: string[];
  repairedNames: string[];
};

/**
 * CROSS-FIELD NAME EXCLUSION.
 *
 * A two-word capitalized phrase looks exactly like "First Last", so a shape-only
 * validator happily accepts "Würzburg Germany" (a city + country from the address
 * block) or "Effective Communication" / "Public Relations" (skills) as the
 * candidate's name. Those then get printed as the CV header and used as the
 * export filename.
 *
 * The reliable structural signal is that a real person's name is NOT
 * simultaneously another field of their own CV. So we reject a name candidate
 * when it collides with the address, the skills list, or the headline.
 *
 * No gazetteer, no hardcoded cities or skills: we only compare the candidate
 * against OTHER fields parsed from the same document, so it generalises to any
 * CV in any language.
 */
export function isCrossFieldContaminatedName(
  candidate: unknown,
  fields: { location?: unknown; headline?: unknown; skills?: unknown; languages?: unknown },
): boolean {
  const name = norm(candidate);
  if (!name) return false;

  const nameKey = key(name);
  if (!nameKey) return false;

  const tokens = nameKey.split(" ").filter(Boolean);
  if (!tokens.length) return false;

  // 1. Collides with a skill: "Effective Communication", "Public Relations".
  const skills = Array.isArray(fields.skills) ? fields.skills : [];
  if (skills.some((s) => key(norm(s)) === nameKey)) return true;

  // 2. Is the headline (e.g. "Product Design Engineer").
  if (key(norm(fields.headline)) === nameKey) return true;

  // 3. Is a language entry ("German", "English").
  const languages = Array.isArray(fields.languages) ? fields.languages : [];
  if (languages.some((l) => key(norm(l)).split(" ")[0] === nameKey)) return true;

  // 4. Every token of the "name" also appears in the address/location field.
  //    "Würzburg Germany" vs "Zwergerweg 15, 97074 Würzburg, Germany" -> all
  //    tokens present -> it is the address, not a person.
  //    Requiring EVERY token (and at least two) keeps real names safe: a person
  //    called "Paris Hilton" living in Paris still keeps their name, because
  //    "hilton" is not in the address.
  const locationKey = key(norm(fields.location));
  if (tokens.length >= 2 && locationKey) {
    const locTokens = new Set(locationKey.split(" ").filter(Boolean));
    if (tokens.every((t) => locTokens.has(t))) return true;
  }

  return false;
}

/**
 * Strip cross-section contamination from a parsed profile.
 * Pure and non-destructive: it only ever REMOVES entries it can structurally
 * prove are misfiled, and never invents content.
 */
export function guardProfileIntegrity<T extends AnyProfile>(
  profile: T,
): { profile: T; report: ProfileIntegrityReport } {
  const report: ProfileIntegrityReport = {
    removedEducation: [],
    removedProjects: [],
    removedExperience: [],
    removedBullets: [],
    repairedNames: [],
  };
  if (!profile || typeof profile !== "object") return { profile, report };

  const summaryKey = key(norm(profile.summary));

  // ── Projects ────────────────────────────────────────────────────────────
  // Drop placeholder names and any "project" that is really summary prose.
  const projects = (Array.isArray(profile.projects) ? profile.projects : []).filter((p) => {
    const name = norm(p?.name);
    if (isPlaceholder(name)) {
      report.removedProjects.push(name || "(empty)");
      return false;
    }
    if (looksLikeProse(name) || containedInSummary(name, summaryKey)) {
      report.removedProjects.push(name);
      return false;
    }
    return true;
  });

  const projectKeys = new Set(projects.map((p) => key(norm(p?.name))).filter(Boolean));

  // ── Education ───────────────────────────────────────────────────────────
  // An education entry must look like education. A summary sentence filed here
  // (the classic multi-column failure) has first-person prose and no education
  // signal, so it is structurally identifiable without knowing the school.
  const educationFiltered = (Array.isArray(profile.education) ? profile.education : []).filter((e) => {
    const degree = norm(e?.degree);
    const institution = norm(e?.institution);
    const combined = `${degree} ${institution}`.trim();

    if (!combined || isPlaceholder(degree) && isPlaceholder(institution)) {
      report.removedEducation.push(combined || "(empty)");
      return false;
    }
    // Prose sentence with no education signal anywhere: contamination.
    if (looksLikeProse(combined) && !EDUCATION_SIGNAL_RE.test(combined)) {
      report.removedEducation.push(combined);
      return false;
    }
    // Verbatim slice of the summary: contamination.
    if (containedInSummary(combined, summaryKey)) {
      report.removedEducation.push(combined);
      return false;
    }
    return true;
  });

  // Deduplicate the same degree from the same institution. Rewrite/merge paths
  // can append the education list a second time, so the exported CV printed the
  // same degree twice. Match on degree + institution ignoring punctuation and
  // any trailing country ("Luleå University of Technology, Sweden" and
  // "Luleå University of Technology · Sweden" are one school), and keep the copy
  // carrying the most complete date range.
  const dateSpan = (value: unknown): number => (norm(value).match(/\b(19|20)\d{2}\b/g) || []).length;
  const eduBest = new Map<string, NonNullable<AnyProfile["education"]>[number]>();
  for (const raw of educationFiltered) {
    // Clean any prose that leaked into the date field, including on profiles
    // cached before the writer was fixed.
    const e = { ...raw, dates: sanitizeDates(raw?.dates) };
    const k = `${key(norm(e?.degree))}|${key(norm(e?.institution)).split(" ").slice(0, 4).join(" ")}`;
    const existing = eduBest.get(k);
    if (!existing) {
      eduBest.set(k, e);
      continue;
    }
    // Prefer the entry with more real years in its date range.
    if (dateSpan(e?.dates) > dateSpan(existing?.dates)) eduBest.set(k, e);
    report.removedEducation.push(`${norm(e?.degree)} (duplicate)`);
  }
  const education = [...eduBest.values()];

  // ── Experience ──────────────────────────────────────────────────────────
  const experience = (Array.isArray(profile.experience) ? profile.experience : [])
    .filter((x) => {
      const title = norm(x?.title);
      const company = norm(x?.company);
      if (!title && !company) {
        report.removedExperience.push("(empty)");
        return false;
      }
      // A role whose title is summary prose is contamination.
      if (looksLikeProse(title) || containedInSummary(`${title} ${company}`, summaryKey)) {
        report.removedExperience.push(`${title} ${company}`.trim());
        return false;
      }
      return true;
    })
    .map((x) => {
      const bullets = (Array.isArray(x?.bullets) ? x.bullets : []).filter((b) => {
        const bullet = norm(b);
        if (!bullet) return false;
        // A bullet that is verbatim a PROJECT name is project content that
        // leaked into the experience section.
        if (projectKeys.has(key(bullet))) {
          report.removedBullets.push(bullet);
          return false;
        }
        // A bullet that is a verbatim slice of the summary is contamination.
        if (containedInSummary(bullet, summaryKey)) {
          report.removedBullets.push(bullet);
          return false;
        }
        return true;
      });
      return { ...x, bullets, ...(x?.dates !== undefined ? { dates: sanitizeDates(x.dates) } : {}) };
    });

  return {
    profile: { ...profile, projects, education, experience } as T,
    report,
  };
}
