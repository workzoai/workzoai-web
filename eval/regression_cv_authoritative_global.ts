import assert from "node:assert/strict";
import { resolveAuthoritativeCvName } from "../lib/workzoCvNameStage";
import { buildCanonicalProfile } from "../lib/workzoCanonicalProfile";

const genericNames = [
  "Maya Iyer", "Luca Moretti", "Ana María López", "Jean-Luc Moreau",
  "O'Neil Carter", "Sven van Dijk", "Noura Al-Hassan", "Li Wei",
];

for (const name of genericNames) {
  const result = resolveAuthoritativeCvName({
    rawText: `${name}\nSenior Platform Engineer\nBerlin, Germany\nProfessional Summary\n...`,
    parserName: "",
    currentName: "",
    fileName: "resume.pdf",
  });
  assert.equal(result.name, name, `ordinary header failed for ${name}`);
  assert.equal(result.needsConfirmation, false);
}

const spaced = resolveAuthoritativeCvName({
  rawText: "H A R I T H A  V I J A Y A K U M A R\nI T  S U P P O R T  S P E C I A L I S T\nCONTACT",
  parserName: "",
  currentName: "Haritha Vijayakumar",
  fileName: "HTS.pdf",
});
assert.equal(spaced.name, "Haritha Vijayakumar");

const split = resolveAuthoritativeCvName({
  rawText: "O L I V I A\nW I L S O N\nPR MANAGER\nPROFILE",
  parserName: "Olivia Wilson",
  fileName: "resume.pdf",
});
assert.equal(split.name, "Olivia Wilson");

for (const bad of [
  "Seaborn", "ProfileSummary", "Core Competencies", "Enterprise Analytics Dashboard",
  "LinkedIn.com/in/example", "Project Management", "Stakeholder Engagement",
]) {
  const result = resolveAuthoritativeCvName({
    rawText: `${bad}\nSkills\nPython\nSQL`,
    parserName: "",
    currentName: "",
    fileName: "template.pdf",
  });
  assert.equal(result.name, "", `false positive accepted: ${bad}`);
  assert.equal(result.needsConfirmation, true);
}

const authoritative = buildCanonicalProfile({
  profile: {
    basics: {
      name: "Zola Bekker",
      headline: "Marketing Strategist",
      email: "zola@example.com",
      phone: "",
      location: "",
      linkedin: "",
    },
    experience: [{ title: "Strategist", company: "Example", dates: "2020-present", bullets: [] }],
    education: [],
    projects: [],
    skills: [],
    languages: [],
    certifications: [],
    summary: "Experienced marketing strategist with a strong record of delivery.",
    identityAuthoritative: true,
    headlineAuthoritative: true,
    identityNeedsConfirmation: false,
    identityConfidence: 0.995,
    selectedNameSource: "stage1:top_header",
  } as any,
  rawText: "Contact\nZola Bekker Phone: +49 123456789\nMARKETING STRATEGIST",
  fileName: "generic-resume.pdf",
});
assert(authoritative);
assert.equal(authoritative.basics.name, "Zola Bekker");
assert.equal(authoritative.basics.headline, "Marketing Strategist");

console.log(`PASS global authoritative CV boundaries: ${genericNames.length + 10} assertions groups`);
