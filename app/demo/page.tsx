"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { ArrowRight, BarChart3, CheckCircle2, Mic, Play, Sparkles, Volume2 } from "lucide-react";
import WorkZoFooter from "@/components/WorkZoFooter";

type RecruiterId = "sarah" | "daniel" | "priya" | "markus";
type RoleId = "customer-success" | "data-analyst" | "software-engineer" | "it-support";

const demoRoles = [
  { id: "customer-success" as RoleId, label: "Customer Success Manager" },
  { id: "data-analyst" as RoleId, label: "Data Analyst" },
  { id: "software-engineer" as RoleId, label: "Software Engineer" },
  { id: "it-support" as RoleId, label: "IT Support Specialist" },
];

const recruiters = [
  { id: "sarah" as RecruiterId, name: "Sarah", style: "Friendly HR Recruiter", image: "/recruiters/sarah.png" },
  { id: "daniel" as RecruiterId, name: "Daniel", style: "Analytical Hiring Manager", image: "/recruiters/daniel.png" },
  { id: "priya" as RecruiterId, name: "Priya", style: "Startup Recruiter", image: "/recruiters/priya.png" },
  { id: "markus" as RecruiterId, name: "Markus", style: "Structured Corporate Lead", image: "/recruiters/markus.png" },
];

const questionBank: Record<RoleId, Record<RecruiterId, string[]>> = {
  "customer-success": {
    sarah: ["A customer is unhappy because results took longer than expected. How do you handle the conversation without sounding defensive?", "Tell me about a time you had to rebuild trust with a customer. What exactly did you say?", "If your customer health score drops but the customer says everything is fine, what do you investigate first?"],
    daniel: ["How would you identify whether churn risk is caused by product gaps, onboarding problems, or wrong expectations?", "Give me a specific example of how you used data to improve customer retention.", "A high-value customer asks for a feature you cannot deliver. How do you protect the relationship?"],
    priya: ["In a startup with no process, how would you create a repeatable customer success motion from scratch?", "How do you balance urgent customer requests with limited engineering bandwidth?", "Describe a time you turned customer feedback into a product improvement."],
    markus: ["Explain your customer escalation process step by step, from first signal to resolution.", "What metrics would you track weekly to prove customer success is improving?", "How do you document customer risks so another team member can take over?"],
  },
  "data-analyst": {
    sarah: ["Tell me about an analysis where the first result was misleading. How did you validate it?", "How would you explain a complex dashboard insight to a non-technical stakeholder?", "Describe a project where your analysis directly changed a business decision."],
    daniel: ["Walk me through how you would approach building a churn prediction model from scratch.", "Give me a specific example of a KPI you designed and the business problem it solved.", "How do you decide which data to include and which to exclude from a report?"],
    priya: ["You have limited data and a one-week deadline. What is your analytical process?", "How have you used SQL to solve a business problem that was not initially framed as a data question?", "Tell me about a time a stakeholder rejected your findings. How did you respond?"],
    markus: ["How do you ensure data quality before presenting findings to leadership?", "Walk me through the governance process you follow when publishing a new metric.", "What is your approach to version control and documentation for analytical work?"],
  },
  "software-engineer": {
    sarah: ["Tell me about a bug you found in production. How did you diagnose and fix it?", "How do you decide when to refactor vs rewrite a piece of code?", "Describe a feature you built that you are most proud of."],
    daniel: ["Walk me through a technical decision you made that had a significant performance impact.", "How do you approach code reviews, both giving and receiving feedback?", "Give me an example of how you reduced technical debt in a production system."],
    priya: ["How do you handle ambiguous requirements when the product direction is unclear?", "Tell me about a time you had to ship fast and what trade-offs you made.", "How have you contributed to improving engineering culture at a previous company?"],
    markus: ["Describe your approach to writing documentation that stays up to date.", "How do you ensure compliance and security standards are met in your code?", "Walk me through how you collaborate with cross-functional teams on a large feature."],
  },
  "it-support": {
    sarah: ["Tell me about a time you helped a non-technical user solve a complex issue. How did you communicate?", "How do you prioritize when multiple tickets need urgent attention at the same time?", "Describe a situation where you went beyond the ticket to prevent a future issue."],
    daniel: ["Walk me through how you would diagnose a network connectivity issue for a remote user.", "How do you document recurring issues so future technicians can resolve them faster?", "Give me an example of a process improvement you introduced in a support role."],
    priya: ["How do you handle a user who is frustrated and escalating even when the issue is minor?", "Tell me about a tool or script you built to solve a repetitive support problem.", "How do you stay current with new technologies and security threats?"],
    markus: ["Describe your process for managing SLA compliance across a high-volume ticket queue.", "How do you escalate an issue that requires development team involvement?", "What does good IT documentation look like to you, and why?"],
  },
};

