"use client";

export default function Loading() {
  return (
    <main className="min-h-screen dark:bg-[linear-gradient(180deg,#06111f_0%,#050816_100%)] p-4 text-fg">
      <div className="mx-auto flex min-h-[calc(100vh-32px)] max-w-[1440px] items-center justify-center">
        <div className="w-full max-w-[520px] rounded-[30px] border border-line bg-fg/[0.045] p-8 text-center shadow-[0_22px_80px_rgba(0,0,0,0.26)] backdrop-blur-2xl">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <h1 className="mt-6 text-2xl font-black tracking-[-0.03em]">
            Preparing WorkZo
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Loading the interview experience safely.
          </p>
        </div>
      </div>
    </main>
  );
}
