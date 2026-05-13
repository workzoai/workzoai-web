export type TavusEmotionState = {
  facialExpression: "neutral" | "focused" | "challenging" | "positive" | "skeptical";
  eyeContact: "soft" | "focused" | "strong" | "warm";
  motion: "subtle" | "calm" | "sharp" | "tense";
  promptCue: string;
};

export function getTavusEmotionState({
  mood,
  trust,
  pressure,
}: {
  mood: string;
  trust: number;
  pressure: number;
}): TavusEmotionState {
  const normalized = mood.toLowerCase();

  if (pressure >= 75 || normalized.includes("interrupt")) {
    return {
      facialExpression: "challenging",
      eyeContact: "strong",
      motion: "sharp",
      promptCue:
        "Maintain firm eye contact. Speak directly. Slightly reduce warmth. The recruiter is increasing pressure.",
    };
  }

  if (normalized.includes("skept") || trust < 42) {
    return {
      facialExpression: "skeptical",
      eyeContact: "focused",
      motion: "tense",
      promptCue:
        "Look skeptical and thoughtful. Pause before speaking. Make the candidate feel they need stronger proof.",
    };
  }

  if (trust >= 70 || normalized.includes("impress")) {
    return {
      facialExpression: "positive",
      eyeContact: "warm",
      motion: "calm",
      promptCue:
        "Look more positive and engaged. Show subtle approval, but remain professional.",
    };
  }

  if (normalized.includes("clarif")) {
    return {
      facialExpression: "focused",
      eyeContact: "strong",
      motion: "subtle",
      promptCue:
        "Look focused and precise. Clarify the mismatch before continuing.",
    };
  }

  return {
    facialExpression: "neutral",
    eyeContact: "focused",
    motion: "subtle",
    promptCue:
      "Stay neutral, professional, and attentive. The recruiter is listening closely.",
  };
}
