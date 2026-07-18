import { resolveAuthoritativeCvName } from "../lib/workzoCvNameStage";
import { canonicalizeResumeProfileIntegrity } from "../lib/workzoCvCanonicalIntegrity";

function check(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
  console.log(`PASS ${label}`);
}

const ordinary = resolveAuthoritativeCvName({
  rawText: "Sophia Martinez\nSenior Product Manager\nMunich, Germany",
  parserName: "",
  fileName: "advanced_professional_resume.pdf",
  email: "sophia.martinez@example.com",
});
check("ordinary first-line name", ordinary.name, "Sophia Martinez");

const decorative = resolveAuthoritativeCvName({
  rawText: "H A R I T H A V I J A Y A K U M A R\nI T S U P P O R T S P E C I A L I S T\nC O N T A C T",
  parserName: "Harithavijayakumar Itsupport",
  fileName: "Haritha_ITSD.pdf",
  email: "harithavijayakumar30@example.com",
});
check("decorative name rejects joined role", decorative.name, "Haritha Vijayakumar");

const template = resolveAuthoritativeCvName({
  rawText: "Address, postal code, City\nYour full name\nJunior Data Scientist\nTECHSKILLS\nMatplotlib\nSeaborn",
  parserName: "",
  fileName: "CV Template.pdf",
});
check("template stays blank", template.name, "");
check("template needs confirmation", template.needsConfirmation, true);

const url = resolveAuthoritativeCvName({
  rawText: "H A R I T H A V I J A Y A K U M A R\nI T S U P P O R T S P E C I A L I S T\nLinkedIn.com/in/harithavijayakumar30",
  parserName: "",
  fileName: "Haritha_ITSD.pdf",
  email: "harithavijayakumar30@example.com",
});
check("URL never becomes name", url.name, "Haritha Vijayakumar");

const profile: any = {
  basics: { name: "A Person", headline: "Engineer", email: "", phone: "", location: "", linkedin: "" },
  summary: "",
  experience: [
    { title: "Engineer", company: "Acme", dates: "2020-2021", bullets: ["A"] },
    { title: "Engineer", company: "Acme", dates: "2021-2022", bullets: ["B"] },
    { title: "Engineer", company: "Acme", dates: "2020-2021", bullets: ["A"] },
  ],
  education: [], projects: [], skills: [], languages: [], certifications: [], warnings: [],
};
const repaired = canonicalizeResumeProfileIntegrity(profile).profile;
check("only exact experience duplicate removed", repaired.experience.length, 2);
check("different dates preserved", repaired.experience.map((x: any) => x.dates), ["2020-2021", "2021-2022"]);

console.log("Global CV boundary v2: all passed.");
