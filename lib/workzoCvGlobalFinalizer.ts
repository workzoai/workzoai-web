import type { ResumeProfile } from "./workzoResumeParser";
import { determineCanonicalIdentity, healSpacedHeaders, resolveTargetHeadline } from "./workzoCvIdentityEngine";

function safeString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function getEmail(profile: any): string {
  return safeString(profile?.email || profile?.basics?.email || profile?.contact?.email);
}

export type WorkZoFinalizedCvProfile = ResumeProfile & {
  identityConfidence?: number;
  identityNeedsConfirmation?: boolean;
  selectedNameSource?: string;
  rawTextHealed?: string;
};

export function finalizeWorkZoCvProfile(args: {
  parsedProfile?: Partial<ResumeProfile> | null;
  rawText?: string | null;
  fileName?: string | null;
  visionName?: string | null;
}): WorkZoFinalizedCvProfile {
  const parsed: any = args.parsedProfile || {};
  const healedText = healSpacedHeaders(args.rawText || "");
  const decision = determineCanonicalIdentity({
    aiName: parsed.name,
    rawText: healedText,
    fileName: args.fileName,
    email: getEmail(parsed),
    visionName: args.visionName,
  });

  const headline = resolveTargetHeadline({
    aiHeadline: safeString(parsed.headline || parsed.title || parsed.targetRole),
    rawText: healedText,
    selectedName: decision.selectedName,
  });

  const finalProfile: WorkZoFinalizedCvProfile = {
    ...(parsed as ResumeProfile),
    name: decision.selectedName || "",
    headline,
    identityConfidence: decision.confidence,
    identityNeedsConfirmation: decision.needsConfirmation,
    selectedNameSource: decision.selectedNameSource,
    rawTextHealed: healedText,
  } as WorkZoFinalizedCvProfile;

  console.log("[WorkZo CV Pipeline] api.cv.finalizer.identity_decision", {
    fileName: args.fileName || "",
    selectedName: finalProfile.basics?.name ?? "",
    selectedNameSource: decision.selectedNameSource,
    confidence: decision.confidence,
    needsConfirmation: decision.needsConfirmation,
    rejectedCandidates: decision.rejectedCandidates,
  });

  return finalProfile;
}

// Backward-compatible wrappers used by older routes.
// Supports both call styles:
//   finalizeWorkZoCvProfile({ parsedProfile, rawText, fileName })
//   finalizeCanonicalCvProfile(profile, { rawText, fileName, selectedName })
type LegacyFinalizeOptions = {
  rawText?: string | null;
  fileName?: string | null;
  selectedName?: string | null;
  candidateName?: string | null;
  visionName?: string | null;
  source?: string | null;
  confidence?:
    | number
    | {
        name?: number;
        experience?: number;
        skills?: number;
        overall?: number;
      }
    | null;
  [key: string]: unknown;
};

function normalizeFinalizeArgs(
  profileOrArgs?: Partial<ResumeProfile> | { parsedProfile?: Partial<ResumeProfile> | null; rawText?: string | null; fileName?: string | null; visionName?: string | null } | null,
  options?: LegacyFinalizeOptions
): { parsedProfile?: Partial<ResumeProfile> | null; rawText?: string | null; fileName?: string | null; visionName?: string | null } {
  if (profileOrArgs && typeof profileOrArgs === "object" && "parsedProfile" in profileOrArgs) {
    return profileOrArgs as { parsedProfile?: Partial<ResumeProfile> | null; rawText?: string | null; fileName?: string | null; visionName?: string | null };
  }

  const parsedProfile: any = { ...(profileOrArgs || {}) };
  const selectedName = options?.selectedName || options?.candidateName;
  if (selectedName && typeof selectedName === "string" && selectedName.trim()) {
    parsedProfile.name = selectedName.trim();
  }

  return {
    parsedProfile,
    rawText: options?.rawText || null,
    fileName: options?.fileName || null,
    visionName: options?.visionName || null,
  };
}

export function finalizeCanonicalCvProfile(
  profileOrArgs?: Partial<ResumeProfile> | { parsedProfile?: Partial<ResumeProfile> | null; rawText?: string | null; fileName?: string | null; visionName?: string | null } | null,
  options?: LegacyFinalizeOptions
): WorkZoFinalizedCvProfile {
  return finalizeWorkZoCvProfile(normalizeFinalizeArgs(profileOrArgs, options));
}

export function finalizeCvProfile(
  profileOrArgs?: Partial<ResumeProfile> | { parsedProfile?: Partial<ResumeProfile> | null; rawText?: string | null; fileName?: string | null; visionName?: string | null } | null,
  options?: LegacyFinalizeOptions
): WorkZoFinalizedCvProfile {
  return finalizeCanonicalCvProfile(profileOrArgs, options);
}

export const finalizeResumeProfile = finalizeCanonicalCvProfile;
export const finalizeWorkZoResumeProfile = finalizeCanonicalCvProfile;

export function validateAndCleanName(parsedName: string, textPreview = "") {
  const decision = determineCanonicalIdentity({ aiName: parsedName, rawText: textPreview });
  return { name: decision.selectedName, source: decision.selectedNameSource };
}
