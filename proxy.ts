import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// ─── Disabled routes (404 in production) ────────────────────────────────────
const DISABLED_IN_PRODUCTION = [
  "/sentry-example-page",
  "/api/sentry-example-api",
  "/vapi-test",
  "/dev-tools",
];

// ─── Founder-only routes ─────────────────────────────────────────────────────
const FOUNDER_ROUTES = ["/founder", "/founder-dashboard", "/founder/analytics"];

function isDisabledRoute(pathname: string) {
  return DISABLED_IN_PRODUCTION.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`)
  );
}

function isFounderRoute(pathname: string) {
  return FOUNDER_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`)
  );
}

function getFounderAllowlist(): string[] {
  return (process.env.FOUNDER_ALLOWED_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Hard-disable debug routes in production
  if (process.env.NODE_ENV === "production" && isDisabledRoute(pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        // Recreate the response after updating the request's cookies — this
        // is what makes the refreshed Supabase session token actually
        // visible to server-side getUser() calls within the same request
        // cycle. Without recreating the response here, the old broken
        // version only wrote to response.cookies, leaving request.cookies
        // stale, so resolveWorkZoServerPlan() downstream would still see
        // the expired token and incorrectly treat the user as logged out.
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // 2. Session refresh — critical for resolveWorkZoServerPlan() to work.
  // Without this, Supabase access tokens expire and API routes see no user,
  // causing all plan checks to return "free" even for paying users.
  await supabase.auth.getUser();

  // 3. Protect founder routes
  if (isFounderRoute(pathname)) {
    const allowlist = getFounderAllowlist();

    if (allowlist.length === 0) {
      // No FOUNDER_ALLOWED_EMAILS configured — hide the route entirely
      // rather than risk leaving it open to anyone. Set the env var and
      // restart the dev server to enable access.
      return new NextResponse(null, { status: 404 });
    }

    const { data, error } = await supabase.auth.getUser();
    const email = data?.user?.email?.toLowerCase();

    if (error || !email || !allowlist.includes(email)) {
      const url = request.nextUrl.clone();
      url.pathname = "/404";
      return NextResponse.rewrite(url, { status: 404 });
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
