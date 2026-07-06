import { NextResponse } from "next/server";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Usage events are fire-and-forget, we always return 200 so the client
// never blocks on this. Errors are logged but never surfaced to the user.
//
// TABLE REQUIRED (run once in Supabase SQL editor):
//
//   create table if not exists workzo_usage_events (
//     id            uuid primary key default gen_random_uuid(),
//     user_id       uuid references auth.users(id) on delete cascade,
//     event_name    text not null,
//     plan          text not null default 'free',
//     metadata      jsonb default '{}'::jsonb,
//     created_at    timestamptz not null default now()
//   );
//
//   create index if not exists workzo_usage_events_user_id_idx
//     on workzo_usage_events (user_id, created_at desc);
//
//   create index if not exists workzo_usage_events_event_name_idx
//     on workzo_usage_events (event_name, created_at desc);
//
// ROW LEVEL SECURITY: Enable RLS and add a service-role bypass policy.
// The route uses the service role key so it can write regardless of the
// calling user's session state.

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service role config");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function sanitizeEventName(value: unknown): string {
  const raw = String(value || "unknown_event")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);
  return raw || "unknown_event";
}

function sanitizeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    // Drop any keys that could carry PII
    const keyLower = k.toLowerCase();
    if (
      keyLower.includes("email") ||
      keyLower.includes("phone") ||
      keyLower.includes("password") ||
      keyLower.includes("token") ||
      keyLower.includes("secret") ||
      keyLower.includes("key")
    ) continue;
    out[k] = v;
  }
  return out;
}

export async function POST(request: Request) {
  // Always return 200, this route must never block the caller
  try {
    const body = await request.json().catch(() => ({}));

    const eventName = sanitizeEventName(body.eventName || body.event);
    const metadata = sanitizeMetadata(body.metadata || {});

    // Resolve the real server plan, fall back gracefully if unavailable
    let userId: string | null = null;
    let plan = "free";
    try {
      const resolved = await resolveWorkZoServerPlan();
      userId = resolved.userId ?? null;
      plan = resolved.plan;
    } catch {
      // Non-blocking, proceed without user context
    }

    // Attach client-reported plan as a cross-check (stored in metadata, not trusted for gating)
    const clientReportedPlan = String(body.plan || "free");
    const enrichedMetadata = {
      ...metadata,
      clientReportedPlan,
      ...(plan !== clientReportedPlan ? { planMismatch: true } : {}),
    };

    // Dev logging
    if (process.env.NODE_ENV !== "production") {
      console.log("workzo_usage_event", {
        eventName,
        userId,
        plan,
        metadata: enrichedMetadata,
        createdAt: new Date().toISOString(),
      });
    }

    // Skip anonymous events for some high-volume event types to keep the table lean
    const skipIfAnon = new Set([
      "page_view",
      "setup_cleared",
      "product_hunt_asset_viewed",
    ]);
    if (!userId && skipIfAnon.has(eventName)) {
      return NextResponse.json({ ok: true, skipped: "anon" });
    }

    // Persist to Supabase
    try {
      const supabase = createServiceClient();
      const { error } = await supabase.from("workzo_usage_events").insert({
        user_id: userId ?? null,
        event_name: eventName,
        plan,
        metadata: enrichedMetadata,
      });

      if (error) {
        // Log but don't surface, table may not exist yet in dev
        console.error("workzo_usage_event_insert_error", {
          eventName,
          error: error.message,
          hint: error.hint || "",
        });
      }
    } catch (dbError) {
      console.error("workzo_usage_event_db_error", dbError);
    }

    return NextResponse.json({ ok: true });
  } catch {
    // Outer catch, always return ok so the client never retries
    return NextResponse.json({ ok: true });
  }
}
