"use client";

export type WorkZoPlanType = "free" | "premium" | "founder";

export type WorkZoPlanLimits = {
  label: string;
  priceLabel: string;
  interviewsPerMonth: number;
  tavusInterviewsPerMonth: number;
  tavusMinutesPerMonth: number;
  liveVoice: boolean;
  tavus: boolean;
  advancedReports: boolean;
  recruiterMemory: boolean;
  contradictionDetection: boolean;
  evidenceRequests: boolean;
  trustScore: boolean;
  fullHistory: boolean;
  resumeRecovery: boolean;
  exportPdf: boolean;
};

export const WORKZO_PLAN_LIMITS: Record<WorkZoPlanType, WorkZoPlanLimits> = {
  free: {
    label: "Free",
    priceLabel: "€0",
    interviewsPerMonth: 3,
    tavusInterviewsPerMonth: 0,
    tavusMinutesPerMonth: 0,
    liveVoice: true,
    tavus: false,
    advancedReports: false,
    recruiterMemory: false,
    contradictionDetection: false,
    evidenceRequests: false,
    trustScore: false,
    fullHistory: false,
    resumeRecovery: true,
    exportPdf: false,
  },
  premium: {
    label: "Premium",
    priceLabel: "€14.99/month",
    interviewsPerMonth: 25,
    tavusInterviewsPerMonth: 5,
    tavusMinutesPerMonth: 100,
    liveVoice: true,
    tavus: true,
    advancedReports: true,
    recruiterMemory: true,
    contradictionDetection: true,
    evidenceRequests: true,
    trustScore: true,
    fullHistory: true,
    resumeRecovery: true,
    exportPdf: true,
  },
  founder: {
    label: "Founder",
    priceLabel: "€9.99/month",
    interviewsPerMonth: 25,
    tavusInterviewsPerMonth: 5,
    tavusMinutesPerMonth: 100,
    liveVoice: true,
    tavus: true,
    advancedReports: true,
    recruiterMemory: true,
    contradictionDetection: true,
    evidenceRequests: true,
    trustScore: true,
    fullHistory: true,
    resumeRecovery: true,
    exportPdf: true,
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
      title: "Unlock video recruiter interviews",
      description: "Premium includes realistic video recruiter practice with monthly Tavus credits.",
    };
  }
  if (feature === "advancedReports") {
    return {
      title: "Unlock advanced interview reports",
      description: "Get recruiter trust analysis, contradiction detection, evidence quality, and coaching.",
    };
  }
  if (feature === "monthlyLimit") {
    return {
      title: "You reached your free interview limit",
      description: "Upgrade to Premium for 25 interviews/month, advanced reports, recruiter memory, and video recruiter credits.",
    };
  }
  return {
    title: "Unlock WorkZo Premium",
    description: "Practice with stronger recruiter intelligence, evidence requests, trust score, advanced reports, and video recruiter credits.",
  };
}
