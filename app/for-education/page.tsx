import type { Metadata } from "next";
import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  GraduationCap,
  Handshake,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
  Target,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import {
  MarketingShell,
  Reveal,
  Eyebrow,
  SectionHeading,
  FeatureCard,
  CTASection,
  PrimaryButton,
  GhostButton,
} from "@/components/marketing/kit";
import B2BLeadForm from "@/components/marketing/B2BLeadForm";

export const metadata: Metadata = {
  title: "WorkZo AI for Education, Interview Readiness for Cohorts and Teams",
  description:
    "Give whole cohorts realistic, CV-aware interview practice with recruiter personas and shared readiness reports. Built for bootcamps, universities, training academies, coaches, and enterprise teams.",
  keywords: [
    "interview readiness for cohorts",
    "ai interview practice for universities",
    "bootcamp placement tool",
    "career services software",
    "mock interview platform for teams",
  ],
  alternates: { canonical: "/for-education" },
};

type Solution = { slug: string; label: string; description: string; icon: LucideIcon };

const SOLUTIONS: Solution[] = [
  { slug: "coding-bootcamps", label: "Coding Bootcamps", description: "Prepare graduates for technical interviews, HR screens, and hiring days.", icon: BriefcaseBusiness },
  { slug: "universities-career-services", label: "Universities and Career Services", description: "Help students build interview confidence before internships and graduate roles.", icon: GraduationCap },
  { slug: "training-academies", label: "Training Academies", description: "Support learners across certification, reskilling, and career programs.", icon: Sparkles },
  { slug: "enterprise-hiring", label: "Enterprise Hiring", description: "Standardize interview preparation for internal mobility and talent programs.", icon: Building2 },
  { slug: "recruitment-agencies", label: "Recruitment Agencies", description: "Help candidates practice before client interviews and final submissions.", icon: Handshake },
  { slug: "students", label: "For Students", description: "Help first-time job seekers walk in ready for interview day.", icon: UsersRound },
  { slug: "career-changers", label: "For Career Changers", description: "Coach clients to reframe experience for the role they want next.", icon: Target },
  { slug: "career-coaches", label: "For Career Coaches", description: "Give every client realistic reps between your sessions.", icon: MessagesSquare },
  { slug: "admin-dashboard", label: "Admin Dashboard", description: "Track engagement, usage, readiness trends, and progress across groups.", icon: BarChart3 },
  { slug: "security-privacy", label: "Security and Privacy", description: "Review GDPR-friendly data handling, privacy controls, and enterprise readiness.", icon: ShieldCheck },
];

export default function ForEducationOverviewPage() {
  return (
    <MarketingShell>
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-12 pt-12 sm:px-6 lg:px-8 lg:pt-16">
        <Reveal>
          <Eyebrow icon={GraduationCap}>For Education</Eyebrow>
          <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.03] tracking-tight sm:text-5xl lg:text-[3.5rem]">
            Interview readiness for whole cohorts, not just individuals.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
            WorkZo AI gives every learner realistic, CV-aware interviews with recruiter personas, follow-ups,
            and a live trust score. Your team gets a shared report per person, so coaching time goes to
            whoever needs it most. Pick the solution that fits your program.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <PrimaryButton href="#contact">Request a demo</PrimaryButton>
            <GhostButton href="/pricing">See plans</GhostButton>
          </div>
        </Reveal>
      </section>

      {/* Solutions grid */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Who it is for"
          title="Built for the teams that get people hired."
          intro="Every solution runs on the same engine: realistic interviews from each person's CV and target role, with reports your team can coach from."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SOLUTIONS.map((s, i) => (
            <Reveal key={s.slug} delay={i * 50}>
              <FeatureCard icon={s.icon} title={s.label} href={`/for-education/${s.slug}`}>
                {s.description}
              </FeatureCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How a pilot works */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="How it works" title="From first practice to interview-ready." />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            ["Set the target", "Each person uploads their CV and a target job description. The interview is built around that role, not a generic bank."],
            ["Practise realistically", "Learners run voice or text interviews with recruiter personas matched to the role and company style, with real follow-ups."],
            ["Coach from the report", "Your team sees a scored breakdown per person, the weakest moments, and a focused plan, so sessions go straight to what matters."],
          ].map(([title, text], i) => (
            <Reveal key={title} delay={i * 80}>
              <div className="h-full rounded-2xl border border-line bg-surface/60 p-6">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-brand/10 text-sm font-black text-brand">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-lg font-black tracking-tight">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Lead form */}
      <section id="contact" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Talk to us"
          title="Start a managed pilot."
          intro="Tell us about your cohort and we will scope a pilot with a shared minute pool and the recruiter personas that fit your placements."
        />
        <div className="mt-8">
          <B2BLeadForm source="education-overview" />
        </div>
      </section>

      <CTASection
        title="Give your next cohort a real edge."
        intro="Realistic interview practice for everyone, with reports your team can coach from."
        primary={{ href: "#contact", label: "Request a demo" }}
        secondary={{ href: "/pricing", label: "See plans" }}
      />
    </MarketingShell>
  );
}
