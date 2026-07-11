"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowUpRight, BarChart3, Brain, BriefcaseBusiness, Building2,
  CalendarClock, CheckCircle2, Clock, FileText, Filter, GaugeCircle, GraduationCap,
  Languages, MapPin, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Sparkles,
  Target, TrendingUp, UserCheck, Users,
} from "lucide-react";

type Status = "ready" | "improving" | "at-risk";
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
  status: Status;
  readinessBand: ReadinessBand;
  wiri?: number;
  wiriTier?: WiriTier;
  wiriBreakdown?: Record<string, number>;
  skills: string[];
  languages: string[];
  availability: string;
  location: string;
  verified: boolean;
  matchSummary: string;
  competencySnapshot: Record<string, number>;
};

type Stats = {
  totalLearners: number;
  activeLearners: number;
  avgReadiness: number;
  avgWiri?: number;
  sessionsThisMonth: number;
  atRisk: number;
  interviewReadyPercent: number;
  readyToApplyPercent: number;
  employerReadyPercent: number;
  outstandingPercent: number;
  averageImprovement: number;
};

type Heatmap = { key: string; label: string; score: number; count: number; risk: "strong" | "watch" | "critical" };
type FailureSignal = { label: string; percent: number; count: number; severity: "high" | "medium" | "low"; suggestedAction: string };
type CurriculumInsight = { weakCompetency: string; affectedPercent: number; affectedStudents: number; suggestedAction: string; expectedImpact: string };
type DepartmentMetric = { department: string; readiness: number; students: number; sessions: number };
type TalentSegment = { label: string; count: number; percent: number; description: string };
type CompanyTemplate = { company: string; rounds: string[]; focus: string[]; difficulty: "Medium" | "High" | "Very High"; bestFor: string[] };
type WiriTierMetric = { key: WiriTier; label: string; range: string; count: number; percent: number; description: string };
type WiriMetric = { key: string; label: string; score: number; count: number; weight: number; source: string; risk: "strong" | "watch" | "critical" };
type WiriPayload = { average: number; tiers: WiriTierMetric[]; breakdown: WiriMetric[] };
type Benchmark = { cohortReadiness: number; industryReadiness: number; cohortCommunication: number; industryCommunication: number; cohortConfidence: number; industryConfidence: number; mostFailedCompetency: string; mostSuccessfulCompetency: string };

type CohortPayload = {
  org: string;
  learners: Learner[];
  stats: Stats;
  engagement: number[];
  heatmap: Heatmap[];
  wiri?: WiriPayload;
  failureSignals: FailureSignal[];
  curriculumInsights: CurriculumInsight[];
  departmentMetrics: DepartmentMetric[];
  talentSegments: TalentSegment[];
  companyTemplates: CompanyTemplate[];
  recruiterBenchmark: Benchmark;
};

const SAMPLE_LEARNERS: Learner[] = [
  { id: "1", name: "Aisha Rahman", role: "Data Analyst", sessions: 9, readiness: 92, wiri: 91, wiriTier: "employer-ready", wiriBreakdown: { cvQuality: 88, jobFit: 91, interviewPerformance: 92, communication: 86, technicalCompetency: 83, confidence: 88, evidenceQuality: 83, improvementTrend: 100, interviewConsistency: 92 }, trend: 18, lastActive: "2h ago", status: "ready", readinessBand: "90+", skills: ["SQL", "Python", "Power BI"], languages: ["English C1", "German B2"], availability: "Immediately", location: "Berlin / Remote", verified: true, matchSummary: "Excellent analytical candidate with strong SQL and clear interview evidence. Recommended for Junior Data Analyst roles.", competencySnapshot: { communication: 86, confidence: 88, evidenceImpact: 83, jobFit: 91 } },
  { id: "2", name: "Marco Feld", role: "IT Support Specialist", sessions: 7, readiness: 84, wiri: 84, wiriTier: "minor-coaching", wiriBreakdown: { cvQuality: 82, jobFit: 86, interviewPerformance: 84, communication: 82, technicalCompetency: 76, confidence: 81, evidenceQuality: 76, improvementTrend: 92, interviewConsistency: 88 }, trend: 11, lastActive: "1d ago", status: "ready", readinessBand: "80-89", skills: ["ITSM", "Windows", "O365"], languages: ["German C1", "English B2"], availability: "2 weeks", location: "Munich", verified: true, matchSummary: "Strong support profile with confident troubleshooting examples and good customer communication.", competencySnapshot: { communication: 82, confidence: 81, evidenceImpact: 76, jobFit: 86 } },
  { id: "3", name: "Chen Wei", role: "Frontend Engineer", sessions: 8, readiness: 79, wiri: 80, wiriTier: "minor-coaching", wiriBreakdown: { cvQuality: 84, jobFit: 82, interviewPerformance: 79, communication: 74, technicalCompetency: 72, confidence: 77, evidenceQuality: 72, improvementTrend: 88, interviewConsistency: 85 }, trend: 9, lastActive: "5h ago", status: "ready", readinessBand: "70-79", skills: ["React", "TypeScript", "APIs"], languages: ["English C1"], availability: "1 month", location: "Remote", verified: true, matchSummary: "Technically strong; needs slightly sharper business-impact framing for product teams.", competencySnapshot: { communication: 74, confidence: 77, evidenceImpact: 72, jobFit: 82 } },
  { id: "4", name: "Priya Nair", role: "Customer Success Manager", sessions: 5, readiness: 71, wiri: 73, wiriTier: "needs-improvement", wiriBreakdown: { cvQuality: 79, jobFit: 73, interviewPerformance: 71, communication: 78, technicalCompetency: 61, confidence: 68, evidenceQuality: 61, improvementTrend: 96, interviewConsistency: 80 }, trend: 13, lastActive: "3h ago", status: "improving", readinessBand: "70-79", skills: ["Onboarding", "Stakeholders", "CRM"], languages: ["English C1", "German B1"], availability: "Immediately", location: "Frankfurt", verified: false, matchSummary: "Promising customer-facing candidate; needs stronger measurable outcomes and leadership examples.", competencySnapshot: { communication: 78, confidence: 68, evidenceImpact: 61, jobFit: 73 } },
  { id: "5", name: "Sara Haddad", role: "Data Analyst", sessions: 2, readiness: 53, wiri: 56, wiriTier: "early-stage", wiriBreakdown: { cvQuality: 70, jobFit: 58, interviewPerformance: 53, communication: 55, technicalCompetency: 45, confidence: 49, evidenceQuality: 45, improvementTrend: 78, interviewConsistency: 74 }, trend: 4, lastActive: "6d ago", status: "at-risk", readinessBand: "below-60", skills: ["SQL", "Excel"], languages: ["English B2", "German B1"], availability: "Immediately", location: "Hamburg", verified: false, matchSummary: "Needs coaching before employer exposure; prioritize STAR structure and technical explanation depth.", competencySnapshot: { communication: 55, confidence: 49, evidenceImpact: 45, jobFit: 58 } },
];

