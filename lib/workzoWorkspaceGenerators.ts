"use client";

import {
  extractResumeProfile,
  normalizeResumeText,
  type ResumeExperience,
  type ResumeProfile,
} from "@/lib/workzoResumeParser";

export type CvTemplate = "ats" | "modern" | "career_switcher";
export type ResumeMarket = "global" | "us" | "uk" | "germany" | "india" | "canada" | "australia" | "netherlands" | string;
export type ResumeStyle = "ats_clean" | "modern_professional" | "career_switcher" | "startup_modern" | "corporate";
export type MatchLevel = "strong" | "partial" | "stretch" | "unknown";

export type CvGenerationInput = {
  cvText?: string;
  resumeProfile?: ResumeProfile;
  jobDescription?: string;
  targetRole?: string;
  targetMarket?: ResumeMarket;
  template?: CvTemplate | ResumeStyle | string;
  companyName?: string;
};

type RoleFamily = {
  id: string;
  label: string;
  terms: string[];
  safeHeadline: string;
  transferableSignals: Array<{ label: string; evidence: RegExp }>;
};

type JdSignal = {
  targetRole: string;
  company: string;
  family: RoleFamily;
  keywords: string[];
  hardSkills: string[];
  tools: string[];
  responsibilities: string[];
  priorities: string[];
};

type EvidenceMatch = {
  label: string;
  evidence: string[];
  confidence: number;
};

export type ResumeJson = {
  profile: ResumeProfile;
  basics: ResumeProfile["basics"];
  summary: string;
  skills: string[];
  groupedSkills: string[];
  experience: ResumeExperience[];
  projects: ResumeProfile["projects"];
  education: ResumeProfile["education"];
  languages: string[];
  strengths: string[];
  roleFit: {
    label: string;
    safeHeadline: string;
    highlights: string[];
    gaps: string[];
    keywords: string[];
    matchLevel: MatchLevel;
    evidenceLines: string[];
    tailoringNotes: string[];
  };
  market: ResumeMarket;
  style: ResumeStyle;
};

const ROLE_FAMILIES: RoleFamily[] = [
  {
    id: "sales_business_development",
    label: "Sales / Business Development",
    safeHeadline: "Customer-Facing SaaS & Business Development Professional",
    terms: ["sales", "business development", "lead generation", "prospecting", "pipeline", "crm", "outreach", "account executive", "sdr", "bdr", "client", "customer", "buyer", "revenue", "market"],
    transferableSignals: [
      { label: "client-facing communication", evidence: /client|customer|stakeholder|support|communication|relationship/i },
      { label: "product explanation and demonstrations", evidence: /demo|demonstration|present|training|product|explained|introduced/i },
      { label: "customer need discovery and problem resolution", evidence: /requirement|need|issue|troubleshoot|resolve|support|escalation|satisfaction|pain/i },
      { label: "reporting and analytical follow-up", evidence: /report|dashboard|excel|analysis|analy[sz]ed|sql|tableau|kpi/i },
      { label: "SaaS/product environment exposure", evidence: /saas|software|crm|zoho|manageengine|service desk|application|platform|tool/i },
    ],
  },
  {
    id: "production_operations",
    label: "Production / Operations",
    safeHeadline: "Manufacturing Operations & Production Support Professional",
    terms: ["production", "operations", "supervisor", "manufacturing", "warehouse", "warehousing", "material", "logistics", "inventory", "shipping", "5s", "lean", "safety", "quality", "delivery", "kpi", "continuous improvement", "shift"],
    transferableSignals: [
      { label: "manufacturing and production-support exposure", evidence: /manufactur|production|shop floor|assembly|industrial|product design|process|operations/i },
      { label: "quality, safety, and delivery mindset", evidence: /quality|safety|delivery|standard|procedure|kpi|improve|stability|performance/i },
      { label: "cross-functional coordination", evidence: /cross-functional|collaborat|stakeholder|internal teams|engineering|logistics|planning/i },
      { label: "technical documentation and reporting", evidence: /documentation|technical drawing|report|excel|dashboard|system|windchill|plm|office/i },
      { label: "continuous improvement orientation", evidence: /continuous improvement|improved|optimized|reduced|increased|process|lean|5s|kaizen/i },
    ],
  },
  {
    id: "data_analytics",
    label: "Data Analytics",
    safeHeadline: "Data Analyst",
    terms: ["data", "analyst", "analytics", "sql", "python", "dashboard", "reporting", "insights", "tableau", "power bi", "visualization", "kpi", "business intelligence"],
    transferableSignals: [
      { label: "data analysis and reporting", evidence: /sql|python|analysis|analytics|dashboard|report|tableau|power bi|excel|kpi/i },
      { label: "business insight communication", evidence: /presented|stakeholder|communication|recommendation|decision|insight/i },
      { label: "process and problem-solving mindset", evidence: /problem|improve|process|automated|pipeline|optimization|troubleshoot/i },
      { label: "technical tool usage", evidence: /python|sql|tableau|power bi|gcp|aws|api|excel|pandas/i },
    ],
  },
  {
    id: "technical_support",
    label: "Technical Support / Customer Success",
    safeHeadline: "Technical Support & Customer Success Professional",
    terms: ["technical support", "it support", "service desk", "helpdesk", "troubleshooting", "ticket", "customer success", "support engineer", "application support", "itil", "itsm"],
    transferableSignals: [
      { label: "technical troubleshooting", evidence: /troubleshoot|resolved|technical issue|support|configuration|network|bug/i },
      { label: "customer-facing support", evidence: /customer|client|user|support|satisfaction|service/i },
      { label: "documentation and knowledge sharing", evidence: /knowledge base|documentation|training|process|guide|report/i },
      { label: "escalation and stakeholder coordination", evidence: /escalation|collaborat|internal teams|stakeholder|cross-functional/i },
    ],
  },
  {
    id: "engineering_design",
    label: "Engineering / Product Design",
    safeHeadline: "Engineering Design Professional",
    terms: ["engineer", "engineering", "cad", "mechanical", "product design", "prototype", "solidworks", "creo", "technical drawing", "design engineer", "manufacturability"],
    transferableSignals: [
      { label: "engineering design and CAD", evidence: /cad|creo|solidworks|catia|inventor|technical drawing|mechanical|design/i },
      { label: "prototyping and manufacturing collaboration", evidence: /prototype|3d printing|cnc|manufacturability|production|industrial/i },
      { label: "engineering change and documentation", evidence: /engineering change|documentation|windchill|plm|technical drawing|process/i },
      { label: "cross-functional problem solving", evidence: /collaborat|cross-functional|problem|improve|support/i },
    ],
  },
  {
    id: "general",
    label: "General Professional Role",
    safeHeadline: "Role-Relevant Professional",
    terms: [],
    transferableSignals: [
      { label: "communication and collaboration", evidence: /communication|team|collaborat|stakeholder|client|customer/i },
      { label: "problem solving", evidence: /problem|resolved|improved|optimized|support|analysis/i },
      { label: "ownership and adaptability", evidence: /managed|led|owned|supported|developed|created|adapt/i },
    ],
  },
];

