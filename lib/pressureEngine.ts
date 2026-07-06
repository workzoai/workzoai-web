type PressureInput = {
  recruiterMood: string;

  atmosphere: string;

  confidence: number;

  clarity: number;

  relevance: number;

  candidateAnswer: string;
};

export type PressureResult = {
  pressureLevel:
    | "low"
    | "medium"
    | "high";

  recruiterPressureBehavior: string;

  pressureInstructions: string;
};

export function evaluatePressure({
  recruiterMood,
  atmosphere,
  confidence,
  clarity,
  relevance,
  candidateAnswer,
}: PressureInput): PressureResult {
  const lower =
    candidateAnswer.toLowerCase();

  const average =
    (
      confidence +
      clarity +
      relevance
    ) / 3;

  const vagueAnswer =
    lower.includes(
      "hardworking"
    ) ||
    lower.includes(
      "passionate"
    ) ||
    lower.includes(
      "team player"
    );

  const noMetrics =
    !/\d/.test(
      candidateAnswer
    );

  const brutalMode =
    atmosphere ===
    "Brutal";

  // HIGH PRESSURE
  if (
    brutalMode ||
    recruiterMood ===
      "Impatient" ||
    (
      vagueAnswer &&
      noMetrics
    )
  ) {
    return {
      pressureLevel:
        "high",

      recruiterPressureBehavior:
        `
- Interrupt more aggressively.
- Challenge vague statements immediately.
- Push candidate harder for clarity.
- Increase recruiter skepticism.
- Ask sharper follow-up questions.
- Pressure concise communication.
`,

      pressureInstructions:
        `
Use stronger recruiter pressure.

Examples:
- "Let me pause you there, I’m still not seeing the actual scope."
- "What changed because of your work?"
- "You’re staying quite broad. Bring it down to one specific situation."
- "Give me the specific action and result."
`,
    };
  }

  // MEDIUM PRESSURE
  if (
    average < 70
  ) {
    return {
      pressureLevel:
        "medium",

      recruiterPressureBehavior:
        `
- Maintain realistic pressure.
- Ask follow-up clarification questions.
- Push candidate for measurable outcomes.
`,

      pressureInstructions:
        `
Use moderate recruiter pressure.

Examples:
- "can you clarify that?"
- "walk me through the impact."
- "what exactly changed?"
`,
    };
  }

  // LOW PRESSURE
  return {
    pressureLevel:
      "low",

    recruiterPressureBehavior:
      `
- Maintain smoother recruiter flow.
- Ask deeper strategic questions.
- Focus on analytical follow-ups.
`,

    pressureInstructions:
      `
Use balanced recruiter pressure.

Examples:
- "interesting."
- "tell me more about that."
- "what was your thought process?"
`,
  };
}