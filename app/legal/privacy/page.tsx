import Link from "next/link";

const sections = [
  {
    title: "1. What WorkZo AI does",
    body: "WorkZo AI is an interview preparation product. Users may upload or paste CV content, job descriptions, and interview answers so the app can generate practice questions, feedback, reports, and coaching suggestions.",
  },
  {
    title: "2. Data we may collect",
    body: "We may process account details, email address, uploaded CV text, job descriptions, interview transcripts, selected recruiter settings, usage events, error logs, device/browser metadata, and payment status when billing is enabled.",
  },
  {
    title: "3. Why we process data",
    body: "We process data to provide the app, personalize interview practice, generate reports, improve product reliability, prevent abuse, provide support, and comply with legal obligations.",
  },
  {
    title: "4. AI processing",
    body: "WorkZo AI may send CV text, job descriptions, and interview answers to AI service providers to generate questions and feedback. Users should not upload sensitive information that is not needed for interview preparation.",
  },
  {
    title: "5. Storage and retention",
    body: "During beta, some data may be stored in your browser and/or WorkZo AI systems to support interview history, usage limits, reports, and debugging. You can contact us to request deletion of your data.",
  },
  {
    title: "6. Analytics and error tracking",
    body: "We may collect product analytics and technical error reports to understand failures, improve stability, and protect the service. These logs may include page path, browser metadata, timestamps, and error details.",
  },
  {
    title: "7. Your rights",
    body: "Depending on your location, including the EU/EEA, you may have rights to access, correct, delete, restrict, or object to processing of your personal data. Contact support@workzoai.com for requests.",
  },
  {
    title: "8. Contact",
    body: "For privacy questions or deletion requests, contact support@workzoai.com.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#050a12] px-5 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm font-bold text-slate-400 hover:text-white">← Back home</Link>
        <p className="mt-10 text-xs font-black uppercase tracking-[0.28em] text-cyan-200">Legal</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-5xl">Privacy Policy</h1>
        <p className="mt-4 text-sm leading-7 text-slate-300">Last updated: June 2026. This page is written for WorkZo AI beta users and should be reviewed by a legal professional before full public launch.</p>
        <div className="mt-8 space-y-4">
          {sections.map((section) => (
            <section key={section.title} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-lg font-black">{section.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
