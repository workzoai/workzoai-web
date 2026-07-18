/**
 * Identity regression suite (brief §15).
 *
 * Every case runs the REAL production path:
 *   parser output + raw text -> buildCanonicalResumeProfile -> canonical profile
 *
 * Each case asserts the four contract fields required by the brief:
 *   expectedName, expectedSource, expectedNeedsConfirmation, expectedHeadline.
 *
 * No sample-specific logic exists in production code; these are inputs only.
 */

import { buildCanonicalResumeProfile } from "../lib/workzoCvCanonicalBuilder";
import type { ResumeProfile } from "../lib/workzoResumeParser";

type Case = {
  label: string;
  rawText: string;
  parserName?: string;
  parserHeadline?: string;
  fileName?: string;
  email?: string;
  candidateName?: string;
  expectedName?: string;
  /** Assert name is anything EXCEPT this value. */
  expectedNameNot?: string;
  /** Accept any of these sources. */
  expectedSource?: string[];
  expectedNeedsConfirmation?: boolean;
  expectedHeadline?: string;
};

const cases: Case[] = [
  {
    label: "15.1 correct name from top header",
    rawText: "MARCELINE ANDERSON\nGRAPHIC DESIGNER\n\nCONTACT\nmarceline.anderson@mail.com\n\nEXPERIENCE\nGraphic Designer, Studio Nine\nBuilt brand systems.",
    email: "marceline.anderson@mail.com",
    expectedName: "Marceline Anderson",
    expectedSource: ["top_header"],
    expectedNeedsConfirmation: false,
    expectedHeadline: "Graphic Designer",
  },
  {
    label: "15.2 decorative spaced name",
    rawText: "H A R I T H A  V I J A Y A K U M A R\nJ U N I O R  D A T A  S C I E N T I S T\n\nCONTACT\nharitha.vijayakumar@mail.com",
    email: "haritha.vijayakumar@mail.com",
    expectedName: "Haritha Vijayakumar",
    expectedSource: ["decorative_header"],
    expectedNeedsConfirmation: false,
  },
  {
    label: "15.3 split name",
    rawText: "CONNOR\nHAMILTON\nCREATIVE DIRECTOR\n\nCONTACT\nconnor.hamilton@mail.com",
    email: "connor.hamilton@mail.com",
    expectedName: "Connor Hamilton",
    expectedSource: ["split_header"],
    expectedNeedsConfirmation: false,
    expectedHeadline: "Creative Director",
  },
  {
    label: "15.4 sidebar-first extraction",
    rawText:
      "SKILLS\nNegotiation\nClient Relations\nCRM\n\nLANGUAGES\nEnglish\nSpanish\n\nCLAUDIA ALVES\nCOMMERCIAL AGENT\n\nclaudia.alves@mail.com\n\nEXPERIENCE\nCommercial Agent, Vertex Group\nGrew regional accounts.",
    email: "claudia.alves@mail.com",
    expectedName: "Claudia Alves",
    expectedNeedsConfirmation: false,
    expectedHeadline: "Commercial Agent",
  },
  {
    label: "15.5 parser hallucination ignored",
    rawText: "JANE DOE\nAPPLICATIONS DEVELOPER\n\nCONTACT\njane.doe@mail.com\n\nSKILLS\nWeb Design\nJava",
    parserName: "Web Design",
    email: "jane.doe@mail.com",
    expectedName: "Jane Doe",
    expectedNeedsConfirmation: false,
  },
  {
    label: "15.6 organization rejected",
    rawText: "EDUCATION\nWBS Coding School\nWeb Development Bootcamp, 2023\n\nCONTACT\nstudent@mail.com",
    parserName: "WBS Coding School",
    expectedNameNot: "WBS Coding School",
  },
  {
    label: "15.7 language rejected",
    rawText: "LANGUAGES\nEnglish Fluent\nGerman Native\n\nCONTACT\nperson@mail.com",
    parserName: "English Fluent",
    expectedNameNot: "English Fluent",
  },
  {
    label: "15.8 contaminated role suffix",
    rawText: "EMAAWARNER\nACCOUNTING EXECUTIVE\n\nCONTACT\nhello@reallygreatsite.com",
    parserName: "Emaawarner Accounting",
    parserHeadline: "Accounting Executive",
    expectedNameNot: "Emaawarner Accounting",
  },
  {
    label: "15.9 genuine unresolved template",
    rawText: "CONTACT\nSKILLS\nEDUCATION\nEXPERIENCE",
    expectedName: "",
    expectedSource: ["needs_confirmation"],
    expectedNeedsConfirmation: true,
  },
  {
    label: "15.10a apostrophe + hyphen",
    rawText: "Anne-Marie O'Connor\nOperations Consultant\n\nCONTACT\nam.oconnor@mail.com",
    email: "am.oconnor@mail.com",
    expectedName: "Anne-Marie O'Connor",
    expectedNeedsConfirmation: false,
  },
  {
    label: "15.10b hyphenated given name",
    rawText: "Jean-Luc Picard\nFleet Captain\n\nCONTACT\njean.picard@mail.com",
    email: "jean.picard@mail.com",
    expectedName: "Jean-Luc Picard",
    expectedNeedsConfirmation: false,
  },
  {
    label: "15.11a accented name (French)",
    rawText: "François Mercier\nIngénieur Logiciel\n\nCONTACT\nf.mercier@mail.fr",
    email: "f.mercier@mail.fr",
    expectedName: "François Mercier",
    expectedNeedsConfirmation: false,
  },
  {
    label: "15.11b accented name (Spanish)",
    rawText: "José Álvarez\nProduct Manager\n\nCONTACT\njose.alvarez@mail.es",
    email: "jose.alvarez@mail.es",
    expectedName: "José Álvarez",
    expectedNeedsConfirmation: false,
  },
  {
    label: "15.11c accented name (Polish)",
    rawText: "Łukasz Kowalski\nData Analyst\n\nCONTACT\nl.kowalski@mail.pl",
    email: "l.kowalski@mail.pl",
    expectedName: "Łukasz Kowalski",
    expectedNeedsConfirmation: false,
  },
  {
    label: "15.11d accented name (Danish)",
    rawText: "Søren Nielsen\nBackend Developer\n\nCONTACT\ns.nielsen@mail.dk",
    email: "s.nielsen@mail.dk",
    expectedName: "Søren Nielsen",
    expectedNeedsConfirmation: false,
  },
  {
    label: "15.12 filename corroboration on ambiguous header",
    rawText: "CURRICULUM VITAE\n\nCONTACT\nHARITHAVIJAYAKUMAR\nIT SUPPORT SPECIALIST",
    fileName: "Haritha Vijayakumar.pdf",
    expectedName: "Haritha Vijayakumar",
    expectedNeedsConfirmation: false,
  },
  {
    label: "extra: section heading never becomes a name",
    rawText: "PROFESSIONAL PROFILE\nSKILLS\nArchitectural Design\nWeb Design",
    parserName: "Architectural Design",
    expectedName: "",
    expectedNeedsConfirmation: true,
  },
  {
    label: "extra: parser-only name with zero corroboration is not accepted",
    rawText: "CONTACT\nSKILLS\nProject Management\nEDUCATION\nEXPERIENCE",
    parserName: "Soft Skills",
    expectedName: "",
    expectedNeedsConfirmation: true,
  },
];

