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
import { buildAndSaveInterviewSetup } from "@/lib/workzoCvClient";

import BetaPrivacyNotice from "@/components/BetaPrivacyNotice";
import { trackWorkZoLaunchEvent } from "@/lib/workzoLaunchAnalytics";

type Market = "Global" | "Germany" | "US" | "UK" | "India" | "Netherlands";
type CompanyStyle = "Realistic" | "Startup" | "Corporate" | "Technical" | "Consulting";
type RecruiterKey =
  | "friendly_hr"
  | "analytical_hiring_manager"
  | "startup_recruiter"
  | "german_corporate";

type SetupState = {
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
const companyStyles: CompanyStyle[] = ["Realistic", "Startup", "Corporate", "Technical", "Consulting"];

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

const waveform = [
  8, 14, 22, 12, 18, 26, 14, 20, 11, 24, 16, 28, 12, 20, 15, 23, 10, 19,
  13, 26, 14, 18, 9, 22,
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
  return recruiter ? `${recruiter.name} · ${recruiter.role}` : "Daniel · Hiring Manager";
}

function normalizeRecruiterKey(value?: unknown): RecruiterKey {
  if (typeof value !== "string") return "analytical_hiring_manager";

  const raw = value.trim().toLowerCase();
  const key = raw.replace(/·/g, " ").replace(/-/g, "_").replace(/\s+/g, "_");

  if (key === "friendly_hr" || raw.includes("sarah")) return "friendly_hr";
  if (key === "analytical_hiring_manager" || raw.includes("daniel")) return "analytical_hiring_manager";
  if (key === "startup_recruiter" || raw.includes("priya")) return "startup_recruiter";
  if (
    key === "german_corporate" ||
    key === "corporate_recruiter" ||
    raw.includes("markus")
  ) {
    return "german_corporate";
  }

  return "analytical_hiring_manager";
}

function compactText(value?: string, fallback = "Missing") {
  const text = value?.trim();
  if (!text) return fallback;
  return text.length > 70 ? `${text.slice(0, 70)}...` : text;
}

function getStoreSetup(store: unknown): SetupState {
  const value = store as { setup?: SetupState; interviewSetup?: SetupState };
  return value?.setup || value?.interviewSetup || {};
}

function saveSetupToStore(nextSetup: SetupState, store: unknown) {
  const normalizedSetup: SetupState = {
    ...nextSetup,
    recruiterPersonality: normalizeRecruiterKey(nextSetup.recruiterPersonality),
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

    window.localStorage.setItem("workzo-interview-setup-v4", JSON.stringify(cleanSetup));
    window.localStorage.setItem("workzo-latest-interview-setup", JSON.stringify(cleanSetup));
    window.localStorage.setItem("workzo-interview-setup-latest", JSON.stringify(cleanSetup));
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

export default function OnboardingPage() {
  const router = useRouter();
  const store = useInterviewStore() as unknown;
  const setup = getStoreSetup(store);

  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [fileName, setFileName] = useState("");
  const [manualCv, setManualCv] = useState(setup.cvText || "");
  const [role, setRole] = useState(setup.targetRole || "");
  const [jobDescription, setJobDescription] = useState(setup.jobDescription || "");
  const [market, setMarket] = useState<Market>((setup.targetMarket as Market) || (setup.country as Market) || "Global");
  const [companyStyle, setCompanyStyle] = useState<CompanyStyle>((setup.companyStyle as CompanyStyle) || (setup.recruiterStyle as CompanyStyle) || "Realistic");
  const [recruiter, setRecruiter] = useState<RecruiterKey>(
    normalizeRecruiterKey(setup.recruiterPersonality)
  );

  const readiness = useMemo(() => {
    const cvReady = Boolean((manualCv || setup.cvText || "").trim());
    const roleReady = Boolean(role.trim());
    const preferencesReady = Boolean(market && companyStyle && recruiter);
    const jdBonus = Boolean(jobDescription.trim());
    return Math.min(100, [cvReady, roleReady, preferencesReady, jdBonus].filter(Boolean).length * 25);
  }, [manualCv, setup.cvText, role, market, companyStyle, recruiter, jobDescription]);

  const visualReadinessByStep: Record<number, number> = {
    1: 25,
    2: 50,
    3: 75,
    4: 90,
    5: 100,
  };

  const visualReadiness = Math.max(readiness, visualReadinessByStep[step] || readiness);

  const currentStepLabel = steps.find((item) => item.id === step)?.label || "Setup";

  const setupGuideContent: Record<number, { title: string; description: string; summary: string }> = {
    1: {
      title: "WorkZo is understanding your experience.",
      description: "Add your CV first. The recruiter will use your real background instead of asking generic practice questions.",
      summary: `Your CV context is being prepared for ${recruiterLabel(recruiter)}.`,
    },
    2: {
      title: "Interview questions are adapting to your role.",
      description: "Add a target role or job description so WorkZo can ask sharper, role-specific follow-ups.",
      summary: `You are shaping this interview around ${role.trim() || "your target role"}.`,
    },
    3: {
      title: "Recruiter behavior is being calibrated.",
      description: "Market, company style, and recruiter personality quietly shape the pressure, tone, and expectations.",
      summary: `You are choosing ${recruiterLabel(recruiter)} with a ${companyStyle.toLowerCase()} interview style.`,
    },
    4: {
      title: "Pressure and follow-up logic are prepared.",
      description: "Review the setup once. WorkZo will use this context to simulate a more realistic recruiter conversation.",
      summary: `You are preparing a realistic interview with ${recruiterLabel(recruiter)}.`,
    },
    5: {
      title: "Your interview runtime is ready.",
      description: "Start when ready. You can still return and edit your setup before practicing again.",
      summary: `Your interview room is ready with ${recruiterLabel(recruiter)}.`,
    },
  };

  const guide = setupGuideContent[step] || setupGuideContent[1];


  function buildDraftSetup(): SetupState {
    const cvText = (manualCv || setup.cvText || "").trim();
    const jdText = jobDescription.trim();

    return {
      ...setup,
      cvText,
      jobDescription: jdText,
      targetRole: role || setup.targetRole || "General Role",
      targetMarket: market,
      country: market,
      companyStyle,
      recruiterStyle: companyStyle,
      recruiterPersonality: normalizeRecruiterKey(recruiter),
      language: setup.language || "English",
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
        language: draft.language || setup.language || "English",
      })
        .then((nextSetup) => saveSetupToStore(nextSetup as SetupState, store))
        .catch(() => {
          // Keep the fast local setup. The interview can still start immediately.
        });
    }, 40);
  }

  function persistFast(nextStep?: number) {
    const draft = buildDraftSetup();
    saveSetupToStore(draft, store);
    if (nextStep) setStep(nextStep);
    enrichSetupInBackground(draft);
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
    const cvText = (manualCv || setup.cvText || "").trim();
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
    if (cvText.length > 0 || jdText.length > 0) {
      nextSetup = (await buildAndSaveInterviewSetup({
        cvText,
        jobDescription: jdText,
        targetRole: role || "General Role",
        targetMarket: market,
        companyStyle,
        recruiterPersonality: normalizeRecruiterKey(recruiter),
        language: setup.language || "English",
      })) as SetupState;
    } else {
      nextSetup = {
        ...setup,
        cvText: "",
        jobDescription: "",
        targetRole: role || "General Role",
        targetMarket: market,
        country: market,
        companyStyle,
        recruiterStyle: companyStyle,
        recruiterPersonality: normalizeRecruiterKey(recruiter),
        language: setup.language || "English",
      };
    }

    saveSetupToStore(nextSetup, store);

    if (nextStep) setStep(nextStep);
  }

  async function handleCvUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setUploading(true);
    setUploadError("");

    try {
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

      const extracted = data?.text || data?.cvText || data?.content || "";
      if (!extracted.trim()) {
        throw new Error("PDF uploaded, but no readable CV text was found. Paste the CV text manually.");
      }

      const cleanedExtracted = extracted.trim();
      setManualCv(cleanedExtracted);

      if (cleanedExtracted || jobDescription.trim()) {
        const nextSetup = await buildAndSaveInterviewSetup({
          cvText: cleanedExtracted,
          jobDescription: jobDescription.trim(),
          targetRole: role || "General Role",
          targetMarket: market,
          companyStyle,
          recruiterPersonality: normalizeRecruiterKey(recruiter),
          language: setup.language || "English",
        });

        saveSetupToStore(nextSetup as SetupState, store);
      } else {
        saveSetupToStore(
          {
            ...setup,
            cvText: "",
            jobDescription,
            targetRole: role || "General Role",
            targetMarket: market,
            country: market,
            companyStyle,
            recruiterStyle: companyStyle,
            recruiterPersonality: normalizeRecruiterKey(recruiter),
            language: setup.language || "English",
          },
          store
        );
      }
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
          0%, 100% { transform: scaleY(0.72); opacity: 0.72; }
          50% { transform: scaleY(1.12); opacity: 1; }
        }

        @keyframes wzGlow {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.08); opacity: 1; }
        }

        @keyframes wzScan {
          0% { transform: translateY(-70%); opacity: 0; }
          15% { opacity: .75; }
          50% { opacity: 1; }
          100% { transform: translateY(420%); opacity: 0; }
        }

        @keyframes wzFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }

        @keyframes wzDotPulse {
          0%, 100% { opacity: .45; transform: scale(.86); }
          50% { opacity: 1; transform: scale(1); }
        }

        @keyframes wzStatusSlide {
          0%, 20% { transform: translateY(0); }
          25%, 45% { transform: translateY(-1.5rem); }
          50%, 70% { transform: translateY(-3rem); }
          75%, 95% { transform: translateY(-4.5rem); }
          100% { transform: translateY(0); }
        }
      `}</style>

      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-220px] top-[-180px] h-[520px] w-[520px] rounded-full bg-blue-600/10 blur-[125px]" />
        <div className="absolute right-[-180px] top-[-160px] h-[560px] w-[560px] rounded-full bg-cyan-400/08 blur-[135px]" />
        <div className="absolute bottom-[-260px] left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-indigo-600/08 blur-[135px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1480px] flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+8rem)] pt-3 sm:px-5 xl:pb-8">
        <header className="flex min-h-[60px] shrink-0 items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 sm:px-5 shadow-[0_18px_80px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
          <Link href="/" className="flex items-center gap-3 text-slate-200 transition hover:text-white">
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
                      complete && "border-emerald-400/35 bg-emerald-400/12 text-emerald-200",
                      active && "border-blue-300 bg-blue-500 text-white shadow-[0_0_22px_rgba(59,130,246,0.30)]",
                      !complete && !active && "border-white/10 bg-white/8 text-slate-300"
                    )}
                  >
                    {complete ? <Check className="h-4 w-4" /> : item.id}
                  </button>
                  <span className={cn("text-sm", active ? "text-white" : "text-slate-400")}>{item.label}</span>
                  {index !== steps.length - 1 && <span className="h-px w-12 bg-white/12" />}
                </div>
              );
            })}
          </div>

          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold text-slate-200 transition hover:bg-white/10"
          >
            <Image src="/workzo_icon.png" alt="WorkZo" width={22} height={22} className="rounded-md" />
            WorkZo AI
          </Link>
        </header>

        <BetaPrivacyNotice compact className="mt-3 hidden xl:block" />

        <div className="mt-3 rounded-2xl border border-amber-300/15 bg-amber-500/[0.07] px-4 py-3 text-sm leading-6 text-amber-50/90 shadow-[0_14px_40px_rgba(0,0,0,0.16)] xl:hidden">
          <p className="font-black">⚠️ Beta notice</p>
          <p className="mt-1 text-amber-100/80">
            WorkZo AI is improving continuously. Use outputs as interview practice guidance and validate important feedback before real applications.
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
                      <h1 className="text-3xl font-black tracking-tight">Upload your CV</h1>
                      <p className="mt-1 text-sm text-slate-400">
                        WorkZo reads your real experience before asking questions.
                      </p>
                    </div>
                  </div>

                  <label className="mt-4 flex h-[138px] shrink-0 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-blue-300/30 bg-blue-500/8 p-5 text-center transition hover:bg-blue-500/12">
                    <Upload className="h-8 w-8 text-blue-200" />
                    <p className="mt-3 text-lg font-black">{uploading ? "Reading CV..." : "Choose CV file"}</p>
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
                            {manualCv ? "CV text ready" : "Waiting for readable text"}
                          </p>
                        </div>
                      </div>
                      {manualCv && <Check className="h-5 w-5 text-emerald-300" />}
                    </div>
                  )}

                  {uploadError && (
                    <div className="mt-3 shrink-0 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-3 text-sm leading-6 text-amber-100">
                      {uploadError}
                    </div>
                  )}

                  <textarea
                    value={manualCv}
                    onChange={(event) => setManualCv(event.target.value)}
                    placeholder="Or paste your CV text here..."
                    className="mt-3 h-[260px] min-h-[220px] shrink-0 resize-none overflow-y-auto rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_20%_0%,rgba(59,130,246,0.10),transparent_34%),#050b16] p-5 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-blue-400/50 xl:h-[300px]"
                  />
                </div>
              )}

              {step === 2 && (
                <div className="flex min-h-[360px] flex-col">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/16 text-cyan-200">
                      <Briefcase className="h-6 w-6" />
                    </div>
                    <div>
                      <h1 className="text-3xl font-black tracking-tight">Choose your target role</h1>
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
                  </div>

                  <div className="mt-5 min-h-0 flex-1">
                    <label className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">
                      Job description
                    </label>
                    <textarea
                      value={jobDescription}
                      onChange={(event) => setJobDescription(event.target.value)}
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
                      <h1 className="mt-1 text-3xl font-black tracking-tight">Choose interview style</h1>
                      <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
                        Pick the market, company style, and recruiter personality. WorkZo will adapt the interview behavior quietly in the background.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <section className="rounded-[26px] border border-white/10 bg-black/18 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.26em] text-slate-500">Target market</p>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {markets.map((item) => (
                          <button
                            key={item.label}
                            onClick={() => setMarket(item.label)}
                            className={cn(
                              "rounded-2xl border px-3 py-3 text-sm font-black transition active:scale-[0.98]",
                              market === item.label
                                ? "border-cyan-300/40 bg-cyan-400/14 text-white shadow-[0_0_24px_rgba(14,165,233,0.16)]"
                                : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.07]"
                            )}
                          >
                            <span className="mr-2">{item.flag}</span>
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className="rounded-[26px] border border-white/10 bg-black/18 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.26em] text-slate-500">Company style</p>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-2">
                        {companyStyles.map((item) => (
                          <button
                            key={item}
                            onClick={() => setCompanyStyle(item)}
                            className={cn(
                              "rounded-2xl border px-3 py-3 text-sm font-black transition active:scale-[0.98]",
                              companyStyle === item
                                ? "border-violet-300/40 bg-violet-400/14 text-white shadow-[0_0_24px_rgba(139,92,246,0.16)]"
                                : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.07]"
                            )}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    </section>
                  </div>

                  <section className="mt-4 min-h-0 flex-1 rounded-[26px] border border-white/10 bg-black/18 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.26em] text-slate-500">Recruiter personality</p>
                        <p className="mt-1 text-sm text-slate-400">Choose the interview energy. You can change this later.</p>
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
                              : "border-white/10 bg-white/[0.035] hover:bg-white/[0.06]"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/8 text-lg">
                              {item.avatar}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <h3 className="text-base font-black leading-5">{item.name}</h3>
                                {recruiter === item.key && (
                                  <span className="rounded-full bg-cyan-300/14 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">
                                    Selected
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 text-xs font-bold text-slate-400">{item.role}</p>
                              <p className="mt-2 text-sm leading-5 text-slate-300">{item.description}</p>
                              <p className="mt-3 border-l border-cyan-300/20 pl-3 text-xs italic leading-5 text-slate-400">
                                “{item.quote}”
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
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
                      <h1 className="text-3xl font-black tracking-tight">Preview your setup</h1>
                      <p className="mt-1 text-sm text-slate-400">
                        Check the recruiter context before entering the room.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        { label: "CV Status", value: manualCv || setup.cvText ? "CV ready" : "Missing", Icon: FileText },
                        { label: "Target Role", value: compactText(role, "General Role"), Icon: Briefcase },
                        { label: "Market", value: market, Icon: Globe2 },
                        { label: "Company Style", value: companyStyle, Icon: Building2 },
                        { label: "Recruiter", value: recruiterLabel(recruiter), Icon: UserRound },
                        { label: "Readiness", value: `${readiness}%`, Icon: Sparkles },
                      ] satisfies PreviewCard[]
                    ).map(({ label, value, Icon }) => (
                      <div key={label} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                        <Icon className="h-5 w-5 text-blue-200" />
                        <p className="mt-3 text-xs font-black uppercase tracking-[0.24em] text-slate-500">
                          {label}
                        </p>
                        <p className="mt-2 text-lg font-black">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-3xl border border-white/10 bg-[#050b16] p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-slate-300">Simulation readiness</p>
                      <p className="text-sm font-black">{readiness}%</p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-300"
                        style={{ width: `${visualReadiness}%` }}
                      />
                    </div>
                    <p className="mt-4 text-sm leading-6 text-slate-400">
                      The recruiter will adapt to your CV, target role, market, company style, and selected personality.
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
                    <h1 className="mt-6 text-4xl font-black tracking-tight">Your interview room is ready</h1>
                    <p className="mt-4 text-base leading-7 text-slate-400">
                      WorkZo will simulate a real recruiter using your CV, role, target market, company style, pressure logic, and memory.
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
                  onClick={() => { persistFast(); router.push("/dashboard"); }}
                  className="inline-flex h-10 items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500 px-5 text-sm font-black text-white shadow-[0_10px_28px_rgba(37,99,235,0.26)] transition hover:scale-[1.02] xl:h-11 xl:px-6"
                >
                  Go to Dashboard
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
                  <Image src="/workzo_icon.png" alt="WorkZo" width={30} height={30} className="rounded-lg" />
                </div>
              </div>

              <div className="relative z-10 mt-6 rounded-[26px] border border-white/[0.065] bg-black/16 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/12 text-blue-200">
                      <Radar className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Readiness</p>
                      <p className="mt-1 text-2xl font-black">{visualReadiness}%</p>
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
                    const active = index === 0 || readiness >= 50 || (readiness >= 25 && index < 3) || (readiness >= 75 && index < 4);

                    return (
                      <span
                        key={signal}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold",
                          active
                            ? "border-emerald-300/12 bg-emerald-400/8 text-emerald-100"
                            : "border-white/[0.06] bg-white/[0.03] text-slate-500"
                        )}
                      >
                        <span className={cn("h-2 w-2 rounded-full", active ? "bg-emerald-300" : "bg-slate-600")} />
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
                  <span>Your setup stays private and can be edited before the interview.</span>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
