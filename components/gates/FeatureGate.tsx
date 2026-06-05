"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { getWorkZoPlanLimits } from "@/lib/workzoPlanLimits";
import { getWorkZoCurrentPlan } from "@/lib/workzoUsageTracker";

type FeatureGateProps = {
  feature: "results" | "dashboard" | "improveCv" | "coverLetter" | "jobAssist" | "history";
  children: React.ReactNode;
  previewHeight?: string;
};

function canUseFeature(feature: FeatureGateProps["feature"]) {
  const limits = getWorkZoPlanLimits(getWorkZoCurrentPlan());

  if (feature === "results") return limits.advancedReports;
  if (feature === "dashboard") return limits.fullHistory;
  if (feature === "improveCv") return limits.improveCv;
  if (feature === "coverLetter") return limits.coverLetter;
  if (feature === "jobAssist") return limits.jobAssist;
  if (feature === "history") return limits.fullHistory;

  return false;
}

export default function FeatureGate({ feature, children, previewHeight = "max-h-[520px]" }: FeatureGateProps) {
  const allowed = typeof window !== "undefined" ? canUseFeature(feature) : false;

  if (allowed) return <>{children}</>;

  return (
    <div className="relative overflow-hidden rounded-[2rem]">
      <div className={`${previewHeight} overflow-hidden opacity-70 blur-[1px]`}>
        {children}
      </div>

      <div className="absolute inset-x-0 bottom-0 grid place-items-center bg-gradient-to-t from-[#050a12] via-[#050a12]/95 to-transparent px-5 pb-8 pt-32">
        <div className="max-w-xl rounded-[2rem] border border-blue-300/20 bg-[#08111f]/95 p-6 text-center shadow-2xl">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/15 text-blue-200">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-2xl font-black text-white">
            Log in to see the full view
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Free users can preview this page. Premium unlocks full results, dashboard insights,
            interview history, progress tracking, Improve CV, cover letters, and job assist tools.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-black text-slate-200 hover:bg-white/10"
            >
              Log in
            </Link>
            <Link
              href="/pricing?intent=upgrade"
              className="rounded-2xl bg-blue-500 px-5 py-3 text-sm font-black text-white hover:bg-blue-400"
            >
              Upgrade
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
