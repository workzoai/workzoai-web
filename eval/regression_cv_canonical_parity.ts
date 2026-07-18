/**
 * Regression: Canonical Builder parity + architectural invariants.
 *
 *   npx tsx eval/regression_cv_canonical_parity.ts
 *
 * Asserts the acceptance criteria directly — Parser == Final for Experience,
 * Education, Projects, Languages — plus the guarantees that make that true by
 * construction: purity, immutability, exact-only dedupe, no fuzzy merging.
 */
import fs from "fs";
import path from "path";
import { extractResumeProfileComplex, type ResumeProfile } from "@/lib/workzoResumeParser";
import {
  buildCanonicalResumeProfile,
  canonicalizeExperience,
  canonicalizeEducation,
  canonicalizeLanguages,
  normalizeDateBoundary,
  splitDateRange,
  resolveHeadline,
} from "@/lib/workzoCvCanonicalBuilder";
import { validateCanonicalProfile } from "@/lib/workzoCvValidator";

let passed = 0;
const failures: string[] = [];
function check(name: string, condition: boolean, detail = "") {
  if (condition) passed += 1;
  else failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const job = (over: Record<string, unknown> = {}) => ({
  title: "Engineer", company: "Acme", location: "",
  dates: "Jan 2020 - Dec 2021", bullets: ["Did a thing"], ...over,
}) as ResumeProfile["experience"][0];

/* === 1. Dates ========================================================== */
check("date:iso", normalizeDateBoundary("2020-03") === "2020-03");
check("date:word_en", normalizeDateBoundary("Jan 2020") === "2020-01");
check("date:word_de", normalizeDateBoundary("Januar 2020") === "2020-01");
check("date:word_fr", normalizeDateBoundary("Mars 2020") === "2020-03");
check("date:numeric", normalizeDateBoundary("03/2021") === "2021-03");
check("date:bare_year", normalizeDateBoundary("2019") === "2019");
check("date:present", normalizeDateBoundary("Present") === "present");
check("date:present_de", normalizeDateBoundary("heute") === "present");
check("date:garbage_empty", normalizeDateBoundary("???") === "");
check("range:endash", splitDateRange("Jan 2020 \u2013 Mar 2022").end === "2022-03");
check("range:to", splitDateRange("Jan 2020 to Mar 2022").start === "2020-01");
check("range:bis", splitDateRange("Januar 2020 bis heute").end === "present");

/* === 2. Experience immutability ======================================== */
check("exp:exact_duplicate_collapses", canonicalizeExperience([job(), job()]).length === 1);
check("exp:promotion_never_merges",
  canonicalizeExperience([job({ title: "Senior Engineer", dates: "Jan 2022 - Present" }), job()]).length === 2);
check("exp:different_dates_never_merge",
  canonicalizeExperience([job({ dates: "Jan 2020 - Dec 2021" }), job({ dates: "Jan 2023 - Present" })]).length === 2);

// Chosen so ANY normalizing merge trick (suffix stripping, punctuation
// stripping, prefix match, token overlap) collapses them and fails the check.
check("exp:legal_suffix_never_stripped_to_merge",
  canonicalizeExperience([job({ company: "Acme GmbH" }), job({ company: "Acme" })]).length === 2);
check("exp:punctuation_never_stripped_to_merge",
  canonicalizeExperience([job({ company: "Acme Ltd" }), job({ company: "Acme Ltd." })]).length === 2);
check("exp:prefix_company_never_merges",
  canonicalizeExperience([job({ company: "Acme" }), job({ company: "Acme Digital" })]).length === 2);
check("exp:similar_title_never_merges",
  canonicalizeExperience([job({ title: "Engineer" }), job({ title: "Engineer II" })]).length === 2);
check("exp:overlapping_dates_never_merge",
  canonicalizeExperience([job({ company: "A", dates: "Jan 2020 - Dec 2022" }), job({ company: "B", dates: "Jun 2021 - Present" })]).length === 2);
check("exp:sparse_record_kept",
  canonicalizeExperience([job(), { title: "Volunteer Lead", company: "", location: "", dates: "", bullets: [] }]).length === 2);
check("exp:unreadable_dates_stay_separate",
  canonicalizeExperience([job({ dates: "sometime" }), job({ dates: "whenever" })]).length === 2);
check("exp:order_preserved",
  canonicalizeExperience([job({ company: "First" }), job({ company: "Second" })])[0].company === "First");
check("exp:whitespace_case_is_exact_dup",
  canonicalizeExperience([job(), job({ company: "  ACME  " })]).length === 1);
check("exp:bullets_preserved", canonicalizeExperience([job({ bullets: ["A  b", " C "] })])[0].bullets.length === 2);

/* === 3. Education ====================================================== */
{
  const ed = (o = {}) => ({ degree: "BSc CS", institution: "TU Munich", location: "", dates: "2015 - 2018", ...o });
  check("edu:exact_duplicate_collapses", canonicalizeEducation([ed(), ed()]).length === 1);
  check("edu:different_degree_separate", canonicalizeEducation([ed(), ed({ degree: "MSc CS" })]).length === 2);
  check("edu:different_institution_separate", canonicalizeEducation([ed(), ed({ institution: "LMU" })]).length === 2);
  check("edu:never_inferred", canonicalizeEducation([]).length === 0);
  check("edu:order_preserved",
    canonicalizeEducation([ed({ institution: "A" }), ed({ institution: "B" })])[0].institution === "A");
}

/* === 4. Languages ====================================================== */
{
  const out = canonicalizeLanguages(["English - Fluent", "english (fluent)", "German: B2", "Tamil (Native)", " English "]);
  check("lang:variants_merge", out.length === 3, `got ${out.join(", ")}`);
  check("lang:canonical_format", out[0] === "English (Fluent)", `got "${out[0]}"`);
  check("lang:cefr_upper", out[1] === "German (B2)", `got "${out[1]}"`);
  check("lang:bare_name_kept", canonicalizeLanguages(["Spanish"])[0] === "Spanish");
  // A level containing a space must not be mistaken for a second language.
  check("lang:multiword_level_kept",
    canonicalizeLanguages(["Turkish - B4 and presentable"]).length === 1);
}

/* === 5. Headline ladder ================================================ */
{
  const forbidden = new Set(["summary", "skills", "profile", "objective", "education"]);
  check("headline:prefers_header_below_name",
    resolveHeadline({ headerBelowName: "Data Scientist", explicitTitle: "Analyst", forbidden }).source === "header_below_name");
  check("headline:falls_to_explicit_title",
    resolveHeadline({ explicitTitle: "Analyst", forbidden }).source === "explicit_title");
  check("headline:falls_to_linkedin",
    resolveHeadline({ linkedinHeadline: "Nurse", forbidden }).source === "linkedin_headline");
  check("headline:falls_to_parser",
    resolveHeadline({ parserHeadline: "Welder", forbidden }).source === "parser");
  check("headline:blank_when_nothing", resolveHeadline({ forbidden }).source === "blank");
  check("headline:rejects_section_name",
    resolveHeadline({ headerBelowName: "Summary", explicitTitle: "Analyst", forbidden }).headline === "Analyst");
  check("headline:rejects_prose",
    resolveHeadline({ headerBelowName: "Experienced professional delivering value.", explicitTitle: "Analyst", forbidden }).headline === "Analyst");
  check("headline:rejects_address",
    resolveHeadline({ headerBelowName: "Zweierweg 15, 97094", explicitTitle: "Analyst", forbidden }).headline === "Analyst");
}

/* === 6. Purity + immutability ========================================== */
{
  const parsed = {
    rawText: "Jane Doe\nData Scientist\n",
    basics: { name: "Jane Doe", headline: "", email: "", phone: "", location: "", linkedin: "" },
    // Five DISTINCT jobs: enough that any silent truncation is detectable, and
    // distinct enough that nothing may legally collapse them.
    summary: "Summary text",
    experience: [
      job(), job({ company: "Beta", title: "Lead" }), job({ company: "Gamma", title: "Principal" }),
      job({ company: "Delta", title: "Director" }), job({ company: "Epsilon", title: "VP" }),
    ],
    education: [], skills: ["Python"], projects: [], languages: [],
    certifications: [], strengths: [], additionalEvidence: [], warnings: [], previewText: "",
  } as ResumeProfile;

  const snapshot = JSON.stringify(parsed);
  const { profile } = buildCanonicalResumeProfile({ parsed, rawText: parsed.rawText });

  check("builder:is_pure", JSON.stringify(parsed) === snapshot, "builder mutated its input");
  check("builder:result_frozen", Object.isFrozen(profile));
  check("builder:experience_frozen", Object.isFrozen(profile.experience));
  check("builder:experience_item_frozen", Object.isFrozen(profile.experience[0]));

  try { (profile as any).experience = []; } catch { /* strict mode throws */ }
  check("builder:no_records_lost", profile.experience.length === 5,
    `expected 5 distinct jobs, got ${profile.experience.length}`);
  check("builder:downstream_cannot_overwrite", profile.experience.length === 5,
    `overwrite succeeded, got ${profile.experience.length}`);
  try { (profile.experience as any).push(job()); } catch { /* frozen */ }
  check("builder:downstream_cannot_append", profile.experience.length === 5);
  check("builder:summary_never_rewritten", profile.summary === "Summary text");
}

/* === 7. Parity across every real CV in eval/cvs/ ======================== */
{
  const here = typeof __dirname !== "undefined" ? __dirname : process.cwd();
  const dir = [path.join(here, "cvs"), path.join(process.cwd(), "eval", "cvs")].find((c) => fs.existsSync(c));
  const files = dir ? fs.readdirSync(dir).filter((f) => /\.txt$/i.test(f)) : [];
  check("parity:fixtures_present", files.length > 0, "no CVs in eval/cvs/");

  for (const file of files) {
    const text = fs.readFileSync(path.join(dir!, file), "utf8");
    const parsed = extractResumeProfileComplex(text);
    // Expected counts are computed BEFORE the build. If the builder mutates its
    // input, comparing afterwards would move both sides together and the bug
    // would pass unnoticed.
    const before = JSON.stringify(parsed);
    const expectedExp = canonicalizeExperience(parsed.experience).length;
    const expectedEdu = canonicalizeEducation(parsed.education).length;
    const rawExpCount = Array.isArray(parsed.experience) ? parsed.experience.length : 0;

    const { profile } = buildCanonicalResumeProfile({ parsed, rawText: text, fileName: file });

    check(`parity:${file}:builder_pure`, JSON.stringify(parsed) === before);
    check(`parity:${file}:parser_array_untouched`,
      (Array.isArray(parsed.experience) ? parsed.experience.length : 0) === rawExpCount,
      "builder shrank the parser's own experience array");
    check(`parity:${file}:experience`, profile.experience.length === expectedExp,
      `expected=${expectedExp} got=${profile.experience.length}`);
    check(`parity:${file}:education`, profile.education.length === expectedEdu);
    check(`parity:${file}:frozen`, Object.isFrozen(profile));

    // The validator must agree the build is clean on every real CV.
    const report = validateCanonicalProfile({ parsed, final: profile, rawText: text });
    const errors = report.violations.filter((v) => v.severity === "error");
    check(`parity:${file}:validator_no_errors`, errors.length === 0,
      errors.map((v) => v.rule).join(","));
  }
}

/* ======================================================================= */
const total = passed + failures.length;
console.log("=".repeat(66));
console.log(`CV CANONICAL PARITY: ${passed}/${total} = ${((passed / total) * 100).toFixed(1)}%`);
if (failures.length) {
  console.log(`\nFAILURES (${failures.length}):`);
  for (const f of failures) console.log(`  \u2717 ${f}`);
}
console.log("=".repeat(66));
process.exit(failures.length ? 1 : 0);
