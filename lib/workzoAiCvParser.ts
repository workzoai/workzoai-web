import OpenAI from "openai";
import {
  extractResumeProfileComplex,
  normalizeResumeText,
  type ResumeEducation,
  type ResumeExperience,
  type ResumeProfile,
  type ResumeProject,
} from "@/lib/workzoResumeParser";

export type WorkZoCvParserSource =
  | "ai_structured_cv"
  | "local_fallback_no_api_key"
  | "local_fallback_invalid_ai_json"
  | "local_fallback_ai_error"
  | "empty";

type AiResumeExperience = { title?: unknown; company?: unknown; location?: unknown; dates?: unknown; bullets?: unknown };
type AiResumeEducation = { degree?: unknown; institution?: unknown; location?: unknown; dates?: unknown };
type AiResumeProject = { name?: unknown; bullets?: unknown };

type AiResumeJson = {
  basics?: { name?: unknown; headline?: unknown; email?: unknown; phone?: unknown; location?: unknown; linkedin?: unknown };
  summary?: unknown;
  experience?: AiResumeExperience[];
  education?: AiResumeEducation[];
  skills?: unknown;
  projects?: AiResumeProject[];
  languages?: unknown;
  certifications?: unknown;
  strengths?: unknown;
  additionalEvidence?: unknown;
  warnings?: unknown;
};

export type WorkZoAiCvParserResult = { ok: boolean; source: WorkZoCvParserSource; resumeProfile: ResumeProfile; error: string };

type ParseInput = {
  cvText?: string;
  layoutText?: string;
  fileName?: string;
  jobDescription?: string;
  targetRole?: string;
  targetMarket?: string;
  language?: string;
};

function clean(value: unknown) {
  if (typeof value !== "string") return "";
  return normalizeResumeText(value).replace(/\s+/g, " ").trim();
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/\n|;|\|/)
      .map((item) => item.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean);
  }
  return [];
}

function unique(items: string[], limit = 50) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const value = clean(item);
    const key = value.toLowerCase().replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= limit) break;
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

