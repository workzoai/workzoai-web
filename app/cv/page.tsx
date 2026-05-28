"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Download, FileText, Printer, Sparkles } from "lucide-react";
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

  useEffect(() => {
    const setup = readLatestInterviewSetup();
    syncCandidateIdentityFromSetup(setup);
    setCvText(normalizeSetupCvText(setup));
    setJobDescription(normalizeSetupJobDescription(setup));
    setTargetRole(normalizeSetupTargetRole(setup));
    setTargetMarket(normalizeSetupTargetMarket(setup));
  }, []);

  const resumeInput = useMemo(
    () => ({
      cvText,
      jobDescription,
      targetRole,
      targetMarket,
      template,
    }),
    [cvText, jobDescription, targetRole, targetMarket, template],
  );

  const improvedCv = useMemo(() => generateImprovedCv(resumeInput), [resumeInput]);
  const resumeJson = useMemo(() => buildResumeJson(resumeInput), [resumeInput]);
  const htmlPreview = useMemo(() => generateResumeHtml(resumeInput), [resumeInput]);


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
                onChange={(event) => setCvText(event.target.value)}
                className="min-h-[260px] w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm leading-6 outline-none transition focus:border-blue-400"
                placeholder="Upload a CV during onboarding or paste CV text here."
              />
            </label>
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

          <div className="h-[860px] overflow-auto rounded-[1.5rem] border border-white/10 bg-white">
            <iframe title="CV template preview" srcDoc={htmlPreview} className="h-[1120px] w-full bg-white" />
          </div>
        </div>
      </section>
    </main>
  );
}
