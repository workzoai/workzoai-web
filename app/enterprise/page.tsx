import type { Metadata } from "next";
import {
  Building2, ShieldCheck, Users, GaugeCircle, Layers, Languages, LockKeyhole, LineChart, CheckCircle2,
} from "lucide-react";
import {
  MarketingShell, Reveal, Eyebrow, SectionHeading, StatBand, FeatureCard, FaqAccordion, CTASection, BackLink, PrimaryButton, GhostButton,
} from "@/components/marketing/kit";
import B2BLeadForm from "@/components/marketing/B2BLeadForm";

export const metadata: Metadata = {
  title: "Enterprise — WorkZo AI",
  description: "Standardize interview preparation across every team and location with managed rollout, group-level readiness, and privacy controls.",
};

const capabilities = [
  { icon: Users, title: "One standard for everyone", text: "Every candidate prepares with the same structured, role-specific interview, so preparation no longer depends on which manager you happen to report to." },
  { icon: GaugeCircle, title: "Readiness you can see", text: "Cohort completion and readiness reports delivered on a regular cadence, so talent teams can run targeted workshops before a formal panel. A self-serve dashboard is on the roadmap and shaped with early partners." },
  { icon: Layers, title: "Every role, one engine", text: "Interviews are built from the job description, covering internal mobility, graduate intakes, promotion loops, and leadership roles." },
  { icon: Languages, title: "Global by default", text: "Practice runs in the language and interview culture of each market, so preparation is fair across every location." },
  { icon: LockKeyhole, title: "Privacy and access controls", text: "Scoped administrator access and clear data handling, with a managed rollout your DPO and IT teams can review up front." },
  { icon: LineChart, title: "Measurable impact", text: "Track completion, coverage, and readiness over time so you can show leadership the difference preparation makes." },
];

const included = [
  "Voice-minute allocation sized to your organization",
  "All 11 recruiter personas across HR, technical, and leadership styles",
  "Cohort completion and readiness reporting",
  "Managed onboarding and rollout support",
  "GDPR-friendly data handling and scoped admin access",
  "Direct access to the founder for support and rollout",
];

export default function EnterprisePage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <BackLink href="/">Back home</BackLink>
      </div>

      <section className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <Reveal>
            <Eyebrow icon={Building2}>Enterprise</Eyebrow>
            <h1 className="mt-5 max-w-2xl text-4xl font-black leading-[1.04] tracking-tight sm:text-5xl lg:text-6xl">
              One consistent way to prepare every candidate to interview well.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted">
              Internal mobility, graduate intakes, and promotion cases all depend on people interviewing well. WorkZo AI gives your organization a single, fair, structured way to prepare them, with the readiness data to coach at scale.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <PrimaryButton href="#contact">Talk to sales</PrimaryButton>
              <GhostButton href="/pricing">See plans</GhostButton>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="rounded-2xl border border-line bg-surface/70 p-7 shadow-xl shadow-black/10">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-muted">What's included</p>
              <ul className="mt-5 space-y-3.5">
                {included.map((it) => (
                  <li key={it} className="flex gap-3 text-sm leading-6 text-fg">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand" /> {it}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>

        <Reveal delay={80} className="mt-14">
          <StatBand stats={[
            { value: "Every team", label: "the same fair preparation standard" },
            { value: "Any level", label: "from graduate intake to leadership loops" },
            { value: "Managed", label: "rollout your DPO and IT can review first" },
          ]} />
        </Reveal>
      </section>

      <section className="border-y border-line bg-canvas-soft">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <Reveal><SectionHeading eyebrow="Capabilities" title="Built for talent teams that hire and move people at scale" /></Reveal>
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((c, i) => (
              <Reveal key={c.title} delay={(i % 3) * 60}>
                <FeatureCard icon={c.icon} title={c.title}>{c.text}</FeatureCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <Reveal><SectionHeading eyebrow="FAQ" title="Common questions" /></Reveal>
        <Reveal delay={80} className="mt-8">
          <FaqAccordion items={[
            { q: "How does a rollout start?", a: "With a managed pilot: we scope your target roles and cohort, set up a shared minute pool, and get a group practicing before any deeper integration." },
            { q: "Can we control who sees candidate data?", a: "Yes. Group-level visibility is scoped to your administrators, and data handling is designed to be GDPR-friendly. Your DPO and IT teams can review the terms before launch." },
            { q: "Does it support internal promotion and leadership interviews?", a: "Yes. Personas cover influence-without-authority, ownership, and strategic thinking, so candidates rehearse the substance of leadership loops." },
            { q: "What does pricing look like?", a: "Enterprise pricing is based on your organization size and usage. Talk to sales and we'll put together a plan that fits." },
          ]} />
        </Reveal>
      </section>

      <section id="contact" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Get in touch"
          title="Tell us about your organization"
          text="We reply within one business day. Pilots start small: your cohort gets full access via invitation, you get completion reports, and we shape the rollout together."
        />
        <div className="mt-8">
          <B2BLeadForm source="enterprise" />
        </div>
      </section>

      <CTASection
        title="Let's talk about your organization"
        intro="Tell us your team size, the roles you hire and promote for, and your timeline. We'll shape a pilot that proves the value quickly."
        primary={{ href: "#contact", label: "Talk to sales" }}
        secondary={{ href: "/for-education", label: "For education" }}
      />
    </MarketingShell>
  );
}
