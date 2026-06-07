import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BarChart3, BriefcaseBusiness, CheckCircle2, Sparkles } from "lucide-react";
import WorkZoFooter from "@/components/WorkZoFooter";

const badges = [
  {
    label: "4 Years Technical Support Experience",
    icon: BriefcaseBusiness,
  },
  {
    label: "Data Science Graduate",
    icon: BarChart3,
  },
  {
    label: "Founder of WorkZo AI",
    icon: Sparkles,
  },
];

const principles = [
  "Realistic recruiter-style practice, not generic question banks.",
  "CV and job-context aware interview preparation.",
  "Clear feedback that helps job seekers improve before the real interview.",
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#050a12] text-white">
      <section className="relative overflow-hidden px-5 py-8 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_34%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.16),transparent_35%)]" />

        <div className="relative mx-auto max-w-6xl">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-black text-slate-300 transition hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Back home
          </Link>

          <div className="mt-12 grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
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

            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-cyan-100">
                <Sparkles className="h-4 w-4" />
                About WorkZo AI
              </div>

              <h1 className="mt-6 text-4xl font-black tracking-[-0.05em] sm:text-6xl">
                Haritha Vijayakumar
              </h1>
              <p className="mt-3 text-xl font-black text-blue-100">
                Founder, WorkZo AI
              </p>

              <blockquote className="mt-7 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-lg leading-9 text-slate-200 shadow-2xl shadow-black/20">
                “After years of helping customers solve technical problems and later navigating my own job-search journey, I built WorkZo AI to make interview preparation more realistic, personalized, and accessible for job seekers worldwide.”
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
                <Link href="/pricing?intent=interview" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-500 px-6 py-4 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400">
                  Start practicing
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/contact" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4 text-sm font-black text-slate-200 transition hover:bg-white/10">
                  Contact
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">Why I built it</p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
            Interview preparation should feel closer to the real interview.
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-300">
            WorkZo AI is built to help job seekers practice with realistic recruiter questions, sharper follow-ups, and feedback that explains what to improve before the actual interview.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {principles.map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                <p className="mt-4 text-sm font-bold leading-6 text-slate-200">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <WorkZoFooter />
    </main>
  );
}
