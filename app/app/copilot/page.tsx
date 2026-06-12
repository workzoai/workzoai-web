"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  Bot,
  Brain,
  Briefcase,
  CheckCircle2,
  ClipboardList,
  Copy,
  FileText,
  Flame,
  Lightbulb,
  Mail,
  MessageSquareText,
  RefreshCcw,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Wand2,
  Zap,
} from "lucide-react";

import {
  buildCvIntelligenceSummary,
  compareAnswers,
  detectAnswerSignals,
  getRecruiterProfile,
  runWorkobotAction,
  type WorkobotAction,
} from "@/lib/launchIntelligenceEngine";
import FeedbackCapture from "@/components/FeedbackCapture";
import { trackWorkZoLaunchEvent } from "@/lib/workzoLaunchAnalytics";
import { getWorkZoPlanLimits } from "@/lib/workzoPlanLimits";
import { useWorkZoAuthoritativePlan } from "@/lib/workzoClientPlan";

type SavedSetup = {
  cvText?: string;
  jobDescription?: string;
  targetRole?: string;
  targetMarket?: string;
  recruiterPersonality?: string;
};

type CopilotMode =
  | "career_chat"
  | "interview_coach"
  | "cv_improve"
  | "cover_letter"
  | "job_fit"
  | "find_jobs_strategy"
  | "linkedin_message"
  | "email_reply"
  | "career_plan";

type SmartActionId =
  | WorkobotAction
  | "magic"
  | "career_chat"
  | "interview_coach"
  | "cv_improve"
  | "cover_letter"
  | "job_fit"
  | "find_jobs_strategy"
  | "linkedin_message"
  | "email_reply"
  | "career_plan";

type SmartAction = {
  id: SmartActionId;
  title: string;
  description: string;
  icon: typeof Sparkles;
  priority: "high" | "medium" | "normal";
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const emptySetup: SavedSetup = {};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function readSetup(): SavedSetup {
  if (typeof window === "undefined") return {};

  const keys = [
    "workzo-latest-interview-setup",
    "workzo-interview-setup-v4",
    "workzo-interview-setup-latest",
  ];

  for (const key of keys) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as SavedSetup;
    } catch {
      // ignore broken localStorage
    }
  }

  return {};
}

function getMood(score: number) {
  if (score >= 82) {
    return {
      label: "Engaged",
      tone: "Recruiter is receiving strong signal.",
      className: "border-emerald-300/25 bg-emerald-400/10 text-emerald-200",
      icon: TrendingUp,
    };
  }

  if (score >= 65) {
    return {
      label: "Neutral",
      tone: "Recruiter needs more proof before trusting the answer.",
      className: "border-cyan-300/25 bg-cyan-400/10 text-cyan-200",
      icon: Sparkles,
    };
  }

  if (score >= 45) {
    return {
      label: "Skeptical",
      tone: "Recruiter may challenge this answer with follow-ups.",
      className: "border-amber-300/25 bg-amber-400/10 text-amber-200",
      icon: ShieldAlert,
    };
  }

  return {
    label: "Concerned",
    tone: "Recruiter trust is dropping. Recover with proof and ownership.",
    className: "border-red-300/25 bg-red-400/10 text-red-200",
    icon: TrendingDown,
  };
}

function buildWeaknessRadar(answer: string) {
  const signals = detectAnswerSignals(answer);

  return [
    {
      label: "Measurable impact",
      ok: signals.hasMetric,
      advice: signals.hasMetric
        ? "Metric signal detected."
        : "Add scale, time saved, users, tickets, revenue, quality, or customer impact.",
    },
    {
      label: "Ownership",
      ok: signals.hasOwnership,
      advice: signals.hasOwnership
        ? "Ownership signal detected."
        : "Say what YOU personally owned, decided, fixed, led, or delivered.",
    },
    {
      label: "STAR structure",
      ok: signals.hasSTAR,
      advice: signals.hasSTAR
        ? "Structure is visible."
        : "Add situation, task, action, and result so the recruiter can follow the story.",
    },
    {
      label: "Concise clarity",
      ok: !signals.rambling && !signals.vague,
      advice: signals.rambling
        ? "Too long. Cut it to 45–75 seconds."
        : signals.vague
          ? "Too vague. Use one concrete example."
          : "Answer length and clarity look usable.",
    },
  ];
}

