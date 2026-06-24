/**
 * lib/cvProfileMerge.ts
 *
 * Global CV profile merge / protection layer.
 *
 * Rules:
 * - Never overwrite a previously valid field with an empty/corrupted value.
 * - Identity fields (name, email, phone, location, linkedin, fileName) are sticky
 *   once set — they only change if the new value is clearly non-empty and valid.
 * - Arrays (experience, education, projects, skills, languages, certifications)
 *   fall back to the previous array if the new one is empty.
 * - Corrupted / placeholder / hallucinated values are rejected before merge.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type CvBasics = {
  name?: string;
  headline?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  [key: string]: unknown;
};

export type CvProfile = {
  basics?: CvBasics;
  name?: string;           // some parsers surface name at the top level
  summary?: string;
  experience?: unknown[];
  education?: unknown[];
  projects?: unknown[];
  skills?: unknown[];
  languages?: unknown[];
  certifications?: unknown[];
  fileName?: string;
  warnings?: string[];
  [key: string]: unknown;
};

export type MergeCvProfileInput = {
  previousProfile?: CvProfile | null;
  parsedProfile?: CvProfile | null;
  requestBody?: Record<string, unknown> | null;
  rawText?: string;
  fileName?: string;
};

export type MergeLogEntry = {
  field: string;
  keptPrevious: boolean;
  rejectedValue?: unknown;
  finalValue: unknown;
};

// ─── Guards ──────────────────────────────────────────────────────────────────

const CORRUPTED_NAME_WORDS = [
  "profile",
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "magist",
  "resume",
  "curriculum",
  "vitae",
  "overview",
  "objective",
  "references",
  "contact",
  "details",
];

const PLACEHOLDER_STRINGS = [
  "(no fileName in request body)",
  "undefined",
  "null",
  "n/a",
  "none",
  "[object object]",
];

/**
 * Returns true if a string value is meaningful (non-empty, non-corrupted).
 */
export function isMeaningfulString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (PLACEHOLDER_STRINGS.some((p) => lower.includes(p))) return false;
  if (lower.includes("undefined") || lower.includes("null ")) return false;
  return true;
}

/**
 * Returns true if the string is a valid candidate name.
 * Rejects section headings, corrupted merges, and placeholder text.
 */
export function isValidCandidateName(value: unknown): value is string {
  if (!isMeaningfulString(value)) return false;
  const trimmed = (value as string).trim();
  const lower = trimmed.toLowerCase();

  // Reject corrupted heading words
  if (CORRUPTED_NAME_WORDS.some((word) => lower.includes(word))) return false;

  // Reject names that are ALL CAPS acronyms / single tokens that look like headings
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;           // need at least first + last
  if (words.length > 6) return false;           // too many words → likely merged text

  // Reject if every character is uppercase (looks like SECTION HEADING)
  if (trimmed === trimmed.toUpperCase() && trimmed.length > 8) return false;

  return true;
}

/**
 * Returns true if the array is non-empty.
 */
function isMeaningfulArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Prefer newValue if meaningful; otherwise keep oldValue.
 */
function preferNewValid<T>(newValue: T, oldValue: T): { value: T; keptPrevious: boolean } {
  if (typeof newValue === "string") {
    return isMeaningfulString(newValue)
      ? { value: newValue, keptPrevious: false }
      : { value: oldValue, keptPrevious: true };
  }
  if (Array.isArray(newValue)) {
    return isMeaningfulArray(newValue)
      ? { value: newValue, keptPrevious: false }
      : { value: oldValue, keptPrevious: true };
  }
  // For other types: accept if truthy
  return newValue != null && newValue !== ""
    ? { value: newValue, keptPrevious: false }
    : { value: oldValue, keptPrevious: true };
}

// ─── Affinda rejection rules ─────────────────────────────────────────────────

export type ParserCandidate = {
  resumeProfile: CvProfile | null | undefined;
  ok: boolean;
  score: number;
};

/**
 * Returns true if the Affinda result should be rejected in favour of the AI parser.
 * Matches the spec requirements:
 *   - exp=0 AND edu=0
 *   - missing / corrupted candidate name
 *   - skills > 30 AND experience = 0
 */
export function shouldRejectAffinda(profile: CvProfile | null | undefined): boolean {
  if (!profile) return true;

  const exp = Array.isArray(profile.experience) ? profile.experience.length : 0;
  const edu = Array.isArray(profile.education) ? profile.education.length : 0;
  const skills = Array.isArray(profile.skills) ? profile.skills.length : 0;
  const name = profile.basics?.name ?? profile.name ?? "";

  if (exp === 0 && edu === 0) return true;
  if (!isValidCandidateName(name)) return true;
  if (skills > 30 && exp === 0) return true;

  return false;
}

// ─── Core merge ──────────────────────────────────────────────────────────────

/**
 * Merge parsed profile data while protecting all previously-valid fields.
 *
 * Priority for each scalar field:
 *   parsedProfile > requestBody > previousProfile
 *
 * Arrays fall back to previousProfile if the parsed array is empty.
 */
