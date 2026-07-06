"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  FileText,
  Link2,
  Lock,
  Plus,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { ChangeEvent, useEffect, useId, useMemo, useRef, useState } from "react";

import { useInterviewStore } from "@/store/interviewStore";
import { buildAndSaveInterviewSetup, structureResumeProfileFromCv } from "@/lib/workzoCvClient";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import {
  saveCanonicalProfile,
  lockInterviewLanguage,
  clearCanonicalProfile,
} from "@/lib/workzoCanonicalProfile";
import {
  extractResumeProfileComplex,
  normalizeResumeText,
  type ResumeProfile,
} from "@/lib/workzoResumeParser";
import {
  saveLatestInterviewSetup,
  clearLatestInterviewSetup,
  readLatestInterviewSetup,
  type WorkZoInterviewSetup,
  type RecruiterMemoryProfile,
  type JobMemoryProfile,
} from "@/lib/workzoInterviewSetup";

import PrivacyNotice from "@/components/BetaPrivacyNotice";
import CvIdentityConfirm from "@/components/CvIdentityConfirm";
import { trackWorkZoLaunchEvent } from "@/lib/workzoLaunchAnalytics";
import { recordWorkZoCvUploaded } from "@/lib/workzoUsageTracker";
import { useWorkZoAuthoritativePlan } from "@/lib/workzoClientPlan";
import { debugCvPipeline, debugCvProfile, debugCvText } from "@/lib/workzoCvPipelineDebug";
import { buildWorkZoCompanyBlueprint } from "@/lib/workzoCompanyBlueprint";
import { recommendRecruiters, type RecruiterRecommendation } from "@/lib/recruiterRecommendation";

type Market = "Global" | "Germany" | "US" | "UK" | "India" | "Netherlands";
type CompanyStyle = "Realistic" | "Startup" | "Corporate" | "Technical" | "Consulting";
type RecruiterKey =
  | "friendly_hr" | "analytical_hiring_manager" | "startup_recruiter" | "german_corporate"
  | "faang_hiring_manager" | "startup_founder" | "consulting_partner" | "sales_director"
  | "product_leader" | "executive_recruiter" | "enterprise_recruiter";
type InterviewLanguage =
  | "English" | "German" | "Dutch" | "French" | "Spanish" | "Italian" | "Portuguese"
  | "Chinese" | "Hindi" | "Arabic" | "Japanese" | "Korean" | "Polish" | "Russian" | "Turkish";

type SetupState = WorkZoInterviewSetup & {
  // Keep onboarding's extra CV fields, but stay compatible with WorkZoInterviewSetup.
  rawCvText?: string;
  cvContextText?: string;
  resumeProfile?: ResumeProfile;
  recruiterMemoryProfile?: RecruiterMemoryProfile | null;
  jobMemoryProfile?: JobMemoryProfile | null;
};

const markets: { label: Market; flag: string }[] = [
  { label: "Global", flag: "🌍" }, { label: "Germany", flag: "🇩🇪" },
  { label: "US", flag: "🇺🇸" }, { label: "UK", flag: "🇬🇧" },
  { label: "India", flag: "🇮🇳" }, { label: "Netherlands", flag: "🇳🇱" },
];
const companyStyles: CompanyStyle[] = ["Realistic", "Startup", "Corporate", "Technical", "Consulting"];

const recruiters: { key: RecruiterKey; name: string; role: string; avatar: string; quote: string; description: string }[] = [
  { key: "friendly_hr", name: "Sarah", role: "Friendly HR", avatar: "👩🏻‍💼", quote: "I'd love to understand how you work with people.", description: "Warm, supportive, and communication-focused. Good for all experience levels." },
  { key: "analytical_hiring_manager", name: "Daniel", role: "Hiring Manager", avatar: "👨🏻‍💼", quote: "Can you prove the business impact behind that answer?", description: "Evidence-driven and focused on measurable impact." },
  { key: "startup_recruiter", name: "Priya", role: "Supportive Recruiter", avatar: "👩🏽‍💼", quote: "What did you learn from that experience, and how has it shaped how you work?", description: "Warm and growth-focused. Great for freshers, career changers, and first interviews." },
  { key: "german_corporate", name: "Markus", role: "Corporate Recruiter", avatar: "👨🏼‍💼", quote: "Please keep the answer concise and relevant.", description: "Structured, professional, and process-oriented." },
  { key: "faang_hiring_manager", name: "Alex Chen", role: "Technical Interviewer", avatar: "👨🏻‍💻", quote: "Walk me through the trade-off you made and how you measured success.", description: "Technical depth, system design, and code review. Includes a live code workspace. Ideal for engineers and coding bootcamp graduates." },
];

const proRecruiters: { key: RecruiterKey; name: string; role: string; avatar: string; quote: string; description: string }[] = [
  { key: "startup_founder", name: "Zoe Park", role: "Startup Founder", avatar: "👩🏻‍🚀", quote: "What broke, what did you own, and what would you do differently at 10x scale?", description: "Moves fast, hates buzzwords, rewards radical ownership. Expects you to talk about failure honestly." },
  { key: "consulting_partner", name: "James Harrington", role: "Consulting Partner", avatar: "👨🏻‍💼", quote: "Structure your answer. Situation, what was at stake, and your recommendation.", description: "Case-style pressure, frameworks, and structured delivery. Will redirect a rambling answer." },
  { key: "sales_director", name: "Noah Jones", role: "Sales Director", avatar: "👨🏾‍💼", quote: "Give me a number. Revenue impact, quota attainment, deal size: be specific.", description: "Numbers-first, commercial mindset. Will push you to quantify everything." },
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
  { label: "Chinese", nativeLabel: "中文", hint: "Mandarin Chinese interview practice" },
  { label: "Hindi", nativeLabel: "हिन्दी", hint: "Hindi interview practice" },
  { label: "Arabic", nativeLabel: "العربية", hint: "Arabic interview practice" },
  { label: "Japanese", nativeLabel: "日本語", hint: "Japanese interview practice" },
  { label: "Korean", nativeLabel: "한국어", hint: "Korean interview practice" },
  { label: "Polish", nativeLabel: "Polski", hint: "Polish interview practice" },
  { label: "Russian", nativeLabel: "Русский", hint: "Russian interview practice" },
  { label: "Turkish", nativeLabel: "Türkçe", hint: "Turkish interview practice" },
];

