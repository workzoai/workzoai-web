/**
 * workzoLinkedInRewriteGuard.ts
 *
 * Deterministic post-processing for the AI LinkedIn rewrite (item 5).
 *
 * WHY A GUARD AND NOT A BETTER PROMPT
 * -----------------------------------
 * The rewrite prompt tells the model, in plain language, never to claim a skill
 * the CV does not evidence and never to invent a metric. Models mostly comply.
 * "Mostly" is not a property you can ship into a document a recruiter reads
 * before an interview, because the failure mode is not a bad sentence — it is a
 * candidate who confidently walks into a room having claimed Power BI on a
 * profile WorkZo wrote for them.
 *
 * So the prompt is a request and this file is the enforcement. Every sentence
 * of model output is checked against the CV. Anything unprovable is removed,
 * not softened. This mirrors `guardResumeAgainstSource` in the CV rewrite path,
 * for the same reason.
 *
 * WHAT COUNTS AS EVIDENCE
 * -----------------------
 * The candidate's own CV text and parsed profile, and nothing else. Not the JD.
 * Not the model's inference. Not the existing LinkedIn profile — that is the
 * document under repair, and treating it as evidence would let a keyword the
 * candidate already over-claimed launder itself into the rewrite.
 */

import { normalizeTerm } from "@/lib/workzoLinkedInEngine";

export type GuardViolation = {
  /** Where the offending text was found. */
  where: "headline" | "about";
  reason: "forbidden_keyword" | "unevidenced_number";
  /** The keyword or number that triggered removal. */
  offender: string;
  /** The text that was dropped. */
  removed: string;
};

export type RewriteGuardResult = {
  headline: string;
  about: string;
  violations: GuardViolation[];
};

/** Word-boundary containment over a normalized haystack. */
function contains(haystack: string, needle: string): boolean {
  if (!needle) return false;
  return ` ${haystack} `.includes(` ${needle} `);
}

/**
 * Every number the CV actually supports, as literal digit strings.
 *
 * We compare digit strings rather than parsed values on purpose. "Reduced churn
 * by 30%" and "Reduced churn by 3%" are different claims, and a numeric
 * tolerance would let the model round its way into a lie.
 */
function evidencedNumbers(evidence: string): Set<string> {
  return new Set(evidence.match(/\d+(?:[.,]\d+)?/g) ?? []);
}

/** Numbers that are structural rather than claims: years, small counts. */
function isBenignNumber(token: string, sentence: string): boolean {
  // A four-digit year is a date, not a performance metric.
  if (/^(19|20)\d{2}$/.test(token)) return true;
  // "over 5 years" style tenure is checkable against the CV's own dates
  // elsewhere; it is not a fabricated achievement metric.
  return new RegExp(`${token}\\+?\\s*(years?|yrs?|jahre)`, "i").test(sentence);
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Guard the model's rewrite.
 *
 * @param forbidden Canonical terms the CV cannot support — the `gaps` bucket
 *                  from the JD match. These must never appear in the output.
 * @param evidence  Raw CV text plus the parsed profile, already concatenated.
 */
export function guardLinkedInRewrite(input: {
  headline: string;
  about: string;
  forbidden: string[];
  evidence: string;
}): RewriteGuardResult {
  const { headline, about, forbidden, evidence } = input;

  const normalizedEvidence = normalizeTerm(evidence);
  const numbers = evidencedNumbers(evidence);
  const banned = forbidden.map(normalizeTerm).filter(Boolean);
  const violations: GuardViolation[] = [];

  // ── Headline ───────────────────────────────────────────────────────────────
  // Headlines are pipe-separated keyword lists, so a violation can be excised
  // segment by segment without destroying the rest.
  const segments = headline
    .split(/\s*[|•·]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  const keptSegments = segments.filter((segment) => {
    const normalized = normalizeTerm(segment);
    const offender = banned.find((term) => contains(normalized, term));
    if (offender) {
      violations.push({ where: "headline", reason: "forbidden_keyword", offender, removed: segment });
      return false;
    }
    return true;
  });

  // ── About ──────────────────────────────────────────────────────────────────
  // Sentences are the smallest unit that survives removal intact. Excising a
  // clause leaves ungrammatical text; excising a sentence leaves prose.
  const keptSentences = splitSentences(about).filter((sentence) => {
    const normalized = normalizeTerm(sentence);

    const bannedTerm = banned.find((term) => contains(normalized, term));
    if (bannedTerm) {
      violations.push({ where: "about", reason: "forbidden_keyword", offender: bannedTerm, removed: sentence });
      return false;
    }

    for (const token of sentence.match(/\d+(?:[.,]\d+)?/g) ?? []) {
      if (numbers.has(token) || isBenignNumber(token, sentence)) continue;
      violations.push({ where: "about", reason: "unevidenced_number", offender: token, removed: sentence });
      return false;
    }

    return true;
  });

  return {
    headline: keptSegments.join(" | "),
    about: keptSentences.join(" "),
    violations,
  };
}
