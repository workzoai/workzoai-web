"use client";

import Link from "next/link";
import PremiumFeatureGate from "@/components/PremiumFeatureGate";
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronDown, Copy, FileText, Gauge, Loader2, Target, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  normalizeSetupCvText,
  normalizeSetupJobDescription,
  normalizeSetupTargetRole,
  readLatestInterviewSetup,
} from "@/lib/workzoInterviewSetup";
import { buildPhaseAInsights } from "@/lib/workzoCareerSuitePhaseA";
import { buildPhaseBInsights } from "@/lib/workzoCareerSuitePhaseB";

const OUTPUT_LANGUAGES = [
  { value: "English", label: "🇬🇧 English" },
  { value: "German", label: "🇩🇪 Deutsch" },
  { value: "Dutch", label: "🇳🇱 Nederlands" },
  { value: "French", label: "🇫🇷 Français" },
  { value: "Spanish", label: "🇪🇸 Español" },
  { value: "Italian", label: "🇮🇹 Italiano" },
  { value: "Portuguese", label: "🇵🇹 Português" },
  { value: "Chinese", label: "🇨🇳 中文" },
  { value: "Arabic", label: "🇸🇦 العربية" },
  { value: "Polish", label: "🇵🇱 Polski" },
];

function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function CollapsibleSection({
  title,
  eyebrow,
  defaultOpen = false,
  children,
}: {
  title: string;
  eyebrow: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{eyebrow}</p>
          <h3 className="mt-1 text-lg font-black text-white">{title}</h3>
        </div>
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="border-t border-white/10 px-5 pb-5 pt-4">{children}</div>}
    </div>
  );
}

