export type MarketType =
  | "Global"
  | "Germany"
  | "US"
  | "UK"
  | "India"
  | "Netherlands";

export type CompanyStyle =
  | "Realistic"
  | "Startup"
  | "Corporate"
  | "Technical"
  | "Consulting";

export type RecruiterPersonality =
  | "friendly_hr"
  | "analytical_hiring_manager"
  | "startup_recruiter"
  | "corporate_recruiter"
  | "pressure_interviewer"
  | string;

export interface BehaviorProfile {
  market: MarketType;
  companyStyle: CompanyStyle;
  recruiterTone: string;
  focusAreas: string[];
  interruptionStyle: string;
  preferredAnswerStyle: string;
  contradictionSensitivity: number;
  pressureMultiplier: number;
  followUpStyle: string;
  scoringWeights: {
    confidence: number;
    relevance: number;
    structure: number;
    evidence: number;
    clarity: number;
  };
  followUpExamples: string[];
  redFlags: string[];
}

export function normalizeMarket(value?: string): MarketType {
  const normalized = (value || "Global").toLowerCase();

  if (normalized.includes("germany")) return "Germany";
  if (
    normalized === "us" ||
    normalized.includes("united states") ||
    normalized.includes("usa")
  ) {
    return "US";
  }
  if (normalized === "uk" || normalized.includes("united kingdom")) return "UK";
  if (normalized.includes("india")) return "India";
  if (normalized.includes("netherlands") || normalized.includes("dutch")) {
    return "Netherlands";
  }

  return "Global";
}

