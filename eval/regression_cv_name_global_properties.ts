import { resolveAuthoritativeCvName } from "@/lib/workzoCvNameStage";

function assertEqual(label: string, actual: string, expected: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function spaced(value: string): string {
  return value.toUpperCase().split("").join(" ");
}

// Generated corpus: production code never sees these values. The purpose is to
// test rules across many combinations, not to whitelist any real CV sample.
const firstParts = ["Ari", "Mila", "Noel", "Lina", "Omar", "Nora", "Ivo", "Maya", "Theo", "Zara"];
const lastParts = ["Bennet", "Costa", "Dubois", "Evans", "Farah", "Garcia", "Hoffmann", "Ivanov", "Jensen", "Khan"];
let passed = 0;

for (const first of firstParts) {
  for (const last of lastParts) {
    const name = `${first} ${last}`;

    const ordinary = resolveAuthoritativeCvName({
      rawText: `${name}\nSenior Platform Engineer\nemail@example.com\nProfessional Summary\n...`,
      parserName: "",
      fileName: "resume.pdf",
      email: "email@example.com",
    });
    assertEqual(`ordinary ${name}`, ordinary.name, name);
    passed += 1;

    const parserPreserved = resolveAuthoritativeCvName({
      rawText: `SKILLS\nPython\nProject Management\n${name}\nProduct Designer`,
      parserName: name,
      fileName: "untitled.pdf",
    });
    assertEqual(`parser preserved ${name}`, parserPreserved.name, name);
    passed += 1;

    const decorative = resolveAuthoritativeCvName({
      rawText: `${spaced(name)}\n${spaced("DATA ANALYST")}\nCONTACT`,
      parserName: name,
      fileName: "cv.pdf",
    });
    assertEqual(`decorative ${name}`, decorative.name, name);
    passed += 1;
  }
}

const adversarial = [
  "Professional Summary", "Core Competencies", "Project Management", "Seaborn",
  "Stakeholder Engagement", "Enterprise Analytics Dashboard", "Your Full Name",
  "ProfileSummary", "TechSkills", "Junior Customer Success Manager",
];
for (const noise of adversarial) {
  const result = resolveAuthoritativeCvName({
    rawText: `CONTACT\n${noise}\nSKILLS\nPython\nSQL\nEXPERIENCE`,
    parserName: "",
    currentName: "",
    fileName: "template.pdf",
    email: "",
  });
  assertEqual(`reject ${noise}`, result.name, "");
  passed += 1;
}

console.log(`Global property-based name stage: ${passed}/${passed} passed.`);
