import Link from "next/link";
import Image from "next/image";
import {
  Lock,
  Mail,
  MessageCircle,
  Rocket,
} from "lucide-react";
import { FREE_TOOL_LINKS } from "@/lib/free-tools";
import { getFreeToolIcon } from "@/components/marketing/freeToolIcons";

// lucide-react removed brand icons in recent versions, so LinkedIn is kept as
// a small inline SVG with the same props shape as a lucide icon.
function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.55C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

type FooterLinkItem = {
  label: string;
  href: string;
  external?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string;
};

const productLinks: FooterLinkItem[] = [
  { label: "Interview Practice", href: "/features/interview-practice" },
  { label: "AI Career Coach", href: "/pricing?plan=premium_pro" },
  { label: "Improve CV", href: "/cv" },
  { label: "Cover Letter", href: "/cover-letter" },
  { label: "Job Assist", href: "/jobs" },
  { label: "Pricing", href: "/pricing" },
];

// Career Tools come straight from the global registry, so adding a tool in
// lib/free-tools.ts adds it here automatically and always points at its
// dedicated /tools/* SEO page.
const careerToolLinks: FooterLinkItem[] = FREE_TOOL_LINKS.map((tool) => ({
  label: tool.label,
  href: tool.href,
  icon: getFreeToolIcon(tool.icon),
}));

const solutionLinks: FooterLinkItem[] = [
  { label: "For Students", href: "/for-education/students" },
  { label: "For Career Changers", href: "/for-education/career-changers" },
  { label: "For Universities", href: "/for-education/universities-career-services" },
  { label: "For Coding Bootcamps", href: "/for-education/coding-bootcamps" },
  { label: "For Career Coaches", href: "/for-education/career-coaches" },
  { label: "For Companies", href: "/for-education/enterprise-hiring" },
  { label: "Enterprise", href: "/enterprise" },
];

const resourceLinks: FooterLinkItem[] = [
  { label: "Blog", href: "/blog" },
  { label: "Interview Guides", href: "/resources/interview-guides" },
  { label: "Career Resources", href: "/resources" },
  { label: "Roadmap", href: "/roadmap" },
  { label: "FAQ", href: "/faq" },
  { label: "Help Center", href: "/help" },
  { label: "Changelog", href: "/changelog" },
  { label: "System Status", href: "/status" },
];

const companyLinks: FooterLinkItem[] = [
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact", icon: MessageCircle },
  { label: "LinkedIn", href: "https://www.linkedin.com/company/workzo-ai", external: true, icon: LinkedinIcon },
  { label: "Product Hunt", href: "https://www.producthunt.com/products/workzo-ai", external: true, icon: Rocket },
  { label: "support@workzoai.com", href: "mailto:support@workzoai.com", external: true, icon: Mail },
];

const legalLinks: FooterLinkItem[] = [
  { label: "Privacy Policy", href: "/legal/privacy" },
  { label: "Terms of Service", href: "/legal/terms" },
  { label: "Cookie Policy", href: "/legal/cookies" },
  { label: "Security & Data", href: "/security" },
  { label: "Responsible AI", href: "/legal/responsible-ai" },
  { label: "Accessibility", href: "/legal/accessibility" },
  { label: "Delete My Data", href: "/legal/delete-data" },
  { label: "Disclaimer", href: "/legal/disclaimer" },
  { label: "Impressum", href: "/legal/impressum" },
];

function FooterLink({ href, label, external = false, icon: Icon, badge }: FooterLinkItem) {
  const cls = "group inline-flex items-center gap-2 text-sm text-muted transition hover:text-fg";
  const inner = (
    <>
      {Icon ? <Icon className="h-4 w-4 shrink-0 text-subtle transition group-hover:text-fg" /> : null}
      <span>{label}</span>
      {badge ? (
        <span className="rounded-full border border-brand/20 bg-brand/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-brand">
          {badge}
        </span>
      ) : null}
    </>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        {inner}
      </a>
    );
  }

  return (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}

function FooterColumn({ title, links }: { title: string; links: FooterLinkItem[] }) {
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-subtle">{title}</p>
      <div className="mt-4 flex flex-col gap-3">
        {links.map((link) => (
          <FooterLink key={`${title}-${link.href}-${link.label}`} {...link} />
        ))}
      </div>
    </div>
  );
}

export default function WorkZoFooter({ minimal = false }: { minimal?: boolean }) {
  if (minimal) {
    return (
      <footer className="border-t border-line bg-canvas px-4 py-8 text-fg sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 WorkZo AI. All rights reserved.</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <Link href="/legal/privacy" className="hover:text-fg">Privacy</Link>
            <Link href="/legal/terms" className="hover:text-fg">Terms</Link>
            <Link href="/contact" className="hover:text-fg">Contact</Link>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t border-line bg-canvas px-4 py-12 text-fg sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.35fr_0.82fr_0.92fr_0.92fr_0.82fr_0.82fr_0.95fr]">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-3">
              <Image src="/workzo_icon.png" alt="WorkZo AI" width={36} height={36} className="rounded-xl" />
              <span className="text-xl font-black tracking-tight">
                WorkZo <span className="text-brand">AI</span>
              </span>
            </Link>

            <p className="mt-4 max-w-sm text-sm leading-6 text-muted">
              Your AI-powered career platform helping job seekers prepare for interviews, improve CVs, generate cover letters, and build confidence with realistic recruiter conversations in 15 languages.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-black text-brand">
                15 languages
              </span>
              <span className="rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-black text-brand">
                AI-powered
              </span>
              <span className="rounded-full border border-success/20 bg-success/10 px-3 py-1 text-xs font-black text-success">
                Global job seekers
              </span>
              <span className="rounded-full border border-line bg-fg/[0.04] px-3 py-1 text-xs font-black text-muted">
                Privacy-first
              </span>
            </div>
          </div>

          <FooterColumn title="Product" links={productLinks} />
          <FooterColumn title="Career Tools" links={careerToolLinks} />
          <FooterColumn title="Solutions" links={solutionLinks} />
          <FooterColumn title="Resources" links={resourceLinks} />
          <FooterColumn title="Company" links={companyLinks} />
          <FooterColumn title="Legal" links={legalLinks} />
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-line pt-6 text-xs leading-5 text-subtle lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1.5">
            <p>© 2026 WorkZo AI. All rights reserved.</p>
            <p>Made in Germany 🇩🇪 · Supporting job seekers worldwide.</p>
            <p className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" /> Your CV is processed securely. We never sell personal information.
            </p>
          </div>

          <p className="max-w-xl lg:text-right">
            WorkZo AI helps you prepare for interviews, improve your CV, and advance your career. We support your preparation but cannot guarantee employment or interview outcomes.
          </p>
        </div>
      </div>
    </footer>
  );
}
