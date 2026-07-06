/**
 * lib/persona/types.ts
 *
 * v3 ARCHITECTURE, STEP 11 (Persona Isolation) + STEP 13 (Personality Layer)
 *
 * A persona is a COMMUNICATION STYLE ONLY. It never generates question content.
 * Content comes exclusively from the Interview Blueprint (JD-driven).
 *
 * Every persona file exports exactly one `PersonaStyle`. The loader
 * (lib/persona/index.ts) dynamically imports ONE file per interview -
 * no shared prompt ever contains more than one recruiter.
 */

export type PersonaPressure = "low" | "medium" | "high";

export type PersonaStyle = {
  /** Canonical key, must match onboarding RecruiterKey exactly. */
  key: string;
  /** Alternate keys/aliases the app has historically sent for this persona. */
  aliases: string[];
  name: string;
  role: string;

  /** Style dials, used by the engine for pacing/interruption decisions. */
  tone: string;          // e.g. "warm", "formal", "blunt"
  pressure: PersonaPressure;
  empathy: PersonaPressure;
  conversationStyle: string; // one-line summary shown in analytics

  /**
   * The style prompt injected into the LLM system prompt.
   * MUST describe HOW this recruiter communicates: phrasing, reactions,
   * praise style, probe style, pacing.
   * MUST NOT contain topic instructions ("ask about SQL", "ask about
   * governance"), the blueprint owns topics. Reaction PATTERNS
   * ("when an answer is vague, say X") are style and belong here.
   */
  stylePrompt: string;
};

/**
 * Appended to every persona's style prompt by the loader. This is the
 * global contract that makes Step 2 (persona = style, JD = content) binding
 * regardless of which persona file is loaded.
 */
export const PERSONA_STYLE_CONTRACT =
  "STYLE LAYER CONTRACT: You control only HOW the interview is conducted, tone, phrasing, " +
  "reaction style, pacing. The INTERVIEW BLUEPRINT in your context determines WHAT is asked: " +
  "which competencies, in which order, with which question budgets. Never introduce topics " +
  "outside the blueprint. Never increase technical depth beyond the candidate's recorded " +
  "skill ceiling. Apply your personality to the blueprint's content, not instead of it.";
