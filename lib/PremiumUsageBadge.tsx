"use client";

import { useEffect, useState } from "react";
import { Crown } from "lucide-react";
import { getWorkZoUsageSummary } from "@/lib/workzoUsageTracker";

type UsageSummary = ReturnType<typeof getWorkZoUsageSummary>;

export default function PremiumUsageBadge({ compact = false, label }: { compact?: boolean; label?: string }) {
  const [mounted, setMounted] = useState(false);
  const [summary, setSummary] = useState<UsageSummary | null>(null);

  useEffect(() => {
    // Render instantly from the local counter so the badge doesn't sit in a
    // loading state, then reconcile with the server's count, which is the
    // real source of truth (interview_sessions rows this month). The two
    // can disagree: the local counter increments as soon as an interview
    // starts, before its DB row necessarily exists, so a very short or
    // aborted session can show as "used" here before the server agrees.
    // Everywhere else that shows quota (dashboard, results page CTA)
    // already reads the server value for this reason, this badge was the
    // one place still relying on local-only data.
    const local = getWorkZoUsageSummary();
    setSummary(local);
    setMounted(true);

    let active = true;
    fetch("/api/account/plan", { cache: "no-store", credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data?.usage) return;
        setSummary((prev) => {
          const base = prev || local;
          return {
            ...base,
            interviewsRemaining: Number(data.usage.interviewsRemaining ?? base.interviewsRemaining),
            limits: { ...base.limits, interviewsPerMonth: Number(data.usage.interviewLimit ?? base.limits.interviewsPerMonth) },
          };
        });
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  if (!mounted || !summary) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-line bg-fg/5 px-3 py-2 text-xs font-black text-muted">
        <Crown className="h-4 w-4 text-muted" />
        <span>Plan</span>
        {!compact ? <span className="text-subtle">loading</span> : null}
      </div>
    );
  }

  const isFounderMode = summary.testMode;
  const displayLabel = label || (isFounderMode ? "Founder Test Mode" : summary.limits.label);
  const remaining = isFounderMode ? "Usage limits disabled" : `${summary.interviewsRemaining}/${summary.limits.interviewsPerMonth} interviews left`;

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-line bg-fg/5 px-3 py-2 text-xs font-black text-fg">
      <Crown className={isFounderMode ? "h-4 w-4 text-brand" : "h-4 w-4 text-warning"} />
      <span>{displayLabel}</span>
      {!compact ? <span className="text-muted">{remaining}</span> : null}
    </div>
  );
}
