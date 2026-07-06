"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Film, Image as ImageIcon, MessageSquareText, Rocket, Sparkles } from "lucide-react";
import { trackWorkZoEvent } from "@/lib/workzoAnalytics";

const tagline = "Practice interviews with an AI recruiter that remembers your CV.";

const firstComment = `Hi Product Hunt 👋

I’m Haritha, solo founder of WorkZo AI.

WorkZo AI is built around one simple promise:

“The closest thing to a real interview.”

Instead of giving generic interview questions, WorkZo reads your CV and job description, builds recruiter memory, and simulates realistic follow-ups, pressure moments, trust shifts, and recruiter-style feedback.

Why I built it:
Many job seekers don’t fail because they lack experience. They fail because they don’t know how recruiters interpret their answers in real time.

WorkZo helps users practice:
• CV-based interviews
• JD-specific follow-ups
• measurable impact answers
• recruiter pressure
• confidence recovery

This is still improving, and I’d love honest feedback from job seekers, recruiters, and founders.`;

const screenshots = [
  "Cinematic interview room with recruiter memory",
  "CV/JD upload and recruiter preparation",
  "Live trust, pressure, and answer quality signals",
  "Results page showing recruiter perception and improvement areas",
];

function copy(value: string) {
  void navigator.clipboard.writeText(value);
}

export default function ProductHuntAssetsPage() {
  useEffect(() => {
    trackWorkZoEvent({ event: "product_hunt_asset_viewed" });
  }, []);

  return (
    <main className="min-h-screen bg-canvas px-4 py-5 text-fg sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-fg/[0.045] p-4 backdrop-blur-2xl">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-black text-fg">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <div className="rounded-full bg-warning/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-warning">
            Product Hunt kit
          </div>
        </header>

        <section className="mt-5 rounded-[32px] border border-line bg-gradient-to-br from-warning/16 via-white/[0.045] to-brand/14 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.42)] sm:p-8">
          <div className="flex items-center gap-3">
            <Rocket className="h-7 w-7 text-warning" />
            <h1 className="text-3xl font-black tracking-tight sm:text-3xl">Product Hunt launch assets</h1>
          </div>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted">
            Prepare screenshots, tagline, first comment, and demo video structure.
          </p>
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-[28px] border border-line bg-fg/[0.045] p-5">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-brand" />
              <h2 className="text-xl font-black">Tagline</h2>
            </div>
            <p className="rounded-lg bg-canvas-soft p-4 text-lg font-black leading-7">{tagline}</p>
            <button onClick={() => copy(tagline)} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-fg/10 px-4 py-2 text-sm font-black">
              <Copy className="h-4 w-4" />
              Copy tagline
            </button>
          </div>

          <div className="rounded-[28px] border border-line bg-fg/[0.045] p-5">
            <div className="mb-3 flex items-center gap-2">
              <Film className="h-5 w-5 text-brand" />
              <h2 className="text-xl font-black">Demo video structure</h2>
            </div>
            <div className="space-y-2 text-sm leading-6 text-muted">
              <p>0-3s: “Your recruiter already read your CV.”</p>
              <p>3-8s: Upload CV + JD → recruiter memory prepared.</p>
              <p>8-18s: Interview room with a CV-specific follow-up.</p>
              <p>18-25s: Trust drops or improves based on answer quality.</p>
              <p>25-35s: Results: “Here is where the recruiter lost confidence.”</p>
            </div>
          </div>

          <div className="rounded-[28px] border border-line bg-fg/[0.045] p-5">
            <div className="mb-3 flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-brand" />
              <h2 className="text-xl font-black">Screenshot checklist</h2>
            </div>
            <div className="space-y-2 text-sm leading-6 text-muted">
              {screenshots.map((item) => (
                <p key={item}>• {item}</p>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-line bg-fg/[0.045] p-5">
            <div className="mb-3 flex items-center gap-2">
              <MessageSquareText className="h-5 w-5 text-brand" />
              <h2 className="text-xl font-black">First comment</h2>
            </div>
            <textarea readOnly value={firstComment} className="min-h-[360px] w-full rounded-lg border border-line bg-canvas-soft p-4 text-sm leading-6 text-fg outline-none" />
            <button onClick={() => copy(firstComment)} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-fg/10 px-4 py-2 text-sm font-black">
              <Copy className="h-4 w-4" />
              Copy first comment
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
