import type { ResumeProfile } from "@/lib/workzoResumeParser";
import { getSavedCanonicalProfile, isUsableCanonicalProfile, normalizeCanonicalProfile } from "@/lib/workzoCanonicalProfile";
import {
  normalizeSetupCvText,
  normalizeSetupJobDescription,
  normalizeSetupTargetMarket,
  normalizeSetupTargetRole,
  readLatestInterviewSetup,
} from "@/lib/workzoInterviewSetup";

export type WorkZoCvSourceOrigin =
  | "canonical"
  | "canonical/localStorage"
  | "interview-setup"
  | "legacy-storage"
  | "localStorage"
  | "empty"
  | "uploaded"
  | "confirmed"
  | string;

export type WorkZoCvSourceResolution = {
  rawCvText: string;
  profile: ResumeProfile | null;
  jobDescription: string;
  targetRole: string;
  targetMarket: string;
  fileName: string;
  source: string;
  origin: WorkZoCvSourceOrigin;
  needsReupload: boolean;
  hasCv: boolean;
  hasProfile: boolean;
  hasJobDescription: boolean;
  hasTargetRole: boolean;
  updatedAt?: string;
};

const CV_SOURCE_KEY = "workzo_cv_source";
const RAW_CV_KEYS = ["workzo_raw_cv_text", "workzo_uploaded_cv_text", "cvText", "rawCvText"];
const PROFILE_KEYS = [
  "workzo.canonicalCvProfile.v3",
  "workzo_resume_profile",
  "workzo_ai_resume_profile",
  "resumeProfile",
  "aiResumeProfile",
];
const JD_KEYS = ["workzo_job_description", "jobDescription", "jdText"];
const ROLE_KEYS = ["workzo_target_role", "targetRole", "role"];
const MARKET_KEYS = ["workzo_target_market", "targetMarket", "market"];
const FILE_KEYS = ["workzo_cv_file_name", "fileName", "cvFileName"];

function storageTargets(): Storage[] {
  if (typeof window === "undefined") return [];
  const targets: Storage[] = [];
  try { if (window.localStorage) targets.push(window.localStorage); } catch {}
  try { if (window.sessionStorage) targets.push(window.sessionStorage); } catch {}
  return targets;
}

function readString(keys: string[], fallback = ""): string {
  for (const storage of storageTargets()) {
    for (const key of keys) {
      try {
        const value = storage.getItem(key);
        if (typeof value === "string" && value.trim()) return value;
      } catch {}
    }
  }
  return fallback;
}

function readJson<T>(keys: string[]): T | null {
  for (const storage of storageTargets()) {
    for (const key of keys) {
      try {
        const raw = storage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") return parsed as T;
      } catch {}
    }
  }
  return null;
}

function writeString(key: string, value?: string | null): void {
  if (typeof value !== "string") return;
  for (const storage of storageTargets()) {
    try { storage.setItem(key, value); } catch {}
  }
}

function writeJson(key: string, value: unknown): void {
  if (value == null) return;
  const serialized = JSON.stringify(value);
  for (const storage of storageTargets()) {
    try { storage.setItem(key, serialized); } catch {}
  }
}

function removeKeys(keys: string[]): void {
  for (const storage of storageTargets()) {
    for (const key of keys) {
      try { storage.removeItem(key); } catch {}
    }
  }
}

function usableProfile(value: unknown): ResumeProfile | null {
  if (!value || typeof value !== "object") return null;
  const normalized = normalizeCanonicalProfile(value);
  if (normalized && isUsableCanonicalProfile(normalized)) return normalized as ResumeProfile;
  return null;
}

function normalizeSource(input?: Partial<WorkZoCvSourceResolution> | null): WorkZoCvSourceResolution {
  const profile = usableProfile(input?.profile) || null;
  const rawCvText = typeof input?.rawCvText === "string" ? input.rawCvText : profile?.rawText || "";
  const jobDescription = typeof input?.jobDescription === "string" ? input.jobDescription : "";
  const targetRole =
    typeof input?.targetRole === "string" && input.targetRole.trim()
      ? input.targetRole
      : profile?.basics?.headline || "";
  const targetMarket =
    typeof input?.targetMarket === "string" && input.targetMarket.trim() ? input.targetMarket : "Global";
  const fileName = typeof input?.fileName === "string" ? input.fileName : "";
  const origin = (input?.origin || input?.source || (profile || rawCvText ? "canonical/localStorage" : "empty")) as WorkZoCvSourceOrigin;
  const hasProfile = Boolean(profile);
  const hasCv = hasProfile || rawCvText.trim().length >= 40;
  const needsReupload = typeof input?.needsReupload === "boolean" ? input.needsReupload : !hasProfile;

  return {
    rawCvText,
    profile,
    jobDescription,
    targetRole,
    targetMarket,
    fileName,
    source: String(origin),
    origin,
    needsReupload,
    hasCv,
    hasProfile,
    hasJobDescription: jobDescription.trim().length > 0,
    hasTargetRole: targetRole.trim().length > 0,
    updatedAt: input?.updatedAt,
  };
}

