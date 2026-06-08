"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, LockKeyhole, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

type LoginStatus = "idle" | "loading" | "sent" | "error";

function sanitizeRedirect(value: string | null) {
  if (!value) return "/dashboard";

  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return "/dashboard";
    return decoded;
  } catch {
    if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
    return value;
  }
}

function writeAfterLoginCookie(redirect: string) {
  if (typeof document === "undefined") return;
  const safe = sanitizeRedirect(redirect);
  document.cookie = `workzo_after_login=${encodeURIComponent(safe)}; Max-Age=900; Path=/; SameSite=Lax`;
}

function LoginContent() {
  const searchParams = useSearchParams();
  const redirect = sanitizeRedirect(
    searchParams.get("redirect") ||
      searchParams.get("next") ||
      (searchParams.get("plan") === "premium" ? "/billing/checkout?plan=premium" : null),
  );
  const error = searchParams.get("error");
  const isPremiumCheckout =
    redirect.startsWith("/billing/checkout") ||
    searchParams.get("checkout") === "1" ||
    searchParams.get("plan") === "premium";

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<LoginStatus>(error ? "error" : "idle");
  const [message, setMessage] = useState(error ? "Login could not be completed. Please try again." : "");

  const callbackUrl = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const url = new URL("/auth/callback", window.location.origin);
    url.searchParams.set("redirect", redirect);
    return url.toString();
  }, [redirect]);

  async function signInWithEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");
    writeAfterLoginCookie(redirect);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: callbackUrl },
      });

      if (error) throw error;
      setStatus("sent");
      setMessage(
        isPremiumCheckout
          ? "Check your email. After login, WorkZo will continue directly to Stripe checkout."
          : "Check your email for the secure login link.",
      );
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not send login link.");
    }
  }

  async function signInWithGoogle() {
    setStatus("loading");
    setMessage("");
    writeAfterLoginCookie(redirect);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl },
      });
      if (error) throw error;
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not start Google login.");
    }
  }

  return (
    <main className="min-h-screen bg-[#050b14] text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(139,92,246,0.16),transparent_34%),linear-gradient(180deg,#050b14_0%,#08111f_55%,#050b14_100%)]" />

      {!isPremiumCheckout ? (
        <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-300 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>

          <Link href="/pricing?intent=interview" className="rounded-xl border border-white/10 px-4 py-2 text-sm font-black text-slate-200 hover:bg-white/[0.06]">
            Try free interview
          </Link>
        </header>
      ) : null}

      <section className={isPremiumCheckout ? "grid min-h-screen place-items-center px-5 py-8" : "mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:px-8 lg:py-20"}>
        {!isPremiumCheckout ? (
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-black uppercase tracking-[0.2em] text-cyan-100">
              <ShieldCheck className="h-4 w-4" />
              Optional account
            </div>
            <h1 className="mt-6 max-w-2xl text-5xl font-black tracking-tight sm:text-6xl">Save your interview progress.</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">Sign in to keep your reports, recruiter feedback, practice history, and Premium access in one account.</p>
          </div>
        ) : null}

        <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-7 shadow-2xl shadow-black/30">
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-blue-500/15 text-blue-200">
            {isPremiumCheckout ? <LockKeyhole className="h-8 w-8" /> : <ShieldCheck className="h-8 w-8" />}
          </div>

          <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-cyan-100">
            <Sparkles className="h-3.5 w-3.5" />
            {isPremiumCheckout ? "Premium checkout" : "Secure sign in"}
          </p>

          <h1 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">
            {isPremiumCheckout ? "Sign in to continue to Stripe." : "Sign in to WorkZo AI"}
          </h1>

          <p className="mt-3 text-base leading-7 text-slate-300">
            {isPremiumCheckout
              ? "After Google login or magic-link login, WorkZo will open Stripe checkout automatically."
              : "Use Google or a magic link. No password needed."}
          </p>

          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={status === "loading"}
            className="mt-7 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-slate-950 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            Continue with Google
          </button>

          <div className="my-7 flex items-center gap-4">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={signInWithEmail}>
            <label className="text-sm font-black text-slate-200">
              Email address
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="mt-3 h-14 w-full rounded-2xl border border-white/10 bg-black/20 px-5 text-base text-white outline-none placeholder:text-slate-500 focus:border-blue-300/50"
              />
            </label>

            <button
              type="submit"
              disabled={!email.trim() || status === "loading"}
              className="mt-4 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 px-5 text-sm font-black text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Send magic link
            </button>
          </form>

          {message ? (
            <p className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-bold ${status === "error" ? "border-rose-300/20 bg-rose-400/10 text-rose-100" : "border-emerald-300/20 bg-emerald-400/10 text-emerald-100"}`}>{message}</p>
          ) : null}

          {isPremiumCheckout ? (
            <Link href="/pricing" className="mt-5 inline-flex items-center gap-2 text-sm font-black text-slate-400 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Back to pricing
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#050b14] text-white" />}>
      <LoginContent />
    </Suspense>
  );
}
