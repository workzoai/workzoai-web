import Link from "next/link";
import { ArrowLeft, Crown } from "lucide-react";

export default function BillingCancelPage() {
  return (
    <main className="min-h-screen bg-[#050a12] px-5 py-10 text-white">
      <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
        <section className="w-full rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl shadow-black/20">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-blue-500/15 text-blue-200">
            <Crown className="h-9 w-9" />
          </div>

          <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl">
            Checkout was cancelled.
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-300">
            No payment was taken. You can continue with the free plan or return to the opening offer anytime.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/pricing" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-500 px-6 py-4 text-sm font-black text-white hover:bg-blue-400">
              <ArrowLeft className="h-4 w-4" />
              Back to Pricing
            </Link>
            <Link href="/onboarding" className="inline-flex items-center justify-center rounded-2xl border border-white/10 px-6 py-4 text-sm font-black text-slate-200 hover:bg-white/10">
              Continue Free
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
