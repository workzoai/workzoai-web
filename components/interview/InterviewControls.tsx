"use client";

import { Mic, MicOff, PhoneOff, Settings } from "lucide-react";

type InterviewControlsProps = { statusLabel: string; isMuted?: boolean; onToggleMute: () => void; onOpenSettings: () => void; onEnd: () => void; };

export default function InterviewControls({ statusLabel, isMuted = false, onToggleMute, onOpenSettings, onEnd }: InterviewControlsProps) {
  return (
    <div className="flex items-center justify-center gap-4">
      <button type="button" onClick={onToggleMute} className="grid h-14 w-14 place-items-center rounded-full bg-white text-slate-950 shadow-lg transition hover:scale-105" aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}>
        {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
      </button>
      <button type="button" onClick={onOpenSettings} className="grid h-14 w-14 place-items-center rounded-full bg-white text-slate-950 shadow-lg transition hover:scale-105" aria-label="Interview settings">
        <Settings className="h-6 w-6" />
      </button>
      <button type="button" onClick={onEnd} className="grid h-14 w-14 place-items-center rounded-full bg-danger text-on-brand shadow-lg transition hover:scale-105" aria-label="End interview">
        <PhoneOff className="h-6 w-6" />
      </button>
      <span className="sr-only">{statusLabel}</span>
    </div>
  );
}
