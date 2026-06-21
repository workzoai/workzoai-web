"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Globe2, Mic, Settings, UserRound } from "lucide-react";

export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-[#020817] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_32%),linear-gradient(180deg,#020817,#050914_55%,#020617)]" />
      <div className="relative mx-auto max-w-[1200px] px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between rounded-[30px] border border-white/[0.08] bg-[#071225]/82 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
          <Link href="/dashboard" className="inline-flex items-center gap-3 text-sm font-black text-slate-300 hover:text-white"><ArrowLeft className="h-5 w-5" /> Back to dashboard</Link>
          <Link href="/" className="flex items-center gap-3"><Image src="/workzo_icon.png" alt="WorkZo AI" width={42} height={42} className="rounded-lg" /><span className="text-2xl font-black">WorkZo <span className="text-blue-400">AI</span></span></Link>
        </header>
        <section className="mt-6 rounded-[34px] border border-white/[0.08] bg-[#071225]/86 p-8 shadow-[0_30px_100px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/[0.07] px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-100"><Settings className="h-4 w-4" /> Setup</span>
          <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl lg:text-3xl">Settings</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">Edit your role, market, recruiter style, language preference, and interview setup.</p>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {[{title:'Profile',desc:'Candidate context and CV setup.',icon:UserRound},{title:'Market & language',desc:'Country, interview culture, and language preference.',icon:Globe2},{title:'Interview style',desc:'Recruiter personality, pressure level, and company style.',icon:Mic}].map((item)=>{const Icon=item.icon;return <Link key={item.title} href="/onboarding" className="rounded-[28px] border border-white/[0.08] bg-white/[0.04] p-6 hover:bg-white/[0.07]"><Icon className="h-7 w-7 text-cyan-200"/><h2 className="mt-5 text-2xl font-black">{item.title}</h2><p className="mt-3 leading-7 text-slate-300">{item.desc}</p><p className="mt-5 text-sm font-black text-cyan-200">Edit in onboarding →</p></Link>})}
          </div>
        </section>
      </div>
    </main>
  );
}
