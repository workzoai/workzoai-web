import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function signOut() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return;

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {}
      },
    },
  });

  await supabase.auth.signOut();
}

// Redirects relative to the incoming request's own origin (matches the
// pattern in auth/callback/route.ts) rather than NEXT_PUBLIC_APP_URL. That
// env var falling back to "http://localhost:3000" meant that if it was ever
// unset or stale in production, every real user's browser got redirected
// to localhost after logout — which just fails to load from their side.
// Building the URL from the request itself can't drift out of sync with
// whatever domain the user is actually on.
export async function POST(request: NextRequest) {
  await signOut();
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.delete("workzo_after_login");
  return response;
}

export async function GET(request: NextRequest) {
  await signOut();
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.delete("workzo_after_login");
  return response;
}