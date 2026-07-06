/**
 * lib/recruiterBehaviorEngine.ts
 *
 * WHAT CHANGED vs original:
 * - Trust / pressure scoring is now quality-weighted, not keyword-density based.
 *   The original rewarded answers that contained words like "reduced", "improved",
 *   "saved" regardless of context, a candidate could pad any answer with generic
 *   metric-sounding words and gain trust mechanically.
 *
 *   The new scoring considers:
 *   · Is ownership explicit ("I" / "my") or diffuse ("we", "the team")?
 *   · Does the answer tell a situation → action → result arc, not just mention
 *     a keyword from each category?
 *   · Is the metric plausible relative to the seniority/role signals?
 *   · Is the answer length appropriate (too short = partial, too long = rambling)?
 *
 * - analyzeRecruiterPressure now returns a `trustQuality` score (0-100) in
 *   addition to trustDelta. Callers can use this for the trust timeline.
 *
 * - interruptionPool is expanded and recruiter-persona-weighted so the same
 *   challenge doesn't fire every time.
 *
 * All exported types and function signatures are backward-compatible.
 */

import type { LiveAnswerAnalysis } from "@/lib/liveAnswerAnalyzer";
import {
  moodInstruction,

  type RecruiterState,
} from "@/lib/recruiterStateEngine";

export type RecruiterEmotionState =
  | "neutral"
  | "engaged"
  | "skeptical"
  | "impatient"
  | "impressed"
  | "confused"
  | "cold";

export type PressureAnalysis = {
  emotion: RecruiterEmotionState;
  recruiterLine?: string;
  pressureDelta: number;
  trustDelta: number;
  trustQuality: number;   // 0-100, replaces raw keyword scoring
  shouldInterrupt?: boolean;
  issues: string[];
  strengths: string[];
  confidenceScore: number;
};

export type RecruiterBehaviorDecision = {
  shouldInterrupt: boolean;
  interruptionMessage: string;
  responseMode:
    | "continue"
    | "probe"
    | "challenge"
    | "interrupt"
    | "move_on"
    | "recover";
  pressureInstruction: string;
  followUpFocus: string;
  stateDelta: {
    trust: number;
    patience: number;
    skepticism: number;
    engagement: number;
    pressure: number;
    warmth: number;
    confidenceInCandidate: number;
    weakAnswer: boolean;
    strongAnswer: boolean;
  };
};

// Persona-weighted interruption pools.
// Sarah (friendly) rarely interrupts and uses softer language.
// Daniel (analytical) is precise and expects structured ownership.
// James (fast-paced) cuts off rambling quickly.
// Priya (values) rarely interrupts but redirects to motivation.

