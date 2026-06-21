"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, Sparkles } from "lucide-react";
import WorkZoFooter from "@/components/WorkZoFooter";

const faqs = [
  { q: "How does WorkZo AI work?", cat: "product", a: "You upload or paste your CV and the job description you are targeting. WorkZo AI builds an AI recruiter that asks follow-up questions based on your actual experience — not a generic question bank. After each answer you see a live trust score and exactly why it rose or fell." },
  { q: "Is this a real recruiter?", cat: "product", a: "No. WorkZo AI is interview preparation. It simulates realistic recruiter-style conversations to help you practise — it does not represent any employer and does not guarantee interviews or offers." },
  { q: "What makes WorkZo AI different?", cat: "product", a: "Most tools give you a list of generic questions. WorkZo reads your CV and JD, then asks follow-up questions based on what you actually said. If you claim experience not in your CV, the recruiter challenges it in real time. The trust score updates as you answer so you know exactly what is working." },
  { q: "What is in the Free plan?", cat: "plans", a: "Free gives you 2 voice AI interviews per month, a basic interview score, and standard recruiters. It lets you experience the engine before upgrading." },
  { q: "What does Premium unlock?", cat: "plans", a: "Premium (€19.99/month) gives you 50 voice interviews, full advanced reports, Improve CV with ATS keyword analysis, Cover Letter generation, Job Assist with fit scores and likely questions, Career Brain memory, and performance tracking." },
  { q: "What is Premium Pro?", cat: "plans", a: "Premium Pro (€39.99/month) is the complete career acceleration system. Unlimited voice interviews, 60 Live AI Recruiter minutes, 7 premium personas, AI Career Coach, 30/60/90 day career roadmaps, Replay Intelligence, and priority AI models." },
  { q: "Can I cancel anytime?", cat: "plans", a: "Yes. No lock-in. Cancel at any time and keep access until the end of your billing period." },
  { q: "Does it work for any job or industry?", cat: "global", a: "Yes. WorkZo AI adapts to the job description you provide. It has been tested across tech, finance, sales, customer success, consulting, data, product, and support roles." },
  { q: "What languages are supported?", cat: "global", a: "English, German, Dutch, French, Spanish, Italian, and Portuguese. The recruiter conducts the full interview in your selected language — not just the UI translation." },
  { q: "How does WorkZo AI handle my CV data?", cat: "privacy", a: "Your CV and job context are used only to generate practice questions within your session. We do not share your data with employers. You can request deletion at any time by emailing support@workzoai.com." },
  { q: "How accurate is the recruiter feedback?", cat: "product", a: "The feedback is AI-generated coaching guidance. It helps improve structure, evidence, ownership, and clarity — but it is not a real hiring decision. Validate important feedback with a human mentor or career coach." },
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
    <div className="border-b border-white/[0.07] last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-start justify-between gap-5 py-5 text-left"
      >
        <span className="text-base font-black text-white leading-6">{q}</span>
        <ChevronDown className={`mt-0.5 h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <p className="pb-5 text-sm leading-7 text-slate-400">{a}</p>}
    </div>
  );
}

export default function FaqPage() {
  const [active, setActive] = useState("all");
  const visible = active === "all" ? faqs : faqs.filter((f) => f.cat === active);

  return (
    <main className="min-h-screen bg-[#04080f] text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.07),transparent_55%)]" />

      <div className="mx-auto max-w-4xl px-5 py-12 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-black text-slate-400 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back home
        </Link>

        <header className="mt-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
            <Sparkles className="h-3.5 w-3.5" /> FAQ
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-[-0.04em] sm:text-3xl">Frequently asked questions</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">
            Everything you need to know about WorkZo AI — the product, the plans, your data, and how the intelligence works.
          </p>
        </header>

        <div className="mt-8 flex flex-wrap gap-2">
          {cats.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActive(c.id)}
              className={`rounded-full border px-4 py-1.5 text-sm font-black transition ${
                active === c.id
                  ? "border-blue-400/50 bg-blue-500/15 text-blue-200"
                  : "border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:text-white"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.03] px-6">
          {visible.map((f) => <FaqItem key={f.q} {...f} />)}
        </div>

        <div className="mt-10 rounded-lg border border-blue-300/20 bg-blue-500/[0.07] p-7">
          <h2 className="text-xl font-black">Still have a question?</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">If you didn't find what you were looking for, email the team directly.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href="mailto:support@workzoai.com" className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-5 py-3 text-sm font-black text-white hover:bg-blue-400">
              support@workzoai.com <ArrowRight className="h-4 w-4" />
            </a>
            <Link href="/help" className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-slate-200 hover:bg-white/10">
              Help center
            </Link>
          </div>
        </div>
      </div>

      <WorkZoFooter />
    </main>
  );
}
