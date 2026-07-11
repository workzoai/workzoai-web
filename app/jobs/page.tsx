"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PremiumFeatureGate from "@/components/PremiumFeatureGate";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  FileUp,
  Globe2,
  Loader2,
  MapPin,
  Mic,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
  X,
} from "lucide-react";
import { Suspense, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  normalizeSetupCvText,
  normalizeSetupJobDescription,
  normalizeSetupTargetMarket,
  normalizeSetupTargetRole,
  readLatestInterviewSetup,
  saveLatestInterviewSetup,
  type WorkZoInterviewSetup,
} from "@/lib/workzoInterviewSetup";
import { buildPhaseAInsights } from "@/lib/workzoCareerSuitePhaseA";
import { buildPhaseBInsights } from "@/lib/workzoCareerSuitePhaseB";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { persistCvSource, resolveCvSource } from "@/lib/workzoCvSource";
import { extractSkills as extractJobSkills } from "@/lib/jobs/normalize";
import type { JobMatchResult } from "@/lib/jobs/types";
import type { ResumeProfile } from "@/lib/workzoResumeParser";

type LiveJob = {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  applyUrl: string;
  postedAt: string | null;
  employmentType: string | null;
  source: string;
  logoUrl: string | null;
  matchReason: string;
  match?: JobMatchResult;
  remoteType?: "remote" | "hybrid" | "onsite" | "unknown";
  skills?: string[];
  stale?: boolean;
};

type RecentSearch = {
  id: string;
  role: string;
  location: string;
  keywords: string;
  createdAt: string;
};

const RECENT_SEARCHES_KEY = "workzo_recent_job_searches";

function safeEncode(value: string) {
  return encodeURIComponent(value.trim());
}

function cleanText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.replace(/\s+/g, " ").trim() || fallback;
}

function cleanLocation(value: string) {
  const cleaned = cleanText(value);
  if (!cleaned || /^global$/i.test(cleaned)) return "Remote";
  return cleaned;
}

function buildSearchQuery(role: string, location: string, keywords: string) {
  return [role, keywords, cleanLocation(location)]
    .map((item) => item.trim())
    .filter(Boolean)
    .join(" ");
}

function buildRoleVariants(role: string) {
  const value = cleanText(role, "Data Analyst");
  const lower = value.toLowerCase();
  const variants = [value];
  if (lower.includes("data analyst")) variants.push("Business Intelligence Analyst", "Reporting Analyst", "BI Analyst", "Analytics Specialist");
  else if (lower.includes("technical support") || lower.includes("it support")) variants.push("Service Desk Analyst", "Helpdesk Specialist", "Application Support Engineer", "Desktop Support Engineer");
  else if (lower.includes("customer success")) variants.push("Customer Success Specialist", "Client Success Manager", "Implementation Specialist", "Onboarding Specialist");
  else if (lower.includes("software engineer") || lower.includes("developer")) variants.push("Software Developer", "Application Developer", "Full Stack Developer");
  return [...new Set(variants)].slice(0, 5);
}

function buildCvRoleSuggestions(profile: ResumeProfile | null, preferredRole = "") {
  const seeds = [
    cleanText(preferredRole),
    cleanText(profile?.basics?.headline),
    ...(profile?.experience || []).map((item) => cleanText(item.title)),
  ].filter(Boolean);
  return [...new Set(seeds.flatMap((role) => buildRoleVariants(role)))].slice(0, 12);
}

function estimateYearsExperience(profile: ResumeProfile | null): number | undefined {
  if (!profile?.experience?.length) return undefined;
  const currentYear = new Date().getFullYear();
  let earliest = currentYear;
  let latest = 0;
  for (const item of profile.experience) {
    const years = String(item.dates || "").match(/(?:19|20)\d{2}/g)?.map(Number) || [];
    if (years.length) {
      earliest = Math.min(earliest, ...years);
      latest = Math.max(latest, ...years);
    }
    if (/present|current|heute/i.test(String(item.dates || ""))) latest = currentYear;
  }
  if (!latest || earliest === currentYear) return Math.max(1, profile.experience.length);
  return Math.max(0, Math.min(40, latest - earliest));
}

function buildJobLinks(role: string, location: string, keywords: string) {
  const cleanRole = cleanText(role, "Data Analyst");
  const cleanMarket = cleanLocation(location);
  const cleanKeywords = cleanText(keywords);
  const query = buildSearchQuery(cleanRole, cleanMarket, cleanKeywords);
  const roleAndKeywords = [cleanRole, cleanKeywords].filter(Boolean).join(" ");
  const linkedInQuery = safeEncode(roleAndKeywords);
  const locationQuery = safeEncode(cleanMarket);
  const googleQuery = safeEncode(`${query} jobs`);
  const germany = /germany|deutschland|berlin|munich|münchen|würzburg|wuerzburg|frankfurt|nuremberg|nürnberg|hamburg|cologne|köln|stuttgart|düsseldorf|duesseldorf/i.test(cleanMarket);

  return [
    {
      label: "LinkedIn Jobs",
      description: "Best for networking, recruiter visibility, and corporate/startup roles.",
      href: `https://www.linkedin.com/jobs/search/?keywords=${linkedInQuery}&location=${locationQuery}`,
    },
    {
      label: "Indeed",
      description: "Broad job coverage across countries and experience levels.",
      href: `${germany ? "https://de.indeed.com/jobs" : "https://www.indeed.com/jobs"}?q=${safeEncode(roleAndKeywords)}&l=${locationQuery}`,
    },
    {
      label: "Google Jobs",
      description: "Aggregated job results from multiple public sources.",
      href: `https://www.google.com/search?q=${googleQuery}`,
    },
    {
      label: "StepStone",
      description: "Useful for Germany and EU job searches.",
      href: `https://www.stepstone.de/jobs/${safeEncode(cleanRole)}?where=${locationQuery}`,
    },
    {
      label: "XING Jobs",
      description: "Useful for German-speaking market and DACH roles.",
      href: `https://www.xing.com/jobs/search?keywords=${linkedInQuery}&location=${locationQuery}`,
    },
    {
      label: "Wellfound",
      description: "Startup jobs, remote-first teams, and early-stage companies.",
      href: `https://wellfound.com/jobs?query=${safeEncode(roleAndKeywords)}`,
    },
  ];
}

