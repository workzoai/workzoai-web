/**
 * Regression: PRODUCTION LOG FAILURES.
 *
 *   npx tsx eval/regression_cv_production_logs.ts
 *
 * Every case below is a REAL failure observed in the uploaded production logs.
 * Each becomes a permanent regression test, per the brief.
 *
 * IMPORTANT — how these tests stay global:
 *
 *   The FIXTURES are real (that is the point: no synthetic-only tests).
 *   The ASSERTIONS are invariants, never expected values for a specific person.
 *
 *   We never assert `name === "Haritha Vijayakumar"`. We assert
 *   `parser count === final count`, `headline is not a skill`,
 *   `name is not contaminated by the headline`, `no duplicate languages`.
 *
 *   Those hold for every resume on earth. A fixture proves the invariant was
 *   violated in production; the invariant is what the code must satisfy.
 *   Consequently these tests cannot be satisfied by special-casing a CV — the
 *   source scan at the bottom fails the suite if anyone tries.
 */
import fs from "fs";
import path from "path";
import type { ResumeProfile } from "@/lib/workzoResumeParser";
import { buildCanonicalResumeProfile, canonicalizeLanguages } from "@/lib/workzoCvCanonicalBuilder";
import { validateCanonicalProfile } from "@/lib/workzoCvValidator";

let passed = 0;
const failures: string[] = [];
function check(name: string, condition: boolean, detail = "") {
  if (condition) passed += 1;
  else failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

/** Minimal ResumeProfile factory. */
function profile(over: Partial<ResumeProfile> = {}): ResumeProfile {
  return {
    rawText: "", basics: { name: "", headline: "", email: "", phone: "", location: "", linkedin: "" },
    summary: "", experience: [], education: [], skills: [], projects: [], languages: [],
    certifications: [], strengths: [], additionalEvidence: [], warnings: [], previewText: "",
    ...over,
  } as ResumeProfile;
}

/** N distinct jobs — distinct so NOTHING may legally collapse them. */
function jobs(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    title: `Role ${i + 1}`, company: `Company ${i + 1}`, location: "",
    dates: `${2010 + i} - ${2011 + i}`, bullets: [`Did work ${i + 1}`],
  }));
}

/* ==========================================================================
 * PART 1 — COUNT PARITY
 * --------------------------------------------------------------------------
 * Observed in the logs: 11 of 13 CVs lost experience records between the
 * parser and the final profile. Only 1 of 13 had parser == final.
 * ======================================================================== */

// (parserExperience, finalExperience) exactly as logged.
const LOGGED_COUNTS: Array<{ case: string; parser: number; finalWas: number }> = [
  { case: "minimalist_two_column", parser: 7, finalWas: 4 },
  { case: "phone_named_file", parser: 6, finalWas: 5 },
  { case: "ats_executive", parser: 5, finalWas: 4 },
  { case: "canva_template", parser: 4, finalWas: 2 },
  { case: "social_skills_cv", parser: 6, finalWas: 6 },
  { case: "german_letterspaced", parser: 7, finalWas: 4 },
  { case: "cybersecurity_ats", parser: 4, finalWas: 4 },
  { case: "bootcamp_transition", parser: 6, finalWas: 5 },
  { case: "sidebar_customer_success", parser: 5, finalWas: 2 },
  { case: "sidebar_data_analyst", parser: 5, finalWas: 3 },
  { case: "sidebar_it_support", parser: 6, finalWas: 4 },
  { case: "letterspaced_support", parser: 6, finalWas: 2 },
  { case: "german_engineer", parser: 6, finalWas: 5 },
];

