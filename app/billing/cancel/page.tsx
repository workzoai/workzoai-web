import Link from "next/link";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";

export default function BillingCancelPage() {
  return (
    <main className="min-h-screen bg-canvas px-5 text-fg">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.07),transparent_55%)]" />
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center py-16">
        <div className="grid h-16 w-16 place-items-center rounded-xl bg-slate-400/15 text-fg">
          <Sparkles className="h-8 w-8" />
        </div>
        <h1 className="mt-7 text-center text-4xl font-black">No problem.</h1>
        <p className="mt-4 text-center text-base leading-7 text-muted">
          Your checkout was cancelled. You can upgrade any time — your free plan stays active.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/pricing" className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-6 py-4 text-sm font-black text-on-brand hover:bg-brand">
            View plans again <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/onboarding" className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-fg/[0.04] px-6 py-4 text-sm font-black text-fg hover:bg-fg/[0.08]">
            <ArrowLeft className="h-4 w-4" /> Continue with Free
          </Link>
        </div>
        <p className="mt-8 text-sm text-subtle">
          Questions about plans?{" "}
          <a href="mailto:support@workzoai.com" className="text-muted hover:text-fg">
            support@workzoai.com
          </a>
        </p>
      </div>
    </main>
  );
}
