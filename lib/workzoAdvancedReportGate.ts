"use client";

// IMPORTANT: This gate intentionally does NOT read from localStorage.
//
// The previous version called getWorkZoCurrentPlan() which reads localStorage,
// meaning any user could open devtools, set workzo_plan_type = "premium",
// and unlock advanced reports without paying.
//
// The correct pattern is:
//   - Use useWorkZoAdvancedReportGate() in React components.
//   - It calls useWorkZoAuthoritativePlan() which fetches from /api/account/plan
//     (server-resolved, Supabase-backed) on each page load.
//   - For non-React contexts, use the async fetchCanViewAdvancedReport() helper.

import { useWorkZoAuthoritativePlan } from "@/lib/workzoClientPlan";
import { getWorkZoPlanLimits } from "@/lib/workzoPlanLimits";

/**
 * React hook. Returns whether the current authenticated user can view advanced
 * reports, based on the server-resolved plan. Safe to use in any client component.
 *
 * @example
 * const { allowed, loading } = useWorkZoAdvancedReportGate();
 * if (loading) return <Spinner />;
 * if (!allowed) return <UpgradePrompt />;
 */
export function useWorkZoAdvancedReportGate() {
  const planState = useWorkZoAuthoritativePlan();
  return {
    loading: planState.loading,
    allowed: !planState.loading && getWorkZoPlanLimits(planState.plan).advancedReports,
    plan: planState.plan,
  };
}

/**
 * Async helper for non-hook contexts (e.g. route handlers, server actions).
 * Fetches the authoritative plan from /api/account/plan before deciding.
 */
export async function fetchCanViewAdvancedReport(): Promise<boolean> {
  try {
    const response = await fetch("/api/account/plan", { cache: "no-store", credentials: "include" });
    if (!response.ok) return false;
    const data = await response.json();
    return getWorkZoPlanLimits(data?.plan || "free").advancedReports;
  } catch {
    return false;
  }
}

/**
 * The sections that are locked behind the premium gate in the report UI.
 * Used to render locked-section placeholders for free users.
 */
export function getAdvancedReportLockedSections() {
  return [
    "Trust score",
    "Evidence quality",
    "Contradiction detection",
    "Weak answer coaching",
    "Retry weakest answer",
    "PDF export",
  ];
}
