import type { CandidateContext, JobMatchRecommendation, JobMatchResult, WorkZoJob } from "@/lib/jobs/types";
import { extractJobRequirements } from "@/lib/jobs/normalize";

// Weighted, CV-backed ranking. A score of 100 is intentionally near-impossible:
// a candidate missing key requirements should never read as a perfect match.
//
// Required skills coverage       30
// Experience relevance           20
// Role/title similarity          15
// Language fit                   10
// Location/work-model fit        10
// Education/certification fit     5
// Evidence strength               5
// Missing-critical penalty        5 (subtracted)

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function words(value: string): string[] {
  return (value || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);
}

function recommendationFor(score: number): JobMatchRecommendation {
  if (score >= 85) return "strong_match";
  if (score >= 68) return "worth_applying";
  if (score >= 50) return "stretch";
  return "low_match";
}

export function rankJob(job: WorkZoJob, candidate: CandidateContext): JobMatchResult {
  const jd = `${job.title} ${job.description}`;
  const requirements = extractJobRequirements(jd, 12);
  const cvSkillsLower = new Set((candidate.skills || []).map((s) => s.toLowerCase()));
  const cvText = (candidate.cvText || "").toLowerCase();

  const matchedRequirements: string[] = [];
  const partiallyMatchedRequirements: string[] = [];
  const unsupportedRequirements: string[] = [];

  for (const req of requirements) {
    const r = req.toLowerCase();
    if (cvSkillsLower.has(r)) matchedRequirements.push(req);
    else if (cvText.includes(r)) partiallyMatchedRequirements.push(req);
    else unsupportedRequirements.push(req);
  }

  // The first few requirements a JD lists are treated as the critical ones.
  const criticalReqs = requirements.slice(0, 5);
  const missingCriticalRequirements = criticalReqs.filter(
    (req) => unsupportedRequirements.includes(req),
  );

  // 1. Required skills coverage (30)
  const coverage = requirements.length
    ? (matchedRequirements.length + partiallyMatchedRequirements.length * 0.5) / requirements.length
    : 0.5;

  // 2. Experience relevance (20): compare candidate years to seniority hints.
  const jdLower = jd.toLowerCase();
  const wantsSenior = /\b(senior|lead|principal|5\+ years|7\+ years|8\+ years)\b/.test(jdLower);
  const wantsJunior = /\b(junior|entry|graduate|intern|0-2 years|1\+ year)\b/.test(jdLower);
  const years = candidate.yearsExperience ?? 0;
  let experience = 0.6;
  if (wantsSenior) experience = years >= 5 ? 0.95 : years >= 3 ? 0.65 : 0.4;
  else if (wantsJunior) experience = years <= 3 ? 0.95 : 0.7;
  else experience = years >= 2 ? 0.85 : 0.6;

  // 3. Role/title similarity (15)
  const roleWords = new Set(words(candidate.role || ""));
  const titleWords = words(job.title);
  const titleOverlap = titleWords.length
    ? titleWords.filter((w) => roleWords.has(w)).length / titleWords.length
    : 0;
  const roleSimilarity = clamp01(titleOverlap * 1.4);

  // 4. Language fit (10): neutral-high unless a language is explicitly required
  // and not in the candidate profile.
  const langReq = jdLower.match(/\b(german|french|spanish|dutch|italian|portuguese)\b/);
  let languageFit = 0.9;
  if (langReq) {
    const has = (candidate.languages || []).map((l) => l.toLowerCase()).includes(langReq[1]);
    languageFit = has ? 1 : 0.4;
  }

  // 5. Location / work-model fit (10)
  const pref = candidate.remotePreference || "unknown";
  let locationFit = 0.7;
  if (job.remoteType === "remote") locationFit = 0.95;
  else if (pref !== "unknown" && pref === job.remoteType) locationFit = 0.9;
  else if (candidate.location && job.location.toLowerCase().includes(candidate.location.toLowerCase().split(",")[0].trim())) locationFit = 0.85;
  else if (job.remoteType === "onsite" && pref === "remote") locationFit = 0.45;

  // 6. Education / certification fit (5)
  const eduHints = /\b(bachelor|master|degree|bsc|msc|certification|certified)\b/.test(jdLower);
  const eduText = (candidate.education || []).join(" ").toLowerCase() + " " + cvText;
  const educationFit = !eduHints ? 0.8 : /\b(bachelor|master|degree|bsc|msc|diploma|certified|certification)\b/.test(eduText) ? 0.95 : 0.5;

  // 7. Evidence strength (5): does the CV carry quantified proof at all.
  const evidenceStrength = /\b\d+\s*(%|percent|k|m|hours|users|customers|tickets|projects)\b/.test(cvText) ? 0.9 : 0.5;

  // 8. Missing-critical penalty (5)
  const missingPenalty = criticalReqs.length
    ? missingCriticalRequirements.length / criticalReqs.length
    : 0;

  const raw =
    coverage * 30 +
    experience * 20 +
    roleSimilarity * 15 +
    languageFit * 10 +
    locationFit * 10 +
    educationFit * 5 +
    evidenceStrength * 5 -
    missingPenalty * 5;

  // Cap so 100 is effectively unreachable; a real perfect match tops out ~96.
  const score = Math.max(0, Math.min(96, Math.round(raw)));
  const recommendation = recommendationFor(score);

  const reasons: string[] = [];
  if (matchedRequirements.length) reasons.push(`Matches ${matchedRequirements.slice(0, 4).join(", ")}.`);
  if (roleSimilarity >= 0.5) reasons.push("Job title lines up with your target role.");
  if (job.remoteType === "remote") reasons.push("Remote role.");
  if (missingCriticalRequirements.length) reasons.push(`Missing: ${missingCriticalRequirements.slice(0, 3).join(", ")}.`);
  else if (unsupportedRequirements.length) reasons.push(`Worth strengthening: ${unsupportedRequirements.slice(0, 3).join(", ")}.`);
  if (!reasons.length) reasons.push("Relevant role from live search.");

  return {
    score,
    recommendation,
    matchedRequirements,
    partiallyMatchedRequirements,
    missingCriticalRequirements,
    unsupportedRequirements: unsupportedRequirements.filter((r) => !missingCriticalRequirements.includes(r)),
    reasons,
  };
}
