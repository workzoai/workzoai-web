"use client";

// Client helper for the LLM-graded live reaction.
//
// Contract with the interview page: the heuristic reaction from
// getWorkZoLiveReaction() is applied INSTANTLY, then this fetch upgrades it
// a moment later if (and only if) the server returns a graded reaction.
// Returns null on any failure or timeout so the caller never has to handle
// errors — the heuristic reaction simply stays on screen.

import type { WorkZoLiveReaction, WorkZoRecruiterVisualState } from "@/lib/workzoPremiumExperienceEngine";

const VALID_STATES: WorkZoRecruiterVisualState[] = [
  "listening",
  "thinking",
  "skeptical",
  "interested",
  "interrupting",
  "typing_notes",
  "waiting",
  "recovering_connection",
];

export async function fetchWorkZoAiLiveReaction(
  answer: string,
  options: { targetRole?: string; timeoutMs?: number } = {},
): Promise<WorkZoLiveReaction | null> {
  const cleanAnswer = (answer || "").replace(/\s+/g, " ").trim();
  if (cleanAnswer.split(" ").filter(Boolean).length < 6) return null;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 4000);

  try {
    const response = await fetch("/api/live-reaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      signal: controller.signal,
      body: JSON.stringify({
        answer: cleanAnswer.slice(0, 4000),
        targetRole: (options.targetRole || "").slice(0, 120),
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    if (!data?.upgraded || !data?.reaction) return null;

    const reaction = data.reaction as Partial<WorkZoLiveReaction>;
    const text = typeof reaction.text === "string" ? reaction.text.trim() : "";
    if (!text) return null;

    return {
      text,
      visualState: VALID_STATES.includes(reaction.visualState as WorkZoRecruiterVisualState)
        ? (reaction.visualState as WorkZoRecruiterVisualState)
        : "thinking",
      trustDelta: Number.isFinite(Number(reaction.trustDelta))
        ? Math.max(-3, Math.min(3, Math.round(Number(reaction.trustDelta))))
        : 0,
      intensity: reaction.intensity === "soft" || reaction.intensity === "strong" ? reaction.intensity : "medium",
      ...(typeof reaction.noteText === "string" && reaction.noteText.trim()
        ? { noteText: reaction.noteText.trim() }
        : {}),
    };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}
