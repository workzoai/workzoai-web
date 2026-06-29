"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { ArrowLeft, Bell, CheckCircle2, CreditCard, FileText, History, LockKeyhole, LogOut, Settings, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getWorkZoPlanLimits, normalizeWorkZoPlan, type WorkZoPlanType } from "@/lib/workzoPlanLimits";
import { setWorkZoCurrentPlan } from "@/lib/workzoUsageTracker";

type AccountState = { email: string; signedIn: boolean; plan: WorkZoPlanType; status: string; renewal: string | null };

export default function DashboardSettingsPage() {
  const [account, setAccount] = useState<AccountState>({ email: "", signedIn: false, plan: "free", status: "Checking…", renewal: null });
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const limits = useMemo(() => getWorkZoPlanLimits(account.plan), [account.plan]);

  useEffect(() => {
    let active = true;
    async function loadAccount() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        const res = await fetch("/api/account/plan", { cache: "no-store" });
        const planData = await res.json().catch(() => ({}));
        const plan = normalizeWorkZoPlan(planData?.plan || "free");
        setWorkZoCurrentPlan(plan);
        if (!active) return;
        setAccount({ email: user?.email || planData?.email || "", signedIn: Boolean(user || planData?.authenticated), plan, status: String(planData?.status || (plan === "free" ? "free" : "active")), renewal: planData?.currentPeriodEnd || null });
      } catch {
        if (!active) return;
        setAccount({ email: "", signedIn: false, plan: "free", status: "Unavailable", renewal: null });
      } finally { if (active) setLoading(false); }
    }
    loadAccount();
    return () => { active = false; };
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch { setSigningOut(false); }
  }

  const preferenceCards = [
    { title: "Account", description: account.email || "Sign in to save interviews and manage billing.", icon: UserRound, status: account.signedIn ? "Active" : "Signed out" },
    { title: "Plan", description: `${limits.description} ${account.renewal ? `Access until ${new Date(account.renewal).toLocaleDateString()}.` : ""}`, icon: CreditCard, status: loading ? "Checking…" : limits.label, href: "/billing/manage" },
    { title: "Data & privacy", description: "Your account, reports, and billing state are protected. Legal and deletion pages are available anytime.", icon: ShieldCheck, status: "Protected", href: "/legal/privacy" },
    { title: "Notifications", description: "Product emails are limited to account, billing, and important onboarding messages.", icon: Bell, status: "Product emails" },
  ];

  return (
    <main className="min-h-screen bg-canvas px-4 py-5 text-fg sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-canvas/90 p-4 shadow-2xl shadow-black/20">
          <Link href="/history" className="inline-flex items-center gap-2 text-sm font-black text-muted hover:text-fg"><ArrowLeft className="h-4 w-4" />Back to dashboard</Link>
          <Link href="/history" className="flex items-center gap-3"><Image src="/workzo_icon.png" alt="WorkZo AI" width={42} height={42} className="rounded-lg" /><div><p className="text-lg font-black">WorkZo <span className="text-brand">AI</span></p><p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand">Workspace</p></div></Link>
        </header>

        <section className="mt-6 rounded-lg border border-line bg-gradient-to-br from-brand/15 via-brand/10 to-white/[0.03] p-6 sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/[0.08] px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-brand"><Settings className="h-4 w-4" />Workspace settings</div>
          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px] lg:items-end"><div><h1 className="text-4xl font-black tracking-tight sm:text-3xl">Account & workspace</h1><p className="mt-3 max-w-2xl text-base leading-7 text-muted">Manage your account, plan, billing, privacy, and interview workspace links.</p></div><div className="rounded-xl border border-line bg-canvas-soft p-4"><p className="text-xs font-black uppercase tracking-[0.18em] text-muted">Current plan</p><div className="mt-3 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-lg bg-success/15"><CheckCircle2 className="h-5 w-5 text-success" /></div><div className="min-w-0"><p className="font-black text-success">{loading ? "Checking…" : limits.label}</p><p className="truncate text-sm text-muted">{account.email || "Sign in to save history"}</p></div></div></div></div>
        </section>

        <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {preferenceCards.map((item) => { const Icon = item.icon; const body = <article className="h-full rounded-xl border border-line bg-fg/[0.035] p-5 transition hover:bg-fg/[0.055]"><div className="flex items-start justify-between gap-3"><div className="grid h-11 w-11 place-items-center rounded-lg bg-brand/10"><Icon className="h-5 w-5 text-brand" /></div><span className="rounded-full border border-line bg-fg/[0.05] px-3 py-1 text-[11px] font-black text-muted">{item.status}</span></div><h2 className="mt-5 text-xl font-black">{item.title}</h2><p className="mt-2 text-sm leading-6 text-muted">{item.description}</p></article>; return item.href ? <Link key={item.title} href={item.href}>{body}</Link> : <div key={item.title}>{body}</div>; })}
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="rounded-lg border border-line bg-fg/[0.035] p-6"><h2 className="text-2xl font-black">Quick actions</h2><div className="mt-5 grid gap-3 sm:grid-cols-2"><Quick href="/billing/manage" icon={CreditCard} title="Manage billing" text="Open plan, renewal, invoices, cancellation, and Stripe portal." /><Quick href="/history" icon={History} title="View interview history" text="Open saved reports and previous recruiter feedback." /><Quick href="/copilot" icon={Sparkles} title="Open Work-O-Bot" text="Use the AI copilot for CV, answer comparison, and career planning." /><Quick href="/legal/delete-data" icon={FileText} title="Data request" text="Request account or data deletion information." /></div></div>
          <aside className="rounded-lg border border-line bg-fg/[0.035] p-6"><h2 className="text-2xl font-black">Session</h2><p className="mt-2 text-sm leading-6 text-muted">Sign out only affects your local session. Saved interview reports remain in your account history.</p>{account.signedIn ? <button type="button" onClick={handleSignOut} disabled={signingOut} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-danger/20 bg-danger/[0.08] px-5 py-3 text-sm font-black text-danger hover:bg-danger/[0.12] disabled:opacity-60"><LogOut className="h-4 w-4" />{signingOut ? "Signing out…" : "Sign out"}</button> : <Link href="/login?redirect=/dashboard/settings" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-black text-on-brand hover:bg-brand"><LockKeyhole className="h-4 w-4" />Sign in</Link>}</aside>
        </section>
      </div>
    </main>
  );
}

function Quick({ href, icon: Icon, title, text }: { href: string; icon: ComponentType<{ className?: string }>; title: string; text: string }) {
  return <Link href={href} className="rounded-lg border border-line bg-canvas-soft p-4 hover:bg-fg/[0.06]"><Icon className="h-5 w-5 text-brand" /><p className="mt-3 font-black">{title}</p><p className="mt-1 text-sm text-muted">{text}</p></Link>;
}
