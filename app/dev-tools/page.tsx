"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  disableWorkZoFounderTestMode,
  enableWorkZoFounderTestMode,
  getWorkZoCurrentPlan,
  getWorkZoUsageSummary,
  resetWorkZoTestingUsage,
  setWorkZoCurrentPlan,
} from "@/lib/workzoUsageTracker";

type DevSummary = ReturnType<typeof getWorkZoUsageSummary>;

export default function DevToolsPage() {
  const [mounted, setMounted] = useState(false);
  const [summary, setSummary] = useState<DevSummary | null>(null);
  const [plan, setPlan] = useState("free");

  function refresh() {
    if (typeof window === "undefined") return;
    setSummary(getWorkZoUsageSummary());
    setPlan(getWorkZoCurrentPlan());
  }

  useEffect(() => {
    setMounted(true);
    refresh();
  }, []);

  const displayPlan = mounted ? plan : "free";
  const displayTestMode = mounted && summary?.testMode ? "enabled" : "disabled";
  const interviewsUsed = mounted ? summary?.usage.interviewsStarted ?? 0 : 0;
  const interviewsRemaining = mounted ? summary?.interviewsRemaining ?? 0 : 0;
  const videoRemaining = mounted ? summary?.tavusInterviewsRemaining ?? 0 : 0;

  return (
    <main className="min-h-screen bg-[#050a12] px-5 py-8 text-white">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-black text-slate-300 hover:text-white">
          ← Back home
        </Link>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-cyan-200">
            Founder testing
          </p>
          <h1 className="mt-3 text-4xl font-black">WorkZo Test Mode</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Use this page only during development. It lets you test Free, Premium, and repeated interviews without changing public launch limits.
          </p>

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-7 text-slate-200">
            <p>Current plan: <strong>{displayPlan}</strong></p>
            <p>Test mode: <strong>{displayTestMode}</strong></p>
            <p>Interviews used: <strong>{interviewsUsed}</strong></p>
            <p>Interviews remaining: <strong>{interviewsRemaining}</strong></p>
            <p>Video recruiter remaining: <strong>{videoRemaining}</strong></p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                enableWorkZoFounderTestMode();
                refresh();
              }}
              className="rounded-2xl bg-blue-500 px-5 py-4 text-sm font-black text-white hover:bg-blue-400"
            >
              Enable founder test mode
            </button>

            <button
              type="button"
              onClick={() => {
                disableWorkZoFounderTestMode();
                refresh();
              }}
              className="rounded-2xl border border-white/10 px-5 py-4 text-sm font-black text-slate-200 hover:bg-white/10"
            >
              Disable test mode
            </button>

            <button
              type="button"
              onClick={() => {
                resetWorkZoTestingUsage();
                refresh();
              }}
              className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-5 py-4 text-sm font-black text-emerald-100 hover:bg-emerald-400/15"
            >
              Reset usage
            </button>

            <button
              type="button"
              onClick={() => {
                setWorkZoCurrentPlan("free");
                resetWorkZoTestingUsage();
                refresh();
              }}
              className="rounded-2xl border border-white/10 px-5 py-4 text-sm font-black text-slate-200 hover:bg-white/10"
            >
              Test as Free user
            </button>

            <button
              type="button"
              onClick={() => {
                setWorkZoCurrentPlan("premium");
                enableWorkZoFounderTestMode();
                refresh();
              }}
              className="rounded-2xl border border-blue-300/20 bg-blue-400/10 px-5 py-4 text-sm font-black text-blue-100 hover:bg-blue-400/15"
            >
              Test as Premium user
            </button>

            <Link
              href="/pricing?intent=interview&test=1"
              className="rounded-2xl border border-violet-300/20 bg-violet-400/10 px-5 py-4 text-center text-sm font-black text-violet-100 hover:bg-violet-400/15"
            >
              Open pricing test flow
            </Link>

            <Link
              href="/interview?test=1"
              className="rounded-2xl bg-white px-5 py-4 text-center text-sm font-black text-slate-950 hover:bg-slate-200"
            >
              Start interview in test mode
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
