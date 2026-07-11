/**
 * workzoLinkedInParser.ts
 *
 * Turns a pasted LinkedIn profile into a structured `LinkedInProfile`.
 *
 * DESIGN
 * ------
 * Deterministic and dependency-free, like the free-tools engine. No LLM call.
 * A model asked to "extract the profile" will hallucinate a plausible job title
 * when the paste is messy, and a hallucinated title in a *consistency checker*
 * is worse than no checker at all: it invents the very mismatch the user is
 * paying us to detect. Parsing is a structural problem, so it gets a structural
 * solution.
 *
 * WHAT A LINKEDIN PASTE ACTUALLY LOOKS LIKE
 * -----------------------------------------
 * Copying a profile from the browser produces a predictable shape:
 *
 *   - Section headers on their own line: About, Experience, Education, Skills…
 *   - Every visible line is often duplicated, because LinkedIn renders one copy
 *     for sighted users and one for screen readers. We collapse consecutive
 *     identical lines rather than special-casing any particular field.
 *   - Each experience block is: title / company · employment-type / date range ·
 *     duration / location / bullets.
 *
 * We anchor on the DATE LINE, not on the title, because a date range is the one
 * line in a block we can identify with certainty from its own content. Title and
 * company are then read backwards from it. Anchoring on the title instead would
 * require knowing what job titles look like — the exact assumption that makes
 * these parsers brittle across languages and industries.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type LinkedInRole = {
  title: string;
  company: string;
  location: string;
  dates: string;
  bullets: string[];
};

export type LinkedInEducation = {
  institution: string;
  degree: string;
  dates: string;
};

export type LinkedInSource = "paste" | "pdf";

export type LinkedInProfile = {
  /** How this profile reached us. Changes what we are allowed to conclude. */
  source: LinkedInSource;
  /**
   * True when the skills list is the candidate's FULL set.
   *
   * A web paste carries every skill. LinkedIn's "Save to PDF" export carries
   * only the top featured skills — so a CV skill missing from the PDF proves
   * nothing, and the consistency engine must not report it as an omission.
   */
  skillsComplete: boolean;
  name: string;
  headline: string;
  about: string;
  experience: LinkedInRole[];
  education: LinkedInEducation[];
  skills: string[];
  certifications: string[];
  /** Signals for the Health Check (item 12). Parsed now, consumed later. */
  meta: {
    hasCustomUrl: boolean;
    vanityUrl: string;
    connections: number | null;
    hasFeatured: boolean;
    recommendationCount: number | null;
  };
  rawText: string;
};

// ── Section vocabulary ───────────────────────────────────────────────────────
//
// English + German, since WorkZo's interview flow already supports 15 languages
// and DACH is a live market. Add locales here, never in the block parser.

const SECTION_ALIASES: Record<string, string[]> = {
  about: ["about", "summary", "über mich", "uber mich", "info", "zusammenfassung"],
  experience: ["experience", "work experience", "berufserfahrung", "erfahrung"],
  education: ["education", "ausbildung", "bildung"],
  skills: ["skills", "top skills", "skills & endorsements", "kenntnisse", "fähigkeiten", "fahigkeiten"],
  certifications: [
    "licenses & certifications",
    "licenses and certifications",
    "certifications",
    "lizenzen und zertifikate",
    "zertifikate",
  ],
  featured: ["featured", "im fokus"],
  recommendations: ["recommendations", "empfehlungen"],
  activity: ["activity", "aktivitäten", "aktivitaten"],
  interests: ["interests", "interessen"],
  volunteering: ["volunteering", "volunteer experience", "ehrenamt"],
  languages: ["languages", "sprachen"],
  projects: ["projects", "projekte"],
  honors: ["honors & awards", "honors and awards", "auszeichnungen"],
};

const SECTION_LOOKUP = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(SECTION_ALIASES)) {
  for (const alias of aliases) SECTION_LOOKUP.set(alias, canonical);
}

function sectionOf(line: string): string | null {
  const key = line
    .toLowerCase()
    .replace(/[·|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[:：]$/, "");
  if (key.length > 40) return null;
  return SECTION_LOOKUP.get(key) ?? null;
}

// ── Date detection ───────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, januar: 0,
  feb: 1, february: 1, februar: 1,
  mar: 2, march: 2, mär: 2, maerz: 2, märz: 2,
  apr: 3, april: 3,
  may: 4, mai: 4,
  jun: 5, june: 5, juni: 5,
  jul: 6, july: 6, juli: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, okt: 9, oktober: 9,
  nov: 10, november: 10,
  dec: 11, december: 11, dez: 11, dezember: 11,
};

