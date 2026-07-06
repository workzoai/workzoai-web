"use client";

/**
 * /dev-tools/enterprise, MOCK enterprise portal preview.
 *
 * PURPOSE: shows what the Enterprise & Education admin portal will look like
 * BEFORE it is built, so the layout, data model, and scope can be judged
 * visually, and so a sales conversation has a concrete picture to point at.
 *
 * EVERYTHING ON THIS PAGE IS SAMPLE DATA. Nothing here reads from Supabase,
 * nothing is wired to plans or Stripe, and none of the controls do anything.
 * Do NOT demo this as a live product. The "Build status" section at the
 * bottom tracks what exists vs. what must be built to ship this for real.
 *
 * Internal only, like the rest of /dev-tools this must never be linked
 * from any public page.
 */

import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Clock,
  Mic,
  ShieldCheck,
  Users,
  Video,
} from "lucide-react";

// ── Sample data ──────────────────────────────────────────────────────────────

const ORG = {
  name: "Munich Business School, Career Services",
  contract: "Enterprise Annual · 25 seats",
  renewal: "Renews 1 Feb 2027",
};

const POOLS = [
  { icon: Mic, label: "Shared voice minutes", used: 1840, limit: 5000, unit: "min" },
  { icon: Video, label: "Shared video minutes", used: 220, limit: 500, unit: "min" },
  { icon: Users, label: "Active members", used: 21, limit: 25, unit: "seats" },
  { icon: Clock, label: "Sessions this month", used: 164, limit: 0, unit: "" },
];

type MemberRole = "Admin" | "Coach" | "Student";

const MEMBERS: Array<{
  name: string;
  role: MemberRole;
  sessions: number;
  minutes: number;
  avgScore: number | null;
  lastActive: string;
}> = [
  { name: "Dr. Anna Weber", role: "Admin", sessions: 2, minutes: 34, avgScore: null, lastActive: "Today" },
  { name: "Jonas Keller", role: "Coach", sessions: 6, minutes: 118, avgScore: null, lastActive: "Today" },
  { name: "Leyla Demir", role: "Student", sessions: 14, minutes: 236, avgScore: 78, lastActive: "Today" },
  { name: "Marco Rossi", role: "Student", sessions: 11, minutes: 192, avgScore: 71, lastActive: "Yesterday" },
  { name: "Sophie Braun", role: "Student", sessions: 9, minutes: 150, avgScore: 83, lastActive: "Yesterday" },
  { name: "Tariq Hassan", role: "Student", sessions: 8, minutes: 141, avgScore: 66, lastActive: "2 days ago" },
  { name: "Emma Fischer", role: "Student", sessions: 5, minutes: 74, avgScore: 74, lastActive: "4 days ago" },
  { name: "Nikolai Petrov", role: "Student", sessions: 0, minutes: 0, avgScore: null, lastActive: "Never" },
];

const PERSONAS = [
  { name: "MBS Corporate Recruiter", custom: true },
  { name: "Friendly HR", custom: false },
  { name: "Analytical Hiring Manager", custom: false },
  { name: "German Corporate", custom: false },
];

