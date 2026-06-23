export type WorkZoEvidenceTranscriptItem = {
  role?: string;
  speaker?: string;
  text?: string;
};

type EvidencePlannerInput = {
  cvText?: string;
  jobDescription?: string;
  targetRole?: string;
  transcript?: WorkZoEvidenceTranscriptItem[];
};

type EvidenceItem = {
  label: string;
  source: "cv" | "jd" | "both" | "candidate";
  priority: "low" | "medium" | "high";
};

function clean(value: unknown, max = 4000): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function norm(value: unknown): string {
  return clean(value, 300)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9+#.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const GENERIC_STOP = new Set([
  "candidate", "resume", "profile", "summary", "experience", "education", "contact", "language", "languages",
  "work", "professional", "skills", "project", "projects", "responsible", "excellent", "good", "strong", "team",
  "communication", "motivated", "detail", "oriented", "ability", "knowledge", "understanding", "including", "using",
]);

const KNOWN_TECH_OR_ROLE_SKILLS = [
  "python", "sql", "mysql", "postgresql", "excel", "power bi", "tableau", "looker", "figma", "jira", "confluence",
  "salesforce", "hubspot", "zendesk", "servicenow", "itil", "itsm", "active directory", "windows server", "linux",
  "aws", "azure", "gcp", "google cloud", "docker", "kubernetes", "api", "rest api", "graphql", "etl", "data pipeline",
  "machine learning", "nlp", "rag", "llm", "tensorflow", "sklearn", "pandas", "numpy", "matplotlib", "seaborn",
  "react", "next.js", "typescript", "javascript", "node.js", "java", "c#", "spring", "django", "fastapi",
  "cybersecurity", "siem", "soc", "splunk", "crowdstrike", "nessus", "wireshark", "iam", "penetration testing",
  "cad", "solidworks", "creo", "catia", "inventor", "windchill",
  "customer success", "customer support", "technical support", "troubleshooting", "stakeholder management",
  "roadmapping", "agile", "scrum", "a/b testing", "user research", "growth optimization", "reporting", "dashboards",
];

function unique(items: string[], limit = 30): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const label = clean(item, 80).replace(/^[-•*]\s*/, "").trim();
    const key = norm(label);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= limit) break;
  }
  return out;
}

function extractKnownSkills(text: string): string[] {
  const n = norm(text);
  const hits = KNOWN_TECH_OR_ROLE_SKILLS.filter((skill) => {
    const key = norm(skill);
    return key && new RegExp(`(^|\\s)${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`, "i").test(n);
  });
  return unique(hits.map((x) => x.replace(/\b\w/g, (m) => m.toUpperCase())), 35);
}

function extractSectionHints(text: string, headers: RegExp): string[] {
  const lines = String(text || "").replace(/\r/g, "\n").split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const found: string[] = [];
  let active = false;
  for (const line of lines) {
    if (headers.test(line)) { active = true; continue; }
    if (active && /^(experience|education|languages?|contact|profile|summary|certifications?|references?|work experience|professional experience)$/i.test(line)) break;
    if (active && line.length <= 90 && !/@|\+?\d[\d\s()./-]{5,}/.test(line)) found.push(line);
    if (found.length >= 12) break;
  }
  return unique(found, 12);
}

function extractProjects(text: string): string[] {
  return extractSectionHints(text, /^(projects?|key projects?|selected projects?|portfolio|case studies|academic projects?|bootcamp projects?|personal projects?)$/i)
    .filter((x) => !GENERIC_STOP.has(norm(x)) && !/^(skills?|experience|education)$/i.test(x));
}

function extractJdRequirements(jobDescription: string): string[] {
  const known = extractKnownSkills(jobDescription);
  const bulletLikes = String(jobDescription || "")
    .split(/\n|•|- /)
    .map((x) => clean(x, 160))
    .filter((x) => /\b(required|must|should|experience|knowledge|responsible|manage|build|analy[sz]e|support|troubleshoot|stakeholder|customer|report|dashboard|design|develop|implement)\b/i.test(x))
    .slice(0, 10);
  return unique([...known, ...bulletLikes], 18);
}

function extractCandidateClaims(transcript?: WorkZoEvidenceTranscriptItem[]): string[] {
  const answers = (transcript || [])
    .filter((t) => /candidate|user/i.test(String(t.role || t.speaker || "")))
    .map((t) => clean(t.text, 280))
    .filter(Boolean);
  return unique(
    answers.flatMap((answer) =>
      answer
        .split(/(?<=[.!?])\s+/)
        .filter((s) => /\b(i|my|me|personally|led|built|created|designed|developed|implemented|resolved|improved|managed|handled|used|worked|owned)\b/i.test(s))
        .map((s) => clean(s, 180)),
    ),
    10,
  );
}

