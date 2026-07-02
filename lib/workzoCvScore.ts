/**
 * workzoCvScore.ts
 *
 * A JD-less CV quality score (0–100).
 *
 * This is deliberately NOT the same thing as the ATS/keyword-match score on
 * the Improve CV page (lib logic in app/cv/page.tsx), which scores a CV
 * against one specific job description. That score doesn't exist until the
 * candidate pastes a JD, so it can't power a persistent dashboard metric.
 *
 * This score instead measures structural CV quality that holds regardless
 * of which job the candidate is targeting: completeness, evidence of impact
 * (quantified bullets), and internal consistency. It reuses the same
 * ResumeProfile the parser already produces — no new parsing, no AI call.
 *
 * Server/client safe: no "use client", pure functions only.
 */

import type { ResumeProfile } from "@/lib/workzoResumeParser";

export type WorkZoAccountScores = {
  avgInterviewScore: number | null; // 0–100, all-time average of overall_score
  bestInterviewScore: number | null;
  scoredInterviewCount: number; // how many sessions actually have a score
};


export type CvScoreBreakdown = {
  score: number; // 0–100
  label: "Excellent" | "Strong" | "Good" | "Needs work" | "Incomplete";
  topGap: string; // single highest-value next action
  dimensions: {
    contact: number; // 0–10
    summary: number; // 0–10
    experience: number; // 0–40
    quantifiedImpact: number; // included inside experience, surfaced separately for messaging
    skills: number; // 0–15
    education: number; // 0–10
    extras: number; // 0–15 (projects, certifications, languages)
  };
};

const NUMBER_OR_METRIC_RE = /\d|%|\$|€|£|₹/;

function scoreContact(profile: ResumeProfile): number {
  const b = profile.basics || ({} as ResumeProfile["basics"]);
  let s = 0;
  if (b.email) s += 4;
  if (b.phone) s += 3;
  if (b.location) s += 3;
  return s;
}

function scoreSummary(profile: ResumeProfile): number {
  const len = (profile.summary || "").trim().length;
  if (len === 0) return 0;
  if (len < 30) return 4;
  if (len < 60) return 7;
  return 10;
}

function scoreExperience(profile: ResumeProfile): { total: number; quantifiedRatio: number } {
  const exp = profile.experience || [];
  if (exp.length === 0) return { total: 0, quantifiedRatio: 0 };

  // Up to 10 pts just for having entries (more entries = more career signal,
  // capped so a long CV doesn't automatically outscore a focused one).
  const presenceScore = Math.min(10, exp.length * 4);

  // Up to 10 pts for bullet depth (candidates who write 2-4 bullets per role
  // give recruiters something to evaluate; 0-1 bullets reads as thin).
  const bulletsPerEntry = exp.map((e) => (e.bullets || []).length);
  const avgBullets = bulletsPerEntry.reduce((s, n) => s + n, 0) / exp.length;
  const bulletDepthScore = Math.min(10, Math.round((avgBullets / 3) * 10));

  // Up to 20 pts for quantified impact — the single strongest predictor of
  // a CV actually landing interviews. Measures the share of bullets across
  // all roles that contain a number, %, or currency symbol.
  const allBullets = exp.flatMap((e) => e.bullets || []);
  const quantified = allBullets.filter((line) => NUMBER_OR_METRIC_RE.test(line)).length;
  const quantifiedRatio = allBullets.length > 0 ? quantified / allBullets.length : 0;
  const quantifiedScore = Math.round(quantifiedRatio * 20);

  return { total: presenceScore + bulletDepthScore + quantifiedScore, quantifiedRatio };
}

function scoreSkills(profile: ResumeProfile): number {
  const count = (profile.skills || []).length;
  if (count === 0) return 0;
  if (count < 4) return 6;
  if (count < 8) return 11;
  return 15;
}

function scoreEducation(profile: ResumeProfile): number {
  return (profile.education || []).length > 0 ? 10 : 0;
}

function scoreExtras(profile: ResumeProfile): number {
  let s = 0;
  if ((profile.projects || []).length > 0) s += 6;
  if ((profile.certifications || []).length > 0) s += 5;
  if ((profile.languages || []).length > 0) s += 4;
  return Math.min(15, s);
}

function labelFor(score: number): CvScoreBreakdown["label"] {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 55) return "Good";
  if (score >= 35) return "Needs work";
  return "Incomplete";
}

/**
 * Picks the single highest-value next action, based on whichever dimension
 * has the most headroom relative to its max. Ties broken toward the
 * dimension recruiters weight most (quantified impact, then summary).
 */
function topGapFor(d: CvScoreBreakdown["dimensions"], quantifiedRatio: number): string {
  if (d.experience === 0) return "Add your work experience — this is the section recruiters check first.";
  if (quantifiedRatio < 0.3) return "Add measurable outcomes (numbers, %, revenue, team size) to your bullet points.";
  if (d.summary < 7) return "Add a short professional summary at the top of your CV.";
  if (d.skills < 11) return "List more relevant skills — aim for 6-8 that match your target roles.";
  if (d.contact < 10) return "Fill in missing contact details (email, phone, or location).";
  if (d.education === 0) return "Add your education history.";
  if (d.extras < 8) return "Add certifications or notable projects to strengthen your profile.";
  return "Your CV is well-rounded — keep it updated as you gain new experience.";
}

/**
 * Computes a JD-less structural quality score for a parsed CV.
 * Returns null if the profile doesn't have enough signal to score
 * meaningfully (mirrors isCanonicalProfileValid's minimum bar).
 */
export function computeCvCompletenessScore(profile: ResumeProfile | null | undefined): CvScoreBreakdown | null {
  if (!profile) return null;
  const hasExperience = Array.isArray(profile.experience) && profile.experience.length > 0;
  const hasEducation = Array.isArray(profile.education) && profile.education.length > 0;
  if (!hasExperience && !hasEducation) return null;

  const contact = scoreContact(profile);
  const summary = scoreSummary(profile);
  const { total: experience, quantifiedRatio } = scoreExperience(profile);
  const skills = scoreSkills(profile);
  const education = scoreEducation(profile);
  const extras = scoreExtras(profile);

  const dimensions: CvScoreBreakdown["dimensions"] = {
    contact,
    summary,
    experience,
    quantifiedImpact: Math.round(quantifiedRatio * 100),
    skills,
    education,
    extras,
  };

  const score = Math.max(0, Math.min(100, contact + summary + experience + skills + education + extras));

  return {
    score,
    label: labelFor(score),
    topGap: topGapFor(dimensions, quantifiedRatio),
    dimensions,
  };
}
