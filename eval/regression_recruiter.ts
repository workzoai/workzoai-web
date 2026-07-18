/**
 * WorkZo - recruiter recommendation regression.
 *
 *   npx tsx eval/regression_recruiter.ts
 *
 * TWO CORPORA, TWO DIFFERENT FAILURES.
 *
 * eval/cvs/e*.txt is the COMMERCIAL corpus: coding-school and university
 * profiles. This is the market. Every one of these CVs is saturated with
 * junior / graduate / bootcamp / entry-level / career change / trainee, and
 * `early_career` used to sit in the DOMAINS table competing with the job itself.
 * So it won, every time, and EVERY bootcamp graduate was routed to the growth
 * recruiter instead of a technical interviewer, even after typing
 * "Junior Data Scientist":
 *
 *     Bootcamp grad -> "Junior Data Scientist"     => PRIYA  (growth)
 *     Bootcamp grad -> "Junior Frontend Developer" => PRIYA
 *     German bootcamp -> "Junior Datenanalyst"     => PRIYA
 *
 * A junior data scientist is still a data scientist. Seniority is an AXIS, not a
 * job family: it decides which TIER of interviewer, never which TYPE.
 *
 * eval/cvs/z*.txt is the SAFETY corpus: a nurse, a sommelier, a welder, a
 * marketer, a French PM, a Spanish analyst. These exist to stop the scorer
 * inventing a confident answer from one incidental keyword. The welder used to
 * get a SALES DIRECTOR because "commercial" appeared twice.
 *
 * Both must pass. Fixing one at the cost of the other is not a fix.
 */

import * as fs from "fs";
import * as path from "path";
import { recommendRecruiters } from "@/lib/recruiterRecommendation";

const NAME: Record<string, string> = {
  faang_hiring_manager: "Alex",
  german_corporate: "Markus",
  analytical_hiring_manager: "Daniel",
  startup_recruiter: "Priya",
  friendly_hr: "Sarah",
  sales_director: "SalesDir",
  product_leader: "ProdLead",
  executive_recruiter: "Exec",
  enterprise_recruiter: "Enterprise",
  consulting_partner: "Consult",
  startup_founder: "Founder",
};

let failures = 0;

const cv = (f: string) => fs.readFileSync(path.join(process.cwd(), "eval/cvs", f), "utf8");

