import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Partner trial engine.
 *
 * A founder creates an OFFER (redeem code) scoped to one email or a whole
 * domain. A signed-in partner redeems it, and each user gets their own
 * GRANT of 7 interviews / 14 days / Premium Pro.
 *
 * All entitlement checks are fail-safe: any error returns "no active
 * trial" so the caller falls back to the user's normal plan. Nothing
 * here ever downgrades a paying subscriber.
 */

export const PARTNER_TRIALS_TABLE = "workzo_partner_trials";
export const PARTNER_TRIAL_GRANTS_TABLE = "workzo_partner_trial_grants";

export type PartnerTrialScope = "email" | "domain";

export type PartnerTrialOffer = {
  id: string;
  code: string;
  scope: PartnerTrialScope;
  target: string;
  plan: string;
  interviews_limit: number;
  duration_days: number;
  label: string | null;
  is_active: boolean;
  redeemed_count: number;
  created_at: string;
};

export type ActiveTrialGrant = {
  grantId: string;
  trialId: string;
  plan: string;
  interviewsLimit: number;
  interviewsUsed: number;
  expiresAt: string;
};

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function domainOf(email: string | null | undefined): string {
  return String(email || "").toLowerCase().trim().split("@")[1] || "";
}

/** Unambiguous, human-typeable redeem code (no 0/O/1/I). */
function generateCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 10; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${out.slice(0, 5)}-${out.slice(5)}`;
}

/* ── Founder: create + list offers ─────────────────────────────────── */

export async function createPartnerTrialOffer(input: {
  scope: PartnerTrialScope;
  target: string;
  interviewsLimit?: number;
  durationDays?: number;
  plan?: string;
  label?: string;
  createdBy?: string;
}): Promise<{ ok: true; offer: PartnerTrialOffer } | { ok: false; error: string }> {
  const db = serviceClient();
  if (!db) return { ok: false, error: "not_configured" };

  const scope: PartnerTrialScope = input.scope === "domain" ? "domain" : "email";
  const target = String(input.target || "").toLowerCase().trim();
  if (!target) return { ok: false, error: "target_required" };
  if (scope === "email" && !target.includes("@")) return { ok: false, error: "invalid_email" };
  if (scope === "domain" && (target.includes("@") || !target.includes("."))) return { ok: false, error: "invalid_domain" };

  const payload = {
    code: generateCode(),
    scope,
    target,
    plan: input.plan || "premium_pro",
    interviews_limit: Math.max(1, Math.min(1000, Number(input.interviewsLimit) || 7)),
    duration_days: Math.max(1, Math.min(365, Number(input.durationDays) || 14)),
    label: input.label ? String(input.label).slice(0, 200) : null,
    created_by: input.createdBy || null,
    is_active: true,
  };

  const { data, error } = await db.from(PARTNER_TRIALS_TABLE).insert(payload).select("*").single();
  if (error) {
    console.error("[partnerTrial] create failed", error.message);
    return { ok: false, error: "create_failed" };
  }
  return { ok: true, offer: data as PartnerTrialOffer };
}

export async function listPartnerTrialOffers(): Promise<PartnerTrialOffer[]> {
  const db = serviceClient();
  if (!db) return [];
  const { data } = await db
    .from(PARTNER_TRIALS_TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  return (data || []) as PartnerTrialOffer[];
}

export async function setPartnerTrialActive(code: string, isActive: boolean): Promise<boolean> {
  const db = serviceClient();
  if (!db) return false;
  const { error } = await db
    .from(PARTNER_TRIALS_TABLE)
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("code", code.toUpperCase());
  return !error;
}

/* ── Partner: redeem an offer for the current user ─────────────────── */

export async function redeemPartnerTrial(input: {
  code: string;
  userId: string;
  email: string | null;
}): Promise<
  | { ok: true; alreadyActive: boolean; expiresAt: string; interviewsLimit: number }
  | { ok: false; error: string }
> {
  const db = serviceClient();
  if (!db) return { ok: false, error: "not_configured" };

  const code = String(input.code || "").toUpperCase().trim();
  if (!code) return { ok: false, error: "code_required" };
  if (!input.userId) return { ok: false, error: "not_signed_in" };

  const { data: offer } = await db.from(PARTNER_TRIALS_TABLE).select("*").eq("code", code).maybeSingle();
  if (!offer) return { ok: false, error: "invalid_code" };
  if (!offer.is_active) return { ok: false, error: "offer_inactive" };

  // Scope check: the redeeming user must match the offer target.
  const email = String(input.email || "").toLowerCase().trim();
  if (offer.scope === "email" && email !== String(offer.target).toLowerCase()) {
    return { ok: false, error: "email_mismatch" };
  }
  if (offer.scope === "domain" && domainOf(email) !== String(offer.target).toLowerCase()) {
    return { ok: false, error: "domain_mismatch" };
  }

  // Already granted? Return the existing grant (idempotent, does not reset).
  const { data: existing } = await db
    .from(PARTNER_TRIAL_GRANTS_TABLE)
    .select("*")
    .eq("trial_id", offer.id)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (existing) {
    return { ok: true, alreadyActive: true, expiresAt: existing.expires_at, interviewsLimit: existing.interviews_limit };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + offer.duration_days * 24 * 60 * 60 * 1000).toISOString();

  const { error: gErr } = await db.from(PARTNER_TRIAL_GRANTS_TABLE).insert({
    trial_id: offer.id,
    user_id: input.userId,
    email: email || null,
    plan: offer.plan,
    interviews_limit: offer.interviews_limit,
    interviews_used: 0,
    activated_at: now.toISOString(),
    expires_at: expiresAt,
  });
  if (gErr) {
    console.error("[partnerTrial] grant insert failed", gErr.message);
    return { ok: false, error: "grant_failed" };
  }

  await db
    .from(PARTNER_TRIALS_TABLE)
    .update({ redeemed_count: (offer.redeemed_count || 0) + 1, updated_at: now.toISOString() })
    .eq("id", offer.id);

  return { ok: true, alreadyActive: false, expiresAt, interviewsLimit: offer.interviews_limit };
}

/* ── Entitlement: is there an active trial grant for this user? ────── */

/**
 * Returns the active grant for a user, or null. Active means: not expired
 * and interviews_used < interviews_limit.
 *
 * For domain offers, a user who never explicitly redeemed but whose domain
 * matches an active, already-redeemed domain offer is auto-granted on first
 * call (so every student at a partner school is covered, each with their own
 * 7 interviews / 14 days starting from first use).
 *
 * Fail-safe: returns null on any error.
 */
export async function getActivePartnerTrialGrant(userId: string, email: string | null): Promise<ActiveTrialGrant | null> {
  try {
    const db = serviceClient();
    if (!db || !userId) return null;
    const nowIso = new Date().toISOString();

    // 1. Existing grant for this user.
    const { data: grant } = await db
      .from(PARTNER_TRIAL_GRANTS_TABLE)
      .select("*")
      .eq("user_id", userId)
      .gt("expires_at", nowIso)
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (grant && grant.interviews_used < grant.interviews_limit) {
      return {
        grantId: grant.id,
        trialId: grant.trial_id,
        plan: grant.plan,
        interviewsLimit: grant.interviews_limit,
        interviewsUsed: grant.interviews_used,
        expiresAt: grant.expires_at,
      };
    }
    if (grant) return null; // grant exists but exhausted; do not auto-create another

    // 2. Domain auto-activation: an active domain offer that a partner has
    //    already redeemed covers everyone at that domain.
    const domain = domainOf(email);
    if (!domain) return null;

    const { data: offer } = await db
      .from(PARTNER_TRIALS_TABLE)
      .select("*")
      .eq("scope", "domain")
      .eq("target", domain)
      .eq("is_active", true)
      .gt("redeemed_count", 0)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!offer) return null;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + offer.duration_days * 24 * 60 * 60 * 1000).toISOString();
    const { data: created, error } = await db
      .from(PARTNER_TRIAL_GRANTS_TABLE)
      .insert({
        trial_id: offer.id,
        user_id: userId,
        email: (email || "").toLowerCase() || null,
        plan: offer.plan,
        interviews_limit: offer.interviews_limit,
        interviews_used: 0,
        activated_at: now.toISOString(),
        expires_at: expiresAt,
      })
      .select("*")
      .single();
    if (error || !created) return null;

    return {
      grantId: created.id,
      trialId: created.trial_id,
      plan: created.plan,
      interviewsLimit: created.interviews_limit,
      interviewsUsed: created.interviews_used,
      expiresAt: created.expires_at,
    };
  } catch (err) {
    console.warn("[partnerTrial] getActivePartnerTrialGrant failed", err);
    return null;
  }
}

/** Increment a user's trial interview usage (called server-side on result save). */
export async function incrementPartnerTrialUsage(userId: string): Promise<void> {
  try {
    const db = serviceClient();
    if (!db || !userId) return;
    const nowIso = new Date().toISOString();
    const { data: grant } = await db
      .from(PARTNER_TRIAL_GRANTS_TABLE)
      .select("id,interviews_used,interviews_limit,expires_at")
      .eq("user_id", userId)
      .gt("expires_at", nowIso)
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!grant || grant.interviews_used >= grant.interviews_limit) return;
    await db
      .from(PARTNER_TRIAL_GRANTS_TABLE)
      .update({ interviews_used: grant.interviews_used + 1 })
      .eq("id", grant.id);
  } catch (err) {
    console.warn("[partnerTrial] incrementPartnerTrialUsage failed", err);
  }
}
