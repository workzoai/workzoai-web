/**
 * workzoVoiceHumanizer.ts
 *
 * Sprint fix: Sarah and Priya voice instructions upgraded for warmth and naturalness.
 * The WBS feedback said "robotic and difficult to understand" — this is the fix.
 *
 * Key changes:
 * - Sarah: genuinely warm, encouraging, conversational — like a supportive mentor
 * - Priya: energetic and direct but still human, not a speed-reader
 * - All personas: slower base rate, micro-pauses, pitch variation, clear enunciation
 * - TTS instructions now explicitly describe the emotional quality, not just style
 */

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
  if (raw.includes("faang") || raw.includes("alex")) return "daniel";
  if (raw.includes("startup_founder") || raw.includes("zoe")) return "priya";
  if (raw.includes("consulting") || raw.includes("james")) return "daniel";
  if (raw.includes("sales_director") || raw.includes("marcus") || raw.includes("noah")) return "markus";
  if (raw.includes("product_leader") || raw.includes("aisha")) return "sarah";
  if (raw.includes("executive_recruiter") || raw.includes("victoria")) return "sarah";
  if (raw.includes("enterprise_recruiter") || raw.includes("david")) return "markus";
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
  const engaged = state.includes("engaged") || state.includes("interested");

  // ── Sarah — warm, encouraging, professional HR recruiter ─────────────────
  // Target sound: like a supportive career coach who genuinely wants you to succeed.
  // NOT: a neutral narrator. NOT: robotic question-machine.
  if (key === "sarah") {
    return {
      label: "friendly HR recruiter",
      personalityCue: pressure
        ? "warm but concerned HR recruiter; still supportive but asking for clarity"
        : engaged
          ? "genuinely enthusiastic HR recruiter; warm, encouraging, leaning in"
          : "warm, professional HR recruiter; caring, genuine, supportive",
      pacingCue: pressure
        ? "slightly firmer but still warm; slower sentences with clear pauses"
        : "gentle and natural; unhurried; small warm pauses after questions",
      emotionalCue: recovery
        ? "relieved and encouraging; 'that's clearer, thank you' energy"
        : pressure
          ? "gently concerned; 'I want to make sure I understand' energy"
          : engaged
            ? "genuinely interested; 'that's really interesting' energy"
            : "calm and encouraging; 'I'm listening and I care' energy",
      fillerPool: pressure
        ? ["I see.", "Let me understand that better.", "Help me with this."]
        : engaged
          ? ["That's helpful.", "Okay, that makes sense.", "Good."]
          : ["I see.", "Okay.", "That's helpful."],
      rateBias: -0.06, // Noticeably slower than default — warmth needs space
      pitchBias: 0.05, // Slightly higher pitch = warmer, more human
      minPauseMs: pressure ? 620 : 480,
      maxPauseMs: pressure ? 1300 : 1050,
    };
  }

  // ── Priya — energetic startup recruiter, still human ─────────────────────
  // Target sound: fast-thinking, direct, but not robotic. Like a smart startup PM.
  if (key === "priya") {
    return {
      label: "startup recruiter",
      personalityCue: pressure
        ? "direct, fast-paced startup recruiter; unconvinced and probing"
        : "warm, energetic startup recruiter; practical, ownership-focused, concise",
      pacingCue: pressure
        ? "faster and more direct; still fair but pushing for specifics"
        : "natural and lively; energetic but not rushed; clear pauses after key questions",
      emotionalCue: recovery
        ? "cautiously encouraging; 'okay that helps' energy"
        : pressure
          ? "curious but unconvinced; 'I need more than that' energy"
          : "engaged and friendly; 'tell me more' energy",
      fillerPool: pressure
        ? ["Right.", "Okay, but.", "Let's be specific."]
        : ["Got it.", "Okay.", "That makes sense."],
      rateBias: 0.01, // Slightly faster than default, but not much
      pitchBias: 0.03,
      minPauseMs: pressure ? 500 : 400,
      maxPauseMs: pressure ? 1100 : 900,
    };
  }

  // ── Markus — structured corporate recruiter ───────────────────────────────
  if (key === "markus") {
    return {
      label: "corporate recruiter",
      personalityCue: "structured, precise corporate interviewer; professional, calm, evidence-driven",
      pacingCue: pressure ? "measured and firmer; waiting for structured answers" : "steady and professional; deliberate pauses",
      emotionalCue: recovery ? "reserved but open; 'that clarifies it' energy" : pressure ? "skeptical and exacting; 'I need precision here' energy" : "neutral and attentive; 'I'm evaluating carefully' energy",
      fillerPool: pressure ? ["Let me be precise.", "I need evidence here."] : ["Understood.", "Good.", "Continue."],
      rateBias: -0.03,
      pitchBias: -0.02,
      minPauseMs: pressure ? 780 : 640,
      maxPauseMs: pressure ? 1500 : 1280,
    };
  }

  // ── Daniel — analytical hiring manager ───────────────────────────────────
  if (key === "daniel") {
    return {
      label: "analytical hiring manager",
      personalityCue: "calm, analytical hiring manager; logical, detail-oriented, evidence-focused",
      pacingCue: pressure ? "slower, probing; waiting after questions" : "thoughtful and measured; deliberate",
      emotionalCue: recovery ? "noticing improvement; 'that's clearer' energy" : pressure ? "checking reasoning carefully; 'let me think about that' energy" : "curious and focused; 'interesting, tell me more' energy",
      fillerPool: pressure ? ["Let's examine that.", "Hold on.", "Walk me through it."] : ["Interesting.", "I see.", "Okay."],
      rateBias: -0.04,
      pitchBias: -0.01,
      minPauseMs: pressure ? 840 : 660,
      maxPauseMs: pressure ? 1580 : 1320,
    };
  }

  // Default to sarah
  return getWorkZoVoiceStyle("sarah", recruiterState);
}

