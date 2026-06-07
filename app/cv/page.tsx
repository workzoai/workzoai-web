"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, CheckCircle2, Copy, Download, FileText, Gauge, Printer, Sparkles, Target } from "lucide-react";
import {
  buildResumeJson,
  generateImprovedCv,
  generateResumeHtml,
  downloadHtmlFile,
  printResumeHtml,
  type CvTemplate,
} from "@/lib/workzoWorkspaceGenerators";
import { syncCandidateIdentityFromSetup } from "@/lib/workzoCandidateIdentity";
import {
  normalizeSetupCvText,
  normalizeSetupJobDescription,
  normalizeSetupTargetMarket,
  normalizeSetupTargetRole,
  readLatestInterviewSetup,
} from "@/lib/workzoInterviewSetup";
import type { ResumeProfile } from "@/lib/workzoResumeParser";
import { debugCvPipeline, debugCvProfile, debugCvText } from "@/lib/workzoCvPipelineDebug";
import { buildPhaseAInsights } from "@/lib/workzoCareerSuitePhaseA";
import { buildPhaseBInsights } from "@/lib/workzoCareerSuitePhaseB";

const templates: Array<{ id: CvTemplate; label: string; description: string }> = [
  { id: "ats", label: "ATS Clean", description: "Strict, single-column, recruiter-safe layout." },
  { id: "modern", label: "Modern Professional", description: "Premium two-column layout with skill chips." },
  { id: "career_switcher", label: "Career Switcher", description: "Highlights transferable fit and projects." },
];

