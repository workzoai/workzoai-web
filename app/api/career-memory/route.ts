/**
 * app/api/career-memory/route.ts
 *
 * Server persistence for the Premium Pro coach's career memory, so the brain
 * survives across devices and browsers instead of living only in localStorage.
 *
 *   GET   → the signed-in user's stored memory (or null)
 *   POST  → upsert the user's memory  { memory: {...} }
 *
 * Scoped to the authenticated user; a signed-out request is a graceful no-op.
 */

import { NextResponse } from "next/server";
import {
  createWorkZoSupabaseServiceClient,
  getWorkZoUserIdFromRequest,
} from "@/lib/workzoSupabaseService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const userId = await getWorkZoUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ ok: false, memory: null }, { status: 200 });
  try {
    const db = createWorkZoSupabaseServiceClient();
    const { data } = await db
      .from("career_memory")
      .select("memory, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data?.memory) return NextResponse.json({ ok: true, memory: null });
    const stored = data.memory as Record<string, unknown>;
    // Ensure updatedAt is present for the client's last-write-wins reconcile.
    const memory = { ...stored, updatedAt: (stored.updatedAt as string) || data.updated_at };
    return NextResponse.json({ ok: true, memory });
  } catch {
    return NextResponse.json({ ok: false, memory: null }, { status: 200 });
  }
}

export async function POST(request: Request) {
  const userId = await getWorkZoUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const memory = body.memory && typeof body.memory === "object" ? body.memory : null;
  if (!memory) return NextResponse.json({ ok: false, error: "no_memory" }, { status: 400 });

  try {
    const db = createWorkZoSupabaseServiceClient();
    const { error } = await db
      .from("career_memory")
      .upsert(
        { user_id: userId, memory, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    return NextResponse.json({ ok: !error, error: error?.message || null });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "server_error" },
      { status: 200 },
    );
  }
}
