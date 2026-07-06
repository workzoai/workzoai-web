import {
  evaluateInterruption,
  type InterruptionResult,
} from "./interruptionEngine";

import {
  updateEmotionalMemory,
  getMemoryBasedRecruiterLine,
  initialEmotionalMemory,
  type EmotionalMemoryState,
} from "./emotionalMemoryEngine";

import { getRecruiterReaction } from "./recruiterReactionEngine";

export type RecruiterRuntimeMood =
  | "neutral"
  | "interested"
  | "skeptical"
  | "pressuring"
  | "impressed"
  | "recovering";

export type RecruiterRuntimeState =
  | "listening"
  | "thinking"
  | "reacting"
  | "interrupting"
  | "typing_notes"
  | "waiting";

export type RecruiterRuntimeDecision =
  | "interrupt"
  | "memory_callback"
  | "challenge"
  | "react"
  | "probe"
  | "continue"
  | "recover";

export type RecruiterRuntimePersonality =
  | "analytical_hiring_manager"
  | "friendly_hr"
  | "startup_recruiter"
  | "corporate_recruiter";

export type RecruiterTrustTrend =
  | "increasing"
  | "recovering"
  | "stable"
  | "dropping"
  | "collapsed";

export type RecruiterPatienceTrend =
  | "steady"
  | "improving"
  | "strained"
  | "dropping"
  | "exhausted";

export type RecruiterConversationDrift =
  | "focused"
  | "slight_drift"
  | "losing_thread"
  | "resetting";

export type RecruiterFollowupMomentum =
  | "build"
  | "clarify"
  | "redirect"
  | "reset"
  | "close_down";

export type RecruiterSelfCorrectionStyle =
  | "none"
  | "rephrase"
  | "back_up"
  | "clarify_intent"
  | "course_correct";

export type RecruiterSelfCorrection = {
  shouldSelfCorrect: boolean;
  style: RecruiterSelfCorrectionStyle;
  line: string | null;
};

export type RecruiterEngagementTrend =
  | "rising"
  | "steady"
  | "fading"
  | "checked_out";

export type RecruiterSilentJudgment =
  | "none"
  | "watching_closely"
  | "concerned"
  | "quietly_doubting"
  | "mentally_rejecting";

export type RecruiterInternalEmotion =
  | "calm"
  | "interested"
  | "skeptical"
  | "frustrated"
  | "impatient"
  | "disengaged"
  | "recovering";

export type RecruiterVisibleEmotion =
  | "warm"
  | "neutral"
  | "direct"
  | "contained"
  | "cold"
  | "encouraging";

export type RecruiterMaskingStrength = "low" | "medium" | "high";

export type RecruiterProfessionalContainment =
  | "open"
  | "controlled"
  | "strongly_contained";

export type RecruiterEmotionalLeakage =
  | "none"
  | "briefness"
  | "coolness"
  | "impatience"
  | "visible_reset";

export type RecruiterEmotionalMomentum =
  | "warming_up"
  | "steady"
  | "cooling"
  | "recovering"
  | "hardening";

export type RecruiterRecoveryResistance =
  | "low"
  | "medium"
  | "high";

export type RecruiterSkepticismCarryover =
  | "none"
  | "light"
  | "moderate"
  | "heavy";

export type RecruiterEngagementInertia =
  | "stable"
  | "slow_decay"
  | "slow_recovery"
  | "resistant";

export type RecruiterRuntimeInput = {
  answer: string;
  recruiterId?: RecruiterRuntimePersonality;
  score?: number;
  pressureLevel?: number;
  memory?: EmotionalMemoryState;
  turnIndex?: number;
};

export type RecruiterRuntimeOutput = {
  /**
   * One clear decision for the page/orchestrator to use later.
   * Keep /interview simple: read runtimeDecision + suggestedLine + visualState.
   */
  runtimeDecision: RecruiterRuntimeDecision;

  /** Backward-compatible visual state name used by earlier code. */
  state: RecruiterRuntimeState;

  /** Preferred clearer name for future orchestration. */
  visualState: RecruiterRuntimeState;

  mood: RecruiterRuntimeMood;
  pressureLevel: number;
  interruption: InterruptionResult;
  reactionLines: string[];
  memory: EmotionalMemoryState;
  memoryLine: string | null;

  /** Short human reaction before the main recruiter line. Keep it tiny. */
  microReaction: string | null;

  /** The single best recruiter micro-line for this turn. */
  suggestedLine: string;

  /** Optional next probe direction. Do not speak automatically yet. */
  nextAction: "ask_follow_up" | "wait" | "move_on" | "recover_trust";

  /** Simple signal label useful for analytics/debugging later. */
  signal:
    | "strong_answer"
    | "missing_metrics"
    | "vague_answer"
    | "weak_clarity"
    | "too_long"
    | "neutral_answer";

  trust: number;
  trustTrend: RecruiterTrustTrend;

  /** 0-100 emotional patience. Lower values mean recruiter is mentally checking out. */
  patienceLevel: number;
  patienceTrend: RecruiterPatienceTrend;

  /** 0-100 small pause/hesitation signal for realistic recruiter cadence. */
  hesitationLevel: number;

  /** Whether the recruiter stays focused or has to reset the conversational thread. */
  conversationDrift: RecruiterConversationDrift;

  /** 0-100 uncertainty in the recruiter's interpretation of the answer. */
  emotionalUncertainty: number;

  /** Direction of the next follow-up. */
  followupMomentum: RecruiterFollowupMomentum;

  /** Human-like correction when the recruiter changes direction mid-thought. */
  selfCorrection: RecruiterSelfCorrection;

  /** Convenience fields for logs/UI. */
  shouldSelfCorrect: boolean;
  selfCorrectionLine: string | null;
  selfCorrectionStyle: RecruiterSelfCorrectionStyle;

  /** 0-100 recruiter attention investment. Lower means they are checking out. */
  engagementLevel: number;

  /** 0-100 curiosity about the candidate's answer. */
  curiosityLevel: number;

  /** Silent judgment state: the recruiter may stop probing even before the interview ends. */
  silentJudgment: RecruiterSilentJudgment;

  /** 0-100 risk that the recruiter has mentally moved on. */
  mentalCheckoutRisk: number;

  /** Whether emotional investment is rising or fading. */
  engagementTrend: RecruiterEngagementTrend;

  /** What the recruiter internally feels. This may be hidden professionally. */
  internalEmotion: RecruiterInternalEmotion;

  /** What the candidate is allowed to see/hear externally. */
  visibleEmotion: RecruiterVisibleEmotion;

  /** How much the recruiter is masking internal emotion. */
  maskingStrength: RecruiterMaskingStrength;

  /** How tightly the recruiter keeps the tone professional. */
  professionalContainment: RecruiterProfessionalContainment;

  /** Small emotion leaks that appear despite professional tone. */
  emotionalLeakage: RecruiterEmotionalLeakage;

  /** Emotional inertia prevents trust/engagement from snapping unrealistically. */
  emotionalMomentum: RecruiterEmotionalMomentum;

  /** How much stronger evidence is needed before the recruiter fully recovers trust. */
  recoveryResistance: RecruiterRecoveryResistance;

  /** Lingering skepticism from previous weak answers, even after improvement. */
  skepticismCarryover: RecruiterSkepticismCarryover;

  /** Whether engagement is decaying/recovering gradually instead of instantly. */
  engagementInertia: RecruiterEngagementInertia;

  confidence: number;
  interest: number;
};

