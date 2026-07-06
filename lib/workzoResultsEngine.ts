// lib/workzoResultsEngine.ts

export type TranscriptRole = "recruiter" | "candidate" | "system" | string;

export type TranscriptItem = {
  role: TranscriptRole;
  text: string;
  time?: string;
  timestamp?: string;
};

export type ResultScores = Record<string, number | undefined>;

export type ResultSetup = {
  targetRole?: string;
  targetMarket?: string;
  recruiterPersonality?: string;
  recruiterId?: string;
  companyStyle?: string;
  interviewAtmosphere?: string;
};

export type ResultPayload = {
  transcript?: TranscriptItem[];
  recruiterTrust?: number;
  overallScore?: number;
  pressure?: number;
  scores?: ResultScores;
  setup?: ResultSetup;
  memory?: Record<string, unknown>;
};

export type AnswerSignal = {
  answer: string;
  question: string;
  score: number;
  wordCount: number;
  hasMetric: boolean;
  hasOwnership: boolean;
  hasStructure: boolean;
  hasRoleFit: boolean;
  hasSpecificExample: boolean;
  isVague: boolean;
  isTooShort: boolean;
  isRambling: boolean;
  fillerCount: number;
  reasons: string[];
};

export type TrustTimelinePoint = {
  id: string;
  label: string;
  recruiterMood: "Curious" | "Interested" | "Skeptical" | "Concerned" | "Recovering" | "Impressed" | "Neutral";
  type: "increase" | "drop" | "neutral" | "recovery";
  score: number;
  delta: number;
  reason: string;
  evidence: string;
};

export type ResultsInsight = {
  trust: number;
  hiringSignal: string;
  continuationVerdict: string;
  recruiterSummary: string;
  strongestAnswer: AnswerSignal;
  weakestAnswer: AnswerSignal;
  strongestMoment: string;
  weakestMoment: string;
  trustTimeline: TrustTimelinePoint[];
  scoreCards: Array<{ label: string; value: number; note: string }>;
  coachingPlan: string[];
  recruiterMemory: Array<{ label: string; value: string; tone: "positive" | "warning" | "neutral" }>;
  atmosphere: Array<{ label: string; value: string }>;
  trustDropReasons: string[];
  trustRecoveryReasons: string[];
  repeatedPatterns: Array<{ label: string; count: number; reason: string }>;
  unsupportedClaimSignals: string[];
  topFixesBeforeRealInterview: string[];
};

export type AnswerComparison = {
  oldScore: number;
  newScore: number;
  trustDelta: number;
  improved: boolean;
  message: string;
  checklist: string[];
};

