"use client";

import type { RecruiterSignalViewModel } from "./types";

type Props = { signal: RecruiterSignalViewModel; enabled: boolean; onToggle: () => void; };

export default function LiveCopilotPanel({ signal, enabled, onToggle }: Props) {
  return (
    <section className="rounded-xl border border-white/10 bg-[#0b1424] p-5">
      <div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><h2 className="text-2xl font-black text-blue-200">Live Copilot</h2></div><button type="button" onClick={onToggle} className={`h-8 w-14 rounded-full p-1 transition ${enabled ? "bg-blue-500" : "bg-slate-700"}`} aria-label="Toggle live copilot"><span className={`block h-6 w-6 rounded-full bg-white transition ${enabled ? "translate-x-6" : "translate-x-0"}`} /></button></div>
      <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-4"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Recruiter Mood</p><p className="mt-2 text-xl font-black text-blue-200">{signal.mood}</p></div><div className="text-right text-sm text-slate-200"><p>Trust {signal.trust}</p><p>Interest {signal.interest}</p></div></div></div>
      <div className="mt-4 rounded-lg border border-emerald-300/20 bg-emerald-500/10 p-4"><p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200">Say Next</p><p className="mt-2 text-sm leading-6 text-white">Use one real example and state the result.</p></div>
      <div className="mt-3 rounded-lg border border-yellow-300/20 bg-yellow-500/10 p-4"><p className="text-xs font-black uppercase tracking-[0.22em] text-yellow-200">Recruiter Concern</p><p className="mt-2 text-sm leading-6 text-white">{signal.concern || "Answer needs stronger evidence."}</p></div>
    </section>
  );
}
