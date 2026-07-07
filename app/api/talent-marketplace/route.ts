import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { dispatchNotification } from "@/lib/notify/dispatch";
import {
  buildCopilotOutput,
  calculateTalentMatch,
  calculateWiriFromSignals,
  clampScore,
  consistencyFromScores,
  extractSkillsFromJD,
  filterCandidates,
  inferIndustryFromJD,
  inferRoleFromJD,
  sampleMarketplaceCandidates,
  wiriTierFor,
  type CampaignStatus,
  type CopilotMode,
  type HiringCampaign,
  type MarketplaceCandidate,
  type MarketplaceFilters,
  type MarketplaceVisibility,
  type ShortlistStatus,
} from "../../../lib/talentMarketplace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DbClient = any | null;

function db(): DbClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function orgKey(org: string): string {
  const secret = process.env.FOUNDER_ANALYTICS_SECRET || "";
  return createHmac("sha256", secret).update(`org:${org.toLowerCase().trim()}`).digest("hex").slice(0, 32);
}

function safeEqual(a = "", b = "") {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  if (aa.length !== bb.length) return false;
  try { return timingSafeEqual(aa, bb); } catch { return false; }
}

function authorized(url: URL) {
  const org = (url.searchParams.get("org") || url.searchParams.get("code") || "demo").toLowerCase().trim();
  const key = url.searchParams.get("key") || "";
  const secret = url.searchParams.get("secret") || "";
  const founderSecret = process.env.FOUNDER_ANALYTICS_SECRET || "";
  const isFounder = founderSecret.length > 0 && safeEqual(secret, founderSecret);
  return { org, key, secret, ok: isFounder || !founderSecret || safeEqual(key, orgKey(org)) };
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim()) return value.split(",").map((x) => x.trim()).filter(Boolean);
  return [];
}