const SKILL_CANON = [
  "Python", "SQL", "MySQL", "PostgreSQL", "Excel", "Microsoft Office", "Tableau", "Power BI", "pandas", "Matplotlib", "Seaborn", "Sklearn", "TensorFlow", "Machine Learning", "NLP", "A/B Testing", "GCP", "AWS", "REST APIs", "API Integration", "Web Scraping",
  "ITIL", "ITSM", "Technical Support", "Troubleshooting", "Customer Support", "Service Delivery", "Requirements Analysis", "Documentation", "Reporting", "Dashboards", "Process Improvement", "Project Management", "Agile", "Training", "Stakeholder Communication", "Client Communication", "Customer Engagement", "Relationship Management", "Product Demonstrations", "CRM", "SaaS", "Lead Generation", "Prospecting", "Pipeline Management", "Business Development",
  "CAD", "3D CAD", "CREO", "SolidWorks", "Catia V5", "Inventor", "Windchill", "CNC", "3D Printing", "Mechanical Design", "Product Design", "Product Lifecycle Management", "Prototyping", "Manufacturing Support", "Quality", "Safety", "Inventory", "Material Flow", "Logistics", "Warehouse", "KPI Reporting", "Lean Manufacturing", "5S", "Continuous Improvement",
];

const TOOL_CANON = ["Excel", "Microsoft Office", "Warehouse Management System", "WMS", "SAP", "Salesforce", "HubSpot", "Zoho", "Zoho CRM", "Pipedrive", "LinkedIn", "ZoomInfo", "Outreach", "Klenty", "SQL", "Python", "Tableau", "Power BI", "CREO", "SolidWorks", "Catia V5", "Inventor", "Windchill", "GCP", "AWS"];

const ACTION_VERBS = /^(created|designed|developed|engineered|supported|collaborated|managed|led|trained|coached|improved|reduced|increased|resolved|delivered|implemented|maintained|prepared|analy[sz]ed|coordinated|optimized|automated|built|presented|conducted|assisted|participated|fabricated|utilized|monitored|ensured)\b/i;
const DATE_RE = /\b((jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december|märz|maerz|mai|juni|juli|okt|dez)[a-zä]*\s*)?\d{4}\b/i;

function clean(value = "") {
  return normalizeResumeText(value).replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function has(source: string, term: string) {
  return new RegExp(`\\b${escapeRegExp(term).replace(/\\\s+/g, "\\s+")}\\b`, "i").test(source);
}

function unique<T>(items: T[], key = (value: T) => String(value).toLowerCase()) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const normalized = key(item).replace(/\s+/g, " ").trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(item);
  }
  return out;
}

function normalizeMarket(market?: ResumeMarket) {
  const value = String(market || "global").trim().toLowerCase();
  if (["de", "deutschland", "germany"].includes(value)) return "germany";
  if (["nl", "netherlands", "holland"].includes(value)) return "netherlands";
  if (["usa", "us", "united states"].includes(value)) return "us";
  if (["uk", "united kingdom", "england"].includes(value)) return "uk";
  if (["in", "india"].includes(value)) return "india";
  return value || "global";
}

function normalizeStyle(template?: CvGenerationInput["template"]): ResumeStyle {
  const value = String(template || "ats").trim().toLowerCase();
  if (value === "modern") return "modern_professional";
  if (value === "ats") return "ats_clean";
  if (value === "career_switcher") return "career_switcher";
  if (value === "startup") return "startup_modern";
  if (value === "corporate") return "corporate";
  if (["ats_clean", "modern_professional", "career_switcher", "startup_modern", "corporate"].includes(value)) return value as ResumeStyle;
  return "ats_clean";
}

function titleFromJd(jobDescription = "", targetRole = "") {
  const explicit = clean(targetRole);
  if (explicit && !/^target role$/i.test(explicit)) return explicit;

  const lines = jobDescription.split(/\n+/).map(clean).filter(Boolean).slice(0, 20);
  const titleLine = lines.find((line) => /job\s*title|position|role/i.test(line));
  if (titleLine) {
    const cleaned = titleLine.replace(/^(job\s*title|position|role)\s*[:\-]\s*/i, "").trim();
    if (cleaned.length > 2 && cleaned.length < 90) return cleaned;
  }

  return lines.find((line) => /manager|engineer|analyst|supervisor|specialist|developer|designer|consultant|coordinator|associate|executive|lead|support|scientist|operator|officer/i.test(line) && line.length < 90) || "Target Role";
}

function companyFromJd(jobDescription = "", companyName = "") {
  const explicit = clean(companyName);
  if (explicit && !/^your company$/i.test(explicit)) return explicit;
  const first = jobDescription.split(/\n+/).map(clean).find((line) => /\b(is recruiting|is hiring| at |with |company|about us|who we are)\b/i.test(line));
  const match = first?.match(/^([A-Z][A-Za-z0-9&.\- ]{2,40})\s+(is|are)\b/);
  return match?.[1]?.trim() || "your company";
}

function extractKeywords(text = "", dictionary: string[]) {
  const source = text.toLowerCase();
  return unique(dictionary.filter((item) => has(source, item.toLowerCase())));
}

function extractResponsibilities(text = "") {
  return text
    .split(/\n|\.|;/)
    .map((line) => clean(line.replace(/^[-*•]\s*/, "")))
    .filter((line) => line.length >= 25 && line.length <= 210)
    .filter((line) => /manage|lead|support|ensure|maintain|prepare|analy[sz]e|coordinate|develop|improve|report|create|deliver|train|coach|resolve|collaborate|communicate|monitor|operate|design|build|implement/i.test(line))
    .slice(0, 14);
}

