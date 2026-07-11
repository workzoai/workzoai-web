import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
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
import { FREE_TOOLS } from "@/lib/free-tools";
import { getFreeToolIcon } from "@/components/marketing/freeToolIcons";

export const metadata: Metadata = {
  title: "AI Career Tools | WorkZo AI",
  description:
    "AI career tools from WorkZo AI for CV review, ATS checks, cover letters, professional summaries, STAR stories, resume headlines, and interview preparation.",
  keywords: [
    "free career tools",
    "free cv review",
    "ats resume checker",
    "free cover letter generator",
    "interview question generator",
    "resume headline generator",
  ],
  alternates: { canonical: "/tools" },
};

export default function FreeToolsHubPage() {
  return (
    <MarketingShell>
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-10 pt-12 sm:px-6 lg:px-8 lg:pt-16">
        <Reveal>
          <Eyebrow icon={Sparkles}>Career tools</Eyebrow>
          <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.03] tracking-tight sm:text-5xl">
            Career tools that remember your progress.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
            Sign in once, upload your CV once, and reuse the same verified profile across every tool.
            WorkZo keeps your application context connected as you move from CV review to cover
            letters and interview preparation.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <PrimaryButton href="/onboarding">Start interview preparation</PrimaryButton>
            <GhostButton href="/features">See all features</GhostButton>
          </div>
        </Reveal>
      </section>

      {/* Tools grid */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Pick a tool"
          title="Everything you need to apply with confidence."
          intro="Choose a tool and continue with the CV already saved in your WorkZo workspace."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FREE_TOOLS.map((tool, i) => (
            <Reveal key={tool.id} delay={i * 50}>
              <div className="relative h-full">
                <FeatureCard icon={getFreeToolIcon(tool.icon)} title={tool.title} href={tool.href}>
                  {tool.description}
                </FeatureCard>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <CTASection
        title="One profile, every step of your application."
        intro="Use your saved CV across career tools, then practise a full AI interview built from the same verified profile."
        primary={{ href: "/onboarding", label: "Start interview preparation" }}
        secondary={{ href: "/features", label: "See all features" }}
      />
    </MarketingShell>
  );
}
