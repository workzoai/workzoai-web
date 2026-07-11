import { parseLinkedInProfile, parseDateRange } from "./lib/workzoLinkedInParser";
import { analyzeLinkedIn, extractJdTerms } from "./lib/workzoLinkedInEngine";
import type { ResumeProfile } from "./lib/workzoResumeParser";

// A realistic browser paste: every label duplicated, "· Full-time" tails,
// "· 3 yrs 5 mos" duration tails, location lines.
const linkedinPaste = `
Haritha Nair
Haritha Nair
Technical Consultant at Novaline Systems
Technical Consultant at Novaline Systems
Munich, Bavaria, Germany
487 connections
linkedin.com/in/haritha-nair-3b41072a4

About
About
I enjoy solving hard problems with data. I have worked with SQL and reporting for several
years and I like turning messy datasets into something a business can act on.

Experience
Experience
Technical Consultant
Technical Consultant
Novaline Systems GmbH · Full-time
Jan 2021 - Present · 4 yrs 6 mos
Munich, Germany
• Resolved escalated customer issues across the EMEA region
• Built internal reporting for the support organisation

Support Analyst
Support Analyst
Kestrel Digital Ltd
Mar 2019 - Dec 2020
Remote
• Handled tier 2 tickets and wrote runbooks

Education
Education
University of Kerala
Bachelor of Technology
2014 - 2018

Skills
Skills
Python
Customer Support
Kubernetes
`;

const resumeProfile: ResumeProfile = {
  rawText: "",
  basics: {
    name: "Haritha Nair",
    headline: "Junior Data Analyst",
    email: "",
    phone: "",
    location: "Munich",
    linkedin: "",
  },
  summary: "Analyst moving from technical support into data. Built dashboards in Tableau.",
  experience: [
    {
      title: "Technical Support Engineer",
      company: "Novaline Systems",
      location: "Munich",
      dates: "Jan 2021 - Present",
      bullets: [
        "Resolved escalated technical issues for enterprise customers",
        "Built stakeholder communication dashboards in Tableau",
        "Wrote SQL queries against the ticketing warehouse",
      ],
    },
    {
      title: "Support Analyst",
      company: "Kestrel Digital",
      location: "Remote",
      dates: "Mar 2019 - Mar 2020",
      bullets: ["Handled tier 2 tickets"],
    },
    {
      title: "Data Analytics Intern",
      company: "Brightpath Labs",
      location: "Kochi",
      dates: "Jun 2018 - Dec 2018",
      bullets: ["Cleaned survey data with Python and pandas"],
    },
  ],
  education: [{ degree: "Bachelor of Technology", institution: "University of Kerala", location: "", dates: "2014 - 2018" }],
  skills: ["Python", "SQL", "Tableau", "Excel", "Customer Support"],
  projects: [],
  languages: [],
  certifications: [],
  strengths: [],
  additionalEvidence: [],
  warnings: [],
  previewText: "",
};

const jobDescription = `
Junior Data Analyst — Berlin

We are looking for a Junior Data Analyst to join our Business Intelligence team.

Requirements:
• Strong SQL and data modelling skills
• Experience building dashboards in Power BI or Tableau
• Comfortable with Python for data analysis
• Excellent stakeholder communication
• Exposure to business intelligence tooling is a plus
`;

// ── 1. Date parsing ──────────────────────────────────────────────────────────
console.log("── parseDateRange ──");
for (const s of ["Jan 2021 - Present · 4 yrs 6 mos", "Mar 2019 - Dec 2020", "2014 - 2018", "01/2021 – 03/2023", "Munich, Germany"]) {
  const r = parseDateRange(s);
  console.log(`  ${JSON.stringify(s).padEnd(36)} → ${r ? `${r.months} months, present=${r.present}` : "not a date"}`);
}

// ── 2. Parser ────────────────────────────────────────────────────────────────
const li = parseLinkedInProfile(linkedinPaste);
console.log("\n── parseLinkedInProfile ──");
console.log("  name       :", li.name);
console.log("  headline   :", li.headline);
console.log("  roles      :", li.experience.map((r) => `${r.title} @ ${r.company} (${r.dates})`));
console.log("  bullets[0] :", li.experience[0]?.bullets.length);
console.log("  education  :", li.education.map((e) => `${e.degree} @ ${e.institution}`));
console.log("  skills     :", li.skills);
console.log("  meta       :", li.meta);

// ── 3. JD term extraction ────────────────────────────────────────────────────
console.log("\n── extractJdTerms (top 10) ──");
console.log("  ", extractJdTerms(jobDescription, 10).map((t) => t.display).join(" | "));

// ── 4. Full analysis ─────────────────────────────────────────────────────────
const result = analyzeLinkedIn({ linkedin: li, resumeProfile, jobDescription });

console.log("\n── Consistency (engine 2) ──");
console.log("  score:", result.consistency.consistencyScore, "| matched roles:", result.consistency.matchedRoles);
for (const f of result.consistency.findings) {
  console.log(`  [${f.severity.toUpperCase().padEnd(6)}] ${f.code}`);
  console.log(`           ${f.message}`);
  if (f.items) console.log(`           items: ${f.items.join(", ")}`);
}

console.log("\n── JD match (engine 3) ──");
const jd = result.jdMatch!;
console.log("  matchScore:", jd.matchScore, `(over ${jd.termCount} JD terms)`);
console.log("  MATCHED :", jd.matched.map((f) => f.keyword).join(", ") || "—");
console.log("  PROMOTE :", jd.promote.map((f) => `${f.keyword} (in ${f.foundIn})`).join(", ") || "—");
console.log("  ADD     :", jd.add.map((f) => f.keyword).join(", ") || "—");
console.log("  GAP     :", jd.gaps.map((f) => f.keyword).join(", ") || "—");