function csvEscape(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

async function logActivity(client: DbClient, input: { organizationId: string; actorType?: string; action: string; entityType?: string; entityId?: string | null; metadata?: Record<string, unknown> }) {
  if (!client) return;

  // The marketplace tables are created by the WorkZo 2.0 migration and may not
  // exist in the generated Supabase TypeScript schema yet. Keep this service-role
  // route build-safe by using an untyped payload instead of letting Supabase infer
  // the insert type as never[].
  const activityPayload: Record<string, unknown> = {
    organization_id: input.organizationId,
    actor_type: input.actorType || "system",
    action: input.action,
    entity_type: input.entityType || null,
    entity_id: input.entityId || null,
    metadata: input.metadata || {},
  };

  await client.from("marketplace_activity_log").insert(activityPayload);
}

function evidenceFor(l: any): string[] {
  const c = l.competencySnapshot || l.competency_snapshot || {};
  const out: string[] = [];
  if ((c.communication || 0) >= 75) out.push("Strong communication signal from interview scoring");
  if ((c.evidenceImpact || c.evidence_quality || 0) >= 75) out.push("Uses evidence-backed examples in interview answers");
  if ((c.jobFit || 0) >= 75) out.push("Answers are relevant to the target role");
  if ((l.trend || l.improvement || 0) > 8) out.push(`Improved by +${l.trend || l.improvement}% across practice sessions`);
  return out.length ? out : ["Completed realistic WorkZo interview based on CV and job description"];
}

function risksFor(l: any): string[] {
  const c = l.competencySnapshot || l.competency_snapshot || {};
  const out: string[] = [];
  if ((c.evidenceImpact || c.evidence_quality || 100) < 65) out.push("Evidence quality needs review");
  if ((c.confidence || 100) < 65) out.push("Confidence may need coaching");
  if ((l.sessions || 0) < 2) out.push("Needs more interview attempts for score stability");
  return out;
}

function journeyFor(l: any) {
  const sessions = Number(l.sessions || 0);
  const readiness = clampScore(l.readiness || l.wiri || 0);
  const trend = Number(l.trend || l.improvement || 0);
  return [
    { label: "CV Uploaded", done: true },
    { label: "CV Improved", done: Boolean(l.cvImproved || l.verified) },
    { label: "Interview 1", value: sessions >= 1 ? Math.max(35, readiness - Math.max(10, trend)) : undefined, done: sessions >= 1 },
    { label: "Latest Interview", value: readiness, done: sessions > 0 },
    { label: "Employer Ready", done: readiness >= 80 && sessions >= 2 },
  ];
}

function normalizeLearner(l: any, org: string): MarketplaceCandidate {
  const rawBreakdown = l.wiriBreakdown || l.wiri_breakdown || {};
  const snapshot = l.competencySnapshot || l.competency_snapshot || {};
  const sessionScores = Array.isArray(l.sessionScores) ? l.sessionScores : [];
  const computed = calculateWiriFromSignals({
    cvQuality: rawBreakdown.cvQuality || l.cvQuality || l.resumeScore || 75,
    jobFit: rawBreakdown.jobFit || snapshot.jobFit || l.jobFit || l.readiness,
    interviewPerformance: rawBreakdown.interviewPerformance || l.readiness || l.overall_score,
    communication: rawBreakdown.communication || snapshot.communication,
    technicalCompetency: rawBreakdown.technicalCompetency || snapshot.technical || snapshot.evidenceImpact,
    confidence: rawBreakdown.confidence || snapshot.confidence,
    evidenceQuality: rawBreakdown.evidenceQuality || snapshot.evidenceImpact || l.evidence_quality,
    improvementTrend: rawBreakdown.improvementTrend || Math.min(100, 70 + Math.max(0, Number(l.trend || 0))),
    interviewConsistency: rawBreakdown.interviewConsistency || consistencyFromScores(sessionScores),
  });
  const wiri = clampScore(l.wiri || computed.wiri || l.readiness || 0);
  const skills = Array.isArray(l.skills) ? l.skills : toArray(l.skills);
  const languages = Array.isArray(l.languages) ? l.languages : toArray(l.languages);
  return {
    id: String(l.id || l.userId || l.user_id || randomUUID()),
    userId: String(l.userId || l.user_id || l.id || randomUUID()),
    name: String(l.name || l.full_name || l.email || "Candidate"),
    email: String(l.email || ""),
    role: String(l.role || l.targetRole || l.target_role || "Open Role"),
    location: String(l.location || "Remote / flexible"),
    country: String(l.country || ""),
    city: String(l.city || ""),
    availability: String(l.availability || "Available on request"),
    languages: languages.length ? languages : ["English"],
    skills,
    projects: Array.isArray(l.projects) ? l.projects : [],
    education: String(l.education || ""),
    university: String(l.university || org),
    graduationYear: String(l.graduationYear || l.graduation_year || ""),
    experienceLevel: String(l.experienceLevel || l.experience_level || ""),
    visaStatus: String(l.visaStatus || l.visa_status || ""),
    salaryExpectation: String(l.salaryExpectation || l.salary_expectation || ""),
    openToRelocation: Boolean(l.openToRelocation || l.open_to_relocation),
    openToInternships: Boolean(l.openToInternships || l.open_to_internships),
    openToGraduatePrograms: Boolean(l.openToGraduatePrograms ?? l.open_to_graduate_programs ?? true),
    preferredWorkMode: l.preferredWorkMode || l.preferred_work_mode || "flexible",
    visibility: l.visibility || "organization",
    verified: Boolean(l.verified || l.interviewVerified || l.interview_verified || wiri >= 80),
    identityVerified: Boolean(l.identityVerified || l.identity_verified),
    cvVerified: Boolean(l.cvVerified || l.cv_verified || l.verified),
    interviewVerified: Boolean(l.interviewVerified || l.interview_verified || Number(l.sessions || 0) > 0),
    technicalVerified: Boolean(l.technicalVerified || l.technical_verified || (snapshot.technical || snapshot.evidenceImpact || 0) >= 80),
    passportEnabled: Boolean(l.passportEnabled || l.passport_enabled || false),
    passportSlug: l.passportSlug || l.passport_slug || undefined,
    wiri,
    wiriTier: l.wiriTier || l.wiri_tier || wiriTierFor(wiri),
    readiness: clampScore(l.readiness || wiri),
    sessions: Number(l.sessions || 0),
    improvement: Number(l.trend || l.improvement || 0),
    consistency: clampScore(rawBreakdown.interviewConsistency || consistencyFromScores(sessionScores), 80),
    lastActive: String(l.lastActive || l.last_active || "—"),
    summary: String(l.matchSummary || l.summary || "Candidate has completed WorkZo interview practice."),
    evidence: Array.isArray(l.evidence) ? l.evidence : evidenceFor(l),
    risks: Array.isArray(l.risks) ? l.risks : risksFor(l),
    wiriBreakdown: { ...computed.breakdown, ...rawBreakdown },
    competencySnapshot: { ...snapshot, technical: snapshot.technical || snapshot.evidenceImpact || computed.breakdown.technicalCompetency },
    journey: Array.isArray(l.journey) ? l.journey : journeyFor(l),
  };
}

async function cohortCandidates(origin: string, org: string, key: string, secret: string): Promise<MarketplaceCandidate[]> {
  try {
    const params = new URLSearchParams();
    params.set(org.includes(".") ? "org" : "code", org);
    if (key) params.set("key", key);
    if (secret) params.set("secret", secret);
    const res = await fetch(`${origin}/api/admin/cohort?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`cohort ${res.status}`);
    const payload = await res.json();
    const learners = Array.isArray(payload?.learners) ? payload.learners : [];
    if (!learners.length) return sampleMarketplaceCandidates();
    return learners.map((l: any) => normalizeLearner(l, org));
  } catch {
    return sampleMarketplaceCandidates();
  }
}

async function getVisibility(client: DbClient, organizationId: string, ids: string[]) {
  const map = new Map<string, { visibility: MarketplaceVisibility; passport_enabled: boolean; passport_slug?: string; open_to_relocation?: boolean; open_to_internships?: boolean; open_to_graduate_programs?: boolean; preferred_work_mode?: string; salary_expectation?: string }>();
  if (!client || ids.length === 0) return map;
  const { data, error } = await client.from("talent_visibility").select("user_id,visibility,passport_enabled,passport_slug,open_to_relocation,open_to_internships,open_to_graduate_programs,preferred_work_mode,salary_expectation").eq("organization_id", organizationId).in("user_id", ids.slice(0, 1000));
  if (error) return map;
  for (const row of data || []) map.set(String(row.user_id), row as any);
  return map;
}

async function loadCandidates(requestUrl: URL, org: string, key: string, secret: string): Promise<MarketplaceCandidate[]> {
  const client = db();
  const candidates = await cohortCandidates(requestUrl.origin, org, key, secret);
  const visibility = await getVisibility(client, org, candidates.map((c) => c.userId));
  return candidates.map((c) => {
    const v = visibility.get(c.userId);
    return v ? {
      ...c,
      visibility: v.visibility,
      passportEnabled: Boolean(v.passport_enabled),
      passportSlug: v.passport_slug || c.passportSlug,
      openToRelocation: Boolean(v.open_to_relocation ?? c.openToRelocation),
      openToInternships: Boolean(v.open_to_internships ?? c.openToInternships),
      openToGraduatePrograms: Boolean(v.open_to_graduate_programs ?? c.openToGraduatePrograms),
      preferredWorkMode: (v.preferred_work_mode as any) || c.preferredWorkMode,
      salaryExpectation: v.salary_expectation || c.salaryExpectation,
    } : c;
  });
}

async function getCampaign(client: DbClient, org: string, campaignId: string): Promise<HiringCampaign | null> {
  if (!client || !campaignId) return null;
  const { data, error } = await client.from("hiring_campaigns").select("*").eq("organization_id", org).eq("id", campaignId).maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    organizationId: data.organization_id,
    employerName: data.employer_name,
    title: data.title,
    jobDescription: data.job_description,
    role: data.role,
    industry: data.industry,
    location: data.location,
    country: data.country,
    city: data.city,
    remote: Boolean(data.remote),
    languages: data.languages || [],
    experienceLevel: data.experience_level,
    skills: data.skills || [],
    status: data.status,
    targetHires: data.target_hires,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function campaignFromBody(org: string, body: any): HiringCampaign {
  const jd = String(body.jobDescription || body.job_description || "");
  return {
    id: String(body.id || body.campaignId || randomUUID()),
    organizationId: org,
    employerName: String(body.employerName || body.employer_name || "Hiring Partner"),
    title: String(body.title || inferRoleFromJD(jd)),
    jobDescription: jd,
    role: String(body.role || inferRoleFromJD(jd)),
    industry: String(body.industry || inferIndustryFromJD(jd)),
    location: String(body.location || "Remote / flexible"),
    country: String(body.country || ""),
    city: String(body.city || ""),
    remote: Boolean(body.remote ?? true),
    languages: toArray(body.languages),
    experienceLevel: String(body.experienceLevel || body.experience_level || "Junior"),
    skills: toArray(body.skills).length ? toArray(body.skills) : extractSkillsFromJD(jd),
    status: (body.status || "active") as CampaignStatus,
    targetHires: Number(body.targetHires || body.target_hires || 1),
    createdAt: new Date().toISOString(),
  };
}

async function saveCampaign(client: DbClient, campaign: HiringCampaign) {
  if (!client) return { ok: true, offline: true, campaign };
  const { error } = await client.from("hiring_campaigns").upsert({
    id: campaign.id,
    organization_id: campaign.organizationId,
    employer_name: campaign.employerName,
    title: campaign.title,
    job_description: campaign.jobDescription,
    role: campaign.role,
    industry: campaign.industry,
    location: campaign.location,
    country: campaign.country,
    city: campaign.city,
    remote: campaign.remote,
    languages: campaign.languages,
    experience_level: campaign.experienceLevel,
    skills: campaign.skills,
    status: campaign.status,
    target_hires: campaign.targetHires,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });
  return { ok: !error, error: error?.message, campaign };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { org, key, secret, ok } = authorized(url);
  if (!ok) return json({ ok: false, error: "unauthorized" }, 401);
  const client = db();
  const view = url.searchParams.get("view") || "dashboard";

  if (view === "campaigns") {
    if (!client) return json({ ok: true, campaigns: [], offline: true });
    const { data, error } = await client.from("hiring_campaigns").select("*").eq("organization_id", org).order("created_at", { ascending: false });
    return json({ ok: !error, campaigns: data || [], error: error?.message });
  }

  if (view === "activity") {
    if (!client) return json({ ok: true, activity: [], offline: true });
    const { data, error } = await client.from("marketplace_activity_log").select("*").eq("organization_id", org).order("created_at", { ascending: false }).limit(100);
    return json({ ok: !error, activity: data || [], error: error?.message });
  }

  const candidates = await loadCandidates(url, org, key, secret);

  if (view === "candidate") {
    const id = url.searchParams.get("id") || "";
    const candidate = candidates.find((c) => c.id === id || c.userId === id || c.passportSlug === id);
    if (!candidate) return json({ ok: false, error: "candidate_not_found" }, 404);
    let notes: any[] = [];
    let shortlists: any[] = [];
    if (client) {
      const [{ data: notesData }, { data: shortlistData }] = await Promise.all([
        client.from("recruiter_notes").select("*").eq("organization_id", org).eq("candidate_user_id", candidate.userId).order("created_at", { ascending: false }),
        client.from("marketplace_shortlists").select("*").eq("organization_id", org).eq("candidate_user_id", candidate.userId).order("created_at", { ascending: false }),
      ]);
      notes = notesData || [];
      shortlists = shortlistData || [];
    }
    return json({ ok: true, candidate, notes, shortlists });
  }

  if (view === "passport") {
    const id = url.searchParams.get("id") || "";
    const candidate = candidates.find((c) => c.id === id || c.userId === id || c.passportSlug === id);
    if (!candidate || !candidate.passportEnabled || candidate.visibility === "private") return json({ ok: false, error: "passport_not_available" }, 404);
    return json({ ok: true, candidate: { ...candidate, email: undefined } });
  }

  if (view === "shortlists") {
    if (!client) return json({ ok: true, shortlists: [], offline: true });
    const campaignId = url.searchParams.get("campaignId");
    let query = client.from("marketplace_shortlists").select("*").eq("organization_id", org).order("created_at", { ascending: false });
    if (campaignId) query = query.eq("campaign_id", campaignId);
    const { data, error } = await query;
    return json({ ok: !error, shortlists: data || [], error: error?.message });
  }

  if (view === "notes") {
    if (!client) return json({ ok: true, notes: [], offline: true });
    const candidateId = url.searchParams.get("candidateId") || "";
    let query = client.from("recruiter_notes").select("*").eq("organization_id", org).order("created_at", { ascending: false });
    if (candidateId) query = query.eq("candidate_user_id", candidateId);
    const { data, error } = await query.limit(200);
    return json({ ok: !error, notes: data || [], error: error?.message });
  }

  if (view === "export") {
    const campaignId = url.searchParams.get("campaignId") || "";
    let exportCandidates = candidates.filter((c) => c.visibility !== "private");
    if (campaignId) {
      const campaign = await getCampaign(client, org, campaignId);
      if (campaign) exportCandidates = exportCandidates.map((c) => ({ ...c, _match: calculateTalentMatch(c, campaign) } as any)).sort((a: any, b: any) => b._match.matchScore - a._match.matchScore);
    }
    const rows = exportCandidates.map((c: any) => [c.name, c.role, c.wiri, c._match?.matchScore || "", c.location, c.availability, c.verified ? "yes" : "no", c.skills.join("; "), c.languages.join("; "), c.summary]);
    const csv = [["Name", "Role", "WIRI", "Match", "Location", "Availability", "Verified", "Skills", "Languages", "Summary"], ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
    return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="workzo-talent-export-${org}.csv"` } });
  }

  const filters: MarketplaceFilters = {
    q: url.searchParams.get("q") || undefined,
    role: url.searchParams.get("role") || undefined,
    location: url.searchParams.get("location") || undefined,
    country: url.searchParams.get("country") || undefined,
    city: url.searchParams.get("city") || undefined,
    minWiri: Number(url.searchParams.get("minWiri") || 0) || undefined,
    minConfidence: Number(url.searchParams.get("minConfidence") || 0) || undefined,
    minCommunication: Number(url.searchParams.get("minCommunication") || 0) || undefined,
    minTechnical: Number(url.searchParams.get("minTechnical") || 0) || undefined,
    verifiedOnly: url.searchParams.get("verifiedOnly") === "true",
    skills: toArray(url.searchParams.get("skills")),
    languages: toArray(url.searchParams.get("languages")),
    availability: url.searchParams.get("availability") || undefined,
    experienceLevel: url.searchParams.get("experienceLevel") || undefined,
    visaStatus: url.searchParams.get("visaStatus") || undefined,
    openToRelocation: url.searchParams.get("openToRelocation") === "true" ? true : undefined,
    openToInternships: url.searchParams.get("openToInternships") === "true" ? true : undefined,
    openToGraduatePrograms: url.searchParams.get("openToGraduatePrograms") === "true" ? true : undefined,
  };
  const filtered = filterCandidates(candidates, filters);
  const employerVisibleCandidates = filtered.filter((c) => c.visibility === "verified_employers" || c.visibility === "organization");
  const stats = {
    candidates: candidates.length,
    filtered: filtered.length,
    employerVisible: employerVisibleCandidates.length,
    employerReady: filtered.filter((c) => c.wiri >= 90).length,
    readyMinorCoaching: filtered.filter((c) => c.wiri >= 80 && c.wiri < 90).length,
    verified: filtered.filter((c) => c.verified).length,
    averageWiri: filtered.length ? Math.round(filtered.reduce((s, c) => s + c.wiri, 0) / filtered.length) : 0,
    averageImprovement: filtered.length ? Math.round(filtered.reduce((s, c) => s + c.improvement, 0) / filtered.length) : 0,
  };
  return json({ ok: true, org, candidates: filtered, employerVisibleCandidates, stats, filters });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const { org, key, secret, ok } = authorized(url);
  if (!ok) return json({ ok: false, error: "unauthorized" }, 401);
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "match_candidates");
  const client = db();

  if (action === "create_campaign" || action === "update_campaign") {
    const campaign = campaignFromBody(org, body);
    const result = await saveCampaign(client, campaign);
    await logActivity(client, { organizationId: org, action, entityType: "campaign", entityId: campaign.id, metadata: { title: campaign.title, role: campaign.role } });
    return json(result);
  }

  if (action === "delete_campaign") {
    if (!client) return json({ ok: false, error: "supabase_not_configured" }, 200);
    const campaignId = String(body.campaignId || body.id || "");
    const { error } = await client.from("hiring_campaigns").delete().eq("organization_id", org).eq("id", campaignId);
    await logActivity(client, { organizationId: org, action: "delete_campaign", entityType: "campaign", entityId: campaignId });
    return json({ ok: !error, error: error?.message });
  }

  if (action === "match_candidates" || action === "generate_shortlist") {
    let campaign = body.campaignId ? await getCampaign(client, org, String(body.campaignId)) : null;
    if (!campaign) campaign = campaignFromBody(org, body);
    const candidates = await loadCandidates(url, org, key, secret);
    const eligible = candidates.filter((c) => c.visibility === "verified_employers" || c.visibility === "organization");
    const matches = eligible.map((candidate) => calculateTalentMatch(candidate, campaign!)).sort((a, b) => b.matchScore - a.matchScore);
    const limit = Math.max(1, Math.min(50, Number(body.limit || 10)));
    const selected = action === "generate_shortlist" ? matches.slice(0, limit) : matches;
    if (action === "generate_shortlist" && client) {
      for (const m of selected) {
        await client.from("marketplace_shortlists").upsert({
          organization_id: org,
          campaign_id: campaign.id === "adhoc" ? null : campaign.id,
          candidate_user_id: m.candidate.userId,
          status: "shortlisted",
          match_score: m.matchScore,
          reasons: m.reasons,
          cautions: m.cautions,
          updated_at: new Date().toISOString(),
        }, { onConflict: "organization_id,campaign_id,candidate_user_id" });
      }
      await logActivity(client, { organizationId: org, action: "generate_shortlist", entityType: "campaign", entityId: campaign.id, metadata: { count: selected.length } });
      // Outbound notification to any configured Slack/Teams/ATS webhook.
      await dispatchNotification({
        db: client,
        organizationId: org,
        event: "shortlist_generated",
        title: `📋 New shortlist — ${selected.length} candidates for ${campaign.role || campaign.title || "an open role"}`,
        lines: [
          `Campaign: ${campaign.title || campaign.role || "Ad-hoc"}`,
          `Top match: ${selected[0]?.candidate?.name || "—"}${selected[0] ? ` (${selected[0].matchScore})` : ""}`,
        ],
        url: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/admin/marketplace?org=${encodeURIComponent(org)}` : null,
        entityType: "campaign",
        entityId: campaign.id,
      });
    }
    return json({
      ok: true,
      campaign,
      summary: { total: matches.length, excellent: matches.filter((m) => m.band === "excellent").length, strong: matches.filter((m) => m.band === "strong").length, good: matches.filter((m) => m.band === "good").length, low: matches.filter((m) => m.band === "low").length },
      matches: selected,
    });
  }

  if (action === "shortlist" || action === "update_shortlist_status") {
    if (!client) return json({ ok: false, error: "supabase_not_configured" }, 200);
    const candidateId = String(body.candidateId || body.candidate_user_id || "");
    const campaignId = body.campaignId || body.campaign_id || null;
    const status = String(body.status || "shortlisted") as ShortlistStatus;
    const { data, error } = await client.from("marketplace_shortlists").upsert({
      organization_id: org,
      campaign_id: campaignId,
      candidate_user_id: candidateId,
      status,
      match_score: body.matchScore ?? body.match_score ?? null,
      reasons: body.reasons || [],
      cautions: body.cautions || [],
      updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id,campaign_id,candidate_user_id" }).select("*").maybeSingle();
    await logActivity(client, { organizationId: org, action, entityType: "shortlist", entityId: data?.id, metadata: { candidateId, campaignId, status } });
    return json({ ok: !error, shortlist: data, error: error?.message });
  }

  if (action === "remove_shortlist") {
    if (!client) return json({ ok: false, error: "supabase_not_configured" }, 200);
    const id = String(body.id || "");
    const { error } = await client.from("marketplace_shortlists").delete().eq("organization_id", org).eq("id", id);
    await logActivity(client, { organizationId: org, action, entityType: "shortlist", entityId: id });
    return json({ ok: !error, error: error?.message });
  }

  if (action === "note") {
    if (!client) return json({ ok: false, error: "supabase_not_configured" }, 200);
    const candidateId = String(body.candidateId || body.candidate_user_id || "");
    const { data, error } = await client.from("recruiter_notes").insert({ organization_id: org, candidate_user_id: candidateId, note: String(body.note || ""), visibility: String(body.visibility || "private"), created_by: String(body.createdBy || "marketplace") }).select("*").maybeSingle();
    await logActivity(client, { organizationId: org, action: "note", entityType: "candidate", entityId: candidateId });
    return json({ ok: !error, note: data, error: error?.message });
  }

  if (action === "delete_note") {
    if (!client) return json({ ok: false, error: "supabase_not_configured" }, 200);
    const id = String(body.id || "");
    const { error } = await client.from("recruiter_notes").delete().eq("organization_id", org).eq("id", id);
    await logActivity(client, { organizationId: org, action: "delete_note", entityType: "note", entityId: id });
    return json({ ok: !error, error: error?.message });
  }

  if (action === "visibility") {
    if (!client) return json({ ok: false, error: "supabase_not_configured" }, 200);
    const candidateId = String(body.candidateId || body.userId || "");
    const visibility = (body.visibility || "private") as MarketplaceVisibility;
    const passportEnabled = Boolean(body.passportEnabled ?? body.passport_enabled);
    const passportSlug = String(body.passportSlug || body.passport_slug || candidateId);
    const { data, error } = await client.from("talent_visibility").upsert({
      user_id: candidateId,
      organization_id: org,
      visibility,
      passport_enabled: passportEnabled,
      passport_slug: passportSlug,
      open_to_relocation: Boolean(body.openToRelocation ?? body.open_to_relocation),
      open_to_internships: Boolean(body.openToInternships ?? body.open_to_internships),
      open_to_graduate_programs: Boolean(body.openToGraduatePrograms ?? body.open_to_graduate_programs ?? true),
      preferred_work_mode: String(body.preferredWorkMode || body.preferred_work_mode || "flexible"),
      salary_expectation: String(body.salaryExpectation || body.salary_expectation || ""),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,organization_id" }).select("*").maybeSingle();
    await logActivity(client, { organizationId: org, action: "visibility", entityType: "candidate", entityId: candidateId, metadata: { visibility, passportEnabled } });
    return json({ ok: !error, visibility: data, error: error?.message });
  }

  if (action === "compare") {
    const ids: string[] = Array.isArray(body.candidateIds) ? body.candidateIds.slice(0, 5).map(String) : [];
    const candidates = await loadCandidates(url, org, key, secret);
    const selected = candidates.filter((c) => ids.includes(c.id) || ids.includes(c.userId));
    const comparison = selected.map((c) => ({ id: c.id, name: c.name, role: c.role, wiri: c.wiri, skills: c.skills, languages: c.languages, confidence: c.competencySnapshot.confidence || 0, communication: c.competencySnapshot.communication || 0, technical: c.competencySnapshot.technical || c.competencySnapshot.evidenceImpact || 0, evidence: c.competencySnapshot.evidenceImpact || 0, jobFit: c.competencySnapshot.jobFit || 0, improvement: c.improvement, consistency: c.consistency, risks: c.risks, recommendation: c.wiri >= 85 ? "Shortlist" : "Coach first" }));
    return json({ ok: true, candidates: selected, comparison, copilot: selected.length ? buildCopilotOutput(selected[0], "comparison", { comparison: selected }) : [] });
  }

  if (action === "copilot") {
    const candidate = body.candidate as MarketplaceCandidate | null;
    const candidateId = String(body.candidateId || "");
    let resolved = candidate;
    if (!resolved && candidateId) {
      const candidates = await loadCandidates(url, org, key, secret);
      resolved = candidates.find((c) => c.id === candidateId || c.userId === candidateId) || null;
    }
    if (!resolved) return json({ ok: false, error: "candidate_required" }, 400);
    const mode = String(body.mode || "summary") as CopilotMode;
    const output = buildCopilotOutput(resolved, mode, { role: body.role, jd: body.jobDescription });
    await logActivity(client, { organizationId: org, action: `copilot_${mode}`, entityType: "candidate", entityId: resolved.userId });
    return json({ ok: true, mode, output });
  }

  if (action === "integration_config") {
    if (!client) return json({ ok: false, error: "supabase_not_configured" }, 200);
    const { data, error } = await client.from("marketplace_integrations").upsert({
      organization_id: org,
      provider: String(body.provider || "custom"),
      status: String(body.status || "configured"),
      config: body.config || {},
      updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id,provider" }).select("*").maybeSingle();
    await logActivity(client, { organizationId: org, action: "integration_config", entityType: "integration", entityId: data?.id, metadata: { provider: body.provider } });
    return json({ ok: !error, integration: data, error: error?.message });
  }

  return json({ ok: false, error: "unknown_action" }, 400);
}
