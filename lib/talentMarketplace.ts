export type WiriTier = "employer-ready" | "minor-coaching" | "needs-improvement" | "early-stage";
export type MarketplaceVisibility = "private" | "organization" | "verified_employers";
export type CampaignStatus = "draft" | "active" | "paused" | "closed";
export type ShortlistStatus = "shortlisted" | "reviewing" | "invited" | "interviewing" | "offer" | "hired" | "rejected" | "archived";
export type CopilotMode = "summary" | "recommendation" | "risk" | "questions" | "technical_round" | "hr_round" | "comparison";

export type MarketplaceCandidate = {
  id: string;
  userId: string;
  name: string;
  email?: string;
  role: string;
  location: string;
  country?: string;
  city?: string;
  availability: string;
  languages: string[];
  skills: string[];
  projects?: string[];
  education?: string;
  university?: string;
  graduationYear?: string;
  experienceLevel?: string;
  visaStatus?: string;
  salaryExpectation?: string;
  openToRelocation?: boolean;
  openToInternships?: boolean;
  openToGraduatePrograms?: boolean;
  preferredWorkMode?: "remote" | "hybrid" | "onsite" | "flexible";
  visibility: MarketplaceVisibility;
  verified: boolean;
  identityVerified?: boolean;
  cvVerified?: boolean;
  interviewVerified?: boolean;
  technicalVerified?: boolean;
  passportEnabled: boolean;
  passportSlug?: string;
  wiri: number;
  wiriTier: WiriTier;
  readiness: number;
  sessions: number;
  improvement: number;
  consistency: number;
  lastActive: string;
  summary: string;
  evidence: string[];
  risks: string[];
  wiriBreakdown: Record<string, number>;
  competencySnapshot: Record<string, number>;
  journey: Array<{ label: string; value?: number; done: boolean; date?: string }>;
};

export type HiringCampaign = {
  id: string;
  organizationId: string;
  employerName: string;
  title: string;
  jobDescription: string;
  role: string;
  industry?: string;
  location: string;
  country?: string;
  city?: string;
  remote: boolean;
  languages: string[];
  experienceLevel: string;
  skills: string[];
  status: CampaignStatus;
  targetHires?: number;
  createdAt: string;
  updatedAt?: string;
};

export type TalentMatch = {
  candidate: MarketplaceCandidate;
  matchScore: number;
  band: "excellent" | "strong" | "good" | "low";
  reasons: string[];
  cautions: string[];
  breakdown: Record<string, number>;
};

export type MarketplaceFilters = {
  q?: string;
  role?: string;
  skills?: string[];
  languages?: string[];
  location?: string;
  country?: string;
  city?: string;
  minWiri?: number;
  minConfidence?: number;
  minCommunication?: number;
  minTechnical?: number;
  verifiedOnly?: boolean;
  availability?: string;
  experienceLevel?: string;
  visaStatus?: string;
  openToRelocation?: boolean;
  openToInternships?: boolean;
  openToGraduatePrograms?: boolean;
};

export function clampScore(value: unknown, fallback = 0): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function avg(values: number[], fallback = 0): number {
  const clean = values.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  if (!clean.length) return fallback;
  return clampScore(clean.reduce((a, b) => a + b, 0) / clean.length, fallback);
}

export function wiriTierFor(score: number): WiriTier {
  if (score >= 90) return "employer-ready";
  if (score >= 80) return "minor-coaching";
  if (score >= 60) return "needs-improvement";
  return "early-stage";
}

export function tierLabel(tier: WiriTier): string {
  if (tier === "employer-ready") return "Employer Ready";
  if (tier === "minor-coaching") return "Ready with Minor Coaching";
  if (tier === "needs-improvement") return "Needs Improvement";
  return "Early Preparation Stage";
}

