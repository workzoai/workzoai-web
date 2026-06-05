"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Crown,
  Lock,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import UpgradeModal from "@/components/premium/UpgradeModal";
import FeatureGate from "@/components/gates/FeatureGate";
import PremiumUsageBadge from "@/components/premium/PremiumUsageBadge";
import { getWorkZoPlanLimits } from "@/lib/workzoPlanLimits";
import {
  getWorkZoCurrentPlan,
  recordWorkZoReportViewed,
} from "@/lib/workzoUsageTracker";

type StoredResult = {
  overallScore?: number;
  strengths?: string[];
  improvements?: string[];
  trustScore?: number;
  evidenceQuality?: number;
  contradictionRisk?: number;
  weakAnswers?: Array<{
    question?: string;
    answer?: string;
    reason?: string;
    betterAnswer?: string;
  }>;
  contradictions?: string[];
  evidenceRequests?: string[];
  transcript?: Array<{
    role?: string;
    speaker?: string;
    text?: string;
  }>;
};

function readResultFromStorage(): StoredResult {
  if (typeof window === "undefined") return {};

  const keys = [
    "workzo_latest_result",
    "workzo-interview-result",
    "workzo_interview_result",
    "latestInterviewResult",
    "workzo_results",
  ];

  for (const key of keys) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed as StoredResult;
    } catch {}
  }

  return {};
}

