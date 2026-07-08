"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Gift, CheckCircle2, AlertTriangle, Loader2, ArrowRight, Sparkles } from "lucide-react";

type State =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "success"; expiresAt: string; interviewsLimit: number; already: boolean }
  | { kind: "signin" }
  | { kind: "error"; message: string };

function errorMessage(code: string): string {
  switch (code) {
    case "invalid_code": return "This trial link is not valid. Please check the link or ask for a new one.";
    case "offer_inactive": return "This trial link has been turned off. Please ask for a new one.";
    case "email_mismatch": return "This trial is for a different email address. Sign in with the invited account.";
    case "domain_mismatch": return "This trial is for a specific organization. Sign in with your work or school email.";
    case "not_signed_in": return "Please sign in to activate your trial.";
    default: return "Something went wrong activating your trial. Please try again.";
  }
}

export default function RedeemClient() {
  const params = useSearchParams();
  const code = (params.get("code") || "").trim();
  const [state, setState] = useState<State>({ kind: "idle" });

  const redeem = useCallback(async () => {
    if (!code) {
      setState({ kind: "error", message: "No trial code found in this link." });
      return;
    }
    setState({ kind: "working" });
    try {
      const res = await fetch("/api/trial/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401 || data?.error === "not_signed_in") {
        setState({ kind: "signin" });
        return;
      }
      if (!res.ok || data?.ok === false) {
        setState({ kind: "error", message: errorMessage(data?.error || "") });
        return;
      }
      setState({ kind: "success", expiresAt: data.expiresAt, interviewsLimit: data.interviewsLimit, already: !!data.alreadyActive });
    } catch {
      setState({ kind: "error", message: "Network error. Please try again." });
    }
  }, [code]);

  // Auto-attempt once on load so a signed-in partner truly gets "one click"
  // (the click on the emailed link). If signed out, we show a sign-in CTA.
  useEffect(() => {
    if (code) void redeem();
    else setState({ kind: "error", message: "No trial code found in this link." });
  }, [code, redeem]);

  const signInHref = `/login?next=${encodeURIComponent(`/redeem?code=${code}`)}`;
  const expiryLabel = state.kind === "success" ? new Date(state.expiresAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";

  return (
    <main className="min-h-screen bg-canvas text-fg">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_60%_40%_at_50%_-10%,rgba(37,99,235,0.14),transparent_70%)]" />
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-12">
        <div className="rounded-3xl border border-line bg-fg/[0.02] p-7 sm:p-9">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/15 text-brand">
            <Gift className="h-6 w-6" />
          </div>

          <p className="mt-5 text-[11px] font-black uppercase tracking-[0.24em] text-brand">Partner trial</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Your WorkZo AI trial</h1>

          <ul className="mt-5 space-y-2 text-sm">
            <li className="flex items-center gap-2 text-muted"><Sparkles className="h-4 w-4 text-brand" /> 7 full AI interviews</li>
            <li className="flex items-center gap-2 text-muted"><Sparkles className="h-4 w-4 text-brand" /> Full Premium Pro access</li>
            <li className="flex items-center gap-2 text-muted"><Sparkles className="h-4 w-4 text-brand" /> Valid for 14 days</li>
          </ul>

          <div className="mt-7">
            {state.kind === "working" && (
              <div className="flex items-center gap-2 rounded-xl border border-line bg-canvas px-4 py-3 text-sm font-bold text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Activating your trial...
              </div>
            )}

            {state.kind === "success" && (
              <div>
                <div className="flex items-start gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm font-bold text-success">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{state.already ? "Your trial is already active." : "Trial activated!"} You have {state.interviewsLimit} interviews through {expiryLabel}.</span>
                </div>
                <a href="/onboarding" className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-black text-on-brand hover:bg-brand-strong">
                  Set up and start your first interview <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            )}

            {state.kind === "signin" && (
              <div>
                <p className="mb-3 text-sm text-muted">Sign in with your invited account to activate this trial. You will come right back here.</p>
                <a href={signInHref} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-black text-on-brand hover:bg-brand-strong">
                  Sign in to activate <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            )}

            {state.kind === "error" && (
              <div>
                <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-bold text-danger">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{state.message}</span>
                </div>
                <button onClick={() => void redeem()} className="mt-4 w-full rounded-xl border border-line bg-fg/[0.04] px-4 py-3 text-sm font-black text-fg hover:bg-fg/[0.08]">
                  Try again
                </button>
              </div>
            )}
          </div>

          <p className="mt-6 text-xs text-subtle">This trial does not require a card and converts to the free plan when it ends.</p>
        </div>
      </div>
    </main>
  );
}
