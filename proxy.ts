import { NextResponse, type NextRequest } from "next/server";

/**
 * WorkZo Proxy - Safe public routing fix
 *
 * This proxy intentionally does NOT redirect users to /legal/terms.
 * Reason: the previous guard was too broad and caused all pages to redirect.
 *
 * Put this file in the PROJECT ROOT and rename it to: proxy.ts
 * Also remove/disable any old middleware.ts that contains legal redirects.
 */
export function proxy(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
