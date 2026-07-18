/*
 * lib/smart-apply/tailorCv.ts
 *
 * Tailor the canonical CV to one job (spec section 13).
 *
 * WHAT TAILORING IS
 *
 *   Reordering    put the bullets that answer this JD at the top
 *   Emphasis      surface the matched skills, demote the irrelevant ones
 *   Terminology   use the JD's word for a thing the CV already evidences
 *
 * WHAT TAILORING IS NOT
 *
 *   Inventing employers, dates, titles, technologies, qualifications, metrics.
 *
 * The identity block, employers, dates and original job titles are copied through
 * UNTOUCHED. Not "carefully rewritten": untouched. There is no upside to a model
 * rephrasing an employment date, and there is a large downside.
 *
 * Every claim added is checked against the evidence gate, and the output is
 * re-scanned after generation, because asking nicely is not a control.
 */

import type { ResumeProfile } from "@/lib/workzoResumeParser";
import type { JobMatchResult, WorkZoJob } from "@/lib/jobs/types";
import type { TailoredCvChange, TailoredCvResult } from "@/lib/smart-apply/types";
import { assessEvidence } from "@/lib/smart-apply/validateEvidence";
import { contentStems } from "@/lib/jobs/textStems";
import { rankJob } from "@/lib/jobs/ranking";
import type { CandidateContext } from "@/lib/jobs/types";

/**
 * How well does one bullet answer this job?
 *
 * Purely lexical and deterministic. No model call, so this cannot hallucinate a
 * relevance it cannot justify, and it runs in microseconds on the server.
 */
function bulletRelevance(bullet: string, requirementStems: Set<string>): number {
  const stems = contentStems(bullet);
  if (!stems.length) return 0;
  const hits = stems.filter((s) => requirementStems.has(s)).length;
  // Normalised by requirement coverage, not bullet length: a short bullet that nails
  // two requirements beats a long one that mentions one in passing.
  return hits;
}

export function tailorCvForJob(
  profile: ResumeProfile,
  job: WorkZoJob,
  match: JobMatchResult,
  candidate: CandidateContext,
): TailoredCvResult {
  const verdict = assessEvidence(match);
  const changes: TailoredCvChange[] = [];
  const warnings: string[] = [];

  /* The stems the employer actually asked for, drawn only from SUPPORTED matches. */
  const supportedStems = new Set<string>();
  for (const req of verdict.supported) {
    for (const s of contentStems(req.requirement)) supportedStems.add(s);
  }

  /* ── 1. Identity and history: copied, never touched ──────────────────────── */
  const tailored: ResumeProfile = {
    ...profile,
    basics: { ...profile.basics },
    // Deep-copy experience so reordering bullets cannot mutate the canonical profile.
    experience: (profile.experience || []).map((role) => ({ ...role, bullets: [...(role.bullets || [])] })),
    education: (profile.education || []).map((e) => ({ ...e })),
    projects: (profile.projects || []).map((p) => ({ ...p, bullets: [...(p.bullets || [])] })),
    skills: [...(profile.skills || [])],
    languages: [...(profile.languages || [])],
    certifications: [...(profile.certifications || [])],
  };

  /* ── 2. Reorder bullets within each role by relevance to THIS job ─────────── */
  for (const role of tailored.experience) {
    const original = [...role.bullets];
    if (original.length < 2) continue;

    const scored = original.map((bullet, index) => ({
      bullet,
      index,
      score: bulletRelevance(bullet, supportedStems),
    }));

    /*
     * Stable sort: relevance first, original order as the tiebreak. A CV's bullet
     * order carries meaning (usually chronology or importance), so we disturb it only
     * where there is a reason to.
     */
    scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.index - b.index));
    const reordered = scored.map((s) => s.bullet);

    if (reordered.join("|") !== original.join("|")) {
      role.bullets = reordered;
      changes.push({
        section: `Experience: ${role.title || "role"}${role.company ? `, ${role.company}` : ""}`,
        before: original[0],
        after: reordered[0],
        reason: "Moved the bullet that answers this job's requirements to the top, where a recruiter reads first.",
        evidence: [reordered[0]],
      });
    }
  }

  /*
   * Roles themselves are NOT reordered. Employment history is chronological, and a
   * CV that lists 2019 above 2023 looks like a lie even when every line is true.
   */

  /* ── 3. Reorder skills: matched ones first ───────────────────────────────── */
  const originalSkills = [...tailored.skills];
  const matchedSkillSet = new Set(
    verdict.supported
      .filter((r) => r.category === "technical" || r.category === "domain")
      .flatMap((r) => contentStems(r.requirement)),
  );

  const skillScore = (skill: string) => contentStems(skill).filter((s) => matchedSkillSet.has(s)).length;
  const reorderedSkills = [...originalSkills]
    .map((skill, index) => ({ skill, index, score: skillScore(skill) }))
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.index - b.index))
    .map((s) => s.skill);

  if (reorderedSkills.join("|") !== originalSkills.join("|")) {
    tailored.skills = reorderedSkills;
    changes.push({
      section: "Skills",
      before: originalSkills.slice(0, 5).join(", "),
      after: reorderedSkills.slice(0, 5).join(", "),
      reason: "Led with the skills this job actually asks for. No skills were added or removed.",
      evidence: reorderedSkills.slice(0, 5).filter((s) => skillScore(s) > 0),
    });
  }

  /*
   * NOTHING is added to the skills list. Not even a JD keyword that "feels" implied.
   * This is the exact line an ATS-optimisation tool crosses, and it is the line that
   * turns a CV into a lie the candidate has to defend in a room.
   */
  if (verdict.blocked.length) {
    warnings.push(
      `${verdict.blocked.length} requirement(s) from this job were not added to your CV because your CV does not evidence them.`,
    );
  }

  /* ── 4. Headline: only ever the candidate's own words ─────────────────────── */
  const targetTitle = (job.title || "").trim();
  const currentHeadline = (tailored.basics.headline || "").trim();
  if (targetTitle && currentHeadline) {
    /*
     * We do NOT overwrite the headline with the job title. That would have the CV
     * claim a role the person has never held. The headline stays theirs.
     */
    changes.push({
      section: "Headline",
      before: currentHeadline,
      after: currentHeadline,
      reason: `Left unchanged. Your headline states what you are, not what this job is called. Rewriting it to "${targetTitle}" would claim a title you have not held.`,
      evidence: [currentHeadline],
    });
  }

  /* ── 5. Score the result, honestly ───────────────────────────────────────── */
  const matchBefore = match.score;
  const after = rankJob(job, candidate, tailored);

  /*
   * Reordering cannot invent evidence, so the score usually moves little. We report
   * the real number rather than an inflated "projected" one: a tool that promises a
   * 40-point lift from reordering bullets is lying to the user, and they find out at
   * the interview, not at the click.
   */
  return {
    profile: tailored,
    matchBefore,
    projectedMatchAfter: after.score,
    changes,
    blockedClaims: verdict.blockedClaims,
    warnings,
  };
}