function buildFollowUps(answer: string, recruiterName: string) {
  const signals = detectAnswerSignals(answer);
  const questions: string[] = [];

  if (!signals.hasMetric) questions.push("What measurable impact did that create?");
  if (!signals.hasOwnership) questions.push("What exactly did you personally own?");
  if (signals.vague) questions.push("Can you give me one specific example?");
  if (signals.rambling) questions.push("Can you summarize that in 60 seconds?");
  if (!signals.hasSTAR) questions.push("What was the situation, action, and result?");

  questions.push(`${recruiterName} may ask: why is this relevant to this role?`);

  return questions.slice(0, 5);
}

function getModeMeta(mode: CopilotMode) {
  const meta: Record<CopilotMode, { title: string; subtitle: string; icon: typeof Bot }> = {
    career_chat: {
      title: "Career Guide copilot",
      subtitle: "Ask anything about your CV, job search, applications, or interview prep.",
      icon: Bot,
    },
    interview_coach: {
      title: "Interview coach",
      subtitle: "Fix answers, decode recruiter intent, and prepare follow-ups.",
      icon: Brain,
    },
    cv_improve: {
      title: "Improve CV",
      subtitle: "Make your CV sharper, more ATS-friendly, and role-specific.",
      icon: FileText,
    },
    cover_letter: {
      title: "Cover letter",
      subtitle: "Generate a focused cover letter using your CV and job description.",
      icon: Mail,
    },
    job_fit: {
      title: "Job fit check",
      subtitle: "Decide whether to apply, tailor first, or skip for now.",
      icon: Target,
    },
    find_jobs_strategy: {
      title: "Find jobs",
      subtitle: "Get titles, keywords, platforms, and a 7-day search strategy.",
      icon: Search,
    },
    linkedin_message: {
      title: "LinkedIn message",
      subtitle: "Write natural outreach messages to recruiters and hiring managers.",
      icon: MessageSquareText,
    },
    email_reply: {
      title: "Email reply",
      subtitle: "Draft professional replies for interviews, recruiters, or applications.",
      icon: Mail,
    },
    career_plan: {
      title: "Career Guide plan",
      subtitle: "Build a realistic 7-day and 30-day career action plan.",
      icon: ClipboardList,
    },
  };

  return meta[mode];
}

