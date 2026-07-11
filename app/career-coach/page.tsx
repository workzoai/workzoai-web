"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clipboard,
  Copy,
  FileText,
  Lock,
  PlayCircle,
  Send,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import {
  buildCareerBrain,
  hydrateCareerMemoryFromServer,
  saveCareerMemory,
  type CareerRoadmapItem,
  type PhaseCCareerBrain,
} from "@/lib/workzoCareerMemory";
import { fetchWorkZoAuthoritativePlan } from "@/lib/workzoClientPlan";
import { normalizeWorkZoPlan } from "@/lib/workzoPlanLimits";
import { readLatestInterviewSetup } from "@/lib/workzoInterviewSetup";

type CoachTurn = { role: "user" | "assistant"; content: string };
type TaskStatus = "todo" | "in_progress" | "applied" | "verified";
type SetupSnapshot = {
  cvText: string;
  jobDescription: string;
  targetRole: string;
  targetMarket: string;
  companyName: string;
};

type EvidenceInstance = {
  source: string;
  location: string;
  excerpt: string;
  explanation: string;
};

const TASK_STATE_KEY = "workzo-career-coach-task-state-v1";

function clean(value: unknown, fallback = "") {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() || fallback : fallback;
}

function roleFamily(role: string) {
  const lower = role.toLowerCase();
  if (/system|infrastructure|support|service desk|helpdesk|network|administrator/.test(lower)) return "technical support and system integration";
  if (/data|analyst|science|bi|business intelligence/.test(lower)) return "data and analytics";
  if (/customer success|account|client/.test(lower)) return "customer success";
  if (/product/.test(lower)) return "product management";
  if (/marketing|growth/.test(lower)) return "marketing";
  return role || "your target role";
}

function firstUsefulSentence(text: string, fallback: string) {
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/^[•\-–—\s]+/, "").trim())
    .filter((line) => line.length >= 24 && line.length <= 220 && !/@|linkedin|www\.|http/i.test(line));
  return lines[0] || fallback;
}

function extractMetricSentence(text: string) {
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  return sentences.find((s) => /\b\d+(?:\.\d+)?%|\b\d+\s*(?:hours?|days?|weeks?|tickets?|users?|customers?|clients?)\b/i.test(s)) || "";
}

function statusLabel(status: TaskStatus) {
  if (status === "in_progress") return "In progress";
  if (status === "applied") return "Applied";
  if (status === "verified") return "Verified";
  return "To do";
}

function nextStatus(status: TaskStatus): TaskStatus {
  if (status === "todo") return "in_progress";
  if (status === "in_progress") return "applied";
  if (status === "applied") return "verified";
  return "todo";
}

function gainNumber(gain: string) {
  const numbers = gain.match(/\d+/g)?.map(Number) || [];
  if (!numbers.length) return 4;
  return Math.round(numbers.reduce((a, b) => a + b, 0) / numbers.length);
}

function roadmapExample(item: CareerRoadmapItem, setup: SetupSnapshot) {
  const role = roleFamily(setup.targetRole);
  const base = firstUsefulSentence(
    setup.cvText,
    item.id === "add_metrics"
      ? "Resolved customer issues and supported users with technical problems."
      : item.id === "clarify_ownership"
        ? "Worked with the team to investigate and resolve a customer issue."
        : item.id === "tighten_star"
          ? "I handled a difficult issue and eventually solved it for the customer."
          : "My CV and interview describe the same experience in different ways.",
  );
  const metricEvidence = extractMetricSentence(setup.cvText);

  if (item.id === "add_metrics") {
    return {
      context: `For ${role} roles, recruiters look for SLA attainment, ticket volume, downtime reduction, users supported, resolution speed, or measurable quality improvement.`,
      before: base,
      after: metricEvidence || `Resolved priority support issues within agreed SLAs, documented the root cause, and reduced repeat escalations by a truthful, verifiable amount.`,
      destination: "Improve CV",
    };
  }
  if (item.id === "clarify_ownership") {
    return {
      context: `For ${role} roles, separate your contribution from the wider team's result.`,
      before: base,
      after: `I personally diagnosed the issue, documented the evidence, coordinated the escalation, and followed through until the customer confirmed resolution.`,
      destination: "Interview story",
    };
  }
  if (item.id === "tighten_star") {
    return {
      context: `Keep your ${role} stories to 60–90 seconds: context, responsibility, action, measurable result, and role connection.`,
      before: base,
      after: `A customer faced a high-priority issue. I owned the diagnosis, reproduced the problem, coordinated the fix, and confirmed the outcome. As a result, the issue was resolved within the agreed timeframe and the customer could continue working.`,
      destination: "Practice drill",
    };
  }
  if (item.id === "fix_consistency") {
    return {
      context: `Align titles, dates, scope, and claimed skills before a recruiter compares your CV, LinkedIn, and interview answers.`,
      before: base,
      after: `Use one verified title and one consistent timeline across your CV, LinkedIn, cover letter, and interview narrative. Add context only where the official title differs from the work performed.`,
      destination: "Profile consistency",
    };
  }
  return {
    context: `Practice one focused ${role} story and verify the improvement in your next simulation.`,
    before: base,
    after: `Use one concrete example, make your ownership explicit, and close with a truthful result.`,
    destination: "Interview",
  };
}

