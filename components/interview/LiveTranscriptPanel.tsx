"use client";

import type { TranscriptItem } from "./types";

type Props = { transcript: TranscriptItem[]; collapsed: boolean; onToggle: () => void; onClear: () => void; showToggle?: boolean; };

function TranscriptMessageRow({ item }: { item: TranscriptItem }) {
  const isRecruiter = item.role === "recruiter";
  const isCandidate = item.role === "candidate";
  return (
    <div className="border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <p className={`text-sm font-black ${isRecruiter ? "text-violet-200" : isCandidate ? "text-blue-200" : "text-slate-400"}`}>{item.speaker || (isRecruiter ? "AI Recruiter" : isCandidate ? "You" : "System")}</p>
        <span className="shrink-0 text-xs font-semibold text-slate-500">{item.time}</span>
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words text-base leading-7 text-slate-100">{item.text}</p>
    </div>
  );
}

export default function LiveTranscriptPanel({ transcript, collapsed, onToggle, onClear, showToggle = true }: Props) {
  const visibleTranscript = transcript.filter((item) => item.text.trim() && !(item.role === "system" && item.id === "initial-ready"));
  return (
    <section className="overflow-hidden rounded-xl border border-white/10 bg-[#0b1424]">
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-3"><h2 className="text-xl font-black text-white">Live Transcript</h2><span className="h-2.5 w-2.5 rounded-full bg-red-400" /><span className="text-sm text-slate-300">{visibleTranscript.length} {visibleTranscript.length === 1 ? "message" : "messages"}</span></div>
        {showToggle ? <button type="button" onClick={onToggle} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-blue-100 transition hover:bg-white/10">{collapsed ? "Expand" : "Collapse"}</button> : null}
      </div>
      {!collapsed ? (visibleTranscript.length ? <div className="max-h-[520px] overflow-y-auto bg-[#081121]">{visibleTranscript.map((item) => <TranscriptMessageRow key={item.id} item={item} />)}</div> : <div className="px-6 py-6 text-sm leading-6 text-slate-400">Transcript messages will appear here after the recruiter or candidate speaks.</div>) : <div className="px-6 py-5 text-sm text-slate-400">Transcript is collapsed on mobile to keep the recruiter in focus.</div>}
      <div className="flex items-center justify-between border-t border-white/10 px-6 py-3 text-sm text-slate-400"><span>Transcript is AI-generated and may not be 100% accurate.</span><button type="button" onClick={onClear} className="font-semibold hover:text-white">Clear Transcript</button></div>
    </section>
  );
}
