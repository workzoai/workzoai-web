import assert from "node:assert/strict";
import { buildCanonicalResumeProfile, canonicalizeLanguages } from "../lib/workzoCvCanonicalBuilder";
import type { ResumeProfile } from "../lib/workzoResumeParser";

function base(overrides: Partial<ResumeProfile> = {}): ResumeProfile {
  return {
    rawText: "",
    basics: { name: "", headline: "", email: "", phone: "", location: "", linkedin: "" },
    summary: "",
    experience: [], education: [], projects: [], skills: [], languages: [], certifications: [],
    strengths: [], additionalEvidence: [], warnings: [], previewText: "",
    ...overrides,
  };
}

// Ordinary header must override a contaminated parser name.
{
  const parsed = base({ basics: { name: "Key Projects", headline: "Senior Product Manager", email: "", phone: "", location: "", linkedin: "" } });
  const out = buildCanonicalResumeProfile({ parsed, rawText: "Sophia Martinez\nSenior Product Manager\nExecutive Summary", identityText: "Sophia Martinez\nSenior Product Manager\nExecutive Summary" });
  assert.equal(out.profile.basics.name, "Sophia Martinez");
  assert.equal(out.profile.basics.headline, "Senior Product Manager");
}

// Letter-spaced identity can use user-confirmed evidence without hardcoded rules.
{
  const parsed = base({ basics: { name: "Tableau Api", headline: "Project Management", email: "", phone: "", location: "", linkedin: "" }, skills: ["Tableau", "API", "Project Management"] });
  const text = "H A R I T H A V I J A Y A K U M A R\nI T S U P P O R T S P E C I A L I S T\nC O N T A C T";
  const out = buildCanonicalResumeProfile({ parsed, rawText: text, identityText: text, candidateName: "Haritha Vijayakumar" });
  assert.equal(out.profile.basics.name, "Haritha Vijayakumar");
  assert.notEqual(out.profile.basics.headline, "Project Management");
}

// Split-line name and title below it.
{
  const parsed = base({ basics: { name: "", headline: "Borcelle", email: "", phone: "", location: "", linkedin: "" }, experience: [{ title: "Marketing Manager", company: "Borcelle", location: "", dates: "", bullets: [] }] });
  const text = "ADELINE\nPALMERSTON\nENGLISH TEACHER\nABOUT ME";
  const out = buildCanonicalResumeProfile({ parsed, rawText: text, identityText: text });
  assert.equal(out.profile.basics.name, "Adeline Palmerston");
  // This case asserts that the title is read from BELOW the name. It previously
  // also snapshotted the template's ALL-CAPS typesetting; headlines are now
  // re-cased once, centrally (normalizeHeadlineCasing). The invariant under test
  // is unchanged.
  assert.equal(out.profile.basics.headline, "English Teacher");
}

// Language contamination must be removed, distinct languages preserved.
{
  const langs = canonicalizeLanguages([
    "English (Fluent) Estelle Darcy Harper Richard",
    "French (Fluent) Wardiere Inc. / CTO",
    "German (Basics) Phone: 123-456-7890",
    "Spanish (Intermediate) Email: hello@example.com",
    "English - Fluent",
  ]);
  assert.deepEqual(langs, ["English (Fluent)", "French (Fluent)", "German (Basics)", "Spanish (Intermediate)"]);
}

console.log("PASS global identity/headline/language invariants");