export function resolveCvSource(): WorkZoCvSourceResolution {
  const packed = readJson<Partial<WorkZoCvSourceResolution>>([CV_SOURCE_KEY]);
  const canonical = getSavedCanonicalProfile();
  const legacyProfile = usableProfile(readJson<ResumeProfile>(PROFILE_KEYS));
  const setup = readLatestInterviewSetup();
  const setupProfile = usableProfile(setup?.resumeProfile);

  // Priority: explicit shared source -> canonical profile -> latest interview setup -> legacy keys.
  const profile = usableProfile(packed?.profile) || canonical || setupProfile || legacyProfile;
  const rawCvText =
    packed?.rawCvText ||
    profile?.rawText ||
    normalizeSetupCvText(setup) ||
    readString(RAW_CV_KEYS, "");
  const jobDescription =
    packed?.jobDescription || normalizeSetupJobDescription(setup) || readString(JD_KEYS, "");
  const targetRole =
    packed?.targetRole ||
    normalizeSetupTargetRole(setup) ||
    readString(ROLE_KEYS, profile?.basics?.headline || "");
  const targetMarket =
    packed?.targetMarket || normalizeSetupTargetMarket(setup) || readString(MARKET_KEYS, "Global");
  const fileName = packed?.fileName || setup?.fileName || readString(FILE_KEYS, "");
  const origin: WorkZoCvSourceOrigin = packed?.profile
    ? "canonical"
    : canonical
      ? "canonical/localStorage"
      : setupProfile
        ? "interview-setup"
        : legacyProfile
          ? "legacy-storage"
          : "empty";

  const result = normalizeSource({
    ...packed,
    rawCvText,
    profile,
    jobDescription,
    targetRole,
    targetMarket,
    fileName,
    source: origin,
    origin,
    needsReupload: !profile,
  });

  // Self-heal all storage formats after finding any valid profile.
  if (result.profile) persistCvSource(result);
  return result;
}

export function persistCvSource(input: Partial<WorkZoCvSourceResolution> & Record<string, unknown>): WorkZoCvSourceResolution {
  const packedCurrent = readJson<Partial<WorkZoCvSourceResolution>>([CV_SOURCE_KEY]);
  const current = packedCurrent ? normalizeSource(packedCurrent) : normalizeSource(null);
  const next = normalizeSource({
    ...current,
    ...input,
    profile: usableProfile(input.profile) || current.profile,
    updatedAt: new Date().toISOString(),
  });

  writeJson(CV_SOURCE_KEY, next);
  writeString("workzo_raw_cv_text", next.rawCvText);
  writeJson("workzo_resume_profile", next.profile);
  writeJson("workzo_ai_resume_profile", next.profile);
  if (next.profile) writeJson("workzo.canonicalCvProfile.v3", next.profile);
  writeString("workzo_job_description", next.jobDescription);
  writeString("workzo_target_role", next.targetRole);
  writeString("workzo_target_market", next.targetMarket);
  writeString("workzo_cv_file_name", next.fileName || "");

  return next;
}

export function clearCvSource(): void {
  removeKeys([
    CV_SOURCE_KEY,
    ...RAW_CV_KEYS,
    ...PROFILE_KEYS,
    ...JD_KEYS,
    ...ROLE_KEYS,
    ...MARKET_KEYS,
    ...FILE_KEYS,
  ]);
}

export function applyConfirmedCvIdentity(edited: {
  name?: string;
  headline?: string;
  role?: string;
  targetRole?: string;
  jobDescription?: string;
  targetMarket?: string;
  source?: string;
  fileName?: string;
}): WorkZoCvSourceResolution {
  const current = resolveCvSource();
  const profile = current.profile ? ({ ...current.profile } as ResumeProfile) : null;
  if (!profile) return current;

  const basics = { ...profile.basics };
  const cleanName = typeof edited.name === "string" ? edited.name.trim() : "";
  const cleanHeadline =
    typeof edited.headline === "string" && edited.headline.trim()
      ? edited.headline.trim()
      : typeof edited.role === "string" && edited.role.trim()
        ? edited.role.trim()
        : typeof edited.targetRole === "string"
          ? edited.targetRole.trim()
          : "";

  if (cleanName) basics.name = cleanName;
  if (cleanHeadline) basics.headline = cleanHeadline;
  profile.basics = basics;

  const nextSource = edited.source?.trim() || "confirmed";
  return persistCvSource({
    ...current,
    profile,
    jobDescription: typeof edited.jobDescription === "string" ? edited.jobDescription : current.jobDescription,
    targetRole: cleanHeadline || current.targetRole,
    targetMarket: edited.targetMarket?.trim() || current.targetMarket,
    fileName: edited.fileName?.trim() || current.fileName,
    origin: nextSource,
    source: nextSource,
    needsReupload: false,
  });
}

export const getCvSource = resolveCvSource;
export const saveCvSource = persistCvSource;
export const setCvSource = persistCvSource;
export const resetCvSource = clearCvSource;
