/*
 * lib/jobs/requirementExtractor.ts
 *
 * Turns a raw job description into STRUCTURED requirements: each one carrying a
 * category, a criticality, and the line it came from.
 *
 * THE BUG THIS EXISTS TO KILL
 *
 * lib/jobs/ranking.ts decided which requirements were critical like this:
 *
 *     const criticalReqs = requirements.slice(0, 5);   // "the first few listed"
 *
 * Criticality was POSITION. A job ad that opens with its nice-to-haves ("Bonus
 * points if you have Kubernetes") had them scored as blocking, and an ad that
 * buries its one hard requirement at the bottom ("You must hold a valid nursing
 * licence") scored it as optional. The candidate is then told they are a strong
 * match for a job they are legally not allowed to do.
 *
 * Criticality is a property of LANGUAGE, not of ORDER. "Must have", "required",
 * "essential" and "erforderlich" mean required. "Nice to have", "a plus",
 * "wünschenswert" and "se valorará" mean preferred. That is what we read.
 *
 * DESIGN RULES
 *
 * 1. No sample vocabulary. There is no list of company names, no list of
 *    technologies, no words lifted from one job ad. The only closed-class
 *    lexicons here are genuinely closed classes that exist in every language
 *    (language names, degree words, work models, seniority markers), plus
 *    SHAPE-based detection for technology (acronyms, CamelCase, dotted names,
 *    versioned tokens), which generalises to tools that did not exist when this
 *    was written.
 *
 * 2. The phrase vocabulary is not re-derived here. `extractJobRequirements` in
 *    lib/jobs/normalize.ts is already tuned, multilingual, acronym-aware and
 *    noise-filtered. It decides WHAT counts as a requirement phrase. This module
 *    decides HOW IMPORTANT each one is and WHAT KIND it is. One extractor, one
 *    place to fix.
 *
 * 3. Multilingual by construction. WorkZo runs in many markets, so an
 *    English-only criticality reader would silently mark every German or French
 *    ad's requirements as "unknown" and the penalties would never fire.
 */

import { extractJobRequirements } from "@/lib/jobs/normalize";
import type { JobRequirementCategory, JobRequirementCriticality } from "@/lib/jobs/types";
import { isSameRequirement } from "@/lib/jobs/textStems";

export type ExtractedRequirement = {
  requirement: string;
  category: JobRequirementCategory;
  criticality: JobRequirementCriticality;
  /** The JD line this was read from. Provenance, so a match can be explained. */
  sourceLine: string;
};

/* ─────────────────────────── noise (spec section 9) ───────────────────────── */

/*
 * Lines that are never requirements. Filtering these BEFORE criticality is read
 * matters: "We offer a competitive salary and require nothing but your passion"
 * would otherwise contribute a "required" marker.
 */
const NOISE_LINE = new RegExp(
  [
    // compensation and benefits
    "\\b(salary|compensation|bonus scheme|equity|stock options?|pension|benefits?|perks?|holiday allowance|vacation days?|gehalt|verg[üu]tung|zusatzleistungen|salaire|avantages|salario|beneficios)\\b",
    // employer marketing and culture
    "\\b(we are an? (fast[- ]growing|leading|award[- ]winning)|our mission|our culture|join us|why (us|join)|about us|who we are|unser team|über uns|notre mission|sobre nosotros)\\b",
    // diversity statements
    "\\b(equal opportunit|diversity|inclusi(on|ve)|regardless of (race|gender)|schwerbehinder|chancengleichheit|égalité|igualdad de oportunidades)\\b",
    // application instructions and legal boilerplate
    "\\b(apply (now|via|through|by)|send your (cv|resume|application)|application deadline|reference number|data protection|privacy policy|gdpr|dsgvo|bewerbung(en)? (an|über)|postuler|env[íi]a tu)\\b",
  ].join("|"),
  "i",
);

/* ───────────────────────── criticality (language, not order) ─────────────── */

