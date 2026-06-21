"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PremiumFeatureGate from "@/components/PremiumFeatureGate";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  FileText,
  Gauge,
  Loader2,
  Printer,
  Sparkles,
  Target,
} from "lucide-react";
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
import {
  completeResumeProfile,
  isLowQualityResumeProfile,
  keepBetterProfile,
  mergePreservingOriginalStructure,
  resumeProfileHasMinimumStructure,
} from "@/lib/workzoResumeProfileManager";

const templates: Array<{ id: CvTemplate; label: string; description: string }> = [
  { id: "ats", label: "ATS Clean", description: "Strict, single-column, recruiter-safe layout." },
  { id: "modern", label: "Modern Professional", description: "Premium two-column layout with skill chips." },
  { id: "career_switcher", label: "Career Switcher", description: "Highlights transferable fit and projects." },
];

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
    <div className="rounded-xl border border-white/10 bg-white/[0.03]">
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

export default function CvWorkspacePage() {
  const [cvText, setCvText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [targetMarket, setTargetMarket] = useState("global");
  const [outputLanguage, setOutputLanguage] = useState("English");
  const [template, setTemplate] = useState<CvTemplate>("ats");
  const [atsText, setAtsText] = useState("");
  const [aiRewriteLoading, setAiRewriteLoading] = useState(false);
  const [aiRewriteError, setAiRewriteError] = useState("");
  const [aiRewriteApplied, setAiRewriteApplied] = useState(false);
  const [savedResumeProfile, setSavedResumeProfile] = useState<ResumeProfile | undefined>(undefined);
  // Structured profile returned directly by the AI rewrite (cv_rewrite_ats),
  // when available. Using this instead of re-parsing the rewritten plain
  // text through extractResumeProfile avoids the data loss/corruption that
  // happened previously: dropped jobs, the candidate's name being
  // overwritten by a project title, single-word project names falling
  // back to "Candidate", and the summary collapsing into a single bullet.
  const [rewrittenResumeProfile, setRewrittenResumeProfile] = useState<ResumeProfile | undefined>(undefined);
  const [profileRecovering, setProfileRecovering] = useState(false);
  const [profileNeedsReupload, setProfileNeedsReupload] = useState(false);
  const [viewMode, setViewMode] = useState<"text" | "preview">("text");
  const [cvTextExpanded, setCvTextExpanded] = useState(false);
  const [copyConfirmed, setCopyConfirmed] = useState(false);

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

    function isLowQualityProfile(p: unknown): boolean {
      if (!p || typeof p !== "object" || !("basics" in p)) return true;
      const prof = p as ResumeProfile;

      const rawName = prof.basics?.name?.trim() || "";
      const name = rawName.toLowerCase();
      if (!name || name === "candidate" || name === "professional" || name === "unknown") return true;

      const normalizedName = name.replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
      const skillNames = (prof.skills || []).map((s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim());
      if (skillNames.includes(normalizedName)) return true;

      // Also reject if the name exactly matches one of the candidate's own
      // project titles — this is the specific failure mode where a project
      // name like "YouTube API And NLP" or "GANS E-Scooter Service" ends up
      // in basics.name instead of the real human name.
      const projectNames = (prof.projects || []).map((proj) => String(proj?.name || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim());
      if (normalizedName && projectNames.includes(normalizedName)) return true;

      // Reject names containing tech/project acronyms that essentially never
      // appear in a real human name (API, NLP, RAG, GCP, SQL, etc.) — these
      // are strong signals the "name" is actually a project title or skill
      // phrase that slipped past the other checks.
      if (/\b(API|NLP|RAG|GCP|SQL|ITIL|ITSM|CRM|ERP|SDK|CSS|HTML|JSON|REST|AWS)\b/.test(rawName)) return true;

      if (/\b(project management|resource planning|software development|cost planning|data analysis|machine learning|process improvement|team training|customer support|technical support|stakeholder management|communication|leadership|python|sql|excel|tableau|power bi|salesforce|sap|erp|crm|public relations|time management|critical thinking|effective communication|generative ai|data engineering|data visualization|machine learning|web scraping|cloud functions|api integration|process improvement)\b/i.test(rawName)) return true;
      if (/\b(manager|engineer|designer|developer|analyst|consultant|specialist|coordinator|administrator|support|officer|director|lead|intern|project|software|data|technical|customer|enterprise|resource|planning|relations|communication|management|specialist)\b/i.test(rawName)) return true;

      const headline = prof.basics?.headline || "";
      if (/\b(gmbh|ag|ltd|llc|inc|corp)\b/i.test(headline)) return true;
      if (headline.trim().split(/\s+/).length === 1 && headline.length < 12) return true;

      const exp = prof.experience || [];
      if (exp.length > 0) {
        const allTitlesTruncated = exp.every((e) => !e.title || e.title.trim().split(/\s+/).length <= 1);
        if (allTitlesTruncated) return true;
        const hasBadTitle = exp.some((e) => /^\d{4}/.test(e.title || ""));
        if (hasBadTitle) return true;
        const hasDuplicateCompany = exp.some((e) => {
          const c = e.company || "";
          const parts = c.split(/\s*[•|]\s*/);
          return parts.length >= 2 && parts[0].trim() === parts[1]?.trim();
        });
        if (hasDuplicateCompany) return true;
      }

      return false;
    }

    if (profile && typeof profile === "object" && "basics" in profile && !isLowQualityResumeProfile(profile)) {
      const completed = completeResumeProfile(profile as ResumeProfile, storedCvText);
      // Enforce the authoritative candidate name from the setup store.
      // The setup store's candidateName was set by the name_override pipeline
      // which is more reliable than what the AI parser put in basics.name.
      // This prevents "Public Relations", "Matplotlib Seaborn Tableau" etc.
      // from slipping through isLowQualityProfile and corrupting the rewritten CV.
      const storedCandidateName = String(
        (setup as Record<string, unknown>)?.candidateName ||
        (setup as Record<string, unknown>)?.name ||
        ""
      ).trim();
      if (storedCandidateName && storedCandidateName.toLowerCase() !== "candidate" && storedCandidateName !== completed.basics?.name) {
        const nameWords = storedCandidateName.split(/\s+/);
        // Only use stored name if it looks like a real human name (2+ words, no role keywords)
        const looksHuman = nameWords.length >= 2 && nameWords.length <= 5 &&
          !/(public|relations|management|engineer|analyst|specialist|manager|developer|coordinator)/i.test(storedCandidateName);
        if (looksHuman) {
          completed.basics = { ...completed.basics, name: storedCandidateName };
        }
      }
      setSavedResumeProfile(completed);
      setProfileNeedsReupload(false);
      debugCvProfile("cv.page.savedResumeProfile.set", completed);
      return;
    }

    const s = setup as Record<string, unknown> | null;
    const rawText = (s?.rawCvText as string) || (s?.uploadedCvText as string) || storedCvText;

    debugCvPipeline("cv.page.profile.recovery", {
      reason: profile ? "low_quality_profile" : "no_profile",
      name: (profile as ResumeProfile | undefined)?.basics?.name,
      rawChars: rawText?.length ?? 0,
    });

    const textForAi = rawText?.trim() || "";
    if (textForAi.length > 200) {
      setProfileRecovering(true);
      debugCvPipeline("cv.page.profile.ai_reparse", { chars: textForAi.length });
      fetch("/api/cv/structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          cvText: textForAi,
          layoutText: textForAi,
          targetRole: normalizeSetupTargetRole(setup),
          targetMarket: normalizeSetupTargetMarket(setup),
          // Pass any already-known name so the structure route doesn't re-derive
          // a wrong name from the pasted/layout text when the profile exists.
          candidateName: (profile as ResumeProfile | undefined)?.basics?.name || "",
          fileName: (setup as Record<string, unknown>)?.fileName as string || "",
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          const aiProfile = data?.resumeProfile || data?.profile;
          if (aiProfile && typeof aiProfile === "object" && "basics" in aiProfile) {
            const best = keepBetterProfile(aiProfile as ResumeProfile, profile as ResumeProfile | undefined, textForAi);
            if (best && !isLowQualityResumeProfile(best)) {
              setSavedResumeProfile(best);
              setProfileRecovering(false);
              setProfileNeedsReupload(false);
              debugCvProfile("cv.page.savedResumeProfile.ai_reparse", best);
              const cleanLines: string[] = [];
              const b = best.basics || {};
              if (b.name) cleanLines.push(`Candidate name: ${b.name}`);
              if (b.headline) cleanLines.push(`Headline: ${b.headline}`);
              const ct = [b.email, b.phone, b.location].filter(Boolean).join(" • ");
              if (ct) cleanLines.push(`Contact: ${ct}`);
              if (best.summary) cleanLines.push(`Summary: ${best.summary}`);
              if (best.experience?.length) {
                cleanLines.push("Experience:");
                best.experience.slice(0, 6).forEach((e) => {
                  const t = [e.title, e.company, e.dates].filter(Boolean).join(" • ");
                  if (t) cleanLines.push(`- ${t}`);
                  e.bullets?.slice(0, 4).forEach((bl: string) => cleanLines.push(`  • ${bl}`));
                });
              }
              if (best.education?.length) {
                cleanLines.push("Education:");
                best.education.slice(0, 4).forEach((e) => {
                  const l = [e.degree, e.institution, e.dates].filter(Boolean).join(" • ");
                  if (l) cleanLines.push(`- ${l}`);
                });
              }
              if (best.skills?.length) cleanLines.push(`Skills: ${best.skills.slice(0, 24).join(", ")}`);
              if (best.languages?.length) cleanLines.push(`Languages: ${best.languages.join(", ")}`);
              const cleanCvText = cleanLines.join("\n").trim();
              if (cleanCvText) setCvText(cleanCvText);
              return;
            }
          }
          setProfileRecovering(false);
          setProfileNeedsReupload(!resumeProfileHasMinimumStructure(profile));
        })
        .catch(() => {
          setProfileRecovering(false);
          setProfileNeedsReupload(!resumeProfileHasMinimumStructure(profile));
        });
    } else {
      setProfileNeedsReupload(!resumeProfileHasMinimumStructure(profile));
    }
  }, []);

  // `baselineInput` feeds the auto-generated "improved CV" baseline. It must
  // NOT depend on atsText/aiRewriteApplied — those are the result of running
  // the AI rewrite, and feeding them back in here would create a loop: the
  // rewrite changes atsText → baseline recomputes from the new atsText →
  // the effect below resets atsText back to the (now German, then English
  // again) baseline → the rewrite is silently discarded immediately after
  // being applied. This was the cause of the output language being ignored
  // in the template preview: the German rewrite was overwritten by a fresh
  // English regeneration within the same render cycle.
  const baselineInput = useMemo(
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

  // `resumeInput` feeds the template/preview/download — this is the one that
  // SHOULD reflect the rewrite (and its language) once applied.
  const resumeInput = useMemo(
    () => ({
      cvText: aiRewriteApplied && atsText.trim() ? atsText : cvText,
      // Prefer the AI's own structured profile from the rewrite when we have
      // one — this is the fix for the rewrite corrupting the candidate name,
      // dropping jobs/projects, and losing education. Only fall back to
      // re-parsing the plain text (resumeProfile: undefined, which makes
      // buildResumeJson call extractResumeProfile on cvText) when the AI
      // didn't return structured JSON for some reason — e.g. an older
      // cached response, or the JSON path failed and the route fell back
      // to plain text.
      resumeProfile: aiRewriteApplied && atsText.trim()
        ? (rewrittenResumeProfile || undefined)
        : savedResumeProfile,
      jobDescription,
      targetRole,
      targetMarket,
      template,
    }),
    [cvText, atsText, aiRewriteApplied, savedResumeProfile, rewrittenResumeProfile, jobDescription, targetRole, targetMarket, template],
  );

  const improvedCv = useMemo(() => {
    debugCvProfile("cv.page.generateImprovedCv.inputProfile", baselineInput.resumeProfile);
    const output = generateImprovedCv(baselineInput);
    debugCvText("cv.page.generateImprovedCv.outputText", output);
    return output;
  }, [baselineInput]);

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

    const includesWord = (text: string, term: string) => {
      if (term.includes(" ")) return text.includes(term);
      return new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text);
    };

    const found = new Set<string>();
    for (const phrase of KNOWN_PHRASES) {
      if (includesWord(jdLower, phrase)) found.add(phrase);
    }

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

  const atsKeywords = keywordGap;
  const atsScore = keywordGap.score;
  const phaseB = useMemo(
    () => buildPhaseBInsights({ cvText, jobDescription, targetRole, targetMarket }),
    [cvText, jobDescription, targetRole, targetMarket],
  );

  useEffect(() => {
    setAtsText(improvedCv || "");
    setAiRewriteApplied(false);
    setAiRewriteError("");
    setRewrittenResumeProfile(undefined);
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
    setCopyConfirmed(true);
    setTimeout(() => setCopyConfirmed(false), 1800);
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
    setViewMode("text");

    try {
      // Always base the rewrite on the ORIGINAL saved profile + original cvText,
      // never on a previously rewritten profile. Reusing the rewritten profile
      // as input causes each successive rewrite to lose more content (missing
      // jobs, merged projects, shortened bullets) because merge artifacts
      // compound across runs.
      const freshProfileForRewrite = savedResumeProfile
        ? completeResumeProfile(savedResumeProfile, cvText)
        : undefined;

      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "cv_rewrite_ats",
          cvText: cvText || atsText || improvedCv,
          resumeProfile: freshProfileForRewrite,
          jobDescription,
          targetRole,
          targetMarket,
          outputLanguage,
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        success?: boolean;
        output?: string;
        resumeProfile?: ResumeProfile;
        error?: string;
      } | null;

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "AI rewrite failed. Please try again.");
      }

      const rewritten = (data.output || "").trim();
      if (!rewritten) throw new Error("AI rewrite returned no content.");

      setAtsText(rewritten);
      // If the AI returned a structured profile alongside the plain text,
      // use it directly for the template/preview/download path — this is
      // what actually fixes the dropped-job/wrong-name/lost-project bugs,
      // since the model fills in each field explicitly instead of a regex
      // parser having to infer structure from prose after the fact.
      let mergedProfile = savedResumeProfile
        ? mergePreservingOriginalStructure(
            completeResumeProfile(savedResumeProfile, cvText),
            data.resumeProfile && typeof data.resumeProfile === "object" ? data.resumeProfile : undefined,
          )
        : undefined;
      // Final name safety: if the merged profile still has a wrong name,
      // restore it from savedResumeProfile which has the correct name.
      if (mergedProfile && savedResumeProfile?.basics?.name && mergedProfile.basics?.name !== savedResumeProfile.basics.name) {
        mergedProfile = {
          ...mergedProfile,
          basics: { ...mergedProfile.basics, name: savedResumeProfile.basics.name },
        };
      }
      setRewrittenResumeProfile(mergedProfile);
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
    setRewrittenResumeProfile(undefined);
  }

  const jdReady = jobDescription.trim().length > 0;
  const cvReady = cvText.trim().length > 0;

  return (
    <PremiumFeatureGate feature="improve_cv" title="Improve CV is a Premium feature" description="ATS keyword analysis, job-specific CV improvement, exports, and advanced CV targeting are included in Premium.">
      <main className="min-h-screen bg-[#020817] px-4 py-6 text-white sm:px-5">
        {(profileRecovering || profileNeedsReupload) && (
          <div className={cn(
            "mx-auto mb-5 flex max-w-5xl items-start gap-3 rounded-lg border px-4 py-3 text-sm",
            profileNeedsReupload ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-cyan-500/20 bg-cyan-500/[0.06] text-cyan-300",
          )}>
            {profileRecovering ? (
              <>
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                <span>Refreshing your CV profile with improved extraction…</span>
              </>
            ) : (
              <>
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <span>Your stored CV data needs refreshing. <a href="/onboarding" className="font-semibold underline underline-offset-2 hover:text-amber-100">Re-upload your CV on the setup page</a> to fix this.</span>
              </>
            )}
          </div>
        )}

        <header className="mx-auto mb-6 flex max-w-6xl items-center justify-between">
          <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 transition hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20 text-blue-200">
              <FileText className="h-5 w-5" />
            </div>
            <div className="text-right">
              <p className="text-sm font-black">Improve CV</p>
              <p className="text-xs text-slate-400">WorkZo AI</p>
            </div>
          </div>
        </header>

        {/* ── Step 1: target this job ───────────────────────────────────── */}
        <section className="mx-auto max-w-6xl rounded-lg border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-blue-500/20 text-blue-200">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Rewrite your CV for this job</h1>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Paste the job description, pick a language, and WorkZo rewrites your CV to match — same jobs and dates, sharper wording.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">Job description</span>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                className="min-h-[140px] w-full rounded-lg border border-white/10 bg-black/25 px-4 py-3 text-sm leading-6 outline-none transition focus:border-blue-400"
                placeholder="Paste the job description here — this is what the rewrite targets."
              />
            </label>

            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">Target role</span>
                  <input
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/25 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                    placeholder="e.g. Data Analyst"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">Output language</span>
                  <select
                    value={outputLanguage}
                    onChange={(e) => setOutputLanguage(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/25 px-4 py-3 text-sm font-bold outline-none transition focus:border-blue-400"
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
                className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-left text-sm font-bold text-slate-300 transition hover:bg-black/30"
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
                  onChange={(e) => {
                    setCvText(e.target.value);
                    setSavedResumeProfile(undefined);
                  }}
                  className="min-h-[140px] w-full rounded-lg border border-white/10 bg-black/25 px-4 py-3 text-sm leading-6 outline-none transition focus:border-blue-400"
                  placeholder="Upload a CV during onboarding or paste CV text here."
                />
              )}

              <button
                type="button"
                onClick={() => void handleAiRewrite()}
                disabled={aiRewriteLoading || !jdReady || !cvReady}
                title={!jdReady ? "Paste a job description first" : !cvReady ? "Add your CV text first" : undefined}
                className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-400 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {aiRewriteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {aiRewriteLoading ? "Rewriting your CV…" : aiRewriteApplied ? "Rewrite again" : "Rewrite for this job"}
              </button>
              {!jdReady && <p className="text-xs text-slate-500">Paste a job description above to enable the rewrite.</p>}
            </div>
          </div>

          {aiRewriteError && (
            <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-400/10 px-4 py-2.5 text-sm font-bold text-amber-200">{aiRewriteError}</p>
          )}
          {aiRewriteApplied && !aiRewriteError && (
            <p className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-2.5 text-sm font-bold text-emerald-200">
              Rewritten for this job description in {outputLanguage}. Same jobs, dates, and companies — only wording changed. Review before downloading.
            </p>
          )}
        </section>

        {/* ── Step 2: your result ───────────────────────────────────────── */}
        <section className="mx-auto mt-6 max-w-6xl rounded-lg border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-lg border border-white/10 bg-black/20 p-1">
              <button
                type="button"
                onClick={() => setViewMode("text")}
                className={cn("rounded-xl px-4 py-2 text-sm font-black transition", viewMode === "text" ? "bg-blue-500 text-white" : "text-slate-400 hover:text-white")}
              >
                Editable text
              </button>
              <button
                type="button"
                onClick={() => setViewMode("preview")}
                className={cn("rounded-xl px-4 py-2 text-sm font-black transition", viewMode === "preview" ? "bg-blue-500 text-white" : "text-slate-400 hover:text-white")}
              >
                Template preview
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {aiRewriteApplied && (
                <button type="button" onClick={handleRevertRewrite} className="rounded-full border border-white/10 px-3.5 py-2 text-xs font-black text-slate-300 transition hover:bg-white/10">
                  Revert to original
                </button>
              )}
              <button type="button" onClick={handleCopy} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-black text-slate-100 transition hover:bg-white/10">
                <Copy className="h-3.5 w-3.5" /> {copyConfirmed ? "Copied!" : "Copy"}
              </button>
              <button type="button" onClick={() => handleDownloadHtml()} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-black text-slate-100 transition hover:bg-white/10">
                <Download className="h-3.5 w-3.5" /> HTML
              </button>
              <button type="button" onClick={() => handlePrintPdf()} className="inline-flex items-center gap-2 rounded-full bg-blue-500 px-3.5 py-2 text-xs font-black text-white transition hover:bg-blue-400">
                <Printer className="h-3.5 w-3.5" /> PDF
              </button>
            </div>
          </div>

          {viewMode === "text" ? (
            <textarea
              value={atsText}
              onChange={(event) => setAtsText(event.target.value)}
              className="mt-4 min-h-[480px] w-full resize-y overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/25 p-5 font-sans text-sm leading-7 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:bg-black/35"
              placeholder="Upload or paste a CV to generate an improved version. You can edit this text before copying or downloading."
              spellCheck={true}
            />
          ) : (
            <div className="mt-4">
              <div className="mb-3 flex flex-wrap gap-2">
                {templates.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTemplate(item.id)}
                    className={cn(
                      "rounded-xl border px-3.5 py-2 text-xs font-black transition",
                      template === item.id ? "border-blue-300/70 bg-blue-500/15 text-white" : "border-white/10 bg-black/20 text-slate-300 hover:border-blue-300/40",
                    )}
                    title={item.description}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="max-h-[75vh] overflow-auto rounded-xl border border-white/10 bg-white">
                <iframe title="CV template preview" srcDoc={htmlPreview} className="h-[1120px] w-full bg-white" />
              </div>
            </div>
          )}

          <p className="mt-3 text-xs leading-5 text-slate-500">
            {viewMode === "text"
              ? "Editable text version. Changes here are used when you copy the CV text."
              : "Template preview and PDF are generated from the structured CV data."}
          </p>
        </section>

        {/* ── Step 3: why this works (collapsed insights) ────────────────── */}
        <section className="mx-auto mt-6 max-w-6xl space-y-4">
          <CollapsibleSection eyebrow="Recruiter scan" title={phaseA.recruiterScan.decision} defaultOpen={false}>
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm leading-6 text-slate-300">{phaseA.recruiterScan.firstImpression}</p>
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg border border-cyan-300/20 bg-black/25 text-center">
                <p className="text-xl font-black text-cyan-100">{phaseA.readinessScore}</p>
                <p className="-mt-1 text-[9px] font-black text-slate-500">READY</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-emerald-300/15 bg-emerald-400/[0.06] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-black text-emerald-200"><CheckCircle2 className="h-4 w-4" /> What works</div>
                <div className="space-y-2">
                  {phaseA.recruiterScan.strengths.map((item) => <p key={item} className="text-sm leading-6 text-slate-300">• {item}</p>)}
                </div>
              </div>
              <div className="rounded-lg border border-amber-300/15 bg-amber-400/[0.06] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-black text-amber-200"><AlertTriangle className="h-4 w-4" /> Recruiter concerns</div>
                <div className="space-y-2">
                  {phaseA.recruiterScan.concerns.map((item) => <p key={item} className="text-sm leading-6 text-slate-300">• {item}</p>)}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400"><Gauge className="h-4 w-4" /> Current</div>
                <p className="mt-2 text-2xl font-black">{phaseA.interviewProbability.current}%</p>
                <p className="mt-1 text-xs text-slate-500">Interview probability estimate</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400"><Target className="h-4 w-4" /> After CV fix</div>
                <p className="mt-2 text-2xl font-black text-blue-100">{phaseA.interviewProbability.afterCvFix}%</p>
                <p className="mt-1 text-xs text-slate-500">If missing proof is added</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400"><Sparkles className="h-4 w-4" /> After prep</div>
                <p className="mt-2 text-2xl font-black text-emerald-200">{phaseA.interviewProbability.afterInterviewPrep}%</p>
                <p className="mt-1 text-xs text-slate-500">With interview stories ready</p>
              </div>
            </div>
          </CollapsibleSection>

          {jobDescription.trim() && cvText.trim() && (
            <CollapsibleSection eyebrow="ATS optimization" title={`Keyword match — ${atsScore}%`} defaultOpen={false}>
              <p className="text-sm leading-6 text-slate-300">
                {atsScore >= 75
                  ? "Strong keyword coverage. Your CV includes most JD requirements."
                  : atsScore >= 50
                    ? "Moderate coverage. Adding the missing keywords could significantly improve ATS pass rate."
                    : "Low keyword coverage. Many JD requirements are not reflected in your CV."}
              </p>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", atsScore >= 75 ? "bg-emerald-400" : atsScore >= 50 ? "bg-amber-400" : "bg-red-400")}
                  style={{ width: `${atsScore}%` }}
                />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-emerald-300/15 bg-emerald-400/[0.06] p-4">
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-emerald-200">Matched ({atsKeywords.matched.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {atsKeywords.matched.map((kw) => <span key={kw} className="rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-black text-emerald-200">{kw}</span>)}
                    {atsKeywords.matched.length === 0 && <p className="text-xs text-slate-500">None yet</p>}
                  </div>
                </div>
                <div className="rounded-lg border border-amber-300/15 bg-amber-400/[0.06] p-4">
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-amber-200">Partial ({atsKeywords.partial.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {atsKeywords.partial.map((kw) => <span key={kw} className="rounded-lg border border-amber-300/20 bg-amber-400/10 px-2 py-0.5 text-[11px] font-black text-amber-200">{kw}</span>)}
                    {atsKeywords.partial.length === 0 && <p className="text-xs text-slate-500">None</p>}
                  </div>
                </div>
                <div className="rounded-lg border border-red-300/15 bg-red-400/[0.06] p-4">
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-red-200">Missing ({atsKeywords.missing.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {atsKeywords.missing.map((kw) => <span key={kw} className="rounded-lg border border-red-300/20 bg-red-400/10 px-2 py-0.5 text-[11px] font-black text-red-200">{kw}</span>)}
                    {atsKeywords.missing.length === 0 && <p className="text-xs text-slate-500">None missing</p>}
                  </div>
                </div>
              </div>

              {atsKeywords.missing.length > 0 && (
                <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs font-black text-white">Quick fix</p>
                  <p className="mt-1 text-sm leading-6 text-slate-300">
                    Add these terms naturally to your CV where you genuinely have experience: <span className="font-bold text-amber-200">{atsKeywords.missing.slice(0, 5).join(", ")}</span>. Only add terms that reflect real experience — never keyword-stuff.
                  </p>
                </div>
              )}
            </CollapsibleSection>
          )}

          <CollapsibleSection eyebrow="Deeper analysis" title={phaseB.companyDNA.label} defaultOpen={false}>
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm leading-6 text-slate-300">{phaseB.companyDNA.description}</p>
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg border border-blue-300/20 bg-black/25 text-center">
                <p className="text-xl font-black text-blue-100">{phaseB.trustAudit.overall}</p>
                <p className="-mt-1 text-[9px] font-black text-slate-500">TRUST</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-black/20 p-4">
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

              <div className="rounded-lg border border-white/10 bg-black/20 p-4">
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

            <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4">
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

            <div className="mt-4 rounded-lg border border-emerald-300/15 bg-emerald-400/[0.06] p-4">
              <p className="text-sm font-black text-emerald-200">Top 10% rewrite target</p>
              <p className="mt-3 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Current weak line</p>
              <p className="mt-1 text-sm leading-6 text-slate-300">{phaseB.top10Rewrite.weakestLine}</p>
              <p className="mt-3 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Elite version</p>
              <p className="mt-1 text-sm leading-6 text-emerald-50">{phaseB.top10Rewrite.eliteLine}</p>
            </div>
          </CollapsibleSection>
        </section>
      </main>
    </PremiumFeatureGate>
  );
}
