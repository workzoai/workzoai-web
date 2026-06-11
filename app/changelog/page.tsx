import Link from "next/link";
import { ArrowLeft, CheckCircle2, Sparkles, Zap } from "lucide-react";
import WorkZoFooter from "@/components/WorkZoFooter";

export const metadata = {
  title: "Changelog | WorkZo AI",
  description: "WorkZo AI product updates — new features, improvements, and fixes.",
};

const changes = [
  {
    version: "v1.4",
    title: "Intelligence and voice fully wired",
    date: "June 2026",
    highlight: true,
    items: [
      "Recruiter interruption engine — cuts off rambling answers mid-sentence",
      "Recruiter visual states — Sceptical, Interested, Hold on, Taking notes overlays",
      "Filler word counter — um, uh, like, you know tracked live in copilot panel",
      "ElevenLabs per-recruiter voice — Sarah, Daniel, Priya, Markus each have a distinct voice",
      "Shareable contradiction moments — when AI catches a false claim, share the moment",
      "Free plan correctly limited to 2 interviews per month with usage counter",
      "Vapi voice fixed for Premium plan — was incorrectly requiring Premium Pro",
      "All browser TTS fallback paths wired for every Vapi failure scenario",
    ],
  },
  {
    version: "v1.3",
    title: "Premium Pro career platform",
    date: "May 2026",
    highlight: false,
    items: [
      "7 Premium Pro recruiter personas — FAANG, Startup Founder, Consulting Partner, Sales Director, Product Leader, Executive, Enterprise",
      "AI Career Coach weekly priorities on dashboard and results",
      "30/60/90 day career roadmaps from session history",
      "Replay intelligence — best answer, weakest answer, trust drops",
      "Progress tracking charts for Premium users (Score, Trust, Evidence, Ownership)",
      "Performance tracking section on results page for Premium+",
      "Tavus 60-minute timer with auto-fallback to Voice AI when limit hit",
      "Plan gating properly enforced across all API routes",
    ],
  },
  {
    version: "v1.2",
    title: "Application tools and job preparation",
    date: "April 2026",
    highlight: false,
    items: [
      "ATS keyword gap analysis — JD vs CV matched/partial/missing with score",
      "AI cover letter generation from CV + JD via Anthropic API",
      "Job fit analysis per job card with fit score, match reasons, gaps",
      "Likely interview questions generator from actual JD + CV",
      "History page with plan-based limits — free users see 3 most recent",
      "workzo_plan cookie set on checkout — API rate limiting now works correctly",
    ],
  },
  {
    version: "v1.1",
    title: "Claim verification and trust system",
    date: "March 2026",
    highlight: false,
    items: [
      "CV claim verification — company, role, years, degree, institution, project all checked against CV",
      "Trust timeline per question with reason — shown on results page",
      "Cross-session Career Brain — recruiter memory seeds from previous sessions",
      "7-language support — English, German, Dutch, French, Spanish, Italian, Portuguese",
      "Live copilot with real-time coaching during interview",
      "Session snapshot recovery — resume interview after page refresh",
    ],
  },
  {
    version: "v1.0",
    title: "Core interview platform launch",
    date: "February 2026",
    highlight: false,
    items: [
      "Vapi voice interview with 4 recruiter personas",
      "CV and JD-aware questions and follow-ups",
      "Recruiter intelligence V2 engine",
      "Stripe billing — Free, Premium €19.99, Premium Pro €39.99",
      "Supabase auth — magic link and Google OAuth",
      "Interview results with verdict, weakest moment, answer quality",
      "Dashboard, history, onboarding, and pricing pages",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <main className="min-h-screen bg-[#050a12] text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.1),transparent_34%)]" />

      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-300 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to WorkZo AI
        </Link>

        <section className="mt-10 rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-blue-200">
            <Sparkles className="h-4 w-4" /> Product updates
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-[-0.04em] sm:text-5xl">Changelog</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            Every significant improvement to WorkZo AI, in reverse chronological order.
          </p>
        </section>

        <section className="mt-8 space-y-6">
          {changes.map((change) => (
            <article key={change.version} className={`rounded-[2rem] border p-6 sm:p-8 ${change.highlight ? "border-blue-300/20 bg-blue-500/[0.06]" : "border-white/[0.07] bg-white/[0.03]"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-3">
                    {change.highlight && <Zap className="h-5 w-5 text-blue-300" />}
                    <span className={`text-sm font-black ${change.highlight ? "text-blue-300" : "text-slate-400"}`}>{change.version}</span>
                  </div>
                  <h2 className="mt-1 text-2xl font-black">{change.title}</h2>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-slate-400">{change.date}</span>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {change.items.map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sm text-slate-300">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    {item}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      </div>

      <WorkZoFooter />
    </main>
  );
}