/*
 * Heading-level criticality. A JD is usually organised into blocks, and the block
 * heading governs everything under it until the next heading.
 */
const REQUIRED_HEADING = new RegExp(
  [
    "\\b(requirements?|required|must[- ]haves?|essentials?|qualifications?|what you (bring|need|will need)|your profile|we expect|you (have|will have)|minimum)\\b",
    "\\b(anforderungen|erforderlich|voraussetzungen|dein profil|ihr profil|das bringst du mit|wir erwarten)\\b",
    "\\b(profil recherch[ée]|exigences?|requis|vous (avez|justifiez))\\b",
    "\\b(requisitos|imprescindible|perfil requerido|qu[ée] necesitas)\\b",
  ].join("|"),
  "i",
);

const PREFERRED_HEADING = new RegExp(
  [
    "\\b(nice[- ]to[- ]haves?|preferred|desirable|advantageous|bonus|pluses|good to have|would be a plus|optional)\\b",
    "\\b(w[üu]nschenswert|von vorteil|nice to have|idealerweise|dar[üu]ber hinaus)\\b",
    "\\b(atouts?|souhait[ée]|appr[ée]ci[ée]|serait un plus)\\b",
    "\\b(deseable|valorable|se valorar[áa]|no imprescindible)\\b",
  ].join("|"),
  "i",
);

/*
 * Inline markers. These OVERRIDE the heading, because a single bullet can opt
 * out of its block: under "Requirements", the line "Kubernetes is a plus" is
 * still a preference.
 */
const INLINE_PREFERRED = new RegExp(
  [
    "\\b(nice to have|a plus|is a plus|would be a plus|bonus|preferred|preferably|ideally|desirable|advantageous|good to have|not (strictly )?required|optional)\\b",
    "\\b(w[üu]nschenswert|von vorteil|idealerweise|gerne auch|kein muss)\\b",
    "\\b(un (plus|atout)|appr[ée]ci[ée]|souhait[ée]|id[ée]alement)\\b",
    "\\b(deseable|valorable|se valorar[áa]|preferiblemente)\\b",
  ].join("|"),
  "i",
);

const INLINE_REQUIRED = new RegExp(
  [
    "\\b(must (have|be|hold|possess)|required|require[sd]?|essential|mandatory|minimum of|at least|proven|demonstrable|you (must|will need to)|non[- ]negotiable)\\b",
    "\\b(muss|zwingend|erforderlich|vorausgesetzt|mindestens|nachweislich|zwingend erforderlich)\\b",
    "\\b(obligatoire|imp[ée]ratif|exig[ée]|au moins|minimum)\\b",
    "\\b(imprescindible|obligatorio|se requiere|al menos|m[íi]nimo)\\b",
  ].join("|"),
  "i",
);

/*
 * A heading is short, has few content words, and often ends in a colon. We do not
 * require the colon: plenty of ads use bold text with no punctuation.
 */
function isHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/^[-•*▪·]/.test(trimmed)) return false; // a bullet is never a heading
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > 8) return false;
  return trimmed.endsWith(":") || wordCount <= 6;
}

function headingCriticality(line: string): JobRequirementCriticality | null {
  // Preferred is checked first: "Nice to have requirements" is a preferred block,
  // and it contains the word "requirements".
  if (PREFERRED_HEADING.test(line)) return "preferred";
  if (REQUIRED_HEADING.test(line)) return "required";
  return null;
}

function lineCriticality(line: string, inherited: JobRequirementCriticality): JobRequirementCriticality {
  if (INLINE_PREFERRED.test(line)) return "preferred";
  if (INLINE_REQUIRED.test(line)) return "required";
  return inherited;
}

/* ───────────────────────────── category detection ────────────────────────── */

/*
 * Closed classes only. These are not "vocabulary from a sample JD": a language is
 * a language in every job ad ever written, and a degree is a degree. Anything
 * open-ended (technologies, domains) is detected by SHAPE below, so a tool
 * invented next year still classifies correctly.
 */
