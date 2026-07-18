import { finalizeWorkZoCvProfile } from "../lib/workzoCvGlobalFinalizer";

function assert(name: string, condition: boolean, details: unknown) {
  if (!condition) throw new Error(`${name}: ${JSON.stringify(details)}`);
  console.log(`PASS ${name}`);
}

const base: any = {
  basics: { name: "Haritha Vijayakumar", headline: "IT Support Specialist", email: "haritha@example.com", phone: "", location: "", linkedin: "" },
  summary: "",
  experience: [
    { title: "Technical Support Engineer", company: "Zoho Corp", dates: "2018 - 2020", location: "", bullets: ["Resolved incidents"] },
    { title: "Application Engineer", company: "CSS Corp", dates: "2016 - 2018", location: "", bullets: ["Supported networking products"] },
  ],
  education: [], projects: [], skills: ["English", "Python"],
  languages: ["English - FLUENT", "English (Fluent)", "German - B1", "Deutsch (Konversationsniveau)"],
  certifications: [], strengths: [], additionalEvidence: [], warnings: [], rawText: "", previewText: "",
};

const a = finalizeWorkZoCvProfile({ parsedProfile: base, rawText: "H A R I T H A V I J A Y A K U M A R\nI T S U P P O R T S P E C I A L I S T" });
assert("preserves two valid jobs", a.experience.length === 2, a.experience);
assert("dedupes language aliases", a.languages.length === 2, a.languages);
assert("removes languages from skills", !a.skills.includes("English"), a.skills);
assert("keeps actual skill", a.skills.includes("Python"), a.skills);

const b = finalizeWorkZoCvProfile({
  parsedProfile: { ...base, basics: { ...base.basics, name: "", headline: "Project management" } },
  rawText: "ALICE MILANI\nI T P R O J E C T M A N A G E R\nC O N T A C T S\nS U M M A R Y O F S K I L L S\nProject management",
});
assert("recovers header name", b.basics.name === "Alice Milani", b.basics);
assert("prefers header role over skill", /IT PROJECT MANAGER/i.test(b.basics.headline), b.basics);

const c = finalizeWorkZoCvProfile({
  parsedProfile: { ...base, basics: { ...base.basics, name: "", headline: "Senior Product Manager - AI & SaaS Platforms" } },
  rawText: "Sophia Martinez\nSenior Product Manager • AI & SaaS Platforms\nMunich, Germany • sophia@example.com",
});
assert("recovers ordinary first-line name", c.basics.name === "Sophia Martinez", c.basics);
assert("keeps two valid experience records at final boundary", c.experience.length === 2, c.experience);

const d = finalizeWorkZoCvProfile({
  parsedProfile: { ...base, languages: ["Deutsch - B2", "English - C1", "Englisch - C1", "Systemadministration - Windows, Active Directory"] },
  rawText: "SUR ENDER\nProduct Design Engineer",
});
assert("dedupes translated language aliases and rejects non-language prose", d.languages.length === 2, d.languages);
