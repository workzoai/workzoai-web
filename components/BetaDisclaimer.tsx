"use client";

import { ShieldCheck } from "lucide-react";

export default function BetaDisclaimer() {
  return (
    <div className="rounded-lg border border-brand/15 bg-brand/[0.06] px-4 py-3 text-sm leading-6 text-brand/90">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        <p>
          <span className="font-black text-brand">Beta notice:</span> WorkZo AI is continuously improving based on real interview feedback.
          AI feedback may be incomplete or imperfect. Please review important CV, interview,
          and job guidance before using it in real applications. Your uploaded CV text is used
          only for this interview setup.
        </p>
      </div>
    </div>
  );
}
