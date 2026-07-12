/* WorkZo CV Engine V3.1 - Global Identity + Headline Guard
   Purpose: global, layout-agnostic identity protection.
   Key invariant: project text, skills, email, URLs, company names, section headers, or fallback OCR lines must never overwrite a valid human identity.
*/

export type IdentitySource =
  | "ai_parser"
  | "raw_header"
  | "vision_header"
  | "deterministic_layout"
  | "email_inference"
  | "filename";

export interface IdentityCandidate {
  source: IdentitySource;
  value: string | null | undefined;
  confidence?: number;
}

export interface IdentityDecision {
  selectedName: string;
  selectedNameSource: string;
  confidence: number;
  needsConfirmation: boolean;
  rejectedCandidates: string[];
}

const SECTION_WORDS = new Set([
  // English
  "about", "profile", "summary", "professional", "experience", "employment", "work", "history",
  "education", "skills", "skill", "expertise", "projects", "project", "certifications", "certification",
  "languages", "language", "contact", "contacts", "reference", "references", "awards", "achievement", "achievements",
  "training", "objective", "interests", "hobbies", "portfolio", "resume", "cv", "curriculum", "vitae",
  // German
  "kontakt", "profil", "profilübersicht", "berufserfahrung", "ausbildung", "bildungsweg", "kenntnisse",
  "fähigkeiten", "sprachen", "zertifikate", "zertifizierung", "referenzen", "erfolge", "kunden", "niveau",
  // French/Spanish/Italian/Portuguese common sections
  "profil", "expérience", "formation", "compétences", "langues", "références",
  "perfil", "experiencia", "educación", "habilidades", "idiomas", "referencias",
  "esperienza", "istruzione", "competenze", "lingue", "referenze",
  "experiência", "educação", "competências", "línguas", "referências",
]);

const ROLE_WORDS = new Set([
  "manager", "engineer", "developer", "designer", "analyst", "scientist", "consultant", "specialist",
  "administrator", "coordinator", "director", "lead", "intern", "trainee", "assistant", "support",
  "marketing", "sales", "project", "product", "data", "software", "graphic", "teacher", "accountant",
  "technician", "representative", "security", "cybersecurity", "ux", "ui", "it", "qa", "customer",
  "ingenieur", "spezialist", "technischer", "entwickler", "berater", "praktikant", "leiter", "verwaltung",
]);

const SKILL_WORDS = new Set([
  "python", "sql", "java", "javascript", "typescript", "react", "node", "tableau", "power", "bi", "excel",
  "figma", "photoshop", "illustrator", "canva", "creativity", "creative", "negotiation", "leadership",
  "teamwork", "communication", "management", "analytics", "analysis", "scraping", "web", "api", "nlp",
  "youtube", "tensorflow", "sklearn", "matplotlib", "seaborn", "aws", "azure", "gcp", "docker", "kubernetes",
  "active", "directory", "itil", "itsm", "seo", "sem", "campaign", "branding", "typography",
]);

const COMPANY_HINTS = /\b(inc|ltd|llc|gmbh|corp|corporation|company|studio|university|school|college|institute|technologies|solutions|systems|agency|partners|group|co\.?|s\.r\.l|pvt)\b/i;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const URL_RE = /(https?:\/\/|www\.|linkedin\.?com|github\.?com|behance\.?net|portfolio)/i;
const PHONE_RE = /(\+?\d[\d\s().-]{6,})/;
const DATE_RE = /\b(19|20)\d{2}\b|\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b|present|heute|aktuell/i;

function titleCaseName(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
    .trim();
}

export function healSpacedHeaders(rawText: string): string {
  if (!rawText) return "";
  return rawText
    .replace(/\u00a0/g, " ")
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      const tokens = trimmed.split(/\s+/).filter(Boolean);
      const singleLike = tokens.filter((t) => /^[\p{L}\d]$/u.test(t)).length;
      if (tokens.length >= 4 && singleLike / tokens.length >= 0.7) {
        const joined = tokens.join("");
        // Restore common two-word names/headers when the original line had a larger gap.
        const parts = trimmed.split(/\s{2,}/).map((p) => p.replace(/\s+/g, "").trim()).filter(Boolean);
        if (parts.length > 1) return parts.map(titleCaseName).join(" ");
        return titleCaseName(joined);
      }
      // Fix common OCR internal spacing inside words without destroying normal sentences.
      return line.replace(/\b([A-Za-z])\s(?=[a-z]{2,}\b)/g, "$1").replace(/\s{2,}/g, " ");
    })
    .join("\n");
}

