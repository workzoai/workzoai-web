export type WorkZoRecruiterVisualState =
  | "listening"
  | "thinking"
  | "skeptical"
  | "interested"
  | "interrupting"
  | "typing_notes"
  | "waiting"
  | "recovering_connection";

export type WorkZoReactionIntensity = "soft" | "medium" | "strong";

export type WorkZoLiveReaction = {
  text: string;
  visualState: WorkZoRecruiterVisualState;
  trustDelta: number;
  intensity: WorkZoReactionIntensity;
};

export type WorkZoEmotionalMemory = {
  vagueAnswers: number;
  missingMetrics: number;
  unclearOwnership: number;
  nervousPauses: number;
  strongMoments: string[];
  weakMoments: string[];
  lastCallbackLine?: string;
};

export type WorkZoInterruptionDecision = {
  shouldInterrupt: boolean;
  line: string;
  reason: "too_generic" | "rambling" | "missing_metrics" | "unclear_ownership" | "none";
};

export function createWorkZoEmotionalMemory(): WorkZoEmotionalMemory {
  return {
    vagueAnswers: 0,
    missingMetrics: 0,
    unclearOwnership: 0,
    nervousPauses: 0,
    strongMoments: [],
    weakMoments: [],
  };
}

export function getWorkZoLiveReaction(answer: string): WorkZoLiveReaction {
  const clean = answer.replace(/\s+/g, " ").trim();
  const lower = clean.toLowerCase();
  const wordCount = clean.split(" ").filter(Boolean).length;

  const hasMetric = /\d|percent|percentage|csat|satisfaction|score|saved|reduced|increased|improved|faster|customers?|users?|tickets?|revenue|cost|conversion|won|award|top|rank/i.test(clean);
  const hasOwnership = /\b(i|my|me|personally)\b|owned|led|built|created|handled|resolved|implemented|improved|supported|managed|coordinated|delivered|worked/i.test(clean);
  const hasOutcome = /customer|client|user|ticket|satisfaction|trust|resolved|won|award|converted|result|impact|improved|reduced|increased|saved|learned/i.test(clean);
  const vagueOnly = /things|stuff|something|various|a lot|helped|worked on|good|nice/i.test(lower) && !hasMetric && !hasOutcome;

  if (wordCount > 160) {
    return {
      text: "Let me pause you there — I want the core example and result.",
      visualState: "interrupting",
      trustDelta: -1,
      intensity: "medium",
    };
  }

  if (hasMetric && hasOwnership) {
    return {
      text: "Good — that gives me something concrete to evaluate.",
      visualState: "interested",
      trustDelta: 2,
      intensity: "medium",
    };
  }

  if (hasOutcome || hasMetric) {
    return {
      text: "Okay, there is useful signal there.",
      visualState: "thinking",
      trustDelta: 1,
      intensity: "soft",
    };
  }

  if (wordCount > 35 && !hasOwnership) {
    return {
      text: "I want to understand your personal role there.",
      visualState: "skeptical",
      trustDelta: -1,
      intensity: "soft",
    };
  }

  if (vagueOnly) {
    return {
      text: "I may need one clearer example.",
      visualState: "thinking",
      trustDelta: -1,
      intensity: "soft",
    };
  }

  return {
    text: "Hmm. Go on.",
    visualState: "listening",
    trustDelta: 0,
    intensity: "soft",
  };
}

export function updateWorkZoEmotionalMemory(
  memory: WorkZoEmotionalMemory,
  answer: string,
): WorkZoEmotionalMemory {
  const reaction = getWorkZoLiveReaction(answer);
  const next: WorkZoEmotionalMemory = {
    ...memory,
    strongMoments: [...memory.strongMoments],
    weakMoments: [...memory.weakMoments],
  };

  if (/general|vague/i.test(reaction.text)) next.vagueAnswers += 1;
  if (/numbers|measurable|impact/i.test(reaction.text)) next.missingMetrics += 1;
  if (/personally|owned/i.test(reaction.text)) next.unclearOwnership += 1;

  if (reaction.trustDelta > 0) {
    next.strongMoments = [reaction.text, ...next.strongMoments].slice(0, 5);
  }

  if (reaction.trustDelta < 0) {
    next.weakMoments = [reaction.text, ...next.weakMoments].slice(0, 5);
  }

  if (next.missingMetrics >= 2) {
    next.lastCallbackLine = "Earlier you also avoided giving numbers, so I want you to be specific now.";
  } else if (next.unclearOwnership >= 2) {
    next.lastCallbackLine = "You have mentioned team outcomes a few times, but I still need your personal contribution.";
  } else if (next.vagueAnswers >= 2) {
    next.lastCallbackLine = "I’m noticing a pattern: your answers are still staying too high-level.";
  }

  return next;
}

export function decideWorkZoInterruption(answer: string): WorkZoInterruptionDecision {
  const clean = answer.replace(/\s+/g, " ").trim();
  const lower = clean.toLowerCase();
  const wordCount = clean.split(" ").filter(Boolean).length;

  const hasMetric = /\d|percent|percentage|csat|satisfaction|score|saved|reduced|increased|improved|faster|customers?|users?|tickets?|revenue|cost|conversion|won|award|top|rank/i.test(clean);
  const hasOwnership = /\b(i|my|me|personally)\b|owned|led|built|created|handled|resolved|implemented|supported|managed|coordinated|delivered|worked/i.test(clean);
  const hasOutcome = /customer|client|user|ticket|satisfaction|trust|resolved|won|award|converted|result|impact|improved|reduced|increased|saved|learned/i.test(clean);
  const isOnlyFiller = /^(um+|uh+|okay|yes|no|yeah|hmm|i don'?t know)[\s.!,]*$/i.test(clean);
  const vagueWithoutEvidence = /things|stuff|something|various|a lot|helped|worked on/i.test(lower) && !hasMetric && !hasOutcome;

  // Do NOT interrupt useful early answers. Let the unified recruiter intelligence respond naturally.
  // Interrupt only when the candidate is clearly rambling, gives almost no answer, or avoids ownership for a long time.
  if (isOnlyFiller) {
    return { shouldInterrupt: false, line: "", reason: "none" };
  }

  if (wordCount > 170) {
    return {
      shouldInterrupt: true,
      line: "Let me pause you there — give me the core situation, your action, and the result in a few sentences.",
      reason: "rambling",
    };
  }

  if (wordCount > 90 && !hasOwnership) {
    return {
      shouldInterrupt: true,
      line: "Let me pause you there — what was your personal role in that situation?",
      reason: "unclear_ownership",
    };
  }

  if (wordCount > 80 && vagueWithoutEvidence) {
    return {
      shouldInterrupt: true,
      line: "Let me make this more concrete — choose one real situation and walk me through what happened.",
      reason: "too_generic",
    };
  }

  return { shouldInterrupt: false, line: "", reason: "none" };
}