const PRESENT_RE = /\b(present|current|heute|aktuell|now|ongoing)\b/i;
const DASH = "[-–—]|\\bto\\b|\\bbis\\b";

/** Absolute month index, so two ranges can be compared arithmetically. */
export type MonthPoint = number | null;

export type DateRange = {
  start: MonthPoint;
  end: MonthPoint;
  present: boolean;
  /** Length in months, when both ends are known. */
  months: number | null;
  raw: string;
};

function monthPoint(token: string, year: number): number {
  const m = MONTHS[token.toLowerCase().replace(/\./g, "")];
  return year * 12 + (m ?? 0);
}

/**
 * Parse "Jan 2021 - Present · 3 yrs 5 mos", "01/2021 – 03/2023", "2019 - 2021".
 * Returns null when the line is not a date range at all — this is the signal the
 * block parser anchors on, so a false positive here corrupts a whole role.
 */
export function parseDateRange(input: string): DateRange | null {
  // Drop the duration tail. The web paste writes it after a middot
  // ("Jan 2021 - Present · 3 yrs 5 mos"); LinkedIn's own "Save to PDF" export
  // writes it in parentheses ("January 2021 - Present (4 years 6 months)").
  // The parenthetical is only stripped when it TRAILS the range, so a fully
  // parenthesised date "(2021 - 2023)" still parses.
  let raw = input.replace(/·.*$/, "").trim();
  // Strip a TRAILING parenthetical only when something precedes it, so
  // "(2014 - 2018)" — a fully parenthesised range — is not erased entirely.
  raw = raw.replace(/(?<=\S)\s*\([^)]*\)\s*$/, "").trim();
  // ...then unwrap that fully parenthesised form.
  const wrapped = raw.match(/^\((.*)\)$/);
  if (wrapped) raw = wrapped[1].trim();

  if (!raw) return null;

  const monthYear = `(${Object.keys(MONTHS).join("|")})\\.?\\s+((?:19|20)\\d{2})`;
  const numeric = `(\\d{1,2})[./](\\d{4})`;
  const yearOnly = `((?:19|20)\\d{2})`;

  const patterns: Array<{ re: RegExp; read: (m: RegExpMatchArray) => [number, number | null, boolean] }> = [
    {
      re: new RegExp(`^${monthYear}\\s*(?:${DASH})\\s*(?:${monthYear}|${PRESENT_RE.source})`, "i"),
      read: (m) => [
        monthPoint(m[1], Number(m[2])),
        m[3] ? monthPoint(m[3], Number(m[4])) : null,
        !m[3],
      ],
    },
    {
      re: new RegExp(`^${numeric}\\s*(?:${DASH})\\s*(?:${numeric}|${PRESENT_RE.source})`, "i"),
      read: (m) => [
        Number(m[2]) * 12 + (Number(m[1]) - 1),
        m[3] ? Number(m[4]) * 12 + (Number(m[3]) - 1) : null,
        !m[3],
      ],
    },
    {
      re: new RegExp(`^${yearOnly}\\s*(?:${DASH})\\s*(?:${yearOnly}|${PRESENT_RE.source})`, "i"),
      read: (m) => [Number(m[1]) * 12, m[2] ? Number(m[2]) * 12 + 11 : null, !m[2]],
    },
  ];

  for (const { re, read } of patterns) {
    const m = raw.match(re);
    if (!m) continue;
    const [start, end, present] = read(m);
    const resolvedEnd = present ? nowMonthPoint() : end;
    return {
      start,
      end: present ? null : end,
      present,
      months: resolvedEnd == null ? null : Math.max(0, resolvedEnd - start + 1),
      raw: input.trim(),
    };
  }
  return null;
}

function nowMonthPoint(): number {
  const d = new Date();
  return d.getFullYear() * 12 + d.getMonth();
}

// ── Line preparation ─────────────────────────────────────────────────────────

