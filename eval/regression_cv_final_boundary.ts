import { strict as assert } from "node:assert";
import { finalizeCanonicalCvProfile } from "@/lib/workzoCvGlobalFinalizer";
import { resolveTargetHeadline } from "@/lib/workzoCvIdentityEngine";

assert.equal(resolveTargetHeadline({
  aiHeadline: "Fmcg Sales Agent Negotiation",
  selectedName: "Connor Hamilton",
  rawText: "C O N N O R H A M I L T O N\nS a l e s R e p r e s e n t a t i v e\n123 Anywhere St.",
}), "Sales Representative");

assert.equal(resolveTargetHeadline({
  aiHeadline: "Skills and Proficiencies",
  selectedName: "Rahul Gupta",
  rawText: "Rahul Gupta\nSkills and Proficiencies\nProfessional Summary\nseeking employment as a mobile game developer.",
}), "mobile game developer");

assert.equal(resolveTargetHeadline({
  aiHeadline: "Secondary Schoole Graduation Certificate",
  selectedName: "Khaled Alkanj",
  rawText: "Khaled Alkanj\nMotivated Young Man with High Social Skills\nEDUCATION\nSecondary School Graduation Certificate",
}), "");

const finalized = finalizeCanonicalCvProfile({
  basics: { name: "Haritha Vijayakumar", headline: "IT Support Specialist / Data Analyst", email: "", phone: "", location: "", linkedin: "" },
  summary: "",
  experience: [
    { title: "IT Support Specialist / Data Analyst", company: "", location: "", dates: "", bullets: [] },
    { title: "Technical Support Engineer", company: "Zoho Corp", location: "", dates: "2018 - 2020", bullets: ["Resolved customer issues."] },
    { title: "Technical Support Engineer", company: "Zoho Corp", location: "", dates: "2018 - 2020", bullets: ["Resolved customer issues."] },
    { title: "Application Engineer", company: "CSS Corp", location: "", dates: "2016 - 2018", bullets: ["Supported networking products."] },
  ],
  education: [],
  projects: [],
  skills: ["Python", "English"],
  languages: ["English - FLUENT", "English: Fluent", "German - Conversational", "German (B1)"],
  certifications: [], strengths: [], additionalEvidence: [], warnings: [], rawText: "",
}, { rawText: "Haritha Vijayakumar\nIT Support Specialist / Data Analyst", fileName: "Haritha.pdf" });

assert.equal(finalized.experience.length, 2);
assert.equal(finalized.languages.length, 2);
assert.ok(!finalized.skills.includes("English"));
console.log("regression_cv_final_boundary: passed");
