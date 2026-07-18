/**
 * Identity enforcement regressions (brief §8, §9, §11, §12, §13).
 *
 * These lock the three properties that were broken in production:
 *   1. a validator identity error can never reach the canonical profile;
 *   2. the headline is re-cased once, centrally, and stays independent;
 *   3. the browser never re-resolves an identity the server already ruled on.
 */

import assert from "assert";
import {
  buildCanonicalResumeProfile,
  findIdentityViolations,
  normalizeHeadlineCasing,
} from "../lib/workzoCvCanonicalBuilder";
import { validateCanonicalProfile } from "../lib/workzoCvValidator";
import { buildCanonicalProfile, normalizeCanonicalProfile } from "../lib/workzoCanonicalProfile";
import type { ResumeProfile } from "../lib/workzoResumeParser";

function parsedProfile(over: Record<string, unknown> = {}): ResumeProfile {
  return {
    basics: { name: "", headline: "", email: "", phone: "", location: "", linkedin: "" },
    summary: "",
    experience: [],
    education: [],
    skills: [],
    projects: [],
    languages: [],
    ...over,
  } as unknown as ResumeProfile;
}

/* §12 — the exact production anti-pattern: validator errored, pipeline shipped
 * the contaminated name anyway. */
{
  const parsed = parsedProfile({
    basics: { name: "Emaawarner Accounting", headline: "Accounting Executive", email: "", phone: "", location: "", linkedin: "" },
  });
  const text = "ACCOUNTING EXECUTIVE\n\nCONTACT\nhello@reallygreatsite.com\n\nEXPERIENCE";
  const out = buildCanonicalResumeProfile({ parsed, rawText: text, identityText: text });

  assert.notEqual(out.profile.basics.name, "Emaawarner Accounting");
  assert.equal(out.profile.basics.name, "Emaawarner"); // §8 repair: strip the headline bleed
  const validation = validateCanonicalProfile({ parsed, final: out.profile as ResumeProfile, rawText: text });
  assert.ok(validation.ok, `canonical profile must not carry identity violations: ${JSON.stringify(validation.violations)}`);
}

/* §12 — an identity error the repair cannot fix must blank, never publish. */
{
  const parsed = parsedProfile({
    basics: { name: "Project Management", headline: "", email: "", phone: "", location: "", linkedin: "" },
    skills: ["Project Management", "Stakeholder Engagement"],
  });
  const text = "SKILLS\nProject Management\nStakeholder Engagement";
  const out = buildCanonicalResumeProfile({ parsed, rawText: text, identityText: text });
  assert.equal(out.profile.basics.name, "");
  assert.equal(out.report.needsConfirmation, true);
  assert.equal(out.report.nameSource, "needs_confirmation");
}

/* §12 — the rule set itself. */
{
  assert.deepEqual(findIdentityViolations("", { headline: "Accounting Executive" }), []);
  assert.ok(findIdentityViolations("Emaawarner Accounting", { headline: "Accounting Executive" }).includes("name_contaminated_by_headline"));
  assert.ok(findIdentityViolations("jane@mail.com", {}).includes("name_contains_contact"));
  assert.ok(findIdentityViolations("Skills", {}).includes("name_is_section_name"));
  assert.ok(findIdentityViolations("Tableau Api", { skills: ["Tableau", "API"] }).includes("name_is_profile_evidence"));
  // A real name under a real headline is untouched.
  assert.deepEqual(findIdentityViolations("Marceline Anderson", { headline: "Graphic Designer" }), []);
}

/* §9 — headline casing is normalized once, centrally; acronyms survive. */
{
  assert.equal(normalizeHeadlineCasing("GRAPHIC DESIGNER"), "Graphic Designer");
  assert.equal(normalizeHeadlineCasing("IT SUPPORT SPECIALIST"), "IT Support Specialist");
  assert.equal(normalizeHeadlineCasing("SEO MANAGER"), "SEO Manager");
  assert.equal(normalizeHeadlineCasing("UX/UI DESIGNER"), "UX/UI Designer");
  assert.equal(normalizeHeadlineCasing("HEAD OF ENGINEERING"), "Head of Engineering");
  // Authored casing is never destroyed.
  assert.equal(normalizeHeadlineCasing("iOS Developer"), "iOS Developer");
  assert.equal(normalizeHeadlineCasing("Senior Data Scientist"), "Senior Data Scientist");
}

