import type { Metadata } from "next";
import type { SVGProps } from "react";
import Link from "next/link";
import {
  BarChart3,
  Briefcase,
  Compass,
  LayoutTemplate,
  Mail,
  Mic,
  PenLine,
  Send,
  Sparkles,
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
import { FREE_TOOLS } from "@/lib/free-tools";
import { getFreeToolIcon } from "@/components/marketing/freeToolIcons";

// lucide-react in this project does not export the LinkedIn brand glyph, so we
// use a local SVG, matching the landing page.
function LinkedinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

export const metadata: Metadata = {
  title: "All Features - Every WorkZo AI Tool in One Place | WorkZo AI",
  description:
    "Explore everything WorkZo AI does: the hiring-readiness interview, CV and resume tools, ATS checker, cover letters, LinkedIn optimizer, and the free tools you can use without signing up.",
  keywords: [
    "workzo ai features",
    "ai career tools",
    "ats resume checker",
    "ai interview practice",
    "resume templates",
    "cover letter generator",
  ],
  alternates: { canonical: "/features" },
};

type Item = {
  title: string;
  description: string;
  href?: string;
  icon: LucideIcon;
  badge?: string;
  soon?: boolean;
};

const coreProduct: Item[] = [
  {
    title: "AI Recruiter Interview",
    description:
      "A voice interview built from your real CV and target role, with follow-ups, pressure, and a live trust score.",
    href: "/onboarding",
    icon: Mic,
    badge: "Core",
  },
  {
    title: "Results Report",
    description:
      "See your readiness score, the questions where trust dropped, and exactly which answers to fix.",
    href: "/features/results-intelligence",
    icon: BarChart3,
  },
  {
    title: "How it works",
    description:
      "See how the recruiter reads your CV and where offers are quietly lost, before a real one does.",
    href: "/features/interview-practice",
    icon: Compass,
  },
  {
    title: "Job Assist",
    description:
      "Role-preparation tools that keep you ready across CV, questions, and company research.",
    href: "/features/job-assist",
    icon: Briefcase,
  },
];

const resumeTools: Item[] = [
  {
    title: "Improve CV",
    description: "Rewrite and optimize your CV against a role, with fact-guarded edits you can trust.",
    href: "/features/improve-cv",
    icon: PenLine,
    badge: "Free",
  },
  {
    title: "Resume Templates",
    description: "Clean, single-column, ATS-friendly resume templates you can copy and fill in minutes.",
    href: "/features/resume-templates",
    icon: LayoutTemplate,
    badge: "Free",
  },
];

const applicationTools: Item[] = [
  {
    title: "Cover Letter Generator",
    description: "Generate a tailored, honest cover letter for any role, then edit and download it.",
    href: "/features/cover-letter",
    icon: Mail,
    badge: "Free",
  },
  {
    title: "LinkedIn Optimizer",
    description: "Check your LinkedIn against your real CV and the job, and fix every mismatch a recruiter would spot.",
    href: "/features/linkedin-optimizer",
    icon: LinkedinIcon as unknown as LucideIcon,
    badge: "New",
  },
];

const comingSoon: Item[] = [
  {
    title: "Smart Apply",
    description:
      "Apply to matched roles faster: WorkZo tailors your CV and cover letter per job and tracks every application in one place.",
    icon: Send,
    soon: true,
  },
  {
    title: "Career Hub",
    description:
      "Your whole job search in one place: profile, saved tools, interview history, and readiness trends that show WorkZo understands your career, not just your last upload.",
    icon: Sparkles,
    soon: true,
  },
];

function Grid({ items }: { items: Item[] }) {
  return (
    <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, i) => (
        <Reveal key={item.title} delay={i * 60}>
          {item.soon ? (
            <div className="relative h-full overflow-hidden rounded-2xl border border-dashed border-line bg-surface/40 p-6">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-fg/[0.06] text-muted">
                <item.icon className="h-5 w-5" />
              </div>
              <div className="mt-5 flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight">{item.title}</h3>
                <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-warning">
                  Soon
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted">{item.description}</p>
            </div>
          ) : (
            <div className="relative h-full">
              {item.badge ? (
                <span
                  className={`absolute right-4 top-4 z-10 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] ${
                    item.badge === "New"
                      ? "bg-warning/15 text-warning"
                      : item.badge === "Core"
                        ? "bg-fg/10 text-fg"
                        : "bg-success/15 text-success"
                  }`}
                >
                  {item.badge}
                </span>
              ) : null}
              <FeatureCard icon={item.icon} title={item.title} href={item.href}>
                {item.description}
              </FeatureCard>
            </div>
          )}
        </Reveal>
      ))}
    </div>
  );
}

export default function AllFeaturesPage() {
  return (
    <MarketingShell>
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-10 pt-12 sm:px-6 lg:px-8 lg:pt-16">
        <Reveal>
          <Eyebrow icon={Sparkles}>All features</Eyebrow>
          <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.03] tracking-tight sm:text-5xl">
            Everything WorkZo AI does, in one place.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
            From the free tools you can use without signing up to the full hiring-readiness interview,
            here is the whole product. Free tools are marked, and what is coming next is marked too.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <PrimaryButton href="/onboarding">Start a free interview</PrimaryButton>
            <GhostButton href="/tools">Browse free tools</GhostButton>
          </div>
        </Reveal>
      </section>

      {/* Core product */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="The core"
          title="The hiring-readiness diagnostic."
          intro="The reason WorkZo exists: find out why the offer went to someone else, before a real recruiter shows you."
        />
        <Grid items={coreProduct} />
      </section>

      {/* Free tools from the registry */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Free tools"
          title="Free, no signup, indexed for anyone to use."
          intro="Every tool below runs instantly in your browser session. Premium adds depth, saved history, and role-specific tailoring."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FREE_TOOLS.map((tool, i) => (
            <Reveal key={tool.id} delay={i * 50}>
              <div className="relative h-full">
                <span className="absolute right-4 top-4 z-10 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-success">
                  {tool.badge}
                </span>
                <FeatureCard icon={getFreeToolIcon(tool.icon)} title={tool.title} href={tool.href}>
                  {tool.description}
                </FeatureCard>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Resume & CV */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Resume & CV" title="Get past the filter, then past the skim." />
        <Grid items={resumeTools} />
      </section>

      {/* Applications */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Applications" title="Everything you send, sharpened." />
        <Grid items={applicationTools} />
      </section>

      {/* Coming soon */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="On the roadmap"
          title="What is coming next."
          intro="Building in the open. These are the next features that move WorkZo from a set of tools to something that understands your whole search."
        />
        <Grid items={comingSoon} />
        <div className="mt-8">
          <Link
            href="/roadmap"
            className="inline-flex items-center gap-2 text-sm font-black text-brand transition hover:text-brand-strong"
          >
            See the full roadmap
          </Link>
        </div>
      </section>

      <CTASection
        title="Start where it counts."
        intro="Run a free tool now, or go straight to the full interview built from your CV and role."
        primary={{ href: "/onboarding", label: "Start a free interview" }}
        secondary={{ href: "/tools", label: "Browse free tools" }}
      />
    </MarketingShell>
  );
}
