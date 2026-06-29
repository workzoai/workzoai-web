import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, HelpCircle, Mail, Mic, Settings, Sparkles, Upload } from "lucide-react";
import WorkZoFooter from "@/components/WorkZoFooter";

export const metadata = {
  title: "Help Center | WorkZo AI",
  description: "Get help with WorkZo AI — onboarding, CV uploads, interviews, results, and billing.",
};

const sections = [
  {
    icon: BookOpen,
    title: "Getting started",
    color: "text-brand",
    bg: "bg-brand/10",
    border: "border-brand/15",
    steps: [
      { step: "1", text: "Go to Onboarding and upload or paste your CV" },
      { step: "2", text: "Paste the job description for the role you are targeting" },
      { step: "3", text: "Choose a recruiter style and interview atmosphere" },
      { step: "4", text: "Click Start Interview — the AI recruiter asks the first question" },
    ],
  },
  {
    icon: Upload,
    title: "CV upload",
    color: "text-success",
    bg: "bg-success/10",
    border: "border-success/15",
    steps: [
      { step: "✓", text: "Accepted formats: PDF, DOCX, TXT" },
      { step: "✓", text: "If PDF extracts poorly, paste CV text manually instead" },
      { step: "✓", text: "Single-column CVs extract most accurately" },
      { step: "✓", text: "Review the extracted profile before starting" },
    ],
  },
  {
    icon: Mic,
    title: "Interview tips",
    color: "text-brand",
    bg: "bg-brand/10",
    border: "border-brand/15",
    steps: [
      { step: "✓", text: "Allow microphone access when the browser prompts" },
      { step: "✓", text: "Use a quiet room — background noise breaks recognition" },
      { step: "✓", text: "Answer in STAR: situation, your action, measurable result" },
      { step: "✓", text: "Include at least one metric in every answer" },
    ],
  },
  {
    icon: HelpCircle,
    title: "Understanding results",
    color: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/15",
    steps: [
      { step: "✓", text: "Start with the weakest answer — that is the highest-value fix" },
      { step: "✓", text: "Review the trust timeline to see which answers hurt most" },
      { step: "✓", text: "Use the improvement roadmap for a structured retry plan" },
      { step: "✓", text: "Run another session after improving to track progress" },
    ],
  },
  {
    icon: Settings,
    title: "Account and billing",
    color: "text-brand",
    bg: "bg-brand/10",
    border: "border-brand/15",
    steps: [
      { step: "✓", text: "Login uses email magic link or Google OAuth" },
      { step: "✓", text: "Plans: Free · Premium €19.99/mo · Premium Pro €39.99/mo" },
      { step: "✓", text: "Cancel anytime — access continues until the period ends" },
      { step: "✓", text: "Billing issues: support@workzoai.com" },
    ],
  },
  {
    icon: Mail,
    title: "Contact support",
    color: "text-muted",
    bg: "bg-fg/[0.05]",
    border: "border-line",
    steps: [
      { step: "→", text: "Email: support@workzoai.com" },
      { step: "→", text: "Include the page you were on and a description of the issue" },
      { step: "→", text: "Screenshots help us diagnose faster" },
      { step: "→", text: "We respond within 24 hours on business days" },
    ],
  },
];

export default function HelpPage() {
  return (
    <main className="min-h-screen bg-canvas text-fg">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(37, 99, 235,0.07),transparent_55%)]" />

      <div className="mx-auto max-w-5xl px-5 py-12 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-black text-muted transition hover:text-fg">
          <ArrowLeft className="h-4 w-4" /> Back home
        </Link>

        <header className="mt-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-brand">
            <Sparkles className="h-3.5 w-3.5" /> Help center
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-[-0.04em] sm:text-3xl">How can we help?</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
            Step-by-step guidance for every part of WorkZo AI — from uploading your CV to understanding your results.
          </p>
        </header>

        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.title} className={`rounded-xl border ${s.border} bg-fg/[0.03] p-5 transition hover:bg-fg/[0.05]`}>
                <div className={`grid h-11 w-11 place-items-center rounded-xl ${s.bg}`}>
                  <Icon className={`h-5 w-5 ${s.color}`} />
                </div>
                <h2 className="mt-4 text-lg font-black">{s.title}</h2>
                <ul className="mt-4 space-y-3">
                  {s.steps.map((step) => (
                    <li key={step.text} className="flex items-start gap-3 text-sm leading-5">
                      <span className={`mt-0.5 shrink-0 text-xs font-black ${s.color}`}>{step.step}</span>
                      <span className="text-muted">{step.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-brand/20 bg-brand/[0.07] p-6">
            <h2 className="text-xl font-black">Ready to start?</h2>
            <p className="mt-2 text-sm leading-6 text-muted">Upload your CV and run a free practice interview now — no credit card needed.</p>
            <Link href="/onboarding" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-black text-on-brand hover:bg-brand">
              Start free interview <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="rounded-xl border border-line bg-fg/[0.03] p-6">
            <h2 className="text-xl font-black">Still stuck?</h2>
            <p className="mt-2 text-sm leading-6 text-muted">Email the WorkZo AI team and we will get back to you within 24 hours.</p>
            <a href="mailto:support@workzoai.com" className="mt-5 inline-flex items-center gap-2 rounded-lg border border-line bg-fg/[0.05] px-5 py-3 text-sm font-black text-fg hover:bg-fg/10">
              support@workzoai.com <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>

      <WorkZoFooter />
    </main>
  );
}
