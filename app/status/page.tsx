import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "System Status | WorkZo AI",
  description: "Current WorkZo AI system status and service notes.",
};

const systems = [
  ["Landing page", "Operational"],
  ["Onboarding", "Operational"],
  ["Interview practice", "Operational"],
  ["Results reports", "Operational"],
  ["History", "Operational"],
  ["Payments", "Operational"],
];

export default function StatusPage() {
  return (
    <main className="min-h-screen bg-canvas px-5 py-8 text-fg">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-black text-muted hover:text-fg">
          <ArrowLeft className="h-4 w-4" /> Back home
        </Link>
        <section className="mt-10 rounded-lg border border-line bg-fg/[0.04] p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-success/20 bg-success/10 px-4 py-2 text-sm font-black text-success">
            <CheckCircle2 className="h-4 w-4" /> All core systems operational
          </div>
          <h1 className="mt-6 text-4xl font-black tracking-[-0.04em] sm:text-3xl">WorkZo AI status</h1>
          <p className="mt-4 text-base leading-8 text-muted">This page gives a live status overview of WorkZo AI services.</p>
          <div className="mt-8 divide-y divide-line rounded-xl border border-line bg-canvas-soft">
            {systems.map(([name, status]) => (
              <div key={name} className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  {status === "Operational" ? <ShieldCheck className="h-5 w-5 text-success" /> : <Clock className="h-5 w-5 text-warning" />}
                  <p className="font-black">{name}</p>
                </div>
                <p className={status === "Operational" ? "text-sm font-black text-success" : "text-sm font-black text-warning"}>{status}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
