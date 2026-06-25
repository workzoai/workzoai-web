/**
 * lib/workzoResumeIntelligence.ts
 *
 * Resume Intelligence Layer — Rule 3 of WorkZo Resume Intelligence Architecture.
 *
 * After /api/cv parses a CV into a ResumeProfile, this module generates
 * a ResumeIntelligence object that every downstream feature consumes:
 *
 *   Improve CV  → resumeIntelligence + JD
 *   ATS Score   → resumeIntelligence + JD
 *   Interview   → resumeIntelligence + JD
 *   Cover Letter → resumeIntelligence + JD
 *   Job Match   → resumeIntelligence + JD
 *   Skill Gap   → resumeIntelligence + JD
 *   Career Roadmap → resumeIntelligence
 *
 * No downstream page should re-parse raw CV text or reconstruct
 * candidate identity. Always use the canonical ResumeIntelligence.
 */

import type { ResumeProfile } from "@/lib/workzoResumeParser";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CareerLevel =
  | "Student / Intern"
  | "Entry-Level"
  | "Mid-Level"
  | "Senior"
  | "Lead / Principal"
  | "Manager"
  | "Director / VP"
  | "Executive / C-Suite"
  | "Career Changer"
  | "Unknown";

export type ResumeIntelligence = {
  // Identity — from ResumeProfile, never re-parsed
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  candidateLocation: string;
  candidateLinkedin: string;
  candidateHeadline: string;

  // Career context
  careerLevel: CareerLevel;
  totalYearsExperience: number;
  industries: string[];
  targetRoles: string[];

  // Skills and competencies
  technicalSkills: string[];
  softSkills: string[];
  atsKeywords: string[];       // high-value keywords for ATS matching

  // Strengths and gaps
  strengths: string[];         // what the candidate has that matches typical JD needs
  gaps: string[];              // common JD requirements absent from the profile

  // Interview preparation
  interviewTopics: string[];   // concrete topics to probe in interview
  stakeholderExamples: string[]; // evidence of cross-functional / stakeholder work
  projectStories: string[];    // project names worth discussing in interviews

  // Structured sections for downstream reuse
  experienceSummaries: Array<{
    title: string;
    company: string;
    dates: string;
    highlights: string[];      // top 3 bullets per role
  }>;
  educationSummaries: Array<{
    degree: string;
    institution: string;
    dates: string;
  }>;

  // Metadata
  generatedAt: string;
  parserVersion: string;
  rawTextHash?: string;
};

// ─── Career level detection ───────────────────────────────────────────────────

function detectCareerLevel(profile: ResumeProfile): CareerLevel {
  const exp = Array.isArray(profile.experience) ? profile.experience : [];
  const headline = (profile.basics?.headline || "").toLowerCase();
  const title = (exp[0]?.title || "").toLowerCase();

  const isExecutive = /\b(ceo|cto|coo|cfo|chief|c-suite|vp|vice president|managing director|managing partner)\b/.test(headline + " " + title);
  const isDirector = /\b(director|head of|vp of|vice president)\b/.test(headline + " " + title);
  const isManager = /\b(manager|team lead|lead|principal|staff engineer|engineering manager)\b/.test(headline + " " + title);
  const isSenior = /\b(senior|sr\.?|specialist|architect|expert)\b/.test(headline + " " + title);
  const isIntern = /\b(intern|trainee|graduate|junior|entry.level|associate|student|apprentice)\b/.test(headline + " " + title);

  // Estimate years from experience dates
  let years = 0;
  for (const role of exp) {
    const dates = role.dates || "";
    const yearMatches = dates.match(/\b(19|20)\d{2}\b/g);
    if (yearMatches && yearMatches.length >= 2) {
      const sorted = yearMatches.map(Number).sort((a, b) => a - b);
      years += sorted[sorted.length - 1] - sorted[0];
    } else if (/present|current|heute|now/i.test(dates) && yearMatches?.length) {
      years += new Date().getFullYear() - Number(yearMatches[0]);
    }
  }

  if (isExecutive) return "Executive / C-Suite";
  if (isDirector) return "Director / VP";
  if (isManager || years >= 10) return "Manager";
  if (isSenior || years >= 6) return "Senior";
  if (isIntern || years < 1) return "Student / Intern";
  if (years >= 3) return "Mid-Level";
  if (years >= 1) return "Entry-Level";
  if (exp.length === 0) return "Unknown";
  return "Entry-Level";
}

