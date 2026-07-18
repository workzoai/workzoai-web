import assert from "node:assert/strict";
import { resolveHeadline, canonicalizeExperience, canonicalizeEducation } from "../lib/workzoCvCanonicalBuilder";

const forbidden = new Set<string>();

function headline(headerBelowName: string, parserHeadline: string, summary = "") {
  return resolveHeadline({ headerBelowName, parserHeadline, summary, forbidden }).headline;
}

assert.equal(headline("S E N I O R P R O J E C T M A N A G E R", "Senior Project Manager"), "Senior Project Manager");
assert.equal(headline("M a r k e t i n g M a n a g e r", "Marketing Manager"), "Marketing Manager");
assert.equal(headline("Würzburg, Germany", "Product Design Engineer"), "Product Design Engineer");
assert.equal(headline("123 Anywhere St., Any City", "Worked with small and large teams in several"), "");
assert.equal(headline("CONCEPT DEVELOPMENT", "Visual Designer Creative Director"), "Visual Designer Creative Director");
assert.equal(headline("Results-driven Accounting Executive with a proven record of", "Accounting Executive, Borcelle"), "Accounting Executive, Borcelle");

const exp = [{ title: "Engineer", company: "A", location: "", dates: "2020 - 2021", bullets: [] }];
const edu = [{ degree: "BSc", institution: "U", location: "", dates: "2015 - 2018" }];
assert.deepEqual(canonicalizeExperience(exp), exp);
assert.deepEqual(canonicalizeEducation(edu), edu);
console.log("PASS remaining headline/cache safety invariants");
