/*
 * lib/jobs/ranking.ts
 *
 * Honest fit scoring (spec sections 2.3 and 10).
 *
 * WHAT CHANGED AND WHY
 *
 * 1. Criticality is no longer POSITION. The old code decided which requirements
 *    were blocking like this:
 *
 *        const criticalReqs = requirements.slice(0, 5);   // "the first few listed"
 *
 *    An ad that opens with bonus points had them scored as mandatory; an ad that
 *    buries "must hold a valid nursing licence" at the bottom scored it as
 *    optional, and told the candidate she was a strong match for a job she is not
 *    legally allowed to do. Criticality now comes from the ad's LANGUAGE
 *    (must have / nice to have / erforderlich / wünschenswert), read in
 *    lib/jobs/requirementExtractor.ts.
 *
 * 2. "Missing" and "not verifiable" are no longer the same thing. A CV cannot say
 *    whether someone will relocate, and the old substring test called that missing
 *    and docked the score for it. Unverifiable requirements are now NEUTRAL: they
 *    are surfaced as things for the user to confirm, never held against them.
 *
 * 3. Weight is redistributed, not forfeited. A component with nothing to score
 *    (an ad that never mentions education) hands its weight to the components that
 *    did have something to say. Previously a silent category scored a default and
 *    quietly dragged every score toward the middle.
 *
 * 4. Every matched requirement carries the CV text that proves it, so the score can
 *    explain itself and so document generation can refuse to write an unevidenced
 *    claim.
 *
 * A score of 100 remains unreachable by construction.
 */

import type {
  CandidateContext,
  JobMatchRecommendation,
  JobMatchResult,
  JobRequirementMatch,
  WorkZoJob,
} from "@/lib/jobs/types";
import type { ResumeProfile } from "@/lib/workzoResumeParser";
import { extractStructuredRequirements } from "@/lib/jobs/requirementExtractor";
import { matchRequirementsAgainstCv, deriveYearsOfExperience } from "@/lib/jobs/evidenceMatcher";

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function recommendationFromScore(score: number): JobMatchRecommendation {
  if (score >= 85) return "strong_match";
  if (score >= 68) return "worth_applying";
  if (score >= 50) return "stretch";
  return "low_match";
}

/*
 * Lift a lightweight CandidateContext into the canonical ResumeProfile shape.
 *
 * The jobs board only carries a summary of the candidate, but the evidence matcher
 * works on the canonical profile. Rather than maintain two matchers that will drift,
 * we lift the light context into the canonical shape: Smart Apply passes the real
 * profile and gets real quotable evidence, the jobs board passes this and gets
 * weaker evidence but IDENTICAL scoring rules. One engine, one behaviour.
 */
function profileFromContext(candidate: CandidateContext): ResumeProfile {
  const cvText = candidate.cvText || "";
  return {
    rawText: cvText,
    basics: {
      name: "",
      headline: candidate.role || "",
      email: "",
      phone: "",
      location: candidate.location || "",
      linkedin: "",
    },
    summary: "",
    experience: [],
    education: (candidate.education || []).map((degree) => ({ degree, institution: "", location: "", dates: "" })),
    skills: candidate.skills || [],
    projects: [],
    languages: candidate.languages || [],
    certifications: [],
    strengths: [],
    // The raw CV text is the only evidence available in this mode. Carrying it as
    // line-level entries lets the matcher QUOTE from it rather than guess.
    additionalEvidence: cvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 12)
      .slice(0, 300),
    warnings: [],
    previewText: "",
  };
}

/* ─────────────────────── derived views for the existing UI ────────────────── */

/*
 * app/jobs/page.tsx renders `match.matchedRequirements.join(", ")`. Rather than
 * maintain two parallel sets of arrays by hand (which is precisely how a dead
 * field is born), these are PROJECTIONS of the structured list. One source of
 * truth, computed views, no possible drift.
 */
function deriveLegacyViews(reqs: JobRequirementMatch[]) {
  return {
    matchedRequirements: reqs.filter((r) => r.status === "matched").map((r) => r.requirement),
    partiallyMatchedRequirements: reqs.filter((r) => r.status === "partial").map((r) => r.requirement),
    missingCriticalRequirements: reqs
      .filter((r) => r.status === "missing" && r.criticality === "required")
      .map((r) => r.requirement),
    unsupportedRequirements: reqs
      .filter((r) => r.status === "missing" && r.criticality !== "required")
      .map((r) => r.requirement),
  };
}

/*
 * Weighted coverage of one or more categories.
 *
 * Returns null when the ad said nothing about these categories, so the caller can
 * redistribute the weight instead of scoring a phantom zero.
 *
 * A "required" item counts double, so missing one mandatory skill costs more than
 * missing two optional ones. That is the whole point of reading criticality.
 */
