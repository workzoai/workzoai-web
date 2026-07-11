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
  if (ws.every((w) => SECTION_WORDS.has(w))) return true;
  if (ws.some((w) => SECTION_WORDS.has(w)) && ws.length <= 4) return true;
  if (ws.every((w) => SKILL_WORDS.has(w))) return true;
  if (ws.filter((w) => SKILL_WORDS.has(w)).length >= Math.max(1, ws.length - 1)) return true;
  if (ws.some((w) => ROLE_WORDS.has(w)) && ws.length <= 4) return true;
  if (/^[A-Z\s]{2,}$/.test(v) && ws.length === 1 && v.length > 18) return true;
  // concatenated section-heading / OCR merged terms, e.g. Niveau Ausbildungberufserfahrung
  if (/[a-z][A-Z]/.test(v.replace(/\s/g, "")) && ws.length <= 3) return true;
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

function canonicalNameKey(value: string): string {
  return words(value).join(" ");
}

function candidateScore(c: IdentityCandidate): { value: string; source: IdentitySource; score: number; valid: boolean } {
  const value = compactSpacedName(c.value || "");
  const valid = looksLikeHumanName(value);
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
  const lines = healed.split(/\r?\n/).map(normalizeCandidate).filter(Boolean).slice(0, 35);
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

export function resolveTargetHeadline(input: { aiHeadline?: string | null; rawText?: string | null; selectedName?: string | null }): string {
  const ai = normalizeCandidate(input.aiHeadline || "");
  const isBad = !ai || ai.length > 75 || /[.!?]/.test(ai) || /\b(with|over|experience|passionate|detail-oriented|results-driven|born|raised)\b/i.test(ai);
  if (!isBad) return ai;

  const lines = healSpacedHeaders(input.rawText || "").split(/\r?\n/).map(normalizeCandidate).filter(Boolean).slice(0, 12);
  const selectedKey = canonicalNameKey(input.selectedName || "");
  for (const line of lines) {
    if (!line || canonicalNameKey(line) === selectedKey) continue;
    if (looksLikeSectionOrNoise(line)) continue;
    const ws = words(line);
    if (ws.some((w) => ROLE_WORDS.has(w)) && line.length <= 75) return line;
  }
  return ai && ai.length <= 75 ? ai : "Professional";
}

export const __workzoCvIdentityEngineVersion = "3.1.0-global";
