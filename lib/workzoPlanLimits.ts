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
  // LinkedIn Career Optimizer, tiered Analyze -> Improve -> Master.
  | "linkedin_analyze"
  | "linkedin_rewrite"
  | "linkedin_recruiter_sim"
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
  /** Monthly cap on total AI voice interview minutes. This is the primary
   *  consumer value metric, session counts are secondary. 0 = no voice access. */
  voiceMinutesPerMonth: number;
  videoRecruiter: boolean;
  videoRecruiterInterviewsPerMonth: number;
  video: boolean;
  videoInterviewsPerMonth: number;
  videoMinutesPerMonth: number;
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
    badge: "Free Forever",
    positioning: "Find the gap",

    description: "Try one complete AI voice interview and see where your answers lose recruiter confidence.",
    bestFor: "Anyone who wants to know what recruiters actually see",

    interviewsPerMonth: 1,
    voiceInterviewsPerMonth: 1,
    unlimitedVoiceInterviews: false,
    voiceMinutesPerMonth: 15,
    videoRecruiter: false,
    videoRecruiterInterviewsPerMonth: 0,
    video: false,
    videoInterviewsPerMonth: 0,
    videoMinutesPerMonth: 0,
    advancedReports: false,
    interviewHistory: false,
    improveCv: true,
    coverLetter: true,
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
      "1 complete AI voice interview",
      "CV-aware recruiter questions",
      "Real-time follow-ups based on your answers",
      "Basic STAR Method scorecard",
      "Basic interview report",
      "Score, pace, and filler word analysis",
      "Standard public recruiter personas",
      "Free CV Review",
      "AI Resume Tailor",
      "Cover Letter Generator",
      "Interview Question Generator",
      "Professional Summary Generator",
      "LinkedIn basic audit: CV consistency, missing skills, and mismatch warnings",
    ],
    notIncluded: [
      "Full recruiter debrief (hiring committee memo, shadow scores)",
      "Answer-by-answer coaching",
      "Targeted skill drills",
      "Personalized improvement suggestions",
      "Full session history (unlimited)",
      "Job analysis tool",
      "Career Brain",
      "Hiring readiness score",
      "AI improvement suggestions",
      "Session replay and deep analysis",
      "Premium recruiter personas",
      "LinkedIn AI headline and About rewrites",
      "LinkedIn recruiter-search simulation",
      "Live AI video recruiter",
    ],
  },
  premium: {
    id: "premium",
    label: "Premium",
    shortLabel: "Practice Daily",
    priceLabel: "€29.99/month",
    monthlyPriceLabel: "€29.99/month",
    yearlyPriceLabel: "€224.99/year",
    yearlySavingsLabel: "Save about 37% yearly",
    badge: "Most Popular",
    positioning: "Everything needed to close the gap",
    description: "Practice every other day with 120 AI voice minutes, top-up boosts when you need more, and unlimited career tools for active job applications.",
    bestFor: "Candidates actively interviewing or about to start",
    interviewsPerMonth: 999999,
    voiceInterviewsPerMonth: 999999,
    unlimitedVoiceInterviews: true,
    voiceMinutesPerMonth: 120,
    videoRecruiter: false,
    videoRecruiterInterviewsPerMonth: 0,
    video: false,
    videoInterviewsPerMonth: 0,
    videoMinutesPerMonth: 0,
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
      "120 AI voice minutes / month (top-ups available)",
      "Natural low-latency AI voice interviews",
      "Unlimited interview reports",
      "Full session history",
      "Unlimited Resume / CV optimization",
      "Unlimited ATS analysis",
      "Unlimited cover letters",
      "Unlimited job matching and preparation",
      "Career Brain",
      "Multi-session trend tracking (basic memory)",
      "Trust score timeline per session",
      "Hiring readiness score",
      "Advanced recruiter intelligence",
      "Unlimited LinkedIn audits",
      "AI LinkedIn headline and About rewrites",
      "CV-verified LinkedIn keyword recommendations",
    ],
    notIncluded: [
      "AI video interviews",
      "Premium recruiter personas",
      "Advanced performance analysis",
      "Session replay & deep analysis",
      "Priority AI models",
      "LinkedIn recruiter-search simulation",
      "Early access to new features",
    ],
  },
  premium_pro: {
    id: "premium_pro",
    label: "Premium Pro",
    shortLabel: "Master Interviews",
    priceLabel: "€59.99/month",
    monthlyPriceLabel: "€59.99/month",
    yearlyPriceLabel: "€449.99/year",
    yearlySavingsLabel: "Save about 37% yearly",
    badge: "Full System",
    positioning: "From first session to signed offer",
    description: "The full WorkZo system: 240 AI voice minutes, 60 AI video minutes (early access), advanced performance analysis, and multi-session history.",
    bestFor: "Senior candidates, management applicants, and career changers",
    interviewsPerMonth: 999999,
    voiceInterviewsPerMonth: 999999,
    unlimitedVoiceInterviews: true,
    voiceMinutesPerMonth: 240,
    videoRecruiter: true,
    videoRecruiterInterviewsPerMonth: 999999,
    video: true,
    videoInterviewsPerMonth: 999999,
    videoMinutesPerMonth: 60,
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
      "240 AI voice minutes / month (top-ups available)",
      "60 AI video minutes / month (early access)",
      "Detailed interview feedback",
      "Advanced performance analysis",
      "Multi-session interview history",
      "AI improvement suggestions",
      "Premium recruiter personas",
      "Priority AI Models",
      "Early Access Features",
      "Advanced LinkedIn recruiter-search simulation",
      "Multi-role LinkedIn positioning variants",
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
      return "free";
    case "improve_cv":
    case "cover_letter":
    // Analyze tier: the consistency + JD-match engines are deterministic and
    // cost nothing to run, so they stay free. They are NOT login-free, though:
    // both read the parsed CV, and the CV lives behind auth. This is the one
    // place the "every free tool works without login" rule cannot hold, because
    // the thing that makes the feature differentiated is the thing that
    // requires an account.
    case "linkedin_analyze":
      return "free";
    case "interview_history":
    case "advanced_reports":
    case "job_assist":
    case "ats_optimization":
    case "career_brain":
    case "performance_tracking":
    case "hiring_readiness":
    case "exports":
    // Improve tier: rewriting the headline and About section costs an LLM call.
    case "linkedin_rewrite":
      return "premium";
    case "video_recruiter":
    case "premium_personas":
    case "career_coach":
    case "career_roadmaps":
    case "replay_intelligence":
    case "priority_models":
    case "early_access":
    // Master tier: item 10, the recruiter simulation. Reserved, not yet built.
    case "linkedin_recruiter_sim":
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

  if (normalized.includes("video") || normalized.includes("avatar") || normalized.includes("video") || normalized.includes("coach") || normalized.includes("pro")) {
    return {
      eyebrow: "Premium Pro",
      title: "Unlock the full Premium Pro system",
      description:
        "Get the full WorkZo experience with 240 AI voice minutes, AI video practice (early access), advanced performance analysis, and priority models.",
      bullets: [
        "240 AI voice minutes / month (top-ups available)",
        "60 AI video minutes / month (early access)",
        "Advanced performance analysis + multi-session history",
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
      "Get 120 AI voice minutes a month, advanced reports, Career Brain, CV improvement, cover letters, and job preparation tools.",
    bullets: ["120 AI voice minutes per month", "Advanced recruiter reports", "Career Brain", "Improve CV, Cover Letter, and Job Assist"],
    cta: "Upgrade to Premium",
    plan: "premium" as WorkZoPlanType,
  };
}