for (const entry of LOGGED_COUNTS) {
  const parsed = profile({ experience: jobs(entry.parser) });
  const { profile: built } = buildCanonicalResumeProfile({ parsed, rawText: "" });

  // THE core acceptance criterion: Parser Experience == Final Experience.
  check(
    `logs:${entry.case}:experience_parity`,
    built.experience.length === entry.parser,
    `parser=${entry.parser} final=${built.experience.length} (production shipped ${entry.finalWas})`,
  );

  // The validator must independently agree.
  const report = validateCanonicalProfile({ parsed, final: built });
  check(`logs:${entry.case}:validator_clean`, report.ok,
    report.violations.map((v) => v.rule).join(","));

  // And the validator MUST have caught the shipped behaviour.
  if (entry.finalWas < entry.parser) {
    const broken = profile({ experience: jobs(entry.finalWas) });
    const brokenReport = validateCanonicalProfile({ parsed, final: broken });
    check(
      `logs:${entry.case}:validator_catches_regression`,
      brokenReport.violations.some((v) => v.rule === "experience_count_decreased"),
      "validator failed to flag the production count drop",
    );
  }
}

/* ==========================================================================
 * PART 2 — HEADLINE PATHOLOGIES (each observed verbatim in the logs)
 * ======================================================================== */

// Logged: headline: 'Project Management' — while 'Project Management' is a skill.
{
  const parsed = profile({
    basics: { name: "A B", headline: "Project Management", email: "", phone: "", location: "", linkedin: "" },
    skills: ["Project Management", "Python"],
    experience: jobs(2),
  });
  const { profile: built } = buildCanonicalResumeProfile({ parsed, rawText: "A B\nProject Management\n" });
  check("logs:headline_is_skill:not_selected", built.basics.headline !== "Project Management",
    `got "${built.basics.headline}"`);

  const report = validateCanonicalProfile({
    parsed,
    final: profile({ basics: { ...parsed.basics }, skills: parsed.skills }),
  });
  check("logs:headline_is_skill:validator_catches",
    report.violations.some((v) => v.rule === "headline_is_skill"));
}

// Logged: headline: 'Ex-Technical support engineer and product specialist transitioning'
// — the first line of the summary.
{
  const summary = "Ex-Technical support engineer and product specialist transitioning into a Data Scientist role after completing a bootcamp.";
  const parsed = profile({
    basics: { name: "A B", headline: "Ex-Technical support engineer and product specialist transitioning", email: "", phone: "", location: "", linkedin: "" },
    summary, experience: jobs(2),
  });
  const { profile: built } = buildCanonicalResumeProfile({ parsed, rawText: "A B\n" });
  check("logs:headline_is_summary_fragment:not_selected",
    !built.basics.headline || !summary.includes(built.basics.headline),
    `got "${built.basics.headline}"`);

  const report = validateCanonicalProfile({
    parsed, final: profile({ basics: { ...parsed.basics }, summary }),
  });
  check("logs:headline_is_summary_fragment:validator_catches",
    report.violations.some((v) => v.rule === "headline_is_summary_fragment"));
}

// Logged: headline: 'Würzburg, Germany developing strong analytical and problem-solving skills. Adept at project'
{
  const bad = "Würzburg, Germany developing strong analytical and problem-solving skills. Adept at project";
  const parsed = profile({
    basics: { name: "A B", headline: bad, email: "", phone: "", location: "", linkedin: "" },
    experience: jobs(2),
  });
  const { profile: built } = buildCanonicalResumeProfile({ parsed, rawText: "A B\n" });
  check("logs:headline_address_prose:not_selected", built.basics.headline !== bad,
    `got "${built.basics.headline}"`);

  const report = validateCanonicalProfile({ parsed, final: profile({ basics: { ...parsed.basics } }) });
  check("logs:headline_address_prose:validator_catches",
    report.violations.some((v) => v.rule === "headline_is_prose" || v.rule === "headline_contains_address"));
}

