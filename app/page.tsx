"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Mic, Upload, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { trackWorkZoLaunchEvent } from "@/lib/workzoLaunchAnalytics";

const transcript = [
  {
    role: "AI RECRUITER",
    text: "Tell me about a time you solved a complex problem with limited information.",
  },
  {
    role: "YOU",
    text: "I took ownership, clarified the missing requirements, and delivered a working solution under pressure.",
  },
  {
    role: "AI RECRUITER",
    text: "That is a start. Now give me proof. What changed because of your action?",
  },
];

const waveform = [18, 30, 16, 38, 24, 44, 22, 34, 20, 48, 28, 40, 18, 32];

export default function LandingPage() {
  const [trust, setTrust] = useState(72);

  useEffect(() => {
    trackWorkZoLaunchEvent({ event: "landing_viewed" });

    const timer = setInterval(() => {
      setTrust((value) => (value === 72 ? 62 : 72));
    }, 3600);

    return () => clearInterval(timer);
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020617] text-white">
      <Image
        src="/hero-room-v2.png"
        alt="Cinematic AI interview room"
        fill
        priority
        sizes="100vw"
        className="object-cover object-[72%_50%] opacity-70 wz-hero-slow-zoom"
      />

      <div className="absolute inset-0 bg-black/42" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_24%,rgba(34,211,238,0.16),transparent_28%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.97)_0%,rgba(2,6,23,0.82)_33%,rgba(2,6,23,0.32)_62%,rgba(2,6,23,0.64)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.38)_0%,rgba(2,6,23,0.12)_45%,rgba(2,6,23,0.92)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_22%,rgba(56,189,248,0.20),transparent_30%)]" />

      <div className="relative z-10 mx-auto max-w-[1500px] px-5 py-5 lg:px-10">
        <header className="flex h-[78px] items-center justify-between rounded-[30px] border border-white/10 bg-[#050b18]/70 px-5 shadow-[0_22px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl lg:px-7">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/workzo_icon.png"
              alt="WorkZo AI"
              width={46}
              height={46}
              className="rounded-2xl"
              priority
            />
            <span className="text-[30px] font-black tracking-tight">
              WorkZo <span className="text-blue-400">AI</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-9 text-sm font-black text-slate-300 lg:flex">
            <Link href="/onboarding" className="hover:text-white">
              Product
            </Link>
            <a href="#features" className="hover:text-white">
              Features
            </a>
            <a href="#how" className="hover:text-white">
              How it works
            </a>
            <a href="#pricing" className="hover:text-white">
              Pricing
            </a>
            <a href="#resources" className="hover:text-white">
              Resources
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="hidden h-12 items-center rounded-2xl border border-white/10 bg-white/[0.05] px-6 text-sm font-black text-white sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href="/onboarding"
              className="inline-flex h-12 items-center rounded-2xl bg-gradient-to-r from-blue-500 to-violet-600 px-7 text-sm font-black text-white"
            >
              Get Started
            </Link>
          </div>
        </header>

        <section className="relative h-[calc(100vh-118px)] overflow-hidden py-8">
          <div className="max-w-[650px] pt-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-white/[0.05] px-4 py-2 text-sm font-black backdrop-blur-xl">
              ✨ AI interviewer that feels real
            </div>

            <h1 className="mt-7 text-[clamp(44px,4.6vw,72px)] font-black leading-[0.9] tracking-[-0.05em]">
              Face a real interview{" "}
              <span className="bg-gradient-to-r from-cyan-300 via-blue-500 to-violet-500 bg-clip-text text-transparent">
                before the real one.
              </span>
            </h1>

            <p className="mt-6 max-w-[610px] text-[19px] leading-8 text-slate-300">
              Practice with an AI recruiter that reads your CV, asks follow-up
              questions, interrupts vague answers, applies pressure, detects
              contradictions, and gives honest feedback.
            </p>

            <div
              id="features"
              className="mt-8 grid max-w-[640px] grid-cols-2 gap-4 text-sm font-bold text-slate-200 sm:grid-cols-4"
            >
              {[
                "Realistic AI Interviewer",
                "Follow-ups & Interruptions",
                "Pressure Simulation",
                "Honest Feedback",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-cyan-300" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-9 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/onboarding"
                className="inline-flex h-16 items-center justify-center gap-3 rounded-[24px] bg-gradient-to-r from-blue-500 to-violet-600 px-8 text-base font-black text-white shadow-[0_0_46px_rgba(59,130,246,0.35)]"
              >
                Start Real Interview
                <ArrowRight className="h-5 w-5" />
              </Link>

              <Link
                href="/onboarding"
                className="inline-flex h-16 items-center justify-center gap-3 rounded-[24px] border border-white/10 bg-white/[0.04] px-8 text-base font-black text-white backdrop-blur-xl"
              >
                <Upload className="h-5 w-5" />
                Upload CV
              </Link>
            </div>
          </div>

          <div className="pointer-events-none absolute left-[46%] top-[52px] hidden h-14 w-[410px] items-center justify-between rounded-[22px] border border-white/[0.08] bg-black/22 px-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] backdrop-blur-2xl lg:flex">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.85)]" />
              <span className="text-xs font-black uppercase tracking-[0.25em] text-emerald-200">
                Live Interview
              </span>
            </div>

            <div className="flex h-8 items-center gap-[5px]">
              {waveform.map((height, index) => (
                <span
                  key={index}
                  className="w-[4px] rounded-full bg-gradient-to-t from-blue-500 via-cyan-300 to-violet-400 wz-wave"
                  style={{
                    height,
                    animationDelay: `${index * 80}ms`,
                  }}
                />
              ))}
            </div>
          </div>

          <div className="pointer-events-none absolute right-6 top-[96px] hidden w-[170px] rotate-[2deg] rounded-[26px] border border-white/[0.08] bg-[rgba(7,12,24,0.62)] backdrop-blur-[24px] p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] backdrop-blur-2xl lg:block">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">
              Trust Score
            </p>

            <div className="mt-5 flex h-24 items-center justify-center rounded-full border-[7px] shadow-[0_0_35px_rgba(56,189,248,0.12)] border-cyan-300/80 border-b-amber-300 border-r-violet-400 bg-black/20">
              <div className="text-center">
                <p className="text-3xl font-black">{trust}</p>
                <p className="text-xs text-slate-300">/100</p>
              </div>
            </div>

            <p className="mt-4 text-center text-xs font-black text-red-300">
              {trust < 70 ? "Trust dropping... ↓" : "Good start"}
            </p>
          </div>

          <div className="pointer-events-none absolute right-8 top-[292px] hidden w-[170px] rounded-[24px] border border-white/[0.08] bg-black/24 p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] backdrop-blur-2xl lg:block">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">
              Pressure Level
            </p>
            <p className="mt-3 text-lg font-black text-red-300">High</p>
            <div className="mt-4 overflow-hidden rounded-xl border border-red-400/10 bg-black/20 p-1">
              <div className="h-8 w-[72%] rounded-lg bg-[linear-gradient(90deg,#ef4444,#dc2626,#7f1d1d)] shadow-[0_0_24px_rgba(239,68,68,0.28)] wz-pressure-pulse" />
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-[58px] left-[49%] hidden w-[430px] rounded-[28px] border border-white/[0.08] bg-black/28 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.35),inset_0_1px_1px_rgba(255,255,255,0.06)] backdrop-blur-2xl lg:block">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-300">
                Live Transcript
              </p>
              <span className="flex items-center gap-2 text-xs font-bold">
                <span className="h-2 w-2 rounded-full bg-red-400" />
                Live
              </span>
            </div>

            <div className="space-y-4">
              {transcript.map((line) => (
                <div key={line.role + line.text} className="flex gap-4">
                  <span
                    className={`mt-1.5 h-3 w-3 rounded-full ${
                      line.role === "YOU" ? "bg-emerald-300" : "bg-blue-400"
                    }`}
                  />
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                      {line.role}
                    </p>
                    <p className="mt-1 text-[14px] leading-6 text-white/88">
                      {line.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center gap-3 border-t border-white/10 pt-4 text-sm font-bold text-slate-300">
              <span className="text-cyan-300">✦</span>
              AI is thinking
              <span className="wz-thinking-dots">...</span>
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-4 left-[49%] hidden h-12 items-center gap-5 rounded-[22px] border border-white/[0.08] bg-black/24 px-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] backdrop-blur-2xl lg:flex">
            <span className="flex items-center gap-2 text-sm font-bold text-slate-200">
              <Mic className="h-5 w-5" /> Mic On
            </span>
            <span className="h-6 w-px bg-white/10" />
            <span className="flex items-center gap-2 text-sm font-bold text-slate-200">
              <Video className="h-5 w-5" /> Camera On
            </span>
            <span className="h-6 w-px bg-white/10" />
            <span className="text-sm font-black text-red-300">
              End Interview
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}