function normalizeCandidate(value: string | null | undefined): string {
  if (!value) return "";
  return String(value)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[•·|]+/g, " ")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactSpacedName(value: string): string {
  const healed = healSpacedHeaders(value).trim();
  return normalizeCandidate(healed);
}

function words(value: string): string[] {
  return normalizeCandidate(value).toLowerCase().split(/[^\p{L}\d]+/u).filter(Boolean);
}

function looksLikeSectionOrNoise(value: string): boolean {
  const v = normalizeCandidate(value);
  const ws = words(v);
  if (!v || ws.length === 0) return true;
  if (/^(candidate|verified user|workzo candidate|unknown|n\/a|na)$/i.test(v)) return true;
  if (EMAIL_RE.test(v) || URL_RE.test(v) || PHONE_RE.test(v) || DATE_RE.test(v)) return true;
  if (v.length > 60 || v.length < 2) return true;
  if (/\d/.test(v)) return true;
  if (COMPANY_HINTS.test(v)) return true;
  // A name never contains a slash; a letter-spaced headline that got healed into
  // a blob ("IT Support Specialist / Data Analyst" -> "Itsupportspecialist/dataanalyst") does.
  if (/[\/\\]/.test(v)) return true;
  if (ws.every((w) => SECTION_WORDS.has(w))) return true;
  if (ws.some((w) => SECTION_WORDS.has(w)) && ws.length <= 4) return true;
  if (ws.every((w) => SKILL_WORDS.has(w))) return true;
  if (ws.filter((w) => SKILL_WORDS.has(w)).length >= Math.max(1, ws.length - 1)) return true;
  if (ws.some((w) => ROLE_WORDS.has(w)) && ws.length <= 4) return true;
  if (/^[A-Z\s]{2,}$/.test(v) && ws.length === 1 && v.length > 18) return true;
  // Concatenated OCR/section merges look like a SINGLE long token with an
  // internal lowercase->UPPERCASE transition (e.g. "NiveauAusbildung",
  // "ProfilBerufserfahrung"). The previous version stripped ALL whitespace
  // first, so every ordinary "Firstname Lastname" collapsed to
  // "FirstnameLastname" and its word boundary was mis-read as a merge — which
  // rejected essentially every real human name and forced identity
  // confirmation on almost every CV. Test each token individually instead, and
  // require length >= 12 so genuine mixed-case surnames (McDonald, MacArthur,
  // DeAngelo) are never flagged.
  if (
    ws.length <= 3 &&
    normalizeCandidate(v)
      .split(/\s+/)
      .some(
        (tok) =>
          tok.replace(/[^\p{L}]/gu, "").length >= 12 && /\p{Ll}\p{Lu}/u.test(tok),
      )
  )
    return true;
  if (/ausbildung|berufserfahrung|profil|kontakt|skills|experience|education|summary/i.test(v) && ws.length <= 4) return true;
  return false;
}

function looksLikeHumanName(value: string): boolean {
  const v = compactSpacedName(value);
  const ws = words(v);
  if (looksLikeSectionOrNoise(v)) return false;
  if (ws.length < 2 || ws.length > 4) return false;
  if (ws.some((w) => w.length < 2 && ws.length > 1)) return false;
  const alphaRatio = (v.match(/[\p{L}]/gu)?.length || 0) / Math.max(1, v.length);
  if (alphaRatio < 0.65) return false;
  return true;
}

// A single-word name (mononym). Many people legitimately have one-word names
// (e.g. "Prince", "Madonna", and many Indonesian, Tamil, or Brazilian names), so
// a one-word header line must not be auto-rejected. This stays strict — it
// reuses the same structural noise filter that rejects section, skill, role, and
// company tokens — so it accepts a bare given name without ever grabbing a
// headline ("Analyst"), a skill ("Python"), or a section word.
function looksLikeMononymName(value: string): boolean {
  const v = compactSpacedName(value);
  const ws = words(v);
  if (ws.length !== 1) return false;
  if (looksLikeSectionOrNoise(v)) return false;
  const tok = ws[0];
  if (tok.length < 2 || tok.length > 20) return false;
  const alphaRatio = (v.match(/[\p{L}]/gu)?.length || 0) / Math.max(1, v.length);
  if (alphaRatio < 0.85) return false;
  if (!/^\p{Lu}/u.test(v)) return false; // a name starts with a capital
  return true;
}

function canonicalNameKey(value: string): string {
  return words(value).join(" ");
}

