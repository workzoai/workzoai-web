/*
  WorkZo AI - Global CV Identity Finalizer v47

  Purpose:
  - Keep backward compatibility with existing imports in app/api/cv/route.ts
  - Resolve candidate name safely from noisy PDF text, email, filename, and optional local parser output
  - Avoid selecting section headers, skills, universities, placeholder template text, company names, or generic export filenames

  Exports kept for compatibility:
  - resolveUniversalIdentityDecision
  - resolveUniversalIdentity
  - finalizeCanonicalCvProfile
  - enforceCanonicalCvProfileName
*/

export type UniversalValidationPayload = {
  fileName?: string;
  rawLines?: string[];
  rawText?: string;
  localParserName?: string;
  llmParser?: (textBlock: string) => Promise<string>;
};

export type IdentityDecision = {
  selectedName: string;
  selectedNameSource: string;
  rejectedCandidates: string[];
};

const GENERIC_NOISE_PATTERNS = [
  /\buntitled\b/i,
  /\bdesign\b/i,
  /\bcopy\s+of\b/i,
  /\bresume\s*template\b/i,
  /\byour\s+full\s+name\b/i,
  /\byour\s+name\b/i,
  /\bcurriculum\s+vitae\b/i,
  /\bwork\s+experience\b/i,
  /\bprofessional\s+experience\b/i,
  /\beducation\b/i,
  /\bcontact\b/i,
  /\bcontacts\b/i,
  /\bprofile\b/i,
  /\bprofile\s*info\b/i,
  /\bprofile\s*summary\b/i,
  /\bsummary\b/i,
  /\bhiring\s+manager\b/i,
  /\bcompany\s+name\b/i,
  /\bcandidate\b/i,
  /\bplaceholder\b/i,
  /\bdownload\b/i,
  /\bskills?\b/i,
  /\bexpertise\b/i,
  /\blanguages?\b/i,
  /\bcertifications?\b/i,
  /\bachievements?\b/i,
  /\bprojects?\b/i,
  /\bportfolio\b/i,
  /\btools?\b/i,
  /\baddress\b/i,
  /\bphone\b/i,
  /\bemail\b/i,
  /\blinkedin\b/i,
  /\bgithub\b/i,
  /\bwebsite\b/i,
  /\bwww\b/i,
  /\bhttp/i,
  /\bmanager\b/i,
  /\bengineer\b/i,
  /\bdeveloper\b/i,
  /\bdesigner\b/i,
  /\bscientist\b/i,
  /\banalyst\b/i,
  /\bconsultant\b/i,
  /\bteacher\b/i,
  /\baccountant\b/i,
  /\btechnician\b/i,
  /\bmarketing\b/i,
  /\bdigital\b/i,
  /\bproject\s+management\b/i,
  /\bleadership\b/i,
  /\bcommunication\b/i,
  /\bteam\s*player\b/i,
  /\bproblem\s*solving\b/i,
  /\btime\s*management\b/i,
  /\bweb\s*design\b/i,
  /\bsocial\s*media\b/i,
  /\bdata\s*analysis\b/i,
  /\bprogramming\b/i,
  /\baws\b/i,
  /\bsql\b/i,
  /\bpython\b/i,
  /\bjava\b/i,
  /\bgraphic\b/i,
  /\bgraphics\b/i,
  /\bproduct\b/i,
  /\bdesign\b/i,
  /\buniversity\b/i,
  /\bcollege\b/i,
  /\bschool\b/i,
  /\binstitute\b/i,
  /\bacademy\b/i,
  /\bbachelor\b/i,
  /\bmaster\b/i,
  /\bdegree\b/i,
  /\bdiploma\b/i,
];

