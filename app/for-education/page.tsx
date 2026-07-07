import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  GraduationCap,
  Handshake,
  ShieldCheck,
  UsersRound,
  GaugeCircle,
  Layers,
  Languages,
} from "lucide-react";
import {
  MarketingShell,
  Reveal,
  Eyebrow,
  SectionHeading,
  StatBand,
  FeatureCard,
  CTASection,
  BackLink,
  PrimaryButton,
  GhostButton,
} from "@/components/marketing/kit";
import B2BLeadForm from "@/components/marketing/B2BLeadForm";

export const metadata: Metadata = {
  title: "For Education & Organizations, WorkZo AI",
  description:
    "Realistic, CV-aware interview practice for bootcamps, universities, training academies, enterprises, and recruitment agencies. One engine, every cohort, measurable readiness.",
};

const segments = [
  { slug: "coding-bootcamps", label: "Coding Bootcamps", desc: "Get every cohort placement-ready before demo day.", icon: BriefcaseBusiness },
  { slug: "universities-career-services", label: "Universities & Career Services", desc: "Practice for every student, not just the ones who book a slot.", icon: GraduationCap },
  { slug: "training-academies", label: "Training Academies", desc: "Turn certifications into confident, interview-ready stories.", icon: UsersRound },
  { slug: "enterprise-hiring", label: "Enterprise Hiring", desc: "One fair preparation standard across teams and locations.", icon: Building2 },
  { slug: "recruitment-agencies", label: "Recruitment Agencies", desc: "Send candidates into client interviews genuinely ready.", icon: Handshake },
  { slug: "admin-dashboard", label: "Admin Dashboard", desc: "Track readiness across cohorts, teams, and programs.", icon: BarChart3 },
  { slug: "security-privacy", label: "Security & Privacy", desc: "GDPR-friendly, transparent, managed rollout.", icon: ShieldCheck },
];

const pillars = [
  { icon: GaugeCircle, title: "Measurable readiness", text: "Every session produces a scored report, so you can see who's ready for a hiring partner and who needs another round of coaching." },
  { icon: Layers, title: "One engine, every role", text: "Interviews are built from the job description, so the same platform covers technical, business, support, and customer-facing roles." },
  { icon: Languages, title: "Any market, any language", text: "Practice in the language and interview culture of the target market, useful for international students and roles abroad." },
];

const capabilities = [
  { icon: BarChart3, title: "Cohort rejection-risk heatmaps", text: "See where a cohort is weak — communication, evidence, job fit — as a live heatmap, with the top reasons candidates would be rejected." },
  { icon: GaugeCircle, title: "WorkZo Readiness Index", text: "One comparable readiness score per learner and per cohort, benchmarked against the wider WorkZo network rather than a guess." },
  { icon: GraduationCap, title: "Curriculum insights", text: "Weak interview patterns become concrete workshop and coaching actions, with the percentage of students affected." },
  { icon: Handshake, title: "Vetted shortlist portal", text: "Share an opt-in, bias-aware talent pipeline with employer partners: readiness bands, skills, languages, and interview evidence — no public ranking." },
  { icon: UsersRound, title: "Human-in-the-loop review", text: "Flag exceptional or at-risk candidates for a human read. Your team gets a review queue and an instant Slack, Teams, or ATS alert." },
  { icon: Layers, title: "Company interview templates", text: "Learners practice the real thing — SAP, Bosch, BMW, Siemens, Amazon, Google and more — with the right rounds and recruiter tone." },
];

