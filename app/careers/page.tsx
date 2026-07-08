import type { Metadata } from "next";
import { Briefcase, Heart, Rocket, Sparkles, Users } from "lucide-react";
import {
  MarketingShell, Reveal, Eyebrow, SectionHeading, CTASection, BackLink, PrimaryButton, GhostButton,
} from "@/components/marketing/kit";

export const metadata: Metadata = {
  title: "Careers, WorkZo AI",
  description: "Join WorkZo AI. See our open roles and help build interview prep that shows candidates why a recruiter's trust rises and falls.",
};

// ── Open roles ──────────────────────────────────────────────────────────────
// Edit this array to manage listings. Add a real opening as:
//   { title: "Founding Full-Stack Engineer", type: "Full-time", location: "Remote (EU)",
//     blurb: "…", applyEmail: "careers@workzoai.com" }
// Leave it empty to show the "no current openings / reach out" state.
type Role = { title: string; type: string; location: string; blurb: string; applyEmail?: string };

const openRoles: Role[] = [];

const APPLY_EMAIL = "careers@workzoai.com";

const perks = [
  { icon: Rocket, title: "Early-stage impact", body: "Small team, real ownership. What you build ships to real job seekers, fast, not into a backlog." },
  { icon: Heart, title: "Mission that matters", body: "Every feature helps someone understand why they were rejected and how to fix it. The work is genuinely useful." },
  { icon: Users, title: "Global by design", body: "We build for candidates in any market. Remote-friendly and comfortable working across time zones." },
];

function mailto(role?: string) {
  const subject = role ? `Application: ${role}` : "Spontaneous application, WorkZo AI";
  return `mailto:${APPLY_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

export default function CareersPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <BackLink href="/">Back home</BackLink>
      </div>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-12 pt-8 sm:px-6 lg:px-8">
        <Reveal>
          <Eyebrow icon={Sparkles}>Careers</Eyebrow>
          <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">
            Help build interview prep that tells people why.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
            WorkZo AI is a small, fast-moving team on a mission to make honest, useful career prep available to job seekers everywhere. If that resonates, we&apos;d love to hear from you.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <PrimaryButton href={mailto()} external>Send a spontaneous application</PrimaryButton>
            <GhostButton href="/about">Meet the founder</GhostButton>
          </div>
        </Reveal>
      </section>

      {/* Open roles */}
      <section className="border-y border-line bg-canvas-soft">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <Reveal>
            <SectionHeading
              eyebrow="Open roles"
              title="Current openings"
              intro="These are the roles we're actively hiring for. Don't see a perfect match? Send a spontaneous application, we read every one."
            />
          </Reveal>

          {openRoles.length > 0 ? (
            <div className="mt-8 grid gap-4">
              {openRoles.map((role, i) => (
                <Reveal key={role.title} delay={(i % 3) * 60}>
                  <div className="flex flex-col justify-between gap-4 rounded-2xl border border-line bg-surface/70 p-6 sm:flex-row sm:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-black tracking-tight">{role.title}</h3>
                        <span className="rounded-full border border-line bg-fg/[0.04] px-2.5 py-0.5 text-xs font-black text-muted">{role.type}</span>
                        <span className="rounded-full border border-line bg-fg/[0.04] px-2.5 py-0.5 text-xs font-black text-muted">{role.location}</span>
                      </div>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{role.blurb}</p>
                    </div>
                    <div className="shrink-0">
                      <PrimaryButton href={`mailto:${role.applyEmail || APPLY_EMAIL}?subject=${encodeURIComponent(`Application: ${role.title}`)}`}>Apply</PrimaryButton>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          ) : (
            <Reveal>
              <div className="mt-8 rounded-2xl border border-line bg-surface/70 p-10 text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand/10 text-brand">
                  <Briefcase className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-xl font-black tracking-tight">No open roles right now</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
                  We&apos;re not actively hiring for a specific role at the moment, but we&apos;re always keen to meet exceptional people. Tell us what you&apos;d bring and we&apos;ll keep you in mind as we grow.
                </p>
                <div className="mt-6">
                  <PrimaryButton href={mailto()} external>Introduce yourself</PrimaryButton>
                </div>
              </div>
            </Reveal>
          )}
        </div>
      </section>

      {/* Why WorkZo */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading eyebrow="Why WorkZo" title="What you can expect" />
        </Reveal>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {perks.map((p, i) => {
            const Icon = p.icon;
            return (
              <Reveal key={p.title} delay={(i % 3) * 60}>
                <div className="flex h-full flex-col rounded-2xl border border-line bg-surface/70 p-6">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 text-lg font-black tracking-tight">{p.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-6 text-muted">{p.body}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      <CTASection
        title="Not the right time, but curious?"
        intro="Send us a note anyway, we keep every application on file and reach out when a fitting role opens up."
        primary={{ href: mailto(), label: "Get in touch", external: true }}
        secondary={{ href: "/about", label: "About WorkZo" }}
      />
    </MarketingShell>
  );
}