/**
 * getOpenAiTtsInstructions — the instructions sent to gpt-4o-mini-tts.
 *
 * These are the single most important lever for audio quality.
 * More specific = less robotic. Generic = robotic.
 */
export function getOpenAiTtsInstructions(input: {
  recruiterId?: WorkZoVoiceRecruiterId;
  recruiterState?: WorkZoVoiceRecruiterState;
  mode?: string;
}) {
  const key = normalizeRecruiter(input.recruiterId);
  const state = String(input.recruiterState || "neutral").toLowerCase();
  const pressure = state.includes("skeptical") || state.includes("pressuring");
  const engaged = state.includes("engaged") || state.includes("interested");

  // ── Sarah: specific instructions for warm human delivery ─────────────────
  if (key === "sarah") {
    const emotional = pressure
      ? "You sound gently concerned — like a recruiter who cares but needs more clarity. Slightly firmer but still warm."
      : engaged
        ? "You sound genuinely interested and encouraging — like someone who is leaning forward and wants the candidate to succeed."
        : "You sound warm, professional, and genuinely caring — like a senior HR partner who has heard thousands of interviews and still treats each person as an individual.";

    return [
      "You are Sarah, a warm and professional HR recruiter on a video call interview.",
      emotional,
      "Speak at about 80% of your normal pace — slow enough to be clear, natural enough to be human.",
      "Use small, natural pauses after each sentence, especially after questions. Let the silence invite the candidate to think.",
      "Vary your pitch naturally across sentences — start slightly higher, resolve lower at the end. Never monotone.",
      "Pronounce every word clearly but not robotically — especially multi-syllable words like 'experience', 'opportunity', 'specifically'.",
      "Do not rush. Do not sound like a text-to-speech system. Sound like a real person on a video call.",
      "Do not add theatrical emotion or enthusiasm. Warm and professional is the target, not cheerful or salesy.",
    ].join(" ");
  }

  // ── Priya: energetic but human ───────────────────────────────────────────
  if (key === "priya") {
    const emotional = pressure
      ? "You sound direct and unconvinced — like a startup recruiter who needs more than what was just said."
      : "You sound energetic and engaged — like a smart startup PM who is genuinely curious about this person.";

    return [
      "You are Priya, an energetic startup recruiter on a video call interview.",
      emotional,
      "Speak at a natural, lively pace — quicker than a formal interview but not rushed. Think: smart conversation between colleagues.",
      "Use short natural pauses after questions. Let them breathe without dragging.",
      "Vary your pitch to convey genuine interest — a slight rise when asking, a slight drop when making a point.",
      "Sound like a real person, not a transcript being read aloud. Concise and direct.",
      "Do not sound robotic. Do not rush. Keep pronunciation clear especially for non-native speakers.",
    ].join(" ");
  }

  // ── Markus ────────────────────────────────────────────────────────────────
  if (key === "markus") {
    return [
      "You are Markus, a structured corporate recruiter on a video call interview.",
      pressure ? "You sound measured and precise — evaluating carefully." : "You sound professional and calm — steady and deliberate.",
      "Speak at a measured, professional pace — about 85% of normal speed.",
      "Use clear, even pauses between sentences. No rushing. Deliberate pacing.",
      "Pitch should be slightly lower than neutral — authoritative but not cold.",
      "Sound professional and precise. Clear enunciation on technical terms and dates.",
    ].join(" ");
  }

  // ── Daniel ────────────────────────────────────────────────────────────────
  if (key === "daniel") {
    return [
      "You are Daniel, an analytical hiring manager on a video call interview.",
      pressure ? "You sound thoughtful and probing — waiting for the evidence you need." : "You sound calm and curious — analytically interested.",
      "Speak at about 85% of normal pace — thoughtful pauses after questions, not rushed.",
      "Pitch should be neutral to slightly lower — analytical, not cold.",
      "Enunciate clearly. Pause naturally between thoughts.",
      "Sound like a real interviewer who is genuinely thinking about the answer.",
    ].join(" ");
  }

  // Default
  return [
    "You are a professional recruiter on a video call interview.",
    "Speak at 85% of normal pace — clear, warm, and human.",
    "Use natural pauses after questions. Vary pitch slightly — never monotone.",
    "Sound like a real person, not a text-to-speech system. Keep pronunciation clear for non-native English speakers.",
  ].join(" ");
}