const EMPTY_ANSWER: AnswerSignal = {
  answer: "No answer captured yet.",
  question: "Complete an interview to generate answer analysis.",
  score: 0,
  wordCount: 0,
  hasMetric: false,
  hasOwnership: false,
  hasStructure: false,
  hasRoleFit: false,
  hasSpecificExample: false,
  isVague: true,
  isTooShort: true,
  isRambling: false,
  fillerCount: 0,
  reasons: ["Not enough interview data captured."],
};

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function cleanText(value: unknown, max = 5000) {
  if (typeof value !== "string") return "";
  return value
    .replace(/\u0000/g, " ")
    .replace(/[\t ]+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function normalizeRole(role: unknown): "recruiter" | "candidate" | "system" {
  const raw = String(role || "").toLowerCase();
  if (["candidate", "user", "me", "you", "applicant"].some((x) => raw.includes(x))) return "candidate";
  if (["recruiter", "assistant", "ai", "interviewer", "bot"].some((x) => raw.includes(x))) return "recruiter";
  return "system";
}

export function normalizeTranscript(transcript?: TranscriptItem[]) {
  if (!Array.isArray(transcript)) return [];
  return transcript
    .map((item, index) => ({
      id: `turn-${index}`,
      role: normalizeRole(item.role),
      text: cleanText(item.text, 2500),
      time: item.time || item.timestamp || "",
    }))
    .filter((item) => item.text.length > 0);
}

function getAnswerPairs(transcript?: TranscriptItem[]) {
  const normalized = normalizeTranscript(transcript);
  const pairs: Array<{ question: string; answer: string }> = [];
  let lastQuestion = "Tell me about your background for this role.";

  for (const item of normalized) {
    if (item.role === "recruiter") {
      lastQuestion = item.text;
      continue;
    }
    if (item.role === "candidate") {
      pairs.push({ question: lastQuestion, answer: item.text });
    }
  }

  return pairs;
}

function countMatches(text: string, regex: RegExp) {
  return (text.match(regex) || []).length;
}

function detectAnswerSignals(answer: string, question = "", opts: { isTruncated?: boolean } = {}): AnswerSignal {
  const text = cleanText(answer, 4000);
  const lower = text.toLowerCase();
  const words = text ? text.split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length;

  // ── STT-robust, language-neutral METRIC detection ─────────────────────────
  // The old regex required a number IMMEDIATELY followed by an English unit
  // word, so speech-to-text noise ("96, 97 out of 100" → "$96.97, customers")
  // and any non-English answer scored as "no metric". This version counts a
  // metric whenever the answer contains quantified proof in ANY language:
  // a percentage, a currency amount, a "N out of M" pattern, or simply a
  // number sitting near an outcome-ish token in the same clause.
  const hasPercent = /\d+(?:[.,]\d+)?\s*(%|percent|percentage|prozent|por ?ciento|pour ?cent|per ?cento)/i.test(text);
  const hasCurrency = /[€$£¥₹]\s?\d|\d[\d.,]*\s?(eur|usd|gbp|inr|dollars?|euros?|rupees?)/i.test(text);
  const hasOutOf = /\b\d+(?:[.,]\d+)?\s*(?:out of|of|\/|von|sur|su|de)\s*\d+/i.test(text);
  const numberCount = (text.match(/\b\d+(?:[.,]\d+)?\b/g) || []).length;
  // A number appearing anywhere in a substantive answer is treated as
  // quantified proof (STT frequently fractures the surrounding unit words).
  const hasLooseNumber = numberCount >= 1 && wordCount >= 20;
  const hasMetric = hasPercent || hasCurrency || hasOutOf || hasLooseNumber;

  // ── OWNERSHIP, first-person action, language-tolerant ────────────────────
  // Keep the English action-verb signal but also accept first-person pronouns
  // across the platform's languages so non-English answers aren't zeroed.
  const hasOwnership =
    /\b(i|my|me|we|our|owned|led|managed|built|created|implemented|coordinated|resolved|improved|reduced|handled|delivered|designed|developed|trained|mentored|analy[sz]ed|presented)\b/i.test(text) ||
    /\b(ich|mein|wir|unser|je|mon|nous|notre|yo|mi|mí|nosotros|io|mio|noi|ik|mijn|wij)\b/i.test(text);

  const hasStructure = /\b(situation|task|action|result|challenge|approach|outcome|impact|because|therefore|as a result|so that|which meant|led to|so i|then i)\b/i.test(text);
  const hasRoleFit = /\b(role|job|customer|client|stakeholder|team|business|quality|delivery|sales|support|data|product|operations|manufacturing|process|report|dashboard|communication|onboarding|retention|escalation)\b/i.test(text);
  const hasSpecificExample = /\b(example|project|case|incident|customer|client|team|product|system|process|issue|problem|deadline|release|escalation|one time|there was|situation where)\b/i.test(text) ||
    // A concrete narrative usually names a length or has past-tense verbs.
    /\b(i (tried|took|checked|involved|sent|closed|handled|resolved|fixed|worked))\b/i.test(text);

  const fillerCount = countMatches(lower, /\b(um|uh|like|basically|actually|you know|kind of|sort of)\b/g);
  const vagueTerms = countMatches(lower, /\b(various|many things|etc|stuff|some tasks|helped with|worked on things|responsible for things|good communication|hard working)\b/g);

  // Cut-off awareness: an answer truncated by the app's own closing bug must
  // not be scored as "too short", that would penalise the candidate for the
  // interview being cut off mid-sentence.
  const isTruncated = !!opts.isTruncated;
  const isTooShort = !isTruncated && wordCount > 0 && wordCount < 22;
  const isRambling = wordCount > 220;
  const isVague = vagueTerms > 0 || (!hasSpecificExample && wordCount < 55);

  // ── Calibrated scoring ────────────────────────────────────────────────────
  // Target: a substantive-but-imperfect answer lands in the mid-60s; a strong,
  // specific, quantified answer reaches the high-70s/low-80s; a genuinely weak
  // or evasive answer stays clearly below 55. Voice filler is NOT penalised
  // (natural speech always has "um/uh").
  let score = 48;
  if (wordCount >= 40 && wordCount <= 170) score += 7;   // developed answer
  else if (wordCount >= 25) score += 4;                  // at least substantive
  if (hasMetric) score += 9;
  if (hasOwnership) score += 5;
  if (hasStructure) score += 5;
  if (hasRoleFit) score += 3;
  if (hasSpecificExample) score += 6;
  if (isTooShort) score -= 16;
  if (isVague) score -= 12;
  if (isRambling) score -= 6;
  if (fillerCount >= 10) score -= 3;
  if (!text) score = 0;

  const reasons = [
    !hasMetric && "add one measurable detail (a number, %, or before/after)",
    !hasOwnership && "make your personal role a little clearer",
    !hasSpecificExample && "anchor it in one concrete example",
    !hasStructure && "a quick situation → action → result arc would sharpen it",
    isTooShort && "give it a bit more detail",
    isRambling && "tighten it toward the key result",
  ].filter(Boolean) as string[];

  return {
    answer: text || EMPTY_ANSWER.answer,
    question: cleanText(question, 1200) || EMPTY_ANSWER.question,
    score: clamp(score),
    wordCount,
    hasMetric,
    hasOwnership,
    hasStructure,
    hasRoleFit,
    hasSpecificExample,
    isVague,
    isTooShort,
    isRambling,
    fillerCount,
    reasons: reasons.length ? reasons : ["strong answer, keep this one, and connect it even more directly to the target role"],
  };
}

function scoreLabel(score: number) {
  if (score >= 82) return "Strong";
  if (score >= 68) return "Solid, nearly there";
  if (score >= 55) return "Promising, a few sharpens away";
  if (score > 0) return "Early, good foundation to build on";
  return "Not yet scored";
}


function uniq(values: string[], limit = 8) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const clean = cleanText(raw, 260);
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= limit) break;
  }
  return out;
}

