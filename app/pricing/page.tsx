"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Building2,
  CheckCircle2,
  Crown,
  GraduationCap,
  History,
  Loader2,
  Mic,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  Video,
} from "lucide-react";
import AuthNavButton from "@/components/auth/AuthNavButton";
import { type WorkZoBillingCycle, type WorkZoPlanType } from "@/lib/workzoPlanLimits";
import { getWorkZoDisplayPrices, getWorkZoRegionalPriceSet } from "@/lib/workzoLocalizedPricing";
import {
  disableWorkZoFounderTestMode,
  recordWorkZoUpgradeClick,
  resetWorkZoTestingUsage,
  setWorkZoCurrentPlan,
} from "@/lib/workzoUsageTracker";

type PromoState = {
  code: string;
  valid: boolean;
  message: string;
  discountLabel: string;
};

type PricingCard = {
  id: WorkZoPlanType | "enterprise";
  label: string;
  title: string;
  subtitle: string;
  badge?: string;
  icon: ReactNode;
  priceNote?: string;
  features: string[];
  muted?: string[];
  cta: string;
  popular?: boolean;
  enterprise?: boolean;
};

const VALID_PROMOS: Record<string, { message: string; discountLabel: string }> = {
  EARLYACCESS: {
    message: "Early access code applied. Your discount will be carried into checkout.",
    discountLabel: "Early access discount",
  },
  WORKZOEARLY: {
    message: "WorkZo early-user code applied. Your discount will be carried into checkout.",
    discountLabel: "Early-user discount",
  },
  FOUNDERFRIEND: {
    message: "Founder friend code applied for testing. This stores your promo for checkout.",
    discountLabel: "Founder friend access",
  },
};

const PRICING_CARDS: PricingCard[] = [
  {
    id: "free",
    label: "Free",
    title: "Try WorkZo",
    subtitle: "Perfect for testing one realistic AI interview before upgrading.",
    badge: "Free Forever",
    icon: <Rocket className="h-5 w-5" />,
    features: [
      "1 complete AI voice interview",
      "CV-aware recruiter questions",
      "Basic STAR scorecard",
      "Standard interview report",
      "Score, pace, and filler-word analysis",
      "Standard recruiter personas",
    ],
    muted: ["No video interview", "No interview history", "No advanced performance analysis"],
    cta: "Get Started",
  },
  {
    id: "premium",
    label: "Premium",
    title: "Practice Daily",
    subtitle: "For active job seekers preparing seriously with AI voice practice and career tools.",
    badge: "Most Popular",
    icon: <Crown className="h-5 w-5" />,
    popular: true,
    priceNote: "24-hour free trial · cancel anytime",
    features: [
      "300 AI voice minutes / month",
      "Unlimited sessions within your minutes",
      "Unlimited resume optimization",
      "Unlimited ATS analysis",
      "Unlimited cover letters",
      "Job description analysis",
      "Basic progress tracking",
      "All core recruiter personas",
      "Multi-language interview practice",
    ],
    muted: ["No AI video interview", "No premium recruiter personas", "No advanced performance analysis"],
    cta: "Upgrade Now",
  },
  {
    id: "premium_pro",
    label: "Premium Pro",
    title: "Master Interviews",
    subtitle: "Your personal AI interview coach for high-stakes interviews and face-to-face delivery.",
    badge: "Full System",
    icon: <Star className="h-5 w-5" />,
    priceNote: "Includes AI video practice (early access)",
    features: [
      "Everything in Premium",
      "600 AI voice minutes / month",
      "60 AI video minutes / month (early access)",
      "Detailed interview feedback",
      "Advanced performance analysis",
      "Multi-session interview history",
      "AI improvement suggestions",
      "Premium recruiter personas",
      "Priority AI processing",
    ],
    cta: "Go Pro",
  },
  {
    id: "enterprise",
    label: "Enterprise & Education",
    title: "Train Cohorts",
    subtitle: "For universities, bootcamps, and hiring teams scaling interview readiness across groups.",
    badge: "Institutional",
    icon: <Building2 className="h-5 w-5" />,
    enterprise: true,
    priceNote: "Annual contract · volume pricing",
    features: [
      "Shared AI voice & video minute pools",
      "Custom JD and recruiter persona mapping",
      "Team management",
      "Priority support",
      "Dedicated onboarding",
      "Volume pricing",
    ],
    cta: "Request Demo",
  },
];

