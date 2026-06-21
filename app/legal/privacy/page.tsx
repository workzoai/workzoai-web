import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import WorkZoFooter from "@/components/WorkZoFooter";

export const metadata = {
  title: "Privacy Policy | WorkZo AI",
  description: "How WorkZo AI collects, uses, and protects your personal data.",
};

const sections = [
  {
    title: "1. Who we are",
    body: "WorkZo AI is an interview preparation platform operated by Haritha Vijayakumar, based in Würzburg, Germany. This policy explains how we handle your personal data when you use our service.",
  },
  {
    title: "2. What data we collect",
    body: "We may process: your email address and account details; CV text and job descriptions you upload or paste; interview transcripts and answers you provide during practice; recruiter settings and language preferences; usage events, error logs, and browser/device metadata; and payment status when a paid plan is active.",
  },
  {
    title: "3. Why we process your data",
    body: "We process your data to provide and improve the interview preparation service; to personalise questions, reports, and coaching suggestions; to track usage limits per plan; to maintain product reliability and fix errors; to process payments via Stripe; and to respond to support requests.",
  },
  {
    title: "4. AI processing",
    body: "WorkZo AI sends CV text, job descriptions, and interview answers to third-party AI providers (including Anthropic and OpenRouter) to generate practice questions and feedback. These providers process data under their own terms. Do not upload confidential employer information, trade secrets, or sensitive personal data that is not necessary for interview preparation.",
  },
  {
    title: "5. Data storage and retention",
    body: "Interview setup, results, and career memory are stored locally in your browser (localStorage) and, when you are signed in, in our Supabase database. We retain your data as long as your account is active. You may request deletion at any time by contacting support@workzoai.com or using the Delete My Data page.",
  },
  {
    title: "6. Analytics and error tracking",
    body: "We use Sentry for error monitoring and may collect anonymised product analytics. These may include page path, browser type, timestamps, and error details. No advertising networks have access to your data.",
  },
  {
    title: "7. Third-party services",
    body: "WorkZo AI uses Supabase (database and auth), Stripe (payments), Vapi (voice AI), Anthropic (AI generation), Sentry (error tracking), and Vercel (hosting). Each provider is subject to their own privacy policies. We do not sell your data to any third party.",
  },
  {
    title: "8. Your rights",
    body: "If you are in the EU/EEA, you have rights under GDPR to access, correct, delete, restrict, or object to processing of your personal data, and to data portability. To exercise any right, contact support@workzoai.com. We will respond within 30 days.",
  },
  {
    title: "9. Cookies",
    body: "We use browser storage to keep you signed in, remember interview settings, and track plan usage. See our Cookie Policy for full details.",
  },
  {
    title: "10. Contact",
    body: "For privacy questions, data requests, or complaints: support@workzoai.com. For EU GDPR matters, you may also contact your local data protection authority.",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#050a12] text-white">
      <div className="mx-auto max-w-4xl px-5 py-10 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back home
        </Link>

        <div className="mt-10 flex items-start gap-5">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-blue-400/10">
            <ShieldCheck className="h-7 w-7 text-blue-300" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.26em] text-cyan-200">Legal</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.04em] sm:text-3xl">Privacy Policy</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">Last updated: June 2026 · WorkZo AI, Würzburg, Germany · support@workzoai.com</p>
          </div>
        </div>

        <div className="mt-10 space-y-4">
          {sections.map((s) => (
            <section key={s.title} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-6">
              <h2 className="text-base font-black text-white">{s.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">{s.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/legal/terms" className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-400 hover:text-white">Terms of Service</Link>
          <Link href="/legal/cookies" className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-400 hover:text-white">Cookie Policy</Link>
          <Link href="/legal/delete-data" className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-400 hover:text-white">Delete My Data</Link>
        </div>
      </div>
      <WorkZoFooter />
    </main>
  );
}