function run(test: Case) {
  const parsed = {
    basics: {
      name: test.parserName || "",
      headline: test.parserHeadline || "",
      email: test.email || "",
      phone: "",
      location: "",
      linkedin: "",
    },
    summary: "",
    experience: [],
    education: [],
    skills: [],
    projects: [],
    languages: [],
  } as unknown as ResumeProfile;

  return buildCanonicalResumeProfile({
    parsed,
    rawText: test.rawText,
    identityText: test.rawText,
    candidateName: test.candidateName || "",
    fileName: test.fileName || "",
  });
}

let failed = 0;
for (const test of cases) {
  const { profile, report } = run(test);
  const problems: string[] = [];
  const name = profile.basics.name;

  if (test.expectedName !== undefined && name !== test.expectedName) {
    problems.push(`name: expected "${test.expectedName}", got "${name}"`);
  }
  if (test.expectedNameNot !== undefined && name === test.expectedNameNot) {
    problems.push(`name: must NOT be "${test.expectedNameNot}"`);
  }
  if (test.expectedSource && !test.expectedSource.includes(report.nameSource)) {
    problems.push(`source: expected one of ${test.expectedSource.join("|")}, got "${report.nameSource}"`);
  }
  if (
    test.expectedNeedsConfirmation !== undefined &&
    report.needsConfirmation !== test.expectedNeedsConfirmation
  ) {
    problems.push(`needsConfirmation: expected ${test.expectedNeedsConfirmation}, got ${report.needsConfirmation}`);
  }
  if (test.expectedHeadline !== undefined && profile.basics.headline !== test.expectedHeadline) {
    problems.push(`headline: expected "${test.expectedHeadline}", got "${profile.basics.headline}"`);
  }

  if (problems.length) {
    failed += 1;
    console.error(`FAIL: ${test.label}`);
    for (const problem of problems) console.error(`      ${problem}`);
  } else {
    console.log(`PASS: ${test.label} -> ${name || "confirmation required"}`);
  }
}

console.log(`\nIdentity brief suite: ${cases.length - failed}/${cases.length} passed.`);
if (failed) process.exit(1);
