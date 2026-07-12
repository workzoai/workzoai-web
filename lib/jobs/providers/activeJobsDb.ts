import type { JobProvider, JobSearchInput, WorkZoJob } from "@/lib/jobs/types";
import {
  cleanStr,
  cleanUrl,
  stripHtml,
  detectRemoteType,
  extractSkills,
} from "@/lib/jobs/normalize";

/**
 * Active Jobs DB by Fantastic.jobs on RapidAPI.
 *
 * RapidAPI endpoint:
 *   GET https://active-jobs-db.p.rapidapi.com/active-ats
 *
 * Required server-side environment variable:
 *   ACTIVE_JOBS_DB_API_KEY=<your RapidAPI key>
 *
 * Optional aliases/configuration:
 *   RAPIDAPI_KEY=<shared RapidAPI key>
 *   ACTIVE_JOBS_DB_HOST=active-jobs-db.p.rapidapi.com
 *
 * Never expose the key through a NEXT_PUBLIC_* variable.
 */

type ActiveJobsDbResult = {
  id?: string | number;
  title?: string;
  date_created?: string;
  date_posted?: string;
  date_valid_through?: string;
  url?: string;
  source?: string;
  source_type?: string;
  organization?: string;
  organization_url?: string;
  description_text?: string;
  description_html?: string;
  locations_derived?: string[];
  locations_alt?: string[];
  cities_derived?: string[];
  regions_derived?: string[];
  countries_derived?: string[];
  location_type?: string;
  employment_type?: string[];
  ai_employment_type?: string[] | string;
  ai_work_arrangement?: string;
  ai_salary_value?: number;
  ai_salary_min_value?: number;
  ai_salary_max_value?: number;
  ai_salary_currency?: string;
  ai_salary_unit_text?: string;
  ai_skills?: string[];
  skills?: string[];
  org_logo_permalink?: string;
  organization_logo?: string;
};

type ActiveJobsDbEnvelope = {
  data?: ActiveJobsDbResult[];
  jobs?: ActiveJobsDbResult[];
  results?: ActiveJobsDbResult[];
};

const COUNTRY_TO_ISO: Record<string, string> = {
  germany: "DE",
  deutschland: "DE",
  "united kingdom": "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  "united states": "US",
  usa: "US",
  india: "IN",
  canada: "CA",
  australia: "AU",
  austria: "AT",
  switzerland: "CH",
  france: "FR",
  netherlands: "NL",
  belgium: "BE",
  spain: "ES",
  italy: "IT",
  ireland: "IE",
  poland: "PL",
  portugal: "PT",
  sweden: "SE",
  norway: "NO",
  denmark: "DK",
  finland: "FI",
  singapore: "SG",
  "south africa": "ZA",
  "new zealand": "NZ",
  brazil: "BR",
  mexico: "MX",
};

function apiKey(): string {
  return cleanStr(
    process.env.ACTIVE_JOBS_DB_API_KEY || process.env.RAPIDAPI_KEY,
  );
}

function apiHost(): string {
  return cleanStr(
    process.env.ACTIVE_JOBS_DB_HOST || process.env.RAPIDAPI_ACTIVEJOBS_HOST,
    "active-jobs-db.p.rapidapi.com",
  );
}

