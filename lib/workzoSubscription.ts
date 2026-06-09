import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getWorkZoBillingCycleFromStripePriceId,
  getWorkZoPlanFromStripePriceId,
  normalizeStripeSubscriptionStatus,
} from "@/lib/workzoStripe";
import {
  normalizeWorkZoBillingCycle,
  normalizeWorkZoPlan,
  type WorkZoBillingCycle,
  type WorkZoPlanType,
} from "@/lib/workzoPlanLimits";

export type WorkZoSubscriptionStatus =
  | "free"
  | "premium"
  | "cancelled"
  | "past_due"
  | "expired";

export type WorkZoSubscriptionRecord = {
  id?: string;
  user_id: string;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_price_id?: string | null;
  plan: WorkZoPlanType;
  plan_tier?: WorkZoPlanType | null;
  billing_cycle?: WorkZoBillingCycle | null;
  status: WorkZoSubscriptionStatus;
  current_period_end?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export const WORKZO_SUBSCRIPTIONS_TABLE = "workzo_subscriptions";

function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function isWorkZoPremiumStatus(status?: string | null) {
  return status === "premium";
}

export function isWorkZoPaidPlan(plan?: string | null) {
  const normalized = normalizeWorkZoPlan(plan);
  return normalized === "premium" || normalized === "premium_pro";
}

export async function getCurrentWorkZoUserSubscription(): Promise<WorkZoSubscriptionRecord | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from(WORKZO_SUBSCRIPTIONS_TABLE)
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("workzo_subscription_read_error", error);
    return null;
  }

  return (data || null) as WorkZoSubscriptionRecord | null;
}

export async function getWorkZoUserIdByStripeCustomer(stripeCustomerId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from(WORKZO_SUBSCRIPTIONS_TABLE)
    .select("user_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();

  if (error) {
    console.error("workzo_subscription_customer_lookup_error", error);
    return null;
  }

  return typeof data?.user_id === "string" ? data.user_id : null;
}

export async function upsertWorkZoSubscription(input: {
  userId: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  stripeStatus?: string | null;
  currentPeriodEnd?: number | null;
  plan?: WorkZoPlanType | string | null;
  billingCycle?: WorkZoBillingCycle | string | null;
}) {
  const supabase = createServiceClient();
  const status = normalizeStripeSubscriptionStatus(input.stripeStatus);
  const pricePlan = input.stripePriceId
    ? getWorkZoPlanFromStripePriceId(input.stripePriceId)
    : "free";

  const plan = status === "premium"
    ? normalizeWorkZoPlan(input.plan || pricePlan)
    : "free";

  const billingCycle = normalizeWorkZoBillingCycle(
    input.billingCycle || getWorkZoBillingCycleFromStripePriceId(input.stripePriceId),
  );

  const payload: WorkZoSubscriptionRecord = {
    user_id: input.userId,
    stripe_customer_id: input.stripeCustomerId || null,
    stripe_subscription_id: input.stripeSubscriptionId || null,
    stripe_price_id: input.stripePriceId || null,
    plan,
    plan_tier: plan,
    billing_cycle: billingCycle,
    status,
    current_period_end: input.currentPeriodEnd
      ? new Date(input.currentPeriodEnd * 1000).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(WORKZO_SUBSCRIPTIONS_TABLE)
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) throw error;
  return data as WorkZoSubscriptionRecord;
}

export async function markWorkZoSubscriptionCancelled(input: {
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}) {
  const supabase = createServiceClient();

  let query = supabase.from(WORKZO_SUBSCRIPTIONS_TABLE).update({
    plan: "free",
    plan_tier: "free",
    status: "cancelled",
    updated_at: new Date().toISOString(),
  });

  if (input.stripeSubscriptionId) {
    query = query.eq("stripe_subscription_id", input.stripeSubscriptionId);
  } else if (input.stripeCustomerId) {
    query = query.eq("stripe_customer_id", input.stripeCustomerId);
  } else {
    return null;
  }

  const { data, error } = await query.select("*").maybeSingle();
  if (error) throw error;
  return data as WorkZoSubscriptionRecord | null;
}
