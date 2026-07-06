import type { Metadata } from "next";
import { Check, CheckCircle2, Clock3, Rocket } from "lucide-react";
import { MarketingShell, Reveal, Eyebrow, CTASection, BackLink } from "@/components/marketing/kit";

export const metadata: Metadata = {
  title: "Roadmap — WorkZo AI",
  description: "What WorkZo AI has shipped, what is being built now, and what comes next.",
};

const shipped = [
  "CV-aware recruiter intelligence, questions built from your actual CV and JD",
  "Live trust score per answer with the exact reason shown in real time",
  "Contradiction and claim verification, AI catches unsupported facts instantly",
  "Recruiter interruption, cuts you off mid-answer when you ramble",
  "Cross-session career memory, recruiter remembers your recurring patterns",
  "7-language support with fully language-enforced recruiter replies",
  "Live copilot panel with real-time coaching during the interview",
  "Stripe billing with Free, Premium, and Premium Pro tiers",
  "AI career coach, 30/60/90 roadmaps, and replay intelligence (Pro)",
  "11 recruiter personas across HR, technical, and leadership styles",
  "Recruiter emotional state engine with visual reactions",
  "Live filler word counter, tracked in real time",
  "Per-recruiter voices",
  "Shareable interview moments",
];

const building = [
  { label: "Candidate video self-review playback", progress: 40 },
  { label: "Speaking pace and WPM coaching in real time", progress: 30 },
  { label: "Company DNA mode: practice for a specific company", progress: 60 },
  { label: "In-place settings editing without returning to onboarding", progress: 50 },
  { label: "Interview probability forecasting dashboard widget", progress: 25 },
];

const planned = [
  "Mobile app for iOS and Android",
  "B2B career-coaching platform for universities and coaches",
  "Interview audit: upload a real recording for AI feedback",
  "Salary negotiation practice mode",
  "Assessment centre simulation",
  "Candidate benchmarking against top performers by role",
  "LinkedIn message and cold outreach coach",
  "API access for enterprise integrations",
];

export default function RoadmapPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 lg:px-8">
        <BackLink href="/">Back home</BackLink>
      </div>

      <section className="mx-auto max-w-5xl px-4 pb-8 pt-8 sm:px-6 lg:px-8">
        <Reveal>
          <Eyebrow icon={Rocket}>Product roadmap</Eyebrow>
          <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">What we&apos;re building</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-muted">
            WorkZo AI ships continuously. Here&apos;s what&apos;s already live, what&apos;s in active development, and what&apos;s coming next.
          </p>
        </Reveal>
      </section>

      {/* Live now */}
      <section className="mx-auto max-w-5xl px-4 pb-12 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mb-5 flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-success/25 bg-success/10 px-4 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-success">
              <CheckCircle2 className="h-3.5 w-3.5" /> Live now
            </span>
            <span className="h-px flex-1 bg-line" />
          </div>
        </Reveal>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {shipped.map((item, i) => (
            <Reveal key={item} delay={(i % 2) * 40}>
              <div className="flex items-start gap-3 rounded-xl border border-line bg-surface/60 px-4 py-3 text-sm leading-6 text-muted">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />{item}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* In progress */}
      <section className="mx-auto max-w-5xl px-4 pb-12 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mb-5 flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-4 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-brand">
              <Clock3 className="h-3.5 w-3.5" /> In progress
            </span>
            <span className="h-px flex-1 bg-line" />
          </div>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2">
          {building.map((b, i) => (
            <Reveal key={b.label} delay={(i % 2) * 50}>
              <div className="rounded-xl border border-line bg-surface/70 p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-fg">{b.label}</p>
                  <span className="text-xs font-black tabular-nums text-brand">{b.progress}%</span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${b.progress}%` }} />
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Planned */}
      <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mb-5 flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-fg/[0.05] px-4 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-muted">
              <Rocket className="h-3.5 w-3.5" /> Planned
            </span>
            <span className="h-px flex-1 bg-line" />
          </div>
        </Reveal>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {planned.map((item, i) => (
            <Reveal key={item} delay={(i % 2) * 40}>
              <div className="flex items-start gap-3 rounded-xl border border-dashed border-line bg-transparent px-4 py-3 text-sm leading-6 text-muted">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted/50" />{item}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <CTASection
        title="Have a feature request?"
        intro="We build from real user feedback. Tell us what would make WorkZo better for you."
        primary={{ href: "mailto:support@workzoai.com?subject=WorkZo%20AI%20Feature%20Request", label: "Share an idea", external: true }}
        secondary={{ href: "/changelog", label: "See what shipped" }}
      />
    </MarketingShell>
  );
}
