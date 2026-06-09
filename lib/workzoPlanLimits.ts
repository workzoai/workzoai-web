export type WorkZoPlanType = "free" | "premium" | "premium_pro";
export type WorkZoBillingCycle = "monthly" | "yearly";

export type WorkZoFeatureKey =
  | "voice_interview"
  | "recruiter_intelligence"
  | "follow_up_questions"
  | "basic_reports"
  | "advanced_reports"
  | "interview_history"
  | "improve_cv"
  | "cover_letter"
  | "job_assist"
  | "ats_optimization"
  | "career_brain"
  | "performance_tracking"
  | "hiring_readiness"
  | "video_recruiter"
  | "premium_personas"
  | "career_coach"
  | "career_roadmaps"
  | "replay_intelligence"
  | "priority_models"
  | "early_access"
  | "exports";

export type WorkZoPlanLimits = {
  id: WorkZoPlanType;
  label: string;
  shortLabel: string;
  priceLabel: string;
  monthlyPriceLabel: string;
  yearlyPriceLabel: string;
  yearlySavingsLabel: string;
  badge?: string;
  positioning: string;
  description: string;
  bestFor: string;
  interviewsPerMonth: number;
  voiceInterviewsPerMonth: number;
  unlimitedVoiceInterviews: boolean;
  videoRecruiter: boolean;
  videoRecruiterInterviewsPerMonth: number;
  tavus: boolean;
  tavusInterviewsPerMonth: number;
  tavusMinutesPerMonth: number;
  advancedReports: boolean;
  interviewHistory: boolean;
  improveCv: boolean;
  coverLetter: boolean;
  jobAssist: boolean;
  atsOptimization: boolean;
  careerBrain: boolean;
  performanceTracking: boolean;
  hiringReadiness: boolean;
  premiumPersonas: boolean;
  careerCoach: boolean;
  careerRoadmaps: boolean;
  replayIntelligence: boolean;
  priorityModels: boolean;
  earlyAccess: boolean;
  exports: boolean;
  included: string[];
  notIncluded: string[];
};

