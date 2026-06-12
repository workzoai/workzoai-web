import Link from "next/link";
import { ArrowLeft, CreditCard, Settings, UserRound } from "lucide-react";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { getWorkZoPlanLimits } from "@/lib/workzoPlanLimits";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const account = await resolveWorkZoServerPlan();
  const limits = getWorkZoPlanLimits(account.plan);
  return (
    <main className="min-h-screen bg-[#050a12] px-5 py-8 text-white">
      <section className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-black text-slate-300 hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to dashboard</Link>
        <div className="mt-8 grid h-14 w-14 place-items-center rounded-2xl bg-blue-500/15 text-blue-200"><UserRound className="h-6 w-6" /></div>
        <h1 className="mt-5 text-4xl font-black tracking-[-0.04em]">Account</h1>
        <p className="mt-3 text-slate-400">{account.email || "Sign in to save your WorkZo AI progress."}</p>
        <div className="mt-7 grid gap-4 md:grid-cols-2"><div className="rounded-3xl border border-white/10 bg-black/20 p-5"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Plan</p><p className="mt-2 text-2xl font-black">{limits.label}</p><p className="mt-1 text-sm text-slate-400">{limits.description}</p></div><div className="rounded-3xl border border-white/10 bg-black/20 p-5"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Subscription status</p><p className="mt-2 text-2xl font-black capitalize">{account.status.replace("_", " ")}</p><p className="mt-1 text-sm text-slate-400">{account.currentPeriodEnd ? `Access until ${new Date(account.currentPeriodEnd).toLocaleDateString()}` : "No renewal date available"}</p></div></div>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row"><Link href="/billing/manage" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-500 px-5 py-3 text-sm font-black text-white hover:bg-blue-400"><CreditCard className="h-4 w-4" />Billing</Link><Link href="/dashboard/settings" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-5 py-3 text-sm font-black text-slate-300 hover:bg-white/[0.06]"><Settings className="h-4 w-4" />Settings</Link></div>
      </section>
    </main>
  );
}
