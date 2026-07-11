"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PremiumFeatureGate from "@/components/PremiumFeatureGate";
import { AlertTriangle, ArrowLeft, CheckCircle2, Copy, Download, FileText, Wand2 } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { printResumeHtml } from "@/lib/workzoWorkspaceGenerators";
import { resolveCvSource } from "@/lib/workzoCvSource";
import CvSourcePanel from "@/components/CvSourcePanel";
import { buildPhaseAInsights } from "@/lib/workzoCareerSuitePhaseA";
import { buildPhaseBInsights } from "@/lib/workzoCareerSuitePhaseB";

// Parses the model's markdown output into clean, symbol-free pieces:
//  - assessment: the honest fit note, for its own card
//  - letter: ONLY the letter body, with every markdown symbol removed
//  - notes: secondary guidance (personalise checklist, alternative opening)
// General and format-agnostic: it classifies by section heading, and falls
// back to a salutation split when the model returns no headings.
function stripInlineMd(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/(^|[^*])\*(?!\*)([^*]+)\*/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1");
}

function stripLineMd(line: string): string {
  return stripInlineMd(line.replace(/^\s*>+\s?/, "").replace(/^\s*#{1,6}\s*/, ""));
}

function cleanBlock(text: string): string {
  return text
    .split(/\n/)
    .map(stripLineMd)
    .join("\n")
    .replace(/^\s*[-\u2013\u2014*_]{3,}\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitSections(raw: string): Array<{ title: string; body: string }> {
  const lines = raw.replace(/\r\n/g, "\n").trim().split("\n");
  const sections: Array<{ title: string; body: string[] }> = [];
  let current: { title: string; body: string[] } = { title: "", body: [] };
  for (const line of lines) {
    const heading = line.match(/^\s*#{1,6}\s*(.+?)\s*$/);
    if (heading) {
      if (current.title || current.body.length) sections.push(current);
      current = { title: heading[1], body: [] };
    } else if (/^\s*[-\u2013\u2014*_]{3,}\s*$/.test(line)) {
      if (current.title || current.body.length) {
        sections.push(current);
        current = { title: "", body: [] };
      }
    } else {
      current.body.push(line);
    }
  }
  if (current.title || current.body.length) sections.push(current);
  return sections.map((s) => ({ title: s.title, body: s.body.join("\n") }));
}

function classifySection(title: string): "assessment" | "letter" | "checklist" | "alt" | "other" {
  const t = title.toLowerCase();
  if (/fit note|fit summary|assessment|quick fit|honest/.test(t)) return "assessment";
  if (/cover letter|letter draft|^draft|the letter/.test(t)) return "letter";
  if (/personalis|personaliz|before sending|before you send|checklist|customi/.test(t)) return "checklist";
  if (/alternativ|stronger opening|opening/.test(t)) return "alt";
  return "other";
}

function parseCoverLetter(raw: string): { assessment: string; letter: string; notes: string } {
  const text = (raw || "").replace(/\r\n/g, "\n").trim();
  if (!text) return { assessment: "", letter: "", notes: "" };

  let assessment = "";
  let letter = "";
  let checklist = "";
  let alt = "";
  for (const section of splitSections(text)) {
    const kind = classifySection(section.title);
    const body = cleanBlock(section.body);
    if (!body) continue;
    if (kind === "assessment" && !assessment) assessment = body;
    else if (kind === "letter" && !letter) letter = body;
    else if (kind === "checklist" && !checklist) checklist = body;
    else if (kind === "alt" && !alt) alt = body;
  }

  // No headings: strip symbols, then split on the first salutation.
  if (!letter) {
    const cleaned = cleanBlock(text);
    const m = cleaned.match(/(^|\n)\s*(dear\b[^\n]*|hi\b[^\n]*|hello\b[^\n]*|to whom it may concern[^\n]*)/i);
    if (m) {
      const at = (m.index ?? 0) + (m[1] ? m[1].length : 0);
      if (!assessment && at > 40) assessment = cleaned.slice(0, at).trim();
      letter = cleaned.slice(at).trim();
    } else {
      letter = cleaned;
    }
  }

  const notesParts: string[] = [];
  if (checklist) {
    const list = checklist
      .replace(/^\s*[-*]\s*\[[ xX]?\]\s*/gm, "• ")
      .replace(/^\s*[-*]\s+/gm, "• ");
    notesParts.push(`Before you send:\n${list}`);
  }
  if (alt) notesParts.push(`Alternative opening:\n${alt}`);
  return { assessment, letter, notes: notesParts.join("\n\n").trim() };
}

// Printable A4 letter for the browser's Save as PDF. Dependency-free.
function coverLetterHtml(body: string, name = ""): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(name) || "Cover Letter"}</title>
<style>
  @page { size: A4; margin: 22mm 20mm; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Georgia, "Times New Roman", serif; color: #111; line-height: 1.6; font-size: 12pt; }
  .letter { white-space: pre-wrap; }
</style></head>
<body><div class="letter">${esc(body)}</div></body></html>`;
}
function CoverLetterWorkspaceContent() {
  const searchParams = useSearchParams();
  const openedFromLanding = searchParams.get("from") === "landing";
  const backHref = openedFromLanding ? "/" : "/dashboard";
  const backLabel = openedFromLanding ? "Back to home" : "Back to dashboard";
  const [cvText, setCvText] = useState("");
  const [resumeProfile, setResumeProfile] = useState<any>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [targetMarket, setTargetMarket] = useState("");
  const [outputLanguage, setOutputLanguage] = useState("English");
  const [generated, setGenerated] = useState("");
  const [letterBody, setLetterBody] = useState("");
  const [assessment, setAssessment] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  // Keep the editable letter, the assessment, and the secondary notes in sync
  // with each new generation, while leaving the user free to edit the letter.
  useEffect(() => {
    const parsed = parseCoverLetter(generated);
    setAssessment(parsed.assessment);
    setNotes(parsed.notes);
    setLetterBody(parsed.letter);
  }, [generated]);

  useEffect(() => {
    const source = resolveCvSource();
    setCvText(source.rawCvText);
    setResumeProfile(source.profile);
    setJobDescription(source.jobDescription);
    setTargetRole(source.targetRole || source.profile?.basics?.headline || "");
    setTargetMarket(source.targetMarket || "Global");
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
          resumeProfile,
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
      // have one, without it, generateCoverLetter has to re-parse cvText,
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
    if (!letterBody) return;
    await navigator.clipboard.writeText(letterBody);
  }

  function handleDownloadPdf() {
    if (!letterBody.trim()) return;
    const name = (resumeProfile && resumeProfile.basics && resumeProfile.basics.name) || "";
    printResumeHtml(coverLetterHtml(letterBody, name));
  }

  return (
    <PremiumFeatureGate feature="cover_letter" title="Cover Letter" description="Cover Letter is available on every WorkZo plan.">
      <main className="min-h-screen bg-canvas px-5 py-5 text-fg">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between rounded-xl border border-line bg-fg/[0.035] px-4 py-3">
          <Link href={backHref} className="inline-flex items-center gap-2 text-sm font-black text-muted hover:text-fg">
            <ArrowLeft className="h-4 w-4" /> {backLabel}
          </Link>
          <div className="flex items-center gap-2 text-sm font-black text-muted"><FileText className="h-4 w-4" /> Cover Letter</div>
        </header>

        {!cvText.trim() && (
          <section className="mt-6">
            <CvSourcePanel
              requireJobDescription
              initialJobDescription={jobDescription}
              initialTargetRole={targetRole}
              heading="Add your CV to write a cover letter"
              subheading="Upload a file or paste your CV, then add the job description so the letter targets the role."
              onLoaded={(r) => {
                setCvText(r.cvText);
                setResumeProfile(r.resumeProfile);
                setJobDescription(r.jobDescription);
                setTargetRole(r.targetRole);
              }}
            />
          </section>
        )}

        <section className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg border border-line bg-fg/[0.04] p-6">
            <h1 className="text-3xl font-black tracking-tight">Generate a cover letter</h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              Paste your CV and the job description, add the role, and generate. That's all you need.
            </p>

            {/* Inputs first, the important part */}
            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[.18em] text-muted">Target role</span>
                <input value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="e.g. Customer Success Manager" className="w-full rounded-lg border border-line bg-canvas-soft px-4 py-3 text-sm outline-none focus:border-brand" />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[.18em] text-muted">Cover letter language</span>
                <select value={outputLanguage} onChange={(e) => setOutputLanguage(e.target.value)} className="w-full rounded-lg border border-line bg-canvas-soft px-4 py-3 text-sm outline-none focus:border-brand">
                  {[
                    "English", "German", "French", "Spanish", "Italian", "Dutch", "Portuguese", "Polish", "Turkish", "Arabic", "Hindi", "Tamil", "Chinese", "Japanese", "Korean",
                  ].map((language) => <option key={language} value={language}>{language}</option>)}
                </select>
                <span className="mt-2 block text-xs text-subtle">Choose the language before generating. Generate again to create the letter in another language.</span>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[.18em] text-muted">CV context</span>
                <textarea value={cvText} onChange={(e) => setCvText(e.target.value)} rows={7} placeholder="Paste your CV text here. It's pre-filled automatically if you've already uploaded one." className="w-full rounded-lg border border-line bg-canvas-soft px-4 py-3 text-sm outline-none focus:border-brand" />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[.18em] text-muted">Job description</span>
                <textarea value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} rows={7} placeholder="Paste the job description you're applying to." className="w-full rounded-lg border border-line bg-canvas-soft px-4 py-3 text-sm outline-none focus:border-brand" />
              </label>
              <button onClick={handleGenerate} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-black text-on-brand hover:bg-brand disabled:opacity-60">
                <Wand2 className="h-4 w-4" /> {loading ? "Generating…" : "Generate cover letter"}
              </button>
            </div>

            {/* Application intelligence, collapsed to keep the focus on the inputs above */}
            <details className="mt-6">
              <summary className="cursor-pointer list-none rounded-lg border border-line bg-canvas-soft px-4 py-3 text-sm font-black text-muted hover:text-fg">
                Application intelligence &amp; letter analysis (optional)
              </summary>

            <div className="mt-6 rounded-xl border border-brand/15 bg-brand/[0.045] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-muted">JD keyword signals</p>
                  <h2 className="mt-2 text-xl font-black">Match &amp; risk overview</h2>
                  <p className="mt-2 text-sm leading-6 text-muted">Keyword-level signals only, not a hiring prediction. Your honest fit assessment is written by the AI at the top of the generated letter.</p>
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
            </div>


            <div className="mt-6 rounded-xl border border-brand/15 bg-brand/[0.045] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-muted">Letter guidance</p>
                  <h2 className="mt-2 text-xl font-black">{phaseB.companyDNA.label}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted">{phaseB.companyDNA.coverLetterRule}</p>
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
            </details>
          </div>

          <div className="space-y-6">
            {/* Editable cover letter is the primary output and appears first. */}
            <div className="rounded-lg border border-line bg-fg/[0.035] p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">Cover letter</h2>
                  <p className="mt-1 text-xs text-subtle">Language: {outputLanguage}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    disabled={!letterBody}
                    className="inline-flex items-center gap-2 rounded-xl border border-line bg-fg/[0.05] px-3 py-2 text-xs font-black text-fg hover:bg-fg/[0.09] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Copy className="h-4 w-4" /> Copy
                  </button>
                  <button
                    onClick={handleDownloadPdf}
                    disabled={!letterBody}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand px-3 py-2 text-xs font-black text-on-brand hover:bg-brand disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" /> Download PDF
                  </button>
                </div>
              </div>
              <textarea
                value={letterBody}
                onChange={(e) => setLetterBody(e.target.value)}
                placeholder="Your cover letter will appear here after generation. You can edit it before copying or downloading."
                className="mt-5 min-h-[520px] w-full resize-y whitespace-pre-wrap rounded-lg border border-line bg-canvas-soft p-5 text-sm leading-7 text-fg outline-none focus:border-brand"
                spellCheck
              />
              <p className="mt-2 text-xs text-subtle">Edit freely. Copy and Download PDF use your edited text.</p>
            </div>

            {/* Honest assessment is optional supporting information. */}
            <details className="rounded-lg border border-warning/25 bg-warning/[0.06] p-6">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-warning">
                <AlertTriangle className="h-4 w-4 text-warning" /> Honest fit assessment
              </summary>
              {assessment ? (
                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-fg">{assessment}</p>
              ) : (
                <p className="mt-4 text-sm leading-7 text-muted">
                  {generated
                    ? "This letter did not include a separate fit note. Use the match and risk signals on the left to judge fit before sending."
                    : "Generate a letter to get an honest read on how well this role fits, gaps included."}
                </p>
              )}
              {notes ? (
                <div className="mt-4 border-t border-warning/20 pt-4">
                  <p className="whitespace-pre-wrap text-sm leading-7 text-muted">{notes}</p>
                </div>
              ) : null}
            </details>
          </div>
        </section>
      </div>
    </main>
    </PremiumFeatureGate>
  );
}

export default function CoverLetterWorkspacePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <CoverLetterWorkspaceContent />
    </Suspense>
  );
}
