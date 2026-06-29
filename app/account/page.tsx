import Link from "next/link";
import { ArrowLeft, CreditCard, Settings, UserRound } from "lucide-react";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { getWorkZoPlanLimits } from "@/lib/workzoPlanLimits";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const account = await resolveWorkZoServerPlan();
  const limits = getWorkZoPlanLimits(account.plan);
  return (
    <main className="min-h-screen bg-canvas px-5 py-8 text-fg">
      <section className="mx-auto max-w-4xl rounded-lg border border-line bg-fg/[0.04] p-8">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-black text-muted hover:text-fg"><ArrowLeft className="h-4 w-4" /> Back to dashboard</Link>
        <div className="mt-8 grid h-14 w-14 place-items-center rounded-lg bg-brand/15 text-brand"><UserRound className="h-6 w-6" /></div>
        <h1 className="mt-5 text-4xl font-black tracking-[-0.04em]">Account</h1>
        <p className="mt-3 text-muted">{account.email || "Sign in to save your WorkZo AI progress."}</p>
        <div className="mt-7 grid gap-4 md:grid-cols-2"><div className="rounded-xl border border-line bg-canvas-soft p-5"><p className="text-xs font-black uppercase tracking-[0.18em] text-subtle">Plan</p><p className="mt-2 text-2xl font-black">{limits.label}</p><p className="mt-1 text-sm text-muted">{limits.description}</p></div><div className="rounded-xl border border-line bg-canvas-soft p-5"><p className="text-xs font-black uppercase tracking-[0.18em] text-subtle">Subscription status</p><p className="mt-2 text-2xl font-black capitalize">{account.status.replace("_", " ")}</p><p className="mt-1 text-sm text-muted">{account.currentPeriodEnd ? `Access until ${new Date(account.currentPeriodEnd).toLocaleDateString()}` : "No renewal date available"}</p></div></div>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row"><Link href="/billing/manage" className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-black text-on-brand hover:bg-brand"><CreditCard className="h-4 w-4" />Billing</Link><Link href="/dashboard/settings" className="inline-flex items-center justify-center gap-2 rounded-lg border border-line px-5 py-3 text-sm font-black text-muted hover:bg-fg/[0.06]"><Settings className="h-4 w-4" />Settings</Link></div>
      </section>
    </main>
  );
}
