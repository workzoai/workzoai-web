import type { Metadata } from "next";
import { FileText, LayoutTemplate, ShieldCheck, Sparkles } from "lucide-react";
import {
  MarketingShell,
  Reveal,
  Eyebrow,
  SectionHeading,
  FeatureCard,
  CTASection,
} from "@/components/marketing/kit";
import ResumeTemplatesClient from "@/components/marketing/ResumeTemplatesClient";

export const metadata: Metadata = {
  title: "Free ATS-Friendly Resume Templates - Copy & Fill | WorkZo AI",
  description:
    "Clean, single-column, ATS-friendly resume templates for professionals, graduates, career changers, and technical roles. Copy the structure, fill it in, and check your ATS score. Free, no signup.",
  keywords: [
    "ats resume template",
    "free resume template",
    "resume format",
    "cv template",
    "ats friendly resume",
    "resume outline",
  ],
  alternates: { canonical: "/resume-templates" },
};

export default function ResumeTemplatesPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Are these resume templates ATS-friendly?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Every template is single-column with standard section headings and plain bullets, which is exactly what applicant tracking systems parse most reliably. No tables, columns, or text boxes.",
        },
      },
      {
        "@type": "Question",
        name: "Do I need to sign up?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. You can copy or download any template instantly, with no signup and no cost.",
        },
      },
      {
        "@type": "Question",
        name: "How do I know my finished resume will pass?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "After you fill a template in, run it through the free ATS Resume Checker to get a score, structure checks, and keyword match against a specific job.",
        },
      },
    ],
  };

  return (
    <MarketingShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-10 pt-12 sm:px-6 lg:px-8 lg:pt-16">
        <Reveal>
          <Eyebrow icon={LayoutTemplate}>Resume Templates</Eyebrow>
          <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.03] tracking-tight sm:text-5xl">
            Clean resume templates an ATS can actually read.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
            Single-column, standard headings, no fancy tables that break parsing. Pick a template,
            copy the structure, fill in the brackets, then check your ATS score. Free, no signup.
          </p>
        </Reveal>
      </section>

      {/* The gallery */}
      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
        <ResumeTemplatesClient />
      </section>

      {/* Why these work */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Why these work" title="Built to survive the filter and the skim." />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <Reveal>
            <FeatureCard icon={ShieldCheck} title="ATS-safe structure">
              Single column, real headings, and plain bullets, so an applicant tracking system reads
              every line instead of scrambling a two-column layout.
            </FeatureCard>
          </Reveal>
          <Reveal delay={80}>
            <FeatureCard icon={FileText} title="Impact-first bullets">
              Every bullet is scaffolded as action, then result, then number, which is the pattern a
              recruiter scans for in six seconds.
            </FeatureCard>
          </Reveal>
          <Reveal delay={160}>
            <FeatureCard icon={Sparkles} title="Right template for you">
              Separate structures for steady careers, graduates, career changers, and technical roles,
              so you start from the closest fit.
            </FeatureCard>
          </Reveal>
        </div>
      </section>

      <CTASection
        title="Templated, then tailored."
        intro="Fill a template, then run the free ATS check and a full AI interview built from your CV and role."
        primary={{ href: "/tools/ats-checker", label: "Check my ATS score" }}
        secondary={{ href: "/tools", label: "Browse free tools" }}
      />
    </MarketingShell>
  );
}
