"use client";

import { X, CheckCircle2, Sparkles } from "lucide-react";
import { getWorkZoPlanUpgradeCopy, WORKZO_PLAN_LIMITS } from "@/lib/workzoPlanLimits";
import { recordWorkZoUpgradeClick } from "@/lib/workzoUsageTracker";

type UpgradeModalProps = {
  open: boolean;
  feature?: string;
  onClose: () => void;
  onUpgrade?: () => void;
};

export default function UpgradeModal({ open, feature = "premium", onClose, onUpgrade }: UpgradeModalProps) {
  if (!open) return null;

  const copy = getWorkZoPlanUpgradeCopy(feature);
  const premium = WORKZO_PLAN_LIMITS.premium;
  const founder = WORKZO_PLAN_LIMITS.founder;

  function handleUpgradeClick() {
    recordWorkZoUpgradeClick();
    if (onUpgrade) {
      onUpgrade();
      return;
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem("workzo_pending_upgrade_interest", JSON.stringify({ feature, createdAt: new Date().toISOString() }));
    }
  }

  return (
    <div className="fixed inset-0 z-[999] grid place-items-center bg-black/75 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#08111f] shadow-2xl">
        <button type="button" onClick={onClose} className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10" aria-label="Close upgrade modal">
          <X className="h-5 w-5" />
        </button>

        <div className="bg-gradient-to-br from-blue-500/20 via-violet-500/10 to-cyan-500/10 px-7 py-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-100">
            <Sparkles className="h-4 w-4" /> WorkZo Premium
          </div>
          <h2 className="mt-5 max-w-xl text-3xl font-black leading-tight text-white">{copy.title}</h2>
          <p className="mt-3 max-w-xl text-base leading-7 text-slate-300">{copy.description}</p>
        </div>

        <div className="grid gap-4 p-7 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-slate-400">Premium</p>
            <p className="mt-3 text-3xl font-black text-white">{premium.priceLabel}</p>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-200">
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />25 interviews/month</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />5 Tavus video interviews/month</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />100 Tavus minutes/month</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />Recruiter memory + evidence requests</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />Trust score + contradiction detection</li>
            </ul>
          </div>

          <div className="rounded-3xl border border-amber-300/20 bg-amber-400/10 p-5">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-amber-200">Founder Plan</p>
            <p className="mt-3 text-3xl font-black text-white">{founder.priceLabel}</p>
            <p className="mt-1 text-sm text-amber-100">First 100 paid users</p>
            <p className="mt-5 rounded-2xl border border-amber-300/20 bg-black/20 p-3 text-sm leading-6 text-amber-50">
              Stripe is not connected yet. This records upgrade interest and can connect to checkout later.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 p-7 sm:flex-row">
          <button type="button" onClick={handleUpgradeClick} className="flex-1 rounded-2xl bg-blue-500 px-5 py-4 text-base font-black text-white transition hover:bg-blue-400">
            I want Premium
          </button>
          <button type="button" onClick={onClose} className="rounded-2xl border border-white/10 px-5 py-4 text-base font-black text-slate-200 transition hover:bg-white/10">
            Continue with free
          </button>
        </div>
      </div>
    </div>
  );
}
