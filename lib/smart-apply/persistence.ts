/*
 * lib/smart-apply/persistence.ts
 *
 * Every read and write here is scoped to a userId that the CALLER has already
 * authenticated. This module never trusts a userId from a request body: routes pass
 * the id resolved from the session cookie, and these functions filter on it. That is
 * the whole access-control story, because the tables are service-role only with RLS
 * enabled and no permissive policy.
 *
 * A userId is a required argument on every function for exactly this reason. It is
 * not optional, and it is not read from the row being written.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { JobMatchResult, WorkZoJob } from "@/lib/jobs/types";
import type {
  JobApplicationStatus,
  SmartApplyDocument,
  SmartApplyDocumentType,
  SmartApplySession,
  SmartApplyStatus,
} from "@/lib/smart-apply/types";

const SESSIONS = "smart_apply_sessions";
const DOCUMENTS = "smart_apply_documents";
const APPLICATIONS = "job_applications";

/* ── sessions ──────────────────────────────────────────────────────────────── */

export async function createSession(params: {
  userId: string;
  job: WorkZoJob;
  match: JobMatchResult;
  canonicalProfileVersion?: string;
}): Promise<SmartApplySession | null> {
  const { data, error } = await supabaseAdmin
    .from(SESSIONS)
    .insert({
      user_id: params.userId,
      job: params.job,
      match_result: params.match,
      canonical_profile_version: params.canonicalProfileVersion || null,
      status: "started",
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("[smart-apply] createSession failed", error?.message);
    return null;
  }
  return rowToSession(data);
}

export async function getSession(userId: string, sessionId: string): Promise<SmartApplySession | null> {
  const { data, error } = await supabaseAdmin
    .from(SESSIONS)
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId) // the access check: another user's id returns nothing
    .maybeSingle();

  if (error) {
    console.error("[smart-apply] getSession failed", error.message);
    return null;
  }
  if (!data) return null;

  const session = rowToSession(data);
  const documents = await getSessionDocuments(userId, sessionId);
  for (const doc of documents) {
    if (doc.type === "cv") session.tailoredCv = doc;
    if (doc.type === "cover_letter") session.coverLetter = doc;
  }
  return session;
}

export async function updateSessionStatus(
  userId: string,
  sessionId: string,
  status: SmartApplyStatus,
  notes?: string,
): Promise<boolean> {
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (typeof notes === "string") patch.notes = notes;

  const { error, count } = await supabaseAdmin
    .from(SESSIONS)
    .update(patch, { count: "exact" })
    .eq("id", sessionId)
    .eq("user_id", userId);

  if (error) {
    console.error("[smart-apply] updateSessionStatus failed", error.message);
    return false;
  }
  // count 0 means the session did not belong to this user. Report it as a failure
  // rather than a silent success, so the route returns 404 rather than 200.
  return (count ?? 0) > 0;
}

/* ── documents ─────────────────────────────────────────────────────────────── */