/**
 * LinkedIn's DOM renders most labels twice (visual + screen-reader copy), so a
 * naive paste yields "Technical Consultant\nTechnical Consultant". Collapsing
 * *consecutive* duplicates is safe: a real profile never has the same line twice
 * in a row, and it fixes every duplicated field at once instead of one at a
 * time.
 */
function prepareLines(text: string): string[] {
  const lines = text
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const out: string[] = [];
  for (const line of lines) {
    if (out.length && out[out.length - 1].toLowerCase() === line.toLowerCase()) continue;
    out.push(line);
  }
  return out;
}

function stripBullet(line: string): string {
  return line.replace(/^[•●▪◦*·\-–—]\s*/, "").trim();
}

function isBullet(line: string): boolean {
  return /^[•●▪◦*]\s+/.test(line) || (line.length > 60 && !parseDateRange(line));
}

/** "Acme GmbH · Full-time" → "Acme GmbH" */
function cleanCompany(line: string): string {
  return line.split("·")[0].replace(/\s+/g, " ").trim();
}

const EMPLOYMENT_TYPE_RE =
  /\b(full[- ]?time|part[- ]?time|freelance|self[- ]?employed|contract|internship|apprenticeship|permanent|temporary|vollzeit|teilzeit|praktikum)\b/i;

const LOCATION_RE =
  /\b(remote|hybrid|on[- ]?site|germany|deutschland|united states|united kingdom|india|europe)\b|,\s*[A-ZÄÖÜ][a-zäöü]+$/i;

// ── Block parsing ────────────────────────────────────────────────────────────

/**
 * Read experience blocks by anchoring on date lines and walking backwards.
 *
 * Backwards, not forwards, because the two lines immediately above a date range
 * are always (title, company) or just (company) — a fixed offset — whereas the
 * number of lines *before* a title is unbounded (section header, promotion
 * grouping, company logo alt-text).
 */
/**
 * How many lines directly above a date line belong to its block header.
 *
 * A block header is (title, company) or just (company) — never more than two —
 * and header lines are short and unbulleted. Counting them, instead of assuming
 * a fixed offset of 2, is what lets us find where the PREVIOUS block's bullets
 * actually end. Assuming the offset silently ate the last bullet of every role.
 */
function headerLineCount(lines: string[], dateIndex: number): number {
  let count = 0;
  for (let i = dateIndex - 1; i >= 0 && count < 2; i -= 1) {
    const line = lines[i];
    if (isBullet(line) || line.length > 70) break;
    count += 1;
  }
  return count;
}

function parseExperienceBlocks(lines: string[]): LinkedInRole[] {
  const roles: LinkedInRole[] = [];
  const dateIdx: number[] = [];
  lines.forEach((line, i) => {
    if (parseDateRange(line)) dateIdx.push(i);
  });

  dateIdx.forEach((di, n) => {
    const headerCount = headerLineCount(lines, di);
    const above = lines
      .slice(di - headerCount, di)
      .filter((l) => !EMPLOYMENT_TYPE_RE.test(l) || l.includes("·"));

    let company = "";
    let title = "";
    if (above.length >= 2) {
      company = cleanCompany(above[above.length - 1]);
      title = above[above.length - 2];
    } else if (above.length === 1) {
      title = above[0];
    }

    // The body runs to the start of the NEXT block's header, not to a guessed
    // offset before the next date line.
    const stop =
      n + 1 < dateIdx.length ? dateIdx[n + 1] - headerLineCount(lines, dateIdx[n + 1]) : lines.length;
    const body = lines.slice(di + 1, Math.max(di + 1, stop));

    let location = "";
    const bullets: string[] = [];
    for (const line of body) {
      if (!location && !isBullet(line) && LOCATION_RE.test(line) && line.length < 60) {
        location = line;
        continue;
      }
      const cleaned = stripBullet(line);
      if (cleaned.length >= 12) bullets.push(cleaned);
    }

    if (!title && !company) return;
    roles.push({ title, company, location, dates: lines[di], bullets: bullets.slice(0, 12) });
  });

  return roles;
}

function parseEducationBlocks(lines: string[]): LinkedInEducation[] {
  const out: LinkedInEducation[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const range = parseDateRange(lines[i]);
    if (!range) continue;
    const institution = i >= 2 ? lines[i - 2] : i >= 1 ? lines[i - 1] : "";
    const degree = i >= 2 ? lines[i - 1] : "";
    if (!institution && !degree) continue;
    out.push({ institution, degree, dates: lines[i] });
  }
  // No date line at all: treat the first two lines as institution/degree.
  if (!out.length && lines.length) {
    out.push({ institution: lines[0], degree: lines[1] || "", dates: "" });
  }
  return out;
}

