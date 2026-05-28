"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy } from "lucide-react";
import { generateCoverLetter } from "@/lib/workzoWorkspaceGenerators";
import { readLatestInterviewSetup } from "@/lib/workzoInterviewSetup";

export default function CoverLetterWorkspacePage() {
  const [cvText, setCvText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [targetRole, setTargetRole] = useState("");

  useEffect(() => {
    const setup = readLatestInterviewSetup();

    if (!setup) {
      setCvText("");
      setJobDescription("");
      setTargetRole("");
      return;
    }

    setCvText(
      String(
        setup.cvText ||
          setup.uploadedCvText ||
          setup.resumeText ||
          setup.candidateCv ||
          "",
      ),
    );

    setJobDescription(String(setup.jobDescription || setup.jdText || ""));

    setTargetRole(
      String(
        setup.targetRole ||
          setup.role ||
          setup.jobTitle ||
          setup.resumeProfile?.basics?.headline ||
          "",
      ),
    );
  }, []);

  const generated = useMemo(
    () =>
      generateCoverLetter({
        cvText,
        jobDescription,
        targetRole,
      }),
    [cvText, jobDescription, targetRole],
  );

  async function handleCopy() {
    if (!generated) return;
    await navigator.clipboard.writeText(generated);
  }

  return (
    <main className="min-h-screen bg-[#020817] px-6 py-6 text-white">
      <header className="mb-6 flex items-center justify-between">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 transition hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-blue-600/20">
            <Image src="/workzo_icon.png" alt="WorkZo AI" width={28} height={28} className="rounded-xl" />
          </div>
          <div className="text-right">
            <p className="text-sm font-black">Cover Letter</p>
            <p className="text-xs text-slate-400">WorkZo AI</p>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
          <h1 className="text-3xl font-black tracking-tight">Cover Letter Generator</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Uses the same CV and job description saved from onboarding.
          </p>

          <label className="mt-5 block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Target role
            </span>
            <input
              value={targetRole}
              onChange={(event) => setTargetRole(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
              placeholder="Target role"
            />
          </label>

          <label className="mt-4 block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              CV text
            </span>
            <textarea
              value={cvText}
              onChange={(event) => setCvText(event.target.value)}
              className="min-h-[220px] w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 outline-none transition focus:border-blue-400"
              placeholder="Upload a CV during onboarding or paste CV text here."
            />
          </label>

          <label className="mt-4 block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Job description
            </span>
            <textarea
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
              className="min-h-[180px] w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 outline-none transition focus:border-blue-400"
              placeholder="Paste the job description here."
            />
          </label>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Generated cover letter</h2>
              <p className="text-sm text-slate-400">Review and edit before sending.</p>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-500 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-400"
            >
              <Copy className="h-4 w-4" />
              Copy
            </button>
          </div>

          <pre className="min-h-[520px] whitespace-pre-wrap rounded-[1.5rem] border border-white/10 bg-black/25 p-5 font-sans text-sm leading-7 text-slate-100">
            {generated || "Add your CV and job description to generate a cover letter."}
          </pre>
        </div>
      </section>
    </main>
  );
}