function classifyJd(jobDescription = "", targetRole = "") {
  const source = `${targetRole}\n${jobDescription}`.toLowerCase();
  let best = ROLE_FAMILIES[ROLE_FAMILIES.length - 1];
  let bestScore = -1;

  for (const family of ROLE_FAMILIES) {
    const score = family.terms.reduce((sum, term) => sum + (source.includes(term.toLowerCase()) ? 1 : 0), 0);
    if (score > bestScore) {
      best = family;
      bestScore = score;
    }
  }

  return bestScore > 0 ? best : ROLE_FAMILIES[ROLE_FAMILIES.length - 1];
}

function analyzeJd(input: CvGenerationInput): JdSignal {
  const jobDescription = input.jobDescription || "";
  const targetRole = titleFromJd(jobDescription, input.targetRole || "");
  const company = companyFromJd(jobDescription, input.companyName || "");
  const family = classifyJd(jobDescription, targetRole);
  const hardSkills = extractKeywords(jobDescription, SKILL_CANON);
  const tools = extractKeywords(jobDescription, TOOL_CANON);
  const responsibilities = extractResponsibilities(jobDescription);
  const priorities = unique([
    ...responsibilities.flatMap((line) => line.toLowerCase().match(/[a-z][a-z+\-/]{4,}/g) || []),
    ...hardSkills,
    ...tools,
    ...family.terms,
  ])
    .filter((word) => !/responsible|experience|required|including|should|ability|successful|position|candidate|company|business|global|working|within|their|which|with|from|this|that|your|will/i.test(word))
    .slice(0, 28);

  return {
    targetRole,
    company,
    family,
    keywords: unique([...hardSkills, ...tools, ...family.terms]).slice(0, 24),
    hardSkills,
    tools,
    responsibilities,
    priorities,
  };
}

function profileFromInput(input: CvGenerationInput) {
  return input.resumeProfile || extractResumeProfile(input.cvText || "");
}

function evidenceLines(profile: ResumeProfile) {
  return unique([
    profile.summary,
    ...profile.skills,
    ...profile.strengths,
    ...(profile.additionalEvidence || []),
    ...profile.experience.flatMap((job) => [job.title, job.company, job.location, ...job.bullets]),
    ...profile.projects.flatMap((project) => [project.name, ...project.bullets]),
    ...profile.education.flatMap((edu) => [edu.degree, edu.institution]),
    ...profile.languages,
  ].map(clean).filter((line) => line.length > 2 && line.length < 280));
}

function evidenceSource(profile: ResumeProfile) {
  return evidenceLines(profile).join(" \n ");
}

function scoreEvidence(line: string, jd: JdSignal) {
  const text = clean(line).toLowerCase();
  let score = 0;

  for (const keyword of jd.keywords) {
    const k = keyword.toLowerCase();
    if (k.length > 2 && text.includes(k)) score += k.includes(" ") ? 5 : 3;
  }

  for (const priority of jd.priorities) {
    if (priority.length > 4 && text.includes(priority.toLowerCase())) score += 2;
  }

  for (const signal of jd.family.transferableSignals) {
    if (signal.evidence.test(text)) score += 4;
  }

  if (ACTION_VERBS.test(text)) score += 2;
  if (/\d+%|\d+\+|\b\d{2,}\b|reduced|increased|improved|resolved|automated|built|delivered/i.test(text)) score += 2;
  if (/^(education|languages|contact|skills|professional experience|profile summary)$/i.test(text)) score -= 10;
  if (text.length < 18) score -= 4;

  return score;
}

function matchedEvidence(profile: ResumeProfile, jd: JdSignal) {
  return evidenceLines(profile)
    .map((line) => ({ line, score: scoreEvidence(line, jd) }))
    .filter((item) => item.score > 1)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.line);
}

function signalMatches(profile: ResumeProfile, jd: JdSignal): EvidenceMatch[] {
  const source = evidenceSource(profile);
  return jd.family.transferableSignals.map((signal) => {
    const evidence = evidenceLines(profile).filter((line) => signal.evidence.test(line)).slice(0, 3);
    return {
      label: signal.label,
      evidence,
      confidence: signal.evidence.test(source) ? Math.min(1, 0.35 + evidence.length * 0.2) : 0,
    };
  }).filter((item) => item.confidence > 0.2);
}

function cleanVisibleHeadline(value = "") {
  const headline = clean(value)
    .replace(/\bRole-Relevant Professional\b/gi, "Professional")
    .replace(/\s+with\s+.+$/i, "")
    .trim();
  if (!headline || /unknown|candidate|profile/i.test(headline)) return "Professional";
  return headline;
}

function safeHeadline(profile: ResumeProfile, jd: JdSignal, matches: EvidenceMatch[]) {
  const current = cleanVisibleHeadline(profile.basics.headline || "Professional");
  const source = evidenceSource(profile);

  if (jd.family.id === "general") return current;
  if (jd.family.id === "sales_business_development") {
    if (/support|customer|client|technical|application|product|saas|software|zoho|crm/i.test(source)) return "Customer-Facing SaaS & Business Development Professional";
    return current === "Professional" ? jd.family.safeHeadline : `${current} | Business Development`;
  }
  if (jd.family.id === "production_operations") {
    if (/manufactur|production|cad|engineering|technical drawing|quality|process|inventory|material|logistics/i.test(source)) return "Manufacturing Operations & Production Support Professional";
    return current === "Professional" ? jd.family.safeHeadline : `${current} | Operations Support`;
  }
  if (jd.family.id === "data_analytics") {
    if (/support|technical|business|operations/i.test(current)) return `${current} | Data Analytics`;
    return current === "Professional" ? jd.family.safeHeadline : current;
  }
  if (jd.family.id === "technical_support") return current === "Professional" ? jd.family.safeHeadline : current;
  if (jd.family.id === "engineering_design") return /engineer|design|cad|mechanical/i.test(current) ? current : jd.family.safeHeadline;

  return matches.length >= 2 ? jd.family.safeHeadline : current;
}

