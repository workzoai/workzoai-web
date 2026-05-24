export type CareerMemorySignal =
  | "missing_metrics"
  | "weak_ownership"
  | "vague_answer"
  | "rambling"
  | "strong_metrics"
  | "clear_ownership"
  | "good_recovery"
  | "confidence_drop";

export type CareerMemoryPattern = {
  signal: CareerMemorySignal;
  count: number;
  lastSeenAt: string;
};

export type WorkZoCareerMemory = {
  version: 1;
  updatedAt: string;
  patterns: CareerMemoryPattern[];
  strengths: string[];
  risks: string[];
};

const STORAGE_KEY = "workzo-career-memory-v1";

export const emptyCareerMemory: WorkZoCareerMemory = {
  version: 1,
  updatedAt: "",
  patterns: [],
  strengths: [],
  risks: [],
};

export function readCareerMemory(): WorkZoCareerMemory {
  if (typeof window === "undefined") return emptyCareerMemory;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyCareerMemory;

    const parsed = JSON.parse(raw) as WorkZoCareerMemory;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.patterns)) {
      return emptyCareerMemory;
    }

    return {
      version: 1,
      updatedAt: parsed.updatedAt || "",
      patterns: parsed.patterns || [],
      strengths: parsed.strengths || [],
      risks: parsed.risks || [],
    };
  } catch {
    return emptyCareerMemory;
  }
}

export function saveCareerMemory(memory: WorkZoCareerMemory) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...memory,
        updatedAt: new Date().toISOString(),
      }),
    );
  } catch {
    // Ignore storage failures.
  }
}

export function recordCareerMemorySignal(
  memory: WorkZoCareerMemory,
  signal: CareerMemorySignal,
): WorkZoCareerMemory {
  const now = new Date().toISOString();
  const existing = memory.patterns.find((item) => item.signal === signal);

  const patterns = existing
    ? memory.patterns.map((item) =>
        item.signal === signal
          ? {
              ...item,
              count: item.count + 1,
              lastSeenAt: now,
            }
          : item,
      )
    : [
        ...memory.patterns,
        {
          signal,
          count: 1,
          lastSeenAt: now,
        },
      ];

  return {
    ...memory,
    updatedAt: now,
    patterns: patterns.sort((a, b) => b.count - a.count).slice(0, 12),
    strengths: buildCareerStrengths(patterns),
    risks: buildCareerRisks(patterns),
  };
}

export function inferSignalsFromAnswer(answer: string): CareerMemorySignal[] {
  const text = answer.trim();
  const lower = text.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const signals: CareerMemorySignal[] = [];

  const hasMetric =
    /\d|%|percent|reduced|increased|saved|improved|faster|tickets|users|customers|revenue|cost|hours|days|weeks/i.test(
      text,
    );

  const hasOwnership =
    /\bi\b|\bmy\b|\bpersonally\b|\bled\b|\bowned\b|\bcreated\b|\bhandled\b|\bresolved\b|\bimplemented\b|\bimproved\b/i.test(
      text,
    );

  const vague =
    /\bhelped\b|\bworked on\b|\binvolved in\b|\bthings\b|\bstuff\b|\bvarious\b|\ba lot\b|\bgood\b|\bnice\b/i.test(
      lower,
    );

  const uncertain =
    /\bmaybe\b|\bi think\b|\bprobably\b|\bnot sure\b|\bkind of\b|\bsort of\b/i.test(
      lower,
    );

  if (!hasMetric && words.length > 28) signals.push("missing_metrics");
  if (!hasOwnership && words.length > 20) signals.push("weak_ownership");
  if (vague) signals.push("vague_answer");
  if (words.length > 150) signals.push("rambling");
  if (uncertain) signals.push("confidence_drop");
  if (hasMetric) signals.push("strong_metrics");
  if (hasOwnership) signals.push("clear_ownership");

  return Array.from(new Set(signals));
}

export function updateCareerMemoryFromAnswer(answer: string) {
  const memory = readCareerMemory();
  const signals = inferSignalsFromAnswer(answer);

  const updated = signals.reduce(
    (current, signal) => recordCareerMemorySignal(current, signal),
    memory,
  );

  saveCareerMemory(updated);
  return updated;
}

export function getTopCareerPattern(memory: WorkZoCareerMemory) {
  return memory.patterns[0] || null;
}

export function getCareerMemoryCoachLine(memory: WorkZoCareerMemory) {
  const top = getTopCareerPattern(memory);

  if (!top) {
    return "Work-O-Bot will learn your recurring interview patterns as you practice.";
  }

  switch (top.signal) {
    case "missing_metrics":
      return "You often miss measurable impact. Add numbers, scale, time saved, quality improvement, or rough estimates.";
    case "weak_ownership":
      return "You often understate personal ownership. Say what you personally handled, decided, or delivered.";
    case "vague_answer":
      return "You often use broad wording. Replace vague claims with one concrete example.";
    case "rambling":
      return "Your answers can become long. Keep the core story within 60–90 seconds.";
    case "confidence_drop":
      return "Your wording sometimes sounds unsure. Use firmer language when you know the answer.";
    case "strong_metrics":
      return "Your strongest pattern is measurable impact. Keep using proof and results.";
    case "clear_ownership":
      return "Your ownership signals are improving. Keep making your exact contribution visible.";
    case "good_recovery":
      return "You recover well after pressure. That is a strong interview signal.";
    default:
      return "Work-O-Bot is learning your interview behavior.";
  }
}

function buildCareerStrengths(patterns: CareerMemoryPattern[]) {
  const strengths: string[] = [];

  if (patterns.some((item) => item.signal === "strong_metrics" && item.count >= 2)) {
    strengths.push("You are starting to use measurable impact well.");
  }

  if (patterns.some((item) => item.signal === "clear_ownership" && item.count >= 2)) {
    strengths.push("You show clearer personal ownership in answers.");
  }

  if (patterns.some((item) => item.signal === "good_recovery" && item.count >= 1)) {
    strengths.push("You can recover after recruiter pressure.");
  }

  return strengths.slice(0, 4);
}

function buildCareerRisks(patterns: CareerMemoryPattern[]) {
  const risks: string[] = [];

  if (patterns.some((item) => item.signal === "missing_metrics" && item.count >= 2)) {
    risks.push("Recruiters may doubt impact because metrics are often missing.");
  }

  if (patterns.some((item) => item.signal === "weak_ownership" && item.count >= 2)) {
    risks.push("Your personal contribution may not be clear enough.");
  }

  if (patterns.some((item) => item.signal === "vague_answer" && item.count >= 2)) {
    risks.push("Answers may sound too broad without concrete examples.");
  }

  if (patterns.some((item) => item.signal === "rambling" && item.count >= 1)) {
    risks.push("Long answers may reduce recruiter attention.");
  }

  return risks.slice(0, 4);
}