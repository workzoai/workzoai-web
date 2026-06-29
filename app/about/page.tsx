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
    body: "After every answer you can see recruiter trust rising or falling in real time and exactly why. No more guessing what went wrong after an interview.",
  },
  {
    icon: Globe,
    title: "Built for global job seekers",
    body: "UK-style competency interviews, US tech screens, German formal structures- WorkZo is designed for candidates in any market, not just one country.",
  },
  {
    icon: Lightbulb,
    title: "Practice that transfers",
    body: "Patterns and weaknesses are tracked across sessions. The recruiter remembers what tripped you up last time and targets it again. Just like the real thing.",
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
    <main className="min-h-screen bg-canvas text-fg">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden px-5 py-8 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37, 99, 235,0.14),transparent_34%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.16),transparent_35%)]" />

        <div className="relative mx-auto max-w-6xl">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-black text-muted transition hover:text-fg">
            <ArrowLeft className="h-4 w-4" />
            Back home
          </Link>

          <div className="mt-12 grid items-center gap-10 lg:grid-cols-[1fr_1.4fr]">
            {/* Photo — compact, professional headshot style */}
            <div className="mx-auto w-full max-w-[260px] lg:mx-0 lg:max-w-[280px]">
              <div className="relative overflow-hidden rounded-2xl border border-line shadow-xl shadow-brand/40">
                <div className="relative aspect-[3/4] overflow-hidden bg-canvas">
                  <Image
                    src="/about-haritha.jpg"
                    alt="Haritha Vijayakumar, Founder of WorkZo AI"
                    fill
                    priority
                    className="object-cover object-top"
                    sizes="(max-width: 1024px) 260px, 280px"
                  />
                </div>
                {/* Name badge pinned to bottom of photo */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-4 pt-10">
                  <p className="text-sm font-black text-fg leading-tight">Haritha Vijayakumar</p>
                  <p className="text-xs text-brand font-semibold mt-0.5">Founder, WorkZo AI</p>
                </div>
              </div>
            </div>

            {/* Bio */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-brand">
                <Sparkles className="h-4 w-4" />
                The founder
              </div>

              <h1 className="mt-6 text-4xl font-black tracking-[-0.05em] sm:text-4xl">
                Haritha<br />Vijayakumar
              </h1>
              <p className="mt-3 text-xl font-black text-brand">
                Founder & Builder, WorkZo AI
              </p>

              <blockquote className="mt-7 rounded-lg border border-line bg-fg/[0.04] p-6 text-lg leading-9 text-fg shadow-2xl shadow-black/20">
                &ldquo;After years helping customers solve technical problems and navigating my own job search, I realised every prep tool missed the same thing: they gave you questions but never explained why a recruiter&apos;s trust dropped. That&apos;s the gap WorkZo fills.&rdquo;
              </blockquote>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {badges.map((badge) => {
                  const Icon = badge.icon;
                  return (
                    <div key={badge.label} className="rounded-lg border border-line bg-fg/[0.04] p-4">
                      <Icon className="h-5 w-5 text-brand" />
                      <p className="mt-3 text-sm font-black leading-5 text-fg">{badge.label}</p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/pricing?intent=interview"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-6 py-4 text-sm font-black text-on-brand shadow-lg shadow-brand/20 transition hover:bg-brand"
                >
                  Start practicing
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-fg/[0.04] px-6 py-4 text-sm font-black text-fg transition hover:bg-fg/10"
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
            <p className="text-xs font-black uppercase tracking-[0.24em] text-brand">The problem</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
              Most people lose interviews they were qualified for.
            </h2>
            <p className="mt-5 text-base leading-8 text-muted">
              The gap between being qualified and getting the offer comes down to one thing: how you communicate under pressure. Existing prep tools give you more questions to memorise. WorkZo gives you a mirror — showing recruiter trust rising and falling in real time, so you know exactly what to fix.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {principles.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.title} className="rounded-xl border border-line bg-fg/[0.035] p-6">
                  <div className="grid h-10 w-10 place-items-center rounded-lg border border-brand/20 bg-brand/10">
                    <Icon className="h-5 w-5 text-brand" />
                  </div>
                  <p className="mt-4 text-sm font-black text-fg">{p.title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted">{p.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Journey ── */}
      <section className="px-5 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl rounded-lg border border-line bg-fg/[0.025] p-8 sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-brand">The journey</p>
          <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">From idea to product</h2>

          <div className="mt-8 space-y-0">
            {milestones.map((m, i) => (
              <div key={m.year} className="relative flex gap-6">
                <div className="flex flex-col items-center">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-brand/30 bg-brand/10">
                    <div className="h-2 w-2 rounded-full bg-brand" />
                  </div>
                  {i < milestones.length - 1 && (
                    <div className="w-px flex-1 bg-fg/[0.07] my-1" />
                  )}
                </div>
                <div className="pb-8">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-brand">{m.year}</p>
                  <p className="mt-1 text-sm leading-6 text-muted">{m.event}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Values ── */}
      <section className="px-5 pb-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl rounded-lg border border-line bg-fg/[0.035] p-8 sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-brand">What we stand for</p>
          <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Built on a few simple beliefs</h2>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              "Practice should feel like the real interview — not a quiz.",
              "Every candidate deserves to know why they failed, not just that they did.",
              "The best prep tool is one that gets smarter the more you use it.",
            ].map((item) => (
              <div key={item} className="rounded-lg border border-line bg-canvas-soft p-5">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <p className="mt-4 text-sm font-bold leading-6 text-fg">{item}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
            <Link
              href="/pricing?intent=interview"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-6 py-4 text-sm font-black text-on-brand shadow-lg shadow-brand/20 transition hover:bg-brand"
            >
              Try WorkZo AI free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/roadmap"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-fg/[0.04] px-6 py-4 text-sm font-black text-fg transition hover:bg-fg/10"
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
