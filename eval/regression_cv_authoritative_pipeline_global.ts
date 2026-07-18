import assert from "node:assert/strict";
import { resolveAuthoritativeCvName } from "../lib/workzoCvNameStage";

const ordinaryNames = [
  "Sophia Martinez", "Sven van Dijk", "Ana de la Cruz", "Jean-Luc Moreau", "D'Arcy O'Neill",
];
for (const name of ordinaryNames) {
  const out = resolveAuthoritativeCvName({ rawText: `${name}\nSenior Product Manager\nSummary`, parserName: "" });
  assert.equal(out.name, name, `ordinary header failed: ${name}`);
}

const decorative = resolveAuthoritativeCvName({
  rawText: "H A R I T H A V I J A Y A K U M A R\nI T S U P P O R T S P E C I A L I S T\nC O N T A C T",
  parserName: "Harithavijayakumar Itsupport",
  currentName: "Haritha Vijayakumar",
});
assert.equal(decorative.name, "Haritha Vijayakumar");

const bodyFalsePositive = resolveAuthoritativeCvName({
  rawText: "CONTACT\nemail@example.com\nSKILLS\nSeaborn\nPROJECTS\nEnterprise Analytics Dashboard",
  parserName: "",
  currentName: "",
});
assert.equal(bodyFalsePositive.name, "");
assert.equal(bodyFalsePositive.needsConfirmation, true);

const template = resolveAuthoritativeCvName({
  rawText: "Address, postal code, City\nYour full name\nJunior Data Scientist\nTECH SKILLS\nPython",
});
assert.equal(template.name, "");

console.log("Authoritative global pipeline regression passed.");
