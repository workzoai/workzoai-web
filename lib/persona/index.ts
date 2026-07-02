/**
 * lib/persona/index.ts
 *
 * v3 ARCHITECTURE — STEP 11 (Persona Isolation)
 *
 * Loads exactly ONE persona per interview via dynamic import. The map below
 * contains only module paths — no prompts. This guarantees no shared prompt
 * ever contains more than one recruiter, which is what caused the historical
 * persona-bleed bugs (Markus key mismatch → Daniel's prompt; the six Premium
 * Pro personas falling through to Daniel).
 *
 * Key resolution mirrors the proven pattern in lib/recruiterVoiceConfig.ts:
 * normalize id/name → canonical key → explicit fallback with a logged warning
 * (never a silent fallthrough).
 */

import { PERSONA_STYLE_CONTRACT, type PersonaStyle } from "./types";

// Canonical key → module loader. Aliases resolved below.
const PERSONA_MODULES: Record<string, () => Promise<{ default: PersonaStyle }>> = {
  friendly_hr: () => import("./sarah"),
  analytical_hiring_manager: () => import("./daniel"),
  startup_recruiter: () => import("./priya"),
  faang_hiring_manager: () => import("./alex"),
  german_corporate: () => import("./markus"),
  startup_founder: () => import("./zoe"),
  consulting_partner: () => import("./james"),
  sales_director: () => import("./noah"),
  product_leader: () => import("./aisha"),
  executive_recruiter: () => import("./victoria"),
  enterprise_recruiter: () => import("./david"),
};

// Alias → canonical key. Built statically so resolution needs no imports.
const ALIAS_TO_KEY: Record<string, string> = {
  // canonical keys map to themselves
  ...Object.fromEntries(Object.keys(PERSONA_MODULES).map((k) => [k, k])),
  // first names / historical variants
  sarah: "friendly_hr",
  daniel: "analytical_hiring_manager",
  priya: "startup_recruiter",
  alex: "faang_hiring_manager",
  alex_chen: "faang_hiring_manager",
  alexchen: "faang_hiring_manager",
  markus: "german_corporate",
  corporate_recruiter: "german_corporate", // historical bug alias — keep mapped forever
  zoe: "startup_founder",
  zoe_park: "startup_founder",
  james: "consulting_partner",
  james_harrington: "consulting_partner",
  noah: "sales_director",
  noah_jones: "sales_director",
  aisha: "product_leader",
  aisha_patel: "product_leader",
  victoria: "executive_recruiter",
  victoria_stern: "executive_recruiter",
  david: "enterprise_recruiter",
  david_kimura: "enterprise_recruiter",
};

export const DEFAULT_PERSONA_KEY = "analytical_hiring_manager";

function normalize(raw?: string | null): string {
  return (raw || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

/**
 * Resolves any personality key, recruiter id, or recruiter name the app has
 * ever sent to a canonical persona key. Checks the personality key first,
 * then the recruiter name (so "Alex Chen" resolves even if the key is junk).
 */
export function resolvePersonaKey(
  recruiterPersonality?: string | null,
  recruiterName?: string | null,
): { key: string; matched: boolean } {
  const byKey = ALIAS_TO_KEY[normalize(recruiterPersonality)];
  if (byKey) return { key: byKey, matched: true };

  // Try the recruiter's display name — first token first ("Alex Chen" → "alex")
  const name = normalize(recruiterName);
  if (name) {
    if (ALIAS_TO_KEY[name]) return { key: ALIAS_TO_KEY[name], matched: true };
    const first = name.split("_")[0];
    if (ALIAS_TO_KEY[first]) return { key: ALIAS_TO_KEY[first], matched: true };
  }

  return { key: DEFAULT_PERSONA_KEY, matched: false };
}

export type LoadedPersona = PersonaStyle & {
  /** Final prompt block for the LLM: style prompt + global style contract. */
  promptBlock: string;
  /** True when resolution fell back to the default — surfaced for telemetry. */
  fallback: boolean;
};

/**
 * Loads the single persona for this interview. Never loads any other
 * persona module. A failed resolution is LOGGED, never silent — the
 * historical failure mode was users silently getting Daniel.
 */
export async function loadPersona(
  recruiterPersonality?: string | null,
  recruiterName?: string | null,
): Promise<LoadedPersona> {
  const { key, matched } = resolvePersonaKey(recruiterPersonality, recruiterName);
  if (!matched) {
    console.warn(
      `[persona] Unresolved persona — personality="${recruiterPersonality}" name="${recruiterName}". ` +
      `Falling back to ${DEFAULT_PERSONA_KEY}. This should never happen for a real recruiter selection.`,
    );
  }
  const mod = await PERSONA_MODULES[key]();
  const persona = mod.default;
  return {
    ...persona,
    fallback: !matched,
    promptBlock:
      `RECRUITER PERSONA — ${persona.name} (${persona.role})\n` +
      `${persona.stylePrompt}\n\n${PERSONA_STYLE_CONTRACT}`,
  };
}
