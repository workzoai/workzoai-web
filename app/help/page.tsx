import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";

export const metadata = {
  title: "Help Center | WorkZo AI",
};

const cards = [{"title": "Getting started", "text": "Start from onboarding, upload or paste your CV, add the target role, and choose your recruiter style.", "items": ["Go to onboarding", "Add CV and job context", "Start the interview"]}, {"title": "CV upload help", "text": "If a PDF extracts poorly, paste the CV text manually or use a cleaner single-column CV while the parser is improved.", "items": ["Use PDF, DOCX, or TXT", "Manual paste is available", "Review extracted profile"]}, {"title": "Interview help", "text": "Use a quiet place, allow microphone permission, and answer naturally with examples and measurable outcomes.", "items": ["Allow mic access", "Use STAR structure", "Mention results and ownership"]}, {"title": "Results help", "text": "The report is coaching guidance. Use it to improve structure, evidence, confidence, and role fit.", "items": ["Check weak answer", "Review trust signals", "Retry after improving"]}, {"title": "Billing help", "text": "Premium checkout is being prepared. Opening offer selection is saved until billing is connected.", "items": ["Free plan available", "Opening offer visible", "Stripe coming soon"]}, {"title": "Support", "text": "Send feedback, bugs, or support questions directly to the WorkZo AI support email.", "items": ["support@workzoai.com", "Include page and issue", "Screenshots help debugging"]}];

export default function Page() {
  return (
    <main className="min-h-screen bg-[#050b14] px-5 py-8 text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_34%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_34%),linear-gradient(180deg,#050b14,#07111f)]" />

      <div className="mx-auto max-w-6xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-300 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to WorkZo AI
        </Link>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-gradient-to-br from-blue-500/15 via-violet-500/10 to-white/[0.03] p-6 sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
            <Sparkles className="h-3.5 w-3.5" />
            Help center
          </div>
          <h1 className="mt-4 max-w-3xl text-3xl font-black tracking-[-0.04em] sm:text-5xl">Help Center</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">Quick support for onboarding, CV uploads, interviews, results, pricing, and beta usage.</p>
        </section>

        <section className="mt-6 grid gap-5 md:grid-cols-3">
          {cards.map((card) => (
            <div key={card.title} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-xl font-black text-white">{card.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">{card.text}</p>
              <ul className="mt-4 space-y-2">
                {card.items.map((item) => (
                  <li key={item} className="flex gap-2 text-sm leading-6 text-slate-300">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        

        <section className="mt-6 rounded-3xl border border-blue-300/20 bg-blue-500/10 p-6">
          <h2 className="text-2xl font-black">Ready to practice?</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Start with the free interview flow and upgrade only when you need the full recruiter intelligence report.
          </p>
          <Link href="/pricing" className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-blue-500 px-5 py-3 text-sm font-black text-white hover:bg-blue-400">
            View pricing
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </div>
    </main>
  );
}
