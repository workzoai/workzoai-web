"use client";

import { useEffect, useState } from "react";
import {
  normalizeWorkZoPlan,
  type WorkZoPlanType,
} from "@/lib/workzoPlanLimits";
import {
  setWorkZoCurrentPlan,
  getWorkZoDevPlanOverride,
} from "@/lib/workzoUsageTracker";

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

type WorkZoPlanPayload = Omit<WorkZoClientPlanState, "loading">;

const PLAN_TIMEOUT_MS = 4500;

function getCachedPlan(): WorkZoPlanType {
  if (typeof window === "undefined") return "free";
  const devOverride = getWorkZoDevPlanOverride();
  if (devOverride) return devOverride;
  try {
    return normalizeWorkZoPlan(
      window.localStorage.getItem("workzo_plan") ||
        window.localStorage.getItem("workzo_plan_type") ||
        "free",
    );
  } catch {
    return "free";
  }
}

function rememberPlan(plan: WorkZoPlanType) {
  try {
    setWorkZoCurrentPlan(plan);
  } catch {}
  try {
    window.localStorage.setItem("workzo_plan", plan);
    window.localStorage.setItem("workzo_plan_type", plan);
  } catch {}
}

function fallbackPlan(
  status: "timeout" | "network_error" | "error" = "error",
): WorkZoPlanPayload {
  const plan = getCachedPlan();
  rememberPlan(plan);
  return {
    authenticated: false,
    plan,
    email: null,
    status,
    billingCycle: null,
    currentPeriodEnd: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
  };
}

export async function fetchWorkZoAuthoritativePlan(options?: {
  timeoutMs?: number;
}): Promise<WorkZoPlanPayload> {
  const controller = new AbortController();
  const timeoutMs = Math.max(1500, options?.timeoutMs || PLAN_TIMEOUT_MS);
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("/api/account/plan", {
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
    });

    if (!response.ok) {
      return fallbackPlan("network_error");
    }

    const data = await response.json();
    const dbPlan = normalizeWorkZoPlan(data?.plan || "free");

    // Respect active dev/test override so local testing does not get overwritten by DB free plan.
    const devOverride = getWorkZoDevPlanOverride();
    const plan = devOverride || dbPlan;
    rememberPlan(plan);

    return {
      authenticated: Boolean(data?.authenticated),
      plan,
      email: data?.email || null,
      status: String(
        data?.status || (data?.authenticated ? plan : "unauthenticated"),
      ),
      billingCycle: data?.billingCycle || null,
      currentPeriodEnd: data?.currentPeriodEnd || null,
      stripeCustomerId: data?.stripeCustomerId || null,
      stripeSubscriptionId: data?.stripeSubscriptionId || null,
    };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    return fallbackPlan(name === "AbortError" ? "timeout" : "error");
  } finally {
    window.clearTimeout(timeout);
  }
}

export function useWorkZoAuthoritativePlan() {
  const [state, setState] = useState<WorkZoClientPlanState>(() => ({
    loading: true,
    authenticated: false,
    plan: getCachedPlan(),
    email: null,
    status: "loading",
    billingCycle: null,
    currentPeriodEnd: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
  }));

  useEffect(() => {
    let active = true;

    fetchWorkZoAuthoritativePlan()
      .then((resolved) => {
        if (active) setState({ ...resolved, loading: false });
      })
      .catch(() => {
        if (active) setState({ ...fallbackPlan("error"), loading: false });
      });

    return () => {
      active = false;
    };
  }, []);

  return state;
}
