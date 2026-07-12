import type { JobProvider, JobSearchInput, WorkZoJob } from "@/lib/jobs/types";
import { cleanStr, cleanUrl, stripHtml, detectRemoteType, extractSkills } from "@/lib/jobs/normalize";

type JSearchResult = {
  job_id?: string;
  job_title?: string;
  employer_name?: string;
  employer_logo?: string;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  job_description?: string;
  job_apply_link?: string;
  job_google_link?: string;
  job_posted_at_datetime_utc?: string;
  job_employment_type?: string;
  job_is_remote?: boolean;
  job_min_salary?: number;
  job_max_salary?: number;
  job_salary_currency?: string;
};

type JSearchResponse = { data?: JSearchResult[] };

function key() { return cleanStr(process.env.JSEARCH_API_KEY || process.env.RAPIDAPI_KEY); }
function host() { return cleanStr(process.env.JSEARCH_HOST || process.env.RAPIDAPI_JSEARCH_HOST, "jsearch.p.rapidapi.com"); }

export class JSearchProvider implements JobProvider {
  name = "jsearch" as const;
  isConfigured() { return Boolean(key()); }

  async search(input: JobSearchInput): Promise<WorkZoJob[]> {
    const apiKey = key();
    if (!apiKey) return [];
    const h = host();
    const query = [input.role, input.location && input.location !== "Remote" ? `in ${input.location}` : "", input.remote === "remote" ? "remote" : ""].filter(Boolean).join(" ");
    const url = new URL(`https://${h}/search`);
    url.searchParams.set("query", query);
    url.searchParams.set("page", String(Math.max(1, input.page || 1)));
    url.searchParams.set("num_pages", "1");
    url.searchParams.set("date_posted", "month");
    if (input.remote === "remote") url.searchParams.set("remote_jobs_only", "true");

    const response = await fetch(url, { headers: { "X-RapidAPI-Key": apiKey, "X-RapidAPI-Host": h }, cache: "no-store" });
    if (!response.ok) throw new Error(`JSearch ${response.status}: ${(await response.text().catch(() => "")).slice(0, 160)}`);
    const payload = await response.json() as JSearchResponse;
    const fetchedAt = new Date().toISOString();
    return (payload.data || []).map((r, i) => {
      const title = cleanStr(r.job_title, "Untitled role");
      const description = stripHtml(r.job_description);
      const location = [r.job_city, r.job_state, r.job_country].map((value) => cleanStr(value)).filter(Boolean).join(", ") || "Location not specified";
      const applyUrl = cleanUrl(r.job_apply_link || r.job_google_link);
      return {
        id: `jsearch:${cleanStr(r.job_id, String(i))}`,
        provider: "jsearch",
        title,
        company: cleanStr(r.employer_name, "Company not listed"),
        location,
        country: cleanStr(r.job_country) || undefined,
        description,
        applyUrl,
        sourceUrl: applyUrl,
        postedAt: cleanStr(r.job_posted_at_datetime_utc) || undefined,
        remoteType: r.job_is_remote ? "remote" : detectRemoteType(title, description, location),
        employmentType: cleanStr(r.job_employment_type) || undefined,
        salaryMin: typeof r.job_min_salary === "number" ? r.job_min_salary : undefined,
        salaryMax: typeof r.job_max_salary === "number" ? r.job_max_salary : undefined,
        salaryCurrency: cleanStr(r.job_salary_currency) || undefined,
        logoUrl: cleanUrl(r.employer_logo) || undefined,
        skills: extractSkills(`${title} ${description}`),
        fetchedAt,
        sourceReference: "JSearch",
      };
    });
  }
}
