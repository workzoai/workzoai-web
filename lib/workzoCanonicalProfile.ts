import type { ResumeProfile } from "./workzoResumeParser";
import { determineCanonicalIdentity, healSpacedHeaders, resolveTargetHeadline } from "./workzoCvIdentityEngine";

export type WorkZoCanonicalProfile = ResumeProfile & {
  canonicalVersion?: string;
  identityConfidence?: number;
  identityNeedsConfirmation?: boolean;
  selectedNameSource?: string;
  fileName?: string;
  updatedAt?: string;
};

const CANONICAL_PROFILE_STORAGE_KEY = "workzo.canonicalCvProfile.v3";
const SHARED_SOURCE_STORAGE_KEY = "workzo_cv_source";
const INTERVIEW_LANGUAGE_STORAGE_KEY = "workzo.interviewLanguage.locked";

function canUseBrowserStorage(): boolean {
  return typeof window !== "undefined";
}

function storageTargets(): Storage[] {
  if (!canUseBrowserStorage()) return [];
  const targets: Storage[] = [];
  try { if (window.localStorage) targets.push(window.localStorage); } catch {}
  try { if (window.sessionStorage) targets.push(window.sessionStorage); } catch {}
  return targets;
}

function safeSet(storage: Storage, key: string, value: string): void {
  try { storage.setItem(key, value); } catch {}
}

function safeGet(storage: Storage, key: string): string | null {
  try { return storage.getItem(key); } catch { return null; }
}

function safeRemove(storage: Storage, key: string): void {
  try { storage.removeItem(key); } catch {}
}

function emailOf(profile: any): string {
  return typeof profile?.basics?.email === "string"
    ? profile.basics.email
    : typeof profile?.email === "string"
      ? profile.email
      : "";
}

function normalizedBasics(profile: any, name: string, headline: string): ResumeProfile["basics"] {
  const basics = profile?.basics && typeof profile.basics === "object" ? profile.basics : {};
  return {
    name,
    headline,
    email: typeof basics.email === "string" ? basics.email : typeof profile?.email === "string" ? profile.email : "",
    phone: typeof basics.phone === "string" ? basics.phone : typeof profile?.phone === "string" ? profile.phone : "",
    location: typeof basics.location === "string" ? basics.location : typeof profile?.location === "string" ? profile.location : "",
    linkedin: typeof basics.linkedin === "string" ? basics.linkedin : typeof profile?.linkedin === "string" ? profile.linkedin : "",
  };
}

export function buildCanonicalProfile(input: {
  profile?: Partial<ResumeProfile> | null;
  rawText?: string | null;
  fileName?: string | null;
  confirmedIdentity?: { name?: string; role?: string; headline?: string } | null;
}): WorkZoCanonicalProfile | null {
  const profile: any = input.profile || {};
  const rawText = healSpacedHeaders(input.rawText || profile.rawText || "");
  const aiName = profile?.basics?.name || profile?.name || "";
  const aiHeadline = profile?.basics?.headline || profile?.headline || profile?.title || profile?.targetRole || "";

  const confirmedName = input.confirmedIdentity?.name?.trim();
  const decision = confirmedName
    ? {
        selectedName: confirmedName,
        selectedNameSource: "user_confirmed",
        confidence: 1,
        needsConfirmation: false,
        rejectedCandidates: [] as string[],
      }
    : determineCanonicalIdentity({
        aiName,
        rawText,
        fileName: input.fileName,
        email: emailOf(profile),
      });

  if (!decision.selectedName || decision.needsConfirmation) {
    console.warn("[WorkZo] cv.profile.cache_rejected", {
      name: aiName || decision.selectedName || "",
      reason: "identity_needs_confirmation",
    });
    return null;
  }

  const headline =
    input.confirmedIdentity?.headline?.trim() ||
    input.confirmedIdentity?.role?.trim() ||
    resolveTargetHeadline({
      aiHeadline,
      rawText,
      selectedName: decision.selectedName,
    });

  const canonical: WorkZoCanonicalProfile = {
    ...(profile as ResumeProfile),
    rawText: rawText || profile.rawText || "",
    basics: normalizedBasics(profile, decision.selectedName, headline),
    canonicalVersion: "cv-engine-v3.2-shared-source",
    identityConfidence: decision.confidence,
    identityNeedsConfirmation: false,
    selectedNameSource: decision.selectedNameSource,
    fileName: input.fileName || profile.fileName || "",
    updatedAt: new Date().toISOString(),
  };

  return canonical;
}

export function isUsableCanonicalProfile(profile: any): profile is WorkZoCanonicalProfile {
  const name = profile?.basics?.name || profile?.name || "";
  const hasEvidence =
    (Array.isArray(profile?.experience) && profile.experience.length > 0) ||
    (Array.isArray(profile?.education) && profile.education.length > 0) ||
    (Array.isArray(profile?.skills) && profile.skills.length > 0) ||
    (typeof profile?.summary === "string" && profile.summary.trim().length > 20);
  return Boolean(
    profile &&
      typeof name === "string" &&
      name.trim().length > 1 &&
      !profile.identityNeedsConfirmation &&
      hasEvidence,
  );
}

