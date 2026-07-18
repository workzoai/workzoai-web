"use client";

/*
 * app/applications/ApplicationsBoard.tsx
 *
 * A status board for tracked applications. Columns are the pipeline stages; each card
 * can be moved forward or back. Deliberately calm: this is a place to keep track, not
 * a dashboard that shouts. The one piece of proactive help is a gentle follow-up nudge
 * on applications that have sat in "applied" for a while, because following up on time
 * is the thing job seekers most often forget.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, ExternalLink, Clock, Briefcase, ChevronRight, ChevronLeft, Trash2, Plus, X } from "lucide-react";
import PremiumFeatureGate from "@/components/PremiumFeatureGate";
import { JOB_APPLICATION_STATUSES, type JobApplicationStatus } from "@/lib/smart-apply/types";

type Application = {
  id: string;
  job_title: string;
  company_name: string;
  location: string | null;
  apply_url: string | null;
  status: JobApplicationStatus;
  match_score: number | null;
  applied_at: string | null;
  updated_at: string;
  notes: string | null;
};

/* The visible pipeline. "archived" and "withdrawn" are terminal and shown collapsed. */
const PIPELINE: JobApplicationStatus[] = ["saved", "preparing", "applied", "screening", "interviewing", "assessment", "offer", "rejected"];

const STATUS_LABEL: Record<JobApplicationStatus, string> = {
  saved: "Saved",
  preparing: "Preparing",
  applied: "Applied",
  screening: "Screening",
  interviewing: "Interviewing",
  assessment: "Assessment",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  archived: "Archived",
};

const STATUS_TONE: Record<JobApplicationStatus, string> = {
  saved: "text-muted",
  preparing: "text-muted",
  applied: "text-brand",
  screening: "text-brand",
  interviewing: "text-warning",
  assessment: "text-warning",
  offer: "text-success",
  rejected: "text-danger",
  withdrawn: "text-muted",
  archived: "text-muted",
};

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
}

export default function ApplicationsBoard() {
  const [apps, setApps] = useState<Application[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    fetch("/api/smart-apply", { method: "GET" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ok) setApps(d.applications || []);
        else setError("load_failed");
      })
      .catch(() => setError("load_failed"));
  }, []);

  async function move(app: Application, direction: 1 | -1) {
    const idx = PIPELINE.indexOf(app.status);
    if (idx === -1) return;
    const next = PIPELINE[idx + direction];
    if (!next) return;

    setSaving(app.id);
    // Optimistic: update locally, roll back on failure.
    const prevStatus = app.status;
    setApps((cur) => cur?.map((a) => (a.id === app.id ? { ...a, status: next } : a)) || cur);

    const res = await fetch(`/api/applications/${app.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    }).catch(() => null);

    if (!res || !res.ok) {
      setApps((cur) => cur?.map((a) => (a.id === app.id ? { ...a, status: prevStatus } : a)) || cur);
    }
    setSaving(null);
  }

  async function removeApp(app: Application) {
    // Optimistic removal, restore on failure.
    const snapshot = apps;
    setApps((cur) => cur?.filter((a) => a.id !== app.id) || cur);
    const res = await fetch(`/api/applications/${app.id}`, { method: "DELETE" }).catch(() => null);
    if (!res || !res.ok) setApps(snapshot || null);
  }

  async function addApp(input: { jobTitle: string; companyName: string; location?: string; applyUrl?: string }) {
    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, status: "applied" }),
    }).catch(() => null);
    if (res && res.ok) {
      // Reload so the new row appears with its server-assigned id and timestamps.
      const listed = await fetch("/api/smart-apply").then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (listed?.ok) setApps(listed.applications || []);
      setShowAdd(false);
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<JobApplicationStatus, Application[]>();
    for (const s of JOB_APPLICATION_STATUSES) map.set(s, []);
    for (const app of apps || []) map.get(app.status)?.push(app);
    return map;
  }, [apps]);

  const activeCount = (apps || []).filter((a) => !["rejected", "withdrawn", "archived"].includes(a.status)).length;

  return (
    <PremiumFeatureGate
      feature="smart_apply"
      title="Application tracking is a Premium feature"
      description="Keep every application in one place and follow up at the right time."
    >
      <main className="min-h-screen bg-canvas text-fg">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
          <div className="mb-6 flex items-center justify-between gap-4">
            <Link href="/jobs" className="inline-flex items-center gap-2 text-sm font-black text-muted hover:text-fg">
              <ArrowLeft className="h-4 w-4" /> Back to jobs
            </Link>
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-fg/[0.04] px-4 py-2 text-sm font-black text-fg hover:bg-fg/[0.08]"
            >
              <Plus className="h-4 w-4" /> Add application
            </button>
          </div>

          {showAdd && <AddApplicationForm onClose={() => setShowAdd(false)} onAdd={addApp} />}

          <div className="mb-8">
            <h1 className="text-2xl font-black text-fg sm:text-3xl">Your applications</h1>
            <p className="mt-1 text-sm font-bold text-muted">
              {apps === null ? "Loading…" : activeCount === 0 ? "Nothing in flight yet." : `${activeCount} application${activeCount === 1 ? "" : "s"} in progress.`}
            </p>
          </div>

          {apps === null && !error && (
            <div className="grid place-items-center rounded-2xl border border-line bg-surface/60 py-20">
              <div className="flex items-center gap-3 text-sm font-black text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading your applications…
              </div>
            </div>
          )}

          {error && (
            <div className="grid place-items-center rounded-2xl border border-line bg-surface/60 py-16 text-center">
              <p className="text-sm font-black text-fg">Could not load your applications.</p>
              <button onClick={() => window.location.reload()} className="mt-4 rounded-xl bg-brand px-5 py-2.5 text-sm font-black text-on-brand hover:opacity-90">
                Try again
              </button>
            </div>
          )}

          {apps !== null && !error && apps.length === 0 && <EmptyState />}

          {apps !== null && apps.length > 0 && (
            <div className="space-y-6">
              {PIPELINE.map((status) => {
                const list = grouped.get(status) || [];
                if (!list.length) return null;
                return (
                  <section key={status}>
                    <div className="mb-3 flex items-center gap-2">
                      <h2 className={`text-sm font-black uppercase tracking-wide ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</h2>
                      <span className="rounded-full bg-fg/5 px-2 py-0.5 text-[11px] font-black text-muted">{list.length}</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {list.map((app) => (
                        <ApplicationCard key={app.id} app={app} saving={saving === app.id} onMove={move} onRemove={removeApp} />
                      ))}
                    </div>
                  </section>
                );
              })}

              {/* Terminal states, quietly at the bottom. */}
              {(["withdrawn", "archived"] as JobApplicationStatus[]).some((s) => (grouped.get(s) || []).length > 0) && (
                <section>
                  <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-muted">Closed</h2>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {(["withdrawn", "archived"] as JobApplicationStatus[]).flatMap((s) => grouped.get(s) || []).map((app) => (
                      <ApplicationCard key={app.id} app={app} saving={saving === app.id} onMove={move} onRemove={removeApp} muted />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </main>
    </PremiumFeatureGate>
  );
}

