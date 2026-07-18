import { canonicalizeResumeProfileIntegrity } from "@/lib/workzoCvCanonicalIntegrity";
import type { ResumeProfile } from "@/lib/workzoResumeParser";

function profile(partial: Partial<ResumeProfile>): ResumeProfile {
  return {
    rawText: "",
    basics: { name: "Candidate Name", headline: "", email: "", phone: "", location: "", linkedin: "" },
    summary: "",
    experience: [], education: [], skills: [], projects: [], languages: [], certifications: [], strengths: [], additionalEvidence: [], warnings: [], previewText: "",
    ...partial,
  };
}

function check(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const result = canonicalizeResumeProfileIntegrity(profile({
  basics: { name: "Candidate Name", headline: "DATA ANALYST Exampleweg 15, 97094 Exampletown", email: "", phone: "", location: "", linkedin: "" },
  experience: [
    { title: "Support Engineer", company: "Example Corp", dates: "2018 - 2020", location: "", bullets: ["Resolved customer incidents."] },
    { title: "Support Engineer", company: "Example Corp", dates: "2018–2020", location: "", bullets: ["Resolved customer incidents", "Automated workflows."] },
  ],
  projects: [{ name: "Market Study", bullets: ["Analyzed market trends.", "Analyzed market trends", "Used SQL and Python."] }],
  languages: ["German - Conversational", "German (Conversational)", "English - Fluent"],
  skills: ["Google Cloud Platform", "Google Cloud Platform (GCP)", "GCP", "SQL"],
}), "");

check("headline", result.profile.basics.headline, "DATA ANALYST");
check("experience count", result.profile.experience.length, 1);
check("experience bullets", result.profile.experience[0]?.bullets, ["Resolved customer incidents.", "Automated workflows."]);
check("project bullets", result.profile.projects[0]?.bullets, ["Analyzed market trends.", "Used SQL and Python."]);
check("languages", result.profile.languages, ["German - Conversational", "English - Fluent"]);
check("skills", result.profile.skills, ["Google Cloud Platform (GCP)", "SQL"]);

console.log("CV integrity regression passed");
