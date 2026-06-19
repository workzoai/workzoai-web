import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkZoUserSubscription } from "@/lib/workzoSubscription";
import { normalizeWorkZoPlan } from "@/lib/workzoPlanLimits";

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
  const match = cookieHeader.match(/(?:^|;\\s*)workzo_after_login=([^;]+)/);

  if (!match?.[1]) return null;

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const redirectParam = requestUrl.searchParams.get("next") || requestUrl.searchParams.get("redirect");
  const cookieRedirect = readAfterLoginCookie(request);

  const redirectPath = sanitizeRedirect(redirectParam || cookieRedirect || "/onboarding");
  const loginErrorUrl = new URL("/login?error=auth_callback_failed", requestUrl.origin);

  if (error || !code) {
    return NextResponse.redirect(loginErrorUrl);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error("Supabase auth callback exchange failed:", exchangeError.message);
      return NextResponse.redirect(loginErrorUrl);
    }

    const destination = new URL(redirectPath, requestUrl.origin);
    const response = NextResponse.redirect(destination);

    const subscription = await getCurrentWorkZoUserSubscription();
    const resolvedPlan = subscription?.status === "premium" ? normalizeWorkZoPlan(subscription.plan_tier || subscription.plan) : "free";
    response.cookies.set("workzo_plan", resolvedPlan, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
    response.cookies.set("workzo_plan_type", resolvedPlan, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });

    response.cookies.set("workzo_after_login", "", {
      path: "/",
      maxAge: 0,
      sameSite: "lax",
    });

    return response;
  } catch (callbackError) {
    console.error("WorkZo auth callback failed:", callbackError);
    return NextResponse.redirect(loginErrorUrl);
  }
}
