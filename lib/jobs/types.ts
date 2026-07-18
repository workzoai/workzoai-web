// One backend contract for Job Assist. The frontend never needs to know whether
// a listing came from Adzuna, Jooble, Apify, or a future ATS feed, they all
// normalize into WorkZoJob.

export type JobProviderName = "active_jobs_db" | "jsearch" | "adzuna" | "jooble" | "apify" | "ats" | "external";

export type WorkZoJob = {
  id: string;
  provider: JobProviderName;

  title: string;
  company: string;
  location: string;
  country?: string;

  description: string;
  applyUrl: string;
  sourceUrl?: string;

  postedAt?: string;
  expiresAt?: string;

  remoteType: "remote" | "hybrid" | "onsite" | "unknown";
  employmentType?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;

  logoUrl?: string;
  skills: string[];

  fetchedAt: string;
  sourceReference: string;

  /** Provider's own id for this posting, when it exposes one. */
  providerJobId?: string;

  /*
   * Stable sha256 of normalized title + company + location.
   *
   * Computed once in the search pipeline (lib/jobs/dedupe.ts) and carried on the
   * record from then on. It used to be derived inside dedupe and thrown away,
   * which meant the application tracker had no stable key: the duplicate-apply
   * guard (user_id + job_fingerprint) has nothing to guard on if the fingerprint
   * does not survive onto the job.
   */
  fingerprint?: string;
};

export type JobSearchInput = {
  role: string;
  location?: string;
  countryCode?: string; // ISO 3166 alpha-2, lower-case (e.g. "gb", "de", "us")
  remote?: "remote" | "hybrid" | "onsite" | "unknown";
  keywords?: string[];
  page?: number;
  resultsPerPage?: number;
};

// The candidate context the ranker scores each job against. Sourced from the
// canonical CV so ranking reflects the real profile, not a guess.
export type CandidateContext = {
  role?: string;
  skills: string[];
  yearsExperience?: number;
  cvText?: string;
  languages?: string[];
  location?: string;
  remotePreference?: "remote" | "hybrid" | "onsite" | "unknown";
  education?: string[];
};

export type JobMatchRecommendation =
  | "strong_match"
  | "worth_applying"
  | "stretch"
  | "low_match";

/* ── Structured requirements (Smart Apply) ─────────────────────────────────
 *
 * A requirement is no longer a bare string. It carries what kind of thing it is,
 * how badly the employer wants it, whether the CV supports it, and the VERBATIM
 * CV text that proves it.
 *
 * The evidence array is the load-bearing part. Without it, "evidence-first
 * generation" cannot be enforced (there is nothing to check a claim against) and
 * the match card cannot explain itself (there is nothing to quote).
 */

export type JobRequirementCategory =
  | "technical"
  | "experience"
  | "education"
  | "language"
  | "location"
  | "domain"
  | "soft_skill"
  | "other";

export type JobRequirementCriticality = "required" | "preferred" | "unknown";

/*
 * "missing" and "not_verifiable" are DIFFERENT and must never be merged.
 *   missing         the CV was checked and does not support this
 *   not_verifiable  a CV cannot answer this (will you relocate? no CV says)
 * Scoring penalises the first and stays neutral on the second.
 */
export type JobRequirementStatus = "matched" | "partial" | "missing" | "not_verifiable";

export type JobRequirementMatch = {
  requirement: string;
  category: JobRequirementCategory;
  criticality: JobRequirementCriticality;
  status: JobRequirementStatus;
  /** Verbatim CV lines proving this. Empty unless status is matched or partial. */
  evidence: string[];
};

export type JobMatchResult = {
  score: number;
  recommendation: JobMatchRecommendation;

  /* THE SOURCE OF TRUTH. Everything below is derived from this. */
  requirements: JobRequirementMatch[];

  strengths: string[];
  concerns: string[];
  explanation: string;
  /** 0..1. How much of the JD we could actually read and check. */
  confidence: number;
  generatedAt: string;

  /* ── Derived views, kept for the existing /jobs board UI ──────────────────
   * These are FLATTENED PROJECTIONS of `requirements`, produced by
   * deriveLegacyViews() in ranking.ts. They are never assigned independently, so
   * they cannot drift out of sync with the structured list the way two
   * hand-maintained arrays would.
   */
  matchedRequirements: string[];
  partiallyMatchedRequirements: string[];
  missingCriticalRequirements: string[];
  unsupportedRequirements: string[];
  reasons: string[];
};

// A WorkZoJob plus its match against the current candidate.
export type RankedJob = WorkZoJob & { match: JobMatchResult };

export interface JobProvider {
  name: JobProviderName;
  /** True when the provider has the credentials it needs to run. */
  isConfigured(): boolean;
  search(input: JobSearchInput): Promise<WorkZoJob[]>;
}
