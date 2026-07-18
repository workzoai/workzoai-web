import assert from "node:assert/strict";
import {
  canonicalizeExperience,
  canonicalizeLanguages,
  resolveHeadline,
} from "../lib/workzoCvCanonicalBuilder";
import { resolveAuthoritativeCvName } from "../lib/workzoCvNameStage";

const exp = [
  { title: "Consultant", company: "Acme", location: "", dates: "2020-2021", bullets: [] },
  { title: "Consultant", company: "Acme", location: "", dates: "2020-2021", bullets: [] },
];
assert.equal(canonicalizeExperience(exp).length, 2, "parser-owned experience rows must be preserved");

assert.deepEqual(canonicalizeLanguages(["Germany - basic", "Arabic - basic"]), ["German (Basic)", "Arabic (Basic)"]);

const headline = resolveHeadline({
  parserHeadline: "Commercial Agent",
  summary: "",
  forbidden: new Set(),
});
assert.equal(headline.headline, "Commercial Agent");

const unsafe = resolveAuthoritativeCvName({
  rawText: "H A R I T H A V I J A Y A K U M A R\nWürzburg, Germany /in/exampleprofile\nCONTACT",
  parserName: "English Fluent",
  fileName: "resume.pdf",
  email: "",
});
assert.equal(unsafe.name, "", "location/URL fallback must never become the candidate name");
assert.equal(unsafe.needsConfirmation, true);

console.log("PASS final four global CV invariants");
