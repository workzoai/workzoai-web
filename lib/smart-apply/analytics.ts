/*
 * lib/smart-apply/analytics.ts
 *
 * The ONLY place Smart Apply funnel events are emitted (spec section 23).
 *
 * WHY A WRAPPER, NOT DIRECT trackWorkZoLaunchEvent CALLS
 *
 * The spec is blunt: "Do not put CV text, cover-letter text, email addresses, or
 * other personal data into analytics event payloads." A rule like that, enforced only
 * by everyone-remembering-it at each call site, gets broken the first time someone
 * passes the whole match object "just to see the data".
 *
 * So the emitters here accept ONLY non-identifying primitives, by type. There is no
 * parameter that can carry a name, an email, or a CV bullet. The type system is the
 * enforcement. If a future call tries to log a profile, it will not compile.
 *
 * What we DO log is shape, not content: a jobId, the provider, the numeric score, the
 * recommendation bucket, the target role (a job title, not a person), a country code.
 * Enough to see where the funnel leaks, nothing that identifies a human.
 */

import { trackWorkZoLaunchEvent } from "@/lib/workzoLaunchAnalytics";
import type { JobMatchRecommendation } from "@/lib/jobs/types";

/*
 * The closed set of dimensions a Smart Apply event may carry. Every field is a
 * primitive that describes the JOB or the OUTCOME, never the person. There is
 * deliberately no `email`, `name`, `cvText`, or `profile` field to pass.
 */
type SmartApplyDimensions = {
  jobId?: string;
  provider?: string;
  score?: number;
  recommendation?: JobMatchRecommendation;
  targetRole?: string; // a job title, not a person
  country?: string;
  /* generation outcomes */
  blockedClaimCount?: number;
  changeCount?: number;
  confidence?: number;
};

/*
 * A hard scrub, as belt-and-braces on top of the type. Even a job title could in
 * theory contain something odd, so we cap string length and strip anything that looks
 * like an email, just in case a value arrives dirtier than its type promises.
 */
function clean(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const noEmail = value.replace(/[\w.+-]+@[\w.-]+\.\w+/g, "");
  return noEmail.slice(0, 80).trim() || undefined;
}

function emit(
  event:
    | "smart_apply_started"
    | "smart_apply_cv_generated"
    | "smart_apply_cover_letter_generated"
    | "smart_apply_interview_prepared"
    | "smart_apply_linkedin_advice_viewed"
    | "smart_apply_external_apply_clicked",
  dims: SmartApplyDimensions,
) {
  const metadata: Record<string, string | number | boolean | null | undefined> = {
    jobId: dims.jobId,
    provider: clean(dims.provider),
    recommendation: dims.recommendation,
    country: clean(dims.country),
    blockedClaimCount: dims.blockedClaimCount,
    changeCount: dims.changeCount,
    confidence: dims.confidence,
  };

  trackWorkZoLaunchEvent({
    event,
    role: clean(dims.targetRole),
    score: dims.score,
    metadata,
  });
}

export const smartApplyAnalytics = {
  started: (d: Pick<SmartApplyDimensions, "jobId" | "provider" | "score" | "recommendation" | "targetRole" | "country" | "confidence">) =>
    emit("smart_apply_started", d),
  cvGenerated: (d: Pick<SmartApplyDimensions, "jobId" | "score" | "blockedClaimCount" | "changeCount">) =>
    emit("smart_apply_cv_generated", d),
  coverLetterGenerated: (d: Pick<SmartApplyDimensions, "jobId" | "blockedClaimCount">) =>
    emit("smart_apply_cover_letter_generated", d),
  interviewPrepared: (d: Pick<SmartApplyDimensions, "jobId" | "score">) => emit("smart_apply_interview_prepared", d),
  linkedinAdviceViewed: (d: Pick<SmartApplyDimensions, "jobId">) => emit("smart_apply_linkedin_advice_viewed", d),
  externalApplyClicked: (d: Pick<SmartApplyDimensions, "jobId" | "provider" | "recommendation">) =>
    emit("smart_apply_external_apply_clicked", d),
};
