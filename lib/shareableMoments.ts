export type ShareableMomentInput = {
  wowMoment?: {
    shouldTrigger?: boolean;
    line?: string;
    emotionalTag?: string;
  };
  trust?: number;
  pressure?: number;
  contradiction?: string;
};

export function detectShareableMoment({
  wowMoment,
  trust = 0,
  pressure = 0,
  contradiction,
}: ShareableMomentInput) {
  if (wowMoment?.shouldTrigger && wowMoment.line) {
    return {
      shouldHighlight: true,
      shareTitle: "AI recruiter challenge moment",
      shareText: wowMoment.line,
      category: "wow_moment",
    };
  }

  if (contradiction) {
    return {
      shouldHighlight: true,
      shareTitle: "AI caught my contradiction",
      shareText: contradiction,
      category: "contradiction",
    };
  }

  if (trust >= 70) {
    return {
      shouldHighlight: true,
      shareTitle: "Recruiter trust improved",
      shareText: "The AI recruiter became more confident after a stronger answer.",
      category: "trust_recovery",
    };
  }

  if (pressure >= 75) {
    return {
      shouldHighlight: true,
      shareTitle: "Pressure moment",
      shareText: "The AI recruiter increased pressure after a weak answer.",
      category: "pressure",
    };
  }

  return {
    shouldHighlight: false,
    shareTitle: "",
    shareText: "",
    category: "none",
  };
}
