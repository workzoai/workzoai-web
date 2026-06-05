import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    // This route is intentionally non-blocking.
    // It allows the client usage tracker to work before full authenticated DB usage is wired.
    console.log("workzo_usage_event", {
      eventName: body.eventName || body.event || "unknown_event",
      plan: body.plan || "free",
      metadata: body.metadata || {},
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
