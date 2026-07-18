import { resolveAuthoritativeCvName } from "@/lib/workzoCvNameStage";

const cases = [
  {
    label: "ordinary top-line name",
    rawText: `Sophia Martinez\nSenior Product Manager • AI & SaaS Platforms\nMunich, Germany • sophia.martinez@example.com\nExecutive Summary`,
    parserName: "",
    fileName: "advanced_professional_resume.pdf",
    email: "sophia.martinez@example.com",
    expected: "Sophia Martinez",
  },
  {
    label: "decorative name with contaminated parser",
    rawText: `H A R I T H A V I J A Y A K U M A R\nI T S U P P O R T S P E C I A L I S T\nC O N T A C T\nharithavijayakumar30@gmail.com`,
    parserName: "Harithavijayakumar Itsupport",
    fileName: "Haritha_ITSD.pdf",
    email: "harithavijayakumar30@gmail.com",
    expected: "Haritha Vijayakumar",
  },
  {
    label: "valid parser name wins over compact role",
    rawText: `H A R I T H A V I J A Y A K U M A R\nJ U N I O R C U S T O M E R S U C C E S S M A N A G E R\nC O N T A C T`,
    parserName: "Haritha Vijayakumar",
    fileName: "Haritha VijaYAKUMAR.pdf",
    email: "harithavijayakumar30@gmail.com",
    expected: "Haritha Vijayakumar",
  },
  {
    label: "template remains blank",
    rawText: `Address, postal code, City\nYour full name\nhello@reallygreatsite.com\nJunior Data Scientist\nYour phone contact\nTECHSKILLS\nMatplotlib\nSeaborn\nTableau`,
    parserName: "",
    fileName: "Copy of CV - DATA Template.pdf",
    email: "hello@reallygreatsite.com",
    expected: "",
  },
  {
    label: "split-line name",
    rawText: `O L I V I A\n+49 123456789\nW I L S O N olivia.wilson@example.com\nPR MANAGER 123 Anywhere St., Any City`,
    parserName: "Olivia Wilson",
    fileName: "Untitled design.pdf",
    email: "olivia.wilson@example.com",
    expected: "Olivia Wilson",
  },
];

let passed = 0;
for (const item of cases) {
  const result = resolveAuthoritativeCvName(item);
  if (result.name !== item.expected) {
    throw new Error(`${item.label}: expected ${JSON.stringify(item.expected)}, got ${JSON.stringify(result.name)} (${result.source})`);
  }
  console.log(`PASS ${item.label}: ${result.name || "<blank>"}`);
  passed += 1;
}
console.log(`Real failure corpus name stage: ${passed}/${cases.length} passed.`);
