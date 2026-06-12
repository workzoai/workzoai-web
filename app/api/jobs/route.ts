import { NextRequest, NextResponse } from "next/server";
import { resolveWorkZoServerPlan } from "@/lib/workzoServerPlan";
import { canUseWorkZoFeature, getWorkZoFeatureRequiredPlan } from "@/lib/workzoPlanLimits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ProviderJob = {
  job_id?: string;
  job_title?: string;
  employer_name?: string;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  job_location?: string;
  job_description?: string;
  job_apply_link?: string;
  job_apply_is_direct?: boolean;
  job_posted_at_datetime_utc?: string;
  job_employment_type?: string;
  employer_logo?: string;
  job_publisher?: string;
};

type NormalizedJob = {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  applyUrl: string;
  postedAt: string | null;
  employmentType: string | null;
  source: string;
  logoUrl: string | null;
  matchReason: string;
};

function clean(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function buildLocation(job: ProviderJob) {
  const direct = clean(job.job_location);
  if (direct) return direct;

  return [job.job_city, job.job_state, job.job_country]
    .map((item) => clean(item))
    .filter(Boolean)
    .join(", ") || "Location not specified";
}

function scoreMatch(job: ProviderJob, role: string, keywords: string[]) {
  const haystack = `${job.job_title || ""} ${job.employer_name || ""} ${job.job_description || ""}`.toLowerCase();
  const roleWords = role.toLowerCase().split(/\s+/).filter((word) => word.length > 2);
  const keywordHits = keywords.filter((keyword) => haystack.includes(keyword.toLowerCase())).length;
  const roleHits = roleWords.filter((word) => haystack.includes(word)).length;
  return roleHits * 2 + keywordHits;
}

function buildMatchReason(job: ProviderJob, role: string, keywords: string[]) {
  const title = clean(job.job_title).toLowerCase();
  const description = clean(job.job_description).toLowerCase();
  const matchedKeywords = keywords
    .filter((keyword) => keyword && `${title} ${description}`.includes(keyword.toLowerCase()))
    .slice(0, 3);

  if (title.includes(role.toLowerCase())) {
    return `Strong title match for ${role}.`;
  }

  if (matchedKeywords.length) {
    return `Matches your keywords: ${matchedKeywords.join(", ")}.`;
  }

  return "Relevant role found from live job search.";
}

function normalizeJob(job: ProviderJob, index: number, role: string, keywords: string[]): NormalizedJob {
  const title = clean(job.job_title, "Untitled role");
  const company = clean(job.employer_name, "Company not listed");
  const description = clean(job.job_description, "No description available.");

  return {
    id: clean(job.job_id, `${company}-${title}-${index}`).replace(/\s+/g, "-"),
    title,
    company,
    location: buildLocation(job),
    description,
    applyUrl: clean(job.job_apply_link, ""),
    postedAt: clean(job.job_posted_at_datetime_utc) || null,
    employmentType: clean(job.job_employment_type) || null,
    source: clean(job.job_publisher, "Live job search"),
    logoUrl: clean(job.employer_logo) || null,
    matchReason: buildMatchReason(job, role, keywords),
  };
}

function buildQuery(role: string, location: string, keywords: string[]) {
  return [role, ...keywords, location].map((item) => item.trim()).filter(Boolean).join(" ");
}

export async function POST(request: NextRequest) {
  const account = await resolveWorkZoServerPlan();
  if (!account.authenticated) {
    return NextResponse.json({ error: "Please sign in to use this feature." }, { status: 401 });
  }
  if (!canUseWorkZoFeature(account.plan, "job_assist")) {
    return NextResponse.json({ error: "Upgrade required.", requiredPlan: getWorkZoFeatureRequiredPlan("job_assist"), plan: account.plan }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      role?: string;
      location?: string;
      keywords?: string[] | string;
      page?: number;
    };

    const role = clean(body.role, "Data Analyst");
    const location = clean(body.location, "Remote");
    const keywords = Array.isArray(body.keywords)
      ? body.keywords.map((item) => clean(item)).filter(Boolean)
      : clean(body.keywords)
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);

    const apiKey = process.env.JSEARCH_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        success: true,
        live: false,
        message: "JSEARCH_API_KEY is not configured. Showing smart search links only.",
        jobs: [],
      });
    }

    const query = buildQuery(role, location, keywords);
    const url = new URL("https://jsearch.p.rapidapi.com/search");
    url.searchParams.set("query", query);
    url.searchParams.set("page", String(body.page || 1));
    url.searchParams.set("num_pages", "1");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return NextResponse.json(
        {
          success: false,
          live: true,
          error: `Live job search failed: ${response.status}`,
          details: text.slice(0, 300),
          jobs: [],
        },
        { status: 200 },
      );
    }

    const data = (await response.json()) as { data?: ProviderJob[] };
    const providerJobs = Array.isArray(data.data) ? data.data : [];
    const jobs = providerJobs
      .map((job, index) => ({ job, index, score: scoreMatch(job, role, keywords) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map(({ job, index }) => normalizeJob(job, index, role, keywords));

    return NextResponse.json({ success: true, live: true, jobs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown live jobs error";
    return NextResponse.json({ success: false, live: false, error: message, jobs: [] }, { status: 200 });
  }
}
