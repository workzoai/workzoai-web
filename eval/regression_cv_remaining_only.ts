import assert from "node:assert/strict";
import { canonicalizeLanguages } from "../lib/workzoCvCanonicalBuilder";
import { resolveAuthoritativeCvName } from "../lib/workzoCvNameStage";
import { validateCanonicalProfile } from "../lib/workzoCvValidator";
import type { ResumeProfile } from "../lib/workzoResumeParser";

const langs = canonicalizeLanguages([
  "French (Fluent) Wardiere Inc. / CTO Wardiere Inc. / CEO",
  "French - Fluent",
  "Deutsch - FLIESSEND",
  "Deutsch - Konversationsniveau",
  "English - B4",
]);
assert.deepEqual(langs, ["French (Fluent)", "German (Fluent)", "English (Unverified: B4)"]);

const unresolved = resolveAuthoritativeCvName({
  rawText: "H A R I T H A V I J A Y A K U M A R\nI T S U P P O R T S P E C I A L I S T",
  parserName: "English Fluent",
  fileName: "HTS.pdf",
  email: "harithavijayakumar30@example.com",
});
assert.equal(unresolved.name, "");
assert.equal(unresolved.needsConfirmation, true);

const profile = {
  rawText: "",
  basics: { name: "A Candidate", headline: "Marketing Manager", email: "", phone: "", location: "", linkedin: "" },
  summary: "",
  experience: [], education: [], projects: [], skills: [],
  languages: ["French (Fluent)"], certifications: [], strengths: [], additionalEvidence: [], previewText: "", warnings: [],
} as ResumeProfile;
const parsed = { ...profile, languages: ["French (Fluent) Wardiere Inc. / CTO Wardiere Inc. / CEO", "French - Fluent"] } as ResumeProfile;
const validation = validateCanonicalProfile({ parsed, final: profile, rawText: "" });
assert.equal(
  validation.ok,
  true,
  JSON.stringify(validation.violations ?? validation, null, 2),
);
console.log("PASS remaining-only global invariants");
