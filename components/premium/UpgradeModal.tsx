"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, Crown, Loader2, Sparkles, Star, X, XCircle } from "lucide-react";
import { recordWorkZoUpgradeClick } from "@/lib/workzoUsageTracker";
import { getWorkZoPlanUpgradeCopy } from "@/lib/workzoPlanLimits";

type UpgradeModalProps = {
  open: boolean;
  feature?: string;
  onClose: () => void;
  onUpgrade?: () => void;
};

const CHECKOUT_ENDPOINT = "/api/stripe/create-checkout-session";

export default function UpgradeModal({ open, feature = "premium", onClose, onUpgrade }: UpgradeModalProps) {
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  if (!open) return null;

  const copy = getWorkZoPlanUpgradeCopy(feature);
  const isPro = copy.plan === "premium_pro";

  async function handleUpgrade() {
    if (checkoutLoading) return;
    recordWorkZoUpgradeClick();
    setCheckoutError("");

    if (onUpgrade) {
      onUpgrade();
      return;
    }

    setCheckoutLoading(true);
    try {
      const response = await fetch(CHECKOUT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: copy.plan, billing: "monthly", source: "upgrade_modal", feature }),
      });

      if (response.status === 401 || response.status === 403) {
        const redirect = copy.plan === "premium_pro" ? "/pricing?plan=premium_pro" : "/pricing?plan=premium";
        if (typeof window !== "undefined") window.location.href = `/login?redirect=${encodeURIComponent(redirect)}&checkout=1`;
        return;
      }

      const data = await response.json().catch(() => ({})) as { url?: string; error?: string };
      if (!response.ok || !data?.url) throw new Error(data?.error || "Could not start checkout.");
      if (typeof window !== "undefined") window.location.href = data.url;
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Could not start checkout. Try again.");
      setCheckoutLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[999] grid place-items-center bg-black/80 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg overflow-hidden rounded-[2rem] border border-white/10 bg-[#08111f] shadow-2xl shadow-black/40">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-slate-400 transition hover:text-white"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className={`px-7 py-8 ${isPro ? "bg-gradient-to-br from-violet-500/20 via-blue-500/10 to-cyan-500/10" : "bg-gradient-to-br from-blue-500/20 via-violet-500/10 to-cyan-500/10"}`}>
          <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-black uppercase tracking-[0.18em] ${isPro ? "border-violet-300/25 bg-violet-500/10 text-violet-200" : "border-blue-300/25 bg-blue-500/10 text-blue-200"}`}>
            {isPro ? <Star className="h-3.5 w-3.5" /> : <Crown className="h-3.5 w-3.5" />}
            {copy.eyebrow}
          </div>
          <h2 className="mt-4 text-2xl font-black leading-tight text-white">{copy.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">{copy.description}</p>
        </div>

        {/* Features */}
        <div className="px-7 py-5">
          {isPro ? (
            <>
              <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-violet-200">What Premium Pro unlocks</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  "Unlimited voice interviews",
                  "60 Live AI Recruiter minutes/month",
                  "7 premium recruiter personas",
                  "AI Career Coach",
                  "30/60/90 day career roadmaps",
                  "Replay Intelligence",
                  "Priority AI models",
                  "Everything in Premium",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-slate-200">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-violet-300" />
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
                <div className="text-center">
                  <p className="text-xs text-slate-500">Premium</p>
                  <p className="text-base font-black text-slate-300">€19.99<span className="text-xs">/mo</span></p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-500" />
                <div className="text-center">
                  <p className="text-xs text-violet-300 font-black">Premium Pro</p>
                  <p className="text-base font-black text-white">€39.99<span className="text-xs">/mo</span></p>
                </div>
                <p className="ml-auto text-xs leading-5 text-slate-400">2x more features</p>
              </div>
            </>
          ) : (
            <>
              <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-blue-200">What Premium unlocks</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  "50 voice interviews/month",
                  "Full advanced reports",
                  "Improve CV + ATS analysis",
                  "Cover Letter generator",
                  "Job Assist with AI questions",
                  "Career Brain memory",
                  "Performance tracking",
                  "Interview history",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-slate-200">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-300" />
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
                <div className="text-center">
                  <p className="text-xs text-slate-500">Free</p>
                  <p className="text-base font-black text-slate-300">€0</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-500" />
                <div className="text-center">
                  <p className="text-xs text-blue-300 font-black">Premium</p>
                  <p className="text-base font-black text-white">€19.99<span className="text-xs">/mo</span></p>
                </div>
                <p className="ml-auto text-xs leading-5 text-slate-400">Full prep system</p>
              </div>
            </>
          )}
        </div>

        {/* Error */}
        {checkoutError && (
          <div className="mx-7 mb-4 flex items-center gap-2 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm font-bold text-rose-200">
            <XCircle className="h-4 w-4 shrink-0" />
            {checkoutError}
          </div>
        )}

        {/* CTAs */}
        <div className="flex flex-col gap-3 border-t border-white/10 px-7 py-5 sm:flex-row">
          <button
            type="button"
            onClick={handleUpgrade}
            disabled={checkoutLoading}
            className={`flex-1 inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${isPro ? "bg-violet-500 hover:bg-violet-400" : "bg-blue-500 hover:bg-blue-400"}`}
          >
            {checkoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : isPro ? <Star className="h-4 w-4" /> : <Crown className="h-4 w-4" />}
            {checkoutLoading ? "Opening checkout…" : copy.cta}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 px-5 py-3.5 text-sm font-black text-slate-300 transition hover:bg-white/[0.06]"
          >
            Maybe later
          </button>
        </div>

        <p className="px-7 pb-5 text-center text-xs text-slate-500">
          No lock-in · Cancel anytime · Secure checkout via Stripe
        </p>
      </div>
    </div>
  );
}
