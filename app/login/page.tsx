"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");

  async function sendMagicLink() {
    setStatus("");

    try {
      const supabase = createSupabaseBrowserClient();
      const origin = typeof window !== "undefined" ? window.location.origin : "";

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${origin}/dashboard`,
        },
      });

      if (error) throw error;
      setStatus("Magic link sent. Check your email.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not send magic link.");
    }
  }

  async function continueWithGoogle() {
    try {
      const supabase = createSupabaseBrowserClient();
      const origin = typeof window !== "undefined" ? window.location.origin : "";

      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/dashboard`,
        },
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Google sign in failed.");
    }
  }

  return (
    <main className="min-h-screen bg-[#050a12] px-5 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-300 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>

          <Link href="/demo" className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-black text-slate-200 hover:bg-white/10">
            Try Demo
          </Link>
        </header>

        <section className="mt-20 grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-black uppercase tracking-[0.2em] text-cyan-100">
              <ShieldCheck className="h-4 w-4" />
              Optional account
            </div>

            <h1 className="mt-6 max-w-2xl text-6xl font-black tracking-tight">
              Save your interview progress.
            </h1>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
              Sign in to keep your reports, recruiter feedback, and practice history. You can still start a free interview without signing in.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/pricing?intent=interview"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-violet-600 px-7 text-sm font-black text-white shadow-[0_18px_48px_rgba(37,99,235,0.24)]"
              >
                Continue as Guest
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/pricing?intent=interview"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/10 px-7 text-sm font-black text-slate-200 hover:bg-white/10"
              >
                Start Free Interview
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-7">
            <div className="grid h-16 w-16 place-items-center rounded-3xl bg-blue-500/15 text-blue-200">
              <ShieldCheck className="h-8 w-8" />
            </div>

            <h2 className="mt-6 text-3xl font-black">Sign in</h2>
            <p className="mt-3 text-base leading-7 text-slate-300">
              Use a magic link or Google. No password needed.
            </p>

            <button
              type="button"
              onClick={continueWithGoogle}
              className="mt-7 h-12 w-full rounded-2xl border border-white/10 bg-white/5 text-sm font-black text-white hover:bg-white/10"
            >
              Continue with Google
            </button>

            <div className="my-7 flex items-center gap-4">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">or</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <label className="text-sm font-black text-slate-200">
              Email address
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="mt-3 h-14 w-full rounded-2xl border border-white/10 bg-black/20 px-5 text-base text-white outline-none placeholder:text-slate-500 focus:border-blue-300/50"
              />
            </label>

            <button
              type="button"
              onClick={sendMagicLink}
              disabled={!email.trim()}
              className="mt-4 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 px-5 text-sm font-black text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Mail className="h-4 w-4" />
              Send magic link
            </button>

            {status ? (
              <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-200">
                {status}
              </p>
            ) : null}

            <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4">
              <p className="flex items-center gap-2 text-sm font-black text-amber-100">
                <Sparkles className="h-4 w-4" />
                Launch-safe auth
              </p>
              <p className="mt-2 text-sm leading-6 text-amber-50/90">
                Login is optional before the interview. It is mainly for saving history and progress.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