const SAMPLE: CohortPayload = {
  org: "Spring 2026 · Data & IT cohort",
  learners: SAMPLE_LEARNERS,
  stats: { totalLearners: 184, activeLearners: 163, avgReadiness: 79, avgWiri: 81, sessionsThisMonth: 692, atRisk: 39, interviewReadyPercent: 68, readyToApplyPercent: 52, employerReadyPercent: 38, outstandingPercent: 10, averageImprovement: 23 },
  engagement: [12, 18, 9, 22, 27, 19, 31, 24, 28, 35, 30, 41, 38, 44],
  wiri: { average: 81, tiers: [
    { key: "employer-ready", label: "Employer Ready", range: "WIRI 90+", count: 18, percent: 10, description: "Ready to share with hiring partners first." },
    { key: "minor-coaching", label: "Ready with Minor Coaching", range: "WIRI 80–89", count: 42, percent: 23, description: "Strong candidates who need one final polish round." },
    { key: "needs-improvement", label: "Needs Improvement", range: "WIRI 60–79", count: 85, percent: 46, description: "Needs targeted coaching before employer exposure." },
    { key: "early-stage", label: "Early Preparation Stage", range: "WIRI <60", count: 39, percent: 21, description: "Needs foundational interview practice first." },
  ], breakdown: [
    { key: "cvQuality", label: "CV Quality", score: 82, count: 184, weight: 10, source: "CV completeness heuristic", risk: "strong" },
    { key: "jobFit", label: "Job Fit", score: 79, count: 184, weight: 15, source: "computedRubric + recruiter-signal fallback", risk: "strong" },
    { key: "interviewPerformance", label: "Interview Performance", score: 79, count: 184, weight: 18, source: "overall_score", risk: "strong" },
    { key: "communication", label: "Communication", score: 72, count: 184, weight: 14, source: "computedRubric + recruiter-signal fallback", risk: "watch" },
    { key: "technicalCompetency", label: "Technical Competency", score: 63, count: 184, weight: 12, source: "evidence quality / experience fallback", risk: "watch" },
    { key: "confidence", label: "Confidence", score: 63, count: 184, weight: 10, source: "session.score.confidence", risk: "watch" },
    { key: "evidenceQuality", label: "Evidence Quality", score: 58, count: 184, weight: 10, source: "evidence_quality + computedRubric", risk: "critical" },
    { key: "improvementTrend", label: "Improvement Trend", score: 77, count: 184, weight: 6, source: "recent vs older sessions", risk: "strong" },
    { key: "interviewConsistency", label: "Interview Consistency", score: 74, count: 184, weight: 5, source: "score variance", risk: "watch" },
  ] },
  heatmap: [
    { key: "communication", label: "Communication", score: 72, count: 151, risk: "watch" },
    { key: "confidence", label: "Confidence", score: 63, count: 151, risk: "watch" },
    { key: "evidenceImpact", label: "Evidence & Impact", score: 58, count: 151, risk: "critical" },
    { key: "jobFit", label: "Job Fit", score: 81, count: 151, risk: "strong" },
    { key: "clarity", label: "Clarity", score: 69, count: 151, risk: "watch" },
    { key: "relevance", label: "Role Relevance", score: 76, count: 151, risk: "strong" },
  ],
  failureSignals: [
    { label: "Weak STAR answer structure", percent: 41, count: 67, severity: "high", suggestedAction: "Run a STAR answer workshop with 3 role-specific examples per student." },
    { label: "Insufficient technical depth", percent: 34, count: 55, severity: "medium", suggestedAction: "Add technical explanation drills and require candidates to explain decisions out loud." },
    { label: "Weak business communication", percent: 27, count: 44, severity: "medium", suggestedAction: "Add stakeholder communication practice using KPI and customer-impact examples." },
    { label: "Confidence and clarity issues", percent: 19, count: 31, severity: "low", suggestedAction: "Schedule short confidence drills: concise openings, pauses, and answer closing practice." },
  ],
  curriculumInsights: [
    { weakCompetency: "Evidence & Impact", affectedPercent: 63, affectedStudents: 116, suggestedAction: "Require measurable achievement rewrites and evidence-backed answers.", expectedImpact: "+12–18% readiness" },
    { weakCompetency: "Confidence", affectedPercent: 41, affectedStudents: 75, suggestedAction: "Run 10-minute confidence simulations before employer day.", expectedImpact: "+7–12% readiness" },
    { weakCompetency: "Business Communication", affectedPercent: 36, affectedStudents: 66, suggestedAction: "Add a stakeholder communication workshop with KPI examples.", expectedImpact: "+8–14% readiness" },
  ],
  departmentMetrics: [
    { department: "Data", readiness: 88, students: 52, sessions: 221 },
    { department: "Software", readiness: 81, students: 48, sessions: 176 },
    { department: "IT Support", readiness: 79, students: 37, sessions: 132 },
    { department: "Business / CS", readiness: 74, students: 47, sessions: 163 },
  ],
  talentSegments: [
    { label: "Outstanding candidates", count: 18, percent: 10, description: "Best candidates to share first with hiring partners." },
    { label: "Employer ready", count: 70, percent: 38, description: "Ready for employer interviews with light final review." },
    { label: "Ready to apply", count: 96, percent: 52, description: "Can start applications while continuing practice." },
    { label: "Need coaching", count: 39, percent: 21, description: "Needs intervention before placement activity." },
  ],
  companyTemplates: [
    { company: "SAP", rounds: ["Screening", "Technical / case", "Manager round", "Final HR"], focus: ["Business process thinking", "Stakeholder communication", "Enterprise software"], difficulty: "High", bestFor: ["Consulting", "Customer Success", "Data", "Software"] },
    { company: "Amazon", rounds: ["Recruiter screen", "Functional interview", "Leadership principles", "Bar raiser style"], focus: ["Ownership", "Metrics", "Customer obsession", "STAR depth"], difficulty: "Very High", bestFor: ["Operations", "Data", "Product", "Engineering"] },
    { company: "Deloitte", rounds: ["HR screen", "Case round", "Manager round", "Final"], focus: ["Client communication", "Business reasoning", "Structured problem solving"], difficulty: "High", bestFor: ["Consulting", "Analytics", "Business"] },
  ],
  recruiterBenchmark: { cohortReadiness: 81, industryReadiness: 77, cohortCommunication: 72, industryCommunication: 74, cohortConfidence: 63, industryConfidence: 71, mostFailedCompetency: "Evidence & Impact", mostSuccessfulCompetency: "Job Fit" },
};

