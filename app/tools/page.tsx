import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import {
  MarketingShell,
  Reveal,
  Eyebrow,
  FeatureCard,
  CTASection,
  PrimaryButton,
  GhostButton,
} from "@/components/marketing/kit";
import { FREE_TOOLS } from "@/lib/free-tools";
import { getFreeToolIcon } from "@/components/marketing/freeToolIcons";

export const metadata: Metadata = {
  title: "Free AI Career Tools — CV Review, Resume Tailor & More | WorkZo AI",
  description:
    "Free AI career tools from WorkZo AI: review your CV, tailor your resume to any job, generate cover letters, and create realistic interview questions. No signup required.",
  openGraph: {
    title: "Free AI Career Tools | WorkZo AI",
    description:
      "Review your CV, tailor your resume, generate cover letters, and create interview questions — free.",
  },
};

export default function FreeToolsIndexPage() {
  return (
    <MarketingShell>
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-12 pt-14 sm:px-6 lg:px-8 lg:pt-20">
        <Reveal>
          <Eyebrow icon={Sparkles}>Free AI Career Tools</Eyebrow>
          <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.03] tracking-tight sm:text-5xl">
            Practice and prepare before you upgrade.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
            Every WorkZo AI free tool is built to move your job search forward today — no signup, no
            cost. Review your CV, tailor your resume, write a cover letter, and rehearse the questions
            you'll actually be asked.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <PrimaryButton href="/onboarding">Start a free AI interview</PrimaryButton>
            <GhostButton href="/pricing">See all plans</GhostButton>
          </div>
        </Reveal>
      </section>

      {/* Tools grid */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FREE_TOOLS.map((tool, i) => (
            <Reveal key={tool.id} delay={i * 80}>
              <FeatureCard icon={getFreeToolIcon(tool.icon)} title={tool.title} href={tool.href}>
                {tool.description}
              </FeatureCard>
            </Reveal>
          ))}
        </div>
      </section>

      <CTASection
        title="Free tools get you started. WorkZo gets you the offer."
        intro="Practice a full, CV-aware AI interview with real follow-ups, pressure, and a trust score that shows exactly where an interview turns."
        primary={{ href: "/onboarding", label: "Try a free interview" }}
        secondary={{ href: "/pricing", label: "Compare plans" }}
      />
    </MarketingShell>
  );
}
