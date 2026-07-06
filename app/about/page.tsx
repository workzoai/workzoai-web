import type { Metadata } from "next";
import Image from "next/image";
import {
  BarChart3, BriefcaseBusiness, CheckCircle2, Globe, Lightbulb, Mic, Sparkles, TrendingUp,
} from "lucide-react";
import {
  MarketingShell, Reveal, Eyebrow, SectionHeading, FeatureCard, CTASection, BackLink, PrimaryButton, GhostButton,
} from "@/components/marketing/kit";

export const metadata: Metadata = {
  title: "About — WorkZo AI",
  description: "Why WorkZo AI exists: interview practice that shows you why a recruiter's trust rises and falls, not just another question bank.",
};

const badges = [
  { label: "Built from real support experience", icon: BriefcaseBusiness },
  { label: "AI career-prep product", icon: BarChart3 },
  { label: "Founder of WorkZo AI", icon: Sparkles },
];

const principles = [
  { icon: Mic, title: "Realistic recruiter practice", body: "Real follow-up questions based on what you actually say, not a generic question bank. Every session adapts to your CV and the exact role you applied for." },
  { icon: TrendingUp, title: "Trust score transparency", body: "After every answer you can see recruiter trust rising or falling in real time and exactly why. No more guessing what went wrong after an interview." },
  { icon: Globe, title: "Built for global job seekers", body: "UK-style competency interviews, US tech screens, German formal structures. WorkZo is designed for candidates in any market, not just one country." },
  { icon: Lightbulb, title: "Practice that transfers", body: "Patterns and weaknesses are tracked across sessions. The recruiter remembers what tripped you up last time and targets it again, just like the real thing." },
];

const milestones = [
  { year: "2024", event: "Identified the gap: every prep tool gave questions but none explained why trust dropped." },
  { year: "Early 2025", event: "Built the first version: CV-aware questions with a live trust signal. First 10 users." },
  { year: "Mid 2025", event: "Launched recruiter personas, trust timeline, and weakest-answer detection." },
  { year: "Late 2025", event: "Added live AI video recruiter (Premium Pro), multi-language support, and Career Brain." },
  { year: "2026", event: "Expanding to B2B, career coaches, and university career centres globally." },
];

const values = [
  "Practice should feel like the real interview, not a quiz.",
  "Every candidate deserves to know why they failed, not just that they did.",
  "The best prep tool is one that gets smarter the more you use it.",
];

export default function AboutPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <BackLink href="/">Back home</BackLink>
      </div>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[300px_1fr]">
          <Reveal>
            <div className="relative mx-auto w-full max-w-[280px] overflow-hidden rounded-2xl border border-line shadow-2xl shadow-black/20">
              <div className="relative aspect-[3/4] bg-canvas">
                <Image src="/about-haritha.jpg" alt="Haritha Vijayakumar, Founder of WorkZo AI" fill priority className="object-cover object-top" sizes="280px" />
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pb-4 pt-10">
                <p className="text-sm font-black leading-tight text-white">Haritha Vijayakumar</p>
                <p className="mt-0.5 text-xs font-semibold text-white/70">Founder, WorkZo AI</p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <Eyebrow icon={Sparkles}>The founder</Eyebrow>
            <h1 className="mt-5 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">
              Interview prep that tells you why, not just what.
            </h1>
            <blockquote className="mt-6 rounded-2xl border border-line bg-surface/70 p-6 text-lg leading-8 text-fg">
              &ldquo;After years helping customers solve technical problems and navigating my own job search, I realised every prep tool missed the same thing: they gave you questions but never explained why a recruiter&apos;s trust dropped. That&apos;s the gap WorkZo fills.&rdquo;
            </blockquote>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {badges.map((b) => {
                const Icon = b.icon;
                return (
                  <div key={b.label} className="rounded-xl border border-line bg-fg/[0.04] p-4">
                    <Icon className="h-5 w-5 text-brand" />
                    <p className="mt-3 text-sm font-black leading-5 text-fg">{b.label}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <PrimaryButton href="/onboarding">Start practicing</PrimaryButton>
              <GhostButton href="/contact">Get in touch</GhostButton>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Problem + principles */}
      <section className="border-y border-line bg-canvas-soft">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <Reveal>
            <SectionHeading
              align="center"
              eyebrow="The problem"
              title="Most people lose interviews they were qualified for."
              intro="The gap between being qualified and getting the offer comes down to one thing: how you communicate under pressure. Existing tools give you more questions to memorise. WorkZo gives you a mirror, showing recruiter trust rise and fall in real time, so you know exactly what to fix."
            />
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {principles.map((p, i) => (
              <Reveal key={p.title} delay={(i % 4) * 60}>
                <FeatureCard icon={p.icon} title={p.title}>{p.body}</FeatureCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Journey */}
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <Reveal><SectionHeading eyebrow="The journey" title="From idea to product" /></Reveal>
        <div className="mt-10">
          {milestones.map((m, i) => (
            <Reveal key={m.year} delay={i * 50}>
              <div className="flex gap-6">
                <div className="flex flex-col items-center">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-brand/30 bg-brand/10">
                    <span className="h-2 w-2 rounded-full bg-brand" />
                  </span>
                  {i < milestones.length - 1 && <span className="my-1 w-px flex-1 bg-line" />}
                </div>
                <div className="pb-8">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-brand">{m.year}</p>
                  <p className="mt-1.5 text-sm leading-6 text-muted">{m.event}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Values */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <Reveal><SectionHeading eyebrow="What we stand for" title="Built on a few simple beliefs" /></Reveal>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {values.map((v, i) => (
            <Reveal key={v} delay={i * 60}>
              <div className="h-full rounded-2xl border border-line bg-surface/60 p-6">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <p className="mt-4 text-sm font-bold leading-6 text-fg">{v}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <CTASection
        title="See it for yourself"
        intro="Run a free practice interview and watch recruiter trust move in real time."
        primary={{ href: "/onboarding", label: "Try WorkZo AI free" }}
        secondary={{ href: "/roadmap", label: "See the roadmap" }}
      />
    </MarketingShell>
  );
}
