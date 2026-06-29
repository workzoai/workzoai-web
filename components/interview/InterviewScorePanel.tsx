"use client";

import { ShieldCheck, Sparkles, Star, User } from "lucide-react";
import type { RecruiterSignalViewModel } from "./types";

type Props = { signal: RecruiterSignalViewModel; scoreReady: boolean; };

export default function InterviewScorePanel({ signal, scoreReady }: Props) {
  const rows = [{ label: "Confidence", value: signal.confidence, icon: ShieldCheck }, { label: "Clarity", value: signal.clarity, icon: Sparkles }, { label: "Relevance", value: signal.relevance, icon: Star }, { label: "Communication", value: signal.communication, icon: User }];
  return (
    <section className="rounded-xl border border-line bg-canvas p-5">
      <h2 className="text-xl font-black text-fg">Interview Score</h2>
      <div className="mt-5 flex items-center gap-6">
        <div className="grid h-28 w-28 place-items-center rounded-full bg-brand p-3"><div className="grid h-full w-full place-items-center rounded-full border-[9px] border-brand"><div className="text-center"><p className="text-3xl font-black text-on-brand">{scoreReady ? signal.overall : "READY"}</p><p className="text-sm text-muted">{scoreReady ? "/100" : "first answer"}</p></div></div></div>
        <div className="flex-1 space-y-3">{rows.map(({ label, value, icon: Icon }) => <div key={label} className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-xl bg-fg/8 text-brand"><Icon className="h-4 w-4" /></span><span className="text-base text-fg">{label}</span></div><span className="text-sm text-fg">{scoreReady ? `${value}/100` : "Pending"}</span></div>)}</div>
      </div>
      <p className="mt-4 text-sm text-brand"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-success" />Overall Performance: <strong>{scoreReady ? signal.mood : "Waiting"}</strong></p>
    </section>
  );
}