export const WORKZO_PLAN_LIMITS: Record<WorkZoPlanType, WorkZoPlanLimits> = {
  free: {
    id: "free",
    label: "Free",
    shortLabel: "Try WorkZo",
    priceLabel: "€0",
    monthlyPriceLabel: "€0",
    yearlyPriceLabel: "€0",
    yearlySavingsLabel: "",
    badge: "Get Started",
    positioning: "Basic interview experience",
    description: "Try realistic voice interview practice before upgrading.",
    bestFor: "Trying WorkZo AI",
    interviewsPerMonth: 2,
    voiceInterviewsPerMonth: 2,
    unlimitedVoiceInterviews: false,
    videoRecruiter: false,
    videoRecruiterInterviewsPerMonth: 0,
    tavus: false,
    tavusInterviewsPerMonth: 0,
    tavusMinutesPerMonth: 0,
    advancedReports: false,
    interviewHistory: true,
    improveCv: false,
    coverLetter: false,
    jobAssist: false,
    atsOptimization: false,
    careerBrain: false,
    performanceTracking: false,
    hiringReadiness: false,
    premiumPersonas: false,
    careerCoach: false,
    careerRoadmaps: false,
    replayIntelligence: false,
    priorityModels: false,
    earlyAccess: false,
    exports: false,
    included: [
      "2 Voice AI Interviews / month",
      "Recruiter intelligence trial",
      "Realistic follow-up questions",
      "Basic interview report",
      "Limited interview history",
      "Standard recruiter",
    ],
    notIncluded: [
      "CV Improvement",
      "Cover Letter Generator",
      "Job Assist",
      "ATS Optimization",
      "Career Brain",
      "Live AI Video Recruiter",
      "AI Career Coach",
    ],
  },
  premium: {
    id: "premium",
    label: "Premium",
    shortLabel: "Complete Preparation",
    priceLabel: "€19.99/month",
    monthlyPriceLabel: "€19.99/month",
    yearlyPriceLabel: "€149.99/year",
    yearlySavingsLabel: "Save about 37% yearly",
    badge: "Most Popular",
    positioning: "Complete interview and application preparation",
    description: "Prepare, improve applications, and practice with advanced recruiter intelligence.",
    bestFor: "Most job seekers",
    interviewsPerMonth: 50,
    voiceInterviewsPerMonth: 50,
    unlimitedVoiceInterviews: false,
    videoRecruiter: false,
    videoRecruiterInterviewsPerMonth: 0,
    tavus: false,
    tavusInterviewsPerMonth: 0,
    tavusMinutesPerMonth: 0,
    advancedReports: true,
    interviewHistory: true,
    improveCv: true,
    coverLetter: true,
    jobAssist: true,
    atsOptimization: true,
    careerBrain: true,
    performanceTracking: true,
    hiringReadiness: true,
    premiumPersonas: false,
    careerCoach: false,
    careerRoadmaps: false,
    replayIntelligence: false,
    priorityModels: false,
    earlyAccess: false,
    exports: true,
    included: [
      "50 Voice AI Interviews / month",
      "Advanced recruiter intelligence",
      "CV Improvement",
      "Cover Letter Generator",
      "Job Assist",
      "ATS Optimization",
      "Career Brain memory",
      "Advanced interview reports",
      "Unlimited interview history",
      "Hiring readiness insights",
      "Performance tracking",
      "Weakness and strength detection",
    ],
    notIncluded: [
      "Live AI Video Recruiter",
      "Premium recruiter personas",
      "AI Career Coach",
      "Personalized career roadmaps",
      "Interview replay intelligence",
      "Priority AI models",
    ],
  },
  premium_pro: {
    id: "premium_pro",
    label: "Premium Pro",
    shortLabel: "Full Career Support",
    priceLabel: "€39.99/month",
    monthlyPriceLabel: "€39.99/month",
    yearlyPriceLabel: "€299.99/year",
    yearlySavingsLabel: "Save about 37% yearly",
    badge: "Best Experience",
    positioning: "AI Career Coach + Live AI Recruiter",
    description: "The complete WorkZo experience with video recruiter minutes and AI career coaching.",
    bestFor: "Serious job seekers and career changers",
    interviewsPerMonth: 999999,
    voiceInterviewsPerMonth: 999999,
    unlimitedVoiceInterviews: true,
    videoRecruiter: true,
    videoRecruiterInterviewsPerMonth: 999999,
    tavus: true,
    tavusInterviewsPerMonth: 999999,
    tavusMinutesPerMonth: 60,
    advancedReports: true,
    interviewHistory: true,
    improveCv: true,
    coverLetter: true,
    jobAssist: true,
    atsOptimization: true,
    careerBrain: true,
    performanceTracking: true,
    hiringReadiness: true,
    premiumPersonas: true,
    careerCoach: true,
    careerRoadmaps: true,
    replayIntelligence: true,
    priorityModels: true,
    earlyAccess: true,
    exports: true,
    included: [
      "Everything in Premium",
      "Unlimited Voice AI Interviews",
      "60 Live AI Recruiter Minutes / month",
      "Live AI Video Recruiter",
      "Premium recruiter personas",
      "AI Career Coach",
      "30 / 60 / 90 day career roadmaps",
      "Progress trends and coaching priorities",
      "Interview replay intelligence",
      "Hiring readiness insights",
      "Priority AI models",
      "Early access features",
      "Full career support experience",
    ],
    notIncluded: [],
  },
};

export const WORKZO_PLAN_ORDER: WorkZoPlanType[] = ["free", "premium", "premium_pro"];

export function normalizeWorkZoPlan(value: unknown): WorkZoPlanType {
  const raw = String(value || "").toLowerCase().replace(/[-\s]+/g, "_");
  if (raw.includes("premium_pro") || raw.includes("pro") || raw.includes("full")) return "premium_pro";
  if (raw.includes("premium") || raw.includes("paid")) return "premium";
  return "free";
}

export function normalizeWorkZoBillingCycle(value: unknown): WorkZoBillingCycle {
  const raw = String(value || "").toLowerCase();
  return raw.includes("year") || raw.includes("annual") ? "yearly" : "monthly";
}

export function getWorkZoPlanLimits(plan: unknown): WorkZoPlanLimits {
  return WORKZO_PLAN_LIMITS[normalizeWorkZoPlan(plan)];
}

export function getWorkZoPlanRank(plan: unknown) {
  const normalized = normalizeWorkZoPlan(plan);
  if (normalized === "premium_pro") return 2;
  if (normalized === "premium") return 1;
  return 0;
}

export function isWorkZoPlanAtLeast(currentPlan: unknown, requiredPlan: WorkZoPlanType) {
  return getWorkZoPlanRank(currentPlan) >= getWorkZoPlanRank(requiredPlan);
}