export function getBrowserSpeechRate(input: {
  baseRate: number;
  recruiterId?: WorkZoVoiceRecruiterId;
  recruiterState?: WorkZoVoiceRecruiterState;
}) {
  const style = getWorkZoVoiceStyle(input.recruiterId, input.recruiterState);
  return clamp(input.baseRate + style.rateBias, 0.76, 0.98); // Cap max at 0.98 — never sound rushed
}

export function getBrowserSpeechPitch(input: {
  basePitch: number;
  recruiterId?: WorkZoVoiceRecruiterId;
  recruiterState?: WorkZoVoiceRecruiterState;
}) {
  const style = getWorkZoVoiceStyle(input.recruiterId, input.recruiterState);
  return clamp(input.basePitch + style.pitchBias, 0.86, 1.18);
}

export function humanizeRecruiterSpokenText(
  rawText: string,
  options?: {
    recruiterId?: WorkZoVoiceRecruiterId;
    recruiterState?: WorkZoVoiceRecruiterState;
    allowFiller?: boolean;
  },
): string {
  if (!rawText) return rawText;
  let text = rawText.replace(/\s+/g, " ").trim();

  // Strip any candidate-side filler that leaked into recruiter text
  text = text.replace(/\b(um+|uh+|erm)\b/gi, "").replace(/\s{2,}/g, " ").trim();

  // Shorten very long sentences (>50 words in one breath sounds robotic)
  const sentences = text.split(/(?<=[.!?])\s+/);
  if (sentences.length === 1 && text.split(/\s+/).length > 50) {
    // Find a natural comma break and split there
    const commaIdx = text.indexOf(", ", Math.floor(text.length * 0.4));
    if (commaIdx > 0) {
      text = text.slice(0, commaIdx + 1) + " " + text.slice(commaIdx + 2);
    }
  }

  return text;
}
