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
  hiringSignal: "Strong" | "Promising" | "Mixed" | "At risk" | "Not enough signal";
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

function detectAnswerSignals(answer: string, question = ""): AnswerSignal {
  const text = cleanText(answer, 4000);
  const lower = text.toLowerCase();
  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;

  const hasMetric = /\b\d+(?:\.\d+)?\s*(%|percent|customers?|users?|tickets?|cases?|incidents?|hours?|days?|weeks?|months?|people|team members?|revenue|€|\$|kpis?|projects?|reports?|calls?|leads?)\b/i.test(text);
  const hasOwnership = /\b(i|my|me|owned|led|managed|built|created|implemented|coordinated|resolved|improved|reduced|handled|delivered|designed|developed|trained|mentored|analyzed|presented)\b/i.test(text);
  const hasStructure = /\b(situation|task|action|result|challenge|approach|outcome|impact|because|therefore|as a result)\b/i.test(text);
  const hasRoleFit = /\b(role|job|customer|client|stakeholder|team|business|quality|delivery|sales|support|data|product|operations|manufacturing|process|report|dashboard|communication)\b/i.test(text);
  const hasSpecificExample = /\b(example|project|case|incident|customer|client|team|product|system|process|issue|problem|deadline|release|escalation)\b/i.test(text);
  const fillerCount = countMatches(lower, /\b(um|uh|like|basically|actually|you know|kind of|sort of|maybe|i think)\b/g);
  const vagueTerms = countMatches(lower, /\b(various|many things|etc|stuff|some tasks|helped with|worked on things|responsible for things|good communication|hard working)\b/g);
  const isTooShort = wordCount > 0 && wordCount < 30;
  const isRambling = wordCount > 190;
  const isVague = vagueTerms > 0 || (!hasSpecificExample && wordCount < 70);

  let score = 46;
  if (wordCount >= 45 && wordCount <= 145) score += 10;
  if (hasMetric) score += 17;
  if (hasOwnership) score += 16;
  if (hasStructure) score += 10;
  if (hasRoleFit) score += 8;
  if (hasSpecificExample) score += 8;
  if (isTooShort) score -= 18;
  if (isVague) score -= 14;
  if (isRambling) score -= 12;
  if (fillerCount >= 4) score -= 7;
  if (!text) score = 0;

  const reasons = [
    !hasMetric && "missing measurable impact",
    !hasOwnership && "unclear personal ownership",
    !hasSpecificExample && "needs one concrete example",
    !hasStructure && "STAR structure is not obvious",
    isTooShort && "answer is too short",
    isRambling && "answer is too long",
    fillerCount >= 4 && "too many filler words",
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
    reasons: reasons.length ? reasons : ["clear enough, but can be sharper with stronger role connection"],
  };
}

function scoreLabel(score: number) {
  if (score >= 84) return "Strong";
  if (score >= 72) return "Promising";
  if (score >= 58) return "Mixed";
  if (score > 0) return "At risk";
  return "Not enough signal";
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
  const clarity = signals.length
    ? average(signals.map((s) => (s.isTooShort || s.isRambling ? 54 : Math.min(92, s.score + 5))))
    : clamp(Number(fallbackScores?.clarity ?? fallbackScores?.communication ?? 0));
  const ownership = signals.length
    ? average(signals.map((s) => (s.hasOwnership ? 82 : 45)))
    : clamp(Number(fallbackScores?.ownership ?? fallbackScores?.ownershipClarity ?? 0));
  const metrics = signals.length
    ? average(signals.map((s) => (s.hasMetric ? 84 : 42)))
    : clamp(Number(fallbackScores?.metrics ?? fallbackScores?.impactEvidence ?? 0));
  const structure = signals.length
    ? average(signals.map((s) => (s.hasStructure ? 78 : 48)))
    : clamp(Number(fallbackScores?.star ?? fallbackScores?.structure ?? 0));

  return [
    { label: "Clarity", value: clarity || 50, note: "How easy the answer was to follow." },
    { label: "Ownership", value: ownership || 50, note: "Whether your personal role was clear." },
    { label: "Metrics", value: metrics || 45, note: "Proof through numbers or measurable impact." },
    { label: "STAR", value: structure || 48, note: "Situation, task, action, result structure." },
  ];
}

function buildCoachingPlan(weakest: AnswerSignal, trust: number) {
  const plan: string[] = [];
  if (!weakest.hasMetric) plan.push("Add one number: %, time saved, cases handled, revenue, quality, delivery, or team impact.");
  if (!weakest.hasOwnership) plan.push("Make your personal ownership explicit: say what you decided, built, handled, or improved.");
  if (!weakest.hasStructure) plan.push("Use a 4-part STAR answer: situation → task → action → result.");
  if (!weakest.hasSpecificExample) plan.push("Use one real example instead of a general explanation.");
  if (weakest.isRambling) plan.push("Cut the answer to 60–90 seconds and end with the result.");
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
  const signals = answerPairs.map((pair) => detectAnswerSignals(pair.answer, pair.question));
  const strongest = signals.length ? signals.reduce((best, item) => (item.score > best.score ? item : best), signals[0]) : EMPTY_ANSWER;
  const weakest = signals.length ? signals.reduce((worst, item) => (item.score < worst.score ? item : worst), signals[0]) : EMPTY_ANSWER;
  const computedTrust = signals.length ? average(signals.map((s) => s.score)) : 0;
  const trust = clamp(Number(payload.recruiterTrust ?? payload.overallScore ?? computedTrust ?? 0)) || computedTrust || 50;
  const hiringSignal = scoreLabel(trust);
  const timeline = buildTimeline(signals, trust);
  const scoreCards = buildScoreCards(signals, payload.scores);

  const continuationVerdict =
    trust >= 84
      ? "Likely to continue — strong signal, now sharpen one high-impact story."
      : trust >= 72
        ? "Could continue — recruiter sees potential but needs stronger measurable proof."
        : trust >= 58
          ? "Borderline — the next answer must be more specific and evidence-based."
          : signals.length
            ? "Unlikely right now — recruiter confidence dropped because proof was too weak."
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