export default function CoverLetterWorkspacePage() {
  const [cvText, setCvText] = useState("");
  const [resumeProfile, setResumeProfile] = useState<any>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [targetMarket, setTargetMarket] = useState("");
  const [outputLanguage, setOutputLanguage] = useState("English");
  const [generated, setGenerated] = useState("");
  const [loading, setLoading] = useState(false);
  const [cvTextExpanded, setCvTextExpanded] = useState(false);
  const [copyConfirmed, setCopyConfirmed] = useState(false);

  useEffect(() => {
    const setup = readLatestInterviewSetup();
    import("@/lib/workzoInterviewSetup").then(({ normalizeSetupCvText: normCv, normalizeSetupJobDescription: normJd, normalizeSetupTargetRole: normRole, normalizeSetupTargetMarket: normMarket }) => {
      setCvText(normCv(setup));
      setJobDescription(normJd(setup));
      setTargetRole(normRole(setup));
      setTargetMarket(normMarket ? normMarket(setup) : String(setup?.targetMarket || setup?.country || "Global"));
      if (setup?.resumeProfile && typeof setup.resumeProfile === "object") {
        setResumeProfile(setup.resumeProfile);
      }
    }).catch(() => {
      setCvText(String(setup?.cvText || setup?.uploadedCvText || setup?.resumeText || ""));
      setJobDescription(String(setup?.jobDescription || setup?.jdText || ""));
      setTargetRole(String(setup?.targetRole || setup?.role || ""));
      if (setup?.resumeProfile && typeof setup.resumeProfile === "object") {
        setResumeProfile(setup.resumeProfile);
      }
    });
  }, []);

  const phaseA = useMemo(() => buildPhaseAInsights({ cvText, jobDescription, targetRole }), [cvText, jobDescription, targetRole]);
  const phaseB = useMemo(
    () => buildPhaseBInsights({ cvText, jobDescription, targetRole, coverLetterText: generated }),
    [cvText, jobDescription, targetRole, generated],
  );

  async function handleGenerate() {
    if (!cvText.trim()) {
      setGenerated("Please add your CV text before generating a cover letter.");
      return;
    }
    setLoading(true);
    setGenerated("");
    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "cover_letter",
          cvText,
          jobDescription,
          targetRole,
          targetMarket,
          outputLanguage,
        }),
      });

      const data = (await res.json().catch(() => null)) as { success?: boolean; output?: string; error?: string } | null;
      const text = data?.output?.trim();

      if (data?.success && text) {
        setGenerated(text);
      } else {
        throw new Error(data?.error || "empty response");
      }
    } catch {
      try {
        const mod = await import("@/lib/workzoWorkspaceGenerators");
        setGenerated(mod.generateCoverLetter({ cvText, jobDescription, targetRole, targetMarket, resumeProfile }));
      } catch {
        setGenerated("Generation failed. Please check your connection and try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!generated) return;
    await navigator.clipboard.writeText(generated);
    setCopyConfirmed(true);
    setTimeout(() => setCopyConfirmed(false), 1800);
  }

  const jdReady = jobDescription.trim().length > 0;
  const cvReady = cvText.trim().length > 0;

  return (
    <PremiumFeatureGate feature="cover_letter" title="Cover Letter is a Premium feature" description="Role-specific cover letters based on your CV and job description are included in Premium.">
      <main className="min-h-screen bg-[#020817] px-4 py-6 text-white sm:px-5">
        <header className="mx-auto mb-6 flex max-w-6xl items-center justify-between rounded-3xl border border-white/10 bg-white/[0.035] px-4 py-3">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-black text-slate-300 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <div className="flex items-center gap-2 text-sm font-black text-slate-300"><FileText className="h-4 w-4" /> Cover Letter</div>
        </header>

        {/* ── Step 1: generate for this job ─────────────────────────────── */}
        <section className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-500/20 text-blue-200">
              <Wand2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Generate a cover letter</h1>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Paste the job description, pick a language, and WorkZo drafts a letter grounded in your real CV.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">Job description</span>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={7}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 outline-none focus:border-blue-400"
                placeholder="Paste the job description here — this is what the letter targets."
              />
            </label>

            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[.18em] text-slate-400">Target role</span>
                  <input value={targetRole} onChange={(e) => setTargetRole(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-blue-400" placeholder="e.g. Data Analyst" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[.18em] text-slate-400">Letter language</span>
                  <select
                    value={outputLanguage}
                    onChange={(e) => setOutputLanguage(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-bold outline-none focus:border-blue-400"
                  >
                    {OUTPUT_LANGUAGES.map((l) => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <button
                type="button"
                onClick={() => setCvTextExpanded((v) => !v)}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left text-sm font-bold text-slate-300 transition hover:bg-black/30"
              >
                <span className="flex items-center gap-2">
                  <CheckCircle2 className={cn("h-4 w-4", cvReady ? "text-emerald-400" : "text-slate-600")} />
                  {cvReady ? "CV loaded from your profile" : "No CV text yet — add it below"}
                </span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", cvTextExpanded && "rotate-180")} />
              </button>

              {cvTextExpanded && (
                <textarea
                  value={cvText}
                  onChange={(e) => setCvText(e.target.value)}
                  rows={6}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 outline-none focus:border-blue-400"
                  placeholder="Upload a CV during onboarding or paste CV text here."
                />
              )}

              <button
                onClick={handleGenerate}
                disabled={loading || !cvReady}
                title={!cvReady ? "Add your CV text first" : undefined}
                className="mt-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-400 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                {loading ? "Writing your letter…" : generated ? "Generate again" : "Generate cover letter"}
              </button>
              {!jdReady && <p className="text-xs text-slate-500">Adding a job description sharpens the letter — works without one too.</p>}
            </div>
          </div>
        </section>

        {/* ── Step 2: your draft ────────────────────────────────────────── */}
        <section className="mx-auto mt-6 max-w-6xl rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black">Draft</h2>
            <button onClick={handleCopy} disabled={!generated} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2 text-xs font-black text-slate-200 transition hover:bg-white/[0.09] disabled:opacity-40">
              <Copy className="h-3.5 w-3.5" /> {copyConfirmed ? "Copied!" : "Copy"}
            </button>
          </div>
          <pre className="mt-4 min-h-[420px] whitespace-pre-wrap rounded-2xl bg-black/20 p-5 text-sm leading-7 text-slate-200">
            {generated || "Your cover letter draft will appear here after generation."}
          </pre>
        </section>

        {/* ── Step 3: why this works (collapsed insights) ─────────────────── */}
        <section className="mx-auto mt-6 max-w-6xl space-y-4">
          <CollapsibleSection eyebrow="Application intelligence" title={phaseA.hiringRecommendation} defaultOpen={false}>
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm leading-6 text-slate-300">{phaseA.recruiterScan.firstImpression}</p>
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-cyan-300/20 bg-black/25 text-center">
                <p className="text-xl font-black text-cyan-100">{phaseA.readinessScore}</p>
                <p className="-mt-1 text-[9px] font-black text-slate-500">READY</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-black text-emerald-200"><CheckCircle2 className="h-4 w-4" /> Match signals</div>
                <div className="space-y-2">
                  {phaseA.missingRequirements.slice(0, 4).map((item) => (
                    <p key={item.label} className="text-sm leading-6 text-slate-300">
                      {item.status === "matched" ? "✓" : item.status === "partial" ? "~" : "!"} {item.label}
                    </p>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-black text-amber-200"><AlertTriangle className="h-4 w-4" /> Letter risks to avoid</div>
                <div className="space-y-2">
                  {phaseA.objections.slice(0, 3).map((item) => <p key={item.title} className="text-sm leading-6 text-slate-300">• {item.title}</p>)}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3"><Gauge className="mb-2 h-4 w-4 text-blue-200" /><p className="text-xs text-slate-400">Current chance</p><p className="text-xl font-black">{phaseA.interviewProbability.current}%</p></div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3"><Target className="mb-2 h-4 w-4 text-blue-200" /><p className="text-xs text-slate-400">After CV fix</p><p className="text-xl font-black">{phaseA.interviewProbability.afterCvFix}%</p></div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3"><FileText className="mb-2 h-4 w-4 text-blue-200" /><p className="text-xs text-slate-400">After prep</p><p className="text-xl font-black">{phaseA.interviewProbability.afterInterviewPrep}%</p></div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection eyebrow="Letter intelligence" title={phaseB.companyDNA.label} defaultOpen={false}>
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm leading-6 text-slate-300">{phaseB.companyDNA.coverLetterRule}</p>
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-blue-300/20 bg-black/25 text-center">
                <p className="text-xl font-black text-blue-100">{phaseB.coverLetter.riskScore}</p>
                <p className="-mt-1 text-[9px] font-black text-slate-500">SAFE</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-black text-emerald-200">Hiring manager hooks</p>
                <div className="mt-3 space-y-3">
                  {phaseB.coverLetter.hooks.slice(0, 3).map((hook) => (
                    <div key={hook.style} className="rounded-xl bg-white/[0.03] p-3">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{hook.style}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-300">{hook.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-black text-amber-200">Risk scanner</p>
                <div className="mt-3 space-y-2">
                  {phaseB.coverLetter.riskFlags.map((item) => (
                    <p key={item} className="text-sm leading-6 text-slate-300">• {item}</p>
                  ))}
                </div>
                <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Readability</p>
                  <p className="mt-1 text-sm font-black text-white">{phaseB.coverLetter.readability.verdict} · {phaseB.coverLetter.readability.estimatedReadingSeconds}s read</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{phaseB.coverLetter.readability.note}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-black text-white">JD match matrix</p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {phaseB.coverLetter.matchMatrix.slice(0, 6).map((item) => (
                  <div key={item.requirement} className="rounded-xl bg-white/[0.03] p-3">
                    <p className="text-sm font-black text-white">{item.requirement}</p>
                    <p className={item.strength === "Strong" ? "mt-1 text-xs font-black text-emerald-300" : item.strength === "Partial" ? "mt-1 text-xs font-black text-amber-300" : "mt-1 text-xs font-black text-rose-300"}>{item.strength}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{item.candidateEvidence}</p>
                  </div>
                ))}
              </div>
            </div>
          </CollapsibleSection>
        </section>
      </main>
    </PremiumFeatureGate>
  );
}
