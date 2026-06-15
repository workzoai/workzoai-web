"use client";

// Interview mode and Tavus usage tracking.
//
// IMPORTANT — two-layer tracking:
//
//   SERVER (source of truth): The `tavus_minutes_used` column in
//   `workzo_subscriptions` is checked by /api/tavus/conversation before
//   creating any session. This cannot be bypassed by the client.
//
//   CLIENT (real-time UI only): localStorage tracks usage in the current
//   session so the UI can show a live countdown without a round-trip.
//   This must never be used as the sole enforcement layer.

export type WorkZoInterviewMode = "standard" | "vapi" | "tavus";

const MODE_KEY = "workzo-interview-mode";
const TAVUS_USAGE_KEY = "workzo-tavus-usage-minutes";

// Matches the spec: Premium Pro includes 60 Tavus minutes/month.
// The server enforces this independently. This constant is used for
// client-side UI display (countdown badge, fallback messaging) only.
const TAVUS_MINUTES_LIMIT_SPEC = 60;

export function readInterviewMode(): WorkZoInterviewMode {
  if (typeof window === "undefined") return "standard";
  const stored = window.localStorage.getItem(MODE_KEY);
  if (stored === "tavus") return "tavus";
  if (stored === "vapi") return "vapi";
  return "standard";
}

export function saveInterviewMode(mode: WorkZoInterviewMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MODE_KEY, mode);
}

/** Client-side Tavus usage, for UI display only. Not used for enforcement. */
export function getTavusUsageMinutes() {
  if (typeof window === "undefined") return 0;
  const value = Number(window.localStorage.getItem(TAVUS_USAGE_KEY) || 0);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function addTavusUsageMinutes(minutes: number) {
  if (typeof window === "undefined") return 0;
  const next = getTavusUsageMinutes() + Math.max(0, minutes);
  window.localStorage.setItem(TAVUS_USAGE_KEY, String(Math.round(next * 100) / 100));
  return next;
}

export function resetTavusUsageMinutes() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TAVUS_USAGE_KEY);
}

/**
 * The Tavus minute limit for UI display purposes.
 * NEXT_PUBLIC_TAVUS_DEMO_MINUTES can override for demo/testing environments.
 * The actual enforcement limit is always 60 minutes (TAVUS_MINUTES_LIMIT_SPEC),
 * enforced server-side regardless of this value.
 */
export function getTavusLimitMinutes() {
  const raw = process.env.NEXT_PUBLIC_TAVUS_DEMO_MINUTES;
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return TAVUS_MINUTES_LIMIT_SPEC; // was incorrectly 10 — now correctly 60
}

export function getTavusRemainingMinutes() {
  return Math.max(0, getTavusLimitMinutes() - getTavusUsageMinutes());
}

/**
 * Client-side availability check for UI gating.
 * The server will re-enforce the real limit — this is for showing/hiding
 * the Tavus option in the UI before the user tries to start.
 */
export function isTavusAvailable() {
  return getTavusRemainingMinutes() > 0;
}
