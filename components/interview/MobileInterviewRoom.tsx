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

function normalizeState(state: string) {
  return state.toLowerCase().replace(/\s+/g, "_");
}

function recruiterStateLabel(state: string, trust: number) {
  const normalized = normalizeState(state);

  if (normalized.includes("pressuring") || normalized.includes("skeptical") || trust < 48) {
    return "Recruiter needs proof";
  }

  if (normalized.includes("recovering") || trust < 62) {
    return "Recovery window";
  }

  if (normalized.includes("engaged") || normalized.includes("interested") || trust >= 72) {
    return "Recruiter engaged";
  }

  return "Listening for evidence";
}

const waveform = [10, 22, 14, 28, 18, 34, 16, 26, 12, 30, 18, 24];

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
    latestRecruiterCaption.length > 120
      ? `${latestRecruiterCaption.slice(0, 120)}...`
      : latestRecruiterCaption;

  const trustLabel = recruiterStateLabel(recruiterState, recruiterTrust);

  const stateColor =
    recruiterTrust >= 68
      ? "from-success via-brand to-brand"
      : recruiterTrust < 45
        ? "from-warning via-warning to-danger"
        : "from-brand via-brand to-brand";

  const signalTone =
    recruiterTrust >= 68
      ? "text-success border-success/20 bg-success/10"
      : recruiterTrust < 45
        ? "text-warning border-warning/20 bg-warning/10"
        : "text-brand border-brand/20 bg-brand/10";

  return (
    <section className="relative min-h-[100svh] overflow-x-hidden overflow-y-auto bg-canvas px-4 pb-[calc(132px+env(safe-area-inset-bottom))] pt-[calc(14px+env(safe-area-inset-top))] text-fg md:px-6 md:pb-[calc(112px+env(safe-area-inset-bottom))] lg:px-8">
      <style>{`
        @keyframes wzMobileFloat { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-3px) scale(1.01); } }
        @keyframes wzMobileRing { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes wzMobileWave { 0%,100% { transform: scaleY(.52); opacity:.52; } 50% { transform: scaleY(1.18); opacity:1; } }
        @keyframes wzMobileBlink { 0%,88%,100% { opacity:0; transform: translateX(-50%) scaleY(.2); } 90% { opacity:.34; transform: translateX(-50%) scaleY(1); } 91% { opacity:0; transform: translateX(-50%) scaleY(.2); } }
        @keyframes wzMobileAura { 0%,100% { opacity:.20; transform:scale(.96); } 50% { opacity:.48; transform:scale(1.04); } }
      `}</style>

      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(37,99,235,0.24),transparent_34%),linear-gradient(180deg,rgba(2,6,23,0.10),rgba(2,6,23,0.97))]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.045] [background-image:radial-gradient(circle_at_center,white_0.7px,transparent_0.9px)] [background-size:4px_4px]" />

      <header className="relative z-20 mx-auto flex max-w-[1120px] items-center justify-between gap-3">
        <Link
          href="/dashboard"
          className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-fg/[0.055] px-4 text-[13px] font-bold text-fg shadow-[0_10px_35px_rgba(0,0,0,0.22)] backdrop-blur-xl transition hover:bg-fg/[0.08]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <div className="flex h-10 shrink-0 items-center rounded-full border border-line bg-fg/[0.045] p-1 text-[11px] font-black text-muted shadow-[0_10px_35px_rgba(0,0,0,0.22)] backdrop-blur-xl">
          <button
            type="button"
            onClick={() => onSelectMode("standard")}
            className={cn(
              "h-8 rounded-full px-3 transition",
              selectedMode === "standard" ? "bg-brand/30 text-on-brand" : "text-muted",
            )}
          >
            Standard
          </button>
          <button
            type="button"
            onClick={() => onSelectMode("video")}
            className={cn(
              "h-8 rounded-full px-3 transition",
              selectedMode === "video" ? "bg-brand/25 text-on-brand" : "text-muted",
            )}
          >
            Live
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto mt-4 grid max-w-[1120px] gap-4 md:mt-5 md:grid-cols-[0.92fr_1.08fr] md:items-start lg:gap-5">
        <section className="flex min-w-0 flex-col items-center md:sticky md:top-5">
          <div
            className="relative h-[236px] w-full max-w-[420px] overflow-hidden rounded-[34px] border border-brand/10 bg-fg/[0.025] shadow-[0_0_64px_rgba(37,99,235,0.22)] md:h-[420px] md:max-w-none lg:h-[460px]"
            style={{ animation: "wzMobileFloat 5.8s ease-in-out infinite" }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(14,165,233,.24),transparent_48%)]" />
            <div
              className={cn(
                "absolute -inset-7 rounded-[48px] border-t-[3px] border-r-[3px] border-l-transparent border-b-transparent opacity-80",
                `bg-gradient-to-r ${stateColor}`,
              )}
              style={{ animation: "wzMobileRing 34s linear infinite" }}
            />
            <div
              className={cn(
                "pointer-events-none absolute inset-5 z-20 rounded-[30px] bg-brand/10 blur-2xl",
                isSpeaking && "bg-brand/20",
                isListening && "bg-success/14",
              )}
              style={{ animation: isSpeaking || isListening ? "wzMobileAura 2.2s ease-in-out infinite" : undefined }}
            />
            <img
              src={recruiterImageSrc}
              alt={`${recruiterName} recruiter`}
              className={cn(
                "relative z-10 h-full w-full object-cover object-center transition duration-700",
                isSpeaking ? "scale-[1.045] saturate-110 brightness-110" : "scale-[1.015]",
                isListening && "brightness-105",
              )}
            />
            <span className="wz-mobile-blink pointer-events-none absolute left-1/2 top-[32%] z-30 h-[18px] w-[118px] rounded-full bg-canvas/55 blur-[2px]" style={{ animation: "wzMobileBlink 5.7s ease-in-out infinite" }} />

            <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-canvas/88 via-canvas/45 to-transparent p-4 md:p-5">
              <div className={cn("inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black backdrop-blur-xl", signalTone)}>
                <span className="h-2 w-2 rounded-full bg-current shadow-[0_0_14px_currentColor]" />
                <span className="truncate">{recruiterName} · {recruiterRole}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-center text-[14px] font-semibold text-muted md:mt-4">
            <Clock3 className="h-4 w-4 text-brand" />
            <span>{mobileStateText(status, isSpeaking, isListening)}</span>
          </div>

          <div className="mt-3 flex h-[30px] items-end justify-center gap-[7px]" aria-hidden="true">
            {waveform.map((height, index) => (
              <span
                key={index}
                className={cn(
                  "w-[6px] rounded-full bg-gradient-to-t shadow-[0_0_14px_rgba(56,189,248,0.42)] md:w-[7px]",
                  isListening
                    ? "from-success via-brand to-brand"
                    : "from-brand via-brand to-brand",
                )}
                style={{
                  height: Math.max(8, height * (isLive || isSpeaking ? 0.82 : 0.58)),
                  animation: `wzMobileWave ${0.9 + index * 0.05}s ease-in-out infinite`,
                  animationDelay: `${index * 0.05}s`,
                }}
              />
            ))}
          </div>
        </section>

        <section className="min-w-0 space-y-4">
          <div className="rounded-[26px] border border-line bg-canvas/90 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.26)] backdrop-blur-xl md:p-5 lg:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-brand/85">
                  Current Question
                </p>
                <h1 className="mt-3 text-[24px] font-black leading-[1.08] tracking-[-0.03em] text-fg md:text-[30px] lg:text-[34px]">
                  {question}
                </h1>
              </div>
              <div className="hidden shrink-0 rounded-lg border border-line bg-fg/[0.045] px-3 py-2 text-right md:block">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-subtle">Trust</p>
                <p className="mt-1 text-xl font-black text-fg">{recruiterTrust}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px] font-semibold text-muted">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-fg/[0.04] px-3 py-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Answer naturally
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-fg/[0.04] px-3 py-1.5">
                <Clock3 className="h-3.5 w-3.5" />
                {formatElapsed(elapsed)}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-fg/[0.04] px-3 py-1.5">
                Q {progressStep}/12
              </span>
              <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5", signalTone)}>
                {trustLabel}
              </span>
            </div>
          </div>

          {shortCaption ? (
            <div className="rounded-[24px] border border-line bg-fg/[0.035] p-4 text-[13px] font-medium leading-6 text-muted shadow-[0_14px_45px_rgba(0,0,0,0.22)] backdrop-blur-xl md:p-5 md:text-[14px]">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-subtle">Live recruiter caption</p>
              {shortCaption}
            </div>
          ) : null}

          <div className="hidden rounded-[24px] border border-line bg-fg/[0.03] p-4 shadow-[0_14px_45px_rgba(0,0,0,0.20)] backdrop-blur-xl md:block">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg bg-fg/[0.04] p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-subtle">Mode</p>
                <p className="mt-1 font-black text-fg">{selectedMode === "video" ? "Live" : "Standard"}</p>
              </div>
              <div className="rounded-lg bg-fg/[0.04] p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-subtle">State</p>
                <p className="mt-1 font-black text-fg">{isSpeaking ? "Speaking" : isListening ? "Listening" : "Ready"}</p>
              </div>
              <div className="rounded-lg bg-fg/[0.04] p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-subtle">Signal</p>
                <p className="mt-1 font-black text-fg">{recruiterTrust >= 68 ? "Good" : recruiterTrust < 45 ? "Pressure" : "Testing"}</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/90 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 shadow-[0_-20px_70px_rgba(0,0,0,0.35)] backdrop-blur-2xl md:px-6 md:pb-[calc(12px+env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-[520px] items-center justify-between gap-3 md:max-w-[760px]">
          <button
            type="button"
            onClick={onToggleSpeaker}
            className="grid h-12 w-12 place-items-center rounded-full border border-line bg-fg/[0.05] text-fg transition active:scale-95 md:h-11 md:w-11"
            aria-label="Toggle speaker"
          >
            {speakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>

          <button
            type="button"
            onClick={onMicClick}
            className={cn(
              "grid h-[78px] w-[78px] place-items-center rounded-full border text-fg shadow-[0_0_50px_rgba(59,130,246,0.34)] transition active:scale-95 md:h-[70px] md:w-[70px]",
              isLive
                ? "border-success/40 bg-success/15"
                : "border-brand/25 bg-brand/20",
            )}
            aria-label={isLive ? "Continue interview" : "Start interview"}
          >
            <span className="grid h-[62px] w-[62px] place-items-center rounded-full bg-gradient-to-br from-brand to-brand shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] md:h-[54px] md:w-[54px]">
              {isLive && isListening ? <MicOff className="h-8 w-8 md:h-7 md:w-7" /> : <Mic className="h-8 w-8 md:h-7 md:w-7" />}
            </span>
          </button>

          <button
            type="button"
            onClick={onEndInterview}
            className="grid h-12 w-12 place-items-center rounded-full border border-danger/15 bg-danger/10 text-danger transition active:scale-95 md:h-11 md:w-11"
            aria-label="End interview"
          >
            <PhoneOff className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-center text-[12px] font-medium text-muted">
          {isListening
            ? "Listening, finish your answer naturally"
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
