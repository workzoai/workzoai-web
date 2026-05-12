"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Brain,
  ChevronDown,
  FileText,
  Maximize2,
  Mic,
  Radio,
  Sparkles,
  Upload,
  Video,
  Zap,
} from "lucide-react";

const featureCards = [
  {
    icon: Mic,
    title: "Real-life Interviews",
    text: "AI recruiter with real human behavior.",
  },
  {
    icon: FileText,
    title: "CV-Aware",
    text: "Questions tailored to your experience.",
  },
  {
    icon: Zap,
    title: "Interrupts & Probes",
    text: "Interrupts vague answers and dives deeper.",
  },
  {
    icon: Brain,
    title: "Smart Feedback",
    text: "Actionable insights that help you grow.",
  },
  {
    icon: BarChart3,
    title: "Track Progress",
    text: "Measure and improve over time.",
  },
];

const waveformHeights = [
  8, 13, 22, 11, 18, 13, 24, 16, 10, 20, 26, 12, 17, 14, 23, 18, 10, 21,
  15, 27, 13, 19, 14, 23, 17, 10, 20, 14, 25, 13, 19, 11, 22, 16, 21, 12,
  24, 14, 19, 10, 16, 9, 13, 8, 11, 7,
];

const avatarFaces = ["👩🏽", "👨🏻", "👩🏼", "👨🏽", "👩🏻"];

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#020712] text-white lg:h-screen lg:overflow-hidden">
      <style jsx global>{`
        @keyframes workzoGlowDrift {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 0.72;
          }
          50% {
            transform: translate3d(24px, -18px, 0) scale(1.08);
            opacity: 1;
          }
          100% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 0.72;
          }
        }

        @keyframes workzoPulseBar {
          0%,
          100% {
            transform: scaleY(0.72);
            opacity: 0.7;
          }
          50% {
            transform: scaleY(1.12);
            opacity: 1;
          }
        }

        @keyframes workzoBreath {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.012);
          }
        }

        @keyframes workzoCameraFloat {
          0%,
          100% {
            transform: scale(1) translateY(0);
          }
          50% {
            transform: scale(1.018) translateY(-5px);
          }
        }

        @keyframes workzoBlink {
          0%,
          88%,
          100% {
            opacity: 0;
          }
          90%,
          92% {
            opacity: 0.18;
          }
        }

        @keyframes workzoLivePulse {
          0%,
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.45);
          }
          50% {
            transform: scale(1.08);
            box-shadow: 0 0 0 7px rgba(16, 185, 129, 0);
          }
        }

        @keyframes workzoGlassFloat {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }
      `}</style>

      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-260px] top-[-180px] h-[520px] w-[520px] rounded-full bg-blue-600/18 blur-[120px] [animation:workzoGlowDrift_8s_ease-in-out_infinite]" />
        <div className="absolute right-[-220px] top-[-140px] h-[540px] w-[540px] rounded-full bg-cyan-400/16 blur-[130px] [animation:workzoGlowDrift_9s_ease-in-out_infinite_reverse]" />
        <div className="absolute bottom-[-260px] left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-indigo-600/14 blur-[130px]" />
        <div className="absolute left-[37%] top-[26%] h-[360px] w-[360px] rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1540px] flex-col px-5 py-5 lg:h-screen">
        <header className="flex h-[64px] shrink-0 items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] px-5 shadow-[0_18px_80px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-2xl shadow-[0_0_24px_rgba(14,165,233,0.35)]">
              <Image
                src="/workzo_icon.png"
                alt="WorkZo AI"
                width={40}
                height={40}
                className="h-full w-full object-cover"
                priority
              />
            </div>
            <span className="text-[25px] font-black tracking-tight">
              WorkZo{" "}
              <span className="bg-gradient-to-r from-cyan-300 to-indigo-400 bg-clip-text text-transparent">
                AI
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-9 text-[14px] font-semibold text-slate-200 lg:flex">
            <button className="flex items-center gap-1 transition hover:text-white">
              Product <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <a href="#features" className="transition hover:text-white">
              Features
            </a>
            <a href="#how" className="transition hover:text-white">
              How it Works
            </a>
            <a href="#pricing" className="transition hover:text-white">
              Pricing
            </a>
            <button className="flex items-center gap-1 transition hover:text-white">
              Resources <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="hidden rounded-xl border border-white/12 bg-white/[0.035] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-white/10 sm:block"
            >
              Sign in
            </Link>
            <Link
              href="/onboarding"
              className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 px-5 py-2.5 text-sm font-black text-white shadow-[0_14px_32px_rgba(37,99,235,0.32)] transition hover:scale-[1.02]"
            >
              Get Started
            </Link>
          </div>
        </header>

        <section className="grid min-h-0 flex-1 items-center gap-8 py-5 lg:grid-cols-[0.9fr_1.1fr] xl:py-6">
          <div className="min-w-0 self-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-2xl border border-indigo-400/25 bg-indigo-500/12 px-4 py-2 text-sm font-bold text-indigo-200 shadow-[0_0_40px_rgba(79,70,229,0.16)]">
              <Sparkles className="h-4 w-4" />
              AI Interviewer That Feels Real
            </div>

            <h1 className="max-w-[680px] text-[43px] font-black leading-[0.98] tracking-[-0.055em] sm:text-[55px] xl:text-[62px]">
              Face a real interview{" "}
              <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-indigo-500 bg-clip-text text-transparent">
                before the real one.
              </span>
            </h1>

            <p className="mt-4 max-w-[625px] text-[16px] leading-7 text-slate-300 xl:text-[17px]">
              Practice with an AI recruiter that reads your CV, asks follow-up
              questions, interrupts vague answers, applies pressure, detects
              contradictions, and gives honest feedback.
            </p>

            <div className="mt-6 flex flex-wrap gap-4">
              <Link
                href="/onboarding"
                className="group inline-flex h-[52px] items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 px-8 text-base font-black text-white shadow-[0_16px_40px_rgba(37,99,235,0.38)] transition hover:scale-[1.02]"
              >
                Start Real Interview
                <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
              </Link>
              <Link
                href="/onboarding"
                className="inline-flex h-[52px] items-center justify-center gap-3 rounded-2xl border border-white/12 bg-white/[0.035] px-8 text-base font-black text-white transition hover:bg-white/10"
              >
                <Upload className="h-5 w-5" />
                Upload CV
              </Link>
            </div>

            <div className="mt-6 flex items-center gap-5">
              <div className="flex -space-x-3">
                {avatarFaces.map((face, index) => (
                  <div
                    key={`${face}-${index}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#020712] bg-slate-800 text-base shadow-lg"
                  >
                    {face}
                  </div>
                ))}
              </div>

              <div>
                <p className="text-sm text-slate-300">
                  Loved by 10,000+ job seekers
                </p>
                <p className="mt-0.5 text-base font-black text-yellow-300">
                  ★★★★★ <span className="ml-1 text-white">4.9/5</span>
                </p>
              </div>
            </div>
          </div>

          <div className="relative min-w-0 self-center">
            <div className="absolute -inset-6 rounded-[2.4rem] bg-gradient-to-br from-blue-500/20 via-cyan-400/10 to-indigo-500/18 blur-2xl [animation:workzoGlowDrift_7s_ease-in-out_infinite]" />

            <div className="relative overflow-hidden rounded-[28px] border border-white/14 bg-white/[0.04] p-3 shadow-[0_35px_120px_rgba(0,0,0,0.56),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl [animation:workzoBreath_6s_ease-in-out_infinite]">
              <div className="relative h-[420px] overflow-hidden rounded-[24px] border border-white/10 bg-slate-950 xl:h-[455px]">
                <div className="absolute inset-0 [animation:workzoCameraFloat_8s_ease-in-out_infinite]">
                  <Image
                    src="/workzo_recruiter_hero.png"
                    alt="AI recruiter preview"
                    fill
                    priority
                    sizes="(min-width: 1024px) 56vw, 100vw"
                    className="object-cover object-center"
                  />
                </div>

                <div className="absolute inset-0 bg-[radial-gradient(circle_at_52%_18%,rgba(14,165,233,0.18),transparent_36%),linear-gradient(90deg,rgba(2,7,18,0.46)_0%,rgba(2,7,18,0.03)_40%,rgba(2,7,18,0.28)_100%),linear-gradient(180deg,rgba(2,7,18,0.02)_0%,rgba(2,7,18,0.05)_42%,rgba(2,7,18,0.76)_100%)]" />
                <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.72),inset_0_1px_0_rgba(255,255,255,0.08)]" />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.42)_0%,transparent_18%,transparent_78%,rgba(0,0,0,0.38)_100%)]" />
                <div className="absolute inset-0 opacity-[0.12] [background:linear-gradient(90deg,rgba(255,255,255,.14)_1px,transparent_1px),linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:58px_58px]" />

                <div className="absolute left-6 top-6 z-20 flex items-center gap-3 rounded-2xl border border-white/12 bg-slate-950/58 px-4 py-3 shadow-2xl backdrop-blur-2xl">
                  <div className="relative h-10 w-10 overflow-hidden rounded-full bg-slate-700">
                    <Image
                      src="/workzo_recruiter_hero.png"
                      alt="Recruiter avatar"
                      fill
                      sizes="40px"
                      className="object-cover object-center"
                    />
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-slate-950 bg-emerald-400 [animation:workzoLivePulse_1.8s_ease-in-out_infinite]" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white">AI Recruiter</p>
                    <p className="text-xs text-slate-300">Senior Hiring Manager</p>
                  </div>
                </div>

                <div className="absolute right-6 top-6 z-20 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/12 bg-white/10 backdrop-blur-xl">
                  <Maximize2 className="h-5 w-5 text-white" />
                </div>

                <div className="absolute bottom-5 left-7 right-7 z-20 rounded-2xl border border-white/12 bg-slate-950/72 p-4 shadow-[0_22px_80px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl [animation:workzoGlassFloat_7s_ease-in-out_infinite]">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 [animation:workzoLivePulse_1.8s_ease-in-out_infinite]" />
                      <span className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200">
                        Live Interview
                      </span>
                    </div>
                    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold text-slate-300">
                      <Radio className="h-3 w-3 text-cyan-300" />
                      14:32
                    </div>
                  </div>

                  <p className="max-w-[620px] text-[16px] font-semibold leading-7 text-white">
                    <span className="mr-2 text-2xl leading-none text-blue-400">“</span>
                    Tell me about a time you solved a complex problem with
                    limited information.
                  </p>

                  <div className="mt-3 flex h-8 items-end gap-1 overflow-hidden">
                    {waveformHeights.map((height, index) => (
                      <span
                        key={index}
                        className="w-1.5 shrink-0 origin-bottom rounded-full bg-gradient-to-t from-indigo-500 via-blue-400 to-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.38)]"
                        style={{
                          height,
                          animation: `workzoPulseBar ${1.2 + (index % 5) * 0.12}s ease-in-out infinite`,
                          animationDelay: `${index * 0.035}s`,
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div className="absolute bottom-5 right-8 z-30 hidden items-center gap-2 rounded-full border border-orange-300/20 bg-orange-500/12 px-3 py-1.5 text-xs font-bold text-orange-100 backdrop-blur-xl lg:flex">
                  <Video className="h-3.5 w-3.5" />
                  Medium Pressure
                </div>

                <div className="absolute left-[49%] top-[27%] h-8 w-28 -translate-x-1/2 rounded-full bg-black/70 blur-xl opacity-0 [animation:workzoBlink_6s_ease-in-out_infinite]" />
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="shrink-0 pb-0">
          <div className="grid h-[104px] overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.035] shadow-[0_22px_80px_rgba(0,0,0,0.34)] backdrop-blur-2xl md:grid-cols-5">
            {featureCards.map((feature, index) => {
              const Icon = feature.icon;

              return (
                <div
                  key={feature.title}
                  className={`flex items-center gap-4 p-4 transition hover:bg-white/[0.035] ${
                    index !== featureCards.length - 1
                      ? "border-b border-white/10 md:border-b-0 md:border-r"
                      : ""
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-blue-400/22 bg-indigo-500/18 text-blue-100 shadow-[0_0_20px_rgba(79,70,229,0.13)]">
                    <Icon className="h-5 w-5" />
                  </div>

                  <div>
                    <h3 className="text-[14px] font-black leading-tight text-white">
                      {feature.title}
                    </h3>
                    <p className="mt-1 text-[12.5px] leading-5 text-slate-400">
                      {feature.text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