const COMPANY_HINTS = /\b(gmbh|corp|corporation|company|technologies|technology|solutions|studio|agency|consulting|partners|group|ltd|limited|llc|inc|university|college|school|institute|academy)\b/i;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function fixSpacedTypography(line: string): string {
  if (!line) return "";
  const normalized = line.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "");

  // Collapse exploded typography when the majority of visible chars are single-letter tokens.
  const tokens = normalized.trim().split(/\s+/).filter(Boolean);
  if (tokens.length >= 3) {
    const singleLetterTokens = tokens.filter((token) => /^[A-Za-zÀ-ÖØ-öø-ÿ]$/.test(token)).length;
    if (singleLetterTokens / tokens.length >= 0.65) {
      return tokens.join("").trim();
    }
  }

  // Collapse cases such as "H A R I T H A V I J A Y A K U M A R" safely.
  if (/(?:[A-Za-zÀ-ÖØ-öø-ÿ]\s){2,}[A-Za-zÀ-ÖØ-öø-ÿ]/.test(normalized)) {
    return normalized.replace(/(?<=\b[A-Za-zÀ-ÖØ-öø-ÿ])\s(?=[A-Za-zÀ-ÖØ-öø-ÿ]\b)/g, "").trim();
  }

  return compact(normalized);
}

function splitJoinedCaps(line: string): string[] {
  const fixed = fixSpacedTypography(line);
  const tokens = fixed.split(/\s+/).filter(Boolean);

  // Handles cases like:
  // line0 = OLIVIA, line2 = WILSON externally via raw.split logic elsewhere.
  // Here keep single all-caps token as candidate too.
  if (tokens.length <= 4) return [fixed];
  return [fixed];
}

function tokenize(str: string): string {
  return (str || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function flattenAlpha(str: string): string {
  return tokenize(str).replace(/\s/g, "");
}

export function isGenericNoise(text: string): boolean {
  const clean = compact(fixSpacedTypography(text || ""));
  const alpha = tokenize(clean);
  const flatAlpha = alpha.replace(/\s+/g, "");
  if (!clean || alpha.length < 2 || clean.length > 70) return true;
  if (/(graphicdesigner|productdesigner|uxdesigner|webdesigner|marketingmanager|projectmanager|projectmanagement|datascientist|dataanalyst|supportengineer|softwareengineer|cybersecurityengineer|productengineer|prmanager|salesrepresentative|preschoolteacher|teachertrainee|programming|technicalskills|softskills)/i.test(flatAlpha)) return true;
  if (/[0-9@+]|https?:\/\/|www\.|\.com|\.net|\.org|\.de|\.io/i.test(clean)) return true;
  if (/\[[^\]]+\]/.test(clean)) return true;
  if (COMPANY_HINTS.test(clean)) return true;
  if (GENERIC_NOISE_PATTERNS.some((pattern) => pattern.test(clean) || pattern.test(alpha))) return true;
  if (clean.split(/\s+/).length > 5) return true;
  if (/[,;:|/\\]/.test(clean)) return true;
  return false;
}

function looksLikePersonName(text: string): boolean {
  const clean = compact(fixSpacedTypography(text || ""));
  if (isGenericNoise(clean)) return false;
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ'’.-]+(?:\s+[A-Za-zÀ-ÖØ-öø-ÿ'’.-]+){0,4}$/.test(clean)) return false;
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  // Reject all-lower generic words, accept uppercase/layout names.
  const hasNameShape = words.every((word) => /^[A-ZÀ-ÖØ-Þ]/.test(word) || word === word.toUpperCase());
  return hasNameShape;
}

function formatTitleCase(str: string): string {
  return compact(fixSpacedTypography(str || ""))
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
    .replace(/\bAi\b/g, "AI")
    .trim();
}

function cleanFileNameForName(fileName?: string): string {
  if (!fileName) return "";
  return compact(
    fileName
      .replace(/\.[^/.]+$/, "")
      .replace(/[_-]+/g, " ")
      .replace(/\([^)]*\)/g, " ")
      .replace(/\b(copy\s+of|copy|cv|resume|curriculum|vitae|final|updated|ats|modern|template|doc|pdf|data|de|en|german|english|minimalist|professional|workzo|cover\s+letter)\b/gi, " ")
      .replace(/\+?\d[\d\s().-]{5,}/g, " ")
  );
}

