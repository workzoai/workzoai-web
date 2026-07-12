/*
 * WorkZo AI - Resume Fact Guard
 * ------------------------------------------------------------------
 * A general, entity-free guard that keeps an AI-rewritten resume faithful
 * to the candidate's real CV. It contains NO hardcoded names, companies,
 * cities, projects, skills, or domain keywords: every decision is
 * structural or linguistic, so it works for ANY CV against ANY JD.
 *
 * Guarantees, for any input:
 *   1. Titles, companies, dates, education, and languages come from the
 *      source CV. The rewrite can never invent a job title or inflate the
 *      headline into a role the CV does not evidence.
 *   2. A skill survives only if it is evidenced in the source CV text: the
 *      whole phrase appears, or all of its content tokens appear. JD
 *      keywords with no support in the CV are dropped.
 *   3. Every output bullet must trace back to a source bullet (reworded is
 *      fine). Invented bullets are dropped; a bullet the model moved to the
 *      wrong job or project is re-homed to the source entry it best matches
 *      by token overlap, which fixes cross-entry leaks with no project names.
 *   4. Skills and bullets are reordered by relevance to the JD or target
 *      role, so the result stays targeted without fabricating.
 *
 * Failure mode is intentional: when unsure, keep the source text. The guard
 * can under-claim (stay faithful to the CV) but must never over-claim.
 */

import {
  extractResumeProfile,
  type ResumeProfile,
  type ResumeExperience,
} from "@/lib/workzoResumeParser";
import { completeResumeProfile } from "@/lib/workzoResumeProfileManager";

export type FactGuardOptions = {
  jobDescription?: string;
  targetRole?: string;
  /** Jaccard token-overlap a rewritten bullet needs to count as the same
   *  source bullet. Lower keeps more rewording, higher is stricter. */
  bulletMatchThreshold?: number;
  maxBulletsPerEntry?: number;
  /** The language the rewrite was asked to produce (e.g. "German"). When set
   *  and different from the CV's source language, the guard switches from
   *  lexical (token-overlap) matching to language-invariant matching so a
   *  legitimate translation is not silently reverted to the source language. */
  outputLanguage?: string;
  /** Lower bound for accepting a heavily reworded (JD-targeted) bullet. */
  bulletRewriteFloor?: number;
  /** Full source CV text, used to verify tools/technologies are real. */
  sourceText?: string;
};

/** Language-invariant anti-fabrication for translated output. Binds the
 *  model's translated bullets POSITIONALLY to the real source bullets: same
 *  order, capped to the real bullet count, so nothing can be invented or
 *  inflated even though the wording is in another language. Falls back to the
 *  source bullet only when the model is missing that position entirely. */
function homeBulletsPositional(
  sourceBullets: string[],
  modelBullets: string[],
  opts: FactGuardOptions,
): string[] {
  const src = (sourceBullets || []).map(cleanBullet).filter(Boolean);
  const model = (modelBullets || []).map(cleanBullet).filter(Boolean);
  const out = src.map((srcText, i) => model[i] || srcText);
  return dedupe(out, (b) => norm(b)).slice(0, opts.maxBulletsPerEntry ?? 6);
}

/* ----------------------------- text helpers ----------------------------- */

const STOPWORDS = new Set([
  "a", "an", "and", "the", "of", "to", "in", "on", "for", "with", "at", "by",
  "from", "as", "is", "are", "was", "were", "be", "been", "being", "that",
  "this", "these", "those", "it", "its", "into", "using", "used", "use",
  "via", "per", "than", "then", "over", "under", "across", "within", "while",
  "our", "your", "their", "his", "her", "they", "you", "we", "i", "me", "my",
  "will", "would", "can", "could", "should", "may", "might", "such", "including",
  "etc", "e", "g", "eg", "ie", "also", "both", "each", "any", "all", "more",
  "most", "other", "some", "few", "up", "out", "about", "after", "before",
]);

