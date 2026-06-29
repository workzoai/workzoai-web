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
    <div className="fixed inset-x-0 bottom-0 z-[1000] px-4 pb-4 text-fg sm:px-6">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-xl border border-line bg-canvas/95 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-start">
          <div className="flex gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
              <Cookie className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-brand">Privacy choices</p>
                  <h2 className="mt-1 text-xl font-black">WorkZo AI uses essential storage to run the app.</h2>
                </div>
                <button
                  type="button"
                  onClick={rejectNonEssential}
                  aria-label="Close cookie banner with essential cookies only"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-fg/5 text-muted hover:bg-fg/10 md:hidden"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                Necessary storage keeps your interview setup, usage limits, and privacy choices working. Analytics are optional and help us improve reliability and product quality.
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-muted">
                <Link href="/legal/cookies" className="hover:text-fg">Cookie Policy</Link>
                <Link href="/legal/privacy" className="hover:text-fg">Privacy Policy</Link>
                <Link href="/legal/delete-data" className="hover:text-fg">Delete my data</Link>
              </div>

              {manage ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="flex items-start gap-3 rounded-lg border border-line bg-fg/[0.04] p-4">
                    <input type="checkbox" checked disabled className="mt-1" />
                    <span>
                      <span className="block text-sm font-black text-fg">Necessary</span>
                      <span className="mt-1 block text-xs leading-5 text-muted">Required for login, session safety, interview setup, and privacy preferences.</span>
                    </span>
                  </label>

                  <label className="flex items-start gap-3 rounded-lg border border-line bg-fg/[0.04] p-4">
                    <input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} className="mt-1" />
                    <span>
                      <span className="block text-sm font-black text-fg">Analytics</span>
                      <span className="mt-1 block text-xs leading-5 text-muted">Helps measure usage, errors, and feature quality. Optional.</span>
                    </span>
                  </label>

                  <label className="flex items-start gap-3 rounded-lg border border-line bg-fg/[0.04] p-4 sm:col-span-2">
                    <input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} className="mt-1" />
                    <span>
                      <span className="block text-sm font-black text-fg">Marketing</span>
                      <span className="mt-1 block text-xs leading-5 text-muted">Reserved for future launch attribution. Optional and off unless you allow it.</span>
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
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-black text-on-brand transition hover:bg-brand"
            >
              <ShieldCheck className="h-4 w-4" />
              Accept all
            </button>
            {manage ? (
              <button
                type="button"
                onClick={saveCustom}
                className="rounded-lg border border-line px-5 py-3 text-sm font-black text-fg transition hover:bg-fg/10"
              >
                Save choices
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setManage(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-line px-5 py-3 text-sm font-black text-fg transition hover:bg-fg/10"
              >
                <Settings className="h-4 w-4" />
                Manage
              </button>
            )}
            <button
              type="button"
              onClick={rejectNonEssential}
              className="rounded-lg px-5 py-3 text-sm font-black text-muted transition hover:bg-fg/5 hover:text-fg"
            >
              Essential only
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
