import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2, Lock, Quote, Sparkles } from "lucide-react";
import {
  MarketingShell, Reveal, Eyebrow, BackLink, PrimaryButton, GhostButton, CTASection,
} from "@/components/marketing/kit";

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
    eyebrow: "Interview Practice",
    title: "Practice with a recruiter that reacts to your answers.",
    description: "WorkZo AI uses your CV, target role, and job context to run realistic recruiter-style interviews with follow-up questions, pressure checks, and role-aware feedback.",
    freePreview: ["CV and job-aware interview setup", "Realistic recruiter questions", "Basic interview score preview"],
    premium: ["Company-specific recruiter styles", "Trust score and contradiction audit", "Full transcript timeline and answer rewrites", "Saved interview history and progress tracking"],
    example: "Instead of a generic question, WorkZo can ask: \u2018You mentioned customer escalations in your CV. How would you handle a similar stakeholder conflict in this target role?\u2019",
    cta: "Start interview practice",
  },
  "improve-cv": {
    eyebrow: "Improve CV",
    title: "Turn your CV into a stronger recruiter-ready profile.",
    description: "Improve CV helps identify missing metrics, weak ownership, role gaps, and unclear impact so your resume reads more like a strong candidate story.",
    freePreview: ["CV parsing and role context preview", "High-level improvement guidance", "Basic ATS-style signal check"],
    premium: ["Recruiter 6-second scan simulation", "Evidence detector for every major bullet", "Top 10% rewrite suggestions", "Company DNA optimization for your target role"],
    example: "Current: \u2018Handled support tickets.\u2019 Improved: \u2018Resolved 40+ technical support tickets weekly while improving first-response quality and customer satisfaction.\u2019",
    cta: "Unlock CV intelligence",
  },
  "linkedin-optimizer": {
    eyebrow: "AI LinkedIn Career Optimizer",
    title: "Not a profile checker. It already knows your CV.",
    description: "Every other LinkedIn tool reads one document. WorkZo reads two, and compares them. It finds the title your CV and LinkedIn disagree on, the skills you listed in one place and forgot in the other, and the keywords a recruiter searches for that your profile never says out loud.",
    freePreview: ["CV vs LinkedIn consistency score", "Every title, tenure, and role mismatch a recruiter would spot", "Skills on your CV that never appear on LinkedIn", "LinkedIn vs job description match score"],
    premium: ["AI rewrite of your headline and About section", "Built only from keywords your CV can prove", "Every unprovable claim removed before you see it"],
    example: "Power BI is missing from your profile. So is Tableau. Only one of those is a gap: your CV proves Tableau, so add it today. Nothing in your CV supports Power BI, so WorkZo will not write it for you.",
    cta: "Check my LinkedIn",
  },
  "cover-letter": {
    eyebrow: "Cover Letter",
    title: "Create a focused letter that doesn't sound generic.",
    description: "WorkZo generates cover letters using your CV and job context, then checks if the letter is too generic, too long, or missing a strong hiring-manager hook.",
    freePreview: ["Cover letter structure preview", "Role and company context guidance", "Basic readability check"],
    premium: ["Professional, confident, story-driven, and executive versions", "Hiring manager hook generator", "Red-flag scanner for generic wording", "JD requirement vs candidate evidence match matrix"],
    example: "WorkZo doesn't only write a letter. It shows why your experience matches the job and where the letter may sound weak to a hiring manager.",
    cta: "Unlock cover letter tools",
  },
  "job-assist": {
    eyebrow: "Job Assist",
    title: "Understand the job before you apply.",
    description: "Job Assist turns a job description into a preparation plan: missing requirements, recruiter concerns, likely interview questions, and a readiness score.",
    freePreview: ["Job description breakdown", "Role summary and basic match view", "Preparation checklist preview"],
    premium: ["Interview readiness percentage", "Missing requirements detector", "Recruiter question forecast", "Objection predictor and application risk scanner"],
    example: "For a role asking for SQL, stakeholder communication, and Power BI, WorkZo can show what your CV proves, what is missing, and what the recruiter will likely ask.",
    cta: "Unlock job preparation",
  },
  "results-intelligence": {
    eyebrow: "Results Intelligence",
    title: "See what the recruiter heard, not just what you said.",
    description: "The results report explains hiring confidence, trust changes, weak answers, red flags, company alignment, and how to answer better next time.",
    freePreview: ["Overall score and quick win", "Basic communication and confidence feedback", "Premium report preview"],
    premium: ["Full question-by-question timeline", "What the recruiter heard translation layer", "Top 10% answer rewrites", "Trust audit, contradictions, and company DNA benchmark"],
    example: "You say: \u2018I usually do what my manager asks.\u2019 The recruiter hears: \u2018May lack autonomy unless they clarify ownership and decision-making.\u2019",
    cta: "Unlock full report",
  },
};

export function generateStaticParams() {
  return Object.keys(features).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const feature = features[slug];
  return {
    title: feature ? `${feature.eyebrow}, WorkZo AI` : "Features, WorkZo AI",
    description: feature?.description || "Explore WorkZo AI features.",
  };
}

export default async function FeaturePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const feature = features[slug];
  if (!feature) notFound();

  return (
    <MarketingShell>
      <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 lg:px-8">
        <BackLink href="/">Back home</BackLink>
      </div>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-12 pt-8 sm:px-6 lg:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] border border-line bg-gradient-to-br from-brand/[0.12] via-surface/60 to-transparent p-8 sm:p-12">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand/10 blur-3xl" />
            <Eyebrow icon={Sparkles}>{feature.eyebrow}</Eyebrow>
            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">{feature.title}</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted">{feature.description}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <PrimaryButton href="/pricing?intent=upgrade">{feature.cta}</PrimaryButton>
              <GhostButton href="/onboarding">Try a free interview</GhostButton>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Free vs premium */}
      <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-2xl border border-success/25 bg-success/[0.06] p-6 sm:p-7">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-success">Free preview</p>
              <h2 className="mt-3 text-xl font-black tracking-tight">What you can see before upgrading</h2>
              <ul className="mt-5 space-y-3">
                {feature.freePreview.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-6 text-fg">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />{item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="h-full rounded-2xl border border-brand/25 bg-brand/[0.07] p-6 sm:p-7">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">Premium unlock</p>
              <h2 className="mt-3 text-xl font-black tracking-tight">What paid plans add</h2>
              <ul className="mt-5 space-y-3">
                {feature.premium.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-6 text-fg">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-brand" />{item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Example */}
      <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6 lg:px-8">
        <Reveal>
          <div className="rounded-2xl border border-line bg-surface/60 p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                <Quote className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-muted">In practice</p>
                <p className="mt-3 max-w-3xl text-lg leading-8 text-fg">{feature.example}</p>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <CTASection
        title="Ready to try it?"
        intro="Run a realistic interview and see the difference for yourself."
        primary={{ href: "/pricing?intent=upgrade", label: feature.cta }}
        secondary={{ href: "/onboarding", label: "Start free" }}
      />
    </MarketingShell>
  );
}
