import { NextResponse } from "next/server";
import { getCurrentWorkZoUserSubscription } from "@/lib/workzoSubscription";
import { getWorkZoPlanLimits } from "@/lib/workzoPlanLimits";

export const dynamic = "force-dynamic";

export async function POST() {
  const subscription = await getCurrentWorkZoUserSubscription();
  const plan = subscription?.plan || "premium";
  const limits = getWorkZoPlanLimits(plan);
  // Wire this to Resend/Loops/Brevo before production email sending.
  // This endpoint exists so checkout success/webhook flows have one place to trigger product email.
  return NextResponse.json({ ok: true, emailQueued: false, plan, subject: `Your ${limits.label} access is active` });
}
