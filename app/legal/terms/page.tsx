import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import WorkZoFooter from "@/components/WorkZoFooter";

export const metadata = {
  title: "Terms of Service | WorkZo AI",
  description: "Terms and conditions for using WorkZo AI.",
};

const sections = [
  {
    title: "1. Service purpose",
    body: "WorkZo AI provides AI-powered interview preparation, CV guidance, and job-preparation support. It is a practice tool — not an employer, recruiter, legal advisor, immigration advisor, or guaranteed job-placement service.",
  },
  {
    title: "2. No employment guarantee",
    body: "WorkZo AI does not guarantee interview invitations, job offers, hiring outcomes, salary outcomes, employer responses, or visa outcomes. All outputs are for practice and educational purposes only.",
  },
  {
    title: "3. User responsibility",
    body: "You are responsible for the accuracy of any CV content, job descriptions, answers, or other material you upload or enter. You should review all AI-generated outputs before using them in real job applications or communications.",
  },
  {
    title: "4. Acceptable use",
    body: "You may not use WorkZo AI for unlawful activity, harassment, impersonation of real individuals or employers, uploading content you do not have the right to use, or any attempt to reverse-engineer, scrape, or abuse the service.",
  },
  {
    title: "5. Service updates",
    body: "WorkZo AI is a live product. Features, limits, and pricing may be updated. We will notify users of material changes to these terms by updating this page and, where possible, by email.",
  },
  {
    title: "6. Payments and billing",
    body: "Paid plans (Premium and Premium Pro) are billed monthly or annually through Stripe. Subscriptions auto-renew unless cancelled before the renewal date. Refunds are handled on a case-by-case basis — contact support@workzoai.com.",
  },
  {
    title: "7. Intellectual property",
    body: "WorkZo AI and its underlying technology are owned by Haritha Vijayakumar / WorkZo AI. You retain ownership of your own CV content and answers. We do not claim ownership of your uploaded material.",
  },
  {
    title: "8. Limitation of liability",
    body: "WorkZo AI is provided 'as is' without warranties of any kind. To the maximum extent permitted by law, we are not liable for any indirect, incidental, or consequential damages arising from use of the service.",
  },
  {
    title: "9. Governing law",
    body: "These terms are governed by the laws of Germany. Disputes shall be subject to the exclusive jurisdiction of the courts of Würzburg, Germany, unless applicable consumer protection law in your country provides otherwise.",
  },
  {
    title: "10. Contact",
    body: "For questions about these terms, contact support@workzoai.com.",
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#050a12] text-white">
      <div className="mx-auto max-w-4xl px-5 py-10 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back home
        </Link>

        <div className="mt-10 flex items-start gap-5">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-violet-400/10">
            <FileText className="h-7 w-7 text-violet-300" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.26em] text-cyan-200">Legal</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.04em] sm:text-3xl">Terms of Service</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">Last updated: June 2026 · By using WorkZo AI you agree to these terms.</p>
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
          <Link href="/legal/privacy" className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-400 hover:text-white">Privacy Policy</Link>
          <Link href="/legal/cookies" className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-400 hover:text-white">Cookie Policy</Link>
          <Link href="/legal/impressum" className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-400 hover:text-white">Impressum</Link>
        </div>
      </div>
      <WorkZoFooter />
    </main>
  );
}