/* §13 — the browser must not re-resolve an identity the server ruled on. */
{
  // Server resolved it: the browser copies, never re-derives.
  const resolved = buildCanonicalProfile({
    profile: {
      basics: { name: "Claudia Alves", headline: "Commercial Agent", email: "claudia.alves@mail.com", phone: "", location: "", linkedin: "" },
      identityAuthoritative: true,
      identityNeedsConfirmation: false,
      selectedNameSource: "canonical:top_header",
      rawText: "CLAUDIA ALVES\nCOMMERCIAL AGENT",
    } as unknown as ResumeProfile,
    rawText: "CLAUDIA ALVES\nCOMMERCIAL AGENT",
  });
  assert.ok(resolved);
  assert.equal(resolved!.basics.name, "Claudia Alves");

  // Server declined: the browser must NOT invent a name from raw text.
  const declined = buildCanonicalProfile({
    profile: {
      basics: { name: "", headline: "", email: "", phone: "", location: "", linkedin: "" },
      identityAuthoritative: false,
      identityNeedsConfirmation: true,
      selectedNameSource: "canonical:needs_confirmation",
      rawText: "JANE DOE\nAPPLICATIONS DEVELOPER",
    } as unknown as ResumeProfile,
    rawText: "JANE DOE\nAPPLICATIONS DEVELOPER",
  });
  assert.equal(declined, null, "a server-declined identity must not be re-resolved in the browser");

  // A user-confirmed name still wins over everything.
  const confirmed = buildCanonicalProfile({
    profile: {
      basics: { name: "", headline: "", email: "", phone: "", location: "", linkedin: "" },
      identityAuthoritative: false,
      identityNeedsConfirmation: true,
      selectedNameSource: "canonical:needs_confirmation",
      rawText: "SKILLS\nWeb Design",
    } as unknown as ResumeProfile,
    rawText: "SKILLS\nWeb Design",
    confirmedIdentity: { name: "Priya Raman", headline: "Data Analyst" },
  });
  assert.ok(confirmed);
  assert.equal(confirmed!.basics.name, "Priya Raman");
  assert.equal(confirmed!.selectedNameSource, "user_confirmed");
}

/* §19 — cached identity is re-validated on load; user_confirmed is exempt. */
{
  const contaminatedCache = normalizeCanonicalProfile({
    basics: { name: "Emaawarner Accounting", headline: "Accounting Executive", email: "", phone: "", location: "", linkedin: "" },
    experience: [{ title: "Accountant", company: "Vertex", location: "", dates: "2020 - 2023", bullets: ["Managed ledgers."] }],
    education: [],
    skills: ["Bookkeeping"],
    projects: [],
    languages: [],
    summary: "",
    rawText: "ACCOUNTING EXECUTIVE\n\nEXPERIENCE\nAccountant, Vertex, 2020 - 2023\nManaged ledgers.",
    canonicalVersion: "cv-engine-v6.0-old",
  });
  // The profile must survive (it has real evidence) but the contaminated name
  // must NOT be replayed from cache.
  assert.ok(contaminatedCache, "a cached profile with real evidence must not be destroyed");
  assert.notEqual(contaminatedCache!.basics.name, "Emaawarner Accounting");

  // A user-confirmed identity is never re-litigated by a later engine bump.
  const confirmedCache = normalizeCanonicalProfile({
    basics: { name: "Emaawarner Accounting", headline: "Accounting Executive", email: "", phone: "", location: "", linkedin: "" },
    experience: [{ title: "Accountant", company: "Vertex", location: "", dates: "2020 - 2023", bullets: ["Managed ledgers."] }],
    education: [],
    skills: ["Bookkeeping"],
    projects: [],
    languages: [],
    summary: "",
    selectedNameSource: "user_confirmed",
    rawText: "ACCOUNTING EXECUTIVE\n\nEXPERIENCE\nAccountant, Vertex, 2020 - 2023\nManaged ledgers.",
    canonicalVersion: "cv-engine-v6.0-old",
  });
  assert.ok(confirmedCache);
  assert.equal(confirmedCache!.basics.name, "Emaawarner Accounting", "user_confirmed identity must never be overwritten");
}

console.log("PASS identity enforcement, headline casing, single-authority invariants");
