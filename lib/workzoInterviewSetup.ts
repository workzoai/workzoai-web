"use client";

import { cleanHumanName, completeResumeProfile, enforceCanonicalCandidateName, isLowQualityResumeProfile } from "@/lib/workzoResumeProfileManager";

export type JobMemoryProfile = {
  targetRole?: string;
  role?: string;
  jobTitle?: string;
  targetMarket?: string;
  country?: string;
  companyName?: string;
  targetCompany?: string;
  companyBlueprint?: any;
  companyStyle?: string;
  jobDescription?: string;
  jdText?: string;
  keywords?: string[];
  responsibilities?: string[];
  requirements?: string[];
  [key: string]: any;
};

export type RecruiterMemoryProfile = {
  recruiterPersonality?: string;
  recruiter?: string;
  recruiterStyle?: string;
  companyStyle?: string;
  language?: string;
  tone?: string;
  difficulty?: string;
  interviewAtmosphere?: string;
  memory?: Record<string, any>;
  [key: string]: any;
};

export type WorkZoInterviewSetup = {
  cvText?: string;
  uploadedCvText?: string;
  resumeText?: string;
  candidateCv?: string;
  previewText?: string;

  jobDescription?: string;
  jdText?: string;

  targetRole?: string;
  role?: string;
  jobTitle?: string;

  targetMarket?: string;
  country?: string;

  companyName?: string;
  targetCompany?: string;
  companyBlueprint?: any;
  companyStyle?: string;
  recruiterStyle?: string;
  recruiterPersonality?: string;
  recruiter?: string;
  language?: string;
  interviewLanguage?: string;
  selectedLanguage?: string;

  candidateName?: string;
  candidateHeadline?: string;
  candidateEmail?: string;
  candidatePhone?: string;
  candidateLocation?: string;
  candidateLinkedin?: string;

  resumeProfile?: any;
  jobMemory?: JobMemoryProfile;
  recruiterMemory?: RecruiterMemoryProfile;
  recruiterMemoryProfile?: RecruiterMemoryProfile | null;
  jobMemoryProfile?: JobMemoryProfile | null;

  source?: string;
  setupVersion?: number;
  setupId?: string;
  updatedAt?: string;
  createdAt?: string;
  version?: number;

  [key: string]: any;
};

export type WorkZoSetup = WorkZoInterviewSetup;

const SETUP_KEYS = [
  "workzoInterviewSetup",
  "workzo_interview_setup",
  "latestInterviewSetup",
  "workzo_latest_interview_setup",
  "onboardingSetup",
  "workzo-interview-setup-v4",
  "workzo-latest-interview-setup",
  "workzo-interview-setup-latest",
];

const LEGACY_KEYS_TO_CLEAR = [
  "workzo-interview-setup-v3",
  "workzo-interview-setup-v2",
  "workzo-interview-setup",
  "workzo_setup",
  "workzo-onboarding",
  "workzo_onboarding",
];

const BLOCKED_NAME_WORDS = /\b(resume|cv|curriculum|profile|summary|experience|education|skills?|projects?|languages?|english|german|dutch|french|spanish|italian|portuguese|fluent|native|conversational|professional|engineer|analyst|manager|developer|specialist|consultant|support|sales|executive|objective|contact|email|phone|linkedin|github|public|relations|management|leadership|teamwork|communication|critical|thinking|programming|python|javascript|typescript|java|sql|data|science|machine|learning|visualization|engineering|tableau|matplotlib|seaborn|tensorflow|sklearn|langchain|generative|retrieval|augmented|generation|ticketing|networking|remote|tools|systems|windows|linux|cloud|platform|functions|scraping|integration|bootcamp|bachelor|master|degree|university|college|school|institute|certification|intern|freelance|volunteer|candidate|profilesummary|workexperience|profile\s*summary|work\s*experience)\b/i;

