"use client";

/**
 * CvIdentityConfirm
 *
 * A small, launch-safe reliability net shown once after CV upload and before
 * the interview starts. No parser is correct on every CV layout, so instead of
 * betting the whole interview on the parse, we show the candidate the two
 * fields that matter most for how the recruiter addresses them and what the
 * questions target, their name and the role they are interviewing for, and let
 * them fix either in ~5 seconds.
 *
 * This makes identity correct for 100% of users regardless of parser accuracy,
 * while the parser keeps improving in the background. It is deliberately
 * dependency-free (React only) and styled with the existing WorkZo tokens so it
 * drops in without touching the design system.
 */

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

export type CvIdentityConfirmProfile = {
  basics?: { name?: string; headline?: string } | null;
};

export type CvIdentityConfirmProps = {
  open: boolean;
  profile: CvIdentityConfirmProfile | null | undefined;
  fileName?: string;
  /** Target role already typed on the setup screen, if any. Seeds the role field. */
  initialRole?: string;
  /** Called with the confirmed (possibly edited) values. */
  onConfirm: (edited: { name: string; role: string }) => void;
  /** Called when the user dismisses without starting. */
  onCancel: () => void;
};

// Values the finalizer emits when it could not read a real one. We surface a
// gentle nudge for these rather than blocking, the net should never trap a user.
const PLACEHOLDER_NAMES = new Set(["", "candidate", "unknown", "n/a"]);
const PLACEHOLDER_ROLES = new Set(["", "professional", "general role", "n/a"]);

function isPlaceholder(value: string, set: Set<string>): boolean {
  return set.has(value.trim().toLowerCase());
}

export default function CvIdentityConfirm({
  open,
  profile,
  fileName,
  initialRole,
  onConfirm,
  onCancel,
}: CvIdentityConfirmProps) {
  const initialName = profile?.basics?.name?.trim() || "";
  // The role the interview and every downstream tool tailors to: prefer what
  // the user already typed on the setup screen, fall back to the CV headline.
  const seededRole = (initialRole?.trim() || profile?.basics?.headline?.trim() || "");

  const [name, setName] = useState(initialName);
  const [role, setRole] = useState(seededRole);
  const nameRef = useRef<HTMLInputElement>(null);

  // Re-seed when a new profile arrives (e.g. after re-upload).
  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setRole(seededRole);
    // Focus the first field that needs attention.
    const t = window.setTimeout(() => nameRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open, initialName, seededRole]);

  const nameNeedsAttention = useMemo(() => isPlaceholder(name, PLACEHOLDER_NAMES), [name]);
  const roleNeedsAttention = useMemo(
    () => isPlaceholder(role, PLACEHOLDER_ROLES),
    [role],
  );

  if (!open) return null;

  const confirm = () =>
    onConfirm({ name: name.trim(), role: role.trim() });

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      confirm();
    }
  };

  const fieldClass =
    "w-full rounded-xl border bg-canvas-soft px-3.5 py-2.5 text-sm font-bold text-fg outline-none transition placeholder:text-muted/60 focus:border-brand/60";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cv-identity-title"
      onKeyDown={onKeyDown}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-[22px] border border-line bg-fg/[0.028] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted">
          Quick check
        </p>
        <h2
          id="cv-identity-title"
          className="mt-1.5 text-lg font-black leading-6 text-fg"
        >
          Is this you?
        </h2>
        <p className="mt-1.5 text-[13px] font-medium leading-5 text-muted">
          Your interviewer uses these to address you and to tailor the questions. Fix anything that looks off
          {fileName ? `, we read them from ${fileName}.` : "."}
        </p>

        <div className="mt-4 space-y-3.5">
          <label className="block">
            <span className="mb-1.5 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-muted">
              Name
              {nameNeedsAttention && (
                <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-black tracking-normal text-brand">
                  needs your input
                </span>
              )}
            </span>
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              autoComplete="name"
              className={`${fieldClass} ${
                nameNeedsAttention ? "border-brand/50" : "border-line"
              }`}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-muted">
              Role you are interviewing for
              {roleNeedsAttention && (
                <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-black tracking-normal text-brand">
                  add your role
                </span>
              )}
            </span>
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Marketing Manager"
              className={`${fieldClass} ${
                roleNeedsAttention ? "border-brand/50" : "border-line"
              }`}
            />
          </label>
        </div>

        <div className="mt-5 flex items-center gap-2.5">
          <button
            type="button"
            onClick={confirm}
            className="flex-1 rounded-xl bg-brand px-4 py-2.5 text-sm font-black text-on-brand transition active:scale-[0.99]"
          >
            Looks right, start interview
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-line bg-fg/[0.04] px-4 py-2.5 text-sm font-black text-muted transition hover:bg-fg/[0.08]"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
