"use client";

import Image from "next/image";
import { Brain, Mic2, Pause, Radio, Sparkles, Zap } from "lucide-react";
import { cn } from "./uiHelpers";

export type RecruiterPresenceState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "skeptical"
  | "interested"
  | "interrupting"
  | "typing_notes"
  | "recovering_connection";

export type RecruiterPresenceMood =
  | "neutral"
  | "warm"
  | "interested"
  | "skeptical"
  | "pressuring"
  | "impressed"
  | "recovering";

type RecruiterPresenceProps = {
  recruiterName: string;
  recruiterRole?: string;
  imageSrc: string;
  state?: RecruiterPresenceState;
  mood?: RecruiterPresenceMood;
  trust?: number;
  interest?: number;
  pressure?: number;
  caption?: string;
  isSpeaking?: boolean;
  isListening?: boolean;
  className?: string;
};

const waveform = [14, 26, 18, 34, 22, 42, 28, 36, 18, 30, 24, 38];

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function getVisualState({
  state,
  isSpeaking,
  isListening,
}: {
  state?: RecruiterPresenceState;
  isSpeaking?: boolean;
  isListening?: boolean;
}): RecruiterPresenceState {
  if (state) return state;
  if (isSpeaking) return "speaking";
  if (isListening) return "listening";
  return "idle";
}

function getStateCopy(state: RecruiterPresenceState, mood: RecruiterPresenceMood) {
  if (state === "speaking") return "Recruiter speaking";
  if (state === "listening") return "Listening closely";
  if (state === "thinking") return "Thinking pause";
  if (state === "skeptical") return "Checking for proof";
  if (state === "interested") return "Interest rising";
  if (state === "interrupting") return "About to interrupt";
  if (state === "typing_notes") return "Typing notes";
  if (state === "recovering_connection") return "Reconnecting";
  if (mood === "pressuring") return "Pressure rising";
  if (mood === "impressed") return "Strong signal";
  return "Ready";
}

function getMoodStyles(mood: RecruiterPresenceMood, state: RecruiterPresenceState) {
  if (state === "recovering_connection") {
    return {
      aura: "from-warning/24 via-warning/12 to-transparent",
      ring: "border-warning/28 shadow-[0_0_70px_rgba(251,191,36,0.16)]",
      chip: "border-warning/20 bg-warning/10 text-warning",
      dot: "bg-warning shadow-[0_0_18px_rgba(251,191,36,.75)]",
      bar: "from-warning via-warning to-danger",
    };
  }

  if (state === "interrupting" || mood === "pressuring") {
    return {
      aura: "from-danger/24 via-warning/12 to-transparent",
      ring: "border-danger/24 shadow-[0_0_80px_rgba(244,63,94,0.18)]",
      chip: "border-danger/20 bg-danger/10 text-danger",
      dot: "bg-danger shadow-[0_0_18px_rgba(251,113,133,.75)]",
      bar: "from-danger via-warning to-warning",
    };
  }

  if (state === "skeptical" || mood === "skeptical") {
    return {
      aura: "from-brand/22 via-brand/10 to-transparent",
      ring: "border-brand/22 shadow-[0_0_76px_rgba(37, 99, 235,0.17)]",
      chip: "border-brand/18 bg-brand/10 text-brand",
      dot: "bg-brand shadow-[0_0_18px_rgba(167,139,250,.70)]",
      bar: "from-brand via-brand to-brand",
    };
  }

  if (state === "interested" || mood === "interested" || mood === "impressed") {
    return {
      aura: "from-success/22 via-brand/14 to-transparent",
      ring: "border-success/22 shadow-[0_0_80px_rgba(16,185,129,0.18)]",
      chip: "border-success/20 bg-success/10 text-success",
      dot: "bg-success shadow-[0_0_18px_rgba(52,211,153,.80)]",
      bar: "from-success via-brand to-brand",
    };
  }

  return {
    aura: "from-brand/22 via-brand/10 to-transparent",
    ring: "border-brand/18 shadow-[0_0_76px_rgba(37,99,235,0.18)]",
    chip: "border-brand/18 bg-brand/8 text-brand",
    dot: "bg-brand shadow-[0_0_18px_rgba(37, 99, 235,.75)]",
    bar: "from-brand via-brand to-brand",
  };
}

