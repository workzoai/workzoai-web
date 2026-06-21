"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { normalizeWorkZoBillingCycle, normalizeWorkZoPlan } from "@/lib/workzoPlanLimits";


type CheckoutState = "loading" | "redirecting" | "login_required" | "error";

function safeRedirectPath(path: string) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/billing/checkout?plan=premium";
  return path;
}

function readPromoCode() {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem("workzo_promo_code");
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { code?: string };
    return typeof parsed.code === "string" ? parsed.code : "";
  } catch {
    return "";
  }
}

function saveAfterLoginCookie(target: string) {
  if (typeof document === "undefined") return;
  document.cookie = `workzo_after_login=${encodeURIComponent(target)}; Max-Age=900; Path=/; SameSite=Lax`;
}

function BillingCheckoutContent() {
  const searchParams = useSearchParams();
  const plan = normalizeWorkZoPlan(searchParams.get("plan") || "premium");
  const billingCycle = normalizeWorkZoBillingCycle(searchParams.get("billing") || searchParams.get("cycle") || "monthly");
  const [state, setState] = useState<CheckoutState>("loading");
  const [message, setMessage] = useState("Preparing secure checkout…");

  const checkoutPath = `/billing/checkout?plan=${plan}&billing=${billingCycle}`;
  const loginRedirect = useMemo(() => {
    if (typeof window === "undefined") return `/login?redirect=${encodeURIComponent(checkoutPath)}&checkout=1&plan=${plan}&billing=${billingCycle}`;
    const target = safeRedirectPath(`${window.location.pathname}${window.location.search || ""}`);
    return `/login?redirect=${encodeURIComponent(target)}&checkout=1&plan=${plan}&billing=${billingCycle}`;
  }, [billingCycle, checkoutPath, plan]);

  useEffect(() => {
    let cancelled = false;

    async function startCheckout() {
      try {
        setState("loading");
        setMessage("Checking your account and preparing Stripe checkout…");

        const promoCode = readPromoCode();
        const response = await fetch("/api/stripe/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan, billingCycle, source: "billing_checkout_page", promoCode }),
        });

        if (cancelled) return;

        if (response.status === 401 || response.status === 403) {
          try {
            window.localStorage.setItem(
              "workzo_pending_checkout",
              JSON.stringify({ plan, billingCycle, source: "billing_checkout_page", next: checkoutPath, promoCode, status: "login_required", createdAt: new Date().toISOString() }),
            );
            saveAfterLoginCookie(checkoutPath);
          } catch {}

          setState("login_required");
          setMessage("Please sign in to continue to secure checkout.");
          window.location.href = loginRedirect;
          return;
        }

        const data = await response.json().catch(() => ({})) as { url?: string; checkoutUrl?: string; sessionUrl?: string; error?: string };
        if (!response.ok) throw new Error(data.error || "Could not create Stripe checkout session.");

        const checkoutUrl = data.url || data.checkoutUrl || data.sessionUrl;
        if (!checkoutUrl) throw new Error("Stripe checkout URL was not returned by the server.");

        setState("redirecting");
        setMessage("Redirecting to Stripe…");
        window.location.href = checkoutUrl;
      } catch (error) {
        if (cancelled) return;
        setState("error");
        setMessage(error instanceof Error ? error.message : "Checkout failed. Please try again.");
      }
    }

    void startCheckout();
    return () => {
      cancelled = true;
    };
  }, [billingCycle, checkoutPath, loginRedirect, plan]);

  return (
    <main className="min-h-screen bg-[#050a12] px-5 py-8 text-white">
      <div className="mx-auto max-w-3xl">
        <Link href="/pricing" className="inline-flex items-center gap-2 text-sm font-black text-slate-300 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to pricing
        </Link>

        <section className="mt-16 rounded-lg border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl shadow-black/20">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-xl bg-blue-500/15 text-blue-200">
            {state === "error" ? <LockKeyhole className="h-8 w-8" /> : <ShieldCheck className="h-8 w-8" />}
          </div>

          <h1 className="mt-6 text-3xl font-black sm:text-4xl">{state === "error" ? "Checkout needs attention" : "Connecting to secure checkout"}</h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-300">{message}</p>

          {state === "loading" || state === "redirecting" ? (
            <div className="mt-8 inline-flex items-center gap-3 rounded-lg border border-white/10 bg-black/20 px-5 py-3 text-sm font-black text-blue-100">
              <Loader2 className="h-4 w-4 animate-spin" />
              Please wait
            </div>
          ) : null}

          {state === "error" ? (
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-blue-500 px-6 py-3 text-sm font-black text-white hover:bg-blue-400">
                Try again
              </button>
              <Link href="/pricing" className="rounded-lg border border-white/10 px-6 py-3 text-sm font-black text-slate-200 hover:bg-white/10">
                Return to pricing
              </Link>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}


export default function BillingCheckoutPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#050a12] px-5 py-8 text-white">
          <div className="mx-auto max-w-3xl">
            <section className="mt-16 rounded-lg border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl shadow-black/20">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-xl bg-blue-500/15 text-blue-200">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
              <h1 className="mt-6 text-3xl font-black sm:text-4xl">Preparing checkout</h1>
              <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-300">
                Please wait while WorkZo AI prepares your secure checkout.
              </p>
            </section>
          </div>
        </main>
      }
    >
      <BillingCheckoutContent />
    </Suspense>
  );
}