function weaknessEvidence(label: string, brain: PhaseCCareerBrain, setup: SetupSnapshot): EvidenceInstance[] {
  const lower = label.toLowerCase();
  const history = brain.memory.interviewHistory || [];
  const instances: EvidenceInstance[] = [];
  const cvExcerpt = firstUsefulSentence(setup.cvText, "No CV excerpt is available in the current browser session.");

  for (const [index, interview] of history.slice(0, 8).entries()) {
    const sourceSignal = interview.recurringSignals.find((signal) => {
      if (lower.includes("metric")) return signal === "missing_metrics";
      if (lower.includes("ownership")) return signal === "weak_ownership";
      if (lower.includes("structure")) return signal === "weak_structure";
      if (lower.includes("confidence")) return signal === "confidence_drop";
      if (lower.includes("contradiction")) return signal === "contradiction_risk";
      return signal === "vague_answer" || signal === "rambling";
    });
    if (!sourceSignal) continue;
    instances.push({
      source: "Mock interview",
      location: `${interview.targetRole} · ${new Date(interview.date).toLocaleDateString()}`,
      excerpt: interview.biggestBlocker || `This session recorded ${label.toLowerCase()} as a recurring risk.`,
      explanation: `Score ${interview.score}, evidence ${interview.evidence}, ownership ${interview.ownership}, structure ${interview.structure}.`,
    });
    if (instances.length >= 5) break;
    if (index > 5) break;
  }

  if (lower.includes("metric")) {
    instances.unshift({
      source: "CV evidence",
      location: setup.targetRole || "Current target role",
      excerpt: cvExcerpt,
      explanation: /\d|%/.test(cvExcerpt)
        ? "This line already contains proof. Reuse the verified metric in your interview answer."
        : "This line describes work but does not yet show scale, speed, quality, or outcome.",
    });
  } else if (lower.includes("ownership")) {
    instances.unshift({
      source: "CV / interview narrative",
      location: setup.targetRole || "Current target role",
      excerpt: cvExcerpt,
      explanation: "Lead with what you personally diagnosed, decided, built, implemented, or delivered before describing the team result.",
    });
  } else if (lower.includes("contradiction")) {
    instances.unshift({
      source: "Cross-feature consistency",
      location: "CV, LinkedIn, cover letter, and interview",
      excerpt: `Target role: ${setup.targetRole || "Not set"}. Company: ${setup.companyName || "Not set"}.`,
      explanation: "Use the same verified title, dates, responsibilities, and skill claims everywhere.",
    });
  }

  return instances.length
    ? instances
    : [{
        source: "Career memory",
        location: "Historical pattern",
        excerpt: `${label} was recorded repeatedly, but detailed historical snippets are not available for older sessions.`,
        explanation: "Complete another simulation to attach exact question-and-answer evidence to this pattern.",
      }];
}

