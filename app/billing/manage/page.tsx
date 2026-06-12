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
    <main className="min-h-screen bg-[#050a12] px-5 py-8 text-white">
      <section className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-black text-slate-300 hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to dashboard</Link>
        <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-blue-100"><CreditCard className="h-4 w-4" /> Billing</div>
        <h1 className="mt-4 text-4xl font-black tracking-[-0.04em]">Manage your subscription</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">View your current WorkZo AI plan and manage billing through Stripe Customer Portal.</p>
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-black/20 p-5"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Current plan</p><p className="mt-2 text-2xl font-black">{limits.label}</p></div>
          <div className="rounded-3xl border border-white/10 bg-black/20 p-5"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Status</p><p className="mt-2 text-2xl font-black capitalize">{account.status.replace("_", " ")}</p></div>
          <div className="rounded-3xl border border-white/10 bg-black/20 p-5"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Renewal / access until</p><p className="mt-2 text-lg font-black">{renewal}</p></div>
        </div>
        <div className="mt-7 rounded-3xl border border-emerald-300/15 bg-emerald-400/[0.06] p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-200" /><p className="text-sm leading-6 text-slate-300">Billing, cancellation, payment method updates, and invoices are handled securely in Stripe.</p></div></div>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          {account.authenticated && account.stripeCustomerId ? <BillingPortalButton /> : <Link href="/pricing" className="inline-flex items-center justify-center rounded-2xl bg-blue-500 px-5 py-3 text-sm font-black text-white hover:bg-blue-400">View plans</Link>}
          <Link href="/dashboard/settings" className="inline-flex items-center justify-center rounded-2xl border border-white/10 px-5 py-3 text-sm font-black text-slate-300 hover:bg-white/[0.06]">Account settings</Link>
        </div>
      </section>
    </main>
  );
}
