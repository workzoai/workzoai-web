/**
 * WorkZo CV Canonical Builder — THE SINGLE OWNER OF ResumeProfile.
 * ============================================================================
 * This is the ONLY module permitted to construct a final ResumeProfile.
 * Every stage before it (OCR, spatial layout, section detection, AI extraction,
 * validation) is READ-ONLY. No stage after it is permitted to exist.
 *
 *   PDF -> OCR -> Spatial Layout -> Section Detection -> AI Extraction
 *       -> Validation (read-only, produces a report)
 *       -> Canonical Builder (THIS FILE, sole writer)
 *       -> Return (deep-frozen)
 *
 * INVARIANTS (enforced by eval/regression_cv_canonical_parity.ts):
 *   1. buildCanonicalResumeProfile() is PURE — never mutates `input`.
 *   2. experience/education shrink ONLY by EXACT 4-key duplicates.
 *   3. Order is NEVER changed. First occurrence wins.
 *   4. Nothing is ever inferred, invented, completed or rewritten.
 *   5. The result is deep-frozen — downstream mutation cannot corrupt it.
 *
 * FORBIDDEN HERE (enforced by source scan in the regression suite):
 *   filename checks | hardcoded names | sample-specific regex | fuzzy merging
 *   | AI calls or retries | Math.random
 * ============================================================================
 */

import type {
  ResumeProfile,
  ResumeExperience,
  ResumeEducation,
  ResumeProject,
} from "@/lib/workzoResumeParser";
import { resolveAuthoritativeCvName } from "@/lib/workzoCvNameStage";

/* ==========================================================================
 * 0. Primitives
 * ======================================================================== */

/** The ONLY text transform allowed on factual content: whitespace + OCR artifacts. */
export function tidy(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u00a0\u2007\u202f]/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tidyList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const text = tidy(item);
    if (text) out.push(text);
  }
  return out;
}

/** Comparison key. Used ONLY for EXACT-duplicate tests. */
export function exactKey(value: unknown): string {
  return tidy(value).toLowerCase();
}

/** Strip accents so multilingual tokens match one table. */
export function deaccent(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Collapse to bare letters — used to detect letter-spacing and mashed tokens. */
export function letterBlob(value: unknown): string {
  return deaccent(tidy(value).toLowerCase()).replace(/[^a-z0-9]/g, "");
}

/* ==========================================================================
 * 1. Date normalization
 * --------------------------------------------------------------------------
 * The duplicate rule is defined on START and END, so a `dates` range must be
 * split deterministically. This NORMALIZES; it never infers. An unreadable
 * boundary stays empty and the record is treated as DISTINCT — unknown dates
 * must never collapse two records together.
 * ======================================================================== */

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, januar: 1, janvier: 1, enero: 1, gennaio: 1, janeiro: 1,
  feb: 2, february: 2, februar: 2, fevrier: 2, febrero: 2, febbraio: 2, fevereiro: 2,
  mar: 3, march: 3, marz: 3, maerz: 3, mars: 3, marzo: 3, marco: 3,
  apr: 4, april: 4, avril: 4, abril: 4, aprile: 4,
  may: 5, mai: 5, mayo: 5, maggio: 5, maio: 5,
  jun: 6, june: 6, juni: 6, juin: 6, junio: 6, giugno: 6, junho: 6,
  jul: 7, july: 7, juli: 7, juillet: 7, julio: 7, luglio: 7, julho: 7,
  aug: 8, august: 8, aout: 8, agosto: 8, ago: 8,
  sep: 9, sept: 9, september: 9, septembre: 9, septiembre: 9, settembre: 9, setembro: 9,
  oct: 10, october: 10, okt: 10, oktober: 10, octobre: 10, octubre: 10, ottobre: 10, outubro: 10,
  nov: 11, november: 11, novembre: 11, noviembre: 11, novembro: 11,
  dec: 12, december: 12, dez: 12, dezember: 12, decembre: 12, diciembre: 12, dicembre: 12, dezembro: 12,
};

/** Closed multilingual vocabulary of "still employed" tense markers. */
const PRESENT_TOKENS = new Set([
  "present", "current", "now", "today", "ongoing", "date", "till date",
  "heute", "aktuell", "laufend", "jetzt",
  "actuel", "aujourdhui", "maintenant", "en cours",
  "actual", "actualidad", "presente", "hoy",
  "attuale", "oggi", "in corso", "atual", "hoje",
  "nu", "pagaidam",
]);

/**
 * Normalize one date boundary to a sortable canonical form.
 *   "Jan 2020" -> "2020-01" | "03/2021" -> "2021-03" | "2019" -> "2019"
 *   "Present"  -> "present" | garbage -> "" (stays DISTINCT, never merged)
 */
export function normalizeDateBoundary(value: unknown): string {
  const raw = deaccent(tidy(value).toLowerCase()).replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  if (PRESENT_TOKENS.has(raw)) return "present";

  const iso = raw.match(/^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?$/);
  if (iso) return `${iso[1]}-${String(Number(iso[2])).padStart(2, "0")}`;

  const numeric = raw.match(/^(\d{1,2})[-/](\d{4})$/);
  if (numeric) {
    const month = Number(numeric[1]);
    if (month >= 1 && month <= 12) return `${numeric[2]}-${String(month).padStart(2, "0")}`;
  }

  const word = raw.match(/^([a-z]+)\s+(\d{4})$/) || raw.match(/^(\d{4})\s+([a-z]+)$/);
  if (word) {
    const token = /^\d/.test(word[1]) ? word[2] : word[1];
    const year = /^\d/.test(word[1]) ? word[1] : word[2];
    const month = MONTHS[token];
    if (month) return `${year}-${String(month).padStart(2, "0")}`;
  }

  const year = raw.match(/^(\d{4})$/);
  if (year) return year[1];

  return "";
}