function normalizeList(value: unknown, fallback: string[]) {
  if (Array.isArray(value)) {
    const items = value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
    if (items.length) return items.slice(0, 5);
  }

  return fallback;
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function buildWeakAnswerFallback(result: StoredResult) {
  if (Array.isArray(result.weakAnswers) && result.weakAnswers.length) {
    return result.weakAnswers.slice(0, 3);
  }

  return [
    {
      question: "Tell me about a relevant situation from your experience.",
      answer: "The answer was too general or missing evidence.",
      reason: "Recruiters need a specific situation, personal ownership, and measurable outcome.",
      betterAnswer:
        "In my previous role, I handled a specific support case where the customer had a recurring workflow issue. I diagnosed the root cause, guided the customer through the fix, documented the steps, and reduced repeat follow-ups for the same issue.",
    },
  ];
}

function PremiumLockedCard({ onUnlock }: { onUnlock: () => void }) {
  return (
    <section className="rounded-[2rem] border border-amber-300/20 bg-amber-400/10 p-6">
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-300/20 text-amber-100">
          <Lock className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-amber-200">
            Premium Report Locked
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">
            Unlock recruiter-level feedback
          </h2>
          <p className="mt-3 text-sm leading-6 text-amber-50/90">
            Premium includes trust score, evidence quality, contradiction detection,
            weak answer coaching, and retry weakest answer.
          </p>
          <button
            type="button"
            onClick={onUnlock}
            className="mt-5 rounded-2xl bg-blue-500 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-400"
          >
            Unlock Premium Report
          </button>
        </div>
      </div>
    </section>
  );
}


function FreePreviewGateResults({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [isPremium, setIsPremium] = useState(true);

  useEffect(() => {
    setIsPremium(getWorkZoPlanLimits(getWorkZoCurrentPlan()).advancedReports);
    setMounted(true);
  }, []);

  // Avoid hydration mismatch: server render and first client render must match.
  if (!mounted || isPremium) return <>{children}</>;

  return (
    <div className="relative overflow-hidden rounded-[2rem]">
      <div className="max-h-[620px] overflow-hidden opacity-80">
        {children}
      </div>
      <div className="absolute inset-x-0 bottom-0 grid place-items-center bg-gradient-to-t from-[#050a12] via-[#050a12]/95 to-transparent px-5 pb-8 pt-32">
        <div className="max-w-xl rounded-[2rem] border border-blue-300/20 bg-[#08111f]/95 p-6 text-center shadow-2xl">
          <Lock className="mx-auto h-8 w-8 text-blue-200" />
          <h2 className="mt-4 text-2xl font-black text-white">Log in to see full results</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Free users can see a preview. Premium unlocks the full report, history, progress tracking, exports, and all coaching details.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/login" className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-black text-slate-200 hover:bg-white/10">Log in</Link>
            <Link href="/pricing?intent=upgrade" className="rounded-2xl bg-blue-500 px-5 py-3 text-sm font-black text-white hover:bg-blue-400">Upgrade</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResultsPage() {
  const [upgradeFeature, setUpgradeFeature] = useState("");
  const [result] = useState<StoredResult>(() => readResultFromStorage());

  const [isMounted, setIsMounted] = useState(false);
  const [plan, setPlan] = useState("free");

  useEffect(() => {
    setPlan(getWorkZoCurrentPlan());
    recordWorkZoReportViewed();
    setIsMounted(true);
  }, []);

  const limits = getWorkZoPlanLimits(plan);
  const isPremium = isMounted && limits.advancedReports;

  const overallScore = numberOr(result.overallScore, 72);
  const strengths = normalizeList(result.strengths, [
    "You gave a clear overview of your background.",
    "You connected your experience to the target role.",
    "You showed motivation to improve.",
  ]);
  const improvements = normalizeList(result.improvements, [
    "Add more specific examples.",
    "Use stronger measurable outcomes.",
    "Clarify your personal ownership in each answer.",
  ]);

  const trustScore = numberOr(result.trustScore, 68);
  const evidenceQuality = numberOr(result.evidenceQuality, 62);
  const contradictionRisk = numberOr(result.contradictionRisk, 18);
  const weakAnswers = buildWeakAnswerFallback(result);
  const contradictions = normalizeList(result.contradictions, [
    "No major contradictions detected yet.",
  ]);
  const evidenceRequests = normalizeList(result.evidenceRequests, [
    "Add one metric or proof point to your strongest answer.",
    "Clarify whether each achievement was individual or team-owned.",
    "Support claims with project, customer, or business context.",
  ]);

  function openUpgrade() {
    setUpgradeFeature("advancedReports");
  }

  function retryWeakestAnswer() {
    if (!isPremium) {
      openUpgrade();
      return;
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "workzo_retry_weakest_answer",
        JSON.stringify({
          weakAnswer: weakAnswers[0],
          createdAt: new Date().toISOString(),
        }),
      );
      window.location.href = "/interview?mode=retry-weakest";
    }
  }

  return (
    <main className="min-h-screen bg-[#050a12] px-5 py-6 text-white">
      <FreePreviewGateResults><div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-slate-200 hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Back home
          </Link>

          <div className="flex items-center gap-3">
            <PremiumUsageBadge />
            <Link
              href="/pricing"
              className="rounded-2xl bg-blue-500 px-5 py-3 text-sm font-black text-white hover:bg-blue-400"
            >
              Pricing
            </Link>
          </div>
        </header>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-gradient-to-br from-blue-500/10 via-violet-500/10 to-cyan-500/10 p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-100">
                <Sparkles className="h-4 w-4" />
                Interview Results
              </div>
              <h1 className="mt-5 text-4xl font-black tracking-tight">
                Your recruiter-style feedback report
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
                Free users see the core summary. Premium users unlock deeper recruiter
                trust analysis, contradiction detection, evidence quality, and coaching.
              </p>
            </div>

            <div className="grid h-36 w-36 place-items-center rounded-full bg-violet-950 p-3">
              <div className="grid h-full w-full place-items-center rounded-full border-[10px] border-blue-500">
                <div className="text-center">
                  <p className="text-4xl font-black">{overallScore}</p>
                  <p className="text-sm text-slate-300">/100</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
            <h2 className="flex items-center gap-2 text-2xl font-black">
              <CheckCircle2 className="h-6 w-6 text-emerald-300" />
              Strengths
            </h2>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-200">
              {strengths.map((item) => (
                <li key={item} className="rounded-2xl bg-emerald-500/10 p-4">
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
            <h2 className="flex items-center gap-2 text-2xl font-black">
              <Target className="h-6 w-6 text-blue-300" />
              Improvements
            </h2>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-200">
              {improvements.map((item) => (
                <li key={item} className="rounded-2xl bg-blue-500/10 p-4">
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="mt-6">
          {!isPremium ? (
            <PremiumLockedCard onUnlock={openUpgrade} />
          ) : (
            <div className="grid gap-6">
              <section className="grid gap-5 lg:grid-cols-3">
                <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
                  <ShieldCheck className="h-7 w-7 text-emerald-300" />
                  <p className="mt-4 text-sm font-black uppercase tracking-[0.22em] text-slate-400">
                    Trust Score
                  </p>
                  <p className="mt-2 text-4xl font-black">{trustScore}/100</p>
                </div>

                <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
                  <TrendingUp className="h-7 w-7 text-blue-300" />
                  <p className="mt-4 text-sm font-black uppercase tracking-[0.22em] text-slate-400">
                    Evidence Quality
                  </p>
                  <p className="mt-2 text-4xl font-black">{evidenceQuality}/100</p>
                </div>

                <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
                  <AlertTriangle className="h-7 w-7 text-amber-300" />
                  <p className="mt-4 text-sm font-black uppercase tracking-[0.22em] text-slate-400">
                    Contradiction Risk
                  </p>
                  <p className="mt-2 text-4xl font-black">{contradictionRisk}%</p>
                </div>
              </section>

              <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
                <h2 className="text-2xl font-black">Weak Answer Coaching</h2>
                <div className="mt-5 space-y-4">
                  {weakAnswers.map((item, index) => (
                    <div key={index} className="rounded-3xl border border-white/10 bg-black/20 p-5">
                      <p className="text-sm font-black text-blue-200">
                        {item.question || "Weak answer"}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-slate-300">
                        <strong className="text-white">Why it felt weak:</strong>{" "}
                        {item.reason || "The answer needed stronger evidence and ownership."}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-emerald-100">
                        <strong>Better version:</strong>{" "}
                        {item.betterAnswer || "Use a specific situation, action, and result."}
                      </p>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={retryWeakestAnswer}
                  className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-blue-500 px-5 py-3 text-sm font-black text-white hover:bg-blue-400"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Retry weakest answer
                </button>
              </section>

              <section className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
                  <h2 className="text-2xl font-black">Contradiction Detection</h2>
                  <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-200">
                    {contradictions.map((item) => (
                      <li key={item} className="rounded-2xl bg-amber-500/10 p-4">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
                  <h2 className="text-2xl font-black">Evidence Requests</h2>
                  <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-200">
                    {evidenceRequests.map((item) => (
                      <li key={item} className="rounded-2xl bg-cyan-500/10 p-4">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            </div>
          )}
        </div>
      </div></FreePreviewGateResults>

      <UpgradeModal
        open={Boolean(upgradeFeature)}
        feature={upgradeFeature}
        onClose={() => setUpgradeFeature("")}
        onUpgrade={() => setUpgradeFeature("")}
      />
    </main>
  );
}
