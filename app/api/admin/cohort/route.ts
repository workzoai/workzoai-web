import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LearnerStatus = "ready" | "improving" | "at-risk";
type ReadinessBand = "90+" | "80-89" | "70-79" | "60-69" | "below-60";
type WiriTier = "employer-ready" | "minor-coaching" | "needs-improvement" | "early-stage";

type Learner = {
  id: string;
  name: string;
  role: string;
  sessions: number;
  readiness: number;
  trend: number;
  lastActive: string;
  status: LearnerStatus;
  readinessBand: ReadinessBand;
  wiri: number;
  wiriTier: WiriTier;
  wiriBreakdown: Record<string, number>;
  skills: string[];
  languages: string[];
  availability: string;
  location: string;
  verified: boolean;
  matchSummary: string;
  competencySnapshot: Record<string, number>;
};

type CompetencyMetric = { key: string; label: string; score: number; count: number; risk: "strong" | "watch" | "critical" };
type FailureSignal = { label: string; percent: number; count: number; severity: "high" | "medium" | "low"; suggestedAction: string };
type CurriculumInsight = { weakCompetency: string; affectedPercent: number; affectedStudents: number; suggestedAction: string; expectedImpact: string };
type DepartmentMetric = { department: string; readiness: number; students: number; sessions: number };
type TalentSegment = { label: string; count: number; percent: number; description: string };
type CompanyTemplate = { company: string; rounds: string[]; focus: string[]; difficulty: "Medium" | "High" | "Very High"; bestFor: string[] };
type WiriTierMetric = { key: WiriTier; label: string; range: string; count: number; percent: number; description: string };
type WiriMetric = { key: string; label: string; score: number; count: number; weight: number; source: string; risk: "strong" | "watch" | "critical" };

type Stats = {
  totalLearners: number;
  activeLearners: number;
  avgReadiness: number;
  avgWiri: number;
  sessionsThisMonth: number;
  atRisk: number;
  interviewReadyPercent: number;
  readyToApplyPercent: number;
  employerReadyPercent: number;
  outstandingPercent: number;
  averageImprovement: number;
};

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function orgKey(org: string): string {
  const secret = process.env.FOUNDER_ANALYTICS_SECRET || "";
  return createHmac("sha256", secret).update(`org:${org.toLowerCase().trim()}`).digest("hex").slice(0, 32);
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a || "");
  const bb = Buffer.from(b || "");
  if (ab.length !== bb.length) return false;
  try { return timingSafeEqual(ab, bb); } catch { return false; }
}

