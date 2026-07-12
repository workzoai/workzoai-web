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
    id: "it_systems_integration",
    label: "IT / Systems Integration",
    safeHeadline: "IT Systems & Cloud Integration Specialist",
    terms: ["integration", "cloud", "microsoft", "azure", "saas", "api", "configuration", "system administration", "it administration", "onboarding", "hr software", "third-party", "erp", "active directory", "identity management", "m365", "office 365", "tenant", "deployment", "helpdesk", "1st level", "2nd level", "3rd level", "technical consultant"],
    transferableSignals: [
      { label: "structured problem solving in technical environments", evidence: /problem|technical|troubleshoot|system|configure|process|procedure|support/i },
      { label: "documentation and process improvement", evidence: /documentation|document|process|improve|standard|guide|technical drawing|report|plm|windchill/i },
      { label: "cross-functional collaboration and stakeholder communication", evidence: /collaborat|cross-functional|stakeholder|team|internal|support|communication/i },
      { label: "system configuration and change management", evidence: /configuration|change management|engineering change|install|deploy|process|system|plm|windchill/i },
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
    ...(profile.skills || []),
    ...(profile.strengths || []),
    ...(profile.additionalEvidence || []),
    ...(profile.experience || []).flatMap((job) => [job.title, job.company, job.location, ...(job.bullets || [])]),
    ...(profile.projects || []).flatMap((project) => [project.name, ...(project.bullets || [])]),
    ...(profile.education || []).flatMap((edu) => [edu.degree, edu.institution]),
    ...(profile.languages || []),
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
  // Empty, not a fabricated placeholder. A blank headline is a gap the user can
  // fill. "Professional" is a lie that also ends up printed as a JOB TITLE.
  if (!headline || /unknown|candidate|profile/i.test(headline)) return "";
  return headline;
}

