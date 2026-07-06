import Link from "next/link";
import { ArrowLeft, PersonStanding } from "lucide-react";
import WorkZoFooter from "@/components/WorkZoFooter";

export const metadata = {
  title: "Accessibility | WorkZo AI",
  description: "WorkZo AI's accessibility statement: our current status, known limitations, and how to report barriers.",
};

/**
 * Honest accessibility statement. We do NOT claim WCAG conformance we have
 * not audited — "partially conformant, actively improving, tell us about
 * barriers" is both truthful and what the European Accessibility Act era
 * expects from a company this size. Update "Known limitations" as items are
 * fixed; a stale limitation list is better than a false conformance claim.
 */

const sections = [
  {
    title: "Our commitment",
    body: "We want WorkZo AI to be usable by as many people as possible, including people who rely on screen readers, keyboard navigation, captions, or reduced motion. Accessibility is part of how we build, and this page states honestly where we are today.",
  },
  {
    title: "Current status",
    body: "WorkZo AI aims to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA. We have not yet completed a formal third-party audit, so we describe ourselves as partially conformant: most of the interface works well with assistive technologies, and some parts do not yet.",
  },
  {
    title: "What works today",
    body: "The site uses semantic HTML with proper heading structure, supports keyboard navigation across marketing pages and core flows, maintains readable color contrast in the default theme, provides text alternatives for meaningful images, and presents live voice interviews with a full written transcript alongside the audio.",
  },
  {
    title: "Known limitations",
    body: "Voice interviews currently require speaking and listening; a fully text-based interview mode for deaf and hard-of-hearing users, and for anyone who prefers typing, is on our roadmap. Some interactive practice components, such as the live code workspace, have incomplete screen-reader labelling. Some AI-generated report visuals do not yet include complete text descriptions.",
  },
  {
    title: "Report a barrier",
    body: "If any part of WorkZo AI is difficult or impossible for you to use, please tell us at support@workzoai.com with the page and the assistive technology involved. Accessibility reports go directly to the founder and are treated as bugs, not feature requests.",
  },
];

export default function AccessibilityPage() {
  return (
    <main className="min-h-screen bg-canvas text-fg">
      <div className="mx-auto max-w-4xl px-5 py-10 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-fg">
          <ArrowLeft className="h-4 w-4" /> Back home
        </Link>

        <div className="mt-10 flex items-start gap-5">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-success/10">
            <PersonStanding className="h-7 w-7 text-success" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.26em] text-brand">Legal</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.04em] sm:text-3xl">Accessibility</h1>
            <p className="mt-3 text-sm leading-6 text-muted">Last updated: July 2026 · Our current status, honestly stated.</p>
          </div>
        </div>

        <div className="mt-10 space-y-4">
          {sections.map((s) => (
            <section key={s.title} className="rounded-xl border border-line bg-fg/[0.03] p-6">
              <h2 className="text-base font-black text-fg">{s.title}</h2>
              <p className="mt-3 text-sm leading-7 text-muted">{s.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/legal/responsible-ai" className="rounded-xl border border-line bg-fg/[0.03] px-4 py-2 text-sm text-muted hover:text-fg">Responsible AI</Link>
          <Link href="/contact" className="rounded-xl border border-line bg-fg/[0.03] px-4 py-2 text-sm text-muted hover:text-fg">Contact</Link>
        </div>
      </div>
      <WorkZoFooter />
    </main>
  );
}