function check(
  label: string,
  input: { targetRole?: string; jobDescription?: string; cvText?: string },
  wantPrimary: string,
) {
  const r = recommendRecruiters(input);
  const got = r ? NAME[r.primary] : "none";
  const ok = got === wantPrimary;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(46)} -> ${got}${ok ? "" : `   WANT ${wantPrimary}`}`);
}

/* ─── THE MARKET: coding schools and universities ─────────────────────────── */
console.log("\ncoding_school_and_university");

check("bootcamp grad -> Junior Data Scientist", { targetRole: "Junior Data Scientist", cvText: cv("e1_bootcamp_data.txt") }, "Alex");
check("bootcamp grad -> Junior Data Analyst", { targetRole: "Junior Data Analyst", cvText: cv("e1_bootcamp_data.txt") }, "Daniel");
check("bootcamp grad -> Junior Frontend Developer", { targetRole: "Junior Frontend Developer", cvText: cv("e2_bootcamp_web.txt") }, "Alex");
check("CS working student -> Graduate SW Engineer", { targetRole: "Graduate Software Engineer", cvText: cv("e3_cs_student.txt") }, "Alex");
check("German bootcamp -> Junior Datenanalyst", { targetRole: "Junior Datenanalyst", cvText: cv("e4_german_bootcamp.txt") }, "Daniel");
check("bootcamp grad, no target role typed", { cvText: cv("e1_bootcamp_data.txt") }, "Alex");
check("CS student, no target role typed", { cvText: cv("e3_cs_student.txt") }, "Alex");
// The ONE case where "early career" really is all we know: no evidence of the
// work yet. Here, and only here, the modifier picks the persona.
check("career changer, no technical content yet", { cvText: cv("e5_career_changer_blank.txt") }, "Priya");

/* ─── SENIORITY IS AN AXIS, NOT A DOMAIN ──────────────────────────────────── */
console.log("\nseniority_modifies_tier_not_type");

check(
  "Head of Data -> executive, not technical",
  { targetRole: "Head of Data", cvText: "Head of Data. Led a team of data scientists. Machine learning, TensorFlow, model deployment. Board reporting." },
  "Exec",
);
check(
  "Senior Backend Engineer -> senior technical tier",
  { targetRole: "Senior Software Engineer", cvText: "Senior Backend Engineer. Distributed systems, Kubernetes, microservices, system design, code review." },
  "Enterprise",
);

/* ─── SAFETY: junk in, silence out ───────────────────────────────────────── */
console.log("\nfail_safe");

check("empty input", {}, "none");
check("gibberish CV", { cvText: "asdf qwer zxcv lorem ipsum dolor sit amet" }, "none");
// This is the whole point of the evidence bar. It used to return SalesDir.
check("one stray word ('commercial')", { cvText: "We ran a commercial project last year." }, "none");

/* ─── COVERAGE: professions that used to get nothing, or nonsense ─────────── */
console.log("\noccupational_coverage");

check("Registered Nurse", { targetRole: "Registered Nurse", cvText: cv("z1_nurse.txt") }, "Sarah");
check("Head Sommelier", { targetRole: "Head Sommelier", cvText: cv("z2_sommelier.txt") }, "Sarah");
check("Certified Welder (was SALES DIRECTOR)", { targetRole: "Certified Welder", cvText: cv("z3_welder.txt") }, "Markus");
check("Brand Marketing Lead", { targetRole: "Brand Marketing Lead", cvText: cv("z4_marketing.txt") }, "ProdLead");
check("Chef de Projet Digital (French)", { targetRole: "Chef de Projet Digital", cvText: cv("z5_french.txt") }, "Markus");
check("Analista de Datos (Spanish)", { targetRole: "Analista de Datos", cvText: cv("z6_spanish.txt") }, "ProdLead");

/* ─── THE STARTUP HIJACK ───────────────────────────────────────────────────
 *
 * The bug this corpus was blind to.
 *
 * `data_science_ml` deliberately omits `pro`, so that `primary = pro || free`
 * resolves to Alex. But the startup modifier used to fire on `!winner.domain.pro`,
 * which is true for exactly the domains that omit `pro` ON PURPOSE. So the
 * modifier hijacked the very mechanism the Alex fix depended on:
 *
 *     Data scientist, CV says "startup" twice  => FOUNDER, not Alex
 *     Nurse, CV mentions a health startup      => FOUNDER, not Sarah
 *
 * It hit ten domains: data_science_ml, healthcare, skilled_trades, education,
 * finance_legal, enterprise, operations_logistics, hospitality_food, hr_people,
 * implementation_delivery.
 *
 * Why the corpus missed it: NOT ONE of the 18 CVs contained startup vocabulary,
 * and "startup" / "MVP" / "early-stage" are ordinary words in a real tech CV.
 * The evidence bar needs only two CV hits to fire.
 *
 * A startup changes the FLAVOUR of an interview, not the KIND. A data scientist
 * at a seed-stage company still gets a technical screen.
 */
console.log("\nstartup_modifier_must_not_hijack_the_domain");

check(
  "Senior data scientist AT A STARTUP (was FOUNDER)",
  { targetRole: "Data Scientist", cvText: cv("z7_data_scientist_startup.txt") },
  "Alex",
);
check(
  "Data scientist, startup JD (was FOUNDER)",
  {
    targetRole: "Data Scientist",
    jobDescription:
      "Seed stage startup seeking a data scientist for ML pipelines, NLP and model training. Scrappy, 0 to 1 team.",
    cvText: "TensorFlow, XGBoost, computer vision, ETL, Airflow, feature engineering.",
  },
  "Alex",
);
check(
  "Nurse who volunteered at a health startup (was FOUNDER)",
  { targetRole: "Registered Nurse", cvText: cv("z8_nurse_startup_mention.txt") },
  "Sarah",
);
check(
  "Senior data scientist, no target role typed",
  { cvText: cv("z0_data_scientist.txt") },
  "Alex",
);

// The founder must still be REACHABLE. Startup signal with no domain at all is
// the one case where "startup" is genuinely the only thing we know, and that
// path is handled before the domains are ranked.
check(
  "pure startup signal, no domain -> founder still reachable",
  { cvText: "Founding team member at an early-stage startup. Scrappy 0 to 1 seed stage MVP work." },
  "Founder",
);

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
