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

function clean(value: unknown, max = 600): string {
  return String(value ?? "")
    .replace(/\u0000/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim()
    .slice(0, max);
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
  const degreeLevel = (degree = "") => {
    const m = /\b(ph\.?d|doctorate|doktor|master|magister|m\.?sc|m\.?a|mba|bachelor|b\.?sc|b\.?a|b\.?eng|diploma|diplom|associate|abitur)\b/i.exec(degree);
    return (m ? m[1] : degree).toLowerCase().replace(/[^a-z]/g, "");
  };
  const eduKey = (e: EduRow) =>
    `${degreeLevel(e.degree)}|${norm(e.institution).replace(/[^a-z0-9]/g, "")}`;
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
    education: repairEducation((p.education || []) as EduRow[]) as ResumeProfile["education"],
    experience: repairExperienceDates(p.experience || [], sourceText),
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

  const expCount = (p: ResumeProfile | null) => p?.experience?.length || 0;
  // Prefer whichever source preserves more real work history. No entity rules.
  const best =
    expCount(fromText) > expCount(fromProvided)
      ? fromText
      : fromProvided || fromText;
  return best || candidate;
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
    if (best && bestSim >= threshold) {
      best.used = true;
      out.push(best.text); // reworded, but proven to be this source bullet
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

function guardSummary(source: ResumeProfile, headline: string): string {
  const original = clean(source.summary, 900);
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

  // Experience: language-invariant identity (company, location, dates) ALWAYS
  // from the source. In translated mode the title and bullets come from the
  // model (positionally bound) so the output is actually in the target
  // language; in same-language mode bullets are re-homed by token overlap.
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
      title: clean(translated ? m?.title || job.title : job.title, 140),
      company: clean(job.company, 160),
      location: clean(job.location, 160),
      dates: clean(job.dates, 90),
      bullets: translated
        ? homeBulletsPositional(job.bullets || [], m?.bullets || [], opts)
        : homeBullets(job.bullets || [], pool, opts),
    };
  });

  // Projects: names from the source, bullets re-homed the same way.
  const modelProj = candidate.projects || [];
  const projects = (src.projects || []).map((project, i) => ({
    name: clean(project.name, 160),
    bullets: translated
      ? homeBulletsPositional(project.bullets || [], modelProj[i]?.bullets || [], opts)
      : homeBullets(project.bullets || [], pool, opts),
  }));

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
    skills = dedupe(modelSkills.length ? modelSkills : sourceSkills, (v) => norm(v)).slice(0, cap);
  } else {
    const candidateSkills = modelSkills.filter((v) => v && isEvidenced(v, ev));
    skills = dedupe([...sourceSkills, ...candidateSkills], (v) => norm(v))
      .map((skill) => ({ skill, score: relevance(skill, jd, target) }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.skill)
      .slice(0, 30);
  }

  const headline = translated
    ? clean(candidate.basics?.headline || src.basics?.headline, 120)
    : guardHeadline(src, ev, opts);
  const summary = translated
    ? clean(candidate.summary || src.summary, 900)
    : guardSummary(src, headline);

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
          location: clean(e.location, 160),
          dates: clean(e.dates, 80),
        })),
        (e) => `${norm(e.degree)}|${norm(e.institution)}|${norm(e.dates)}`,
      ).slice(0, 8),
      languages: dedupe(
        (src.languages || []).map((l) => clean(l, 80)).filter(Boolean),
        (l) => norm(l).split(/[-:]/)[0],
      ).slice(0, 6),
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
