import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sanitizeRedirect(value: string | null | undefined) {
  if (!value) return "/dashboard";

  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return "/dashboard";
    return decoded;
  } catch {
    if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
    return value;
  }
}

function buildRedirectUrl(request: NextRequest, redirectPath: string) {
  const safe = sanitizeRedirect(redirectPath);
  const url = request.nextUrl.clone();
  const [pathname, ...searchParts] = safe.split("?");
  url.pathname = pathname || "/dashboard";
  url.search = searchParts.length ? `?${searchParts.join("?")}` : "";
  return url;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const cookieRedirect = request.cookies.get("workzo_after_login")?.value;
  const redirectTo = sanitizeRedirect(
    requestUrl.searchParams.get("redirect") ||
      requestUrl.searchParams.get("next") ||
      cookieRedirect ||
      "/dashboard",
  );

  if (!code) {
    const errorUrl = buildRedirectUrl(request, "/login?error=missing_code");
    return NextResponse.redirect(errorUrl);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    const errorUrl = buildRedirectUrl(request, "/login?error=missing_supabase_env");
    return NextResponse.redirect(errorUrl);
  }

  const responseUrl = buildRedirectUrl(request, redirectTo);
  const response = NextResponse.redirect(responseUrl);

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  response.cookies.delete("workzo_after_login");

  if (error) {
    const errorUrl = buildRedirectUrl(request, "/login?error=session_exchange_failed");
    return NextResponse.redirect(errorUrl);
  }

  return response;
}
