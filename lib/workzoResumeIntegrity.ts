/**
 * lib/workzoResumeIntegrity.ts
 *
 * The single final validation gate for ResumeProfile.
 *
 * Architecture rule: /api/cv may return ok:true ONLY if the exact
 * resumeProfile object being returned passes validateResumeIntegrity().
 *
 * No code path may bypass this gate.
 * No code may mutate resumeProfile after this gate passes.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ResumeIntegrityResult = {
  ok: boolean;
  score: number;
  errors: string[];
  warnings: string[];
  fieldScores: {
    name: number;
    email: number;
    phone: number;
    experience: number;
    education: number;
    skills: number;
    languages: number;
    projects: number;
  };
};

type BasicProfile = {
  basics?: { name?: string; email?: string; phone?: string; headline?: string; location?: string; linkedin?: string };
  summary?: string;
  experience?: unknown[];
  education?: unknown[];
  skills?: unknown[];
  languages?: unknown[];
  projects?: unknown[];
  certifications?: unknown[];
  [key: string]: unknown;
};

// ─── Name reject lists ────────────────────────────────────────────────────────

// Word-level: any word in the name matching this → reject
const NAME_REJECT_WORD_RE = /^(profile|profilesummary|summary|executive|professional|career|experience|workexperience|education|skills?|projects?|certifications?|references?|languages?|contact|contacts|overview|objective|competencies|competency|expertise|core|key|selected|academic|bootcamp|portfolio|kontaktübersicht|kontaktubersicht|kontaktdaten|berufliches|beruflicher|werdegang|berufspraxis|berufserfahrung|bildungsweg|bildung|ausbildung|sprachen|kenntnisse|fähigkeiten|fahigkeiten|kontakt|lebenslauf|english|german|deutsch|dutch|french|spanish|italian|portuguese|arabic|mandarin|chinese|japanese|korean|russian|turkish|polish|hindi|tamil|englisch|französisch|franzosisch|spanisch|italienisch|portugiesisch|arabisch|japanisch|chinesisch|russisch|türkisch|turkisch|polnisch|fluent|native|conversational|fließend|fliesend|muttersprache|verhandlungssicher|fortgeschritten|grundkenntnisse|anfänger|anfanger|c1|c2|b1|b2|a1|a2|manager|engineer|developer|designer|analyst|specialist|consultant|coordinator|administrator|assistant|director|lead|head|chief|officer|executive|intern|trainee|teacher|recruiter|architect|scientist|researcher|technician|marketing|sales|customer|success|support|technical|data|software|product|project|program|cloud|devops|magna|cum|laude|honours|honors|distinction|excellence|achievement|achievements|accomplishments|proficiencies|proficiency|tools|tooling|invoicing|taxation|budgeting|financial|strategic|operational|creativity|innovation|negotiation|adaptability|leadership|teamwork|communication|thinking|management|planning|analysis|itsd|hts|ats|sop|kpi|okr|roi|ict|erp|crm|saas|sla|python|sql|tableau|tensorflow|sklearn|java|javascript|react|aws|gcp|azure)$/i;

// Phrase-level: full name matches this → reject
const NAME_REJECT_PHRASE_RE = /^(core competencies|professional summary|executive summary|career summary|profile summary|work experience|professional experience|contact overview|kontaktübersicht|kontaktubersicht|berufliches profil|beruflicher werdegang|praktische erfahrung|berufspraxis|key projects|selected projects|academic projects|magna cum laude|cum laude|summa cum laude|customer success|customer success achievements|customersucces sachievements|it support|it support specialist|data tools|invoicing tools|taxation tools|creativity negotiation|leadership critical thinking|englisch fließend|english fluent|english c1|deutsch b1|deutsch b2|deutsch a2|deutsch a1|german b1|german conversational)$/i;

// ─── Name validation ──────────────────────────────────────────────────────────

export function isValidHumanName(name: unknown): boolean {
  if (typeof name !== 'string') return false;
  const raw = name.replace(/[^\p{L}' \-.]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (!raw || raw.length < 3 || raw.length > 60) return false;
  if (/[\d@+()]/.test(raw)) return false;
  if (NAME_REJECT_PHRASE_RE.test(raw)) return false;
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 5) return false;
  const isInitial = (w: string) => /^\p{Lu}\.?$/u.test(w);
  const isSuffix = (w: string) => /^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(w);
  if (!words.every((w) => isInitial(w) || isSuffix(w) || /^[\p{L}'\-.]{2,28}$/u.test(w))) return false;
  if (new Set(words.map((w) => w.toLowerCase().replace(/\.$/, ''))).size === 1) return false;
  if (words.some((w) => !isInitial(w) && !isSuffix(w) && NAME_REJECT_WORD_RE.test(w))) return false;
  if (!words.some((w) => /^[\p{Lu}]/u.test(w) || isInitial(w))) return false;
  return true;
}

// ─── Phone validation ─────────────────────────────────────────────────────────

export function isValidPhone(phone: unknown): boolean {
  if (typeof phone !== 'string') return false;
  const value = phone.trim();
  if (!value) return true;
  if (/^\(?\d{4}\s*[-–]\s*\d{4}\)?$/.test(value)) return false;
  if (/^\d{4}$/.test(value)) return false;
  if (/(19|20)\d{2}\s*[-–/]\s*(19|20)\d{2}/.test(value)) return false;
  if (/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(value)) return false;
  const digits = value.replace(/\D/g, '');
  if (digits.length > 0 && digits.length < 7) return false;
  if (digits.length > 16) return false;
  return true;
}

// ─── Email validation ─────────────────────────────────────────────────────────

export function isValidEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  if (!email.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

// ─── Education-in-experience detection ───────────────────────────────────────

const EDU_IN_EXP_TITLE_RE = /\b(bachelor|master|b\.?sc\.?|m\.?sc\.?|b\.?a\.?|m\.?a\.?|ph\.?d|diploma|bootcamp|associate'?s?\s+degree|bachelor'?s?\s+degree|master'?s?\s+degree)\b/i;
const EDU_INSTITUTION_RE = /\b(university|universität|universitaet|college|school|schule|hochschule|institute|institut|akademie|academy|campus)\b/i;

export function experienceContainsEducation(experience: unknown[]): string[] {
  const offenders: string[] = [];
  for (const item of experience) {
    if (!item || typeof item !== 'object') continue;
    const exp = item as Record<string, unknown>;
    const title = String(exp.title || '');
    const company = String(exp.company || '');
    if (EDU_IN_EXP_TITLE_RE.test(title) && EDU_INSTITUTION_RE.test(company)) {
      offenders.push(`"${title}" @ "${company}"`);
    }
  }
  return offenders;
}

export function removeEducationFromExperience(experience: unknown[]): unknown[] {
  return experience.filter((item) => {
    if (!item || typeof item !== 'object') return true;
    const exp = item as Record<string, unknown>;
    const title = String(exp.title || '');
    const company = String(exp.company || '');
    return !(EDU_IN_EXP_TITLE_RE.test(title) && EDU_INSTITUTION_RE.test(company));
  });
}

// ─── Profile identity hash ────────────────────────────────────────────────────

export function hashProfileIdentity(profile: BasicProfile): string {
  const key = JSON.stringify({
    name: profile.basics?.name || '',
    email: profile.basics?.email || '',
    phone: profile.basics?.phone || '',
    exp: (profile.experience || []).length,
    edu: (profile.education || []).length,
  });
  let h = 5381;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) + h) ^ key.charCodeAt(i);
    h = h >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// ─── Main integrity gate ──────────────────────────────────────────────────────

/**
 * THE single final validation gate for ResumeProfile.
 *
 * Must be called on the exact profile object being returned to the client.
 * Returns ok:true only if all hard checks pass.
 * On failure, caller must return 422, never ok:true with a corrupted profile.
 */
