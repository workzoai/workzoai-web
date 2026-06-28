import { NextResponse } from "next/server";
import { createRequire } from "module";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import {
  normalizeResumeText,
  extractResumeProfileComplex,
  type ResumeProfile,
} from "@/lib/workzoResumeParser";
import { cleanExtractedCvText } from "@/lib/workzoCvPdfCleaner";
import {
  parseResumeWithAiStructure,
  type WorkZoAiCvParserResult,
  repairResumeProfileAfterParsing,
} from "@/lib/workzoAiCvParser";
import { debugCvPipeline, debugCvProfile, debugCvText } from "@/lib/workzoCvPipelineDebug";
import { enforceCanonicalCandidateName, validateCandidateName } from "@/lib/workzoResumeProfileManager";
import { mergeCvProfile, shouldRejectAffinda } from "@/lib/cvProfileMerge";

const require = createRequire(import.meta.url);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Parse result cache ───────────────────────────────────────────────────────
// Caches AI parse results by a hash of the raw CV text.
// Same file uploaded twice in quick succession → instant return, no AI call.
// Survives across requests within a warm serverless instance (up to ~10 min).
const _cvParseCache = new Map<string, { result: WorkZoAiCvParserResult; ts: number }>();
const CV_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CV_CACHE_MAX = 20;

function cvCacheKey(text: string): string {
  // Fast non-crypto hash — good enough for cache keying
  let h = 0x811c9dc5;
  for (let i = 0; i < Math.min(text.length, 4000); i++) {
    h ^= text.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return `cv_${h.toString(16)}_${text.length}`;
}

function cvCacheGet(key: string): WorkZoAiCvParserResult | null {
  const entry = _cvParseCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CV_CACHE_TTL_MS) { _cvParseCache.delete(key); return null; }
  return entry.result;
}

function cvCacheSet(key: string, result: WorkZoAiCvParserResult) {
  if (_cvParseCache.size >= CV_CACHE_MAX) {
    // Evict oldest entry
    const oldest = [..._cvParseCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) _cvParseCache.delete(oldest[0]);
  }
  _cvParseCache.set(key, { result, ts: Date.now() });
}

type RequestBody = {
  cvText?: string;
  layoutText?: string;
  rawCvText?: string;
  uploadedCvText?: string;
  resumeProfile?: ResumeProfile;
  profile?: ResumeProfile;
  jobDescription?: string;
  targetRole?: string;
  targetMarket?: string;
  fileName?: string;
  candidateName?: string;
  language?: string;
  mode?: string;
};

type PdfParseResult = {
  text?: string;
  numpages?: number;
  info?: unknown;
  metadata?: unknown;
};
type PdfParseFn = (buffer: Buffer) => Promise<PdfParseResult>;
type AnyRecord = Record<string, unknown>;

type AffindaResult = {
  ok: boolean;
  source: "affinda_resume_parser" | "affinda_failed" | "affinda_not_configured";
  resumeProfile?: ResumeProfile;
  raw?: unknown;
  error?: string;
};

function normalizeIdentityText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function identityAppearsInRawCv(rawCv: string, value: unknown) {
  const name = validateCandidateName(value);
  if (!name) return false;
  const raw = normalizeIdentityText(rawCv);
  const compactRaw = raw.replace(/\s+/g, "");
  const key = normalizeIdentityText(name);
  const compactKey = key.replace(/\s+/g, "");
  if (!raw || !key) return false;
  return raw.includes(key) || compactRaw.includes(compactKey);
}

function isInvalidPhoneValue(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  const digits = raw.replace(/\D/g, "");
  if (/\b(?:19|20)\d{2}\s*[-–/]\s*(?:19|20)\d{2}\b/.test(raw)) return true;
  if (/^\(?\s*(?:19|20)\d{2}\s*[-–/]\s*(?:19|20)\d{2}\s*\)?$/.test(raw)) return true;
  return digits.length > 0 && digits.length < 7;
}


function normalizeUploadFileName(fileName = "") {
  const clean = String(fileName || "uploaded-cv.pdf")
    .replace(/\s+/g, " ")
    .trim();
  return (
    clean
      .replace(/(?:\.pdf){2,}$/i, ".pdf")
      .replace(/(?:\.docx){2,}$/i, ".docx")
      .replace(/(?:\.txt){2,}$/i, ".txt") || "uploaded-cv.pdf"
  );
}


function normalizeCvTextForParsing(value: string) {
  const text = String(value || "")
    .replace(/\r/g, "\n")
    .replace(/\b(EDUCATION)(WORK EXPERIENCE)\b/gi, "$1\n$2")
    .replace(/\b(Work Experience)(Skills)\b/g, "$1\n$2")
    .replace(/\b(Professional Summary)(Skills)/gi, "$1\n$2")
    .replace(/\b(Contact)(Professional Summary)/gi, "$1\n$2")
    .replace(/\b(Projects?)(Professional|Work|Education|Skills)/gi, "$1\n$2")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n");

  const sectionMap: Array<[RegExp, string]> = [
    [/^(key|selected|personal|portfolio|bootcamp|academic|capstone|case study|case studies|security|data science|engineering)\s+projects?$/i, "PROJECTS"],
    [/^projects?$/i, "PROJECTS"],
    [/^(professional|work|employment|career|relevant)\s+experience$/i, "WORK EXPERIENCE"],
    [/^berufserfahrung$/i, "WORK EXPERIENCE"],
    [/^(technical|core|professional|summary of|summary)\s+skills$/i, "SKILLS"],
    [/^fähigkeiten$|^fahigkeiten$|^expertise$/i, "SKILLS"],
    [/^(education|educational background|academic history|education and training|bildungsweg|bildung|ausbildung)$/i, "EDUCATION"],
    [/^(professional summary|profile summary|profile overview|profilübersicht|profilubersicht|about me|overview)$/i, "SUMMARY"],
    [/^(languages|sprachen)$/i, "LANGUAGES"],
    [/^(certifications|certificates|awards and certification|short courses)$/i, "CERTIFICATIONS"],
  ];

  return text
    .split("\n")
    .map((line) => {
      for (const [pattern, replacement] of sectionMap) {
        if (pattern.test(line.trim())) return replacement;
      }
      return line;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeCvText(value: string) {
  return normalizeCvTextForParsing(cleanExtractedCvText(normalizeResumeText(value || "")));
}

// BUG FIXED, ROOT CAUSE: buildInterviewCvContext() (client-side, onboarding
// page) produces a labeled-summary format — "Candidate name: ...",
// "Headline: ...", "Experience:\n- title • company • dates" — built FROM an
// already-parsed profile, for use as LLM context elsewhere. It is NOT raw
// CV text. Confirmed from live testing: when this derived summary gets fed
// back into the AI CV-structuring parser (instead of the original raw
// text), the AI faithfully re-extracts the ALREADY-MANGLED structure
// (section labels like "Experience:" get misread as actual job titles,
// "Candidate name:" — omitted entirely when name was previously empty —
// means the name stays empty forever). This created a self-reinforcing
// degradation loop: each "memory sync" call re-parsed the previous garbled
// output instead of ever returning to the source text. This check refuses
// to AI-structure text matching this distinctive derived format, REGARDLESS
// of which client code path sent it — fixing it at the boundary rather than
// chasing every caller.
function looksLikeDerivedCvContext(text: string): boolean {
  const sample = (text || "").slice(0, 400);
  const markers = [
    /^Candidate name:/m,
    /^Headline:/m,
    /^Experience:\s*$/m,
    /^Education:\s*$/m,
    /^Skills:\s*.+/m,
  ];
  // Two or more of these distinctive section labels appearing as their own
  // lines is not something a real PDF/DOCX resume naturally produces —
  // it's the signature of buildInterviewCvContext's specific output format.
  return markers.filter((re) => re.test(sample)).length >= 2;
}

async function parsePdf(buffer: Buffer) {
  const pdfParseModule = require("pdf-parse");
  const pdfParse: PdfParseFn = pdfParseModule.default || pdfParseModule;
  const result = await pdfParse(buffer);
  return result.text || "";
}

async function parseDocx(buffer: Buffer): Promise<string> {
  const mammoth = require("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value || "";
}

async function extractFileTextFromBuffer(
  buffer: Buffer,
  fileName: string,
  fileType: string,
) {
  const lowerName = fileName.toLowerCase();
  const lowerType = fileType.toLowerCase();

  if (lowerType.includes("pdf") || lowerName.endsWith(".pdf"))
    return parsePdf(buffer);
  if (lowerType.includes("text") || lowerName.endsWith(".txt"))
    return buffer.toString("utf8");
  if (
    lowerType.includes("wordprocessingml") ||
    lowerType.includes("msword") ||
    lowerName.endsWith(".docx") ||
    lowerName.endsWith(".doc")
  )
    return parseDocx(buffer);

  throw new Error("Unsupported file type. Please upload a PDF, DOCX, or TXT CV.");
}

function cleanText(value: unknown) {
  if (typeof value === "string")
    return normalizeResumeText(value).replace(/\s+/g, " ").trim();
  if (typeof value === "number") return String(value);
  return "";
}

function asRecord(value: unknown): AnyRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as AnyRecord)
    : null;
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
}

function valueAt(obj: AnyRecord | null | undefined, keys: string[]) {
  if (!obj) return undefined;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return undefined;
}

function deepText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number")
    return cleanText(value);
  if (Array.isArray(value))
    return value.map(deepText).filter(Boolean).join(" ").trim();

  const obj = asRecord(value);
  if (!obj) return "";

  // Affinda fields often expose raw/parsed/value/text/name/inputStr.
  const direct = valueAt(obj, [
    "raw",
    "parsed",
    "value",
    "text",
    "name",
    "formatted",
    "inputStr",
    "display",
    "label",
  ]);
  if (direct !== value && direct !== undefined && direct !== null) {
    const text = deepText(direct);
    if (text) return text;
  }

  const first = deepText(valueAt(obj, ["first", "firstName", "givenName"]));
  const middle = deepText(valueAt(obj, ["middle", "middleName"]));
  const last = deepText(
    valueAt(obj, ["last", "lastName", "familyName", "surname"]),
  );
  return [first, middle, last].filter(Boolean).join(" ").trim();
}

function unique(items: string[], limit = 80) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const value = cleanText(item);
    const key = value
      .toLowerCase()
      .replace(/[^a-z0-9äöüßà-ÿ]+/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= limit) break;
  }
  return out;
}

