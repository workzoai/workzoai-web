"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Lock, Loader2, Sparkles } from "lucide-react";
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
    return <Locked title={title} description={description || `This feature is included in ${required.label}. Upgrade to unlock it.`} cta={`Upgrade to ${required.label}`} href={`/pricing?plan=${requiredPlan}&feature=${feature}`} />;
  }

  return <>{children}</>;
}

function Locked({ title, description, cta, href }: { title: string; description: string; cta: string; href: string }) {
  return (
    <main className="min-h-screen bg-[#050a12] px-5 py-10 text-white">
      <section className="mx-auto max-w-2xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl shadow-black/20">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet-500/15 text-violet-200"><Lock className="h-6 w-6" /></div>
        <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-violet-200">Premium workspace</p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.03em]">{title}</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">{description}</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href={href} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-500 px-5 py-3 text-sm font-black text-white hover:bg-violet-400"><Sparkles className="h-4 w-4" />{cta}</Link>
          <Link href="/dashboard" className="inline-flex items-center justify-center rounded-2xl border border-white/10 px-5 py-3 text-sm font-black text-slate-300 hover:bg-white/[0.06] hover:text-white">Back to dashboard</Link>
        </div>
      </section>
    </main>
  );
}
