"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Upload } from "lucide-react";
import { useEffect, useState } from "react";

const trustChips = [
  "AI recruiter memory",
  "Live pressure simulation",
  "Honest feedback",
];

const heroPrompts = [
  "“Tell me about a time you solved a complex problem with limited information.”",
  "“Give me one concrete metric from that experience.”",
  "“What exactly did YOU do, not the team?”",
];

const trustValues = ["Trust 72/100", "Trust 68/100", "Trust 81/100"];

const waveform = [14, 28, 18, 36, 22, 30, 38, 44, 20, 28, 36, 48, 24, 32];

export default function LandingPage() {
  const [liveIndex, setLiveIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveIndex((value) => (value + 1) % heroPrompts.length);
    }, 3200);

    return () => clearInterval(timer);
  }, []);

  return (
    <main className="min-h-screen overflow-hidden bg-[#020712] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-220px] top-[-220px] h-[480px] w-[480px] rounded-full bg-blue-600/14 blur-[100px]" />
        <div className="absolute right-[-200px] top-[-160px] h-[500px] w-[500px] rounded-full bg-cyan-400/10 blur-[110px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_58%_18%,rgba(59,130,246,0.12),transparent_34%)]" />
      </div>

      <div className="relative z-10 mx-auto flex h-screen max-w-[1440px] flex-col overflow-hidden px-4 py-4 sm:px-8 lg:px-10">
        <header className="flex h-[72px] shrink-0 items-center justify-between rounded-[26px] border border-white/10 bg-white/[0.045] px-4 shadow-[0_18px_70px_rgba(0,0,0,0.26)] backdrop-blur-2xl sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/workzo_icon.png"
              alt="WorkZo AI"
              width={40}
              height={40}
              className="rounded-2xl shadow-[0_0_24px_rgba(14,165,233,0.24)]"
              priority
            />
            <span className="text-[28px] font-black leading-none tracking-tight sm:text-[30px]">
              WorkZo <span className="text-blue-400">AI</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-bold text-slate-300 lg:flex">
            <Link href="/onboarding" className="transition hover:text-white">
              Product
            </Link>
            <a href="#features" className="transition hover:text-white">
              Features
            </a>
            <a href="#how" className="transition hover:text-white">
              How it works
            </a>
            <a href="#pricing" className="transition hover:text-white">
              Pricing
            </a>
            <a href="#resources" className="transition hover:text-white">
              Resources
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="hidden h-12 items-center rounded-2xl border border-white/10 bg-white/[0.05] px-5 text-sm font-black text-slate-200 transition hover:bg-white/10 sm:inline-flex"
            >
              Dashboard
            </Link>
            <Link
              href="/onboarding"
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-500 to-violet-600 px-5 text-sm font-black text-white shadow-[0_0_30px_rgba(59,130,246,0.24)] transition hover:scale-[1.02]"
            >
              Get Started
            </Link>
          </div>
        </header>

        <section className="grid min-h-0 flex-1 items-center gap-5 py-4 lg:grid-cols-[48%_52%]">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-white/[0.045] px-4 py-2 text-sm font-black text-slate-100 shadow-[0_14px_50px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
              <SparkleIcon />
              AI interviewer that feels real
            </div>

            <h1 className="mt-5 max-w-[710px] text-[clamp(44px,5vw,72px)] font-black leading-[0.95] tracking-tight">
              Face a real interview{" "}
              <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-500 bg-clip-text text-transparent">
                before the real one.
              </span>
            </h1>

            <p className="mt-5 max-w-[560px] text-[18px] leading-8 text-slate-300 lg:text-[19px]">
              Practice with an AI recruiter that reads your CV, asks follow-up
              questions, applies pressure, detects contradictions, and gives
              honest feedback.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/onboarding"
                className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-3xl bg-gradient-to-r from-blue-500 to-violet-600 px-7 text-base font-black text-white shadow-[0_0_42px_rgba(59,130,246,0.26)] transition hover:scale-[1.02] sm:w-[235px]"
              >
                Start Real Interview
                <ArrowRight className="h-5 w-5" />
              </Link>

              <Link
                href="/onboarding"
                className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-3xl border border-white/10 bg-white/[0.035] px-7 text-base font-black text-slate-200 shadow-[0_16px_60px_rgba(0,0,0,0.18)] transition hover:bg-white/10 sm:w-[200px]"
              >
                <Upload className="h-5 w-5" />
                Upload CV
              </Link>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-slate-400">
              <div className="flex -space-x-2">
                {["👨🏻‍💼", "👩🏽‍💼", "👩🏻‍💼", "👨🏼‍💼"].map((item) => (
                  <span
                    key={item}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-950 bg-white/10 text-base"
                  >
                    {item}
                  </span>
                ))}
              </div>
              <span>Built for serious job seekers who want realistic practice.</span>
            </div>

            <div
              id="features"
              className="mt-5 grid max-w-[560px] grid-cols-3 gap-2.5"
            >
              {trustChips.map((chip) => (
                <span
                  key={chip}
                  className="flex h-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-3 text-center text-xs font-black text-slate-300 shadow-[0_10px_40px_rgba(0,0,0,0.16)] backdrop-blur-xl"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>

          <div className="relative flex min-h-0 items-center justify-center">
            <div className="absolute inset-8 rounded-full bg-cyan-400/14 blur-[80px]" />

            <div className="relative h-[min(56vh,450px)] w-full max-w-[610px] overflow-hidden rounded-[34px] border border-white/10 bg-white/[0.055] shadow-[0_32px_120px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
              <img
                src="/recruiters/sarah.png"
                alt="AI recruiter"
                className="absolute inset-0 h-full w-full object-cover object-center opacity-95"
              />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,7,18,.24)_0%,rgba(2,7,18,.05)_40%,rgba(2,7,18,.30)_100%),linear-gradient(180deg,rgba(2,7,18,.08)_0%,rgba(2,7,18,.18)_48%,rgba(2,7,18,.82)_100%)]" />

              <div className="absolute right-5 top-5 flex items-center justify-center rounded-2xl border border-white/10 bg-white/10 p-4 text-white backdrop-blur-2xl">
                <ArrowRight className="-rotate-45" />
              </div>

              <div className="absolute inset-x-5 bottom-5 rounded-[26px] border border-white/10 bg-slate-950/72 p-4 shadow-[0_28px_90px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.65)]" />
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200">
                      Live interview
                    </p>
                  </div>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white transition-all duration-500">
                    {trustValues[liveIndex]}
                  </span>
                </div>

                <p className="min-h-[84px] text-[clamp(19px,2vw,27px)] font-black leading-tight transition-all duration-500">
                  {heroPrompts[liveIndex]}
                </p>

                <div className="mt-3 flex h-8 items-end gap-1.5 overflow-hidden">
                  {waveform.map((height, index) => (
                    <span
                      key={index}
                      className="w-2 rounded-full bg-gradient-to-t from-blue-500 to-cyan-300"
                      style={{ height }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SparkleIcon() {
  return (
    <span className="relative flex h-4 w-4 items-center justify-center">
      <span className="absolute h-2 w-2 rounded-full bg-cyan-300" />
      <span className="absolute h-4 w-[2px] rounded-full bg-cyan-300" />
      <span className="absolute h-[2px] w-4 rounded-full bg-cyan-300" />
    </span>
  );
}
