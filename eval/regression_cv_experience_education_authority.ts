import assert from "node:assert/strict";
import { canonicalizeResumeProfileIntegrity } from "../lib/workzoCvCanonicalIntegrity";
import type { ResumeProfile } from "../lib/workzoResumeParser";

const base = (): ResumeProfile => ({
  rawText: "",
  basics: { name: "Test Candidate", headline: "", email: "", phone: "", location: "", linkedin: "" },
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
});

const profile = base();
profile.experience = [
  { title: "Engineer", company: "Acme", location: "Berlin", dates: "2020 - 2022", bullets: ["Built systems"] },
  { title: "Senior Engineer", company: "Acme", location: "Berlin", dates: "2022 - Present", bullets: ["Led systems"] },
  { title: "Engineer", company: "Acme", location: "Berlin", dates: "2020 - 2022", bullets: ["Built systems", "Supported users"] },
  { title: "Engineer", company: "", location: "", dates: "2020 - 2022", bullets: [] },
];
profile.education = [
  { degree: "MSc Data Science", institution: "Example University", location: "Berlin", dates: "2022 - 2024" },
  { degree: "MSc Data Science", institution: "Example University", location: "Berlin", dates: "2022 - 2024" },
  { degree: "MSc Data Science", institution: "Other University", location: "Munich", dates: "2022 - 2024" },
  { degree: "MSc Data Science", institution: "Example University", location: "Berlin", dates: "" },
];

const out = canonicalizeResumeProfileIntegrity(profile).profile;
assert.equal(out.experience.length, 3, "only the exact complete duplicate may merge");
assert.equal(out.experience[0].bullets.length, 2, "exact duplicate bullets should merge losslessly");
assert.equal(out.experience[1].title, "Senior Engineer", "promotion must remain separate");
assert.equal(out.experience[2].company, "", "sparse row must remain separate");
assert.equal(out.education.length, 3, "only exact complete education duplicate may be removed");
assert.equal(out.education[1].institution, "Other University", "different institution must remain separate");
assert.equal(out.education[2].dates, "", "sparse education row must remain separate");
console.log("PASS global experience/education authority invariants");