export function validateResumeIntegrity(
  profile: BasicProfile,
  rawText: string,
): ResumeIntegrityResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fieldScores = { name: 0, email: 0, phone: 0, experience: 0, education: 0, skills: 0, languages: 0, projects: 0 };

  // ── Name ────────────────────────────────────────────────────────────────────
  const name = String(profile.basics?.name || '').trim();
  if (!name) {
    warnings.push('basics.name is empty');
  } else if (!isValidHumanName(name)) {
    errors.push(`basics.name "${name}" is not a valid human name (section heading, skill, language phrase, or job title)`);
  } else {
    fieldScores.name = 35;
  }

  // ── Email ───────────────────────────────────────────────────────────────────
  const email = String(profile.basics?.email || '').trim();
  if (email && !isValidEmail(email)) {
    errors.push(`basics.email "${email}" is not a valid email address`);
  } else {
    fieldScores.email = email ? 10 : 5;
  }

  // ── Phone ───────────────────────────────────────────────────────────────────
  const phone = String(profile.basics?.phone || '').trim();
  if (phone && !isValidPhone(phone)) {
    errors.push(`basics.phone "${phone}" looks like a date range, not a phone number`);
  } else {
    fieldScores.phone = phone ? 10 : 5;
  }

  // ── Experience ──────────────────────────────────────────────────────────────
  const exp = Array.isArray(profile.experience) ? profile.experience : [];
  const eduInExp = experienceContainsEducation(exp);
  if (eduInExp.length > 0) {
    errors.push(`experience contains education entries: ${eduInExp.join('; ')}`);
  } else {
    fieldScores.experience = exp.length >= 2 ? 35 : exp.length === 1 ? 20 : 0;
    if (exp.length === 0) warnings.push('experience is empty');
  }

  // ── Education ───────────────────────────────────────────────────────────────
  const edu = Array.isArray(profile.education) ? profile.education : [];
  fieldScores.education = edu.length >= 2 ? 15 : edu.length === 1 ? 10 : 0;
  if (edu.length === 0) warnings.push('education is empty');

  // ── Skills ──────────────────────────────────────────────────────────────────
  const skills = Array.isArray(profile.skills) ? profile.skills : [];
  fieldScores.skills = skills.length >= 6 ? 15 : skills.length >= 1 ? 8 : 0;

  // ── Languages ───────────────────────────────────────────────────────────────
  const langs = Array.isArray(profile.languages) ? profile.languages : [];
  fieldScores.languages = langs.length > 0 ? 5 : 0;

  // ── Projects ─────────────────────────────────────────────────────────────────
  const projects = Array.isArray(profile.projects) ? profile.projects : [];
  fieldScores.projects = projects.length > 0 ? 5 : 0;

  const score = Math.min(100,
    fieldScores.name + fieldScores.email + fieldScores.phone +
    fieldScores.experience + fieldScores.education + fieldScores.skills +
    fieldScores.languages + fieldScores.projects
  );

  return { ok: errors.length === 0, score, errors, warnings, fieldScores };
}
