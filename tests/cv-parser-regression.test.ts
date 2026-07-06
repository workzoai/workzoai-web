/**
 * CV parser / finalizer regression suite.
 *
 * These tests target the deterministic finalizer (workzoCvGlobalFinalizer),
 * which is now the single authoritative identity/structure layer for every CV.
 * They assert the global invariants from the pipeline restructure spec without
 * needing network, an LLM, or real PDF fixtures, so they run in CI in
 * milliseconds and lock in the "stop corruption" acceptance criteria.
 *
 * Runner: works under Vitest or Jest using globals (describe/it/expect). For
 * Vitest set `test: { globals: true }` in vitest.config; Jest provides globals
 * by default. Switch the import to "@/lib/workzoCvGlobalFinalizer" if your test
 * runner resolves the "@" path alias.
 *
 * When real fixtures are available, add a second describe block that feeds each
 * PDF through the full /api/cv flow and reuses the same assertion helpers.
 */

import { finalizeCanonicalCvProfile } from "../lib/workzoCvGlobalFinalizer";

// Values that must never survive as a candidate name (spec acceptance list).
const INVALID_NAMES = [
  "Page Start",
  "Page Left Column Start",
  "Page Left Column End",
  "Page Right Column End",
  "Executive Summary",
  "Professional Summary",
  "About Me",
  "Skills",
  "Education",
  "Experience",
  "Core Competencies",
  "Web Scraping",
  "Process Improvement",
  "Customer Support",
  "ITSupport Specialist",
  "Wbs Programmierschule",
];

const NAME_BLOCKLIST_RE = /page|column|skills|experience|education|profile|summary/i;
const HEADLINE_BLOCKLIST_RE = /summary|profile|about me|contact|education|skills/i;

type Expected = {
  name?: string;
  minExperience?: number;
  minEducation?: number;
};

function assertGlobalInvariants(profile: any, expected: Expected = {}) {
  const name = profile.basics?.name || "";
  const headline = profile.basics?.headline || "";

  // Identity is never a marker, section header, skill, school, or company.
  expect(INVALID_NAMES).not.toContain(name);
  expect(name).not.toMatch(NAME_BLOCKLIST_RE);
  expect(headline).not.toMatch(HEADLINE_BLOCKLIST_RE);

  // Skills never contain the candidate name.
  if (name) expect(profile.skills || []).not.toContain(name);

  if (expected.name) expect(name).toBe(expected.name);
  if (expected.minExperience !== undefined) {
    expect((profile.experience || []).length).toBeGreaterThanOrEqual(expected.minExperience);
  }
  if (expected.minEducation !== undefined) {
    expect((profile.education || []).length).toBeGreaterThanOrEqual(expected.minEducation);
  }
}

