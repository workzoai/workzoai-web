// Shared helpers used by every provider adapter so normalization is consistent.

export function cleanStr(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function stripHtml(value: unknown): string {
  const s = cleanStr(value);
  if (!s) return "";
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// Remove tracking params so apply URLs stay clean and de-duplicate better.
const TRACKING_PARAMS = /^(utm_|fbclid|gclid|mc_|ref|source|src)$/i;
export function cleanUrl(value: unknown): string {
  const raw = cleanStr(value);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return raw;
  }
}

export function detectRemoteType(
  title: string,
  description: string,
  location: string,
): "remote" | "hybrid" | "onsite" | "unknown" {
  const hay = `${title} ${location} ${description}`.toLowerCase();
  if (/\bhybrid\b/.test(hay)) return "hybrid";
  if (/\b(fully remote|remote-first|100% remote|work from home|wfh|remote)\b/.test(hay)) return "remote";
  if (/\b(on-?site|in office|in-office|on location)\b/.test(hay)) return "onsite";
  return "unknown";
}

// A compact library of recognisable skills/tools we surface on job cards and
// feed to the ranker. Deliberately structural, not tied to any one CV.
const SKILL_LIBRARY = [
  "sql", "python", "javascript", "typescript", "java", "c#", "c++", "go", "rust",
  "react", "angular", "vue", "node", "html", "css", "rest api", "graphql", "api",
  "aws", "azure", "gcp", "docker", "kubernetes", "terraform", "linux", "windows",
  "macos", "networking", "troubleshooting", "debugging", "automation", "ci/cd",
  "git", "jira", "zendesk", "salesforce", "servicenow", "sap", "excel", "power bi",
  "tableau", "etl", "data analysis", "machine learning", "nlp", "pandas",
  "customer support", "technical support", "escalation", "documentation", "onboarding",
  "sla", "csat", "kpi", "root cause", "configuration", "integration", "bug",
  "demo", "training", "stakeholder", "agile", "scrum", "project management",
];

export function extractSkills(text: string, limit = 10): string[] {
  const lower = (text || "").toLowerCase();
  const found = SKILL_LIBRARY.filter((s) => lower.includes(s));
  // Title-case for display, keep order of the library (stable, deterministic).
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of found) {
    const label = titleCaseUnicode(s);
    if (!seen.has(label)) {
      seen.add(label);
      out.push(label);
    }
    if (out.length >= limit) break;
  }
  return out;
}

// Generic job-ad vocabulary that is never a real requirement. Filtered out so a
// JD does not "require" things like "team" or "years experience".
// Multilingual: English, German, French, Spanish, Portuguese, Italian, Dutch,
// because a German or French job ad is otherwise full of "der"/"des"/"mit".
const GENERIC_JD_WORDS = new Set([
  // English
  "experience", "years", "year", "work", "working", "team", "teams", "role", "job",
  "position", "company", "candidate", "candidates", "opportunity", "responsibilities",
  "requirements", "qualifications", "skills", "ability", "abilities", "strong", "good",
  "excellent", "knowledge", "understanding", "proficiency", "familiarity", "plus",
  "must", "should", "will", "would", "can", "have", "has", "need", "needs", "required",
  "preferred", "desirable", "including", "etc", "environment", "business", "new",
  "well", "high", "great", "you", "your", "our", "we", "us", "the", "and", "for",
  "with", "who", "this", "that", "from", "into", "across", "within", "using",
  "join", "help", "support", "ensure", "provide", "deliver", "manage", "develop",
  "part", "day", "days", "time", "full", "based", "per", "min", "max", "salary",
  "such", "similar", "levels", "level", "both", "other", "related", "various",
  // German
  "und", "oder", "mit", "für", "fur", "von", "der", "die", "das", "den", "dem", "des",
  "ein", "eine", "einer", "einem", "sowie", "sind", "ist", "sie", "ihre", "ihren",
  "wir", "uns", "unsere", "aufgaben", "anforderungen", "kenntnisse", "erfahrung",
  "erfahrungen", "sicherer", "umgang", "gute", "gutes", "zur", "zum", "auch", "bei",
  "abgeschlossene", "vergleichbare", "idealerweise", "wünschenswert", "profil",
  // French
  "des", "les", "une", "aux", "dans", "avec", "pour", "sur", "vous", "nous", "est",
  "sont", "exigences", "expérience", "experience", "connaissance", "connaissances",
  "capacité", "capacite", "requis", "poste", "profil", "maîtrise", "maitrise",
  // Spanish / Portuguese / Italian
  "los", "las", "una", "con", "para", "por", "requisitos", "experiencia",
  "conocimiento", "conocimientos", "capacidad", "habilidad", "puesto", "como",
  "com", "para", "conhecimento", "capacidade", "esperienza", "conoscenza",
  // Dutch
  "een", "het", "van", "met", "voor", "ervaring", "kennis",
]);