const LANGUAGE_NAMES = new RegExp(
  "\\b(english|german|french|spanish|italian|portuguese|dutch|polish|russian|arabic|mandarin|chinese|japanese|korean|turkish|swedish|danish|norwegian|finnish|czech|greek|hungarian|romanian|hindi|urdu" +
    "|englisch|deutsch|franz[öo]sisch|spanisch|italienisch|niederl[äa]ndisch" +
    "|anglais|allemand|fran[çc]ais|espagnol" +
    "|ingl[ée]s|alem[áa]n|franc[ée]s|espa[ñn]ol)\\b",
  "i",
);

const LANGUAGE_LEVEL = /\b([abc][12]|native|fluent|bilingual|mother ?tongue|muttersprach\w*|verhandlungssicher|courant|nativo|biling[üu]e)\b/i;

const EDUCATION_WORDS = new RegExp(
  "\\b(bachelor|master|phd|doctorate|degree|diploma|bsc|msc|ba|ma|mba|university|graduate|apprenticeship|certified|certification|licence|license|accredited" +
    "|studium|abschluss|ausbildung|hochschul\\w*|zertifiziert|zertifizierung" +
    "|dipl[ôo]me|licence|ma[îi]trise|certifi[ée]" +
    "|licenciatura|grado|t[íi]tulo|certificado)\\b",
  "i",
);

const EXPERIENCE_WORDS = new RegExp(
  "(\\b\\d+\\s*\\+?\\s*(years?|yrs?|jahre|ans|a[ñn]os)\\b)|\\b(senior|junior|lead|principal|entry[- ]level|graduate|track record|background in|berufserfahrung|erfahrung von|exp[ée]rience de|experiencia de)\\b",
  "i",
);

const LOCATION_WORDS = new RegExp(
  "\\b(remote|hybrid|on[- ]?site|in[- ]office|relocat\\w*|willing to travel|work permit|visa|eligib\\w* to work|right to work|based in|onsite" +
    "|vor ort|hybrid|arbeitserlaubnis|umzug|reisebereitschaft" +
    "|t[ée]l[ée]travail|sur site|permis de travail" +
    "|presencial|teletrabajo|permiso de trabajo)\\b",
  "i",
);

const SOFT_SKILL_WORDS = new RegExp(
  "\\b(communicat\\w*|teamwork|team player|collaborat\\w*|stakeholder|interpersonal|leadership|mentor\\w*|proactive|self[- ]motivated|problem[- ]solving|attention to detail|organis\\w*|organiz\\w*|adaptab\\w*|customer[- ]facing" +
    "|kommunikat\\w*|teamf[äa]hig\\w*|eigenverantwortlich|f[üu]hrung" +
    "|communication|travail d.[ée]quipe|autonomie" +
    "|comunicaci[óo]n|trabajo en equipo|liderazgo)\\b",
  "i",
);

/*
 * SHAPE-based technology detection. No list of tools.
 *
 * A technology token tends to look like one of these:
 *   - an acronym in caps          SQL, API, AWS, SAP, EDR, HACCP, ITIL
 *   - CamelCase or mixedCase      PowerBI, JavaScript, TypeScript, PostgreSQL
 *   - a dotted or plussed name    Node.js, .NET, C++, C#
 *   - a versioned token           Python 3, HTTP/2, Windows 11
 *
 * This is why a new framework released tomorrow is still classified as technical,
 * and why a hardcoded SKILL_LIBRARY would have quietly failed on it.
 */
