import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center dark:bg-[linear-gradient(180deg,#06111f_0%,#050816_100%)] p-6 text-fg">
      <div className="w-full max-w-[520px] rounded-[32px] border border-line bg-fg/[0.05] p-8 text-center shadow-[0_24px_100px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-brand">
          Page not found
        </p>

        <h1 className="mt-4 text-4xl font-black tracking-[-0.04em]">
          This WorkZo page does not exist.
        </h1>

        <p className="mt-4 text-sm leading-7 text-muted">
          Return to the dashboard or restart the interview setup safely.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/dashboard"
            className="flex-1 rounded-lg bg-gradient-to-r from-brand to-brand px-5 py-4 text-sm font-black"
          >
            Dashboard
          </Link>

          <Link
            href="/"
            className="flex-1 rounded-lg border border-line bg-fg/[0.05] px-5 py-4 text-sm font-black"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
