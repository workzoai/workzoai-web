"use client";

import { Mic, MicOff, PhoneOff, RotateCcw } from "lucide-react";
import { cn } from "./uiHelpers";

type MobileInterviewShellProps = {
  children: React.ReactNode;
  micOn: boolean;
  connected: boolean;
  onToggleMic: () => void;
  onLeave: () => void;
  onReconnect?: () => void;
};

export default function MobileInterviewShell({
  children,
  micOn,
  connected,
  onToggleMic,
  onLeave,
  onReconnect,
}: MobileInterviewShellProps) {
  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-canvas text-fg md:hidden">
      <div className="pointer-events-none fixed inset-0 dark:bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,0.26),transparent_38%),linear-gradient(180deg,rgba(15,23,42,0.2),#020617_72%)]" />
      <div className="relative z-10 px-3 pb-28 pt-[max(12px,env(safe-area-inset-top))]">
        {children}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-canvas/84 px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3 shadow-[0_-20px_70px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
        <div className="mx-auto flex max-w-sm items-center justify-between gap-3">
          <button
            type="button"
            onClick={onToggleMic}
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full border transition active:scale-95",
              micOn ? "border-success/30 bg-success/15" : "border-line bg-fg/10",
            )}
            aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
          >
            {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>

          <div className="flex-1 rounded-full border border-line bg-fg/[0.06] px-4 py-3 text-center text-xs font-semibold text-fg">
            {connected ? "Voice connected" : "Voice fallback active"}
          </div>

          {onReconnect && (
            <button
              type="button"
              onClick={onReconnect}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-fg/10 transition active:scale-95"
              aria-label="Reconnect voice"
            >
              <RotateCcw className="h-5 w-5" />
            </button>
          )}

          <button
            type="button"
            onClick={onLeave}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-danger/30 bg-danger/18 text-danger transition active:scale-95"
            aria-label="Leave interview"
          >
            <PhoneOff className="h-5 w-5" />
          </button>
        </div>
      </div>
    </main>
  );
}
