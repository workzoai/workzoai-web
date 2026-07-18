import { determineCanonicalIdentity, resolveTargetHeadline } from "@/lib/workzoCvIdentityEngine";
import { repairParsedResume } from "@/lib/workzoResumeFactGuard";
import type { ResumeProfile } from "@/lib/workzoResumeParser";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const decorativeRaw = [
  "H A R I T H A V I J A Y A K U M A R",
  "I T S u p p o r t S p e c i a l i s t / T e c h n i c a l S u p p o r t E n g i n e e r",
  "C O N T A C T",
  "harithavijayakumar30@gmail.com",
].join("\n");

const identity = determineCanonicalIdentity({
  rawText: decorativeRaw,
  email: "harithavijayakumar30@gmail.com",
  fileName: "HTS.pdf",
});
assert(identity.selectedName === "Haritha Vijayakumar", `decorative identity failed: ${identity.selectedName}`);
assert(!identity.needsConfirmation, "corroborated decorative identity should not require confirmation");

const ordinary = determineCanonicalIdentity({
  aiName: "Surender Dillibabu",
  rawText: "Surender Dillibabu\nProduct Design Engineer\nCONTACT",
  email: "surender@example.com",
});
assert(ordinary.selectedName === "Surender Dillibabu", "ordinary identity regressed");

assert(
  resolveTargetHeadline({
    aiHeadline: "DATA SCIENTIST / ANALYST Zweierweg 15, 97094, Würzburg",
    rawText: "Haritha Vijayakumar\nDATA SCIENTIST / ANALYST\n97094 Würzburg",
    selectedName: "Haritha Vijayakumar",
  }) === "DATA SCIENTIST / ANALYST",
  "headline address guard regressed",
);

const profile: ResumeProfile = {
  rawText: decorativeRaw,
  basics: { name: "", headline: "IT Support", email: "", phone: "", location: "", linkedin: "" },
  summary: "",
  experience: [
    { title: "Technical Support Engineer", company: "Zoho Corp", location: "", dates: "2018-2020", bullets: ["Resolved customer issues effectively"] },
    { title: "", company: "Zoho Corp", location: "", dates: "2018 - 2020", bullets: ["Resolved customer issues effectively"] },
    { title: "Application Engineer", company: "CSS Corp", location: "", dates: "2016-2018", bullets: ["Supported network products effectively"] },
  ],
  education: [],
  skills: ["English", "Python", "German"],
  projects: [],
  languages: ["English - FLUENT", "German - CONVERSATIONAL", "English (Fluent)"],
  certifications: [], strengths: [], additionalEvidence: [], warnings: [], previewText: "",
};

const repaired = repairParsedResume(profile, decorativeRaw);
assert(repaired.experience.length === 2, `experience fragments remain: ${repaired.experience.length}`);
assert(repaired.languages.length === 2, `language variants remain: ${repaired.languages.join(" | ")}`);
assert(!repaired.skills.some((skill) => /^(english|german)$/i.test(skill)), "languages leaked into skills");

console.log("PASS regression_cv_global_integrity");
