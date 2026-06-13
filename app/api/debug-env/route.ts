// TEMPORARY DEBUG ROUTE — delete this file after testing.
// Place at: app/api/debug-env/route.ts
// Visit: http://localhost:3000/api/debug-env
//
// This does NOT expose your actual key values — only whether they're set,
// their length, and a masked preview (first 6 / last 4 chars) so you can
// confirm you copy-pasted the right key without leaking it in a screenshot.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function describe(value: string | undefined) {
  if (!value) return { set: false };
  return {
    set: true,
    length: value.length,
    preview: value.length > 10 ? `${value.slice(0, 6)}...${value.slice(-4)}` : "(too short)",
  };
}

export async function GET() {
  return NextResponse.json({
    OPENROUTER_API_KEY: describe(process.env.OPENROUTER_API_KEY),
    OPENAI_API_KEY: describe(process.env.OPENAI_API_KEY),
    WORKZO_CV_AI_MODEL: process.env.WORKZO_CV_AI_MODEL || "(not set, will default)",
    WORKZO_CV_AI_BASE_URL: process.env.WORKZO_CV_AI_BASE_URL || "(not set, will default)",
    nodeEnv: process.env.NODE_ENV,
  });
}