function gapAnalysis(profile: ResumeProfile, jd: JdSignal) {
  const source = evidenceSource(profile).toLowerCase();
  const gaps = jd.keywords
    .filter((keyword) => {
      const k = keyword.toLowerCase();
      if (k.length < 3) return false;
      if (source.includes(k)) return false;
      const first = k.split(/\s+|-/)[0];
      return first.length > 4 && !source.includes(first);
    })
    .slice(0, 6);
  return gaps;
}

function buildRoleFit(profile: ResumeProfile, jd: JdSignal) {
  const matches = signalMatches(profile, jd);
  const evidence = matchedEvidence(profile, jd).slice(0, 8);
  const gaps = gapAnalysis(profile, jd);
  const highlights = unique(matches.map((match) => match.label)).slice(0, 6);
  const matchLevel: MatchLevel = highlights.length >= 4 && gaps.length <= 3 ? "strong" : highlights.length >= 3 ? "partial" : highlights.length >= 1 ? "stretch" : "unknown";
  const notes = [
    matchLevel === "strong" ? "Strong evidence overlap with the target JD." : "Use transferable strengths honestly; do not overclaim missing direct experience.",
    gaps.length ? `Do not claim unsupported keywords directly: ${gaps.slice(0, 4).join(", ")}.` : "Most important JD keywords have some evidence in the CV.",
  ];

  return {
    label: jd.targetRole,
    safeHeadline: safeHeadline(profile, jd, matches),
    highlights,
    gaps,
    keywords: jd.keywords,
    matchLevel,
    evidenceLines: evidence,
    tailoringNotes: notes,
  };
}

function cleanSkillForDisplay(value = "") {
  return clean(value)
    .replace(/\bWÜRzburg\b/gi, "Würzburg")
    .replace(/\bInventor 3d Printing:\s*Fff\b/gi, "Inventor")
    .replace(/\b3d Printing\b/gi, "3D Printing")
    .replace(/\bFff\b/g, "FFF")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanSkillsForDisplay(items: string[]) {
  return unique(
    items
      .map(cleanSkillForDisplay)
      .filter(Boolean)
      .filter((item) => item.length <= 45)
      .filter((item) => !/^(education|languages|contact|profile|summary|work experience|professional experience|tools|experience)$/i.test(item))
      .filter((item) => !/\b(linkedin|outlook|gmail|@|\+\d|www\.)\b/i.test(item)),
  );
}

function truthfulRoleSkills(profile: ResumeProfile, jd: JdSignal) {
  const source = evidenceSource(profile);
  const sourceLower = source.toLowerCase();
  const out: string[] = [];

  const hasEvidence = (pattern: RegExp) => pattern.test(source);
  const jdHas = (pattern: RegExp) => pattern.test(`${jd.targetRole} ${jd.keywords.join(" ")} ${jd.responsibilities.join(" ")}`);

  for (const skill of jd.hardSkills) {
    const first = skill.toLowerCase().split(/\s+|-/)[0];
    if (has(source, skill) || (first.length > 4 && sourceLower.includes(first))) out.push(skill);
  }

  for (const tool of jd.tools) {
    const first = tool.toLowerCase().split(/\s+|-/)[0];
    if (has(source, tool) || (first.length > 4 && sourceLower.includes(first))) out.push(tool);
  }

  const roleRules: Record<string, Array<[string, RegExp, RegExp]>> = {
    sales_business_development: [
      ["Client Communication", /client|customer|stakeholder|communication|support/i, /client|customer|communication|relationship|buyer|prospect/i],
      ["Customer Engagement", /customer|client|satisfaction|support|relationship/i, /customer|client|relationship|engagement/i],
      ["Product Demonstrations", /demo|demonstration|present|training|explained/i, /demo|introduce|solution|buyer|presentation/i],
      ["SaaS Product Knowledge", /saas|software|zoho|manageengine|service desk|crm|application/i, /saas|software|crm|solution|product/i],
      ["Requirements Analysis", /requirement|need|analysis|issue|pain|problem/i, /need|pain|requirement|analysis|qualif/i],
      ["Reporting", /report|dashboard|excel|analysis|tableau|power bi|kpi/i, /report|dashboard|pipeline|funnel|analysis/i],
    ],
    production_operations: [
      ["Manufacturing Support", /manufactur|production|industrial|product design|engineering|shop floor/i, /manufactur|production|operations|material/i],
      ["Quality", /quality|stability|defect|issue|standard|procedure|product manufacturability/i, /quality|standard|procedure|safe|delivery/i],
      ["Safety", /safety|safe work|standards|procedure/i, /safety|safe work|standard|procedure/i],
      ["Inventory", /inventory|stock|warehouse|material|parts|windchill|plm/i, /inventory|stock|warehouse|material|parts/i],
      ["Material Flow", /material|logistics|warehouse|shipping|production line|flow|manufacturability/i, /material|logistics|warehouse|shipping|flow|production line/i],
      ["Continuous Improvement", /continuous improvement|improved|optimized|reduced|increased|process|manufacturability/i, /continuous improvement|lean|5s|improve|kpi/i],
      ["KPI Reporting", /kpi|report|dashboard|metric|excel|analysis/i, /kpi|report|dashboard|metric|excel|data/i],
      ["Training", /training|trained|mentored|coached|knowledge base|technical trainings/i, /training|train|coach|mentor|develop/i],
    ],
    data_analytics: [
      ["Data Analysis", /sql|python|analysis|analytics|tableau|excel|pandas/i, /data|analyst|analytics|sql|python/i],
      ["Dashboard Reporting", /dashboard|report|tableau|power bi|visuali[sz]ation|kpi/i, /dashboard|report|visuali[sz]ation|kpi/i],
      ["Process Improvement", /improved|automated|optimized|pipeline|process|reduced/i, /process|improve|automation|pipeline/i],
    ],
    technical_support: [
      ["Technical Troubleshooting", /troubleshoot|resolved|technical issue|support|configuration|network|bug/i, /support|troubleshoot|technical|service/i],
      ["Customer Support", /customer|client|user|support|satisfaction|service/i, /customer|client|user|support|service/i],
      ["Knowledge Documentation", /knowledge base|documentation|training|process|guide|report/i, /documentation|knowledge|training|process/i],
    ],
    engineering_design: [
      ["CAD Design", /cad|creo|solidworks|catia|inventor|technical drawing|mechanical|design/i, /cad|design|engineering|mechanical/i],
      ["Prototyping", /prototype|3d printing|cnc|manufacturability|production|industrial/i, /prototype|manufacturability|production|industrial/i],
      ["Engineering Documentation", /engineering change|documentation|windchill|plm|technical drawing|process/i, /documentation|drawing|engineering change|plm/i],
    ],
    general: [
      ["Communication", /communication|team|collaborat|stakeholder|client|customer/i, /communication|team|stakeholder|customer|client/i],
      ["Problem Solving", /problem|resolved|improved|optimized|support|analysis/i, /problem|improve|support|analysis/i],
    ],
  };

  const rules = roleRules[jd.family.id] || roleRules.general;
  for (const [label, evidence, jdNeed] of rules) {
    if (hasEvidence(evidence) && jdHas(jdNeed)) out.push(label);
  }

  return unique(out);
}
function rankSkillsForJd(skills: string[], jd: JdSignal) {
  const jdText = `${jd.targetRole} ${jd.keywords.join(" ")} ${jd.responsibilities.join(" ")} ${jd.priorities.join(" ")}`.toLowerCase();
  const familyBoost: Record<string, RegExp> = {
    sales_business_development: /client|customer|communication|relationship|crm|saas|support|requirements|report|pipeline|business development|lead|prospect|demo/i,
    production_operations: /manufactur|production|operations|quality|safety|inventory|material|logistics|continuous improvement|kpi|training|cad|mechanical|documentation|team/i,
    data_analytics: /data|sql|python|excel|tableau|power bi|dashboard|report|analytics|kpi|pandas|visual/i,
    technical_support: /technical support|troubleshoot|customer|client|itil|itsm|service|documentation|training/i,
    engineering_design: /cad|creo|solidworks|catia|inventor|mechanical|design|prototype|technical drawing|plm|windchill/i,
    general: /communication|problem|team|project|process/i,
  };

  return unique(skills)
    .map((skill, index) => {
      const lower = skill.toLowerCase();
      let score = Math.max(0, 40 - index);
      if (jdText.includes(lower)) score += 40;
      if (lower.split(/\s+|-/).some((part) => part.length > 4 && jdText.includes(part))) score += 12;
      if ((familyBoost[jd.family.id] || familyBoost.general).test(skill)) score += 22;
      if (/fff|resin printing|catia|inventor|tensorflow|sklearn|matplotlib|seaborn/i.test(skill) && !jdText.includes(lower)) score -= 15;
      if (/product demonstrations/i.test(skill) && jd.family.id !== "sales_business_development") score -= 50;
      return { skill, score };
    })
    .filter((item) => item.score > -20)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.skill);
}