function getSmartActions(answer: string, mode: CopilotMode): SmartAction[] {
  const signals = detectAnswerSignals(answer);

  if (mode === "cv_improve") {
    return [
      { id: "cv_improve", title: "Improve CV", description: "Diagnose and rewrite CV positioning for this role.", icon: FileText, priority: "high" },
      { id: "job_fit", title: "Check role fit", description: "Compare CV evidence with the job requirements.", icon: Target, priority: "medium" },
      { id: "find_jobs_strategy", title: "Find job strategy", description: "Get job titles, keywords, and search filters.", icon: Search, priority: "normal" },
    ];
  }

  if (mode === "cover_letter") {
    return [
      { id: "cover_letter", title: "Generate letter", description: "Draft a focused cover letter from CV and JD.", icon: Mail, priority: "high" },
      { id: "job_fit", title: "Check fit first", description: "Find strengths and gaps before applying.", icon: Target, priority: "medium" },
      { id: "email_reply", title: "Application email", description: "Create a short professional application email.", icon: MessageSquareText, priority: "normal" },
    ];
  }

  if (mode === "job_fit" || mode === "find_jobs_strategy" || mode === "career_plan") {
    return [
      { id: "job_fit", title: "Should I apply?", description: "Get an honest apply/tailor/skip verdict.", icon: Target, priority: "high" },
      { id: "find_jobs_strategy", title: "Find matching jobs", description: "Get search titles, keywords, and filters.", icon: Search, priority: "high" },
      { id: "career_plan", title: "30-day plan", description: "Create a realistic next-step plan.", icon: ClipboardList, priority: "medium" },
    ];
  }

  const actions: SmartAction[] = [
    {
      id: "magic",
      title: "Save my answer",
      description: "Rewrite with structure, ownership, proof, and recruiter trust.",
      icon: Flame,
      priority: "high",
    },
    {
      id: "expectation",
      title: "Hidden recruiter intent",
      description: "See what the recruiter is actually testing.",
      icon: Target,
      priority: "medium",
    },
  ];

  if (!signals.hasMetric) {
    actions.push({
      id: "metrics",
      title: "Add metrics",
      description: "Find places where numbers would increase trust.",
      icon: BarChart3,
      priority: "high",
    });
  }

  if (!signals.hasOwnership) {
    actions.push({
      id: "ownership",
      title: "Show ownership",
      description: "Make your personal contribution clearer.",
      icon: CheckCircle2,
      priority: "high",
    });
  }

  if (!signals.hasSTAR) {
    actions.push({
      id: "star",
      title: "STAR conversion",
      description: "Turn your answer into a recruiter-ready structure.",
      icon: Brain,
      priority: "medium",
    });
  }

  actions.push(
    {
      id: "rewrite",
      title: "Rewrite stronger",
      description: "Improve clarity, confidence, and role fit.",
      icon: Wand2,
      priority: "normal",
    },
    {
      id: "concise",
      title: "Make concise",
      description: "Shorten without losing impact.",
      icon: MessageSquareText,
      priority: "normal",
    },
  );

  return actions.slice(0, 6);
}

function buildMagicAnswer({ question, answer, targetRole }: { question: string; answer: string; targetRole: string }) {
  const signals = detectAnswerSignals(answer);

  const missing = [
    !signals.hasMetric && "a measurable result",
    !signals.hasOwnership && "clear personal ownership",
    !signals.hasSTAR && "STAR structure",
    signals.vague && "one concrete example",
    signals.rambling && "a shorter version",
  ].filter(Boolean);

  return [
    "Recruiter-ready answer:",
    "",
    `“One relevant example is from a situation where [specific situation related to ${targetRole || "the role"}]. My responsibility was [your exact ownership]. I handled it by [specific action you took], working with [team/customer/stakeholder] to solve [problem]. The result was [measurable impact — tickets reduced, time saved, customers helped, quality improved, or process improved]. This is relevant to ${targetRole || "this role"} because it shows [role-relevant skill].”`,
    "",
    "Why this is stronger:",
    "• It gives one clear example.",
    "• It shows what you personally owned.",
    "• It adds measurable impact.",
    "• It connects your experience to the target role.",
    "",
    missing.length
      ? `Still missing from your original answer: ${missing.join(", ")}.`
      : "Your original answer already has useful signal. This version makes it sharper.",
    "",
    `Question being answered: ${question}`,
  ].join("\n");
}

function modeStarter(mode: CopilotMode, targetRole: string) {
  const starters: Record<CopilotMode, string> = {
    career_chat: "What should I improve first in my job search?",
    interview_coach: "Help me improve this interview answer.",
    cv_improve: `Improve my CV positioning for ${targetRole || "my target role"}.`,
    cover_letter: "Generate a cover letter for this job description.",
    job_fit: "Should I apply to this job based on my CV?",
    find_jobs_strategy: "Which job titles and keywords should I search for?",
    linkedin_message: "Write a LinkedIn message to a recruiter.",
    email_reply: "Help me write a professional reply.",
    career_plan: "Give me a 30-day plan to get closer to my target role.",
  };

  return starters[mode];
}


function getCareerGuidancePrompts(setup: SavedSetup) {
  const role = setup.targetRole || "my target role";

  return [
    `What is the smartest next step for me to move closer to ${role}?`,
    `Based on my CV, what roles should I target first and which should I avoid for now?`,
    `What are the top 5 gaps I must fix before applying for ${role}?`,
    `Create a 7-day application plan for ${role}.`,
    `Give me a recruiter-style honest review of my profile for ${role}.`,
    `Which CV bullets should I improve first for ${role}?`,
  ];
}

