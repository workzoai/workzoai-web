"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building2,
  Check,
  ChevronRight,
  FileText,
  Globe2,
  Lock,
  Mic,
  Radar,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRound,
  Wand2,
  Zap,
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useState } from "react";

import { useInterviewStore } from "@/store/interviewStore";
import { buildAndSaveInterviewSetup, structureResumeProfileFromCv } from "@/lib/workzoCvClient";
import {
  extractResumeProfile,
  extractResumeProfileComplex,
  normalizeResumeText,
  type ResumeProfile,
} from "@/lib/workzoResumeParser";
import {
  saveLatestInterviewSetup,
  clearLatestInterviewSetup,
} from "@/lib/workzoInterviewSetup";

import PrivacyNotice from "@/components/BetaPrivacyNotice";
import { trackWorkZoLaunchEvent } from "@/lib/workzoLaunchAnalytics";
import { useWorkZoAuthoritativePlan } from "@/lib/workzoClientPlan";
import { debugCvPipeline, debugCvProfile, debugCvText } from "@/lib/workzoCvPipelineDebug";
import { cleanCvHeadline } from "@/lib/workzoCvPdfCleaner";
import { buildWorkZoCompanyBlueprint } from "@/lib/workzoCompanyBlueprint";

type Market = "Global" | "Germany" | "US" | "UK" | "India" | "Netherlands";
type CompanyStyle =
  | "Realistic"
  | "Startup"
  | "Corporate"
  | "Technical"
  | "Consulting";
type RecruiterKey =
  | "friendly_hr"
  | "analytical_hiring_manager"
  | "startup_recruiter"
  | "german_corporate"
  | "faang_hiring_manager"
  | "startup_founder"
  | "consulting_partner"
  | "sales_director"
  | "product_leader"
  | "executive_recruiter"
  | "enterprise_recruiter";

type InterviewLanguage =
  | "English"
  | "German"
  | "Dutch"
  | "French"
  | "Spanish"
  | "Italian"
  | "Portuguese";

type SetupState = {
  [key: string]: unknown;
  cvText?: string;
  targetRole?: string;
  jobDescription?: string;
  targetMarket?: string;
  country?: string;
  companyStyle?: string;
  recruiterStyle?: string;
  recruiterPersonality?: string;
  language?: string;
  recruiterMemoryProfile?: unknown;
  jobMemoryProfile?: unknown;
  setupVersion?: number;
  setupId?: string;
  updatedAt?: string;
  source?: string;
};

type CardIcon = typeof FileText;

type PreviewCard = {
  label: string;
  value: string;
  Icon: CardIcon;
};

const steps = [
  { id: 1, label: "Upload CV" },
  { id: 2, label: "Job Role" },
  { id: 3, label: "Preferences" },
  { id: 4, label: "Preview" },
  { id: 5, label: "Start" },
];

const markets: { label: Market; flag: string }[] = [
  { label: "Global", flag: "🌍" },
  { label: "Germany", flag: "🇩🇪" },
  { label: "US", flag: "🇺🇸" },
  { label: "UK", flag: "🇬🇧" },
  { label: "India", flag: "🇮🇳" },
  { label: "Netherlands", flag: "🇳🇱" },
];
const companyStyles: CompanyStyle[] = [
  "Realistic",
  "Startup",
  "Corporate",
  "Technical",
  "Consulting",
];

const recruiters: {
  key: RecruiterKey;
  name: string;
  role: string;
  avatar: string;
  quote: string;
  description: string;
}[] = [
  {
    key: "friendly_hr",
    name: "Sarah",
    role: "Friendly HR",
    avatar: "👩🏻‍💼",
    quote: "I'd love to understand how you work with people.",
    description: "Warm, supportive, and communication-focused.",
  },
  {
    key: "analytical_hiring_manager",
    name: "Daniel",
    role: "Hiring Manager",
    avatar: "👨🏻‍💼",
    quote: "Can you prove the business impact behind that answer?",
    description: "Evidence-driven and focused on measurable impact.",
  },
  {
    key: "startup_recruiter",
    name: "Priya",
    role: "Startup Recruiter",
    avatar: "👩🏽‍💼",
    quote: "What did YOU specifically own in that project?",
    description: "Fast-paced, practical, and ownership-focused.",
  },
  {
    key: "german_corporate",
    name: "Markus",
    role: "Corporate Recruiter",
    avatar: "👨🏼‍💼",
    quote: "Please keep the answer concise and relevant.",
    description: "Structured, professional, and process-oriented.",
  },
];

const proRecruiters: {
  key: RecruiterKey;
  name: string;
  role: string;
  avatar: string;
  quote: string;
  description: string;
}[] = [
  { key: "faang_hiring_manager", name: "Alex Chen", role: "FAANG Hiring Manager", avatar: "👨🏻‍💻", quote: "Walk me through the exact trade-off you made and how you measured success.", description: "Technical, systematic, and expects structured thinking with data. Probes every assumption." },
  { key: "startup_founder", name: "Zoe Park", role: "Startup Founder", avatar: "👩🏻‍🚀", quote: "What broke, what did you own, and what would you do differently at 10x scale?", description: "Moves fast, hates buzzwords, rewards radical ownership. Expects you to talk about failure honestly." },
  { key: "consulting_partner", name: "James Harrington", role: "Consulting Partner", avatar: "👨🏻‍💼", quote: "Structure your answer. Situation, what was at stake, and your recommendation.", description: "Case-style pressure, frameworks, and structured delivery. Will redirect a rambling answer." },
  { key: "sales_director", name: "Marcus Webb", role: "Sales Director", avatar: "👨🏾‍💼", quote: "Give me a number. Revenue impact, quota attainment, deal size — be specific.", description: "Numbers-first, commercial mindset. Will push you to quantify everything." },
  { key: "product_leader", name: "Aisha Patel", role: "Product Leader", avatar: "👩🏾‍💼", quote: "How did you decide what NOT to build, and what was the user evidence?", description: "User empathy, prioritisation, and cross-functional influence. Expects product sense." },
  { key: "executive_recruiter", name: "Victoria Stern", role: "Executive Recruiter", avatar: "👩🏼‍💼", quote: "What would your last manager say is your biggest development area? Be honest.", description: "Senior-level strategic questioning. Expects board-ready communication and leadership narrative." },
  { key: "enterprise_recruiter", name: "David Kimura", role: "Enterprise Recruiter", avatar: "👨🏻‍💼", quote: "How did you manage stakeholders at different levels? Give me a cross-functional example.", description: "Process, governance, and stakeholder management. Structured answers with clear escalation." },
];

const interviewLanguages: { label: InterviewLanguage; nativeLabel: string; hint: string }[] = [
  { label: "English", nativeLabel: "English", hint: "Global interview practice" },
  { label: "German", nativeLabel: "Deutsch", hint: "Formal German-style practice" },
  { label: "Dutch", nativeLabel: "Nederlands", hint: "Netherlands / Dutch practice" },
  { label: "French", nativeLabel: "Français", hint: "French interview practice" },
  { label: "Spanish", nativeLabel: "Español", hint: "Spanish interview practice" },
  { label: "Italian", nativeLabel: "Italiano", hint: "Italian interview practice" },
  { label: "Portuguese", nativeLabel: "Português", hint: "Portuguese interview practice" },
];

function normalizeInterviewLanguage(value?: unknown): InterviewLanguage {
  if (typeof value !== "string") return "English";
  const raw = value.trim().toLowerCase();

  if (raw.includes("german") || raw.includes("deutsch") || raw === "de" || raw === "de-de") return "German";
  if (raw.includes("dutch") || raw.includes("nederlands") || raw === "nl" || raw === "nl-nl") return "Dutch";
  if (raw.includes("french") || raw.includes("français") || raw.includes("francais") || raw === "fr" || raw === "fr-fr") return "French";
  if (raw.includes("spanish") || raw.includes("español") || raw.includes("espanol") || raw === "es" || raw === "es-es") return "Spanish";
  if (raw.includes("italian") || raw.includes("italiano") || raw === "it" || raw === "it-it") return "Italian";
  if (raw.includes("portuguese") || raw.includes("português") || raw.includes("portugues") || raw === "pt" || raw === "pt-pt" || raw === "pt-br") return "Portuguese";
  return "English";
}

