"use client";

import Link from "next/link";
import PremiumFeatureGate from "@/components/PremiumFeatureGate";
import { AlertTriangle, ArrowLeft, CheckCircle2, Copy, FileText, Gauge, Target, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  normalizeSetupCvText,
  normalizeSetupJobDescription,
  normalizeSetupTargetRole,
  readLatestInterviewSetup,
} from "@/lib/workzoInterviewSetup";
import { buildPhaseAInsights } from "@/lib/workzoCareerSuitePhaseA";
import { buildPhaseBInsights } from "@/lib/workzoCareerSuitePhaseB";

export default function CoverLetterWorkspacePage() {
  const [cvText, setCvText] = useState("");
  const [resumeProfile, setResumeProfile] = useState<any>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [targetMarket, setTargetMarket] = useState("");
  const [generated, setGenerated] = useState("");
  const [loading, setLoading] = useState(false);

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
      // fallback
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
      // Fallback to local generator. Pass the structured resumeProfile if we
      // have one — without it, generateCoverLetter has to re-parse cvText,
      // which (for this page) is the labeled "Candidate name: X / Headline: Y"
      // interview-context format, not raw CV text, and can produce garbled
      // output like "Candidate name Olivia Wilson" as the signature.
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
  }

  return (
    <PremiumFeatureGate feature="cover_letter" title="Cover Letter is a Premium feature" description="Role-specific cover letters based on your CV and job description are included in Premium.">
      <main className="min-h-screen bg-canvas px-5 py-5 text-fg">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between rounded-xl border border-line bg-fg/[0.035] px-4 py-3">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-black text-muted hover:text-fg">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <div className="flex items-center gap-2 text-sm font-black text-muted"><FileText className="h-4 w-4" /> Cover Letter</div>
        </header>

        <section className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg border border-line bg-fg/[0.04] p-6">
            <h1 className="text-3xl font-black tracking-tight">Generate a cover letter</h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              The generator is lazy-loaded only when you click Generate, keeping the page light.
            </p>


            <div className="mt-6 rounded-xl border border-brand/15 bg-brand/[0.045] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">Application intelligence</p>
                  <h2 className="mt-2 text-xl font-black">{phaseA.hiringRecommendation}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted">{phaseA.recruiterScan.firstImpression}</p>
                </div>
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg border border-brand/20 bg-canvas-soft text-center">
                  <p className="text-xl font-black text-brand">{phaseA.readinessScore}</p>
                  <p className="-mt-2 text-[9px] font-black text-subtle">READY</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-line bg-canvas-soft p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-black text-success"><CheckCircle2 className="h-4 w-4" /> Match signals</div>
                  <div className="space-y-2">
                    {phaseA.missingRequirements.slice(0, 4).map((item) => (
                      <p key={item.label} className="text-sm leading-6 text-muted">
                        {item.status === "matched" ? "✓" : item.status === "partial" ? "~" : "!"} {item.label}
                      </p>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-line bg-canvas-soft p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-black text-warning"><AlertTriangle className="h-4 w-4" /> Letter risks to avoid</div>
                  <div className="space-y-2">
                    {phaseA.objections.slice(0, 3).map((item) => <p key={item.title} className="text-sm leading-6 text-muted">• {item.title}</p>)}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-line bg-canvas-soft p-3"><Gauge className="mb-2 h-4 w-4 text-brand" /><p className="text-xs text-muted">Current chance</p><p className="text-xl font-black">{phaseA.interviewProbability.current}%</p></div>
                <div className="rounded-lg border border-line bg-canvas-soft p-3"><Target className="mb-2 h-4 w-4 text-brand" /><p className="text-xs text-muted">After CV fix</p><p className="text-xl font-black">{phaseA.interviewProbability.afterCvFix}%</p></div>
                <div className="rounded-lg border border-line bg-canvas-soft p-3"><FileText className="mb-2 h-4 w-4 text-brand" /><p className="text-xs text-muted">After prep</p><p className="text-xl font-black">{phaseA.interviewProbability.afterInterviewPrep}%</p></div>
              </div>
            </div>


            <div className="mt-6 rounded-xl border border-brand/15 bg-brand/[0.045] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">Phase 2 letter intelligence</p>
                  <h2 className="mt-2 text-xl font-black">{phaseB.companyDNA.label}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted">{phaseB.companyDNA.coverLetterRule}</p>
                </div>
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg border border-brand/20 bg-canvas-soft text-center">
                  <p className="text-xl font-black text-brand">{phaseB.coverLetter.riskScore}</p>
                  <p className="-mt-2 text-[9px] font-black text-subtle">SAFE</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-line bg-canvas-soft p-4">
                  <p className="text-sm font-black text-success">Hiring manager hooks</p>
                  <div className="mt-3 space-y-3">
                    {phaseB.coverLetter.hooks.slice(0, 3).map((hook) => (
                      <div key={hook.style} className="rounded-xl bg-fg/[0.03] p-3">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-subtle">{hook.style}</p>
                        <p className="mt-1 text-sm leading-6 text-muted">{hook.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-line bg-canvas-soft p-4">
                  <p className="text-sm font-black text-warning">Risk scanner</p>
                  <div className="mt-3 space-y-2">
                    {phaseB.coverLetter.riskFlags.map((item) => (
                      <p key={item} className="text-sm leading-6 text-muted">• {item}</p>
                    ))}
                  </div>
                  <div className="mt-4 rounded-xl border border-line bg-fg/[0.03] p-3">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-subtle">Readability</p>
                    <p className="mt-1 text-sm font-black text-fg">{phaseB.coverLetter.readability.verdict} · {phaseB.coverLetter.readability.estimatedReadingSeconds}s read</p>
                    <p className="mt-1 text-xs leading-5 text-muted">{phaseB.coverLetter.readability.note}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-line bg-canvas-soft p-4">
                <p className="text-sm font-black text-fg">JD match matrix</p>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {phaseB.coverLetter.matchMatrix.slice(0, 6).map((item) => (
                    <div key={item.requirement} className="rounded-xl bg-fg/[0.03] p-3">
                      <p className="text-sm font-black text-fg">{item.requirement}</p>
                      <p className={item.strength === "Strong" ? "mt-1 text-xs font-black text-success" : item.strength === "Partial" ? "mt-1 text-xs font-black text-warning" : "mt-1 text-xs font-black text-danger"}>{item.strength}</p>
                      <p className="mt-1 text-xs leading-5 text-muted">{item.candidateEvidence}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[.18em] text-muted">Target role</span>
                <input value={targetRole} onChange={(e) => setTargetRole(e.target.value)} className="w-full rounded-lg border border-line bg-canvas-soft px-4 py-3 text-sm outline-none focus:border-brand" />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[.18em] text-muted">CV context</span>
                <textarea value={cvText} onChange={(e) => setCvText(e.target.value)} rows={8} className="w-full rounded-lg border border-line bg-canvas-soft px-4 py-3 text-sm outline-none focus:border-brand" />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[.18em] text-muted">Job description</span>
                <textarea value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} rows={8} className="w-full rounded-lg border border-line bg-canvas-soft px-4 py-3 text-sm outline-none focus:border-brand" />
              </label>
              <button onClick={handleGenerate} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-black text-on-brand hover:bg-brand disabled:opacity-60">
                <Wand2 className="h-4 w-4" /> {loading ? "Generating…" : "Generate"}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-fg/[0.035] p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-black">Draft</h2>
              <button onClick={handleCopy} className="inline-flex items-center gap-2 rounded-xl border border-line bg-fg/[0.05] px-3 py-2 text-xs font-black text-fg hover:bg-fg/[0.09]">
                <Copy className="h-4 w-4" /> Copy
              </button>
            </div>
            <pre className="mt-5 min-h-[520px] whitespace-pre-wrap rounded-lg bg-canvas-soft p-5 text-sm leading-7 text-fg">
              {generated || "Your cover letter draft will appear here after generation."}
            </pre>
          </div>
        </section>
      </div>
    </main>
    </PremiumFeatureGate>
  );
}