/** Split a `dates` range string into normalized [start, end]. */
export function splitDateRange(value: unknown): { start: string; end: string } {
  const raw = tidy(value);
  if (!raw) return { start: "", end: "" };

  const parts = raw.split(
    /\s(?:to|bis|until|hasta|jusqu'?au?|au|ate|a)\s|\s*[\u2010-\u2015\u2212]\s*|\s+-\s+/i,
  );
  if (parts.length >= 2) {
    return {
      start: normalizeDateBoundary(parts[0]),
      end: normalizeDateBoundary(parts[parts.length - 1]),
    };
  }
  return { start: normalizeDateBoundary(raw), end: "" };
}

/* ==========================================================================
 * 2. Experience — highest priority, immutable after the parser
 * ======================================================================== */

/**
 * The EXACT duplicate key, exactly as specified:
 *   Company AND Title AND Start Date AND End Date. Nothing else.
 * A record with an unreadable date gets a unique ordinal so it can never
 * collide: unknown != equal.
 */
function experienceKey(job: ResumeExperience, ordinal: number): string {
  const { start, end } = splitDateRange(job.dates);
  const unreadable = !start && !end && Boolean(tidy(job.dates));
  return [
    exactKey(job.company),
    exactKey(job.title),
    start,
    end,
    unreadable ? `#${ordinal}` : "",
  ].join("\u0000");
}

/**
 * PERMITTED: trim whitespace, normalize dates, drop EXACT 4-key duplicates.
 * FORBIDDEN: merging promotions/similar companies/overlapping dates, reordering,
 *            dropping sparse records, inferring missing fields.
 */
export function canonicalizeExperience(input: unknown): ResumeExperience[] {
  if (!Array.isArray(input)) return [];
  const out: ResumeExperience[] = [];

  input.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const job = entry as ResumeExperience;
    const record: ResumeExperience = {
      title: tidy(job.title),
      company: tidy(job.company),
      location: tidy(job.location),
      dates: tidy(job.dates),
      bullets: tidyList(job.bullets),
    };
    // Preserve every parser-owned row. Only a completely empty object is removed.
    // Exact-looking duplicates may still represent promotions, concurrent roles,
    // repeated contracts, or parser evidence from separate layout regions.
    if (!record.title && !record.company && !record.dates && record.bullets.length === 0) return;
    out.push(record);
  });
  return out;
}

/* ==========================================================================
 * 3. Education — same rules
 * ======================================================================== */

function educationKey(entry: ResumeEducation, ordinal: number): string {
  const { start, end } = splitDateRange(entry.dates);
  const unreadable = !start && !end && Boolean(tidy(entry.dates));
  return [
    exactKey(entry.institution),
    exactKey(entry.degree),
    start,
    end,
    unreadable ? `#${ordinal}` : "",
  ].join("\u0000");
}

/** Merge ONLY if Institution AND Degree AND Start AND End all match. */
export function canonicalizeEducation(input: unknown): ResumeEducation[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: ResumeEducation[] = [];

  input.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const item = entry as ResumeEducation;
    const record: ResumeEducation = {
      degree: tidy(item.degree),
      institution: tidy(item.institution),
      location: tidy(item.location),
      dates: tidy(item.dates),
    };
    if (!record.degree && !record.institution && !record.dates) return;

    const key = educationKey(record, index);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(record);
  });
  return out;
}

/* ==========================================================================
 * 4. Projects — never inferred, never fuzzy-merged, never folded into experience
 * ======================================================================== */

export function canonicalizeProjects(input: unknown): ResumeProject[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: ResumeProject[] = [];

  input.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const item = entry as ResumeProject;
    const record: ResumeProject = { name: tidy(item.name), bullets: tidyList(item.bullets) };
    if (!record.name && record.bullets.length === 0) return;

    // Exact identity only: same name AND same bullets. Never title similarity.
    const key =
      `${exactKey(record.name)}\u0000${record.bullets.map(exactKey).join("\u0001")}` +
      (record.name ? "" : `#${index}`);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(record);
  });
  return out;
}

/* ==========================================================================
 * 5. Languages — canonical "Name (Level)"
 * --------------------------------------------------------------------------
 * Production logs showed BOTH failure directions:
 *   - duplicates surviving: ["English - FLUENT", "English (Fluent)"]
 *   - languages silently DROPPED: 3 -> 1
 * The fix is structural: parse <name><separator><level>, key on the language
 * NAME ONLY, keep first-seen order, and never drop a name.
 * ======================================================================== */

const CEFR_RE = /^[abc][12]$/i;

/**
 * Proficiency words, multilingual and closed. Used ONLY to detect where a
 * language name ends and its level begins when no separator was written
 * ("Türkçe Fluent"). Never used to rank, translate or invent a level.
 */
const LEVEL_TOKENS = new Set([
  "native", "fluent", "advanced", "intermediate", "basic", "beginner",
  "conversational", "proficient", "proficiency", "working", "professional",
  "elementary", "limited", "bilingual", "mother", "tongue",
  "muttersprache", "fliessend", "fliesend", "verhandlungssicher", "grundkenntnisse",
  "konversationsniveau", "gut", "sehr",
  "courant", "maternelle", "natif", "bilingue", "intermediaire", "notions",
  "nativo", "fluido", "avanzado", "basico", "materno",
  "madrelingua", "fluente", "scolastico",
  "nativa", "avancado", "intermediario",
]);

/** Endonym -> English exonym. A closed, global vocabulary — not per-CV. */
const LANGUAGE_ENDONYMS: Record<string, string> = {
  deutsch: "German", germany: "German", englisch: "English", franzosisch: "French", spanisch: "Spanish",
  italienisch: "Italian", russisch: "Russian", turkisch: "Turkish", tamilisch: "Tamil",
  francais: "French", anglais: "English", allemand: "German", espagnol: "Spanish",
  espanol: "Spanish", ingles: "English", aleman: "German", frances: "French",
  italiano: "Italian", inglese: "English", tedesco: "German", francese: "French",
  portugues: "Portuguese", nederlands: "Dutch", svenska: "Swedish", turkce: "Turkish",
};

export function canonicalLanguageName(name: string): string {
  const key = deaccent(name.toLowerCase()).replace(/[^a-z]/g, "");
  const exonym = LANGUAGE_ENDONYMS[key];
  if (exonym) return exonym;
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

/** "English - Fluent" | "English: Fluent" | "English (fluent)" | "English C1" */
export function splitLanguageEntry(value: string): { name: string; level: string } {
  const text = tidy(value);
  if (!text) return { name: "", level: "" };

  // Capture the first complete parenthesized level and deliberately discard
  // trailing sidebar bleed (names, companies, phone/email text, achievements).
  const bracket = text.match(/^(.+?)\s*[([{]\s*([^)\]}]+?)\s*[)\]}](?:\s+.*)?$/);
  if (bracket) return { name: tidy(bracket[1]), level: tidy(bracket[2]) };

  const delimited = text.match(/^(.+?)\s*[:\u2010-\u2015-]\s*(.+)$/);
  if (delimited) return { name: tidy(delimited[1]), level: tidy(delimited[2]) };

  // Trailing bare CEFR code: "English C1"
  const cefr = text.match(/^(.+?)\s+([abc][12])$/i);
  if (cefr) return { name: tidy(cefr[1]), level: tidy(cefr[2]) };

  // Trailing proficiency word with no separator: "Türkçe Fluent", "Deutsch
  // Muttersprache". Without this the level fuses into the language NAME and the
  // entry gets its own identity, so "Türkçe Fluent" and "Türkçe (A2)" survive as
  // two different languages — silently losing the merge. LEVEL_TOKENS is a
  // closed multilingual vocabulary of proficiency words, not a per-CV rule.
  const words = text.split(/\s+/);
  if (words.length >= 2) {
    let cut = words.length;
    while (cut > 1 && LEVEL_TOKENS.has(deaccent(words[cut - 1].toLowerCase()))) cut -= 1;
    if (cut < words.length) {
      return { name: tidy(words.slice(0, cut).join(" ")), level: tidy(words.slice(cut).join(" ")) };
    }
  }

  return { name: text, level: "" };
}