function quoteSearchValue(value: string): string {
  const cleaned = cleanStr(value).replace(/["\\]/g, " ").replace(/\s+/g, " ");
  return cleaned.includes(" ") ? `"${cleaned}"` : cleaned;
}

function normalizeLocationForApi(location?: string): string {
  const value = cleanStr(location);
  if (!value || /^remote$/i.test(value)) return "";

  // The provider requires full country names rather than ISO abbreviations.
  return value
    .replace(/\bDE\b/gi, "Germany")
    .replace(/\bUK\b/gi, "United Kingdom")
    .replace(/\bUS(?:A)?\b/gi, "United States")
    .trim();
}

function countryCode(result: ActiveJobsDbResult): string | undefined {
  const country = cleanStr(result.countries_derived?.[0]).toLowerCase();
  if (!country) return undefined;
  return COUNTRY_TO_ISO[country] || (country.length === 2 ? country.toUpperCase() : undefined);
}

function employmentType(result: ActiveJobsDbResult): string | undefined {
  const ai = Array.isArray(result.ai_employment_type)
    ? result.ai_employment_type
    : result.ai_employment_type
      ? [result.ai_employment_type]
      : [];
  const raw = Array.isArray(result.employment_type) ? result.employment_type : [];
  const values = [...ai, ...raw].map((value) => cleanStr(value)).filter(Boolean);
  return values.length ? [...new Set(values)].join(", ") : undefined;
}

function remoteType(result: ActiveJobsDbResult, title: string, description: string, location: string): WorkZoJob["remoteType"] {
  const arrangement = cleanStr(result.ai_work_arrangement).toLowerCase();
  if (arrangement === "hybrid") return "hybrid";
  if (arrangement === "on-site" || arrangement === "onsite") return "onsite";
  if (arrangement === "remote solely" || arrangement === "remote ok") return "remote";
  if (cleanStr(result.location_type).toUpperCase() === "TELECOMMUTE") return "remote";
  return detectRemoteType(title, description, location);
}

function parseResults(payload: unknown): ActiveJobsDbResult[] {
  if (Array.isArray(payload)) return payload as ActiveJobsDbResult[];
  if (!payload || typeof payload !== "object") return [];
  const envelope = payload as ActiveJobsDbEnvelope;
  if (Array.isArray(envelope.data)) return envelope.data;
  if (Array.isArray(envelope.jobs)) return envelope.jobs;
  if (Array.isArray(envelope.results)) return envelope.results;
  return [];
}

export class ActiveJobsDbProvider implements JobProvider {
  name = "active_jobs_db" as const;

  isConfigured(): boolean {
    return Boolean(apiKey());
  }

  async search(input: JobSearchInput): Promise<WorkZoJob[]> {
    const key = apiKey();
    if (!key) return [];

    const host = apiHost();
    const page = Math.max(1, input.page || 1);
    const limit = Math.min(100, Math.max(10, input.resultsPerPage || 30));
    const location = normalizeLocationForApi(input.location);
    const role = cleanStr(input.role);

    const url = new URL(`https://${host}/active-ats`);
    url.searchParams.set("time_frame", "7d");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String((page - 1) * limit));
    url.searchParams.set("description_format", "text");
    url.searchParams.set("include_basic_organization_details", "true");
    url.searchParams.set("organization_agency", "exclude");

    if (role) url.searchParams.set("title", quoteSearchValue(role));
    if (location) url.searchParams.set("location", quoteSearchValue(location));

    if (input.remote === "remote") {
      url.searchParams.set("ai_work_arrangement", "Remote Solely,Remote OK");
    } else if (input.remote === "hybrid") {
      url.searchParams.set("ai_work_arrangement", "Hybrid");
    } else if (input.remote === "onsite") {
      url.searchParams.set("ai_work_arrangement", "On-site");
    }

    const response = await fetch(url.toString(), {
      headers: {
        "X-RapidAPI-Key": key,
        "X-RapidAPI-Host": host,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Active Jobs DB ${response.status}${detail ? `: ${detail.slice(0, 180)}` : ""}`,
      );
    }

    const payload = (await response.json()) as unknown;
    const results = parseResults(payload);
    const fetchedAt = new Date().toISOString();

    return results.map((result, index): WorkZoJob => {
      const title = cleanStr(result.title, "Untitled role");
      const description = stripHtml(result.description_text || result.description_html);
      const locations = [
        ...(result.locations_derived || []),
        ...(result.locations_alt || []),
      ].map((value) => cleanStr(value)).filter(Boolean);
      const locationText = locations.length
        ? [...new Set(locations)].slice(0, 3).join(" · ")
        : "Location not specified";
      const applyUrl = cleanUrl(result.url);
      const source = cleanStr(result.source, "ATS career site");
      const explicitSkills = [...(result.ai_skills || []), ...(result.skills || [])]
        .map((value) => cleanStr(value))
        .filter(Boolean);

      return {
        id: `active-jobs-db:${cleanStr(String(result.id ?? ""), `${index}`)}`,
        provider: "active_jobs_db",
        title,
        company: cleanStr(result.organization, "Company not listed"),
        location: locationText,
        country: countryCode(result),
        description,
        applyUrl,
        sourceUrl: applyUrl,
        postedAt: cleanStr(result.date_posted || result.date_created) || undefined,
        expiresAt: cleanStr(result.date_valid_through) || undefined,
        remoteType: remoteType(result, title, description, locationText),
        employmentType: employmentType(result),
        salaryMin:
          typeof result.ai_salary_min_value === "number"
            ? result.ai_salary_min_value
            : typeof result.ai_salary_value === "number"
              ? result.ai_salary_value
              : undefined,
        salaryMax:
          typeof result.ai_salary_max_value === "number"
            ? result.ai_salary_max_value
            : typeof result.ai_salary_value === "number"
              ? result.ai_salary_value
              : undefined,
        salaryCurrency: cleanStr(result.ai_salary_currency) || undefined,
        logoUrl: cleanUrl(result.org_logo_permalink || result.organization_logo) || undefined,
        skills: explicitSkills.length
          ? [...new Set(explicitSkills)].slice(0, 30)
          : extractSkills(`${title} ${description}`),
        fetchedAt,
        sourceReference: `Active Jobs DB via ${source}`,
      };
    });
  }
}
