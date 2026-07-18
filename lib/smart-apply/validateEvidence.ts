/*
 * lib/smart-apply/validateEvidence.ts
 *
 * The gate that makes "evidence-first generation" (spec 2.2) an enforced property
 * rather than a promise in a prompt.
 *
 * WHY THIS IS NOT A PROMPT INSTRUCTION
 *
 * "Do not invent skills" in a system prompt is a request. The model complies most
 * of the time, and the times it does not are exactly the times that matter: the JD
 * demands Kubernetes, the CV has none, and the tailored CV quietly grows a
 * Kubernetes bullet. The user sends it to an employer. In an interview they are
 * asked about the Kubernetes they never had, and WorkZo is the reason.
 *
 * So the rule is enforced structurally, on the OUTPUT, after generation:
 *
 *   A claim may appear in a generated document only if some requirement match
 *   carries status "matched" AND at least one line of verbatim CV evidence.
 *
 * Anything else is blocked, recorded in blockedClaims, and shown to the user. A
 * blocked claim is not a failure of the feature. It is the feature.
 */

import type { JobMatchResult, JobRequirementMatch } from "@/lib/jobs/types";
import { isSupportedByEvidence } from "@/lib/jobs/evidenceMatcher";
import { containsPhrase } from "@/lib/jobs/textStems";

export type EvidenceVerdict = {
  /** Requirements the CV genuinely supports. Safe to write into a document. */
  supported: JobRequirementMatch[];
  /** Requirements the JD wants that the CV does NOT support. Never write these. */
  blocked: JobRequirementMatch[];
  /** Human-readable, shown to the user (spec section 28). */
  blockedClaims: string[];
};

export function assessEvidence(match: JobMatchResult): EvidenceVerdict {
  const supported = match.requirements.filter(isSupportedByEvidence);

  /*
   * Partial counts as BLOCKED, not supported.
   *
   * "Partially proven" is an honest thing to tell the user in a gaps panel. It is
   * not a licence to assert the skill in a CV that goes to an employer. If the proof
   * is partial, the claim is partial, and a CV cannot make a partial claim: it either
   * says you know Kubernetes or it does not.
   */
  const blocked = match.requirements.filter(
    (r) => r.status === "missing" || r.status === "partial",
  );

  const blockedClaims = blocked.map((r) =>
    r.status === "partial"
      ? `${r.requirement} is only partially proven in your CV, so it was not asserted as a skill.`
      : `We did not add ${r.requirement} because it is not supported by your verified CV.`,
  );

  return { supported, blocked, blockedClaims };
}

/**
 * Final output scan.
 *
 * Even with a supported-only prompt, generated text can drift. This reads the
 * FINISHED document and reports any blocked requirement that appears in it anyway.
 * Nothing is trusted just because we asked nicely for it.
 *
 * Returns the list of violations, so the caller can strip them, regenerate, or fail
 * loudly. It never returns "probably fine".
 */
export function findUnsupportedClaims(
  documentText: string,
  verdict: EvidenceVerdict,
): string[] {
  const haystack = (documentText || "").toLowerCase();
  const violations: string[] = [];

  for (const req of verdict.blocked) {
    /*
     * Location and unverifiable items are not "claims" in this sense: a cover letter
     * may legitimately say "I am available to relocate to Munich", and the CV was
     * never the thing that could prove or disprove it. Only skill-shaped claims are
     * policed here.
     */
    if (req.category === "location" || req.status === "not_verifiable") continue;

    const name = req.requirement.replace(/\s*\(.*\)\s*$/, "").trim();
    if (name.length < 3) continue;

    if (containsPhrase(haystack, name.toLowerCase())) {
      violations.push(name);
    }
  }

  return [...new Set(violations)];
}

/**
 * Strip sentences that assert a blocked claim.
 *
 * Used as a last line of defence on generated prose. Deliberately blunt: it removes
 * the whole sentence rather than trying to surgically edit a claim out of it, because
 * a half-edited sentence is how "I have no experience with Kubernetes" becomes
 * "I have experience with Kubernetes".
 */
export function stripUnsupportedSentences(text: string, verdict: EvidenceVerdict): {
  text: string;
  removed: string[];
} {
  const blockedNames = verdict.blocked
    .filter((r) => r.category !== "location" && r.status !== "not_verifiable")
    .map((r) => r.requirement.replace(/\s*\(.*\)\s*$/, "").trim())
    .filter((n) => n.length >= 3);

  if (!blockedNames.length) return { text, removed: [] };

  const removed: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);

  const kept = sentences.filter((sentence) => {
    const lower = sentence.toLowerCase();
    const hit = blockedNames.find((name) => containsPhrase(lower, name.toLowerCase()));
    if (hit) {
      removed.push(hit);
      return false;
    }
    return true;
  });

  return { text: kept.join(" ").replace(/\s+/g, " ").trim(), removed: [...new Set(removed)] };
}