export default function CvWorkspacePage() {
  const [cvText, setCvText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [targetMarket, setTargetMarket] = useState("global");
  const [template, setTemplate] = useState<CvTemplate>("ats");
  const [atsText, setAtsText] = useState("");
  const [savedResumeProfile, setSavedResumeProfile] = useState<ResumeProfile | undefined>(undefined);

  useEffect(() => {
    const setup = readLatestInterviewSetup();
    debugCvPipeline("cv.page.setup.loaded", {
      hasSetup: Boolean(setup),
      setupKeys: setup && typeof setup === "object" ? Object.keys(setup).slice(0, 40) : [],
      cvChars: normalizeSetupCvText(setup).length,
      hasResumeProfile: Boolean(setup?.resumeProfile),
    });
    debugCvText("cv.page.setup.cvText", normalizeSetupCvText(setup));
    debugCvProfile("cv.page.setup.resumeProfile", setup?.resumeProfile);

    syncCandidateIdentityFromSetup(setup);
    setCvText(normalizeSetupCvText(setup));
    setJobDescription(normalizeSetupJobDescription(setup));
    setTargetRole(normalizeSetupTargetRole(setup));
    setTargetMarket(normalizeSetupTargetMarket(setup));

    // Critical: Improve CV must use the exact structured profile produced during onboarding.
    // Do not re-parse raw PDF text here unless no profile exists. Re-parsing is what caused
    // projects, education, and summary to drift between Onboarding and Improve CV.
    const profile = setup?.resumeProfile;
    if (profile && typeof profile === "object" && "basics" in profile) {
      setSavedResumeProfile(profile as ResumeProfile);
      debugCvProfile("cv.page.savedResumeProfile.set", profile);
    }
  }, []);

  const resumeInput = useMemo(
    () => ({
      cvText,
      resumeProfile: savedResumeProfile,
      jobDescription,
      targetRole,
      targetMarket,
      template,
    }),
    [cvText, savedResumeProfile, jobDescription, targetRole, targetMarket, template],
  );

  const improvedCv = useMemo(() => {
    debugCvProfile("cv.page.generateImprovedCv.inputProfile", resumeInput.resumeProfile);
    const output = generateImprovedCv(resumeInput);
    debugCvText("cv.page.generateImprovedCv.outputText", output);
    return output;
  }, [resumeInput]);

  const resumeJson = useMemo(() => {
    const output = buildResumeJson(resumeInput);
    debugCvProfile("cv.page.buildResumeJson.outputProfile", output.profile, {
      summary: output.summary,
      experienceCount: output.experience.length,
      projectCount: output.projects.length,
      educationCount: output.education.length,
      skillsCount: output.skills.length,
    });
    return output;
  }, [resumeInput]);
  const htmlPreview = useMemo(() => generateResumeHtml(resumeInput), [resumeInput]);

  const phaseA = useMemo(() => buildPhaseAInsights({ cvText, jobDescription, targetRole, targetMarket }), [cvText, jobDescription, targetRole, targetMarket]);
  const phaseB = useMemo(
    () => buildPhaseBInsights({ cvText, jobDescription, targetRole, targetMarket }),
    [cvText, jobDescription, targetRole, targetMarket],
  );


  useEffect(() => {
    setAtsText(improvedCv || "");
  }, [improvedCv]);

  useEffect(() => {
    if (!resumeJson?.profile?.basics?.name) return;

    syncCandidateIdentityFromSetup({
      cvText,
      jobDescription,
      targetRole,
      targetMarket,
      resumeProfile: resumeJson.profile,
      candidateName: resumeJson.profile.basics.name,
      candidateHeadline: resumeJson.basics.headline,
      candidateEmail: resumeJson.profile.basics.email,
      candidatePhone: resumeJson.profile.basics.phone,
      candidateLocation: resumeJson.profile.basics.location,
      candidateLinkedin: resumeJson.profile.basics.linkedin,
    });
  }, [resumeJson, cvText, jobDescription, targetRole, targetMarket]);

  function safeName() {
    return resumeJson.profile.basics.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "workzo-cv";
  }

  function handleDownloadHtml(selectedTemplate = template) {
    const html = generateResumeHtml({ ...resumeInput, template: selectedTemplate });
    downloadHtmlFile(`${safeName()}-${selectedTemplate}.html`, html);
  }

  function handlePrintPdf(selectedTemplate = template) {
    const html = generateResumeHtml({ ...resumeInput, template: selectedTemplate });
    printResumeHtml(html);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(atsText || improvedCv);
  }

  return (
    <main className="min-h-screen bg-[#020817] px-5 py-6 text-white">
      <header className="mx-auto mb-6 flex max-w-7xl items-center justify-between">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 transition hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-200">
            <FileText className="h-5 w-5" />
          </div>
          <div className="text-right">
            <p className="text-sm font-black">Improve CV</p>
            <p className="text-xs text-slate-400">WorkZo AI</p>
          </div>
        </div>
      </header>

      <section className="mx-auto mb-6 max-w-7xl rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-200">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight">Professional CV Improvement</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Onboarding CV, job description, preview, and downloads all use the same canonical resume object.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-slate-100 transition hover:bg-white/10"
            >
              <Copy className="h-4 w-4" />
              Copy CV
            </button>
            <button
              type="button"
              onClick={() => handleDownloadHtml()}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-slate-100 transition hover:bg-white/10"
            >
              <Download className="h-4 w-4" />
              Download HTML
            </button>
            <button
              type="button"
              onClick={() => handlePrintPdf()}
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-500 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-400"
            >
              <Printer className="h-4 w-4" />
              Download PDF
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-5">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
            <h2 className="mb-4 text-xl font-black">Setup</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Target role
                </span>
                <input
                  value={targetRole}
                  onChange={(event) => setTargetRole(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                  placeholder="e.g. Data Analyst"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Target market
                </span>
                <input
                  value={targetMarket}
                  onChange={(event) => setTargetMarket(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                  placeholder="global"
                />
              </label>
            </div>

            <label className="mt-4 block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Job description
              </span>
              <textarea
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value)}
                className="min-h-[150px] w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm leading-6 outline-none transition focus:border-blue-400"
                placeholder="Paste the JD here."
              />
            </label>

            <label className="mt-4 block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                CV text
              </span>
              <textarea
                value={cvText}
                onChange={(event) => {
                  setCvText(event.target.value);
                  setSavedResumeProfile(undefined);
                }}
                className="min-h-[260px] w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm leading-6 outline-none transition focus:border-blue-400"
                placeholder="Upload a CV during onboarding or paste CV text here."
              />
            </label>
          </div>


          <div className="rounded-[2rem] border border-cyan-300/15 bg-cyan-400/[0.045] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Recruiter 6-second scan</p>
                <h2 className="mt-2 text-xl font-black">{phaseA.recruiterScan.decision}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">{phaseA.recruiterScan.firstImpression}</p>
              </div>
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-cyan-300/20 bg-black/25 text-center">
                <p className="text-2xl font-black text-cyan-100">{phaseA.readinessScore}</p>
                <p className="-mt-2 text-[10px] font-black text-slate-500">READY</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.06] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-black text-emerald-200"><CheckCircle2 className="h-4 w-4" /> What works</div>
                <div className="space-y-2">
                  {phaseA.recruiterScan.strengths.map((item) => <p key={item} className="text-sm leading-6 text-slate-300">• {item}</p>)}
                </div>
              </div>
              <div className="rounded-2xl border border-amber-300/15 bg-amber-400/[0.06] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-black text-amber-200"><AlertTriangle className="h-4 w-4" /> Recruiter concerns</div>
                <div className="space-y-2">
                  {phaseA.recruiterScan.concerns.map((item) => <p key={item} className="text-sm leading-6 text-slate-300">• {item}</p>)}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400"><Gauge className="h-4 w-4" /> Current</div>
                <p className="mt-2 text-2xl font-black">{phaseA.interviewProbability.current}%</p>
                <p className="mt-1 text-xs text-slate-500">Interview probability estimate</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400"><Target className="h-4 w-4" /> After CV fix</div>
                <p className="mt-2 text-2xl font-black text-blue-100">{phaseA.interviewProbability.afterCvFix}%</p>
                <p className="mt-1 text-xs text-slate-500">If missing proof is added</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400"><Sparkles className="h-4 w-4" /> After prep</div>
                <p className="mt-2 text-2xl font-black text-emerald-200">{phaseA.interviewProbability.afterInterviewPrep}%</p>
                <p className="mt-1 text-xs text-slate-500">With interview stories ready</p>
              </div>
            </div>
          </div>


          <div className="rounded-[2rem] border border-blue-300/15 bg-blue-500/[0.045] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-200">Phase 2 intelligence</p>
                <h2 className="mt-2 text-xl font-black">{phaseB.companyDNA.label}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">{phaseB.companyDNA.description}</p>
              </div>
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-blue-300/20 bg-black/25 text-center">
                <p className="text-2xl font-black text-blue-100">{phaseB.trustAudit.overall}</p>
                <p className="-mt-2 text-[10px] font-black text-slate-500">TRUST</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-black text-blue-100">Company DNA rules</p>
                <div className="mt-3 space-y-3">
                  {phaseB.companyDNA.dimensions.map((item) => (
                    <div key={item.label}>
                      <div className="mb-1 flex justify-between text-xs font-black">
                        <span className="text-slate-300">{item.label}</span>
                        <span className="text-blue-100">{item.score}% / {item.target}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-blue-400" style={{ width: `${item.score}%` }} />
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{item.note}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-black text-emerald-200">Trust audit</p>
                <div className="mt-3 space-y-2">
                  {phaseB.trustAudit.dimensions.map((item) => (
                    <p key={item.label} className="text-sm leading-6 text-slate-300">
                      <span className="font-black text-white">{item.label}:</span> {item.score}% <span className={item.delta >= 0 ? "text-emerald-300" : "text-amber-300"}>({item.delta >= 0 ? "+" : ""}{item.delta})</span>
                    </p>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-black text-white">Evidence engine</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{phaseB.evidenceEngine.summary}</p>
              <div className="mt-4 space-y-3">
                {phaseB.evidenceEngine.items.slice(0, 4).map((item) => (
                  <div key={item.text} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-black text-white">{item.score}% evidence</p>
                      <p className="text-xs text-slate-400">
                        {item.ownership ? "✓ Ownership" : "⚠ Ownership"} · {item.metric ? "✓ Metric" : "⚠ Metric"} · {item.result ? "✓ Result" : "⚠ Result"}
                      </p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{item.text}</p>
                    <p className="mt-2 text-xs leading-5 text-blue-100">Recruiter hears: {item.recruiterHeard}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.06] p-4">
              <p className="text-sm font-black text-emerald-200">Top 10% rewrite target</p>
              <p className="mt-3 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Current weak line</p>
              <p className="mt-1 text-sm leading-6 text-slate-300">{phaseB.top10Rewrite.weakestLine}</p>
              <p className="mt-3 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Elite version</p>
              <p className="mt-1 text-sm leading-6 text-emerald-50">{phaseB.top10Rewrite.eliteLine}</p>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
            <h2 className="mb-4 text-xl font-black">Templates</h2>
            <div className="grid gap-3 md:grid-cols-3">
              {templates.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTemplate(item.id)}
                  className={[
                    "rounded-2xl border p-4 text-left transition",
                    template === item.id
                      ? "border-blue-300/70 bg-blue-500/15"
                      : "border-white/10 bg-black/20 hover:border-blue-300/60 hover:bg-blue-500/10",
                  ].join(" ")}
                >
                  <div className="mb-2 font-black">{item.label}</div>
                  <p className="text-xs leading-5 text-slate-400">{item.description}</p>
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {templates.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handlePrintPdf(item.id)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-slate-100 transition hover:bg-white/10"
                >
                  PDF: {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
            <h2 className="mb-3 text-xl font-black">ATS text version</h2>
            <textarea
              value={atsText}
              onChange={(event) => setAtsText(event.target.value)}
              className="min-h-[420px] w-full resize-y overflow-auto whitespace-pre-wrap rounded-[1.5rem] border border-white/10 bg-black/25 p-5 font-sans text-sm leading-7 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:bg-black/35"
              placeholder="Upload or paste a CV to generate an improved version. You can edit the ATS text here before copying."
              spellCheck={true}
            />
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Editable text version. Changes here are used when you copy the CV text. Template preview and PDF are generated from the structured CV data.
            </p>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Live CV Preview</h2>
              <p className="text-sm text-slate-400">The preview matches the selected downloadable template.</p>
            </div>

            <div className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs font-black text-blue-100">
              {templates.find((item) => item.id === template)?.label}
            </div>
          </div>

          <div className="max-h-[60vh] overflow-auto rounded-[1.5rem] border border-white/10 bg-white sm:max-h-[75vh] xl:h-[860px] xl:max-h-none">
            <iframe title="CV template preview" srcDoc={htmlPreview} className="h-[1120px] w-full bg-white" />
          </div>
        </div>
      </section>
    </main>
  );
}