function getCareerGuideStarter(mode: CopilotMode, targetRole: string) {
  if (mode === "career_chat") {
    return `Act as my career guide. Based on my CV and target role (${targetRole}), tell me the smartest next step, the biggest risk, and what I should do today.`;
  }

  if (mode === "career_plan") {
    return `Create a practical 7-day and 30-day career plan for ${targetRole}. Include applications, CV improvements, interview preparation, and portfolio/proof steps.`;
  }

  if (mode === "job_fit") {
    return `Give me an honest apply / tailor first / skip verdict for ${targetRole}. Use my CV and the job description.`;
  }

  return modeStarter(mode, targetRole);
}


// Premium-only copilot action ids
const PREMIUM_ONLY_ACTIONS: SmartActionId[] = [
  "career_plan",
  "email_reply",
  "linkedin_message",
];

export default function WorkOBotCopilotPage() {
  const [setup, setSetup] = useState<SavedSetup>(emptySetup);
  const [mode, setMode] = useState<CopilotMode>("career_chat");
  const [question, setQuestion] = useState("Tell me about a challenging project you worked on and how you handled it.");
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");
  const [output, setOutput] = useState("");
  const [improvedAnswer, setImprovedAnswer] = useState("");
  const [comparison, setComparison] = useState<ReturnType<typeof compareAnswers> | null>(null);
  const [loading, setLoading] = useState(false);
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const planState = useWorkZoAuthoritativePlan();
  const isPremium = Boolean(getWorkZoPlanLimits(planState.plan).advancedReports || getWorkZoPlanLimits(planState.plan).tavus);

  useEffect(() => {
    setSetup(readSetup());
  }, []);

  const targetRole = setup.targetRole || "your target role";
  const cvText = setup.cvText || "";
  const jobDescription = setup.jobDescription || "";
  const recruiter = getRecruiterProfile(setup.recruiterPersonality);
  const cvSummary = useMemo(() => buildCvIntelligenceSummary(cvText, targetRole), [cvText, targetRole]);

  const signals = useMemo(() => detectAnswerSignals(answer), [answer]);
  const mood = useMemo(() => getMood(answer.trim() ? signals.score : 50), [answer, signals.score]);
  const weaknessRadar = useMemo(() => buildWeaknessRadar(answer), [answer]);
  const followUps = useMemo(() => buildFollowUps(answer, recruiter.name), [answer, recruiter.name]);
  const smartActions = useMemo(() => getSmartActions(answer, mode), [answer, mode]);
  const modeMeta = getModeMeta(mode);
  const MoodIcon = mood.icon;
  const ModeIcon = modeMeta.icon;

  useEffect(() => {
    trackWorkZoLaunchEvent({
      event: "copilot_opened",
      role: targetRole,
      recruiter: recruiter.name,
      mode: "copilot",
    });
  }, [targetRole, recruiter.name]);

  async function runAction(action: SmartActionId = mode) {
    const effectiveMessage = message.trim() || getCareerGuideStarter(mode, targetRole);

    trackWorkZoLaunchEvent({
      event: "copilot_action_used",
      role: targetRole,
      recruiter: recruiter.name,
      mode: "copilot",
      metadata: { action, copilotMode: mode },
    });

    try {
      setLoading(true);
      setComparison(null);

      const nextConversation: ChatMessage[] = effectiveMessage
        ? [
            ...conversation,
            { role: "user" as const, content: effectiveMessage },
          ]
        : conversation;

      // Gate premium-only actions client-side before hitting the API
      if (!isPremium && PREMIUM_ONLY_ACTIONS.includes(action as SmartActionId)) {
        setOutput("This feature is available on Premium. Upgrade to unlock career plans, salary negotiation, LinkedIn messages, and email replies.");
        setLoading(false);
        return;
      }

      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          message: effectiveMessage,
          question,
          answer,
          cvText,
          jobDescription,
          targetRole,
          targetMarket: setup.targetMarket || "Global",
          recruiterName: recruiter.name,
          recruiterRole: recruiter.role,
          recruiterState: mood.label,
          conversation: nextConversation,
        }),
      });

      const data = (await response.json()) as { success?: boolean; output?: string; error?: string };

      if (!response.ok || !data.success) {
        if (data.error === "upgrade_required" || data.error === "upgrade_required_rate_limit") {
          setOutput("You have reached the free usage limit for this feature. Upgrade to Premium for unlimited access.");
          setLoading(false);
          return;
        }
        throw new Error(data.error || "Copilot failed");
      }

      const aiOutput = data.output || "No recruiter analysis generated.";
      setOutput(aiOutput);
      setImprovedAnswer(aiOutput);
      setConversation([
        ...nextConversation,
        { role: "assistant" as const, content: aiOutput },
      ].slice(-12));
      setMessage("");

      if (["magic", "rewrite", "star", "concise"].includes(action)) {
        setComparison(compareAnswers(answer, aiOutput));
      }
    } catch (error) {
      console.warn("AI copilot failed, using local fallback:", error);

      if (action === "magic" || action === "interview_coach") {
        const result = buildMagicAnswer({ question, answer, targetRole });
        setOutput(result);
        setImprovedAnswer(result);
        setComparison(compareAnswers(answer, result));
        return;
      }

      const fallbackAction: WorkobotAction =
        action === "expectation"
          ? ("expectation" as WorkobotAction)
          : (["rewrite", "star", "metrics", "ownership", "concise", "followups", "score"].includes(action)
              ? (action as WorkobotAction)
              : ("magic" as WorkobotAction));

      const result = runWorkobotAction({ action: fallbackAction, question, answer, cvText, targetRole });
      setOutput(result);
      setImprovedAnswer(result);

      if (["rewrite", "star", "concise"].includes(action)) {
        setComparison(compareAnswers(answer, result));
      }
    } finally {
      setLoading(false);
    }
  }

  async function copyOutput() {
    if (!output || typeof navigator === "undefined") return;
    try {
      await navigator.clipboard.writeText(output);
    } catch {
      // ignore clipboard failures
    }
  }

  const modes: Array<{ id: CopilotMode; label: string; icon: typeof Bot }> = [
    { id: "career_chat", label: "Career Guide", icon: Bot },
    { id: "interview_coach", label: "Interview", icon: Brain },
    { id: "cv_improve", label: "CV", icon: FileText },
    { id: "cover_letter", label: "Cover letter", icon: Mail },
    { id: "job_fit", label: "Job fit", icon: Target },
    { id: "find_jobs_strategy", label: "Find jobs", icon: Search },
    { id: "linkedin_message", label: "Messages", icon: MessageSquareText },
    { id: "career_plan", label: "Plan", icon: ClipboardList },
  ];

  return (
    <main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.14),transparent_32%),linear-gradient(180deg,#06111f_0%,#050816_100%)] p-3 text-white sm:p-4">
      <div className="mx-auto max-w-[1540px]">
        <header className="flex flex-col gap-4 rounded-[24px] border border-white/10 bg-white/[0.045] px-4 py-4 shadow-[0_20px_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl lg:flex-row lg:items-center lg:justify-between lg:px-5">
          <Link href="/dashboard" className="inline-flex items-center gap-3 text-sm font-black text-slate-300 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
            Back to dashboard
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/16 text-blue-200">
              <Wand2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-black">Work-O-Bot Career Guide Guide</p>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">Career Guide copilot · not just interview answers</p>
            </div>
          </div>
        </header>

        <section className="mt-4 grid gap-4 xl:grid-cols-[0.76fr_1.18fr_0.9fr]">
          <aside className="rounded-[26px] border border-white/10 bg-white/[0.045] p-4 shadow-[0_22px_80px_rgba(0,0,0,0.24)] backdrop-blur-2xl lg:p-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/8 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
              <FileText className="h-4 w-4" />
              Career Guide context
            </div>

            <h1 className="mt-4 text-2xl font-black tracking-tight">What Work-O-Bot Career Guide Guide knows</h1>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {cvSummary.bullets.map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-black/18 p-3 text-sm leading-6 text-slate-300">
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-400/8 p-4">
              <p className="text-sm font-black text-cyan-100">{recruiter.name} · {recruiter.role}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">Focus: {recruiter.focus.join(", ")}.</p>
            </div>

            <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-400/8 p-4 text-sm leading-6 text-amber-100">
              Work-O-Bot Career Guide Guide now helps with CV, jobs, cover letters, messages, and interview recovery — not only answer rewriting — it can guide CV positioning, applications, interviews, recruiter messages, and next career steps.
            </div>
          </aside>

          <section className="rounded-[26px] border border-white/10 bg-white/[0.045] p-4 shadow-[0_22px_80px_rgba(0,0,0,0.24)] backdrop-blur-2xl lg:p-5">
            <div className="flex flex-col gap-3">

              <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.06] p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200">Smart career prompts</p>
                <div className="mt-3 grid gap-2">
                  {getCareerGuidancePrompts(setup).slice(0, 4).map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => {
                        setMessage(prompt);
                        setMode("career_chat");
                      }}
                      className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-left text-xs font-bold leading-5 text-slate-200 transition hover:border-cyan-300/30 hover:bg-cyan-400/10"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>


              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200">
                  <ModeIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-black tracking-tight">{modeMeta.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{modeMeta.subtitle}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {modes.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setMode(item.id);
                        setMessage(modeStarter(item.id, targetRole));
                      }}
                      className={cn(
                        "flex h-11 items-center justify-center gap-2 rounded-2xl border px-3 text-xs font-black transition",
                        mode === item.id
                          ? "border-cyan-300/35 bg-cyan-400/12 text-cyan-100"
                          : "border-white/10 bg-white/[0.035] text-slate-300 hover:bg-white/[0.07]",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_230px] lg:items-start">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Ask Work-O-Bot Career Guide Guide</p>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Ask about your CV, a job, cover letter, recruiter reply, interview answer, or career plan..."
                  className="mt-2 h-24 w-full resize-none rounded-3xl border border-white/10 bg-slate-950/60 p-4 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
                />
              </div>

              <div className={`rounded-3xl border px-4 py-3 ${mood.className}`}>
                <div className="flex items-center gap-2">
                  <MoodIcon className="h-5 w-5" />
                  <p className="text-sm font-black">{mood.label}</p>
                </div>
                <p className="mt-1 text-xs leading-5 opacity-90">{mood.tone}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div>
                <label className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Recruiter question / prompt</label>
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  className="mt-2 h-24 w-full resize-none rounded-3xl border border-white/10 bg-slate-950/60 p-4 text-sm leading-6 text-white outline-none focus:border-cyan-300/40"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Your answer / draft</label>
                <textarea
                  value={answer}
                  onChange={(event) => {
                    setAnswer(event.target.value);
                    setComparison(null);
                  }}
                  placeholder="Paste an interview answer, CV bullet, cover letter draft, or recruiter message..."
                  className="mt-2 h-24 w-full resize-none rounded-3xl border border-white/10 bg-slate-950/60 p-4 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
                />
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-black/18 p-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-amber-200" />
                  <h2 className="font-black">Weakness radar</h2>
                </div>

                <div className="mt-3 space-y-2">
                  {weaknessRadar.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-black">{item.label}</p>
                        <span className={item.ok ? "rounded-full bg-emerald-400/12 px-2 py-1 text-xs font-black text-emerald-200" : "rounded-full bg-red-400/12 px-2 py-1 text-xs font-black text-red-200"}>
                          {item.ok ? "OK" : "Weak"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{item.advice}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/18 p-4">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-cyan-200" />
                  <h2 className="font-black">Likely recruiter follow-ups</h2>
                </div>

                <div className="mt-3 space-y-2">
                  {followUps.map((item) => (
                    <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-sm leading-6 text-slate-300">
                      “{item}”
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {smartActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => runAction(action.id)}
                    className={cn(
                      "rounded-2xl border p-4 text-left transition hover:scale-[1.01]",
                      action.priority === "high"
                        ? "border-cyan-300/30 bg-cyan-400/8"
                        : "border-white/10 bg-white/[0.045] hover:border-cyan-300/25 hover:bg-white/[0.07]",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-cyan-200" />
                      <p className="font-black">{action.title}</p>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-400">{action.description}</p>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => runAction(mode)}
              disabled={loading}
              className="mt-4 flex h-13 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-blue-500 to-violet-600 px-5 py-4 text-sm font-black text-white shadow-[0_14px_34px_rgba(59,130,246,0.25)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send className="h-5 w-5" />
              {loading ? "Work-O-Bot Career Guide Guide is thinking..." : "Ask Work-O-Bot Career Guide Guide"}
            </button>
          </section>

          <aside className="rounded-[26px] border border-white/10 bg-white/[0.045] p-4 shadow-[0_22px_80px_rgba(0,0,0,0.24)] backdrop-blur-2xl lg:p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black">Copilot output</h2>
              <div className="flex items-center gap-2">
                <button type="button" onClick={copyOutput} className="rounded-xl border border-white/10 bg-white/[0.05] p-2 text-slate-300 hover:text-white" aria-label="Copy output">
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOutput("");
                    setImprovedAnswer("");
                    setComparison(null);
                    setConversation([]);
                  }}
                  className="rounded-xl border border-white/10 bg-white/[0.05] p-2 text-slate-300 hover:text-white"
                  aria-label="Reset output"
                >
                  <RefreshCcw className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 min-h-[360px] max-h-[560px] overflow-y-auto whitespace-pre-line rounded-3xl border border-white/10 bg-slate-950/60 p-4 text-sm leading-7 text-slate-200">
              {loading ? (
                <div className="flex h-[260px] items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
                    <p className="mt-4 text-sm text-slate-400">Work-O-Bot Career Guide Guide is reading your context...</p>
                  </div>
                </div>
              ) : (
                output || "Choose a mode or ask a question to get recruiter-aware career help."
              )}
            </div>

            {comparison && (
              <div className="mt-4 rounded-3xl border border-emerald-300/20 bg-emerald-400/8 p-4">
                <div className="flex items-center gap-3">
                  <Zap className="h-5 w-5 text-emerald-200" />
                  <p className="font-black">Before vs after</p>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-black/18 p-3">
                    <p className="text-xs text-slate-500">Original</p>
                    <p className="text-2xl font-black">{comparison.oldScore}</p>
                  </div>
                  <div className="rounded-2xl bg-black/18 p-3">
                    <p className="text-xs text-slate-500">Improved</p>
                    <p className="text-2xl font-black">{comparison.newScore}</p>
                  </div>
                  <div className="rounded-2xl bg-black/18 p-3">
                    <p className="text-xs text-slate-500">Trust</p>
                    <p className="text-2xl font-black">{comparison.trustDelta > 0 ? "+" : ""}{comparison.trustDelta}</p>
                  </div>
                </div>

                <p className="mt-3 text-sm leading-6 text-slate-300">{comparison.message}</p>
              </div>
            )}

            {improvedAnswer && (
              <button
                type="button"
                onClick={() => {
                  setAnswer(improvedAnswer);
                  setOutput("Saved as your new draft. Run another action to improve it further.");
                  setComparison(null);
                }}
                className="mt-4 h-12 w-full rounded-2xl bg-gradient-to-r from-blue-500 to-violet-600 text-sm font-black text-white shadow-[0_14px_34px_rgba(59,130,246,0.25)]"
              >
                Use improved draft
              </button>
            )}

            <div className="mt-4">
              <FeedbackCapture source="copilot" />
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
