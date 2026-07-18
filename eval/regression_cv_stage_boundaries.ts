import assert from "node:assert/strict";
import { resolveAuthoritativeCvName } from "../lib/workzoCvNameStage";

const cases = [
  {
    label: "ordinary top-line name",
    rawText: "Sophia Martinez\nSenior Product Manager • AI & SaaS Platforms\nExecutive Summary",
    parserName: "",
    expected: "Sophia Martinez",
  },
  {
    label: "decorative name with title",
    rawText: "H A R I T H A V I J A Y A K U M A R\nI T S U P P O R T S P E C I A L I S T\nCONTACT",
    parserName: "Harithavijayakumar Itsupport",
    fileName: "Haritha_ITSD.pdf",
    expected: "Haritha Vijayakumar",
  },
  {
    label: "sidebar-first candidate",
    rawText: "CONTACT\nSKILLS\nDigital Marketing\nEDUCATION\nSAMIRA HADID\nMARKETING MANAGER",
    parserName: "Samira Hadid",
    expected: "Samira Hadid",
  },
  {
    label: "placeholder remains blank",
    rawText: "Address, postal code, City\nYour full name\nJunior Data Scientist\nTechskills",
    parserName: "",
    expected: "",
  },
  {
    label: "skill cannot replace candidate",
    rawText: "D A N I E L G A L L E G O\nS E N I O R P R O J E C T M A N A G E R\nSKILLS\nStakeholder Engagement",
    parserName: "Daniel Gallego",
    expected: "Daniel Gallego",
  },
];

for (const item of cases) {
  const result = resolveAuthoritativeCvName({
    rawText: item.rawText,
    parserName: item.parserName,
    fileName: item.fileName || "",
  });
  assert.equal(result.name, item.expected, `${item.label}: ${result.name}`);
  console.log(`PASS ${item.label}: ${result.name || "<blank>"}`);
}
console.log(`Stage boundary name rules: ${cases.length}/${cases.length} passed.`);
