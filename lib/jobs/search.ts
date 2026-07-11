import type { CandidateContext, JobProvider, JobSearchInput, RankedJob, WorkZoJob } from "@/lib/jobs/types";
import { AdzunaProvider } from "@/lib/jobs/providers/adzuna";
import { JoobleProvider } from "@/lib/jobs/providers/jooble";
import { dedupeJobs } from "@/lib/jobs/dedupe";
import { rankJob } from "@/lib/jobs/ranking";
import { isExpired, isLikelySpam, isStale } from "@/lib/jobs/normalize";

export type RankedJobWithFlags = RankedJob & { stale: boolean };

export type JobSearchOutcome = {
  jobs: RankedJobWithFlags[];
  providersUsed: string[];
  providersConfigured: string[];
  providerErrors: Array<{ provider: string; error: string }>;
  live: boolean;
};

function buildProviders(): JobProvider[] {
  // Adzuna is primary, Jooble is coverage fallback. Apify/ATS can be added here
  // later without touching the route or the page.
  return [new AdzunaProvider(), new JoobleProvider()];
}

export async function searchJobs(
  input: JobSearchInput,
  candidate: CandidateContext,
): Promise<JobSearchOutcome> {
  const providers = buildProviders();
  const configured = providers.filter((p) => p.isConfigured());

  const providerErrors: JobSearchOutcome["providerErrors"] = [];
  const settled = await Promise.allSettled(
    configured.map((p) => p.search(input)),
  );

  const collected: WorkZoJob[] = [];
  const providersUsed: string[] = [];
  settled.forEach((result, i) => {
    const name = configured[i].name;
    if (result.status === "fulfilled") {
      providersUsed.push(name);
      collected.push(...result.value);
    } else {
      providerErrors.push({
        provider: name,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  });

  // Search-quality safeguards.
  const cleaned = collected.filter(
    (j) =>
      j.title &&
      j.applyUrl &&
      j.description.length >= 20 &&
      !isExpired(j.expiresAt) &&
      !isLikelySpam(j.title, j.company),
  );

  const deduped = dedupeJobs(cleaned);

  const ranked: RankedJobWithFlags[] = deduped
    .map((job) => ({ ...job, match: rankJob(job, candidate), stale: isStale(job.postedAt) }))
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, input.resultsPerPage || 20);

  return {
    jobs: ranked,
    providersUsed,
    providersConfigured: configured.map((p) => p.name),
    providerErrors,
    live: configured.length > 0,
  };
}
