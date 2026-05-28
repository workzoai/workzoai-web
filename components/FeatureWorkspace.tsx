"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Briefcase,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Mail,
  Search,
  Wand2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { readLatestInterviewSetup, type WorkZoInterviewSetup } from "@/lib/workzoInterviewSetup";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const featureCopy = {
  cv: {
    badge: "CV Workspace",
    title: "Improve CV",
    subtitle: "Auto-load your onboarding CV and job context, improve structure, choose a template, preview, edit, copy, and download.",
    icon: FileText,
    inputOneLabel: "Your CV",
    inputOnePlaceholder: "Paste your CV text here...",
    inputTwoLabel: "Target role / job description",
    inputTwoPlaceholder: "Paste a job description or describe your target role...",
    primary: "Generate improved CV",
    outputTitle: "Editable CV preview",
    mode: "cv_improve",
    chips: ["ATS clarity", "measurable impact", "role fit", "template preview"],
  },
  cover: {
    badge: "Cover Letter Workspace",
    title: "Generate Cover Letter",
    subtitle: "Auto-use your CV and job description from onboarding, then generate a focused letter you can edit, copy, or download.",
    icon: Mail,
    inputOneLabel: "Your CV / background",
    inputOnePlaceholder: "Paste your CV, profile, or key experience...",
    inputTwoLabel: "Job description",
    inputTwoPlaceholder: "Paste the job description here...",
    primary: "Generate cover letter",
    outputTitle: "Editable cover letter",
    mode: "cover_letter",
    chips: ["role-specific", "professional tone", "not generic", "download-ready"],
  },
  jobs: {
    badge: "Job Search Workspace",
    title: "Find Jobs",
    subtitle: "Use your CV, role, and target market to generate role keywords, job-board search links, and a weekly application plan.",
    icon: Search,
    inputOneLabel: "Your profile / skills",
    inputOnePlaceholder: "Paste your CV summary, skills, or current background...",
    inputTwoLabel: "Target country, role, or industry",
    inputTwoPlaceholder: "Example: Customer Success Manager in Germany, Data Analyst remote, Technical Support in Netherlands...",
    primary: "Build job search plan",
    outputTitle: "Job search plan",
    mode: "find_jobs_strategy",
    chips: ["target roles", "keywords", "job boards", "weekly plan"],
  },
} as const;

type FeatureKey = keyof typeof featureCopy;
type TemplateKey = "ats" | "modern" | "career-switcher";

const templates: Record<TemplateKey, { label: string; description: string }> = {
  ats: { label: "ATS Clean", description: "Simple, parser-friendly, achievement-focused." },
  modern: { label: "Modern Professional", description: "Premium profile summary with clear section hierarchy." },
  "career-switcher": { label: "Career Switcher", description: "Highlights transferable skills and bootcamp/project proof." },
};

function safeSetup(): WorkZoInterviewSetup | null {
  try {
    return readLatestInterviewSetup();
  } catch {
    return null;
  }
}

function setupRole(setup: WorkZoInterviewSetup | null) {
  return setup?.targetRole || "Target role";
}

function setupMarket(setup: WorkZoInterviewSetup | null) {
  return setup?.targetMarket || "Global";
}

function setupJobDescription(setup: WorkZoInterviewSetup | null) {
  return setup?.jobDescription || "";
}

function setupCv(setup: WorkZoInterviewSetup | null) {
  return setup?.cvText || "";
}

