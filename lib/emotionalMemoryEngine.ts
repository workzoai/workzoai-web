export type EmotionalSignal =
  | "vague_answer"
  | "missing_metrics"
  | "hesitation"
  | "strong_ownership"
  | "clear_example"
  | "weak_clarity"
  | "confident_answer";

export type EmotionalMemoryItem = {
  signal: EmotionalSignal;
  message: string;
  timestamp: number;
};

export type EmotionalMemoryState = {
  trust: number;
  confidence: number;
  interest: number;
  repeatedWeaknesses: string[];
  memories: EmotionalMemoryItem[];
};

export const initialEmotionalMemory: EmotionalMemoryState = {
  trust: 70,
  confidence: 65,
  interest: 70,
  repeatedWeaknesses: [],
  memories: [],
};

export function analyzeAnswerEmotion(answer: string): EmotionalMemoryItem[] {
  const text = answer.toLowerCase();
  const signals: EmotionalMemoryItem[] = [];
  const now = Date.now();

  if (answer.length < 80) {
    signals.push({
      signal: "weak_clarity",
      message: "The answer was too short and lacked explanation.",
      timestamp: now,
    });
  }

  if (
    text.includes("we worked") ||
    text.includes("helped with") ||
    text.includes("involved in")
  ) {
    signals.push({
      signal: "vague_answer",
      message: "The answer sounds vague and does not clearly show ownership.",
      timestamp: now,
    });
  }

  if (!/\d/.test(answer)) {
    signals.push({
      signal: "missing_metrics",
      message: "The answer does not include measurable impact or numbers.",
      timestamp: now,
    });
  }

  if (
    text.includes("i led") ||
    text.includes("i improved") ||
    text.includes("i solved") ||
    text.includes("i created")
  ) {
    signals.push({
      signal: "strong_ownership",
      message: "The answer shows ownership.",
      timestamp: now,
    });
  }

  return signals;
}

export function updateEmotionalMemory(
  current: EmotionalMemoryState,
  answer: string
): EmotionalMemoryState {
  const newSignals = analyzeAnswerEmotion(answer);

  let trust = current.trust;
  let confidence = current.confidence;
  let interest = current.interest;

  for (const signal of newSignals) {
    if (signal.signal === "vague_answer") trust -= 6;
    if (signal.signal === "missing_metrics") trust -= 5;
    if (signal.signal === "weak_clarity") confidence -= 5;
    if (signal.signal === "strong_ownership") {
      trust += 6;
      interest += 5;
    }
  }

  const allMemories = [...current.memories, ...newSignals];

  const weaknessCounts = allMemories.reduce<Record<string, number>>((acc, item) => {
    if (
      item.signal === "vague_answer" ||
      item.signal === "missing_metrics" ||
      item.signal === "weak_clarity"
    ) {
      acc[item.signal] = (acc[item.signal] || 0) + 1;
    }
    return acc;
  }, {});

  const repeatedWeaknesses = Object.entries(weaknessCounts)
    .filter(([, count]) => count >= 2)
    .map(([signal]) => signal);

  return {
    trust: clamp(trust),
    confidence: clamp(confidence),
    interest: clamp(interest),
    repeatedWeaknesses,
    memories: allMemories.slice(-20),
  };
}

export function getMemoryBasedRecruiterLine(
  memory: EmotionalMemoryState
): string | null {
  if (memory.repeatedWeaknesses.includes("missing_metrics")) {
    return "Earlier you also avoided giving numbers. Can you make this answer more measurable?";
  }

  if (memory.repeatedWeaknesses.includes("vague_answer")) {
    return "I’m noticing a pattern here, your answers are still a bit general. What exactly did you do?";
  }

  if (memory.repeatedWeaknesses.includes("weak_clarity")) {
    return "Your answer feels incomplete. Can you walk me through the situation more clearly?";
  }

  if (memory.trust >= 80) {
    return "That was stronger. I can see clearer ownership in this answer.";
  }

  if (memory.trust <= 45) {
    return "I’m not fully convinced yet. I need a more specific example.";
  }

  return null;
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}