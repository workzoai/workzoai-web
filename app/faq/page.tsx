"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { MarketingShell, Reveal, Eyebrow, BackLink, PrimaryButton, GhostButton } from "@/components/marketing/kit";

const faqs = [
  { q: "How does WorkZo AI work?", cat: "product", a: "You upload or paste your CV and the job description you are targeting. WorkZo AI builds an AI recruiter that asks follow-up questions based on your actual experience, not a generic question bank. After each answer you see a live trust score and exactly why it rose or fell." },
  { q: "Is this a real recruiter?", cat: "product", a: "No. WorkZo AI is interview preparation. It simulates realistic recruiter-style conversations to help you practise: it does not represent any employer and does not guarantee interviews or offers." },
  { q: "What makes WorkZo AI different?", cat: "product", a: "Most tools give you a list of generic questions. WorkZo reads your CV and JD, then asks follow-up questions based on what you actually said. If you claim experience not in your CV, the recruiter challenges it in real time. The trust score updates as you answer so you know exactly what is working." },
  { q: "What is in the Free plan?", cat: "plans", a: "Free gives you 1 complete AI voice interview, a basic interview report, a basic STAR scorecard, and standard recruiter personas. It lets you experience the engine before upgrading." },
  { q: "What does Premium unlock?", cat: "plans", a: "Premium gives you 120 voice minutes a month with unlimited sessions, full advanced reports, Improve CV with ATS keyword analysis, Cover Letter generation, Job Assist with fit scores and likely questions, Career Brain memory, and multi-session trend tracking." },
  { q: "What is Premium Pro?", cat: "plans", a: "Premium Pro is the complete interview mastery system. It includes 240 AI voice minutes a month, 60 AI video minutes, premium personas, AI Career Coach, interactive 30/60/90 day career roadmaps, Replay Intelligence, and priority AI models." },
  { q: "Can I cancel anytime?", cat: "plans", a: "Yes. No lock-in. Cancel at any time and keep access until the end of your billing period." },
  { q: "What happens when my minutes finish?", cat: "plans", a: "You can continue using non-voice tools included in your plan, such as CV optimization, ATS analysis, cover letters, and job preparation. To run more voice or video interviews, wait for the monthly reset or upgrade when add-on credits are available." },
  { q: "Do you offer bootcamp or university plans?", cat: "plans", a: "Yes. Enterprise and Education plans are available for coding bootcamps, universities, career centers, and talent teams. They include shared voice/video minute pools, admin dashboards, student analytics, academic integrity checks, and LMS/API integration. Request a demo from the pricing page." },
  { q: "Is my CV stored?", cat: "privacy", a: "Your CV is used to generate your practice experience and career tools. WorkZo AI does not sell CV data. You can request deletion by emailing support@workzoai.com." },
  { q: "Does it work for any job or industry?", cat: "global", a: "Yes. WorkZo AI adapts to the job description you provide. It has been tested across tech, finance, sales, customer success, consulting, data, product, and support roles." },
  { q: "What languages are supported?", cat: "global", a: "English, German, Dutch, French, Spanish, Italian, Portuguese, Chinese, Hindi, Arabic, Japanese, Korean, Polish, Russian, and Turkish. The recruiter conducts the full interview in your selected language, not just the UI translation." },
  { q: "How does WorkZo AI handle my CV data?", cat: "privacy", a: "Your CV and job context are used only to generate practice questions within your session. We do not share your data with employers. You can request deletion at any time by emailing support@workzoai.com." },
  { q: "How accurate is the recruiter feedback?", cat: "product", a: "The feedback is AI-generated coaching guidance. It helps improve structure, evidence, ownership, and clarity, but it is not a real hiring decision. Validate important feedback with a human mentor or career coach." },
];

const cats = [
  { id: "all", label: "All" },
  { id: "product", label: "Product" },
  { id: "plans", label: "Plans" },
  { id: "global", label: "Global" },
  { id: "privacy", label: "Privacy" },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line last:border-b-0">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-start justify-between gap-5 py-5 text-left">
        <span className="text-base font-black leading-6 text-fg">{q}</span>
        <ChevronDown className={`mt-0.5 h-5 w-5 shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180 text-brand" : ""}`} />
      </button>
      {open && <p className="pb-5 text-sm leading-7 text-muted">{a}</p>}
    </div>
  );
}

export default function FaqPage() {
  const [active, setActive] = useState("all");
  const visible = active === "all" ? faqs : faqs.filter((f) => f.cat === active);

  return (
    <MarketingShell>
      <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-6 lg:px-8">
        <BackLink href="/">Back home</BackLink>
      </div>

      <section className="mx-auto max-w-4xl px-4 pb-20 pt-8 sm:px-6 lg:px-8">
        <Reveal>
          <Eyebrow icon={HelpCircle}>FAQ</Eyebrow>
          <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">Frequently asked questions</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-muted">
            Everything you need to know about WorkZo AI: the product, the plans, your data, and how the intelligence works.
          </p>
        </Reveal>

        <Reveal delay={80} className="mt-8">
          <div className="flex flex-wrap gap-2">
            {cats.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActive(c.id)}
                className={`rounded-full border px-4 py-1.5 text-sm font-black transition ${
                  active === c.id ? "border-brand/50 bg-brand/15 text-brand" : "border-line bg-fg/[0.04] text-muted hover:text-fg"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </Reveal>

        <Reveal delay={120} className="mt-6">
          <div className="rounded-2xl border border-line bg-surface/60 px-6">
            {visible.map((f) => <FaqItem key={f.q} q={f.q} a={f.a} />)}
          </div>
        </Reveal>

        <Reveal delay={160} className="mt-10">
          <div className="rounded-2xl border border-brand/20 bg-brand/[0.06] p-7">
            <h2 className="text-xl font-black">Still have a question?</h2>
            <p className="mt-2 text-sm leading-6 text-muted">If you didn&apos;t find what you were looking for, email the team directly.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <PrimaryButton href="mailto:support@workzoai.com" external>Email support</PrimaryButton>
              <GhostButton href="/help">Help center</GhostButton>
            </div>
          </div>
        </Reveal>
      </section>
    </MarketingShell>
  );
}
