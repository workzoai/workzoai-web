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
  ["Payments", "Coming soon"],
];

export default function StatusPage() {
  return (
    <main className="min-h-screen bg-[#050a12] px-5 py-8 text-white">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-black text-slate-300 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back home
        </Link>
        <section className="mt-10 rounded-[2rem] border border-white/10 bg-white/[0.04] p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-100">
            <CheckCircle2 className="h-4 w-4" /> All core systems operational
          </div>
          <h1 className="mt-6 text-4xl font-black tracking-[-0.04em] sm:text-5xl">WorkZo AI status</h1>
          <p className="mt-4 text-base leading-8 text-slate-300">This page gives a simple public status overview while WorkZo AI is in beta.</p>
          <div className="mt-8 divide-y divide-white/10 rounded-3xl border border-white/10 bg-black/20">
            {systems.map(([name, status]) => (
              <div key={name} className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  {status === "Operational" ? <ShieldCheck className="h-5 w-5 text-emerald-300" /> : <Clock className="h-5 w-5 text-amber-300" />}
                  <p className="font-black">{name}</p>
                </div>
                <p className={status === "Operational" ? "text-sm font-black text-emerald-300" : "text-sm font-black text-amber-300"}>{status}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
