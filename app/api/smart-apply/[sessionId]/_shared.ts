/*
 * app/api/smart-apply/[sessionId]/_shared.ts
 *
 * Every Smart Apply sub-route (cv, cover-letter, interview, linkedin, read, patch)
 * begins the same way: authenticate, gate on plan, load the session, confirm it
 * belongs to the caller. This is that preamble in one place, so a new sub-route
 * cannot forget the ownership check.
 */

import { NextResponse } from "next/server";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { canUseWorkZoFeature, getWorkZoFeatureRequiredPlan, type WorkZoFeatureKey } from "@/lib/workzoPlanLimits";
import { getSession } from "@/lib/smart-apply/persistence";
import type { SmartApplySession } from "@/lib/smart-apply/types";

export type SmartApplyContext =
  | { ok: true; userId: string; plan: string; session: SmartApplySession }
  | { ok: false; response: NextResponse };

export async function loadSmartApplyContext(
  sessionId: string,
  feature: WorkZoFeatureKey,
): Promise<SmartApplyContext> {
  const account = await resolveWorkZoServerPlan();
  if (!account.authenticated || !account.userId) {
    return { ok: false, response: NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 }) };
  }

  if (!canUseWorkZoFeature(account.plan, feature)) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Upgrade required.", requiredPlan: getWorkZoFeatureRequiredPlan(feature), plan: account.plan },
        { status: 403 },
      ),
    };
  }

  if (!sessionId) {
    return { ok: false, response: NextResponse.json({ ok: false, error: "Missing session id." }, { status: 400 }) };
  }

  const session = await getSession(account.userId, sessionId);
  if (!session) {
    // Covers both "does not exist" and "belongs to another user". We deliberately do
    // not distinguish the two: a 404 for someone else's session leaks its existence.
    return { ok: false, response: NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 }) };
  }

  return { ok: true, userId: account.userId, plan: account.plan, session };
}
