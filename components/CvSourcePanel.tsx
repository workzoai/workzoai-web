"use client";

/**
 * CvSourcePanel
 *
 * A self-contained CV + job-description input used by the standalone
 * feature pages (Improve CV, Cover Letter, CV Review) so a signed-in
 * user who lands on a feature directly, without going through
 * onboarding, can still upload or paste a CV and paste a JD.
 *
 * It reuses the exact onboarding pipeline so the parsed result is
 * identical, and it persists a canonical interview setup via
 * saveLatestInterviewSetup. That means the full experience section
 * flows through to the rewrite / cover letter / review, and the data
 * is available to the rest of the app just as if the user had
 * onboarded.
 *
 * Flow: file -> POST /api/cv -> { text, resumeProfile } ; if the API
 * did not return a usable profile, structure the text with
 * /api/cv/structure ; complete the profile ; save canonical setup ;
 * call onLoaded so the host page can populate its own state.
 */

import { useRef, useState, type ChangeEvent } from "react";
import { FileUp, Loader2, ClipboardPaste, AlertTriangle, CheckCircle2 } from "lucide-react";
import { structureResumeProfileFromCv } from "@/lib/workzoCvClient";
import { extractResumeProfileComplex, normalizeResumeText, type ResumeProfile } from "@/lib/workzoResumeParser";
import { completeResumeProfile } from "@/lib/workzoResumeProfileManager";
import { persistCvSource } from "@/lib/workzoCvSource";

export type CvSourceResult = {
  cvText: string;
  rawCvText: string;
  resumeProfile: ResumeProfile;
  jobDescription: string;
  targetRole: string;
};

type Props = {
  onLoaded: (result: CvSourceResult) => void;
  initialJobDescription?: string;
  initialTargetRole?: string;
  /** When true, a job description is required before continuing. */
  requireJobDescription?: boolean;
  heading?: string;
  subheading?: string;
};

