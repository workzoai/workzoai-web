import Link from "next/link";
import { Mail, MessageCircle, ShieldCheck } from "lucide-react";

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#050a12] px-5 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="text-sm font-bold text-slate-400 hover:text-white">← Back home</Link>
        <section className="mt-12 rounded-lg border border-white/10 bg-gradient-to-br from-blue-500/15 via-white/[0.04] to-cyan-400/10 p-8">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-200">Contact</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-3xl">Need help with WorkZo AI?</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">For support, bugs, data requests, feedback, or partnership questions, contact the WorkZo AI team.</p>
        </section>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <a href="mailto:support@workzoai.com" className="rounded-xl border border-white/10 bg-white/[0.04] p-6 transition hover:bg-white/[0.07]">
            <Mail className="h-6 w-6 text-cyan-200" />
            <h2 className="mt-4 text-lg font-black">Support</h2>
            <p className="mt-2 text-sm text-slate-300">support@workzoai.com</p>
          </a>
          <a href="mailto:support@workzoai.com?subject=WorkZo%20AI%20Bug%20Report" className="rounded-xl border border-white/10 bg-white/[0.04] p-6 transition hover:bg-white/[0.07]">
            <MessageCircle className="h-6 w-6 text-blue-200" />
            <h2 className="mt-4 text-lg font-black">Report a bug</h2>
            <p className="mt-2 text-sm text-slate-300">Send browser, page, and what happened.</p>
          </a>
          <a href="mailto:support@workzoai.com?subject=Data%20Request" className="rounded-xl border border-white/10 bg-white/[0.04] p-6 transition hover:bg-white/[0.07]">
            <ShieldCheck className="h-6 w-6 text-emerald-200" />
            <h2 className="mt-4 text-lg font-black">Data request</h2>
            <p className="mt-2 text-sm text-slate-300">Request access, correction, or deletion.</p>
          </a>
        </div>
      </div>
    </main>
  );
}
