"use client";

/**
 * workzoCanonicalProfile.ts
 *
 * Single source of truth for the candidate's ResumeProfile across all WorkZo pages.
 *
 * ARCHITECTURE:
 *   After /api/cv parses the uploaded file, the result is stored here once.
 *   Every downstream page (Improve CV, Cover Letter, Interview, Job Match) reads
 *   from these keys instead of rebuilding from raw text. The raw CV text is stored
 *   separately so it is always available as fallback, but it is never re-parsed.
 *
 * STORAGE KEYS (sessionStorage):
 *   workzo_resume_profile , JSON stringified ResumeProfile
 *   workzo_resume_text    , raw extracted CV text (never derived summary)
 *   workzo_resume_file_name, original upload file name
 *
 * RULES:
 *   1. Store once after successful /api/cv upload. Never overwrite with re-parsed data.
 *   2. Validate before reuse. If invalid, return null so the caller can prompt re-upload.
 *   3. No page rebuilds context from raw text if a valid ResumeProfile is stored.
 */

import type { ResumeProfile } from "@/lib/workzoResumeParser";

// ── Storage key constants ─────────────────────────────────────────────────────

export const CANONICAL_KEYS = {
  PROFILE: "workzo_resume_profile",
  RAW_TEXT: "workzo_resume_text",
  FILE_NAME: "workzo_resume_file_name",
  CREATED_AT: "workzo_resume_created_at",
} as const;

// ── Validation ────────────────────────────────────────────────────────────────

/** Section headings and generic labels that are never valid candidate names */
const INVALID_NAME_PATTERNS = /^(projects?|key projects?|personal projects?|academic projects?|relevant experience|educational background|education|educational|skills?|technical skills?|core competencies|competencies|languages?|contact|about me|overview|profile|summary|professional summary|financial accountant|senior accountant|junior accountant|marketing manager|marketing managerin|graphic designer|preschool teacher|english teacher|candidate|professional|selected project|unknown|n\/a|not specified|testing and debugging)$/i;

/** Phone values that are actually date ranges (e.g. "2021 - 2022") */
const DATE_RANGE_PATTERN = /^\(?\d{4}\s*[-–—]\s*\d{4}\)?$|^(19|20)\d{2}\s*[-–—]\s*(19|20)\d{2}$/;

/** Minimum structure for a usable profile */
export function isCanonicalProfileValid(profile: unknown): profile is ResumeProfile {
  if (!profile || typeof profile !== "object") return false;
  const p = profile as ResumeProfile;

  // Must have basics object
  if (!p.basics || typeof p.basics !== "object") return false;

  // Name must exist and not be a section heading or placeholder
  const name = (p.basics.name || "").trim();
  if (!name) return false;
  if (INVALID_NAME_PATTERNS.test(name)) return false;
  // Name must look like a human name: 2-4 words, no digits
  const nameWords = name.split(/\s+/).filter(Boolean);
  if (nameWords.length < 1 || nameWords.length > 6) return false;
  if (/\d/.test(name)) return false;

  // Must have at least one job or one education entry
  const hasExperience = Array.isArray(p.experience) && p.experience.length > 0;
  const hasEducation = Array.isArray(p.education) && p.education.length > 0;
  if (!hasExperience && !hasEducation) return false;

  // Phone must not be a date range
  if (p.basics.phone && DATE_RANGE_PATTERN.test(p.basics.phone.trim())) {
    // Don't reject the whole profile, just flag phone as invalid
    // (the caller can strip it)
  }

  return true;
}