export default function CareerCoachPage() {
  const [brain, setBrain] = useState<PhaseCCareerBrain | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeWeakness, setActiveWeakness] = useState<number | null>(null);
  const [drawerWeakness, setDrawerWeakness] = useState<number | null>(null);
  const [openRoadmap, setOpenRoadmap] = useState<string | null>(null);
  const [taskStates, setTaskStates] = useState<Record<string, TaskStatus>>({});
  const [copied, setCopied] = useState<string>("");
  const [coachQuery, setCoachQuery] = useState("");
  const [coachTurns, setCoachTurns] = useState<CoachTurn[]>([]);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState("");
  const [setup, setSetup] = useState<SetupSnapshot>({ cvText: "", jobDescription: "", targetRole: "", targetMarket: "Global", companyName: "" });

  const appliedGain = useMemo(() => {
    if (!brain) return 0;
    return brain.roadmap.reduce((total, item) => {
      const status = taskStates[item.id] || (item.completed ? "applied" : "todo");
      return total + (status === "applied" || status === "verified" ? gainNumber(item.estimatedGain) : 0);
    }, 0);
  }, [brain, taskStates]);

  const projectedProbability = brain ? Math.min(98, brain.probability.current + appliedGain) : 0;

  async function copyText(id: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(id);
      window.setTimeout(() => setCopied(""), 1600);
    } catch {}
  }

  function persistTaskStatus(item: CareerRoadmapItem, status: TaskStatus) {
    const next = { ...taskStates, [item.id]: status };
    setTaskStates(next);
    try { window.localStorage.setItem(TASK_STATE_KEY, JSON.stringify(next)); } catch {}
    if (!brain) return;
    const roadmap = brain.memory.roadmap?.map((entry) => entry.id === item.id ? { ...entry, completed: status === "applied" || status === "verified", updatedAt: new Date().toISOString() } : entry) || [];
    const memory = { ...brain.memory, roadmap, updatedAt: new Date().toISOString() };
    saveCareerMemory(memory);
    setBrain(buildCareerBrain({}, memory));
  }

  async function askCoach(prefill?: string) {
    const prompt = clean(prefill ?? coachQuery);
    if (!prompt || coachLoading) return;
    const history = [...coachTurns, { role: "user" as const, content: prompt }];
    setCoachTurns(history);
    setCoachQuery("");
    setCoachError("");
    setCoachLoading(true);
    try {
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "career",
          action: "career_chat",
          message: prompt,
          cvText: setup.cvText,
          jobDescription: setup.jobDescription,
          targetRole: setup.targetRole,
          targetMarket: setup.targetMarket,
          history: history.slice(-9, -1).map((t) => ({ role: t.role, content: t.content })),
        }),
      });
      const data = (await response.json().catch(() => null)) as { success?: boolean; output?: string; error?: string } | null;
      if (!response.ok || !data?.success) {
        if (data?.error === "upgrade_required" || data?.error === "upgrade_required_rate_limit") {
          setCoachTurns((cur) => [...cur, { role: "assistant", content: "Deep Memory Consult is part of Premium Pro." }]);
          return;
        }
        throw new Error("The coach couldn't respond just now. Please try again.");
      }
      setCoachTurns((cur) => [...cur, { role: "assistant", content: data.output || "No response was generated." }]);
    } catch (err) {
      setCoachError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setCoachLoading(false);
    }
  }

  useEffect(() => {
    const latest = (readLatestInterviewSetup() || {}) as Record<string, unknown>;
    setSetup({
      cvText: clean(latest.cvText || latest.rawCvText),
      jobDescription: clean(latest.jobDescription),
      targetRole: clean(latest.targetRole || latest.role, "Target role"),
      targetMarket: clean(latest.targetMarket, "Global"),
      companyName: clean(latest.companyName || latest.company),
    });
    try {
      const raw = window.localStorage.getItem(TASK_STATE_KEY);
      if (raw) setTaskStates(JSON.parse(raw) as Record<string, TaskStatus>);
    } catch {}
    fetchWorkZoAuthoritativePlan().then((r) => setIsPro(normalizeWorkZoPlan(r.plan) === "premium_pro")).catch(() => {});
    hydrateCareerMemoryFromServer()
      .then((memory) => setBrain(buildCareerBrain({}, memory)))
      .catch(() => setBrain(buildCareerBrain()))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-canvas"><div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" /></div>;

  const selectedWeakness = drawerWeakness !== null && brain ? brain.persistentWeaknesses[drawerWeakness] : null;
  const selectedEvidence = selectedWeakness && brain ? weaknessEvidence(selectedWeakness.label, brain, setup) : [];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 text-fg sm:px-6">
      <Link href="/dashboard" className="mb-8 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-fg"><ArrowLeft className="h-4 w-4" /> Back to Dashboard</Link>

      <div className="mb-8 flex items-center justify-between border-b border-line pb-6">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand shadow-sm"><BrainCircuit className="h-6 w-6" /></div>
          <div>
            <p className="inline-flex rounded-md bg-brand/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-brand">Premium Pro Tier</p>
            <h1 className="mt-0.5 text-2xl font-black tracking-tight">AI Career Coach</h1>
          </div>
        </div>
        <p className="hidden max-w-[250px] text-right text-xs leading-5 text-muted sm:block">Evidence-backed coaching that updates after every simulation.</p>
      </div>

      {!isPro ? (
        <div className="rounded-2xl border border-brand/20 bg-gradient-to-b from-brand/[0.04] to-transparent p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-brand/10 text-brand"><Lock className="h-5 w-5" /></div>
          <h2 className="text-xl font-black tracking-tight">Unlock Your Multi-Session Intelligence</h2>
          <p className="mx-auto mb-6 mt-2 max-w-md text-sm leading-relaxed text-muted">Premium Pro connects your CV, applications, interviews, and historical coaching patterns.</p>
          <Link href="/pricing?plan=premium_pro" className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-black text-white shadow-lg shadow-brand/20">Upgrade to Premium Pro</Link>
        </div>
      ) : !brain || !brain.persistentWeaknesses?.length ? (
        <div className="rounded-2xl border border-line bg-fg/[0.01] p-10 text-center">
          <BrainCircuit className="mx-auto mb-4 h-10 w-10 text-muted" />
          <h2 className="text-xl font-black">Your Career Brain is Cold</h2>
          <p className="mx-auto mb-6 mt-2 max-w-md text-sm text-muted">Complete a simulation to populate your evidence-backed coaching workspace.</p>
          <Link href="/onboarding" className="inline-flex rounded-xl bg-brand px-6 py-3 text-sm font-black text-white">Start First Simulation</Link>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
            <section className="rounded-2xl border border-line bg-fg/[0.01] p-5 shadow-sm md:col-span-3">
              <div className="mb-4 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-brand" /><h2 className="text-xs font-black uppercase tracking-[0.18em] text-muted">Interview Probability Engine</h2></div>
              <div className="space-y-4">
                {[
                  { label: "Current verified readiness", value: brain.probability.current, color: "bg-warning", desc: "Based on demonstrated evidence from completed assessments." },
                  { label: "Projected after selected fixes", value: Math.max(brain.probability.afterCv, projectedProbability), color: "bg-brand", desc: "Projection only. Pending verification in your next simulation." },
                  { label: "Prepared-state potential", value: Math.max(brain.probability.afterPrep, projectedProbability), color: "bg-success", desc: "Requires both applied profile fixes and improved interview delivery." },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="mb-1 flex items-baseline justify-between"><span className="text-xs font-semibold">{row.label}</span><span className="text-sm font-black">{row.value}%</span></div>
                    <div className="h-2.5 rounded-full bg-fg/[0.06] p-[2px]"><div className={`h-full rounded-full ${row.color} transition-all duration-700`} style={{ width: `${row.value}%` }} /></div>
                    <p className="mt-1 text-[10px] text-muted">{row.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-fg/[0.01] p-5 shadow-sm md:col-span-2">
              <div className="mb-4 flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand" /><h2 className="text-xs font-black uppercase tracking-[0.18em] text-muted">Cross-App Optimization</h2></div>
              <div className="space-y-2">
                {brain.crossFeatureActions.slice(0, 4).map((a, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-xl border border-line/50 bg-canvas p-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    <div><p className="text-[9px] font-black uppercase tracking-wider text-brand">{a.feature}</p><p className="text-[11px] leading-4 text-muted">{a.action}</p></div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="rounded-2xl border border-warning/25 bg-warning/[0.025] p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" /><h2 className="text-xs font-black uppercase tracking-[0.18em] text-warning">Persistent Behavioral Flaws</h2></div>
              <p className="text-[10px] text-muted">Click a row to inspect the evidence.</p>
            </div>
            <div className="space-y-3">
              {brain.persistentWeaknesses.map((w, i) => {
                const isOpen = activeWeakness === i;
                return (
                  <div key={w.label} className="overflow-hidden rounded-xl border border-line/60 bg-canvas">
                    <button onClick={() => setActiveWeakness(isOpen ? null : i)} className="flex w-full items-center justify-between p-4 text-left">
                      <div className="flex min-w-0 items-center gap-3"><span className="h-2.5 w-2.5 rounded-full bg-danger" /><p className="truncate text-sm font-black">{w.label}</p></div>
                      <div className="flex shrink-0 items-center gap-3"><span className="rounded-md bg-warning/10 px-2 py-0.5 font-mono text-[10px] font-black uppercase text-warning">seen {w.count}x</span><ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`} /></div>
                    </button>
                    {isOpen && (
                      <div className="border-t border-line/50 px-4 py-4">
                        <p className="text-xs leading-5 text-muted">{w.coachLine}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button onClick={() => setDrawerWeakness(i)} className="inline-flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs font-black text-warning"><FileText className="h-3.5 w-3.5" /> View exact instances</button>
                          <button onClick={() => void askCoach(`Show me how to fix ${w.label.toLowerCase()} using evidence from my CV and recent interviews.`)} className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-black"><BrainCircuit className="h-3.5 w-3.5" /> Ask coach</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-fg/[0.01] p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xs font-black uppercase tracking-[0.18em] text-muted">Strategic Execution Roadmap</h2><p className="text-[10px] text-muted">Apply fixes, then verify them in your next simulation.</p></div>
            <div className="space-y-3">
              {brain.roadmap.map((item, i) => {
                const open = openRoadmap === item.id;
                const status = taskStates[item.id] || (item.completed ? "applied" : "todo");
                const example = roadmapExample(item, setup);
                return (
                  <article key={item.id} className={`overflow-hidden rounded-xl border transition-all ${open ? "border-brand/40 bg-brand/[0.015]" : "border-line/60 bg-canvas"}`}>
                    <div className="flex items-stretch">
                      <button onClick={() => persistTaskStatus(item, nextStatus(status))} className="grid w-14 shrink-0 place-items-center border-r border-line/50" title="Change task status">
                        {status === "verified" ? <CheckCircle2 className="h-5 w-5 text-success" /> : status === "applied" ? <Check className="h-5 w-5 text-brand" /> : status === "in_progress" ? <Circle className="h-5 w-5 fill-warning/20 text-warning" /> : <Circle className="h-5 w-5 text-muted" />}
                      </button>
                      <button onClick={() => setOpenRoadmap(open ? null : item.id)} className="flex min-w-0 flex-1 items-center justify-between gap-4 p-4 text-left">
                        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-full bg-brand text-[10px] font-black text-white">{i + 1}</span><p className="text-sm font-black">{item.title}</p><span className="rounded-md bg-fg/[0.05] px-2 py-0.5 text-[9px] font-black uppercase text-muted">{statusLabel(status)}</span></div><p className="mt-1 pl-8 text-xs leading-5 text-muted">{example.context}</p></div>
                        <div className="flex shrink-0 items-center gap-3"><span className="rounded-md bg-success/10 px-2 py-0.5 text-[10px] font-black text-success">{item.estimatedGain}</span><ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} /></div>
                      </button>
                    </div>
                    {open && (
                      <div className="border-t border-line/50 p-4 sm:p-5">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-xl border border-danger/20 bg-danger/[0.035] p-4"><p className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-danger">From your profile</p><p className="text-xs leading-6 text-fg">{example.before}</p></div>
                          <div className="rounded-xl border border-success/25 bg-success/[0.035] p-4"><p className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-success">AI-optimized upgrade</p><p className="text-xs leading-6 text-fg">{example.after}</p></div>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <p className="text-[10px] text-muted">Destination: {example.destination}. Only verified facts should be applied.</p>
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => void copyText(item.id, example.after)} className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-black">{copied === item.id ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />} {copied === item.id ? "Copied" : "Copy"}</button>
                            <button onClick={() => persistTaskStatus(item, "applied")} className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-xs font-black text-white"><Sparkles className="h-3.5 w-3.5" /> Mark fix applied</button>
                            <button onClick={() => void askCoach(`Turn this ${item.title.toLowerCase()} improvement into a realistic answer for ${setup.targetRole}: ${example.after}`)} className="inline-flex items-center gap-2 rounded-lg bg-fg px-3 py-2 text-xs font-black text-canvas"><PlayCircle className="h-3.5 w-3.5" /> Practice story</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-brand/20 bg-gradient-to-r from-brand/[0.025] to-transparent p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2"><BrainCircuit className="h-4 w-4 text-brand" /><h2 className="text-xs font-black uppercase tracking-[0.18em] text-brand">Deep Memory Consult</h2></div>
            <p className="mb-3 text-xs leading-5 text-muted">Ask about exact recurring patterns, verified CV proof, target-role strategy, or changes since your previous interview.</p>
            <div className="mb-4 flex flex-wrap gap-2">
              {["Show where I lacked ownership", "Which metrics can my CV prove?", "Rewrite my weakest interview story", "What improved since my previous interview?"].map((prompt) => <button key={prompt} onClick={() => void askCoach(prompt)} className="rounded-full border border-brand/20 bg-canvas px-3 py-1.5 text-[10px] font-bold text-brand hover:bg-brand/5">{prompt}</button>)}
            </div>
            {(coachTurns.length > 0 || coachLoading) && <div className="mb-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">{coachTurns.map((turn, i) => <div key={i} className={turn.role === "user" ? "ml-8 rounded-xl border border-line bg-brand/[0.06] px-3.5 py-2.5" : "mr-8 rounded-xl border border-line bg-canvas px-3.5 py-2.5"}><p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted">{turn.role === "user" ? "You" : "Coach"}</p><p className="mt-1 whitespace-pre-wrap text-xs leading-6">{turn.content}</p></div>)}{coachLoading && <div className="mr-8 rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-xs text-muted">Consulting your history…</div>}</div>}
            {coachError && <p className="mb-3 text-xs font-bold text-danger">{coachError}</p>}
            <form onSubmit={(e) => { e.preventDefault(); void askCoach(); }} className="flex gap-2"><input value={coachQuery} onChange={(e) => setCoachQuery(e.target.value)} disabled={coachLoading} placeholder="Ask about your evidence, target role, or next interview..." className="w-full rounded-xl border border-line bg-canvas px-3.5 py-2 text-xs focus:border-brand focus:outline-none" /><button type="submit" disabled={coachLoading || !coachQuery.trim()} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-white disabled:opacity-40"><Send className="h-4 w-4" /></button></form>
          </section>
        </div>
      )}

      {selectedWeakness && brain && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-[2px]" onClick={() => setDrawerWeakness(null)}>
          <aside className="h-full w-full max-w-xl overflow-y-auto bg-canvas p-5 shadow-2xl sm:p-7" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-warning">Evidence explorer</p><h2 className="mt-1 text-xl font-black">{selectedWeakness.label}</h2><p className="mt-2 text-xs leading-5 text-muted">Detected {selectedWeakness.count} times. Below are the strongest available evidence sources, not synthetic duplicates.</p></div><button onClick={() => setDrawerWeakness(null)} className="grid h-9 w-9 place-items-center rounded-lg border border-line"><X className="h-4 w-4" /></button></div>
            <div className="space-y-3">{selectedEvidence.map((instance, i) => <div key={`${instance.location}-${i}`} className="rounded-xl border border-line bg-fg/[0.015] p-4"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><span className="rounded-md bg-brand/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-brand">{instance.source}</span><span className="text-[10px] text-muted">{instance.location}</span></div><blockquote className="border-l-2 border-warning pl-3 text-xs leading-6 text-fg">{instance.excerpt}</blockquote><p className="mt-3 text-[11px] leading-5 text-muted">{instance.explanation}</p></div>)}</div>
            <div className="mt-6 grid gap-2 sm:grid-cols-2"><button onClick={() => { setDrawerWeakness(null); void askCoach(`Use the evidence for ${selectedWeakness.label.toLowerCase()} and give me one exact correction.`); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-xs font-black text-white"><BrainCircuit className="h-4 w-4" /> Ask for exact correction</button><button onClick={() => { const item = brain.roadmap.find((r) => r.id.includes(selectedWeakness.label.toLowerCase().includes("metric") ? "metric" : selectedWeakness.label.toLowerCase().includes("ownership") ? "ownership" : "star")); if (item) setOpenRoadmap(item.id); setDrawerWeakness(null); }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-line px-4 py-3 text-xs font-black"><Target className="h-4 w-4" /> Open matching roadmap task</button></div>
          </aside>
        </div>
      )}
    </main>
  );
}
