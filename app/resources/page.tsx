import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, BookOpen, HelpCircle, Map, Newspaper, ShieldCheck, UserRound,
  Activity, GraduationCap, LifeBuoy, Rocket,
} from "lucide-react";
import {
  MarketingShell, Reveal, Eyebrow, SectionHeading, FeatureCard, CTASection, BackLink,
} from "@/components/marketing/kit";

export const metadata: Metadata = {
  title: "Resources, WorkZo AI",
  description: "Guides, support, product updates, and legal information for WorkZo AI in one place.",
};

const primary = [
  { title: "Help Center", text: "Step-by-step help for login, CV upload, interviews, and reports.", href: "/help", icon: LifeBuoy },
  { title: "FAQ", text: "Straight answers on interviews, scoring, privacy, and plans.", href: "/faq", icon: HelpCircle },
  { title: "For Education", text: "How bootcamps, universities, and academies use WorkZo at scale.", href: "/for-education", icon: GraduationCap },
];

const more = [
  { title: "About WorkZo AI", text: "Why WorkZo exists and the problem it solves.", href: "/about", icon: UserRound },
  { title: "Roadmap", text: "What we're building next.", href: "/roadmap", icon: Map },
  { title: "Changelog", text: "Recent releases and fixes.", href: "/changelog", icon: Newspaper },
  { title: "System Status", text: "Live service status and uptime.", href: "/status", icon: Activity },
  { title: "Getting started guide", text: "Run your first interview in under five minutes.", href: "/onboarding", icon: Rocket },
  { title: "Privacy & Legal", text: "Privacy, terms, cookies, disclaimer, and data deletion.", href: "/legal/privacy", icon: ShieldCheck },
];

export default function ResourcesPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <BackLink href="/">Back home</BackLink>
      </div>

      <section className="mx-auto max-w-7xl px-4 pb-14 pt-8 text-center sm:px-6 lg:px-8">
        <Reveal>
          <div className="flex justify-center"><Eyebrow icon={BookOpen}>Resources</Eyebrow></div>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
            Everything you need to get the most out of WorkZo AI.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-muted">
            Guides and support, product updates, and legal information, all in one place.
          </p>
        </Reveal>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-4 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-3">
          {primary.map((r, i) => (
            <Reveal key={r.href} delay={i * 70}>
              <FeatureCard icon={r.icon} title={r.title} href={r.href}>{r.text}</FeatureCard>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <Reveal><Eyebrow>More</Eyebrow></Reveal>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {more.map((r, i) => {
            const Icon = r.icon;
            return (
              <Reveal key={r.href} delay={(i % 3) * 60}>
                <Link href={r.href} className="group flex items-start gap-4 rounded-2xl border border-line bg-surface/60 p-5 transition hover:border-brand/30 hover:bg-surface">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand transition group-hover:bg-brand group-hover:text-on-brand">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-base font-black tracking-tight text-fg">{r.title}</span>
                    <span className="mt-1 block text-sm leading-6 text-muted">{r.text}</span>
                  </span>
                  <ArrowRight className="ml-auto mt-1 h-4 w-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand" />
                </Link>
              </Reveal>
            );
          })}
        </div>
      </section>

      <CTASection
        title="Ready to practice?"
        intro="Upload your CV, pick a role, and run a realistic interview with feedback in minutes."
        primary={{ href: "/onboarding", label: "Start practicing" }}
        secondary={{ href: "/contact", label: "Contact us" }}
      />
    </MarketingShell>
  );
}