function extractEmailHandles(lines: string[]): string[] {
  const found: string[] = [];
  for (const line of lines) {
    for (const match of line.matchAll(EMAIL_RE)) {
      const email = match[0].toLowerCase();
      const handle = email.split("@")[0];
      if (/^(your|name|hello|info|contact|admin|test|example|email|mail|user)$/i.test(handle)) continue;
      if (/reallygreatsite|example|superduperseite/i.test(email)) continue;
      const cleaned = handle.replace(/[0-9]+/g, "").replace(/[._-]+/g, " ").trim();
      if (cleaned && !isGenericNoise(cleaned)) found.push(cleaned);
    }
  }
  return unique(found);
}

function splitEmailHandleIntoName(handle: string): string {
  const clean = handle
    .replace(/[._-]+/g, " ")
    .replace(/\d+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean || isGenericNoise(clean)) return "";
  if (clean.includes(" ")) return clean;

  // Conservative fallback. We do not invent word boundaries with a name dictionary here.
  return clean;
}

function generateRawCandidates(rawLines: string[]): Array<{ value: string; source: string; index: number }> {
  const lines = rawLines.map((line) => compact(fixSpacedTypography(line || ""))).filter(Boolean);
  const candidates: Array<{ value: string; source: string; index: number }> = [];

  // Normal candidates from all lines, not only top lines. This catches right-column / lower-header names.
  lines.forEach((line, index) => {
    for (const value of splitJoinedCaps(line)) {
      candidates.push({ value, source: `raw.line.${index}`, index });
    }
  });

  // Join adjacent single-token uppercase names separated by contact lines, e.g. OLIVIA / phone / WILSON.
  for (let i = 0; i < Math.min(lines.length, 20); i += 1) {
    const a = lines[i];
    if (!/^[A-ZÀ-ÖØ-Þ]{2,}$/.test(a)) continue;
    for (let j = i + 1; j <= Math.min(i + 4, lines.length - 1); j += 1) {
      const b = lines[j];
      if (/^[A-ZÀ-ÖØ-Þ]{2,}$/.test(b)) {
        candidates.push({ value: `${a} ${b}`, source: `raw.split.${i}.${j}`, index: i });
        break;
      }
    }
  }

  return candidates;
}


function hasExternalIdentitySupport(value: string, emailHandles: string[], fileNameCandidate: string): boolean {
  const flat = flattenAlpha(value);
  if (!flat) return false;

  for (const handle of emailHandles) {
    const flatHandle = flattenAlpha(handle);
    if (!flatHandle) continue;
    if (flatHandle.includes(flat) || flat.includes(flatHandle)) return true;

    const tokens = tokenize(value).split(" ").filter((token) => token.length >= 3);
    const hits = tokens.filter((token) => flatHandle.includes(token)).length;
    if (hits >= Math.min(2, tokens.length)) return true;
  }

  const flatFile = flattenAlpha(fileNameCandidate);
  if (flatFile) {
    if (flatFile.includes(flat) || flat.includes(flatFile)) return true;
    const tokens = tokenize(value).split(" ").filter((token) => token.length >= 3);
    const hits = tokens.filter((token) => flatFile.includes(token)).length;
    if (hits >= Math.min(2, tokens.length)) return true;
  }

  return false;
}

function supportedNameTokenCount(value: string, emailHandles: string[], fileNameCandidate: string): number {
  const tokens = tokenize(value).split(" ").filter((token) => token.length >= 3);
  if (!tokens.length) return 0;

  // For concatenated email handles, substring token matching can falsely accept
  // a distorted local-parser name ("harithavi" inside "harithavijayakumar").
  // Token support is therefore counted only against visibly separated support
  // text, such as "first.last", "first_last", or filename words.
  const separatedSupportTokens = [
    ...emailHandles,
    fileNameCandidate,
  ]
    .join(" ")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3);

  return tokens.filter((token) => separatedSupportTokens.includes(token)).length;
}

function hasExactRawLineSupport(value: string, rawLines: string[], maxIndex = 12): boolean {
  const wanted = tokenize(fixSpacedTypography(value || ""));
  if (!wanted) return false;
  return rawLines.slice(0, maxIndex).some((line) => tokenize(fixSpacedTypography(line || "")) === wanted);
}