function formatLevel(level: string): string {
  if (!level) return "";
  const raw = tidy(level);
  const LEVEL_ALIASES: Record<string, string> = {
    fliessend: "Fluent", fließend: "Fluent", fluent: "Fluent",
    muttersprache: "Native", native: "Native",
    konversationsniveau: "Conversational", conversational: "Conversational",
    grundkenntnisse: "Basic", basic: "Basic",
    fortgeschritten: "Advanced", proficient: "Proficient",
    intermediate: "Intermediate", professional: "Professional",
  };
  const aliasKey = raw.toLocaleLowerCase().replace(/[^\p{L}]/gu, "");
  const cleaned = LEVEL_ALIASES[aliasKey] || raw;
  // CEFR only defines A1-A2, B1-B2 and C1-C2. Preserve unsupported source
  // values transparently instead of presenting them as valid CEFR levels.
  if (/\b[abc][3-9]\b/i.test(cleaned)) return `Unverified: ${cleaned}`;
  // Title-case words, but keep CEFR codes upper-case wherever they appear
  // ("Fluent C1" must not become "Fluent c1").
  return cleaned
    .split(/\s+/)
    .map((word) =>
      CEFR_RE.test(word)
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join(" ");
}

/**
 * A single string may legitimately be ONE language with a level
 * ("English - Fluent") or a parser artifact packing SEVERAL
 * ("English (Fluent) - German (Intermediate) - Spanish (Native)").
 *
 * Splitting on " - " unconditionally destroys the first form, so we require
 * positive evidence of packing:
 *   - hard separators (, ; /) which cannot occur inside a language name, or
 *   - two or more dash-separated chunks that EACH carry a bracketed level.
 * Otherwise the entry is one language and is returned untouched.
 */
export function splitPackedLanguages(entry: string): string[] {
  const hard = entry.split(/\s*[,;/]\s*/).map(tidy).filter(Boolean);
  if (hard.length > 1) return hard;

  const dashed = entry.split(/\s+[-\u2013\u2014]\s+/).map(tidy).filter(Boolean);
  const allBracketed = dashed.length > 1 && dashed.every((chunk) => /\([^)]+\)\s*$/.test(chunk));
  if (allBracketed) return dashed;

  return [entry];
}

/**
 * Canonical: "English (Fluent)", "German (B2)", "Tamil (Native)".
 * All variants of the same language name merge into ONE. First level wins.
 * A language name is NEVER dropped.
 */
