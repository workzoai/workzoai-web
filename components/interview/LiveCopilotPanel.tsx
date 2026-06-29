"use client";

import type { RecruiterSignalViewModel } from "./types";

type Props = { signal: RecruiterSignalViewModel; enabled: boolean; onToggle: () => void; };

export default function LiveCopilotPanel({ signal, enabled, onToggle }: Props) {
  return (
    <section className="rounded-xl border border-line bg-canvas p-5">
      <div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><h2 className="text-2xl font-black text-brand">Live Copilot</h2></div><button type="button" onClick={onToggle} className={`h-8 w-14 rounded-full p-1 transition ${enabled ? "bg-brand" : "bg-slate-700"}`} aria-label="Toggle live copilot"><span className={`block h-6 w-6 rounded-full bg-white transition ${enabled ? "translate-x-6" : "translate-x-0"}`} /></button></div>
      <div className="mt-4 rounded-lg border border-line bg-fg/[0.04] p-4"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.22em] text-muted">Recruiter Mood</p><p className="mt-2 text-xl font-black text-brand">{signal.mood}</p></div><div className="text-right text-sm text-fg"><p>Trust {signal.trust}</p><p>Interest {signal.interest}</p></div></div></div>
      <div className="mt-4 rounded-lg border border-success/20 bg-success/10 p-4"><p className="text-xs font-black uppercase tracking-[0.22em] text-success">Say Next</p><p className="mt-2 text-sm leading-6 text-on-brand">Use one real example and state the result.</p></div>
      <div className="mt-3 rounded-lg border border-warning/20 bg-warning/10 p-4"><p className="text-xs font-black uppercase tracking-[0.22em] text-warning">Recruiter Concern</p><p className="mt-2 text-sm leading-6 text-on-brand">{signal.concern || "Answer needs stronger evidence."}</p></div>
    </section>
  );
}