function intersection(a: string[], b: string[]) {
  const bKeys = new Set(b.map(norm));
  return a.filter((item) => bKeys.has(norm(item)));
}

function difference(a: string[], b: string[]) {
  const bKeys = new Set(b.map(norm));
  return a.filter((item) => !bKeys.has(norm(item)));
}

export function buildWorkZoInterviewEvidencePlan(input: EvidencePlannerInput) {
  const cvText = clean(input.cvText, 8000);
  const jdText = clean(input.jobDescription, 8000);
  const targetRole = clean(input.targetRole, 120) || "the target role";

  const cvSkills = extractKnownSkills(cvText);
  const cvProjects = extractProjects(cvText);
  const jdRequirements = extractJdRequirements(jdText);
  const matched = intersection(jdRequirements, cvSkills);
  const missing = difference(jdRequirements, cvSkills).slice(0, 8);
  const claims = extractCandidateClaims(input.transcript);

  const evidenceItems: EvidenceItem[] = [
    ...matched.map((label) => ({ label, source: "both" as const, priority: "high" as const })),
    ...missing.map((label) => ({ label, source: "jd" as const, priority: "high" as const })),
    ...cvProjects.slice(0, 6).map((label) => ({ label, source: "cv" as const, priority: "medium" as const })),
    ...claims.slice(0, 6).map((label) => ({ label, source: "candidate" as const, priority: "medium" as const })),
  ];

  return {
    targetRole,
    cvSkills: cvSkills.slice(0, 18),
    cvProjects: cvProjects.slice(0, 8),
    jdRequirements: jdRequirements.slice(0, 18),
    matchedSkills: matched.slice(0, 10),
    missingOrWeakJdEvidence: missing,
    candidateClaimsToValidate: claims,
    evidenceItems,
    requiredInterviewBehavior: [
      "Do not ask generic interview questions when CV/JD evidence is available.",
      "Every new question must be grounded in one CV skill, one CV project, one role responsibility, one JD requirement, or one claim the candidate just made.",
      "Use practical scenario questions instead of trivia whenever possible.",
      "If a JD requirement is missing or weak in the CV, ask a natural gap question and let the candidate explain transferable experience.",
      "If the candidate gives a vague answer, ask a follow-up about exact action, tool, data, metric, stakeholder, or outcome before moving on.",
      "Do not repeat already-answered areas. Move through experience validation, project validation, technical depth, JD gaps, scenarios, and behavioral evidence.",
    ],
    questionPlan: {
      experienceValidation: 3,
      projectValidation: cvProjects.length > 0 ? 2 : 0,
      technicalOrRoleSkillValidation: Math.min(5, Math.max(2, matched.length + Math.min(2, cvSkills.length))),
      jdGapQuestions: Math.min(3, missing.length),
      scenarioQuestions: 3,
      behavioralQuestions: 2,
      followUpBudget: 10,
    },
  };
}

export function serializeWorkZoInterviewEvidencePlan(plan: ReturnType<typeof buildWorkZoInterviewEvidencePlan>): string {
  const lines: string[] = [];
  lines.push("WORKZO CV+JD EVIDENCE-DRIVEN INTERVIEW PLAN");
  lines.push(`Target role: ${plan.targetRole}`);
  if (plan.cvSkills.length) lines.push(`CV skills/tools to verify: ${plan.cvSkills.join(", ")}`);
  if (plan.cvProjects.length) lines.push(`CV projects to probe: ${plan.cvProjects.join(" | ")}`);
  if (plan.jdRequirements.length) lines.push(`JD requirements to cover: ${plan.jdRequirements.join(" | ")}`);
  if (plan.matchedSkills.length) lines.push(`Matched CV↔JD skills: ${plan.matchedSkills.join(", ")}`);
  if (plan.missingOrWeakJdEvidence.length) lines.push(`JD gaps / weak evidence: ${plan.missingOrWeakJdEvidence.join(" | ")}`);
  if (plan.candidateClaimsToValidate.length) lines.push(`Candidate claims to validate from transcript: ${plan.candidateClaimsToValidate.join(" | ")}`);
  lines.push(`Question mix target: experience ${plan.questionPlan.experienceValidation}, projects ${plan.questionPlan.projectValidation}, technical/role skills ${plan.questionPlan.technicalOrRoleSkillValidation}, JD gaps ${plan.questionPlan.jdGapQuestions}, scenarios ${plan.questionPlan.scenarioQuestions}, behavioral ${plan.questionPlan.behavioralQuestions}.`);
  lines.push("Mandatory behavior:");
  for (const rule of plan.requiredInterviewBehavior) lines.push(`- ${rule}`);
  lines.push("Question examples must be generated from the actual CV/JD evidence above, never from hardcoded sample CVs.");
  return lines.join("\n");
}