// Representative cases across the layout categories the spec calls out. Each
// feeds intentionally "dirty" parser output (the kind the old merge/override
// stage used to corrupt) and asserts the finalizer cleans it.
const CASES: Array<{
  label: string;
  profile: any;
  ctx?: { rawText?: string; fileName?: string; candidateName?: string };
  expected?: Expected;
}> = [
  {
    label: "single-column ATS: clean name/headline preserved",
    profile: {
      basics: { name: "Haritha Kollipara", headline: "Senior Backend Engineer" },
      experience: [{ title: "Backend Engineer", company: "Acme GmbH", dates: "2021 - 2024" }],
      education: [{ degree: "BSc Computer Science", institution: "TU Berlin", dates: "2016 - 2019" }],
      skills: ["TypeScript", "Node.js"],
    },
    expected: { name: "Haritha Kollipara", minExperience: 1, minEducation: 1 },
  },
  {
    label: "two-column Canva: marker leaked into name is rejected, real name recovered from header",
    profile: {
      basics: { name: "Page Left Column End", headline: "Professional Summary" },
      experience: [{ title: "IT Support Specialist", company: "Contoso Ltd", dates: "2020 - 2023" }],
      education: [],
      skills: ["Active Directory", "Windows"],
    },
    ctx: {
      rawText: "Jane Doe\nIT Support Specialist\nContact\njane@example.com\nExperience\nIT Support Specialist Contoso Ltd 2020 - 2023",
      fileName: "Jane_Doe_CV.pdf",
    },
    expected: { name: "Jane Doe" },
  },
  {
    label: "sidebar-first: section header as name falls back to explicit candidateName",
    profile: {
      basics: { name: "Skills", headline: "Core Competencies" },
      experience: [{ title: "Marketing Manager", company: "BrightSide Agency", dates: "2019 - 2022" }],
      education: [{ degree: "MBA", institution: "INSEAD", dates: "2017 - 2018" }],
      skills: ["SEO", "SEM", "Analytics"],
    },
    ctx: { candidateName: "Marta Novák", rawText: "", fileName: "resume.pdf" },
    expected: { name: "Marta Novák", minExperience: 1, minEducation: 1 },
  },
  {
    label: "German Lebenslauf: bootcamp in experience is moved to education",
    profile: {
      basics: { name: "Lukas Bauer", headline: "Werkstudent" },
      experience: [
        { title: "Ausbildung", company: "WBS Programmierschule", dates: "2022 - 2023" },
        { title: "Working Student", company: "SAP SE", dates: "2023 - 2024" },
      ],
      education: [],
      skills: ["Java", "SQL"],
    },
    ctx: { fileName: "Lebenslauf_Lukas.pdf" },
    expected: { name: "Lukas Bauer", minEducation: 1 },
  },
  {
    label: "placeholder/template CV: lorem ipsum name rejected, no real name available",
    profile: {
      basics: { name: "Lorem Ipsum", headline: "Reallygreatsite" },
      experience: [],
      education: [],
      skills: [],
    },
    ctx: { rawText: "Lorem ipsum dolor sit amet", fileName: "template.pdf" },
    // No valid identity anywhere → safe fallback, never a garbage value.
    expected: { name: "Candidate" },
  },
  {
    label: "filename acronym leakage: 'Priya CSM' should not become the name",
    profile: {
      basics: { name: "Priya CSM", headline: "Customer Success Manager" },
      experience: [{ title: "Customer Success Manager", company: "Zendesk", dates: "2021 - 2024" }],
      education: [],
      skills: ["Customer Support"],
    },
    ctx: { candidateName: "Priya Sharma", fileName: "Priya_CSM-DEU.pdf" },
    expected: { name: "Priya Sharma" },
  },
];

describe("CV finalizer — global identity/structure invariants", () => {
  for (const testCase of CASES) {
    it(testCase.label, () => {
      const out = finalizeCanonicalCvProfile(testCase.profile, testCase.ctx || {});
      assertGlobalInvariants(out, testCase.expected);
    });
  }

  it("never selects any known invalid value as the candidate name", () => {
    for (const bad of INVALID_NAMES) {
      const out = finalizeCanonicalCvProfile(
        { basics: { name: bad, headline: bad }, experience: [], education: [], skills: [] },
        { rawText: "", fileName: "x.pdf" },
      );
      expect(INVALID_NAMES).not.toContain(out.basics?.name || "");
      expect(out.basics?.name || "").not.toMatch(NAME_BLOCKLIST_RE);
    }
  });

  it("records the resolved name source and rejected candidates for debugging", () => {
    const out: any = finalizeCanonicalCvProfile(
      { basics: { name: "Page Left Column End" }, experience: [], education: [], skills: [] },
      { candidateName: "Aisha Khan", fileName: "cv.pdf" },
    );
    expect(out.confidence?.nameSource).toBe("request.candidateName");
    expect(out.confidence?.rejectedNameCandidates).toContain("Page Left Column End");
  });

  it("does not put structural markers into skills", () => {
    const out = finalizeCanonicalCvProfile(
      {
        basics: { name: "Sam Rivera" },
        experience: [],
        education: [],
        skills: ["Page Start", "Column End", "Python", "Docker"],
      },
      {},
    );
    expect(out.skills).not.toContain("Page Start");
    expect(out.skills).not.toContain("Column End");
    expect(out.skills).toContain("Python");
  });
});