function readRecentSearches() {
  if (typeof window === "undefined") return [] as RecentSearch[];

  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];

    const seen = new Set<string>();
    return parsed.filter((item) => {
      const role = cleanText(item?.role);
      const location = cleanLocation(cleanText(item?.location));
      const keywords = cleanText(item?.keywords);
      const key = `${role}|${location}|${keywords}`.toLowerCase();
      if (!role || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch {
    return [];
  }
}

function saveRecentSearch(search: Omit<RecentSearch, "id" | "createdAt">) {
  if (typeof window === "undefined") return [] as RecentSearch[];

  try {
    const current = readRecentSearches();
    const role = cleanText(search.role, "Data Analyst");
    const location = cleanLocation(search.location);
    const keywords = cleanText(search.keywords);
    const next: RecentSearch = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: new Date().toISOString(),
      role,
      location,
      keywords,
    };

    const nextKey = `${role}|${location}|${keywords}`.toLowerCase();
    const deduped = current.filter((item) => {
      const key = `${cleanText(item.role)}|${cleanLocation(item.location)}|${cleanText(item.keywords)}`.toLowerCase();
      return key !== nextKey;
    });
    const list = [next, ...deduped].slice(0, 5);
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list));
    return list;
  } catch {
    return [] as RecentSearch[];
  }
}

function extractKeywords(cvText: string) {
  // Search keywords must come from the candidate's CV, never from a JD that
  // may have been pasted during onboarding for an unrelated application.
  const extracted = extractJobSkills(cvText, 10)
    .map((item) => cleanText(item))
    .filter(Boolean);
  return [...new Set(extracted)].slice(0, 8).join(", ");
}

