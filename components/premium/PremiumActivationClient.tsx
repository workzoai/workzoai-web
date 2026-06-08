"use client";

import { useEffect } from "react";
import { setWorkZoCurrentPlan } from "@/lib/workzoUsageTracker";

export default function PremiumActivationClient({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active) return;
    try {
      setWorkZoCurrentPlan("premium");
      window.localStorage.setItem(
        "workzo_subscription",
        JSON.stringify({
          plan: "premium",
          status: "premium",
          source: "stripe",
          updatedAt: new Date().toISOString(),
        }),
      );
      window.localStorage.removeItem("workzo_pending_checkout");
    } catch {}
  }, [active]);

  return null;
}
