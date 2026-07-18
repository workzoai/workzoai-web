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
  { title: "Engineer", company: "Acme", location: "", dates: "2020 - 2022", bullets: ["Built system."] },
  { title: "Senior Engineer", company: "Acme", location: "", dates: "2022 - Present", bullets: ["Led team."] },
  { title: "Engineer", company: "Acme", location: "", dates: "2020 - 2022", bullets: ["Built system.", "Improved uptime."] },
  { title: "", company: "Beta", location: "", dates: "2019", bullets: [] },
  { title: "Experience", company: "Gamma", location: "", dates: "2018", bullets: ["Supported users."] },
];
profile.education = [
  { degree: "BSc Computer Science", institution: "Example University", location: "", dates: "2014 - 2018" },
  { degree: "BSc Computer Science", institution: "Example University", location: "", dates: "2014 - 2018" },
  { degree: "BSc Computer Science", institution: "Other University", location: "", dates: "2014 - 2018" },
  { degree: "Certificate", institution: "", location: "", dates: "2024" },
];

const out = canonicalizeResumeProfileIntegrity(profile);
assert.equal(out.profile.experience.length, 4, "only one fully exact duplicate experience may merge");
assert.equal(out.profile.experience[0].bullets.length, 2, "exact duplicate bullets should merge without losing unique facts");
assert.equal(out.profile.experience[1].title, "Senior Engineer", "promotion must remain separate");
assert.equal(out.profile.experience[2].company, "Beta", "sparse employment row must remain");
assert.equal(out.profile.experience[3].company, "Gamma", "role-like section word with employment evidence must remain");
assert.equal(out.profile.education.length, 3, "only fully exact education duplicates may merge");
assert.equal(out.profile.education[1].institution, "Other University", "same degree at another institution must remain");
assert.equal(out.profile.education[2].degree, "Certificate", "sparse education row must remain");
assert.ok(out.warnings.includes("exact_duplicate_or_empty_experience_removed"));
console.log("PASS exact-only experience and education authority");
