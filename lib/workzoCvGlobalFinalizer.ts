/*
 * WorkZo AI - global CV finalizer
 *
 * WHAT CHANGED (critical bug fix):
 * The previous version wrote the canonical identity decision to TOP-LEVEL
 * `profile.name` and `profile.headline`. ResumeProfile stores identity at
 * `basics.name` and `basics.headline` (see workzoResumeParser.ts). Nothing in
 * the app reads a resume profile's top-level `.name`. The result: the finalizer,
 * which every route calls as "the last profile-changing function" and then
 * freezes, was a no-op on the exact two fields it claims to protect. Its own
 * log line printed `finalProfile.basics?.name`, i.e. the PRE-finalizer value,
 * which is why the logs always looked correct while the rendered CV was wrong.
 *
 * This file now writes into `basics` (canonical) and mirrors to the top level
 * only for backward compatibility with any legacy caller. Public API, exported
 * names, and call signatures are unchanged, so this is a drop-in replacement.
 *
 * Global by construction: no candidate names, companies, schools, or CV samples.
 */

import type { ResumeProfile } from "./workzoResumeParser";
import { determineCanonicalIdentity, healSpacedHeaders, resolveTargetHeadline } from "./workzoCvIdentityEngine";

function safeString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function getEmail(profile: any): string {
  return safeString(profile?.email || profile?.basics?.email || profile?.contact?.email);
}

/** Read an identity field from any shape a caller might hand us. */
function readIdentityField(profile: any, field: "name" | "headline"): string {
  return safeString(profile?.basics?.[field] || profile?.[field]);
}

export type WorkZoFinalizedCvProfile = ResumeProfile & {
  identityConfidence?: number;
  identityNeedsConfirmation?: boolean;
  selectedNameSource?: string;
  rawTextHealed?: string;
  /** Deprecated mirrors. Read basics.name / basics.headline instead. */
  name?: string;
  headline?: string;
};

export function finalizeWorkZoCvProfile(args: {
  parsedProfile?: Partial<ResumeProfile> | null;
  rawText?: string | null;
  fileName?: string | null;
  visionName?: string | null;
  /** Explicit target role typed by the user. When present it wins the headline. */
  targetRole?: string | null;
}): WorkZoFinalizedCvProfile {
  const parsed: any = args.parsedProfile || {};
  const healedText = healSpacedHeaders(args.rawText || "");

  const decision = determineCanonicalIdentity({
    // Accept both shapes on the way in. Previously only `parsed.name` was read,
    // so an AI profile that correctly filled basics.name was ignored here.
    aiName: readIdentityField(parsed, "name"),
    rawText: healedText,
    fileName: args.fileName,
    email: getEmail(parsed),
    visionName: args.visionName,
  });

  const targetRole = safeString(args.targetRole).trim();
  const headline =
    // Deterministic headline contract, identical to the CV page:
    // an explicit target role always wins, otherwise keep the CV's own headline.
    // The model never gets to invent one.
    targetRole ||
    resolveTargetHeadline({
      aiHeadline: readIdentityField(parsed, "headline") || safeString(parsed.title || parsed.targetRole),
      rawText: healedText,
      selectedName: decision.selectedName,
    });

  const selectedName = decision.selectedName || readIdentityField(parsed, "name") || "";

  const finalProfile: WorkZoFinalizedCvProfile = {
    ...(parsed as ResumeProfile),
    // CANONICAL. This is what every renderer, PDF, interview prompt, cover
    // letter, and LinkedIn surface actually reads.
    basics: {
      ...(parsed.basics || {}),
      name: selectedName,
      headline,
      email: safeString(parsed?.basics?.email || parsed?.email),
      phone: safeString(parsed?.basics?.phone || parsed?.phone),
      location: safeString(parsed?.basics?.location || parsed?.location),
      linkedin: safeString(parsed?.basics?.linkedin || parsed?.linkedin),
    },
    // Deprecated mirrors, kept so any legacy caller reading profile.name still works.
    name: selectedName,
    headline,
    identityConfidence: decision.confidence,
    identityNeedsConfirmation: decision.needsConfirmation,
    selectedNameSource: decision.selectedNameSource,
    rawTextHealed: healedText,
  } as WorkZoFinalizedCvProfile;

  console.log("[WorkZo CV Pipeline] api.cv.finalizer.identity_decision", {
    fileName: args.fileName || "",
    // Log the value we actually wrote, not the value we inherited from the input.
    selectedName: finalProfile.basics?.name ?? "",
    selectedHeadline: finalProfile.basics?.headline ?? "",
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
  targetRole?: string | null;
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
  profileOrArgs?:
    | Partial<ResumeProfile>
    | {
        parsedProfile?: Partial<ResumeProfile> | null;
        rawText?: string | null;
        fileName?: string | null;
        visionName?: string | null;
        targetRole?: string | null;
      }
    | null,
  options?: LegacyFinalizeOptions,
): {
  parsedProfile?: Partial<ResumeProfile> | null;
  rawText?: string | null;
  fileName?: string | null;
  visionName?: string | null;
  targetRole?: string | null;
} {
  if (profileOrArgs && typeof profileOrArgs === "object" && "parsedProfile" in profileOrArgs) {
    return profileOrArgs as {
      parsedProfile?: Partial<ResumeProfile> | null;
      rawText?: string | null;
      fileName?: string | null;
      visionName?: string | null;
      targetRole?: string | null;
    };
  }

  const parsedProfile: any = { ...(profileOrArgs || {}) };
  const selectedName = options?.selectedName || options?.candidateName;
  if (selectedName && typeof selectedName === "string" && selectedName.trim()) {
    // Seed the canonical field, not the dead one. determineCanonicalIdentity
    // still gets a veto if this value is a skill, section header, or job title.
    parsedProfile.basics = { ...(parsedProfile.basics || {}), name: selectedName.trim() };
    parsedProfile.name = selectedName.trim();
  }

  return {
    parsedProfile,
    rawText: options?.rawText || null,
    fileName: options?.fileName || null,
    visionName: options?.visionName || null,
    targetRole: options?.targetRole || null,
  };
}

export function finalizeCanonicalCvProfile(
  profileOrArgs?: Partial<ResumeProfile> | { parsedProfile?: Partial<ResumeProfile> | null; rawText?: string | null; fileName?: string | null; visionName?: string | null } | null,
  options?: LegacyFinalizeOptions,
): WorkZoFinalizedCvProfile {
  return finalizeWorkZoCvProfile(normalizeFinalizeArgs(profileOrArgs, options));
}

export function finalizeCvProfile(
  profileOrArgs?: Partial<ResumeProfile> | { parsedProfile?: Partial<ResumeProfile> | null; rawText?: string | null; fileName?: string | null; visionName?: string | null } | null,
  options?: LegacyFinalizeOptions,
): WorkZoFinalizedCvProfile {
  return finalizeCanonicalCvProfile(profileOrArgs, options);
}

export const finalizeResumeProfile = finalizeCanonicalCvProfile;
export const finalizeWorkZoResumeProfile = finalizeCanonicalCvProfile;

export function validateAndCleanName(parsedName: string, textPreview = "") {
  const decision = determineCanonicalIdentity({ aiName: parsedName, rawText: textPreview });
  return { name: decision.selectedName, source: decision.selectedNameSource };
}

export const __workzoCvGlobalFinalizerVersion = "4.0.0-basics-canonical";
