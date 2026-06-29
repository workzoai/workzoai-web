"use client";

import { AlertTriangle, RefreshCcw, Video, Mic } from "lucide-react";

type VoiceVideoFallbackCardProps = {
  type: "voice" | "video";
  message?: string;
  onRetry?: () => void;
  onSwitchMode?: () => void;
};

export default function VoiceVideoFallbackCard({
  type,
  message,
  onRetry,
  onSwitchMode,
}: VoiceVideoFallbackCardProps) {
  const isVoice = type === "voice";

  return (
    <div className="rounded-xl border border-warning/25 bg-warning/10 p-4 text-warning">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning/14">
          <AlertTriangle className="h-5 w-5" />
        </div>

        <div className="flex-1">
          <p className="font-black">
            {isVoice ? "Voice could not start" : "Live video could not start"}
          </p>
          <p className="mt-1 text-sm leading-6 text-warning/85">
            {message ||
              (isVoice
                ? "Please allow microphone access, close other apps using the mic, or continue with Live Video."
                : "We can continue seamlessly in Standard Voice.")}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-fg/10 px-4 text-sm font-black text-fg hover:bg-fg/15"
              >
                <RefreshCcw className="h-4 w-4" />
                Retry
              </button>
            )}

            {onSwitchMode && (
              <button
                type="button"
                onClick={onSwitchMode}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-brand to-brand px-4 text-sm font-black text-on-brand"
              >
                {isVoice ? <Video className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {isVoice ? "Try Live Video" : "Use Standard Voice"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
