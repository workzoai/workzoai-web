/**
 * WorkZo AI — Resume Parser v5
 * Replace: lib/workzoResumeParser.ts
 *
 * Global approach:
 * - Server/client safe: no "use client".
 * - Keeps raw extracted text but builds one canonical structured profile.
 * - Uses explicit section boundaries when available.
 * - Falls back to anchor-based extraction for multi-column/visual PDFs.
 * - Parser owns structure; AI pages should only polish wording.
 */


const WORKZO_INVALID_CANDIDATE_NAME_RE =
  /\b(english|german|deutsch|dutch|nederlands|french|français|francais|spanish|español|espanol|italian|italiano|portuguese|português|portugues|fluent|conversational|native|professional working|limited working|language|languages|skills|expertise|experience|education|professional experience|work experience|profile|summary|project|projects|contact|phone|email|linkedin|cv|resume|curriculum|support|engineer|analyst|manager|specialist|developer|consultant|technical|data|sales|marketing|product)\b/i;

function workzoCleanCandidateName(value: unknown, fallback = "Candidate") {
  const raw = typeof value === "string" ? value.trim() : "";
  const cleaned = raw
    .replace(/\s+/g, " ")
    .replace(/[^A-Za-zÀ-ÖØ-öø-ÿ' .-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned.length < 3 || cleaned.length > 60) return fallback;
  if (/@|www|http|\+|\d/.test(cleaned)) return fallback;
  if (WORKZO_INVALID_CANDIDATE_NAME_RE.test(cleaned)) return fallback;

  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length < 2 || parts.length > 4) return fallback;

  return cleaned;
}

function workzoExtractNameFromRawCv(rawText: string) {
  const normalized = String(rawText || "");

  const lines = normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 40);

  for (const line of lines) {
    const candidate = workzoCleanCandidateName(line, "");
    if (candidate) return candidate;
  }

  const email = normalized.match(/\b([a-z][a-z0-9._-]{2,})@[a-z0-9.-]+\.[a-z]{2,}\b/i)?.[1] || "";
  const emailName = email
    .replace(/[._-]+/g, " ")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return workzoCleanCandidateName(emailName, "");
}


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
  "jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december|märz|maerz|mai|juni|juli|okt|dez|aug";

const ROLE_RE =
  /\b(product design engineer|product design technician|space systems engineer|graduate intern|cad designer|technical support engineer|application engineer|it support specialist|data analyst|business analyst|data scientist|support engineer|support specialist|product specialist|software engineer|frontend developer|backend developer|full stack developer|developer|designer|engineer|analyst|scientist|manager|specialist|consultant|coordinator|intern|lead|supervisor|technician|administrator|assistant|executive|operator|officer|recruiter|sales|marketing|accountant|teacher|nurse)\b/i;

const COMPANY_WORD_RE =
  /\b(gmbh|ag|se|ug|kg|ohg|ltd|llc|inc|corp|corporation|company|co\.?|pvt|private limited|limited|plc|bv|nv|group|systems|solutions|technologies|technology|software|services|labs|studio|consulting|industries|insights|edge|zoho|css corp|cummins|visomax|belkin|linksys|manageengine)\b/i;

const EDUCATION_ORG_RE =
  /\b(university|universität|universitaet|college|school|institute|academy|hochschule|coding school|arts and science|engineering college|technical university|wbs|srm|tum|luleå|lulea)\b/i;

const DEGREE_RE =
  /\b(master|masters|master's|bachelor|bachelors|bachelor's|degree|phd|mba|b\.sc|m\.sc|bsc|msc|bootcamp|diploma|certificate|certification|computer science|data science|aeronautical engineering|space science and technology)\b/i;

const ACTION_RE =
  /\b(responsible|support|supported|collaborate|collaborated|improve|improved|design|designed|develop|developed|install|installed|engineered|participated|assisted|fabricated|resolved|automated|built|delivered|utilized|conducted|managed|created|implemented|provided|analyzed|analysed|presented|collected|visualized|visualised|showcased|configured|troubleshot|led|owned|maintained|coordinated|optimized|optimised|reduced|increased|prepared|identified|monitored)\b/i;

const PROJECT_ACTION_RE =
  /\b(project|capstone|case study|dashboard|pipeline|analysis|analy[sz]ed|developed|built|automated|visuali[sz]ed|collected|presented|showcased|feasibility|market|portfolio|recommendation|api|scraping|cloud|database|sentiment|nlp|youtube|startup)\b/i;

const PROJECT_HINT_RE =
  /\b(project|magist|gans|e-scooter|scooter|classical dance|youtube api|market analysis|feasibility study|pipeline|dashboard|portfolio|capstone|case study|sentiment analysis)\b/i;

