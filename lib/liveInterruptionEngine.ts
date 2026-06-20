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
  // Launch-safety mode: do not interrupt spoken answers.
  // Career-institute feedback showed interruptions and robotic challenges break confidence.
  // We still keep the function for compatibility, but return non-interrupting feedback.
  const text = transcript.toLowerCase();
  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;

  if (duration > 90 && wordCount > 180 && !/\b(result|outcome|impact|resolved|improved|reduced|saved|customer|csat|latency|seconds?|milliseconds?)\b/i.test(text)) {
    return {
      interrupt: false,
      message: "The answer may need structure, but do not interrupt live.",
      severity: "low",
      reason: "Long answer detected; coaching should happen after the candidate finishes.",
    };
  }

  return { interrupt: false };
}
