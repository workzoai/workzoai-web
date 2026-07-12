import { NextRequest, NextResponse } from "next/server";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { canUseWorkZoFeature, getWorkZoFeatureRequiredPlan } from "@/lib/workzoPlanLimits";
import { searchJobs, type JobSearchOutcome } from "@/lib/jobs/search";
import type { CandidateContext, JobSearchInput } from "@/lib/jobs/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Best-effort in-memory cache (10 min) and per-user rate limit. On serverless
// these reset per instance, which is fine: they only reduce duplicate load.
const CACHE_TTL_MS = 10 * 60 * 1000;
const searchCache = new Map<string, { at: number; payload: unknown }>();
const rateWindow = new Map<string, number[]>();
const RATE_MAX = 20;
const RATE_MS = 60 * 1000;

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function rateLimited(key: string): boolean {
  const now = Date.now();
  const hits = (rateWindow.get(key) || []).filter((t) => now - t < RATE_MS);
  hits.push(now);
  rateWindow.set(key, hits);
  return hits.length > RATE_MAX;
}

export async function POST(request: NextRequest) {
  const account = await resolveWorkZoServerPlan();
  if (!account.authenticated) {
    return NextResponse.json({ error: "Please sign in to use this feature." }, { status: 401 });
  }
  if (!canUseWorkZoFeature(account.plan, "job_assist")) {
    return NextResponse.json(
      { error: "Upgrade required.", requiredPlan: getWorkZoFeatureRequiredPlan("job_assist"), plan: account.plan },
      { status: 403 },
    );
  }

  const rateKey = account.userId || request.headers.get("x-forwarded-for") || "anon";
  if (rateLimited(rateKey)) {
    return NextResponse.json({ error: "Too many searches. Please wait a moment." }, { status: 429 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const input: JobSearchInput = {
      role: str(body.role, "Data Analyst"),
      location: str(body.location) || undefined,
      countryCode: str(body.countryCode) || undefined,
      remote: (["remote", "hybrid", "onsite"].includes(str(body.remote))
        ? (str(body.remote) as JobSearchInput["remote"])
        : undefined),
      keywords: Array.isArray(body.keywords)
        ? (body.keywords as unknown[]).map((k) => str(k)).filter(Boolean)
        : str(body.keywords).split(",").map((k) => k.trim()).filter(Boolean),
      page: typeof body.page === "number" ? body.page : 1,
      resultsPerPage: 30,
    };

    const candidate: CandidateContext = {
      role: str(body.role) || undefined,
      skills: Array.isArray(body.skills) ? (body.skills as unknown[]).map((s) => str(s)).filter(Boolean) : [],
      yearsExperience: typeof body.yearsExperience === "number" ? body.yearsExperience : undefined,
      cvText: str(body.cvText) || undefined,
      languages: Array.isArray(body.languages) ? (body.languages as unknown[]).map((s) => str(s)).filter(Boolean) : undefined,
      location: str(body.location) || undefined,
      remotePreference: input.remote,
      education: Array.isArray(body.education) ? (body.education as unknown[]).map((s) => str(s)).filter(Boolean) : undefined,
    };

    const cacheKey = JSON.stringify({ input, s: candidate.skills.slice(0, 20), r: candidate.role });
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return NextResponse.json({ ...(cached.payload as object), cached: true });
    }

    const outcome: JobSearchOutcome = await searchJobs(input, candidate);

    if (!outcome.live) {
      return NextResponse.json({
        success: true,
        live: false,
        message:
          "No job providers are configured. Add RAPIDAPI_KEY with RAPIDAPI_ACTIVEJOBS_HOST and/or RAPIDAPI_JSEARCH_HOST, or add Adzuna credentials.",
        jobs: [],
        providersConfigured: outcome.providersConfigured,
      });
    }

    const payload = {
      success: true,
      live: true,
      jobs: outcome.jobs,
      providersUsed: outcome.providersUsed,
      providerErrors: outcome.providerErrors,
      providersConfigured: outcome.providersConfigured,
      count: outcome.jobs.length,
      searchedAt: new Date().toISOString(),
      freshnessWindowDays: 30,
    };
    searchCache.set(cacheKey, { at: Date.now(), payload });
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown job search error";
    return NextResponse.json({ success: false, live: false, error: message, jobs: [] }, { status: 200 });
  }
}
