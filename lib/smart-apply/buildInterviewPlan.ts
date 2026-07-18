/*
 * lib/smart-apply/buildInterviewPlan.ts
 *
 * Job-specific interview preparation (spec section 15).
 *
 * Built from: canonical CV evidence + JD requirements + KNOWN GAPS.
 *
 * The gaps are the point. Generic interview prep asks a candidate the questions they
 * can already answer. The questions that end an interview are the ones aimed at the
 * thing the CV does not show, and Smart Apply already knows exactly what those are:
 * they are the blocked requirements from the match. A candidate who has rehearsed
 * "you don't have Kubernetes, talk to me about that" is a different candidate.
 */

import type { ResumeProfile } from "@/lib/workzoResumeParser";
import type { JobMatchResult, WorkZoJob } from "@/lib/jobs/types";
import type { SmartApplyInterviewPlan } from "@/lib/smart-apply/types";
import { assessEvidence } from "@/lib/smart-apply/validateEvidence";

export function buildInterviewPlan(
  profile: ResumeProfile,
  job: WorkZoJob,
  match: JobMatchResult,
): SmartApplyInterviewPlan {
  const verdict = assessEvidence(match);
  const company = (job.company || "the company").trim();
  const title = (job.title || "this role").trim();

  const required = verdict.supported.filter((r) => r.criticality === "required");
  const technical = verdict.supported.filter((r) => r.category === "technical" || r.category === "domain");

  const likelyQuestions: string[] = [
    `Why this ${title} role, and why ${company}?`,
  ];
  for (const req of required.slice(0, 4)) {
    likelyQuestions.push(`Walk me through your hands-on experience with ${req.requirement}.`);
  }
  for (const req of verdict.supported.filter((r) => r.category === "soft_skill").slice(0, 1)) {
    likelyQuestions.push(`Give me an example of ${req.requirement} in a difficult situation.`);
  }

  const technicalScenarios = technical.slice(0, 4).map(
    (req) => `A scenario where ${req.requirement} is the deciding factor. Be ready to explain your approach, your trade-offs, and how you verified the result.`,
  );

  /*
   * Evidence to USE. These are the exact CV lines the candidate should be able to
   * expand into a story. Quoted verbatim so there is no gap between what the CV says
   * and what they say in the room.
   */
  const cvEvidenceToUse = verdict.supported
    .flatMap((r) => r.evidence)
    .filter((e, i, arr) => arr.indexOf(e) === i)
    .slice(0, 8);

  /*
   * Gap defence. The hard part, and the reason this feature exists.
   *
   * We do not coach the candidate to bluff. We coach them to answer honestly and then
   * redirect to the adjacent thing they CAN evidence. That is the answer that actually
   * survives a follow-up question, which a bluff does not.
   */
  const gapDefenseQuestions: string[] = [];
  const gaps = verdict.blocked.filter(
    (r) => r.criticality === "required" && r.status !== "not_verifiable" && r.category !== "location",
  );

  for (const gap of gaps.slice(0, 4)) {
    const adjacent = verdict.supported.find((s) => s.category === gap.category);
    gapDefenseQuestions.push(
      adjacent
        ? `"Your CV doesn't show ${gap.requirement}." Say so plainly, then bridge to ${adjacent.requirement}, which you can evidence. Do not claim ${gap.requirement}.`
        : `"Your CV doesn't show ${gap.requirement}." Acknowledge it directly, then talk about how quickly you have closed a comparable gap before. Do not claim it.`,
    );
  }

  const partial = verdict.blocked.filter((r) => r.status === "partial").slice(0, 2);
  for (const req of partial) {
    gapDefenseQuestions.push(
      `${req.requirement} is only partially proven in your CV. Expect them to probe the depth. Be precise about what you have actually done and what you have not.`,
    );
  }

  /*
   * Stories to prepare, one per competency, each anchored to a real CV line. If there
   * is no evidence for a competency, there is no story: we do not ask the candidate to
   * invent one under the heading "prepare a story about leadership".
   */
  const storiesToPrepare = verdict.supported
    .filter((r) => r.evidence.length > 0)
    .slice(0, 5)
    .map((r) => ({ competency: r.requirement, evidence: r.evidence[0] }));

  /*
   * Recruiter risks. What a screener will actually flag on this specific pairing of
   * CV and JD. This is derived, not guessed.
   */
  const recruiterRisks: string[] = [];
  if (gaps.length) {
    recruiterRisks.push(`${gaps.length} required requirement(s) are not evidenced in your CV: ${gaps.map((g) => g.requirement).join(", ")}.`);
  }
  if (match.confidence < 0.5) {
    recruiterRisks.push("This job ad is thin on detail, so the screen could go in an unexpected direction. Prepare breadth, not just depth.");
  }
  const unverifiable = match.requirements.filter((r) => r.status === "not_verifiable");
  for (const r of unverifiable.slice(0, 2)) {
    recruiterRisks.push(`${r.requirement} cannot be read off a CV. Expect to be asked about it directly, and know your answer before the call.`);
  }
  if (match.score < 50) {
    recruiterRisks.push("On the evidence in your CV, this is a stretch application. Go in knowing that, and lead with your strongest proof.");
  }
  if (!recruiterRisks.length) {
    recruiterRisks.push("No blocking gaps found against this ad. The risk here is complacency: your evidence is good, so be ready to go deep on it.");
  }

  return {
    likelyQuestions,
    technicalScenarios,
    cvEvidenceToUse,
    gapDefenseQuestions,
    storiesToPrepare,
    recruiterRisks,
  };
}
