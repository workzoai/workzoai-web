/**
 * workzoRecruiterPersonas.ts
 *
 * Canonical list of recruiter persona keys and which tier they require.
 *
 * Previously this list (and the string-matching normalize logic) was
 * duplicated separately in app/onboarding/page.tsx, api/tavus/route.ts, and
 * api/tavus/conversation/route.ts, with no shared source of truth and no
 * copy of it in the voice interview routes at all — meaning the voice
 * interview API accepted any recruiterPersonality string from the client
 * with no server-side check against the caller's plan. The onboarding UI
 * correctly locks Premium Pro personas, but nothing stopped a direct API
 * call from requesting one anyway.
 *
 * Server/client safe: no "use client", pure functions and data only.
 */

export type RecruiterKey =
  | "friendly_hr"
  | "analytical_hiring_manager"
  | "startup_recruiter"
  | "german_corporate"
  | "faang_hiring_manager"
  | "startup_founder"
  | "consulting_partner"
  | "sales_director"
  | "product_leader"
  | "executive_recruiter"
  | "enterprise_recruiter";

/** Available on Free and Premium. */
export const STANDARD_RECRUITER_KEYS: RecruiterKey[] = [
  "friendly_hr",
  "analytical_hiring_manager",
  "startup_recruiter",
  "german_corporate",
  "faang_hiring_manager",
];

/** Require Premium Pro — matches onboarding's proRecruiters list. */
export const PRO_ONLY_RECRUITER_KEYS: RecruiterKey[] = [
  "startup_founder",
  "consulting_partner",
  "sales_director",
  "product_leader",
  "executive_recruiter",
  "enterprise_recruiter",
];

const DEFAULT_RECRUITER_KEY: RecruiterKey = "analytical_hiring_manager";

/**
 * Maps a free-text persona label/name (however the client happens to send
 * it — key, display name, or "Name · Role" string) to a canonical key.
 * Mirrors the matching logic in onboarding/page.tsx's normalizeRecruiterKey
 * so both sides agree on which persona a given string refers to.
 */
export function normalizeRecruiterKey(value?: unknown): RecruiterKey {
  if (typeof value !== "string") return DEFAULT_RECRUITER_KEY;
  const raw = value.trim().toLowerCase();
  const key = raw.replace(/·/g, " ").replace(/-/g, "_").replace(/\s+/g, "_");

  if (key === "friendly_hr" || raw.includes("sarah")) return "friendly_hr";
  if (key === "analytical_hiring_manager" || raw.includes("daniel")) return "analytical_hiring_manager";
  if (key === "startup_recruiter" || raw.includes("priya")) return "startup_recruiter";
  if (key === "german_corporate" || key === "corporate_recruiter" || raw.includes("markus")) return "german_corporate";
  if (key === "faang_hiring_manager" || raw.includes("faang")) return "faang_hiring_manager";
  if (key === "startup_founder" || (raw.includes("founder") && !raw.includes("startup_recruiter"))) return "startup_founder";
  if (key === "consulting_partner" || raw.includes("harrington")) return "consulting_partner";
  if (key === "sales_director" || raw.includes("marcus webb") || raw.includes("noah jones")) return "sales_director";
  if (key === "product_leader" || raw.includes("aisha")) return "product_leader";
  if (key === "executive_recruiter" || raw.includes("victoria stern")) return "executive_recruiter";
  if (key === "enterprise_recruiter" || raw.includes("kimura")) return "enterprise_recruiter";
  return DEFAULT_RECRUITER_KEY;
}

export function isProOnlyRecruiterKey(key: RecruiterKey): boolean {
  return (PRO_ONLY_RECRUITER_KEYS as string[]).includes(key);
}

/**
 * Given whatever persona string the client sent and whether the caller is
 * on Premium Pro, returns the persona that should actually be used —
 * unchanged if it's allowed, or silently downgraded to the default
 * standard persona if a non-Pro caller requested a Pro-only one.
 *
 * Downgrades rather than rejects: this runs mid-conversation on a live
 * voice interview, so a hard 403 here would break an in-progress session
 * for a legitimate user who somehow got out of sync with the UI's lock
 * state. The onboarding UI already prevents this in the normal flow —
 * this is a defense-in-depth backstop for direct API calls, not the
 * primary gate, so failing soft is the right tradeoff.
 */
export function resolveAllowedRecruiterKey(requested: unknown, isProUser: boolean): {
  key: RecruiterKey;
  downgraded: boolean;
} {
  const key = normalizeRecruiterKey(requested);
  if (isProOnlyRecruiterKey(key) && !isProUser) {
    return { key: DEFAULT_RECRUITER_KEY, downgraded: true };
  }
  return { key, downgraded: false };
}
