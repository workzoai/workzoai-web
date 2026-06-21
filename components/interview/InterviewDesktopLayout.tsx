"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import RecruiterVideoPanel from "./RecruiterVideoPanel";
import InterviewScorePanel from "./InterviewScorePanel";
import LiveCopilotPanel from "./LiveCopilotPanel";
import LiveTranscriptPanel from "./LiveTranscriptPanel";
import InterviewProgressSection from "./InterviewProgressSection";
import type { InterviewLayoutProps } from "./types";

// Lazy-load Monaco so it doesn't bloat the initial bundle for non-technical interviews
const CodePanel = dynamic(() => import("@/components/interview/CodePanel"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center rounded-lg border border-white/10 bg-[#0d1117]">
      <span className="text-xs text-slate-600 font-black uppercase tracking-widest">Loading editor…</span>
    </div>
  ),
});

export default function InterviewDesktopLayout({ setup, signal, transcript, ui, actions }: InterviewLayoutProps) {
  const showCodePanel = ui.technicalMode && ui.isPremiumUnlocked;

  return (
    <main className="min-h-screen bg-[#050a12] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#07101c]/95 px-5 py-4 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              onClick={actions.onBack}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <Link href="/dashboard" className="flex shrink-0 items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-lg bg-cyan-500 text-xl font-black">W</div>
              <span className="hidden text-2xl font-black lg:block">
                WorkZo <span className="text-blue-400">AI</span>
              </span>
            </Link>
            <div className="h-8 w-px shrink-0 bg-white/10" />
            <h1 className="truncate text-xl font-black">{setup.targetRole}</h1>
            <span className="h-3 w-3 shrink-0 rounded-full bg-emerald-400" />
            <span className="hidden shrink-0 rounded-full border border-blue-300/20 bg-blue-400/10 px-4 py-1 text-sm font-black text-blue-200 xl:inline">
              {signal.mood === "Engaged" ? "INTERESTED" : signal.mood.toUpperCase()}
            </span>
            {showCodePanel && (
              <span className="hidden shrink-0 rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1 text-xs font-black text-violet-200 xl:inline">
                💻 Technical Mode
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-sm text-slate-400">{ui.elapsedLabel}</span>
            <button
              type="button"
              onClick={actions.onEnd}
              className="rounded-lg border border-red-400/30 px-5 py-3 font-black text-red-200 hover:bg-red-500/10"
            >
              End Interview
            </button>
          </div>
        </div>
      </header>

      {showCodePanel ? (
        // Technical mode: recruiter video + code editor side by side, score panel below
        <div className="flex h-[calc(100vh-73px)] flex-col gap-4 p-5 xl:flex-row">
          {/* Left: recruiter + transcript */}
          <div className="flex flex-col gap-4 xl:w-[420px] xl:shrink-0">
            <RecruiterVideoPanel
              setup={setup}
              statusLabel={ui.status === "listening" ? "Listening" : ui.status === "recruiter-speaking" ? "Speaking" : "Interested"}
              statusTone={ui.status === "listening" ? "LISTENING" : "LIVE"}
              onToggleMute={actions.onToggleMute}
              onOpenSettings={actions.onToggleSettings}
              onEnd={actions.onEnd}
            />
            <LiveTranscriptPanel
              transcript={transcript}
              collapsed={false}
              onToggle={actions.onToggleTranscript}
              onClear={actions.onClearTranscript}
              showToggle={false}
            />
          </div>

          {/* Centre: code editor — takes remaining width */}
          <div className="min-h-[400px] flex-1 xl:min-h-0">
            <CodePanel onCodeChange={actions.onCodeChange} />
          </div>

          {/* Right: score + copilot + progress */}
          <aside className="flex flex-col gap-4 xl:w-[300px] xl:shrink-0">
            <InterviewScorePanel signal={signal} scoreReady={ui.scoreReady} />
            <LiveCopilotPanel signal={signal} enabled={ui.copilotEnabled} onToggle={actions.onToggleCopilot} />
            <InterviewProgressSection questionIndex={ui.questionIndex} progress={ui.progress} />
          </aside>
        </div>
      ) : (
        // Standard mode: unchanged layout
        <div className="grid gap-4 p-5 xl:grid-cols-[1fr_460px]">
          <div className="space-y-4">
            <RecruiterVideoPanel
              setup={setup}
              statusLabel={ui.status === "listening" ? "Listening" : ui.status === "recruiter-speaking" ? "Speaking" : "Interested"}
              statusTone={ui.status === "listening" ? "LISTENING" : "LIVE"}
              onToggleMute={actions.onToggleMute}
              onOpenSettings={actions.onToggleSettings}
              onEnd={actions.onEnd}
            />
            <LiveTranscriptPanel
              transcript={transcript}
              collapsed={false}
              onToggle={actions.onToggleTranscript}
              onClear={actions.onClearTranscript}
              showToggle={false}
            />
          </div>
          <aside className="space-y-4">
            <InterviewScorePanel signal={signal} scoreReady={ui.scoreReady} />
            <LiveCopilotPanel signal={signal} enabled={ui.copilotEnabled} onToggle={actions.onToggleCopilot} />
            <InterviewProgressSection questionIndex={ui.questionIndex} progress={ui.progress} />
          </aside>
        </div>
      )}
    </main>
  );
}
