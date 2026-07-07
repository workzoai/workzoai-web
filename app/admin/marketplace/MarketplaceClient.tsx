"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Activity, BadgeCheck, Bookmark, BriefcaseBusiness, Building2, ClipboardList, Download, Eye, FileText, Filter, GitCompare, Globe2, Languages, Link2, MapPin, MessageSquareText, Plus, Search, Send, Share2, ShieldCheck, Sparkles, Target, Trash2, Users } from "lucide-react";

type Candidate = any;
type Match = any;
type Campaign = any;

type Tab = "dashboard" | "campaigns" | "explorer" | "shortlists" | "activity" | "integrations";

function cx(...classes: Array<string | false | null | undefined>) { return classes.filter(Boolean).join(" "); }
function tone(score: number) { return score >= 90 ? "text-emerald-700" : score >= 80 ? "text-indigo-700" : score >= 60 ? "text-amber-700" : "text-rose-700"; }
function bg(score: number) { return score >= 90 ? "bg-emerald-600" : score >= 80 ? "bg-indigo-600" : score >= 60 ? "bg-amber-500" : "bg-rose-500"; }
function bar(score: number) { return <div className="h-2 rounded-full bg-slate-100"><div className={cx("h-2 rounded-full", bg(score))} style={{ width: `${Math.max(0, Math.min(100, score))}%` }} /></div>; }
function getParam(name: string, fallback: string) { if (typeof window === "undefined") return fallback; return new URLSearchParams(window.location.search).get(name) || fallback; }

