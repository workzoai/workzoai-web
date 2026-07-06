import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWorkZoTransactionalEmail } from "@/lib/workzoEmail";

export const runtime = "nodejs";

/**
 * POST /api/leads
 * Stores a B2B enquiry (enterprise / education pages) and notifies the
 * founder by email. Public endpoint by design (lead forms are pre-auth),
 * hardened with: field length caps, a per-IP in-memory rate limit, and a
 * honeypot-tolerant validator. Failure to send the notification email never
 * fails the request — the lead row is the source of truth.
 */

const ipHits = new Map<string, { count: number; windowStart: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    ipHits.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

function clean(value: unknown, max: number): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    if (rateLimited(ip)) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const lead = {
      name: clean(body.name, 120),
      email: clean(body.email, 200),
      organization: clean(body.organization, 200),
      org_type: clean(body.orgType, 80),
      cohort_size: clean(body.cohortSize, 40),
      message: clean(body.message, 2000),
      source: clean(body.source, 60) || "unknown",
    };

    if (!lead.email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lead.email) || !lead.organization) {
      return NextResponse.json({ error: "A valid email and organization are required." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceRoleKey) {
      const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error } = await supabase.from("b2b_leads").insert(lead);
      if (error) console.error("[api/leads] insert failed:", error.message);
    } else {
      console.error("[api/leads] Supabase env missing; lead only emailed.");
    }

    // Notify the founder. Never fails the request.
    const summary = [
      `Source: ${lead.source}`,
      `Name: ${lead.name || "—"}`,
      `Email: ${lead.email}`,
      `Organization: ${lead.organization}`,
      `Type: ${lead.org_type || "—"}`,
      `Cohort size: ${lead.cohort_size || "—"}`,
      lead.message ? `Message: ${lead.message}` : "",
    ].filter(Boolean).join("\n");

    await sendWorkZoTransactionalEmail({
      to: process.env.WORKZO_LEADS_EMAIL || "support@workzoai.com",
      subject: `New B2B lead: ${lead.organization} (${lead.org_type || lead.source})`,
      text: summary,
      html: `<pre style="font-family:inherit;white-space:pre-wrap">${summary
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>`,
    }).catch((error) => console.error("[api/leads] notify failed:", error));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/leads] unexpected error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