function groupedSkillLines(skills: string[]) {
  const cleanSkills = cleanSkillsForDisplay(skills);
  const technical = cleanSkills.filter((s) => /python|sql|api|cad|creo|solidworks|catia|inventor|windchill|cnc|3d printing|plm|mechanical|product design|prototype|tensorflow|sklearn|gcp|aws/i.test(s));
  const reporting = cleanSkills.filter((s) => /excel|report|dashboard|tableau|power bi|matplotlib|seaborn|pandas|analytics|visualization|kpi/i.test(s));
  const operations = cleanSkills.filter((s) => /lean|5s|warehouse|inventory|material|logistics|safety|quality|delivery|training|documentation|process|project|agile|scrum|manufacturing|continuous improvement/i.test(s));
  const customer = cleanSkills.filter((s) => /communication|stakeholder|customer|client|relationship|support|troubleshooting|itil|itsm|demo|crm|sales|lead generation|prospecting|business development|saas|pipeline|requirements/i.test(s));
  const used = new Set([...technical, ...reporting, ...operations, ...customer].map((s) => s.toLowerCase()));
  const other = cleanSkills.filter((s) => !used.has(s.toLowerCase())).slice(0, 8);

  return [
    technical.length ? `Technical: ${technical.join(", ")}` : "",
    reporting.length ? `Data & Reporting: ${reporting.join(", ")}` : "",
    operations.length ? `Operations: ${operations.join(", ")}` : "",
    customer.length ? `Communication & Support: ${customer.join(", ")}` : "",
    other.length ? `Additional: ${other.join(", ")}` : "",
  ].filter(Boolean).slice(0, 5);
}

function compactSentence(value = "", max = 420) {
  const cleaned = clean(value)
    .replace(/\bThis background is relevant to.*$/i, "")
    .replace(/\bThe experience shows practical strengths in.*$/i, "")
    .trim();
  if (cleaned.length <= max) return cleaned;
  const sentence = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 2).join(" ");
  return sentence.length > 60 ? sentence : `${cleaned.slice(0, max).replace(/\s+\S*$/, "")}.`;
}

function normalizeBullet(value = "") {
  const text = clean(value)
    .replace(/^[-•*]\s*/, "")
    .replace(/\busing\.\s+/gi, "using ")
    .replace(/\band\.\s+/gi, "and ")
    .replace(/\bto\.\s+/gi, "to ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || text.length < 16) return "";
  return text.endsWith(".") ? text : `${text}.`;
}

function improveBulletVerb(bullet = "") {
  const text = normalizeBullet(bullet);
  if (!text) return "";
  if (ACTION_VERBS.test(text)) return text;
  if (/responsible for/i.test(text)) return text.replace(/^Responsible for/i, "Managed");
  if (/support/i.test(text)) return text.replace(/^Support/i, "Supported");
  if (/collaborate/i.test(text)) return text.replace(/^Collaborate/i, "Collaborated");
  return text;
}

function splitMergedBullets(bullet = "") {
  return clean(bullet)
    .replace(/\s+(Created|Designed|Developed|Engineered|Supported|Collaborated|Managed|Led|Trained|Coached|Improved|Reduced|Increased|Resolved|Delivered|Implemented|Maintained|Prepared|Analyzed|Analysed|Coordinated|Optimized|Automated|Built|Presented|Conducted|Assisted|Participated|Fabricated|Utilized|Monitored|Ensured)\b/g, "|||$1")
    .split("|||")
    .map(improveBulletVerb)
    .filter(Boolean);
}

function rankBullets(job: ResumeExperience, jd: JdSignal) {
  return unique<string>(job.bullets.flatMap(splitMergedBullets))
    .map((bullet) => ({ bullet, score: scoreEvidence(`${job.title} ${job.company} ${bullet}`, jd) }))
    .filter((item) => item.bullet.length > 15)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.bullet);
}

