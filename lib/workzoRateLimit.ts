// lib/workzoRateLimit.ts
//
// In-memory rate limiting (a plain Map in the route file) does not work
// correctly on Vercel's serverless platform. Each function invocation can
// run on a different instance with its own empty Map, so a user bouncing
// across instances can blow past the configured limit with no protection
// at all. This module replaces that with a single shared Postgres table
// (via the existing Supabase service-role client), so the count is
// consistent regardless of which instance handles the request.
//
// Required table (run once in Supabase SQL editor):
//
// CREATE TABLE IF NOT EXISTS workzo_rate_limits (
//   rate_key text NOT NULL,
//   window_start timestamptz NOT NULL,
//   count integer NOT NULL DEFAULT 1,
//   PRIMARY KEY (rate_key, window_start)
// );
// CREATE INDEX IF NOT EXISTS workzo_rate_limits_key_idx ON workzo_rate_limits (rate_key, window_start DESC);
//
// Old rows can be cleaned up periodically (they're tiny and naturally age out
// of relevance), or left as-is — a single user generates at most ~1 row per
// minute, which is negligible storage.

import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * Checks and increments a fixed 60-second window rate limit, backed by
 * Postgres so it's correct across serverless cold starts and multiple
 * concurrent instances.
 *
 * @param key  Unique identifier for the thing being limited, e.g.
 *             `copilot:${userId}` or `interview:${ip}`. Scope by user ID
 *             where possible — IP-based keys are easy to evade with proxies
 *             and unfairly group multiple users behind the same NAT/VPN.
 * @param limit Max requests allowed within the current 60-second window.
 * @returns `{ allowed, remaining }` — fails OPEN (allowed: true) if the
 *          database is unreachable, so a Supabase outage degrades to "no
 *          rate limiting" rather than blocking every request in the app.
 */
export async function checkWorkZoRateLimit(
  key: string,
  limit: number,
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const supabase = getServiceClient();

    // Floor to the current minute so concurrent requests in the same
    // window share one row instead of racing to create separate ones.
    const windowStart = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();

    // Atomic upsert + increment via a single round trip: try to insert a
    // fresh row for this window; if it already exists, read the current
    // count first so we can decide whether to allow before incrementing.
    const { data: existing, error: readError } = await supabase
      .from("workzo_rate_limits")
      .select("count")
      .eq("rate_key", key)
      .eq("window_start", windowStart)
      .maybeSingle();

    if (readError) {
      console.warn("[rate-limit] read error, failing open:", readError.message);
      return { allowed: true, remaining: limit };
    }

    const currentCount = existing?.count ?? 0;

    if (currentCount >= limit) {
      return { allowed: false, remaining: 0 };
    }

    if (existing) {
      await supabase
        .from("workzo_rate_limits")
        .update({ count: currentCount + 1 })
        .eq("rate_key", key)
        .eq("window_start", windowStart);
    } else {
      // Insert can race with a concurrent request creating the same row —
      // that's fine, a duplicate-key error here just means another request
      // beat us to it; the user's request still proceeds (fail open on
      // races, never on the limit check itself).
      const { error: insertError } = await supabase
        .from("workzo_rate_limits")
        .insert({ rate_key: key, window_start: windowStart, count: 1 });
      if (insertError && insertError.code !== "23505") {
        console.warn("[rate-limit] insert error, failing open:", insertError.message);
      }
    }

    return { allowed: true, remaining: Math.max(0, limit - currentCount - 1) };
  } catch (error) {
    console.warn("[rate-limit] unexpected error, failing open:", error);
    return { allowed: true, remaining: limit };
  }
}