export function isLanguageNameShaped(name: string): boolean {
  const text = tidy(name);
  if (!text || text.length > 40) return false;
  if (EMAIL_RE_LOCAL.test(text) || PHONE_RE_LOCAL.test(text) || /(?:www\.|https?:|@)/i.test(text)) return false;
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length < 1 || tokens.length > 3) return false;
  if (!tokens.every((token) => /^[\p{L}.'’()-]+$/u.test(token))) return false;
  if (/\b(?:inc|ltd|llc|gmbh|corp|company|ceo|cto|manager|engineer|analyst|phone|email|built|improved|supporting)\b/i.test(text)) return false;
  return true;
}

const EMAIL_RE_LOCAL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE_LOCAL = /\+?\d[\d\s()./-]{6,}/;

export function canonicalizeLanguages(input: unknown): string[] {
  const order: string[] = [];
  const levels = new Map<string, string>();

  for (const entry of tidyList(input)) {
    const candidates = splitPackedLanguages(entry);

    for (const candidate of candidates) {
      const { name, level } = splitLanguageEntry(candidate);
      if (!name || !isLanguageNameShaped(name)) continue;
      const canonical = canonicalLanguageName(name);
      const key = canonical.toLowerCase();
      if (!levels.has(key)) {
        order.push(canonical);
        levels.set(key, level);
      } else if (!levels.get(key) && level) {
        levels.set(key, level);
      }
    }
  }

  return order.map((name) => {
    const level = formatLevel(levels.get(name.toLowerCase()) || "");
    return level ? `${name} (${level})` : name;
  });
}

/* ==========================================================================
 * 6. Skills — explicit section / verified parser output only
 * ======================================================================== */

/** SHAPE rules only, never a vocabulary of known skills. */
function isSkillShaped(value: string): boolean {
  if (!value) return false;
  if (value.length > 60) return false;
  if (/[.!?]$/.test(value)) return false;
  if (value.split(/\s+/).length > 6) return false;
  return true;
}

export function canonicalizeSkills(
  input: unknown,
  reject: { projectNames: string[]; sectionNames: string[] },
): string[] {
  const rejectKeys = new Set<string>();
  for (const name of [...reject.projectNames, ...reject.sectionNames]) {
    const key = exactKey(name);
    if (key) rejectKeys.add(key);
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tidyList(input)) {
    if (!isSkillShaped(raw)) continue;
    const key = exactKey(raw);
    if (!key || rejectKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
  }
  return out;
}

/* ==========================================================================
 * 7. Headline — strict priority ladder
 * --------------------------------------------------------------------------
 * Production logs showed the headline becoming, variously: a skill
 * ("Project Management"), a summary fragment, an address + summary, a person's
 * name, and a truncated fragment ("Manager"). Every rejection below is a SHAPE
 * or SELF-REFERENCE rule — none names a specific CV.
 * ======================================================================== */

export type HeadlineSource =
  | "header_below_name" | "explicit_title" | "linkedin_headline" | "parser" | "blank";

/**
 * Filler words that join section headings ("SUMMARY OF SKILLS", "BILDUNG UND
 * ERFAHRUNG"). Closed, multilingual, and not CV-specific.
 */
const SECTION_JOINERS = new Set(["of", "and", "the", "my", "und", "der", "die", "das", "et", "de", "y", "e"]);

/**
 * True when a line is nothing but section vocabulary, e.g. "SUMMARY OF SKILLS",
 * "PROFILE SUMMARY", "KONTAKT". Letter-spaced headers collapse to a single blob
 * ("summaryofskills"), so we test BOTH the token decomposition and the blob
 * against the section vocabulary. Structural: it never names a CV.
 */
export function isSectionComposite(value: string): boolean {
  const blob = letterBlob(value);
  if (!blob) return false;

  const sectionBlobs = SECTION_NAMES.map(letterBlob).filter((b) => b.length >= 4);
  if (sectionBlobs.includes(blob)) return true;

  // Token form: every word is a section word or a joiner.
  const tokens = deaccent(tidy(value).toLowerCase()).split(/[^a-z0-9]+/).filter(Boolean);
  if (tokens.length > 0 && tokens.length <= 5) {
    const sectionWords = new Set<string>();
    for (const name of SECTION_NAMES) {
      for (const word of deaccent(name.toLowerCase()).split(/\s+/)) sectionWords.add(word);
    }
    const allSection = tokens.every((t) => sectionWords.has(t) || SECTION_JOINERS.has(t));
    if (allSection) return true;
  }

  // Letter-spaced/concatenated form: the blob is a run of section words only.
  let rest = blob;
  let consumed = 0;
  let guard = 0;
  while (rest.length > 0 && guard++ < 8) {
    const hit = sectionBlobs
      .filter((b) => rest.startsWith(b))
      .sort((a, b) => b.length - a.length)[0];
    const joiner = hit ? "" : [...SECTION_JOINERS].filter((j) => rest.startsWith(j)).sort((a, b) => b.length - a.length)[0];
    const take = hit || joiner;
    if (!take) break;
    if (hit) consumed += 1;
    rest = rest.slice(take.length);
  }
  return rest.length === 0 && consumed >= 2;
}

/** Address-shaped: postal codes, street tokens, house numbers. Global. */
const ADDRESS_RE =
  /(?:\b\d{1,6}\s+[\p{L}][\p{L}.'’-]*\s+(?:st(?:reet)?|str(?:asse|aße)?|road|rd|avenue|ave|lane|ln|weg|allee|platz)\b)|(?:\b(?:st(?:reet)?|str(?:asse|aße)?|road|rd|avenue|ave|lane|ln|weg|allee|platz|postal|zip)\b)|(?:\banywhere\s+st\b)|(?:\b\d{4,6}\b)/iu;
const CONTACT_RE = /@|https?:|www\.|linkedin|github|\+\d/i;

const ROLE_CUE_RE = /\b(?:manager|management|engineer|engineering|developer|designer|illustrator|analyst|scientist|consultant|specialist|administrator|coordinator|director|lead|assistant|support|marketing|sales|product|project|data|software|teacher|accountant|technician|executive|architect|recruiter|researcher|nurse|doctor|officer|advisor|controller|operator|mechanic|electrician|chef|writer|editor|photographer|student|intern|development|agent|commercial|ingenieur|spezialist|entwickler|berater|leiter|managerin|lehrer|buchhalter|techniker|responsable|ingenieur|developpeur|consultant|analyste|directeur|professeur|gerente|ingeniero|desarrollador|analista|consultor|especialista|director|profesor)\b/i;


const HEADLINE_SEGMENT_WORDS = [
  "it", "customer", "success", "technical", "support", "service", "desk", "information", "technology",
  "senior", "junior", "principal", "lead", "chief", "head", "assistant", "associate", "professional",
  "project", "product", "program", "marketing", "sales", "account", "business", "data", "software",
  "cybersecurity", "security", "cloud", "network", "systems", "system", "graphic", "visual", "ux", "ui",
  "human", "resources", "public", "relations", "customer", "finance", "financial", "operations",
  "manager", "managerin", "management", "engineer", "ingenieur", "developer", "designer", "illustrator",
  "analyst", "scientist", "consultant", "specialist", "spezialist", "administrator", "coordinator",
  "director", "strategist", "representative", "accountant", "teacher", "technician", "executive",
  "architect", "recruiter", "researcher", "writer", "editor", "advisor", "officer", "controller",
].sort((a, b) => b.length - a.length);

/**
 * Reconstruct a letter-spaced occupational title without using CV-specific
 * values. Dynamic programming uses a closed, global role vocabulary and only
 * succeeds when the entire compact string can be explained.
 */
function segmentDecorativeRole(value: string): string {
  const raw = tidy(value);
  const compact = deaccent(raw.toLowerCase()).replace(/[^a-z0-9/&+]/g, "");
  if (!compact) return "";

  const separators = new Set(["/", "&", "+"]);
  const memo = new Map<number, string[] | null>();
  const walk = (index: number): string[] | null => {
    if (index === compact.length) return [];
    if (memo.has(index)) return memo.get(index)!;
    const ch = compact[index];
    if (separators.has(ch)) {
      const tail = walk(index + 1);
      const result = tail ? [ch, ...tail] : null;
      memo.set(index, result);
      return result;
    }
    for (const word of HEADLINE_SEGMENT_WORDS) {
      if (!compact.startsWith(word, index)) continue;
      const tail = walk(index + word.length);
      if (tail) {
        const result = [word, ...tail];
        memo.set(index, result);
        return result;
      }
    }
    memo.set(index, null);
    return null;
  };

  const parts = walk(0);
  if (!parts || !parts.some((part) => ROLE_CUE_RE.test(part))) return "";
  return parts
    .map((part) => separators.has(part) ? part : part.toUpperCase() === part && part.length <= 3 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .replace(/\s+([/&+])\s+/g, " $1 ")
    .replace(/\bIt\b/g, "IT")
    .replace(/\bUx\b/g, "UX")
    .replace(/\bUi\b/g, "UI");
}

function normalizeDecorativeHeadline(value: string, parserHeadline = ""): string {
  let text = tidy(value);
  if (!text) return "";

  // Resume templates sometimes append a publication/template year to the
  // professional title (for example, "Graphic Designer 2026"). Remove only a
  // trailing standalone year, and only when the remaining text is independently
  // role-shaped. Dates inside a title or elsewhere remain untouched.
  const withoutTrailingYear = text.replace(/\s+(?:19|20)\d{2}$/, "").trim();
  if (withoutTrailingYear !== text && ROLE_CUE_RE.test(withoutTrailingYear)) {
    text = withoutTrailingYear;
  }
  const tokens = text.split(/\s+/).filter(Boolean);
  const singleRatio = tokens.length ? tokens.filter((token) => /^\p{L}$/u.test(token)).length / tokens.length : 0;
  if (tokens.length < 4 || singleRatio < 0.7) return text;

  const compact = text.replace(/\s+/g, "");
  const parser = tidy(parserHeadline);
  if (parser && letterBlob(parser) === letterBlob(compact)) return parser;

  const reconstructed = segmentDecorativeRole(text);
  if (reconstructed) return reconstructed;

  // Do not publish unreadable concatenations. Keeping the original spaced text
  // lets the shape validator reject it and allows a trustworthy parser title
  // to win instead.
  return text.replace(/\s*([/|&+])\s*/g, " $1 ").trim();
}

/**
 * Acronyms that must stay upper-case when an ALL-CAPS header is re-cased.
 * Closed, global, occupation-vocabulary only — no CV, person, or sample values.
 */
const HEADLINE_ACRONYMS = new Set([
  "it", "hr", "pr", "qa", "qc", "ux", "ui", "seo", "sem", "smm", "crm", "erp", "sap", "ai", "ml",
  "bi", "api", "sql", "aws", "gcp", "php", "css", "html", "js", "ts", "cad", "cnc", "hvac", "cpa",
  "cfa", "pmp", "mba", "bsc", "msc", "ceo", "cto", "cfo", "coo", "cio", "cmo", "vp", "pmo", "ats",
  "sre", "dba", "ios", "rn", "lpn", "emt", "kyc", "aml", "esg", "ppc", "cro", "b2b", "b2c", "saas",
  "devops", "qhse", "gis", "sre", "ecm", "cms", "3d", "2d", "iso", "gmp", "nlp", "iot", "vr", "ar",
]);

/** Words that stay lower-case inside a re-cased title, multilingual and closed. */
const HEADLINE_MINOR_WORDS = new Set([
  "and", "or", "of", "the", "for", "in", "at", "to", "a", "an", "with",
  "und", "der", "die", "das", "für", "im",
  "de", "du", "des", "la", "le", "les", "et", "en", "y", "con", "di", "da", "dos", "e", "van", "von",
]);

/**
 * Re-case an ALL-CAPS headline into a readable professional title.
 *
 * Resume templates typeset the header in capitals ("GRAPHIC DESIGNER"); that is
 * a typographic choice of the template, not how a person writes their own
 * title, and shipping it verbatim puts shouting text into every downstream
 * feature (cover letters, LinkedIn copy, recruiter personas).
 *
 * Deliberately conservative and global:
 * - a headline that already contains ANY lower-case letter is returned
 *   untouched, so authored casing (e.g. "iOS Developer") is never destroyed;
 * - acronyms and tokens carrying digits keep their upper-case form;
 * - no CV-specific, filename-specific, or person-specific branch exists.
 */
export function normalizeHeadlineCasing(value: string): string {
  const text = tidy(value);
  if (!text) return "";
  if (/\p{Ll}/u.test(text)) return text;

  const recasePiece = (piece: string, isFirst: boolean): string => {
    if (!/\p{L}/u.test(piece)) return piece;
    const bare = deaccent(piece.toLowerCase()).replace(/[^a-z0-9]/g, "");
    if (!bare) return piece;
    if (HEADLINE_ACRONYMS.has(bare)) return piece.toLocaleUpperCase();
    if (/\d/.test(bare)) return piece.toLocaleUpperCase();
    if (!isFirst && HEADLINE_MINOR_WORDS.has(bare)) return piece.toLocaleLowerCase();
    return piece.charAt(0).toLocaleUpperCase() + piece.slice(1).toLocaleLowerCase();
  };

  return text
    .split(/\s+/)
    .map((token, index) =>
      token
        .split(/([-/&+.'’])/)
        .map((piece, pieceIndex) =>
          /^[-/&+.'’]$/.test(piece) ? piece : recasePiece(piece, index === 0 && pieceIndex === 0),
        )
        .join(""),
    )
    .join(" ");
}

function looksLikeLocationOrAddress(value: string): boolean {
  const text = tidy(value);
  if (!text) return false;
  if (ADDRESS_RE.test(text) || CONTACT_RE.test(text)) return true;
  // City/country lines are commonly two comma-separated proper-name chunks.
  if (/^[\p{L}.'’ -]{2,40},\s*[\p{L}.'’ -]{2,40}$/u.test(text) && !ROLE_CUE_RE.test(text)) return true;
  return false;
}

function looksLikeProse(value: string): boolean {
  const text = tidy(value);
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 10) return true;
  if (words.length >= 6 && /^(?:i|i'm|i am|a|an|the|results[- ]driven|experienced|passionate|motivated|professional|creative|detail[- ]oriented|ex[- ])\b/i.test(text)) return true;
  if (words.length >= 7 && /\b(?:with|who|seeking|delivering|experience|proven|skilled|known|record)\b/i.test(text)) return true;
  return false;
}

function isHeadlineShaped(value: string, forbidden: Set<string>): boolean {
  if (!value) return false;
  if (value.length > 90) return false;
  if (value.split(/\s+/).length > 10) return false;
  if (/[.!?]$/.test(value)) return false;
  if (looksLikeLocationOrAddress(value)) return false;
  if (looksLikeProse(value)) return false;
  if (isSectionComposite(value)) return false;
  if (forbidden.has(exactKey(value))) return false;

  const words = value.split(/\s+/).filter(Boolean);
  const titleLike = words.length >= 2 && words.length <= 5 && words.every((word) => /^[\p{Lu}][\p{L}'’.-]*$/u.test(word));
  if (titleLike && !ROLE_CUE_RE.test(value)) return false;
  return ROLE_CUE_RE.test(value);
}

/**
 * Priority: 1 header below name, 2 explicit professional title, 3 LinkedIn,
 * 4 parser headline, 5 blank. Never summary/skills/projects/section titles.
 *
 * IMPORTANT — what "explicit professional title" is NOT.
 *
 * This slot previously received `experience[0].title`, the most recent JOB.
 * That is a different fact from the professional headline and it outranked the
 * parser, so a CV whose header clearly read "DATA SCIENTIST / ANALYST" was
 * relabelled "Technical Support Engineer" (their previous job). A candidate's
 * headline is what they claim to BE; their latest job title is where they last
 * worked. For career changers — the exact users this product serves — those two
 * are deliberately different, and overwriting the first with the second inverts
 * the whole product.
 *
 * `explicitTitle` is now only for a title a caller has independently verified
 * as coming from the HEADER region. The parser's basics.headline already IS the
 * header-extracted title, so in practice the ladder resolves
 * header_below_name -> parser -> linkedin -> blank.
 */
export function resolveHeadline(input: {
  headerBelowName?: string;
  explicitTitle?: string;
  linkedinHeadline?: string;
  parserHeadline?: string;
  summary?: string;
  forbidden: Set<string>;
}): { headline: string; source: HeadlineSource } {
  const summaryBlob = letterBlob(input.summary);
  const parser = tidy(input.parserHeadline);

  const candidates: Array<{ value: string; source: HeadlineSource; score: number }> = [];
  const add = (raw: string | undefined, source: HeadlineSource, base: number) => {
    const value = normalizeHeadlineCasing(normalizeDecorativeHeadline(tidy(raw), parser));
    if (!isHeadlineShaped(value, input.forbidden)) return;
    const blob = letterBlob(value);
    if (source !== "parser" && blob.length >= 12 && summaryBlob && summaryBlob.startsWith(blob)) return;
    let score = base;
    if (ROLE_CUE_RE.test(value)) score += 20;
    if (source !== "parser" && parser && letterBlob(parser) === blob) score += 25;
    if (source === "parser" && parser) score += 5;
    candidates.push({ value, source, score });
  };

  add(input.headerBelowName, "header_below_name", 80);
  add(input.explicitTitle, "explicit_title", 75);
  add(input.linkedinHeadline, "linkedin_headline", 70);
  add(input.parserHeadline, "parser", 65);

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  return best ? { headline: best.value, source: best.source } : { headline: "", source: "blank" };
}

/**
 * Read the line directly below the resolved name. Purely positional and
 * read-only on rawText — no vocabulary, no filename.
 *
 * Handles letter-spaced headers ("J U N I O R  M A N A G E R") by comparing
 * letter blobs rather than literal text.
 */

export function readFirstSafeHeaderTitle(rawText: string, parserHeadline = ""): string {
  const lines = String(rawText || "").split(/\r?\n/).map((line) => tidy(line)).filter(Boolean);
  for (const line of lines.slice(0, 12)) {
    if (isSectionComposite(line) || looksLikeLocationOrAddress(line)) continue;
    // Normalize decorative letter-spacing before prose-shape checks. The raw
    // glyph stream has one token per letter and would otherwise look like a
    // long sentence.
    const normalized = normalizeDecorativeHeadline(line, parserHeadline);
    if (!normalized || !ROLE_CUE_RE.test(normalized)) continue;
    if (isSectionComposite(normalized) || looksLikeLocationOrAddress(normalized) || looksLikeProse(normalized)) continue;
    return normalized;
  }
  return "";
}

export function readHeaderBelowName(rawText: string, name: string): string {
  const target = letterBlob(name);
  if (!target) return "";
  const lines = String(rawText || "").split(/\r?\n/).map((line) => tidy(line));
  const isNoise = (line: string) => !line || ADDRESS_RE.test(line) || CONTACT_RE.test(line) || isSectionComposite(line);

  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i]) continue;
    const one = letterBlob(lines[i]);
    const two = i + 1 < lines.length ? one + letterBlob(lines[i + 1]) : one;

    let nameEnd = -1;
    if (one === target || one.startsWith(target)) nameEnd = i;
    else if (two === target || two.startsWith(target)) nameEnd = i + 1;
    if (nameEnd < 0) continue;

    // If a flattened line contains name + headline, return the remainder.
    if (one.startsWith(target) && one.length > target.length) {
      const raw = lines[i];
      const nameWords = name.split(/\s+/).length;
      const remainder = tidy(raw.split(/\s+/).slice(nameWords).join(" "));
      if (remainder && !isNoise(remainder)) return remainder;
    }

    for (let j = nameEnd + 1; j < Math.min(nameEnd + 5, lines.length); j += 1) {
      if (!isNoise(lines[j])) return lines[j];
    }
    return "";
  }
  return "";
}

/* ==========================================================================
 * 8. The Canonical Builder
 * ======================================================================== */

/** Section vocabulary — multilingual, closed, and NOT CV-specific. */
export const SECTION_NAMES = [
  "summary", "profile", "profile summary", "profile overview", "objective",
  "about", "about me", "overview", "experience", "work experience",
  "professional experience", "employment", "education", "skills", "expertise",
  "competencies", "projects", "languages", "certifications", "references",
  "contact", "contacts", "awards", "interests",
  "kontakt", "profil", "profilubersicht", "zusammenfassung", "kenntnisse",
  "fahigkeiten", "bildung", "ausbildung", "berufserfahrung", "sprachen",
];

/**
 * True when a candidate name was assembled from the document's own skills or
 * section headings rather than from a person. Self-referential: it compares the
 * name against THIS profile's skills, so it needs no name list, no technology
 * list, and no per-CV rule. lib/workzoCvValidator.ts asserts the same property
 * on the finished profile.
 */
export function isContaminatedName(
  name: unknown,
  evidence: {
    skills?: string[];
    languages?: string[];
    projectNames?: string[];
    companies?: string[];
    institutions?: string[];
    degrees?: string[];
  },
): boolean {
  const text = tidy(name);
  if (!text) return false;
  if (isSectionComposite(text)) return true;

  const compact = letterBlob(text);
  const unicodeCompact = deaccent(text.toLowerCase()).replace(/[^\p{L}\p{N}]/gu, "");
  // Generic structural labels which frequently appear as sidebar headings.
  if (/^(?:(?:key|core|main|technical|professional|design))?(?:tools?|technologies|platforms?|frameworks?|proficiencies|languages?|skills?|projects?|certifications?)$/i.test(compact)) return true;

  const values = [
    ...(evidence.skills || []),
    ...(evidence.languages || []),
    ...(evidence.projectNames || []),
    ...(evidence.companies || []),
    ...(evidence.institutions || []),
    ...(evidence.degrees || []),
  ].map(tidy).filter(Boolean);

  const exact = new Set(values.map(exactKey));
  if (exact.has(exactKey(text))) return true;
  const evidenceTokens = new Set<string>();
  for (const value of values) {
    for (const token of deaccent(value.toLowerCase()).split(/[^\p{L}\p{N}]+/u).filter(Boolean)) {
      if (token.length >= 2) evidenceTokens.add(token);
    }
  }
  const candidateTokens = deaccent(text.toLowerCase()).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (candidateTokens.length > 0 && candidateTokens.every((token) => evidenceTokens.has(token))) return true;


  // Compare Unicode-aware compact forms so non-Latin skills cannot be
  // assembled into a fake name either. A candidate made entirely from one or
  // more profile values is contamination; ordinary names only sharing a short
  // substring are not.
  if (unicodeCompact.length >= 2) {
    for (const value of values) {
      const blob = deaccent(value.toLowerCase()).replace(/[^\p{L}\p{N}]/gu, "");
      if (blob.length >= 2 && (unicodeCompact === blob || unicodeCompact === blob + blob)) return true;
    }
  }

  if (compact.length >= 4) {
    for (const value of values) {
      const blob = letterBlob(value);
      if (blob.length >= 4 && (compact === blob || compact === blob + blob)) return true;
    }
  }

  return false;
}

/** Evidence drawn from the profile's own facts. No external vocabulary. */
export type IdentityEvidence = {
  headline?: string;
  skills?: string[];
  languages?: string[];
  projectNames?: string[];
  companies?: string[];
  institutions?: string[];
  degrees?: string[];
};

/**
 * A name that is plausibly a person, judged on shape alone.
 * Structural only: 1–4 tokens, letters and name punctuation, no digits.
 */
function isPersonNameShaped(value: string): boolean {
  const text = tidy(value);
  if (!text || text.length > 60) return false;
  if (/[@\d]|https?:|www\./i.test(text)) return false;
  if (/[.!?]$/.test(text)) return false;
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length < 1 || tokens.length > 4) return false;
  return tokens.every((token) => /^[\p{L}][\p{L}'’.-]*$/u.test(token));
}

/**
 * Every identity rule the canonical profile must satisfy, in ONE place.
 *
 * These mirror the assertions in lib/workzoCvValidator.ts. The validator stays
 * an independent observer — it deliberately does not import this — so that it
 * can still catch a bug in this builder rather than agreeing with it by
 * construction.
 */
export function findIdentityViolations(name: unknown, evidence: IdentityEvidence): string[] {
  const text = tidy(name);
  if (!text) return []; // blank + needsConfirmation is a legal, honest outcome.
  const out: string[] = [];
  const nameKey = exactKey(text);

  if (SECTION_NAMES.some((section) => exactKey(section) === nameKey)) out.push("name_is_section_name");
  if (/@|https?:|www\.|linkedin|\+\d|\b\d{4,}\b/i.test(text)) out.push("name_contains_contact");
  if (text.split(/\s+/).length > 6 || /[.!?]$/.test(text)) out.push("name_is_prose");
  if (looksLikeLocationOrAddress(text)) out.push("name_is_location");

  // The header bled into the name: "Emaawarner Accounting" under the headline
  // "Accounting Executive".
  const headlineBlob = letterBlob(evidence.headline);
  if (headlineBlob.length >= 4) {
    for (const token of text.split(/\s+/)) {
      const tokenBlob = letterBlob(token);
      if (tokenBlob.length >= 4 && headlineBlob.startsWith(tokenBlob)) {
        out.push("name_contaminated_by_headline");
        break;
      }
    }
  }

  if (
    isContaminatedName(text, {
      skills: evidence.skills,
      languages: evidence.languages,
      projectNames: evidence.projectNames,
      companies: evidence.companies,
      institutions: evidence.institutions,
      degrees: evidence.degrees,
    })
  ) {
    out.push("name_is_profile_evidence");
  }

  return [...new Set(out)];
}

/**
 * Brief §8 repair: drop the headline text that bled into the name and re-score
 * what is left.
 *
 * Only a token that is itself ROLE-shaped is removed, so a person whose surname
 * legitimately coincides with a word in their title keeps their name. The
 * remainder is accepted only if it is independently plausible AND violates
 * nothing on its own; otherwise the caller blanks the name and asks.
 */
/**
 * Occupational DOMAIN nouns ("Accounting" beside "Accountant", "Design" beside
 * "Designer"). ROLE_CUE_RE already carries the agent-noun forms and some domain
 * forms (management, engineering, development); this completes that same
 * pattern for the repair step only.
 *
 * Scoped deliberately: ROLE_CUE_RE also decides what may BE a headline, and
 * these nouns are frequently skills ("Web Design"), so widening it there would
 * let a skill become a job title. Used only to decide whether a token that
 * already overlaps the headline is occupational vocabulary.
 */
const OCCUPATIONAL_DOMAIN_RE =
  /\b(?:accounting|design|consulting|recruiting|recruitment|nursing|teaching|writing|editing|architecture|administration|analytics|analysis|operations|finance|logistics|procurement|hospitality|communications|relations|strategy|research|security|compliance|buchhaltung|gestaltung|beratung|vertrieb|einkauf|comptabilite|conception|contabilidad|diseno)\b/i;

function isOccupationalToken(token: string): boolean {
  return ROLE_CUE_RE.test(token) || OCCUPATIONAL_DOMAIN_RE.test(deaccent(token));
}

function repairNameContaminatedByHeadline(name: string, evidence: IdentityEvidence): string {
  const headline = tidy(evidence.headline);
  const headlineBlob = letterBlob(headline);
  if (!headlineBlob) return "";

  const headlineTokens = new Set(headline.split(/\s+/).map((token) => letterBlob(token)).filter(Boolean));
  const kept = name.split(/\s+/).filter((token) => {
    const blob = letterBlob(token);
    if (blob.length < 4) return true;
    const overlaps = headlineTokens.has(blob) || headlineBlob.startsWith(blob);
    if (!overlaps) return true;
    // Remove it only when the overlapping token is occupational vocabulary, so
    // a person whose surname coincides with a word in their own title keeps it.
    return !isOccupationalToken(token);
  });

  const repaired = tidy(kept.join(" "));
  if (!repaired || repaired === tidy(name)) return "";
  if (!isPersonNameShaped(repaired)) return "";
  if (findIdentityViolations(repaired, evidence).length) return "";
  return repaired;
}

export type CanonicalBuildInput = {
  /** Parser output. TREATED AS READ-ONLY. Never mutated. */
  parsed: ResumeProfile;
  rawText: string;
  /** Unsanitized extraction used only for header/identity evidence. */
  identityText?: string;
  /** User-confirmed/onboarding name used as corroborating evidence, never blindly trusted. */
  candidateName?: string;
  fileName?: string;
  linkedinHeadline?: string;
  /** ONLY a title independently verified as coming from the header region. */
  explicitTitle?: string;
};

export type CanonicalBuildResult = {
  profile: Readonly<ResumeProfile>;
  report: {
    nameSource: string;
    nameConfidence: number;
    needsConfirmation: boolean;
    rejectedNames: string[];
    headlineSource: HeadlineSource;
    counts: Record<string, { parsed: number; canonical: number }>;
  };
};

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.getOwnPropertyNames(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

/**
 * Build the one and only canonical ResumeProfile.
 * PURE: `input.parsed` is never mutated. FINAL: the result is deep-frozen.
 */
export function buildCanonicalResumeProfile(
  input: CanonicalBuildInput,
): CanonicalBuildResult {
  const parsed = input.parsed || ({} as ResumeProfile);
  const rawText = String(input.rawText || "");
  const identityText = String(input.identityText || input.rawText || "");
  const basics = parsed.basics || ({} as ResumeProfile["basics"]);

  /* --- Factual sections: parser is authoritative. ---------------------- */
  const experience = canonicalizeExperience(parsed.experience);
  const education = canonicalizeEducation(parsed.education);
  const projects = canonicalizeProjects(parsed.projects);
  const languages = canonicalizeLanguages(parsed.languages);

  const skills = canonicalizeSkills(parsed.skills, {
    projectNames: projects.map((p) => p.name),
    sectionNames: SECTION_NAMES,
  });

  /* --- Name: resolved exactly once, here. ------------------------------
   * Resolved AFTER skills, because a contaminated parser name can only be
   * detected by comparing it against the profile's OWN skills. Production shipped
   * "Tools Ticketing-systeme" and "Tableau Api" as candidate names: the extractor
   * assembles them from the skills sidebar on two-column layouts, so no token
   * vocabulary would catch them — only self-comparison does.
   *
   * A contaminated name is SUPPRESSED, not repaired. We hand the name stage an
   * empty parser name so it falls back to layout evidence, and if that fails the
   * profile honestly reports needsConfirmation. Guessing a human's name is worse
   * than asking.
   */
  const rawParserName = basics.name || (parsed as unknown as { name?: string }).name || "";
  const parserName = isContaminatedName(rawParserName, {
    skills,
    languages,
    projectNames: projects.map((p) => p.name),
    companies: experience.map((e) => e.company),
    institutions: education.map((e) => e.institution),
    degrees: education.map((e) => e.degree),
  }) ? "" : rawParserName;

  const nameStage = resolveAuthoritativeCvName({
    rawText: identityText,
    parserName,
    currentName: input.candidateName || "",
    fileName: input.fileName || "",
    email: basics.email || "",
  });
  const stagedName = tidy(nameStage.name);
  const nameIsLocation = looksLikeLocationOrAddress(stagedName);
  const name = nameIsLocation ? "" : stagedName;
  if (nameIsLocation) {
    nameStage.name = "";
    nameStage.source = "needs_confirmation";
    nameStage.confidence = 0;
    nameStage.needsConfirmation = true;
    nameStage.rejected = [...new Set([...(nameStage.rejected || []), stagedName])];
  }

  /* --- Summary: verbatim, whitespace only. Never rewritten. ------------ */
  const summary = tidy(parsed.summary);

  /* --- Headline: strict ladder, self-referential rejection. ------------ */
  const forbidden = new Set<string>();
  forbidden.add(exactKey(name));
  forbidden.add(exactKey(basics.location));
  for (const section of SECTION_NAMES) forbidden.add(exactKey(section));
  for (const project of projects) forbidden.add(exactKey(project.name));
  for (const skill of skills) forbidden.add(exactKey(skill));
  for (const language of languages) forbidden.add(exactKey(language));
  for (const job of experience) forbidden.add(exactKey(job.company));
  for (const item of education) {
    forbidden.add(exactKey(item.institution));
    forbidden.add(exactKey(item.degree));
  }
  const summaryKey = exactKey(summary);
  if (summaryKey) forbidden.add(summaryKey);

  const headerBelowName = readHeaderBelowName(identityText, name) ||
    readFirstSafeHeaderTitle(identityText, basics.headline || "");
  const { headline, source: headlineSource } = resolveHeadline({
    headerBelowName,
    // NOT experience[0].title. See resolveHeadline's contract: the latest job
    // title is not the professional headline, and using it silently relabelled
    // career changers with the role they are trying to leave.
    explicitTitle: input.explicitTitle || "",
    linkedinHeadline: input.linkedinHeadline || "",
    parserHeadline: basics.headline || "",
    summary,
    forbidden,
  });

  /* --- Identity enforcement. -------------------------------------------
   * The validator used to report `name_contaminated_by_headline` and the
   * pipeline shipped the contaminated name anyway: the finding was logged and
   * discarded, because by then the profile was frozen and nothing downstream was
   * allowed to write. Production consequence: "Emaawarner Accounting" reached
   * the user's profile with needsConfirmation:false while the error sat in the
   * logs.
   *
   * Enforcement therefore belongs HERE — inside the single writer, before the
   * freeze, and after the headline exists (a name can only be tested for
   * headline contamination once there is a headline). §8: repair first, blank
   * second. A wrong name is worse than an honest question.
   */
  const identityEvidence: IdentityEvidence = {
    headline,
    skills,
    languages,
    projectNames: projects.map((project) => project.name),
    companies: experience.map((job) => job.company),
    institutions: education.map((item) => item.institution),
    degrees: education.map((item) => item.degree),
  };

  let enforcedName = name;
  const identityViolations = findIdentityViolations(enforcedName, identityEvidence);
  if (identityViolations.length) {
    const repaired = repairNameContaminatedByHeadline(enforcedName, identityEvidence);
    nameStage.rejected = [...new Set([...(nameStage.rejected || []), enforcedName])];
    if (repaired) {
      enforcedName = repaired;
      // Repaired from a contaminated source: keep it, but never at full
      // confidence.
      nameStage.name = repaired;
      nameStage.confidence = Math.min(nameStage.confidence, 0.75);
    } else {
      enforcedName = "";
      nameStage.name = "";
      nameStage.source = "needs_confirmation";
      nameStage.confidence = 0;
      nameStage.needsConfirmation = true;
    }
  }

  const profile: ResumeProfile = {
    rawText,
    basics: {
      name: enforcedName,
      headline,
      email: tidy(basics.email),
      phone: tidy(basics.phone),
      location: tidy(basics.location),
      linkedin: tidy(basics.linkedin),
    },
    summary,
    experience,
    education,
    skills,
    projects,
    languages,
    certifications: tidyList(parsed.certifications),
    strengths: tidyList(parsed.strengths),
    additionalEvidence: tidyList(parsed.additionalEvidence),
    warnings: tidyList(parsed.warnings),
    previewText: tidy(parsed.previewText),
  };

  const len = (value: unknown) => (Array.isArray(value) ? value.length : 0);

  return {
    profile: deepFreeze(profile),
    report: {
      nameSource: nameStage.source,
      nameConfidence: nameStage.confidence,
      needsConfirmation: nameStage.needsConfirmation,
      rejectedNames: nameStage.rejected || [],
      headlineSource,
      counts: {
        experience: { parsed: len(parsed.experience), canonical: experience.length },
        education: { parsed: len(parsed.education), canonical: education.length },
        projects: { parsed: len(parsed.projects), canonical: projects.length },
        languages: { parsed: len(parsed.languages), canonical: languages.length },
        skills: { parsed: len(parsed.skills), canonical: skills.length },
      },
    },
  };
}
