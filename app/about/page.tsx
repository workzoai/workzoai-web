import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  Globe,
  Lightbulb,
  Mic,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import WorkZoFooter from "@/components/WorkZoFooter";

const badges = [
  { label: "Built from real support experience", icon: BriefcaseBusiness },
  { label: "AI career-prep product", icon: BarChart3 },
  { label: "Founder of WorkZo AI", icon: Sparkles },
];

const principles = [
  {
    icon: Mic,
    title: "Realistic recruiter practice",
    body: "Real follow-up questions based on what you actually say — not a generic question bank. Every session adapts to your CV and the exact role you applied for.",
  },
  {
    icon: TrendingUp,
    title: "Trust score transparency",
    body: "After every answer you can see recruiter trust rising or falling in real time — and exactly why. No more guessing what went wrong after an interview.",
  },
  {
    icon: Globe,
    title: "Built for global job seekers",
    body: "UK-style competency interviews, US tech screens, German formal structures — WorkZo is designed for candidates in any market, not just one country.",
  },
  {
    icon: Lightbulb,
    title: "Practice that transfers",
    body: "Patterns and weaknesses are tracked across sessions. The recruiter remembers what tripped you up last time and targets it again — just like the real thing.",
  },
];

const milestones = [
  { year: "2024", event: "Identified the gap: every prep tool gave questions but none explained why trust dropped." },
  { year: "Early 2025", event: "Built the first version: CV-aware questions with a live trust signal. First 10 users." },
  { year: "Mid 2025", event: "Launched recruiter personas, trust timeline, and weakest-answer detection." },
  { year: "Late 2025", event: "Added live AI video recruiter (Premium Pro), multi-language support, and Career Brain." },
  { year: "2026", event: "Expanding to B2B, career coaches, and university career centres globally." },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#050a12] text-white">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden px-5 py-8 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_34%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.16),transparent_35%)]" />

        <div className="relative mx-auto max-w-6xl">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-black text-slate-300 transition hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Back home
          </Link>

          <div className="mt-12 grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
            {/* Photo */}
            <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-3 shadow-2xl shadow-blue-950/30 lg:mx-0">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] bg-slate-900">
                <Image
                  src="/about-haritha.jpg"
                  alt="Haritha Vijayakumar, Founder of WorkZo AI"
                  fill
                  priority
                  className="object-cover object-center"
                  sizes="(max-width: 1024px) 90vw, 420px"
                />
              </div>
            </div>

            {/* Bio */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-cyan-100">
                <Sparkles className="h-4 w-4" />
                The founder
              </div>

              <h1 className="mt-6 text-4xl font-black tracking-[-0.05em] sm:text-6xl">
                Haritha<br />Vijayakumar
              </h1>
              <p className="mt-3 text-xl font-black text-blue-100">
                Founder & Builder, WorkZo AI
              </p>

              <blockquote className="mt-7 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-lg leading-9 text-slate-200 shadow-2xl shadow-black/20">
                &ldquo;After years helping customers solve technical problems — and navigating my own job search — I realised every prep tool missed the same thing: they gave you questions but never explained why a recruiter&apos;s trust dropped. That&apos;s the gap WorkZo fills.&rdquo;
              </blockquote>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {badges.map((badge) => {
                  const Icon = badge.icon;
                  return (
                    <div key={badge.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <Icon className="h-5 w-5 text-cyan-200" />
                      <p className="mt-3 text-sm font-black leading-5 text-white">{badge.label}</p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/pricing?intent=interview"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-500 px-6 py-4 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400"
                >
                  Start practicing
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4 text-sm font-black text-slate-200 transition hover:bg-white/10"
                >
                  Get in touch
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why I built it ── */}
      <section className="px-5 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">The problem</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
              Most people lose interviews they were qualified for.
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-300">
              The gap between being qualified and getting the offer comes down to one thing: how you communicate under pressure. Existing prep tools give you more questions to memorise. WorkZo gives you a mirror — showing recruiter trust rising and falling in real time, so you know exactly what to fix.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {principles.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.title} className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl border border-blue-400/20 bg-blue-500/10">
                    <Icon className="h-5 w-5 text-blue-300" />
                  </div>
                  <p className="mt-4 text-sm font-black text-white">{p.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{p.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Journey ── */}
      <section className="px-5 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-white/[0.025] p-8 sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">The journey</p>
          <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">From idea to product</h2>

          <div className="mt-8 space-y-0">
            {milestones.map((m, i) => (
              <div key={m.year} className="relative flex gap-6">
                {/* Timeline line */}
                <div className="flex flex-col items-center">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-blue-400/30 bg-blue-500/10">
                    <div className="h-2 w-2 rounded-full bg-blue-400" />
                  </div>
                  {i < milestones.length - 1 && (
                    <div className="w-px flex-1 bg-white/[0.07] my-1" />
                  )}
                </div>
                <div className="pb-8">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-300">{m.year}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-300">{m.event}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Values ── */}
      <section className="px-5 pb-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-white/[0.035] p-8 sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">What we stand for</p>
          <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Built on a few simple beliefs</h2>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              "Practice should feel like the real interview — not a quiz.",
              "Every candidate deserves to know why they failed, not just that they did.",
              "The best prep tool is one that gets smarter the more you use it.",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                <p className="mt-4 text-sm font-bold leading-6 text-slate-200">{item}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
            <Link
              href="/pricing?intent=interview"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-500 px-6 py-4 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400"
            >
              Try WorkZo AI free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/roadmap"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4 text-sm font-black text-slate-200 transition hover:bg-white/10"
            >
              See the roadmap
            </Link>
          </div>
        </div>
      </section>

      <WorkZoFooter />
    </main>
  );
}
