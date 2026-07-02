/**
 * lib/closingOrchestrator.ts
 *
 * v3 ARCHITECTURE — STEP 14 (Candidate Questions), STEP 15 (Proper Closing),
 * STEP 16 (Timer Logic)
 *
 * State machine for the end of the interview. The timer reaching 100% never
 * ends anything — it only raises a wrap-up flag. Sequence:
 *
 *   active → wrap_up_requested → candidate_questions → closing_delivered → results
 *
 * The client sends `wrapUpRequested: true` once its progress hits 100%
 * (one-line client change; see route patch). Consistent with the existing
 * decoupling of Vapi sessions from browser engine state, the client must
 * never terminate the Vapi session directly — it waits for
 * `interviewComplete: true` from the API, then navigates to results.
 */

import type { InterviewBlueprint } from "./interviewBlueprintEngine";

export type ClosingPhase =
  | "active"
  | "wrap_up"              // finish current thread, no new competencies
  | "candidate_questions"  // "Do you have any questions for me?"
  | "closing_delivered"    // closing speech sent; next step is results
  | "complete";

export type ClosingState = {
  phase: ClosingPhase;
  wrapUpRequestedAtTurn: number | null;
  candidateQuestionsAskedAtTurn: number | null;
};

export function emptyClosingState(): ClosingState {
  return { phase: "active", wrapUpRequestedAtTurn: null, candidateQuestionsAskedAtTurn: null };
}

/** True when every competency's budget is spent — natural completion. */
export function blueprintExhausted(bp: InterviewBlueprint): boolean {
  return bp.competencies.every((c) => c.status === "explored");
}

/**
 * Advances the closing state machine once per turn.
 * `candidateStillSpeaking` should be true when the latest transcript entry
 * is a partial/continuing utterance — the machine never advances past
 * wrap_up while the candidate is mid-answer (Step 15: never cut them off).
 */
export function advanceClosingState(
  state: ClosingState,
  input: {
    turn: number;
    wrapUpRequested: boolean;        // client timer hit 100%
    blueprintDone: boolean;          // all budgets spent
    candidateStillSpeaking: boolean;
  },
): ClosingState {
  const next = { ...state };

  if (next.phase === "active" && (input.wrapUpRequested || input.blueprintDone)) {
    next.phase = "wrap_up";
    next.wrapUpRequestedAtTurn = input.turn;
  }

  if (next.phase === "wrap_up" && !input.candidateStillSpeaking) {
    // Current thread is finished — move to candidate questions on this turn.
    next.phase = "candidate_questions";
    next.candidateQuestionsAskedAtTurn = input.turn;
  } else if (next.phase === "candidate_questions" && !input.candidateStillSpeaking) {
    // Candidate has asked their questions (or declined) — deliver closing.
    if (input.turn > (next.candidateQuestionsAskedAtTurn ?? input.turn)) {
      next.phase = "closing_delivered";
    }
  }

  return next;
}

/** Directive injected into the prompt for each closing phase. */
export function renderClosingDirective(state: ClosingState): string {
  switch (state.phase) {
    case "wrap_up":
      return [
        "=== CLOSING DIRECTIVE ===",
        "The interview is entering wrap-up. Do NOT open any new competency. Finish the current thread naturally with at most one short follow-up, then transition to: 'Do you have any questions for me?'",
        "If the candidate is still mid-answer, let them finish completely first.",
        "=== END CLOSING DIRECTIVE ===",
      ].join("\n");
    case "candidate_questions":
      return [
        "=== CLOSING DIRECTIVE ===",
        "You are in the CANDIDATE QUESTIONS phase. If you have not yet asked, ask now: 'Do you have any questions for me?'",
        "Answer any question about the role STRICTLY from the Job Description in your context. If the JD does not contain the answer, say so honestly ('That's a detail the hiring team would confirm') — NEVER invent role details, salary, team size, or policies.",
        "Ask no new interview questions.",
        "=== END CLOSING DIRECTIVE ===",
      ].join("\n");
    case "closing_delivered":
      return [
        "=== CLOSING DIRECTIVE ===",
        "DELIVER THE CLOSING NOW, in the interview language, in your persona's voice, covering exactly these beats:",
        "1. Those are all the questions you wanted to cover today.",
        "2. Thank the candidate for their time and thoughtful answers.",
        "3. Explain they will now receive detailed feedback covering communication, technical skills, behaviour, leadership, and overall interview performance.",
        "4. Wish them the very best with their job search.",
        "Do NOT ask anything further. This is your final message.",
        "=== END CLOSING DIRECTIVE ===",
      ].join("\n");
    default:
      return "";
  }
}

/**
 * Deterministic closing fallback (English), used ONLY when the LLM path
 * fails during the closing_delivered phase. Personas' own closing comes
 * from the directive above so it is language- and voice-correct.
 */
export function fallbackClosingSpeech(recruiterName?: string): string {
  return (
    "Those are all the questions I wanted to cover today. Thank you for taking the time to speak with me — " +
    "I appreciate your thoughtful answers. You'll now receive detailed feedback covering communication, " +
    "technical skills, behaviour, leadership, and overall interview performance. " +
    "I wish you the very best with your job search. Take care." +
    (recruiterName ? ` — ${recruiterName}` : "")
  );
}

/** True when the API response should tell the client to generate results. */
export function isInterviewComplete(state: ClosingState): boolean {
  return state.phase === "closing_delivered" || state.phase === "complete";
}
