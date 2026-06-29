import Link from "next/link";
import { Mail, MessageCircle, ShieldCheck } from "lucide-react";

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-canvas px-5 py-10 text-fg">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="text-sm font-bold text-muted hover:text-fg">← Back home</Link>
        <section className="mt-12 rounded-lg border border-line bg-gradient-to-br from-brand/15 via-white/[0.04] to-brand/10 p-8">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-brand">Contact</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-3xl">Need help with WorkZo AI?</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">For support, bugs, data requests, feedback, or partnership questions, contact the WorkZo AI team.</p>
        </section>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <a href="mailto:support@workzoai.com" className="rounded-xl border border-line bg-fg/[0.04] p-6 transition hover:bg-fg/[0.07]">
            <Mail className="h-6 w-6 text-brand" />
            <h2 className="mt-4 text-lg font-black">Support</h2>
            <p className="mt-2 text-sm text-muted">support@workzoai.com</p>
          </a>
          <a href="mailto:support@workzoai.com?subject=WorkZo%20AI%20Bug%20Report" className="rounded-xl border border-line bg-fg/[0.04] p-6 transition hover:bg-fg/[0.07]">
            <MessageCircle className="h-6 w-6 text-brand" />
            <h2 className="mt-4 text-lg font-black">Report a bug</h2>
            <p className="mt-2 text-sm text-muted">Send browser, page, and what happened.</p>
          </a>
          <a href="mailto:support@workzoai.com?subject=Data%20Request" className="rounded-xl border border-line bg-fg/[0.04] p-6 transition hover:bg-fg/[0.07]">
            <ShieldCheck className="h-6 w-6 text-success" />
            <h2 className="mt-4 text-lg font-black">Data request</h2>
            <p className="mt-2 text-sm text-muted">Request access, correction, or deletion.</p>
          </a>
        </div>
      </div>
    </main>
  );
}
