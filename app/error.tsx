"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-6 text-fg">
      <div className="w-full max-w-[520px] rounded-[32px] border border-line bg-fg/[0.05] p-8 text-center shadow-[0_24px_100px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-danger">
          Interview interrupted
        </p>

        <h1 className="mt-4 text-4xl font-black tracking-[-0.04em]">
          Something interrupted the session.
        </h1>

        <p className="mt-4 text-sm leading-7 text-muted">
          Your progress is safe. You can continue the interview or restart safely.
        </p>

        <p className="mt-3 rounded-lg border border-line bg-canvas-soft p-3 text-xs leading-5 text-subtle">
          {error?.message || "Unexpected app error"}
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => reset()}
            className="flex-1 rounded-lg bg-gradient-to-r from-brand to-brand px-5 py-4 text-sm font-black"
          >
            Retry Session
          </button>

          <Link
            href="/dashboard"
            className="flex-1 rounded-lg border border-line bg-fg/[0.05] px-5 py-4 text-sm font-black"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
