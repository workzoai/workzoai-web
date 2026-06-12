import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkZoUserSubscription, type WorkZoSubscriptionRecord } from "@/lib/workzoSubscription";
import { normalizeWorkZoPlan, type WorkZoPlanType } from "@/lib/workzoPlanLimits";

export type WorkZoResolvedPlan = {
  authenticated: boolean;
  userId: string | null;
  email: string | null;
  plan: WorkZoPlanType;
  billingCycle: string | null;
  status: string;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};

function planFromSubscription(subscription: WorkZoSubscriptionRecord | null): WorkZoPlanType {
  if (!subscription) return "free";
  if (subscription.status !== "premium") return "free";
  return normalizeWorkZoPlan(subscription.plan_tier || subscription.plan || "free");
}

export async function resolveWorkZoServerPlan(): Promise<WorkZoResolvedPlan> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { authenticated: false, userId: null, email: null, plan: "free", billingCycle: null, status: "signed_out", currentPeriodEnd: null, stripeCustomerId: null, stripeSubscriptionId: null };
  }

  const subscription = await getCurrentWorkZoUserSubscription();
  const plan = planFromSubscription(subscription);
  return {
    authenticated: true,
    userId: user.id,
    email: user.email || null,
    plan,
    billingCycle: subscription?.billing_cycle || null,
    status: subscription?.status || "free",
    currentPeriodEnd: subscription?.current_period_end || null,
    stripeCustomerId: subscription?.stripe_customer_id || null,
    stripeSubscriptionId: subscription?.stripe_subscription_id || null,
  };
}
