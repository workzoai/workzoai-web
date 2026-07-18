import { determineCanonicalIdentity } from "../lib/workzoCvIdentityEngine";

const cases = [
  {
    label: "ordinary top-line name",
    expected: "Sophia Martinez",
    input: { aiName: "", rawText: "Sophia Martinez\nSenior Product Manager • AI & SaaS Platforms\nExecutive Summary\nStrategic leader" },
  },
  {
    label: "sidebar-first name",
    expected: "Samira Hadid",
    input: { aiName: "Samira Hadid", rawText: "CONTACT\nemail@example.com\nEXPERTISE\nDigital Marketing\nEDUCATION\nBachelor of Science\n\nSAMIRA HADID\nMARKETING SPECIALIST\nPROFILE\nResults-driven marketer" },
  },
  {
    label: "decorative full name with filename prefix",
    expected: "Haritha Vijayakumar",
    input: { aiName: "Harithavijayakumar Itsupport", fileName: "Haritha_ITSD.pdf", rawText: "H A R I T H A V I J A Y A K U M A R\nI T S U P P O R T S P E C I A L I S T\nC O N T A C T\n" },
  },
  {
    label: "reference person does not override real candidate",
    expected: "Dani Martinez",
    input: { aiName: "Harper Russo", email: "dani.martinez@example.com", rawText: "D A N I M A R T I N E Z\nG R A P H I C D E S I G N E R\nSKILLS\nCreativity\nREFERENCES\nHarper Russo\nWardiere Inc. / CEO\nPhone: 123456789" },
  },
  {
    label: "template placeholder remains blank",
    expected: "",
    input: { aiName: "", rawText: "Address, postal code, City\nYour full name\nJunior Data Scientist\nYour phone contact" },
  },
];

let failed = 0;
for (const test of cases) {
  const result = determineCanonicalIdentity(test.input);
  if (result.selectedName !== test.expected) {
    failed++;
    console.error(`FAIL ${test.label}: expected=${test.expected} actual=${result.selectedName}`, result);
  } else console.log(`PASS ${test.label}: ${result.selectedName || "<blank>"}`);
}
if (failed) process.exit(1);
console.log(`Remaining global name cases: ${cases.length}/${cases.length} passed.`);
