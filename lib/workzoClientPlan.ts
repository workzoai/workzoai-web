"use client";

import { useEffect, useState } from "react";
import {
  normalizeWorkZoPlan,
  type WorkZoPlanType,
} from "@/lib/workzoPlanLimits";
import {
  setWorkZoCurrentPlan,
  getWorkZoDevPlanOverride,
  enableWorkZoFounderTestMode,
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
  usage?: {
    interviewsStarted: number;
    interviewsCompleted: number;
    interviewsRemaining: number;
    interviewLimit: number;
    canStartInterview: boolean;
    voiceMinutesUsed?: number;
    voiceMinutesRemaining?: number;
    voiceMinutesLimit?: number;
    videoMinutesUsed?: number;
    videoMinutesRemaining?: number;
    videoMinutesLimit?: number;
    devUnlimited?: boolean;
  };
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
    usage: undefined,
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
    if (data?.usage?.devUnlimited) {
      try { enableWorkZoFounderTestMode(); } catch {}
    }
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
      usage: data?.usage || undefined,
    };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    return fallbackPlan(name === "AbortError" ? "timeout" : "error");
  } finally {
    window.clearTimeout(timeout);
  }
}

export function useWorkZoAuthoritativePlan() {
  // Always start from the SSR-safe baseline ("free", not authenticated) so
  // the server-rendered HTML and the client's first paint match exactly.
  // Reading localStorage inside the useState initializer used to branch on
  // `typeof window`, that's the textbook hydration-mismatch pattern: the
  // server renders "free" but the client's very first render (before
  // hydration finishes reconciling) already had the cached plan from
  // localStorage, so React saw two different trees for the same render.
  // The cached plan is now applied inside the effect below instead, which
  // only runs after hydration is done, so the UI still updates fast (one
  // extra, imperceptible re-render) without ever mismatching the server HTML.
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

    // Apply the locally cached plan right after mount (post-hydration) so
    // returning users don't see a flash of "free" UI while the network call
    // below resolves.
    const cached = getCachedPlan();
    if (cached !== "free") {
      setState((prev) => ({ ...prev, plan: cached }));
    }

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
