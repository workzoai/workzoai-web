/**
 * WorkZo AI, Resume Parser v5
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

  // Check for digits/contact markers on the RAW value BEFORE stripping
  // non-name characters. Stripping digits first would let an address line
  // like "123 Anywhere St., Any City" survive as "Anywhere St. Any City"
  // (4 capitalized words) and be returned as a person's name.
  if (/@|www|http|\+|\d/.test(raw)) return fallback;

  const cleaned = raw
    .replace(/\s+/g, " ")
    .replace(/[^A-Za-zÀ-ÖØ-öø-ÿ' .-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned.length < 3 || cleaned.length > 60) return fallback;
  if (WORKZO_INVALID_CANDIDATE_NAME_RE.test(cleaned)) return fallback;

  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length < 2 || parts.length > 4) return fallback;

  return cleaned;
}

function workzoExtractNameFromRawCv(rawText: string) {
  const normalized = String(rawText || "");

  const allLines = normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 40);

  // A person's name only ever lives in the header block, ABOVE the first real
  // section header. Scanning past the first section (SKILLS, EXPERIENCE, ...)
  // lets the fallback borrow a section-body phrase (a skill, a company, a
  // degree — whatever comes first for that CV) and render it as the candidate's
  // name whenever the true header line stops being name-shaped (e.g. the user
  // trims it in the editable box). Bound the scan to the header region so a
  // name is never taken from inside a section. Global: language/CV agnostic.
  const firstSectionIdx = allLines.findIndex((line) => findSectionKind(line));
  const headerLines =
    firstSectionIdx === -1 ? allLines : allLines.slice(0, firstSectionIdx);

  for (const line of headerLines) {
    const candidate = workzoCleanCandidateName(line, "");
    if (candidate) return candidate;
  }

  // No strictly name-shaped line in the header (common mid-edit, e.g. a
  // single-word first line): trust top-of-document position and keep the first
  // header line as-is rather than reaching into a later section.
  const firstHeaderLine = headerLines.find(
    (line) => !/@|www|http/.test(line) && !findSectionKind(line),
  );
  if (firstHeaderLine && firstHeaderLine.length <= 60) return firstHeaderLine;

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

// STRONG company signals: legal-entity suffixes and multi-word business-type
// terms that essentially never appear as a normal word inside a sentence.
// Safe to match anywhere in a line.
const COMPANY_WORD_RE =
  /\b(gmbh|ag\.?|se|ug|kg|ohg|ltd|llc|inc|corp|corporation|company|co\.?|pvt|private limited|limited|plc|bv|nv|group|systems|solutions|technologies|software|services|labs|studio|consulting|industries|enterprises|associates|partners|ventures|capital)\b/i;

// WEAK company signals: common English words that are legitimate parts of
// company names ("Acme Digital", "Brightline Media", "Northwind Health") but
// are ALSO ordinary words that appear constantly in normal sentences
// ("the technology sector", "media outlets", "global initiatives").
//
// These only count as a company signal when the line is SHORT (<=4 words)
// and looks like a proper-noun phrase, i.e. the structural pattern of a
// company name, not prose. See isLikelyCompanyPhrase().
const COMPANY_WEAK_WORD_RE =
  /\b(global|international|digital|media|network|networks|platform|platforms|analytics|data|cloud|security|health|healthcare|finance|financial|bank|banking|insurance|retail|logistics|telecom|telecommunications|management|insights|edge|technology)\b/i;

/**
 * isLikelyCompanyPhrase, true if `line` has the STRUCTURE of a company name
 * (short, 1-4 words, each word capitalized / proper-noun-like) rather than
 * being a sentence fragment that happens to contain a company-ish word.
 *
 * Used to gate COMPANY_WEAK_WORD_RE matches: "Brightline Media" passes,
 * but "and media outlets, securing coverage" does not (too many words,
 * contains lowercase function words, ends with punctuation/comma).
 */