function ApplicationCard({ app, saving, onMove, onRemove, muted }: { app: Application; saving: boolean; onMove: (a: Application, d: 1 | -1) => void; onRemove: (a: Application) => void; muted?: boolean }) {
  const idx = PIPELINE.indexOf(app.status);
  const canForward = idx >= 0 && idx < PIPELINE.length - 1;
  const canBack = idx > 0;

  // Follow-up nudge: applied a week+ ago and still sitting in "applied".
  const days = daysSince(app.applied_at);
  const needsFollowUp = app.status === "applied" && days !== null && days >= 7;

  return (
    <div className={`rounded-2xl border border-line bg-surface/60 p-4 ${muted ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-fg">{app.job_title}</p>
          <p className="truncate text-xs font-bold text-muted">
            {app.company_name}
            {app.location ? ` · ${app.location}` : ""}
          </p>
        </div>
        {typeof app.match_score === "number" && (
          <span className="shrink-0 rounded-full bg-fg/5 px-2 py-0.5 text-[11px] font-black text-muted">{app.match_score}</span>
        )}
      </div>

      {needsFollowUp && (
        <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-warning/[0.08] px-2.5 py-1.5 text-[11px] font-bold text-warning">
          <Clock className="h-3 w-3" /> Applied {days} days ago. A short follow-up can help.
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onMove(app, -1)}
            disabled={!canBack || saving}
            className="rounded-lg border border-line p-1.5 text-muted disabled:opacity-30 hover:text-fg"
            aria-label="Move back a stage"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onMove(app, 1)}
            disabled={!canForward || saving}
            className="rounded-lg border border-line p-1.5 text-muted disabled:opacity-30 hover:text-fg"
            aria-label="Move forward a stage"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        </div>
        {app.apply_url && (
          <a
            href={app.apply_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-black text-muted hover:text-fg"
          >
            View posting <ExternalLink className="h-3 w-3" />
          </a>
        )}
        <button
          onClick={() => onRemove(app)}
          className="ml-auto rounded-lg p-1.5 text-muted hover:text-danger"
          aria-label="Remove application"
          title="Remove from tracker"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-line bg-surface/40 py-20 text-center">
      <Briefcase className="mb-3 h-8 w-8 text-brand" />
      <h3 className="text-lg font-black text-fg">No applications yet</h3>
      <p className="mt-1 max-w-sm text-sm leading-6 text-muted">
        When you prepare an application with Smart Apply and mark it as applied, it lands here so you can track it and follow up.
      </p>
      <Link href="/jobs" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-black text-on-brand hover:opacity-90">
        Find jobs <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function AddApplicationForm({ onClose, onAdd }: { onClose: () => void; onAdd: (input: { jobTitle: string; companyName: string; location?: string; applyUrl?: string }) => void }) {
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [location, setLocation] = useState("");
  const [applyUrl, setApplyUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const canSubmit = jobTitle.trim().length > 0 && companyName.trim().length > 0 && !busy;

  return (
    <div className="mb-6 rounded-2xl border border-line bg-surface/60 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-black text-fg">Add an application</h3>
        <button onClick={onClose} className="rounded-lg p-1 text-muted hover:text-fg" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          placeholder="Job title"
          className="rounded-lg border border-line bg-canvas/50 px-3 py-2 text-sm text-fg placeholder:text-muted"
        />
        <input
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="Company"
          className="rounded-lg border border-line bg-canvas/50 px-3 py-2 text-sm text-fg placeholder:text-muted"
        />
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Location (optional)"
          className="rounded-lg border border-line bg-canvas/50 px-3 py-2 text-sm text-fg placeholder:text-muted"
        />
        <input
          value={applyUrl}
          onChange={(e) => setApplyUrl(e.target.value)}
          placeholder="Link (optional)"
          className="rounded-lg border border-line bg-canvas/50 px-3 py-2 text-sm text-fg placeholder:text-muted"
        />
      </div>
      <button
        onClick={async () => {
          if (!canSubmit) return;
          setBusy(true);
          await onAdd({ jobTitle: jobTitle.trim(), companyName: companyName.trim(), location: location.trim() || undefined, applyUrl: applyUrl.trim() || undefined });
          setBusy(false);
        }}
        disabled={!canSubmit}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-black text-on-brand disabled:opacity-50 hover:opacity-90"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Add to tracker
      </button>
    </div>
  );
}
