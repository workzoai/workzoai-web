"use client";

import { ShieldCheck } from "lucide-react";

export default function BetaDisclaimer() {
  return (
    <div className="rounded-lg border border-cyan-300/15 bg-cyan-400/[0.06] px-4 py-3 text-sm leading-6 text-cyan-50/90">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />
        <p>
          <span className="font-black text-cyan-100">Beta notice:</span> WorkZo AI is continuously improving based on real interview feedback.
          AI feedback may be incomplete or imperfect. Please review important CV, interview,
          and job guidance before using it in real applications. Your uploaded CV text is used
          only for this interview setup.
        </p>
      </div>
    </div>
  );
}
