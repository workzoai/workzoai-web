/*
 * lib/smart-apply/exportProfile.ts
 *
 * Adapts a ResumeProfile (what the tailor produces) into WorkZoStructuredCv (what
 * the existing PDF generator in lib/workzoCvPdf.ts consumes).
 *
 * WHY AN ADAPTER, NOT A NEW EXPORTER
 *
 * A complete, dependency-free CV PDF generator already exists in workzoCvPdf.ts,
 * with four templates. It was never wired to anything. Writing a second PDF path
 * would be the "two Stripe webhooks" mistake from the audit: two renderers that
 * drift, and a fix applied to one silently missing the other. So we translate into
 * the shape the existing generator already understands, and reuse it.
 *
 * The translation is pure copying. It does not invent, summarise, or re-score. The
 * tailored profile has already been through the evidence gate; the export must not
 * quietly add anything back. What went in is what comes out.
 */

import type { ResumeProfile } from "@/lib/workzoResumeParser";
import type { WorkZoStructuredCv } from "@/lib/workzoCvPdf";

export function profileToStructuredCv(
  profile: ResumeProfile,
  options: { targetRole?: string; blockedClaims?: string[] } = {},
): WorkZoStructuredCv {
  const basics = profile.basics || ({} as ResumeProfile["basics"]);

  return {
    fullName: (basics.name || "").trim(),
    // The target role is the JOB's title, shown as a label. It is NOT written into
    // the headline or claimed as a held role (the tailor deliberately leaves the
    // headline alone). It sits here purely as the document's target line.
    targetRole: (options.targetRole || basics.headline || "").trim(),
    contact: {
      email: (basics.email || "").trim(),
      phone: (basics.phone || "").trim(),
      location: (basics.location || "").trim(),
      linkedin: (basics.linkedin || "").trim(),
    },
    summary: (profile.summary || "").trim(),
    skills: [...(profile.skills || [])],
    experience: (profile.experience || []).map((role) => ({
      title: (role.title || "").trim(),
      company: (role.company || "").trim(),
      dates: (role.dates || "").trim(),
      bullets: [...(role.bullets || [])],
    })),
    projects: (profile.projects || []).map((project) => ({
      name: (project.name || "").trim(),
      bullets: [...(project.bullets || [])],
    })),
    education: (profile.education || [])
      .map((edu) => [edu.degree, edu.institution, edu.dates].filter(Boolean).join(", "))
      .filter(Boolean),
    certifications: [...(profile.certifications || [])],
    languages: [...(profile.languages || [])],
    /*
     * "Details to Confirm" in the PDF. We repurpose it to carry the blocked claims,
     * so the exported document itself reminds the user what was deliberately left
     * out and why. The honesty travels with the file, it is not only on screen.
     *
     * These are phrased as things the CANDIDATE would confirm, never as claims. If
     * there is nothing blocked, the section does not render.
     */
    suggestedAdditions: (options.blockedClaims || []).map((claim) =>
      claim.replace(/^We did not add /i, "Not added (not evidenced): ").replace(/ because.*$/i, ""),
    ),
    // The export does not re-derive JD keywords. Keyword stuffing is exactly the ATS
    // anti-pattern the whole feature avoids, so this stays empty on a tailored CV.
    jdKeywords: [],
  };
}
