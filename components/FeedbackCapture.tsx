"use client";

import { useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { trackWorkZoLaunchEvent } from "@/lib/workzoLaunchAnalytics";

export default function FeedbackCapture({
  source = "launch",
}: {
  source?: "landing" | "onboarding" | "interview" | "results" | "copilot" | "launch";
}) {
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function submitFeedback() {
    const payload = {
      email: email.trim(),
      feedback: feedback.trim(),
      source,
      createdAt: new Date().toISOString(),
    };

    try {
      const existing = JSON.parse(window.localStorage.getItem("workzo-feedback") || "[]") as unknown[];
      existing.push(payload);
      window.localStorage.setItem("workzo-feedback", JSON.stringify(existing.slice(-300)));
    } catch {
      window.localStorage.setItem("workzo-feedback", JSON.stringify([payload]));
    }

    trackWorkZoLaunchEvent({
      event: feedback.trim() ? "feedback_submitted" : "waitlist_joined",
      metadata: {
        source,
        hasEmail: Boolean(email.trim()),
        hasFeedback: Boolean(feedback.trim()),
      },
    });

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-5 text-emerald-50">
        <p className="font-black">Thank you — saved.</p>
        <p className="mt-1 text-sm leading-6 text-emerald-100/85">
          Your feedback helps improve WorkZo before launch.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.045] p-5 text-white backdrop-blur-2xl">
      <div className="flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-cyan-200" />
        <h2 className="text-xl font-black">Help improve WorkZo</h2>
      </div>

      <p className="mt-2 text-sm leading-6 text-slate-400">
        Leave quick feedback to help us improve WorkZo AI.
      </p>

      <input
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email optional"
        className="mt-4 h-12 w-full rounded-lg border border-white/10 bg-slate-950/60 px-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
      />

      <textarea
        value={feedback}
        onChange={(event) => setFeedback(event.target.value)}
        placeholder="What felt realistic? What broke? What should improve?"
        className="mt-3 h-28 w-full resize-none rounded-lg border border-white/10 bg-slate-950/60 p-4 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
      />

      <button
        type="button"
        onClick={submitFeedback}
        className="mt-3 inline-flex h-11 items-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-violet-600 px-5 text-sm font-black text-white"
      >
        <Send className="h-4 w-4" />
        Save feedback
      </button>
    </div>
  );
}
