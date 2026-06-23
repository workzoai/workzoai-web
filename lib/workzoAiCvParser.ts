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
  candidateName?: string;
  knownHeadline?: string;
  jobDescription?: string;
  targetRole?: string;
  targetMarket?: string;
  language?: string;
};



// Global CV text pre-normalizer.
// It repairs common PDF extraction artifacts before either the AI parser or
// local fallback sees the text. This is layout-agnostic: it normalizes section
// headings and spaced-letter headings for any candidate, role, country, or CV
// template without relying on sample-specific names.
export function normalizeCvTextForParsing(value: string): string {
  const raw = normalizeResumeText(value || '').replace(/\r/g, '\n');
  if (!raw.trim()) return '';

  const sectionMap: Array<[RegExp, string]> = [
    [/^(profile|profile summary|professional summary|summary|about me|overview|profil|profilübersicht|profilubersicht|berufliches profil)$/i, 'SUMMARY'],
    [/^(work experience|professional experience|employment history|experience|experiences|career history|berufserfahrung|praxis)$/i, 'EXPERIENCE'],
    [/^(education|academic history|education and training|bildung|bildungsweg|ausbildung|studium)$/i, 'EDUCATION'],
    [/^(skills|key skills|technical skills|core competencies|competencies|expertise|fähigkeiten|fahigkeiten|kenntnisse|kompetenzen)$/i, 'SKILLS'],
    [/^(projects|project experience|selected projects|personal projects|academic projects|portfolio projects|bootcamp projects|data science projects|case studies|selected work|portfolio|projekte)$/i, 'PROJECTS'],
    [/^(languages|language|sprachen|sprachkenntnisse)$/i, 'LANGUAGES'],
    [/^(certifications|certificates|licenses|licences|zertifikate|zertifizierungen|awards and certification)$/i, 'CERTIFICATIONS'],
    [/^(contact|contacts|kontakt|contact details|personal details)$/i, 'CONTACT'],
  ];

  function compactDecorative(line: string): string {
    const trimmed = line.replace(/^[•\-*\s]+/, '').replace(/\s+/g, ' ').trim();
    if (!trimmed) return '';
    const tokens = trimmed.split(/\s+/).filter(Boolean);
    if (tokens.length >= 3 && tokens.every((t) => /^\p{L}$/u.test(t))) {
      return tokens.join('');
    }
    return trimmed;
  }

  const lines = raw.split(/\n+/).map((line) => {
    const compact = compactDecorative(line);
    const upperKey = compact.replace(/[^\p{L}]+/gu, '').toUpperCase();
    const spacedSection: Record<string, string> = {
      PROFILESUMMARY: 'SUMMARY', PROFESSIONALSUMMARY: 'SUMMARY', SUMMARY: 'SUMMARY', PROFILE: 'SUMMARY', ABOUTME: 'SUMMARY',
      WORKEXPERIENCE: 'EXPERIENCE', PROFESSIONALEXPERIENCE: 'EXPERIENCE', EXPERIENCE: 'EXPERIENCE', EXPERIENCES: 'EXPERIENCE', BERUFSERFAHRUNG: 'EXPERIENCE',
      EDUCATION: 'EDUCATION', ACADEMICHISTORY: 'EDUCATION', BILDUNG: 'EDUCATION', BILDUNGSWEG: 'EDUCATION', AUSBILDUNG: 'EDUCATION',
      SKILLS: 'SKILLS', KEYSKILLS: 'SKILLS', TECHNICALSKILLS: 'SKILLS', CORECOMPETENCIES: 'SKILLS', EXPERTISE: 'SKILLS', FAHIGKEITEN: 'SKILLS', FÄHIGKEITEN: 'SKILLS', KENNTNISSE: 'SKILLS',
      PROJECTS: 'PROJECTS', PROJECT: 'PROJECTS', PERSONALPROJECTS: 'PROJECTS', ACADEMICPROJECTS: 'PROJECTS', PORTFOLIOPROJECTS: 'PROJECTS', BOOTCAMPPROJECTS: 'PROJECTS', DATASCIENCEPROJECTS: 'PROJECTS', CASESTUDIES: 'PROJECTS', PORTFOLIO: 'PROJECTS', PROJEKTE: 'PROJECTS',
      LANGUAGES: 'LANGUAGES', LANGUAGE: 'LANGUAGES', SPRACHEN: 'LANGUAGES', SPRACHKENNTNISSE: 'LANGUAGES',
      CERTIFICATIONS: 'CERTIFICATIONS', CERTIFICATES: 'CERTIFICATIONS', LICENSES: 'CERTIFICATIONS', LICENCES: 'CERTIFICATIONS', ZERTIFIKATE: 'CERTIFICATIONS',
      CONTACT: 'CONTACT', CONTACTS: 'CONTACT', KONTAKT: 'CONTACT',
    };
    if (spacedSection[upperKey]) return spacedSection[upperKey];
    for (const [re, label] of sectionMap) if (re.test(compact)) return label;
    return compact;
  });

  // Put a newline before canonical section labels when PDF extraction glued
  // them to neighboring text. This makes downstream section windows reliable.
  return lines
    .join('\n')
    .replace(/\s*(SUMMARY|EXPERIENCE|EDUCATION|SKILLS|PROJECTS|LANGUAGES|CERTIFICATIONS|CONTACT)\s*/g, '\n$1\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

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

// ── Deduplicate skills ──────────────────────────────────────────────────────
// Removes entries that are clearly duplicates differing only in casing or
// minor punctuation (e.g. "Microsoft Excel" vs "Excel", "Sklearn" vs "sklearn").
function deduplicateSkills(skills: string[]): string[] {
  // Step 1: exact key dedup (case/punctuation-insensitive)
  const seen = new Map<string, string>();
  for (const skill of skills) {
    const key = skill.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!seen.has(key)) seen.set(key, skill);
  }
  const deduped = Array.from(seen.values());

  // Step 2: remove skills that are a strict word-level suffix of a longer skill.
  // e.g. "Excel" is redundant when "Microsoft Excel" is already in the list.
  // This is structural (word boundary), not a hardcoded list of product names.
  return deduped.filter((skill) => {
    const lc = skill.toLowerCase();
    return !deduped.some((other) => {
      if (other === skill) return false;
      const olc = other.toLowerCase();
      if (olc.length <= lc.length) return false;
      // skill must appear as whole trailing words in other (word-boundary check)
      return olc.endsWith(lc) && olc[olc.length - lc.length - 1] === " ";
    });
  });
}

const SECTION_HEADER_RE = /^(contact|contacts|kontakt|kontaktdaten|skills|summary of skills|summary|overview|profile|profil|about me|objective|work experience|professional experience|experience|employment history|berufserfahrung|werdegang|education|education and training|training|bildungsweg|bildung|ausbildung|projects|projekte|certifications|zertifikate|awards|awards received|auszeichnungen|languages|sprachen|interests|references|referenzen)$/i;

const CONTACT_RE = /@|www\.|http|linkedin|github|phone|mobile|email|e-mail|address|adresse|street|straße|strasse|road|avenue|\+?\d[\d\s()./-]{5,}/i;

const ROLE_WORD_RE = /^(project|product|program|programme|portfolio|it|ux|ui|software|data|business|marketing|sales|account|customer|success|support|technical|system|systems|network|cloud|frontend|backend|fullstack|devops|hr|finance|operations|office|resource|enterprise|planning|erp|manager|engineer|developer|designer|analyst|specialist|consultant|coordinator|administrator|assistant|assistent|director|lead|head|chief|officer|executive|intern|trainee|teacher|nurse|doctor|architect|owner|founder|recruiter|representative|technician|scientist|researcher|writer|editor|planner|leiter|leitung|entwickler|berater|praktikant)$/i;

const ROLE_OR_HEADLINE_RE = /\b(project|product|program|programme|portfolio|it|ux|ui|software|data|business|marketing|sales|account|customer|success|support|technical|system|systems|network|cloud|frontend|backend|full[ -]?stack|devops|hr|finance|operations|resource|enterprise|planning|erp|manager|engineer|developer|designer|analyst|specialist|consultant|coordinator|administrator|assistant|assistent|director|lead|head|chief|officer|executive|intern|trainee|teacher|nurse|doctor|architect|recruiter|technician|scientist|researcher|planner|leiter|entwickler|berater)\b/i;

const NON_NAME_PHRASE_RE = /\b(project management|cost planning|cost planning and analysis|enterprise resource planning|resource planning|software development|process improvement|personal and team training|machine learning|data visualization|data visualisation|data engineering|generative ai|associate(?:\s+degree)?|bachelor(?:\s+of|\s+degree)?|master(?:\s+of|\s+degree)?|computer science|software development|university|college|diploma|certificate|certification|public relations|time management|teamwork|leadership|critical thinking|effective communication|summary of skills|work experience|education and training|programm\s*\d+|client acquisition|b2b sales|relationship management|market analysis|problem solving|presentation skills|market research|graphic design|motion design|layout design|brand management|crisis communication|event planning|social media management|media relations|content creation|agile methodology|scrum methodology|stakeholder management|cross.functional|cloud security|threat detection|threat hunting|soc operations|penetration testing|vulnerability management|incident response)\b/i;

const NEVER_A_NAME_WORD_RE = /^(matplotlib|seaborn|tableau|tensorflow|sklearn|scikit|langchain|langkette|pytorch|numpy|pandas|keras|pyspark|hadoop|spark|airflow|dbt|looker|powerbi|power|bash|powershell|shell|linux|ubuntu|debian|redhat|android|ios|swift|kotlin|flutter|react|angular|vue|django|flask|fastapi|nodejs|express|spring|docker|kubernetes|helm|terraform|ansible|jenkins|gitlab|github|bitbucket|jira|confluence|slack|salesforce|hubspot|zendesk|servicenow|splunk|wireshark|nessus|crowdstrike|siem|soar|iam|soc|devops|javascript|typescript|java|golang|ruby|rust|scala|perl|php|ticketing|systeme|remote|netzwerke|betriebssysteme|programmierung|datenanalyse|weiterbildung|kontakt|fähigkeiten|fahigkeiten|berufserfahrung|ausbildung|bildungsweg|sprachen|profil|profilu|ubersicht|kenntnisse|lebenslauf|bewerbung|programm|programme|programs|relations|teamwork|leadership|communication|thinking|management|planning|analysis|engineering|visualization|visualisation|integration|scraping|generation|retrieval|augmented|generative|bootcamp|certification|intern|freelance|volunteer|candidate|profilesummary|workexperience|agile|scrum|photography|negotiation|networking|coordination|collaboration|accounting|auditing)$/i;

const ORG_OR_INSTITUTION_RE = /\b(gmbh|ug|ag|kg|ohg|ltd|limited|llc|inc|corp|corporation|company|companies|group|holding|holdings|services|solutions|systems|technologies|technology|tech|software|digital|media|productions?|studio|studios|agency|agencies|partners|consulting|consultants|ventures|labs?|university|universität|universitaet|college|school|schule|hochschule|institute|institut|center|centre|academy|akademie|bootcamp|campus|faculty|department)\b/i;

const DEGREE_OR_EDU_RE = /\b(bachelor|master|mba|msc|ma|ba|bsc|phd|degree|diploma|certificate|certification|arts|science|engineering|management|marketing|grade|thesis|abschluss|studium|ausbildung)\b/i;

// GLOBAL FIX: structural address detection instead of enumerating countries/cities.
// Postal code + word, or "Word, Word" comma pattern covers any address worldwide.
// Country/city name lists were removed — they missed most of the world.
const ADDRESS_WORD_RE = /\b(street|straße|strasse|str\.?|road|rd\.?|avenue|ave\.?|platz|gasse|allee|ring|drive|dr\.?|lane|ln\.?|city|town|village|anywhere|rue|via|calle|rua|weg|steig|damm|pfad|ufer)\b/i;
const ADDRESS_STRUCTURE_RE = /\b\d{4,6}\b[,.\s]{1,4}\p{Lu}[\p{Ll}À-ÿ]+|\b\p{Lu}[\p{Ll}À-ÿ]+[,.\s]{1,4}\d{4,6}\b|\b\p{Lu}[\p{Ll}À-ÿ]{2,},\s*\p{Lu}[\p{Ll}À-ÿ]{2,}\b/u;
const ADDRESS_OR_LOCATION_RE = { test(value: string) { return ADDRESS_WORD_RE.test(value) || ADDRESS_STRUCTURE_RE.test(value); } };

const YEAR_OR_DATE_RE = /\b(?:19|20)\d{2}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b|\b(heute|present|current)\b/i;

// Collapse a sequence of single-letter tokens separated by spaces into a word.
// e.g. "S u p p o r t" → "Support"
// Returns null if the segment doesn't match the spaced-letter pattern.
function collapseSpacedLetterSegment(segment: string): string | null {
  const chars = segment.split(" ").filter(Boolean);
  if (chars.length < 2) return null;
  if (!chars.every((c) => /^\p{L}$/u.test(c))) return null;
  return chars.join("");
}

// Collapse a dash-separated sequence of spaced-letter words.
// e.g. "I T - S u p p o r t - S p e z i a l i s t" → "IT-Support-Spezialist"
function collapseSpacedLetterGroup(group: string): string {
  const parts = group.split(" - ");
  const processed = parts.map((part) => collapseSpacedLetterSegment(part.trim()) ?? part.trim());
  const anyChanged = processed.some((p, i) => p !== parts[i]?.trim());
  if (!anyChanged) return group.trim();
  return processed.filter(Boolean).join("-");
}

function compactDecorativeLine(line: string): string {
  // Strip bullet characters but DO NOT normalize whitespace yet —
  // multi-space boundaries (2+ spaces) are the only signal for where
  // words end in decorative spaced-letter headlines like:
  // "I T - S u p p o r t   /   T e c h n i s c h e r   S u p p o r t - I n g e n i e u r"
  // Collapsing spaces first (the previous bug) merged "Technischer" and
  // "Support" into one token, producing "TechnischerSupport".
  const stripped = line.replace(/[•●▪◦]/g, " ").replace(/\t/g, " ").trim();

  // Case 1: All-caps spaced section headers "S K I L L S" → "SKILLS"
  const allTokens = stripped.split(/\s+/).filter(Boolean);
  if (allTokens.length >= 4 && allTokens.every((t) => /^[A-ZÄÖÜ]$/u.test(t))) {
    const compact = allTokens.join("");
    const sectionMap: Record<string, string> = {
      CONTACTS: "CONTACTS", CONTACT: "CONTACT", KONTAKT: "KONTAKT",
      SKILLS: "SKILLS", SUMMARY: "SUMMARY", OVERVIEW: "OVERVIEW",
      PROFILE: "PROFILE", PROFIL: "PROFIL", WORKEXPERIENCE: "WORK EXPERIENCE",
      BERUFSERFAHRUNG: "BERUFSERFAHRUNG", EDUCATION: "EDUCATION",
      BILDUNGSWEG: "BILDUNGSWEG", BILDUNG: "BILDUNG", PROJECTS: "PROJECTS",
      LANGUAGES: "LANGUAGES", SPRACHEN: "SPRACHEN", CERTIFICATIONS: "CERTIFICATIONS",
      PROFILÜBERSICHT: "PROFILÜBERSICHT", FÄHIGKEITEN: "FÄHIGKEITEN",
    };
    if (sectionMap[compact]) return sectionMap[compact];

    // A long all-caps compact that isn't a section keyword is likely a person's
    // full name run together (e.g. "HARITHAVIJAYAKUMAR" from spaced letters).
    // Try splitting near the midpoint so extractBestCandidateName can recognise
    // a two-word name. Only attempt for lengths typical of two-part names (8–35).
    // Guard: skip anything that looks like a single English word (section header
    // that wasn't in the map, or a single-word company name).
    if (compact.length >= 8 && compact.length <= 35) {
      const mid = Math.round(compact.length / 2);
      // Try the midpoint and up to 4 positions either side
      for (let offset = 0; offset <= Math.min(4, mid - 4); offset++) {
        for (const pos of offset === 0 ? [mid] : [mid - offset, mid + offset]) {
          if (pos >= 4 && pos <= compact.length - 4) {
            const first = compact.slice(0, pos);
            const second = compact.slice(pos);
            // Both halves must be plausible name tokens: 3+ chars, no digits,
            // and neither half should itself be a common section word.
            const firstOk = first.length >= 3 && !/^(SKILLS|CONTACT|PROFILE|SUMMARY|EDUCATION|EXPERIENCE|LANGUAGE|PROJECT|AWARD|INTEREST|REFERENCE|ABOUT|WORK|BILDUNG|SPRACHEN|KONTAKT|FÄHIG|BERUF|AUSBILDUNG)$/.test(first);
            const secondOk = second.length >= 3 && !/^(SKILLS|CONTACT|PROFILE|SUMMARY|EDUCATION|EXPERIENCE|LANGUAGE|PROJECT|AWARD|INTEREST|REFERENCE|ABOUT|WORK|BILDUNG|SPRACHEN|KONTAKT|FÄHIG|BERUF|AUSBILDUNG)$/.test(second);
            if (firstOk && secondOk) {
              return `${first} ${second}`;
            }
          }
        }
      }
    }
    return compact;
  }

  // Case 2: Decorative spaced-letter headings (mixed case, dashes, slashes).
  // Split on 2+ consecutive spaces first — these are WORD GROUP boundaries.
  // Single spaces within a group separate individual letters.
  // e.g. "I T - S u p p o r t - S p e z i a l i s t   /   T e c h n i s c h e r   S u p p o r t - I n g e n i e u r"
  //       ←────────────── group 1 ─────────────────→ ↑/↑ ←── group 2 ──→ ↑  ↑ ←──── group 3 ────────────→
  const wordGroups = stripped.split(/\s{2,}/);

  if (wordGroups.length >= 2) {
    const processed = wordGroups.map((group) => collapseSpacedLetterGroup(group));
    const anyChanged = processed.some((p, i) => p !== wordGroups[i]?.trim());
    if (anyChanged) {
      return processed.filter(Boolean).join(" ");
    }
  }

  // Single group — still try to collapse if it has spaced-letter content
  if (wordGroups.length === 1) {
    const result = collapseSpacedLetterGroup(stripped);
    if (result !== stripped.trim()) return result;
  }

  return stripped.replace(/\s+/g, " ").trim();
}

function prepareLines(rawText: string) {
  return String(rawText || "")
    .split(/\n+/)
    .map(compactDecorativeLine)
    // Normalize whitespace AFTER compactDecorativeLine, not before
    .map((line) => line.replace(/\s+/g, " ").trim())
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
  if (/\b(associate'?s?\s+degree|bachelor'?s?\s+degree|master'?s?\s+degree|bachelor\s+of|master\s+of|b\.?sc|m\.?sc|b\.?a|m\.?a|ph\.?d|diploma|certificate|certification|university|college|school|hochschule|computer\s+science|software\s+development)\b/i.test(raw)) return "";

  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 5) return "";

  for (const part of parts) {
    if (part.length < 2 || part.length > 25) return "";
    if (!/^[\p{L}]/u.test(part)) return "";
    if (ROLE_WORD_RE.test(normalizeForCompare(part))) return "";
    // Conjunctions and prepositions never appear mid-name as the sole word.
    // "Testing And Debugging", "Coordination And Communication" etc. are skill
    // category headers, not human names. Real names with particles ("de", "van",
    // "von", "da", "di") are caught separately by isTitleCaseOrCaps.
    if (/^(and|or|the|of|for|in|at|to|und|et|y|e|por|per|sur)$/i.test(part)) return "";
  }

  if (parts.every(p => NEVER_A_NAME_WORD_RE.test(p))) return "";
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

type CandidateName = { name: string; index: number; score: number };

function addCandidate(candidates: CandidateName[], rawName: string, index: number, score: number, excluded?: Set<string>) {
  const name = isLikelyHumanName(rawName);
  if (!name) return;
  if (excluded && excluded.has(normalizeForCompare(name))) return;
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
    // Reject strings starting with a 4-digit year (e.g. "2022 123")
    if (/^(?:19|20)\d{2}\b/.test(value)) continue;
    // Reject street number + postal code patterns: "71 00126"
    if (/^\d{1,3}\s+\d{4,6}(-\s*.+)?$/.test(value)) continue;
    // Reject year ranges
    if (/^(?:19|20)\d{2}\s*[-–—]\s*(?:19|20)\d{2}/.test(value)) continue;
    if (/^[\d\s\-–—]+$/.test(value) && /\b(?:19|20)\d{2}\b.*\b(?:19|20)\d{2}\b/.test(value)) continue;
    if (!/[+()]|\d{2,}[\s.-]\d{2,}/.test(value)) continue;
    return value;
  }
  return "";
}

function isValidPhone(value: string): boolean {
  if (!value) return false;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 16) return false;
  if (/^(?:19|20)\d{2}\b/.test(value.trim())) return false;
  if (/^\d{1,3}\s+\d{4,6}$/.test(value.trim())) return false;
  return true;
}

// ── Email extraction with concatenation cleanup ────────────────────────────
// Handles PDFs that merge adjacent columns: "+123-456-7890hello@example.com"
// → "hello@example.com"
function extractEmail(rawText: string) {
  const compact = rawText.replace(/([A-Z0-9._%+-]+)\s*\n\s*@\s*([A-Z0-9.-]+\.[A-Z]{2,})/gi, "$1@$2");
  const match = compact.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (!match) return "";
  // Strip leading non-email garbage (phone number merged before @-part)
  const raw = match[0];
  const atIdx = raw.indexOf("@");
  const localPart = raw.slice(0, atIdx);
  const domain = raw.slice(atIdx);
  // If local part contains non-email characters (digits + separators suggesting phone), strip up to last alpha run
  const cleanLocal = localPart.replace(/^[^a-z]*/i, "").replace(/[^a-z0-9._%+\-]/gi, "");
  return cleanLocal + domain;
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

export function extractBestCandidateName(rawText: string, fileName = "", modelName = "", excludeAsName: string[] = []) {
  const lines = prepareLines(rawText).slice(0, 220);
  const candidates: CandidateName[] = [];
  // BUG FIXED, GENERAL CASE: a skill phrase or company name that happens to
  // sit near the top of the raw extracted text (a PDF column-reordering
  // artifact, not a real layout choice) could out-score the actual name —
  // confirmed from live testing with "Critical Thinking" (a skill) and
  // "Aldenaire Partners" (a company from the experience section), each
  // independently extracted elsewhere in the SAME profile. Rather than
  // denylisting those specific phrases (which doesn't generalize to the
  // next CV), this cross-checks against whatever the rest of the parse
  // already extracted as skills/companies — a file-agnostic signal that
  // works for any CV, not just these two.
  const excluded = new Set(excludeAsName.map((value) => normalizeForCompare(value)).filter(Boolean));

  lines.forEach((line, index) => {
    const cleanedLine = line
      .replace(/^[•\-*]\s*/, "")
      .replace(/^(candidate\s*name|name|applicant)\s*[:\-]\s*/i, "")
      .trim();

    addCandidate(candidates, cleanedLine, index, scoreNameCandidate(cleanedLine, index, lines, fileName), excluded);

    const first = isLikelySingleNameToken(cleanedLine);
    const next = isLikelySingleNameToken(lines[index + 1] || "");
    if (first && next) {
      addCandidate(candidates, `${first} ${next}`, index, 54 + Math.max(0, 20 - index), excluded);
    }

    const afterRole = isLikelySingleNameToken(lines[index + 2] || "");
    const between = lines[index + 1] || "";
    if (first && afterRole && ROLE_OR_HEADLINE_RE.test(between) && !isLikelyHumanName(between)) {
      addCandidate(candidates, `${first} ${afterRole}`, index, 62 + Math.max(0, 20 - index), excluded);
    }

    const capsName = cleanedLine.match(/\b([A-ZÀ-ÝÄÖÜ]{2,}(?:\s+[A-ZÀ-ÝÄÖÜ]{2,}){1,4})\b/u)?.[1];
    if (capsName && capsName !== cleanedLine) {
      addCandidate(candidates, capsName, index, 40 + Math.max(0, 15 - index), excluded);
    }
  });

  const fileCandidate = extractNameFromFileName(fileName);
  if (fileCandidate && !excluded.has(normalizeForCompare(fileCandidate))) candidates.push({ name: fileCandidate, index: 998, score: 18 });

  const emailCandidate = extractNameFromEmail(rawText);
  if (emailCandidate && !excluded.has(normalizeForCompare(emailCandidate))) candidates.push({ name: emailCandidate, index: 997, score: 14 });

  // AI model name is weakest — a company name on Canva CVs must never outrank text candidates
  const modelCandidate = isLikelyHumanName(modelName);
  if (modelCandidate && !excluded.has(normalizeForCompare(modelCandidate))) candidates.push({ name: modelCandidate, index: 999, score: 2 });

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

// ── Sort education by start year descending ────────────────────────────────
// Normalises non-deterministic AI ordering; most-recent first is standard CV order.
function sortEducationByDate(items: ResumeEducation[]): ResumeEducation[] {
  return [...items].sort((a, b) => {
    const yearA = String(a.dates || "").match(/\b(19|20)\d{2}\b/)?.[0];
    const yearB = String(b.dates || "").match(/\b(19|20)\d{2}\b/)?.[0];
    if (!yearA && !yearB) return 0;
    if (!yearA) return 1;
    if (!yearB) return -1;
    return Number(yearB) - Number(yearA);
  });
}

function coerceEducation(items: unknown): ResumeEducation[] {
  if (!Array.isArray(items)) return [];
  const parsed = items
    .filter((item): item is AiResumeEducation => Boolean(item && typeof item === "object"))
    .map((item) => {
      const degree = clean(item.degree);
      const institution = clean(item.institution);
      const location = clean(item.location);
      const dates = clean(item.dates);
      // When the AI puts the institution name in the degree field too
      const cleanedDegree =
        degree && institution && degree.toLowerCase() === institution.toLowerCase() ? "" : degree;
      // Reject degree values that are clearly sentences (summary/profile text bled
      // into the wrong field) — real degree names are short phrases, not sentences.
      // Heuristic: >80 chars AND contains common sentence words is a sentence, not a degree.
      const isSentence =
        cleanedDegree.length > 80 &&
        /\b(with|who|and|for|to|in|of|the|a|an|has|have|been|is|was|are|were|recognised|committed|dedicated|seasoned|team|leader)\b/i.test(cleanedDegree);
      return { degree: isSentence ? "" : cleanedDegree, institution, location, dates };
    })
    .filter((item) => {
      if (!item.institution) return false;
      if (item.degree) {
        if (item.degree.length > 120) return false;
        if (/^(a |an |the |i am |i'm )/i.test(item.degree)) return false;
        if ((item.degree.match(/,/g) || []).length > 2) return false;
        // Reject degree values that are clearly job titles rather than qualifications.
        // A real degree always contains an academic keyword OR is short and has no role word.
        // e.g. "Senior Accountant" → role word present, no academic keyword → rejected.
        const hasAcademic = /\b(bachelor|master|mba|msc|phd|b\.?sc|m\.?sc|b\.?a|m\.?a|degree|diploma|certificate|bootcamp|programme|program|course|training|associate|foundation|doctoral|doctor|licence|license|abitur|gymnasium|hochschule|fachhochschule|ingenieur|bac\b|baccalaur)/i.test(item.degree);
        const hasRoleWord = /\b(accountant|engineer|manager|analyst|designer|developer|specialist|consultant|coordinator|assistant|officer|executive|director|architect|technician|scientist|intern|recruiter|teacher|nurse|doctor|therapist|officer|planner|researcher)\b/i.test(item.degree);
        if (hasRoleWord && !hasAcademic) return false;
      }
      return true;
    })
    .slice(0, 8);
  return sortEducationByDate(parsed);
}

function coerceProjects(items: unknown): ResumeProject[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item): item is AiResumeProject => Boolean(item && typeof item === "object"))
    .map((item) => ({ name: clean(item.name) || "Project", bullets: unique(asList(item.bullets), 6) }))
    .filter((item) => item.name || item.bullets.length)
    .slice(0, 8);
}


function cleanProjectName(value: string): string {
  const name = clean(value)
    .replace(/^[•\-*\d.)\s]+/, "")
    .replace(/\s*[|:–—-]\s*(python|sql|tableau|power\s*bi|excel|pandas|numpy|sklearn|tensorflow|gcp|aws|azure|react|next\.js|node|api|machine learning|nlp|rag).*$/i, "")
    .trim();
  if (!name || name.length < 3 || name.length > 90) return "";
  if (SECTION_HEADER_RE.test(name)) return "";
  if (CONTACT_RE.test(name) || YEAR_OR_DATE_RE.test(name)) return "";
  if (/^(project|personal project|academic project|portfolio project)$/i.test(name)) return "";
  return name;
}

function extractProjectsFromRawText(rawText: string): ResumeProject[] {
  const lines = prepareLines(rawText);
  const projects: ResumeProject[] = [];
  const projectHeaderRe = /^(projects?|projekte|project experience|selected projects?|key projects?|personal projects?|academic projects?|portfolio projects?|bootcamp projects?|data science projects?|case studies|selected work|portfolio)$/i;
  const stopRe = /^(experience|professional experience|work experience|employment history|berufserfahrung|education|bildung|bildungsweg|ausbildung|skills|fähigkeiten|fahigkeiten|competencies|languages|sprachen|certifications|zertifikate|contact|kontakt|summary|profile|profil|about me|references|referenzen)$/i;

  for (let i = 0; i < lines.length; i++) {
    if (!projectHeaderRe.test(lines[i])) continue;
    let current: ResumeProject | null = null;
    for (let j = i + 1; j < Math.min(lines.length, i + 70); j++) {
      const line = lines[j];
      if (stopRe.test(line)) break;
      if (!line || CONTACT_RE.test(line)) continue;
      const bulletLike = /^[•\-*]/.test(line) || /^\d+[.)]/.test(line);
      const hasProjectSignal = /\b(project|dashboard|pipeline|analysis|analytics|classifier|model|prediction|forecast|scraper|crawler|sentiment|recommendation|clustering|segmentation|visualization|visualisation|app|platform|portfolio|case study|study|nlp|rag|machine learning|data science|ai)\b/i.test(line);
      const hasTechSignal = /\b(python|sql|pandas|numpy|tableau|power\s*bi|excel|sklearn|tensorflow|matplotlib|seaborn|gcp|aws|azure|api|web scraping|nlp|rag|langchain|react|next\.js|node)\b/i.test(line);

      if (!bulletLike && (hasProjectSignal || hasTechSignal || /^[A-ZÀ-ÝÄÖÜ][\p{L}0-9 &+/#().-]{3,80}$/u.test(line))) {
        const name = cleanProjectName(line);
        if (name) {
          if (current) projects.push(current);
          current = { name, bullets: [] };
        }
        continue;
      }

      if (current && (bulletLike || line.length > 25)) {
        const bullet = clean(line.replace(/^[•\-*\d.)\s]+/, ""));
        if (bullet && bullet.length > 10) current.bullets = unique([...(current.bullets || []), bullet], 6);
      }
    }
    if (current) projects.push(current);
    if (projects.length) break;
  }

  return unique(projects.map((p) => p.name), 8)
    .map((name) => projects.find((p) => p.name === name)!)
    .filter(Boolean)
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

// ── Email cleanup helper ───────────────────────────────────────────────────
// Handles "+123-456-7890hello@example.com" → "hello@example.com" in any field
function cleanEmailField(value: unknown): string {
  const raw = clean(value);
  if (!raw) return "";
  const match = raw.match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/);
  if (!match) return raw;
  return match[0].toLowerCase();
}

function repairProfileIdentity(profile: ResumeProfile, rawText: string, fileName = "", modelName = ""): ResumeProfile {
  // General, file-agnostic exclusion set: anything already independently
  // extracted as a skill or as a company name cannot also be accepted as
  // the candidate's own name. A real person's name essentially never
  // duplicates one of their own listed skills or a former employer's name.
  const excludeAsName = [
    ...(Array.isArray(profile.skills) ? profile.skills : []),
    ...(Array.isArray(profile.experience) ? profile.experience.map((item) => item?.company).filter((value): value is string => Boolean(value)) : []),
  ];

  const lockedName = extractBestCandidateName(rawText, fileName, "", excludeAsName);
  const fallbackName = extractBestCandidateName(rawText, fileName, modelName || profile.basics?.name || "", excludeAsName);
  const name = lockedName || fallbackName || "";

  const email = cleanEmailField(extractEmail(rawText) || profile.basics?.email);
  const phone = extractPhone(rawText) || clean(profile.basics?.phone);
  const linkedin = cleanLinkedinUrl(extractLinkedin(rawText) || clean(profile.basics?.linkedin));

  // Symmetric to the name fix above: the candidate's own resolved name
  // should never also appear as one of their listed skills — confirmed
  // from live testing (a candidate name appearing in its own skills array).
  // General check, not a specific-name denylist: works for any candidate.
  const nameNormalized = normalizeForCompare(name);
  const skills = Array.isArray(profile.skills)
    ? profile.skills.filter((skill) => normalizeForCompare(skill) !== nameNormalized)
    : profile.skills;

  return {
    ...profile,
    rawText,
    skills,
    basics: {
      ...profile.basics,
      name,
      email,
      phone,
      linkedin,
    },
  } as ResumeProfile;
}

// ── Brand name normalization for AI-extracted skills ─────────────────────────
// The AI sometimes outputs compound brand names with incorrect spacing
// (e.g. "Solid Works", "Crowd Strike", "Power Shell"). This corrects them
// using the same logic as the local parser's normalizeSkillToken, without
// importing the full parser module.
function normalizeAiSkillToken(value: string): string {
  return value
    .replace(/\bSolid\s+Works\b/gi, "SolidWorks")
    .replace(/\bCrowd\s+Strike\b/gi, "CrowdStrike")
    .replace(/\bPower\s+Shell\b/gi, "PowerShell")
    .replace(/\bGit\s+Hub\b/gi, "GitHub")
    .replace(/\bGit\s+Lab\b/gi, "GitLab")
    .replace(/\bDev\s+Ops\b/gi, "DevOps")
    .replace(/\bOpen\s+AI\b/gi, "OpenAI")
    .replace(/\bJava\s+Script\b/gi, "JavaScript")
    .replace(/\bType\s+Script\b/gi, "TypeScript")
    .replace(/\bLang\s+Chain\b/gi, "LangChain")
    .replace(/\bTensor\s+Flow\b/gi, "TensorFlow")
    .replace(/\bMy\s+SQL\b/gi, "MySQL")
    .replace(/\bNum\s+Py\b/gi, "NumPy")
    .replace(/\bPower\s+BI\b/gi, "Power BI")
    .trim();
}

function cleanLinkedinUrl(value: string): string {
  if (!value) return "";
  // Extract the linkedin.com/in/username portion.
  // LinkedIn usernames: letters, numbers, hyphens only; typically ≤35 chars.
  // PDF line-merging appends the next line's first word directly to the URL
  // (e.g. "linkedin.com/in/harithavijayakumar30Programming" — "Programming" is the
  // next line). We detect contamination by finding a camelCase boundary after a run
  // of lowercase-then-digits, or by capping at 35 chars.
  const match = value.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([A-Za-z0-9-]{1,50})\/?/i);
  if (!match) return "";
  const username = match[1];
  // Truncate at the first camelCase boundary that follows at least 5 characters:
  // "harithavijayakumar30Programming" → stop at "P" after "30"
  const clean = username.replace(/^([a-zA-Z0-9-]{5,35}?)([A-Z][a-z]{2,}).*$/, "$1");
  if (!clean) return "";
  const base = value.slice(0, value.indexOf(match[1])) + clean;
  return base.endsWith("/") ? base : base;
}

// Rejoin German gendered role suffix wrongly split by spaced-caps parsing.
// "MARKETING MANAGER IN" → "MARKETING MANAGERIN"
// The spaced-caps line "M A R K E T I N G M A N A G E R I N" gets compacted and
// the AI splits the feminine suffix "-in" as a separate word " IN".
function cleanHeadline(value: string): string {
  if (!value) return value;

  // The AI sometimes outputs the raw spaced-letter headline as-is:
  // "I T - S u p p o r t - S p e z i a l i s t / T e c h n i s c h e r S u p p o r t - I n g e n i e u r"
  // Run the same collapse logic that prepareLines uses on input, now on the AI output.
  const stripped = value.trim();

  // Detect: does this look like a spaced-letter headline?
  // Pattern: mostly single letters with spaces between them, possibly dashes and slashes
  const tokens = stripped.split(/\s+/).filter(Boolean);
  const singleLetterCount = tokens.filter((t) => /^[\p{L}\-\/]$/u.test(t)).length;
  if (singleLetterCount >= tokens.length * 0.6) {
    // Split on 2+ spaces first (word-group boundary), or treat whole thing as one group
    const wordGroups = stripped.split(/\s{2,}/);

    function collapseGroup(group: string): string {
      // Split on dash or slash separators within the group
      const parts = group.split(/ [-\/|] /);
      const separators = [...group.matchAll(/ ([-\/|]) /g)].map((m) => m[1]);
      const processed = parts.map((part) => {
        const chars = part.trim().split(/\s+/).filter(Boolean);
        // All single letters? Collapse — detect word boundaries by capital restarts
        if (chars.length >= 2 && chars.every((c) => /^[\p{L}]$/u.test(c))) {
          // Group consecutive letters into words: new word starts when a capital
          // follows a lowercase (e.g. "T e c h n i s c h e r S u p p o r t" → ["Technischer", "Support"])
          const words: string[] = [];
          let current = chars[0];
          for (let i = 1; i < chars.length; i++) {
            const prev = chars[i - 1];
            const ch = chars[i];
            // Start a new word if: prev is lowercase AND current is uppercase
            if (/\p{Ll}/u.test(prev) && /\p{Lu}/u.test(ch)) {
              words.push(current);
              current = ch;
            } else {
              current += ch;
            }
          }
          words.push(current);
          return words.join(" ");
        }
        return part.trim();
      });
      return processed.reduce((acc, part, i) => {
        if (i === 0) return part;
        const sep = separators[i - 1] || "-";
        if (sep === "/") return `${acc} / ${part}`;
        if (sep === "|") return `${acc} | ${part}`;
        return `${acc}-${part}`;
      }, "");
    }

    const collapsed = wordGroups.map((g) => {
      if (g.trim() === "/" || g.trim() === "|") return g.trim();
      return collapseGroup(g);
    }).join(" ");

    if (collapsed !== stripped) {
      return collapsed
        .replace(/\b(manager|engineer|developer|designer|analyst|specialist|consultant|coordinator|director|officer|architect|recruiter|leiter|ingenieur|techniker|assistent|spezialist)\s+IN\b/gi,
          (_, role) => role === role.toUpperCase() ? `${role}IN` : `${role}in`)
        .replace(/\s{2,}/g, " ")
        .trim();
    }
  }

  return stripped
    .replace(/\b(manager|engineer|developer|designer|analyst|specialist|consultant|coordinator|director|officer|architect|recruiter|leiter|ingenieur|techniker|assistent|spezialist)\s+IN\b/gi,
      (_, role) => role === role.toUpperCase() ? `${role}IN` : `${role}in`)
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildProfileFromAi(ai: AiResumeJson, fallback: ResumeProfile, rawText: string, fileName = "", knownHeadline = ""): ResumeProfile {
  const basics = ai.basics && typeof ai.basics === "object" ? ai.basics : {};
  const experience = coerceExperience(ai.experience);
  const education = coerceEducation(ai.education);
  const aiProjects = coerceProjects(ai.projects);
  const rawProjects = extractProjectsFromRawText(rawText);
  const projects = aiProjects.length ? aiProjects : rawProjects;

  const aiName = clean(basics.name).toLowerCase();
  const rawSkills = unique(asList(ai.skills), 40)
    .filter((s) => {
      const trimmed = s.trim();
      if (!trimmed) return false;
      // Reject if it's the candidate's own name
      if (aiName && trimmed.toLowerCase() === aiName) return false;
      // Reject bare role words or multi-word role-title phrases
      if (ROLE_WORD_RE.test(trimmed)) return false;
      const words = trimmed.split(/\s+/);
      if (words.length <= 3 && words.some((w) => ROLE_WORD_RE.test(w))) return false;
      // Reject overly long entries (sentences, not skills)
      if (s.length > 80) return false;
      return true;
    })
    .map((s) => {
      // Split "Category: Skill" → "Skill" (e.g. "3D CAD Tools: CREO" → "CREO")
      const colonIdx = s.indexOf(":");
      if (colonIdx > 0 && colonIdx < 30) return s.slice(colonIdx + 1).trim();
      return s;
    })
    .filter(Boolean)
    .map((s) => normalizeAiSkillToken(s));
  const skills = deduplicateSkills(rawSkills);

  const languages = unique(asList(ai.languages), 12);
  const certifications = unique(asList(ai.certifications), 12);

  const profile = {
    ...fallback,
    rawText,
    basics: {
      // When the AI returns an empty name (it was told to do this when unsure),
      // fall back to the deterministic parser's name rather than leaving it blank.
      // The deterministic parser correctly finds spaced-caps names (e.g. "HARITHA
      // VIJAYAKUMAR") even in sidebar-first PDFs where the AI gets confused.
      name: clean(basics.name) || fallback.basics?.name || "",
      headline: cleanHeadline(clean(basics.headline) || experience[0]?.title || fallback.basics?.headline || knownHeadline || ""),
      // Clean email immediately at construction — never let a concatenated email through
      email: cleanEmailField(clean(basics.email) || fallback.basics?.email || extractEmail(rawText)),
      // Validate AI phone — if it looks like a postal code, year, or date, discard and extract from raw text
      phone: (() => {
        const aiPhone = clean(basics.phone);
        if (aiPhone && isValidPhone(aiPhone)) return aiPhone;
        return fallback.basics?.phone || extractPhone(rawText) || "";
      })(),
      location: (() => {
        const loc = clean(basics.location) || fallback.basics?.location || "";
        // Reject location values that are clearly education entries or date strings
        // that bled into the wrong field (e.g. "Borcelle University | 2026-2030")
        if (/university|college|school|hochschule|universit[äé]|bootcamp/i.test(loc) && /\d{4}/.test(loc)) return "";
        if (/\b(?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2}/.test(loc) && !/\b(st|ave|str|road|weg|platz)\b/i.test(loc)) return "";
        return loc;
      })(),
      linkedin: cleanLinkedinUrl(clean(basics.linkedin) || fallback.basics?.linkedin || ""),
    },
    summary: clean(ai.summary) || fallback.summary || "",
    experience: experience.length ? experience : fallback.experience || [],
    education: education.length ? education : sortEducationByDate(fallback.education || []),
    skills: skills.length ? skills : deduplicateSkills(fallback.skills || []),
    projects: projects.length ? projects : (rawProjects.length ? rawProjects : fallback.projects || []),
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
  const text = normalizeCvTextForParsing(value);
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n\n[CV truncated for model context]`;
}



function sanitizeParsedProfileFields(profile: ResumeProfile, rawText: string, fileName = ''): ResumeProfile {
  const fallback = extractResumeProfileComplex(rawText);
  const experience = Array.isArray(profile.experience) ? profile.experience : [];
  const education = Array.isArray(profile.education) ? profile.education : [];
  const projects = Array.isArray(profile.projects) && profile.projects.length ? profile.projects : extractProjectsFromRawText(rawText);

  const headlineRaw = clean(profile.basics?.headline || '');
  const headlineLooksLikeSentence = headlineRaw.length > 150 || (headlineRaw.split(/\s+/).length > 14 && /\b(with|and|for|to|that|which|after|before|because|while|where|using|leading|improving|supporting|managing|developing|creating|providing)\b/i.test(headlineRaw));
  const headlineLooksLikeBullet = /^(led|managed|assisted|supported|coordinated|created|developed|implemented|improved|provided|responsible|collaborated|conducted)\b/i.test(headlineRaw) && headlineRaw.length > 60;
  const safeHeadline = headlineLooksLikeSentence || headlineLooksLikeBullet
    ? clean(experience[0]?.title || fallback.basics?.headline || 'Professional')
    : headlineRaw;

  const cleanedSkills = deduplicateSkills((Array.isArray(profile.skills) ? profile.skills : [])
    .filter((skill) => clean(skill).length <= 60)
    .filter((skill) => normalizeForCompare(skill) !== normalizeForCompare(profile.basics?.name || ""))
    .filter((skill) => !/^(summary|experience|education|projects|skills|languages|contact)$/i.test(clean(skill)))
  );

  return {
    ...profile,
    experience,
    education,
    projects,
    skills: cleanedSkills.length ? cleanedSkills : deduplicateSkills(fallback.skills || []),
    basics: {
      ...profile.basics,
      headline: safeHeadline || 'Professional',
    },
  } as ResumeProfile;
}

export function repairResumeProfileAfterParsing(profile: ResumeProfile, rawText: string, fileName = ""): ResumeProfile {
  const repaired = repairProfileIdentity(profile, rawText, fileName, profile.basics?.name || "");
  return sanitizeParsedProfileFields(repaired, rawText, fileName);
}

// Note: parse-result caching has been intentionally removed.
// A module-level Map shared across concurrent server requests caused cross-user
// data contamination: when two different CVs were processed simultaneously,
// one request could serve the cached result from the other user's CV.
// Confirmed from live testing: concurrent CV uploads could expose a stale profile
// from another request when parse results were cached at module level.
// The cost of an extra AI call per /api/cv/structure is acceptable compared to
// the risk of serving wrong CV data across users.

export async function parseResumeWithAiStructure(input: ParseInput): Promise<WorkZoAiCvParserResult> {
  const rawText = normalizeCvTextForParsing(input.layoutText || input.cvText || "");
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
            "  - Companies, universities, schools, bootcamps, or institutions.",
            "  - Soft skills: Leadership, Teamwork, Communication, Public Relations, Critical Thinking, Time Management.",
            "  - Abbreviations, tool categories, or programming language lists.",
            "",
            "basics.email MUST be a valid email address (user@domain.tld).",
            "Some PDF extractors concatenate adjacent columns into a single string, e.g. '+123-456-7890user@example.com'.",
            "In this case strip everything before the email local part and return only the clean email: 'user@example.com'.",
            "Never put a phone number or any other text in the email field.",
            "",
            "COMMON NAME MISTAKES to avoid:",
            "  WRONG: basics.name = 'Matplotlib Seaborn Tableau' (data viz tools, not a name)",
            "  WRONG: basics.name = 'Public Relations Teamwork' (skills)",
            "  WRONG: basics.name = 'Programming Python Bash PowerShell' (skill category + tools)",
            "  WRONG: basics.name = 'Tools Ticketing-Systeme Remote Support' (CV section text)",
            "  WRONG: basics.name = 'Profile Summary Work Experience' (CV section headers)",
            "  WRONG: basics.name = 'Springfield Elementary School' (employer name)",
            "  WRONG: basics.name = 'Acme Corp Ltd' (company name, not a person)",
            "  WRONG: basics.name = 'Educationkey Skills' (concatenated section headers)",
            "  WRONG: basics.name = 'Critical Thinking' (soft skill, not a name)",
            "  WRONG: basics.name = 'Effective Communication' (soft skill phrase)",
            "  WRONG: basics.name = 'Marketing Manager' (job title, not a name)",
            "  WRONG: basics.name = 'Any City' (placeholder address text, not a name)",
            "  CORRECT: basics.name = 'Maria Schmidt' (real person name)",
            "  CORRECT: basics.name = 'James Okafor' (real person name)",
            "  CORRECT: basics.name = 'Elena Vasquez' (real person name)",
            "  CORRECT: basics.name = 'Thomas Müller' (real person name)",
            "",
            "HOW TO FIND THE REAL NAME:",
            "  1. Look for a standalone line near the top that contains only a person's first and last name.",
            "  2. It is often in ALL CAPS, Title Case, or spaced letters (H A R I T H A V I J A Y A K U M A R).",
            "  3. It usually appears immediately above or below the job title/headline.",
            "  4. In two-column CVs the name is typically in the header or sidebar at the TOP.",
            "  5. If you cannot confidently identify a human name, set basics.name to empty string — do NOT guess.",
            "",
            "SPACED-LETTER DECORATIVE TEXT:",
            "  Many PDF CV templates render text with individual letters separated by spaces for visual effect.",
            "  e.g. 'I T - S u p p o r t - S p e z i a l i s t   /   T e c h n i s c h e r   S u p p o r t - I n g e n i e u r'",
            "  This should be read as: 'IT-Support-Spezialist / Technischer Support-Ingenieur'",
            "  Rule: collapse runs of single letters separated by spaces into their intended words.",
            "  Single spaces between letters = one word. Larger gaps (2+ spaces, or a slash) = word/section boundaries.",
            "  Another example: 'H A R I T H A   V I J A Y A K U M A R' = 'HARITHA VIJAYAKUMAR' (two words separated by larger gap).",
            "  'W I L S O N' with tight single spaces = 'WILSON' (one word, likely last name).",
            "",
            "PROJECT EXTRACTION RULES:",
            "  Projects may appear under PROJECTS, PERSONAL PROJECTS, ACADEMIC PROJECTS, BOOTCAMP PROJECTS, DATA SCIENCE PROJECTS, SELECTED PROJECTS, PORTFOLIO, or CASE STUDIES.",
            "  Never drop projects if a project section exists.",
            "  Extract every project name and its technologies/results as bullets.",
            "  If uncertain whether an item is a project or extra experience, keep it in projects rather than dropping it.",
            "  Do not invent projects. Only use text found in the CV.",
            "",
            "EDUCATION ordering: sort education entries by start date DESCENDING (most recent first).",
            "EDUCATION fields: 'degree' is the QUALIFICATION NAME (e.g. 'Bachelor of Science', 'Master of Arts in Marketing', 'Data Science Bootcamp'). 'institution' is the SCHOOL/UNIVERSITY NAME. NEVER put the school name in the degree field. If only a school name appears without an explicit degree title, set degree to empty string and only fill institution.",
            "LOCATION field: must be a physical address, city, or country. NEVER put education entries, university names, dates, or date ranges in the location field.",
            "SKILLS deduplication: remove duplicate skills that differ only in casing (e.g. 'Python' and 'python').",
            "",
            "PROJECT EXTRACTION RULES — never drop projects when the CV contains them.",
            "Projects may appear under: PROJECTS, PERSONAL PROJECTS, BOOTCAMP PROJECTS, DATA SCIENCE PROJECTS, ACADEMIC PROJECTS, PORTFOLIO PROJECTS, CASE STUDIES, PROJECT EXPERIENCE, or as named portfolio items after education/bootcamp.",
            "For each project, extract the project name and factual bullets. Preserve technologies, datasets, APIs, cloud tools, dashboards, ML/NLP/RAG terms, outcomes, and links if visible.",
            "If a project is mixed into a bootcamp or portfolio section, still put it in projects — do NOT convert it into work experience, education, or skills.",
            "If uncertain whether an item is a project or a skill, prefer returning it as a project with a short bullet rather than dropping it.",
            "Never hallucinate projects. Only use names or descriptions visible in the CV text.",
            "",
            "If the name is split across lines around a job title, combine person-name tokens only: FIRST / ROLE / LAST => FIRST LAST.",
            "Keep bullets factual. Split bullets only when the source clearly separates responsibilities.",
            "JSON shape: { basics:{name,headline,email,phone,location,linkedin}, summary, experience:[{title,company,location,dates,bullets:[]}], education:[{degree,institution,location,dates}], skills:[], projects:[{name,bullets:[]}], languages:[], certifications:[], strengths:[], additionalEvidence:[], warnings:[] }",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            `File name: ${input.fileName || "uploaded CV"}`,
            `Target role: ${input.targetRole || ""}`,
            `Target market: ${input.targetMarket || ""}`,
            `Language: ${input.language || ""}`,
            // If we already know the correct name (from a prior parse or filename),
            // tell the AI explicitly so it doesn't pick a skill/phrase instead.
            ...(input.candidateName ? [`Known candidate name (use this): ${input.candidateName}`] : []),
            "",
            `CV TEXT:\n${truncateCvText(rawText)}`,
          ].join("\n"),
        },
      ],
    });

    const content = response.choices[0]?.message?.content || "";
    const parsed = extractJsonObject(content);
    if (!parsed) {
      return { ok: false, source: "local_fallback_invalid_ai_json", resumeProfile: localFallback, error: "AI returned invalid JSON." };
    }

    const aiProfile = buildProfileFromAi(parsed, localFallback, rawText, input.fileName || "", input.knownHeadline || "");
    const result: WorkZoAiCvParserResult = { ok: true, source: "ai_structured_cv", resumeProfile: aiProfile, error: "" };

    return result;
  } catch (error) {
    // Log the actual error so it appears in server logs — critical for debugging
    console.error("[WorkZo CV Pipeline] parseResumeWithAiStructure.ai_error", {
      errorMessage: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      fileName: input.fileName,
      rawTextLength: rawText.length,
    });
    return {
      ok: false,
      source: "local_fallback_ai_error",
      resumeProfile: localFallback,
      error: error instanceof Error ? error.message : "AI CV parser failed.",
    };
  }
}
