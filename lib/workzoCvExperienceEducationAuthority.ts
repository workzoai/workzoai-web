import type {
  ResumeEducation,
  ResumeExperience,
  ResumeProfile,
} from "./workzoResumeParser";

function clean(value: unknown, max = 500): string {
  return String(value ?? "")
    .replace(/\u0000/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function key(value: unknown): string {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(?:present|current|now|ongoing|heute|aktuell)\b/g, "present")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function cleanBullets(values: string[] | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values || []) {
    const value = clean(raw, 700).replace(/^[-•*]\s*/, "");
    const k = key(value);
    if (!value || !k || seen.has(k)) continue;
    seen.add(k);
    out.push(value);
  }
  return out;
}

function cleanExperience(row: ResumeExperience): ResumeExperience {
  return {
    title: clean(row?.title, 180),
    company: clean(row?.company, 200),
    location: clean(row?.location, 180),
    dates: clean(row?.dates, 100),
    bullets: cleanBullets(row?.bullets),
  };
}

function cleanEducation(row: ResumeEducation): ResumeEducation {
  return {
    degree: clean(row?.degree, 220),
    institution: clean(row?.institution, 220),
    location: clean(row?.location, 180),
    dates: clean(row?.dates, 100),
  };
}

/**
 * Employment rows are duplicates only when all factual identity fields match.
 * Missing fields are never treated as wildcards, because that silently merged
 * promotions and neighbouring jobs in multi-column CVs.
 */
function experienceIdentity(row: ResumeExperience): string {
  const title = key(row.title);
  const company = key(row.company);
  const dates = key(row.dates);
  return title && company && dates ? `${title}|${company}|${dates}` : "";
}

/** Education rows are duplicates only when degree, institution, and dates match. */
function educationIdentity(row: ResumeEducation): string {
  const degree = key(row.degree);
  const institution = key(row.institution);
  const dates = key(row.dates);
  return degree && institution && dates ? `${degree}|${institution}|${dates}` : "";
}

export function exactDedupeExperience(rows: ResumeExperience[] = []): ResumeExperience[] {
  const out: ResumeExperience[] = [];
  const exact = new Map<string, number>();

  for (const source of rows || []) {
    const row = cleanExperience(source);
    if (!row.title && !row.company && !row.dates && !(row.bullets || []).length) continue;
    const identity = experienceIdentity(row);
    if (!identity) {
      // Sparse rows are preserved. A later review screen can ask for missing
      // fields, but the parser must never delete potentially real employment.
      out.push(row);
      continue;
    }
    const existingIndex = exact.get(identity);
    if (existingIndex === undefined) {
      exact.set(identity, out.length);
      out.push(row);
      continue;
    }
    const existing = out[existingIndex];
    existing.location ||= row.location;
    existing.bullets = cleanBullets([...(existing.bullets || []), ...(row.bullets || [])]);
  }
  return out;
}

export function exactDedupeEducation(rows: ResumeEducation[] = []): ResumeEducation[] {
  const out: ResumeEducation[] = [];
  const exact = new Map<string, number>();

  for (const source of rows || []) {
    const row = cleanEducation(source);
    if (!row.degree && !row.institution && !row.dates) continue;
    const identity = educationIdentity(row);
    if (!identity) {
      out.push(row);
      continue;
    }
    const existingIndex = exact.get(identity);
    if (existingIndex === undefined) {
      exact.set(identity, out.length);
      out.push(row);
      continue;
    }
    const existing = out[existingIndex];
    existing.location ||= row.location;
  }
  return out;
}

function experienceMatchScore(a: ResumeExperience, b: ResumeExperience): number {
  const sameTitle = !!key(a.title) && key(a.title) === key(b.title);
  const sameCompany = !!key(a.company) && key(a.company) === key(b.company);
  const sameDates = !!key(a.dates) && key(a.dates) === key(b.dates);
  return Number(sameTitle) + Number(sameCompany) + Number(sameDates);
}

function educationMatchScore(a: ResumeEducation, b: ResumeEducation): number {
  const sameDegree = !!key(a.degree) && key(a.degree) === key(b.degree);
  const sameInstitution = !!key(a.institution) && key(a.institution) === key(b.institution);
  const sameDates = !!key(a.dates) && key(a.dates) === key(b.dates);
  return Number(sameDegree) + Number(sameInstitution) + Number(sameDates);
}

/**
 * Parser rows own the employment timeline. Later stages may only enrich fields
 * that were empty; they cannot remove, reorder, or replace factual values.
 */
export function buildAuthoritativeExperience(
  parserRows: ResumeExperience[] = [],
  guardedRows: ResumeExperience[] = [],
  finalizedRows: ResumeExperience[] = [],
): ResumeExperience[] {
  const primary = parserRows.length ? exactDedupeExperience(parserRows) : exactDedupeExperience(guardedRows.length ? guardedRows : finalizedRows);
  const enrichers = [...exactDedupeExperience(guardedRows), ...exactDedupeExperience(finalizedRows)];

  return primary.map((source) => {
    const row = { ...source, bullets: [...(source.bullets || [])] };
    const candidates = enrichers
      .map((candidate) => ({ candidate, score: experienceMatchScore(row, candidate) }))
      .filter(({ score }) => score >= 2)
      .sort((a, b) => b.score - a.score);
    const match = candidates[0]?.candidate;
    if (!match) return row;
    return {
      title: row.title || match.title,
      company: row.company || match.company,
      location: row.location || match.location,
      dates: row.dates || match.dates,
      bullets: cleanBullets([...(row.bullets || []), ...(match.bullets || [])]),
    };
  });
}

/** Parser education owns degree/institution/date facts; later stages fill gaps only. */
export function buildAuthoritativeEducation(
  parserRows: ResumeEducation[] = [],
  guardedRows: ResumeEducation[] = [],
  finalizedRows: ResumeEducation[] = [],
): ResumeEducation[] {
  const primary = parserRows.length ? exactDedupeEducation(parserRows) : exactDedupeEducation(guardedRows.length ? guardedRows : finalizedRows);
  const enrichers = [...exactDedupeEducation(guardedRows), ...exactDedupeEducation(finalizedRows)];

  return primary.map((source) => {
    const candidates = enrichers
      .map((candidate) => ({ candidate, score: educationMatchScore(source, candidate) }))
      .filter(({ score }) => score >= 2)
      .sort((a, b) => b.score - a.score);
    const match = candidates[0]?.candidate;
    if (!match) return source;
    return {
      degree: source.degree || match.degree,
      institution: source.institution || match.institution,
      location: source.location || match.location,
      dates: source.dates || match.dates,
    };
  });
}

export function lockExperienceAndEducation(
  parserProfile: ResumeProfile,
  guardedProfile: ResumeProfile,
  finalizedProfile: ResumeProfile,
): Pick<ResumeProfile, "experience" | "education"> {
  return {
    experience: buildAuthoritativeExperience(
      parserProfile.experience || [],
      guardedProfile.experience || [],
      finalizedProfile.experience || [],
    ),
    education: buildAuthoritativeEducation(
      parserProfile.education || [],
      guardedProfile.education || [],
      finalizedProfile.education || [],
    ),
  };
}
