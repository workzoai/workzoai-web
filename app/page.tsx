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
    <main className="relative min-h-screen overflow-x-hidden overflow-y-auto bg-[#020617] pb-[calc(env(safe-area-inset-bottom)+42px)] text-white sm:pb-[calc(env(safe-area-inset-bottom)+72px)]">
      <style jsx global>{`
        @keyframes wzHeroSlowZoom {
          0%, 100% { transform: scale(1.02); }
          50% { transform: scale(1.07); }
        }

        @keyframes wzWave {
          0%, 100% { transform: scaleY(.52); opacity: .58; }
          45% { transform: scaleY(1.18); opacity: 1; }
        }

        @keyframes wzPressurePulse {
          0%, 100% { opacity: .72; transform: scaleX(.92); }
          50% { opacity: 1; transform: scaleX(1); }
        }

        @keyframes wzThinkingDots {
          0%, 20% { opacity: .2; }
          50% { opacity: 1; }
          100% { opacity: .2; }
        }

        @keyframes wzMobileCardFloat {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-5px) scale(1.01); }
        }

        @keyframes wzMobileGlow {
          0%, 100% { opacity: .42; transform: scale(.95); }
          50% { opacity: .82; transform: scale(1.05); }
        }

        .wz-hero-slow-zoom { animation: wzHeroSlowZoom 16s ease-in-out infinite; }
        .wz-wave { animation: wzWave 1.12s ease-in-out infinite; transform-origin: bottom; }
        .wz-pressure-pulse { animation: wzPressurePulse 2.2s ease-in-out infinite; transform-origin: left; }
        .wz-thinking-dots { animation: wzThinkingDots 1.2s ease-in-out infinite; }
        .wz-mobile-card-float { animation: wzMobileCardFloat 5.8s ease-in-out infinite; }
        .wz-mobile-glow { animation: wzMobileGlow 3.6s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .wz-hero-slow-zoom,
          .wz-wave,
          .wz-pressure-pulse,
          .wz-thinking-dots,
          .wz-mobile-card-float,
          .wz-mobile-glow {
            animation: none !important;
          }
        }
      `}</style>

      <Image
        src="/hero-room-v2.png"
        alt="Cinematic AI interview room"
        fill
        priority
        sizes="100vw"
        className="object-cover object-[72%_50%] opacity-45 wz-hero-slow-zoom sm:opacity-60 2xl:opacity-70"
      />

      <div className="absolute inset-0 bg-black/54 sm:bg-black/50" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.18),transparent_32%)] sm:bg-[radial-gradient(circle_at_72%_24%,rgba(34,211,238,0.10),transparent_28%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.88)_0%,rgba(2,6,23,0.45)_36%,rgba(2,6,23,0.96)_100%)] 2xl:bg-[linear-gradient(90deg,rgba(2,6,23,0.97)_0%,rgba(2,6,23,0.82)_33%,rgba(2,6,23,0.32)_62%,rgba(2,6,23,0.64)_100%)]" />
      <div className="absolute inset-0 hidden bg-[linear-gradient(180deg,rgba(2,6,23,0.38)_0%,rgba(2,6,23,0.12)_45%,rgba(2,6,23,0.92)_100%)] 2xl:block" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_22%,rgba(56,189,248,0.13),transparent_30%)]" />

      <div className="relative z-10 mx-auto max-w-[1500px] px-4 py-4 sm:px-5 sm:py-5 2xl:px-10">
        <header className="flex min-h-[64px] items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-[#050b18]/76 px-4 shadow-[0_22px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:h-[78px] sm:rounded-[30px] sm:px-5 2xl:px-7">
          <Link href="/" className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <Image
              src="/workzo_icon.png"
              alt="WorkZo AI"
              width={46}
              height={46}
              className="h-10 w-10 rounded-2xl sm:h-[46px] sm:w-[46px]"
              priority
            />
            <span className="truncate text-[24px] font-black tracking-tight sm:text-[30px]">
              WorkZo <span className="text-blue-400">AI</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-9 text-sm font-black text-slate-300 2xl:flex">
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

          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/dashboard"
              className="hidden h-12 items-center rounded-2xl border border-white/10 bg-white/[0.05] px-6 text-sm font-black text-white sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href="/onboarding"
              className="inline-flex h-11 items-center rounded-2xl bg-gradient-to-r from-blue-500 to-violet-600 px-4 text-sm font-black text-white shadow-[0_0_30px_rgba(59,130,246,0.28)] sm:h-12 sm:px-7"
            >
              Get Started
            </Link>
          </div>
        </header>

        <section className="relative min-h-[calc(100dvh-96px)] overflow-visible py-7 pb-[calc(env(safe-area-inset-bottom)+44px)] sm:min-h-[calc(100dvh-118px)] sm:py-8 sm:pb-[calc(env(safe-area-inset-bottom)+80px)] 2xl:h-[calc(100vh-118px)] 2xl:overflow-hidden 2xl:pb-0">
          <div className="max-w-[650px] pt-0 text-center sm:text-left md:max-w-[720px] 2xl:max-w-[650px]">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-white/[0.06] px-3.5 py-2 text-xs font-black backdrop-blur-xl sm:px-4 sm:text-sm">
              ✨ AI interviewer that feels real
            </div>

            <h1 className="mt-6 text-[clamp(40px,12vw,58px)] font-black leading-[0.92] tracking-[-0.055em] sm:mt-7 sm:text-[clamp(44px,5.2vw,64px)] 2xl:text-[clamp(44px,4.6vw,72px)] sm:leading-[0.9]">
              Face a real interview{" "}
              <span className="bg-gradient-to-r from-cyan-300 via-blue-500 to-violet-500 bg-clip-text text-transparent">
                before the real one.
              </span>
            </h1>

            <p className="mx-auto mt-5 max-w-[610px] text-[16px] leading-7 text-slate-300 sm:mx-0 sm:mt-6 sm:text-[19px] sm:leading-8">
              Practice with an AI recruiter that reads your CV, asks follow-up
              questions, interrupts vague answers, applies pressure, detects
              contradictions, and gives honest feedback.
            </p>

            <div
              id="features"
              className="mx-auto mt-6 grid max-w-[640px] grid-cols-2 gap-3 text-left text-[13px] font-bold text-slate-200 sm:mx-0 sm:mt-8 sm:grid-cols-4 sm:gap-4 sm:text-sm"
            >
              {[
                "Realistic AI Interviewer",
                "Follow-ups & Interruptions",
                "Pressure Simulation",
                "Honest Feedback",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/[0.07] bg-white/[0.045] p-3 backdrop-blur-xl sm:border-none sm:bg-transparent sm:p-0"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-cyan-300" />
                    <span>{item}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:gap-4">
              <Link
                href="/onboarding"
                className="inline-flex h-15 min-h-[58px] items-center justify-center gap-3 rounded-[22px] bg-gradient-to-r from-blue-500 to-violet-600 px-7 text-base font-black text-white shadow-[0_0_46px_rgba(59,130,246,0.35)] transition active:scale-[0.98] sm:h-16 sm:rounded-[24px] sm:px-8"
              >
                Start Real Interview
                <ArrowRight className="h-5 w-5" />
              </Link>

              <Link
                href="/onboarding"
                className="inline-flex h-15 min-h-[58px] items-center justify-center gap-3 rounded-[22px] border border-white/[0.08] bg-white/[0.025] px-7 text-base font-black text-slate-100 backdrop-blur-xl transition hover:bg-white/[0.045] active:scale-[0.98] sm:h-16 sm:rounded-[24px] sm:px-8"
              >
                <Upload className="h-5 w-5" />
                Upload CV
              </Link>
            </div>

            <p className="mx-auto mt-4 max-w-[520px] text-center text-xs font-semibold leading-5 text-slate-500 sm:mx-0 sm:text-left">
              Beta product · validate AI feedback before real applications · your setup can be edited anytime.
            </p>
          </div>

          <div className="pointer-events-none relative mx-auto mt-8 md:mt-10 block w-full max-w-[430px] md:max-w-[720px] rounded-[32px] border border-white/[0.09] bg-[#061225]/72 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.36),inset_0_1px_1px_rgba(255,255,255,0.08)] backdrop-blur-2xl wz-mobile-card-float 2xl:hidden">
            <div className="absolute -inset-4 rounded-[38px] bg-cyan-400/10 blur-3xl wz-mobile-glow" />
            <div className="relative overflow-hidden rounded-[26px] border border-white/[0.08] bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.85)]" />
                  <span className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-200">
                    Live Interview
                  </span>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-black text-slate-200">
                  Trust {trust}
                </span>
              </div>

              <div className="mt-5 flex h-10 items-end justify-center gap-[6px]">
                {waveform.slice(0, 10).map((height, index) => (
                  <span
                    key={index}
                    className="w-[5px] rounded-full bg-gradient-to-t from-blue-500 via-cyan-300 to-violet-400 wz-wave"
                    style={{
                      height: Math.max(14, height * 0.82),
                      animationDelay: `${index * 80}ms`,
                    }}
                  />
                ))}
              </div>

              <div className="mt-5 space-y-3">
                {transcript.map((line) => (
                  <div
                    key={line.role + line.text}
                    className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-3 text-left"
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                      {line.role}
                    </p>
                    <p className="mt-1 text-[13px] leading-5 text-white/82">
                      {line.text}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/[0.07] bg-black/20 px-4 py-3 text-xs font-bold text-slate-300">
                <span className="flex items-center gap-2">
                  <Mic className="h-4 w-4 text-cyan-300" /> Mic On
                </span>
                <span className="text-red-300">Pressure High</span>
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute left-[46%] top-[52px] hidden h-14 w-[410px] items-center justify-between rounded-[22px] border border-white/[0.08] bg-black/22 px-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] backdrop-blur-2xl 2xl:flex">
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

          <div className="pointer-events-none absolute right-8 top-[150px] hidden w-[190px] rounded-[24px] border border-white/[0.045] bg-black/14 p-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] backdrop-blur-2xl 2xl:block">
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-cyan-100/65">
              Recruiter signal
            </p>
            <div className="mt-2 inline-flex rounded-full border border-rose-300/12 bg-rose-400/8 px-2.5 py-1 text-[10px] font-black text-rose-100">
              Pressuring
            </div>

            <div className="mt-3 space-y-2.5 text-[11px] font-bold text-slate-300">
              <div>
                <div className="flex items-center justify-between">
                  <span>Trust</span>
                  <span className="text-base font-black text-white">{trust}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 transition-all duration-700"
                    style={{ width: `${trust}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span>Pressure</span>
                  <span className="text-rose-200">High</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-rose-400 to-red-500 wz-pressure-pulse" />
                </div>
              </div>

              <p className="rounded-2xl border border-white/[0.035] bg-white/[0.02] px-2.5 py-2 leading-5 text-slate-500">
                Asking for proof, ownership, and measurable impact.
              </p>
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-[58px] left-[49%] hidden w-[430px] rounded-[26px] border border-white/[0.08] bg-black/24 p-4 shadow-[0_20px_64px_rgba(0,0,0,0.28),inset_0_1px_1px_rgba(255,255,255,0.04)] backdrop-blur-2xl 2xl:block">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-300">
                Live Transcript
              </p>
              <span className="flex items-center gap-2 text-xs font-bold">
                <span className="h-2 w-2 rounded-full bg-red-400" />
                Live
              </span>
            </div>

            <div className="space-y-5">
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
                    <p className="mt-1.5 text-[14px] leading-6 text-white/84">
                      {line.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-3 border-t border-white/10 pt-4 text-sm font-bold text-slate-300">
              <span className="text-cyan-300">✦</span>
              AI is thinking
              <span className="wz-thinking-dots">...</span>
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-4 left-[49%] hidden h-12 items-center gap-5 rounded-[22px] border border-white/[0.08] bg-black/20 px-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] backdrop-blur-2xl 2xl:flex">
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
