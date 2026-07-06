/**
 * lib/cvProfileMerge.ts
 *
 * GLOBAL WorkZo CV profile validator + merge layer.
 *
 * Goal:
 * - Treat parser output as draft data, not final truth.
 * - Validate and repair common CV parser mistakes before any feature uses it.
 * - Never let interview/runtime pages work from weak raw CV guesses when a
 *   structured ResumeProfile exists.
 * - Avoid sticky-data contamination across different uploaded CVs.
 *
 * Fixes covered:
 * - Education/college rows wrongly classified as experience.
 * - Year ranges wrongly extracted as phone numbers.
 * - Placeholder/template CV content accepted without warnings.
 * - Duplicate education/experience rows.
 * - Empty parsed values overwriting valid previous values.
 * - Previous profile arrays leaking into a different uploaded CV.
 */

export type CvBasics = {
  name?: string;
  headline?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  [key: string]: unknown;
};

export type CvWorkItem = {
  title?: string;
  company?: string;
  institution?: string;
  degree?: string;
  location?: string;
  dates?: string;
  bullets?: string[];
  [key: string]: unknown;
};

export type CvProfile = {
  basics?: CvBasics;
  name?: string;
  summary?: string;
  experience?: CvWorkItem[];
  education?: CvWorkItem[];
  projects?: CvWorkItem[];
  skills?: string[];
  languages?: string[];
  certifications?: string[];
  fileName?: string;
  warnings?: string[];
  confidence?: Record<string, number>;
  verifiedResumeFacts?: string[];
  isTemplate?: boolean;
  templateConfidencePenalty?: number;
  [key: string]: unknown;
};

export type MergeCvProfileInput = {
  previousProfile?: CvProfile | null;
  parsedProfile?: CvProfile | null;
  requestBody?: Record<string, unknown> | null;
  rawText?: string;
  fileName?: string;
};

const PLACEHOLDER_STRINGS = [
  "(no filename in request body)",
  "undefined",
  "null",
  "n/a",
  "none",
  "[object object]",
];

const BAD_NAME_WORD_RE =
  /^(profile|profilesummary|profileoverview|beruflichesprofil|beruflichesprofil|beruflichesprofil|profilübersicht|profiluebersicht|summary|workexperience|experience|education|skills?|projects?|certifications?|references?|languages?|contact|contacts|overview|objective|competencies|expertise|competency|berufserfahrung|bildungsweg|bildung|ausbildung|sprachen|kenntnisse|fähigkeiten|fahigkeiten|kontakt|lebenslauf|curriculum|vitae|resume|cv|candidate|professional|unknown|page|pages|left|right|column|columns|start|end|marker|layout|workzo|magist|lorem|ipsum|creativity|negotiation|leadership|teamwork|communication|thinking|planning|analysis|engineering|visualization|integration|python|sql|tableau|tensorflow|sklearn|matplotlib|seaborn|langchain|programming|bash|powershell|security|cloud|ticketing|agile|scrum|stakeholder|management|marketing|sales|product|project|program|software|frontend|backend|fullstack|data|customer|success|support|technical|system|network|devops|ux|ui|it|hr|finance|operations|accounting|auditing|teacher|preschool|kindergarten|degree|bachelor|master|mba|msc|phd|diploma|certificate|university|college|school|schule|programmierschule|hochschule|institute|akademie|gmbh|ltd|llc|inc|corp|group|holding|solutions|systems|technologies|digital|media|agency|studio|labs|consulting|ventures|tools?|tooling|invoicing|taxation|budgeting|forecasting|reporting|analytics|dashboard|platform|framework|methodology|infrastructure|architecture|magna|cum|laude|honours?|honors?|award|awards?|distinction|excellence|recognition|achievement|achievements|sachievement|sachievements|core|key|selected|academic|bootcamp|portfolio|financial|strategic|operational|graphic|motion|layout|photography|branding|advertising|testing|debugging|proficiency|proficiencies|assessment|evaluation|additional|information|history|background|qualifications|certified|accredited)$/i;

