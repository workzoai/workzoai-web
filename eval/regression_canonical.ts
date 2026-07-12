/**
 * WorkZo CV pipeline - canonical regression tests.
 *
 *   npx tsx eval/regression_canonical.ts
 *
 * These are the tests that WOULD HAVE CAUGHT the two bugs this refactor fixes.
 * They are entity-free: no real names, companies, or schools. They assert
 * invariants that must hold for ANY CV, ANY job description, and ANY role.
 *
 * 1. FINALIZER WRITES THE CANONICAL FIELDS.
 *    The old finalizer wrote the identity decision to top-level `profile.name`
 *    and `profile.headline`. Every renderer reads `basics.name` and
 *    `basics.headline`. So the "last line of defence" was a no-op, and its own
 *    log printed the pre-finalizer value, which is why the logs always looked
 *    right while the rendered CV was wrong.
 *
 * 2. THE FACT CONTRACT SURVIVES A REWRITE.
 *    AI may change: summary, bullet wording, skill ordering.
 *    AI may never change: title, company, dates, location, education,
 *    certifications, project names, project count, languages, name, headline.
 *
 * Exits non-zero on failure, so it drops straight into CI.
 */

import { finalizeCanonicalCvProfile } from "@/lib/workzoCvGlobalFinalizer";
import { guardRewrittenResume, guardCanonicalParse } from "@/lib/workzoCanonicalGuard";
import type { ResumeProfile } from "@/lib/workzoResumeParser";

