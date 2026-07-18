/*
 * eval/regression_smart_apply.ts
 *
 * The tests the spec's section 25 asks for, focused on the failures that a naive
 * matcher makes and that a real corpus catches:
 *
 *   - criticality read from LANGUAGE, not position
 *   - "missing" vs "not verifiable" kept distinct
 *   - a genuinely qualified candidate not told they lack their own credential
 *   - "Java" not proven by "JavaScript"
 *   - one missing requirement penalised once, not twice
 *   - the evidence gate blocking unsupported claims from documents
 *
 * Run: npx tsx eval/regression_smart_apply.ts
 */

import { rankJob } from "@/lib/jobs/ranking";
import { extractStructuredRequirements } from "@/lib/jobs/requirementExtractor";
import { matchRequirementsAgainstCv } from "@/lib/jobs/evidenceMatcher";
import { assessEvidence, findUnsupportedClaims } from "@/lib/smart-apply/validateEvidence";
import { tailorCvForJob } from "@/lib/smart-apply/tailorCv";
import { generateCoverLetter } from "@/lib/smart-apply/generateCoverLetter";
import type { CandidateContext, WorkZoJob } from "@/lib/jobs/types";
import type { ResumeProfile } from "@/lib/workzoResumeParser";

let failures = 0;
function check(label: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond ? "" : `\n        ${detail}`}`);
  if (!cond) failures++;
}

function job(over: Partial<WorkZoJob>): WorkZoJob {
  return {
    id: "j", provider: "adzuna", title: "Role", company: "Co", location: "Berlin, Germany",
    description: "", applyUrl: "https://example.com", remoteType: "onsite", skills: [],
    fetchedAt: new Date().toISOString(), sourceReference: "x", ...over,
  };
}
function profile(over: Partial<ResumeProfile>): ResumeProfile {
  return {
    rawText: "", basics: { name: "Test User", headline: "", email: "", phone: "", location: "Berlin", linkedin: "" },
    summary: "", experience: [], education: [], skills: [], projects: [], languages: [],
    certifications: [], strengths: [], additionalEvidence: [], warnings: [], previewText: "", ...over,
  };
}
const ctx = (over: Partial<CandidateContext> = {}): CandidateContext => ({ skills: [], ...over });

/* ── 1. Criticality is language, not position ─────────────────────────────── */
console.log("\nhonesty_guard_empty_jd");
{
  // The bug from live testing: an empty JD produced "91, Strong match, Confidence 0%".
  // A job we could not read must never present as a confident match.
  const emptyJob = job({ title: "Technical Support Analyst", company: "Some Board", description: "" });
  const cv = profile({
    basics: { name: "N", headline: "Technical Support Analyst", email: "n@x.com", phone: "1", location: "Remote", linkedin: "" },
    skills: ["Troubleshooting", "SQL"],
    experience: [{ title: "Support Analyst", company: "X", location: "Remote", dates: "2020 - Present", bullets: ["Resolved 95% of tickets within SLA"] }],
  });
  const m = rankJob(emptyJob, ctx({ role: "Technical Support Analyst", skills: ["Troubleshooting", "SQL"] }), cv);
  check("empty JD does not score as strong match", m.score <= 55, `score ${m.score}`);
  check("empty JD recommendation is low_match", m.recommendation === "low_match", m.recommendation);
  check("empty JD confidence is near zero", m.confidence < 0.3, `conf ${m.confidence}`);
}

/* ── 2. Criticality is language, not position ─────────────────────────────── */
console.log("\ncriticality_from_language_not_position");
{
  const reqs = extractStructuredRequirements(
    `Nice to have:\n- Kubernetes is a plus\nRequirements:\n- Python is required\n- You must hold a nursing licence\n`,
    20,
  );
  const k = reqs.find((r) => /kubernetes/i.test(r.requirement));
  const p = reqs.find((r) => /python/i.test(r.requirement));
  const lic = reqs.find((r) => /licence/i.test(r.requirement));
  check("Kubernetes listed first but is preferred", k?.criticality === "preferred", `got ${k?.criticality}`);
  check("Python is required despite not being first", p?.criticality === "required", `got ${p?.criticality}`);
  check("licence buried at the bottom is still required", lic?.criticality === "required", `got ${lic?.criticality}`);
}

/* ── 2. Salary/DEI/marketing excluded from requirements ───────────────────── */
console.log("\nlowercase_tech_categorised_correctly");
{
  const reqs = extractStructuredRequirements(
    "Requirements:\n- Docker is required\n- Kubernetes is required\n- Python is required\n- React is required\n",
    20,
  );
  const cat = (name: string) => reqs.find((r) => r.requirement.toLowerCase() === name)?.category;
  // These plain lowercase tool names have no acronym/CamelCase/dot shape, so they used
  // to fall through to "other" and get scored in the wrong bucket at the wrong weight.
  check("docker is technical", cat("docker") === "technical", `got ${cat("docker")}`);
  check("kubernetes is technical", cat("kubernetes") === "technical", `got ${cat("kubernetes")}`);
  check("python is technical", cat("python") === "technical", `got ${cat("python")}`);
  check("react is technical", cat("react") === "technical", `got ${cat("react")}`);
}

/* ── 3. Salary/DEI/marketing excluded from requirements ───────────────────── */
console.log("\nnoise_excluded");
{
  const reqs = extractStructuredRequirements(
    `What we offer:\n- Competitive salary of 60000 EUR\n- We value diversity and are an equal opportunities employer\nRequirements:\n- SQL is required\n`,
    20,
  );
  check("salary is not a requirement", !reqs.some((r) => /salary|60000/i.test(r.requirement)));
  check("diversity statement is not a requirement", !reqs.some((r) => /diversity|equal/i.test(r.requirement)));
  check("SQL survives", reqs.some((r) => /sql/i.test(r.requirement)));
}

/* ── 3. Qualified candidate not told they lack their own credential ───────── */
console.log("\nqualified_candidate_credential_recognised");
{
  const j = job({
    title: "Registered Nurse",
    description: `Requirements:\n- You must hold a valid nursing licence\n- Fluent German is required\n`,
  });
  const qualified = profile({
    languages: ["German", "English"],
    certifications: ["Registered Nurse licence, Bavaria"],
    skills: ["Acute care"],
    experience: [{ title: "Staff Nurse", company: "Clinic", location: "Berlin", dates: "2015 - Present", bullets: ["Acute ward"] }],
  });
  const m = rankJob(j, ctx({ role: "Registered Nurse" }), qualified);
  const lic = m.requirements.find((r) => /licence/i.test(r.requirement));
  const ger = m.requirements.find((r) => r.category === "language");
  check("nursing licence recognised from 'Registered Nurse licence'", lic?.status === "matched", `got ${lic?.status}`);
  check("German recognised despite CV not stating a CEFR level", ger?.status === "matched", `got ${ger?.status}`);
  check("no required requirement reads as missing", m.missingCriticalRequirements.length === 0, m.missingCriticalRequirements.join(","));
}

/* ── 4. Unqualified candidate correctly penalised ─────────────────────────── */
console.log("\nunqualified_candidate_penalised");
{
  const j = job({
    title: "Registered Nurse",
    description: `Requirements:\n- You must hold a valid nursing licence\n- Fluent German is required\n`,
  });
  const unqualified = profile({ languages: ["English"], certifications: [], skills: ["Retail"], experience: [{ title: "Shop Assistant", company: "Store", location: "London", dates: "2019 - Present", bullets: ["Till work"] }] });
  const m = rankJob(j, ctx({ role: "Nurse" }), unqualified);
  check("missing licence + German both flagged required", m.missingCriticalRequirements.length >= 2, m.missingCriticalRequirements.join(","));
  check("score is low_match", m.recommendation === "low_match", `score ${m.score}`);
}

/* ── 5. Java is not proven by JavaScript ──────────────────────────────────── */
console.log("\nsubstring_false_match_guard");
{
  const reqs = extractStructuredRequirements("Requirements:\n- Java is required\n", 10);
  const jsOnly = profile({ skills: ["JavaScript", "React", "Node.js"] });
  const m = matchRequirementsAgainstCv(reqs, jsOnly);
  const java = m.find((r) => /^java$/i.test(r.requirement.trim()) || /\bjava\b/i.test(r.requirement));
  check("'Java' requirement not matched by 'JavaScript' in CV", java?.status === "missing", `got ${java?.status}`);
}

/* ── 6. One missing requirement penalised once, not twice ─────────────────── */
console.log("\nno_double_penalty");
{
  const reqs = extractStructuredRequirements("Requirements:\n- Fluent German is required\n", 10);
  const names = reqs.filter((r) => r.category === "language").map((r) => r.requirement);
  check("German appears as exactly one requirement", names.length === 1, `got ${names.length}: ${names.join(" | ")}`);
}

/* ── 7. Missing vs not-verifiable ─────────────────────────────────────────── */
console.log("\nmissing_vs_not_verifiable");
{
  const j = job({ title: "Engineer", description: `Requirements:\n- Willing to relocate to Munich\n- Python is required\n`, location: "Munich, Germany" });
  const p = profile({ skills: ["Java"], basics: { name: "X", headline: "", email: "", phone: "", location: "Hamburg", linkedin: "" } });
  const m = rankJob(j, ctx(), p);
  const reloc = m.requirements.find((r) => /relocate/i.test(r.requirement));
  const py = m.requirements.find((r) => /python/i.test(r.requirement));
  check("relocation is not_verifiable, not missing", reloc?.status === "not_verifiable", `got ${reloc?.status}`);
  check("missing Python is missing", py?.status === "missing", `got ${py?.status}`);
}

/* ── 8. Evidence gate blocks unsupported claims from documents ─────────────── */
console.log("\nevidence_gate_blocks_unsupported");
{
  const j = job({ title: "DevOps Engineer", description: `Requirements:\n- Kubernetes is required\n- Docker is required\n` });
  const p = profile({ skills: ["Docker", "Linux"], experience: [{ title: "SRE", company: "Acme", location: "Berlin", dates: "2018 - Present", bullets: ["Ran Docker containers in production, reduced deploy time 40%"] }] });
  const m = rankJob(j, ctx({ role: "DevOps Engineer", skills: ["Docker", "Linux"] }), p);
  const verdict = assessEvidence(m);
  check("Kubernetes (not in CV) is blocked", verdict.blocked.some((r) => /kubernetes/i.test(r.requirement)));
  check("Docker (in CV) is supported", verdict.supported.some((r) => /docker/i.test(r.requirement)));

  const letter = generateCoverLetter(p, j, m);
  const leaked = findUnsupportedClaims(letter.plainText, verdict);
  check("cover letter does not assert Kubernetes", !leaked.some((c) => /kubernetes/i.test(c)), `leaked: ${leaked.join(",")}`);
  check("blocked claims surfaced to user", letter.evidenceWarnings.some((w) => /kubernetes/i.test(w)));
}

/* ── 9. Tailored CV preserves identity and history ────────────────────────── */
console.log("\ntailored_cv_preserves_history");
{
  const j = job({ title: "Backend Engineer", description: `Requirements:\n- Python is required\n- SQL is required\n` });
  const p = profile({
    basics: { name: "Jane Doe", headline: "Software Engineer", email: "jane@x.com", phone: "123", location: "Berlin", linkedin: "in/jane" },
    skills: ["Java", "Python", "SQL"],
    experience: [
      { title: "Engineer", company: "Alpha GmbH", location: "Berlin", dates: "2020 - Present", bullets: ["Built Java services", "Wrote SQL reports", "Automated Python ETL"] },
      { title: "Junior Dev", company: "Beta AG", location: "Munich", dates: "2018 - 2020", bullets: ["Maintained legacy code"] },
    ],
  });
  const m = rankJob(j, ctx({ role: "Backend Engineer", skills: ["Java", "Python", "SQL"] }), p);
  const result = tailorCvForJob(p, j, m, ctx({ role: "Backend Engineer", skills: ["Java", "Python", "SQL"] }));

  check("name unchanged", result.profile.basics.name === "Jane Doe");
  check("headline NOT overwritten with job title", result.profile.basics.headline === "Software Engineer", result.profile.basics.headline);
  check("employers preserved", result.profile.experience.map((e) => e.company).join(",") === "Alpha GmbH,Beta AG");
  check("dates preserved", result.profile.experience[0].dates === "2020 - Present");
  const origBullets = ["Built Java services", "Wrote SQL reports", "Automated Python ETL"];
  const newBullets = result.profile.experience[0].bullets;
  check("no bullet invented (same set, possibly reordered)", newBullets.slice().sort().join("|") === origBullets.slice().sort().join("|"), newBullets.join(" / "));
  check("no skill invented", result.profile.skills.slice().sort().join(",") === ["Java", "Python", "SQL"].slice().sort().join(","));
}

console.log(`\n${failures === 0 ? "ALL SMART APPLY CHECKS PASSED" : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
