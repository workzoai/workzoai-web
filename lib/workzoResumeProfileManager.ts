import type { ResumeProfile } from "@/lib/workzoResumeParser";

function cleanText(value: unknown, max = 50000) {
  if (typeof value !== "string") return "";
  return value
    .replace(/\u0000/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

function norm(value: unknown) {
  return cleanText(value, 500)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


// Extract a clean email from a field that may have phone number concatenated.
// e.g. "+123-456-7890hello@reallygreatsite.com" → "hello@reallygreatsite.com"
function cleanEmail(value: unknown): string {
  if (typeof value !== "string") return "";
  const match = value.match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/);
  return match ? match[0].toLowerCase() : "";
}

function unique<T>(items: T[], keyFn: (item: T) => string) {
  const seen = new Set<string>();
  const out: T[] = [];

  for (const item of items) {
    const key = norm(keyFn(item));
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
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

function compactDecorativeLine(line: string) {
  const cleaned = cleanText(line, 200)
    .replace(/[•●▪◦]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = cleaned.split(/\s+/).filter(Boolean);

  // H A R I T H A V I J A Y A K U M A R -> HARITHAVIJAYAKUMAR
  if (tokens.length >= 4 && tokens.every((token) => /^\p{Lu}$/u.test(token))) {
    return tokens.join("");
  }

  return cleaned;
}

function prepareLines(rawText: string) {
  return String(rawText || "")
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map(compactDecorativeLine)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 180);
}

const STRONG_SECTION_RE = /^(about\s+me|awards?|awards?\s+received|berufliches\s+profil|berufserfahrung|bildung|bildungsweg|contacts?|core\s+competencies|education|education\s+and\s+training|erfolge\s+beim\s+kunden|experience|expertise|fähigkeiten|fahigkeiten|kontakt|languages?|overview|professional\s+experience|professional\s+summary|profile|profile\s+overview|profile\s+summary|profil(?:\s*übersicht|\s*ubersicht)?|projects?|references?|skills?|summary|summary\s+of\s+skills|work\s+experience|certifications?|zertifikate)$/i;

const BAD_NAME_WORD_RE = /\b(candidate|professional|unknown|resume|cv|curriculum|profile|profilesummary|summary|experience|workexperience|education|skills?|projects?|languages?|contact|email|phone|linkedin|github|headline|english|german|deutsch|dutch|french|spanish|italian|portuguese|fluent|native|conversational|support|engineer|analyst|manager|specialist|developer|consultant|technical|data|customer|success|sales|marketing|product|project|program|software|frontend|backend|fullstack|itil|itsm|api|sql|python|tableau|power\s*bi|gcp|aws|rag|nlp|machine\s+learning|matplotlib|seaborn|tensorflow|sklearn|langchain|programming|bash|powershell|security|cloud|ticketing|roadmapping|agile|scrum|stakeholder|competencies|initiative|platform|dashboard|teacher|preschool|accountant|designer|coordinator|assistant|intern|school|university|college|industries|solutions|community|financial|senior|junior|principal|chief|jede|stadt|straße|strasse|anywhere|magist)\b/i;

const ROLE_TITLE_RE = /\b(graphic\s+designer|financial\s+accountant|senior\s+accountant|professional\s+accountant|product\s+manager|project\s+manager|product\s+design\s+engineer|technical\s+support|support\s+engineer|customer\s+success|data\s+analyst|software\s+engineer|cybersecurity\s+engineer|cybersecurity\s+analyst|ux\s+designer|ui\s+designer|account\s+manager|sales\s+manager|business\s+analyst|it\s+support|it\s+project\s+manager|preschool\s+teacher|freelance\s+tutor|volunteer\s+preschool\s+assistant|communications\s+coordinator|pr\s+manager|pr\s+specialist|cloud\s+security|threat\s+detection|application\s+engineer)\b/i;

const ORG_WORD_RE = /\b(gmbh|ug|ag|kg|ltd|limited|llc|inc|corp|corporation|company|co\.?|group|holding|services|solutions|systems|technologies|technology|software|digital|media|industries|university|college|school|schule|hochschule|institute|academy|akademie|foundation|department|bootcamp|preschool|kindergarten)\b/i;

const CONTACT_LOCATION_RE = /@|www\.|https?:|linkedin|github|\+?\d[\d\s()./-]{5,}|\b(street|strasse|straße|road|avenue|weg|platz|city|town|germany|deutschland|india|canada|usa|uk|munich|münchen|w[üu]rzburg|berlin|chennai|london|anywhere|address|adresse)\b/i;

const DATE_RE = /\b(?:19|20)\d{2}\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|present|current|heute)\b/i;

function normalizedNameKey(value: unknown) {
  return norm(value).replace(/\s+/g, "");
}

export function isDefinitelyNotHumanName(value: unknown): boolean {
  const raw = cleanText(value, 160);
  if (!raw) return true;
  if (STRONG_SECTION_RE.test(raw)) return true;
  if (BAD_NAME_WORD_RE.test(raw)) return true;
  if (ROLE_TITLE_RE.test(raw)) return true;
  if (ORG_WORD_RE.test(raw)) return true;
  if (CONTACT_LOCATION_RE.test(raw)) return true;
  if (DATE_RE.test(raw)) return true;
  return false;
}

export function validateCandidateName(value: unknown): string {
  const raw = cleanText(value, 120)
    .replace(/^(candidate\s*name|name|applicant)\s*[:\-]\s*/i, "")
    .replace(/[^\p{L}' .-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!raw || raw.length < 3 || raw.length > 70) return "";
  if (isDefinitelyNotHumanName(raw)) return "";

  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 5) return "";
  if (parts.some((part) => part.length < 2 || part.length > 28)) return "";
  if (new Set(parts.map((part) => part.toLowerCase())).size === 1) return "";

  const badParts = parts.filter((part) => BAD_NAME_WORD_RE.test(part) || ROLE_TITLE_RE.test(part)).length;
  if (badParts >= Math.ceil(parts.length / 2)) return "";

  const looksLikeName =
    raw === raw.toUpperCase() ||
    parts.filter((part) => /^[A-ZÀ-ÝÄÖÜ]/u.test(part)).length >= Math.max(2, parts.length - 1);

  if (!looksLikeName) return "";
  return titleCaseName(raw);
}

export function extractNameFromFileName(fileName = ""): string {
  const clean = String(fileName || "")
    .replace(/(?:\.(pdf|docx|doc|txt))+$/gi, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\d+/g, " ")
    .split(/\s+/)
    .filter(
      (word) =>
        word.length >= 3 &&
        !/^(resume|cv|lebenslauf|bewerbung|curriculum|vitae|updated|final|copy|draft|template|sample|example|untitled|design|new|old|my|the|test|advanced|professional|pdf|docx|deu|csm)$/i.test(word),
    )
    .join(" ")
    .trim();

  return validateCandidateName(clean);
}

export function extractNameFromEmail(rawText: string): string {
  const email = String(rawText || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  if (!email) return "";

  const local = email
    .split("@")[0]
    .replace(/\d+/g, " ")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const direct = validateCandidateName(local);
  if (direct) return direct;

  const camel = local
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim();

  const camelName = validateCandidateName(camel);
  if (camelName) return camelName;

  return "";
}

function nameAppearsInStructuredContent(profile: Partial<ResumeProfile> | ResumeProfile | null | undefined, name: string) {
  const key = norm(name);
  if (!profile || !key) return false;

  const p = profile as ResumeProfile;
  const haystacks = [
    ...(Array.isArray(p.skills) ? p.skills : []),
    ...(Array.isArray(p.languages) ? p.languages : []),
    ...(Array.isArray(p.projects) ? p.projects.map((x) => x?.name || "") : []),
    ...(Array.isArray(p.experience) ? p.experience.flatMap((x) => [x?.title || "", x?.company || ""]) : []),
    ...(Array.isArray(p.education) ? p.education.flatMap((x) => [x?.degree || "", x?.institution || ""]) : []),
  ];

  return haystacks.some((item) => norm(item) === key);
}

export function extractCanonicalCandidateName(
  rawText: string,
  fileName = "",
  parserName = "",
  knownName = "",
): string {
  const lines = prepareLines(rawText);
  const candidates: Array<{ name: string; score: number; reason: string }> = [];

  const knownCandidate = validateCandidateName(knownName);
  if (knownCandidate) candidates.push({ name: knownCandidate, score: 200, reason: "known" });

  const fileNameCandidate = extractNameFromFileName(fileName);
  if (fileNameCandidate) candidates.push({ name: fileNameCandidate, score: 170, reason: "file" });

  const emailName = extractNameFromEmail(rawText);
  if (emailName) candidates.push({ name: emailName, score: 90, reason: "email" });

  const parserCandidate = validateCandidateName(parserName);
  if (parserCandidate) candidates.push({ name: parserCandidate, score: 30, reason: "parser-low" });

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (isDefinitelyNotHumanName(line)) continue;

    const name = validateCandidateName(line);
    if (!name) continue;

    const prev = lines[i - 1] || "";
    const next = lines[i + 1] || "";
    const near = `${prev} ${next}`;

    let score = i < 8 ? 120 : i < 20 ? 90 : i < 50 ? 55 : i < 100 ? 25 : 10;
    if (line === line.toUpperCase()) score += 8;
    if (ROLE_TITLE_RE.test(prev) || ROLE_TITLE_RE.test(next)) score += 15;
    if (CONTACT_LOCATION_RE.test(near)) score += 8;
    if (ORG_WORD_RE.test(near) && i > 8) score -= 25;
    if (i > 25 && BAD_NAME_WORD_RE.test(line)) score -= 100;

    candidates.push({ name, score, reason: `line:${i}` });
  }

  // Two-line names: SURENDER / DILLIBABU.
  for (let i = 0; i < Math.min(lines.length - 1, 80); i += 1) {
    const a = lines[i];
    const b = lines[i + 1];
    if (
      /^[\p{L}'-]{3,25}$/u.test(a) &&
      /^[\p{L}'-]{3,25}$/u.test(b) &&
      !isDefinitelyNotHumanName(a) &&
      !isDefinitelyNotHumanName(b)
    ) {
      const combined = validateCandidateName(`${a} ${b}`);
      if (combined) candidates.push({ name: combined, score: i < 8 ? 135 : i < 20 ? 100 : 50, reason: `two-line:${i}` });
    }
  }

  // Compact confirmation: HARITHAVIJAYAKUMAR must become Haritha Vijayakumar when confirmed by file/email.
  for (let i = 0; i < Math.min(lines.length, 120); i += 1) {
    const compact = normalizedNameKey(lines[i]);
    if (compact.length < 8) continue;

    for (const sourceName of [fileNameCandidate, emailName, knownCandidate]) {
      if (sourceName && compact === normalizedNameKey(sourceName)) {
        candidates.push({ name: sourceName, score: i < 25 ? 190 : 150, reason: `compact-confirmed:${i}` });
      }
    }
  }

  const bestByName = new Map<string, { name: string; score: number; reason: string }>();
  for (const candidate of candidates) {
    const name = validateCandidateName(candidate.name);
    if (!name) continue;
    const key = norm(name);
    const existing = bestByName.get(key);
    if (!existing || candidate.score > existing.score) bestByName.set(key, { ...candidate, name });
  }

  const best = [...bestByName.values()].sort((a, b) => b.score - a.score)[0];
  return best && best.score >= 40 ? best.name : "";
}

function chooseSaferName(
  current: string,
  canonical: string,
  profile?: Partial<ResumeProfile> | ResumeProfile | null,
) {
  const currentValid = validateCandidateName(current);
  const canonicalValid = validateCandidateName(canonical);

  if (canonicalValid && !nameAppearsInStructuredContent(profile, canonicalValid)) return canonicalValid;
  if (currentValid && !nameAppearsInStructuredContent(profile, currentValid)) return currentValid;
  if (canonicalValid) return canonicalValid;
  if (currentValid) return currentValid;
  return "Candidate";
}

export function enforceCanonicalCandidateName<T extends Partial<ResumeProfile> | ResumeProfile>(
  profile: T,
  rawText = "",
  fileName = "",
  knownName = "",
): T {
  const next = { ...(profile || {}) } as T & { basics?: ResumeProfile["basics"]; warnings?: string[] };
  next.basics = { ...(next.basics || {}) } as ResumeProfile["basics"];

  const current = next.basics?.name || "";
  const canonical = extractCanonicalCandidateName(
    rawText || (next as ResumeProfile).rawText || "",
    fileName,
    current,
    knownName,
  );

  next.basics.name = chooseSaferName(current, canonical, next);

  // Always clean the email field — fixes phone+email concatenation from PDF extraction
  // e.g. "+123-456-7890hello@reallygreatsite.com" → "hello@reallygreatsite.com"
  if (next.basics.email) {
    next.basics.email = cleanEmail(next.basics.email);
  }

  return next as T;
}

export function isValidHumanName(value: unknown): boolean {
  return Boolean(validateCandidateName(value));
}

export function cleanHumanName(value: unknown): string {
  return validateCandidateName(value);
}


export function completeResumeProfile(profile: Partial<ResumeProfile> | null | undefined, rawText = ""): ResumeProfile {
  const p = (profile || {}) as Partial<ResumeProfile>;
  const basics = (p.basics || {}) as ResumeProfile["basics"];

  // If basics.name is already a valid human name, trust it and do not re-derive
  // from rawText. Re-deriving overwrites correct names when the raw text starts
  // with skill words or section headers (common in two-column PDF extractions).
  const existingValidName = validateCandidateName(basics.name);
  const resolvedName = existingValidName ||
    chooseSaferName(basics.name, extractCanonicalCandidateName(rawText || p.rawText || "", "", basics.name), p);

  return {
    rawText: cleanText(p.rawText || rawText, 50000),
    basics: {
      name: resolvedName,
      headline: cleanText(basics.headline, 200) || "Professional",
      email: cleanEmail(basics.email) || cleanText(basics.email, 200),
      phone: cleanText(basics.phone, 80),
      location: cleanText(basics.location, 200),
      linkedin: cleanText(basics.linkedin, 300),
    },
    summary: cleanText(p.summary, 1800),
    experience: unique(Array.isArray(p.experience) ? p.experience : [], (e) => `${e.company}|${e.title}|${e.dates}`).map((e) => ({
      title: cleanText(e.title, 180),
      company: cleanText(e.company, 180),
      location: cleanText(e.location, 180),
      dates: cleanText(e.dates, 80),
      bullets: Array.isArray(e.bullets) ? e.bullets.map((b) => cleanText(b, 500)).filter(Boolean).slice(0, 10) : [],
    })),
    education: unique(Array.isArray(p.education) ? p.education : [], (e) => `${e.institution}|${e.degree}|${e.dates}`)
      .map((e) => ({
        degree: cleanText(e.degree, 180),
        institution: cleanText(e.institution, 180),
        location: cleanText(e.location, 180),
        dates: cleanText(e.dates, 80),
      }))
      .sort((a, b) => {
        // Sort most-recent education first — normalises non-deterministic AI output ordering
        const yearA = a.dates.match(/\b(19|20)\d{2}\b/)?.[0];
        const yearB = b.dates.match(/\b(19|20)\d{2}\b/)?.[0];
        if (!yearA && !yearB) return 0;
        if (!yearA) return 1;
        if (!yearB) return -1;
        return Number(yearB) - Number(yearA);
      }),
    skills: unique(Array.isArray(p.skills) ? p.skills.map((s) => cleanText(s, 90)).filter(Boolean) : [], (s) => s).slice(0, 100),
    projects: unique(Array.isArray(p.projects) ? p.projects : [], (proj) => proj.name || proj.bullets?.join(" ") || "").map((proj) => ({
      name: cleanText(proj.name, 180) || "Selected Project",
      bullets: Array.isArray(proj.bullets) ? proj.bullets.map((b) => cleanText(b, 500)).filter(Boolean).slice(0, 10) : [],
    })),
    languages: unique(Array.isArray(p.languages) ? p.languages.map((l) => cleanText(l, 90)).filter(Boolean) : [], (l) => l),
    certifications: unique(Array.isArray(p.certifications) ? p.certifications.map((c) => cleanText(c, 160)).filter(Boolean) : [], (c) => c),
    strengths: unique(Array.isArray(p.strengths) ? p.strengths.map((s) => cleanText(s, 160)).filter(Boolean) : [], (s) => s),
    additionalEvidence: unique(Array.isArray(p.additionalEvidence) ? p.additionalEvidence.map((s) => cleanText(s, 300)).filter(Boolean) : [], (s) => s),
    warnings: unique(Array.isArray(p.warnings) ? p.warnings.map((s) => cleanText(s, 300)).filter(Boolean) : [], (s) => s),
    previewText: cleanText(p.previewText || rawText, 3000),
  };
}

export function isLowQualityResumeProfile(profile: unknown): boolean {
  if (!profile || typeof profile !== "object") return true;
  const p = profile as ResumeProfile;
  const name = p.basics?.name || "";
  if (!isValidHumanName(name)) return true;

  const nameKey = norm(name);
  if ((p.skills || []).some((s) => norm(s) === nameKey)) return true;
  if ((p.projects || []).some((proj) => norm(proj?.name) === nameKey)) return true;
  if ((p.experience || []).some((exp) => norm(exp?.title) === nameKey || norm(exp?.company) === nameKey)) return true;
  if ((p.education || []).some((edu) => norm(edu?.degree) === nameKey || norm(edu?.institution) === nameKey)) return true;

  const experienceCount = Array.isArray(p.experience) ? p.experience.length : 0;
  const educationCount = Array.isArray(p.education) ? p.education.length : 0;
  const skillCount = Array.isArray(p.skills) ? p.skills.length : 0;
  const projectCount = Array.isArray(p.projects) ? p.projects.length : 0;
  const summaryChars = cleanText(p.summary, 2000).length;

  if (experienceCount === 0 && educationCount === 0 && skillCount === 0 && projectCount === 0 && summaryChars < 40) return true;
  if (projectCount === 1 && /^(candidate|project|selected project|unknown)$/i.test(p.projects?.[0]?.name || "")) return true;

  return false;
}

export function profileScore(profile: unknown): number {
  if (!profile || typeof profile !== "object") return 0;
  const p = completeResumeProfile(profile as ResumeProfile, (profile as ResumeProfile).rawText || "");
  let score = 0;
  if (isValidHumanName(p.basics.name)) score += 30;
  if (p.summary.length > 40) score += 15;
  score += Math.min(35, p.experience.length * 12);
  score += Math.min(15, p.education.length * 6);
  score += Math.min(15, p.projects.length * 5);
  score += Math.min(15, Math.floor(p.skills.length / 3));
  score += Math.min(5, p.languages.length * 2);
  if (isLowQualityResumeProfile(p)) score -= 80;
  return score;
}

export function keepBetterProfile(candidate: ResumeProfile | Partial<ResumeProfile> | null | undefined, existing: ResumeProfile | Partial<ResumeProfile> | null | undefined, rawText = ""): ResumeProfile | undefined {
  const c = candidate ? completeResumeProfile(candidate, rawText) : undefined;
  const e = existing ? completeResumeProfile(existing, rawText) : undefined;
  if (!c && !e) return undefined;
  if (!c) return e && !isLowQualityResumeProfile(e) ? e : undefined;
  if (!e) return !isLowQualityResumeProfile(c) ? c : undefined;
  return profileScore(c) >= profileScore(e) ? c : e;
}

export function mergePreservingOriginalStructure(input: ResumeProfile, rewritten: Partial<ResumeProfile> | null | undefined): ResumeProfile {
  const original = completeResumeProfile(input, input.rawText || "");
  const out = completeResumeProfile(rewritten || {}, original.rawText || "");

  out.basics.name = original.basics.name;
  out.basics.email = original.basics.email;
  out.basics.phone = original.basics.phone;
  out.basics.location = original.basics.location;
  out.basics.linkedin = original.basics.linkedin;
  if (!out.basics.headline) out.basics.headline = original.basics.headline;
  if (!out.summary) out.summary = original.summary;

  out.experience = original.experience.map((old, index) => ({
    ...old,
    bullets: out.experience[index]?.bullets?.length ? out.experience[index].bullets : old.bullets,
  }));

  out.education = original.education.map((old) => old);

  out.projects = original.projects.map((old, index) => ({
    name: old.name,
    bullets: out.projects[index]?.bullets?.length ? out.projects[index].bullets : old.bullets,
  }));

  out.skills = unique([...out.skills, ...original.skills], (s) => s);
  out.languages = unique([...original.languages, ...out.languages], (s) => s);
  out.certifications = unique([...original.certifications, ...out.certifications], (s) => s);
  out.strengths = unique([...original.strengths, ...out.strengths], (s) => s);
  out.additionalEvidence = unique([...original.additionalEvidence, ...out.additionalEvidence], (s) => s);
  out.warnings = unique([...original.warnings, ...out.warnings], (s) => s);

  return completeResumeProfile(out, original.rawText || "");
}

export function resumeProfileHasMinimumStructure(profile: unknown): boolean {
  if (!profile || typeof profile !== "object") return false;
  const p = profile as ResumeProfile;
  return Boolean(
    (Array.isArray(p.experience) && p.experience.length > 0) ||
    (Array.isArray(p.education) && p.education.length > 0) ||
    (Array.isArray(p.skills) && p.skills.length > 0) ||
    (Array.isArray(p.projects) && p.projects.length > 0)
  );
}
