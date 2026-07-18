import assert from "node:assert/strict";
import {
  buildCanonicalResumeProfile,
  canonicalizeLanguages,
  readHeaderBelowName,
  resolveHeadline,
} from "../lib/workzoCvCanonicalBuilder";
import { resolveAuthoritativeCvName } from "../lib/workzoCvNameStage";
import type { ResumeProfile } from "../lib/workzoResumeParser";

function base(overrides: Partial<ResumeProfile> = {}): ResumeProfile {
  return {
    rawText: "",
    basics: { name: "", headline: "", email: "", phone: "", location: "", linkedin: "" },
    summary: "",
    experience: [],
    education: [],
    projects: [],
    skills: [],
    languages: [],
    certifications: [],
    strengths: [],
    additionalEvidence: [],
    warnings: [],
    previewText: "",
    ...overrides,
  };
}

// Location can never become a human identity.
const location = resolveAuthoritativeCvName({
  rawText: "CONTACT\n12345\nExampletown, Germany\nEDUCATION",
  parserName: "",
  fileName: "resume.pdf",
});
assert.equal(location.name, "");
assert.equal(location.needsConfirmation, true);

// An unsegmented decorative identity must never fall through to a later city.
// Without trustworthy boundary evidence, confirmation is safer than publishing
// a compact, potentially incorrect human name.
const decorative = resolveAuthoritativeCvName({
  rawText: "A L E X A N D E R M O R G A N\nI T S U P P O R T S P E C I A L I S T\nCONTACT\nExampletown, Germany",
  parserName: "Tools Platform",
  fileName: "resume.pdf",
});
assert.notEqual(decorative.name, "Exampletown, Germany");
assert.equal(decorative.source, "needs_confirmation");
assert.equal(decorative.needsConfirmation, true);

const forbidden = new Set<string>();
const title = resolveHeadline({
  headerBelowName: "I T S U P P O R T S P E C I A L I S T / D A T A A N A L Y S T",
  parserHeadline: "Project Management",
  summary: "Experienced professional with several years of experience.",
  forbidden,
});
assert.equal(title.headline, "IT Support Specialist / Data Analyst");
assert.equal(title.source, "header_below_name");

const title2 = resolveHeadline({
  headerBelowName: "S E N I O R P R O J E C T M A N A G E R",
  parserHeadline: "Senior Project Manager",
  summary: "A Senior Project Manager with ten years of experience.",
  forbidden,
});
assert.equal(title2.headline, "Senior Project Manager");

// Address below a valid name is skipped rather than promoted to headline.
assert.equal(
  readHeaderBelowName("Taylor Morgan\n123 Anywhere St., Any City\nPROFESSIONAL SUMMARY", "Taylor Morgan"),
  "",
);

// Invalid CEFR values are transparent, not falsely presented as valid CEFR.
assert.deepEqual(canonicalizeLanguages(["English - B4", "Arabic - Native"]), [
  "English (Unverified: B4)",
  "Arabic (Native)",
]);

const built = buildCanonicalResumeProfile({
  parsed: base({
    basics: {
      name: "Tools Platform",
      headline: "Project Management",
      email: "alexandermorgan@example.com",
      phone: "",
      location: "Exampletown, Germany",
      linkedin: "",
    },
    skills: ["Tools", "Platform", "Project Management"],
  }),
  rawText: "A L E X A N D E R M O R G A N\nI T S U P P O R T S P E C I A L I S T\nCONTACT\nExampletown, Germany",
  identityText: "A L E X A N D E R M O R G A N\nI T S U P P O R T S P E C I A L I S T\nCONTACT\nExampletown, Germany",
  fileName: "resume.pdf",
});
assert.notEqual(built.profile.basics.name, "Exampletown, Germany");
assert.equal(built.profile.basics.headline, "IT Support Specialist");

console.log("PASS remaining global CV invariants");