export function runRecruiterRuntime({
  answer,
  recruiterId = "analytical_hiring_manager",
  score = 70,
  pressureLevel = 50,
  memory = initialEmotionalMemory,
  turnIndex = 0,
}: RecruiterRuntimeInput): RecruiterRuntimeOutput {
  const safeAnswer = normalizeAnswer(answer);
  const answerSignals = analyzeRuntimeAnswer(safeAnswer);

  const baseInterruption = evaluateInterruption(safeAnswer, pressureLevel);
  const updatedMemory = updateEmotionalMemory(memory, safeAnswer);
  const memoryLine = buildRuntimeMemoryLine({
    previousMemory: memory,
    updatedMemory,
    answerSignals,
    turnIndex,
  });

  const recoveryLine = buildRuntimeRecoveryLine({
    previousMemory: memory,
    answerSignals,
    score,
    turnIndex,
  });

  const rawInterruption = buildMemoryEscalatedInterruption({
    baseInterruption,
    previousMemory: memory,
    answerSignals,
    pressureLevel,
    turnIndex,
  });

  // Strong recovery must override pressure. A real recruiter softens when the
  // candidate finally gives evidence after earlier weak answers.
  const interruption = recoveryLine
    ? {
        ...rawInterruption,
        shouldInterrupt: false,
        severity: "low" as const,
        interruptionMessage: "",
      }
    : rawInterruption;

  const baseReactionLines = getRecruiterReaction({
    score,
    missingMetrics: answerSignals.missingMetrics,
    vague: answerSignals.vague,
  });

  const reactionLines = buildPressureAwareReactionLines({
    baseReactionLines: buildContextAwareReactionLines({
      baseReactionLines,
      answerSignals,
      score,
    }),
    interruption,
    memoryLine,
    answerSignals,
  });

  const mood = determineMood({
    score,
    interruption,
    memory: updatedMemory,
    missingMetrics: answerSignals.missingMetrics,
    vague: answerSignals.vague,
    weakClarity: answerSignals.weakClarity,
    tooLong: answerSignals.tooLong,
    recoveringStrongly: Boolean(recoveryLine),
  });

  const runtimeDecision = determineRuntimeDecision({
    interruption,
    memoryLine,
    recoveryLine,
    mood,
    score,
    answerSignals,
    turnIndex,
  });

  const visualState = determineState({
    interruption,
    mood,
    runtimeDecision,
  });

  const nextPressureLevel = calculateNextPressureLevel({
    currentPressure: pressureLevel,
    interruption,
    memory: updatedMemory,
    score,
    answerSignals,
  });

  const microReaction = chooseMicroReaction({
    recruiterId,
    runtimeDecision,
    interruption,
    memoryLine,
    recoveryLine,
    mood,
    answerSignals,
    score,
  });

  const baseSuggestedLine = chooseSuggestedLine({
    runtimeDecision,
    interruption,
    memoryLine,
    recoveryLine,
    reactionLines,
    mood,
    answerSignals,
  });

  const trustTrend = determineTrustTrend({
    previousMemory: memory,
    updatedMemory,
    interruption,
    recoveryLine,
    answerSignals,
    score,
    pressureLevel,
  });

  const patienceLevel = calculatePatienceLevel({
    previousMemory: memory,
    updatedMemory,
    interruption,
    recoveryLine,
    answerSignals,
    score,
    pressureLevel: nextPressureLevel,
    trustTrend,
  });

  const patienceTrend = determinePatienceTrend({
    patienceLevel,
    trustTrend,
    interruption,
    recoveryLine,
    answerSignals,
  });

  const hesitationLevel = calculateHesitationLevel({
    runtimeDecision,
    interruption,
    answerSignals,
    patienceLevel,
    patienceTrend,
    trustTrend,
  });

  const conversationDrift = determineConversationDrift({
    answerSignals,
    interruption,
    patienceLevel,
    patienceTrend,
    trustTrend,
    runtimeDecision,
  });

  const emotionalUncertainty = calculateEmotionalUncertainty({
    answerSignals,
    mood,
    trustTrend,
    patienceLevel,
    score,
  });

  const followupMomentum = determineFollowupMomentum({
    runtimeDecision,
    conversationDrift,
    patienceTrend,
    trustTrend,
    answerSignals,
  });

  const driftedSuggestedLine = applyConversationDriftToLine({
    baseSuggestedLine,
    conversationDrift,
    hesitationLevel,
    emotionalUncertainty,
    patienceTrend,
    runtimeDecision,
  });

  const selfCorrection = determineSelfCorrection({
    runtimeDecision,
    conversationDrift,
    emotionalUncertainty,
    hesitationLevel,
    patienceLevel,
    patienceTrend,
    trustTrend,
    followupMomentum,
    answerSignals,
  });

  const engagementLevel = calculateEngagementLevel({
    previousMemory: memory,
    updatedMemory,
    answerSignals,
    runtimeDecision,
    trustTrend,
    patienceLevel,
    patienceTrend,
    conversationDrift,
    recoveryLine,
    score,
    turnIndex,
  });

  const curiosityLevel = calculateCuriosityLevel({
    engagementLevel,
    answerSignals,
    trustTrend,
    patienceTrend,
    runtimeDecision,
    recoveryLine,
    score,
  });

  const mentalCheckoutRisk = calculateMentalCheckoutRisk({
    engagementLevel,
    curiosityLevel,
    trustTrend,
    patienceTrend,
    patienceLevel,
    conversationDrift,
    interruption,
    answerSignals,
  });

  const silentJudgment = determineSilentJudgment({
    mentalCheckoutRisk,
    engagementLevel,
    curiosityLevel,
    trustTrend,
    patienceTrend,
    runtimeDecision,
  });

  const engagementTrend = determineEngagementTrend({
    engagementLevel,
    curiosityLevel,
    mentalCheckoutRisk,
    trustTrend,
    patienceTrend,
    recoveryLine,
    answerSignals,
  });

  const emotionalMomentum = determineEmotionalMomentum({
    trustTrend,
    patienceTrend,
    engagementTrend,
    recoveryLine,
    answerSignals,
  });

  const recoveryResistance = determineRecoveryResistance({
    previousMemory: memory,
    trustTrend,
    patienceTrend,
    silentJudgment,
    mentalCheckoutRisk,
    turnIndex,
  });

  const skepticismCarryover = determineSkepticismCarryover({
    previousMemory: memory,
    answerSignals,
    recoveryLine,
    trustTrend,
    turnIndex,
  });

  const engagementInertia = determineEngagementInertia({
    engagementTrend,
    recoveryResistance,
    skepticismCarryover,
    trustTrend,
    turnIndex,
  });

  const internalEmotion = determineInternalEmotion({
    mood,
    trustTrend,
    patienceTrend,
    silentJudgment,
    mentalCheckoutRisk,
    recoveryLine,
    answerSignals,
  });

  const maskingStrength = determineMaskingStrength({
    recruiterId,
    internalEmotion,
    silentJudgment,
    mentalCheckoutRisk,
    runtimeDecision,
  });

  const professionalContainment = determineProfessionalContainment({
    recruiterId,
    maskingStrength,
    internalEmotion,
    silentJudgment,
  });

  const visibleEmotion = determineVisibleEmotion({
    recruiterId,
    internalEmotion,
    professionalContainment,
    runtimeDecision,
    recoveryLine,
  });

  const emotionalLeakage = determineEmotionalLeakage({
    internalEmotion,
    visibleEmotion,
    maskingStrength,
    professionalContainment,
    mentalCheckoutRisk,
    patienceTrend,
    conversationDrift,
  });

  const cognitivelyCorrectedLine = applyCognitiveSelfCorrectionToLine({
    baseLine: driftedSuggestedLine,
    selfCorrection,
    runtimeDecision,
  });

  const engagementAdjustedLine = applyEngagementDecayToLine({
    baseLine: cognitivelyCorrectedLine,
    silentJudgment,
    engagementLevel,
    curiosityLevel,
    mentalCheckoutRisk,
    runtimeDecision,
  });

  const maskedSuggestedLine = applyProfessionalMaskingToLine({
    baseLine: engagementAdjustedLine,
    recruiterId,
    internalEmotion,
    visibleEmotion,
    maskingStrength,
    professionalContainment,
    emotionalLeakage,
    runtimeDecision,
  });

  const suggestedLine = compressRecruiterLine({
    line: maskedSuggestedLine,
    runtimeDecision,
    silentJudgment,
    engagementTrend,
    professionalContainment,
    emotionalLeakage,
    recoveryResistance,
    skepticismCarryover,
  });

  return {
    runtimeDecision,
    state: visualState,
    visualState,
    mood,
    pressureLevel: nextPressureLevel,
    interruption,
    reactionLines,
    memory: updatedMemory,
    memoryLine,
    microReaction,
    suggestedLine,
    nextAction: determineNextAction(runtimeDecision, mood, updatedMemory),
    signal: getPrimarySignal(answerSignals, score),
    trust: updatedMemory.trust,
    trustTrend,
    patienceLevel,
    patienceTrend,
    hesitationLevel,
    conversationDrift,
    emotionalUncertainty,
    followupMomentum,
    selfCorrection,
    shouldSelfCorrect: selfCorrection.shouldSelfCorrect,
    selfCorrectionLine: selfCorrection.line,
    selfCorrectionStyle: selfCorrection.style,
    engagementLevel,
    curiosityLevel,
    silentJudgment,
    mentalCheckoutRisk,
    engagementTrend,
    internalEmotion,
    visibleEmotion,
    maskingStrength,
    professionalContainment,
    emotionalLeakage,
    emotionalMomentum,
    recoveryResistance,
    skepticismCarryover,
    engagementInertia,
    confidence: updatedMemory.confidence,
    interest: updatedMemory.interest,
  };
}

function normalizeAnswer(answer: string) {
  return answer.replace(/\s+/g, " ").trim();
}

function analyzeRuntimeAnswer(answer: string) {
  const lower = answer.toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const hasMetrics =
    /\d|percent|percentage|hours?|days?|weeks?|months?|customers?|tickets?|users?|reduced|increased|saved|improved|faster|revenue|cost/i.test(
      answer,
    );

  const hasOwnership =
    /\b(i|my|personally|led|owned|handled|resolved|built|created|improved|implemented|analyzed|designed)\b/i.test(
      answer,
    );

  const vague = detectVagueAnswer(answer);
  const weakClarity = wordCount > 0 && wordCount < 14;
  const tooLong = wordCount > 120;

  const concreteCustomerExample = detectConcreteCustomerExample(answer);
  const concreteTechnicalExample = detectConcreteTechnicalExample(answer);
  const concreteExample = concreteCustomerExample || concreteTechnicalExample;

  // Spoken interview answers often do not include metrics, especially early in the call.
  // A concrete customer/story example should not be treated the same as a vague answer.
  const missingMetrics = !hasMetrics && !concreteExample;
  const strong = hasMetrics && hasOwnership && !vague && wordCount >= 25;

  return {
    wordCount,
    hasMetrics,
    hasOwnership,
    vague,
    missingMetrics,
    weakClarity,
    tooLong,
    strong,
    concreteExample,
    concreteCustomerExample,
    concreteTechnicalExample,
  };
}

function detectVagueAnswer(answer: string) {
  const text = answer.toLowerCase();

  return [
    "hardworking",
    "passionate",
    "quick learner",
    "team player",
    "good communication",
    "helped with",
    "involved in",
    "worked on",
    "responsible for",
    "many things",
    "a lot of things",
    "various tasks",
  ].some((phrase) => text.includes(phrase));
}