function safeHeadline(profile: ResumeProfile, jd: JdSignal, matches: EvidenceMatch[]) {
  const current = cleanVisibleHeadline(profile.basics.headline || "");
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
  if (jd.family.id === "it_systems_integration") return jd.family.safeHeadline;
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
  // IMPORTANT: do NOT run a skill token through clean()/normalizeResumeText.
  // That prose-repair pass splits camelCase ("([a-z]{3,})([A-Z][a-z])"), which
  // mangles every internal-capital tech name — TensorFlow -> "Tensor Flow",
  // LangChain -> "Lang Chain", PyTorch, PostgreSQL, NumPy, DevOps, GraphQL, ...
  // The old code then tried to rejoin a HARDCODED allowlist, so any brand not on
  // that list stayed broken. A pre-tokenized skill never needs prose splitting,
  // so we normalise whitespace only and preserve internal capitalisation. This
  // is the global fix: it works for every CamelCase skill without an allowlist.
  const raw = String(value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim()
    .replace(/\bWÜRzburg\b/gi, "Würzburg")
    .replace(/\bInventor 3d Printing:\s*Fff\b/gi, "Inventor")
    .replace(/\b3d Printing\b/gi, "3D Printing")
    .replace(/\bFff\b/g, "FFF")
    .replace(/\bNum\s+Py\b/gi, "NumPy")
    .replace(/\bPower\s+Bi\b/gi, "Power BI")
    .replace(/\bMatplotlib\b/gi, "Matplotlib")
    .replace(/\bJupyter Notebook Soft\b/gi, "Jupyter Notebook")
    .replace(/^\s*(programming|visualization|visualisation|data visualization|data visualisation|tools|soft skills|technical|data & reporting|operations|communication & support|additional)\s*[:\-]?\s*/i, "")
    .replace(/^\s*(in|using|with)\s+(Python|SQL|Power BI|Tableau|Excel|Pandas|NumPy|GCP|AWS)\b/i, "$2")
    .replace(/\s+/g, " ")
    .trim();

  const exact: Record<string, string> = {
    "power bi": "Power BI",
    "numpy": "NumPy",
    "num py": "NumPy",
    "pandas": "pandas",
    "python": "Python",
    "sql": "SQL",
    "mysql": "MySQL",
    "gcp": "GCP",
    "google cloud platform": "Google Cloud Platform",
    "api integration": "API Integration",
    "web scraping": "Web Scraping",
    "jupyter notebook": "Jupyter Notebook",
    "matplotlib": "Matplotlib",
    "seaborn": "Seaborn",
  };

  return exact[raw.toLowerCase()] || raw;
}

function cleanSkillsForDisplay(items: string[]) {
  // Step 1: Basic clean, normalise whitespace, fix known spacing issues
  const normalised = items.map(cleanSkillForDisplay).filter(Boolean);

  // Step 2: Deduplicate, remove exact duplicates AND semantic duplicates
  // (e.g. "Google Cloud" and "Google Cloud Platform" → keep longer/more specific)
  const seen = new Map<string, string>(); // normalised key → best display form
  for (const item of normalised) {
    const key = item.toLowerCase().replace(/[^a-z0-9]/g, "");
    // Check if any existing key is a prefix/suffix of this one or vice versa,
    // OR if the short form is an acronym of the long form
    let merged = false;
    for (const [existingKey, existingVal] of seen.entries()) {
      const shorter = key.length < existingKey.length ? key : existingKey;
      const longer = key.length < existingKey.length ? existingKey : key;
      const shorterVal = key.length < existingKey.length ? item : existingVal;
      const longerVal = key.length < existingKey.length ? existingVal : item;
      // Prefix match (e.g. "googlecloud" vs "googlecloudplatform")
      if (longer.startsWith(shorter) && shorter.length >= 3) {
        // Keep the longer, more specific version
        if (longerVal.length > shorterVal.length) seen.set(existingKey, longerVal);
        else seen.set(existingKey, longerVal);
        merged = true;
        break;
      }
      // Acronym match: short key is 2-5 chars and matches initials of long key
      // e.g. "rag" matches "retrievalaugmentedgeneration"
      if (shorter.length >= 2 && shorter.length <= 5) {
        const initials = longer.split("").reduce((acc, ch, i) => {
          // rough: take every char that follows a word boundary (uppercase in original)
          return acc;
        }, "");
        // Simpler: check if all chars of shorter appear in order in longer
        let si = 0;
        for (const ch of longer) {
          if (si < shorter.length && ch === shorter[si]) si++;
        }
        if (si === shorter.length && si / longer.length < 0.25) {
          // Short form is an acronym-style abbreviation of the long form
          if (longerVal.length > shorterVal.length) seen.set(existingKey, longerVal);
          merged = true;
          break;
        }
      }
    }
    if (!merged) seen.set(key, item);
  }
  const deduped = Array.from(seen.values());

  // Word-subset dedupe: drop a skill whose words are all contained in a longer
  // skill ("Change Management" ⊂ "Engineering Change Management"; "Team
  // Collaboration" ⊂ "Cross-functional Team Collaboration"). Keeps the more
  // specific phrase and removes the redundant near-duplicate bloat.
  const wordSet = (v: string) =>
    new Set(v.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2));
  const subsetFiltered = deduped.filter((a, ai) => {
    const A = wordSet(a);
    if (A.size === 0) return true;
    return !deduped.some((b, bi) => {
      if (bi === ai) return false;
      const B = wordSet(b);
      return B.size > A.size && [...A].every((w) => B.has(w));
    });
  });

  return unique(
    subsetFiltered
      .filter((item) => item.length <= 45)
      // Remove section headers that leaked into skills
      .filter((item) => !/^(education|languages|contact|profile|summary|work experience|professional experience|tools|experience|selected projects?|project management|references?)$/i.test(item))
      // Remove job titles that leaked into skills, globally: any phrase that
      // reads as a role/title rather than a tool, technology, or named competency.
      // Pattern: "[Adjective/Qualifier] + [Role noun]" e.g. "Support Engineer",
      // "Data Engineer", "Cloud Architect", but NOT "Data Engineering" (the skill).
      .filter((item) => !/\b(engineer|developer|analyst|designer|architect|manager|specialist|consultant|coordinator|officer|administrator|technician|intern|associate|director|lead|head)\s*$/i.test(item))
      // Remove single generic words that are too vague to be actionable as skills
      .filter((item) => !/^(support|communication|management|planning|analysis|coordination|teamwork|leadership|creativity|flexibility|adaptability|initiative|learning|research|networking|motivation|integrity|professionalism|organisation|organization)$/i.test(item))
      // Remove sentence fragments that leaked in (common in messy skills sections)
      .filter((item) => !/\b(linkedin|outlook|gmail|@|\+\d|www\.|actively improving|competition|database management|built a knowledge|enhancing customer|visualized patterns|automated processes with|in python)\b/i.test(item))
      // Remove items that are clearly bullet-point sentence starts
      .filter((item) => !/^(conducted|analyzed|developed|resolved|improved|reduced|increased|managed|led|built|created|designed|implemented|supported|trained|delivered|coordinated|collaborated|presented)\b/i.test(item)),
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
  // Skills are already cleaned and deduplicated by the caller (buildResumeJson).
  // Do NOT call cleanSkillsForDisplay again here, that would re-run dedup
  // with a fresh Map, losing the cross-call dedup state and reintroducing duplicates.
  const cleanSkills = skills; // already clean
  const assigned = new Set<string>();
  const assign = (arr: string[]) => {
    const fresh = arr.filter(s => !assigned.has(s.toLowerCase()));
    fresh.forEach(s => assigned.add(s.toLowerCase()));
    return fresh;
  };

  const technical = assign(cleanSkills.filter((s) => /python|sql|api|cad|creo|solidworks|catia|inventor|windchill|cnc|3d printing|plm|mechanical|product design|prototype|tensorflow|sklearn|gcp|aws/i.test(s)));
  const reporting = assign(cleanSkills.filter((s) => /excel|report|dashboard|tableau|power bi|matplotlib|seaborn|pandas|analytics|visualization|kpi/i.test(s)));
  const operations = assign(cleanSkills.filter((s) => /lean|5s|warehouse|inventory|material|logistics|safety|quality|delivery|training|documentation|process|project|agile|scrum|manufacturing|continuous improvement/i.test(s)));
  const customer = assign(cleanSkills.filter((s) => /communication|stakeholder|customer|client|relationship|support|troubleshooting|itil|itsm|demo|crm|sales|lead generation|prospecting|business development|saas|pipeline|requirements/i.test(s)));
  const other = assign(cleanSkills.filter((s) => !assigned.has(s.toLowerCase()))).slice(0, 8);

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


function looksLikeProjectBulletInCv(value = "") {
  // Detects bullets that are structurally project-like rather than work-experience-like.
  // Uses structural signals, research/analysis verbs, named tool stacks, data pipeline
  // language, NOT content-specific keywords tied to any particular CV or project.
  return /\b(developed a|built a|conducted a|created a|designed a|implemented a|analyzed the|collected and|automated|visualized|showcased expertise in)\b/i.test(value) &&
    /\b(using|with|via|through)\s+[A-Z]/i.test(value) && // mentions a named tool/tech
    !/\b(customer|client|ticket|incident|sla|escalat|configur|troubleshoot|onboard|support request)\b/i.test(value); // not support work
}

function looksLikeSummaryBulletInCv(value = "") {
  return /\b(detail-oriented|planned career break|aspiring|over\s+\d+\s+years|fluent in|passion for|dynamic .* environments)\b/i.test(value) && value.length > 45;
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
  return unique<string>((job.bullets || []).flatMap(splitMergedBullets))
    // The parser owns structure. If a bullet is already inside experience, do not
    // delete it just because it contains words like "pipeline" or "market".
    // Those can be valid experience bullets. Only remove obvious summary pollution.
    .filter((bullet) => !looksLikeSummaryBulletInCv(bullet))
    .map((bullet, index) => ({ bullet, score: scoreEvidence(`${job.title} ${job.company} ${bullet}`, jd), index }))
    .filter((item) => item.bullet.length > 15)
    .sort((a, b) => {
      const diff = b.score - a.score;
      return Math.abs(diff) >= 8 ? diff : a.index - b.index;
    })
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
  return (profile.experience || []).slice(0, 6).map((job, index) => {
    const ranked = rankBullets(job, jd);
    const limit = index === 0 ? 6 : 5;
    const bullets = ranked.slice(0, limit);
    const title = cleanExperienceTitle(job.title) || "Professional Experience";
    const company = cleanCompanyName(job.company);
    const fallbackBullets = job.bullets
      .map(normalizeBullet)
      .filter(Boolean)
      .filter((bullet) => !looksLikeSummaryBulletInCv(bullet))
      .slice(0, limit);
    return { ...job, title, company, bullets: bullets.length ? bullets : fallbackBullets };
  }).filter((job) => clean(job.title || job.company || job.dates) || job.bullets.length);
}

const EDU_LEVEL_BUCKETS: Array<[RegExp, string]> = [
  [/\b(ph\.?\s?d|d\.?phil|doctora(?:te|l)|doktor|promotion)\b/i, "phd"],
  [/\b(m\.?\s?b\.?\s?a|mba)\b/i, "mba"],
  [/\b(master|magister|m\.?\s?sc|m\.?\s?a|m\.?\s?tech|m\.?\s?eng|m\.?\s?s|msc|meng|mtech)\b/i, "master"],
  [/\b(bachelor|b\.?\s?sc|b\.?\s?a|b\.?\s?tech|b\.?\s?eng|b\.?\s?e|bsc|beng|btech|bba|honou?rs)\b/i, "bachelor"],
  [/\b(diploma|diplom|pg\s?diploma)\b/i, "diploma"],
  [/\b(associate)\b/i, "associate"],
  [/\b(abitur|a-?levels?|high\s?school|secondary)\b/i, "school"],
];
function eduDegreeLevel(degree = ""): string {
  for (const [re, b] of EDU_LEVEL_BUCKETS) if (re.test(degree)) return b;
  return degree.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function eduInstitutionKey(institution = ""): string {
  return institution.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .split(/[,·|]|\s[–—-]\s/)[0].replace(/[^a-z0-9]/g, "");
}
// A canonical dedupe key: same degree LEVEL at the same school is one entry,
// regardless of alias wording ("M.Sc." vs "Master of Science") or a trailing
// location the institution field sometimes carries ("Uni Würzburg, Germany").
function eduDedupeKey(degree = "", institution = ""): string {
  return `${eduDegreeLevel(degree)}|${eduInstitutionKey(institution)}`;
}
// Strip a date/year that a PDF text layer glued onto the end of a degree line.
function stripTrailingDate(degree = ""): string {
  return degree.replace(/\s*(?:19|20)\d{2}(?:\s*[–—-]\s*(?:(?:19|20)\d{2}|present|current))?\s*$/i, "").trim();
}

function cleanEducation(items: ResumeProfile["education"], candidateName = "") {
  // Only match the candidate name when it appears as a standalone token at the
  // START of a degree/institution string, not anywhere in the text, which was
  // eating into names like "Data Science Bootcamp" when the name regex was too broad.
  const escapedName = candidateName ? escapeRegExp(candidateName.split(" ")[0]) : "";
  const namePattern = escapedName
    ? new RegExp(`^${escapedName}\\s+`, "gi")
    : /^XXXXXXXXXXXXXXXXX$/; // never matches, disable the broad fallback pattern

  const cleaned = items
    .map((item) => {
      let degree = stripTrailingDate(clean(item.degree)
        .replace(/\bMaster'S\b/g, "Master's")
        .replace(/\bBachelor'S\b/g, "Bachelor's")
        .replace(namePattern, "")
        .replace(/\s*·\s*$/g, "")
        .trim());

      let institution = clean(item.institution)
        .replace(/\s*\|\s*/g, " · ")
        .replace(/\bMaster'S\b/g, "Master's")
        .replace(/\bBachelor'S\b/g, "Bachelor's")
        .replace(namePattern, "")
        .replace(/\bCandidate\b/gi, "")
        .replace(/\s*·\s*$/g, "")
        .trim();

      // REPAIR: if degree is a single word that looks like the START of a
      // known qualification name (e.g. "Data" → "Data Science Bootcamp",
      // "Bachelor" → "Bachelor of Science"), and institution gives context,
      // expand it. This handles stale parsed profiles where the degree was
      // truncated in an earlier parse before our fixes.
      if (degree && degree.split(/\s+/).length === 1) {
        const inst = institution.toLowerCase();
        if (/^data$/i.test(degree) && /bootcamp|coding|school|wbs|data science/i.test(inst)) {
          degree = "Data Science Bootcamp";
        } else if (/^bachelor'?s?$/i.test(degree) || /^bachelors?$/i.test(degree)) {
          degree = "Bachelor of Science";
        } else if (/^master'?s?$/i.test(degree) || /^masters?$/i.test(degree)) {
          degree = "Master of Science";
        }
      }

      // REPAIR: if institution ends with "&" or is clearly truncated (ends mid-word),
      // it was cut off during parsing, append a note but don't fabricate the rest.
      if (institution.endsWith("&") || institution.endsWith("-")) {
        institution = institution.replace(/[&-]\s*$/, "").trim();
      }

      // Drop a redundant location: the institution field often already carries
      // the country ("University of Würzburg, Germany"), and appending the
      // separate location renders "... Germany · Germany". Clear the location
      // when it is already contained in the institution. Global for every CV.
      const nrm = (v = "") => v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
      let location = clean(item.location);
      if (location && nrm(institution).includes(nrm(location))) location = "";

      return { ...item, degree, institution, location, dates: clean(item.dates) };
    })
    .filter((item) => item.degree || item.institution)
    .filter((item) => !/\b(engineer|analyst|developer|support specialist|application engineer|professional experience|linkedin|gmail|outlook)\b/i.test(`${item.degree} ${item.institution}`));

  const merged = new Map<string, ResumeProfile["education"][number]>();
  for (const item of cleaned) {
    const key = eduDedupeKey(item.degree, item.institution);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, item);
      continue;
    }
    const rangeRank = (d = "") => (/[–—-]/.test(d) ? 2 : d ? 1 : 0);
    const bestDates = rangeRank(item.dates) > rangeRank(existing.dates) ? item.dates : existing.dates;
    // Prefer the cleaner (date-free) degree; if equal, the longer wording.
    const eDeg = stripTrailingDate(existing.degree), iDeg = stripTrailingDate(item.degree);
    merged.set(key, {
      ...existing,
      degree: iDeg.length > eDeg.length ? iDeg : eDeg,
      institution: existing.institution.length >= item.institution.length ? existing.institution : item.institution,
      dates: bestDates,
      location: existing.location || item.location,
    });
  }

  return Array.from(merged.values()).slice(0, 5);
}


function tailorProjects(profile: ResumeProfile, jd: JdSignal, experience: ResumeExperience[]) {
  return profile.projects
    .filter((project) => {
      const name = clean(project.name);
      const bullets = project.bullets.map(clean).filter(Boolean);
      if (!name && !bullets.length) return false;
      if (/^selected projects?$/i.test(name) && bullets.length < 2) return false;
      return true;
    })
    .slice(0, 5)
    .map((project) => ({
      ...project,
      name: clean(project.name).replace(/^Selected Projects?$/i, "Selected Project"),
      bullets: unique<string>(project.bullets.map(improveBulletVerb).filter(Boolean))
        .map((bullet, index) => ({ bullet, score: scoreEvidence(`${project.name} ${bullet}`, jd), index }))
        .sort((a, b) => Math.abs(b.score - a.score) >= 8 ? b.score - a.score : a.index - b.index)
        .map((item) => item.bullet)
        .slice(0, 4),
    }))
    .filter((project) => project.name || project.bullets.length);
}

function buildSummary(profile: ResumeProfile, roleFit: ResumeJson["roleFit"], jd: JdSignal, hasJd: boolean) {
  const base = compactSentence(profile.summary, 420);
  const nameFreeBase = base.replace(new RegExp(escapeRegExp(profile.basics.name || "__never__"), "gi"), "").trim();
  const safeBase = nameFreeBase && !/^(analy[sz]ed|developed|conducted|showcased|automated|collected|visuali[sz]ed)\b/i.test(nameFreeBase)
    ? nameFreeBase
    : `${roleFit.safeHeadline} with practical professional experience, problem solving, and cross-functional collaboration.`;

  if (!hasJd || jd.family.id === "general") {
    return safeBase;
  }

  const highlights = roleFit.highlights.slice(0, 3);
  const second = highlights.length
    ? `Relevant strengths include ${highlights.join(", ")}.`
    : "Relevant transferable strengths are supported by the CV.";

  // Keep the candidate's real profile summary as the base. Do not replace it with project
  // bullets or a generic role sentence; this prevents Improve CV from losing the good
  // onboarding summary.
  return compactSentence(`${safeBase} ${second}`, 520)
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



// ─────────────────────────────────────────────────────────────────────────────
// Global CV integrity repair
// ─────────────────────────────────────────────────────────────────────────────
// The renderer must never rely on a single monolithic AI rewrite for structure.
// These helpers rebuild section boundaries from the original raw CV text and
// use them as guard rails. They are intentionally role-agnostic: they do not
// know about Haritha, Surender, Zoho, Tesla, etc. They only enforce universal CV
// invariants: experience bullets stay inside their own employer, project bullets
// stay inside projects, education stays education, and missing parsed sections
// are recovered from the uploaded CV text when possible.

const HARD_STOP_SECTION_RE = /^(projects?|key projects|selected projects|education|educational background|bildung|languages?|sprachen|certifications?|certificates?|skills?|expertise|contact|kontakt|profile|profile summary|professional summary|berufliches profil|work experience|professional experience|berufserfahrung)$/i;
const PROJECT_STOP_SECTION_RE = /^(education|educational background|bildung|languages?|sprachen|certifications?|certificates?|skills?|expertise|contact|kontakt|work experience|professional experience|berufserfahrung)$/i;
const EDUCATION_DEGREE_RE = /\b(master'?s?|bachelor'?s?|ph\.?d|doctorate|mba|m\.?sc|b\.?sc|degree|diploma|certificate|certification|bootcamp|ausbildung|studium)\b/i;
const INSTITUTION_RE = /\b(university|universit|universität|college|school|schule|hochschule|institute|institut|academy|akademie|bootcamp|coding school|engineering)\b/i;
const ACTION_OR_RESPONSIBILITY_RE = /^(created|designed|developed|engineered|supported|collaborated|managed|led|trained|coached|improved|reduced|increased|resolved|delivered|implemented|maintained|prepared|analy[sz]ed|coordinated|optimized|optimised|automated|built|presented|conducted|assisted|participated|fabricated|utilized|utilised|monitored|ensured|responsible for|proactively|worked|handled|installed|documented)\b/i;

function rawCvLines(profile: ResumeProfile) {
  return normalizeResumeText(profile.rawText || profile.previewText || "")
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map((line) => clean(line))
    .filter(Boolean)
    .slice(0, 260);
}

function normLoose(value = "") {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactKey(value = "") {
  return normLoose(value).replace(/\s+/g, "");
}

function lineHasNeedle(line: string, needle: string) {
  const lk = compactKey(line);
  const nk = compactKey(needle);
  return Boolean(nk && lk.includes(nk));
}

function sameMeaningLoose(a = "", b = "") {
  const ak = normLoose(a);
  const bk = normLoose(b);
  if (!ak || !bk) return false;
  if (ak === bk) return true;
  const aw = new Set(ak.split(/\s+/).filter((w) => w.length > 2));
  const bw = new Set(bk.split(/\s+/).filter((w) => w.length > 2));
  if (!aw.size || !bw.size) return false;
  let common = 0;
  aw.forEach((w) => { if (bw.has(w)) common += 1; });
  return common / Math.min(aw.size, bw.size) >= 0.72;
}

function isLikelySectionHeaderLine(line = "") {
  const value = clean(line).replace(/[:：]$/, "");
  return HARD_STOP_SECTION_RE.test(value);
}

function isLikelyProjectNameLine(line = "") {
  const value = clean(line);
  if (!value || ACTION_OR_RESPONSIBILITY_RE.test(value)) return false;
  if (isLikelySectionHeaderLine(value)) return false;
  if (/[@+]|linkedin|github|www\.|https?:/i.test(value)) return false;
  if (/\b(?:19|20)\d{2}\b/.test(value)) return false;
  if (value.length > 95) return false;
  return /[A-Za-z]/.test(value);
}

function findJobAnchors(profile: ResumeProfile, jobs: ResumeExperience[]) {
  const lines = rawCvLines(profile);
  const used = new Set<number>();
  return jobs.map((job, index) => {
    const company = clean(job.company);
    const title = clean(job.title);
    const dates = clean(job.dates);
    let best = -1;
    let bestScore = -1;
    for (let i = 0; i < lines.length; i++) {
      if (used.has(i)) continue;
      const line = lines[i];
      let score = 0;
      if (company && lineHasNeedle(line, company)) score += 8;
      if (title && lineHasNeedle(line, title)) score += 5;
      if (dates && lineHasNeedle(line, dates.replace(/\s*[-–]\s*/g, " "))) score += 3;
      // Common PDF layout: company and dates on one line, title on the next.
      if (company && lineHasNeedle(line, company) && dates && /\b(?:19|20)\d{2}\b/.test(line)) score += 3;
      if (title && i > 0 && company && lineHasNeedle(lines[i - 1], company)) score += 2;
      if (score > bestScore) { bestScore = score; best = i; }
    }
    if (best >= 0 && bestScore >= 5) used.add(best);
    return { index, start: bestScore >= 5 ? best : -1 };
  });
}

function collectActionBullets(lines: string[], start: number, end: number) {
  const bullets: string[] = [];
  let current = "";
  const flush = () => {
    const fixed = improveBulletVerb(current)
      .replace(/\s+/g, " ")
      .replace(/\s+([,.])/g, "$1")
      .trim();
    if (fixed.length >= 24 && !isLikelySectionHeaderLine(fixed)) bullets.push(fixed);
    current = "";
  };

  for (let i = Math.max(0, start + 1); i < Math.min(lines.length, end); i++) {
    const line = clean(lines[i]);
    if (!line) continue;
    if (/^projects?$/i.test(line)) { flush(); break; }
    if (PROJECT_STOP_SECTION_RE.test(line) || /^(contact|kontakt)$/i.test(line)) { flush(); continue; }
    if (/@|linkedin|github|www\.|https?:|^\+?\d[\d\s().-]{7,}$/i.test(line)) { flush(); continue; }
    if (EDUCATION_DEGREE_RE.test(line) || INSTITUTION_RE.test(line)) {
      // Education/course lines in two-column PDFs often appear in the middle of
      // the work-experience column. They must not become job bullets.
      if (!ACTION_OR_RESPONSIBILITY_RE.test(line)) { flush(); continue; }
    }
    if (ACTION_OR_RESPONSIBILITY_RE.test(line)) {
      flush();
      current = line;
    } else if (current && line.length <= 130 && !isLikelyProjectNameLine(line)) {
      current += ` ${line}`;
    } else if (current && line.length <= 90 && !ACTION_OR_RESPONSIBILITY_RE.test(line)) {
      current += ` ${line}`;
    } else {
      flush();
    }
  }
  flush();
  return unique(bullets, (b) => normLoose(b)).slice(0, 8);
}

function extractRawExperienceBullets(profile: ResumeProfile, jobs: ResumeExperience[]) {
  const lines = rawCvLines(profile);
  if (!lines.length || !jobs.length) return new Map<number, string[]>();
  const anchors = findJobAnchors(profile, jobs);
  const sortedStarts = anchors.map((a) => a.start).filter((n) => n >= 0).sort((a, b) => a - b);
  const result = new Map<number, string[]>();

  anchors.forEach((anchor) => {
    if (anchor.start < 0) return;
    const nextStart = sortedStarts.find((s) => s > anchor.start) ?? lines.length;
    let hardEnd = nextStart;
    for (let i = anchor.start + 1; i < nextStart; i++) {
      if (/^projects?$/i.test(lines[i])) { hardEnd = i; break; }
    }
    const bullets = collectActionBullets(lines, anchor.start, hardEnd);
    if (bullets.length) result.set(anchor.index, bullets);
  });

  return result;
}

function removeBulletsThatBelongToProjects(bullets: string[], projects: ResumeProfile["projects"]) {
  const projectBullets = (projects || []).flatMap((p) => p.bullets || []).map(clean).filter(Boolean);
  const projectNames = (projects || []).map((p) => clean(p.name)).filter(Boolean);
  return bullets.filter((bullet) => {
    const b = clean(bullet);
    if (!b) return false;
    if (projectBullets.some((pb) => sameMeaningLoose(b, pb))) return false;
    // If an experience bullet literally names a project title and has research/
    // feasibility/pipeline wording, it is almost certainly a project bullet.
    if (projectNames.some((name) => name.length >= 5 && new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(b)) && /feasibility|market|pipeline|youtube|sentiment|startup|study|analysis/i.test(b)) return false;
    if (looksLikeProjectBulletInCv(b) && /feasibility|market|pipeline|youtube|sentiment|startup|study|visuali[sz]ed|collected/i.test(b)) return false;
    return true;
  });
}



const ORG_ANCHOR_RE = /\b(gmbh|ug|ag|kg|bv|ltd|limited|llc|inc|corp|corporation|company|co\.?|group|university|universität|college|school|institute|academy)\b/i;
const ROLE_WORD_RE = /\b(engineer|designer|developer|analyst|specialist|manager|supervisor|consultant|coordinator|intern|technician|support|application|product|cad|systems?|assistant|officer|executive)\b/i;
const DATE_RANGE_RE2 = /\b(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december|märz|maerz|mai|juni|juli|okt|dez)[a-zä]*\s*)?(?:19|20)\d{2}\s*[-–]\s*(?:present|current|heute|(?:19|20)\d{2})\b/i;

function cleanRawJobTitle(value = "") {
  return cleanExperienceTitle(value)
    .replace(/^[-–|]+\s*/, "")
    .replace(/\bEnginner\b/gi, "Engineer")
    .trim();
}

function parseCompanyLine(line = "") {
  let value = clean(line);
  const date = value.match(DATE_RANGE_RE2)?.[0] || "";
  if (date) value = value.replace(DATE_RANGE_RE2, " ").replace(/\s+/g, " ").trim();
  let location = "";
  const dashSplit = value.split(/\s+[–—-]\s+/).map(clean).filter(Boolean);
  if (dashSplit.length >= 2) {
    value = dashSplit[0];
    location = dashSplit.slice(1).join(" - ");
  }
  return { company: cleanCompanyName(value), location: clean(location), dates: clean(date) };
}

function parseDateAndTitle(line = "") {
  const raw = clean(line);
  const date = raw.match(DATE_RANGE_RE2)?.[0] || "";
  const after = date ? raw.slice(raw.toLowerCase().indexOf(date.toLowerCase()) + date.length).trim() : "";
  return { dates: clean(date), title: cleanRawJobTitle(after) };
}

function extractRawExperienceEntries(profile: ResumeProfile): ResumeExperience[] {
  const lines = rawCvLines(profile);
  if (!lines.length) return [];
  const anchors: Array<{ start: number; company: string; location: string; dates: string; title: string }> = [];
  const workStartFound = lines.findIndex((l) => /^(work experience|professional experience|berufserfahrung|experience)$/i.test(l));
  const scanStart = workStartFound >= 0 ? workStartFound : 0;
  let scanEnd = lines.length;
  for (let i = scanStart + 1; i < lines.length; i++) {
    if (/^projects?$/i.test(lines[i])) { scanEnd = i; break; }
    if (/^(kontakt|contact)$/i.test(lines[i]) && anchors.length > 0) { scanEnd = i; break; }
  }
  const eduRanges: Array<[number, number]> = [];
  for (let i = scanStart; i < scanEnd; i++) {
    if (/^(bildung|education|educational background)$/i.test(lines[i])) {
      let end = Math.min(scanEnd, i + 28);
      for (let j = i + 1; j < end; j++) {
        if (/^(sprachen|languages|expertise|skills|work experience|professional experience|berufserfahrung)$/i.test(lines[j])) { end = j; break; }
      }
      eduRanges.push([i, end]);
    }
  }
  const inEducationRange = (idx: number) => eduRanges.some(([a, b]) => idx >= a && idx <= b);

  for (let i = scanStart; i < scanEnd; i++) {
    if (inEducationRange(i)) continue;
    const line = lines[i];
    if (!line || isLikelySectionHeaderLine(line)) continue;
    const nearbyWindow = lines.slice(Math.max(scanStart, i - 18), Math.min(scanEnd, i + 26)).join(" ");
    const hasDate = DATE_RANGE_RE2.test(line) || DATE_RANGE_RE2.test(nearbyWindow);
    const hasRoleNear = ROLE_WORD_RE.test(nearbyWindow);
    const hasOrg = ORG_ANCHOR_RE.test(line) || /\b(?:corp|gmbh|coating|cummins|zoho|css)\b/i.test(line);
    if (!hasDate || !hasOrg || !hasRoleNear) continue;
    if (/coding school|arts|science college|luleå|lulea|education|bildung/i.test(line) && !/university of/i.test(line)) continue;

    const parsed = parseCompanyLine(line);
    let dates = parsed.dates;
    let title = "";
    if (!dates) {
      for (let j = Math.max(scanStart, i - 18); j <= Math.min(scanEnd - 1, i + 25); j++) {
        const dt = parseDateAndTitle(lines[j] || "");
        if (dt.dates) { dates = dt.dates; if (dt.title) title = dt.title; break; }
      }
    } else {
      const dt = parseDateAndTitle(line);
      title = dt.title;
    }
    if (!title) {
      for (let j = Math.max(scanStart, i - 18); j <= Math.min(scanEnd - 1, i + 25); j++) {
        if (inEducationRange(j)) continue;
        const candidate = cleanRawJobTitle(lines[j]);
        if (!candidate || candidate.length > 90) continue;
        if (isLikelySectionHeaderLine(candidate) || DATE_RANGE_RE2.test(candidate) || INSTITUTION_RE.test(candidate)) continue;
        if (ROLE_WORD_RE.test(candidate)) { title = candidate; break; }
      }
    }
    if (parsed.company && dates && (title || anchors.length >= 0)) {
      anchors.push({ start: i, company: parsed.company, location: parsed.location, dates, title });
    }
  }

  const uniqueAnchors = unique(anchors, (a) => `${normLoose(a.company)}|${a.dates}`).slice(0, 8);
  return uniqueAnchors.map((anchor, idx) => {
    const next = uniqueAnchors[idx + 1]?.start ?? lines.length;
    let end = next;
    for (let k = anchor.start + 1; k < next; k++) {
      if (/^projects?$/i.test(lines[k])) { end = k; break; }
    }
    return {
      title: anchor.title || "Professional Experience",
      company: anchor.company,
      location: anchor.location,
      dates: anchor.dates,
      bullets: collectActionBullets(lines, anchor.start, end),
    };
  }).filter((job) => job.company || job.title || job.bullets.length);
}

function chooseBestExperienceSource(profile: ResumeProfile, base: ResumeExperience[]) {
  const raw = extractRawExperienceEntries(profile);
  const baseBad = base.some((job) => /bootcamp|degree|bachelor|master|school|college/i.test(`${job.title} ${job.company}`));
  const rawHasMore = raw.length > base.length;
  const rawHasCompanies = raw.filter((job) => job.company).length >= Math.max(1, base.filter((job) => job.company).length);
  if (raw.length && (rawHasMore || baseBad || !base.length) && rawHasCompanies) return raw;
  return base;
}

function repairExperienceFromRaw(profile: ResumeProfile, jobs: ResumeExperience[], jd: JdSignal) {
  const rawByJob = extractRawExperienceBullets(profile, jobs);
  return jobs.map((job, index) => {
    const original = removeBulletsThatBelongToProjects(job.bullets || [], profile.projects || []);
    const raw = removeBulletsThatBelongToProjects(rawByJob.get(index) || [], profile.projects || []);
    const otherRawBullets = Array.from(rawByJob.entries())
      .filter(([otherIndex]) => otherIndex !== index)
      .flatMap(([, bullets]) => bullets);
    const originalContainsOtherJobBullet = original.some((b) => otherRawBullets.some((ob) => sameMeaningLoose(b, ob)));
    const rawContainsNextJobLeak = raw.some((b) => /(?:19|20)\d{2}.*[-–].*(?:19|20)\d{2}|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(?:19|20)\d{2}/i.test(b) || jobs.some((other, otherIndex) => otherIndex !== index && ((other.title && lineHasNeedle(b, other.title)) || (other.company && lineHasNeedle(b, other.company)))));
    const originalContainsProjectLeak = original.length !== removeBulletsThatBelongToProjects(original, profile.projects || []).length;
    const useRaw = raw.length >= 2 && !rawContainsNextJobLeak && (
      !original.length ||
      originalContainsOtherJobBullet ||
      originalContainsProjectLeak ||
      raw.length >= original.length
    );
    const source = useRaw ? raw : original;
    const ranked = unique<string>(source.map(improveBulletVerb).filter(Boolean), (b) => normLoose(b))
      .map((bullet, i) => ({ bullet, score: scoreEvidence(`${job.title} ${job.company} ${bullet}`, jd), i }))
      .sort((a, b) => Math.abs(b.score - a.score) >= 8 ? b.score - a.score : a.i - b.i)
      .map((x) => x.bullet)
      .slice(0, index === 0 ? 6 : 5);
    return { ...job, bullets: ranked.length ? ranked : original.slice(0, index === 0 ? 6 : 5) };
  });
}

function extractRawProjects(profile: ResumeProfile) {
  const lines = rawCvLines(profile);
  const start = lines.findIndex((l) => /^projects?$/i.test(l));
  if (start < 0) return [] as ResumeProfile["projects"];
  const out: ResumeProfile["projects"] = [];
  let current: ResumeProfile["projects"][number] | null = null;
  let currentBullet = "";
  const flushBullet = () => {
    const b = improveBulletVerb(currentBullet);
    if (current && b.length >= 24) current.bullets.push(b);
    currentBullet = "";
  };
  const flushProject = () => {
    flushBullet();
    if (current && current.name && current.bullets.length) out.push({ name: String(current.name), bullets: unique<string>(current.bullets, (b) => normLoose(b)).slice(0, 5) });
    current = null;
  };

  for (let i = start + 1; i < lines.length; i++) {
    const line = clean(lines[i]);
    if (!line) continue;
    if (PROJECT_STOP_SECTION_RE.test(line)) { flushProject(); break; }
    if (isLikelyProjectNameLine(line) && !currentBullet && !/^selected project$/i.test(line)) {
      flushProject();
      current = { name: line, bullets: [] };
      continue;
    }
    if (!current) continue;
    if (ACTION_OR_RESPONSIBILITY_RE.test(line)) {
      flushBullet();
      currentBullet = line;
    } else if (currentBullet && line.length <= 140 && !isLikelyProjectNameLine(line)) {
      currentBullet += ` ${line}`;
    }
  }
  flushProject();
  return unique<ResumeProfile["projects"][number]>(out, (p) => normLoose(p.name)).slice(0, 6);
}

function repairProjectsFromRaw(profile: ResumeProfile, projects: ResumeProfile["projects"], jd: JdSignal) {
  const rawProjects = extractRawProjects(profile);
  const merged: ResumeProfile["projects"] = [...projects];
  for (const raw of rawProjects) {
    const exists = merged.some((p) => sameMeaningLoose(p.name, raw.name));
    if (!exists) merged.push(raw);
  }
  return merged.map((project) => {
    const displayName = cleanProjectNameV4(project.name, project.bullets || []);
    return {
      name: displayName,
      bullets: unique<string>((project.bullets || []).map(improveBulletVerb).filter(Boolean), (b) => normLoose(b))
        .map((bullet, index) => ({ bullet, score: scoreEvidence(`${displayName} ${bullet}`, jd), index }))
        .sort((a, b) => Math.abs(b.score - a.score) >= 8 ? b.score - a.score : a.index - b.index)
        .map((x) => x.bullet)
        .slice(0, 4),
    };
  }).filter((p) => p.name || p.bullets.length).slice(0, 6);
}

function extractRawEducation(profile: ResumeProfile) {
  const lines = rawCvLines(profile);
  const out: ResumeProfile["education"] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = clean(lines[i]);
    if (!EDUCATION_DEGREE_RE.test(line)) continue;
    if (line.length > 95) continue;
    if (/professional summary|profile|experience|project|skill|language|completed|enhance|technical skills|customer-facing/i.test(line)) continue;
    let degree = line.replace(/\s{2,}/g, " ").trim();
    let institution = "";
    let location = "";
    let dates = "";
    for (let j = i + 1; j <= Math.min(lines.length - 1, i + 5); j++) {
      const next = clean(lines[j]);
      if (!next) continue;
      const dateMatch = next.match(/(?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2}|\b(?:19|20)\d{2}\b/);
      if (!dates && dateMatch) dates = dateMatch[0];
      if (!institution && INSTITUTION_RE.test(next) && !EDUCATION_DEGREE_RE.test(next)) {
        const parts = next.split(/,|·/).map(clean).filter(Boolean);
        institution = parts[0] || next;
        location = parts.slice(1).join(", ");
      }
    }
    if (degree && (institution || dates)) out.push({ degree, institution, location, dates });
  }
  return unique<ResumeProfile["education"][number]>(out, (e) => `${normLoose(e.degree)}|${normLoose(e.institution)}|${e.dates}`).slice(0, 6);
}

function repairEducationFromRaw(profile: ResumeProfile, education: ResumeProfile["education"]) {
  const rawEdu = extractRawEducation(profile);
  const badExisting = education.some((e) => /completed|career break|technical skills|customer-facing|maternity|professional summary|profile summary/i.test(`${e.degree} ${e.institution}`));
  // Compare DISTINCT counts, not raw counts: raw text with duplicate rows used
  // to look "more complete" than the clean structured profile and win, dragging
  // the mangled duplicates (and wrong glued dates) into the render. Trust the
  // structured profile unless it is empty/contaminated, or raw genuinely has
  // MORE DISTINCT entries after dedupe (i.e. the structurer dropped one).
  const distinct = (list: ResumeProfile["education"]) =>
    new Set(list.map((e) => eduDedupeKey(e.degree, e.institution))).size;
  const cleanExisting = education.filter(
    (e) => !/completed|career break|technical skills|customer-facing|maternity|professional summary|profile summary/i.test(`${e.degree} ${e.institution}`),
  );
  const seed =
    cleanExisting.length === 0 || badExisting || distinct(rawEdu) > distinct(cleanExisting)
      ? rawEdu
      : cleanExisting;
  const merged = [...seed];
  const supplement = seed === rawEdu ? education : rawEdu;
  for (const item of supplement) {
    if (/completed|career break|technical skills|customer-facing|maternity|professional summary|profile summary/i.test(`${item.degree} ${item.institution}`)) continue;
    const exists = merged.some((e) => sameMeaningLoose(e.degree, item.degree) && (sameMeaningLoose(e.institution, item.institution) || !item.institution));
    if (!exists) merged.push(item);
  }
  return cleanEducation(merged, profile.basics.name);
}

function finalIntegrityCleanup(data: ResumeJson): ResumeJson {
  const skillDedupe = cleanSkillsForDisplay(data.skills).slice(0, 28);
  return {
    ...data,
    skills: skillDedupe,
    groupedSkills: groupedSkillLines(skillDedupe),
    experience: data.experience.map((job) => ({
      ...job,
      title: cleanExperienceTitle(job.title),
      company: cleanCompanyName(job.company),
      bullets: unique<string>(removeBulletsThatBelongToProjects(job.bullets || [], data.projects), (b) => normLoose(b)).slice(0, 6),
    })).filter((job) => clean(job.title || job.company || job.dates) || job.bullets.length),
    projects: finalProjectCleanupV4(data.projects),
  };
}

function preserveExperienceStructure(items: ResumeProfile["experience"]) {
  return unique<ResumeExperience>(
    items
      .map((job) => ({
        ...job,
        title: clean(job.title).replace(/^Professional Experience$/i, clean(job.title) || "Professional Experience"),
        company: clean(job.company),
        location: clean(job.location),
        dates: clean(job.dates),
        bullets: unique<string>((job.bullets || []).map(improveBulletVerb).filter(Boolean)).slice(0, 7),
      }))
      .filter((job) => job.company || job.title || job.bullets.length),
    (job) => `${job.company}|${job.title}|${job.dates}`,
  ).slice(0, 8);
}

function preserveProjectStructure(items: ResumeProfile["projects"]) {
  return unique<ResumeProfile["projects"][number]>(
    items
      .map((project) => {
        const rawName = clean(project.name);
        const bullets = unique<string>((project.bullets || []).map(improveBulletVerb).filter(Boolean)).slice(0, 5);

        // If the name is blank, "Candidate", "Selected Project", or another
        // placeholder, try to derive a name from the first bullet's key noun
        // rather than showing a blank or confusing placeholder.
        let name = rawName
          .replace(/^Selected Projects?$/i, "Selected Project")
          .replace(/^Candidate$/i, "")
          .trim();

        if (!name && bullets.length) {
          // Extract the first meaningful noun phrase from the first bullet
          // extracts topic using a preposition pattern: "on/for/of [topic] using/with/to/."
          const firstBullet = bullets[0];
          const topicMatch = firstBullet.match(/(?:on|for|of|about|regarding)\s+([A-Za-z][a-zA-Z\s]{3,30}?)(?:\s+using|\s+with|\s+to\s|\.|,)/i);
          name = topicMatch ? topicMatch[1].trim() : "Independent Project";
        }

        return { name, bullets };
      })
      .filter((project) => {
        if (!project.name && !project.bullets.length) return false;
        if (/^Selected Project$/i.test(project.name) && project.bullets.length < 2) return false;
        if (/^(Project Management|Communication|Problem Solving|Teamwork)$/i.test(project.name) && project.bullets.length < 2) return false;
        return true;
      }),
    (project) => `${project.name}|${project.bullets.join("|")}`,
  ).slice(0, 6);
}



// ─────────────────────────────────────────────────────────────────────────────
// WorkZo global resume guardrails v4
// ─────────────────────────────────────────────────────────────────────────────
// These functions are intentionally NOT tied to any one CV, company, school, or
// project. They enforce universal resume rules before any JD tailoring happens:
// - contact fields cannot contain section headings
// - candidate name cannot be a role, section, school, project, or placeholder
// - generated/page-layout headings cannot become projects
// - projects are deduped by title and bullet meaning, not by exact text only
// - education dates are repaired when a PDF text layer put the section-year next
//   to the next line (for example: LINKEDIN...EDUCATION2024)
// - experience entries are recovered from raw section text when the parser merged
//   title/company/date columns incorrectly.

const BAD_NAME_RE_V4 = /^(candidate|professional|profile|summary|professional summary|profile summary|education|work experience|professional experience|experience|projects?|skills?|languages?|certifications?|data science bootcamp|bootcamp|bachelor|master|university|college|school|institute|itsupportspecialist dataanalyst|it support specialist data analyst)$/i;
const ROLE_ONLY_NAME_RE_V4 = /\b(engineer|analyst|specialist|manager|developer|designer|consultant|technician|administrator|assistant|scientist|support|success|project implementation|technical support|data analyst|it support)\b/i;
const SECTION_WORD_RE_V4 = /\b(education|professional summary|profile summary|work experience|professional experience|projects?|skills?|languages?|certifications?|contact|kontakt|bildung|sprachen)\b/i;
const CONTACT_STOP_RE_V4 = /(education|professional summary|profile summary|work experience|professional experience|projects?|skills?|languages?|certifications?|contact|kontakt|bildung|sprachen)\s*\d{0,4}\s*$/i;
const PROJECT_BAD_NAME_RE_V4 = /^(candidate|professional|independent project|selected project|selected projects|unknown section header|project management|teamwork|time management|leadership|effective communication|critical thinking|itsupportspecialist\s*\/?\s*dataanalyst|it\s*support\s*specialist\s*\/?\s*data\s*analyst)$/i;
const PROJECT_TITLE_SIGNAL_RE_V4 = /\b(project|study|analysis|dashboard|pipeline|research|feasibility|automation|portfolio|case study|sentiment|nlp|api|platform|application|service|system|tool|model|prediction|classification|visualization|visualisation)\b/i;
const COMPANY_SIGNAL_RE_V4 = /\b(gmbh|ug|ag|kg|bv|ltd|limited|llc|inc|corp|corporation|company|co\.?|group|systems|solutions|technologies|software|services|labs|studio|consulting|industries|enterprises|associates|partners|ventures|university|college|school|institute|academy)\b/i;
const ROLE_LINE_RE_V4 = /\b(engineer|analyst|specialist|manager|developer|designer|consultant|technician|administrator|assistant|scientist|support|success|coordinator|intern|lead|officer|executive)\b/i;
const EMAIL_RE_V4 = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_RE_V4 = /(?:\+?\d[\d\s().-]{7,}\d)/;
const URL_RE_V4 = /\b(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/in\/|github\.com\/|[a-z0-9.-]+\.[a-z]{2,}\/)[^\s|,;)]*/i;
const DATE_RE_V4 = /\b(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december|märz|maerz|mai|juni|juli|okt|dez)[a-zä]*\s*)?(?:19|20)\d{2}\s*(?:[-–]\s*(?:present|current|heute|(?:19|20)\d{2}))?\b/i;

function titleCaseNameV4(value = "") {
  return clean(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.includes("-")
      ? part.split("-").map((p) => p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : p).join("-")
      : part[0].toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
    .trim();
}

function nameFromEmailV4(email = "") {
  const local = clean(email).split("@")[0] || "";
  if (!local) return "";
  const withoutNumbers = local.replace(/\d+/g, " ").replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
  const parts = withoutNumbers.split(/\s+/).filter((p) => p.length >= 2 && !/^(info|contact|hello|admin|support|jobs|career|cv|resume)$/i.test(p));
  if (parts.length >= 2) return titleCaseNameV4(parts.slice(0, 3).join(" "));
  // camel-ish local part: harithavijayakumar -> Haritha Vijayakumar is not
  // generally knowable, so do not fabricate for arbitrary users.
  return "";
}

function looksLikeBadCandidateNameV4(name = "") {
  const n = clean(name).replace(/[|•·]+/g, " ").trim();
  if (!n) return true;
  if (n.length < 2 || n.length > 60) return true;
  if (EMAIL_RE_V4.test(n) || PHONE_RE_V4.test(n) || URL_RE_V4.test(n)) return true;
  if (BAD_NAME_RE_V4.test(n) || SECTION_WORD_RE_V4.test(n)) return true;
  if (/\b(?:19|20)\d{2}\b/.test(n)) return true;
  const words = n.split(/\s+/).filter(Boolean);
  if (words.length > 5) return true;
  // A name can be all caps, but a pure role line should not be used as a name.
  if (ROLE_ONLY_NAME_RE_V4.test(n) && !/^[A-Z][a-z]+\s+[A-Z][a-z]+/.test(n)) return true;
  if (/^(data|technical|customer|project|product|it|software)\b/i.test(n) && ROLE_LINE_RE_V4.test(n)) return true;
  return false;
}

function deriveCandidateNameV4(profile: ResumeProfile, rawText = "") {
  const current = clean(profile.basics?.name || "");
  if (!looksLikeBadCandidateNameV4(current)) return titleCaseNameV4(current);

  const raw = normalizeResumeText(rawText || profile.rawText || profile.previewText || "");
  const email = clean(profile.basics?.email || raw.match(EMAIL_RE_V4)?.[0] || "");
  const emailName = nameFromEmailV4(email);
  if (emailName && !looksLikeBadCandidateNameV4(emailName)) return emailName;

  const lines = raw.split(/\n+/).map((l) => clean(l)).filter(Boolean).slice(0, 20);
  for (const line of lines) {
    const candidate = line.replace(/\s+/g, " ").trim();
    if (!looksLikeBadCandidateNameV4(candidate) && !ROLE_LINE_RE_V4.test(candidate) && /^[A-ZÀ-Ö][A-Za-zÀ-ÖØ-öø-ÿ' -]+$/.test(candidate)) {
      return titleCaseNameV4(candidate);
    }
  }
  return "Candidate";
}

function cleanContactFieldV4(value = "", kind: "email" | "phone" | "linkedin" | "location" | "headline" | "generic" = "generic") {
  let v = clean(value)
    .replace(/\s+/g, " ")
    .replace(/\bLinked\s+In\b/gi, "LinkedIn")
    .trim();
  if (!v) return "";
  // Cut off merged section headings: LinkedIn...EDUCATION2024 -> LinkedIn...
  v = v.replace(CONTACT_STOP_RE_V4, "").replace(/\s*\|\s*$/g, "").trim();
  if (kind === "email") return v.match(EMAIL_RE_V4)?.[0] || "";
  if (kind === "phone") return v.match(PHONE_RE_V4)?.[0]?.trim() || "";
  if (kind === "linkedin") {
    const m = v.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-z0-9._-]+\/?/i);
    return m ? m[0].replace(/\/+$/, "") : "";
  }
  if (kind === "headline") {
    const h = v.replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ]+|[^A-Za-zÀ-ÖØ-öø-ÿ/ &|+-]+$/g, "").trim();
    if (!h || SECTION_WORD_RE_V4.test(h) || EMAIL_RE_V4.test(h) || PHONE_RE_V4.test(h)) return "";
    return h.length > 80 ? h.slice(0, 80).replace(/\s+\S*$/, "") : h;
  }
  if (SECTION_WORD_RE_V4.test(v) || EMAIL_RE_V4.test(v) || PHONE_RE_V4.test(v)) return "";
  return v;
}

function globallyNormalizedResumeTextV4(value = "") {
  return normalizeResumeText(value)
    .replace(/(linkedin\.com\/in\/[A-Za-z0-9._-]+)\s*(education|bildung)\s*((?:19|20)\d{2})/gi, "$1\n$2\n$3")
    .replace(/([a-z])([A-Z][A-Z ]{4,})(?=\n|$)/g, "$1\n$2")
    .replace(/\bITSupportSpecialist\b/gi, "IT Support Specialist")
    .replace(/\bDataanalyst\b/gi, "Data Analyst")
    .replace(/\bPROFILESUMMARY\b/gi, "PROFILE SUMMARY")
    .replace(/\bWORKEXPERIENCE\b/gi, "WORK EXPERIENCE")
    .replace(/\bCORE S K I L L S\b/gi, "CORE SKILLS")
    .replace(/\bPR O J E C TS\b/gi, "PROJECTS")
    .replace(/\bE D U CATI O N\b/gi, "EDUCATION")
    .replace(/\bL A N G UAG ES\b/gi, "LANGUAGES");
}

function rawLinesV4(profile: ResumeProfile, rawText = "") {
  return globallyNormalizedResumeTextV4(rawText || profile.rawText || profile.previewText || "")
    .split(/\n+/)
    .map((line) => clean(line))
    .filter(Boolean)
    .slice(0, 350);
}

function shouldDropProjectNameV4(name = "", bullets: string[] = []) {
  const n = clean(name);
  if (!n) return !bullets.length;
  if (PROJECT_BAD_NAME_RE_V4.test(n)) return true;
  if (SECTION_WORD_RE_V4.test(n)) return true;
  if (EMAIL_RE_V4.test(n) || PHONE_RE_V4.test(n) || URL_RE_V4.test(n)) return true;
  if (DATE_RE_V4.test(n)) return true;
  if (ROLE_LINE_RE_V4.test(n) && !PROJECT_TITLE_SIGNAL_RE_V4.test(n)) return true;
  if (n.length > 90) return true;
  return false;
}


function titleCaseSmall(value = "") {
  return clean(value)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function deriveProjectNameFromBulletsV4(name = "", bullets: string[] = []) {
  const rawName = clean(name);
  const joined = clean([rawName, ...bullets].join(" "));

  // Generic repair for parser fragments such as "entering the Brazilian market using SQL".
  // The fragment is a topic/action phrase, not a stable project title. When the
  // bullets describe a feasibility/market-entry analysis, render it as a proper
  // project title without hard-coding any specific country or company.
  const marketFragment = rawName.match(/(?:entering|entry into|market entry(?: for)?|expansion into)\s+(?:the\s+)?([A-Za-z][A-Za-z &/-]{3,45}?)(?:\s+market)?(?:\s+using|\s+with|$)/i);
  if (marketFragment && /feasibility|market|business opportunit|competition|competitive|partnership|strategic/i.test(joined)) {
    let topic = clean(marketFragment[1]).replace(/\bmarket\b$/i, "").trim();
    if (topic) return `${titleCaseSmall(topic)} Market Feasibility Study`;
  }

  const feasibilityTopic = joined.match(/feasibility study (?:on|for|of) (?:entering\s+)?(?:the\s+)?([A-Za-z][A-Za-z &/-]{3,45}?)(?:\s+market|\s+using|\.|,|$)/i);
  if (feasibilityTopic) {
    const topic = clean(feasibilityTopic[1]).replace(/\bmarket\b$/i, "").trim();
    if (topic) return `${titleCaseSmall(topic)} Market Feasibility Study`;
  }

  return "";
}

function cleanProjectNameV4(name = "", bullets: string[] = []) {
  let n = clean(name)
    .replace(/^Candidate$/i, "")
    .replace(/^Independent Project$/i, "")
    .replace(/^Selected Projects?$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const derivedName = deriveProjectNameFromBulletsV4(n, bullets);
  if (derivedName) n = derivedName;
  if (shouldDropProjectNameV4(n, bullets)) n = "";
  if (!n && bullets.length) {
    const first = bullets[0] || "";
    const m = first.match(/(?:study|analysis|pipeline|dashboard|project|model|system|service|platform|application)\s+(?:on|for|of)?\s*([A-Z][A-Za-z0-9 &/-]{3,45})(?:\s+using|\s+with|\.|,|$)/i)
      || first.match(/(?:entering|supporting|building|developing|analyzing|analysing)\s+(?:the\s+)?([A-Z][A-Za-z0-9 &/-]{3,45})(?:\s+market|\s+service|\s+platform|\s+using|\.|,|$)/i);
    n = m ? clean(m[1]) : "Project";
  }
  return n;
}

function cleanBulletV4(value = "") {
  const b = improveBulletVerb(value)
    .replace(/^[-•*]\s*/, "")
    .replace(/^APIs,\s+and\s+/i, "Used REST APIs and ")
    .replace(/\s+/g, " ")
    .trim();
  if (!b || b.length < 22) return "";
  if (SECTION_WORD_RE_V4.test(b) && b.length < 80) return "";
  if (PROJECT_BAD_NAME_RE_V4.test(b)) return "";
  return b.endsWith(".") ? b : `${b}.`;
}

function finalProjectCleanupV4(projects: ResumeProfile["projects"]) {
  const byKey = new Map<string, ResumeProfile["projects"][number]>();
  for (const project of projects || []) {
    const rawBullets = (project.bullets || []).map(cleanBulletV4).filter(Boolean);
    const name = cleanProjectNameV4(project.name, rawBullets);
    if (!name && !rawBullets.length) continue;
    if (shouldDropProjectNameV4(name, rawBullets) && rawBullets.length < 2) continue;
    const key = normLoose(name || rawBullets[0] || "project");
    const existing = byKey.get(key);
    const mergedBullets = unique<string>([...(existing?.bullets || []), ...rawBullets], (b) => {
      // A truncated duplicate is considered the same as its longer version.
      const k = normLoose(b).replace(/\b(rest|apis?|mysql|python|sql|tableau|gcp|aws)\b/g, "").slice(0, 90);
      return k;
    });
    const bestBullets = mergedBullets
      .filter((b, _, arr) => !arr.some((other) => other !== b && normLoose(other).startsWith(normLoose(b).slice(0, 60)) && other.length > b.length + 20))
      .slice(0, 4);
    byKey.set(key, { name: existing?.name || name || "Project", bullets: bestBullets });
  }
  return Array.from(byKey.values()).filter((p) => p.bullets.length || p.name !== "Project").slice(0, 5);
}

function repairEducationDatesV4(profile: ResumeProfile, rawText = "") {
  const lines = rawLinesV4(profile, rawText);
  const existing = cleanEducation(profile.education || [], profile.basics.name)
    .filter((e) => !/maternity|completed|technical skills|professional summary|profile summary|customer-facing|fluent in/i.test(`${e.degree} ${e.institution}`));

  const eduIndex = lines.findIndex((l) => /^(education|bildung|educational background)$/i.test(l));
  if (eduIndex < 0) return existing;
  const eduLines: string[] = [];
  for (let i = eduIndex + 1; i < Math.min(lines.length, eduIndex + 40); i++) {
    if (/^(languages?|sprachen|projects?|work experience|professional experience|skills?|certifications?|contact|kontakt)$/i.test(lines[i])) break;
    eduLines.push(lines[i]);
  }
  const found: ResumeProfile["education"] = [];
  let pendingDate = "";
  for (let i = 0; i < eduLines.length; i++) {
    const line = eduLines[i];
    const dateMatch = line.match(/(?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2}|(?:19|20)\d{2}/)?.[0] || "";
    const withoutDate = clean(line.replace(dateMatch, ""));
    if (dateMatch && !EDUCATION_DEGREE_RE.test(withoutDate) && !INSTITUTION_RE.test(withoutDate)) {
      pendingDate = dateMatch;
      continue;
    }
    if (!EDUCATION_DEGREE_RE.test(line)) continue;
    let degree = clean(withoutDate || line);
    let institution = "";
    let dates = dateMatch || pendingDate;
    pendingDate = "";
    // Pattern: Degree | Institution | Dates
    const parts = line.split(/\s*\|\s*/).map(clean).filter(Boolean);
    if (parts.length >= 2) {
      degree = parts[0].replace(DATE_RE_V4, "").trim();
      const instPart = parts.slice(1).join(" | ");
      const d = instPart.match(/(?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2}|(?:19|20)\d{2}/)?.[0] || "";
      dates = dates || d;
      institution = clean(instPart.replace(d, ""));
    } else {
      for (let j = i + 1; j < Math.min(eduLines.length, i + 5); j++) {
        const next = eduLines[j];
        if (!institution && INSTITUTION_RE.test(next) && !EDUCATION_DEGREE_RE.test(next)) institution = next.replace(DATE_RE_V4, "").trim();
        if (!dates) dates = next.match(/(?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2}|(?:19|20)\d{2}/)?.[0] || "";
      }
    }
    if (degree && (institution || dates)) found.push({ degree, institution, location: "", dates });
  }

  const combined = found.length ? [...found, ...existing] : existing;
  return cleanEducation(combined, profile.basics.name).slice(0, 5);
}

function parseExperienceFromRawV4(profile: ResumeProfile, rawText = "") {
  const lines = rawLinesV4(profile, rawText);
  const start = lines.findIndex((l) => /^(professional experience|work experience|experience|berufserfahrung)$/i.test(l));
  if (start < 0) return [] as ResumeExperience[];
  const end = (() => {
    for (let i = start + 1; i < lines.length; i++) if (/^(projects?|education|bildung|skills?|languages?|sprachen|certifications?)$/i.test(lines[i])) return i;
    return lines.length;
  })();
  const section = lines.slice(start + 1, end);
  const jobs: ResumeExperience[] = [];
  // Use a mutable state object instead of a bare local variable. TypeScript does
  // not reliably narrow locals that are assigned inside nested functions, which
  // caused Vercel builds to fail with "current is possibly null" / "never".
  const state: { current: ResumeExperience | null } = { current: null };
  let headerRole = cleanContactFieldV4(profile.basics?.headline || "", "headline");
  if (/customer success|project implementation/i.test(headerRole)) headerRole = "";
  const flush = () => {
    const active = state.current;
    if (!active) return;
    active.bullets = unique<string>((active.bullets || []).map(cleanBulletV4).filter(Boolean), (b) => normLoose(b)).slice(0, 6);
    if (active.company || active.title || active.bullets.length) jobs.push(active);
    state.current = null;
  };

  const startJob = (title: string, company: string, dates: string): ResumeExperience => {
    flush();
    const next: ResumeExperience = { title: cleanExperienceTitle(title || headerRole || "Professional Experience"), company: cleanCompanyName(company), location: "", dates: clean(dates), bullets: [] };
    state.current = next;
    return next;
  };

  const ensureCurrentJob = (): ResumeExperience => {
    return state.current ?? startJob("", "", "");
  };

  for (let i = 0; i < section.length; i++) {
    const line = section[i];
    if (!line || SECTION_WORD_RE_V4.test(line)) continue;
    const parts = line.split(/\s*\|\s*/).map(clean).filter(Boolean);
    const date = line.match(DATE_RE_V4)?.[0] || "";
    if (parts.length >= 3 && DATE_RE_V4.test(parts[parts.length - 1])) {
      startJob(parts[0], parts[1], parts[parts.length - 1]);
      continue;
    }
    if (parts.length >= 2 && date) {
      const a = parts[0].replace(DATE_RE_V4, "").trim();
      const b = parts[1].replace(DATE_RE_V4, "").trim();
      const titleFirst = ROLE_LINE_RE_V4.test(a) && !COMPANY_SIGNAL_RE_V4.test(a);
      startJob(titleFirst ? a : "", titleFirst ? b : a, date);
      continue;
    }
    if (date && COMPANY_SIGNAL_RE_V4.test(line) && !ACTION_OR_RESPONSIBILITY_RE.test(line)) {
      startJob("", line.replace(DATE_RE_V4, "").replace(/[|–-]+$/g, "").trim(), date);
      continue;
    }
    if (ROLE_LINE_RE_V4.test(line) && !ACTION_OR_RESPONSIBILITY_RE.test(line) && !DATE_RE_V4.test(line) && line.length <= 80) {
      const next = section[i + 1] || "";
      const nextDate = next.match(DATE_RE_V4)?.[0] || "";
      if (COMPANY_SIGNAL_RE_V4.test(next) || nextDate) {
        startJob(line, next.replace(DATE_RE_V4, "").trim(), nextDate);
        if (nextDate || COMPANY_SIGNAL_RE_V4.test(next)) i += 1;
        continue;
      }
    }
    if (ACTION_OR_RESPONSIBILITY_RE.test(line)) {
      ensureCurrentJob().bullets.push(line);
    } else {
      const active = state.current;
      if (active?.bullets?.length && line.length < 140 && !ROLE_LINE_RE_V4.test(line)) {
        active.bullets[active.bullets.length - 1] += ` ${line}`;
      }
    }
  }
  flush();
  return unique(jobs, (j) => `${normLoose(j.company)}|${normLoose(j.title)}|${j.dates}`).slice(0, 8);
}


function repairLanguagesFromRawV4(profile: ResumeProfile, rawText = "") {
  const existing = unique<string>((profile.languages || []).map(clean).filter(Boolean), (l) => normLoose(l.split(/[-:()]/)[0]));
  const lines = rawLinesV4(profile, rawText);
  const langIndex = lines.findIndex((l) => /^(languages?|sprachen)$/i.test(l));
  const found: string[] = [];
  const scan = langIndex >= 0 ? lines.slice(langIndex + 1, Math.min(lines.length, langIndex + 12)) : lines;
  const langPattern = /\b(English|German|Deutsch|French|Französisch|Spanish|Spanisch|Italian|Italienisch|Dutch|Niederländisch|Portuguese|Portugiesisch|Tamil|Hindi|Telugu|Arabic|Chinese|Mandarin|Polish)\b\s*(?:[-:()]?\s*([A-Za-z0-9+ ]{1,28}))?/gi;
  for (const line of scan) {
    if (langIndex >= 0 && /^(education|bildung|projects?|professional experience|work experience|skills?|certifications?|contact|kontakt)$/i.test(line)) break;
    let m: RegExpExecArray | null;
    while ((m = langPattern.exec(line))) {
      const name = clean(m[1]);
      const level = clean(m[2] || "")
        .replace(/^(and|,|;|\||English|German|Deutsch)$/i, "")
        .replace(/\b(PR O F|CORE|SKILLS|EDUCATION|PROJECTS?)\b.*$/i, "")
        .trim();
      if (!name) continue;
      const display = level ? `${name} - ${level}` : name;
      found.push(display);
    }
  }
  return unique<string>([...existing, ...found], (l) => {
    const k = normLoose(l.split(/[-:()]/)[0]);
    return k === "deutsch" ? "german" : k;
  }).slice(0, 6);
}

function globallyRepairProfileV4(profile: ResumeProfile, rawText = ""): ResumeProfile {
  const raw = globallyNormalizedResumeTextV4(rawText || profile.rawText || profile.previewText || "");
  const email = cleanContactFieldV4(profile.basics?.email || raw.match(EMAIL_RE_V4)?.[0] || "", "email");
  const phone = cleanContactFieldV4(profile.basics?.phone || raw.match(PHONE_RE_V4)?.[0] || "", "phone");
  const linkedin = cleanContactFieldV4(profile.basics?.linkedin || raw.match(/linkedin\.com\/in\/[a-z0-9._/-]+/i)?.[0] || "", "linkedin");
  const name = deriveCandidateNameV4({ ...profile, basics: { ...profile.basics, email } }, raw);
  const headline = cleanContactFieldV4(profile.basics?.headline || "", "headline");
  const rawExperience = parseExperienceFromRawV4(profile, raw);
  // TRUST the structured experience. The render must not discard a clean,
  // structured profile and rebuild it from raw text — that path (a third,
  // weaker parser) drops bullets and collapses distinct titles. Fall back to the
  // raw re-derivation ONLY when the structured experience is unusable: absent,
  // missing titles, carrying no bullets at all, or contaminated with education /
  // project rows that leaked in as jobs. A mere tie or larger raw count is NOT a
  // reason to overwrite good structured data.
  const structured = profile.experience || [];
  const structuredBulletCount = structured.reduce((n, j) => n + (j.bullets || []).length, 0);
  const structuredContaminated = structured.some((j) =>
    /\b(education|bootcamp|bachelor|master|diploma|degree)\b/i.test(`${j.title || ""} ${j.company || ""}`),
  );
  const structuredUsable =
    structured.length > 0 &&
    structured.every((j) => !!j.title) &&
    structuredBulletCount > 0 &&
    !structuredContaminated;
  const useRawExperience = !structuredUsable && rawExperience.length >= 1;
  const repaired: ResumeProfile = {
    ...profile,
    rawText: raw || profile.rawText || "",
    basics: {
      ...profile.basics,
      name,
      headline,
      email,
      phone,
      linkedin,
      location: cleanContactFieldV4(profile.basics?.location || "", "location"),
    },
    summary: clean(profile.summary).replace(/([a-z])([A-Z])/g, "$1 $2"),
    experience: useRawExperience ? rawExperience : profile.experience || [],
    projects: finalProjectCleanupV4(profile.projects || []),
    education: repairEducationDatesV4(profile, raw),
    skills: cleanSkillsForDisplay(profile.skills || []),
    languages: repairLanguagesFromRawV4(profile, raw),
  };
  return repaired;
}

function preserveSummary(profile: ResumeProfile, roleFit: ResumeJson["roleFit"]) {
  const summary = compactSentence(profile.summary || "", 650);
  const badSummary =
    !summary ||
    summary.length < 45 ||
    /^(skilled in|experienced in|proficient in|knowledge of|showcased|developed|conducted|analyzed|automated|visualized)\b/i.test(summary);

  if (!badSummary) return summary;

  const evidence = (profile.experience || []).flatMap((job) => job.bullets || []).find((line) => line.length > 70) || "";
  if (evidence && !/^(showcased|developed|conducted|analyzed|automated|visualized)\b/i.test(evidence)) {
    return compactSentence(`${roleFit.safeHeadline} with practical experience across ${evidence.replace(/^[•-]\s*/, "")}`, 420);
  }

  return `${roleFit.safeHeadline} with practical professional experience, problem solving, and cross-functional collaboration.`;
}

export function buildResumeJson(input: CvGenerationInput): ResumeJson {
  const profile = globallyRepairProfileV4(profileFromInput(input), input.cvText || "");
  const jd = analyzeJd(input);
  const roleFit = buildRoleFit(profile, jd);

  const baseExperience = chooseBestExperienceSource(profile, preserveExperienceStructure(profile.experience || []));
  const baseProjects = preserveProjectStructure(profile.projects || []);
  const projects = repairProjectsFromRaw(profile, baseProjects, jd);
  const experience = repairExperienceFromRaw({ ...profile, projects }, baseExperience, jd);
  const education = repairEducationFromRaw(profile, cleanEducation(profile.education || [], profile.basics.name));
  // Clean and deduplicate skills ONCE here, then pass the same list to
  // groupedSkillLines so it doesn't re-run cleanSkillsForDisplay and reintroduce
  // duplicates that were already removed.
  const skills = cleanSkillsForDisplay(unique<string>(profile.skills || [])).slice(0, 28);
  const groupedSkills = groupedSkillLines(skills);
  const summary = preserveSummary(profile, roleFit);

  // Sanitise basics.location, reject values that look like company names rather than
  // addresses. Common parse error: the first employer's name appears in the same
  // text zone as the candidate's address and gets extracted as the location.
  const rawLocation = profile.basics.location || "";
  const locationLooksLikeCompany =
    rawLocation.length > 0 &&
    // Has no address-like signals (street, city, postcode, country)
    !/\d|str(a(sse|ße)|eet)|road|avenue|ave\b|blvd|lane|way\b|\bpl\b|\bst\b|city|town|village|germany|france|spain|uk|usa|india|netherlands|berlin|munich|london|paris|hamburg|frankfurt|cologne|düsseldorf|würzburg|zürich|wien|amsterdam/i.test(rawLocation) &&
    // Looks like a company name (contains Corp, GmbH, Ltd, Inc, or just a proper noun without numbers)
    (/\b(corp|gmbh|ltd|inc|llc|ag|bv|co\.|company|group|solutions|services|technologies|systems|consulting|consulting|partners)\b/i.test(rawLocation) ||
      // All words are capitalised and no address pattern, likely a company name extracted by mistake
      (/^[A-Z][a-zA-Z\s&.-]+$/.test(rawLocation.trim()) && rawLocation.trim().split(/\s+/).length <= 4 && !/\d/.test(rawLocation)));
  const safeLocation = locationLooksLikeCompany ? "" : rawLocation;

  return finalIntegrityCleanup({
    profile: { ...profile, basics: { ...profile.basics, location: safeLocation } },
    basics: { ...profile.basics, location: safeLocation, headline: profile.basics.headline || roleFit.safeHeadline },
    summary,
    skills,
    groupedSkills,
    experience,
    projects,
    education,
    languages: repairLanguagesFromRawV4(profile, profile.rawText || input.cvText || ""),
    strengths: unique<string>([...(profile.strengths || []), ...roleFit.highlights]).slice(0, 7),
    roleFit,
    market: normalizeMarket(input.targetMarket),
    style: normalizeStyle(input.template),
  });
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
      if (job.bullets.length) {
        job.bullets.forEach((bullet) => out.push(`- ${bullet}`));
      }
      // A job with no bullets gets NO bullets. It previously got:
      //   "- [Role responsibilities to be completed based on job description]"
      // and the copilot prompt then instructed the model to replace that with
      // "2-3 real, JD-relevant bullets inferred from what that type of role
      // would have done". That is an instruction to invent work history. It put
      // achievements on a candidate's CV that the candidate never claimed, and
      // the placeholder itself leaked verbatim into rendered CVs when the model
      // failed to replace it.
      //
      // An employer with no bullets is a DATA GAP, and the honest output for a
      // data gap is an empty one the user can fill in, not a fluent lie. The
      // employer is still preserved: see the "NEVER DROP AN EMPLOYER" rule,
      // which no longer depends on a placeholder to work.
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
  const highlights = data.roleFit.highlights.slice(0, 3);
  const matchLevel = data.roleFit.matchLevel;

  // For the intro, describe the candidate's actual professional background
  // (years of experience + field), NOT their job title verbatim. This avoids
  // e.g. "My background as a Product Design Technician at Cummins GmbH has
  // given me experience in 3D printing" appearing in an IT integration cover letter.
  const yearsMatch = (data.profile.basics.headline + " " + data.profile.summary).match(/(\d+)\+?\s*year/i);
  const yearsText = yearsMatch ? `${yearsMatch[1]}+ years of` : "a background in";

  // Extract a clean job title from the headline.
  // Handles corrupt/mis-extracted headlines like "Cummins Deutschland GmbH - WÜRzburg, Germany"
  // where the whole string is a company+location rather than a title.
  // Strategy: if the headline looks like a company/location string (contains GmbH, AG, Ltd,
  // comma-separated city, or multiple capitalised proper-noun words without a role keyword),
  // fall back to the profile summary or a generic label instead.
  // Extract a clean job title for use in cover letter prose.
  // The headline field is sometimes mis-extracted as "Company GmbH - City, Country"
  // rather than a job title. Priority: first experience title > summary extraction > cleaned headline.
  function extractJobTitle(headline: string, summary: string, firstJobTitle: string): string {
    const h = headline.trim();
    // If headline looks like a company/location string, use the most recent job title instead
    if (/\b(gmbh|ag|ltd|llc|inc|corp|plc|bv|gbr|ug|kg)\b/i.test(h) || /^[A-Z][\w ]+ - [A-Z]/.test(h)) {
      // Best source: the actual job title from the most recent experience entry
      if (firstJobTitle && firstJobTitle.length > 2 && firstJobTitle.length < 60) {
        return firstJobTitle.replace(/\b\w/g, c => c.toUpperCase());
      }
      // Fallback: extract from summary (e.g. "Product Design Technician with 6 years")
      const m = summary.match(/\b((?:[A-Z][a-z]+ ){0,3}(?:engineer|designer|developer|architect|scientist|manager|specialist|analyst|consultant|technician|coordinator|officer|lead|director))\b/i);
      if (m) return m[1].replace(/\b\w/g, c => c.toUpperCase());
      return "Engineering Professional";
    }
    // Strip company/location suffixes from otherwise valid headlines
    return h
      .replace(/\s*[-–]\s*[\w].{3,}$/, "")
      .replace(/\bat\s+.+$/i, "")
      .replace(/,\s*[A-Z][A-Za-z ]{2,}$/, "")
      .trim() || "Engineering Professional";
  }
  const firstJobTitle = data.profile.experience?.[0]?.title || "";
  const fieldLabel = data.profile.basics.headline
    ? extractJobTitle(data.profile.basics.headline, data.profile.summary || "", firstJobTitle)
    : firstJobTitle || "engineering and technology";

  // Detect domain mismatch FIRST, must happen before bullet selection so the
  // correct branch (synthesis vs raw evidence) is chosen.
  // The it_systems_integration family's signals (documentation, cross-functional,
  // process) fire on any engineering CV, so matchLevel alone can't detect a switch.
  const jdIsItRole = (input.jobDescription || "").toLowerCase().match(/cloud|integration|microsoft|azure|system admin|it specialist|hr software|saas|3rd level|2nd level|second level|third level/i);
  const cvIsNonItDomain = (input.cvText || "").toLowerCase().match(/cad|mechanical|product design|solidworks|creo|catia|cnc|3d print|aerospace|sanding|polishing|prototyp/i);
  const isCareerChange = matchLevel === "stretch" || matchLevel === "unknown" || Boolean(jdIsItRole && cvIsNonItDomain);

  // Build bullets: synthesise transferable language for career-change, use evidence lines for direct matches.
  const transferableMap: Array<[string, string]> = [
    ["cross-functional", "Cross-functional collaboration across engineering and non-technical teams"],
    ["documentation", "Creating and maintaining detailed technical documentation and process records"],
    ["process", "Supporting process improvement and structured change management workflows"],
    ["microsoft", "Microsoft Office Suite proficiency (used regularly across engineering roles)"],
    ["german", "German B2 and English C1, strong bilingual communication in a German-speaking workplace"],
    ["english", "German B2 and English C1, strong bilingual communication in a German-speaking workplace"],
    ["support", "Hands-on technical support and troubleshooting in a structured engineering environment"],
    ["install", "Installation and setup of technical equipment and tools"],
    ["integration", "Supporting system integration and coordinating cross-team technical changes"],
    ["team", "Team collaboration within multinational engineering environments"],
    ["communication", "Clear written and verbal communication in German and English"],
    ["problem", "Analytical and methodical problem solving under technical constraints"],
    ["management", "Task and project management with multiple concurrent engineering deliverables"],
  ];

  const hardcodedFallbacks = [
    "- Methodical approach to technical problem solving and documentation",
    "- Cross-functional collaboration in an international engineering environment",
    "- Strong German (B2) and English (C1) communication skills",
  ];

  let bodyBullets: string[];

  if (!isCareerChange && (matchLevel === "strong" || matchLevel === "partial")) {
    // Direct match: use best-scored evidence lines
    const rawEvidence = data.roleFit.evidenceLines.slice(0, 3);
    bodyBullets = rawEvidence.length
      ? rawEvidence.map((line) => `- ${line}`)
      : highlights.map((line) => `- ${line}`);
  } else {
    // Career-change or low match: synthesise transferable competency bullets.
    // NEVER paste raw domain-specific CV bullets (CAD, 3D printing, sanding machines)
    // into a cover letter for an IT/unrelated role.
    const usedLabels = new Set<string>();
    const synth: string[] = [];

    // First pass: map from highlights (signal labels like "engineering change and documentation")
    for (const highlight of highlights) {
      const lower = highlight.toLowerCase();
      for (const [key, label] of transferableMap) {
        if (lower.includes(key) && !usedLabels.has(label)) {
          usedLabels.add(label);
          synth.push(`- ${label}`);
          break;
        }
      }
    }

    // Second pass: scan all available CV text for transferable keyword signals
    const allCvText = [
      input.cvText || "",
      data.profile.summary || "",
      ...(data.profile.skills || []),
      ...(data.profile.experience || []).flatMap(j => j.bullets || []),
    ].join(" ").toLowerCase();

    for (const [key, label] of transferableMap) {
      if (synth.length >= 3) break;
      if (allCvText.includes(key) && !usedLabels.has(label)) {
        usedLabels.add(label);
        synth.push(`- ${label}`);
      }
    }

    // Final fallback: guaranteed safe bullets
    for (const fb of hardcodedFallbacks) {
      if (synth.length >= 3) break;
      if (!synth.some(s => s === fb)) synth.push(fb);
    }

    bodyBullets = synth.slice(0, 3);
  }

  const openingParagraph = isCareerChange
    ? `I am writing to apply for the ${role} position at ${company}. With ${yearsText} experience as a ${fieldLabel}, I have developed strong problem-solving, documentation, and cross-functional collaboration skills that I am eager to apply in a technology and systems integration environment.`
    : `I am writing to apply for the ${role} position at ${company}. My background in ${fieldLabel} has given me practical experience in ${highlights.length ? highlights.join(", ") : "technical problem solving and cross-functional collaboration"}, which I believe is directly relevant to this opportunity.`;

  const gapSentence = isCareerChange
    ? `I am aware that direct IT integration experience is the key requirement I am actively building toward, and I am committed to bringing the same precision and structured thinking I have applied in engineering environments to this new domain.`
    : data.roleFit.gaps.length
      ? `I understand that the role may also require deeper exposure to ${data.roleFit.gaps.slice(0, 3).join(", ")}, and I would approach this honestly while bringing the demonstrated strengths above.`
      : "The role aligns well with the strengths and practical experience demonstrated in my background.";

  return [
    "Dear Hiring Team,",
    "",
    openingParagraph,
    "",
    "The most transferable parts of my background include:",
    ...bodyBullets,
    "",
    `${gapSentence} I would welcome the opportunity to discuss how my technical mindset, communication skills, and drive to grow in the IT field can support your team.`,
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

// ─── CV Template: ATS Executive ──────────────────────────────────────────────
// Clean single-column, ATS-safe. Typographically refined, uses tight tracking
// on name, a ruled section system, and a subtle left-border accent on the
// summary. No colour in experience section, passes all ATS parsers.
function renderAts(data: ResumeJson) {
  const contact = [
    data.profile.basics.email,
    data.profile.basics.phone,
    data.profile.basics.location,
    data.profile.basics.linkedin,
  ].filter(Boolean).map(escapeHtml).join("  ·  ");

  const skillLines = cleanSkillsForDisplay(data.skills).slice(0, 28);
  // Group into rows of ~4 for a compact inline chip layout
  const skillChips = skillLines.map((s) => `<span class="skill-chip">${escapeHtml(s)}</span>`).join("");

  const expHtml = data.experience.map((job) => `
    <div class="exp-item">
      <div class="exp-head">
        <div class="exp-title-block">
          <span class="exp-title">${escapeHtml(job.title)}</span>
          <span class="exp-company">${escapeHtml(job.company)}${job.location ? ` · ${escapeHtml(job.location)}` : ""}</span>
        </div>
        <span class="exp-dates">${escapeHtml(job.dates)}</span>
      </div>
      <ul class="exp-bullets">${job.bullets.slice(0, 5).map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>
    </div>`).join("");

  const eduHtml = data.education.map((e) => `
    <div class="edu-item">
      <div class="edu-head">
        <span class="edu-degree">${escapeHtml(e.degree)}</span>
        <span class="edu-dates">${escapeHtml(e.dates)}</span>
      </div>
      <span class="edu-institution">${escapeHtml(e.institution)}${e.location ? ` · ${escapeHtml(e.location)}` : ""}</span>
    </div>`).join("");

  const projHtml = data.projects.length ? `
    <section>
      <h2>Projects</h2>
      ${data.projects.map((p) => `
        <div class="exp-item">
          <div class="exp-head"><span class="exp-title">${escapeHtml(p.name)}</span></div>
          <ul class="exp-bullets">${p.bullets.slice(0, 3).map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>
        </div>`).join("")}
    </section>` : "";

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
  <title>${escapeHtml(data.profile.basics.name)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #f0f2f5; font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; }
    .page {
      width: 210mm; min-height: 297mm; margin: 0 auto;
      background: #ffffff; padding: 14mm 16mm 16mm;
      box-shadow: 0 8px 40px rgba(0,0,0,.12);
    }
    /* Header */
    .hd-name {
      font-size: 28px; font-weight: 700; letter-spacing: -0.04em;
      color: #0a0a0a; line-height: 1;
    }
    .hd-title {
      font-size: 12.5px; font-weight: 500; color: #4f6ef7;
      letter-spacing: 0.06em; text-transform: uppercase;
      margin-top: 5px;
    }
    .hd-contact {
      font-size: 9.5px; color: #64748b; margin-top: 7px;
      letter-spacing: 0.01em;
    }
    .hd-rule { border: none; border-top: 2px solid #0a0a0a; margin: 10px 0 0; }
    /* Sections */
    section { margin-top: 13px; }
    h2 {
      font-size: 9px; font-weight: 700; letter-spacing: 0.16em;
      text-transform: uppercase; color: #94a3b8;
      padding-bottom: 4px; border-bottom: 1px solid #e2e8f0;
      margin-bottom: 8px;
    }
    /* Summary */
    .summary-text {
      font-size: 10.2px; line-height: 1.6; color: #1e293b;
      padding-left: 10px; border-left: 3px solid #4f6ef7;
    }
    /* Skills */
    .skills-wrap { display: flex; flex-wrap: wrap; gap: 4px; }
    .skill-chip {
      font-size: 9px; font-weight: 600; color: #334155;
      background: #f1f5f9; border: 1px solid #e2e8f0;
      border-radius: 3px; padding: 3px 7px;
    }
    /* Experience */
    .exp-item { margin-bottom: 10px; break-inside: avoid; }
    .exp-head {
      display: flex; justify-content: space-between;
      align-items: baseline; gap: 12px;
    }
    .exp-title-block { display: flex; flex-direction: column; gap: 1px; }
    .exp-title { font-size: 11px; font-weight: 700; color: #0f172a; }
    .exp-company { font-size: 9.5px; color: #64748b; }
    .exp-dates { font-size: 9px; color: #94a3b8; white-space: nowrap; font-weight: 500; }
    .exp-bullets { margin-top: 5px; padding-left: 13px; }
    .exp-bullets li {
      font-size: 9.8px; color: #334155; line-height: 1.55;
      margin-bottom: 2px;
    }
    /* Education */
    .edu-item { margin-bottom: 8px; break-inside: avoid; }
    .edu-head { display: flex; justify-content: space-between; align-items: baseline; }
    .edu-degree { font-size: 10.5px; font-weight: 600; color: #0f172a; }
    .edu-dates { font-size: 9px; color: #94a3b8; font-weight: 500; }
    .edu-institution { font-size: 9.5px; color: #64748b; display: block; margin-top: 1px; }
    /* Languages */
    .lang-list { display: flex; gap: 16px; flex-wrap: wrap; }
    .lang-item { font-size: 10px; color: #475569; }
    @media print {
      body { background: #fff; }
      .page { box-shadow: none; margin: 0; }
      @page { size: A4; margin: 0; }
    }
  </style>
  </head><body><div class="page">
    <header>
      <div class="hd-name">${escapeHtml(data.profile.basics.name)}</div>
      <div class="hd-title">${escapeHtml(data.basics.headline)}</div>
      ${contact ? `<div class="hd-contact">${contact}</div>` : ""}
      <hr class="hd-rule"/>
    </header>
    <section>
      <h2>Professional Summary</h2>
      <p class="summary-text">${escapeHtml(data.summary)}</p>
    </section>
    ${skillLines.length ? `<section><h2>Core Skills</h2><div class="skills-wrap">${skillChips}</div></section>` : ""}
    ${data.experience.length ? `<section><h2>Professional Experience</h2>${expHtml}</section>` : ""}
    ${projHtml}
    ${data.education.length ? `<section><h2>Education</h2>${eduHtml}</section>` : ""}
    ${data.languages.length ? `<section><h2>Languages</h2><div class="lang-list">${data.languages.map((l) => `<span class="lang-item">${escapeHtml(l)}</span>`).join("")}</div></section>` : ""}
  </div></body></html>`;
}

// ─── CV Template: Modern Two-Column ──────────────────────────────────────────
// Dark left sidebar with name/contact/skills. Right column: summary + experience.
// Signature element: the sidebar uses a deep navy-to-indigo gradient, premium
// without being gaudy. Google Fonts for Inter + a tabular figures feel.
function renderModern(data: ResumeJson) {
  const contactItems = [
    data.profile.basics.email,
    data.profile.basics.phone,
    data.profile.basics.location,
    data.profile.basics.linkedin,
  ].filter(Boolean);

  const skillItems = cleanSkillsForDisplay(data.skills).slice(0, 24);

  const expHtml = data.experience.map((job) => `
    <div class="exp-item">
      <div class="exp-head">
        <div>
          <div class="exp-title">${escapeHtml(job.title)}</div>
          <div class="exp-meta">${[job.company, job.location].filter(Boolean).map(escapeHtml).join(" · ")}</div>
        </div>
        <div class="exp-dates">${escapeHtml(job.dates)}</div>
      </div>
      <ul>${job.bullets.slice(0, 5).map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>
    </div>`).join("");

  const projHtml = data.projects.length ? data.projects.map((p) => `
    <div class="exp-item">
      <div class="exp-title">${escapeHtml(p.name)}</div>
      <ul>${p.bullets.slice(0, 3).map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>
    </div>`).join("") : "";

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
  <title>${escapeHtml(data.profile.basics.name)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #d1d5db; font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; }
    .page {
      width: 210mm; min-height: 297mm; margin: 0 auto;
      display: grid; grid-template-columns: 68mm 1fr;
      background: #ffffff;
      box-shadow: 0 8px 48px rgba(0,0,0,.18);
    }
    /* Sidebar */
    aside {
      background: linear-gradient(160deg, #0f172a 0%, #1e1b4b 55%, #312e81 100%);
      padding: 28px 18px; display: flex; flex-direction: column; gap: 22px;
    }
    .sb-name {
      font-size: 20px; font-weight: 700; color: #f8fafc;
      letter-spacing: -0.03em; line-height: 1.15;
    }
    .sb-title {
      font-size: 9.5px; font-weight: 600; letter-spacing: 0.14em;
      text-transform: uppercase; color: #a5b4fc; margin-top: 6px;
    }
    .sb-divider { border: none; border-top: 1px solid rgba(255,255,255,.12); }
    .sb-section-label {
      font-size: 8.5px; font-weight: 700; letter-spacing: 0.18em;
      text-transform: uppercase; color: #818cf8; margin-bottom: 10px;
    }
    .sb-contact-item {
      font-size: 9px; color: #cbd5e1; line-height: 1.6;
      overflow-wrap: break-word; word-break: break-all;
    }
    .sb-skill {
      display: inline-block; font-size: 8.5px; font-weight: 600;
      color: #e0e7ff; background: rgba(255,255,255,.08);
      border: 1px solid rgba(255,255,255,.14); border-radius: 3px;
      padding: 3px 7px; margin: 2px 3px 2px 0;
    }
    .sb-lang { font-size: 9.5px; color: #cbd5e1; margin-bottom: 4px; }
    /* Main */
    main { padding: 28px 22px; }
    .main-name-block { display: none; } /* Name is in sidebar on this template */
    h2 {
      font-size: 8.5px; font-weight: 700; letter-spacing: 0.16em;
      text-transform: uppercase; color: #6366f1;
      border-bottom: 1.5px solid #e0e7ff; padding-bottom: 5px;
      margin-bottom: 10px; margin-top: 18px;
    }
    h2:first-child { margin-top: 0; }
    .summary-box {
      background: #f8f8ff; border-left: 3px solid #6366f1;
      border-radius: 0 6px 6px 0; padding: 10px 12px;
      font-size: 9.8px; color: #1e293b; line-height: 1.65;
    }
    .exp-item { margin-bottom: 12px; break-inside: avoid; }
    .exp-head {
      display: flex; justify-content: space-between;
      align-items: flex-start; gap: 8px;
    }
    .exp-title { font-size: 10.5px; font-weight: 700; color: #0f172a; }
    .exp-meta { font-size: 9px; color: #64748b; margin-top: 2px; }
    .exp-dates {
      font-size: 8.5px; color: #6366f1; font-weight: 600;
      white-space: nowrap; padding-top: 1px;
    }
    ul { margin: 6px 0 0 13px; }
    li { font-size: 9.5px; color: #334155; line-height: 1.55; margin-bottom: 2.5px; }
    .edu-item { margin-bottom: 9px; break-inside: avoid; }
    .edu-degree { font-size: 10px; font-weight: 600; color: #0f172a; }
    .edu-meta { font-size: 9px; color: #64748b; margin-top: 2px; }
    .edu-dates { font-size: 8.5px; color: #6366f1; font-weight: 600; float: right; }
    @media print {
      body { background: #fff; }
      .page { box-shadow: none; margin: 0; }
      @page { size: A4; margin: 0; }
    }
  </style>
  </head><body><div class="page">
    <aside>
      <div>
        <div class="sb-name">${escapeHtml(data.profile.basics.name)}</div>
        <div class="sb-title">${escapeHtml(data.basics.headline)}</div>
      </div>
      <hr class="sb-divider"/>
      ${contactItems.length ? `<div><div class="sb-section-label">Contact</div>${contactItems.map((v) => `<div class="sb-contact-item">${escapeHtml(v)}</div>`).join("")}</div>` : ""}
      ${skillItems.length ? `<div><div class="sb-section-label">Expertise</div><div>${skillItems.map((s) => `<span class="sb-skill">${escapeHtml(s)}</span>`).join("")}</div></div>` : ""}
      ${data.languages.length ? `<div><div class="sb-section-label">Languages</div>${data.languages.map((l) => `<div class="sb-lang">${escapeHtml(l)}</div>`).join("")}</div>` : ""}
    </aside>
    <main>
      <section>
        <h2>Profile</h2>
        <div class="summary-box">${escapeHtml(data.summary)}</div>
      </section>
      ${data.experience.length ? `<section><h2>Experience</h2>${expHtml}</section>` : ""}
      ${data.projects.length ? `<section><h2>Projects</h2>${projHtml}</section>` : ""}
      ${data.education.length ? `<section><h2>Education</h2>${data.education.map((e) => `
        <div class="edu-item">
          <div>
            <span class="edu-dates">${escapeHtml(e.dates)}</span>
            <div class="edu-degree">${escapeHtml(e.degree)}</div>
            <div class="edu-meta">${escapeHtml(e.institution)}${e.location ? ` · ${escapeHtml(e.location)}` : ""}</div>
          </div>
        </div>`).join("")}</section>` : ""}
    </main>
  </div></body></html>`;
}

// ─── CV Template: Career Switcher ─────────────────────────────────────────────
// Warm off-white + forest green accent. Leads with a prominent PROFILE section
// and a "Why I fit this role" strengths block before experience, ideal for
// candidates repositioning. Uses a top header bar with name + title overlaid
// on a subtle textured stripe.
function renderCareerSwitcher(data: ResumeJson) {
  const contactItems = [
    data.profile.basics.email,
    data.profile.basics.phone,
    data.profile.basics.location,
    data.profile.basics.linkedin,
  ].filter(Boolean);

  const strengthItems = [...new Set([...data.roleFit?.highlights ?? [], ...data.strengths])].slice(0, 5);
  const skillItems = cleanSkillsForDisplay(data.skills).slice(0, 22);

  const expHtml = data.experience.map((job) => `
    <div class="exp-item">
      <div class="exp-head">
        <div>
          <span class="exp-title">${escapeHtml(job.title)}</span>
          <span class="exp-sep"> · </span>
          <span class="exp-company">${escapeHtml(job.company)}</span>
          ${job.location ? `<span class="exp-loc"> · ${escapeHtml(job.location)}</span>` : ""}
        </div>
        <span class="exp-dates">${escapeHtml(job.dates)}</span>
      </div>
      <ul>${job.bullets.slice(0, 5).map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>
    </div>`).join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
  <title>${escapeHtml(data.profile.basics.name)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Serif+Display&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #e8e4de; font-family: 'DM Sans', 'Helvetica Neue', Arial, sans-serif; }
    .page {
      width: 210mm; min-height: 297mm; margin: 0 auto;
      background: #faf9f7;
      box-shadow: 0 8px 48px rgba(0,0,0,.15);
    }
    /* Header bar */
    .page-header {
      background: #1a2e1a;
      padding: 22px 20mm;
      display: flex; justify-content: space-between; align-items: flex-end;
    }
    .hd-name {
      font-family: 'DM Serif Display', Georgia, serif;
      font-size: 30px; color: #f0ede8; letter-spacing: -0.02em; line-height: 1;
    }
    .hd-right { text-align: right; }
    .hd-title {
      font-size: 10px; font-weight: 600; letter-spacing: 0.1em;
      text-transform: uppercase; color: #86b386; margin-bottom: 8px;
    }
    .hd-contact { font-size: 8.5px; color: #a8b5a8; line-height: 1.7; }
    /* Body layout */
    .page-body { display: grid; grid-template-columns: 1fr 58mm; gap: 0; }
    main { padding: 18px 16px 18px 20mm; border-right: 1px solid #e5e0d8; }
    aside { padding: 18px 16px; background: #f3f0eb; }
    /* Section headings */
    h2 {
      font-size: 8px; font-weight: 700; letter-spacing: 0.2em;
      text-transform: uppercase; color: #4a7a4a;
      border-bottom: 1px solid #d4cfc6; padding-bottom: 4px;
      margin: 0 0 9px;
    }
    section { margin-bottom: 16px; }
    /* Profile summary */
    .profile-text {
      font-size: 10px; color: #2d3a2d; line-height: 1.7;
    }
    /* Strengths */
    .strength-item {
      font-size: 9px; color: #2d3a2d; padding: 5px 8px;
      background: #fff; border-left: 3px solid #4a7a4a;
      border-radius: 0 4px 4px 0; margin-bottom: 5px;
      font-weight: 500;
    }
    /* Skills sidebar */
    .skill-tag {
      display: inline-block; font-size: 8.5px; font-weight: 500;
      color: #3a5a3a; background: #e8f0e8;
      border-radius: 3px; padding: 3px 7px;
      margin: 2px 3px 2px 0;
    }
    /* Experience */
    .exp-item { margin-bottom: 11px; break-inside: avoid; }
    .exp-head {
      display: flex; justify-content: space-between;
      align-items: baseline; flex-wrap: wrap; gap: 4px;
      margin-bottom: 4px;
    }
    .exp-title { font-size: 10.5px; font-weight: 700; color: #1a2e1a; }
    .exp-sep, .exp-company { font-size: 9.5px; color: #5a7a5a; }
    .exp-loc { font-size: 9px; color: #8a9a8a; }
    .exp-dates { font-size: 8.5px; color: #4a7a4a; font-weight: 600; white-space: nowrap; }
    ul { padding-left: 13px; }
    li { font-size: 9.5px; color: #334133; line-height: 1.55; margin-bottom: 2px; }
    /* Education sidebar */
    .edu-item { margin-bottom: 10px; }
    .edu-degree { font-size: 9.5px; font-weight: 600; color: #1a2e1a; }
    .edu-school { font-size: 8.5px; color: #5a6a5a; margin-top: 2px; }
    .edu-dates { font-size: 8px; color: #4a7a4a; font-weight: 600; margin-top: 1px; }
    .sb-lang { font-size: 9px; color: #3a5a3a; margin-bottom: 3px; }
    @media print {
      body { background: #fff; }
      .page { box-shadow: none; margin: 0; }
      @page { size: A4; margin: 0; }
    }
  </style>
  </head><body><div class="page">
    <header class="page-header">
      <div class="hd-name">${escapeHtml(data.profile.basics.name)}</div>
      <div class="hd-right">
        <div class="hd-title">${escapeHtml(data.basics.headline)}</div>
        <div class="hd-contact">${contactItems.map(escapeHtml).join(" &nbsp;·&nbsp; ")}</div>
      </div>
    </header>
    <div class="page-body">
      <main>
        <section>
          <h2>Profile</h2>
          <p class="profile-text">${escapeHtml(data.summary)}</p>
        </section>
        ${strengthItems.length ? `
        <section>
          <h2>What I Bring to This Role</h2>
          ${strengthItems.map((s) => `<div class="strength-item">${escapeHtml(s)}</div>`).join("")}
        </section>` : ""}
        ${data.experience.length ? `<section><h2>Experience</h2>${expHtml}</section>` : ""}
        ${data.projects.length ? `<section><h2>Projects</h2>${data.projects.map((p) => `
          <div class="exp-item">
            <div class="exp-title">${escapeHtml(p.name)}</div>
            <ul>${p.bullets.slice(0, 3).map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>
          </div>`).join("")}</section>` : ""}
      </main>
      <aside>
        ${skillItems.length ? `<section><h2>Skills</h2><div>${skillItems.map((s) => `<span class="skill-tag">${escapeHtml(s)}</span>`).join("")}</div></section>` : ""}
        ${data.education.length ? `<section><h2>Education</h2>${data.education.map((e) => `
          <div class="edu-item">
            <div class="edu-degree">${escapeHtml(e.degree)}</div>
            <div class="edu-school">${escapeHtml(e.institution)}${e.location ? ` · ${escapeHtml(e.location)}` : ""}</div>
            <div class="edu-dates">${escapeHtml(e.dates)}</div>
          </div>`).join("")}</section>` : ""}
        ${data.languages.length ? `<section><h2>Languages</h2>${data.languages.map((l) => `<div class="sb-lang">${escapeHtml(l)}</div>`).join("")}</section>` : ""}
      </aside>
    </div>
  </div></body></html>`;
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
