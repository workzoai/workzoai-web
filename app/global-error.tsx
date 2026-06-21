"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: {
        area: "global_error_boundary",
        product: "workzo_ai",
      },
      extra: {
        digest: error.digest,
      },
    });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="grid min-h-screen place-items-center bg-[#050b14] px-5 text-white">
          <section className="w-full max-w-xl rounded-xl border border-white/10 bg-white/[0.04] p-8 text-center">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-red-200">
              WorkZo AI
            </p>
            <h1 className="mt-3 text-3xl font-black">Something went wrong</h1>
            <p className="mt-3 text-slate-300">
              We captured this error safely. You can retry or return to the dashboard.
            </p>

            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={reset}
                className="rounded-lg bg-blue-500 px-5 py-3 text-sm font-black text-white"
              >
                Try again
              </button>
              <Link
                href="/dashboard"
                className="rounded-lg border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-white"
              >
                Go to dashboard
              </Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
