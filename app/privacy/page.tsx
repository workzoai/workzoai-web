import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#050b14] px-5 py-10 text-white">
      <section className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <Link href="/" className="text-sm text-blue-300">← Back to home</Link>
        <h1 className="mt-6 text-3xl font-black">Privacy</h1>
        <p className="mt-4 leading-7 text-slate-300">
          WorkZo AI stores interview setup and results locally in your browser to support the product experience.
        </p>
        <p className="mt-4 leading-7 text-slate-300">
          Do not upload sensitive personal information. Always review AI-generated feedback before using it for real-world decisions.
        </p>
      </section>
    </main>
  );
}
