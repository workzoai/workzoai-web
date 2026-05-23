"use client";

import Link from "next/link";
import RecruiterPresence from "@/components/interview/RecruiterPresence";
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

import { cn } from "./uiHelpers";

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

function recruiterMoodLabel(recruiterState: string, recruiterTrust: number) {
  const state = recruiterState.toLowerCase();

  if (state.includes("press") || state.includes("skept") || recruiterTrust < 48) {
    return "Recruiter is testing proof";
  }

  if (state.includes("recover")) return "Recovery window open";
  if (state.includes("engaged") || state.includes("interested") || recruiterTrust >= 70) {
    return "Recruiter is engaged";
  }

  return "Listening for evidence";
}

function recruiterMoodClasses(recruiterState: string, recruiterTrust: number) {
  const state = recruiterState.toLowerCase();

  if (state.includes("press") || state.includes("skept") || recruiterTrust < 48) {
    return {
      gradient: "from-orange-400/20 via-rose-500/10 to-red-500/20",
      border: "border-orange-300/18",
      text: "text-orange-100",
      dot: "bg-orange-300 shadow-[0_0_18px_rgba(251,146,60,0.55)]",
      wave: "from-orange-400 via-rose-300 to-red-400",
    };
  }

  if (state.includes("recover")) {
    return {
      gradient: "from-cyan-400/20 via-sky-400/10 to-blue-500/20",
      border: "border-cyan-300/18",
      text: "text-cyan-100",
      dot: "bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.55)]",
      wave: "from-cyan-400 via-sky-300 to-blue-400",
    };
  }

  if (state.includes("engaged") || state.includes("interested") || recruiterTrust >= 70) {
    return {
      gradient: "from-emerald-400/20 via-cyan-400/10 to-blue-500/20",
      border: "border-emerald-300/18",
      text: "text-emerald-100",
      dot: "bg-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.55)]",
      wave: "from-emerald-400 via-cyan-300 to-blue-400",
    };
  }

  return {
    gradient: "from-blue-500/20 via-cyan-400/10 to-violet-500/20",
    border: "border-blue-200/12",
    text: "text-sky-100",
    dot: "bg-sky-300 shadow-[0_0_18px_rgba(125,211,252,0.55)]",
    wave: "from-blue-500 via-cyan-300 to-violet-400",
  };
}