function clamp(n: unknown, fallback = 0): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function avg(nums: number[]): number {
  const clean = nums.filter((n) => Number.isFinite(n));
  return clean.length ? Math.round(clean.reduce((s, n) => s + n, 0) / clean.length) : 0;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const t = new Date(iso).getTime();
  if (!t) return "never";
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

function bandFor(score: number): ReadinessBand {
  if (score >= 90) return "90+";
  if (score >= 80) return "80-89";
  if (score >= 70) return "70-79";
  if (score >= 60) return "60-69";
  return "below-60";
}

function statusFor(readiness: number, sessions: number): LearnerStatus {
  if (sessions === 0 || readiness < 55) return "at-risk";
  if (readiness < 78) return "improving";
  return "ready";
}

function asArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((x) => String(x || "").trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function normalizeSignal(text: string): string {
  const t = text.toLowerCase();
  if (/star|situation|task|action|result|structure/.test(t)) return "Weak STAR answer structure";
  if (/sql|join|query|database|technical|code|python|java|react|api|debug/.test(t)) return "Insufficient technical depth";
  if (/business|stakeholder|kpi|impact|metric|customer|commercial/.test(t)) return "Weak business communication";
  if (/confidence|hesitat|nervous|uncertain|filler|clarity|clear/.test(t)) return "Confidence and clarity issues";
  if (/achievement|measurable|result|number|evidence|proof/.test(t)) return "Lack of measurable achievements";
  if (/leadership|ownership|initiative|conflict|team/.test(t)) return "Leadership examples need strengthening";
  return text.replace(/^[-•\s]+/, "").slice(0, 90) || "General interview weakness";
}

function actionForSignal(label: string): string {
  if (label.includes("STAR")) return "Run a STAR answer workshop with 3 role-specific examples per student.";
  if (label.includes("technical")) return "Add technical explanation drills and require candidates to explain decisions out loud.";
  if (label.includes("business")) return "Add stakeholder communication practice using KPI and customer-impact examples.";
  if (label.includes("Confidence")) return "Schedule short confidence drills: concise openings, pauses, and answer closing practice.";
  if (label.includes("measurable")) return "Ask students to rewrite CV/interview examples with numbers, scope, and outcomes.";
  if (label.includes("Leadership")) return "Use conflict, ownership, and team-influence scenarios in mock manager rounds.";
  return "Review flagged answers and create a targeted coaching activity for this theme.";
}

function getRawResult(row: any): any {
  return row?.raw_result && typeof row.raw_result === "object" ? row.raw_result : {};
}

function extractCompetencies(row: any): Record<string, number> {
  const raw = getRawResult(row);
  const score = raw?.score || raw?.scores || {};
  const rubric = raw?.computedRubric || raw?.computed_rubric || raw?.rubric || raw?.resultRubric || {};
  const evidenceQuality = row?.evidence_quality ?? raw?.answerQuality?.evidenceScore ?? raw?.evidenceQuality;

  const communication = clamp(rubric.communication ?? raw.communicationScore ?? score.communication ?? score.clarity ?? 0);
  const clarity = clamp(score.clarity ?? raw.clarityScore ?? communication);
  const confidence = clamp(score.confidence ?? raw.confidenceScore ?? 0);
  const relevance = clamp(rubric.relevance ?? raw.relevanceScore ?? score.relevance ?? 0);
  const evidence = clamp(rubric.evidenceImpact ?? raw.evidenceImpactScore ?? evidenceQuality ?? score.trust ?? 0);
  const jobFit = clamp(rubric.jobFit ?? raw.roleCompetencyScore ?? raw.jobFitScore ?? score.relevance ?? row?.overall_score ?? 0);
  const trust = clamp(score.trust ?? row?.trust_score ?? 0);
  const engagement = clamp(score.interest ?? score.engagement ?? raw.engagementScore ?? Math.round((confidence + communication) / 2));

  return {
    communication,
    clarity,
    confidence,
    relevance,
    evidenceImpact: evidence,
    jobFit,
    trust,
    engagement,
  };
}

function extractCvQuality(row: any, skills: string[], languages: string[]): number {
  const raw = getRawResult(row);
  const profile = raw?.candidateProfile || raw?.cvSummary || raw?.resume || raw?.verifiedCvData || {};
  const fields = [
    profile?.name || raw?.candidateName,
    profile?.summary || raw?.summary || raw?.professionalSummary,
    skills.length >= 3,
    languages.length >= 1,
    asArray(profile?.experience || raw?.experience).length > 0 || Boolean(profile?.yearsOfExperience),
    asArray(profile?.education || raw?.education).length > 0 || Boolean(profile?.education),
  ];
  const filled = fields.filter(Boolean).length;
  return clamp(Math.round((filled / fields.length) * 100), 60);
}

function stddev(values: number[]): number {
  const clean = values.filter((n) => Number.isFinite(n));
  if (clean.length <= 1) return 0;
  const mean = clean.reduce((s, n) => s + n, 0) / clean.length;
  const variance = clean.reduce((s, n) => s + Math.pow(n - mean, 2), 0) / clean.length;
  return Math.sqrt(variance);
}

function consistencyScore(values: number[]): number {
  if (values.length <= 1) return values.length === 1 ? 75 : 0;
  return clamp(100 - Math.round(stddev(values) * 2.2));
}

function trendScore(trend: number): number {
  return clamp(70 + trend * 2);
}

function wiriTierFor(score: number): WiriTier {
  if (score >= 90) return "employer-ready";
  if (score >= 80) return "minor-coaching";
  if (score >= 60) return "needs-improvement";
  return "early-stage";
}

function calculateWiri(input: { readiness: number; trend: number; scores: number[]; comps: Record<string, number>; cvQuality: number }): { score: number; breakdown: Record<string, number> } {
  const c = input.comps || {};
  const breakdown: Record<string, number> = {
    cvQuality: clamp(input.cvQuality, 70),
    jobFit: clamp(c.jobFit ?? c.relevance ?? input.readiness),
    interviewPerformance: clamp(input.readiness),
    communication: clamp(c.communication ?? c.clarity ?? input.readiness),
    technicalCompetency: clamp(c.evidenceImpact ?? c.trust ?? input.readiness),
    confidence: clamp(c.confidence ?? input.readiness),
    evidenceQuality: clamp(c.evidenceImpact ?? c.trust ?? input.readiness),
    improvementTrend: trendScore(input.trend),
    interviewConsistency: consistencyScore(input.scores),
  };
  const weights: Record<string, number> = {
    cvQuality: 0.10,
    jobFit: 0.15,
    interviewPerformance: 0.18,
    communication: 0.14,
    technicalCompetency: 0.12,
    confidence: 0.10,
    evidenceQuality: 0.10,
    improvementTrend: 0.06,
    interviewConsistency: 0.05,
  };
  const score = Math.round(Object.entries(weights).reduce((sum, [key, weight]) => sum + (breakdown[key] || 0) * weight, 0));
  return { score: clamp(score), breakdown };
}

function wiriLabel(key: string): string {
  const labels: Record<string, string> = {
    cvQuality: "CV Quality",
    jobFit: "Job Fit",
    interviewPerformance: "Interview Performance",
    communication: "Communication",
    technicalCompetency: "Technical Competency",
    confidence: "Confidence",
    evidenceQuality: "Evidence Quality",
    improvementTrend: "Improvement Trend",
    interviewConsistency: "Interview Consistency",
  };
  return labels[key] || key;
}

function extractSkills(row: any): string[] {
  const raw = getRawResult(row);
  const pools = [
    raw?.skills,
    raw?.candidateProfile?.skills,
    raw?.cvSummary?.skills,
    raw?.resume?.skills,
    raw?.verifiedCvData?.skills,
  ];
  const skills = pools.flatMap(asArray).map((s) => s.replace(/^technical:\s*/i, "").trim()).filter(Boolean);
  return [...new Set(skills)].slice(0, 8);
}

function extractLanguages(row: any): string[] {
  const raw = getRawResult(row);
  const pools = [raw?.languages, raw?.candidateProfile?.languages, raw?.cvSummary?.languages, raw?.resume?.languages];
  const langs = pools.flatMap(asArray);
  return [...new Set(langs)].slice(0, 5);
}

function extractLocation(row: any): string {
  const raw = getRawResult(row);
  return String(raw?.location || raw?.candidateProfile?.location || raw?.cvSummary?.location || "Remote / flexible");
}

function extractAvailability(row: any): string {
  const raw = getRawResult(row);
  return String(raw?.availability || raw?.candidateProfile?.availability || "Available on request");
}

function summaryFor(readiness: number, comps: Record<string, number>, role: string): string {
  const strengths = Object.entries(comps).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k);
  const weak = Object.entries(comps).sort((a, b) => a[1] - b[1])[0]?.[0] || "evidence";
  if (readiness >= 85) return `Strong ${role || "candidate"}; strongest signals: ${strengths.join(", ")}. Review ${weak} in the next round.`;
  if (readiness >= 70) return `Promising ${role || "candidate"}; interview-ready with targeted coaching on ${weak}.`;
  return `Needs coaching before employer exposure; prioritize ${weak} and structured answer practice.`;
}

function emptyStats(): Stats {
  return { totalLearners: 0, activeLearners: 0, avgReadiness: 0, avgWiri: 0, sessionsThisMonth: 0, atRisk: 0, interviewReadyPercent: 0, readyToApplyPercent: 0, employerReadyPercent: 0, outstandingPercent: 0, averageImprovement: 0 };
}

function companyTemplates(): CompanyTemplate[] {
  return [
    { company: "SAP", rounds: ["Screening", "Technical / case", "Manager round", "Final HR"], focus: ["Business process thinking", "Stakeholder communication", "Enterprise software", "Structured examples"], difficulty: "High", bestFor: ["Consulting", "Customer Success", "Data", "Software"] },
    { company: "Amazon", rounds: ["Recruiter screen", "Functional interview", "Leadership principles", "Bar raiser style"], focus: ["Ownership", "Metrics", "Customer obsession", "STAR depth"], difficulty: "Very High", bestFor: ["Operations", "Data", "Product", "Engineering"] },
    { company: "Bosch", rounds: ["HR screen", "Technical team", "Manager round"], focus: ["Engineering mindset", "Quality", "Cross-functional work", "German/English communication"], difficulty: "High", bestFor: ["Engineering", "IT", "Data", "Manufacturing"] },
    { company: "Deloitte", rounds: ["HR screen", "Case round", "Manager round", "Partner-style final"], focus: ["Client communication", "Business reasoning", "Structured problem solving", "Executive presence"], difficulty: "High", bestFor: ["Consulting", "Analytics", "Business", "Technology"] },
    { company: "Generic German Mittelstand", rounds: ["HR screen", "Department interview", "Practical scenario", "Final decision"], focus: ["Reliability", "Role fit", "German workplace communication", "Hands-on examples"], difficulty: "Medium", bestFor: ["IT Support", "Admin", "Customer Success", "Sales"] },
  ];
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const org = (url.searchParams.get("org") || "").toLowerCase().trim();
  const code = (url.searchParams.get("code") || "").trim();
  const key = url.searchParams.get("key") || "";
  const secret = url.searchParams.get("secret") || "";
  const orgId = org || code;

  const founderSecret = process.env.FOUNDER_ANALYTICS_SECRET || "";
  const isFounder = founderSecret.length > 0 && safeEqual(secret, founderSecret);

  if (url.searchParams.get("issueKey") === "1") {
    if (!isFounder) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (!orgId) return NextResponse.json({ error: "provide ?org= or ?code=" }, { status: 400 });
    return NextResponse.json({ org: orgId, key: orgKey(orgId), link: `/admin?org=${encodeURIComponent(orgId)}&key=${orgKey(orgId)}` });
  }

  if (url.searchParams.get("selfTest") === "1") {
    if (!isFounder) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const checks: Record<string, unknown> = {
      env_supabase_url: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      env_service_role_key: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      env_founder_secret: Boolean(process.env.FOUNDER_ANALYTICS_SECRET),
    };
    const db = serviceClient();
    if (!db) return NextResponse.json({ ok: false, checks, error: "service client not configured" });
    const { count, error: cErr } = await db.from("interview_sessions").select("id", { count: "exact", head: true });
    checks.can_query_interview_sessions = !cErr;
    checks.total_sessions = count ?? 0;
    if (cErr) checks.sessions_error = cErr.message;
    const { error: ocErr } = await db.from("interview_sessions").select("org_code").limit(1);
    checks.org_code_column_exists = !ocErr;
    return NextResponse.json({ ok: true, ready: checks.can_query_interview_sessions === true, checks });
  }

  if (!orgId) return NextResponse.json({ error: "missing_org" }, { status: 400 });
  const authorized = isFounder || (key.length > 0 && safeEqual(key, orgKey(orgId)));
  if (!authorized) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = serviceClient();
  if (!db) return NextResponse.json({ error: "not_configured", configured: false }, { status: 200 });

  try {
    let userIds: string[] | null = null;
    const idToName = new Map<string, string>();
    const idToEmail = new Map<string, string>();

    if (org) {
      const ids: string[] = [];
      for (let page = 1; page <= 20; page++) {
        const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
        if (error || !data?.users?.length) break;
        for (const u of data.users) {
          const email = (u.email || "").toLowerCase();
          if (email.endsWith(`@${org}`) || email.endsWith(`.${org}`)) {
            ids.push(u.id);
            idToEmail.set(u.id, email);
            const meta = (u.user_metadata || {}) as Record<string, unknown>;
            const nm = (meta.full_name as string) || (meta.name as string) || email.split("@")[0];
            idToName.set(u.id, nm);
          }
        }
        if (data.users.length < 1000) break;
      }
      userIds = ids;
      if (ids.length === 0) {
        return NextResponse.json({ ok: true, org: orgId, empty: true, learners: [], stats: emptyStats(), engagement: Array(14).fill(0), heatmap: [], failureSignals: [], curriculumInsights: [], placement: [], departmentMetrics: [], talentSegments: [], companyTemplates: companyTemplates(), wiri: { average: 0, tiers: [], breakdown: [] } });
      }
    }

    let sessionQ = db
      .from("interview_sessions")
      .select("id,user_id,candidate_name,target_role,overall_score,created_at,duration_seconds")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (userIds) sessionQ = sessionQ.in("user_id", userIds);
    else if (code) sessionQ = sessionQ.eq("org_code", code);

    const { data: sessionRows, error: sessionError } = await sessionQ;
    if (sessionError) return NextResponse.json({ ok: false, error: "query_failed", detail: sessionError.message }, { status: 200 });

    const sessions = sessionRows || [];
    const sessionIds = sessions.map((s: any) => String(s.id)).filter(Boolean);
    const sessionById = new Map<string, any>(sessions.map((s: any) => [String(s.id), s]));
    const userIdSet = new Set<string>(sessions.map((s: any) => String(s.user_id)).filter(Boolean));

    let resultRows: any[] = [];
    if (sessionIds.length > 0) {
      const { data } = await db
        .from("interview_results")
        .select("id,session_id,user_id,overall_score,trust_score,evidence_quality,strengths,improvements,weak_answers,raw_result,created_at")
        .in("session_id", sessionIds)
        .order("created_at", { ascending: false })
        .limit(5000);
      resultRows = data || [];
    }

    // Fallback for older/orphaned result rows, scoped by user id when possible.
    if (userIdSet.size > 0) {
      const ids = [...userIdSet].slice(0, 1000);
      const { data } = await db
        .from("interview_results")
        .select("id,session_id,user_id,overall_score,trust_score,evidence_quality,strengths,improvements,weak_answers,raw_result,created_at")
        .in("user_id", ids)
        .order("created_at", { ascending: false })
        .limit(5000);
      const seen = new Set(resultRows.map((r) => String(r.id)));
      for (const r of data || []) if (!seen.has(String(r.id))) resultRows.push(r);
    }

    const now = Date.now();
    type Agg = { id: string; name: string; email: string; role: string; rows: any[]; sessions: any[]; scores: { s: number; t: number }[]; last: string | null; skills: string[]; languages: string[]; location: string; availability: string; comps: Record<string, number[]> };
    const byUser = new Map<string, Agg>();

    for (const s of sessions) {
      const uid = String(s.user_id || "unknown");
      const a = byUser.get(uid) || { id: uid, name: idToName.get(uid) || String(s.candidate_name || "Learner"), email: idToEmail.get(uid) || "", role: String(s.target_role || "—"), rows: [], sessions: [], scores: [], last: null, skills: [], languages: [], location: "Remote / flexible", availability: "Available on request", comps: {} };
      a.sessions.push(s);
      const score = clamp(s.overall_score, NaN);
      if (Number.isFinite(score)) a.scores.push({ s: score, t: new Date(String(s.created_at)).getTime() || now });
      if (!a.last || new Date(String(s.created_at)).getTime() > new Date(a.last).getTime()) a.last = String(s.created_at);
      if (!a.role || a.role === "—") a.role = String(s.target_role || "—");
      byUser.set(uid, a);
    }

    const allCompetencies: Record<string, number[]> = {
      communication: [], clarity: [], confidence: [], relevance: [], evidenceImpact: [], jobFit: [], trust: [], engagement: [],
    };
    const signalCounter = new Map<string, number>();

    for (const r of resultRows) {
      const uid = String(r.user_id || sessionById.get(String(r.session_id))?.user_id || "unknown");
      const session = sessionById.get(String(r.session_id));
      const a = byUser.get(uid) || { id: uid, name: idToName.get(uid) || String(session?.candidate_name || "Learner"), email: idToEmail.get(uid) || "", role: String(session?.target_role || "—"), rows: [], sessions: [], scores: [], last: null, skills: [], languages: [], location: "Remote / flexible", availability: "Available on request", comps: {} };
      a.rows.push(r);
      const score = clamp(r.overall_score ?? session?.overall_score, NaN);
      if (Number.isFinite(score)) a.scores.push({ s: score, t: new Date(String(r.created_at || session?.created_at)).getTime() || now });
      if (!a.last || new Date(String(r.created_at)).getTime() > new Date(a.last).getTime()) a.last = String(r.created_at);
      if (!a.role || a.role === "—") a.role = String(session?.target_role || getRawResult(r)?.targetRole || getRawResult(r)?.role || "—");
      a.skills = [...new Set([...a.skills, ...extractSkills(r)])].slice(0, 10);
      a.languages = [...new Set([...a.languages, ...extractLanguages(r)])].slice(0, 6);
      a.location = extractLocation(r) || a.location;
      a.availability = extractAvailability(r) || a.availability;

      const comps = extractCompetencies(r);
      for (const [key, value] of Object.entries(comps)) {
        if (value > 0) {
          if (!a.comps[key]) a.comps[key] = [];
          a.comps[key].push(value);
          allCompetencies[key]?.push(value);
        }
      }

      for (const txt of [...asArray(r.weak_answers), ...asArray(r.improvements)]) {
        const normalized = normalizeSignal(txt);
        signalCounter.set(normalized, (signalCounter.get(normalized) || 0) + 1);
      }
      byUser.set(uid, a);
    }

    const learners: Learner[] = [...byUser.values()].map((a) => {
      const sorted = [...a.scores].sort((x, y) => y.t - x.t);
      const readiness = sorted.length ? avg(sorted.map((x) => x.s)) : 0;
      const recent = sorted.slice(0, Math.ceil(sorted.length / 2));
      const older = sorted.slice(Math.ceil(sorted.length / 2));
      const trend = older.length && recent.length ? Math.round(avg(recent.map((x) => x.s)) - avg(older.map((x) => x.s))) : 0;
      const snapshot = Object.fromEntries(Object.entries(a.comps).map(([k, vals]) => [k, avg(vals)]));
      const finalSkills = a.skills.length ? a.skills : fallbackSkillsForRole(a.role);
      const finalLanguages = a.languages.length ? a.languages : ["English"];
      const cvQuality = avg(a.rows.map((r) => extractCvQuality(r, finalSkills, finalLanguages))) || (finalSkills.length >= 3 ? 82 : 70);
      const wiriCalc = calculateWiri({ readiness, trend, scores: sorted.map((x) => x.s), comps: snapshot, cvQuality });
      return {
        id: a.id,
        name: a.name,
        role: a.role,
        sessions: Math.max(a.sessions.length, a.rows.length, sorted.length),
        readiness,
        trend,
        lastActive: relativeTime(a.last),
        status: statusFor(wiriCalc.score, Math.max(a.sessions.length, a.rows.length, sorted.length)),
        readinessBand: bandFor(wiriCalc.score),
        wiri: wiriCalc.score,
        wiriTier: wiriTierFor(wiriCalc.score),
        wiriBreakdown: wiriCalc.breakdown,
        skills: finalSkills,
        languages: finalLanguages,
        availability: a.availability,
        location: a.location,
        verified: wiriCalc.score >= 80 && Math.max(a.sessions.length, a.rows.length) >= 2,
        matchSummary: summaryFor(wiriCalc.score, snapshot, a.role),
        competencySnapshot: snapshot,
      };
    }).sort((x, y) => y.wiri - x.wiri);

    const activeLearners = learners.filter((l) => l.sessions > 0);
    const stats: Stats = {
      totalLearners: learners.length,
      activeLearners: activeLearners.length,
      avgReadiness: activeLearners.length ? avg(activeLearners.map((l) => l.readiness)) : 0,
      avgWiri: activeLearners.length ? avg(activeLearners.map((l) => l.wiri)) : 0,
      sessionsThisMonth: sessions.filter((s: any) => (now - (new Date(String(s.created_at)).getTime() || now)) <= 30 * 86400000).length,
      atRisk: learners.filter((l) => l.status === "at-risk").length,
      interviewReadyPercent: percent(learners.filter((l) => l.wiri >= 60).length, learners.length),
      readyToApplyPercent: percent(learners.filter((l) => l.wiri >= 75 && l.sessions >= 2).length, learners.length),
      employerReadyPercent: percent(learners.filter((l) => l.wiri >= 80 && l.sessions >= 2).length, learners.length),
      outstandingPercent: percent(learners.filter((l) => l.wiri >= 90).length, learners.length),
      averageImprovement: avg(activeLearners.map((l) => l.trend).filter((n) => n > 0)),
    };

    const engagement = Array(14).fill(0);
    for (const r of sessions) {
      const ago = Math.floor((now - (new Date(String(r.created_at)).getTime() || now)) / 86400000);
      if (ago >= 0 && ago < 14) engagement[13 - ago]++;
    }

    const labelMap: Record<string, string> = {
      communication: "Communication", clarity: "Clarity", confidence: "Confidence", relevance: "Role Relevance", evidenceImpact: "Evidence & Impact", jobFit: "Job Fit", trust: "Trust Signal", engagement: "Engagement",
    };
    const heatmap: CompetencyMetric[] = Object.entries(allCompetencies)
      .map(([key, values]) => ({ key, label: labelMap[key] || key, score: avg(values), count: values.length, risk: riskFor(avg(values)) }))
      .filter((m) => m.count > 0)
      .sort((a, b) => a.score - b.score);

    const denominator = Math.max(1, resultRows.length || sessions.length || learners.length);
    const failureSignals: FailureSignal[] = [...signalCounter.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, count]) => ({ label, count, percent: percent(count, denominator), severity: count / denominator >= 0.35 ? "high" : count / denominator >= 0.2 ? "medium" : "low", suggestedAction: actionForSignal(label) }));

    const weakest = [...heatmap].sort((a, b) => a.score - b.score).slice(0, 4);
    const curriculumInsights: CurriculumInsight[] = weakest.map((m) => ({
      weakCompetency: m.label,
      affectedPercent: percent(learners.filter((l) => clamp(l.competencySnapshot[m.key]) > 0 && clamp(l.competencySnapshot[m.key]) < 70).length, learners.length),
      affectedStudents: learners.filter((l) => clamp(l.competencySnapshot[m.key]) > 0 && clamp(l.competencySnapshot[m.key]) < 70).length,
      suggestedAction: curriculumActionFor(m.label),
      expectedImpact: m.score < 60 ? "+12–18% readiness" : "+7–12% readiness",
    }));

    const departmentMetrics = departmentFromLearners(learners);
    const wiriTiers: WiriTierMetric[] = [
      { key: "employer-ready", label: "Employer Ready", range: "WIRI 90+", count: learners.filter((l) => l.wiri >= 90).length, percent: percent(learners.filter((l) => l.wiri >= 90).length, learners.length), description: "Ready to share with hiring partners first." },
      { key: "minor-coaching", label: "Ready with Minor Coaching", range: "WIRI 80–89", count: learners.filter((l) => l.wiri >= 80 && l.wiri < 90).length, percent: percent(learners.filter((l) => l.wiri >= 80 && l.wiri < 90).length, learners.length), description: "Strong candidates who need one final polish round." },
      { key: "needs-improvement", label: "Needs Improvement", range: "WIRI 60–79", count: learners.filter((l) => l.wiri >= 60 && l.wiri < 80).length, percent: percent(learners.filter((l) => l.wiri >= 60 && l.wiri < 80).length, learners.length), description: "Needs targeted coaching before employer exposure." },
      { key: "early-stage", label: "Early Preparation Stage", range: "WIRI <60", count: learners.filter((l) => l.wiri < 60).length, percent: percent(learners.filter((l) => l.wiri < 60).length, learners.length), description: "Needs foundational interview practice first." },
    ];

    const wiriWeights: Record<string, number> = { cvQuality: 10, jobFit: 15, interviewPerformance: 18, communication: 14, technicalCompetency: 12, confidence: 10, evidenceQuality: 10, improvementTrend: 6, interviewConsistency: 5 };
    const wiriBreakdown: WiriMetric[] = Object.keys(wiriWeights).map((key) => {
      const values = learners.map((l) => l.wiriBreakdown?.[key]).filter((n): n is number => Number.isFinite(n));
      const score = avg(values);
      const source = key === "jobFit" || key === "communication" || key === "evidenceQuality"
        ? "computedRubric when available, historical recruiter-signal fallback"
        : key === "cvQuality"
          ? "CV completeness heuristic until dedicated CV score is available"
          : key === "improvementTrend" || key === "interviewConsistency"
            ? "sequential interview history"
            : "existing interview result fields";
      return { key, label: wiriLabel(key), score, count: values.length, weight: wiriWeights[key], source, risk: riskFor(score) };
    }).filter((m) => m.count > 0);

    const talentSegments: TalentSegment[] = [
      { label: "Outstanding candidates", count: learners.filter((l) => l.wiri >= 90).length, percent: stats.outstandingPercent, description: "Best candidates to share first with hiring partners." },
      { label: "Employer ready", count: learners.filter((l) => l.wiri >= 80 && l.sessions >= 2).length, percent: stats.employerReadyPercent, description: "Ready for employer interviews with light final review." },
      { label: "Ready to apply", count: learners.filter((l) => l.wiri >= 75 && l.sessions >= 2).length, percent: stats.readyToApplyPercent, description: "Can start applications while continuing practice." },
      { label: "Need coaching", count: stats.atRisk, percent: percent(stats.atRisk, learners.length), description: "Needs intervention before placement activity." },
    ];

    const wiriDistribution = {
      employer_ready: learners.filter((l) => l.wiri >= 90).length,
      ready_minor_coaching: learners.filter((l) => l.wiri >= 80 && l.wiri < 90).length,
      needs_improvement: learners.filter((l) => l.wiri >= 60 && l.wiri < 80).length,
      early_preparation: learners.filter((l) => l.wiri < 60).length,
    };

    const heatmapVectors = Object.fromEntries(heatmap.map((m) => [m.key, m.score]));

    // Real platform-wide baseline (falls back to the prior constants only when
    // the network has no data yet, e.g. a brand-new deployment).
    const network = await computeNetworkBenchmark(db);

    return NextResponse.json({
      ok: true,
      org: orgId,
      generatedAt: new Date().toISOString(),
      learners,
      stats,
      engagement,
      heatmap,
      // New canonical WIRI payload used by the upgraded admin UI.
      wiri: { average: stats.avgWiri, tiers: wiriTiers, breakdown: wiriBreakdown },
      // Compatibility aliases for lightweight widgets and external dashboards.
      average_wiri: stats.avgWiri,
      wiri_distribution: wiriDistribution,
      heatmap_vectors: heatmapVectors,
      failureSignals,
      curriculumInsights,
      departmentMetrics,
      talentSegments,
      companyTemplates: companyTemplates(),
      recruiterBenchmark: {
        cohortReadiness: stats.avgWiri || stats.avgReadiness,
        industryReadiness: network.readiness || 77,
        cohortCommunication: heatmap.find((h) => h.key === "communication")?.score || 0,
        industryCommunication: network.communication || 74,
        cohortConfidence: heatmap.find((h) => h.key === "confidence")?.score || 0,
        industryConfidence: network.confidence || 71,
        // Honest provenance so the UI can label it correctly.
        benchmarkSource: network.sample > 0 ? "workzo_network" : "baseline",
        benchmarkSample: network.sample,
        mostFailedCompetency: heatmap[0]?.label || "Not enough data yet",
        mostSuccessfulCompetency: [...heatmap].sort((a, b) => b.score - a.score)[0]?.label || "Not enough data yet",
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: "cohort_aggregation_failed", detail: err instanceof Error ? err.message : "unknown" }, { status: 200 });
  }
}

