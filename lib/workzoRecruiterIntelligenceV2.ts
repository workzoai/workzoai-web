/**
 * workzoRecruiterIntelligenceV2.ts
 *
 * Sprint fixes:
 * 1. extractLikelyCvRole — never returns section headers, contact lines, or skill lists
 * 2. ConcernResolutionEngine — tracks each concern, reduces score on evidence, moves on
 * 3. TopicProgressionEngine — interview roadmap, never repeats same topic
 * 4. CompetencyTracker — marks tested dimensions, routes to untested ones
 * 5. JdGapEngine — pre-computes matched/missing skills, focuses questions there
 * 6. RecruiterMemoryV2 — extended with goals, concerns, strengths, resolvedConcerns
 * 7. Fixed: transitionEvidenceProvided was used but never declared (runtime crash)
 */

export type TranscriptItem = {
  role?: string;
  speaker?: string;
  text?: string;
  time?: string;
};

export type RecruiterIntelligenceSetup = {
  cvText?: string;
  jobDescription?: string;
  targetRole?: string;
  targetMarket?: string;
  companyStyle?: string;
  recruiterPersonality?: string;
  language?: string;
  // Pre-computed recruiter brain context from recruiterBrainEngine.ts —
  // injected by /api/interview/route.ts before each LLM call.
  recruiterBrainContext?: string;
  // Additional fields used by the interview route
  candidateName?: string;
  targetCompany?: string;
  recruiterName?: string;
  recruiterTitle?: string;
  recruiterMemoryProfile?: unknown;
  jobMemoryProfile?: unknown;
  codeSnapshot?: string;
  codeLanguage?: string;
};

// ── Competency dimensions tracked per interview ───────────────────────────────
export type CompetencyId =
  | "intro_background"
  | "career_transition"
  | "customer_management"
  | "technical_depth"
  | "problem_solving"
  | "leadership"
  | "stakeholder_management"
  | "success_metrics"
  | "motivation_fit"
  | "closing";

export type CompetencyStatus = "untested" | "partial" | "tested" | "strong";

export type CompetencyTracker = Record<CompetencyId, CompetencyStatus>;

// ── Concern with resolution state ────────────────────────────────────────────
export type ConcernId =
  | "career_switch"
  | "skill_gap"
  | "experience_depth"
  | "ownership_unclear"
  | "metric_missing"
  | "unsupported_claim"
  | "contradiction";

export type ConcernState = {
  id: ConcernId;
  description: string;
  score: number; // 0 = fully resolved, 100 = unaddressed
  askedCount: number;
  lastEvidence: string;
};

// ── Extended memory with goals, concerns, strengths ───────────────────────────
export type RecruiterMemoryV2 = {
  companies: string[];
  roles: string[];
  skills: string[];
  projects: string[];
  metrics: string[];
  claims: string[];
  contradictions: string[];
  evidenceRequests: string[];
  weakAnswerReasons: string[];
  trustEvents: Array<{ delta: number; reason: string }>;
  nextProbeTopic: string;
  // Extended fields (sprint additions)
  candidateGoals: string[];
  strengths: string[];
  weaknesses: string[];
  resolvedConcerns: ConcernId[];
  activeConcerns: ConcernState[];
  answeredCompetencies: CompetencyId[];
  jdMatchedSkills: string[];
  jdMissingSkills: string[];
  interviewTopicOrder: CompetencyId[];
  currentTopicIndex: number;
};

export type RecruiterDecisionV2 = {
  reply: string;
  memory: RecruiterMemoryV2;
  trustDelta: number;
  interestDelta: number;
  concern: string;
  weakAnswer: boolean;
  contradictionDetected: boolean;
  evidenceRequested: boolean;
  projectDeepDive: boolean;
};

const EMPTY_MEMORY: RecruiterMemoryV2 = {
  companies: [],
  roles: [],
  skills: [],
  projects: [],
  metrics: [],
  claims: [],
  contradictions: [],
  evidenceRequests: [],
  weakAnswerReasons: [],
  trustEvents: [],
  nextProbeTopic: "",
  candidateGoals: [],
  strengths: [],
  weaknesses: [],
  resolvedConcerns: [],
  activeConcerns: [],
  answeredCompetencies: [],
  jdMatchedSkills: [],
  jdMissingSkills: [],
  interviewTopicOrder: [],
  currentTopicIndex: 0,
};

// ── Utilities ─────────────────────────────────────────────────────────────────

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim()
    ? value.replace(/\s+/g, " ").trim()
    : fallback;
}

function lower(value: unknown) {
  return text(value).toLowerCase();
}

function unique(values: string[], limit = 20) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const cleaned = text(raw);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
    if (out.length >= limit) break;
  }
  return out;
}

function hasMetric(value: string) {
  return /\d|%|percent|customers?|tickets?|hours?|days?|weeks?|months?|saved|reduced|increased|improved|revenue|cost|time|quality|sla|csat|nps|conversion|response time/i.test(value);
}

function hasOwnership(value: string) {
  return /\b(i|my|me|personally|owned|built|handled|created|led|resolved|analyzed|analysed|improved|reduced|increased|implemented|designed|managed|coordinated|delivered)\b/i.test(value);
}

function hasOutcome(value: string) {
  return /\b(result|impact|outcome|after|therefore|which led|so that|improved|reduced|increased|saved|achieved|delivered|helped|enabled|satisfied|happy|resolved|closed)\b/i.test(value);
}

function extractMetrics(value: string) {
  const matches = value.match(
    /\b(?:\d+(?:\.\d+)?\s*(?:%|percent|customers?|tickets?|hours?|days?|weeks?|months?|years?|users?|projects?|cases?|minutes?)|(?:saved|reduced|increased|improved)\s+[a-z0-9 %.-]{2,40})\b/gi,
  );
  return unique(matches || [], 12);
}

function extractCompanies(value: string) {
  const vals: string[] = [];
  const patterns = [
    /\b(?:at|with|for|from)\s+([A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*){0,4})\b/g,
    /\b(Zoho|Google|Microsoft|Amazon|Meta|Apple|Tesla|Salesforce|SAP|Oracle|IBM|Deloitte|Accenture|TCS|Infosys|Wipro|CSS Corp|ManageEngine|Belkin|Linksys)\b/gi,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(value))) {
      const company = text(match[1] || match[0])
        .replace(/\b(as|where|when|and|but|because|for|from|in|on|during|between|with|using|to|the|a|an)\b.*$/i, "")
        .trim();
      if (company && !/\b(role|position|job|team|english|german|language|skills|support|engineer|analyst|manager|developer|executive|administrator)\b/i.test(company)) {
        vals.push(company);
      }
    }
  }
  return unique(vals, 12);
}

function extractRoles(value: string) {
  const vals: string[] = [];
  const patterns = [
    /\b(?:as|as a|as an|worked as|working as|role as|position as)\s+(?:a\s+|an\s+)?([A-Za-z][A-Za-z /&+\-.]{3,60})(?=[,.!?]|$|\s+(?:at|with|for|where|and|but|during))/gi,
    /\b(?:Technical Support Engineer|Application Support Engineer|Data Analyst|Data Scientist|Sales Executive|Customer Success Manager|Product Manager|Software Engineer|Project Manager|Business Analyst|IT Support Specialist|IT Specialist|Product Design Engineer|CAD Designer|Customer Service Representative)\b/gi,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(value))) {
      const role = text(match[1] || match[0])
        .replace(/\b(at|with|for|where|and|but|during)\b.*$/i, "")
        .trim();
      if (role && /\b(executive|manager|engineer|analyst|developer|consultant|specialist|lead|support|sales|marketing|product|designer|recruiter|success|administrator|technician|operator)\b/i.test(role)) {
        vals.push(role);
      }
    }
  }
  return unique(vals, 12);
}

function extractSkills(value: string) {
  const known = [
    "SQL", "Python", "Pandas", "Tableau", "Power BI", "Excel", "CRM",
    "ITIL", "ServiceDesk Plus", "ServiceNow", "GCP", "API", "REST API",
    "Machine Learning", "NLP", "Customer Support", "Stakeholder Management",
    "Troubleshooting", "Data Analysis", "Dashboard", "Active Directory",
    "Windows Server", "Networking", "PowerShell", "Linux", "ITSM",
    "Customer Success", "Onboarding", "Renewals", "Account Management",
    "Customer Retention", "CSAT", "NPS", "SLA",
  ];
  return unique(
    known.filter((skill) => new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(value)),
    20,
  );
}

function extractProjects(value: string) {
  const vals: string[] = [];
  const lines = value.split(/[.\n]/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (/\b(project|dashboard|pipeline|scraper|analysis|model|classification|forecast|api|automation|portfolio|bootcamp|capstone)\b/i.test(line)) {
      vals.push(line.slice(0, 140));
    }
  }
  return unique(vals, 10);
}

function extractClaimSummary(answer: string) {
  const parts: string[] = [];
  const companies = extractCompanies(answer);
  const roles = extractRoles(answer);
  const metrics = extractMetrics(answer);
  const skills = extractSkills(answer);
  if (companies.length) parts.push(`company:${companies.join(", ")}`);
  if (roles.length) parts.push(`role:${roles.join(", ")}`);
  if (metrics.length) parts.push(`metric:${metrics.join(", ")}`);
  if (skills.length) parts.push(`skill:${skills.join(", ")}`);
  if (!parts.length && answer.length > 20) parts.push(answer.slice(0, 140));
  return unique(parts, 8);
}

function contextText(setup: RecruiterIntelligenceSetup) {
  return `${setup.cvText || ""}\n${setup.jobDescription || ""}`;
}

