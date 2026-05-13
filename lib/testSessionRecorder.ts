export type InterviewEvent = {
  type:
    | "answer_started"
    | "answer_submitted"
    | "interruption"
    | "trust_drop"
    | "trust_recovery"
    | "wow_moment"
    | "voice_started"
    | "voice_stopped"
    | "results_viewed";
  timestamp: number;
  recruiterMood?: string;
  trust?: number;
  pressure?: number;
  detail?: string;
};

const STORAGE_KEY = "workzo_interview_events";

export function recordInterviewEvent(event: InterviewEvent) {
  if (typeof window === "undefined") return;

  try {
    const existing = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]") as InterviewEvent[];
    const next = [...existing, event].slice(-200);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage issues.
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("WORKZO_INTERVIEW_EVENT", event);
  }
}

export function readInterviewEvents(): InterviewEvent[] {
  if (typeof window === "undefined") return [];

  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]") as InterviewEvent[];
  } catch {
    return [];
  }
}
