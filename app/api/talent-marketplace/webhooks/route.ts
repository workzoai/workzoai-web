import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function safeEqual(a = "", b = "") {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  if (aa.length !== bb.length) return false;
  try { return timingSafeEqual(aa, bb); } catch { return false; }
}

function validSignature(rawBody: string, signature: string) {
  const secret = process.env.TALENT_MARKETPLACE_WEBHOOK_SECRET || process.env.FOUNDER_ANALYTICS_SECRET || "";
  if (!secret) return true;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqual(signature.replace(/^sha256=/, ""), expected);
}

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-workzo-signature") || "";
  if (!validSignature(raw, signature)) return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
  const body = JSON.parse(raw || "{}");
  const client = db();
  if (!client) return NextResponse.json({ ok: false, error: "supabase_not_configured" }, { status: 200 });
  const organizationId = String(body.organizationId || body.organization_id || "demo").toLowerCase();
  const eventType = String(body.type || body.event || "external_event");
  const entityId = String(body.entityId || body.entity_id || body.id || "");
  const { error } = await client.from("marketplace_activity_log").insert({
    organization_id: organizationId,
    actor_type: "webhook",
    action: eventType,
    entity_type: String(body.entityType || body.entity_type || "external"),
    entity_id: entityId || null,
    metadata: body,
  });
  return NextResponse.json({ ok: !error, error: error?.message });
}