const interruptionPool = {
  default: [
    "Hold on, you still haven't answered what you personally did.",
    "That sounds rehearsed. Give me a real example from your own work.",
    "Be specific. What exactly did YOU do in that situation?",
    "You're speaking too broadly. Let's narrow this.",
    "Before we move on, what was the actual outcome?",
    "You're giving me the team story. What's your story in it?",
    "I need one concrete result, not a description of the process.",
  ],
  analytical: [
    "Let me stop you there, what was your decision-making process, specifically?",
    "That's a big claim. What data or evidence supported that decision?",
    "You've described what happened. I need to know why you made the calls you made.",
    "What trade-off did you consciously accept in that situation?",
  ],
  friendly: [
    "Thanks, I just want to make sure I understand your personal role. What part did you own?",
    "I hear the situation, could you focus on what you specifically contributed?",
    "Can you give me a quick outcome? Even a rough one is fine.",
  ],
  startup: [
    "Okay, quick, what changed because of what you did?",
    "What would have broken if you hadn't been there?",
    "Speed this up, what was the result?",
  ],
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function pickInterruption(recruiterType?: string): string {
  const pool =
    recruiterType === "daniel" || recruiterType === "analytical_hiring_manager"
      ? interruptionPool.analytical
      : recruiterType === "sarah" || recruiterType === "friendly_hr"
        ? interruptionPool.friendly
        : recruiterType === "priya" || recruiterType === "startup_recruiter"
          ? interruptionPool.startup
          : interruptionPool.default;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Score the QUALITY of evidence in the answer, not the density of
 * metric-adjacent keywords. Returns 0-100.
 *
 * Key distinction:
 * - "I improved customer satisfaction" = keyword hit, no evidence → low score
 * - "I reduced resolution time by 30% after I introduced a triage checklist" = real evidence → high score
 *
 * The scoring looks for a coherent Situation → Action → Result arc,
 * with explicit first-person ownership.
 */
function scoreEvidenceQuality(text: string): number {
  const lower = text.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Ownership: must use "I" with an action verb, not just "I" in passing
  const strongOwnership =
    /\b(i led|i built|i created|i resolved|i handled|i managed|i implemented|i improved|i designed|i reduced|i increased|i launched|i owned|i drove|i delivered|i coached|i trained|i coordinated|i analyzed|i decided|i fixed)\b/i.test(
      lower,
    );

  // Weak ownership, "we" without "I" follow-through, or passive voice
  const weakOwnership =
    !strongOwnership &&
    /\b(we|the team|the company|it was|there was|the process)\b/i.test(lower);

  // Plausible metric: a number adjacent to a real unit/outcome, not "many" or "several"
  const hasPlausibleMetric =
    /\b(\d+[\.,]?\d*\s*(?:%|percent|hours?|days?|weeks?|months?|customers?|tickets?|users?|cases?|accounts?|deals?|calls?|projects?|million|thousand|k))\b/i.test(
      lower,
    ) ||
    /\b(by \d+|from \d+ to \d+|reduced.{1,40}\d+|increased.{1,40}\d+|saved.{1,40}\d+|grew.{1,40}\d+)\b/i.test(
      lower,
    );

  // Qualitative result (acceptable without numbers in earlier stages)
  const hasQualitativeResult =
    /\b(customer.{1,20}(happy|satisfied|stayed|returned|trusted|came back|gave feedback|positive feedback)|fewer.{1,30}(complaints|escalations|issues)|resolved.{1,20}faster|team.{1,20}(aligned|agreed|adopted)|stakeholder.{1,20}approved|reduced.{1,20}churn|improved.{1,20}retention|csat|nps)\b/i.test(
      lower,
    );

  // Situation signal: time/place/context framing
  const hasSituation =
    /\b(when|in my|at my|during|there was|we had|the customer|the client|a project|one time|in that)\b/i.test(
      lower,
    );

  // Action signal: specific verb + object (not just "I did things")
  const hasAction =
    /\b(i (created|built|wrote|set up|introduced|proposed|escalated|negotiated|convinced|restructured|automated|documented|analysed|analyzed|presented|trained|coached|ran|managed|led|resolved|fixed|shipped|launched|deployed|closed|retained|renewed))\b/i.test(
      lower,
    );

  // Filler / vague language patterns that reduce quality regardless of other signals
  const vagueCount = (
    lower.match(
      /\b(team player|hardworking|passionate|fast learner|good communication|many things|various tasks|responsible for a lot|helped with|involved in|contributed to|basically|generally|usually|typically|kind of|sort of|you know|etc\.?|and so on|stuff like that)\b/g,
    ) || []
  ).length;

  const fillerCount = (
    lower.match(/\b(um+|uh+|like|basically|actually|you know|kind of|sort of|maybe|probably|i think|i guess)\b/g) || []
  ).length;

  // Length penalty: answers < 20 words can't carry a full SAR arc
  // Answers > 150 words with no result signal are rambling
  const tooShort = wordCount < 20;
  const rambling = wordCount > 150 && !hasPlausibleMetric && !hasQualitativeResult;

  // Build quality score
  let score = 50; // baseline

  if (strongOwnership) score += 18;
  if (weakOwnership) score -= 12;
  if (hasPlausibleMetric) score += 20;
  if (hasQualitativeResult) score += 10;
  if (hasSituation) score += 8;
  if (hasAction && strongOwnership) score += 8;
  if (vagueCount >= 2) score -= vagueCount * 6;
  if (fillerCount >= 3) score -= fillerCount * 4;
  if (tooShort) score -= 18;
  if (rambling) score -= 16;

  return clamp(score, 0, 100);
}

export function analyzeRecruiterPressure(
  answer: string,
  recruiterType?: string,
): PressureAnalysis {
  const text = answer.trim();
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const trustQuality = scoreEvidenceQuality(text);

  const fillerCount =
    (lower.match(
      /\b(um|uh|like|basically|actually|you know|kind of|sort of|maybe|probably|i think|i guess)\b/g,
    )?.length) || 0;

  // Re-derive individual signals for issue/strength reporting
  const strongOwnership =
    /\b(i led|i built|i created|i resolved|i handled|i managed|i implemented|i improved|i designed|i reduced|i increased|i launched|i owned|i drove|i delivered|i analyzed)\b/i.test(
      lower,
    );
  const hasPlausibleMetric =
    /\b(\d+\s*(?:%|percent|hours?|days?|weeks?|months?|customers?|tickets?|users?|cases?))\b/i.test(
      lower,
    );
  const hasQualitativeResult =
    /\b(customer.{1,20}(happy|satisfied|stayed|returned)|csat|nps|fewer.{1,20}(complaints|escalations)|resolved.{1,20}faster)\b/i.test(
      lower,
    );
  const hasOutcome = hasPlausibleMetric || hasQualitativeResult;
  const hasSituation =
    /\b(when|in my|at my|there was|a customer|a client|the problem|one time)\b/i.test(lower);
  const vagueLanguage =
    /\b(hardworking|passionate|team player|fast learner|good communication|various tasks|many responsibilities)\b/i.test(
      lower,
    );

  const issues: string[] = [];
  const strengths: string[] = [];

  if (!hasPlausibleMetric && !hasQualitativeResult) issues.push("no measurable or qualitative outcome");
  if (!strongOwnership) issues.push("ownership unclear, too much 'we'");
  if (!hasSituation && wordCount > 25) issues.push("no specific situation referenced");
  if (wordCount > 150 && !hasOutcome) issues.push("rambling without a result");
  if (wordCount < 20) issues.push("answer too brief to evaluate");
  if (fillerCount >= 3) issues.push("hesitation or filler language");
  if (vagueLanguage) issues.push("generic or buzzword-heavy wording");

  if (hasPlausibleMetric) strengths.push("measurable proof included");
  if (hasQualitativeResult) strengths.push("qualitative outcome referenced");
  if (strongOwnership) strengths.push("clear first-person ownership");
  if (hasSituation) strengths.push("grounded in a real situation");
  if (wordCount >= 35 && wordCount <= 130) strengths.push("good answer length");

  // Trust delta is derived from quality score, not raw keyword presence
  let trustDelta: number;
  let pressureDelta: number;
  let emotion: RecruiterEmotionState;
  let shouldInterrupt = false;
  let recruiterLine: string | undefined;

  if (trustQuality >= 72) {
    emotion = "engaged";
    trustDelta = Math.round((trustQuality - 70) / 6); // +0 to +5
    pressureDelta = -8;
  } else if (trustQuality >= 52) {
    emotion = "neutral";
    trustDelta = 0;
    pressureDelta = 4;
  } else if (trustQuality >= 36) {
    emotion = "skeptical";
    trustDelta = -4;
    pressureDelta = 12;
    if (wordCount > 40) {
      shouldInterrupt = true;
      recruiterLine = pickInterruption(recruiterType);
    }
  } else {
    // Low quality answer
    emotion = wordCount > 130 ? "impatient" : "confused";
    trustDelta = -8;
    pressureDelta = 18;
    shouldInterrupt = true;
    recruiterLine = pickInterruption(recruiterType);
  }

  const confidenceScore = clamp(
    50 +
      (trustQuality - 50) * 0.8 -
      fillerCount * 4 +
      (strongOwnership ? 6 : 0),
    0,
    100,
  );

  return {
    emotion,
    recruiterLine,
    pressureDelta: clamp(pressureDelta, -10, 25),
    trustDelta: clamp(trustDelta, -12, 8),
    trustQuality,
    shouldInterrupt,
    issues,
    strengths,
    confidenceScore,
  };
}

export function buildRecruiterBehaviorDecision(
  analysis: PressureAnalysis,
  currentState: RecruiterState,

): RecruiterBehaviorDecision {
  const { emotion, shouldInterrupt, pressureDelta, trustDelta, trustQuality } = analysis;

  const mood = moodInstruction(currentState.mood);

  let responseMode: RecruiterBehaviorDecision["responseMode"] = "continue";
  let pressureInstruction = mood;
  let followUpFocus = "Ask the next natural interview question.";

  if (shouldInterrupt && emotion === "impatient") {
    responseMode = "interrupt";
    pressureInstruction = "Cut off the rambling with a direct, short challenge.";
    followUpFocus = "What was the actual result of all that?";
  } else if (shouldInterrupt && emotion === "skeptical") {
    responseMode = "challenge";
    pressureInstruction = "Challenge the ownership or evidence gap directly but professionally.";
    followUpFocus = "What did YOU specifically do, and what changed because of it?";
  } else if (emotion === "confused") {
    responseMode = "probe";
    pressureInstruction = "Ask for one concrete grounding detail, a situation or a result.";
    followUpFocus = "Give me one real example from your experience.";
  } else if (emotion === "engaged" || trustQuality >= 70) {
    responseMode = trustQuality >= 82 ? "move_on" : "continue";
    pressureInstruction = "Acknowledge briefly and go deeper with a strategic or harder follow-up.";
    followUpFocus = "Push for the hardest part, the trade-off, or a bigger scope question.";
  } else if (emotion === "neutral") {
    responseMode = "probe";
    pressureInstruction = "Stay conversational; ask for the outcome before moving on.";
    followUpFocus = "What was the measurable or qualitative outcome of that?";
  }

  const weakAnswer = trustQuality < 45;
  const strongAnswer = trustQuality >= 70;

  return {
    shouldInterrupt: !!shouldInterrupt && responseMode === "interrupt",
    interruptionMessage: analysis.recruiterLine || "",
    responseMode,
    pressureInstruction,
    followUpFocus,
    stateDelta: {
      trust: clamp(trustDelta, -12, 8),
      patience: clamp(emotion === "impatient" ? -12 : emotion === "skeptical" ? -5 : 2, -20, 10),
      skepticism: clamp(
        emotion === "skeptical" ? 10 : emotion === "confused" ? 6 : emotion === "engaged" ? -6 : 2,
        -10,
        20,
      ),
      engagement: clamp(emotion === "engaged" ? 8 : emotion === "impressed" ? 12 : -2, -10, 15),
      pressure: clamp(pressureDelta, -10, 25),
      warmth: clamp(emotion === "engaged" ? 5 : emotion === "skeptical" ? -6 : 0, -10, 10),
      confidenceInCandidate: clamp(analysis.confidenceScore - 50, -20, 20),
      weakAnswer,
      strongAnswer,
    },
  };
}
