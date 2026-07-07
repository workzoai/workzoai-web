import { BadgeCheck, BriefcaseBusiness, CheckCircle2, Globe2, Languages, MapPin, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

type Props = { params: { candidateId: string }; searchParams?: { org?: string; key?: string; secret?: string } };

async function getCandidate(candidateId: string, searchParams?: Props["searchParams"]) {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
  const qs = new URLSearchParams();
  qs.set("view", "passport");
  qs.set("id", candidateId);
  qs.set("org", searchParams?.org || "demo");
  if (searchParams?.key) qs.set("key", searchParams.key);
  if (searchParams?.secret) qs.set("secret", searchParams.secret);
  const res = await fetch(`${base}/api/talent-marketplace?${qs.toString()}`, { cache: "no-store" }).catch(() => null);
  if (!res || !res.ok) return null;
  const payload = await res.json().catch(() => null);
  return payload?.candidate || null;
}

function tone(score: number) { return score >= 90 ? "text-emerald-700" : score >= 80 ? "text-indigo-700" : score >= 60 ? "text-amber-700" : "text-rose-700"; }
function bg(score: number) { return score >= 90 ? "bg-emerald-600" : score >= 80 ? "bg-indigo-600" : score >= 60 ? "bg-amber-500" : "bg-rose-500"; }
function bar(score: number) { return <div className="h-2 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${bg(score)}`} style={{ width: `${Math.max(0, Math.min(100, score))}%` }} /></div>; }

export default async function TalentPassportPage({ params, searchParams }: Props) {
  const candidate = await getCandidate(params.candidateId, searchParams);
  if (!candidate) {
    return <main className="min-h-screen bg-slate-50 p-6 text-slate-950"><div className="mx-auto max-w-3xl rounded-3xl border bg-white p-8 text-center shadow-sm"><h1 className="text-2xl font-black">Talent Passport unavailable</h1><p className="mt-2 text-slate-600">This candidate has not enabled a public/verified employer passport, or the link has been revoked.</p></div></main>;
  }
  return <main className="min-h-screen bg-slate-50 p-4 text-slate-950 md:p-8">
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="rounded-3xl bg-slate-950 p-8 text-white shadow-xl">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-200">WorkZo Talent Passport</p>
        <div className="mt-5 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-black">{candidate.name}</h1>
            <p className="mt-2 text-xl text-slate-300">{candidate.role}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-sm"><span className="rounded-full bg-white/10 px-3 py-1">{candidate.location}</span><span className="rounded-full bg-white/10 px-3 py-1">{candidate.availability}</span><span className="rounded-full bg-emerald-500/20 px-3 py-1 text-emerald-100">Verified by WorkZo AI</span></div>
          </div>
          <div className="rounded-3xl bg-white p-5 text-center text-slate-950"><p className="text-xs font-black uppercase text-slate-500">WIRI</p><p className={`text-6xl font-black ${tone(candidate.wiri)}`}>{candidate.wiri}</p><p className="text-sm font-bold">Employer Ready Index</p></div>
        </div>
      </header>
      <section className="grid gap-4 md:grid-cols-4"><Info icon={MapPin} label="Location" value={candidate.location} /><Info icon={Languages} label="Languages" value={(candidate.languages || []).join(", ")} /><Info icon={BriefcaseBusiness} label="Availability" value={candidate.availability} /><Info icon={ShieldCheck} label="Verified" value={candidate.verified ? "Yes" : "In progress"} /></section>
      <section className="grid gap-6 lg:grid-cols-[1fr_0.8fr]"><div className="rounded-3xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-black">AI Executive Summary</h2><p className="mt-3 text-slate-700">{candidate.summary}</p><h3 className="mt-6 font-black">Interview Evidence</h3><ul className="mt-3 space-y-2 text-sm">{(candidate.evidence || []).map((e: string) => <li key={e} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />{e}</li>)}</ul></div><div className="rounded-3xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-black">Verification</h2><div className="mt-4 space-y-3 text-sm">{[["CV Verified", candidate.cvVerified], ["Interview Verified", candidate.interviewVerified], ["Technical Verified", candidate.technicalVerified], ["Identity Verified", candidate.identityVerified], ["Employer Ready", candidate.wiri >= 80]].map(([label, done]: any) => <div key={label} className="flex items-center justify-between rounded-2xl bg-slate-50 p-3"><span>{label}</span><b>{done ? "✓" : "Pending"}</b></div>)}</div></div></section>
      <section className="rounded-3xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-black">WIRI Breakdown</h2><div className="mt-4 grid gap-3 md:grid-cols-3">{Object.entries(candidate.wiriBreakdown || {}).map(([k, v]) => <div key={k} className="rounded-2xl bg-slate-50 p-3"><div className="flex justify-between text-sm"><span className="capitalize">{k.replace(/([A-Z])/g, " $1")}</span><b className={tone(Number(v))}>{String(v)}</b></div><div className="mt-2">{bar(Number(v))}</div></div>)}</div></section>
      <footer className="rounded-3xl border bg-white p-5 text-center text-sm text-slate-500">This passport is generated from WorkZo AI interview evidence. It is a readiness signal, not an automatic hiring decision.</footer>
    </div>
  </main>;
}

function Info({ icon: Icon, label, value }: { icon: any; label: string; value: string }) { return <div className="rounded-3xl border bg-white p-5 shadow-sm"><Icon className="h-5 w-5 text-indigo-600" /><p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="font-black">{value}</p></div>; }
