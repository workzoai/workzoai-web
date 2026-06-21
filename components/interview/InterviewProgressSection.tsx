"use client";

type Props = { questionIndex: number; progress: number; };

export default function InterviewProgressSection({ questionIndex, progress }: Props) {
  return (
    <section className="rounded-xl border border-white/10 bg-[#0b1424] p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black">Interview Progress</h2>
        <span className="text-sm text-slate-300">Question {questionIndex} of 12</span>
      </div>
      <div className="mt-4 h-2 rounded-full bg-white/10">
        <div className="h-full rounded-full bg-violet-500 transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-2 text-sm text-slate-300">{progress}% Completed</p>
    </section>
  );
}
