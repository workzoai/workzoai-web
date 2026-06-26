import {
  saveLatestInterviewSetup,
  type JobMemoryProfile,
  type RecruiterMemoryProfile,
  type WorkZoInterviewSetup,
} from "@/lib/workzoInterviewSetup";

export type StructureCvResult = {
  recruiterMemoryProfile: RecruiterMemoryProfile | null;
  jobMemoryProfile: JobMemoryProfile | null;
  confidence?: "high" | "medium" | "low" | "fallback" | "skipped";
  error?: string;
};

export async function buildRecruiterMemoryFromCv(input: {
  cvText: string;
  jobDescription: string;
  targetRole: string;
  targetMarket: string;
  fileName?: string;
  candidateName?: string;
  resumeProfile?: unknown;
  language?: string;
}) {
  /**
   * Architecture fix: this function NO LONGER calls /api/cv.
   *
   * recruiterMemoryProfile is a structured view of data already present in
   * resumeProfile — it never needed a separate parser round-trip.
   *
   * /api/cv is called EXACTLY ONCE: when the user uploads a file.
   * This function reads from the resumeProfile that first call returned.
   *
   * Call eliminated:
   *   handleCvUpload → buildAndSaveInterviewSetup → buildRecruiterMemoryFromCv
   *   → fetch("/api/cv")  ← REMOVED (was 2nd/3rd /api/cv call per upload)
   */
  const jobDescription = (input.jobDescription || "").trim();
  const targetRole = input.targetRole || "General Role";
  const targetMarket = input.targetMarket || "Global";

  const jobMemoryProfile = (jobDescription || targetRole)
    ? { targetRole, role: targetRole, targetMarket, country: targetMarket, jobDescription, jdText: jobDescription }
    : null;

  // Build recruiterMemoryProfile directly from the already-parsed resumeProfile.
  const p = input.resumeProfile as Record<string, unknown> | null | undefined;
  if (p && typeof p === "object" && "basics" in p) {
    const basics = (p.basics || {}) as Record<string, unknown>;
    const recruiterMemoryProfile = {
      candidateName: String(basics.name || input.candidateName || ""),
      candidateHeadline: String(basics.headline || ""),
      candidateEmail: String(basics.email || ""),
      candidatePhone: String(basics.phone || ""),
      candidateLocation: String(basics.location || ""),
      candidateLinkedin: String(basics.linkedin || ""),
      summary: String(p.summary || ""),
      skills: Array.isArray(p.skills) ? p.skills : [],
      experience: Array.isArray(p.experience) ? p.experience : [],
      education: Array.isArray(p.education) ? p.education : [],
      projects: Array.isArray(p.projects) ? p.projects : [],
      languages: Array.isArray(p.languages) ? p.languages : [],
      certifications: Array.isArray(p.certifications) ? p.certifications : [],
    };
    return { recruiterMemoryProfile, jobMemoryProfile, confidence: "high" };
  }

  // No structured profile — return minimal memory from raw text inputs.
  // Handles text-paste flow where no resumeProfile exists yet.
  const fallbackMemory = input.candidateName
    ? {
        candidateName: input.candidateName,
        candidateHeadline: "", candidateEmail: "", candidatePhone: "",
        candidateLocation: "", candidateLinkedin: "", summary: "",
        skills: [], experience: [], education: [],
        projects: [], languages: [], certifications: [],
      }
    : null;

  return { recruiterMemoryProfile: fallbackMemory, jobMemoryProfile, confidence: "low" };
}

export async function buildAndSaveInterviewSetup(input: {
  cvText: string;
  jobDescription: string;
  targetRole: string;
  targetMarket: string;
  companyStyle?: string;
  recruiterPersonality?: string;
  fileName?: string;
  candidateName?: string;
  language?: string;
  resumeProfile?: unknown;
  save?: boolean;
  baseSetup?: WorkZoInterviewSetup;
}): Promise<WorkZoInterviewSetup> {
  const cvText = (input.cvText || "").trim();
  const jobDescription = (input.jobDescription || "").trim();

  const structured = await buildRecruiterMemoryFromCv({
    cvText,
    jobDescription,
    targetRole: input.targetRole || "General Role",
    targetMarket: input.targetMarket || "Global",
    fileName: input.fileName || "",
    candidateName: input.candidateName || "",
    resumeProfile: input.resumeProfile || input.baseSetup?.resumeProfile || undefined,
    language: input.language || "English",
  });

  // GLOBAL FIX: resumeProfile MUST be carried through to the saved payload.
  // Previously this object spread baseSetup (which has resumeProfile) but then
  // never re-declared resumeProfile, so any field in baseSetup would survive —
  // BUT saveLatestInterviewSetup → sanitizeInterviewSetup was reading
  // rawCvText from setup fields first, and the spread order meant a stale
  // rawCvText from baseSetup could shadow the fresh cvText. More critically,
  // when buildAndSaveInterviewSetup is called WITHOUT a baseSetup (e.g. from
  // the text-paste flow), resumeProfile was simply absent from the payload
  // entirely, causing activeSetup.resumeProfile = null on the interview page
  // and making ALL structured employer extraction fall back to broken regex.
  const resolvedResumeProfile =
    input.resumeProfile ||
    (input.baseSetup as WorkZoInterviewSetup & { resumeProfile?: unknown })?.resumeProfile ||
    undefined;

  const payload: WorkZoInterviewSetup = {
    ...(input.baseSetup || {}),
    cvText,
    rawCvText: cvText,
    uploadedCvText: cvText,
    resumeText: cvText,
    candidateCv: cvText,
    jobDescription,
    jdText: jobDescription,
    targetRole: input.targetRole || input.baseSetup?.targetRole || "General Role",
    role: input.targetRole || input.baseSetup?.role || "General Role",
    targetMarket: input.targetMarket || input.baseSetup?.targetMarket || "Global",
    country: input.targetMarket || input.baseSetup?.country || "Global",
    companyStyle: input.companyStyle || input.baseSetup?.companyStyle || "Realistic",
    recruiterPersonality:
      input.recruiterPersonality || input.baseSetup?.recruiterPersonality || "analytical_hiring_manager",
    language: input.language || input.baseSetup?.language || "English",
    resumeProfile: resolvedResumeProfile,
    recruiterMemoryProfile: structured.recruiterMemoryProfile,
    jobMemoryProfile: structured.jobMemoryProfile,
    source: input.baseSetup?.source || "onboarding-canonical-cv-extraction",
    setupVersion: Math.max(Number(input.baseSetup?.setupVersion || 0), 8),
    updatedAt: new Date().toISOString(),
  };

  if (input.save === false) {
    return payload;
  }

  return saveLatestInterviewSetup(payload);
}


export async function structureResumeProfileFromCv(input: {
  cvText: string;
  layoutText?: string;
  jobDescription?: string;
  targetRole?: string;
  targetMarket?: string;
  fileName?: string;
  // Previously resolved candidate name — passed so the structure route
  // doesn't re-derive a wrong name from pasted/layout text that lacks header signals.
  candidateName?: string;
}) {
  const response = await fetch("/api/cv/structure", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      cvText: input.cvText || "",
      layoutText: input.layoutText || "",
      jobDescription: input.jobDescription || "",
      targetRole: input.targetRole || "General Role",
      targetMarket: input.targetMarket || "Global",
      fileName: input.fileName || "",
      candidateName: input.candidateName || "",
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || "CV structure extraction failed.");
  }

  return data;
}
