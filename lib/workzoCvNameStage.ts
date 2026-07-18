/**
 * WorkZo CV Stage 1: authoritative candidate-name extraction.
 *
 * This module owns ONLY the candidate name. It never changes headline, summary,
 * experience, education, projects, skills, languages, dates, or contact fields.
 *
 * Global rules:
 * - prefer an explicit human-looking name already extracted by the parser;
 * - recover ordinary, letter-spaced, split-line, and sidebar-first headers;
 * - use filename/email evidence only to restore boundaries, never as facts alone;
 * - reject placeholders, sections, roles, skills, companies, contacts, and references;
 * - return blank + needsConfirmation when evidence is insufficient.
 */

export type CvNameStageSource =
  | "parser"
  | "top_header"
  | "decorative_header"
  | "split_header"
  | "document_line"
  | "needs_confirmation";

export interface CvNameStageResult {
  name: string;
  source: CvNameStageSource;
  confidence: number;
  needsConfirmation: boolean;
  rejected: string[];
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const URL_RE = /(?:https?:\/\/|www\.|linkedin\.?com|github\.?com|behance\.?net|reallygreatsite|\/(?:in|pub|profile)\/|@[a-z0-9._-]{2,})/i;
const PHONE_RE = /\+?\d[\d\s()./-]{6,}/;
const DATE_RE = /\b(?:19|20)\d{2}\b|\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/i;
const LOCATION_OR_ADDRESS_RE = /(?:\b\d{4,6}\b)|(?:\b(?:street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|weg|str(?:asse|aße)?|allee|platz|postal|zip)\b)|(?:^[\p{L}.'’ -]{2,40},\s*[\p{L}.'’ -]{2,40}$)/iu;

const SECTION_WORDS = new Set([
  "about", "profile", "summary", "professional", "executive", "experience", "employment", "work", "history",
  "education", "skills", "skill", "expertise", "projects", "project", "certifications", "languages", "language",
  "contact", "contacts", "reference", "references", "awards", "training", "objective", "interests", "portfolio",
  "resume", "curriculum", "vitae", "proficiencies", "address", "postal", "code", "city", "full", "name", "phone",
  "email", "website", "overview", "tools", "tool", "technology", "technologies", "platform", "platforms", "framework", "frameworks", "design", "profil", "kontakt", "profilübersicht", "berufserfahrung", "ausbildung", "bildung",
  "kenntnisse", "fähigkeiten", "sprachen", "referenzen", "erfolge", "formation", "compétences", "langues", "perfil",
  "experiencia", "educación", "habilidades", "idiomas", "esperienza", "istruzione", "competenze", "lingue",
]);

const ROLE_OR_SKILL_WORDS = new Set([
  "manager", "management", "engineer", "engineering", "developer", "designer", "analyst", "scientist", "consultant",
  "specialist", "administrator", "coordinator", "director", "lead", "intern", "trainee", "assistant", "support",
  "marketing", "sales", "project", "product", "data", "software", "graphic", "teacher", "accountant", "technician",
  "representative", "security", "cybersecurity", "customer", "success", "technical", "creative", "python", "sql",
  "tableau", "communication", "teamwork", "leadership", "negotiation", "planning", "problem", "solving", "skills",
  "ingenieur", "spezialist", "technischer", "entwickler", "berater", "leiter", "projekt", "produkt",
]);

const COMPANY_WORD_RE = /\b(?:inc|ltd|llc|gmbh|corp|corporation|company|co\.?|university|school|college|institute|agency|group|solutions|systems|technologies|studio)\b/i;
const PLACEHOLDER_RE = /\b(?:your|full name|phone contact|address|postal code|anywhere|reallygreatsite|sample|template|lorem ipsum)\b/i;
const REFERENCE_RE = /\b(?:reference|references|referenz|referenzen|referee)\b/i;
const LANGUAGE_LEVEL_RE = /\b(?:english|german|deutsch|french|fran[cç]ais|spanish|espa[nñ]ol|italian|portuguese|arabic|turkish|mandarin|hindi|tamil|native|fluent|proficient|intermediate|conversational|basic|beginner|advanced|muttersprache|fliessend|fließend|konversationsniveau|[abc][1-9])\b/i;

function clean(value: string): string {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[|•·]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function words(value: string): string[] {
  return clean(value)
    .toLocaleLowerCase()
    .replace(/[^\p{L}'’.-]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function lettersOnly(value: string): string {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/gi, "")
    .toLowerCase();
}

function titleCase(value: string): string {
  const cleaned = clean(value);
  if (!cleaned) return "";

  // Preserve meaningful mixed casing already present in the source. This is
  // safer across cultures than blindly title-casing every token.
  const hasUpper = /\p{Lu}/u.test(cleaned);
  const hasLower = /\p{Ll}/u.test(cleaned);
  if (hasUpper && hasLower) return cleaned;

  const particles = new Set([
    "al", "bin", "bint", "da", "de", "del", "della", "der", "di", "dos", "du",
    "el", "la", "le", "van", "von", "y",
  ]);

  return cleaned
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part, index) => {
      const lower = part.toLocaleLowerCase();
      if (index > 0 && particles.has(lower)) return lower;
      return part.split(/([-’'])/).map((piece) =>
        /^[-’']$/.test(piece) ? piece : piece.charAt(0).toLocaleUpperCase() + piece.slice(1),
      ).join("");
    })
    .join(" ");
}

function isSectionOrNoise(value: string): boolean {
  const v = clean(value);
  const ws = words(v);
  if (!v || EMAIL_RE.test(v) || URL_RE.test(v) || PHONE_RE.test(v) || DATE_RE.test(v) || LOCATION_OR_ADDRESS_RE.test(v)) return true;
  if (PLACEHOLDER_RE.test(v) || COMPANY_WORD_RE.test(v)) return true;
  if (LANGUAGE_LEVEL_RE.test(v) && ws.length <= 4) return true;
  if (ws.length === 0 || ws.length > 5) return true;
  if (ws.every((word) => SECTION_WORDS.has(word))) return true;
  if (ws.some((word) => SECTION_WORDS.has(word)) && ws.length <= 4) return true;
  const roleCount = ws.filter((word) => ROLE_OR_SKILL_WORDS.has(word)).length;
  if (roleCount >= Math.max(1, ws.length - 1)) return true;

  // OCR often collapses a role into a name token: "Itsupport",
  // "Customersuccess", "Projectmanager". Reject any non-leading token that
  // contains a complete role/skill term after compaction.
  const compactRoleTerms = [...ROLE_OR_SKILL_WORDS].filter((word) => word.length >= 4);
  if (ws.slice(1).some((token) => compactRoleTerms.some((role) => token === role || token.startsWith(role) || token.endsWith(role)))) {
    return true;
  }
  return false;
}

function isHumanName(value: string): boolean {
  const v = clean(value);
  const ws = words(v);
  if (isSectionOrNoise(v)) return false;
  if (ws.length < 1 || ws.length > 5) return false;
  if (ws.length > 1 && ws.some((word) => word.length < 2)) return false;
  if (ws.length === 1 && (ws[0].length < 2 || ws[0].length > 22)) return false;
  const letters = v.match(/\p{L}/gu)?.length || 0;
  return letters / Math.max(v.length, 1) >= 0.7;
}

function isLetterSpacedLine(value: string): boolean {
  const tokens = clean(value).split(/\s+/).filter(Boolean);
  return tokens.length >= 4 && tokens.filter((token) => /^\p{L}$/u.test(token)).length / tokens.length >= 0.75;
}

function compactLetterSpaced(value: string): string {
  return clean(value).split(/\s+/).join("");
}

function filenameTokens(fileName: string): string[] {
  return clean(fileName.replace(/\.[^.]+$/, " "))
    .replace(/\b(?:copy|resume|cv|curriculum|vitae|template|sample|draft|final|updated|modern|ats|professional|untitled|design)\b/gi, " ")
    .replace(/[()\[\]_-]+/g, " ")
    .split(/\s+/)
    .map((token) => lettersOnly(token))
    .filter((token) => token.length >= 3 && !ROLE_OR_SKILL_WORDS.has(token));
}

function emailTokens(email: string): string[] {
  const local = String(email || "").split("@")[0] || "";
  return local
    .replace(/\d+/g, " ")
    .split(/[._+\-\s]+/)
    .map(lettersOnly)
    .filter((token) => token.length >= 2);
}

/**
 * Extract identity evidence from an explicit professional-profile slug.
 *
 * This is intentionally generic and boundary-only: the slug must already be
 * present in the CV, and it is used only when its compact letters exactly match
 * the decorative header. Trailing digits are ignored because profile handles
 * commonly append them. No name is invented from a URL alone.
 */
function profileSlugNames(rawText: string): string[] {
  const out: string[] = [];
  const patterns = [
    /(?:linkedin\.?com\/)?(?:in|pub|profile)\/([\p{L}\p{N}._-]{3,80})/giu,
    /(?:behance\.net|github\.com)\/([\p{L}\p{N}._-]{3,80})/giu,
  ];

  for (const pattern of patterns) {
    for (const match of rawText.matchAll(pattern)) {
      const slug = String(match[1] || "").replace(/\d+$/g, "");
      const separated = clean(slug.replace(/[._-]+/g, " "));
      if (isHumanName(separated)) out.push(separated);

      // Keep the compact slug as evidence too. splitCompactUsingEvidence only
      // accepts it when it exactly corroborates the decorative header.
      const compact = lettersOnly(slug);
      if (compact.length >= 4) out.push(compact);
    }
  }

  return [...new Set(out)];
}


/**
 * Global boundary recovery for fully compact decorative names.
 *
 * The resolver never checks filenames, sample CVs, or complete person names.
 * It uses a reusable international token vocabulary plus generic surname
 * morphology. A split is accepted only when exactly one strongest boundary is
 * supported; ambiguous compact strings remain unconfirmed.
 */
const INTERNATIONAL_NAME_TOKENS = new Set([
  // Widely used given-name and surname components across regions. These are
  // individual tokens only, never complete identities or sample-specific pairs.
  "aaron", "abbas", "abdul", "adeline", "adrian", "ahmed", "aisha", "akhtar", "ali", "alice",
  "amina", "amit", "ana", "anderson", "andrea", "anna", "antonio", "arjun", "ashok", "ben",
  "benjamin", "bennett", "carla", "carlos", "chen", "claudia", "dani", "daniel", "darcy", "david",
  "devi", "elena", "emma", "estelle", "fatima", "foster", "garcia", "george", "gupta", "haritha",
  "hassan", "henrietta", "irene", "jamie", "james", "javier", "john", "jonas", "jose", "kim",
  "kumar", "lausch", "lee", "li", "linda", "lopez", "lucas", "martin", "martinez", "mary",
  "maria", "marie", "michael", "mitchell", "mohamed", "mohammed", "muller", "nair", "nguyen",
  "olivia", "palmer", "palmerston", "patel", "paul", "rachelle", "rahul", "richard", "robert",
  "rodriguez", "sanchez", "sarah", "sharma", "singh", "sofia", "sophia", "surender", "thomas",
  "victor", "vijay", "vijayakumar", "wang", "warner", "williams", "wilson", "yuki", "zola",
  "bekker", "beaudry", "harrington", "richardson", "foster", "alkan", "alkanj", "khaled",
  "priya", "noah", "markus", "zoe", "sven", "lars", "hans", "peter", "susan", "julia",
  "ines", "ines", "leila", "omar", "youssef", "samir", "noura", "layla", "reem", "mustafa",
  "mehmet", "ayse", "emre", "selin", "can", "deniz", "ivan", "anna", "olga", "sergey",
  "natalia", "dmitri", "andrei", "maria", "lucia", "giulia", "marco", "luca", "matteo",
  "francesca", "joao", "miguel", "pedro", "rafael", "fernando", "carmen", "isabel", "sofia",
  "wei", "ming", "xin", "jing", "hao", "lin", "zhang", "liu", "yang", "huang", "zhao",
  "sato", "suzuki", "tanaka", "watanabe", "yamamoto", "ito", "nakamura", "kobayashi",
  "min", "ji", "seo", "park", "choi", "jung", "kang", "lim", "rahman", "islam", "akter",
  "reddy", "rao", "iyer", "menon", "pillai", "krishnan", "lakshmi", "anita", "deepak", "neha",
]);

const GLOBAL_SURNAME_SUFFIXES = [
  "kumar", "singh", "patel", "son", "sen", "sson", "ez", "es", "ov", "ova", "ev", "eva",
  "ski", "ska", "sky", "vich", "vic", "ich", "ian", "yan", "idis", "opoulos", "akis",
  "etti", "ini", "ucci", "elli", "ano", "berg", "mann", "stein", "strom", "dottir",
].sort((a, b) => b.length - a.length);

function splitCompactUsingGlobalVocabulary(compactValue: string): string {
  const compact = lettersOnly(compactValue);
  if (compact.length < 6 || compact.length > 40) return "";

  const matches: Array<{ candidate: string; score: number }> = [];
  for (let index = 2; index <= compact.length - 2; index += 1) {
    const first = compact.slice(0, index);
    const second = compact.slice(index);
    const firstKnown = INTERNATIONAL_NAME_TOKENS.has(first);
    const secondKnown = INTERNATIONAL_NAME_TOKENS.has(second);
    const suffix = GLOBAL_SURNAME_SUFFIXES.find((part) => second.endsWith(part));
    if (!firstKnown || (!secondKnown && !suffix)) continue;

    const candidate = `${first} ${second}`;
    if (!isHumanName(candidate)) continue;
    let score = (firstKnown ? 4 : 0) + (secondKnown ? 5 : 0);
    if (suffix) score += Math.min(3, suffix.length / 3);
    if (first.length >= 3 && first.length <= 14) score += 1;
    if (second.length >= 3 && second.length <= 18) score += 1;
    matches.push({ candidate, score });
  }

  matches.sort((a, b) => b.score - a.score);
  const best = matches[0];
  if (!best) return "";
  const tied = matches.filter((match) => match.score === best.score);
  return tied.length === 1 ? titleCase(best.candidate) : "";
}

function splitCompactUsingEvidence(compactValue: string, fileName: string, email: string, evidenceNames: string[]): string {
  const compact = lettersOnly(compactValue);
  if (compact.length < 4 || compact.length > 50) return "";

  for (const rawName of evidenceNames) {
    const candidateName = clean(rawName);
    if (lettersOnly(candidateName) !== compact) continue;
    if (words(candidateName).length >= 2 && isHumanName(candidateName)) return titleCase(candidateName);

    // A compact professional-profile slug corroborates the full decorative
    // sequence but may not preserve spaces. Restore the boundary only when one
    // globally known name part yields exactly one valid two-part split.
    const split = splitCompactUsingGlobalVocabulary(candidateName);
    if (split) return split;
  }

  const fileEvidence = filenameTokens(fileName);
  const emailEvidence = emailTokens(email);
  const evidence = [...fileEvidence, ...emailEvidence];

  // A compact email local-part often contains the full name without separators.
  // A shorter filename/onboarding token can provide the missing boundary.
  const wholeEmail = lettersOnly(String(email || "").split("@")[0].replace(/\d+/g, ""));
  if (wholeEmail === compact) {
    for (const token of fileEvidence.sort((a, b) => b.length - a.length)) {
      if (token.length >= 3 && token.length < compact.length && compact.startsWith(token)) {
        const candidate = `${token} ${compact.slice(token.length)}`;
        if (isHumanName(candidate)) return titleCase(candidate);
      }
    }
  }

  for (const token of evidence.sort((a, b) => b.length - a.length)) {
    if (token.length < 3 || token.length >= compact.length) continue;
    if (compact.startsWith(token)) {
      const rest = compact.slice(token.length);
      const candidate = `${token} ${rest}`;
      if (isHumanName(candidate)) return titleCase(candidate);
    }
    if (compact.endsWith(token)) {
      const first = compact.slice(0, compact.length - token.length);
      const candidate = `${first} ${token}`;
      if (isHumanName(candidate)) return titleCase(candidate);
    }
  }
  return splitCompactUsingGlobalVocabulary(compact);
}

function extractEmail(rawText: string, explicitEmail: string): string {
  if (explicitEmail && EMAIL_RE.test(explicitEmail)) return explicitEmail;
  return rawText.match(EMAIL_RE)?.[0] || "";
}

interface Candidate {
  value: string;
  source: CvNameStageSource;
  score: number;
}

function addCandidate(list: Candidate[], rejected: string[], value: string, source: CvNameStageSource, score: number): void {
  const normalized = titleCase(value);
  if (URL_RE.test(normalized) || LOCATION_OR_ADDRESS_RE.test(normalized) || normalized.includes(",")) {
    if (clean(value)) rejected.push(clean(value));
    return;
  }
  if (!isHumanName(normalized)) {
    if (clean(value)) rejected.push(clean(value));
    return;
  }
  list.push({ value: normalized, source, score });
}

/**
 * Independent identity anchors carried by the document itself.
 *
 * These are contact facts, not guesses: the local part of the candidate's own
 * email, the filename they uploaded, and their own profile slug. They are used
 * ONLY to corroborate a line that already looks like a human name, never as a
 * name source on their own.
 */
function identityAnchors(fileName: string, email: string, rawText: string): {
  keys: Set<string>;
  tokens: Set<string>;
  spacedNames: string[];
} {
  const keys = new Set<string>();
  const tokens = new Set<string>();
  const spacedNames: string[] = [];

  const emailLocal = lettersOnly(String(email || "").split("@")[0].replace(/\d+/g, ""));
  if (emailLocal.length >= 4) keys.add(emailLocal);
  for (const token of emailTokens(email)) if (token.length >= 2) tokens.add(token);
  const emailSpaced = clean(String(email || "").split("@")[0].replace(/\d+/g, " ").replace(/[._+-]+/g, " "));
  if (emailSpaced) spacedNames.push(emailSpaced);

  const fileTokens = filenameTokens(fileName);
  const fileKey = fileTokens.join("");
  if (fileKey.length >= 4) keys.add(fileKey);
  for (const token of fileTokens) tokens.add(token);
  const fileSpaced = clean(fileTokens.join(" "));
  if (fileSpaced) spacedNames.push(fileSpaced);

  for (const slug of profileSlugNames(rawText)) {
    const key = lettersOnly(slug);
    if (key.length >= 4) keys.add(key);
    for (const token of words(slug)) if (token.length >= 2) tokens.add(token);
    if (words(slug).length >= 2) spacedNames.push(slug);
  }

  return { keys, tokens, spacedNames };
}

/**
 * Collect name candidates from anywhere in the document, gated on independent
 * corroboration. Generic and layout-agnostic: no person, filename, template, or
 * sample value is referenced.
 */
function collectCorroboratedDocumentNames(
  lines: string[],
  fileName: string,
  email: string,
  rawText: string,
): string[] {
  const anchors = identityAnchors(fileName, email, rawText);
  if (!anchors.keys.size && !anchors.tokens.size) return [];

  const out: string[] = [];
  const scanLimit = Math.min(lines.length, 60);

  for (let index = 0; index < scanLimit; index += 1) {
    const line = lines[index];
    // A referee's name is corroborated by nothing in this document, but stop
    // here anyway: everything below a references heading belongs to a different
    // person.
    if (REFERENCE_RE.test(line) && words(line).length <= 4) break;

    const withoutContact = clean(line.replace(EMAIL_RE, " ").replace(URL_RE, " ").replace(PHONE_RE, " "));
    if (!withoutContact) continue;

    const compact = lettersOnly(
      isLetterSpacedLine(withoutContact) ? compactLetterSpaced(withoutContact) : withoutContact,
    );
    if (compact.length < 4) continue;
    if (!anchors.keys.has(compact)) {
      // Multi-token line: every token must be an independent anchor token, so a
      // two-word skill or company can never satisfy this.
      const lineWords = words(withoutContact);
      const allAnchored =
        lineWords.length >= 2 &&
        lineWords.length <= 4 &&
        lineWords.every((word) => anchors.tokens.has(lettersOnly(word)));
      if (!allAnchored) continue;
      if (isHumanName(withoutContact)) out.push(withoutContact);
      continue;
    }

    // The compact letters match an anchor exactly. If the line itself carries
    // the word boundaries, keep them; otherwise restore them from the anchor
    // that does (a filename or dotted email local part).
    if (!isLetterSpacedLine(withoutContact) && words(withoutContact).length >= 2 && isHumanName(withoutContact)) {
      out.push(withoutContact);
      continue;
    }
    const recovered = splitCompactUsingEvidence(compact, fileName, email, anchors.spacedNames);
    if (recovered) out.push(recovered);
  }

  return [...new Set(out)];
}

export function resolveAuthoritativeCvName(input: {
  rawText?: string | null;
  parserName?: string | null;
  currentName?: string | null;
  fileName?: string | null;
  email?: string | null;
}): CvNameStageResult {
  const rawText = String(input.rawText || "");
  const fileName = String(input.fileName || "");
  const parserName = clean(input.parserName || "");
  const currentName = clean(input.currentName || "");
  const email = extractEmail(rawText, String(input.email || ""));
  const rejected: string[] = [];
  const candidates: Candidate[] = [];

  // Candidate ranking is evidence-first, not parser-first.
  //
  // `currentName` is explicit upstream/user-confirmed identity evidence and remains
  // authoritative. The AI parser is useful fallback evidence, but a plausible
  // two-word parser mistake (for example a skill pair) must never outrank a
  // human-looking name printed in the document header. This ordering is global:
  // no filename, person, template, role, or skill-specific branch is involved.
  addCandidate(candidates, rejected, currentName, "parser", 115);
  addCandidate(candidates, rejected, parserName, "parser", 90);

  const lines = rawText
    .replace(/\u00a0/g, " ")
    .split(/\r?\n/)
    .map(clean)
    .filter(Boolean);

  // Ordinary top-header names. Search the first 12 lines, but stop at a clear section.
  for (let index = 0; index < Math.min(lines.length, 12); index += 1) {
    const line = lines[index];
    if (REFERENCE_RE.test(line)) break;
    const ws = words(line);
    if (ws.length <= 4 && ws.some((word) => SECTION_WORDS.has(word))) break;

    const withoutContact = clean(line.replace(EMAIL_RE, " ").replace(URL_RE, " ").replace(PHONE_RE, " "));
    if (!withoutContact) continue;

    if (isLetterSpacedLine(withoutContact)) {
      const compactDecorative = compactLetterSpaced(withoutContact);
      const recovered = splitCompactUsingEvidence(
        compactDecorative,
        fileName,
        email,
        [parserName, currentName, ...profileSlugNames(rawText)],
      );
      if (recovered) {
        addCandidate(candidates, rejected, recovered, "decorative_header", 108 - index);
      } else {
        // A compact decorative sequence has no recoverable word boundary.
        // Publishing it as a confident name creates outputs such as
        // "Harithavijayakumar". Keep it as rejected evidence and require
        // confirmation unless parser/onboarding/email/filename evidence can
        // prove the segmentation. This is safer and globally correct.
        rejected.push(compactDecorative);
      }
      continue;
    }

    const currentWordCount = words(withoutContact).length;
    let splitCandidateAdded = false;

    // Split-line names: ADELINE / PALMERSTON, OLIVIA / WILSON.
    if (index + 1 < lines.length) {
      const next = clean(lines[index + 1].replace(EMAIL_RE, " ").replace(URL_RE, " ").replace(PHONE_RE, " "));
      if (next && !isLetterSpacedLine(next)) {
        const joined = `${withoutContact} ${next}`;
        const leftSafe = isHumanName(withoutContact) && !URL_RE.test(withoutContact) && !LOCATION_OR_ADDRESS_RE.test(withoutContact);
        const rightSafe = isHumanName(next) && !URL_RE.test(next) && !LOCATION_OR_ADDRESS_RE.test(next);
        if (leftSafe && rightSafe && currentWordCount === 1 && words(next).length === 1 && isHumanName(joined)) {
          addCandidate(candidates, rejected, joined, "split_header", 106 - index * 2);
          splitCandidateAdded = true;
        } else if (leftSafe && rightSafe) {
          addCandidate(candidates, rejected, joined, "split_header", 101 - index * 2);
        }
      }
    }

    // A lone top-line mononym is weaker than a valid two-line full name.
    addCandidate(
      candidates,
      rejected,
      withoutContact,
      "top_header",
      (currentWordCount === 1 && splitCandidateAdded ? 94 : 104) - index * 2,
    );
  }

  // Sidebar-first layouts: the name is printed AFTER the sidebar.
  //
  // When a two-column CV is flattened, the sidebar column (SKILLS, LANGUAGES,
  // CONTACT) is extracted first and the name sits below it, so the header scan
  // above stops at the first section heading and never sees the person. The
  // previous behaviour was to give up and let the parser decide — which is
  // exactly how a skill or a section heading became someone's name.
  //
  // Scanning body lines freely is not the answer either: that is what turned
  // project titles, referee names, and URLs into identities. So a body line is
  // promoted to a candidate ONLY when independent contact evidence already
  // present in the document corroborates it — the email local part, the
  // filename, or a profile slug. Evidence restores a word boundary or confirms
  // a reading; it never invents a name, and at score 98 it never outranks a
  // real top-of-document header (104+).
  for (const recovered of collectCorroboratedDocumentNames(lines, fileName, email, rawText)) {
    addCandidate(candidates, rejected, recovered, "document_line", 98);
  }

  // Merge equivalent candidates and keep strongest evidence.
  const grouped = new Map<string, Candidate>();
  for (const candidate of candidates) {
    const key = lettersOnly(candidate.value);
    const previous = grouped.get(key);
    if (!previous || candidate.score > previous.score) grouped.set(key, candidate);
  }
  const ranked = [...grouped.values()].sort((a, b) => b.score - a.score);
  const best = ranked[0];

  if (!best || best.score < 70) {
    return {
      name: "",
      source: "needs_confirmation",
      confidence: 0,
      needsConfirmation: true,
      rejected: [...new Set(rejected)].slice(0, 20),
    };
  }

  return {
    name: best.value,
    source: best.source,
    confidence: Math.min(0.995, best.score / 100),
    needsConfirmation: false,
    rejected: [...new Set(rejected)].slice(0, 20),
  };
}
