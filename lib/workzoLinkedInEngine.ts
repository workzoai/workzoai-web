/**
 * workzoLinkedInEngine.ts
 *
 * Items 2 and 3 of the LinkedIn Career Optimizer:
 *
 *   2. CV ↔ LinkedIn consistency  — what recruiters notice and candidates miss
 *   3. LinkedIn ↔ JD match        — what recruiters search for and can't find
 *
 * WHY THIS IS DETERMINISTIC
 * -------------------------
 * Both engines answer questions of the form "does X appear in Y". That is a set
 * operation, not a judgement call. Handing it to a model buys nothing and costs
 * everything: an LLM asked whether the CV and LinkedIn agree on a job title will
 * sometimes say yes because the two titles *feel* similar, and the entire value
 * of a consistency checker is that it does not feel anything.
 *
 * The LLM belongs one layer up — rewriting the About section once these engines
 * have decided what is wrong with it. Reliability-critical logic stays here.
 *
 * THE THING COMPETITORS CANNOT DO
 * -------------------------------
 * A LinkedIn keyword checker can tell you "Power BI is missing". It cannot tell
 * you whether that is a *gap* or an *omission* — whether you have the skill and
 * forgot to list it, or simply do not have it. WorkZo has the parsed CV, so it
 * can. Every missing keyword is classified against CV evidence:
 *
 *   ADD    → the CV proves it. Put it on LinkedIn today. Free score.
 *   PROMOTE→ it is on LinkedIn, buried in a bullet where recruiter search
 *            weights it near zero. Move it to the headline or skills.
 *   GAP    → nothing in the CV supports it. We will not tell you to write it
 *            down. That is how people fail interviews.
 *
 * This engine never suggests adding a keyword the candidate cannot defend.
 */

import type { ResumeProfile } from "@/lib/workzoResumeParser";
import type { LinkedInProfile } from "@/lib/workzoLinkedInParser";
import { parseDateRange } from "@/lib/workzoLinkedInParser";

// ── Normalization ────────────────────────────────────────────────────────────

/**
 * Canonical aliases. This is a *normalization* layer, not a skill library:
 * nothing is gated on membership, so an unlisted term still matches itself.
 * Contrast with `SKILL_LIBRARY` in workzoFreeToolsEngine, where a term absent
 * from the list is invisible to the engine entirely.
 */
const ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  "power bi": "powerbi",
  "power-bi": "powerbi",
  postgres: "postgresql",
  "ms excel": "excel",
  "microsoft excel": "excel",
  "google cloud": "gcp",
  "google cloud platform": "gcp",
  "amazon web services": "aws",
  "machine learning": "machinelearning",
  ml: "machinelearning",
  "business intelligence": "bi",
  "data viz": "datavisualization",
  "data visualisation": "datavisualization",
  "data visualization": "datavisualization",
  "a b testing": "abtesting",
  "ab testing": "abtesting",
};

