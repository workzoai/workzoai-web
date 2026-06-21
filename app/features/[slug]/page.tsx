import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Lock, ShieldCheck, Sparkles } from "lucide-react";

export const dynamic = "force-static";

type Feature = {
  title: string;
  eyebrow: string;
  description: string;
  freePreview: string[];
  premium: string[];
  example: string;
  cta: string;
};

const features: Record<string, Feature> = {
  "interview-practice": {
    eyebrow: "Real Interview AI",
    title: "Practice with a recruiter that reacts to your answers.",
    description:
      "WorkZo AI uses your CV, target role, and job context to run realistic recruiter-style interviews with follow-up questions, pressure checks, and role-aware feedback.",
    freePreview: [
      "CV + job-aware interview setup",
      "Realistic recruiter questions",
      "Basic interview score preview",
    ],
    premium: [
      "Company-specific recruiter styles",
      "Trust score and contradiction audit",
      "Full transcript timeline and answer rewrites",
      "Saved interview history and progress tracking",
    ],
    example:
      "Instead of asking a generic question, WorkZo can ask: ‘You mentioned customer escalations in your CV. How would you handle a similar stakeholder conflict in this target role?’",
    cta: "Start interview practice",
  },
  "improve-cv": {
    eyebrow: "Improve CV",
    title: "Turn your CV into a stronger recruiter-ready profile.",
    description:
      "Improve CV helps identify missing metrics, weak ownership, role gaps, and unclear impact so your resume reads more like a strong candidate story.",
    freePreview: [
      "CV parsing and role context preview",
      "High-level improvement guidance",
      "Basic ATS-style signal check",
    ],
    premium: [
      "Recruiter 6-second scan simulation",
      "Evidence detector for every major bullet",
      "Top 10% rewrite suggestions",
      "Company DNA optimization for your target role",
    ],
    example:
      "Current: ‘Handled support tickets.’ Improved: ‘Resolved 40+ technical support tickets weekly while improving first-response quality and customer satisfaction.’",
    cta: "Unlock CV intelligence",
  },
  "cover-letter": {
    eyebrow: "Cover Letter",
    title: "Create a focused letter that does not sound generic.",
    description:
      "WorkZo generates cover letters using your CV and job context, then checks if the letter is too generic, too long, or missing a strong hiring-manager hook.",
    freePreview: [
      "Cover letter structure preview",
      "Role and company context guidance",
      "Basic readability check",
    ],
    premium: [
      "Professional, confident, story-driven, and executive versions",
      "Hiring manager hook generator",
      "Red-flag scanner for generic wording",
      "JD requirement vs candidate evidence match matrix",
    ],
    example:
      "WorkZo does not only write a letter. It shows why your experience matches the job and where the letter may sound weak to a hiring manager.",
    cta: "Unlock cover letter tools",
  },
  "job-assist": {
    eyebrow: "Job Assist",
    title: "Understand the job before you apply.",
    description:
      "Job Assist turns a job description into a preparation plan: missing requirements, recruiter concerns, likely interview questions, and readiness score.",
    freePreview: [
      "Job description breakdown",
      "Role summary and basic match view",
      "Preparation checklist preview",
    ],
    premium: [
      "Interview readiness percentage",
      "Missing requirements detector",
      "Recruiter question forecast",
      "Objection predictor and application risk scanner",
    ],
    example:
      "For a role asking SQL, stakeholder communication, and Power BI, WorkZo can show what your CV proves, what is missing, and what the recruiter will likely ask.",
    cta: "Unlock job preparation",
  },
  "results-intelligence": {
    eyebrow: "Results Intelligence",
    title: "See what the recruiter heard, not just what you said.",
    description:
      "The results report explains hiring confidence, trust changes, weak answers, red flags, company alignment, and how to answer better next time.",
    freePreview: [
      "Overall score and quick win",
      "Basic communication and confidence feedback",
      "Premium report preview",
    ],
    premium: [
      "Full question-by-question timeline",
      "What recruiter heard translation layer",
      "Top 10% answer rewrites",
      "Trust audit, contradictions, and company DNA benchmark",
    ],
    example:
      "User says: ‘I usually do what my manager asks.’ Recruiter hears: ‘May lack autonomy unless they clarify ownership and decision-making.’",
    cta: "Unlock full report",
  },
};

export function generateStaticParams() {
  return Object.keys(features).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const feature = features[slug];
  return {
    title: feature ? `${feature.eyebrow} | WorkZo AI` : "Feature | WorkZo AI",
    description: feature?.description || "Explore WorkZo AI features.",
  };
}

export default async function FeaturePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const feature = features[slug] || features["interview-practice"];

  return (
    <main className="min-h-screen bg-[#050a12] px-5 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-black text-slate-300 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back home
        </Link>

        <section className="mt-10 rounded-lg border border-white/10 bg-gradient-to-br from-blue-500/15 via-violet-500/10 to-white/[0.03] p-7 sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-100">
            <Sparkles className="h-4 w-4" />
            {feature.eyebrow}
          </div>
          <h1 className="mt-6 max-w-4xl text-4xl font-black tracking-[-0.04em] sm:text-4xl">{feature.title}</h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">{feature.description}</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/pricing?intent=upgrade" className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-500 px-6 py-4 text-sm font-black text-white hover:bg-blue-400">
              {feature.cta}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/pricing?intent=interview" className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-6 py-4 text-sm font-black text-slate-200 hover:bg-white/10">
              Try free interview
            </Link>
          </div>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className="rounded-lg border border-emerald-300/20 bg-emerald-400/[0.06] p-6">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-300">Free preview</p>
            <h2 className="mt-3 text-2xl font-black">What users can see before upgrading</h2>
            <div className="mt-5 space-y-3">
              {feature.freePreview.map((item) => (
                <div key={item} className="flex gap-3 text-sm leading-6 text-slate-200">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-blue-300/20 bg-blue-500/[0.08] p-6">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-blue-200">Premium unlock</p>
            <h2 className="mt-3 text-2xl font-black">What becomes available for paid users</h2>
            <div className="mt-5 space-y-3">
              {feature.premium.map((item) => (
                <div key={item} className="flex gap-3 text-sm leading-6 text-slate-200">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-blue-200" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-amber-400/10 text-amber-200">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.22em] text-slate-400">Example</p>
              <p className="mt-3 max-w-3xl text-base leading-8 text-slate-200">{feature.example}</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