function cleanExperienceTitle(value = "") {
  const title = clean(value)
    .replace(/^Professional Experience$/i, "")
    .replace(/^Work Experience$/i, "")
    .replace(/^Experience$/i, "")
    .replace(/\bEnginner\b/gi, "Engineer")
    .replace(/\bWÜRzburg\b/gi, "Würzburg")
    .replace(/\bGmb H\b/g, "GmbH")
    .trim();
  return title;
}

function cleanCompanyName(value = "") {
  return clean(value)
    .replace(/^Professional Experience\s*[·|:-]\s*/i, "")
    .replace(/\bGmb H\b/g, "GmbH")
    .replace(/\bWÜRzburg\b/gi, "Würzburg")
    .trim();
}

function tailorExperience(profile: ResumeProfile, jd: JdSignal) {
  return profile.experience.slice(0, 4).map((job, index) => {
    const ranked = rankBullets(job, jd);
    const limit = index === 0 ? 5 : 4;
    const bullets = ranked.slice(0, limit);
    const title = cleanExperienceTitle(job.title);
    const company = cleanCompanyName(job.company);
    return { ...job, title, company, bullets: bullets.length ? bullets : job.bullets.map(normalizeBullet).filter(Boolean).slice(0, 3) };
  }).filter((job) => clean(job.title || job.company || job.dates) || job.bullets.length);
}