function isClaimSupported(claim: string, setup: RecruiterIntelligenceSetup) {
  const evidence = lower(contextText(setup));
  if (!evidence) return true;
  const cleanClaim = claim.toLowerCase().replace(/^(company|role|metric|skill):/i, "").replace(/[^a-z0-9+.# ]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleanClaim || cleanClaim.length < 3) return true;
  const importantWords = cleanClaim.split(" ").filter((w) => w.length >= 4 && !/company|role|metric|skill|years|experience/.test(w));
  if (!importantWords.length) return true;
  return importantWords.some((w) => evidence.includes(w));
}

// ── Priority 1: CV Role Extraction ───────────────────────────────────────────
// Only trusts: experience entries, current title, resume headline.
// NEVER returns: section headers, contact lines, skill lists, education lines.

const CV_SECTION_HEADERS = /^(skills?|education|experience|professional experience|work experience|projects?|languages?|summary|profile|contact|headline|objective|about me|references|certifications?|expertise|fähigkeiten|berufserfahrung|ausbildung|kontakt|sprachen|profil|profilübersicht|education and training|bildungsweg)$/i;

const CV_SECTION_ARTIFACT_PHRASES = /\b(professional experience contact|experience contact|profile summary|work experience|core competencies|key skills|skills contact|education contact|languages contact|projects contact|berufserfahrung kontakt|fähigkeiten kontakt)\b/i;

function isCvSectionArtifact(value: string): boolean {
  const cleaned = text(value).replace(/[|•·]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return true;
  if (CV_SECTION_HEADERS.test(cleaned)) return true;
  if (CV_SECTION_ARTIFACT_PHRASES.test(cleaned)) return true;
  // Reject if 2+ section-header words appear together (e.g. "Education Skills Contact")
  const sectionWordCount = cleaned.split(/\s+/).filter((w) =>
    /^(skills?|education|experience|professional|work|projects?|languages?|summary|profile|contact|headline|objective|references|certifications?|expertise)$/i.test(w)
  ).length;
  if (sectionWordCount >= 2) return true;
  // Reject contact info lines
  if (/@|www\.|http|linkedin|github|\+\d{5,}|\b(university|college|school|bootcamp|academy|institute|gmail|outlook)\b/i.test(cleaned)) return true;
  // Reject pure skill technology lists (≤4 words, all tech names)
  const techOnly = /\b(python|sql|tableau|excel|power bi|matplotlib|seaborn|tensorflow|sklearn|langchain|api|gcp|aws|azure|javascript|typescript|pandas|numpy|mysql|postgresql)\b/i;
  if (techOnly.test(cleaned) && cleaned.split(/\s+/).length <= 5) return true;
  return false;
}

function looksLikeRoleTitle(value: string): boolean {
  const line = value.replace(/^[-•*▪◦>]+\s*/, "").replace(/[|•·]/g, " ").replace(/\s+/g, " ").trim();
  if (!line || isCvSectionArtifact(line)) return false;
  if (line.length < 4 || line.length > 70) return false;
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length > 9) return false;

  // Reject ALL-CAPS blobs that are likely spaced-letter PDF artifacts
  // e.g. "IT SUPPORT SPECIALIST" from "I T - S u p p o r t - S p e z i a l i s t"
  // Real job titles in CVs are Title Case or mixed case, not full screaming caps
  // Exception: genuine well-known abbreviation titles like "CEO", "CTO", "VP"
  const isAllCaps = line === line.toUpperCase() && /[A-Z]{2,}/.test(line);
  if (isAllCaps && words.length > 2 && !/^(CEO|CTO|CFO|COO|VP|SVP|EVP|HR|IT|UX|UI|QA|PM)/.test(line)) {
    // Only accept ALL CAPS if it's a single recognised acronym role
    return false;
  }

  // Must contain a recognizable job function word
  return /\b(engineer|support|developer|designer|analyst|manager|consultant|administrator|coordinator|specialist|technician|product|sales|marketing|finance|accountant|assistant|intern|lead|head|director|scientist|architect|recruiter|trainer|operator|customer success|success manager|it support|system integration|service desk|helpdesk|application engineer|cad designer|data scientist|business developer|account executive|project manager|program manager)\b/i.test(line);
}

/**
 * extractLikelyCvRole — the single most important function for recruiter quality.
 *
 * Priority order:
 * 1. Structured experience entries (lines like "• Technical Support Engineer • Zoho Corp • 2018")
 * 2. Explicit headline/title fields (headline: X, current role: X)
 * 3. Short role-title-like lines near dates or company names
 *
 * Never returns section headers, contact lines, skill lists, or long prose.
 */
export function extractLikelyCvRole(setup: RecruiterIntelligenceSetup): string {
  const cv = text(setup.cvText).slice(0, 14000);
  if (!cv) return "";

  // Priority 1: structured bullet-point experience lines
  // Matches: "• Technical Support Engineer • Zoho Corp • 2018 - 2020"
  //          "- Product Design Engineer | ABC Company | 2019"
  const structuredLines = Array.from(
    cv.matchAll(/^[\s]*[-•▪◦]\s*([^•|\n]{3,70})(?:[•|][^•|\n]+)?$/gim),
  )
    .map((m) => m[1].replace(/^[-•*▪◦>]+\s*/, "").replace(/\s+/g, " ").trim())
    .filter(looksLikeRoleTitle);
  if (structuredLines.length) return structuredLines[0];

  // Priority 2: explicit labeled fields
  const labelPatterns = [
    /(?:candidate\s+role|current\s+role|current\s+title|headline|job\s+title|position|title)\s*:\s*([^\n|•]{3,70})/i,
    /(?:J\s*U\s*N\s*I\s*O\s*R|S\s*E\s*N\s*I\s*O\s*R)?\s+([A-Z][A-Z\s]{4,50}(?:ENGINEER|ANALYST|MANAGER|SPECIALIST|DEVELOPER|DESIGNER|SCIENTIST))\b/,
  ];
  for (const pattern of labelPatterns) {
    const match = cv.match(pattern);
    if (!match) continue;
    const candidate = (match[1] || "").replace(/\s+/g, " ").trim();
    if (looksLikeRoleTitle(candidate)) return candidate;
  }

  // Priority 3: scan all lines, score by proximity to dates/company names
  const lines = cv.split(/[\r\n|]+/).map((l) => l.replace(/^[-•*▪◦>]+\s*/, "").replace(/\s+/g, " ").trim()).filter(Boolean);
  const scored = lines
    .map((line, index) => {
      if (!looksLikeRoleTitle(line)) return null;
      let score = 0;
      if (/\b(technical support|it support|application engineer|customer success|service desk|system integration|product design|cad designer|data scientist|business analyst)\b/i.test(line)) score += 10;
      if (/\b(engineer|developer|analyst|manager|specialist|designer|administrator|consultant)\b/i.test(line)) score += 6;
      if (index < 40) score += 4;
      const nearby = lines.slice(Math.max(0, index - 4), index + 6).join(" ");
      if (/\b(20\d{2}|19\d{2}|present|current|heute|corp|gmbh|technologies|solutions|inc|ltd)\b/i.test(nearby)) score += 5;
      if (/\b(skill|education|language|project|contact|summary|profile)\b/i.test(nearby) && !/\b(20\d{2}|corp|gmbh|inc|ltd)\b/i.test(nearby)) score -= 6;
      return { line, score };
    })
    .filter(Boolean) as Array<{ line: string; score: number }>;

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  // Final guard: if score is very low or result is still long, return empty
  if (!best || best.score < 2 || best.line.length > 65) return "";
  return best.line;
}

// ── Priority 2: Concern Resolution Engine ────────────────────────────────────

function detectConcernEvidence(answer: string, concernId: ConcernId): number {
  const low = lower(answer);
  const words = answer.trim().split(/\s+/).length;

  switch (concernId) {
    case "career_switch":
      // Evidence: CSAT, relationship-building, hands-on prep, transferable skills
      if (/\b(csat|customer satisfaction|95|98|5\s*(?:\/|out of)\s*5|nps|retention|relationship|onboarding|adoption|crm|escalation|hands.on|course|bootcamp|project|self.learning|freelance|certification|built|implemented|managed customer)\b/i.test(low)) return 60;
      if (/\b(support|customer|resolved|ticket|stakeholder|handled|communicated)\b/i.test(low) && words >= 20) return 35;
      return 0;

    case "skill_gap":
      if (/\b(trained|learned|course|certification|bootcamp|project|self.learning|hands.on|currently|studying|familiar|exposure|used in|worked with|experience with)\b/i.test(low)) return 50;
      return 0;

    case "experience_depth":
      if (hasMetric(answer) && hasOwnership(answer)) return 55;
      if (hasOwnership(answer) && words >= 40) return 30;
      return 0;

    case "ownership_unclear":
      if (/\b(i personally|i led|i built|i resolved|i decided|i owned|i designed|i implemented|i handled|i created|my responsibility|my decision|i was responsible)\b/i.test(low)) return 70;
      if (hasOwnership(answer) && words >= 25) return 40;
      return 0;

    case "metric_missing":
      if (hasMetric(answer)) return 80;
      if (/\b(csat|nps|sla|kpi|satisfaction|improved|increased|reduced|faster|better)\b/i.test(low)) return 45;
      return 0;

    case "unsupported_claim":
      return 30; // Partial credit for any substantive answer after being challenged
    case "contradiction":
      return 0; // Contradictions only resolve with explicit admission + correction
    default:
      return 0;
  }
}

function resolveConcerns(
  activeConcerns: ConcernState[],
  answer: string,
): { updated: ConcernState[]; resolved: ConcernId[] } {
  const resolved: ConcernId[] = [];
  const updated = activeConcerns.map((concern) => {
    const evidenceStrength = detectConcernEvidence(answer, concern.id);
    if (evidenceStrength === 0) return concern;
    const newScore = Math.max(0, concern.score - evidenceStrength);
    return { ...concern, score: newScore, lastEvidence: answer.slice(0, 100) };
  }).filter((concern) => {
    if (concern.score <= 20) {
      resolved.push(concern.id);
      return false; // Remove resolved concern
    }
    return true;
  });
  return { updated, resolved };
}

function addOrUpdateConcern(
  concerns: ConcernState[],
  id: ConcernId,
  description: string,
): ConcernState[] {
  const existing = concerns.find((c) => c.id === id);
  if (existing) {
    return concerns.map((c) =>
      c.id === id ? { ...c, askedCount: c.askedCount + 1 } : c
    );
  }
  return [...concerns, { id, description, score: 100, askedCount: 0, lastEvidence: "" }];
}

// ── Priority 3: Topic Progression Engine ─────────────────────────────────────

const TOPIC_ROADMAP_STANDARD: CompetencyId[] = [
  "intro_background",
  "career_transition",  // only added when CV→role mismatch detected
  "customer_management",
  "technical_depth",
  "problem_solving",
  "stakeholder_management",
  "success_metrics",
  "motivation_fit",
  "closing",
];

const TOPIC_ROADMAP_NO_TRANSITION: CompetencyId[] = [
  "intro_background",
  "customer_management",
  "technical_depth",
  "problem_solving",
  "leadership",
  "stakeholder_management",
  "success_metrics",
  "motivation_fit",
  "closing",
];

function buildInterviewRoadmap(setup: RecruiterIntelligenceSetup): CompetencyId[] {
  const hasTransition = hasCareerTransitionSignal("", setup);
  return hasTransition ? TOPIC_ROADMAP_STANDARD : TOPIC_ROADMAP_NO_TRANSITION;
}

const TOPIC_LABEL: Record<CompetencyId, string> = {
  intro_background: "introduction and background",
  career_transition: "career transition readiness",
  customer_management: "customer management experience",
  technical_depth: "technical skills and depth",
  problem_solving: "problem solving ability",
  leadership: "leadership and ownership",
  stakeholder_management: "stakeholder and team management",
  success_metrics: "measurable impact and results",
  motivation_fit: "motivation and role fit",
  closing: "closing questions",
};

// ── Technical vs. non-technical calibration ───────────────────────────────────
// A real interviewer asks completely differently depending on the role: an
// engineer gets pushed on architecture, trade-offs, and production failure;
// a CSM or salesperson gets pushed on business impact and stakeholder
// dynamics. Treating every role identically (or worse, using engineering
// language like "the engineering judgment behind it" on a sales answer) is
// exactly what makes an interview feel generic instead of real.
const TECHNICAL_ROLE_PATTERN = /\b(software|backend|back-end|frontend|front-end|full[\s-]?stack|web|mobile|ios|android)\s*(engineer|developer)\b|\bdeveloper\b|\bsoftware engineer\b|\bdata (scientist|engineer|analyst)\b|\bmachine learning\b|\bml engineer\b|\bai engineer\b|\bdevops\b|\bsite reliability\b|\bsre\b|\bplatform engineer\b|\bcloud engineer\b|\bsecurity engineer\b|\bcybersecurity\b|\bqa engineer\b|\btest engineer\b|\bsystems? engineer\b|\bnetwork engineer\b|\bit support\b|\bhelpdesk\b|\bsystem administrator\b|\bsysadmin\b|\bdatabase administrator\b|\bdba\b|\bsolutions? architect\b|\btechnical architect\b|\bembedded\b|\bfirmware\b|\bgame developer\b|\bblockchain\b/i;

const TECHNICAL_SKILL_HINTS = /\b(python|java(script)?|typescript|react|node\.?js|sql|aws|azure|gcp|kubernetes|docker|c\+\+|c#|golang|\bgo\b|rust|api|microservices?|ci\/cd|git|linux|terraform|django|spring|kafka|redis|graphql)\b/i;

function isTechnicalRole(setup: RecruiterIntelligenceSetup): boolean {
  const role = text(setup.targetRole);
  const jd = text(setup.jobDescription).slice(0, 1500);
  const cv = text(setup.cvText).slice(0, 1500);
  if (TECHNICAL_ROLE_PATTERN.test(role)) return true;
  // Role title alone doesn't always say it (e.g. "Engineer II", "Platform
  // Team"), so also check the JD/CV for a meaningful concentration of
  // concrete technical-skill keywords rather than a single stray mention.
  const combined = `${role} ${jd}`;
  if (TECHNICAL_ROLE_PATTERN.test(combined)) return true;
  const skillMatches = combined.match(new RegExp(TECHNICAL_SKILL_HINTS.source, "gi")) || [];
  if (skillMatches.length >= 3) return true;
  const cvSkillMatches = cv.match(new RegExp(TECHNICAL_SKILL_HINTS.source, "gi")) || [];
  return cvSkillMatches.length >= 4;
}

function buildTopicQuestion(topic: CompetencyId, setup: RecruiterIntelligenceSetup, memory: RecruiterMemoryV2, answer: string): string {
  const target = text(setup.targetRole, "this role");
  const skills = memory.skills.slice(0, 3).join(", ");
  const metrics = memory.metrics.slice(0, 2).join(", ");
  const company = memory.companies[0] || "";

  switch (topic) {
    case "intro_background":
      return `Tell me about your background and how it connects to ${target}.`;

    case "career_transition": {
      const cvRole = extractLikelyCvRole(setup);
      if (cvRole && cvRole.length <= 60) {
        return `I can see your background is mainly in ${cvRole}. This role is ${target}, which is a different direction. What have you done hands-on — a project, course, or direct experience — that shows you're ready for it?`;
      }
      return `Looking at your background and this ${target} role, there's a transition here I want to understand. What have you done practically that shows readiness, not just interest?`;
    }

    case "customer_management":
      return `Tell me about a time you handled a difficult customer situation. What did you personally do, and what was the outcome?`;

    case "technical_depth": {
      const technical = isTechnicalRole(setup);
      if (technical && skills) {
        return `You mentioned ${skills}. Walk me through a specific time you used that — what was the actual technical decision you had to make, what trade-off did it involve, and what would you do differently if you rebuilt it today?`;
      }
      if (technical) {
        return `What's the part of your stack you know deepest? Pick one real piece of it and walk me through a production issue you personally diagnosed there — what broke, how did you find it, and what fixed it?`;
      }
      if (skills) return `You mentioned ${skills}. Give me one example where you used that skill to solve a real problem — what did you actually do, and how did you know it worked?`;
      return `What are you strongest at in this kind of work, and can you give me a concrete example of using that to solve a real problem?`;
    }

    case "problem_solving":
      return `Tell me about a complex problem you personally diagnosed or solved. What was your thinking process, and what changed after your work?`;

    case "leadership":
      return `Tell me about a time you took ownership of something that wasn't explicitly your responsibility. What did you decide, and what was the result?`;

    case "stakeholder_management":
      if (company) return `While at ${company}, how did you manage situations where different stakeholders had conflicting priorities or needs?`;
      return `Tell me about a time you had to manage expectations with multiple stakeholders who had conflicting needs. How did you handle it?`;

    case "success_metrics": {
      const technical = isTechnicalRole(setup);
      if (metrics) {
        return technical
          ? `You mentioned ${metrics}. That's useful evidence. Walk me through the actual technical decision behind it — what approach did you choose, why that one over the alternatives, and how did you confirm it actually worked?`
          : `You mentioned ${metrics}. That's useful evidence. Walk me through the actual decision behind it — what did you choose to do, why that approach, and how did you confirm it actually worked?`;
      }
      return `Let's talk about impact in a practical way. In ${target}, what outcome would show that your work is successful — and can you point to a specific time you moved that number?`;
    }

    case "motivation_fit":
      return `What specifically attracted you to ${target}, and what would make this role a step forward for you rather than just a lateral move?`;

    case "closing":
      return `We're coming toward the end of our time. Is there anything about your background or experience that you feel we haven't covered that would be important for me to know?`;

    default:
      return `Let's go deeper. Take me through one specific situation that is most relevant to ${target} — what happened, what you did, and what changed.`;
  }
}

function detectAnsweredCompetency(answer: string, topic: CompetencyId): boolean {
  const words = answer.trim().split(/\s+/).length;
  if (words < 15) return false; // Too short to count as tested

  switch (topic) {
    case "intro_background":
      return words >= 20;
    case "career_transition":
      return hasCareerTransitionEvidenceProvided(answer);
    case "customer_management":
      return /\b(customer|client|stakeholder|ticket|issue|resolved|handled|relationship|csat|satisfaction|escalat)\b/i.test(answer) && words >= 25;
    case "technical_depth":
      return /\b(sql|python|api|configured|implemented|troubleshot|diagnosed|built|designed|data|system|network|server|tool|software|excel|tableau|crm)\b/i.test(answer) && words >= 20;
    case "problem_solving":
      return hasOwnership(answer) && (hasOutcome(answer) || hasMetric(answer)) && words >= 30;
    case "leadership":
      return /\b(led|owned|managed|decided|took responsibility|initiative|without being asked|personally|accountable)\b/i.test(answer) && words >= 20;
    case "stakeholder_management":
      return /\b(stakeholder|manager|team|cross|department|align|communicated|reported|coordinated|management|executive|client)\b/i.test(answer) && words >= 25;
    case "success_metrics":
      return hasMetric(answer) || /\b(csat|nps|kpi|sla|quota|target|achieved|improved|reduced|increased)\b/i.test(answer);
    case "motivation_fit":
      return /\b(because|interested|goal|career|growth|want|opportunity|reason|attracted|passion|align)\b/i.test(answer) && words >= 20;
    case "closing":
      return true; // Any answer counts for closing
    default:
      return words >= 25;
  }
}


/**
 * Infer ALL competencies evidenced by an answer, not only the current topic.
 * This is the key anti-loop fix: if the recruiter asks for a difficult customer
 * example and the candidate answers with empathy + troubleshooting + outcome,
 * we mark customer_management / problem_solving / technical_depth as covered
 * even if the current roadmap index was still pointing somewhere else.
 */
function inferAnsweredCompetencies(answer: string, setup: RecruiterIntelligenceSetup = {}): CompetencyId[] {
  const low = lower(answer);
  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  const found: CompetencyId[] = [];

  if (words >= 20 && /\b(years?|experience|background|worked as|technical support|engineer|manager|analyst|designer|specialist|customer|client)\b/i.test(low)) {
    found.push("intro_background");
  }

  if (hasCareerTransitionEvidenceProvided(answer) || /\b(shift|switch|transition|move into|change my role|customer success|new role|ready for)\b/i.test(low)) {
    found.push("career_transition");
  }

  if (/\b(customer|client|b2b|b2c|csat|customer satisfaction|rapport|relationship|trust|frustrated|angry|non-tech|non technical|satisfaction|handled|call|ticket|escalation|support)\b/i.test(low) && words >= 18) {
    found.push("customer_management");
  }

  if (/\b(router|firmware|remote access|ip address|troubleshoot|diagnosed|configured|technical issue|network|server|system|software|sql|python|api|tool|ticket|incident|root cause)\b/i.test(low) && words >= 18) {
    found.push("technical_depth");
  }

  if (/\b(problem|issue|resolved|fixed|diagnosed|checked|step-by-step|realize|solution|root cause|multiple levels|worked together|closed|outcome|result|happy|satisfied)\b/i.test(low) && words >= 22) {
    found.push("problem_solving");
  }

  if (/\b(i personally|i handled|i took|i decided|i owned|my responsibility|i built|i led|i managed|i fixed|i resolved|i checked|i guided|i explained)\b/i.test(low) && words >= 18) {
    found.push("leadership");
  }

  if (/\b(stakeholder|team|technician|manager|sales|engineering|internal team|another technician|customer and team|coordinated|handover|escalated|communicated|aligned)\b/i.test(low) && words >= 18) {
    found.push("stakeholder_management");
  }

  if (hasMetric(answer) || /\b(csat|nps|sla|kpi|5\s*(?:\/|out of)\s*5|95|96|97|98|customer rating|satisfaction score|faster|reduced|improved)\b/i.test(low)) {
    found.push("success_metrics");
  }

  if (/\b(because|interested|i thought|i want|i would like|career|growth|role|opportunity|reason|shine|move|shift|change)\b/i.test(low) && words >= 18) {
    found.push("motivation_fit");
  }

  return [...new Set(found)];
}

function inferAskedTopicFromQuestion(question: string): CompetencyId | "" {
  const q = lower(question);
  if (!q) return "";
  if (/\b(difficult customer|customer situation|customer-facing|client situation|rapport|relationship|csat|customer satisfaction)\b/i.test(q)) return "customer_management";
  if (/\b(transition|switch|shift|different direction|ready for it|readiness|hands-on)\b/i.test(q)) return "career_transition";
  if (/\b(technical|diagnosed|troubleshoot|system|server|network|skill|tools)\b/i.test(q)) return "technical_depth";
  if (/\b(problem|solve|thinking process|complex issue|what changed)\b/i.test(q)) return "problem_solving";
  if (/\b(stakeholder|team|conflicting|expectations|coordinated)\b/i.test(q)) return "stakeholder_management";
  if (/\b(metric|measure|success|outcome|numbers|accountable|performance)\b/i.test(q)) return "success_metrics";
  if (/\b(motivation|attracted|why|step forward|interested)\b/i.test(q)) return "motivation_fit";
  if (/\b(background|introduce|experience connects)\b/i.test(q)) return "intro_background";
  return "";
}

function findNextUntestedTopic(memory: RecruiterMemoryV2, roadmap: CompetencyId[], startIndex = 0): { topic: CompetencyId; index: number } {
  const answered = new Set(memory.answeredCompetencies);
  const safeStart = Math.max(0, Math.min(startIndex, roadmap.length - 1));
  for (let offset = 0; offset < roadmap.length; offset += 1) {
    const index = Math.min(roadmap.length - 1, safeStart + offset);
    const topic = roadmap[index];
    if (!answered.has(topic)) return { topic, index };
  }
  return { topic: roadmap[roadmap.length - 1] || "closing", index: Math.max(0, roadmap.length - 1) };
}

function makeReplyPersonaSpecific(reply: string, setup: RecruiterIntelligenceSetup): string {
  const persona = `${setup.recruiterPersonality || ""} ${setup.recruiterName || ""} ${setup.recruiterTitle || ""}`.toLowerCase();
  if (/sarah|friendly|talent partner|supportive/.test(persona)) {
    return reply
      .replace(/^Let me pause you there —/i, "That's helpful. To make it stronger,")
      .replace(/^I need to pause there\./i, "Let me clarify that gently.")
      .replace(/^I need to verify that\./i, "I want to make sure I understand this accurately.")
      .replace(/^Give me/i, "Could you give me")
      .replace(/^Tell me/i, "Could you tell me");
  }
  if (/markus|corporate|process/.test(persona)) {
    return reply.replace(/^Tell me/i, "Walk me through the process of");
  }
  return reply;
}

// ── Priority 5: JD Gap Engine ─────────────────────────────────────────────────

const JD_SKILL_PATTERNS: Array<[RegExp, string]> = [
  [/\bcustomer\s+success\b/i, "Customer Success"],
  [/\bonboarding\b/i, "Customer Onboarding"],
  [/\brenewal\b/i, "Renewals Management"],
  [/\baccount\s+management\b/i, "Account Management"],
  [/\bstakeholder\b/i, "Stakeholder Management"],
  [/\bcsat\b|\bcustomer\s+satisfaction\b/i, "CSAT / Customer Satisfaction"],
  [/\bnps\b/i, "NPS"],
  [/\bsla\b/i, "SLA Management"],
  [/\bactive\s+directory\b/i, "Active Directory"],
  [/\bwindows\s+server\b/i, "Windows Server"],
  [/\bnetwork(?:ing)?\b/i, "Networking"],
  [/\bpowershell\b/i, "PowerShell"],
  [/\bsql\b/i, "SQL"],
  [/\bpython\b/i, "Python"],
  [/\btableau\b/i, "Tableau"],
  [/\bitil\b/i, "ITIL"],
  [/\bitsm\b/i, "ITSM"],
  [/\bcrm\b/i, "CRM"],
  [/\bsalesforce\b/i, "Salesforce"],
  [/\bdata\s+analysis\b|\bdata\s+analytics\b/i, "Data Analysis"],
  [/\bproject\s+management\b/i, "Project Management"],
  [/\bagile\b|\bscrum\b/i, "Agile / Scrum"],
  [/\baws\b|\bamazon\s+web\s+services\b/i, "AWS"],
  [/\bazure\b/i, "Microsoft Azure"],
  [/\bapi\b/i, "API Integration"],
  [/\breporting\b/i, "Reporting"],
  [/\bpresent(?:ation)?\b/i, "Presentations"],
  [/\bcommunic(?:ate|ation)\b/i, "Communication"],
  [/\bleadership\b/i, "Leadership"],
  [/\btraining\b/i, "Training & Coaching"],
];

function buildJdGapAnalysis(setup: RecruiterIntelligenceSetup): { matched: string[]; missing: string[] } {
  const jd = lower(setup.jobDescription || "");
  const cv = lower(setup.cvText || "");
  if (!jd) return { matched: [], missing: [] };

  const matched: string[] = [];
  const missing: string[] = [];

  for (const [pattern, label] of JD_SKILL_PATTERNS) {
    if (!pattern.test(jd)) continue; // Not in JD
    if (pattern.test(cv)) {
      matched.push(label);
    } else {
      missing.push(label);
    }
  }

  return { matched, missing };
}

function buildJdGapQuestion(missingSkill: string, setup: RecruiterIntelligenceSetup): string {
  const target = text(setup.targetRole, "this role");
  return `I see ${missingSkill} mentioned in the role requirements, but I don't see it clearly in your background. Have you worked with it before, or how would you approach that gap if you joined?`;
}

// ── Priority 4: Competency Detection ─────────────────────────────────────────

function detectContradictions(answer: string, memory: RecruiterMemoryV2) {
  const contradictions: string[] = [];
  const low = lower(answer);
  const priorText = lower([...memory.claims, ...memory.companies.map((c) => `company:${c}`), ...memory.roles.map((r) => `role:${r}`), ...memory.metrics.map((m) => `metric:${m}`)].join(" | "));

  if (/\b(i lied|i made that up|i made it up|not true|wasn't true|that is false|fake|i exaggerated|i was lying|sorry.*lie|i just lied)\b/i.test(low)) {
    contradictions.push("Candidate admitted that a previous claim was false or exaggerated.");
  }

  if (/\b(never worked|no experience|did not work|didn't work|haven't worked|have not worked|never had experience|no real experience)\b/i.test(low)) {
    if (memory.companies.length || memory.roles.length || memory.skills.length) {
      contradictions.push("Candidate now denies experience after previously claiming companies, roles, or skills.");
    }
    for (const company of memory.companies) {
      if (new RegExp(`\\b${company.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(low)) {
        contradictions.push(`Candidate now denies or weakens earlier company claim: ${company}.`);
      }
    }
  }

  const currentYears = Array.from(low.matchAll(/\b(\d{1,2})\s*(?:\+?\s*)?(?:years?|yrs?)\b/g)).map((m) => Number(m[1]));
  const priorYears = Array.from(priorText.matchAll(/\b(\d{1,2})\s*(?:\+?\s*)?(?:years?|yrs?)\b/g)).map((m) => Number(m[1]));
  for (const c of currentYears) {
    for (const p of priorYears) {
      if (Math.abs(c - p) >= 2) contradictions.push(`Candidate changed years of experience from about ${p} to ${c}.`);
    }
  }

  if (/\b(worked alone|completely alone|no team|individual contributor|not a manager|did not manage|didn't manage|never managed)\b/i.test(low)) {
    if (/\b(managed|led|supervised)\b/i.test(priorText)) {
      contradictions.push("Candidate now says they worked alone after earlier implying team leadership or management.");
    }
  }

  return unique(contradictions, 8);
}

function detectWeakAnswerReasons(answer: string) {
  const reasons: string[] = [];
  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  if (words < 18) reasons.push("Answer is too short to judge role fit.");
  if (!hasOwnership(answer)) reasons.push("Personal ownership is unclear.");
  if (!hasMetric(answer)) reasons.push("No measurable impact or evidence was provided.");
  if (!hasOutcome(answer)) reasons.push("Outcome or business impact is missing.");
  if (/\bwe\b/i.test(answer) && !/\b(i|my|personally)\b/i.test(answer)) reasons.push("Answer sounds team-level rather than individual.");
  if (/\bthings|stuff|many|some|good|nice|various|etc\b/i.test(answer)) reasons.push("Answer uses vague wording instead of specific details.");
  return unique(reasons, 8);
}

function tokenizeRole(value: unknown): string[] {
  return unique(
    text(value).toLowerCase().replace(/[^a-z0-9+.#\s-]/g, " ").split(/\s+/)
      .filter((w) => w.length > 2)
      .filter((w) => !/^(the|and|for|with|role|job|position|senior|junior|lead|manager|specialist|engineer|analyst|consultant|professional|mfd|d|m|f|w|full|time|part|remote|hybrid)$/i.test(w)),
    20,
  );
}

function hasCareerTransitionSignal(answer: string, setup: RecruiterIntelligenceSetup): boolean {
  const target = text(setup.targetRole || "");
  const cvRole = extractLikelyCvRole(setup);
  const answerLow = lower(answer);
  const targetTokens = tokenizeRole(target);
  const cvTokens = tokenizeRole(cvRole);
  const overlap = targetTokens.filter((t) => cvTokens.includes(t)).length;
  const explicitSwitch = /\b(switch|shift|change|transition|move into|move to|interested in|like to get into|want to get into|career change|new field|different role|from .* to)\b/i.test(answerLow);
  const roleMismatch = Boolean(target && cvRole && overlap === 0 && targetTokens.length && cvTokens.length);
  return explicitSwitch || roleMismatch;
}

// ── Priority 2 (cont): Transition evidence detection ─────────────────────────
// Replaces the missing `transitionEvidenceProvided` variable

function hasCareerTransitionEvidenceProvided(answer: string): boolean {
  const low = lower(answer);
  const words = answer.trim().split(/\s+/).filter(Boolean).length;

  // Strong evidence: CSAT, metrics, direct customer work, prep activities
  if (/\b(csat|customer satisfaction|95|96|97|98|99|5\s*(?:\/|out of)\s*5|nps|retention|relationship|onboarding|adoption|crm|escalation|hands.on|course|bootcamp|project|self.learning|freelance|certification|built|implemented|managed customer|helped customer|resolved customer|similar role|similar job|transferable|face.to.face|face the customer|talk to the customer|b2b|b2c|customer.facing)\b/i.test(low)) return true;

  // Medium evidence: any substantive answer (12+ words) with customer/support context
  // The candidate explained WHY their support background connects to CSM — that counts.
  if (words >= 12 && /\b(support|customer|client|resolved|ticket|stakeholder|handled|communicated|technically|diagnosed|troubleshot|service|helpdesk|interact|relationship|satisfaction|assist|guide|explain)\b/i.test(low)) return true;

  // Candidate explicitly argues the roles are similar — that IS evidence of their reasoning
  if (/\b(similar|same|overlap|connect|translate|related|both|also|already|experience with customer|customer experience|deal with customer|work with customer)\b/i.test(low) && words >= 15) return true;

  return false;
}

function transcriptContains(transcript: TranscriptItem[] | undefined, pattern: RegExp): boolean {
  return Array.isArray(transcript) && transcript.some((item) => pattern.test(text(item.text)));
}

function candidateTurnCount(transcript: TranscriptItem[] | undefined): number {
  return Array.isArray(transcript) ? transcript.filter((item) => item.role === "candidate").length : 0;
}

function isCustomerSuccessTarget(setup: RecruiterIntelligenceSetup) {
  const target = `${setup.targetRole || ""} ${setup.jobDescription || ""}`.toLowerCase();
  return /\b(customer success|customer experience|account manager|client success|customer relationship|retention|renewal|onboarding|adoption|csat|nps|crm|saas)\b/i.test(target);
}

function buildPostTransitionProgressionQuestion(answer: string, setup: RecruiterIntelligenceSetup) {
  const target = text(setup.targetRole, "this role");
  const low = lower(answer);

  // CSM target: acknowledge the support bridge, then probe the KEY difference
  if (isCustomerSuccessTarget(setup)) {
    if (/\b(similar|same|both|customer.facing|customer facing|face the customer)\b/i.test(low)) {
      return `You’re right that customer-facing experience is a strong foundation. The key difference in Customer Success is that you’re not waiting for customers to call you with problems — you’re proactively reaching out to make sure they’re getting value before issues arise. Have you ever done that proactively — reaching out to a customer before they came to you?`;
    }
    if (hasCareerTransitionEvidenceProvided(answer)) {
      return `That support background is a real asset for Customer Success — especially the customer empathy and troubleshooting ownership. The next thing I want to understand is the proactive side: in CS, you’re managing the relationship before problems surface. Tell me about a time you followed up with a customer after closing an issue — what did you do and why?`;
    }
    return `I can see the customer-handling experience. For ${target}, the core shift is from reactive to proactive — owning the relationship, not just the ticket. Tell me about one customer relationship you personally owned end-to-end. What did staying on top of it look like?`;
  }

  // Technical roles
  if (/\b(troubleshoot|ticket|incident|support|escalat|technical|diagnos)\b/i.test(low)) {
    return `That helps. Tell me about one technically complex issue you personally diagnosed and resolved — what you checked first, how you narrowed it down, and what the outcome was.`;
  }

  return `Good context. Now give me one concrete example from your background that directly connects to ${target}: a situation you personally owned, the action you took, and what changed.`;
}

function isNearDuplicateReply(reply: string, transcript?: TranscriptItem[]) {
  const current = text(reply).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  if (!current || !Array.isArray(transcript)) return false;
  const recentRecruiter = transcript
    .filter((item) => item.role === "recruiter")
    .map((item) => text(item.text).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim())
    .slice(-3);
  return recentRecruiter.some((prev) => {
    if (!prev) return false;
    if (prev === current) return true;
    const words = current.split(" ").filter((w) => w.length > 4);
    if (words.length < 6) return false;
    const overlap = words.filter((w) => prev.includes(w)).length / words.length;
    return overlap >= 0.72;
  });
}

function recentlyAskedEvidence(transcript: TranscriptItem[] | undefined): boolean {
  return transcriptContains(transcript, /\b(metric|measurable|what changed|proof point|time saved|tickets|customer impact|visible improvement|result)\b/i);
}

function buildEvidenceRequest(answer: string, setup: RecruiterIntelligenceSetup, transcript?: TranscriptItem[]) {
  const turns = candidateTurnCount(transcript);
  const earlyInterview = turns <= 2;
  const askedEvidence = recentlyAskedEvidence(transcript);
  const hasQualitativeOutcome = /\b(csat|customer satisfaction|satisfied|happy customer|positive feedback|rapport|relationship|repeat customer|fewer escalations|resolved|closed|improved|reduced|faster|better quality|appreciated|rating|five on five|5 out of 5|98|95)\b/i.test(answer);
  const unsupported = extractClaimSummary(answer).filter((c) => !isClaimSupported(c, setup));
  if (unsupported.length && turns > 1) {
    return `I need to verify that before I rely on it. ${unsupported[0]} is not clearly supported by your CV. Was this official work, a project, training, freelance work, or transferable experience?`;
  }
  if (!hasOwnership(answer) && !earlyInterview) {
    return "I want to separate your part from the team's part. What did you personally diagnose, decide, fix, configure, explain, or escalate?";
  }
  if (!hasOutcome(answer) && !hasQualitativeOutcome && !earlyInterview && !askedEvidence) {
    return "What changed after that work — for the customer, the system, the team, or the business? A qualitative result is fine if you do not have an exact number.";
  }
  if (!hasMetric(answer) && !hasQualitativeOutcome && turns >= 4 && !askedEvidence) {
    return "Can you give me the scale of that work in a natural way — for example how often it happened, how many users or customers were affected, or what improved afterward?";
  }
  return "";
}

function localize(setup: RecruiterIntelligenceSetup, english: string) {
  const lang = lower(setup.language);
  if (lang.includes("german") || lang.includes("deutsch") || lang === "de" || lang.includes("de-de")) {
    if (/metric|proof|evidence|time saved|tickets/i.test(english)) return "Nenne bitte einen konkreten Nachweis: Zeitersparnis, weniger Tickets, Kundenwirkung, Qualitätsverbesserung, Umsatz, Kosten oder ein Vorher-Nachher-Ergebnis.";
    if (/ownership|personally|personally decide/i.test(english)) return "Kläre bitte deine genaue Eigenleistung. Was hast du persönlich entschieden, gebaut, analysiert, gelöst oder geliefert?";
    if (/project|technical|tools|data|workflow|tradeoff|mistake/i.test(english)) return "Lass uns bei einem Projekt tiefer gehen. Was war das Problem, welche Einschränkungen gab es, was hast du persönlich entschieden und was hat sich danach verändert?";
    if (/contradict|claim|official work|freelance/i.test(english)) return "Ich muss diese Aussage genauer prüfen. War das offizielle Berufserfahrung, freiberufliche Arbeit, ein Projekt oder ein übertragbares Beispiel?";
  }
  if (lang.includes("dutch") || lang.includes("nederlands") || lang === "nl") {
    if (/metric|proof|evidence|time saved|tickets/i.test(english)) return "Geef één concreet bewijs: tijdwinst, minder tickets, klantimpact, kwaliteitsverbetering, omzet, kosten of een voor-en-na resultaat.";
    if (/ownership|personally/i.test(english)) return "Maak je persoonlijke bijdrage duidelijk. Wat heb jij persoonlijk besloten, gebouwd, geanalyseerd, opgelost of geleverd?";
  }
  if (lang.includes("french") || lang === "fr") {
    if (/metric|proof|evidence/i.test(english)) return "Donne une preuve concrète : temps gagné, tickets réduits, impact client, amélioration qualité, revenu, coût ou résultat avant/après.";
    if (/ownership|personally/i.test(english)) return "Clarifie ta contribution personnelle. Qu'as-tu personnellement décidé, construit, analysé, résolu ou livré ?";
  }
  if (lang.includes("spanish") || lang === "es") {
    if (/metric|proof|evidence/i.test(english)) return "Dame una prueba concreta: tiempo ahorrado, menos tickets, impacto en clientes, mejora de calidad, ingresos, costes o un resultado antes/después.";
    if (/ownership|personally/i.test(english)) return "Aclara tu contribución personal. ¿Qué decidiste, construiste, analizaste, resolviste o entregaste tú personalmente?";
  }
  return english;
}

function contradictionClarifyingQuestion(reason: string, memory: RecruiterMemoryV2) {
  const earlier = memory.claims.slice(-5).join("; ");
  const context = earlier ? ` Earlier I noted: ${earlier}.` : "";
  if (/lied|false|fake|exaggerated|made/i.test(reason)) {
    return `I need to pause here. You just indicated that something may not be true.${context} Which exact part was inaccurate, and what is the verified version I should use from your real experience?`;
  }
  if (/ownership|personally/i.test(reason)) {
    return `I want to clarify ownership.${context} Earlier the answer sounded like you personally handled it, but now you're reducing your role. What exactly did you personally do, and what was done by the team or someone else?`;
  }
  return `I need to clarify a possible inconsistency.${context} Can you reconcile the earlier claim with what you just said and tell me the accurate version?`;
}

// ── Memory management ─────────────────────────────────────────────────────────

export function createRecruiterMemoryV2(seed?: Partial<RecruiterMemoryV2> | unknown): RecruiterMemoryV2 {
  const s: Partial<RecruiterMemoryV2> = (seed && typeof seed === "object" && !Array.isArray(seed)) ? (seed as Partial<RecruiterMemoryV2>) : {};
  return {
    ...EMPTY_MEMORY, ...s,
    companies: unique(s.companies || []),
    roles: unique(s.roles || []),
    skills: unique(s.skills || []),
    projects: unique(s.projects || []),
    metrics: unique(s.metrics || []),
    claims: unique(s.claims || []),
    contradictions: unique(s.contradictions || []),
    evidenceRequests: unique(s.evidenceRequests || []),
    weakAnswerReasons: unique(s.weakAnswerReasons || []),
    trustEvents: Array.isArray(s.trustEvents) ? s.trustEvents.slice(0, 30) : [],
    nextProbeTopic: s.nextProbeTopic || "",
    candidateGoals: unique(s.candidateGoals || []),
    strengths: unique(s.strengths || []),
    weaknesses: unique(s.weaknesses || []),
    resolvedConcerns: Array.isArray(s.resolvedConcerns) ? s.resolvedConcerns : [],
    activeConcerns: Array.isArray(s.activeConcerns) ? s.activeConcerns : [],
    answeredCompetencies: Array.isArray(s.answeredCompetencies) ? s.answeredCompetencies : [],
    jdMatchedSkills: unique(s.jdMatchedSkills || []),
    jdMissingSkills: unique(s.jdMissingSkills || []),
    interviewTopicOrder: Array.isArray(s.interviewTopicOrder) ? s.interviewTopicOrder : [],
    currentTopicIndex: Number(s.currentTopicIndex || 0),
  };
}

function buildRecruiterMemoryFromTranscript(transcript?: TranscriptItem[], setup: RecruiterIntelligenceSetup = {}): RecruiterMemoryV2 {
  const items = Array.isArray(transcript) ? transcript : [];
  const candidateAnswers = items.filter((item) => item?.role === "candidate" && text(item.text)).map((item) => text(item.text));
  let memory = createRecruiterMemoryV2();
  for (const answer of candidateAnswers) {
    memory = updateRecruiterMemoryV2(memory, answer, setup);
  }
  return memory;
}

function mergeRecruiterMemoryV2(...memories: Array<unknown>): RecruiterMemoryV2 {
  return memories.reduce<RecruiterMemoryV2>((merged, item) => {
    const current = createRecruiterMemoryV2(item);
    return {
      companies: unique([...merged.companies, ...current.companies], 30),
      roles: unique([...merged.roles, ...current.roles], 30),
      skills: unique([...merged.skills, ...current.skills], 40),
      projects: unique([...merged.projects, ...current.projects], 25),
      metrics: unique([...merged.metrics, ...current.metrics], 25),
      claims: unique([...merged.claims, ...current.claims], 50),
      contradictions: unique([...merged.contradictions, ...current.contradictions], 25),
      evidenceRequests: unique([...merged.evidenceRequests, ...current.evidenceRequests], 25),
      weakAnswerReasons: unique([...merged.weakAnswerReasons, ...current.weakAnswerReasons], 35),
      trustEvents: [...merged.trustEvents, ...current.trustEvents].slice(-40),
      nextProbeTopic: current.nextProbeTopic || merged.nextProbeTopic,
      candidateGoals: unique([...merged.candidateGoals, ...current.candidateGoals], 10),
      strengths: unique([...merged.strengths, ...current.strengths], 15),
      weaknesses: unique([...merged.weaknesses, ...current.weaknesses], 15),
      resolvedConcerns: [...new Set([...merged.resolvedConcerns, ...current.resolvedConcerns])],
      activeConcerns: current.activeConcerns.length ? current.activeConcerns : merged.activeConcerns,
      answeredCompetencies: [...new Set([...merged.answeredCompetencies, ...current.answeredCompetencies])],
      jdMatchedSkills: unique([...merged.jdMatchedSkills, ...current.jdMatchedSkills], 20),
      jdMissingSkills: unique([...merged.jdMissingSkills, ...current.jdMissingSkills], 20),
      interviewTopicOrder: current.interviewTopicOrder.length ? current.interviewTopicOrder : merged.interviewTopicOrder,
      currentTopicIndex: Math.max(merged.currentTopicIndex, current.currentTopicIndex),
    };
  }, createRecruiterMemoryV2());
}

export function updateRecruiterMemoryV2(
  memory: Partial<RecruiterMemoryV2> | unknown | undefined,
  answer: string,
  setup: RecruiterIntelligenceSetup = {},
): RecruiterMemoryV2 {
  const current = createRecruiterMemoryV2(memory);
  const contradictions = detectContradictions(answer, current);
  const weakReasons = detectWeakAnswerReasons(answer);
  const claims = extractClaimSummary(answer);
  const unsupportedClaims = claims.filter((c) => !isClaimSupported(c, setup));

  // Resolve active concerns based on this answer
  const { updated: updatedConcerns, resolved: newlyResolved } = resolveConcerns(current.activeConcerns, answer);

  // Detect new strengths
  const newStrengths: string[] = [];
  if (hasOwnership(answer) && hasOutcome(answer) && hasMetric(answer)) newStrengths.push("Strong evidence: ownership + outcome + metric");
  if (hasCareerTransitionEvidenceProvided(answer) && current.activeConcerns.some((c) => c.id === "career_switch")) newStrengths.push("Career transition evidence provided");

  // Detect candidate goals from answer
  const newGoals: string[] = [];
  if (/\b(want to|looking to|hoping to|goal is|aiming to|interested in|working toward)\b/i.test(answer)) {
    const goalMatch = answer.match(/(?:want to|looking to|hoping to|goal is to|aim(?:ing)? to)[^.!?]{5,80}/i);
    if (goalMatch) newGoals.push(goalMatch[0].slice(0, 80));
  }

  const trustDelta =
    contradictions.length > 0 || unsupportedClaims.length > 0 ? -14
    : weakReasons.length >= 3 ? -8
    : weakReasons.length > 0 ? -4
    : hasMetric(answer) && hasOwnership(answer) && hasOutcome(answer) ? 10
    : 3;

  const trustReason = contradictions[0] || unsupportedClaims[0] || weakReasons[0] || (trustDelta > 0 ? "Answer provided clearer ownership, evidence, or outcome." : "Answer needs more support.");

  // Advance topic index if the current topic OR any inferred competency was answered.
  // This prevents the recruiter from asking the same semantic question again.
  const roadmap = current.interviewTopicOrder.length ? current.interviewTopicOrder : buildInterviewRoadmap(setup);
  const currentTopic = roadmap[current.currentTopicIndex];
  const inferredCompetencies = inferAnsweredCompetencies(answer, setup);
  const topicAnswered = Boolean(currentTopic && detectAnsweredCompetency(answer, currentTopic));
  const allAnsweredCompetencies = [...new Set([
    ...current.answeredCompetencies,
    ...inferredCompetencies,
    ...(topicAnswered && currentTopic ? [currentTopic] : []),
  ])] as CompetencyId[];
  const currentNowAnswered = Boolean(currentTopic && allAnsweredCompetencies.includes(currentTopic));
  let newTopicIndex = current.currentTopicIndex;
  if (currentNowAnswered) {
    for (let i = current.currentTopicIndex + 1; i < roadmap.length; i += 1) {
      if (!allAnsweredCompetencies.includes(roadmap[i])) {
        newTopicIndex = i;
        break;
      }
      newTopicIndex = i;
    }
  }
  const newAnsweredCompetencies = allAnsweredCompetencies;

  return {
    companies: unique([...current.companies, ...extractCompanies(answer)], 30),
    roles: unique([...current.roles, ...extractRoles(answer)], 30),
    skills: unique([...current.skills, ...extractSkills(answer)], 40),
    projects: unique([...current.projects, ...extractProjects(answer)], 25),
    metrics: unique([...current.metrics, ...extractMetrics(answer)], 25),
    claims: unique([...current.claims, ...claims], 40),
    contradictions: unique([...contradictions, ...current.contradictions], 20),
    evidenceRequests: unique([buildEvidenceRequest(answer, setup), ...current.evidenceRequests].filter(Boolean), 20),
    weakAnswerReasons: unique([...weakReasons, ...current.weakAnswerReasons], 30),
    trustEvents: [{ delta: trustDelta, reason: trustReason }, ...current.trustEvents].slice(0, 30),
    nextProbeTopic: currentTopic || "",
    candidateGoals: unique([...current.candidateGoals, ...newGoals], 10),
    strengths: unique([...current.strengths, ...newStrengths], 15),
    weaknesses: unique([...current.weaknesses, ...weakReasons.slice(0, 2)], 15),
    resolvedConcerns: [...new Set([...current.resolvedConcerns, ...newlyResolved])],
    activeConcerns: updatedConcerns,
    answeredCompetencies: newAnsweredCompetencies,
    jdMatchedSkills: current.jdMatchedSkills,
    jdMissingSkills: current.jdMissingSkills,
    interviewTopicOrder: roadmap,
    currentTopicIndex: newTopicIndex,
  };
}

// ── Main decision function ────────────────────────────────────────────────────

// ── Natural acknowledgment layer ──────────────────────────────────────────────
// The topic-roadmap questions below (buildTopicQuestion) are a SAFETY NET —
// they only fire when the GPT-4o call fails or is unavailable. But a safety
// net that just announces "next topic" with zero acknowledgment of what the
// candidate said is exactly what feels like "a mock test" instead of a real
// interviewer. This layer prepends a short, varied acknowledgment so even the
// deterministic fallback sounds like someone who was listening, not a form
// stepping through fixed questions.

const GENERIC_ACK_VARIANTS = [
  "Okay, that's helpful context.",
  "Got it, thanks for walking me through that.",
  "That's a clear picture, thank you.",
  "I appreciate the detail there.",
  "Alright, that gives me something concrete to go on.",
  "Understood, thanks.",
];

// Picks a short, concrete thing to reference from what the candidate actually
// said this turn — preferring a remembered metric, goal, or company over a
// generic line, since a callback to specifics is what makes a recruiter sound
// like they're actually tracking the conversation rather than reading a list.
function buildNaturalAcknowledgment(
  answer: string,
  memory: RecruiterMemoryV2,
  turns: number,
): string {
  const lastMetric = memory.metrics[memory.metrics.length - 1];
  if (lastMetric && answer.toLowerCase().includes(lastMetric.toLowerCase().slice(0, 6))) {
    return `Okay, ${lastMetric} is a useful data point.`;
  }
  if (memory.candidateGoals.length && /\b(want|hope|looking to|goal|grow|move into|interested in)\b/i.test(answer)) {
    return "That motivation comes through clearly.";
  }
  const lower = answer.toLowerCase();
  if (/\b(patient|patience|calm|reassur)/.test(lower)) {
    return "That patience with the customer stands out.";
  }
  if (/\b(took over|stepped in|inherited|frustrated)\b/.test(lower)) {
    return "Stepping into an already-frustrated situation isn't easy — good context.";
  }
  return GENERIC_ACK_VARIANTS[turns % GENERIC_ACK_VARIANTS.length];
}

function withAcknowledgment(question: string, answer: string, memory: RecruiterMemoryV2, turns: number): string {
  return `${buildNaturalAcknowledgment(answer, memory, turns)} ${question}`;
}

export function decideRecruiterResponseV2(input: {
  answer: string;
  currentQuestion?: string;
  transcript?: TranscriptItem[];
  setup?: RecruiterIntelligenceSetup;
  memory?: unknown;
  trust?: number;
  interest?: number;
}): RecruiterDecisionV2 {
  const answer = text(input.answer);
  const setup = input.setup || {};
  const turns = candidateTurnCount(input.transcript);

  // Too short — treat as STT noise / filler, return gentle prompt
  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < 8 && turns > 0) {
    return {
      reply: localize(setup, "I want to make sure I'm following you — could you say a bit more about that?"),
      memory: createRecruiterMemoryV2(input.memory),
      trustDelta: 0, interestDelta: 0, concern: "", weakAnswer: false,
      contradictionDetected: false, evidenceRequested: false, projectDeepDive: false,
    };
  }

  const transcriptMemory = buildRecruiterMemoryFromTranscript(input.transcript, setup);
  const previousMemory = mergeRecruiterMemoryV2(transcriptMemory, input.memory);

  // Initialise roadmap and JD gap analysis on first turn
  const roadmap = previousMemory.interviewTopicOrder.length
    ? previousMemory.interviewTopicOrder
    : buildInterviewRoadmap(setup);

  let jdMatched = previousMemory.jdMatchedSkills;
  let jdMissing = previousMemory.jdMissingSkills;
  if (!jdMatched.length && !jdMissing.length) {
    const gap = buildJdGapAnalysis(setup);
    jdMatched = gap.matched;
    jdMissing = gap.missing;
  }

  const memory = updateRecruiterMemoryV2(
    { ...previousMemory, interviewTopicOrder: roadmap, jdMatchedSkills: jdMatched, jdMissingSkills: jdMissing },
    answer,
    setup,
  );

  const contradictions = detectContradictions(answer, previousMemory);
  const weakReasons = detectWeakAnswerReasons(answer);
  const evidenceRequest = buildEvidenceRequest(answer, setup, input.transcript);
  const unsupportedClaims = extractClaimSummary(answer).filter((c) => !isClaimSupported(c, setup));

  // ── Transition evidence: now properly computed (fixes the runtime crash) ───
  const transitionEvidenceProvided = hasCareerTransitionEvidenceProvided(answer);
  const transitionSignal = hasCareerTransitionSignal(answer, setup);
  // alreadyAskedTransition: detects whether the recruiter has already raised the
  // career transition challenge in any form. Uses multiple patterns to cover all
  // the phrasings used by buildTopicQuestion and buildCareerTransitionQuestion.
  // Previously too narrow — missed "shows you're ready for it", "different direction", etc.
  const alreadyAskedTransition = transcriptContains(input.transcript, /\b(transition|switch|shift|move into|why .* role|ready for this role|ready for it|shows you.re ready|different direction|hands.on|proves? you are ready|ramp.up|prepared for|background is mainly|what have you done.{0,40}ready|practical|readiness)\b/i);
  const transitionAlreadyResolved = memory.resolvedConcerns.includes("career_switch") || previousMemory.resolvedConcerns.includes("career_switch");
  // transitionConcernAskedTooMuch: move on after asking once and getting any
  // substantive response (12+ words). Real recruiters don't ask the same
  // transition question twice — they probe deeper or move to a new topic.
  const transitionAskCount = previousMemory.activeConcerns.find((c) => c.id === "career_switch")?.askedCount ?? 0;
  const candidateGaveSubstantiveResponse = wordCount >= 12;
  const transitionConcernAskedTooMuch = transitionAskCount >= 2 || (transitionAskCount >= 1 && candidateGaveSubstantiveResponse);

  let reply = "";
  let concern = "";
  let trustDelta = 0;
  let interestDelta = 0;
  let evidenceRequested = false;
  let projectDeepDive = false;

  // ── Decision tree ─────────────────────────────────────────────────────────

  if (contradictions.length) {
    // Priority 1: Contradiction — always address
    concern = contradictions[0];
    reply = contradictionClarifyingQuestion(contradictions[0], previousMemory);
    trustDelta = -18;
    interestDelta = -6;
    memory.activeConcerns = addOrUpdateConcern(memory.activeConcerns, "contradiction", contradictions[0]);

  } else if (transitionSignal && !transitionAlreadyResolved && !transitionConcernAskedTooMuch && alreadyAskedTransition && transitionEvidenceProvided) {
    // Priority 2a: Transition asked, evidence provided → resolve and move on
    concern = "Career transition concern resolved by evidence. Moving to role-specific depth.";
    reply = buildPostTransitionProgressionQuestion(answer, setup);
    trustDelta = 5;
    interestDelta = 6;
    memory.resolvedConcerns = [...new Set([...memory.resolvedConcerns, "career_switch" as ConcernId])];
    memory.activeConcerns = memory.activeConcerns.filter((c) => c.id !== "career_switch");

  } else if (transitionSignal && !transitionAlreadyResolved && !transitionConcernAskedTooMuch && !alreadyAskedTransition && wordCount >= 12) {
    // Priority 2b: Transition detected, not yet asked → ask once
    concern = "Career transition or role mismatch needs honest validation.";
    reply = (() => {
      const cvRole = extractLikelyCvRole(setup);
      const target = text(setup.targetRole, "this role");
      const safeRole = cvRole && cvRole.length <= 60 ? cvRole : "";
      if (safeRole) return `I can see your background is mainly in ${safeRole}. This role is ${target}, which is a different direction. What have you done hands-on — a project, course, freelance work, or direct experience — that shows you're ready for it?`;
      return `Looking at your background and this ${target} role, there's a transition here I want to understand. What have you done practically that shows readiness for this role, not just interest in it?`;
    })();
    trustDelta = 0;
    interestDelta = 4;
    memory.activeConcerns = addOrUpdateConcern(memory.activeConcerns, "career_switch", "Career switch from CV background to target role needs validation.");

  } else if (transitionSignal && (transitionAlreadyResolved || transitionConcernAskedTooMuch)) {
    // Priority 2c: Transition is resolved or has been asked enough.
    // Do NOT ask another transition/customer-management duplicate; move to the next uncovered competency.
    const next = findNextUntestedTopic(memory, roadmap, memory.currentTopicIndex + 1);
    concern = "Transition question resolved or limited. Moving to next uncovered competency.";
    reply = withAcknowledgment(buildTopicQuestion(next.topic, setup, memory, answer), answer, memory, turns);
    trustDelta = 2;
    interestDelta = 3;
    memory.currentTopicIndex = next.index;

  } else if (turns <= 1) {
    // Priority 3: Very early — contextual background question.
    // If the candidate already gave customer evidence, avoid asking the same customer question again.
    concern = "Early background answer should be explored contextually.";
    const target = text(setup.targetRole, "this role");
    if (/support|customer|client|ticket|relationship|satisfaction/i.test(lower(answer)) && !memory.answeredCompetencies.includes("customer_management")) {
      reply = `That customer-facing experience is relevant. Could you tell me about one difficult customer situation you handled and what you personally did?`;
    } else {
      const next = findNextUntestedTopic(memory, roadmap, memory.currentTopicIndex + 1);
      reply = withAcknowledgment(buildTopicQuestion(next.topic, setup, memory, answer), answer, memory, turns);
      memory.currentTopicIndex = next.index;
    }
    trustDelta = 2;
    interestDelta = 3;

  } else if (unsupportedClaims.length) {
    // Priority 4: Unsupported claim
    concern = `Unsupported claim: ${unsupportedClaims[0]}`;
    reply = `I need to verify that. ${unsupportedClaims[0]} is not clearly supported by your CV or job context. Was this official work, freelance work, a project, or a transferable example?`;
    trustDelta = -10;
    interestDelta = -3;
    evidenceRequested = true;
    memory.activeConcerns = addOrUpdateConcern(memory.activeConcerns, "unsupported_claim", unsupportedClaims[0]);

  } else if (evidenceRequest && !recentlyAskedEvidence(input.transcript)) {
    // Priority 5: Evidence needed but not recently asked
    concern = weakReasons[0] || "Needs stronger evidence.";
    reply = evidenceRequest;
    trustDelta = weakReasons.length >= 3 ? -8 : -4;
    interestDelta = -1;
    evidenceRequested = true;

  } else {
    // Priority 6: Normal progression — follow the topic roadmap

    // Check if we should address a JD gap
    const unaskedJdGap = jdMissing.find((skill) =>
      !transcriptContains(input.transcript, new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")}\\b`, "i"))
    );

    if (unaskedJdGap && turns >= 3) {
      // Address a JD gap we haven't covered yet
      concern = `JD gap not yet addressed: ${unaskedJdGap}`;
      reply = buildJdGapQuestion(unaskedJdGap, setup);
      trustDelta = 3;
      interestDelta = 4;

    } else {
      // Follow topic roadmap — ask the next uncovered competency, not the previous question again.
      const askedTopic = inferAskedTopicFromQuestion(input.currentQuestion || "") || inferAskedTopicFromQuestion(
        Array.isArray(input.transcript)
          ? [...input.transcript].reverse().find((item) => item.role === "recruiter")?.text || ""
          : ""
      );
      if (askedTopic && inferAnsweredCompetencies(answer, setup).includes(askedTopic) && !memory.answeredCompetencies.includes(askedTopic)) {
        memory.answeredCompetencies = [...new Set([...memory.answeredCompetencies, askedTopic])] as CompetencyId[];
      }
      const next = findNextUntestedTopic(memory, roadmap, memory.currentTopicIndex);
      const targetTopic = next.topic;
      reply = withAcknowledgment(buildTopicQuestion(targetTopic, setup, memory, answer), answer, memory, turns);
      concern = `Testing competency: ${TOPIC_LABEL[targetTopic]}`;
      trustDelta = 4;
      interestDelta = 4;
      memory.currentTopicIndex = next.index;
    }
  }

  // Prevent near-duplicate replies
  if (isNearDuplicateReply(reply, input.transcript)) {
    const next = findNextUntestedTopic(memory, roadmap, memory.currentTopicIndex + 1);
    reply = withAcknowledgment(buildTopicQuestion(next.topic, setup, memory, answer), answer, memory, turns);
    concern = concern || "Prevented repeated recruiter follow-up.";
    memory.currentTopicIndex = next.index;
    memory.answeredCompetencies = [...new Set([
      ...memory.answeredCompetencies,
      ...inferAnsweredCompetencies(answer, setup),
    ])] as CompetencyId[];
  }

  reply = reply.replace(/Give me one concrete metric or proof point:\s*time saved, tickets reduced, customer impact, quality improvement, revenue, cost, or before-and-after result\.?/gi, "That gives me some useful context. Let me go one level deeper: what did you personally decide or change, and what happened after that?");

  return {
    reply: localize(setup, makeReplyPersonaSpecific(reply, setup)),
    memory,
    trustDelta,
    interestDelta,
    concern,
    weakAnswer: weakReasons.length > 0,
    contradictionDetected: contradictions.length > 0,
    evidenceRequested,
    projectDeepDive,
  };
}

export function buildAdvancedReportV2(input: {
  transcript?: TranscriptItem[];
  memory?: unknown;
  setup?: RecruiterIntelligenceSetup;
}) {
  const transcript = Array.isArray(input.transcript) ? input.transcript : [];
  const candidateAnswers = transcript.filter((item) => item.role === "candidate").map((item) => text(item.text)).filter(Boolean);
  let memory = createRecruiterMemoryV2(input.memory);
  for (const answer of candidateAnswers) {
    memory = updateRecruiterMemoryV2(memory, answer, input.setup || {});
  }
  const trustEvents = memory.trustEvents.slice(0, 20);
  const totalTrustDelta = trustEvents.reduce((sum, event) => sum + event.delta, 0);
  const weakAnswerCount = candidateAnswers.filter((a) => detectWeakAnswerReasons(a).length > 0).length;
  return {
    memory,
    companies: memory.companies,
    roles: memory.roles,
    skills: memory.skills,
    projects: memory.projects,
    metrics: memory.metrics,
    claims: memory.claims,
    contradictions: memory.contradictions,
    evidenceRequests: memory.evidenceRequests,
    weakAnswerCount,
    totalTrustDelta,
    trustEvents,
    strengths: memory.strengths,
    weaknesses: memory.weaknesses,
    resolvedConcerns: memory.resolvedConcerns,
    jdMatchedSkills: memory.jdMatchedSkills,
    jdMissingSkills: memory.jdMissingSkills,
    answeredCompetencies: memory.answeredCompetencies,
  };
}

// ── Compatibility wrappers — consumed by unifiedRecruiterIntelligence.ts ──────
// These preserve the existing import contract while using the new sprint engine.

export function enhanceWorkZoDecisionV2(input: {
  answer?: string;
  currentQuestion?: string;
  transcript?: TranscriptItem[];
  setup?: RecruiterIntelligenceSetup;
  memory?: unknown;
  recruiterMemory?: unknown;
  recruiterTrust?: number;
  recruiterInterest?: number;
  currentTrust?: number;
  currentInterest?: number;
  currentState?: string | null;
  recruiterState?: string | null;
  decision?: Record<string, unknown>;
  baseDecision?: Record<string, unknown>;
}): any {
  const base = input.decision || input.baseDecision || {};
  const enhanced = decideRecruiterResponseV2({
    answer: input.answer || "",
    currentQuestion: input.currentQuestion,
    transcript: input.transcript,
    setup: input.setup,
    memory: input.memory || input.recruiterMemory,
    trust: input.currentTrust ?? input.recruiterTrust,
    interest: input.currentInterest ?? input.recruiterInterest,
  });

  const spokenReply =
    enhanced.reply ||
    (typeof base.spokenReply === "string" ? base.spokenReply : "") ||
    (typeof base.reply === "string" ? base.reply : "") ||
    (typeof base.question === "string" ? base.question : "");

  const displayQuestion =
    (typeof base.displayQuestion === "string" ? base.displayQuestion : "") ||
    spokenReply;

  return {
    ...base,
    ...enhanced,
    reply: spokenReply,
    question: spokenReply,
    spokenReply,
    displayQuestion,
    feedback:
      typeof base.feedback === "string"
        ? base.feedback
        : enhanced.concern || "Follow-up generated from recruiter intelligence.",
    intent:
      typeof base.intent === "string"
        ? base.intent
        : enhanced.contradictionDetected
          ? "contradiction_check"
          : enhanced.evidenceRequested
            ? "evidence_request"
            : enhanced.projectDeepDive
              ? "project_deep_dive"
              : enhanced.weakAnswer
                ? "weak_answer_probe"
                : "adaptive_follow_up",
    recruiterState:
      typeof base.recruiterState === "string"
        ? base.recruiterState
        : enhanced.contradictionDetected
          ? "skeptical"
          : enhanced.evidenceRequested
            ? "probing"
            : enhanced.projectDeepDive
              ? "interested"
              : "engaged",
    shouldAdvanceQuestion:
      typeof base.shouldAdvanceQuestion === "boolean"
        ? base.shouldAdvanceQuestion
        : !(enhanced.evidenceRequested || enhanced.contradictionDetected),
    shouldCountAsAnswer:
      typeof base.shouldCountAsAnswer === "boolean"
        ? base.shouldCountAsAnswer
        : true,
    shouldStayOnCurrentQuestion:
      typeof base.shouldStayOnCurrentQuestion === "boolean"
        ? base.shouldStayOnCurrentQuestion
        : enhanced.evidenceRequested || enhanced.contradictionDetected,
    correction:
      typeof base.correction === "string"
        ? base.correction
        : enhanced.contradictionDetected
          ? enhanced.concern
          : "",
    psychology:
      base.psychology || {
        trustDelta: enhanced.trustDelta,
        interestDelta: enhanced.interestDelta,
        state: enhanced.contradictionDetected
          ? "skeptical"
          : enhanced.evidenceRequested
            ? "probing"
            : enhanced.projectDeepDive
              ? "interested"
              : "engaged",
      },
    cvRead: base.cvRead || {
      hasCvContext: Boolean(input.setup?.cvText),
      hasJobContext: Boolean(input.setup?.jobDescription),
      memoryCompanies: enhanced.memory.companies,
      memoryRoles: enhanced.memory.roles,
      memorySkills: enhanced.memory.skills,
      // Sprint additions — surfaced to LLM context
      jdMatchedSkills: enhanced.memory.jdMatchedSkills,
      jdMissingSkills: enhanced.memory.jdMissingSkills,
      answeredCompetencies: enhanced.memory.answeredCompetencies,
      resolvedConcerns: enhanced.memory.resolvedConcerns,
    },
    evidence: base.evidence || {
      requested: enhanced.evidenceRequested,
      requests: enhanced.memory.evidenceRequests,
    },
    contradiction: base.contradiction || {
      detected: enhanced.contradictionDetected,
      items: enhanced.memory.contradictions,
    },
    weakAnswerReasons: enhanced.memory.weakAnswerReasons,
    advancedMemory: enhanced.memory,
    recruiterMemoryV2: enhanced.memory,
    memoryV2: enhanced.memory,
    memory: enhanced.memory,
    trustDelta: enhanced.trustDelta,
    interestDelta: enhanced.interestDelta,
    concern: enhanced.concern,
    weakAnswer: enhanced.weakAnswer,
    contradictionDetected: enhanced.contradictionDetected,
    evidenceRequested: enhanced.evidenceRequested,
    projectDeepDive: enhanced.projectDeepDive,
  };
}

export function buildWorkZoRecruiterReplyV2(input: {
  answer?: string;
  currentQuestion?: string;
  transcript?: TranscriptItem[];
  setup?: RecruiterIntelligenceSetup;
  memory?: unknown;
  recruiterMemory?: unknown;
  trust?: number;
  interest?: number;
  recruiterTrust?: number;
  recruiterInterest?: number;
  currentTrust?: number;
  currentInterest?: number;
  currentState?: string | null;
  recruiterState?: string | null;
}): any {
  const decision = decideRecruiterResponseV2({
    answer: input.answer || "",
    currentQuestion: input.currentQuestion,
    transcript: input.transcript,
    setup: input.setup,
    memory: input.memory || input.recruiterMemory,
    trust: input.trust ?? input.currentTrust ?? input.recruiterTrust,
    interest: input.interest ?? input.currentInterest ?? input.recruiterInterest,
  });

  return {
    shouldOverride: true,
    spokenReply: decision.reply,
    privateInstruction: decision.concern,
    reply: decision.reply,
    question: decision.reply,
    text: decision.reply,
    correction: decision.contradictionDetected ? decision.concern : "",
    psychology: {
      trustDelta: decision.trustDelta,
      interestDelta: decision.interestDelta,
      state: decision.contradictionDetected
        ? "skeptical"
        : decision.evidenceRequested
          ? "probing"
          : decision.projectDeepDive
            ? "interested"
            : "engaged",
    },
    cvRead: {
      hasCvContext: Boolean(input.setup?.cvText),
      hasJobContext: Boolean(input.setup?.jobDescription),
      memoryCompanies: decision.memory.companies,
      memoryRoles: decision.memory.roles,
      memorySkills: decision.memory.skills,
      jdMatchedSkills: decision.memory.jdMatchedSkills,
      jdMissingSkills: decision.memory.jdMissingSkills,
      answeredCompetencies: decision.memory.answeredCompetencies,
      resolvedConcerns: decision.memory.resolvedConcerns,
    },
    evidence: {
      requested: decision.evidenceRequested,
      requests: decision.memory.evidenceRequests,
    },
    contradiction: {
      detected: decision.contradictionDetected,
      items: decision.memory.contradictions,
    },
    weakAnswerReasons: decision.memory.weakAnswerReasons,
    advancedMemory: decision.memory,
    memory: decision.memory,
    recruiterMemoryV2: decision.memory,
    memoryV2: decision.memory,
    trustDelta: decision.trustDelta,
    interestDelta: decision.interestDelta,
    concern: decision.concern,
    weakAnswer: decision.weakAnswer,
    contradictionDetected: decision.contradictionDetected,
    evidenceRequested: decision.evidenceRequested,
    projectDeepDive: decision.projectDeepDive,
  };
}