export function normalizeCompanyStyle(value?: string): CompanyStyle {
  const normalized = (value || "Realistic").toLowerCase();

  if (normalized.includes("startup")) return "Startup";
  if (normalized.includes("corporate")) return "Corporate";
  if (normalized.includes("technical")) return "Technical";
  if (normalized.includes("consulting")) return "Consulting";

  return "Realistic";
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function getRecruiterTone(personality?: RecruiterPersonality) {
  switch (personality) {
    case "friendly_hr":
      return "warm, supportive, communication-focused, but still honest";
    case "analytical_hiring_manager":
      return "analytical, evidence-driven, direct about weak proof";
    case "startup_recruiter":
      return "fast-paced, ownership-focused, practical, and slightly impatient with vague answers";
    case "corporate_recruiter":
      return "structured, professional, process-focused, and concise";
    case "pressure_interviewer":
      return "challenging, skeptical, interruption-heavy, and focused on pressure handling";
    default:
      return "balanced, realistic, and professional";
  }
}

export function getBehaviorProfile(
  marketInput?: string,
  companyStyleInput?: string,
  recruiterPersonality?: RecruiterPersonality
): BehaviorProfile {
  const market = normalizeMarket(marketInput);
  const companyStyle = normalizeCompanyStyle(companyStyleInput);

  const baseProfiles: Record<MarketType, BehaviorProfile> = {
    Global: {
      market: "Global",
      companyStyle,
      recruiterTone: "balanced and realistic",
      focusAreas: ["clarity", "relevance", "confidence", "truthfulness"],
      interruptionStyle: "moderate",
      preferredAnswerStyle: "clear, structured, and relevant",
      contradictionSensitivity: 0.72,
      pressureMultiplier: 1,
      followUpStyle: "balanced evidence probing",
      scoringWeights: {
        confidence: 1,
        relevance: 1,
        structure: 1,
        evidence: 1,
        clarity: 1,
      },
      followUpExamples: [
        "Can you make that more specific?",
        "What was the measurable result?",
        "How does this connect to the role?",
      ],
      redFlags: ["vague answers", "unsupported metrics", "role mismatch"],
    },

    Germany: {
      market: "Germany",
      companyStyle,
      recruiterTone: "structured, precise, professional, and process-oriented",
      focusAreas: [
        "precision",
        "process",
        "timeline clarity",
        "role fit",
        "truthfulness",
      ],
      interruptionStyle: "direct but professional",
      preferredAnswerStyle: "logical, concise, fact-based, and process-oriented",
      contradictionSensitivity: 0.95,
      pressureMultiplier: 1.18,
      followUpStyle: "detail validation and process clarification",
      scoringWeights: {
        confidence: 0.9,
        relevance: 1.05,
        structure: 1.25,
        evidence: 1.1,
        clarity: 1.2,
      },
      followUpExamples: [
        "Can you explain the exact process you followed?",
        "What was your responsibility versus the team’s responsibility?",
        "What was the timeline and outcome?",
      ],
      redFlags: [
        "unclear timeline",
        "overclaiming responsibility",
        "missing process detail",
      ],
    },

    US: {
      market: "US",
      companyStyle,
      recruiterTone: "confident, impact-driven, and outcome-focused",
      focusAreas: [
        "business impact",
        "leadership",
        "initiative",
        "confidence",
        "measurable results",
      ],
      interruptionStyle: "fast-paced and impact-driven",
      preferredAnswerStyle: "confident, concise, and backed by measurable outcomes",
      contradictionSensitivity: 0.82,
      pressureMultiplier: 1.1,
      followUpStyle: "impact and ownership probing",
      scoringWeights: {
        confidence: 1.25,
        relevance: 1.05,
        structure: 1,
        evidence: 1.2,
        clarity: 1,
      },
      followUpExamples: [
        "What was the business result?",
        "How did you personally move the outcome?",
        "What would your manager say was your biggest contribution?",
      ],
      redFlags: ["weak impact", "low ownership", "unclear business value"],
    },

    UK: {
      market: "UK",
      companyStyle,
      recruiterTone: "professional, composed, clear, and politely challenging",
      focusAreas: [
        "communication",
        "stakeholder handling",
        "structure",
        "team fit",
        "relevance",
      ],
      interruptionStyle: "polite but firm",
      preferredAnswerStyle: "clear, concise, professional, and well-structured",
      contradictionSensitivity: 0.78,
      pressureMultiplier: 1,
      followUpStyle: "clarification and communication probing",
      scoringWeights: {
        confidence: 1,
        relevance: 1.1,
        structure: 1.1,
        evidence: 1,
        clarity: 1.2,
      },
      followUpExamples: [
        "Can you clarify your exact role in that situation?",
        "How did you communicate with stakeholders?",
        "What was the outcome for the team or customer?",
      ],
      redFlags: [
        "unclear communication",
        "weak stakeholder awareness",
        "overly long answers",
      ],
    },

    India: {
      market: "India",
      companyStyle,
      recruiterTone: "evaluative, skill-focused, achievement-oriented, and direct",
      focusAreas: [
        "technical capability",
        "ownership",
        "problem solving",
        "execution",
        "adaptability",
      ],
      interruptionStyle: "assertive and depth-focused",
      preferredAnswerStyle: "detailed, example-driven, and technically credible",
      contradictionSensitivity: 0.82,
      pressureMultiplier: 1.12,
      followUpStyle: "depth probing and execution validation",
      scoringWeights: {
        confidence: 1,
        relevance: 1.05,
        structure: 1,
        evidence: 1.15,
        clarity: 1,
      },
      followUpExamples: [
        "What exactly did you implement?",
        "What challenge did you face and how did you solve it?",
        "What skills from your background prove you can do this role?",
      ],
      redFlags: [
        "generic project explanation",
        "unclear technical depth",
        "unsupported achievements",
      ],
    },

    Netherlands: {
      market: "Netherlands",
      companyStyle,
      recruiterTone: "direct, practical, honest, and no-fluff",
      focusAreas: [
        "practical execution",
        "ownership",
        "simplicity",
        "directness",
        "team collaboration",
      ],
      interruptionStyle: "straightforward and practical",
      preferredAnswerStyle: "direct, practical, concise, and specific",
      contradictionSensitivity: 0.86,
      pressureMultiplier: 1.02,
      followUpStyle: "practical validation",
      scoringWeights: {
        confidence: 1,
        relevance: 1.15,
        structure: 1,
        evidence: 1.1,
        clarity: 1.15,
      },
      followUpExamples: [
        "What did you actually do yourself?",
        "Can you explain that more simply?",
        "What was the practical result?",
      ],
      redFlags: [
        "fluffy wording",
        "unclear ownership",
        "overcomplicated answers",
      ],
    },
  };

  const profile: BehaviorProfile = {
    ...baseProfiles[market],
    focusAreas: [...baseProfiles[market].focusAreas],
    followUpExamples: [...baseProfiles[market].followUpExamples],
    redFlags: [...baseProfiles[market].redFlags],
    scoringWeights: { ...baseProfiles[market].scoringWeights },
  };

  profile.companyStyle = companyStyle;
  profile.recruiterTone = `${getRecruiterTone(
    recruiterPersonality
  )}; market behavior: ${profile.recruiterTone}`;

  switch (companyStyle) {
    case "Startup":
      profile.focusAreas.push("speed", "initiative", "ambiguity handling", "ownership");
      profile.redFlags.push("slow execution", "low ownership", "needs too much structure");
      profile.followUpExamples.push(
        "What did you personally own from start to finish?",
        "How quickly did you move from problem to action?",
        "How did you handle ambiguity without waiting for instructions?"
      );
      profile.pressureMultiplier += 0.28;
      profile.followUpStyle = "ownership, speed, and ambiguity challenge";
      profile.scoringWeights.confidence += 0.1;
      profile.scoringWeights.relevance += 0.1;
      break;

    case "Corporate":
      profile.focusAreas.push(
        "process",
        "governance",
        "stakeholders",
        "collaboration",
        "professionalism"
      );
      profile.redFlags.push(
        "poor stakeholder handling",
        "unclear escalation",
        "weak process discipline"
      );
      profile.followUpExamples.push(
        "Who were the stakeholders and how did you manage expectations?",
        "What process did you follow?",
        "How did you escalate or communicate risk?"
      );
      profile.followUpStyle = "process and stakeholder validation";
      profile.scoringWeights.structure += 0.15;
      profile.scoringWeights.clarity += 0.1;
      break;

    case "Technical":
      profile.focusAreas.push(
        "technical depth",
        "accuracy",
        "tradeoffs",
        "implementation detail"
      );
      profile.redFlags.push(
        "buzzwords without implementation",
        "unclear technical tradeoffs",
        "shallow explanation"
      );
      profile.followUpExamples.push(
        "What was the technical approach?",
        "What tradeoff did you make and why?",
        "How would you debug or improve that solution?"
      );
      profile.contradictionSensitivity += 0.08;
      profile.followUpStyle = "technical depth and accuracy probing";
      profile.scoringWeights.evidence += 0.2;
      profile.scoringWeights.clarity += 0.05;
      break;

    case "Consulting":
      profile.focusAreas.push(
        "structured thinking",
        "frameworks",
        "stakeholder communication",
        "client impact"
      );
      profile.redFlags.push(
        "unstructured answer",
        "weak client impact",
        "poor prioritization"
      );
      profile.followUpExamples.push(
        "Can you structure that in three clear steps?",
        "What was the stakeholder or customer impact?",
        "How did you prioritize the problem?"
      );
      profile.followUpStyle = "structured consulting-style probing";
      profile.pressureMultiplier += 0.18;
      profile.scoringWeights.structure += 0.25;
      profile.scoringWeights.clarity += 0.15;
      break;

    default:
      profile.followUpExamples.push("Can you connect that more clearly to this role?");
      break;
  }

  profile.focusAreas = unique(profile.focusAreas);
  profile.redFlags = unique(profile.redFlags);
  profile.followUpExamples = unique(profile.followUpExamples);
  profile.contradictionSensitivity = Math.min(1, profile.contradictionSensitivity);

  return profile;
}

export function behaviorSummary(profile: BehaviorProfile) {
  return [
    `Market: ${profile.market}`,
    `Company style: ${profile.companyStyle}`,
    `Tone: ${profile.recruiterTone}`,
    `Focus areas: ${profile.focusAreas.join(", ")}`,
    `Preferred answer style: ${profile.preferredAnswerStyle}`,
    `Follow-up style: ${profile.followUpStyle}`,
    `Interruption style: ${profile.interruptionStyle}`,
    `Red flags: ${profile.redFlags.join(", ")}`,
  ].join("\n");
}