function candidateScore(c: IdentityCandidate): { value: string; source: IdentitySource; score: number; valid: boolean } {
  const value = compactSpacedName(c.value || "");
  const valid = looksLikeHumanName(value) || looksLikeMononymName(value);
  if (!valid) return { value, source: c.source, score: 0, valid: false };
  const base = typeof c.confidence === "number" ? c.confidence : 0.5;
  const weight: Record<IdentitySource, number> = {
    ai_parser: 1.0,
    raw_header: 0.92,
    vision_header: 0.95,
    deterministic_layout: 0.82,
    email_inference: 0.28,
    filename: 0.18,
  };
  return { value: titleCaseName(value), source: c.source, score: base * weight[c.source], valid };
}

function inferNameFromEmail(email?: string | null): string {
  if (!email || !EMAIL_RE.test(email)) return "";
  const local = email.split("@")[0].replace(/[._-]+/g, " ").replace(/\d+/g, " ").trim();
  return looksLikeHumanName(local) ? titleCaseName(local) : "";
}

function inferNameFromFilename(filename?: string | null): string {
  if (!filename) return "";
  const clean = filename
    .replace(/\.(pdf|docx?|txt)$/i, "")
    .replace(/copy of|resume|cv|curriculum|vitae|template|minimalist|professional|graphic|designer|white|black|beige|untitled|design|workzo|parsed/gi, " ")
    .replace(/[()\[\]\d_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return looksLikeHumanName(clean) ? titleCaseName(clean) : "";
}

export function extractHeaderNameCandidates(text: string): string[] {
  const healed = healSpacedHeaders(text || "");
  const allLines = healed.split(/\r?\n/).map(normalizeCandidate).filter(Boolean);
  // Bound the scan to the header block — everything ABOVE the first section
  // header. Otherwise the scan reaches into sections like "CORE SKILLS" and a
  // skill line ("Team Collaboration") can be picked as the candidate's name. A
  // section header here is a short line that contains a section word (this also
  // catches "CORE SKILLS", where "core" is not itself a section word).
  const isSectionHeader = (l: string) => {
    const ws = words(l);
    return ws.length >= 1 && ws.length <= 3 && ws.some((w) => SECTION_WORDS.has(w));
  };
  const firstSection = allLines.findIndex(isSectionHeader);
  const lines = (firstSection >= 0 ? allLines.slice(0, firstSection) : allLines).slice(0, 35);

  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (looksLikeHumanName(line)) out.push(titleCaseName(line));
    // Joined two-line names such as "BEN" / "HARRINGTON".
    if (i + 1 < lines.length) {
      const joined = `${line} ${lines[i + 1]}`;
      if (looksLikeHumanName(joined)) out.push(titleCaseName(joined));
    }
  }

  // Mononym fallback: only when no multi-word name was found in the header block,
  // accept a one-word name from the first non-contact line. Bounded this tightly
  // so it never fires when a normal two-part name is present.
  if (!out.length) {
    const firstContent = lines.find((l) => !EMAIL_RE.test(l) && !URL_RE.test(l) && !PHONE_RE.test(l));
    if (firstContent && looksLikeMononymName(firstContent)) out.push(titleCaseName(firstContent));
  }

  return Array.from(new Set(out));
}

export function determineCanonicalIdentity(input: {
  aiName?: string | null;
  rawText?: string | null;
  fileName?: string | null;
  email?: string | null;
  visionName?: string | null;
}): IdentityDecision {
  const rejected = new Set<string>();
  const candidates: IdentityCandidate[] = [];

  if (input.aiName) candidates.push({ source: "ai_parser", value: input.aiName, confidence: 0.94 });
  if (input.visionName) candidates.push({ source: "vision_header", value: input.visionName, confidence: 0.9 });
  for (const h of extractHeaderNameCandidates(input.rawText || "")) {
    candidates.push({ source: "raw_header", value: h, confidence: 0.88 });
  }
  const emailName = inferNameFromEmail(input.email || "");
  if (emailName) candidates.push({ source: "email_inference", value: emailName, confidence: 0.6 });
  const fileName = inferNameFromFilename(input.fileName || "");
  if (fileName) candidates.push({ source: "filename", value: fileName, confidence: 0.45 });

  const scored = candidates.map(candidateScore);
  for (const s of scored) {
    if (!s.valid && s.value) rejected.add(s.value);
  }

  const grouped = new Map<string, { name: string; score: number; sources: Set<string> }>();
  for (const s of scored.filter((x) => x.valid)) {
    const key = canonicalNameKey(s.value);
    const prev = grouped.get(key) || { name: s.value, score: 0, sources: new Set<string>() };
    prev.score += s.score;
    prev.sources.add(s.source);
    grouped.set(key, prev);
  }

  const best = Array.from(grouped.values()).sort((a, b) => b.score - a.score)[0];
  if (!best) {
    return { selectedName: "", selectedNameSource: "needs_confirmation", confidence: 0, needsConfirmation: true, rejectedCandidates: Array.from(rejected) };
  }

  const confidence = Math.min(0.995, best.score);
  const needsConfirmation = confidence < 0.72;
  // If low confidence, do not pass a skill/company/section as a name. Leave blank for UI confirmation.
  return {
    selectedName: needsConfirmation ? "" : best.name,
    selectedNameSource: needsConfirmation ? "needs_confirmation" : Array.from(best.sources).join("+"),
    confidence,
    needsConfirmation,
    rejectedCandidates: Array.from(rejected),
  };
}


const HEADLINE_SECTION_RE = /^(?:contact|contacts|kontakt|profile|profil|summary|professional summary|profile summary|about me|objective|experience|work experience|professional experience|employment history|berufserfahrung|education|bildung|ausbildung|projects?|projekte|skills?|expertise|languages?|sprachen|certifications?|references?)$/i;
const HEADLINE_CONTACT_RE = /(?:@|https?:\/\/|www\.|linkedin|github)/i;
const HEADLINE_STREET_RE = /\b(?:street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|drive|dr\.?|boulevard|blvd\.?|way|weg|straße|strasse|str\.?|platz|gasse|allee|ring|rue|via|calle|rua)\b/i;
const HEADLINE_POSTAL_RE = /\b\d{4,6}\b/;

/**
 * Remove contact/location bleed from a role line without maintaining a city or
 * country list. The cut is driven by structural address evidence: street +
 * house number, postal code, email, URL, or phone. This works across markets.
 */
function stripHeadlineContactBleed(value: string): string {
  let text = normalizeCandidate(value);
  if (!text) return "";

  const hardContact = text.search(/(?:@|https?:\/\/|www\.|linkedin|github)/i);
  if (hardContact > 0) text = text.slice(0, hardContact).trim();

  // "Role Streetname 15, 97094 City" -> "Role". Require both a house
  // number and either a postal code or street token so years in job titles are
  // never mistaken for an address.
  const addressMatch = text.match(/^(.*?\S)\s+([\p{L}.'’-]{2,}\s+\d{1,5}[A-Za-z]?(?:\s*[,·|-]\s*|\s+)(?:\d{4,6}\b|[\p{L}.'’-]{2,}))(?:.*)$/u);
  if (addressMatch && (HEADLINE_STREET_RE.test(addressMatch[2]) || HEADLINE_POSTAL_RE.test(addressMatch[2]))) {
    text = addressMatch[1].trim();
  } else {
    // Postal-code-only fallback, but only after at least one role-like token.
    const postal = text.search(/\s+\d{4,6}\b/);
    if (postal > 0 && words(text.slice(0, postal)).some((w) => ROLE_WORDS.has(w))) {
      const beforePostal = text.slice(0, postal).trim();
      // Drop the likely street + house-number immediately before the postal code.
      text = beforePostal.replace(/\s+[\p{L}.'’-]{2,}(?:\s+[\p{L}.'’-]{2,}){0,2}\s+\d{1,5}[A-Za-z]?$/u, "").trim();
    }
  }

  return text.replace(/[|·,;:-]+$/g, "").replace(/\s{2,}/g, " ").trim();
}

