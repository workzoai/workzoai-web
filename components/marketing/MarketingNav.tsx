"use client";

/*
 * Shared marketing navigation pieces, all driven by the free-tools registry.
 *
 *  - CareerToolsDropdown: desktop hover dropdown listing every free tool plus
 *    a "View all free tools" link. Drop it into any desktop <nav>.
 *  - MarketingMobileMenu: a hamburger + slide-down panel for small screens,
 *    with the primary links you pass in and a Career Tools group from the
 *    registry.
 *
 * Because both read FREE_TOOL_LINKS, adding a tool to lib/free-tools.ts makes
 * it appear in the desktop dropdown and the mobile menu automatically.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import { FREE_TOOL_LINKS } from "@/lib/free-tools";
import { getFreeToolIcon } from "./freeToolIcons";
import AuthNavButton from "@/components/auth/AuthNavButton";

export type MarketingNavLink = { label: string; href: string };

/* ── Desktop: Career Tools dropdown ──────────────────────────── */
export function CareerToolsDropdown({
  triggerClassName = "inline-flex items-center gap-1.5 transition hover:text-fg",
}: {
  triggerClassName?: string;
}) {
  return (
    <div className="group relative">
      <button type="button" className={triggerClassName}>
        Career Tools
        <ChevronDown className="h-4 w-4" />
      </button>

      {/* Invisible bridge keeps the menu open across the gap */}
      <div className="absolute left-0 top-full h-3 w-full" />
      <div className="invisible absolute left-0 top-full z-50 mt-1 w-80 translate-y-1 rounded-2xl border border-line bg-canvas/95 p-3 opacity-0 shadow-2xl shadow-black/30 backdrop-blur-xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
        {FREE_TOOL_LINKS.map((tool) => {
          const Icon = getFreeToolIcon(tool.icon);
          return (
            <Link
              key={tool.id}
              href={tool.href}
              className="group/item grid grid-cols-[40px_1fr] gap-3 rounded-xl p-2.5 transition hover:bg-fg/10"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand transition group-hover/item:bg-brand group-hover/item:text-on-brand">
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="flex items-center gap-2 text-sm font-black text-fg">
                  {tool.label}
                  <span className="rounded-full border border-brand/20 bg-brand/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-brand">
                    {tool.badge}
                  </span>
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-muted">{tool.description}</span>
              </span>
            </Link>
          );
        })}

        <Link
          href="/tools"
          className="mt-1 flex items-center justify-between rounded-xl border-t border-line px-3 pb-1 pt-3 text-sm font-black text-brand transition hover:text-brand-strong"
        >
          View all free tools
          <ChevronDown className="h-4 w-4 -rotate-90" />
        </Link>
      </div>
    </div>
  );
}

/* ── Mobile: hamburger + panel ───────────────────────────────── */
export function MarketingMobileMenu({
  links,
  className = "md:hidden",
}: {
  links: MarketingNavLink[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  // Lock body scroll while the panel is open.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-fg/10 text-fg transition hover:bg-fg/20"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-[60]">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          <div className="absolute inset-x-0 top-0 max-h-[92vh] overflow-y-auto rounded-b-3xl border-b border-line bg-canvas p-5 shadow-2xl shadow-black/30">
            <div className="flex items-center justify-between">
              <span className="text-sm font-black uppercase tracking-[0.18em] text-subtle">Menu</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-fg/5 text-fg transition hover:bg-fg/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="mt-4 flex flex-col gap-1">
              {links.map((link) => (
                <Link
                  key={`${link.label}-${link.href}`}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-3 text-base font-black text-fg transition hover:bg-fg/10"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="mt-4 border-t border-line pt-4">
              <p className="px-3 text-[11px] font-black uppercase tracking-[0.2em] text-subtle">Career Tools</p>
              <div className="mt-2 flex flex-col gap-1">
                {FREE_TOOL_LINKS.map((tool) => {
                  const Icon = getFreeToolIcon(tool.icon);
                  return (
                    <Link
                      key={tool.id}
                      href={tool.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-black text-fg transition hover:bg-fg/10"
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-brand">
                        <Icon className="h-4 w-4" />
                      </span>
                      {tool.shortLabel}
                      <span className="ml-auto rounded-full border border-brand/20 bg-brand/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-brand">
                        {tool.badge}
                      </span>
                    </Link>
                  );
                })}
                <Link
                  href="/tools"
                  onClick={() => setOpen(false)}
                  className="mt-1 rounded-xl px-3 py-2.5 text-sm font-black text-brand transition hover:bg-brand/10"
                >
                  View all free tools →
                </Link>
              </div>
            </div>

            <div className="mt-5 border-t border-line pt-4">
              <AuthNavButton />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
