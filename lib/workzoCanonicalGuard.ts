/*
 * WorkZo AI - canonical resume guard (single source of truth)
 *
 * WHY THIS FILE EXISTS
 * The fact guard (repairParsedResume / guardResumeAgainstSource) was only ever
 * called from app/cv/page.tsx. That means:
 *   - /api/cv returned an UNGUARDED profile,
 *   - and every downstream surface that reads resumeProfile (/api/copilot,
 *     /api/interview/reply, /api/linkedin/*) consumed unguarded data.
 * The guard protected exactly one screen.
 *
 * This module lifts that logic out of the React page into a pure, importable
 * function that runs identically on the server and the client, so the guard
 * becomes what it was always supposed to be: the last authority before any
 * profile is persisted, rendered, or handed to another engine.
 *
 * TWO STAGES, TWO GUARDS:
 *   1. guardCanonicalParse()    - after PARSING. Repairs the parsed profile and
 *                                 locks identity. Run this in /api/cv.
 *   2. guardRewrittenResume()   - after any AI REWRITE. Facts come from the
 *                                 source profile, only wording comes from the AI.
 *
 * FACT CONTRACT enforced by stage 2 (holds for any CV, any JD, any role):
 *   AI MAY change:  summary, bullet wording, skill ordering.
 *   AI MAY NEVER change: job title, company, location, dates, education,
 *                        certifications, project names, project count,
 *                        languages, candidate name, headline.
 *
 * Entity-free. No candidate names, companies, schools, or CV samples.
 */

import type { ResumeProfile } from "./workzoResumeParser";
import {
  guardResumeAgainstSource,
  repairParsedResume,
  formatResumeProfileText,
} from "./workzoResumeFactGuard";
import {
  completeResumeProfile,
  enforceCanonicalCandidateName,
  mergePreservingOriginalStructure,
} from "./workzoResumeProfileManager";

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isTranslatedOutput(outputLanguage?: string): boolean {
  const lang = str(outputLanguage).trim().toLowerCase();
  return !!lang && lang !== "english";
}

/* ------------------------------------------------------------------------- *
 * STAGE 1 - parse guard
 * Run immediately after the parser (AI or deterministic), BEFORE the profile
 * is finalized, frozen, persisted, or returned to any client.
 * ------------------------------------------------------------------------- */

export function guardCanonicalParse(input: {
  profile: Partial<ResumeProfile> | null | undefined;
  rawText?: string;
  fileName?: string;
  candidateName?: string;
}): ResumeProfile {
  const sourceText = str(input.rawText);
  const repaired = repairParsedResume(
    completeResumeProfile(input.profile as ResumeProfile, sourceText),
    sourceText,
  );

  // Identity lock. enforceCanonicalCandidateName has early-return guards, so a
  // known-good onboarding name is never overwritten by a skill or section header.
  return enforceCanonicalCandidateName(
    repaired,
    sourceText,
    str(input.fileName),
    str(input.candidateName),
  ) as ResumeProfile;
}

/* ------------------------------------------------------------------------- *
 * STAGE 2 - rewrite guard
 * Ported verbatim (behaviour-preserving) from app/cv/page.tsx so there is one
 * implementation instead of two.
 * ------------------------------------------------------------------------- */

/** Facts from source, wording from the rewrite. Positional, never structural. */
function preserveExperience(
  sourceEntries: ResumeProfile["experience"] = [],
  rewrittenEntries: ResumeProfile["experience"] = [],
): ResumeProfile["experience"] {
  return sourceEntries.map((sourceEntry, index) => {
    const rewrittenEntry = rewrittenEntries[index];
    const sourceBullets = sourceEntry.bullets || [];
    const rewrittenBullets = rewrittenEntry?.bullets || [];
    return {
      // Job identity is factual and must never be rewritten or translated.
      title: sourceEntry.title,
      company: sourceEntry.company,
      location: sourceEntry.location,
      dates: sourceEntry.dates,
      bullets: sourceBullets.map(
        (sourceBullet, bulletIndex) => rewrittenBullets[bulletIndex] || sourceBullet,
      ),
    };
  });
}

function preserveProjects(
  sourceEntries: ResumeProfile["projects"] = [],
  rewrittenEntries: ResumeProfile["projects"] = [],
): ResumeProfile["projects"] {
  return sourceEntries.map((sourceEntry, index) => {
    const rewrittenEntry = rewrittenEntries[index];
    const sourceBullets = sourceEntry.bullets || [];
    const rewrittenBullets = rewrittenEntry?.bullets || [];
    return {
      // Project names and project count come only from the source CV.
      name: sourceEntry.name,
      bullets: sourceBullets.map(
        (sourceBullet, bulletIndex) => rewrittenBullets[bulletIndex] || sourceBullet,
      ),
    };
  });
}