function isUnsafeLocalParserWinner(
  candidate: { value: string; source: string; index: number; score: number },
  rawLines: string[],
  emailHandles: string[],
  fileNameCandidate: string,
): boolean {
  if (candidate.source !== "local.parser") return false;

  // Local PDF text is often column-broken and may invent boundaries inside a
  // compact header name. A local parser name is accepted only when it is exactly
  // present as an early rendered/text line, or when every meaningful name token
  // is supported by email/filename evidence. One partial token match is not
  // enough: e.g. "Harithavi Jayakumar" must not pass just because the email
  // contains "jayakumar".
  if (hasExactRawLineSupport(candidate.value, rawLines, 14)) return false;

  const tokens = tokenize(candidate.value).split(" ").filter((token) => token.length >= 3);
  const supported = supportedNameTokenCount(candidate.value, emailHandles, fileNameCandidate);
  if (tokens.length >= 2 && supported >= tokens.length) return false;

  return true;
}

function passesIdentityEvidenceGate(candidate: { value: string; source: string; index: number; score: number }, emailHandles: string[], fileNameCandidate: string, rawLines: string[] = []): boolean {
  if (isUnsafeLocalParserWinner(candidate, rawLines, emailHandles, fileNameCandidate)) return false;

  // Important global guard for placeholder/template CVs.
  // A late raw line such as "Data Engineering" or "Soft Skills" can have a
  // human-name shape, but it is not identity evidence unless corroborated by
  // vision, email, filename, or top-of-page placement. Do not promote it to a
  // candidate name just because it is two title-cased words.
  if (/^raw\.line\./.test(candidate.source) && candidate.index > 10 && !hasExternalIdentitySupport(candidate.value, emailHandles, fileNameCandidate)) {
    return candidate.score >= 55;
  }

  // Adjacent split names can be legitimate when a template puts first/last
  // name in separate boxes near the top. Keep those, but require stronger
  // evidence if the split happens deep in the document.
  if (/^raw\.split\./.test(candidate.source) && candidate.index > 10 && !hasExternalIdentitySupport(candidate.value, emailHandles, fileNameCandidate)) {
    return candidate.score >= 65;
  }

  return candidate.score >= 25;
}