function buildCvPreview(cv: string, jd: string, role: string, template: TemplateKey) {
  const source = cv.trim() || "[Paste your CV or upload it during onboarding]";
  const context = jd.trim() || role;
  const title = role && role !== "Target role" ? role : "Target Role";

  if (template === "career-switcher") {
    return [
      `${title.toUpperCase()} — CAREER SWITCHER CV`,
      "",
      "PROFILE SUMMARY",
      `Motivated professional targeting ${title}, combining customer-facing experience, structured problem-solving, and practical project work.`,
      "",
      "TRANSFERABLE STRENGTHS",
      "• Customer communication and stakeholder support",
      "• Structured troubleshooting and ownership under pressure",
      "• Data-informed thinking and continuous learning",
      "",
      "ROLE-FIT IMPROVEMENTS TO ADD",
      "• Add measurable results: tickets solved, response time reduced, quality improved, customers helped.",
      "• Replace task descriptions with ownership statements: led, resolved, implemented, improved.",
      "• Mirror keywords from the target job description.",
      "",
      "TARGET CONTEXT",
      context,
      "",
      "SOURCE CV",
      source,
    ].join("\n");
  }

  if (template === "modern") {
    return [
      `${title.toUpperCase()} CV`,
      "",
      "PROFESSIONAL PROFILE",
      `Career-focused professional prepared for ${title}, with emphasis on measurable impact, ownership, communication, and role-fit evidence.`,
      "",
      "CORE VALUE",
      "• Clear ownership of tasks and outcomes",
      "• Evidence-based problem solving",
      "• Strong communication with customers, teams, or stakeholders",
      "",
      "IMPROVEMENT PLAN",
      "1. Strengthen the top summary with role keywords.",
      "2. Convert responsibilities into measurable achievements.",
      "3. Add tools, scope, business value, and outcomes.",
      "4. Keep formatting clean and ATS-safe.",
      "",
      "TARGET CONTEXT",
      context,
      "",
      "SOURCE CV",
      source,
    ].join("\n");
  }

  return [
    `${title.toUpperCase()} CV — ATS CLEAN TEMPLATE`,
    "",
    "SUMMARY",
    `Professional targeting ${title}. Strong focus on ownership, measurable impact, communication, and practical problem-solving.`,
    "",
    "KEY SKILLS",
    "• Communication | Ownership | Problem solving | Process improvement | Customer focus",
    "",
    "EXPERIENCE IMPROVEMENT RULES",
    "• Start bullets with action verbs.",
    "• Add numbers wherever possible.",
    "• Show what YOU owned, not only what the team did.",
    "• Use job-description keywords naturally.",
    "",
    "TARGET CONTEXT",
    context,
    "",
    "SOURCE CV",
    source,
  ].join("\n");
}

function buildCoverLetter(cv: string, jd: string, role: string) {
  const cleanRole = role && role !== "Target role" ? role : "the role";
  return [
    "Dear Hiring Team,",
    "",
    `I am excited to apply for ${cleanRole}. My background connects strongly with the role requirements, especially through customer-facing experience, structured problem-solving, ownership, and practical delivery under pressure.`,
    "",
    "In my previous experience, I developed strong communication habits, handled user or client needs carefully, and learned to translate problems into clear next steps. I am especially interested in this opportunity because it allows me to combine communication, analytical thinking, and practical impact.",
    "",
    jd.trim()
      ? "Based on the job description, I would focus on contributing quickly by understanding the team’s priorities, aligning my work with measurable outcomes, and communicating clearly with stakeholders."
      : "I would focus on contributing quickly by understanding the team’s priorities, aligning my work with measurable outcomes, and communicating clearly with stakeholders.",
    "",
    "Thank you for considering my application. I would welcome the opportunity to discuss how my background and motivation can support your team.",
    "",
    "Kind regards,",
    "[Your Name]",
    "",
    "---",
    "Context used:",
    cv.trim().slice(0, 1200) || "No CV pasted yet.",
  ].join("\n");
}

function encodeJobQuery(role: string, market: string) {
  return encodeURIComponent(`${role || "jobs"} ${market || ""}`.trim());
}

