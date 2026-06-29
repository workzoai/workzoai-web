import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles, Zap } from "lucide-react";
import WorkZoFooter from "@/components/WorkZoFooter";

export const metadata = {
  title: "Changelog | WorkZo AI",
  description: "WorkZo AI product updates — new features, intelligence upgrades, and fixes.",
};

const changes = [
  {
    version: "v1.4",
    label: "Latest",
    labelStyle: "border-success/20 bg-success/10 text-success",
    title: "Intelligence and voice fully wired",
    date: "June 2026",
    highlights: ["Recruiter interrupts live", "Visual emotional states", "Filler word counter"],
    items: [
      "Recruiter interruption engine — cuts off rambling answers mid-sentence in real time",
      "Recruiter visual states — Sceptical, Interested, Interrupting, Typing notes overlays on the recruiter panel",
      "Live filler word counter — um, uh, like, you know tracked during listening with copilot alert",
      "Emotional memory engine — tracks vague answers and missing metrics across answers with pattern callbacks",
      "ElevenLabs per-recruiter voice — Sarah, Daniel, Priya, Markus each have a distinct voice (tier-2 fallback)",
      "Company simulation engine — adapts question pressure to startup, corporate, consulting, or Big Tech mode",
      "Shareable interview moments — contradiction caught and trust recovery detected for social sharing",
    ],
  },
  {
    version: "v1.3",
    label: "Personas",
    labelStyle: "border-brand/20 bg-brand/10 text-brand",
    title: "7 Premium Pro personas launched",
    date: "May 2026",
    highlights: ["FAANG HM", "Consulting Partner", "Executive Recruiter"],
    items: [
      "Alex Chen — FAANG Hiring Manager (data-driven, probes every assumption)",
      "Zoe Park — Startup Founder (ownership, failure, scale pressure)",
      "James Harrington — Consulting Partner (case-style, structured delivery)",
      "Noah Jones — Sales Director (numbers-first, commercial instincts)",
      "Aisha Patel — Product Leader (user empathy, prioritisation, trade-offs)",
      "Victoria Stern — Executive Recruiter (board-ready communication, leadership narrative)",
      "David Kimura — Enterprise Recruiter (stakeholder management, governance, escalation)",
      "All 7 gated to Premium Pro — standard users see them locked in onboarding",
    ],
  },
  {
    version: "v1.2",
    label: "Platform",
    labelStyle: "border-brand/20 bg-brand/10 text-brand",
    title: "Full platform launch — billing, auth, tools",
    date: "April 2026",
    highlights: ["Stripe billing", "Supabase auth", "CV + Cover Letter + Jobs"],
    items: [
      "Stripe billing — Free / Premium (€19.99) / Premium Pro (€39.99) with monthly and annual cycles",
      "Supabase auth — email magic link and Google OAuth with secure session handling",
      "Improve CV page — ATS keyword gap analysis, matched/partial/missing chips, score",
      "Cover Letter generator — Anthropic API, CV+JD-aware, 350-word limit, no generic filler",
      "Job Assist — per-job AI fit score, match reasons, gaps, interview tip, 7 likely questions",
      "Interview history — plan-gated (free: 3 sessions, premium+: unlimited)",
      "workzo_plan cookie wired to checkout — API rate limits now correctly enforced per plan",
    ],
  },
  {
    version: "v1.0",
    label: "Core",
    labelStyle: "border-slate-300/20 bg-slate-400/10 text-fg",
    title: "Core intelligence and voice",
    date: "March 2026",
    highlights: ["Trust timeline", "Claim verification", "Vapi + browser voice"],
    items: [
      "CV claim verification — challenges wrong company names, roles, years, degrees, institutions in real time",
      "Trust score timeline per question with exact reason — unique across all prep tools",
      "Cross-session Career Brain memory — recruiter remembers your patterns across sessions",
      "Vapi voice integration with 4 recruiter assistant IDs and CV/JD variable injection",
      "Browser TTS fallback — auto-triggers when Vapi fails, times out, or is not configured",
      "Anti-hallucination grounding — CV and JD treated as verified facts, unsupported claims challenged",
      "7-language support: English, German, Dutch, French, Spanish, Italian, Portuguese",
      "Premium Pro suite panel — AI coach, 30/60/90 roadmaps, SmallTrend charts, replay intelligence",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <main className="min-h-screen bg-canvas text-fg">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(37, 99, 235,0.07),transparent_55%)]" />

      <div className="mx-auto max-w-4xl px-5 py-12 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-black text-muted transition hover:text-fg">
          <ArrowLeft className="h-4 w-4" /> Back home
        </Link>

        <header className="mt-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-brand">
            <Sparkles className="h-3.5 w-3.5" /> Product updates
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-[-0.04em] sm:text-3xl">Changelog</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted">
            A full record of every feature, intelligence upgrade, and improvement shipped to WorkZo AI.
          </p>
        </header>

        <div className="mt-12 space-y-12">
          {changes.map((change, idx) => (
            <article key={change.version} className="relative pl-8">
              {idx < changes.length - 1 && (
                <div className="absolute left-3 top-8 h-full w-px bg-fg/[0.07]" />
              )}
              <div className="absolute left-0 top-1.5 grid h-6 w-6 place-items-center rounded-full border border-brand/30 bg-brand/10">
                <div className="h-2 w-2 rounded-full bg-brand" />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${change.labelStyle}`}>
                  {change.label}
                </span>
                <span className="text-xs font-bold text-subtle">{change.version}</span>
                <span className="rounded-full border border-line bg-fg/[0.04] px-3 py-1 text-xs font-bold text-muted">
                  {change.date}
                </span>
              </div>

              <h2 className="mt-3 text-2xl font-black">{change.title}</h2>

              <div className="mt-2.5 flex flex-wrap gap-2">
                {change.highlights.map((h) => (
                  <span key={h} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-fg/[0.04] px-3 py-1 text-xs font-bold text-muted">
                    <Zap className="h-3 w-3 text-warning" />
                    {h}
                  </span>
                ))}
              </div>

              <div className="mt-5 rounded-lg border border-line bg-fg/[0.03] p-5 space-y-2.5">
                {change.items.map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sm leading-5 text-muted">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    {item}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-14 rounded-lg border border-brand/20 bg-brand/[0.07] p-7">
          <h2 className="text-xl font-black">Try the latest version</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Every improvement above is live. Start a free interview and see the intelligence in action.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/onboarding" className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-black text-on-brand hover:bg-brand">
              Start free interview <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/roadmap" className="inline-flex items-center gap-2 rounded-lg border border-line bg-fg/[0.04] px-5 py-3 text-sm font-black text-fg hover:bg-fg/10">
              View roadmap
            </Link>
          </div>
        </div>
      </div>
      <WorkZoFooter />
    </main>
  );
}
