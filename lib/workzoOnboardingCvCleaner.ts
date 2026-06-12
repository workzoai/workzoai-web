/**
 * WorkZo AI — Onboarding CV Cleaner
 * lib/workzoOnboardingCvCleaner.ts
 *
 * This module is now a thin wrapper around the universal CV cleaner
 * and the generic resume parser. All person-specific hardcoded logic
 * has been removed — this now works for any candidate, any CV template,
 * any country, any language.
 *
 * The old file contained hardcoded references to one specific person's
 * name, companies, projects, and education. That is wrong for a product
 * used by thousands of candidates.
 */

"use client";

import { cleanExtractedCvText } from "@/lib/workzoCvPdfCleaner";
import {
  extractResumeProfileComplex,
  normalizeResumeText,
  type ResumeProfile,
} from "@/lib/workzoResumeParser";

export type { ResumeProfile };

// Re-export types for backwards compatibility with any pages that import from here
export type ResumeExperienceItem = {
  title: string;
  company: string;
  dates: string;
  bullets: string[];
};

export type ResumeProjectItem = {
  name: string;
  bullets: string[];
};

export type ResumeEducationItem = {
  degree: string;
  institution: string;
  dates: string;
};

export type StructuredResume = {
  fullName: string;
  headline: string;
  contact: {
    phone: string;
    email: string;
    location: string;
    linkedin: string;
  };
  summary: string;
  skills: string[];
  experience: ResumeExperienceItem[];
  projects: ResumeProjectItem[];
  education: ResumeEducationItem[];
  languages: string[];
  softSkills: string[];
  qualityNotes: string[];
};

export type CleanedOnboardingCv = {
  cleanedText: string;
  structured: StructuredResume;
  confidenceNotes: string[];
};

/**
 * cleanOnboardingCvExtraction
 *
 * Cleans raw CV text and returns a structured resume profile.
 * Works for any candidate — no hardcoded names, companies, or content.
 *
 * Step 1: normalise encoding artefacts and fix multi-column reading order
 * Step 2: parse into structured sections using the generic resume parser
 * Step 3: return both the cleaned text and the structured profile
 */
export function cleanOnboardingCvExtraction(rawText: string): CleanedOnboardingCv {
  // Step 1: Universal text cleaning — handles sidebar PDFs, encoding artefacts, etc.
  const cleanedText = cleanExtractedCvText(normalizeResumeText(rawText));

  // Step 2: Generic structured parsing — works for any CV from any candidate
  const profile = extractResumeProfileComplex(cleanedText);

  // Step 3: Convert to the legacy StructuredResume shape for backward compatibility
  const structured: StructuredResume = {
    fullName: profile.basics?.name || "",
    headline: profile.basics?.headline || "",
    contact: {
      phone: profile.basics?.phone || "",
      email: profile.basics?.email || "",
      location: profile.basics?.location || "",
      linkedin: profile.basics?.linkedin || "",
    },
    summary: profile.summary || "",
    skills: profile.skills || [],
    experience: (profile.experience || []).map(e => ({
      title: e.title || "",
      company: e.company || "",
      dates: e.dates || "",
      bullets: e.bullets || [],
    })),
    projects: (profile.projects || []).map(p => ({
      name: p.name || "",
      bullets: p.bullets || [],
    })),
    education: (profile.education || []).map(e => ({
      degree: e.degree || "",
      institution: e.institution || "",
      dates: e.dates || "",
    })),
    languages: profile.languages || [],
    softSkills: profile.strengths || [],
    qualityNotes: profile.warnings || [],
  };

  const notes: string[] = profile.warnings || [];

  return {
    cleanedText,
    structured,
    confidenceNotes: notes,
  };
}

/**
 * getCleanedOnboardingCvText
 * Quick helper — returns just the cleaned text string.
 */
export function getCleanedOnboardingCvText(rawText: string): string {
  return cleanOnboardingCvExtraction(rawText).cleanedText;
}
