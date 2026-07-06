import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Partner / organization cohort analytics.
 *
 * Aggregates real interview_sessions data for one organization so a partner
 * (bootcamp, university, academy) admin can track their learners' readiness,
 * engagement, and who needs coaching.
 *
 * ── How an organization is defined ────────────────────────────────────────
 * There is no org table yet, so an org is identified two ways (either works):
 *   • by email domain  → ?org=students.myuni.edu   (learners with that domain)
 *   • by org code      → ?code=SPRING26  (needs an `org_code` column on
 *                        interview_sessions; see migration note at the bottom)
 *
 * ── Access control ────────────────────────────────────────────────────────
 *   • Founder master:  ?secret=FOUNDER_ANALYTICS_SECRET  → can view any org
 *   • Per-partner key: ?org=...&key=<orgKey>             → unlocks ONLY that org
 * The per-org key is a stable HMAC of the org id, so you can hand each partner
 * a link that reveals their cohort and nothing else, without building auth yet.
 * Generate one with GET /api/admin/cohort?org=<id>&secret=<founder>&issueKey=1
 */

type Learner = {
  name: string;
  role: string;
  sessions: number;
  readiness: number;
  trend: number;
  lastActive: string;
  status: "ready" | "improving" | "at-risk";
};

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function orgKey(org: string): string {
  const secret = process.env.FOUNDER_ANALYTICS_SECRET || "";
  return createHmac("sha256", secret).update(`org:${org.toLowerCase().trim()}`).digest("hex").slice(0, 32);
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  try {
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const t = new Date(iso).getTime();
  if (!t) return "never";
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

function statusFor(readiness: number, sessions: number): Learner["status"] {
  if (sessions === 0 || readiness < 50) return "at-risk";
  if (readiness < 75) return "improving";
  return "ready";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const org = (url.searchParams.get("org") || "").toLowerCase().trim();
  const code = (url.searchParams.get("code") || "").trim();
  const key = url.searchParams.get("key") || "";
  const secret = url.searchParams.get("secret") || "";
  const orgId = org || code;

  const founderSecret = process.env.FOUNDER_ANALYTICS_SECRET || "";
  const isFounder = founderSecret.length > 0 && safeEqual(secret, founderSecret);

  // Utility: let the founder mint a partner link.
  if (url.searchParams.get("issueKey") === "1") {
    if (!isFounder) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (!orgId) return NextResponse.json({ error: "provide ?org= or ?code=" }, { status: 400 });
    return NextResponse.json({ org: orgId, key: orgKey(orgId), link: `/admin?org=${encodeURIComponent(orgId)}&key=${orgKey(orgId)}` });
  }

  // Diagnostic: GET /api/admin/cohort?selfTest=1&secret=<founder>
  // Confirms env, DB connectivity, the org_code column, and shows the email
  // domains present so you can pick real ?org= values before emailing partners.
  if (url.searchParams.get("selfTest") === "1") {
    if (!isFounder) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const checks: Record<string, unknown> = {
      env_supabase_url: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      env_service_role_key: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      env_founder_secret: Boolean(process.env.FOUNDER_ANALYTICS_SECRET),
    };
    const db = serviceClient();
    if (!db) return NextResponse.json({ ok: false, checks, error: "service client not configured" });
    try {
      const { count, error: cErr } = await db.from("interview_sessions").select("id", { count: "exact", head: true });
      checks.can_query_interview_sessions = !cErr;
      checks.total_sessions = count ?? 0;
      if (cErr) checks.sessions_error = cErr.message;

      const { error: ocErr } = await db.from("interview_sessions").select("org_code").limit(1);
      checks.org_code_column_exists = !ocErr;

      const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const domains = new Map<string, number>();
      for (const u of users?.users || []) {
        const d = (u.email || "").split("@")[1]?.toLowerCase();
        if (d) domains.set(d, (domains.get(d) || 0) + 1);
      }
      checks.total_users_first_page = users?.users?.length ?? 0;
      checks.top_email_domains = [...domains.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([d, n]) => `${d} (${n})`);
      return NextResponse.json({ ok: true, ready: checks.can_query_interview_sessions === true, checks });
    } catch (err) {
      return NextResponse.json({ ok: false, checks, error: err instanceof Error ? err.message : "unknown" });
    }
  }

  if (!orgId) return NextResponse.json({ error: "missing_org" }, { status: 400 });

  const authorized = isFounder || (key.length > 0 && safeEqual(key, orgKey(orgId)));
  if (!authorized) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = serviceClient();
  if (!db) return NextResponse.json({ error: "not_configured", configured: false }, { status: 200 });

  try {
    // 1. Resolve which user_ids belong to this org.
    let userIds: string[] | null = null; // null => filter by org_code column instead
    const idToName = new Map<string, string>();

    if (org) {
      // Email-domain scoping: page through auth users and match the domain.
      const ids: string[] = [];
      for (let page = 1; page <= 20; page++) {
        const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
        if (error || !data?.users?.length) break;
        for (const u of data.users) {
          const email = (u.email || "").toLowerCase();
          if (email.endsWith(`@${org}`) || email.endsWith(`.${org}`)) {
            ids.push(u.id);
            const meta = (u.user_metadata || {}) as Record<string, unknown>;
            const nm = (meta.full_name as string) || (meta.name as string) || email.split("@")[0];
            idToName.set(u.id, nm);
          }
        }
        if (data.users.length < 1000) break;
      }
      userIds = ids;
      if (ids.length === 0) {
        return NextResponse.json({ ok: true, org: orgId, empty: true, learners: [], stats: emptyStats(), engagement: Array(14).fill(0) });
      }
    }

    // 2. Pull this org's interview sessions.
    let q = db
      .from("interview_sessions")
      .select("user_id, candidate_name, target_role, overall_score, created_at")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (userIds) q = q.in("user_id", userIds);
    else if (code) q = q.eq("org_code", code); // requires the optional org_code column

    const { data: rows, error } = await q;
    if (error) {
      // Most likely the org_code column doesn't exist yet.
      return NextResponse.json({ ok: false, error: "query_failed", detail: error.message }, { status: 200 });
    }

    const sessions = rows || [];

    // 3. Aggregate per learner.
    type Agg = { name: string; role: string; scores: { s: number; t: number }[]; last: string | null };
    const byUser = new Map<string, Agg>();
    const now = Date.now();
    for (const r of sessions) {
      const uid = String(r.user_id);
      const name = idToName.get(uid) || (r.candidate_name as string) || "Learner";
      const a = byUser.get(uid) || { name, role: (r.target_role as string) || "—", scores: [], last: null };
      a.name = a.name === "Learner" ? name : a.name;
      if (!a.role || a.role === "—") a.role = (r.target_role as string) || "—";
      const score = Number(r.overall_score);
      if (Number.isFinite(score)) a.scores.push({ s: score, t: new Date(String(r.created_at)).getTime() || now });
      if (!a.last || new Date(String(r.created_at)).getTime() > new Date(a.last).getTime()) a.last = String(r.created_at);
      byUser.set(uid, a);
    }

    const learners: Learner[] = [...byUser.values()].map((a) => {
      const sorted = [...a.scores].sort((x, y) => y.t - x.t);
      const readiness = sorted.length ? Math.round(sorted.reduce((s, x) => s + x.s, 0) / sorted.length) : 0;
      const recent = sorted.slice(0, Math.ceil(sorted.length / 2));
      const older = sorted.slice(Math.ceil(sorted.length / 2));
      const avg = (arr: { s: number }[]) => (arr.length ? arr.reduce((s, x) => s + x.s, 0) / arr.length : 0);
      const trend = older.length && recent.length ? Math.round(avg(recent) - avg(older)) : 0;
      return {
        name: a.name,
        role: a.role,
        sessions: a.scores.length,
        readiness,
        trend,
        lastActive: relativeTime(a.last),
        status: statusFor(readiness, a.scores.length),
      };
    }).sort((x, y) => x.readiness - y.readiness);

    // 4. Engagement: sessions per day, last 14 days.
    const engagement = Array(14).fill(0);
    for (const r of sessions) {
      const ago = Math.floor((now - (new Date(String(r.created_at)).getTime() || now)) / 86400000);
      if (ago >= 0 && ago < 14) engagement[13 - ago]++;
    }

    const monthAgo = now - 30 * 86400000;
    const stats = {
      totalLearners: learners.length,
      activeLearners: learners.filter((l) => l.sessions > 0).length,
      avgReadiness: learners.filter((l) => l.sessions > 0).length
        ? Math.round(learners.filter((l) => l.sessions > 0).reduce((s, l) => s + l.readiness, 0) / learners.filter((l) => l.sessions > 0).length)
        : 0,
      sessionsThisMonth: sessions.filter((r) => (new Date(String(r.created_at)).getTime() || 0) >= monthAgo).length,
      atRisk: learners.filter((l) => l.status === "at-risk").length,
    };

    return NextResponse.json({ ok: true, org: orgId, empty: learners.length === 0, learners, stats, engagement });
  } catch (err) {
    return NextResponse.json({ ok: false, error: "server_error", detail: err instanceof Error ? err.message : "unknown" }, { status: 200 });
  }
}

function emptyStats() {
  return { totalLearners: 0, activeLearners: 0, avgReadiness: 0, sessionsThisMonth: 0, atRisk: 0 };
}

/*
  OPTIONAL — to support org codes instead of / in addition to email domains,
  run this once in Supabase, then capture a code at onboarding:

    alter table interview_sessions add column if not exists org_code text;
    create index if not exists interview_sessions_org_code_idx on interview_sessions (org_code);
*/