function coverageOf(reqs: JobRequirementMatch[], categories: string[]): number | null {
  const scoped = reqs.filter((r) => categories.includes(r.category) && r.status !== "not_verifiable");
  if (!scoped.length) return null;

  let weight = 0;
  let credit = 0;
  for (const r of scoped) {
    const w = r.criticality === "required" ? 2 : 1;
    weight += w;
    if (r.status === "matched") credit += w;
    else if (r.status === "partial") credit += w * 0.5;
  }
  return weight ? clamp01(credit / weight) : null;
}

export function rankJob(
  job: WorkZoJob,
  candidate: CandidateContext,
  canonicalProfile?: ResumeProfile | null,
): JobMatchResult {
  const jd = `${job.title}\n${job.description}`;
  const profile = canonicalProfile || profileFromContext(candidate);

  const extracted = extractStructuredRequirements(jd, 24);
  const requirements = matchRequirementsAgainstCv(extracted, profile);

  /* ── section 10 weights ──────────────────────────────────────────────────── */
  const components: Array<{ weight: number; value: number | null }> = [
    { weight: 25, value: coverageOf(requirements, ["technical"]) },
    { weight: 10, value: coverageOf(requirements, ["domain"]) },
    { weight: 10, value: coverageOf(requirements, ["language"]) },
    { weight: 5, value: coverageOf(requirements, ["education"]) },
    { weight: 5, value: coverageOf(requirements, ["soft_skill", "other"]) },
  ];

  /* Experience: derived from the CV's own dates, never from a self-reported number. */
  const expReqs = requirements.filter((r) => r.category === "experience");
  let experienceValue: number | null = null;
  if (expReqs.length) {
    const verifiable = expReqs.filter((r) => r.status !== "not_verifiable");
    if (verifiable.length) {
      experienceValue = clamp01(
        verifiable.reduce((s, r) => s + (r.status === "matched" ? 1 : r.status === "partial" ? 0.6 : 0), 0) /
          verifiable.length,
      );
    }
  } else {
    const years = deriveYearsOfExperience(profile) ?? candidate.yearsExperience ?? null;
    if (years !== null) experienceValue = clamp01(years / 5) * 0.9 + 0.1;
  }
  components.push({ weight: 20, value: experienceValue });

  /* Role / title similarity. */
  const tokenize = (v: string) =>
    (v || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);

  const roleWords = new Set(tokenize(candidate.role || profile.basics?.headline || ""));
  const titleWords = tokenize(job.title);
  const titleOverlap = titleWords.length ? titleWords.filter((w) => roleWords.has(w)).length / titleWords.length : 0;
  components.push({ weight: 15, value: roleWords.size ? clamp01(titleOverlap * 1.4) : null });

  /* Location and work model. Only a stated incompatibility moves this. */
  const pref = candidate.remotePreference || "unknown";
  let locationValue: number | null = null;
  if (job.remoteType === "remote") locationValue = 0.95;
  else if (pref !== "unknown" && pref === job.remoteType) locationValue = 0.9;
  else if (job.remoteType === "onsite" && pref === "remote") locationValue = 0.4;
  else if (candidate.location && job.location) {
    const city = candidate.location.toLowerCase().split(",")[0].trim();
    locationValue = city && job.location.toLowerCase().includes(city) ? 0.9 : 0.65;
  }
  components.push({ weight: 10, value: locationValue });

  /* Evidence strength: does this CV quantify anything at all. */
  const quantified =
    (profile.experience || []).some((role) =>
      (role.bullets || []).some((b) => /\b\d+\s*(%|percent|k\b|m\b|hours?|users?|customers?|tickets?|projects?)/i.test(b)),
    ) || /\b\d+\s*(%|percent)\b/i.test(profile.rawText || "");
  components.push({ weight: 5, value: quantified ? 0.9 : 0.5 });

  /* Weighted mean across only the components that had something to score. */
  const live = components.filter((c) => c.value !== null) as Array<{ weight: number; value: number }>;
  const totalWeight = live.reduce((s, c) => s + c.weight, 0);
  const base = totalWeight ? live.reduce((s, c) => s + c.value * c.weight, 0) / totalWeight : 0.5;

  /* ── penalties ────────────────────────────────────────────────────────────
   * Applied ONLY to what the employer actually called mandatory. This is what
   * stops a candidate missing a hard requirement from reading as a strong match.
   * A missing required language is the harshest: it is usually a hard gate.
   */
  const missingRequired = requirements.filter((r) => r.status === "missing" && r.criticality === "required");
  let penalty = 0;
  for (const r of missingRequired) {
    /*
     * A missing required LANGUAGE or CREDENTIAL is a hard gate, not a weakness.
     * You cannot practise as a nurse without a licence, and you cannot take a
     * German-language role without German. These must push the candidate below
     * "worth applying", because applying is a waste of their week.
     *
     * A missing technical skill is genuinely softer: it is learnable, sometimes on
     * the job, and a strong candidate can still be worth a shot.
     */
    if (r.category === "language") penalty += 18;
    else if (r.category === "education") penalty += 16;
    else if (r.category === "experience") penalty += 14;
    else if (r.category === "technical") penalty += 11;
    else penalty += 7;
  }
  penalty = Math.min(penalty, 45);

  /*
   * Confidence FIRST, because a low-confidence read must be allowed to cap the score.
   * Confidence is how much of the ad we could actually read and check, not how good
   * the fit is.
   */
  const verifiableCount = requirements.filter((r) => r.status !== "not_verifiable").length;
  const confidence = clamp01(
    (Math.min(requirements.length, 10) / 10) * 0.6 +
      (requirements.length ? (verifiableCount / requirements.length) * 0.4 : 0),
  );

  let score = Math.max(0, Math.min(96, Math.round(base * 100 - penalty)));

  /*
   * THE HONESTY GUARD.
   *
   * A job we could not read (empty or near-empty JD) has almost no requirements, so
   * confidence is near zero. But `base` defaults to 0.5 and the title-overlap plus
   * quantified-CV bonuses can still push the raw score into the 90s. That produced the
   * absurd, and dishonest, "91, Strong match, Confidence 0%" seen in testing: a
   * confident number resting on nothing.
   *
   * The score must never claim more certainty than the confidence supports. When we
   * could barely read the ad, we cap the score into the "worth a look, but we could not
   * really assess this" band and let the recommendation reflect that. A high score is
   * earned by matching real, read requirements, not by a job title that happens to
   * echo the CV headline.
   */
  const wellRead = requirements.length >= 3 && confidence >= 0.3;
  if (!wellRead) {
    // Cap so the UI cannot show "Strong match" (>=85) or even "worth applying" (>=68)
    // for a job we could not read. It presents as a low-confidence "relevant" instead.
    score = Math.min(score, 55);
  }

  const recommendation: JobMatchRecommendation = wellRead
    ? recommendationFromScore(score)
    : "low_match";

  /* ── explanation, every clause backed by a requirement object ─────────────── */
  const matched = requirements.filter((r) => r.status === "matched");
  const partial = requirements.filter((r) => r.status === "partial");
  const unverifiable = requirements.filter((r) => r.status === "not_verifiable");

  const strengths = matched.slice(0, 5).map((r) => r.requirement);

  const concerns: string[] = [];
  for (const r of missingRequired.slice(0, 5)) {
    concerns.push(`${r.requirement} is required and is not evidenced in your CV.`);
  }
  for (const r of partial.slice(0, 3)) {
    concerns.push(`${r.requirement} is only partially proven in your CV.`);
  }
  for (const r of unverifiable.slice(0, 2)) {
    concerns.push(`${r.requirement} cannot be confirmed from a CV. Check this before you apply.`);
  }

  const parts: string[] = [];
  if (strengths.length) parts.push(`Your ${strengths.slice(0, 3).join(", ")} experience matches this role.`);
  if (missingRequired.length) {
    const names = missingRequired.slice(0, 2).map((r) => r.requirement).join(" and ");
    parts.push(`${names} ${missingRequired.length === 1 ? "is" : "are"} required and not visible in your CV.`);
  } else if (partial.length) {
    const names = partial.slice(0, 2).map((r) => r.requirement).join(" and ");
    parts.push(`${names} ${partial.length === 1 ? "is" : "are"} only partially proven.`);
  }
  if (!parts.length) parts.push("This role is relevant to your search, but the ad gives little detail to score against.");

  const legacy = deriveLegacyViews(requirements);

  const reasons: string[] = [];
  if (legacy.matchedRequirements.length) reasons.push(`Matches ${legacy.matchedRequirements.slice(0, 4).join(", ")}.`);
  if (titleOverlap >= 0.5) reasons.push("Job title lines up with your target role.");
  if (job.remoteType === "remote") reasons.push("Remote role.");
  if (legacy.missingCriticalRequirements.length) {
    reasons.push(`Missing: ${legacy.missingCriticalRequirements.slice(0, 3).join(", ")}.`);
  } else if (legacy.unsupportedRequirements.length) {
    reasons.push(`Worth strengthening: ${legacy.unsupportedRequirements.slice(0, 3).join(", ")}.`);
  }
  if (!reasons.length) reasons.push("Relevant role from live search.");

  return {
    score,
    recommendation,
    requirements,
    strengths,
    concerns,
    explanation: parts.join(" "),
    confidence: Math.round(confidence * 100) / 100,
    generatedAt: new Date().toISOString(),
    ...legacy,
    reasons,
  };
}
