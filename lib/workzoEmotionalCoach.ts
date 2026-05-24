export type EmotionalSignal =
  | "trust_drop"
  | "confidence_drop"
  | "vague_response"
  | "strong_recovery"
  | "clear_confidence"
  | "defensive_tone"
  | "strong_ownership";

export type EmotionalCoachingInsight = {
  signal: EmotionalSignal;
  headline: string;
  explanation: string;
  coaching: string;
  intensity: "low" | "medium" | "high";
};

export function analyzeEmotionalSignals({
  answer,
  recruiterTrust,
  recruiterState,
}: {
  answer: string;
  recruiterTrust: number;
  recruiterState: string;
}): EmotionalCoachingInsight[] {
  const insights: EmotionalCoachingInsight[] = [];

  const lower = answer.toLowerCase();

  const uncertain =
    /\bmaybe\b|\bi think\b|\bprobably\b|\bkind of\b|\bsort of\b|\bnot sure\b/i.test(
      lower,
    );

  const vague =
    /\bthings\b|\bstuff\b|\bvarious\b|\ba lot\b|\bhelped\b|\bworked on\b/i.test(
      lower,
    );

  const defensive =
    /\bbut\b|\bactually\b|\bi mean\b|\bto be honest\b/i.test(lower);

  const ownership =
    /\bi\b|\bmy\b|\bled\b|\bowned\b|\bcreated\b|\bimplemented\b|\bresolved\b/i.test(
      lower,
    );

  const strongConfidence =
    /\bi delivered\b|\bi improved\b|\bi solved\b|\bi led\b|\bi built\b/i.test(
      lower,
    );

  if (recruiterTrust < 45 || recruiterState === "skeptical") {
    insights.push({
      signal: "trust_drop",
      headline: "Recruiter trust is weakening.",
      explanation:
        "The recruiter may feel unconvinced or unclear about your impact.",
      coaching:
        "Use one concrete example and measurable outcome immediately.",
      intensity: "high",
    });
  }

  if (uncertain) {
    insights.push({
      signal: "confidence_drop",
      headline: "Your wording sounds uncertain.",
      explanation:
        "Hesitant language can reduce recruiter confidence even when your experience is valid.",
      coaching:
        "Replace soft wording with direct ownership and clear statements.",
      intensity: "medium",
    });
  }

  if (vague) {
    insights.push({
      signal: "vague_response",
      headline: "Your answer is becoming vague.",
      explanation:
        "Broad wording makes it harder for recruiters to trust the example.",
      coaching:
        "Use one specific project, challenge, or measurable result.",
      intensity: "medium",
    });
  }

  if (defensive && recruiterTrust < 60) {
    insights.push({
      signal: "defensive_tone",
      headline: "You may sound slightly defensive.",
      explanation:
        "The recruiter could interpret the answer as reactive instead of confident.",
      coaching:
        "Slow down and focus on facts, ownership, and outcomes.",
      intensity: "medium",
    });
  }

  if (strongConfidence && ownership) {
    insights.push({
      signal: "clear_confidence",
      headline: "Your confidence is improving.",
      explanation:
        "The answer sounds more direct and ownership-driven.",
      coaching:
        "Keep using measurable and action-oriented language.",
      intensity: "low",
    });
  }

  if (
    recruiterTrust > 70 &&
    ownership &&
    !uncertain &&
    !vague
  ) {
    insights.push({
      signal: "strong_recovery",
      headline: "You are recovering recruiter confidence.",
      explanation:
        "The recruiter is receiving clearer evidence and stronger ownership signals.",
      coaching:
        "Continue with concise, structured answers.",
      intensity: "low",
    });
  }

  if (ownership) {
    insights.push({
      signal: "strong_ownership",
      headline: "Ownership signals are strong here.",
      explanation:
        "The recruiter can clearly understand your contribution.",
      coaching:
        "Maintain this clarity while adding measurable outcomes.",
      intensity: "low",
    });
  }

  return insights.slice(0, 4);
}