function normalizeForCompare(value: string) {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SECTION_HEADER_RE = /^(contact|contacts|kontakt|kontaktdaten|skills|summary of skills|summary|overview|profile|profil|about me|objective|work experience|professional experience|experience|employment history|berufserfahrung|werdegang|education|education and training|training|bildungsweg|bildung|ausbildung|projects|projekte|certifications|zertifikate|awards|awards received|auszeichnungen|languages|sprachen|interests|references|referenzen)$/i;

const CONTACT_RE = /@|www\.|http|linkedin|github|phone|mobile|email|e-mail|address|adresse|street|straße|strasse|road|avenue|\+?\d[\d\s()./-]{5,}/i;

const ROLE_WORD_RE = /^(project|product|program|programme|portfolio|it|ux|ui|software|data|business|marketing|sales|account|customer|success|support|technical|system|systems|network|cloud|frontend|backend|fullstack|devops|hr|finance|operations|office|resource|enterprise|planning|erp|manager|engineer|developer|designer|analyst|specialist|consultant|coordinator|administrator|assistant|assistent|director|lead|head|chief|officer|executive|intern|trainee|teacher|nurse|doctor|architect|owner|founder|recruiter|representative|technician|scientist|researcher|writer|editor|planner|leiter|leitung|entwickler|berater|praktikant)$/i;

const ROLE_OR_HEADLINE_RE = /\b(project|product|program|programme|portfolio|it|ux|ui|software|data|business|marketing|sales|account|customer|success|support|technical|system|systems|network|cloud|frontend|backend|full[ -]?stack|devops|hr|finance|operations|resource|enterprise|planning|erp|manager|engineer|developer|designer|analyst|specialist|consultant|coordinator|administrator|assistant|assistent|director|lead|head|chief|officer|executive|intern|trainee|teacher|nurse|doctor|architect|recruiter|technician|scientist|researcher|planner|leiter|entwickler|berater)\b/i;

const NON_NAME_PHRASE_RE = /\b(project management|cost planning|cost planning and analysis|enterprise resource planning|resource planning|software development|process improvement|personal and team training|machine learning|data visualization|data visualisation|data engineering|generative ai|public relations|time management|teamwork|leadership|critical thinking|effective communication|summary of skills|work experience|education and training|programm\s*\d+)\b/i;

// Words that are never part of a real human name. If ALL parts of a multi-word
// string are in this set, the string is a skill/section phrase, not a name.
const NEVER_A_NAME_WORD_RE = /^(matplotlib|seaborn|tableau|tensorflow|sklearn|scikit|langchain|langkette|pytorch|numpy|pandas|keras|pyspark|hadoop|spark|airflow|dbt|looker|powerbi|power|bash|powershell|shell|linux|ubuntu|debian|redhat|android|ios|swift|kotlin|flutter|react|angular|vue|django|flask|fastapi|nodejs|express|spring|docker|kubernetes|helm|terraform|ansible|jenkins|gitlab|github|bitbucket|jira|confluence|slack|salesforce|hubspot|zendesk|servicenow|ticketing|systeme|remote|netzwerke|betriebssysteme|programmierung|datenanalyse|weiterbildung|kontakt|fähigkeiten|fahigkeiten|berufserfahrung|ausbildung|bildungsweg|sprachen|profil|profilu|ubersicht|kenntnisse|lebenslauf|bewerbung|programm|programme|programs|relations|teamwork|leadership|communication|thinking|management|planning|analysis|engineering|visualization|visualisation|integration|scraping|generation|retrieval|augmented|generative|bootcamp|certification|intern|freelance|volunteer|candidate|profilesummary|workexperience)$/i;

const ORG_OR_INSTITUTION_RE = /\b(gmbh|ug|ag|kg|ohg|ltd|limited|llc|inc|corp|corporation|company|companies|group|holding|holdings|services|solutions|systems|technologies|technology|tech|software|digital|media|productions?|studio|studios|agency|agencies|partners|consulting|consultants|ventures|labs?|university|universität|universitaet|college|school|schule|hochschule|institute|institut|center|centre|academy|akademie|bootcamp|campus|faculty|department)\b/i;

const DEGREE_OR_EDU_RE = /\b(bachelor|master|mba|msc|ma|ba|bsc|phd|degree|diploma|certificate|certification|arts|science|engineering|management|marketing|grade|thesis|abschluss|studium|ausbildung)\b/i;

// Global address/location rejection. This prevents values like
// "123 Main Street", "Any City", "Berlin Germany", or street fragments
// from being accepted as candidate names.
const ADDRESS_OR_LOCATION_RE = /\b(street|straße|strasse|str\.?|road|rd\.?|avenue|ave\.?|weg|platz|gasse|allee|ring|drive|dr\.?|lane|ln\.?|city|town|village|anywhere|germany|deutschland|france|india|italy|spain|canada|usa|united states|uk|united kingdom|w[üu]rzburg|berlin|frankfurt|munich|münchen|hamburg|cologne|köln|chennai|london|manchester|ostia)\b/i;

const YEAR_OR_DATE_RE = /\b(?:19|20)\d{2}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b|\b(heute|present|current)\b/i;

function compactDecorativeLine(line: string) {
  const trimmed = line.replace(/[•●▪◦]/g, " ").replace(/\s+/g, " ").trim();
  const tokens = trimmed.split(/\s+/).filter(Boolean);

  if (tokens.length >= 4 && tokens.every((t) => /^[A-ZÄÖÜ]$/u.test(t))) {
    const compact = tokens.join("");
    const sectionMap: Record<string, string> = {
      CONTACTS: "CONTACTS",
      CONTACT: "CONTACT",
      KONTAKT: "KONTAKT",
      SKILLS: "SKILLS",
      SUMMARY: "SUMMARY",
      OVERVIEW: "OVERVIEW",
      PROFILE: "PROFILE",
      PROFIL: "PROFIL",
      WORKEXPERIENCE: "WORK EXPERIENCE",
      PROFESSIONALERFAHRUNG: "PROFESSIONAL EXPERIENCE",
      BERUFSERFAHRUNG: "BERUFSERFAHRUNG",
      EDUCATION: "EDUCATION",
      EDUCATIONANDTRAINING: "EDUCATION AND TRAINING",
      BILDUNGSWEG: "BILDUNGSWEG",
      BILDUNG: "BILDUNG",
      PROJECTS: "PROJECTS",
      PROJEKTE: "PROJEKTE",
      AWARDSRECEIVED: "AWARDS RECEIVED",
      AWARDS: "AWARDS",
      LANGUAGES: "LANGUAGES",
      SPRACHEN: "SPRACHEN",
      CERTIFICATIONS: "CERTIFICATIONS",
      ZERTIFIKATE: "ZERTIFIKATE",
    };
    if (sectionMap[compact]) return sectionMap[compact];
    return compact;
  }

  return trimmed;
}

function prepareLines(rawText: string) {
  return String(rawText || "")
    .split(/\n+/)
    .map(compactDecorativeLine)
    .map((line) => line.replace(/[\t]+/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function isTitleCaseOrCaps(parts: string[], raw: string) {
  if (raw === raw.toUpperCase()) return true;
  return parts.filter((part) => /^[A-ZÀ-ÝÄÖÜ]/u.test(part)).length >= Math.max(2, parts.length - 1);
}

function isLikelyHumanName(value: unknown): string {
  const raw = clean(value)
    .replace(/^(candidate\s*name|name|applicant)\s*[:\-]\s*/i, "")
    .replace(/[^\p{L}' .-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!raw || raw.length < 3 || raw.length > 60) return "";
  if (CONTACT_RE.test(raw)) return "";
  if (SECTION_HEADER_RE.test(raw)) return "";
  if (NON_NAME_PHRASE_RE.test(raw)) return "";
  if (ORG_OR_INSTITUTION_RE.test(raw)) return "";
  if (DEGREE_OR_EDU_RE.test(raw)) return "";
  if (ADDRESS_OR_LOCATION_RE.test(raw)) return "";
  if (YEAR_OR_DATE_RE.test(raw)) return "";

  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 5) return "";

  for (const part of parts) {
    if (part.length < 2 || part.length > 25) return "";
    if (!/^[\p{L}]/u.test(part)) return "";
    if (ROLE_WORD_RE.test(normalizeForCompare(part))) return "";
  }

  // Hard reject: if EVERY word matches a known skill/tool/section word,
  // this is a phrase like "Matplotlib Seaborn Tableau" or "Public Relations",
  // not a human name.
  if (parts.every(p => NEVER_A_NAME_WORD_RE.test(p))) return "";

  // A real person name is normally Title Case, ALL CAPS, or mixed case with
  // each token starting with a letter. This accepts global names while still
  // rejecting skills, roles, companies and places through the filters above.
  if (!isTitleCaseOrCaps(parts, raw)) return "";
  return titleCaseName(raw);
}

function isLikelySingleNameToken(value: unknown): string {
  const raw = clean(value)
    .replace(/[^\p{L}'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!raw || raw.length < 2 || raw.length > 25) return "";
  if (raw.split(/\s+/).length !== 1) return "";
  if (SECTION_HEADER_RE.test(raw)) return "";
  if (ROLE_WORD_RE.test(normalizeForCompare(raw))) return "";
  if (ORG_OR_INSTITUTION_RE.test(raw)) return "";
  if (DEGREE_OR_EDU_RE.test(raw)) return "";
  if (ADDRESS_OR_LOCATION_RE.test(raw)) return "";
  if (YEAR_OR_DATE_RE.test(raw)) return "";
  if (!/^[\p{L}][\p{L}'-]*$/u.test(raw)) return "";
  return titleCaseName(raw);
}

function addCandidate(
  candidates: CandidateName[],
  rawName: string,
  index: number,
  score: number,
) {
  const name = isLikelyHumanName(rawName);
  if (!name) return;
  candidates.push({ name, index, score });
}

function extractLinkedin(rawText: string) {
  return rawText.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[A-Z0-9._%+\-/]+/i)?.[0] || "";
}

function extractPhone(rawText: string) {
  const candidates = String(rawText || "").match(/(?:\+\d{1,3}[\s().-]*)?(?:\(?\d{2,5}\)?[\s().-]*){2,}\d{2,}/g) || [];
  for (const candidate of candidates) {
    const value = candidate.replace(/\s+/g, " ").trim();
    const digits = value.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 16) continue;
    // Reject pure date ranges like 2017-2021 or 2013 2016.
    if (/^(?:19|20)\d{2}\s*[-–—]\s*(?:19|20)\d{2}$/.test(value)) continue;
    if (!/[+()]|\d{2,}[\s.-]\d{2,}/.test(value)) continue;
    return value;
  }
  return "";
}

function extractEmail(rawText: string) {
  const compact = rawText.replace(/([A-Z0-9._%+-]+)\s*\n\s*@\s*([A-Z0-9.-]+\.[A-Z]{2,})/gi, "$1@$2");
  return compact.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
}

function extractNameFromEmail(rawText: string) {
  const email = extractEmail(rawText);
  if (!email) return "";
  const local = email.split("@")[0].replace(/[._-]+/g, " ").replace(/\d+/g, " ").trim();
  return isLikelyHumanName(local);
}

function extractNameFromFileName(fileName = "") {
  const value = fileName
    .replace(/\.(pdf|docx|doc|txt)$/gi, "")
    .replace(/[_-]+/g, " ")
    .replace(/\d+/g, " ")
    .split(/\s+/)
    .filter((w) => !/^(cv|resume|lebenslauf|bewerbung|curriculum|vitae|updated|final|copy|draft|template|sample|example|untitled|design|new|old|my|the)$/i.test(w))
    .join(" ")
    .trim();
  return isLikelyHumanName(value);
}

type CandidateName = { name: string; index: number; score: number };

function scoreNameCandidate(name: string, index: number, lines: string[], fileName = ""): number {
  const original = lines[index] || "";
  let score = 0;

  if (index < 20) score += 20;
  else if (index < 60) score += 12;
  else if (index < 120) score += 4;

  if (original === original.toUpperCase()) score += 14;
  if (/^[A-ZÀ-ÝÄÖÜ][a-zà-ÿäöüß'-]+\s+[A-ZÀ-ÝÄÖÜ]/u.test(original)) score += 10;

  const prev = lines[index - 1] || "";
  const next = lines[index + 1] || "";
  const prev2 = lines[index - 2] || "";
  const next2 = lines[index + 2] || "";

  if (ROLE_OR_HEADLINE_RE.test(prev) && !isLikelyHumanName(prev)) score += 22;
  if (ROLE_OR_HEADLINE_RE.test(next) && !isLikelyHumanName(next)) score += 26;
  if (ROLE_OR_HEADLINE_RE.test(prev2) && !isLikelyHumanName(prev2)) score += 8;
  if (ROLE_OR_HEADLINE_RE.test(next2) && !isLikelyHumanName(next2)) score += 8;

  const near = [prev2, prev, next, next2].join(" ");
  if (CONTACT_RE.test(next)) score += 18;
  if (CONTACT_RE.test(prev)) score += 10;
  if (CONTACT_RE.test(near)) score += 5;
  if (ADDRESS_OR_LOCATION_RE.test(original)) score -= 80;
  if (ORG_OR_INSTITUTION_RE.test(original)) score -= 80;
  if (DEGREE_OR_EDU_RE.test(original)) score -= 50;
  if (ORG_OR_INSTITUTION_RE.test(near)) score -= 7;
  if (DEGREE_OR_EDU_RE.test(near)) score -= 12;
  if (/^(skills|summary of skills|kenntnisse|programme|programms)$/i.test(prev)) score -= 4;

  const fileCandidate = extractNameFromFileName(fileName);
  if (fileCandidate && normalizeForCompare(fileCandidate) === normalizeForCompare(name)) score += 18;

  return score;
}

export function extractBestCandidateName(rawText: string, fileName = "", modelName = "") {
  const lines = prepareLines(rawText).slice(0, 220);
  const candidates: CandidateName[] = [];

  // 1) Strong source-text candidates. These beat AI every time.
  lines.forEach((line, index) => {
    const cleanedLine = line
      .replace(/^[•\-*]\s*/, "")
      .replace(/^(candidate\s*name|name|applicant)\s*[:\-]\s*/i, "")
      .trim();

    // Multi-word name on one line: HARITHA VIJAYAKUMAR, Laura Hess, Daniel Foster.
    addCandidate(candidates, cleanedLine, index, scoreNameCandidate(cleanedLine, index, lines, fileName));

    // Decorative split over 2 lines: SURENDER / DILLIBABU.
    const first = isLikelySingleNameToken(cleanedLine);
    const next = isLikelySingleNameToken(lines[index + 1] || "");
    if (first && next) {
      addCandidate(candidates, `${first} ${next}`, index, 54 + Math.max(0, 20 - index));
    }

    // Split with job title in the middle: ADELINE / ENGLISH TEACHER / PALMERSTON.
    const afterRole = isLikelySingleNameToken(lines[index + 2] || "");
    const between = lines[index + 1] || "";
    if (first && afterRole && ROLE_OR_HEADLINE_RE.test(between) && !isLikelyHumanName(between)) {
      addCandidate(candidates, `${first} ${afterRole}`, index, 62 + Math.max(0, 20 - index));
    }

    // Sometimes pdf text joins a title and name: "Graphic Designer DANI MARTINEZ".
    const capsName = cleanedLine.match(/\b([A-ZÀ-ÝÄÖÜ]{2,}(?:\s+[A-ZÀ-ÝÄÖÜ]{2,}){1,4})\b/u)?.[1];
    if (capsName && capsName !== cleanedLine) {
      addCandidate(candidates, capsName, index, 40 + Math.max(0, 15 - index));
    }
  });

  // 2) File/email hints are useful but weaker than source text.
  const fileCandidate = extractNameFromFileName(fileName);
  if (fileCandidate) candidates.push({ name: fileCandidate, index: 998, score: 18 });

  const emailCandidate = extractNameFromEmail(rawText);
  if (emailCandidate) candidates.push({ name: emailCandidate, index: 997, score: 14 });

  // 3) AI model name is the weakest fallback. It is often a company name on
  // Canva/two-column CVs, so it must never outrank text-derived candidates.
  const modelCandidate = isLikelyHumanName(modelName);
  if (modelCandidate) candidates.push({ name: modelCandidate, index: 999, score: 2 });

  const deduped = new Map<string, CandidateName>();
  for (const c of candidates) {
    const key = normalizeForCompare(c.name);
    const existing = deduped.get(key);
    if (!existing || c.score > existing.score) deduped.set(key, c);
  }

  const ranked = [...deduped.values()].sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked[0]?.score >= 8 ? ranked[0].name : "";
}

function coerceExperience(items: unknown): ResumeExperience[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item): item is AiResumeExperience => Boolean(item && typeof item === "object"))
    .map((item) => ({
      title: clean(item.title),
      company: clean(item.company),
      location: clean(item.location),
      dates: clean(item.dates),
      bullets: unique(asList(item.bullets), 8),
    }))
    .filter((item) => item.title || item.company || item.bullets.length)
    .slice(0, 10);
}

function coerceEducation(items: unknown): ResumeEducation[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item): item is AiResumeEducation => Boolean(item && typeof item === "object"))
    .map((item) => ({ degree: clean(item.degree), institution: clean(item.institution), location: clean(item.location), dates: clean(item.dates) }))
    .filter((item) => item.degree || item.institution)
    .slice(0, 8);
}

function coerceProjects(items: unknown): ResumeProject[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item): item is AiResumeProject => Boolean(item && typeof item === "object"))
    .map((item) => ({ name: clean(item.name) || "Project", bullets: unique(asList(item.bullets), 6) }))
    .filter((item) => item.name || item.bullets.length)
    .slice(0, 8);
}

function extractJsonObject(raw: string): AiResumeJson | null {
  let text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try { return JSON.parse(text) as AiResumeJson; } catch {}
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]) as AiResumeJson; } catch {}
  return null;
}

