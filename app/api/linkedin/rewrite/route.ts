import { NextResponse } from "next/server";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { checkWorkZoRateLimit } from "@/lib/workzoRateLimit";
import { askOpenRouter } from "@/lib/openrouter";
import { parseLinkedInProfile, coerceLinkedInProfile } from "@/lib/workzoLinkedInParser";
import { analyzeLinkedIn, matchLinkedInToJd } from "@/lib/workzoLinkedInEngine";
import { guardLinkedInRewrite } from "@/lib/workzoLinkedInRewriteGuard";
import type { ResumeProfile } from "@/lib/workzoResumeParser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/linkedin/rewrite   —   item 5, the Improve tier.
 *
 * Rewrites the headline and About section around the keywords the CV already
 * proves. Premium and above.
 *
 * THE ANALYSIS IS RE-DERIVED, NOT ACCEPTED
 * ----------------------------------------
 * The client already ran /api/linkedin/analyze and has the findings. We ignore
 * them and recompute. A forged request could otherwise send an empty `gaps`
 * array, and `gaps` is precisely the list of things the model is forbidden to
 * write. The one input that constrains the model must not come from the caller.
 *
 * The engines are pure set arithmetic, so recomputing costs microseconds.
 */

const MAX_CHARS = 40_000;

const MODELS = {
  premium: process.env.OPENROUTER_WRITING_PREMIUM_MODEL || "anthropic/claude-haiku-4.5",
  pro: process.env.OPENROUTER_WRITING_PRO_MODEL || "anthropic/claude-sonnet-4.6",
};

function isResumeProfile(value: unknown): value is ResumeProfile {
  if (!value || typeof value !== "object") return false;
  const p = value as ResumeProfile;
  if (!p.basics || typeof p.basics !== "object") return false;
  const hasExperience = Array.isArray(p.experience) && p.experience.length > 0;
  const hasEducation = Array.isArray(p.education) && p.education.length > 0;
  return hasExperience || hasEducation;
}

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

/** Everything the CV proves. The rewrite may draw on this and nothing else. */
function buildEvidence(profile: ResumeProfile, cvText: string): string {
  return [
    profile.basics?.headline,
    profile.summary,
    profile.skills?.join(", "),
    profile.certifications?.join(", "),
    profile.experience
      ?.map((e) => `${e.title} at ${e.company} (${e.dates}): ${e.bullets?.join(" ")}`)
      .join("\n"),
    profile.education?.map((e) => `${e.degree} ${e.institution}`).join("\n"),
    cvText,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 12_000);
}

