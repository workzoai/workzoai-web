"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Sparkles } from "lucide-react";
import { WORKZO_PLAN_LIMITS } from "@/lib/workzoPlanLimits";

export default function PricingPage() {
  const plans = [
    { name: WORKZO_PLAN_LIMITS.free.label, price: WORKZO_PLAN_LIMITS.free.priceLabel, points: ["3 interviews/month", "Standard voice recruiter", "Basic report"] },
    { name: WORKZO_PLAN_LIMITS.premium.label, price: WORKZO_PLAN_LIMITS.premium.priceLabel, points: ["25 interviews/month", "5 Tavus video interviews/month", "100 Tavus minutes/month", "Recruiter memory", "Evidence requests", "Trust score", "Contradiction detection"] },
    { name: WORKZO_PLAN_LIMITS.founder.label, price: WORKZO_PLAN_LIMITS.founder.priceLabel, points: ["Same Premium limits", "First 100 paid users", "Early adopter price"] },
  ];

  return (
    <main className="min-h-screen bg-[#050a12] px-5 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-300 hover:text-white"><ArrowLeft className="h-4 w-4" />Back</Link>
        <div className="mt-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-100"><Sparkles className="h-4 w-4" />Launch pricing</div>
          <h1 className="mt-5 text-5xl font-black tracking-tight">WorkZo AI pricing</h1>
          <p className="mt-5 text-lg leading-8 text-slate-300">Start free. Upgrade when you want stronger recruiter memory, advanced reports, contradiction detection, and video recruiter credits.</p>
        </div>
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {plans.map((plan) => (
            <section key={plan.name} className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
              <p className="text-sm font-black uppercase tracking-[0.22em] text-slate-400">{plan.name}</p>
              <p className="mt-4 text-4xl font-black">{plan.price}</p>
              <ul className="mt-6 space-y-3 text-sm leading-6 text-slate-200">
                {plan.points.map((point) => <li key={point} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />{point}</li>)}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
