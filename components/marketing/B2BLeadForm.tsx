"use client";

/**
 * components/marketing/B2BLeadForm.tsx
 *
 * Lead capture for enterprise / education enquiries. Replaces the previous
 * mailto: CTA, which converted poorly (no mail client configured on many
 * machines) and captured zero structured data. Submits to /api/leads, which
 * stores the lead and notifies the founder by email.
 */

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

const ORG_TYPES = ["Bootcamp", "University / Career Services", "Company / HR team", "Recruiting agency", "Other"] as const;
const COHORT_SIZES = ["1-25", "26-100", "101-500", "500+"] as const;

export default function B2BLeadForm({ source = "enterprise" }: { source?: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [form, setForm] = useState({
    name: "",
    email: "",
    organization: "",
    orgType: "" as string,
    cohortSize: "" as string,
    message: "",
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit() {
    if (!form.email.trim() || !form.organization.trim()) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source }),
      });
      setStatus(res.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-success/25 bg-success/10 p-6">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
        <div>
          <p className="text-sm font-black text-fg">Thanks, we&apos;ve got it.</p>
          <p className="mt-1 text-sm leading-6 text-muted">
            You&apos;ll hear back within one business day at {form.email}. If it&apos;s urgent, email{" "}
            <a href="mailto:support@workzoai.com" className="underline">support@workzoai.com</a>.
          </p>
        </div>
      </div>
    );
  }

  const inputCls =
    "w-full rounded-lg border border-line bg-canvas-soft px-3.5 py-2.5 text-sm text-fg outline-none transition placeholder:text-muted/60 focus:border-brand/50";

  return (
    <div className="rounded-2xl border border-line bg-surface/70 p-6 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-black uppercase tracking-[0.14em] text-muted">Your name</label>
          <input className={`mt-1.5 ${inputCls}`} value={form.name} onChange={set("name")} placeholder="Full name" autoComplete="name" />
        </div>
        <div>
          <label className="text-xs font-black uppercase tracking-[0.14em] text-muted">Work email *</label>
          <input className={`mt-1.5 ${inputCls}`} type="email" value={form.email} onChange={set("email")} placeholder="you@organization.com" autoComplete="email" />
        </div>
        <div>
          <label className="text-xs font-black uppercase tracking-[0.14em] text-muted">Organization *</label>
          <input className={`mt-1.5 ${inputCls}`} value={form.organization} onChange={set("organization")} placeholder="Organization name" autoComplete="organization" />
        </div>
        <div>
          <label className="text-xs font-black uppercase tracking-[0.14em] text-muted">Organization type</label>
          <select className={`mt-1.5 ${inputCls}`} value={form.orgType} onChange={set("orgType")}>
            <option value="">Select…</option>
            {ORG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-black uppercase tracking-[0.14em] text-muted">People to prepare</label>
          <select className={`mt-1.5 ${inputCls}`} value={form.cohortSize} onChange={set("cohortSize")}>
            <option value="">Select…</option>
            {COHORT_SIZES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-black uppercase tracking-[0.14em] text-muted">Anything else?</label>
          <textarea className={`mt-1.5 min-h-[96px] ${inputCls}`} value={form.message} onChange={set("message")} placeholder="Timeline, goals, questions…" />
        </div>
      </div>

      <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-muted">
          We only use this to reply to your enquiry. See our{" "}
          <a href="/legal/privacy" className="underline">privacy policy</a>.
        </p>
        <button
          onClick={submit}
          disabled={status === "sending" || !form.email.trim() || !form.organization.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-black text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "sending" && <Loader2 className="h-4 w-4 animate-spin" />}
          {status === "sending" ? "Sending…" : "Send enquiry"}
        </button>
      </div>
      {status === "error" && (
        <p className="mt-3 text-sm text-danger">
          That didn&apos;t go through, please try again or email{" "}
          <a href="mailto:support@workzoai.com" className="underline">support@workzoai.com</a>.
        </p>
      )}
    </div>
  );
}
