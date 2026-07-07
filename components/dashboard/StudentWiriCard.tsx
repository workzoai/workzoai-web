"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, GaugeCircle, Lock, Sparkles, TrendingUp } from "lucide-react";
import { wiriMetricLabel, type WorkZoWiriBreakdown, type WorkZoWiriResult } from "@/lib/workzoWiri";

type Payload = {
  ok: boolean;
  hasData: boolean;
  visibility: string;
  message?: string;
  wiri: WorkZoWiriResult | null;
  history?: { interviews: number; averageInterviewScore: number; bestInterviewScore: number; latestInterviewScore: number };
};

function cx(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join(" ");
}

function scoreColor(score: number) {
  if (score >= 85) return "text-success";
  if (score >= 65) return "text-warning";
  return "text-danger";
}

function barColor(score: number) {
  if (score >= 85) return "bg-success";
  if (score >= 65) return "bg-warning";
  return "bg-danger";
}

export default function StudentWiriCard() {
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/account/wiri", { cache: "no-store", credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => { if (active) setData(json); })
      .catch(() => { if (active) setData(null); });
    return () => { active = false; };
  }, []);

  const weakest = useMemo(() => {
    const breakdown = data?.wiri?.breakdown;
    if (!breakdown) return [];
    return (Object.entries(breakdown) as [keyof WorkZoWiriBreakdown, number][])
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3);
  }, [data]);

  if (!data?.hasData || !data.wiri) {
    return (
      <section className="mt-7 rounded-3xl border border-brand/20 bg-brand/[0.06] p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand">
              <GaugeCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brand">Interview Readiness</p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-fg">Unlock your readiness score</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted">Complete one realistic interview using your CV and the job description. WorkZo will calculate your private readiness score from real interview evidence.</p>
            </div>
          </div>
          <Link href="/onboarding" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-black text-on-brand hover:bg-brand/90">
            Start CV + JD Interview <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-7 overflow-hidden rounded-3xl border border-line bg-surface/80 shadow-sm">
      <div className="grid gap-0 lg:grid-cols-[320px_1fr]">
        <div className="border-b border-line bg-fg/[0.03] p-6 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-brand">
            <Sparkles className="h-4 w-4" /> My Interview Readiness
          </div>
          <div className="mt-5 flex items-end gap-3">
            <div className={cx("text-6xl font-black tracking-tight", scoreColor(data.wiri.score))}>{data.wiri.score}</div>
            <div className="pb-2 text-sm font-black text-muted">/100</div>
          </div>
          <p className="mt-2 text-lg font-black text-fg">{data.wiri.userLabel}</p>
          <p className="mt-1 text-sm text-muted">Powered by WIRI, but kept simple for job seekers.</p>
          <div className="mt-5 flex items-start gap-2 rounded-2xl border border-line bg-canvas/60 p-3 text-xs text-muted">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <span>Your profile is private by default. Employer visibility should only be enabled with explicit opt-in later.</span>
          </div>
        </div>
        <div className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-black text-fg">Next best action</p>
              <p className="mt-1 max-w-2xl text-sm text-muted">{data.wiri.nextAction}</p>
            </div>
            <Link href="/onboarding" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-line bg-fg/[0.04] px-4 py-2.5 text-sm font-black text-fg hover:bg-fg/[0.08]">
              Practice again <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <MiniStat label="Interviews" value={String(data.history?.interviews || 0)} />
            <MiniStat label="Avg interview" value={`${data.history?.averageInterviewScore || 0}`} />
            <MiniStat label="Best score" value={`${data.history?.bestInterviewScore || 0}`} />
          </div>

          <div className="mt-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-black text-fg">
              <TrendingUp className="h-4 w-4 text-brand" /> Focus areas
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {weakest.map(([key, score]) => (
                <div key={key} className="rounded-2xl border border-line bg-canvas/50 p-4">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-bold text-fg">{wiriMetricLabel(key)}</span>
                    <span className={cx("font-black tabular-nums", scoreColor(score))}>{score}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
                    <div className={cx("h-full rounded-full", barColor(score))} style={{ width: `${Math.max(3, Math.min(100, score))}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-line bg-canvas/50 p-4"><p className="text-xl font-black text-fg">{value}</p><p className="mt-0.5 text-xs font-bold uppercase tracking-[0.12em] text-muted">{label}</p></div>;
}
