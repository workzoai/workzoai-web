import type { JobProvider, JobSearchInput, WorkZoJob } from "@/lib/jobs/types";
import { cleanStr, cleanUrl, stripHtml, detectRemoteType, extractSkills } from "@/lib/jobs/normalize";

// Jooble REST API, intended for portals displaying job-search results in their
// own interface. POST https://jooble.org/api/{JOOBLE_API_KEY}
//   body: { keywords, location, page }

type JoobleJob = {
  title?: string;
  location?: string;
  snippet?: string;
  salary?: string;
  source?: string;
  type?: string;
  link?: string;
  company?: string;
  updated?: string;
  id?: string | number;
};

type JoobleResponse = { totalCount?: number; jobs?: JoobleJob[] };

export class JoobleProvider implements JobProvider {
  name = "jooble" as const;

  isConfigured(): boolean {
    return Boolean(process.env.JOOBLE_API_KEY);
  }

  async search(input: JobSearchInput): Promise<WorkZoJob[]> {
    if (!this.isConfigured()) return [];

    const keywords = [input.role, ...(input.keywords || [])].filter(Boolean).join(" ").trim();
    const res = await fetch(`https://jooble.org/api/${process.env.JOOBLE_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keywords,
        location: input.location || "",
        page: String(Math.max(1, input.page || 1)),
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Jooble ${res.status}`);
    }
    const data = (await res.json()) as JoobleResponse;
    const jobs = Array.isArray(data.jobs) ? data.jobs : [];
    const fetchedAt = new Date().toISOString();

    return jobs.map((j, index): WorkZoJob => {
      const title = cleanStr(j.title, "Untitled role");
      const description = stripHtml(j.snippet);
      const location = cleanStr(j.location, "Location not specified");
      const applyUrl = cleanUrl(j.link);

      return {
        id: `jooble:${cleanStr(String(j.id ?? ""), `${index}`)}`,
        provider: "jooble",
        title,
        company: cleanStr(j.company, "Company not listed"),
        location,
        description,
        applyUrl,
        sourceUrl: applyUrl,
        postedAt: cleanStr(j.updated) || undefined,
        remoteType: detectRemoteType(title, description, location),
        employmentType: cleanStr(j.type) || undefined,
        skills: extractSkills(`${title} ${description}`),
        fetchedAt,
        sourceReference: cleanStr(j.source) ? `Jooble via ${cleanStr(j.source)}` : "Jooble",
      };
    });
  }
}
