"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Crown, Lock, Loader2, Sparkles, Star } from "lucide-react";
import { canUseWorkZoFeature, getWorkZoFeatureRequiredPlan, getWorkZoPlanLimits, type WorkZoFeatureKey } from "@/lib/workzoPlanLimits";
import { useWorkZoAuthoritativePlan } from "@/lib/workzoClientPlan";

export default function PremiumFeatureGate({ feature, title, description, children }: { feature: WorkZoFeatureKey; title: string; description?: string; children: React.ReactNode }) {
  const requiredPlan = getWorkZoFeatureRequiredPlan(feature);
  const planState = useWorkZoAuthoritativePlan();
  const allowed = useMemo(() => canUseWorkZoFeature(planState.plan, feature), [planState.plan, feature]);
  const required = getWorkZoPlanLimits(requiredPlan);

  if (planState.loading) {
    return <main className="grid min-h-screen place-items-center bg-[#050a12] text-white"><div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-black text-slate-300"><Loader2 className="h-4 w-4 animate-spin" /> Checking your plan…</div></main>;
  }

  if (!planState.authenticated) {
    return <Locked title={title} description="Please sign in to use this workspace." cta="Sign in" href={`/login?redirect=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/dashboard")}`} />;
  }

  if (!allowed) {
    return <Locked title={title} description={description || `This feature is included in ${required.label}. Upgrade to unlock it.`} cta={`Upgrade to ${required.label}`} href={`/pricing?plan=${requiredPlan}&feature=${feature}`} requiredPlan={requiredPlan} />;
  }

  return (
    <>
      {/* Subtle plan indicator — shows paid users which plan they're on */}
      <div className="fixed right-4 top-4 z-30 hidden lg:flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
          planState.plan === "premium_pro"
            ? "border-violet-300/25 bg-violet-500/10 text-violet-200"
            : "border-blue-300/25 bg-blue-500/10 text-blue-200"
        }`}>
          {planState.plan === "premium_pro" ? <Star className="h-3 w-3" /> : <Crown className="h-3 w-3" />}
          {planState.plan === "premium_pro" ? "Premium Pro" : "Premium"}
        </span>
      </div>
      {children}
    </>
  );
}

function Locked({ title, description, cta, href, requiredPlan }: { title: string; description: string; cta: string; href: string; requiredPlan?: string }) {
  const isPro = requiredPlan === "premium_pro";
  return (
    <main className="min-h-screen bg-[#050a12] px-5 py-10 text-white">
      <section className="mx-auto max-w-2xl rounded-xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl shadow-black/20">
        <div className={`mx-auto grid h-12 w-12 place-items-center rounded-xl ${isPro ? "bg-violet-500/15 text-violet-200" : "bg-blue-500/15 text-blue-200"}`}>
          <Lock className="h-5 w-5" />
        </div>
        <p className={`mt-4 text-xs font-black uppercase tracking-[0.22em] ${isPro ? "text-violet-300" : "text-blue-300"}`}>
          {isPro ? "Premium Pro workspace" : "Premium workspace"}
        </p>
        <h1 className="mt-2 text-2xl font-black tracking-[-0.03em]">{title}</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">{description}</p>

        {/* Show which plans include this */}
        <div className="mx-auto mt-5 flex justify-center gap-2">
          {!isPro && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-300/20 bg-blue-500/10 px-3 py-1 text-xs font-black text-blue-200">
              <Crown className="h-3 w-3" /> Premium
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-300/20 bg-violet-500/10 px-3 py-1 text-xs font-black text-violet-200">
            <Star className="h-3 w-3" /> Premium Pro
          </span>
        </div>

        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href={href} className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black text-white ${isPro ? "bg-violet-500 hover:bg-violet-400" : "bg-blue-500 hover:bg-blue-400"}`}>
            <Sparkles className="h-4 w-4" />{cta}
          </Link>
          <Link href="/dashboard" className="inline-flex items-center justify-center rounded-xl border border-white/10 px-5 py-3 text-sm font-black text-slate-300 hover:bg-white/[0.06] hover:text-white">Back to dashboard</Link>
        </div>
      </section>
    </main>
  );
}