/*
 * SHAPE-based technology detection, plus a morphology fallback for the lowercase
 * tool names that shape alone cannot catch.
 *
 * Shape catches the obvious cases: acronyms (SQL, AWS), CamelCase (JavaScript),
 * dotted and plussed names (Node.js, C++), versioned tokens (Python3).
 *
 * But many real tools are plain lowercase words with NO distinguishing shape:
 * "docker", "python", "kubernetes", "react", "django". Shape reads those as ordinary
 * prose and files them under "other", which silently under-weights them everywhere
 * (the CV tailorer, the cover letter, the fill data all key off category). The bug
 * was invisible because "other" still counts as a soft match, just in the wrong bucket
 * and at the wrong weight.
 *
 * We do NOT solve this with a big hardcoded skill dictionary: that is the exact
 * anti-pattern this file avoids, and it would rot the moment a new tool ships. Instead
 * we use two cheap, general signals that generalise:
 *   1. technology-shaped SUFFIXES (-js, -ql, -db, -ops, -.io style), and
 *   2. a small, stable set of irreducible lowercase names that genuinely have no other
 *      distinguishing feature and are too common to miss. This list is intentionally
 *      tiny and only holds tokens that cannot be inferred any other way.
 */
const LOWERCASE_TECH_SUFFIX = /(?:js|ql|db|ops|ci|sdk|api|css|html|xml|json|yaml|sql|lang|net)$/i;

// Irreducible: common lowercase tool/lang names with no acronym/camel/dot/version
// shape. Kept deliberately short. Anything with a detectable shape is NOT listed here.
const IRREDUCIBLE_TECH = new Set([
  "docker", "kubernetes", "python", "java", "ruby", "rust", "golang", "kotlin", "swift", "scala",
  "react", "angular", "vue", "svelte", "django", "flask", "rails", "spring", "laravel", "express",
  "node", "deno", "webpack", "vite", "babel", "eslint", "jest", "cypress", "selenium",
  "terraform", "ansible", "jenkins", "kafka", "redis", "mongodb", "postgres", "postgresql", "mysql",
  "elasticsearch", "rabbitmq", "nginx", "apache", "linux", "unix", "ubuntu", "bash", "powershell",
  "git", "github", "gitlab", "jira", "figma", "sketch", "tableau", "looker", "snowflake", "databricks",
  "pytorch", "tensorflow", "keras", "pandas", "numpy", "spark", "hadoop", "airflow",
  "graphql", "grpc", "helm", "prometheus", "grafana", "datadog", "sentry",
]);