const statusMeta: Record<Status, { label: string; cls: string; dot: string; bg: string }> = {
  ready: { label: "Employer ready", cls: "text-success", dot: "bg-success", bg: "bg-success/10 border-success/25" },
  improving: { label: "Improving", cls: "text-warning", dot: "bg-warning", bg: "bg-warning/10 border-warning/25" },
  "at-risk": { label: "Needs coaching", cls: "text-danger", dot: "bg-danger", bg: "bg-danger/10 border-danger/25" },
};

function cx(...items: Array<string | false | null | undefined>) { return items.filter(Boolean).join(" "); }
function riskTone(risk: string) { return risk === "critical" ? "bg-danger" : risk === "watch" ? "bg-warning" : "bg-success"; }
function scoreTone(score: number) { return score >= 80 ? "text-success" : score >= 60 ? "text-warning" : "text-danger"; }

function Stat({ icon: Icon, label, value, sub, tone = "brand" }: { icon: typeof Users; label: string; value: string; sub?: string; tone?: "brand" | "success" | "warning" | "danger" }) {
  const iconCls = tone === "success" ? "bg-success/10 text-success" : tone === "warning" ? "bg-warning/10 text-warning" : tone === "danger" ? "bg-danger/10 text-danger" : "bg-brand/10 text-brand";
  return <div className="rounded-2xl border border-line bg-surface/75 p-5 shadow-sm"><div className={cx("grid h-9 w-9 place-items-center rounded-lg", iconCls)}><Icon className="h-4 w-4" /></div><p className="mt-4 text-2xl font-black tabular-nums tracking-tight">{value}</p><p className="mt-0.5 text-xs font-bold uppercase tracking-[0.12em] text-muted">{label}</p>{sub ? <p className="mt-1 text-xs text-subtle">{sub}</p> : null}</div>;
}

function SectionTitle({ icon: Icon, kicker, title, desc }: { icon: typeof Users; kicker: string; title: string; desc?: string }) {
  return <div className="mb-4 flex items-start gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand"><Icon className="h-4 w-4" /></div><div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-brand">{kicker}</p><h2 className="text-lg font-black tracking-tight text-fg">{title}</h2>{desc ? <p className="mt-0.5 text-sm text-muted">{desc}</p> : null}</div></div>;
}

function Bar({ value, tone = "bg-brand" }: { value: number; tone?: string }) {
  return <div className="h-2 overflow-hidden rounded-full bg-line"><div className={cx("h-full rounded-full", tone)} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} /></div>;
}

type EscalationRow = {
  id: string;
  candidate_name: string | null;
  role: string | null;
  severity: "low" | "medium" | "high" | "exceptional";
  status: "open" | "reviewing" | "resolved" | "dismissed";
  reason: string;
  wiri: number | null;
  note: string | null;
  flagged_by: string;
  created_at: string;
};
const SAMPLE_ESCALATIONS: EscalationRow[] = [
  { id: "s1", candidate_name: "Aisha Rahman", role: "Data Analyst", severity: "exceptional", status: "open", reason: "exceptional_candidate", wiri: 88, note: "Top of cohort, fast-track for employer intros.", flagged_by: "recruiter", created_at: new Date(Date.now() - 3600_000).toISOString() },
  { id: "s2", candidate_name: "Jonas Vogel", role: "Cloud Engineer", severity: "high", status: "reviewing", reason: "flagged_for_review", wiri: 44, note: "Strong CV, weak interview evidence, needs a human read.", flagged_by: "system", created_at: new Date(Date.now() - 26 * 3600_000).toISOString() },
  { id: "s3", candidate_name: "Priya Nair", role: "Customer Success", severity: "medium", status: "resolved", reason: "flagged_for_review", wiri: 71, note: null, flagged_by: "recruiter", created_at: new Date(Date.now() - 72 * 3600_000).toISOString() },
];