export default function MarketplaceClient() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [org, setOrg] = useState("demo");
  const [key, setKey] = useState("");
  const [secret, setSecret] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [stats, setStats] = useState<any>({});
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [shortlists, setShortlists] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [comparison, setComparison] = useState<any[]>([]);
  const [copilot, setCopilot] = useState<string[]>([]);
  const [flagMsg, setFlagMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [filters, setFilters] = useState({ q: "", role: "", skills: "", languages: "", minWiri: "", verifiedOnly: false });
  const [campaignForm, setCampaignForm] = useState({ title: "", employerName: "", role: "", jobDescription: "", location: "Remote / flexible", languages: "English", experienceLevel: "Junior", targetHires: "5" });

  useEffect(() => {
    setOrg(getParam("org", "demo"));
    setKey(getParam("key", ""));
    setSecret(getParam("secret", ""));
  }, []);

  const authQs = useMemo(() => `org=${encodeURIComponent(org)}&key=${encodeURIComponent(key)}&secret=${encodeURIComponent(secret)}`, [org, key, secret]);

  async function apiGet(view = "dashboard", extra = "") {
    const res = await fetch(`/api/talent-marketplace?${authQs}&view=${view}${extra}`, { cache: "no-store" });
    return res.json();
  }

  async function apiPost(body: any) {
    const res = await fetch(`/api/talent-marketplace?${authQs}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return res.json();
  }

  async function loadAll() {
    setLoading(true);
    try {
      const qs = `&q=${encodeURIComponent(filters.q)}&role=${encodeURIComponent(filters.role)}&skills=${encodeURIComponent(filters.skills)}&languages=${encodeURIComponent(filters.languages)}&minWiri=${encodeURIComponent(filters.minWiri)}&verifiedOnly=${filters.verifiedOnly}`;
      const [dash, camp, sl, act] = await Promise.all([apiGet("dashboard", qs), apiGet("campaigns"), apiGet("shortlists"), apiGet("activity")]);
      setCandidates(dash.candidates || []);
      setStats(dash.stats || {});
      setCampaigns(camp.campaigns || []);
      setShortlists(sl.shortlists || []);
      setActivity(act.activity || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (org) loadAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [org, key, secret]);

  async function createCampaign() {
    setLoading(true);
    const payload = { action: "create_campaign", ...campaignForm, languages: campaignForm.languages.split(",").map((x) => x.trim()).filter(Boolean), targetHires: Number(campaignForm.targetHires || 1) };
    const res = await apiPost(payload);
    setMessage(res.ok ? "Campaign saved." : `Campaign failed: ${res.error}`);
    await loadAll();
    setTab("campaigns");
    setLoading(false);
  }

  async function matchCampaign(campaign?: Campaign) {
    setLoading(true);
    const body = campaign ? { action: "match_candidates", campaignId: campaign.id } : { action: "match_candidates", ...campaignForm, languages: campaignForm.languages.split(",").map((x) => x.trim()).filter(Boolean) };
    const res = await apiPost(body);
    setMatches(res.matches || []);
    setMessage(res.ok ? `Matched ${res.summary?.total || 0} candidates.` : `Match failed: ${res.error}`);
    setTab("explorer");
    setLoading(false);
  }

  async function generateShortlist(campaign?: Campaign) {
    setLoading(true);
    const res = await apiPost(campaign ? { action: "generate_shortlist", campaignId: campaign.id, limit: campaign.target_hires || 10 } : { action: "generate_shortlist", ...campaignForm, limit: Number(campaignForm.targetHires || 10), languages: campaignForm.languages.split(",").map((x) => x.trim()).filter(Boolean) });
    setMatches(res.matches || []);
    setMessage(res.ok ? `Generated and saved ${res.matches?.length || 0} shortlisted candidates.` : `Shortlist failed: ${res.error}`);
    await loadAll();
    setTab("shortlists");
    setLoading(false);
  }

  async function saveShortlist(match: Match, status = "shortlisted") {
    const res = await apiPost({ action: "shortlist", candidateId: match.candidate.userId, campaignId: match.campaignId || null, status, matchScore: match.matchScore, reasons: match.reasons, cautions: match.cautions });
    setMessage(res.ok ? "Candidate saved to shortlist." : `Shortlist failed: ${res.error}`);
    await loadAll();
  }

  async function updateVisibility(c: Candidate, visibility: string, passportEnabled = c.passportEnabled) {
    const res = await apiPost({ action: "visibility", candidateId: c.userId, visibility, passportEnabled, passportSlug: c.passportSlug || c.userId, openToRelocation: c.openToRelocation, openToInternships: c.openToInternships, openToGraduatePrograms: c.openToGraduatePrograms, preferredWorkMode: c.preferredWorkMode, salaryExpectation: c.salaryExpectation });
    setMessage(res.ok ? "Visibility updated." : `Visibility update failed: ${res.error}`);
    await loadAll();
  }

  async function runCopilot(c: Candidate, mode: string) {
    setLoading(true);
    const res = await apiPost({ action: "copilot", candidateId: c.userId, candidate: c, mode });
    setCopilot(res.output || []);
    setSelected(c);
    setLoading(false);
  }

  async function flagForReview(c: Candidate, severity: string) {
    const res = await fetch(`/api/admin/escalations?${authQs}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "flag",
        candidateUserId: c.userId,
        candidateName: c.name,
        role: c.role,
        wiri: c.wiri,
        severity,
        reason: severity === "exceptional" ? "exceptional_candidate" : "flagged_for_review",
        flaggedBy: "recruiter",
      }),
    }).then((r) => r.json()).catch(() => null);
    const sent = res?.dispatch?.sent || 0;
    setFlagMsg(res?.ok ? `Flagged for review${sent ? ` · notified ${sent} channel(s)` : " · no notification channel configured"}` : "Flag failed");
    setTimeout(() => setFlagMsg(""), 4500);
  }

  function toggleCompare(id: string) {
    setCompareIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 5 ? prev : [...prev, id]);
  }

  async function compareSelected() {
    if (!compareIds.length) return;
    const res = await apiPost({ action: "compare", candidateIds: compareIds });
    setComparison(res.comparison || []);
    setCopilot(res.copilot || []);
  }

  const topMatches = matches.length ? matches : candidates.map((candidate) => ({ candidate, matchScore: candidate.wiri, band: candidate.wiri >= 90 ? "excellent" : candidate.wiri >= 80 ? "strong" : "good", reasons: candidate.evidence || [], cautions: candidate.risks || [], breakdown: candidate.wiriBreakdown || {} })).sort((a, b) => b.matchScore - a.matchScore);

  return <main className="min-h-screen bg-slate-50 p-4 text-slate-950 md:p-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-200">WorkZo Talent Marketplace</p>
            <h1 className="mt-2 text-3xl font-black md:text-5xl">Verified interview-ready talent</h1>
            <p className="mt-3 max-w-3xl text-slate-300">Students prepare with CV + JD interviews. Universities measure readiness. Employers discover verified candidates through WIRI, interview evidence, and explainable matching.</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4 text-sm">
            <p className="font-bold">Organization</p>
            <input value={org} onChange={(e) => setOrg(e.target.value)} className="mt-2 w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-white outline-none" />
          </div>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2 rounded-3xl border bg-white p-2 shadow-sm">
        {(["dashboard", "campaigns", "explorer", "shortlists", "activity", "integrations"] as Tab[]).map((t) => <button key={t} onClick={() => setTab(t)} className={cx("rounded-2xl px-4 py-2 text-sm font-black capitalize", tab === t ? "bg-slate-950 text-white" : "hover:bg-slate-100")}>{t}</button>)}
      </nav>

      {message ? <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm font-bold text-indigo-950">{message}</div> : null}

      {tab === "dashboard" ? <Dashboard stats={stats} candidates={candidates} matches={topMatches} onOpen={(c) => setSelected(c)} /> : null}

      {tab === "campaigns" ? <section className="grid gap-6 lg:grid-cols-[0.95fr_1.1fr]">
        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><Plus className="h-5 w-5 text-indigo-600" /><h2 className="text-xl font-black">Create Hiring Campaign</h2></div>
          <div className="mt-4 grid gap-3">
            <Input label="Campaign title" value={campaignForm.title} onChange={(v) => setCampaignForm({ ...campaignForm, title: v })} placeholder="Software Engineer 2026" />
            <Input label="Employer name" value={campaignForm.employerName} onChange={(v) => setCampaignForm({ ...campaignForm, employerName: v })} placeholder="SAP / Bosch / Hiring Partner" />
            <Input label="Role" value={campaignForm.role} onChange={(v) => setCampaignForm({ ...campaignForm, role: v })} placeholder="Data Analyst" />
            <Input label="Location" value={campaignForm.location} onChange={(v) => setCampaignForm({ ...campaignForm, location: v })} />
            <Input label="Languages" value={campaignForm.languages} onChange={(v) => setCampaignForm({ ...campaignForm, languages: v })} placeholder="English, German" />
            <Input label="Experience" value={campaignForm.experienceLevel} onChange={(v) => setCampaignForm({ ...campaignForm, experienceLevel: v })} />
            <Input label="Target hires" value={campaignForm.targetHires} onChange={(v) => setCampaignForm({ ...campaignForm, targetHires: v })} />
            <label className="text-sm font-bold">Job description<textarea value={campaignForm.jobDescription} onChange={(e) => setCampaignForm({ ...campaignForm, jobDescription: e.target.value })} rows={9} className="mt-1 w-full rounded-2xl border px-3 py-2 font-normal outline-none focus:border-indigo-400" placeholder="Paste JD here..." /></label>
            <div className="grid gap-2 sm:grid-cols-3"><button onClick={createCampaign} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Save Campaign</button><button onClick={() => matchCampaign()} className="rounded-xl border px-4 py-3 text-sm font-black"><Sparkles className="mr-1 inline h-4 w-4" />Match</button><button onClick={() => generateShortlist()} className="rounded-xl border px-4 py-3 text-sm font-black"><Bookmark className="mr-1 inline h-4 w-4" />Auto-shortlist</button></div>
          </div>
        </div>
        <div className="space-y-4">{campaigns.map((c) => <CampaignCard key={c.id} c={c} onMatch={() => matchCampaign(c)} onShortlist={() => generateShortlist(c)} exportHref={`/api/talent-marketplace?${authQs}&view=export&campaignId=${encodeURIComponent(c.id)}`} />)}{!campaigns.length ? <Empty title="No campaigns yet" text="Create a hiring campaign to match interview-ready candidates." /> : null}</div>
      </section> : null}

      {tab === "explorer" ? <section className="space-y-5">
        <div className="rounded-3xl border bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><Filter className="h-5 w-5 text-indigo-600" /><h2 className="text-xl font-black">Talent Explorer</h2></div><div className="mt-4 grid gap-3 md:grid-cols-6"><Input label="Search" value={filters.q} onChange={(v) => setFilters({ ...filters, q: v })} /><Input label="Role" value={filters.role} onChange={(v) => setFilters({ ...filters, role: v })} /><Input label="Skills" value={filters.skills} onChange={(v) => setFilters({ ...filters, skills: v })} /><Input label="Languages" value={filters.languages} onChange={(v) => setFilters({ ...filters, languages: v })} /><Input label="Min WIRI" value={filters.minWiri} onChange={(v) => setFilters({ ...filters, minWiri: v })} /><button onClick={loadAll} className="mt-6 rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white"><Search className="mr-1 inline h-4 w-4" />Apply</button></div></div>
        {matches.length ? <div className="rounded-3xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-black">Explainable AI Match Results</h2><div className="mt-4 grid gap-4 lg:grid-cols-3">{matches.slice(0, 12).map((m) => <MatchCard key={m.candidate.id} m={m} onView={() => setSelected(m.candidate)} onShortlist={() => saveShortlist(m)} onCopilot={(mode) => runCopilot(m.candidate, mode)} onCompare={() => toggleCompare(m.candidate.id)} selected={compareIds.includes(m.candidate.id)} />)}</div></div> : null}
        <div className="rounded-3xl border bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-black">Candidate Pool</h2><div className="flex gap-2"><a className="rounded-xl border px-3 py-2 text-sm font-black" href={`/api/talent-marketplace?${authQs}&view=export`}><Download className="mr-1 inline h-4 w-4" />CSV</a><button onClick={compareSelected} className="rounded-xl border px-3 py-2 text-sm font-black"><GitCompare className="mr-1 inline h-4 w-4" />Compare {compareIds.length}</button></div></div><div className="grid gap-4 lg:grid-cols-3">{candidates.map((c) => <CandidateCard key={c.id} c={c} onView={() => setSelected(c)} onCopilot={(mode) => runCopilot(c, mode)} onCompare={() => toggleCompare(c.id)} selected={compareIds.includes(c.id)} onVisibility={(visibility, passport) => updateVisibility(c, visibility, passport)} />)}</div></div>
        {comparison.length ? <ComparisonTable rows={comparison} copilot={copilot} /> : null}
      </section> : null}

      {tab === "shortlists" ? <section className="rounded-3xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-black">Saved Shortlists</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-500"><th className="py-2">Candidate</th><th>Campaign</th><th>Status</th><th>Match</th><th>Reasons</th><th>Created</th></tr></thead><tbody>{shortlists.map((s) => <tr key={s.id} className="border-b"><td className="py-3 font-bold">{s.candidate_user_id}</td><td>{s.campaign_id || "—"}</td><td>{s.status}</td><td>{s.match_score || "—"}</td><td>{(s.reasons || []).slice(0, 2).join("; ")}</td><td>{new Date(s.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div>{!shortlists.length ? <Empty title="No saved shortlists" text="Use Match or Auto-shortlist from a campaign." /> : null}</section> : null}

      {tab === "activity" ? <section className="rounded-3xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-black">Marketplace Activity</h2><div className="mt-4 space-y-2">{activity.map((a) => <div key={a.id} className="rounded-2xl bg-slate-50 p-3 text-sm"><b>{a.action}</b> <span className="text-slate-500">{a.entity_type || ""}</span><span className="float-right text-xs text-slate-500">{new Date(a.created_at).toLocaleString()}</span></div>)}</div>{!activity.length ? <Empty title="No activity yet" text="Campaigns, notes, copilot actions and shortlists will appear here." /> : null}</section> : null}

      {tab === "integrations" ? <Integrations authQs={authQs} apiPost={apiPost} /> : null}

      {selected ? <CandidateModal c={selected} copilot={copilot} onClose={() => { setSelected(null); setCopilot([]); }} onCopilot={(mode) => runCopilot(selected, mode)} onVisibility={(visibility, passport) => updateVisibility(selected, visibility, passport)} onFlag={(severity) => flagForReview(selected, severity)} org={org} /> : null}
      {flagMsg ? <div className="fixed bottom-5 right-5 z-[60] rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-2xl">{flagMsg}</div> : null}
      {loading ? <div className="fixed bottom-4 right-4 rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-xl">Loading…</div> : null}
    </div>
  </main>;
}

function Dashboard({ stats, candidates, matches, onOpen }: { stats: any; candidates: Candidate[]; matches: Match[]; onOpen: (c: Candidate) => void }) { return <section className="space-y-5"><div className="grid gap-4 md:grid-cols-5"><Stat icon={Users} label="Candidates" value={stats.candidates || 0} /><Stat icon={Eye} label="Employer Visible" value={stats.employerVisible || 0} /><Stat icon={ShieldCheck} label="Verified" value={stats.verified || 0} /><Stat icon={Target} label="Employer Ready" value={stats.employerReady || 0} /><Stat icon={Activity} label="Avg WIRI" value={stats.averageWiri || 0} /></div><div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]"><div className="rounded-3xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-black">Top Talent</h2><div className="mt-4 grid gap-3">{matches.slice(0, 5).map((m) => <button key={m.candidate.id} onClick={() => onOpen(m.candidate)} className="flex items-center justify-between rounded-2xl border p-3 text-left hover:bg-slate-50"><div><b>{m.candidate.name}</b><p className="text-sm text-slate-500">{m.candidate.role}</p></div><b className={tone(m.matchScore)}>{m.matchScore}%</b></button>)}</div></div><div className="rounded-3xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-black">Marketplace Principle</h2><p className="mt-3 text-sm text-slate-600">WorkZo is not replacing an ATS. It proves interview readiness through CV + JD interviews, WIRI, and evidence. ATS remains the hiring workflow.</p></div></div></section>; }
function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: number }) { return <div className="rounded-3xl border bg-white p-5 shadow-sm"><Icon className="h-5 w-5 text-indigo-600" /><p className="mt-3 text-3xl font-black">{value}</p><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p></div>; }
function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) { return <label className="text-sm font-bold">{label}<input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal outline-none focus:border-indigo-400" /></label>; }
function Empty({ title, text }: { title: string; text: string }) { return <div className="mt-4 rounded-2xl border border-dashed p-8 text-center"><p className="font-black">{title}</p><p className="mt-1 text-sm text-slate-500">{text}</p></div>; }
function CampaignCard({ c, onMatch, onShortlist, exportHref }: { c: Campaign; onMatch: () => void; onShortlist: () => void; exportHref: string }) { return <article className="rounded-3xl border bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase text-indigo-600">{c.employer_name || c.employerName}</p><h3 className="text-xl font-black">{c.title}</h3><p className="text-sm text-slate-500">{c.role} · {c.location}</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{c.status}</span></div><div className="mt-3 flex flex-wrap gap-2">{(c.skills || []).slice(0, 6).map((s: string) => <span key={s} className="rounded-lg border px-2 py-1 text-xs">{s}</span>)}</div><div className="mt-4 grid gap-2 sm:grid-cols-3"><button onClick={onMatch} className="rounded-xl bg-slate-950 px-3 py-2 text-sm font-black text-white">Match</button><button onClick={onShortlist} className="rounded-xl border px-3 py-2 text-sm font-black">Auto-shortlist</button><a href={exportHref} className="rounded-xl border px-3 py-2 text-center text-sm font-black">Export CSV</a></div></article>; }
function CandidateCard({ c, onView, onCopilot, onCompare, selected, onVisibility }: { c: Candidate; onView: () => void; onCopilot: (mode: string) => void; onCompare: () => void; selected: boolean; onVisibility: (visibility: string, passport: boolean) => void }) { return <article className="rounded-3xl border p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h3 className="font-black">{c.name}</h3><p className="text-sm text-slate-600">{c.role}</p></div><div className={cx("text-2xl font-black", tone(c.wiri))}>{c.wiri}</div></div><div className="mt-3">{bar(c.wiri)}</div><div className="mt-3 flex flex-wrap gap-2 text-xs">{c.verified ? <span className="rounded-full bg-emerald-50 px-2 py-1 font-bold text-emerald-700">Verified</span> : null}<span className="rounded-full bg-slate-100 px-2 py-1">{c.availability}</span><span className="rounded-full bg-slate-100 px-2 py-1">{c.visibility}</span></div><p className="mt-3 line-clamp-2 text-sm text-slate-600">{c.summary}</p><div className="mt-3 flex flex-wrap gap-1">{(c.skills || []).slice(0, 5).map((s: string) => <span key={s} className="rounded-lg border px-2 py-1 text-xs">{s}</span>)}</div><div className="mt-4 grid grid-cols-2 gap-2"><button onClick={onView} className="rounded-xl bg-slate-950 px-3 py-2 text-sm font-bold text-white">View</button><button onClick={() => onCopilot("summary")} className="rounded-xl border px-3 py-2 text-sm font-bold">Copilot</button><button onClick={onCompare} className={cx("rounded-xl border px-3 py-2 text-sm font-bold", selected && "bg-indigo-50 text-indigo-700")}>Compare</button><button onClick={() => onVisibility(c.visibility === "verified_employers" ? "private" : "verified_employers", true)} className="rounded-xl border px-3 py-2 text-sm font-bold">Visibility</button></div></article>; }
function MatchCard({ m, onView, onShortlist, onCopilot, onCompare, selected }: { m: Match; onView: () => void; onShortlist: () => void; onCopilot: (mode: string) => void; onCompare: () => void; selected: boolean }) { const c = m.candidate; return <article className="rounded-3xl border p-4 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-xs font-black uppercase text-indigo-600">{m.band} match</p><h3 className="font-black">{c.name}</h3><p className="text-sm text-slate-600">{c.role}</p></div><div className={cx("text-3xl font-black", tone(m.matchScore))}>{m.matchScore}%</div></div><div className="mt-3">{bar(m.matchScore)}</div><ul className="mt-3 space-y-1 text-sm text-slate-700">{(m.reasons || []).slice(0, 3).map((r: string) => <li key={r}>✓ {r}</li>)}</ul>{m.cautions?.length ? <ul className="mt-2 space-y-1 text-sm text-amber-700">{m.cautions.slice(0, 2).map((r: string) => <li key={r}>⚠ {r}</li>)}</ul> : null}<div className="mt-4 grid grid-cols-2 gap-2"><button onClick={onView} className="rounded-xl bg-slate-950 px-3 py-2 text-sm font-bold text-white">Profile</button><button onClick={onShortlist} className="rounded-xl border px-3 py-2 text-sm font-bold"><Bookmark className="mr-1 inline h-4 w-4" />Shortlist</button><button onClick={() => onCopilot("questions")} className="rounded-xl border px-3 py-2 text-sm font-bold">Questions</button><button onClick={onCompare} className={cx("rounded-xl border px-3 py-2 text-sm font-bold", selected && "bg-indigo-50 text-indigo-700")}>Compare</button></div></article>; }
function ComparisonTable({ rows, copilot }: { rows: any[]; copilot: string[] }) { return <section className="rounded-3xl border bg-white p-5 shadow-sm"><h2 className="mb-4 text-xl font-black">Candidate Comparison</h2><div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm"><thead><tr className="border-b text-xs uppercase tracking-wide text-slate-500"><th className="py-2">Name</th><th>Role</th><th>WIRI</th><th>Communication</th><th>Technical</th><th>Confidence</th><th>Improvement</th><th>Recommendation</th></tr></thead><tbody>{rows.map((c) => <tr key={c.id} className="border-b"><td className="py-3 font-bold">{c.name}</td><td>{c.role}</td><td className={tone(c.wiri)}>{c.wiri}</td><td>{c.communication}</td><td>{c.technical}</td><td>{c.confidence}</td><td>+{c.improvement}%</td><td>{c.recommendation}</td></tr>)}</tbody></table></div>{copilot.length ? <div className="mt-4 rounded-2xl bg-indigo-50 p-4 text-sm text-indigo-950">{copilot.map((x) => <p key={x} className="mb-2 last:mb-0">{x}</p>)}</div> : null}</section>; }
function CandidateModal({ c, copilot, onClose, onCopilot, onVisibility, onFlag, org }: { c: Candidate; copilot: string[]; onClose: () => void; onCopilot: (mode: string) => void; onVisibility: (visibility: string, passport: boolean) => void; onFlag: (severity: string) => void; org: string }) { return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 p-4"><div className="mx-auto max-w-6xl rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wide text-indigo-600">Candidate Profile</p><h2 className="text-3xl font-black">{c.name}</h2><p className="text-slate-600">{c.role}</p></div><button onClick={onClose} className="rounded-xl border px-3 py-2 text-sm font-bold">Close</button></div><div className="mt-6 grid gap-4 md:grid-cols-5"><Info icon={MapPin} label="Location" value={c.location} /><Info icon={Languages} label="Languages" value={(c.languages || []).join(", ")} /><Info icon={Globe2} label="Availability" value={c.availability} /><Info icon={BadgeCheck} label="WIRI" value={`${c.wiri}`} /><Info icon={ShieldCheck} label="Visibility" value={c.visibility} /></div><div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.9fr]"><section className="rounded-3xl border p-5"><h3 className="font-black">AI Executive Summary</h3><p className="mt-2 text-sm text-slate-700">{c.summary}</p><h4 className="mt-5 font-black">Interview Evidence</h4><ul className="mt-2 space-y-2 text-sm">{(c.evidence || []).map((e: string) => <li key={e}>✓ {e}</li>)}</ul><h4 className="mt-5 font-black">Risks</h4><ul className="mt-2 space-y-2 text-sm text-amber-700">{(c.risks?.length ? c.risks : ["No major risks detected"]).map((e: string) => <li key={e}>⚠ {e}</li>)}</ul></section><section className="rounded-3xl border p-5"><h3 className="font-black">Interview Journey</h3><div className="mt-3 space-y-3">{(c.journey || []).map((j: any) => <div key={j.label} className="flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm"><span>{j.done ? "✓" : "○"} {j.label}</span><b>{j.value ?? ""}</b></div>)}</div></section></div><section className="mt-6 rounded-3xl border p-5"><h3 className="font-black">WIRI Breakdown</h3><div className="mt-4 grid gap-3 md:grid-cols-3">{Object.entries(c.wiriBreakdown || {}).map(([k, v]) => <div key={k} className="rounded-2xl bg-slate-50 p-3"><div className="flex justify-between text-sm"><span className="capitalize">{k.replace(/([A-Z])/g, " $1")}</span><b className={tone(Number(v))}>{String(v)}</b></div><div className="mt-2">{bar(Number(v))}</div></div>)}</div></section><section className="mt-6 rounded-3xl border p-5"><div className="flex flex-wrap gap-2"><button onClick={() => onCopilot("summary")} className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-bold text-white"><MessageSquareText className="mr-1 inline h-4 w-4" />Summarize</button><button onClick={() => onCopilot("recommendation")} className="rounded-xl border px-3 py-2 text-sm font-bold">Recommendation</button><button onClick={() => onCopilot("risk")} className="rounded-xl border px-3 py-2 text-sm font-bold">Risk</button><button onClick={() => onCopilot("questions")} className="rounded-xl border px-3 py-2 text-sm font-bold">Questions</button><button onClick={() => onFlag("high")} className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">⚑ Flag for review</button><button onClick={() => onFlag("exceptional")} className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">⭐ Exceptional</button><button onClick={() => onVisibility("verified_employers", true)} className="rounded-xl border px-3 py-2 text-sm font-bold"><Share2 className="mr-1 inline h-4 w-4" />Enable Passport</button>{c.passportEnabled ? <a href={`/talent-passport/${encodeURIComponent(c.passportSlug || c.id)}?org=${encodeURIComponent(org)}`} className="rounded-xl border px-3 py-2 text-sm font-bold"><Link2 className="mr-1 inline h-4 w-4" />Open Passport</a> : null}</div>{copilot.length ? <div className="mt-4 rounded-2xl bg-indigo-50 p-4 text-sm text-indigo-950">{copilot.map((x) => <p key={x} className="mb-2 last:mb-0">{x}</p>)}</div> : null}</section></div></div>; }
function Info({ icon: Icon, label, value }: { icon: any; label: string; value: string }) { return <div className="rounded-2xl border p-4"><Icon className="h-4 w-4 text-indigo-600" /><p className="mt-2 text-xs font-bold uppercase text-slate-500">{label}</p><p className="font-bold">{value}</p></div>; }
function Integrations({ authQs, apiPost }: { authQs: string; apiPost: (body: any) => Promise<any> }) { const [provider, setProvider] = useState("greenhouse"); const [status, setStatus] = useState("not_connected"); async function save() { const res = await apiPost({ action: "integration_config", provider, status: "configured", config: { mode: "placeholder", note: "Add provider credentials in environment variables before production sync." } }); setStatus(res.ok ? "configured" : "failed"); } return <section className="rounded-3xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-black">Enterprise Integrations</h2><p className="mt-2 text-sm text-slate-600">This implements the internal config/audit layer. Real ATS/SSO/HRIS production sync still needs provider credentials and customer-specific setup.</p><div className="mt-5 grid gap-3 md:grid-cols-3"><Input label="Provider" value={provider} onChange={setProvider} /><button onClick={save} className="mt-6 rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white">Save Config</button><a className="mt-6 rounded-xl border px-4 py-2 text-center text-sm font-black" href={`/api/talent-marketplace/webhooks?${authQs}`}>Webhook endpoint</a></div><p className="mt-4 text-sm font-bold">Status: {status}</p></section>; }
