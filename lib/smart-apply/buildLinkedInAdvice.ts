/*
 * lib/smart-apply/buildLinkedInAdvice.ts
 *
 * LinkedIn advice (spec section 16).
 *
 * THE DISTINCTION THAT MATTERS
 *
 * A tailored CV is written for ONE reader. A LinkedIn profile is read by every
 * recruiter, for every role, for years. They are not the same artefact and must not
 * be edited by the same logic.
 *
 * If Smart Apply rewrote the live profile on every application, a user who applied to
 * six jobs in a week would end the week with a profile that describes none of them,
 * churned into whatever the last job ad happened to want. Worse: the JD keywords that
 * are safe in a tailored CV (because a human reviews it before sending) become
 * permanent public claims.
 *
 * So the rule is: a requirement is only worth making PERMANENT when it recurs across
 * the user's wider target-role corpus. One job asking for it is a coincidence. Most
 * jobs asking for it is a signal about the market they are actually in.
 */

import type { JobMatchResult } from "@/lib/jobs/types";
import type { SmartApplyLinkedInAdvice } from "@/lib/smart-apply/types";
import { assessEvidence } from "@/lib/smart-apply/validateEvidence";
import { isSameRequirement } from "@/lib/jobs/textStems";

/**
 * @param match          this job's match
 * @param corpusMatches  matches from the user's OTHER recent jobs for the same target
 *                       role. Empty is fine: with no corpus we recommend nothing
 *                       permanent, which is the safe default.
 */
export function buildLinkedInAdvice(
  match: JobMatchResult,
  corpusMatches: JobMatchResult[] = [],
): SmartApplyLinkedInAdvice {
  const verdict = assessEvidence(match);

  /*
   * Only EVIDENCED requirements are ever candidates for the profile. We will not tell
   * someone to put a skill on LinkedIn that their CV cannot support, which would be
   * the same lie with a bigger audience.
   */
  const evidenced = verdict.supported;

  const tailoredCvOnly: string[] = [];
  const considerPermanent: string[] = [];

  /* How many OTHER jobs in the corpus also asked for this? */
  const corpusDemand = (requirement: string): number =>
    corpusMatches.filter((m) =>
      m.requirements.some((r) => isSameRequirement(r.requirement, requirement)),
    ).length;

  /*
   * The threshold: it must appear in at least a third of the corpus, and in at least
   * two other jobs. Two is the floor because one repeat is still a coincidence.
   */
  const threshold = Math.max(2, Math.ceil(corpusMatches.length / 3));

  for (const req of evidenced) {
    const demand = corpusDemand(req.requirement);
    if (corpusMatches.length && demand >= threshold) {
      considerPermanent.push(req.requirement);
    } else {
      tailoredCvOnly.push(req.requirement);
    }
  }

  const reasoning = corpusMatches.length
    ? `Checked against ${corpusMatches.length} other recent job(s) for this target role. A requirement is only worth putting on your permanent profile when the market keeps asking for it, not when one employer does. ${considerPermanent.length ? `${considerPermanent.length} requirement(s) cleared that bar.` : "None cleared that bar yet, so nothing here is worth a permanent change."}`
    : "No other recent applications to compare against yet, so nothing is recommended for your permanent profile. Everything below is safe for this one tailored CV only. Apply to a few more roles in this target and this advice gets sharper.";

  return { tailoredCvOnly, considerPermanent, reasoning };
}
