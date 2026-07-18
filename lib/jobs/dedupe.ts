import type { WorkZoJob } from "@/lib/jobs/types";

function normalizeKey(value: string): string {
  return (value || "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(senior|junior|lead|sr|jr|remote|hybrid|onsite|m f d|m w d|f m x)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createJobFingerprint(job: WorkZoJob): string {
  return normalizeKey([job.company, job.title, job.location].join("|"));
}

// Preferred source order when the same vacancy appears more than once.
const PROVIDER_RANK: Record<WorkZoJob["provider"], number> = {
  ats: 0,
  active_jobs_db: 1,
  jsearch: 2,
  adzuna: 3,
  jooble: 4,
  apify: 5,
  external: 6,
};

function freshness(job: WorkZoJob): number {
  const t = job.postedAt ? Date.parse(job.postedAt) : NaN;
  return Number.isFinite(t) ? t : 0;
}

// Prefer, in order: direct ATS, official aggregator, freshest, most complete
// description. Never returns two cards for the same vacancy.
function preferred(a: WorkZoJob, b: WorkZoJob): WorkZoJob {
  if (PROVIDER_RANK[a.provider] !== PROVIDER_RANK[b.provider]) {
    return PROVIDER_RANK[a.provider] < PROVIDER_RANK[b.provider] ? a : b;
  }
  const fa = freshness(a);
  const fb = freshness(b);
  if (fa !== fb) return fa > fb ? a : b;
  return (a.description?.length || 0) >= (b.description?.length || 0) ? a : b;
}

export function dedupeJobs(jobs: WorkZoJob[]): WorkZoJob[] {
  const byPrint = new Map<string, WorkZoJob>();
  for (const job of jobs) {
    const key = createJobFingerprint(job);
    if (!key) {
      byPrint.set(`${job.provider}:${job.id}`, job);
      continue;
    }
    const existing = byPrint.get(key);
    const winner = existing ? preferred(existing, job) : job;
    /*
     * Carry the fingerprint ONTO the record. It used to be computed here, used as a
     * Map key, and thrown away, so nothing downstream could ever see it. The
     * application tracker's duplicate guard is `user_id + job_fingerprint`, and it
     * has nothing to guard on if the fingerprint does not survive the pipeline.
     */
    byPrint.set(key, { ...winner, fingerprint: key });
  }
  return [...byPrint.values()];
}
