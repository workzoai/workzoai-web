import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

/*
 * WorkZo AI - /api/code/run
 *
 * WHY THIS ROUTE EXISTS
 *
 * CodePanel used to call the public Piston instance DIRECTLY from the browser:
 *
 *     fetch("https://emkc.org/api/v2/piston/execute", ...)
 *
 * Two problems, and both of them are B2B problems.
 *
 * 1. IT BREAKS IN A CLASSROOM. That endpoint is the free community instance and
 *    it rate-limits per IP. A cohort of 25 students sits behind ONE school NAT,
 *    so they are all one IP, and they throttle each other. The first live demo
 *    to a coding school is exactly the scenario this cannot survive. Going
 *    through the server means one place to queue, retry, and swap the backend
 *    for a self-hosted Piston later without touching the client.
 *
 * 2. STUDENT CODE WENT STRAIGHT TO A THIRD PARTY. A German university's
 *    procurement will ask who processes student data and where. "It goes from
 *    the student's browser to emkc.org, and we have no agreement with them" is
 *    not an answer. Routing through the server puts the call under WorkZo's
 *    control, keeps it out of the client bundle, and gives one place to point at
 *    in a DPA.
 *
 * SQL never reaches this route at all: it runs in-browser on SQLite/WASM
 * (workzoSqlSandbox.ts), so SQL work never leaves the device.
 */

const PISTON_URL = process.env.WORKZO_PISTON_URL || "https://emkc.org/api/v2/piston/execute";

const LANGUAGES: Record<string, { language: string; version: string }> = {
  python: { language: "python", version: "3.10.0" },
  javascript: { language: "javascript", version: "18.15.0" },
  typescript: { language: "typescript", version: "5.0.3" },
  java: { language: "java", version: "15.0.2" },
  cpp: { language: "c++", version: "10.2.0" },
};

const MAX_SOURCE_CHARS = 20000;

/**
 * Per-identity rate limit, so one student cannot exhaust the shared upstream
 * budget for their whole cohort. In-process and best-effort: on a serverless
 * deployment each instance keeps its own window, which is enough to stop a
 * runaway loop, not a determined attacker. Move to the existing
 * `workzo_rate_limits` table if this needs to be authoritative.
 */
const WINDOW_MS = 60_000;
const MAX_RUNS_PER_WINDOW = 20;
const buckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(identity: string): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const bucket = buckets.get(identity);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(identity, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, retryAfter: 0 };
  }
  if (bucket.count >= MAX_RUNS_PER_WINDOW) {
    return { ok: true, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  return { ok: true, retryAfter: 0 };
}

function identify(request: NextRequest): string {
  // Prefer a per-session id from the client. Fall back to IP, which is what
  // collapses an entire classroom into one bucket, so the client should always
  // send a session id.
  const session = request.headers.get("x-workzo-session") || "";
  if (session) return `s:${session.slice(0, 64)}`;
  const forwarded = request.headers.get("x-forwarded-for") || "";
  return `ip:${forwarded.split(",")[0].trim() || "unknown"}`;
}

export async function POST(request: NextRequest) {
  let body: { language?: string; source?: string; stdin?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const languageKey = String(body.language || "").toLowerCase();
  const source = String(body.source || "");

  if (languageKey === "sql") {
    return NextResponse.json(
      { error: "SQL runs in the browser sandbox, not on the server" },
      { status: 400 },
    );
  }

  const language = LANGUAGES[languageKey];
  if (!language) {
    return NextResponse.json({ error: `language '${languageKey}' is not runnable` }, { status: 400 });
  }
  if (!source.trim()) {
    return NextResponse.json({ error: "no code to run" }, { status: 400 });
  }
  if (source.length > MAX_SOURCE_CHARS) {
    return NextResponse.json({ error: "your solution is too long to run" }, { status: 413 });
  }

  const limit = rateLimit(identify(request));
  if (limit.retryAfter > 0) {
    return NextResponse.json(
      {
        error: `Too many runs. Try again in ${limit.retryAfter}s.`,
        retryAfter: limit.retryAfter,
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  try {
    const upstream = await fetch(PISTON_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: language.language,
        version: language.version,
        files: [{ name: "solution", content: source }],
        stdin: String(body.stdin || ""),
        args: [],
        compile_timeout: 10000,
        run_timeout: 5000,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (upstream.status === 429) {
      return NextResponse.json(
        { error: "The code runner is busy right now. Wait a few seconds and run again." },
        { status: 429 },
      );
    }
    if (!upstream.ok) {
      return NextResponse.json(
        { error: "The code runner is unavailable. Talk the recruiter through your approach." },
        { status: 502 },
      );
    }

    const data = await upstream.json();
    return NextResponse.json({
      stdout: String(data?.run?.stdout || ""),
      stderr: String(data?.run?.stderr || ""),
      compileError: String(data?.compile?.stderr || ""),
      exitCode: Number(data?.run?.code ?? 0),
    });
  } catch (error) {
    console.error("[WorkZo] api.code.run failed", error);
    return NextResponse.json(
      { error: "The code runner timed out. Talk the recruiter through your approach." },
      { status: 504 },
    );
  }
}