function buildJobPlan(profile: string, target: string, setup: WorkZoInterviewSetup | null) {
  const role = target.trim() || setupRole(setup);
  const market = setupMarket(setup);
  return [
    `JOB SEARCH PLAN — ${role}`,
    "",
    "TARGET ROLES TO SEARCH",
    `• ${role}`,
    `• ${role} specialist`,
    `• Junior / Associate ${role}`,
    "",
    "SEARCH KEYWORDS",
    "• customer success, customer support, technical support, client success",
    "• data analyst, SQL, Python, reporting, dashboard, operations",
    "• remote, hybrid, English-speaking, entry-level, junior, associate",
    "",
    "WEEKLY PLAN",
    "1. Save 20 relevant roles.",
    "2. Shortlist 8–10 strong-fit roles.",
    "3. Tailor CV for 3–5 applications.",
    "4. Generate role-specific cover letters.",
    "5. Practice one interview simulation for the strongest role.",
    "",
    "PROFILE SIGNALS TO USE",
    profile.trim().slice(0, 1200) || "Add your CV/profile to personalize this plan.",
  ].join("\n");
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function FeatureWorkspace({ featureKey }: { featureKey: FeatureKey }) {
  const feature = featureCopy[featureKey];
  const Icon = feature.icon;
  const [setup, setSetup] = useState<WorkZoInterviewSetup | null>(null);
  const [inputOne, setInputOne] = useState("");
  const [inputTwo, setInputTwo] = useState("");
  const [output, setOutput] = useState("");
  const [template, setTemplate] = useState<TemplateKey>("ats");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const latest = safeSetup();
    setSetup(latest);
    const cv = setupCv(latest);
    const jd = setupJobDescription(latest);
    const role = setupRole(latest);
    const market = setupMarket(latest);

    if (featureKey === "cv") {
      setInputOne(cv);
      setInputTwo(jd || role);
      setOutput(buildCvPreview(cv, jd || role, role, "ats"));
    } else if (featureKey === "cover") {
      setInputOne(cv);
      setInputTwo(jd || role);
      setOutput(buildCoverLetter(cv, jd || role, role));
    } else {
      setInputOne(cv);
      setInputTwo(`${role} ${market}`.trim());
      setOutput(buildJobPlan(cv, `${role} ${market}`.trim(), latest));
    }
  }, [featureKey]);

  const canRun = inputOne.trim().length > 10 || inputTwo.trim().length > 10;

  const jobLinks = useMemo(() => {
    const query = encodeJobQuery(inputTwo || setupRole(setup), setupMarket(setup));
    return [
      { label: "LinkedIn Jobs", href: `https://www.linkedin.com/jobs/search/?keywords=${query}` },
      { label: "Indeed", href: `https://www.indeed.com/jobs?q=${query}` },
      { label: "Google Jobs Search", href: `https://www.google.com/search?q=${query}+jobs` },
      { label: "Remote OK", href: `https://remoteok.com/remote-${query}-jobs` },
    ];
  }, [inputTwo, setup]);

  async function handleGenerate() {
    setLoading(true);

    const localOutput =
      featureKey === "cv"
        ? buildCvPreview(inputOne, inputTwo, setupRole(setup), template)
        : featureKey === "cover"
          ? buildCoverLetter(inputOne, inputTwo, setupRole(setup))
          : buildJobPlan(inputOne, inputTwo, setup);

    try {
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: feature.mode,
          message: `${feature.title}\n\nContext 1:\n${inputOne}\n\nContext 2:\n${inputTwo}\n\nTemplate: ${template}`,
          question: inputTwo,
          answer: inputOne,
        }),
      });
      const data = await response.json().catch(() => null);
      const text = data?.output || data?.message || data?.answer || data?.result || "";
      setOutput(text || localOutput);
    } catch {
      setOutput(localOutput);
    } finally {
      setLoading(false);
    }
  }

  const filename = featureKey === "cv" ? "workzo-improved-cv.txt" : featureKey === "cover" ? "workzo-cover-letter.txt" : "workzo-job-search-plan.txt";

  return (
    <main className="min-h-screen bg-[#020817] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.15),transparent_32%),radial-gradient(circle_at_top_right,rgba(124,58,237,0.16),transparent_32%),linear-gradient(180deg,#020817,#050914_50%,#020617)]" />
      <div className="relative mx-auto max-w-[1500px] px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-[30px] border border-white/[0.08] bg-[#071225]/82 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.38)] backdrop-blur-2xl sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <Link href="/dashboard" className="inline-flex items-center gap-3 text-sm font-black text-slate-300 hover:text-white">
            <ArrowLeft className="h-5 w-5" /> Back to dashboard
          </Link>
          <Link href="/" className="flex items-center gap-3">
            <Image src="/workzo_icon.png" alt="WorkZo AI" width={42} height={42} className="rounded-2xl" priority />
            <span className="text-2xl font-black">
              WorkZo <span className="text-blue-400">AI</span>
            </span>
          </Link>
        </header>

        <section className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[34px] border border-cyan-300/14 bg-[#071225]/86 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:p-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/[0.07] px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-100">
              <Icon className="h-4 w-4" /> {feature.badge}
            </span>
            <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">{feature.title}</h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">{feature.subtitle}</p>

            <div className="mt-5 rounded-[22px] border border-emerald-300/12 bg-emerald-400/[0.055] p-4 text-sm leading-6 text-emerald-100">
              <div className="flex items-center gap-2 font-black"><CheckCircle2 className="h-4 w-4" /> Onboarding context auto-loaded</div>
              <p className="mt-1 text-emerald-100/80">You can edit the fields below before generating the final output.</p>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {feature.chips.map((chip) => (
                <span key={chip} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-bold text-slate-200">{chip}</span>
              ))}
            </div>

            {featureKey === "cv" && (
              <div className="mt-6">
                <span className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Choose CV template</span>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {(Object.keys(templates) as TemplateKey[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setTemplate(key);
                        setOutput(buildCvPreview(inputOne, inputTwo, setupRole(setup), key));
                      }}
                      className={cn(
                        "rounded-2xl border p-4 text-left transition",
                        template === key ? "border-cyan-300/35 bg-cyan-400/[0.09]" : "border-white/[0.08] bg-white/[0.035] hover:bg-white/[0.06]",
                      )}
                    >
                      <p className="font-black">{templates[key].label}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{templates[key].description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8 space-y-5">
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{feature.inputOneLabel}</span>
                <textarea value={inputOne} onChange={(e) => setInputOne(e.target.value)} placeholder={feature.inputOnePlaceholder} className="mt-3 h-56 w-full resize-none rounded-[24px] border border-white/[0.08] bg-[#050b18] p-5 text-sm leading-7 text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/30" />
              </label>

              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{feature.inputTwoLabel}</span>
                <textarea value={inputTwo} onChange={(e) => setInputTwo(e.target.value)} placeholder={feature.inputTwoPlaceholder} className="mt-3 h-40 w-full resize-none rounded-[24px] border border-white/[0.08] bg-[#050b18] p-5 text-sm leading-7 text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/30" />
              </label>

              <button onClick={handleGenerate} disabled={!canRun || loading} className={cn("flex h-14 w-full items-center justify-center rounded-2xl text-sm font-black transition", canRun ? "bg-gradient-to-r from-blue-500 to-violet-600 hover:scale-[1.01]" : "cursor-not-allowed bg-white/[0.06] text-slate-500")}>
                {loading ? "Working..." : feature.primary}<ArrowRight className="ml-2 h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <section className="min-h-[560px] rounded-[34px] border border-white/[0.08] bg-[#0b1323]/86 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.38)] backdrop-blur-2xl sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">Preview · Edit · Download</p>
                  <h2 className="mt-2 text-3xl font-black">{feature.outputTitle}</h2>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => navigator.clipboard?.writeText(output)} className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.05] px-4 text-sm font-black text-slate-200 hover:text-white"><Copy className="h-4 w-4" /> Copy</button>
                  <button onClick={() => downloadText(filename, output)} className="inline-flex h-11 items-center gap-2 rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.08] px-4 text-sm font-black text-cyan-100 hover:bg-cyan-400/[0.12]"><Download className="h-4 w-4" /> Download</button>
                </div>
              </div>

              <textarea value={output} onChange={(e) => setOutput(e.target.value)} className="mt-6 min-h-[420px] w-full resize-y rounded-[26px] border border-white/[0.07] bg-[#050b18] p-6 font-mono text-sm leading-7 text-slate-200 outline-none focus:border-cyan-300/25" />
            </section>

            {featureKey === "jobs" && (
              <section className="rounded-[30px] border border-white/[0.08] bg-[#0b1323]/82 p-6">
                <div className="flex items-center gap-3"><Briefcase className="h-5 w-5 text-cyan-200" /><h3 className="text-2xl font-black">Open live job searches</h3></div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {jobLinks.map((link) => (
                    <a key={link.label} href={link.href} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.045] px-4 py-4 text-sm font-black text-slate-200 hover:bg-white/[0.08] hover:text-white">
                      {link.label}<ExternalLink className="h-4 w-4 text-cyan-200" />
                    </a>
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-[30px] border border-cyan-300/14 bg-cyan-400/[0.055] p-6">
              <div className="flex items-start gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600"><Bot className="h-5 w-5" /></span>
                <div>
                  <h3 className="text-2xl font-black">Need broader career help?</h3>
                  <p className="mt-2 text-slate-300">Use this dedicated workspace for focused output, or open Work-O-Bot for broader career strategy.</p>
                  <Link href="/copilot" className="mt-4 inline-flex h-12 items-center rounded-2xl bg-white/[0.08] px-5 text-sm font-black hover:bg-white/[0.12]">
                    Open Work-O-Bot <Wand2 className="ml-2 h-4 w-4" />
                  </Link>
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