function cleanEducation(items: ResumeProfile["education"]) {
  return unique<ResumeProfile["education"][number]>(items, (item) => `${item.degree}-${item.institution}-${item.dates}`)
    .slice(0, 4)
    .map((item) => ({
      ...item,
      degree: clean(item.degree).replace(/\bMaster'S\b/g, "Master's").replace(/\bBachelor'S\b/g, "Bachelor's"),
      institution: clean(item.institution).replace(/\s*\|\s*/g, " · ").replace(/\bMaster'S\b/g, "Master's").replace(/\bBachelor'S\b/g, "Bachelor's"),
    }));
}

function tailorProjects(profile: ResumeProfile, jd: JdSignal, experience: ResumeExperience[]) {
  const experienceBullets = experience.reduce((sum, job) => sum + job.bullets.length, 0);
  const limit = experienceBullets >= 8 ? 2 : 3;
  return profile.projects.slice(0, limit).map((project) => ({
    ...project,
    bullets: unique<string>(project.bullets.map(improveBulletVerb).filter(Boolean))
      .map((bullet) => ({ bullet, score: scoreEvidence(`${project.name} ${bullet}`, jd) }))
      .sort((a, b) => b.score - a.score)
      .map((item) => item.bullet)
      .slice(0, experienceBullets >= 8 ? 2 : 3),
  })).filter((project) => project.name || project.bullets.length);
}

function buildSummary(profile: ResumeProfile, roleFit: ResumeJson["roleFit"], jd: JdSignal, hasJd: boolean) {
  const base = compactSentence(profile.summary, 300);
  const nameFreeBase = base.replace(new RegExp(escapeRegExp(profile.basics.name || "__never__"), "gi"), "").trim();

  if (!hasJd || jd.family.id === "general") {
    return nameFreeBase || `${roleFit.safeHeadline} with experience across communication, problem solving, and cross-functional collaboration.`;
  }

  const highlights = roleFit.highlights.slice(0, 3);
  const headline = roleFit.safeHeadline;
  const baseStart = nameFreeBase || `${headline} with practical professional experience.`;

  const familySummary: Record<string, string> = {
    sales_business_development: `${headline} with experience in customer-facing communication, product support, stakeholder coordination, and problem solving in technology environments.`,
    production_operations: `${headline} with experience supporting product manufacturability, technical documentation, engineering change processes, and cross-functional collaboration in industrial environments.`,
    data_analytics: `${headline} with experience in analysis, reporting, technical problem solving, and translating data into practical business insights.`,
    technical_support: `${headline} with experience resolving customer issues, coordinating with internal teams, documenting solutions, and improving service quality.`,
    engineering_design: `${headline} with experience in CAD design, mechanical engineering support, prototyping, technical drawings, and manufacturing collaboration.`,
  };

  const targeted = familySummary[jd.family.id];
  const second = highlights.length
    ? `Brings relevant strengths in ${highlights.join(", ")}, supported by the CV.`
    : "Brings transferable strengths that are relevant to the target role.";

  const summary = targeted ? `${targeted} ${second}` : `${baseStart} ${second}`;
  return compactSentence(summary, 520)
    .replace(/\bRepositioned for\b/gi, "Relevant for")
    .replace(/\boptimized for\b/gi, "aligned with")
    .replace(/\btailored toward\b/gi, "aligned with");
}
function matchLevelLabel(level: MatchLevel) {
  if (level === "strong") return "Strong fit";
  if (level === "partial") return "Partial fit";
  if (level === "stretch") return "Transferable fit";
  return "Needs more evidence";
}

export function buildResumeJson(input: CvGenerationInput): ResumeJson {
  const profile = profileFromInput(input);
  const jd = analyzeJd(input);
  const roleFit = buildRoleFit(profile, jd);
  const experience = tailorExperience(profile, jd);
  const projects = tailorProjects(profile, jd, experience);
  const roleSkills = truthfulRoleSkills(profile, jd);
  const skills = rankSkillsForJd(cleanSkillsForDisplay(unique<string>([...roleSkills, ...profile.skills])), jd).slice(0, 28);
  const groupedSkills = groupedSkillLines(skills);
  const summary = buildSummary(profile, roleFit, jd, Boolean(input.jobDescription?.trim()));

  return {
    profile,
    basics: { ...profile.basics, headline: roleFit.safeHeadline },
    summary,
    skills,
    groupedSkills,
    experience,
    projects,
    education: cleanEducation(profile.education),
    languages: unique<string>(profile.languages, (item) => item.split(" - ")[0]).slice(0, 4),
    strengths: unique<string>([...roleFit.highlights, ...profile.strengths]).slice(0, 7),
    roleFit,
    market: normalizeMarket(input.targetMarket),
    style: normalizeStyle(input.template),
  };
}

function addSection(out: string[], title: string, lines: string[]) {
  const valid = lines.map(clean).filter(Boolean);
  if (!valid.length) return;
  out.push("", title, ...valid);
}

export function buildAtsCv(input: CvGenerationInput) {
  const data = buildResumeJson(input);
  const out: string[] = [];

  out.push(data.profile.basics.name || "Candidate Name");
  out.push(data.basics.headline);

  const contact = [data.profile.basics.phone, data.profile.basics.email, data.profile.basics.location, data.profile.basics.linkedin].filter(Boolean).join(" | ");
  if (contact) out.push(contact);

  addSection(out, "PROFESSIONAL SUMMARY", [data.summary]);
  addSection(out, "CORE SKILLS", data.groupedSkills);

  if (data.experience.length) {
    out.push("", "PROFESSIONAL EXPERIENCE");
    data.experience.forEach((job) => {
      const heading = [job.title, job.company, job.location, job.dates].filter(Boolean).join(" | ");
      if (heading) out.push(heading);
      job.bullets.forEach((bullet) => out.push(`- ${bullet}`));
    });
  }

  if (data.projects.length) {
    out.push("", "PROJECTS");
    data.projects.forEach((project) => {
      if (project.name) out.push(project.name);
      project.bullets.forEach((bullet) => out.push(`- ${bullet}`));
    });
  }

  if (data.education.length) {
    out.push("", "EDUCATION");
    data.education.forEach((item) => out.push([item.degree, item.institution, item.location, item.dates].filter(Boolean).join(" | ")));
  }

  if (data.languages.length) addSection(out, "LANGUAGES", data.languages);

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function generateImprovedCv(input: CvGenerationInput) {
  return buildAtsCv(input);
}

export function buildCoverLetter(input: CvGenerationInput) {
  const data = buildResumeJson(input);
  const jd = analyzeJd(input);
  const role = data.roleFit.label || input.targetRole || "the role";
  const company = jd.company || clean(input.companyName || "your company");
  const name = data.profile.basics.name || "Candidate";
  const evidence = data.roleFit.evidenceLines.slice(0, 3);
  const highlights = data.roleFit.highlights.slice(0, 3);

  const evidenceSentence = highlights.length
    ? highlights.join(", ")
    : "communication, problem solving, and cross-functional collaboration";

  const bodyEvidence = evidence.length
    ? evidence.map((line) => `- ${line}`).join("\n")
    : highlights.map((line) => `- ${line}`).join("\n") || "- Relevant transferable experience from my CV";

  const gapSentence = data.roleFit.gaps.length && data.roleFit.matchLevel !== "strong"
    ? `I understand that the role may also require deeper direct exposure to ${data.roleFit.gaps.slice(0, 3).join(", ")}. I would approach this honestly, while bringing the relevant strengths already demonstrated in my background.`
    : "The role aligns well with the strengths and practical experience demonstrated in my background.";

  return [
    "Dear Hiring Team,",
    "",
    `I am writing to apply for the ${role} position at ${company}. My background as a ${data.profile.basics.headline || data.basics.headline} has given me practical experience in ${evidenceSentence}, which I believe is relevant to this opportunity.`,
    "",
    "The most relevant parts of my background include:",
    bodyEvidence,
    "",
    `${gapSentence} I would welcome the opportunity to discuss how my experience, communication style, and problem-solving approach can support your team.`,
    "",
    "Kind regards,",
    name,
  ].join("\n");
}

export function generateCoverLetter(input: CvGenerationInput) {
  return buildCoverLetter(input);
}

export function buildJobStrategy(input: CvGenerationInput) {
  const data = buildResumeJson(input);
  return {
    role: data.roleFit.label,
    market: data.market,
    keywords: data.roleFit.keywords,
    matchLevel: data.roleFit.matchLevel,
    platforms:
      data.market === "germany"
        ? ["LinkedIn", "StepStone", "Indeed", "Xing", "Company career pages"]
        : data.market === "netherlands"
          ? ["LinkedIn", "Indeed", "Glassdoor", "Company career pages"]
          : ["LinkedIn", "Indeed", "Glassdoor", "Google Jobs", "Company career pages"],
    plan: [
      `Search for ${data.roleFit.label} and adjacent roles.`,
      "Prioritize roles where the CV has real evidence overlap with the JD.",
      "Use the role-fit highlights in the summary, cover letter, and top experience bullets.",
      "Avoid unsupported claims; prepare interview answers for the listed gaps.",
      "Track applications and follow up after 5-7 days.",
    ],
    suggestedTitles: unique([data.roleFit.label, data.basics.headline, `${data.roleFit.label} Coordinator`, `${data.roleFit.label} Associate`]).slice(0, 6),
  };
}

export function generateJobSearchPlan(input: CvGenerationInput) {
  return buildJobStrategy(input);
}

function escapeHtml(value = "") {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderList(items: string[]) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function renderExperience(items: ResumeExperience[], compact = false) {
  return items
    .map((job) => {
      const title = [job.title, job.company].filter(Boolean).join(" · ");
      const meta = [job.location, job.dates].filter(Boolean).join(" · ");
      return `<div class="item"><div class="item-head"><div><h3>${escapeHtml(title || "Professional Experience")}</h3>${meta ? `<p>${escapeHtml(meta)}</p>` : ""}</div></div><ul>${renderList(job.bullets.slice(0, compact ? 4 : 5))}</ul></div>`;
    })
    .join("");
}

function renderAts(data: ResumeJson) {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(data.profile.basics.name)} CV</title>
  <style>*{box-sizing:border-box}body{margin:0;background:#eef2f7;color:#111827;font-family:Arial,sans-serif;line-height:1.42}.page{width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:18mm 17mm;box-shadow:0 20px 50px rgba(15,23,42,.14)}h1{margin:0;font-size:25px;letter-spacing:-.6px}.headline{margin-top:5px;font-size:14px;font-weight:700;color:#1d4ed8}.contact{margin-top:6px;color:#4b5563;font-size:10.8px}h2{margin:16px 0 7px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#1d4ed8;border-bottom:1px solid #d1d5db;padding-bottom:5px}h3{margin:0;font-size:11.5px}.item{margin-top:10px;break-inside:avoid}.item-head{display:flex;justify-content:space-between;gap:18px}.item-head p{margin:2px 0 0;color:#6b7280;font-size:10.5px}p,li{font-size:10.7px}ul{margin:5px 0 0;padding-left:16px}li{margin-bottom:3px}@media print{body{background:#fff}.page{box-shadow:none;margin:0;page-break-after:avoid}@page{size:A4;margin:0}}</style></head><body><div class="page">
    <header><h1>${escapeHtml(data.profile.basics.name)}</h1><div class="headline">${escapeHtml(data.basics.headline)}</div><div class="contact">${escapeHtml([data.profile.basics.phone, data.profile.basics.email, data.profile.basics.location, data.profile.basics.linkedin].filter(Boolean).join(" · "))}</div></header>
    <section><h2>Professional Summary</h2><p>${escapeHtml(data.summary)}</p></section>
    <section><h2>Core Skills</h2>${data.groupedSkills.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</section>
    ${data.experience.length ? `<section><h2>Professional Experience</h2>${renderExperience(data.experience)}</section>` : ""}
    ${data.projects.length ? `<section><h2>Projects</h2>${data.projects.map((p) => `<div class="item"><h3>${escapeHtml(p.name)}</h3><ul>${renderList(p.bullets.slice(0, 3))}</ul></div>`).join("")}</section>` : ""}
    ${data.education.length ? `<section><h2>Education</h2><ul>${renderList(data.education.map((e) => [e.degree, e.institution, e.dates].filter(Boolean).join(" | ")))}</ul></section>` : ""}
    ${data.languages.length ? `<section><h2>Languages</h2><p>${escapeHtml(data.languages.join(" | "))}</p></section>` : ""}
  </div></body></html>`;
}

function renderModern(data: ResumeJson) {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(data.profile.basics.name)} CV</title>
  <style>*{box-sizing:border-box}body{margin:0;background:#e5e7eb;color:#111827;font-family:Inter,Arial,sans-serif;line-height:1.45}.page{width:210mm;min-height:297mm;margin:0 auto;background:#fff;display:grid;grid-template-columns:62mm 1fr;box-shadow:0 20px 50px rgba(15,23,42,.14)}aside{background:#f7faff;border-right:1px solid #dbe4ee;padding:24px 17px}main{padding:26px 24px}.bar{width:42px;height:4px;background:#2563eb;border-radius:999px;margin-bottom:18px}h1{margin:0;font-size:23px;line-height:1.05;letter-spacing:-.9px}.headline{margin:10px 0 16px;color:#1e3a8a;font-size:14px;font-weight:800}.contact{display:grid;gap:7px;color:#5b6472;font-size:11px;overflow-wrap:anywhere}h2{margin:16px 0 7px;color:#1e3a8a;font-size:11px;letter-spacing:.12em;text-transform:uppercase;border-bottom:1px solid #dbe4ee;padding-bottom:7px}.summary{padding:10px 12px;border-left:4px solid #2563eb;background:#f8fbff;border-radius:14px;font-size:13px}.chip{display:inline-block;margin:3px 4px 3px 0;padding:5px 8px;border:1px solid #dbe4ee;border-radius:999px;font-size:10px;font-weight:700}.item{margin-top:12px;break-inside:avoid}.item-head{display:flex;justify-content:space-between;gap:18px}.item-head p{margin:2px 0 0;color:#5b6472;font-size:11px}h3{margin:0;font-size:11.4px}li{font-size:10.4px;margin-bottom:3px}@media print{body{background:#fff}.page{box-shadow:none;margin:0;page-break-after:avoid}@page{size:A4;margin:0}}</style></head><body><div class="page">
    <aside><div class="bar"></div><h1>${escapeHtml(data.profile.basics.name)}</h1><div class="headline">${escapeHtml(data.basics.headline)}</div><div class="contact">${[data.profile.basics.phone, data.profile.basics.email, data.profile.basics.location, data.profile.basics.linkedin].filter(Boolean).map((v) => `<div>${escapeHtml(v)}</div>`).join("")}</div>
      <h2>Skills</h2><div>${cleanSkillsForDisplay(data.skills).slice(0, 24).map((s) => `<span class="chip">${escapeHtml(s)}</span>`).join("")}</div>
      ${data.languages.length ? `<h2>Languages</h2><p>${escapeHtml(data.languages.join(" | "))}</p>` : ""}
      ${data.strengths.length ? `<h2>Strengths</h2><ul>${renderList(data.strengths.slice(0, 6))}</ul>` : ""}
    </aside>
    <main><section><h2>Professional Summary</h2><p class="summary">${escapeHtml(data.summary)}</p></section>
    ${data.experience.length ? `<section><h2>Professional Experience</h2>${renderExperience(data.experience)}</section>` : ""}
    ${data.projects.length ? `<section><h2>Projects</h2>${data.projects.map((p) => `<div class="item"><h3>${escapeHtml(p.name)}</h3><ul>${renderList(p.bullets.slice(0, 3))}</ul></div>`).join("")}</section>` : ""}
    ${data.education.length ? `<section><h2>Education</h2><ul>${renderList(data.education.map((e) => [e.degree, e.institution, e.dates].filter(Boolean).join(" | ")))}</ul></section>` : ""}
    </main></div></body></html>`;
}

function renderCareerSwitcher(data: ResumeJson) {
  return renderModern(data);
}

export function generateResumeHtml(input: CvGenerationInput) {
  const data = buildResumeJson(input);
  if (data.style === "career_switcher") return renderCareerSwitcher(data);
  if (data.style === "ats_clean") return renderAts(data);
  return renderModern(data);
}

export function downloadHtmlFile(filename: string, html: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".html") ? filename : `${filename}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function printResumeHtml(html: string) {
  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
}

export function createSimplePdfBlob(title: string, content?: string) {
  return new Blob([content || title || ""], { type: "text/plain;charset=utf-8" });
}

export function downloadTextPdf(filename: string, title: string, content: string) {
  const blob = createSimplePdfBlob(title, content);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.replace(/\.pdf$/i, ".txt");
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadBlob(filename: string, bytes: Uint8Array | string, mime: string) {
  const blob = typeof bytes === "string" ? new Blob([bytes], { type: mime }) : new Blob([new Uint8Array(bytes)], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function getCvTemplateNames() {
  return [
    { id: "ats", name: "ATS Clean" },
    { id: "modern", name: "Modern Professional" },
    { id: "career_switcher", name: "Career Switcher" },
  ] as const;
}