function detectUnsupportedClaimSignals(transcript?: TranscriptItem[]) {
  const normalized = normalizeTranscript(transcript);
  const recruiterLines = normalized
    .filter((item) => item.role === "recruiter")
    .map((item) => item.text);

  const signals: string[] = [];
  for (const line of recruiterLines) {
    if (/resume|cv|information we started with|doesn'?t align|not align|not reflected|don'?t see|do not see|clarify|timeline|career stage/i.test(line)) {
      signals.push(line);
    }
  }
  return uniq(signals, 5);
}

function buildRepeatedPatterns(signals: AnswerSignal[], unsupportedClaims: string[]) {
  const missingMetrics = signals.filter((item) => !item.hasMetric && item.score > 0).length;
  const unclearOwnership = signals.filter((item) => !item.hasOwnership && item.score > 0).length;
  const vagueAnswers = signals.filter((item) => item.isVague && item.score > 0).length;
  const ramblingAnswers = signals.filter((item) => item.isRambling).length;
  const tooShortAnswers = signals.filter((item) => item.isTooShort).length;

  return [
    missingMetrics >= 2 && {
      label: "Metrics avoidance",
      count: missingMetrics,
      reason: "Several answers described impact without numbers, scale, or measurable outcomes.",
    },
    unclearOwnership >= 2 && {
      label: "Ownership unclear",
      count: unclearOwnership,
      reason: "The recruiter repeatedly had to infer what the candidate personally did.",
    },
    vagueAnswers >= 2 && {
      label: "Vague examples",
      count: vagueAnswers,
      reason: "Answers sounded general instead of anchored in one specific situation.",
    },
    ramblingAnswers >= 1 && {
      label: "Rambling risk",
      count: ramblingAnswers,
      reason: "At least one answer likely felt too long or unfocused for a live interview.",
    },
    tooShortAnswers >= 2 && {
      label: "Too little detail",
      count: tooShortAnswers,
      reason: "Multiple answers were too short to build recruiter confidence.",
    },
    unsupportedClaims.length > 0 && {
      label: "CV consistency concern",
      count: unsupportedClaims.length,
      reason: "The recruiter detected claims or timeline details that needed clarification against the CV.",
    },
  ].filter(Boolean) as Array<{ label: string; count: number; reason: string }>;
}

