"use client";

/**
 * Shadow Recruiter Calibration admin UI.
 *
 * Sections: active scoring profile, create rubric (with company
 * template seeding and slider weight editor validated to 100%),
 * profile list with activation, built-in company templates, and a
 * preview that scores a past interview against a rubric and explains
 * the gap versus global WIRI.
 *
 * Access model matches /admin: ?org=<slug>&key=<hmac> or founder
 * ?secret=. Without credentials the page runs in demo mode with
 * sample data and mutations disabled.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, Building2, CheckCircle2, FlaskConical, GaugeCircle,
  Layers, Plus, RefreshCw, Scale, ShieldCheck, SlidersHorizontal, Sparkles, Target,
} from "lucide-react";

type Weights = Record<string, number>;
type Thresholds = { excellent: number; ready: number; needsCoaching: number; highRisk?: number };

type ProfileVersion = {
  id: string;
  version_number: number;
  weights: Weights;
  thresholds: Thresholds;
  created_at: string;
};

type Profile = {
  id: string;
  name: string;
  description: string | null;
  profile_type: string;
  target_role: string | null;
  company_template: string | null;
  is_active: boolean;
  created_at: string;
  activeVersion: ProfileVersion | null;
  versionCount: number;
};

type BuiltInTemplate = {
  id: string;
  companyName: string;
  roleFamilies: string[];
  recruiterPersona: { tone: string; style: string; pressureLevel: string };
  interviewFlow: { stage: string; focus: string[]; sampleQuestions: string[] }[];
  defaultWeights: Weights;
  promptInstructions: string;
};

type PreviewResult = {
  globalWiri: number;
  organizationReadinessScore: number;
  weightedBreakdown: { key: string; label: string; score: number; weight: number; contribution: number }[];
  riskFlags: string[];
  recommendation: string;
  profile: { id: string | null; name: string; versionNumber: number | null };
};

const COMPETENCIES: { key: string; label: string }[] = [
  { key: "communication", label: "Communication" },
  { key: "technicalDepth", label: "Technical Depth" },
  { key: "starStructure", label: "STAR Structure" },
  { key: "businessReasoning", label: "Business Reasoning" },
  { key: "confidence", label: "Confidence" },
  { key: "cultureFit", label: "Culture Fit" },
  { key: "evidenceQuality", label: "Evidence Quality" },
  { key: "jobFit", label: "Job Fit" },
  { key: "leadership", label: "Leadership" },
];

const DEFAULT_WEIGHTS: Weights = {
  communication: 20, technicalDepth: 20, jobFit: 20, evidenceQuality: 20, confidence: 10, starStructure: 10,
};
const DEFAULT_THRESHOLDS: Thresholds = { excellent: 90, ready: 80, needsCoaching: 60 };

const DEMO_PROFILES: Profile[] = [
  {
    id: "demo-sap",
    name: "SAP Customer Success Rubric",
    description: "Enterprise customer-facing readiness scoring",
    profile_type: "company_template",
    target_role: "Customer Success Manager",
    company_template: "sap-consulting",
    is_active: true,
    created_at: new Date().toISOString(),
    activeVersion: {
      id: "demo-v2",
      version_number: 2,
      weights: { communication: 25, businessReasoning: 25, jobFit: 20, technicalDepth: 15, confidence: 10, starStructure: 5 },
      thresholds: DEFAULT_THRESHOLDS,
      created_at: new Date().toISOString(),
    },
    versionCount: 2,
  },
  {
    id: "demo-startup",
    name: "Startup Readiness Rubric",
    description: "Ownership and problem solving weighted for early-stage teams",
    profile_type: "custom",
    target_role: "Generalist",
    company_template: null,
    is_active: false,
    created_at: new Date().toISOString(),
    activeVersion: {
      id: "demo-v1",
      version_number: 1,
      weights: { businessReasoning: 30, leadership: 25, communication: 20, technicalDepth: 15, confidence: 10 },
      thresholds: DEFAULT_THRESHOLDS,
      created_at: new Date().toISOString(),
    },
    versionCount: 1,
  },
];

const DEMO_PREVIEW: PreviewResult = {
  globalWiri: 84,
  organizationReadinessScore: 79,
  weightedBreakdown: [
    { key: "technicalDepth", label: "Technical Depth", score: 66, weight: 35, contribution: 23.1 },
    { key: "communication", label: "Communication", score: 86, weight: 20, contribution: 17.2 },
    { key: "starStructure", label: "STAR Structure", score: 78, weight: 15, contribution: 11.7 },
    { key: "businessReasoning", label: "Business Reasoning", score: 81, weight: 15, contribution: 12.2 },
    { key: "confidence", label: "Confidence", score: 88, weight: 10, contribution: 8.8 },
    { key: "cultureFit", label: "Culture Fit", score: 85, weight: 5, contribution: 4.3 },
  ],
  riskFlags: ["Technical Depth scored 66, below the coaching threshold, and carries 35% weight."],
  recommendation: "Ready with coaching",
  profile: { id: "demo-sap", name: "SAP Customer Success Rubric", versionNumber: 2 },
};

function cx(...items: Array<string | false | null | undefined>) { return items.filter(Boolean).join(" "); }
function scoreTone(score: number) { return score >= 80 ? "text-success" : score >= 60 ? "text-warning" : "text-danger"; }

function SectionTitle({ icon: Icon, kicker, title, desc }: { icon: typeof Scale; kicker: string; title: string; desc?: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand"><Icon className="h-4 w-4" /></div>
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brand">{kicker}</p>
        <h2 className="text-lg font-black tracking-tight text-fg">{title}</h2>
        {desc ? <p className="mt-0.5 text-sm text-muted">{desc}</p> : null}
      </div>
    </div>
  );
}

function Bar({ value, tone = "bg-brand" }: { value: number; tone?: string }) {
  return <div className="h-2 overflow-hidden rounded-full bg-line"><div className={cx("h-full rounded-full", tone)} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} /></div>;
}

function WeightEditor({ weights, onChange, disabled }: { weights: Weights; onChange: (w: Weights) => void; disabled?: boolean }) {
  const total = Math.round(Object.values(weights).reduce((s, n) => s + (Number.isFinite(n) ? n : 0), 0));
  const valid = total === 100;
  return (
    <div>
      <div className="space-y-3">
        {COMPETENCIES.map((c) => {
          const value = weights[c.key] || 0;
          return (
            <div key={c.key} className="grid grid-cols-[130px_1fr_52px] items-center gap-3 sm:grid-cols-[170px_1fr_56px]">
              <span className="truncate text-xs font-bold text-muted">{c.label}</span>
              <input
                type="range" min={0} max={60} step={5} value={value} disabled={disabled}
                onChange={(e) => onChange({ ...weights, [c.key]: Number(e.target.value) })}
                className="h-1.5 w-full cursor-pointer accent-[var(--brand,#7c3aed)]"
              />
              <span className={cx("text-right text-sm font-black tabular-nums", value > 0 ? "text-fg" : "text-subtle")}>{value}%</span>
            </div>
          );
        })}
      </div>
      <div className={cx("mt-4 flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm font-black", valid ? "border-success/30 bg-success/10 text-success" : "border-danger/30 bg-danger/10 text-danger")}>
        <span className="inline-flex items-center gap-2">{valid ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />} Total weight</span>
        <span className="tabular-nums">{total}% {valid ? "" : "(must equal 100%)"}</span>
      </div>
    </div>
  );
}

export default function ScoringAdminClient() {
  const [org, setOrg] = useState("");
  const [key, setKey] = useState("");
  const [secret, setSecret] = useState("");
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [profiles, setProfiles] = useState<Profile[]>(DEMO_PROFILES);
  const [templates, setTemplates] = useState<BuiltInTemplate[]>([]);

  /* Create form state */
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [weights, setWeights] = useState<Weights>({ ...DEFAULT_WEIGHTS });
  const [thresholds, setThresholds] = useState<Thresholds>({ ...DEFAULT_THRESHOLDS });
  const [saving, setSaving] = useState(false);

  /* Edit state: which profile's weights are being edited */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editWeights, setEditWeights] = useState<Weights>({});

  /* Preview state */
  const [previewResultId, setPreviewResultId] = useState("");
  const [previewProfileId, setPreviewProfileId] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const authParams = useCallback(() => {
    const p = new URLSearchParams();
    if (org) p.set("org", org);
    if (key) p.set("key", key);
    if (secret) p.set("secret", secret);
    return p.toString();
  }, [org, key, secret]);

  const loadAll = useCallback(async (o: string, k: string, s: string) => {
    setLoading(true); setError("");
    try {
      const p = new URLSearchParams();
      p.set("org", o);
      if (k) p.set("key", k);
      if (s) p.set("secret", s);
      const [pRes, tRes] = await Promise.all([
        fetch(`/api/admin/scoring-profiles?${p.toString()}`, { cache: "no-store" }),
        fetch(`/api/admin/company-templates?${p.toString()}`, { cache: "no-store" }),
      ]);
      const pJson = await pRes.json();
      const tJson = await tRes.json();
      if (!pRes.ok || pJson?.ok === false) {
        throw new Error(pJson?.error === "unauthorized" ? "That access key is not valid for this organization." : "Could not load scoring profiles.");
      }
      setProfiles(pJson.profiles || []);
      if (tJson?.ok) setTemplates(tJson.builtIn || []);
      setIsLive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load scoring data.");
      setIsLive(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const o = (p.get("org") || p.get("code") || "").trim();
    const k = p.get("key") || "";
    const s = p.get("secret") || "";
    setOrg(o); setKey(k); setSecret(s);
    if (o && (k || s)) void loadAll(o, k, s);
    /* Demo templates when not live */
    fetch("/api/admin/company-templates?org=demo").then(() => undefined).catch(() => undefined);
  }, [loadAll]);

  const activeProfile = useMemo(() => profiles.find((p) => p.is_active) || null, [profiles]);

  const applyTemplate = useCallback((id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) {
      setWeights({ ...t.defaultWeights });
      if (!name) setName(`${t.companyName} Readiness Rubric`);
    }
  }, [templates, name]);

  const createProfile = useCallback(async () => {
    if (!isLive) { setNotice("Connect with your organization key to create rubrics."); return; }
    setSaving(true); setError(""); setNotice("");
    try {
      const res = await fetch(`/api/admin/scoring-profiles?${authParams()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, targetRole, companyTemplateId: templateId || undefined, weights, thresholds }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.error || "Could not create the scoring profile.");
      setNotice(`Created "${json.profile?.name}". Activate it to apply.`);
      setShowCreate(false);
      setName(""); setDescription(""); setTargetRole(""); setTemplateId("");
      setWeights({ ...DEFAULT_WEIGHTS }); setThresholds({ ...DEFAULT_THRESHOLDS });
      await loadAll(org, key, secret);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setSaving(false);
    }
  }, [isLive, authParams, name, description, targetRole, templateId, weights, thresholds, loadAll, org, key, secret]);

  const activateProfile = useCallback(async (profileId: string) => {
    if (!isLive) { setNotice("Demo mode: connect with your organization key to activate profiles."); return; }
    setError(""); setNotice("");
    try {
      const res = await fetch(`/api/admin/scoring-profiles/activate?${authParams()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.error || "Activation failed.");
      setNotice("Profile activated. New interviews for this organization now use this rubric.");
      await loadAll(org, key, secret);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activation failed.");
    }
  }, [isLive, authParams, loadAll, org, key, secret]);

  const saveEditedWeights = useCallback(async (profileId: string) => {
    if (!isLive) { setNotice("Demo mode: connect with your organization key to edit rubrics."); setEditingId(null); return; }
    setError(""); setNotice("");
    try {
      const res = await fetch(`/api/admin/scoring-profiles?${authParams()}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, weights: editWeights }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.error || "Update failed.");
      setNotice(`Saved as version ${json.newVersion?.version_number}. Previous versions are preserved for historical fairness.`);
      setEditingId(null);
      await loadAll(org, key, secret);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    }
  }, [isLive, authParams, editWeights, loadAll, org, key, secret]);

  const runPreview = useCallback(async () => {
    setPreviewLoading(true); setError("");
    try {
      if (!isLive) {
        await new Promise((r) => setTimeout(r, 350));
        setPreview(DEMO_PREVIEW);
        return;
      }
      const res = await fetch(`/api/scoring/custom-rubric?${authParams()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewResultId: previewResultId, scoringProfileId: previewProfileId || undefined }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(
          json?.error === "result_not_found" ? "No interview result found with that ID." :
          json?.error === "result_not_in_organization" ? "That interview result belongs to a different organization." :
          "Preview failed.",
        );
      }
      setPreview(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed.");
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [isLive, authParams, previewResultId, previewProfileId]);

  const previewGap = preview ? preview.organizationReadinessScore - preview.globalWiri : 0;
  const heaviest = preview?.weightedBreakdown?.[0];

  return (
    <main className="min-h-screen bg-canvas text-fg">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,rgba(124,58,237,0.14),transparent_70%)]" />
      <div className="mx-auto max-w-[1200px] px-5 py-8 sm:px-8">

        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-brand"><Scale className="h-3 w-3" /> Scoring Calibration</span>
              {isLive
                ? <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-success"><ShieldCheck className="h-3 w-3" /> {org}</span>
                : <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-warning"><FlaskConical className="h-3 w-3" /> Demo data</span>}
            </div>
            <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Organization scoring profiles</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Your organization values these competencies differently. WorkZo applies those priorities consistently.
              Global WIRI stays standardized; the Organization Readiness Score reflects your weighted rubric.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isLive ? (
              <button onClick={() => void loadAll(org, key, secret)} className="inline-flex items-center gap-2 rounded-xl border border-line bg-fg/[0.04] px-4 py-2.5 text-sm font-black text-fg hover:bg-fg/[0.08]">
                <RefreshCw className={cx("h-4 w-4", loading && "animate-spin")} /> Refresh
              </button>
            ) : null}
            <button onClick={() => setShowCreate((v) => !v)} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-black text-on-brand shadow-[0_8px_24px_-8px_rgba(124,58,237,0.6)] hover:bg-brand-strong">
              <Plus className="h-4 w-4" /> New rubric
            </button>
          </div>
        </header>

        {error ? <div className="mt-5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-bold text-danger">{error}</div> : null}
        {notice ? <div className="mt-5 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm font-bold text-success">{notice}</div> : null}

        {/* Active profile */}
        <section className="mt-8">
          <SectionTitle icon={GaugeCircle} kicker="Currently applied" title="Active scoring profile" desc="New interviews for this organization are scored and prompted with this rubric." />
          {activeProfile ? (
            <div className="rounded-2xl border border-brand/30 bg-surface/75 p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-black text-fg">{activeProfile.name}</p>
                  <p className="mt-0.5 text-xs text-muted">{activeProfile.description || "No description"}{activeProfile.target_role ? ` | ${activeProfile.target_role}` : ""} | Version {activeProfile.activeVersion?.version_number ?? 1}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-brand"><Sparkles className="h-3 w-3" /> Active</span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {Object.entries(activeProfile.activeVersion?.weights || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => {
                  const label = COMPETENCIES.find((c) => c.key === k)?.label || k;
                  return (
                    <div key={k} className="flex items-center gap-3">
                      <span className="w-36 shrink-0 truncate text-xs font-bold text-muted">{label}</span>
                      <div className="flex-1"><Bar value={Number(v) * 1.6} /></div>
                      <span className="w-10 text-right text-xs font-black tabular-nums">{v}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-line bg-surface/60 p-5 text-sm text-muted">
              No active profile. Interviews use the WorkZo default rubric until you activate one below.
            </div>
          )}
        </section>

        {/* Create rubric */}
        {showCreate ? (
          <section className="mt-10">
            <SectionTitle icon={SlidersHorizontal} kicker="Weight editor" title="Create a new rubric" desc="Seed from a company template or build from scratch. Weights must total exactly 100%." />
            <div className="rounded-2xl border border-line bg-surface/75 p-5 shadow-sm">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rubric name, e.g. SAP Customer Success Rubric" className="w-full rounded-xl border border-line bg-canvas px-4 py-2.5 text-sm text-fg placeholder:text-subtle focus:border-brand focus:outline-none" />
                  <input value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="Target role (optional)" className="w-full rounded-xl border border-line bg-canvas px-4 py-2.5 text-sm text-fg placeholder:text-subtle focus:border-brand focus:outline-none" />
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" rows={2} className="w-full rounded-xl border border-line bg-canvas px-4 py-2.5 text-sm text-fg placeholder:text-subtle focus:border-brand focus:outline-none" />
                  <div>
                    <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-muted">Seed from company template</p>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => { setTemplateId(""); setWeights({ ...DEFAULT_WEIGHTS }); }} className={cx("rounded-lg border px-3 py-1.5 text-xs font-bold", !templateId ? "border-brand bg-brand/10 text-brand" : "border-line text-muted hover:text-fg")}>Custom</button>
                      {(templates.length ? templates : []).map((t) => (
                        <button key={t.id} onClick={() => applyTemplate(t.id)} className={cx("rounded-lg border px-3 py-1.5 text-xs font-bold", templateId === t.id ? "border-brand bg-brand/10 text-brand" : "border-line text-muted hover:text-fg")}>{t.companyName}</button>
                      ))}
                      {!templates.length ? <span className="text-xs text-subtle">Connect with your organization key to load templates.</span> : null}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-muted">Thresholds</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(["excellent", "ready", "needsCoaching"] as const).map((k) => (
                        <label key={k} className="block">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-subtle">{k === "needsCoaching" ? "Coaching" : k}</span>
                          <input type="number" min={0} max={100} value={thresholds[k]} onChange={(e) => setThresholds({ ...thresholds, [k]: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm font-bold tabular-nums text-fg focus:border-brand focus:outline-none" />
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <WeightEditor weights={weights} onChange={setWeights} />
                  <button
                    onClick={() => void createProfile()}
                    disabled={saving || !name.trim() || Math.round(Object.values(weights).reduce((s, n) => s + n, 0)) !== 100}
                    className="mt-4 w-full rounded-xl bg-brand px-4 py-3 text-sm font-black text-on-brand shadow-[0_8px_24px_-8px_rgba(124,58,237,0.6)] hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {saving ? "Creating..." : "Create scoring profile"}
                  </button>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {/* All profiles */}
        <section className="mt-10">
          <SectionTitle icon={Layers} kicker="Rubric library" title="All scoring profiles" desc="Edits never overwrite scoring logic. Every change is saved as a new version so past results stay fair." />
          <div className="grid gap-4 lg:grid-cols-2">
            {profiles.map((p) => (
              <div key={p.id} className={cx("rounded-2xl border bg-surface/75 p-5 shadow-sm", p.is_active ? "border-brand/40" : "border-line")}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-black text-fg">{p.name}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {p.profile_type === "company_template" ? "Company template" : "Custom"}
                      {p.target_role ? ` | ${p.target_role}` : ""} | v{p.activeVersion?.version_number ?? 1} of {p.versionCount}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.is_active
                      ? <span className="rounded-full bg-brand/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-brand">Active</span>
                      : <button onClick={() => void activateProfile(p.id)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-black text-fg hover:border-brand hover:text-brand">Activate</button>}
                    <button
                      onClick={() => { if (editingId === p.id) { setEditingId(null); } else { setEditingId(p.id); setEditWeights({ ...(p.activeVersion?.weights || DEFAULT_WEIGHTS) }); } }}
                      className="rounded-lg border border-line px-3 py-1.5 text-xs font-black text-muted hover:text-fg"
                    >
                      {editingId === p.id ? "Cancel" : "Edit weights"}
                    </button>
                  </div>
                </div>
                {editingId === p.id ? (
                  <div className="mt-4">
                    <WeightEditor weights={editWeights} onChange={setEditWeights} />
                    <button
                      onClick={() => void saveEditedWeights(p.id)}
                      disabled={Math.round(Object.values(editWeights).reduce((s, n) => s + n, 0)) !== 100}
                      className="mt-3 w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-black text-on-brand hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Save as new version
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {Object.entries(p.activeVersion?.weights || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                      <span key={k} className="rounded-md border border-line bg-fg/[0.03] px-2 py-1 text-[11px] font-bold text-muted">
                        {(COMPETENCIES.find((c) => c.key === k)?.label || k)} {v}%
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {profiles.length === 0 ? <div className="rounded-2xl border border-line bg-surface/60 p-5 text-sm text-muted">No profiles yet. Create your first rubric above.</div> : null}
          </div>
        </section>

        {/* Preview */}
        <section className="mt-10">
          <SectionTitle icon={Activity} kicker="Preview" title="Score a past interview" desc="Compare global WIRI against a rubric score and see exactly which weights drive the difference. Previews are never saved." />
          <div className="rounded-2xl border border-line bg-surface/75 p-5 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-[1fr_240px_auto]">
              <input value={previewResultId} onChange={(e) => setPreviewResultId(e.target.value)} placeholder={isLive ? "Interview result ID (uuid)" : "Demo mode: any input previews sample data"} className="w-full rounded-xl border border-line bg-canvas px-4 py-2.5 text-sm text-fg placeholder:text-subtle focus:border-brand focus:outline-none" />
              <select value={previewProfileId} onChange={(e) => setPreviewProfileId(e.target.value)} className="w-full rounded-xl border border-line bg-canvas px-4 py-2.5 text-sm font-bold text-fg focus:border-brand focus:outline-none">
                <option value="">Active profile</option>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button onClick={() => void runPreview()} disabled={previewLoading || (isLive && !previewResultId.trim())} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-black text-on-brand hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-40">
                {previewLoading ? "Scoring..." : "Preview score"}
              </button>
            </div>

            {preview ? (
              <div className="mt-6">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-line bg-canvas p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-muted">Global WIRI</p>
                    <p className={cx("mt-1 text-3xl font-black tabular-nums", scoreTone(preview.globalWiri))}>{preview.globalWiri}</p>
                    <p className="mt-0.5 text-xs text-subtle">Standardized, unchanged by rubrics</p>
                  </div>
                  <div className="rounded-xl border border-brand/30 bg-canvas p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-brand">{preview.profile.name}</p>
                    <p className={cx("mt-1 text-3xl font-black tabular-nums", scoreTone(preview.organizationReadinessScore))}>{preview.organizationReadinessScore}</p>
                    <p className="mt-0.5 text-xs text-subtle">{preview.recommendation}{preview.profile.versionNumber ? ` | v${preview.profile.versionNumber}` : ""}</p>
                  </div>
                  <div className="rounded-xl border border-line bg-canvas p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-muted">Gap</p>
                    <p className={cx("mt-1 text-3xl font-black tabular-nums", previewGap >= 0 ? "text-success" : "text-warning")}>{previewGap > 0 ? `+${previewGap}` : previewGap}</p>
                    <p className="mt-0.5 text-xs text-subtle">
                      {previewGap < 0 && heaviest ? `${heaviest.label} carries ${heaviest.weight}% weight and scored ${heaviest.score}.` : previewGap > 0 ? "This rubric rewards the candidate's strengths." : "Rubric and WIRI agree."}
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-2.5">
                  {preview.weightedBreakdown.map((b) => (
                    <div key={b.key} className="grid grid-cols-[150px_1fr_120px] items-center gap-3 sm:grid-cols-[180px_1fr_140px]">
                      <span className="truncate text-xs font-bold text-muted">{b.label}</span>
                      <Bar value={b.score} tone={b.score >= 80 ? "bg-success" : b.score >= 60 ? "bg-warning" : "bg-danger"} />
                      <span className="text-right text-xs font-black tabular-nums text-fg">{b.score} <span className="text-subtle">x {b.weight}% = {b.contribution}</span></span>
                    </div>
                  ))}
                </div>

                {preview.riskFlags.length > 0 ? (
                  <div className="mt-5 rounded-xl border border-warning/30 bg-warning/10 p-4">
                    <p className="mb-2 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-warning"><AlertTriangle className="h-3.5 w-3.5" /> Risk flags</p>
                    {preview.riskFlags.map((f, i) => <p key={i} className="text-sm text-fg/90">{f}</p>)}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        {/* Templates */}
        <section className="mt-10 pb-16">
          <SectionTitle icon={Building2} kicker="Template library" title="Company interview templates" desc="Interview styles modeled on publicly known formats. WorkZo practice templates, not official company assessments." />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(templates.length ? templates : []).map((t) => (
              <div key={t.id} className="rounded-2xl border border-line bg-surface/75 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-fg">{t.companyName}</p>
                  <span className={cx("rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide", t.recruiterPersona.pressureLevel === "high" ? "bg-danger/10 text-danger" : t.recruiterPersona.pressureLevel === "low" ? "bg-success/10 text-success" : "bg-warning/10 text-warning")}>{t.recruiterPersona.pressureLevel} pressure</span>
                </div>
                <p className="mt-1.5 text-xs text-muted">{t.recruiterPersona.tone}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.roleFamilies.slice(0, 4).map((r) => <span key={r} className="rounded-md border border-line bg-fg/[0.03] px-2 py-0.5 text-[11px] font-bold text-muted">{r}</span>)}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {Object.entries(t.defaultWeights).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => (
                    <span key={k} className="rounded-md bg-brand/10 px-2 py-0.5 text-[11px] font-black text-brand">{(COMPETENCIES.find((c) => c.key === k)?.label || k)} {v}%</span>
                  ))}
                </div>
                <button onClick={() => { setShowCreate(true); applyTemplate(t.id); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="mt-4 inline-flex items-center gap-1.5 text-xs font-black text-brand hover:underline">
                  <Target className="h-3.5 w-3.5" /> Use as rubric seed
                </button>
              </div>
            ))}
            {!templates.length ? <div className="rounded-2xl border border-line bg-surface/60 p-5 text-sm text-muted sm:col-span-2 lg:col-span-3">Connect with your organization key to load the 11 built-in company templates (SAP, Bosch, BMW, Siemens, Amazon, Google, Microsoft, Accenture, Deloitte, EY, PwC).</div> : null}
          </div>
        </section>

      </div>
    </main>
  );
}
