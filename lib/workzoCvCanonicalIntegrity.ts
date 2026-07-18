import type {
  ResumeEducation,
  ResumeExperience,
  ResumeProfile,
  ResumeProject,
} from "@/lib/workzoResumeParser";

export type CvIntegrityRepairReport = {
  profile: ResumeProfile;
  warnings: string[];
  counts: {
    experienceBefore: number;
    experienceAfter: number;
    projectBulletsRemoved: number;
    experienceBulletsRemoved: number;
    languagesBefore: number;
    languagesAfter: number;
    skillsBefore: number;
    skillsAfter: number;
  };
};

const SECTION_RE = /^(?:about|profile|professional\s+summary|summary|objective|contact|experience|professional\s+experience|work\s+experience|employment\s+history|education|skills|core\s+skills|expertise|projects?|certifications?|languages?|references?|interests?|hobbies?|portfolio|berufserfahrung|ausbildung|bildung|kenntnisse|fähigkeiten|sprachen|projekte|kontakt|profil)$/i;
const CONTACT_RE = /(?:[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|https?:\/\/|www\.|linkedin|github)/i;
const STREET_RE = /\b(?:street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|drive|dr\.?|boulevard|blvd\.?|way|weg|straße|strasse|str\.?|platz|gasse|allee|ring|rue|via|calle|rua)\b/i;
const POSTAL_RE = /\b\d{4,6}\b/;
const DATE_RE = /\b(?:19|20)\d{2}\b|\bpresent\b|\bcurrent\b|\bheute\b|\baktuell\b/i;

function text(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/\u0000/g, " ").replace(/\s+/g, " ").trim()
    : "";
}