const HEADLINE_WORDS = new Set([
  // seniority/modifiers
  "junior", "senior", "lead", "principal", "staff", "associate", "assistant", "deputy", "chief", "head", "global", "regional", "international", "technical", "digital", "commercial", "professional", "graduate", "trainee", "intern",
  // functions/domains
  "customer", "client", "success", "support", "service", "services", "data", "business", "product", "project", "program", "programme", "portfolio", "account", "sales", "marketing", "finance", "financial", "operations", "operation", "human", "resources", "people", "software", "systems", "system", "network", "cloud", "security", "cyber", "quality", "research", "machine", "learning", "artificial", "intelligence", "frontend", "backend", "fullstack", "full", "stack", "mobile", "web", "application", "applications", "implementation", "onboarding", "relationship", "relations", "communications", "communication", "content", "brand", "design", "graphic", "user", "experience", "process", "supply", "chain", "office", "administrative", "clinical", "health", "healthcare",
  // role nouns
  ...Array.from(ROLE_WORDS),
  "architect", "owner", "founder", "representative", "advisor", "adviser", "controller", "planner", "officer", "executive", "technician", "administrator", "coordinator", "recruiter", "scientist", "researcher", "nurse", "doctor", "teacher", "writer", "editor", "developer", "engineer", "analyst", "consultant", "specialist", "manager", "director",
  // common non-English role pieces
  "kunden", "erfolg", "technischer", "support", "daten", "wissenschaftler", "entwickler", "ingenieur", "berater", "managerin", "spezialist", "spezialistin", "responsable", "ingenieur", "analyste", "consultant", "consultante", "desarrollador", "ingeniero", "analista", "especialista", "gerente"
]);

