export type LiveInterruptionResult = {
  interrupt: boolean;
  message?: string;
  severity?: "low" | "medium" | "high";
  reason?: string;
};

export function shouldInterruptLive({
  transcript,
  duration,
}: {
  transcript: string;
  duration: number;
}): LiveInterruptionResult {
  const text = transcript.toLowerCase();
  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;

  if (duration > 60 && !/\d|%|result|impact|outcome|reduced|increased|improved/.test(text)) {
    return {
      interrupt: true,
      message: "Stop there. Start with the result first.",
      severity: "high",
      reason: "Long answer without result or measurable impact.",
    };
  }

  if (wordCount > 140 && !/\b(result|outcome|impact|as a result)\b/i.test(transcript)) {
    return {
      interrupt: true,
      message: "Pause there. You are losing the main point.",
      severity: "medium",
      reason: "Rambling without clear structure.",
    };
  }

  if (/\b(we|team|our team|supported|helped)\b/i.test(transcript) && !/\b(i led|i built|i handled|i owned|i implemented|i drove)\b/i.test(transcript)) {
    return {
      interrupt: true,
      message: "Wait. What exactly was YOUR contribution?",
      severity: "medium",
      reason: "Ownership unclear.",
    };
  }

  if (/\b(improved|increased|reduced|optimized|saved|delivered)\b/i.test(transcript) && !/(\d+%|\d+\s?(days|hours|users|tickets|customers|€|\$)|kpi|sla|nps|csat)/i.test(transcript)) {
    return {
      interrupt: true,
      message: "How exactly did you measure that improvement?",
      severity: "medium",
      reason: "Missing metric after improvement claim.",
    };
  }

  return {
    interrupt: false,
  };
}
