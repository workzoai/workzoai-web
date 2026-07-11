import { NextResponse } from "next/server";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { checkWorkZoRateLimit } from "@/lib/workzoRateLimit";
import { extractCvWithVision } from "@/lib/workzoVisionCvExtractor";
import { linkedInProfileFromResumeProfile } from "@/lib/workzoLinkedInParser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/linkedin/import-pdf
 *
 * Accepts the PDF produced by LinkedIn's own "Save to PDF" button and returns a
 * structured LinkedInProfile.
 *
 * WHY A PDF AND NOT A URL
 * -----------------------
 * There is no official LinkedIn API that returns a member's experience, skills,
 * or About section without partner approval — the self-serve Consumer API gives
 * name, headline and photo, and nothing else. Scraping the public page is not a
 * CFAA violation after hiQ v. LinkedIn, but it does breach LinkedIn's User
 * Agreement, which they enforce civilly; Proxycurl was sued into shutting down.
 * So a URL field would be either useless or a liability.
 *
 * The PDF sidesteps both. The candidate exports their own data in two clicks,
 * and no automated system ever touches LinkedIn.
 *
 * WHY VISION AND NOT TEXT EXTRACTION
 * ----------------------------------
 * The export is a two-column layout with a "Top Skills" sidebar. Flattening it
 * to text interleaves the sidebar into the experience section — the same class
 * of corruption that made Improve CV misread CVs. `extractCvWithVision` reads
 * the rendered page and returns structure, so there is nothing to re-parse.
 * We map that structure straight across. No text round-trip.
 */

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const account = await resolveWorkZoServerPlan();
  if (!account.authenticated) {
    return NextResponse.json(
      { ok: false, error: "Please sign in to import your LinkedIn profile." },
      { status: 401 },
    );
  }

  const { allowed } = await checkWorkZoRateLimit(`linkedin_import:${account.userId}`, 10, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many imports in a row. Wait a minute and try again." },
      { status: 429 },
    );
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ ok: false, error: "OPENROUTER_API_KEY is missing." }, { status: 500 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "No file was uploaded." }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { ok: false, error: "Upload the PDF from LinkedIn's Save to PDF button." },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "That PDF is too large." }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const pdfDataUrl = `data:application/pdf;base64,${buffer.toString("base64")}`;

    const vision = await extractCvWithVision({ pdfDataUrl, fileName: file.name });

    if (!vision.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "We could not read that PDF. Make sure it came from LinkedIn's Save to PDF button, or paste your profile text instead.",
          code: vision.source,
        },
        { status: 422 },
      );
    }

    const linkedinProfile = linkedInProfileFromResumeProfile(vision.resumeProfile, file.name);

    // The export can legitimately contain no Experience section (a student with
    // education only). No roles AND no skills means we read the wrong document.
    if (!linkedinProfile.experience.length && !linkedinProfile.skills.length) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "That PDF has no Experience or Skills section. Check you exported your LinkedIn profile, not a resume.",
          code: "linkedin_pdf_empty",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      ok: true,
      linkedinProfile,
      /** Surfaced to the user, not swallowed. See `skillsComplete`. */
      notice:
        "LinkedIn's PDF export only includes your top skills, so WorkZo will not report a CV skill as missing from your profile. Paste your profile instead for the full skills check.",
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "LinkedIn PDF import failed." },
      { status: 500 },
    );
  }
}
