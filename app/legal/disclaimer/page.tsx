import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import WorkZoFooter from "@/components/WorkZoFooter";

export const metadata = {
  title: "Disclaimer | WorkZo AI",
  description: "Important limitations and disclaimers for WorkZo AI.",
};

const sections = [
  {
    title: "Practice tool only",
    body: "WorkZo AI is an interview preparation and career-practice tool. All feedback, reports, scores, CV suggestions, cover letters, job insights, and interview recommendations are generated for educational and practice purposes only. They do not represent the views of any employer, recruiter, or hiring organisation.",
  },
  {
    title: "AI-generated outputs",
    body: "AI-generated content may be incomplete, inaccurate, biased, or unsuitable for a specific employer, country, role, or application context. Always review and edit AI outputs before using them in real job applications, interviews, or communications.",
  },
  {
    title: "No employment guarantee",
    body: "WorkZo AI does not guarantee interview invitations, job offers, hiring decisions, salary outcomes, employer responses, or any career outcome. Practice performance does not predict or determine real interview performance.",
  },
  {
    title: "Not professional advice",
    body: "Nothing on WorkZo AI constitutes legal advice, immigration advice, financial advice, medical advice, tax advice, or employment-law advice. If you need professional guidance on any of these matters, consult a qualified professional.",
  },
  {
    title: "Accuracy of feedback",
    body: "Recruiter trust scores, verdicts, and session reports are simulations based on AI models. They are designed to help you practise, not to accurately represent how a real recruiter would evaluate you.",
  },
  {
    title: "Data accuracy",
    body: "WorkZo AI relies on the CV and job description data you provide. If that data is incomplete or inaccurate, the AI outputs will reflect that. We do not independently verify any information you enter.",
  },
];

export default function DisclaimerPage() {
  return (
    <main className="min-h-screen bg-canvas text-fg">
      <div className="mx-auto max-w-4xl px-5 py-10 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-fg">
          <ArrowLeft className="h-4 w-4" /> Back home
        </Link>

        <div className="mt-10 flex items-start gap-5">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-warning/10">
            <AlertTriangle className="h-7 w-7 text-warning" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.26em] text-brand">Legal</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.04em] sm:text-3xl">Disclaimer</h1>
            <p className="mt-3 text-sm leading-6 text-muted">Last updated: June 2026 · Please read before using WorkZo AI.</p>
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
          <Link href="/legal/terms" className="rounded-xl border border-line bg-fg/[0.03] px-4 py-2 text-sm text-muted hover:text-fg">Terms of Service</Link>
          <Link href="/legal/privacy" className="rounded-xl border border-line bg-fg/[0.03] px-4 py-2 text-sm text-muted hover:text-fg">Privacy Policy</Link>
        </div>
      </div>
      <WorkZoFooter />
    </main>
  );
}
