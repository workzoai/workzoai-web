import { NextResponse } from "next/server";
import { recordWorkZoSignIn } from "@/lib/workzoServerUsageEvent";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkZoUserSubscription } from "@/lib/workzoSubscription";
import { normalizeWorkZoPlan } from "@/lib/workzoPlanLimits";

// Magic-link confirmation via token_hash + verifyOtp.
//
// WHY THIS EXISTS: the old /auth/callback flow uses PKCE code exchange, which
// requires the code_verifier cookie stored in the browser that REQUESTED the
// link. Users who request the link on the site and then tap it inside Gmail /
// Outlook open it in a different browser context with no verifier cookie -
// exchangeCodeForSession fails and they see auth_callback_failed.
//
// verifyOtp with token_hash needs no cookie from the requesting browser, so
// the link works no matter where it is opened.
//
// REQUIRES a Supabase email template change (Dashboard → Authentication →
// Email Templates → Magic Link):
//   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/onboarding">Sign in</a>
//
// /auth/callback stays in place unchanged for Google OAuth, which is a
// same-browser redirect and unaffected by this problem.

function sanitizeRedirect(value: string | null) {
  if (!value) return "/onboarding";

  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return "/onboarding";
    return decoded;
  } catch {
    if (!value.startsWith("/") || value.startsWith("//")) return "/onboarding";
    return value;
  }
}

function readAfterLoginCookie(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(/(?:^|;\s*)workzo_after_login=([^;]+)/);

  if (!match?.[1]) return null;

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

const VALID_OTP_TYPES: EmailOtpType[] = ["email", "magiclink", "signup", "invite", "recovery", "email_change"];

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const typeParam = requestUrl.searchParams.get("type") || "email";
  const redirectParam = requestUrl.searchParams.get("next") || requestUrl.searchParams.get("redirect");
  const cookieRedirect = readAfterLoginCookie(request);

  const redirectPath = sanitizeRedirect(redirectParam || cookieRedirect || "/onboarding");
  const loginErrorUrl = new URL("/login?error=auth_link_invalid", requestUrl.origin);

  if (!tokenHash) {
    return NextResponse.redirect(loginErrorUrl);
  }

  const type = (VALID_OTP_TYPES.includes(typeParam as EmailOtpType) ? typeParam : "email") as EmailOtpType;

  try {
    const supabase = await createSupabaseServerClient();
    const { data: verified, error: verifyError } =
      await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

    if (verifyError) {
      // Expired and already-used links land here, give the user a hint that
      // requesting a fresh link will work, instead of a generic failure.
      console.error("[auth/confirm] verifyOtp failed:", verifyError.message);
      const expired = /expired|invalid/i.test(verifyError.message || "");
      return NextResponse.redirect(
        new URL(`/login?error=${expired ? "auth_link_expired" : "auth_link_invalid"}`, requestUrl.origin),
      );
    }

    const destination = new URL(redirectPath, requestUrl.origin);
    const response = NextResponse.redirect(destination);

    const subscription = await getCurrentWorkZoUserSubscription();
    const resolvedPlan = subscription?.status === "premium" ? normalizeWorkZoPlan(subscription.plan_tier || subscription.plan) : "free";
    response.cookies.set("workzo_plan", resolvedPlan, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
    response.cookies.set("workzo_plan_type", resolvedPlan, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });

    // SIGN-IN FUNNEL STEP. Second (and last) path that establishes a session.
    // See the note in app/auth/callback/route.ts.
    await recordWorkZoSignIn({
      userId: verified?.user?.id ?? null,
      plan: resolvedPlan,
      method: "email_confirm",
    });

    response.cookies.set("workzo_after_login", "", {
      path: "/",
      maxAge: 0,
      sameSite: "lax",
    });

    return response;
  } catch (confirmError) {
    console.error("[auth/confirm] failed:", confirmError);
    return NextResponse.redirect(loginErrorUrl);
  }
}
