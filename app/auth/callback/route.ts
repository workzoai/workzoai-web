import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sanitizeRedirect(value: string | null) {
  if (!value) return "/dashboard";

  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return "/dashboard";
    if (/^\/\/(.*)/.test(decoded)) return "/dashboard";
    return decoded;
  } catch {
    if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
    return value;
  }
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const redirectTo = sanitizeRedirect(
    requestUrl.searchParams.get("redirect") || requestUrl.searchParams.get("next"),
  );

  const responseUrl = request.nextUrl.clone();
  responseUrl.pathname = redirectTo.split("?")[0] || "/dashboard";
  responseUrl.search = redirectTo.includes("?") ? `?${redirectTo.split("?").slice(1).join("?")}` : "";

  if (!code) {
    responseUrl.pathname = "/login";
    responseUrl.search = "?error=missing_code";
    return NextResponse.redirect(responseUrl);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    responseUrl.pathname = "/login";
    responseUrl.search = "?error=supabase_env_missing";
    return NextResponse.redirect(responseUrl);
  }

  let response = NextResponse.redirect(responseUrl);

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

  if (error) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("error", "auth_callback_failed");
    loginUrl.searchParams.set("redirect", redirectTo);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
