import { guardLinkedInRewrite } from "./lib/workzoLinkedInRewriteGuard";

// Real CV evidence. Note: no Power BI anywhere, and the only number is "40".
const evidence = `
Technical Support Engineer at Novaline Systems (Jan 2021 - Present)
Resolved escalated technical issues for enterprise customers.
Built stakeholder communication dashboards in Tableau.
Wrote SQL queries against the ticketing warehouse, cutting report time by 40%.
Skills: Python, SQL, Tableau, Excel
Education: Bachelor of Technology, University of Kerala, 2014 - 2018
`;

// What a model actually produces when it drifts: a forbidden tool in the
// headline, an invented metric, and a fabricated team size.
const modelHeadline =
  "Junior Data Analyst | SQL | Python | Power BI | Tableau | Turning Data into Business Insights";

const modelAbout = [
  "I moved from technical support into data analysis, and I like turning messy datasets into something a business can act on.",
  "At Novaline Systems I wrote SQL queries against the ticketing warehouse, cutting report time by 40%.",
  "I built Power BI dashboards that drove a 25% increase in stakeholder engagement.",
  "I led a team of 12 engineers through a reporting migration.",
  "I graduated from the University of Kerala in 2018 with a Bachelor of Technology.",
  "Over 5 years in customer-facing technical roles taught me to communicate with stakeholders.",
].join(" ");

const result = guardLinkedInRewrite({
  headline: modelHeadline,
  about: modelAbout,
  forbidden: ["power bi", "business intelligence", "data modelling"],
  evidence,
});

console.log("── HEADLINE ──");
console.log("  in :", modelHeadline);
console.log("  out:", result.headline);

console.log("\n── ABOUT ──");
console.log("  out:", result.about);

console.log("\n── VIOLATIONS BLOCKED ──");
for (const v of result.violations) {
  console.log(`  [${v.where}/${v.reason}] "${v.offender}"`);
  console.log(`      dropped: ${v.removed.slice(0, 78)}${v.removed.length > 78 ? "…" : ""}`);
}

// Assertions
const out = `${result.headline} ${result.about}`.toLowerCase();
const checks: [string, boolean][] = [
  ["Power BI removed from headline", !result.headline.toLowerCase().includes("power bi")],
  ["Power BI removed from about", !result.about.toLowerCase().includes("power bi")],
  ["invented 25% metric removed", !out.includes("25%")],
  ["invented team of 12 removed", !out.includes("12 engineers")],
  ["real 40% metric KEPT", out.includes("40%")],
  ["graduation year 2018 KEPT", out.includes("2018")],
  ["tenure '5 years' KEPT", out.includes("5 years")],
  ["Tableau KEPT in headline", result.headline.toLowerCase().includes("tableau")],
];

console.log("\n── ASSERTIONS ──");
let failed = 0;
for (const [name, pass] of checks) {
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}`);
  if (!pass) failed += 1;
}
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
