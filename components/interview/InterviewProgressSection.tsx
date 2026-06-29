"use client";

type Props = { questionIndex: number; progress: number; };

export default function InterviewProgressSection({ questionIndex, progress }: Props) {
  return (
    <section className="rounded-xl border border-line bg-canvas p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black">Interview Progress</h2>
        <span className="text-sm text-muted">Question {questionIndex} of 12</span>
      </div>
      <div className="mt-4 h-2 rounded-full bg-fg/10">
        <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-2 text-sm text-muted">{progress}% Completed</p>
    </section>
  );
}
