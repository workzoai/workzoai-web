import assert from "node:assert/strict";
import { resolveAuthoritativeCvName } from "../lib/workzoCvNameStage";
import { resolveHeadline } from "../lib/workzoCvCanonicalBuilder";

const decorative = resolveAuthoritativeCvName({
  rawText: [
    "H A R I T H A V I J A Y A K U M A R",
    "I T - S U P P O R T - S P E Z I A L I S T",
    "linkedin.com/in/harithavijayakumar30",
  ].join("\n"),
  parserName: "Tools Ticketing-systeme",
  fileName: "CSM-DEU.pdf",
});
assert.equal(decorative.name, "Haritha Vijayakumar");
assert.equal(decorative.needsConfirmation, false);

const commercial = resolveHeadline({
  parserHeadline: "COMMERCIALAGENT",
  forbidden: new Set<string>(),
});
assert.equal(commercial.headline, "Commercial Agent");

const accounting = resolveHeadline({
  parserHeadline: "ACCOUNTINGEXECUTIVE",
  forbidden: new Set<string>(),
});
assert.equal(accounting.headline, "Accounting Executive");

console.log("PASS final CV identity/headline integration invariants");