function buildTrustDropReasons(signals: AnswerSignal[], unsupportedClaims: string[]) {
  const reasons: string[] = [];
  if (unsupportedClaims.length) reasons.push("One or more claims needed clarification against the CV or career timeline.");
  if (signals.some((item) => !item.hasMetric && item.score > 0)) reasons.push("Answers often missed measurable impact, such as numbers, scale, or business outcome.");
  if (signals.some((item) => !item.hasOwnership && item.score > 0)) reasons.push("Personal ownership was not always clear enough for a recruiter.");
  if (signals.some((item) => item.isVague)) reasons.push("Some answers were too general and lacked one concrete example.");
  if (signals.some((item) => item.isRambling)) reasons.push("At least one answer likely felt too long or unfocused.");
  if (signals.some((item) => item.isTooShort)) reasons.push("At least one answer ended before the recruiter had enough evidence.");
  return uniq(reasons, 6);
}

function buildTrustRecoveryReasons(signals: AnswerSignal[]) {
  const reasons: string[] = [];
  if (signals.some((item) => item.hasMetric && item.score >= 70)) reasons.push("Trust recovered when the candidate used measurable proof.");
  if (signals.some((item) => item.hasOwnership && item.score >= 70)) reasons.push("The recruiter became more confident when personal responsibility was clear.");
  if (signals.some((item) => item.hasSpecificExample && item.hasStructure)) reasons.push("Specific examples with a clear situation/action/result improved the hiring signal.");
  if (signals.some((item) => item.hasRoleFit && item.score >= 70)) reasons.push("Role-relevant details helped the recruiter connect the answer to the job.");
  return uniq(reasons.length ? reasons : ["No clear recovery moment was captured yet. The next attempt should add one strong proof story."], 5);
}

function buildTopFixesBeforeRealInterview(weakest: AnswerSignal, patterns: Array<{ label: string; count: number; reason: string }>, unsupportedClaims: string[]) {
  const fixes: string[] = [];
  if (unsupportedClaims.length) fixes.push("Clarify any career timeline or experience claim that does not clearly appear in the CV.");
  if (!weakest.hasMetric || patterns.some((p) => /metrics/i.test(p.label))) fixes.push("Prepare 2-3 measurable outcomes: %, time saved, tickets handled, revenue, quality, delivery, or users impacted.");
  if (!weakest.hasOwnership || patterns.some((p) => /ownership/i.test(p.label))) fixes.push("Rewrite examples with stronger ‘I did…’ ownership instead of only team-level wording.");
  if (!weakest.hasStructure) fixes.push("Use STAR: situation → task → action → result, and end with impact.");
  if (weakest.isVague || patterns.some((p) => /vague/i.test(p.label))) fixes.push("Replace generic explanations with one concrete story from a real project, client, or problem.");
  if (weakest.isRambling) fixes.push("Keep key answers under 90 seconds and stop after the result.");
  return uniq(fixes.length ? fixes : ["Keep the strongest answer, but make the link to the job description more explicit."], 5);
}