const waveform = [10, 22, 14, 28, 18, 34, 16, 26, 12, 30];

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
    latestRecruiterCaption.length > 118
      ? `${latestRecruiterCaption.slice(0, 118)}...`
      : latestRecruiterCaption;

  const mood = recruiterMoodClasses(recruiterState, recruiterTrust);
  const stateText = mobileStateText(status, isSpeaking, isListening);
  const moodLabel = recruiterMoodLabel(recruiterState, recruiterTrust);

  return (
    <section className="relative min-h-[100svh] overflow-hidden bg-[#020617] px-3 pb-[calc(130px+env(safe-area-inset-bottom))] pt-[calc(12px+env(safe-area-inset-top))] text-white sm:px-5 md:px-6 md:pb-[calc(112px+env(safe-area-inset-bottom))] md:pt-[calc(18px+env(safe-area-inset-top))] lg:px-8">
      <style>{`
        @keyframes wzMobileFloat {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-3px) scale(1.006); }
        }
        @keyframes wzMobileWave {
          0%, 100% { transform: scaleY(.50); opacity: .50; }
          50% { transform: scaleY(1.18); opacity: 1; }
        }
        @keyframes wzSoftScan {
          0% { transform: translateX(-130%) rotate(10deg); opacity: 0; }
          32% { opacity: .18; }
          68% { opacity: .22; }
          100% { transform: translateX(130%) rotate(10deg); opacity: 0; }
        }
        @keyframes wzFooterPulse {
          0%, 100% { box-shadow: 0 0 42px rgba(59,130,246,.24); }
          50% { box-shadow: 0 0 72px rgba(34,211,238,.34); }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(37,99,235,0.22),transparent_33%),radial-gradient(circle_at_15%_70%,rgba(14,165,233,0.10),transparent_30%),linear-gradient(180deg,rgba(2,6,23,0.04),rgba(2,6,23,0.98))]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.045] [background-image:radial-gradient(circle_at_center,white_0.7px,transparent_0.9px)] [background-size:4px_4px]" />

      <div className="relative z-20 mx-auto flex max-w-[1040px] items-center justify-between gap-3">
        <Link
          href="/dashboard"
          className="inline-flex h-10 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.05] px-3.5 text-[13px] font-bold text-slate-200 backdrop-blur-xl transition active:scale-95 sm:px-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <div className="flex h-10 shrink-0 items-center rounded-full border border-white/[0.08] bg-white/[0.045] p-1 text-[11px] font-black text-slate-400 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => onSelectMode("standard")}
            className={cn(
              "h-8 rounded-full px-3 transition active:scale-95",
              selectedMode === "standard" ? "bg-blue-500/30 text-white" : "text-slate-400",
            )}
          >
            Standard
          </button>
          <button
            type="button"
            onClick={() => onSelectMode("video")}
            className={cn(
              "h-8 rounded-full px-3 transition active:scale-95",
              selectedMode === "video" ? "bg-violet-500/25 text-white" : "text-slate-400",
            )}
          >
            Live
          </button>
        </div>
      </div>

      <main className="relative z-10 mx-auto mt-4 grid max-w-[1040px] gap-4 md:mt-6 md:min-h-[calc(100svh-170px)] md:grid-cols-[minmax(300px,0.9fr)_minmax(340px,1.1fr)] md:items-center md:gap-5 lg:gap-7">
        <section className="flex min-w-0 flex-col items-center md:items-stretch">
          <div
            className={cn(
              "relative h-[218px] w-full max-w-[410px] overflow-hidden rounded-[32px] border bg-white/[0.025] shadow-[0_0_58px_rgba(37,99,235,0.18)] sm:h-[250px] md:h-[430px] md:max-w-none md:rounded-[36px] lg:h-[500px]",
              mood.border,
            )}
            style={{ animation: "wzMobileFloat 6.2s ease-in-out infinite" }}
          >
            <div className={cn("absolute inset-0 bg-gradient-to-br", mood.gradient)} />
            <div className="absolute inset-x-[-45%] top-0 h-full bg-gradient-to-r from-transparent via-white/[0.10] to-transparent" style={{ animation: "wzSoftScan 8s ease-in-out infinite" }} />

            <RecruiterPresence
              recruiterName={recruiterName}
              recruiterRole={recruiterRole}
              imageSrc={recruiterImageSrc}
              isSpeaking={isSpeaking}
              isListening={isListening}
            />

            <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[#020617]/88 via-[#020617]/42 to-transparent p-3.5 sm:p-4">
              <div className={cn("inline-flex max-w-full items-center gap-2 rounded-full border bg-black/22 px-3 py-1.5 text-xs font-black backdrop-blur-xl", mood.border, mood.text)}>
                <span className={cn("h-2 w-2 shrink-0 rounded-full", mood.dot)} />
                <span className="truncate">{recruiterName} · {recruiterRole}</span>
              </div>
            </div>
          </div>

          <div className="mt-3 flex w-full max-w-[410px] items-center justify-between gap-3 rounded-2xl border border-white/[0.055] bg-white/[0.035] px-3 py-2.5 text-xs font-bold text-slate-300 backdrop-blur-xl md:max-w-none">
            <div className="flex min-w-0 items-center gap-2">
              <Clock3 className="h-4 w-4 shrink-0 text-sky-300" />
              <span className="truncate">{stateText}</span>
            </div>
            <span className={cn("shrink-0 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]", mood.border, mood.text)}>
              {isSpeaking ? "Live" : isListening ? "Listening" : "Ready"}
            </span>
          </div>

          <div className="mt-3 flex h-[24px] items-end justify-center gap-[7px] md:h-[30px]" aria-hidden="true">
            {waveform.map((height, index) => (
              <span
                key={index}
                className={cn(
                  "w-[5px] rounded-full bg-gradient-to-t shadow-[0_0_14px_rgba(56,189,248,0.36)] md:w-[6px]",
                  mood.wave,
                )}
                style={{
                  height: Math.max(8, height * (isLive || isSpeaking || isListening ? 0.9 : 0.5)),
                  animation: `wzMobileWave ${0.92 + index * 0.055}s ease-in-out infinite`,
                  animationDelay: `${index * 0.055}s`,
                }}
              />
            ))}
          </div>

          {shortCaption ? (
            <div className="mt-3 w-full max-w-[410px] rounded-2xl border border-white/[0.05] bg-white/[0.035] px-3.5 py-2.5 text-center text-[12px] font-medium leading-5 text-slate-400 backdrop-blur-xl md:max-w-none md:text-left">
              {shortCaption}
            </div>
          ) : null}
        </section>

        <section className="flex min-w-0 flex-col gap-3 md:gap-4">
          <div className="rounded-[26px] border border-white/[0.07] bg-[#07111f]/86 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.24)] backdrop-blur-xl sm:p-5 md:rounded-[30px] md:p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-300/85">
                Current Question
              </p>
              <span className="rounded-full border border-white/[0.06] bg-white/[0.04] px-2.5 py-1 text-[11px] font-black text-slate-300">
                Q {progressStep}/12
              </span>
            </div>

            <h1 className="mt-3 text-[23px] font-black leading-[1.08] tracking-[-0.035em] text-white sm:text-[26px] md:text-[34px] md:leading-[1.03] lg:text-[40px]">
              {question}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px] font-semibold text-slate-400 md:mt-5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.05] bg-white/[0.04] px-3 py-1.5">
                <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
                Answer naturally
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.05] bg-white/[0.04] px-3 py-1.5">
                <Clock3 className="h-3.5 w-3.5 text-sky-300" />
                {formatElapsed(elapsed)}
              </span>
              <span className={cn("inline-flex items-center gap-1.5 rounded-full border bg-white/[0.04] px-3 py-1.5", mood.border, mood.text)}>
                {moodLabel}
              </span>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/[0.055] bg-white/[0.035] p-3.5 backdrop-blur-xl sm:p-4 md:p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-black uppercase tracking-[0.20em] text-slate-500">
                Live guidance
              </p>
              <span className="text-[11px] font-bold text-slate-500">
                {recruiterTrust}/100 trust
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-300 md:text-[15px]">
              {recruiterTrust < 50
                ? "Keep your next answer specific: situation, your action, and measurable result."
                : recruiterTrust >= 72
                  ? "Good momentum. Keep answers concrete and connect every point to role impact."
                  : "Stay focused. Give one clear example and avoid broad claims."}
            </p>
          </div>
        </section>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.06] bg-[#020617]/88 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-2xl md:px-6 md:pb-[calc(14px+env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-[520px] items-center justify-between gap-3 md:max-w-[720px]">
          <button
            type="button"
            onClick={onToggleSpeaker}
            className="grid h-11 w-11 place-items-center rounded-full border border-white/[0.08] bg-white/[0.05] text-slate-200 transition active:scale-95 md:h-12 md:w-12"
            aria-label="Toggle speaker"
          >
            {speakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>

          <div className="flex min-w-0 flex-1 flex-col items-center">
            <button
              type="button"
              onClick={onMicClick}
              className={cn(
                "grid h-[74px] w-[74px] place-items-center rounded-full border text-white shadow-[0_0_46px_rgba(59,130,246,0.32)] transition active:scale-95 md:h-[78px] md:w-[78px]",
                isLive
                  ? "border-emerald-300/40 bg-emerald-500/15"
                  : "border-cyan-200/25 bg-blue-500/20",
              )}
              style={isSpeaking || isListening ? { animation: "wzFooterPulse 2.2s ease-in-out infinite" } : undefined}
              aria-label={isLive ? "Continue interview" : "Start interview"}
            >
              <span className="grid h-[58px] w-[58px] place-items-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] md:h-[62px] md:w-[62px]">
                {isLive && isListening ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
              </span>
            </button>
            <p className="mt-2 max-w-[260px] truncate text-center text-[12px] font-medium text-slate-400 md:max-w-none">
              {isListening
                ? "Listening — finish your answer naturally"
                : isSpeaking
                  ? "Recruiter speaking"
                  : isLive
                    ? "Tap mic when you are ready"
                    : "Tap mic to start interview"}
            </p>
          </div>

          <button
            type="button"
            onClick={onEndInterview}
            className="grid h-11 w-11 place-items-center rounded-full border border-red-300/15 bg-red-500/10 text-red-200 transition active:scale-95 md:h-12 md:w-12"
            aria-label="End interview"
          >
            <PhoneOff className="h-5 w-5" />
          </button>
        </div>
      </footer>
    </section>
  );
}
