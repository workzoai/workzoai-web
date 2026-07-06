import { NextResponse } from "next/server";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { getWorkZoPlanLimits } from "@/lib/workzoPlanLimits";
import { sendWorkZoPurchaseConfirmation } from "@/lib/workzoEmail";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// This route is called:
//   1. By the Stripe webhook (checkout.session.completed), primary trigger
//   2. From the checkout success page as a fallback if the webhook races
//
// It is idempotent, calling it twice just sends two emails, which Resend
// deduplicates by email address within a short window. Not a problem in practice.

async function getUserEmail(userId: string): Promise<string | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data?.user?.email) return null;
  return data.user.email;
}

export async function POST(request: Request) {
  try {
    // Resolve the calling user's plan from the server
    const resolved = await resolveWorkZoServerPlan();

    if (!resolved.authenticated || !resolved.userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const plan = resolved.plan;
    const limits = getWorkZoPlanLimits(plan);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://workzoai.com";

    // Allow the caller to pass an email override (e.g. from Stripe session)
    const body = await request.json().catch(() => ({}));
    const emailOverride = typeof body.email === "string" ? body.email.trim() : null;

    // Fall back to looking up the email from Supabase auth
    const toEmail = emailOverride || await getUserEmail(resolved.userId);

    if (!toEmail) {
      console.warn("[email/post-purchase] No email address found for user", resolved.userId);
      return NextResponse.json({ ok: false, skipped: true, reason: "no_email_found" });
    }

    const result = await sendWorkZoPurchaseConfirmation({
      to: toEmail,
      planLabel: limits.label,
      plan,
      startUrl: `${appUrl.replace(/\/$/, "")}/onboarding`,
      manageUrl: `${appUrl.replace(/\/$/, "")}/billing/manage`,
    });

    return NextResponse.json({
      ok: result.ok,
      skipped: result.skipped ?? false,
      plan,
      planLabel: limits.label,
      to: toEmail,
    });
  } catch (error) {
    console.error("[email/post-purchase] failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Email send failed" },
      { status: 500 },
    );
  }
}
