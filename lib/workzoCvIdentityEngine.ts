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
  "proficiencies", "proficiency", "address", "postal", "code", "city", "full", "name", "phone", "email", "website",
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

  const lexicalWords = [
    "it", "customer", "success", "project", "product", "support", "technical", "technician",
    "specialist", "engineer", "engineering", "developer", "designer", "graphic", "data",
    "scientist", "analyst", "manager", "management", "administrator", "consultant",
    "coordinator", "director", "assistant", "representative", "software", "systems",
    "information", "technology", "public", "relations", "marketing", "sales", "teacher",
    "ingenieur", "spezialist", "technischer", "support", "projekt", "produkt", "manager",
  ].sort((a, b) => b.length - a.length);

  const splitKnownCompounds = (input: string): string => {
    let value = input;
    // Repeat because one string can contain more than one collapsed boundary.
    for (let pass = 0; pass < 4; pass += 1) {
      let changed = false;
      for (const left of lexicalWords) {
        for (const right of lexicalWords) {
          const re = new RegExp(`\\b(${left})(${right})\\b`, "ig");
          const next = value.replace(re, "$1 $2");
          if (next !== value) { value = next; changed = true; }
        }
      }
      if (!changed) break;
    }
    return value;
  };

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
        const parts = trimmed.split(/\s{2,}/).map((part) => part.replace(/\s+/g, "").trim()).filter(Boolean);
        const healed = parts.length > 1 ? parts.map(titleCaseName).join(" ") : joined;
        return splitKnownCompounds(healed)
          .replace(/\bIt\b/g, "IT")
          .replace(/\bPr\b/g, "PR")
          .replace(/\bQa\b/g, "QA")
          .trim();
      }
      return splitKnownCompounds(
        line.replace(/\b([A-Za-z])\s(?=[a-z]{2,}\b)/g, "$1").replace(/\s{2,}/g, " "),
      );
    })
    .join("\n");
}

function lettersOnly(value: string): string {
  return normalizeCandidate(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/gi, "").toLowerCase();
}

function hasVowel(value: string): boolean {
  return /[aeiouy]/i.test(value);
}

function longestConsonantRun(value: string): number {
  const runs: string[] = value.toLowerCase().match(/[^aeiouy]+/g) || [];
  return runs.reduce((max, run) => Math.max(max, run.length), 0);
}

/**
 * Recover a two-part name from a decorative all-letter header when PDF text
 * extraction erased every word boundary. The compact header is accepted only
 * when it is independently corroborated by the email local part. This avoids
 * guessing from arbitrary headings while still recovering layouts such as
 * "J O H N S M I T H" + "johnsmith@...".
 */