export default function ForEducationOverview() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <BackLink href="/">Back home</BackLink>
      </div>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-8 text-center sm:px-6 lg:px-8">
        <Reveal>
          <div className="flex justify-center"><Eyebrow icon={GraduationCap}>For Education & Organizations</Eyebrow></div>
          <h1 className="mx-auto mt-5 max-w-4xl text-4xl font-black leading-[1.03] tracking-tight sm:text-5xl lg:text-6xl">
            Interview readiness for your whole cohort, not just the confident few.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted">
            WorkZo AI gives every student, learner, or candidate realistic, CV-aware interview practice, and gives your team the readiness signals to coach the people who need it, before the deadline.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <PrimaryButton href="#contact">Request a demo</PrimaryButton>
            <GhostButton href="/pricing">See plans</GhostButton>
          </div>
        </Reveal>

        <Reveal delay={100} className="mx-auto mt-14 max-w-4xl">
          <StatBand
            stats={[
              { value: "1 engine", label: "for every role, industry, and language" },
              { value: "11", label: "recruiter personas across the full loop" },
              { value: "Group view", label: "readiness and engagement at a glance" },
            ]}
          />
        </Reveal>
      </section>

      {/* Pillars */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-3">
          {pillars.map((p, i) => (
            <Reveal key={p.title} delay={i * 70}>
              <FeatureCard icon={p.icon} title={p.title}>{p.text}</FeatureCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Segments */}
      <section className="border-y border-line bg-canvas-soft">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <Reveal>
            <SectionHeading
              eyebrow="Solutions"
              title="Built for how your program actually works"
              intro="Pick your context to see how WorkZo fits, what it measures, and how a pilot gets started."
            />
          </Reveal>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {segments.map((s, i) => {
              const Icon = s.icon;
              return (
                <Reveal key={s.slug} delay={(i % 3) * 60}>
                  <Link
                    href={`/for-education/${s.slug}`}
                    className="group flex h-full flex-col rounded-2xl border border-line bg-surface/70 p-6 transition hover:-translate-y-1 hover:border-brand/30 hover:bg-surface"
                  >
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand transition group-hover:bg-brand group-hover:text-on-brand">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-5 text-lg font-black tracking-tight">{s.label}</h3>
                    <p className="mt-2 flex-1 text-sm leading-6 text-muted">{s.desc}</p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-black text-brand">
                      Explore <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Talent intelligence layer */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="The intelligence layer"
            title="Talent intelligence, not just practice"
            intro="Beyond per-student reports, WorkZo turns every interview into cohort-level signal your team — and your employer partners — can act on."
          />
        </Reveal>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((c, i) => {
            const Icon = c.icon;
            return (
              <Reveal key={c.title} delay={(i % 3) * 60}>
                <div className="flex h-full flex-col rounded-2xl border border-line bg-surface/70 p-6">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 text-lg font-black tracking-tight">{c.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-6 text-muted">{c.text}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* How a pilot works */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading eyebrow="Getting started" title="From first conversation to live cohort" />
        </Reveal>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            { t: "Scope the pilot", d: "We map your target roles, cohort size, and timeline, then set up a shared minute pool and the recruiter personas that fit your placement partners." },
            { t: "Run practice at scale", d: "Learners complete realistic interviews against their own CV and the target role, as many times as they need, in the browser." },
            { t: "Coach from readiness", d: "Your team reviews group-level readiness, flags who needs help before the deadline, and shapes workshops around the real gaps." },
          ].map((s, i) => (
            <Reveal key={s.t} delay={i * 80}>
              <div className="relative h-full rounded-2xl border border-line bg-surface p-6">
                <span className="text-sm font-black tabular-nums text-brand">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-3 text-lg font-black tracking-tight">{s.t}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="contact" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Request a demo"
          title="Tell us about your program"
          intro="We reply within one business day. Pilots start small: your cohort gets full access via invitation, and you get completion reports every week."
        />
        <div className="mt-8">
          <B2BLeadForm source="education" />
        </div>
      </section>

      <CTASection
        title="Let's shape a pilot for your program"
        intro="Tell us your cohort size, target roles, and timeline. We'll help you start small and prove the value before any deeper rollout."
        primary={{ href: "#contact", label: "Request a demo" }}
        secondary={{ href: "/resources", label: "Browse resources" }}
      />
    </MarketingShell>
  );
}