function repairProfileIdentity(profile: ResumeProfile, rawText: string, fileName = "", modelName = ""): ResumeProfile {
  // Lock identity from the CV source text first. AI identity is only fallback.
  const lockedName = extractBestCandidateName(rawText, fileName, "");
  const fallbackName = extractBestCandidateName(rawText, fileName, modelName || profile.basics?.name || "");
  const name = lockedName || fallbackName || "";

  const email = extractEmail(rawText) || clean(profile.basics?.email);
  const phone = extractPhone(rawText) || clean(profile.basics?.phone);
  const linkedin = extractLinkedin(rawText) || clean(profile.basics?.linkedin);

  return {
    ...profile,
    rawText,
    basics: {
      ...profile.basics,
      name,
      email,
      phone,
      linkedin,
    },
  } as ResumeProfile;
}

function buildProfileFromAi(ai: AiResumeJson, fallback: ResumeProfile, rawText: string, fileName = ""): ResumeProfile {
  const basics = ai.basics && typeof ai.basics === "object" ? ai.basics : {};
  const experience = coerceExperience(ai.experience);
  const education = coerceEducation(ai.education);
  const projects = coerceProjects(ai.projects);
  const skills = unique(asList(ai.skills), 40).filter((s) => !SECTION_HEADER_RE.test(s));
  const languages = unique(asList(ai.languages), 12);
  const certifications = unique(asList(ai.certifications), 12);

  const profile = {
    ...fallback,
    rawText,
    basics: {
      name: clean(basics.name),
      headline: clean(basics.headline) || experience[0]?.title || fallback.basics?.headline || "Professional",
      email: clean(basics.email) || fallback.basics?.email || extractEmail(rawText),
      phone: clean(basics.phone) || fallback.basics?.phone || "",
      location: clean(basics.location) || fallback.basics?.location || "",
      linkedin: clean(basics.linkedin) || fallback.basics?.linkedin || "",
    },
    summary: clean(ai.summary) || fallback.summary || "",
    experience: experience.length ? experience : fallback.experience || [],
    education: education.length ? education : fallback.education || [],
    skills: skills.length ? skills : fallback.skills || [],
    projects: projects.length ? projects : fallback.projects || [],
    languages: languages.length ? languages : fallback.languages || [],
    certifications: certifications.length ? certifications : fallback.certifications || [],
    strengths: unique(asList(ai.strengths), 12).length ? unique(asList(ai.strengths), 12) : fallback.strengths || [],
    additionalEvidence: unique(asList(ai.additionalEvidence), 18).length ? unique(asList(ai.additionalEvidence), 18) : fallback.additionalEvidence || [],
    warnings: unique(asList(ai.warnings), 10),
    previewText: fallback.previewText,
  } as ResumeProfile;

  return repairProfileIdentity(profile, rawText, fileName, clean(basics.name));
}

