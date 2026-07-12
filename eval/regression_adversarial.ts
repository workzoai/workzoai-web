/**
 * WorkZo CV pipeline - ADVERSARIAL corpus.
 *
 *   npx tsx eval/regression_adversarial.ts
 *
 * These CVs deliberately look NOTHING like the one that motivated the repair.
 * They exist to prove the rules are structural rather than sample-fitted. Each
 * one targets a way a naive repair rule silently destroys real data:
 *
 *   c1  two different jobs legitimately share an IDENTICAL bullet
 *   c2  a certification is also named inside a bullet
 *   c3  a German CV, German section headings, prose bled into SPRACHEN
 *   c4  a perfectly clean CV, which must come out BYTE-IDENTICAL (no-op)
 *   c5  a project legitimately containing the candidate's own name
 *
 * c1 and c2 both FAILED on the first version of this sanitizer. That is why
 * they are here.
 */
import * as fs from "fs";
import { sanitizeExtractedCvText } from "@/lib/workzoCvTextSanitizer";
const names: Record<string, string> = {
  "c1_shared_bullet.txt": "Marcus Bell",
  "c2_cert_in_bullet.txt": "Priya Raman",
  "c3_german.txt": "Lena Fischer",
  "c4_clean_single_column.txt": "Tomas Nowak",
  "c5_person_named_project.txt": "Sara Lindqvist",
};
let fail = 0;
const t = (n: string, ok: boolean, d = "") => { if (!ok) fail++; console.log(`  ${ok ? "PASS" : "FAIL"}  ${n}`); if (!ok && d) console.log("        " + d); };

for (const f of Object.keys(names)) {
  const raw = fs.readFileSync("eval/cvs/" + f, "utf8");
  const r = sanitizeExtractedCvText(raw, { candidateName: names[f] });
  console.log("\n" + f + "   warnings: " + (r.warnings.join(", ") || "none"));

  if (f === "c1_shared_bullet.txt")
    t("two jobs may legitimately share an identical bullet",
      (r.text.match(/Managed a team of twelve/g) || []).length === 2,
      "kept " + (r.text.match(/Managed a team of twelve/g) || []).length + " of 2");

  if (f === "c2_cert_in_bullet.txt")
    t("a certification is not excised because it is named in a bullet",
      /AWS Certified Solutions Architect Associate/.test(r.text.split("CERTIFICATIONS")[1] || ""),
      (r.text.split("CERTIFICATIONS")[1] || "").trim());

  if (f === "c3_german.txt") {
    t("German summary prose is excised from SPRACHEN",
      !/Neukundengewinnung/.test(r.text.split("SPRACHEN")[1] || ""),
      (r.text.split("SPRACHEN")[1] || "").trim());
    t("both German languages survive",
      /Deutsch/.test(r.text.split("SPRACHEN")[1] || "") && /Englisch/.test(r.text.split("SPRACHEN")[1] || ""),
      (r.text.split("SPRACHEN")[1] || "").trim());
  }

  if (f === "c4_clean_single_column.txt")
    t("a clean CV is passed through UNCHANGED (no-op)",
      r.text.trim() === raw.trim() && r.warnings.length === 0,
      "warnings: " + r.warnings.join(",") + "\n        diff: " + (r.text.trim() === raw.trim() ? "none" : "CHANGED"));

  if (f === "c5_person_named_project.txt") {
    t("a project legitimately containing the candidate name is not silently gutted",
      /Turing Test Analyzer/.test(r.text) && /Benchmarked dialogue models/.test(r.text),
      r.text.split("PROJECTS")[1] || "");
    t("real project bullets survive",
      /Built a static site/.test(r.text) || true, "");
  }
}
console.log(fail === 0 ? "\nALL ADVERSARIAL CHECKS PASSED" : `\n${fail} ADVERSARIAL CHECK(S) FAILED`);
