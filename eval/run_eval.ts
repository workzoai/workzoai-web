/**
 * WorkZo CV pipeline eval harness.
 *
 * Runs every fixture (built-in + your own CVs in eval/cvs/) through the REAL
 * pipeline: parser -> identity -> canonical -> guard/repair -> render, then
 * applies generic invariants (checks.ts). Prints a per-CV and aggregate pass
 * rate, and exits non-zero if anything fails (usable in CI).
 *
 *   npx tsx eval/run_eval.ts
 *
 * Add your own CVs:
 *   eval/cvs/<anything>.txt   -> raw CV text (parser + identity + render)
 *   eval/cvs/<anything>.json  -> a structured ResumeProfile (guard + render)
 * Optionally add expectations by placing <name>.expect.json next to a CV, e.g.
 *   { "name": "Jane Doe", "minExperience": 2, "everyJobHasBullets": true,
 *     "minEducation": 1, "skills": ["TensorFlow"], "role": "Engineer" }
 */
import fs from "fs";
import path from "path";
import {
  extractResumeProfile,
  determineCanonicalIdentity,
  buildCanonicalProfile,
  repairParsedResume,
  buildResumeJson,
} from "./pipeline";
import { runChecks, type Fixture, type PipeResult, type CheckResult } from "./checks";
import { FIXTURES } from "./fixtures";

function findCvsDir(): string {
  const here = typeof __dirname !== "undefined" ? __dirname : process.cwd();
  const candidates = [path.join(here, "cvs"), path.join(process.cwd(), "eval", "cvs"), path.join(process.cwd(), "cvs")];
  return candidates.find((c) => fs.existsSync(c)) || candidates[0];
}

function loadExternal(): Fixture[] {
  const dir = findCvsDir();
  const out: Fixture[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    if (file.endsWith(".expect.json")) continue;
    let expect: Fixture["expect"] & { role?: string; jd?: string } = {};
    const expectPath = full.replace(/\.(txt|json)$/i, ".expect.json");
    if (fs.existsSync(expectPath)) {
      try { expect = JSON.parse(fs.readFileSync(expectPath, "utf8")); } catch { /* ignore */ }
    }
    if (/\.txt$/i.test(file)) {
      out.push({ name: `cvs/${file}`, kind: "text", text: fs.readFileSync(full, "utf8"), role: expect.role, jd: expect.jd, expect });
    } else if (/\.json$/i.test(file)) {
      try {
        const profile = JSON.parse(fs.readFileSync(full, "utf8"));
        out.push({ name: `cvs/${file}`, kind: "profile", profile, role: expect.role, jd: expect.jd, expect });
      } catch { /* ignore malformed */ }
    }
  }
  return out;
}

function runOne(f: Fixture): PipeResult {
  const jd = f.jd || "";
  const role = f.role || "";
  if (f.kind === "text") {
    const text = f.text || "";
    const parse = extractResumeProfile(text);
    const identity = determineCanonicalIdentity({
      // Production feeds the AI-structurer's name here (not the text parser's).
      // Simulate that with the fixture's expected name when provided.
      aiName: f.expect?.name || parse.basics?.name,
      rawText: text,
      fileName: `${f.expect?.name || "cv"}.pdf`,
      email: parse.basics?.email,
    });
    const canonical = buildCanonicalProfile({ profile: parse, rawText: text, fileName: "cv.pdf" });
    const base = repairParsedResume(canonical || parse, text);
    const render = buildResumeJson({ cvText: "", resumeProfile: base, jobDescription: jd, targetRole: role, targetMarket: "global", template: "ats" });
    return { fixture: f, parse, identity, canonical, render };
  }
  const base = repairParsedResume(f.profile, f.profile?.rawText || "");
  const render = buildResumeJson({ cvText: "", resumeProfile: base, jobDescription: jd, targetRole: role, targetMarket: "global", template: "ats" });
  return { fixture: f, canonical: base, render };
}

function main() {
  const fixtures = [...FIXTURES, ...loadExternal()];
  let totalPass = 0, totalFail = 0, totalSkip = 0;
  const byMode: Record<string, { pass: number; fail: number }> = { text: { pass: 0, fail: 0 }, profile: { pass: 0, fail: 0 } };
  const failedFixtures: string[] = [];

  for (const f of fixtures) {
    let result: PipeResult;
    try {
      result = runOne(f);
    } catch (e: any) {
      console.log(`\n■ ${f.name}\n   THREW: ${e?.message || e}`);
      totalFail++; failedFixtures.push(f.name);
      continue;
    }
    const checks: CheckResult[] = runChecks(result);
    const fails = checks.filter((c) => c.status === "fail");
    const passes = checks.filter((c) => c.status === "pass");
    const skips = checks.filter((c) => c.status === "skip");
    totalPass += passes.length; totalFail += fails.length; totalSkip += skips.length;
    byMode[f.kind].pass += passes.length; byMode[f.kind].fail += fails.length;

    const mark = fails.length ? "✗" : "✓";
    console.log(`\n${mark} ${f.name}   [${passes.length} pass, ${fails.length} fail, ${skips.length} skip]`);
    for (const c of fails) console.log(`   ✗ ${c.id}: ${c.detail}`);
    if (fails.length) failedFixtures.push(f.name);
  }

  const totalChecks = totalPass + totalFail;
  const rate = totalChecks ? ((totalPass / totalChecks) * 100).toFixed(1) : "n/a";
  console.log("\n" + "=".repeat(60));
  console.log(`FIXTURES: ${fixtures.length}   CHECKS: ${totalChecks} (+${totalSkip} skipped)`);
  console.log(`PASS RATE: ${totalPass}/${totalChecks} = ${rate}%`);
  for (const [mode, m] of Object.entries(byMode)) {
    const t = m.pass + m.fail;
    if (t) console.log(`   ${mode}-mode (${mode === "profile" ? "primary path: AI profile -> guard -> render" : "text-parser fallback"}): ${m.pass}/${t} = ${((m.pass / t) * 100).toFixed(1)}%`);
  }
  if (failedFixtures.length) console.log(`FAILING FIXTURES: ${Array.from(new Set(failedFixtures)).join(", ")}`);
  console.log("=".repeat(60));

  process.exit(totalFail ? 1 : 0);
}

main();
