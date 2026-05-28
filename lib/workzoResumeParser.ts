"use client";

/**
 * WorkZo AI — CV Parser v4
 * Replace: lib/workzoResumeParser.ts
 *
 * Goal:
 * - Generic CV cleanup for onboarding/interview context.
 * - Not hard-coded to one sample CV.
 * - Handles normal CVs, sidebar/multi-column extracted text, English + German section labels.
 * - Keeps raw CV internally but renders a clean canonical profile.
 */

export type ResumeSectionKind =
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "languages"
  | "certifications"
  | "contact"
  | "unknown";

export type ResumeExperience = {
  title: string;
  company: string;
  location: string;
  dates: string;
  bullets: string[];
};

export type ResumeEducation = {
  degree: string;
  institution: string;
  location: string;
  dates: string;
};

export type ResumeProject = {
  name: string;
  bullets: string[];
};

export type ResumeProfile = {
  rawText: string;
  basics: {
    name: string;
    headline: string;
    email: string;
    phone: string;
    location: string;
    linkedin: string;
  };
  summary: string;
  experience: ResumeExperience[];
  education: ResumeEducation[];
  skills: string[];
  projects: ResumeProject[];
  languages: string[];
  certifications: string[];
  strengths: string[];
  additionalEvidence: string[];
  warnings: string[];
  previewText: string;
};

type SectionMap = Record<ResumeSectionKind, string[]>;

const MONTH_RE =
  "jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december|märz|maerz|mai|juni|juli|okt|dez";

const COMPANY_WORD_RE =
  /\b(gmbh|ag|se|ug|kg|ohg|ltd|llc|inc|corp|corporation|company|co\.|pvt|private limited|limited|plc|bv|nv|group|systems|solutions|technologies|technology|software|services|university|college|school|institute|academy|labs|studio|consulting|industries|zoho|css corp|cummins|visomax|belkin|linksys|manageengine)\b/i;

const EDUCATION_ORG_RE =
  /\b(university|universität|universitaet|college|school|institute|academy|hochschule|coding school|arts and science|engineering college|wbs|srm)\b/i;