// Logged: selectedHeadline: 'Manager' from a letter-spaced
// "J U N I O R  C U S T O M E R  S U C C E S S  M A N A G E R" header.
{
  const rawText = "H A R I T H A  V I J A Y A K U M A R\nJ U N I O R  C U S T O M E R  S U C C E S S  M A N A G E R\n";
  const final = profile({
    basics: { name: "A B", headline: "Manager", email: "", phone: "", location: "", linkedin: "" },
    rawText,
  });
  const report = validateCanonicalProfile({ parsed: profile(), final, rawText });
  check("logs:headline_truncated_fragment:validator_catches",
    report.violations.some((v) => v.rule === "headline_is_header_fragment"),
    report.violations.map((v) => v.rule).join(",") || "no violations");
}

/* ==========================================================================
 * PART 3 — NAME CONTAMINATION
 * Logged: name: 'Harithavijayakumar Itsupport' from a letter-spaced sidebar
 * where the header "I T  S U P P O R T  S P E C I A L I S T" bled into the name.
 * ======================================================================== */
{
  const final = profile({
    basics: {
      name: "Harithavijayakumar Itsupport",
      headline: "IT Support Specialist",
      email: "", phone: "", location: "", linkedin: "",
    },
  });
  const report = validateCanonicalProfile({ parsed: profile(), final });
  check("logs:name_contaminated_by_headline:validator_catches",
    report.violations.some((v) => v.rule === "name_contaminated_by_headline"),
    report.violations.map((v) => v.rule).join(",") || "no violations");

  // A legitimate name that merely shares a first letter must NOT be flagged.
  const clean = profile({
    basics: { name: "Ian Turner", headline: "IT Support Specialist", email: "", phone: "", location: "", linkedin: "" },
  });
  const cleanReport = validateCanonicalProfile({ parsed: profile(), final: clean });
  check("logs:name_contamination:no_false_positive",
    !cleanReport.violations.some((v) => v.rule === "name_contaminated_by_headline"),
    cleanReport.violations.map((v) => v.rule).join(","));
}

/* ==========================================================================
 * PART 4 — LANGUAGES (both failure directions were logged)
 * ======================================================================== */

// Logged: ['English - FLUENT','German - CONVERSATIONAL','German (Conversational)'] -> dupes.
{
  const out = canonicalizeLanguages(["English - FLUENT", "German - CONVERSATIONAL", "German (Conversational)"]);
  check("logs:languages_dupe_variants:merged", out.length === 2, `got ${out.length}: ${out.join(", ")}`);
  check("logs:languages_dupe_variants:canonical_format", out[0] === "English (Fluent)", `got "${out[0]}"`);
}

// Logged: ['English - FLUENT','German - Conversational','English: Fluent','German: Conversational','German - B1'] (5) -> 2
{
  const out = canonicalizeLanguages([
    "English - FLUENT", "German - Conversational", "English: Fluent", "German: Conversational", "German - B1",
  ]);
  check("logs:languages_five_variants:two_languages", out.length === 2, `got ${out.length}: ${out.join(", ")}`);
  check("logs:languages_five_variants:first_level_wins", out[0] === "English (Fluent)", `got "${out[0]}"`);
}

// Logged: ['English: Fluent C1','German: Intermediate B1','English - Fluent','German - Intermediate'] -> 2
{
  const out = canonicalizeLanguages(["English: Fluent C1", "German: Intermediate B1", "English - Fluent", "German - Intermediate"]);
  check("logs:languages_cefr_variants:two_languages", out.length === 2, `got ${out.length}: ${out.join(", ")}`);
}

// Logged: endonym normalization 'Deutsch - B2' -> 'German - B2'.
{
  const out = canonicalizeLanguages(["Deutsch - B2", "English - C1"]);
  check("logs:languages_endonym:german", out[0] === "German (B2)", `got "${out[0]}"`);
  check("logs:languages_endonym:cefr_upper", out[1] === "English (C1)", `got "${out[1]}"`);
}

// Logged: a single string holding THREE languages became one entry.
{
  const out = canonicalizeLanguages([
    "English (Fluent) - German (Intermediate) - Spanish (Native)",
    "German - Intermediate", "Spanish - Native", "English - Fluent",
  ]);
  check("logs:languages_packed_string:split_to_three", out.length === 3, `got ${out.length}: ${out.join(", ")}`);
}