export default function DemoPage() {
  const [role, setRole] = useState<RoleId>("customer-success");
  const [recruiter, setRecruiter] = useState<RecruiterId>("sarah");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [speaking, setSpeaking] = useState(false);

  const questions = questionBank[role][recruiter];
  const activeQuestion = questions[questionIndex] ?? questions[0];
  const activeRole = demoRoles.find((r) => r.id === role)!;
  const activeRecruiter = recruiters.find((r) => r.id === recruiter)!;

  function nextQuestion() {
    setQuestionIndex((i) => (i + 1) % (questions.length));
  }

  function speakQuestion() {
    if (!window.speechSynthesis || speaking) return;
    setSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(activeQuestion);
    utterance.rate = 0.88;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  return (
    <main className="min-h-screen bg-canvas text-fg">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(37, 99, 235,0.08),transparent_55%)]" />

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-on-brand">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-xl font-black">WorkZo <span className="text-brand">AI</span></span>
          </Link>
          <Link href="/onboarding" className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-black text-on-brand hover:bg-brand">
            Start with your CV <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-10 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-brand">
            <Sparkles className="h-3.5 w-3.5" /> Interactive demo
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-[-0.04em] sm:text-4xl">
            Try a recruiter question
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted">
            Pick a role and recruiter to hear a sample question. In the real interview, questions are built from <em>your</em> CV, not a generic bank.
          </p>
        </div>

        {/* Main demo area */}
        <div className="mt-12 grid gap-6 lg:grid-cols-[340px_1fr]">
          {/* Config panel */}
          <div className="space-y-5">
            <div className="rounded-xl border border-line bg-fg/[0.04] p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-muted mb-3">Target role</p>
              <div className="grid gap-2">
                {demoRoles.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => { setRole(r.id); setQuestionIndex(0); }}
                    className={`rounded-xl border px-4 py-3 text-left text-sm font-black transition ${
                      role === r.id
                        ? "border-brand/50 bg-brand/15 text-brand"
                        : "border-line bg-canvas-soft text-muted hover:text-fg hover:border-line"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-line bg-fg/[0.04] p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-muted mb-3">Recruiter</p>
              <div className="grid grid-cols-2 gap-2">
                {recruiters.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => { setRecruiter(r.id); setQuestionIndex(0); }}
                    className={`rounded-xl border p-3 text-left transition ${
                      recruiter === r.id
                        ? "border-brand/50 bg-brand/15"
                        : "border-line bg-canvas-soft hover:border-line"
                    }`}
                  >
                    <img src={r.image} alt={r.name} className="h-10 w-10 rounded-xl object-cover" />
                    <p className="mt-2 text-sm font-black text-fg">{r.name}</p>
                    <p className="mt-0.5 text-[11px] text-muted">{r.style}</p>
                  </button>
                ))}
              </div>
            </div>

            <Link
              href="/onboarding"
              className="block w-full rounded-lg bg-fg px-5 py-4 text-center text-sm font-black text-canvas hover:bg-brand hover:text-on-brand"
            >
              Start real interview with my CV
              <ArrowRight className="ml-2 inline h-4 w-4" />
            </Link>
          </div>

          {/* Question panel */}
          <div className="flex flex-col gap-5">
            {/* Recruiter header */}
            <div className="flex items-center gap-4 rounded-xl border border-line bg-fg/[0.04] p-5">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg">
                <Image src={activeRecruiter.image} alt={activeRecruiter.name} fill className="object-cover" />
              </div>
              <div>
                <p className="text-lg font-black">{activeRecruiter.name}</p>
                <p className="text-sm text-muted">{activeRecruiter.style} · {activeRole.label}</p>
              </div>
              <div className="ml-auto flex items-center gap-2 rounded-full border border-success/20 bg-success/10 px-3 py-1.5">
                <span className="h-2 w-2 rounded-full bg-success" />
                <span className="text-xs font-black text-success">Demo</span>
              </div>
            </div>

            {/* Question */}
            <div className="flex-1 rounded-xl border border-line bg-canvas p-7">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand mb-5">Question {questionIndex + 1} of {questions.length}</p>
              <p className="text-2xl font-black leading-snug text-fg sm:text-3xl">
                {activeQuestion}
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={speakQuestion}
                  disabled={speaking}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand px-5 py-4 text-sm font-black text-on-brand hover:bg-brand disabled:opacity-60"
                >
                  {speaking ? <Volume2 className="h-4 w-4 animate-pulse" /> : <Play className="h-4 w-4" />}
                  {speaking ? "Speaking…" : "Hear the question"}
                </button>
                <button
                  type="button"
                  onClick={nextQuestion}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-line bg-fg/[0.05] px-5 py-4 text-sm font-black text-fg hover:bg-fg/10"
                >
                  Next question
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Feature badges */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Mic, text: "Role-specific questions", sub: "Built for the JD you target" },
                { icon: BarChart3, text: "Live trust score", sub: "Updates after every answer" },
                { icon: CheckCircle2, text: "CV-aware follow-ups", sub: "Based on your real experience" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.text} className="rounded-lg border border-line bg-fg/[0.03] p-4">
                    <Icon className="h-4 w-4 text-brand mb-2" />
                    <p className="text-sm font-black text-fg leading-4">{item.text}</p>
                    <p className="mt-1 text-[11px] text-subtle">{item.sub}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-14 rounded-lg border border-brand/20 bg-brand/[0.07] p-8 text-center">
          <h2 className="text-3xl font-black tracking-tight">The real interview reads your CV.</h2>
          <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-muted">
            The demo shows sample questions. The real interview uses your actual CV and job description, so every follow-up is specific to your experience.
          </p>
          <Link
            href="/onboarding"
            className="mt-7 inline-flex items-center gap-2 rounded-lg bg-brand px-7 py-4 text-sm font-black text-on-brand shadow-lg shadow-brand/20 hover:bg-brand"
          >
            Start with my CV <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-4 text-xs text-subtle">Free · No credit card · 2 interviews per month</p>
        </div>
      </div>

      <WorkZoFooter />
    </main>
  );
}