export function mergeCvProfile(input: MergeCvProfileInput): CvProfile {
  const { previousProfile, parsedProfile, requestBody, rawText, fileName } = input;

  const prev = previousProfile ?? {};
  const parsed = parsedProfile ?? {};
  const body = requestBody ?? {};

  const prevBasics = (prev.basics ?? {}) as CvBasics;
  const parsedBasics = (parsed.basics ?? {}) as CvBasics;

  const log: MergeLogEntry[] = [];

  function mergeField<T>(
    field: string,
    candidates: T[],
    validator: (v: unknown) => boolean = isMeaningfulString,
  ): T {
    for (const candidate of candidates) {
      if (validator(candidate)) {
        const isFirst = candidates[0] === candidate;
        log.push({ field, keptPrevious: !isFirst, finalValue: candidate });
        return candidate;
      }
    }
    // Nothing valid — return last candidate (empty/default) so field is always defined
    const fallback = candidates[candidates.length - 1];
    log.push({ field, keptPrevious: true, rejectedValue: candidates[0], finalValue: fallback });
    return fallback;
  }

  function mergeArray(field: string, ...arrays: (unknown[] | undefined | null)[]): unknown[] {
    for (const arr of arrays) {
      if (isMeaningfulArray(arr)) {
        log.push({ field, keptPrevious: false, finalValue: `[${arr.length} items]` });
        return arr;
      }
    }
    log.push({ field, keptPrevious: true, finalValue: "[]" });
    return [];
  }

  // ── Name (strictest validator) ──────────────────────────────────────────────
  const name = mergeField<string>(
    "basics.name",
    [
      parsedBasics.name as string,
      parsed.name as string,
      body.candidateName as string,
      (body.existingProfile as CvProfile)?.basics?.name as string,
      (body.existingProfile as CvProfile)?.name as string,
      prevBasics.name as string,
      prev.name as string,
      "",
    ],
    isValidCandidateName,
  );

  // ── Scalar identity fields ──────────────────────────────────────────────────
  const email = mergeField<string>("basics.email", [
    parsedBasics.email as string,
    (body.existingProfile as CvProfile)?.basics?.email as string,
    prevBasics.email as string,
    "",
  ]);

  const phone = mergeField<string>("basics.phone", [
    parsedBasics.phone as string,
    (body.existingProfile as CvProfile)?.basics?.phone as string,
    prevBasics.phone as string,
    "",
  ]);

  const location = mergeField<string>("basics.location", [
    parsedBasics.location as string,
    (body.existingProfile as CvProfile)?.basics?.location as string,
    prevBasics.location as string,
    "",
  ]);

  const linkedin = mergeField<string>("basics.linkedin", [
    parsedBasics.linkedin as string,
    (body.existingProfile as CvProfile)?.basics?.linkedin as string,
    prevBasics.linkedin as string,
    "",
  ]);

  const headline = mergeField<string>("basics.headline", [
    parsedBasics.headline as string,
    (body.existingProfile as CvProfile)?.basics?.headline as string,
    prevBasics.headline as string,
    "",
  ]);

  const summary = mergeField<string>("summary", [
    parsed.summary as string,
    prev.summary as string,
    "",
  ]);

  // ── fileName — special placeholder guard ────────────────────────────────────
  const resolvedFileName = mergeField<string>(
    "fileName",
    [
      fileName as string,
      parsed.fileName as string,
      body.fileName as string,
      (body.existingProfile as CvProfile)?.fileName as string,
      prev.fileName as string,
      "",
    ],
    isMeaningfulString,
  );

  // ── Arrays ──────────────────────────────────────────────────────────────────
  const experience = mergeArray(
    "experience",
    parsed.experience,
    prev.experience,
  );

  const education = mergeArray(
    "education",
    parsed.education,
    prev.education,
  );

  const projects = mergeArray(
    "projects",
    parsed.projects,
    prev.projects,
  );

  const skills = mergeArray(
    "skills",
    parsed.skills,
    prev.skills,
  );

  const languages = mergeArray(
    "languages",
    parsed.languages,
    prev.languages,
  );

  const certifications = mergeArray(
    "certifications",
    parsed.certifications,
    prev.certifications,
  );

  // ── Log merge result ────────────────────────────────────────────────────────
  const nameEntry = log.find((e) => e.field === "basics.name");
  const fileNameEntry = log.find((e) => e.field === "fileName");

  console.info("[WorkZo CV Pipeline] profile.merge.result", {
    keptPreviousName: nameEntry?.keptPrevious ?? false,
    rejectedParsedName:
      nameEntry?.keptPrevious && parsedBasics.name ? parsedBasics.name : undefined,
    finalName: name,
    finalFileName: resolvedFileName,
    source: (parsed as Record<string, unknown>).source ?? "unknown",
    fieldsKeptFromPrevious: log.filter((e) => e.field !== "basics.name" && e.keptPrevious).map((e) => e.field),
  });

  // ── Assemble final profile ──────────────────────────────────────────────────
  const finalProfile: CvProfile = {
    // Spread parsed profile first for any extra fields we don't explicitly handle
    ...prev,
    ...parsed,
    basics: {
      ...prevBasics,
      ...parsedBasics,
      name,
      email,
      phone,
      location,
      linkedin,
      headline,
    },
    summary,
    experience,
    education,
    projects,
    skills,
    languages,
    certifications,
    fileName: resolvedFileName,
    // Preserve raw text reference if provided
    ...(rawText ? { _rawTextLength: rawText.length } : {}),
  };

  return finalProfile;
}

// ─── Client-side version (no logging, safe for browser) ──────────────────────

/**
 * Lightweight client-side merge for React state updates.
 * Use in setProfile callbacks to avoid overwriting valid data with partial API responses.
 *
 * Example:
 *   setProfile((prev) => mergeCvProfileClient({ previousProfile: prev, parsedProfile: apiResponse.profile }));
 */
export function mergeCvProfileClient(input: {
  previousProfile?: CvProfile | null;
  parsedProfile?: CvProfile | null;
  fileName?: string;
}): CvProfile {
  return mergeCvProfile({
    previousProfile: input.previousProfile,
    parsedProfile: input.parsedProfile,
    fileName: input.fileName,
  });
}
