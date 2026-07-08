"use client";

import { useEffect, useState } from "react";
import { Award, TrendingUp } from "lucide-react";
import type { WorkZoAccountScores } from "@/lib/workzoCvScore";

/**
 * All-time interview score summary for the History (dashboard) page.
 *
 * Consumes /api/account/scores, the route computes the signed-in user's
 * average and best overall_score across every scored session. Before this it
 * had no caller anywhere in the app; the History page only showed per-session
 * rows, never a progress trend.
 */
export default function HistoryScoreSummary() {
  const [scores, setScores] = useState<WorkZoAccountScores | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/account/scores", { cache: "no-store", credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: WorkZoAccountScores | null) => {
        if (active) setScores(data);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Nothing to show until the user has at least one scored interview.
  if (!loaded || !scores || scores.scoredInterviewCount === 0) return null;

  const cells = [
    {
      label: "Average score",
      value: scores.avgInterviewScore ?? " - ",
      icon: TrendingUp,
      accent: "text-brand",
    },
    {
      label: "Best score",
      value: scores.bestInterviewScore ?? " - ",
      icon: Award,
      accent: "text-success",
    },
    {
      label: "Interviews scored",
      value: scores.scoredInterviewCount,
      icon: null,
      accent: "text-fg",
    },
  ];

  return (
    <section className="mt-4 rounded-xl border border-line bg-surface/60 p-4 sm:p-5">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Your progress · all time</p>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {cells.map((cell) => {
          const Icon = cell.icon;
          return (
            <div key={cell.label} className="rounded-2xl border border-line bg-canvas-soft p-3">
              <p className="flex items-center gap-1.5 text-xs text-muted">
                {Icon ? <Icon className={`h-3.5 w-3.5 ${cell.accent}`} /> : null}
                {cell.label}
              </p>
              <p className={`mt-1 text-2xl font-black tabular-nums ${cell.accent}`}>{cell.value}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
