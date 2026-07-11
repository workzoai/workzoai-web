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
  skills?: string[];
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

/** Repair a field corrupted by two-column PDF extraction:
 *  a sidebar heading glued to the front ("PROGRAMMING CSS Corp (...)") and the
 *  same fragment repeated ("X, Chennai () X"). Structural: no company or CV
 *  vocabulary, just header shapes and self-repetition. */
const SIDEBAR_HEADER_RE =
  /^(programming|skills?|core skills?|soft skills?|technical skills?|languages?|data (visuali[sz]ation|engineering)|machine learning|tools?|expertise|contact|education|experience|projects?|profile|summary)\s+/i;

function repairLeakedField(value: string): string {
  let v = norm(value);
  if (!v) return "";
  // Strip a leaked sidebar heading from the front (possibly several).
  for (let i = 0; i < 3 && SIDEBAR_HEADER_RE.test(v); i++) {
    v = v.replace(SIDEBAR_HEADER_RE, "").trim();
  }
  // Collapse self-repetition: "A, B () A" -> "A, B".
  const half = Math.floor(v.length / 2);
  for (let cut = half; cut > 8; cut--) {
    const head = v.slice(0, cut).trim();
    if (head.length > 8 && v.slice(cut).replace(/[^\p{L}\p{N}]/gu, " ").toLowerCase().includes(head.replace(/[^\p{L}\p{N}]/gu, " ").toLowerCase().trim())) {
      v = head;
      break;
    }
  }
  return v.replace(/[\s,;(]+$/, "").replace(/\(\s*\)/g, "").replace(/\s{2,}/g, " ").trim();
}

export type ProfileIntegrityReport = {
  removedEducation: string[];
  removedProjects: string[];
  removedSkills: string[];
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
    removedSkills: [],
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
    .map((x) => ({
      ...x,
      // Repair first: deleting a corrupted entry would LOSE a real job.
      title: repairLeakedField(norm(x?.title)),
      company: repairLeakedField(norm(x?.company)),
    }))
    .filter((x) => {
      const title = norm(x?.title);
      const company = norm(x?.company);
      if (!title && !company) {
        report.removedExperience.push("(empty)");
        return false;
      }
      // A repaired entry that still has a usable company is a REAL job: keep it
      // even if the title is imperfect. Only drop it when nothing survives.
      if (company && company.length > 2) return true;
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

  // ── Skills ──────────────────────────────────────────────────────────────
  // A skill is not an EMPLOYER. Two-column CVs regularly spill the experience
  // column into the skills sidebar, so company names ("Zoho Corp", "CSS Corp")
  // get stored as skills and then poison the rewrite, which starts injecting
  // them into bullets. Detected by cross-field comparison against this CV's own
  // experience entries: no company lists, no vocabulary, works for any CV.
  // Use the REPAIRED experience list: the raw one may hold corrupted company
  // strings ("PROGRAMMING CSS Corp (...)"), which would fail to match the skill
  // "CSS Corp" and let the employer survive in the skills list.
  const companyKeys = new Set(
    experience
      .map((x) => key(norm(x?.company)))
      .filter((k) => k.length > 2),
  );
  const candidateNameKey = key(norm(profile.basics?.name));

  const skills = (Array.isArray(profile.skills) ? profile.skills : []).filter((raw) => {
    const skill = norm(raw);
    if (!skill) return false;
    const k = key(skill);
    if (!k) return false;

    // An employer, in any of the shapes a two-column CV produces:
    //   - exactly the company            ("NHS Trust")
    //   - the company plus product detail ("Zoho Corp (ManageEngine - ...)")
    //   - the company's leading words     ("CSS Corp" from "CSS Corp (Belkin...)")
    //
    // The last case is only safe when the fragment carries a CORPORATE
    // DESIGNATOR. Otherwise a genuine skill that happens to start an employer's
    // name would be deleted: someone at "Oracle Consulting Ltd" may legitimately
    // list "Oracle" the database as a skill, and must keep it.
    const hasCorporateDesignator =
      /\b(corp|corporation|inc|incorporated|ltd|limited|llc|llp|gmbh|mbh|ag|kg|sa|sas|srl|bv|nv|plc|oy|ab|as|group|holdings?|trust|pvt|pte|co)\b/i.test(skill);

    for (const company of companyKeys) {
      const isExact = k === company;
      const isCompanyWithDetail = k.startsWith(`${company} `);
      const isCompanyPrefix = company.startsWith(`${k} `) && hasCorporateDesignator;
      if (isExact || isCompanyWithDetail || isCompanyPrefix) {
        report.removedSkills.push(skill);
        return false;
      }
    }
    if (candidateNameKey && k === candidateNameKey) {
      report.removedSkills.push(skill);
      return false;
    }
    if (isPlaceholder(skill) || looksLikeProse(skill)) {
      report.removedSkills.push(skill);
      return false;
    }
    return true;
  });

  return {
    profile: { ...profile, projects, education, experience, skills } as T,
    report,
  };
}

/**
 * RECOVER THE REAL NAME FROM THE TOP OF THE CV.
 *
 * When the incoming name is rejected (it was the address or a skill) and the
 * generic extractor also only offers contaminated text, we previously fell
 * through to an EMPTY name. Empty is safer than wrong, but it is not the right
 * answer: virtually every CV prints the candidate's name on the first line.
 *
 * This scans the first lines of the raw CV for the first line that LOOKS like a
 * person's name and is not contaminated by another field. Purely structural, so
 * it works for any CV: no name lists, no locales, no sample-specific rules.
 */
export function recoverNameFromRawText(
  rawText: unknown,
  fields: { location?: unknown; headline?: unknown; skills?: unknown; languages?: unknown },
): string {
  const text = typeof rawText === "string" ? rawText : "";
  if (!text) return "";

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 12); // the name is at the top of the document

  for (const line of lines) {
    // Some PDF extractors space out header letters ("S U R E N D E R  D...").
    // Collapse single-letter runs back into words, using a wider gap (2+ spaces)
    // as the word boundary where the extractor preserved one.
    const candidate = /^(?:\p{L}\s+){3,}\p{L}\s*$/u.test(line)
      ? line
          .split(/\s{2,}/)
          .map((chunk) => chunk.replace(/\s+/g, ""))
          .filter(Boolean)
          .join(" ")
      : line;

    if (!candidate || candidate.length < 4 || candidate.length > 60) continue;
    // Reject anything with contact/section markers: not a name line.
    if (/[@\d]|https?:|www\.|\||·|;/.test(candidate)) continue;
    // A name is 1 to 4 words of letters (allowing hyphens/apostrophes).
    const words = candidate.split(/\s+/);
    if (words.length < 1 || words.length > 4) continue;
    if (!words.every((w) => /^[\p{L}][\p{L}'’.-]*$/u.test(w))) continue;
    // Must not be SHOUTED section header vocabulary.
    if (/^(curriculum vitae|resume|cv|profile|contact|kontakt|summary|education|experience|skills|languages)$/i.test(candidate)) continue;
    // Must not collide with the address, a skill, the headline, or a language.
    if (isCrossFieldContaminatedName(candidate, fields)) continue;

    return candidate.replace(/\s+/g, " ").trim();
  }

  return "";
}