export type GuardRewriteInput = {
  /** The model's structured output (data.resumeProfile from /api/copilot). */
  rewrittenProfile?: Partial<ResumeProfile> | null;
  /** The model's plain-text output, used only as a last-resort text fallback. */
  rewrittenText?: string;
  /** The trusted, already-parsed profile for this CV. */
  sourceProfile?: Partial<ResumeProfile> | null;
  /** The original uploaded CV text. */
  sourceText?: string;
  targetRole?: string;
  jobDescription?: string;
  outputLanguage?: string;
};

export type GuardRewriteResult = {
  /** Safe to render, persist, PDF, and hand to any downstream engine. */
  profile: ResumeProfile;
  /** Deterministic text rendering of the guarded profile. */
  text: string;
};

export function guardRewrittenResume(input: GuardRewriteInput): GuardRewriteResult {
  const cvSource = str(input.sourceText) || str(input.sourceProfile?.rawText);
  const targetRole = str(input.targetRole).trim();
  const jobDescription = str(input.jobDescription);
  const outputLanguage = str(input.outputLanguage);
  const translated = isTranslatedOutput(outputLanguage);

  const savedResumeProfile = input.sourceProfile as ResumeProfile | undefined;
  const rewrittenProfile =
    input.rewrittenProfile && typeof input.rewrittenProfile === "object"
      ? (input.rewrittenProfile as ResumeProfile)
      : undefined;

  // Merge the model's structured output over the true parsed profile, keeping
  // the original structure as the base.
  let mergedProfile: ResumeProfile | undefined = savedResumeProfile
    ? mergePreservingOriginalStructure(
        completeResumeProfile(savedResumeProfile, cvSource),
        rewrittenProfile,
      )
    : rewrittenProfile;

  // Name safety: the parsed profile's name always wins over the rewrite's.
  if (
    mergedProfile &&
    savedResumeProfile?.basics?.name &&
    mergedProfile.basics?.name !== savedResumeProfile.basics.name
  ) {
    mergedProfile = {
      ...mergedProfile,
      basics: { ...mergedProfile.basics, name: savedResumeProfile.basics.name },
    };
  }

  // For a genuine cross-language rewrite, mergePreservingOriginalStructure
  // re-imposes the original-language titles/education and unions the source
  // skills back in, which would strip the translation before the guard runs.
  // Feed the guard the model's RAW structured profile in that case; the guard's
  // translated branch restores identity/structure from the source itself, so
  // anti-fabrication still holds.
  const candidateForGuard = translated && rewrittenProfile ? rewrittenProfile : mergedProfile;

  const guardedProfile = guardResumeAgainstSource(
    candidateForGuard,
    { profile: savedResumeProfile, text: cvSource },
    { jobDescription, targetRole, outputLanguage },
  );

  // Preserve every verified source section after the targeted rewrite.
  const repairedOriginalProfile = savedResumeProfile
    ? repairParsedResume(completeResumeProfile(savedResumeProfile, cvSource), cvSource)
    : undefined;

  const mergedSafeProfile = repairedOriginalProfile
    ? mergePreservingOriginalStructure(repairedOriginalProfile, guardedProfile)
    : guardedProfile;

  const sourceProfile = repairedOriginalProfile || mergedSafeProfile;

  // Languages: the complete verified source list. A translation may re-render
  // the labels, but it may never shorten the list.
  const sourceLanguages = sourceProfile.languages || [];
  const rewrittenLanguages = mergedSafeProfile.languages || [];
  const languages = translated
    ? sourceLanguages.map((sourceLanguage, index) => rewrittenLanguages[index] || sourceLanguage)
    : sourceLanguages.length
      ? sourceLanguages
      : rewrittenLanguages;

  const safeProfile: ResumeProfile = {
    ...mergedSafeProfile,
    basics: {
      ...sourceProfile.basics,
      ...mergedSafeProfile.basics,
      // Headline contract: the user's explicit target role, else the CV's own
      // headline. The model never invents one.
      headline: targetRole || mergedSafeProfile.basics.headline,
    },
    experience: preserveExperience(sourceProfile.experience || [], mergedSafeProfile.experience || []),
    projects: preserveProjects(sourceProfile.projects || [], mergedSafeProfile.projects || []),
    education: sourceProfile.education || [],
    certifications: sourceProfile.certifications || [],
    languages,
  };

  return {
    profile: safeProfile,
    text: formatResumeProfileText(safeProfile) || str(input.rewrittenText),
  };
}

export const __workzoCanonicalGuardVersion = "1.0.0-global";
