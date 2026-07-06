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
      <Clock className={cn("h-3.5 w-3.5 shrink-0", urgent ? "text-danger" : "text-muted")} />
      <div className="flex-1 h-1 bg-fg/10 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", urgent ? "bg-danger" : "bg-brand")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn("text-xs font-black tabular-nums w-10 text-right", urgent ? "text-danger" : "text-muted")}>
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
      <div className="grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full bg-canvas text-center">
        <div>
          <p className="text-2xl font-black text-fg">{score}</p>
          <p className="text-[10px] font-black text-muted">{label}</p>
        </div>
      </div>
    </div>
  );
}

// ── Grade badge ────────────────────────────────────────────────────────────────

function GradeBadge({ grade }: { grade: string }) {
  const cls =
    grade === "A" ? "bg-success/10 text-success border-success/20" :
    grade === "B" ? "bg-brand/10 text-brand border-brand/20" :
    grade === "C" ? "bg-warning/10 text-warning border-warning/20" :
    "bg-danger/10 text-danger border-danger/20";
  return (
    <span className={cn("rounded-lg border px-2.5 py-1 text-sm font-black", cls)}>{grade}</span>
  );
}

// ── Skill type icon ────────────────────────────────────────────────────────────

function SkillIcon({ type }: { type: string }) {
  if (type === "sql") return <Database className="h-4 w-4 text-brand" />;
  if (type === "code") return <Code2 className="h-4 w-4 text-brand" />;
  return <Target className="h-4 w-4 text-warning" />;
}

// ── Difficulty badge ───────────────────────────────────────────────────────────

