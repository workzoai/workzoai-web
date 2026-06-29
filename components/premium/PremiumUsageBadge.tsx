"use client";

import { useEffect, useState } from "react";
import { Crown } from "lucide-react";
import { getWorkZoUsageSummary } from "@/lib/workzoUsageTracker";

type UsageSummary = ReturnType<typeof getWorkZoUsageSummary>;

export default function PremiumUsageBadge({ compact = false, label }: { compact?: boolean; label?: string }) {
  const [mounted, setMounted] = useState(false);
  const [summary, setSummary] = useState<UsageSummary | null>(null);

  useEffect(() => {
    setSummary(getWorkZoUsageSummary());
    setMounted(true);
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
