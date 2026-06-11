"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Mail, ShieldCheck, Trash2 } from "lucide-react";
import WorkZoFooter from "@/components/WorkZoFooter";

const LOCAL_KEYS = [
  "workzoInterviewSetup",
  "workzo-interview-setup-v4",
  "latestInterviewSetup",
  "workzo_latest_result",
  "workzo-interview-result",
  "workzo_interview_result",
  "latestInterviewResult",
  "workzo_results",
  "workzoInterviewResult",
  "workzo_result_snapshot",
  "workzo-career-memory-v1",
  "workzo_usage_state_v2",
  "workzo_pending_checkout",
  "workzo_selected_plan_intent",
];

export default function DeleteDataPage() {
  const [cleared, setCleared] = useState(false);

  function clearLocalData() {
    try {
      for (const key of LOCAL_KEYS) {
        window.localStorage.removeItem(key);
        window.sessionStorage.removeItem(key);
      }
      setCleared(true);
    } catch {
      setCleared(false);
    }
  }

  return (
    <>
      <main className="min-h-screen bg-[#050a12] px-5 py-8 text-white">
        <div className="mx-auto max-w-4xl">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-black text-slate-300 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back home
          </Link>

          <section className="mt-10 rounded-[2rem] border border-white/10 bg-white/[0.04] p-8">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-red-400/10 text-red-200">
              <Trash2 className="h-7 w-7" />
            </div>

            <h1 className="mt-6 text-4xl font-black tracking-[-0.04em]">
              Delete my data
            </h1>

            <p className="mt-4 text-base leading-8 text-slate-300">
              You can clear local WorkZo AI data from this browser immediately.
              For account, cloud history, or billing-related deletion requests,
              contact support.
            </p>

            {/* keep all existing content unchanged */}
          </section>
        </div>
      </main>

      <WorkZoFooter />
    </>
  );
}