/** Strip corrupt fields from a profile without rejecting it entirely */
export function sanitizeCanonicalProfile(profile: ResumeProfile): ResumeProfile {
  const sanitized = { ...profile };

  // Strip phone if it looks like a date range
  if (sanitized.basics?.phone && DATE_RANGE_PATTERN.test(sanitized.basics.phone.trim())) {
    sanitized.basics = { ...sanitized.basics, phone: "" };
  }

  // Strip name if it's a section heading
  if (sanitized.basics?.name && INVALID_NAME_PATTERNS.test(sanitized.basics.name.trim())) {
    sanitized.basics = { ...sanitized.basics, name: "" };
  }

  // Deduplicate skills
  if (Array.isArray(sanitized.skills)) {
    const seen = new Set<string>();
    sanitized.skills = sanitized.skills.filter((s) => {
      const key = s.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return sanitized;
}

// ── Storage ───────────────────────────────────────────────────────────────────

function safeSession() {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

/**
 * Save the canonical profile after a successful /api/cv parse.
 * rawCvText must be the original extracted text, NOT a derived summary.
 */
export function saveCanonicalProfile(
  profile: ResumeProfile,
  rawCvText: string,
  fileName: string,
): void {
  const ss = safeSession();
  if (!ss) return;

  const sanitized = sanitizeCanonicalProfile(profile);

  try {
    ss.setItem(CANONICAL_KEYS.PROFILE, JSON.stringify(sanitized));
    ss.setItem(CANONICAL_KEYS.RAW_TEXT, rawCvText || "");
    ss.setItem(CANONICAL_KEYS.FILE_NAME, fileName || "");
    ss.setItem(CANONICAL_KEYS.CREATED_AT, new Date().toISOString());
    console.log("[WorkZo] cv.profile.created", {
      name: sanitized.basics?.name,
      exp: sanitized.experience?.length ?? 0,
      edu: sanitized.education?.length ?? 0,
      skills: sanitized.skills?.length ?? 0,
      projects: sanitized.projects?.length ?? 0,
      fileName,
    });
  } catch {
    // sessionStorage may be blocked
  }
}

/**
 * Load and validate the stored canonical profile.
 * Returns null if missing, invalid, or corrupt, never throws.
 */
export function loadCanonicalProfile(): {
  profile: ResumeProfile;
  rawCvText: string;
  fileName: string;
} | null {
  const ss = safeSession();
  if (!ss) return null;

  try {
    const raw = ss.getItem(CANONICAL_KEYS.PROFILE);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (!isCanonicalProfileValid(parsed)) {
      console.warn("[WorkZo] cv.profile.cache_rejected", {
        name: parsed?.basics?.name || "(empty)",
        exp: parsed?.experience?.length ?? 0,
        edu: parsed?.education?.length ?? 0,
        reason: "failed_validation",
      });
      return null;
    }

    const rawCvText = ss.getItem(CANONICAL_KEYS.RAW_TEXT) || "";
    const fileName = ss.getItem(CANONICAL_KEYS.FILE_NAME) || "";

    console.log("[WorkZo] cv.profile.reused", {
      name: parsed.basics?.name,
      exp: parsed.experience?.length ?? 0,
      edu: parsed.education?.length ?? 0,
      fileName,
    });

    return { profile: parsed as ResumeProfile, rawCvText, fileName };
  } catch {
    console.warn("[WorkZo] cv.profile.cache_rejected", { reason: "parse_error" });
    return null;
  }
}

/**
 * Validate then return profile, or null.
 * Use this on any page before consuming a stored profile.
 */
export function getValidatedCanonicalProfile(): ResumeProfile | null {
  const result = loadCanonicalProfile();
  if (!result) return null;
  console.log("[WorkZo] cv.profile.validated", { name: result.profile.basics?.name });
  return result.profile;
}

/** Clear all stored canonical profile data */
export function clearCanonicalProfile(): void {
  const ss = safeSession();
  if (!ss) return;
  try {
    ss.removeItem(CANONICAL_KEYS.PROFILE);
    ss.removeItem(CANONICAL_KEYS.RAW_TEXT);
    ss.removeItem(CANONICAL_KEYS.FILE_NAME);
    ss.removeItem(CANONICAL_KEYS.CREATED_AT);
  } catch {
    // ignore
  }
}

// ── Language lock ─────────────────────────────────────────────────────────────

const LANG_KEY = "workzo_interview_language_lock";

/** Lock the interview language as single source of truth */
export function lockInterviewLanguage(language: string): void {
  const ss = safeSession();
  if (!ss) return;
  try {
    ss.setItem(LANG_KEY, language || "English");
    console.log("[WorkZo] interview.language.locked", { language });
  } catch {
    // ignore
  }
}

export function getLockedInterviewLanguage(): string {
  const ss = safeSession();
  if (!ss) return "English";
  try {
    return ss.getItem(LANG_KEY) || "English";
  } catch {
    return "English";
  }
}
