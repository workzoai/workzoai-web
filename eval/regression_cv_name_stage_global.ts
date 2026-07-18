import { strict as assert } from "node:assert";
import { determineCanonicalIdentity } from "../lib/workzoCvIdentityEngine";

const cases = [
  {
    label: "normal first-line name",
    input: { rawText: "Sophia Martinez\nSenior Product Manager\nExecutive Summary\n...", fileName: "professional_resume.pdf" },
    expected: "Sophia Martinez",
  },
  {
    label: "letter-spaced name",
    input: { rawText: "H A R I T H A V I J A Y A K U M A R\nI T S U P P O R T S P E C I A L I S T\nCONTACT", email: "harithavijayakumar@example.com" },
    expected: "Haritha Vijayakumar",
  },
  {
    label: "split-line name",
    input: { rawText: "OLIVIA\nWILSON\nPR MANAGER\nPROFILE" },
    expected: "Olivia Wilson",
  },
  {
    label: "placeholder template stays blank",
    input: { rawText: "Address, postal code, City\nYour full name\nuser@example.com\nJunior Data Scientist\nYour phone contact" },
    expected: "",
  },
  {
    label: "section heading stays blank",
    input: { rawText: "Executive Summary\nStrategic product leader with eight years of experience" },
    expected: "",
  },
];

for (const test of cases) {
  const result = determineCanonicalIdentity(test.input);
  assert.equal(result.selectedName, test.expected, `${test.label}: ${JSON.stringify(result)}`);
}
console.log(`Global name extraction: ${cases.length}/${cases.length} passed.`);