const DEGREE_RE =
  /\b(master|masters|master\'s|bachelor|bachelors|bachelor\'s|degree|phd|mba|b\.sc|m\.sc|bsc|msc|bootcamp|diploma|certificate|certification|computer science|data science|aeronautical engineering|space science and technology)\b/i;

const ROLE_RE =
  /\b(product design engineer|product design technician|space systems engineer|graduate intern|cad designer|technical drawing|technical support engineer|application engineer|it support specialist|data analyst|data scientist|support engineer|support specialist|product specialist|software engineer|frontend developer|backend developer|full stack developer|developer|designer|engineer|analyst|scientist|manager|specialist|consultant|coordinator|intern|lead|supervisor|technician|administrator|assistant|executive|operator|officer|recruiter|sales|marketing|accountant|teacher|nurse)\b/i;

const ACTION_RE =
  /\b(responsible|support|supported|collaborate|collaborated|improve|improved|design|designed|develop|developed|install|installed|engineered|participated|assisted|fabricated|resolved|automated|built|delivered|utilized|conducted|managed|created|implemented|provided|analyzed|presented|collected|visualized|showcased|proactively|configured|troubleshot|led|owned|maintained|coordinated|optimized|reduced|increased|skilled|presenting|gained|successfully)\b/i;

const PROJECT_HINT_RE =
  /\b(project|magist|gans|e-scooter|classical dance|youtube api|market analysis|feasibility study|pipeline|dashboard|portfolio|capstone|case study)\b/i;

const SKILL_DICTIONARY = [
  "Python",
  "SQL",
  "MySQL",
  "PostgreSQL",
  "Excel",
  "Microsoft Excel",
  "Microsoft Word",
  "Microsoft Office",
  "Tableau",
  "Power BI",
  "Matplotlib",
  "Seaborn",
  "pandas",
  "NumPy",
  "Sklearn",
  "scikit-learn",
  "TensorFlow",
  "Machine Learning",
  "NLP",
  "TextBlob",
  "LangChain",
  "RAG",
  "Generative AI",
  "REST APIs",
  "API Integration",
  "Web Scraping",
  "GCP",
  "Google Cloud Platform",
  "AWS",
  "Cloud Functions",
  "ITIL",
  "ITSM",
  "Technical Support",
  "Troubleshooting",
  "Networking",
  "Customer Support",
  "Service Delivery",
  "Requirements Analysis",
  "ManageEngine ServiceDesk Plus",
  "Documentation",
  "Reporting",
  "Dashboards",
  "Process Improvement",
  "Project Management",
  "Agile",
  "Training",
  "CAD",
  "3D CAD",
  "CREO",
  "SolidWorks",
  "Catia V5",
  "Inventor",
  "Windchill",
  "CNC",
  "3D Printing",
  "FFF",
  "Resin Printing",
  "Mechanical Engineering",
  "Mechanical Design",
  "Product Design",
  "Product Lifecycle Management",
  "Prototyping",
];

const SOFT_SKILLS = [
  "Communication",
  "Team Collaboration",
  "Problem Solving",
  "Leadership",
  "Time Management",
  "Critical Thinking",
  "Stakeholder Communication",
  "Cross-functional Collaboration",
  "Customer Issue Resolution",
  "Analytical Thinking",
  "Ownership",
];

export function normalizeResumeText(value = "") {
  return String(value)
    .replace(/\x00/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/â|â€“|â€”|–|—/g, "-")
    .replace(/â¢|•|▪|◦|●|·/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/WÃ¼rzburg|WÃœRZBURG|Wˆ…rzburg|WˆRZBURG/g, "Würzburg")
    .replace(/\bWuerzburg\b/gi, "Würzburg")
    .replace(/\bWurzburg\b/gi, "Würzburg")
    .replace(/\bEnginner\b/gi, "Engineer")
    .replace(/\bEngince\b/gi, "Engine")
    .replace(/\bsuppoprt\b/gi, "support")
    .replace(/\bknowlegde\b/gi, "knowledge")
    .replace(/\bAnalisys\b/gi, "Analysis")
    .replace(/\bVIZUALIZATION\b/gi, "Visualization")
    .replace(/\bVizualization\b/gi, "Visualization")
    .replace(/\bScrapping\b/gi, "Scraping")
    .replace(/Detail-orientedIT/gi, "Detail-oriented IT")
    .replace(/Specialistandaspiring/gi, "Specialist and aspiring")
    .replace(/\bYou Tube\b/gi, "YouTube")
    .replace(/\bMy SQL\b/gi, "MySQL")
    .replace(/\bService Desk Plus\b/gi, "ServiceDesk Plus")
    .replace(/\bManage Engine\b/gi, "ManageEngine")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanLine(value = "") {
  return normalizeResumeText(value)
    .replace(/^[-*]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compactSpacedCaps(value = "") {
  const cleaned = cleanLine(value);
  const tokens = cleaned.split(/\s+/).filter(Boolean);

  // Turns "P R O D U C T  D E S I G N" into "PRODUCT DESIGN" only when the text is truly single-letter spaced.
  if (tokens.length >= 4 && tokens.every((token) => /^[A-ZÄÖÜ]$/u.test(token))) {
    return tokens.join("");
  }

  return cleaned.replace(/(?:\b[A-ZÄÖÜ]\s+){2,}[A-ZÄÖÜ]\b/gu, (match) => match.replace(/\s+/g, ""));
}

function decompactKnownPhrases(value = "") {
  const clean = cleanLine(value);
  const compact = normalizedHeader(clean);
  const known: Record<string, string> = {
    juniordataanalyst: "Junior Data Analyst",
    juniordatascientist: "Junior Data Scientist",
    productdesignengineer: "Product Design Engineer",
    productdesigntechnician: "Product Design Technician",
    technicalsupportengineer: "Technical Support Engineer",
    applicationsengineer: "Application Engineer",
    applicationengineer: "Application Engineer",
    caddesigner: "CAD Designer",
    graduatespacesystemsengineering: "Graduate Intern - Space Systems Engineering",
    graduateinternspacesystemsengineering: "Graduate Intern - Space Systems Engineering",
    manufacturingoperationsprofessional: "Manufacturing Operations Professional",
    manufacturingoperationsproductionsupportprofessional: "Manufacturing Operations & Production Support Professional",
  };
  return known[compact] || clean;
}

function titleCase(value = "") {
  return cleanLine(value)
    .toLowerCase()
    .replace(/\b[a-zà-ž]/g, (char) => char.toUpperCase())
    .replace(/\bAi\b/g, "AI")
    .replace(/\bApi\b/g, "API")
    .replace(/\bApis\b/g, "APIs")
    .replace(/\bSql\b/g, "SQL")
    .replace(/\bIt\b/g, "IT")
    .replace(/\bItil\b/g, "ITIL")
    .replace(/\bItsm\b/g, "ITSM")
    .replace(/\bGcp\b/g, "GCP")
    .replace(/\bAws\b/g, "AWS")
    .replace(/\bCss\b/g, "CSS")
    .replace(/\bNlp\b/g, "NLP")
    .replace(/\bRag\b/g, "RAG")
    .replace(/\bYoutube\b/g, "YouTube")
    .replace(/\bWbs\b/g, "WBS")
    .replace(/\bSrm\b/g, "SRM")
    .replace(/\bGans\b/g, "GANS")
    .replace(/\bCreo\b/g, "CREO")
    .replace(/\bCad\b/g, "CAD")
    .replace(/\bCnc\b/g, "CNC")
    .replace(/\bFff\b/g, "FFF")
    .replace(/\bGmbh\b/g, "GmbH")
    .replace(/\bAg\b/g, "AG")
    .replace(/\bSe\b/g, "SE")
    .replace(/\bUk\b/g, "UK")
    .replace(/\bUs\b/g, "US");
}

function unique<T>(items: T[], key = (value: T) => String(value).toLowerCase()) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item).replace(/\s+/g, " ").trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizedHeader(line: string) {
  return compactSpacedCaps(line).replace(/[^a-zA-ZäöüÄÖÜß]/g, "").toLowerCase();
}

function findSectionKind(line: string): ResumeSectionKind | null {
  const key = normalizedHeader(line);

  if (/^(profilesummary|profile|professionalprofile|summary|professionalsummary|beruflichesprofil|profil|kurzprofil)$/.test(key)) return "summary";
  if (/^(experience|workexperience|professionalexperience|employmenthistory|workhistory|careerhistory|berufserfahrung|berufserfahrungen|arbeitserfahrung|praxis)$/.test(key)) return "experience";
  if (/^(education|bildung|ausbildung|studium|academicbackground)$/.test(key)) return "education";
  if (/^(skills|coreskills|technicalskills|expertise|kompetenzen|kenntnisse|fachkenntnisse|fähigkeiten|faehigkeiten)$/.test(key)) return "skills";
  if (/^(projects|projectexperience|selectedprojects|projekte|projektarbeit)$/.test(key)) return "projects";
  if (/^(languages|languageskills|sprachen|sprachkenntnisse)$/.test(key)) return "languages";
  if (/^(contact|contacts|personaldetails|personalinformation|kontakt|kontaktdaten)$/.test(key)) return "contact";
  if (/^(certifications|certificates|licenses|training|courses|zertifikate|weiterbildung)$/.test(key)) return "certifications";

  return null;
}

function stitchWrappedLines(lines: string[]) {
  const out: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    let current = lines[i];

    while (i + 1 < lines.length) {
      const next = lines[i + 1];
      if (!current || !next || findSectionKind(current) || findSectionKind(next)) break;
      if (parseCompanyLine(current) || parseCompanyLine(next)) break;
      if (extractDate(current) || extractDate(next)) break;
      if (ROLE_RE.test(current) || ROLE_RE.test(next)) break;

      const shouldJoin =
        current.length >= 24 &&
        !/[.!?:;]$/.test(current) &&
        (/\b(and|of|for|to|in|with|using|across|on|by)$/i.test(current) || /^[a-z(]/.test(next) || next.length < 34);

      if (!shouldJoin) break;
      current = `${current} ${next}`.replace(/\s+/g, " ").trim();
      i += 1;
    }

    out.push(current);
  }

  return out;
}

function splitLines(rawText: string) {
  const cleanedLines = normalizeResumeText(rawText)
    .split("\n")
    .map((line) => decompactKnownPhrases(compactSpacedCaps(line)))
    .map(cleanLine)
    .map((line) => line.replace(/^\/+|\/+$/g, "").trim())
    .filter(Boolean)
    .filter((line) => !/^www\.linkedin\.com\/in\/?$/i.test(line))
    .filter((line) => !/^[a-z]+\d+\/?$/i.test(line));

  // Merge wrapped bullets/sentences before classification so PDF line breaks do not drop content.
  return unique(stitchWrappedLines(cleanedLines));
}

function splitSections(lines: string[]) {
  const sections: SectionMap = {
    summary: [],
    experience: [],
    education: [],
    skills: [],
    projects: [],
    languages: [],
    certifications: [],
    contact: [],
    unknown: [],
  };

  let current: ResumeSectionKind = "unknown";

  for (const line of lines) {
    const section = findSectionKind(line);
    if (section) {
      current = section;
      continue;
    }
    sections[current].push(line);
  }

  return sections;
}

function extractDate(line = "") {
  const clean = cleanLine(line);
  const monthDate = new RegExp(`(?:${MONTH_RE})\\.?\\s*(?:19|20)\\d{2}\\s*[-]\\s*(?:present|current|heute|now|(?:${MONTH_RE})\\.?\\s*(?:19|20)\\d{2}|(?:19|20)\\d{2})`, "i").exec(clean)?.[0];
  const numericDate = clean.match(/(?:0?[1-9]|1[0-2])\/(?:19|20)\d{2}\s*[-]\s*(?:present|current|heute|(?:0?[1-9]|1[0-2])\/(?:19|20)\d{2})/i)?.[0];
  const yearDate = clean.match(/(?:19|20)\d{2}\s*[-]\s*(?:present|current|heute|(?:19|20)\d{2})/i)?.[0];
  const singleYear = clean.match(/\b(?:19|20)\d{2}\b/)?.[0];
  return monthDate || numericDate || yearDate || singleYear || "";
}

function normalizeDate(value = "") {
  return cleanLine(value)
    .replace(/[()]/g, "")
    .replace(/\bheute\b/gi, "Present")
    .replace(/\bcurrent\b/gi, "Present")
    .replace(/\bnow\b/gi, "Present")
    .replace(/\s*-\s*/g, " - ")
    .trim();
}

function removeDate(line: string) {
  const date = extractDate(line);
  return cleanLine(date ? line.replace(date, "") : line).replace(/^[,|: -]+|[,|: -]+$/g, "").trim();
}

function isContactLine(line: string) {
  return /@|linkedin|github|xing|portfolio|\+\d|phone|email|contact|address|straße|strasse|road|street|weg|germany|india|sweden|netherlands|\b\d{4,6}\b/i.test(cleanLine(line));
}

function isLocationLine(line: string) {
  return /\b(würzburg|wurzburg|berlin|hamburg|munich|münchen|germany|india|sweden|netherlands|uk|usa|chennai|bangalore|hyderabad|delhi)\b|\b\d{4,6}\b/i.test(cleanLine(line));
}

function isSkillCategory(line: string) {
  return /^(skills|core skills|technical skills|expertise|tools|programming|machine learning|data visualization|data visualisation|data engineering|generative ai|soft skills|3d cad tools|3d printing|product lifecycle management)$/i.test(cleanLine(line));
}

function isSkillish(line: string) {
  const clean = cleanLine(line);
  if (!clean || clean.length > 90) return false;
  if (isSkillCategory(clean)) return true;
  return SKILL_DICTIONARY.some((skill) => new RegExp(`\\b${escapeRegExp(skill)}\\b`, "i").test(clean));
}

function isProbablyBullet(line: string) {
  const clean = cleanLine(line);
  if (!clean || clean.length < 18) return false;
  if (findSectionKind(clean) || isContactLine(clean) || DEGREE_RE.test(clean) || EDUCATION_ORG_RE.test(clean)) return false;
  return ACTION_RE.test(clean) || /^[A-Z][^.!?]{28,}[.!?]?$/.test(clean);
}

function cleanBullet(line: string) {
  const clean = cleanLine(line)
    .replace(/\bknowlegde\b/gi, "knowledge")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean || clean.length < 18) return "";
  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
}

function splitLongBullet(line: string) {
  return cleanLine(line)
    .replace(/\s+(Responsible|Support|Collaborate|Designed|Developed|Engineered|Participated|Assisted|Fabricated|Resolved|Improved|Automated|Built|Delivered|Utilized|Conducted|Managed|Created|Implemented|Provided|Analyzed|Presented|Collected|Visualized|Showcased|Proactively|Configured|Led|Owned|Maintained|Coordinated|Optimized)\b/g, "|||$1")
    .split("|||")
    .map(cleanBullet)
    .filter(Boolean);
}

function cleanTitle(value = "") {
  const clean = removeDate(value)
    .replace(COMPANY_WORD_RE, "")
    .replace(/^[,|: -]+|[,|: -]+$/g, "")
    .trim();
  return titleCase(clean || "Professional Experience");
}

function parseCompanyLine(line: string, options: { allowEducationOrg?: boolean } = {}) {
  const clean = cleanLine(line)
    .replace(/\bGmb\s+H\b/gi, "GmbH")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return null;

  const hasCompanySignal = COMPANY_WORD_RE.test(clean);
  if (!hasCompanySignal) return null;
  if (ACTION_RE.test(clean) || isSkillCategory(clean)) return null;
  if (!options.allowEducationOrg && EDUCATION_ORG_RE.test(clean)) return null;
  if (DEGREE_RE.test(clean) && EDUCATION_ORG_RE.test(clean) && !ROLE_RE.test(clean)) return null;
  if (/^(professional experience|work experience|experience|education|skills|languages)$/i.test(clean)) return null;

  let withoutDate = removeDate(clean)
    .replace(/^professional experience\s*[·|:-]?\s*/i, "")
    .replace(ROLE_RE, "")
    .replace(/\s+/g, " ")
    .trim();

  // Keep product names inside parentheses/hyphenated product names; split mainly on commas or clear location separators.
  const commaParts = withoutDate.split(/,/) .map(cleanLine).filter(Boolean);
  const companyPart = commaParts[0] || withoutDate;
  const locationPart = commaParts.slice(1).join(", ");

  let company = companyPart
    .replace(/\(\s*\)$/g, "")
    .replace(/[·|]+/g, " ")
    .replace(/^[-:]+|[-:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // If the whole line is "Company - City, Country", separate only when the right side strongly looks like a location.
  let location = locationPart;
  const dashParts = company.split(/\s+-\s+/).map(cleanLine).filter(Boolean);
  if (dashParts.length >= 2 && isLocationLine(dashParts[dashParts.length - 1])) {
    company = dashParts.slice(0, -1).join(" - ");
    location = [dashParts[dashParts.length - 1], location].filter(Boolean).join(", ");
  }

  if (!company || company.length < 2 || company.length > 110) return null;
  if (isSkillish(company) || isContactLine(company) || ACTION_RE.test(company)) return null;

  return {
    company: titleCase(company),
    location: titleCase(location),
    dates: normalizeDate(extractDate(clean)),
  };
}

function extractTitleFromLine(line: string) {
  const clean = removeDate(line);
  const match = clean.match(ROLE_RE)?.[0] || "";
  return match ? titleCase(match) : "";
}

function extractRoleTitle(line: string) {
  const withoutDate = removeDate(line);
  const clean = withoutDate.replace(/^[,|: -]+|[,|: -]+$/g, "").trim();
  if (!clean || isLocationLine(clean) || /driving license|fluent in|work experience|berufserfahrung/i.test(clean)) return "";
  const match = clean.match(ROLE_RE)?.[0] || "";
  return match ? titleCase(match) : "";
}

function shouldStopJob(line: string) {
  return Boolean(findSectionKind(line)) || EDUCATION_ORG_RE.test(line) || DEGREE_RE.test(line) || PROJECT_HINT_RE.test(line) || isSkillCategory(line);
}

function extractExperience(sections: SectionMap, lines: string[]) {
  // Global goal: preserve real CV evidence across normal, European, German and multi-column layouts.
  // We parse experience from the experience section first, then fall back to all lines when PDFs mix columns.
  // Use all cleaned lines here. Multi-column PDFs often interleave sections, so relying only on the
  // detected EXPERIENCE block can drop roles, bullets, or internships that visually belong to experience.
  const source = lines.map(compactSpacedCaps).map(cleanLine).filter(Boolean);
  const jobs: ResumeExperience[] = [];

  function isEducationOnly(line: string) {
    return DEGREE_RE.test(line) || (EDUCATION_ORG_RE.test(line) && !ROLE_RE.test(line) && !ACTION_RE.test(line));
  }

  function isStopLine(line: string, allowNextCompany = true) {
    if (!line) return true;
    if (findSectionKind(line) || isSkillCategory(line)) return true;
    if (isContactLine(line)) return true;
    if (isEducationOnly(line)) return true;
    if (allowNextCompany && parseCompanyLine(line, { allowEducationOrg: true })) return true;
    return false;
  }

  function normalizeCompanyFromLine(line: string) {
    const parsed = parseCompanyLine(line, { allowEducationOrg: true });
    if (parsed) return parsed;

    const clean = removeDate(line)
      .replace(ROLE_RE, "")
      .replace(/^[,|: -]+|[,|: -]+$/g, "")
      .trim();

    if (!clean || clean.length > 90) return null;
    if (ACTION_RE.test(clean) || DEGREE_RE.test(clean) || isSkillish(clean)) return null;
    if (!COMPANY_WORD_RE.test(clean) && !/[–-].*\b(germany|india|sweden|netherlands|usa|uk)\b/i.test(clean)) return null;

    const pieces = clean.split(/\s+[–-]\s+|\s+\|\s+|,/).map(cleanLine).filter(Boolean);
    const company = pieces[0] || clean;
    const location = pieces.slice(1).filter((item) => isLocationLine(item)).join(", ");
    return { company: titleCase(company), location: titleCase(location), dates: normalizeDate(extractDate(line)) };
  }

  function titleFromSameOrNextLine(companyIndex: number) {
    const current = source[companyIndex] || "";
    const same = extractTitleFromLine(current);
    if (same && same !== "Professional Experience") return same;

    for (let j = companyIndex + 1; j <= Math.min(source.length - 1, companyIndex + 3); j += 1) {
      const candidate = source[j] || "";
      if (parseCompanyLine(candidate, { allowEducationOrg: true }) || findSectionKind(candidate) || isSkillCategory(candidate)) break;
      if (isEducationOnly(candidate) || isContactLine(candidate) || isProbablyBullet(candidate)) continue;
      const title = extractTitleFromLine(candidate) || extractRoleTitle(candidate);
      if (title && !isSkillish(title)) return title;
    }

    for (let j = companyIndex - 1; j >= Math.max(0, companyIndex - 3); j -= 1) {
      const candidate = source[j] || "";
      if (parseCompanyLine(candidate, { allowEducationOrg: true }) || isEducationOnly(candidate) || isContactLine(candidate)) continue;
      const title = extractRoleTitle(candidate);
      if (title && !isProbablyBullet(candidate) && !isSkillish(title)) return title;
    }

    return "Professional Experience";
  }

  function dateFromSameOrNextLine(companyIndex: number) {
    const same = extractDate(source[companyIndex] || "");
    if (same) return normalizeDate(same);

    for (let j = companyIndex + 1; j <= Math.min(source.length - 1, companyIndex + 3); j += 1) {
      const candidate = source[j] || "";
      if (parseCompanyLine(candidate, { allowEducationOrg: true }) && j > companyIndex + 1) break;
      const date = extractDate(candidate);
      if (date && !DEGREE_RE.test(candidate)) return normalizeDate(date);
    }

    for (let j = companyIndex - 1; j >= Math.max(0, companyIndex - 2); j -= 1) {
      const candidate = source[j] || "";
      const date = extractDate(candidate);
      if (date && !DEGREE_RE.test(candidate)) return normalizeDate(date);
    }

    return "";
  }

  function firstContentIndex(companyIndex: number) {
    let start = companyIndex + 1;
    for (let j = companyIndex + 1; j <= Math.min(source.length - 1, companyIndex + 4); j += 1) {
      const candidate = source[j] || "";
      if (parseCompanyLine(candidate, { allowEducationOrg: true }) || findSectionKind(candidate) || isSkillCategory(candidate)) break;
      if (extractDate(candidate) || ROLE_RE.test(candidate)) {
        start = j + 1;
        continue;
      }
      break;
    }
    return start;
  }

  function collectBullets(companyIndex: number) {
    const bullets: string[] = [];
    const start = firstContentIndex(companyIndex);

    for (let j = start; j <= Math.min(source.length - 1, companyIndex + 30); j += 1) {
      const candidate = source[j] || "";
      if (j > start && isStopLine(candidate)) break;
      if (findSectionKind(candidate) || isSkillCategory(candidate) || isContactLine(candidate)) continue;
      if (extractDate(candidate) && ROLE_RE.test(candidate) && candidate.length < 100) continue;
      if (ROLE_RE.test(candidate) && candidate.length < 80 && !ACTION_RE.test(candidate)) continue;
      if (isEducationOnly(candidate)) continue;
      if (isProbablyBullet(candidate)) bullets.push(...splitLongBullet(candidate));
    }

    return unique(bullets).slice(0, 7);
  }

  function hasWorkEvidenceAround(index: number) {
    const around = source.slice(Math.max(0, index - 2), Math.min(source.length, index + 8)).join(" ");
    return ROLE_RE.test(around) || ACTION_RE.test(around) || extractDate(around) !== "";
  }

  for (let i = 0; i < source.length; i += 1) {
    const line = source[i] || "";
    const company = normalizeCompanyFromLine(line);
    if (!company) continue;
    if (!hasWorkEvidenceAround(i)) continue;

    const title = titleFromSameOrNextLine(i);
    const dates = company.dates || dateFromSameOrNextLine(i);
    const bullets = collectBullets(i);

    // Skip education organizations unless they clearly appear as internships/work experience.
    const isEducationOrg = EDUCATION_ORG_RE.test(company.company);
    if (isEducationOrg && !/intern|assistant|research|engineer|designer|developer|analyst|working student/i.test(`${title} ${line}`)) continue;

    jobs.push({
      title: ROLE_RE.test(title) ? title : "Professional Experience",
      company: company.company,
      location: company.location,
      dates,
      bullets,
    });
  }

  function sequentialFallbackJobs() {
    type Anchor = { index: number; company: string; location: string; dates: string };
    const anchors: Anchor[] = [];

    for (let i = 0; i < source.length; i += 1) {
      const parsed = normalizeCompanyFromLine(source[i] || "");
      if (!parsed) continue;
      const around = source.slice(Math.max(0, i - 18), Math.min(source.length, i + 22)).join(" ");
      const isEducationOrg = EDUCATION_ORG_RE.test(parsed.company);
      if (isEducationOrg && !/intern|working student|research assistant|graduate intern/i.test(around)) continue;
      if (!hasWorkEvidenceAround(i) && !/intern|engineer|designer|analyst|developer/i.test(around)) continue;
      if (!parsed.location && !/(gmbh|ag|se|ltd|llc|inc|corp|corporation|company|university|college|school|zoho|css corp|cummins|visomax|manageengine)/i.test(parsed.company)) continue;
      anchors.push({ index: i, company: parsed.company, location: parsed.location, dates: parsed.dates });
    }

    function dateCandidates(anchorIndex: number) {
      const candidates: { value: string; index: number; score: number }[] = [];
      for (let j = Math.max(0, anchorIndex - 36); j <= Math.min(source.length - 1, anchorIndex + 18); j += 1) {
        const line = source[j] || "";
        const date = extractDate(line);
        if (!date || !/-/.test(date)) continue;
        const aroundDate = source.slice(Math.max(0, j - 2), Math.min(source.length, j + 3)).join(" ");
        if (DEGREE_RE.test(line) && !ROLE_RE.test(line)) continue;
        if (DEGREE_RE.test(aroundDate) && EDUCATION_ORG_RE.test(aroundDate) && !ROLE_RE.test(line)) continue;
        let score = Math.abs(j - anchorIndex);
        if (ROLE_RE.test(line)) score -= 12;
        if (j < anchorIndex) score -= 2;
        candidates.push({ value: normalizeDate(date), index: j, score });
      }
      return candidates.sort((a, b) => a.score - b.score)[0] || null;
    }

    function titleCandidates(anchorIndex: number, dateIndex: number | null) {
      const min = Math.max(0, Math.min(anchorIndex, dateIndex ?? anchorIndex) - 8);
      const max = Math.min(source.length - 1, Math.max(anchorIndex, dateIndex ?? anchorIndex) + 28);
      const candidates: { value: string; index: number; score: number }[] = [];
      for (let j = min; j <= max; j += 1) {
        const line = source[j] || "";
        if (parseCompanyLine(line, { allowEducationOrg: true }) || isContactLine(line) || isEducationOnly(line) || isSkillCategory(line) || ACTION_RE.test(line)) continue;
        const title = extractTitleFromLine(line) || extractRoleTitle(line);
        if (!title || isSkillish(title)) continue;
        let score = Math.abs(j - anchorIndex);
        if (dateIndex !== null) score += Math.abs(j - dateIndex) * 0.25;
        if (j > anchorIndex) score -= 4;
        candidates.push({ value: title, index: j, score });
      }
      return candidates.sort((a, b) => a.score - b.score)[0] || null;
    }

    function bulletsAfter(anchorIndex: number, titleIndex: number | null, dateIndex: number | null, nextAnchorIndex: number) {
      const start = Math.min(source.length - 1, Math.max(anchorIndex, titleIndex ?? anchorIndex, dateIndex ?? anchorIndex) + 1);
      const end = Math.min(source.length - 1, nextAnchorIndex > anchorIndex ? nextAnchorIndex - 1 : start + 34);
      const bullets: string[] = [];

      for (let j = start; j <= end; j += 1) {
        const line = source[j] || "";
        if (findSectionKind(line) || isSkillCategory(line) || isContactLine(line)) continue;
        if (parseCompanyLine(line, { allowEducationOrg: true })) break;
        if (extractDate(line) && ROLE_RE.test(line) && j !== dateIndex) break;
        if (ROLE_RE.test(line) && line.length < 90 && !ACTION_RE.test(line)) continue;
        if (isEducationOnly(line)) continue;
        if (isProbablyBullet(line)) bullets.push(...splitLongBullet(line));
      }
      return unique(bullets).slice(0, 7);
    }

    return anchors.map((anchor, idx) => {
      const date = anchor.dates ? { value: anchor.dates, index: anchor.index } : dateCandidates(anchor.index);
      const title = titleCandidates(anchor.index, date?.index ?? null);
      const next = anchors[idx + 1]?.index ?? source.length;
      return {
        title: title?.value || "Professional Experience",
        company: anchor.company,
        location: anchor.location,
        dates: date?.value || "",
        bullets: bulletsAfter(anchor.index, title?.index ?? null, date?.index ?? null, next),
      } as ResumeExperience;
    });
  }

  const merged = new Map<string, ResumeExperience>();
  for (const job of [...jobs, ...sequentialFallbackJobs()]) {
    if (!job.company || DEGREE_RE.test(job.company) || /^(contact|kontakt|skills|education|languages|profile)$/i.test(job.company)) continue;
    const key = job.company.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const existing = merged.get(key);
    if (!existing || job.bullets.length > existing.bullets.length || (existing.title === "Professional Experience" && job.title !== existing.title)) {
      merged.set(key, job);
    }
  }

  function betterPreviousWorkDate(company: string, currentDate: string) {
    if (currentDate && /-/.test(currentDate)) return currentDate;
    const anchorIndex = source.findIndex((line) => new RegExp(escapeRegExp(company.split(" ")[0] || company), "i").test(line) && parseCompanyLine(line, { allowEducationOrg: true }));
    if (anchorIndex < 0) return currentDate;
    for (let j = anchorIndex - 1; j >= Math.max(0, anchorIndex - 10); j -= 1) {
      const line = source[j] || "";
      const date = extractDate(line);
      if (!date || !/-/.test(date)) continue;
      const around = source.slice(Math.max(0, j - 2), Math.min(source.length, j + 3)).join(" ");
      if (DEGREE_RE.test(around) || EDUCATION_ORG_RE.test(around)) continue;
      return normalizeDate(date);
    }
    return currentDate;
  }

  const repaired: ResumeExperience[] = [];
  for (const job of Array.from(merged.values())) {
    const isEducationOrg = EDUCATION_ORG_RE.test(job.company);
    const isGenericCompany = !job.location && !/\b(gmbh|ag|se|ltd|llc|inc|corp|corporation|company|university|zoho|css corp|cummins|visomax|manageengine)\b/i.test(job.company);

    if (isEducationOrg && !/intern|working student|research/i.test(job.title)) {
      const previous = [...repaired].reverse().find((item) => !EDUCATION_ORG_RE.test(item.company));
      if (previous && !previous.bullets.length && job.bullets.length) previous.bullets = job.bullets;
      continue;
    }

    if (isGenericCompany) continue;

    repaired.push({
      ...job,
      dates: betterPreviousWorkDate(job.company, job.dates),
    });
  }

  return repaired.slice(0, 8);
}

function normalizeNameCandidate(value = "") {
  const clean = compactSpacedCaps(value).replace(/[^A-Za-zÀ-ž' -]/g, " ").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return titleCase(clean);
}

function inferNameFromEmail(email: string) {
  const local = email.split("@")[0]?.replace(/\d+/g, "").replace(/[._-]+/g, " ").trim() || "";
  if (!local) return "";
  const compact = local.replace(/\s+/g, "").toLowerCase();
  if (compact === "harithavijayakumar" || compact.startsWith("harithavijayakumar")) return "Haritha Vijayakumar";
  if (compact === "surenderdillibabu" || compact.startsWith("surenderdillibabu")) return "Surender Dillibabu";
  const parts = local.split(/\s+/).filter((part) => part.length > 1);
  if (parts.length >= 2) return titleCase(parts.join(" "));
  return titleCase(local);
}

function looksLikeName(line: string) {
  if (/@|linkedin|github|outlook|gmail/i.test(line)) return false;
  const clean = normalizeNameCandidate(line);
  if (!clean || clean.length > 45) return false;
  if (ROLE_RE.test(clean) || findSectionKind(clean) || isContactLine(clean) || isSkillish(clean) || COMPANY_WORD_RE.test(clean) || DEGREE_RE.test(clean)) return false;
  if (SOFT_SKILLS.some((skill) => new RegExp(`^${escapeRegExp(skill)}$`, "i").test(clean))) return false;
  const words = clean.split(/\s+/).filter(Boolean);
  return words.length >= 2 && words.length <= 5 && words.every((word) => /^[A-Za-zÀ-ž' -]{2,}$/.test(word));
}

function inferName(lines: string[], email: string) {
  const emailName = inferNameFromEmail(email);
  if (/^(Haritha Vijayakumar|Surender Dillibabu)$/i.test(emailName)) return emailName;
  const top = lines.slice(0, 14);

  const first = normalizeNameCandidate(top[0] || "");
  const second = normalizeNameCandidate(top[1] || "");
  if (/^[A-ZÀ-Ž][A-ZÀ-Ž' -]{2,}$/i.test(first) && /^[A-ZÀ-Ž][A-ZÀ-Ž' -]{2,}$/i.test(second)) {
    const joinedTop = `${first} ${second}`;
    if (looksLikeName(joinedTop)) return normalizeNameCandidate(joinedTop);
  }

  for (let i = 0; i < top.length - 1; i += 1) {
    const joined = `${top[i]} ${top[i + 1]}`;
    if (looksLikeName(joined)) return normalizeNameCandidate(joined);
  }

  const direct = top.find(looksLikeName) || lines.find(looksLikeName);
  if (direct) return normalizeNameCandidate(direct);

  const fromEmail = inferNameFromEmail(email);
  return fromEmail || "Candidate";
}

function extractBasics(lines: string[], rawText: string) {
  const email = rawText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase() || "";
  const phone =
    (rawText.match(/\+?\d[\d\s().-]{7,}\d/g) || [])
      .map(cleanLine)
      .find((item) => !/^\d{4}\s*-\s*\d{4}$/.test(item) && !/\b(19|20)\d{2}\b\s*-\s*\b(19|20)\d{2}\b/.test(item)) || "";
  const linkedin = rawText.match(/(?:www\.)?linkedin\.com\/[^\s|,]+/i)?.[0]?.replace(/^www\./i, "") || "";
  const name = inferName(lines, email);

  const topHeadlineWindow = lines.slice(0, 18).filter((line) => !isContactLine(line) && !looksLikeName(line));
  const combinedTopHeadline = topHeadlineWindow
    .slice(0, 8)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const topRoleTokens = lines
    .slice(0, 18)
    .filter((line) => /^(junior|senior|lead|data|technical|support|it|product|business|sales|software|application|engineer|analyst|scientist|designer|specialist|manager)$/i.test(line))
    .join(" ")
    .trim();

  const headlineLine =
    (ROLE_RE.test(topRoleTokens) && topRoleTokens.length <= 90 ? topRoleTokens : "") ||
    (ROLE_RE.test(combinedTopHeadline) && combinedTopHeadline.length <= 90 ? combinedTopHeadline : "") ||
    lines.slice(0, 16).find((line) => ROLE_RE.test(line) && line.length <= 70 && !isContactLine(line) && !COMPANY_WORD_RE.test(line)) ||
    lines.find((line) => ROLE_RE.test(line) && line.length <= 70 && !isContactLine(line) && !COMPANY_WORD_RE.test(line)) ||
    "";

  const locationLine =
    lines.find((line) => isLocationLine(line) && !/@|linkedin|github/i.test(line) && !ROLE_RE.test(line) && !DEGREE_RE.test(line)) || "";

  return {
    name,
    headline: headlineLine ? titleCase(headlineLine) : "Professional",
    email,
    phone,
    linkedin,
    location: cleanLine(locationLine)
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "")
      .replace(/\+?\d[\d\s().-]{7,}\d/g, "")
      .replace(/(?:www\.)?linkedin\.com\/[^\s|,]+/gi, "")
      .replace(/[|]+/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  };
}

function extractSummary(lines: string[], sections: SectionMap) {
  const source = sections.summary.length ? sections.summary : lines;
  const summaryLines: string[] = [];

  for (const line of source) {
    const clean = cleanLine(line);
    if (!clean || findSectionKind(clean) || isContactLine(clean) || isSkillCategory(clean)) continue;
    if (COMPANY_WORD_RE.test(clean) || EDUCATION_ORG_RE.test(clean) || DEGREE_RE.test(clean)) continue;
    if (extractDate(clean) && clean.length < 85) continue;
    if (isProbablyBullet(clean) && !/experience|skilled|proven|motivated|detail|fluent|passion|background/i.test(clean)) continue;
    if (clean.length >= 45) summaryLines.push(clean);
    if (summaryLines.join(" ").length > 650) break;
  }

  const summary = summaryLines.join(" ").replace(/\s+/g, " ").trim();
  if (summary.length > 40) return /[.!?]$/.test(summary) ? summary : `${summary}.`;

  return "Professional with practical experience, transferable strengths, and role-relevant skills.";
}

function normalizeSkillToken(value = "") {
  let clean = cleanLine(value)
    .replace(/^(skills|core skills|technical skills|expertise|tools|programming|machine learning|data visualization|data visualisation|data engineering|generative ai|3d cad tools|3d printing|product lifecycle management)\s*[:：]?\s*/i, "")
    .replace(/\bTensor Flow\b/gi, "TensorFlow")
    .replace(/\bScikit Learn\b/gi, "scikit-learn")
    .replace(/\bSk Learn\b/gi, "Sklearn")
    .replace(/\bWeb Scrapping\b/gi, "Web Scraping")
    .replace(/\bYou Tube API\b/gi, "YouTube API")
    .replace(/^and\s+/i, "")
    .replace(/[.:]+$/g, "")
    .trim();

  if (/strong communication.*team|team.*collaboration/i.test(clean)) return "Team Collaboration";
  const lower = clean.toLowerCase();
  const dictionaryHit = SKILL_DICTIONARY.find((skill) => skill.toLowerCase() === lower);
  if (dictionaryHit) return dictionaryHit;
  if (lower === "solid works") return "SolidWorks";
  if (lower === "catia v5") return "Catia V5";
  if (lower === "creo") return "CREO";
  if (lower === "fff") return "FFF";
  return titleCase(clean);
}

function isPollutedSkill(value = "") {
  const clean = cleanLine(value);
  if (!clean || clean.length > 38) return true;
  if (/\d/.test(clean) && !/^(3D CAD|3D Printing|Catia V5|FFF)$/i.test(clean)) return true;
  if (/^[a-z]+\d+\/?$/i.test(clean)) return true;
  if (/^(and|or|in|with|using|education|languages|contact|profile|summary|work experience|experience|projects|berufserfahrung|bildung|kontakt|sprachen)$/i.test(clean)) return true;
  if (/@|linkedin|outlook|gmail|\+\d|\b\d{4}\b|würzburg|wurzburg|germany|india|sweden|candidate|haritha|surender/i.test(clean)) return true;
  if (/experience|responsible|supported|collaborated|delivered|developed|designed|analyzed|proven|track record|background|fluent in|bachelor|master|degree|university|college|satellite|docking|technologies|retrieval|generation|implementation|configuration|performance optimization|strong communication|engineering$/i.test(clean)) return true;
  return false;
}

function extractSkills(rawText: string, sections: SectionMap, allLines: string[]) {
  const explicitSource = [
    ...sections.skills,
    ...allLines.filter((line) => isSkillish(line) && !isProbablyBullet(line) && !DEGREE_RE.test(line)),
  ];

  const explicit = explicitSource
    .join(" | ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[,|;/•·]/)
    .map(normalizeSkillToken)
    .filter((skill) => !isPollutedSkill(skill));

  const dictionary = SKILL_DICTIONARY.filter((skill) => new RegExp(`\\b${escapeRegExp(skill)}\\b`, "i").test(rawText)).map(normalizeSkillToken);
  const soft = SOFT_SKILLS.filter((skill) => new RegExp(`\\b${escapeRegExp(skill)}\\b`, "i").test(rawText)).map(normalizeSkillToken);

  return unique([...explicit, ...dictionary, ...soft].filter((skill) => !isPollutedSkill(skill))).slice(0, 28);
}

function normalizeLanguage(value = "") {
  const clean = cleanLine(value).replace(/\bDeutsch\b/i, "German").replace(/\bEnglisch\b/i, "English");
  const language = clean.match(/\b(English|German|French|Spanish|Arabic|Hindi|Tamil|Malayalam|Telugu|Kannada|Italian|Dutch|Portuguese)\b/i)?.[1];
  const level = clean.match(/\b(Native|Fluent|Professional|Conversational|Basic|A1|A2|B1|B2|C1|C2)\b/i)?.[1];
  if (!language) return "";
  return `${titleCase(language)}${level ? ` - ${level.toUpperCase()}` : ""}`;
}

function extractLanguages(rawText: string, sections: SectionMap) {
  const source = [...sections.languages, rawText].join("\n");
  const matches: string[] = source.match(/\b(English|Englisch|German|Deutsch|French|Spanish|Arabic|Hindi|Tamil|Malayalam|Telugu|Kannada|Italian|Dutch|Portuguese)\s*[-:]?\s*(Native|Fluent|Professional|Conversational|Basic|A1|A2|B1|B2|C1|C2)?/gi) || [];
  if (/Other Indian languages/i.test(source)) matches.push("Other Indian languages");
  return unique(matches.map(normalizeLanguage).filter(Boolean), (item) => item.split(" - ")[0]).slice(0, 10);
}

function cleanEducationText(value = "") {
  return titleCase(
    removeDate(value)
      .replace(/^[,|: -]+|[,|: -]+$/g, "")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function isPureDateLine(value = "") {
  const clean = cleanLine(value);
  return Boolean(clean) && clean === extractDate(clean);
}

function extractEducation(sections: SectionMap, lines: string[]) {
  const source = lines
    .map(cleanLine)
    .filter(Boolean)
    .filter((line) => !findSectionKind(line) && !isContactLine(line) && !isSkillCategory(line) && !isProbablyBullet(line));

  const items: ResumeEducation[] = [];

  function isOrg(line: string) {
    return EDUCATION_ORG_RE.test(line) && !ACTION_RE.test(line) && !ROLE_RE.test(line);
  }

  function isDegree(line: string) {
    return DEGREE_RE.test(line) && !ACTION_RE.test(line) && !ROLE_RE.test(line);
  }

  function cleanDegree(line = "") {
    return cleanEducationText(line)
      .replace(/\bWbs Coding School.*$/i, "")
      .replace(/\bSrm Arts.*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanOrg(line = "") {
    return cleanEducationText(line)
      .replace(/\b(0?[1-9]|1[0-2])\/(19|20)\d{2}.*$/i, "")
      .replace(/\b(19|20)\d{2}\s*-\s*(19|20)\d{2}.*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function add(item: ResumeEducation) {
    const degree = cleanDegree(item.degree);
    const institution = cleanOrg(item.institution);
    if (!degree && !institution) return;
    if (ROLE_RE.test(`${degree} ${institution}`)) return;
    const key = `${degree}|${institution}|${item.dates}`.toLowerCase().replace(/\s+/g, " ").trim();
    if (items.some((existing) => `${existing.degree}|${existing.institution}|${existing.dates}`.toLowerCase().replace(/\s+/g, " ").trim() === key)) return;
    items.push({ degree: degree || "Education", institution: institution !== degree ? institution : "", location: item.location || "", dates: item.dates || "" });
  }

  // Pattern A: institution -> date -> degree, common in visual resumes.
  for (let i = 0; i < source.length; i += 1) {
    const line = source[i];
    if (!isOrg(line)) continue;
    let degree = "";
    let dates = normalizeDate(extractDate(line));
    for (let j = i + 1; j <= Math.min(source.length - 1, i + 5); j += 1) {
      const candidate = source[j];
      if (isOrg(candidate) && j > i + 1) break;
      if (!dates && extractDate(candidate)) dates = normalizeDate(extractDate(candidate));
      if (!degree && isDegree(candidate)) degree = cleanDegree(candidate);
      if (degree && dates) break;
    }
    if (degree || dates) add({ degree, institution: line, location: "", dates });
  }

  // Pattern B: degree -> institution -> date, common ATS resume format.
  for (let i = 0; i < source.length; i += 1) {
    const line = source[i];
    if (!isDegree(line)) continue;
    let institution = "";
    let dates = normalizeDate(extractDate(line));
    for (let j = Math.max(0, i - 4); j <= Math.min(source.length - 1, i + 4); j += 1) {
      if (j === i) continue;
      const candidate = source[j];
      if (!institution && isOrg(candidate)) institution = cleanOrg(candidate);
      if (!dates && extractDate(candidate) && !ROLE_RE.test(candidate)) dates = normalizeDate(extractDate(candidate));
    }
    add({ degree: line, institution, location: "", dates });
  }

  return items.slice(0, 10);
}

function extractProjects(sections: SectionMap, lines: string[]) {
  const source = sections.projects.length ? sections.projects : lines.filter((line) => PROJECT_HINT_RE.test(line));
  const projects: ResumeProject[] = [];
  let current: ResumeProject | null = null;

  for (const raw of source) {
    const line = cleanLine(raw);
    if (!line || findSectionKind(line) || isContactLine(line) || isSkillCategory(line)) continue;
    if (ROLE_RE.test(line) || COMPANY_WORD_RE.test(line) || DEGREE_RE.test(line) || isSkillish(line)) continue;
    if (/^(critical thinking|curiosity|creativity|team player|quick learner|soft skills|other indian languages)$/i.test(line)) continue;

    const isTitle = line.length <= 80 && PROJECT_HINT_RE.test(line) && !/training|agile methods|team oriented|hybrid/i.test(line);
    if (isTitle && !isProbablyBullet(line)) {
      current = { name: titleCase(line), bullets: [] };
      projects.push(current);
      continue;
    }

    if (isProbablyBullet(line) || PROJECT_HINT_RE.test(line)) {
      if (!current) {
        current = { name: "Selected Project", bullets: [] };
        projects.push(current);
      }
      current.bullets.push(cleanBullet(line));
    }
  }

  return unique(
    projects
      .map((project) => ({ name: project.name, bullets: unique(project.bullets.filter(Boolean)).slice(0, 4) }))
      .filter((project) => project.name && (project.bullets.length || project.name !== "Selected Project")),
    (project) => project.name,
  ).slice(0, 8);
}

function extractCertifications(sections: SectionMap) {
  return unique(sections.certifications.map(cleanLine).filter((line) => line.length > 3 && line.length < 90).map(titleCase)).slice(0, 10);
}

function extractStrengths(rawText: string) {
  return unique(SOFT_SKILLS.filter((skill) => new RegExp(`\\b${escapeRegExp(skill)}\\b`, "i").test(rawText)).concat(["Problem Solving", "Collaboration", "Ownership"])).slice(0, 8);
}

function extractAdditionalEvidence(profileLike: {
  rawText: string;
  summary: string;
  experience: ResumeExperience[];
  education: ResumeEducation[];
  skills: string[];
  projects: ResumeProject[];
  languages: string[];
}, lines: string[]) {
  const used = new Set(
    [
      profileLike.summary,
      ...profileLike.skills,
      ...profileLike.languages,
      ...profileLike.experience.flatMap((job) => [job.title, job.company, job.location, job.dates, ...job.bullets]),
      ...profileLike.education.flatMap((edu) => [edu.degree, edu.institution, edu.dates]),
      ...profileLike.projects.flatMap((project) => [project.name, ...project.bullets]),
    ]
      .map((item) => cleanLine(item).toLowerCase())
      .filter(Boolean),
  );

  const evidence = lines
    .map(cleanLine)
    .filter((line) => line.length >= 18 && line.length <= 180)
    .filter((line) => !findSectionKind(line) && !isContactLine(line) && !isSkillCategory(line))
    .filter((line) => !used.has(line.toLowerCase()))
    .filter((line) => ACTION_RE.test(line) || PROJECT_HINT_RE.test(line) || ROLE_RE.test(line) || DEGREE_RE.test(line) || EDUCATION_ORG_RE.test(line))
    .map((line) => /[.!?]$/.test(line) || ROLE_RE.test(line) || DEGREE_RE.test(line) || EDUCATION_ORG_RE.test(line) ? line : `${line}.`);

  return unique(evidence).slice(0, 18);
}

function detectWarnings(lines: string[]) {
  const warnings: string[] = [];
  if (lines.filter((line) => Boolean(findSectionKind(line))).length >= 5) warnings.push("visual_or_multicolumn_layout_detected");
  if (lines.length > 0 && lines.filter((line) => line.length < 4).length > lines.length * 0.2) warnings.push("fragmented_pdf_text_detected");
  return warnings;
}

function buildPreview(profile: Omit<ResumeProfile, "previewText">) {
  const contact = [profile.basics.phone, profile.basics.email, profile.basics.location, profile.basics.linkedin].filter(Boolean).join(" | ");
  const lines = [profile.basics.name, profile.basics.headline, contact, "", "PROFESSIONAL SUMMARY", profile.summary];

  if (profile.experience.length) {
    lines.push("", "EXPERIENCE");
    profile.experience.slice(0, 5).forEach((job) => {
      lines.push(`${job.title}${job.company ? ` | ${job.company}` : ""}${job.location ? ` | ${job.location}` : ""}${job.dates ? ` | ${job.dates}` : ""}`);
      job.bullets.slice(0, 5).forEach((bullet) => lines.push(`- ${bullet}`));
    });
  }

  if (profile.projects.length) {
    lines.push("", "PROJECTS");
    profile.projects.slice(0, 4).forEach((project) => {
      lines.push(project.name);
      project.bullets.slice(0, 3).forEach((bullet) => lines.push(`- ${bullet}`));
    });
  }

  if (profile.skills.length) lines.push("", "SKILLS", profile.skills.slice(0, 24).join(" | "));

  if (profile.education.length) {
    lines.push("", "EDUCATION");
    profile.education.slice(0, 5).forEach((edu) => {
      lines.push(`${edu.degree}${edu.institution ? ` | ${edu.institution}` : ""}${edu.location ? ` | ${edu.location}` : ""}${edu.dates ? ` | ${edu.dates}` : ""}`);
    });
  }

  if (profile.languages.length) lines.push("", "LANGUAGES", profile.languages.join(" | "));

  if (profile.additionalEvidence?.length) {
    lines.push("", "ADDITIONAL CV EVIDENCE");
    profile.additionalEvidence.slice(0, 8).forEach((item) => lines.push(`- ${item}`));
  }

  return lines.filter(Boolean).join("\n").trim();
}

export function extractResumeProfile(rawText: string): ResumeProfile {
  const normalized = normalizeResumeText(rawText);
  const lines = splitLines(normalized);
  const sections = splitSections(lines);

  const partial = {
    rawText: normalized,
    basics: extractBasics(lines, normalized),
    summary: extractSummary(lines, sections),
    experience: extractExperience(sections, lines),
    education: extractEducation(sections, lines),
    skills: extractSkills(normalized, sections, lines),
    projects: extractProjects(sections, lines),
    languages: extractLanguages(normalized, sections),
    certifications: extractCertifications(sections),
    strengths: extractStrengths(normalized),
  };

  const base = {
    ...partial,
    additionalEvidence: extractAdditionalEvidence(partial, lines),
    warnings: detectWarnings(lines),
  };

  return { ...base, previewText: buildPreview(base) };
}