export function getWorkZoPlanPriceLabel(plan: unknown, billingCycle: unknown = "monthly") {
  const limits = getWorkZoPlanLimits(plan);
  return normalizeWorkZoBillingCycle(billingCycle) === "yearly" ? limits.yearlyPriceLabel : limits.monthlyPriceLabel;
}

export function getWorkZoFeatureRequiredPlan(feature: WorkZoFeatureKey): WorkZoPlanType {
  switch (feature) {
    case "voice_interview":
    case "recruiter_intelligence":
    case "follow_up_questions":
    case "basic_reports":
    case "interview_history":
      return "free";
    case "advanced_reports":
    case "improve_cv":
    case "cover_letter":
    case "job_assist":
    case "ats_optimization":
    case "career_brain":
    case "performance_tracking":
    case "hiring_readiness":
    case "exports":
      return "premium";
    case "video_recruiter":
    case "premium_personas":
    case "career_coach":
    case "career_roadmaps":
    case "replay_intelligence":
    case "priority_models":
    case "early_access":
      return "premium_pro";
    default:
      return "premium";
  }
}

export function canUseWorkZoFeature(plan: unknown, feature: WorkZoFeatureKey) {
  return isWorkZoPlanAtLeast(plan, getWorkZoFeatureRequiredPlan(feature));
}

export function getWorkZoPlanUpgradeCopy(feature?: string) {
  const normalized = String(feature || "premium").toLowerCase();

  if (normalized.includes("video") || normalized.includes("avatar") || normalized.includes("tavus") || normalized.includes("coach") || normalized.includes("pro")) {
    return {
      eyebrow: "Premium Pro",
      title: "Unlock AI Career Coach + Live AI Recruiter",
      description:
        "Get the full WorkZo experience with unlimited voice interviews, 100 Live AI Recruiter minutes, premium personas, roadmaps, replay intelligence, and priority models.",
      bullets: [
        "100 Live AI Recruiter minutes / month",
        "Unlimited voice interviews",
        "AI Career Coach and career roadmaps",
        "Premium recruiter personas",
      ],
      cta: "Upgrade to Premium Pro",
      plan: "premium_pro" as WorkZoPlanType,
    };
  }

  if (normalized.includes("cv") || normalized.includes("resume")) {
    return {
      eyebrow: "Premium",
      title: "Unlock CV improvement tools",
      description: "Turn interview feedback and job requirements into a stronger, more targeted CV.",
      bullets: ["CV improvement", "ATS optimization", "Job-specific keyword guidance", "Career Brain memory"],
      cta: "Upgrade to Premium",
      plan: "premium" as WorkZoPlanType,
    };
  }

  if (normalized.includes("cover")) {
    return {
      eyebrow: "Premium",
      title: "Unlock cover letter generation",
      description: "Create role-specific cover letters using your CV, target role, and job description.",
      bullets: ["Role-specific cover letters", "CV-aware writing", "Cleaner application story", "Faster job applications"],
      cta: "Upgrade to Premium",
      plan: "premium" as WorkZoPlanType,
    };
  }

  if (normalized.includes("job")) {
    return {
      eyebrow: "Premium",
      title: "Unlock job preparation tools",
      description: "Analyze roles, prepare better answers, and connect your CV to the job more clearly.",
      bullets: ["Job description breakdown", "CV-to-role fit guidance", "Preparation checklist", "Hiring readiness insights"],
      cta: "Upgrade to Premium",
      plan: "premium" as WorkZoPlanType,
    };
  }

  if (normalized.includes("result") || normalized.includes("report") || normalized.includes("trust")) {
    return {
      eyebrow: "Premium",
      title: "Unlock advanced recruiter reports",
      description: "See trust score, weak answers, evidence requests, contradiction notes, and full interview history.",
      bullets: ["Advanced recruiter report", "Trust score", "Weak-answer detection", "Contradiction and evidence notes"],
      cta: "Upgrade to Premium",
      plan: "premium" as WorkZoPlanType,
    };
  }

  return {
    eyebrow: "Premium",
    title: "Unlock complete AI career preparation",
    description:
      "Get 50 voice interviews, advanced reports, Career Brain, CV improvement, cover letters, and job preparation tools.",
    bullets: ["50 interviews per month", "Advanced recruiter reports", "Career Brain", "Improve CV, Cover Letter, and Job Assist"],
    cta: "Upgrade to Premium",
    plan: "premium" as WorkZoPlanType,
  };
}
