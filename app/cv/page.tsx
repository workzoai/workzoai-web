"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PremiumFeatureGate from "@/components/PremiumFeatureGate";
import { ArrowLeft, AlertTriangle, CheckCircle2, Copy, Download, FileText, Gauge, Loader2, Printer, Sparkles, Target } from "lucide-react";
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
import { extractResumeProfileComplex, normalizeResumeText } from "@/lib/workzoResumeParser";
import { cleanExtractedCvText, cleanCvHeadline } from "@/lib/workzoCvPdfCleaner";
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
  const [aiRewriteLoading, setAiRewriteLoading] = useState(false);
  const [aiRewriteError, setAiRewriteError] = useState("");
  const [aiRewriteApplied, setAiRewriteApplied] = useState(false);
  const [savedResumeProfile, setSavedResumeProfile] = useState<ResumeProfile | undefined>(undefined);
  const [profileRecovering, setProfileRecovering] = useState(false);
  const [profileNeedsReupload, setProfileNeedsReupload] = useState(false);

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
    const storedCvText = normalizeSetupCvText(setup);
    setCvText(storedCvText);
    setJobDescription(normalizeSetupJobDescription(setup));
    setTargetRole(normalizeSetupTargetRole(setup));
    setTargetMarket(normalizeSetupTargetMarket(setup));

    const profile = setup?.resumeProfile;

    // Detect a broken/stale stored profile from before our CV cleaning fixes.
    function isLowQualityProfile(p: unknown): boolean {
      if (!p || typeof p !== "object" || !("basics" in p)) return true;
      const prof = p as ResumeProfile;

      // Name checks
      const rawName = prof.basics?.name?.trim() || "";
      const name = rawName.toLowerCase();
      if (!name || name === "candidate" || name === "professional" || name === "unknown") return true;

      // Global guard: a candidate name must not be a skill, tool, degree, role,
      // section title, company suffix, or long capability phrase. This prevents
      // examples like "Enterprise Resource Planning" from becoming the name
      // for any CV template, not just one sample PDF.
      const normalizedName = name.replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
      const skillNames = (prof.skills || []).map((s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim());
      if (skillNames.includes(normalizedName)) return true;
      if (/\b(project management|resource planning|software development|cost planning|data analysis|machine learning|process improvement|team training|customer support|technical support|stakeholder management|communication|leadership|python|sql|excel|tableau|power bi|salesforce|sap|erp|crm)\b/i.test(rawName)) return true;
      if (/\b(manager|engineer|designer|developer|analyst|consultant|specialist|coordinator|administrator|support|officer|director|lead|intern|project|software|data|technical|customer|enterprise|resource|planning)\b/i.test(rawName)) return true;

      // Headline checks — truncated or wrong type
      const headline = prof.basics?.headline || "";
      if (/\b(gmbh|ag|ltd|llc|inc|corp)\b/i.test(headline)) return true;
      // "Engineer" alone (single generic word) means the title was truncated
      if (headline.trim().split(/\s+/).length === 1 && headline.length < 12) return true;

      // Experience quality checks
      const exp = prof.experience || [];
      if (exp.length > 0) {
        // All titles are single generic words = truncated extraction
        const allTitlesTruncated = exp.every(
          (e) => !e.title || e.title.trim().split(/\s+/).length <= 1
        );
        if (allTitlesTruncated) return true;

        // Any title starts with a digit = date misclassified as title
        const hasBadTitle = exp.some((e) => /^\d{4}/.test(e.title || ""));
        if (hasBadTitle) return true;

        // Company names duplicated inline ("Cummins GmbH • Cummins GmbH")
        const hasDuplicateCompany = exp.some((e) => {
          const c = e.company || "";
          const parts = c.split(/\s*[•|]\s*/);
          return parts.length >= 2 && parts[0].trim() === parts[1]?.trim();
        });
        if (hasDuplicateCompany) return true;
      }

      return false;
    }

    if (profile && typeof profile === "object" && "basics" in profile && !isLowQualityProfile(profile)) {
      // Good profile — use it directly
      setSavedResumeProfile(profile as ResumeProfile);
      debugCvProfile("cv.page.savedResumeProfile.set", profile);
      return;
    }

    // Profile is stale/broken. Get the best raw text we can find.
    const s = setup as Record<string, unknown> | null;
    const rawText = (s?.rawCvText as string)
      || (s?.uploadedCvText as string)
      || storedCvText;

    debugCvPipeline("cv.page.profile.recovery", {
      reason: profile ? "low_quality_profile" : "no_profile",
      name: (profile as ResumeProfile | undefined)?.basics?.name,
      rawChars: rawText?.length ?? 0,
    });

    // Do not locally re-parse before AI recovery. The local fallback is useful
    // only inside the server parser; on product pages it can overwrite a good
    // structured profile with a weaker regex result. Use /api/cv/structure as
    // the single repair path for stale profiles.
    const textForAi = rawText?.trim() || "";
    if (textForAi.length > 200) {
      setProfileRecovering(true);
      debugCvPipeline("cv.page.profile.ai_reparse", { chars: textForAi.length });
      fetch("/api/cv/structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cvText: textForAi,
          layoutText: textForAi,
          targetRole: normalizeSetupTargetRole(setup),
          targetMarket: normalizeSetupTargetMarket(setup),
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          const aiProfile = data?.resumeProfile || data?.profile;
          if (aiProfile && typeof aiProfile === "object" && "basics" in aiProfile) {
            const p = aiProfile as ResumeProfile;
            if (!isLowQualityProfile(p)) {
              setSavedResumeProfile(p);
              setProfileRecovering(false);
              debugCvProfile("cv.page.savedResumeProfile.ai_reparse", p);
              // Rebuild cvText from the clean profile so the copilot gets correct data
              // instead of the old garbled stored text
              const cleanLines: string[] = [];
              const b = p.basics || {};
              if (b.name) cleanLines.push(`Candidate name: ${b.name}`);
              if (b.headline) cleanLines.push(`Headline: ${b.headline}`);
              const ct = [b.email, b.phone, b.location].filter(Boolean).join(" • ");
              if (ct) cleanLines.push(`Contact: ${ct}`);
              if (p.summary) cleanLines.push(`Summary: ${p.summary}`);
              if (p.experience?.length) {
                cleanLines.push("Experience:");
                p.experience.slice(0, 6).forEach((e) => {
                  const t = [e.title, e.company, e.dates].filter(Boolean).join(" • ");
                  if (t) cleanLines.push(`- ${t}`);
                  e.bullets?.slice(0, 4).forEach((bl: string) => cleanLines.push(`  • ${bl}`));
                });
              }
              if (p.education?.length) {
                cleanLines.push("Education:");
                p.education.slice(0, 4).forEach((e) => {
                  const l = [e.degree, e.institution, e.dates].filter(Boolean).join(" • ");
                  if (l) cleanLines.push(`- ${l}`);
                });
              }
              if (p.skills?.length) cleanLines.push(`Skills: ${p.skills.slice(0, 24).join(", ")}`);
              if (p.languages?.length) cleanLines.push(`Languages: ${p.languages.join(", ")}`);
              const cleanCvText = cleanLines.join("\n").trim();
              if (cleanCvText) setCvText(cleanCvText);
              return;
            }
          }
          // AI also produced bad profile — need fresh upload
          setProfileRecovering(false);
          setProfileNeedsReupload(true);
        })
        .catch(() => {
          setProfileRecovering(false);
          setProfileNeedsReupload(true);
        });
    } else {
      // Not enough text to re-parse at all — need fresh upload
      setProfileNeedsReupload(true);
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

  // ── Shared JD keyword gap analysis ──────────────────────────────────────
  // Previously there were two separate, independently-broken extractors
  // here (`atsKeywords` and `atsAnalysis`). Both used naive sliding-window /
  // frequency regexes over raw JD prose, which on narrative, translated, or
  // run-on job descriptions produced meaningless "keywords" like
  // "the customer when they" or "is experience" — arbitrary word windows,
  // not actual skills or requirements.
  //
  // This version extracts keywords from a curated dictionary of real
  // skill/tool/role/domain terms (single words and known multi-word phrases
  // like "project management"), plus JD words that appear frequently AND
  // are not stopwords/function words. Matching against the CV uses word
  // boundaries, so "us" no longer "matches" inside "customers".
  const KNOWN_PHRASES = [
    "project management", "account management", "change management", "key account manager",
    "customer success", "customer success manager", "success manager",
    "stakeholder management", "people management", "team management",
    "hr management", "hr administration", "human resources",
    "power bi", "power point", "google sheets", "microsoft office",
    "machine learning", "data analysis", "data analytics",
    "public relations", "media relations", "crisis communication",
    "content creation", "event planning", "social media management",
    "brand management", "press releases",
  ];

  const SKILL_DICTIONARY = new Set([
    ...KNOWN_PHRASES,
    "sql", "python", "excel", "tableau", "salesforce", "zendesk", "jira", "hubspot",
    "azure", "aws", "gcp", "react", "node", "java", "typescript", "javascript",
    "api", "saas", "agile", "scrum", "crm", "erp",
    "stakeholder", "stakeholders", "customer", "customers", "client", "clients",
    "communication", "leadership", "negotiation", "presentation", "onboarding",
    "implementation", "escalation", "escalations", "milestones", "rollout",
    "management", "manager", "project", "projects", "experience",
    "german", "english", "french", "dutch", "spanish",
    "degree", "certification", "certifications", "qualification", "qualifications",
    "travel", "conferences", "salary", "bonus", "commission",
    "empathy", "eloquent", "eloquence", "proactive", "structured",
    "media", "press", "branding", "marketing", "advertising",
    "support", "training", "documentation", "reporting", "dashboards",
  ]);

  const keywordGap = useMemo(() => {
    if (!jobDescription.trim() || !cvText.trim()) {
      return { score: 0, matched: [] as string[], partial: [] as string[], missing: [] as string[], total: 0 };
    }

    const jdLower = jobDescription.toLowerCase();
    const cvLower = cvText.toLowerCase();

    const stopwords = new Set([
      "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "from",
      "is", "are", "was", "were", "will", "be", "been", "being", "have", "has", "had", "do", "does", "did",
      "not", "this", "that", "these", "those", "we", "you", "they", "their", "our", "your", "its", "it",
      "as", "if", "than", "then", "so", "can", "could", "should", "would", "may", "must", "shall",
      "who", "what", "when", "where", "how", "why", "which", "all", "any", "both", "each", "more", "most",
      "again", "out", "up", "down", "no", "yes", "etc", "also", "such", "into", "about", "over", "after",
      "before", "right", "make", "made", "get", "got", "go", "going", "want", "like", "lot", "point",
      "start", "level", "job", "work", "works", "working", "really", "very", "well", "good",
    ]);

    // Word-boundary "includes" check — avoids false positives like "us"
    // matching inside "customers".
    const includesWord = (text: string, term: string) => {
      if (term.includes(" ")) return text.includes(term);
      return new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text);
    };

    // 1) Known multi-word phrases mentioned in the JD.
    const found = new Set<string>();
    for (const phrase of KNOWN_PHRASES) {
      if (includesWord(jdLower, phrase)) found.add(phrase);
    }

    // 2) Single JD words that are real skill/domain terms (in our
    // dictionary) or appear often enough to be a clear requirement.
    const jdWords = jdLower.match(/\b[a-z][a-z0-9+#.-]{2,25}\b/g) || [];
    const freq: Record<string, number> = {};
    for (const word of jdWords) {
      if (stopwords.has(word)) continue;
      freq[word] = (freq[word] || 0) + 1;
    }
    for (const [word, count] of Object.entries(freq)) {
      if (SKILL_DICTIONARY.has(word) || count >= 3) found.add(word);
    }

    const keywords = Array.from(found).slice(0, 24);

    const matched: string[] = [];
    const partial: string[] = [];
    const missing: string[] = [];

    for (const keyword of keywords) {
      if (includesWord(cvLower, keyword)) {
        matched.push(keyword);
        continue;
      }
      // Partial: for multi-word phrases, at least one meaningful word is present.
      const words = keyword.split(" ").filter((w) => w.length >= 4 && !stopwords.has(w));
      if (words.length > 1 && words.some((w) => includesWord(cvLower, w))) {
        partial.push(keyword);
        continue;
      }
      missing.push(keyword);
    }

    const total = keywords.length || 1;
    const score = Math.round(((matched.length + partial.length * 0.5) / total) * 100);

    return { score, matched, partial, missing, total };
  }, [cvText, jobDescription]);

  // Both UI sections below previously used separately-broken extractors
  // (`atsKeywords` for "JD keyword gap analysis", `atsAnalysis` for
  // "Keyword match score"). Both now read from the single fixed
  // `keywordGap` result above.
  const atsKeywords = keywordGap;
  const atsAnalysis = keywordGap;
  const atsScore = keywordGap.score;
  const phaseB = useMemo(
    () => buildPhaseBInsights({ cvText, jobDescription, targetRole, targetMarket }),
    [cvText, jobDescription, targetRole, targetMarket],
  );


  useEffect(() => {
    setAtsText(improvedCv || "");
    setAiRewriteApplied(false);
    setAiRewriteError("");
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

  async function handleAiRewrite() {
    if (!jobDescription.trim()) {
      setAiRewriteError("Paste a job description first so the rewrite can target it.");
      return;
    }
    if (!(atsText || improvedCv).trim()) {
      setAiRewriteError("Upload a CV first.");
      return;
    }

    setAiRewriteLoading(true);
    setAiRewriteError("");

    try {
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cv_rewrite_ats",
          cvText: atsText || improvedCv,
          // Also send the structured profile so the copilot gets clean typed data
          // instead of the raw extracted text which may have parsing artefacts
          resumeProfile: savedResumeProfile || undefined,
          jobDescription,
          targetRole,
          targetMarket,
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        success?: boolean;
        output?: string;
        error?: string;
      } | null;

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "AI rewrite failed. Please try again.");
      }

      const rewritten = (data.output || "").trim();
      if (!rewritten) throw new Error("AI rewrite returned no content.");

      setAtsText(rewritten);
      setAiRewriteApplied(true);
    } catch (err) {
      setAiRewriteError(err instanceof Error ? err.message : "AI rewrite failed. Please try again.");
    } finally {
      setAiRewriteLoading(false);
    }
  }

  function handleRevertRewrite() {
    setAtsText(improvedCv || "");
    setAiRewriteApplied(false);
    setAiRewriteError("");
  }

  return (
    <PremiumFeatureGate feature="improve_cv" title="Improve CV is a Premium feature" description="ATS keyword analysis, job-specific CV improvement, exports, and advanced CV targeting are included in Premium.">
      <main className="min-h-screen bg-[#020817] px-5 py-6 text-white">
        {/* CV data recovery banner */}
        {(profileRecovering || profileNeedsReupload) && (
          <div className={`mx-auto mb-5 flex max-w-5xl items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${profileNeedsReupload ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-cyan-500/20 bg-cyan-500/[0.06] text-cyan-300"}`}>
            {profileRecovering ? (
              <>
                <svg className="mt-0.5 h-4 w-4 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                <span>Refreshing your CV profile with improved extraction…</span>
              </>
            ) : (
              <>
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                <span>Your stored CV data needs refreshing. <a href="/onboarding" className="font-semibold underline underline-offset-2 hover:text-amber-100">Re-upload your CV on the setup page</a> to fix this.</span>
              </>
            )}
          </div>
        )}
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


          {/* ATS keyword gap analysis */}
          {jobDescription.trim() && cvText.trim() && (
            <div className="rounded-[2rem] border border-emerald-300/15 bg-emerald-400/[0.045] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">ATS Optimization</p>
                  <h2 className="mt-2 text-xl font-black">Keyword match score</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {atsAnalysis.score >= 75
                      ? "Strong keyword coverage. Your CV includes most JD requirements."
                      : atsAnalysis.score >= 50
                        ? "Moderate coverage. Adding the missing keywords could significantly improve ATS pass rate."
                        : "Low keyword coverage. Many JD requirements are not reflected in your CV."}
                  </p>
                </div>
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-emerald-300/20 bg-black/25 text-center">
                  <p className="text-2xl font-black text-emerald-100">{atsAnalysis.score}%</p>
                  <p className="-mt-1 text-[9px] font-black text-slate-500">ATS</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${atsAnalysis.score >= 75 ? "bg-emerald-400" : atsAnalysis.score >= 50 ? "bg-amber-400" : "bg-red-400"}`}
                  style={{ width: `${atsAnalysis.score}%` }}
                />
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.06] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-200">Matched ({atsAnalysis.matched.length})</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {atsAnalysis.matched.map(kw => (
                      <span key={kw} className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-black text-emerald-100">{kw}</span>
                    ))}
                    {atsAnalysis.matched.length === 0 && <p className="text-xs text-slate-500">None yet</p>}
                  </div>
                </div>
                <div className="rounded-2xl border border-amber-300/15 bg-amber-400/[0.06] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-200">Partial ({atsAnalysis.partial.length})</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {atsAnalysis.partial.map(kw => (
                      <span key={kw} className="rounded-full bg-amber-400/15 px-2.5 py-1 text-xs font-black text-amber-100">{kw}</span>
                    ))}
                    {atsAnalysis.partial.length === 0 && <p className="text-xs text-slate-500">None</p>}
                  </div>
                </div>
                <div className="rounded-2xl border border-red-300/15 bg-red-400/[0.06] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-red-200">Missing ({atsAnalysis.missing.length})</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {atsAnalysis.missing.map(kw => (
                      <span key={kw} className="rounded-full bg-red-400/15 px-2.5 py-1 text-xs font-black text-red-100">{kw}</span>
                    ))}
                    {atsAnalysis.missing.length === 0 && <p className="text-xs text-slate-500">None missing</p>}
                  </div>
                </div>
              </div>

              {atsAnalysis.missing.length > 0 && (
                <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs font-black text-white">Quick fix</p>
                  <p className="mt-1 text-sm leading-6 text-slate-300">
                    Add these terms naturally to your CV where you genuinely have experience: <span className="font-bold text-amber-200">{atsAnalysis.missing.slice(0, 5).join(", ")}</span>. Only add terms that reflect real experience — never keyword-stuff.
                  </p>
                </div>
              )}
            </div>
          )}

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

          <div className="rounded-[2rem] border border-emerald-300/15 bg-emerald-500/[0.04] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">ATS Optimization</p>
                <h2 className="mt-2 text-xl font-black">JD keyword gap analysis</h2>
                <p className="mt-1 text-sm text-slate-400">Keywords the job description requires — checked against your CV.</p>
              </div>
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-emerald-300/20 bg-black/25 text-center">
                <p className="text-xl font-black text-emerald-100">{atsScore}%</p>
                <p className="-mt-1 text-[9px] font-black text-slate-500">ATS</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.06] p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-200 mb-2">Matched ({atsKeywords.matched.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {atsKeywords.matched.map((kw) => (
                    <span key={kw} className="rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-black text-emerald-200">{kw}</span>
                  ))}
                  {atsKeywords.matched.length === 0 && <p className="text-xs text-slate-500">Paste a job description to analyse.</p>}
                </div>
              </div>
              <div className="rounded-2xl border border-amber-300/15 bg-amber-400/[0.06] p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-200 mb-2">Partially matched ({atsKeywords.partial.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {atsKeywords.partial.map((kw) => (
                    <span key={kw} className="rounded-lg border border-amber-300/20 bg-amber-400/10 px-2 py-0.5 text-[11px] font-black text-amber-200">{kw}</span>
                  ))}
                  {atsKeywords.partial.length === 0 && <p className="text-xs text-slate-500">No partial matches found.</p>}
                </div>
              </div>
              <div className="rounded-2xl border border-red-300/15 bg-red-400/[0.06] p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-red-200 mb-2">Missing ({atsKeywords.missing.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {atsKeywords.missing.map((kw) => (
                    <span key={kw} className="rounded-lg border border-red-300/20 bg-red-400/10 px-2 py-0.5 text-[11px] font-black text-red-200">{kw}</span>
                  ))}
                  {atsKeywords.missing.length === 0 && <p className="text-xs text-slate-500">{jobDescription ? "No missing keywords." : "Paste a job description to see gaps."}</p>}
                </div>
              </div>
            </div>

            {atsKeywords.missing.length > 0 && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400 mb-2">Quick fix</p>
                <p className="text-sm leading-6 text-slate-300">
                  Add these missing keywords naturally into your CV bullet points — ideally in context with a measurable result. Do not keyword-stuff; ATS systems also check for context.
                </p>
              </div>
            )}
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
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-black">ATS text version</h2>
              <div className="flex items-center gap-2">
                {aiRewriteApplied && (
                  <button
                    type="button"
                    onClick={handleRevertRewrite}
                    className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-black text-slate-300 transition hover:bg-white/10"
                  >
                    Revert to original
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void handleAiRewrite()}
                  disabled={aiRewriteLoading || !jobDescription.trim()}
                  title={!jobDescription.trim() ? "Paste a job description to enable AI rewrite" : undefined}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 px-4 py-1.5 text-xs font-black text-white transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {aiRewriteLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {aiRewriteLoading ? "Rewriting…" : aiRewriteApplied ? "Rewrite again" : "AI rewrite for this JD"}
                </button>
              </div>
            </div>
            {aiRewriteError && (
              <p className="mb-3 text-xs font-semibold text-amber-300">{aiRewriteError}</p>
            )}
            {aiRewriteApplied && !aiRewriteError && (
              <p className="mb-3 text-xs font-semibold text-emerald-300">
                Rewritten for this job description. Same jobs, dates, and companies — only wording was changed. Review before downloading, and revert any line that doesn&apos;t sound like you.
              </p>
            )}
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
    </PremiumFeatureGate>
  );
}