function splitBullets(value: unknown): string[] {
  const text = deepText(value);
  if (!text) return [];
  return unique(
    text
      .split(/\n|•|\u2022|\s+-\s+|(?<=[.!?])\s+(?=[A-ZÄÖÜ])/g)
      .map((item) => item.replace(/^[-*•\s]+/, "").trim())
      .filter((item) => item.length > 12),
    8,
  );
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
  return cleanText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SECTION_OR_FAKE_NAME_RE =
  /\b(profile\s*summary|profilesummary|work\s*experience|workexperience|professional\s*summary|summary|skills?|expertise|competencies|core\s*competencies|languages?|education|contact|projects?|certifications?|awards?|interests?|references?|about\s*me|about|overview|berufserfahrung|bildungsweg|bildung|kenntnisse|fähigkeiten|fahigkeiten|ausbildung|sprachen|kontakt|programm|programming|program|data\s*visuali[sz]ation|machine\s*learning|generative\s*ai|matplotlib|seaborn|tableau|python|sql|tensorflow|sklearn|langchain|leadership|teamwork|critical\s*thinking|time\s*management|public\s*relations|effective\s*communication|english|german|deutsch|fluent|native|conversational|professional\s+working|intermediate|basic|basics|c1|c2|b1|b2|a1|a2|datenanalyse|markenmanagement|kommunikation|kreativität|kreativitat|betriebssysteme|netzwerke|programmierung|übersicht|ubersicht|profil|profilu\s*bersicht|berufsprofil)\b/i;
const ORG_RE =
  /\b(gmbh|ug|ag|kg|ltd|limited|llc|inc|corp|corporation|company|co\.?|group|holding|services|solutions|systems|technolog(?:y|ies)|software|digital|media|productions?|industries|studio|agency|partners|consulting|ventures|labs?|university|universität|universitaet|college|school|schule|hochschule|institute|institut|academy|akademie|preschool|kindergarten|department|ministry|state\s+education|community)\b/i;
const LOCATION_RE =
  /\b(street|straße|strasse|road|avenue|ave|weg|platz|city|stadt|town|village|germany|deutschland|india|france|italy|spain|usa|canada|berlin|munich|münchen|würzburg|wurzburg|chennai|london|frankfurt|anywhere|jeder?|jede)\b/i;
const ROLE_RE =
  /\b(project|product|program|programme|portfolio|it|ux|ui|software|data|business|marketing|sales|account|customer|success|support|technical|system|network|cloud|frontend|backend|full[ -]?stack|devops|hr|finance|operations|teacher|tutor|engineer|developer|designer|design|graphic|photography|motion|layout|analyst|specialist|consultant|coordinator|administrator|assistant|manager|director|lead|head|officer|executive|intern|trainee|technician|scientist|researcher|planner|accounting|auditing|windows|server|directory|active|weiterbildung|netzwerk|programmierung|betriebssystem|berater|entwickler|leiter|managerin|assistent)\b/i;
const CONTACT_RE = /@|www\.|https?:|linkedin|github|\+?\d[\d\s()./-]{5,}/i;
const NAME_SECTION_HEADERS = new Set([
  "CONTACT",
  "CONTACTS",
  "KONTAKT",
  "SKILLS",
  "EXPERTISE",
  "LANGUAGES",
  "SPRACHEN",
  "EDUCATION",
  "BILDUNG",
  "BILDUNGSWEG",
  "PROJECTS",
  "PROJEKTE",
  "PROFILE",
  "PROFIL",
  "SUMMARY",
  "OVERVIEW",
  "WORKEXPERIENCE",
  "BERUFSERFAHRUNG",
  "PROFILESUMMARY",
  "PROFESSIONALSUMMARY",
]);
const TITLE_HINT_RE =
  /\b(manager|managerin|engineer|designer|analyst|specialist|consultant|teacher|tutor|scientist|developer|assistant|assistent|support|data|marketing|product|project|preschool|cybersecurity|ai|ux|ui|it)\b/i;

function compactDecorativeLine(line: string) {
  const trimmed = line
    .replace(/[•●▪◦]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length >= 4 && tokens.every((t) => /^\p{Lu}$/u.test(t)))
    return tokens.join("");
  return trimmed;
}

function prepareLines(rawText: string) {
  return String(rawText || "")
    .split(/\n+/)
    .map(compactDecorativeLine)
    .map((line) => line.replace(/[\t]+/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function isHumanName(value: unknown) {
  const raw = cleanText(value)
    .replace(/^(candidate\s*name|name|applicant)\s*[:\-]\s*/i, "")
    .replace(/[^\p{L}' .-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!raw || raw.length < 3 || raw.length > 70) return "";
  if (CONTACT_RE.test(raw)) return "";
  if (SECTION_OR_FAKE_NAME_RE.test(raw)) return "";
  if (ORG_RE.test(raw)) return "";
  if (LOCATION_RE.test(raw)) return "";

  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 4) return "";
  if (new Set(parts.map((p) => p.toLowerCase())).size === 1) return "";
  if (!parts.every((part) => /^[\p{L}'-]{2,25}$/u.test(part))) return "";

  const roleWords = parts.filter((part) => ROLE_RE.test(part)).length;
  if (roleWords >= Math.ceil(parts.length / 2)) return "";

  return raw === raw.toUpperCase() ? titleCaseName(raw) : raw;
}

function extractEmail(rawText: string) {
  const compact = rawText.replace(
    /([A-Z0-9._%+-]+)\s*\n\s*@\s*([A-Z0-9.-]+\.[A-Z]{2,})/gi,
    "$1@$2",
  );
  return compact.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
}

function extractNameFromFileName(fileName = "") {
  const value = fileName
    .replace(/\.(pdf|docx|doc|txt)$/gi, "")
    .replace(/[_-]+/g, " ")
    .replace(/\d+/g, " ")
    .split(/\s+/)
    .filter(
      (w) =>
        w.length >= 4 && // reject short acronyms like CSM, DEU, CV, etc.
        !/^(resume|lebenslauf|bewerbung|curriculum|vitae|updated|final|copy|draft|template|sample|example|untitled|design|new|old|my|the|test|advanced|professional)$/i.test(
          w,
        ),
    )
    .join(" ")
    .trim();
  return isHumanName(value);
}

function extractNameFromEmail(rawText: string) {
  const email = extractEmail(rawText);
  if (!email) return "";
  const local = email
    .split("@")[0]
    .replace(/\d+/g, " ")   // strip numbers first
    .replace(/[._-]+/g, " ") // split on separators
    .trim();

  // Try direct split first (e.g. "john.doe" or "john_doe")
  const direct = isHumanName(local);
  if (direct) return direct;

  // Try camelCase split (e.g. "JohnDoe" or "johnDoe")
  const camelSplit = local
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim();
  const fromCamel = isHumanName(camelSplit);
  if (fromCamel) return fromCamel;

  // Last resort: if the local part (stripped of digits) is 10-28 chars,
  // try splitting it into first/last name parts.
  // Require both parts >= 5 chars to avoid garbage like "Sure Nderdillibabu".
  const stripped = local.replace(/\s+/g, "").toLowerCase();
  if (stripped.length >= 10 && stripped.length <= 28) {
    for (let split = 5; split <= Math.min(10, stripped.length - 5); split++) {
      const first = stripped.slice(0, split);
      const last = stripped.slice(split);
      if (first.length >= 5 && last.length >= 5) {
        const candidate = `${first.charAt(0).toUpperCase()}${first.slice(1)} ${last.charAt(0).toUpperCase()}${last.slice(1)}`;
        const validated = isHumanName(candidate);
        if (validated) return validated;
      }
    }
  }

  return "";
}

function isSectionHeaderLine(line: string) {
  const key = line.replace(/[^A-Za-zÄÖÜäöüß]/g, "").toUpperCase();
  return NAME_SECTION_HEADERS.has(key) || SECTION_OR_FAKE_NAME_RE.test(line);
}

function splitCompactNameByFile(compact: string, fileName = "") {
  const fileCandidate = extractNameFromFileName(fileName);
  if (!fileCandidate) return "";
  const compactFile = normalizeForCompare(fileCandidate).replace(/\s+/g, "");
  const compactLine = normalizeForCompare(compact).replace(/\s+/g, "");
  return compactFile && compactLine && compactFile === compactLine
    ? fileCandidate
    : "";
}

function extractHeaderName(rawText: string, fileName = "", parserName = "") {
  const lines = prepareLines(rawText); // scan full document — two-column PDFs often place the name after line 220
  const candidates: Array<{ name: string; score: number; reason: string }> = [];

  // Highest trust: user-uploaded filename when it contains a real name.
  const fromFile = extractNameFromFileName(fileName);
  if (fromFile) candidates.push({ name: fromFile, score: 95, reason: "file" });

  const fromEmail = extractNameFromEmail(rawText);
  if (fromEmail)
    candidates.push({ name: fromEmail, score: 12, reason: "email" });

  // Lowest trust: parser/model name. It often returns skills, languages, companies, or schools.
  const fromParser = isHumanName(parserName);
  if (fromParser)
    candidates.push({ name: fromParser, score: 8, reason: "parser-low-trust" });

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (isSectionHeaderLine(line)) continue;

    const compactFileName = /^[A-ZÄÖÜ]{10,}$/u.test(line)
      ? splitCompactNameByFile(line, fileName)
      : "";
    if (compactFileName) {
      candidates.push({
        name: compactFileName,
        score: 110,
        reason: "compact-file-confirmed",
      });
      continue;
    }

    // Compact all-caps line with no filename confirmation:
    // Check if the compact string matches the email local part — if so,
    // use the email-derived name (which was already split into first/last)
    // and score by position. This handles decorative compact headers when the email is structured.
    if (/^[A-ZÄÖÜ]{10,}$/u.test(line) && fromEmail) {
      const rawEmailLocal = extractEmail(rawText).split("@")[0].replace(/\d+/g, "").toLowerCase();
      const compactLower = line.toLowerCase();
      if (rawEmailLocal && compactLower === rawEmailLocal) {
        const posScore = index < 8 ? 80 : index < 20 ? 60 : 40;
        candidates.push({ name: fromEmail, score: posScore, reason: "compact-email-confirmed" });
        continue;
      }
    }

    const name = isHumanName(line);
    if (!name) continue;

    const prev = lines[index - 1] || "";
    const next = lines[index + 1] || "";
    const prev2 = lines[index - 2] || "";
    const next2 = lines[index + 2] || "";
    const near = [prev2, prev, next, next2].join(" ");

    let score = 0;
    if (index < 15) score += 34;
    else if (index < 50) score += 22;
    else if (index < 120) score += 12;

    if (line === line.toUpperCase()) score += 14;
    if (TITLE_HINT_RE.test(prev) && !isHumanName(prev)) score += 22;
    if (TITLE_HINT_RE.test(next) && !isHumanName(next)) score += 26;
    if (CONTACT_RE.test(near)) score += 12;

    if (SECTION_OR_FAKE_NAME_RE.test(near)) score -= 18;
    if (ORG_RE.test(line) || ORG_RE.test(near)) score -= 22;
    if (LOCATION_RE.test(line)) score -= 30;
    if (
      /\b(fluent|native|conversational|intermediate|professional|basic|b1|b2|c1|c2|a1|a2)\b/i.test(
        line,
      )
    )
      score -= 40;
    if (
      /\b(matplotlib|seaborn|tableau|python|sql|programm|programming|profile\s*summary|work\s*experience)\b/i.test(
        line,
      )
    )
      score -= 50;

    candidates.push({ name, score, reason: "line" });
  }

  // Handles split layout: ADELINE / ENGLISH TEACHER / PALMERSTON.
  for (let i = 0; i < Math.min(lines.length - 2, 80); i += 1) {
    const first = cleanText(lines[i]);
    const middle = cleanText(lines[i + 1]);
    const last = cleanText(lines[i + 2]);
    if (
      /^[A-ZÄÖÜ][A-ZÄÖÜ'-]{2,}$/u.test(first) &&
      TITLE_HINT_RE.test(middle) &&
      /^[A-ZÄÖÜ][A-ZÄÖÜ'-]{2,}$/u.test(last)
    ) {
      const combined = isHumanName(`${first} ${last}`);
      if (combined)
        candidates.push({
          name: combined,
          score: 110,
          reason: "split-title-name",
        });
    }
  }

  // Handles two consecutive compact all-caps spaced-letter lines that together form a name.
  // Example: "S U R E N D E R" (compacted to "SURENDER") followed by "D I L L I B A B U"
  // ("DILLIBABU") — neither alone passes isHumanName (1 part), but together they do.
  for (let i = 0; i < Math.min(lines.length - 1, 80); i += 1) {
    const lineA = cleanText(lines[i]);
    const lineB = cleanText(lines[i + 1]);
    // Only attempt if both compact to 1-word all-caps tokens (the spaced-letter pattern)
    if (
      /^[A-ZÄÖÜ]{4,}$/u.test(lineA) &&
      /^[A-ZÄÖÜ]{3,}$/u.test(lineB) &&
      !isSectionHeaderLine(lineA) &&
      !isSectionHeaderLine(lineB)
    ) {
      const combined = isHumanName(titleCaseName(`${lineA} ${lineB}`));
      if (combined) {
        // Cross-check: if filename contains something matching, boost confidence
        const fileCandidate = extractNameFromFileName(fileName);
        const fileKey = normalizeForCompare(fileCandidate).replace(/\s+/g, "");
        const combinedKey = normalizeForCompare(combined).replace(/\s+/g, "");
        const score =
          fileKey && combinedKey && fileKey === combinedKey ? 115 : 85;
        candidates.push({ name: combined, score, reason: "two-line-compact" });
      }
    }
  }

  // Handles two consecutive single-word proper-case lines that together form a name.
  // Example: "Estelle" on one line, "Darcy" on the next — each rejected alone (1 word),
  // but combined they pass isHumanName. Score by the earlier line's position.
  for (let i = 0; i < Math.min(lines.length - 1, 60); i += 1) {
    const lineA = cleanText(lines[i]);
    const lineB = cleanText(lines[i + 1]);
    // Each must be a single word, 3-20 chars, proper case (not all-caps block)
    if (
      /^[A-ZÄÖÜ][a-zäöüß]{2,19}$/u.test(lineA) &&
      /^[A-ZÄÖÜ][a-zäöüß]{2,19}$/u.test(lineB) &&
      !isSectionHeaderLine(lineA) &&
      !isSectionHeaderLine(lineB) &&
      !ROLE_RE.test(lineA) &&
      !ROLE_RE.test(lineB)
    ) {
      const combined = isHumanName(`${lineA} ${lineB}`);
      if (combined) {
        let score = 0;
        if (i < 8) score += 60;
        else if (i < 20) score += 40;
        else score += 20;
        // Boost if title hint follows (e.g. "Graphic Designer" after "Estelle Darcy")
        const after = cleanText(lines[i + 2] || "");
        if (TITLE_HINT_RE.test(after)) score += 20;
        candidates.push({ name: combined, score, reason: "two-line-proper-case" });
      }
    }
  }

  const deduped = new Map<
    string,
    { name: string; score: number; reason: string }
  >();
  for (const candidate of candidates) {
    const key = normalizeForCompare(candidate.name);
    const existing = deduped.get(key);
    if (!existing || candidate.score > existing.score)
      deduped.set(key, candidate);
  }

  const best = [...deduped.values()].sort((a, b) => b.score - a.score)[0];

  // Primary: return the best scoring candidate if it clears the threshold.
  if (best && best.score >= 14) return best.name;

  // Last resort: if no candidate scored well enough but the AI parser gave us
  // something that passes isHumanName validation, trust it — it was trained
  // specifically to extract names and often gets it right even when position
  // scoring fails (e.g. names buried deep in two-column PDF extraction order).
  if (parserName) {
    const parserValidated = isHumanName(parserName);
    if (parserValidated) return parserValidated;
  }

  return "";
}

function pickFirstText(...values: unknown[]) {
  for (const value of values) {
    const text = deepText(value);
    if (text) return text;
  }
  return "";
}

function pickArrayText(value: unknown, limit = 80) {
  const arr = asArray(value);
  const items = arr.map(deepText).filter(Boolean);
  return unique(items, limit);
}

function findAffindaData(document: unknown): AnyRecord {
  const root = asRecord(document) || {};

  // Affinda v3 API: POST /v3/documents returns
  //   { meta: {...}, data: { name, emails, workExperience, education, skills, ... } }
  // OR with an outer wrapper:
  //   { data: { identifier, fileName, data: { name, workExperience, ... } } }
  // Try root.data first, then check if the structured fields are one level deeper.
  const direct = asRecord(root.data);
  if (direct) {
    // v3 sometimes nests one level deeper: { data: { identifier, data: { workExperience... } } }
    const nested = asRecord(direct.data);
    if (nested && (nested.workExperience || nested.education || nested.name || nested.emails)) {
      return nested;
    }
    // root.data itself has the structured fields
    if (direct.workExperience || direct.education || direct.name || direct.emails) {
      return direct;
    }
  }

  // Wrapped responses: { document: { data: {...} } } or { result: { data: {...} } }
  for (const key of ["document", "result", "resume", "parsed"]) {
    const wrapper = asRecord(root[key as keyof typeof root]);
    if (!wrapper) continue;
    const inner = asRecord(wrapper.data);
    if (inner && (inner.workExperience || inner.education || inner.name)) return inner;
    if (wrapper.workExperience || wrapper.education || wrapper.name) return wrapper;
  }

  // Fallback: root itself
  return root;
}

function mapAffindaProfile(
  document: unknown,
  rawText: string,
  fileName: string,
): ResumeProfile {
  const data = findAffindaData(document);

  const nameObj = valueAt(data, [
    "name",
    "fullName",
    "candidateName",
    "candidate",
    "personName",
  ]);
  const parserName = deepText(nameObj);
  const lockedName = extractHeaderName(rawText, fileName, parserName);

  const email = pickFirstText(
    valueAt(data, ["email", "emailAddress"]),
    valueAt(data, ["emails", "emailAddresses"]),
    extractEmail(rawText),
  );
  const phone = pickFirstText(
    valueAt(data, ["phone", "phoneNumber"]),
    valueAt(data, ["phoneNumbers", "phones", "mobile"]),
  );
  const linkedin = pickFirstText(
    valueAt(data, ["linkedin", "linkedIn", "linkedInUrl"]),
    valueAt(data, ["websites", "urls", "links"]),
  );
  const location = pickFirstText(
    valueAt(data, ["location", "address", "locationName", "city", "country"]),
  );
  const headline = pickFirstText(
    valueAt(data, [
      "profession",
      "headline",
      "jobTitle",
      "currentJobTitle",
      "objective",
    ]),
  );
  const summary = pickFirstText(
    valueAt(data, [
      "summary",
      "professionalSummary",
      "objective",
      "profile",
      "about",
    ]),
  );

  const experienceSource = valueAt(data, [
    "workExperience",
    "experience",
    "employment",
    "employmentHistory",
    "positions",
  ]);
  const experience = asArray(experienceSource)
    .map((item) => {
      const obj = asRecord(item) || {};
      const org = valueAt(obj, [
        "organization",
        "company",
        "employer",
        "employerName",
        "organizationName",
      ]);
      const dates = valueAt(obj, ["dates", "dateRange", "period", "duration"]);
      return {
        title: pickFirstText(
          valueAt(obj, ["jobTitle", "title", "position", "role"]),
        ),
        company: pickFirstText(org),
        location: pickFirstText(valueAt(obj, ["location", "address"])),
        dates: pickFirstText(dates, [
          valueAt(obj, ["startDate", "from"]),
          valueAt(obj, ["endDate", "to"]),
        ]),
        bullets: unique(
          [
            ...splitBullets(
              valueAt(obj, [
                "jobDescription",
                "description",
                "responsibilities",
                "achievements",
                "text",
                "summary",
              ]),
            ),
            ...pickArrayText(
              valueAt(obj, ["bulletPoints", "bullets", "tasks"]),
              8,
            ),
          ],
          8,
        ),
      };
    })
    .filter((item) => item.title || item.company || item.bullets.length)
    .slice(0, 12);

  const educationSource = valueAt(data, [
    "education",
    "educationHistory",
    "qualifications",
  ]);
  const education = asArray(educationSource)
    .map((item) => {
      const obj = asRecord(item) || {};
      const accreditation = asRecord(
        valueAt(obj, ["accreditation", "degree", "qualification"]),
      );
      const org = valueAt(obj, [
        "organization",
        "institution",
        "school",
        "university",
        "organizationName",
      ]);
      return {
        degree: pickFirstText(
          valueAt(obj, [
            "degree",
            "qualification",
            "title",
            "course",
            "education",
          ]),
          accreditation?.education,
          accreditation?.inputStr,
        ),
        institution: pickFirstText(org),
        location: pickFirstText(valueAt(obj, ["location", "address"])),
        dates: pickFirstText(valueAt(obj, ["dates", "dateRange", "period"]), [
          valueAt(obj, ["startDate", "from"]),
          valueAt(obj, ["endDate", "to"]),
        ]),
      };
    })
    .filter((item) => item.degree || item.institution)
    .slice(0, 10);

  const skills = unique(
    [
      ...pickArrayText(
        valueAt(data, ["skills", "skill", "competencies", "technicalSkills"]),
        80,
      ),
      ...pickArrayText(valueAt(data, ["professionSkills", "parsedSkills"]), 80),
    ],
    80,
  ).filter(
    (skill) =>
      !SECTION_OR_FAKE_NAME_RE.test(skill) ||
      /python|sql|tableau|matplotlib|seaborn|tensorflow|sklearn/i.test(skill),
  );

  const projects = asArray(
    valueAt(data, ["projects", "projectExperience", "accomplishments"]),
  )
    .map((item) => {
      const obj = asRecord(item) || {};
      return {
        name:
          pickFirstText(valueAt(obj, ["name", "title", "projectName"])) ||
          deepText(item),
        bullets: splitBullets(
          valueAt(obj, ["description", "summary", "text", "bullets"]),
        ),
      };
    })
    .filter((item) => item.name)
    .slice(0, 10);

  const languages = pickArrayText(
    valueAt(data, ["languages", "languageSkills"]),
    20,
  );
  const certifications = pickArrayText(
    valueAt(data, [
      "certifications",
      "certificates",
      "licenses",
      "accreditations",
    ]),
    20,
  );

  const profile = {
    rawText,
    basics: {
      name: lockedName || parserName || "",
      headline: headline || experience[0]?.title || "Professional",
      email,
      phone,
      location,
      linkedin,
    },
    summary,
    experience,
    education,
    skills,
    projects,
    languages,
    certifications,
    strengths: [],
    additionalEvidence: [],
    warnings: [],
    previewText: rawText.slice(0, 1200),
  } as ResumeProfile;

  // Keep Affinda structure but never override a valid parser-provided name.
  const repaired = repairResumeProfileAfterParsing(profile, rawText, fileName);
  const existing = validateCandidateName(repaired.basics?.name || "");
  if (existing) {
    return { ...repaired, basics: { ...repaired.basics, name: existing } } as ResumeProfile;
  }
  return enforceCanonicalCandidateName(repaired, rawText, fileName, "") as ResumeProfile;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAffindaDocument(
  identifier: string,
  headers: HeadersInit,
  baseUrl: string,
) {
  const response = await fetch(
    `${baseUrl}/v3/documents/${encodeURIComponent(identifier)}`,
    { headers, cache: "no-store" },
  );
  if (!response.ok)
    throw new Error(
      `Affinda fetch failed (${response.status}): ${await response.text()}`,
    );
  return response.json();
}

function affindaIsReady(document: unknown) {
  const obj = asRecord(document) || {};
  const status = cleanText(
    valueAt(obj, ["status", "processingStatus", "state"]),
  ).toLowerCase();
  if (!status) return true;
  return [
    "ready",
    "complete",
    "completed",
    "success",
    "done",
    "processed",
  ].includes(status);
}

async function parseWithAffinda(input: {
  buffer: Buffer;
  fileName: string;
  fileType: string;
  rawText: string;
}): Promise<AffindaResult> {
  const apiKey = process.env.AFFINDA_API_KEY?.trim();
  const workspace = process.env.AFFINDA_WORKSPACE_ID?.trim();
  const documentType = process.env.AFFINDA_DOCUMENT_TYPE_ID?.trim();
  const organization = process.env.AFFINDA_ORGANIZATION_ID?.trim();
  const baseUrl = (
    process.env.AFFINDA_API_BASE || "https://api.eu1.affinda.com"
  ).replace(/\/+$/, "");

  if (!apiKey || !workspace) {
    return {
      ok: false,
      source: "affinda_not_configured",
      error: "AFFINDA_API_KEY or AFFINDA_WORKSPACE_ID is missing.",
    };
  }

  try {
    const headers = { Authorization: `Bearer ${apiKey}` };
    const formData = new FormData();
    const fileBlob = new Blob([new Uint8Array(input.buffer)], {
      type: input.fileType || "application/pdf",
    });
    formData.append("file", fileBlob, input.fileName);
    formData.append("workspace", workspace);
    if (documentType) formData.append("documentType", documentType);
    if (organization) formData.append("organization", organization);
    formData.append("wait", "true");

    const upload = await fetch(`${baseUrl}/v3/documents`, {
      method: "POST",
      headers,
      body: formData,
      cache: "no-store",
    });

    if (!upload.ok) {
      return {
        ok: false,
        source: "affinda_failed",
        error: `Affinda upload failed (${upload.status}): ${await upload.text()}`,
      };
    }

    let document = await upload.json();
    const identifier = cleanText(
      valueAt(asRecord(document), ["identifier", "id"]),
    );

    // Some Affinda configurations return before parsing is complete.
    for (
      let attempt = 0;
      identifier && !affindaIsReady(document) && attempt < 20;
      attempt += 1
    ) {
      await sleep(750);
      document = await fetchAffindaDocument(identifier, headers, baseUrl);
    }

    const resumeProfile = mapAffindaProfile(
      document,
      input.rawText,
      input.fileName,
    );

    // Diagnostic: log actual Affinda response structure so we can confirm the data path
    const rootKeys = Object.keys(asRecord(document) || {}).join(",");
    const dataKeys = Object.keys(asRecord((asRecord(document) || {}).data) || {}).join(",");
    const datadataKeys = Object.keys(asRecord(asRecord((asRecord(document) || {}).data)?.data) || {}).join(",");
    console.log(`[api/cv] Affinda mapped: exp=${resumeProfile.experience?.length ?? 0} edu=${resumeProfile.education?.length ?? 0} skills=${resumeProfile.skills?.length ?? 0} | root=[${rootKeys.slice(0, 100)}] data=[${dataKeys.slice(0, 100)}] data.data=[${datadataKeys.slice(0, 100)}]`);

    return {
      ok: true,
      source: "affinda_resume_parser",
      resumeProfile,
      raw: document,
    };
  } catch (error) {
    return {
      ok: false,
      source: "affinda_failed",
      error: error instanceof Error ? error.message : "Affinda parser failed.",
    };
  }
}

function isProfileUsable(profile: ResumeProfile | undefined | null) {
  if (!profile) return false;
  const basics = profile.basics || {};
  const name = (basics.name || "").trim();
  const expCount = Array.isArray(profile.experience) ? profile.experience.length : 0;
  const eduCount = Array.isArray(profile.education) ? profile.education.length : 0;

  // Must have at least one structured section (experience OR education).
  // Skills-only results mean the parser found keyword lists but missed the CV
  // structure — confirmed from live logs where Affinda returned name + skills
  // but experience:[] education:[] for decorative PDF templates.
  if (expCount === 0 && eduCount === 0) return false;

  // Must have a name that isn't a section heading or placeholder.
  if (!name) return false;
  const PLACEHOLDER = /^(candidate|professional|selected project|unknown|n\/a|testing and debugging|projects?|education|skills?|experience)$/i;
  if (PLACEHOLDER.test(name)) return false;

  return true;
}

function profileQualityScore(profile: ResumeProfile | undefined | null) {
  if (!profile) return -1000;
  let score = 0;
  const name = validateCandidateName(profile.basics?.name || "");
  const email = String(profile.basics?.email || "").trim();
  const phone = String(profile.basics?.phone || "").trim();
  const headline = String(profile.basics?.headline || "").trim();
  const expCount = Array.isArray(profile.experience) ? profile.experience.length : 0;
  const eduCount = Array.isArray(profile.education) ? profile.education.length : 0;
  const skillsCount = Array.isArray(profile.skills) ? profile.skills.length : 0;
  const projectsCount = Array.isArray(profile.projects) ? profile.projects.length : 0;
  const languagesCount = Array.isArray(profile.languages) ? profile.languages.length : 0;

  if (name) score += 60;
  else score -= 90;
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) score += 35;
  if (phone.replace(/\D/g, "").length >= 7 && !isInvalidPhoneValue(phone)) score += 15;
  if (isInvalidPhoneValue(phone)) score -= 35;
  if (headline && headline.length <= 120) score += 15;
  if (expCount > 0) score += expCount * 35;
  else score -= 40;
  if (eduCount > 0) score += eduCount * 20;
  if (skillsCount > 0) score += Math.min(skillsCount, 25) * 4;
  if (projectsCount > 0) score += projectsCount * 18;
  if (languagesCount > 0) score += Math.min(languagesCount, 5) * 4;

  const experienceLooksCorrupted = (profile.experience || []).some((exp) => {
    const title = String(exp.title || "").trim();
    const company = String(exp.company || "").trim();
    return Boolean(
      (title && company && title.toLowerCase() === company.toLowerCase()) ||
      /^\d{4}|^(jan|feb|mar|apr)/i.test(title) ||
      (/\//.test(title) && title.length > 40)
    );
  });
  if (experienceLooksCorrupted) score -= 80;
  if (headline.length > 140 || /^(managed|assisted|supported|led|coordinated)\b/i.test(headline)) score -= 45;
  return score;
}

function buildProfileText(profile: ResumeProfile, fallbackText: string) {
  const lines: string[] = [];
  const basics = profile.basics || {};

  if (basics.name) lines.push(`Candidate name: ${basics.name}`);
  if (basics.headline) lines.push(`Headline: ${basics.headline}`);
  const contact = [basics.email, basics.phone, basics.location, basics.linkedin]
    .filter(Boolean)
    .join(" • ");
  if (contact) lines.push(`Contact: ${contact}`);
  if (profile.summary) lines.push(`Summary: ${profile.summary}`);

  if (profile.experience?.length) {
    lines.push("Experience:");
    profile.experience.slice(0, 8).forEach((job) => {
      const header = [job.title, job.company, job.dates]
        .filter(Boolean)
        .join(" • ");
      if (header) lines.push(`- ${header}`);
      job.bullets?.slice(0, 6).forEach((bullet) => lines.push(`  • ${bullet}`));
    });
  }

  if (profile.education?.length) {
    lines.push("Education:");
    profile.education.slice(0, 5).forEach((edu) => {
      const header = [edu.degree, edu.institution, edu.dates]
        .filter(Boolean)
        .join(" • ");
      if (header) lines.push(`- ${header}`);
    });
  }

  if (profile.skills?.length)
    lines.push(`Skills: ${profile.skills.slice(0, 40).join(", ")}`);
  if (profile.projects?.length) {
    lines.push("Projects:");
    profile.projects.slice(0, 6).forEach((project) => {
      if (project.name) lines.push(`- ${project.name}`);
      project.bullets
        ?.slice(0, 4)
        .forEach((bullet) => lines.push(`  • ${bullet}`));
    });
  }
  if (profile.languages?.length)
    lines.push(`Languages: ${profile.languages.join(", ")}`);
  if (profile.certifications?.length)
    lines.push(`Certifications: ${profile.certifications.join(", ")}`);

  return lines.join("\n").trim() || fallbackText;
}

function lockResumeProfileIdentity(input: {
  profile: ResumeProfile;
  rawText: string;
  fileName?: string;
  candidateName?: string;
}) {
  const profile = { ...(input.profile || {}) } as ResumeProfile;
  profile.basics = { ...(profile.basics || {}) };

  // Never override a valid parser name. Recovery is allowed only when the name
  // is missing/invalid. This prevents global post-processing from turning real
  // names into section headings, project headers, or skill phrases.
  const existing = validateCandidateName(profile.basics.name || "");
  if (existing) {
    profile.basics.name = existing;
    (profile as ResumeProfile & { name?: string }).name = existing;
    return profile;
  }

  return enforceCanonicalCandidateName(
    profile,
    input.rawText,
    input.fileName || "",
    input.candidateName || "",
  ) as ResumeProfile;
}

function lockParserResultIdentity<T extends { resumeProfile?: ResumeProfile }>(
  result: T,
  context: { rawText: string; fileName?: string; candidateName?: string },
): T {
  if (!result?.resumeProfile) return result;

  const lockedProfile = lockResumeProfileIdentity({
    profile: result.resumeProfile,
    rawText: context.rawText,
    fileName: context.fileName,
    candidateName: context.candidateName,
  });

  return {
    ...result,
    resumeProfile: lockedProfile,
  };
}


function sanitizeProfileForResponse(profile: ResumeProfile, rawText: string, fileName = ''): ResumeProfile {
  const repaired = repairResumeProfileAfterParsing(profile, rawText, fileName);
  const headline = (repaired.basics?.headline || '').trim();
  const experience = Array.isArray(repaired.experience) ? repaired.experience : [];
  const safeHeadline = (() => {
    if (!headline) return experience[0]?.title || 'Professional';
    const words = headline.split(/\s+/).filter(Boolean).length;
    const sentenceLike = headline.length > 150 || (words > 14 && /\b(with|and|for|to|that|which|after|before|because|while|where|using|leading|improving|supporting|managing|developing|creating|providing)\b/i.test(headline));
    const bulletLike = /^(led|managed|assisted|supported|coordinated|created|developed|implemented|improved|provided|responsible|collaborated|conducted)\b/i.test(headline) && headline.length > 60;
    return sentenceLike || bulletLike ? (experience[0]?.title || 'Professional') : headline;
  })();
  return {
    ...repaired,
    basics: {
      ...repaired.basics,
      headline: safeHeadline,
    },
  } as ResumeProfile;
}

function buildResponse(input: {
  aiOk: boolean;
  source: string;
  error: string;
  rawCvText: string;
  resumeProfile: ResumeProfile;
  fileName?: string;
  candidateName?: string;
  jobDescription?: string;
  targetRole?: string;
  targetMarket?: string;
}) {
  const lockedAndRepairedProfile = sanitizeProfileForResponse(lockResumeProfileIdentity({
    profile: input.resumeProfile,
    rawText: input.rawCvText,
    fileName: input.fileName || "",
    candidateName: input.candidateName || "",
  }), input.rawCvText, input.fileName || "");

  // Final global guard: run the canonical validator AFTER legacy repair/identity
  // locking. Some legacy repair functions can reintroduce invalid values (for
  // example dates as phone numbers or education rows inside experience), so the
  // last object returned to frontend/interview must always be validated here.
  const resumeProfile = mergeCvProfile({
    parsedProfile: lockedAndRepairedProfile as any,
    rawText: input.rawCvText,
    fileName: input.fileName || "",
    requestBody: {
      candidateName: input.candidateName || "",
      fileName: input.fileName || "",
    },
  }) as ResumeProfile;

  const cleanProfileText = buildProfileText(resumeProfile, input.rawCvText);

  // IMPORTANT v7 safety fix:
  // The parser may return aiOk=false when it used a fallback or when OpenRouter/Affinda
  // had a non-fatal issue. The UI was treating that as a hard upload failure and showed
  // "CV extraction failed" even when we had a perfectly usable profile and raw CV text.
  // Upload should fail only when we truly have no usable CV data. Otherwise return ok=true
  // and keep parser issues as non-blocking warnings.
  const profileUsable = isProfileUsable(resumeProfile);
  const hasRawCvText = Boolean(input.rawCvText && input.rawCvText.trim().length > 80);
  const responseOk = Boolean(profileUsable || hasRawCvText);
  const nonBlockingError = responseOk ? "" : input.error;
  const warnings = [
    ...((resumeProfile.warnings || []) as string[]),
    ...(input.error && responseOk ? [input.error] : []),
  ].filter(Boolean);
  const safeResumeProfile = {
    ...resumeProfile,
    warnings,
  } as ResumeProfile;

  return NextResponse.json({
    ok: responseOk,
    success: responseOk,
    source: input.source,
    error: nonBlockingError,
    warning: input.error && responseOk ? input.error : "",
    text: input.rawCvText,
    cvText: cleanProfileText,
    rawCvText: input.rawCvText,
    uploadedCvText: input.rawCvText,
    resumeText: cleanProfileText,
    candidateCv: cleanProfileText,
    content: input.rawCvText,
    resumeProfile: safeResumeProfile,
    profile: safeResumeProfile,
    fileName: input.fileName,
    candidateName: safeResumeProfile.basics?.name || "",
    chars: input.rawCvText.length,
    recruiterMemoryProfile: {
      candidateName: safeResumeProfile.basics?.name || "",
      candidateHeadline: safeResumeProfile.basics?.headline || "",
      candidateEmail: safeResumeProfile.basics?.email || "",
      candidatePhone: safeResumeProfile.basics?.phone || "",
      candidateLocation: safeResumeProfile.basics?.location || "",
      candidateLinkedin: safeResumeProfile.basics?.linkedin || "",
      summary: safeResumeProfile.summary || "",
      skills: safeResumeProfile.skills || [],
      experience: safeResumeProfile.experience || [],
      education: safeResumeProfile.education || [],
      projects: safeResumeProfile.projects || [],
      languages: safeResumeProfile.languages || [],
      certifications: safeResumeProfile.certifications || [],
    },
    jobMemoryProfile: {
      targetRole:
        input.targetRole || safeResumeProfile.basics?.headline || "General Role",
      targetMarket: input.targetMarket || "Global",
      jobDescription: input.jobDescription || "",
    },
  });
}

async function buildMemoryFromJson(body: RequestBody, isPremium: boolean) {
  const rawCv = normalizeCvText(
    String(
      body.rawCvText ||
        body.uploadedCvText ||
        body.layoutText ||
        body.cvText ||
        "",
    ),
  );
  const jd = normalizeResumeText(String(body.jobDescription || ""));
  const existingProfile = body.resumeProfile || body.profile;
  // Normalize fileName from JSON body — client may send triple-extension names
  // like "candidate-name.pdf.pdf.pdf" from repeated re-parse cycles.
  if (body.fileName) {
    body = {
      ...body,
      fileName: normalizeUploadFileName(body.fileName),
    };
  }

  const isImprovementRequest = body.mode === "improve";
  if (isImprovementRequest && !isPremium) {
    return NextResponse.json(
      {
        error: "upgrade_required",
        requiredPlan: "premium",
        message: "CV improvement requires Premium.",
      },
      { status: 403 },
    );
  }

  if (
    existingProfile &&
    typeof existingProfile === "object" &&
    "basics" in existingProfile &&
    rawCv
  ) {
    const incoming = existingProfile as ResumeProfile;

    // Validate the incoming profile before trusting it.
    // A profile stored in client localStorage may be corrupted from a previous
    // bad parse: phone numbers in the email field, dates in the location field,
    // job descriptions in the headline, etc.
    // We validate by checking structural sanity, not just name presence.
    const incomingName = (incoming.basics?.name || "").trim();
    const incomingValidName = validateCandidateName(incomingName);
    const incomingEmail = (incoming.basics?.email || "").trim();
    const incomingPhone = (incoming.basics?.phone || "").trim();
    const incomingHeadline = (incoming.basics?.headline || "").trim();
    const incomingExperience = Array.isArray(incoming.experience) ? incoming.experience : [];

    // Red flags that indicate a corrupted profile:
    const emailLooksCorrupted =
      /^\+?\d[\d\s\-()+]{4,}/.test(incomingEmail) || // starts with phone number
      incomingEmail.includes(" ") || // has spaces
      (incomingEmail.length > 0 && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(incomingEmail));

    const phoneLooksCorrupted =
      isInvalidPhoneValue(incomingPhone) ||
      /^\d{4}[-/]\d{4}/.test(incomingPhone) || // looks like date range
      /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(incomingPhone);

    const headlineLooksCorrupted =
      incomingHeadline.length > 180 || // very long paragraph, not a headline
      (/^(managed|assisted|supported|led|coordinated|implemented|developed|created|provided)/i.test(incomingHeadline) && incomingHeadline.length > 70); // starts with verb + sentence-length = likely job bullet

    const experienceLooksCorrupted = incomingExperience.some((exp) => {
      const titleIsCompany = exp.title && exp.company && exp.title === exp.company;
      const titleIsDate = /^\d{4}|^(jan|feb|mar|apr)/i.test(exp.title || "");
      const titleHasSlash = /\//.test(exp.title || "") && (exp.title || "").length > 40;
      return titleIsCompany || titleIsDate || titleHasSlash;
    });

    const nameLooksCorrupted = Boolean(incomingName && !incomingValidName);
    const profileNameMissingFromRaw = Boolean(
      incomingValidName &&
      rawCv.length > 200 &&
      !identityAppearsInRawCv(rawCv, incomingValidName)
    );

    const profileIsCorrupted =
      nameLooksCorrupted ||
      profileNameMissingFromRaw ||
      emailLooksCorrupted ||
      phoneLooksCorrupted ||
      headlineLooksCorrupted ||
      experienceLooksCorrupted;

    // Cross-person identity check: if the cached profile's email is a real email
    // but doesn't appear anywhere in the raw CV text, this profile is from a
    // DIFFERENT person's CV. This is the confirmed cross-contamination pattern:
    // the client sends stale cached profile data (e.g. Olivia Wilson's profile)
    // when a different person's CV has just been uploaded.
    // The email is the most reliable identity anchor — it's unique, precise, and
    // always extracted verbatim from the CV text (unlike names which may vary in
    // formatting). Only apply this check when the incoming profile has a valid
    // email AND the raw CV has enough text to be meaningful.
    const profileBelongsToDifferentPerson =
      !profileIsCorrupted &&
      incomingEmail &&
      /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(incomingEmail) &&
      rawCv.length > 200 &&
      !rawCv.toLowerCase().includes(incomingEmail.toLowerCase());

    if (profileBelongsToDifferentPerson) {
      console.warn("[WorkZo CV Pipeline] api.cv.json.stale_profile_rejected — profile email not found in CV text, re-parsing", {
        profileEmail: incomingEmail,
        profileName: incomingName,
        rawCvLength: rawCv.length,
        fileName: body.fileName || "(no fileName in request body)",
      });
      // Fall through to fresh AI parse — treat like a corrupted profile
    } else if (profileIsCorrupted) {
      // Re-parse properly instead of using the corrupted cached profile
      console.warn("[WorkZo CV Pipeline] api.cv.json.corrupted_profile_rejected", {
        name: incomingName,
        emailCorrupted: emailLooksCorrupted,
        phoneCorrupted: phoneLooksCorrupted,
        headlineCorrupted: headlineLooksCorrupted,
        nameCorrupted: nameLooksCorrupted,
        profileNameMissingFromRaw,
        experienceCorrupted: experienceLooksCorrupted,
      });
      // Fall through to fresh AI parse below
    } else {
      // Profile looks clean — use it but still run through lockResumeProfileIdentity
      // to normalize any minor issues (encoding artifacts, trailing whitespace, etc.)
      const profile = incoming;
      debugCvProfile("api.cv.json.existing_profile_used", profile, {
        name: profile.basics?.name,
      });
      return buildResponse({
        aiOk: true,
        source: "existing_resume_profile",
        error: "",
        rawCvText: rawCv,
        resumeProfile: profile,
        fileName: body.fileName || "pasted-cv.txt",
        candidateName: body.candidateName || incomingName,
        jobDescription: jd,
        targetRole: body.targetRole,
        targetMarket: body.targetMarket,
      });
    }
  }

  if (!rawCv && !jd)
    return NextResponse.json(
      { error: "CV text or job description is required." },
      { status: 400 },
    );

  // JD-only is valid onboarding context. Do not run the CV parser when there is no CV.
  // This prevents false upload errors like "CV text is required" when the user only
  // adds a job description or opens/saves the context modal before uploading a CV.
  if (!rawCv && jd) {
    return NextResponse.json({
      ok: true,
      success: true,
      source: "job_description_only",
      error: "",
      text: "",
      cvText: "",
      rawCvText: "",
      uploadedCvText: "",
      resumeText: "",
      candidateCv: "",
      content: "",
      resumeProfile: null,
      profile: null,
      fileName: body.fileName || "",
      chars: 0,
      recruiterMemoryProfile: null,
      jobMemoryProfile: {
        targetRole: body.targetRole || "General Role",
        role: body.targetRole || "General Role",
        targetMarket: body.targetMarket || "Global",
        country: body.targetMarket || "Global",
        jobDescription: jd,
        jdText: jd,
      },
      confidence: "skipped",
    });
  }

  // Same defensive wrapping as the file-upload path above — protects
  // against the OpenAI SDK throwing an uncaught error when OpenRouter
  // returns a malformed response body, which otherwise crashes this
  // route with a raw 500 instead of degrading to the local fallback.
  let aiResult;
  if (looksLikeDerivedCvContext(rawCv)) {
    console.warn(
      `[api/cv] buildMemoryFromJson received derived CV context text (not raw CV text) — skipping AI re-structuring. fileName=${body.fileName || "(none)"}`,
    );
    const localProfile = repairResumeProfileAfterParsing(
      extractResumeProfileComplex(rawCv),
      rawCv,
      body.fileName || "pasted-cv.txt",
    );

    // The derived context format ("Candidate name: ...\nExperience:\n- ...") has
    // no raw PDF name pattern, so local extraction almost always returns ''.
    // body.candidateName IS the correctly-parsed name from the real file parse
    // that just finished — use it directly rather than re-extracting from text
    // that was never meant to be re-parsed.
    const resolvedName = (body.candidateName || "").trim() || localProfile.basics?.name || "";

    // Guard against a full summary sentence bleeding into headline
    // (e.g. "Results-driven Accounting Executive with a proven record...").
    // A real headline is a job title, not a paragraph.
    const resolvedHeadline = (() => {
      const h = localProfile.basics?.headline || "";
      if (h.length > 80 || h.split(" ").length > 8) return "";
      return h;
    })();

    aiResult = {
      ok: false,
      source: "local_fallback_derived_context_detected",
      resumeProfile: {
        ...localProfile,
        basics: {
          ...localProfile.basics,
          name: resolvedName,
          headline: resolvedHeadline,
        },
      },
      error: "Input text was a derived CV summary — used local extraction with provided candidateName.",
    };
  } else {
  try {
    // Check cache before calling AI — same CV text skips the 10-15s parse
    const _cacheKey = cvCacheKey(rawCv);
    const _cached = cvCacheGet(_cacheKey);
    if (_cached) {
      console.info("[WorkZo CV Pipeline] api.cv.json.cache_hit", { fileName: body.fileName, cacheKey: _cacheKey });
      aiResult = _cached;
    } else {
      aiResult = await parseResumeWithAiStructure({
        cvText: rawCv,
        layoutText: rawCv,
        fileName: body.fileName || "pasted-cv.txt",
        jobDescription: jd,
        targetRole: body.targetRole,
        targetMarket: body.targetMarket,
        language: body.language,
      });
      if (aiResult.ok) cvCacheSet(_cacheKey, aiResult);
    }
  } catch (aiError) {
    console.error("api.cv.json.ai_parser_uncaught_error", aiError);
    const localProfile = repairResumeProfileAfterParsing(
      extractResumeProfileComplex(rawCv),
      rawCv,
      body.fileName || "pasted-cv.txt",
    );
    aiResult = {
      ok: false,
      source: "local_fallback_ai_uncaught_error",
      resumeProfile: localProfile,
      error: aiError instanceof Error ? aiError.message : "AI CV parser crashed unexpectedly.",
    };
  }
  }

  aiResult = lockParserResultIdentity(aiResult, {
    rawText: rawCv,
    fileName: body.fileName || "pasted-cv.txt",
    candidateName: body.candidateName || "",
  });

  debugCvProfile("api.cv.json.profile", aiResult.resumeProfile, {
    source: aiResult.source,
    ok: aiResult.ok,
    name: aiResult.resumeProfile.basics?.name,
    // BUG INVESTIGATION: fileName was never logged here, which made it
    // impossible to tell whether a mismatched-looking result was genuine
    // cross-request data leakage or just confusing
    // interleaved console output from concurrent uploads. This field
    // settles it on the next test: if fileName here ever doesn't match
    // what was actually uploaded for this request, that confirms a real
    // bug in whatever client code calls this endpoint (it receives
    // body.rawCvText/cvText as given — this function doesn't fetch or
    // cache anything itself).
    fileName: body.fileName || "(no fileName in request body)",
  });

  return buildResponse({
    aiOk: aiResult.ok,
    source: aiResult.source,
    error: aiResult.error,
    rawCvText: rawCv,
    resumeProfile: aiResult.resumeProfile,
    fileName: body.fileName || "pasted-cv.txt",
    jobDescription: jd,
    targetRole: body.targetRole,
    targetMarket: body.targetMarket,
  });
}


function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}_timeout_after_${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function POST(request: Request) {
  let resolved;
  try {
    resolved = await resolveWorkZoServerPlan();
  } catch {
    return NextResponse.json(
      { error: "Could not resolve account plan." },
      { status: 500 },
    );
  }

  if (!resolved.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isPremium =
    resolved.plan === "premium" || resolved.plan === "premium_pro";

  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!(file instanceof File))
        return NextResponse.json(
          { error: "No file uploaded." },
          { status: 400 },
        );

      const safeFileName = normalizeUploadFileName(file.name);
      const fileType = (() => {
        if (file.type && file.type !== "application/octet-stream") return file.type;
        const n = safeFileName.toLowerCase();
        if (n.endsWith(".pdf"))  return "application/pdf";
        if (n.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        if (n.endsWith(".doc"))  return "application/msword";
        if (n.endsWith(".txt"))  return "text/plain";
        return file.type || "application/octet-stream";
      })();
      const buffer = Buffer.from(await file.arrayBuffer());
      const extracted = await extractFileTextFromBuffer(
        buffer,
        safeFileName,
        fileType,
      );
      debugCvText("api.cv.file_text.extracted", extracted, {
        fileName: safeFileName,
        fileType,
      });

      const cleanedCv = normalizeCvText(extracted);
      if (!cleanedCv.trim())
        return NextResponse.json(
          { error: "CV uploaded, but no readable text was found." },
          { status: 422 },
        );

      // Affinda disabled by default — set AFFINDA_ENABLED=true to re-enable.
      const affindaEnabled =
        process.env.AFFINDA_ENABLED === "true" &&
        Boolean(process.env.AFFINDA_API_KEY?.trim()) &&
        Boolean(process.env.AFFINDA_WORKSPACE_ID?.trim());
      let affinda: AffindaResult;
      if (!affindaEnabled) {
        affinda = { ok: false, source: "affinda_not_configured", error: "Affinda disabled" };
      } else {
        try {
          affinda = await parseWithAffinda({ buffer, fileName: safeFileName, fileType, rawText: cleanedCv });
        } catch (err) {
          console.warn("[api/cv] Affinda error:", err instanceof Error ? err.message : err);
          affinda = { ok: false, source: "affinda_failed", error: "Affinda threw" };
        }
      }

      if (affinda.ok && affinda.resumeProfile) {
        affinda.resumeProfile = lockResumeProfileIdentity({
          profile: affinda.resumeProfile,
          rawText: cleanedCv,
          fileName: safeFileName,
        });
      }

      let aiResult;
      // Check cache first — same file re-uploaded within 10 min skips the AI call
      const _uploadCacheKey = cvCacheKey(cleanedCv);
      const _uploadCached = cvCacheGet(_uploadCacheKey);
      if (_uploadCached) {
        console.info("[WorkZo CV Pipeline] api.cv.file.cache_hit", { fileName: safeFileName });
        aiResult = _uploadCached;
      } else {
      try {
        aiResult = await withTimeout(
          parseResumeWithAiStructure({
            cvText: cleanedCv,
            layoutText: cleanedCv,
            fileName: safeFileName,
          }),
          Number(process.env.WORKZO_CV_AI_TIMEOUT_MS || 42000),
          "ai_cv_parser",
        );
      } catch (aiError) {
        console.error("api.cv.ai_parser_uncaught_error", aiError);
        const localProfile = repairResumeProfileAfterParsing(
          extractResumeProfileComplex(cleanedCv),
          cleanedCv,
          safeFileName,
        );
        aiResult = {
          ok: false,
          source: "local_fallback_ai_uncaught_error",
          resumeProfile: localProfile,
          error: aiError instanceof Error ? aiError.message : "AI CV parser crashed unexpectedly.",
        };
      }
      if (aiResult && aiResult.ok) cvCacheSet(_uploadCacheKey, aiResult);
      } // end cache-miss block

      aiResult = lockParserResultIdentity(aiResult, {
        rawText: cleanedCv,
        fileName: safeFileName,
      });

      const aiScore = profileQualityScore(aiResult.resumeProfile);
      const affindaScore = profileQualityScore(affinda.resumeProfile);
      const useAffinda = Boolean(
        affinda.ok &&
        affinda.resumeProfile &&
        isProfileUsable(affinda.resumeProfile) &&
        !shouldRejectAffinda(affinda.resumeProfile) &&
        affindaScore > aiScore + 25
      );

      // Log Affinda outcome so we can distinguish parse failure from field-mapping failure
      if (affinda.ok && affinda.resumeProfile) {
        const aExp = affinda.resumeProfile.experience?.length ?? 0;
        const aEdu = affinda.resumeProfile.education?.length ?? 0;
        if (!useAffinda) {
          console.warn(`[api/cv] Affinda result rejected (exp=${aExp} edu=${aEdu} score=${affindaScore} aiScore=${aiScore}) — using AI parser. source=${affinda.source}`);
        }
      } else if (!affinda.ok && affinda.source !== "affinda_not_configured") {
        console.warn(`[api/cv] Affinda failed (${affinda.source}): ${affinda.error ?? "(no message)"}`);
      }

      if (useAffinda && affinda.resumeProfile) {
        debugCvPipeline("api.cv.parser.selection", {
          fileName: safeFileName,
          aiSource: aiResult.source,
          aiOk: aiResult.ok,
          aiScore,
          affindaSource: affinda.source,
          affindaOk: affinda.ok,
          affindaScore,
          selectedSource: affinda.source,
          selectedScore: affindaScore,
        });
        debugCvProfile("api.cv.parser.output", affinda.resumeProfile, {
          fileName: safeFileName,
          source: affinda.source,
          ok: true,
          score: affindaScore,
          name: affinda.resumeProfile.basics?.name,
        });
        return buildResponse({
          aiOk: true,
          source: affinda.source,
          error: "",
          rawCvText: cleanedCv,
          resumeProfile: affinda.resumeProfile,
          fileName: safeFileName,
        });
      }

      debugCvPipeline("api.cv.parser.selection", {
        fileName: safeFileName,
        aiSource: aiResult.source,
        aiOk: aiResult.ok,
        aiScore,
        affindaSource: affinda.source,
        affindaOk: affinda.ok,
        affindaScore,
        selectedSource: aiResult.source,
        selectedScore: aiScore,
      });

      debugCvProfile("api.cv.parser.output", aiResult.resumeProfile, {
        fileName: safeFileName,
        source: aiResult.source,
        ok: aiResult.ok,
        name: aiResult.resumeProfile.basics?.name,
      });

      return buildResponse({
        aiOk: aiResult.ok,
        source: aiResult.source,
        error: aiResult.error,
        rawCvText: cleanedCv,
        resumeProfile: aiResult.resumeProfile,
        fileName: safeFileName,
      });
    }

    const body = (await request.json().catch(() => ({}))) as RequestBody;
    return buildMemoryFromJson(body, isPremium);
  } catch (error) {
    console.error("WorkZo CV API failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not extract text from this CV.",
      },
      { status: 422 },
    );
  }
}
