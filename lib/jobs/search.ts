import type { CandidateContext, JobProvider, JobSearchInput, RankedJob, WorkZoJob } from "@/lib/jobs/types";
import { AdzunaProvider } from "@/lib/jobs/providers/adzuna";
import { JoobleProvider } from "@/lib/jobs/providers/jooble";
import { dedupeJobs } from "@/lib/jobs/dedupe";
import { rankJob } from "@/lib/jobs/ranking";
import { isExpired, isLikelySpam, isStale } from "@/lib/jobs/normalize";

export type RankedJobWithFlags = RankedJob & { stale: boolean };


function normalized(value: string | undefined): string {
  return (value || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function roleRelevance(job: WorkZoJob, role: string): number {
  const roleWords = normalized(role).split(/\s+/).filter((w) => w.length > 2);
  const title = normalized(job.title);
  if (!roleWords.length) return 0.5;
  return roleWords.filter((w) => title.includes(w)).length / roleWords.length;
}

function locationRelevance(job: WorkZoJob, input: JobSearchInput): number {
  const wanted = normalized(input.location);
  if (!wanted || wanted === "remote") return 1;
  const actual = normalized(`${job.location} ${job.country || ""}`);
  if (actual.includes(wanted) || wanted.includes(actual)) return 1;
  // Country-level searches should still accept cities inside that country.
  const country = (input.countryCode || "").toLowerCase();
  if (country && (job.country || "").toLowerCase() === country) return 0.95;
  if (/^(germany|deutschland)$/.test(wanted) && (job.country === "DE" || /germany|deutschland/.test(actual))) return 0.95;
  if (job.remoteType === "remote") return input.remote === "remote" ? 1 : 0.55;
  return 0.25;
}

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
    .map((job) => {
      const match = rankJob(job, candidate);
      const titleFit = roleRelevance(job, input.role);
      const placeFit = locationRelevance(job, input);
      return { ...job, match, stale: isStale(job.postedAt), _titleFit: titleFit, _placeFit: placeFit };
    })
    // Remove obvious unrelated noise, but keep remote jobs as a secondary option.
    .filter((job) => job._titleFit >= 0.34 && job._placeFit >= 0.5)
    // Search relevance comes first. CV match is a useful explanation, not the
    // only reason a listing should appear.
    .sort((a, b) => {
      const relevanceA = a._titleFit * 45 + a._placeFit * 30 + a.match.score * 0.25;
      const relevanceB = b._titleFit * 45 + b._placeFit * 30 + b.match.score * 0.25;
      return relevanceB - relevanceA;
    })
    .slice(0, input.resultsPerPage || 20)
    .map(({ _titleFit, _placeFit, ...job }) => job);

  return {
    jobs: ranked,
    providersUsed,
    providersConfigured: configured.map((p) => p.name),
    providerErrors,
    live: configured.length > 0,
  };
}
