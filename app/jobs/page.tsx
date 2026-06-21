"use client";

import Link from "next/link";
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
  Globe2,
  Loader2,
  MapPin,
  Mic,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

function buildJobLinks(role: string, location: string, keywords: string) {
  const cleanRole = cleanText(role, "Data Analyst");
  const cleanMarket = cleanLocation(location);
  const cleanKeywords = cleanText(keywords);
  const query = buildSearchQuery(cleanRole, cleanMarket, cleanKeywords);
  const roleAndKeywords = [cleanRole, cleanKeywords].filter(Boolean).join(" ");
  const linkedInQuery = safeEncode(roleAndKeywords);
  const locationQuery = safeEncode(cleanMarket);
  const googleQuery = safeEncode(`${query} jobs`);

  return [
    {
      label: "LinkedIn Jobs",
      description: "Best for networking, recruiter visibility, and corporate/startup roles.",
      href: `https://www.linkedin.com/jobs/search/?keywords=${linkedInQuery}&location=${locationQuery}`,
    },
    {
      label: "Indeed",
      description: "Broad job coverage across countries and experience levels.",
      href: `https://www.indeed.com/jobs?q=${safeEncode(roleAndKeywords)}&l=${locationQuery}`,
    },
    {
      label: "Google Jobs",
      description: "Aggregated job results from multiple public sources.",
      href: `https://www.google.com/search?q=${googleQuery}`,
    },
    {
      label: "StepStone",
      description: "Useful for Germany and EU job searches.",
      href: `https://www.stepstone.de/jobs/${safeEncode(cleanRole)}/in-${locationQuery}`,
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

function extractKeywords(cvText: string, jobDescription: string, role: string) {
  const text = `${role} ${jobDescription} ${cvText}`.toLowerCase();
  const candidates = [
    "sql",
    "python",
    "excel",
    "power bi",
    "tableau",
    "customer success",
    "technical support",
    "crm",
    "salesforce",
    "hubspot",
    "data analysis",
    "analytics",
    "reporting",
    "saas",
    "stakeholder",
    "b2b",
    "support engineer",
    "product analytics",
    "dashboard",
    "communication",
  ];

  return candidates.filter((item) => text.includes(item)).slice(0, 6).join(", ");
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
      className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2 text-xs font-black text-slate-200 hover:bg-white/[0.08]"
    >
      {children}
    </Link>
  );
}

export default function JobsWorkspacePage() {
  const [setup, setSetup] = useState<WorkZoInterviewSetup | null>(null);
  const [cvText, setCvText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [targetRole, setTargetRole] = useState("Data Analyst");
  const [targetMarket, setTargetMarket] = useState("Remote");
  const [keywords, setKeywords] = useState("");
  const [jobs, setJobs] = useState<LiveJob[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzingJobId, setAnalyzingJobId] = useState<string | null>(null);
  const [jobAnalysis, setJobAnalysis] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const latestSetup = readLatestInterviewSetup();
    const cv = normalizeSetupCvText(latestSetup);
    const jd = normalizeSetupJobDescription(latestSetup);
    const role = normalizeSetupTargetRole(latestSetup) || "Data Analyst";
    const market = cleanLocation(normalizeSetupTargetMarket(latestSetup) || "Remote");

    setSetup(latestSetup);
    setCvText(cv);
    setJobDescription(jd);
    setTargetRole(role);
    setTargetMarket(market);
    setKeywords(extractKeywords(cv, jd, role));
    setRecentSearches(readRecentSearches());
  }, []);

  const keywordList = useMemo(
    () => keywords.split(",").map((item) => item.trim()).filter(Boolean),
    [keywords],
  );

  const searchLinks = useMemo(
    () => buildJobLinks(targetRole, targetMarket, keywords),
    [targetRole, targetMarket, keywords],
  );

  const phaseA = useMemo(
    () => buildPhaseAInsights({ cvText, jobDescription, targetRole, targetMarket, companyName: setup?.companyName || setup?.targetCompany || "", companyStyle: setup?.companyStyle || "" }),
    [cvText, jobDescription, targetRole, targetMarket, setup],
  );

  const phaseB = useMemo(
    () => buildPhaseBInsights({ cvText, jobDescription, targetRole, targetMarket, companyName: setup?.companyName || setup?.targetCompany || "", companyStyle: setup?.companyStyle || "" }),
    [cvText, jobDescription, targetRole, targetMarket, setup],
  );

  async function handleFindLiveJobs() {
    setLoading(true);
    setMessage("");
    setCopied(false);

    const recent = saveRecentSearch({ role: targetRole, location: targetMarket, keywords });
    setRecentSearches(recent);

    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: targetRole,
          location: cleanLocation(targetMarket),
          keywords: keywordList,
        }),
      });

      const data = await response.json().catch(() => null);
      const nextJobs = dedupeJobs(Array.isArray(data?.jobs) ? data.jobs : []);
      setJobs(nextJobs);

      if (data?.live === false) {
        setMessage("Live jobs are not connected yet. Use the smart job-board links below.");
      } else if (data?.success === false) {
        setMessage(data?.error || "Live job search failed. Use the job-board links below.");
      } else if (!nextJobs.length) {
        setMessage("No live jobs found. Try a broader role, fewer keywords, or a specific city/country.");
      } else {
        setMessage(`Found ${nextJobs.length} live job suggestions.`);
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
      setJobQuestions((prev) => ({ ...prev, [job.id]: ["Could not generate questions — try again."] }));
    } finally {
      setGeneratingQuestionsFor(null);
    }
  }

  async function handleAnalyzeJob(job: LiveJob) {
    if (!cvText.trim()) return;
    setAnalyzingJobId(job.id);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: `Analyse the fit between this candidate CV and the job below. Be specific and honest — reference actual CV details.

CV:
${cvText.slice(0, 2500)}

JOB: ${job.title} at ${job.company}
${job.description.slice(0, 1500)}

Respond with exactly this format:
FIT SCORE: X/100

MATCH REASONS:
• [specific reason tied to CV + JD]
• [specific reason tied to CV + JD]
• [specific reason tied to CV + JD]

GAPS:
• [honest gap, not generic advice]
• [honest gap, not generic advice]

INTERVIEW TIP:
[One specific preparation tip based on the JD requirements]`,
            },
          ],
        }),
      });
      const data = await res.json() as { content?: Array<{ type: string; text?: string }> };
      const text = data.content?.map((b) => (b.type === "text" ? b.text ?? "" : "")).join("").trim();
      if (text) {
        setJobAnalysis((prev) => ({ ...prev, [job.id]: text }));
      }
    } catch {
      // silently fail — button can be retried
    } finally {
      setAnalyzingJobId(null);
    }
  }

  return (
    <PremiumFeatureGate feature="job_assist" title="Job Assist is a Premium feature" description="Job fit scoring, gaps, and likely interview questions are included in Premium.">
      <main className="min-h-screen bg-[#020817] px-4 py-5 text-white sm:px-5">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-black text-slate-300 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <div className="flex items-center gap-2 text-sm font-black text-slate-300">
            <Briefcase className="h-4 w-4" /> Find Jobs
          </div>
        </header>

        <section className="mt-6 rounded-lg border border-blue-300/15 bg-gradient-to-br from-blue-500/[0.14] via-[#091326] to-[#050b14] p-5 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/[0.08] px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-cyan-100">
                <Sparkles className="h-3.5 w-3.5" /> Job Search Hub
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-3xl">Find relevant jobs faster.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                Search live roles, open trusted job boards, and send any job directly into CV, cover letter, or interview preparation.
              </p>
            </div>
            <button
              type="button"
              onClick={handleFindLiveJobs}
              disabled={loading}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-blue-500 px-5 text-sm font-black text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {loading ? "Searching…" : "Find live jobs"}
            </button>
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[360px_1fr]">
          <aside className="space-y-5 lg:sticky lg:top-5 lg:self-start">
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
              <h2 className="text-xl font-black">Search setup</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                WorkZo pre-fills this from your latest CV/interview setup. Adjust it for each search.
              </p>

              <label className="mt-5 block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[.18em] text-slate-400">Target role</span>
                <input
                  value={targetRole}
                  onChange={(event) => setTargetRole(event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-blue-400"
                  placeholder="Data Analyst"
                />
              </label>

              <label className="mt-4 block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[.18em] text-slate-400">Location / market</span>
                <input
                  value={targetMarket}
                  onChange={(event) => setTargetMarket(event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-blue-400"
                  placeholder="Remote / Germany / United States / Chennai"
                />
              </label>

              <label className="mt-4 block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[.18em] text-slate-400">Keywords</span>
                <textarea
                  value={keywords}
                  onChange={(event) => setKeywords(event.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 outline-none focus:border-blue-400"
                  placeholder="SQL, Python, Power BI, SaaS"
                />
              </label>

              <div className="mt-5 grid gap-3">
                <button
                  type="button"
                  onClick={handleFindLiveJobs}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-500 px-5 py-3 text-sm font-black text-white hover:bg-blue-400 disabled:opacity-60"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {loading ? "Searching…" : "Find live jobs"}
                </button>

                <button
                  type="button"
                  onClick={handleCopySearch}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-black text-slate-200 hover:bg-white/[0.09]"
                >
                  {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy search"}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-black">Recent searches</h2>
                {recentSearches.length ? (
                  <button type="button" onClick={clearRecentSearches} className="text-xs font-black text-slate-500 hover:text-white">
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
                    className="w-full rounded-lg border border-white/10 bg-black/20 p-3 text-left hover:bg-white/[0.05]"
                  >
                    <p className="font-black text-slate-100">{search.role}</p>
                    <p className="mt-1 text-xs text-slate-400">{cleanLocation(search.location)}</p>
                    {search.keywords ? <p className="mt-1 line-clamp-1 text-xs text-slate-500">{search.keywords}</p> : null}
                  </button>
                ))}

                {!recentSearches.length ? (
                  <p className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-400">
                    Your recent job searches will appear here.
                  </p>
                ) : null}
              </div>
            </div>
          </aside>

          <section className="space-y-5">

            <div className="rounded-lg border border-cyan-300/15 bg-cyan-400/[0.045] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Prepare for this job</p>
                  <h2 className="mt-2 text-2xl font-black">{phaseA.hiringRecommendation}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{phaseA.recruiterScan.firstImpression}</p>
                </div>
                <div className="grid h-16 w-16 place-items-center rounded-lg border border-cyan-300/20 bg-black/25 text-center">
                  <p className="text-2xl font-black text-cyan-100">{phaseA.readinessScore}</p>
                  <p className="-mt-2 text-[10px] font-black text-slate-500">READY</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-3">
                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-black text-blue-100"><Target className="h-4 w-4" /> Missing requirements</div>
                  <div className="space-y-2">
                    {phaseA.missingRequirements.filter((item) => item.status !== "matched").slice(0, 5).map((item) => (
                      <p key={item.label} className="text-sm leading-6 text-slate-300">• {item.label} <span className="text-slate-500">({item.status})</span></p>
                    ))}
                    {!phaseA.missingRequirements.some((item) => item.status !== "matched") ? <p className="text-sm text-emerald-200">No major requirement gap detected.</p> : null}
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-black text-blue-100"><Mic className="h-4 w-4" /> Likely recruiter questions</div>
                  <div className="space-y-2">
                    {phaseA.recruiterQuestions.slice(0, 4).map((item) => <p key={item.question} className="text-sm leading-6 text-slate-300">• {item.question}</p>)}
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-black text-blue-100"><TrendingUp className="h-4 w-4" /> Interview probability</div>
                  <div className="space-y-3">
                    {[
                      ["Current", phaseA.interviewProbability.current],
                      ["After CV fix", phaseA.interviewProbability.afterCvFix],
                      ["After prep", phaseA.interviewProbability.afterInterviewPrep],
                    ].map(([label, value]) => (
                      <div key={String(label)}>
                        <div className="mb-1 flex justify-between text-xs font-black"><span className="text-slate-400">{label}</span><span>{value}%</span></div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-300" style={{ width: `${value}%` }} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-amber-300/15 bg-amber-400/[0.06] p-4">
                <p className="text-sm font-black text-amber-100">Potential recruiter objections</p>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  {phaseA.objections.slice(0, 3).map((item) => (
                    <div key={item.title} className="rounded-xl bg-black/20 p-3">
                      <p className="text-sm font-black text-white">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{item.fix}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>


            <div className="rounded-lg border border-blue-300/15 bg-blue-500/[0.045] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-200">Phase 2 job intelligence</p>
                  <h2 className="mt-2 text-2xl font-black">{phaseB.consistency.status}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{phaseB.companyDNA.interviewStyle}</p>
                </div>
                <div className="grid h-16 w-16 place-items-center rounded-lg border border-blue-300/20 bg-black/25 text-center">
                  <p className="text-2xl font-black text-blue-100">{phaseB.trustAudit.overall}</p>
                  <p className="-mt-2 text-[10px] font-black text-slate-500">TRUST</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-3">
                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-black text-blue-100">Company DNA</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{phaseB.companyDNA.label}</p>
                  <div className="mt-3 space-y-2">
                    {phaseB.companyDNA.dimensions.slice(0, 4).map((item) => (
                      <div key={item.label}>
                        <div className="mb-1 flex justify-between text-xs font-black"><span className="text-slate-400">{item.label}</span><span>{item.score}%</span></div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-blue-400" style={{ width: `${item.score}%` }} /></div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-black text-emerald-200">Cross-feature actions</p>
                  <div className="mt-3 space-y-2">
                    {phaseB.consistency.crossFeatureActions.map((item) => (
                      <p key={item} className="text-sm leading-6 text-slate-300">• {item}</p>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-black text-amber-200">Trust recovery</p>
                  <div className="mt-3 space-y-2">
                    {phaseB.trustAudit.recoveryActions.map((item) => (
                      <p key={item} className="text-sm leading-6 text-slate-300">• {item}</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {message ? (
              <div className="rounded-lg border border-blue-300/15 bg-blue-400/[0.07] p-4 text-sm leading-6 text-blue-100">
                {message}
              </div>
            ) : null}

            <div className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">Live job suggestions</h2>
                  <p className="mt-1 text-sm text-slate-400">Compact results with match reasons and next-step actions.</p>
                </div>
                <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-black text-slate-300">
                  {jobs.length ? `${jobs.length} roles` : "Live API optional"}
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {jobs.map((job) => (
                  <article key={job.id} className="rounded-xl border border-white/10 bg-black/20 p-4 transition hover:border-blue-300/25 hover:bg-white/[0.035]">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <Building2 className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{job.company}</span>
                          </span>
                          <span>·</span>
                          <span className="truncate">{job.source}</span>
                        </div>

                        <h3 className="mt-2 text-xl font-black leading-tight sm:text-2xl">{job.title}</h3>

                        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-400">
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
                          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 py-3 text-sm font-black text-white hover:bg-blue-400"
                        >
                          Apply <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : null}
                    </div>

                    <div className="mt-3 rounded-lg border border-emerald-300/15 bg-emerald-400/[0.06] px-3 py-2 text-sm leading-6 text-emerald-100">
                      {job.matchReason}
                    </div>

                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-300">{summarizeDescription(job.description)}</p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => { rememberJob(job); void handleAnalyzeJob(job); }}
                        disabled={analyzingJobId === job.id}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-violet-300/20 bg-violet-500/10 px-3 py-1.5 text-xs font-black text-violet-200 transition hover:bg-violet-500/20 disabled:opacity-60"
                      >
                        {analyzingJobId === job.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        {analyzingJobId === job.id ? "Analysing…" : "AI fit check"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { rememberJob(job); void handleGenerateQuestions(job); }}
                        disabled={generatingQuestionsFor === job.id}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-blue-300/20 bg-blue-500/10 px-3 py-1.5 text-xs font-black text-blue-200 transition hover:bg-blue-500/20 disabled:opacity-60"
                      >
                        {generatingQuestionsFor === job.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mic className="h-3 w-3" />}
                        {generatingQuestionsFor === job.id ? "Generating…" : "Likely questions"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { rememberJob(job); void handleGenerateQuestions(job); }}
                        disabled={generatingQuestionsFor === job.id}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-black text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-60"
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
                      <div className="mt-3 rounded-lg border border-violet-300/15 bg-violet-500/[0.07] p-4">
                        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-violet-300">AI fit analysis</p>
                        <pre className="whitespace-pre-wrap text-xs leading-5 text-slate-300">{jobAnalysis[job.id]}</pre>
                      </div>
                    ) : null}
                    {jobQuestions[job.id] ? (
                      <div className="mt-3 rounded-lg border border-blue-300/15 bg-blue-500/[0.07] p-4">
                        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-blue-300">Likely interview questions ({jobQuestions[job.id].length})</p>
                        <ol className="space-y-2">
                          {jobQuestions[job.id].map((q, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs leading-5 text-slate-300">
                              <span className="shrink-0 rounded bg-blue-400/15 px-1.5 py-0.5 text-[10px] font-black text-blue-200">{i + 1}</span>
                              {q}
                            </li>
                          ))}
                        </ol>
                        <a
                          href="/onboarding"
                          onClick={() => rememberJob(job)}
                          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-xs font-black text-white hover:bg-blue-400"
                        >
                          <Mic className="h-3 w-3" /> Practice this interview now
                        </a>
                      </div>
                    ) : null}

                  </article>
                ))}

                {!jobs.length ? (
                  <div className="rounded-xl border border-white/10 bg-black/20 p-6 text-center">
                    <Globe2 className="mx-auto h-10 w-10 text-blue-200" />
                    <h3 className="mt-4 text-xl font-black">Live jobs will appear here</h3>
                    <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                      Click Find live jobs. Without an API key, WorkZo still gives users ready-to-open job-board searches below.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">Open job boards</h2>
                  <p className="mt-1 text-sm text-slate-400">Trusted searches using the same role, location, and keywords.</p>
                </div>
                <Briefcase className="h-5 w-5 text-blue-300" />
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {searchLinks.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-white/10 bg-black/20 p-4 hover:border-blue-300/30 hover:bg-white/[0.05]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-black">{item.label}</h3>
                      <ExternalLink className="h-4 w-4 text-slate-500" />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
                  </a>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-xl font-black">Improve this search</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Link href="/cv" className="group rounded-lg border border-white/10 bg-black/20 p-4 hover:bg-white/[0.05]">
                  <p className="font-black">Improve CV first</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">Make your profile stronger before applying.</p>
                  <span className="mt-3 inline-flex items-center gap-2 text-xs font-black text-blue-300">Open CV <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" /></span>
                </Link>
                <Link href="/cover-letter" className="group rounded-lg border border-white/10 bg-black/20 p-4 hover:bg-white/[0.05]">
                  <p className="font-black">Create cover letter</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">Prepare a tailored letter for selected jobs.</p>
                  <span className="mt-3 inline-flex items-center gap-2 text-xs font-black text-blue-300">Create letter <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" /></span>
                </Link>
                <Link href="/interview" className="group rounded-lg border border-white/10 bg-black/20 p-4 hover:bg-white/[0.05]">
                  <p className="font-black">Practice interview</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">Use target jobs to prepare answers.</p>
                  <span className="mt-3 inline-flex items-center gap-2 text-xs font-black text-blue-300">Start practice <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" /></span>
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