function estimateTotalYears(profile: ResumeProfile): number {
  const exp = Array.isArray(profile.experience) ? profile.experience : [];
  let total = 0;
  for (const role of exp) {
    const dates = role.dates || "";
    const yearMatches = dates.match(/\b(19|20)\d{2}\b/g);
    if (yearMatches && yearMatches.length >= 2) {
      const sorted = yearMatches.map(Number).sort((a, b) => a - b);
      total += sorted[sorted.length - 1] - sorted[0];
    } else if (/present|current|heute|now/i.test(dates) && yearMatches?.length) {
      total += new Date().getFullYear() - Number(yearMatches[0]);
    }
  }
  return Math.round(total);
}

// ─── Industry detection ───────────────────────────────────────────────────────

const INDUSTRY_SIGNALS: Array<[RegExp, string]> = [
  [/\b(saas|software|cloud|platform|api|tech|ai|ml|data|fintech|edtech|healthtech|devops|cybersecurity|siem|soc)\b/i, "Technology"],
  [/\b(bank|finance|financial|investment|accounting|audit|tax|insurance|asset management|hedge fund|trading)\b/i, "Finance"],
  [/\b(hospital|clinic|healthcare|medical|pharma|biotech|clinical|patient|nursing|doctor|physician)\b/i, "Healthcare"],
  [/\b(marketing|brand|agency|advertising|media|content|social media|seo|pr|communications)\b/i, "Marketing & Media"],
  [/\b(retail|e-commerce|ecommerce|consumer|fashion|luxury|fmcg|cpg)\b/i, "Retail & Consumer"],
  [/\b(logistics|supply chain|operations|manufacturing|production|warehouse|shipping)\b/i, "Operations & Logistics"],
  [/\b(consulting|strategy|management consulting|advisory|professional services)\b/i, "Consulting"],
  [/\b(education|school|university|teaching|training|learning|academic)\b/i, "Education"],
  [/\b(legal|law|attorney|paralegal|compliance|regulatory|governance)\b/i, "Legal & Compliance"],
  [/\b(engineering|mechanical|electrical|civil|chemical|structural|architecture)\b/i, "Engineering"],
  [/\b(design|ux|ui|product design|graphic|creative|animation|motion)\b/i, "Design & Creative"],
  [/\b(hr|human resources|talent|recruitment|people|workforce|organizational)\b/i, "Human Resources"],
  [/\b(real estate|property|mortgage|construction|facilities|property management)\b/i, "Real Estate"],
];

function detectIndustries(profile: ResumeProfile): string[] {
  const allText = [
    profile.basics?.headline || "",
    profile.summary || "",
    ...(profile.experience || []).map((e) => `${e.title} ${e.company} ${(e.bullets || []).join(" ")}`),
  ].join(" ").toLowerCase();

  const found: string[] = [];
  const seen = new Set<string>();
  for (const [pattern, label] of INDUSTRY_SIGNALS) {
    if (pattern.test(allText) && !seen.has(label)) {
      seen.add(label);
      found.push(label);
    }
  }
  return found.slice(0, 3);
}

// ─── Target roles ─────────────────────────────────────────────────────────────

function inferTargetRoles(profile: ResumeProfile): string[] {
  const roles: string[] = [];
  const headline = (profile.basics?.headline || "").trim();
  if (headline) roles.push(headline);

  const exp = Array.isArray(profile.experience) ? profile.experience : [];
  for (const role of exp.slice(0, 2)) {
    const t = (role.title || "").trim();
    if (t && !roles.find((r) => r.toLowerCase() === t.toLowerCase())) roles.push(t);
  }

  return [...new Set(roles)].slice(0, 4);
}

// ─── Skills classification ────────────────────────────────────────────────────

const SOFT_SKILL_RE = /\b(leadership|teamwork|communication|problem.solving|collaboration|critical thinking|time management|adaptability|creativity|empathy|negotiation|presentation|stakeholder|interpersonal|mentoring|coaching|decision.making|organizational|project management|strategic thinking|analytical)\b/i;