// Logged: languages 3 -> 1. English and Turkish were silently destroyed.
{
  const parsed = profile({ languages: ["English - B4", "Turkish - B4 and presentable", "Arabic - NATIVE"] });
  const { profile: built } = buildCanonicalResumeProfile({ parsed, rawText: "" });
  check("logs:languages_dropped:all_survive", built.languages.length === 3,
    `got ${built.languages.length}: ${built.languages.join(", ")}`);

  const broken = profile({ languages: ["Arabic - NATIVE"] });
  const report = validateCanonicalProfile({ parsed, final: broken });
  check("logs:languages_dropped:validator_catches",
    report.violations.some((v) => v.rule === "languages_dropped"));
}

/* ==========================================================================
 * PART 5 — SUMMARY IS NEVER REWRITTEN
 * ======================================================================== */
{
  const summary = "Detail-oriented IT Support Specialist with over four years of experience.";
  const parsed = profile({ summary });
  const { profile: built } = buildCanonicalResumeProfile({ parsed, rawText: "" });
  check("logs:summary_verbatim", built.summary === summary, `got "${built.summary}"`);

  const report = validateCanonicalProfile({ parsed, final: profile({ summary: "A shorter AI summary." }) });
  check("logs:summary_rewrite:validator_catches",
    report.violations.some((v) => v.rule === "summary_rewritten"));
}

/* ==========================================================================
 * PART 6 — ZERO SAMPLE-SPECIFIC RULES IN SHIPPED CODE
 * --------------------------------------------------------------------------
 * The fixtures above are real. The CODE must contain nothing that knows about
 * them. This scan fails the suite if anyone "fixes" a case by special-casing it.
 * ======================================================================== */
{
  const SHIPPED = ["lib/workzoCvCanonicalBuilder.ts", "lib/workzoCvValidator.ts"];
  // Person/company/file tokens that appear in the production logs. If any of
  // these ever appears in shipped code, the fix was sample-specific.
  const FORBIDDEN_TOKENS = [
    "haritha", "vijayakumar", "surender", "dillibabu", "khaled", "alkanj",
    "sophia", "martinez", "daniel", "foster", "zoho", "wurzburg", "zweierweg",
    ".pdf", "abu-abu", "csm-deu", "itsd", "novoresume",
  ];

  for (const file of SHIPPED) {
    const src = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    // Strip comments — prose may legitimately cite a log line for provenance.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const lower = code.toLowerCase();

    for (const token of FORBIDDEN_TOKENS) {
      check(`purity:${file}:no_token_${token}`, !lower.includes(token),
        `shipped code references "${token}"`);
    }
    check(`purity:${file}:no_filename_branching`,
      !/fileName\s*(===|==|\.includes|\.startsWith|\.endsWith|\.match|\.test)/.test(code));
    check(`purity:${file}:no_fuzzy_merge`,
      !/(levenshtein|jaro|similarity|fuzzy|cosine|distance\()/i.test(code));
    check(`purity:${file}:no_confidence_merge`, !/confidence\s*[<>]/.test(code));
    check(`purity:${file}:no_ai_retry`, !/(fetch\(|openrouter|retry|attempt\s*<)/i.test(code));
    check(`purity:${file}:no_random`, !/Math\.random/.test(code));
  }
}

/* ========================================================================== */

const total = passed + failures.length;
console.log("=".repeat(66));
console.log(`PRODUCTION LOG REGRESSION: ${passed}/${total} = ${((passed / total) * 100).toFixed(1)}%`);
if (failures.length) {
  console.log(`\nFAILURES (${failures.length}):`);
  for (const f of failures) console.log(`  \u2717 ${f}`);
}
console.log("=".repeat(66));
process.exit(failures.length ? 1 : 0);
