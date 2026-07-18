/*
 * app/jobs/[jobId]/apply/workspaceClient.ts
 *
 * Client-side glue for the Smart Apply workspace: resolve the selected job and the
 * canonical CV from where they already live, and talk to the Smart Apply API.
 *
 * No new storage keys. The job comes from the same `selectedJob` slot the jobs board
 * already writes (via saveSelectedJobForNextStep), and the CV comes from the same
 * resolveCvSource the rest of the app uses. Adding a key here is how the localStorage
 * sprawl in the audit happened; we reuse.
 */

import { readLatestInterviewSetup } from "@/lib/workzoInterviewSetup";
import { resolveCvSource } from "@/lib/workzoCvSource";
import type { WorkZoJob, JobMatchResult, CandidateContext } from "@/lib/jobs/types";
import type { ResumeProfile } from "@/lib/workzoResumeParser";
import type {
  SmartApplySession,
  SmartApplyDocument,
  SmartApplyInterviewPlan,
  SmartApplyLinkedInAdvice,
} from "@/lib/smart-apply/types";

export type ResolvedContext = {
  job: WorkZoJob | null;
  profile: ResumeProfile | null;
  candidate: CandidateContext;
  cvReady: boolean;
  /** True when the stored job's id does not match the route: a stale selection. */
  staleSelection: boolean;
};

/** Pull the selected job and canonical CV from existing storage. */
export function resolveWorkspaceContext(jobId: string): ResolvedContext {
  const setup = readLatestInterviewSetup();
  const selected = (setup?.selectedJob || null) as WorkZoJob | null;

  /*
   * The job in storage should match the route. A mismatch means the user opened this
   * URL directly, or the selection is stale. We still return the stored job so the
   * page can render (the id in the URL is only a handle), but we flag the mismatch so
   * the page can warn rather than silently prepare the wrong application. We do not
   * fabricate a job from the id alone: without the full posting there is nothing to
   * score against.
   */
  const job = selected;
  const staleSelection = Boolean(selected && selected.id && jobId && selected.id !== jobId);

  const source = resolveCvSource();
  const profile = source.profile || null;
  const cvText = source.rawCvText || profile?.rawText || "";

  const candidate: CandidateContext = {
    role: source.targetRole || profile?.basics?.headline || "",
    skills: profile?.skills || [],
    cvText,
    languages: profile?.languages || [],
    location: profile?.basics?.location || "",
    education: (profile?.education || []).map((e) => [e.degree, e.institution].filter(Boolean).join(", ")).filter(Boolean),
  };

  const cvReady = Boolean(profile || cvText.trim().length > 40);
  return { job, profile, candidate, cvReady, staleSelection };
}

/* ── API calls ─────────────────────────────────────────────────────────────── */

async function post<T>(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as T & { error?: string };
    return { ok: res.ok, status: res.status, data: res.ok ? data : null, error: data?.error };
  } catch {
    return { ok: false, status: 0, data: null, error: "network" };
  }
}

async function patch<T>(url: string, body: unknown): Promise<{ ok: boolean; data: T | null; error?: string }> {
  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as T & { error?: string };
    return { ok: res.ok, data: res.ok ? data : null, error: data?.error };
  } catch {
    return { ok: false, data: null, error: "network" };
  }
}

export function createSmartApplySession(input: { job: WorkZoJob; candidate: CandidateContext; profile: ResumeProfile | null }) {
  return post<{ sessionId: string; status: string; job: WorkZoJob; match: JobMatchResult }>("/api/smart-apply", input);
}

export function generateTailoredCv(sessionId: string, profile: ResumeProfile, candidate: CandidateContext) {
  return post<{ document: SmartApplyDocument; changes: unknown[]; blockedClaims: string[]; matchBefore: number; projectedMatchAfter: number }>(
    `/api/smart-apply/${sessionId}/cv`,
    { profile, candidate },
  );
}

export function generateCoverLetterDoc(sessionId: string, profile: ResumeProfile) {
  return post<{ document: SmartApplyDocument; blockedClaims: string[]; removedClaims: string[] }>(
    `/api/smart-apply/${sessionId}/cover-letter`,
    { profile },
  );
}

export function generateInterviewPlan(sessionId: string, profile: ResumeProfile) {
  return post<{ plan: SmartApplyInterviewPlan; prefill: Record<string, string> }>(
    `/api/smart-apply/${sessionId}/interview`,
    { profile },
  );
}

export function generateLinkedInAdvice(sessionId: string, corpusMatches: JobMatchResult[] = []) {
  return post<{ advice: SmartApplyLinkedInAdvice }>(`/api/smart-apply/${sessionId}/linkedin`, { corpusMatches });
}

export function markApplied(sessionId: string) {
  return patch<{ status: string; application?: { saved: boolean; duplicate: boolean } }>(
    `/api/smart-apply/${sessionId}`,
    { status: "applied", recordApplication: true },
  );
}

export function readSession(sessionId: string) {
  return fetch(`/api/smart-apply/${sessionId}`, { method: "GET" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (d?.ok ? (d.session as SmartApplySession) : null))
    .catch(() => null);
}
