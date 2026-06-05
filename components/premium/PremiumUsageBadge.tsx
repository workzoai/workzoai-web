"use client";

import { Crown } from "lucide-react";
import { getWorkZoUsageSummary } from "@/lib/workzoUsageTracker";

export default function PremiumUsageBadge({ compact = false }: { compact?: boolean }) {
  const summary = typeof window !== "undefined" ? getWorkZoUsageSummary() : null;

  if (!summary) return null;

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-slate-200">
      <Crown className="h-4 w-4 text-amber-200" />
      <span>{summary.limits.label}</span>
      {!compact ? (
        <span className="text-slate-400">
          {summary.interviewsRemaining}/{summary.limits.interviewsPerMonth} interviews left
        </span>
      ) : null}
    </div>
  );
}
