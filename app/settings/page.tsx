"use client";

import React, { useState } from "react";
import { Eye, Lock, ShieldCheck } from "lucide-react";

export default function TalentVisibilitySettingsPage() {
  const [candidateId, setCandidateId] = useState("");
  const [org, setOrg] = useState("demo");
  const [visibility, setVisibility] = useState("private");
  const [passportEnabled, setPassportEnabled] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    const res = await fetch(`/api/talent-marketplace?org=${encodeURIComponent(org)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "visibility", candidateId, visibility, passportEnabled }),
    });
    const payload = await res.json();
    setMessage(payload.ok ? "Talent visibility saved." : `Could not save: ${payload.error}`);
  }

  return <main className="min-h-screen bg-slate-50 p-4 text-slate-950 md:p-8">
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-200">WorkZo Privacy</p>
        <h1 className="mt-2 text-3xl font-black">Talent Visibility</h1>
        <p className="mt-3 text-slate-300">B2C stays private by default. Students decide whether their verified interview profile is visible to an organization or verified employers.</p>
      </header>
      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="grid gap-4">
          <label className="text-sm font-bold">User / candidate ID<input value={candidateId} onChange={(e) => setCandidateId(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal outline-none focus:border-indigo-400" placeholder="Current user id" /></label>
          <label className="text-sm font-bold">Organization code<input value={org} onChange={(e) => setOrg(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 font-normal outline-none focus:border-indigo-400" /></label>
          <div className="grid gap-3 md:grid-cols-3">
            <Choice icon={Lock} active={visibility === "private"} title="Private" text="Only you can see your profile." onClick={() => { setVisibility("private"); setPassportEnabled(false); }} />
            <Choice icon={ShieldCheck} active={visibility === "organization"} title="Organization" text="Visible to your university/bootcamp admin." onClick={() => setVisibility("organization")} />
            <Choice icon={Eye} active={visibility === "verified_employers"} title="Verified Employers" text="Visible in employer talent matching." onClick={() => setVisibility("verified_employers")} />
          </div>
          <label className="flex items-center gap-3 rounded-2xl border p-4 text-sm font-bold"><input type="checkbox" checked={passportEnabled} onChange={(e) => setPassportEnabled(e.target.checked)} disabled={visibility === "private"} />Enable shareable WorkZo Talent Passport</label>
          <button onClick={save} disabled={!candidateId} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50">Save visibility</button>
          {message ? <p className="rounded-2xl bg-indigo-50 p-3 text-sm font-bold text-indigo-950">{message}</p> : null}
        </div>
      </section>
    </div>
  </main>;
}

function Choice({ icon: Icon, active, title, text, onClick }: { icon: any; active: boolean; title: string; text: string; onClick: () => void }) {
  return <button onClick={onClick} className={`rounded-2xl border p-4 text-left ${active ? "border-indigo-500 bg-indigo-50" : "bg-white"}`}><Icon className="h-5 w-5 text-indigo-600" /><p className="mt-3 font-black">{title}</p><p className="mt-1 text-sm text-slate-500">{text}</p></button>;
}
