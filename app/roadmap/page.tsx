import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Circle, Clock3, Rocket, Sparkles, Star } from "lucide-react";
import WorkZoFooter from "@/components/WorkZoFooter";

export const metadata = {
  title: "Roadmap | WorkZo AI",
  description: "See what WorkZo AI has shipped, what is being built now, and what comes next.",
};

const shipped = [
  "CV-aware recruiter intelligence — questions built from your actual CV and JD",
  "Live trust score per answer with the exact reason shown in real time",
  "Contradiction and claim verification — AI catches unsupported facts instantly",
  "Recruiter interruption — cuts you off mid-answer when you ramble",
  "Cross-session career memory — recruiter remembers your recurring patterns",
  "7-language support with fully language-enforced recruiter replies",
  "Live copilot panel with real-time coaching during the interview",
  "Stripe billing with Free / Premium / Premium Pro tiers",
  "AI career coach, 30/60/90 roadmaps, and replay intelligence (Pro)",
  "7 Premium Pro recruiter personas: FAANG, Startup Founder, Consulting Partner, Sales Director, Product Leader, Executive, Enterprise",
  "Recruiter emotional state engine — visual reactions (sceptical, interested, interrupting)",
  "Live filler word counter — um, uh, like tracked in real time",
  "ElevenLabs per-recruiter voices",
  "Shareable interview moments — contradiction caught, trust recovery",
];

const building = [
  { label: "Candidate video self-review playback", progress: 40 },
  { label: "Speaking pace and WPM coaching in real time", progress: 30 },
  { label: "Company DNA mode — 'Practice for Google', 'Practice for McKinsey'", progress: 60 },
  { label: "In-place settings editing without returning to onboarding", progress: 50 },
  { label: "Interview probability forecasting dashboard widget", progress: 25 },
];

const planned = [
  "Mobile app — iOS and Android",
  "B2B — career coaching platform for universities and coaches",
  "Interview audit — upload a real recording for AI feedback",
  "Salary negotiation practice mode",
  "Assessment centre simulation",
  "Candidate benchmarking against top performers by role",
  "LinkedIn message and cold outreach coach",
  "API access for enterprise integrations",
];

export default function RoadmapPage() {
  return (
    <main className="min-h-screen bg-canvas text-fg">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(37, 99, 235,0.07),transparent_55%)]" />

      <div className="mx-auto max-w-5xl px-5 py-12 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-black text-muted transition hover:text-fg">
          <ArrowLeft className="h-4 w-4" /> Back home
        </Link>

        <header className="mt-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-brand">
            <Sparkles className="h-3.5 w-3.5" /> Product roadmap
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-[-0.04em] sm:text-3xl">What we're building</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
            WorkZo AI ships continuously. Here is what is already live, what is in active development, and what is coming next.
          </p>
        </header>

        {/* Shipped */}
        <section className="mt-12">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex items-center gap-2 rounded-full border border-success/20 bg-success/10 px-4 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-success">
              <CheckCircle2 className="h-3.5 w-3.5" /> Live now
            </div>
            <div className="h-px flex-1 bg-fg/[0.07]" />
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {shipped.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-xl border border-line bg-fg/[0.03] px-4 py-3 text-sm leading-5 text-muted">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                {item}
              </div>
            ))}
          </div>
        </section>

        {/* In development */}
        <section className="mt-12">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-4 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-brand">
              <Clock3 className="h-3.5 w-3.5" /> In development
            </div>
            <div className="h-px flex-1 bg-fg/[0.07]" />
          </div>
          <div className="grid gap-3">
            {building.map((item) => (
              <div key={item.label} className="rounded-xl border border-brand/10 bg-brand/[0.05] px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-black text-fg">{item.label}</p>
                  <span className="shrink-0 text-xs font-black text-brand">{item.progress}%</span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-fg/[0.07]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand to-brand transition-all"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Planned */}
        <section className="mt-12">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-4 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-brand">
              <Star className="h-3.5 w-3.5" /> Planned
            </div>
            <div className="h-px flex-1 bg-fg/[0.07]" />
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {planned.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-xl border border-line bg-fg/[0.03] px-4 py-3 text-sm leading-5 text-muted">
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-subtle" />
                {item}
              </div>
            ))}
          </div>
        </section>

        <div className="mt-12 rounded-lg border border-brand/20 bg-brand/[0.07] p-7">
          <h2 className="text-xl font-black">Have a suggestion?</h2>
          <p className="mt-2 text-sm leading-6 text-muted">The most-requested features move up the priority queue. Email us and tell us what you need.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href="mailto:support@workzoai.com?subject=WorkZo AI Feature Request" className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-black text-on-brand hover:bg-brand">
              Send a suggestion <ArrowRight className="h-4 w-4" />
            </a>
            <Link href="/pricing" className="inline-flex items-center gap-2 rounded-lg border border-line bg-fg/[0.04] px-5 py-3 text-sm font-black text-fg hover:bg-fg/10">
              View pricing
            </Link>
          </div>
        </div>
      </div>
      <WorkZoFooter />
    </main>
  );
}
