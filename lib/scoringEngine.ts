/**
 * lib/scoringEngine.ts, FULL REPLACEMENT
 *
 * v3 ARCHITECTURE, STEP 17 (Scoring Engine)
 *
 * WHAT CHANGED vs original:
 * The previous version scored answers by matching English keywords
 * ("improved", "reduced", "increased"...). That is content-matching, not
 * structural evaluation, and it silently zeroed the impact signal for every
 * non-English interview, contradicting the multi-language requirement.
 *
 * This replacement scores STRUCTURE, which is language-neutral:
 *   - quantification: digits, percentages, currency, ranges
 *   - specificity: proper-noun density, dates/durations
 *   - development: answer length in words (unicode-aware), sentence count
 *   - vagueness: filler ratio via repetition + very short sentences
 *
 * The signature is kept API-compatible (evaluateAnswerScore, ScoringResult)
 * so every existing call site works unchanged. Scores remain internal -
 * the recruiter never argues with the candidate (weak answers reduce scores
 * silently; the ledger's pivot rule limits probing).
 */

type ScoringInput = {
  candidateAnswer: string;
  targetRole: string;
};

export type ScoringResult = {
  confidence: number;
  clarity: number;
  relevance: number;
  technicalDepth: number;
  measurableImpact: number;
  communication: number;
  recruiterTrust: number;
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

// Unicode-aware word split, counts words in any alphabetic script.
function words(text: string): string[] {
  return (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’\-+#./]*/gu) || []);
}

function sentences(text: string): string[] {
  return text.split(/[.!?。！？]+/).map((s) => s.trim()).filter((s) => s.length > 0);
}

/** Digits, %, currency symbols, and number-range structures. */
function quantificationSignal(text: string): number {
  const numbers = (text.match(/\d+(?:[.,]\d+)?/g) || []).length;
  const pct = (text.match(/\d\s?%|percent|prozent|por ciento|pour cent/gi) || []).length;
  const currency = (text.match(/[€$£¥₹]\s?\d|\d\s?(?:eur|usd|gbp)/gi) || []).length;
  return Math.min(1, (numbers * 0.15) + (pct * 0.25) + (currency * 0.25));
}

/** Mid-sentence capitalised tokens + date/duration structures. */
function specificitySignal(text: string): number {
  const ws = words(text);
  if (ws.length < 5) return 0;
  let proper = 0;
  for (let i = 1; i < ws.length; i++) {
    const w = ws[i];
    const prevEndsSentence = /[.!?]$/.test(ws[i - 1]);
    if (!prevEndsSentence && /^\p{Lu}\p{Ll}+/u.test(w)) proper++;
  }
  const dates = (text.match(/\b(19|20)\d{2}\b|\b\d+\s*(?:months?|years?|weeks?|monat|jahr|mois|ans?|meses?|años?|anni|jaar|jaren)\b/gi) || []).length;
  return Math.min(1, proper / Math.max(8, ws.length / 6) + dates * 0.15);
}

/** Repetition of identical tokens as a language-neutral vagueness proxy. */
function repetitionPenalty(text: string): number {
  const ws = words(text.toLowerCase()).filter((w) => w.length >= 4);
  if (ws.length < 10) return 0;
  const counts = new Map<string, number>();
  for (const w of ws) counts.set(w, (counts.get(w) || 0) + 1);
  let repeats = 0;
  for (const n of counts.values()) if (n >= 4) repeats += n - 3;
  return Math.min(0.4, repeats / ws.length);
}

export function evaluateAnswerScore({ candidateAnswer }: ScoringInput): ScoringResult {
  const text = (candidateAnswer || "").trim();
  const ws = words(text);
  const sents = sentences(text);

  const wordCount = ws.length;
  const isTooShort = wordCount < 12;
  const isDeveloped = wordCount >= 40;
  const isVeryDeveloped = wordCount >= 90;

  const quant = quantificationSignal(text);          // 0-1
  const specific = specificitySignal(text);          // 0-1
  const repPenalty = repetitionPenalty(text);        // 0-0.4
  const avgSentenceLen = sents.length ? wordCount / sents.length : wordCount;
  const structured = sents.length >= 2 && avgSentenceLen >= 6 && avgSentenceLen <= 35;

  const base =
    (isTooShort ? 30 : 55) +
    (isDeveloped ? 10 : 0) +
    (isVeryDeveloped ? 5 : 0) +
    (structured ? 8 : 0) -
    repPenalty * 40;

  const measurableImpact = clamp(base * 0.5 + quant * 55 + specific * 15);
  const clarity = clamp(base + (structured ? 8 : -5) - (avgSentenceLen > 40 ? 10 : 0));
  const relevance = clamp(base + specific * 20);
  const technicalDepth = clamp(base * 0.7 + specific * 25 + quant * 15);
  const communication = clamp(base + (structured ? 10 : 0) - repPenalty * 30);
  const confidence = clamp(base + (isTooShort ? -15 : 5) + quant * 10);
  const recruiterTrust = clamp(
    0.3 * measurableImpact + 0.25 * relevance + 0.25 * communication + 0.2 * clarity,
  );

  return {
    confidence,
    clarity,
    relevance,
    technicalDepth,
    measurableImpact,
    communication,
    recruiterTrust,
  };
}
