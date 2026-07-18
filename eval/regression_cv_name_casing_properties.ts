import assert from "node:assert/strict";
import { resolveAuthoritativeCvName } from "../lib/workzoCvNameStage";

function resolve(rawText: string, parserName = "") {
  return resolveAuthoritativeCvName({ rawText, parserName, fileName: "resume.pdf", email: "" }).name;
}

// Property 1: trustworthy mixed casing must survive unchanged.
const mixedCaseNames = [
  "Sven van Dijk",
  "Ana de la Cruz",
  "Mary McDonald",
  "Jean-Luc Moreau",
  "Noura al-Hassan",
  "D'Arcy O'Neill",
];
for (const name of mixedCaseNames) {
  assert.equal(resolve(`${name}\nSoftware Engineer`), name);
}

// Property 2: uniform-case OCR output is normalized, without any person lookup.
const uniformCases: Array<[string, string]> = [
  ["SVEN VAN DIJK", "Sven van Dijk"],
  ["ANA DE LA CRUZ", "Ana de la Cruz"],
  ["JEAN-LUC MOREAU", "Jean-Luc Moreau"],
  ["NOURA AL-HASSAN", "Noura al-Hassan"],
];
for (const [raw, expected] of uniformCases) {
  assert.equal(resolve(`${raw}\nSoftware Engineer`), expected);
}

// Property 3: varying arbitrary first/last names follow the same rule.
const firstNames = ["Amina", "Luca", "Mei", "Noah", "Priya"];
const lastNames = ["Keller", "Rossi", "Chen", "Okafor", "Iyer"];
for (const first of firstNames) {
  for (const last of lastNames) {
    const expected = `${first} ${last}`;
    assert.equal(resolve(`${expected.toUpperCase()}\nData Analyst`), expected);
  }
}

console.log("Global name-casing properties passed.");
