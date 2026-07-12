import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2, FileText, Lock, Quote, Sparkles, UploadCloud, WandSparkles } from "lucide-react";
import {
  MarketingShell, Reveal, Eyebrow, BackLink, GhostButton,
} from "@/components/marketing/kit";
import AuthAwareFeatureCTA from "@/components/marketing/AuthAwareFeatureCTA";

export const dynamic = "force-static";

type Feature = {
  title: string;
  eyebrow: string;
  description: string;
  freePreview: string[];
  premium: string[];
  example: string;
  cta: string;
  destination: string;
  needsCv: boolean;
  needsJd: boolean;
  steps?: string[];
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
    destination: "/onboarding",
    needsCv: true,
    needsJd: false,
  },
  "improve-cv": {
    eyebrow: "Improve CV",
    title: "Turn your CV into a stronger recruiter-ready profile.",
    description: "Improve CV helps identify missing metrics, weak ownership, role gaps, and unclear impact so your resume reads more like a strong candidate story.",
    freePreview: ["CV parsing and role context preview", "High-level improvement guidance", "Basic ATS-style signal check"],
    premium: ["Recruiter 6-second scan simulation", "Evidence detector for every major bullet", "Top 10% rewrite suggestions", "Company DNA optimization for your target role"],
    example: "Current: \u2018Handled support tickets.\u2019 Improved: \u2018Resolved 40+ technical support tickets weekly while improving first-response quality and customer satisfaction.\u2019",
    cta: "Improve my CV",
    destination: "/cv",
    needsCv: true,
    needsJd: true,
  },
  "linkedin-optimizer": {
    eyebrow: "AI LinkedIn Career Optimizer",
    title: "Not a profile checker. It already knows your CV.",
    description: "Every other LinkedIn tool reads one document. WorkZo reads two, and compares them. It finds the title your CV and LinkedIn disagree on, the skills you listed in one place and forgot in the other, and the keywords a recruiter searches for that your profile never says out loud.",
    freePreview: ["CV vs LinkedIn consistency score", "Every title, tenure, and role mismatch a recruiter would spot", "Skills on your CV that never appear on LinkedIn", "LinkedIn vs job description match score"],
    premium: ["AI rewrite of your headline and About section", "Built only from keywords your CV can prove", "Every unprovable claim removed before you see it"],
    example: "Power BI is missing from your profile. So is Tableau. Only one of those is a gap: your CV proves Tableau, so add it today. Nothing in your CV supports Power BI, so WorkZo will not write it for you.",
    cta: "Check my LinkedIn",
    destination: "/linkedin",
    needsCv: true,
    needsJd: false,
    steps: ["Use your saved CV or upload one", "Paste or import your LinkedIn profile", "Review mismatches, missing keywords, and recruiter risks", "Upgrade only when you want AI rewrites and advanced simulation"],
  },
  "cover-letter": {
    eyebrow: "Cover Letter",
    title: "Create a focused letter that doesn't sound generic.",
    description: "WorkZo generates cover letters using your CV and job context, then checks if the letter is too generic, too long, or missing a strong hiring-manager hook.",
    freePreview: ["Cover letter structure preview", "Role and company context guidance", "Basic readability check"],
    premium: ["Professional, confident, story-driven, and executive versions", "Hiring manager hook generator", "Red-flag scanner for generic wording", "JD requirement vs candidate evidence match matrix"],
    example: "WorkZo doesn't only write a letter. It shows why your experience matches the job and where the letter may sound weak to a hiring manager.",
    cta: "Generate my cover letter",
    destination: "/cover-letter",
    needsCv: true,
    needsJd: true,
  },
  "job-assist": {
    eyebrow: "Job Assist",
    title: "Understand the job before you apply.",
    description: "Job Assist turns a job description into a preparation plan: missing requirements, recruiter concerns, likely interview questions, and a readiness score.",
    freePreview: ["Job description breakdown", "Role summary and basic match view", "Preparation checklist preview"],
    premium: ["Interview readiness percentage", "Missing requirements detector", "Recruiter question forecast", "Objection predictor and application risk scanner"],
    example: "For a role asking for SQL, stakeholder communication, and Power BI, WorkZo can show what your CV proves, what is missing, and what the recruiter will likely ask.",
    cta: "Find live jobs",
    destination: "/jobs",
    needsCv: true,
    needsJd: false,
  },
  "ats-checker": {
    eyebrow: "ATS Resume Checker",
    title: "See what an ATS can read before you apply.",
    description: "WorkZo checks structure, keyword coverage, role relevance, and missing evidence against a real job description.",
    freePreview: ["Resume structure and parsing preview", "Keyword coverage summary", "Basic improvement priorities"],
    premium: ["Job-specific match analysis", "Missing requirement breakdown", "Evidence-backed rewrite suggestions", "Application risk signals"],
    example: "Instead of only giving a score, WorkZo explains which requirements are proven, partially proven, or missing from your CV.",
    cta: "Check my resume",
    destination: "/tools/ats-checker",
    needsCv: true,
    needsJd: true,
  },
  "resume-templates": {
    eyebrow: "Resume Templates",
    title: "Start from a real resume layout, not a wall of raw text.",
    description: "Choose a polished, ATS-safe visual template for professional, graduate, career-change, or technical profiles, then customize it with your own verified information.",
    freePreview: ["Visual template gallery", "Professional section hierarchy", "ATS-safe single-column layouts"],
    premium: ["Populate from your saved CV", "Role-specific tailoring", "PDF-ready formatting", "Integrated ATS checking"],
    example: "You see a real resume page with typography, spacing, headings, and bullet hierarchy before selecting it.",
    cta: "Choose a resume template",
    destination: "/resume-templates",
    needsCv: false,
    needsJd: false,
  },
  "results-intelligence": {
    eyebrow: "Results Intelligence",
    title: "See what the recruiter heard, not just what you said.",
    description: "The results report explains hiring confidence, trust changes, weak answers, red flags, company alignment, and how to answer better next time.",
    freePreview: ["Overall score and quick win", "Basic communication and confidence feedback", "Premium report preview"],
    premium: ["Full question-by-question timeline", "What the recruiter heard translation layer", "Top 10% answer rewrites", "Trust audit, contradictions, and company DNA benchmark"],
    example: "You say: \u2018I usually do what my manager asks.\u2019 The recruiter hears: \u2018May lack autonomy unless they clarify ownership and decision-making.\u2019",
    cta: "View results intelligence",
    destination: "/results",
    needsCv: false,
    needsJd: false,
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
              <AuthAwareFeatureCTA destination={feature.destination} label={feature.cta} featureSlug={slug} />
              <GhostButton href="/">Back to home</GhostButton>
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

      {slug === "linkedin-optimizer" ? (
        <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6 lg:px-8">
          <Reveal>
            <div className="rounded-2xl border border-line bg-canvas p-6 sm:p-8">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">LinkedIn Optimizer by plan</p>
              <h2 className="mt-3 text-2xl font-black tracking-tight">Three clear levels, with the basic audit available on Free.</h2>
              <div className="mt-6 grid gap-4 lg:grid-cols-3">
                {[
                  { name: "Free", label: "Basic audit", items: ["CV vs LinkedIn consistency score", "Missing skills and keyword gaps", "Title and experience mismatch warnings", "Action checklist you can apply manually"] },
                  { name: "Premium", label: "AI optimization", items: ["Everything in Free", "AI headline rewrite", "AI About-section rewrite", "Experience and keyword improvements based on verified CV facts"] },
                  { name: "Premium Pro", label: "Recruiter simulation", items: ["Everything in Premium", "Recruiter search simulation", "Multi-role profile variants", "Advanced discoverability and positioning guidance"] },
                ].map((plan) => (
                  <div key={plan.name} className="rounded-xl border border-line bg-surface/50 p-5">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">{plan.name}</p>
                    <h3 className="mt-2 text-lg font-black text-fg">{plan.label}</h3>
                    <ul className="mt-4 space-y-2">
                      {plan.items.map((item) => <li key={item} className="flex gap-2 text-sm leading-6 text-fg"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-success" />{item}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="mt-5 text-sm leading-6 text-muted">The current product gate is feature-based rather than a hidden monthly counter: Free can audit, Premium can generate rewrites, and Premium Pro unlocks the advanced recruiter-simulation layer.</p>
            </div>
          </Reveal>
        </section>
      ) : null}

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6 lg:px-8">
        <Reveal>
          <div className="rounded-2xl border border-line bg-canvas p-6 sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">How it works</p>
            <h2 className="mt-3 text-2xl font-black tracking-tight">Understand the feature first. Sign in only when you are ready to use it.</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-4">
              {(feature.steps || [
                feature.needsCv ? "Use your saved CV or upload one" : "Open the feature workspace",
                feature.needsJd ? "Paste the job description you want to target" : "Choose the goal or settings",
                "Run the feature and review the result",
                "Save, edit, download, or continue to the next career step",
              ]).map((step, index) => (
                <div key={step} className="rounded-xl border border-line bg-surface/50 p-4">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand/10 text-xs font-black text-brand">{index + 1}</span>
                  <p className="mt-3 text-sm font-bold leading-6 text-fg">{step}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3 text-xs font-bold text-muted">
              <span className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2"><UploadCloud className="h-4 w-4" /> {feature.needsCv ? "CV required" : "CV optional"}</span>
              <span className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2"><FileText className="h-4 w-4" /> {feature.needsJd ? "Job description required" : "Job description optional"}</span>
              <span className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2"><WandSparkles className="h-4 w-4" /> Saved account data is reused</span>
            </div>
          </div>
        </Reveal>
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

      <section className="mx-auto max-w-6xl px-4 pb-20 pt-8 text-center sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-brand/20 bg-brand/[0.07] px-6 py-10 sm:px-10">
          <h2 className="text-3xl font-black tracking-tight">Ready to try it?</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted">Already signed in? You will go straight to the tool. New users sign in once and return to this exact feature.</p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <AuthAwareFeatureCTA destination={feature.destination} label={feature.cta} featureSlug={slug} />
            <GhostButton href="/pricing">Compare plans</GhostButton>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
