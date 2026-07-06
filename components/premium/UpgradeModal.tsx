"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, Crown, Loader2, Sparkles, Star, X, XCircle } from "lucide-react";
import { recordWorkZoUpgradeClick } from "@/lib/workzoUsageTracker";
import { getWorkZoPlanUpgradeCopy } from "@/lib/workzoPlanLimits";
import { getWorkZoDisplayPrices } from "@/lib/workzoLocalizedPricing";

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
  const displayPrices = getWorkZoDisplayPrices("monthly");
  const premiumPrice = displayPrices.premium.amount;
  const premiumProPrice = displayPrices.premiumPro.amount;
  const selectedCurrency = isPro ? displayPrices.premiumPro.currency : displayPrices.premium.currency;
  const selectedCountryHint = isPro ? displayPrices.premiumPro.countryHint : displayPrices.premium.countryHint;

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
        body: JSON.stringify({ plan: copy.plan, billing: "monthly", billingCycle: "monthly", source: "upgrade_modal", feature, currency: selectedCurrency, countryHint: selectedCountryHint }),
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
      <div className="relative w-full max-w-lg overflow-hidden rounded-lg border border-line bg-canvas shadow-2xl shadow-black/40">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full border border-line bg-fg/[0.05] text-muted transition hover:text-fg"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className={`px-7 py-8 ${isPro ? "bg-gradient-to-br from-brand/20 via-brand/10 to-brand/10" : "bg-gradient-to-br from-brand/20 via-brand/10 to-brand/10"}`}>
          <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-black uppercase tracking-[0.18em] ${isPro ? "border-brand/25 bg-brand/10 text-brand" : "border-brand/25 bg-brand/10 text-brand"}`}>
            {isPro ? <Star className="h-3.5 w-3.5" /> : <Crown className="h-3.5 w-3.5" />}
            {copy.eyebrow}
          </div>
          <h2 className="mt-4 text-2xl font-black leading-tight text-fg">{copy.title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{copy.description}</p>
        </div>

        {/* Features */}
        <div className="px-7 py-5">
          {isPro ? (
            <>
              <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-brand">What Premium Pro unlocks</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  "240 AI voice minutes/month (top-ups available)",
                  "60 AI Video Interviews minutes/month",
                  "7 premium recruiter personas",
                  "AI Career Coach",
                  "30/60/90 day career roadmaps",
                  "Replay Intelligence",
                  "Priority AI models",
                  "Everything in Premium",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-fg">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-brand" />
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-3 rounded-lg border border-line bg-fg/[0.03] px-4 py-3">
                <div className="text-center">
                  <p className="text-xs text-subtle">Premium</p>
                  <p className="text-base font-black text-muted">{premiumPrice}<span className="text-xs">/mo</span></p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-subtle" />
                <div className="text-center">
                  <p className="text-xs text-brand font-black">Premium Pro</p>
                  <p className="text-base font-black text-fg">{premiumProPrice}<span className="text-xs">/mo</span></p>
                </div>
                <p className="ml-auto text-xs leading-5 text-muted">Video + coaching</p>
              </div>
            </>
          ) : (
            <>
              <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-brand">What Premium unlocks</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  "120 AI voice minutes/month (top-ups available)",
                  "Full advanced reports",
                  "Improve CV + ATS analysis",
                  "Cover Letter generator",
                  "Job Assist with AI questions",
                  "Career Brain memory",
                  "Performance tracking",
                  "Interview history",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-fg">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-brand" />
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-3 rounded-lg border border-line bg-fg/[0.03] px-4 py-3">
                <div className="text-center">
                  <p className="text-xs text-subtle">Free</p>
                  <p className="text-base font-black text-muted">€0</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-subtle" />
                <div className="text-center">
                  <p className="text-xs text-brand font-black">Premium</p>
                  <p className="text-base font-black text-fg">{premiumPrice}<span className="text-xs">/mo</span></p>
                </div>
                <p className="ml-auto text-xs leading-5 text-muted">Full prep system</p>
              </div>
            </>
          )}
        </div>

        {/* Error */}
        {checkoutError && (
          <div className="mx-7 mb-4 flex items-center gap-2 rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm font-bold text-danger">
            <XCircle className="h-4 w-4 shrink-0" />
            {checkoutError}
          </div>
        )}

        {/* CTAs */}
        <div className="flex flex-col gap-3 border-t border-line px-7 py-5 sm:flex-row">
          <button
            type="button"
            onClick={handleUpgrade}
            disabled={checkoutLoading}
            className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3.5 text-sm font-black text-on-brand transition disabled:cursor-not-allowed disabled:opacity-60 ${isPro ? "bg-brand hover:bg-brand" : "bg-brand hover:bg-brand"}`}
          >
            {checkoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : isPro ? <Star className="h-4 w-4" /> : <Crown className="h-4 w-4" />}
            {checkoutLoading ? "Opening checkout…" : copy.cta}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line px-5 py-3.5 text-sm font-black text-muted transition hover:bg-fg/[0.06]"
          >
            Maybe later
          </button>
        </div>

        <p className="px-7 pb-5 text-center text-xs text-subtle">
          No lock-in · Cancel anytime · Secure checkout via Stripe
        </p>
      </div>
    </div>
  );
}
