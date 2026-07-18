/*
 * app/api/extension/token/route.ts
 *
 * POST  mint a short-lived, scoped fill token for the signed-in user.
 *
 * Called from the WorkZo web app (workspace or an extension-pairing screen) where the
 * user already has a real session. The extension receives ONLY this token, never the
 * session cookie. When it expires, the extension asks the web app for a fresh one
 * while the user is signed in.
 */

import { NextResponse } from "next/server";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { canUseWorkZoFeature } from "@/lib/workzoPlanLimits";
import { issueFillToken } from "@/lib/extension/fillToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const account = await resolveWorkZoServerPlan();
  if (!account.authenticated || !account.userId) {
    return NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 });
  }

  // The extension is part of Smart Apply, so it is gated the same way.
  if (!canUseWorkZoFeature(account.plan, "smart_apply")) {
    return NextResponse.json({ ok: false, error: "Upgrade required." }, { status: 403 });
  }

  try {
    const { token, expiresAt } = issueFillToken(account.userId);
    return NextResponse.json({ ok: true, token, expiresAt });
  } catch {
    // Secret not configured. Do not leak which env var; just fail.
    return NextResponse.json({ ok: false, error: "Extension pairing is not available right now." }, { status: 503 });
  }
}
