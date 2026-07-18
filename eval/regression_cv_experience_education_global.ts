import assert from "node:assert/strict";
import {
  buildAuthoritativeEducation,
  buildAuthoritativeExperience,
  exactDedupeEducation,
  exactDedupeExperience,
} from "../lib/workzoCvExperienceEducationAuthority";

// Generated property coverage: promotions, sparse rows, exact duplicates,
// distinct dates, and missing-field enrichment. No production fixture names.
const roles = ["Engineer", "Analyst", "Manager", "Consultant", "Specialist"];
const companies = ["Alpha Labs", "Beta Systems", "Gamma Group"];
let checks = 0;
for (const role of roles) {
  for (const company of companies) {
    const rows = [
      { title: role, company, location: "Berlin", dates: "2020 - 2022", bullets: ["Delivered measurable outcomes."] },
      { title: `Senior ${role}`, company, location: "Berlin", dates: "2022 - Present", bullets: ["Led cross-functional delivery."] },
      { title: role, company, location: "", dates: "2020 - 2022", bullets: ["Delivered measurable outcomes."] },
      { title: role, company: "", location: "", dates: "", bullets: ["Sparse extracted fragment remains reviewable."] },
    ];
    const out = exactDedupeExperience(rows as any);
    assert.equal(out.length, 3, "promotion or sparse row was incorrectly deleted");
    assert.equal(out[0].dates, "2020 - 2022");
    assert.equal(out[1].dates, "2022 - Present");
    checks += 1;
  }
}

const parserExperience = [
  { title: "Engineer", company: "Alpha", location: "", dates: "2018 - 2020", bullets: ["Supported users."] },
  { title: "Senior Engineer", company: "Alpha", location: "Munich", dates: "2020 - 2023", bullets: ["Led support."] },
];
const guardedExperience = [
  { title: "Engineer", company: "Alpha", location: "Berlin", dates: "2018 - 2020", bullets: ["Improved SLA performance."] },
];
const authoritativeExperience = buildAuthoritativeExperience(parserExperience as any, guardedExperience as any, []);
assert.equal(authoritativeExperience.length, 2);
assert.equal(authoritativeExperience[0].location, "Berlin");
assert.equal(authoritativeExperience[1].dates, "2020 - 2023");
checks += 3;

const education = [
  { degree: "Master of Science", institution: "University A", location: "Germany", dates: "2013 - 2016" },
  { degree: "Master of Science", institution: "University B", location: "Sweden", dates: "2014" },
  { degree: "Master of Science", institution: "University A", location: "", dates: "2013 - 2016" },
  { degree: "Master of Science", institution: "University A", location: "Germany", dates: "2016" },
];
const dedupedEducation = exactDedupeEducation(education as any);
assert.equal(dedupedEducation.length, 3, "distinct institution/date education was merged");
assert.equal(dedupedEducation[0].dates, "2013 - 2016");
checks += 2;

const authoritativeEducation = buildAuthoritativeEducation(
  [{ degree: "Bachelor of Science", institution: "College X", location: "", dates: "2012 - 2015" }] as any,
  [{ degree: "Bachelor of Science", institution: "College X", location: "India", dates: "2012 - 2015" }] as any,
  [],
);
assert.equal(authoritativeEducation.length, 1);
assert.equal(authoritativeEducation[0].location, "India");
assert.equal(authoritativeEducation[0].dates, "2012 - 2015");
checks += 3;

console.log(`Global experience/education invariants passed: ${checks}`);