function detectConcreteCustomerExample(answer: string) {
  const text = answer.toLowerCase();

  const hasCustomer =
    /\b(customer|client|user|stakeholder|account|caller|person|old lady|older customer|non[- ]technical)\b/i.test(
      text,
    );
  const hasSituation =
    /\b(issue|problem|case|ticket|complaint|request|could not|couldn't|unable|failed|not working|down|stuck|confused|scared|urgent)\b/i.test(
      text,
    );
  const hasAction =
    /\b(i|my|personally|handled|resolved|fixed|guided|explained|walked|checked|updated|documented|followed up|calmed|listened|asked|showed|gave|took)\b/i.test(
      text,
    );
  const hasOutcome =
    /\b(resolved|fixed|worked|happy|satisfied|closed|completed|successful|connected|restored|updated|documented)\b/i.test(
      text,
    );

  return hasCustomer && hasSituation && hasAction && hasOutcome;
}

function detectConcreteTechnicalExample(answer: string) {
  const text = answer.toLowerCase();

  const productOrTechContext =
    /\b(router|wifi|wi-fi|internet|firmware|ip address|browser|chrome|belkin|linksys|ticket|crm|dashboard|software|hardware|login|setup|configuration)\b/i.test(
      text,
    );
  const stepContext =
    /\b(step by step|walked|guided|checked|updated|opened|connected|documented|troubleshot|diagnosed|verified|configured)\b/i.test(
      text,
    );
  const userContext =
    /\b(customer|client|user|non[- ]technical|old|older|scared|confused|not tech savvy)\b/i.test(
      text,
    );

  return productOrTechContext && stepContext && userContext;
}

function hasPreviousWeakness(
  memory: EmotionalMemoryState,
  signal: "vague_answer" | "missing_metrics" | "weak_clarity",
) {
  const repeatedWeaknesses = new Set(memory.repeatedWeaknesses || []);
  const memorySignals = new Set(
    (memory.memories || []).map((item) => item.signal),
  );

  return repeatedWeaknesses.has(signal) || memorySignals.has(signal);
}

function buildMemoryEscalatedInterruption({
  baseInterruption,
  previousMemory,
  answerSignals,
  pressureLevel,
  turnIndex,
}: {
  baseInterruption: InterruptionResult;
  previousMemory: EmotionalMemoryState;
  answerSignals: ReturnType<typeof analyzeRuntimeAnswer>;
  pressureLevel: number;
  turnIndex: number;
}): InterruptionResult {
  if (baseInterruption.shouldInterrupt) return baseInterruption;
  if (turnIndex < 2 || pressureLevel < 70) return baseInterruption;

  const repeatedVague =
    answerSignals.vague && hasPreviousWeakness(previousMemory, "vague_answer");
  const repeatedMissingMetrics =
    answerSignals.missingMetrics &&
    hasPreviousWeakness(previousMemory, "missing_metrics");
  const repeatedWeakClarity =
    answerSignals.weakClarity &&
    hasPreviousWeakness(previousMemory, "weak_clarity");

  if (repeatedVague) {
    return {
      shouldInterrupt: true,
      severity: pressureLevel >= 82 ? "high" : "medium",
      interruptionMessage:
        "Let me stop you there. This is the same broad pattern again, give me one specific situation and what you personally did.",
    };
  }

  if (repeatedMissingMetrics) {
    return {
      shouldInterrupt: true,
      severity: pressureLevel >= 82 ? "high" : "medium",
      interruptionMessage:
        "Hold on. You are avoiding impact again. What changed because of your work? A rough number is fine.",
    };
  }

  if (repeatedWeakClarity) {
    return {
      shouldInterrupt: true,
      severity: "medium",
      interruptionMessage:
        "Let me pause you there. This is still incomplete, give me the situation, your action, and the result in order.",
    };
  }

  return baseInterruption;
}

function buildRuntimeMemoryLine({
  previousMemory,
  updatedMemory,
  answerSignals,
  turnIndex,
}: {
  previousMemory: EmotionalMemoryState;
  updatedMemory: EmotionalMemoryState;
  answerSignals: ReturnType<typeof analyzeRuntimeAnswer>;
  turnIndex: number;
}) {
  if (turnIndex < 2) return null;

  const previousWeaknesses = new Set(previousMemory.repeatedWeaknesses || []);
  const updatedWeaknesses = new Set(updatedMemory.repeatedWeaknesses || []);
  const previousSignals = new Set(
    (previousMemory.memories || [])
      .map((item) => item.signal)
      .filter(
        (signal) =>
          signal === "vague_answer" ||
          signal === "missing_metrics" ||
          signal === "weak_clarity",
      ),
  );

  const hasPreviousPattern = (
    signal: "vague_answer" | "missing_metrics" | "weak_clarity",
  ) =>
    previousWeaknesses.has(signal) ||
    updatedWeaknesses.has(signal) ||
    previousSignals.has(signal);

  if (answerSignals.vague && hasPreviousPattern("vague_answer")) {
    return "I’m noticing the same pattern again, this is still too general. Give me one specific situation and what you personally did.";
  }

  if (answerSignals.missingMetrics && hasPreviousPattern("missing_metrics")) {
    return "Earlier you also avoided measurable impact. What changed because of your work? A rough number is fine.";
  }

  if (answerSignals.weakClarity && hasPreviousPattern("weak_clarity")) {
    return "This still feels incomplete. Walk me through the situation, your action, and the result in order.";
  }

  return getMemoryBasedRecruiterLine(updatedMemory);
}

function buildRuntimeRecoveryLine({
  previousMemory,
  answerSignals,
  score,
  turnIndex,
}: {
  previousMemory: EmotionalMemoryState;
  answerSignals: ReturnType<typeof analyzeRuntimeAnswer>;
  score: number;
  turnIndex: number;
}) {
  if (turnIndex < 2) return null;

  const hadWeakPattern =
    hasPreviousWeakness(previousMemory, "vague_answer") ||
    hasPreviousWeakness(previousMemory, "missing_metrics") ||
    hasPreviousWeakness(previousMemory, "weak_clarity") ||
    previousMemory.trust < 60 ||
    previousMemory.confidence < 60;

  const recoveredWithEvidence =
    hadWeakPattern &&
    (answerSignals.strong || score >= 82) &&
    answerSignals.hasOwnership &&
    answerSignals.hasMetrics &&
    !answerSignals.vague;

  if (!recoveredWithEvidence) return null;

  return "That is stronger. This is the kind of evidence I was looking for.";
}

function buildContextAwareReactionLines({
  baseReactionLines,
  answerSignals,
  score,
}: {
  baseReactionLines: string[];
  answerSignals: ReturnType<typeof analyzeRuntimeAnswer>;
  score: number;
}) {
  if (answerSignals.concreteCustomerExample) {
    return [
      "Good, that is a real example.",
      "That shows patience and clear communication with a non-technical person.",
      "Now connect it to the role: how would you create longer-term impact after solving it?",
    ];
  }

  if (answerSignals.concreteTechnicalExample) {
    return [
      "That is more concrete.",
      "You translated a technical issue into simple steps for the customer.",
      "What did you do after resolving it so the learning was not lost?",
    ];
  }

  if (answerSignals.strong || score >= 85) {
    return [
      baseReactionLines[0] || "That is a strong example.",
      baseReactionLines[1] || "Good. That shows ownership.",
      baseReactionLines[2] || "That answer feels credible.",
    ];
  }

  return baseReactionLines;
}

function buildPressureAwareReactionLines({
  baseReactionLines,
  interruption,
  memoryLine,
  answerSignals,
}: {
  baseReactionLines: string[];
  interruption: InterruptionResult;
  memoryLine: string | null;
  answerSignals: ReturnType<typeof analyzeRuntimeAnswer>;
}) {
  if (
    interruption.shouldInterrupt &&
    interruption.severity === "high" &&
    memoryLine &&
    answerSignals.vague
  ) {
    return [
      "Hold on, this is the same vague pattern again.",
      "I’m not hearing measurable impact yet.",
      "Give me the exact action and result.",
    ];
  }

  if (
    interruption.shouldInterrupt &&
    interruption.severity === "high" &&
    memoryLine &&
    answerSignals.missingMetrics
  ) {
    return [
      "Hold on, you are avoiding impact again.",
      "A rough number is better than no evidence.",
      "What changed because of your work?",
    ];
  }

  if (interruption.shouldInterrupt && interruption.severity === "medium") {
    return [
      baseReactionLines[0] || "Let me pause you there.",
      baseReactionLines[1] || "I need the answer to become more concrete.",
      baseReactionLines[2] || "Give me the action and the result.",
    ];
  }

  return baseReactionLines;
}

function determineRuntimeDecision({
  interruption,
  memoryLine,
  recoveryLine,
  mood,
  score,
  answerSignals,
  turnIndex,
}: {
  interruption: InterruptionResult;
  memoryLine: string | null;
  recoveryLine: string | null;
  mood: RecruiterRuntimeMood;
  score: number;
  answerSignals: ReturnType<typeof analyzeRuntimeAnswer>;
  turnIndex: number;
}): RecruiterRuntimeDecision {
  // Strict priority order. This prevents engines from competing.
  // Strong recovery overrides interruption: when the candidate finally gives
  // ownership + evidence after weak turns, the recruiter should acknowledge it.
  if (
    recoveryLine &&
    answerSignals.strong &&
    answerSignals.hasMetrics &&
    answerSignals.hasOwnership
  ) {
    return "recover";
  }

  if (interruption.shouldInterrupt) return "interrupt";

  if (recoveryLine) return "recover";

  // Do not overuse memory callbacks in the first 1-2 turns.
  if (memoryLine && turnIndex >= 2) return "memory_callback";

  if (mood === "pressuring" || mood === "skeptical") return "challenge";
  if (mood === "recovering") return "recover";
  if (mood === "impressed" || answerSignals.strong || score >= 85)
    return "react";

  // Concrete spoken examples deserve a human acknowledgement and a deeper follow-up,
  // even when they do not include metrics yet. This prevents flat lines like "Okay, continue."
  if (answerSignals.concreteExample && answerSignals.hasOwnership)
    return "react";

  if (
    answerSignals.weakClarity ||
    answerSignals.missingMetrics ||
    answerSignals.vague
  ) {
    return "probe";
  }

  return "continue";
}