/** Lowercase, de-accent, strip punctuation. No alias substitution. */
function normalizeRaw(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9+#\s.-]/g, " ")
    .replace(/(^|\s)[.-]+|[.-]+(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ALIAS_RULES = Object.entries(ALIASES)
  .sort((a, b) => b[0].length - a[0].length)
  .map(([from, to]) => ({ re: new RegExp(`(?<=^| )${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?= |$)`, "g"), to }));

/**
 * Normalize AND canonicalize aliases, as a phrase-level replacement over the
 * whole string rather than a whole-string lookup.
 *
 * The distinction matters. A whole-string map canonicalizes the *term* "power
 * bi" to "powerbi" but leaves the LinkedIn About text as "...power bi and
 * tableau...", so the term never matches its own evidence. Running both sides
 * through the same replacement pass is what makes the comparison sound.
 */
export function normalizeTerm(value: unknown): string {
  let out = normalizeRaw(value);
  for (const { re, to } of ALIAS_RULES) out = out.replace(re, to);
  return out;
}

const STOPWORDS = new Set([
  "a", "an", "and", "or", "the", "to", "of", "in", "on", "for", "with", "at", "by", "from", "as",
  "is", "are", "be", "will", "you", "your", "our", "we", "they", "it", "this", "that", "these",
  "have", "has", "had", "can", "may", "must", "should", "would", "into", "using", "their", "them",
  "und", "der", "die", "das", "mit", "für", "fur", "von", "im", "ein", "eine",
]);

/**
 * Words that carry no signal on their own but are perfectly good *inside* a
 * phrase. "experience" alone is noise; "stakeholder experience" is not. So an
 * n-gram is dropped only when EVERY token is generic — never because it happens
 * to contain one.
 */
const GENERIC = new Set([
  "experience", "experienced", "years", "year", "yrs", "ability", "able", "strong", "excellent",
  "good", "great", "knowledge", "skills", "skill", "work", "working", "team", "teams", "role",
  "job", "candidate", "candidates", "required", "requirements", "responsibilities", "plus",
  "preferred", "nice", "must", "understanding", "familiarity", "proficiency", "proficient",
  "including", "etc", "e.g", "ideally", "similar", "related", "relevant", "environment", "company",
  "opportunity", "looking", "join", "help", "support", "new", "well", "high", "level", "part",
  "day", "days", "time", "full", "based", "across", "within", "min", "minimum",
  "comfortable", "exposure", "join", "looking for", "hands", "on", "solid", "demonstrated",
  "several", "various", "some", "any", "all", "both", "other", "others",
  "tooling", "tools", "toolset", "stack", "solutions", "platform", "platforms", "technologies",
]);

/** Terms that are never professional search keywords, even inside a phrase. */
const BAD_KEYWORD_WORDS = new Set([
  "linkedin", "cv", "resume", "profile", "jd", "jds", "single", "job", "signal", "signals",
  "optimize", "optimise", "over", "macro", "corpus", "target", "targets", "paste", "pasted",
  "salary", "package", "benefit", "benefits", "attractive", "bonus", "quarter", "quarters",
  "including", "include", "includes", "comfortably", "comfortable", "navigate", "several", "times",
  "applications", "application", "analyze", "analyse", "analyzing", "analysing", "ensure", "right", "start",
  "paid", "payout", "travel", "travelling", "conference", "conferences", "las", "vegas", "barcelona",
  "creative", "freedom", "customer", "customers", "side", "basic", "attitude", "processes",
  "defined", "form", "written", "sustainable", "success", "future", "development", "major",
  "available", "office", "workplace", "atmosphere", "variety", "difference", "specific",
]);

const BAD_KEYWORD_PHRASES = [
  "not over optimize", "not over optimise", "single job signal", "single application", "target jds",
  "paste more", "workzo", "linkedin strategy", "permanent linkedin", "do not over",
  "creative freedom", "customer side", "attractive salary", "financial participation",
  "defined service level agreements", "certification processes", "basic knowledge",
];

function hasBadKeywordLanguage(parts: string[]): boolean {
  const phrase = parts.join(" ");
  if (BAD_KEYWORD_PHRASES.some((bad) => phrase.includes(bad))) return true;
  return parts.some((p) => BAD_KEYWORD_WORDS.has(p));
}

function looksLikeProfessionalKeyword(parts: string[]): boolean {
  if (!parts.length || parts.length > 4) return false;
  if (hasBadKeywordLanguage(parts)) return false;
  if (parts.some((p) => /^\d+$/.test(p))) return false;
  if (parts.every((p) => GENERIC.has(p))) return false;

  // Reject verb-ish fragments created when commas were previously removed:
  // "applications analyze", "comfortably navigate", etc.
  const last = parts[parts.length - 1];
  if (/^(analy[sz]e|ensure|coordinate|communicate|navigate|join|look|looking|paid|travel|start)$/.test(last)) return false;

  // Prefer real search concepts: named tools, frameworks, domains, or noun phrases.
  // A very short generic bigram like "basic skills" should not survive.
  const phrase = parts.join(" ");
  if (/\b(active directory|azure ad|office 365|microsoft 365|itil|itsm|service desk|help desk|technical support|customer support|network troubleshooting|desktop support|windows|linux|mac os|macos|ios|android|python|sql|tableau|power bi|powerbi|excel|gcp|aws|azure|rest api|apis|ticketing|jira|servicenow|zendesk|salesforce|hubspot|bash|powershell|shell scripting|endpoint management|incident management|problem management|change management|stakeholder management|data analysis|data analytics|business intelligence|machine learning|etl|mysql|postgresql|snowflake|sap|successfactors)\b/i.test(phrase)) {
    return true;
  }

  // Otherwise require a concrete noun-ish phrase, not a conversational fragment.
  if (parts.length === 1) return parts[0].length >= 3 && !GENERIC.has(parts[0]);
  return parts.some((p) => !GENERIC.has(p)) && !/\b(ability|strong|good|excellent|basic|attractive|appropriate)\b/.test(phrase);
}


function tokens(value: string): string[] {
  return normalizeTerm(value)
    .split(/[\s.-]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function tokenSet(value: string): Set<string> {
  return new Set(tokens(value));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared += 1;
  return shared / (a.size + b.size - shared);
}

/** Word-boundary containment on a normalized haystack. */
function contains(haystack: string, term: string): boolean {
  if (!term) return false;
  return ` ${haystack} `.includes(` ${term} `);
}

const LEGAL_SUFFIXES = new Set([
  "gmbh", "ag", "se", "ug", "kg", "ohg", "ltd", "llc", "inc", "corp", "corporation",
  "company", "co", "pvt", "limited", "plc", "bv", "nv", "group", "holding", "sa", "srl",
]);

/** "Acme Solutions GmbH" and "Acme Solutions" are the same employer. */
export function companyKey(value: string): string {
  return tokens(value)
    .filter((t) => !LEGAL_SUFFIXES.has(t))
    .join(" ");
}

// ── Zones ────────────────────────────────────────────────────────────────────
//
// LinkedIn's own search does not treat all fields equally, and neither should we.
// A keyword in the headline surfaces the profile; the same keyword in the third
// bullet of a 2018 role effectively does not exist. These weights encode that.

export type ZoneKey =
  | "headline"
  | "skills"
  | "experienceTitle"
  | "about"
  | "experienceBody"
  | "certifications";

const ZONE_WEIGHTS: Record<ZoneKey, number> = {
  headline: 3,
  skills: 2.5,
  experienceTitle: 2,
  about: 1.5,
  experienceBody: 1,
  certifications: 1,
};

/** Weight at which a keyword is considered fully covered for recruiter search. */
const FULL_COVERAGE_WEIGHT = 2;

function linkedInZones(profile: LinkedInProfile): Record<ZoneKey, string> {
  return {
    headline: normalizeTerm(profile.headline),
    skills: normalizeTerm(profile.skills.join(" ")),
    experienceTitle: normalizeTerm(profile.experience.map((r) => r.title).join(" ")),
    about: normalizeTerm(profile.about),
    experienceBody: normalizeTerm(
      profile.experience.map((r) => `${r.company} ${r.bullets.join(" ")}`).join(" "),
    ),
    certifications: normalizeTerm(profile.certifications.join(" ")),
  };
}

/** Everything the CV can be said to *prove*. Used only as evidence, never as output. */
function cvEvidenceText(profile: ResumeProfile | null, cvText: string): string {
  if (!profile) return normalizeTerm(cvText);
  return normalizeTerm(
    [
      profile.basics?.headline,
      profile.summary,
      profile.skills?.join(" "),
      profile.certifications?.join(" "),
      profile.experience?.map((e) => `${e.title} ${e.company} ${e.bullets?.join(" ")}`).join(" "),
      profile.projects?.map((p) => `${p?.name ?? ""} ${(p as { description?: string })?.description ?? ""}`).join(" "),
      profile.education?.map((e) => `${e.degree} ${e.institution}`).join(" "),
      cvText,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

// ── JD term extraction ───────────────────────────────────────────────────────

export type JdTerm = {
  /** Normalized form, used for matching. */
  term: string;
  /** Original casing, used for display. */
  display: string;
  /** Relative importance within this JD. */
  weight: number;
};

const REQUIREMENT_LINE_RE =
  /^[\s•●▪◦*\-–—]|\b(required|requirements|must have|you have|qualifications|we expect|responsibilities|profil|anforderungen)\b/i;

/**
 * Pull the terms a recruiter would actually search on out of a JD.
 *
 * No fixed vocabulary. The JD defines its own vocabulary; we only decide which
 * of its phrases carry signal. That is what makes this work for a nursing role
 * and a Rust role without anyone maintaining a list.
 */
export function extractJdTerms(jobDescription: string, limit = 24): JdTerm[] {
  const lines = String(jobDescription || "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Frequency and bonus are tracked SEPARATELY, then combined logarithmically.
  // Accumulating `1 + bonus` per occurrence lets one repeated phrase run away
  // with the score: in a JD that says "Business Intelligence" three times, that
  // phrase took 40% of the total weight and the match score became a referendum
  // on a single keyword. A term that appears five times matters more than one
  // that appears once, but not five times more.
  const scores = new Map<string, { freq: number; bonus: number; display: string; length: number; raw: string }>();

  /** Validate a word slice and return its trimmed keyword form, or null. */
  function keywordOf(slice: string[], n: number): string[] | null {
    // Validate on the RAW normalization. Alias canonicalization collapses
    // "power bi" into a single token, which would otherwise make a valid bigram
    // look like a malformed unigram and get thrown away.
    const raw = normalizeRaw(slice.join(" "));
    if (!raw) return null;
    let parts = raw.split(" ");
    if (parts.length !== n) return null; // punctuation collapsed the n-gram
    if (parts.some((p) => STOPWORDS.has(p) || p.length < 2)) return null;

    // Trim boilerplate from the EDGES only. "Strong SQL" is the keyword "SQL";
    // "Excellent stakeholder communication" is "stakeholder communication";
    // "business intelligence tooling" is "business intelligence". Interior
    // generics are never trimmed, since removing them would fabricate a phrase
    // the JD never used.
    while (parts.length && GENERIC.has(parts[0])) parts = parts.slice(1);
    while (parts.length && GENERIC.has(parts[parts.length - 1])) parts = parts.slice(0, -1);
    if (!parts.length) return null;
    if (!looksLikeProfessionalKeyword(parts)) return null;
    return parts;
  }

  function record(parts: string[], isRequirement: boolean, positionBonus: number) {
    const trimmed = parts.join(" ");
    const term = normalizeTerm(trimmed);
    if (!term) return;
    const bonus = (isRequirement ? 1.5 : 0) + positionBonus + (parts.length - 1) * 0.75;
    const prior = scores.get(term);
    if (prior) {
      prior.freq += 1;
      prior.bonus = Math.max(prior.bonus, bonus);
    } else {
      scores.set(term, { freq: 1, bonus, display: trimmed, length: parts.length, raw: trimmed });
    }
  }

  lines.forEach((line, index) => {
    const isRequirement = REQUIREMENT_LINE_RE.test(line);
    const positionBonus = index < lines.length * 0.35 ? 0.5 : 0;

    // Preserve punctuation boundaries. Without this, a JD sentence such as
    // "systems and applications, analyze and resolve..." can fabricate the fake
    // keyword "applications analyze".
    const clauses = line.split(/[,;:|•●▪◦*–—.]+/).map((c) => c.trim()).filter(Boolean);

    for (const clause of clauses) {
      const rawWords = clause.split(/[\s()/]+/).filter(Boolean);

      // GREEDY LONGEST MATCH, consuming each word once.
      let i = 0;
      while (i < rawWords.length) {
        let consumed = 0;
        for (let n = Math.min(4, rawWords.length - i); n >= 1; n -= 1) {
          const slice = rawWords.slice(i, i + n);
          const parts = keywordOf(slice, n);
          if (!parts) continue;
          record(parts, isRequirement, positionBonus);

          for (let len = n - 1; len >= 2; len -= 1) {
            for (let j = 0; j + len <= n; j += 1) {
              const sub = keywordOf(slice.slice(j, j + len), len);
              if (sub && sub.length > 1 && !normalizeTerm(sub.join(" ")).includes(" ")) {
                record(sub, isRequirement, positionBonus);
              }
            }
          }

          consumed = n;
          break;
        }
        i += consumed || 1;
      }
    }
  });

  const ranked = Array.from(scores.entries())
    .filter(([term, meta]) => looksLikeProfessionalKeyword(normalizeRaw(meta.raw).split(" ").filter(Boolean)))
    .map(([term, meta]) => ({
      term,
      raw: meta.raw,
      display: meta.display,
      weight: 1 + Math.log2(meta.freq) + meta.bonus,
      length: meta.length,
    }))
    .sort((a, b) => b.weight - a.weight || b.length - a.length || a.term.localeCompare(b.term));

  const shortlist = ranked.slice(0, limit * 2);

  // Prune ONLY unigrams that a longer kept phrase already covers.
  //
  // Two constraints pull against each other here. Unigrams like "business",
  // "intelligence", "data" and "power" are worthless as LinkedIn keywords and
  // must go. But phrases must NOT eat each other: "Power BI dashboards" would
  // otherwise subsume "Power BI", and a candidate who lists Power BI in their
  // skills would be told it is missing. Both phrases are things a recruiter
  // genuinely searches; only the bare word is noise.
  //
  // Longer phrases that are merely a real phrase plus boilerplate ("business
  // intelligence tooling") are already collapsed by the edge-trim above, so
  // subsumption does not need to handle them.
  //
  // The comparison runs on the RAW (pre-alias) form. "Power BI" canonicalizes
  // to the single token "powerbi", so the canonical form no longer contains
  // "power" and that junk unigram would slip through.
  const kept = shortlist.filter(
    (candidate) =>
      candidate.length > 1 ||
      !shortlist.some((other) => other.length > 1 && contains(other.raw, candidate.raw)),
  );

  return kept
    .slice(0, limit)
    .map(({ term, display, weight }) => ({ term, display, weight }));
}

// ── Engine 3: LinkedIn ↔ JD match ────────────────────────────────────────────

export type KeywordVerdict = "matched" | "promote" | "add" | "gap";

export type KeywordFinding = {
  keyword: string;
  verdict: KeywordVerdict;
  /** Strongest LinkedIn zone the keyword appears in, if any. */
  foundIn: ZoneKey | null;
  /** Does the CV prove the candidate can defend this keyword? */
  evidencedInCv: boolean;
  weight: number;
  action: string;
};

export type JdMatchResult = {
  matchScore: number;
  /**
   * The score this profile reaches once every ADD and PROMOTE item is applied —
   * i.e. without claiming a single thing the CV cannot back. The gap between
   * `matchScore` and `potentialScore` is the honest value of doing the work,
   * and it is the only number worth putting behind an upgrade prompt.
   */
  potentialScore: number;
  termCount: number;
  matched: KeywordFinding[];
  /** On LinkedIn, but buried where recruiter search barely counts it. */
  promote: KeywordFinding[];
  /** Missing from LinkedIn, proven by the CV. Free score, zero risk. */
  add: KeywordFinding[];
  /** Missing from LinkedIn AND unproven by the CV. A real gap. Do not fake it. */
  gaps: KeywordFinding[];
  /**
   * EVERY keyword the CV cannot prove, whether or not LinkedIn already mentions
   * it. This is the list the rewrite is forbidden to write, and it is derived
   * only from the CV — so a forged LinkedIn profile cannot launder a keyword
   * into the allowed set by claiming the profile already contains it.
   */
  unevidenced: KeywordFinding[];
};

export function matchLinkedInToJd(input: {
  linkedin: LinkedInProfile;
  resumeProfile: ResumeProfile | null;
  cvText?: string;
  jobDescription: string;
}): JdMatchResult {
  const { linkedin, resumeProfile, cvText = "", jobDescription } = input;

  const terms = extractJdTerms(jobDescription);
  const zones = linkedInZones(linkedin);
  const evidence = cvEvidenceText(resumeProfile, cvText);

  const findings: KeywordFinding[] = terms.map(({ term, display, weight }) => {
    let bestZone: ZoneKey | null = null;
    let bestWeight = 0;

    for (const key of Object.keys(ZONE_WEIGHTS) as ZoneKey[]) {
      if (!contains(zones[key], term)) continue;
      if (ZONE_WEIGHTS[key] > bestWeight) {
        bestWeight = ZONE_WEIGHTS[key];
        bestZone = key;
      }
    }

    const evidencedInCv = contains(evidence, term);

    let verdict: KeywordVerdict;
    let action: string;
    if (bestWeight >= FULL_COVERAGE_WEIGHT) {
      verdict = "matched";
      action = "Already visible to recruiter search.";
    } else if (bestZone) {
      verdict = "promote";
      action = `Only in your ${zoneLabel(bestZone)}. Move it into your headline or skills so search picks it up.`;
    } else if (evidencedInCv) {
      verdict = "add";
      action = "Your CV proves this. Add it to your skills and headline.";
    } else {
      verdict = "gap";
      action = "Nothing in your CV backs this up. Build the evidence before you claim it.";
    }

    return { keyword: display, verdict, foundIn: bestZone, evidencedInCv, weight, action };
  });

  const totalWeight = findings.reduce((sum, f) => sum + f.weight, 0);
  const earned = findings.reduce((sum, f) => {
    const zoneWeight = f.foundIn ? ZONE_WEIGHTS[f.foundIn] : 0;
    return sum + f.weight * Math.min(1, zoneWeight / FULL_COVERAGE_WEIGHT);
  }, 0);

  const byWeight = (a: KeywordFinding, b: KeywordFinding) => b.weight - a.weight;

  // Achievable ceiling: matched stays matched, add/promote reach full coverage,
  // genuine gaps stay at zero. We never let the ceiling include a keyword the
  // candidate cannot defend in an interview.
  const achievable = findings.reduce((sum, f) => sum + (f.verdict === "gap" ? 0 : f.weight), 0);

  return {
    matchScore: totalWeight ? Math.round((earned / totalWeight) * 100) : 0,
    potentialScore: totalWeight ? Math.round((achievable / totalWeight) * 100) : 0,
    termCount: findings.length,
    matched: findings.filter((f) => f.verdict === "matched").sort(byWeight),
    promote: findings.filter((f) => f.verdict === "promote").sort(byWeight),
    add: findings.filter((f) => f.verdict === "add").sort(byWeight),
    gaps: findings.filter((f) => f.verdict === "gap").sort(byWeight),
    unevidenced: findings.filter((f) => !f.evidencedInCv).sort(byWeight),
  };
}

function zoneLabel(zone: ZoneKey): string {
  const labels: Record<ZoneKey, string> = {
    headline: "headline",
    skills: "skills section",
    experienceTitle: "job titles",
    about: "About section",
    experienceBody: "role descriptions",
    certifications: "certifications",
  };
  return labels[zone];
}



// ── Multi-JD Corpus Engine: macro-role signals, not single-JD noise ──────────

export type CorpusKeywordBucket = "global_profile" | "single_job_cv";

export type CorpusKeywordCategory = "technical" | "operations" | "client" | "business" | "other";

export type CorpusKeyword = {
  keyword: string;
  normalized: string;
  supportCount: number;
  totalJds: number;
  supportPercent: number;
  bucket: CorpusKeywordBucket;
  category: CorpusKeywordCategory;
  action: string;
};

export type RecruiterSearchQuery = {
  query: string;
  visible: boolean;
  missingTerms: string[];
};

export type JobCorpusResult = {
  jdCount: number;
  supportThreshold: number;
  globalProfileKeywords: CorpusKeyword[];
  singleJobCvKeywords: CorpusKeyword[];
  recruiterQueries: RecruiterSearchQuery[];
};

function uniqueNonEmptyJds(values: string[] | undefined): string[] {
  return (values ?? [])
    .map((v) => String(v || "").trim())
    .filter((v) => v.length >= 80)
    .slice(0, 5);
}


function keywordCategory(keyword: string): CorpusKeywordCategory {
  const value = normalizeRaw(keyword);
  if (/\b(sql|mysql|postgres|api|rest|html|css|javascript|typescript|python|java|windows|mac|macos|linux|server|mobile|active directory|microsoft 365|office 365|shopify|magento|shopware|network|router|switch|cloud|aws|azure|gcp|bash|powershell)\b/.test(value)) {
    return "technical";
  }
  if (/\b(incident|problem|change|service level|sla|itil|itsm|troubleshooting|root cause|escalation|configuration|documentation|ticketing|compliance|quality assurance|agile|scrum|project management|requirements analysis)\b/.test(value)) {
    return "operations";
  }
  if (/\b(customer support|technical support|customer training|online demos|client facing|customer success|stakeholder|communication|relationship management|end user|chat support|email support|voice support)\b/.test(value)) {
    return "client";
  }
  if (/\b(sales|revenue|retention|renewal|upsell|business development|market analysis|strategy)\b/.test(value)) {
    return "business";
  }
  return "other";
}

function isUsefulCorpusKeyword(keyword: string): boolean {
  const raw = normalizeRaw(keyword);
  const parts = raw.split(" ").filter(Boolean);
  if (!looksLikeProfessionalKeyword(parts)) return false;
  if (parts.length === 1 && (GENERIC.has(parts[0]) || BAD_KEYWORD_WORDS.has(parts[0]))) return false;
  if (/^(basic|creative|customer|customers|deliver|perform|requests|learn|systems|technical|communication)$/i.test(raw)) return false;
  if (/\b(salary|benefit|travel|conference|workplace|atmosphere|freedom|package|paid|quarter|specific further development)\b/i.test(raw)) return false;
  return true;
}

function corpusTerms(jobDescriptionCorpus: string[] | undefined, limitPerJd = 28): CorpusKeyword[] {
  const jds = uniqueNonEmptyJds(jobDescriptionCorpus);
  if (!jds.length) return [];

  const seen = new Map<string, { display: string; count: number; weight: number }>();
  for (const jd of jds) {
    const local = new Map<string, JdTerm>();
    for (const term of extractJdTerms(jd, limitPerJd)) {
      const previous = local.get(term.term);
      if (!previous || term.weight > previous.weight) local.set(term.term, term);
    }
    for (const term of local.values()) {
      const current = seen.get(term.term);
      if (current) {
        current.count += 1;
        current.weight += term.weight;
      } else {
        seen.set(term.term, { display: term.display, count: 1, weight: term.weight });
      }
    }
  }

  const threshold = Math.max(2, Math.ceil(jds.length * 0.6));
  return Array.from(seen.entries())
    .filter(([, meta]) => isUsefulCorpusKeyword(meta.display))
    .map(([normalized, meta]) => {
      const supportPercent = Math.round((meta.count / jds.length) * 100);
      const bucket: CorpusKeywordBucket = meta.count >= threshold ? "global_profile" : "single_job_cv";
      return {
        keyword: meta.display,
        normalized,
        supportCount: meta.count,
        totalJds: jds.length,
        supportPercent,
        bucket,
        category: keywordCategory(meta.display),
        action:
          bucket === "global_profile"
            ? `${meta.display} appears in ${meta.count}/${jds.length} target roles. Promote it on your permanent LinkedIn profile if your CV supports it.`
            : `${meta.display} appears in ${meta.count}/${jds.length} target roles. Treat it as single-application CV tailoring, not a permanent LinkedIn claim.`,
      };
    })
    .sort((a, b) => b.supportCount - a.supportCount || b.supportPercent - a.supportPercent || a.keyword.localeCompare(b.keyword));
}

function recruiterSearchQueries(linkedin: LinkedInProfile, keywords: CorpusKeyword[], targetRole?: string): RecruiterSearchQuery[] {
  const zones = linkedInZones(linkedin);
  const searchable = normalizeTerm([zones.headline, zones.skills, zones.experienceTitle, zones.about].join(" "));
  const title = String(targetRole || linkedin.headline || "Target Role").trim() || "Target Role";
  const core = keywords.slice(0, 8);
  const chunks: CorpusKeyword[][] = [];
  for (let i = 0; i < core.length; i += 3) chunks.push(core.slice(i, i + 3));
  return chunks.slice(0, 3).map((chunk) => {
    const missingTerms = chunk.filter((k) => !contains(searchable, k.normalized)).map((k) => k.keyword);
    const quoted = chunk.map((k) => `"${k.keyword}"`).join(" AND ");
    return {
      query: `("${title}" OR "${title.replace(/^Junior\s+/i, "").trim()}") AND ${quoted}`,
      visible: missingTerms.length === 0,
      missingTerms,
    };
  });
}

export function analyzeJobCorpus(input: {
  linkedin: LinkedInProfile;
  jobDescriptionCorpus?: string[];
  targetRole?: string;
}): JobCorpusResult | null {
  const jds = uniqueNonEmptyJds(input.jobDescriptionCorpus);
  if (!jds.length) return null;
  const all = corpusTerms(jds);
  const globalProfileKeywords = all.filter((k) => k.bucket === "global_profile").slice(0, 18);
  const singleJobCvKeywords = all.filter((k) => k.bucket === "single_job_cv").slice(0, 18);
  return {
    jdCount: jds.length,
    supportThreshold: Math.max(2, Math.ceil(jds.length * 0.6)),
    globalProfileKeywords,
    singleJobCvKeywords,
    recruiterQueries: recruiterSearchQueries(input.linkedin, globalProfileKeywords, input.targetRole),
  };
}

function corpusToWeightedJobDescription(corpus: JobCorpusResult | null, fallback = ""): string {
  if (!corpus) return fallback;

  // IMPORTANT: this synthetic JD is fed back into the deterministic JD matcher.
  // Do not include explanatory labels such as "single-job signal" or
  // "do not over-optimize LinkedIn" here, or the tokenizer will treat those
  // words as corpus text and surface them as fake gaps.
  // Only macro-role keywords are eligible for permanent LinkedIn SEO analysis.
  if (!corpus.globalProfileKeywords.length) return "";
  return corpus.globalProfileKeywords.map((k) => k.keyword).join("\n");
}

export type RecruiterBlindImpression = {
  score: number;
  verdict: "message" | "maybe" | "skip";
  summary: string;
  skipReasons: string[];
  nextClickReasons: string[];
};

export type CareerBrandHealth = {
  overallCareerBrand: number;
  searchDiscoverability: number;
  profileConsistency: number;
  recruiterBlindImpression: number;
};

function blindImpression(linkedin: LinkedInProfile, jdMatch: JdMatchResult | null, consistency: ConsistencyResult): RecruiterBlindImpression {
  const headlineGeneric = tokens(linkedin.headline || "").length < 4;
  const aboutTooThin = tokens(linkedin.about || "").length < 35;
  const hiddenSignals = jdMatch ? jdMatch.promote.slice(0, 4).map((k) => k.keyword) : [];
  const missingSignals = jdMatch ? jdMatch.add.slice(0, 4).map((k) => k.keyword) : [];
  const skipReasons = [
    ...(headlineGeneric ? ["Your headline is too generic for a recruiter search result."] : []),
    ...(aboutTooThin ? ["Your About section does not give enough proof in a quick skim."] : []),
    ...hiddenSignals.map((k) => `${k} is present but buried too low for a 20-second skim.`),
    ...consistency.findings.filter((f) => f.severity === "high").slice(0, 2).map((f) => f.message),
  ].slice(0, 6);
  const nextClickReasons = [
    ...((jdMatch?.matched ?? []).slice(0, 4).map((k) => `${k.keyword} is already visible.`)),
    ...missingSignals.map((k) => `${k} is CV-backed and worth adding.`),
  ].slice(0, 6);
  const base = 100 - skipReasons.length * 12 - (jdMatch ? Math.max(0, 70 - jdMatch.matchScore) * 0.35 : 8);
  const score = Math.max(15, Math.min(98, Math.round(base)));
  return {
    score,
    verdict: score >= 78 ? "message" : score >= 58 ? "maybe" : "skip",
    summary:
      score >= 78
        ? "I can understand your target direction quickly, and enough proof is visible to keep reading."
        : score >= 58
          ? "I see useful signals, but the strongest proof is not obvious fast enough."
          : "I would probably skip because the profile does not surface the role fit quickly enough.",
    skipReasons: skipReasons.length ? skipReasons : ["No major 20-second skim blocker found."],
    nextClickReasons: nextClickReasons.length ? nextClickReasons : ["Your profile needs stronger role-specific proof above the fold."],
  };
}

// ── Engine 2: CV ↔ LinkedIn consistency ──────────────────────────────────────

export type ConsistencySeverity = "high" | "medium" | "low";

export type ConsistencyCode =
  | "role_missing_on_linkedin"
  | "role_missing_on_cv"
  | "title_mismatch"
  | "duration_mismatch"
  | "skills_missing_on_linkedin"
  | "skills_unevidenced_on_linkedin"
  | "headline_disconnected"
  | "name_mismatch";

export type ConsistencyFinding = {
  code: ConsistencyCode;
  severity: ConsistencySeverity;
  message: string;
  cv?: string;
  linkedin?: string;
  items?: string[];
};

export type ConsistencyResult = {
  consistencyScore: number;
  findings: ConsistencyFinding[];
  skillsOnlyInCv: string[];
  skillsOnlyOnLinkedIn: string[];
  matchedRoles: number;
  /**
   * False when the LinkedIn source carried only a partial skills list (the PDF
   * export). `skillsOnlyInCv` is still returned for display, but it is NOT a
   * finding and carries no score penalty, because the absence is an artefact of
   * the export rather than an omission by the candidate.
   */
  skillsChecked: boolean;
};

const SEVERITY_PENALTY: Record<ConsistencySeverity, number> = { high: 15, medium: 8, low: 3 };
const SEVERITY_RANK: Record<ConsistencySeverity, number> = { high: 0, medium: 1, low: 2 };

/** Two titles for the same employer disagree when they barely share vocabulary. */
const TITLE_SIMILARITY_FLOOR = 0.34;
/** Employers are the same when their names mostly overlap after stripping suffixes. */
const COMPANY_SIMILARITY_FLOOR = 0.6;
/** Tenure disagreements below this are rounding, not inconsistency. */
const DURATION_TOLERANCE_MONTHS = 6;

function findCompanyMatch(company: string, candidates: string[]): number {
  const key = companyKey(company);
  if (!key) return -1;

  const exact = candidates.findIndex((c) => companyKey(c) === key);
  if (exact !== -1) return exact;

  const keyTokens = new Set(key.split(" "));
  let bestIndex = -1;
  let bestScore = 0;
  candidates.forEach((candidate, index) => {
    const score = jaccard(keyTokens, new Set(companyKey(candidate).split(" ")));
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestScore >= COMPANY_SIMILARITY_FLOOR ? bestIndex : -1;
}

function monthsOf(dates: string): number | null {
  return parseDateRange(dates)?.months ?? null;
}

function isCurrent(dates: string): boolean {
  return parseDateRange(dates)?.present ?? false;
}


const TITLE_EQUIVALENT_GROUPS = [
  ["technical support engineer", "technical support specialist", "it support specialist", "it support engineer", "support engineer", "application engineer"],
  ["customer success manager", "client success manager", "customer success specialist", "account success manager"],
  ["data analyst", "business intelligence analyst", "bi analyst", "reporting analyst"],
  ["software engineer", "software developer", "application developer"],
  ["project manager", "it project manager", "technical project manager"],
];

function canonicalTitleFamily(value: string): string {
  const normalized = normalizeRaw(value)
    .replace(/\b(junior|senior|lead|principal|associate|level\s*[123]|1st|2nd|3rd)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (const group of TITLE_EQUIVALENT_GROUPS) {
    if (group.some((title) => normalized === title || normalized.includes(title) || title.includes(normalized))) {
      return group[0];
    }
  }
  return normalized;
}

function titlesAreEquivalent(a: string, b: string): boolean {
  const ca = canonicalTitleFamily(a);
  const cb = canonicalTitleFamily(b);
  if (!ca || !cb) return false;
  if (ca === cb) return true;
  const aTokens = tokenSet(ca);
  const bTokens = tokenSet(cb);
  const sharedRoleWord = ["support", "engineer", "specialist", "manager", "analyst", "developer", "designer", "consultant"]
    .some((word) => aTokens.has(word) && bTokens.has(word));
  return sharedRoleWord && jaccard(aTokens, bTokens) >= 0.45;
}

function datePrecision(value: string): "month" | "year" | "unknown" {
  const raw = String(value || "").toLowerCase();
  if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\b/.test(raw)) return "month";
  if (/\b(19|20)\d{2}\b/.test(raw)) return "year";
  return "unknown";
}

export function checkCvLinkedInConsistency(input: {
  linkedin: LinkedInProfile;
  resumeProfile: ResumeProfile;
  cvText?: string;
}): ConsistencyResult {
  const { linkedin, resumeProfile, cvText = "" } = input;
  const findings: ConsistencyFinding[] = [];

  // ── Roles ──────────────────────────────────────────────────────────────────
  const liCompanies = linkedin.experience.map((r) => r.company);
  const consumed = new Set<number>();
  let matchedRoles = 0;

  for (const cvRole of resumeProfile.experience ?? []) {
    if (!cvRole?.company && !cvRole?.title) continue;

    const index = cvRole.company ? findCompanyMatch(cvRole.company, liCompanies) : -1;
    if (index === -1) {
      const current = isCurrent(cvRole.dates || "");
      findings.push({
        code: "role_missing_on_linkedin",
        // A missing *current* role is the single most damaging inconsistency a
        // recruiter can find. It reads as either stale or evasive.
        severity: current ? "high" : "medium",
        message: current
          ? `Your current role at ${cvRole.company} is on your CV but not on LinkedIn.`
          : `${cvRole.title || "A role"} at ${cvRole.company} is on your CV but not on LinkedIn.`,
        cv: [cvRole.title, cvRole.company, cvRole.dates].filter(Boolean).join(" • "),
      });
      continue;
    }

    consumed.add(index);
    matchedRoles += 1;
    const liRole = linkedin.experience[index];

    const similarity = jaccard(tokenSet(cvRole.title || ""), tokenSet(liRole.title || ""));
    if (cvRole.title && liRole.title && !titlesAreEquivalent(cvRole.title, liRole.title) && similarity < TITLE_SIMILARITY_FLOOR) {
      findings.push({
        code: "title_mismatch",
        severity: "high",
        message: `At ${liRole.company || cvRole.company}, your CV says "${cvRole.title}" but LinkedIn says "${liRole.title}".`,
        cv: cvRole.title,
        linkedin: liRole.title,
      });
    } else if (cvRole.title && liRole.title && cvRole.title.trim().toLowerCase() !== liRole.title.trim().toLowerCase()) {
      findings.push({
        code: "title_mismatch",
        severity: "low",
        message: `At ${liRole.company || cvRole.company}, the titles use slightly different but closely related wording.`,
        cv: cvRole.title,
        linkedin: liRole.title,
      });
    }

    const cvMonths = monthsOf(cvRole.dates || "");
    const liMonths = monthsOf(liRole.dates || "");
    const cvPrecision = datePrecision(cvRole.dates || "");
    const liPrecision = datePrecision(liRole.dates || "");
    if (
      cvMonths != null &&
      liMonths != null &&
      cvPrecision === "month" &&
      liPrecision === "month" &&
      Math.abs(cvMonths - liMonths) > DURATION_TOLERANCE_MONTHS
    ) {
      findings.push({
        code: "duration_mismatch",
        severity: "medium",
        message: `Tenure at ${liRole.company || cvRole.company} differs by ${Math.abs(cvMonths - liMonths)} months between your CV and LinkedIn.`,
        cv: cvRole.dates,
        linkedin: liRole.dates,
      });
    }
  }

  linkedin.experience.forEach((liRole, index) => {
    if (consumed.has(index) || !liRole.company) return;
    findings.push({
      code: "role_missing_on_cv",
      severity: "medium",
      message: `${liRole.title || "A role"} at ${liRole.company} is on LinkedIn but not on your CV.`,
      linkedin: [liRole.title, liRole.company, liRole.dates].filter(Boolean).join(" • "),
    });
  });

  // ── Skills ─────────────────────────────────────────────────────────────────
  const liSkillSet = new Set(linkedin.skills.map(normalizeTerm).filter(Boolean));
  const liAllText = normalizeTerm(
    [linkedin.headline, linkedin.about, linkedin.skills.join(" "),
      linkedin.experience.map((r) => `${r.title} ${r.bullets.join(" ")}`).join(" ")].join(" "),
  );
  const cvEvidence = cvEvidenceText(resumeProfile, cvText);

  const skillsOnlyInCv = (resumeProfile.skills ?? [])
    .filter((skill) => {
      const term = normalizeTerm(skill);
      return term && !liSkillSet.has(term) && !contains(liAllText, term);
    })
    .slice(0, 20);

  // A LinkedIn skill the CV cannot support is a real interview risk: it is the
  // claim a recruiter will open with, and the CV has no story behind it.
  const skillsOnlyOnLinkedIn = linkedin.skills
    .filter((skill) => {
      const term = normalizeTerm(skill);
      return term && !contains(cvEvidence, term);
    })
    .slice(0, 20);

  // Only a complete skills list can prove an omission. The PDF export truncates
  // to top skills, so a CV skill absent from it is unremarkable, and reporting
  // it would be a fabricated finding — the exact failure this engine exists to
  // avoid on the LinkedIn side.
  if (skillsOnlyInCv.length && linkedin.skillsComplete) {
    findings.push({
      code: "skills_missing_on_linkedin",
      severity: skillsOnlyInCv.length >= 5 ? "medium" : "low",
      message: `${skillsOnlyInCv.length} skill${skillsOnlyInCv.length === 1 ? "" : "s"} on your CV never appear anywhere on your LinkedIn profile.`,
      items: skillsOnlyInCv,
    });
  }

  if (skillsOnlyOnLinkedIn.length) {
    findings.push({
      code: "skills_unevidenced_on_linkedin",
      severity: skillsOnlyOnLinkedIn.length >= 5 ? "medium" : "low",
      message: `${skillsOnlyOnLinkedIn.length} skill${skillsOnlyOnLinkedIn.length === 1 ? " on LinkedIn has" : "s on LinkedIn have"} no supporting evidence in your CV.`,
      items: skillsOnlyOnLinkedIn,
    });
  }

  // ── Headline ───────────────────────────────────────────────────────────────
  const mostRecentTitle = resumeProfile.experience?.[0]?.title || "";
  const headlineAnchor = tokenSet(`${resumeProfile.basics?.headline ?? ""} ${mostRecentTitle}`);
  if (linkedin.headline && headlineAnchor.size) {
    const overlap = jaccard(tokenSet(linkedin.headline), headlineAnchor);
    if (overlap === 0) {
      findings.push({
        code: "headline_disconnected",
        severity: "medium",
        message: "Your LinkedIn headline shares no vocabulary with your CV headline or most recent job title.",
        cv: resumeProfile.basics?.headline || mostRecentTitle,
        linkedin: linkedin.headline,
      });
    }
  }

  // ── Name ───────────────────────────────────────────────────────────────────
  const cvName = normalizeTerm(resumeProfile.basics?.name ?? "");
  const liName = normalizeTerm(linkedin.name);
  if (cvName && liName && jaccard(tokenSet(cvName), tokenSet(liName)) < 0.5) {
    findings.push({
      code: "name_mismatch",
      severity: "low",
      message: "The name on your CV and the name on your LinkedIn profile do not match.",
      cv: resumeProfile.basics?.name,
      linkedin: linkedin.name,
    });
  }

  // ── Score ──────────────────────────────────────────────────────────────────
  const penalty = findings.reduce((sum, f) => sum + SEVERITY_PENALTY[f.severity], 0);

  findings.sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.code.localeCompare(b.code),
  );

  return {
    consistencyScore: Math.max(0, Math.min(100, 100 - penalty)),
    findings,
    skillsOnlyInCv,
    skillsOnlyOnLinkedIn,
    matchedRoles,
    skillsChecked: linkedin.skillsComplete,
  };
}

// ── Combined entry point ─────────────────────────────────────────────────────

export type LinkedInAnalysis = {
  consistency: ConsistencyResult;
  jdMatch: JdMatchResult | null;
  corpus: JobCorpusResult | null;
  blindImpression: RecruiterBlindImpression;
  careerBrandHealth: CareerBrandHealth;
  linkedin: LinkedInProfile;
};

export function analyzeLinkedIn(input: {
  linkedin: LinkedInProfile;
  resumeProfile: ResumeProfile;
  cvText?: string;
  jobDescription?: string;
  jobDescriptionCorpus?: string[];
  targetRole?: string;
}): LinkedInAnalysis {
  const { linkedin, resumeProfile, cvText = "", jobDescription = "", jobDescriptionCorpus, targetRole = "" } = input;
  const corpus = analyzeJobCorpus({ linkedin, jobDescriptionCorpus, targetRole });
  const weightedJobDescription = corpusToWeightedJobDescription(corpus, jobDescription);
  const consistency = checkCvLinkedInConsistency({ linkedin, resumeProfile, cvText });
  const jdMatch = weightedJobDescription.trim()
    ? matchLinkedInToJd({ linkedin, resumeProfile, cvText, jobDescription: weightedJobDescription })
    : null;
  const blind = blindImpression(linkedin, jdMatch, consistency);
  const baseVisibility = Math.min(
    100,
    Math.round(
      (tokens(linkedin.headline || "").length >= 4 ? 30 : 15) +
      (linkedin.skills.length >= 5 ? 25 : linkedin.skills.length * 4) +
      (tokens(linkedin.about || "").length >= 35 ? 25 : 12) +
      (linkedin.experience.length >= 2 ? 20 : linkedin.experience.length * 10),
    ),
  );
  const searchDiscoverability = jdMatch?.matchScore ?? baseVisibility;
  const overallCareerBrand = Math.round(
    searchDiscoverability * 0.4 + consistency.consistencyScore * 0.35 + blind.score * 0.25,
  );
  return {
    consistency,
    jdMatch,
    corpus,
    blindImpression: blind,
    careerBrandHealth: {
      overallCareerBrand,
      searchDiscoverability,
      profileConsistency: consistency.consistencyScore,
      recruiterBlindImpression: blind.score,
    },
    linkedin,
  };
}