const comparisonRows = [
  { label: "AI Voice Interviews", free: "1 interview", premium: "300 mins / mo", pro: "600 mins / mo", enterprise: "Shared pool" },
  { label: "AI Video Interviews (early access)", free: "—", premium: "—", pro: "60 mins / mo", enterprise: "Shared pool" },
  { label: "Resume Optimization", free: "Basic", premium: "Unlimited", pro: "Unlimited", enterprise: "Unlimited" },
  { label: "ATS Analysis", free: "Basic", premium: "Unlimited", pro: "Unlimited", enterprise: "Unlimited" },
  { label: "Cover Letters", free: "—", premium: "Unlimited", pro: "Unlimited", enterprise: "Unlimited" },
  { label: "Job Description Analysis", free: "—", premium: "Included", pro: "Included", enterprise: "Included" },
  { label: "Recruiter Personas", free: "Standard", premium: "Core", pro: "Premium", enterprise: "Custom" },
  { label: "Progress Tracking", free: "—", premium: "Basic", pro: "Advanced", enterprise: "Cohort analytics" },
  { label: "Interview History", free: "—", premium: "Included", pro: "Multi-session", enterprise: "Included" },
  { label: "Performance Analysis", free: "Basic", premium: "Standard", pro: "Advanced", enterprise: "Advanced" },
  { label: "AI Improvement Suggestions", free: "—", premium: "—", pro: "Included", enterprise: "Included" },
  { label: "Team Management", free: "—", premium: "—", pro: "—", enterprise: "Included" },
  { label: "Onboarding & Support", free: "Standard", premium: "Standard", pro: "Priority", enterprise: "Dedicated" },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function readStoredPromo(validPromo?: PromoState) {
  if (validPromo?.valid) return validPromo.code;
  if (typeof window === "undefined") return "";

  try {
    const raw = window.localStorage.getItem("workzo_promo_code");
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { code?: string };
    return typeof parsed.code === "string" ? parsed.code : "";
  } catch {
    return "";
  }
}

function checkoutPath(plan: WorkZoPlanType, billingCycle: WorkZoBillingCycle) {
  return `/billing/checkout?plan=${plan}&billing=${billingCycle}`;
}

function savePendingCheckout(plan: WorkZoPlanType, billingCycle: WorkZoBillingCycle, promoCode: string, status: string) {
  if (typeof window === "undefined") return;
  const next = checkoutPath(plan, billingCycle);

  try {
    window.localStorage.setItem(
      "workzo_pending_checkout",
      JSON.stringify({
        plan,
        billingCycle,
        source: "pricing",
        next,
        promoCode,
        status,
        createdAt: new Date().toISOString(),
      }),
    );

    document.cookie = `workzo_after_login=${encodeURIComponent(next)}; Max-Age=900; Path=/; SameSite=Lax`;
  } catch {}
}

function PriceLine({ plan, billingCycle }: { plan: WorkZoPlanType | "enterprise"; billingCycle: WorkZoBillingCycle }) {
  if (plan === "enterprise") {
    return (
      <div className="mt-5">
        <p className="text-4xl font-black tracking-[-0.04em] text-fg sm:text-3xl">
          Custom<span className="text-base font-bold text-subtle"> / annual</span>
        </p>
      </div>
    );
  }

  const prices = getWorkZoDisplayPrices(billingCycle);
  const price = plan === "premium_pro" ? prices.premiumPro : prices[plan];
  const suffix = plan === "free" ? "" : billingCycle === "yearly" ? "/year" : "/month";

  return (
    <div className="mt-5">
      {plan !== "free" && price.regular ? (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-sm font-black text-subtle line-through decoration-2">{price.regular}</span>
          <span className="rounded-full border border-success/20 bg-success/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-success">
            Launch offer
          </span>
        </div>
      ) : null}
      <p className="text-4xl font-black tracking-[-0.04em] text-fg sm:text-3xl">
        {price.amount}<span className="text-base font-bold text-subtle">{suffix}</span>
      </p>
      {plan !== "free" && billingCycle === "yearly" ? (
        <p className="mt-2 text-xs font-black text-success">{price.savings}</p>
      ) : null}
    </div>
  );
}

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<WorkZoBillingCycle>("monthly");
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<PromoState>({ code: "", valid: false, message: "", discountLabel: "" });
  const [checkoutLoading, setCheckoutLoading] = useState<WorkZoPlanType | "">("");
  const [checkoutError, setCheckoutError] = useState("");
  const regionalPrices = getWorkZoRegionalPriceSet();

  const normalizedPromo = useMemo(() => promoInput.trim().toUpperCase().replace(/\s+/g, ""), [promoInput]);

  function applyPromo() {
    if (!normalizedPromo) {
      setPromo({ code: "", valid: false, message: "Enter a promo code.", discountLabel: "" });
      return;
    }

    const match = VALID_PROMOS[normalizedPromo];
    if (!match) {
      setPromo({ code: normalizedPromo, valid: false, message: "This promo code is not valid.", discountLabel: "" });
      return;
    }

    setPromo({ code: normalizedPromo, valid: true, message: match.message, discountLabel: match.discountLabel });
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "workzo_promo_code",
        JSON.stringify({ code: normalizedPromo, discountLabel: match.discountLabel, createdAt: new Date().toISOString() }),
      );
    }
  }

  function startFreeInterview() {
    disableWorkZoFounderTestMode();
    setWorkZoCurrentPlan("free");
    resetWorkZoTestingUsage();
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "workzo_selected_plan_intent",
        JSON.stringify({ plan: "free", source: "pricing", next: "/onboarding", createdAt: new Date().toISOString() }),
      );
      document.cookie = `workzo_after_login=${encodeURIComponent("/onboarding")}; Max-Age=900; Path=/; SameSite=Lax`;
      window.location.href = "/onboarding";
    }
  }

  async function choosePlan(plan: WorkZoPlanType) {
    if (plan === "free") {
      startFreeInterview();
      return;
    }

    if (checkoutLoading) return;
    recordWorkZoUpgradeClick();
    setCheckoutError("");
    setCheckoutLoading(plan);
    const promoCode = readStoredPromo(promo);
    savePendingCheckout(plan, billingCycle, promoCode, "checkout_started");

    try {
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, billingCycle, source: "pricing", promoCode, currency: regionalPrices.currency, countryHint: regionalPrices.countryHint }),
      });

      if (response.status === 401 || response.status === 403) {
        savePendingCheckout(plan, billingCycle, promoCode, "login_required");
        window.location.href = `/login?redirect=${encodeURIComponent(checkoutPath(plan, billingCycle))}&checkout=1&plan=${plan}&billing=${billingCycle}`;
        return;
      }

      const data = (await response.json().catch(() => ({}))) as { url?: string; checkoutUrl?: string; sessionUrl?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not create checkout session.");
      const checkoutUrl = data.url || data.checkoutUrl || data.sessionUrl;
      if (!checkoutUrl) throw new Error("Stripe checkout URL was not returned.");
      window.location.href = checkoutUrl;
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Checkout failed. Please try again.");
      setCheckoutLoading("");
    }
  }

  function requestDemo() {
    const subject = encodeURIComponent("WorkZo AI Enterprise / Education Demo Request");
    const body = encodeURIComponent(
      "Hi WorkZo AI team,\n\nI would like to request a demo for Enterprise / Education pricing.\n\nOrganization name:\nCohort size:\nUse case:\nPreferred demo time:\n\nThank you.",
    );
    window.location.href = `mailto:support@workzoai.com?subject=${subject}&body=${body}`;
  }

  return (
    <main className="min-h-screen bg-canvas px-4 py-8 text-fg sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(59,130,246,0.24),transparent_70%),radial-gradient(ellipse_60%_40%_at_90%_100%,rgba(37,99,235,0.10),transparent_70%)]" />

      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <img src="/workzo_icon.png" alt="WorkZo AI" width={36} height={36} className="rounded-xl" />
            <span className="hidden text-xl font-black sm:block">
              WorkZo <span className="text-brand">AI</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-black text-muted transition hover:text-fg">
              <ArrowLeft className="h-4 w-4" /> Back home
            </Link>
            <AuthNavButton />
          </div>
        </div>

        <section className="mx-auto mt-10 max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-fg/8 px-3 py-1.5 text-xs font-black uppercase tracking-[0.20em] text-muted">
            <Sparkles className="h-3.5 w-3.5" />
            Monthly, yearly, and cohort plans
          </div>
          <h1 className="mt-6 text-4xl font-black leading-[1.02] tracking-tight sm:text-5xl">
            Choose the interview preparation plan that fits your career journey.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted">
            Try one AI interview, practice daily with voice, master face-to-face delivery with video, or train an entire cohort with WorkZo AI.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-bold text-fg/80">
            On every plan, interview questions are generated from your CV and the actual job description, never generic question banks.
          </p>

          <div className="mx-auto mt-8 inline-flex rounded-lg border border-line bg-canvas-soft p-1">
            {(["monthly", "yearly"] as WorkZoBillingCycle[]).map((cycle) => (
              <button
                key={cycle}
                type="button"
                onClick={() => setBillingCycle(cycle)}
                className={cn(
                  "rounded-xl px-5 py-2.5 text-sm font-black capitalize transition",
                  billingCycle === cycle ? "bg-white text-slate-950" : "text-muted hover:text-fg",
                )}
              >
                {cycle === "yearly" ? "Yearly · Save ~37%" : "Monthly"}
              </button>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-8 max-w-3xl rounded-lg border border-line bg-canvas-soft p-5 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
              <Tag className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-black text-fg">Have a promo code?</p>
              <p className="mt-1 text-xs leading-5 text-muted">Enter it here and WorkZo will carry it into checkout.</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  value={promoInput}
                  onChange={(event) => setPromoInput(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && applyPromo()}
                  placeholder="Enter promo code"
                  className="min-h-12 flex-1 rounded-lg border border-line bg-canvas-soft px-4 text-sm font-bold text-fg outline-none placeholder:text-subtle focus:border-brand/50"
                />
                <button type="button" onClick={applyPromo} className="rounded-lg bg-brand px-5 py-3 text-sm font-black text-on-brand transition hover:bg-brand-strong">
                  Apply code
                </button>
              </div>
              {promo.message ? <p className={`mt-3 text-sm font-bold ${promo.valid ? "text-success" : "text-danger"}`}>{promo.message}</p> : null}
            </div>
          </div>
        </section>

        <section className="mt-12 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PRICING_CARDS.map((card) => {
            const isFree = card.id === "free";
            const isPaidPlan = card.id === "premium" || card.id === "premium_pro";
            const isLoading = isPaidPlan && checkoutLoading === card.id;

            return (
              <div
                key={card.id}
                className={cn(
                  "relative flex flex-col rounded-2xl border p-6 transition",
                  card.popular ? "border-brand/70 bg-canvas shadow-xl shadow-brand/10" : "border-line bg-fg/[0.03]",
                  card.enterprise && "border-fg/25 bg-fg/[0.05]",
                )}
              >
                {card.popular ? (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-4 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-on-brand shadow-lg shadow-brand/20">
                    Most Popular
                  </div>
                ) : null}

                <div className="mb-5 flex h-7 items-center justify-between gap-3">
                  {card.badge ? (
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]",
                        card.enterprise ? "border border-fg/20 bg-fg/10 text-fg" : card.popular ? "bg-brand/15 text-brand" : "border border-line bg-fg/5 text-subtle",
                      )}
                    >
                      {card.badge}
                    </span>
                  ) : null}
                  <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", card.enterprise ? "bg-fg/10 text-fg" : "bg-brand/10 text-brand")}>{card.icon}</div>
                </div>

                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-subtle">{card.label}</p>
                <h2 className="mt-1.5 text-xl font-black leading-snug text-fg">{card.title}</h2>
                <PriceLine plan={card.id} billingCycle={billingCycle} />
                <p className="mt-3 text-sm leading-6 text-muted">{card.subtitle}</p>
                {card.priceNote ? <p className="mt-2 text-xs font-black text-success">{card.priceNote}</p> : null}

                <div className="my-5 h-px bg-fg/[0.07]" />

                <div className="flex-1 space-y-2.5">
                  {card.features.map((item) => (
                    <div key={item} className="flex items-start gap-2.5">
                      <CheckCircle2 className={cn("mt-0.5 h-[15px] w-[15px] shrink-0", card.enterprise ? "text-fg/60" : "text-brand")} />
                      <span className="text-sm leading-[1.45] text-fg">{item}</span>
                    </div>
                  ))}

                  {card.muted?.length ? (
                    <div className="mt-4 space-y-2.5 border-t border-line pt-4">
                      {card.muted.map((item) => (
                        <div key={item} className="flex items-start gap-2.5">
                          <div className="mt-[7px] h-[6px] w-[6px] shrink-0 rounded-full bg-fg/15" />
                          <span className="text-sm leading-[1.45] text-subtle">{item}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                {card.enterprise ? (
                  <button
                    type="button"
                    onClick={requestDemo}
                    className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg border-2 border-fg/30 bg-transparent py-3 text-sm font-black text-fg transition hover:border-fg hover:bg-fg/5"
                  >
                    <Building2 className="h-4 w-4" />
                    {card.cta}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => choosePlan(card.id as WorkZoPlanType)}
                    disabled={Boolean(checkoutLoading)}
                    className={cn(
                      "mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60",
                      isFree ? "bg-fg text-canvas hover:bg-brand hover:text-on-brand" : "bg-brand text-on-brand shadow-lg shadow-brand/20 hover:bg-brand-strong",
                    )}
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    {isLoading ? "Connecting…" : card.cta}
                  </button>
                )}
              </div>
            );
          })}
        </section>

        {checkoutError ? (
          <p className="mx-auto mt-6 max-w-3xl rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-center text-sm font-bold text-danger">
            {checkoutError}
          </p>
        ) : null}

        <section className="mx-auto mt-8 flex max-w-4xl flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs font-bold text-muted">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-success" /> Secure payments
          </span>
          <span className="inline-flex items-center gap-2">
            <History className="h-4 w-4 text-success" /> Cancel anytime
          </span>
          <span className="inline-flex items-center gap-2">
            <Tag className="h-4 w-4 text-success" /> No hidden fees
          </span>
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-success" /> GDPR-conscious product design
          </span>
        </section>

        <section className="mt-14 overflow-hidden rounded-lg border border-line bg-fg/[0.03]">
          <div className="border-b border-line p-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-muted">Plan breakdown</p>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">Compare WorkZo AI plans</h2>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[960px]">
              <div className="grid grid-cols-[1.25fr_0.7fr_0.8fr_0.85fr_1fr] border-b border-line bg-fg/[0.04] px-5 py-4 text-xs font-black uppercase tracking-[0.16em] text-muted">
                <p>Feature</p>
                <p>Free</p>
                <p>Premium</p>
                <p>Premium Pro</p>
                <p>Enterprise</p>
              </div>
              {comparisonRows.map((row, index) => (
                <div key={row.label} className={cn("grid grid-cols-[1.25fr_0.7fr_0.8fr_0.85fr_1fr] px-5 py-4 text-sm", index % 2 === 0 ? "bg-fg/[0.025]" : "bg-transparent")}>
                  <p className="font-bold text-fg">{row.label}</p>
                  <p className="text-muted">{row.free}</p>
                  <p className="font-black text-muted">{row.premium}</p>
                  <p className="font-black text-muted">{row.pro}</p>
                  <p className="font-black text-muted">{row.enterprise}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              icon: <Mic className="h-5 w-5" />,
              title: "Try once",
              subtitle: "Free",
              text: "Run one realistic AI interview, see how the recruiter reacts, and get your first scorecard.",
            },
            {
              icon: <BrainCircuit className="h-5 w-5" />,
              title: "Practice every day",
              subtitle: "Premium",
              text: "Prepare with voice interviews, resume optimization, ATS checks, cover letters, and job analysis.",
            },
            {
              icon: <Video className="h-5 w-5" />,
              title: "Master delivery",
              subtitle: "Premium Pro",
              text: "Add video practice (early access), advanced performance analysis, multi-session history, and priority AI.",
            },
            {
              icon: <GraduationCap className="h-5 w-5" />,
              title: "Scale cohorts",
              subtitle: "Enterprise & Education",
              text: "Give every student mock interview access with shared minute pools, custom personas, and dedicated onboarding.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-line bg-fg/[0.03] p-6">
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-brand/10 text-brand">{item.icon}</div>
              <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-muted">{item.subtitle}</p>
              <h3 className="mt-1 text-lg font-black">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{item.text}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