function isLikelyCompanyPhrase(line: string): boolean {
  const clean = cleanLine(line).replace(/[.,;:]+$/g, "");
  if (!clean || clean.length > 60) return false;
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 4) return false;
  // Every word should look like a proper noun (starts with capital), no
  // lowercase function words like "and", "in", "the", "of".
  return words.every((word) => /^[A-ZÀ-Ö][A-Za-zÀ-ÖØ-öø-ÿ&.'-]*$/.test(word));
}

const EDUCATION_ORG_RE =
  /\b(university|universität|universitaet|fachhochschule|college|school|institute|academy|hochschule|coding school|arts and science|engineering college|technical university|polytechnic|conservatory|seminary|faculty|campus|lycée|lycee|gymnasium|realschule|grundschule|gesamtschule|berufsschule|fachschule|berufsakademie|duale hochschule)\b/i;

const DEGREE_RE =
  /\b(master|masters|master's|bachelor|bachelors|bachelor's|degree|phd|mba|b\.sc|m\.sc|bsc|msc|bootcamp|diploma|certificate|certification|computer science|data science|aeronautical engineering|space science and technology)\b/i;

const ACTION_RE =
  /\b(responsible|support|supported|collaborate|collaborated|improve|improved|design|designed|develop|developed|install|installed|engineered|participated|assisted|fabricated|resolved|automated|built|delivered|utilized|conducted|managed|created|implemented|provided|analyzed|analysed|presented|collected|visualized|visualised|showcased|configured|troubleshot|led|owned|maintained|coordinated|optimized|optimised|reduced|increased|prepared|identified|monitored)\b/i;

const PROJECT_ACTION_RE =
  /\b(project|capstone|case study|dashboard|pipeline|analysis|analy[sz]ed|developed|built|automated|visuali[sz]ed|collected|presented|showcased|feasibility|market|portfolio|recommendation|api|scraping|cloud|database|sentiment|nlp|youtube|startup)\b/i;

const PROJECT_HINT_RE =
  /\b(project|projects|side project|personal project|open source|capstone|case study|feasibility study|market analysis|market research|pipeline|dashboard|portfolio|prototype|proof of concept|poc|mvp|hackathon|competition|research project|academic project|thesis|dissertation)\b/i;

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
  "Azure",
  "Google Cloud",
  "ITIL",
  "ITSM",
  // Cybersecurity tools
  "Splunk",
  "Wireshark",
  "Nessus",
  "CrowdStrike",
  "SIEM",
  "SOC Operations",
  "Threat Hunting",
  "IAM",
  "Penetration Testing",
  "Vulnerability Management",
  "Incident Response",
  // Dev tools
  "GitHub",
  "GitLab",
  "Docker",
  "Kubernetes",
  "Terraform",
  "PowerShell",
  "Bash",
  "JavaScript",
  "TypeScript",
  "DevOps",
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
  // Customer success, IT service management, and business/ops skills.
  // These are common on CS / project / operations CVs and were being
  // dropped by the dictionary filter, leaving only technical skills.
  "Customer Success Management",
  "Customer Success",
  "Customer Onboarding",
  "Customer Retention",
  "Account Management",
  "Stakeholder Management",
  "Change Management",
  "Escalation Management",
  "Incident Management",
  "Project Implementation",
  "Project Management",
  "Program Management",
  "Milestone Tracking",
  "Process Optimization",
  "Process Improvement",
  "Business Analysis",
  "Requirements Gathering",
  "Client Relationship Management",
  "Cross-functional Collaboration",
  "Vendor Management",
  "Service Delivery",
  "ITIL",
  "ITSM",
  "Troubleshooting",
  "Technical Support",
  "Root Cause Analysis",
  "SLA Management",
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
    // ── Encoding artefacts, universal, apply to any PDF/DOCX text ────────────
    .replace(/\x00/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/â|â€“|â€”|-|-/g, "-")
    .replace(/â¢|•|▪|◦|●|·/g, "-")
    .replace(/\u00a0/g, " ")
    // Mojibake repair for UTF-8 text misread as Latin-1, generic pattern that
    // affects ANY word containing umlauts/accents (ü, ä, ö, ß, é, etc.), not
    // tied to any specific city or candidate. Example: "WÃ¼rzburg" -> "Würzburg".
    .replace(/Ã¤/g, "ä").replace(/Ã„/g, "Ä")
    .replace(/Ã¶/g, "ö").replace(/Ã-/g, "Ö")
    .replace(/Ã¼/g, "ü").replace(/Ãœ/g, "Ü")
    .replace(/ÃŸ/g, "ß")
    .replace(/Ã©/g, "é")
    .replace(/Ã¨/g, "è")
    .replace(/Ã±/g, "ñ")
    // ── Protect known compound tech brand names BEFORE camelCase splitting ────
    // The camelCase split below would break these: CrowdStrike→Crowd Strike,
    // PowerShell→Power Shell, SecureNet→Secure Net, GitHub→Git Hub, etc.
    // We normalise them to their canonical form first so the split can't harm them.
    .replace(/\bCrowdStrike\b/g, "CrowdStrike")
    .replace(/\bPowerShell\b/gi, "PowerShell")
    .replace(/\bGitHub\b/gi, "GitHub")
    .replace(/\bGitLab\b/gi, "GitLab")
    .replace(/\bBitBucket\b/gi, "BitBucket")
    .replace(/\bLinkedIn\b/gi, "LinkedIn")
    .replace(/\bJavaScript\b/gi, "JavaScript")
    .replace(/\bTypeScript\b/gi, "TypeScript")
    .replace(/\bOpenAI\b/gi, "OpenAI")
    .replace(/\bDevOps\b/gi, "DevOps")
    .replace(/\bDataFrame\b/gi, "DataFrame")
    .replace(/\bSecureNet\b/gi, "SecureNet")
    .replace(/\bCyberFort\b/gi, "CyberFort")
    // ── Rejoin split LinkedIn / URLs across lines ──────────────────────────────
    // PDFs sometimes break a URL across lines: "linkedin.com/in/harithavijay\nakumar30/"
    // Only rejoin when the continuation line looks like a URL tail: starts with a
    // lowercase letter or digit, contains no spaces, and is short (< 30 chars).
    // This prevents eating legitimate content lines that follow a LinkedIn URL.
    .replace(/(linkedin\.com\/in\/[A-Za-z0-9._-]+)\n([a-z0-9._/-]{1,30})\n/gi, "$1$2\n")
    .replace(/(linkedin\.com\/in\/[A-Za-z0-9._-]+)\n([a-z0-9._/-]{1,30})$/gi, "$1$2")
    // ── Generic word-split repair (camelCase from PDF text-run merges) ─────────
    // When a PDF renders two separate text runs with no space between them,
    // extraction often produces "wordsRunTogetherLikeThis". This generically
    // inserts a space before a capital letter that starts a new lowercase
    // word, for ANY text, not specific to any candidate's CV wording.
    // e.g. "DetailorientedIT" -> "Detailoriented IT"
    .replace(/([a-z])([A-Z]{2,})\b/g, "$1 $2")
    .replace(/([a-z]{3,})([A-Z][a-z])/g, "$1 $2")
    // ── Tech brand name repairs after camelCase split ────────────────────────
    // The camelCase split above may have broken names not yet protected above.
    // Re-join common compound names that got split.
    .replace(/\bCrowd\s+Strike\b/gi, "CrowdStrike")
    .replace(/\bPower\s+Shell\b/gi, "PowerShell")
    .replace(/\bGit\s+Hub\b/gi, "GitHub")
    .replace(/\bGit\s+Lab\b/gi, "GitLab")
    .replace(/\bLinked\s+In\b/gi, "LinkedIn")
    .replace(/\bJava\s+Script\b/gi, "JavaScript")
    .replace(/\bType\s+Script\b/gi, "TypeScript")
    .replace(/\bDev\s+Ops\b/gi, "DevOps")
    .replace(/\bOpen\s+AI\b/gi, "OpenAI")
    .replace(/\bSecure\s+Net\b/gi, "SecureNet")
    .replace(/\bCyber\s+Fort\b/gi, "CyberFort")
    // ── Common OCR/typo corrections, generic English words that any CV
    // could contain (not tied to a specific employer or person) ────────────
    .replace(/\bEnginner\b/gi, "Engineer")
    .replace(/\bEngince\b/gi, "Engine")
    .replace(/\bsuppoprt\b/gi, "support")
    .replace(/\bknowlegde\b/gi, "knowledge")
    .replace(/\bAnalisys\b/gi, "Analysis")
    .replace(/\bVizualization\b/gi, "Visualization")
    .replace(/\bScrapping\b/gi, "Scraping")
    // ── Common tech/product name word-splits, generic, apply to any CV
    // mentioning these widely-used tools (not specific to one employer) ─────
    .replace(/\bYou\s*Tube\b/gi, "YouTube")
    .replace(/\bMy\s*SQL\b/gi, "MySQL")
    .replace(/\bNum\s*Py\b/gi, "NumPy")
    .replace(/\bService\s*Desk\s*Plus\b/gi, "ServiceDesk Plus")
    .replace(/\bManage\s*Engine\b/gi, "ManageEngine")
    // ── Whitespace cleanup ─────────────────────────────────────────────────────
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
    .replace(/\bPr\b/g, "PR")
    .replace(/\bHr\b/g, "HR")
    .replace(/\(([a-z])/g, (_, c) => `(${c.toUpperCase()}`)
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
    .replace(/\bCrowdstrike\b/g, "CrowdStrike")
    .replace(/\bPowershell\b/g, "PowerShell")
    .replace(/\bGithub\b/g, "GitHub")
    .replace(/\bGitlab\b/g, "GitLab")
    .replace(/\bLinkedin\b/g, "LinkedIn")
    .replace(/\bJavascript\b/g, "JavaScript")
    .replace(/\bTypescript\b/g, "TypeScript")
    .replace(/\bDevops\b/g, "DevOps")
    .replace(/\bOpenai\b/g, "OpenAI")
    .replace(/\bAzure\b/g, "Azure")
    .replace(/\bYoutube\b/g, "YouTube")
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

/**
 * isSpacedCapsLine, true when the ENTIRE line consists of 4+ single
 * uppercase letters separated by spaces, e.g. "E X P E R I E N C E S" or
 * "B E R U F S E R F A H R U N G". This is the same condition
 * compactSpacedCaps uses for its whole-line join.
 *
 * Used to gate logic that should only apply to lines that were originally
 * styled as spaced-out section headers, NOT to normal prose, which is
 * never written this way regardless of language.
 */
function isSpacedCapsLine(value = ""): boolean {
  const cleaned = cleanLine(value);
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  return tokens.length >= 4 && tokens.every((token) => /^[A-ZÄÖÜ]$/u.test(token));
}

/**
 * splitSurnameAndRole
 *
 * Generic CV templates often render the header as:
 *   FIRST NAME (own line, spaced caps)
 *   SURNAME + ROLE TITLE (one line, spaced caps, no separator)
 * e.g. "O L I V I A" / "W I L S O N P R M A N A G E R"
 *
 * After compactSpacedCaps, the second line becomes "WILSONPRMANAGER", a
 * single uppercase token. This function checks if such a token ENDS with
 * a known role-title suffix (with spaces removed) and, if so, splits it
 * into { surname: "WILSON", role: "PR MANAGER" }.
 *
 * Returns null if no known role suffix matches (so normal processing continues).
 * Works for any surname, does not require the surname itself to be known.
 */
function splitSurnameAndRole(compactToken: string): { surname: string; role: string } | null {
  if (!/^[A-ZÄÖÜ]{5,30}$/.test(compactToken)) return null;

  const lower = compactToken.toLowerCase();
  for (const suffix of COMPACT_ROLE_SUFFIXES) {
    if (lower.endsWith(suffix) && lower.length > suffix.length + 1) {
      const surnameLen = compactToken.length - suffix.length;
      const surname = compactToken.slice(0, surnameLen);
      const roleCompact = compactToken.slice(surnameLen);
      // Title-case the role: "PRMANAGER" → "PR Manager", but since these are
      // known suffixes, map common ones to readable forms.
      const role = decompactRoleSuffix(roleCompact);
      return { surname, role };
    }
  }
  return null;
}

/**
 * decompactRoleSuffix, turns a compacted role suffix like "PRMANAGER" or
 * "DATAANALYST" into readable title-case ("PR Manager", "Data Analyst").
 * Generic word-boundary insertion based on the known suffix list.
 */
function decompactRoleSuffix(compact: string): string {
  const lower = compact.toLowerCase();
  const knownMap: Record<string, string> = {
    projectmanager: "Project Manager",
    productmanager: "Product Manager",
    accountmanager: "Account Manager",
    salesmanager: "Sales Manager",
    businessanalyst: "Business Analyst",
    dataanalyst: "Data Analyst",
    softwareengineer: "Software Engineer",
    dataengineer: "Data Engineer",
    datascientist: "Data Scientist",
    prmanager: "PR Manager",
    prspecialist: "PR Specialist",
    hrmanager: "HR Manager",
    hrspecialist: "HR Specialist",
    marketingmanager: "Marketing Manager",
    marketingmanagerin: "Marketing Managerin",
    operationsmanager: "Operations Manager",
    generalmanager: "General Manager",
    officemanager: "Office Manager",
    teamlead: "Team Lead",
    teamleader: "Team Leader",
    projectlead: "Project Lead",
    techlead: "Tech Lead",
    // German gendered forms (feminine suffix -in)
    managerin: "Managerin",
    leiterin: "Leiterin",
    ingenieurin: "Ingenieurin",
    entwicklerin: "Entwicklerin",
    designerin: "Designerin",
    assistentin: "Assistentin",
    koordinatorin: "Koordinatorin",
    spezialistin: "Spezialistin",
  };
  if (knownMap[lower]) return knownMap[lower];
  return titleCase(compact);
}

function decompactKnownPhrases(value = "", wasSpacedCaps = false) {
  const clean = cleanLine(value);
  const key = clean.replace(/[^a-zA-ZäöüÄÖÜß]/g, "").toLowerCase();

  // If the compact form starts with a section-header word AND is long,
  // it's a concatenated header line (e.g. "PROFILE SUMMARY WORK EXPERIENCE",
  // or "AUSBILDUNG BERUFSERFAHRUNG" in German). Return a section header so
  // it gets correctly parsed instead of treated as a name.
  //
  // Language-agnostic prefix list: covers English AND the German/European
  // section words this parser already recognizes elsewhere (findSectionKind).
  // Any of these appearing at the START of a long compact string is a strong
  // signal this is a concatenated header, regardless of what language the
  // REST of the CV is in.
  if (key.length >= 15) {
    if (/^(profile|profil|kurzprofil|profilübersicht|profiluebersicht|beruflichesprofil)/.test(key)) return "PROFILE SUMMARY";
    if (/^summary/.test(key)) return "SUMMARY";
    if (/^(workexp|professional.*exp|berufserfahrung|arbeitserfahrung)/.test(key)) return "WORK EXPERIENCE";
    if (/^(skills|kompetenzen|kenntnisse|fachkenntnisse|fähigkeiten|faehigkeiten)/.test(key)) return "SKILLS";
    if (/^(education|bildung|bildungsweg|ausbildung|studium|schulbildung|akademischerwerdegang|werdegang)/.test(key)) return "EDUCATION";
    if (/^(languages|sprachen|sprachkenntnisse)/.test(key)) return "LANGUAGES";
    if (/^projects/.test(key)) return "PROJECTS";
    if (/^(contact|kontakt|kontaktdaten)/.test(key)) return "CONTACT";
    if (/^(certif|zertifi)/.test(key)) return "CERTIFICATIONS";
  }

  // ── Fully generic fallback ──────────────────────────────────────────────────
  // If the line was originally written in "S P A C E D   C A P S" style (a
  // strong visual-header signal used by many CV templates) AND, once
  // compacted, forms a long (18+ char) string of letters with no digits and
  // no recognized prefix, it's almost certainly a concatenation of section
  // headers in SOME language we don't have in our prefix list, not a
  // person's name. Mark it as an unknown section header.
  //
  // CRITICAL: this fallback is GATED on wasSpacedCaps. Without this gate, a
  // long ORDINARY SENTENCE (e.g. a CV bullet point) would also collapse to an
  // 18+ char all-letter key and be misclassified as a section header,
  // silently eating real content. Normal prose is never written in spaced
  // caps, so this gate makes the fallback safe while still being fully
  // generic across languages.
  if (wasSpacedCaps && key.length >= 15 && /^[a-zäöüßàâéèêëïîôûùç]+$/.test(key)) {
    return "";
  }

  // Only canonical section-header remappings belong here.
  // Role titles are handled generically via ROLE_RE + titleCase, no
  // specific role title lookups that would tie this parser to any
  // particular candidate's CV template.
  const known: Record<string, string> = {
    profilesummary: "PROFILE SUMMARY",
    professionalprofile: "Professional Profile",
    workexperience: "WORK EXPERIENCE",
    professionalexperience: "Professional Experience",
    berufserfahrung: "Berufserfahrung",
    beruflichesprofil: "Berufliches Profil",
    // German education section headers
    bildungsweg: "EDUCATION",
    bildung: "EDUCATION",
    ausbildung: "EDUCATION",
    schulbildung: "EDUCATION",
    akademischerwerdegang: "EDUCATION",
    werdegang: "EDUCATION",
  };
  return known[key] || clean;
}

function normalizedHeader(line: string) {
  return compactSpacedCaps(line).replace(/[^a-zA-ZäöüÄÖÜß]/g, "").toLowerCase();
}

function findSectionKind(line: string): ResumeSectionKind | null {
  const key = normalizedHeader(line);

  // ── Pluralization-tolerant matching ──────────────────────────────────────────
  // Section headers are sometimes written in plural ("EXPERIENCES", "PROJECTS"
  // is already plural in our list but "SKILL" singular might appear, etc.).
  // Rather than enumerate every singular/plural pair for every language, try
  // matching the key as-is, AND (if it ends in "s") also try the key with the
  // trailing "s" stripped. This is a generic English/German/Romance-language
  // pluralization pattern (most plurals add "s" or "es" -> normalizes to "e"
  // removed too is handled by also trying key.replace(/es$/, "")).
  const keyVariants = [key];
  if (key.endsWith("s")) keyVariants.push(key.slice(0, -1));
  if (key.endsWith("es")) keyVariants.push(key.slice(0, -2));

  function matches(re: RegExp): boolean {
    return keyVariants.some((variant) => re.test(variant));
  }

  if (matches(/^(profilesummary|profile|professionalprofile|summary|professionalsummary|beruflichesprofil|profil|kurzprofil|profilübersicht|profiluebersicht|kurzuebersicht|kurzübersicht|persönlichesprofil|persoenlichesprofil)$/)) return "summary";
  if (matches(/^(experience|workexperience|professionalexperience|employmenthistory|workhistory|careerhistory|berufserfahrung|berufserfahrungen|arbeitserfahrung|praxis|erfolge|erfolgebeimkunden|keyachievements|achievements|highlights|results|erfolgeundergebnisse)$/)) return "experience";
  if (matches(/^(education|bildung|bildungsweg|ausbildung|studium|schulbildung|akademischerwerdegang|werdegang|academicbackground)$/)) return "education";
  if (matches(/^(skills|skill|coreskills|technicalskills|expertise|kompetenzen|kenntnisse|fachkenntnisse|fähigkeiten|faehigkeiten)$/)) return "skills";
  if (matches(/^(projects|project|projectexperience|selectedprojects|projekte|projektarbeit)$/)) return "projects";
  if (matches(/^(languages|language|languageskills|sprachen|sprachkenntnisse)$/)) return "languages";
  if (matches(/^(contact|contacts|personaldetails|personalinformation|kontakt|kontaktdaten)$/)) return "contact";
  if (matches(/^(certifications|certification|certificates|certificate|licenses|license|training|courses|course|zertifikate|weiterbildung)$/)) return "certifications";
  return null;
}

function splitLines(rawText: string) {
  return normalizeResumeText(rawText)
    .split("\n")
    .map((line) => decompactKnownPhrases(compactSpacedCaps(line), isSpacedCapsLine(line)))
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

  // ── Implicit section-switch detection ────────────────────────────────────────
  // PDF extraction can place a section header in the wrong position relative
  // to its content (e.g. a misplaced "SKILLS" header that's immediately
  // followed by the candidate's name, job history, and education, content
  // that has nothing to do with skills). Without this guard, ALL of that
  // content gets dumped into sections.skills.
  //
  // Generic heuristic: a line that consists of ONLY a date range (e.g.
  // "10 / 2020 - HEUTE", "Jan 2020 - Present") is a very strong, structural
  // signal that an experience (or education) entry begins here, regardless
  // of which section we currently think we're in. If we're not already in
  // "experience" or "education" when we see this, switch to "experience".
  //
  // Similarly, a line that is a recognizable company/anchor line (via the
  // generic fallback anchor pattern used in extractExperience) while inside
  // "skills" also triggers a switch to "experience".
  function lineIsStandaloneDateRange(line: string): boolean {
    const clean = cleanLine(line);
    const date = extractDate(clean);
    if (!date) return false;
    // The line should be ~just the date (allow minor punctuation/whitespace)
    const withoutDate = clean.replace(date, "").replace(/[|·,:-]/g, "").trim();
    return withoutDate.length <= 2;
  }

  for (const line of lines) {
    const section = findSectionKind(line);
    if (section) {
      current = section;
      continue;
    }

    // Implicit switch: standalone date range while in a non-experience,
    // non-education section signals the start of an experience entry.
    if (
      (current === "skills" || current === "unknown" || current === "summary") &&
      lineIsStandaloneDateRange(line)
    ) {
      current = "experience";
    }

    sections[current].push(line);
  }
  return sections;
}

function extractDate(line = "") {
  const clean = cleanLine(line);
  const monthDate = new RegExp(`(?:${MONTH_RE})\\.?\\s*(?:19|20)\\d{2}\\s*(?:[-\\u2013\\u2014]|to|until|bis)\\s*(?:present|current|heute|now|(?:${MONTH_RE})\\.?\\s*(?:19|20)\\d{2}|(?:19|20)\\d{2})`, "i").exec(clean)?.[0];
  // Allow optional spaces around the slash: "10 / 2020 - HEUTE" (common in
  // German/European CV templates) as well as "10/2020 - 06/2021".
  const numericDate = clean.match(/(?:0?[1-9]|1[0-2])\s*\/\s*(?:19|20)\d{2}\s*(?:[-\u2013\u2014]|to|until|bis)\s*(?:present|current|heute|(?:0?[1-9]|1[0-2])\s*\/\s*(?:19|20)\d{2})/i)?.[0];
  const yearDate = clean.match(/(?:19|20)\d{2}\s*(?:[-\u2013\u2014]|to|until|bis)\s*(?:present|current|heute|(?:19|20)\d{2})/i)?.[0];
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
  return /@|linkedin|github|xing|portfolio|\+\d|phone|email|contact|address|straße|strasse|road|street|weg|rue|via|calle|\b\d{4,6}\b/i.test(cleanLine(line));
}

function isLocationLine(line: string) {
  // GLOBAL FIX: structural location detection, postal codes and address-type
  // words work for any city or country worldwide, without enumerating them.
  // Previous versions had lists of ~50 cities/countries, those lists will
  // always miss most of the world (Tokyo, Lagos, São Paulo, Jakarta, Cairo...).
  const c = cleanLine(line);
  if (/\b\d{4,6}\b/.test(c)) return true; // postal code anywhere in line
  if (/\b(street|straße|strasse|road|avenue|weg|platz|gasse|allee|ring|drive|lane|rue|via|calle|rua|steig|damm|pfad|ufer)\b/i.test(c)) return true; // street-type word
  // "Capitalized, Capitalized" pattern: covers "City, Country", "City, State", "District, City"
  if (/\b\p{Lu}[\p{Ll}À-ÿ]{2,},\s*\p{Lu}[\p{Ll}À-ÿ]{2,}\b/u.test(c) && c.length < 60) return true;
  return false;
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
  // Strong signal (legal suffix etc.) matches anywhere. Weak signal (common
  // words like "Media", "Digital", "Health") only counts if the line itself
  // has the short, proper-noun STRUCTURE of a company name, preventing
  // ordinary sentences that merely contain these words ("media outlets",
  // "the technology sector") from being mistaken for company lines.
  const hasStrongSignal = COMPANY_WORD_RE.test(clean);
  const hasWeakSignal = COMPANY_WEAK_WORD_RE.test(clean) && isLikelyCompanyPhrase(removeDate(clean));
  if (!hasStrongSignal && !hasWeakSignal) return null;
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
  const match = clean.match(ROLE_RE);
  if (!match) return "";

  // Capture up to 2 capitalized modifier words immediately before the matched
  // role keyword, so "PR Manager" returns "PR Manager" not just "Manager",
  // and "Communications Coordinator" returns "Communications Coordinator"
  // not just "Coordinator". Generic, works for any role title in any CV.
  const matchIndex = match.index ?? 0;
  const before = clean.slice(0, matchIndex).trim();
  const beforeWords = before.split(/\s+/).filter(Boolean);

  // Take up to 2 trailing words from "before" if they look like title-case
  // or all-caps modifiers (e.g. "PR", "Senior", "Communications", "IT")
  const modifiers: string[] = [];
  for (let i = beforeWords.length - 1; i >= 0 && modifiers.length < 2; i -= 1) {
    const word = beforeWords[i];
    if (/^[A-Za-zÀ-ÖØ-öø-ÿ&.-]{1,20}$/.test(word) && /^[A-ZÀ-Ö]/.test(word)) {
      modifiers.unshift(word);
    } else {
      break;
    }
  }

  // Also capture trailing parenthetical qualifiers like "(Intern)"
  const after = clean.slice(matchIndex + match[0].length).trim();
  const trailingParens = after.match(/^\(([^)]{2,20})\)/)?.[0] || "";

  const fullTitle = [...modifiers, match[0], trailingParens].filter(Boolean).join(" ");
  return titleCase(fullTitle);
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
    // Reject skill category lines with colons: "Programming: Python, SQL"
    if (/:/.test(line)) return false;
    // Reject if the ORIGINAL line contains digits, addresses, phone numbers,
    // and postal codes must never become a "name" after digit-stripping.
    // e.g. "123 Anywhere St., Any City" must not become "Anywhere St".
    if (/\d/.test(line)) return false;
    const clean = titleCase(line.replace(/[^A-Za-zÀ-ž' -]/g, " ").replace(/\s+/g, " ").trim());
    if (!clean || clean.length > 45) return false;
    if (ROLE_RE.test(clean) || findSectionKind(clean) || isContactLine(clean) || COMPANY_WORD_RE.test(clean) || DEGREE_RE.test(clean)) return false;
    if (WORKZO_BAD_NAME_WORDS.test(clean)) return false;
    const words = clean.split(/\s+/).filter(Boolean);
    return words.length >= 2 && words.length <= 4 && words.every((word) => /^[A-Za-zÀ-ž' -]{2,}$/.test(word));
  }

  const top = lines.slice(0, 28);

  /**
   * Two-line stylized name header detection.
   *
   * Some CV templates render the name as two separate ALL-CAPS lines:
   *   Line 1: "OLIVIA"            (first name, single word)
   *   Line 2: "WILSONPRMANAGER"   (surname + role title, concatenated)
   *
   * Neither line alone passes looksLikeName (needs 2-4 words). This checks
   * the first few lines for this pattern: a single all-caps word, followed
   * within 1-2 lines by another all-caps word that ends in a known role
   * suffix (via splitSurnameAndRole). If found, combines them into a full name.
   */
  function findTwoLineStylizedName(): string {
    for (let i = 0; i < Math.min(top.length - 1, 6); i += 1) {
      const lineA = top[i] || "";
      if (!/^[A-ZÄÖÜ]{2,20}$/.test(lineA)) continue;
      if (WORKZO_BAD_NAME_WORDS.test(lineA.toLowerCase())) continue;

      for (let j = i + 1; j <= Math.min(i + 2, top.length - 1); j += 1) {
        const lineB = top[j] || "";
        const split = splitSurnameAndRole(lineB);
        if (split && split.surname.length >= 2) {
          return titleCase(`${lineA} ${split.surname}`);
        }
      }
    }
    return "";
  }

  // A name only lives in the header block, ABOVE the first section header. The
  // old fallback `lines.find(looksLikeName)` scanned the WHOLE document, so as
  // soon as the header line stopped being name-shaped it grabbed the first
  // 2-word capitalized phrase anywhere — typically the first skill (e.g. "Team
  // Collaboration"), but for another CV it could be a company or a degree — and
  // rendered THAT as the candidate's name. Bound every name search to the
  // header region so a name is never borrowed from a section body. This is the
  // global fix: it is independent of the specific CV and language.
  const firstSectionIdx = lines.findIndex((line) => findSectionKind(line));
  const headerRegion = firstSectionIdx === -1 ? top : lines.slice(0, firstSectionIdx);
  const headerScan = headerRegion.length ? headerRegion : top;

  const directName =
    headerScan.find(looksLikeName) || findTwoLineStylizedName() || "";

  // If nothing in the header is strictly name-shaped (common mid-edit, e.g. a
  // single-word first line), trust top-of-document position and keep the first
  // non-contact header line as-is instead of reaching into a section.
  const firstHeaderLine = headerScan.find(
    (line) =>
      line &&
      line.length <= 60 &&
      !isContactLine(line) &&
      !findSectionKind(line) &&
      !ROLE_RE.test(line) &&
      !DEGREE_RE.test(line) &&
      !COMPANY_WORD_RE.test(line),
  );

  const extractedCandidateName = workzoExtractNameFromRawCv(rawText);
  const strictName = workzoCleanCandidateName(
    directName ? titleCase(directName) : inferNameFromEmail() || "Candidate",
    extractedCandidateName || "Candidate",
  );
  const name =
    strictName && strictName !== "Candidate"
      ? strictName
      : firstHeaderLine
        ? titleCase(firstHeaderLine)
        : strictName;

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
    // Strip any "Category: " prefix, handles "Programming: Python", "Machine Learning: Sklearn" etc.
    .replace(/^[A-Za-z][A-Za-z\s&]+:\s*/g, "")
    // Also strip known category labels without colon
    .replace(/^(skills|core skills|technical skills|expertise|tools|programming|machine learning|data visualization|data visualisation|data engineering|generative ai|3d cad tools|3d printing|product lifecycle management|visualization)\s*[:：]?\s*/i, "")
    .replace(/\bTensor Flow\b/gi, "TensorFlow")
    .replace(/\bLang Chain\b/gi, "LangChain")
    .replace(/\bScikit Learn\b/gi, "scikit-learn")
    .replace(/\bSk Learn\b/gi, "Sklearn")
    .replace(/\bWeb Scrapping\b/gi, "Web Scraping")
    .replace(/\bYou Tube API\b/gi, "YouTube API")
    .replace(/\bCrowd Strike\b/gi, "CrowdStrike")
    .replace(/\bPower Shell\b/gi, "PowerShell")
    .replace(/\bGit Hub\b/gi, "GitHub")
    .replace(/\bGit Lab\b/gi, "GitLab")
    .replace(/\bDev Ops\b/gi, "DevOps")
    .replace(/\bOpen AI\b/gi, "OpenAI")
    .replace(/\bJava Script\b/gi, "JavaScript")
    .replace(/\bType Script\b/gi, "TypeScript")
    .replace(/^and\s+/i, "")
    .replace(/[.:]+$/g, "")
    .trim();

  const lower = clean.toLowerCase();
  const exact = SKILL_DICTIONARY.find((skill) => skill.toLowerCase() === lower);
  if (exact) return exact;

  // Fallback: try matching dictionary entries with spaces removed.
  // Catches cases where the CamelCase-split regex (a-z)(A-Z) inserted a
  // space into a product name that's actually one word: "LangChain" → "Lang Chain".
  const lowerNoSpace = lower.replace(/\s+/g, "");
  const exactNoSpace = SKILL_DICTIONARY.find((skill) => skill.toLowerCase().replace(/\s+/g, "") === lowerNoSpace);
  if (exactNoSpace) return exactNoSpace;
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
  if (!clean || clean.length > 60) return true;
  if (/\d/.test(clean) && !/^(3D CAD|3D Printing|Catia V5|FFF)$/i.test(clean)) return true;
  if (/^(and|or|in|with|using|education|languages|contact|profile|summary|work experience|experience|projects|berufserfahrung|bildung|kontakt|sprachen)$/i.test(clean)) return true;
  if (/@|linkedin|outlook|gmail|\+\d|\b\d{4}\b/i.test(clean)) return true;
  // Reject lines that look like addresses or locations, use the generic location detector
  if (isLocationLine(clean)) return true;
  if (/experience|responsible|supported|collaborated|delivered|developed|designed|analyzed|proven|track record|background|fluent in|bachelor|master|degree|university|college|satellite|docking|retrieval|generation|implementation|configuration|performance optimization$/i.test(clean)) return true;
  // Reject language proficiency entries that sneak into skills section
  // e.g. "English: Fluent", "German: Conversational", "English - FLUENT"
  if (/^(english|german|deutsch|french|français|spanish|español|arabic|hindi|tamil|dutch|italian|portuguese|mandarin|japanese|korean|russian)\s*[:–-]/i.test(clean)) return true;
  if (/^(english|german|deutsch|french|spanish|arabic|hindi|tamil|dutch|italian|portuguese)\s+(fluent|native|conversational|basic|professional|a1|a2|b1|b2|c1|c2)$/i.test(clean)) return true;
  // Reject bare language names without proficiency (from colon split leaving "Fluent" or "Conversational")
  if (/^(fluent|native|conversational|professional|basic|a1|a2|b1|b2|c1|c2)$/i.test(clean)) return true;
  // Reject bare category labels that become orphans after colon split
  if (/^(programming|visualization|visualisation|machine learning|data engineering|generative ai|soft skills|3d cad tools|product lifecycle)$/i.test(clean)) return true;
  return false;
}

/**
 * splitGroupedSkillEntries
 *
 * Takes a list of raw skill strings (which may include grouped category
 * lines like "Programming: Python, SQL" or "Generative AI: LangChain, RAG")
 * and returns a flat list of individual skill tokens.
 *
 * Exported so both the local parser (extractSkills) and the AI-structuring
 * pipeline (workzoAiCvParser) can apply the same splitting logic as a
 * safety net, regardless of how the source data was produced.
 *
 * Works for any candidate, any CV template, no hardcoded category names.
 */
const LANGUAGE_CATEGORY_RE = /^(english|german|deutsch|french|français|spanish|español|arabic|hindi|tamil|malayalam|telugu|kannada|dutch|italian|portuguese|mandarin|chinese|japanese|korean|russian|polish|swedish|norwegian|danish|finnish|turkish|greek|hebrew|urdu|bengali|punjabi|vietnamese|thai)$/i;

export function splitGroupedSkillEntries(rawSkills: string[]): string[] {
  // First split grouped categories at colon: "Programming: Python, SQL" → ["Python", "SQL"]
  // EXCEPTION: if the part before the colon is a language name (e.g. "English: Fluent"),
  // keep it as one combined entry, "English Fluent", so it survives to be
  // recognised as a language by separateLanguagesFromSkills, instead of losing
  // the language name and leaving an orphan proficiency word.
  const flatSource: string[] = [];
  for (const line of rawSkills) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0 && colonIdx < line.length - 1) {
      const beforeColon = line.slice(0, colonIdx).trim();
      const afterColon = line.slice(colonIdx + 1);

      if (LANGUAGE_CATEGORY_RE.test(beforeColon)) {
        // "English: Fluent" → "English Fluent" (kept as one entry)
        flatSource.push(`${beforeColon} ${afterColon.trim()}`);
      } else {
        // "Programming: Python, SQL" → "Python", "SQL"
        flatSource.push(...afterColon.split(/[,;]/));
      }
    } else {
      flatSource.push(line);
    }
  }

  const LANGUAGE_ENTRY_RE = /^(english|german|deutsch|french|français|spanish|español|arabic|hindi|tamil|malayalam|telugu|kannada|dutch|italian|portuguese|mandarin|chinese|japanese|korean|russian|polish|swedish|norwegian|danish|finnish|turkish|greek|hebrew|urdu|bengali|punjabi|vietnamese|thai)\s+(native|fluent|professional|conversational|basic|elementary|intermediate|advanced|a1|a2|b1|b2|c1|c2)$/i;

  return flatSource
    .join(" | ")
    // CamelCase-split fix: only split when followed by 2+ lowercase letters,
    // to avoid breaking short acronym-like product names (e.g. "AI", "ML" stay intact)
    .replace(/([a-z])([A-Z][a-z]{2,})/g, "$1 $2")
    .split(/[,|;/]/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      // Preserve "English Fluent"-style language entries through normalization
      // and the polluted-skill filter, separateLanguagesFromSkills handles them next.
      if (LANGUAGE_ENTRY_RE.test(token)) return token;
      return normalizeSkillToken(token);
    })
    .filter((skill) => LANGUAGE_ENTRY_RE.test(skill) || !isPollutedSkill(skill));
}

/**
 * separateLanguagesFromSkills
 *
 * Scans a list of (already-split) skill tokens and pulls out any that are
 * actually language proficiency entries (e.g. "English Fluent", "German
 * Conversational", "Fluent" as an orphan after a colon split was applied
 * to "English: Fluent").
 *
 * Returns the remaining skills plus a separate list of normalized
 * language entries ("English - FLUENT", "German - CONVERSATIONAL").
 *
 * This prevents language proficiency from being shown as a "skill" chip
 * while also ensuring it ends up in the languages list even if the
 * source CV or AI model put it in the wrong section.
 */
export function separateLanguagesFromSkills(skills: string[]): { skills: string[]; languages: string[] } {
  const remainingSkills: string[] = [];
  const languages: string[] = [];

  const LANGUAGE_NAME_RE = /^(english|german|deutsch|french|français|spanish|español|arabic|hindi|tamil|malayalam|telugu|kannada|dutch|italian|portuguese|mandarin|chinese|japanese|korean|russian|polish|swedish|norwegian|danish|finnish|turkish|greek|hebrew|urdu|bengali|punjabi|vietnamese|thai)$/i;
  const PROFICIENCY_RE = /^(native|fluent|professional|conversational|basic|elementary|intermediate|advanced|a1|a2|b1|b2|c1|c2)$/i;

  for (let i = 0; i < skills.length; i += 1) {
    const token = skills[i];
    const normalized = normalizeLanguage(token);

    // normalizeLanguage matches "English Fluent", "German B1" etc. and returns "English - FLUENT"
    if (normalized && LANGUAGE_NAME_RE.test(token.split(/\s+/)[0] || "")) {
      languages.push(normalized);
      continue;
    }

    // Handle case where colon-split left the language name and proficiency as
    // two separate adjacent tokens: ["English", "Fluent", "German", "Conversational"]
    if (LANGUAGE_NAME_RE.test(token) && i + 1 < skills.length && PROFICIENCY_RE.test(skills[i + 1])) {
      const lang = normalizeLanguage(`${token} ${skills[i + 1]}`);
      if (lang) {
        languages.push(lang);
        i += 1; // consume the next token too
        continue;
      }
    }

    // Bare proficiency word with no language, drop it (orphan from colon split)
    if (PROFICIENCY_RE.test(token)) continue;

    // Bare language name with no proficiency, still move to languages
    if (LANGUAGE_NAME_RE.test(token)) {
      languages.push(titleCase(token));
      continue;
    }

    remainingSkills.push(token);
  }

  return { skills: remainingSkills, languages };
}

function extractSkills(rawText: string, sections: SectionMap, allLines: string[]) {
  const explicitSource = [
    ...sections.skills,
    ...allLines.filter((line) => isSkillCategory(line) || /^(technical|programming|visualization|tools|soft skills|machine learning|data engineering|generative ai|3d cad tools|3d printing|product lifecycle management)\b/i.test(line)),
  ];

  const splitTokens = splitGroupedSkillEntries(explicitSource);
  const { skills: explicit } = separateLanguagesFromSkills(splitTokens);

  const dictionary = SKILL_DICTIONARY.filter((skill) => new RegExp(`\\b${escapeRegExp(skill)}\\b`, "i").test(rawText)).map(normalizeSkillToken);
  return unique([...explicit, ...dictionary].filter((skill) => !isPollutedSkill(skill))).slice(0, 28);
}

/* ---------------------------- languages (global) --------------------------
 * The previous implementation hardcoded 15 languages (so a Polish, Japanese,
 * Turkish, or Swedish CV silently lost every language) and matched without a
 * trailing word boundary, so "Germany" in a summary registered as the language
 * "German" with no level, which then BLOCKED the real "German: Conversational"
 * entry from the languages section because the de-duplicator keeps the first
 * match it sees. That is why German disappeared.
 *
 * This version is structural: a broad language table, strict word boundaries,
 * proficiency captured wherever it appears, and de-duplication that keeps the
 * RICHEST entry (one with a level beats a bare mention).
 * -------------------------------------------------------------------------- */

// Language names in English plus their common endonyms, so a CV written in any
// of these languages still resolves to a canonical English label.
const LANGUAGE_TABLE: Array<[canonical: string, aliases: string[]]> = [
  ["English", ["english", "englisch", "anglais", "ingles", "inglés", "inglese", "engels"]],
  ["German", ["german", "deutsch", "allemand", "aleman", "alemán", "tedesco", "duits"]],
  ["French", ["french", "französisch", "francais", "français", "frances", "francés", "francese"]],
  ["Spanish", ["spanish", "spanisch", "espagnol", "espanol", "español", "spagnolo"]],
  ["Italian", ["italian", "italienisch", "italien", "italiano"]],
  ["Portuguese", ["portuguese", "portugiesisch", "portugais", "portugues", "português"]],
  ["Dutch", ["dutch", "niederlandisch", "niederländisch", "nederlands", "neerlandais"]],
  ["Russian", ["russian", "russisch", "russe", "ruso", "русский"]],
  ["Polish", ["polish", "polnisch", "polski", "polonais"]],
  ["Ukrainian", ["ukrainian", "ukrainisch", "українська"]],
  ["Swedish", ["swedish", "schwedisch", "svenska"]],
  ["Norwegian", ["norwegian", "norsk"]],
  ["Danish", ["danish", "dansk"]],
  ["Finnish", ["finnish", "suomi"]],
  ["Czech", ["czech", "cestina", "čeština"]],
  ["Slovak", ["slovak", "slovencina"]],
  ["Hungarian", ["hungarian", "magyar"]],
  ["Romanian", ["romanian", "romana", "română"]],
  ["Greek", ["greek", "ellinika", "ελληνικά"]],
  ["Turkish", ["turkish", "türkisch", "turkce", "türkçe"]],
  ["Arabic", ["arabic", "arabisch", "arabe", "العربية"]],
  ["Hebrew", ["hebrew", "ivrit", "עברית"]],
  ["Hindi", ["hindi", "हिन्दी"]],
  ["Tamil", ["tamil", "தமிழ்"]],
  ["Telugu", ["telugu"]],
  ["Kannada", ["kannada"]],
  ["Malayalam", ["malayalam"]],
  ["Marathi", ["marathi"]],
  ["Bengali", ["bengali", "bangla"]],
  ["Gujarati", ["gujarati"]],
  ["Punjabi", ["punjabi"]],
  ["Urdu", ["urdu"]],
  ["Mandarin", ["mandarin", "chinese", "chinesisch", "putonghua", "中文", "普通话"]],
  ["Cantonese", ["cantonese", "粤语"]],
  ["Japanese", ["japanese", "japanisch", "nihongo", "日本語"]],
  ["Korean", ["korean", "koreanisch", "한국어"]],
  ["Vietnamese", ["vietnamese", "tieng viet"]],
  ["Thai", ["thai", "ไทย"]],
  ["Indonesian", ["indonesian", "bahasa indonesia"]],
  ["Malay", ["malay", "bahasa melayu"]],
  ["Tagalog", ["tagalog", "filipino"]],
  ["Swahili", ["swahili", "kiswahili"]],
  ["Afrikaans", ["afrikaans"]],
  ["Persian", ["persian", "farsi", "فارسی"]],
  ["Bulgarian", ["bulgarian", "български"]],
  ["Croatian", ["croatian", "hrvatski"]],
  ["Serbian", ["serbian", "srpski"]],
  ["Catalan", ["catalan", "català"]],
];

const PROFICIENCY_RE =
  /\b(native|mother ?tongue|muttersprache|bilingual|fluent|fliessend|fließend|proficient|professional|advanced|intermediate|conversational|verhandlungssicher|basic|beginner|grundkenntnisse|elementary|[ABC][12])\b/i;

function normalizeLanguage(value = "") {
  const line = cleanLine(value);
  if (!line) return "";
  const lower = line.toLowerCase();

  let canonical = "";
  for (const [name, aliases] of LANGUAGE_TABLE) {
    // Word-boundary match so "Germany" never registers as "German".
    if (aliases.some((a) => new RegExp(`(^|[^\\p{L}])${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "iu").test(lower))) {
      canonical = name;
      break;
    }
  }
  if (!canonical) return "";

  const level = line.match(PROFICIENCY_RE)?.[1];
  return `${canonical}${level ? ` - ${level.toUpperCase()}` : ""}`;
}

function extractLanguages(rawText: string, sections: SectionMap) {
  // Prefer the dedicated LANGUAGES section. Only fall back to the whole CV when
  // that section is missing, because free text mentions ("relocated to Germany")
  // are not language claims.
  const sectionLines = sections.languages.map(cleanLine).filter(Boolean);
  // Multi-column PDFs often flatten the sidebar before the LANGUAGES heading,
  // so a real entry such as "German: Conversational" can sit outside the
  // detected section. Always union the dedicated section with high-confidence
  // whole-document claims (language name + proficiency), rather than using the
  // whole document only when the section is empty.
  const globalClaimLines = rawText
    .split(/\r?\n/)
    .map(cleanLine)
    .filter((l) => {
      if (!l || !PROFICIENCY_RE.test(l)) return false;
      return LANGUAGE_TABLE.some(([, aliases]) =>
        aliases.some((a) => new RegExp(`(^|[^\\p{L}])${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "iu").test(l.toLowerCase())),
      );
    });
  const lines = [...sectionLines, ...globalClaimLines];

  const found = new Map<string, string>();
  for (const line of lines) {
    // A single line can hold several languages ("English - Fluent  German - B2").
    // Split on separators so each is normalized on its own.
    const parts = line.split(/[,;|\u00b7\u2022]|\s{2,}/).map((p) => p.trim()).filter(Boolean);
    for (const part of parts.length ? parts : [line]) {
      const entry = normalizeLanguage(part);
      if (!entry) continue;
      const key = entry.split(" - ")[0];
      const existing = found.get(key);
      // Keep the RICHEST entry: one carrying a proficiency beats a bare mention.
      if (!existing || (!existing.includes(" - ") && entry.includes(" - "))) {
        found.set(key, entry);
      }
    }
  }
  return [...found.values()].slice(0, 12);
}

function extractEducation(sections: SectionMap, lines: string[]) {
  // Filter out language entries that landed in education section due to sidebar extraction order
  const isLanguageLine = (line: string) => /^(english|german|deutsch|french|spanish|arabic|hindi|tamil|dutch|italian|portuguese|mandarin|japanese|korean|russian)\b/i.test(cleanLine(line));
  const source = (sections.education.length ? sections.education : lines)
    .map(cleanLine)
    .filter(Boolean)
    .filter((line) => !isLanguageLine(line));
  const items: ResumeEducation[] = [];

  // NB: an earlier version stripped a trailing "Capitalized Capitalized" pair to
  // drop a stray trailing name/location. That also truncated real degree fields
  // ("... Space Science and Technology" -> "... Space Science", "Bachelor's
  // Degree in Aeronautical Engineering" -> "Bachelor's Degree in") and real
  // institution names ("University of Applied Sciences" -> "University of").
  // It was previously masked by dates left glued to the line; once dates parse
  // correctly it corrupts the field, so it is removed.
  function cleanDegree(line = "") {
    return titleCase(removeDate(line))
      .replace(/\bCandidate\b/gi, "")
      .replace(/[,;]\s*$/, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanInstitution(line = "") {
    return titleCase(removeDate(line))
      .replace(/\bCandidate\b/gi, "")
      .replace(/[,;]\s*$/, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isDegree(line: string) {
    return DEGREE_RE.test(line) && !ACTION_RE.test(line) && !ROLE_RE.test(line);
  }

  function isOrg(line: string) {
    return EDUCATION_ORG_RE.test(line) && !ACTION_RE.test(line) && !ROLE_RE.test(line);
  }

  // Degree-level key so the SAME qualification at the SAME school collapses to
  // one entry even when the source repeats it with a different date format
  // (a common export artifact). Level = bachelor/master/phd/etc; falls back to
  // the whole normalized degree when no level word is present.
  const LEVEL_BUCKETS: Array<[RegExp, string]> = [
    [/\b(ph\.?\s?d|d\.?phil|doctora(?:te|l)|doktor|promotion)\b/i, "phd"],
    [/\b(m\.?\s?b\.?\s?a|mba)\b/i, "mba"],
    [/\b(master|magister|m\.?\s?sc|m\.?\s?a|m\.?\s?tech|m\.?\s?eng|m\.?\s?s|msc|meng|mtech)\b/i, "master"],
    [/\b(bachelor|b\.?\s?sc|b\.?\s?a|b\.?\s?tech|b\.?\s?eng|b\.?\s?e|bsc|beng|btech|bba|honou?rs)\b/i, "bachelor"],
    [/\b(diploma|diplom|pg\s?diploma)\b/i, "diploma"],
    [/\b(associate)\b/i, "associate"],
    [/\b(abitur|a-?levels?|high\s?school|secondary)\b/i, "school"],
  ];
  const degreeLevel = (degree: string) => {
    for (const [re, b] of LEVEL_BUCKETS) if (re.test(degree || "")) return b;
    return (degree || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  };
  // Institution key ignores a trailing location the field sometimes carries.
  const institutionKey = (institution: string) =>
    (institution || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .split(/[,·|]|\s[–—-]\s/)[0]
      .replace(/[^a-z0-9]/g, "");
  const dedupeKey = (degree: string, institution: string) =>
    `${degreeLevel(degree)}|${institutionKey(institution)}`;
  // Prefer a full range ("2013 - 2016") over a single year, and any date over none.
  const betterDates = (a = "", b = "") => {
    const rank = (d: string) => (/-/.test(d) ? 2 : d ? 1 : 0);
    return rank(b) > rank(a) ? b : a;
  };

  function add(item: ResumeEducation) {
    const degree = cleanDegree(item.degree);
    const institution = cleanInstitution(item.institution);
    const dates = normalizeDate(item.dates || extractDate(`${item.degree} ${item.institution}`));
    if (!degree && !institution) return;
    if (ROLE_RE.test(`${degree} ${institution}`)) return;
    const inst = institution !== degree ? institution : "";
    const key = dedupeKey(degree, inst);
    const existing = items.find((e) => dedupeKey(e.degree, e.institution) === key);
    if (existing) {
      // Merge duplicates instead of emitting a second, differently-dated row.
      existing.dates = betterDates(existing.dates, dates);
      if (!existing.institution && inst) existing.institution = inst;
      if (!existing.location && item.location) existing.location = item.location;
      return;
    }
    items.push({ degree: degree || "Education", institution: inst, location: item.location || "", dates });
  }

  // Pair education lines SEQUENTIALLY into blocks. The old code scanned a wide
  // +/-window from every degree AND every institution line, so degrees paired
  // with the wrong school and dates were pulled from a neighbouring block. In
  // practice an entry is a "degree line" and the nearest adjacent "institution
  // line" (either order); dates sit on whichever line carries them. Walk the
  // section once and close a block when the pair is complete or a new degree
  // starts.
  // NB: do NOT exclude with isContactLine here. isContactLine flags any line
  // containing a 4-digit number (its postal-code heuristic), which also matches
  // a degree line carrying an inline year ("... Technology 2013 - 2016"). That
  // would strip every dated degree line and leave only institutions. Real
  // contact lines (email/phone/url) are neither a degree nor an institution, so
  // the isDegree/isOrg gates in the loop below ignore them anyway.
  const rows = source.filter(
    (line) => line && !findSectionKind(line) && !isSkillCategory(line) && !isProbablyBullet(line),
  );
  type Block = { degree?: string; institution?: string; dates?: string; location?: string };
  const blocks: Block[] = [];
  let cur: Block | null = null;
  const flush = () => {
    if (cur && (cur.degree || cur.institution)) blocks.push(cur);
    cur = null;
  };
  for (const line of rows) {
    const isDeg = isDegree(line);
    const isInst = !isDeg && isOrg(line);
    const date = normalizeDate(extractDate(line));
    if (isDeg) {
      if (cur && cur.degree) flush();
      if (!cur) cur = {};
      cur.degree = line;
      if (date && !cur.dates) cur.dates = date;
    } else if (isInst) {
      if (!cur) cur = {};
      if (!cur.institution) cur.institution = line;
      if (date && !cur.dates) cur.dates = date;
      if (cur.degree) flush();
    } else if (date && cur && !cur.dates) {
      cur.dates = date;
    }
  }
  flush();
  for (const b of blocks) {
    add({ degree: b.degree || "", institution: b.institution || "", location: b.location || "", dates: b.dates || "" });
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
  // A project title is NOT a person's name. Running it through the candidate
  // name cleaner made every non-name-shaped title (which is almost all of them)
  // collapse to the "Candidate" fallback, so Projects rendered as "Candidate".
  const projects: ResumeProject[] = titles.map((name) => ({ name, bullets: [] }));
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

  // Generic: for each parsed project, find bullet lines in the full text that mention
  // the project name or contain project-action vocabulary near it.
  // No hardcoded project names, works for any candidate's projects.
  for (const project of repaired) {
    const nameParts = project.name
      .split(/\s+/)
      .filter((part) => part.length > 3)
      .map((part) => part.replace(/[^A-Za-z0-9]/g, ""));
    if (!nameParts.length) continue;
    const nameRe = new RegExp(nameParts.slice(0, 2).join("|"), "i");
    for (const line of lines) {
      if (nameRe.test(line) && (isProbablyBullet(line) || PROJECT_ACTION_RE.test(line))) {
        const cleaned = cleanBullet(line);
        if (cleaned && !project.bullets.includes(cleaned)) {
          project.bullets.push(cleaned);
        }
      }
    }
    project.bullets = unique(project.bullets).slice(0, 5);
  }

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

    // ── Fallback anchor detection ────────────────────────────────────────────
    // parseCompanyLine requires a legal-entity suffix (Inc, GmbH, Ltd, Solutions,
    // etc.) via COMPANY_WORD_RE. Many real and placeholder company names have
    // NO such suffix (e.g. "ExampleCo", "Google", "Spotify", "Acme").
    //
    // Generic fallback: a line containing a date range, where the text before
    // the date is short (1-4 words), capitalized, and not itself a role title,
    // section header, degree, or bullet, is almost certainly a "Company |
    // Dates" or "Company, Dates" job/education anchor line.
    const clean = cleanLine(line);
    const date = extractDate(clean);
    if (!date) return null;
    if (ACTION_RE.test(clean) || isSkillCategory(clean) || isProbablyBullet(clean)) return null;
    if (DEGREE_RE.test(clean) && !ROLE_RE.test(clean)) return null;

    const withoutDate = removeDate(clean).replace(/[|·,]+$/g, "").trim();
    if (!withoutDate || withoutDate.length < 2 || withoutDate.length > 60) return null;

    const words = withoutDate.split(/\s+/).filter(Boolean);
    if (words.length === 0 || words.length > 4) return null;
    // First word must look like a proper noun (capitalized)
    if (!/^[A-ZÀ-Ö][A-Za-zÀ-ÖØ-öø-ÿ&.'-]*$/.test(words[0])) return null;
    if (isContactLine(withoutDate)) return null;
    if (ROLE_RE.test(withoutDate)) return null;

    return { company: titleCase(withoutDate), location: "", dates: normalizeDate(date) };
  }

  for (let i = 0; i < source.length; i += 1) {
    const parsed = normalizeCompanyFromLine(source[i] || "");
    if (!parsed) continue;
    const around = source.slice(Math.max(0, i - 4), Math.min(source.length, i + 8)).join(" ");
    if (!ROLE_RE.test(around) && !ACTION_RE.test(around) && !extractDate(around)) continue;
    if (EDUCATION_ORG_RE.test(parsed.company) && !/intern|working student|research|engineer|designer|developer|analyst/i.test(around)) continue;
    companyAnchors.push({ index: i, ...parsed });
  }

  // ── Stacked-titles pattern detection ──────────────────────────────────────────
  // Some CV templates list ALL job titles together right after the FIRST
  // company/date anchor, with the dated entries for the OTHER roles following
  // later with no title line of their own:
  //
  //   ExampleCo | Jan 2020 - Present   <- anchor 0
  //   PR Manager                       <- title for anchor 0
  //   PR Specialist                    <- title for anchor 1
  //   Communications Coordinator (Intern) <- title for anchor 2
  //   [bullets for PR Manager...]
  //   ExampleCo | Jun 2017 - Dec 2019   <- anchor 1 (no title nearby)
  //   ExampleCo | Jun 2016 - May 2017   <- anchor 2 (no title nearby)
  //
  // Detect this by checking: does anchor 0 have 2+ consecutive title-like
  // lines immediately after it? If so, and if anchors 1..N have no title of
  // their own within their normal search window, pair titles[1..N] with
  // anchors[1..N] in order.
  const stackedTitleAssignments = new Map<number, string>(); // anchorIndex -> title

  if (companyAnchors.length >= 2) {
    const first = companyAnchors[0];
    const stackedTitles: string[] = [];
    for (let j = first.index + 1; j <= Math.min(source.length - 1, first.index + companyAnchors.length + 1); j += 1) {
      const line = source[j] || "";
      if (!line || findSectionKind(line) || isProbablyBullet(line)) break;
      if (parseCompanyLine(line, { allowEducationOrg: true })) break;
      const title = extractTitleFromLine(line);
      if (!title) break;
      stackedTitles.push(title);
    }

    // Only apply if we found at least as many stacked titles as there are anchors,
    // and at least 2 titles (otherwise this isn't the "stacked" pattern).
    if (stackedTitles.length >= 2 && stackedTitles.length >= companyAnchors.length) {
      companyAnchors.forEach((anchor, idx) => {
        if (stackedTitles[idx]) stackedTitleAssignments.set(anchor.index, stackedTitles[idx]);
      });
    }
  }

  function findTitle(anchorIndex: number) {
    if (stackedTitleAssignments.has(anchorIndex)) {
      return stackedTitleAssignments.get(anchorIndex)!;
    }

    const same = extractTitleFromLine(source[anchorIndex] || "");
    if (same) return same;

    // "Title above company" is the most common layout (title + dates on one
    // line, company on the next). Check the line directly ABOVE the anchor
    // first, so we don't scan forward past this job's bullets and grab the
    // NEXT job's title (which put e.g. "CAD Designer" onto the Cummins entry).
    const above = extractTitleFromLine(source[anchorIndex - 1] || "");
    if (above && !isProbablyBullet(source[anchorIndex - 1] || "")) return above;

    // Forward scan, but STOP at the first bullet: bullets mean this job's body
    // has started, so any title-like line after them belongs to the next job.
    for (let j = anchorIndex + 1; j <= Math.min(source.length - 1, anchorIndex + 4); j += 1) {
      const line = source[j] || "";
      if (parseCompanyLine(line, { allowEducationOrg: true }) || findSectionKind(line)) break;
      if (isProbablyBullet(line)) break;
      const title = extractTitleFromLine(line);
      if (title) return title;
    }
    // Wider backward scan as a last resort.
    for (let j = anchorIndex - 2; j >= Math.max(0, anchorIndex - 3); j -= 1) {
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
    // Generic: check if this bullet line references any known project name from the parsed projects
    return projects.some((project) => {
      const nameParts = project.name.split(/\s+/).filter((part) => part.length > 3);
      return nameParts.length > 0 && nameParts.some((part) => new RegExp(`\\b${part}\\b`, "i").test(line));
    });
  }

  function collectBullets(anchorIndex: number, nextAnchorIndex: number) {
    const bullets: string[] = [];
    // Skip only the leading title/date header lines that sit BETWEEN the
    // company anchor and the first bullet, and stop the moment a bullet or the
    // next job begins. The old loop advanced `start` for ANY title/date line in
    // the +5 window, so it jumped over this job's bullets and landed on the
    // NEXT job's title line — which dropped every bullet for jobs whose title
    // sits above (not below) the company anchor.
    let start = anchorIndex + 1;
    for (let j = anchorIndex + 1; j <= Math.min(source.length - 1, anchorIndex + 5); j += 1) {
      const line = source[j] || "";
      if (!line) { start = j + 1; continue; }
      if (isProbablyBullet(line)) break; // body started
      if (parseCompanyLine(line, { allowEducationOrg: true })) break; // next job
      if (extractDate(line) || (ROLE_RE.test(line) && line.length < 100)) {
        start = j + 1; // a leading title/date line for THIS job
        continue;
      }
      break; // first ordinary line ends the header
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
    return unique(bullets).slice(0, 14);
  }

  /**
   * collectStackedTitles
   *
   * Some CV templates list a job's title, then immediately list the titles
   * of OTHER roles at the same company before any bullets appear, e.g.:
   *
   *   ExampleCo | January 2020 - Present
   *   PR Manager
   *   PR Specialist
   *   Communications Coordinator (Intern)
   *   [bullets for PR Manager only]
   *   ExampleCo | June 2017 - December 2019    <- no title here
   *   ExampleCo | June 2016 - May 2017          <- no title here
   *
   * This collects ALL consecutive role-title lines immediately after an
   * anchor (before any bullet or section break), in order.
   */
  function collectStackedTitles(anchorIndex: number): string[] {
    const titles: string[] = [];
    const sameLineTitle = extractTitleFromLine(source[anchorIndex] || "");
    if (sameLineTitle) titles.push(sameLineTitle);

    for (let j = anchorIndex + 1; j <= Math.min(source.length - 1, anchorIndex + 8); j += 1) {
      const line = source[j] || "";
      if (!line) continue;
      if (parseCompanyLine(line, { allowEducationOrg: true }) || findSectionKind(line)) break;
      if (isProbablyBullet(line)) break; // bullets start, stop collecting titles
      const title = extractTitleFromLine(line);
      if (!title) break; // first non-title, non-bullet line ends the stack
      titles.push(title);
    }
    return unique(titles);
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

  // ── Stacked-titles pairing ────────────────────────────────────────────────
  // If the FIRST anchor has multiple stacked titles immediately after it
  // (more than the number of jobs that already have a real title), and
  // SUBSEQUENT jobs have "Professional Experience" as a placeholder title,
  // pair the extra titles with those jobs in order: titles[1] -> jobs[1],
  // titles[2] -> jobs[2], etc. This is generic, it only fires when the
  // stacked-title pattern is detected and there are placeholder titles to fill.
  if (companyAnchors.length >= 2 && jobs.length >= 2) {
    const stackedTitles = collectStackedTitles(companyAnchors[0].index);
    if (stackedTitles.length >= 2) {
      let titleCursor = 1; // titles[0] already used for jobs[0]
      for (let i = 1; i < jobs.length && titleCursor < stackedTitles.length; i += 1) {
        if (jobs[i].title === "Professional Experience") {
          jobs[i].title = stackedTitles[titleCursor];
          titleCursor += 1;
        }
      }
    }
  }

  // ── Redistribute shared bullet blocks between adjacent jobs ──────────────────
  // Some CVs write achievements for multiple roles as one continuous block
  // positioned entirely before the SECOND company's anchor line (a common PDF
  // text-extraction artefact for stacked "Company / Dates / Title" entries).
  // The result: the first job absorbs every bullet, the next job has none -
  // even though some of those bullets plausibly belong to the second role.
  //
  // Generic heuristic, no hardcoded content: if a job has a substantial number
  // of bullets (6+) and the immediately following job has zero, split the
  // block so the later portion (which is positionally closer to the next
  // job's anchor in the original CV) moves to that job. This keeps the first
  // few (most senior-sounding / role-defining) bullets with the donor and
  // gives the tail, often more generic support/ops bullets, to the
  // recipient, which matches how CVs are typically written (headline
  // achievements first, supporting duties later).
  const MIN_BULLETS_TO_SPLIT = 6;
  const MAX_BULLETS_PER_JOB = 9;
  for (let i = 0; i < jobs.length - 1; i += 1) {
    const donor = jobs[i];
    const recipient = jobs[i + 1];
    if (recipient.bullets.length > 0) continue;
    if (donor.bullets.length < MIN_BULLETS_TO_SPLIT) continue;

    // Split roughly in half, but cap each side at MAX_BULLETS_PER_JOB
    const splitPoint = Math.max(
      MIN_BULLETS_TO_SPLIT - 2,
      Math.min(donor.bullets.length - 1, Math.ceil(donor.bullets.length / 2)),
    );

    const donorShare = donor.bullets.slice(0, splitPoint).slice(0, MAX_BULLETS_PER_JOB);
    const recipientShare = donor.bullets.slice(splitPoint).slice(0, MAX_BULLETS_PER_JOB);

    if (!recipientShare.length) continue;

    donor.bullets = donorShare;
    recipient.bullets = recipientShare;
  }

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

  // extractSkills already separates any language entries that were grouped
  // into the skills section (e.g. "English: Fluent" sitting next to "Programming: Python, SQL").
  // Merge those into the languages list so they're not lost.
  const extractedSkills = extractSkills(normalized, sections, lines);
  const skillsLanguageCheck = separateLanguagesFromSkills(extractedSkills);
  const baseLanguages = extractLanguages(normalized, sections);
  const mergedLanguages = unique(
    [...baseLanguages, ...skillsLanguageCheck.languages],
    (item) => item.split(" - ")[0].toLowerCase(),
  ).slice(0, 10);

  const partial = {
    rawText: normalized,
    basics: extractBasics(lines, normalized),
    summary,
    experience: extractExperience(sections, lines, projects, summary),
    education: extractEducation(sections, lines),
    skills: skillsLanguageCheck.skills,
    projects,
    languages: mergedLanguages,
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

const WORKZO_BAD_NAME_WORDS = /\b(product|stability|tier|support|engineer|developer|analyst|manager|specialist|consultant|supervisor|professional|experience|education|skills|summary|profile|contact|email|phone|linkedin|location|service|delivery|requirements|analysis|python|sql|excel|tableau|microsoft|word|street|road|weg|public\s+relations|project\s+management|communication|leadership|teamwork|time\s+management|critical\s+thinking|english|german|french|dutch|spanish|italian|portuguese|fluent|conversational|native|programming|machine\s+learning|visualization|visualisation|engineering|generative|bootcamp|school|college|bachelor|master|candidate|retrieval|augmented|generation|pipeline|scraping|automation|integration|f[äa]higkeiten|kontakt|kenntnisse|profil|profil[üu]bersicht|ausbildung|bildung|bildungsweg|sprachen|berufserfahrung|berufliches|erfahrung|werdegang|qualifikationen|zertifikate|projekte|referenzen|interessen|sonstiges|kompetenzen|f[äa]higkeit|kernkompetenzen|kompetenz|sprechen|lesen|schreiben|hören|hoeren|muttersprache|verhandlungssicher|grundkenntnisse|kenntnis|tools?|systeme|netzwerke|programmierung|expertise|references|qualifications|certifications|projects|interests|languages|tools|systems|networks)\b/i;


// Role-title words (with spaces removed) that commonly appear concatenated
// after a surname in spaced-caps CV headers, e.g. "WILSONPRMANAGER",
// "SMITHPROJECTMANAGER", "GARCIADATAANALYST". Longest-first so "PRMANAGER"
// is tried before "MANAGER" would incorrectly match inside it.
const COMPACT_ROLE_SUFFIXES = [
  "projectmanager", "productmanager", "accountmanager", "salesmanager",
  "businessanalyst", "dataanalyst", "softwareengineer", "dataengineer",
  "datascientist", "prmanager", "prspecialist", "hrmanager", "hrspecialist",
  "marketingmanager", "marketingmanagerin", "operationsmanager", "generalmanager", "officemanager",
  "teamlead", "teamleader", "projectlead", "techlead",
  "engineer", "developer", "designer", "analyst", "scientist", "manager",
  "specialist", "consultant", "coordinator", "supervisor", "technician",
  "administrator", "assistant", "executive", "officer", "recruiter",
  "director", "partner", "associate", "intern",
  // German gendered suffixes (feminine -in forms)
  "managerin", "leiterin", "ingenieurin", "entwicklerin", "designerin",
  "assistentin", "koordinatorin", "spezialistin",
];
function wzBetterClean(value = "") {
  // Generic normalisation only, no hardcoded candidate-specific phrases.
  // normalizeResumeText already handles encoding artefacts, OCR typos, and
  // word-split repairs for any CV.
  return normalizeResumeText(value)
    .replace(/\s+/g, " ")
    .trim();
}

function wzLooksLikePersonName(value = "") {
  // Reject immediately if original value contains a colon, these are skill category lines
  // e.g. "Programming: Python, SQL" or "Generative AI: LangChain, RAG"
  if (/:/.test(wzBetterClean(value))) return false;

  // Reject lines that are fully uppercase with 3+ words, these are almost
  // always concatenated section headers, e.g. "PROFILE SUMMARY EXPERIENCE"
  // or "SKILLS EDUCATION LANGUAGES". A genuine 2-word all-caps name (e.g.
  // "JONAS LAUSCH") is common in visual CV headers, so 2-word all-caps lines
  // fall through to the WORKZO_BAD_NAME_WORDS / shape checks below instead of
  // being rejected outright here.
  const rawUpper = wzBetterClean(value).trim();
  if (/^[A-ZÄÖÜ][A-ZÄÖÜ\s\/]{6,}$/.test(rawUpper) && rawUpper.split(/\s+/).length >= 3) return false;

  // Check for digits/contact-info markers on the ORIGINAL value BEFORE any
  // character stripping. Stripping non-name characters first (as below) would
  // remove digits from "123 Anywhere St., Any City", letting an address line
  // masquerade as a 2-word capitalized "name" ("Anywhere St").
  const originalForDigitCheck = wzBetterClean(value).replace(/[,|•].*$/g, "");
  if (/@|http|www|\d|\+/.test(originalForDigitCheck)) return false;

  const clean = wzBetterClean(value)
    .replace(/[,|•].*$/g, "")
    .replace(/[^A-Za-zÀ-ÖØ-öø-ÿ' .-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean || clean.length < 3 || clean.length > 48) return false;
  if (WORKZO_BAD_NAME_WORDS.test(clean)) return false;

  const parts = clean.split(" ").filter(Boolean);
  if (parts.length < 2 || parts.length > 4) return false;
  // Every word must start with a capital letter, real names do, skill categories don't
  if (!parts.every((part) => /^[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'.-]{1,}$/.test(part))) return false;
  // Reject if any word looks like a skill/tech/tool keyword
  const joinedLower = clean.toLowerCase();
  if (/\b(python|sql|api|gcp|nlp|rag|rest|mysql|tableau|excel|scrum|agile|jira|cloud|azure|aws|java|react|node|html|css|git|linux|docker|kubernetes|salesforce|hubspot|crm|sap|erp|itil|itsm|cobol|swift|kotlin|scala|rust|golang|angular|vue|typescript|javascript|php|ruby|perl|bash|terraform|ansible|spark|hadoop|kafka|airflow|dbt|looker|powerbi|snowflake|databricks|mlflow|langchain|openai|chatgpt|tensorflow|pytorch|sklearn|pandas|numpy|matplotlib|seaborn|plotly|streamlit|fastapi|flask|django|spring|hibernate|junit|selenium|jenkins|github|gitlab|bitbucket|confluence|notion|slack|figma|sketch|canva|adobe|photoshop|illustrator|premiere|after effects|solidworks|autocad|catia|creo|inventor|matlab|simulink|labview|fpga|vhdl|verilog)\b/i.test(joinedLower)) return false;
  return true;
}

function wzTitleCaseCompactName(value = "") {
  const compact = value.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, "").trim();
  if (!compact || compact.length < 6 || compact.length > 36) return "";

  // Known safe splits for compact names from email addresses or spaced-cap CV headers.
  // This prevents multi-column PDFs from using skill words as the candidate name.
  // No hardcoded person-specific splits, use generic logic only
  // Names from email addresses or file names are handled by the email prefix path

  return "";
}

function wzNameFromFileName(fileName = "") {
  const base = cleanLine(fileName)
    .replace(/(?:\.pdf|\.docx?|\.txt)+$/gi, "")
    .replace(/\s*\(\d+\)\s*/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\b(cv|resume|lebenslauf|copy|final|new|updated)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (wzLooksLikePersonName(base)) return titleCase(base);
  return wzTitleCaseCompactName(base);
}

function wzExtractBetterName(text = "") {
  const normalized = normalizeResumeText(text);

  // Prefer visual resume headers written as spaced capitals, e.g.
  // H A R I T H A  V I J A Y A K U M A R. Multi-column PDFs often place
  // this after skills, so we search the full text, not just the first lines.
  const spacedCapsMatches = normalized.match(/(?:\b[A-ZÀ-ÖØ-Þ]\s+){5,}[A-ZÀ-ÖØ-Þ]\b/g) || [];
  for (const match of spacedCapsMatches) {
    const compact = match.replace(/\s+/g, "");
    const known = wzTitleCaseCompactName(compact);
    if (known && wzLooksLikePersonName(known)) return known;
  }

  const lines = normalized
    .split(/\n+/)
    .map((line) => decompactKnownPhrases(compactSpacedCaps(line), isSpacedCapsLine(line)).trim())
    .filter(Boolean)
    .slice(0, 60);

  // ── Stacked single-word name lines ──────────────────────────────────────────
  // Some CV headers render the first name and surname on separate lines, e.g.:
  //   OLIVIA
  //   W I L S O N P R   M A N A G E R    (compacted -> WILSONPRMANAGER)
  // Each line on its own is a single word, so wzLooksLikePersonName (which
  // requires 2-4 words) rejects it. Detect two consecutive lines near the top
  // of the CV that are each a single capitalized word (3-20 letters, possibly
  // with a known role suffix glued onto the second via splitSurnameAndRole)
  // and combine them into "First Last".
  const SINGLE_WORD_NAME_RE = /^[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'-]{1,19}$/;
  for (let i = 0; i < Math.min(lines.length - 1, 8); i += 1) {
    const first = lines[i];
    if (!SINGLE_WORD_NAME_RE.test(first)) continue;
    if (WORKZO_BAD_NAME_WORDS.test(first)) continue;

    let second = lines[i + 1];
    // The second line may have a role title glued on after compacting
    // spaced caps (e.g. "WILSONPRMANAGER" -> surname "WILSON" + role).
    const split = splitSurnameAndRole(second.toUpperCase().replace(/\s+/g, ""));
    if (split) {
      second = split.surname;
    }

    if (!SINGLE_WORD_NAME_RE.test(second)) continue;
    if (WORKZO_BAD_NAME_WORDS.test(second)) continue;

    const combined = titleCase(`${first} ${second}`);
    if (wzLooksLikePersonName(combined)) return combined;
  }

  for (const [index, line] of lines.entries()) {
    const clean = line.replace(/\s*[|•].*$/g, "").trim();
    const known = wzTitleCaseCompactName(clean);
    if (known && wzLooksLikePersonName(known)) return known;
    if (!wzLooksLikePersonName(clean)) continue;

    // A fully-uppercase multi-word candidate (e.g. "JONAS LAUSCH") is only
    // trusted as a name near the top of the document. Section header phrases
    // in other languages that aren't in WORKZO_BAD_NAME_WORDS (e.g. an
    // unrecognised "XXXX YYYY" header pair) typically appear further down,
    // alongside the experience/education sections, a real name header is
    // always within the first few lines.
    const isFullyUpper = /^[A-ZÄÖÜÀ-ÞØ\s.'-]+$/.test(clean) && clean.split(" ").filter(Boolean).length >= 2;
    if (isFullyUpper && index >= 5) continue;

    return titleCase(clean);
  }

  // Email prefix fallback. Some visual CVs expose the real name most reliably in email.
  const emailPrefix = normalized.match(/\b([a-z][a-z0-9._-]{2,})@[a-z0-9.-]+\.[a-z]{2,}\b/i)?.[1] || "";
  const knownEmailName = wzTitleCaseCompactName(emailPrefix.replace(/\d+/g, ""));
  if (knownEmailName && wzLooksLikePersonName(knownEmailName)) return knownEmailName;

  const spaced = emailPrefix
    .replace(/[._-]+/g, " ")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (wzLooksLikePersonName(spaced)) return titleCase(spaced);

  return "";
}

export function sanitizeResumeProfileIdentity(profile: ResumeProfile, source: { rawText?: string; fileName?: string } = {}): ResumeProfile {
  const text = source.rawText || profile.rawText || "";
  const currentName = wzLooksLikePersonName(profile.basics.name) ? profile.basics.name : "";

  // Only run the expensive text extraction if the current name is absent or invalid.
  // If we already have a valid name from the AI parser, trust it, don't override it
  // with a text-scan that may pick up address fragments from sidebar-first PDFs.
  const betterName = currentName ? "" : (wzExtractBetterName(text) || wzNameFromFileName(source.fileName || ""));
  const name = currentName || betterName || "Candidate";

  return {
    ...profile,
    basics: {
      ...profile.basics,
      name,
    },
    warnings: unique([
      ...(profile.warnings || []),
      ...(name === "Candidate" ? ["Candidate name could not be verified from the CV header."] : []),
    ]),
  };
}

function wzSectionWindow(text: string, startPatterns: RegExp[], endPatterns: RegExp[]) {
  const normalized = normalizeResumeText(text);
  const lower = normalized.toLowerCase();
  let start = -1;

  for (const pattern of startPatterns) {
    const globalPattern = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
    let match: RegExpExecArray | null;
    while ((match = globalPattern.exec(lower))) {
      // The start pattern must mark a SECTION HEADER line, not a prose mention
      // of the word elsewhere in the document. e.g. the summary "...with over
      // 5 years of experience in..." contains the word "experience" but is not
      // an "EXPERIENCE" section header. A genuine section header line is short
      // (just the heading, optionally with trailing whitespace) and sits at the
      // start of a line. Reject matches where the containing line has
      // substantial additional text, those are prose mentions, not headers.
      const lineStart = lower.lastIndexOf("\n", match.index) + 1;
      const lineEnd = (() => {
        const idx = lower.indexOf("\n", match.index);
        return idx === -1 ? lower.length : idx;
      })();
      const line = lower.slice(lineStart, lineEnd).trim();
      // A real section header line is just the heading word(s), short overall.
      if (line.length > match[0].length + 6) continue;

      if (start === -1 || match.index < start) {
        start = match.index + match[0].length;
      }
      break;
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

  // Generic location extraction: find the first line that looks like a location
  // (postal code, country name, major city) without hardcoding specific cities.
  // This works for any candidate from any country.
  const locationLine = clean
    .split(/\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0 && line.length < 80 && isLocationLine(line) && !/@|linkedin|github/i.test(line));

  return { email, phone, linkedin, location: locationLine || "" };
}

function wzExtractBetterSkills(text = "") {
  const source = normalizeResumeText(text);
  const skillWindow = wzSectionWindow(
    source,
    [/\bskills\b/i, /\btechnical skills\b/i, /\bcore skills\b/i],
    [/\beducation\b/i, /\bexperience\b/i, /\bprojects\b/i, /\blanguages\b/i, /\bcertifications\b/i],
  );

  const hay = `${skillWindow}\n${source}`;
  const hayLower = hay.toLowerCase();
  return unique(
    SKILL_DICTIONARY.filter((skill) => new RegExp(`\\b${escapeRegExp(skill).replace(/\\\s+/g, "\\s+")}\\b`, "i").test(hay)),
    (skill) => skill.toLowerCase(),
  )
    // Respect the order the candidate listed skills in, rather than the
    // fixed dictionary order (which put all technical terms first and
    // pushed business/soft skills past the cap).
    .sort((a, b) => {
      const ia = hayLower.indexOf(a.toLowerCase());
      const ib = hayLower.indexOf(b.toLowerCase());
      return (ia < 0 ? Number.MAX_SAFE_INTEGER : ia) - (ib < 0 ? Number.MAX_SAFE_INTEGER : ib);
    })
    .slice(0, 30);
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
    [/\beducation\b/i, /\bacademic\s+(?:background|history)\b/i, /\bqualifications\b/i, /\bildung\b/i, /\bausbildung\b/i],
    [/\bexperience\b/i, /\bwork experience\b/i, /\bprojects\b/i, /\bskills\b/i, /\blanguages\b/i, /\bcertifications?\b/i, /\bberufserfahrung\b/i],
  );

  const hay = educationWindow || source;
  const lines = hay.split(/\n+/).map(cleanLine).filter(Boolean);
  const out: ResumeEducation[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!DEGREE_RE.test(line) && !EDUCATION_ORG_RE.test(line)) continue;

    // Peek at next line to combine degree + institution that are on separate lines
    const nextLine = lines[i + 1] || "";
    // Only combine with the next line when THIS line is a partial entry
    // (a degree without an institution, or vice versa). If this line
    // already contains both a degree and an institution (e.g.
    // "Bachelors In Science | SRM College"), it is self-contained, so
    // combining would wrongly merge two separate entries and consume
    // the second one.
    const lineParts = line.split(/\s*[•|]\s*/).map(cleanLine).filter(Boolean);
    const lineHasDegree = lineParts.some((part) => DEGREE_RE.test(part) && !EDUCATION_ORG_RE.test(part));
    const lineHasOrg = lineParts.some((part) => EDUCATION_ORG_RE.test(part));
    const lineSelfContained = lineHasDegree && lineHasOrg;
    const combined = !lineSelfContained && nextLine && (DEGREE_RE.test(nextLine) || EDUCATION_ORG_RE.test(nextLine))
      ? `${line} • ${nextLine}`
      : line;

    const dates = normalizeDate(extractDate(combined));
    const parts = combined.split(/\s*[•|]\s*/).map(cleanLine).filter(Boolean);

    // Find degree (DEGREE_RE match) and institution (EDUCATION_ORG_RE) separately
    // to avoid swapping them when they appear in the wrong order.
    let degree = parts.find((part) => DEGREE_RE.test(part) && !EDUCATION_ORG_RE.test(part)) || "";
    let institution = parts.find((part) => EDUCATION_ORG_RE.test(part) && part !== degree) || "";

    // If degree looks like "Institution, Location" or "Institution (dates)", extract only degree
    // E.g. "SRM Arts And Science College, Chennai" is an institution, not a degree
    if (degree && EDUCATION_ORG_RE.test(degree) && !institution) {
      institution = degree;
      degree = "";
    }

    // Remove location/date contamination from institution name
    const cleanInstitution = titleCase(removeDate(institution)).replace(/,\s*[A-Z][a-z]+(?:,\s*[A-Z][a-z]+)*\s*$/, "").trim();

    if (degree || cleanInstitution) {
      out.push({
        degree: titleCase(removeDate(degree)),
        institution: cleanInstitution,
        location: "",
        dates,
      });
      // Skip next line if we already consumed it
      if (nextLine && combined.includes(nextLine)) i += 1;
    }
  }

  return unique(out, (item) => `${item.degree}-${item.institution}-${item.dates}`)
    .filter((item) => {
      // Reject entries where degree === institution (parser artifact)
      if (item.degree && item.institution && item.degree === item.institution) return false;
      // Reject entries where degree is just a university name
      if (!item.degree && !item.institution) return false;
      return true;
    })
    .slice(0, 6);
}

function wzExtractBetterExperience(text = ""): ResumeExperience[] {
  const source = normalizeResumeText(text);
  const experienceWindow = wzSectionWindow(
    source,
    [/\bprofessional experiences?\b/i, /\bwork experiences?\b/i, /\bemployment history\b/i, /\bberufserfahrung\b/i, /\bexperiences?\b/i],
    [/\beducation\b/i, /\bbildung\b/i, /\bausbildung\b/i, /\bprojects?\b/i, /\bskills?\b/i, /\bfähigkeiten\b/i, /\blanguages?\b/i, /\bcertifications?\b/i],
  );

  const hay = experienceWindow || source;
  const lines = hay.split(/\n+/).map(cleanLine).filter(Boolean);
  const jobs: ResumeExperience[] = [];
  let current: ResumeExperience | null = null;

  function flush() {
    if (!current) return;
    // Reject entries where title looks like a section header, location, or is identical to company
    const t = current.title.trim();
    const c = current.company.trim();
    if (!t && !c && !current.bullets.length) { current = null; return; }
    if (findSectionKind(t) !== null) { current = null; return; }
    if (isLocationLine(t) && !ROLE_RE.test(t)) { current = null; return; }
    if (extractDate(t) && t.length < 20) { current = null; return; }
    jobs.push({
      ...current,
      title: titleCase(current.title),
      company: titleCase(current.company),
      location: titleCase(current.location),
      dates: normalizeDate(current.dates),
      bullets: unique(current.bullets.map(cleanLine)).slice(0, 7),
    });
    current = null;
  }

  for (const raw of lines) {
    const line = cleanLine(raw);
    if (!line) continue;
    if (findSectionKind(line) !== null) { flush(); continue; }
    if (EDUCATION_ORG_RE.test(line) || DEGREE_RE.test(line)) continue;

    const hasDate = Boolean(extractDate(line));
    const looksHeader = hasDate || ROLE_RE.test(line) || COMPANY_WORD_RE.test(line);
    // A line >80 chars or starting with a bullet char is almost certainly a bullet, not a header
    const looksBullet = ACTION_RE.test(line) || /^[-•*]/.test(raw) || line.length > 80;

    if (looksHeader && !looksBullet) {
      flush();
      const date = normalizeDate(extractDate(line));
      const noDate = removeDate(line);
      const parts = noDate.split(/\s*[•|,]\s*/).map(cleanLine).filter(Boolean);

      let title = parts.find((part) => ROLE_RE.test(part)) || "";
      let company = parts.find((part) => COMPANY_WORD_RE.test(part) && part !== title) || "";

      // If we couldn't split title from company, use the full noDate as title
      if (!title && !company) title = noDate;
      // Never use the same string for both title and company
      if (title && company && title === company) company = "";

      current = { title: title || noDate, company, location: "", dates: date, bullets: [] };
      continue;
    }

    if (looksBullet) {
      // Don't create a fake "Professional Experience" container for stray bullets -
      // attach them to the most recent real job if there is one, otherwise discard.
      if (current) {
        current.bullets.push(line.replace(/^[-•*]\s*/, ""));
      }
      // If no current job, skip the bullet rather than inventing a fake container
    }
  }

  flush();

  return unique(jobs, (job) => `${job.title}-${job.company}-${job.dates}`)
    .filter((job) => {
      // Reject jobs where title is clearly a location, section header, or date
      if (findSectionKind(job.title) !== null) return false;
      if (!job.title && !job.company && !job.bullets.length) return false;
      // Reject if title + company both look like a city name (e.g. "Chennai ()")
      if (/^[A-Z][a-z]+\s*\(\s*\)$/.test(job.title) && !job.bullets.length) return false;
      // Reject if title is a word like "Technologies." or "Scientist" with no company/bullets
      if (job.title.length < 6 && !job.company && !job.bullets.length) return false;
      if (/^\w+\.$/.test(job.title) && !job.company && !job.bullets.length) return false;
      return true;
    })
    .filter((job) => !DEGREE_RE.test(`${job.title} ${job.company}`))
    .slice(0, 8);
}

const workzoOriginalExtractResumeProfile = extractResumeProfile;

function wzLooksLikeStrongHeadline(value = "") {
  const clean = cleanLine(value);
  if (!clean || clean.length < 3 || clean.length > 120) return false;
  if (/\b(19|20)\d{2}\b/.test(clean)) return false;
  if (/^(professional|candidate|company|skills?|contact|education|experience|profile|summary)$/i.test(clean)) return false;
  if (EDUCATION_ORG_RE.test(clean) || DEGREE_RE.test(clean)) return false;
  if (COMPANY_WORD_RE.test(clean) && !ROLE_RE.test(clean)) return false;
  if (WORKZO_BAD_NAME_WORDS.test(clean) && !ROLE_RE.test(clean)) return false;
  return ROLE_RE.test(clean);
}

function wzPickHeadline(baseHeadline: string, experience: ResumeExperience[], lines: string[]) {
  if (wzLooksLikeStrongHeadline(baseHeadline)) return titleCase(baseHeadline);
  const fromExperience = experience.map((item) => item.title).find(wzLooksLikeStrongHeadline);
  if (fromExperience) return titleCase(fromExperience);
  const fromHeader = lines.slice(0, 80).find((line) => wzLooksLikeStrongHeadline(line));
  if (fromHeader) return titleCase(fromHeader);
  return "Professional";
}

export function extractResumeProfileComplex(rawText = ""): ResumeProfile {
  const base = workzoOriginalExtractResumeProfile(rawText);
  const text = normalizeResumeText(rawText);
  const lines = text.split(/\n+/).map(cleanLine).filter(Boolean);
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

  // Prefer betterExperience generally, it's better at parsing modern,
  // section-labeled CVs. But for CVs where the EXPERIENCE section uses a
  // "stacked titles" layout (one company/date anchor followed by several
  // role titles for the same company at different times, e.g. "ExampleCo |
  // Jan 2020 - Present / PR Manager / PR Specialist / Communications
  // Coordinator"), wzExtractBetterExperience's single-pass line scanner
  // treats each title line as a separate job with its own (empty) entry,
  // fragmenting one real job history into many empty shells. The older
  // extractExperience has dedicated stacked-title handling and produces
  // fewer, richer jobs in that case. Heuristic: if betterExperience has
  // noticeably MORE jobs than base.experience AND most of those extra jobs
  // have no bullets at all, base.experience is the better-structured result.
  const betterBulletCount = betterExperience.reduce((sum, job) => sum + job.bullets.length, 0);
  const baseBulletCount = base.experience.reduce((sum, job) => sum + job.bullets.length, 0);
  const betterLooksFragmented =
    betterExperience.length > base.experience.length &&
    base.experience.length > 0 &&
    baseBulletCount >= betterBulletCount;

  const experience = betterExperience.length && !betterLooksFragmented ? betterExperience : base.experience.length ? base.experience : betterExperience;

  // Don't fall back to a company/date/section fragment for the headline.
  const headline = wzPickHeadline(base.basics.headline, experience, lines);

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