function determineMood({
  score,
  interruption,
  memory,
  missingMetrics,
  vague,
  weakClarity,
  tooLong,
  recoveringStrongly,
}: {
  score: number;
  interruption: InterruptionResult;
  memory: EmotionalMemoryState;
  missingMetrics: boolean;
  vague: boolean;
  weakClarity: boolean;
  tooLong: boolean;
  recoveringStrongly: boolean;
}): RecruiterRuntimeMood {
  if (recoveringStrongly) return "interested";
  if (score >= 85 && memory.trust >= 75) return "impressed";

  if (interruption.shouldInterrupt && interruption.severity === "high") {
    return "pressuring";
  }

  if (
    !tooLong &&
    !vague &&
    !weakClarity &&
    memory.trust >= 55 &&
    !missingMetrics
  ) {
    return score >= 78 || memory.interest >= 72 ? "interested" : "neutral";
  }

  if (tooLong || missingMetrics || vague || weakClarity || memory.trust < 55) {
    return "skeptical";
  }

  if (memory.confidence < 45) return "recovering";

  if (score >= 75 || memory.interest >= 75) return "interested";

  return "neutral";
}

function determineState({
  interruption,
  mood,
  runtimeDecision,
}: {
  interruption: InterruptionResult;
  mood: RecruiterRuntimeMood;
  runtimeDecision: RecruiterRuntimeDecision;
}): RecruiterRuntimeState {
  if (interruption.shouldInterrupt || runtimeDecision === "interrupt") {
    return "interrupting";
  }

  if (runtimeDecision === "memory_callback") return "typing_notes";
  if (mood === "skeptical" || mood === "pressuring") return "thinking";
  if (mood === "interested" || mood === "impressed") return "reacting";

  return "listening";
}

function calculateNextPressureLevel({
  currentPressure,
  interruption,
  memory,
  score,
  answerSignals,
}: {
  currentPressure: number;
  interruption: InterruptionResult;
  memory: EmotionalMemoryState;
  score: number;
  answerSignals: ReturnType<typeof analyzeRuntimeAnswer>;
}) {
  let next = currentPressure;

  if (interruption.shouldInterrupt) {
    if (interruption.severity === "high") next += 10;
    if (interruption.severity === "medium") next += 6;
    if (interruption.severity === "low") next += 3;
  }

  if (memory.repeatedWeaknesses.length > 0) next += 5;
  if (answerSignals.vague || answerSignals.missingMetrics) next += 4;
  if (answerSignals.tooLong) next += 3;
  if (answerSignals.concreteExample && answerSignals.hasOwnership) next -= 5;
  if (score >= 85 || answerSignals.strong) next -= 8;
  if (memory.trust < 45) next += 7;

  return clamp(next, 20, 95);
}

function chooseSuggestedLine({
  runtimeDecision,
  interruption,
  memoryLine,
  recoveryLine,
  reactionLines,
  mood,
  answerSignals,
}: {
  runtimeDecision: RecruiterRuntimeDecision;
  interruption: InterruptionResult;
  memoryLine: string | null;
  recoveryLine: string | null;
  reactionLines: string[];
  mood: RecruiterRuntimeMood;
  answerSignals: ReturnType<typeof analyzeRuntimeAnswer>;
}) {
  if (runtimeDecision === "interrupt" && interruption.interruptionMessage) {
    return interruption.interruptionMessage;
  }

  if (runtimeDecision === "memory_callback" && memoryLine) {
    return memoryLine;
  }

  if (runtimeDecision === "recover" && recoveryLine) {
    return recoveryLine;
  }

  if (runtimeDecision === "challenge") {
    if (answerSignals.missingMetrics)
      return "Give me the result, not just the activity.";
    if (answerSignals.vague)
      return "That is still broad. Give me one concrete situation.";
    if (answerSignals.weakClarity)
      return "I need more context before I can judge that.";
    return (
      reactionLines[1] ?? reactionLines[0] ?? "I need stronger evidence here."
    );
  }

  if (runtimeDecision === "recover") {
    return "You can still recover this. Give me a specific example with your role and the result.";
  }

  if (runtimeDecision === "react") {
    if (answerSignals.concreteCustomerExample) {
      return "Good, that is a real example. Now connect it to the role: what would you do after the fix to create longer-term impact?";
    }

    if (answerSignals.concreteTechnicalExample) {
      return "That is more concrete. You translated something technical for the customer. What did you do after resolving it?";
    }

    return reactionLines[0] ?? "That is stronger.";
  }

  if (runtimeDecision === "probe") {
    if (answerSignals.missingMetrics)
      return "What changed because of your work? Give me a number or rough estimate.";
    if (!answerSignals.hasOwnership)
      return "What part of that was directly handled by you?";
    return "Can you make that more specific?";
  }

  if (reactionLines.length > 0) {
    if (mood === "impressed") return reactionLines[0];
    if (mood === "skeptical") return reactionLines[1] ?? reactionLines[0];
    return reactionLines[0];
  }

  return "Okay, continue.";
}

function chooseMicroReaction({
  recruiterId,
  runtimeDecision,
  interruption,
  memoryLine,
  recoveryLine,
  mood,
  answerSignals,
  score,
}: {
  recruiterId: RecruiterRuntimePersonality;
  runtimeDecision: RecruiterRuntimeDecision;
  interruption: InterruptionResult;
  memoryLine: string | null;
  recoveryLine: string | null;
  mood: RecruiterRuntimeMood;
  answerSignals: ReturnType<typeof analyzeRuntimeAnswer>;
  score: number;
}) {
  const family = recruiterId;

  if (runtimeDecision === "interrupt" && interruption.severity === "high") {
    if (family === "friendly_hr")
      return memoryLine
        ? "Let me pause you there."
        : "Can I stop you for a second?";
    if (family === "startup_recruiter") return "Hold on.";
    if (family === "corporate_recruiter") return "Please be precise.";
    return memoryLine ? "Hold on." : "Let me stop you there.";
  }

  if (runtimeDecision === "interrupt") {
    if (family === "friendly_hr") return "Let me pause you there.";
    if (family === "startup_recruiter") return "Wait.";
    if (family === "corporate_recruiter") return "One moment.";
    return "Wait.";
  }

  if (runtimeDecision === "recover" || recoveryLine) {
    if (family === "friendly_hr") return "That’s better.";
    if (family === "startup_recruiter") return "Better.";
    if (family === "corporate_recruiter") return "That is clearer.";
    return "That’s stronger.";
  }

  if (runtimeDecision === "memory_callback") {
    if (family === "friendly_hr") return "I’m noticing this again.";
    if (family === "startup_recruiter") return "Same pattern.";
    if (family === "corporate_recruiter") return "This pattern is repeating.";
    return "I’m noticing a pattern.";
  }

  if (answerSignals.concreteExample && answerSignals.hasOwnership) {
    if (family === "friendly_hr") return "Good, I’m with you.";
    if (family === "startup_recruiter") return "Good.";
    if (family === "corporate_recruiter") return "Good. That is specific.";
    return "Good.";
  }

  if (answerSignals.strong || score >= 85 || mood === "impressed") {
    if (family === "friendly_hr") return "That’s a strong example.";
    if (family === "startup_recruiter") return "Strong.";
    if (family === "corporate_recruiter") return "That is a solid answer.";
    return "Strong.";
  }

  if (mood === "skeptical" || runtimeDecision === "challenge") {
    if (answerSignals.vague || answerSignals.missingMetrics) {
      if (family === "friendly_hr") return "Okay, let’s make that clearer.";
      if (family === "startup_recruiter") return "Get to the impact.";
      if (family === "corporate_recruiter") return "Please be precise.";
      return "Hmm.";
    }

    if (family === "friendly_hr") return "I need a little more clarity.";
    if (family === "startup_recruiter") return "Not enough yet.";
    if (family === "corporate_recruiter") return "That is not precise enough.";
    return "I’m not convinced yet.";
  }

  if (runtimeDecision === "probe") {
    if (family === "friendly_hr") return "Okay, let’s go deeper.";
    if (family === "startup_recruiter") return "Go deeper.";
    if (family === "corporate_recruiter") return "Let’s structure this.";
    return "Okay.";
  }

  if (mood === "interested") {
    if (family === "friendly_hr") return "Interesting.";
    if (family === "startup_recruiter") return "Right.";
    if (family === "corporate_recruiter") return "Understood.";
    return "Interesting.";
  }

  return null;
}

function determineTrustTrend({
  previousMemory,
  updatedMemory,
  interruption,
  recoveryLine,
  answerSignals,
  score,
  pressureLevel,
}: {
  previousMemory: EmotionalMemoryState;
  updatedMemory: EmotionalMemoryState;
  interruption: InterruptionResult;
  recoveryLine: string | null;
  answerSignals: ReturnType<typeof analyzeRuntimeAnswer>;
  score: number;
  pressureLevel: number;
}): RecruiterTrustTrend {
  if (updatedMemory.trust <= 28 && pressureLevel >= 88) return "collapsed";
  if (recoveryLine) return "recovering";

  if (interruption.shouldInterrupt && interruption.severity === "high") {
    return updatedMemory.trust < 35 ? "collapsed" : "dropping";
  }

  const repeatedWeaknessCount = previousMemory.repeatedWeaknesses?.length || 0;
  if (
    (answerSignals.vague ||
      answerSignals.missingMetrics ||
      answerSignals.tooLong) &&
    pressureLevel >= 70
  ) {
    return repeatedWeaknessCount >= 2 || updatedMemory.trust < 45
      ? "collapsed"
      : "dropping";
  }

  if (answerSignals.strong || score >= 85) return "increasing";
  if (
    answerSignals.concreteExample &&
    answerSignals.hasOwnership &&
    updatedMemory.trust >= previousMemory.trust
  ) {
    return "stable";
  }

  if (updatedMemory.trust < previousMemory.trust - 4) return "dropping";
  if (updatedMemory.trust > previousMemory.trust + 5) return "increasing";

  return "stable";
}

