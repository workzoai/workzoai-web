"use client";

import Image from "next/image";
import InterviewControls from "./InterviewControls";
import type { InterviewSetupViewModel } from "./types";

type Props = { setup: InterviewSetupViewModel; statusLabel: string; statusTone?: string; isMuted?: boolean; onToggleMute: () => void; onOpenSettings: () => void; onEnd: () => void; };

export default function RecruiterVideoPanel({ setup, statusLabel, statusTone = "LIVE", isMuted = false, onToggleMute, onOpenSettings, onEnd }: Props) {
  return (
    <section className="relative overflow-hidden rounded-xl border border-white/10 bg-[#08111f] shadow-2xl">
      <div className="relative min-h-[480px] w-full overflow-hidden sm:min-h-[540px] lg:min-h-[600px]">
        <Image src={setup.recruiterImage} alt={`${setup.recruiterName} recruiter portrait`} fill priority className="object-cover object-top" sizes="(max-width: 768px) 100vw, 70vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute left-6 top-6 rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm font-black uppercase text-emerald-200">
          <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-emerald-300" />{statusTone}
        </div>
        <div className="absolute bottom-7 left-6">
          <div className="flex items-center gap-3"><h2 className="text-2xl font-black text-white">{setup.recruiterName}</h2><span className="h-5 w-5 rounded-full bg-blue-500" /></div>
          <p className="mt-2 text-base text-white/90">{setup.recruiterTitle}</p>
          <p className="mt-2 text-sm font-black text-emerald-300">{statusLabel}</p>
        </div>
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
          <InterviewControls statusLabel={statusLabel} isMuted={isMuted} onToggleMute={onToggleMute} onOpenSettings={onOpenSettings} onEnd={onEnd} />
        </div>
      </div>
    </section>
  );
}
