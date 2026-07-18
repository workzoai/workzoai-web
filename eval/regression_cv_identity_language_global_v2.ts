import assert from "node:assert/strict";
import {
  canonicalizeLanguages,
  readHeaderBelowName,
  resolveHeadline,
} from "../lib/workzoCvCanonicalBuilder";
import { resolveAuthoritativeCvName } from "../lib/workzoCvNameStage";

const languageCases = [
  {
    input: [
      "English (Fluent) Estelle Darcy Harper Richard",
      "French (Fluent) Wardiere Inc. / CTO Wardiere Inc. / CEO",
      "German (Basics) Phone: 123-456-7890",
      "Spanish (Intermediate) Email: person@example.com",
      "English - Fluent",
      "French - Fluent",
      "Spanish - Intermediate",
    ],
    expected: ["English (Fluent)", "French (Fluent)", "German (Basics)", "Spanish (Intermediate)"],
  },
  {
    input: ["English (Fluent) - German (Intermediate) - Spanish (Native)"],
    expected: ["English (Fluent)", "German (Intermediate)", "Spanish (Native)"],
  },
  {
    input: ["Deutsch - B2", "English - C1", "Deutsch (Konversationsniveau)"],
    expected: ["German (B2)", "English (C1)"],
  },
];

for (const test of languageCases) assert.deepEqual(canonicalizeLanguages(test.input), test.expected);

const headerName = resolveAuthoritativeCvName({
  rawText: "MARCELINE ANDERSON\nGRAPHIC DESIGNER\nPROFILE SUMMARY",
  parserName: "Design Tools",
});
assert.equal(headerName.name, "Marceline Anderson");

const decorativeName = resolveAuthoritativeCvName({
  rawText: "H A R I T H A V I J A Y A K U M A R\nI T S U P P O R T S P E C I A L I S T",
  parserName: "Tools Ticketing-systeme",
  currentName: "Haritha Vijayakumar",
});
assert.equal(decorativeName.name, "Haritha Vijayakumar");

assert.equal(
  resolveHeadline({
    headerBelowName: "M A R K E T I N G",
    parserHeadline: "Marketing Manager",
    forbidden: new Set(),
  }).headline,
  "Marketing Manager",
);

assert.equal(
  readHeaderBelowName("ALICE MILANI\nI T P R O J E C T M A N A G E R\nCONTACTS", "Alice Milani"),
  "IT Project Manager",
);

assert.equal(
  resolveHeadline({
    headerBelowName: "123 Anywhere St., Any City",
    parserHeadline: "Worked with small and large teams in several",
    summary: "A tech-savvy individual seeking a developer role.",
    forbidden: new Set(),
  }).headline,
  "",
);

console.log("PASS global identity/headline/language invariants");
