// One backend contract for Job Assist. The frontend never needs to know whether
// a listing came from Adzuna, Jooble, Apify, or a future ATS feed, they all
// normalize into WorkZoJob.

export type JobProviderName = "active_jobs_db" | "jsearch" | "adzuna" | "jooble" | "apify" | "ats";

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

export type JobMatchResult = {
  score: number;
  recommendation: JobMatchRecommendation;

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