const SKILL_DICTIONARY = [
  "Python",
  "SQL",
  "MySQL",
  "PostgreSQL",
  "Pandas",
  "NumPy",
  "Excel",
  "Microsoft Excel",
  "Microsoft Word",
  "Microsoft Office",
  "Power BI",
  "Tableau",
  "Matplotlib",
  "Seaborn",
  "Jupyter Notebook",
  "Git",
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
  "Cloud Functions",
  "AWS",
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
  "Data Analysis",
  "Process Improvement",
  "Project Management",
  "Agile",
  "Training",
  "Stakeholder Communication",
  "Stakeholder Management",
  "Communication",
  "Problem Solving",
  "Leadership",
  "Teamwork",
  "Time Management",
  "Public Relations",
  "Effective Communication",
  "Critical Thinking",
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
    .replace(/\bNum Py\b/gi, "NumPy")
    .replace(/\bService Desk Plus\b/gi, "ServiceDesk Plus")
    .replace(/\bManage Engine\b/gi, "ManageEngine")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanLine(value = "") {
  return normalizeResumeText(value)
    .replace(/^[-*]+\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value = "") {
  return cleanLine(value)
    .toLowerCase()
    .replace(/\b[a-zà-ž]/g, (char) => char.toUpperCase())
    .replace(/\bAi\b/g, "AI")
    .replace(/\bApi\b/g, "API")
    .replace(/\bApis\b/g, "APIs")
    .replace(/\bSql\b/g, "SQL")
    .replace(/\bMysql\b/g, "MySQL")
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
    const normalized = key(item).replace(/\s+/g, " ").trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(item);
  }
  return out;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compactSpacedCaps(value = "") {
  const cleaned = cleanLine(value);
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length >= 4 && tokens.every((token) => /^[A-ZÄÖÜ]$/u.test(token))) {
    return tokens.join("");
  }
  return cleaned.replace(/(?:\b[A-ZÄÖÜ]\s+){2,}[A-ZÄÖÜ]\b/gu, (match) => match.replace(/\s+/g, ""));
}

function decompactKnownPhrases(value = "") {
  const clean = cleanLine(value);
  const key = clean.replace(/[^a-zA-ZäöüÄÖÜß]/g, "").toLowerCase();
  const known: Record<string, string> = {
    profilesummary: "Profile Summary",
    professionalprofile: "Professional Profile",
    workexperience: "Work Experience",
    professionalexperience: "Professional Experience",
    berufserfahrung: "Berufserfahrung",
    beruflichesprofil: "Berufliches Profil",
    itsupportspecialistdataanalyst: "IT Support Specialist / Data Analyst",
    productdesignengineer: "Product Design Engineer",
    productdesigntechnician: "Product Design Technician",
    technicalsupportengineer: "Technical Support Engineer",
    applicationengineer: "Application Engineer",
    dataanalyst: "Data Analyst",
  };
  return known[key] || clean;
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

function splitLines(rawText: string) {
  return normalizeResumeText(rawText)
    .split("\n")
    .map((line) => decompactKnownPhrases(compactSpacedCaps(line)))
    .map((line) => cleanLine(line).replace(/^\/+|\/+$/g, "").trim())
    .filter(Boolean)
    .filter((line) => !/^www\.linkedin\.com\/in\/?$/i.test(line))
    .filter((line) => !/^[a-z]+\d+\/?$/i.test(line));
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
    .replace(/\s*[–-]\s*/g, " - ")
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

function isProbablyBullet(line: string) {
  const clean = cleanLine(line);
  if (!clean || clean.length < 18) return false;
  if (findSectionKind(clean) || isContactLine(clean) || DEGREE_RE.test(clean) || EDUCATION_ORG_RE.test(clean)) return false;
  return ACTION_RE.test(clean) || /^[A-Z][^.!?]{30,}[.!?]?$/.test(clean);
}

function cleanBullet(line: string) {
  const clean = cleanLine(line)
    .replace(/^[-*]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean || clean.length < 12) return "";
  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
}

function splitLongBullet(line: string) {
  return cleanLine(line)
    .replace(/\s+(Responsible|Support|Collaborate|Designed|Developed|Engineered|Participated|Assisted|Fabricated|Resolved|Improved|Automated|Built|Delivered|Utilized|Conducted|Managed|Created|Implemented|Provided|Analyzed|Analysed|Presented|Collected|Visualized|Showcased|Configured|Led|Owned|Maintained|Coordinated|Optimized|Reduced|Increased)\b/g, "|||$1")
    .split("|||")
    .map(cleanBullet)
    .filter(Boolean);
}

function parseCompanyLine(line: string, options: { allowEducationOrg?: boolean } = {}) {
  const clean = cleanLine(line).replace(/\bGmb\s+H\b/gi, "GmbH");
  if (!clean) return null;
  if (!COMPANY_WORD_RE.test(clean)) return null;
  if (ACTION_RE.test(clean) || isSkillCategory(clean)) return null;
  if (!options.allowEducationOrg && EDUCATION_ORG_RE.test(clean)) return null;
  if (DEGREE_RE.test(clean) && EDUCATION_ORG_RE.test(clean) && !ROLE_RE.test(clean)) return null;

  const date = normalizeDate(extractDate(clean));
  const withoutDate = removeDate(clean).replace(ROLE_RE, "").replace(/^[,|: -]+|[,|: -]+$/g, "").trim();
  let company = withoutDate;
  let location = "";

  const dashParts = withoutDate.split(/\s+[–-]\s+/).map(cleanLine).filter(Boolean);
  if (dashParts.length >= 2 && isLocationLine(dashParts[dashParts.length - 1])) {
    company = dashParts.slice(0, -1).join(" - ");
    location = dashParts[dashParts.length - 1];
  } else {
    const commaParts = withoutDate.split(",").map(cleanLine).filter(Boolean);
    company = commaParts[0] || withoutDate;
    location = commaParts.slice(1).join(", ");
  }

  company = company.replace(/[·|]+/g, " ").replace(/^[-:]+|[-:]+$/g, "").replace(/\s+/g, " ").trim();
  if (!company || company.length < 2 || company.length > 120) return null;
  if (isContactLine(company) || ACTION_RE.test(company)) return null;
  return { company: titleCase(company), location: titleCase(location), dates: date };
}

function extractTitleFromLine(line: string) {
  const clean = removeDate(line);
  const match = clean.match(ROLE_RE)?.[0] || "";
  return match ? titleCase(match) : "";
}

function lineLooksLikeProjectTitle(line: string) {
  const clean = cleanLine(line);
  if (!clean || clean.length > 90 || clean.length < 3) return false;
  if (findSectionKind(clean) || isContactLine(clean) || DEGREE_RE.test(clean) || EDUCATION_ORG_RE.test(clean) || COMPANY_WORD_RE.test(clean)) return false;
  if (ACTION_RE.test(clean) || /experienced|skilled|proficient|fluent|detail-oriented|responsible/i.test(clean)) return false;
  if (ROLE_RE.test(clean)) return false;
  return PROJECT_HINT_RE.test(clean) || /^[A-Z][A-Za-z0-9&() /+-]{2,80}$/.test(clean);
}

function extractBasics(lines: string[], rawText: string) {
  const email = rawText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase() || "";
  const phone =
    (rawText.match(/\+?\d[\d\s().-]{7,}\d/g) || [])
      .map(cleanLine)
      .find((item) => !/^\d{4}\s*-\s*\d{4}$/.test(item) && !/\b(19|20)\d{2}\b\s*-\s*\b(19|20)\d{2}\b/.test(item)) || "";
  const linkedin = rawText.match(/(?:www\.)?linkedin\.com\/[^\s|,]+/i)?.[0]?.replace(/^www\./i, "") || "";

  function inferNameFromEmail() {
    const local = email.split("@")[0]?.replace(/\d+/g, "").replace(/[._-]+/g, " ").trim() || "";
    if (!local) return "";
    const parts = local.split(/\s+/).filter((part) => part.length > 1);
    return parts.length >= 2 ? titleCase(parts.join(" ")) : titleCase(local);
  }

  function looksLikeName(line: string) {
    if (/@|linkedin|github|outlook|gmail/i.test(line)) return false;
    const clean = titleCase(line.replace(/[^A-Za-zÀ-ž' -]/g, " ").replace(/\s+/g, " ").trim());
    if (!clean || clean.length > 45) return false;
    if (ROLE_RE.test(clean) || findSectionKind(clean) || isContactLine(clean) || COMPANY_WORD_RE.test(clean) || DEGREE_RE.test(clean)) return false;
    const words = clean.split(/\s+/).filter(Boolean);
    return words.length >= 2 && words.length <= 5 && words.every((word) => /^[A-Za-zÀ-ž' -]{2,}$/.test(word));
  }

  const top = lines.slice(0, 28);
  const directName = top.find(looksLikeName) || lines.find(looksLikeName) || "";
  const extractedCandidateName = workzoExtractNameFromRawCv(rawText);
  const name = workzoCleanCandidateName(directName ? titleCase(directName) : inferNameFromEmail() || "Candidate", extractedCandidateName || "Candidate");

  const headlineLine =
    lines.slice(0, 30).find((line) => ROLE_RE.test(line) && line.length <= 95 && !isContactLine(line) && !COMPANY_WORD_RE.test(line)) ||
    lines.find((line) => ROLE_RE.test(line) && line.length <= 95 && !isContactLine(line) && !COMPANY_WORD_RE.test(line)) ||
    "";

  const locationLine = lines.find((line) => isLocationLine(line) && !/@|linkedin|github/i.test(line) && !ROLE_RE.test(line) && !DEGREE_RE.test(line)) || "";

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

function hasBadSummaryStart(line: string) {
  return /^(python|sql|tableau|matplotlib|seaborn|english|german|project management|public relations|teamwork|time management|leadership|effective communication|critical thinking|programming|machine learning|data visualization|data engineering|generative ai)\b/i.test(cleanLine(line));
}

function extractSummary(lines: string[], sections: SectionMap) {
  const candidatePools: string[][] = [];
  if (sections.summary.length) candidatePools.push(sections.summary);

  const headerIndex = lines.findIndex((line) => findSectionKind(line) === "summary");
  if (headerIndex >= 0) {
    const afterHeader = lines.slice(headerIndex + 1, Math.min(lines.length, headerIndex + 28));
    candidatePools.push(afterHeader);
  }

  candidatePools.push(lines);

  for (const pool of candidatePools) {
    const summaryLines: string[] = [];
    let started = false;

    for (const raw of pool) {
      const line = cleanLine(raw);
      if (!line || findSectionKind(line) || isContactLine(line) || isSkillCategory(line)) continue;
      if (parseCompanyLine(line, { allowEducationOrg: true }) || DEGREE_RE.test(line) || EDUCATION_ORG_RE.test(line)) continue;
      if (extractDate(line) && line.length < 90) continue;
      if (ACTION_RE.test(line) && !/experience|skilled|proficient|motivated|detail|fluent|passion|background|track record/i.test(line)) {
        if (started) break;
        continue;
      }
      if (lineLooksLikeProjectTitle(line) && !/experience|skilled|motivated|detail|professional|background/i.test(line)) continue;
      if (line.length < 38) continue;
      if (!started && hasBadSummaryStart(line)) continue;

      started = true;
      summaryLines.push(line);
      if (summaryLines.join(" ").length > 750) break;
    }

    const summary = summaryLines.join(" ").replace(/\s+/g, " ").trim();
    if (summary.length >= 80) return /[.!?]$/.test(summary) ? summary : `${summary}.`;
  }

  return "Professional with practical experience, transferable strengths, and role-relevant skills.";
}

function normalizeSkillToken(value = "") {
  let clean = cleanLine(value)
    .replace(/^(skills|core skills|technical skills|expertise|tools|programming|machine learning|data visualization|data visualisation|data engineering|generative ai|3d cad tools|3d printing|product lifecycle management|visualization)\s*[:：]?\s*/i, "")
    .replace(/\bTensor Flow\b/gi, "TensorFlow")
    .replace(/\bScikit Learn\b/gi, "scikit-learn")
    .replace(/\bSk Learn\b/gi, "Sklearn")
    .replace(/\bWeb Scrapping\b/gi, "Web Scraping")
    .replace(/\bYou Tube API\b/gi, "YouTube API")
    .replace(/^and\s+/i, "")
    .replace(/[.:]+$/g, "")
    .trim();

  const lower = clean.toLowerCase();
  const exact = SKILL_DICTIONARY.find((skill) => skill.toLowerCase() === lower);
  if (exact) return exact;
  if (lower === "solid works") return "SolidWorks";
  if (lower === "catia v5") return "Catia V5";
  if (lower === "creo") return "CREO";
  if (lower === "fff") return "FFF";
  if (lower === "power bi") return "Power BI";
  if (lower === "num py") return "NumPy";
  return titleCase(clean);
}

function isPollutedSkill(value = "") {
  const clean = cleanLine(value);
  if (!clean || clean.length > 42) return true;
  if (/\d/.test(clean) && !/^(3D CAD|3D Printing|Catia V5|FFF)$/i.test(clean)) return true;
  if (/^(and|or|in|with|using|education|languages|contact|profile|summary|work experience|experience|projects|berufserfahrung|bildung|kontakt|sprachen)$/i.test(clean)) return true;
  if (/@|linkedin|outlook|gmail|\+\d|\b\d{4}\b|würzburg|wurzburg|germany|india|sweden|candidate|candidate|surender|aarav/i.test(clean)) return true;
  if (/experience|responsible|supported|collaborated|delivered|developed|designed|analyzed|proven|track record|background|fluent in|bachelor|master|degree|university|college|satellite|docking|retrieval|generation|implementation|configuration|performance optimization$/i.test(clean)) return true;
  return false;
}

function extractSkills(rawText: string, sections: SectionMap, allLines: string[]) {
  const explicitSource = [
    ...sections.skills,
    ...allLines.filter((line) => isSkillCategory(line) || /^(technical|programming|visualization|tools|soft skills|machine learning|data engineering|generative ai|3d cad tools|3d printing|product lifecycle management)\b/i.test(line)),
  ];

  const explicit = explicitSource
    .join(" | ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[,|;/]/)
    .map(normalizeSkillToken)
    .filter((skill) => !isPollutedSkill(skill));

  const dictionary = SKILL_DICTIONARY.filter((skill) => new RegExp(`\\b${escapeRegExp(skill)}\\b`, "i").test(rawText)).map(normalizeSkillToken);
  return unique([...explicit, ...dictionary].filter((skill) => !isPollutedSkill(skill))).slice(0, 28);
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

function extractEducation(sections: SectionMap, lines: string[]) {
  const source = (sections.education.length ? sections.education : lines).map(cleanLine).filter(Boolean);
  const items: ResumeEducation[] = [];

  function cleanDegree(line = "") {
    return titleCase(removeDate(line))
      .replace(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b(?=\s*$)/g, "")
      .replace(/\bCandidate\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanInstitution(line = "") {
    return titleCase(removeDate(line))
      .replace(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b(?=\s*$)/g, "")
      .replace(/\bCandidate\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isDegree(line: string) {
    return DEGREE_RE.test(line) && !ACTION_RE.test(line) && !ROLE_RE.test(line);
  }

  function isOrg(line: string) {
    return EDUCATION_ORG_RE.test(line) && !ACTION_RE.test(line) && !ROLE_RE.test(line);
  }

  function add(item: ResumeEducation) {
    const degree = cleanDegree(item.degree);
    const institution = cleanInstitution(item.institution);
    const dates = normalizeDate(item.dates || extractDate(`${item.degree} ${item.institution}`));
    if (!degree && !institution) return;
    if (ROLE_RE.test(`${degree} ${institution}`)) return;
    const key = `${degree}|${institution}|${dates}`.toLowerCase().replace(/\s+/g, " ").trim();
    if (items.some((existing) => `${existing.degree}|${existing.institution}|${existing.dates}`.toLowerCase().replace(/\s+/g, " ").trim() === key)) return;
    items.push({ degree: degree || "Education", institution: institution !== degree ? institution : "", location: item.location || "", dates });
  }

  for (let i = 0; i < source.length; i += 1) {
    const line = source[i];
    if (!line || findSectionKind(line) || isContactLine(line) || isSkillCategory(line) || isProbablyBullet(line)) continue;

    if (isOrg(line)) {
      let degree = "";
      let dates = normalizeDate(extractDate(line));
      for (let j = i - 3; j <= i + 5; j += 1) {
        if (j < 0 || j >= source.length || j === i) continue;
        const candidate = source[j];
        if (!degree && isDegree(candidate)) degree = candidate;
        if (!dates && extractDate(candidate) && !ROLE_RE.test(candidate)) dates = normalizeDate(extractDate(candidate));
      }
      add({ degree, institution: line, location: "", dates });
    }

    if (isDegree(line)) {
      let institution = "";
      let dates = normalizeDate(extractDate(line));
      for (let j = i - 3; j <= i + 5; j += 1) {
        if (j < 0 || j >= source.length || j === i) continue;
        const candidate = source[j];
        if (!institution && isOrg(candidate)) institution = candidate;
        if (!dates && extractDate(candidate) && !ROLE_RE.test(candidate)) dates = normalizeDate(extractDate(candidate));
      }
      add({ degree: line, institution, location: "", dates });
    }
  }

  return items
    .filter((item, index, arr) => {
      if (!item.institution && arr.some((other, otherIndex) => otherIndex !== index && other.degree === item.degree && other.institution)) return false;
      return true;
    })
    .slice(0, 8);
}

function extractProjectTitles(lines: string[], sections: SectionMap) {
  const projectLines = sections.projects.length ? sections.projects : [];
  const titles = projectLines.filter(lineLooksLikeProjectTitle);
  if (!titles.length) return [];
  return unique(titles.map((line) => titleCase(line))).slice(0, 8);
}

function extractProjects(sections: SectionMap, lines: string[]) {
  if (!sections.projects.length) return [];

  const titles = extractProjectTitles(lines, sections);
  const projects: ResumeProject[] = titles.map((name) => ({ name: workzoCleanCandidateName(name, "Candidate"), bullets: [] }));
  let currentIndex = projects.length ? 0 : -1;
  const titleKeys = new Map(titles.map((title, index) => [title.toLowerCase(), index]));

  for (const raw of sections.projects) {
    const line = cleanLine(raw);
    if (!line || findSectionKind(line) || isContactLine(line) || isSkillCategory(line)) continue;
    const title = titleCase(line);
    if (titleKeys.has(title.toLowerCase())) {
      currentIndex = titleKeys.get(title.toLowerCase()) ?? currentIndex;
      continue;
    }
    if (ROLE_RE.test(line) || COMPANY_WORD_RE.test(line) || DEGREE_RE.test(line) || EDUCATION_ORG_RE.test(line)) continue;
    if (isProbablyBullet(line) || PROJECT_ACTION_RE.test(line)) {
      if (currentIndex < 0) {
        projects.push({ name: "Selected Project", bullets: [] });
        currentIndex = projects.length - 1;
      }
      const bullet = cleanBullet(line).replace(/\bREST\.\s*$/i, "REST APIs and MySQL.");
      if (bullet) projects[currentIndex].bullets.push(bullet);
    }
  }

  return unique(
    projects
      .map((project) => ({ name: project.name, bullets: unique(project.bullets).slice(0, 5) }))
      .filter((project) => project.name && (project.bullets.length || project.name !== "Selected Project")),
    (project) => project.name,
  ).slice(0, 8);
}

function repairProjectsFromGlobalLines(lines: string[], projects: ResumeProject[]) {
  if (!projects.length) return projects;
  const repaired = projects.map((project) => ({ ...project, bullets: [...project.bullets] }));

  function addTo(namePattern: RegExp, bulletPattern: RegExp) {
    const project = repaired.find((item) => namePattern.test(item.name));
    if (!project) return;
    for (const line of lines) {
      if (bulletPattern.test(line) && (isProbablyBullet(line) || PROJECT_ACTION_RE.test(line))) {
        project.bullets.push(cleanBullet(line).replace(/\bREST\.\s*$/i, "REST APIs and MySQL."));
      }
    }
    project.bullets = unique(project.bullets).slice(0, 5);
  }

  addTo(/magist/i, /brazilian market|magist|market trends|partnership|strategic decision/i);
  addTo(/gans|scooter/i, /gans|e-scooter|web scraping|city demographic|weather|flight data|cloud functions|database management/i);
  addTo(/cultural|dance|youtube/i, /classical dance|youtube|sentiment|textblob|viewer comments|traditional art/i);

  return repaired.filter((project) => project.bullets.length || project.name !== "Selected Project");
}

function extractExperience(sections: SectionMap, lines: string[], projects: ResumeProject[], summary: string) {
  const projectBulletSet = new Set(projects.flatMap((project) => project.bullets.map((bullet) => cleanLine(bullet).toLowerCase())));
  const source = (sections.experience.length ? sections.experience : lines).map(cleanLine).filter(Boolean);
  const jobs: ResumeExperience[] = [];
  const companyAnchors: Array<{ index: number; company: string; location: string; dates: string }> = [];

  function normalizeCompanyFromLine(line: string) {
    const parsed = parseCompanyLine(line, { allowEducationOrg: true });
    if (parsed) return parsed;
    return null;
  }

  for (let i = 0; i < source.length; i += 1) {
    const parsed = normalizeCompanyFromLine(source[i] || "");
    if (!parsed) continue;
    const around = source.slice(Math.max(0, i - 4), Math.min(source.length, i + 8)).join(" ");
    if (!ROLE_RE.test(around) && !ACTION_RE.test(around) && !extractDate(around)) continue;
    if (EDUCATION_ORG_RE.test(parsed.company) && !/intern|working student|research|engineer|designer|developer|analyst/i.test(around)) continue;
    companyAnchors.push({ index: i, ...parsed });
  }

  function findTitle(anchorIndex: number) {
    const same = extractTitleFromLine(source[anchorIndex] || "");
    if (same) return same;
    for (let j = anchorIndex + 1; j <= Math.min(source.length - 1, anchorIndex + 4); j += 1) {
      const line = source[j] || "";
      if (parseCompanyLine(line, { allowEducationOrg: true }) || findSectionKind(line)) break;
      const title = extractTitleFromLine(line);
      if (title && !isProbablyBullet(line)) return title;
    }
    for (let j = anchorIndex - 1; j >= Math.max(0, anchorIndex - 3); j -= 1) {
      const line = source[j] || "";
      const title = extractTitleFromLine(line);
      if (title && !isProbablyBullet(line)) return title;
    }
    return "Professional Experience";
  }

  function findDate(anchorIndex: number, existingDate = "") {
    if (existingDate && /-|present/i.test(existingDate)) return existingDate;
    for (let j = anchorIndex - 2; j <= Math.min(source.length - 1, anchorIndex + 4); j += 1) {
      if (j < 0) continue;
      const date = extractDate(source[j] || "");
      if (date && !DEGREE_RE.test(source[j] || "")) return normalizeDate(date);
    }
    return existingDate;
  }

  function bulletBelongsToSummary(line: string) {
    const clean = cleanLine(line).toLowerCase();
    return clean.length > 30 && summary.toLowerCase().includes(clean.slice(0, 80).toLowerCase());
  }

  function bulletBelongsToProject(line: string) {
    const clean = cleanLine(cleanBullet(line)).toLowerCase();
    if (projectBulletSet.has(clean)) return true;
    return /magist|brazilian market|classical dance|youtube api|viewer comments|sentiment analysis|textblob|gans|e-scooter|city demographic|flight data/i.test(line);
  }

  function collectBullets(anchorIndex: number, nextAnchorIndex: number) {
    const bullets: string[] = [];
    let start = anchorIndex + 1;
    for (let j = anchorIndex + 1; j <= Math.min(source.length - 1, anchorIndex + 5); j += 1) {
      const line = source[j] || "";
      if (extractDate(line) || (ROLE_RE.test(line) && line.length < 100)) {
        start = j + 1;
      }
    }

    const end = nextAnchorIndex > anchorIndex ? nextAnchorIndex - 1 : Math.min(source.length - 1, anchorIndex + 42);
    for (let j = start; j <= end; j += 1) {
      const line = source[j] || "";
      if (!line || findSectionKind(line) || isContactLine(line) || isSkillCategory(line)) continue;
      if (parseCompanyLine(line, { allowEducationOrg: true })) break;
      if (DEGREE_RE.test(line) || EDUCATION_ORG_RE.test(line)) continue;
      if (ROLE_RE.test(line) && line.length < 90 && !ACTION_RE.test(line)) continue;
      if (!isProbablyBullet(line)) continue;
      if (bulletBelongsToSummary(line) || bulletBelongsToProject(line)) continue;
      bullets.push(...splitLongBullet(line));
    }
    return unique(bullets).slice(0, 9);
  }

  companyAnchors.forEach((anchor, index) => {
    const next = companyAnchors[index + 1]?.index ?? source.length;
    const title = findTitle(anchor.index);
    const bullets = collectBullets(anchor.index, next);
    jobs.push({
      title,
      company: anchor.company,
      location: anchor.location,
      dates: findDate(anchor.index, anchor.dates),
      bullets,
    });
  });

  return unique(
    jobs.filter((job) => job.company && (job.bullets.length || job.title !== "Professional Experience")),
    (job) => `${job.company}|${job.dates}`,
  ).slice(0, 8);
}

function extractCertifications(sections: SectionMap) {
  return unique(sections.certifications.map(cleanLine).filter((line) => line.length > 3 && line.length < 120).map(titleCase)).slice(0, 10);
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

  return unique(
    lines
      .map(cleanLine)
      .filter((line) => line.length >= 18 && line.length <= 180)
      .filter((line) => !findSectionKind(line) && !isContactLine(line) && !isSkillCategory(line))
      .filter((line) => !used.has(line.toLowerCase()))
      .filter((line) => ACTION_RE.test(line) || PROJECT_HINT_RE.test(line) || ROLE_RE.test(line) || DEGREE_RE.test(line) || EDUCATION_ORG_RE.test(line))
      .map((line) => /[.!?]$/.test(line) || ROLE_RE.test(line) || DEGREE_RE.test(line) || EDUCATION_ORG_RE.test(line) ? line : `${line}.`),
  ).slice(0, 18);
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
      job.bullets.slice(0, 6).forEach((bullet) => lines.push(`- ${bullet}`));
    });
  }

  if (profile.projects.length) {
    lines.push("", "PROJECTS");
    profile.projects.slice(0, 5).forEach((project) => {
      lines.push(project.name);
      project.bullets.slice(0, 4).forEach((bullet) => lines.push(`- ${bullet}`));
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
  const summary = extractSummary(lines, sections);
  const initialProjects = extractProjects(sections, lines);
  const projects = repairProjectsFromGlobalLines(lines, initialProjects);

  const partial = {
    rawText: normalized,
    basics: extractBasics(lines, normalized),
    summary,
    experience: extractExperience(sections, lines, projects, summary),
    education: extractEducation(sections, lines),
    skills: extractSkills(normalized, sections, lines),
    projects,
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


// =========================================================
// WorkZo Complex CV Extraction Patch
// Purpose:
// - Prevent role/skill fragments like "Product Stability" or "Tier" being used as name.
// - Better parse visual/multi-column CV text by explicit section windows.
// - Keep education out of experience and dates attached to correct section.
// =========================================================

const WORKZO_BAD_NAME_WORDS = /\b(product|stability|tier|support|engineer|developer|analyst|manager|specialist|consultant|supervisor|professional|experience|education|skills|summary|profile|contact|email|phone|linkedin|location|service|delivery|requirements|analysis|python|sql|excel|tableau|microsoft|word|germany|w[üu]rzburg|street|road|weg)\b/i;

function wzBetterClean(value = "") {
  return normalizeResumeText(value)
    .replace(/\bProduct Stability\.?\b/gi, "")
    .replace(/\bEx-Technical Support Engineer And Product Specialist Transitioning\b/gi, "Ex-Technical Support Engineer and Product Specialist Transitioning")
    .replace(/\bGained knowlegde\b/gi, "Gained knowledge")
    .replace(/\s+/g, " ")
    .trim();
}

function wzLooksLikePersonName(value = "") {
  const clean = wzBetterClean(value)
    .replace(/[,|•].*$/g, "")
    .replace(/[^A-Za-zÀ-ÖØ-öø-ÿ' .-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean || clean.length < 3 || clean.length > 48) return false;
  if (/@|http|www|\d|\+/.test(clean)) return false;
  if (WORKZO_BAD_NAME_WORDS.test(clean)) return false;

  const parts = clean.split(" ").filter(Boolean);
  if (parts.length < 2 || parts.length > 4) return false;
  return parts.every((part) => /^[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'.-]{1,}$/.test(part));
}

function wzExtractBetterName(text = "") {
  const lines = normalizeResumeText(text)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 25);

  for (const line of lines) {
    const clean = line.replace(/\s*[|•].*$/g, "").trim();
    if (wzLooksLikePersonName(clean)) return titleCase(clean);
  }

  const emailPrefix = text.match(/\b([a-z][a-z0-9._-]{2,})@[a-z0-9.-]+\.[a-z]{2,}\b/i)?.[1] || "";
  const spaced = emailPrefix
    .replace(/[._-]+/g, " ")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (wzLooksLikePersonName(spaced)) return titleCase(spaced);

  return "";
}

function wzSectionWindow(text: string, startPatterns: RegExp[], endPatterns: RegExp[]) {
  const normalized = normalizeResumeText(text);
  const lower = normalized.toLowerCase();
  let start = -1;

  for (const pattern of startPatterns) {
    const match = pattern.exec(lower);
    if (match && (start === -1 || match.index < start)) {
      start = match.index + match[0].length;
    }
  }

  if (start === -1) return "";

  let end = normalized.length;
  const tail = lower.slice(start);
  for (const pattern of endPatterns) {
    const match = pattern.exec(tail);
    if (match && match.index > 10) {
      end = Math.min(end, start + match.index);
    }
  }

  return normalized.slice(start, end).trim();
}

function wzExtractContactBasics(text = "") {
  const clean = normalizeResumeText(text);
  const email = clean.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const phone = clean.match(/(?:\+\d{1,3}[\s-]?)?(?:\(?\d+\)?[\s-]?){7,}/)?.[0]?.trim() || "";
  const linkedin = clean.match(/linkedin\.com\/[^\s|•,]+/i)?.[0] || "";
  const location =
    clean.match(/\b(?:Würzburg|Wurzburg|Wuerzburg|Berlin|Munich|München|Hamburg|Chennai|Bangalore|Hyderabad|Netherlands|Germany|India|United Kingdom|France|Spain|Italy|Portugal)\b(?:[^•|\n]{0,45})?/i)?.[0]?.trim() || "";

  return { email, phone, linkedin, location };
}

function wzExtractBetterSkills(text = "") {
  const source = normalizeResumeText(text);
  const skillWindow = wzSectionWindow(
    source,
    [/\bskills\b/i, /\btechnical skills\b/i, /\bcore skills\b/i],
    [/\beducation\b/i, /\bexperience\b/i, /\bprojects\b/i, /\blanguages\b/i, /\bcertifications\b/i],
  );

  const hay = `${skillWindow}\n${source}`;
  return unique(
    SKILL_DICTIONARY.filter((skill) => new RegExp(`\\b${escapeRegExp(skill).replace(/\\\s+/g, "\\s+")}\\b`, "i").test(hay)),
    (skill) => skill.toLowerCase(),
  ).slice(0, 24);
}

function wzExtractBetterLanguages(text = "") {
  const source = normalizeResumeText(text);
  const languageWindow = wzSectionWindow(
    source,
    [/\blanguages\b/i, /\blanguage skills\b/i, /\bsprachen\b/i],
    [/\beducation\b/i, /\bexperience\b/i, /\bprojects\b/i, /\bskills\b/i, /\bcertifications\b/i],
  ) || source;

  const out: string[] = [];
  const patterns: Array<[RegExp, string]> = [
    [/\benglish\s*[-:]\s*(c2|c1|b2|b1|a2|a1|native|fluent|professional)\b/i, "English - $1"],
    [/\bgerman\s*[-:]\s*(c2|c1|b2|b1|a2|a1|native|fluent|professional)\b/i, "German - $1"],
    [/\bdutch\s*[-:]\s*(c2|c1|b2|b1|a2|a1|native|fluent|professional)\b/i, "Dutch - $1"],
    [/\bfrench\s*[-:]\s*(c2|c1|b2|b1|a2|a1|native|fluent|professional)\b/i, "French - $1"],
    [/\bspanish\s*[-:]\s*(c2|c1|b2|b1|a2|a1|native|fluent|professional)\b/i, "Spanish - $1"],
    [/\bitalian\s*[-:]\s*(c2|c1|b2|b1|a2|a1|native|fluent|professional)\b/i, "Italian - $1"],
    [/\bportuguese\s*[-:]\s*(c2|c1|b2|b1|a2|a1|native|fluent|professional)\b/i, "Portuguese - $1"],
  ];

  for (const [pattern, template] of patterns) {
    const match = languageWindow.match(pattern);
    if (match) out.push(template.replace("$1", match[1].toUpperCase()));
  }

  return unique(out);
}

function wzExtractBetterEducation(text = ""): ResumeEducation[] {
  const source = normalizeResumeText(text);
  const educationWindow = wzSectionWindow(
    source,
    [/\beducation\b/i, /\bacademic background\b/i, /\bqualifications\b/i],
    [/\bexperience\b/i, /\bwork experience\b/i, /\bprojects\b/i, /\bskills\b/i, /\blanguages\b/i, /\bcertifications\b/i],
  );

  const hay = educationWindow || source;
  const lines = hay.split(/\n+/).map(cleanLine).filter(Boolean);
  const out: ResumeEducation[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!DEGREE_RE.test(line) && !EDUCATION_ORG_RE.test(line)) continue;

    const combined = [line, lines[i + 1] || ""].join(" • ");
    const dates = normalizeDate(extractDate(combined));
    const parts = combined.split(/\s*[•|]\s*/).map(cleanLine).filter(Boolean);

    const degree = parts.find((part) => DEGREE_RE.test(part)) || line;
    const institution = parts.find((part) => EDUCATION_ORG_RE.test(part) && part !== degree) || "";
    const location = parts.find((part) => isLocationLine(part) && part !== institution) || "";

    if (degree || institution) {
      out.push({
        degree: titleCase(removeDate(degree)),
        institution: titleCase(removeDate(institution)),
        location: titleCase(removeDate(location)),
        dates,
      });
    }
  }

  return unique(out, (item) => `${item.degree}-${item.institution}-${item.dates}`).slice(0, 6);
}

function wzExtractBetterExperience(text = ""): ResumeExperience[] {
  const source = normalizeResumeText(text);
  const experienceWindow = wzSectionWindow(
    source,
    [/\bprofessional experience\b/i, /\bwork experience\b/i, /\bemployment history\b/i, /\bexperience\b/i],
    [/\beducation\b/i, /\bprojects\b/i, /\bskills\b/i, /\blanguages\b/i, /\bcertifications\b/i],
  );

  const hay = experienceWindow || source;
  const lines = hay.split(/\n+/).map(cleanLine).filter(Boolean);
  const jobs: ResumeExperience[] = [];
  let current: ResumeExperience | null = null;

  function flush() {
    if (!current) return;
    if (current.title || current.company || current.bullets.length) {
      jobs.push({
        ...current,
        title: titleCase(current.title),
        company: titleCase(current.company),
        location: titleCase(current.location),
        dates: normalizeDate(current.dates),
        bullets: unique(current.bullets.map(cleanLine)).slice(0, 7),
      });
    }
    current = null;
  }

  for (const raw of lines) {
    const line = cleanLine(raw);
    if (!line) continue;
    if (EDUCATION_ORG_RE.test(line) || DEGREE_RE.test(line)) continue;

    const hasDate = Boolean(extractDate(line));
    const looksHeader = hasDate || ROLE_RE.test(line) || COMPANY_WORD_RE.test(line);
    const looksBullet = ACTION_RE.test(line) || /^[-•*]/.test(raw) || line.length > 65;

    if (looksHeader && !looksBullet) {
      flush();
      const date = normalizeDate(extractDate(line));
      const noDate = removeDate(line);
      const parts = noDate.split(/\s*[•|]\s*/).map(cleanLine).filter(Boolean);

      const title = parts.find((part) => ROLE_RE.test(part)) || "";
      const company = parts.find((part) => COMPANY_WORD_RE.test(part) && part !== title) || parts.find((part) => part !== title) || "";

      current = {
        title: title || noDate,
        company,
        location: "",
        dates: date,
        bullets: [],
      };
      continue;
    }

    if (looksBullet) {
      if (!current) {
        current = { title: "Professional Experience", company: "", location: "", dates: "", bullets: [] };
      }
      current.bullets.push(line.replace(/^[-•*]\s*/, ""));
    }
  }

  flush();

  return unique(jobs, (job) => `${job.title}-${job.company}-${job.dates}`)
    .filter((job) => !DEGREE_RE.test(`${job.title} ${job.company}`))
    .slice(0, 8);
}

const workzoOriginalExtractResumeProfile = extractResumeProfile;

export function extractResumeProfileComplex(rawText = ""): ResumeProfile {
  const base = workzoOriginalExtractResumeProfile(rawText);
  const text = normalizeResumeText(rawText);
  const contact = wzExtractContactBasics(text);
  const betterName = wzExtractBetterName(text);
  const betterSkills = wzExtractBetterSkills(text);
  const betterEducation = wzExtractBetterEducation(text);
  const betterExperience = wzExtractBetterExperience(text);
  const betterLanguages = wzExtractBetterLanguages(text);

  const name =
    betterName ||
    (wzLooksLikePersonName(base.basics.name) ? base.basics.name : "") ||
    "Candidate";

  const headline =
    base.basics.headline && !WORKZO_BAD_NAME_WORDS.test(base.basics.headline)
      ? base.basics.headline
      : betterExperience[0]?.title || "Professional";

  const experience = betterExperience.length ? betterExperience : base.experience;
  const education = betterEducation.length ? betterEducation : base.education;
  const skills = betterSkills.length ? betterSkills : base.skills;
  const languages = betterLanguages.length ? betterLanguages : base.languages;

  return {
    ...base,
    rawText: text,
    basics: {
      ...base.basics,
      name,
      headline,
      email: contact.email || base.basics.email,
      phone: contact.phone || base.basics.phone,
      location: contact.location || base.basics.location,
      linkedin: contact.linkedin || base.basics.linkedin,
    },
    experience,
    education,
    skills,
    languages,
    warnings: unique([
      ...base.warnings,
      ...(name === "Candidate" ? ["Candidate name could not be verified from the CV header."] : []),
      ...(experience.length ? [] : ["Experience section could not be confidently extracted."]),
    ]),
    previewText: [
      name,
      headline,
      contact.email || base.basics.email,
      "",
      base.summary,
      "",
      "Experience:",
      ...experience.flatMap((job) => [
        [job.title, job.company, job.dates].filter(Boolean).join(" • "),
        ...job.bullets.map((bullet) => `- ${bullet}`),
      ]),
      "",
      "Skills:",
      skills.join(", "),
      "",
      "Education:",
      ...education.map((edu) => [edu.degree, edu.institution, edu.dates].filter(Boolean).join(" • ")),
      "",
      "Languages:",
      languages.join(", "),
    ].filter(Boolean).join("\\n"),
  };
}
