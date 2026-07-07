/**
 * WorkZo AI — premium marketing kit.
 *
 * Server-renderable, on-brand building blocks so every informational
 * page (For Education, Resources, About, FAQ, Help, Status, Changelog, Roadmap,
 * Features, Enterprise) shares one polished visual system. All colour comes from
 * the existing WorkZo tokens (bg-canvas, surface, brand, line, muted…) so these
 * pages sit seamlessly inside the product.
 *
 * Signature devices:
 *  - an eyebrow + hairline rule that labels every section
 *  - soft, layered surfaces (hairline border + faint gradient + soft shadow)
 *  - restrained scroll reveals that respect prefers-reduced-motion
 */

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import AuthNavButton from "@/components/auth/AuthNavButton";
import WorkZoFooter from "@/components/WorkZoFooter";
import { CareerToolsDropdown, MarketingMobileMenu } from "./MarketingNav";

export { Reveal } from "./Reveal";

const MARKETING_MOBILE_LINKS = [
  { label: "For Education", href: "/for-education" },
  { label: "Enterprise", href: "/enterprise" },
  { label: "Resources", href: "/resources" },
  { label: "Pricing", href: "/pricing" },
];

/* ── Ambient page background ─────────────────────────────────── */
export function AmbientBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_78%_44%_at_50%_-8%,rgba(37,99,235,0.20),transparent_68%),radial-gradient(ellipse_46%_38%_at_94%_92%,rgba(20,184,166,0.12),transparent_70%)]"
    />
  );
}

/* ── Header ──────────────────────────────────────────────────── */
export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="relative h-10 w-10 overflow-hidden rounded-xl ring-1 ring-line">
            <Image src="/workzo_icon.png" alt="WorkZo AI" fill priority sizes="40px" className="object-cover" />
          </span>
          <span className="text-lg font-black tracking-tight sm:text-xl">
            WorkZo <span className="text-muted">AI</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-bold text-muted md:flex">
          <Link href="/for-education" className="transition hover:text-fg">For Education</Link>
          <Link href="/enterprise" className="transition hover:text-fg">Enterprise</Link>
          <CareerToolsDropdown triggerClassName="inline-flex items-center gap-1.5 font-bold text-muted transition hover:text-fg" />
          <Link href="/resources" className="transition hover:text-fg">Resources</Link>
          <Link href="/pricing" className="transition hover:text-fg">Pricing</Link>
        </nav>
        <div className="flex items-center gap-2">
          <div className="hidden md:block">
            <AuthNavButton />
          </div>
          <MarketingMobileMenu links={MARKETING_MOBILE_LINKS} />
        </div>
      </div>
    </header>
  );
}

/* ── Page shell (header + ambient + footer) ──────────────────── */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas text-fg">
      <AmbientBackdrop />
      <MarketingHeader />
      {children}
      <WorkZoFooter />
    </div>
  );
}

/* ── Eyebrow + section heading ───────────────────────────────── */
export function Eyebrow({ children, icon: Icon }: { children: React.ReactNode; icon?: LucideIcon }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-brand">
      {Icon ? <Icon className="h-4 w-4" /> : <span className="h-px w-6 bg-brand/50" />}
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  intro,
  align = "left",
  icon,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  intro?: React.ReactNode;
  align?: "left" | "center";
  icon?: LucideIcon;
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {eyebrow ? <Eyebrow icon={icon}>{eyebrow}</Eyebrow> : null}
      <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">{title}</h2>
      {intro ? <p className="mt-4 text-base leading-7 text-muted">{intro}</p> : null}
    </div>
  );
}

/* ── Buttons ─────────────────────────────────────────────────── */
export function PrimaryButton({
  href,
  children,
  external = false,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  const cls =
    "group inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-xl bg-brand px-7 text-sm font-black text-on-brand shadow-[0_8px_24px_-8px_rgba(37,99,235,0.6)] transition hover:bg-brand-strong hover:shadow-[0_10px_28px_-6px_rgba(37,99,235,0.7)]";
  const inner = (
    <>
      {children}
      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
    </>
  );
  return external ? (
    <a href={href} className={cls}>{inner}</a>
  ) : (
    <Link href={href} className={cls}>{inner}</Link>
  );
}

export function GhostButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-xl border border-line bg-fg/[0.04] px-7 text-sm font-black text-fg transition hover:bg-fg/[0.08]"
    >
      {children}
    </Link>
  );
}

/* ── Feature card ────────────────────────────────────────────── */
export function FeatureCard({
  icon: Icon,
  title,
  children,
  href,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  href?: string;
}) {
  const body = (
    <div className="group relative h-full overflow-hidden rounded-2xl border border-line bg-surface/70 p-6 transition hover:border-brand/30 hover:bg-surface">
      <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-brand/40 to-transparent opacity-0 transition group-hover:opacity-100" />
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand transition group-hover:bg-brand group-hover:text-on-brand">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-5 text-lg font-black tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted">{children}</p>
      {href ? (
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-black text-brand">
          Open <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      ) : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">{body}</Link>
  ) : (
    body
  );
}

/* ── Stat band ───────────────────────────────────────────────── */
export function StatBand({ stats }: { stats: { value: string; label: string }[] }) {
  return (
    <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
      {stats.map((s) => (
        <div key={s.label} className="bg-canvas p-6">
          <p className="text-3xl font-black tracking-tight text-brand">{s.value}</p>
          <p className="mt-1.5 text-sm leading-6 text-muted">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

/* ── FAQ accordion (native <details>, accessible) ────────────── */
export function FaqAccordion({ items }: { items: { q: string; a: React.ReactNode }[] }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface/60">
      {items.map((it, i) => (
        <details key={i} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-black text-fg">
            {it.q}
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-line text-muted transition group-open:rotate-45 group-open:border-brand/40 group-open:text-brand">
              <span className="text-lg leading-none">+</span>
            </span>
          </summary>
          <div className="mt-3 text-sm leading-7 text-muted">{it.a}</div>
        </details>
      ))}
    </div>
  );
}

/* ── CTA section ─────────────────────────────────────────────── */
export function CTASection({
  title,
  intro,
  primary,
  secondary,
}: {
  title: React.ReactNode;
  intro?: React.ReactNode;
  primary: { href: string; label: string; external?: boolean };
  secondary?: { href: string; label: string };
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-[2rem] border border-line bg-gradient-to-br from-brand/[0.12] via-surface/60 to-transparent px-6 py-14 text-center sm:px-10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand/10 blur-3xl" />
        <h2 className="mx-auto max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">{title}</h2>
        {intro ? <p className="mx-auto mt-4 max-w-2xl text-muted">{intro}</p> : null}
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <PrimaryButton href={primary.href} external={primary.external}>{primary.label}</PrimaryButton>
          {secondary ? <GhostButton href={secondary.href}>{secondary.label}</GhostButton> : null}
        </div>
      </div>
    </section>
  );
}

/* ── Back link ───────────────────────────────────────────────── */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-lg border border-line bg-fg/[0.04] px-3.5 py-2 text-sm font-black text-muted transition hover:bg-fg/[0.08] hover:text-fg"
    >
      <ArrowRight className="h-4 w-4 rotate-180" />
      {children}
    </Link>
  );
}
