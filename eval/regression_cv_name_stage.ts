import { determineCanonicalIdentity } from "../lib/workzoCvIdentityEngine";

type Case = {
  label: string;
  input: Parameters<typeof determineCanonicalIdentity>[0];
  expected: string;
  confirm?: boolean;
};

const cases: Case[] = [
  { label: "ordinary Latin name", input: { rawText: "Sophia Martinez\nSenior Product Manager", email: "sophia.martinez@domain.org" }, expected: "Sophia Martinez" },
  { label: "letter-spaced name corroborated by email", input: { rawText: "H A R I T H A V I J A Y A K U M A R\nIT SUPPORT SPECIALIST", email: "harithavijayakumar30@domain.org" }, expected: "Haritha Vijayakumar" },
  { label: "two decorative lines", input: { rawText: "O L I V I A\nW I L S O N\nPR MANAGER", email: "olivia.wilson@domain.org" }, expected: "Olivia Wilson" },
  { label: "accented name", input: { rawText: "Élodie Dupont\nProduct Designer", email: "elodie.dupont@domain.fr" }, expected: "Élodie Dupont" },
  { label: "apostrophe and hyphen", input: { rawText: "Anne-Marie O'Neill\nConsultant", email: "anne.oneill@domain.ie" }, expected: "Anne-Marie O'Neill" },
  { label: "sidebar-first layout", input: { rawText: "LANGUAGES\nEnglish\nSKILLS\nSQL\nFRANCOIS MERCER\nMarketing Manager", aiName: "Francois Mercer" }, expected: "Francois Mercer" },
  { label: "generic placeholder rejected", input: { rawText: "Enter your full name\nJunior Data Scientist\nType your phone contact", aiName: "Creative Thinking" }, expected: "", confirm: true },
  { label: "section heading rejected", input: { rawText: "Executive Summary\nSenior Product Manager", aiName: "Executive Summary" }, expected: "", confirm: true },
  { label: "uncorroborated compact text is not guessed", input: { rawText: "D A N I M A R T I N E Z\nGRAPHIC DESIGNER", aiName: "Different Person" }, expected: "", confirm: true },
  { label: "filename corroboration", input: { rawText: "CONTACT\nphone@example.org\nALEXANDER CHEN\nEngineer", fileName: "Alexander_Chen_CV.pdf" }, expected: "Alexander Chen" },
];

let failed = 0;
for (const test of cases) {
  const result = determineCanonicalIdentity(test.input);
  const ok = result.selectedName === test.expected && (test.confirm === undefined || result.needsConfirmation === test.confirm);
  if (!ok) { failed++; console.error(`FAIL: ${test.label}`, { expected: test.expected, result }); }
  else console.log(`PASS: ${test.label} -> ${result.selectedName || "confirmation required"}`);
}
if (failed) process.exit(1);
console.log(`\nGlobal name extraction: ${cases.length}/${cases.length} passed.`);