function getCaption(state: RecruiterPresenceState, mood: RecruiterPresenceMood, caption?: string) {
  if (caption) return caption;
  if (state === "interrupting") return "Hold on — the recruiter is ready to challenge that answer.";
  if (state === "skeptical") return "Looking for proof, ownership, and measurable impact.";
  if (state === "thinking") return "Brief pause while the recruiter evaluates your answer.";
  if (state === "typing_notes") return "Saving notes about clarity, confidence, and role fit.";
  if (state === "listening") return "Speak naturally. The recruiter is listening for specifics.";
  if (state === "speaking") return "The recruiter is responding. Listen for the follow-up.";
  if (state === "recovering_connection") return "Connection is recovering. The visual room stays ready.";
  if (mood === "impressed") return "Strong answer signal detected. Keep the evidence specific.";
  return "Answer like this is a real recruiter conversation.";
}

export default function RecruiterPresence({
  recruiterName,
  recruiterRole = "AI Recruiter",
  imageSrc,
  state,
  mood = "neutral",
  trust = 68,
  interest = 62,
  pressure = 42,
  caption,
  isSpeaking,
  isListening,
  className,
}: RecruiterPresenceProps) {
  const visualState = getVisualState({ state, isSpeaking, isListening });
  const styles = getMoodStyles(mood, visualState);
  const trustValue = clamp(trust);
  const interestValue = clamp(interest);
  const pressureValue = clamp(pressure);
  const isActiveSpeaking = visualState === "speaking" || Boolean(isSpeaking);
  const isActiveListening = visualState === "listening" || Boolean(isListening);
  const stateCopy = getStateCopy(visualState, mood);
  const recruiterCaption = getCaption(visualState, mood, caption);

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[34px] border border-line bg-canvas/88 p-4 text-fg shadow-[0_28px_100px_rgba(0,0,0,0.34)] backdrop-blur-2xl",
        className,
      )}
    >
      <style>{`
        @keyframes wzPresenceBreath {
          0%, 100% { transform: scale(1.015) translateY(0) rotate(-0.08deg); filter: brightness(1.03) contrast(1.05) saturate(1.04); }
          48% { transform: scale(1.045) translateY(-5px) rotate(0.10deg); filter: brightness(1.12) contrast(1.08) saturate(1.10); }
        }
        @keyframes wzPresenceSpeak {
          0%, 100% { transform: scale(1.035) translateY(0) rotate(-0.10deg); filter: brightness(1.14) contrast(1.08) saturate(1.12); }
          38% { transform: scale(1.072) translateY(-6px) rotate(0.12deg); filter: brightness(1.30) contrast(1.13) saturate(1.22); }
          72% { transform: scale(1.048) translateY(-2px) rotate(0deg); }
        }
        @keyframes wzPresenceListen {
          0%, 100% { transform: scale(1.018) translateY(0); filter: brightness(1.05) contrast(1.06); }
          52% { transform: scale(1.052) translateY(-5px); filter: brightness(1.15) contrast(1.10); }
        }
        @keyframes wzPresenceThink {
          0%, 100% { transform: scale(1.020) translateX(0) rotate(-0.08deg); filter: brightness(.98) contrast(1.08) saturate(.98); }
          35% { transform: scale(1.034) translateX(-3px) rotate(-0.18deg); }
          70% { transform: scale(1.032) translateX(3px) rotate(0.14deg); }
        }
        @keyframes wzBlink {
          0%, 88%, 100% { opacity: 0; transform: translateX(-50%) scaleY(.10); }
          89% { opacity: .30; transform: translateX(-50%) scaleY(1); }
          90% { opacity: 0; transform: translateX(-50%) scaleY(.10); }
          96% { opacity: .18; transform: translateX(-50%) scaleY(.72); }
          97% { opacity: 0; transform: translateX(-50%) scaleY(.10); }
        }
        @keyframes wzEyeShift {
          0%, 100% { transform: translateX(-50%) translateY(0); opacity: .08; }
          38% { transform: translateX(calc(-50% - 8px)) translateY(-1px); opacity: .16; }
          68% { transform: translateX(calc(-50% + 7px)) translateY(1px); opacity: .13; }
        }
        @keyframes wzPresenceAura {
          0%, 100% { opacity: .34; transform: scale(.96); }
          50% { opacity: .78; transform: scale(1.08); }
        }
        @keyframes wzHaloRotate {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes wzWave {
          0%, 100% { transform: scaleY(.46); opacity: .50; }
          42% { transform: scaleY(1.36); opacity: 1; }
          76% { transform: scaleY(.82); opacity: .82; }
        }
        @keyframes wzWaveSpeak {
          0%, 100% { transform: scaleY(.72); opacity: .70; }
          38% { transform: scaleY(1.95); opacity: 1; }
          70% { transform: scaleY(1.15); opacity: .92; }
        }
        @keyframes wzThinkingDots {
          0%, 20% { opacity: .25; transform: translateY(0); }
          45% { opacity: 1; transform: translateY(-2px); }
          70%, 100% { opacity: .35; transform: translateY(0); }
        }
        @keyframes wzNoteLine {
          0% { transform: translateX(-20%); opacity: .12; }
          45% { opacity: .75; }
          100% { transform: translateX(105%); opacity: .10; }
        }
        .wz-presence-image { animation: wzPresenceBreath 5.8s ease-in-out infinite; }
        .wz-presence-speaking { animation: wzPresenceSpeak 1.75s ease-in-out infinite; }
        .wz-presence-listening { animation: wzPresenceListen 3.2s ease-in-out infinite; }
        .wz-presence-thinking { animation: wzPresenceThink 4.6s ease-in-out infinite; }
        .wz-presence-aura { animation: wzPresenceAura 4.3s ease-in-out infinite; }
        .wz-presence-halo { animation: wzHaloRotate 24s linear infinite; }
        .wz-blink { animation: wzBlink 5.7s ease-in-out infinite; }
        .wz-eye-shift { animation: wzEyeShift 7.4s ease-in-out infinite; }
        .wz-wave { animation: wzWave 1.35s ease-in-out infinite; transform-origin: bottom; }
        .wz-wave-speaking { animation-name: wzWaveSpeak; animation-duration: .82s; }
        .wz-wave:nth-child(2) { animation-delay: .07s; }
        .wz-wave:nth-child(3) { animation-delay: .14s; }
        .wz-wave:nth-child(4) { animation-delay: .21s; }
        .wz-wave:nth-child(5) { animation-delay: .28s; }
        .wz-wave:nth-child(6) { animation-delay: .35s; }
        .wz-wave:nth-child(7) { animation-delay: .42s; }
        .wz-wave:nth-child(8) { animation-delay: .49s; }
        .wz-wave:nth-child(9) { animation-delay: .56s; }
        .wz-wave:nth-child(10) { animation-delay: .63s; }
        .wz-wave:nth-child(11) { animation-delay: .70s; }
        .wz-wave:nth-child(12) { animation-delay: .77s; }
        .wz-dot:nth-child(2) { animation-delay: .14s; }
        .wz-dot:nth-child(3) { animation-delay: .28s; }
        .wz-note-line { animation: wzNoteLine 2.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .wz-presence-image, .wz-presence-speaking, .wz-presence-listening, .wz-presence-thinking, .wz-presence-aura, .wz-presence-halo, .wz-blink, .wz-eye-shift, .wz-wave, .wz-dot, .wz-note-line { animation: none !important; }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.13),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.035),transparent_32%)]" />
      <div className={cn("wz-presence-aura pointer-events-none absolute left-1/2 top-[38%] h-[360px] w-[360px] -translate-x-1/2 rounded-full bg-gradient-to-b blur-[72px]", styles.aura)} />

      <div className="relative z-10 grid gap-4 md:grid-cols-[1fr_0.82fr]">
        <div className={cn("relative min-h-[320px] overflow-hidden rounded-[30px] border bg-canvas-soft", styles.ring)}>
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[430px] w-[430px] rounded-full border border-line opacity-30 wz-presence-halo" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_34%,rgba(255,255,255,0.10),transparent_26%),linear-gradient(180deg,transparent_45%,rgba(2,6,23,0.82)_100%)]" />

          <Image
            src={imageSrc}
            alt={`${recruiterName} recruiter`}
            fill
            sizes="(max-width: 768px) 100vw, 520px"
            className={cn(
              "object-cover object-center transition duration-700 wz-presence-image",
              isActiveSpeaking && "wz-presence-speaking",
              isActiveListening && "wz-presence-listening",
              (visualState === "thinking" || visualState === "skeptical" || visualState === "typing_notes") && "wz-presence-thinking",
              visualState === "interrupting" && "scale-[1.055] saturate-125 contrast-110",
            )}
            priority={false}
          />

          <div className="pointer-events-none absolute left-1/2 top-[35%] h-8 w-[46%] -translate-x-1/2 rounded-full bg-canvas/70 blur-md wz-blink" />
          <div className="pointer-events-none absolute left-1/2 top-[34%] h-8 w-[38%] rounded-full bg-brand/20 blur-2xl wz-eye-shift" />

          {isActiveSpeaking && (
            <div className="pointer-events-none absolute left-1/2 top-[58%] h-9 w-28 -translate-x-1/2 rounded-full bg-brand/20 blur-2xl" />
          )}

          {visualState === "typing_notes" && (
            <div className="pointer-events-none absolute bottom-24 left-8 right-8 overflow-hidden rounded-lg border border-line bg-canvas-soft p-3 backdrop-blur-xl">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-brand/80">Typing notes</div>
              <div className="relative mt-2 h-1 overflow-hidden rounded-full bg-fg/10">
                <span className="wz-note-line absolute inset-y-0 w-1/3 rounded-full bg-brand/70" />
              </div>
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-canvas/92 via-canvas/34 to-transparent p-5">
            <div className={cn("inline-flex max-w-full items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-black backdrop-blur-xl", styles.chip)}>
              <span className={cn("h-2.5 w-2.5 rounded-full", styles.dot)} />
              <span className="truncate">{recruiterName} · {recruiterRole}</span>
            </div>
          </div>
        </div>

        <div className="flex min-h-[320px] flex-col rounded-[28px] border border-line bg-fg/[0.035] p-4 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted">Recruiter presence</p>
              <h3 className="mt-2 text-2xl font-black tracking-[-0.03em] text-fg">{stateCopy}</h3>
            </div>
            <div className={cn("grid h-11 w-11 place-items-center rounded-lg border", styles.chip)}>
              {visualState === "thinking" || visualState === "typing_notes" ? (
                <Brain className="h-5 w-5" />
              ) : visualState === "interrupting" ? (
                <Zap className="h-5 w-5" />
              ) : isActiveSpeaking ? (
                <Mic2 className="h-5 w-5" />
              ) : visualState === "recovering_connection" ? (
                <Radio className="h-5 w-5" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )}
            </div>
          </div>

          <p className="mt-3 text-sm leading-6 text-muted">{recruiterCaption}</p>

          <div className="mt-5 flex h-[38px] items-end gap-[7px]" aria-hidden="true">
            {waveform.map((height, index) => (
              <span
                key={`${height}-${index}`}
                className={cn("w-[6px] rounded-full bg-gradient-to-t shadow-[0_0_14px_rgba(56,189,248,0.28)] wz-wave", isActiveSpeaking && "wz-wave-speaking", styles.bar)}
                style={{ height: Math.max(8, height * (isActiveSpeaking ? 1 : isActiveListening ? 0.78 : 0.54)) }}
              />
            ))}
          </div>

          <div className="mt-5 space-y-3">
            <Metric label="Trust" value={trustValue} tone="trust" />
            <Metric label="Interest" value={interestValue} tone="interest" />
            <Metric label="Pressure" value={pressureValue} tone="pressure" />
          </div>

          <div className="mt-auto pt-5">
            <div className="rounded-lg border border-line bg-canvas-soft px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-muted">
                <Pause className="h-3.5 w-3.5" />
                Live behavior
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm font-bold text-fg">
                {(visualState === "thinking" || visualState === "typing_notes") && (
                  <>
                    <span>Thinking</span>
                    {[0, 1, 2].map((dot) => (
                      <span key={dot} className="wz-dot h-1.5 w-1.5 rounded-full bg-brand" style={{ animation: "wzThinkingDots 1.1s ease-in-out infinite" }} />
                    ))}
                  </>
                )}
                {visualState === "interrupting" && <span>Preparing a sharper follow-up</span>}
                {isActiveSpeaking && <span>Voice active with subtle speaking motion</span>}
                {isActiveListening && <span>Listening for ownership and metrics</span>}
                {visualState === "idle" && <span>Ready for the next answer</span>}
                {visualState === "skeptical" && <span>Evaluating weak evidence</span>}
                {visualState === "interested" && <span>Following a stronger signal</span>}
                {visualState === "recovering_connection" && <span>Holding the room while voice reconnects</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "trust" | "interest" | "pressure" }) {
  const gradient =
    tone === "pressure"
      ? "from-danger via-warning to-warning"
      : tone === "interest"
        ? "from-success via-brand to-brand"
        : "from-brand via-brand to-brand";

  return (
    <div>
      <div className="flex items-center justify-between text-xs font-black text-muted">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-fg/10">
        <div className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-700", gradient)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
