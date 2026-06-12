import { NextResponse, type NextRequest } from "next/server";
import { normalizeWorkZoPlan, canUseWorkZoFeature, type WorkZoFeatureKey } from "@/lib/workzoPlanLimits";

const GATED_ROUTES: Array<{ prefix: string; feature: WorkZoFeatureKey; plan: string }> = [
  { prefix: "/cv", feature: "improve_cv", plan: "premium" },
  { prefix: "/cover-letter", feature: "cover_letter", plan: "premium" },
  { prefix: "/jobs", feature: "job_assist", plan: "premium" },
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const gate = GATED_ROUTES.find((item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`));
  if (!gate) return NextResponse.next();

  const plan = normalizeWorkZoPlan(
    request.cookies.get("workzo_plan")?.value ||
    request.cookies.get("workzo_plan_type")?.value ||
    "free",
  );

  if (canUseWorkZoFeature(plan, gate.feature)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/pricing";
  url.searchParams.set("plan", gate.plan);
  url.searchParams.set("locked", gate.feature);
  url.searchParams.set("redirect", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/cv/:path*", "/cover-letter/:path*", "/jobs/:path*"],
};