function normalizeInterviewLanguage(value?: unknown): InterviewLanguage {
  if (typeof value !== "string") return "English";
  const raw = value.trim().toLowerCase();
  if (raw.includes("german") || raw.includes("deutsch") || raw === "de") return "German";
  if (raw.includes("dutch") || raw.includes("nederlands") || raw === "nl") return "Dutch";
  if (raw.includes("french") || raw.includes("français") || raw === "fr") return "French";
  if (raw.includes("spanish") || raw.includes("español") || raw === "es") return "Spanish";
  if (raw.includes("italian") || raw.includes("italiano") || raw === "it") return "Italian";
  if (raw.includes("portuguese") || raw.includes("português") || raw.includes("portugues") || raw === "pt") return "Portuguese";
  if (raw.includes("chinese") || raw.includes("mandarin") || raw.includes("中文") || raw === "zh" || raw === "zh-cn" || raw === "zh-tw") return "Chinese";
  if (raw.includes("hindi") || raw.includes("हिन्दी") || raw.includes("हिंदी") || raw === "hi" || raw === "hi-in") return "Hindi";
  if (raw.includes("arabic") || raw.includes("العربية") || raw === "ar" || raw === "ar-sa") return "Arabic";
  if (raw.includes("japanese") || raw.includes("日本語") || raw === "ja" || raw === "ja-jp") return "Japanese";
  if (raw.includes("korean") || raw.includes("한국어") || raw === "ko" || raw === "ko-kr") return "Korean";
  if (raw.includes("polish") || raw.includes("polski") || raw === "pl" || raw === "pl-pl") return "Polish";
  if (raw.includes("russian") || raw.includes("русский") || raw === "ru" || raw === "ru-ru") return "Russian";
  if (raw.includes("turkish") || raw.includes("türkçe") || raw.includes("turkce") || raw === "tr" || raw === "tr-tr") return "Turkish";
  return "English";
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function recruiterLabel(key?: string) {
  const normalized = normalizeRecruiterKey(key);
  const r = recruiters.find((item) => item.key === normalized);
  return r ? `${r.name} · ${r.role}` : "Daniel · Hiring Manager";
}

function normalizeRecruiterKey(value?: unknown): RecruiterKey {
  if (typeof value !== "string") return "analytical_hiring_manager";
  const raw = value.trim().toLowerCase();
  const key = raw.replace(/·/g, " ").replace(/-/g, "_").replace(/\s+/g, "_");
  if (key === "friendly_hr" || raw.includes("sarah")) return "friendly_hr";
  if (key === "analytical_hiring_manager" || raw.includes("daniel")) return "analytical_hiring_manager";
  if (key === "startup_recruiter" || raw.includes("priya")) return "startup_recruiter";
  if (key === "german_corporate" || key === "corporate_recruiter" || raw.includes("markus")) return "german_corporate";
  if (key === "faang_hiring_manager" || raw.includes("faang")) return "faang_hiring_manager";
  if (key === "startup_founder" || (raw.includes("founder") && !raw.includes("startup_recruiter"))) return "startup_founder";
  if (key === "consulting_partner" || raw.includes("harrington")) return "consulting_partner";
  if (key === "sales_director" || raw.includes("marcus webb") || raw.includes("noah jones")) return "sales_director";
  if (key === "product_leader" || raw.includes("aisha")) return "product_leader";
  if (key === "executive_recruiter" || raw.includes("victoria stern")) return "executive_recruiter";
  if (key === "enterprise_recruiter" || raw.includes("kimura")) return "enterprise_recruiter";
  return "analytical_hiring_manager";
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
    setSetup?: (s: SetupState) => void;
    updateSetup?: (s: SetupState) => void;
    saveSetup?: (s: SetupState) => void;
    setInterviewSetup?: (s: SetupState) => void;
  };
  if (typeof storeAny.setSetup === "function") storeAny.setSetup(normalizedSetup);
  else if (typeof storeAny.updateSetup === "function") storeAny.updateSetup(normalizedSetup);
  else if (typeof storeAny.saveSetup === "function") storeAny.saveSetup(normalizedSetup);
  else if (typeof storeAny.setInterviewSetup === "function") storeAny.setInterviewSetup(normalizedSetup);
  else useInterviewStore.setState({ setup: normalizedSetup } as never);
  try {
    const s = JSON.stringify(normalizedSetup);
    window.localStorage.setItem("workzo-interview-setup-v4", s);
    window.localStorage.setItem("workzo-latest-interview-setup", s);
    window.localStorage.setItem("workzo-interview-setup-latest", s);
    window.localStorage.setItem("workzoInterviewSetup", s);
    window.localStorage.setItem("latestInterviewSetup", s);
    window.localStorage.setItem("onboardingSetup", s);
    window.localStorage.removeItem("workzo-interview-setup-v3");
    window.localStorage.removeItem("workzo-interview-setup-v2");
    window.localStorage.removeItem("workzo-interview-setup");
    window.localStorage.removeItem("workzo_setup");
    window.localStorage.removeItem("workzo-onboarding");
    window.localStorage.removeItem("workzo_onboarding");
  } catch { /* localStorage may be blocked */ }
}


type StoredCanonicalProfile = {
  profile?: ResumeProfile | null;
  rawCvText?: string;
  fileName?: string;
};

/**
 * Local safe loader for the canonical CV profile.
 *
 * Important:
 * - This file already writes canonical profile through saveCanonicalProfile().
 * - persistFast() runs as a plain function, so it cannot depend on React state.
 * - Do not assume lib/workzoCanonicalProfile exports loadCanonicalProfile in every build.
 * - Read storage defensively and never throw during Start Interview.
 */
function loadCanonicalProfile(): StoredCanonicalProfile | null {
  if (typeof window === "undefined") return null;

  const storageKeys = [
    "workzo-canonical-profile",
    "workzoCanonicalProfile",
    "workzo-cv-canonical-profile",
    "workzo_latest_cv_profile",
    "workzo-latest-cv-profile",
  ];

  for (const key of storageKeys) {
    try {
      const raw = window.sessionStorage.getItem(key) || window.localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw) as StoredCanonicalProfile | ResumeProfile | null;
      if (!parsed || typeof parsed !== "object") continue;

      if ("profile" in parsed && parsed.profile && typeof parsed.profile === "object") {
        return parsed as StoredCanonicalProfile;
      }

      if ("basics" in parsed) {
        return { profile: parsed as ResumeProfile };
      }
    } catch {
      // Ignore malformed/stale storage and try the next key.
    }
  }

  return null;
}

