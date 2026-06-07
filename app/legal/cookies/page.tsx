import Link from "next/link";

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-[#050a12] px-5 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm font-bold text-slate-400 hover:text-white">← Back home</Link>
        <p className="mt-10 text-xs font-black uppercase tracking-[0.28em] text-cyan-200">Legal</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-5xl">Cookie Policy</h1>
        <div className="mt-8 space-y-4">
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-lg font-black">How WorkZo AI uses browser storage</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">WorkZo AI may use cookies, local storage, and session storage to keep users signed in, remember interview setup, track usage limits, store beta preferences, and improve product reliability.</p>
          </section>
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-lg font-black">Analytics and error logs</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">We may use analytics and error tracking tools to understand product usage, crashes, and performance issues. These tools may collect technical metadata such as browser type, page path, and timestamps.</p>
          </section>
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-lg font-black">Managing cookies</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">You can control cookies and local storage through your browser settings. Disabling storage may affect login, interview setup, usage limits, and saved reports.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
