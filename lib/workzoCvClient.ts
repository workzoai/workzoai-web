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
  language?: string;
}): Promise<StructureCvResult> {
  const cvText = (input.cvText || "").trim();
  const jobDescription = (input.jobDescription || "").trim();

  // Important safety guard:
  // Never call /api/cv with empty CV and empty JD.
  if (!cvText && !jobDescription) {
    return {
      recruiterMemoryProfile: null,
      jobMemoryProfile: null,
      confidence: "skipped",
    };
  }

  try {
    const response = await fetch("/api/cv", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cvText,
        jobDescription,
        targetRole: input.targetRole || "General Role",
        targetMarket: input.targetMarket || "Global",
        language: input.language || "English",
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        recruiterMemoryProfile: null,
        jobMemoryProfile: null,
        confidence: "fallback",
        error: data?.error || "Recruiter memory extraction failed.",
      };
    }

    return {
      recruiterMemoryProfile: data.recruiterMemoryProfile || null,
      jobMemoryProfile: data.jobMemoryProfile || null,
      confidence: data.confidence || "medium",
    };
  } catch (error) {
    return {
      recruiterMemoryProfile: null,
      jobMemoryProfile: null,
      confidence: "fallback",
      error:
        error instanceof Error
          ? error.message
          : "Recruiter memory extraction failed.",
    };
  }
}

export async function buildAndSaveInterviewSetup(input: {
  cvText: string;
  jobDescription: string;
  targetRole: string;
  targetMarket: string;
  companyStyle?: string;
  recruiterPersonality?: string;
  language?: string;
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
    language: input.language || "English",
  });

  const payload: WorkZoInterviewSetup = {
    ...(input.baseSetup || {}),
    cvText,
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
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || "CV structure extraction failed.");
  }

  return data;
}
