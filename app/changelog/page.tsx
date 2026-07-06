import type { Metadata } from "next";
import { CheckCircle2, Sparkles, Zap } from "lucide-react";
import { MarketingShell, Reveal, Eyebrow, CTASection, BackLink } from "@/components/marketing/kit";

export const metadata: Metadata = {
  title: "Changelog — WorkZo AI",
  description: "Product updates, new features, intelligence upgrades, and fixes for WorkZo AI.",
};

const changes = [
  {
    version: "v1.4", label: "Latest", tone: "success",
    title: "Intelligence and voice fully wired", date: "June 2026",
    highlights: ["Recruiter interrupts live", "Visual emotional states", "Filler word counter"],
    items: [
      "Recruiter interruption engine, cuts off rambling answers mid-sentence in real time",
      "Recruiter visual states: Sceptical, Interested, Interrupting, Typing notes overlaid on the recruiter panel",
      "Live filler word counter, tracked during listening with a copilot alert",
      "Emotional memory engine, tracks vague answers and missing metrics across answers with pattern callbacks",
      "ElevenLabs per-recruiter voices, each persona has a distinct voice (tier-2 fallback)",
      "Company simulation engine, adapts question pressure to startup, corporate, consulting, or Big Tech mode",
      "Shareable interview moments, contradiction caught and trust recovery detected for social sharing",
    ],
  },
  {
    version: "v1.3", label: "Personas", tone: "brand",
    title: "7 Premium Pro personas launched", date: "May 2026",
    highlights: ["FAANG HM", "Consulting Partner", "Executive Recruiter"],
    items: [
      "Alex Chen, FAANG Hiring Manager (data-driven, probes every assumption)",
      "Zoe Park, Startup Founder (ownership, failure, scale pressure)",
      "James Harrington, Consulting Partner (case-style, structured delivery)",
      "Noah Jones, Sales Director (numbers-first, commercial instincts)",
      "Aisha Patel, Product Leader (user empathy, prioritisation, trade-offs)",
      "Victoria Stern, Executive Recruiter (board-ready communication, leadership narrative)",
      "David Kimura, Enterprise Recruiter (stakeholder management, governance, escalation)",
      "All 7 gated to Premium Pro; standard users see them locked in onboarding",
    ],
  },
  {
    version: "v1.2", label: "Platform", tone: "brand",
    title: "Full platform launch: billing, auth, tools", date: "April 2026",
    highlights: ["Stripe billing", "Supabase auth", "CV + Cover Letter + Jobs"],
    items: [
      "Stripe billing across Free, Premium, and Premium Pro with monthly and annual cycles",
      "Supabase auth, email magic link and Google sign-in with secure session handling",
      "Improve CV page, ATS keyword gap analysis with matched/partial/missing chips and a score",
      "Cover Letter generator, CV and JD-aware, 350-word limit, no generic filler",
      "Job Assist, per-job AI fit score, match reasons, gaps, an interview tip, and 7 likely questions",
      "Interview history, plan-gated for free vs premium and above",
      "Plan cookie wired to checkout; API rate limits now correctly enforced per plan",
    ],
  },
  {
    version: "v1.0", label: "Core", tone: "muted",
    title: "Core intelligence and voice", date: "March 2026",
    highlights: ["Trust timeline", "Claim verification", "Voice + browser fallback"],
    items: [
      "CV claim verification, challenges wrong company names, roles, years, degrees, and institutions in real time",
      "Trust score timeline per question with the exact reason shown, unique across prep tools",
      "Cross-session Career Brain memory, recruiter remembers your patterns across sessions",
      "Voice integration with recruiter assistants and CV/JD variable injection",
      "Browser speech fallback, auto-triggers when the voice provider fails, times out, or isn't configured",
      "Anti-hallucination grounding, CV and JD treated as verified facts, unsupported claims challenged",
      "7-language support: English, German, Dutch, French, Spanish, Italian, Portuguese",
      "Premium Pro suite: AI coach, 30/60/90 roadmaps, trend charts, and replay intelligence",
    ],
  },
];

const toneMap: Record<string, string> = {
  success: "border-success/25 bg-success/10 text-success",
  brand: "border-brand/25 bg-brand/10 text-brand",
  muted: "border-line bg-fg/[0.06] text-muted",
};

export default function ChangelogPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-6 lg:px-8">
        <BackLink href="/">Back home</BackLink>
      </div>

      <section className="mx-auto max-w-4xl px-4 pb-8 pt-8 sm:px-6 lg:px-8">
        <Reveal>
          <Eyebrow icon={Zap}>Changelog</Eyebrow>
          <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">What&apos;s new in WorkZo AI</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-muted">
            We ship continuously. Here are the releases that shaped the product, newest first.
          </p>
        </Reveal>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-8 sm:px-6 lg:px-8">
        <div className="relative">
          <div className="absolute left-[7px] top-2 bottom-2 hidden w-px bg-line sm:block" />
          <div className="space-y-6">
            {changes.map((c, i) => (
              <Reveal key={c.version} delay={i * 60}>
                <div className="relative sm:pl-10">
                  <span className="absolute left-0 top-2 hidden h-4 w-4 rounded-full border-2 border-brand bg-canvas sm:block" />
                  <article className="rounded-2xl border border-line bg-surface/70 p-6 sm:p-7">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-lg font-black tracking-tight">{c.version}</span>
                      <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide ${toneMap[c.tone]}`}>{c.label}</span>
                      <span className="ml-auto text-xs font-bold text-muted">{c.date}</span>
                    </div>
                    <h2 className="mt-3 text-xl font-black tracking-tight">{c.title}</h2>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {c.highlights.map((h) => (
                        <span key={h} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-fg/[0.04] px-2.5 py-1 text-xs font-bold text-muted">
                          <Sparkles className="h-3 w-3 text-brand" />{h}
                        </span>
                      ))}
                    </div>
                    <ul className="mt-5 space-y-2.5">
                      {c.items.map((it) => (
                        <li key={it} className="flex gap-3 text-sm leading-6 text-muted">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand/70" />{it}
                        </li>
                      ))}
                    </ul>
                  </article>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <CTASection
        title="Try the latest release"
        primary={{ href: "/onboarding", label: "Start practicing" }}
        secondary={{ href: "/roadmap", label: "See what's next" }}
      />
    </MarketingShell>
  );
}
