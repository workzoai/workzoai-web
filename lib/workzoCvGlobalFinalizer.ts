/*
 * WorkZo AI - global CV finalizer
 *
 * WHAT CHANGED (critical bug fix):
 * The previous version wrote the canonical identity decision to TOP-LEVEL
 * `profile.name` and `profile.headline`. ResumeProfile stores identity at
 * `basics.name` and `basics.headline` (see workzoResumeParser.ts). Nothing in
 * the app reads a resume profile's top-level `.name`. The result: the finalizer,
 * which every route calls as "the last profile-changing function" and then
 * freezes, was a no-op on the exact two fields it claims to protect. Its own
 * log line printed `finalProfile.basics?.name`, i.e. the PRE-finalizer value,
 * which is why the logs always looked correct while the rendered CV was wrong.
 *
 * This file now writes into `basics` (canonical) and mirrors to the top level
 * only for backward compatibility with any legacy caller. Public API, exported
 * names, and call signatures are unchanged, so this is a drop-in replacement.
 *
 * Global by construction: no candidate names, companies, schools, or CV samples.
 */

import type { ResumeProfile } from "./workzoResumeParser";
import { determineCanonicalIdentity, healSpacedHeaders, resolveTargetHeadline } from "./workzoCvIdentityEngine";

function safeString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function getEmail(profile: any): string {
  return safeString(profile?.email || profile?.basics?.email || profile?.contact?.email);
}

/** Read an identity field from any shape a caller might hand us. */
function readIdentityField(profile: any, field: "name" | "headline"): string {
  return safeString(profile?.basics?.[field] || profile?.[field]);
}