const waveform = [
  8, 14, 22, 12, 18, 26, 14, 20, 11, 24, 16, 28, 12, 20, 15, 23, 10, 19, 13, 26,
  14, 18, 9, 22,
];

const analysisSignals = [
  "CV evidence scan",
  "JD match logic",
  "Recruiter memory",
  "Pressure moments",
  "Market expectations",
];

const liveStatusMessages = [
  "Analyzing communication style",
  "Matching recruiter expectations",
  "Building contradiction memory",
  "Preparing pressure follow-ups",
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function recruiterLabel(key?: string) {
  const normalized = normalizeRecruiterKey(key);
  const recruiter = recruiters.find((item) => item.key === normalized);
  return recruiter
    ? `${recruiter.name} · ${recruiter.role}`
    : "Daniel · Hiring Manager";
}

function normalizeRecruiterKey(value?: unknown): RecruiterKey {
  if (typeof value !== "string") return "analytical_hiring_manager";

  const raw = value.trim().toLowerCase();
  const key = raw.replace(/·/g, " ").replace(/-/g, "_").replace(/\s+/g, "_");

  if (key === "friendly_hr" || raw.includes("sarah")) return "friendly_hr";
  if (key === "analytical_hiring_manager" || raw.includes("daniel"))
    return "analytical_hiring_manager";
  if (key === "startup_recruiter" || raw.includes("priya"))
    return "startup_recruiter";
  if (
    key === "german_corporate" ||
    key === "corporate_recruiter" ||
    raw.includes("markus")
  ) {
    return "german_corporate";
  }
  if (key === "faang_hiring_manager" || raw.includes("faang") || raw.includes("alex chen")) return "faang_hiring_manager";
  if (key === "startup_founder" || (raw.includes("founder") && !raw.includes("startup_recruiter"))) return "startup_founder";
  if (key === "consulting_partner" || raw.includes("consulting_partner") || raw.includes("harrington")) return "consulting_partner";
  if (key === "sales_director" || raw.includes("sales_director") || raw.includes("marcus webb")) return "sales_director";
  if (key === "product_leader" || raw.includes("product_leader") || raw.includes("aisha")) return "product_leader";
  if (key === "executive_recruiter" || raw.includes("executive_recruiter") || raw.includes("victoria stern")) return "executive_recruiter";
  if (key === "enterprise_recruiter" || raw.includes("enterprise_recruiter") || raw.includes("kimura")) return "enterprise_recruiter";

  return "analytical_hiring_manager";
}

function compactText(value?: string, fallback = "Missing") {
  const text = value?.trim();
  if (!text) return fallback;
  return text.length > 70 ? `${text.slice(0, 70)}...` : text;
}

function isUsableResumeProfile(value: unknown): value is ResumeProfile {
  if (!value || typeof value !== "object" || !("basics" in value)) return false;
  const profile = value as ResumeProfile;
  const name = profile.basics?.name?.trim() || "";
  const headline = profile.basics?.headline?.trim() || "";
  const hasRealIdentity = Boolean(name || headline || profile.basics?.email);
  const hasRealContent =
    Boolean(profile.summary?.trim()) ||
    Boolean(profile.experience?.length) ||
    Boolean(profile.education?.length) ||
    Boolean(profile.skills?.length);
  return hasRealIdentity && hasRealContent;
}

function pickCanonicalResumeProfile(options: {
  aiProfile?: ResumeProfile | null;
  setupProfile?: unknown;
  rawCvText: string;
}) {
  if (isUsableResumeProfile(options.aiProfile)) return options.aiProfile;
  if (isUsableResumeProfile(options.setupProfile)) return options.setupProfile;
  return extractResumeProfileComplex(options.rawCvText);
}

function getStoreSetup(store: unknown): SetupState {
  const value = store as { setup?: SetupState; interviewSetup?: SetupState };
  return value?.setup || value?.interviewSetup || {};
}

function saveSetupToStore(nextSetup: SetupState, store: unknown) {
  const normalizedSetup: SetupState = {
    ...nextSetup,
    recruiterPersonality: normalizeRecruiterKey(nextSetup.recruiterPersonality),
    language: normalizeInterviewLanguage(nextSetup.language),
    targetMarket: nextSetup.targetMarket || nextSetup.country || "Global",
    country: nextSetup.targetMarket || nextSetup.country || "Global",
  };

  const storeAny = store as {
    setSetup?: (setup: SetupState) => void;
    updateSetup?: (setup: SetupState) => void;
    saveSetup?: (setup: SetupState) => void;
    setInterviewSetup?: (setup: SetupState) => void;
  };

  if (typeof storeAny.setSetup === "function") {
    storeAny.setSetup(normalizedSetup);
  } else if (typeof storeAny.updateSetup === "function") {
    storeAny.updateSetup(normalizedSetup);
  } else if (typeof storeAny.saveSetup === "function") {
    storeAny.saveSetup(normalizedSetup);
  } else if (typeof storeAny.setInterviewSetup === "function") {
    storeAny.setInterviewSetup(normalizedSetup);
  } else {
    useInterviewStore.setState({ setup: normalizedSetup } as never);
  }

  try {
    const cleanSetup = normalizedSetup;

    window.localStorage.setItem(
      "workzo-interview-setup-v4",
      JSON.stringify(cleanSetup),
    );
    window.localStorage.setItem(
      "workzo-latest-interview-setup",
      JSON.stringify(cleanSetup),
    );
    window.localStorage.setItem(
      "workzo-interview-setup-latest",
      JSON.stringify(cleanSetup),
    );
    window.localStorage.setItem(
      "workzoInterviewSetup",
      JSON.stringify(cleanSetup),
    );
    window.localStorage.setItem(
      "latestInterviewSetup",
      JSON.stringify(cleanSetup),
    );
    window.localStorage.setItem("onboardingSetup", JSON.stringify(cleanSetup));
    window.localStorage.removeItem("workzo-interview-setup-v3");
    window.localStorage.removeItem("workzo-interview-setup-v2");
    window.localStorage.removeItem("workzo-interview-setup");
    window.localStorage.removeItem("workzo_setup");
    window.localStorage.removeItem("workzo-onboarding");
    window.localStorage.removeItem("workzo_onboarding");
  } catch {
    // localStorage may be blocked. The Zustand state update above is enough for the active session.
  }
}


function buildInterviewCvContext(profile: ResumeProfile, fallbackRawText: string) {
  const lines: string[] = [];
  const basics = profile.basics || {};

  if (basics.name?.trim()) lines.push(`Candidate name: ${basics.name.trim()}`);
  // Use cleanCvHeadline to avoid showing company names as the headline
  // (common with two-column PDFs where company name gets extracted as headline)
  const firstJobTitle = profile.experience?.[0]?.title || "";
  const displayHeadline = basics.headline?.trim()
    ? cleanCvHeadline(basics.headline.trim(), profile.summary || "", firstJobTitle)
    : firstJobTitle;
  if (displayHeadline) lines.push(`Headline: ${displayHeadline}`);
  const contact = [basics.email, basics.phone, basics.location, basics.linkedin].filter(Boolean).join(" • ");
  if (contact) lines.push(`Contact: ${contact}`);
  if (profile.summary?.trim()) lines.push(`Summary: ${profile.summary.trim()}`);

  if (profile.experience?.length) {
    lines.push("Experience:");
    profile.experience.slice(0, 6).forEach((item) => {
      const title = [item.title, item.company, item.dates].filter(Boolean).join(" • ");
      if (title) lines.push(`- ${title}`);
      item.bullets?.slice(0, 4).forEach((bullet) => lines.push(`  • ${bullet}`));
    });
  }

  if (profile.education?.length) {
    lines.push("Education:");
    profile.education.slice(0, 4).forEach((item) => {
      const label = [item.degree, item.institution, item.dates].filter(Boolean).join(" • ");
      if (label) lines.push(`- ${label}`);
    });
  }

  if (profile.skills?.length) lines.push(`Skills: ${profile.skills.slice(0, 24).join(", ")}`);
  if (profile.projects?.length) {
    lines.push("Projects:");
    profile.projects.slice(0, 4).forEach((project) => {
      if (project.name) lines.push(`- ${project.name}`);
      project.bullets?.slice(0, 3).forEach((bullet) => lines.push(`  • ${bullet}`));
    });
  }
  if (profile.languages?.length) lines.push(`Languages: ${profile.languages.slice(0, 8).join(", ")}`);
  if (profile.certifications?.length) lines.push(`Certifications: ${profile.certifications.slice(0, 8).join(", ")}`);

  return lines.join("\n").trim() || fallbackRawText;
}

function buildCanonicalCvSetup(input: {
  setup: SetupState;
  rawCvText: string;
  jobDescription: string;
  role: string;
  market: string;
  companyStyle: string;
  recruiter: RecruiterKey;
  language: string;
  profile?: ResumeProfile | null;
}) {
  const profile = pickCanonicalResumeProfile({
    aiProfile: input.profile || null,
    setupProfile: input.setup.resumeProfile,
    rawCvText: input.rawCvText,
  });

  const companyBlueprint = buildWorkZoCompanyBlueprint({
    companyName: String(input.setup.companyName || input.setup.targetCompany || "Target company"),
    targetRole: input.role || profile.basics.headline || "General Role",
    jobDescription: input.jobDescription,
    cvText: input.rawCvText,
    market: input.market,
    companyStyle: input.companyStyle,
  });

  return {
    ...input.setup,
    cvText: buildInterviewCvContext(profile, input.rawCvText),
    uploadedCvText: input.rawCvText,
    resumeText: buildInterviewCvContext(profile, input.rawCvText),
    candidateCv: buildInterviewCvContext(profile, input.rawCvText),
    rawCvText: input.rawCvText,
    previewText: profile.previewText,
    jobDescription: input.jobDescription,
    jdText: input.jobDescription,
    targetRole: input.role || profile.basics.headline || "General Role",
    role: input.role || profile.basics.headline || "General Role",
    targetMarket: input.market || "global",
    country: input.market || "global",
    companyStyle: input.companyStyle,
    recruiterStyle: input.companyStyle,
    recruiterPersonality: normalizeRecruiterKey(input.recruiter),
    language: input.language || "English",
    source: "onboarding-canonical-cv-extraction",
    setupVersion: 7,
    setupId: `setup_${Date.now()}`,
    updatedAt: new Date().toISOString(),
    candidateName: profile.basics.name,
    candidateHeadline: profile.basics.headline,
    candidateEmail: profile.basics.email,
    candidatePhone: profile.basics.phone,
    candidateLocation: profile.basics.location,
    candidateLinkedin: profile.basics.linkedin,
    resumeProfile: profile,
    companyBlueprint,
    targetCompany: companyBlueprint.companyName,
  } as SetupState;
}

function saveCanonicalCvSetup(setup: SetupState, store: any) {
  debugCvProfile("onboarding.saveCanonicalCvSetup.before", setup.resumeProfile, {
    setupId: setup.setupId,
    source: setup.source,
    cvChars: typeof setup.cvText === "string" ? setup.cvText.length : 0,
  });
  saveSetupToStore(setup, store);
  const saved = saveLatestInterviewSetup(
    setup as Parameters<typeof saveLatestInterviewSetup>[0]
  );
  debugCvProfile("onboarding.saveCanonicalCvSetup.after", saved.resumeProfile, {
    setupId: saved.setupId,
    source: saved.source,
    cvChars: typeof saved.cvText === "string" ? saved.cvText.length : 0,
  });
}

function ResumeProfileReview({ profile }: { profile: ResumeProfile | null }) {
  if (!profile) {
    return (
      <div className="mt-4 rounded-3xl border border-white/10 bg-[#050b16] p-5 text-sm leading-6 text-slate-400">
        Upload a CV or paste CV text. WorkZo will convert it into a clean
        profile before the interview.
      </div>
    );
  }

  const basics = profile.basics;
  const topSkills = profile.skills.slice(0, 18);
  const experience = profile.experience.slice(0, 3);
  const projects = profile.projects.slice(0, 3);
  const education = profile.education.slice(0, 3);
  const languages = profile.languages.slice(0, 6);

  return (
    <section className="mt-4 space-y-4 rounded-3xl border border-white/10 bg-[#050b16] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">
            Review your professional profile
          </p>
          <h2 className="mt-2 break-words text-2xl font-black text-white">
            {basics.name || "Candidate"}
          </h2>
          <p className="mt-1 text-sm font-bold text-blue-100">
            {basics.headline || "Professional"}
          </p>
          <p className="mt-2 break-words text-xs leading-5 text-slate-400">
            {[basics.email, basics.phone, basics.location, basics.linkedin]
              .filter(Boolean)
              .join(" • ")}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-emerald-300/15 bg-emerald-400/10 px-3 py-1.5 text-xs font-black text-emerald-200">
          Clean profile ready
        </span>
      </div>

      {profile.summary ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
            Summary
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {profile.summary}
          </p>
        </div>
      ) : null}

      {experience.length ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
            Experience
          </p>
          <div className="mt-3 space-y-3">
            {experience.map((job, index) => (
              <div
                key={`experience-${job.company || "company"}-${job.title || "title"}-${job.dates || "dates"}-${index}`}
                className="rounded-2xl bg-black/20 p-3"
              >
                <p className="font-black text-white">{job.title || "Role"}</p>
                <p className="mt-1 text-sm font-bold text-blue-100">
                  {[job.company, job.dates].filter(Boolean).join(" • ")}
                </p>
                {job.bullets.length ? (
                  <ul className="mt-2 space-y-1 text-sm leading-5 text-slate-400">
                    {job.bullets.slice(0, 3).map((bullet, bulletIndex) => (
                      <li key={`bullet-${index}-${bulletIndex}`}>• {bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {topSkills.length ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
              Skills
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {topSkills.map((skill, index) => (
                <span
                  key={`skill-${skill || "skill"}-${index}`}
                  className="rounded-full border border-cyan-300/15 bg-cyan-400/8 px-3 py-1.5 text-xs font-bold text-cyan-100"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {education.length || languages.length ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
              Education & languages
            </p>
            <div className="mt-3 space-y-2 text-sm leading-5 text-slate-300">
              {education.map((edu, index) => (
                <p
                  key={`education-${edu.degree || "degree"}-${edu.institution || "institution"}-${edu.dates || "dates"}-${index}`}
                >
                  •{" "}
                  {[edu.degree, edu.institution, edu.dates]
                    .filter(Boolean)
                    .join(" • ")}
                </p>
              ))}
              {languages.map((language, index) => (
                <p key={`language-${language || "language"}-${index}`}>
                  • {language}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {projects.length ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
            Projects
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {projects.map((project, index) => (
              <div
                key={`project-${project.name || "project"}-${index}`}
                className="rounded-2xl bg-black/20 p-3"
              >
                <p className="font-black text-white">{project.name}</p>
                {project.bullets[0] ? (
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    {project.bullets[0]}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const store = useInterviewStore() as unknown;
  const setup = getStoreSetup(store);

  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [fileName, setFileName] = useState("");
  // manualCv starts empty for a fresh session — restored CV text from a
  // previous session is tracked separately so we can show a clear banner
  // instead of silently rendering a possibly-stale extracted profile.
  const [manualCv, setManualCv] = useState("");
  const [restoredCvText] = useState(setup.cvText || "");
  const [restoredCvDismissed, setRestoredCvDismissed] = useState(false);
  const [useRestoredCv, setUseRestoredCv] = useState(false);

  // Single source of truth for "the CV text this session should use".
  // - If the user uploaded/pasted a CV this session, that wins.
  // - Otherwise, only fall back to a previous session's CV if the user
  //   explicitly chose to reuse it via the "Use this CV" banner action.
  const effectiveCvText = manualCv || (useRestoredCv ? restoredCvText : "");
  const [role, setRole] = useState(setup.targetRole || "");
  const [companyName, setCompanyName] = useState(String(setup.companyName || setup.targetCompany || ""));
  const [jobDescription, setJobDescription] = useState(
    setup.jobDescription || "",
  );
  const [market, setMarket] = useState<Market>(
    (setup.targetMarket as Market) || (setup.country as Market) || "Global",
  );
  const [companyStyle, setCompanyStyle] = useState<CompanyStyle>(
    (setup.companyStyle as CompanyStyle) ||
      (setup.recruiterStyle as CompanyStyle) ||
      "Realistic",
  );
  const [recruiter, setRecruiter] = useState<RecruiterKey>(
    normalizeRecruiterKey(setup.recruiterPersonality),
  );
  const planState = useWorkZoAuthoritativePlan();
  const isProUser = planState.plan === "premium_pro";
  const [interviewLanguage, setInterviewLanguage] = useState<InterviewLanguage>(
    normalizeInterviewLanguage(setup.language),
  );
  const [aiResumeProfile, setAiResumeProfile] = useState<ResumeProfile | null>(
    null,
  );
  const [aiCvStructuringStatus, setAiCvStructuringStatus] = useState<
    "idle" | "structuring" | "ready" | "fallback"
  >("idle");

  const resumeProfile = useMemo(() => {
    if (aiResumeProfile) return aiResumeProfile;

    const source = normalizeResumeText(effectiveCvText);
    if (!source.trim()) return null;
    return extractResumeProfileComplex(source);
  }, [aiResumeProfile, effectiveCvText]);

  const readiness = useMemo(() => {
    const cvReady = Boolean(effectiveCvText.trim());
    const roleReady = Boolean(role.trim());
    const preferencesReady = Boolean(market && companyStyle && recruiter && interviewLanguage);
    const jdBonus = Boolean(jobDescription.trim());
    return Math.min(
      100,
      [cvReady, roleReady, preferencesReady, jdBonus].filter(Boolean).length *
        25,
    );
  }, [
    effectiveCvText,
    role,
    market,
    companyStyle,
    recruiter,
    interviewLanguage,
    jobDescription,
  ]);

  const visualReadinessByStep: Record<number, number> = {
    1: 25,
    2: 50,
    3: 75,
    4: 90,
    5: 100,
  };

  const visualReadiness = Math.max(
    readiness,
    visualReadinessByStep[step] || readiness,
  );

  const currentStepLabel =
    steps.find((item) => item.id === step)?.label || "Setup";

  const setupGuideContent: Record<
    number,
    { title: string; description: string; summary: string }
  > = {
    1: {
      title: "WorkZo is understanding your experience.",
      description:
        "Add your CV first. The recruiter will use your real background instead of asking generic practice questions.",
      summary: `Your CV context is being prepared for ${recruiterLabel(recruiter)}.`,
    },
    2: {
      title: "Interview questions are adapting to your role.",
      description:
        "Add a target role or job description so WorkZo can ask sharper, role-specific follow-ups.",
      summary: `You are shaping this interview around ${role.trim() || "your target role"}.`,
    },
    3: {
      title: "Recruiter behavior is being calibrated.",
      description:
        "Market, company style, and recruiter personality quietly shape the pressure, tone, and expectations.",
      summary: `You are choosing ${recruiterLabel(recruiter)} with a ${companyStyle.toLowerCase()} interview style in ${interviewLanguage}.`,
    },
    4: {
      title: "Pressure and follow-up logic are prepared.",
      description:
        "Review the setup once. WorkZo will use this context to simulate a more realistic recruiter conversation.",
      summary: `You are preparing a realistic interview with ${recruiterLabel(recruiter)}.`,
    },
    5: {
      title: "Your interview runtime is ready.",
      description:
        "Start when ready. You can still return and edit your setup before practicing again.",
      summary: `Your interview room is ready with ${recruiterLabel(recruiter)}.`,
    },
  };

  const guide = setupGuideContent[step] || setupGuideContent[1];

  function buildDraftSetup(): SetupState {
    const cvText = effectiveCvText.trim();
    const jdText = jobDescription.trim();
    const draftBlueprint = buildWorkZoCompanyBlueprint({
      companyName: companyName || String(setup.companyName || setup.targetCompany || "Target company"),
      targetRole: role || setup.targetRole || "General Role",
      jobDescription: jdText,
      cvText,
      market,
      companyStyle,
    });

    return {
      ...setup,
      cvText,
      jobDescription: jdText,
      targetRole: role || setup.targetRole || "General Role",
      companyName: draftBlueprint.companyName,
      targetCompany: draftBlueprint.companyName,
      companyBlueprint: draftBlueprint,
      targetMarket: market,
      country: market,
      companyStyle,
      recruiterStyle: companyStyle,
      recruiterPersonality: normalizeRecruiterKey(recruiter),
      source: setup.source || "mobile-fast-onboarding",
      setupVersion: 4,
      setupId: setup.setupId || `setup_${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
  }

  function enrichSetupInBackground(draft: SetupState) {
    const cvText = (draft.cvText || "").trim();
    const jdText = (draft.jobDescription || "").trim();

    if (!cvText && !jdText) return;

    window.setTimeout(() => {
      void buildAndSaveInterviewSetup({
        cvText,
        jobDescription: jdText,
        targetRole: draft.targetRole || "General Role",
        targetMarket: (draft.targetMarket as Market) || market,
        companyStyle: (draft.companyStyle as CompanyStyle) || companyStyle,
        recruiterPersonality: normalizeRecruiterKey(draft.recruiterPersonality),
        language: normalizeInterviewLanguage(draft.language) || interviewLanguage,
        save: false,
      })
        .then((nextSetup) => {
          // Keep the canonical local CV parse as the source of truth.
          // The API result should add recruiter/job memory, not replace raw CV/profile fields.
          const mergedSetup = {
            ...nextSetup,
            ...draft,
            recruiterMemoryProfile: nextSetup.recruiterMemoryProfile || draft.recruiterMemoryProfile,
            jobMemoryProfile: nextSetup.jobMemoryProfile || draft.jobMemoryProfile,
          } as SetupState;
          saveCanonicalCvSetup(mergedSetup, store);
        })
        .catch(() => {
          // Keep the fast local setup. The interview can still start immediately.
        });
    }, 40);
  }

  function persistFast(nextStep?: number) {
    const draft = buildDraftSetup();
    const rawCvText = normalizeResumeText(draft.cvText || effectiveCvText || "");
    const profile = pickCanonicalResumeProfile({
      aiProfile: aiResumeProfile,
      setupProfile: setup.resumeProfile,
      rawCvText,
    });
    const fastBlueprint = buildWorkZoCompanyBlueprint({
      companyName: companyName || String(draft.companyName || draft.targetCompany || "Target company"),
      targetRole: role || profile.basics.headline || "General Role",
      jobDescription: jobDescription.trim(),
      cvText: rawCvText,
      market,
      companyStyle,
    });

    const canonicalSetup = {
      ...draft,
      cvText: buildInterviewCvContext(profile, rawCvText),
      uploadedCvText: rawCvText,
      resumeText: buildInterviewCvContext(profile, rawCvText),
      candidateCv: buildInterviewCvContext(profile, rawCvText),
      rawCvText,
      previewText: profile.previewText,
      jobDescription: jobDescription.trim(),
      jdText: jobDescription.trim(),
      targetRole: role || profile.basics.headline || "General Role",
      role: role || profile.basics.headline || "General Role",
      companyName: fastBlueprint.companyName,
      targetCompany: fastBlueprint.companyName,
      companyBlueprint: fastBlueprint,
      targetMarket: market,
      country: market,
      candidateName: profile.basics.name,
      candidateHeadline: profile.basics.headline,
      candidateEmail: profile.basics.email,
      candidatePhone: profile.basics.phone,
      candidateLocation: profile.basics.location,
      candidateLinkedin: profile.basics.linkedin,
      resumeProfile: profile,
      setupVersion: 7,
      updatedAt: new Date().toISOString(),
    } as SetupState;

    saveCanonicalCvSetup(canonicalSetup, store);
    if (nextStep) setStep(nextStep);
    enrichSetupInBackground(canonicalSetup);
  }

  useEffect(() => {
    trackWorkZoLaunchEvent({
      event: "onboarding_viewed",
      role,
      market,
      recruiter: recruiterLabel(recruiter),
    });
  }, [market, recruiter, role]);

  async function persist(nextStep?: number) {
    const cvText = effectiveCvText.trim();
    const jdText = jobDescription.trim();

    if (cvText) {
      trackWorkZoLaunchEvent({
        event: "cv_uploaded",
        role,
        market,
        recruiter: recruiterLabel(recruiter),
      });
    }

    if (jdText) {
      trackWorkZoLaunchEvent({
        event: "jd_added",
        role,
        market,
        recruiter: recruiterLabel(recruiter),
      });
    }

    let nextSetup: SetupState;

    // Do NOT call /api/cv unless there is actual CV or JD text.
    // This prevents "CV text or job description is required."
    const rawCvText = normalizeResumeText(cvText);
    const canonicalSetup = rawCvText
      ? buildCanonicalCvSetup({
          setup,
          rawCvText,
          jobDescription: jdText,
          role: role || "General Role",
          market,
          companyStyle,
          recruiter,
          language: interviewLanguage,
          profile: pickCanonicalResumeProfile({
            aiProfile: aiResumeProfile,
            setupProfile: setup.resumeProfile,
            rawCvText,
          }),
        })
      : ({
          ...setup,
          cvText: "",
          jobDescription: jdText,
          jdText,
          targetRole: role || "General Role",
          targetMarket: market,
          country: market,
          companyStyle,
          recruiterStyle: companyStyle,
          recruiterPersonality: normalizeRecruiterKey(recruiter),
          updatedAt: new Date().toISOString(),
        } as SetupState);

    if (cvText.length > 0 || jdText.length > 0) {
      const memorySetup = (await buildAndSaveInterviewSetup({
        cvText,
        jobDescription: jdText,
        targetRole: role || "General Role",
        targetMarket: market,
        companyStyle,
        recruiterPersonality: normalizeRecruiterKey(recruiter),
        save: false,
      })) as SetupState;

      nextSetup = {
        ...memorySetup,
        ...canonicalSetup,
        recruiterMemoryProfile: memorySetup.recruiterMemoryProfile || canonicalSetup.recruiterMemoryProfile,
        jobMemoryProfile: memorySetup.jobMemoryProfile || canonicalSetup.jobMemoryProfile,
      } as SetupState;
    } else {
      nextSetup = canonicalSetup;
    }

    saveCanonicalCvSetup(nextSetup, store);

    if (nextStep) setStep(nextStep);
  }


  async function structureCvWithAi(rawCvText: string, uploadedFileName = "") {
    if (!rawCvText.trim()) return extractResumeProfileComplex(rawCvText);

    setAiCvStructuringStatus("structuring");

    try {
      const data = await structureResumeProfileFromCv({
        cvText: rawCvText,
        jobDescription: jobDescription.trim(),
        targetRole: role || "General Role",
        targetMarket: market,
        fileName: uploadedFileName,
      });

      const profile =
        data?.resumeProfile && typeof data.resumeProfile === "object"
          ? (data.resumeProfile as ResumeProfile)
          : extractResumeProfileComplex(rawCvText);

      setAiResumeProfile(profile);
      setAiCvStructuringStatus(data?.ok ? "ready" : "fallback");

      return profile;
    } catch {
      const fallback = extractResumeProfileComplex(rawCvText);
      setAiResumeProfile(fallback);
      setAiCvStructuringStatus("fallback");
      return fallback;
    }
  }

  async function handleCvUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setUploading(true);
    setUploadError("");

    try {
      clearLatestInterviewSetup();

      const form = new FormData();
      form.append("file", file);

      const response = await fetch("/api/cv", {
        method: "POST",
        body: form,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "CV extraction failed");
      }

      debugCvPipeline("onboarding.upload.api_response", {
        keys: data && typeof data === "object" ? Object.keys(data) : [],
        fileName: file.name,
        chars: data?.chars || null,
      });

      const extracted =
        data?.text ||
        data?.cvText ||
        data?.content ||
        data?.resumeText ||
        data?.extractedText ||
        "";

      if (!String(extracted).trim()) {
        throw new Error(
          "PDF uploaded, but no readable CV text was found. Paste the CV text manually.",
        );
      }

      const rawCvText = normalizeResumeText(String(extracted));
      debugCvText("onboarding.upload.cleaned_text", rawCvText, { fileName: file.name });

      const apiProfile = data?.resumeProfile || data?.profile;
      const profile = isUsableResumeProfile(apiProfile)
        ? (apiProfile as ResumeProfile)
        : await structureCvWithAi(rawCvText, file.name);

      // The upload API profile is now the canonical source of truth.
      // Do not immediately re-parse the same CV locally, because local fallback
      // can confuse skills/headlines/company names with candidate identity.
      setAiResumeProfile(profile);
      setAiCvStructuringStatus(data?.source === "ai_structured_cv" ? "ready" : "fallback");

      debugCvProfile("onboarding.upload.profile_selected", profile, {
        source: data?.source || "api_profile",
        fileName: file.name,
      });

      // IMPORTANT:
      // Onboarding must display the parser preview, not stale localStorage,
      // not a generated summary, and not the raw PDF text order.
      setManualCv(rawCvText);

      const canonicalSetup = buildCanonicalCvSetup({
        setup,
        rawCvText,
        jobDescription: jobDescription.trim(),
        role: role || profile.basics.headline || "General Role",
        market,
        companyStyle,
        recruiter: recruiter as RecruiterKey,
        language: interviewLanguage,
        profile,
      });

      saveCanonicalCvSetup(canonicalSetup, store);
      debugCvProfile("onboarding.upload.canonical_saved", canonicalSetup.resumeProfile, { setupId: canonicalSetup.setupId });

      // Keep the upload response as the single canonical CV profile.
      // Do not call buildAndSaveInterviewSetup here; it makes a second /api/cv JSON request
      // and can create confusing stale-parser logs after a successful upload.
      // Recruiter memory is still built from the saved canonical setup when the interview starts.
      setStep(2);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not read this CV. Paste the CV text manually for now.";

      setUploadError(message);
    } finally {
      setUploading(false);
    }
  }

  function next() {
    persistFast(Math.min(5, step + 1));
  }

  function back() {
    setStep(Math.max(1, step - 1));
  }

  function startInterview() {
    persistFast();
    router.push("/interview");
  }

  return (
    <main className="wz-mobile-no-animation wz-mobile-bottom-safe min-h-screen overflow-x-hidden overflow-y-auto bg-[#020712] pb-[calc(env(safe-area-inset-bottom)+120px)] text-white">
      <style jsx global>{`
        @keyframes wzPulseBar {
          0%,
          100% {
            transform: scaleY(0.72);
            opacity: 0.72;
          }
          50% {
            transform: scaleY(1.12);
            opacity: 1;
          }
        }

        @keyframes wzGlow {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.7;
          }
          50% {
            transform: scale(1.08);
            opacity: 1;
          }
        }

        @keyframes wzScan {
          0% {
            transform: translateY(-70%);
            opacity: 0;
          }
          15% {
            opacity: 0.75;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: translateY(420%);
            opacity: 0;
          }
        }

        @keyframes wzFloat {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }

        @keyframes wzDotPulse {
          0%,
          100% {
            opacity: 0.45;
            transform: scale(0.86);
          }
          50% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes wzStatusSlide {
          0%,
          20% {
            transform: translateY(0);
          }
          25%,
          45% {
            transform: translateY(-1.5rem);
          }
          50%,
          70% {
            transform: translateY(-3rem);
          }
          75%,
          95% {
            transform: translateY(-4.5rem);
          }
          100% {
            transform: translateY(0);
          }
        }
      `}</style>

      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-220px] top-[-180px] h-[520px] w-[520px] rounded-full bg-blue-600/10 blur-[125px]" />
        <div className="absolute right-[-180px] top-[-160px] h-[560px] w-[560px] rounded-full bg-cyan-400/08 blur-[135px]" />
        <div className="absolute bottom-[-260px] left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-indigo-600/08 blur-[135px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1480px] flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+8rem)] pt-3 sm:px-5 xl:pb-8">
        <header className="flex min-h-[60px] shrink-0 items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 sm:px-5 shadow-[0_18px_80px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
          <Link
            href="/"
            className="flex items-center gap-3 text-slate-200 transition hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="font-black">Onboarding</span>
          </Link>

          <div className="hidden items-center gap-3 md:flex">
            {steps.map((item, index) => {
              const complete = step > item.id;
              const active = step === item.id;

              return (
                <div key={item.id} className="flex items-center gap-3">
                  <button
                    onClick={() => persistFast(item.id)}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full border text-sm font-black transition",
                      complete &&
                        "border-emerald-400/35 bg-emerald-400/12 text-emerald-200",
                      active &&
                        "border-blue-300 bg-blue-500 text-white shadow-[0_0_22px_rgba(59,130,246,0.30)]",
                      !complete &&
                        !active &&
                        "border-white/10 bg-white/8 text-slate-300",
                    )}
                  >
                    {complete ? <Check className="h-4 w-4" /> : item.id}
                  </button>
                  <span
                    className={cn(
                      "text-sm",
                      active ? "text-white" : "text-slate-400",
                    )}
                  >
                    {item.label}
                  </span>
                  {index !== steps.length - 1 && (
                    <span className="h-px w-12 bg-white/12" />
                  )}
                </div>
              );
            })}
          </div>

          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold text-slate-200 transition hover:bg-white/10"
          >
            <Image
              src="/workzo_icon.png"
              alt="WorkZo"
              width={22}
              height={22}
              className="rounded-md"
            />
            WorkZo AI
          </Link>
        </header>

        <PrivacyNotice compact className="mt-3 hidden xl:block" />

        <div className="mt-3 rounded-2xl border border-amber-300/15 bg-amber-500/[0.07] px-4 py-3 text-sm leading-6 text-amber-50/90 shadow-[0_14px_40px_rgba(0,0,0,0.16)] xl:hidden">
          <p className="font-black">⚠️ Practice notice</p>
          <p className="mt-1 text-amber-100/80">
            WorkZo AI is improving continuously. Use outputs as interview
            practice guidance and validate important feedback before real
            applications.
          </p>
        </div>

        <section className="grid flex-1 items-start gap-4 overflow-visible py-3 xl:grid-cols-[1fr_0.68fr]">
          <div className="flex flex-col overflow-visible rounded-[22px] border border-white/10 bg-white/[0.032] shadow-[0_18px_60px_rgba(0,0,0,0.24)] backdrop-blur-2xl xl:rounded-[26px]">
            <div className="flex-1 overflow-visible p-4 pb-28 xl:p-5">
              {step === 1 && (
                <div className="flex min-h-[520px] flex-col">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/18 text-blue-200">
                      <Upload className="h-6 w-6" />
                    </div>
                    <div>
                      <h1 className="text-3xl font-black tracking-tight">
                        Upload your CV
                      </h1>
                      <p className="mt-1 text-sm text-slate-400">
                        WorkZo reads your real experience before asking questions.
                      </p>
                    </div>
                  </div>

                  {/* Previous CV detected — give the user an explicit choice instead of
                      silently showing a possibly-stale extracted profile. */}
                  {restoredCvText.trim() && !restoredCvDismissed && !manualCv && !useRestoredCv && (
                    <div className="mt-4 flex shrink-0 flex-col gap-3 rounded-3xl border border-blue-300/20 bg-blue-500/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-500/15 text-blue-200">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-white">CV from a previous session found</p>
                          <p className="mt-0.5 text-xs leading-5 text-slate-400">
                            Reuse it to skip re-uploading, or start fresh with a new CV.
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => setUseRestoredCv(true)}
                          className="rounded-xl bg-blue-500 px-4 py-2 text-xs font-black text-white hover:bg-blue-400"
                        >
                          Use this CV
                        </button>
                        <button
                          type="button"
                          onClick={() => setRestoredCvDismissed(true)}
                          className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-black text-slate-300 hover:bg-white/[0.08]"
                        >
                          Start fresh
                        </button>
                      </div>
                    </div>
                  )}

                  <label className="mt-4 flex h-[138px] shrink-0 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-blue-300/30 bg-blue-500/8 p-5 text-center transition hover:bg-blue-500/12">
                    <Upload className="h-8 w-8 text-blue-200" />
                    <p className="mt-3 text-lg font-black">
                      {uploading ? "Reading your CV…" : "Click to upload your CV"}
                    </p>
                    <p className="mt-1.5 text-sm text-slate-400">
                      PDF, DOCX, or TXT. Manual paste is available below.
                    </p>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      onChange={handleCvUpload}
                      className="hidden"
                    />
                  </label>

                  {fileName && (
                    <div className="mt-3 flex shrink-0 items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-red-300" />
                        <div>
                          <p className="text-sm font-bold">{fileName}</p>
                          <p className="text-xs text-slate-500">
                            {manualCv
                              ? "CV text ready"
                              : "Waiting for readable text"}
                          </p>
                        </div>
                      </div>
                      {manualCv && (
                        <Check className="h-5 w-5 text-emerald-300" />
                      )}
                    </div>
                  )}

                  {uploadError && (
                    <div className="mt-3 shrink-0 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-3 text-sm leading-6 text-amber-100">
                      {uploadError}
                    </div>
                  )}

                  {aiCvStructuringStatus !== "idle" && (
                    <div className="mt-3 rounded-2xl border border-blue-300/15 bg-blue-500/8 px-4 py-3 text-xs font-bold leading-5 text-blue-100">
                      {aiCvStructuringStatus === "structuring"
                        ? "Reading and structuring your CV…"
                        : aiCvStructuringStatus === "ready"
                          ? "CV profile ready. Review the extracted details below."
                          : "CV parsed using local extraction. Review the details below."}
                    </div>
                  )}

                  <ResumeProfileReview profile={resumeProfile} />

                  <details className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <summary className="cursor-pointer text-sm font-black text-slate-200">
                      Paste or edit CV text manually
                    </summary>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Use this if the upload missed something important.
                    </p>
                    <textarea
                      value={effectiveCvText}
                      onChange={(event) => {
                        const nextCv = event.target.value;
                        setManualCv(nextCv);
                        setAiResumeProfile(null);
                        setAiCvStructuringStatus("idle");

                        const rawCvText = normalizeResumeText(nextCv);
                        if (!rawCvText.trim()) return;

                        const profile = pickCanonicalResumeProfile({
      aiProfile: aiResumeProfile,
      setupProfile: setup.resumeProfile,
      rawCvText,
    });
                        const canonicalSetup = buildCanonicalCvSetup({
                          setup,
                          rawCvText,
                          jobDescription: jobDescription.trim(),
                          role:
                            role || profile.basics.headline || "General Role",
                          market,
                          companyStyle,
                          recruiter: recruiter as RecruiterKey,
                          language: interviewLanguage,
                          profile,
                        });

                        saveCanonicalCvSetup(canonicalSetup, store);
                      }}
                      placeholder="Or paste your CV text here..."
                      className="mt-3 h-[220px] w-full resize-none overflow-y-auto rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_20%_0%,rgba(59,130,246,0.10),transparent_34%),#050b16] p-5 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-blue-400/50"
                    />
                  </details>
                </div>
              )}

              {step === 2 && (
                <div className="flex min-h-[360px] flex-col">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/16 text-cyan-200">
                      <Briefcase className="h-6 w-6" />
                    </div>
                    <div>
                      <h1 className="text-3xl font-black tracking-tight">
                        Choose your target role
                      </h1>
                      <p className="mt-1 text-sm text-slate-400">
                        Questions adapt to the role and job description.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 shrink-0">
                    <label className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">
                      Target role
                    </label>
                    <input
                      value={role}
                      onChange={(event) => setRole(event.target.value)}
                      placeholder="Example: Customer Success Manager"
                      className="mt-3 h-14 w-full rounded-3xl border border-white/10 bg-[#050b16] px-5 text-lg font-bold text-white outline-none placeholder:text-slate-600 focus:border-blue-400/50"
                    />

                    <label className="mt-5 block text-xs font-black uppercase tracking-[0.28em] text-slate-500">
                      Target company optional
                    </label>
                    <input
                      value={companyName}
                      onChange={(event) => setCompanyName(event.target.value)}
                      placeholder="Example: Google, Siemens, Shopify, Startup"
                      className="mt-3 h-14 w-full rounded-3xl border border-white/10 bg-[#050b16] px-5 text-lg font-bold text-white outline-none placeholder:text-slate-600 focus:border-blue-400/50"
                    />
                  </div>

                  <div className="mt-5 min-h-0 flex-1">
                    <label className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">
                      Job description
                    </label>
                    <textarea
                      value={jobDescription}
                      onChange={(event) =>
                        setJobDescription(event.target.value)
                      }
                      placeholder="Paste the job description here so the recruiter can ask job-specific follow-ups..."
                      className="mt-3 h-[calc(100%-32px)] w-full resize-none rounded-3xl border border-white/10 bg-[#050b16] p-5 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-blue-400/50"
                    />
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="flex min-h-[560px] flex-col xl:h-full xl:min-h-0">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/14 text-indigo-200">
                      <Globe2 className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300/80">
                        One decision at a time
                      </p>
                      <h1 className="mt-1 text-3xl font-black tracking-tight">
                        Choose interview style
                      </h1>
                      <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
                        Pick the market, company style, and recruiter
                        personality. WorkZo will adapt the interview behavior
                        quietly in the background.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <section className="rounded-[26px] border border-white/10 bg-black/18 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.26em] text-slate-500">
                        Target market
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {markets.map((item) => (
                          <button
                            key={item.label}
                            onClick={() => setMarket(item.label)}
                            className={cn(
                              "rounded-2xl border px-3 py-3 text-sm font-black transition active:scale-[0.98]",
                              market === item.label
                                ? "border-cyan-300/40 bg-cyan-400/14 text-white shadow-[0_0_24px_rgba(14,165,233,0.16)]"
                                : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.07]",
                            )}
                          >
                            <span className="mr-2">{item.flag}</span>
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className="rounded-[26px] border border-white/10 bg-black/18 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.26em] text-slate-500">
                        Company style
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-2">
                        {companyStyles.map((item) => (
                          <button
                            key={item}
                            onClick={() => setCompanyStyle(item)}
                            className={cn(
                              "rounded-2xl border px-3 py-3 text-sm font-black transition active:scale-[0.98]",
                              companyStyle === item
                                ? "border-violet-300/40 bg-violet-400/14 text-white shadow-[0_0_24px_rgba(139,92,246,0.16)]"
                                : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.07]",
                            )}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    </section>
                  </div>


                  <section className="mt-4 rounded-[26px] border border-white/10 bg-black/18 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.26em] text-slate-500">
                          Interview language
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          Choose the language the recruiter should use during the interview.
                        </p>
                      </div>
                      <span className="hidden rounded-full border border-blue-300/15 bg-blue-400/8 px-3 py-1.5 text-xs font-black text-blue-200 sm:inline-flex">
                        {interviewLanguage}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                      {interviewLanguages.map((item) => (
                        <button
                          key={item.label}
                          onClick={() => setInterviewLanguage(item.label)}
                          className={cn(
                            "rounded-2xl border px-3 py-3 text-left transition active:scale-[0.98]",
                            interviewLanguage === item.label
                              ? "border-blue-300/45 bg-blue-400/14 text-white shadow-[0_0_24px_rgba(59,130,246,0.16)]"
                              : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.07]",
                          )}
                        >
                          <span className="block text-sm font-black">{item.nativeLabel}</span>
                          <span className="mt-1 block text-[11px] leading-4 text-slate-500">{item.hint}</span>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="mt-4 min-h-0 flex-1 rounded-[26px] border border-white/10 bg-black/18 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.26em] text-slate-500">
                          Recruiter personality
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          Choose the interview energy. You can change this
                          later.
                        </p>
                      </div>
                      <span className="hidden rounded-full border border-cyan-300/15 bg-cyan-400/8 px-3 py-1.5 text-xs font-black text-cyan-200 sm:inline-flex">
                        {recruiterLabel(recruiter)}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {recruiters.map((item) => (
                        <button
                          key={item.key}
                          onClick={() => setRecruiter(item.key)}
                          className={cn(
                            "relative rounded-[24px] border p-4 text-left transition active:scale-[0.99]",
                            recruiter === item.key
                              ? "border-cyan-300/45 bg-cyan-400/10 shadow-[0_0_30px_rgba(34,211,238,0.14)]"
                              : "border-white/10 bg-white/[0.035] hover:bg-white/[0.06]",
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/8 text-lg">
                              {item.avatar}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <h3 className="text-base font-black leading-5">
                                  {item.name}
                                </h3>
                                {recruiter === item.key && (
                                  <span className="rounded-full bg-cyan-300/14 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">
                                    Selected
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 text-xs font-bold text-slate-400">
                                {item.role}
                              </p>
                              <p className="mt-2 text-sm leading-5 text-slate-300">
                                {item.description}
                              </p>
                              <p className="mt-3 border-l border-cyan-300/20 pl-3 text-xs italic leading-5 text-slate-400">
                                “{item.quote}”
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Premium Pro Personas */}
                    <div className="mt-5">
                      <div className="mb-3 flex items-center gap-3">
                        <div className="h-px flex-1 bg-white/[0.07]" />
                        <span className="rounded-full border border-violet-300/20 bg-violet-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-violet-200">
                          Premium Pro personas
                        </span>
                        <div className="h-px flex-1 bg-white/[0.07]" />
                      </div>
                      {!isProUser && (
                        <p className="mb-3 text-xs leading-5 text-slate-500">
                          These high-pressure personas are exclusive to Premium Pro.
                        </p>
                      )}
                      <div className="grid gap-3 md:grid-cols-2">
                        {proRecruiters.map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            disabled={!isProUser}
                            onClick={() => { if (isProUser) setRecruiter(item.key); }}
                            className={cn(
                              "relative rounded-[24px] border p-4 text-left transition",
                              !isProUser
                                ? "cursor-not-allowed border-white/[0.05] bg-white/[0.01] opacity-50"
                                : recruiter === item.key
                                ? "border-violet-300/45 bg-violet-500/10 shadow-[0_0_30px_rgba(139,92,246,0.14)]"
                                : "border-white/10 bg-white/[0.035] hover:bg-white/[0.06] active:scale-[0.99]",
                            )}
                          >
                            {!isProUser && (
                              <div className="absolute right-3 top-3 rounded-full border border-violet-300/20 bg-violet-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-violet-300">
                                Pro
                              </div>
                            )}
                            <div className="flex items-start gap-3">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-lg">
                                {item.avatar}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <h3 className="text-base font-black leading-5">{item.name}</h3>
                                  {recruiter === item.key && isProUser && (
                                    <span className="rounded-full bg-violet-300/14 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-violet-200">Selected</span>
                                  )}
                                </div>
                                <p className="mt-0.5 text-xs font-bold text-slate-400">{item.role}</p>
                                <p className="mt-2 text-sm leading-5 text-slate-300">{item.description}</p>
                                <p className="mt-3 border-l border-violet-300/20 pl-3 text-xs italic leading-5 text-slate-400">"{item.quote}"</p>
                              </div>
                              <p className="mt-0.5 text-xs font-bold text-slate-400">
                                {item.role}
                              </p>
                              <p className="mt-2 text-sm leading-5 text-slate-300">
                                {item.description}
                              </p>
                              <p className="mt-3 border-l border-cyan-300/20 pl-3 text-xs italic leading-5 text-slate-400">
                                “{item.quote}”
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                      {!isProUser && (
                        <a href="/pricing?plan=premium_pro&intent=personas" className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-violet-500 px-4 py-2.5 text-sm font-black text-white hover:bg-violet-400">
                          Unlock Premium Pro personas
                        </a>
                      )}
                    </div>
                  </section>
                </div>
              )}

              {step === 4 && (
                <div className="flex min-h-[360px] flex-col">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/16 text-emerald-200">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                    <div>
                      <h1 className="text-3xl font-black tracking-tight">
                        Preview your setup
                      </h1>
                      <p className="mt-1 text-sm text-slate-400">
                        Review your setup before entering the interview room.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        {
                          label: "CV Status",
                          value:
                            effectiveCvText ? "CV ready" : "Missing",
                          Icon: FileText,
                        },
                        {
                          label: "Target Role",
                          value: compactText(role, "General Role"),
                          Icon: Briefcase,
                        },
                        { label: "Market", value: market, Icon: Globe2 },
                        {
                          label: "Company Style",
                          value: companyStyle,
                          Icon: Building2,
                        },
                        {
                          label: "Recruiter",
                          value: recruiterLabel(recruiter),
                          Icon: UserRound,
                        },
                        {
                          label: "Interview Language",
                          value: interviewLanguage,
                          Icon: Globe2,
                        },

                      ] satisfies PreviewCard[]
                    ).map(({ label, value, Icon }) => (
                      <div
                        key={label}
                        className="rounded-3xl border border-white/10 bg-black/20 p-4"
                      >
                        <Icon className="h-5 w-5 text-blue-200" />
                        <p className="mt-3 text-xs font-black uppercase tracking-[0.24em] text-slate-500">
                          {label}
                        </p>
                        <p className="mt-2 text-lg font-black">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-3xl border border-blue-400/15 bg-blue-500/[0.06] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-200">
                          Company / role blueprint
                        </p>
                        <h3 className="mt-2 text-lg font-black text-white">
                          {companyName || "Target company"} · {role || "Target role"}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-slate-400">
                          WorkZo will pressure-test job-specific proof, company-fit signals, likely recruiter concerns, and role-relevant examples before moving into the interview room.
                        </p>
                      </div>
                      <Building2 className="h-5 w-5 shrink-0 text-blue-200" />
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {["Measurable impact", "Ownership proof", "Role-specific examples", "Pushback readiness"].map((item) => (
                        <div key={item} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold text-slate-300">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 rounded-3xl border border-white/10 bg-[#050b16] p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-slate-300">
                        Simulation readiness
                      </p>
                      <p className="text-sm font-black">{readiness}%</p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-300"
                        style={{ width: `${visualReadiness}%` }}
                      />
                    </div>
                    <p className="mt-4 text-sm leading-6 text-slate-400">
                      The recruiter will adapt to your CV, target role, market,
                      company style, selected personality, and interview language.
                    </p>
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="flex h-full flex-col justify-center">
                  <div className="mx-auto max-w-xl text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-r from-blue-500 to-cyan-400 shadow-[0_0_50px_rgba(14,165,233,0.28)]">
                      <Mic className="h-8 w-8" />
                    </div>
                    <h1 className="mt-6 text-4xl font-black tracking-tight">
                      Your interview room is ready
                    </h1>
                    <p className="mt-4 text-base leading-7 text-slate-400">
                      WorkZo will simulate a real recruiter using your CV, role,
                      target market, company style, selected language, pressure logic, and memory.
                    </p>

                    <button
                      onClick={() => void startInterview()}
                      className="mt-8 inline-flex h-14 items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-400 px-8 text-base font-black text-white shadow-[0_18px_45px_rgba(14,165,233,0.34)] transition hover:scale-[1.02]"
                    >
                      Start Interview
                      <ArrowRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex h-[54px] shrink-0 items-center justify-between border-t border-white/10 bg-gradient-to-r from-white/[0.02] via-blue-500/5 to-indigo-500/8 px-5 backdrop-blur-xl">
              <button
                onClick={back}
                disabled={step === 1}
                className="h-10 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 xl:h-11 xl:px-5"
              >
                Back
              </button>

              {step < 5 ? (
                <button
                  onClick={next}
                  className="inline-flex h-10 items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500 px-5 text-sm font-black text-white shadow-[0_10px_28px_rgba(37,99,235,0.26)] transition hover:scale-[1.02] xl:h-11 xl:px-6"
                >
                  Continue
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => {
                    persistFast();
                    router.push("/dashboard");
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-5 text-sm font-black text-slate-200 shadow-[0_10px_28px_rgba(15,23,42,0.24)] transition hover:bg-white/[0.08] hover:text-white xl:h-11 xl:px-6"
                  aria-label="Return to dashboard"
                >
                  Dashboard
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <aside className="hidden min-h-0 rounded-[26px] border border-white/10 bg-white/[0.028] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-2xl xl:block">
            <div className="relative flex min-h-[460px] flex-col overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#050b16] p-4">
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-1/2 top-20 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-500/10 blur-[95px]" />
                <div className="absolute bottom-[-120px] right-[-100px] h-72 w-72 rounded-full bg-cyan-400/8 blur-[95px]" />
              </div>

              <div className="relative z-10 flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/16 bg-cyan-400/7 px-3 py-1.5 text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
                    <Wand2 className="h-3.5 w-3.5" />
                    Guided setup
                  </div>
                  <h2 className="mt-4 max-w-sm text-2xl font-black leading-tight tracking-tight">
                    {guide.title}
                  </h2>
                  <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
                    {guide.description}
                  </p>
                </div>

                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055]">
                  <Image
                    src="/workzo_icon.png"
                    alt="WorkZo"
                    width={30}
                    height={30}
                    className="rounded-lg"
                  />
                </div>
              </div>

              <div className="relative z-10 mt-6 rounded-[26px] border border-white/[0.065] bg-black/16 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/12 text-blue-200">
                      <Radar className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">
                        Readiness
                      </p>
                      <p className="mt-1 text-2xl font-black">
                        {visualReadiness}%
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full border border-emerald-300/15 bg-emerald-400/8 px-3 py-1.5 text-xs font-black text-emerald-200">
                    Auto-saved
                  </span>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-300 to-emerald-300 transition-all duration-500"
                    style={{ width: `${readiness}%` }}
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {analysisSignals.slice(0, 4).map((signal, index) => {
                    const active =
                      index === 0 ||
                      readiness >= 50 ||
                      (readiness >= 25 && index < 3) ||
                      (readiness >= 75 && index < 4);

                    return (
                      <span
                        key={signal}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold",
                          active
                            ? "border-emerald-300/12 bg-emerald-400/8 text-emerald-100"
                            : "border-white/[0.06] bg-white/[0.03] text-slate-500",
                        )}
                      >
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            active ? "bg-emerald-300" : "bg-slate-600",
                          )}
                        />
                        {signal}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="relative z-10 mt-4 rounded-[26px] border border-white/[0.065] bg-white/[0.026] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-500/12 text-blue-200">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                      Setup summary
                    </p>
                    <p className="mt-1 text-sm font-black leading-6 text-white">
                      {guide.summary}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Current step: {currentStepLabel}
                    </p>
                  </div>
                </div>
              </div>

              <div className="relative z-10 mt-auto pt-3">
                <div className="flex items-start gap-3 rounded-[22px] border border-emerald-300/10 bg-emerald-400/[0.055] px-4 py-3 text-xs font-bold leading-5 text-emerald-100/90">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />
                  <span>
                    Your setup stays private and can be edited before the
                    interview.
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
