import { determineCanonicalIdentity, resolveTargetHeadline } from "@/lib/workzoCvIdentityEngine";
import { repairParsedResume } from "@/lib/workzoResumeFactGuard";
import { finalizeCanonicalCvProfile } from "@/lib/workzoCvGlobalFinalizer";

function assert(label: string, condition: boolean, actual?: unknown) {
  if (!condition) {
    console.error("FAIL", label, actual);
    process.exitCode = 1;
  } else console.log("PASS", label);
}

const spaced = `H A R I T H A V I J A Y A K U M A R\nJ U N I O R C U S T O M E R S U C C E S S M A N A G E R\nC O N T A C T\nharithavijayakumar30@gmail.com`;
const identity = determineCanonicalIdentity({ aiName: "Curiosity Creativity", rawText: spaced, email: "harithavijayakumar30@gmail.com", fileName: "Haritha Vijayakumar.pdf" });
assert("rejects soft-skill false name", identity.selectedName === "Haritha Vijayakumar", identity);

assert("rejects placeholder as name", determineCanonicalIdentity({ aiName: "Address, Postal Code, City", rawText: "Address, postal code, City\nYour full name\nJunior Data Scientist" }).needsConfirmation);
assert("repairs CUSTOMER SUCCESS boundary", resolveTargetHeadline({ aiHeadline: "JUNIOR CUSTOMERSUCCESS MANAGER" }) === "JUNIOR CUSTOMER SUCCESS MANAGER");
assert("repairs IT PROJECT boundary", resolveTargetHeadline({ aiHeadline: "ITPROJECT MANAGER" }) === "IT PROJECT MANAGER");
assert("rejects section headline", resolveTargetHeadline({ aiHeadline: "Skills and Proficiencies", rawText: "Rahul Gupta\nMOBILE GAME DEVELOPER\nSkills and Proficiencies", selectedName: "Rahul Gupta" }) === "MOBILE GAME DEVELOPER");
assert("rejects website-contaminated headline", resolveTargetHeadline({ aiHeadline: "Reallygreatsite.Com Teacher Trainee", rawText: "Samira Hadid\nHIGH SCHOOL ENGLISH TEACHER\nProfessional Summary", selectedName: "Samira Hadid" }) === "HIGH SCHOOL ENGLISH TEACHER");

const repaired = repairParsedResume({
  basics: { name: "Haritha Vijayakumar", headline: "IT Support Specialist", email: "", phone: "", location: "", linkedin: "" },
  rawText: "",
  summary: "",
  experience: [], education: [], projects: [], certifications: [], strengths: [], additionalEvidence: [], warnings: [], previewText: "",
  skills: ["Python", "English", "German"],
  languages: ["English - FLUENT", "English: Fluent", "German - Conversational", "German (Conversational)"]
}, "");
assert("deduplicates language variants", repaired.languages.length === 2, repaired.languages);
assert("removes languages from skills", repaired.skills.length === 1 && repaired.skills[0] === "Python", repaired.skills);

const final = finalizeCanonicalCvProfile(repaired, { rawText: spaced, fileName: "Haritha Vijayakumar.pdf" });
assert("finalizer preserves canonical language dedupe", final.languages.length === 2, final.languages);

if (!process.exitCode) console.log("ALL PERMANENT GUARD CHECKS PASSED");
