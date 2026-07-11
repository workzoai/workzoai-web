import { NextRequest, NextResponse } from "next/server";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { checkWorkZoRateLimit } from "@/lib/workzoRateLimit";
import { parseLinkedInProfile, coerceLinkedInProfile } from "@/lib/workzoLinkedInParser";
import { analyzeLinkedIn } from "@/lib/workzoLinkedInEngine";
import type { ResumeProfile } from "@/lib/workzoResumeParser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/linkedin/analyze
 *
 * Runs both engines. No LLM call, so no OpenRouter cost and no latency budget
 * to defend — the whole thing is set arithmetic over text the client already
 * has. That is deliberate: an AI rewrite of the About section (item 5) will sit
 * behind a separate, gated route, and it will consume the findings produced
 * here rather than re-deriving them.
 *
 * The resumeProfile arrives from the client because `resolveCvSource` reads
 * sessionStorage and is therefore client-only. We re-validate its shape rather
 * than trusting it: a request can be forged, and a malformed profile would
 * silently produce a consistency report about nothing.
 *
 * GATING: free tier, but NOT anonymous. Both engines read the parsed CV, and the
 * CV lives behind auth. This is the one WorkZo tool that cannot follow the
 * "works without login" rule, because the thing that differentiates it from a
 * generic profile checker — knowing the candidate's real CV — is the thing that
 * requires an account. It is therefore an in-app feature, not an SEO surface.
 * Rate limited by user id so a free account cannot be used as a public API.
 */

const MAX_CHARS = 40_000;

function isResumeProfile(value: unknown): value is ResumeProfile {
  if (!value || typeof value !== "object") return false;
  const p = value as ResumeProfile;
  if (!p.basics || typeof p.basics !== "object") return false;
  const hasExperience = Array.isArray(p.experience) && p.experience.length > 0;
  const hasEducation = Array.isArray(p.education) && p.education.length > 0;
  return hasExperience || hasEducation;
}

/** Fill in the array fields the engines index into, so a partial profile cannot throw. */
function coerceProfile(profile: ResumeProfile): ResumeProfile {
  return {
    ...profile,
    experience: Array.isArray(profile.experience) ? profile.experience : [],
    education: Array.isArray(profile.education) ? profile.education : [],
    skills: Array.isArray(profile.skills) ? profile.skills : [],
    projects: Array.isArray(profile.projects) ? profile.projects : [],
    certifications: Array.isArray(profile.certifications) ? profile.certifications : [],
  };
}

export async function POST(request: NextRequest) {
  const account = await resolveWorkZoServerPlan();
  if (!account.authenticated) {
    return NextResponse.json(
      { ok: false, error: "Please sign in to analyze your LinkedIn profile." },
      { status: 401 },
    );
  }

  const { allowed } = await checkWorkZoRateLimit(`linkedin_analyze:${account.userId}`, 20, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many analyses in a row. Wait a minute and try again." },
      { status: 429 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));

    const linkedinText = String(body?.linkedinText || "").slice(0, MAX_CHARS);
    const jobDescription = String(body?.jobDescription || "").slice(0, MAX_CHARS);
    const targetRole = String(body?.targetRole || "").slice(0, 180);
    const jobDescriptionCorpus = Array.isArray(body?.jobDescriptionCorpus)
      ? body.jobDescriptionCorpus.map((jd: unknown) => String(jd || "").slice(0, MAX_CHARS)).filter((jd: string) => jd.trim().length >= 80).slice(0, 5)
      : [];
    const cvText = String(body?.cvText || "").slice(0, MAX_CHARS);

    // Two accepted inputs: raw paste, or the structured profile returned by
    // /api/linkedin/import-pdf. The PDF path is already structured, so it must
    // never be flattened to text and re-parsed here.
    const imported = coerceLinkedInProfile(body?.linkedinProfile);

    if (!imported && linkedinText.trim().length < 80) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Paste your full LinkedIn profile, or upload the PDF from LinkedIn's Save to PDF button.",
        },
        { status: 400 },
      );
    }

    if (!isResumeProfile(body?.resumeProfile)) {
      return NextResponse.json(
        {
          ok: false,
          error: "No parsed CV was supplied. Upload your CV first so we can compare it against LinkedIn.",
          code: "cv_required",
        },
        { status: 400 },
      );
    }

    const linkedin = imported ?? parseLinkedInProfile(linkedinText);

    // A paste that yields no roles and no skills is almost always a partial
    // copy (the user grabbed the header only). Say so, rather than returning a
    // confident report built on nothing.
    if (!linkedin.experience.length && !linkedin.skills.length) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "We could not find an Experience or Skills section in that paste. Scroll your profile so those sections are expanded, then copy the whole page.",
          code: "linkedin_unparsed",
        },
        { status: 422 },
      );
    }

    const analysis = analyzeLinkedIn({
      linkedin,
      resumeProfile: coerceProfile(body.resumeProfile as ResumeProfile),
      cvText,
      jobDescription,
      jobDescriptionCorpus,
      targetRole,
    });

    return NextResponse.json({ ok: true, ...analysis });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "LinkedIn analysis failed." },
      { status: 500 },
    );
  }
}
