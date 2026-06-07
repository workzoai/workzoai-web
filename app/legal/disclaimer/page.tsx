import Link from "next/link";

export default function DisclaimerPage() {
  return (
    <main className="min-h-screen bg-[#050a12] px-5 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm font-bold text-slate-400 hover:text-white">← Back home</Link>
        <p className="mt-10 text-xs font-black uppercase tracking-[0.28em] text-cyan-200">Legal</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-5xl">Disclaimer</h1>
        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-sm leading-7 text-slate-300">
          <p>WorkZo AI is an interview preparation and career-practice tool. Feedback, reports, scores, CV suggestions, cover letters, job insights, and interview recommendations are generated for educational and preparation purposes only.</p>
          <p className="mt-4">AI-generated outputs may be incomplete, inaccurate, or unsuitable for a specific employer, country, role, or application. Always review and edit outputs before using them.</p>
          <p className="mt-4">WorkZo AI does not guarantee interviews, job offers, hiring decisions, salary outcomes, employer responses, visa outcomes, or career success.</p>
          <p className="mt-4">WorkZo AI does not provide legal, immigration, tax, financial, medical, or employment-law advice.</p>
        </div>
      </div>
    </main>
  );
}