function percent(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

// Real cross-organization benchmark ("WorkZo network") computed from a recent
// platform-wide sample, replacing the previous hardcoded 77/74/71 constants.
// Reads readiness (overall_score) and the recruiter-signal communication /
// confidence vectors that power the heatmap, so the cohort-vs-network
// comparison is apples-to-apples. Degrades to sample: 0 on a fresh DB.
async function computeNetworkBenchmark(
  db: ReturnType<typeof serviceClient>,
): Promise<{ readiness: number; communication: number; confidence: number; sample: number }> {
  if (!db) return { readiness: 0, communication: 0, confidence: 0, sample: 0 };
  try {
    const { data } = await db
      .from("interview_results")
      .select("overall_score, raw_result")
      .order("created_at", { ascending: false })
      .limit(2000);
    let rSum = 0, rN = 0, cSum = 0, cN = 0, fSum = 0, fN = 0;
    for (const row of data || []) {
      const rr = row as { overall_score?: number; raw_result?: unknown };
      const ov = Number(rr.overall_score);
      if (Number.isFinite(ov)) { rSum += Math.max(0, Math.min(100, ov)); rN += 1; }
      const sig = (rr.raw_result && typeof rr.raw_result === "object"
        ? ((rr.raw_result as Record<string, unknown>).score || {})
        : {}) as Record<string, unknown>;
      const comm = Number(sig.communication);
      if (Number.isFinite(comm)) { cSum += Math.max(0, Math.min(100, comm)); cN += 1; }
      const conf = Number(sig.confidence);
      if (Number.isFinite(conf)) { fSum += Math.max(0, Math.min(100, conf)); fN += 1; }
    }
    return {
      readiness: rN ? Math.round(rSum / rN) : 0,
      communication: cN ? Math.round(cSum / cN) : 0,
      confidence: fN ? Math.round(fSum / fN) : 0,
      sample: rN,
    };
  } catch {
    return { readiness: 0, communication: 0, confidence: 0, sample: 0 };
  }
}

function riskFor(score: number): CompetencyMetric["risk"] {
  if (score < 60) return "critical";
  if (score < 75) return "watch";
  return "strong";
}

function curriculumActionFor(label: string): string {
  if (/Communication|Clarity/.test(label)) return "Add a stakeholder communication workshop with concise answer drills.";
  if (/Confidence|Engagement/.test(label)) return "Run 10-minute confidence simulations before employer day.";
  if (/Evidence|Trust/.test(label)) return "Require measurable achievement rewrites and evidence-backed answers.";
  if (/Relevance|Job Fit/.test(label)) return "Add JD-to-answer mapping practice and company-specific mock rounds.";
  return "Create a targeted coaching session for the weakest competency.";
}

function fallbackSkillsForRole(role: string): string[] {
  const r = role.toLowerCase();
  if (/data|analyst|science/.test(r)) return ["SQL", "Python", "Dashboards"];
  if (/support|helpdesk|it/.test(r)) return ["Troubleshooting", "ITSM", "Customer Support"];
  if (/success|account/.test(r)) return ["Stakeholder Management", "Onboarding", "Communication"];
  if (/engineer|developer|software|frontend/.test(r)) return ["Problem Solving", "APIs", "Code Quality"];
  return ["Communication", "Problem Solving", "Teamwork"];
}

function departmentFromLearners(learners: Learner[]): DepartmentMetric[] {
  const buckets = new Map<string, Learner[]>();
  for (const l of learners) {
    const role = l.role.toLowerCase();
    const department = /data|analyst|science|sql|python/.test(role) ? "Data"
      : /software|engineer|developer|frontend|backend/.test(role) ? "Software"
      : /support|helpdesk|it/.test(role) ? "IT Support"
      : /success|sales|account|customer/.test(role) ? "Business / CS"
      : "General";
    buckets.set(department, [...(buckets.get(department) || []), l]);
  }
  return [...buckets.entries()].map(([department, rows]) => ({ department, readiness: avg(rows.map((r) => r.readiness)), students: rows.length, sessions: rows.reduce((s, r) => s + r.sessions, 0) })).sort((a, b) => b.readiness - a.readiness);
}
