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
        <main className="grid min-h-screen place-items-center bg-canvas px-5 text-fg">
          <section className="w-full max-w-xl rounded-xl border border-line bg-fg/[0.04] p-8 text-center">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-danger">
              WorkZo AI
            </p>
            <h1 className="mt-3 text-3xl font-black">Something went wrong</h1>
            <p className="mt-3 text-muted">
              We captured this error safely. You can retry or return to the dashboard.
            </p>

            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={reset}
                className="rounded-lg bg-brand px-5 py-3 text-sm font-black text-on-brand"
              >
                Try again
              </button>
              <Link
                href="/dashboard"
                className="rounded-lg border border-line bg-fg/[0.04] px-5 py-3 text-sm font-black text-fg"
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