export function normalizeCanonicalProfile(profile: any): WorkZoCanonicalProfile | null {
  if (!profile) return null;
  if (isUsableCanonicalProfile(profile) && profile.basics?.name) return profile as WorkZoCanonicalProfile;
  return buildCanonicalProfile({
    profile,
    rawText: profile.rawText || profile.rawTextHealed || "",
    fileName: profile.fileName || "",
  });
}

export type SaveCanonicalProfileOptions = {
  rawText?: string | null;
  fileName?: string | null;
  confirmedIdentity?: { name?: string; role?: string; headline?: string } | null;
  jobDescription?: string | null;
  targetRole?: string | null;
  targetMarket?: string | null;
};

/**
 * Stores one structured CV source for every WorkZo feature.
 * Supports both:
 *   saveCanonicalProfile(profile, { rawText, fileName })
 *   saveCanonicalProfile(profile, rawText, fileName)
 */
export function saveCanonicalProfile(
  profile: Partial<ResumeProfile> | null | undefined,
  optsOrRawText?: SaveCanonicalProfileOptions | string | null,
  legacyFileName?: string | null,
): WorkZoCanonicalProfile | null {
  if (!profile) return null;

  const opts: SaveCanonicalProfileOptions =
    typeof optsOrRawText === "string" || optsOrRawText === null
      ? { rawText: optsOrRawText || "", fileName: legacyFileName || "" }
      : optsOrRawText || {};

  const canonical = buildCanonicalProfile({
    profile,
    rawText: opts.rawText || (profile as any)?.rawText || "",
    fileName: opts.fileName || (profile as any)?.fileName || "",
    confirmedIdentity: opts.confirmedIdentity || null,
  });
  if (!canonical) return null;

  const sharedSource = {
    profile: canonical,
    rawCvText: canonical.rawText || opts.rawText || "",
    fileName: opts.fileName || canonical.fileName || "",
    jobDescription: opts.jobDescription || "",
    targetRole: opts.targetRole || canonical.basics.headline || "",
    targetMarket: opts.targetMarket || "Global",
    source: "canonical",
    origin: "canonical",
    needsReupload: false,
    hasCv: true,
    hasProfile: true,
    hasJobDescription: Boolean(opts.jobDescription?.trim()),
    hasTargetRole: Boolean((opts.targetRole || canonical.basics.headline || "").trim()),
    updatedAt: new Date().toISOString(),
  };

  const canonicalJson = JSON.stringify(canonical);
  const sharedJson = JSON.stringify(sharedSource);
  for (const storage of storageTargets()) {
    safeSet(storage, CANONICAL_PROFILE_STORAGE_KEY, canonicalJson);
    safeSet(storage, SHARED_SOURCE_STORAGE_KEY, sharedJson);
    safeSet(storage, "workzo_resume_profile", canonicalJson);
    safeSet(storage, "workzo_ai_resume_profile", canonicalJson);
    safeSet(storage, "workzo_raw_cv_text", sharedSource.rawCvText);
    if (sharedSource.fileName) safeSet(storage, "workzo_cv_file_name", sharedSource.fileName);
    if (sharedSource.targetRole) safeSet(storage, "workzo_target_role", sharedSource.targetRole);
    safeSet(storage, "workzo_target_market", sharedSource.targetMarket);
  }

  return canonical;
}

export function clearCanonicalProfile(): void {
  const keys = [
    CANONICAL_PROFILE_STORAGE_KEY,
    SHARED_SOURCE_STORAGE_KEY,
    "workzo_resume_profile",
    "workzo_ai_resume_profile",
    "workzo_raw_cv_text",
    "workzo_uploaded_cv_text",
    "workzo_cv_file_name",
  ];
  for (const storage of storageTargets()) {
    for (const key of keys) safeRemove(storage, key);
  }
}

export function getSavedCanonicalProfile(): WorkZoCanonicalProfile | null {
  for (const storage of storageTargets()) {
    for (const key of [CANONICAL_PROFILE_STORAGE_KEY, "workzo_resume_profile", "workzo_ai_resume_profile"]) {
      const raw = safeGet(storage, key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        const normalized = normalizeCanonicalProfile(parsed);
        if (normalized) return normalized;
      } catch {}
    }
  }
  return null;
}

export function lockInterviewLanguage(language?: string | null): void {
  const value = typeof language === "string" ? language.trim() : "";
  if (!value) return;
  for (const storage of storageTargets()) safeSet(storage, INTERVIEW_LANGUAGE_STORAGE_KEY, value);
}

export function getLockedInterviewLanguage(): string {
  for (const storage of storageTargets()) {
    const value = safeGet(storage, INTERVIEW_LANGUAGE_STORAGE_KEY);
    if (value) return value;
  }
  return "";
}