export default function CohortDashboardClient() {  const [live, setLive] = useState<CohortPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orgInput, setOrgInput] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [skillFilter, setSkillFilter] = useState("all");
  const [bandFilter, setBandFilter] = useState<"all" | ReadinessBand>("all");
  const [tab, setTab] = useState<"intelligence" | "pipeline" | "templates" | "benchmark" | "escalations">("intelligence");
  const [selected, setSelected] = useState<Learner | null>(null);
  const [jdQuery, setJdQuery] = useState("");
  const [auth, setAuth] = useState<{ org: string; key: string; secret: string } | null>(null);
  const [escalations, setEscalations] = useState<EscalationRow[]>(SAMPLE_ESCALATIONS);
  const [escBusy, setEscBusy] = useState("");

  const loadEscalations = useCallback(async (org: string, key: string, secret: string) => {
    try {
      const p = new URLSearchParams();
      if (org.includes("@") || org.includes(".")) p.set("org", org); else p.set("code", org);
      if (key) p.set("key", key);
      if (secret) p.set("secret", secret);
      const res = await fetch(`/api/admin/escalations?${p.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json?.ok && Array.isArray(json.escalations)) setEscalations(json.escalations);
    } catch { /* keep whatever is shown */ }
  }, []);

  const updateEscalation = useCallback(async (id: string, status: EscalationRow["status"]) => {
    if (!auth) { setEscalations((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e))); return; }
    setEscBusy(id);
    try {
      const p = new URLSearchParams();
      if (auth.org.includes("@") || auth.org.includes(".")) p.set("org", auth.org); else p.set("code", auth.org);
      if (auth.key) p.set("key", auth.key);
      if (auth.secret) p.set("secret", auth.secret);
      await fetch(`/api/admin/escalations?${p.toString()}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "update_status", id, status, resolvedBy: "recruiter" }),
      });
      await loadEscalations(auth.org, auth.key, auth.secret);
    } catch { /* ignore */ } finally { setEscBusy(""); }
  }, [auth, loadEscalations]);

  const loadOrg = useCallback(async (org: string, key: string, secret: string) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams();
      if (org.includes("@") || org.includes(".")) params.set("org", org); else params.set("code", org);
      if (key) params.set("key", key);
      if (secret) params.set("secret", secret);
      const res = await fetch(`/api/admin/cohort?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.error === "unauthorized" ? "That access key is not valid for this organization." : (json?.detail || "Could not load this cohort."));
      setLive({ ...SAMPLE, ...json, learners: json.learners || [], stats: json.stats || SAMPLE.stats, engagement: json.engagement || [], heatmap: json.heatmap || [], wiri: json.wiri || SAMPLE.wiri, failureSignals: json.failureSignals || [], curriculumInsights: json.curriculumInsights || [], departmentMetrics: json.departmentMetrics || [], talentSegments: json.talentSegments || [], companyTemplates: json.companyTemplates || SAMPLE.companyTemplates, recruiterBenchmark: json.recruiterBenchmark || SAMPLE.recruiterBenchmark });
      setAuth({ org, key, secret });
      void loadEscalations(org, key, secret);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cohort.");
      setLive(null);
    } finally { setLoading(false); }
  }, [loadEscalations]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const org = p.get("org") || p.get("code") || "";
    const key = p.get("key") || "";
    const secret = p.get("secret") || "";
    if (org && (key || secret)) { setOrgInput(org); void loadOrg(org, key, secret); }
  }, [loadOrg]);

  const data = live || SAMPLE;
  const isLive = !!live;
  const maxEng = Math.max(1, ...data.engagement);
  const roles = useMemo(() => ["all", ...Array.from(new Set(data.learners.map((l) => l.role).filter(Boolean))).slice(0, 20)], [data.learners]);
  const skills = useMemo(() => ["all", ...Array.from(new Set(data.learners.flatMap((l) => l.skills))).slice(0, 24)], [data.learners]);

  const filteredLearners = useMemo(() => data.learners
    .filter((l) => statusFilter === "all" || l.status === statusFilter)
    .filter((l) => roleFilter === "all" || l.role === roleFilter)
    .filter((l) => skillFilter === "all" || l.skills.includes(skillFilter))
    .filter((l) => bandFilter === "all" || l.readinessBand === bandFilter)
    .filter((l) => q ? `${l.name} ${l.role} ${l.skills.join(" ")} ${l.languages.join(" ")}`.toLowerCase().includes(q.toLowerCase()) : true)
    .sort((a, b) => (b.wiri ?? b.readiness) - (a.wiri ?? a.readiness)), [data.learners, statusFilter, roleFilter, skillFilter, bandFilter, q]);

  const aiMatches = useMemo(() => {
    const terms = jdQuery.toLowerCase().split(/[^a-z0-9+#.]+/).filter((t) => t.length > 1);
    if (!terms.length) return filteredLearners.slice(0, 6);
    return [...filteredLearners].map((l) => {
      const hay = `${l.role} ${l.skills.join(" ")} ${l.languages.join(" ")} ${l.matchSummary}`.toLowerCase();
      const hits = terms.filter((t) => hay.includes(t)).length;
      return { ...l, matchScore: Math.min(99, Math.round(((l.wiri ?? l.readiness) * 0.65) + (hits / Math.max(1, terms.length)) * 35)) } as Learner & { matchScore: number };
    }).sort((a, b) => b.matchScore - a.matchScore).slice(0, 8);
  }, [filteredLearners, jdQuery]);

  return (
    <main className="min-h-screen bg-canvas text-fg">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,rgba(37,99,235,0.14),transparent_70%)]" />
      <div className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">WorkZo Institution Intelligence</p>
              <span className={cx("rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide", isLive ? "border-success/30 bg-success/10 text-success" : "border-warning/30 bg-warning/10 text-warning")}>{isLive ? `Live · ${data.org}` : "Sample institution dashboard"}</span>
              <span className="rounded-full border border-line bg-fg/[0.04] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-muted">Privacy-first · no public ranking</span>
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{data.org}</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted">Cohort analytics, WIRI heatmaps, student risk signals, curriculum actions, and employer-ready talent visibility in one institution dashboard.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/dashboard" className="inline-flex items-center gap-2 rounded-xl border border-line bg-fg/[0.04] px-4 py-3 text-sm font-black text-fg hover:bg-fg/[0.08]">← Dashboard</a>
            <a href="/institution/marketplace" className="inline-flex items-center gap-2 rounded-xl border border-line bg-fg/[0.04] px-4 py-3 text-sm font-black text-fg hover:bg-fg/[0.08]"><BriefcaseBusiness className="h-4 w-4" /> Talent marketplace</a>
            <a href="/institution/scoring" className="inline-flex items-center gap-2 rounded-xl border border-line bg-fg/[0.04] px-4 py-3 text-sm font-black text-fg hover:bg-fg/[0.08]"><SlidersHorizontal className="h-4 w-4" /> Scoring settings</a>
            {isLive ? <button onClick={() => { const p = new URLSearchParams(window.location.search); void loadOrg(p.get("org") || p.get("code") || "", p.get("key") || "", p.get("secret") || ""); }} className="inline-flex items-center gap-2 rounded-xl border border-line bg-fg/[0.04] px-5 py-3 text-sm font-black text-fg hover:bg-fg/[0.08]"><RefreshCw className={cx("h-4 w-4", loading && "animate-spin")} /> Refresh</button> : <a href="mailto:support@workzoai.com?subject=WorkZo%20AI%20Institution%20Dashboard%20Pilot" className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-black text-on-brand shadow-[0_8px_24px_-8px_rgba(37,99,235,0.6)] hover:bg-brand-strong">Request institution pilot <ArrowUpRight className="h-4 w-4" /></a>}
          </div>
        </header>

        {!isLive && <form onSubmit={(e) => { e.preventDefault(); if (orgInput.trim()) void loadOrg(orgInput.trim(), keyInput.trim(), ""); }} className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface/70 p-4"><Building2 className="h-5 w-5 text-brand" /><div><label className="text-[11px] font-black uppercase tracking-wide text-muted">Organization domain or code</label><input value={orgInput} onChange={(e) => setOrgInput(e.target.value)} placeholder="students.myuni.edu or SPRING26" className="mt-1 block w-64 rounded-lg border border-line bg-canvas px-3 py-2 text-sm focus:border-brand focus:outline-none" /></div><div><label className="text-[11px] font-black uppercase tracking-wide text-muted">Access key</label><input value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="partner access key" className="mt-1 block w-64 rounded-lg border border-line bg-canvas px-3 py-2 text-sm focus:border-brand focus:outline-none" /></div><button type="submit" disabled={loading || !orgInput.trim()} className="rounded-lg bg-brand px-5 py-2 text-sm font-black text-on-brand disabled:opacity-40">{loading ? "Loading…" : "Load live cohort"}</button>{error && <p className="w-full text-sm font-bold text-danger">{error}</p>}</form>}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Stat icon={Users} label="Students" value={`${data.stats.totalLearners}`} sub={`${data.stats.activeLearners} active`} />
          <Stat icon={GaugeCircle} label="Avg WIRI" value={`${data.wiri?.average ?? data.stats.avgWiri ?? data.stats.avgReadiness}%`} sub="WorkZo Interview Readiness Index" tone="success" />
          <Stat icon={UserCheck} label="Employer ready" value={`${data.stats.employerReadyPercent}%`} sub="opt-in eligible" tone="success" />
          <Stat icon={TrendingUp} label="Avg improvement" value={`+${data.stats.averageImprovement}%`} sub="practice journey" tone="warning" />
          <Stat icon={AlertTriangle} label="Need coaching" value={`${data.stats.atRisk}`} sub="before placement" tone="danger" />
        </section>

        <nav className="mt-6 flex flex-wrap gap-2 rounded-2xl border border-line bg-surface/70 p-2">
          {([
            ["intelligence", Brain, "Cohort Intelligence"],
            ["pipeline", BriefcaseBusiness, "Talent Pipeline"],
            ["templates", FileText, "Company Templates"],
            ["benchmark", BarChart3, "Benchmarking"],
            ["escalations", AlertTriangle, "Escalations"],
          ] as const).map(([id, Icon, label]) => <button key={id} onClick={() => setTab(id)} className={cx("inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition", tab === id ? "bg-brand text-on-brand" : "text-muted hover:bg-fg/[0.05] hover:text-fg")}><Icon className="h-4 w-4" />{label}</button>)}
        </nav>

        {tab === "intelligence" && <section className="mt-6 grid gap-4 xl:grid-cols-3">
          <div className="rounded-2xl border border-line bg-surface/75 p-6 xl:col-span-3"><SectionTitle icon={GaugeCircle} kicker="WorkZo Interview Readiness Index" title="WIRI tier distribution" desc="A proprietary readiness benchmark built from CV quality, job fit, interview performance, communication, technical evidence, confidence, improvement, and consistency." /><div className="grid gap-3 md:grid-cols-4">{(data.wiri?.tiers || []).map((t) => <div key={t.key} className="rounded-xl border border-line bg-canvas/70 p-4"><p className="text-2xl font-black tabular-nums">{t.count}</p><p className="mt-1 text-sm font-black text-fg">{t.label}</p><p className="text-xs font-bold text-brand">{t.range}</p><Bar value={t.percent} tone={t.key === "employer-ready" ? "bg-success" : t.key === "minor-coaching" ? "bg-brand" : t.key === "needs-improvement" ? "bg-warning" : "bg-danger"} /><p className="mt-2 text-xs text-muted">{t.description}</p></div>)}</div></div>
          <div className="rounded-2xl border border-line bg-surface/75 p-6 xl:col-span-2"><SectionTitle icon={Target} kicker="WIRI breakdown" title="Readiness heatmap" desc="The 9 vectors feeding WIRI. Historical sessions use recruiter-signal fallback; future sessions can use computed rubric values automatically." /><div className="space-y-4">{(data.wiri?.breakdown?.length ? data.wiri.breakdown : data.heatmap).map((m: any) => <div key={m.key}><div className="mb-1.5 flex items-center justify-between text-sm"><span className="font-black text-fg">{m.label}</span><span className={cx("font-black tabular-nums", scoreTone(m.score))}>{m.score}%</span></div><Bar value={m.score} tone={riskTone(m.risk)} /><p className="mt-1 text-xs text-subtle">{m.count} scored interviews · {m.weight ? `${m.weight}% WIRI weight · ` : ""}{m.risk === "critical" ? "priority intervention" : m.risk === "watch" ? "watch area" : "strong signal"}</p></div>)}</div></div>
          <div className="rounded-2xl border border-line bg-surface/75 p-6"><SectionTitle icon={CalendarClock} kicker="Engagement" title="Practice activity" desc="Sessions completed in the last 14 days." /><div className="mt-6 flex h-40 items-end gap-1.5">{data.engagement.map((v, i) => <div key={i} className="flex-1 rounded-t bg-brand/80" style={{ height: `${Math.max(2, (v / maxEng) * 100)}%` }} title={`${v} sessions`} />)}</div></div>
          <div className="rounded-2xl border border-line bg-surface/75 p-6"><SectionTitle icon={AlertTriangle} kicker="Top failure reasons" title="Rejection-risk signals" /> <div className="space-y-3">{data.failureSignals.map((s) => <div key={s.label} className="rounded-xl border border-line bg-canvas/70 p-4"><div className="flex items-start justify-between gap-3"><p className="font-black text-fg">{s.label}</p><span className={cx("rounded-full px-2 py-0.5 text-xs font-black", s.severity === "high" ? "bg-danger/10 text-danger" : s.severity === "medium" ? "bg-warning/10 text-warning" : "bg-fg/[0.06] text-muted")}>{s.percent}%</span></div><p className="mt-2 text-xs text-muted">{s.suggestedAction}</p></div>)}</div></div>
          <div className="rounded-2xl border border-line bg-surface/75 p-6 xl:col-span-2"><SectionTitle icon={GraduationCap} kicker="Curriculum intelligence" title="What educators should fix next" desc="Turns weak interview patterns into workshops and coaching actions." /><div className="grid gap-3 md:grid-cols-2">{data.curriculumInsights.map((c) => <div key={c.weakCompetency} className="rounded-xl border border-line bg-canvas/70 p-4"><div className="flex items-center justify-between"><p className="font-black text-fg">{c.weakCompetency}</p><span className="font-black text-warning">{c.affectedPercent}% affected</span></div><p className="mt-2 text-sm text-muted">{c.suggestedAction}</p><p className="mt-3 text-xs font-black uppercase tracking-wide text-success">Expected impact: {c.expectedImpact}</p></div>)}</div></div>
        </section>}

        {tab === "pipeline" && <section className="mt-6 grid gap-4 xl:grid-cols-[360px_1fr]">
          <aside className="rounded-2xl border border-line bg-surface/75 p-5"><SectionTitle icon={SlidersHorizontal} kicker="Talent explorer" title="Filter employer-ready students" /><div className="space-y-3"><div className="flex items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-2"><Search className="h-4 w-4 text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search role, skill, language" className="w-full bg-transparent text-sm focus:outline-none" /></div><Select label="Status" value={statusFilter} onChange={(v) => setStatusFilter(v as any)} items={["all", "ready", "improving", "at-risk"]} /><Select label="Role" value={roleFilter} onChange={setRoleFilter} items={roles} /><Select label="Skill" value={skillFilter} onChange={setSkillFilter} items={skills} /><Select label="Readiness band" value={bandFilter} onChange={(v) => setBandFilter(v as any)} items={["all", "90+", "80-89", "70-79", "60-69", "below-60"]} /></div><div className="mt-5 rounded-xl border border-brand/20 bg-brand/[0.06] p-4"><p className="text-sm font-black text-fg">AI Talent Match</p><p className="mt-1 text-xs text-muted">Paste a JD keyword set to auto-prioritize matching candidates.</p><textarea value={jdQuery} onChange={(e) => setJdQuery(e.target.value)} placeholder="Example: Junior Data Analyst SQL Python Tableau German B1 stakeholder" className="mt-3 min-h-24 w-full rounded-lg border border-line bg-canvas p-3 text-sm focus:border-brand focus:outline-none" /></div></aside>
          <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{data.talentSegments.map((s) => <div key={s.label} className="rounded-2xl border border-line bg-surface/75 p-4"><p className="text-xl font-black tabular-nums">{s.count}</p><p className="text-xs font-black uppercase tracking-wide text-muted">{s.label}</p><Bar value={s.percent} tone="bg-brand" /><p className="mt-2 text-xs text-subtle">{s.description}</p></div>)}</div><div className="grid gap-4 lg:grid-cols-2">{(jdQuery ? aiMatches : filteredLearners).map((l) => <CandidateCard key={l.id} learner={l} onOpen={() => setSelected(l)} />)}</div></div>
        </section>}

        {tab === "templates" && <section className="mt-6 rounded-2xl border border-line bg-surface/75 p-6"><SectionTitle icon={FileText} kicker="Company interview templates" title="Practice the interviews students actually want" desc="Use these as preset interview flows: recruiter tone, rounds, difficulty, scoring focus, and question style." /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.companyTemplates.map((t) => <div key={t.company} className="rounded-2xl border border-line bg-canvas/70 p-5"><div className="flex items-start justify-between gap-3"><h3 className="text-lg font-black">{t.company}</h3><span className="rounded-full border border-line bg-fg/[0.04] px-2 py-0.5 text-xs font-black text-muted">{t.difficulty}</span></div><p className="mt-4 text-xs font-black uppercase tracking-wide text-muted">Rounds</p><div className="mt-2 flex flex-wrap gap-2">{t.rounds.map((r) => <span key={r} className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-bold text-brand">{r}</span>)}</div><p className="mt-4 text-xs font-black uppercase tracking-wide text-muted">Focus</p><ul className="mt-2 space-y-1 text-sm text-muted">{t.focus.map((f) => <li key={f}>• {f}</li>)}</ul><p className="mt-4 text-xs text-subtle">Best for: {t.bestFor.join(", ")}</p></div>)}</div></section>}

        {tab === "benchmark" && <section className="mt-6 grid gap-4 lg:grid-cols-2"><BenchmarkCard title="Average readiness" a="Your cohort" av={data.recruiterBenchmark.cohortReadiness} b="Industry" bv={data.recruiterBenchmark.industryReadiness} /><BenchmarkCard title="Communication" a="Your cohort" av={data.recruiterBenchmark.cohortCommunication} b="Industry" bv={data.recruiterBenchmark.industryCommunication} /><BenchmarkCard title="Confidence" a="Your cohort" av={data.recruiterBenchmark.cohortConfidence} b="Industry" bv={data.recruiterBenchmark.industryConfidence} /><div className="rounded-2xl border border-line bg-surface/75 p-6"><SectionTitle icon={Sparkles} kicker="Recruiter intelligence" title="Most important signals" /><div className="space-y-3"><p className="rounded-xl border border-danger/20 bg-danger/[0.06] p-4 text-sm"><b>Most failed competency:</b> {data.recruiterBenchmark.mostFailedCompetency}</p><p className="rounded-xl border border-success/20 bg-success/[0.06] p-4 text-sm"><b>Most successful competency:</b> {data.recruiterBenchmark.mostSuccessfulCompetency}</p><p className="text-sm text-muted">Next upgrade: allow companies to set weighting preferences, for example technical-heavy, communication-heavy, STAR-heavy, or leadership-heavy scoring.</p></div></div><div className="rounded-2xl border border-line bg-surface/75 p-6 lg:col-span-2"><SectionTitle icon={BarChart3} kicker="Department comparison" title="Which programs are employer-ready?" /><div className="grid gap-3 md:grid-cols-2">{data.departmentMetrics.map((d) => <div key={d.department} className="rounded-xl border border-line bg-canvas/70 p-4"><div className="mb-2 flex items-center justify-between"><p className="font-black">{d.department}</p><span className={cx("font-black", scoreTone(d.readiness))}>{d.readiness}%</span></div><Bar value={d.readiness} tone={d.readiness >= 80 ? "bg-success" : d.readiness >= 65 ? "bg-warning" : "bg-danger"} /><p className="mt-2 text-xs text-subtle">{d.students} students · {d.sessions} interviews</p></div>)}</div></div></section>}

        {tab === "escalations" && <section className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionTitle icon={AlertTriangle} kicker="Human-in-the-loop" title="Review queue" desc="Candidates flagged for a human read. Resolving or dismissing updates the queue and notifies any connected Slack / Teams / ATS channel." />
            <div className="flex gap-2 text-xs font-black">
              <span className="rounded-full bg-brand/10 px-3 py-1 text-brand">{escalations.filter((e) => e.status === "open").length} open</span>
              <span className="rounded-full bg-warning/10 px-3 py-1 text-warning">{escalations.filter((e) => e.status === "reviewing").length} reviewing</span>
              <span className="rounded-full bg-success/10 px-3 py-1 text-success">{escalations.filter((e) => e.status === "resolved").length} resolved</span>
            </div>
          </div>
          {!escalations.length ? <div className="rounded-2xl border border-line bg-surface/75 p-10 text-center text-sm text-muted">No escalations yet. Flag a candidate from the marketplace to start the review queue.</div> : null}
          <div className="grid gap-3">
            {escalations.map((e) => {
              const sev = e.severity === "exceptional" ? { c: "bg-success/10 text-success", l: "⭐ Exceptional" } : e.severity === "high" ? { c: "bg-danger/10 text-danger", l: "High" } : e.severity === "medium" ? { c: "bg-warning/10 text-warning", l: "Medium" } : { c: "bg-fg/[0.06] text-muted", l: "Low" };
              const st = e.status === "open" ? "text-brand" : e.status === "reviewing" ? "text-warning" : e.status === "resolved" ? "text-success" : "text-muted";
              const done = e.status === "resolved" || e.status === "dismissed";
              return <div key={e.id} className={cx("rounded-2xl border border-line bg-surface/75 p-5", done && "opacity-70")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black text-fg">{e.candidate_name || "Candidate"}</h3>
                      <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-black", sev.c)}>{sev.l}</span>
                      <span className={cx("rounded-full border border-line px-2 py-0.5 text-[11px] font-black uppercase tracking-wide", st)}>{e.status}</span>
                    </div>
                    <p className="mt-1 text-sm font-bold text-muted">{e.role || " - "} · {e.reason.replace(/_/g, " ")}{e.wiri != null ? ` · WIRI ${e.wiri}` : ""}</p>
                    {e.note ? <p className="mt-2 text-sm text-muted">{e.note}</p> : null}
                    <p className="mt-2 text-xs text-subtle">Flagged by {e.flagged_by} · {new Date(e.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {e.status === "open" ? <button disabled={escBusy === e.id} onClick={() => updateEscalation(e.id, "reviewing")} className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-sm font-black text-warning disabled:opacity-40">Start review</button> : null}
                    {!done ? <button disabled={escBusy === e.id} onClick={() => updateEscalation(e.id, "resolved")} className="rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm font-black text-success disabled:opacity-40">Resolve</button> : null}
                    {!done ? <button disabled={escBusy === e.id} onClick={() => updateEscalation(e.id, "dismissed")} className="rounded-xl border border-line bg-fg/[0.04] px-3 py-2 text-sm font-black text-muted disabled:opacity-40">Dismiss</button> : <button disabled={escBusy === e.id} onClick={() => updateEscalation(e.id, "open")} className="rounded-xl border border-line bg-fg/[0.04] px-3 py-2 text-sm font-black text-muted disabled:opacity-40">Reopen</button>}
                  </div>
                </div>
              </div>;
            })}
          </div>
        </section>}
      </div>
      {selected && <CandidateModal learner={selected} onClose={() => setSelected(null)} />}
    </main>
  );
}

function Select({ label, value, onChange, items }: { label: string; value: string; onChange: (v: string) => void; items: string[] }) {
  return <label className="block"><span className="text-[11px] font-black uppercase tracking-wide text-muted">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm font-bold focus:border-brand focus:outline-none">{items.map((x) => <option key={x} value={x}>{x === "all" ? `All ${label.toLowerCase()}` : x}</option>)}</select></label>;
}

function CandidateCard({ learner, onOpen }: { learner: Learner & { matchScore?: number }; onOpen: () => void }) {
  const meta = statusMeta[learner.status];
  return <article className="rounded-2xl border border-line bg-surface/75 p-5 transition hover:-translate-y-0.5 hover:shadow-lg"><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-black text-fg">{learner.name}</h3>{learner.verified && <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-black text-success"><ShieldCheck className="h-3 w-3" /> Verified</span>}</div><p className="text-sm font-bold text-muted">{learner.role}</p></div><div className="text-right"><p className={cx("text-2xl font-black tabular-nums", scoreTone(learner.matchScore ?? learner.wiri ?? learner.readiness))}>{learner.matchScore ?? learner.wiri ?? learner.readiness}%</p><p className="text-[11px] font-black uppercase tracking-wide text-subtle">{learner.matchScore ? "JD match" : "WIRI"}</p></div></div><p className="mt-3 line-clamp-2 text-sm text-muted">{learner.matchSummary}</p><div className="mt-4 flex flex-wrap gap-2">{learner.skills.slice(0, 5).map((s) => <span key={s} className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-bold text-brand">{s}</span>)}</div><div className="mt-4 grid gap-2 text-xs text-muted sm:grid-cols-2"><span className="inline-flex items-center gap-1"><Languages className="h-3.5 w-3.5" /> {learner.languages.slice(0, 2).join(", ")}</span><span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {learner.location}</span><span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {learner.availability}</span><span className={cx("inline-flex items-center gap-1 font-black", meta.cls)}><span className={cx("h-2 w-2 rounded-full", meta.dot)} /> {meta.label}</span></div><button onClick={onOpen} className="mt-5 w-full rounded-xl border border-line bg-fg/[0.04] px-4 py-2.5 text-sm font-black text-fg hover:bg-fg/[0.08]">View candidate profile</button></article>;
}

function CandidateModal({ learner, onClose }: { learner: Learner; onClose: () => void }) {
  const comps = Object.entries(learner.wiriBreakdown || learner.competencySnapshot || {}).sort((a, b) => b[1] - a[1]).slice(0, 9);
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}><div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-line bg-canvas p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-brand">Candidate profile</p><h2 className="mt-1 text-3xl font-black">{learner.name}</h2><p className="text-sm font-bold text-muted">{learner.role} · {learner.location}</p></div><button onClick={onClose} className="rounded-xl border border-line bg-fg/[0.04] px-4 py-2 text-sm font-black">Close</button></div><div className="mt-6 grid gap-4 md:grid-cols-3"><Stat icon={GaugeCircle} label="WIRI" value={`${learner.wiri ?? learner.readiness}%`} tone="success" /><Stat icon={CalendarClock} label="Interviews" value={`${learner.sessions}`} /><Stat icon={TrendingUp} label="Improvement" value={`${learner.trend > 0 ? "+" : ""}${learner.trend}%`} tone={learner.trend >= 0 ? "success" : "danger"} /></div><section className="mt-6 rounded-2xl border border-line bg-surface/70 p-5"><SectionTitle icon={Brain} kicker="AI summary" title="Hiring signal" /><p className="text-sm leading-6 text-muted">{learner.matchSummary}</p></section><section className="mt-4 grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-line bg-surface/70 p-5"><SectionTitle icon={Target} kicker="Competencies" title="Score evidence" /><div className="space-y-3">{comps.map(([k, v]) => <div key={k}><div className="mb-1 flex justify-between text-sm"><span className="font-bold capitalize text-fg">{k.replace(/([A-Z])/g, " $1")}</span><span className={cx("font-black", scoreTone(v))}>{v}%</span></div><Bar value={v} tone={v >= 80 ? "bg-success" : v >= 60 ? "bg-warning" : "bg-danger"} /></div>)}</div></div><div className="rounded-2xl border border-line bg-surface/70 p-5"><SectionTitle icon={ShieldCheck} kicker="Verified talent" title="Employer actions" /><div className="space-y-2 text-sm text-muted"><p>✓ Interview completed</p><p>✓ Readiness score available</p><p>✓ Competency evidence available</p><p>{learner.verified ? "✓ Verified candidate badge earned" : "○ Needs more sessions for verified badge"}</p></div><div className="mt-5 grid gap-2 sm:grid-cols-2"><button className="rounded-xl bg-brand px-4 py-2.5 text-sm font-black text-on-brand">Shortlist</button><button className="rounded-xl border border-line bg-fg/[0.04] px-4 py-2.5 text-sm font-black">Request CV</button></div></div></section></div></div>;
}

function BenchmarkCard({ title, a, av, b, bv }: { title: string; a: string; av: number; b: string; bv: number }) {
  return <div className="rounded-2xl border border-line bg-surface/75 p-6"><SectionTitle icon={BarChart3} kicker="Recruiter benchmark" title={title} /><div className="space-y-5"><div><div className="mb-1 flex justify-between text-sm"><span className="font-black">{a}</span><span className={cx("font-black", scoreTone(av))}>{av}%</span></div><Bar value={av} tone="bg-brand" /></div><div><div className="mb-1 flex justify-between text-sm"><span className="font-black text-muted">{b}</span><span className="font-black text-muted">{bv}%</span></div><Bar value={bv} tone="bg-fg/30" /></div></div></div>;
}
