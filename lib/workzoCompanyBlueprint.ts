export type WorkZoCompanyBlueprint = {
  companyName: string;
  targetRole: string;
  market: string;
  companyArchetype: string;
  interviewPressure: string;
  businessContext: string[];
  likelyHiringConcerns: string[];
  roleSignals: string[];
  cultureSignals: string[];
  candidateProofNeeded: string[];
  suggestedOpeningFrame: string;
  generatedAt: string;
};

type BlueprintInput = {
  companyName?: string;
  targetRole?: string;
  jobDescription?: string;
  cvText?: string;
  market?: string;
  companyStyle?: string;
};

function clean(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function has(text: string, words: string[]) {
  const lower = text.toLowerCase();
  return words.some((word) => lower.includes(word.toLowerCase()));
}

function unique(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).slice(0, 7);
}

function inferCompanyArchetype(style: string, jd: string) {
  if (has(style + " " + jd, ["startup", "founder", "seed", "series a", "fast-paced"])) return "Fast-moving startup hiring team";
  if (has(style + " " + jd, ["consulting", "client", "case", "stakeholder", "partner"])) return "Consulting-style hiring panel";
  if (has(style + " " + jd, ["technical", "data", "engineer", "architecture", "sql", "python"])) return "Technical hiring manager screen";
  if (has(style + " " + jd, ["corporate", "enterprise", "compliance", "process", "governance"])) return "Structured enterprise hiring panel";
  return "Realistic recruiter and hiring-manager screen";
}

function inferRoleSignals(role: string, jd: string) {
  const source = `${role} ${jd}`;
  const signals: string[] = [];
  if (has(source, ["support", "customer", "success", "service"])) signals.push("customer impact", "ticket ownership", "communication under pressure", "escalation judgement");
  if (has(source, ["data", "analyst", "analytics", "sql", "dashboard"])) signals.push("business interpretation", "SQL/data reasoning", "metric definition", "decision impact");
  if (has(source, ["product", "pm", "roadmap", "user research"])) signals.push("prioritisation", "product metrics", "stakeholder trade-offs", "customer discovery");
  if (has(source, ["sales", "account", "revenue", "quota"])) signals.push("commercial ownership", "objection handling", "pipeline discipline", "measurable revenue impact");
  if (has(source, ["engineer", "developer", "software", "frontend", "backend"])) signals.push("technical ownership", "debugging approach", "architecture trade-offs", "delivery reliability");
  if (!signals.length) signals.push("role relevance", "ownership", "measurable impact", "clear examples");
  return unique(signals);
}

function inferConcerns(cv: string, jd: string, role: string) {
  const concerns = ["whether examples are specific enough", "whether impact is measurable", "whether ownership is clearly separated from team effort"];
  if (cv.length < 900) concerns.push("limited resume detail may make proof harder");
  if (jd.length < 400) concerns.push("thin job description means the interviewer will probe broad fit");
  if (has(role + cv, ["career break", "transition", "bootcamp", "junior", "entry"])) concerns.push("career transition story must sound confident and structured");
  if (has(jd, ["senior", "lead", "principal", "manager"])) concerns.push("seniority signal must be proven with decisions, not tasks");
  return unique(concerns);
}

export function buildWorkZoCompanyBlueprint(input: BlueprintInput): WorkZoCompanyBlueprint {
  const companyName = clean(input.companyName, "Target company");
  const targetRole = clean(input.targetRole, "Target role");
  const market = clean(input.market, "Global");
  const jobDescription = clean(input.jobDescription);
  const cvText = clean(input.cvText);
  const companyStyle = clean(input.companyStyle, "Realistic");
  const archetype = inferCompanyArchetype(companyStyle, jobDescription);
  const roleSignals = inferRoleSignals(targetRole, jobDescription);
  const likelyHiringConcerns = inferConcerns(cvText, jobDescription, targetRole);

  const businessContext = unique([
    `${companyName} will expect answers to connect your past work to ${targetRole}.`,
    jobDescription ? "The job description should drive the follow-up questions, not a generic question list." : "Without a detailed job description, the simulation will pressure-test transferable evidence.",
    `Market context: ${market}. Use locally appropriate clarity, tone, and interview expectations.`,
    `Interview style: ${archetype}.`,
  ]);

  const cultureSignals = unique([
    companyStyle === "Startup" ? "bias for speed and ownership" : "professional clarity and structured thinking",
    companyStyle === "Consulting" ? "client-ready communication" : "stakeholder communication",
    companyStyle === "Corporate" ? "process maturity and reliability" : "adaptability under follow-up pressure",
    "evidence over buzzwords",
  ]);

  const candidateProofNeeded = unique([
    "one metric-backed achievement",
    "one clear ownership example",
    "one conflict or trade-off example",
    "one role-specific example tied to the job description",
    ...roleSignals.slice(0, 3).map((signal) => `proof of ${signal}`),
  ]);

  return {
    companyName,
    targetRole,
    market,
    companyArchetype: archetype,
    interviewPressure: companyStyle === "Startup" || companyStyle === "Consulting" ? "high" : companyStyle === "Corporate" ? "structured" : "realistic",
    businessContext,
    likelyHiringConcerns,
    roleSignals,
    cultureSignals,
    candidateProofNeeded,
    suggestedOpeningFrame: `This ${targetRole} interview should test whether the candidate can prove fit for ${companyName} with specific examples, measurable outcomes, and clear ownership.`,
    generatedAt: new Date().toISOString(),
  };
}

export function formatWorkZoCompanyBlueprintForPrompt(blueprint?: WorkZoCompanyBlueprint | null) {
  if (!blueprint) return "";
  return [
    "Company / role blueprint:",
    `Company: ${blueprint.companyName}`,
    `Target role: ${blueprint.targetRole}`,
    `Market: ${blueprint.market}`,
    `Hiring environment: ${blueprint.companyArchetype}`,
    `Pressure level: ${blueprint.interviewPressure}`,
    `Business context: ${blueprint.businessContext.join(" | ")}`,
    `Likely hiring concerns: ${blueprint.likelyHiringConcerns.join(" | ")}`,
    `Role signals to test: ${blueprint.roleSignals.join(" | ")}`,
    `Culture signals to test: ${blueprint.cultureSignals.join(" | ")}`,
    `Proof needed: ${blueprint.candidateProofNeeded.join(" | ")}`,
  ].join("\n");
}
