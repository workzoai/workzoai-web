import Link from "next/link";
import { ArrowRight, CheckCircle2, Crown, Sparkles, Star } from "lucide-react";
import { getCurrentWorkZoUserSubscription } from "@/lib/workzoSubscription";
import PremiumActivationClient from "@/components/premium/PremiumActivationClient";

export const dynamic = "force-dynamic";

export default async function BillingSuccessPage() {
  const subscription = await getCurrentWorkZoUserSubscription();
  const plan = subscription?.plan ?? "premium";
  const isPro = plan === "premium_pro";
  const isActive = subscription?.status === "premium" || !!subscription;

  return (
    <main className="min-h-screen bg-canvas px-5 text-fg">
      <PremiumActivationClient active={isActive} plan={plan} />

      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(52,211,153,0.08),transparent_55%)]" />

      <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center py-16">

        {/* Icon */}
        <div className={`grid h-20 w-20 place-items-center rounded-xl ${isPro ? "bg-brand/15 text-brand" : "bg-success/15 text-success"}`}>
          {isPro ? <Star className="h-10 w-10" /> : <Crown className="h-10 w-10" />}
        </div>

        {/* Badge */}
        <p className="mt-7 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-5 py-2 text-xs font-black uppercase tracking-[0.22em] text-brand">
          <Sparkles className="h-3.5 w-3.5" />
          {isPro ? "Premium Pro activated" : "Premium activated"}
        </p>

        <h1 className="mt-6 text-center text-4xl font-black tracking-tight sm:text-3xl">
          {isPro ? "Your full career platform is ready." : "Your Premium access is active."}
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-center text-base leading-7 text-muted">
          {isActive
            ? isPro
              ? "Unlimited voice interviews, 60 Live AI Recruiter minutes, 7 premium personas, AI Career Coach, 30/60/90 day roadmaps, and replay intelligence are all unlocked."
              : "Full interview reports, interview history, Improve CV, ATS optimization, Cover Letter generator, Job Assist, Career Brain, and 50 voice interviews per month are now active."
            : "Your checkout was completed. Stripe may take a moment to confirm. If your plan does not activate immediately, refresh once or contact support@workzoai.com."}
        </p>

        {/* What's unlocked */}
        <div className="mt-8 w-full rounded-lg border border-line bg-fg/[0.04] p-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-muted mb-4">What you now have access to</p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {(isPro
              ? ["Unlimited voice interviews", "60 Live AI Recruiter minutes", "7 premium recruiter personas", "AI Career Coach", "30/60/90 day career roadmaps", "Replay Intelligence", "Priority AI models", "All Premium features"]
              : ["50 voice interviews / month", "Full advanced interview reports", "Improve CV + ATS keyword analysis", "Cover Letter generator", "Job Assist with AI fit scores", "Career Brain cross-session memory", "Performance tracking", "Interview history"]
            ).map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-muted">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row">
          <Link
            href="/onboarding"
            className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-6 py-4 text-sm font-black text-on-brand shadow-lg transition ${isPro ? "bg-brand shadow-brand/20 hover:bg-brand" : "bg-brand shadow-brand/20 hover:bg-brand"}`}
          >
            {isPro ? "Start Pro Interview" : "Start Premium Interview"}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/dashboard"
            className="flex-1 inline-flex items-center justify-center rounded-lg border border-line bg-fg/[0.04] px-6 py-4 text-sm font-black text-fg hover:bg-fg/[0.08]"
          >
            Go to Dashboard
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-subtle">
          Questions? <a href="mailto:support@workzoai.com" className="text-muted hover:text-fg">support@workzoai.com</a>
        </p>
      </div>
    </main>
  );
}
