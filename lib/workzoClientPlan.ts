"use client";

import { useEffect, useState } from "react";
import { normalizeWorkZoPlan, type WorkZoPlanType } from "@/lib/workzoPlanLimits";
import { setWorkZoCurrentPlan, getWorkZoDevPlanOverride } from "@/lib/workzoUsageTracker";

export type WorkZoClientPlanState = {
  loading: boolean;
  authenticated: boolean;
  plan: WorkZoPlanType;
  email: string | null;
  status: string;
  billingCycle: string | null;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};

export async function fetchWorkZoAuthoritativePlan(): Promise<Omit<WorkZoClientPlanState, "loading">> {
  const response = await fetch("/api/account/plan", { cache: "no-store", credentials: "include" });
  if (!response.ok) throw new Error("Could not resolve WorkZo account plan");
  const data = await response.json();
  const dbPlan = normalizeWorkZoPlan(data?.plan || "free");

  // Respect an active dev/test plan override — do not let the real DB plan
  // (which is "free" for unauthenticated dev sessions) silently overwrite
  // a manual override set via /dev-tools.
  const devOverride = getWorkZoDevPlanOverride();
  const plan = devOverride || dbPlan;

  try { setWorkZoCurrentPlan(plan); } catch {}
  try {
    window.localStorage.setItem("workzo_plan", plan);
    window.localStorage.setItem("workzo_plan_type", plan);
  } catch {}
  return {
    authenticated: Boolean(data?.authenticated),
    plan,
    email: data?.email || null,
    status: String(data?.status || "free"),
    billingCycle: data?.billingCycle || null,
    currentPeriodEnd: data?.currentPeriodEnd || null,
    stripeCustomerId: data?.stripeCustomerId || null,
    stripeSubscriptionId: data?.stripeSubscriptionId || null,
  };
}

export function useWorkZoAuthoritativePlan() {
  const [state, setState] = useState<WorkZoClientPlanState>({
    loading: true,
    authenticated: false,
    plan: "free",
    email: null,
    status: "loading",
    billingCycle: null,
    currentPeriodEnd: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
  });

  useEffect(() => {
    let active = true;
    fetchWorkZoAuthoritativePlan()
      .then((resolved) => active && setState({ ...resolved, loading: false }))
      .catch(() => active && setState((current) => ({ ...current, loading: false, authenticated: false, plan: "free", status: "error" })));
    return () => { active = false; };
  }, []);

  return state;
}
