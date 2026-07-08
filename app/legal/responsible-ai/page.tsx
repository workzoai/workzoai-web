import Link from "next/link";
import { ArrowLeft, BrainCircuit } from "lucide-react";
import WorkZoFooter from "@/components/WorkZoFooter";

export const metadata = {
  title: "Responsible AI | WorkZo AI",
  description: "How WorkZo AI uses artificial intelligence: purpose, limitations, human control, and the commitments we make.",
};

/**
 * Honest one-pager. Rule: every statement here must be true today. This page
 * exists because education and enterprise buyers in the EU increasingly ask
 * "what does your AI actually do and decide?", and because being able to
 * answer plainly is a competitive advantage for a practice tool that makes
 * NO hiring decisions.
 */

const sections = [
  {
    title: "What our AI does",
    body: "WorkZo AI uses large language models to simulate recruiter conversations, generate interview questions grounded in your CV and a job description, give practice feedback, and suggest CV and cover-letter improvements. Voice interviews additionally use speech-to-text and text-to-speech models to make the conversation feel natural.",
  },
  {
    title: "What our AI does not do",
    body: "WorkZo AI is a practice tool. It makes no hiring decisions, produces no assessments for employers about you, and is not connected to any employer's recruiting process. Your practice scores exist to help you improve, not to rank you against other people, and they are never shared with employers.",
  },
  {
    title: "AI feedback is fallible",
    body: "AI-generated feedback, scores, and suggestions can be incomplete, inaccurate, or a poor fit for a specific employer, culture, or country. We design the product to reduce these errors, for example by grounding every question in your verified CV data, but we cannot eliminate them. Treat feedback as a practice signal, and always apply your own judgment before using AI outputs in real applications.",
  },
  {
    title: "Fairness and bias",
    body: "The language models we use are trained by third parties on large datasets and can reflect biases from that data. We mitigate this by instructing our interview engine to evaluate only what you say and what your documents contain, never demographic characteristics, and by using structured competency coverage so every candidate is asked balanced questions. If you encounter feedback you believe is biased, report it to support@workzoai.com and we will investigate.",
  },
  {
    title: "You stay in control",
    body: "You choose what to upload, you can correct the name and role our parser extracts before any interview begins, you can end a session at any time, and you can delete your data entirely. AI never modifies your CV or sends anything on your behalf; all outputs are suggestions you explicitly accept or ignore.",
  },
  {
    title: "Transparency about providers",
    body: "We build on AI models from third-party providers rather than training our own; the current list is on our Security & Data page. We do not use your CV or interview content to train our own models, and we send providers only what is needed to run your session.",
  },
  {
    title: "A note on regulation",
    body: "Under the EU AI Act's risk framework, interview practice for your own preparation is not an employment-decision system: no employer receives our scores and no hiring outcome depends on them. We follow the development of the Act and will adapt this page and our practices as guidance evolves.",
  },
];

export default function ResponsibleAiPage() {
  return (
    <main className="min-h-screen bg-canvas text-fg">
      <div className="mx-auto max-w-4xl px-5 py-10 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-fg">
          <ArrowLeft className="h-4 w-4" /> Back home
        </Link>

        <div className="mt-10 flex items-start gap-5">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-brand/10">
            <BrainCircuit className="h-7 w-7 text-brand" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.26em] text-brand">Legal</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.04em] sm:text-3xl">Responsible AI</h1>
            <p className="mt-3 text-sm leading-6 text-muted">Last updated: July 2026 · What our AI does, what it doesn&apos;t, and the commitments we make.</p>
          </div>
        </div>

        <div className="mt-10 space-y-4">
          {sections.map((s) => (
            <section key={s.title} className="rounded-xl border border-line bg-fg/[0.03] p-6">
              <h2 className="text-base font-black text-fg">{s.title}</h2>
              <p className="mt-3 text-sm leading-7 text-muted">{s.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/security" className="rounded-xl border border-line bg-fg/[0.03] px-4 py-2 text-sm text-muted hover:text-fg">Security &amp; Data</Link>
          <Link href="/legal/disclaimer" className="rounded-xl border border-line bg-fg/[0.03] px-4 py-2 text-sm text-muted hover:text-fg">Disclaimer</Link>
          <Link href="/legal/privacy" className="rounded-xl border border-line bg-fg/[0.03] px-4 py-2 text-sm text-muted hover:text-fg">Privacy Policy</Link>
        </div>
      </div>
      <WorkZoFooter />
    </main>
  );
}