function toPlainAnalysis(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/^\s*#{1,6}\s*/gm, "")
    .replace(/^\s*>+\s?/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/^\s*\|?\s*[-:]+(?:\s*\|\s*[-:]+)+\s*\|?\s*$/gm, "")
    .replace(/^\s*\|\s*/gm, "")
    .replace(/\s*\|\s*$/gm, "")
    .replace(/\s*\|\s*/g, ": ")
    .replace(/^\s*[-–—*_]{3,}\s*$/gm, "")
    .replace(/[✅❌⭐👉✓✗☐]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function summarizeDescription(value: string) {
  const clean = cleanText(value, "No description available.");
  if (clean.length <= 180) return clean;
  return `${clean.slice(0, 180).trim()}…`;
}

function formatPostedDate(value: string | null) {
  if (!value) return "Recently posted";
  try {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "Recently posted";
  }
}

function normalizeJobKey(job: LiveJob) {
  return `${job.title}|${job.company}|${job.location}`.toLowerCase().replace(/\s+/g, " ").trim();
}

function dedupeJobs(jobs: LiveJob[]) {
  const seen = new Set<string>();
  return jobs.filter((job) => {
    const key = normalizeJobKey(job);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function saveSelectedJobForNextStep(job: LiveJob, currentSetup: WorkZoInterviewSetup | null) {
  const nextSetup = saveLatestInterviewSetup({
    ...(currentSetup || {}),
    selectedJob: job,
    targetRole: job.title || currentSetup?.targetRole || "Target Role",
    role: job.title || currentSetup?.role || currentSetup?.targetRole || "Target Role",
    targetCompany: job.company || currentSetup?.targetCompany || "",
    companyName: job.company || currentSetup?.companyName || "",
    jobDescription: job.description || currentSetup?.jobDescription || "",
    jdText: job.description || currentSetup?.jdText || "",
    targetMarket: cleanLocation(job.location || currentSetup?.targetMarket || "Remote"),
    country: cleanLocation(job.location || currentSetup?.country || "Remote"),
    source: "jobs-page-selected-job",
    setupVersion: 8,
  });

  return nextSetup;
}

function JobActionLink({ href, children, onClick }: { href: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-xl border border-line bg-fg/[0.045] px-3 py-2 text-xs font-black text-fg hover:bg-fg/[0.08]"
    >
      {children}
    </Link>
  );
}

function JobsWorkspaceContent() {
  const searchParams = useSearchParams();
  const openedFromLanding = searchParams.get("from") === "landing";
  const backHref = openedFromLanding ? "/" : "/dashboard";
  const backLabel = openedFromLanding ? "Back to home" : "Back to dashboard";
  const cvFileRef = useRef<HTMLInputElement | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [cvFileName, setCvFileName] = useState("");
  const [cvProfile, setCvProfile] = useState<ResumeProfile | null>(null);
  const [uploadingCv, setUploadingCv] = useState(false);
  const [setup, setSetup] = useState<WorkZoInterviewSetup | null>(null);
  const [cvText, setCvText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [roleOptions, setRoleOptions] = useState<string[]>([]);
  const [targetMarket, setTargetMarket] = useState("Germany");
  const [keywords, setKeywords] = useState("");
  const [jobs, setJobs] = useState<LiveJob[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzingJobId, setAnalyzingJobId] = useState<string | null>(null);
  const [jobAnalysis, setJobAnalysis] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;

    async function hydrate() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getUser();
        if (!active) return;
        if (!data.user) {
          setSignedIn(false);
          return;
        }

        setSignedIn(true);
        const latestSetup = readLatestInterviewSetup();
        const source = resolveCvSource();
        const cv = source.rawCvText || normalizeSetupCvText(latestSetup);
        // Job Assist must start from the saved CV, not from an old onboarding JD.
        // The user can enter a role and optional keywords for this search.
        const role =
          cleanText(source.targetRole) ||
          cleanText(normalizeSetupTargetRole(latestSetup)) ||
          cleanText(source.profile?.basics?.headline);
        const market = cleanLocation(source.targetMarket || normalizeSetupTargetMarket(latestSetup) || "Germany");

        setSetup(latestSetup);
        setCvText(cv);
        setCvProfile(source.profile);
        setCvFileName(source.fileName || source.profile?.basics?.name || "");
        setJobDescription("");
        setTargetRole(role);
        setRoleOptions(buildCvRoleSuggestions(source.profile, role));
        setTargetMarket(market);
        setKeywords("");
        setRecentSearches(readRecentSearches());
      } catch {
        if (active) setSignedIn(false);
      } finally {
        if (active) setAuthLoading(false);
      }
    }

    void hydrate();
    return () => {
      active = false;
    };
  }, []);

  const keywordList = useMemo(
    () => keywords.split(",").map((item) => item.trim()).filter(Boolean),
    [keywords],
  );

  const searchLinks = useMemo(
    () => buildJobLinks(targetRole, targetMarket, keywords),
    [targetRole, targetMarket, keywords],
  );
  const roleVariants = useMemo(
    () => roleOptions.length ? roleOptions : buildRoleVariants(targetRole),
    [roleOptions, targetRole],
  );

  const phaseA = useMemo(
    () => buildPhaseAInsights({ cvText, jobDescription, targetRole, targetMarket, companyName: setup?.companyName || setup?.targetCompany || "", companyStyle: setup?.companyStyle || "" }),
    [cvText, jobDescription, targetRole, targetMarket, setup],
  );

  const phaseB = useMemo(
    () => buildPhaseBInsights({ cvText, jobDescription, targetRole, targetMarket, companyName: setup?.companyName || setup?.targetCompany || "", companyStyle: setup?.companyStyle || "" }),
    [cvText, jobDescription, targetRole, targetMarket, setup],
  );

  async function handleCvUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingCv(true);
    setMessage("");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/cv", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const data = await response.json().catch(() => null);
      if (response.status === 401) {
        setSignedIn(false);
        throw new Error("Please sign in before uploading your CV.");
      }
      if (!response.ok) throw new Error(data?.error || "Could not read that CV.");

      const rawCvText = String(
        data?.text || data?.cvText || data?.content || data?.resumeText || data?.extractedText || "",
      ).trim();
      const profile = (data?.resumeProfile || data?.profile || null) as ResumeProfile | null;
      if (!rawCvText && !profile) throw new Error("No readable CV content was found.");

      const next = persistCvSource({
        rawCvText,
        profile,
        fileName: file.name,
        targetRole: targetRole || profile?.basics?.headline || "",
        jobDescription,
        targetMarket,
        origin: "jobs-page-upload",
        source: "jobs-page-upload",
        needsReupload: false,
      });

      setCvText(next.rawCvText);
      setCvProfile(next.profile);
      setCvFileName(file.name);
      setRoleOptions(buildCvRoleSuggestions(next.profile, targetRole || next.targetRole));
      if (!targetRole.trim() && next.targetRole) setTargetRole(next.targetRole);
      setKeywords("");
      setMessage("CV updated. Job Assist will use this CV only. Add search keywords manually when needed.");
    } catch (uploadError) {
      setMessage(uploadError instanceof Error ? uploadError.message : "Could not read that CV.");
    } finally {
      setUploadingCv(false);
      if (cvFileRef.current) cvFileRef.current.value = "";
    }
  }

  async function handleFindLiveJobs() {
    if (!cvText.trim() && !cvProfile) {
      setMessage("Upload your CV first. Job Assist uses your CV, not an onboarding job description.");
      return;
    }
    if (!targetRole.trim()) {
      setMessage("Enter the target role you want to search for.");
      return;
    }

    setLoading(true);
    setMessage("");
    setCopied(false);

    const recent = saveRecentSearch({ role: targetRole, location: targetMarket, keywords });
    setRecentSearches(recent);

    try {
      const isRemote = /remote/i.test(targetMarket);
      const response = await fetch("/api/jobs/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: targetRole,
          location: cleanLocation(targetMarket),
          remote: isRemote ? "remote" : undefined,
          keywords: keywordList,
          cvText,
          skills: Array.from(new Set([...(cvProfile?.skills || []), ...extractJobSkills(cvText, 24)])).slice(0, 30),
          yearsExperience: estimateYearsExperience(cvProfile),
          languages: cvProfile?.languages || [],
          education: (cvProfile?.education || []).map((item) =>
            [item.degree, item.institution].filter(Boolean).join(" | "),
          ),
        }),
      });

      const data = await response.json().catch(() => null);
      const rawJobs = Array.isArray(data?.jobs) ? data.jobs : [];
      // Map the WorkZoJob + match contract onto the card's shape.
      const mapped: LiveJob[] = rawJobs.map((j: Record<string, unknown>, i: number) => {
        const match = (j.match as JobMatchResult) || undefined;
        return {
          id: String(j.id || `job-${i}`),
          title: String(j.title || "Untitled role"),
          company: String(j.company || "Company not listed"),
          location: String(j.location || "Location not specified"),
          description: String(j.description || ""),
          applyUrl: String(j.applyUrl || ""),
          postedAt: (j.postedAt as string) || null,
          employmentType: (j.employmentType as string) || null,
          source: String(j.sourceReference || j.provider || "Live search"),
          logoUrl: (j.logoUrl as string) || null,
          matchReason: match?.reasons?.[0] || "Relevant role from live search.",
          match,
          remoteType: j.remoteType as LiveJob["remoteType"],
          skills: Array.isArray(j.skills) ? (j.skills as string[]) : [],
          stale: Boolean(j.stale),
        };
      });
      const nextJobs = dedupeJobs(mapped);
      setJobs(nextJobs);

      if (data?.live === false) {
        setMessage(data?.message || "Live jobs are not connected yet. Use the smart job-board links below.");
      } else if (data?.success === false) {
        setMessage(data?.error || "Live job search failed. Use the job-board links below.");
      } else if (!nextJobs.length) {
        setMessage("No live jobs found. Try a broader role, fewer keywords, or a specific city/country.");
      } else {
        const used = Array.isArray(data?.providersUsed) && data.providersUsed.length
        ? ` from ${data.providersUsed.map((name: string) => name === "adzuna" ? "Adzuna" : name === "jooble" ? "Jooble" : name).join(" + ")}`
        : "";
      setMessage(`Found ${nextJobs.length} live openings${used}. Search relevance is prioritized; CV match explains strengths and gaps.`);
      }
    } catch {
      setJobs([]);
      setMessage("Could not fetch live jobs. Use the job-board links below.");
    } finally {
      setLoading(false);
    }
  }

  function applyRecentSearch(search: RecentSearch) {
    setTargetRole(search.role);
    setTargetMarket(cleanLocation(search.location));
    setKeywords(search.keywords);
  }

  function clearRecentSearches() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(RECENT_SEARCHES_KEY);
    }
    setRecentSearches([]);
  }

  async function handleCopySearch() {
    const text = [
      `Role: ${targetRole}`,
      `Location: ${cleanLocation(targetMarket)}`,
      `Keywords: ${keywords || "None"}`,
      "",
      "Job search links:",
      ...searchLinks.map((item) => `${item.label}: ${item.href}`),
    ].join("\n");

    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function rememberJob(job: LiveJob) {
    const next = saveSelectedJobForNextStep(job, setup);
    setSetup(next);
  }

  const [jobQuestions, setJobQuestions] = useState<Record<string, string[]>>({});
  const [generatingQuestionsFor, setGeneratingQuestionsFor] = useState<string | null>(null);

  async function handleGenerateQuestions(job: LiveJob) {
    setGeneratingQuestionsFor(job.id);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 600,
          messages: [
            {
              role: "user",
              content: `Generate 7 likely interview questions for this role. Mix competency, situational, and technical questions relevant to the actual JD. Return ONLY a JSON array of strings, no other text.

JOB: ${job.title} at ${job.company}
JD EXCERPT: ${job.description.slice(0, 1200)}
CANDIDATE BACKGROUND: ${cvText.slice(0, 800)}`,
            },
          ],
        }),
      });
      const data = await res.json() as { content?: Array<{ type: string; text?: string }> };
      const raw = data.content?.map((b) => (b.type === "text" ? b.text ?? "" : "")).join("").trim() ?? "[]";
      const clean = raw.replace(/^```json|^```|```$/gm, "").trim();
      const questions = JSON.parse(clean) as string[];
      if (Array.isArray(questions)) {
        setJobQuestions((prev) => ({ ...prev, [job.id]: questions }));
        // Also save to setup so the interview room knows the target JD + role
        rememberJob(job);
      }
    } catch {
      setJobQuestions((prev) => ({ ...prev, [job.id]: ["Could not generate questions, try again."] }));
    } finally {
      setGeneratingQuestionsFor(null);
    }
  }

  async function handleAnalyzeJob(job: LiveJob) {
    if (!cvText.trim()) return;
    setAnalyzingJobId(job.id);
    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "job_fit",
          message: "Analyse the candidate against this selected live job. Use only verified CV facts and the selected job description. Return simple plain text without markdown, tables, bullets, symbols, emojis, or decorative separators.",
          cvText: cvText.slice(0, 9000),
          resumeProfile: cvProfile,
          jobDescription: job.description.slice(0, 7000),
          targetRole: job.title,
          targetMarket: job.location,
          question: `${job.title} at ${job.company}`,
        }),
      });
      const data = await res.json().catch(() => null);
      const text = data?.output || data?.message || data?.answer || data?.result || "";
      if (text) setJobAnalysis((prev) => ({ ...prev, [job.id]: toPlainAnalysis(text) }));
    } catch {
      setMessage("Could not analyse this job right now. Please try again.");
    } finally {
      setAnalyzingJobId(null);
    }
  }

  if (authLoading) {
    return (
      <main className="min-h-screen bg-canvas px-4 py-10 text-fg">
        <div className="mx-auto max-w-3xl rounded-2xl border border-line bg-surface/70 p-8">
          <div className="h-6 w-48 animate-pulse rounded bg-fg/10" />
          <div className="mt-5 h-32 animate-pulse rounded-2xl bg-fg/5" />
        </div>
      </main>
    );
  }

  if (!signedIn) {
    return (
      <main className="min-h-screen bg-canvas px-4 py-10 text-fg">
        <div className="mx-auto max-w-3xl rounded-2xl border border-line bg-surface/70 p-8 shadow-2xl shadow-black/10">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-brand/20 bg-brand/10 text-brand">
            <UserRound className="h-5 w-5" />
          </div>
          <h1 className="mt-5 text-3xl font-black tracking-tight">Sign in to find and prepare for jobs</h1>
          <p className="mt-3 text-sm leading-7 text-muted">
            WorkZo reuses your saved CV, target role, and application context so every job match is based on the same verified profile.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/login?next=/jobs" className="inline-flex items-center justify-center rounded-xl bg-brand px-5 py-3 text-sm font-black text-on-brand">
              Sign in
            </Link>
            <Link href="/signup" className="inline-flex items-center justify-center rounded-xl border border-line bg-fg/5 px-5 py-3 text-sm font-black text-fg">
              Create account
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <PremiumFeatureGate feature="job_assist" title="Job Assist is a Premium feature" description="Job fit scoring, gaps, and likely interview questions are included in Premium.">
      <main className="min-h-screen bg-canvas px-4 py-5 text-fg sm:px-5">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-fg/[0.035] px-4 py-3">
          <Link href={backHref} className="inline-flex items-center gap-2 text-sm font-black text-muted hover:text-fg">
            <ArrowLeft className="h-4 w-4" /> {backLabel}
          </Link>
          <div className="flex items-center gap-2 text-sm font-black text-muted">
            <Briefcase className="h-4 w-4" /> Find Jobs
          </div>
        </header>

        <section className="mt-6 rounded-lg border border-brand/15 bg-gradient-to-br from-brand/[0.14] via-canvas to-canvas p-5 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/[0.08] px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-muted">
                <Sparkles className="h-3.5 w-3.5" /> Job Search Hub
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-3xl">Find relevant jobs faster.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-muted sm:text-base">
                Search live roles, open trusted job boards, and send any job directly into CV, cover letter, or interview preparation.
              </p>
            </div>
            <button
              type="button"
              onClick={handleFindLiveJobs}
              disabled={loading}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-black text-on-brand hover:bg-brand disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {loading ? "Searching…" : "Find live jobs"}
            </button>
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[360px_1fr]">
          <aside className="space-y-5 lg:sticky lg:top-5 lg:self-start">
            <div className="rounded-lg border border-line bg-fg/[0.04] p-5">
              <input
                ref={cvFileRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp"
                onChange={handleCvUpload}
                className="hidden"
              />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-muted">CV memory</p>
                  <h2 className="mt-2 text-lg font-black">
                    {cvFileName ? cvFileName : cvText.trim() ? "Saved CV loaded" : "Add your CV"}
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    {cvText.trim()
                      ? `${cvProfile?.experience?.length || 0} roles and ${cvProfile?.skills?.length || 0} skills are available for matching.`
                      : "Upload once and WorkZo will reuse it across job search, CV, cover letter, and interview tools."}
                  </p>
                </div>
                {cvText.trim() ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" /> : null}
              </div>
              <button
                type="button"
                onClick={() => cvFileRef.current?.click()}
                disabled={uploadingCv}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-canvas-soft px-4 py-2.5 text-sm font-black text-fg hover:bg-fg/[0.06] disabled:opacity-60"
              >
                {uploadingCv ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                {uploadingCv ? "Reading CV…" : cvText.trim() ? "Replace CV" : "Upload CV"}
              </button>
            </div>

            <div className="rounded-lg border border-line bg-fg/[0.04] p-5">
              <h2 className="text-xl font-black">Search setup</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                WorkZo keeps your saved target role and uses your CV experience, skills, languages, and education to rank results. You can change the role for each search.
              </p>

              {roleOptions.length > 0 ? (
                <label className="mt-5 block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[.18em] text-muted">Relevant roles from your CV</span>
                  <select
                    value={roleOptions.includes(targetRole) ? targetRole : ""}
                    onChange={(event) => {
                      if (event.target.value) setTargetRole(event.target.value);
                    }}
                    className="w-full rounded-lg border border-line bg-canvas-soft px-4 py-3 text-sm outline-none focus:border-brand"
                  >
                    <option value="">Choose a suggested role</option>
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label className={roleOptions.length > 0 ? "mt-4 block" : "mt-5 block"}>
                <span className="mb-2 block text-xs font-black uppercase tracking-[.18em] text-muted">Target role</span>
                <input
                  value={targetRole}
                  onChange={(event) => setTargetRole(event.target.value)}
                  className="w-full rounded-lg border border-line bg-canvas-soft px-4 py-3 text-sm outline-none focus:border-brand"
                  placeholder="Data Analyst"
                />
              </label>

              <label className="mt-4 block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[.18em] text-muted">Location / market</span>
                <input
                  value={targetMarket}
                  onChange={(event) => setTargetMarket(event.target.value)}
                  className="w-full rounded-lg border border-line bg-canvas-soft px-4 py-3 text-sm outline-none focus:border-brand"
                  placeholder="Remote / Germany / United States / Chennai"
                />
              </label>

              <label className="mt-4 block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[.18em] text-muted">Keywords (optional, entered by you)</span>
                <textarea
                  value={keywords}
                  onChange={(event) => setKeywords(event.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-line bg-canvas-soft px-4 py-3 text-sm leading-6 outline-none focus:border-brand"
                  placeholder="Optional: SQL, Python, Power BI, SaaS"
                />
              </label>

              <div className="mt-5 grid gap-3">
                <button
                  type="button"
                  onClick={handleFindLiveJobs}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-black text-on-brand hover:bg-brand disabled:opacity-60"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {loading ? "Searching…" : "Find live jobs"}
                </button>

                <button
                  type="button"
                  onClick={handleCopySearch}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-fg/[0.05] px-5 py-3 text-sm font-black text-fg hover:bg-fg/[0.09]"
                >
                  {copied ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy search"}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-line bg-fg/[0.035] p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-black">Recent searches</h2>
                {recentSearches.length ? (
                  <button type="button" onClick={clearRecentSearches} className="text-xs font-black text-subtle hover:text-fg">
                    Clear
                  </button>
                ) : null}
              </div>

              <div className="mt-4 space-y-2">
                {recentSearches.slice(0, 4).map((search) => (
                  <button
                    key={search.id}
                    type="button"
                    onClick={() => applyRecentSearch(search)}
                    className="w-full rounded-lg border border-line bg-canvas-soft p-3 text-left hover:bg-fg/[0.05]"
                  >
                    <p className="font-black text-fg">{search.role}</p>
                    <p className="mt-1 text-xs text-muted">{cleanLocation(search.location)}</p>
                    {search.keywords ? <p className="mt-1 line-clamp-1 text-xs text-subtle">{search.keywords}</p> : null}
                  </button>
                ))}

                {!recentSearches.length ? (
                  <p className="rounded-lg border border-line bg-canvas-soft p-4 text-sm leading-6 text-muted">
                    Your recent job searches will appear here.
                  </p>
                ) : null}
              </div>
            </div>
          </aside>

          <section className="space-y-5">

            <div className="rounded-lg border border-brand/15 bg-brand/[0.045] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-muted">Prepare for this job</p>
                  <h2 className="mt-2 text-2xl font-black">{phaseA.hiringRecommendation}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{phaseA.recruiterScan.firstImpression}</p>
                </div>
                <div className="grid h-16 w-16 place-items-center rounded-lg border border-brand/20 bg-canvas-soft text-center">
                  <p className="text-2xl font-black text-muted">{phaseA.readinessScore}</p>
                  <p className="-mt-2 text-[10px] font-black text-subtle">READY</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-3">
                <div className="rounded-lg border border-line bg-canvas-soft p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-black text-brand"><Target className="h-4 w-4" /> Missing requirements</div>
                  <div className="space-y-2">
                    {phaseA.missingRequirements.filter((item) => item.status !== "matched").slice(0, 5).map((item) => (
                      <p key={item.label} className="text-sm leading-6 text-muted">• {item.label} <span className="text-subtle">({item.status})</span></p>
                    ))}
                    {!phaseA.missingRequirements.some((item) => item.status !== "matched") ? <p className="text-sm text-success">No major requirement gap detected.</p> : null}
                  </div>
                </div>

                <div className="rounded-lg border border-line bg-canvas-soft p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-black text-brand"><Mic className="h-4 w-4" /> Likely recruiter questions</div>
                  <div className="space-y-2">
                    {phaseA.recruiterQuestions.slice(0, 4).map((item) => <p key={item.question} className="text-sm leading-6 text-muted">• {item.question}</p>)}
                  </div>
                </div>

                <div className="rounded-lg border border-line bg-canvas-soft p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-black text-brand"><TrendingUp className="h-4 w-4" /> Interview probability</div>
                  <div className="space-y-3">
                    {[
                      ["Current", phaseA.interviewProbability.current],
                      ["After CV fix", phaseA.interviewProbability.afterCvFix],
                      ["After prep", phaseA.interviewProbability.afterInterviewPrep],
                    ].map(([label, value]) => (
                      <div key={String(label)}>
                        <div className="mb-1 flex justify-between text-xs font-black"><span className="text-muted">{label}</span><span>{value}%</span></div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-fg/10"><div className="h-full rounded-full bg-brand" style={{ width: `${value}%` }} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-warning/15 bg-warning/[0.06] p-4">
                <p className="text-sm font-black text-warning">Potential recruiter objections</p>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  {phaseA.objections.slice(0, 3).map((item) => (
                    <div key={item.title} className="rounded-xl bg-canvas-soft p-3">
                      <p className="text-sm font-black text-fg">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-muted">{item.fix}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>


            <div className="rounded-lg border border-brand/15 bg-brand/[0.045] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-muted">Phase 2 job intelligence</p>
                  <h2 className="mt-2 text-2xl font-black">{phaseB.consistency.status}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{phaseB.companyDNA.interviewStyle}</p>
                </div>
                <div className="grid h-16 w-16 place-items-center rounded-lg border border-brand/20 bg-canvas-soft text-center">
                  <p className="text-2xl font-black text-muted">{phaseB.trustAudit.overall}</p>
                  <p className="-mt-2 text-[10px] font-black text-subtle">TRUST</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-3">
                <div className="rounded-lg border border-line bg-canvas-soft p-4">
                  <p className="text-sm font-black text-muted">Company DNA</p>
                  <p className="mt-2 text-sm leading-6 text-muted">{phaseB.companyDNA.label}</p>
                  <div className="mt-3 space-y-2">
                    {phaseB.companyDNA.dimensions.slice(0, 4).map((item) => (
                      <div key={item.label}>
                        <div className="mb-1 flex justify-between text-xs font-black"><span className="text-muted">{item.label}</span><span>{item.score}%</span></div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-fg/10"><div className="h-full rounded-full bg-brand" style={{ width: `${item.score}%` }} /></div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-line bg-canvas-soft p-4">
                  <p className="text-sm font-black text-success">Cross-feature actions</p>
                  <div className="mt-3 space-y-2">
                    {phaseB.consistency.crossFeatureActions.map((item) => (
                      <p key={item} className="text-sm leading-6 text-muted">• {item}</p>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-line bg-canvas-soft p-4">
                  <p className="text-sm font-black text-warning">Trust recovery</p>
                  <div className="mt-3 space-y-2">
                    {phaseB.trustAudit.recoveryActions.map((item) => (
                      <p key={item} className="text-sm leading-6 text-muted">• {item}</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {message ? (
              <div className="rounded-lg border border-brand/15 bg-brand/[0.07] p-4 text-sm leading-6 text-brand">
                {message}
              </div>
            ) : null}

            <div className="rounded-lg border border-line bg-fg/[0.035] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">Live job suggestions</h2>
                  <p className="mt-1 text-sm text-muted">Compact results with match reasons and next-step actions.</p>
                </div>
                <div className="rounded-full border border-line bg-canvas-soft px-3 py-1.5 text-xs font-black text-muted">
                  {jobs.length ? `${jobs.length} roles` : "Live API optional"}
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {jobs.map((job) => (
                  <article key={job.id} className="rounded-xl border border-line bg-canvas-soft p-4 transition hover:border-brand/25 hover:bg-fg/[0.035]">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-subtle">
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <Building2 className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{job.company}</span>
                          </span>
                          <span>·</span>
                          <span className="truncate">{job.source}</span>
                        </div>

                        <h3 className="mt-2 text-xl font-black leading-tight sm:text-2xl">{job.title}</h3>

                        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
                          <MapPin className="h-4 w-4" /> {job.location}
                          {job.employmentType ? <span>· {job.employmentType}</span> : null}
                          <span>· {formatPostedDate(job.postedAt)}</span>
                        </p>
                      </div>

                      {job.applyUrl ? (
                        <a
                          href={job.applyUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 text-sm font-black text-on-brand hover:bg-brand"
                        >
                          Apply <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : null}
                    </div>

                    {job.match ? (
                      <div className="mt-3 rounded-lg border border-line bg-canvas px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg text-sm font-black ${
                              job.match.score >= 85 ? "bg-success/15 text-success"
                                : job.match.score >= 68 ? "bg-brand/15 text-brand"
                                : job.match.score >= 50 ? "bg-warning/15 text-warning"
                                : "bg-danger/15 text-danger"
                            }`}>{job.match.score}</span>
                            <div>
                              <p className="text-sm font-black capitalize">{job.match.recommendation.replace(/_/g, " ")}</p>
                              <p className="text-[11px] text-subtle">Matched against your CV</p>
                            </div>
                          </div>
                          {job.stale ? <span className="rounded-full bg-fg/10 px-2 py-0.5 text-[10px] font-black text-subtle">30+ days old</span> : null}
                        </div>
                        {job.match.matchedRequirements.length > 0 && (
                          <p className="mt-2.5 text-[11px] leading-5"><span className="font-black text-success">Strong: </span><span className="text-muted">{job.match.matchedRequirements.slice(0, 5).join(", ")}</span></p>
                        )}
                        {job.match.partiallyMatchedRequirements.length > 0 && (
                          <p className="mt-1 text-[11px] leading-5"><span className="font-black text-warning">Partial: </span><span className="text-muted">{job.match.partiallyMatchedRequirements.slice(0, 4).join(", ")}</span></p>
                        )}
                        {job.match.missingCriticalRequirements.length > 0 && (
                          <p className="mt-1 text-[11px] leading-5"><span className="font-black text-danger">Missing: </span><span className="text-muted">{job.match.missingCriticalRequirements.slice(0, 4).join(", ")}</span></p>
                        )}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-lg border border-success/15 bg-success/[0.06] px-3 py-2 text-sm leading-6 text-success">
                        {job.matchReason}
                      </div>
                    )}

                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted">{summarizeDescription(job.description)}</p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => { rememberJob(job); void handleAnalyzeJob(job); }}
                        disabled={analyzingJobId === job.id}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-brand/20 bg-brand/10 px-3 py-1.5 text-xs font-black text-brand transition hover:bg-brand/20 disabled:opacity-60"
                      >
                        {analyzingJobId === job.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        {analyzingJobId === job.id ? "Analysing…" : "AI fit check"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { rememberJob(job); void handleGenerateQuestions(job); }}
                        disabled={generatingQuestionsFor === job.id}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-brand/20 bg-brand/10 px-3 py-1.5 text-xs font-black text-brand transition hover:bg-brand/20 disabled:opacity-60"
                      >
                        {generatingQuestionsFor === job.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mic className="h-3 w-3" />}
                        {generatingQuestionsFor === job.id ? "Generating…" : "Likely questions"}
                      </button>
                      <JobActionLink href="/interview" onClick={() => rememberJob(job)}>
                        <Mic className="mr-1.5 h-3.5 w-3.5" /> Prepare interview
                      </JobActionLink>
                      <JobActionLink href="/cv" onClick={() => rememberJob(job)}>
                        <FileText className="mr-1.5 h-3.5 w-3.5" /> Improve CV
                      </JobActionLink>
                      <JobActionLink href="/cover-letter" onClick={() => rememberJob(job)}>
                        <Briefcase className="mr-1.5 h-3.5 w-3.5" /> Cover letter
                      </JobActionLink>
                    </div>
                    {jobAnalysis[job.id] ? (
                      <div className="mt-3 rounded-lg border border-brand/15 bg-brand/[0.07] p-4">
                        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-muted">AI fit analysis</p>
                        <pre className="whitespace-pre-wrap text-xs leading-5 text-muted">{jobAnalysis[job.id]}</pre>
                      </div>
                    ) : null}
                    {jobQuestions[job.id] ? (
                      <div className="mt-3 rounded-lg border border-brand/15 bg-brand/[0.07] p-4">
                        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-muted">Likely interview questions ({jobQuestions[job.id].length})</p>
                        <ol className="space-y-2">
                          {jobQuestions[job.id].map((q, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs leading-5 text-muted">
                              <span className="shrink-0 rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-black text-muted">{i + 1}</span>
                              {q}
                            </li>
                          ))}
                        </ol>
                        <a
                          href="/onboarding"
                          onClick={() => rememberJob(job)}
                          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-xs font-black text-on-brand hover:bg-brand"
                        >
                          <Mic className="h-3 w-3" /> Practice this interview now
                        </a>
                      </div>
                    ) : null}

                  </article>
                ))}

                {!jobs.length ? (
                  <div className="rounded-xl border border-line bg-canvas-soft p-6 text-center">
                    <Globe2 className="mx-auto h-10 w-10 text-brand" />
                    <h3 className="mt-4 text-xl font-black">Live jobs will appear here</h3>
                    <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted">
                      Click Find live jobs. Without an API key, WorkZo still gives users ready-to-open job-board searches below.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-lg border border-line bg-fg/[0.035] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">Search major job platforms</h2>
                  <p className="mt-1 text-sm text-muted">Open live results on LinkedIn, Indeed, XING, StepStone and other boards using the same search. WorkZo does not invent job counts or scrape protected listings.</p>
                </div>
                <Briefcase className="h-5 w-5 text-brand" />
              </div>

              <div className="mt-5 rounded-xl border border-line bg-canvas-soft p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-subtle">Related titles worth checking</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {roleVariants.map((variant) => (
                    <button
                      key={variant}
                      type="button"
                      onClick={() => setTargetRole(variant)}
                      className="rounded-full border border-line bg-canvas px-3 py-1.5 text-xs font-black text-muted hover:border-brand/30 hover:text-fg"
                    >
                      {variant}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {searchLinks.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-line bg-canvas-soft p-4 hover:border-brand/30 hover:bg-fg/[0.05]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-black">{item.label}</h3>
                      <ExternalLink className="h-4 w-4 text-subtle" />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted">{item.description}</p>
                    <p className="mt-3 text-xs font-black text-brand">Open live results →</p>
                  </a>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-line bg-fg/[0.03] p-5">
              <h2 className="text-xl font-black">Improve this search</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Link href="/cv" className="group rounded-lg border border-line bg-canvas-soft p-4 hover:bg-fg/[0.05]">
                  <p className="font-black">Improve CV first</p>
                  <p className="mt-2 text-sm leading-6 text-muted">Make your profile stronger before applying.</p>
                  <span className="mt-3 inline-flex items-center gap-2 text-xs font-black text-muted">Open CV <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" /></span>
                </Link>
                <Link href="/cover-letter" className="group rounded-lg border border-line bg-canvas-soft p-4 hover:bg-fg/[0.05]">
                  <p className="font-black">Create cover letter</p>
                  <p className="mt-2 text-sm leading-6 text-muted">Prepare a tailored letter for selected jobs.</p>
                  <span className="mt-3 inline-flex items-center gap-2 text-xs font-black text-muted">Create letter <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" /></span>
                </Link>
                <Link href="/interview" className="group rounded-lg border border-line bg-canvas-soft p-4 hover:bg-fg/[0.05]">
                  <p className="font-black">Practice interview</p>
                  <p className="mt-2 text-sm leading-6 text-muted">Use target jobs to prepare answers.</p>
                  <span className="mt-3 inline-flex items-center gap-2 text-xs font-black text-muted">Start practice <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" /></span>
                </Link>
              </div>
            </div>
          </section>
        </section>
      </div>
    </main>
    </PremiumFeatureGate>
  );
}

export default function JobsWorkspacePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <JobsWorkspaceContent />
    </Suspense>
  );
}
