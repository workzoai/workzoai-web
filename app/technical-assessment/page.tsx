"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  Code2,
  Crown,
  Database,
  Lock,
  Target,
  TrendingUp,
  Zap,
  BarChart3,
} from "lucide-react";
import { readLatestInterviewSetup } from "@/lib/workzoInterviewSetup";
import { canUseWorkZoFeature } from "@/lib/workzoPlanLimits";
import { useWorkZoAuthoritativePlan } from "@/lib/workzoClientPlan";
import type { TechnicalAssessmentResult } from "@/lib/workzoTechnicalAssessmentEngine";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function clamp(v: number) {
  return Math.max(0, Math.min(100, Math.round(v)));
}

// ── Types ──────────────────────────────────────────────────────────────────────

type AssessmentQuestion = {
  id: string;
  skill: string;
  type: "multiple_choice" | "open_text" | "scenario" | "sql" | "code";
  difficulty: "foundational" | "intermediate" | "advanced";
  question: string;
  context?: string;
  options?: string[];
  scoringGuide: string;
  timeSeconds: number;
};

type Assessment = {
  roleCluster: string;
  targetRole: string;
  difficulty: string;
  questions: AssessmentQuestion[];
  totalQuestions: number;
  estimatedMinutes: number;
};

type CapturedAnswer = {
  questionId: string;
  skill: string;
  type: string;
  question: string;
  context?: string;
  scoringGuide: string;
  difficulty: string;
  selectedOption?: number;
  openAnswer?: string;
  timeSeconds: number;
};

type Phase = "loading" | "intro" | "question" | "submitting" | "results" | "error";

// ── Timer component ────────────────────────────────────────────────────────────