function DifficultyBadge({ level }: { level: string }) {
  const cls =
    level === "foundational" ? "bg-success/10 text-success" :
    level === "intermediate" ? "bg-warning/10 text-warning" :
    "bg-danger/10 text-danger";
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
    if (!captured) return; // nothing selected, block advance

    const updatedAnswers = [...answers, captured];
    setAnswers(updatedAnswers);

    if (currentIndex < assessment.questions.length - 1) {
      const nextQ = assessment.questions[currentIndex + 1];
      setCurrentIndex(currentIndex + 1);
      setCurrentMcq(null);
      setCurrentOpen("");
      startTimer(nextQ.timeSeconds);
    } else {
      // All answered, submit
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
      <main className="min-h-screen bg-canvas text-fg flex items-center justify-center">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand border-t-transparent mx-auto" />
          <p className="mt-4 text-sm text-muted">Building your assessment…</p>
        </div>
      </main>
    );
  }

  // ── RENDER: error ────────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <main className="min-h-screen bg-canvas text-fg flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <p className="text-lg font-black text-danger">Something went wrong</p>
          <p className="mt-2 text-sm text-muted">{error}</p>
          <Link href="/dashboard" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-fg/10 px-4 py-2 text-sm font-black hover:bg-fg/20">
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  // ── RENDER: intro ────────────────────────────────────────────────────────────
  if (phase === "intro" && assessment) {
    return (
      <main className="min-h-screen bg-canvas text-fg px-4 py-10">
        <div className="mx-auto max-w-2xl">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-subtle hover:text-muted mb-8">
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </Link>

          <div className="rounded-2xl border border-line bg-fg/[0.035] p-7">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand/15">
                <BarChart3 className="h-6 w-6 text-brand" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-brand">Technical Assessment</p>
                <h1 className="mt-1 text-2xl font-black text-fg">{targetRole}</h1>
                <p className="mt-1 text-sm text-muted">{assessment.roleCluster.replace(/_/g, " ")} · {assessment.difficulty}</p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                { label: "Questions", value: assessment.totalQuestions },
                { label: "Est. time", value: `${assessment.estimatedMinutes} min` },
                { label: "Difficulty", value: assessment.difficulty },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl border border-line bg-canvas-soft p-3 text-center">
                  <p className="text-xl font-black text-fg">{value}</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-subtle">{label}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-2">
              <p className="text-xs font-black uppercase tracking-wider text-subtle">Skills being tested</p>
              <div className="flex flex-wrap gap-2">
                {[...new Set(assessment.questions.map((q) => q.skill))].map((skill) => (
                  <span key={skill} className="rounded-full border border-line bg-fg/[0.04] px-3 py-1 text-xs font-black text-muted">
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-warning/20 bg-warning/[0.06] p-4">
              <p className="text-xs font-black text-warning">Before you start</p>
              <ul className="mt-2 space-y-1">
                {[
                  "Each question has a time limit, answer within the timer",
                  "Multiple choice: tap to select, then click Next",
                  "Open questions: write clearly and specifically",
                  "Your score feeds into your Readiness Score on the results page",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-xs leading-5 text-warning">
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-warning" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {!isPremium && (
              <div className="mt-4 rounded-xl border border-brand/20 bg-brand/[0.07] p-4 flex items-start gap-3">
                <Lock className="h-4 w-4 shrink-0 text-brand mt-0.5" />
                <div>
                  <p className="text-xs font-black text-brand">Free plan: 3 foundational questions</p>
                  <p className="mt-1 text-xs text-muted">Upgrade to Premium for the full assessment with 6 questions, all types, and detailed AI scoring.</p>
                  <Link href="/pricing?intent=technical-assessment" className="mt-2 inline-flex items-center gap-1.5 text-xs font-black text-brand hover:text-brand">
                    <Crown className="h-3.5 w-3.5" /> Unlock full assessment
                  </Link>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={startAssessment}
              className="mt-6 w-full rounded-xl bg-brand py-3.5 text-sm font-black text-on-brand hover:bg-brand transition flex items-center justify-center gap-2"
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
      <main className="min-h-screen bg-canvas text-fg px-4 py-8">
        <div className="mx-auto max-w-2xl">
          {/* Progress */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <SkillIcon type={currentQuestion.type} />
                <span className="text-xs font-black text-muted">{currentQuestion.skill}</span>
                <DifficultyBadge level={currentQuestion.difficulty} />
              </div>
              <span className="text-xs font-black text-subtle">{currentIndex + 1} / {assessment.totalQuestions}</span>
            </div>
            <div className="h-1 bg-fg/10 rounded-full overflow-hidden mb-3">
              <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <Timer seconds={timeLeft} total={currentQuestion.timeSeconds} />
          </div>

          {/* Question card */}
          <div className="rounded-2xl border border-line bg-fg/[0.035] p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-brand mb-3">Question {currentIndex + 1}</p>
            <h2 className="text-base font-black text-fg leading-7">{currentQuestion.question}</h2>

            {currentQuestion.context && (
              <div className="mt-4 rounded-xl bg-canvas-soft border border-line p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-subtle mb-1.5">Schema / Context</p>
                <pre className="text-xs text-muted font-mono leading-5 whitespace-pre-wrap">{currentQuestion.context}</pre>
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
                        ? "border-brand/60 bg-brand/15 text-on-brand font-black"
                        : "border-line bg-canvas-soft text-muted hover:bg-fg/[0.06]",
                    )}
                  >
                    <span className={cn("mr-3 font-black", currentMcq === i ? "text-brand" : "text-subtle")}>
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
                <p className="text-[10px] font-black uppercase tracking-wider text-subtle mb-2">
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
                    "w-full rounded-xl border border-line bg-canvas-soft p-3.5 text-sm text-fg leading-6 resize-y outline-none focus:border-brand/60 focus:ring-1 focus:ring-brand/30 transition",
                    (currentQuestion.type === "sql" || currentQuestion.type === "code") && "font-mono",
                  )}
                />
                <p className="mt-1.5 text-[10px] text-subtle">{currentOpen.split(/\s+/).filter(Boolean).length} words</p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-subtle">
              {currentIndex === assessment.totalQuestions - 1 ? "Last question" : `${assessment.totalQuestions - currentIndex - 1} remaining`}
            </p>
            <button
              type="button"
              onClick={handleNext}
              disabled={!canAdvance}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black transition",
                canAdvance
                  ? "bg-brand text-on-brand hover:bg-brand"
                  : "bg-fg/5 text-subtle cursor-not-allowed",
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
      <main className="min-h-screen bg-canvas text-fg flex items-center justify-center">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand border-t-transparent mx-auto" />
          <p className="mt-4 text-base font-black text-fg">Scoring your answers…</p>
          <p className="mt-1 text-sm text-muted">AI evaluation in progress</p>
        </div>
      </main>
    );
  }

  // ── RENDER: results ──────────────────────────────────────────────────────────
  if (phase === "results" && result) {
    return (
      <main className="min-h-screen bg-canvas text-fg px-4 py-10">
        <div className="mx-auto max-w-2xl">
          <Link href="/results" className="inline-flex items-center gap-1.5 text-xs text-subtle hover:text-muted mb-6">
            <ArrowLeft className="h-3.5 w-3.5" /> Full results report
          </Link>

          {/* Score header */}
          <div className="rounded-2xl border border-line bg-fg/[0.035] p-6">
            <div className="flex items-center gap-5">
              <ScoreRing score={result.technicalScore} label="/100" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-brand">Technical Score</p>
                <div className="mt-1 flex items-center gap-2">
                  <h1 className="text-2xl font-black text-fg">{result.targetRole}</h1>
                  <GradeBadge grade={result.grade} />
                </div>
                <p className={cn(
                  "mt-1 text-sm font-black",
                  result.passed ? "text-success" : "text-danger",
                )}>
                  {result.passed ? "✓ Passed" : "✗ Below threshold"} · {result.recommendation}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-success/20 bg-success/[0.06] p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-success">Strongest</p>
                <p className="mt-1 text-sm font-black text-fg">{result.strongestSkill}</p>
              </div>
              <div className="rounded-xl border border-danger/20 bg-danger/[0.06] p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-danger">Weakest</p>
                <p className="mt-1 text-sm font-black text-fg">{result.weakestSkill}</p>
              </div>
            </div>
          </div>

          {/* Skill breakdown */}
          <div className="mt-4 rounded-2xl border border-line bg-fg/[0.035] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-muted mb-4">Skill Breakdown</p>
            <div className="space-y-4">
              {result.bySkill.map((skill) => (
                <div key={skill.questionId}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-fg">{skill.skill}</span>
                      {skill.passed
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        : <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-black text-danger">Gap</span>
                      }
                    </div>
                    <span className="text-sm font-black text-fg">{skill.score}/100</span>
                  </div>
                  <div className="h-1.5 bg-fg/10 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", skill.score >= 75 ? "bg-success" : skill.score >= 55 ? "bg-brand" : "bg-danger")}
                      style={{ width: `${clamp(skill.score)}%` }}
                    />
                  </div>
                  {skill.feedback && (
                    <p className="mt-1.5 text-xs leading-5 text-muted">{skill.feedback}</p>
                  )}
                  {skill.gaps.length > 0 && !skill.passed && (
                    <p className="mt-1 text-xs text-warning">→ {skill.gaps[0]}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Readiness score teaser */}
          <div className="mt-4 rounded-2xl border border-brand/20 bg-brand/[0.07] p-5">
            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 shrink-0 text-brand mt-0.5" />
              <div>
                <p className="text-sm font-black text-fg">This score is now part of your Readiness Score</p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  Your technical score of <span className="font-black text-fg">{result.technicalScore}/100</span> has been added to your overall interview readiness profile. View your full score breakdown on the results page.
                </p>
                <Link href="/results" className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-black text-on-brand hover:bg-brand transition">
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
              className="rounded-xl border border-line bg-fg/[0.04] py-3 text-sm font-black text-muted hover:bg-fg/[0.08] transition"
            >
              Retry assessment
            </button>
            <Link
              href="/interview"
              className="rounded-xl bg-fg py-3 text-sm font-black text-canvas hover:bg-brand hover:text-on-brand transition text-center flex items-center justify-center gap-2"
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
