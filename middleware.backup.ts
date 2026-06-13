import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Routes that are completely removed from production.
 * Any request matching these paths receives a 404, regardless of auth state.
 * (Kept here — rather than deleting the route files outright — so that if
 * someone re-adds the files by mistake, they still won't be reachable.)
 */
const DISABLED_IN_PRODUCTION = [
  "/sentry-example-page",
  "/api/sentry-example-api",
  "/vapi-test",
  "/dev-tools",
];

/**
 * Founder / internal analytics routes.
 * Only accessible to signed-in users whose email is in FOUNDER_ALLOWED_EMAILS.
 */
const FOUNDER_ROUTES = ["/founder", "/founder-dashboard", "/founder/analytics"];

function isDisabledRoute(pathname: string) {
  return DISABLED_IN_PRODUCTION.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

function isFounderRoute(pathname: string) {
  return FOUNDER_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

function getFounderAllowlist(): string[] {
  const raw = process.env.FOUNDER_ALLOWED_EMAILS || "";
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- 1. Hard-disable debug/scaffold routes in production ---
  if (process.env.NODE_ENV === "production" && isDisabledRoute(pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  // --- 2. Protect founder/admin routes ---
  if (isFounderRoute(pathname)) {
    const allowlist = getFounderAllowlist();

    // If no allowlist is configured, fail closed (deny everyone) rather than
    // leaving the dashboard open.
    if (allowlist.length === 0) {
      return new NextResponse(null, { status: 404 });
    }

    let response = NextResponse.next({ request });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      // Misconfigured env — fail closed.
      return new NextResponse(null, { status: 404 });
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { data, error } = await supabase.auth.getUser();
    const email = data?.user?.email?.toLowerCase();

    if (error || !email || !allowlist.includes(email)) {
      // Not signed in, or not a founder — pretend the route doesn't exist.
      const url = request.nextUrl.clone();
      url.pathname = "/404";
      return NextResponse.rewrite(url, { status: 404 });
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/founder/:path*",
    "/founder-dashboard/:path*",
    "/sentry-example-page/:path*",
    "/api/sentry-example-api/:path*",
    "/vapi-test/:path*",
    "/dev-tools/:path*",
  ],
};