/** Split a fully concatenated decorative title using a vocabulary-backed DP.
 * It is only used for lines made almost entirely of single-letter tokens, so it
 * cannot alter normal prose or ordinary job titles. Unknown leftovers are kept
 * as one token rather than guessed. */
function segmentDecorativeHeadline(compact: string): string {
  const lower = compact.toLowerCase().replace(/[^\p{L}]/gu, "");
  if (lower.length < 5 || lower.length > 80) return compact;
  const memo = new Map<number, { score: number; words: string[] } | null>();
  const vocab = [...HEADLINE_WORDS].sort((a, b) => b.length - a.length);

  const walk = (index: number): { score: number; words: string[] } | null => {
    if (index === lower.length) return { score: 0, words: [] };
    if (memo.has(index)) return memo.get(index)!;
    let best: { score: number; words: string[] } | null = null;
    for (const word of vocab) {
      if (!lower.startsWith(word, index)) continue;
      const tail = walk(index + word.length);
      if (!tail) continue;
      const score = tail.score + word.length * word.length;
      if (!best || score > best.score) best = { score, words: [word, ...tail.words] };
    }
    memo.set(index, best);
    return best;
  };

  const result = walk(0);
  if (!result || result.words.length < 2) return compact;
  return result.words.map((w) => w.toUpperCase()).join(" ");
}

function decodeDecorativeHeadlineLine(line: string): string {
  const trimmed = line.trim();
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length < 5) return "";
  const letterTokens = tokens.filter((t) => /^[\p{L}]$/u.test(t)).length;
  if (letterTokens / tokens.length < 0.82) return "";
  const compact = tokens.filter((t) => /^[\p{L}]$/u.test(t)).join("");
  return segmentDecorativeHeadline(compact);
}

function headlineQuality(value: string): number {
  const line = stripHeadlineContactBleed(value);
  if (!line || line.length > 90 || /[.!?]/.test(line) || HEADLINE_CONTACT_RE.test(line)) return -100;
  const ws = words(line);
  if (!ws.length || ws.length > 10) return -50;
  if (HEADLINE_SECTION_RE.test(line) || ws.every((w) => SECTION_WORDS.has(w))) return -100;
  let score = 20 - Math.abs(4 - ws.length);
  score += ws.filter((w) => ROLE_WORDS.has(w) || HEADLINE_WORDS.has(w)).length * 8;
  if (ws.length === 1) score -= 10; // "MANAGER" is valid but less informative than a full title.
  if (/\b(with|over|experience|passionate|detail-oriented|results-driven|born|raised)\b/i.test(line)) score -= 30;
  return score;
}

export function resolveTargetHeadline(input: { aiHeadline?: string | null; rawText?: string | null; selectedName?: string | null }): string {
  const selectedKey = canonicalNameKey(input.selectedName || "");
  const candidates: string[] = [];
  const ai = stripHeadlineContactBleed(normalizeCandidate(input.aiHeadline || ""));
  if (ai) candidates.push(ai);

  const originalLines = String(input.rawText || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 18);
  const healedLines = healSpacedHeaders(input.rawText || "").split(/\r?\n/).map(normalizeCandidate).filter(Boolean).slice(0, 18);

  // Prefer a recoverable decorative title over a one-word AI fragment.
  for (const line of originalLines) {
    const decoded = decodeDecorativeHeadlineLine(line);
    if (decoded) candidates.push(decoded);
  }
  candidates.push(...healedLines);

  const scored = candidates
    .map(stripHeadlineContactBleed)
    .filter(Boolean)
    .filter((line) => canonicalNameKey(line) !== selectedKey)
    .filter((line) => !HEADLINE_CONTACT_RE.test(line))
    .filter((line) => !HEADLINE_SECTION_RE.test(line))
    .map((line, index) => ({ line, score: headlineQuality(line) - index * 0.25 }))
    .sort((a, b) => b.score - a.score);

  const best = scored.find((candidate) => candidate.score > 0)?.line || "";
  return best || (ai && headlineQuality(ai) > 0 ? ai : "Professional");
}

export const __workzoCvIdentityEngineVersion = "3.2.0-global-headline-integrity";
