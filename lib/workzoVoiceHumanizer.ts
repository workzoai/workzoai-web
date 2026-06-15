export type WorkZoVoiceRecruiterId =
  | "friendly_hr"
  | "startup_recruiter"
  | "analytical_hiring_manager"
  | "corporate_recruiter"
  | string;

export type WorkZoVoiceRecruiterState =
  | "neutral"
  | "interested"
  | "engaged"
  | "skeptical"
  | "pressuring"
  | "recovering_trust"
  | "losing_confidence"
  | string;

export type WorkZoVoiceStyle = {
  label: string;
  personalityCue: string;
  pacingCue: string;
  emotionalCue: string;
  fillerPool: string[];
  rateBias: number;
  pitchBias: number;
  minPauseMs: number;
  maxPauseMs: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeRecruiter(recruiterId?: WorkZoVoiceRecruiterId) {
  const raw = String(recruiterId || "").toLowerCase();
  if (raw.includes("startup") || raw.includes("priya")) return "priya";
  if (raw.includes("friendly") || raw.includes("sarah")) return "sarah";
  if (raw.includes("german") || raw.includes("corporate") || raw.includes("markus")) return "markus";
  if (raw.includes("analytical") || raw.includes("daniel") || raw.includes("hiring")) return "daniel";
  return "sarah";
}

export function getWorkZoVoiceStyle(
  recruiterId?: WorkZoVoiceRecruiterId,
  recruiterState?: WorkZoVoiceRecruiterState,
): WorkZoVoiceStyle {
  const key = normalizeRecruiter(recruiterId);
  const state = String(recruiterState || "neutral").toLowerCase();
  const pressure = state.includes("skeptical") || state.includes("pressuring") || state.includes("losing");
  const recovery = state.includes("recovering");

  if (key === "priya") {
    return {
      label: "startup recruiter",
      personalityCue: "warm, energetic startup recruiter; concise, practical, ownership-focused",
      pacingCue: pressure ? "slightly faster, direct, still fair" : "natural, lively, conversational",
      emotionalCue: recovery ? "encouraging but still assessing" : pressure ? "curious but unconvinced" : "engaged and friendly",
      fillerPool: pressure ? ["Right", "Okay", "Let’s be specific"] : ["Okay", "Got it", "That makes sense"],
      rateBias: pressure ? 0.04 : 0.01,
      pitchBias: 0.02,
      minPauseMs: pressure ? 520 : 420,
      maxPauseMs: pressure ? 1150 : 950,
    };
  }

  if (key === "markus") {
    return {
      label: "corporate recruiter",
      personalityCue: "structured corporate interviewer; precise, calm, evidence-driven",
      pacingCue: pressure ? "measured and firmer" : "steady and professional",
      emotionalCue: recovery ? "reserved but open" : pressure ? "skeptical and exacting" : "neutral and attentive",
      fillerPool: pressure ? ["Let me be precise", "I need evidence here"] : ["Understood", "Good", "Let’s continue"],
      rateBias: pressure ? 0.02 : -0.02,
      pitchBias: -0.02,
      minPauseMs: pressure ? 760 : 620,
      maxPauseMs: pressure ? 1450 : 1250,
    };
  }

  if (key === "daniel") {
    return {
      label: "analytical hiring manager",
      personalityCue: "analytical hiring manager; calm, logical, detail-oriented",
      pacingCue: pressure ? "slower, probing, analytical" : "thoughtful and measured",
      emotionalCue: recovery ? "noticing improvement" : pressure ? "checking the reasoning carefully" : "curious and focused",
      fillerPool: pressure ? ["Let’s examine that", "Hold on", "Walk me through it"] : ["Interesting", "I see", "Okay"],
      rateBias: pressure ? -0.01 : -0.03,
      pitchBias: -0.01,
      minPauseMs: pressure ? 820 : 650,
      maxPauseMs: pressure ? 1550 : 1300,
    };
  }

  return {
    label: "friendly HR recruiter",
    personalityCue: "friendly HR recruiter; warm, reassuring, human, but still professional",
    pacingCue: pressure ? "gentle but firmer" : "warm and natural",
    emotionalCue: recovery ? "supportive and encouraging" : pressure ? "concerned but fair" : "welcoming and engaged",
    fillerPool: pressure ? ["Let me pause there", "Okay", "I want to understand this clearly"] : ["Of course", "That’s okay", "Good to hear"],
    rateBias: pressure ? 0.0 : -0.02,
    pitchBias: 0.03,
    minPauseMs: pressure ? 650 : 480,
    maxPauseMs: pressure ? 1300 : 1050,
  };
}

export function calculateWorkZoThinkingPauseMs(input: {
  text?: string;
  recruiterId?: WorkZoVoiceRecruiterId;
  recruiterState?: WorkZoVoiceRecruiterState;
  isOpening?: boolean;
  isFollowUp?: boolean;
  apiPauseMs?: number | null;
}) {
  const style = getWorkZoVoiceStyle(input.recruiterId, input.recruiterState);
  if (typeof input.apiPauseMs === "number" && Number.isFinite(input.apiPauseMs)) {
    return clamp(input.apiPauseMs, 350, 1900);
  }

  const words = String(input.text || "").split(/\s+/).filter(Boolean).length;
  const state = String(input.recruiterState || "").toLowerCase();
  const pressure = state.includes("skeptical") || state.includes("pressuring") || state.includes("losing");

  const base = input.isOpening ? 420 : input.isFollowUp ? 720 : 620;
  const wordFactor = clamp(words * 12, 0, 360);
  const pressureFactor = pressure ? 260 : 0;
  return clamp(base + wordFactor + pressureFactor, style.minPauseMs, style.maxPauseMs);
}

function hasNaturalLead(text: string) {
  return /^(okay|right|got it|understood|of course|good|interesting|i see|thanks|thank you|let me|that makes sense|fair enough)\b/i.test(text.trim());
}

function shouldAvoidExtraFiller(text: string) {
  const clean = text.trim();
  if (!clean) return true;
  if (clean.length < 45) return true;
  if (hasNaturalLead(clean)) return true;
  if (/^(hi|hello|good morning|good afternoon|good evening)\b/i.test(clean)) return true;
  return false;
}

export function humanizeRecruiterSpokenText(
  text: string,
  input: {
    recruiterId?: WorkZoVoiceRecruiterId;
    recruiterState?: WorkZoVoiceRecruiterState;
    isOpening?: boolean;
    allowFiller?: boolean;
  } = {},
) {
  let clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return clean;

  // Remove doubled acknowledgements that make the recruiter sound machine-generated.
  clean = clean
    .replace(/\b(Okay, thanks\.)\s+\1/gi, "$1")
    .replace(/\b(That makes sense\.)\s+\1/gi, "$1")
    .replace(/\b(Good to hear\.)\s+\1/gi, "$1")
    .replace(/\b(I understand\.)\s+\1/gi, "$1")
    .replace(/\s+/g, " ")
    .trim();

  const style = getWorkZoVoiceStyle(input.recruiterId, input.recruiterState);
  const canAddFiller = input.allowFiller !== false && !input.isOpening && !shouldAvoidExtraFiller(clean);

  if (canAddFiller) {
    const state = String(input.recruiterState || "").toLowerCase();
    const pressure = state.includes("skeptical") || state.includes("pressuring") || state.includes("losing");
    const filler = pressure ? style.fillerPool[0] : style.fillerPool[Math.min(1, style.fillerPool.length - 1)];
    if (filler && !clean.toLowerCase().startsWith(filler.toLowerCase())) {
      clean = `${filler}. ${clean}`;
    }
  }

  return clean
    .replace(/\.\s+But\b/g, ". But")
    .replace(/\?\s+Can you/g, "? Can you")
    .trim();
}

export function getOpenAiTtsInstructions(input: {
  recruiterId?: WorkZoVoiceRecruiterId;
  recruiterState?: WorkZoVoiceRecruiterState;
  mode?: string;
}) {
  const style = getWorkZoVoiceStyle(input.recruiterId, input.recruiterState);
  return [
    `Speak as a ${style.label}.`,
    style.personalityCue,
    `Pacing: ${style.pacingCue}.`,
    `Emotion: ${style.emotionalCue}.`,
    "Sound like a real interviewer on a video call, not a narrator.",
    "Use natural pauses between thoughts. Do not sound theatrical or salesy.",
    "Keep pronunciation clear for non-native English speakers.",
  ].join(" ");
}

export function getBrowserSpeechRate(input: {
  baseRate: number;
  recruiterId?: WorkZoVoiceRecruiterId;
  recruiterState?: WorkZoVoiceRecruiterState;
}) {
  const style = getWorkZoVoiceStyle(input.recruiterId, input.recruiterState);
  return clamp(input.baseRate + style.rateBias, 0.82, 1.0);
}

export function getBrowserSpeechPitch(input: {
  basePitch: number;
  recruiterId?: WorkZoVoiceRecruiterId;
  recruiterState?: WorkZoVoiceRecruiterState;
}) {
  const style = getWorkZoVoiceStyle(input.recruiterId, input.recruiterState);
  return clamp(input.basePitch + style.pitchBias, 0.86, 1.16);
}