function buildTimeline(answerSignals: AnswerSignal[], finalTrust: number): TrustTimelinePoint[] {
  if (answerSignals.length === 0) {
    const base = clamp(finalTrust || 50);
    return [
      {
        id: "timeline-empty",
        label: "Interview not completed",
        recruiterMood: "Neutral",
        type: "neutral",
        score: base,
        delta: 0,
        reason: "Complete an interview to see where recruiter trust rose or dropped.",
        evidence: "No candidate answer captured yet.",
      },
    ];
  }

  let running = clamp(Math.max(42, Math.min(70, finalTrust - 10)));
  return answerSignals.slice(0, 7).map((signal, index) => {
    let delta = 0;
    let type: TrustTimelinePoint["type"] = "neutral";
    let mood: TrustTimelinePoint["recruiterMood"] = "Neutral";
    let label = "Evidence check";
    let reason = "The recruiter evaluated clarity, ownership, metrics, and role fit.";

    if (signal.score >= 82) {
      delta = 9;
      type = "increase";
      mood = "Impressed";
      label = "Trust increased";
      reason = "Answer had credible signal with structure, ownership, or measurable proof.";
    } else if (signal.score >= 70) {
      delta = 5;
      type = "increase";
      mood = "Interested";
      label = "Recruiter leaned in";
      reason = "Answer showed useful role relevance, but still needs sharper proof.";
    } else if (signal.score >= 58) {
      delta = index > 0 && answerSignals[index - 1]?.score < 55 ? 4 : 0;
      type = delta > 0 ? "recovery" : "neutral";
      mood = delta > 0 ? "Recovering" : "Curious";
      label = delta > 0 ? "Small recovery" : "Still evaluating";
      reason = "Answer gave some evidence, but the recruiter would still probe for metrics and ownership.";
    } else {
      delta = signal.isTooShort ? -10 : -8;
      type = "drop";
      mood = signal.isVague ? "Skeptical" : "Concerned";
      label = signal.isVague ? "Trust dropped" : "Proof gap";
      reason = signal.reasons[0] || "Answer did not give enough proof.";
    }

    running = clamp(running + delta);
    return {
      id: `timeline-${index}-${signal.score}`,
      label,
      recruiterMood: mood,
      type,
      score: running,
      delta,
      reason,
      evidence: signal.answer.slice(0, 170),
    };
  });
}