function key(value: unknown): string {
  return text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(value: unknown): string {
  return key(value).replace(/\s+/g, "");
}

function tokens(value: unknown): Set<string> {
  return new Set(key(value).split(" ").filter((token) => token.length > 1));
}

function similarity(a: unknown, b: unknown): number {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let overlap = 0;
  for (const token of A) if (B.has(token)) overlap += 1;
  return overlap / (A.size + B.size - overlap);
}

function dedupeSentences(values: unknown[]): { values: string[]; removed: number } {
  const out: string[] = [];
  let removed = 0;
  for (const raw of values) {
    const value = text(raw).replace(/^[-•*]\s*/, "");
    if (!value) continue;
    const normalized = key(value);
    const duplicate = out.some((existing) => {
      const existingKey = key(existing);
      if (existingKey === normalized) return true;
      if (normalized.length >= 28 && existingKey.includes(normalized)) return true;
      if (existingKey.length >= 28 && normalized.includes(existingKey)) return true;
      return similarity(existing, value) >= 0.9;
    });
    if (duplicate) {
      removed += 1;
      continue;
    }
    out.push(value);
  }
  return { values: out, removed };
}

function dedupeExperienceBulletsExactly(values: unknown[]): { values: string[]; removed: number } {
  const out: string[] = [];
  const seen = new Set<string>();
  let removed = 0;
  for (const raw of values) {
    const value = text(raw).replace(/^[-•*]\s*/, "");
    if (!value) continue;
    const normalized = key(value);
    if (seen.has(normalized)) {
      removed += 1;
      continue;
    }
    seen.add(normalized);
    out.push(value);
  }
  return { values: out, removed };
}

function stripHeadlineBleed(value: unknown): string {
  let headline = text(value);
  if (!headline) return "";

  const contactIndex = headline.search(CONTACT_RE);
  if (contactIndex > 0) headline = headline.slice(0, contactIndex).trim();

  const postalIndex = headline.search(/\s+\d{4,6}\b/);
  if (postalIndex > 0) {
    const tail = headline.slice(Math.max(0, postalIndex - 45));
    if (STREET_RE.test(tail) || /\b[\p{L}.'’-]{2,}\s+\d{1,5}[A-Za-z]?\s*[,|·-]?\s*$/u.test(headline.slice(0, postalIndex))) {
      headline = headline
        .slice(0, postalIndex)
        .replace(/\s+[\p{L}.'’-]{2,}\s+\d{1,5}[A-Za-z]?\s*[,|·-]?$/u, "")
        .trim();
    }
  }


  return headline.replace(/[|,;:·-]+$/g, "").replace(/\s{2,}/g, " ").trim();
}

function looksLikeIdentityEcho(value: unknown, profile: ResumeProfile): boolean {
  const candidate = compact(profile.basics?.name);
  const current = compact(value);
  if (!current) return true;
  if (candidate.length >= 5 && current === candidate) return true;
  if (SECTION_RE.test(text(value))) return true;
  return false;
}

function exactExperienceIdentity(entry: ResumeExperience): string {
  const title = key(entry.title);
  const company = key(entry.company);
  const dates = key(entry.dates);
  // Never deduplicate incomplete employment rows. A missing field can be a
  // legitimate consequence of a multi-column PDF, and merging it here is
  // destructive. Exact identity requires all three core fields.
  return title && company && dates ? `${title}::${company}::${dates}` : "";
}

function mergeExactExperience(a: ResumeExperience, b: ResumeExperience): ResumeExperience {
  const bullets = dedupeSentences([...(a.bullets || []), ...(b.bullets || [])]).values;
  return {
    title: text(a.title) || text(b.title),
    company: text(a.company) || text(b.company),
    location: text(a.location) || text(b.location),
    dates: text(a.dates) || text(b.dates),
    bullets,
  };
}

function normalizeExperience(profile: ResumeProfile): { values: ResumeExperience[]; removedBullets: number; removedRows: number } {
  const out: ResumeExperience[] = [];
  const exactIndex = new Map<string, number>();
  let removedBullets = 0;
  let removedRows = 0;

  for (const source of profile.experience || []) {
    const title = text(source.title);
    const company = text(source.company);
    const dates = text(source.dates);
    const cleaned = dedupeExperienceBulletsExactly(source.bullets || []);
    removedBullets += cleaned.removed;

    // Timeline rows are factual source records. Do not remove them because a
    // title resembles a section label, the candidate name, or another row.
    // Flattened/multi-column PDFs routinely create sparse-but-valid rows. Only
    // discard a row when it contains no information at all.
    if (!title && !company && !dates && !cleaned.values.length) {
      removedRows += 1;
      continue;
    }

    const entry: ResumeExperience = {
      title,
      company,
      location: text(source.location),
      dates,
      bullets: cleaned.values,
    };

    // Merge only a fully-identical employment identity. Missing title, company
    // or dates never qualifies because it may be a separate flattened fragment.
    const identity = exactExperienceIdentity(entry);
    if (identity && exactIndex.has(identity)) {
      const index = exactIndex.get(identity)!;
      out[index] = mergeExactExperience(out[index], entry);
      removedRows += 1;
      continue;
    }

    if (identity) exactIndex.set(identity, out.length);
    out.push(entry);
  }

  return { values: out, removedBullets, removedRows };
}

function normalizeProjects(profile: ResumeProfile): { values: ResumeProject[]; removedBullets: number } {
  const out: ResumeProject[] = [];
  let removedBullets = 0;

  for (const source of profile.projects || []) {
    const name = text(source.name);
    if (!name || SECTION_RE.test(name) || looksLikeIdentityEcho(name, profile)) continue;
    const cleaned = dedupeSentences(source.bullets || []);
    removedBullets += cleaned.removed;

    const existing = out.find((project) => key(project.name) === key(name) || similarity(project.name, name) >= 0.94);
    if (existing) {
      const merged = dedupeSentences([...(existing.bullets || []), ...cleaned.values]);
      removedBullets += merged.removed;
      existing.bullets = merged.values;
    } else {
      out.push({ name, bullets: cleaned.values });
    }
  }

  return { values: out, removedBullets };
}

function languageKey(value: unknown): string {
  const base = text(value).split(/[(\-–—:,·|/]/)[0];
  return key(base).replace(/\s+/g, "");
}

function normalizeLanguages(values: unknown[]): string[] {
  const selected = new Map<string, string>();
  for (const raw of values) {
    const value = text(raw);
    const k = languageKey(value);
    if (!k || SECTION_RE.test(value)) continue;
    const previous = selected.get(k);
    if (!previous || value.length > previous.length) selected.set(k, value);
  }
  return [...selected.values()];
}

function acronym(value: string): string {
  return key(value)
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("");
}

function normalizeSkills(values: unknown[]): string[] {
  const out: string[] = [];
  for (const raw of values) {
    const value = text(raw).replace(/^[-•*]\s*/, "");
    if (!value || value.length > 80 || SECTION_RE.test(value)) continue;
    const k = compact(value);
    const paren = value.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    const duplicateIndex = out.findIndex((existing) => {
      if (compact(existing) === k) return true;
      const eParen = existing.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
      if (paren && compact(paren[1]) === compact(existing)) return true;
      if (eParen && compact(eParen[1]) === k) return true;
      if (paren && compact(paren[2]) === compact(existing)) return true;
      if (eParen && compact(eParen[2]) === k) return true;
      return acronym(existing) === k || acronym(value) === compact(existing);
    });
    if (duplicateIndex < 0) out.push(value);
    else if (value.length > out[duplicateIndex].length) out[duplicateIndex] = value;
  }
  return out;
}

function normalizeEducation(values: ResumeEducation[]): ResumeEducation[] {
  const out: ResumeEducation[] = [];
  const exact = new Set<string>();

  for (const source of values || []) {
    const entry: ResumeEducation = {
      degree: text(source.degree),
      institution: text(source.institution),
      location: text(source.location),
      dates: text(source.dates),
    };
    if (!entry.degree && !entry.institution && !entry.dates) continue;

    // Education rows are deduplicated only when degree, institution and dates
    // are all present and exactly equal after harmless normalization. Sparse
    // rows are preserved because they may be the other half of a flattened
    // multi-column record and must not be silently discarded.
    const degree = key(entry.degree);
    const institution = key(entry.institution);
    const dates = key(entry.dates);
    const identity = degree && institution && dates
      ? `${degree}::${institution}::${dates}`
      : "";

    if (identity && exact.has(identity)) continue;
    if (identity) exact.add(identity);
    out.push(entry);
  }
  return out;
}

export function canonicalizeResumeProfileIntegrity(
  input: ResumeProfile,
  rawText = "",
): CvIntegrityRepairReport {
  const profile: ResumeProfile = {
    ...input,
    basics: { ...(input.basics || {}) },
    experience: [...(input.experience || [])],
    education: [...(input.education || [])],
    projects: [...(input.projects || [])],
    skills: [...(input.skills || [])],
    languages: [...(input.languages || [])],
    certifications: [...(input.certifications || [])],
    warnings: [...(input.warnings || [])],
  };

  const warnings: string[] = [];
  const originalHeadline = text(profile.basics?.headline);
  const cleanHeadline = stripHeadlineBleed(originalHeadline);
  if (cleanHeadline !== originalHeadline) warnings.push("headline_contact_bleed_removed");
  if (cleanHeadline && !SECTION_RE.test(cleanHeadline)) profile.basics.headline = cleanHeadline;

  const experienceBefore = profile.experience.length;
  const experience = normalizeExperience(profile);
  profile.experience = experience.values;
  if (experience.removedRows) warnings.push("exact_duplicate_or_empty_experience_removed");

  const projects = normalizeProjects(profile);
  profile.projects = projects.values;
  if (projects.removedBullets) warnings.push("duplicate_project_bullets_removed");
  if (experience.removedBullets) warnings.push("duplicate_experience_bullets_removed");

  profile.education = normalizeEducation(profile.education || []);

  const languagesBefore = profile.languages.length;
  profile.languages = normalizeLanguages(profile.languages || []);
  if (profile.languages.length < languagesBefore) warnings.push("duplicate_languages_merged");

  const skillsBefore = profile.skills.length;
  profile.skills = normalizeSkills(profile.skills || []);
  if (profile.skills.length < skillsBefore) warnings.push("duplicate_skills_merged");

  profile.warnings = [...new Set([...(profile.warnings || []), ...warnings])];

  return {
    profile,
    warnings,
    counts: {
      experienceBefore,
      experienceAfter: profile.experience.length,
      projectBulletsRemoved: projects.removedBullets,
      experienceBulletsRemoved: experience.removedBullets,
      languagesBefore,
      languagesAfter: profile.languages.length,
      skillsBefore,
      skillsAfter: profile.skills.length,
    },
  };
}

export const __workzoCvCanonicalIntegrityVersion = "3.0.0";
