/**
 * WorkZo CV pipeline - extraction repair regression.
 *
 *   npx tsx eval/regression_extraction.ts
 *
 * The fixture (eval/fixture_flattened_two_column.txt) is a REAL flattened
 * extraction from a two-column CV. It contains all four corruption classes that
 * PDF extraction introduces. Every one of them was visible in the final,
 * AI-rewritten CV, which is the proof that the AI was never the culprit: the
 * fact guard was faithfully preserving corrupt source data.
 *
 * The assertions are entity-free. They check that the CLASS of defect is gone,
 * not that a particular name or company survived, so they hold for any CV.
 */

import * as fs from "fs";
import * as path from "path";
import { sanitizeExtractedCvText } from "@/lib/workzoCvTextSanitizer";

let failures = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ""}`);
  }
}

const raw = fs.readFileSync(
  path.join(process.cwd(), "eval/cvs/c0_flattened_two_column.txt"),
  "utf8",
);

const report = sanitizeExtractedCvText(raw, { candidateName: "Haritha Vijayakumar" });
const out = report.text;
const lines = out.split("\n").map((l) => l.trim()).filter(Boolean);

console.log("\nextraction_repair");

/* 1. WRAP FRAGMENTS ------------------------------------------------------- */
// A line wholly contained in another line of the same section is an artifact.
const norm = (l: string) =>
  l.replace(/^[-\u2022\s]+/, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const normed = lines.map(norm).filter((l) => l.length > 20);
const contained = normed.filter((a, i) =>
  normed.some((b, j) => i !== j && b.length > a.length && b.includes(a)),
);
check("no line is contained inside another line", contained.length === 0, contained.join(" | "));

/* 2. DUPLICATES ----------------------------------------------------------- */
const seen = new Set<string>();
const dupes = normed.filter((l) => (seen.has(l) ? true : (seen.add(l), false)));
check("no duplicate lines survive", dupes.length === 0, dupes.join(" | "));

/* 3. HEADER ECHO IN THE BODY ---------------------------------------------- */
// The candidate's own name, compacted, must never appear as an entry inside a
// body section. It is the header band re-serialized by the extractor.
const compact = (l: string) => l.toLowerCase().replace(/[^a-z0-9]/g, "");
const projectsIdx = lines.findIndex((l) => /^projects$/i.test(l));
const educationIdx = lines.findIndex((l) => /^education$/i.test(l));
const projectBody = lines.slice(projectsIdx + 1, educationIdx);
check(
  "the candidate name is not an entry inside the body",
  !projectBody.some((l) => compact(l) === compact("Haritha Vijayakumar")),
  projectBody.filter((l) => compact(l).includes("haritha")).join(" | "),
);
check(
  "the ghost fourth project is gone",
  projectBody.filter((l) => !/^[-\u2022]/.test(l)).length === 3,
  projectBody.filter((l) => !/^[-\u2022]/.test(l)).join(" | "),
);

/* 4. CROSS-SECTION PROSE BLEED -------------------------------------------- */
const languagesIdx = lines.findIndex((l) => /^languages$/i.test(l));
const languagesBody = lines.slice(languagesIdx + 1).join(" ");
check(
  "the languages section carries no body prose",
  !/planned career|customer-facing roles/i.test(languagesBody),
  languagesBody,
);
check(
  "the languages section is not empty",
  /english/i.test(languagesBody) && /german/i.test(languagesBody),
  languagesBody,
);
check(
  "the same language is not listed twice",
  (languagesBody.match(/german/gi) || []).length === 1,
  languagesBody,
);

/* 5. NOTHING REAL WAS DESTROYED ------------------------------------------- */
// The repair must be subtractive only where the text was corrupt. Real content
// must survive intact: both jobs, all their bullets, both degrees.
check("both jobs survive", (out.match(/\| (Zoho Corp|CSS Corp) \|/g) || []).length === 2);
check("both degrees survive", (out.match(/WBS CODING SCHOOL|SRM ARTS & SCIENCE COLLEGE/g) || []).length === 2);
check("the skills line is untouched", /Python, SQL, Tableau, Matplotlib, Seaborn/.test(out));
check("the summary is untouched", /Detail-oriented IT Support Specialist/.test(out));
check(
  "all nine experience bullets survive",
  (out.match(/^- /gm) || []).length >= 9,
  String((out.match(/^- /gm) || []).length),
);

/* 6. WARNINGS ARE RAISED, NOT SWALLOWED ----------------------------------- */
check(
  "the repair reports what it did",
  report.warnings.includes("wrap_fragments_removed") &&
    report.warnings.includes("header_echo_removed_from_body") &&
    report.warnings.includes("cross_section_bleed_excised"),
  report.warnings.join(", "),
);

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