export default function CvSourcePanel({
  onLoaded,
  initialJobDescription = "",
  initialTargetRole = "",
  requireJobDescription = false,
  heading = "Add your CV",
  subheading = "Upload a file or paste your CV text. Add the job description so the result targets the role.",
}: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const inFlight = useRef(false);
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [pastedCv, setPastedCv] = useState("");
  const [jobDescription, setJobDescription] = useState(initialJobDescription);
  const [targetRole, setTargetRole] = useState(initialTargetRole);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const jdMissing = requireJobDescription && !jobDescription.trim();

  async function finalize(rawText: string, apiProfile: ResumeProfile | null, sourceFileName: string) {
    const rawCvText = normalizeResumeText(rawText);
    if (!rawCvText.trim()) {
      throw new Error("No readable CV text was found. Please paste the CV text instead.");
    }

    // Prefer the API profile; otherwise structure the text, then fall back
    // to the local complex extractor. Always complete the profile so the
    // experience, education, and skills sections are fully populated.
    let profile: ResumeProfile | null =
      apiProfile && typeof apiProfile === "object" && "basics" in apiProfile ? apiProfile : null;

    if (!profile) {
      try {
        const structured = await structureResumeProfileFromCv({
          cvText: rawCvText,
          jobDescription: jobDescription.trim(),
          targetRole: targetRole.trim() || "General Role",
          fileName: sourceFileName,
        });
        if (structured?.resumeProfile && typeof structured.resumeProfile === "object") {
          profile = structured.resumeProfile as ResumeProfile;
        }
      } catch {
        // fall through to local extraction
      }
    }
    if (!profile) profile = extractResumeProfileComplex(rawCvText);

    const completed = completeResumeProfile({ ...profile, rawText: profile.rawText || rawCvText }, rawCvText);
    const resolvedRole = targetRole.trim() || completed.basics?.headline || "General Role";

    // Persist to the canonical profile store AND the interview setup store in
    // one call. Writing only the setup store was the original defect: Improve
    // CV read the canonical store's absence as "no profile" and re-parsed the
    // flattened text, which is what produced wrong names, dropped jobs, and
    // duplicated education.
    persistCvSource({
      profile: completed,
      rawCvText,
      fileName: sourceFileName,
      jobDescription: jobDescription.trim(),
      targetRole: resolvedRole,
      source: "feature-page-cv-upload",
    });

    onLoaded({
      cvText: rawCvText,
      rawCvText,
      resumeProfile: completed,
      jobDescription: jobDescription.trim(),
      targetRole: resolvedRole,
    });
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setFileName(file.name);
    try {
      const form = new FormData();
      form.append("file", file);
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 180000);
      const res = await fetch("/api/cv", {
        method: "POST",
        body: form,
        credentials: "include",
        signal: controller.signal,
      }).finally(() => window.clearTimeout(timeout));
      const data = await res.json().catch(() => null);
      if (res.status === 401) throw new Error("Please sign in to upload your CV.");
      if (!res.ok) throw new Error(data?.error || "CV extraction failed. Try pasting the text instead.");
      const extracted = data?.text || data?.cvText || data?.content || data?.resumeText || data?.extractedText || "";
      const apiProfile = (data?.resumeProfile || data?.profile || null) as ResumeProfile | null;
      await finalize(String(extracted), apiProfile, file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try pasting the CV text.");
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  async function handlePaste() {
    if (inFlight.current) return;
    if (!pastedCv.trim()) {
      setError("Paste your CV text first.");
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await finalize(pastedCv, null, "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process that CV text.");
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-fg/[0.02] p-5 sm:p-6">
      <p className="text-base font-black tracking-tight text-fg">{heading}</p>
      <p className="mt-1 text-sm text-muted">{subheading}</p>

      <div className="mt-4 inline-flex rounded-xl border border-line bg-canvas p-1 text-xs font-black">
        <button
          onClick={() => setMode("upload")}
          className={`rounded-lg px-3 py-1.5 ${mode === "upload" ? "bg-brand text-on-brand" : "text-muted hover:text-fg"}`}
        >
          Upload file
        </button>
        <button
          onClick={() => setMode("paste")}
          className={`rounded-lg px-3 py-1.5 ${mode === "paste" ? "bg-brand text-on-brand" : "text-muted hover:text-fg"}`}
        >
          Paste text
        </button>
      </div>

      {mode === "upload" ? (
        <div className="mt-4">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp"
            onChange={handleFile}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-canvas px-4 py-6 text-sm font-black text-fg hover:border-brand disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            {busy ? "Reading your CV..." : fileName ? `Replace ${fileName}` : "Choose a CV file (PDF, Word, image)"}
          </button>
        </div>
      ) : (
        <div className="mt-4">
          <textarea
            value={pastedCv}
            onChange={(e) => setPastedCv(e.target.value)}
            rows={7}
            placeholder="Paste your full CV text here, including your work experience."
            className="w-full rounded-xl border border-line bg-canvas px-4 py-3 text-sm text-fg placeholder:text-subtle focus:border-brand focus:outline-none"
          />
          <button
            onClick={handlePaste}
            disabled={busy || !pastedCv.trim()}
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-black text-on-brand hover:bg-brand-strong disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardPaste className="h-4 w-4" />}
            Use this CV
          </button>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_200px]">
        <textarea
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          rows={3}
          placeholder="Paste the job description (recommended, so the result targets the role)."
          className="w-full rounded-xl border border-line bg-canvas px-4 py-3 text-sm text-fg placeholder:text-subtle focus:border-brand focus:outline-none"
        />
        <input
          value={targetRole}
          onChange={(e) => setTargetRole(e.target.value)}
          placeholder="Target role (optional)"
          className="h-fit rounded-xl border border-line bg-canvas px-4 py-3 text-sm text-fg placeholder:text-subtle focus:border-brand focus:outline-none"
        />
      </div>

      {jdMissing ? (
        <p className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-warning">
          <AlertTriangle className="h-3.5 w-3.5" /> Add a job description for the strongest, targeted result.
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-2 text-xs font-bold text-danger">
          <AlertTriangle className="h-3.5 w-3.5" /> {error}
        </p>
      ) : null}

      {fileName && !busy && !error ? (
        <p className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-success">
          <CheckCircle2 className="h-3.5 w-3.5" /> CV loaded. You can change the job description above and continue.
        </p>
      ) : null}
    </div>
  );
}
