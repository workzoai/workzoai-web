/**
 * lib/scoring/orgScoringAuth.ts
 *
 * Shared authorization for the Shadow Recruiter scoring admin routes.
 * Mirrors the cohort dashboard access model so existing B2B links keep
 * working:
 *
 *   Founder access:   ?secret=FOUNDER_ANALYTICS_SECRET (full access)
 *   Org admin access: ?org=<slug>&key=<hmac issued via /api/admin/cohort?issueKey=1>
 *
 * Role granularity from the spec (Hiring Lead, Coach view-only) needs
 * a real membership table and is deferred. Today: founder and org key
 * holders can edit, everyone else is rejected. An org key can never
 * touch another organization because the key is derived from the slug.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";

export type OrgScoringAuth =
  | { ok: true; db: SupabaseClient; orgSlug: string; orgId: string; isFounder: boolean }
  | { ok: false; status: number; error: string };

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Derive an organization's access key.
 *
 * FAILS CLOSED. This used to fall back to `|| ""`, which meant that if
 * FOUNDER_ANALYTICS_SECRET was ever missing on a deploy, every org key became an
 * HMAC keyed on the EMPTY STRING: deterministic, and reproducible offline by
 * anyone who knows the scheme. Combined with ensureOrganization() auto-creating
 * orgs on demand, an attacker could mint a valid key for any slug and read or
 * write another company's scoring profiles.
 *
 * A missing secret is a broken deploy, not a permissive one.
 */
export function orgKey(org: string): string {
  const secret = process.env.FOUNDER_ANALYTICS_SECRET || "";
  if (!secret) throw new Error("FOUNDER_ANALYTICS_SECRET is not set: refusing to derive an org key");
  return createHmac("sha256", secret).update(`org:${org.toLowerCase().trim()}`).digest("hex").slice(0, 32);
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a || "");
  const bb = Buffer.from(b || "");
  if (ab.length !== bb.length) return false;
  try {
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

/**
 * Candidate-side resolution: given a signed-in user's email, find the
 * organization they belong to (by email domain) and that org's active
 * scoring profile + active version.
 *
 * This is intentionally read-only and does NOT create an org: a
 * candidate should only ever have a rubric applied if an admin already
 * set one up for their domain. Returns null for the common consumer
 * case (no org, or org with no active profile), so the interview runs
 * on WorkZo defaults with zero added overhead.
 */
export async function resolveActiveScoringForUser(
  db: SupabaseClient,
  email: string | null | undefined,
): Promise<{
  organizationId: string;
  orgSlug: string;
  profile: Record<string, any>;
  version: Record<string, any> | null;
} | null> {
  const domain = String(email || "").toLowerCase().trim().split("@")[1] || "";
  if (!domain) return null;

  /* Org count is small in practice, so load and match in memory.
     An org slug may be the full domain (sap.com) or a subdomain root
     (sap), mirroring the cohort dashboard's matching rules. */
  const { data: orgs } = await db.from("scoring_organizations").select("id,slug").limit(2000);
  const match = (orgs || []).find((o: any) => {
    const slug = String(o.slug || "").toLowerCase().trim();
    if (!slug) return false;
    return domain === slug || domain.endsWith(`.${slug}`) || domain === `${slug}.com`;
  });
  if (!match) return null;

  const { data: profile } = await db
    .from("organization_scoring_profiles")
    .select("*")
    .eq("organization_id", match.id)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!profile) return null;

  const { data: version } = await db
    .from("scoring_profile_versions")
    .select("*")
    .eq("scoring_profile_id", profile.id)
    .eq("is_active", true)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  return { organizationId: String(match.id), orgSlug: String(match.slug), profile, version: version || null };
}

/** Resolve or create the scoring_organizations row for a slug. This is
 *  the feature's own org registry and is independent of any pre-existing
 *  organizations table in the database. */
export async function ensureOrganization(db: SupabaseClient, slug: string): Promise<string | null> {
  const clean = slug.toLowerCase().trim();
  if (!clean) return null;

  const { data: existing } = await db
    .from("scoring_organizations")
    .select("id")
    .eq("slug", clean)
    .maybeSingle();
  if (existing?.id) return String(existing.id);

  const { data: created, error } = await db
    .from("scoring_organizations")
    .insert({ slug: clean, name: clean })
    .select("id")
    .single();
  if (error) {
    /* Lost a race with a concurrent insert: read again. */
    const { data: retry } = await db.from("scoring_organizations").select("id").eq("slug", clean).maybeSingle();
    return retry?.id ? String(retry.id) : null;
  }
  return created?.id ? String(created.id) : null;
}

/**
 * Authorize a scoring admin request. Reads credentials from query
 * params first, then headers (x-workzo-org, x-workzo-key,
 * x-workzo-secret) so POST bodies never need to carry secrets.
 */
export async function authorizeOrgScoring(request: Request): Promise<OrgScoringAuth> {
  const url = new URL(request.url);
  const org = (url.searchParams.get("org") || request.headers.get("x-workzo-org") || "").toLowerCase().trim();
  const key = url.searchParams.get("key") || request.headers.get("x-workzo-key") || "";
  const secret = url.searchParams.get("secret") || request.headers.get("x-workzo-secret") || "";

  const founderSecret = process.env.FOUNDER_ANALYTICS_SECRET || "";

  /* No secret configured means NOBODY is authorized, not everybody. Checked up
     front so orgKey() below can never be reached with an empty HMAC key. */
  if (!founderSecret) {
    console.error("[orgScoringAuth] FOUNDER_ANALYTICS_SECRET is not set, denying all scoring admin access");
    return { ok: false, status: 500, error: "not_configured" };
  }

  const isFounder = safeEqual(secret, founderSecret);

  if (!org) return { ok: false, status: 400, error: "missing_org" };

  const authorized = isFounder || (key.length > 0 && safeEqual(key, orgKey(org)));
  if (!authorized) return { ok: false, status: 401, error: "unauthorized" };

  const db = serviceClient();
  /* Was status 200, so a client checking `res.ok` treated a hard config failure
     as a success and rendered an empty dashboard instead of an error. */
  if (!db) return { ok: false, status: 500, error: "not_configured" };

  const orgId = await ensureOrganization(db, org);
  if (!orgId) return { ok: false, status: 500, error: "organization_resolve_failed" };

  return { ok: true, db, orgSlug: org, orgId, isFounder };
}
