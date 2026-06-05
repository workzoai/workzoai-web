"use client";

export type WorkZoPlanType = "free" | "premium" | "founder";

export type WorkZoPlanLimits = {
  label: string;
  priceLabel: string;
  interviewsPerMonth: number;
  freeInterviewLimit: number;
  tavusInterviewsPerMonth: number;
  tavusMinutesPerMonth: number;
  liveVoice: boolean;
  vapi: boolean;
  tavus: boolean;
  advancedReports: boolean;
  recruiterMemory: boolean;
  contradictionDetection: boolean;
  evidenceRequests: boolean;
  trustScore: boolean;
  fullHistory: boolean;
  resumeRecovery: boolean;
  exportPdf: boolean;
  improveCv: boolean;
  coverLetter: boolean;
  jobAssist: boolean;
};

export const WORKZO_PLAN_LIMITS: Record<WorkZoPlanType, WorkZoPlanLimits> = {
  free: {
    label: "Free",
    priceLabel: "€0",
    interviewsPerMonth: 2,
    freeInterviewLimit: 2,
    tavusInterviewsPerMonth: 0,
    tavusMinutesPerMonth: 0,
    liveVoice: true,
    vapi: true,
    tavus: false,
    advancedReports: false,
    recruiterMemory: true,
    contradictionDetection: true,
    evidenceRequests: true,
    trustScore: true,
    fullHistory: false,
    resumeRecovery: true,
    exportPdf: false,
    improveCv: false,
    coverLetter: false,
    jobAssist: false,
  },
  premium: {
    label: "Premium",
    priceLabel: "€14.99/month",
    interviewsPerMonth: 25,
    freeInterviewLimit: 2,
    tavusInterviewsPerMonth: 5,
    tavusMinutesPerMonth: 100,
    liveVoice: true,
    vapi: true,
    tavus: true,
    advancedReports: true,
    recruiterMemory: true,
    contradictionDetection: true,
    evidenceRequests: true,
    trustScore: true,
    fullHistory: true,
    resumeRecovery: true,
    exportPdf: true,
    improveCv: true,
    coverLetter: true,
    jobAssist: true,
  },
  founder: {
    label: "Founder",
    priceLabel: "€9.99/month",
    interviewsPerMonth: 25,
    freeInterviewLimit: 2,
    tavusInterviewsPerMonth: 5,
    tavusMinutesPerMonth: 100,
    liveVoice: true,
    vapi: true,
    tavus: true,
    advancedReports: true,
    recruiterMemory: true,
    contradictionDetection: true,
    evidenceRequests: true,
    trustScore: true,
    fullHistory: true,
    resumeRecovery: true,
    exportPdf: true,
    improveCv: true,
    coverLetter: true,
    jobAssist: true,
  },
};

export function normalizeWorkZoPlan(value?: unknown): WorkZoPlanType {
  if (typeof value !== "string") return "free";
  const raw = value.trim().toLowerCase();
  if (raw.includes("founder") || raw.includes("early")) return "founder";
  if (raw.includes("premium") || raw.includes("pro") || raw.includes("paid")) return "premium";
  return "free";
}

export function getWorkZoPlanLimits(plan?: unknown) {
  return WORKZO_PLAN_LIMITS[normalizeWorkZoPlan(plan)];
}

export function isPremiumWorkZoPlan(plan?: unknown) {
  const normalized = normalizeWorkZoPlan(plan);
  return normalized === "premium" || normalized === "founder";
}

export function getWorkZoPlanUpgradeCopy(feature: string) {
  if (feature === "tavus") {
    return {
      title: "Practice with a Real AI Recruiter",
      description: "Premium includes realistic face-to-face AI recruiter interviews. Your AI recruiter speaks, reacts, and follows up like a real hiring manager. Free users can try 2 AI voice interviews before upgrading.",
    };
  }

  if (feature === "advancedReports") {
    return {
      title: "Unlock the full report",
      description: "Log in to see your preview. Premium unlocks full results, history, progress tracking, exports, and advanced insights.",
    };
  }

  if (feature === "freeLimit" || feature === "monthlyLimit") {
    return {
      title: "You used your 2 free interviews",
      description: "Upgrade to Premium for 25 interviews/month, AI video recruiter interviews, full history, and premium career tools.",
    };
  }

  if (feature === "premiumFeature") {
    return {
      title: "Premium feature",
      description: "Improve CV, cover letters, job assist, full history, and advanced reports are available for Premium users.",
    };
  }

  return {
    title: "Unlock WorkZo Premium",
    description: "Get 25 interviews/month, AI video recruiters, full reports, progress tracking, and premium career tools.",
  };
}
