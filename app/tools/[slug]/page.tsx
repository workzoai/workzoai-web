import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import {
  MarketingShell,
  Reveal,
  Eyebrow,
  SectionHeading,
  FeatureCard,
  FaqAccordion,
  CTASection,
  BackLink,
  PrimaryButton,
  GhostButton,
} from "@/components/marketing/kit";
import {
  FREE_TOOLS,
  FREE_TOOL_SLUGS,
  getFreeToolBySlug,
} from "@/lib/free-tools";
import { getFreeToolIcon } from "@/components/marketing/freeToolIcons";
import FreeToolRunner from "@/components/marketing/FreeToolRunner";

export function generateStaticParams() {
  return FREE_TOOL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = getFreeToolBySlug(slug);
  if (!tool) return { title: "Free AI Career Tools | WorkZo AI" };
  return {
    title: tool.seo.title,
    description: tool.seo.description,
    keywords: tool.seo.keywords,
    alternates: { canonical: tool.href },
    openGraph: {
      title: tool.seo.title,
      description: tool.seo.description,
      url: tool.href,
    },
  };
}

export default async function FreeToolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = getFreeToolBySlug(slug);
  if (!tool) notFound();

  const Icon = getFreeToolIcon(tool.icon);
  const related = FREE_TOOLS.filter((t) => t.id !== tool.id).slice(0, 3);

  // FAQ structured data — helps these pages earn rich results.
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: tool.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <MarketingShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <BackLink href="/tools">All free tools</BackLink>
      </div>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <Reveal>
          <Eyebrow icon={Icon}>{tool.hero.eyebrow}</Eyebrow>
          <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.03] tracking-tight sm:text-5xl">
            {tool.hero.heading}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">{tool.hero.subheading}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <PrimaryButton href="#try-tool">{tool.hero.primaryCta}</PrimaryButton>
            <GhostButton href="/tools">Explore all free tools</GhostButton>
          </div>
        </Reveal>
      </section>

      {/* The actual free tool — runs inline, no login required */}
      <section id="try-tool" className="mx-auto max-w-3xl px-4 pb-8 sm:px-6 lg:px-8">
        <FreeToolRunner tool={tool} />
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="How it works" title="Three steps to a stronger application." />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {tool.howItWorks.map((step, i) => (
            <Reveal key={step.title} delay={i * 80}>
              <div className="h-full rounded-2xl border border-line bg-surface/70 p-6">
                <span className="text-sm font-black tabular-nums text-brand">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-lg font-black tracking-tight">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{step.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Why it helps"
          title={`What makes ${tool.title} different.`}
        />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {tool.benefits.map((benefit, i) => (
            <Reveal key={benefit.title} delay={i * 80}>
              <FeatureCard icon={Icon} title={benefit.title}>
                {benefit.description}
              </FeatureCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="FAQ" title="Common questions." align="center" />
        <div className="mt-10">
          <FaqAccordion items={tool.faqs.map((f) => ({ q: f.q, a: f.a }))} />
        </div>
      </section>

      {/* Related free tools */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="More free tools" title="Keep preparing — it's all free." />
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {related.map((other) => (
            <FeatureCard
              key={other.id}
              icon={getFreeToolIcon(other.icon)}
              title={other.title}
              href={other.href}
            >
              {other.description}
            </FeatureCard>
          ))}
        </div>
        <div className="mt-8">
          <Link
            href="/tools"
            className="inline-flex items-center gap-2 text-sm font-black text-brand transition hover:text-brand-strong"
          >
            View all free tools <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <CTASection
        title={tool.cta.heading}
        intro={tool.cta.subheading}
        primary={{ href: "/pricing", label: "Compare plans" }}
        secondary={{ href: "/onboarding", label: "Try a free interview" }}
      />
    </MarketingShell>
  );
}