function parseSkillLines(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    if (/^\d+\s+endorsement/i.test(line)) continue;
    if (/endorsed by/i.test(line)) continue;
    for (const part of line.split(/[•·|,]/)) {
      const skill = part.replace(/\s+/g, " ").trim();
      if (skill.length >= 2 && skill.length <= 60 && !/^\d+$/.test(skill)) out.push(skill);
    }
  }
  return Array.from(new Set(out));
}

// ── Meta signals ─────────────────────────────────────────────────────────────

function parseMeta(text: string, sections: Map<string, string[]>): LinkedInProfile["meta"] {
  const urlMatch = text.match(/linkedin\.com\/in\/([a-z0-9-]+)/i);
  const vanityUrl = urlMatch?.[1] ?? "";
  // LinkedIn's auto-generated slugs end in a hex-ish suffix ("jane-doe-3b41072a4").
  const isGenerated = /-[0-9a-f]{6,}$/i.test(vanityUrl) || /\d{5,}$/.test(vanityUrl);

  const connMatch = text.match(/([\d,.]+)\+?\s*(connections|kontakte)/i);
  const connections = connMatch ? Number(connMatch[1].replace(/[,.]/g, "")) : null;

  const recSection = sections.get("recommendations") ?? [];
  const recMatch = text.match(/(\d+)\s*(recommendations?|empfehlungen)/i);
  const recommendationCount = recMatch
    ? Number(recMatch[1])
    : recSection.length
      ? recSection.filter((l) => l.length > 40).length
      : null;

  return {
    hasCustomUrl: Boolean(vanityUrl) && !isGenerated,
    vanityUrl,
    connections,
    hasFeatured: sections.has("featured") && (sections.get("featured")?.length ?? 0) > 0,
    recommendationCount,
  };
}

// ── Entry point ──────────────────────────────────────────────────────────────

export function parseLinkedInProfile(text: string): LinkedInProfile {
  const rawText = String(text || "");
  const lines = prepareLines(rawText);

  const sections = new Map<string, string[]>();
  let current: string | null = null;
  const preamble: string[] = [];

  for (const line of lines) {
    const section = sectionOf(line);
    if (section) {
      current = section;
      if (!sections.has(section)) sections.set(section, []);
      continue;
    }
    if (current) sections.get(current)!.push(line);
    else preamble.push(line);
  }

  // The preamble is name / headline / location / connections, in that order.
  const name = preamble[0] ?? "";
  const headline = preamble.find(
    (l, i) => i > 0 && l.length >= 8 && !/connections|kontakte|followers/i.test(l) && !/^\d/.test(l),
  ) ?? "";

  const aboutLines = sections.get("about") ?? [];
  const experience = parseExperienceBlocks(sections.get("experience") ?? []);
  const education = parseEducationBlocks(sections.get("education") ?? []);
  const skills = parseSkillLines(sections.get("skills") ?? []);
  const certifications = parseSkillLines(sections.get("certifications") ?? []);

  return {
    source: "paste",
    skillsComplete: true,
    name,
    headline,
    about: aboutLines.join(" ").replace(/\s+/g, " ").trim(),
    experience,
    education,
    skills,
    certifications,
    meta: parseMeta(rawText, sections),
    rawText,
  };
}

// ── PDF import ───────────────────────────────────────────────────────────────

/**
 * Build a LinkedInProfile from the structured profile the vision extractor
 * returns for LinkedIn's own "Save to PDF" export.
 *
 * NO TEXT RE-PARSE. The vision model already read the rendered page and handed
 * back structure; flattening that back into text so `parseLinkedInProfile` can
 * re-derive it would reintroduce exactly the two-column corruption the vision
 * path exists to avoid. That is the same mistake `app/cv/page.tsx` was making.
 *
 * The export is lossy in one direction that matters: it carries only the
 * candidate's TOP featured skills, not all of them. `skillsComplete: false`
 * propagates that, and the consistency engine suppresses the
 * "skills missing on LinkedIn" finding accordingly. Reporting a skill as
 * missing when the export simply truncated it would be a fabricated finding.
 */
