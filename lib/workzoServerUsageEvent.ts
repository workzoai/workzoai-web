/**
 * Server-side usage event writer.
 * ============================================================================
 * lib/workzoUsageTracker.ts is CLIENT-side: it POSTs to /api/db/usage-event.
 * That is unusable from a server route handler, and sign-in happens in a server
 * route (app/auth/callback, app/auth/confirm) — the one moment where we know a
 * session was just established.
 *
 * Before this file existed there was NO sign-in event anywhere in the codebase.
 * `signedInUsers` in the founder dashboard was derived from distinct user_id in
 * workzo_usage_events, and usage events were only written by 8 product actions
 * (cv_uploaded, interview_started, ...). A user who signed in and bounced was
 * invisible, so the "Signed-in users" KPI could never measure sign-ins — it
 * measured "signed-in users who completed a tracked action".
 *
 * Writes to the SAME table as /api/db/usage-event so both feed one funnel.
 * ============================================================================
 */

import { createClient } from "@supabase/supabase-js";

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service role config");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Record a usage event from a server route. Fire-and-forget: never throws,
 * never blocks the caller. Analytics must not be able to break auth.
 */
export async function recordWorkZoServerUsageEvent(input: {
  userId: string | null;
  eventName: string;
  plan?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("workzo_usage_events").insert({
      user_id: input.userId ?? null,
      event_name: input.eventName,
      plan: input.plan || "free",
      metadata: input.metadata || {},
    });
    if (error) {
      console.error("[workzoServerUsageEvent] insert failed", {
        eventName: input.eventName,
        error: error.message,
      });
    }
  } catch (error) {
    console.error("[workzoServerUsageEvent] unexpected error", error);
  }
}

/**
 * Record a sign-in. Called from EVERY path that establishes a session:
 *   - app/auth/callback  (magic link + OAuth — signInWithOtp / signInWithOAuth)
 *   - app/auth/confirm   (email confirmation token_hash)
 *
 * The login page only offers OTP and OAuth, so those two routes are the
 * complete set of choke points. If a password path is ever added, it must call
 * this too or the funnel silently loses the step again.
 *
 * `method` is low-cardinality and carries no PII.
 */
export async function recordWorkZoSignIn(input: {
  userId: string | null;
  plan?: string;
  method: "magic_link" | "oauth" | "email_confirm";
}): Promise<void> {
  await recordWorkZoServerUsageEvent({
    userId: input.userId,
    eventName: "sign_in",
    plan: input.plan,
    metadata: { method: input.method },
  });
}