function calculatePatienceLevel({
  previousMemory,
  updatedMemory,
  interruption,
  recoveryLine,
  answerSignals,
  score,
  pressureLevel,
  trustTrend,
}: {
  previousMemory: EmotionalMemoryState;
  updatedMemory: EmotionalMemoryState;
  interruption: InterruptionResult;
  recoveryLine: string | null;
  answerSignals: ReturnType<typeof analyzeRuntimeAnswer>;
  score: number;
  pressureLevel: number;
  trustTrend: RecruiterTrustTrend;
}) {
  let patience = 100;

  const repeatedWeaknessCount = previousMemory.repeatedWeaknesses?.length || 0;
  const memoryCount = previousMemory.memories?.length || 0;

  patience -= Math.round(pressureLevel * 0.34);
  patience -= repeatedWeaknessCount * 12;
  patience -= Math.min(15, memoryCount * 3);

  if (answerSignals.vague) patience -= 12;
  if (answerSignals.missingMetrics) patience -= 10;
  if (answerSignals.weakClarity) patience -= 8;
  if (answerSignals.tooLong) patience -= 10;

  if (interruption.shouldInterrupt) {
    if (interruption.severity === "high") patience -= 18;
    else if (interruption.severity === "medium") patience -= 10;
    else patience -= 5;
  }

  if (updatedMemory.trust < 45) patience -= 10;
  if (trustTrend === "collapsed") patience -= 14;
  if (trustTrend === "dropping") patience -= 7;

  if (recoveryLine) patience += 18;
  if (answerSignals.concreteExample && answerSignals.hasOwnership)
    patience += 8;
  if (answerSignals.strong || score >= 85) patience += 14;
  if (trustTrend === "recovering") patience += 8;
  if (trustTrend === "increasing") patience += 6;

  return clamp(patience, 0, 100);
}

function determinePatienceTrend({
  patienceLevel,
  trustTrend,
  interruption,
  recoveryLine,
  answerSignals,
}: {
  patienceLevel: number;
  trustTrend: RecruiterTrustTrend;
  interruption: InterruptionResult;
  recoveryLine: string | null;
  answerSignals: ReturnType<typeof analyzeRuntimeAnswer>;
}): RecruiterPatienceTrend {
  if (patienceLevel <= 18 || trustTrend === "collapsed") return "exhausted";
  if (
    recoveryLine ||
    trustTrend === "recovering" ||
    trustTrend === "increasing"
  )
    return "improving";
  if (interruption.shouldInterrupt && interruption.severity === "high")
    return "dropping";
  if (patienceLevel <= 42 || trustTrend === "dropping") return "strained";
  if (
    answerSignals.vague ||
    answerSignals.missingMetrics ||
    answerSignals.tooLong
  )
    return "strained";
  return "steady";
}

function calculateHesitationLevel({
  runtimeDecision,
  interruption,
  answerSignals,
  patienceLevel,
  patienceTrend,
  trustTrend,
}: {
  runtimeDecision: RecruiterRuntimeDecision;
  interruption: InterruptionResult;
  answerSignals: ReturnType<typeof analyzeRuntimeAnswer>;
  patienceLevel: number;
  patienceTrend: RecruiterPatienceTrend;
  trustTrend: RecruiterTrustTrend;
}) {
  let hesitation = 8;

  if (runtimeDecision === "recover") hesitation += 10;
  if (runtimeDecision === "challenge" || runtimeDecision === "probe")
    hesitation += 14;
  if (interruption.shouldInterrupt)
    hesitation += interruption.severity === "high" ? 24 : 14;
  if (answerSignals.tooLong) hesitation += 22;
  if (answerSignals.vague || answerSignals.missingMetrics) hesitation += 12;
  if (patienceTrend === "strained") hesitation += 10;
  if (patienceTrend === "dropping") hesitation += 16;
  if (patienceTrend === "exhausted") hesitation += 20;
  if (trustTrend === "recovering") hesitation += 8;
  if (trustTrend === "collapsed") hesitation += 18;
  if (patienceLevel < 25) hesitation += 12;
  if (answerSignals.concreteExample || answerSignals.strong) hesitation -= 8;

  return clamp(hesitation, 0, 100);
}

function determineConversationDrift({
  answerSignals,
  interruption,
  patienceLevel,
  patienceTrend,
  trustTrend,
  runtimeDecision,
}: {
  answerSignals: ReturnType<typeof analyzeRuntimeAnswer>;
  interruption: InterruptionResult;
  patienceLevel: number;
  patienceTrend: RecruiterPatienceTrend;
  trustTrend: RecruiterTrustTrend;
  runtimeDecision: RecruiterRuntimeDecision;
}): RecruiterConversationDrift {
  if (
    runtimeDecision === "recover" ||
    answerSignals.strong ||
    answerSignals.concreteExample
  ) {
    return "focused";
  }

  if (
    patienceTrend === "exhausted" ||
    trustTrend === "collapsed" ||
    patienceLevel <= 15
  ) {
    return "resetting";
  }

  if (
    answerSignals.tooLong ||
    (interruption.shouldInterrupt && interruption.severity === "high")
  ) {
    return "losing_thread";
  }

  if (
    answerSignals.vague ||
    answerSignals.missingMetrics ||
    patienceTrend === "strained"
  ) {
    return "slight_drift";
  }

  return "focused";
}

function calculateEmotionalUncertainty({
  answerSignals,
  mood,
  trustTrend,
  patienceLevel,
  score,
}: {
  answerSignals: ReturnType<typeof analyzeRuntimeAnswer>;
  mood: RecruiterRuntimeMood;
  trustTrend: RecruiterTrustTrend;
  patienceLevel: number;
  score: number;
}) {
  let uncertainty = 12;

  if (answerSignals.vague) uncertainty += 20;
  if (answerSignals.missingMetrics) uncertainty += 16;
  if (answerSignals.weakClarity) uncertainty += 18;
  if (answerSignals.tooLong) uncertainty += 14;
  if (mood === "skeptical") uncertainty += 12;
  if (mood === "pressuring") uncertainty += 18;
  if (trustTrend === "dropping") uncertainty += 12;
  if (trustTrend === "collapsed") uncertainty += 24;
  if (patienceLevel < 35) uncertainty += 10;
  if (answerSignals.concreteExample) uncertainty -= 14;
  if (answerSignals.strong || score >= 85) uncertainty -= 18;

  return clamp(uncertainty, 0, 100);
}

function determineFollowupMomentum({
  runtimeDecision,
  conversationDrift,
  patienceTrend,
  trustTrend,
  answerSignals,
}: {
  runtimeDecision: RecruiterRuntimeDecision;
  conversationDrift: RecruiterConversationDrift;
  patienceTrend: RecruiterPatienceTrend;
  trustTrend: RecruiterTrustTrend;
  answerSignals: ReturnType<typeof analyzeRuntimeAnswer>;
}): RecruiterFollowupMomentum {
  if (
    conversationDrift === "resetting" ||
    patienceTrend === "exhausted" ||
    trustTrend === "collapsed"
  ) {
    return "close_down";
  }

  if (
    conversationDrift === "losing_thread" ||
    runtimeDecision === "interrupt"
  ) {
    return "redirect";
  }

  if (
    runtimeDecision === "recover" ||
    answerSignals.strong ||
    answerSignals.concreteExample
  ) {
    return "build";
  }

  if (
    runtimeDecision === "challenge" ||
    runtimeDecision === "probe" ||
    conversationDrift === "slight_drift"
  ) {
    return "clarify";
  }

  return "reset";
}

function applyConversationDriftToLine({
  baseSuggestedLine,
  conversationDrift,
  hesitationLevel,
  emotionalUncertainty,
  patienceTrend,
  runtimeDecision,
}: {
  baseSuggestedLine: string;
  conversationDrift: RecruiterConversationDrift;
  hesitationLevel: number;
  emotionalUncertainty: number;
  patienceTrend: RecruiterPatienceTrend;
  runtimeDecision: RecruiterRuntimeDecision;
}) {
  if (!baseSuggestedLine) return baseSuggestedLine;

  // Do not soften strong recovery too much. The recovery moment should feel clean.
  if (runtimeDecision === "recover") {
    return hesitationLevel >= 35
      ? `Alright, that helps. ${baseSuggestedLine}`
      : baseSuggestedLine;
  }

  if (conversationDrift === "resetting") {
    return `Alright... let’s reset for a second. ${baseSuggestedLine}`;
  }

  if (conversationDrift === "losing_thread") {
    return `Wait... I think I lost the thread a little. ${baseSuggestedLine}`;
  }

  if (conversationDrift === "slight_drift") {
    if (emotionalUncertainty >= 60 || patienceTrend === "strained") {
      return `Hmm... maybe I’m missing something here. ${baseSuggestedLine}`;
    }
    return `Okay... ${baseSuggestedLine}`;
  }

  return baseSuggestedLine;
}