function looksTechnical(phrase: string): boolean {
  const tokens = phrase.split(/[\s/]+/).filter(Boolean);
  return tokens.some((raw) => {
    const token = raw.replace(/[.,;:]+$/, "");
    if (!token) return false;
    if (/^[A-Z]{2,6}$/.test(token)) return true; // SQL, AWS, HACCP
    if (/^[A-Za-z]+\+\+?$|^[A-Za-z]#$/.test(token)) return true; // C++, C#
    if (/^\.?[A-Za-z][A-Za-z0-9]*\.(js|net|io|py|sh)$/i.test(token)) return true; // Node.js, .NET
    if (/[a-z][A-Z]/.test(token)) return true; // PowerBI, JavaScript
    if (/^[A-Za-z]+\d+(\.\d+)?$/.test(token) && /\d/.test(token)) return true; // Python3
    // Lowercase fallbacks:
    const lower = token.toLowerCase();
    if (IRREDUCIBLE_TECH.has(lower)) return true; // docker, python, react
    if (token.length >= 4 && LOWERCASE_TECH_SUFFIX.test(token)) return true; // nextjs, graphql, mongodb
    return false;
  });
}

/*
 * Order matters. A phrase like "5 years of German" is an experience-flavoured
 * language requirement, and the language reading is the one that carries a real
 * penalty, so language is tested before experience. Location is tested early for
 * the same reason: "eligible to work in Germany" contains a language name.
 */
function categorize(phrase: string, line: string): JobRequirementCategory {
  const haystack = `${phrase} ${line}`;

  if (LOCATION_WORDS.test(phrase)) return "location";
  if (LANGUAGE_NAMES.test(phrase) || (LANGUAGE_LEVEL.test(phrase) && LANGUAGE_NAMES.test(haystack))) return "language";
  if (EDUCATION_WORDS.test(phrase)) return "education";
  if (looksTechnical(phrase)) return "technical";
  if (EXPERIENCE_WORDS.test(phrase)) return "experience";
  if (SOFT_SKILL_WORDS.test(phrase)) return "soft_skill";

  // A multi-word phrase with no technical shape and no soft-skill marker is
  // usually domain knowledge ("intensive care", "food hygiene", "claims handling").
  if (phrase.trim().split(/\s+/).length >= 2) return "domain";
  return "other";
}

/* ─────────────────── class requirements (the ones skills-extraction drops) ── */

/*
 * `extractJobRequirements` is a SKILLS extractor. It is good at that, and it is
 * what produces "acute care", "Power BI", "root cause analysis".
 *
 * It is blind, by design, to the four categories that carry the HEAVIEST penalties:
 *
 *     "You must hold a valid nursing licence"   -> nothing
 *     "Fluent German is required (C1)"          -> nothing
 *     "At least 3 years of acute care"          -> "acute care", losing the 3 years
 *     "Willing to relocate to Munich"           -> nothing
 *
 * Using it as the ONLY gate meant the hardest requirements in the ad, the ones a
 * candidate is actually screened out on, were silently invisible to scoring. A
 * nurse with no licence read as a strong match.
 *
 * So we also read these classes straight off the requirement lines. They are closed
 * classes with stable surface forms in every language, which is exactly why they can
 * be matched structurally rather than guessed at.
 */

/** Strip modal and filler prefixes so the requirement reads as a noun phrase. */
function stripModalPrefix(line: string): string {
  return line
    .replace(/^\s*[-•*▪·]\s*/, "")
    .replace(
      /^(you (must|should|will need to|need to|are expected to)\s+(have|hold|possess|be)?|we (require|expect)|must (have|hold|possess|be)|required:?|minimum:?|ideally,?|preferably,?|du (musst|solltest)|sie (m[üu]ssen|sollten)|vous (devez|avez))\s*/i,
      "",
    )
    .replace(/^(a|an|the)\s+/i, "")
    .trim();
}

function truncateClause(value: string, maxWords = 9): string {
  const cleaned = value.replace(/\s*[.;:]\s*$/, "").replace(/\s+/g, " ").trim();
  const words = cleaned.split(" ");
  return words.length <= maxWords ? cleaned : words.slice(0, maxWords).join(" ");
}

/**
 * Pull the salient requirement span out of a line for the high-penalty classes.
 * Returns null when the line carries no such requirement.
 */
function classRequirementsFromLine(line: string): Array<{ requirement: string; category: JobRequirementCategory }> {
  const found: Array<{ requirement: string; category: JobRequirementCategory }> = [];
  const body = stripModalPrefix(line);

  /* Language: the language name, plus its level when the ad states one. */
  const lang = line.match(LANGUAGE_NAMES);
  if (lang) {
    const level = line.match(LANGUAGE_LEVEL);
    const name = lang[0].replace(/^\w/, (c) => c.toUpperCase());
    found.push({
      requirement: level ? `${name} (${level[0].toUpperCase()})` : name,
      category: "language",
    });
  }

  /* Experience: keep the DURATION attached to what it is a duration OF. */
  const years = body.match(/\b(\d{1,2})\s*\+?\s*(?:years?|yrs?|jahre|ans|a[ñn]os)\b(.*)$/i);
  if (years) {
    const tail = truncateClause((years[2] || "").replace(/^\s*(of|in|with|von|de|en)\s+/i, ""), 6);
    found.push({
      requirement: tail ? `${years[1]}+ years ${tail}` : `${years[1]}+ years experience`,
      category: "experience",
    });
  }

  /* Education, licences, certifications: a hard gate in regulated professions. */
  if (EDUCATION_WORDS.test(body)) {
    found.push({ requirement: truncateClause(body, 8), category: "education" });
  }

  /* Location and work model: relocation, permits, onsite expectations. */
  if (LOCATION_WORDS.test(body)) {
    found.push({ requirement: truncateClause(body, 8), category: "location" });
  }

  return found.filter((f) => f.requirement.length >= 3);
}

/* ────────────────────────────────── extract ──────────────────────────────── */

export function extractStructuredRequirements(
  jobDescription: string,
  limit = 24,
): ExtractedRequirement[] {
  const text = (jobDescription || "").trim();
  if (!text) return [];

  /*
   * Step 1: the SKILL phrase vocabulary. We do not re-derive this. normalize.ts
   * already knows what a skill phrase looks like across languages, and
   * re-implementing that here is how two extractors drift apart.
   */
  const phrases = extractJobRequirements(text, Math.max(limit, 24));

  /*
   * Step 2: walk the ad and build a criticality map, line by line. Headings set the
   * inherited criticality for the block beneath them; inline markers override it.
   */
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  type LineInfo = { text: string; criticality: JobRequirementCriticality };
  const kept: LineInfo[] = [];
  let inherited: JobRequirementCriticality = "unknown";

  for (const line of lines) {
    if (isHeading(line)) {
      const heading = headingCriticality(line);
      /*
       * An unrecognised heading ENDS the previous block rather than extending it.
       * Otherwise a "Requirements:" block leaks its criticality into the
       * "What we offer:" block that follows, and the salary becomes mandatory.
       */
      inherited = heading ?? "unknown";
      continue;
    }
    if (NOISE_LINE.test(line)) continue;
    kept.push({ text: line, criticality: lineCriticality(line, inherited) });
  }

  const RANK: Record<JobRequirementCriticality, number> = { required: 3, preferred: 2, unknown: 1 };
  const out: ExtractedRequirement[] = [];
  const seen = new Set<string>();

  const add = (
    requirement: string,
    category: JobRequirementCategory,
    criticality: JobRequirementCriticality,
    sourceLine: string,
  ) => {
    const key = `${category}:${requirement.toLowerCase()}`;
    if (seen.has(key)) return;

    /*
     * Cross-path duplicate guard.
     *
     * The class reader emits "German (FLUENT)"; the skills phrase extractor emits
     * "Fluent German" from the same line. Same requirement, two surface forms, and
     * the scorer charged the 18-point missing-language penalty TWICE for one gap,
     * so a single missing language cost 36 points and dragged a good candidate into
     * "low match".
     *
     * Class requirements are added first and are richer (they carry the level, the
     * duration, the credential), so the first one added wins and the phrase-derived
     * restatement is dropped.
     */
    if (out.some((existing) => isSameRequirement(existing.requirement, requirement))) return;

    seen.add(key);
    out.push({ requirement, category, criticality, sourceLine: sourceLine.slice(0, 300) });
  };

  /* Step 3: class requirements, read straight off each kept line. */
  for (const line of kept) {
    for (const item of classRequirementsFromLine(line.text)) {
      add(item.requirement, item.category, line.criticality, line.text);
    }
  }

  /*
   * Step 4: bind each SKILL phrase to the strongest line that contains it.
   * required beats preferred beats unknown, because a requirement stated as
   * mandatory anywhere in the ad IS mandatory, even if it is also listed as a
   * nice-to-have elsewhere.
   */
  for (const phrase of phrases) {
    const needle = phrase.toLowerCase();

    let best: LineInfo | null = null;
    for (const line of kept) {
      if (!line.text.toLowerCase().includes(needle)) continue;
      if (!best || RANK[line.criticality] > RANK[best.criticality]) best = line;
    }

    /*
     * A phrase that survives only inside a noise line (a salary blurb, a culture
     * statement) is not a requirement. Drop it rather than score against it.
     */
    if (!best) continue;

    add(phrase, categorize(phrase, best.text), best.criticality, best.text);
  }

  /*
   * Step 5: required first, so that a UI truncating to "top N" truncates the
   * OPTIONAL ones. This is PRESENTATION order only. Nothing downstream ever reads
   * criticality from position again.
   */
  out.sort((a, b) => RANK[b.criticality] - RANK[a.criticality]);
  return out.slice(0, limit);
}
