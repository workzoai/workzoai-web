"use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { ArrowRight, Loader2, LockKeyhole, Mail, Sparkles } from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

type LoginStatus = "idle" | "loading" | "sent" | "error";

function sanitizeRedirect(value: string | null) {
  if (!value) return "/onboarding";
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return "/onboarding";
    return decoded;
  } catch {
    if (!value.startsWith("/") || value.startsWith("//")) return "/onboarding";
    return value;
  }
}

function getSafeOrigin() {
  if (typeof window !== "undefined") return window.location.origin;
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://workzoai.com").replace(/\/$/, "");
}

function LoginContent() {
  const searchParams = useSearchParams();
  const redirect = sanitizeRedirect(
    searchParams.get("redirect") || searchParams.get("next") ||
    (searchParams.get("plan") === "premium" ? "/billing/checkout?plan=premium" : null),
  );
  const error = searchParams.get("error");
  const isPremiumCheckout = redirect.startsWith("/billing/checkout") || searchParams.get("checkout") === "1";

  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<LoginStatus>("idle");
  const [errorMsg, setErrorMsg] = useState(error || "");

  async function signInWithEmail(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    setErrorMsg("");
    const origin = getSafeOrigin();
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(redirect)}`,
        shouldCreateUser: true,
      },
    });
    if (err) {
      setStatus("error");
      setErrorMsg(err.message);
    } else {
      setStatus("sent");
    }
  }

  async function signInWithGoogle() {
    setStatus("loading");
    const origin = getSafeOrigin();
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(redirect)}`,
      },
    });
    if (err) {
      setStatus("error");
      setErrorMsg(err.message);
    }
  }

  if (status === "sent") {
    return (
      <div className="text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-xl bg-success/15 text-success">
          <Mail className="h-8 w-8" />
        </div>
        <h2 className="mt-6 text-3xl font-black">Check your inbox</h2>
        <p className="mt-3 text-base leading-7 text-muted">
          We sent a login link to <span className="font-black text-fg">{email}</span>. Click it to sign in.
        </p>
        <p className="mt-3 text-sm text-subtle">Check your spam folder if you don't see it within a minute.</p>
        <button type="button" onClick={() => setStatus("idle")} className="mt-6 text-sm font-black text-brand hover:text-fg">
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <>
      {isPremiumCheckout && (
        <div className="mb-6 rounded-lg border border-brand/20 bg-brand/10 p-4 text-center">
          <p className="text-sm font-black text-muted">Sign in to continue to Premium checkout</p>
          <p className="mt-1 text-xs text-muted">You'll be redirected back after login</p>
        </div>
      )}

      <div className="text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-brand/15 text-brand">
          <LockKeyhole className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-3xl font-black sm:text-4xl">Sign in to WorkZo AI</h1>
        <p className="mt-3 text-sm leading-6 text-muted">No password needed. We send a magic link to your email.</p>
      </div>

      {errorMsg && (
        <div className="mt-5 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm font-bold text-danger">
          {errorMsg}
        </div>
      )}

      {/* Google */}
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={status === "loading"}
        className="mt-7 flex w-full items-center justify-center gap-3 rounded-lg border border-line bg-fg/[0.06] px-5 py-3.5 text-sm font-black text-fg transition hover:bg-fg/[0.1] disabled:opacity-60"
      >
        {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        )}
        Continue with Google
      </button>

      <div className="relative my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-fg/[0.08]" />
        <span className="text-xs text-subtle">or</span>
        <div className="h-px flex-1 bg-fg/[0.08]" />
      </div>

      {/* Email */}
      <form onSubmit={signInWithEmail} className="space-y-3">
        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-muted">Email address</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            className="w-full rounded-lg border border-line bg-fg/[0.05] px-5 py-3.5 text-sm text-fg placeholder-slate-500 outline-none transition focus:border-brand/60 focus:bg-fg/[0.08]"
          />
        </label>
        <button
          type="submit"
          disabled={status === "loading" || !email.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-5 py-3.5 text-sm font-black text-on-brand shadow-lg shadow-brand/20 transition hover:bg-brand disabled:opacity-60"
        >
          {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Send magic link <ArrowRight className="h-4 w-4" />
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-subtle">
        By signing in you agree to our{" "}
        <Link href="/legal/terms" className="hover:text-fg">Terms</Link>
        {" "}and{" "}
        <Link href="/legal/privacy" className="hover:text-fg">Privacy Policy</Link>.
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-canvas text-fg">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(59,130,246,0.1),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(99,102,241,0.08),transparent_50%)]" />

      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
        {/* Logo */}
        <Link href="/" className="mb-8 flex items-center justify-center gap-3">
          <Image src="/workzo_icon.png" alt="WorkZo AI" width={40} height={40} className="rounded-xl" />
          <span className="text-xl font-black">WorkZo <span className="text-brand">AI</span></span>
        </Link>

        <div className="rounded-lg border border-line bg-fg/[0.04] p-7 shadow-2xl shadow-black/20">
          <Suspense fallback={
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-brand" />
            </div>
          }>
            <LoginContent />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-sm text-subtle">
          No account?{" "}
          <Link href="/onboarding" className="font-black text-muted hover:text-fg">
            Start free — no signup needed
          </Link>
        </p>
      </div>
    </main>
  );
}
