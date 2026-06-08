"use client";

import { useState } from "react";
import { X, CheckCircle2, Sparkles, Gift } from "lucide-react";
import { getWorkZoPlanUpgradeCopy } from "@/lib/workzoPlanLimits";
import { recordWorkZoUpgradeClick } from "@/lib/workzoUsageTracker";

type UpgradeModalProps = {
  open: boolean;
  feature?: string;
  onClose: () => void;
  onUpgrade?: () => void;
};

const PREMIUM_REGULAR_PRICE = "€29.99";
const PREMIUM_OPENING_PRICE = "€14.99";
const CHECKOUT_ENDPOINT = "/api/stripe/create-checkout-session";

export default function UpgradeModal({ open, feature = "premium", onClose, onUpgrade }: UpgradeModalProps) {
  if (!open) return null;

  const copy = getWorkZoPlanUpgradeCopy(feature);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  async function handleUpgradeClick() {
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
        body: JSON.stringify({
          successPath: "/billing/success",
          cancelPath: "/billing/cancel",
          feature,
        }),
      });

      if (response.status === 401) {
        if (typeof window !== "undefined") {
          window.location.href = "/login?redirect=/pricing?plan=premium";
        }
        return;
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.url) {
        throw new Error(data?.error || "Could not start checkout.");
      }

      if (typeof window !== "undefined") {
        window.location.href = data.url;
      }
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Could not start checkout.");
      setCheckoutLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[999] grid place-items-center bg-black/75 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#08111f] shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
          aria-label="Close upgrade modal"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="bg-gradient-to-br from-blue-500/25 via-violet-500/10 to-cyan-500/10 px-7 py-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-100">
            <Sparkles className="h-4 w-4" />
            WorkZo Premium
          </div>

          <h2 className="mt-5 max-w-xl text-3xl font-black leading-tight text-white">
            {copy.title}
          </h2>
          <p className="mt-3 max-w-xl text-base leading-7 text-slate-300">
            {copy.description}
          </p>
        </div>

        <div className="grid gap-4 p-7 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-slate-400">Free</p>
            <p className="mt-3 text-3xl font-black text-white">€0</p>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-200">
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />2 full AI voice interviews</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />CV + JD based interview</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />Results preview</li>
            </ul>
          </div>

          <div className="rounded-3xl border border-blue-300/20 bg-blue-400/10 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-black uppercase tracking-[0.22em] text-blue-200">Premium</p>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-200">
                <Gift className="h-3 w-3" />
                Opening offer
              </span>
            </div>

            <div className="mt-3">
              <p className="text-sm font-bold text-slate-400 line-through decoration-2">
                {PREMIUM_REGULAR_PRICE}/month
              </p>
              <p className="text-3xl font-black text-white">
                {PREMIUM_OPENING_PRICE}<span className="text-base text-white/50">/month</span>
              </p>
              <p className="mt-1 text-xs font-black text-emerald-300">
                Save 50% as an early WorkZo AI user.
              </p>
            </div>

            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-200">
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-200" />25 interviews/month</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-200" />AI voice + video recruiters</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-200" />Full results, trust audit, and history</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-200" />Improve CV, cover letter, job assist</li>
            </ul>
          </div>
        </div>

        {checkoutError ? (
          <div className="mx-7 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm font-bold text-rose-200">
            {checkoutError}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-white/10 p-7 sm:flex-row">
          <button
            type="button"
            onClick={handleUpgradeClick}
            disabled={checkoutLoading}
            className="flex-1 rounded-2xl bg-blue-500 px-5 py-4 text-base font-black text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {checkoutLoading ? "Opening checkout..." : "Get Premium Opening Offer"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 px-5 py-4 text-base font-black text-slate-200 transition hover:bg-white/10"
          >
            Continue with free
          </button>
        </div>
      </div>
    </div>
  );
}