function average(values: number[]) {
  if (!values.length) return 0;
  return clamp(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function buildScoreCards(signals: AnswerSignal[], fallbackScores?: ResultScores) {
  // Gentler present/absent spreads: a single missing signal should nudge a
  // category, not collapse it. Absent floors sit in the high-50s (a fair
  // "room to grow"), present values in the low-80s.
  const clarity = signals.length
    ? average(signals.map((s) => (s.isTooShort || s.isRambling ? 60 : Math.min(92, s.score + 6))))
    : clamp(Number(fallbackScores?.clarity ?? fallbackScores?.communication ?? 0));
  const ownership = signals.length
    ? average(signals.map((s) => (s.hasOwnership ? 82 : 60)))
    : clamp(Number(fallbackScores?.ownership ?? fallbackScores?.ownershipClarity ?? 0));
  const metrics = signals.length
    ? average(signals.map((s) => (s.hasMetric ? 83 : 58)))
    : clamp(Number(fallbackScores?.metrics ?? fallbackScores?.impactEvidence ?? 0));
  const structure = signals.length
    ? average(signals.map((s) => (s.hasStructure ? 80 : 60)))
    : clamp(Number(fallbackScores?.star ?? fallbackScores?.structure ?? 0));

  return [
    { label: "Clarity", value: clarity || 60, note: "How easy your answers were to follow." },
    { label: "Ownership", value: ownership || 60, note: "How clearly your personal role came through." },
    { label: "Metrics", value: metrics || 58, note: "Proof through numbers or measurable impact." },
    { label: "STAR", value: structure || 60, note: "Situation, task, action, result structure." },
  ];
}

function buildCoachingPlan(weakest: AnswerSignal, trust: number) {
  const plan: string[] = [];
  if (!weakest.hasMetric) plan.push("Add one number: %, time saved, cases handled, revenue, quality, delivery, or team impact.");
  if (!weakest.hasOwnership) plan.push("Make your personal ownership explicit: say what you decided, built, handled, or improved.");
  if (!weakest.hasStructure) plan.push("Use a 4-part STAR answer: situation → task → action → result.");
  if (!weakest.hasSpecificExample) plan.push("Use one real example instead of a general explanation.");
  if (weakest.isRambling) plan.push("Cut the answer to 60-90 seconds and end with the result.");
  if (trust < 65) plan.push("Prepare one stronger proof story before the next interview round.");
  return plan.slice(0, 5).length ? plan.slice(0, 5) : ["Keep this answer, but connect it more directly to the job description."];
}

function buildRecruiterMemory(strongest: AnswerSignal, weakest: AnswerSignal, trust: number) {
  return [
    {
      label: "Strongest remembered signal",
      value:
        strongest.score > 0
          ? strongest.hasMetric
            ? "You gave at least one answer with measurable proof. Recruiters remember concrete outcomes."
            : "You showed some useful role relevance, but the proof could be sharper."
          : "No strong answer captured yet.",
      tone: "positive" as const,
    },
    {
      label: "Main recruiter doubt",
      value: weakest.reasons[0] || "The recruiter still needs stronger proof before feeling confident.",
      tone: "warning" as const,
    },
    {
      label: "Next-session memory",
      value:
        trust >= 75
          ? "Next time, the recruiter should test consistency under pressure rather than basic fit."
          : "Next time, the recruiter should return to ownership, metrics, and one concrete example.",
      tone: "neutral" as const,
    },
  ];
}

function buildAtmosphere(payload: ResultPayload, trust: number, answerCount: number) {
  const pressure = clamp(Number(payload.pressure ?? payload.scores?.pressureHandling ?? 0)) || (trust < 65 ? 72 : 55);
  return [
    { label: "Pressure", value: `${pressure}/100` },
    { label: "Questions answered", value: String(answerCount) },
    { label: "Recruiter stance", value: trust >= 75 ? "Interested" : trust >= 60 ? "Testing proof" : "Skeptical" },
    { label: "Recovery path", value: trust >= 75 ? "Refine" : "Retry weak answer" },
  ];
}

export function buildResultsInsight(payload: ResultPayload): ResultsInsight {
  const answerPairs = getAnswerPairs(payload.transcript);
  // The final answer is treated as possibly truncated: interviews can end
  // (timer/closing) while the candidate is mid-sentence, and that last answer
  // should not be scored as "too short", that penalises the candidate for the
  // interview being cut off, not for their answer.
  const signals = answerPairs.map((pair, i) =>
    detectAnswerSignals(pair.answer, pair.question, { isTruncated: i === answerPairs.length - 1 }),
  );
  const strongest = signals.length ? signals.reduce((best, item) => (item.score > best.score ? item : best), signals[0]) : EMPTY_ANSWER;
  const weakest = signals.length ? signals.reduce((worst, item) => (item.score < worst.score ? item : worst), signals[0]) : EMPTY_ANSWER;
  const computedTrust = signals.length ? average(signals.map((s) => s.score)) : 0;
  // Blend the recruiter's live trust score with the recalibrated answer-quality
  // score rather than letting live trust dominate. The live LLM trust runs
  // harsh (it drops fast on any hesitation and rarely fully recovers), so on
  // its own it produced discouraging overalls that ignored genuinely solid
  // answers. Weighting answer quality at 60% keeps the number honest but fair,
  // and anchored to what the candidate actually said. If no live trust is
  // present, fall back to the computed score alone.
  const rawTrust = Number(payload.recruiterTrust ?? payload.overallScore);
  const hasLiveTrust = Number.isFinite(rawTrust) && rawTrust > 0;
  const trust = hasLiveTrust
    ? clamp(0.6 * (computedTrust || 50) + 0.4 * clamp(rawTrust))
    : (computedTrust || 50);
  const hiringSignal = scoreLabel(trust);
  const timeline = buildTimeline(signals, trust);
  const scoreCards = buildScoreCards(signals, payload.scores);
  const unsupportedClaimSignals = detectUnsupportedClaimSignals(payload.transcript);
  const repeatedPatterns = buildRepeatedPatterns(signals, unsupportedClaimSignals);
  const trustDropReasons = buildTrustDropReasons(signals, unsupportedClaimSignals);
  const trustRecoveryReasons = buildTrustRecoveryReasons(signals);
  const topFixesBeforeRealInterview = buildTopFixesBeforeRealInterview(weakest, repeatedPatterns, unsupportedClaimSignals);

  const continuationVerdict =
    trust >= 84
      ? "Likely to continue, strong signal, now sharpen one high-impact story."
      : trust >= 72
        ? "Could continue, recruiter sees potential but needs stronger measurable proof."
        : trust >= 58
          ? "Borderline, the next answer must be more specific and evidence-based."
          : signals.length
            ? "Unlikely right now, recruiter confidence dropped because proof was too weak."
            : "Not enough interview data yet.";

  const recruiterSummary =
    trust >= 84
      ? "The interview created credible hiring signal. Your best answers sounded specific and recruiter-safe."
      : trust >= 72
        ? "The recruiter found useful fit, but still has unanswered doubts around metrics, ownership, or role-specific examples."
        : trust >= 58
          ? "The recruiter sees possible fit, but the answers need clearer proof before they feel interview-ready."
          : signals.length
            ? "The recruiter did not receive enough concrete evidence yet. The next attempt should focus on one strong proof story."
            : "Complete an interview to generate emotional recruiter feedback.";

  return {
    trust,
    hiringSignal,
    continuationVerdict,
    recruiterSummary,
    strongestAnswer: strongest,
    weakestAnswer: weakest,
    strongestMoment: strongest.score > 0 ? strongest.answer : "No strong moment captured yet.",
    weakestMoment: weakest.reasons.join(", "),
    trustTimeline: timeline,
    scoreCards,
    coachingPlan: buildCoachingPlan(weakest, trust),
    recruiterMemory: buildRecruiterMemory(strongest, weakest, trust),
    atmosphere: buildAtmosphere(payload, trust, signals.length),
    trustDropReasons,
    trustRecoveryReasons,
    repeatedPatterns,
    unsupportedClaimSignals,
    topFixesBeforeRealInterview,
  };
}

export function compareRetryAnswer(oldAnswer: string, newAnswer: string): AnswerComparison {
  const oldSignals = detectAnswerSignals(oldAnswer);
  const newSignals = detectAnswerSignals(newAnswer);
  const delta = clamp(newSignals.score - oldSignals.score, -100, 100);

  const checklist = [
    newSignals.hasMetric ? "Metric added" : "Still missing a metric",
    newSignals.hasOwnership ? "Ownership clearer" : "Ownership still unclear",
    newSignals.hasStructure ? "Structure improved" : "STAR structure still weak",
    newSignals.hasSpecificExample ? "Specific example present" : "Needs a concrete example",
  ];

  return {
    oldScore: oldSignals.score,
    newScore: newSignals.score,
    trustDelta: delta,
    improved: delta > 0,
    checklist,
    message:
      delta >= 18
        ? "Strong recovery. A recruiter would feel noticeably more confident after this rewrite."
        : delta >= 8
          ? "Good improvement. Add one sharper result to make the answer stronger."
          : delta > 0
            ? "Slight improvement. It still needs clearer proof and ownership."
            : "Still weak. Make it more specific, shorter, and evidence-based.",
  };
}
