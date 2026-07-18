import OpenAI from "openai";
import {
  extractResumeProfileComplex,
  normalizeResumeText,
  type ResumeEducation,
  type ResumeExperience,
  type ResumeProfile,
  type ResumeProject,
} from "@/lib/workzoResumeParser";
import { resolveTargetHeadline } from "@/lib/workzoCvIdentityEngine";
import { canonicalizeResumeProfileIntegrity } from "@/lib/workzoCvCanonicalIntegrity";
import { resolveAuthoritativeCvName } from "@/lib/workzoCvNameStage";

export type WorkZoCvParserSource =
  | "ai_structured_cv"
  | "local_fallback_no_api_key"
  | "local_fallback_invalid_ai_json"
  | "local_fallback_ai_error"
  | "empty";

type AiResumeExperience = { title?: unknown; company?: unknown; location?: unknown; dates?: unknown; bullets?: unknown };
type AiResumeEducation = { degree?: unknown; institution?: unknown; location?: unknown; dates?: unknown };
type AiResumeProject = { name?: unknown; bullets?: unknown };

export type AiResumeJson = {
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
// Country/city name lists were removed, they missed most of the world.
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
  // Strip bullet characters but DO NOT normalize whitespace yet -
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
    // full name run together (e.g. "JOHNSMITH" from spaced letters).
    // Try splitting near the midpoint so extractBestCandidateName can recognise
    // a two-word name. Only attempt for lengths typical of two-part names (8-35).
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
  // Split on 2+ consecutive spaces first, these are WORD GROUP boundaries.
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

  // Single group, still try to collapse if it has spaced-letter content
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
  // artifact, not a real layout choice) could out-score the actual name -
  // confirmed from live testing with "Critical Thinking" (a skill) and
  // "Aldenaire Partners" (a company from the experience section), each
  // independently extracted elsewhere in the SAME profile. Rather than
  // denylisting those specific phrases (which doesn't generalize to the
  // next CV), this cross-checks against whatever the rest of the parse
  // already extracted as skills/companies, a file-agnostic signal that
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

  // AI model name is weakest, a company name on Canva CVs must never outrank text candidates
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
      // into the wrong field), real degree names are short phrases, not sentences.
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
  const validated = parsed.map((item) => {
    // Detect AI-hallucinated same-year ranges for multi-year programs
    // e.g. "2014 - 2014" for a Master's degree (confirmed from live logs: Surender_Resume.pdf
    // produced "2014 - 2014" for a joint degree between two universities).
    // These occur when the AI sees a split/exchange program and guesses based on one year only.
    const dates = item.dates || "";
    const yearMatches = dates.match(/\b(19|20)\d{2}\b/g);
    if (yearMatches && yearMatches.length >= 2) {
      const years = yearMatches.map(Number);
      const startYear = Math.min(...years);
      const endYear = Math.max(...years);
      if (startYear === endYear) {
        const degreeText = (item.degree + " " + item.institution).toLowerCase();
        const isMultiYear = /\b(master|mba|msc|bachelor|bsc|phd|diploma|degree|bootcamp|programme|program)\b/i.test(degreeText);
        if (isMultiYear) {
          // Keep the entry but flag the dates as unverified, better than dropping the degree
          // Keep only the year we can trust. Previously this wrote an internal
          // QA note into the rendered `dates` field, so it printed on the user's
          // exported CV. Never leak internal flags into user-facing output.
          return { ...item, dates: String(startYear), datesUnverified: true };
        }
      }
    }
    return item;
  });

  return sortEducationByDate(validated);
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



type RawLineInfo = { raw: string; text: string; indent: number; index: number };

const HEADLINE_WORDS = [
  "principal", "professional", "specialist", "consultant", "coordinator", "administrator",
  "representative", "technician", "scientist", "researcher", "developer", "designer", "engineer",
  "analyst", "manager", "director", "executive", "assistant", "associate", "intern", "trainee",
  "customer", "success", "support", "technical", "software", "systems", "system", "network",
  "product", "project", "program", "programme", "portfolio", "business", "marketing", "sales",
  "account", "operations", "finance", "financial", "human", "resources", "resource", "data",
  "science", "machine", "learning", "cloud", "security", "cybersecurity", "quality", "service",
  "experience", "user", "interface", "frontend", "backend", "fullstack", "full", "stack", "senior",
  "junior", "lead", "head", "chief", "officer", "it", "ux", "ui", "hr", "ai", "and"
].sort((a, b) => b.length - a.length);

function segmentJoinedHeadline(value: string): string {
  const compact = value.toLowerCase().replace(/[^a-z]/g, "");
  if (!compact || compact.length < 5) return value;
  const memo = new Map<number, string[] | null>();
  const walk = (index: number): string[] | null => {
    if (index === compact.length) return [];
    if (memo.has(index)) return memo.get(index)!;
    for (const word of HEADLINE_WORDS) {
      if (!compact.startsWith(word, index)) continue;
      const tail = walk(index + word.length);
      if (tail) { const result = [word, ...tail]; memo.set(index, result); return result; }
    }
    memo.set(index, null);
    return null;
  };
  const words = walk(0);
  if (!words || words.length < 2) return value;
  return words.map((word) => word === "it" || word === "ui" || word === "ux" || word === "hr" || word === "ai"
    ? word.toUpperCase()
    : word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function normalizeDecorativeText(value: string): string {
  const original = String(value || "").replace(/[\t\u00a0]+/g, " ").trim();
  if (!original) return "";

  // Treat slash, pipe, ampersand and hyphen as word-group separators while
  // deciding whether this is decorative letter spacing. Older logic required
  // every token to be a single letter, so a perfectly valid headline such as
  // "I T S U P P O R T / D A T A A N A L Y S T" was skipped because of "/".
  const normalizedSeparators = original.replace(/\s*([/|&])\s*/g, "  $1  ");
  const groups = normalizedSeparators.split(/\s{2,}/).map((g) => g.trim()).filter(Boolean);
  const rebuilt: string[] = [];
  let sawDecorativeLetters = false;

  for (const group of groups) {
    if (/^[/|&]$/.test(group)) {
      rebuilt.push(group);
      continue;
    }
    const tokens = group.split(/\s+/).filter(Boolean);
    const letterTokens = tokens.filter((token) => /^\p{L}$/u.test(token));
    if (tokens.length >= 3 && letterTokens.length / tokens.length >= 0.8) {
      sawDecorativeLetters = true;
      const joined = tokens.filter((token) => /^\p{L}$/u.test(token)).join("");
      rebuilt.push(segmentJoinedHeadline(joined));
    } else {
      rebuilt.push(group.replace(/\s+/g, " "));
    }
  }

  if (sawDecorativeLetters) {
    return rebuilt
      .join(" ")
      .replace(/\s+([/|&])\s+/g, " $1 ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }
  return original.replace(/\s+/g, " ");
}

function rawLineInfo(rawText: string): RawLineInfo[] {
  return String(rawText || "")
    .replace(/\r/g, "\n")
    .split(/\n/)
    .map((raw, index) => {
      const leading = raw.match(/^[ \t]*/)?.[0] || "";
      return {
        raw,
        text: normalizeDecorativeText(raw),
        indent: leading.replace(/\t/g, "    ").length,
        index,
      };
    })
    .filter((line) => Boolean(line.text));
}

const GLOBAL_SECTION_RE = /^(contact|contacts|kontakt|profile|profile summary|professional summary|summary|about me|overview|skills|key skills|technical skills|core skills|expertise|experience|work experience|professional experience|employment history|berufserfahrung|education|academic history|bildung|bildungsweg|ausbildung|projects?|selected projects?|project experience|personal projects?|academic projects?|portfolio projects?|bootcamp projects?|data science projects?|case studies|selected work|portfolio|projekte|languages?|sprachen|sprachkenntnisse|certifications?|certificates?|licenses?|licences?|zertifikate|references?|referenzen)$/i;

const ACADEMIC_LINE_RE = /\b(bachelor|master|mba|msc|phd|b\.?sc|m\.?sc|degree|diploma|certificate|bootcamp|university|college|school|hochschule|ausbildung)\b/i;

const SENTENCE_START_RE = /^(achieved|analyzed|analysed|assisted|automated|built|collaborated|collected|conducted|configured|coordinated|created|delivered|designed|developed|implemented|improved|increased|led|managed|maintained|optimized|optimised|presented|provided|reduced|resolved|showcased|supported|trained|troubleshot|utilized|used|visualized|visualised|worked)\b/i;

function isRoleLikeLine(value: string): boolean {
  const text = clean(value);
  if (!text || text.length < 3 || text.length > 110) return false;
  if (GLOBAL_SECTION_RE.test(text) || CONTACT_RE.test(text) || YEAR_OR_DATE_RE.test(text)) return false;
  if (/[.!?]$/.test(text) || SENTENCE_START_RE.test(text)) return false;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 14) return false;
  return ROLE_OR_HEADLINE_RE.test(text);
}

function extractHeaderHeadlineFromRawText(rawText: string, candidateName = ""): string {
  const lines = rawLineInfo(rawText).slice(0, 36);
  if (!lines.length) return "";
  const sectionIndex = lines.findIndex((line) => GLOBAL_SECTION_RE.test(line.text));
  const header = sectionIndex >= 0 ? lines.slice(0, sectionIndex) : lines.slice(0, 14);
  const candidateKey = normalizeForCompare(candidateName);

  let nameIndex = -1;
  for (let i = 0; i < header.length; i++) {
    const key = normalizeForCompare(header[i].text);
    if (candidateKey && key === candidateKey) { nameIndex = i; break; }
  }

  // The line directly below the verified candidate name is the strongest
  // layout signal and must win over sidebar skills such as "Project Management".
  // Inspect only the next three non-contact lines before considering any broader
  // header fallback. This works across names, roles, languages and templates.
  if (nameIndex >= 0) {
    let inspected = 0;
    for (let i = nameIndex + 1; i < header.length && inspected < 3; i++) {
      const text = clean(header[i].text);
      if (!text || CONTACT_RE.test(text) || GLOBAL_SECTION_RE.test(text)) continue;
      inspected += 1;
      if (isRoleLikeLine(text)) return cleanHeadline(text);
    }
  }

  // If the candidate name was not recovered from the text, only consider the
  // first few header lines. Never scan the whole pre-section block because
  // multi-column extraction may place sidebar skills there.
  for (const line of header.slice(0, 6)) {
    const text = clean(line.text);
    if (!text || CONTACT_RE.test(text) || GLOBAL_SECTION_RE.test(text)) continue;
    if (candidateKey && normalizeForCompare(text) === candidateKey) continue;
    if (isRoleLikeLine(text)) return cleanHeadline(text);
  }
  return "";
}

function extractProjectsFromRawTextRobust(rawText: string): ResumeProject[] {
  const lines = rawLineInfo(rawText);
  const projectHeaderRe = /^(projects?|selected projects?|project experience|key projects?|personal projects?|academic projects?|portfolio projects?|bootcamp projects?|data science projects?|case studies|selected work|portfolio|projekte)$/i;
  const stopRe = /^(experience|professional experience|work experience|employment history|berufserfahrung|education|academic history|bildung|bildungsweg|ausbildung|skills|key skills|technical skills|core skills|expertise|languages?|sprachen|sprachkenntnisse|certifications?|certificates?|zertifikate|contact|kontakt|summary|profile|professional summary|about me|references?|referenzen)$/i;
  const start = lines.findIndex((line) => projectHeaderRe.test(line.text));
  if (start < 0) return [];

  const section: RawLineInfo[] = [];
  for (let i = start + 1; i < lines.length && section.length < 100; i++) {
    if (stopRe.test(lines[i].text)) break;
    section.push(lines[i]);
  }
  if (!section.length) return [];

  const projects: ResumeProject[] = [];
  let current: ResumeProject | null = null;
  const flush = () => {
    if (!current) return;
    current.bullets = unique(current.bullets || [], 10);
    if (current.name && (current.bullets.length || current.name !== "Selected Project")) projects.push(current);
    current = null;
  };

  for (const line of section) {
    const text = clean(line.text.replace(/^[•●▪◦\-*]+\s*/, ""));
    if (!text || CONTACT_RE.test(text) || GLOBAL_SECTION_RE.test(text)) continue;
    const markerBullet = /^[ \t]*[•●▪◦\-*]/.test(line.raw) || /^\d+[.)]\s+/.test(line.text);
    const sentenceLike = markerBullet || SENTENCE_START_RE.test(text) || text.split(/\s+/).length >= 11 || /[.!?]$/.test(text);

    // Project names are short noun phrases. They are usually less indented than
    // their bullets, but the semantic checks also support flattened extraction.
    const titleCandidate = cleanProjectName(text);
    const titleLike = Boolean(titleCandidate)
      && !sentenceLike
      && !ROLE_OR_HEADLINE_RE.test(text)
      && !ACADEMIC_LINE_RE.test(text)
      && !YEAR_OR_DATE_RE.test(text)
      && text.split(/\s+/).length <= 12;

    if (titleLike) {
      flush();
      current = { name: titleCandidate, bullets: [] };
      continue;
    }

    if (!current) {
      // Do not fabricate a project title from a bullet. Wait for a real title.
      continue;
    }
    if (sentenceLike && text.length >= 12) current.bullets.push(text);
  }
  flush();
  return projects.slice(0, 12);
}

function extractExperienceIdentityFromRawText(rawText: string): ResumeExperience[] {
  const lines = rawLineInfo(rawText);
  const experienceHeaderRe = /^(experience|professional experience|work experience|employment history|career history|berufserfahrung|praxis)$/i;
  const stopRe = /^(education|academic history|bildung|bildungsweg|ausbildung|projects?|projekte|skills|expertise|languages?|sprachen|certifications?|contact|summary|profile|references?)$/i;
  const start = lines.findIndex((line) => experienceHeaderRe.test(line.text));
  const scoped = start >= 0 ? lines.slice(start + 1) : lines;
  const section: RawLineInfo[] = [];
  for (const line of scoped) {
    if (start >= 0 && stopRe.test(line.text)) break;
    section.push(line);
    if (section.length >= 140) break;
  }

  const result: ResumeExperience[] = [];
  for (let i = 0; i < section.length; i++) {
    const line = section[i].text;
    const dateMatch = line.match(/\b(?:19|20)\d{2}\b(?:\s*[-–—]\s*(?:present|current|today|heute|(?:19|20)\d{2}))?/i);
    if (!dateMatch) continue;
    const dates = clean(dateMatch[0]);
    const beforeDate = clean(line.replace(dateMatch[0], "").replace(/[|·,;:\-–—]+$/g, ""));
    const pipeParts = beforeDate.split(/\s*[|·]\s*/).map(clean).filter(Boolean);
    const inlineTitle = pipeParts.length >= 2 && isRoleLikeLine(pipeParts[0]) ? pipeParts[0] : "";
    const company = pipeParts.length >= 2 ? pipeParts[pipeParts.length - 1] : beforeDate;
    if (!company || company.length > 80 || SENTENCE_START_RE.test(company) || ACADEMIC_LINE_RE.test(company)) continue;

    const adjacent = [section[i + 1]?.text, section[i - 1]?.text, section[i + 2]?.text, section[i - 2]?.text]
      .filter((value): value is string => Boolean(value));
    const title = inlineTitle || adjacent.find((value) => isRoleLikeLine(value)) || "";
    if (!title) continue;
    result.push({ title: clean(title), company, location: "", dates, bullets: [] });
  }
  return result.slice(0, 12);
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


// ── Structural skill/job-title discriminator (module level) ─────────────
// CLASS A, terminal title nouns: words that END a job title and are never
//   standalone skills by themselves. "Engineer" or "Manager" alone means nothing
//   as a skill. These filter a skill only when they appear as the LAST word.
//
// CLASS B, domain context words: appear in both titles AND skill names.
//   "Cloud" → "Cloud Engineer" (title) vs "Google Cloud" (platform skill).
//   These must NOT filter a skill on their own, only the full phrase matters.
//
// STRUCTURAL RULE: a skill phrase is a job title (not a skill) when:
//   its last word is a CLASS A title noun
//   AND no word in the phrase is a brand/technology anchor
//   AND the full phrase has no domain-specific suffix that makes it a tool/area
//
// This rule works for any CV, language, role, or domain without a hardcoded list.

// CLASS A: words that are terminal job-title nouns, never standalone skills.
// Safe to filter when the LAST word of a phrase matches this.
const TITLE_NOUN_RE = /^(manager|managerin|engineer|developer|designer|analyst|specialist|consultant|coordinator|administrator|director|lead|head|chief|officer|executive|intern|trainee|architect|scientist|researcher|recruiter|representative|technician|planner|editor|writer|supervisor|superintendent|leiter|leiterin|ingenieur|ingenieurin|entwickler|entwicklerin|berater|beraterin|spezialist|spezialistin|koordinator|koordinatorin|praktikant|praktikantin|wissenschaftler|forscher)$/i;

// CLASS B: domain-context words, appear in both titles AND skill names.
// Do NOT use these alone to filter; context (full phrase) determines meaning.
// Listed here only for documentation, not used in the filter logic.
// cloud, data, technical, system, network, software, business, customer,
// marketing, sales, support, product, it, hr, ux, ui, etc.

// Brand/technology anchors: when any word in a skill phrase matches this,
// the phrase names a specific tool/platform/service, not a job title.
// Pattern: proper-noun product brands that never appear in job titles alone.
const TECH_BRAND_RE = /^(google|microsoft|amazon|apple|salesforce|oracle|sap|ibm|cisco|adobe|atlassian|hubspot|zendesk|servicenow|workday|tableau|splunk|nessus|wireshark|crowdstrike|github|gitlab|bitbucket|jira|confluence|slack|notion|figma|sketch|powerbi|databricks|snowflake|redshift|bigquery|terraform|kubernetes|docker|jenkins|ansible|airflow|spark|hadoop|kafka|elasticsearch|mongodb|postgresql|mysql|redis|azure|aws|gcp|okta|pagerduty|datadog|grafana|prometheus|newrelic|twilio|stripe|shopify|wordpress|react|angular|vue|django|fastapi|spring|dotnet|nodejs|tensorflow|pytorch|scikit|langchain|openai|anthropic|cohere|pinecone|weaviate|mongodb|firebase|supabase|vercel|netlify|heroku|digitalocean|cloudflare|akamai|fastly|sendgrid|mailchimp|marketo|pardot|eloqua|zoho|freshdesk|freshservice|intercom|drift|segment|amplitude|mixpanel|heap|fullstory|hotjar|looker|metabase|dbt|fivetran|airbyte|stitch|matillion|informatica|talend|mulesoft|boomi|zapier|workato|make|n8n|power|sharepoint|teams|zoom|webex|meet)$/i;

// Domain-area suffixes: when the LAST word is one of these (not a CLASS A title noun),
// the phrase names a skill area or discipline, not a job title.
// e.g. "Data Analysis", "Cloud Security", "Network Monitoring", "Technical Support"
const SKILL_AREA_SUFFIX_RE = /^(analysis|analytics|security|monitoring|administration|engineering|architecture|visualization|visualisation|automation|intelligence|testing|assurance|management|operations|development|design|science|computing|infrastructure|integration|optimization|optimisation|implementation|deployment|configuration|troubleshooting|support|maintenance|reporting|planning|strategy|communication|writing|documentation|training|research|governance|compliance|modelling|modeling|processing|pipelines|migration|scaling|performance|reliability|observability|recovery|protection|detection|response|hunting|assessment|auditing|mapping|classification|annotation)$/i;

function isJobTitleNotSkill(skill: string): boolean {
  const words = skill.trim().split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 5) return false;

  // Single word: filter if it IS a CLASS A title noun or a German compound role title
  // e.g. "Engineer" → filtered | "Projektleiter" → filtered | "Python" → kept
  if (words.length === 1) {
    if (TITLE_NOUN_RE.test(words[0])) return true;
    // German compound job titles: "Projektleiter", "Softwareentwickler", "Marketingmanager"
    // These end with a known German title suffix and are long enough to be compounds (8+ chars)
    const GERMAN_TITLE_SUFFIX_RE = /(?:leiter|leiterin|ingenieur|ingenieurin|entwickler|entwicklerin|berater|beraterin|spezialist|spezialistin|koordinator|koordinatorin|praktikant|praktikantin|wissenschaftler|forscher|manager|managerin|analyst|analystin|designer|designerin|architekt|architektin|techniker|technikerin)$/i;
    if (words[0].length >= 8 && GERMAN_TITLE_SUFFIX_RE.test(words[0])) return true;
    return false;
  }

  // Multi-word: check if any word is a brand anchor → definitely a tool/platform
  if (words.some(w => TECH_BRAND_RE.test(w))) return false;

  const lastWord = words[words.length - 1];

  // Last word is a domain-area suffix → this is a skill area, not a job title
  // "Data Analysis", "Cloud Security", "Technical Support", "Network Monitoring"
  if (SKILL_AREA_SUFFIX_RE.test(lastWord)) return false;

  // Last word is a CLASS A title noun → job title phrase
  // "Marketing Manager", "Data Analyst", "Cloud Engineer", "Senior Developer"
  if (TITLE_NOUN_RE.test(lastWord)) return true;

  // All words are domain-context words (no title noun, no area suffix, no brand)
  // e.g. "IT Support" (it=context, support=context → neither CLASS A nor area suffix)
  // These are skill areas, keep them. The LLM puts them there for a reason.
  return false;
}

function repairProfileIdentity(profile: ResumeProfile, rawText: string, fileName = "", modelName = ""): ResumeProfile {
  // MUTATION GUARD: if the profile already has a valid human name, do NOT scan
  // raw text to replace it. Confirmed mutation: "Sophia Martinez" → "Core Competencies"
  // because the section heading scored higher in the raw PDF text order.
  const alreadyValidName = isLikelyHumanName(profile.basics?.name || "");
  if (alreadyValidName) {
    const email = cleanEmailField(extractEmail(rawText) || profile.basics?.email);
    const phone = extractPhone(rawText) || clean(profile.basics?.phone);
    const linkedin = cleanLinkedinUrl(extractLinkedin(rawText) || clean(profile.basics?.linkedin));
    const nameNormalized = normalizeForCompare(alreadyValidName);
    const skills = Array.isArray(profile.skills)
      ? profile.skills.filter((skill) => {
          if (normalizeForCompare(skill) === nameNormalized) return false;
          if (isJobTitleNotSkill(skill)) return false;
          return true;
        })
      : profile.skills;
    return {
      ...profile, rawText, skills,
      basics: { ...profile.basics, name: alreadyValidName, email, phone, linkedin },
    } as ResumeProfile;
  }

  // Name missing or invalid, attempt raw text recovery.
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
  // should never also appear as one of their listed skills, confirmed
  // from live testing (a candidate name appearing in its own skills array).
  // General check, not a specific-name denylist: works for any candidate.
  const nameNormalized = normalizeForCompare(name);
  // Also remove bare role-title phrases that ended up in skills
  // (e.g. "Marketing Manager", "Data Analyst" as skills rather than job titles)
  // using the same isBarePureRoleTitle logic, defined in buildProfileFromAi above.
  // Inline version here since we're outside that function scope:
  const skills = Array.isArray(profile.skills)
    ? profile.skills.filter((skill) => {
        if (normalizeForCompare(skill) === nameNormalized) return false;
        if (isJobTitleNotSkill(skill)) return false;
        return true;
      })
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
  // (e.g. "linkedin.com/in/username123Programming", "Programming" is the
  // next line). We detect contamination by finding a camelCase boundary after a run
  // of lowercase-then-digits, or by capping at 35 chars.
  const match = value.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([A-Za-z0-9-]{1,50})\/?/i);
  if (!match) return "";
  const username = match[1];
  // Truncate at the first camelCase boundary that follows at least 5 characters:
  // "username123Programming" → stop at the capital letter after digits
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
        // All single letters? Collapse, detect word boundaries by capital restarts
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


function normIdentity(value: string): string {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function mergeExperienceIdentity(aiItems: ResumeExperience[], fallbackItems: ResumeExperience[]): ResumeExperience[] {
  // AI-extracted rows are the authoritative ordered timeline. Deterministic
  // fallback rows may fill blank fields, but may never replace, collapse or
  // truncate AI rows. Matching requires exact normalized company + dates, and
  // title when both sides provide one. Unmatched fallback rows are appended so
  // evidence found only by deterministic extraction is not lost.
  const usedFallback = new Set<number>();
  const merged = aiItems.map((ai) => {
    const aiCompany = normIdentity(ai.company || "");
    const aiDates = normIdentity(ai.dates || "");
    const aiTitle = normIdentity(ai.title || "");
    const matchIndex = fallbackItems.findIndex((fallback, index) => {
      if (usedFallback.has(index)) return false;
      const fallbackCompany = normIdentity(fallback.company || "");
      const fallbackDates = normIdentity(fallback.dates || "");
      const fallbackTitle = normIdentity(fallback.title || "");
      if (!aiCompany || !aiDates || aiCompany !== fallbackCompany || aiDates !== fallbackDates) return false;
      return !aiTitle || !fallbackTitle || aiTitle === fallbackTitle;
    });

    if (matchIndex < 0) return { ...ai, bullets: [...(ai.bullets || [])] };
    usedFallback.add(matchIndex);
    const fallback = fallbackItems[matchIndex];
    return {
      ...ai,
      title: ai.title || fallback.title || "",
      company: ai.company || fallback.company || "",
      location: ai.location || fallback.location || "",
      dates: ai.dates || fallback.dates || "",
      bullets: ai.bullets?.length ? [...ai.bullets] : [...(fallback.bullets || [])],
    };
  });

  fallbackItems.forEach((fallback, index) => {
    if (!usedFallback.has(index)) merged.push({ ...fallback, bullets: [...(fallback.bullets || [])] });
  });
  return merged.slice(0, 20);
}

function mergeRawExperienceIdentity(baseItems: ResumeExperience[], rawItems: ResumeExperience[]): ResumeExperience[] {
  if (!rawItems.length) return baseItems.map((item) => ({ ...item, bullets: [...(item.bullets || [])] }));
  if (!baseItems.length) return rawItems.map((item) => ({ ...item, bullets: [...(item.bullets || [])] }));

  const usedRaw = new Set<number>();
  const merged = baseItems.map((base) => {
    const companyKey = normIdentity(base.company || "");
    const datesKey = normIdentity(base.dates || "");
    const titleKey = normIdentity(base.title || "");
    const matchIndex = rawItems.findIndex((raw, index) => {
      if (usedRaw.has(index)) return false;
      const rawCompany = normIdentity(raw.company || "");
      const rawDates = normIdentity(raw.dates || "");
      const rawTitle = normIdentity(raw.title || "");
      if (!companyKey || !datesKey || companyKey !== rawCompany || datesKey !== rawDates) return false;
      return !titleKey || !rawTitle || titleKey === rawTitle;
    });
    if (matchIndex < 0) return { ...base, bullets: [...(base.bullets || [])] };
    usedRaw.add(matchIndex);
    const raw = rawItems[matchIndex];
    return {
      ...base,
      title: base.title || raw.title || "",
      company: base.company || raw.company || "",
      location: base.location || raw.location || "",
      dates: base.dates || raw.dates || "",
      bullets: base.bullets?.length ? [...base.bullets] : [...(raw.bullets || [])],
    };
  });
  rawItems.forEach((raw, index) => {
    if (!usedRaw.has(index)) merged.push({ ...raw, bullets: [...(raw.bullets || [])] });
  });
  return merged.slice(0, 20);
}

function extractLanguagesFromRawText(rawText: string): string[] {
  const normalized = normalizeCvTextForParsing(rawText);
  const lines = normalized.split(/\n+/).map(clean).filter(Boolean);
  const languageHeaderRe = /^(languages?|sprachen|sprachkenntnisse|langues|idiomas|lingue|talen)$/i;
  const stopRe = /^(summary|experience|education|skills|projects|certifications|contact|references)$/i;
  const start = lines.findIndex((line) => languageHeaderRe.test(line));
  const candidates: string[] = [];

  if (start >= 0) {
    for (let i = start + 1; i < Math.min(lines.length, start + 15); i++) {
      const line = lines[i];
      if (stopRe.test(line)) break;
      candidates.push(...line.split(/[,;|]/).map(clean).filter(Boolean));
    }
  }

  // Multi-column PDFs can place language rows far away from the heading. Recover
  // explicit "Language: level" and "Language - level" pairs globally.
  const level = '(?:native|mother tongue|fluent|professional|business|conversational|intermediate|basic|beginner|advanced|proficient|bilingual|a1|a2|b1|b2|c1|c2|muttersprache|fließend|fliessend|verhandlungssicher|fortgeschritten|mittelstufe|grundkenntnisse)';
  const pairRe = new RegExp('\\b([A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ-]{2,20})\\s*(?:[:\\-–|()]|is|:)\\s*(' + level + ')\\b', 'gi');
  for (const match of normalized.matchAll(pairRe)) candidates.push(`${match[1]} - ${match[2]}`);

  const languageNameRe = /^(english|german|deutsch|french|français|spanish|español|italian|italiano|dutch|nederlands|portuguese|português|polish|polski|hindi|tamil|telugu|malayalam|arabic|mandarin|chinese|japanese|korean|russian|ukrainian|turkish|swedish|norwegian|danish|finnish|czech|romanian|hungarian|greek)(?:\s*[-:()]\s*.+)?$/i;
  return unique(candidates
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter((item) => languageNameRe.test(item)), 20);
}


function languageIdentityKey(value: string): string {
  const normalized = normalizeForCompare(value);
  const first = normalized.split(/\s+/)[0] || normalized;
  const aliases: Record<string, string> = {
    deutsch: "german", german: "german", allemand: "german", aleman: "german",
    english: "english", englisch: "english", anglais: "english", ingles: "english",
    french: "french", francais: "french", französisch: "french", franzosisch: "french",
    spanish: "spanish", espanol: "spanish", spanisch: "spanish",
    italian: "italian", italiano: "italian", italienisch: "italian",
    portuguese: "portuguese", portugues: "portuguese", portugiesisch: "portuguese",
    dutch: "dutch", nederlands: "dutch", niederlandisch: "dutch",
    chinese: "chinese", mandarin: "chinese", chinesisch: "chinese",
    japanese: "japanese", japanisch: "japanese",
    arabic: "arabic", arabisch: "arabic",
    russian: "russian", russisch: "russian",
    turkish: "turkish", turkisch: "turkish",
    polish: "polish", polski: "polish", polnisch: "polish",
  };
  return aliases[first] || first;
}

function languageDetailScore(value: string): number {
  const text = clean(value);
  let score = text.length;
  if (/(?:a1|a2|b1|b2|c1|c2)/i.test(text)) score += 30;
  if (/(?:native|mother tongue|fluent|professional|business|conversational|intermediate|basic|beginner|advanced|proficient|bilingual|muttersprache|fließend|fliessend|verhandlungssicher|fortgeschritten|grundkenntnisse)/i.test(text)) score += 20;
  return score;
}

function mergeLanguagesGlobally(...groups: string[][]): string[] {
  const best = new Map<string, string>();
  for (const value of groups.flat()) {
    const cleaned = clean(value);
    if (!cleaned) continue;
    const key = languageIdentityKey(cleaned);
    if (!key) continue;
    const current = best.get(key);
    if (!current || languageDetailScore(cleaned) > languageDetailScore(current)) best.set(key, cleaned);
  }
  return [...best.values()].slice(0, 20);
}

function isContaminatedProjectIdentity(project: ResumeProject, profile: ResumeProfile): boolean {
  const name = cleanProjectName(project?.name || "");
  if (!name) return true;
  const key = normalizeForCompare(name);
  const candidateName = normalizeForCompare(profile.basics?.name || "");
  const headline = normalizeForCompare(profile.basics?.headline || "");
  if ((candidateName && key === candidateName) || (headline && key === headline)) return true;
  if (GLOBAL_SECTION_RE.test(name) || SECTION_HEADER_RE.test(name)) return true;
  const hasProjectSignal = /(project|dashboard|pipeline|analysis|analytics|classifier|model|prediction|forecast|scraper|crawler|sentiment|recommendation|clustering|segmentation|visualization|visualisation|app|platform|portfolio|case study|study|nlp|rag|machine learning|data science|ai|feasibility|prototype|research)/i.test(name);
  const roleOnly = isRoleLikeLine(name) && !hasProjectSignal;
  return roleOnly;
}

function mergeProjectsConservatively(aiItems: ResumeProject[], rawItems: ResumeProject[], fallbackItems: ResumeProject[]): ResumeProject[] {
  const trusted = [...(aiItems || []), ...(fallbackItems || [])].filter((p) => cleanProjectName(p?.name || ''));
  const raw = (rawItems || [])
    .map((p) => ({ name: cleanProjectName(p?.name || ''), bullets: unique(p?.bullets || [], 10) }))
    .filter((p) => p.name && p.bullets.length > 0);

  // When AI or deterministic parsing already found project identities, raw text
  // is used only to enrich matching projects. This prevents sidebar labels,
  // education lines and individual bullets from becoming extra projects.
  if (trusted.length) {
    const merged = new Map<string, ResumeProject>();
    for (const project of trusted) {
      const name = cleanProjectName(project.name || '');
      if (!name) continue;
      const key = normalizeForCompare(name);
      const rawMatch = raw.find((candidate) => {
        const rawKey = normalizeForCompare(candidate.name);
        return rawKey === key || rawKey.includes(key) || key.includes(rawKey);
      });
      const existing = merged.get(key);
      merged.set(key, {
        name,
        bullets: unique([...(existing?.bullets || []), ...(project.bullets || []), ...(rawMatch?.bullets || [])], 10),
      });
    }
    return [...merged.values()].slice(0, 10);
  }

  // If all structured sources missed the section, accept only raw candidates
  // with at least one descriptive bullet and deduplicate near-identical names.
  const merged = new Map<string, ResumeProject>();
  for (const project of raw) {
    const key = normalizeForCompare(project.name);
    const existingKey = [...merged.keys()].find((k) => k === key || k.includes(key) || key.includes(k));
    if (existingKey) {
      const existing = merged.get(existingKey)!;
      existing.bullets = unique([...(existing.bullets || []), ...(project.bullets || [])], 10);
    } else {
      merged.set(key, project);
    }
  }
  return [...merged.values()].slice(0, 8);
}

function mergeProjectsPreservingOriginal(aiItems: ResumeProject[], rawItems: ResumeProject[], fallbackItems: ResumeProject[]): ResumeProject[] {
  const sources = [...fallbackItems, ...rawItems, ...aiItems];
  const merged = new Map<string, ResumeProject>();
  for (const project of sources) {
    const key = normIdentity(project.name || "");
    if (!key) continue;
    const existing = merged.get(key);
    if (!existing) merged.set(key, { name: project.name, bullets: project.bullets || [] });
    else merged.set(key, {
      name: existing.name || project.name,
      bullets: unique([...(existing.bullets || []), ...(project.bullets || [])], 8),
    });
  }
  return [...merged.values()].slice(0, 12);
}

function buildProfileFromAi(ai: AiResumeJson, fallback: ResumeProfile, rawText: string, fileName = "", knownHeadline = ""): ResumeProfile {
  const basics = ai.basics && typeof ai.basics === "object" ? ai.basics : {};
  const aiExperience = coerceExperience(ai.experience);
  const rawExperience = extractExperienceIdentityFromRawText(rawText);
  const protectedExperience = mergeRawExperienceIdentity(fallback.experience || [], rawExperience);
  const experience = mergeExperienceIdentity(aiExperience, protectedExperience.length ? protectedExperience : (fallback.experience || []));
  const education = coerceEducation(ai.education);
  const aiProjects = coerceProjects(ai.projects);
  const rawProjects = mergeProjectsPreservingOriginal(
    extractProjectsFromRawTextRobust(rawText),
    extractProjectsFromRawText(rawText),
    [],
  );
  const projects = mergeProjectsConservatively(aiProjects, rawProjects, fallback.projects || []);

  const aiName = clean(basics.name).toLowerCase();
  // Role-title pattern for skill filtering, matches ONLY when the skill
  // is a bare job-title phrase with no brand/technology prefix.
  // IMPORTANT: must NOT reject legitimate compound skill names like:
  //   "Google Cloud", "Azure DevOps", "Technical Support", "Data Analysis",
  //   "Cloud Security", "IT Support", "Marketing Automation", "Customer Success"
  // These all contain role-type words but are genuine skills.
  // Rule: only reject when ALL words in the skill are role-type words AND there
  // is no brand prefix (proper noun starting with capital, not in the role list).
  // ── Structural skill/job-title discriminator ─────────────────────────────
  // ROLE_WORD_RE mixes two conceptually different word classes. We split them:
  //


  const rawSkills = unique(asList(ai.skills), 40)
    .filter((s) => {
      const trimmed = s.trim();
      if (!trimmed) return false;
      // Reject if it's the candidate's own name
      if (aiName && trimmed.toLowerCase() === aiName) return false;
      // Reject BARE role-title phrases (no brand prefix), but keep compound tool names
      // like "Google Cloud", "Technical Support", "Data Analysis", "Azure DevOps"
      if (isJobTitleNotSkill(trimmed)) return false;
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

  const languages = unique([
    ...asList(ai.languages),
    ...(fallback.languages || []),
    ...extractLanguagesFromRawText(rawText),
  ], 20);
  const certifications = unique(asList(ai.certifications), 12);

  const profile = {
    ...fallback,
    rawText,
    basics: {
      // When the AI returns an empty name (it was told to do this when unsure),
      // fall back to the deterministic parser's name rather than leaving it blank.
      // The deterministic parser correctly finds spaced-caps names (e.g. "JOHN
      // SMITH") even in sidebar-first PDFs where the AI gets confused.
      name: clean(basics.name) || fallback.basics?.name || "",
      headline: resolveTargetHeadline({
        aiHeadline: cleanHeadline(clean(basics.headline) || fallback.basics?.headline || experience[0]?.title || knownHeadline || ""),
        rawText,
        selectedName: clean(basics.name) || fallback.basics?.name || "",
      }),
      // Clean email immediately at construction, never let a concatenated email through
      email: cleanEmailField(clean(basics.email) || fallback.basics?.email || extractEmail(rawText)),
      // Validate AI phone, if it looks like a postal code, year, or date, discard and extract from raw text
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
    languages,
    certifications: certifications.length ? certifications : fallback.certifications || [],
    strengths: unique(asList(ai.strengths), 12).length ? unique(asList(ai.strengths), 12) : fallback.strengths || [],
    additionalEvidence: unique(asList(ai.additionalEvidence), 18).length ? unique(asList(ai.additionalEvidence), 18) : fallback.additionalEvidence || [],
    warnings: unique(asList(ai.warnings), 10),
    previewText: fallback.previewText,
  } as ResumeProfile;

  return repairProfileIdentity(profile, rawText, fileName, clean(basics.name));
}

// Public builder so any JSON-producing source (e.g. the vision CV extractor)
// can reuse the EXACT same coercion + identity repair the text AI parser uses.
// Single source of truth: skills filtering, email/phone validation, dedup, and
// repairProfileIdentity all run here regardless of who produced the JSON.
export function buildResumeProfileFromAiJson(
  ai: AiResumeJson,
  opts: { rawText?: string; fileName?: string; knownHeadline?: string } = {},
): ResumeProfile {
  const rawText = opts.rawText || "";
  const fallback: ResumeProfile = {
    rawText,
    basics: { name: "", headline: "", email: "", phone: "", location: "", linkedin: "" },
    summary: "",
    experience: [],
    education: [],
    skills: [],
    projects: [],
    languages: [],
    certifications: [],
    strengths: [],
    additionalEvidence: [],
    warnings: [],
    previewText: rawText.slice(0, 400),
  };
  return buildProfileFromAi(ai, fallback, rawText, opts.fileName || "", opts.knownHeadline || "");
}

function truncateCvText(value: string, limit = 10000) {  // 10k chars covers even verbose 4-page CVs; 28k was 7x overkill
  const text = normalizeCvTextForParsing(value);
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n\n[CV truncated for model context]`;
}



function sanitizeParsedProfileFields(profile: ResumeProfile, rawText: string, fileName = ''): ResumeProfile {
  const fallback = extractResumeProfileComplex(rawText);
  const experience = Array.isArray(profile.experience) ? profile.experience : [];
  const education = Array.isArray(profile.education) ? profile.education : [];
  const projects = mergeProjectsConservatively(
    Array.isArray(profile.projects) ? profile.projects : [],
    [
      ...extractProjectsFromRawTextRobust(rawText),
      ...extractProjectsFromRawText(rawText),
    ],
    Array.isArray(fallback.projects) ? fallback.projects : [],
  );

  const headlineRaw = clean(profile.basics?.headline || '');
  const headlineLooksLikeSentence = headlineRaw.length > 100 ||
      (headlineRaw.split(/\s+/).length > 10 && /\b(with|and|for|to|that|which|after|before|because|while|where|using|leading|improving|supporting|managing|developing|creating|providing|transitioning|completing|seeking|pursuing|focused|specialized|passionate)\b/i.test(headlineRaw)) ||
      // Detect transition/career-change sentences: starts with common sentence openers
      /^(ex-|former|experienced|results-driven|detail-oriented|passionate|motivated|dedicated|highly|a tech|i am|skilled|seasoned)/i.test(headlineRaw);
  const headlineLooksLikeBullet = /^(led|managed|assisted|supported|coordinated|created|developed|implemented|improved|provided|responsible|collaborated|conducted)\b/i.test(headlineRaw) && headlineRaw.length > 60;
  const safeHeadline = resolveTargetHeadline({
    aiHeadline: headlineLooksLikeSentence || headlineLooksLikeBullet
      ? clean(fallback.basics?.headline || experience[0]?.title || "")
      : headlineRaw,
    rawText,
    selectedName: profile.basics?.name || fallback.basics?.name || "",
  });

  const cleanedSkills = deduplicateSkills((Array.isArray(profile.skills) ? profile.skills : [])
    .filter((skill) => clean(skill).length <= 60)
    .filter((skill) => normalizeForCompare(skill) !== normalizeForCompare(profile.basics?.name || ""))
    .filter((skill) => !/^(summary|experience|education|projects|skills|languages|contact)$/i.test(clean(skill)))
  );

  const safeProjects = projects.filter((project) => !isContaminatedProjectIdentity(project, { ...profile, basics: { ...profile.basics, headline: safeHeadline || profile.basics?.headline || "" } } as ResumeProfile));

  return {
    ...profile,
    experience,
    education,
    projects: safeProjects,
    languages: mergeLanguagesGlobally(
      Array.isArray(profile.languages) ? profile.languages : [],
      fallback.languages || [],
      extractLanguagesFromRawText(rawText),
    ),
    skills: cleanedSkills.length ? cleanedSkills : deduplicateSkills(fallback.skills || []),
    basics: {
      ...profile.basics,
      headline: safeHeadline || 'Professional',
    },
  } as ResumeProfile;
}

export function repairResumeProfileAfterParsing(profile: ResumeProfile, rawText: string, fileName = ""): ResumeProfile {
  const repaired = repairProfileIdentity(profile, rawText, fileName, profile.basics?.name || "");
  const sanitized = sanitizeParsedProfileFields(repaired, rawText, fileName);

  // One final deterministic integrity pass is shared by AI, vision, Affinda,
  // pasted text, and local fallback results. It never invents facts and only
  // performs evidence-preserving repairs: contact bleed removal, duplicate /
  // fragment merging, sentence deduplication, and canonical language/skill
  // normalization. Deliberately removed the old positional bullet redistribution
  // and chronological date-swapping heuristics because both could fabricate a
  // candidate history when a PDF layout was ambiguous.
  const integrity = canonicalizeResumeProfileIntegrity(sanitized, rawText);
  if (integrity.warnings.length) {
    console.log("[WorkZo CV Pipeline] api.cv.integrity_repair", {
      fileName,
      warnings: integrity.warnings,
      ...integrity.counts,
    });
  }

  return integrity.profile;
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

  // Resolve identity BEFORE the generative parser. The model is good at
  // semantic section extraction but is not the authority for page layout.
  // Supplying a deterministic lock prevents recurring contamination such as
  // skills, section labels, companies, or role phrases being returned as the
  // candidate's name. The canonical builder still validates the result later.
  const preResolvedIdentity = resolveAuthoritativeCvName({
    rawText,
    parserName: "",
    currentName: input.candidateName || localFallback.basics?.name || "",
    fileName: input.fileName || "",
    email: localFallback.basics?.email || "",
  });
  const lockedCandidateName = preResolvedIdentity.needsConfirmation
    ? ""
    : preResolvedIdentity.name;

  if (!rawText.trim()) return { ok: false, source: "empty", resumeProfile: localFallback, error: "No CV text provided." };

  if (!process.env.OPENROUTER_API_KEY) {
    return { ok: false, source: "local_fallback_no_api_key", resumeProfile: localFallback, error: "OPENROUTER_API_KEY is missing." };
  }

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      // Bounded so a slow/stalled OpenRouter response can never hang the /api/cv
      // request until the browser aborts. The OpenAI SDK default is a 10-minute
      // timeout with 2 retries; on a stalled upstream that produced the
      // "Reading this CV took too long" abort on onboarding. With these limits a
      // stalled call throws in ~18s and the catch below degrades to the local
      // deterministic parser, so the user still gets their CV text and a
      // best-effort profile fast.
      timeout: 18000,
      maxRetries: 1,
      defaultHeaders: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://workzoai.com",
        "X-Title": "WorkZo AI",
      },
    });

    const model = process.env.WORKZO_CV_AI_MODEL || "google/gemini-2.5-flash";
    const response = await client.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: 2000,  // CV JSON is ~600-900 tokens; 2000 gives headroom without forcing long generation
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You are a professional CV parser for WorkZo AI.",
            "Return ONLY valid JSON. Do not write markdown.",
            "Extract facts exactly from the CV. Do not invent anything.",
            "ABSOLUTE RULE: where the source text is ambiguous or damaged by PDF extraction, leave the field EMPTY and record a warning. Never fill a gap with a plausible guess. A missing field is one click for the user to fix. A fabricated field is a false statement on a job application.",
            "Extract ONLY from the CV text. Ignore any target role, job description, market, plan, or user preference even if supplied elsewhere.",
            "This step creates the immutable canonical CV. Do not tailor, rewrite, shorten, promote, rename, or reinterpret any role, project, education entry, language, or skill.",
            "Job titles, company names, dates, project names, degree names, institutions, and language levels must be copied exactly from the CV.",
            "",
            "CRITICAL, basics.name MUST be a real human person's full name (first + last).",
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
            "  WRONG: 'Matplotlib Seaborn Tableau', 'Public Relations Teamwork', 'Programming Python Bash PowerShell', 'Profile Summary Work Experience', 'Marketing Manager', 'Critical Thinking', 'Acme Corp Ltd'",
            "  CORRECT: 'Maria Schmidt', 'James Okafor', 'Elena Vasquez', 'Thomas Müller'",
            "",
            "HOW TO FIND THE REAL NAME:",
            "  1. Look for a standalone line near the top that contains only a person's first and last name.",
            "  2. It is often in ALL CAPS, Title Case, or spaced letters (H A R I T H A V I J A Y A K U M A R).",
            "  3. It usually appears immediately above or below the job title/headline.",
            "  4. In two-column CVs the name is typically in the header or sidebar at the TOP.",
            "  5. If you cannot confidently identify a human name, set basics.name to empty string, do NOT guess.",
            "",
            "SPACED-LETTER DECORATIVE TEXT:",
            "  Many PDF CV templates render text with individual letters separated by spaces for visual effect.",
            "  e.g. 'I T - S u p p o r t - S p e z i a l i s t   /   T e c h n i s c h e r   S u p p o r t - I n g e n i e u r'",
            "  This should be read as: 'IT-Support-Spezialist / Technischer Support-Ingenieur'",
            "  Rule: collapse runs of single letters separated by spaces into their intended words.",
            "  Single spaces between letters = one word. Larger gaps (2+ spaces, or a slash) = word/section boundaries.",
            "  Another example: 'J O H N   S M I T H' = 'JOHN SMITH' (two words separated by larger gap).",
            "  'W I L S O N' with tight single spaces = 'WILSON' (one word, likely last name).",
            "",
            "PROJECT EXTRACTION RULES:",
            "  Projects may appear under any of these headings (English): PROJECTS, PERSONAL PROJECTS, ACADEMIC PROJECTS, BOOTCAMP PROJECTS, DATA SCIENCE PROJECTS, SELECTED PROJECTS, NOTABLE PROJECTS, KEY PROJECTS, SIDE PROJECTS, RELEVANT PROJECTS, PORTFOLIO, PROJECT HIGHLIGHTS, CASE STUDIES.",
            "  German headings: PROJEKTE, AUSGEWÄHLTE PROJEKTE, PERSÖNLICHE PROJEKTE, EIGENENTWICKLUNGEN.",
            "  French headings: PROJETS, PROJETS PERSONNELS, RÉALISATIONS, TRAVAUX.",
            "  Spanish headings: PROYECTOS, PROYECTOS PERSONALES, TRABAJOS.",
            "  Italian headings: PROGETTI, PROGETTI PERSONALI, LAVORI.",
            "  Dutch headings: PROJECTEN, EIGEN PROJECTEN.",
            "  Polish headings: PROJEKTY.",
            "  Never drop projects if any of these section headings exist in the CV.",
            "  Extract every project name and its technologies/results as bullets.",
            "  If uncertain whether an item is a project or extra experience, keep it in projects rather than dropping it.",
            "  Do not invent projects. Only use text found in the CV.",
            "  CRITICAL, NEVER put project entries into the experience array. Projects and work experience are always separate.",
            "  A project is independent work done by the candidate (bootcamp project, personal analysis, portfolio piece, case study), it has NO employer, NO company name, and NO employment dates.",
            "  Work experience is a paid or formal role at a named company with a date range. If an item has a company name AND a date range, it belongs in experience. If it only has a project name and bullets, it belongs in projects.",
            "  NEVER attribute a project bullet to an employer just because the project appears after that employer in the CV text. Section boundaries override linear proximity.",
            "",
            "EDUCATION ordering: sort education entries by start date DESCENDING (most recent first).",
            "EDUCATION fields: 'degree' is the QUALIFICATION NAME (e.g. 'Bachelor of Science', 'Master of Arts in Marketing', 'Data Science Bootcamp'). 'institution' is the SCHOOL/UNIVERSITY NAME. NEVER put the school name in the degree field. If only a school name appears without an explicit degree title, set degree to empty string and only fill institution.",
            "LOCATION field: must be a physical address, city, or country. NEVER put education entries, university names, dates, or date ranges in the location field.",
            "SKILLS EXTRACTION RULES, extract skills from ALL these formats:",
            "  1. Comma-separated list:  'Python, SQL, Tableau' → [Python, SQL, Tableau]",
            "  2. Line-separated list:   each skill on its own line",
            "  3. Category format:       'Programming: Python, SQL' → [Python, SQL] (extract values, drop category label)",
            "  4. Grouped labels:        'Tools: JIRA, Confluence | Platforms: AWS, GCP' → [JIRA, Confluence, AWS, GCP]",
            "  5. Colon-separated:       'Data Visualization: Tableau, Matplotlib, Seaborn' → [Tableau, Matplotlib, Seaborn]",
            "  NEVER include category labels (like 'Programming', 'Data Engineering', 'Machine Learning', 'Tools', 'Platforms') as skills themselves.",
            "  IMPORTANT PDF artifact: some PDFs merge the category label and first skill with no separator, e.g. 'Security ToolsSplunk, Wireshark' or 'Cloud PlatformsAWS, Azure, Google Cloud'. Recognize this pattern and extract: Splunk, Wireshark (from Security Tools), AWS, Azure, Google Cloud (from Cloud Platforms). The merged part before the first recognizable tool/product name is the category label.",
            "  ALWAYS include 'Google Cloud', 'Azure', 'AWS', 'Google Cloud Platform', 'Microsoft Azure' as skills when present, these are cloud platforms, not job titles.",
            "  ALWAYS include 'Technical Support', 'Customer Support', 'Data Analysis', 'IT Support', 'Cloud Security' as skills when present, these are skill areas, not job titles.",
            "  DO NOT filter out compound skill names just because they contain words like 'cloud', 'data', 'technical', 'system', or 'network'. Those words appear in both job titles AND skill names. Only exclude a skill if the entire phrase is a standalone job title (e.g. 'Cloud Engineer', 'Data Analyst') with no qualifier.",
            "  The category label is the text before the colon. Extract only what comes AFTER the colon as individual skills.",
            "  Example: 'Generative AI: LangChain, Retrieval-Augmented Generation (RAG)' → [LangChain, RAG]",
            "  Deduplicate: if the same skill appears under multiple categories, include it once.",
            "",
            "SKILLS deduplication: remove duplicate skills that differ only in casing (e.g. 'Python' and 'python').",
            "BOOTCAMPS, COURSES AND TRAINING PROGRAMMES: a bootcamp, coding school, data science programme, online course, or short training programme is EDUCATION, not work experience. It belongs in the education array with the programme name as the degree and the school as the institution. NEVER put a bootcamp in the experience array as a job. The recruiter must never ask 'tell me about your role at [bootcamp]', bootcamps produce projects and skills, not employment history. If a bootcamp section has project bullets beneath it, those bullets belong in the projects array, not as experience bullets.",
            "SKILLS QUALITY FILTER: reject any 'skill' that is actually a phrase, sentence fragment, or soft skill description rather than a concrete tool, technology, methodology, or named competency. Examples to REJECT: 'Planning', 'execution', 'stakeholder communication', 'client relationship building', 'product demonstration', 'Quick learner', 'Team player', 'Curious', 'Creative', 'Detail-oriented'. Examples to KEEP: 'Python', 'SQL', 'Tableau', 'ITIL', 'Active Directory', 'SLA Management', 'Incident Management', 'Agile', 'Scrum'. A skill should be a noun or noun phrase that names something specific, not a verb phrase or generic adjective.",
            "",
            "PHONE VALIDATION: The phone field must contain an actual phone number with a realistic dial pattern.",
            "  REJECT these as phone numbers: '(2021 - 2022)', '2019 - 2021', any value that is only year ranges.",
            "  A valid phone contains digits AND a country code or area code pattern (e.g. '+49 176 123 456', '(0221) 1234-56', '+1-800-555-1234').",
            "  If no valid phone number is found, set phone to empty string, never use a date or year range as phone.",
            "",
            "NAME VALIDATION: basics.name must be the candidate's full personal name.",
            "  INVALID names: 'Projects', 'Key Projects', 'Education', 'Skills', 'Testing And Debugging', 'Financial Accountant',",
            "    'Senior Accountant', 'Marketing Manager', 'Graphic Designer', 'Candidate', 'Professional',",
            "    any section heading, any skill, any job title used as a name.",
            "  If the name field would be one of these invalid values, scan the document header for a real person name instead.",
            "  A valid name is 1-5 words, no digits, no section-heading words.",
            "",
            "If the name is split across lines around a job title, combine person-name tokens only: FIRST / ROLE / LAST => FIRST LAST.",
            "Keep bullets factual. Split bullets only when the source clearly separates responsibilities.",
            "BULLETS ARE REQUIRED: If a job listing has any text below the title/company (responsibilities, achievements, tasks, any sentences), you MUST extract those as bullets. An empty bullets array [] is ONLY acceptable when the job listing has literally zero text underneath it, no sentences, no phrases, nothing. If there is ANY text below the role header, extract it as bullets. Never return bullets:[] when content exists.",
            "BULLET ATTRIBUTION IN TWO-COLUMN PDFs: when a CV has two or more employers in a column layout, PDF extraction sometimes emits one employer's bullets and the next employer's bullets as a single block, with the second employer's header appearing after the block.",
            "Split such a block ONLY on positive content evidence: a bullet names a product, customer type, tool, scope, or responsibility that clearly belongs to one of the two roles and not the other.",
            "If there is no distinguishing content evidence, DO NOT GUESS. Never split a block by position, by bullet count, or by halves. Leave the bullets under the employer whose header precedes them and append 'ambiguous_bullet_attribution' to the warnings array. Attribution you cannot evidence from the text is fabrication, and a fabricated fact on a CV is worse than a missing one.",
            "If PDF extraction placed a company header AFTER its own bullet content, you may re-home a bullet to that company ONLY when the bullet's content evidences it (its tools, products, customers, or scope match that role and not the preceding one). Never re-home a bullet on position alone and never move a fixed number of trailing bullets. If the content is ambiguous, leave the bullets where they are and add 'ambiguous_bullet_attribution' to warnings.",
            "",
            "SECTION HEADING vs JOB TITLE: A section heading (e.g. 'Customer Success Achievements', 'Awards and Recognition', 'Additional Information', 'Volunteer Work', 'Relevant Experience') is NOT a job title. Never add a section heading to the experience array as a job entry. A valid experience entry must have at minimum: a recognisable job title (a role a person would hold, e.g. 'Marketing Manager', 'Software Engineer') AND a company name OR employment dates. A section heading alone with neither company nor dates should be ignored as an experience entry, add its contents to strengths or additionalEvidence instead.",
            "DATES ARE FACTS: copy every date range exactly as it appears beside its own entry. Never swap, reorder, infer, or reconstruct a date range from job title, seniority, or chronological expectation. An unexpected date order is not evidence of a swap, real careers overlap and move sideways.",
            "If an experience entry's date range is identical to an education entry's date range, it was probably picked up from the wrong column: set that experience entry's dates to an empty string and add 'uncertain_experience_dates' to the warnings array. Do NOT substitute a guessed date range.",
            "EDUCATION SECTION CAN CONTAIN JOB TITLES IN PLACEHOLDER CVs: Some CV templates list job titles, company names, or Lorem ipsum text under the EDUCATION header. If content under EDUCATION has date ranges AND looks like a job title rather than a degree name, keep it in experience, do not move it to education. A degree name contains words like Bachelor, Master, MBA, BSc, MSc, PhD, Diploma, Certificate, Associate's, or the name of a field of study. A job title contains words like Manager, Engineer, Analyst, Developer, Executive, Accountant, Designer. Do not confuse the two.",
            "SKILLS CATEGORY LABELS: Many CVs use a header-then-list format for skills, e.g. 'Technical Skills' followed by a list, or 'Teamwork and Communication Skills' followed by bullet points. The header line (e.g. 'Teamwork and Communication Skills', 'Testing and Debugging', 'Project and Time Management') is a CATEGORY LABEL, it is NOT itself a skill. Only extract the individual items listed beneath each category header as skills. Never extract a category header as a skill. If the CV has a skills section formatted as paragraphs describing competencies rather than a list, extract the core noun phrases from those paragraphs (e.g. 'debugging', 'project timeline management'), not the full sentence.",
            "CERTIFICATIONS AND AWARDS: Many CVs have sections named 'Awards and Certifications', 'Awards and Certification', 'Awards & Certifications', 'Short Courses', 'Courses', 'Achievements', 'Distinctions', 'Licences', 'Honours and Awards', 'Professional Development', 'Training and Certifications', or 'Continuing Education'. ALL of these must be extracted into the certifications array, NOT ignored. Each certification or award is one entry: the name of the cert/award/course. Include the year if present. Example: 'Digital Marketing Certification | 2029' → 'Digital Marketing Certification (2029)'. If the section is called 'References' and contains only 'Available on request.', skip it entirely.",
            "EDUCATION INSTITUTION vs COMPANY NAME: Some CV templates use company or organisation names as education institutions (e.g. 'Warner & Spencer', 'Giggling Platypus Co.'). Do not skip an education entry just because the institution name looks like a company name. Always extract the institution exactly as written, even if it sounds unusual. The key signal that something is an education entry is the presence of a degree name (Bachelor, Master, MBA, etc.) paired with a date. Extract both the degree AND the institution, even if the institution looks odd.",
            "",
            "If PDF extraction merged bullets into one long paragraph (common in two-column layouts), split them at sentence boundaries into separate bullet strings.",
            "JSON shape: { basics:{name,headline,email,phone,location,linkedin}, summary, experience:[{title,company,location,dates,bullets:[]}], education:[{degree,institution,location,dates}], skills:[], projects:[{name,bullets:[]}], languages:[], certifications:[], strengths:[], additionalEvidence:[], warnings:[] }",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            `File name: ${input.fileName || "uploaded CV"}`,
            // Identity is resolved before the LLM. When locked, the model must
            // copy it exactly and must not independently infer a different name.
            ...(lockedCandidateName
              ? [
                  `AUTHORITATIVE CANDIDATE NAME: ${lockedCandidateName}`,
                  "Copy this exact value into basics.name. Do not replace, expand, shorten, or infer another name.",
                ]
              : [
                  "AUTHORITATIVE CANDIDATE NAME: UNRESOLVED",
                  "Set basics.name to an empty string. Do not infer a name from skills, headings, companies, filenames, or role text.",
                ]),
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

    // Enforce the deterministic identity lock after generation as well. Prompt
    // compliance alone is not a safety boundary. When unresolved, keep the AI
    // name blank so the canonical stage can request confirmation honestly.
    parsed.basics = {
      ...(parsed.basics && typeof parsed.basics === "object" ? parsed.basics : {}),
      name: lockedCandidateName,
    };
    if (!lockedCandidateName) {
      const warnings = asList(parsed.warnings);
      parsed.warnings = unique([...warnings, "identity_needs_confirmation"], 10);
    }

    const aiProfile = buildProfileFromAi(parsed, localFallback, rawText, input.fileName || "", input.knownHeadline || "");
    const result: WorkZoAiCvParserResult = { ok: true, source: "ai_structured_cv", resumeProfile: aiProfile, error: "" };

    return result;
  } catch (error) {
    // Log the actual error so it appears in server logs, critical for debugging
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