function scoreNameCandidate(value: string, source: string, index: number, emailHandles: string[], fileNameCandidate: string): number {
  const clean = compact(fixSpacedTypography(value));
  if (!looksLikePersonName(clean)) return -999;

  let score = 0;
  const words = clean.split(/\s+/);
  const flat = flattenAlpha(clean);

  if (words.length === 2) score += 35;
  if (words.length === 3) score += 25;
  if (words.length === 4) score += 10;

  if (index <= 2) score += 25;
  else if (index <= 10) score += 12;
  else if (index <= 25) score += 4;
  else score -= 8;

  if (/raw\.split/.test(source)) score += 20;
  if (/^[A-ZÀ-ÖØ-Þ\s'-]+$/.test(clean)) score += 8;

  for (const handle of emailHandles) {
    const flatHandle = flattenAlpha(handle);
    if (flatHandle && (flatHandle.includes(flat) || flat.includes(flatHandle))) score += 60;
    else {
      const candidateTokens = tokenize(clean).split(" ");
      const handleTokenHits = candidateTokens.filter((token) => token.length >= 3 && flatHandle.includes(token)).length;
      score += handleTokenHits * 20;
    }
  }

  const flatFile = flattenAlpha(fileNameCandidate);
  if (flatFile) {
    if (flatFile.includes(flat) || flat.includes(flatFile)) score += 45;
    else {
      const candidateTokens = tokenize(clean).split(" ");
      const fileTokenHits = candidateTokens.filter((token) => token.length >= 3 && flatFile.includes(token)).length;
      score += fileTokenHits * 14;
    }
  }

  return score;
}

export async function resolveUniversalIdentityDecision(payload: UniversalValidationPayload): Promise<IdentityDecision> {
  const rawLines = payload.rawLines?.length
    ? payload.rawLines
    : payload.rawText
      ? payload.rawText.split(/\r?\n/)
      : [];

  const rejectedCandidates: string[] = [];
  const emailHandles = extractEmailHandles(rawLines);
  const fileNameCandidate = cleanFileNameForName(payload.fileName);

  // Optional LLM arbiter. It must be a candidate source, not an unconditional winner.
  let llmName = "";
  if (payload.llmParser) {
    try {
      const context = rawLines.slice(0, 45).map(fixSpacedTypography).join("\n");
      const maybe = compact(fixSpacedTypography(await payload.llmParser(context)));
      if (looksLikePersonName(maybe)) llmName = maybe;
      else if (maybe) rejectedCandidates.push(maybe);
    } catch (error) {
      console.error("[WorkZo CV Finalizer] LLM identity parser failed:", error);
    }
  }

  const candidates = generateRawCandidates(rawLines);

  if (payload.localParserName) {
    candidates.push({ value: payload.localParserName, source: "local.parser", index: 0 });
  }
  if (llmName) {
    candidates.push({ value: llmName, source: "llm", index: 0 });
  }
  if (fileNameCandidate && !isGenericNoise(fileNameCandidate)) {
    candidates.push({ value: fileNameCandidate, source: "filename", index: 0 });
  }

  const scored = candidates
    .map((candidate) => ({
      ...candidate,
      normalized: formatTitleCase(candidate.value),
      score: scoreNameCandidate(candidate.value, candidate.source, candidate.index, emailHandles, fileNameCandidate),
    }))
    .filter((candidate) => {
      if (candidate.score < 0) {
        if (candidate.value && rejectedCandidates.length < 30) rejectedCandidates.push(candidate.value);
        return false;
      }
      return true;
    })
    .sort((a, b) => b.score - a.score);

  const winner = scored[0];
  if (winner && passesIdentityEvidenceGate(winner, emailHandles, fileNameCandidate, rawLines)) {
    return {
      selectedName: winner.normalized,
      selectedNameSource: winner.source,
      rejectedCandidates: unique(rejectedCandidates).slice(0, 30),
    };
  }

  // Email handle reconstruction fallback: last safe fallback before Candidate.
  for (const handle of emailHandles) {
    const reconstructed = splitEmailHandleIntoName(handle);
    if (reconstructed && !isGenericNoise(reconstructed)) {
      return {
        selectedName: formatTitleCase(reconstructed),
        selectedNameSource: "email.handle",
        rejectedCandidates: unique(rejectedCandidates).slice(0, 30),
      };
    }
  }

  return {
    selectedName: "Candidate",
    selectedNameSource: "fallback",
    rejectedCandidates: unique(rejectedCandidates).slice(0, 30),
  };
}

export async function resolveUniversalIdentity(payload: UniversalValidationPayload): Promise<string> {
  const decision = await resolveUniversalIdentityDecision(payload);
  return decision.selectedName;
}

export function enforceCanonicalCvProfileName<T extends Record<string, any>>(profile: T, selectedName: string): T {
  const basics = typeof profile?.basics === "object" && profile.basics ? profile.basics : {};
  const finalName = selectedName && selectedName.trim() ? selectedName.trim() : basics.name || profile.name || profile.candidateName || "Candidate";

  return {
    ...profile,
    name: finalName,
    candidateName: finalName,
    basics: {
      ...basics,
      name: finalName,
    },
  };
}

// Backward-compatible export required by app/api/cv/route.ts.
function resolveUniversalIdentityDecisionSync(payload: UniversalValidationPayload & { source?: string; confidence?: any }): IdentityDecision {
  const rawLines = payload.rawLines?.length
    ? payload.rawLines
    : payload.rawText
      ? payload.rawText.split(/\r?\n/)
      : [];

  const rejectedCandidates: string[] = [];
  const emailHandles = extractEmailHandles(rawLines);
  const fileNameCandidate = cleanFileNameForName(payload.fileName);
  const candidates = generateRawCandidates(rawLines);

  const parserName = compact(fixSpacedTypography(payload.localParserName || ""));
  const isVisionSource = payload.source === "vision_structured_cv";

  // Vision has already read the rendered layout. If it produced a plausible
  // human name, do not send it back through fragile flattened-text rules or a
  // confidence threshold. Low-confidence vision names such as 0.62 are still
  // useful; the caller can keep needsConfirmation=true.
  if (isVisionSource && looksLikePersonName(parserName)) {
    return {
      selectedName: formatTitleCase(parserName),
      selectedNameSource: "vision_structured_cv",
      rejectedCandidates: [],
    };
  }

  if (parserName && parserName !== "Candidate") {
    candidates.push({ value: parserName, source: isVisionSource ? "vision.invalid_name" : "local.parser", index: 0 });
  }

  if (fileNameCandidate && !isGenericNoise(fileNameCandidate)) {
    // Filename is only a weak candidate. It can help corroborate another
    // source, but scoreNameCandidate gives it no special source bonus.
    candidates.push({ value: fileNameCandidate, source: "filename", index: 99 });
  }

  const scored = candidates
    .map((candidate) => ({
      ...candidate,
      normalized: formatTitleCase(candidate.value),
      score: scoreNameCandidate(candidate.value, candidate.source, candidate.index, emailHandles, fileNameCandidate),
    }))
    .filter((candidate) => {
      if (candidate.score < 0) {
        if (candidate.value && rejectedCandidates.length < 40) rejectedCandidates.push(candidate.value);
        return false;
      }
      return true;
    })
    .sort((a, b) => b.score - a.score);

  const winner = scored[0];
  if (winner && passesIdentityEvidenceGate(winner, emailHandles, fileNameCandidate, rawLines)) {
    return {
      selectedName: winner.normalized,
      selectedNameSource: winner.source,
      rejectedCandidates: unique(rejectedCandidates).slice(0, 40),
    };
  }

  // Email handle is useful, but only when it already contains clear separators
  // or multiple name-like tokens. Do not invent a fake one-word name from
  // handles like hello@, info@, or danimartinez@.
  for (const handle of emailHandles) {
    const reconstructed = splitEmailHandleIntoName(handle);
    if (reconstructed && looksLikePersonName(reconstructed)) {
      return {
        selectedName: formatTitleCase(reconstructed),
        selectedNameSource: "email.handle",
        rejectedCandidates: unique(rejectedCandidates).slice(0, 40),
      };
    }
  }

  return {
    selectedName: "Candidate",
    selectedNameSource: "needs_confirmation",
    rejectedCandidates: unique(rejectedCandidates).slice(0, 40),
  };
}


const SINGLE_WORD_HEADLINE_FRAGMENTS = /^(analyst|scientist|engineer|developer|manager|designer|specialist|consultant|administrator|coordinator|assistant|professional|intern|trainee)$/i;
const HEADLINE_SECTION_NOISE = /^(profile|summary|contact|skills?|experience|education|languages?|certifications?|projects?|portfolio|references?)$/i;
const HEADLINE_ROLE_WORDS = /\b(junior|senior|lead|principal|staff|graduate|intern|trainee|data|business|financial|marketing|product|project|technical|support|software|frontend|backend|full[-\s]?stack|machine\s+learning|ml|ai|cloud|devops|security|cybersecurity|qa|quality|customer|success|sales|operations|hr|human\s+resources|analyst|scientist|engineer|developer|manager|designer|specialist|consultant|administrator|coordinator|assistant|architect|director|officer)\b/i;

const JOINED_HEADLINE_MAP: Record<string, string> = {
  juniordataanalyst: "Junior Data Analyst",
  juniordatascientist: "Junior Data Scientist",
  dataanalyst: "Data Analyst",
  datascientist: "Data Scientist",
  businessanalyst: "Business Analyst",
  softwareengineer: "Software Engineer",
  technicalsupportengineer: "Technical Support Engineer",
  itsupportspecialist: "IT Support Specialist",
  customersuccessmanager: "Customer Success Manager",
  productmanager: "Product Manager",
  projectmanager: "Project Manager",
  machinelearningengineer: "Machine Learning Engineer",
};

function expandJoinedHeadline(value: string): string {
  const clean = compact(fixSpacedTypography(value || ""));
  const key = flattenAlpha(clean);
  return JOINED_HEADLINE_MAP[key] || clean;
}

function normalizeHeadlineText(value: string): string {
  return expandJoinedHeadline(value)
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      if (/^(ai|ml|qa|hr|ui|ux|it|sql|aws|gcp)$/i.test(word)) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ")
    .replace(/\bAnd\b/g, "and")
    .trim();
}

function isValidGlobalHeadline(value: string): boolean {
  const clean = expandJoinedHeadline(value);
  if (!clean || clean.length < 4 || clean.length > 90) return false;
  if (HEADLINE_SECTION_NOISE.test(clean)) return false;
  if (SINGLE_WORD_HEADLINE_FRAGMENTS.test(clean)) return false;
  if (/[0-9@+]|https?:\/\/|www\.|\.com|\.net|\.org|\.de|\.io/i.test(clean)) return false;
  if (/\b(years of|responsible for|provided|assisting|clients|customers|summary|profile)\b/i.test(clean)) return false;
  return HEADLINE_ROLE_WORDS.test(clean);
}

function extractBestHeadlineFromRaw(rawLines: string[], currentName: string): string {
  const lines = rawLines.map((line) => compact(fixSpacedTypography(line || ""))).filter(Boolean);
  const nameFlat = flattenAlpha(currentName);
  const max = Math.min(lines.length, 30);
  const candidates: Array<{ value: string; score: number }> = [];

  for (let i = 0; i < max; i += 1) {
    const line = expandJoinedHeadline(lines[i]);
    if (!line || (nameFlat && flattenAlpha(line) === nameFlat)) continue;
    if (!isValidGlobalHeadline(line)) continue;

    const words = line.split(/\s+/).length;
    let score = 80 - i;
    if (words >= 2) score += 30;
    if (/\b(junior|senior|lead|principal|graduate|intern|trainee)\b/i.test(line)) score += 10;
    if (/\b(data|business|software|technical|support|customer|product|project)\b/i.test(line)) score += 10;
    candidates.push({ value: line, score });
  }

  return candidates.sort((a, b) => b.score - a.score)[0]?.value || "";
}

function finalizeProfileHeadline<T extends Record<string, any>>(profile: T, rawText = ""): T {
  const basics = typeof profile?.basics === "object" && profile.basics ? profile.basics : {};
  const current = compact(String((basics as any).headline || (profile as any).headline || ""));
  const rawLines = rawText ? rawText.split(/\r?\n/) : [];
  const rawHeadline = extractBestHeadlineFromRaw(rawLines, String((basics as any).name || (profile as any).name || ""));

  const selected = isValidGlobalHeadline(current) ? current : rawHeadline;
  const finalHeadline = selected ? normalizeHeadlineText(selected) : (current && !SINGLE_WORD_HEADLINE_FRAGMENTS.test(current) ? normalizeHeadlineText(current) : "Professional");

  return {
    ...profile,
    basics: {
      ...basics,
      headline: finalHeadline,
    },
    headline: finalHeadline,
  };
}

// Backward-compatible export required by app/api/cv/route.ts.
// IMPORTANT: this function is intentionally synchronous because the API routes
// call it synchronously. Do not make this async unless every caller awaits it.
export function finalizeCanonicalCvProfile<T extends Record<string, any>>(
  profile: T,
  options?: {
    fileName?: string;
    rawLines?: string[];
    rawText?: string;
    selectedName?: string;
    source?: string;
    confidence?: any;
  }
): T {
  const basics = typeof profile?.basics === "object" && profile.basics ? profile.basics : {};

  const decision = resolveUniversalIdentityDecisionSync({
    fileName: options?.fileName || "",
    rawLines: options?.rawLines,
    rawText: options?.rawText || "",
    localParserName:
      options?.selectedName ||
      basics.name ||
      profile.candidateName ||
      profile.name ||
      "",
    source: options?.source,
    confidence: options?.confidence,
  });

  const namedProfile = enforceCanonicalCvProfileName(profile, decision.selectedName);
  const next = finalizeProfileHeadline(namedProfile, options?.rawText || "");
  const oldConfidence = typeof (next as any).confidence === "object" && (next as any).confidence ? (next as any).confidence : {};

  return {
    ...next,
    confidence: {
      ...oldConfidence,
      nameSource: decision.selectedNameSource,
      rejectedNameCandidates: decision.rejectedCandidates,
    },
    needsConfirmation:
      (profile as any).needsConfirmation === true ||
      decision.selectedName === "Candidate" ||
      decision.selectedNameSource === "needs_confirmation" ||
      decision.selectedNameSource === "filename",
  } as T;
}

export default finalizeCanonicalCvProfile;
