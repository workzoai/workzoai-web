"use client";

export type JobMemoryProfile = {
  targetRole?: string;
  role?: string;
  jobTitle?: string;
  targetMarket?: string;
  country?: string;
  companyName?: string;
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
  companyStyle?: string;
  recruiterStyle?: string;
  recruiterPersonality?: string;
  recruiter?: string;
  language?: string;

  candidateName?: string;
  candidateHeadline?: string;
  candidateEmail?: string;
  candidatePhone?: string;
  candidateLocation?: string;
  candidateLinkedin?: string;

  resumeProfile?: any;
  jobMemory?: JobMemoryProfile;
  recruiterMemory?: RecruiterMemoryProfile;

  source?: string;
  setupVersion?: number;
  setupId?: string;
  updatedAt?: string;
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

function scoreSetup(setup: WorkZoInterviewSetup) {
  let score = 0;

  if (setup.cvText || setup.uploadedCvText || setup.resumeText || setup.candidateCv) score += 20;
  if (setup.jobDescription || setup.jdText) score += 8;
  if (setup.targetRole || setup.role || setup.jobTitle) score += 5;
  if (setup.resumeProfile) score += 5;
  if (setup.candidateName || setup.candidateEmail) score += 3;
  if (setup.setupVersion || setup.version) score += 2;
  if (getTime(setup)) score += 1;

  return score;
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

  return candidates.sort((a, b) => {
    const scoreDiff = scoreSetup(b) - scoreSetup(a);
    if (scoreDiff !== 0) return scoreDiff;
    return getTime(b) - getTime(a);
  })[0] || null;
}

export function saveLatestInterviewSetup(setup: WorkZoInterviewSetup): WorkZoInterviewSetup {
  const payload: WorkZoInterviewSetup = {
    ...setup,
    updatedAt: new Date().toISOString(),
    setupVersion: Number(setup.setupVersion || setup.version || 6),
  };

  if (typeof window === "undefined") {
    return payload;
  }

  for (const key of SETUP_KEYS.slice(0, 5)) {
    window.localStorage.setItem(key, JSON.stringify(payload));
  }

  window.sessionStorage.setItem("workzoInterviewSetup", JSON.stringify(payload));

  return payload;
}

export function clearLatestInterviewSetup(): void {
  if (typeof window === "undefined") return;

  for (const key of SETUP_KEYS) {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  }
}

export function normalizeSetupCvText(setup: WorkZoInterviewSetup | null | undefined): string {
  if (!setup) return "";

  return String(
    setup.cvText ||
      setup.uploadedCvText ||
      setup.resumeText ||
      setup.candidateCv ||
      "",
  );
}

export function normalizeSetupJobDescription(setup: WorkZoInterviewSetup | null | undefined): string {
  if (!setup) return "";

  return String(setup.jobDescription || setup.jdText || "");
}

export function normalizeSetupTargetRole(setup: WorkZoInterviewSetup | null | undefined): string {
  if (!setup) return "";

  return String(
    setup.targetRole ||
      setup.role ||
      setup.jobTitle ||
      setup.resumeProfile?.basics?.headline ||
      "",
  );
}

export function normalizeSetupTargetMarket(setup: WorkZoInterviewSetup | null | undefined): string {
  if (!setup) return "global";

  return String(setup.targetMarket || setup.country || "global");
}

export function normalizeSetupRecruiterPersonality(
  setup: WorkZoInterviewSetup | null | undefined,
): string {
  if (!setup) return "sarah";

  return String(setup.recruiterPersonality || setup.recruiter || "sarah");
}

export function normalizeSetupCompanyStyle(
  setup: WorkZoInterviewSetup | null | undefined,
): string {
  if (!setup) return "global_corporate";

  return String(setup.companyStyle || setup.recruiterStyle || "global_corporate");
}
