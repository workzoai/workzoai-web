import Link from "next/link";
import { ArrowLeft, Cookie } from "lucide-react";
import WorkZoFooter from "@/components/WorkZoFooter";

export const metadata = {
  title: "Cookie Policy | WorkZo AI",
  description: "How WorkZo AI uses cookies and browser storage.",
};

const sections = [
  {
    title: "What we store",
    body: "WorkZo AI uses browser localStorage and sessionStorage — not traditional third-party tracking cookies — to keep you signed in, remember your interview setup and recruiter preferences, track your plan usage limits, store Career Brain session data, and improve product reliability.",
  },
  {
    title: "Authentication",
    body: "When you sign in, Supabase sets a session cookie to keep you authenticated. This is strictly necessary for the service to function and cannot be disabled without signing out.",
  },
  {
    title: "Interview data",
    body: "Your CV text, job description, recruiter settings, and interview results are stored locally in your browser between sessions. This data never leaves your device unless you are signed in and have an active account, in which case results are also saved to our secure database.",
  },
  {
    title: "Analytics and error tracking",
    body: "We use Sentry for error monitoring and may collect anonymised usage events to understand how the product is used. These include page path, browser type, timestamps, and error stack traces. No advertising trackers or third-party ad networks are used.",
  },
  {
    title: "Managing storage",
    body: "You can clear all WorkZo AI local data at any time on the Delete My Data page, or by clearing your browser's localStorage. This will remove your saved interview setup, results, and session preferences. It will not delete your account or cloud-stored history.",
  },
  {
    title: "Third-party services",
    body: "Our payment provider (Stripe) may set cookies during checkout. Our hosting provider (Vercel) may log technical request metadata. These are subject to their own cookie and privacy policies.",
  },
];

export default function CookiePolicyPage() {
  return (
    <main className="min-h-screen bg-canvas text-fg">
      <div className="mx-auto max-w-4xl px-5 py-10 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-fg">
          <ArrowLeft className="h-4 w-4" /> Back home
        </Link>

        <div className="mt-10 flex items-start gap-5">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-warning/10">
            <Cookie className="h-7 w-7 text-warning" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.26em] text-brand">Legal</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.04em] sm:text-3xl">Cookie Policy</h1>
            <p className="mt-3 text-sm leading-6 text-muted">Last updated: June 2026 · We use browser storage, not third-party ad trackers.</p>
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
          <Link href="/legal/privacy" className="rounded-xl border border-line bg-fg/[0.03] px-4 py-2 text-sm text-muted hover:text-fg">Privacy Policy</Link>
          <Link href="/legal/delete-data" className="rounded-xl border border-line bg-fg/[0.03] px-4 py-2 text-sm text-muted hover:text-fg">Delete My Data</Link>
        </div>
      </div>
      <WorkZoFooter />
    </main>
  );
}
