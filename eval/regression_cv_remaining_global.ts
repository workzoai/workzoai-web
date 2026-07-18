import assert from "node:assert/strict";
import { buildCanonicalResumeProfile } from "../lib/workzoCvCanonicalBuilder";
import type { ResumeProfile } from "../lib/workzoResumeParser";

function base(overrides: Partial<ResumeProfile> = {}): ResumeProfile {
  const profile: ResumeProfile = {
    rawText: "",
    basics: { name: "", headline: "", email: "", phone: "", location: "", linkedin: "" },
    summary: "",
    experience: [], education: [], projects: [], skills: [], languages: [], certifications: [],
    strengths: [], additionalEvidence: [], warnings: [], previewText: "",
  };
  Object.assign(profile, overrides);
  profile.basics = { name: "", headline: "", email: "", phone: "", location: "", linkedin: "", ...(overrides.basics || {}) };
  return profile;
}

// Generic structural cases: no production filenames or expected-person lookup tables.
{
  const rawText = "S O P H I A M A R T I N E Z\nS E N I O R P R O D U C T M A N A G E R\nCONTACT";
  const parsed = base({ basics: { name: "Key Projects", headline: "Senior Product Manager", email: "sophia.martinez@example.com", phone: "", location: "", linkedin: "" }, skills: ["Product Strategy"] });
  const out = buildCanonicalResumeProfile({ parsed, rawText });
  assert.equal(out.profile.basics.name, "Sophia Martinez");
  assert.equal(out.profile.basics.headline, "Senior Product Manager");
}

{
  const rawText = "A D E L I N E\nP A L M E R S T O N\nE N G L I S H T E A C H E R\nABOUT ME";
  const parsed = base({ basics: { name: "Borcelle", headline: "Borcelle", email: "adeline.palmerston@example.com", phone: "", location: "", linkedin: "" }, experience: [{ title: "Marketing Manager", company: "Borcelle", location: "", dates: "", bullets: [] }] });
  const out = buildCanonicalResumeProfile({ parsed, rawText });
  assert.equal(out.profile.basics.name, "Adeline Palmerston");
  assert.equal(out.profile.basics.headline, "English Teacher");
}

{
  const rawText = "D A N I M A R T I N E Z\nG R A P H I C D E S I G N E R\nREFERENCES\nArowwai Industries";
  const parsed = base({ basics: { name: "Arowwai Industries", headline: "Graphic Designer", email: "dani.martinez@example.com", phone: "", location: "", linkedin: "" }, experience: [{ title: "Designer", company: "Arowwai Industries", location: "", dates: "", bullets: [] }] });
  const out = buildCanonicalResumeProfile({ parsed, rawText });
  assert.equal(out.profile.basics.name, "Dani Martinez");
  assert.equal(out.profile.basics.headline, "Graphic Designer");
}

{
  const rawText = "EMILY RICHARDSON\nSenior Data & AI Consultant\nCONTACT EXECUTIVE SUMMARY";
  const parsed = base({ basics: { name: "Emily Richardson", headline: "Senior Data & AI Consultant", email: "", phone: "", location: "", linkedin: "" }, languages: ["English (Native) - Built platform.", "German (B2) - Improved accuracy.", "French - Intermediate"] });
  const out = buildCanonicalResumeProfile({ parsed, rawText });
  assert.equal(out.profile.basics.headline, "Senior Data & AI Consultant");
  assert.deepEqual(out.profile.languages, ["English (Native)", "German (B2)", "French (Intermediate)"]);
}

console.log("PASS remaining global identity/headline/language invariants");