function truncateCvText(value: string, limit = 28000) {
  const text = normalizeResumeText(value);
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n\n[CV truncated for model context]`;
}

export function repairResumeProfileAfterParsing(profile: ResumeProfile, rawText: string, fileName = ""): ResumeProfile {
  return repairProfileIdentity(profile, rawText, fileName, profile.basics?.name || "");
}

export async function parseResumeWithAiStructure(input: ParseInput): Promise<WorkZoAiCvParserResult> {
  const rawText = normalizeResumeText(input.layoutText || input.cvText || "");
  const localFallback = repairResumeProfileAfterParsing(extractResumeProfileComplex(rawText), rawText, input.fileName || "");

  if (!rawText.trim()) return { ok: false, source: "empty", resumeProfile: localFallback, error: "No CV text provided." };
  if (!process.env.OPENROUTER_API_KEY) {
    return { ok: false, source: "local_fallback_no_api_key", resumeProfile: localFallback, error: "OPENROUTER_API_KEY is missing." };
  }

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://workzoai.com",
        "X-Title": "WorkZo AI",
      },
    });

    const model = process.env.WORKZO_CV_AI_MODEL || "google/gemini-2.5-flash";
    const response = await client.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: 5000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You are a professional CV parser for WorkZo AI.",
            "Return ONLY valid JSON. Do not write markdown.",
            "Extract facts exactly from the CV. Do not invent anything.",
            "",
            "CRITICAL — basics.name MUST be a real human person's full name (first + last).",
            "NEVER put any of the following in basics.name:",
            "  - Skills or tools: Python, SQL, Tableau, Matplotlib, Seaborn, TensorFlow, LangChain, RAG, GCP, etc.",
            "  - Section headers: Profile Summary, Work Experience, Skills, Education, Contact, Languages, Projects, etc.",
            "  - German section headers: Fähigkeiten, Berufserfahrung, Ausbildung, Kontakt, Sprachen, Profilübersicht, etc.",
            "  - Job titles: Marketing Manager, Data Analyst, IT Support Specialist, Software Engineer, etc.",
            "basics.email must be a valid email address only. If the extracted email field contains a phone number concatenated with the email (e.g. '+123-456-7890hello@reallygreatsite.com'), strip everything before the @ sign's local part and return only the clean email address (e.g. 'hello@reallygreatsite.com').",
            "  - Companies, universities, schools, bootcamps, or institutions.",
            "  - Soft skills: Leadership, Teamwork, Communication, Public Relations, Critical Thinking, Time Management.",
            "  - Abbreviations, tool categories, or programming language lists.",
            "",
            "COMMON MISTAKES to avoid:",
            "  WRONG: basics.name = 'Matplotlib Seaborn Tableau' (these are data viz tools, not a name)",
            "  WRONG: basics.name = 'Public Relations Teamwork' (these are skills)",
            "  WRONG: basics.name = 'Programming Python Bash PowerShell' (skill category + tools)",
            "  WRONG: basics.name = 'Tools Ticketing-Systeme Remote Support' (CV skill section text)",
            "  WRONG: basics.name = 'Profile Summary Work Experience' (CV section headers)",
            "  WRONG: basics.name = 'Valley Heights Community Preschool' (employer name)",
            "  WRONG: basics.name = 'Financial Accountant' (job title, not a name)",
            "  WRONG: basics.name = 'Senior Accountant' (job title, not a name)",
            "  WRONG: basics.name = 'Jede Stadt' (German placeholder meaning Any City — address, not a name)",
            "  WRONG: basics.name = 'Arowwai Industries' (company name, not a person)",
            "  CORRECT: basics.name = 'Haritha Vijayakumar' (real person name)",
            "  CORRECT: basics.name = 'Daniel Foster' (real person name)",
            "",
            "HOW TO FIND THE REAL NAME:",
            "  1. Look for a standalone line near the top that contains only a person's first and last name.",
            "  2. It is often in ALL CAPS, Title Case, or spaced letters (H A R I T H A V I J A Y A K U M A R).",
            "  3. It usually appears immediately above or below the job title/headline.",
            "  4. In two-column CVs, the name is typically in the header or sidebar at the TOP — not in the skills or experience section.",
            "  5. If you cannot confidently identify a human name, set basics.name to empty string — do NOT guess.",
            "",
            "If the name is split across lines around a job title, combine person-name tokens only: FIRST / ROLE / LAST => FIRST LAST.",
            "Keep bullets factual. Split bullets only when the source clearly separates responsibilities.",
            "JSON shape: { basics:{name,headline,email,phone,location,linkedin}, summary, experience:[{title,company,location,dates,bullets:[]}], education:[{degree,institution,location,dates}], skills:[], projects:[{name,bullets:[]}], languages:[], certifications:[], strengths:[], additionalEvidence:[], warnings:[] }",
          ].join("\n"),
        },
        {
          role: "user",
          content: `File name: ${input.fileName || "uploaded CV"}\nTarget role: ${input.targetRole || ""}\nTarget market: ${input.targetMarket || ""}\nLanguage: ${input.language || ""}\n\nCV TEXT:\n${truncateCvText(rawText)}`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content || "";
    const parsed = extractJsonObject(content);
    if (!parsed) {
      return { ok: false, source: "local_fallback_invalid_ai_json", resumeProfile: localFallback, error: "AI returned invalid JSON." };
    }

    const aiProfile = buildProfileFromAi(parsed, localFallback, rawText, input.fileName || "");
    return { ok: true, source: "ai_structured_cv", resumeProfile: aiProfile, error: "" };
  } catch (error) {
    return {
      ok: false,
      source: "local_fallback_ai_error",
      resumeProfile: localFallback,
      error: error instanceof Error ? error.message : "AI CV parser failed.",
    };
  }
}
