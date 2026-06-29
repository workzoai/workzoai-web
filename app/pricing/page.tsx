"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Crown,
  FileText,
  Gift,
  History,
  Loader2,
  MessageSquare,
  Mic,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  TrendingUp,
  Video,
  XCircle,
  Zap,
} from "lucide-react";
import AuthNavButton from "@/components/auth/AuthNavButton";
import {
  WORKZO_PLAN_LIMITS,
  WORKZO_PLAN_ORDER,
  normalizeWorkZoBillingCycle,
  type WorkZoBillingCycle,
  type WorkZoPlanType,
} from "@/lib/workzoPlanLimits";
import { getWorkZoDisplayPrices } from "@/lib/workzoLocalizedPricing";
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

type PlanCard = {
  id: WorkZoPlanType;
  icon: ReactNode;
  accent: string;
  buttonClass: string;
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

const PLAN_CARDS: PlanCard[] = [
  {
    id: "free",
    icon: <Rocket className="h-5 w-5" />,
    accent: "emerald",
    buttonClass: "bg-fg text-canvas hover:bg-brand hover:text-on-brand",
  },
  {
    id: "premium",
    icon: <Crown className="h-5 w-5" />,
    accent: "blue",
    buttonClass: "bg-brand text-on-brand hover:bg-brand shadow-lg shadow-brand/20",
  },
  {
    id: "premium_pro",
    icon: <Star className="h-5 w-5" />,
    accent: "violet",
    buttonClass: "bg-brand text-on-brand hover:bg-brand shadow-lg shadow-brand/20",
  },
];

const comparisonRows = [
  { label: "Voice AI Interviews", free: "2 / mo", premium: "50 / mo", premiumPro: "Unlimited", section: "interview" },
  { label: "Recruiter Intelligence", free: "Full (2 sessions)", premium: "Advanced", premiumPro: "Advanced", section: "interview" },
  { label: "Follow-up Questions", free: "Full (2 sessions)", premium: "Realistic", premiumPro: "Deep + pressure", section: "interview" },
  { label: "Interview Reports", free: "Basic", premium: "Advanced", premiumPro: "Advanced + Replay", section: "interview" },
  { label: "Interview History", free: "Limited", premium: "Unlimited", premiumPro: "Unlimited", section: "interview" },
  { label: "Improve CV", free: "—", premium: "Included", premiumPro: "Included", section: "application" },
  { label: "ATS Optimization", free: "—", premium: "Included", premiumPro: "Included", section: "application" },
  { label: "Cover Letter Generator", free: "—", premium: "Included", premiumPro: "Included", section: "application" },
  { label: "Job Assist", free: "—", premium: "Included", premiumPro: "Included", section: "application" },
  { label: "Career Brain", free: "—", premium: "Included", premiumPro: "Enhanced", section: "application" },
  { label: "Performance Tracking", free: "—", premium: "Included", premiumPro: "Advanced", section: "tracking" },
  { label: "Hiring Readiness", free: "—", premium: "Included", premiumPro: "Included", section: "tracking" },
  { label: "Tavus Live AI Recruiter", free: "—", premium: "—", premiumPro: "Included", section: "pro" },
  { label: "Live AI Recruiter Minutes", free: "—", premium: "—", premiumPro: "60 / mo", section: "pro" },
  { label: "Premium Recruiter Personas", free: "—", premium: "—", premiumPro: "Included", section: "pro" },
  { label: "AI Career Coach", free: "—", premium: "—", premiumPro: "Included", section: "pro" },
  { label: "Career Roadmaps", free: "—", premium: "—", premiumPro: "30 / 60 / 90 day", section: "pro" },
  { label: "Replay Intelligence", free: "—", premium: "—", premiumPro: "Included", section: "pro" },
  { label: "Personalized Coaching Memory", free: "—", premium: "—", premiumPro: "Included", section: "pro" },
  { label: "Interview Probability Forecasting", free: "—", premium: "—", premiumPro: "Included", section: "pro" },
  { label: "Priority AI Models", free: "—", premium: "—", premiumPro: "Included", section: "pro" },
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

function PriceLine({ plan, billingCycle }: { plan: WorkZoPlanType; billingCycle: WorkZoBillingCycle }) {
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
      window.localStorage.setItem("workzo_promo_code", JSON.stringify({ code: normalizedPromo, discountLabel: match.discountLabel, createdAt: new Date().toISOString() }));
    }
  }

  function startFreeInterview() {
    disableWorkZoFounderTestMode();
    setWorkZoCurrentPlan("free");
    resetWorkZoTestingUsage();
    if (typeof window !== "undefined") {
      window.localStorage.setItem("workzo_selected_plan_intent", JSON.stringify({ plan: "free", source: "pricing", next: "/onboarding", createdAt: new Date().toISOString() }));
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
        body: JSON.stringify({ plan, billingCycle, source: "pricing", promoCode }),
      });

      if (response.status === 401 || response.status === 403) {
        savePendingCheckout(plan, billingCycle, promoCode, "login_required");
        window.location.href = `/login?redirect=${encodeURIComponent(checkoutPath(plan, billingCycle))}&checkout=1&plan=${plan}&billing=${billingCycle}`;
        return;
      }

      const data = await response.json().catch(() => ({})) as { url?: string; checkoutUrl?: string; sessionUrl?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not create checkout session.");
      const checkoutUrl = data.url || data.checkoutUrl || data.sessionUrl;
      if (!checkoutUrl) throw new Error("Stripe checkout URL was not returned.");
      window.location.href = checkoutUrl;
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Checkout failed. Please try again.");
      setCheckoutLoading("");
    }
  }

  return (
    <main className="min-h-screen bg-canvas px-4 py-8 text-fg sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(59,130,246,0.24),transparent_70%),radial-gradient(ellipse_60%_40%_at_90%_100%,rgba(37, 99, 235,0.10),transparent_70%)]" />

      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <img src="/workzo_icon.png" alt="WorkZo AI" width={36} height={36} className="rounded-xl" />
            <span className="hidden text-xl font-black sm:block">WorkZo <span className="text-brand">AI</span></span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-black text-muted transition hover:text-fg">
              <ArrowLeft className="h-4 w-4" /> Back home
            </Link>
            <AuthNavButton />
          </div>
        </div>

        <section className="mx-auto mt-10 max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-fg/8 px-3 py-1.5 text-xs font-black uppercase tracking-[0.20em] text-brand">
            <Sparkles className="h-3.5 w-3.5" />
            Monthly and yearly plans
          </div>
          <h1 className="mt-6 text-4xl font-black leading-[1.02] tracking-tight sm:text-4xl">
            Know what the offer costs. Then close the gap.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted">
            Free shows where the gap is. Premium closes it. Premium Pro builds on every session until the offer lands.
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

        <section className="mt-12 grid items-stretch gap-4 lg:grid-cols-3">
          {PLAN_CARDS.map((card) => {
            const plan = WORKZO_PLAN_LIMITS[card.id];
            const isPremium = card.id === "premium";
            const isPro = card.id === "premium_pro";
            const isFree = card.id === "free";
            return (
              <div
                key={card.id}
                className={cn(
                  "flex flex-col rounded-xl border p-6",
                  isPremium ? "border-brand/50 bg-canvas" : "border-line bg-fg/[0.03]",
                )}
              >
                {/* Badge — always takes same height so cards align */}
                <div className="mb-5 h-6">
                  {plan.badge && (
                    <span className={cn(
                      "inline-flex items-center rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-[0.16em]",
                      isFree
                        ? "border border-line bg-fg/5 text-subtle"
                        : isPremium
                          ? "bg-brand/20 text-brand"
                          : "bg-brand/15 text-brand",
                    )}>
                      {plan.badge}
                    </span>
                  )}
                </div>

                {/* Plan identity */}
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-subtle">{plan.label}</p>
                <h2 className="mt-1.5 text-lg font-black leading-snug text-fg">{plan.shortLabel}</h2>

                {/* Price */}
                <PriceLine plan={card.id} billingCycle={billingCycle} />

                {/* Description */}
                <p className="mt-3 text-sm leading-6 text-muted">{plan.description}</p>

                {/* Trial note */}
                {isPremium && (
                  <p className="mt-2 text-xs font-black text-success">
                    24-hour free trial · cancel anytime before charged
                  </p>
                )}
                {isPro && (
                  <p className="mt-2 text-xs font-black text-brand">
                    2 free live recruiter minutes included
                  </p>
                )}

                {/* Divider */}
                <div className="my-5 h-px bg-fg/[0.07]" />

                {/* Included features */}
                <div className="flex-1 space-y-2.5">
                  {plan.included.map((item) => (
                    <div key={item} className="flex items-start gap-2.5">
                      <CheckCircle2 className={cn(
                        "mt-0.5 h-[15px] w-[15px] shrink-0",
                        isPro ? "text-brand" : isPremium ? "text-brand" : "text-success",
                      )} />
                      <span className="text-sm leading-[1.45] text-fg">{item}</span>
                    </div>
                  ))}

                  {/* Not-included — muted, no XCircle */}
                  {plan.notIncluded.length > 0 && (
                    <div className="mt-4 space-y-2.5 border-t border-line pt-4">
                      {plan.notIncluded.map((item) => (
                        <div key={item} className="flex items-start gap-2.5">
                          <div className="mt-[5px] h-[6px] w-[6px] shrink-0 rounded-full bg-fg/15" />
                          <span className="text-sm leading-[1.45] text-subtle">{item}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* CTA — always at bottom */}
                <button
                  type="button"
                  onClick={() => choosePlan(card.id)}
                  disabled={Boolean(checkoutLoading)}
                  className={cn(
                    "mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60",
                    card.buttonClass,
                  )}
                >
                  {checkoutLoading === card.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {isFree ? "Start Free" : checkoutLoading === card.id ? "Connecting…" : `Choose ${plan.label}`}
                </button>
              </div>
            );
          })}
        </section>

        {checkoutError ? (
          <p className="mx-auto mt-6 max-w-3xl rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-center text-sm font-bold text-danger">
            {checkoutError}
          </p>
        ) : null}

        <section className="mx-auto mt-8 flex max-w-3xl flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs font-bold text-muted">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-success" />
            Secure payment via Stripe
          </span>
          <span className="inline-flex items-center gap-2">
            <History className="h-4 w-4 text-success" />
            Cancel anytime, no questions asked
          </span>
          <span className="inline-flex items-center gap-2">
            <Tag className="h-4 w-4 text-success" />
            No hidden fees
          </span>
        </section>

        <section className="mt-14 overflow-hidden rounded-lg border border-line bg-fg/[0.03]">
          <div className="border-b border-line p-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-brand">Plan breakdown</p>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">What each plan actually includes</h2>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[1.35fr_0.75fr_0.85fr_0.95fr] border-b border-line bg-fg/[0.04] px-5 py-4 text-xs font-black uppercase tracking-[0.16em] text-muted">
                <p>Feature</p>
                <p>Free</p>
                <p>Premium</p>
                <p>Premium Pro</p>
              </div>
              {comparisonRows.map((row, index) => (
                <div key={row.label} className={cn("grid grid-cols-[1.35fr_0.75fr_0.85fr_0.95fr] px-5 py-4 text-sm", index % 2 === 0 ? "bg-fg/[0.025]" : "bg-transparent")}>
                  <p className="font-bold text-fg">{row.label}</p>
                  <p className="text-muted">{row.free}</p>
                  <p className="font-black text-brand">{row.premium}</p>
                  <p className="font-black text-brand">{row.premiumPro}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: <Mic className="h-5 w-5" />,
              accent: "emerald",
              title: "Free",
              subtitle: "Try the experience",
              text: "Try 2 voice interviews, see recruiter intelligence in action, and get a basic interview report before committing.",
            },
            {
              icon: <BrainCircuit className="h-5 w-5" />,
              accent: "blue",
              title: "Premium",
              subtitle: "Interview preparation platform",
              text: "Prepare fully for every interview. Improve your CV, generate cover letters, use Career Brain, and track your performance over time.",
            },
            {
              icon: <Sparkles className="h-5 w-5" />,
              accent: "violet",
              title: "Premium Pro",
              subtitle: "Personal AI career coach",
              text: "Go beyond interview prep. Get a Live AI Recruiter, AI Career Coach, career roadmaps, replay intelligence, and a personalized coaching system that grows with you.",
            },
          ].map((item) => (
            <div key={item.title} className={cn(
              "rounded-xl border p-6",
              item.accent === "blue" ? "border-brand/20 bg-brand/[0.05]" :
              item.accent === "violet" ? "border-brand/20 bg-brand/[0.05]" :
              "border-line bg-fg/[0.03]"
            )}>
              <div className={cn(
                "grid h-11 w-11 place-items-center rounded-lg",
                item.accent === "blue" ? "bg-brand/15 text-brand" :
                item.accent === "violet" ? "bg-brand/15 text-brand" :
                "bg-success/15 text-success"
              )}>{item.icon}</div>
              <p className={cn(
                "mt-4 text-[10px] font-black uppercase tracking-[0.18em]",
                item.accent === "blue" ? "text-brand" :
                item.accent === "violet" ? "text-brand" :
                "text-success"
              )}>{item.subtitle}</p>
              <h3 className="mt-1 text-lg font-black">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{item.text}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
