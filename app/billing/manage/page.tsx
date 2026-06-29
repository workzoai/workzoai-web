import Link from "next/link";
import { ArrowLeft, CheckCircle2, CreditCard, ShieldCheck } from "lucide-react";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { getWorkZoPlanLimits } from "@/lib/workzoPlanLimits";
import BillingPortalButton from "@/components/BillingPortalButton";

export const dynamic = "force-dynamic";

export default async function BillingManagePage() {
  const account = await resolveWorkZoServerPlan();
  const limits = getWorkZoPlanLimits(account.plan);
  const renewal = account.currentPeriodEnd ? new Date(account.currentPeriodEnd).toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric" }) : "Not available";

  return (
    <main className="min-h-screen bg-canvas px-5 py-8 text-fg">
      <section className="mx-auto max-w-4xl rounded-lg border border-line bg-fg/[0.04] p-8">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-black text-muted hover:text-fg"><ArrowLeft className="h-4 w-4" /> Back to dashboard</Link>
        <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-brand"><CreditCard className="h-4 w-4" /> Billing</div>
        <h1 className="mt-4 text-4xl font-black tracking-[-0.04em]">Manage your subscription</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">View your current WorkZo AI plan and manage billing through Stripe Customer Portal.</p>
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-line bg-canvas-soft p-5"><p className="text-xs font-black uppercase tracking-[0.18em] text-subtle">Current plan</p><p className="mt-2 text-2xl font-black">{limits.label}</p></div>
          <div className="rounded-xl border border-line bg-canvas-soft p-5"><p className="text-xs font-black uppercase tracking-[0.18em] text-subtle">Status</p><p className="mt-2 text-2xl font-black capitalize">{account.status.replace("_", " ")}</p></div>
          <div className="rounded-xl border border-line bg-canvas-soft p-5"><p className="text-xs font-black uppercase tracking-[0.18em] text-subtle">Renewal / access until</p><p className="mt-2 text-lg font-black">{renewal}</p></div>
        </div>
        <div className="mt-7 rounded-xl border border-success/15 bg-success/[0.06] p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-success" /><p className="text-sm leading-6 text-muted">Billing, cancellation, payment method updates, and invoices are handled securely in Stripe.</p></div></div>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          {account.authenticated && account.stripeCustomerId ? <BillingPortalButton /> : <Link href="/pricing" className="inline-flex items-center justify-center rounded-lg bg-brand px-5 py-3 text-sm font-black text-on-brand hover:bg-brand">View plans</Link>}
          <Link href="/dashboard/settings" className="inline-flex items-center justify-center rounded-lg border border-line px-5 py-3 text-sm font-black text-muted hover:bg-fg/[0.06]">Account settings</Link>
        </div>
      </section>
    </main>
  );
}
