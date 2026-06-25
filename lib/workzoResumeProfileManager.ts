import type { ResumeProfile } from "@/lib/workzoResumeParser";

function cleanText(value: unknown, max = 50000) {
  if (typeof value !== "string") return "";
  return value
    .replace(/\u0000/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

function norm(value: unknown) {
  return cleanText(value, 500)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


// Extract a clean email from a field that may have phone number concatenated.
// e.g. "+123-456-7890hello@reallygreatsite.com" → "hello@reallygreatsite.com"
function cleanEmail(value: unknown): string {
  if (typeof value !== "string") return "";
  const match = value.match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/);
  return match ? match[0].toLowerCase() : "";
}



function looksLikeDateOrYearRange(value: string): boolean {
  const raw = cleanText(value, 120);
  if (!raw) return false;
  const digits = raw.replace(/\D/g, "");
  if (/\b(?:19|20)\d{2}\s*[-–/to]+\s*(?:19|20)\d{2}\b/i.test(raw)) return true;
  if (/\b(?:19|20)\d{2}\s*[-–/to]+\s*(present|current|heute)\b/i.test(raw)) return true;
  if (/^\(?\s*(?:19|20)\d{2}\s*[-–/]\s*(?:19|20)\d{2}\s*\)?$/.test(raw)) return true;
  return digits.length >= 4 && digits.length <= 8 && /(?:19|20)\d{2}/.test(raw) && !/^\+/.test(raw);
}

function cleanPhoneField(value: unknown, rawText = ""): string {
  const raw = cleanText(value, 160);
  const normalize = (candidate: string) => {
    let phone = cleanText(candidate, 80)
      .replace(/[A-Za-z]+@[A-Za-z0-9._%+\-]+\.[A-Za-z]{2,}/g, "")
      .replace(/\b(?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2}\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const digits = phone.replace(/\D/g, "");
    if (looksLikeDateOrYearRange(phone)) return "";
    if (digits.length < 7 || digits.length > 16) return "";
    if (!/[+()\-\s]/.test(phone) && digits.length < 8) return "";
    return phone;
  };

  const direct = normalize(raw);
  if (direct) return direct;

  const text = cleanText(rawText, 6000);
  const candidates = text.match(/\+?\d[\d\s().\-]{7,}\d/g) || [];
  for (const candidate of candidates) {
    const phone = normalize(candidate);
    if (phone) return phone;
  }
  return "";
}

function unique<T>(items: T[], keyFn: (item: T) => string) {
  const seen = new Set<string>();
  const out: T[] = [];

  for (const item of items) {
    const key = norm(keyFn(item));
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function titleCaseName(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function compactDecorativeLine(line: string) {
  const cleaned = cleanText(line, 200)
    .replace(/[•●▪◦]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = cleaned.split(/\s+/).filter(Boolean);

  // Decorative spaced-letter names -> compact uppercase token
  if (tokens.length >= 4 && tokens.every((token) => /^\p{Lu}$/u.test(token))) {
    return tokens.join("");
  }

  return cleaned;
}

function prepareLines(rawText: string) {
  return String(rawText || "")
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map(compactDecorativeLine)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 180);
}

const STRONG_SECTION_RE = /^(key\s+projects|selected\s+projects|security\s+projects|relevant\s+experience|technical\s+skills|professional\s+skills|about\s+me|awards?|awards?\s+received|berufliches\s+profil|berufserfahrung|bildung|bildungsweg|contacts?|core\s+competencies|education|educational\s+background|education\s+and\s+training|erfolge\s+beim\s+kunden|experience|expertise|fähigkeiten|fahigkeiten|kontakt|languages?|overview|professional\s+experience|professional\s+summary|profile|profile\s+overview|profile\s+summary|profil(?:\s*übersicht|\s*ubersicht)?|projects?|references?|skills?|summary|summary\s+of\s+skills|work\s+experience|certifications?|zertifikate|honou?rs?|honou?rs?\s+and\s+awards|academic\s+history|short\s+courses)$/i;

// Soft-skill and professional phrases that appear as CV section content but look
// superficially like 2-word names. Any of these must never be returned as a name.
// This is a phrase-level check (whole string match), complementing BAD_NAME_WORD_RE
// which works at the individual-word level.
const SOFT_SKILL_PHRASE_RE = /^(magna cum laude|summa cum laude|cum laude|educational background|relevant experience|key projects|security projects|professional summary|critical thinking|effective communication|public relations|time management|project management|stakeholder management|problem solving|decision making|data analysis|data visualization|machine learning|generative ai|cloud security|threat detection|threat hunting|soc operations|incident response|penetration testing|vulnerability management|client acquisition|market analysis|market research|brand management|crisis communication|event planning|content creation|social media|digital marketing|agile methodology|process improvement|personal training|team training|product strategy|product design|product lifecycle|user research|growth optimization|cross.functional|analytical thinking|design thinking|lesson planning|classroom management|web design|front end|back end|full stack|database administration|network security|system administration|active directory|windows server|requirements analysis|service delivery|requirements management)$/i;

const BAD_NAME_WORD_RE = /\b(candidate|professional|unknown|resume|cv|curriculum|profile|profilesummary|summary|experience|workexperience|education|skills?|projects?|languages?|contact|email|phone|linkedin|github|headline|english|german|deutsch|dutch|french|spanish|italian|portuguese|arabic|mandarin|chinese|japanese|korean|russian|turkish|polish|hindi|tamil|englisch|françösisch|franzosisch|spanisch|italienisch|portugiesisch|arabisch|japanisch|chinesisch|russisch|türkisch|turkisch|polnisch|fluent|native|conversational|fließend|fliesend|muttersprache|verhandlungssicher|fortgeschritten|grundkenntnisse|anfänger|anfanger|c1|c2|b1|b2|a1|a2|support|engineer|analyst|manager|specialist|developer|consultant|technical|data|customer|success|sales|marketing|product|project|program|software|frontend|backend|fullstack|itil|itsm|api|sql|python|tableau|power|gcp|aws|rag|nlp|matplotlib|seaborn|tensorflow|sklearn|langchain|programming|bash|powershell|security|cloud|ticketing|roadmapping|agile|scrum|stakeholder|competencies|initiative|platform|dashboard|teacher|preschool|accountant|designer|coordinator|assistant|intern|executive|director|officer|lead|head|chief|owner|founder|recruiter|architect|scientist|researcher|writer|editor|planner|technician|school|university|college|industries|solutions|community|financial|senior|junior|principal|jede|stadt|straße|strasse|service|services|startup|bootcamp|institute|corporation|corp|gmbh|inc|ltd|llc|group|holding|digital|technologies|technology|systems|agency|studio|labs|ventures|consulting|innovations?|coaching|thinking|leadership|communication|planning|analysis|management|visualization|engineering|integration|scraping|generation|retrieval|augmented|certification|freelance|volunteer|degree|bachelor|master|associate|diploma|certificate|science|arts|computer|software|development|achievements?|accomplishments?|proficiencies|proficiency|capabilities|strengths?|competency|expertise|tools?|tooling|magna|cum|laude|honours?|honors?|itsd|hts|ats|sop|kpi|okr|roi|ict|erp|crm|saas|sla)\b/i;

// Detects phrases that are clearly job titles (adjective + role word, or role word + company).
// Generic: any 2-3 word phrase where at least half the words are role/job words.
// This replaces a hardcoded list of specific titles.
const ROLE_TITLE_RE = /\b(senior|junior|lead|head|chief|principal|associate|assistant|staff|vp|vice|president)\s+(manager|engineer|developer|designer|analyst|specialist|consultant|coordinator|director|officer|executive|accountant|architect|scientist|researcher|recruiter|technician)\b|\b(manager|engineer|developer|designer|analyst|specialist|consultant|coordinator|director|officer|executive|accountant|architect)\s+(manager|engineer|developer|designer|analyst|specialist|consultant|coordinator|director|officer|executive|accountant|architect)\b/i;

const ORG_WORD_RE = /\b(gmbh|ug|ag|kg|ltd|limited|llc|inc|corp|corporation|company|co\.?|group|holding|services|solutions|systems|technologies|technology|software|digital|media|industries|university|college|school|schule|hochschule|institute|academy|akademie|foundation|department|bootcamp|preschool|kindergarten)\b/i;

// GLOBAL FIX: structural contact/location detection instead of enumerated countries.
// Works for any user anywhere in the world — not just Germany, India, Canada, UK, USA.
const CONTACT_WORD_RE = /@|www\.|https?:|linkedin|github|\+?\d[\d\s()./-]{5,}|\b(street|strasse|straße|road|avenue|weg|platz|city|town|address|adresse|rue|via|calle|rua|steig|damm|pfad|ufer)\b/i;
const CONTACT_STRUCTURE_RE = /\b\d{4,6}\b[,.\s]{1,4}\p{Lu}[\p{Ll}À-ÿ]+|\b\p{Lu}[\p{Ll}À-ÿ]+[,.\s]{1,4}\d{4,6}\b|\b\p{Lu}[\p{Ll}À-ÿ]{2,},\s*\p{Lu}[\p{Ll}À-ÿ]{2,}\b/u;
const CONTACT_LOCATION_RE = { test(value: string) { return CONTACT_WORD_RE.test(value) || CONTACT_STRUCTURE_RE.test(value); } };

const DATE_RE = /\b(?:19|20)\d{2}\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|present|current|heute)\b/i;

function normalizedNameKey(value: unknown) {
  return norm(value).replace(/\s+/g, "");
}

export function isDefinitelyNotHumanName(value: unknown): boolean {
  const raw = cleanText(value, 160);
  if (!raw) return true;
  if (STRONG_SECTION_RE.test(raw)) return true;
  if (SOFT_SKILL_PHRASE_RE.test(raw)) return true;
  if (BAD_NAME_WORD_RE.test(raw)) return true;
  if (ROLE_TITLE_RE.test(raw)) return true;
  if (ORG_WORD_RE.test(raw)) return true;
  if (CONTACT_LOCATION_RE.test(raw)) return true;
  if (DATE_RE.test(raw)) return true;
  return false;
}

export function validateCandidateName(value: unknown): string {
  const raw = cleanText(value, 120)
    .replace(/^(candidate\s*name|name|applicant)\s*[:\-]\s*/i, "")
    .replace(/[^\p{L}' .-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!raw || raw.length < 3 || raw.length > 70) return "";
  if (isDefinitelyNotHumanName(raw)) return "";
  // Global guard: education/qualification phrases can look like names in title case
  // (e.g. "Associate's Degree In Computer Science"). They are never candidate names.
  if (/\b(associate'?s?\s+degree|bachelor'?s?\s+degree|master'?s?\s+degree|bachelor\s+of|master\s+of|b\.?sc|m\.?sc|b\.?a|m\.?a|ph\.?d|diploma|certificate|certification|university|college|school|hochschule|informatik|computer\s+science|software\s+development)\b/i.test(raw)) return "";

  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 5) return "";
  if (parts.some((part) => part.length < 2 || part.length > 28)) return "";
  if (new Set(parts.map((part) => part.toLowerCase())).size === 1) return "";

  const badParts = parts.filter((part) => BAD_NAME_WORD_RE.test(part) || ROLE_TITLE_RE.test(part)).length;
  if (badParts >= Math.ceil(parts.length / 2)) return "";

  const looksLikeName =
    raw === raw.toUpperCase() ||
    parts.filter((part) => /^[A-ZÀ-ÝÄÖÜ]/u.test(part)).length >= Math.max(2, parts.length - 1);

  if (!looksLikeName) return "";
  return titleCaseName(raw);
}

export function extractNameFromFileName(fileName = ""): string {
  const clean = String(fileName || "")
    .replace(/(?:\.(pdf|docx|doc|txt))+$/gi, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\d+/g, " ")
    .split(/\s+/)
    .filter(
      (word) =>
        word.length >= 3 &&
        !/^(resume|cv|lebenslauf|bewerbung|curriculum|vitae|updated|final|copy|draft|template|sample|example|untitled|design|new|old|my|the|test|advanced|professional|pdf|docx|deu|csm|modern|ats|support|specialist|manager|engineer|analyst|developer)$/i.test(word) &&
        !(word === word.toUpperCase() && word.length <= 6 && /^[A-ZÄÖÜ]+$/.test(word)),
    )
    .join(" ")
    .trim();

  return validateCandidateName(clean);
}

export function extractNameFromEmail(rawText: string): string {
  const email = String(rawText || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  if (!email) return "";

  const local = email
    .split("@")[0]
    .replace(/\d+/g, " ")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const direct = validateCandidateName(local);
  if (direct) return direct;

  const camel = local
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim();

  const camelName = validateCandidateName(camel);
  if (camelName) return camelName;

  return "";
}


export function extractExplicitCandidateName(rawText: string): string {
  const lines = prepareLines(rawText).slice(0, 80);

  for (const line of lines) {
    const match = line.match(/^(?:candidate\s*name|applicant\s*name|full\s*name|name)\s*[:\-]\s*(.+)$/i);
    if (!match) continue;
    const candidate = validateCandidateName(match[1]);
    if (candidate) return candidate;
  }

  // Structured WorkZo context sometimes stores the name as a sentence-like line.
  // Trust this only when the value after the label passes the global human-name validator.
  const flat = String(rawText || "").replace(/\r/g, "\n");
  const inline = flat.match(/(?:^|\n)\s*(?:Candidate name|Applicant name|Full name|Name)\s*[:\-]\s*([^\n|•]+)(?:\n|$)/i);
  if (inline) {
    const candidate = validateCandidateName(inline[1]);
    if (candidate) return candidate;
  }

  return "";
}

function nameAppearsInStructuredContent(profile: Partial<ResumeProfile> | ResumeProfile | null | undefined, name: string) {
  const key = norm(name);
  if (!profile || !key) return false;

  const p = profile as ResumeProfile;
  const haystacks = [
    ...(Array.isArray(p.skills) ? p.skills : []),
    ...(Array.isArray(p.languages) ? p.languages : []),
    ...(Array.isArray(p.projects) ? p.projects.map((x) => x?.name || "") : []),
    ...(Array.isArray(p.experience) ? p.experience.flatMap((x) => [x?.title || "", x?.company || ""]) : []),
    ...(Array.isArray(p.education) ? p.education.flatMap((x) => [x?.degree || "", x?.institution || ""]) : []),
  ];

  return haystacks.some((item) => norm(item) === key);
}

export function extractCanonicalCandidateName(
  rawText: string,
  fileName = "",
  parserName = "",
  knownName = "",
): string {
  const lines = prepareLines(rawText);
  const candidates: Array<{ name: string; score: number; reason: string }> = [];

  const explicitCandidate = extractExplicitCandidateName(rawText);
  if (explicitCandidate) candidates.push({ name: explicitCandidate, score: 240, reason: "explicit-label" });

  const knownCandidate = validateCandidateName(knownName);
  if (knownCandidate) candidates.push({ name: knownCandidate, score: 200, reason: "known" });

  const fileNameCandidate = extractNameFromFileName(fileName);
  if (fileNameCandidate) candidates.push({ name: fileNameCandidate, score: 170, reason: "file" });

  const emailName = extractNameFromEmail(rawText);
  if (emailName) candidates.push({ name: emailName, score: 90, reason: "email" });

  const parserCandidate = validateCandidateName(parserName);
  if (parserCandidate) candidates.push({ name: parserCandidate, score: 30, reason: "parser-low" });

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (isDefinitelyNotHumanName(line)) continue;

    const name = validateCandidateName(line);
    if (!name) continue;

    const prev = lines[i - 1] || "";
    const next = lines[i + 1] || "";
    const near = `${prev} ${next}`;

    let score = i < 8 ? 120 : i < 20 ? 90 : i < 50 ? 55 : i < 100 ? 25 : 10;
    if (line === line.toUpperCase()) score += 8;
    if (ROLE_TITLE_RE.test(prev) || ROLE_TITLE_RE.test(next)) score += 15;
    if (CONTACT_LOCATION_RE.test(near)) score += 8;
    if (ORG_WORD_RE.test(near) && i > 8) score -= 25;
    if (i > 25 && BAD_NAME_WORD_RE.test(line)) score -= 100;

    candidates.push({ name, score, reason: `line:${i}` });
  }

  // Two-line names: SURENDER / DILLIBABU.
  for (let i = 0; i < Math.min(lines.length - 1, 80); i += 1) {
    const a = lines[i];
    const b = lines[i + 1];
    if (
      /^[\p{L}'-]{3,25}$/u.test(a) &&
      /^[\p{L}'-]{3,25}$/u.test(b) &&
      !isDefinitelyNotHumanName(a) &&
      !isDefinitelyNotHumanName(b)
    ) {
      const combined = validateCandidateName(`${a} ${b}`);
      if (combined) candidates.push({ name: combined, score: i < 8 ? 135 : i < 20 ? 100 : 50, reason: `two-line:${i}` });
    }
  }

  // Compact confirmation: decorative all-caps names are trusted only when confirmed by file/email/known name.
  for (let i = 0; i < Math.min(lines.length, 120); i += 1) {
    const compact = normalizedNameKey(lines[i]);
    if (compact.length < 8) continue;

    for (const sourceName of [fileNameCandidate, emailName, knownCandidate]) {
      if (sourceName && compact === normalizedNameKey(sourceName)) {
        candidates.push({ name: sourceName, score: i < 25 ? 190 : 150, reason: `compact-confirmed:${i}` });
      }
    }
  }

  const bestByName = new Map<string, { name: string; score: number; reason: string }>();
  for (const candidate of candidates) {
    const name = validateCandidateName(candidate.name);
    if (!name) continue;
    const key = norm(name);
    const existing = bestByName.get(key);
    if (!existing || candidate.score > existing.score) bestByName.set(key, { ...candidate, name });
  }

  const best = [...bestByName.values()].sort((a, b) => b.score - a.score)[0];
  return best && best.score >= 20 ? best.name : "";
}

function nameAppearsAsProjectTitle(profile: Partial<ResumeProfile> | ResumeProfile | null | undefined, name: string): boolean {
  if (!profile || !name) return false;
  const key = norm(name);
  const p = profile as ResumeProfile;
  return (Array.isArray(p.projects) ? p.projects : []).some((proj) => norm(proj?.name || "") === key);
}

function chooseSaferName(
  current: string,
  canonical: string,
  profile?: Partial<ResumeProfile> | ResumeProfile | null,
) {
  const currentValid = validateCandidateName(current);
  const canonicalValid = validateCandidateName(canonical);

  // GLOBAL FIX v10:
  // The AI structured parser often reads the whole CV better than deterministic
  // line scanning, especially for two-column and sidebar-first PDFs. Previous
  // versions allowed a later text-scan "canonical" candidate to override a valid
  // AI name. That corrupted correct names into skills, section headers, or project
  // titles such as "Python Sql", "Key Projects", or soft-skill phrases.
  //
  // New rule: NEVER override a valid current parser name. Only use deterministic
  // recovery when the parser name is missing or invalid.
  if (currentValid) return currentValid;

  const canonicalIsProject = canonicalValid && nameAppearsAsProjectTitle(profile, canonicalValid);
  const canonicalInStructuredContent = canonicalValid && nameAppearsInStructuredContent(profile, canonicalValid);

  if (canonicalValid && !canonicalIsProject && !canonicalInStructuredContent) return canonicalValid;
  return "";
}

export function enforceCanonicalCandidateName<T extends Partial<ResumeProfile> | ResumeProfile>(
  profile: T,
  rawText = "",
  fileName = "",
  knownName = "",
): T {
  const next = { ...(profile || {}) } as T & { basics?: ResumeProfile["basics"]; warnings?: string[] };
  next.basics = { ...(next.basics || {}) } as ResumeProfile["basics"];

  const current = next.basics?.name || "";
  const currentValid = validateCandidateName(current);

  // GLOBAL IDENTITY SAFETY RULE:
  // If the structured parser already returned a valid human name, NEVER run raw-text
  // repair/override. PDF text order is unstable, especially in two-column layouts, and
  // raw scanning can accidentally select section headings such as "Key Projects",
  // skill phrases, role titles, or similar non-name lines.
  if (currentValid) {
    next.basics.name = currentValid;
    (next as T & { name?: string }).name = currentValid;
    return next as T;
  }

  const canonical = extractCanonicalCandidateName(
    rawText || (next as ResumeProfile).rawText || "",
    fileName,
    "",
    knownName,
  );

  const resolvedName = chooseSaferName("", canonical, next);
  next.basics.name = resolvedName;
  (next as T & { name?: string }).name = resolvedName;
  return next as T;
}

export function isValidHumanName(value: unknown): boolean {
  return Boolean(validateCandidateName(value));
}

export function cleanHumanName(value: unknown): string {
  return validateCandidateName(value);
}


function cleanHeadlineField(value: unknown): string {
  const raw = cleanText(value, 200);
  if (!raw) return "";
  // Strip " - CompanyName" suffix from headline (e.g. "Lead Product Manager - Nexora AI")
  // when it was the deterministic parser using job header lines as the headline
  let h = raw.replace(/\s*[-–]\s*[A-Z][A-Za-z\s&]+\s*\d{4}\s*.*$/, "").trim();
  // Strip trailing date ranges
  h = h.replace(/\s*\d{4}\s*[-–]\s*(present|current|heute|\d{4})\s*$/i, "").trim();
  // Strip trailing company-separator patterns like "— Company Name"
  h = h.replace(/\s*[—–]\s*[A-Z][A-Za-z\s&.]+$/, "").trim();
  return h;
}

function cleanLocation(value: unknown): string {
  const raw = cleanText(value, 200);
  if (!raw) return "";
  // Reject if value contains a month+year pattern — it's a date, not a location
  if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}/i.test(raw)) return "";
  if (/^\d{4}\s*[-–]/.test(raw)) return "";
  // Reject if value looks like a course/certification title with a trailing year:
  // "Artificial Intelligence in Marketing, 2022" — contains comma + 4-digit year
  if (/,\s*(?:19|20)\d{2}\s*$/.test(raw)) return "";
  // Reject if implausibly long — real locations are short
  if (raw.length > 80) return "";
  return raw;
}

export function completeResumeProfile(profile: Partial<ResumeProfile> | null | undefined, rawText = ""): ResumeProfile {
  const p = (profile || {}) as Partial<ResumeProfile>;
  const basics = (p.basics || {}) as ResumeProfile["basics"];

  // If basics.name is already a valid human name, trust it and do not re-derive
  // from rawText. Re-deriving overwrites correct names when the raw text starts
  // with skill words or section headers (common in two-column PDF extractions).
  const existingValidName = validateCandidateName(basics.name);
  const resolvedName = existingValidName ||
    chooseSaferName(basics.name, extractCanonicalCandidateName(rawText || p.rawText || "", "", basics.name), p);

  return {
    rawText: cleanText(p.rawText || rawText, 50000),
    basics: {
      name: resolvedName,
      headline: cleanText(cleanHeadlineField(basics.headline), 200) || "Professional",
      email: cleanEmail(basics.email) || cleanText(basics.email, 200),
      phone: cleanPhoneField(basics.phone, rawText || p.rawText || ""),
      location: cleanText(cleanLocation(basics.location), 200),
      linkedin: cleanText(basics.linkedin, 300),
    },
    summary: cleanText(p.summary, 1800),
    experience: unique(Array.isArray(p.experience) ? p.experience : [], (e) => {
      // Deduplicate by company+title only (dates are unreliable from some parsers).
      // Also reject entries where title === company (parser artifact) or title is a date.
      const t = cleanText(e.title, 180);
      const c = cleanText(e.company, 180);
      if (!t && !c) return `empty-${Math.random()}`;
      if (t === c) return `dup-title-company-${norm(t)}`;
      if (/^\d{4}|^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(t)) return `date-title-${Math.random()}`;
      return `${norm(c)}|${norm(t)}`;
    }).filter((e) => {
      const t = cleanText(e.title, 180);
      const c = cleanText(e.company, 180);
      // Reject empty entries
      if (!t && !c) return false;
      // Reject entries where title is just a technology word (e.g. "Technologies.")
      if (/^(technologies|software|solutions|systems|services|platforms?)\.?$/i.test(t.trim())) return false;
      // Reject entries where title is a single generic word with no company
      if (!c && t.length < 5) return false;
      // Reject entries where title is a section header word
      if (STRONG_SECTION_RE.test(t)) return false;
      // Reject entries where title is clearly a city+parentheses ("Chennai ()") with no bullets
      if (/^[A-Z][a-z]+\s*\(\s*\)$/.test(t) && !(e.bullets?.length)) return false;
      // Reject entries where title and company are identical (parser artifact)
      if (t && c && t.toLowerCase() === c.toLowerCase()) return false;
      // Reject entries where title looks like a date range
      if (/^\d{4}\s*[-–]\s*\d{4}$/.test(t)) return false;
      return true;
    }).map((e) => ({
      title: cleanText(e.title, 180),
      company: cleanText(e.company, 180),
      location: cleanText(e.location, 180),
      dates: cleanText(e.dates, 80),
      bullets: Array.isArray(e.bullets) ? e.bullets.map((b) => cleanText(b, 500)).filter(Boolean).slice(0, 10) : [],
    })),
    education: unique(Array.isArray(p.education) ? p.education : [], (e) => {
      // Deduplicate by degree+institution only (dates cause spurious duplication).
      // Reject entries where degree === institution (parser artifact).
      const d = cleanText(e.degree, 180);
      const i = cleanText(e.institution, 180);
      if (!d && !i) return `empty-edu-${Math.random()}`;
      if (d === i) return `dup-deg-inst-${norm(d)}`;
      return `${norm(d)}|${norm(i)}`;
    }).filter((e) => {
      // Reject education entries where both degree and institution are empty,
      // or where the degree field contains only a date range (parser artifact).
      const d = cleanText(e.degree, 180);
      const i = cleanText(e.institution, 180);
      if (!d && !i) return false;
      if (/^\d{2,4}\s*[-–]\s*\d{2,4}$/.test(d.trim())) return false; // degree = "2013 - 2016"
      if (/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}/i.test(d.trim())) return false;
      // Reject if degree looks like a location ("University Of X, Country")
      if (/^(university|universit|college|school|institut|academ)/i.test(d) && !i) return false;
      // Reject if degree is a job title (e.g. "Senior Accountant" appearing in
      // an education section due to PDF layout confusion).
      if (ROLE_TITLE_RE.test(d) && !/bachelor|master|mba|msc|phd|degree|diploma|certificate|science|arts|engineering|management|technology|administration|education/i.test(d)) return false;
      return true;
    }).map((e) => {
      const d = cleanText(e.degree, 180);
      const i = cleanText(e.institution, 180);
      // When degree and institution are identical, the parser put the institution name
      // in both fields. Keep the institution, clear the degree.
      const resolvedDegree = (d && i && norm(d) === norm(i)) ? "" : d;
      // When degree looks like a university/school name (e.g. "Borcelle University"),
      // move it to institution if institution is empty, then clear degree.
      const looksLikeInstitution = /\b(university|universit|college|school|institute|academ|hochschule|universität)\b/i.test(d);
      const finalDegree = looksLikeInstitution && !i ? "" : resolvedDegree;
      const finalInstitution = looksLikeInstitution && !i ? d : i;
      return {
        degree: finalDegree,
        institution: finalInstitution,
        location: cleanText(e.location, 180),
        dates: cleanText(e.dates, 80),
      };
    }),
    skills: unique(
      (Array.isArray(p.skills)
        ? p.skills.flatMap((skill) => cleanText(skill, 180).split(/[,;•|]/g).map((s) => cleanText(s, 90))).filter(Boolean)
        : [])
        .filter((s) => {
          const sn = norm(s);
          const nameNorm = norm(resolvedName);
          const headlineNorm = norm(basics.headline || "");
          // Reject the candidate's own name or headline from skills (parser artifact).
          if (nameNorm && sn === nameNorm) return false;
          if (headlineNorm && sn === headlineNorm) return false;
          // Reject obvious non-skills: bare personal pronouns, single chars
          if (s.length < 2) return false;
          return true;
        }),
      (s) => s
    ).slice(0, 100),
    projects: unique(Array.isArray(p.projects) ? p.projects : [], (proj) => proj.name || proj.bullets?.join(" ") || "").map((proj) => ({
      name: cleanText(proj.name, 180) || "Selected Project",
      bullets: Array.isArray(proj.bullets) ? proj.bullets.map((b) => cleanText(b, 500)).filter(Boolean).slice(0, 10) : [],
    })),
    languages: unique(Array.isArray(p.languages) ? p.languages.map((l) => cleanText(l, 90)).filter(Boolean) : [], (l) => l),
    certifications: unique(Array.isArray(p.certifications) ? p.certifications.map((c) => cleanText(c, 160)).filter(Boolean) : [], (c) => c),
    strengths: unique(Array.isArray(p.strengths) ? p.strengths.map((s) => cleanText(s, 160)).filter(Boolean) : [], (s) => s),
    additionalEvidence: unique(Array.isArray(p.additionalEvidence) ? p.additionalEvidence.map((s) => cleanText(s, 300)).filter(Boolean) : [], (s) => s),
    warnings: unique(Array.isArray(p.warnings) ? p.warnings.map((s) => cleanText(s, 300)).filter(Boolean) : [], (s) => s),
    previewText: cleanText(p.previewText || rawText, 3000),
  };
}

export function isLowQualityResumeProfile(profile: unknown): boolean {
  if (!profile || typeof profile !== "object") return true;
  const p = profile as ResumeProfile;
  const name = p.basics?.name || "";
  if (!isValidHumanName(name)) return true;

  const nameKey = norm(name);
  if ((p.skills || []).some((s) => norm(s) === nameKey)) return true;
  if ((p.projects || []).some((proj) => norm(proj?.name) === nameKey)) return true;
  if ((p.experience || []).some((exp) => norm(exp?.title) === nameKey || norm(exp?.company) === nameKey)) return true;
  if ((p.education || []).some((edu) => norm(edu?.degree) === nameKey || norm(edu?.institution) === nameKey)) return true;

  const experienceCount = Array.isArray(p.experience) ? p.experience.length : 0;
  const educationCount = Array.isArray(p.education) ? p.education.length : 0;
  const skillCount = Array.isArray(p.skills) ? p.skills.length : 0;
  const projectCount = Array.isArray(p.projects) ? p.projects.length : 0;
  const summaryChars = cleanText(p.summary, 2000).length;

  if (experienceCount === 0 && educationCount === 0 && skillCount === 0 && projectCount === 0 && summaryChars < 40) return true;
  if (projectCount === 1 && /^(candidate|project|selected project|unknown)$/i.test(p.projects?.[0]?.name || "")) return true;

  return false;
}

export function profileScore(profile: unknown): number {
  if (!profile || typeof profile !== "object") return 0;
  const p = completeResumeProfile(profile as ResumeProfile, (profile as ResumeProfile).rawText || "");
  let score = 0;
  if (isValidHumanName(p.basics.name)) score += 30;
  if (p.summary.length > 40) score += 15;
  score += Math.min(35, p.experience.length * 12);
  score += Math.min(15, p.education.length * 6);
  score += Math.min(15, p.projects.length * 5);
  score += Math.min(15, Math.floor(p.skills.length / 3));
  score += Math.min(5, p.languages.length * 2);
  if (isLowQualityResumeProfile(p)) score -= 80;
  return score;
}

export function keepBetterProfile(candidate: ResumeProfile | Partial<ResumeProfile> | null | undefined, existing: ResumeProfile | Partial<ResumeProfile> | null | undefined, rawText = ""): ResumeProfile | undefined {
  const c = candidate ? completeResumeProfile(candidate, rawText) : undefined;
  const e = existing ? completeResumeProfile(existing, rawText) : undefined;
  if (!c && !e) return undefined;
  if (!c) return e && !isLowQualityResumeProfile(e) ? e : undefined;
  if (!e) return !isLowQualityResumeProfile(c) ? c : undefined;

  // Always pick the higher-scoring base, then merge skills/languages from both
  // so a re-parse that produces fewer skills never discards the richer skill set.
  const base = profileScore(c) >= profileScore(e) ? c : e;
  const other = base === c ? e : c;

  // Merge skills: keep all unique skills from both parses
  const mergedSkills = unique([...base.skills, ...other.skills], (s) => s);

  // Keep the best name: prefer whichever is valid; if both valid, prefer the one
  // from the higher-scoring base unless it's empty.
  const bestName = base.basics.name || other.basics.name;

  return {
    ...base,
    basics: { ...base.basics, name: bestName },
    skills: mergedSkills,
    languages: unique([...base.languages, ...other.languages], (l) => l.split(/[\s-]/)[0].toLowerCase()),
  };
}

export function mergePreservingOriginalStructure(input: ResumeProfile, rewritten: Partial<ResumeProfile> | null | undefined): ResumeProfile {
  const original = completeResumeProfile(input, input.rawText || "");
  const out = completeResumeProfile(rewritten || {}, original.rawText || "");

  out.basics.name = original.basics.name;
  out.basics.email = original.basics.email;
  out.basics.phone = original.basics.phone;
  out.basics.location = original.basics.location;
  out.basics.linkedin = original.basics.linkedin;
  if (!out.basics.headline) out.basics.headline = original.basics.headline;
  if (!out.summary) out.summary = original.summary;

  out.experience = original.experience.map((old, index) => ({
    ...old,
    bullets: out.experience[index]?.bullets?.length ? out.experience[index].bullets : old.bullets,
  }));

  out.education = original.education.map((old) => old);

  out.projects = original.projects.map((old, index) => ({
    name: old.name,
    bullets: out.projects[index]?.bullets?.length ? out.projects[index].bullets : old.bullets,
  }));

  out.skills = unique([...out.skills, ...original.skills], (s) => s);
  out.languages = unique([...original.languages, ...out.languages], (s) => s);
  out.certifications = unique([...original.certifications, ...out.certifications], (s) => s);
  out.strengths = unique([...original.strengths, ...out.strengths], (s) => s);
  out.additionalEvidence = unique([...original.additionalEvidence, ...out.additionalEvidence], (s) => s);
  out.warnings = unique([...original.warnings, ...out.warnings], (s) => s);

  return completeResumeProfile(out, original.rawText || "");
}

export function resumeProfileHasMinimumStructure(profile: unknown): boolean {
  if (!profile || typeof profile !== "object") return false;
  const p = profile as ResumeProfile;
  return Boolean(
    (Array.isArray(p.experience) && p.experience.length > 0) ||
    (Array.isArray(p.education) && p.education.length > 0) ||
    (Array.isArray(p.skills) && p.skills.length > 0) ||
    (Array.isArray(p.projects) && p.projects.length > 0)
  );
}