export function linkedInProfileFromResumeProfile(
  profile: {
    basics?: { name?: string; headline?: string; linkedin?: string };
    summary?: string;
    experience?: Array<{ title?: string; company?: string; location?: string; dates?: string; bullets?: string[] }>;
    education?: Array<{ degree?: string; institution?: string; dates?: string }>;
    skills?: string[];
    certifications?: string[];
    rawText?: string;
  },
  fileName = "",
): LinkedInProfile {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const vanityUrl = str(profile.basics?.linkedin).match(/linkedin\.com\/in\/([a-z0-9-]+)/i)?.[1] ?? "";
  const isGenerated = /-[0-9a-f]{6,}$/i.test(vanityUrl) || /\d{5,}$/.test(vanityUrl);

  return {
    source: "pdf",
    skillsComplete: false,
    name: str(profile.basics?.name),
    headline: str(profile.basics?.headline),
    about: str(profile.summary),
    experience: (profile.experience ?? []).map((e) => ({
      title: str(e.title),
      company: str(e.company),
      location: str(e.location),
      dates: str(e.dates),
      bullets: Array.isArray(e.bullets) ? e.bullets.map(str).filter(Boolean) : [],
    })),
    education: (profile.education ?? []).map((e) => ({
      institution: str(e.institution),
      degree: str(e.degree),
      dates: str(e.dates),
    })),
    skills: Array.isArray(profile.skills) ? profile.skills.map(str).filter(Boolean) : [],
    certifications: Array.isArray(profile.certifications) ? profile.certifications.map(str).filter(Boolean) : [],
    // The PDF export strips connections, custom URL, featured section and
    // recommendations entirely. Item 12's health check can never run on it.
    meta: {
      hasCustomUrl: Boolean(vanityUrl) && !isGenerated,
      vanityUrl,
      connections: null,
      hasFeatured: false,
      recommendationCount: null,
    },
    rawText: str(profile.rawText) || fileName,
  };
}

/**
 * Validate a LinkedInProfile that arrived over the wire.
 *
 * The PDF import runs client-side-to-server once, then the parsed profile is
 * held in React state and posted back to /analyze and /rewrite. That means it
 * is caller-supplied, so it gets the same treatment as any caller-supplied
 * profile: shape-checked, and never trusted for anything that constrains the
 * model. (See `jdMatch.unevidenced` in the rewrite route: the forbidden-keyword
 * list is derived from the CV, not from this.)
 */
export function coerceLinkedInProfile(value: unknown): LinkedInProfile | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Partial<LinkedInProfile>;
  if (typeof p.name !== "string" && typeof p.headline !== "string") return null;

  const experience = Array.isArray(p.experience) ? p.experience : [];
  const skills = Array.isArray(p.skills) ? p.skills.filter((s) => typeof s === "string") : [];
  if (!experience.length && !skills.length) return null;

  return {
    source: p.source === "pdf" ? "pdf" : "paste",
    skillsComplete: p.source === "pdf" ? false : p.skillsComplete !== false,
    name: String(p.name ?? ""),
    headline: String(p.headline ?? ""),
    about: String(p.about ?? ""),
    experience: experience.map((e) => ({
      title: String(e?.title ?? ""),
      company: String(e?.company ?? ""),
      location: String(e?.location ?? ""),
      dates: String(e?.dates ?? ""),
      bullets: Array.isArray(e?.bullets) ? e.bullets.map((b) => String(b)) : [],
    })),
    education: (Array.isArray(p.education) ? p.education : []).map((e) => ({
      institution: String(e?.institution ?? ""),
      degree: String(e?.degree ?? ""),
      dates: String(e?.dates ?? ""),
    })),
    skills,
    certifications: Array.isArray(p.certifications)
      ? p.certifications.filter((c) => typeof c === "string")
      : [],
    meta: {
      hasCustomUrl: Boolean(p.meta?.hasCustomUrl),
      vanityUrl: String(p.meta?.vanityUrl ?? ""),
      connections: typeof p.meta?.connections === "number" ? p.meta.connections : null,
      hasFeatured: Boolean(p.meta?.hasFeatured),
      recommendationCount:
        typeof p.meta?.recommendationCount === "number" ? p.meta.recommendationCount : null,
    },
    rawText: String(p.rawText ?? ""),
  };
}
