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
import { ChangeEvent, useMemo, useState } from "react";

import { useInterviewStore } from "@/store/interviewStore";

type Market = "Global" | "Germany" | "US" | "UK" | "India" | "Netherlands";
type CompanyStyle = "Realistic" | "Startup" | "Corporate" | "Technical" | "Consulting";
type RecruiterKey =
  | "friendly_hr"
  | "analytical_hiring_manager"
  | "startup_recruiter"
  | "corporate_recruiter";

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
};

const steps = [
  { id: 1, label: "Upload CV" },
  { id: 2, label: "Job Role" },
  { id: 3, label: "Preferences" },
  { id: 4, label: "Preview" },
  { id: 5, label: "Start" },
];

const markets: Market[] = ["Global", "Germany", "US", "UK", "India", "Netherlands"];
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
    key: "corporate_recruiter",
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

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function recruiterLabel(key?: string) {
  const recruiter = recruiters.find((item) => item.key === key);
  return recruiter ? `${recruiter.name} · ${recruiter.role}` : "Daniel · Hiring Manager";
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
  const storeAny = store as {
    setSetup?: (setup: SetupState) => void;
    updateSetup?: (setup: SetupState) => void;
    saveSetup?: (setup: SetupState) => void;
    setInterviewSetup?: (setup: SetupState) => void;
  };

  if (typeof storeAny.setSetup === "function") {
    storeAny.setSetup(nextSetup);
  } else if (typeof storeAny.updateSetup === "function") {
    storeAny.updateSetup(nextSetup);
  } else if (typeof storeAny.saveSetup === "function") {
    storeAny.saveSetup(nextSetup);
  } else if (typeof storeAny.setInterviewSetup === "function") {
    storeAny.setInterviewSetup(nextSetup);
  } else {
    useInterviewStore.setState({ setup: nextSetup } as never);
  }

  try {
    window.localStorage.setItem("workzo-interview-setup", JSON.stringify(nextSetup));
    window.localStorage.setItem("workzo_setup", JSON.stringify(nextSetup));
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
  const [recruiter, setRecruiter] = useState<RecruiterKey>((setup.recruiterPersonality as RecruiterKey) || "analytical_hiring_manager");

  const readiness = useMemo(() => {
    const cvReady = Boolean((manualCv || setup.cvText || "").trim());
    const roleReady = Boolean(role.trim());
    const preferencesReady = Boolean(market && companyStyle && recruiter);
    const jdBonus = Boolean(jobDescription.trim());
    return Math.min(100, [cvReady, roleReady, preferencesReady, jdBonus].filter(Boolean).length * 25);
  }, [manualCv, setup.cvText, role, market, companyStyle, recruiter, jobDescription]);

  const currentStepLabel = steps.find((item) => item.id === step)?.label || "Setup";

  function buildSetup(): SetupState {
    return {
      ...setup,
      cvText: manualCv || setup.cvText || "",
      targetRole: role || "General Role",
      jobDescription,
      targetMarket: market,
      country: market,
      companyStyle,
      recruiterStyle: companyStyle,
      recruiterPersonality: recruiter,
      language: setup.language || "English",
    };
  }

  function persist(nextStep?: number) {
    saveSetupToStore(buildSetup(), store);
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

      setManualCv(extracted);
      saveSetupToStore(
        {
          ...buildSetup(),
          cvText: extracted,
        },
        store
      );
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
    persist(Math.min(5, step + 1));
  }

  function back() {
    setStep(Math.max(1, step - 1));
  }

  function startInterview() {
    persist();
    router.push("/interview");
  }

  return (
    <main className="h-screen overflow-hidden bg-[#020712] text-white">
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
      `}</style>

      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-220px] top-[-180px] h-[520px] w-[520px] rounded-full bg-blue-600/16 blur-[120px] [animation:wzGlow_8s_ease-in-out_infinite]" />
        <div className="absolute right-[-180px] top-[-160px] h-[560px] w-[560px] rounded-full bg-cyan-400/12 blur-[130px]" />
        <div className="absolute bottom-[-260px] left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-indigo-600/12 blur-[130px]" />
      </div>

      <div className="relative z-10 mx-auto flex h-screen max-w-[1480px] flex-col px-5 py-3">
        <header className="flex h-[60px] shrink-0 items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-5 shadow-[0_18px_80px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
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
                    onClick={() => persist(item.id)}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full border text-sm font-black transition",
                      complete && "border-emerald-400/35 bg-emerald-400/12 text-emerald-200",
                      active && "border-blue-300 bg-blue-500 text-white shadow-[0_0_28px_rgba(59,130,246,0.42)]",
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

        <section className="grid min-h-0 flex-1 gap-4 py-3 lg:grid-cols-[1fr_0.82fr]">
          <div className="flex min-h-0 flex-col overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.045] shadow-[0_30px_110px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
            <div className="min-h-0 flex-1 overflow-hidden p-5">
              {step === 1 && (
                <div className="flex h-full min-h-0 flex-col">
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

                  <label className="mt-4 flex h-[145px] shrink-0 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-blue-300/30 bg-blue-500/8 p-5 text-center transition hover:bg-blue-500/12">
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
                    className="mt-3 min-h-0 flex-1 resize-none rounded-3xl border border-white/10 bg-[#050b16] p-5 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-blue-400/50"
                  />
                </div>
              )}

              {step === 2 && (
                <div className="flex h-full min-h-0 flex-col">
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
                <div className="flex h-full min-h-0 flex-col overflow-hidden">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/18 text-indigo-200">
                      <Globe2 className="h-6 w-6" />
                    </div>
                    <div>
                      <h1 className="text-3xl font-black tracking-tight">Choose interview style</h1>
                      <p className="mt-1 text-sm text-slate-400">
                        Market and company style affect recruiter behavior.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">Target market</p>
                    <div className="mt-3 flex flex-wrap gap-2.5">
                      {markets.map((item) => (
                        <button
                          key={item}
                          onClick={() => setMarket(item)}
                          className={cn(
                            "rounded-2xl px-5 py-3 text-sm font-black transition",
                            market === item ? "bg-blue-500 text-white" : "bg-white/10 text-slate-300 hover:bg-white/14"
                          )}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5">
                    <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">Company style</p>
                    <div className="mt-3 flex flex-wrap gap-2.5">
                      {companyStyles.map((item) => (
                        <button
                          key={item}
                          onClick={() => setCompanyStyle(item)}
                          className={cn(
                            "rounded-2xl px-5 py-3 text-sm font-black transition",
                            companyStyle === item
                              ? "bg-gradient-to-r from-fuchsia-500 to-purple-500 text-white"
                              : "bg-white/10 text-slate-300 hover:bg-white/14"
                          )}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 grid min-h-0 gap-3 overflow-hidden sm:grid-cols-2">
                    {recruiters.map((item) => (
                      <button
                        key={item.key}
                        onClick={() => setRecruiter(item.key)}
                        className={cn(
                          "rounded-3xl border p-4 text-left transition",
                          recruiter === item.key
                            ? "border-blue-400 bg-blue-500/16 shadow-[0_0_30px_rgba(59,130,246,0.18)]"
                            : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-black">{item.name} · {item.role}</h3>
                            <p className="mt-1 text-sm leading-5 text-slate-400">{item.description}</p>
                          </div>
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-lg">
                            {item.avatar}
                          </div>
                        </div>
                        <p className="mt-3 rounded-2xl bg-black/20 p-3 text-sm italic text-slate-300">
                          “{item.quote}”
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="flex h-full min-h-0 flex-col">
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
                    {[
                      ["CV Status", manualCv || setup.cvText ? "CV ready" : "Missing", FileText],
                      ["Target Role", compactText(role, "General Role"), Briefcase],
                      ["Market", market, Globe2],
                      ["Company Style", companyStyle, Building2],
                      ["Recruiter", recruiterLabel(recruiter), UserRound],
                      ["Readiness", `${readiness}%`, Sparkles],
                    ].map(([label, value, Icon]) => (
                      <div key={String(label)} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                        <Icon className="h-5 w-5 text-blue-200" />
                        <p className="mt-3 text-xs font-black uppercase tracking-[0.24em] text-slate-500">
                          {label}
                        </p>
                        <p className="mt-2 text-lg font-black">{value as string}</p>
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
                        style={{ width: `${readiness}%` }}
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
                      onClick={startInterview}
                      className="mt-8 inline-flex h-14 items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-400 px-8 text-base font-black text-white shadow-[0_18px_45px_rgba(14,165,233,0.34)] transition hover:scale-[1.02]"
                    >
                      Enter Interview Room
                      <ArrowRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex h-[70px] shrink-0 items-center justify-between border-t border-white/10 px-5">
              <button
                onClick={back}
                disabled={step === 1}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-bold text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Back
              </button>

              {step < 5 ? (
                <button
                  onClick={next}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 px-6 py-3 text-sm font-black text-white shadow-[0_14px_35px_rgba(37,99,235,0.28)] transition hover:scale-[1.02]"
                >
                  Continue
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={startInterview}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-400 px-6 py-3 text-sm font-black text-white shadow-[0_14px_35px_rgba(14,165,233,0.28)] transition hover:scale-[1.02]"
                >
                  Start Interview
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <aside className="min-h-0 rounded-[26px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_30px_110px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
            <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#050b16] p-5">
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-1/2 top-28 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-500/18 blur-[80px]" />
                <div className="absolute bottom-8 right-[-70px] h-56 w-56 rounded-full bg-cyan-400/12 blur-[80px]" />
                <div className="absolute inset-0 opacity-[0.08] [background:linear-gradient(90deg,rgba(255,255,255,.18)_1px,transparent_1px),linear-gradient(rgba(255,255,255,.16)_1px,transparent_1px)] [background-size:48px_48px]" />
              </div>

              <div className="relative z-10 flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/8 px-3 py-1.5 text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
                    <Wand2 className="h-3.5 w-3.5" />
                    AI setup engine
                  </div>
                  <h2 className="mt-4 text-2xl font-black tracking-tight">
                    Preparing recruiter intelligence
                  </h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
                    WorkZo is assembling your CV, role, market, and recruiter style into one interview simulation.
                  </p>
                </div>

                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]">
                  <Image src="/workzo_icon.png" alt="WorkZo" width={30} height={30} className="rounded-lg" />
                </div>
              </div>

              <div className="relative z-10 mt-4 rounded-3xl border border-white/10 bg-slate-950/55 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.28)]">
                <div className="pointer-events-none absolute inset-x-4 top-0 h-16 rounded-full bg-cyan-300/10 blur-2xl" />

                <div className="relative overflow-hidden rounded-2xl border border-cyan-300/15 bg-black/24 p-4">
                  <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-cyan-300/12 to-transparent [animation:wzScan_3.6s_ease-in-out_infinite]" />
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 shadow-[0_0_35px_rgba(14,165,233,0.35)]">
                        <Radar className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Live analysis</p>
                        <p className="mt-1 text-lg font-black">{readiness}% ready</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {[0, 1, 2].map((item) => (
                        <span
                          key={item}
                          className="h-2.5 w-2.5 rounded-full bg-emerald-300"
                          style={{
                            animation: "wzDotPulse 1.4s ease-in-out infinite",
                            animationDelay: `${item * 0.18}s`,
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-300 to-emerald-300"
                      style={{ width: `${readiness}%` }}
                    />
                  </div>

                  <div className="mt-4 flex h-8 items-end gap-1 overflow-hidden">
                    {waveform.map((height, index) => (
                      <span
                        key={index}
                        className="w-1.5 shrink-0 origin-bottom rounded-full bg-gradient-to-t from-blue-500 to-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.34)]"
                        style={{
                          height,
                          animation: `wzPulseBar ${1.15 + (index % 5) * 0.1}s ease-in-out infinite`,
                          animationDelay: `${index * 0.04}s`,
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  {analysisSignals.map((signal, index) => {
                    const active =
                      index === 0 ||
                      readiness >= 50 ||
                      (readiness >= 25 && index < 3) ||
                      (readiness >= 75 && index < 5);

                    return (
                      <div
                        key={signal}
                        className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              "h-2.5 w-2.5 rounded-full",
                              active ? "bg-emerald-300 shadow-[0_0_14px_rgba(52,211,153,.45)]" : "bg-slate-600"
                            )}
                          />
                          <span className={cn("text-sm font-bold", active ? "text-white" : "text-slate-500")}>
                            {signal}
                          </span>
                        </div>
                        {active ? (
                          <Check className="h-4 w-4 text-emerald-300" />
                        ) : (
                          <span className="text-xs font-bold text-slate-600">waiting</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="relative z-10 mt-3 grid gap-2.5">
                {[
                  ["Current step", currentStepLabel, Sparkles],
                  ["Recruiter style", recruiterLabel(recruiter), UserRound],
                  ["Privacy", "CV text stays in this setup", Lock],
                ].map(([label, value, Icon]) => (
                  <div
                    key={String(label)}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/14 text-blue-200">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{label}</p>
                        <p className="mt-1 text-sm font-bold text-white">{value as string}</p>
                      </div>
                    </div>
                    <Check className="h-4 w-4 text-emerald-300" />
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
