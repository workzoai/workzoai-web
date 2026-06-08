import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const protectedRoutes = [
  "/dashboard",
  "/history",
  "/settings",
  "/results",
  "/cv",
  "/cover-letter",
  "/jobs",
];

function isProtectedPath(pathname: string) {
  return protectedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isAuthPath(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/login/");
}

function safeRedirectPath(request: NextRequest) {
  const pathname = request.nextUrl.pathname || "/dashboard";
  const search = request.nextUrl.search || "";
  if (!pathname.startsWith("/")) return "/dashboard";
  if (pathname.startsWith("//")) return "/dashboard";
  return `${pathname}${search}`;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const protectedPath = isProtectedPath(pathname);

  if (protectedPath && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    redirectUrl.searchParams.set("redirect", safeRedirectPath(request));
    return NextResponse.redirect(redirectUrl);
  }

  if (isAuthPath(pathname) && user) {
    const redirectParam = request.nextUrl.searchParams.get("redirect") || request.nextUrl.searchParams.get("next") || "/dashboard";
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = redirectParam.startsWith("/") && !redirectParam.startsWith("//") ? redirectParam.split("?")[0] : "/dashboard";
    redirectUrl.search = redirectParam.includes("?") ? `?${redirectParam.split("?").slice(1).join("?")}` : "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
