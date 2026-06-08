import Link from "next/link";
import { CheckCircle2, ArrowRight, Sparkles } from "lucide-react";
import { getCurrentWorkZoUserSubscription } from "@/lib/workzoSubscription";
import PremiumActivationClient from "@/components/premium/PremiumActivationClient";

export const dynamic = "force-dynamic";

export default async function BillingSuccessPage() {
  const subscription = await getCurrentWorkZoUserSubscription();
  const isPremium = subscription?.status === "premium";

  return (
    <main className="min-h-screen bg-[#050a12] px-5 py-10 text-white">
      <PremiumActivationClient active={isPremium} />
      <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
        <section className="w-full rounded-[2rem] border border-emerald-300/20 bg-emerald-400/[0.06] p-8 text-center shadow-2xl shadow-emerald-950/20">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-emerald-400/15 text-emerald-200">
            <CheckCircle2 className="h-9 w-9" />
          </div>

          <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-100">
            <Sparkles className="h-4 w-4" />
            Premium activated
          </p>

          <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">
            You are ready to use WorkZo Premium.
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-300">
            {isPremium
              ? "Your Premium access is active. You can now use full reports, interview history, Improve CV, Cover Letter, Job Assist, and premium interview limits."
              : "Your checkout was completed. Stripe may take a moment to confirm the webhook. If Premium does not unlock immediately, refresh once or try again in a minute."}
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/onboarding" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-500 px-6 py-4 text-sm font-black text-white hover:bg-blue-400">
              Start Premium Interview
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/dashboard" className="inline-flex items-center justify-center rounded-2xl border border-white/10 px-6 py-4 text-sm font-black text-slate-200 hover:bg-white/10">
              Go to Dashboard
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