/** Unicode-aware title case. The ASCII \b\w form capitalises the letter AFTER an
 *  accent ("Hygiene" -> "HygieNe"), because \w does not include accented chars. */
function titleCaseUnicode(value: string): string {
  return value.replace(/(^|[\s\-/])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

function contentTokens(line: string): string[] {
  return line
    .toLowerCase()
    // Keep Unicode letters. The previous ASCII-only filter destroyed accented
    // words: "Fähigkeit" became "f higkeit", "Capacité" became "capacit",
    // "Hygiène" became "hygi". That silently broke every non-English CV and JD.
    .replace(/[^\p{L}\p{N}+#/.\- ]/gu, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^[.\-/]+|[.\-/]+$/g, ""))
    .filter((w) => w.length > 2 && !GENERIC_JD_WORDS.has(w) && !/^\d+$/.test(w));
}

/**
 * Acronyms and proper-noun product names are almost always real requirements,
 * even when the ad mentions them only once: VMware, KVM, EDR, SLA, macOS in IT;
 * HACCP in catering; ITIL, GDPR, ICU, CPR elsewhere. Frequency alone misses
 * them, so we detect them by CAPITALISATION in the original text, which is
 * domain-agnostic and needs no curated list.
 */
function distinctiveTerms(text: string): Set<string> {
  const out = new Set<string>();
  // ALL-CAPS acronyms (SLA, EDR, HACCP, HGV, IFRS) and internally-capitalised
  // product names (VMware, macOS, HubSpot). Unicode-aware so accented words are
  // not mangled.
  const matches = text.match(/\b(\p{Lu}{2,}[\p{L}\p{N}+#.-]*|\p{Ll}?\p{Lu}\p{Ll}+\p{Lu}[\p{L}]*)\b/gu) || [];
  for (const m of matches) {
    const term = m.toLowerCase().replace(/[.,;:]+$/, "");
    if (term.length > 1 && !GENERIC_JD_WORDS.has(term)) out.add(term);
  }
  return out;
}

/**
 * Split a requirement line into clauses before extracting phrases.
 * "Knowledge of medication administration and infection control" is TWO
 * requirements. Without this split, the sliding window emits the meaningless
 * straddle "medication administration infection".
 */
function clauses(line: string): string[] {
  return line
    .split(/[,;:/()\u2022\u00b7]|\s+\b(?:and|or|as well as|sowie|und|oder|et|ou|y|e)\b\s+/i)
    .map((c) => c.trim())
    .filter(Boolean);
}

// Lines that actually state a requirement, rather than company boilerplate.
// Multilingual cues so German, French, and Spanish ads are handled too, not just
// English ones.
const REQUIREMENT_LINE_RE = new RegExp(
  [
    "^\\s*[-•*▪·]",
    // English
    "\\b(experience (with|in|of)|proficien\\w+ (with|in)|knowledge of|familiar(ity)? with",
    "|skilled in|expertise in|background in|ability to|must have|required|requirements?",
    "|qualifications?|you have|we expect|looking for|competent in|trained in|certified in|licen[cs]ed)\\b",
    // German
    "|\\b(anforderungen|kenntnisse|erfahrung|erfahrungen|abgeschlossene|ausbildung",
    "|sicherer umgang|f[aä]higkeit|voraussetzung\\w*|ihr profil|wir erwarten|idealerweise)\\b",
    // French
    "|\\b(exigences|exp[ée]rience|connaissances?|capacit[ée]|ma[îi]trise|dipl[ôo]me|requis|profil recherch[ée])\\b",
    // Spanish / Portuguese
    "|\\b(requisitos|experiencia|conocimientos?|capacidad|habilidades?|titulaci[óo]n|conhecimento)\\b",
  ].join(""),
  "i",
);

/**
 * DOMAIN-AGNOSTIC requirement extraction.
 *
 * The previous version matched a JD against a fixed library of ~60 technology
 * terms. That works for a software role and returns NOTHING for a nurse, chef,
 * lawyer, teacher, or electrician, which silently broke matching for every
 * non-tech job.
 *
 * This version derives requirements from the job ad itself: it finds the lines
 * that actually state requirements, extracts repeated content phrases (1 to 3
 * words), drops generic job-ad filler, and ranks by how central each phrase is
 * to the ad. Known skills still get a boost when present, so tech roles do not
 * regress, but nothing depends on a curated list any more.
 */
export function extractJobRequirements(text: string, limit = 12): string[] {
  const raw = (text || "").trim();
  if (!raw) return [];

  const lines = raw.split(/\r?\n|(?<=\.)\s+/).map((l) => l.trim()).filter(Boolean);
  const requirementLines = lines.filter((l) => REQUIREMENT_LINE_RE.test(l));
  // If the ad has no obvious requirement lines, fall back to the whole text so
  // we still produce something useful.
  const focus = requirementLines.length >= 2 ? requirementLines : lines;

  const knownSkills = new Set(extractSkills(raw, 40).map((s) => s.toLowerCase()));
  // Capitalised product names and acronyms from the ad itself (VMware, KVM, EDR,
  // SLA, HACCP...). These are real requirements even when mentioned once.
  const distinctive = distinctiveTerms(raw);
  const scores = new Map<string, number>();

  const bump = (phrase: string, amount: number) => {
    const p = phrase.trim();
    if (!p || p.length < 3) return;
    scores.set(p, (scores.get(p) || 0) + amount);
  };

  for (const line of focus) {
    for (const clause of clauses(line)) {
      const toks = contentTokens(clause);
      // Unigrams, bigrams, trigrams within a single clause, so multi-word
      // phrases carry real meaning ("intensive care", "food hygiene",
      // "root cause analysis") without straddling a boundary.
      for (let i = 0; i < toks.length; i++) {
        bump(toks[i], 1);
        if (i + 1 < toks.length) bump(`${toks[i]} ${toks[i + 1]}`, 2.4);
        if (i + 2 < toks.length) bump(`${toks[i]} ${toks[i + 1]} ${toks[i + 2]}`, 2.2);
      }
    }
  }

  // Boost anything independently recognisable as a real skill, tool, acronym, or
  // product name, so a single mention still surfaces.
  for (const [phrase, score] of scores) {
    if (knownSkills.has(phrase)) scores.set(phrase, score + 6);
    if (distinctive.has(phrase)) scores.set(phrase, score + 5);
  }
  // Make sure distinctive terms are candidates even if the tokenizer never
  // emitted them (e.g. a two-character acronym).
  for (const term of distinctive) {
    if (!scores.has(term) && term.length > 2) scores.set(term, 5);
  }

  // Prefer longer, more specific phrases, then suppress near-duplicates.
  const ordered = [...scores.entries()]
    .filter(([p, s]) => s >= 2 || knownSkills.has(p) || distinctive.has(p))
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([p]) => p);

  const chosen: string[] = [];
  const chosenTokens: Array<Set<string>> = [];
  for (const phrase of ordered) {
    const toks = new Set(phrase.split(" "));
    // Skip phrases that substantially overlap one we already kept. Without this,
    // the sliding window emits straddling fragments like "medication
    // administration infection" next to "administration infection control".
    const overlaps = chosenTokens.some((prev) => {
      let shared = 0;
      for (const t of toks) if (prev.has(t)) shared++;
      return shared >= Math.min(2, toks.size);
    });
    if (overlaps) continue;
    chosen.push(phrase);
    chosenTokens.push(toks);
    if (chosen.length >= limit) break;
  }

  return chosen.map((p) => titleCaseUnicode(p));
}

export function isLikelySpam(title: string, company: string): boolean {
  const t = `${title} ${company}`.toLowerCase();
  return /\b(work from home now|earn \$\d|no experience needed and earn|make money fast)\b/.test(t);
}

export function isExpired(expiresAt?: string): boolean {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  return Number.isFinite(t) && t < Date.now();
}

export function isStale(postedAt?: string, days = 30): boolean {
  if (!postedAt) return false;
  const t = Date.parse(postedAt);
  if (!Number.isFinite(t)) return false;
  return Date.now() - t > days * 24 * 60 * 60 * 1000;
}
