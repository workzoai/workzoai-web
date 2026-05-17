"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Clock3,
  Mic,
  MicOff,
  PhoneOff,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";

type TranscriptItem = {
  role: "recruiter" | "candidate" | "system";
  text: string;
  time: string;
};

type InterviewMode = "standard" | "video";

type MobileInterviewRoomProps = {
  recruiterName: string;
  recruiterRole: string;
  recruiterImageSrc: string;
  question: string;
  status: string;
  isLive: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  recruiterState: string;
  recruiterTrust: number;
  selectedMode: InterviewMode;
  onSelectMode: (mode: InterviewMode) => void;
  elapsed: number;
  transcript: TranscriptItem[];
  onMicClick: () => void;
  onEndInterview: () => void;
  speakerOn: boolean;
  onToggleSpeaker: () => void;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatElapsed(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function mobileStateText(status: string, isSpeaking: boolean, isListening: boolean) {
  if (isSpeaking) return "Recruiter speaking";
  if (isListening) return "Listening to your answer";
  return status || "Ready when you are";
}

const waveform = [10, 22, 14, 28, 18, 34, 16, 26];

export default function MobileInterviewRoom({
  recruiterName,
  recruiterRole,
  recruiterImageSrc,
  question,
  status,
  isLive,
  isSpeaking,
  isListening,
  recruiterState,
  recruiterTrust,
  selectedMode,
  onSelectMode,
  elapsed,
  transcript,
  onMicClick,
  onEndInterview,
  speakerOn,
  onToggleSpeaker,
}: MobileInterviewRoomProps) {
  const latestRecruiterCaption =
    transcript
      .slice()
      .reverse()
      .find((item) => item.role === "recruiter")?.text || "";

  const progressStep = Math.min(
    12,
    Math.max(1, transcript.filter((item) => item.role === "candidate").length + 1),
  );

  const shortCaption =
    latestRecruiterCaption.length > 82
      ? `${latestRecruiterCaption.slice(0, 82)}...`
      : latestRecruiterCaption;

  const stateColor =
    recruiterTrust >= 68
      ? "from-emerald-400 via-cyan-300 to-blue-500"
      : recruiterTrust < 45
        ? "from-amber-300 via-orange-400 to-rose-500"
        : "from-sky-400 via-cyan-300 to-violet-500";

  return (
    <section className="relative min-h-[100svh] overflow-hidden bg-[#020617] px-4 pb-[calc(150px+env(safe-area-inset-bottom))] pt-[calc(14px+env(safe-area-inset-top))] text-white">
      <style>{`
        @keyframes wzMobileFloat { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-3px) scale(1.01); } }
        @keyframes wzMobileRing { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes wzMobileWave { 0%,100% { transform: scaleY(.55); opacity:.55; } 50% { transform: scaleY(1.15); opacity:1; } }
      `}</style>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(37,99,235,0.26),transparent_34%),linear-gradient(180deg,rgba(2,6,23,0.10),rgba(2,6,23,0.97))]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:radial-gradient(circle_at_center,white_0.7px,transparent_0.9px)] [background-size:4px_4px]" />

      <header className="relative z-20 flex items-center justify-between gap-3">
        <Link
          href="/dashboard"
          className="inline-flex h-10 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.05] px-4 text-[13px] font-bold text-slate-200 backdrop-blur-xl"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <div className="flex h-10 shrink-0 items-center rounded-full border border-white/[0.08] bg-white/[0.045] p-1 text-[11px] font-black text-slate-400 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => onSelectMode("standard")}
            className={cn(
              "h-8 rounded-full px-3 transition",
              selectedMode === "standard" ? "bg-blue-500/30 text-white" : "text-slate-400",
            )}
          >
            Standard
          </button>
          <button
            type="button"
            onClick={() => onSelectMode("video")}
            className={cn(
              "h-8 rounded-full px-3 transition",
              selectedMode === "video" ? "bg-violet-500/25 text-white" : "text-slate-400",
            )}
          >
            Live
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto mt-5 flex max-w-[440px] flex-col items-center">
        <div
          className="relative h-[238px] w-full max-w-[400px] overflow-hidden rounded-[38px] border border-blue-200/10 bg-white/[0.025] shadow-[0_0_70px_rgba(37,99,235,0.22)]"
          style={{ animation: "wzMobileFloat 5.8s ease-in-out infinite" }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(14,165,233,.25),transparent_48%)]" />
          <div
            className={cn(
              "absolute -inset-7 rounded-[48px] border-t-[3px] border-r-[3px] border-l-transparent border-b-transparent opacity-90",
              `bg-gradient-to-r ${stateColor}`,
            )}
            style={{ animation: "wzMobileRing 30s linear infinite" }}
          />
          <img
            src={recruiterImageSrc}
            alt={`${recruiterName} recruiter`}
            className={cn(
              "relative z-10 h-full w-full object-cover object-center transition duration-700",
              isSpeaking ? "scale-[1.04] saturate-110" : "scale-[1.01]",
            )}
          />
          <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[#020617]/80 to-transparent p-4">
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-black text-emerald-200 backdrop-blur-xl">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              <span className="truncate">{recruiterName} · {recruiterRole}</span>
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2 text-center text-[14px] font-semibold text-slate-300">
          <Clock3 className="h-4 w-4 text-sky-400" />
          <span>{mobileStateText(status, isSpeaking, isListening)}</span>
        </div>

        <div className="mt-4 flex h-[28px] items-end justify-center gap-[8px]" aria-hidden="true">
          {waveform.map((height, index) => (
            <span
              key={index}
              className={cn(
                "w-[7px] rounded-full bg-gradient-to-t shadow-[0_0_16px_rgba(56,189,248,0.45)]",
                isListening
                  ? "from-emerald-500 via-cyan-300 to-blue-400"
                  : "from-blue-500 via-cyan-300 to-violet-400",
              )}
              style={{
                height: Math.max(8, height * (isLive || isSpeaking ? 0.82 : 0.58)),
                animation: `wzMobileWave ${0.9 + index * 0.06}s ease-in-out infinite`,
                animationDelay: `${index * 0.055}s`,
              }}
            />
          ))}
        </div>

        {shortCaption ? (
          <div className="mt-4 max-w-full rounded-full border border-white/[0.04] bg-white/[0.035] px-4 py-2 text-center text-[12px] font-medium leading-5 text-slate-400 backdrop-blur-xl">
            {shortCaption}
          </div>
        ) : null}

        <section className="mt-5 w-full rounded-[26px] border border-white/[0.07] bg-[#07111f]/90 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.26)] backdrop-blur-xl">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-300/85">
            Current Question
          </p>
          <h1 className="mt-3 text-[25px] font-black leading-[1.09] tracking-[-0.03em] text-white">
            {question}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px] font-semibold text-slate-400">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-3 py-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Answer naturally
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-3 py-1.5">
              <Clock3 className="h-3.5 w-3.5" />
              {formatElapsed(elapsed)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-3 py-1.5">
              Q {progressStep}/12
            </span>
          </div>
        </section>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.06] bg-[#020617]/88 px-4 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[440px] items-center justify-between gap-3">
          <button
            type="button"
            onClick={onToggleSpeaker}
            className="grid h-12 w-12 place-items-center rounded-full border border-white/[0.08] bg-white/[0.05] text-slate-200"
            aria-label="Toggle speaker"
          >
            {speakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>

          <button
            type="button"
            onClick={onMicClick}
            className={cn(
              "grid h-[82px] w-[82px] place-items-center rounded-full border text-white shadow-[0_0_55px_rgba(59,130,246,0.38)] transition active:scale-95",
              isLive
                ? "border-emerald-300/40 bg-emerald-500/15"
                : "border-cyan-200/25 bg-blue-500/20",
            )}
            aria-label={isLive ? "Continue interview" : "Start interview"}
          >
            <span className="grid h-[64px] w-[64px] place-items-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
              {isLive && isListening ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
            </span>
          </button>

          <button
            type="button"
            onClick={onEndInterview}
            className="grid h-12 w-12 place-items-center rounded-full border border-red-300/15 bg-red-500/10 text-red-200"
            aria-label="End interview"
          >
            <PhoneOff className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-center text-[12px] font-medium text-slate-400">
          {isListening
            ? "Listening — finish your answer naturally"
            : isSpeaking
              ? "Recruiter speaking"
              : isLive
                ? "Tap mic when you are ready"
                : "Tap mic to start interview"}
        </p>
      </footer>
    </section>
  );
}