const EDUCATION_WORD_RE =
  /(university|college|school|hochschule|schule|universität|universitat|institute|academy|akademie|faculty|campus|coding school|programmierschule|arts and science|arts & science|tu\s|technical university|bachelor|master|mba|msc|b\.sc|m\.sc|degree|diploma|bootcamp|graduation|education|bildung|ausbildung)/i;

const EXPERIENCE_COMPANY_WORD_RE =
  /(gmbh|corp|corporation|ltd|limited|llc|inc|company|technologies|technology|solutions|systems|digital|agency|studio|group|consulting|industries|university of .*intern|borcelle|cummins|zoho|nexora|cloud|secure|cyber|visomax)/i;

const LOREM_RE = /(lorem ipsum|consectetur adipiscing|sed do eiusmod|dolor sit amet|reallygreatsite|anywhere st|jede straße|jede stadt|superduperseite|borcelle university|arowwai industries|ginyard international|aldenaire|salford & co|sample resume|template cv|available on request)/i;

const GENERIC_FAKE_CONTACT_RE = /(reallygreatsite|superduperseite|anywhere st|jede straße|jede stadt|123 anywhere|12345 jede)/i;
const CURRENT_YEAR = 2026;


export function isMeaningfulString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (PLACEHOLDER_STRINGS.some((p) => lower.includes(p))) return false;
  return true;
}

function stripWorkZoLayoutMarkers(value: string): string {
  return String(value || "")
    // Internal spatial extraction markers must never be considered resume data.
    .replace(/\[\s*PAGE[_\s-]*\d+[_\s-]*(?:LEFT|RIGHT)?[_\s-]*(?:COLUMN)?[_\s-]*(?:START|END)\s*\]/gi, " ")
    .replace(/\bPAGE\s+\d+\s+(?:LEFT|RIGHT)\s+COLUMN\s+(?:START|END)\b/gi, " ")
    .replace(/\bPAGE\s+(?:LEFT|RIGHT)\s+COLUMN\s+(?:START|END)\b/gi, " ")
    .replace(/\bPAGE\s+(?:START|END)\b/gi, " ")
    .replace(/\bWORKZO\s+LAYOUT\b/gi, " ")
    .replace(/\b(?:PAGE|LEFT|RIGHT|COLUMN|START|END)\b/gi, " ");
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? stripWorkZoLayoutMarkers(value).replace(/\s+/g, " ").trim() : "";
}