function canonical(value: unknown): string {
  return safeString(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSimilarity(a: unknown, b: unknown): number {
  const aa = new Set(canonical(a).split(" ").filter((x) => x.length > 2));
  const bb = new Set(canonical(b).split(" ").filter((x) => x.length > 2));
  if (!aa.size || !bb.size) return 0;
  let overlap = 0;
  for (const token of aa) if (bb.has(token)) overlap += 1;
  return overlap / Math.max(aa.size, bb.size);
}


const SECTION_OR_PLACEHOLDER_RE = /^(?:professional|profile|summary|skills?|education|projects?|languages?|contact|references?|work experience|professional experience|experience|overview|about me|your full name|address,? postal code,? city)$/i;
const ROLE_TOKEN_RE = /\b(?:manager|engineer|developer|designer|analyst|scientist|consultant|specialist|administrator|coordinator|director|lead|assistant|support|marketing|sales|project|product|teacher|accountant|technician|representative|security|cybersecurity|trainee|intern|ingenieur|spezialist|entwickler|berater|leiter)\b/i;
const CONTACT_RE = /@|https?:|www\.|\+?\d[\d\s().-]{6,}|\b\d{4,6}\b/;

function conservativeFinalizeExperience(rows: ResumeProfile["experience"] = []): ResumeProfile["experience"] {
  // FINAL-BOUNDARY INVARIANT: this layer is lossless for employment history.
  // Upstream parsing/integrity code may reconstruct and merge fragments. The
  // finalizer must never second-guess that result because doing so caused valid
  // 2/3-job profiles to collapse to 0/1 jobs in production.
  return (rows || []).map((source) => ({
    ...source,
    title: safeString(source?.title).trim(),
    company: safeString(source?.company).trim(),
    dates: safeString(source?.dates).trim(),
    bullets: [...(source?.bullets || [])].map((b) => safeString(b).trim()).filter(Boolean),
  })).filter((row) => row.title || row.company || row.dates || row.bullets.length);
}

function exactDedupeProjects(rows: ResumeProfile["projects"] = []): ResumeProfile["projects"] {
  const out: ResumeProfile["projects"] = [];
  const byName = new Map<string, number>();
  for (const source of rows || []) {
    const name = safeString(source.name).trim();
    if (!name || SECTION_OR_PLACEHOLDER_RE.test(name)) continue;
    const key = canonical(name);
    if (byName.has(key)) {
      const idx = byName.get(key)!;
      const prior = out[idx];
      const seen = new Set((prior.bullets || []).map(canonical));
      prior.bullets = [...(prior.bullets || []), ...(source.bullets || []).filter((b) => {
        const k = canonical(b);
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      })].slice(0, 12);
      continue;
    }
    byName.set(key, out.length);
    out.push({ ...source, bullets: [...(source.bullets || [])] });
  }
  return out;
}

const LANGUAGE_ALIASES: Record<string, string> = {
  english: "English", englisch: "English",
  german: "German", deutsch: "German",
  french: "French", francais: "French", français: "French", franzoesisch: "French", franzosisch: "French",
  spanish: "Spanish", spanisch: "Spanish",
  italian: "Italian", italienisch: "Italian",
  portuguese: "Portuguese", portugiesisch: "Portuguese",
  arabic: "Arabic", arabisch: "Arabic",
  tamil: "Tamil", turkish: "Turkish", türkisch: "Turkish",
  mandarin: "Mandarin", chinese: "Chinese", hindi: "Hindi", dutch: "Dutch", russian: "Russian", polish: "Polish",
};

function languageLevelRank(level: string): number {
  const v = canonical(level);
  if (/\bc2\b|native|mother tongue|muttersprache/.test(v)) return 7;
  if (/\bc1\b|fluent|fliessend|fliesend|professional working/.test(v)) return 6;
  if (/\bb2\b|professional|advanced|proficient|verhandlungssicher/.test(v)) return 5;
  if (/\bb1\b|intermediate|conversational|konversationsniveau/.test(v)) return 4;
  if (/\ba2\b|basic|basics|elementary|grundkenntnisse/.test(v)) return 3;
  if (/\ba1\b|beginner|anfanger/.test(v)) return 2;
  return 1;
}

function normalizeLanguages(values: string[] = []): string[] {
  const expanded: string[] = [];
  for (const value of values || []) {
    const text = safeString(value).trim();
    if (!text) continue;
    // Split composite parser output: "English (Fluent) - German (Intermediate)".
    const matches = [...text.matchAll(/\b(English|Englisch|German|Deutsch|French|Fran(?:ç|c)ais|Spanish|Italian|Portuguese|Arabic|Tamil|Turkish|Mandarin|Chinese|Hindi|Dutch|Russian|Polish)\b\s*(?:[-:()]\s*([^,;|()]+)\s*\)?)?/gi)];
    if (matches.length > 1) {
      for (const m of matches) expanded.push(`${m[1]}${m[2] ? ` - ${m[2].trim()}` : ""}`);
    } else expanded.push(text);
  }
  const map = new Map<string, { language: string; level: string; rank: number }>();
  for (const value of expanded) {
    const first = value.match(/\b(English|Englisch|German|Deutsch|French|Fran(?:ç|c)ais|Spanish|Italian|Portuguese|Arabic|Tamil|Turkish|Mandarin|Chinese|Hindi|Dutch|Russian|Polish)\b/i);
    if (!first) continue;
    const rawKey = canonical(first[1]).replace(/\s/g, "");
    const language = LANGUAGE_ALIASES[rawKey] || first[1];
    const trailing = value.slice((first.index || 0) + first[0].length)
      .replace(/^[\s:()\-–]+|[\s()]+$/g, "").trim();
    // Strip leaked references/contact/technical prose from the level.
    const level = CONTACT_RE.test(trailing) || trailing.split(/\s+/).length > 5 ? "" : trailing;
    const rank = languageLevelRank(level);
    const key = canonical(language);
    const current = map.get(key);
    if (!current || rank > current.rank) map.set(key, { language, level, rank });
  }
  return [...map.values()].map(({ language, level }) => level ? `${language} - ${level}` : language);
}

function collapseLetterSpacedLine(line: string): string {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 4) return line.trim();
  const singleRatio = tokens.filter((token) => /^\p{L}$/u.test(token)).length / tokens.length;
  if (singleRatio < 0.72) return line.trim();
  return tokens.join("");
}

