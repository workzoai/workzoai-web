import Link from "next/link";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";

export default function BillingCancelPage() {
  return (
    <main className="min-h-screen bg-[#04080f] px-5 text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.07),transparent_55%)]" />
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center py-16">
        <div className="grid h-16 w-16 place-items-center rounded-3xl bg-slate-400/15 text-slate-200">
          <Sparkles className="h-8 w-8" />
        </div>
        <h1 className="mt-7 text-center text-4xl font-black">No problem.</h1>
        <p className="mt-4 text-center text-base leading-7 text-slate-300">
          Your checkout was cancelled. You can upgrade any time — your free plan stays active.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/pricing" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-500 px-6 py-4 text-sm font-black text-white hover:bg-blue-400">
            View plans again <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/onboarding" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4 text-sm font-black text-slate-200 hover:bg-white/[0.08]">
            <ArrowLeft className="h-4 w-4" /> Continue with Free
          </Link>
        </div>
        <p className="mt-8 text-sm text-slate-500">
          Questions about plans?{" "}
          <a href="mailto:support@workzoai.com" className="text-slate-400 hover:text-white">
            support@workzoai.com
          </a>
        </p>
      </div>
    </main>
  );
}
