import { NextResponse } from "next/server";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const resolved = await resolveWorkZoServerPlan();
  const response = NextResponse.json(resolved);
  response.cookies.set("workzo_plan", resolved.plan, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  response.cookies.set("workzo_plan_type", resolved.plan, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  return response;
}
