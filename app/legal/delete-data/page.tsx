"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Mail, ShieldCheck, Trash2 } from "lucide-react";

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
    <main className="min-h-screen bg-[#050a12] px-5 py-8 text-white">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-black text-slate-300 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back home
        </Link>

        <section className="mt-10 rounded-[2rem] border border-white/10 bg-white/[0.04] p-8">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-red-400/10 text-red-200">
            <Trash2 className="h-7 w-7" />
          </div>
          <h1 className="mt-6 text-4xl font-black tracking-[-0.04em]">Delete my data</h1>
          <p className="mt-4 text-base leading-8 text-slate-300">
            You can clear local WorkZo AI data from this browser immediately. For account, cloud history, or billing-related deletion requests, contact support.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <ShieldCheck className="h-6 w-6 text-blue-200" />
              <h2 className="mt-4 text-xl font-black">Clear this browser</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">Removes local interview setup, local results, career memory, and usage state stored in this browser.</p>
              <button onClick={clearLocalData} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-red-500 px-5 py-3 text-sm font-black text-white hover:bg-red-400">
                Clear local data
              </button>
              {cleared ? (
                <p className="mt-3 flex items-center gap-2 text-sm font-black text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" /> Local WorkZo data cleared.
                </p>
              ) : null}
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <Mail className="h-6 w-6 text-cyan-200" />
              <h2 className="mt-4 text-xl font-black">Request account deletion</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">For Supabase account data, saved history, or support records, email us from the same email used in WorkZo AI.</p>
              <a href="mailto:support@workzoai.com?subject=WorkZo%20AI%20Data%20Deletion%20Request" className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-blue-500 px-5 py-3 text-sm font-black text-white hover:bg-blue-400">
                Email deletion request
              </a>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
