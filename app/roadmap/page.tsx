import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Sparkles, Zap } from "lucide-react";
import WorkZoFooter from "@/components/WorkZoFooter";

export const metadata = {
  title: "Roadmap | WorkZo AI",
  description: "See what WorkZo AI has shipped, what is being built now, and what comes next.",
};

const shipped = [
  "CV-aware recruiter intelligence — questions built from your actual CV",
  "Trust score per answer with exact reason shown",
  "Contradiction and claim verification — AI catches unsupported facts",
  "Recruiter interruption — cuts you off when you ramble",
  "Cross-session memory — recruiter remembers your patterns",
  "7-language support with language-enforced recruiter replies",
  "Live copilot with real-time coaching during the interview",
  "Stripe billing with Free / Premium / Premium Pro plans",
  "AI career coach, 30/60/90 roadmaps, and replay intelligence (Pro)",
  "7 Premium Pro recruiter personas",
  "ElevenLabs recruiter voice per character",
  "ATS keyword gap analysis on CV page",
  "AI cover letter generation from CV + JD",
  "Job fit analysis with likely interview questions",
  "Multi-session snapshot recovery",
];

const building = [
  { title: "Company DNA interview mode", detail: "Pick 'Practice for Google', 'McKinsey', 'Series A startup', or 'Enterprise bank' — interview pressure, style, and follow-ups adapt to that specific culture." },
  { title: "Wow moment detection on results", detail: "After each session: see the exact moment trust dropped, the best comeback, and the most memorable recruiter challenge — shareable as a card." },
  { title: "Retry weak answer from results", detail: "One-click to retry your weakest answer with a suggested rewrite. Starts a new session with that specific question loaded first." },
  { title: "Speaking pace coaching", detail: "Words per minute shown in real time and in the results report. Pacing card already exists — now powered by real data from every session." },
  { title: "In-place settings editing", detail: "Change recruiter, language, and interview style without repeating the full onboarding flow." },
];

const later = [
  { title: "LinkedIn profile import", detail: "Paste a LinkedIn URL and WorkZo extracts role history, skills, and education directly." },
  { title: "Scheduled practice reminders", detail: "Set a practice goal (3x per week) and get a reminder. Session streak displayed on dashboard." },
  { title: "Interview probability score", detail: "Based on your CV, target role, and session history — a forecast of your current interview-readiness." },
  { title: "Team and coach workspace", detail: "Career coaches can assign practice sessions, track client progress, and review session reports." },
  { title: "Candidate comparison mode", detail: "See how your answers rank against strong and weak answer patterns for the same role." },
];

export default function RoadmapPage() {
  return (
    <main className="min-h-screen bg-[#050a12] text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.1),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.1),transparent_34%)]" />

      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-300 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to WorkZo AI
        </Link>

        <section className="mt-10 rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
            <Sparkles className="h-4 w-4" /> Product roadmap
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-[-0.04em] sm:text-5xl">What we are building</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            WorkZo AI ships improvements continuously. This page tracks what has been shipped, what is being built now, and what is planned next.
          </p>
        </section>

        {/* Shipped */}
        <section className="mt-8">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-400/15">
              <CheckCircle2 className="h-5 w-5 text-emerald-300" />
            </div>
            <h2 className="text-xl font-black">Shipped</h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {shipped.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                <p className="text-sm leading-6 text-slate-300">{item}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Building now */}
        <section className="mt-8">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-blue-400/15">
              <Zap className="h-5 w-5 text-blue-300" />
            </div>
            <h2 className="text-xl font-black">Building now</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {building.map((item) => (
              <div key={item.title} className="rounded-2xl border border-blue-300/15 bg-blue-500/[0.05] p-5">
                <p className="font-black text-white">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Planned */}
        <section className="mt-8">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-violet-400/15">
              <Clock className="h-5 w-5 text-violet-300" />
            </div>
            <h2 className="text-xl font-black">Planned</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {later.map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
                <p className="font-black text-white">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] border border-blue-300/20 bg-blue-500/[0.07] p-8">
          <h2 className="text-2xl font-black">Have a feature request?</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
            We build based on what users actually need. Send a suggestion and we will review it for the next sprint.
          </p>
          <a href="mailto:support@workzoai.com?subject=WorkZo AI Feature Request" className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-blue-500 px-5 py-3 text-sm font-black text-white hover:bg-blue-400">
            Send a request <ArrowRight className="h-4 w-4" />
          </a>
        </section>
      </div>

      <WorkZoFooter />
    </main>
  );
}
