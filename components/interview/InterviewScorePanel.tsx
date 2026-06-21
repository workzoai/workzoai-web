"use client";

import { ShieldCheck, Sparkles, Star, User } from "lucide-react";
import type { RecruiterSignalViewModel } from "./types";

type Props = { signal: RecruiterSignalViewModel; scoreReady: boolean; };

export default function InterviewScorePanel({ signal, scoreReady }: Props) {
  const rows = [{ label: "Confidence", value: signal.confidence, icon: ShieldCheck }, { label: "Clarity", value: signal.clarity, icon: Sparkles }, { label: "Relevance", value: signal.relevance, icon: Star }, { label: "Communication", value: signal.communication, icon: User }];
  return (
    <section className="rounded-xl border border-white/10 bg-[#0b1424] p-5">
      <h2 className="text-xl font-black text-white">Interview Score</h2>
      <div className="mt-5 flex items-center gap-6">
        <div className="grid h-28 w-28 place-items-center rounded-full bg-violet-950 p-3"><div className="grid h-full w-full place-items-center rounded-full border-[9px] border-blue-500"><div className="text-center"><p className="text-3xl font-black text-white">{scoreReady ? signal.overall : "READY"}</p><p className="text-sm text-slate-300">{scoreReady ? "/100" : "first answer"}</p></div></div></div>
        <div className="flex-1 space-y-3">{rows.map(({ label, value, icon: Icon }) => <div key={label} className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-xl bg-white/8 text-blue-200"><Icon className="h-4 w-4" /></span><span className="text-base text-white">{label}</span></div><span className="text-sm text-white">{scoreReady ? `${value}/100` : "Pending"}</span></div>)}</div>
      </div>
      <p className="mt-4 text-sm text-blue-100"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-300" />Overall Performance: <strong>{scoreReady ? signal.mood : "Waiting"}</strong></p>
    </section>
  );
}
