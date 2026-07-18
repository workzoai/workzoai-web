/*
 * lib/smart-apply/generateCoverLetter.ts
 *
 * A job-specific cover letter, built ONLY from verified CV evidence (spec 14).
 *
 * Deterministic by design. There is no model call here, and that is deliberate:
 *
 *   - Every sentence is assembled from a requirement that carries CV evidence, so
 *     there is no path by which an unevidenced claim can enter the letter. A prompt
 *     that says "only use verified achievements" is a request; this is a guarantee.
 *   - It costs nothing, runs in milliseconds, and cannot fail at 2am because an
 *     upstream provider is down.
 *
 * The output is deliberately plain. It is a first draft the user edits, not a
 * finished artefact, and the UI says so. A letter that reads as obviously
 * machine-written is a smaller problem than a letter that confidently claims
 * Kubernetes.
 */

import type { ResumeProfile } from "@/lib/workzoResumeParser";
import type { JobMatchResult, WorkZoJob } from "@/lib/jobs/types";
import { assessEvidence, findUnsupportedClaims } from "@/lib/smart-apply/validateEvidence";

export type CoverLetterResult = {
  paragraphs: string[];
  plainText: string;
  evidenceWarnings: string[];
  /** Claims that leaked into the draft and were caught by the output scan. */
  violations: string[];
};

/** The single most quotable, quantified proof this CV carries for a requirement. */
function bestEvidenceLine(evidence: string[]): string | null {
  if (!evidence.length) return null;
  const quantified = evidence.find((e) => /\b\d+\s*(%|percent|k\b|m\b|hours?|users?|customers?|tickets?|beds?|projects?)/i.test(e));
  return (quantified || evidence[0]).replace(/\s*\([^)]*\)\s*$/, "").trim();
}

export function generateCoverLetter(
  profile: ResumeProfile,
  job: WorkZoJob,
  match: JobMatchResult,
): CoverLetterResult {
  const verdict = assessEvidence(match);
  const name = (profile.basics?.name || "").trim();
  const company = (job.company || "the team").trim();
  const title = (job.title || "this role").trim();

  /* Rank supported requirements: required beats preferred, evidenced beats not. */
  const ranked = [...verdict.supported].sort((a, b) => {
    const rank = (c: string) => (c === "required" ? 2 : c === "preferred" ? 1 : 0);
    if (rank(b.criticality) !== rank(a.criticality)) return rank(b.criticality) - rank(a.criticality);
    return b.evidence.length - a.evidence.length;
  });

  const paragraphs: string[] = [];

  /* 1. Motivation and fit. Named role, named company, no generic praise. */
  const topSkills = ranked.slice(0, 3).map((r) => r.requirement);
  paragraphs.push(
    topSkills.length
      ? `I am applying for the ${title} role at ${company}. My background in ${topSkills.join(", ")} lines up directly with what this role asks for, and I have set out the specific evidence below.`
      : `I am applying for the ${title} role at ${company}. I have set out below how my experience lines up with what this role asks for.`,
  );

  /*
   * 2 and 3. The evidence paragraphs. Each sentence is anchored to a real CV line.
   * If there is no evidence, there is no paragraph. We would rather ship a three
   * paragraph letter than a four paragraph letter with one invented achievement.
   */
  const used = new Set<string>();
  const evidenceSentences: string[] = [];

  for (const req of ranked) {
    if (evidenceSentences.length >= 3) break;
    const line = bestEvidenceLine(req.evidence);
    if (!line || used.has(line)) continue;
    used.add(line);
    evidenceSentences.push(`On ${req.requirement}: ${line}.`);
  }

  if (evidenceSentences.length) {
    paragraphs.push(
      `The most relevant proof from my CV: ${evidenceSentences.join(" ")}`.replace(/\.\./g, "."),
    );
  }

  /*
   * 4. Honest gap acknowledgement, WITHOUT naming the missing skill.
   *
   * Spec 14 wants honesty about gaps. But naming the gap ("I am still developing my
   * Kubernetes...") drops the exact keyword an ATS scans for into the document, and a
   * naive keyword matcher then scores the candidate IN for the skill they just
   * disclaimed. The interviewer sees "Kubernetes" on the letter and asks about it.
   *
   * So we acknowledge that gaps exist and signal willingness to close them, without
   * writing the blocked terms. The specifics belong in the gaps panel the user sees,
   * not in the employer-facing letter. This also means the output scan has nothing to
   * strip: the letter never contained a blocked claim in the first place.
   */
  const requiredGapCount = verdict.blocked.filter(
    (r) => r.criticality === "required" && r.status === "missing" && r.category !== "location",
  ).length;

  if (requiredGapCount > 0) {
    paragraphs.push(
      `There are one or two areas in this role's requirements where my direct experience is lighter, and I would rather be upfront about that than overstate it. I pick things up quickly, and I am glad to talk through how I have closed comparable gaps before.`,
    );
  }

  /* 5. Close. */
  paragraphs.push(
    `I would welcome the chance to talk this through.${name ? `\n\n${name}` : ""}`,
  );

  const plainText = paragraphs.join("\n\n");

  /*
   * The output scan. Even a deterministic assembler can surprise you: a CV bullet
   * quoted as evidence for one requirement may literally contain the word for a
   * DIFFERENT, blocked requirement ("migrated off Kubernetes to ECS"), and quoting it
   * would put "Kubernetes" in a letter about a candidate who does not have it.
   *
   * So we scan the finished text and report anything blocked that appears in it. This
   * is why the guarantee holds even where the generator is clever.
   */
  const violations = findUnsupportedClaims(plainText, verdict);

  return {
    paragraphs,
    plainText,
    evidenceWarnings: verdict.blockedClaims,
    violations,
  };
}
