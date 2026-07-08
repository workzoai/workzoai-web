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

  // Free features (Improve CV, Cover Letter, and every free tool) are public.
  // No plan check, no login gate, they render for everyone on every plan.
  // Hooks above stay unconditional so this early return is safe.
  if (requiredPlan === "free") {
    return <>{children}</>;
  }

  if (planState.loading) {
    return <main className="grid min-h-screen place-items-center bg-canvas text-fg"><div className="flex items-center gap-3 rounded-2xl border border-line bg-fg/[0.04] px-5 py-4 text-sm font-black text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Checking your plan…</div></main>;
  }

  if (!planState.authenticated) {
    return <Locked title={title} description="Please sign in to use this workspace." cta="Sign in" href={`/login?redirect=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/dashboard")}`} />;
  }

  if (!allowed) {
    return <Locked title={title} description={description || `This feature is included in ${required.label}. Upgrade to unlock it.`} cta={`Upgrade to ${required.label}`} href={`/pricing?plan=${requiredPlan}&feature=${feature}`} requiredPlan={requiredPlan} />;
  }

  return (
    <>
      {/* Subtle plan indicator. Free tools stay unlocked on every plan. */}
      <div className="fixed right-4 top-4 z-30 hidden lg:flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
          planState.plan === "free"
            ? "border-success/25 bg-success/10 text-success"
            : "border-brand/25 bg-brand/10 text-brand"
        }`}>
          {planState.plan === "premium_pro" ? <Star className="h-3 w-3" /> : <Crown className="h-3 w-3" />}
          {planState.plan === "premium_pro" ? "Premium Pro" : planState.plan === "premium" ? "Premium" : "Free"}
        </span>
      </div>
      {children}
    </>
  );
}

function Locked({ title, description, cta, href, requiredPlan }: { title: string; description: string; cta: string; href: string; requiredPlan?: string }) {
  const isPro = requiredPlan === "premium_pro";
  return (
    <main className="min-h-screen bg-canvas px-5 py-10 text-fg">
      <section className="mx-auto max-w-2xl rounded-xl border border-line bg-fg/[0.04] p-8 text-center shadow-2xl shadow-black/20">
        <div className={`mx-auto grid h-12 w-12 place-items-center rounded-xl ${isPro ? "bg-brand/15 text-brand" : "bg-brand/15 text-brand"}`}>
          <Lock className="h-5 w-5" />
        </div>
        <p className={`mt-4 text-xs font-black uppercase tracking-[0.22em] ${isPro ? "text-brand" : "text-brand"}`}>
          {isPro ? "Premium Pro workspace" : "Premium workspace"}
        </p>
        <h1 className="mt-2 text-2xl font-black tracking-[-0.03em]">{title}</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">{description}</p>

        {/* Show which plans include this */}
        <div className="mx-auto mt-5 flex justify-center gap-2">
          {!isPro && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-black text-brand">
              <Crown className="h-3 w-3" /> Premium
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-black text-brand">
            <Star className="h-3 w-3" /> Premium Pro
          </span>
        </div>

        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href={href} className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black text-on-brand ${isPro ? "bg-brand hover:bg-brand" : "bg-brand hover:bg-brand"}`}>
            <Sparkles className="h-4 w-4" />{cta}
          </Link>
          <Link href="/dashboard" className="inline-flex items-center justify-center rounded-xl border border-line px-5 py-3 text-sm font-black text-muted hover:bg-fg/[0.06] hover:text-fg">Back to dashboard</Link>
        </div>
      </section>
    </main>
  );
}
