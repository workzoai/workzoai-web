"use client";

import { ArrowLeft, Code2, MessageSquare, Settings } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import RecruiterVideoPanel from "./RecruiterVideoPanel";
import InterviewScorePanel from "./InterviewScorePanel";
import LiveCopilotPanel from "./LiveCopilotPanel";
import LiveTranscriptPanel from "./LiveTranscriptPanel";
import InterviewProgressSection from "./InterviewProgressSection";
import type { InterviewLayoutProps } from "./types";

const CodePanel = dynamic(() => import("@/components/interview/CodePanel"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[300px] items-center justify-center rounded-lg border border-white/10 bg-[#0d1117]">
      <span className="text-xs text-slate-600 font-black uppercase tracking-widest">Loading editor…</span>
    </div>
  ),
});

export default function InterviewMobileLayout({ setup, signal, transcript, ui, actions }: InterviewLayoutProps) {
  const showCodePanel = ui.technicalMode && ui.isPremiumUnlocked;
  // Mobile: toggle between transcript view and code view
  const [mobileTab, setMobileTab] = useState<"interview" | "code">("interview");

  return (
    <main className="min-h-screen bg-[#050a12] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#07101c]/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={actions.onBack}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-black">{setup.targetRole}</p>
            <p className="truncate text-xs text-slate-400">
              {setup.recruiterName} · {setup.language}
              {showCodePanel && <span className="ml-2 text-violet-300">· Technical Mode</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={actions.onToggleSettings}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>

        {/* Mobile tab switcher — only shown in technical mode */}
        {showCodePanel && (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setMobileTab("interview")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black transition ${
                mobileTab === "interview"
                  ? "bg-blue-500/20 text-blue-200 border border-blue-400/30"
                  : "bg-white/5 text-slate-400 border border-white/10"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Interview
            </button>
            <button
              type="button"
              onClick={() => setMobileTab("code")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black transition ${
                mobileTab === "code"
                  ? "bg-violet-500/20 text-violet-200 border border-violet-400/30"
                  : "bg-white/5 text-slate-400 border border-white/10"
              }`}
            >
              <Code2 className="h-3.5 w-3.5" />
              Code
            </button>
          </div>
        )}
      </header>

      <div className="space-y-4 p-4">
        {/* Code tab — shown on mobile when in technical mode and code tab selected */}
        {showCodePanel && mobileTab === "code" ? (
          <div className="h-[60vh]">
            <CodePanel onCodeChange={actions.onCodeChange} />
          </div>
        ) : (
          <>
            <RecruiterVideoPanel
              setup={setup}
              statusLabel={ui.status === "listening" ? "Listening" : ui.status === "recruiter-speaking" ? "Speaking" : "Interested"}
              statusTone={ui.status === "listening" ? "LISTENING" : "LIVE"}
              onToggleMute={actions.onToggleMute}
              onOpenSettings={actions.onToggleSettings}
              onEnd={actions.onEnd}
            />
            <InterviewScorePanel signal={signal} scoreReady={ui.scoreReady} />
            <LiveTranscriptPanel
              transcript={transcript}
              collapsed={ui.transcriptCollapsed}
              onToggle={actions.onToggleTranscript}
              onClear={actions.onClearTranscript}
              showToggle
            />
            <LiveCopilotPanel signal={signal} enabled={ui.copilotEnabled} onToggle={actions.onToggleCopilot} />
            <InterviewProgressSection questionIndex={ui.questionIndex} progress={ui.progress} />
          </>
        )}
      </div>
    </main>
  );
}
