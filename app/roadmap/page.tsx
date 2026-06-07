import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";

export const metadata = {
  title: "Roadmap | WorkZo AI",
};

const cards = [{"title": "Now", "text": "The current focus is making interview practice stable, intelligent, and easy to use before wider launch.", "items": ["Technical stability", "Interview intelligence", "Mobile polish"]}, {"title": "Next", "text": "The next phase focuses on accounts, saved history, payments, and a stronger Premium experience.", "items": ["Auth hardening", "Stripe payments", "Saved reports"]}, {"title": "Later", "text": "Future upgrades will make the experience more immersive and company-specific.", "items": ["Video recruiter polish", "Company DNA modes", "Advanced analytics"]}];

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
            Product roadmap
          </div>
          <h1 className="mt-4 max-w-3xl text-3xl font-black tracking-[-0.04em] sm:text-5xl">Roadmap</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">What WorkZo AI is working on now, what comes next, and what is planned for the future.</p>
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