export function normalizeText(text: string): string {
  return String(text || "").toLowerCase().replace(/[^a-z0-9+#.\s-]/g, " ").replace(/\s+/g, " ").trim();
}

export function tokenize(text: string): string[] {
  return Array.from(new Set(normalizeText(text).split(/\s+/).filter((x) => x.length >= 2)));
}

export function containsAny(text: string, terms: string[]): boolean {
  const n = normalizeText(text);
  return terms.some((term) => n.includes(normalizeText(term)));
}

export function extractSkillsFromJD(jd: string): string[] {
  const dictionary = [
    "python", "sql", "excel", "tableau", "power bi", "looker", "react", "next.js", "typescript", "javascript", "java", "node", "aws", "azure", "gcp", "sap", "salesforce", "crm", "itil", "o365", "windows", "linux", "kubernetes", "docker", "machine learning", "nlp", "llm", "api", "rest", "graphql", "etl", "elt", "stakeholder", "customer success", "project management", "agile", "scrum", "data analysis", "communication", "leadership", "german", "english", "french", "spanish", "dutch", "powerpoint", "presentation", "customer support", "service desk", "helpdesk", "figma", "ux", "product management"
  ];
  const lower = normalizeText(jd);
  return dictionary.filter((skill) => lower.includes(normalizeText(skill)));
}

export function inferRoleFromJD(jd: string): string {
  const t = normalizeText(jd);
  if (/data analyst|business analyst|analytics|bi analyst/.test(t)) return "Data Analyst";
  if (/data scientist|machine learning|ml engineer/.test(t)) return "Data Scientist";
  if (/software engineer|frontend|backend|full stack|developer/.test(t)) return "Software Engineer";
  if (/customer success|account manager|implementation|success manager/.test(t)) return "Customer Success Manager";
  if (/it support|service desk|helpdesk|desktop|technical support/.test(t)) return "IT Support Specialist";
  if (/project manager|scrum master|delivery|program manager/.test(t)) return "Project Manager";
  if (/sales|business development|account executive/.test(t)) return "Sales / Business Development";
  if (/marketing|growth|social media/.test(t)) return "Marketing Specialist";
  return "Open Role";
}

export function inferIndustryFromJD(jd: string): string {
  const t = normalizeText(jd);
  if (containsAny(t, ["bank", "finance", "fintech", "insurance"])) return "Finance";
  if (containsAny(t, ["health", "medical", "hospital", "pharma"])) return "Healthcare";
  if (containsAny(t, ["automotive", "vehicle", "mobility", "manufacturing"])) return "Automotive / Manufacturing";
  if (containsAny(t, ["retail", "ecommerce", "e-commerce"])) return "Retail / E-commerce";
  if (containsAny(t, ["education", "university", "bootcamp"])) return "Education";
  return "General";
}

export function calculateWiriFromSignals(input: {
  cvQuality?: number;
  jobFit?: number;
  interviewPerformance?: number;
  communication?: number;
  technicalCompetency?: number;
  confidence?: number;
  evidenceQuality?: number;
  improvementTrend?: number;
  interviewConsistency?: number;
}): { wiri: number; breakdown: Record<string, number> } {
  const breakdown = {
    cvQuality: clampScore(input.cvQuality, 70),
    jobFit: clampScore(input.jobFit, 70),
    interviewPerformance: clampScore(input.interviewPerformance, 70),
    communication: clampScore(input.communication, 70),
    technicalCompetency: clampScore(input.technicalCompetency, 70),
    confidence: clampScore(input.confidence, 70),
    evidenceQuality: clampScore(input.evidenceQuality, 70),
    improvementTrend: clampScore(input.improvementTrend, 70),
    interviewConsistency: clampScore(input.interviewConsistency, 70),
  };
  const wiri = clampScore(
    breakdown.cvQuality * 0.08 +
    breakdown.jobFit * 0.14 +
    breakdown.interviewPerformance * 0.18 +
    breakdown.communication * 0.14 +
    breakdown.technicalCompetency * 0.14 +
    breakdown.confidence * 0.10 +
    breakdown.evidenceQuality * 0.12 +
    breakdown.improvementTrend * 0.05 +
    breakdown.interviewConsistency * 0.05
  );
  return { wiri, breakdown };
}

export function scoreVariance(scores: number[]): number {
  const clean = scores.map(Number).filter(Number.isFinite);
  if (clean.length < 2) return 0;
  const m = clean.reduce((a, b) => a + b, 0) / clean.length;
  return clean.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / clean.length;
}

export function consistencyFromScores(scores: number[]): number {
  const variance = scoreVariance(scores);
  return clampScore(100 - Math.sqrt(variance) * 3, 75);
}

export function calculateTalentMatch(candidate: MarketplaceCandidate, campaign: Pick<HiringCampaign, "jobDescription" | "skills" | "role" | "languages" | "location" | "experienceLevel" | "remote">): TalentMatch {
  const jdSkills = campaign.skills.length ? campaign.skills : extractSkillsFromJD(campaign.jobDescription);
  const candidateSkillTokens = new Set(candidate.skills.flatMap(tokenize));
  const jdSkillTokens = new Set(jdSkills.flatMap(tokenize));
  const skillOverlap = [...jdSkillTokens].filter((x) => candidateSkillTokens.has(x));
  const skillCoverage = jdSkillTokens.size ? Math.round((skillOverlap.length / jdSkillTokens.size) * 100) : 65;

  const roleTokens = new Set(tokenize(campaign.role || inferRoleFromJD(campaign.jobDescription)));
  const candidateRoleTokens = new Set(tokenize(candidate.role || ""));
  const roleOverlap = [...roleTokens].filter((x) => candidateRoleTokens.has(x));
  const roleFit = roleOverlap.length ? 90 : clampScore(candidate.competencySnapshot.jobFit || candidate.wiri, 70);

  const languageFit = campaign.languages.length === 0 ? 85 : Math.round((campaign.languages.filter((l) => candidate.languages.join(" ").toLowerCase().includes(l.toLowerCase())).length / campaign.languages.length) * 100);
  const locationFit = campaign.remote || normalizeText(candidate.location).includes("remote") || normalizeText(candidate.location).includes(normalizeText(campaign.location)) ? 90 : 65;
  const interviewFit = avg([candidate.wiri, candidate.readiness, candidate.competencySnapshot.communication || 0, candidate.competencySnapshot.confidence || 0], candidate.wiri);
  const evidenceFit = avg([candidate.competencySnapshot.evidenceImpact || 0, candidate.wiriBreakdown.evidenceQuality || 0], 70);
  const growthFit = clampScore(70 + Math.max(0, candidate.improvement), 75);
  const verificationBoost = candidate.verified ? 5 : 0;

  const breakdown = {
    wiri: candidate.wiri,
    skills: clampScore(skillCoverage),
    role: clampScore(roleFit),
    language: clampScore(languageFit),
    location: clampScore(locationFit),
    interviewEvidence: clampScore(evidenceFit),
    growth: clampScore(growthFit),
    consistency: clampScore(candidate.consistency || candidate.wiriBreakdown.interviewConsistency || 75),
  };
  const matchScore = clampScore(
    breakdown.wiri * 0.25 +
    breakdown.skills * 0.22 +
    breakdown.role * 0.15 +
    breakdown.language * 0.10 +
    breakdown.location * 0.06 +
    breakdown.interviewEvidence * 0.12 +
    breakdown.growth * 0.05 +
    breakdown.consistency * 0.05 +
    verificationBoost
  );

  const reasons: string[] = [];
  const cautions: string[] = [];
  if (candidate.wiri >= 90) reasons.push(`WIRI ${candidate.wiri}: employer-ready interview performance`);
  else if (candidate.wiri >= 80) reasons.push(`WIRI ${candidate.wiri}: strong readiness with minor coaching`);
  if (skillOverlap.length) reasons.push(`Matches required skills: ${skillOverlap.slice(0, 6).join(", ")}`);
  if (roleFit >= 80) reasons.push(`Role alignment with ${campaign.role || "target role"}`);
  if (languageFit >= 80) reasons.push("Language requirements are covered");
  if ((candidate.competencySnapshot.communication || 0) >= 75) reasons.push("Strong communication signal from interview evidence");
  if (evidenceFit >= 75) reasons.push("Uses evidence-backed examples in interview answers");
  if (candidate.improvement >= 10) reasons.push(`Improved by +${candidate.improvement}% across practice sessions`);

  const missingSkills = [...jdSkillTokens].filter((x) => !candidateSkillTokens.has(x)).slice(0, 5);
  if (!candidate.verified) cautions.push("Candidate is not fully verified yet");
  if (missingSkills.length) cautions.push(`Less visible in profile: ${missingSkills.join(", ")}`);
  if ((candidate.competencySnapshot.evidenceImpact || 80) < 65) cautions.push("Evidence quality needs review in the next round");
  if ((candidate.consistency || 80) < 65) cautions.push("Interview consistency is not yet stable");

  const band = matchScore >= 85 ? "excellent" : matchScore >= 75 ? "strong" : matchScore >= 60 ? "good" : "low";
  return { candidate, matchScore, band, reasons: reasons.slice(0, 7), cautions: cautions.slice(0, 5), breakdown };
}

export function filterCandidates(candidates: MarketplaceCandidate[], filters: MarketplaceFilters): MarketplaceCandidate[] {
  const q = normalizeText(filters.q || "");
  return candidates.filter((c) => {
    const haystack = normalizeText([c.name, c.role, c.location, c.country, c.city, c.skills.join(" "), c.languages.join(" "), c.summary, c.university, c.experienceLevel].join(" "));
    if (q && !haystack.includes(q)) return false;
    if (filters.role && !normalizeText(c.role).includes(normalizeText(filters.role))) return false;
    if (filters.location && !normalizeText(c.location).includes(normalizeText(filters.location))) return false;
    if (filters.country && normalizeText(c.country || "").includes(normalizeText(filters.country)) === false && !normalizeText(c.location).includes(normalizeText(filters.country))) return false;
    if (filters.city && !normalizeText(c.city || c.location).includes(normalizeText(filters.city))) return false;
    if (filters.minWiri && c.wiri < filters.minWiri) return false;
    if (filters.minConfidence && (c.competencySnapshot.confidence || 0) < filters.minConfidence) return false;
    if (filters.minCommunication && (c.competencySnapshot.communication || 0) < filters.minCommunication) return false;
    if (filters.minTechnical && (c.competencySnapshot.technical || c.competencySnapshot.evidenceImpact || 0) < filters.minTechnical) return false;
    if (filters.verifiedOnly && !c.verified) return false;
    if (filters.availability && !normalizeText(c.availability).includes(normalizeText(filters.availability))) return false;
    if (filters.experienceLevel && !normalizeText(c.experienceLevel || "").includes(normalizeText(filters.experienceLevel))) return false;
    if (filters.visaStatus && !normalizeText(c.visaStatus || "").includes(normalizeText(filters.visaStatus))) return false;
    if (filters.openToRelocation === true && !c.openToRelocation) return false;
    if (filters.openToInternships === true && !c.openToInternships) return false;
    if (filters.openToGraduatePrograms === true && !c.openToGraduatePrograms) return false;
    if (filters.skills?.length && !filters.skills.every((s) => c.skills.join(" ").toLowerCase().includes(s.toLowerCase()))) return false;
    if (filters.languages?.length && !filters.languages.every((l) => c.languages.join(" ").toLowerCase().includes(l.toLowerCase()))) return false;
    return true;
  });
}

export function buildCopilotOutput(candidate: MarketplaceCandidate, mode: CopilotMode, context?: { role?: string; jd?: string; comparison?: MarketplaceCandidate[] }): string[] {
  const name = candidate.name || "This candidate";
  const role = context?.role || candidate.role || "the target role";
  const strengths = candidate.evidence?.length ? candidate.evidence.slice(0, 4) : ["completed realistic WorkZo interviews", "has measurable interview readiness data"];
  const risks = candidate.risks?.length ? candidate.risks.slice(0, 4) : ["No major risk detected from available interview evidence"];
  if (mode === "questions") {
    return [
      `Ask ${name}: “Walk me through one project that is most relevant to ${role}.”`,
      "Ask for one measurable achievement and require STAR structure.",
      "Ask a follow-up on the weakest competency shown in the WorkZo evidence.",
      "Ask one role-specific technical question based on the JD and candidate skills.",
      "Ask what they would improve if they repeated the interview today."
    ];
  }
  if (mode === "technical_round") {
    return [
      `Technical round focus for ${name}: validate ${candidate.skills.slice(0, 4).join(", ") || "role-specific skills"}.`,
      "Start with a practical scenario, then ask for trade-offs and debugging steps.",
      "Score technical depth, clarity, evidence, and ability to explain decisions to non-technical stakeholders.",
      "Include one gap-check question around any caution listed in the match result."
    ];
  }
  if (mode === "hr_round") {
    return [
      `HR round focus for ${name}: motivation, availability, communication maturity, and culture fit.`,
      "Ask why this company and why this role now.",
      "Ask for a conflict/teamwork story using STAR.",
      "Confirm language comfort, work authorization, availability, and relocation preference."
    ];
  }
  if (mode === "risk") {
    return [
      `${name} risk assessment: ${risks.join("; ")}.`,
      candidate.sessions < 2 ? "Recommendation: request one more WorkZo interview before final employer shortlist because score stability is still limited." : "Recommendation: risks can be checked in the next human interview round.",
      (candidate.competencySnapshot.evidenceImpact || 0) < 70 ? "Probe for quantified achievements and real examples." : "Evidence quality is acceptable based on current data."
    ];
  }
  if (mode === "recommendation") {
    return [
      candidate.wiri >= 88 ? `${name} is recommended for shortlist review for ${role}.` : `${name} is promising but should receive targeted coaching before final shortlist for ${role}.`,
      `WIRI ${candidate.wiri}; improvement +${candidate.improvement}%; consistency ${candidate.consistency || candidate.wiriBreakdown.interviewConsistency || "n/a"}.`,
      `Key evidence: ${strengths.join("; ")}.`,
      `Review areas: ${risks.join("; ")}.`
    ];
  }
  if (mode === "comparison" && context?.comparison?.length) {
    const sorted = [...context.comparison].sort((a, b) => b.wiri - a.wiri);
    return [
      `Comparison summary: strongest WIRI is ${sorted[0]?.name} (${sorted[0]?.wiri}).`,
      `Best communication: ${[...context.comparison].sort((a, b) => (b.competencySnapshot.communication || 0) - (a.competencySnapshot.communication || 0))[0]?.name}.`,
      `Best technical signal: ${[...context.comparison].sort((a, b) => ((b.competencySnapshot.technical || b.competencySnapshot.evidenceImpact || 0) - (a.competencySnapshot.technical || a.competencySnapshot.evidenceImpact || 0)))[0]?.name}.`,
      "Use this as a decision aid, not an automatic hiring decision."
    ];
  }
  return [
    `${name} is a ${candidate.role} candidate with WIRI ${candidate.wiri} (${tierLabel(candidate.wiriTier)}).`,
    `Strengths: ${strengths.join("; ")}.`,
    `Risks / coaching areas: ${risks.join("; ")}.`,
    `Recommendation: ${candidate.wiri >= 85 ? "shortlist for employer review" : "coach further before final employer shortlist"}.`
  ];
}

export function sampleMarketplaceCandidates(): MarketplaceCandidate[] {
  const base: MarketplaceCandidate[] = [
    {
      id: "sample-1", userId: "sample-1", name: "Aisha Rahman", email: "", role: "Data Analyst", location: "Berlin / Remote", country: "Germany", city: "Berlin", availability: "Immediately", languages: ["English C1", "German B2"], skills: ["SQL", "Python", "Power BI", "ETL", "Tableau"], projects: ["Sales dashboard", "ETL pipeline"], education: "Data Science Bootcamp", university: "Partner Bootcamp", graduationYear: "2026", experienceLevel: "Junior", visaStatus: "Work permit", salaryExpectation: "Market range", openToRelocation: true, openToInternships: false, openToGraduatePrograms: true, preferredWorkMode: "hybrid", visibility: "verified_employers", verified: true, identityVerified: true, cvVerified: true, interviewVerified: true, technicalVerified: true, passportEnabled: true, passportSlug: "sample-1", wiri: 91, wiriTier: "employer-ready", readiness: 92, sessions: 9, improvement: 18, consistency: 92, lastActive: "2h ago", summary: "Excellent analytical candidate with strong SQL, clear communication, and consistent interview performance.", evidence: ["Explains SQL and ETL decisions clearly", "Uses structured STAR examples", "Connects projects to measurable business impact", "Strong business communication in interview answers"], risks: ["Limited Azure exposure"], wiriBreakdown: { cvQuality: 88, communication: 86, confidence: 88, technicalCompetency: 83, evidenceQuality: 83, jobFit: 91, interviewPerformance: 92, interviewConsistency: 92, improvementTrend: 100 }, competencySnapshot: { communication: 86, confidence: 88, evidenceImpact: 83, jobFit: 91, technical: 83, executivePresence: 78, leadership: 72, star: 85 }, journey: [{ label: "CV Uploaded", done: true }, { label: "CV Improved", done: true }, { label: "Interview 1", value: 58, done: true }, { label: "Interview 2", value: 71, done: true }, { label: "Interview 3", value: 91, done: true }, { label: "Employer Ready", done: true }]
    },
    {
      id: "sample-2", userId: "sample-2", name: "Marco Feld", email: "", role: "IT Support Specialist", location: "Munich", country: "Germany", city: "Munich", availability: "2 weeks", languages: ["German C1", "English B2"], skills: ["ITIL", "Windows", "O365", "ServiceDesk", "Customer Support"], projects: ["Ticket triage workflow"], education: "IT Support Program", university: "Partner University", graduationYear: "2026", experienceLevel: "Junior", visaStatus: "EU", salaryExpectation: "Market range", openToRelocation: false, openToInternships: false, openToGraduatePrograms: true, preferredWorkMode: "onsite", visibility: "verified_employers", verified: true, identityVerified: true, cvVerified: true, interviewVerified: true, technicalVerified: false, passportEnabled: true, passportSlug: "sample-2", wiri: 84, wiriTier: "minor-coaching", readiness: 84, sessions: 7, improvement: 11, consistency: 88, lastActive: "1d ago", summary: "Strong support profile with confident troubleshooting examples and good customer communication.", evidence: ["Clear troubleshooting process", "Strong customer communication", "Good ServiceDesk/ITSM vocabulary"], risks: ["Needs slightly deeper escalation examples"], wiriBreakdown: { cvQuality: 82, communication: 82, confidence: 81, technicalCompetency: 76, evidenceQuality: 76, jobFit: 86, interviewPerformance: 84, interviewConsistency: 88, improvementTrend: 92 }, competencySnapshot: { communication: 82, confidence: 81, evidenceImpact: 76, jobFit: 86, technical: 76, executivePresence: 68, leadership: 71, star: 76 }, journey: [{ label: "CV Uploaded", done: true }, { label: "CV Improved", done: true }, { label: "Interview 1", value: 63, done: true }, { label: "Interview 2", value: 76, done: true }, { label: "Interview 3", value: 84, done: true }, { label: "Employer Ready", done: true }]
    },
    {
      id: "sample-3", userId: "sample-3", name: "Lea Schneider", email: "", role: "Customer Success Manager", location: "Hamburg / Remote", country: "Germany", city: "Hamburg", availability: "1 month", languages: ["German C2", "English C1"], skills: ["CRM", "Stakeholder Management", "Onboarding", "SAP", "Project Management"], projects: ["Customer onboarding playbook"], education: "Business Program", university: "Partner University", graduationYear: "2025", experienceLevel: "Junior", visaStatus: "EU", salaryExpectation: "Market range", openToRelocation: true, openToInternships: false, openToGraduatePrograms: true, preferredWorkMode: "hybrid", visibility: "organization", verified: true, identityVerified: false, cvVerified: true, interviewVerified: true, technicalVerified: false, passportEnabled: false, wiri: 88, wiriTier: "minor-coaching", readiness: 88, sessions: 6, improvement: 15, consistency: 86, lastActive: "4h ago", summary: "Strong communication and stakeholder profile for customer-facing roles.", evidence: ["Good customer empathy", "Clear project ownership examples", "Strong stakeholder communication"], risks: ["Technical depth should be checked for complex SaaS roles"], wiriBreakdown: { cvQuality: 85, communication: 90, confidence: 86, technicalCompetency: 72, evidenceQuality: 82, jobFit: 89, interviewPerformance: 88, interviewConsistency: 86, improvementTrend: 95 }, competencySnapshot: { communication: 90, confidence: 86, evidenceImpact: 82, jobFit: 89, technical: 72, executivePresence: 82, leadership: 80, star: 83 }, journey: [{ label: "CV Uploaded", done: true }, { label: "CV Improved", done: true }, { label: "Interview 1", value: 62, done: true }, { label: "Interview 2", value: 78, done: true }, { label: "Interview 3", value: 88, done: true }, { label: "Employer Ready", done: true }]
    }
  ];
  return base;
}