function classifySkills(skills: string[]): { technical: string[]; soft: string[] } {
  const technical: string[] = [];
  const soft: string[] = [];
  for (const skill of skills) {
    if (SOFT_SKILL_RE.test(skill)) soft.push(skill);
    else technical.push(skill);
  }
  return { technical, soft };
}

// ─── ATS keyword extraction ───────────────────────────────────────────────────

function extractAtsKeywords(profile: ResumeProfile): string[] {
  // Combine all text sources and extract noun phrases / technical terms
  const skillSet = new Set((profile.skills || []).map((s) => s.trim()).filter((s) => s.length >= 3 && s.length <= 40));
  const expTitles = (profile.experience || []).map((e) => e.title).filter(Boolean) as string[];
  const certifications = (profile.certifications || []) as string[];

  const combined = [...skillSet, ...expTitles, ...certifications];
  return [...new Set(combined)].slice(0, 30);
}

// ─── Strengths and gaps ───────────────────────────────────────────────────────

const COMMON_JD_REQUIREMENTS = [
  "Python", "SQL", "Data Analysis", "Project Management", "Agile", "Scrum",
  "Communication", "Leadership", "Stakeholder Management", "Budget Management",
  "Team Management", "Cross-functional Collaboration", "Strategic Planning",
  "Customer Success", "CRM", "Salesforce", "Excel", "PowerPoint",
  "AWS", "Azure", "GCP", "Docker", "Kubernetes", "CI/CD",
  "React", "Node.js", "TypeScript", "REST API", "Microservices",
  "Machine Learning", "AI", "NLP", "Data Science", "Tableau", "Power BI",
];

function detectStrengthsAndGaps(profile: ResumeProfile): { strengths: string[]; gaps: string[] } {
  const allProfileText = [
    ...(profile.skills || []),
    ...(profile.experience || []).flatMap((e) => [e.title, e.company, ...(e.bullets || [])]),
    profile.summary || "",
  ].join(" ").toLowerCase();

  const strengths: string[] = [];
  const gaps: string[] = [];

  for (const req of COMMON_JD_REQUIREMENTS) {
    if (allProfileText.includes(req.toLowerCase())) {
      strengths.push(req);
    } else {
      gaps.push(req);
    }
  }

  return {
    strengths: strengths.slice(0, 10),
    gaps: gaps.slice(0, 8),
  };
}

// ─── Interview topics ─────────────────────────────────────────────────────────

function buildInterviewTopics(profile: ResumeProfile): string[] {
  const topics: string[] = [];
  const exp = Array.isArray(profile.experience) ? profile.experience : [];

  // One topic per role: "Your time at {company} as {title}"
  for (const role of exp.slice(0, 4)) {
    if (role.title && role.company) {
      topics.push(`Your role as ${role.title} at ${role.company}`);
    }
  }

  // Projects
  for (const proj of (profile.projects || []).slice(0, 3)) {
    if (proj.name) topics.push(`Project: ${proj.name}`);
  }

  // Top skills
  for (const skill of (profile.skills || []).slice(0, 3)) {
    topics.push(`Experience with ${skill}`);
  }

  return topics.slice(0, 10);
}

function extractStakeholderExamples(profile: ResumeProfile): string[] {
  const examples: string[] = [];
  const STAKEHOLDER_RE = /\b(stakeholder|cross.functional|executive|board|client|customer|leadership|collaborate|collaborated|managed|led|coordinated|partnered)\b/i;

  for (const role of (profile.experience || [])) {
    for (const bullet of (role.bullets || [])) {
      if (STAKEHOLDER_RE.test(bullet)) {
        examples.push(bullet.slice(0, 120));
        if (examples.length >= 5) break;
      }
    }
    if (examples.length >= 5) break;
  }
  return examples;
}

function extractProjectStories(profile: ResumeProfile): string[] {
  return (profile.projects || [])
    .filter((p) => p.name)
    .map((p) => {
      const detail = (p.bullets || []).slice(0, 1).join(" ");
      return detail ? `${p.name}: ${detail.slice(0, 100)}` : p.name;
    })
    .slice(0, 6);
}

// ─── Main generator ───────────────────────────────────────────────────────────

/**
 * Generate a ResumeIntelligence object from a validated ResumeProfile.
 *
 * This is the single source of truth for all downstream WorkZo features.
 * Call this once after /api/cv returns a valid profile and store alongside
 * the ResumeProfile in session/database.
 */