function buildInterviewCvContext(profile: ResumeProfile, fallbackRawText: string) {
  const lines: string[] = [];
  const basics = profile.basics || {};
  if (basics.name?.trim()) lines.push(`Candidate name: ${basics.name.trim()}`);
  if (basics.headline?.trim()) lines.push(`Headline: ${basics.headline.trim()}`);
  const contact = [basics.email, basics.phone, basics.location, basics.linkedin].filter(Boolean).join(" • ");
  if (contact) lines.push(`Contact: ${contact}`);
  if (profile.summary?.trim()) lines.push(`Summary: ${profile.summary.trim()}`);
  if (profile.experience?.length) {
    lines.push("Experience:");
    profile.experience.slice(0, 6).forEach((item) => {
      const title = [item.title, item.company, item.dates].filter(Boolean).join(" • ");
      if (title) lines.push(`- ${title}`);
      item.bullets?.slice(0, 4).forEach((b) => lines.push(`  • ${b}`));
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
    profile.projects.slice(0, 4).forEach((p) => {
      if (p.name) lines.push(`- ${p.name}`);
      p.bullets?.slice(0, 3).forEach((b) => lines.push(`  • ${b}`));
    });
  }
  if (profile.languages?.length) lines.push(`Languages: ${profile.languages.slice(0, 8).join(", ")}`);
  if (profile.certifications?.length) lines.push(`Certifications: ${profile.certifications.slice(0, 8).join(", ")}`);
  return lines.join("\n").trim() || fallbackRawText;
}

function buildCanonicalCvSetup(input: {
  setup: SetupState; rawCvText: string; jobDescription: string;
  role: string; market: string; companyStyle: string;
  recruiter: RecruiterKey; language: string; profile?: ResumeProfile | null;
}) {
  const profile = input.profile || extractResumeProfileComplex(input.rawCvText);
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
    // Keep raw CV fields raw. Do NOT save buildInterviewCvContext() into cvText/resumeText/candidateCv.
    // That derived summary is only for prompts/display; when it is sent back to /api/cv,
    // it creates the parsing degradation loop seen in production logs.
    cvText: input.rawCvText,
    uploadedCvText: input.rawCvText,
    resumeText: input.rawCvText,
    candidateCv: input.rawCvText,
    rawCvText: input.rawCvText,
    cvContextText: buildInterviewCvContext(profile, input.rawCvText),
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
    setupVersion: 10,
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

function saveCanonicalCvSetup(setup: SetupState, store: unknown) {
  debugCvProfile("onboarding.saveCanonicalCvSetup.before", setup.resumeProfile, {
    setupId: setup.setupId, source: setup.source,
    cvChars: typeof setup.cvText === "string" ? setup.cvText.length : 0,
  });
  saveSetupToStore(setup, store);
  const saved = saveLatestInterviewSetup(setup as Parameters<typeof saveLatestInterviewSetup>[0]);
  debugCvProfile("onboarding.saveCanonicalCvSetup.after", saved.resumeProfile, {
    setupId: saved.setupId, source: saved.source,
    cvChars: typeof saved.cvText === "string" ? saved.cvText.length : 0,
  });
}

type PersonaItem = (typeof recruiters)[number];

function PersonaCard({ persona, selected, locked, pro, recommended, onClick }: {
  persona: PersonaItem; selected: boolean; locked?: boolean; pro?: boolean; recommended?: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative rounded-2xl border p-3.5 text-left transition",
        locked
          ? "cursor-not-allowed border-line bg-fg/[0.02] opacity-50 hover:opacity-70 hover:border-brand/20 hover:bg-brand/[0.05]"
          : selected
            ? pro
              ? "border-brand bg-brand/20 shadow-[0_0_0_2px_rgba(37,99,235,0.5)] ring-2 ring-brand/40"
              : "border-brand bg-brand/20 shadow-[0_0_0_2px_rgba(37,99,235,0.5)] ring-2 ring-brand/40"
            : "border-line bg-fg/[0.035] hover:bg-fg/[0.06] active:scale-[0.99]",
      )}
    >
      {pro && locked && (
        <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full border border-brand bg-brand px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-white">
          <Lock className="h-2.5 w-2.5" />Pro
        </span>
      )}
      {recommended && !selected && (
        <span className={cn(
          "absolute right-2.5 inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-400",
          pro && locked ? "top-9" : "top-2.5",
        )}>
          <Sparkles className="h-2.5 w-2.5" />Best match
        </span>
      )}
      {selected && !locked && (
        <span className={cn("absolute right-2.5 top-2.5 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em]",
          pro ? "bg-brand/15 text-muted" : "bg-brand/15 text-muted")}>
          Selected
        </span>
      )}
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-fg/[0.07] text-base">{persona.avatar}</span>
        <div className="min-w-0">
          <p className="truncate text-sm font-black leading-4 text-fg">{persona.name}</p>
          <p className="mt-0.5 truncate text-[11px] font-bold text-muted">{persona.role}</p>
        </div>
      </div>
      <p className="mt-2.5 text-xs leading-4 text-muted">{persona.description}</p>
    </button>
  );
}

function ProPersonaDropdown({ open, onToggle, isProUser, recruiter, onSelect, nudgeKey, onLockedClick, recommendedKey }: {
  open: boolean; onToggle: () => void; isProUser: boolean; recruiter: RecruiterKey;
  onSelect: (key: RecruiterKey) => void; nudgeKey: number; onLockedClick: () => void;
  recommendedKey?: RecruiterKey | null;
}) {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-brand/15 bg-brand/[0.05]">
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
        className="flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-3 text-left transition hover:bg-brand/[0.08]"
      >
        <Lock className="h-4 w-4 shrink-0 text-brand" />
        <span className="text-sm font-black text-muted">Premium Pro personas</span>
        <span className="rounded-full border border-brand/25 bg-brand/15 px-2 py-0.5 text-[10px] font-black text-muted">{proRecruiters.length}</span>
        <span className="hidden text-xs text-subtle sm:inline">High-pressure interviewers for senior prep</span>
        {!isProUser && (
          <Link
            key={nudgeKey}
            href="/pricing?plan=premium_pro&intent=personas"
            onClick={(e) => e.stopPropagation()}
            className={cn("ml-auto shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs font-black text-on-brand transition hover:bg-brand",
              nudgeKey > 0 && "animate-[wzNudge_0.45s_ease-in-out_2]")}
          >
            Unlock
          </Link>
        )}
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform duration-200",
          !isProUser ? "" : "ml-auto", open && "rotate-180")} />
      </div>
      {open && (
        <div className="border-t border-brand/10 p-3">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {proRecruiters.map((item) => (
              <PersonaCard
                key={item.key}
                persona={item}
                pro
                locked={!isProUser}
                selected={recruiter === item.key}
                recommended={recommendedKey === item.key}
                onClick={() => { if (isProUser) onSelect(item.key); else onLockedClick(); }}
              />
            ))}
          </div>
          {!isProUser && (
            <p className="mt-3 text-center text-xs font-bold text-muted">
              These personas are visible to everyone, but interviewing with them requires{" "}
              <span className="text-brand">Premium Pro</span>.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const readinessChecklist: { key: "cv" | "jd" | "role" | "style"; label: string }[] = [
  { key: "cv", label: "CV uploaded" },
  { key: "jd", label: "Job description" },
  { key: "role", label: "Target role" },
  { key: "style", label: "Interview style" },
];

function readinessHint(readiness: number) {
  if (readiness >= 100) return "Fully personalised. The recruiter knows your story.";
  if (readiness >= 75) return "Almost there: one more detail sharpens the questions.";
  if (readiness >= 50) return "Good base. Add more context for sharper follow-ups.";
  return "Add your CV to unlock a personal interview.";
}

function ReadinessRail({ readiness, checks, summaryLine, onStart, hideCta, onChecklistClick }: {
  readiness: number;
  checks: Record<"cv" | "jd" | "role" | "style", boolean>;
  summaryLine: string;
  onStart: () => void;
  hideCta?: boolean;
  onChecklistClick?: (key: "cv" | "jd" | "role" | "style") => void;
}) {
  const gradientId = useId().replace(/:/g, "");
  const circumference = 251.3;
  const dashOffset = circumference - (circumference * readiness) / 100;

  return (
    <div className="rounded-[22px] border border-line bg-fg/[0.028] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
      <div className="relative overflow-hidden rounded-[18px] border border-line bg-canvas-soft p-4">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-[-60px] h-48 w-48 -translate-x-1/2 rounded-full bg-brand/10 blur-[70px]" />
        </div>
        <div className="relative flex items-center gap-4">
          <div className="relative h-[88px] w-[88px] shrink-0">
            <svg viewBox="0 0 96 96" className="h-full w-full -rotate-90">
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="60%" stopColor="#22d3ee" />
                  <stop offset="100%" stopColor="#34d399" />
                </linearGradient>
              </defs>
              <circle cx="48" cy="48" r="40" fill="none" strokeWidth="7" className="stroke-white/[0.08]" />
              <circle cx="48" cy="48" r="40" fill="none" strokeWidth="7" strokeLinecap="round"
                stroke={`url(#${gradientId})`} strokeDasharray={circumference}
                strokeDashoffset={dashOffset} className="transition-all duration-500" />
            </svg>
            <span className="absolute inset-0 grid place-items-center text-xl font-black">{readiness}%</span>
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted">Readiness</p>
            <p className="mt-1 text-sm font-bold leading-5 text-muted">{readinessHint(readiness)}</p>
          </div>
        </div>
        <div className="relative mt-4 space-y-1.5">
          {readinessChecklist.map((item) => {
            const done = checks[item.key];
            const hints: Record<string, string> = {
              cv: "Upload your CV for personalised questions",
              jd: "Paste the job description",
              role: "Enter the role you are applying for",
              style: "Pick a recruiter and interview style",
            };
            const canClick = !done && onChecklistClick;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => canClick && onChecklistClick(item.key)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm text-left transition",
                  canClick ? "cursor-pointer hover:bg-fg/[0.05]" : "cursor-default",
                )}
              >
                <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full border transition",
                  done ? "border-success/40 bg-success/15 text-success" : "border-line text-muted")}>
                  {done && <Check className="h-3 w-3" strokeWidth={3.5} />}
                </span>
                <span className="min-w-0">
                  <span className={cn("block font-bold", done ? "text-fg" : "text-muted")}>{item.label}</span>
                  {!done && <span className="block text-[11px] text-muted">{hints[item.key]}</span>}
                </span>
                {canClick && <span className="ml-auto shrink-0 text-[10px] font-black uppercase tracking-wider text-muted">Add →</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-3 rounded-[18px] border border-line bg-canvas-soft p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-muted">Your interview</p>
            <p className="mt-1.5 text-sm font-black leading-6 text-fg">{summaryLine}</p>
          </div>
        </div>
      </div>
      {/* Prepare with Work-O-Bot: shown before Start Interview */}
      {!hideCta && (
        <div className="mt-3 rounded-xl border border-brand/15 bg-brand/[0.06] px-3 py-2.5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted">
            Before you start
          </p>
          <p className="mt-1 text-[11px] leading-4 text-muted">
            Not sure what to expect? Ask Work-O-Bot about likely questions, how to frame your experience, or how to handle tough topics.
          </p>
          <a
            href="/copilot"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-black text-brand hover:text-brand"
          >
            Open Work-O-Bot →
          </a>
        </div>
      )}

      {!hideCta && (
        <button
          type="button"
          onClick={onStart}
          className="mt-3 flex h-14 w-full items-center justify-center gap-2.5 rounded-lg bg-gradient-to-r from-brand via-brand to-brand text-base font-black text-on-brand shadow-[0_18px_45px_rgba(14,165,233,0.30)] transition hover:scale-[1.01] active:scale-[0.99]"
        >
          Start Interview
          <ArrowRight className="h-5 w-5" />
        </button>
      )}
      <p className="mt-2.5 flex items-center justify-center gap-1.5 text-center text-xs font-bold text-muted">
        <Lock className="h-3.5 w-3.5 text-success/80" />
        Private: you can edit everything before starting.
      </p>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const store = useInterviewStore() as unknown;
  const setup = getStoreSetup(store);

  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);
  const [uploading, setUploading] = useState(false);
  const uploadInFlightRef = useRef(false);
  // Guards cv_uploaded from firing more than once for the same upload. The
  // event used to only fire from persist() (called on navigating forward),
  // which meant: (1) a user who uploaded a CV and then abandoned the flow
  // before persist() ran was never counted at all, undercounting real
  // uploads, and (2) once handleCvUpload also tracks the event immediately
  // on parse success, persist()'s check would otherwise fire it AGAIN for
  // the same CV (it sets manualCv too), double-counting. This ref makes
  // whichever path completes first "win" and suppresses the other.
  const cvUploadTrackedRef = useRef(false);
  const [uploadError, setUploadError] = useState("");
  const [fileName, setFileName] = useState("");
  const [manualCv, setManualCv] = useState("");
  const [restoredCvText, setRestoredCvText] = useState(setup.cvText || "");
  const [restoredCvDismissed, setRestoredCvDismissed] = useState(false);
  const [useRestoredCv, setUseRestoredCv] = useState(false);

  const effectiveCvText = manualCv || (useRestoredCv ? restoredCvText : "");
  const [role, setRole] = useState(setup.targetRole || "");
  const [companyName, setCompanyName] = useState(String(setup.companyName || setup.targetCompany || ""));
  const [jobDescription, setJobDescription] = useState(setup.jobDescription || "");
  const [market, setMarket] = useState<Market>((setup.targetMarket as Market) || (setup.country as Market) || "Global");
  const [companyStyle, setCompanyStyle] = useState<CompanyStyle>((setup.companyStyle as CompanyStyle) || (setup.recruiterStyle as CompanyStyle) || "Realistic");
  const [recruiter, setRecruiter] = useState<RecruiterKey>(normalizeRecruiterKey(setup.recruiterPersonality));
  const planState = useWorkZoAuthoritativePlan();
  const isProUser = planState.plan === "premium_pro";
  const [interviewLanguage, setInterviewLanguage] = useState<InterviewLanguage>(normalizeInterviewLanguage(setup.language));
  const [aiResumeProfile, setAiResumeProfile] = useState<ResumeProfile | null>(null);
  const [aiCvStructuringStatus, setAiCvStructuringStatus] = useState<"idle" | "structuring" | "ready" | "fallback">("idle");
  // Identity confirmation gate: shown once after a real CV upload, before the
  // interview starts. Guarantees the recruiter never addresses a candidate by a
  // mis-parsed name/headline, for any CV layout.
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [showIdentityConfirm, setShowIdentityConfirm] = useState(false);

  const [contextModalOpen, setContextModalOpen] = useState(false);
  const [jdDraft, setJdDraft] = useState("");
  const [jobUrlInput, setJobUrlInput] = useState("");
  const [scrapingJobUrl, setScrapingJobUrl] = useState(false);
  const [jobUrlError, setJobUrlError] = useState("");
  const [proListOpen, setProListOpen] = useState(false);
  const [nudgeKey, setNudgeKey] = useState(0);
  const [persistRequest, setPersistRequest] = useState(0);
  const [persistFullRequest, setPersistFullRequest] = useState(0);

  const readiness = useMemo(() => {
    const cvReady = Boolean(effectiveCvText.trim());
    const roleReady = Boolean(role.trim());
    const preferencesReady = Boolean(market && companyStyle && recruiter && interviewLanguage);
    const jdBonus = Boolean(jobDescription.trim());
    return Math.min(100, [cvReady, roleReady, preferencesReady, jdBonus].filter(Boolean).length * 25);
  }, [effectiveCvText, role, market, companyStyle, recruiter, interviewLanguage, jobDescription]);

  const checks = {
    cv: Boolean(effectiveCvText.trim()),
    jd: Boolean(jobDescription.trim()),
    role: Boolean(role.trim()),
    style: true,
  };

  // Recruiter recommendation from CV + JD + target role. Deterministic and
  // local (no API call), recomputes as the user types/uploads. Suggestion
  // only: it badges cards and updates the hint line, but NEVER changes the
  // user's selected persona.
  const recruiterRecommendation: RecruiterRecommendation | null = useMemo(
    () => recommendRecruiters({ targetRole: role, jobDescription, cvText: effectiveCvText, market }),
    [role, jobDescription, effectiveCvText, market],
  );
  const recommendedFreeKey = recruiterRecommendation?.freeAlternative ?? null;
  const recommendedProKey =
    recruiterRecommendation && recruiterRecommendation.primaryIsPro ? recruiterRecommendation.primary : null;
  const recommendedPersona = recruiterRecommendation
    ? [...recruiters, ...proRecruiters].find((item) => item.key === recruiterRecommendation.primary) || null
    : null;

  const selectedPersona = [...recruiters, ...proRecruiters].find((item) => item.key === recruiter) || recruiters[1];
  const summaryLine = `${selectedPersona.name} · ${selectedPersona.role}: ${companyStyle} style, ${market} market, in ${interviewLanguage}${role.trim() ? `, for a ${role.trim()} role` : ""}.`;

  function buildDraftSetup(): SetupState {
    const cvText = effectiveCvText.trim();
    const jdText = jobDescription.trim();
    const draftBlueprint = buildWorkZoCompanyBlueprint({
      companyName: companyName || String(setup.companyName || setup.targetCompany || "Target company"),
      targetRole: role || setup.targetRole || "General Role",
      jobDescription: jdText, cvText, market, companyStyle,
    });
    return {
      ...setup, cvText, jobDescription: jdText,
      targetRole: role || setup.targetRole || "General Role",
      companyName: draftBlueprint.companyName, targetCompany: draftBlueprint.companyName,
      companyBlueprint: draftBlueprint, targetMarket: market, country: market,
      companyStyle, recruiterStyle: companyStyle,
      recruiterPersonality: normalizeRecruiterKey(recruiter),
      language: normalizeInterviewLanguage(interviewLanguage),
      source: setup.source || "mobile-fast-onboarding",
      setupVersion: 4, setupId: setup.setupId || `setup_${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
  }

  function enrichSetupInBackground(draft: SetupState) {
    const cvText = (draft.cvText || "").trim();
    const jdText = (draft.jobDescription || "").trim();
    if (!cvText && !jdText) return;
    window.setTimeout(() => {
      void buildAndSaveInterviewSetup({
        cvText, jobDescription: jdText,
        targetRole: draft.targetRole || "General Role",
        targetMarket: (draft.targetMarket as Market) || market,
        companyStyle: (draft.companyStyle as CompanyStyle) || companyStyle,
        recruiterPersonality: normalizeRecruiterKey(draft.recruiterPersonality),
        language: normalizeInterviewLanguage(draft.language) || interviewLanguage,
      }).then((nextSetup) => {
        const mergedSetup = {
          ...nextSetup, ...draft,
          recruiterMemoryProfile: nextSetup.recruiterMemoryProfile || draft.recruiterMemoryProfile,
          jobMemoryProfile: nextSetup.jobMemoryProfile || draft.jobMemoryProfile,
        } as SetupState;
        saveCanonicalCvSetup(mergedSetup, store);
      }).catch(() => { /* keep fast local setup */ });
    }, 40);
  }

  function persistFast() {
    const draft = buildDraftSetup();
    const rawCvText = normalizeResumeText(draft.cvText || effectiveCvText || "");
    // Use the AI-parsed profile saved to sessionStorage after /api/cv upload.
    // loadCanonicalProfile() is storage-based so it works inside persistFast
    // which is a plain function (not a React component) and cannot access state.
    const canonicalStored = loadCanonicalProfile();
    const profile = (canonicalStored?.profile ?? null) || extractResumeProfileComplex(rawCvText);
    const fastBlueprint = buildWorkZoCompanyBlueprint({
      companyName: companyName || String(draft.companyName || draft.targetCompany || "Target company"),
      targetRole: role || profile.basics.headline || "General Role",
      jobDescription: jobDescription.trim(), cvText: rawCvText, market, companyStyle,
    });
    const canonicalSetup = {
      ...draft,
      cvText: rawCvText,
      uploadedCvText: rawCvText,
      resumeText: rawCvText,
      candidateCv: rawCvText,
      rawCvText,
      cvContextText: buildInterviewCvContext(profile, rawCvText),
      previewText: profile.previewText, jobDescription: jobDescription.trim(),
      jdText: jobDescription.trim(),
      targetRole: role || profile.basics.headline || "General Role",
      role: role || profile.basics.headline || "General Role",
      companyName: fastBlueprint.companyName, targetCompany: fastBlueprint.companyName,
      companyBlueprint: fastBlueprint, targetMarket: market, country: market,
      candidateName: profile.basics.name, candidateHeadline: profile.basics.headline,
      candidateEmail: profile.basics.email, candidatePhone: profile.basics.phone,
      candidateLocation: profile.basics.location, candidateLinkedin: profile.basics.linkedin,
      resumeProfile: profile, setupVersion: 7, updatedAt: new Date().toISOString(),
    } as SetupState;
    saveCanonicalCvSetup(canonicalSetup, store);
    enrichSetupInBackground(canonicalSetup);
  }

  useEffect(() => {
    // Partner-org capture: a partner shares a coded signup link
    // (e.g. /onboarding?org=SPRING26). We persist that code so every interview
    // this learner runs is tagged to the organization for the admin dashboard.
    try {
      const p = new URLSearchParams(window.location.search);
      const code = (p.get("org") || p.get("partner") || p.get("cohort") || "").trim().slice(0, 60);
      if (code) window.localStorage.setItem("workzo_org_code", code);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    createSupabaseBrowserClient().auth.getUser().then(({ data }) => {
      setIsSignedIn(Boolean(data.user?.email));
    }).catch(() => setIsSignedIn(false));
  }, []);

  useEffect(() => {
    const restored = readLatestInterviewSetup() as SetupState | null;
    if (!restored) return;
    setRestoredCvText((prev) => prev || String(restored.cvText || ""));
    setRole((prev) => prev || String(restored.targetRole || ""));
    setCompanyName((prev) => prev || String(restored.companyName || restored.targetCompany || ""));
    setJobDescription((prev) => prev || String(restored.jobDescription || ""));
    const restoredMarket = (restored.targetMarket || restored.country) as Market | undefined;
    if (restoredMarket) setMarket((prev) => (prev === "Global" ? restoredMarket : prev));
    const restoredStyle = (restored.companyStyle || restored.recruiterStyle) as CompanyStyle | undefined;
    if (restoredStyle) setCompanyStyle((prev) => (prev === "Realistic" ? restoredStyle : prev));
    if (restored.recruiterPersonality) {
      const r = normalizeRecruiterKey(restored.recruiterPersonality);
      setRecruiter((prev) => (prev === "analytical_hiring_manager" ? r : prev));
    }
    if (restored.language) {
      const lang = normalizeInterviewLanguage(restored.language);
      setInterviewLanguage((prev) => (prev === "English" ? lang : prev));
    }
  }, []);

  useEffect(() => {
    trackWorkZoLaunchEvent({ event: "onboarding_viewed", role, market, recruiter: recruiterLabel(recruiter) });
  }, [market, recruiter, role]);

  async function persist() {
    const cvText = effectiveCvText.trim();
    const jdText = jobDescription.trim();
    if (cvText && !cvUploadTrackedRef.current) {
      cvUploadTrackedRef.current = true;
      trackWorkZoLaunchEvent({ event: "cv_uploaded", role, market, recruiter: recruiterLabel(recruiter) });
      recordWorkZoCvUploaded({ role, market }); // also sends to usage_events (works on localhost)
    }
    if (jdText) trackWorkZoLaunchEvent({ event: "jd_added", role, market, recruiter: recruiterLabel(recruiter) });
    const rawCvText = normalizeResumeText(cvText);
    const canonicalSetup = rawCvText
      ? buildCanonicalCvSetup({ setup, rawCvText, jobDescription: jdText, role: role || "General Role", market, companyStyle, recruiter, language: interviewLanguage })
      : ({ ...setup, cvText: "", jobDescription: jdText, jdText, targetRole: role || "General Role", targetMarket: market, country: market, companyStyle, recruiterStyle: companyStyle, recruiterPersonality: normalizeRecruiterKey(recruiter), updatedAt: new Date().toISOString() } as SetupState);
    let nextSetup: SetupState;
    if (cvText.length > 0 || jdText.length > 0) {
      const memorySetup = (await buildAndSaveInterviewSetup({
        cvText: rawCvText || cvText,
        jobDescription: jdText,
        targetRole: role || "General Role",
        targetMarket: market,
        companyStyle,
        recruiterPersonality: normalizeRecruiterKey(recruiter),
        candidateName: canonicalSetup.candidateName || "",
        language: interviewLanguage,
        resumeProfile: canonicalSetup.resumeProfile,
        baseSetup: canonicalSetup,
      })) as SetupState;
      nextSetup = { ...memorySetup, ...canonicalSetup, recruiterMemoryProfile: memorySetup.recruiterMemoryProfile || canonicalSetup.recruiterMemoryProfile, jobMemoryProfile: memorySetup.jobMemoryProfile || canonicalSetup.jobMemoryProfile } as SetupState;
    } else {
      nextSetup = canonicalSetup;
    }
    saveCanonicalCvSetup(nextSetup, store);
  }

  async function structureCvWithAi(rawCvText: string, uploadedFileName = "") {
    if (!rawCvText.trim()) return extractResumeProfileComplex(rawCvText);
    setAiCvStructuringStatus("structuring");
    try {
      const data = await structureResumeProfileFromCv({ cvText: rawCvText, jobDescription: jobDescription.trim(), targetRole: role || "General Role", targetMarket: market, fileName: uploadedFileName });
      const profile = data?.resumeProfile && typeof data.resumeProfile === "object" ? (data.resumeProfile as ResumeProfile) : extractResumeProfileComplex(rawCvText);
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
    if (uploadInFlightRef.current) return;
    uploadInFlightRef.current = true;
    cvUploadTrackedRef.current = false; // a new file selection is a new upload attempt
    setFileName(file.name);
    setUploading(true);
    setUploadError("");
    setIdentityConfirmed(false); // a fresh CV must be re-confirmed
    try {
      clearLatestInterviewSetup();
      clearCanonicalProfile(); // clear stale profile before re-upload
      const form = new FormData();
      form.append("file", file);
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 180000);
      const response = await fetch("/api/cv", {
        method: "POST",
        body: form,
        credentials: "include",
        signal: controller.signal,
      }).finally(() => window.clearTimeout(timeout));
      const data = await response.json().catch(() => null);
      if (response.status === 401) throw new Error("Please sign in to upload your CV.");
      if (!response.ok) throw new Error(data?.error === "Unauthorized" ? "Please sign in to upload your CV." : data?.error || "CV extraction failed");
      debugCvPipeline("onboarding.upload.api_response", { keys: data && typeof data === "object" ? Object.keys(data) : [], fileName: file.name, chars: data?.chars || null });
      const extracted = data?.text || data?.cvText || data?.content || data?.resumeText || data?.extractedText || "";
      if (!String(extracted).trim()) throw new Error("PDF uploaded, but no readable CV text was found. Paste the CV text manually.");
      const rawCvText = normalizeResumeText(String(extracted));
      debugCvText("onboarding.upload.cleaned_text", rawCvText, { fileName: file.name });
      const apiProfile = data?.resumeProfile || data?.profile;
      const apiProfileIsUsable = apiProfile && typeof apiProfile === "object" && "basics" in apiProfile;
      const profile = apiProfileIsUsable
        ? (apiProfile as ResumeProfile)
        : await structureCvWithAi(rawCvText, file.name);
      setAiResumeProfile(profile);
      setAiCvStructuringStatus(apiProfileIsUsable ? "ready" : "fallback");
      debugCvProfile("onboarding.upload.profile_selected", profile, { source: apiProfileIsUsable ? data?.source || "api_cv_profile" : "structure_fallback_profile", fileName: file.name });

      // ── Canonical profile storage (spec §2) ──────────────────────────────
      // Store the structured profile and raw text once. All downstream pages
      // (Improve CV, Cover Letter, Interview) read from these sessionStorage
      // keys instead of re-parsing. rawCvText is never the derived summary.
      saveCanonicalProfile(profile, rawCvText, file.name);
      lockInterviewLanguage(interviewLanguage);
      // ─────────────────────────────────────────────────────────────────────

      // Track the upload here, at the moment it genuinely succeeds, rather
      // than only from persist() when the user reaches the next step. A user
      // who uploads successfully and then abandons the flow before clicking
      // Continue still had a real, successful upload; it should count.
      if (!cvUploadTrackedRef.current) {
        cvUploadTrackedRef.current = true;
        trackWorkZoLaunchEvent({ event: "cv_uploaded", role, market, recruiter: recruiterLabel(recruiter) });
        recordWorkZoCvUploaded({ role, market });
      }

      setManualCv(rawCvText);
      const canonicalSetup = buildCanonicalCvSetup({ setup, rawCvText, jobDescription: jobDescription.trim(), role: role || profile.basics.headline || "General Role", market, companyStyle, recruiter: recruiter as RecruiterKey, language: interviewLanguage, profile });
      saveCanonicalCvSetup(canonicalSetup, store);
      debugCvProfile("onboarding.upload.canonical_saved", canonicalSetup.resumeProfile, { setupId: canonicalSetup.setupId });
      void buildAndSaveInterviewSetup({
        cvText: rawCvText,
        jobDescription: jobDescription.trim(),
        targetRole: role || profile.basics.headline || "General Role",
        targetMarket: market,
        companyStyle,
        recruiterPersonality: normalizeRecruiterKey(recruiter),
        fileName: file.name,
        candidateName: profile.basics?.name || "",
        language: interviewLanguage,
        resumeProfile: profile,
        baseSetup: canonicalSetup,
      })
        .then((nextSetup) => {
          const enrichedSetup = {
            ...(nextSetup as SetupState),
            ...canonicalSetup,
            cvText: rawCvText,
            uploadedCvText: rawCvText,
            resumeText: rawCvText,
            candidateCv: rawCvText,
            rawCvText,
            cvContextText: buildInterviewCvContext(profile, rawCvText),
            previewText: profile.previewText,
            resumeProfile: profile,
            candidateName: profile.basics?.name || canonicalSetup.candidateName || "",
            language: interviewLanguage,
            updatedAt: new Date().toISOString(),
          } as SetupState;
          debugCvProfile("onboarding.upload.enriched_before_save", enrichedSetup.resumeProfile, { note: "Raw CV fields preserved; resumeProfile remains canonical." });
          saveCanonicalCvSetup(enrichedSetup, store);
        })
        .catch(() => { /* keep canonical */ });
    } catch (error) {
      const rawMsg = error instanceof Error ? error.message : "";

      // Suppress abort/cancel errors: these happen when the request times out
      // or the user navigates away. They are not actionable by the user.
      const isAbortError =
        error instanceof Error && (
          error.name === "AbortError" ||
          rawMsg.toLowerCase().includes("aborted") ||
          rawMsg.toLowerCase().includes("abort") ||
          rawMsg.toLowerCase().includes("cancel")
        );
      if (isAbortError) {
        // Resilient CV upload behavior: do not blame the candidate or ask for a
        // re-upload when a slow parser/browser abort happens. Keep the modal
        // usable and move the user straight to manual paste as the fallback.
        setContextModalOpen(true);
        setUploadError(
          "Automatic CV reading did not finish. Paste the CV text below and you can continue without uploading again.",
        );
        return;
      }

      const friendlyMsg = rawMsg === "Unauthorized" || rawMsg === "Please sign in to upload your CV."
        ? "Please sign in to upload your CV."
        : rawMsg || "Automatic CV reading did not finish. Paste the CV text below and you can continue without uploading again.";
      if (friendlyMsg !== "Please sign in to upload your CV.") setContextModalOpen(true);
      setUploadError(friendlyMsg);
    } finally {
      uploadInFlightRef.current = false;
      setUploading(false);
      if (event.target) event.target.value = "";
    }
  }

  function launchInterview() { persistFast(); router.push("/interview"); }

  function startInterview() {
    // Global reliability gate: never start an interview on an unverified
    // identity. Only gates real uploaded profiles — manual-paste users (no
    // structured profile) proceed unchanged.
    if (aiResumeProfile && !identityConfirmed) {
      setShowIdentityConfirm(true);
      return;
    }
    launchInterview();
  }

  function handleIdentityConfirmed(edited: { name: string; headline: string }) {
    setShowIdentityConfirm(false);
    setIdentityConfirmed(true);

    const base = aiResumeProfile;
    if (base) {
      const correctedProfile = {
        ...base,
        basics: {
          ...(base.basics || {}),
          name: edited.name || base.basics?.name || "",
          headline: edited.headline || base.basics?.headline || "",
        },
      } as ResumeProfile;
      setAiResumeProfile(correctedProfile);

      // Re-write the canonical profile + setup so every downstream page
      // (interview, cover letter, results) reads the confirmed identity.
      try {
        saveCanonicalProfile(correctedProfile, manualCv, fileName);
        const correctedSetup = buildCanonicalCvSetup({
          setup,
          rawCvText: manualCv,
          jobDescription: jobDescription.trim(),
          role: role || correctedProfile.basics.headline || "General Role",
          market,
          companyStyle,
          recruiter: recruiter as RecruiterKey,
          language: interviewLanguage,
          profile: correctedProfile,
        });
        saveCanonicalCvSetup(correctedSetup, store);
        debugCvProfile("onboarding.identity_confirmed", correctedProfile, { fileName });
      } catch {
        /* proceed even if re-save fails; interview still has prior canonical */
      }
    }

    launchInterview();
  }

  function requestPersist() { setPersistRequest((c) => c + 1); }

  useEffect(() => { if (persistRequest > 0) persistFast(); }, [persistRequest]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (persistFullRequest > 0) void persist(); }, [persistFullRequest]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!contextModalOpen) return;
    function onKeyDown(e: KeyboardEvent) { if (e.key === "Escape") setContextModalOpen(false); }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [contextModalOpen]);

  function openContextModal() { setJdDraft(jobDescription); setContextModalOpen(true); }
  function saveContextModal() { setJobDescription(jdDraft); setContextModalOpen(false); setPersistFullRequest((c) => c + 1); }

  async function fetchJobFromUrl() {
    const url = jobUrlInput.trim();
    if (!url || scrapingJobUrl) return;
    setScrapingJobUrl(true);
    setJobUrlError("");
    try {
      const res = await fetch("/api/company-scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setJobUrlError(data?.error || "Could not read that page. Try pasting the job description text instead.");
        return;
      }
      if (data.jobDescription) {
        setJdDraft(data.jobDescription);
      }
      // Only fill role/company if the candidate hasn't already typed something -
      // never overwrite a field they've deliberately set.
      if (data.jobTitle && !role.trim()) setRole(data.jobTitle);
      if (data.companyName && !companyName.trim()) setCompanyName(data.companyName);
      setJobUrlInput("");
    } catch {
      setJobUrlError("Network error while reading that page. Try pasting the job description text instead.");
    } finally {
      setScrapingJobUrl(false);
    }
  }

  const hasContext = checks.cv || checks.jd;
  const showRestoredBanner = Boolean(restoredCvText.trim()) && !restoredCvDismissed && !manualCv && !useRestoredCv;

  return (
    <main className="wz-mobile-no-animation wz-mobile-bottom-safe min-h-screen overflow-x-hidden overflow-y-auto bg-canvas pb-[calc(env(safe-area-inset-bottom)+110px)] text-fg xl:pb-8">
      <style jsx global>{`
        @keyframes wzDotPulse { 0%,100%{opacity:.45;transform:scale(.86)}50%{opacity:1;transform:scale(1)} }
        @keyframes wzNudge { 0%,100%{transform:scale(1);box-shadow:none}50%{transform:scale(1.08);box-shadow:0 0 24px rgba(37, 99, 235,.5)} }
        @keyframes wzModalIn { from{opacity:0;transform:translateY(18px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)} }
      `}</style>

      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-220px] top-[-180px] h-[520px] w-[520px] rounded-full bg-brand/10 blur-[125px]" />
        <div className="absolute right-[-180px] top-[-160px] h-[560px] w-[560px] rounded-full bg-brand/08 blur-[135px]" />
        <div className="absolute bottom-[-260px] left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-brand/08 blur-[135px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1480px] flex-col px-4 pt-3 sm:px-5">
        <header className="flex min-h-[58px] shrink-0 items-center justify-between gap-3 rounded-lg border border-line bg-fg/[0.04] px-4 shadow-[0_18px_80px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:px-5">
          {/* Left: back arrow */}
          <Link href="/dashboard" className="flex items-center gap-2 text-muted transition hover:text-fg">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-bold">Back</span>
          </Link>

          {/* Right: auto-saved + dashboard button + logo */}
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 rounded-full border border-success/15 bg-success/[0.08] px-3 py-1.5 text-xs font-black text-success sm:inline-flex">
              <span className="h-2 w-2 rounded-full bg-success [animation:wzDotPulse_1.6s_ease-in-out_infinite]" />
              Auto-saved
            </span>
            <Link href="/dashboard" className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-line bg-fg/[0.04] px-3 py-2 text-sm font-black text-fg transition hover:bg-fg/10">
              Dashboard
            </Link>
            <Link href="/" className="flex items-center gap-2 rounded-xl border border-line bg-fg/[0.04] px-3 py-2 text-sm font-bold text-fg transition hover:bg-fg/10">
              <Image src="/workzo_icon.png" alt="WorkZo" width={22} height={22} className="rounded-md" />
              WorkZo AI
            </Link>
          </div>
        </header>

        <PrivacyNotice compact className="mt-3" />

        <section className="mt-4 grid flex-1 items-start gap-4 xl:grid-cols-[1fr_360px]">
          <div className="flex min-w-0 flex-col gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.26em] text-muted/80">Interview setup</p>
              <h1 className="mt-1.5 text-3xl font-black tracking-tight sm:text-4xl">Ready to practice?</h1>
              <p className="mt-1.5 text-sm leading-6 text-muted">Upload your CV, pick a role, and start. Works for freshers, career changers, and experienced professionals.</p>
            </div>

            {/* 1 · interview context */}
            <div className="rounded-[22px] border border-line bg-fg/[0.032] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.24)] backdrop-blur-2xl sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-black">Interview context</p>
                    <p className="text-xs text-muted">CV + job description make the recruiter ask about your real experience.</p>
                  </div>
                </div>
                <button type="button" onClick={openContextModal} className="inline-flex h-10 items-center gap-2 rounded-xl border border-brand/30 bg-brand/15 px-4 text-sm font-black text-brand transition hover:bg-brand/25">
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                  {hasContext ? "Edit CV & job description" : "Add CV & job description"}
                </button>
              </div>

              {showRestoredBanner && (
                <div className="mt-3 flex flex-col gap-3 rounded-lg border border-brand/20 bg-brand/[0.06] p-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand"><FileText className="h-4 w-4" /></div>
                    <div>
                      <p className="text-sm font-black text-fg">CV from a previous session found</p>
                      <p className="mt-0.5 text-xs leading-5 text-muted">Reuse it to skip re-uploading, or start fresh with a new CV.</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => { setUseRestoredCv(true); requestPersist(); }} className="rounded-xl bg-brand px-4 py-2 text-xs font-black text-on-brand hover:bg-brand">Use this CV</button>
                    <button type="button" onClick={() => setRestoredCvDismissed(true)} className="rounded-xl border border-line bg-fg/[0.04] px-4 py-2 text-xs font-black text-muted hover:bg-fg/[0.08]">Start fresh</button>
                  </div>
                </div>
              )}

              {(hasContext || uploading || aiCvStructuringStatus === "structuring") && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {(uploading || aiCvStructuringStatus === "structuring") && (
                    <span className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/[0.08] px-3 py-1.5 text-xs font-bold text-muted">
                      <span className="h-2 w-2 rounded-full bg-brand [animation:wzDotPulse_1.2s_ease-in-out_infinite]" />Reading your CV…
                    </span>
                  )}
                  {checks.cv && !uploading && (
                    <span className="inline-flex items-center gap-2 rounded-full border border-success/20 bg-success/[0.08] px-3 py-1.5 text-xs font-bold text-success">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      {fileName || (useRestoredCv ? "CV from previous session" : "CV added")}
                    </span>
                  )}
                  {checks.jd && (
                    <span className="inline-flex items-center gap-2 rounded-full border border-success/20 bg-success/[0.08] px-3 py-1.5 text-xs font-bold text-success">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />Job description added
                    </span>
                  )}
                </div>
              )}

              {uploadError && !contextModalOpen && (
                uploadError.includes("sign in") ? (
                  <div className="mt-3 rounded-lg border border-brand/20 bg-brand/10 p-4">
                    <p className="text-sm text-muted">Sign in to upload your CV and get a personalised interview.</p>
                    <a
                      href="/login"
                      className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-black text-on-brand transition hover:bg-brand"
                    >
                      Sign in
                    </a>
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg border border-warning/20 bg-warning/10 p-3 text-sm leading-6 text-warning">{uploadError}</div>
                )
              )}
            </div>

            {/* 2 · role + company */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div id="wz-section-role" className="rounded-[22px] border border-line bg-fg/[0.032] p-4 backdrop-blur-2xl">
                <label htmlFor="wz-target-role" className="text-[11px] font-black uppercase tracking-[0.24em] text-muted">Target role</label>
                <p className="mt-0.5 text-xs text-muted">The recruiter tailors every question to this role</p>
                <input id="wz-target-role" value={role} onChange={(e) => setRole(e.target.value)} onBlur={requestPersist} placeholder="e.g. Customer Success Manager" className="mt-2.5 h-12 w-full rounded-xl border border-line bg-canvas-soft px-4 text-[15px] font-bold text-fg outline-none placeholder:text-subtle focus:border-brand/50" />
              </div>
              <div className="rounded-[22px] border border-line bg-fg/[0.032] p-4 backdrop-blur-2xl">
                <label htmlFor="wz-target-company" className="text-[11px] font-black uppercase tracking-[0.24em] text-muted">Target company <span className="normal-case tracking-normal text-muted">· optional</span></label>
                <p className="mt-0.5 text-xs text-muted">Adds company-specific context to questions</p>
                <input id="wz-target-company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} onBlur={requestPersist} placeholder="e.g. Google, Siemens, a startup" className="mt-2.5 h-12 w-full rounded-xl border border-line bg-canvas-soft px-4 text-[15px] font-bold text-fg outline-none placeholder:text-subtle focus:border-brand/50" />
              </div>
            </div>

            {/* 3 · market / style / language */}
            <div className="rounded-[22px] border border-line bg-fg/[0.032] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.24)] backdrop-blur-2xl sm:p-5">
              <div className="grid gap-5 lg:grid-cols-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted">Market</p>
                  <p className="mt-0.5 text-[11px] text-muted">Sets interview norms for that region</p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {markets.map((item) => (
                      <button key={item.label} type="button" onClick={() => { setMarket(item.label); requestPersist(); }}
                        className={cn("rounded-xl border px-3 py-2 text-[13px] font-black transition active:scale-[0.97]",
                          market === item.label ? "border-blue-800 bg-blue-800 text-white font-black" : "border-line bg-fg/[0.04] text-muted hover:bg-fg/[0.08]")}>
                        <span className="mr-1.5">{item.flag}</span>{item.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div id="wz-section-style">
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted">Company style</p>
                  <p className="mt-0.5 text-[11px] text-muted">Sets the interview pressure and focus</p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {companyStyles.map((item) => (
                      <button key={item} type="button" onClick={() => { setCompanyStyle(item); requestPersist(); }}
                        className={cn("rounded-xl border px-3 py-2 text-[13px] font-black transition active:scale-[0.97]",
                          companyStyle === item ? "border-blue-800 bg-blue-800 text-white font-black" : "border-line bg-fg/[0.04] text-muted hover:bg-fg/[0.08]")}>
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted">Language</p>
                  <p className="mt-0.5 text-[11px] text-muted">The whole interview runs in this language</p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {interviewLanguages.map((item) => (
                      <button key={item.label} type="button" onClick={() => { setInterviewLanguage(item.label); requestPersist(); }}
                        className={cn("rounded-xl border px-3 py-2 text-[13px] font-black transition active:scale-[0.97]",
                          interviewLanguage === item.label ? "border-blue-800 bg-blue-800 text-white font-black" : "border-line bg-fg/[0.04] text-muted hover:bg-fg/[0.08]")}>
                        {item.nativeLabel}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 4 · recruiter */}
            <div className="rounded-[22px] border border-line bg-fg/[0.032] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.24)] backdrop-blur-2xl sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted">Recruiter personality</p>
                <span className="hidden rounded-full border border-brand/15 bg-brand/[0.08] px-3 py-1 text-xs font-black text-muted sm:inline-flex">
                  {selectedPersona.name} · {selectedPersona.role}
                </span>
              </div>
              {recruiterRecommendation && recommendedPersona ? (
                <p className="mt-1 text-[11px] text-muted">
                  Based on your {effectiveCvText.trim() ? "CV" : "target role"}{jobDescription.trim() ? " and job description" : ""}:{" "}
                  <span className="font-black text-emerald-400">{recommendedPersona.name} · {recommendedPersona.role}</span>
                  {" "}looks like the best fit — {recruiterRecommendation.reason}.
                  {!isProUser && recruiterRecommendation.primaryIsPro && recruiterRecommendation.freeAlternative !== recruiterRecommendation.primary && (
                    <> On your current plan, <span className="font-black text-fg">{(recruiters.find((r) => r.key === recruiterRecommendation.freeAlternative) || recruiters[1]).name}</span> is the closest match.</>
                  )}
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-muted">New to interviews? Start with Priya or Sarah: they focus on potential, not just experience.</p>
              )}
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {recruiters.map((item) => (
                  <PersonaCard key={item.key} persona={item} selected={recruiter === item.key}
                    recommended={recommendedFreeKey === item.key}
                    onClick={() => { setRecruiter(item.key); requestPersist(); }} />
                ))}
              </div>
              <ProPersonaDropdown open={proListOpen} onToggle={() => setProListOpen((o) => !o)}
                isProUser={isProUser} recruiter={recruiter}
                onSelect={(key) => { setRecruiter(key); requestPersist(); }}
                nudgeKey={nudgeKey} onLockedClick={() => setNudgeKey((k) => k + 1)}
                recommendedKey={recommendedProKey} />
            </div>

            {/* readiness rail mobile */}
            <div className="xl:hidden">
              <ReadinessRail readiness={readiness} checks={checks} summaryLine={summaryLine} onStart={startInterview} hideCta
              onChecklistClick={(key) => {
                if (key === "cv" || key === "jd") openContextModal();
                else if (key === "role") document.getElementById("wz-target-role")?.focus();
                else if (key === "style") document.getElementById("wz-section-style")?.scrollIntoView({ behavior: "smooth", block: "center" });
              }} />
            </div>
          </div>

          {/* right rail desktop */}
          <aside className="hidden xl:sticky xl:top-3 xl:block">
            <ReadinessRail readiness={readiness} checks={checks} summaryLine={summaryLine} onStart={startInterview}
          onChecklistClick={(key) => {
            if (key === "cv" || key === "jd") openContextModal();
            else if (key === "role") document.getElementById("wz-target-role")?.focus();
            else if (key === "style") document.getElementById("wz-section-style")?.scrollIntoView({ behavior: "smooth", block: "center" });
          }} />
          </aside>
        </section>
      </div>

      {/* mobile launch bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[rgba(5,8,22,0.94)] px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur-xl xl:hidden">
        <button type="button" onClick={startInterview}
          className="flex h-13 min-h-[52px] w-full items-center justify-center gap-2.5 rounded-lg bg-gradient-to-r from-brand via-brand to-brand text-base font-black text-on-brand shadow-[0_14px_36px_rgba(14,165,233,0.30)] transition active:scale-[0.99]">
          Start Interview <ArrowRight className="h-5 w-5" />
        </button>
      </div>

      {/* context modal */}
      {contextModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setContextModalOpen(false); }}>
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[26px] border border-line bg-canvas p-5 shadow-[0_40px_120px_rgba(0,0,0,0.6)] [animation:wzModalIn_0.28s_cubic-bezier(0.22,1,0.36,1)] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black tracking-tight">Personalise your interview</h2>
                <p className="mt-1 text-sm leading-5 text-muted">Your CV makes every question specific to your real experience. The job description focuses the recruiter on what that role actually needs.</p>
              </div>
              <button type="button" onClick={() => setContextModalOpen(false)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-fg/[0.04] text-muted transition hover:bg-fg/10 hover:text-fg" aria-label="Close">
                <X className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>

            {isSignedIn === false ? (
              <div className="mt-5 flex min-h-[108px] flex-col items-center justify-center rounded-lg border-[1.5px] border-dashed border-line bg-fg/[0.03] p-4 text-center">
                <Upload className="h-7 w-7 text-muted" />
                <span className="mt-2 block text-sm font-black text-muted">Upload your CV</span>
                <span className="mt-1 block text-xs text-muted">Requires an account</span>
                <a
                  href="/login"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-black text-on-brand transition hover:bg-brand"
                >
                  Sign in to upload
                </a>
              </div>
            ) : (
              <label className={cn("mt-5 flex min-h-[108px] cursor-pointer flex-col items-center justify-center rounded-lg border-[1.5px] p-4 text-center transition",
                manualCv && fileName ? "border-success/40 bg-success/[0.07]" : "border-dashed border-brand/35 bg-brand/[0.07] hover:bg-brand/[0.12]")}>
                <input type="file" accept=".pdf,.doc,.docx,.txt" onChange={handleCvUpload} className="hidden" />
                {uploading ? (
                  <><Upload className="h-7 w-7 text-brand" /><span className="mt-2 block text-sm font-black">Reading your CV…</span></>
                ) : manualCv && fileName ? (
                  <><Check className="h-7 w-7 text-success" strokeWidth={2.5} /><span className="mt-2 block text-sm font-black text-success">{fileName}</span><span className="mt-1 block text-xs text-muted">Click to replace</span></>
                ) : (
                  <><Upload className="h-7 w-7 text-brand" /><span className="mt-2 block text-sm font-black">Upload your CV</span><span className="mt-1 block text-xs text-muted">PDF, DOCX or TXT</span></>
                )}
              </label>
            )}

            {uploadError && (
              (uploadError.includes("sign in") ? (
                <div className="mt-3 rounded-lg border border-brand/20 bg-brand/10 p-4">
                  <p className="text-sm text-muted">Sign in to upload your CV and get a personalised interview.</p>
                  <a
                    href="/login"
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-black text-on-brand transition hover:bg-brand"
                  >
                    Sign in
                  </a>
                </div>
              ) : (
                <div className="mt-3 rounded-lg border border-warning/20 bg-warning/10 p-3 text-sm leading-6 text-warning">{uploadError}</div>
              ))
            )}

            {aiCvStructuringStatus !== "idle" && (
              <div className="mt-3 rounded-lg border border-brand/15 bg-brand/[0.08] px-4 py-3 text-xs font-bold leading-5 text-brand">
                {aiCvStructuringStatus === "structuring" ? "Reading and structuring your CV…"
                  : aiCvStructuringStatus === "ready" ? "CV ready. It will be used to personalise your interview."
                  : "CV parsed using local extraction. It will be used to personalise your interview."}
              </div>
            )}

            <details className="mt-3 rounded-lg border border-line bg-canvas-soft p-4">
              <summary className="cursor-pointer text-sm font-black text-fg">Paste or edit CV text manually</summary>
              <p className="mt-2 text-xs leading-5 text-muted">Use this if the upload missed something important.</p>
              <textarea
                value={effectiveCvText}
                onChange={(e) => {
                  const nextCv = e.target.value;
                  setManualCv(nextCv);
                  setAiResumeProfile(null);
                  setAiCvStructuringStatus("idle");
                  const rawCvText = normalizeResumeText(nextCv);
                  if (!rawCvText.trim()) return;
                  const profile = extractResumeProfileComplex(rawCvText);
                  const canonicalSetup = buildCanonicalCvSetup({ setup, rawCvText, jobDescription: jobDescription.trim(), role: role || profile.basics.headline || "General Role", market, companyStyle, recruiter: recruiter as RecruiterKey, language: interviewLanguage, profile });
                  saveCanonicalCvSetup(canonicalSetup, store);
                }}
                placeholder="Or paste your CV text here..."
                className="mt-3 h-[160px] w-full resize-none overflow-y-auto rounded-lg border border-line bg-canvas p-4 text-sm leading-6 text-fg outline-none placeholder:text-subtle focus:border-brand/50"
              />
            </details>

            <div className="mt-4">
              <label htmlFor="wz-jd-draft" className="text-[11px] font-black uppercase tracking-[0.24em] text-muted">Job description</label>

              <div className="mt-2 flex items-center gap-2">
                <div className="relative flex-1">
                  <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                  <input
                    type="text"
                    value={jobUrlInput}
                    onChange={(e) => setJobUrlInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void fetchJobFromUrl(); } }}
                    placeholder="Or paste a job posting or company URL to auto-fill…"
                    className="w-full rounded-lg border border-line bg-canvas-soft py-2.5 pl-9 pr-3 text-sm text-fg outline-none placeholder:text-subtle focus:border-brand/50"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void fetchJobFromUrl()}
                  disabled={scrapingJobUrl || !jobUrlInput.trim()}
                  className="h-[42px] shrink-0 rounded-lg bg-brand px-4 text-sm font-black text-on-brand transition hover:bg-brand disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {scrapingJobUrl ? "Reading…" : "Auto-fill"}
                </button>
              </div>
              {jobUrlError && <p className="mt-1.5 text-xs leading-5 text-warning">{jobUrlError}</p>}

              <textarea id="wz-jd-draft" value={jdDraft} onChange={(e) => setJdDraft(e.target.value)} rows={5}
                placeholder="Paste the job description here so the recruiter can ask job-specific follow-ups…"
                className="mt-2 w-full resize-none rounded-lg border border-line bg-canvas-soft p-4 text-sm leading-6 text-fg outline-none placeholder:text-subtle focus:border-brand/50" />
            </div>

            <div className="mt-4 flex items-center justify-end gap-2.5">
              <button type="button" onClick={() => setContextModalOpen(false)} className="h-11 rounded-xl border border-line bg-fg/[0.04] px-5 text-sm font-bold text-muted transition hover:bg-fg/10">Cancel</button>
              <button type="button" onClick={saveContextModal} className="h-11 rounded-xl bg-gradient-to-r from-brand via-brand to-brand px-6 text-sm font-black text-on-brand shadow-[0_10px_28px_rgba(37,99,235,0.26)] transition hover:scale-[1.02]">Save context</button>
            </div>
          </div>
        </div>
      )}

      <CvIdentityConfirm
        open={showIdentityConfirm}
        profile={aiResumeProfile}
        fileName={fileName}
        onConfirm={handleIdentityConfirmed}
        onCancel={() => setShowIdentityConfirm(false)}
      />
    </main>
  );
}
