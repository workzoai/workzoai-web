/**
 * lib/interviewEngineV3.ts
 *
 * v3 ARCHITECTURE — COMPOSITION LAYER
 *
 * The single entry point BOTH /api/interview and /api/interview/reply call.
 * One code path for blueprint, ledger, closing state, and persona loading —
 * no split-brain between routes.
 *
 * Pipeline per turn:
 *   1. Restore v3 state from the recruiterMemoryV2 round-trip blob (__v3 key)
 *   2. First turn only: generate the Interview Blueprint (JD-driven)
 *   3. Classify the exchange → spend competency budget (Step 5)
 *   4. Update the Conversation Ledger (Steps 4, 7, 8, 9, 10)
 *   5. Advance the Closing state machine (Steps 14, 15, 16)
 *   6. Load the ONE persona file for this interview (Steps 2, 11, 13)
 *   7. Render everything into one brainContext string for the LLM
 *
 * The LLM call itself stays where it is (decideUnifiedRecruiterResponse) —
 * this module owns everything BEFORE the persona style layer, which is
 * identical for every recruiter by construction.
 */

import {
  generateInterviewBlueprint,
  renderBlueprintForPrompt,
  classifyCompetency,
  spendCompetencyQuestion,
  type InterviewBlueprint,
} from "./interviewBlueprintEngine";
import {
  emptyLedger,
  updateLedger,
  renderLedgerForPrompt,
  extractOpener,
  type ConversationLedger,
} from "./conversationLedger";
import {
  emptyClosingState,
  advanceClosingState,
  renderClosingDirective,
  blueprintExhausted,
  isInterviewComplete,
  type ClosingState,
} from "./closingOrchestrator";
import { loadPersona, type LoadedPersona } from "./persona";

// ── Persisted state (rides inside recruiterMemoryV2.__v3) ───────────────────

export type EngineV3State = {
  blueprint: InterviewBlueprint;
  ledger: ConversationLedger;
  closing: ClosingState;
  lastRecruiterReply: string;
  lastCompetencyId: string | null;
};

const V3_KEY = "__v3";

export function extractV3State(memoryBlob: unknown): EngineV3State | null {
  if (!memoryBlob || typeof memoryBlob !== "object") return null;
  const v3 = (memoryBlob as Record<string, unknown>)[V3_KEY];
  if (!v3 || typeof v3 !== "object") return null;
  const s = v3 as Partial<EngineV3State>;
  if (!s.blueprint || !s.ledger || !s.closing) return null;
  return s as EngineV3State;
}

/** Attach v3 state to the outgoing memory blob (after V2 has produced it). */
export function attachV3State<T extends object>(memoryBlob: T, state: EngineV3State): T {
  (memoryBlob as Record<string, unknown>)[V3_KEY] = state;
  return memoryBlob;
}

// ── Turn processing ──────────────────────────────────────────────────────────

export type EngineV3Input = {
  candidateAnswer: string;
  currentQuestion?: string;
  jobDescription: string;
  cvText: string;
  targetRole: string;
  recruiterPersonality?: string | null;
  recruiterName?: string | null;
  /** Client sets true once its progress/timer reaches 100% (Step 16). */
  wrapUpRequested?: boolean;
  /** Latest transcript entry is a partial/continuing utterance. */
  candidateStillSpeaking?: boolean;
  /** Restored from the incoming recruiterMemoryV2 blob. */
  previousState?: EngineV3State | null;
};

export type EngineV3Result = {
  /** Everything before the persona layer — inject as recruiterBrainContext. */
  brainContext: string;
  /** The persona style block — inject as setup.recruiterPersonality. */
  persona: LoadedPersona;
  /** Updated state — attach to outgoing memory via attachV3State. */
  state: EngineV3State;
  /** When true, the API response must signal results generation to the client. */
  interviewComplete: boolean;
};

export async function runInterviewEngineV3(input: EngineV3Input): Promise<EngineV3Result> {
  // 1–2. Restore or initialise state; blueprint is generated exactly once.
  const prev: EngineV3State =
    input.previousState ?? {
      blueprint: generateInterviewBlueprint({
        jobDescription: input.jobDescription,
        cvText: input.cvText,
        targetRole: input.targetRole,
      }),
      ledger: emptyLedger(),
      closing: emptyClosingState(),
      lastRecruiterReply: "",
      lastCompetencyId: null,
    };

  // 3. Classify the exchange and spend the competency budget (Step 5).
  //    A turn on the same competency as the previous turn is a follow-up
  //    (Step 9 pivot bookkeeping).
  const exchangeText = `${input.currentQuestion || ""}\n${input.candidateAnswer}`;
  const competencyId = classifyCompetency(prev.blueprint, exchangeText);
  const wasFollowup = !!competencyId && competencyId === prev.lastCompetencyId;
  const blueprint = competencyId
    ? spendCompetencyQuestion(prev.blueprint, competencyId)
    : prev.blueprint;

  // 4. Update the ledger (Steps 4, 7, 8, 10).
  const ledger = updateLedger(prev.ledger, {
    candidateAnswer: input.candidateAnswer,
    lastRecruiterReply: prev.lastRecruiterReply,
    currentTopicId: competencyId,
    wasFollowup,
  });

  // 5. Advance the closing state machine (Steps 14, 15, 16).
  const closing = advanceClosingState(prev.closing, {
    turn: ledger.turn,
    wrapUpRequested: !!input.wrapUpRequested,
    blueprintDone: blueprintExhausted(blueprint),
    candidateStillSpeaking: !!input.candidateStillSpeaking,
  });

  // 6. Load the single persona for this interview (Steps 2, 11, 13).
  const persona = await loadPersona(input.recruiterPersonality, input.recruiterName);

  // 7. Compose the shared brain context — identical for every persona.
  const blocks = [
    renderBlueprintForPrompt(blueprint),
    renderLedgerForPrompt(ledger),
    renderClosingDirective(closing),
  ].filter(Boolean);

  return {
    brainContext: blocks.join("\n\n"),
    persona,
    state: {
      blueprint,
      ledger,
      closing,
      lastRecruiterReply: prev.lastRecruiterReply, // updated post-LLM via recordReply
      lastCompetencyId: competencyId ?? prev.lastCompetencyId,
    },
    interviewComplete: isInterviewComplete(closing),
  };
}

/**
 * Call after the LLM reply is finalised so the next turn's ledger can ban
 * this reply's opener (Step 10 transition variety).
 */
export function recordReply(state: EngineV3State, finalReply: string): EngineV3State {
  return { ...state, lastRecruiterReply: finalReply };
}

/** Convenience for logging/analytics (Step 18). */
export function summariseStateForAnalytics(state: EngineV3State) {
  return {
    turn: state.ledger.turn,
    closingPhase: state.closing.phase,
    competencies: state.blueprint.competencies.map((c) => ({
      id: c.id,
      asked: c.askedCount,
      budget: c.questionBudget,
      status: c.status,
    })),
    skillCeilings: state.ledger.skillCeilings.map((s) => `${s.skill}:${s.level}`),
    redFlags: state.ledger.redFlags.map((f) => `${f.id}${f.probed ? ":probed" : ""}`),
    followupsByTopic: state.ledger.followupsByTopic,
  };
}

export { extractOpener };
