import assert from "node:assert/strict";
import { resolveAuthoritativeCvName } from "../lib/workzoCvNameStage";

const cases = [
  {
    label: "ordinary top header",
    input: { rawText: "Sophia Martinez\nSenior Product Manager\nMunich, Germany", parserName: "", fileName: "advanced_professional_resume.pdf" },
    expected: "Sophia Martinez",
  },
  {
    label: "letter-spaced with filename evidence",
    input: { rawText: "H A R I T H A V I J A Y A K U M A R\nI T S U P P O R T S P E C I A L I S T", parserName: "", fileName: "Haritha_ITSD.pdf", email: "harithavijayakumar30@example.com" },
    expected: "Haritha Vijayakumar",
  },
  {
    label: "split-line name",
    input: { rawText: "ADELINE\nPALMERSTON\nENGLISH TEACHER", parserName: "", fileName: "resume.pdf" },
    expected: "Adeline Palmerston",
  },
  {
    label: "sidebar-first parser evidence preserved",
    input: { rawText: "LANGUAGES\nEnglish\nSKILLS\nDesign\nFRANCOIS MERCER\nMarketing Manager", parserName: "Francois Mercer", fileName: "untitled.pdf" },
    expected: "Francois Mercer",
  },
  {
    label: "valid parser name cannot be overwritten by skill",
    input: { rawText: "SKILLS\nProblem Solving\nEDUCATION\nCollege\nJAMIE\nCHASTAIN\nPROJECT MANAGER", parserName: "Jamie Chastain", fileName: "resume.pdf" },
    expected: "Jamie Chastain",
  },
  {
    label: "placeholder template remains blank",
    input: { rawText: "Address, postal code, City\nYour full name\nuser@example.com\nJunior Data Scientist\nYour phone contact", parserName: "", fileName: "CV Template.pdf" },
    expected: "",
  },
  {
    label: "section heading rejected",
    input: { rawText: "Executive Summary\nStrategic product leader", parserName: "Executive Summary", fileName: "resume.pdf" },
    expected: "",
  },
  {
    label: "reference name cannot replace candidate",
    input: { rawText: "DANI MARTINEZ\nGRAPHIC DESIGNER\nREFERENCES\nEstelle Darcy\nCEO", parserName: "Dani Martinez", fileName: "resume.pdf" },
    expected: "Dani Martinez",
  },
];

for (const test of cases) {
  const result = resolveAuthoritativeCvName(test.input);
  assert.equal(result.name, test.expected, `${test.label}: ${JSON.stringify(result)}`);
  console.log(`PASS ${test.label}: ${result.name || "<blank>"}`);
}
console.log(`Global rule-based name stage: ${cases.length}/${cases.length} passed.`);
