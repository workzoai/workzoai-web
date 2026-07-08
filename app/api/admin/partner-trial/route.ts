import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  createPartnerTrialOffer,
  listPartnerTrialOffers,
  setPartnerTrialActive,
  type PartnerTrialScope,
} from "@/lib/workzoPartnerTrial";

/**
 * Founder-only. Create and manage partner trial offers (redeem codes).
 *
 *   GET  ?secret=FOUNDER_ANALYTICS_SECRET            -> list offers
 *   POST ?secret=...  { scope, target, interviewsLimit?, durationDays?, label? }
 *        -> create an offer, returns a redeem link
 *   PATCH ?secret=... { code, isActive }             -> enable / disable
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isFounder(request: Request): boolean {
  const secret = new URL(request.url).searchParams.get("secret") || request.headers.get("x-workzo-secret") || "";
  const expected = process.env.FOUNDER_ANALYTICS_SECRET || "";
  if (!expected) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function redeemLinkFor(request: Request, code: string): string {
  const origin = new URL(request.url).origin;
  return `${origin}/redeem?code=${encodeURIComponent(code)}`;
}

export async function GET(request: Request) {
  if (!isFounder(request)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const offers = await listPartnerTrialOffers();
  return NextResponse.json({
    ok: true,
    offers: offers.map((o) => ({ ...o, redeemLink: redeemLinkFor(request, o.code) })),
  });
}

export async function POST(request: Request) {
  if (!isFounder(request)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const scope: PartnerTrialScope = body.scope === "domain" ? "domain" : "email";

  const result = await createPartnerTrialOffer({
    scope,
    target: String(body.target || ""),
    interviewsLimit: body.interviewsLimit,
    durationDays: body.durationDays,
    label: body.label,
    createdBy: "founder",
  });

  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  return NextResponse.json({
    ok: true,
    offer: result.offer,
    redeemLink: redeemLinkFor(request, result.offer.code),
  });
}

export async function PATCH(request: Request) {
  if (!isFounder(request)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const code = String(body.code || "");
  if (!code) return NextResponse.json({ ok: false, error: "code_required" }, { status: 400 });
  const ok = await setPartnerTrialActive(code, body.isActive !== false);
  return NextResponse.json({ ok });
}