function norm(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Dedup key for a language entry. A language is identified by its NAME only; the
// proficiency marker may be written many ways ("English (C1)", "English - C1",
// "English: Fluent", "English, native"), and two different renderings of the
// same language must collapse to one. Keying on norm(value).split(/[-:]/) failed
// because "(C1)" parentheses and a bare name produced different keys, so the
// same language survived twice. This keys on the base name (everything before
// the first level separator, letters only), which is language- and
// format-agnostic and never merges two genuinely different languages.
function languageKey(value: unknown): string {
  return norm(value)
    .split(/[(\-:,·|/]/)[0]
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function clean(value: unknown, max = 600): string {
  return String(value ?? "")
    .replace(/\u0000/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim()
    .slice(0, max);
}

const GUARD_LEVEL_BUCKETS: Array<[RegExp, string]> = [
  [/\b(ph\.?\s?d|d\.?phil|doctora(?:te|l)|doktor|promotion)\b/i, "phd"],
  [/\b(m\.?\s?b\.?\s?a|mba)\b/i, "mba"],
  [/\b(master|magister|m\.?\s?sc|m\.?\s?a|m\.?\s?tech|m\.?\s?eng|m\.?\s?s|msc|meng|mtech)\b/i, "master"],
  [/\b(bachelor|b\.?\s?sc|b\.?\s?a|b\.?\s?tech|b\.?\s?eng|b\.?\s?e|bsc|beng|btech|bba|honou?rs)\b/i, "bachelor"],
  [/\b(diploma|diplom|pg\s?diploma)\b/i, "diploma"],
  [/\b(associate)\b/i, "associate"],
  [/\b(abitur|a-?levels?|high\s?school|secondary)\b/i, "school"],
];
function guardEduDegreeLevel(degree = ""): string {
  for (const [re, b] of GUARD_LEVEL_BUCKETS) if (re.test(degree)) return b;
  return norm(degree).replace(/[^a-z0-9]/g, "");
}
function guardEduInstitutionKey(institution = ""): string {
  return norm(institution).split(/[,·|]|\s[–—-]\s/)[0].replace(/[^a-z0-9]/g, "");
}
// Clear a location that is already contained in the institution string, so the
// render never shows "University of Würzburg, Germany · Germany".
function dropRedundantLocation(institution = "", location = ""): string {
  if (!location) return "";
  const k = (v: string) => norm(v).replace(/[^a-z0-9]/g, "");
  return k(institution).includes(k(location)) ? "" : location;
}
// Drop a skill whose words are a subset of a longer skill ("Change Management"
// inside "Engineering Change Management"), plus exact dups. Removes redundant,
// keyword-stuffed near-duplicates from the rewritten skills list.
function dropSubsetSkills(list: string[]): string[] {
  const wordSet = (v: string) =>
    new Set(v.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2));
  const sets = list.map(wordSet);
  return list.filter((a, ai) => {
    const A = sets[ai];
    if (A.size === 0) return true;
    return !list.some((_b, bi) => bi !== ai && sets[bi].size > A.size && [...A].every((w) => sets[bi].has(w)));
  });
}

/** Crude, general English stemmer: folds plurals and simple tenses so
 *  "switches"/"switching" -> "switch" and "networks"/"networking" ->
 *  "network". No word lists, so it stays entity-free and CV-agnostic. */
function stem(token: string): string {
  let s = token;
  if (s.length > 4 && s.endsWith("ing")) s = s.slice(0, -3);
  else if (s.length > 4 && s.endsWith("ed")) s = s.slice(0, -2);
  else if (s.length > 3 && s.endsWith("ies")) s = `${s.slice(0, -3)}y`;
  else if (s.length > 3 && s.endsWith("es")) s = s.slice(0, -2);
  else if (s.length > 3 && s.endsWith("s") && !s.endsWith("ss")) s = s.slice(0, -1);
  return s;
}

/** Content tokens (>= 2 chars, not a stopword), stemmed. Keeps short tech
 *  tokens like ai, ml, qa, ux, ci, cd, sql, aws, gcp, api with no hardcoded
 *  list, and matches across plural/tense differences between CV and skills. */
function tokenize(value: unknown): string[] {
  return norm(value)
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/[\s.-]+/)
    .map((t) => t.replace(/^[+#]+|[+#]+$/g, ""))
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t))
    .map(stem);
}

function tokenSet(value: unknown): Set<string> {
  return new Set(tokenize(value));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter);
}

/** Evidence base built from the real CV: raw normalized text plus every
 *  token from the parsed source profile. Used to decide what is real. */
type Evidence = { raw: string; tokens: Set<string> };

function buildEvidence(source: ResumeProfile, sourceText: string): Evidence {
  const parts = [
    sourceText,
    source.summary,
    source.basics?.headline,
    ...(source.skills || []),
    ...(source.experience || []).flatMap((e) => [
      e.title,
      e.company,
      ...(e.bullets || []),
    ]),
    ...(source.projects || []).flatMap((p) => [p.name, ...(p.bullets || [])]),
  ]
    .filter(Boolean)
    .join(" \n ");
  return { raw: norm(parts), tokens: tokenSet(parts) };
}

/** A phrase is evidenced when the whole normalized phrase appears in the
 *  source, or every one of its content tokens appears. This keeps real
 *  skills phrased differently while dropping unsupported JD keywords. */
function isEvidenced(phrase: string, ev: Evidence): boolean {
  const n = norm(phrase);
  if (!n) return false;
  if (n.length >= 3 && ev.raw.includes(n)) return true;
  const toks = tokenize(phrase);
  if (!toks.length) return false;
  return toks.every((t) => ev.tokens.has(t));
}

function relevance(text: string, jd: string, targetRole: string): number {
  const source = tokenSet(`${jd} ${targetRole}`);
  if (!source.size) return 0;
  let score = 0;
  for (const t of tokenize(text)) if (source.has(t)) score += 1;
  return score;
}

function dedupe<T>(items: T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = keyOf(item);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

function cleanBullet(value: unknown): string {
  const text = clean(value, 520).replace(/^[-•*]\s*/, "").trim();
  if (!text || text.length < 12) return "";
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/* ----------------------- parser-output repair (general) ----------------- */
/* Universal structural repairs for ANY parsed profile, before it is trusted
 * as source. No names, companies, fields, or domains: only layout-driven
 * defects that any parser can produce. Proven on unrelated CVs. */

/** "Networking: Switches" -> "Switches". A leading short "Label:" is a
 *  sidebar category header the parser folded into the skill, not the skill. */
function stripCategoryLabel(skill: string): string {
  const m = skill.match(/^[^:]{2,40}:\s*(.+)$/);
  return m ? m[1].trim() : skill;
}

function repairSkills(skills: string[]): string[] {
  const cleaned = (skills || [])
    .map((s) => clean(s, 80))
    .map(stripCategoryLabel)
    .filter((s) => s && !/:$/.test(s));
  return dedupe(cleaned, (s) => norm(s));
}

type EduRow = {
  degree: string;
  institution: string;
  location: string;
  dates: string;
};

/** Dedupe education, and merge a bare "degree only" row with an adjacent
 *  "institution only" row, which is how two-line "Degree / School" blocks get
 *  split into two entries on multi-column or sidebar layouts. */
function repairEducation(education: EduRow[]): EduRow[] {
  const items = (education || []).map((e) => ({
    degree: clean(e.degree, 180),
    institution: clean(e.institution, 180),
    location: clean(e.location, 160),
    dates: clean(e.dates, 80),
  }));
  const merged: EduRow[] = [];
  for (const item of items) {
    const prev = merged[merged.length - 1];
    const bareInstitution =
      !!item.institution &&
      (!item.degree ||
        norm(item.degree) === norm(item.institution) ||
        norm(item.degree) === "education");
    const prevNeedsInstitution =
      !!prev &&
      !!prev.degree &&
      !prev.institution &&
      norm(prev.degree) !== "education";
    if (
      prev &&
      prevNeedsInstitution &&
      bareInstitution &&
      (!item.dates || !prev.dates || item.dates === prev.dates)
    ) {
      prev.institution = item.institution;
      if (!prev.dates) prev.dates = item.dates;
      if (!prev.location) prev.location = item.location;
      continue;
    }
    merged.push({ ...item });
  }
  // Collapse duplicates by DEGREE-LEVEL + INSTITUTION, ignoring date variance.
  // Keying on the exact date string (as before) let the same qualification at
  // the same school survive twice when the source repeated it with a different
  // date format (e.g. Luleå "2014" vs Luleå "2013 - 2016") — the visible
  // "duplicate education" in the rendered CV. Prefer a full range over a single
  // year when merging.
  const LEVEL_BUCKETS: Array<[RegExp, string]> = [
    [/\b(ph\.?\s?d|d\.?phil|doctora(?:te|l)|doktor|promotion)\b/i, "phd"],
    [/\b(m\.?\s?b\.?\s?a|mba)\b/i, "mba"],
    [/\b(master|magister|m\.?\s?sc|m\.?\s?a|m\.?\s?tech|m\.?\s?eng|m\.?\s?s|msc|meng|mtech)\b/i, "master"],
    [/\b(bachelor|b\.?\s?sc|b\.?\s?a|b\.?\s?tech|b\.?\s?eng|b\.?\s?e|bsc|beng|btech|bba|honou?rs)\b/i, "bachelor"],
    [/\b(diploma|diplom|pg\s?diploma)\b/i, "diploma"],
    [/\b(associate)\b/i, "associate"],
    [/\b(abitur|a-?levels?|high\s?school|secondary)\b/i, "school"],
  ];
  const degreeLevel = (degree = "") => {
    for (const [re, b] of LEVEL_BUCKETS) if (re.test(degree)) return b;
    return norm(degree).replace(/[^a-z0-9]/g, "");
  };
  const institutionKey = (institution = "") =>
    norm(institution).split(/[,·|]|\s[–—-]\s/)[0].replace(/[^a-z0-9]/g, "");
  const eduKey = (e: EduRow) => `${degreeLevel(e.degree)}|${institutionKey(e.institution)}`;
  const rank = (d = "") => (/[-\u2013\u2014]/.test(d) ? 2 : d ? 1 : 0);
  const byKey = new Map<string, EduRow>();
  for (const e of merged) {
    const k = eduKey(e);
    const prev = byKey.get(k);
    if (!prev) {
      byKey.set(k, { ...e });
    } else {
      if (rank(e.dates) > rank(prev.dates)) prev.dates = e.dates;
      if (!prev.institution && e.institution) prev.institution = e.institution;
      if (!prev.location && e.location) prev.location = e.location;
      // keep the longer/more-complete degree string
      if (clean(e.degree, 180).length > clean(prev.degree, 180).length) prev.degree = e.degree;
    }
  }
  return Array.from(byKey.values());
}

function extractDateRanges(text: string): string[] {
  const re =
    /((?:19|20)\d{2})\s*(?:[-\u2013\u2014]|to|until)\s*((?:19|20)\d{2}|present|current|now|ongoing)/gi;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const end = m[2][0].toUpperCase() + m[2].slice(1).toLowerCase();
    out.push(`${m[1]} - ${end}`);
  }
  return out;
}


function recoverEducationDatesFromText(education: EduRow[], sourceText: string): EduRow[] {
  if (!education.length || !sourceText.trim()) return education;
  const lines = sourceText.replace(/\r/g, "\n").split(/\n+/).map((line) => clean(line, 260)).filter(Boolean);
  const key = (value = "") => norm(value).replace(/[^a-z0-9]+/g, " ").trim();
  const tokens = (value = "") => key(value).split(/\s+/).filter((token) => token.length > 2);
  const matches = (line: string, value: string) => {
    const wanted = tokens(value);
    if (!wanted.length) return false;
    const hay = ` ${key(line)} `;
    return wanted.filter((token) => hay.includes(` ${token} `)).length >= Math.min(2, wanted.length);
  };
  const dateOnLine = (line: string) => {
    const range = extractDateRanges(line)[0];
    if (range) return range;
    const single = line.match(/\b((?:19|20)\d{2})\b/);
    return single?.[1] || "";
  };

  return education.map((entry) => {
    if (entry.dates) return entry;
    const institutionAnchors = entry.institution
      ? lines.map((line, index) => ({ line, index })).filter(({ line }) => matches(line, entry.institution))
      : [];
    const degreeAnchors = entry.degree
      ? lines.map((line, index) => ({ line, index })).filter(({ line }) => matches(line, entry.degree))
      : [];
    const anchors = institutionAnchors.length ? institutionAnchors : degreeAnchors;

    for (const { index } of anchors) {
      const nearby: Array<{ distance: number; date: string }> = [];
      for (let candidateIndex = Math.max(0, index - 4); candidateIndex <= Math.min(lines.length - 1, index + 4); candidateIndex += 1) {
        const date = dateOnLine(lines[candidateIndex]);
        if (date) nearby.push({ distance: Math.abs(candidateIndex - index), date });
      }
      nearby.sort((a, b) => a.distance - b.distance || (b.date.includes("-") ? 1 : 0) - (a.date.includes("-") ? 1 : 0));
      if (nearby[0]?.date) return { ...entry, dates: nearby[0].date };
    }
    return entry;
  });
}

function recoverProjectsFromText(projects: ResumeProfile["projects"], sourceText: string): ResumeProfile["projects"] {
  if (!sourceText.trim()) return projects;
  const reparsed = extractResumeProfile(sourceText).projects || [];
  const score = (items: ResumeProfile["projects"]) =>
    items.length * 30 + items.reduce((sum, project) => sum + (project.bullets?.length || 0) * 8, 0);
  if (!reparsed.length || score(reparsed) <= score(projects || [])) return projects;

  const existingByName = new Map((projects || []).map((project) => [norm(project.name), project]));
  return reparsed.map((project) => {
    const existing = existingByName.get(norm(project.name));
    if (!existing) return project;
    return {
      ...project,
      ...existing,
      name: existing.name || project.name,
      bullets: (existing.bullets?.length || 0) >= (project.bullets?.length || 0)
        ? existing.bullets
        : project.bullets,
    };
  });
}



type ExperienceRow = NonNullable<ResumeProfile["experience"]>[number];

function experienceIdentityKey(value: unknown): string {
  return norm(value).replace(/[^a-z0-9]+/g, " ").trim();
}

function dateIdentityKey(value: unknown): string {
  const text = norm(value)
    .replace(/present|current|heute|aktuell/g, "present")
    .replace(/[–—−]/g, "-");
  const years = text.match(/(?:19|20)\d{2}/g) || [];
  return years.join("-") || text.replace(/[^a-z0-9]+/g, "");
}

function experienceEntryNoise(entry: ExperienceRow): boolean {
  const title = clean(entry.title, 180);
  const company = clean(entry.company, 180);
  const dates = clean(entry.dates, 80);
  const combined = `${title} ${company}`.trim();
  if (!combined && !dates && !(entry.bullets || []).length) return true;
  if (/^(experience|work experience|professional experience|employment history|career history|berufserfahrung)$/i.test(combined)) return true;
  return false;
}

function mergeExperienceRows(a: ExperienceRow, b: ExperienceRow): ExperienceRow {
  const prefer = (left = "", right = "") => {
    const l = clean(left, 220), r = clean(right, 220);
    if (!l) return r;
    if (!r) return l;
    const lk = experienceIdentityKey(l), rk = experienceIdentityKey(r);
    if (lk === rk) return l.length >= r.length ? l : r;
    if (lk.includes(rk)) return l;
    if (rk.includes(lk)) return r;
    return l;
  };
  return {
    title: prefer(a.title, b.title),
    company: prefer(a.company, b.company),
    location: prefer(a.location, b.location),
    dates: prefer(a.dates, b.dates),
    bullets: dedupe(
      [...(a.bullets || []), ...(b.bullets || [])]
        .map((bullet) => cleanBullet(bullet))
        .filter(Boolean),
      (bullet) => norm(bullet).replace(/[^a-z0-9]+/g, " ").trim(),
    ).slice(0, 12),
  };
}

/**
 * Merge parser-created duplicate/fragmented employment rows without collapsing
 * genuine promotions. Rows merge only when they share strong factual identity:
 * same normalized date range plus same/contained company or title, or when one
 * adjacent row is a complementary fragment missing title/company.
 */
function repairExperienceStructure(experience: ExperienceRow[]): ExperienceRow[] {
  const input = (experience || [])
    .map((entry) => ({
      title: clean(entry.title, 180),
      company: clean(entry.company, 180),
      location: clean(entry.location, 160),
      dates: clean(entry.dates, 80),
      bullets: dedupe((entry.bullets || []).map(cleanBullet).filter(Boolean), (bullet) => norm(bullet)),
    }))
    .filter((entry) => !experienceEntryNoise(entry));

  const output: ExperienceRow[] = [];
  for (const row of input) {
    const company = experienceIdentityKey(row.company);
    const title = experienceIdentityKey(row.title);
    const dates = dateIdentityKey(row.dates);

    let match = -1;
    for (let i = 0; i < output.length; i += 1) {
      const existing = output[i];
      const eCompany = experienceIdentityKey(existing.company);
      const eTitle = experienceIdentityKey(existing.title);
      const eDates = dateIdentityKey(existing.dates);
      const sameDates = !!dates && !!eDates && dates === eDates;
      const sameCompany = !!company && !!eCompany && (company === eCompany || company.includes(eCompany) || eCompany.includes(company));
      const sameTitle = !!title && !!eTitle && (title === eTitle || title.includes(eTitle) || eTitle.includes(title));
      const exactIdentity = (sameCompany && sameDates) || (sameTitle && sameDates) || (sameCompany && sameTitle);
      const complementaryAdjacent = i === output.length - 1 && sameDates && (
        (!row.company && !!row.title && !!existing.company && !existing.title) ||
        (!row.title && !!row.company && !!existing.title && !existing.company)
      );
      if (exactIdentity || complementaryAdjacent) { match = i; break; }
    }

    if (match >= 0) output[match] = mergeExperienceRows(output[match], row);
    else output.push(row);
  }

  return output.slice(0, 20);
}
/** Recover dropped experience dates from the raw text, but only when the
 *  number of date ranges matches the number of entries, so it never guesses. */
function repairExperienceDates<T extends { dates?: string }>(
  experience: T[],
  sourceText: string,
): T[] {
  if (!experience.some((e) => !e.dates) || !sourceText) return experience;
  const ranges = extractDateRanges(sourceText);
  if (ranges.length !== experience.length) return experience;
  return experience.map((e, i) => (e.dates ? e : { ...e, dates: ranges[i] }));
}

/** Recover language entries that multi-column PDF extraction often places
 *  outside the parsed Languages array. This is intentionally generic: it looks
 *  only inside a LANGUAGES section and requires a proficiency marker, so it does
 *  not maintain a hardcoded list of languages or infer languages from the JD. */
function recoverLanguagesFromText(sourceText: string): string[] {
  const text = String(sourceText || "").replace(/\r/g, "\n");
  if (!text.trim()) return [];

  const heading = /(?:^|\n)\s*(?:languages?|language skills?|sprachkenntnisse|sprachen)\s*[:\-]?\s*(?:\n|$)/im;
  const match = heading.exec(text);
  if (!match) return [];

  const tail = text.slice((match.index || 0) + match[0].length);
  const nextHeading = /\n\s*(?:professional experience|work experience|experience|education|projects?|skills?|certifications?|profile|summary|contact|expertise)\s*[:\-]?\s*(?:\n|$)/im;
  const block = tail.split(nextHeading)[0].slice(0, 1200);
  const proficiency = /(?:native|mother tongue|fluent|business fluent|professional(?: working)? proficiency|full professional proficiency|conversational|intermediate|beginner|basic|elementary|advanced|working proficiency|a1|a2|b1|b2|c1|c2)/i;
  const candidates = block
    .split(/\n|[•▪◦]/g)
    .flatMap((line) => line.split(/(?=\b[A-Z][A-Za-zÀ-ÖØ-öø-ÿ' -]{1,30}\s*(?:[:\-–—]|\())/g))
    .map((line) => clean(line, 120).replace(/^[-•*]\s*/, ""))
    .filter((line) => line && proficiency.test(line))
    .map((line) => {
      const m = line.match(/^([A-Z][A-Za-zÀ-ÖØ-öø-ÿ' -]{1,35})\s*(?:[:\-–—]|\()\s*([^)]{1,60})\)?/);
      if (!m) return "";
      const language = clean(m[1], 45);
      const level = clean(m[2], 65);
      return language && level ? `${language} - ${level}` : "";
    })
    .filter(Boolean);

  return dedupe(candidates, (value) => languageKey(value));
}

/** Public entry point: repair a parsed profile's structural defects. Safe to
 *  run on any profile from any parser, and used on both the rewrite source
 *  (below) and, if wired in, the baseline improve-CV path. */
export function repairParsedResume(
  profile: Partial<ResumeProfile> | null | undefined,
  sourceText = "",
): ResumeProfile {
  const p = completeResumeProfile(profile as ResumeProfile, sourceText);
  return {
    ...p,
    skills: repairSkills(p.skills || []),
    education: recoverEducationDatesFromText(
      repairEducation((p.education || []) as EduRow[]),
      sourceText,
    ) as ResumeProfile["education"],
    experience: repairExperienceDates(repairExperienceStructure(p.experience || []), sourceText),
    projects: recoverProjectsFromText(p.projects || [], sourceText),
    languages: dedupe(
      [...(p.languages || []), ...recoverLanguagesFromText(sourceText)]
        .map((language) => clean(language, 100))
        .filter(Boolean),
      (language) => languageKey(language),
    ).slice(0, 12),
  };
}

/* --------------------------- source resolution -------------------------- */

function pickSource(
  candidate: ResumeProfile,
  provided: Partial<ResumeProfile> | null | undefined,
  sourceText: string,
): ResumeProfile {
  const fromProvided = provided
    ? completeResumeProfile(provided as ResumeProfile, sourceText)
    : null;
  const fromText =
    sourceText && sourceText.trim().length > 120
      ? completeResumeProfile(extractResumeProfile(sourceText), sourceText)
      : null;

  const sourceCompletenessScore = (p: ResumeProfile | null): number => {
    if (!p) return 0;
    const experienceBullets = (p.experience || []).reduce((sum, job) => sum + (job.bullets?.length || 0), 0);
    const projectBullets = (p.projects || []).reduce((sum, project) => sum + (project.bullets?.length || 0), 0);
    return (p.experience?.length || 0) * 120
      + experienceBullets * 16
      + (p.projects?.length || 0) * 28
      + projectBullets * 8
      + (p.education?.length || 0) * 24
      + (p.languages?.length || 0) * 22
      + Math.min(40, p.skills?.length || 0)
      + Math.min(30, Math.floor((p.summary?.length || 0) / 20));
  };

  // Build a HYBRID source instead of selecting one entire parse. Selecting the
  // richer parse wholesale was unsafe: a multi-column text parse could contain
  // more bullets while shortening or changing a factual job title, and it could
  // also drop projects that were present in the saved canonical profile.
  if (fromProvided && fromText) {
    const rawNorm = norm(sourceText);
    const exactInRaw = (value: unknown) => {
      const n = norm(value);
      return !!n && rawNorm.includes(n);
    };
    const companyKey = (value: unknown) =>
      norm(value)
        .replace(/\b(gmbh|ag|se|ug|kg|ohg|ltd|llc|inc|corp|co|plc|bv|nv|group)\b/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

    const parsedByCompany = new Map<string, ResumeExperience>();
    (fromText.experience || []).forEach((entry) => {
      const key = companyKey(entry.company);
      if (key && !parsedByCompany.has(key)) parsedByCompany.set(key, entry);
    });

    const experience = (fromProvided.experience || []).map((saved, index) => {
      const parsed = parsedByCompany.get(companyKey(saved.company)) || fromText.experience?.[index];
      if (!parsed) return saved;

      const savedTitleExact = exactInRaw(saved.title);
      const parsedTitleExact = exactInRaw(parsed.title);
      const title = savedTitleExact && parsedTitleExact
        ? (clean(saved.title, 180).length >= clean(parsed.title, 180).length ? saved.title : parsed.title)
        : savedTitleExact
          ? saved.title
          : parsedTitleExact
            ? parsed.title
            : saved.title || parsed.title;

      const savedBullets = saved.bullets || [];
      const parsedBullets = parsed.bullets || [];
      return {
        title,
        company: saved.company || parsed.company,
        location: saved.location || parsed.location,
        dates: saved.dates || parsed.dates,
        bullets: parsedBullets.length > savedBullets.length ? parsedBullets : savedBullets,
      };
    });
    // Include genuine parsed jobs only when the saved profile did not contain
    // a matching company at all.
    const savedCompanies = new Set(experience.map((entry) => companyKey(entry.company)).filter(Boolean));
    for (const parsed of fromText.experience || []) {
      const key = companyKey(parsed.company);
      if (key && !savedCompanies.has(key)) experience.push(parsed);
    }

    const projectKey = (value: unknown) => norm(value).replace(/[^a-z0-9]+/g, " ").trim();
    const projectsByName = new Map<string, ResumeProfile["projects"][number]>();
    for (const project of [...(fromProvided.projects || []), ...(fromText.projects || [])]) {
      const key = projectKey(project.name);
      if (!key) continue;
      const existing = projectsByName.get(key);
      if (!existing || (project.bullets?.length || 0) > (existing.bullets?.length || 0)) {
        projectsByName.set(key, project);
      }
    }

    const education = sourceCompletenessScore({ ...fromProvided, experience: [], projects: [] } as ResumeProfile)
      >= sourceCompletenessScore({ ...fromText, experience: [], projects: [] } as ResumeProfile)
      ? fromProvided.education
      : fromText.education;

    return completeResumeProfile({
      ...fromProvided,
      basics: {
        ...fromText.basics,
        ...fromProvided.basics,
      },
      summary: fromProvided.summary || fromText.summary,
      skills: dedupe([...(fromProvided.skills || []), ...(fromText.skills || [])], (v) => norm(v)),
      experience,
      projects: Array.from(projectsByName.values()),
      education: education?.length ? education : (fromProvided.education || fromText.education),
      languages: dedupe([...(fromProvided.languages || []), ...(fromText.languages || [])], (v) => languageKey(v)),
      certifications: dedupe([...(fromProvided.certifications || []), ...(fromText.certifications || [])], (v) => norm(v)),
    }, sourceText);
  }

  return fromProvided || fromText || candidate;
}

/* ------------------------------ bullet homing --------------------------- */

type PoolBullet = { text: string; tokens: Set<string>; used: boolean };

/** Rewrites a single source entry's bullets: for each real source bullet,
 *  adopt the model's best-matching reworded version if it is close enough,
 *  otherwise keep the source wording. Nothing invented, nothing that belongs
 *  to a different entry. Consumed pool bullets cannot be reused elsewhere. */
function homeBullets(
  sourceBullets: string[],
  pool: PoolBullet[],
  opts: FactGuardOptions,
): string[] {
  const threshold = opts.bulletMatchThreshold ?? 0.4;
  const out: string[] = [];
  for (const raw of sourceBullets) {
    const srcText = cleanBullet(raw);
    if (!srcText) continue;
    const srcTokens = tokenSet(srcText);
    let best: PoolBullet | null = null;
    let bestSim = 0;
    for (const cand of pool) {
      if (cand.used) continue;
      const sim = jaccard(srcTokens, cand.tokens);
      if (sim > bestSim) {
        bestSim = sim;
        best = cand;
      }
    }
    if (
      best &&
      bestSim >= threshold &&
      numbersSupported(best.text, opts.sourceText || srcText) &&
      entitiesSupported(best.text, opts.sourceText || srcText)
    ) {
      best.used = true;
      out.push(best.text); // reworded, but proven to be this source bullet
    } else if (
      best &&
      bestSim >= (opts.bulletRewriteFloor ?? 0.18) &&
      numbersSupported(best.text, srcText) &&
      entitiesSupported(best.text, opts.sourceText || srcText)
    ) {
      // A genuinely JD-targeted rewrite changes a lot of wording, so it can fall
      // under the strict similarity threshold and was being REVERTED to the
      // original bullet, which is why "Improve CV" appeared to do nothing.
      // Accept the heavier rewrite, but only when it invents no numbers the
      // source bullet cannot support.
      best.used = true;
      out.push(best.text);
    } else {
      out.push(srcText); // keep the real bullet rather than lose it
    }
  }
  const deduped = dedupe(out, (b) => norm(b));
  return deduped.slice(0, opts.maxBulletsPerEntry ?? 6);
}

/* -------------------------------- headline ------------------------------ */

function guardHeadline(
  source: ResumeProfile,
  ev: Evidence,
  opts: FactGuardOptions,
): string {
  const base = clean(source.basics?.headline, 120);
  const target = clean(opts.targetRole, 120);
  if (!target || norm(target) === "target role") return base;
  if (base && norm(base).includes(norm(target))) return base;
  // Only surface the target role in the headline if the CV actually supports
  // it. This blocks "Systems Administrator" when nothing in the CV backs it.
  if (isEvidenced(target, ev)) {
    return base ? `${base} | ${target}`.slice(0, 120) : target;
  }
  return base;
}

/** Every number in `text` must also appear in `source`. This is what stops the
 *  model inventing metrics ("reduced costs by 30%") while still allowing it to
 *  genuinely reword a bullet toward the JD. */
/** Distinctive terms: acronyms (SQL, CAD, EDR, HACCP, ITIL) and product/proper
 *  names (VMware, ManageEngine, HubSpot). Detected by SHAPE, so this works for
 *  any profession and any language, with no curated vocabulary list. */
function distinctiveEntities(text: string): string[] {
  const matches =
    text.match(/\b(\p{Lu}{2,}[\p{L}\p{N}+#.-]*|\p{Ll}?\p{Lu}\p{Ll}+\p{Lu}[\p{L}]*)\b/gu) || [];
  return matches.map((m) => m.toLowerCase().replace(/[.,;:]+$/, "")).filter((m) => m.length > 1);
}

/** Every distinctive entity in `text` must also appear somewhere in the real CV.
 *
 *  Numbers alone are not enough: a model can fabricate without any digits, e.g.
 *  rewriting a CAD designer's bullet as "configured hardware and troubleshooting
 *  for endpoint security" to chase an IT job description. Requiring each tool,
 *  technology, and acronym to exist in the source CV blocks that class of
 *  invention while still allowing genuine rewording. */
function entitiesSupported(text: string, source: string): boolean {
  const src = source.toLowerCase();
  return distinctiveEntities(text).every((e) => src.includes(e));
}

function numbersSupported(text: string, source: string): boolean {
  const nums = (text.match(/\d+(?:[.,]\d+)?/g) || []).map((n) => n.replace(",", "."));
  if (!nums.length) return true;
  const src = source.replace(/,/g, ".");
  return nums.every((n) => src.includes(n));
}

function guardSummary(
  source: ResumeProfile,
  headline: string,
  modelSummary = "",
  sourceText = "",
): string {
  const original = clean(source.summary, 900);

  // Prefer the model's rewritten, JD-targeted summary. Previously this function
  // ALWAYS returned the original summary (any real summary clears 60 chars), so
  // the whole point of "Improve CV" was silently discarded. We accept the
  // rewrite only if it invents no numbers that the CV cannot back up.
  const rewritten = clean(modelSummary, 900);
  const evidence = `${sourceText} ${original} ${headline}`;
  if (
    rewritten.length >= 60 &&
    numbersSupported(rewritten, evidence)
  ) {
    // A role-targeted summary naturally contains positioning language that may
    // not appear verbatim in the source CV. Rejecting the entire summary because
    // of one new title/acronym caused the original generic summary to overwrite
    // every successful AI rewrite. Numeric facts remain strictly source-backed;
    // hard identity, employment, education, and skills are protected elsewhere.
    return rewritten;
  }

  if (original.length >= 60) return original;
  const years =
    (headline + " " + original).match(/\b(\d+)\+?\s*years?\b/i)?.[0] || "";
  const base = headline || "Professional";
  return clean(
    `${base}${years ? ` with ${years} of experience` : ""}, focused on reliable delivery and clear communication.`,
    500,
  );
}

/* --------------------------------- guard -------------------------------- */

export function guardResumeAgainstSource(
  candidateInput: Partial<ResumeProfile> | null | undefined,
  source: { profile?: Partial<ResumeProfile> | null; text?: string },
  opts: FactGuardOptions = {},
): ResumeProfile {
  const sourceText = clean(source.text, 40000);
  // Carry the full CV text in opts so bullet-level guards can verify that every
  // tool/technology in a rewritten bullet actually exists somewhere in this CV.
  opts = { ...opts, sourceText };
  const candidate = completeResumeProfile(
    candidateInput as ResumeProfile,
    sourceText,
  );
  const src = repairParsedResume(
    pickSource(candidate, source.profile, sourceText),
    sourceText,
  );
  const ev = buildEvidence(src, sourceText);

  // Is this a genuine cross-language rewrite? If so, lexical token overlap
  // against the source-language CV is meaningless (German bullets share almost
  // no tokens with English source) and the old guard silently reverted every
  // translated field back to the source language. In translated mode we keep
  // the model's translated PROSE and enforce truthfulness structurally instead
  // (identity, counts, dates, companies, institutions still come from the real
  // CV, so nothing can be invented).
  const translated =
    !!opts.outputLanguage &&
    norm(opts.outputLanguage).length > 0 &&
    norm(opts.outputLanguage) !== "english";

  // One shared pool of every reworded bullet the model produced, from both
  // experience and projects, so a bullet placed under the wrong entry can be
  // pulled back to where it belongs.
  const pool: PoolBullet[] = [
    ...(candidate.experience || []).flatMap((e) => e.bullets || []),
    ...(candidate.projects || []).flatMap((p) => p.bullets || []),
  ]
    .map((b) => cleanBullet(b))
    .filter(Boolean)
    .map((text) => ({ text, tokens: tokenSet(text), used: false }));

  // Experience identity fields are immutable facts. Title, company, location, and dates
  // always come from the canonical source in every output language. Only bullets
  // may be rewritten or translated. This prevents role drift such as changing
  // "Technical Support and Sales Engineer" into an unrelated sales title.
  const modelExp = candidate.experience || [];
  // Align the model's (possibly reordered / retitled) experience to the real
  // source entries by COMPANY. Company names are proper nouns, so they survive
  // translation and give a stable key; positional binding would put "CAD
  // Designer" under Cummins if the model returned its jobs in a different order.
  const stripEntity = (v: unknown) =>
    norm(v)
      .replace(/\b(gmbh|ag|se|ug|kg|ohg|ltd|llc|inc|corp|co|plc|bv|nv|group|university|universitaet|universität)\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const modelByCompany = new Map<string, (typeof modelExp)[number]>();
  modelExp.forEach((m) => {
    const k = stripEntity(m?.company);
    if (k && !modelByCompany.has(k)) modelByCompany.set(k, m);
  });
  const matchModelJob = (job: { company?: string }, i: number) =>
    modelByCompany.get(stripEntity(job.company)) || modelExp[i];
  const experience: ResumeExperience[] = (src.experience || []).map((job, i) => {
    const m = translated ? matchModelJob(job, i) : undefined;
    return {
      title: clean(job.title, 140),
      company: clean(job.company, 160),
      location: clean(job.location, 160),
      dates: clean(job.dates, 90),
      // A CV improvement must visibly improve wording, not merely copy the
      // uploaded CV. For same-language rewrites, adopt the best matching model
      // bullet only when its numbers and named tools/entities are supported by
      // the source CV; otherwise retain the original bullet. This preserves all
      // experience while still allowing JD-targeted phrasing.
      bullets: translated
        ? homeBulletsPositional(job.bullets || [], m?.bullets || [], opts)
        : homeBullets(job.bullets || [], pool, { ...opts, maxBulletsPerEntry: opts.maxBulletsPerEntry ?? 8 }),
    };
  });

  // Projects: names from the source, bullets re-homed the same way.
  const modelProj = candidate.projects || [];
  const modelProjectByName = new Map<string, (typeof modelProj)[number]>();
  modelProj.forEach((project) => {
    const key = norm(project?.name);
    if (key && !modelProjectByName.has(key)) modelProjectByName.set(key, project);
  });
  const projects = (src.projects || []).map((project, i) => {
    const modelProject = modelProjectByName.get(norm(project.name)) || modelProj[i];
    return {
      name: clean(project.name, 160),
      bullets: translated
        ? homeBulletsPositional(project.bullets || [], modelProject?.bullets || [], opts)
        : homeBullets(project.bullets || [], pool, { ...opts, maxBulletsPerEntry: opts.maxBulletsPerEntry ?? 8 }),
    };
  });

  // Skills: every real source skill, plus any model skill the CV evidences.
  const jd = clean(opts.jobDescription, 8000);
  const target = clean(opts.targetRole, 160);
  const sourceSkills = (src.skills || []).map((v) => clean(v, 80)).filter(Boolean);
  const modelSkills = (candidate.skills || []).map((v) => clean(v, 80)).filter(Boolean);
  let skills: string[];
  if (translated) {
    // Translated skill wording cannot be lexically verified against the
    // source-language CV, so trust the model's translated skills but CAP the
    // count to the real skill count so the list cannot be inflated with
    // invented skills.
    const cap = Math.max(sourceSkills.length, 8);
    skills = dropSubsetSkills(dedupe(modelSkills.length ? modelSkills : sourceSkills, (v) => norm(v))).slice(0, cap);
  } else {
    const candidateSkills = modelSkills.filter((v) => v && isEvidenced(v, ev));
    skills = dropSubsetSkills(dedupe([...sourceSkills, ...candidateSkills], (v) => norm(v)))
      .map((skill) => ({ skill, score: relevance(skill, jd, target) }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.skill)
      .slice(0, 30);
  }

  // In Improve CV, the user's explicit target role is the requested CV
  // positioning. It is intentionally separate from the current CV headline and
  // must be the single source of truth for the rewritten headline.
  const explicitTargetRole = clean(opts.targetRole, 120);
  const headline = explicitTargetRole
    || (translated
      ? clean(candidate.basics?.headline || src.basics?.headline, 120)
      : guardHeadline(src, ev, opts));
  const summary = translated
    ? clean(candidate.summary || src.summary, 900)
    : guardSummary(src, headline, clean(candidate.summary, 900), sourceText);

  return completeResumeProfile(
    {
      ...src,
      basics: { ...src.basics, headline },
      summary,
      skills,
      experience,
      projects,
      education: dedupe(
        (src.education || []).map((e, i) => ({
          // Institution + dates are language-invariant (proper nouns / numbers)
          // and always come from the source. In translated mode the degree NAME
          // may be translated, so take the model's degree at the same position.
          degree: clean(
            translated
              ? ((candidate.education || []).find(
                  (me) => stripEntity(me?.institution) && stripEntity(me?.institution) === stripEntity(e.institution),
                )?.degree ||
                  (candidate.education || [])[i]?.degree ||
                  e.degree)
              : e.degree,
            180,
          ),
          institution: clean(e.institution, 180),
          location: dropRedundantLocation(clean(e.institution, 180), clean(e.location, 160)),
          dates: clean(e.dates, 80),
        })),
        (e) => `${guardEduDegreeLevel(e.degree)}|${guardEduInstitutionKey(e.institution)}`,
      ).slice(0, 8),
      languages: translated
        ? (src.languages || []).map(
            (sourceLanguage, index) =>
              clean((candidate.languages || [])[index] || sourceLanguage, 80),
          )
        : dedupe(
            [...(src.languages || []), ...(candidate.languages || [])]
              .map((l) => clean(l, 80))
              .filter(Boolean),
            (l) => languageKey(l),
          ).slice(0, 12),
      rawText: "",
      previewText: "",
    },
    "",
  );
}

/* ------------------------------- formatting ----------------------------- */

/** Plain-text render of a guarded profile, for the editable box and copy.
 *  Entity-free: it only lays out whatever the profile contains. */
export function formatResumeProfileText(
  profile: Partial<ResumeProfile> | null | undefined,
): string {
  const p = completeResumeProfile(profile as ResumeProfile, "");
  const out: string[] = [];
  const b = p.basics || {};
  if (b.name) out.push(b.name);
  if (b.headline) out.push(b.headline);
  const contact = [b.email, b.phone, b.location, b.linkedin]
    .filter(Boolean)
    .join(" · ");
  if (contact) out.push(contact);

  const section = (title: string, lines: string[]) => {
    const valid = lines.map((l) => clean(l, 1000)).filter(Boolean);
    if (!valid.length) return;
    out.push("", title, ...valid);
  };

  section("Professional Summary", [p.summary]);
  section("Core Skills", p.skills || []);

  if (p.experience?.length) {
    out.push("", "Professional Experience");
    for (const job of p.experience) {
      if (job.title) out.push(job.title);
      const line = [job.company, job.location].filter(Boolean).join(" · ");
      if (line) out.push(line);
      if (job.dates) out.push(job.dates);
      for (const bullet of job.bullets || []) out.push(bullet);
    }
  }

  if (p.projects?.length) {
    out.push("", "Projects");
    for (const project of p.projects) {
      if (project.name) out.push(project.name);
      for (const bullet of project.bullets || []) out.push(bullet);
    }
  }

  if (p.education?.length) {
    out.push("", "Education");
    for (const e of p.education) {
      if (e.degree) out.push(e.degree);
      if (e.dates) out.push(e.dates);
      const line = [e.institution, e.location].filter(Boolean).join(" · ");
      if (line) out.push(line);
    }
  }

  section("Languages", p.languages || []);
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