function Timer({ seconds, total }: { seconds: number; total: number }) {
  const pct = clamp((seconds / total) * 100);
  const urgent = seconds < 30;
  return (
    <div className="flex items-center gap-2">
      <Clock className={cn("h-3.5 w-3.5 shrink-0", urgent ? "text-rose-300" : "text-slate-400")} />
      <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", urgent ? "bg-rose-400" : "bg-blue-400")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn("text-xs font-black tabular-nums w-10 text-right", urgent ? "text-rose-300" : "text-slate-400")}>
        {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
      </span>
    </div>
  );
}

// ── Score ring ─────────────────────────────────────────────────────────────────

function ScoreRing({ score, label }: { score: number; label: string }) {
  const deg = clamp(score) * 3.6;
  const color = score >= 75 ? "#10b981" : score >= 55 ? "#3b82f6" : "#f43f5e";
  return (
    <div
      className="grid h-24 w-24 place-items-center rounded-full shrink-0"
      style={{ background: `conic-gradient(${color} ${deg}deg, rgba(255,255,255,0.08) 0deg)` }}
    >
      <div className="grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full bg-[#0d0d1a] text-center">
        <div>
          <p className="text-2xl font-black text-white">{score}</p>
          <p className="text-[10px] font-black text-slate-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

// ── Grade badge ────────────────────────────────────────────────────────────────

function GradeBadge({ grade }: { grade: string }) {
  const cls =
    grade === "A" ? "bg-emerald-400/10 text-emerald-200 border-emerald-400/20" :
    grade === "B" ? "bg-blue-400/10 text-blue-200 border-blue-400/20" :
    grade === "C" ? "bg-amber-400/10 text-amber-200 border-amber-400/20" :
    "bg-rose-400/10 text-rose-200 border-rose-400/20";
  return (
    <span className={cn("rounded-lg border px-2.5 py-1 text-sm font-black", cls)}>{grade}</span>
  );
}

// ── Skill type icon ────────────────────────────────────────────────────────────

function SkillIcon({ type }: { type: string }) {
  if (type === "sql") return <Database className="h-4 w-4 text-blue-300" />;
  if (type === "code") return <Code2 className="h-4 w-4 text-violet-300" />;
  return <Target className="h-4 w-4 text-amber-300" />;
}

// ── Difficulty badge ───────────────────────────────────────────────────────────

function DifficultyBadge({ level }: { level: string }) {
  const cls =
    level === "foundational" ? "bg-emerald-400/10 text-emerald-300" :
    level === "intermediate" ? "bg-amber-400/10 text-amber-300" :
    "bg-rose-400/10 text-rose-300";
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider", cls)}>
      {level}
    </span>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function TechnicalAssessmentPage() {
  const planState = useWorkZoAuthoritativePlan();
  const plan = planState.plan;
  const isPremium = plan === "premium" || plan === "premium_pro";

  const [phase, setPhase] = useState<Phase>("loading");
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<CapturedAnswer[]>([]);
  const [currentMcq, setCurrentMcq] = useState<number | null>(null);
  const [currentOpen, setCurrentOpen] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [result, setResult] = useState<TechnicalAssessmentResult | null>(null);
  const [targetRole, setTargetRole] = useState("General");
  const [error, setError] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load setup from localStorage
  useEffect(() => {
    if (planState.loading) return;
    const setup = readLatestInterviewSetup();
    const role = setup?.targetRole || setup?.role || "General";
    setTargetRole(role);

    // Fetch assessment
    const difficulty = isPremium ? "intermediate" : "foundational";
    fetch(`/api/technical-assessment?role=${encodeURIComponent(role)}&difficulty=${difficulty}&max=${isPremium ? 6 : 3}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.assessment) {
          setAssessment(data.assessment);
          setPhase("intro");
        } else {
          setError(data.error || "Failed to load assessment.");
          setPhase("error");
        }
      })
      .catch(() => {
        setError("Network error. Please try again.");
        setPhase("error");
      });
  }, [planState.loading, isPremium]);

  // Timer logic
  const startTimer = useCallback((seconds: number) => {
    setTimeLeft(seconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const currentQuestion = assessment?.questions[currentIndex];

  function startAssessment() {
    if (!assessment) return;
    setCurrentIndex(0);
    setAnswers([]);
    setCurrentMcq(null);
    setCurrentOpen("");
    setPhase("question");
    startTimer(assessment.questions[0].timeSeconds);
  }

  function captureCurrentAnswer(): CapturedAnswer | null {
    if (!currentQuestion) return null;
    const elapsed = currentQuestion.timeSeconds - timeLeft;
    if (currentQuestion.type === "multiple_choice") {
      if (currentMcq === null) return null;
      return {
        questionId: currentQuestion.id,
        skill: currentQuestion.skill,
        type: currentQuestion.type,
        question: currentQuestion.question,
        scoringGuide: currentQuestion.scoringGuide,
        difficulty: currentQuestion.difficulty,
        selectedOption: currentMcq,
        timeSeconds: elapsed,
      };
    }
    if (!currentOpen.trim()) return null;
    return {
      questionId: currentQuestion.id,
      skill: currentQuestion.skill,
      type: currentQuestion.type,
      question: currentQuestion.question,
      context: currentQuestion.context,
      scoringGuide: currentQuestion.scoringGuide,
      difficulty: currentQuestion.difficulty,
      openAnswer: currentOpen.trim(),
      timeSeconds: elapsed,
    };
  }

  function handleNext() {
    if (!assessment) return;
    const captured = captureCurrentAnswer();
    if (!captured) return; // nothing selected — block advance

    const updatedAnswers = [...answers, captured];
    setAnswers(updatedAnswers);

    if (currentIndex < assessment.questions.length - 1) {
      const nextQ = assessment.questions[currentIndex + 1];
      setCurrentIndex(currentIndex + 1);
      setCurrentMcq(null);
      setCurrentOpen("");
      startTimer(nextQ.timeSeconds);
    } else {
      // All answered — submit
      submitAssessment(updatedAnswers);
    }
  }

  async function submitAssessment(finalAnswers: CapturedAnswer[]) {
    setPhase("submitting");
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const res = await fetch("/api/technical-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRole, answers: finalAnswers }),
      });
      const data = await res.json();
      if (data.ok && data.result) {
        // Persist to localStorage for results page + readiness score
        try {
          window.localStorage.setItem(
            "workzo_technical_result",
            JSON.stringify({ ...data.result, savedAt: new Date().toISOString() }),
          );
        } catch {}
        setResult(data.result);
        setPhase("results");
      } else {
        setError(data.error || "Scoring failed.");
        setPhase("error");
      }
    } catch {
      setError("Network error during submission.");
      setPhase("error");
    }
  }

  // ── RENDER: loading ──────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <main className="min-h-screen bg-[#0a0a1a] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-400 border-t-transparent mx-auto" />
          <p className="mt-4 text-sm text-slate-400">Building your assessment…</p>
        </div>
      </main>
    );
  }

  // ── RENDER: error ────────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <main className="min-h-screen bg-[#0a0a1a] text-white flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <p className="text-lg font-black text-rose-300">Something went wrong</p>
          <p className="mt-2 text-sm text-slate-400">{error}</p>
          <Link href="/dashboard" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-black hover:bg-white/20">
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  // ── RENDER: intro ────────────────────────────────────────────────────────────
  if (phase === "intro" && assessment) {
    return (
      <main className="min-h-screen bg-[#0a0a1a] text-white px-4 py-10">
        <div className="mx-auto max-w-2xl">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 mb-8">
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </Link>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-7">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-500/15">
                <BarChart3 className="h-6 w-6 text-blue-300" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-300">Technical Assessment</p>
                <h1 className="mt-1 text-2xl font-black text-white">{targetRole}</h1>
                <p className="mt-1 text-sm text-slate-400">{assessment.roleCluster.replace(/_/g, " ")} · {assessment.difficulty}</p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                { label: "Questions", value: assessment.totalQuestions },
                { label: "Est. time", value: `${assessment.estimatedMinutes} min` },
                { label: "Difficulty", value: assessment.difficulty },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl border border-white/10 bg-black/20 p-3 text-center">
                  <p className="text-xl font-black text-white">{value}</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-2">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">Skills being tested</p>
              <div className="flex flex-wrap gap-2">
                {[...new Set(assessment.questions.map((q) => q.skill))].map((skill) => (
                  <span key={skill} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-black text-slate-300">
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
              <p className="text-xs font-black text-amber-200">Before you start</p>
              <ul className="mt-2 space-y-1">
                {[
                  "Each question has a time limit — answer within the timer",
                  "Multiple choice: tap to select, then click Next",
                  "Open questions: write clearly and specifically",
                  "Your score feeds into your Readiness Score on the results page",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs leading-5 text-amber-50">
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {!isPremium && (
              <div className="mt-4 rounded-xl border border-violet-400/20 bg-violet-500/[0.07] p-4 flex items-start gap-3">
                <Lock className="h-4 w-4 shrink-0 text-violet-300 mt-0.5" />
                <div>
                  <p className="text-xs font-black text-violet-200">Free plan: 3 foundational questions</p>
                  <p className="mt-1 text-xs text-slate-400">Upgrade to Premium for the full assessment with 6 questions, all types, and detailed AI scoring.</p>
                  <Link href="/pricing?intent=technical-assessment" className="mt-2 inline-flex items-center gap-1.5 text-xs font-black text-violet-300 hover:text-violet-100">
                    <Crown className="h-3.5 w-3.5" /> Unlock full assessment
                  </Link>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={startAssessment}
              className="mt-6 w-full rounded-xl bg-blue-500 py-3.5 text-sm font-black text-white hover:bg-blue-400 transition flex items-center justify-center gap-2"
            >
              Start assessment <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── RENDER: question ─────────────────────────────────────────────────────────
  if (phase === "question" && assessment && currentQuestion) {
    const progress = ((currentIndex) / assessment.totalQuestions) * 100;
    const canAdvance =
      currentQuestion.type === "multiple_choice"
        ? currentMcq !== null
        : currentOpen.trim().length >= 10;

    return (
      <main className="min-h-screen bg-[#0a0a1a] text-white px-4 py-8">
        <div className="mx-auto max-w-2xl">
          {/* Progress */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <SkillIcon type={currentQuestion.type} />
                <span className="text-xs font-black text-slate-400">{currentQuestion.skill}</span>
                <DifficultyBadge level={currentQuestion.difficulty} />
              </div>
              <span className="text-xs font-black text-slate-500">{currentIndex + 1} / {assessment.totalQuestions}</span>
            </div>
            <div className="h-1 bg-white/10 rounded-full overflow-hidden mb-3">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <Timer seconds={timeLeft} total={currentQuestion.timeSeconds} />
          </div>

          {/* Question card */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-300 mb-3">Question {currentIndex + 1}</p>
            <h2 className="text-base font-black text-white leading-7">{currentQuestion.question}</h2>

            {currentQuestion.context && (
              <div className="mt-4 rounded-xl bg-black/40 border border-white/10 p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Schema / Context</p>
                <pre className="text-xs text-slate-300 font-mono leading-5 whitespace-pre-wrap">{currentQuestion.context}</pre>
              </div>
            )}

            {/* MCQ */}
            {currentQuestion.type === "multiple_choice" && currentQuestion.options && (
              <div className="mt-5 space-y-2">
                {currentQuestion.options.map((option, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCurrentMcq(i)}
                    className={cn(
                      "w-full rounded-xl border p-3.5 text-left text-sm transition",
                      currentMcq === i
                        ? "border-blue-400/60 bg-blue-500/15 text-white font-black"
                        : "border-white/10 bg-black/20 text-slate-300 hover:bg-white/[0.06]",
                    )}
                  >
                    <span className={cn("mr-3 font-black", currentMcq === i ? "text-blue-300" : "text-slate-600")}>
                      {["A", "B", "C", "D"][i]}.
                    </span>
                    {option}
                  </button>
                ))}
              </div>
            )}

            {/* Open text / SQL / Code / Scenario */}
            {currentQuestion.type !== "multiple_choice" && (
              <div className="mt-5">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">
                  {currentQuestion.type === "sql" ? "Write your SQL query" :
                   currentQuestion.type === "code" ? "Write your code" :
                   "Your answer"}
                </p>
                <textarea
                  value={currentOpen}
                  onChange={(e) => setCurrentOpen(e.target.value)}
                  placeholder={
                    currentQuestion.type === "sql" ? "SELECT ..." :
                    currentQuestion.type === "code" ? "def solution():\n    ..." :
                    "Write your answer here..."
                  }
                  rows={currentQuestion.type === "sql" || currentQuestion.type === "code" ? 8 : 6}
                  className={cn(
                    "w-full rounded-xl border border-white/10 bg-black/30 p-3.5 text-sm text-slate-200 leading-6 resize-y outline-none focus:border-blue-400/60 focus:ring-1 focus:ring-blue-400/30 transition",
                    (currentQuestion.type === "sql" || currentQuestion.type === "code") && "font-mono",
                  )}
                />
                <p className="mt-1.5 text-[10px] text-slate-600">{currentOpen.split(/\s+/).filter(Boolean).length} words</p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-slate-600">
              {currentIndex === assessment.totalQuestions - 1 ? "Last question" : `${assessment.totalQuestions - currentIndex - 1} remaining`}
            </p>
            <button
              type="button"
              onClick={handleNext}
              disabled={!canAdvance}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black transition",
                canAdvance
                  ? "bg-blue-500 text-white hover:bg-blue-400"
                  : "bg-white/5 text-slate-600 cursor-not-allowed",
              )}
            >
              {currentIndex === assessment.totalQuestions - 1 ? "Submit" : "Next"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── RENDER: submitting ───────────────────────────────────────────────────────
  if (phase === "submitting") {
    return (
      <main className="min-h-screen bg-[#0a0a1a] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-400 border-t-transparent mx-auto" />
          <p className="mt-4 text-base font-black text-white">Scoring your answers…</p>
          <p className="mt-1 text-sm text-slate-400">AI evaluation in progress</p>
        </div>
      </main>
    );
  }

  // ── RENDER: results ──────────────────────────────────────────────────────────
  if (phase === "results" && result) {
    return (
      <main className="min-h-screen bg-[#0a0a1a] text-white px-4 py-10">
        <div className="mx-auto max-w-2xl">
          <Link href="/results" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 mb-6">
            <ArrowLeft className="h-3.5 w-3.5" /> Full results report
          </Link>

          {/* Score header */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
            <div className="flex items-center gap-5">
              <ScoreRing score={result.technicalScore} label="/100" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-300">Technical Score</p>
                <div className="mt-1 flex items-center gap-2">
                  <h1 className="text-2xl font-black text-white">{result.targetRole}</h1>
                  <GradeBadge grade={result.grade} />
                </div>
                <p className={cn(
                  "mt-1 text-sm font-black",
                  result.passed ? "text-emerald-300" : "text-rose-300",
                )}>
                  {result.passed ? "✓ Passed" : "✗ Below threshold"} · {result.recommendation}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300">Strongest</p>
                <p className="mt-1 text-sm font-black text-white">{result.strongestSkill}</p>
              </div>
              <div className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-rose-300">Weakest</p>
                <p className="mt-1 text-sm font-black text-white">{result.weakestSkill}</p>
              </div>
            </div>
          </div>

          {/* Skill breakdown */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400 mb-4">Skill Breakdown</p>
            <div className="space-y-4">
              {result.bySkill.map((skill) => (
                <div key={skill.questionId}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-white">{skill.skill}</span>
                      {skill.passed
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                        : <span className="rounded-full bg-rose-400/10 px-2 py-0.5 text-[10px] font-black text-rose-300">Gap</span>
                      }
                    </div>
                    <span className="text-sm font-black text-white">{skill.score}/100</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", skill.score >= 75 ? "bg-emerald-400" : skill.score >= 55 ? "bg-blue-400" : "bg-rose-400")}
                      style={{ width: `${clamp(skill.score)}%` }}
                    />
                  </div>
                  {skill.feedback && (
                    <p className="mt-1.5 text-xs leading-5 text-slate-400">{skill.feedback}</p>
                  )}
                  {skill.gaps.length > 0 && !skill.passed && (
                    <p className="mt-1 text-xs text-amber-300">→ {skill.gaps[0]}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Readiness score teaser */}
          <div className="mt-4 rounded-2xl border border-blue-400/20 bg-blue-500/[0.07] p-5">
            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 shrink-0 text-blue-300 mt-0.5" />
              <div>
                <p className="text-sm font-black text-white">This score is now part of your Readiness Score</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Your technical score of <span className="font-black text-white">{result.technicalScore}/100</span> has been added to your overall interview readiness profile. View your full score breakdown on the results page.
                </p>
                <Link href="/results" className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-blue-500 px-4 py-2 text-xs font-black text-white hover:bg-blue-400 transition">
                  View Readiness Score <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* CTA: retry or interview */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setPhase("intro");
                setAnswers([]);
                setCurrentIndex(0);
                setCurrentMcq(null);
                setCurrentOpen("");
                setResult(null);
              }}
              className="rounded-xl border border-white/10 bg-white/[0.04] py-3 text-sm font-black text-slate-300 hover:bg-white/[0.08] transition"
            >
              Retry assessment
            </button>
            <Link
              href="/interview"
              className="rounded-xl bg-white py-3 text-sm font-black text-slate-950 hover:bg-slate-200 transition text-center flex items-center justify-center gap-2"
            >
              <Zap className="h-4 w-4" /> Start interview
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return null;
}
