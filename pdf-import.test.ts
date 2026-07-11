import {
  parseDateRange,
  linkedInProfileFromResumeProfile,
  coerceLinkedInProfile,
  parseLinkedInProfile,
} from "./lib/workzoLinkedInParser";
import { analyzeLinkedIn } from "./lib/workzoLinkedInEngine";
import type { ResumeProfile } from "./lib/workzoResumeParser";

console.log("── date formats ──");
const dates: [string, string][] = [
  ["Jan 2021 - Present · 4 yrs 6 mos", "web paste"],
  ["January 2021 - Present (4 years 6 months)", "LinkedIn PDF"],
  ["March 2019 - December 2020 (1 year 10 months)", "LinkedIn PDF"],
  ["(2014 - 2018)", "fully parenthesised — must still parse"],
  ["Munich, Germany", "not a date"],
];
for (const [input, note] of dates) {
  const r = parseDateRange(input);
  console.log(`  ${r ? String(r.months).padStart(3) + " mo" : " not a date"}  ${input}   (${note})`);
}

// What the vision extractor hands back from a LinkedIn "Save to PDF" export.
const visionProfile = {
  basics: { name: "Haritha Nair", headline: "Technical Consultant at Novaline Systems", linkedin: "linkedin.com/in/haritha-nair-3b41072a4" },
  summary: "I enjoy solving hard problems with data. I have worked with SQL and reporting for several years.",
  experience: [
    { title: "Technical Consultant", company: "Novaline Systems GmbH", dates: "January 2021 - Present (4 years 6 months)", bullets: ["Resolved escalated customer issues across EMEA"] },
    { title: "Support Analyst", company: "Kestrel Digital Ltd", dates: "March 2019 - December 2020 (1 year 10 months)", bullets: [] },
  ],
  education: [{ degree: "Bachelor of Technology", institution: "University of Kerala", dates: "2014 - 2018" }],
  // The export truncates to top skills. Tableau and Excel are on the real
  // profile but never make it into the PDF.
  skills: ["Python", "Customer Support", "Kubernetes"],
  certifications: [],
};

const fromPdf = linkedInProfileFromResumeProfile(visionProfile, "Profile.pdf");
console.log("\n── PDF → LinkedInProfile ──");
console.log("  source        :", fromPdf.source);
console.log("  skillsComplete:", fromPdf.skillsComplete);
console.log("  roles         :", fromPdf.experience.map((r) => `${r.title} @ ${r.company}`));
console.log("  hasCustomUrl  :", fromPdf.meta.hasCustomUrl, "(auto-generated slug detected)");

const resumeProfile = {
  rawText: "",
  basics: { name: "Haritha Nair", headline: "Junior Data Analyst", email: "", phone: "", location: "", linkedin: "" },
  summary: "Built dashboards in Tableau.",
  experience: [
    { title: "Technical Support Engineer", company: "Novaline Systems", location: "", dates: "Jan 2021 - Present", bullets: ["Wrote SQL queries", "Built dashboards in Tableau"] },
    { title: "Support Analyst", company: "Kestrel Digital", location: "", dates: "Mar 2019 - Dec 2020", bullets: [] },
  ],
  education: [{ degree: "Bachelor of Technology", institution: "University of Kerala", location: "", dates: "2014 - 2018" }],
  skills: ["Python", "SQL", "Tableau", "Excel", "Customer Support"],
  projects: [], languages: [], certifications: [], strengths: [], additionalEvidence: [], warnings: [], previewText: "",
} as ResumeProfile;

const jd = "Requirements:\n• Strong SQL and data modelling\n• Dashboards in Power BI or Tableau\n• Python for data analysis";

const viaPdf = analyzeLinkedIn({ linkedin: fromPdf, resumeProfile, jobDescription: jd });

// Same profile, but pasted — full skills list, so the omission IS provable.
const pasted = parseLinkedInProfile(`Haritha Nair\nTechnical Consultant at Novaline Systems\n\nExperience\nTechnical Consultant\nNovaline Systems GmbH\nJan 2021 - Present\n\nSkills\nPython\nCustomer Support\nKubernetes\n`);
const viaPaste = analyzeLinkedIn({ linkedin: pasted, resumeProfile, jobDescription: jd });

console.log("\n── skills-truncation awareness ──");
for (const [label, r] of [["PDF  ", viaPdf], ["PASTE", viaPaste]] as const) {
  const flagged = r.consistency.findings.some((f) => f.code === "skills_missing_on_linkedin");
  console.log(`  ${label}  skillsChecked=${String(r.consistency.skillsChecked).padEnd(5)} reports missing skills: ${flagged}  score=${r.consistency.consistencyScore}`);
}
console.log("  PDF still returns the list for display:", viaPdf.consistency.skillsOnlyInCv);

console.log("\n── unevidenced (the rewrite's forbidden list) ──");
console.log("  gaps       :", viaPdf.jdMatch!.gaps.map((f) => f.keyword));
console.log("  unevidenced:", viaPdf.jdMatch!.unevidenced.map((f) => f.keyword));

// Forgery check: a caller claims Power BI is on their LinkedIn.
const forged = coerceLinkedInProfile({ ...fromPdf, skills: [...fromPdf.skills, "Power BI"], headline: "Power BI Analyst" })!;
const viaForged = analyzeLinkedIn({ linkedin: forged, resumeProfile, jobDescription: jd });
const gapsHasPbi = viaForged.jdMatch!.gaps.some((f) => /power bi/i.test(f.keyword));
const unevHasPbi = viaForged.jdMatch!.unevidenced.some((f) => /power bi/i.test(f.keyword));

console.log("\n── forgery: caller claims Power BI on LinkedIn ──");
console.log(`  in gaps?        ${gapsHasPbi}   ← would have unlocked the keyword`);
console.log(`  in unevidenced? ${unevHasPbi}   ← still forbidden, CV-derived`);

console.log("\n── ASSERTIONS ──");
const checks: [string, boolean][] = [
  ["PDF date with (4 years 6 months) parses", parseDateRange("January 2021 - Present (4 years 6 months)") !== null],
  ["fully parenthesised (2014 - 2018) still parses", parseDateRange("(2014 - 2018)") !== null],
  ["PDF marked skillsComplete=false", fromPdf.skillsComplete === false],
  ["PDF suppresses skills_missing finding", !viaPdf.consistency.findings.some((f) => f.code === "skills_missing_on_linkedin")],
  ["PASTE still reports skills_missing", viaPaste.consistency.findings.some((f) => f.code === "skills_missing_on_linkedin")],
  ["PDF still surfaces the list for display", viaPdf.consistency.skillsOnlyInCv.length > 0],
  ["auto-generated slug => hasCustomUrl false", fromPdf.meta.hasCustomUrl === false],
  ["forged LinkedIn removes Power BI from gaps", !gapsHasPbi],
  ["forged LinkedIn CANNOT remove it from unevidenced", unevHasPbi],
];
let failed = 0;
for (const [name, pass] of checks) {
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}`);
  if (!pass) failed += 1;
}
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
