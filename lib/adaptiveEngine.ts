export type RecruiterEmotion =
  | "neutral"
  | "engaged"
  | "impressed"
  | "skeptical"
  | "concerned"
  | "pressuring";

export type AdaptiveEvaluationInput = {
  answer: string;
  currentEmotion?: RecruiterEmotion;
  pressureLevel?: number;
  targetRole?: string;
};

export type AdaptiveEvaluationOutput = {
  emotion: RecruiterEmotion;
  pressureLevel: number;
  recruiterReaction: string;
  interruptionChance: number;
  followUpStyle:
    | "supportive"
    | "analytical"
    | "skeptical"
    | "pressure";
};

function contains(text: string, keywords: string[]) {
  return keywords.some((keyword) =>
    text.toLowerCase().includes(keyword.toLowerCase())
  );
}

export function evaluateAdaptiveState(
  input: AdaptiveEvaluationInput
): AdaptiveEvaluationOutput {
  const answer = input.answer || "";

  const wordCount = answer.split(/\s+/).filter(Boolean).length;

  const hasMetrics = contains(answer, [
    "%",
    "percent",
    "improved",
    "reduced",
    "increased",
    "saved",
    "users",
    "customers",
    "tickets",
    "hours",
    "days",
    "faster",
  ]);

  const hasOwnership = contains(answer, [
    "i led",
    "i created",
    "i improved",
    "i solved",
    "i managed",
    "i handled",
    "i built",
    "i designed",
    "i implemented",
  ]);

  const vagueLanguage = contains(answer, [
    "hardworking",
    "passionate",
    "team player",
    "quick learner",
    "good communication",
  ]);

  const weakConfidence = contains(answer, [
    "maybe",
    "i think",
    "probably",
    "not sure",
    "kind of",
  ]);

  let emotion: RecruiterEmotion = "neutral";

  let pressureLevel = input.pressureLevel || 35;

  let recruiterReaction =
    "Interesting. Help me understand that more clearly.";

  let interruptionChance = 10;

  let followUpStyle:
    | "supportive"
    | "analytical"
    | "skeptical"
    | "pressure" = "analytical";

  // STRONG ANSWER
  if (
    wordCount >= 45 &&
    hasMetrics &&
    hasOwnership &&
    !weakConfidence
  ) {
    emotion = "impressed";

    pressureLevel = Math.max(15, pressureLevel - 10);

    recruiterReaction =
      "Good, now I can see what you owned and what changed. Let’s go one level deeper.";

    interruptionChance = 5;

    followUpStyle = "analytical";
  }

  // GOOD ANSWER
  else if (
    wordCount >= 30 &&
    (hasMetrics || hasOwnership)
  ) {
    emotion = "engaged";

    pressureLevel = Math.max(25, pressureLevel - 3);

    recruiterReaction =
      "Okay, I can follow your thinking there.";

    interruptionChance = 12;

    followUpStyle = "analytical";
  }

  // VAGUE ANSWER
  else if (
    vagueLanguage ||
    wordCount < 18
  ) {
    emotion = "skeptical";

    pressureLevel += 12;

    recruiterReaction =
      "That still sounds generic. I need a real example, not general statements.";

    interruptionChance = 35;

    followUpStyle = "skeptical";
  }

  // LOW CONFIDENCE
  else if (weakConfidence) {
    emotion = "concerned";

    pressureLevel += 8;

    recruiterReaction =
      "You sound uncertain. Convince me you can handle this role.";

    interruptionChance = 25;

    followUpStyle = "pressure";
  }

  // HIGH PRESSURE MODE
  if (pressureLevel >= 75) {
    emotion = "pressuring";

    recruiterReaction =
      "I’m still not getting enough proof. Why should we hire you over another candidate?";

    interruptionChance = 55;

    followUpStyle = "pressure";
  }

  pressureLevel = Math.max(0, Math.min(100, pressureLevel));

  return {
    emotion,
    pressureLevel,
    recruiterReaction,
    interruptionChance,
    followUpStyle,
  };
}