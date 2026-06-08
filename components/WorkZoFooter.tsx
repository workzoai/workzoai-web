import Link from "next/link";

const productLinks = [
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Interview Practice", href: "/features/interview-practice" },
  { label: "Improve CV", href: "/features/improve-cv" },
  { label: "Cover Letter", href: "/features/cover-letter" },
  { label: "Job Assist", href: "/features/job-assist" },
];

const resourceLinks = [
  { label: "About", href: "/about" },
  { label: "FAQ", href: "/faq" },
  { label: "Help Center", href: "/help" },
  { label: "Roadmap", href: "/roadmap" },
  { label: "Changelog", href: "/changelog" },
  { label: "System Status", href: "/status" },
];

const legalLinks = [
  { label: "Privacy", href: "/legal/privacy" },
  { label: "Terms", href: "/legal/terms" },
  { label: "Cookies", href: "/legal/cookies" },
  { label: "Disclaimer", href: "/legal/disclaimer" },
  { label: "Impressum", href: "/legal/impressum" },
  { label: "Delete My Data", href: "/legal/delete-data" },
];

const supportLinks = [
  { label: "Contact", href: "/contact" },
  { label: "Product Hunt", href: "https://www.producthunt.com/products/workzo-ai", external: true },
  { label: "LinkedIn", href: "https://www.linkedin.com/company/workzo-ai", external: true },
];

function FooterLink({ href, label, external = false }: { href: string; label: string; external?: boolean }) {
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-sm font-semibold text-slate-400 transition hover:text-white"
      >
        {label}
      </a>
    );
  }

  return (
    <Link href={href} className="text-sm font-semibold text-slate-400 transition hover:text-white">
      {label}
    </Link>
  );
}

function FooterColumn({ title, links }: { title: string; links: Array<{ label: string; href: string; external?: boolean }> }) {
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">{title}</p>
      <div className="mt-4 flex flex-col gap-3">
        {links.map((link) => (
          <FooterLink key={link.href} {...link} />
        ))}
      </div>
    </div>
  );
}

export default function WorkZoFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#050b14] px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-8 sm:grid-cols-2 lg:grid-cols-[1.25fr_0.75fr_0.75fr_0.75fr_0.8fr]">
        <div className="sm:col-span-2 lg:col-span-1">
          <p className="text-lg font-black text-white">WorkZo AI</p>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
            AI-powered interview preparation built to help job seekers practice realistic recruiter conversations with CV and job context.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-100">
              Beta
            </span>
            <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-100">
              Global job seekers
            </span>
          </div>
        </div>

        <FooterColumn title="Product" links={productLinks} />
        <FooterColumn title="Resources" links={resourceLinks} />
        <FooterColumn title="Legal" links={legalLinks} />

        <div>
          <FooterColumn title="Support" links={supportLinks} />
          <a
            href="mailto:support@workzoai.com"
            className="mt-3 block text-sm font-semibold text-slate-400 transition hover:text-white"
          >
            support@workzoai.com
          </a>
        </div>
      </div>

      <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-3 border-t border-white/10 pt-6 text-xs leading-5 text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 WorkZo AI · Beta</p>
        <p className="max-w-3xl">
          Interview preparation support. WorkZo AI does not guarantee interviews, job offers, or employment outcomes.
        </p>
      </div>
    </footer>
  );
}
