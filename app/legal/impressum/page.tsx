import Link from "next/link";

export default function ImpressumPage() {
  return (
    <main className="min-h-screen bg-[#050a12] px-5 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm font-bold text-slate-400 hover:text-white">← Back home</Link>
        <p className="mt-10 text-xs font-black uppercase tracking-[0.28em] text-cyan-200">Legal</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-5xl">Impressum</h1>
        <div className="mt-8 rounded-3xl border border-amber-300/20 bg-amber-400/[0.06] p-6 text-sm leading-7 text-amber-100">
          <p className="font-black">Important before public launch</p>
          <p className="mt-2">If WorkZo AI is operated from Germany, this page should include complete legal provider information, including the legally required address and business details. Replace the placeholders below before launch or ask a legal professional to review it.</p>
        </div>
        <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-sm leading-7 text-slate-300">
          <p className="font-black text-white">Information according to § 5 TMG / DDG</p>
          <p className="mt-4">WorkZo AI</p>
          <p>Represented by: Haritha Vijayakumar</p>
          <p>Würzburg, Germany</p>
          <p className="mt-4 text-slate-400">Full legal address: [Add before public launch]</p>
          <p className="mt-4">Email: <a href="mailto:support@workzoai.com" className="text-cyan-200 hover:text-white">support@workzoai.com</a></p>
          <p className="mt-4 text-slate-400">VAT ID / business registration details: [Add if/when applicable]</p>
          <p className="mt-4">Responsible for content: Haritha Vijayakumar</p>
        </div>
      </div>
    </main>
  );
}