export async function saveDocument(params: {
  userId: string;
  sessionId: string;
  type: SmartApplyDocumentType;
  payload: unknown;
  plainText: string;
  evidenceWarnings: string[];
}): Promise<SmartApplyDocument | null> {
  // Verify the session belongs to the user before attaching a document to it.
  const owner = await supabaseAdmin
    .from(SESSIONS)
    .select("id")
    .eq("id", params.sessionId)
    .eq("user_id", params.userId)
    .maybeSingle();
  if (owner.error || !owner.data) {
    console.error("[smart-apply] saveDocument: session not owned by user");
    return null;
  }

  // Next version number for this (session, type). New draft, new version, old kept.
  const existing = await supabaseAdmin
    .from(DOCUMENTS)
    .select("version")
    .eq("session_id", params.sessionId)
    .eq("document_type", params.type)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = (existing.data?.version ?? 0) + 1;

  const { data, error } = await supabaseAdmin
    .from(DOCUMENTS)
    .insert({
      session_id: params.sessionId,
      user_id: params.userId,
      document_type: params.type,
      version,
      payload: params.payload,
      plain_text: params.plainText,
      evidence_warnings: params.evidenceWarnings,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("[smart-apply] saveDocument failed", error?.message);
    return null;
  }

  // Advancing status is best-effort: a saved document that failed to bump the
  // session status is still a saved document.
  await supabaseAdmin
    .from(SESSIONS)
    .update({ status: "documents_ready", updated_at: new Date().toISOString() })
    .eq("id", params.sessionId)
    .eq("user_id", params.userId);

  return rowToDocument(data);
}

async function getSessionDocuments(userId: string, sessionId: string): Promise<SmartApplyDocument[]> {
  // Latest version per type only.
  const { data, error } = await supabaseAdmin
    .from(DOCUMENTS)
    .select("*")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .order("version", { ascending: false });

  if (error || !data) return [];
  const latest = new Map<string, SmartApplyDocument>();
  for (const row of data) {
    if (!latest.has(row.document_type)) latest.set(row.document_type, rowToDocument(row));
  }
  return [...latest.values()];
}

/* ── application tracker ───────────────────────────────────────────────────── */

export async function saveApplication(params: {
  userId: string;
  sessionId?: string;
  job: Pick<WorkZoJob, "title" | "company" | "location" | "provider" | "applyUrl" | "fingerprint">;
  matchScore?: number;
  status?: JobApplicationStatus;
  tailoredCvId?: string;
  coverLetterId?: string;
  notes?: string;
}): Promise<{ ok: boolean; duplicate: boolean; id?: string }> {
  const row = {
    user_id: params.userId,
    smart_apply_session_id: params.sessionId || null,
    job_title: params.job.title,
    company_name: params.job.company,
    location: params.job.location || null,
    source: params.job.provider || null,
    apply_url: params.job.applyUrl || null,
    job_fingerprint: params.job.fingerprint || null,
    status: params.status || "saved",
    match_score: params.matchScore ?? null,
    tailored_cv_id: params.tailoredCvId || null,
    cover_letter_id: params.coverLetterId || null,
    notes: params.notes || null,
    applied_at: params.status === "applied" ? new Date().toISOString() : null,
  };

  const { data, error } = await supabaseAdmin.from(APPLICATIONS).insert(row).select("id").single();

  if (error) {
    // 23505 is a unique-violation: this user already has an application for this
    // fingerprint. That is the duplicate guard doing its job, not an error.
    if ((error as { code?: string }).code === "23505") {
      return { ok: false, duplicate: true };
    }
    console.error("[smart-apply] saveApplication failed", error.message);
    return { ok: false, duplicate: false };
  }
  return { ok: true, duplicate: false, id: data?.id };
}

export async function updateApplicationStatus(
  userId: string,
  applicationId: string,
  status: JobApplicationStatus,
  notes?: string,
): Promise<boolean> {
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (typeof notes === "string") patch.notes = notes;
  if (status === "applied") patch.applied_at = new Date().toISOString();

  const { error, count } = await supabaseAdmin
    .from(APPLICATIONS)
    .update(patch, { count: "exact" })
    .eq("id", applicationId)
    .eq("user_id", userId);

  if (error) {
    console.error("[smart-apply] updateApplicationStatus failed", error.message);
    return false;
  }
  return (count ?? 0) > 0;
}

export async function listApplications(userId: string) {
  const { data, error } = await supabaseAdmin
    .from(APPLICATIONS)
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[smart-apply] listApplications failed", error.message);
    return [];
  }
  return data || [];
}

/**
 * Manually add an application the user is tracking but did not prepare through Smart
 * Apply (they applied elsewhere and want it on the board). No fingerprint, so the
 * duplicate guard does not apply: a manual entry can always be created.
 */
export async function createManualApplication(params: {
  userId: string;
  jobTitle: string;
  companyName: string;
  location?: string;
  applyUrl?: string;
  status?: JobApplicationStatus;
  notes?: string;
}): Promise<{ ok: boolean; id?: string }> {
  const { data, error } = await supabaseAdmin
    .from(APPLICATIONS)
    .insert({
      user_id: params.userId,
      job_title: params.jobTitle.slice(0, 200),
      company_name: params.companyName.slice(0, 200),
      location: params.location?.slice(0, 200) || null,
      apply_url: params.applyUrl?.slice(0, 500) || null,
      status: params.status || "applied",
      notes: params.notes?.slice(0, 2000) || null,
      applied_at: (params.status || "applied") === "applied" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[smart-apply] createManualApplication failed", error.message);
    return { ok: false };
  }
  return { ok: true, id: data?.id };
}

/** Delete one application. Scoped to the user, so foreign ids delete nothing. */
export async function deleteApplication(userId: string, applicationId: string): Promise<boolean> {
  const { error, count } = await supabaseAdmin
    .from(APPLICATIONS)
    .delete({ count: "exact" })
    .eq("id", applicationId)
    .eq("user_id", userId);

  if (error) {
    console.error("[smart-apply] deleteApplication failed", error.message);
    return false;
  }
  return (count ?? 0) > 0;
}

/* ── row mappers ───────────────────────────────────────────────────────────── */

function rowToSession(row: Record<string, any>): SmartApplySession {
  return {
    id: row.id,
    userId: row.user_id,
    job: row.job as WorkZoJob,
    match: row.match_result as JobMatchResult,
    canonicalProfileVersion: row.canonical_profile_version || undefined,
    status: row.status as SmartApplyStatus,
    notes: row.notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToDocument(row: Record<string, any>): SmartApplyDocument {
  return {
    id: row.id,
    type: row.document_type as SmartApplyDocumentType,
    content: row.payload,
    plainText: row.plain_text || "",
    evidenceWarnings: Array.isArray(row.evidence_warnings) ? row.evidence_warnings : [],
    version: row.version,
    createdAt: row.created_at,
  };
}