function cleanString(value: unknown, max = 20000) {
  if (typeof value !== "string") return "";
  return value
    .replace(/\u0000/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

function safeParse(value: string | null): WorkZoInterviewSetup | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function getTime(setup: WorkZoInterviewSetup) {
  const raw = setup.updatedAt || setup.createdAt || "";
  const time = raw ? new Date(String(raw)).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function hasUsableResumeProfile(setup: WorkZoInterviewSetup) {
  const profile = setup.resumeProfile;
  if (!profile || typeof profile !== "object") return false;

  const basics = profile.basics && typeof profile.basics === "object" ? profile.basics : {};
  const hasName = isValidCandidateName((basics as any).name || setup.candidateName || "");
  const hasSummary = cleanString((profile as any).summary, 1200).length > 20;
  const hasExperience = Array.isArray((profile as any).experience) && (profile as any).experience.length > 0;
  const hasEducation = Array.isArray((profile as any).education) && (profile as any).education.length > 0;
  const hasSkills = Array.isArray((profile as any).skills) && (profile as any).skills.length > 0;

  return hasName || hasSummary || hasExperience || hasEducation || hasSkills;
}

function isCanonicalSetup(setup: WorkZoInterviewSetup) {
  return (
    setup.source === "onboarding-canonical-cv-extraction" ||
    Number(setup.setupVersion || setup.version || 0) >= 7 ||
    hasUsableResumeProfile(setup)
  );
}

function scoreSetup(setup: WorkZoInterviewSetup) {
  let score = 0;

  const cvText = normalizeSetupCvText(setup);
  const jdText = normalizeSetupJobDescription(setup);

  // CV and resumeProfile are weighted very heavily so a setup with CV
  // can never be beaten by a setup without CV regardless of setupVersion.
  // This prevents the refresh-drops-CV bug where a lower-scored setup
  // without CV text wins the scoreSetup comparison.
  if (cvText) score += 50;
  if (jdText) score += 8;
  if (setup.targetRole || setup.role || setup.jobTitle) score += 5;
  if (hasUsableResumeProfile(setup)) score += 40;
  if (isValidCandidateName(setup.candidateName || setup.resumeProfile?.basics?.name || "")) score += 8;
  if (isCanonicalSetup(setup)) score += 12;
  if (setup.setupVersion || setup.version) score += 2;
  if (getTime(setup)) score += 1;

  // Weight by experience count so a profile with more entries always beats
  // a stale cached profile with fewer — prevents old single-job profiles
  // from overwriting freshly uploaded multi-job CVs on equal base scores.
  const expCount = Array.isArray(setup.resumeProfile?.experience)
    ? setup.resumeProfile.experience.length
    : 0;
  score += Math.min(expCount, 8) * 3;

  return score;
}

export function isValidCandidateName(value: unknown): boolean {
  const text = cleanString(value, 120)
    .replace(/[^A-Za-zÀ-ÖØ-öø-ÿ' .-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text || text.length < 2 || text.length > 60) return false;
  if (/@|www|http|\d/.test(text)) return false;
  if (BLOCKED_NAME_WORDS.test(text)) return false;

  const parts = text.split(" ").filter(Boolean);
  if (parts.length > 4) return false;
  if (parts.some((part) => part.length < 2 && !/^[A-Z]\.?$/.test(part))) return false;

  return true;
}

export function normalizeCandidateName(value: unknown): string {
  const text = cleanString(value, 120)
    .replace(/[^A-Za-zÀ-ÖØ-öø-ÿ' .-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!isValidCandidateName(text)) return "";

  // Extra guard: reject names where EVERY word is title-cased AND the phrase
  // reads like a skill category or CV section (e.g. "Public Relations",
  // "Project Management", "Matplotlib Seaborn Tableau", "Tools Ticketing Systeme").
  // Real names have at least one word that is not a common English noun/adjective.
  const words = text.split(" ").filter(Boolean);
  const SKILL_LIKE_WORDS = /^(public|relations|project|management|critical|thinking|time|effective|communication|programming|tools|ticketing|systeme|remote|support|data|science|machine|learning|visualization|engineering|matplotlib|seaborn|tableau|tensorflow|sklearn|langchain|generative|retrieval|augmented|generation|profil|ubersicht|fähigkeiten|berufserfahrung|ausbildung|kontakt|sprachen)$/i;
  if (words.length >= 2 && words.every(w => SKILL_LIKE_WORDS.test(w))) return "";

  return text;
}

function sanitizeResumeProfile(profile: any, rawCvText = "") {
  if (!profile || typeof profile !== "object") return undefined;

  // ── Structural preservation rule ──────────────────────────────────────────
  // completeResumeProfile runs a dedup/filter pass that can drop valid
  // experience entries when the raw CV text it receives is a formatted context
  // string rather than original PDF text — the filter misidentifies certain
  // job titles or company names as section headers or artifacts.
  //
  // Similarly, enforceCanonicalCandidateName re-scans rawCvText for a name,
  // which can produce garbage ("Unknown Section Header") when rawCvText is a
  // decorated PDF that leads with spaced-caps section headers before the name.
  //
  // Rule: if the incoming profile already has a valid name AND at least one
  // structured section (experience, education, or skills), trust the structure
  // as-is and only clean individual field values — do not re-run the parser.
  // This preserves all experience entries from the original parse regardless
  // of what rawCvText contains.

  const incomingName = cleanString(profile.basics?.name || "", 120);
  const hasValidName = isValidCandidateName(incomingName);
  const hasExperience = Array.isArray(profile.experience) && profile.experience.length > 0;
  const hasEducation = Array.isArray(profile.education) && profile.education.length > 0;
  const hasSkills = Array.isArray(profile.skills) && profile.skills.length > 0;
  const hasStructure = hasExperience || hasEducation || hasSkills;

  // ── Helper: clean all structured fields without touching their count ────
  const cleanStructure = (p: any) => ({
    ...p,
    basics: {
      ...(p.basics || {}),
      name: cleanHumanName(cleanString(p.basics?.name || "", 120)) || cleanString(p.basics?.name || "", 120),
      headline: cleanString(p.basics?.headline || "", 200),
      email: cleanString(p.basics?.email || "", 200),
      phone: cleanString(p.basics?.phone || "", 80),
      location: cleanString(p.basics?.location || "", 200),
      linkedin: cleanString(p.basics?.linkedin || "", 300),
    },
    summary: cleanString(p.summary || "", 2000),
    experience: Array.isArray(p.experience)
      ? p.experience
          .map((e: any) => ({
            title: cleanString(e.title || "", 180),
            company: cleanString(e.company || "", 180),
            location: cleanString(e.location || "", 180),
            dates: cleanString(e.dates || "", 80),
            bullets: Array.isArray(e.bullets)
              ? e.bullets.map((b: any) => cleanString(String(b), 500)).filter(Boolean).slice(0, 10)
              : [],
          }))
          .filter((e: any) => e.title || e.company)
      : [],
    education: Array.isArray(p.education)
      ? p.education
          .map((e: any) => ({
            degree: cleanString(e.degree || "", 180),
            institution: cleanString(e.institution || "", 180),
            location: cleanString(e.location || "", 180),
            dates: cleanString(e.dates || "", 80),
          }))
          .filter((e: any) => e.degree || e.institution)
      : [],
    skills: Array.isArray(p.skills)
      ? p.skills.map((s: any) => cleanString(String(s), 100)).filter(Boolean).slice(0, 80)
      : [],
    projects: Array.isArray(p.projects)
      ? p.projects
          .map((pp: any) => ({
            name: cleanString(pp.name || "", 200),
            bullets: Array.isArray(pp.bullets)
              ? pp.bullets.map((b: any) => cleanString(String(b), 500)).filter(Boolean).slice(0, 6)
              : [],
          }))
          .filter((pp: any) => pp.name)
      : [],
    languages: Array.isArray(p.languages)
      ? p.languages.map((l: any) => cleanString(String(l), 100)).filter(Boolean)
      : [],
    certifications: Array.isArray(p.certifications)
      ? p.certifications.map((cert: any) => cleanString(String(cert), 200)).filter(Boolean)
      : [],
  });

  if (hasValidName && hasStructure) {
    // Fast path: profile is already well-formed. Preserve all entries exactly
    // as parsed — do not re-run completeResumeProfile which can drop entries
    // via its dedup/filter when rawCvText is a formatted context string rather
    // than the original PDF text.
    return cleanStructure(profile) as any;
  }

  if (!hasValidName && hasStructure) {
    // Name is missing or corrupt but structure is good. Preserve all entries,
    // only repair the name using rawCvText or enforceCanonicalCandidateName.
    const cleaned = cleanStructure(profile) as any;
    const repairedName = enforceCanonicalCandidateName(
      { basics: { ...(profile.basics || {}), name: "" } },
      rawCvText || profile.rawText || "",
    ).basics?.name || "";
    cleaned.basics.name = cleanHumanName(repairedName) || normalizeCandidateName(repairedName) || "";
    return cleaned;
  }

  // No structure at all — run full repair pipeline to build from rawCvText.
  // This is the text-paste flow or a completely empty profile.
  const completed = completeResumeProfile(profile, rawCvText || profile.rawText || "");
  const canonical = enforceCanonicalCandidateName(completed, rawCvText || completed.rawText || "");
  canonical.basics.name = cleanHumanName(canonical.basics.name) || normalizeCandidateName(canonical.basics.name) || "";

  const hasStructureAfter = Boolean(
    canonical.experience?.length || canonical.education?.length || canonical.skills?.length || canonical.projects?.length,
  );
  if (!hasStructureAfter && isLowQualityResumeProfile(canonical)) return undefined;

  return canonical;
}

export function sanitizeInterviewSetup(setup: WorkZoInterviewSetup | null | undefined): WorkZoInterviewSetup | null {
  if (!setup) return null;

  const rawCvText = cleanString((setup as any).rawCvText || setup.uploadedCvText || setup.cvText || setup.resumeText || setup.candidateCv || "", 50000);
  const resumeProfile = sanitizeResumeProfile(setup.resumeProfile, rawCvText);
  const profileBasics = (resumeProfile?.basics || {}) as {
    name?: string;
    headline?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
  };

  const candidateName =
    normalizeCandidateName(profileBasics.name) ||
    normalizeCandidateName(setup.candidateName) ||
    "";

  return {
    ...setup,
    rawCvText,
    cvText: setup.cvText || rawCvText,
    uploadedCvText: rawCvText,
    resumeText: setup.resumeText || rawCvText,
    candidateCv: setup.candidateCv || rawCvText,
    jobDescription: normalizeSetupJobDescription(setup),
    jdText: normalizeSetupJobDescription(setup),
    targetRole: normalizeSetupTargetRole(setup) || "General Role",
    role: normalizeSetupTargetRole(setup) || "General Role",
    targetMarket: normalizeSetupTargetMarket(setup),
    country: normalizeSetupTargetMarket(setup),
    recruiterPersonality: normalizeSetupRecruiterPersonality(setup) || (setup as any).recruiterPersonality || "",
    companyStyle: normalizeSetupCompanyStyle(setup),
    candidateName,
    candidateHeadline: cleanString(setup.candidateHeadline || profileBasics.headline, 200),
    candidateEmail: cleanString(setup.candidateEmail || profileBasics.email, 200),
    candidatePhone: cleanString(setup.candidatePhone || profileBasics.phone, 80),
    candidateLocation: cleanString(setup.candidateLocation || profileBasics.location, 200),
    candidateLinkedin: cleanString(setup.candidateLinkedin || profileBasics.linkedin, 300),
    resumeProfile,
  };
}

export function readLatestInterviewSetup(): WorkZoInterviewSetup | null {
  if (typeof window === "undefined") return null;

  const candidates: WorkZoInterviewSetup[] = [];

  for (const key of SETUP_KEYS) {
    const local = safeParse(window.localStorage.getItem(key));
    const session = safeParse(window.sessionStorage.getItem(key));

    if (local) candidates.push(local);
    if (session) candidates.push(session);
  }

  if (!candidates.length) return null;

  // Deduplicate: when saveLatestInterviewSetup writes the same payload to all
  // keys simultaneously, we end up with 8+ identical entries. Collapse them by
  // updatedAt + recruiterPersonality so the sort operates on genuinely distinct
  // saves, not on duplicates of the same save inflating a particular entry's
  // apparent weight.
  const seen = new Set<string>();
  const unique = candidates.filter((c) => {
    const fingerprint = `${c.updatedAt || ""}::${c.recruiterPersonality || c.recruiterId || ""}::${String(c.targetRole || "").slice(0, 20)}`;
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });

  const selected =
    unique.sort((a, b) => {
      const ta = getTime(a);
      const tb = getTime(b);
      const timeDiff = tb - ta;

      // GLOBAL FIX: recency ALWAYS wins. The previous 30-second threshold
      // allowed a high-CV-score stale entry to beat a fresh recruiter
      // selection when both were saved within the same 30s window — which
      // is exactly what happens during normal onboarding flow (save → user
      // changes recruiter → save again, all within seconds).
      //
      // Score is only a tiebreaker when two entries were saved at the exact
      // same millisecond (same-second writes from simultaneous key updates).
      // In all other cases, the more recently saved entry is correct.
      if (timeDiff !== 0) return timeDiff;
      return scoreSetup(b) - scoreSetup(a);
    })[0] || null;

  return sanitizeInterviewSetup(selected);
}

export function saveLatestInterviewSetup(setup: WorkZoInterviewSetup): WorkZoInterviewSetup {
  const sanitized = sanitizeInterviewSetup(setup) || setup;

  const payload: WorkZoInterviewSetup = {
    ...sanitized,
    updatedAt: new Date().toISOString(),
    setupVersion: Number(sanitized.setupVersion || sanitized.version || 8),
    source: sanitized.source || "onboarding-canonical-cv-extraction",
  };

  if (typeof window === "undefined") {
    return payload;
  }

  for (const key of SETUP_KEYS) {
    window.localStorage.setItem(key, JSON.stringify(payload));
  }

  window.sessionStorage.setItem("workzoInterviewSetup", JSON.stringify(payload));

  for (const key of LEGACY_KEYS_TO_CLEAR) {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  }

  return payload;
}

export function clearLatestInterviewSetup(): void {
  if (typeof window === "undefined") return;

  for (const key of [...SETUP_KEYS, ...LEGACY_KEYS_TO_CLEAR]) {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  }
}

export function normalizeSetupCvText(setup: WorkZoInterviewSetup | null | undefined): string {
  if (!setup) return "";

  // Prefer the raw extracted CV text over the formatted interview context string.
  // setup.cvText is the built context ("Candidate name: X\nHeadline: Y\n...")
  // which is useful for the interview but not for CV improve / cover letter.
  // setup.rawCvText and setup.uploadedCvText are the original extracted text.
  return cleanString(
    (setup as any).rawCvText ||
      (setup as any).uploadedCvText ||
      setup.cvText ||
      setup.uploadedCvText ||
      setup.resumeText ||
      setup.candidateCv ||
      "",
    50000,
  );
}

export function normalizeSetupJobDescription(setup: WorkZoInterviewSetup | null | undefined): string {
  if (!setup) return "";

  return cleanString(setup.jobDescription || setup.jdText || "", 50000);
}

export function normalizeSetupTargetRole(setup: WorkZoInterviewSetup | null | undefined): string {
  if (!setup) return "";

  return cleanString(
    setup.targetRole ||
      setup.role ||
      setup.jobTitle ||
      setup.resumeProfile?.basics?.headline ||
      "",
    200,
  );
}

export function normalizeSetupTargetMarket(setup: WorkZoInterviewSetup | null | undefined): string {
  if (!setup) return "global";

  return cleanString(setup.targetMarket || setup.country || "global", 80) || "global";
}

export function normalizeSetupRecruiterPersonality(
  setup: WorkZoInterviewSetup | null | undefined,
): string {
  if (!setup) return "";
  // Never hardcode a default recruiter here — the caller decides the fallback.
  // Returning "" lets buildSetupFromStorage fall back to its own default (friendly_hr)
  // via normalizeRecruiterId, rather than silently overwriting the user's choice.
  return cleanString(setup.recruiterPersonality || setup.recruiter || "", 80);
}

export function normalizeSetupCompanyStyle(
  setup: WorkZoInterviewSetup | null | undefined,
): string {
  if (!setup) return "global_corporate";

  return cleanString(setup.companyStyle || setup.recruiterStyle || "global_corporate", 120) || "global_corporate";
}
