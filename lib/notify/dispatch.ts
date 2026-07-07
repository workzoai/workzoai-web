/**
 * lib/notify/dispatch.ts
 *
 * One outbound event → every channel an organization has configured
 * (Slack, Microsoft Teams, or a generic ATS/HRIS webhook), plus an optional
 * global fallback (WORKZO_ALERT_WEBHOOK). This is the credential-free core of
 * the "Slack/Teams workflows" and "ATS webhook" roadmap items: Slack and Teams
 * incoming webhooks are just an HTTPS POST to a URL the org pastes into the
 * marketplace Integrations panel — no vendor SDK or OAuth required.
 *
 * What this deliberately does NOT do: vendor-specific *pull/push* sync
 * (Greenhouse/Workday candidate objects, HRIS employee records). That still
 * needs per-provider credentials and customer setup. This layer covers every
 * event-driven, push-to-URL integration fully and logs every attempt.
 *
 * Never throws — notification failures must never break the action that
 * triggered them.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

type Channel = "slack" | "teams" | "webhook";

export type NotifyInput = {
  db: SupabaseClient | null;
  organizationId: string;
  event: string;
  title: string;
  lines?: string[];
  url?: string | null;
  entityType?: string;
  entityId?: string | null;
};

export type NotifyResult = { attempted: number; sent: number; skipped: boolean };

const TIMEOUT_MS = 6000;

function formatForChannel(channel: Channel, input: NotifyInput): Record<string, unknown> {
  const body = [input.title, ...(input.lines || [])].filter(Boolean).join("\n");
  const withLink = input.url ? `${body}\n${input.url}` : body;
  // Slack and Teams incoming webhooks both accept a simple { text } payload.
  if (channel === "slack" || channel === "teams") return { text: withLink };
  // Generic webhook (ATS/HRIS/custom): structured JSON.
  return {
    event: input.event,
    title: input.title,
    lines: input.lines || [],
    url: input.url || null,
    entityType: input.entityType || null,
    entityId: input.entityId || null,
  };
}

async function postWebhook(
  url: string,
  payload: unknown,
): Promise<{ ok: boolean; code: number | null; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return { ok: res.ok, code: res.status };
  } catch (e) {
    return { ok: false, code: null, error: e instanceof Error ? e.message : "dispatch_failed" };
  } finally {
    clearTimeout(timer);
  }
}

export async function dispatchNotification(input: NotifyInput): Promise<NotifyResult> {
  const { db, organizationId } = input;
  const targets: { channel: Channel; provider: string; url: string }[] = [];

  // Per-org channels configured in the marketplace Integrations panel.
  if (db) {
    try {
      const { data } = await db
        .from("marketplace_integrations")
        .select("provider, status, config")
        .eq("organization_id", organizationId);
      for (const row of data || []) {
        const r = row as { provider?: string; status?: string; config?: Record<string, unknown> };
        const provider = String(r.provider || "").toLowerCase();
        const cfg = r.config || {};
        const url = String(cfg.webhook_url || cfg.url || "");
        if (String(r.status || "") !== "configured") continue;
        if (!/^https:\/\//i.test(url)) continue;
        const channel: Channel = provider === "slack" ? "slack" : provider === "teams" ? "teams" : "webhook";
        targets.push({ channel, provider, url });
      }
    } catch {
      /* integrations table missing or query failed → no per-org targets */
    }
  }

  // Optional global fallback so alerts work before any org configures a channel.
  const globalUrl = process.env.WORKZO_ALERT_WEBHOOK || "";
  if (/^https:\/\//i.test(globalUrl)) targets.push({ channel: "webhook", provider: "global", url: globalUrl });

  if (targets.length === 0) {
    if (db) {
      try {
        await db.from("notification_dispatches").insert({
          organization_id: organizationId,
          event: input.event,
          channel: "webhook",
          provider: "none",
          entity_type: input.entityType ?? null,
          entity_id: input.entityId ?? null,
          status: "skipped",
          payload: {},
        });
      } catch {
        /* ignore log failure */
      }
    }
    return { attempted: 0, sent: 0, skipped: true };
  }

  let sent = 0;
  for (const t of targets) {
    const payload = formatForChannel(t.channel, input);
    const result = await postWebhook(t.url, payload);
    if (result.ok) sent += 1;
    if (db) {
      try {
        await db.from("notification_dispatches").insert({
          organization_id: organizationId,
          event: input.event,
          channel: t.channel,
          provider: t.provider,
          entity_type: input.entityType ?? null,
          entity_id: input.entityId ?? null,
          status: result.ok ? "sent" : "failed",
          response_code: result.code,
          error: result.error || null,
          payload: payload as Record<string, unknown>,
        });
      } catch {
        /* ignore log failure */
      }
    }
  }
  return { attempted: targets.length, sent, skipped: false };
}