export function generateResumeIntelligence(
  profile: ResumeProfile,
  rawTextHash?: string,
): ResumeIntelligence {
  const skills = (profile.skills || []) as string[];
  const { technical, soft } = classifySkills(skills);
  const { strengths, gaps } = detectStrengthsAndGaps(profile);

  const experienceSummaries = (profile.experience || [])
    .slice(0, 6)
    .map((role) => ({
      title: role.title || "",
      company: role.company || "",
      dates: role.dates || "",
      highlights: (role.bullets || []).slice(0, 3),
    }))
    .filter((r) => r.title || r.company);

  const educationSummaries = (profile.education || [])
    .slice(0, 4)
    .map((edu) => ({
      degree: edu.degree || "",
      institution: edu.institution || "",
      dates: edu.dates || "",
    }))
    .filter((e) => e.degree || e.institution);

  return {
    candidateName: profile.basics?.name || "",
    candidateEmail: profile.basics?.email || "",
    candidatePhone: profile.basics?.phone || "",
    candidateLocation: profile.basics?.location || "",
    candidateLinkedin: profile.basics?.linkedin || "",
    candidateHeadline: profile.basics?.headline || "",

    careerLevel: detectCareerLevel(profile),
    totalYearsExperience: estimateTotalYears(profile),
    industries: detectIndustries(profile),
    targetRoles: inferTargetRoles(profile),

    technicalSkills: technical,
    softSkills: soft,
    atsKeywords: extractAtsKeywords(profile),

    strengths,
    gaps,

    interviewTopics: buildInterviewTopics(profile),
    stakeholderExamples: extractStakeholderExamples(profile),
    projectStories: extractProjectStories(profile),

    experienceSummaries,
    educationSummaries,

    generatedAt: new Date().toISOString(),
    parserVersion: "v3",
    rawTextHash,
  };
}

/**
 * Build a compact text representation of ResumeIntelligence for LLM context.
 * Downstream routes (Interview, Improve CV, Cover Letter, etc.) use this
 * instead of raw CV text to avoid re-parsing and to provide structured context.
 */
export function buildResumeIntelligenceContext(
  intel: ResumeIntelligence,
  jobDescription?: string,
  targetRole?: string,
): string {
  const lines: string[] = [];

  lines.push(`Candidate: ${intel.candidateName}`);
  if (intel.candidateHeadline) lines.push(`Role: ${intel.candidateHeadline}`);
  lines.push(`Career Level: ${intel.careerLevel} (${intel.totalYearsExperience}+ years)`);
  if (intel.industries.length) lines.push(`Industries: ${intel.industries.join(", ")}`);
  if (intel.targetRoles.length) lines.push(`Target Roles: ${intel.targetRoles.join(", ")}`);

  if (intel.technicalSkills.length) {
    lines.push(`Technical Skills: ${intel.technicalSkills.slice(0, 20).join(", ")}`);
  }
  if (intel.softSkills.length) {
    lines.push(`Soft Skills: ${intel.softSkills.slice(0, 8).join(", ")}`);
  }

  if (intel.experienceSummaries.length) {
    lines.push("\nExperience:");
    for (const exp of intel.experienceSummaries) {
      lines.push(`  ${exp.title} @ ${exp.company} (${exp.dates})`);
      for (const h of exp.highlights) lines.push(`    • ${h}`);
    }
  }

  if (intel.educationSummaries.length) {
    lines.push("\nEducation:");
    for (const edu of intel.educationSummaries) {
      lines.push(`  ${edu.degree} — ${edu.institution} (${edu.dates})`);
    }
  }

  if (intel.projectStories.length) {
    lines.push("\nProjects:");
    for (const p of intel.projectStories) lines.push(`  • ${p}`);
  }

  if (intel.strengths.length) {
    lines.push(`\nStrengths: ${intel.strengths.join(", ")}`);
  }

  if (targetRole || jobDescription) {
    lines.push("\n--- Job Context ---");
    if (targetRole) lines.push(`Target Role: ${targetRole}`);
    if (jobDescription) lines.push(`JD Excerpt: ${jobDescription.slice(0, 600)}`);

    if (intel.gaps.length) {
      lines.push(`Potential Gaps vs JD: ${intel.gaps.slice(0, 5).join(", ")}`);
    }
  }

  return lines.join("\n").trim();
}