function extractJson(raw: string): { headline?: string; about?: string; experienceRefinements?: { company?: string; current?: string; suggestedUpdate?: string }[]; featuredSectionAdvice?: string } | null {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export async function POST(request: Request) {
  const account = await resolveWorkZoServerPlan();
  if (!account.authenticated) {
    return NextResponse.json({ ok: false, error: "Please sign in to use this feature." }, { status: 401 });
  }

  const isPremium = account.plan === "premium" || account.plan === "premium_pro";
  const isPro = account.plan === "premium_pro";

  if (!isPremium) {
    return NextResponse.json(
      { ok: false, error: "upgrade_required", requiredPlan: "premium", feature: "linkedin_rewrite" },
      { status: 403 },
    );
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ ok: false, error: "OPENROUTER_API_KEY is missing." }, { status: 500 });
  }

  // Burst protection, keyed by user id so clearing browser storage cannot bypass it.
  const { allowed } = await checkWorkZoRateLimit(`linkedin_rewrite:${account.userId}`, 8, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many rewrites in a row. Wait a minute and try again." },
      { status: 429 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const linkedinText = String(body?.linkedinText || "").slice(0, MAX_CHARS);
    const jobDescription = String(body?.jobDescription || "").slice(0, MAX_CHARS);
    const targetRole = String(body?.targetRole || "").slice(0, 180);
    const jobDescriptionCorpus: string[] = Array.isArray(body?.jobDescriptionCorpus)
      ? (body.jobDescriptionCorpus as unknown[])
          .map((jd: unknown): string => String(jd ?? "").slice(0, MAX_CHARS))
          .filter((jd: string): boolean => jd.trim().length >= 80)
          .slice(0, 5)
      : [];
    const cvText = String(body?.cvText || "").slice(0, MAX_CHARS);

    if (!isResumeProfile(body?.resumeProfile)) {
      return NextResponse.json(
        { ok: false, error: "No parsed CV was supplied.", code: "cv_required" },
        { status: 400 },
      );
    }
    const imported = coerceLinkedInProfile(body?.linkedinProfile);
    if (!imported && linkedinText.trim().length < 80) {
      return NextResponse.json(
        { ok: false, error: "Paste your LinkedIn profile, or import the PDF, first." },
        { status: 400 },
      );
    }
    if (!jobDescription.trim() && !jobDescriptionCorpus.length) {
      return NextResponse.json(
        { ok: false, error: "Add at least one target JD so the rewrite targets a real role family." },
        { status: 400 },
      );
    }

    const profile = coerceProfile(body.resumeProfile as ResumeProfile);
    const linkedin = imported ?? parseLinkedInProfile(linkedinText);
    const corpusText =
      jobDescriptionCorpus.length > 0
        ? jobDescriptionCorpus
            .map((jd: string, i: number): string => `JD ${i + 1}:\n${jd.slice(0, 2500)}`)
            .join("\n\n---\n\n")
        : jobDescription.slice(0, 10_000);

    const analysis = analyzeLinkedIn({
      linkedin,
      resumeProfile: profile,
      cvText,
      jobDescription,
      jobDescriptionCorpus,
      targetRole,
    });

    // Never assume the corpus engine produced a weighted JD match. A valid
    // corpus may contain no terms above the macro threshold, but the rewrite
    // must still work from the complete role-family text. Re-run the direct
    // matcher over the whole corpus as a deterministic fallback. This always
    // returns a safe object, even when zero professional terms are found.
    const jdMatch =
      analysis.jdMatch ??
      matchLinkedInToJd({
        linkedin,
        resumeProfile: profile,
        cvText,
        jobDescription: corpusText || targetRole || "Target role",
      });

    const evidence = buildEvidence(profile, cvText);
    const useKeywords = [...jdMatch.add, ...jdMatch.promote].map((f) => f.keyword);

    // Forbidden = every JD keyword the CV cannot prove, NOT just `gaps`.
    //
    // `gaps` means "absent from LinkedIn and unproven by the CV". A keyword that
    // is already on the LinkedIn profile but still unproven by the CV is not a
    // gap — and if we derived the forbidden list from `gaps`, a caller could
    // post a LinkedIn profile listing "Power BI" and the model would be cleared
    // to write it. `unevidenced` is computed against the CV alone, so it cannot
    // be unlocked by anything the caller sends.
    const forbidden = jdMatch.unevidenced.map((f) => f.keyword);

    // Title inconsistencies are handed to the model so the rewritten headline
    // does not re-state a title the CV contradicts.
    const titleConflicts = analysis.consistency.findings
      .filter((f) => f.code === "title_mismatch")
      .map((f) => `LinkedIn says "${f.linkedin}", the CV says "${f.cv}". Use the CV's title.`);

    const system = [
      "You rewrite LinkedIn headlines and About sections for job seekers.",
      "You may only state facts supported by the EVIDENCE block. You never invent employers, titles, dates, metrics, or skills.",
      "Never use a term from the FORBIDDEN list, in any form. The candidate cannot defend those in an interview.",
      "Never introduce a number, percentage, or quantity that does not appear verbatim in EVIDENCE.",
      "Write in first person, plainly. No buzzwords, no 'passionate', no 'results-driven'.",
      "Respond with JSON only. No markdown, no preamble. Shape: {\"headline\": string, \"about\": string, \"experienceRefinements\": [{\"company\": string, \"current\": string, \"suggestedUpdate\": string}], \"featuredSectionAdvice\": string}",
      "The headline is pipe-separated, at most 220 characters, leading with the target role.",
      "The About section is 3 to 5 short paragraphs, at most 1800 characters.",
      "Also return 2 to 4 targeted LinkedIn Experience bullet refinements using only evidence from the CV.",
      "Return one Featured section recommendation, such as a portfolio, GitHub, certificate, case study, or project the evidence supports.",
    ].join("\n");

    const user = [
      `TARGET ROLE:
${targetRole || "Target role"}`,
      `
TARGET ROLE JOB CORPUS:
${corpusText}`,
      `\nCURRENT LINKEDIN HEADLINE:\n${linkedin.headline || "(empty)"}`,
      `\nCURRENT LINKEDIN ABOUT:\n${linkedin.about || "(empty)"}`,
      `\nKEYWORDS TO WORK IN (each one is proven by the evidence below):\n${useKeywords.join(", ") || "(none)"}`,
      `\nFORBIDDEN — the candidate has no evidence for these, do not mention them:\n${forbidden.join(", ") || "(none)"}`,
      titleConflicts.length ? `\nTITLE CONFLICTS TO RESOLVE:\n${titleConflicts.join("\n")}` : "",
      `\nEVIDENCE (the candidate's real CV):\n${evidence}`,
    ]
      .filter(Boolean)
      .join("\n");

    const raw = await askOpenRouter(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { model: isPro ? MODELS.pro : MODELS.premium, temperature: 0.3, maxTokens: 1400, jsonMode: true },
    );

    const parsed = extractJson(String(raw || ""));
    if (!parsed?.headline && !parsed?.about) {
      return NextResponse.json({ ok: false, error: "The rewrite returned no content." }, { status: 502 });
    }

    // The prompt asked. This enforces.
    const guarded = guardLinkedInRewrite({
      headline: String(parsed.headline || ""),
      about: String(parsed.about || ""),
      forbidden,
      evidence,
    });

    if (guarded.violations.length) {
      console.warn("[linkedin.rewrite] guard removed unprovable content", {
        userId: account.userId,
        violations: guarded.violations.map((v) => `${v.where}:${v.reason}:${v.offender}`),
      });
    }

    return NextResponse.json({
      ok: true,
      headline: guarded.headline,
      about: guarded.about,
      experienceRefinements: Array.isArray(parsed.experienceRefinements) ? parsed.experienceRefinements.slice(0, 4) : [],
      featuredSectionAdvice: String(parsed.featuredSectionAdvice || "Pin one concrete proof asset that supports your target role, such as a portfolio project, certificate, GitHub repository, dashboard, case study, or work sample already mentioned in your CV."),
      /** Shown to the user. Being told what we refused to write is the product. */
      violations: guarded.violations,
      keywordsApplied: useKeywords,
      keywordsRefused: forbidden,
      matchScoreBefore: Number.isFinite(jdMatch.matchScore) ? jdMatch.matchScore : 0,
      matchScoreTarget: Number.isFinite(jdMatch.potentialScore) ? jdMatch.potentialScore : 0,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "LinkedIn rewrite failed." },
      { status: 500 },
    );
  }
}
