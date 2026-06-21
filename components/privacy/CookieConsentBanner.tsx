"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Cookie, Settings, ShieldCheck, X } from "lucide-react";
import {
  readWorkZoCookieConsent,
  saveWorkZoCookieConsent,
  type WorkZoCookieConsent,
} from "@/lib/workzoPrivacyConsent";

export default function CookieConsentBanner() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [manage, setManage] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const current = readWorkZoCookieConsent();
    setAnalytics(Boolean(current?.analytics));
    setMarketing(Boolean(current?.marketing));
    setOpen(!current);
    setMounted(true);

    function sync(event?: Event) {
      const detail = event instanceof CustomEvent ? (event.detail as WorkZoCookieConsent | undefined) : undefined;
      const next = detail || readWorkZoCookieConsent();
      setAnalytics(Boolean(next?.analytics));
      setMarketing(Boolean(next?.marketing));
      setOpen(!next);
    }

    window.addEventListener("workzo-cookie-consent-updated", sync);
    return () => window.removeEventListener("workzo-cookie-consent-updated", sync);
  }, []);

  if (!mounted || !open) return null;

  function acceptAll() {
    saveWorkZoCookieConsent({ choice: "accepted", analytics: true, marketing: true });
    setOpen(false);
  }

  function rejectNonEssential() {
    saveWorkZoCookieConsent({ choice: "rejected", analytics: false, marketing: false });
    setOpen(false);
  }

  function saveCustom() {
    saveWorkZoCookieConsent({ choice: "custom", analytics, marketing });
    setOpen(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[1000] px-4 pb-4 text-white sm:px-6">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-xl border border-white/10 bg-[#07111f]/95 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-start">
          <div className="flex gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-cyan-400/10 text-cyan-100">
              <Cookie className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-100">Privacy choices</p>
                  <h2 className="mt-1 text-xl font-black">WorkZo AI uses essential storage to run the app.</h2>
                </div>
                <button
                  type="button"
                  onClick={rejectNonEssential}
                  aria-label="Close cookie banner with essential cookies only"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 md:hidden"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Necessary storage keeps your interview setup, usage limits, and privacy choices working. Analytics are optional and help us improve reliability and product quality.
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-slate-400">
                <Link href="/legal/cookies" className="hover:text-white">Cookie Policy</Link>
                <Link href="/legal/privacy" className="hover:text-white">Privacy Policy</Link>
                <Link href="/legal/delete-data" className="hover:text-white">Delete my data</Link>
              </div>

              {manage ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-4">
                    <input type="checkbox" checked disabled className="mt-1" />
                    <span>
                      <span className="block text-sm font-black text-white">Necessary</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-400">Required for login, session safety, interview setup, and privacy preferences.</span>
                    </span>
                  </label>

                  <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-4">
                    <input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} className="mt-1" />
                    <span>
                      <span className="block text-sm font-black text-white">Analytics</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-400">Helps measure usage, errors, and feature quality. Optional.</span>
                    </span>
                  </label>

                  <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-4 sm:col-span-2">
                    <input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} className="mt-1" />
                    <span>
                      <span className="block text-sm font-black text-white">Marketing</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-400">Reserved for future launch attribution. Optional and off unless you allow it.</span>
                    </span>
                  </label>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex min-w-[220px] flex-col gap-2">
            <button
              type="button"
              onClick={acceptAll}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-500 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-400"
            >
              <ShieldCheck className="h-4 w-4" />
              Accept all
            </button>
            {manage ? (
              <button
                type="button"
                onClick={saveCustom}
                className="rounded-lg border border-white/10 px-5 py-3 text-sm font-black text-slate-200 transition hover:bg-white/10"
              >
                Save choices
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setManage(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-5 py-3 text-sm font-black text-slate-200 transition hover:bg-white/10"
              >
                <Settings className="h-4 w-4" />
                Manage
              </button>
            )}
            <button
              type="button"
              onClick={rejectNonEssential}
              className="rounded-lg px-5 py-3 text-sm font-black text-slate-400 transition hover:bg-white/5 hover:text-white"
            >
              Essential only
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