function determineSelfCorrection({
  runtimeDecision,
  conversationDrift,
  emotionalUncertainty,
  hesitationLevel,
  patienceLevel,
  patienceTrend,
  trustTrend,
  followupMomentum,
  answerSignals,
}: {
  runtimeDecision: RecruiterRuntimeDecision;
  conversationDrift: RecruiterConversationDrift;
  emotionalUncertainty: number;
  hesitationLevel: number;
  patienceLevel: number;
  patienceTrend: RecruiterPatienceTrend;
  trustTrend: RecruiterTrustTrend;
  followupMomentum: RecruiterFollowupMomentum;
  answerSignals: ReturnType<typeof analyzeRuntimeAnswer>;
}): RecruiterSelfCorrection {
  const none: RecruiterSelfCorrection = {
    shouldSelfCorrect: false,
    style: "none",
    line: null,
  };

  // Recovery and strong answers should feel clean. Do not undercut a candidate
  // who has just recovered with a strong, measurable answer.
  if (runtimeDecision === "recover" || answerSignals.strong) return none;

  if (
    conversationDrift === "resetting" ||
    patienceTrend === "exhausted" ||
    trustTrend === "collapsed" ||
    patienceLevel <= 12
  ) {
    return {
      shouldSelfCorrect: true,
      style: "back_up",
      line: "Actually, let me ask this differently.",
    };
  }

  if (answerSignals.tooLong || conversationDrift === "losing_thread") {
    return {
      shouldSelfCorrect: true,
      style: "course_correct",
      line: "Actually, back up for a second.",
    };
  }

  if (
    emotionalUncertainty >= 82 ||
    (conversationDrift === "slight_drift" && hesitationLevel >= 58)
  ) {
    return {
      shouldSelfCorrect: true,
      style: "clarify_intent",
      line: "Wait, no, what I really want to understand is this.",
    };
  }

  if (
    followupMomentum === "clarify" &&
    (runtimeDecision === "challenge" || runtimeDecision === "probe") &&
    hesitationLevel >= 38
  ) {
    return {
      shouldSelfCorrect: true,
      style: "rephrase",
      line: "Let me rephrase that.",
    };
  }

  return none;
}

function applyCognitiveSelfCorrectionToLine({
  baseLine,
  selfCorrection,
  runtimeDecision,
}: {
  baseLine: string;
  selfCorrection: RecruiterSelfCorrection;
  runtimeDecision: RecruiterRuntimeDecision;
}) {
  if (!baseLine || !selfCorrection.shouldSelfCorrect || !selfCorrection.line) {
    return baseLine;
  }

  // Avoid making recovery moments messy. Recovery should sound affirming.
  if (runtimeDecision === "recover") return baseLine;

  const normalizedBase = baseLine.toLowerCase();
  const normalizedCorrection = selfCorrection.line.toLowerCase();

  if (normalizedBase.startsWith(normalizedCorrection)) return baseLine;

  return `${selfCorrection.line} ${baseLine}`.replace(/\s+/g, " ").trim();
}

function calculateEngagementLevel({
  previousMemory,
  updatedMemory,
  answerSignals,
  runtimeDecision,
  trustTrend,
  patienceLevel,
  patienceTrend,
  conversationDrift,
  recoveryLine,
  score,
  turnIndex,
}: {
  previousMemory: EmotionalMemoryState;
  updatedMemory: EmotionalMemoryState;
  answerSignals: ReturnType<typeof analyzeRuntimeAnswer>;
  runtimeDecision: RecruiterRuntimeDecision;
  trustTrend: RecruiterTrustTrend;
  patienceLevel: number;
  patienceTrend: RecruiterPatienceTrend;
  conversationDrift: RecruiterConversationDrift;
  recoveryLine: string | null;
  score: number;
  turnIndex: number;
}) {
  let engagement = 72;

  const previousWeaknessCount =
    (previousMemory.repeatedWeaknesses?.length || 0) +
    (previousMemory.memories?.filter((item) =>
      item.signal === "vague_answer" ||
      item.signal === "missing_metrics" ||
      item.signal === "weak_clarity",
    ).length || 0);

  engagement += Math.round((updatedMemory.interest - 60) * 0.22);
  engagement += Math.round((updatedMemory.trust - 60) * 0.18);
  engagement += Math.round((patienceLevel - 60) * 0.16);

  if (answerSignals.concreteExample && answerSignals.hasOwnership)
    engagement += 16;
  if (answerSignals.strong || score >= 85) engagement += 18;
  if (recoveryLine || runtimeDecision === "recover") engagement += 14;
  if (trustTrend === "increasing") engagement += 8;
  if (trustTrend === "recovering") engagement += 10;

  // Emotional inertia: early weak turns should create skepticism, not instant checkout.
  const weaknessMultiplier = turnIndex <= 1 ? 0.45 : turnIndex === 2 ? 0.7 : 1;
  const accumulatedMultiplier = previousWeaknessCount >= 3 ? 1.25 : previousWeaknessCount >= 2 ? 1.1 : 1;
  const penalty = (value: number) => Math.round(value * weaknessMultiplier * accumulatedMultiplier);

  if (answerSignals.vague) engagement -= penalty(12);
  if (answerSignals.missingMetrics) engagement -= penalty(9);
  if (answerSignals.weakClarity) engagement -= penalty(8);
  if (answerSignals.tooLong) engagement -= penalty(12);
  if (conversationDrift === "losing_thread") engagement -= penalty(10);
  if (conversationDrift === "resetting") engagement -= penalty(14);
  if (patienceTrend === "strained") engagement -= penalty(7);
  if (patienceTrend === "dropping") engagement -= penalty(12);
  if (patienceTrend === "exhausted") engagement -= previousWeaknessCount >= 2 ? 26 : 14;
  if (trustTrend === "dropping") engagement -= penalty(8);
  if (trustTrend === "collapsed") engagement -= previousWeaknessCount >= 2 ? 22 : 10;

  // Guardrail: do not mentally reject a candidate on the first weak answer.
  if (turnIndex <= 1 && previousWeaknessCount === 0 && trustTrend !== "collapsed") {
    engagement = Math.max(engagement, 58);
  }

  return clamp(engagement, 0, 100);
}

function calculateCuriosityLevel({
  engagementLevel,
  answerSignals,
  trustTrend,
  patienceTrend,
  runtimeDecision,
  recoveryLine,
  score,
}: {
  engagementLevel: number;
  answerSignals: ReturnType<typeof analyzeRuntimeAnswer>;
  trustTrend: RecruiterTrustTrend;
  patienceTrend: RecruiterPatienceTrend;
  runtimeDecision: RecruiterRuntimeDecision;
  recoveryLine: string | null;
  score: number;
}) {
  let curiosity = Math.round(engagementLevel * 0.78);

  if (answerSignals.concreteExample) curiosity += 14;
  if (answerSignals.strong || score >= 85) curiosity += 16;
  if (recoveryLine || runtimeDecision === "recover") curiosity += 14;
  if (trustTrend === "recovering" || trustTrend === "increasing")
    curiosity += 8;

  if (answerSignals.vague) curiosity -= 10;
  if (answerSignals.missingMetrics) curiosity -= 7;
  if (answerSignals.tooLong) curiosity -= 14;
  if (patienceTrend === "dropping") curiosity -= 12;
  if (patienceTrend === "exhausted") curiosity -= 24;
  if (trustTrend === "collapsed") curiosity -= 22;

  return clamp(curiosity, 0, 100);
}

function calculateMentalCheckoutRisk({
  engagementLevel,
  curiosityLevel,
  trustTrend,
  patienceTrend,
  patienceLevel,
  conversationDrift,
  interruption,
  answerSignals,
}: {
  engagementLevel: number;
  curiosityLevel: number;
  trustTrend: RecruiterTrustTrend;
  patienceTrend: RecruiterPatienceTrend;
  patienceLevel: number;
  conversationDrift: RecruiterConversationDrift;
  interruption: InterruptionResult;
  answerSignals: ReturnType<typeof analyzeRuntimeAnswer>;
}) {
  let risk = 78 - Math.round((engagementLevel + curiosityLevel) / 2);

  if (patienceLevel <= 20) risk += 14;
  if (patienceTrend === "dropping") risk += 12;
  if (patienceTrend === "exhausted") risk += 24;
  if (trustTrend === "dropping") risk += 7;
  if (trustTrend === "collapsed") risk += 20;
  if (conversationDrift === "losing_thread") risk += 8;
  if (conversationDrift === "resetting") risk += 14;
  if (interruption.shouldInterrupt && interruption.severity === "high")
    risk += 10;
  if (answerSignals.tooLong) risk += 8;
  if (answerSignals.vague && answerSignals.missingMetrics) risk += 5;

  if (answerSignals.concreteExample && answerSignals.hasOwnership) risk -= 16;
  if (answerSignals.strong) risk -= 18;

  return clamp(risk, 0, 100);
}

function determineSilentJudgment({
  mentalCheckoutRisk,
  engagementLevel,
  curiosityLevel,
  trustTrend,
  patienceTrend,
  runtimeDecision,
}: {
  mentalCheckoutRisk: number;
  engagementLevel: number;
  curiosityLevel: number;
  trustTrend: RecruiterTrustTrend;
  patienceTrend: RecruiterPatienceTrend;
  runtimeDecision: RecruiterRuntimeDecision;
}): RecruiterSilentJudgment {
  if (runtimeDecision === "recover") return "watching_closely";

  if (
    mentalCheckoutRisk >= 88 ||
    (trustTrend === "collapsed" && patienceTrend === "exhausted") ||
    (engagementLevel <= 12 && curiosityLevel <= 12)
  ) {
    return "mentally_rejecting";
  }

  if (mentalCheckoutRisk >= 70 || engagementLevel <= 26) {
    return "quietly_doubting";
  }

  if (mentalCheckoutRisk >= 52 || curiosityLevel <= 35) {
    return "concerned";
  }

  if (mentalCheckoutRisk >= 34) return "watching_closely";

  return "none";
}