function normalizedKey(value: unknown): string {
  return cleanString(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}


function hasForbiddenNamePhrase(value: string): boolean {
  const normalized = normalizedKey(value);
  if (!normalized) return true;
  // Reject internal extraction markers, section headers, role fragments,
  // organization/education entities, and skill phrases. This is global and
  // intentionally not tied to any specific user's CV.
  if (/\b(page|left|right|column|start|end|marker|layout|workzo)\b/i.test(normalized)) return true;
  if (/\b(profile|profil|summary|experience|education|skills|contact|language|languages|references|achievements|awards|certifications|competencies|expertise|portfolio|about me|work experience|professional summary|berufserfahrung|bildung|ausbildung|kenntnisse|fähigkeiten|fahigkeiten|sprachen|kontakt|beruflichesprofil|profilubersicht|profiluebersicht|profilübersicht)\b/i.test(normalized)) return true;
  if (/(workexperience|profilesummary|professionalsummary|beruflichesprofil|customersucces|customersuccess|sachievements|beruflichesprofil|productdesign|workzo)/i.test(normalized.replace(/\s+/g, ""))) return true;
  if (EDUCATION_WORD_RE.test(value)) return true;
  if (EXPERIENCE_COMPANY_WORD_RE.test(value)) return true;
  return false;
}

export function isValidCandidateName(value: unknown): value is string {
  if (!isMeaningfulString(value)) return false;
  const trimmed = cleanString(value);
  if (!trimmed) return false;
  if (hasForbiddenNamePhrase(trimmed)) return false;
  if (/[\[\]{}<>_=|]/.test(String(value))) return false;
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  // Reject sentence fragments and extracted labels.
  if (trimmed.length > 55) return false;
  if (/[,:;!?]/.test(trimmed)) return false;
  if (!words.every((w) => /^[\p{L}'\-.]{2,28}$/u.test(w))) return false;
  if (words.some((w) => BAD_NAME_WORD_RE.test(w))) return false;
  if (words.some((w) => /^(cv|pdf|docx|resume|ats|it|ui|ux|hr|ai|ml|qa|seo|sem)$/i.test(w))) return false;
  if (new Set(words.map((w) => w.toLowerCase())).size === 1) return false;
  if (!words.some((w) => /^[\p{Lu}]/u.test(w))) return false;
  if (trimmed === trimmed.toUpperCase() && trimmed.length > 32) return false;
  return true;
}

function isValidEmail(value: unknown): value is string {
  if (!isMeaningfulString(value)) return false;
  const email = cleanString(value).replace(/\s*@\s*/g, "@");
  if (LOREM_RE.test(email)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email);
}

function isValidLinkedIn(value: unknown): value is string {
  if (!isMeaningfulString(value)) return false;
  const v = cleanString(value);
  return /linkedin\.com\/in\//i.test(v) || /^https?:\/\/.*linkedin\.com/i.test(v);
}

function isValidPhone(value: unknown): value is string {
  if (!isMeaningfulString(value)) return false;
  const v = cleanString(value);
  const digits = v.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 16) return false;
  // Reject dates/year ranges accidentally captured as phone.
  if (/\b(19|20)\d{2}\s*[-–—/]\s*(19|20)?\d{2}\b/.test(v)) return false;
  if (/^\(?\s*(19|20)\d{2}\s*[-–—]/.test(v)) return false;
  if (/graduation|dates|education|bachelor|master/i.test(v)) return false;
  return /^[+()\d][+()\d\s./-]{5,}$/.test(v);
}

function isValidHeadline(value: unknown): value is string {
  if (!isMeaningfulString(value)) return false;
  const v = cleanString(value);
  if (!v || v.length < 3 || v.length > 90) return false;
  const normalized = normalizedKey(v);
  if (!normalized) return false;
  if (/\b(page|left|right|column|start|end|marker|layout|workzo)\b/i.test(normalized)) return false;
  if (/^(skills?|contact|education|experience|profile|profil|summary|professional|executive summary|about me|objective|references?|languages?|certifications?|competencies|expertise|core competencies)$/i.test(v)) return false;
  if (/^(manager|engineer|developer|designer|analyst|specialist|consultant|professional|scientist|teacher)$/i.test(v.trim())) return false;
  if (EDUCATION_WORD_RE.test(v)) return false;
  if (EXPERIENCE_COMPANY_WORD_RE.test(v) && !/\b(engineer|manager|analyst|developer|designer|specialist|consultant|teacher|accountant|scientist|support|administrator|coordinator|lead|director|architect|strategist)\b/i.test(v)) return false;
  // Reject long summary fragments masquerading as a title.
  if (/\b(seeking employment|responsible for|experienced|experience|passionate|skilled in|with over|years of|lorem ipsum)\b/i.test(v) && v.split(/\s+/).length > 5) return false;
  return true;
}

function isMeaningfulArray<T = unknown>(value: unknown): value is T[] {
  return Array.isArray(value) && value.length > 0;
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isEducationLike(item: CvWorkItem): boolean {
  const text = [item.title, item.company, item.institution, item.degree, item.location]
    .map(cleanString)
    .join(" ");
  return EDUCATION_WORD_RE.test(text);
}

function isProbablyExperience(item: CvWorkItem): boolean {
  const title = cleanString(item.title);
  const company = cleanString(item.company);
  const text = `${title} ${company}`;
  if (!title && !company) return false;
  if (isEducationLike(item) && !/intern|internship|working student|graduate intern/i.test(text)) return false;
  return Boolean(company || /engineer|manager|analyst|developer|designer|consultant|specialist|support|intern|assistant|coordinator|lead|director/i.test(title));
}

function toEducationItem(item: CvWorkItem): CvWorkItem {
  const title = cleanString(item.title);
  const company = cleanString(item.company);
  return {
    degree: cleanString(item.degree) || (/bachelor|master|mba|msc|b\.sc|m\.sc|bootcamp|degree|diploma/i.test(title) ? title : cleanString(item.degree)),
    institution: cleanString(item.institution) || company || title,
    location: cleanString(item.location),
    dates: cleanString(item.dates),
    bullets: Array.isArray(item.bullets) ? item.bullets : [],
  };
}

function itemKey(item: CvWorkItem, fields: string[]): string {
  return fields.map((f) => normalizedKey((item as Record<string, unknown>)[f])).filter(Boolean).join("|");
}

function dedupeItems<T extends CvWorkItem>(items: T[], fields: string[]): T[] {
  const seen = new Set<string>();
  const fuzzySeen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = itemKey(item, fields) || JSON.stringify(item).slice(0, 160).toLowerCase();
    const fuzzy = [normalizedKey(item.title || item.degree), normalizedKey(item.dates)].filter(Boolean).join("|");
    if (seen.has(key)) continue;
    // For visually noisy templates, the same role/date may appear twice with company/location swapped.
    if (fuzzy && fuzzySeen.has(fuzzy) && !isMeaningfulArray(item.bullets)) continue;
    seen.add(key);
    if (fuzzy) fuzzySeen.add(fuzzy);
    out.push(item);
  }
  return out;
}

function cleanStringArray(values: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const s = cleanString(value);
    if (!isMeaningfulString(s)) continue;
    if (LOREM_RE.test(s)) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}


function containsFutureDate(value: unknown): boolean {
  const text = cleanString(value);
  if (!text) return false;
  const years = Array.from(text.matchAll(/\b(20\d{2})\b/g)).map((m) => Number(m[1]));
  return years.some((y) => y > CURRENT_YEAR + 1);
}

function degreeLooksInvalid(value: unknown): boolean {
  const v = cleanString(value);
  if (!v) return false;
  if (v.length > 95) return true;
  if (/\b(seasoned|recognised|recognized|committed|responsible|developed|managed|supported|assisted|experience|professional summary|about me)\b/i.test(v) && v.split(/\s+/).length > 8) return true;
  return false;
}

function extractPhoneFromRaw(rawText: string): string {
  const text = String(rawText || "");
  if (!text) return "";
  const candidates = Array.from(text.matchAll(/(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,5}\)?[\s.-]?){2,5}\d{2,6}/g))
    .map((m) => cleanString(m[0]));
  for (const candidate of candidates) {
    if (isValidPhone(candidate) && !containsFutureDate(candidate) && !/\b(19|20)\d{2}\b/.test(candidate.replace(/^\+\d{1,3}\s*/, ""))) return candidate;
  }
  return "";
}

function extractEmailFromRaw(rawText: string): string {
  const text = String(rawText || "").replace(/\s*@\s*/g, "@");
  const m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m && isValidEmail(m[0]) ? cleanString(m[0]) : "";
}

function isLikelyTemplate(rawText: string, profile: CvProfile): boolean {
  const text = [rawText, profile.summary, profile.basics?.email, profile.basics?.location, profile.basics?.linkedin].map(cleanString).join("\n");
  if (LOREM_RE.test(text) || GENERIC_FAKE_CONTACT_RE.test(text)) return true;
  const futureHits = [
    ...(profile.experience || []).map((e) => e.dates),
    ...(profile.education || []).map((e) => e.dates),
  ].filter(containsFutureDate).length;
  return futureHits >= 2;
}

function confidenceValue(ok: boolean, base: number, isTemplate: boolean) {
  if (!ok) return 0;
  return Number((isTemplate ? Math.min(base, 0.55) : base).toFixed(2));
}

function sanitizeProfile(profile: CvProfile, rawText = ""): CvProfile {
  const basics = profile.basics ?? {};
  const warnings = new Set<string>(asArray<string>(profile.warnings));
  const template = isLikelyTemplate(rawText, profile);
  if (template) warnings.add("template_or_placeholder_content_detected");

  const movedEducation: CvWorkItem[] = [];
  const cleanExperience: CvWorkItem[] = [];

  for (const item of asArray<CvWorkItem>(profile.experience)) {
    const fixed: CvWorkItem = {
      ...item,
      title: cleanString(item.title),
      company: cleanString(item.company),
      location: cleanString(item.location),
      dates: cleanString(item.dates),
      bullets: cleanStringArray(asArray(item.bullets)),
    };
    if (!fixed.title && !fixed.company) continue;
    if (isEducationLike(fixed) && !/intern|internship|working student|graduate intern/i.test(`${fixed.title} ${fixed.company}`)) {
      movedEducation.push(toEducationItem(fixed));
      warnings.add("education_entry_moved_from_experience");
      continue;
    }
    if (isProbablyExperience(fixed)) cleanExperience.push(fixed);
  }

  const cleanEducation: CvWorkItem[] = [];
  for (const item of [...asArray<CvWorkItem>(profile.education), ...movedEducation]) {
    const fixed: CvWorkItem = {
      ...item,
      degree: cleanString(item.degree || item.title),
      institution: cleanString(item.institution || item.company),
      location: cleanString(item.location),
      dates: cleanString(item.dates),
      bullets: cleanStringArray(asArray(item.bullets)),
    };
    if (degreeLooksInvalid(fixed.degree)) {
      warnings.add("invalid_education_entry_rejected");
      continue;
    }
    if (!fixed.degree && !fixed.institution) continue;
    cleanEducation.push(fixed);
  }

  const rawPhone = extractPhoneFromRaw(rawText);
  const phone = isValidPhone(basics.phone) ? cleanString(basics.phone) : rawPhone;
  if (basics.phone && !isValidPhone(basics.phone)) warnings.add("invalid_phone_rejected");

  const rawEmail = extractEmailFromRaw(rawText);
  const email = isValidEmail(basics.email) ? cleanString(basics.email).replace(/\s*@\s*/g, "@") : rawEmail;
  if (basics.email && !isValidEmail(basics.email)) warnings.add("invalid_email_rejected");
  const linkedin = isValidLinkedIn(basics.linkedin) ? cleanString(basics.linkedin) : "";

  const name = isValidCandidateName(basics.name) ? cleanString(basics.name) : isValidCandidateName(profile.name) ? cleanString(profile.name) : "";
  if ((basics.name || profile.name) && !name) warnings.add("invalid_name_rejected");

  return {
    ...profile,
    name,
    basics: {
      ...basics,
      name,
      email,
      phone,
      location: isMeaningfulString(basics.location) && !GENERIC_FAKE_CONTACT_RE.test(basics.location) ? cleanString(basics.location) : "",
      linkedin,
      headline: isValidHeadline(basics.headline) ? cleanString(basics.headline) : "",
    },
    summary: isMeaningfulString(profile.summary) && !LOREM_RE.test(profile.summary) ? cleanString(profile.summary) : "",
    experience: dedupeItems(cleanExperience, ["title", "company", "dates"]),
    education: dedupeItems(cleanEducation, ["degree", "institution", "dates"]),
    projects: dedupeItems(asArray<CvWorkItem>(profile.projects).map((p) => ({ ...p, name: cleanString((p as Record<string, unknown>).name), bullets: cleanStringArray(asArray(p.bullets)) })), ["name"]),
    skills: cleanStringArray(asArray(profile.skills)).slice(0, 40),
    languages: cleanStringArray(asArray(profile.languages)).slice(0, 12),
    certifications: cleanStringArray(asArray(profile.certifications)).slice(0, 20),
    warnings: Array.from(warnings),
    isTemplate: template,
    templateConfidencePenalty: template ? 0.45 : 0,
  };
}

function isSameCandidateOrFile(prev: CvProfile, parsed: CvProfile, fileName?: string): boolean {
  const prevFile = normalizedKey(prev.fileName);
  const newFile = normalizedKey(fileName || parsed.fileName);
  if (prevFile && newFile && prevFile === newFile) return true;
  const prevEmail = normalizedKey(prev.basics?.email);
  const newEmail = normalizedKey(parsed.basics?.email);
  if (prevEmail && newEmail && prevEmail === newEmail) return true;
  const prevName = normalizedKey(prev.basics?.name || prev.name);
  const newName = normalizedKey(parsed.basics?.name || parsed.name);
  return Boolean(prevName && newName && prevName === newName);
}

function firstValidString(candidates: unknown[], validator: (v: unknown) => boolean = isMeaningfulString): string {
  for (const candidate of candidates) {
    if (validator(candidate)) return cleanString(candidate);
  }
  return "";
}

function firstValidArray<T>(...arrays: (T[] | undefined | null)[]): T[] {
  for (const arr of arrays) {
    if (isMeaningfulArray(arr)) return arr;
  }
  return [];
}

export function shouldRejectAffinda(profile: CvProfile | null | undefined): boolean {
  if (!profile) return true;
  const sanitized = sanitizeProfile(profile);
  const exp = sanitized.experience?.length ?? 0;
  const edu = sanitized.education?.length ?? 0;
  const skills = sanitized.skills?.length ?? 0;
  const name = sanitized.basics?.name ?? sanitized.name ?? "";
  if (exp === 0 && edu === 0) return true;
  if (!isValidCandidateName(name)) return true;
  if (skills > 30 && exp === 0) return true;
  return false;
}


function compactSpacedCaps(line: string): string {
  const trimmed = cleanString(line);
  if (!trimmed) return "";
  // Convert "J O H N" to "JOHN". Do not try to split a full compacted
  // first+last name because there is no reliable boundary; use it only when
  // adjacent lines provide separate name parts.
  if (/^(?:[A-ZÀ-Ý]\s+){2,}[A-ZÀ-Ý]$/u.test(trimmed)) return trimmed.replace(/\s+/g, "");
  return trimmed;
}

function rawLines(rawText: string): string[] {
  return String(rawText || "")
    .split(/\n+/)
    .map((line) => compactSpacedCaps(line))
    .map((line) => cleanString(line))
    .filter(Boolean)
    .filter((line) => !/^\[?PAGE/i.test(line))
    .filter((line) => !/^(?:page|left|right|column|start|end|marker|layout)\b/i.test(line))
    .filter((line) => !/^redacted/i.test(line));
}

function scoreNameCandidate(line: string, index: number): number {
  const v = cleanString(line);
  if (!isValidCandidateName(v)) return -999;
  let score = 100 - index;
  const words = v.split(/\s+/);
  if (words.length === 2) score += 20;
  if (words.length === 3) score += 8;
  if (/^[A-ZÀ-Ý][a-zà-ÿ]+(?:\s+[A-ZÀ-Ý][a-zà-ÿ]+){1,3}$/u.test(v)) score += 20;
  if (v === v.toUpperCase()) score -= 8;
  return score;
}

function extractCandidateNameFromRaw(rawText: string, fileName?: string): string {
  const lines = rawLines(rawText).slice(0, 80);
  const candidates: { value: string; score: number }[] = [];
  for (let i = 0; i < Math.min(lines.length, 50); i += 1) {
    const line = lines[i];
    candidates.push({ value: line, score: scoreNameCandidate(line, i) });
    // Some visual templates place first and last name on adjacent lines.
    if (i + 1 < lines.length) {
      const combined = `${line} ${lines[i + 1]}`;
      candidates.push({ value: combined, score: scoreNameCandidate(combined, i) - 2 });
    }
  }
  const fileStem = cleanString(fileName || "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b(cv|resume|lebenslauf|ats|final|modern|professional|updated|copy|\d+)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (fileStem) candidates.push({ value: fileStem, score: scoreNameCandidate(fileStem, 90) - 15 });
  const best = candidates.filter((c) => c.score > 0).sort((a, b) => b.score - a.score)[0];
  return best?.value || "";
}

function extractHeadlineFromRaw(rawText: string, selectedName: string): string {
  const lines = rawLines(rawText).slice(0, 90);
  const nameKey = normalizedKey(selectedName);
  const nameIndex = nameKey ? lines.findIndex((line) => normalizedKey(line) === nameKey) : -1;
  const searchStart = nameIndex >= 0 ? nameIndex + 1 : 0;
  const searchEnd = Math.min(lines.length, searchStart + 12);
  for (let i = searchStart; i < searchEnd; i += 1) {
    const line = lines[i];
    if (isValidHeadline(line)) return cleanString(line);
  }
  return "";
}

function headlineFromExperience(experience: CvWorkItem[]): string {
  for (const item of experience || []) {
    const title = cleanString(item.title);
    if (isValidHeadline(title)) return title;
  }
  return "";
}

function removeCandidateNameFromSkills(skills: string[], candidateName: string): string[] {
  const nameKey = normalizedKey(candidateName);
  return cleanStringArray(skills).filter((skill) => {
    const key = normalizedKey(skill);
    if (!key) return false;
    if (nameKey && key === nameKey) return false;
    if (isValidCandidateName(skill)) return false;
    if (/\b(page|left|right|column|start|end|marker|layout|workzo)\b/i.test(key)) return false;
    return true;
  });
}

export function mergeCvProfile(input: MergeCvProfileInput): CvProfile {
  const body = input.requestBody ?? {};
  const bodyExisting = (body.existingProfile as CvProfile | undefined) || (body.resumeProfile as CvProfile | undefined) || (body.profile as CvProfile | undefined) || null;
  const rawText = input.rawText || "";

  const parsed = sanitizeProfile(input.parsedProfile ?? {}, rawText);
  const previousRaw = input.previousProfile ?? bodyExisting ?? {};
  const previous = sanitizeProfile(previousRaw, rawText);
  const sameCandidate = isSameCandidateOrFile(previous, parsed, input.fileName || (body.fileName as string));
  const allowPreviousFallback = sameCandidate || !isMeaningfulArray(parsed.experience) && !isMeaningfulArray(parsed.education) && !isValidCandidateName(parsed.basics?.name);

  const prevBasics = previous.basics ?? {};
  const parsedBasics = parsed.basics ?? {};
  const existingBasics = bodyExisting?.basics ?? {};

  // Raw-text name recovery is unreliable on multi-column / sidebar / Canva /
  // German layouts: it frequently returns layout markers ("Page Left Column
  // End"), section headers, or company/school names. The canonical finalizer
  // (workzoCvGlobalFinalizer) now owns identity, so raw-name recovery is
  // disabled here by default and only re-enabled behind an explicit flag once a
  // header-confidence engine exists. Keep WORKZO_ALLOW_RAW_NAME_RECOVERY=false
  // in production.
  const rawName =
    process.env.WORKZO_ALLOW_RAW_NAME_RECOVERY === "true"
      ? extractCandidateNameFromRaw(rawText, input.fileName || (body.fileName as string) || parsed.fileName)
      : "";

  // Authoritative identity rule:
  // 1) Prefer the current parser's validated name.
  // 2) Use a user/body supplied name only if parser name is missing.
  // 3) Use raw/layout recovery only as a last resort, and only if it passes the
  //    same human-name validator.
  // 4) Previous profile may only fill identity when the current parse has no
  //    valid structure. This prevents stale or layout-marker names from
  //    overwriting a good current upload.
  const parsedName = firstValidString([parsedBasics.name, parsed.name], isValidCandidateName);
  const suppliedName = firstValidString([body.candidateName, existingBasics.name, bodyExisting?.name], isValidCandidateName);
  const previousName = allowPreviousFallback ? firstValidString([prevBasics.name, previous.name], isValidCandidateName) : "";
  const name = firstValidString([
    parsedName,
    suppliedName,
    previousName,
    // rawName is intentionally last and empty unless WORKZO_ALLOW_RAW_NAME_RECOVERY=true.
    rawName,
  ], isValidCandidateName);

  const email = firstValidString([
    parsedBasics.email,
    existingBasics.email,
    allowPreviousFallback ? prevBasics.email : "",
  ], isValidEmail);

  const phone = firstValidString([
    parsedBasics.phone,
    existingBasics.phone,
    allowPreviousFallback ? prevBasics.phone : "",
  ], isValidPhone);

  const location = firstValidString([
    parsedBasics.location,
    existingBasics.location,
    allowPreviousFallback ? prevBasics.location : "",
  ]);

  const linkedin = firstValidString([
    parsedBasics.linkedin,
    existingBasics.linkedin,
    allowPreviousFallback ? prevBasics.linkedin : "",
  ], isValidLinkedIn);

  const rawHeadline = extractHeadlineFromRaw(rawText, name);
  const headline = firstValidString([
    parsedBasics.headline,
    headlineFromExperience(parsed.experience || []),
    rawHeadline,
    existingBasics.headline,
    allowPreviousFallback ? prevBasics.headline : "",
  ], isValidHeadline);

  const summary = firstValidString([
    parsed.summary,
    allowPreviousFallback ? previous.summary : "",
  ]);

  const resolvedFileName = firstValidString([
    input.fileName,
    parsed.fileName,
    body.fileName,
    allowPreviousFallback ? bodyExisting?.fileName : "",
    allowPreviousFallback ? previous.fileName : "",
  ]);

  const experience = firstValidArray<CvWorkItem>(parsed.experience, allowPreviousFallback ? previous.experience : undefined);
  const education = firstValidArray<CvWorkItem>(parsed.education, allowPreviousFallback ? previous.education : undefined);
  const projects = firstValidArray<CvWorkItem>(parsed.projects, allowPreviousFallback ? previous.projects : undefined);
  const skills = removeCandidateNameFromSkills(firstValidArray<string>(parsed.skills, allowPreviousFallback ? previous.skills : undefined), name);
  const languages = firstValidArray<string>(parsed.languages, allowPreviousFallback ? previous.languages : undefined);
  const certifications = firstValidArray<string>(parsed.certifications, allowPreviousFallback ? previous.certifications : undefined);

  const warnings = Array.from(new Set([...(parsed.warnings ?? []), ...(allowPreviousFallback ? previous.warnings ?? [] : [])]));
  const isTemplate = Boolean(parsed.isTemplate || (allowPreviousFallback && previous.isTemplate));

  const verifiedResumeFacts = [
    name ? `Candidate name: ${name}` : "",
    headline ? `Headline: ${headline}` : "",
    ...experience.slice(0, 10).map((e) => `Experience: ${[e.title, e.company, e.dates].map(cleanString).filter(Boolean).join(" | ")}`),
    ...education.slice(0, 8).map((e) => `Education: ${[e.degree, e.institution, e.dates].map(cleanString).filter(Boolean).join(" | ")}`),
    skills.length ? `Skills: ${skills.slice(0, 30).join(", ")}` : "",
  ].filter(Boolean);

  const finalProfile: CvProfile = {
    ...(!allowPreviousFallback ? {} : previous),
    ...parsed,
    name,
    basics: {
      ...(!allowPreviousFallback ? {} : prevBasics),
      ...parsedBasics,
      name,
      email,
      phone,
      location,
      linkedin,
      headline,
    },
    summary,
    experience,
    education,
    projects,
    skills,
    languages,
    certifications,
    fileName: resolvedFileName,
    warnings,
    confidence: {
      name: confidenceValue(Boolean(name), 0.99, isTemplate),
      email: confidenceValue(Boolean(email), 0.98, isTemplate),
      phone: confidenceValue(Boolean(phone), 0.97, isTemplate),
      experience: confidenceValue(Boolean(experience.length), 0.98, isTemplate),
      education: confidenceValue(Boolean(education.length), 0.98, isTemplate),
      skills: confidenceValue(Boolean(skills.length), 0.97, isTemplate),
    },
    verifiedResumeFacts,
    isTemplate,
    templateConfidencePenalty: isTemplate ? 0.45 : 0,
    ...(rawText ? { _rawTextLength: rawText.length } : {}),
  };

  console.info("[WorkZo CV Pipeline] profile.merge.result", {
    keptPreviousName: allowPreviousFallback && !isValidCandidateName(parsedBasics.name),
    rejectedParsedName: parsedBasics.name && !isValidCandidateName(parsedBasics.name) ? parsedBasics.name : undefined,
    finalName: finalProfile.basics?.name,
    finalFileName: finalProfile.fileName,
    sameCandidate,
    allowPreviousFallback,
    exp: experience.length,
    edu: education.length,
    warnings,
    isTemplate,
    source: (parsed as Record<string, unknown>).source ?? "unknown",
  });

  return Object.freeze(finalProfile);
}

export function mergeCvProfileClient(input: {
  previousProfile?: CvProfile | null;
  parsedProfile?: CvProfile | null;
  fileName?: string;
}): CvProfile {
  return mergeCvProfile({
    previousProfile: input.previousProfile,
    parsedProfile: input.parsedProfile,
    fileName: input.fileName,
  });
}
