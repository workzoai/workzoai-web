import type { Metadata } from "next";
import { Mail, MessageCircle, ShieldCheck, Building2, GraduationCap, Clock } from "lucide-react";
import { MarketingShell, Reveal, Eyebrow, BackLink } from "@/components/marketing/kit";

export const metadata: Metadata = {
  title: "Contact, WorkZo AI",
  description: "Reach the WorkZo AI team for support, bug reports, data requests, education, and enterprise enquiries.",
};

const cards = [
  { icon: Mail, tone: "brand", title: "Support", line: "support@workzoai.com", href: "mailto:support@workzoai.com", cta: "Email support" },
  { icon: MessageCircle, tone: "brand", title: "Report a bug", line: "Tell us the page, your browser, and what happened.", href: "mailto:support@workzoai.com?subject=WorkZo%20AI%20Bug%20Report&body=Page:%0ABrowser:%0AWhat%20happened:%0A", cta: "Report a bug" },
  { icon: ShieldCheck, tone: "success", title: "Data request", line: "Request access, correction, or deletion of your data.", href: "mailto:support@workzoai.com?subject=Data%20Request", cta: "Make a request" },
  { icon: GraduationCap, tone: "brand", title: "Education", line: "Bootcamps, universities, and academies.", href: "/for-education#contact", cta: "Talk to us" },
  { icon: Building2, tone: "brand", title: "Enterprise", line: "Rollouts across teams and locations.", href: "/enterprise#contact", cta: "Talk to sales" },
  { icon: Clock, tone: "muted", title: "Response time", line: "We usually reply within one business day.", href: "mailto:support@workzoai.com", cta: "Get in touch" },
];

export default function ContactPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <BackLink href="/">Back home</BackLink>
      </div>

      <section className="mx-auto max-w-7xl px-4 pb-12 pt-8 text-center sm:px-6 lg:px-8">
        <Reveal>
          <div className="flex justify-center"><Eyebrow icon={Mail}>Contact</Eyebrow></div>
          <h1 className="mx-auto mt-5 max-w-2xl text-4xl font-black tracking-tight sm:text-5xl">
            We're here to help.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-muted">
            Support, bugs, data requests, partnerships, or a question about a plan. Pick the right inbox and we'll get back to you.
          </p>
        </Reveal>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c, i) => {
            const Icon = c.icon;
            const iconCls =
              c.tone === "success" ? "bg-success/10 text-success"
              : c.tone === "muted" ? "bg-fg/[0.06] text-muted"
              : "bg-brand/10 text-brand";
            return (
              <Reveal key={c.title} delay={(i % 3) * 60}>
                <a href={c.href} className="group flex h-full flex-col rounded-2xl border border-line bg-surface/70 p-6 transition hover:-translate-y-1 hover:border-brand/30 hover:bg-surface">
                  <span className={`grid h-11 w-11 place-items-center rounded-xl ${iconCls}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <h2 className="mt-5 text-lg font-black tracking-tight">{c.title}</h2>
                  <p className="mt-2 flex-1 text-sm leading-6 text-muted">{c.line}</p>
                  <span className="mt-4 text-sm font-black text-brand">{c.cta} →</span>
                </a>
              </Reveal>
            );
          })}
        </div>
      </section>
    </MarketingShell>
  );
}