const BUILD_STATUS: Array<{
  element: string;
  status: "Exists" | "Manual" | "Not built";
  note: string;
}> = [
  { element: "Shared voice-minute pool", status: "Not built", note: "Per-user metering exists (workzoServerVoiceMinutes); needs an org table + pool-level sum." },
  { element: "Shared video-minute pool", status: "Not built", note: "Per-user Tavus metering exists; same org-level aggregation needed." },
  { element: "Member table / usage per member", status: "Not built", note: "Data exists per user in interview_sessions; needs org membership + aggregation query." },
  { element: "Roles (Admin / Coach / Student)", status: "Not built", note: "No org or role model in Supabase yet, first schema step." },
  { element: "Custom recruiter personas", status: "Manual", note: "Persona system exists; a custom one is added by hand in workzoRecruiterPersonas.ts per client." },
  { element: "Invite links / seat management", status: "Not built", note: "Needs invite tokens + seat counting against contract." },
  { element: "Dedicated onboarding", status: "Manual", note: "Founder-delivered. No software needed to sell it." },
  { element: "Priority support", status: "Manual", note: "Email SLA. No software needed to sell it." },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function roleClasses(role: MemberRole) {
  if (role === "Admin") return "border-brand/50 text-brand";
  if (role === "Coach") return "border-fg/40 text-fg";
  return "border-line text-muted";
}

function statusClasses(status: string) {
  if (status === "Exists") return "text-success";
  if (status === "Manual") return "text-fg";
  return "text-muted";
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function EnterprisePortalPreviewPage() {
  return (
    <main className="min-h-screen bg-canvas px-5 py-10 text-fg">
      <section className="mx-auto max-w-4xl">
        <Link
          href="/dev-tools"
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-muted hover:text-fg"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Dev tools
        </Link>

        <p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-brand">
          Internal · Mock preview
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.03em]">
          Enterprise portal, how it will look
        </h1>

        <div className="mt-5 rounded-lg border border-brand/40 bg-brand/10 px-5 py-4 text-sm leading-6">
          <p className="font-black">All data on this page is sample data.</p>
          <p className="mt-1 text-muted">
            Nothing is wired to Supabase, plans, or Stripe. This page exists to
            judge layout and scope before building, and to show prospects a
            picture, never as a live demo. Build status per element is at the
            bottom.
          </p>
        </div>

        {/* Org header */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-line bg-fg/[0.04] px-5 py-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-brand" />
            <div>
              <p className="font-black">{ORG.name}</p>
              <p className="text-xs text-muted">{ORG.contract}</p>
            </div>
          </div>
          <p className="text-xs font-bold text-muted">{ORG.renewal}</p>
        </div>

        {/* Shared pools, the core thing enterprise buys */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {POOLS.map((pool) => {
            const hasLimit = pool.limit > 0;
            const pct = hasLimit ? Math.min(100, Math.round((pool.used / pool.limit) * 100)) : 0;
            return (
              <div key={pool.label} className="rounded-lg border border-line bg-fg/[0.03] p-5">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-muted">
                  <pool.icon className="h-4 w-4" /> {pool.label}
                </div>
                <p className="mt-3 text-2xl font-black tracking-tight">
                  {pool.used.toLocaleString()}
                  {hasLimit && (
                    <span className="text-base font-bold text-muted">
                      {" "}/ {pool.limit.toLocaleString()} {pool.unit}
                    </span>
                  )}
                </p>
                {hasLimit && (
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-fg/10">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Members */}
        <h2 className="mt-10 text-lg font-black tracking-tight">Members</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs font-black uppercase tracking-[0.12em] text-muted">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 text-right">Sessions</th>
                <th className="px-4 py-3 text-right">Minutes</th>
                <th className="px-4 py-3 text-right">Avg score</th>
                <th className="px-4 py-3 text-right">Last active</th>
              </tr>
            </thead>
            <tbody>
              {MEMBERS.map((m) => (
                <tr key={m.name} className="border-b border-line/50 last:border-0">
                  <td className="px-4 py-3 font-bold">{m.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-black ${roleClasses(m.role)}`}>
                      {m.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{m.sessions}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{m.minutes}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{m.avgScore ?? "-"}</td>
                  <td className="px-4 py-3 text-right text-muted">{m.lastActive}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Cohort settings */}
        <h2 className="mt-10 text-lg font-black tracking-tight">Cohort settings</h2>
        <div className="mt-3 rounded-lg border border-line bg-fg/[0.03] p-5 text-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">
            Assigned recruiter personas
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PERSONAS.map((p) => (
              <span
                key={p.name}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
                  p.custom ? "border-brand/50 text-brand" : "border-line text-muted"
                }`}
              >
                {p.custom && <ShieldCheck className="h-3.5 w-3.5" />}
                {p.name}
                {p.custom && " · custom"}
              </span>
            ))}
          </div>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.14em] text-muted">
            Default job description
          </p>
          <p className="mt-2 text-muted">
            Graduate Trainee, Consulting (uploaded by Career Services, applied
            to all student interviews unless the student supplies their own).
          </p>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.14em] text-muted">
            Interview language
          </p>
          <p className="mt-2 text-muted">German (students may switch per session)</p>
        </div>

        {/* Build status, what this page needs to become real */}
        <h2 className="mt-10 text-lg font-black tracking-tight">
          Build status, mock vs. reality
        </h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs font-black uppercase tracking-[0.12em] text-muted">
                <th className="px-4 py-3">Element</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Note</th>
              </tr>
            </thead>
            <tbody>
              {BUILD_STATUS.map((row) => (
                <tr key={row.element} className="border-b border-line/50 align-top last:border-0">
                  <td className="px-4 py-3 font-bold">{row.element}</td>
                  <td className={`px-4 py-3 font-black ${statusClasses(row.status)}`}>{row.status}</td>
                  <td className="px-4 py-3 text-muted">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
