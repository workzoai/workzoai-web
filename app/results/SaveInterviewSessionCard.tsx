"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Cloud, Loader2, LockKeyhole } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function getWorkZoAnalyticsSessionId() {
  if (typeof window === "undefined") return "server-session";

  try {
    const existing = window.localStorage.getItem("workzo_analytics_session_id");
    if (existing) return existing;

    const next = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem("workzo_analytics_session_id", next);
    return next;
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function trackWorkZoAnalyticsEvent(event: string, payload: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;

  fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: getWorkZoAnalyticsSessionId(),
      event,
      path: window.location.pathname,
      origin: window.location.origin,
      host: window.location.hostname,
      isLocal: window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1",
      environment: process.env.NODE_ENV,
      ...payload,
    }),
  }).catch(() => {});
}

type SaveState = "checking" | "signed-out" | "saving" | "saved" | "error";

type Props = {
  result: {
    id?: string;
    candidateName?: string;
    targetRole?: string;
    targetCompany?: string;
    recruiterName?: string;
    recruiterTitle?: string;
    companyStyle?: string;
    durationSeconds?: number;
    score?: { overall?: number; trust?: number } | null;
    transcript?: unknown[];
    verdict?: unknown;
    summary?: unknown;
    weakestMoment?: unknown;
  };
};

export default function SaveInterviewSessionCard({ result }: Props) {
  const [state, setState] = useState<SaveState>("checking");
  const [message, setMessage] = useState("");

  const payload = useMemo(
    () => ({
      localId: result.id,
      candidateName: result.candidateName,
      targetRole: result.targetRole,
      targetCompany: result.targetCompany,
      recruiterName: result.recruiterName,
      recruiterTitle: result.recruiterTitle,
      companyStyle: result.companyStyle,
      durationSeconds: result.durationSeconds,
      overallScore: result.score?.overall ?? null,
      trustScore: result.score?.trust ?? null,
      transcript: result.transcript || [],
      verdict: result.verdict || null,
      summary: result.summary || null,
      weakestMoment: result.weakestMoment || null,
      report: result,
    }),
    [result],
  );

  useEffect(() => {
    let cancelled = false;

    async function saveIfSignedIn() {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (cancelled) return;

        if (!user) {
          setState("signed-out");
          return;
        }

        setState("saving");
        const response = await fetch("/api/interview-sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (cancelled) return;

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error || "Could not save interview session.");
        }

        setState("saved");
        trackWorkZoAnalyticsEvent("interview_saved", {
          recruiter: result.recruiterName || null,
          role: result.targetRole || null,
          metadata: {
            localResultId: result.id || null,
            targetCompany: result.targetCompany || null,
            durationSeconds: result.durationSeconds || 0,
            overallScore: result.score?.overall ?? null,
            trustScore: result.score?.trust ?? null,
            transcriptTurns: Array.isArray(result.transcript) ? result.transcript.length : 0,
          },
        });
      } catch (error) {
        if (cancelled) return;
        setMessage(error instanceof Error ? error.message : "Could not save interview session.");
        setState("error");
      }
    }

    saveIfSignedIn();

    return () => {
      cancelled = true;
    };
  }, [payload]);

  if (state === "checking" || state === "saving") {
    return (
      <div className="mt-5 rounded-lg border border-blue-300/15 bg-blue-400/[0.06] p-4 text-sm text-blue-100">
        <div className="flex items-center gap-2 font-black">
          <Loader2 className="h-4 w-4 animate-spin" />
          {state === "checking" ? "Checking account…" : "Saving this interview…"}
        </div>
      </div>
    );
  }

  if (state === "saved") {
    return (
      <div className="mt-5 rounded-lg border border-emerald-300/15 bg-emerald-400/[0.07] p-4 text-sm text-emerald-100">
        <div className="flex items-center gap-2 font-black">
          <CheckCircle2 className="h-4 w-4" />
          Saved to your interview history.
        </div>
        <Link href="/history" className="mt-2 inline-flex text-xs font-black text-emerald-200 underline underline-offset-4">
          View history
        </Link>
      </div>
    );
  }

  if (state === "signed-out") {
    return (
      <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
        <div className="flex items-center gap-2 font-black text-white">
          <LockKeyhole className="h-4 w-4 text-blue-200" />
          Sign in to save this interview.
        </div>
        <p className="mt-2 leading-6">Your result is still available in this browser. Create an account to keep interview history across sessions.</p>
        <Link href="/login?redirect=/results" className="mt-3 inline-flex rounded-xl bg-blue-500 px-4 py-2 text-xs font-black text-white">
          Sign in and save
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-lg border border-amber-300/15 bg-amber-400/[0.07] p-4 text-sm text-amber-100">
      <div className="flex items-center gap-2 font-black">
        <Cloud className="h-4 w-4" />
        Interview result was not saved.
      </div>
      <p className="mt-2 leading-6">{message || "Please try again after signing in."}</p>
    </div>
  );
}