function determineEngagementTrend({
  engagementLevel,
  curiosityLevel,
  mentalCheckoutRisk,
  trustTrend,
  patienceTrend,
  recoveryLine,
  answerSignals,
}: {
  engagementLevel: number;
  curiosityLevel: number;
  mentalCheckoutRisk: number;
  trustTrend: RecruiterTrustTrend;
  patienceTrend: RecruiterPatienceTrend;
  recoveryLine: string | null;
  answerSignals: ReturnType<typeof analyzeRuntimeAnswer>;
}): RecruiterEngagementTrend {
  if (
    recoveryLine ||
    answerSignals.strong ||
    trustTrend === "recovering" ||
    trustTrend === "increasing"
  ) {
    return "rising";
  }

  if (
    mentalCheckoutRisk >= 82 ||
    engagementLevel <= 18 ||
    curiosityLevel <= 16
  ) {
    return "checked_out";
  }

  if (
    trustTrend === "dropping" ||
    trustTrend === "collapsed" ||
    patienceTrend === "dropping" ||
    patienceTrend === "exhausted" ||
    mentalCheckoutRisk >= 55
  ) {
    return "fading";
  }

  return "steady";
}

function applyEngagementDecayToLine({
  baseLine,
  silentJudgment,
  engagementLevel,
  curiosityLevel,
  mentalCheckoutRisk,
  runtimeDecision,
}: {
  baseLine: string;
  silentJudgment: RecruiterSilentJudgment;
  engagementLevel: number;
  curiosityLevel: number;
  mentalCheckoutRisk: number;
  runtimeDecision: RecruiterRuntimeDecision;
}) {
  if (!baseLine) return baseLine;

  // Strong recovery should not be undercut by silent judgment language.
  if (runtimeDecision === "recover") return baseLine;

  const normalized = baseLine.toLowerCase();

  if (
    silentJudgment === "mentally_rejecting" ||
    (mentalCheckoutRisk >= 92 && engagementLevel <= 10)
  ) {
    if (
      normalized.includes("let's move on") ||
      normalized.includes("let us move on")
    ) {
      return baseLine;
    }
    return `Okay, let’s move on. ${baseLine}`.replace(/\s+/g, " ").trim();
  }

  if (silentJudgment === "quietly_doubting" && engagementLevel <= 28) {
    if (normalized.startsWith("alright.")) return baseLine;
    return `Alright. ${baseLine}`.replace(/\s+/g, " ").trim();
  }

  if (silentJudgment === "concerned" && curiosityLevel <= 35) {
    if (normalized.startsWith("okay...")) return baseLine;
    return `Okay... ${baseLine}`.replace(/\s+/g, " ").trim();
  }

  return baseLine;
}

function determineEmotionalMomentum({
  trustTrend,
  patienceTrend,
  engagementTrend,
  recoveryLine,
  answerSignals,
}: {
  trustTrend: RecruiterTrustTrend;
  patienceTrend: RecruiterPatienceTrend;
  engagementTrend: RecruiterEngagementTrend;
  recoveryLine: string | null;
  answerSignals: ReturnType<typeof analyzeRuntimeAnswer>;
}): RecruiterEmotionalMomentum {
  if (recoveryLine || trustTrend === "recovering") return "recovering";
  if (answerSignals.strong || trustTrend === "increasing" || engagementTrend === "rising") {
    return "warming_up";
  }
  if (trustTrend === "collapsed" || patienceTrend === "exhausted") return "hardening";
  if (trustTrend === "dropping" || engagementTrend === "fading") return "cooling";
  return "steady";
}

function determineRecoveryResistance({
  previousMemory,
  trustTrend,
  patienceTrend,
  silentJudgment,
  mentalCheckoutRisk,
  turnIndex,
}: {
  previousMemory: EmotionalMemoryState;
  trustTrend: RecruiterTrustTrend;
  patienceTrend: RecruiterPatienceTrend;
  silentJudgment: RecruiterSilentJudgment;
  mentalCheckoutRisk: number;
  turnIndex: number;
}): RecruiterRecoveryResistance {
  const previousWeaknessCount =
    (previousMemory.repeatedWeaknesses?.length || 0) +
    (previousMemory.memories?.filter((item) =>
      item.signal === "vague_answer" ||
      item.signal === "missing_metrics" ||
      item.signal === "weak_clarity",
    ).length || 0);

  if (
    trustTrend === "collapsed" ||
    patienceTrend === "exhausted" ||
    silentJudgment === "mentally_rejecting" ||
    mentalCheckoutRisk >= 82 ||
    previousWeaknessCount >= 4 ||
    turnIndex >= 6
  ) {
    return "high";
  }

  if (
    trustTrend === "dropping" ||
    patienceTrend === "dropping" ||
    silentJudgment === "quietly_doubting" ||
    mentalCheckoutRisk >= 55 ||
    previousWeaknessCount >= 2 ||
    turnIndex >= 3
  ) {
    return "medium";
  }

  return "low";
}

function determineSkepticismCarryover({
  previousMemory,
  answerSignals,
  recoveryLine,
  trustTrend,
  turnIndex,
}: {
  previousMemory: EmotionalMemoryState;
  answerSignals: ReturnType<typeof analyzeRuntimeAnswer>;
  recoveryLine: string | null;
  trustTrend: RecruiterTrustTrend;
  turnIndex: number;
}): RecruiterSkepticismCarryover {
  const previousWeaknessCount =
    (previousMemory.repeatedWeaknesses?.length || 0) +
    (previousMemory.memories?.filter((item) =>
      item.signal === "vague_answer" ||
      item.signal === "missing_metrics" ||
      item.signal === "weak_clarity",
    ).length || 0);

  if (recoveryLine && previousWeaknessCount >= 3) return "moderate";
  if (recoveryLine && previousWeaknessCount >= 1) return "light";
  if (trustTrend === "collapsed" || previousWeaknessCount >= 4) return "heavy";
  if (trustTrend === "dropping" || previousWeaknessCount >= 2) return "moderate";
  if ((answerSignals.vague || answerSignals.missingMetrics) && turnIndex >= 2) return "light";
  return "none";
}

function determineEngagementInertia({
  engagementTrend,
  recoveryResistance,
  skepticismCarryover,
  trustTrend,
  turnIndex,
}: {
  engagementTrend: RecruiterEngagementTrend;
  recoveryResistance: RecruiterRecoveryResistance;
  skepticismCarryover: RecruiterSkepticismCarryover;
  trustTrend: RecruiterTrustTrend;
  turnIndex: number;
}): RecruiterEngagementInertia {
  if (recoveryResistance === "high" || skepticismCarryover === "heavy") return "resistant";
  if (engagementTrend === "rising" && skepticismCarryover !== "none") return "slow_recovery";
  if (engagementTrend === "fading" || trustTrend === "dropping") return "slow_decay";
  if (turnIndex <= 1 && engagementTrend !== "rising") return "stable";
  return "stable";
}

function determineInternalEmotion({
  mood,
  trustTrend,
  patienceTrend,
  silentJudgment,
  mentalCheckoutRisk,
  recoveryLine,
  answerSignals,
}: {
  mood: RecruiterRuntimeMood;
  trustTrend: RecruiterTrustTrend;
  patienceTrend: RecruiterPatienceTrend;
  silentJudgment: RecruiterSilentJudgment;
  mentalCheckoutRisk: number;
  recoveryLine: string | null;
  answerSignals: ReturnType<typeof analyzeRuntimeAnswer>;
}): RecruiterInternalEmotion {
  if (recoveryLine || trustTrend === "recovering") return "recovering";
  if (mood === "impressed" || mood === "interested" || trustTrend === "increasing") {
    return "interested";
  }
  if (silentJudgment === "mentally_rejecting" || mentalCheckoutRisk >= 88) {
    return "disengaged";
  }
  if (patienceTrend === "exhausted") return "impatient";
  if (patienceTrend === "dropping" || answerSignals.tooLong) return "frustrated";
  if (mood === "skeptical" || trustTrend === "dropping" || answerSignals.vague) {
    return "skeptical";
  }
  return "calm";
}

function determineMaskingStrength({
  recruiterId,
  internalEmotion,
  silentJudgment,
  mentalCheckoutRisk,
  runtimeDecision,
}: {
  recruiterId: RecruiterRuntimePersonality;
  internalEmotion: RecruiterInternalEmotion;
  silentJudgment: RecruiterSilentJudgment;
  mentalCheckoutRisk: number;
  runtimeDecision: RecruiterRuntimeDecision;
}): RecruiterMaskingStrength {
  if (runtimeDecision === "recover") return "low";

  let score = 35;

  if (recruiterId === "corporate_recruiter") score += 35;
  if (recruiterId === "friendly_hr") score += 25;
  if (recruiterId === "analytical_hiring_manager") score += 18;
  if (recruiterId === "startup_recruiter") score -= 8;

  if (internalEmotion === "disengaged") score += 22;
  if (internalEmotion === "impatient") score += 14;
  if (silentJudgment === "mentally_rejecting") score += 18;
  if (mentalCheckoutRisk >= 85) score += 16;

  if (score >= 75) return "high";
  if (score >= 48) return "medium";
  return "low";
}