function splitCompactHumanName(compactInput: string, corroboratedName = ""): string {
  const compact = lettersOnly(compactInput);
  if (compact.length < 4 || compact.length > 48) return "";

  // Strongest evidence: another source already contains the same letters with
  // trustworthy word boundaries (AI, filename, email with separators, vision).
  const corroborated = normalizeCandidate(corroboratedName);
  if (corroborated && lettersOnly(corroborated) === compact && looksLikeHumanName(corroborated)) {
    return titleCaseName(corroborated);
  }

  const candidates: Array<{ name: string; score: number }> = [];
  for (let pos = 2; pos <= compact.length - 2; pos += 1) {
    const first = compact.slice(0, pos);
    const second = compact.slice(pos);
    if (first.length > 22 || second.length > 28) continue;
    if (!hasVowel(first) || !hasVowel(second)) continue;
    if (longestConsonantRun(first) > 3 || longestConsonantRun(second) > 4) continue;

    const ratio = pos / compact.length;
    let score = 3 - Math.abs(ratio - 0.42) * 5;
    const left = first[first.length - 1];
    const right = second[0];
    if (/[aeiouy]/.test(left) && /[^aeiouy]/.test(right)) score += 1.1;
    else if (/[^aeiouy]/.test(left) && /[aeiouy]/.test(right)) score += 0.35;
    score -= Math.max(0, longestConsonantRun(first) - 2) * 0.35;
    score -= Math.max(0, longestConsonantRun(second) - 2) * 0.35;
    // Penalize implausibly short family names and highly unbalanced splits.
    if (second.length < 3) score -= 2;
    if (Math.min(first.length, second.length) / Math.max(first.length, second.length) < 0.25) score -= 0.9;
    candidates.push({ name: `${titleCaseName(first)} ${titleCaseName(second)}`, score });
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  const second = candidates[1];
  // Do not invent boundaries when the score is weak or nearly tied. In that
  // case the UI must ask for confirmation instead of accepting a wrong person.
  if (!best || best.score < 3.35 || (second && best.score - second.score < 0.05)) return "";
  return best.name;
}

function decorativeChunksFromHeader(rawText: string): string[] {
  const lines = String(rawText || "").split(/\r?\n/).slice(0, 16);
  const chunks: string[] = [];
  for (const rawLine of lines) {
    const withoutContact = rawLine
      .replace(EMAIL_RE, " ")
      .replace(URL_RE, " ")
      .replace(/\+?\d[\d\s().-]{6,}/g, " ")
      .trim();
    if (!withoutContact) continue;
    const tokens = withoutContact.split(/\s+/).filter(Boolean);
    if (tokens.length >= 3 && tokens.every((token) => /^\p{L}$/u.test(token))) {
      chunks.push(tokens.join(""));
    } else if (/^[\p{Lu}][\p{L}'’-]{1,24}$/u.test(withoutContact) && !looksLikeSectionOrNoise(withoutContact)) {
      chunks.push(withoutContact);
    }
  }
  return chunks;
}

/**
 * Recover names from decorative or split header layouts. The extractor first
 * uses independent evidence to restore boundaries. A phonetic split is used
 * only when it is clearly stronger than alternatives; otherwise it returns an
 * empty value and requests confirmation rather than guessing.
 */
function inferNameFromDecorativeHeader(
  rawText: string,
  email?: string | null,
  aiName?: string | null,
  fileName?: string | null,
): string {
  const chunks = decorativeChunksFromHeader(rawText);
  if (!chunks.length) return "";

  const emailRaw = String(email || "").split("@")[0] || "";
  const emailDelimited = emailRaw.replace(/\d+/g, "").replace(/[._-]+/g, " ").trim();
  const filenameName = inferNameFromFilename(fileName || "");
  const evidence = [aiName || "", filenameName, emailDelimited].filter(Boolean);

  // Two separate decorative lines, e.g. "O L I V I A" then "W I L S O N".
  // Skip role-like or section-like chunks and use the first plausible pair.
  for (let i = 0; i < Math.min(chunks.length, 4); i += 1) {
    for (let j = i + 1; j < Math.min(chunks.length, i + 4); j += 1) {
      const joined = `${titleCaseName(chunks[i])} ${titleCaseName(chunks[j])}`;
      if (!looksLikeHumanName(joined)) continue;
      const compact = lettersOnly(joined);
      const matchesEvidence = evidence.some((item) => lettersOnly(item) === compact);
      if (matchesEvidence) return joined;
    }
  }

  for (const chunk of chunks.slice(0, 1)) {
    const compact = lettersOnly(chunk);
    if (compact.length < 5) continue;

    // A filename may safely preserve only the given name (for example
    // "Haritha_ITSD.pdf") while the decorative PDF header contains the full
    // compact name. Use that independently supplied prefix as a word boundary;
    // never use role-like or generic filename tokens.
    const filenameTokens = normalizeCandidate(String(fileName || "").replace(/\.[^.]+$/, ""))
      .split(/[^\p{L}'’-]+/u)
      .filter((token) => token.length >= 2 && !ROLE_WORDS.has(token.toLowerCase()) && !SECTION_WORDS.has(token.toLowerCase()));
    for (const token of filenameTokens) {
      const prefix = lettersOnly(token);
      if (prefix.length >= 3 && compact.startsWith(prefix) && compact.length - prefix.length >= 3) {
        const candidate = `${titleCaseName(prefix)} ${titleCaseName(compact.slice(prefix.length))}`;
        if (looksLikeHumanName(candidate)) return candidate;
      }
    }

    const corroborated = evidence.find((item) => lettersOnly(item) === compact) || "";
    const split = splitCompactHumanName(compact, corroborated);
    if (split) return split;
  }
  return "";
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
  // Reject generic form labels and placeholders in any language-like template.
  if (/^(candidate|applicant|verified user|unknown|n\/a|na)$/i.test(v)) return true;
  if (/\b(?:your|enter|insert|type|write|add|placeholder|sample|example|template)\b/i.test(v) &&
      /\b(?:name|phone|email|address|location|linkedin|github|website|profile|contact)\b/i.test(v)) return true;
  if (/\b(?:full name|phone contact|postal code|street address|email address|social media)\b/i.test(v)) return true;
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
  let valid = looksLikeHumanName(value) || looksLikeMononymName(value);
  // A long single token recovered from a letter-spaced line has lost its word
  // boundary. Never accept it as a confident mononym; the deterministic
  // decorative extractor must split it, or the UI must request confirmation.
  if (c.source === "raw_header" && words(value).length === 1 && lettersOnly(value).length > 11) {
    valid = false;
  }
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
    .replace(/\b(?:copy|resume|cv|curriculum|vitae|template|sample|draft|final|updated|new|old|version|profile|document)\b/gi, " ")
    .replace(/[()\[\]\d_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return looksLikeHumanName(clean) ? titleCaseName(clean) : "";
}


/**
 * Read the first plausible identity line before any section header.
 * This deliberately operates on the original text, before broad healing can
 * join or reshape ordinary names. It is generic: no person-specific data.
 */
function extractPrimaryHeaderName(text: string): string {
  const rawLines = String(text || "")
    .replace(/\u00a0/g, " ")
    .split(/\r?\n/)
    .map(normalizeCandidate)
    .filter(Boolean)
    .slice(0, 18);

  for (let index = 0; index < rawLines.length; index += 1) {
    const current = rawLines[index];
    const currentTokens = current.split(/\s+/).filter(Boolean);
    const currentIsLetterSpaced =
      currentTokens.length >= 4 &&
      currentTokens.filter((token) => /^\p{L}$/u.test(token)).length / currentTokens.length >= 0.7;
    const healedCurrent = compactSpacedName(current);

    // Decorative one-character-spaced headers are resolved by the dedicated
    // evidence-backed extractor below. Do not join them with the following
    // headline, which could create "FirstnameLastname JobTitle".
    if (!currentIsLetterSpaced && looksLikeHumanName(healedCurrent)) {
      return titleCaseName(healedCurrent);
    }

    // Split names such as "OLIVIA" / "WILSON" or "BEN" / "HARRINGTON".
    if (!currentIsLetterSpaced && index + 1 < rawLines.length) {
      const nextRaw = rawLines[index + 1];
      const nextTokens = nextRaw.split(/\s+/).filter(Boolean);
      const nextIsLetterSpaced =
        nextTokens.length >= 4 &&
        nextTokens.filter((token) => /^\p{L}$/u.test(token)).length / nextTokens.length >= 0.7;
      const next = compactSpacedName(nextRaw);
      const joined = `${healedCurrent} ${next}`.trim();
      if (!nextIsLetterSpaced && looksLikeHumanName(joined)) return titleCaseName(joined);
    }

    // Stop once the document has clearly entered a content section. This
    // prevents "Executive Summary", "Your Phone Contact", skills and roles
    // from ever becoming fallback identities.
    const ws = words(healedCurrent);
    if (ws.length <= 4 && ws.some((word) => SECTION_WORDS.has(word))) break;
  }
  return "";
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


function candidateContextScore(value: string, rawText?: string | null): number {
  const key = lettersOnly(value);
  if (!key) return -10;
  const lines = String(rawText || "").split(/\r?\n/).map((line) => normalizeCandidate(line));
  let best = -10;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line || lettersOnly(line) !== key) continue;

    const previous = lines.slice(Math.max(0, index - 8), index).join(" ");
    const next = lines.slice(index + 1, index + 6).join(" ");
    let score = 2; // exact standalone line in the document

    if (/^[\p{Lu}][\p{Lu}\s'’.-]+$/u.test(line) || /^[\p{Lu}][\p{Ll}'’.-]+(?:\s+[\p{Lu}][\p{Ll}'’.-]+){1,3}$/u.test(line)) score += 1.5;
    if (ROLE_WORDS_RE.test(next)) score += 3;
    if (/\b(profile|summary|overview|about me|profil|profilübersicht)\b/i.test(next)) score += 1.5;
    if (/\b(reference|references|referenzen|références|referencias)\b/i.test(previous)) score -= 6;
    if (COMPANY_HINTS.test(next) && /(?:@|phone|email|tel\.?|ceo|cto|director)/i.test(next)) score -= 4;
    best = Math.max(best, score);
  }
  return best;
}

const ROLE_WORDS_RE = /\b(?:manager|engineer|developer|designer|analyst|scientist|consultant|specialist|administrator|coordinator|director|lead|assistant|support|marketing|sales|project|product|teacher|accountant|technician|representative|security|cybersecurity|trainee|intern|ingenieur|spezialist|entwickler|berater|leiter)\b/i;

function candidateIsCorroborated(value: string, input: {
  rawText?: string | null;
  fileName?: string | null;
  email?: string | null;
}): boolean {
  const key = lettersOnly(value);
  if (!key) return false;

  // Support sidebar-first CVs where the candidate name appears below skills or
  // education. We score the exact line in context instead of limiting the scan
  // to the first N extracted lines. Reference names are explicitly penalised.
  if (candidateContextScore(value, input.rawText) >= 3.5) return true;

  const emailKey = lettersOnly(String(input.email || "").split("@")[0] || "");
  if (emailKey && (emailKey === key || emailKey.includes(key) || key.includes(emailKey))) return true;
  const fileKey = lettersOnly(String(input.fileName || "").replace(/\.[^.]+$/, ""));
  if (fileKey && fileKey.includes(key)) return true;
  return false;
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

  if (input.aiName) {
    const aiConfidence = candidateIsCorroborated(input.aiName, input) ? 0.96 : 0.52;
    candidates.push({ source: "ai_parser", value: input.aiName, confidence: aiConfidence });
  }
  if (input.visionName) candidates.push({ source: "vision_header", value: input.visionName, confidence: 0.9 });

  const primaryHeaderName = extractPrimaryHeaderName(input.rawText || "");
  if (primaryHeaderName) candidates.push({ source: "raw_header", value: primaryHeaderName, confidence: 1.08 });

  const decorativeName = inferNameFromDecorativeHeader(
    input.rawText || "",
    input.email || "",
    input.aiName || "",
    input.fileName || "",
  );
  if (decorativeName) candidates.push({ source: "deterministic_layout", value: decorativeName, confidence: 1.15 });
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

  const ranked = Array.from(grouped.values()).sort((a, b) => b.score - a.score);
  const best = ranked.find((entry) => {
    const onlyAi = entry.sources.size === 1 && entry.sources.has("ai_parser");
    return !onlyAi || candidateIsCorroborated(entry.name, input);
  });
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

function cleanHeadlineCandidate(value: string): string {
  let cleaned = normalizeCandidate(value);
  if (!cleaned) return "";
  cleaned = cleaned
    .replace(EMAIL_RE, " ")
    .replace(URL_RE, " ")
    .replace(/\+?\d[\d\s().-]{6,}/g, " ")
    .replace(/\b(?:address|postal code|city|phone|email|linkedin|github|website)\b.*$/i, "")
    .replace(/\s+(?:[\p{L}.'-]+(?:weg|straße|strasse|street|road|avenue|lane|drive|platz|gasse|allee|ring|rue|via|calle|rua)\s*\d*[a-z]?(?:[,;]\s*)?)?\d{4,6}(?:[,;]\s*|\s+)[\p{L} .'-]{2,}$/iu, "")
    .replace(/\s+[\p{L}.'-]+(?:weg|straße|strasse|street|road|avenue|lane|drive|platz|gasse|allee|ring|rue|via|calle|rua)\s*\d*[a-z]?(?:[,;].*)?$/iu, "")
    .replace(/[|·•]+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();

  // Repair common OCR/PDF word-boundary loss in job titles without changing
  // arbitrary prose. Both sides must be known role/title words.
  const words = [
    "it", "customer", "success", "project", "product", "support", "technical", "specialist",
    "engineer", "developer", "designer", "graphic", "data", "scientist", "analyst",
    "manager", "administrator", "consultant", "coordinator", "director", "assistant",
    "software", "systems", "public", "relations", "marketing", "sales", "teacher",
    "ingenieur", "spezialist", "technischer",
  ].sort((a, b) => b.length - a.length);
  for (let pass = 0; pass < 4; pass += 1) {
    let changed = false;
    for (const left of words) {
      for (const right of words) {
        const re = new RegExp(`\\b(${left})(${right})\\b`, "ig");
        const next = cleaned.replace(re, "$1 $2");
        if (next !== cleaned) { cleaned = next; changed = true; }
      }
    }
    if (!changed) break;
  }
  return cleaned
    .replace(/\bIt\b/g, "IT")
    .replace(/\bPr\b/g, "PR")
    .replace(/\bQa\b/g, "QA")
    .trim();
}

function isRejectedHeadline(value: string): boolean {
  const v = cleanHeadlineCandidate(value);
  if (!v || v.length > 75 || /[.!?]/.test(v)) return true;
  if (/\b(with|over|experience|passionate|detail-oriented|results-driven|born|raised)\b/i.test(v)) return true;
  if (/\b(reallygreatsite|anywhere st|address|postal code|phone|email|website)\b|\b[a-z0-9-]+\.(?:com|net|org|io|co|de|uk)\b/i.test(v)) return true;
  const ws = words(v);
  if (/\b(bachelor|master|degree|diploma|certificate|certification|graduation|university|college|school|education|bildung)\b/i.test(v) && !ws.some((word) => ROLE_WORDS.has(word))) return true;
  if (!ws.length) return true;
  if (ws.every((word) => SECTION_WORDS.has(word))) return true;
  if (ws.some((word) => SECTION_WORDS.has(word)) && !ws.some((word) => ROLE_WORDS.has(word))) return true;
  if (/^(skills? and proficienc(?:y|ies)|professional summary|profile summary|contact information)$/i.test(v)) return true;
  return false;
}

export function resolveTargetHeadline(input: { aiHeadline?: string | null; rawText?: string | null; selectedName?: string | null }): string {
  let ai = cleanHeadlineCandidate(input.aiHeadline || "");
  // A frequent parser artifact is "Role, Company". A CV headline is the role;
  // the employer belongs in Experience. Keep the first segment only when it is
  // independently role-shaped.
  if (ai.includes(",")) {
    const first = cleanHeadlineCandidate(ai.split(",")[0]);
    if (first && words(first).some((w) => ROLE_WORDS.has(w))) ai = first;
  }

  const lines = healSpacedHeaders(input.rawText || "")
    .split(/\r?\n/)
    .map(normalizeCandidate)
    .filter(Boolean)
    .slice(0, 24);
  const selectedKey = canonicalNameKey(input.selectedName || "");

  const validStructuralLine = (line: string): boolean => {
    if (!line || canonicalNameKey(line) === selectedKey) return false;
    if (/[@\d]|https?:|www\.|\b[a-z0-9-]+\.(?:com|net|org|io|co|de|uk)\b/i.test(line)) return false;
    if (/[.!?]/.test(line) || line.length > 75) return false;
    const ws = words(line);
    if (!ws.length || ws.length > 9) return false;
    if (ws.every((w) => SECTION_WORDS.has(w))) return false;
    if (ws.some((w) => SECTION_WORDS.has(w)) && !ws.some((w) => ROLE_WORDS.has(w))) return false;
    if (ws.every((w) => SKILL_WORDS.has(w))) return false;
    if (/\b(bachelor|master|degree|diploma|certificate|graduation|university|college|education|bildung)\b/i.test(line) && !ws.some((w) => ROLE_WORDS.has(w))) return false;
    return true;
  };

  // The line directly below/near the name is stronger evidence than an AI
  // headline assembled from an Experience, Skills, or Education column.
  let rawRole = "";
  for (const line of lines.slice(0, 10)) {
    if (!validStructuralLine(line)) continue;
    const ws = words(line);
    if (ws.some((w) => ROLE_WORDS.has(w))) {
      rawRole = cleanHeadlineCandidate(line);
      break;
    }
  }

  if (rawRole) {
    const aiKey = canonicalNameKey(ai);
    const rawKey = canonicalNameKey(rawRole);
    // Prefer the raw header whenever AI is invalid, absent from the header, or
    // contains extra unrelated words (company/skill leakage).
    if (isRejectedHeadline(ai) || !aiKey || (!rawKey.includes(aiKey) && !aiKey.includes(rawKey))) return rawRole;
  }

  if (!isRejectedHeadline(ai)) return ai;
  if (rawRole) return rawRole;

  // Structural fallback for unlisted job titles in any language.
  for (const line of lines.slice(0, 12)) {
    if (validStructuralLine(line)) return cleanHeadlineCandidate(line);
  }

  // Last-resort role phrase from a summary. This is deliberately conservative:
  // it only accepts explicit self-identification / job-seeking constructions.
  const text = String(input.rawText || "").replace(/\s+/g, " ");
  const summaryRole = text.match(/\b(?:seeking\s+employment\s+as|employment as|looking for|working as|role as|seeking)\s+(?:an?\s+)?([A-Za-z][A-Za-z /&-]{2,55}?)(?=[.,;]|\s+(?:with|where|to|who)\b)/i)?.[1] || "";
  const cleanedSummaryRole = cleanHeadlineCandidate(summaryRole);
  return isRejectedHeadline(cleanedSummaryRole) ? "" : cleanedSummaryRole;
}

export const __workzoCvIdentityEngineVersion = "3.4.0-raw-header-authority-and-semantic-guard";
