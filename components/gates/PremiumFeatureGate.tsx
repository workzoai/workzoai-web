"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { getWorkZoPlanLimits } from "@/lib/workzoPlanLimits";
import { getWorkZoCurrentPlan } from "@/lib/workzoUsageTracker";

export default function PremiumFeatureGate({
  featureLabel = "this feature",
  children,
}: {
  featureLabel?: string;
  children: React.ReactNode;
}) {
  const allowed =
    typeof window !== "undefined" &&
    getWorkZoPlanLimits(getWorkZoCurrentPlan()).improveCv;

  if (allowed) return <>{children}</>;

  return (
    <main className="min-h-screen bg-[#050a12] px-5 py-10 text-white">
      <div className="mx-auto grid min-h-[70vh] max-w-2xl place-items-center">
        <div className="rounded-[2rem] border border-blue-300/20 bg-white/[0.04] p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-500/15 text-blue-200">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-3xl font-black">Premium required</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            {featureLabel} is available for Premium users. Start with 2 free interviews,
            then upgrade to unlock all career tools.
          </p>
          <Link
            href="/pricing?intent=upgrade"
            className="mt-6 inline-flex rounded-2xl bg-blue-500 px-6 py-3 text-sm font-black text-white hover:bg-blue-400"
          >
            View plans
          </Link>
        </div>
      </div>
    </main>
  );
}
