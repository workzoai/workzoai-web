import Link from "next/link";
import Image from "next/image";

const productLinks = [
  { label: "Interview Practice", href: "/features/interview-practice" },
  { label: "Improve CV", href: "/cv" },
  { label: "Cover Letter", href: "/cover-letter" },
  { label: "Job Assist", href: "/jobs" },
  { label: "AI Career Coach", href: "/pricing?plan=premium_pro" },
  { label: "Pricing", href: "/pricing" },
];

const resourceLinks = [
  { label: "About", href: "/about" },
  { label: "For Universities & Bootcamps", href: "/for-education" },
  { label: "Enterprise", href: "/enterprise" },
  { label: "Roadmap", href: "/roadmap" },
  { label: "Changelog", href: "/changelog" },
  { label: "FAQ", href: "/faq" },
  { label: "Help Center", href: "/help" },
  { label: "System Status", href: "/status" },
];

const legalLinks = [
  { label: "Privacy Policy", href: "/legal/privacy" },
  { label: "Security & Data", href: "/security" },
  { label: "Terms of Service", href: "/legal/terms" },
  { label: "Cookie Policy", href: "/legal/cookies" },
  { label: "Disclaimer", href: "/legal/disclaimer" },
  { label: "Impressum", href: "/legal/impressum" },
  { label: "Delete My Data", href: "/legal/delete-data" },
];

const socialLinks = [
  { label: "LinkedIn", href: "https://www.linkedin.com/company/workzo-ai", external: true },
  { label: "Product Hunt", href: "https://www.producthunt.com/products/workzo-ai", external: true },
  { label: "Contact", href: "/contact" },
  { label: "support@workzoai.com", href: "mailto:support@workzoai.com", external: true },
];

function FooterLink({ href, label, external = false }: { href: string; label: string; external?: boolean }) {
  const cls = "text-sm text-muted transition hover:text-fg";
  if (external) return <a href={href} target="_blank" rel="noreferrer" className={cls}>{label}</a>;
  return <Link href={href} className={cls}>{label}</Link>;
}

function FooterColumn({ title, links }: { title: string; links: Array<{ label: string; href: string; external?: boolean }> }) {
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-subtle">{title}</p>
      <div className="mt-4 flex flex-col gap-3">
        {links.map((link) => <FooterLink key={link.href} {...link} />)}
      </div>
    </div>
  );
}

export default function WorkZoFooter({ minimal = false }: { minimal?: boolean }) {
  return (
    <footer className="border-t border-line bg-canvas px-4 py-12 text-fg sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_0.8fr]">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-3">
              <Image src="/workzo_icon.png" alt="WorkZo AI" width={36} height={36} className="rounded-xl" />
              <span className="text-xl font-black tracking-tight">WorkZo <span className="text-brand">AI</span></span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-6 text-muted">
              AI-powered interview preparation. Practice realistic recruiter conversations with your CV and job context, and see exactly why trust rises or falls.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-black text-brand">
                15 languages
              </span>
              <span className="rounded-full border border-success/20 bg-success/10 px-3 py-1 text-xs font-black text-success">
                Global job seekers
              </span>
              <span className="rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-black text-brand">
                AI-powered
              </span>
            </div>
          </div>

          <FooterColumn title="Product" links={productLinks} />
          <FooterColumn title="Resources" links={resourceLinks} />
          <FooterColumn title="Legal" links={legalLinks} />
          <FooterColumn title="Connect" links={socialLinks} />
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-line pt-6 text-xs leading-5 text-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 WorkZo AI. All rights reserved.</p>
          <p className="max-w-xl text-right">
            WorkZo AI is interview preparation support. We do not guarantee job offers, interviews, or employment outcomes.
          </p>
        </div>
      </div>
    </footer>
  );
}
