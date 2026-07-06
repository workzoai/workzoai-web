import type { Metadata } from "next";
import { BookOpen, Mail, Mic, Settings, Upload, Wand2 } from "lucide-react";
import { MarketingShell, Reveal, Eyebrow, SectionHeading, CTASection, BackLink } from "@/components/marketing/kit";

export const metadata: Metadata = {
  title: "Help Center — WorkZo AI",
  description: "Step-by-step help with onboarding, CV uploads, interviews, results, and billing.",
};

const sections = [
  { icon: BookOpen, title: "Getting started", steps: ["Go to Onboarding and upload or paste your CV", "Paste the job description for the role you are targeting", "Choose a recruiter style and interview atmosphere", "Click Start Interview and the AI recruiter asks the first question"] },
  { icon: Upload, title: "CV upload", steps: ["Accepted formats: PDF, DOCX, TXT", "If a PDF extracts poorly, paste the CV text manually instead", "Single-column CVs extract most accurately", "Review the extracted profile before starting"] },
  { icon: Mic, title: "Interview tips", steps: ["Allow microphone access when the browser prompts", "Use a quiet room; background noise breaks recognition", "Answer in STAR: situation, your action, measurable result", "Include at least one metric in every answer"] },
  { icon: Wand2, title: "Understanding results", steps: ["Start with the weakest answer, that is the highest-value fix", "Review the trust timeline to see which answers hurt most", "Use the improvement plan for a structured retry", "Run another session after improving to track progress"] },
  { icon: Settings, title: "Account and billing", steps: ["Login uses email magic link or Google sign-in", "Cancel anytime; access continues until the period ends", "Manage your plan from Account settings", "Billing issues: support@workzoai.com"] },
  { icon: Mail, title: "Contact support", steps: ["Email: support@workzoai.com", "Include the page you were on and a description of the issue", "Screenshots help us diagnose faster", "We respond within one business day"] },
];

export default function HelpPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <BackLink href="/">Back home</BackLink>
      </div>

      <section className="mx-auto max-w-7xl px-4 pb-12 pt-8 text-center sm:px-6 lg:px-8">
        <Reveal>
          <div className="flex justify-center"><Eyebrow icon={BookOpen}>Help Center</Eyebrow></div>
          <h1 className="mx-auto mt-5 max-w-2xl text-4xl font-black tracking-tight sm:text-5xl">How can we help?</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-muted">
            Step-by-step guidance for every part of WorkZo AI, from uploading your CV to understanding your results.
          </p>
        </Reveal>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {sections.map((s, i) => {
            const Icon = s.icon;
            return (
              <Reveal key={s.title} delay={(i % 3) * 60}>
                <div className="h-full rounded-2xl border border-line bg-surface/70 p-6">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="mt-5 text-lg font-black tracking-tight">{s.title}</h2>
                  <ul className="mt-4 space-y-3">
                    {s.steps.map((t) => (
                      <li key={t} className="flex items-start gap-3 text-sm leading-6 text-muted">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand/60" />{t}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      <CTASection
        title="Ready to start?"
        intro="Upload your CV and run a free practice interview now, no credit card needed."
        primary={{ href: "/onboarding", label: "Start free interview" }}
        secondary={{ href: "/faq", label: "Read the FAQ" }}
      />
    </MarketingShell>
  );
}
