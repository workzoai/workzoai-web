/*
 * lib/smart-apply/types.ts
 *
 * Smart Apply is a guided application-PREPARATION flow, never an auto-submitter.
 * Nothing in this module may submit an application on a user's behalf. The final
 * step is always the user clicking through to the employer's own page, having seen
 * exactly what is being sent (spec sections 1 and 29).
 */

import type { JobMatchResult, WorkZoJob } from "@/lib/jobs/types";
import type { ResumeProfile } from "@/lib/workzoResumeParser";

export type SmartApplyStatus =
  | "started"
  | "documents_ready"
  | "reviewed"
  | "applied"
  | "interviewing"
  | "rejected"
  | "offer"
  | "withdrawn";

export const SMART_APPLY_STATUSES: SmartApplyStatus[] = [
  "started",
  "documents_ready",
  "reviewed",
  "applied",
  "interviewing",
  "rejected",
  "offer",
  "withdrawn",
];

export type SmartApplyDocumentType = "cv" | "cover_letter";

export type SmartApplyDocument = {
  id: string;
  type: SmartApplyDocumentType;
  /** Structured payload: a ResumeProfile for a CV, paragraphs for a letter. */
  content: unknown;
  plainText: string;
  /*
   * Claims the generator REFUSED to write because the CV does not support them.
   * This is not decoration. It is the receipt for the evidence-first guarantee, and
   * it is shown to the user so they know what was left out and why.
   */
  evidenceWarnings: string[];
  version: number;
  createdAt: string;
};

export type SmartApplyInterviewPlan = {
  likelyQuestions: string[];
  technicalScenarios: string[];
  cvEvidenceToUse: string[];
  gapDefenseQuestions: string[];
  storiesToPrepare: Array<{ competency: string; evidence: string }>;
  recruiterRisks: string[];
};

export type SmartApplyLinkedInAdvice = {
  /** Safe for this one application only. Do not promote to the live profile. */
  tailoredCvOnly: string[];
  /** Evidenced across the user's wider target-role corpus: worth making permanent. */
  considerPermanent: string[];
  reasoning: string;
};

export type TailoredCvChange = {
  section: string;
  before?: string;
  after?: string;
  reason: string;
  evidence: string[];
};

export type TailoredCvResult = {
  profile: ResumeProfile;
  matchBefore: number;
  projectedMatchAfter: number;
  changes: TailoredCvChange[];
  /** Requirements the JD asked for that we refused to insert. Never silent. */
  blockedClaims: string[];
  warnings: string[];
};

export type SmartApplySession = {
  id: string;
  userId: string;
  job: WorkZoJob;
  match: JobMatchResult;
  canonicalProfileVersion?: string;

  tailoredCv?: SmartApplyDocument;
  coverLetter?: SmartApplyDocument;
  interviewPlan?: SmartApplyInterviewPlan;
  linkedinAdvice?: SmartApplyLinkedInAdvice;

  status: SmartApplyStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

/* ── Application tracker (spec section 17) ─────────────────────────────────── */

export type JobApplicationStatus =
  | "saved"
  | "preparing"
  | "applied"
  | "screening"
  | "interviewing"
  | "assessment"
  | "offer"
  | "rejected"
  | "withdrawn"
  | "archived";

export const JOB_APPLICATION_STATUSES: JobApplicationStatus[] = [
  "saved",
  "preparing",
  "applied",
  "screening",
  "interviewing",
  "assessment",
  "offer",
  "rejected",
  "withdrawn",
  "archived",
];
