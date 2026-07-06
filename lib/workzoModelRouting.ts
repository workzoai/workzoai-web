/**
 * workzoModelRouting.ts
 *
 * Single source of truth for "Priority AI processing", the Premium Pro
 * pricing claim. Pro users get the priority model; everyone else gets the
 * standard model. Both are env-configurable so model upgrades never require
 * a code change:
 *
 *   OPENAI_INTERVIEW_MODEL     , standard interview brain (default gpt-4o)
 *   OPENAI_INTERVIEW_MODEL_PRO , Premium Pro interview brain
 *                                  (falls back to standard if unset)
 *   OPENROUTER_MODEL           , standard OpenRouter model (existing)
 *   OPENROUTER_MODEL_PRO       , Premium Pro OpenRouter model
 *
 * IMPORTANT: if OPENAI_INTERVIEW_MODEL_PRO is not set in Vercel, Pro users
 * silently get the same model as everyone else and the pricing claim is
 * hollow again. Set it (e.g. to a larger / faster-tier model) as part of
 * deploying this change.
 *
 * Pro users additionally get priority via the higher per-minute rate limit
 * in /api/interview/reply (60/min vs 30/min), that half of "priority
 * processing" already existed.
 */

const PRO_PLAN = "premium_pro";

function isProPlan(plan?: string | null): boolean {
  return String(plan || "").toLowerCase().trim() === PRO_PLAN;
}

/** Model for the OpenAI-backed interview brain (unifiedRecruiterIntelligence, vapi-llm). */
export function resolveWorkZoInterviewModel(plan?: string | null): string {
  const standard = process.env.OPENAI_INTERVIEW_MODEL || "gpt-4o";
  if (isProPlan(plan)) {
    return process.env.OPENAI_INTERVIEW_MODEL_PRO || standard;
  }
  return standard;
}

/** Model for OpenRouter-backed engines (results analysis, CV parsing, etc.). */
export function resolveWorkZoOpenRouterModel(plan?: string | null): string | undefined {
  if (isProPlan(plan)) {
    return process.env.OPENROUTER_MODEL_PRO || process.env.OPENROUTER_MODEL || undefined;
  }
  // undefined → askOpenRouter falls through to its own env default.
  return undefined;
}