let failures = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}${detail ? `  ->  ${detail}` : ""}`);
  }
}

const RAW_CV = [
  "ALEX MORGAN",
  "Data Analyst",
  "alex.morgan@example.com | +49 176 000 000 | Berlin",
  "",
  "SKILLS",
  "Python, SQL, Tableau, Seaborn, Matplotlib",
  "",
  "WORK EXPERIENCE",
  "Junior Data Analyst",
  "Northwind Analytics | Jan 2023 - Present",
  "Built dashboards for the sales team.",
  "Automated a weekly reporting job.",
  "",
  "Reporting Assistant",
  "Blue Harbor Group | Mar 2021 - Dec 2022",
  "Maintained the KPI spreadsheet.",
  "",
  "EDUCATION",
  "BSc Statistics",
  "University of Example | 2017 - 2020",
  "",
  "PROJECTS",
  "Churn Prediction Study",
  "Compared three models on an open telecom dataset.",
  "",
  "LANGUAGES",
  "English (C1), German (B1), Tamil (Native)",
].join("\n");

const SOURCE_PROFILE: ResumeProfile = {
  rawText: RAW_CV,
  basics: {
    name: "Alex Morgan",
    headline: "Data Analyst",
    email: "alex.morgan@example.com",
    phone: "+49 176 000 000",
    location: "Berlin",
    linkedin: "",
  },
  summary: "Data analyst with dashboard and reporting experience.",
  experience: [
    {
      title: "Junior Data Analyst",
      company: "Northwind Analytics",
      location: "Berlin",
      dates: "Jan 2023 - Present",
      bullets: ["Built dashboards for the sales team.", "Automated a weekly reporting job."],
    },
    {
      title: "Reporting Assistant",
      company: "Blue Harbor Group",
      location: "Berlin",
      dates: "Mar 2021 - Dec 2022",
      bullets: ["Maintained the KPI spreadsheet."],
    },
  ],
  education: [
    { degree: "BSc Statistics", institution: "University of Example", location: "", dates: "2017 - 2020" },
  ],
  skills: ["Python", "SQL", "Tableau", "Seaborn", "Matplotlib"],
  projects: [
    { name: "Churn Prediction Study", bullets: ["Compared three models on an open telecom dataset."] },
  ],
  languages: ["English (C1)", "German (B1)", "Tamil (Native)"],
  certifications: [],
  strengths: [],
  additionalEvidence: [],
  warnings: [],
  previewText: RAW_CV.slice(0, 400),
} as ResumeProfile;

/* ---------------------------------------------------------------- *
 * 1. Finalizer writes basics.name and basics.headline
 * ---------------------------------------------------------------- */
console.log("\nfinalizer_writes_canonical_fields");

const finalized: any = finalizeCanonicalCvProfile(
  { ...SOURCE_PROFILE, basics: { ...SOURCE_PROFILE.basics, name: "Seaborn Matplotlib" } },
  { rawText: RAW_CV, fileName: "alex-morgan-cv.pdf", selectedName: "Alex Morgan" },
);

check(
  "basics.name is populated by the finalizer",
  Boolean(finalized?.basics?.name),
  `basics.name = ${JSON.stringify(finalized?.basics?.name)}`,
);
check(
  "basics.name is not a skill list",
  finalized?.basics?.name !== "Seaborn Matplotlib",
  `basics.name = ${JSON.stringify(finalized?.basics?.name)}`,
);
check(
  "basics.headline is populated by the finalizer",
  Boolean(finalized?.basics?.headline),
  `basics.headline = ${JSON.stringify(finalized?.basics?.headline)}`,
);

const withTarget: any = finalizeCanonicalCvProfile(SOURCE_PROFILE, {
  rawText: RAW_CV,
  fileName: "alex-morgan-cv.pdf",
  targetRole: "Senior Data Analyst",
});
check(
  "an explicit target role wins the headline",
  withTarget?.basics?.headline === "Senior Data Analyst",
  `basics.headline = ${JSON.stringify(withTarget?.basics?.headline)}`,
);

/* ---------------------------------------------------------------- *
 * 2. Parse guard repairs and locks identity
 * ---------------------------------------------------------------- */
console.log("\nparse_guard_locks_identity");

const parseGuarded = guardCanonicalParse({
  profile: { ...SOURCE_PROFILE, basics: { ...SOURCE_PROFILE.basics, name: "Work Experience" } },
  rawText: RAW_CV,
  fileName: "alex-morgan-cv.pdf",
  candidateName: "Alex Morgan",
});
check(
  "a section header is never accepted as the candidate name",
  parseGuarded.basics.name !== "Work Experience",
  `basics.name = ${JSON.stringify(parseGuarded.basics.name)}`,
);
check("no job is dropped by the parse guard", (parseGuarded.experience || []).length === 2);
check("no education is dropped by the parse guard", (parseGuarded.education || []).length === 1);

/* ---------------------------------------------------------------- *
 * 3. The fact contract survives a hostile rewrite
 * ---------------------------------------------------------------- */
console.log("\nrewrite_guard_enforces_fact_contract");

// A deliberately hostile model output: it promotes a title, renames a company,
// shifts a date, invents a project, drops a language, and rewrites a degree.
const HOSTILE_REWRITE: Partial<ResumeProfile> = {
  basics: { ...SOURCE_PROFILE.basics, name: "Alexander Morgan", headline: "Head of Data" },
  summary: "Results-driven analyst delivering measurable business impact.",
  experience: [
    {
      title: "Senior Data Analyst",
      company: "Northwind Analytics GmbH",
      location: "Munich",
      dates: "Jan 2022 - Present",
      bullets: [
        "Delivered executive dashboards that cut reporting time by 40%.",
        "Automated weekly reporting, saving 6 hours a week.",
      ],
    },
    {
      title: "Data Analyst",
      company: "Blue Harbor",
      location: "Berlin",
      dates: "Mar 2020 - Dec 2022",
      bullets: ["Owned the KPI spreadsheet and its stakeholders."],
    },
  ],
  education: [
    { degree: "MSc Data Science", institution: "University of Example", location: "", dates: "2017 - 2020" },
  ],
  projects: [
    { name: "Enterprise Churn Platform", bullets: ["Shipped a churn model to production."] },
    { name: "Invented Side Project", bullets: ["Did not happen."] },
  ],
  languages: ["English (C1)"],
  skills: ["Python", "SQL", "Kubernetes"],
};

const { profile: safe } = guardRewrittenResume({
  rewrittenProfile: HOSTILE_REWRITE,
  rewrittenText: "",
  sourceProfile: SOURCE_PROFILE,
  sourceText: RAW_CV,
  targetRole: "Data Analyst",
  jobDescription: "Looking for a data analyst with SQL and dashboarding experience.",
});

const titles = (safe.experience || []).map((e) => e.title);
const companies = (safe.experience || []).map((e) => e.company);
const dates = (safe.experience || []).map((e) => e.dates);

check("job titles are not promoted", titles.join("|") === "Junior Data Analyst|Reporting Assistant", titles.join("|"));
check("company names are not renamed", companies.join("|") === "Northwind Analytics|Blue Harbor Group", companies.join("|"));
check("dates are not shifted", dates.join("|") === "Jan 2023 - Present|Mar 2021 - Dec 2022", dates.join("|"));
check("job count is unchanged", (safe.experience || []).length === 2);
check(
  "degree is not upgraded",
  (safe.education || [])[0]?.degree === "BSc Statistics",
  String((safe.education || [])[0]?.degree),
);
check(
  "project names come from the CV",
  (safe.projects || []).map((p) => p.name).join("|") === "Churn Prediction Study",
  (safe.projects || []).map((p) => p.name).join("|"),
);
check("no project is invented", (safe.projects || []).length === 1);
check(
  "languages are never dropped",
  (safe.languages || []).length === 3,
  (safe.languages || []).join("|"),
);
check(
  "candidate name is not changed by the rewrite",
  safe.basics.name === "Alex Morgan",
  safe.basics.name,
);
check(
  "headline is the explicit target role",
  safe.basics.headline === "Data Analyst",
  safe.basics.headline,
);
// INFO, not an assertion. The AI is ALLOWED to reword bullets, so this prints
// what actually survived the guard. If every bullet reverts to the source
// wording on every CV, the guard's bulletMatchThreshold is too strict and the
// rewrite has become a no-op. That is a tuning signal, not a correctness bug,
// which is why it is reported rather than failed.
console.log(
  "  INFO  bullets after guard:\n        " +
    (safe.experience?.[0]?.bullets || []).join("\n        "),
);
check("bullet count per job is unchanged", (safe.experience?.[0]?.bullets || []).length === 2);

/* ---------------------------------------------------------------- */
console.log(
  `\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}\n`,
);
process.exit(failures === 0 ? 0 : 1);