function determineProfessionalContainment({
  recruiterId,
  maskingStrength,
  internalEmotion,
  silentJudgment,
}: {
  recruiterId: RecruiterRuntimePersonality;
  maskingStrength: RecruiterMaskingStrength;
  internalEmotion: RecruiterInternalEmotion;
  silentJudgment: RecruiterSilentJudgment;
}): RecruiterProfessionalContainment {
  if (
    maskingStrength === "high" ||
    recruiterId === "corporate_recruiter" ||
    silentJudgment === "mentally_rejecting"
  ) {
    return "strongly_contained";
  }

  if (
    maskingStrength === "medium" ||
    internalEmotion === "frustrated" ||
    recruiterId === "friendly_hr"
  ) {
    return "controlled";
  }

  return "open";
}

function determineVisibleEmotion({
  recruiterId,
  internalEmotion,
  professionalContainment,
  runtimeDecision,
  recoveryLine,
}: {
  recruiterId: RecruiterRuntimePersonality;
  internalEmotion: RecruiterInternalEmotion;
  professionalContainment: RecruiterProfessionalContainment;
  runtimeDecision: RecruiterRuntimeDecision;
  recoveryLine: string | null;
}): RecruiterVisibleEmotion {
  if (runtimeDecision === "recover" || recoveryLine) {
    return recruiterId === "friendly_hr" ? "encouraging" : "neutral";
  }

  if (professionalContainment === "strongly_contained") {
    if (internalEmotion === "disengaged") return "cold";
    return "contained";
  }

  if (professionalContainment === "controlled") {
    if (recruiterId === "friendly_hr") return "warm";
    if (recruiterId === "startup_recruiter") return "direct";
    return "neutral";
  }

  if (recruiterId === "startup_recruiter") return "direct";
  if (recruiterId === "friendly_hr") return "warm";
  return "neutral";
}

function determineEmotionalLeakage({
  internalEmotion,
  visibleEmotion,
  maskingStrength,
  professionalContainment,
  mentalCheckoutRisk,
  patienceTrend,
  conversationDrift,
}: {
  internalEmotion: RecruiterInternalEmotion;
  visibleEmotion: RecruiterVisibleEmotion;
  maskingStrength: RecruiterMaskingStrength;
  professionalContainment: RecruiterProfessionalContainment;
  mentalCheckoutRisk: number;
  patienceTrend: RecruiterPatienceTrend;
  conversationDrift: RecruiterConversationDrift;
}): RecruiterEmotionalLeakage {
  if (conversationDrift === "resetting" || conversationDrift === "losing_thread") {
    return "visible_reset";
  }

  if (internalEmotion === "disengaged" && visibleEmotion === "cold") {
    return "briefness";
  }

  if (internalEmotion === "impatient" || patienceTrend === "exhausted") {
    return maskingStrength === "high" ? "coolness" : "impatience";
  }

  if (
    professionalContainment === "strongly_contained" ||
    mentalCheckoutRisk >= 75
  ) {
    return "coolness";
  }

  return "none";
}

function compressRecruiterLine({
  line,
  runtimeDecision,
  silentJudgment,
  engagementTrend,
  professionalContainment,
  emotionalLeakage,
  recoveryResistance,
  skepticismCarryover,
}: {
  line: string;
  runtimeDecision: RecruiterRuntimeDecision;
  silentJudgment: RecruiterSilentJudgment;
  engagementTrend: RecruiterEngagementTrend;
  professionalContainment: RecruiterProfessionalContainment;
  emotionalLeakage: RecruiterEmotionalLeakage;
  recoveryResistance: RecruiterRecoveryResistance;
  skepticismCarryover: RecruiterSkepticismCarryover;
}) {
  if (!line) return line;

  // Remove duplicate transition phrases that can appear when multiple emotional systems stack.
  let cleaned = line.replace(/\s+/g, " ").trim();
  const transitionPatterns = [
    /^(Okay\. Let’s continue\.\s*)+(?=Okay|Alright|Actually|Let|Hmm|Hold|Wait|Give|What)/i,
    /^(Okay, let’s move on\.\s*)+(?=Okay|Alright|Actually|Let|Hmm|Hold|Wait|Give|What)/i,
    /^(Thank you\. Let’s move to the next point\.\s*)+(?=Okay|Alright|Actually|Let|Hmm|Hold|Wait|Give|What)/i,
    /^(Thank you\. Let’s keep this structured\.\s*)+(?=Okay|Alright|Actually|Let|Hmm|Hold|Wait|Give|What)/i,
  ];

  for (const pattern of transitionPatterns) {
    cleaned = cleaned.replace(pattern, "");
  }

  cleaned = cleaned
    .replace(/Okay\. Let’s continue\. Okay, let’s move on\./gi, "Okay. Let’s continue.")
    .replace(/Okay, let’s move on\. Okay\. Let’s continue\./gi, "Okay. Let’s continue.")
    .replace(/Let me rephrase that\. Let me rephrase that\./gi, "Let me rephrase that.")
    .replace(/Actually, let me ask this differently\. Actually, let me ask this differently\./gi, "Actually, let me ask this differently.")
    .replace(/Alright\.\.\. let’s reset for a second\. Alright\.\.\. let’s reset for a second\./gi, "Alright... let’s reset for a second.")
    .replace(/\s+/g, " ")
    .trim();

  // When the recruiter is professionally checked out, the response should become shorter, not more layered.
  if (
    runtimeDecision !== "recover" &&
    silentJudgment === "mentally_rejecting" &&
    engagementTrend === "checked_out" &&
    professionalContainment === "strongly_contained"
  ) {
    if (emotionalLeakage === "visible_reset") {
      return "Okay. Let’s reset this. Give me one specific situation, your action, and the result.";
    }

    return "Okay. Let’s move on.";
  }

  if (
    runtimeDecision === "recover" &&
    (recoveryResistance === "medium" || recoveryResistance === "high") &&
    skepticismCarryover !== "none"
  ) {
    if (!cleaned.toLowerCase().includes("still want")) {
      return `${cleaned} I still want to see if you can keep that level of specificity.`
        .replace(/\s+/g, " ")
        .trim();
    }
  }

  return cleaned;
}

function applyProfessionalMaskingToLine({
  baseLine,
  recruiterId,
  internalEmotion,
  visibleEmotion,
  maskingStrength,
  professionalContainment,
  emotionalLeakage,
  runtimeDecision,
}: {
  baseLine: string;
  recruiterId: RecruiterRuntimePersonality;
  internalEmotion: RecruiterInternalEmotion;
  visibleEmotion: RecruiterVisibleEmotion;
  maskingStrength: RecruiterMaskingStrength;
  professionalContainment: RecruiterProfessionalContainment;
  emotionalLeakage: RecruiterEmotionalLeakage;
  runtimeDecision: RecruiterRuntimeDecision;
}) {
  if (!baseLine) return baseLine;
  if (runtimeDecision === "recover") return baseLine;

  const normalized = baseLine.toLowerCase();

  if (
    internalEmotion === "disengaged" &&
    maskingStrength === "high" &&
    professionalContainment === "strongly_contained"
  ) {
    if (normalized.startsWith("thank you.")) return baseLine;

    if (recruiterId === "friendly_hr") {
      return `Thank you. Let’s move to the next point. ${baseLine}`
        .replace(/\s+/g, " ")
        .trim();
    }

    if (recruiterId === "corporate_recruiter") {
      return `Thank you. Let’s keep this structured. ${baseLine}`
        .replace(/\s+/g, " ")
        .trim();
    }

    return `Okay. Let’s continue. ${baseLine}`.replace(/\s+/g, " ").trim();
  }

  if (emotionalLeakage === "briefness" && !normalized.startsWith("alright.")) {
    return `Alright. ${baseLine}`.replace(/\s+/g, " ").trim();
  }

  if (visibleEmotion === "contained" && emotionalLeakage === "coolness") {
    if (normalized.startsWith("okay.")) return baseLine;
    return `Okay. ${baseLine}`.replace(/\s+/g, " ").trim();
  }

  if (visibleEmotion === "warm" && runtimeDecision === "challenge") {
    if (normalized.startsWith("okay,")) return baseLine;
    return `Okay, let’s make this clearer. ${baseLine}`
      .replace(/\s+/g, " ")
      .trim();
  }

  if (visibleEmotion === "direct" && runtimeDecision === "challenge") {
    if (normalized.startsWith("let's get specific")) return baseLine;
    return `Let’s get specific. ${baseLine}`.replace(/\s+/g, " ").trim();
  }

  return baseLine;
}

function determineNextAction(
  runtimeDecision: RecruiterRuntimeDecision,
  mood: RecruiterRuntimeMood,
  memory: EmotionalMemoryState,
): RecruiterRuntimeOutput["nextAction"] {
  if (
    runtimeDecision === "interrupt" ||
    runtimeDecision === "challenge" ||
    runtimeDecision === "probe"
  ) {
    return "ask_follow_up";
  }

  if (
    runtimeDecision === "recover" ||
    memory.trust < 50 ||
    mood === "recovering"
  ) {
    return "recover_trust";
  }

  if (runtimeDecision === "react" && memory.trust >= 78) {
    return "move_on";
  }

  return "wait";
}

function getPrimarySignal(
  answerSignals: ReturnType<typeof analyzeRuntimeAnswer>,
  score: number,
): RecruiterRuntimeOutput["signal"] {
  if (score >= 85 || answerSignals.strong) return "strong_answer";
  if (answerSignals.concreteExample && answerSignals.hasOwnership)
    return "neutral_answer";
  if (answerSignals.tooLong) return "too_long";
  if (answerSignals.weakClarity) return "weak_clarity";
  if (answerSignals.vague) return "vague_answer";
  if (answerSignals.missingMetrics) return "missing_metrics";
  return "neutral_answer";
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