function titleCaseName(value: string): string {
  return value.split(/\s+/).filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function recoverHeaderName(rawText: string): string {
  const rawLines = (rawText || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean).slice(0, 16);
  for (let index = 0; index < rawLines.length; index += 1) {
    let line = collapseLetterSpacedLine(rawLines[index]);

    // Some templates split a name across two adjacent lines ("OLIVIA" / "WILSON").
    if (/^[\p{L}'’-]{2,}$/u.test(line) && index + 1 < rawLines.length) {
      const next = collapseLetterSpacedLine(rawLines[index + 1]);
      if (/^[\p{L}'’-]{2,}$/u.test(next) && !ROLE_TOKEN_RE.test(next)) line = `${line} ${next}`;
    }

    if (CONTACT_RE.test(line) || SECTION_OR_PLACEHOLDER_RE.test(line) || ROLE_TOKEN_RE.test(line)) continue;
    const compact = line.replace(/[^\p{L}'’-]/gu, "");
    if (!compact || compact.length < 4 || compact.length > 45) continue;

    // A collapsed decorative name may have no spaces. Use email corroboration in
    // the identity engine, but never append the following role line here.
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length === 1 && rawLines[index].includes(" ")) {
      // Preserve a no-space candidate; determineCanonicalIdentity can compare it
      // to the email/filename. Do not fabricate word boundaries.
      return titleCaseName(line);
    }
    if (words.length < 2 || words.length > 4) continue;
    if (!words.every((w) => /^[\p{L}'’-]{2,}$/u.test(w))) continue;
    return titleCaseName(line);
  }
  return "";
}

function segmentCompactRole(line: string): string {
  const compact = line.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, "").toLowerCase();
  if (compact.length < 5 || compact.length > 70) return "";
  const dictionary = [
    "customer", "success", "technical", "support", "software", "security", "cybersecurity",
    "project", "product", "marketing", "sales", "graphic", "data", "information", "technology",
    "manager", "engineer", "developer", "designer", "analyst", "scientist", "consultant", "specialist",
    "administrator", "coordinator", "director", "assistant", "representative", "technician", "teacher",
    "accountant", "trainee", "intern", "lead", "senior", "junior", "professional", "preschool", "it", "pr", "qa",
    "technischer", "ingenieur", "spezialist", "entwickler", "berater", "leiter",
  ].sort((a, b) => b.length - a.length);
  const memo = new Map<number, string[] | null>();
  const solve = (index: number): string[] | null => {
    if (index === compact.length) return [];
    if (memo.has(index)) return memo.get(index)!;
    for (const word of dictionary) {
      if (!compact.startsWith(word, index)) continue;
      const rest = solve(index + word.length);
      if (rest) {
        const result = [word, ...rest];
        memo.set(index, result);
        return result;
      }
    }
    memo.set(index, null);
    return null;
  };
  const parts = solve(0);
  if (!parts || !parts.some((part) => ROLE_TOKEN_RE.test(part))) return "";
  return parts.map((part) => /^(it|pr|qa)$/.test(part) ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function isHeadlineNoise(line: string): boolean {
  const value = line.trim();
  if (!value || value.length > 85 || CONTACT_RE.test(value) || SECTION_OR_PLACEHOLDER_RE.test(value)) return true;
  if (/[.!?]$/.test(value) || value.split(/\s+/).length > 11) return true;
  if (/^(?:results[- ]driven|detail[- ]oriented|motivated|experienced|professional with|worked with|responsible for|passionate|proven|skilled in|adept at|i am|i'm)\b/i.test(value)) return true;
  if (/\b(?:summary|overview|skills?|proficiencies|education|certificate|graduation|university|college|school|contact|references?)\b/i.test(value) && !ROLE_TOKEN_RE.test(value)) return true;
  return false;
}

function recoverHeaderRole(rawText: string, selectedName: string): string {
  const lines = healSpacedHeaders(rawText || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean).slice(0, 12);
  const nameKey = canonical(selectedName);
  const candidates: Array<{ value: string; score: number }> = [];

  lines.forEach((line, index) => {
    if (canonical(line) === nameKey || isHeadlineNoise(line)) return;
    const clean = line.replace(/\s+/g, " ").trim();
    const segmented = segmentCompactRole(clean);
    const value = segmented || clean;
    if (!ROLE_TOKEN_RE.test(value)) return;

    let score = 100 - index * 9;
    // Header titles are normally directly below the name.
    if (index <= 2) score += 35;
    if (segmented) score += 18;
    if (/^[A-ZÀ-ÖØ-Þ0-9 &/|+.-]+$/.test(clean)) score += 8;
    if (/\b(?:project management|customer support|communication|teamwork|planning|negotiation)\b/i.test(value) && value.split(/\s+/).length <= 3) score -= 45;
    candidates.push({ value, score });
  });

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.value || "";
}

function removeLanguageSkills(skills: string[] = [], languages: string[] = []): string[] {
  const names = new Set(languages.map((v) => canonical(v.split(/[-:(]/)[0])).filter(Boolean));
  return (skills || []).filter((skill) => !names.has(canonical(skill)));
}

export type WorkZoFinalizedCvProfile = ResumeProfile & {
  identityConfidence?: number;
  identityNeedsConfirmation?: boolean;
  selectedNameSource?: string;
  rawTextHealed?: string;
  /** Deprecated mirrors. Read basics.name / basics.headline instead. */
  name?: string;
  headline?: string;
};

export function finalizeWorkZoCvProfile(args: {
  parsedProfile?: Partial<ResumeProfile> | null;
  rawText?: string | null;
  fileName?: string | null;
  visionName?: string | null;
  /** Explicit target role typed by the user. When present it wins the headline. */
  targetRole?: string | null;
}): WorkZoFinalizedCvProfile {
  const originalParsed: any = args.parsedProfile || {};
  // The API parse guard has already completed structural repair. Re-running the
  // repair engine here caused valid jobs to be deleted (2 -> 0) and must never happen.
  const structurallyRepaired: any = originalParsed;
  // The final repair pass owns collections only. Preserve identity/contact fields
  // from the already-guarded profile so raw-text fallback parsing cannot shorten
  // or replace a correct headline/name during finalization.
  const parsed: any = {
    ...structurallyRepaired,
    basics: {
      ...(structurallyRepaired.basics || {}),
      ...(originalParsed.basics || {}),
    },
  };
  const healedText = healSpacedHeaders(args.rawText || "");

  const decision = determineCanonicalIdentity({
    // Accept both shapes on the way in. Previously only `parsed.name` was read,
    // so an AI profile that correctly filled basics.name was ignored here.
    aiName: readIdentityField(parsed, "name"),
    // Identity recovery needs the original spacing. Decorative PDF headers
    // such as "J O H N S M I T H" lose their only structural signal after
    // healSpacedHeaders(), so pass the untouched text here.
    rawText: args.rawText || "",
    fileName: args.fileName,
    email: getEmail(parsed),
    visionName: args.visionName,
  });

  const targetRole = safeString(args.targetRole).trim();
  const headline =
    // Deterministic headline contract, identical to the CV page:
    // an explicit target role always wins, otherwise keep the CV's own headline.
    // The model never gets to invent one.
    targetRole ||
    resolveTargetHeadline({
      aiHeadline: readIdentityField(parsed, "headline") || safeString(parsed.title || parsed.targetRole),
      rawText: healedText,
      selectedName: decision.selectedName,
    });

  // Stage 1 identity invariant: the evidence-based identity engine is the
  // sole authority for candidate names. Never fall back to an arbitrary header
  // line because that previously produced values such as "Executive Summary"
  // and "Your Phone Contact". When evidence is insufficient, return an empty
  // name and let the UI request confirmation.
  const decisionName = decision.selectedName.trim();
  const decisionNameLooksContaminated =
    !decisionName ||
    ROLE_TOKEN_RE.test(decisionName) ||
    SECTION_OR_PLACEHOLDER_RE.test(decisionName) ||
    CONTACT_RE.test(decisionName);
  const selectedName = decisionNameLooksContaminated ? "" : decisionName;
  const rawHeaderRole = recoverHeaderRole(args.rawText || "", selectedName);
  const parsedHeadline = readIdentityField(parsed, "headline").trim();
  const parsedHeadlineValid = parsedHeadline && !isHeadlineNoise(parsedHeadline) && ROLE_TOKEN_RE.test(parsedHeadline);
  const finalHeadline = targetRole || rawHeaderRole || (parsedHeadlineValid ? parsedHeadline : "") || headline;
  const finalExperience = conservativeFinalizeExperience((parsed as ResumeProfile).experience || []);
  const finalProjects = exactDedupeProjects((parsed as ResumeProfile).projects || []);
  const finalLanguages = normalizeLanguages((parsed as ResumeProfile).languages || []);
  const finalSkills = removeLanguageSkills((parsed as ResumeProfile).skills || [], finalLanguages);

  const finalProfile: WorkZoFinalizedCvProfile = {
    ...(parsed as ResumeProfile),
    experience: finalExperience,
    projects: finalProjects,
    languages: finalLanguages,
    skills: finalSkills,
    // CANONICAL. This is what every renderer, PDF, interview prompt, cover
    // letter, and LinkedIn surface actually reads.
    basics: {
      ...(parsed.basics || {}),
      name: selectedName,
      headline: finalHeadline,
      email: safeString(parsed?.basics?.email || parsed?.email),
      phone: safeString(parsed?.basics?.phone || parsed?.phone),
      location: safeString(parsed?.basics?.location || parsed?.location),
      linkedin: safeString(parsed?.basics?.linkedin || parsed?.linkedin),
    },
    // Deprecated mirrors, kept so any legacy caller reading profile.name still works.
    name: selectedName,
    headline: finalHeadline,
    identityConfidence: decision.confidence,
    identityNeedsConfirmation: decision.needsConfirmation || !selectedName,
    selectedNameSource: decision.selectedNameSource,
    rawTextHealed: healedText,
  } as WorkZoFinalizedCvProfile;

  console.log("[WorkZo CV Pipeline] api.cv.finalizer.identity_decision", {
    fileName: args.fileName || "",
    selectedName: finalProfile.basics?.name ?? "",
    selectedHeadline: finalProfile.basics?.headline ?? "",
    selectedNameSource: decision.selectedNameSource,
    confidence: decision.confidence,
    needsConfirmation: decision.needsConfirmation,
    rejectedCandidates: decision.rejectedCandidates,
  });
  console.log("[WorkZo CV Pipeline] api.cv.final_profile", {
    fileName: args.fileName || "",
    counts: {
      experience: finalProfile.experience?.length || 0,
      education: finalProfile.education?.length || 0,
      projects: finalProfile.projects?.length || 0,
      skills: finalProfile.skills?.length || 0,
      languages: finalProfile.languages?.length || 0,
    },
    languages: finalProfile.languages || [],
  });

  return finalProfile;
}

// Backward-compatible wrappers used by older routes.
// Supports both call styles:
//   finalizeWorkZoCvProfile({ parsedProfile, rawText, fileName })
//   finalizeCanonicalCvProfile(profile, { rawText, fileName, selectedName })
type LegacyFinalizeOptions = {
  rawText?: string | null;
  fileName?: string | null;
  selectedName?: string | null;
  candidateName?: string | null;
  visionName?: string | null;
  targetRole?: string | null;
  source?: string | null;
  confidence?:
    | number
    | {
        name?: number;
        experience?: number;
        skills?: number;
        overall?: number;
      }
    | null;
  [key: string]: unknown;
};

function normalizeFinalizeArgs(
  profileOrArgs?:
    | Partial<ResumeProfile>
    | {
        parsedProfile?: Partial<ResumeProfile> | null;
        rawText?: string | null;
        fileName?: string | null;
        visionName?: string | null;
        targetRole?: string | null;
      }
    | null,
  options?: LegacyFinalizeOptions,
): {
  parsedProfile?: Partial<ResumeProfile> | null;
  rawText?: string | null;
  fileName?: string | null;
  visionName?: string | null;
  targetRole?: string | null;
} {
  if (profileOrArgs && typeof profileOrArgs === "object" && "parsedProfile" in profileOrArgs) {
    return profileOrArgs as {
      parsedProfile?: Partial<ResumeProfile> | null;
      rawText?: string | null;
      fileName?: string | null;
      visionName?: string | null;
      targetRole?: string | null;
    };
  }

  const parsedProfile: any = { ...(profileOrArgs || {}) };
  const selectedName = options?.selectedName || options?.candidateName;
  if (selectedName && typeof selectedName === "string" && selectedName.trim()) {
    // Seed the canonical field, not the dead one. determineCanonicalIdentity
    // still gets a veto if this value is a skill, section header, or job title.
    parsedProfile.basics = { ...(parsedProfile.basics || {}), name: selectedName.trim() };
    parsedProfile.name = selectedName.trim();
  }

  return {
    parsedProfile,
    rawText: options?.rawText || null,
    fileName: options?.fileName || null,
    visionName: options?.visionName || null,
    targetRole: options?.targetRole || null,
  };
}

export function finalizeCanonicalCvProfile(
  profileOrArgs?: Partial<ResumeProfile> | { parsedProfile?: Partial<ResumeProfile> | null; rawText?: string | null; fileName?: string | null; visionName?: string | null } | null,
  options?: LegacyFinalizeOptions,
): WorkZoFinalizedCvProfile {
  return finalizeWorkZoCvProfile(normalizeFinalizeArgs(profileOrArgs, options));
}

export function finalizeCvProfile(
  profileOrArgs?: Partial<ResumeProfile> | { parsedProfile?: Partial<ResumeProfile> | null; rawText?: string | null; fileName?: string | null; visionName?: string | null } | null,
  options?: LegacyFinalizeOptions,
): WorkZoFinalizedCvProfile {
  return finalizeCanonicalCvProfile(profileOrArgs, options);
}

export const finalizeResumeProfile = finalizeCanonicalCvProfile;
export const finalizeWorkZoResumeProfile = finalizeCanonicalCvProfile;

export function validateAndCleanName(parsedName: string, textPreview = "") {
  const decision = determineCanonicalIdentity({ aiName: parsedName, rawText: textPreview });
  return { name: decision.selectedName, source: decision.selectedNameSource };
}

export const __workzoCvGlobalFinalizerVersion = "4.4.0-stage1-global-name";
