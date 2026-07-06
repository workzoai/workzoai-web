import Link from "next/link";
import { ArrowLeft, Building2 } from "lucide-react";
import WorkZoFooter from "@/components/WorkZoFooter";

export const metadata = {
  title: "Impressum | WorkZo AI",
  description: "Legal provider information for WorkZo AI (§ 5 DDG).",
};

export default function ImpressumPage() {
  return (
    <main className="min-h-screen bg-canvas text-fg">
      <div className="mx-auto max-w-4xl px-5 py-10 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-fg">
          <ArrowLeft className="h-4 w-4" /> Back home
        </Link>

        <div className="mt-10 flex items-start gap-5">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-success/10">
            <Building2 className="h-7 w-7 text-success" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.26em] text-brand">Legal</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.04em] sm:text-3xl">Impressum</h1>
            <p className="mt-3 text-sm leading-6 text-muted">Pflichtangaben gemäß § 5 DDG (Digitale-Dienste-Gesetz)</p>
          </div>
        </div>

        <div className="mt-10 space-y-4">
          <section className="rounded-xl border border-line bg-fg/[0.03] p-6">
            <h2 className="text-base font-black text-fg">Anbieter / Service provider</h2>
            <div className="mt-4 space-y-1 text-sm leading-7 text-muted">
              <p className="font-bold text-fg">WorkZo AI</p>
              <p>Haritha Vijayakumar</p>
              <p>Würzburg, Germany</p>
            </div>
          </section>

          <section className="rounded-xl border border-line bg-fg/[0.03] p-6">
            <h2 className="text-base font-black text-fg">Kontakt / Contact</h2>
            <div className="mt-4 space-y-2 text-sm leading-7 text-muted">
              <p>Email: <a href="mailto:support@workzoai.com" className="text-brand hover:text-fg">support@workzoai.com</a></p>
            </div>
          </section>

          <section className="rounded-xl border border-line bg-fg/[0.03] p-6">
            <h2 className="text-base font-black text-fg">Verantwortlich für den Inhalt / Responsible for content</h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              Haritha Vijayakumar, Würzburg, Germany, gemäß § 18 Abs. 2 MStV.
            </p>
          </section>

          <section className="rounded-xl border border-line bg-fg/[0.03] p-6">
            <h2 className="text-base font-black text-fg">Haftungsausschluss / Liability disclaimer</h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              WorkZo AI ist ein Interviewvorbereitungs-Tool. Die bereitgestellten Inhalte dienen ausschließlich zu Übungs- und Informationszwecken. WorkZo AI übernimmt keine Haftung für Entscheidungen, die auf Grundlage der generierten Inhalte getroffen werden.
            </p>
            <p className="mt-3 text-sm leading-7 text-muted">
              WorkZo AI is an interview preparation tool. All content is for practice and informational purposes only. WorkZo AI accepts no liability for decisions made on the basis of generated content.
            </p>
          </section>

          <section className="rounded-xl border border-line bg-fg/[0.03] p-6">
            <h2 className="text-base font-black text-fg">Urheberrecht / Copyright</h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              © 2026 WorkZo AI / Haritha Vijayakumar. All rights reserved. Unauthorised reproduction or distribution of content is prohibited.
            </p>
          </section>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/legal/privacy" className="rounded-xl border border-line bg-fg/[0.03] px-4 py-2 text-sm text-muted hover:text-fg">Privacy Policy</Link>
          <Link href="/legal/terms" className="rounded-xl border border-line bg-fg/[0.03] px-4 py-2 text-sm text-muted hover:text-fg">Terms of Service</Link>
        </div>
      </div>
      <WorkZoFooter />
    </main>
  );
}
