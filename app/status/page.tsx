import type { Metadata } from "next";
import { Activity, CheckCircle2 } from "lucide-react";
import { MarketingShell, Reveal, BackLink } from "@/components/marketing/kit";

export const metadata: Metadata = {
  title: "System Status — WorkZo AI",
  description: "Current WorkZo AI service status and uptime overview.",
};

const systems: { name: string; status: "Operational" | "Degraded" | "Down" }[] = [
  { name: "Landing & marketing", status: "Operational" },
  { name: "Onboarding & CV parsing", status: "Operational" },
  { name: "Interview practice (voice)", status: "Operational" },
  { name: "Interview practice (text)", status: "Operational" },
  { name: "Results & reports", status: "Operational" },
  { name: "History & dashboard", status: "Operational" },
  { name: "Payments & billing", status: "Operational" },
];

const dot = (s: string) => (s === "Operational" ? "bg-success" : s === "Degraded" ? "bg-warning" : "bg-danger");
const txt = (s: string) => (s === "Operational" ? "text-success" : s === "Degraded" ? "text-warning" : "text-danger");

export default function StatusPage() {
  const allUp = systems.every((s) => s.status === "Operational");
  return (
    <MarketingShell>
      <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-6 lg:px-8">
        <BackLink href="/">Back home</BackLink>
      </div>

      <section className="mx-auto max-w-4xl px-4 pb-20 pt-8 sm:px-6 lg:px-8">
        <Reveal>
          <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-brand">
            <Activity className="h-4 w-4" /> System Status
          </span>
          <div className={`mt-5 flex items-center gap-3 rounded-2xl border p-5 ${allUp ? "border-success/25 bg-success/[0.08]" : "border-warning/25 bg-warning/[0.08]"}`}>
            <span className="relative flex h-3 w-3">
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${allUp ? "bg-success" : "bg-warning"} opacity-60`} />
              <span className={`relative inline-flex h-3 w-3 rounded-full ${allUp ? "bg-success" : "bg-warning"}`} />
            </span>
            <div>
              <p className={`text-lg font-black ${allUp ? "text-success" : "text-warning"}`}>
                {allUp ? "All systems operational" : "Some systems degraded"}
              </p>
              <p className="text-sm text-muted">Live overview of WorkZo AI services.</p>
            </div>
            <CheckCircle2 className={`ml-auto hidden h-6 w-6 sm:block ${allUp ? "text-success" : "text-warning"}`} />
          </div>
        </Reveal>

        <Reveal delay={80} className="mt-6">
          <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface/60">
            {systems.map((s) => (
              <div key={s.name} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${dot(s.status)}`} />
                  <p className="font-bold text-fg">{s.name}</p>
                </div>
                <p className={`text-sm font-black ${txt(s.status)}`}>{s.status}</p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={120}>
          <p className="mt-6 text-center text-sm text-muted">
            Seeing a problem that isn't reflected here? Email{" "}
            <a href="mailto:support@workzoai.com" className="font-black text-brand hover:underline">support@workzoai.com</a>.
          </p>
        </Reveal>
      </section>
    </MarketingShell>
  );
}
