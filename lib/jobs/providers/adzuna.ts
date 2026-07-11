import type { JobProvider, JobSearchInput, WorkZoJob } from "@/lib/jobs/types";
import { cleanStr, cleanUrl, stripHtml, detectRemoteType, extractSkills } from "@/lib/jobs/normalize";

// Adzuna official job-search API.
// Docs: https://developer.adzuna.com/
// GET https://api.adzuna.com/v1/api/jobs/{country}/search/{page}
//   ?app_id=...&app_key=...&what=...&where=...&results_per_page=...&content-type=application/json

type AdzunaResult = {
  id?: string | number;
  title?: string;
  description?: string;
  redirect_url?: string;
  created?: string;
  company?: { display_name?: string };
  location?: { display_name?: string; area?: string[] };
  category?: { label?: string };
  contract_time?: string;
  contract_type?: string;
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: string;
};

type AdzunaResponse = { results?: AdzunaResult[]; count?: number };

const SUPPORTED_COUNTRIES = new Set([
  "gb", "us", "at", "au", "be", "br", "ca", "ch", "de", "es", "fr",
  "in", "it", "mx", "nl", "nz", "pl", "sg", "za",
]);

function resolveCountry(input: JobSearchInput): string {
  const code = (input.countryCode || "").toLowerCase();
  if (SUPPORTED_COUNTRIES.has(code)) return code;
  // Light inference from a location string; default to gb.
  const loc = (input.location || "").toLowerCase();
  if (/germany|deutschland|berlin|munich|münchen/.test(loc)) return "de";
  if (/united states|usa|u\.s\.|new york|san francisco|remote us/.test(loc)) return "us";
  if (/united kingdom|london|england|uk\b/.test(loc)) return "gb";
  if (/india|bangalore|mumbai|delhi|hyderabad/.test(loc)) return "in";
  if (/canada|toronto|vancouver/.test(loc)) return "ca";
  if (/australia|sydney|melbourne/.test(loc)) return "au";
  return "gb";
}

export class AdzunaProvider implements JobProvider {
  name = "adzuna" as const;

  isConfigured(): boolean {
    return Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);
  }

  async search(input: JobSearchInput): Promise<WorkZoJob[]> {
    if (!this.isConfigured()) return [];

    const country = resolveCountry(input);
    const page = Math.max(1, input.page || 1);
    const what = [input.role, ...(input.keywords || [])].filter(Boolean).join(" ").trim();

    const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/${page}`);
    url.searchParams.set("app_id", process.env.ADZUNA_APP_ID as string);
    url.searchParams.set("app_key", process.env.ADZUNA_APP_KEY as string);
    url.searchParams.set("results_per_page", String(input.resultsPerPage || 20));
    if (what) url.searchParams.set("what", what);
    if (input.location) url.searchParams.set("where", input.location);
    if (input.remote === "remote") url.searchParams.set("what_or", "remote");
    url.searchParams.set("content-type", "application/json");

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Adzuna ${res.status}`);
    }
    const data = (await res.json()) as AdzunaResponse;
    const results = Array.isArray(data.results) ? data.results : [];
    const fetchedAt = new Date().toISOString();

    return results.map((r, index): WorkZoJob => {
      const title = cleanStr(r.title, "Untitled role");
      const description = stripHtml(r.description);
      const location = cleanStr(r.location?.display_name, "Location not specified");
      const applyUrl = cleanUrl(r.redirect_url);
      const skillsHay = `${title} ${description} ${cleanStr(r.category?.label)}`;

      return {
        id: `adzuna:${cleanStr(String(r.id ?? ""), `${index}`)}`,
        provider: "adzuna",
        title,
        company: cleanStr(r.company?.display_name, "Company not listed"),
        location,
        country: country.toUpperCase(),
        description,
        applyUrl,
        sourceUrl: applyUrl,
        postedAt: cleanStr(r.created) || undefined,
        remoteType: detectRemoteType(title, description, location),
        employmentType: cleanStr(r.contract_time) || cleanStr(r.contract_type) || undefined,
        salaryMin: typeof r.salary_min === "number" ? r.salary_min : undefined,
        salaryMax: typeof r.salary_max === "number" ? r.salary_max : undefined,
        salaryCurrency: country === "us" ? "USD" : country === "gb" ? "GBP" : country === "in" ? "INR" : "EUR",
        skills: extractSkills(skillsHay),
        fetchedAt,
        sourceReference: "Adzuna",
      };
    });
  }
}
