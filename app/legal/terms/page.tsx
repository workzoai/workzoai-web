import Link from "next/link";

const sections = [
  ["1. Service purpose", "WorkZo AI provides interview preparation, CV-related guidance, and job-preparation support. It is not an employer, recruiter, legal advisor, immigration advisor, or guaranteed job-placement service."],
  ["2. No guarantee", "WorkZo AI does not guarantee interview invitations, job offers, hiring outcomes, salary outcomes, or employer responses."],
  ["3. User responsibility", "You are responsible for the accuracy of the CVs, job descriptions, answers, and other content you upload or enter. You should review AI-generated outputs before using them in real applications."],
  ["4. Acceptable use", "Do not use WorkZo AI for unlawful activity, harassment, impersonation, uploading content you do not have the right to use, or attempting to reverse-engineer or abuse the service."],
  ["5. Beta status", "WorkZo AI is currently in beta. Features, limits, pricing, and availability may change as the product improves."],
  ["6. Payments", "Premium checkout and billing may be enabled later. Any paid plan details shown before checkout is connected are product-intent information and may be updated before billing begins."],
  ["7. Contact", "For questions about these terms, contact support@workzoai.com."],
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#050a12] px-5 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm font-bold text-slate-400 hover:text-white">← Back home</Link>
        <p className="mt-10 text-xs font-black uppercase tracking-[0.28em] text-cyan-200">Legal</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-5xl">Terms of Service</h1>
        <p className="mt-4 text-sm leading-7 text-slate-300">Last updated: June 2026. Please review these terms before using WorkZo AI.</p>
        <div className="mt-8 space-y-4">
          {sections.map(([title, body]) => (
            <section key={title} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-lg font-black">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">{body}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
