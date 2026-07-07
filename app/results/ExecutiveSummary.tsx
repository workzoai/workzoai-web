"use client";

/**
 * Executive Summary, the skimmable top layer of the results page.
 *
 * Addresses the overload critique directly:
 *  - ONE primary score. WIRI is the headline, credit-score style, on a
 *    labeled band. Communication / Confidence / Role / Trust / Evidence
 *    are shown as feeders INTO it, not as five competing "scores".
 *  - One page a recruiter would actually read: decision, top 3 strengths,
 *    top 3 blockers, one quick win, and an estimated prep effort.
 *
 * Pure and presentational. It reads values already computed for the
 * report, so it adds no data plumbing and cannot change any score.
 * The full detailed breakdown continues to render below, unchanged.
 */

import {
  MessageSquareText, Gauge, Target, ShieldCheck, FileText,
  CheckCircle2, AlertTriangle, ArrowRight, Sparkles,
} from "lucide-react";

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(Number.isFinite(value) ? value : 0)));
}

type WiriBand = {
  key: string;
  label: string;
  blurb: string;
  prep: string;
  tone: "danger" | "warning" | "brand" | "success";
};

function bandFor(wiri: number): WiriBand {
  if (wiri >= 90) return { key: "top", label: "Top tier", blurb: "Reads as a top-decile candidate.", prep: "Polish only, keep your edge sharp.", tone: "success" };
  if (wiri >= 80) return { key: "strong", label: "Strong hire", blurb: "A recruiter would move you forward.", prep: "One targeted session before the real thing.", tone: "success" };
  if (wiri >= 70) return { key: "ready", label: "Interview ready", blurb: "Competitive, with clear areas to tighten.", prep: "One to two focused sessions.", tone: "brand" };
  if (wiri >= 55) return { key: "developing", label: "Developing", blurb: "The core is there, delivery lets it down.", prep: "Two to three sessions on your weak signals.", tone: "warning" };
  return { key: "risk", label: "High risk", blurb: "A recruiter would pass at this level today.", prep: "Three or more sessions, rebuild the fundamentals.", tone: "danger" };
}

const TONE = {
  danger: { text: "text-danger", ring: "#ef4444", chip: "border-danger/25 bg-danger/10 text-danger" },
  warning: { text: "text-warning", ring: "#f59e0b", chip: "border-warning/25 bg-warning/10 text-warning" },
  brand: { text: "text-brand", ring: "#3b82f6", chip: "border-brand/25 bg-brand/10 text-brand" },
  success: { text: "text-success", ring: "#22c55e", chip: "border-success/25 bg-success/10 text-success" },
} as const;

/* WIRI on a credit-score-style track, with the five band labels. */
function WiriBandMeter({ wiri, band }: { wiri: number; band: WiriBand }) {
  const pos = clamp(wiri);
  const ticks = [
    { at: 27, label: "High risk" },
    { at: 62, label: "Developing" },
    { at: 74, label: "Ready" },
    { at: 85, label: "Strong" },
    { at: 95, label: "Top" },
  ];
  return (
    <div className="w-full">
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-fg/10">
        <div
          className="h-full rounded-full"
          style={{ width: `${pos}%`, background: "linear-gradient(90deg,#ef4444 0%,#f59e0b 35%,#3b82f6 62%,#22c55e 100%)" }}
        />
      </div>
      <div
        className="relative -mt-[9px] h-0"
        aria-hidden
      >
        <div
          className="absolute -translate-x-1/2"
          style={{ left: `${pos}%` }}
        >
          <div className="h-4 w-4 rounded-full border-2 border-canvas bg-fg shadow" />
        </div>
      </div>
      <div className="mt-3 flex justify-between">
        {ticks.map((t) => (
          <span key={t.label} className="text-[9px] font-black uppercase tracking-[0.12em] text-muted">{t.label}</span>
        ))}
      </div>
    </div>
  );
}

function FeederPill({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: number }) {
  const v = clamp(value);
  const tone = v >= 80 ? "text-success" : v >= 60 ? "text-fg" : "text-warning";
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-fg/[0.035] px-3 py-2">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted" />
      <span className="min-w-0 flex-1 truncate text-[11px] font-black uppercase tracking-[0.1em] text-muted">{label}</span>
      <span className={`text-sm font-black tabular-nums ${tone}`}>{v}</span>
    </div>
  );
}

export type ExecutiveSummaryProps = {
  wiri: number;
  wiriLabel?: string;
  decision: string;
  biggestBlocker: string;
  quickWin?: string;
  strengths: string[];
  blockers: string[];
  feeders: {
    communication: number;
    confidence: number;
    roleCompetency: number;
    trust: number;
    evidence: number;
  };
  answersCount?: number;
  onContinue?: () => void;
  continueLabel?: string;
};

export default function ExecutiveSummary(props: ExecutiveSummaryProps) {
  const wiri = clamp(props.wiri);
  const band = bandFor(wiri);
  const tone = TONE[band.tone];
  const angle = wiri * 3.6;

  const topStrengths = (props.strengths || []).filter(Boolean).slice(0, 3);
  const topBlockers = (props.blockers || []).filter(Boolean).slice(0, 3);

  return (
    <section className="mt-4 overflow-hidden rounded-[1.75rem] border border-line bg-fg/[0.02]">
      <div className="border-b border-line px-6 pt-6 pb-5 sm:px-8">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-muted">Executive summary</p>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black ${tone.chip}`}>
            <Sparkles className="h-3 w-3" /> {band.label}
          </span>
        </div>

        <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-center">
          {/* WIRI ring, the single primary number */}
          <div className="flex items-center gap-4">
            <div
              className="grid h-24 w-24 shrink-0 place-items-center rounded-full"
              style={{ background: `conic-gradient(${tone.ring} ${angle}deg, rgba(255,255,255,0.12) 0deg)` }}
            >
              <div className="grid h-[4.75rem] w-[4.75rem] place-items-center rounded-full bg-canvas text-center">
                <div>
                  <p className="text-3xl font-black leading-none text-fg tabular-nums">{wiri}</p>
                  <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-muted">WIRI</p>
                </div>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted">Readiness</p>
              <p className={`text-lg font-black leading-tight ${tone.text}`}>{props.wiriLabel || band.label}</p>
              <p className="mt-1 text-xs leading-5 text-muted">{band.blurb}</p>
            </div>
          </div>

          {/* Band meter */}
          <div className="flex-1 sm:pl-4">
            <WiriBandMeter wiri={wiri} band={band} />
          </div>
        </div>

        {/* Feeders: everything rolls up into WIRI */}
        <p className="mt-6 text-[11px] font-black uppercase tracking-[0.16em] text-muted">What feeds your WIRI</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <FeederPill icon={MessageSquareText} label="Comm" value={props.feeders.communication} />
          <FeederPill icon={Gauge} label="Confidence" value={props.feeders.confidence} />
          <FeederPill icon={Target} label="Role fit" value={props.feeders.roleCompetency} />
          <FeederPill icon={ShieldCheck} label="Trust" value={props.feeders.trust} />
          <FeederPill icon={FileText} label="Evidence" value={props.feeders.evidence} />
        </div>
      </div>

      {/* Decision + strengths + blockers */}
      <div className="px-6 py-5 sm:px-8">
        <div className="rounded-xl border border-line bg-canvas-soft px-4 py-3">
          <p className="text-xs leading-5 text-muted">
            Hiring call right now: <span className="font-black text-fg">{props.decision}</span>. Biggest blocker: <span className="font-black text-fg">{props.biggestBlocker}</span>.
          </p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-success">
              <CheckCircle2 className="h-3.5 w-3.5" /> Top strengths
            </p>
            <div className="mt-2 space-y-2">
              {topStrengths.length ? topStrengths.map((s) => (
                <p key={s} className="rounded-xl bg-success/10 px-3 py-2 text-xs leading-5 text-success">{s}</p>
              )) : <p className="rounded-xl bg-fg/[0.04] px-3 py-2 text-xs text-muted">Complete a full session to surface your strengths.</p>}
            </div>
          </div>

          <div>
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-warning">
              <AlertTriangle className="h-3.5 w-3.5" /> Top blockers
            </p>
            <div className="mt-2 space-y-2">
              {topBlockers.length ? topBlockers.map((b) => (
                <p key={b} className="rounded-xl bg-warning/10 px-3 py-2 text-xs leading-5 text-warning">{b}</p>
              )) : <p className="rounded-xl bg-fg/[0.04] px-3 py-2 text-xs text-muted">No major blockers detected in this session.</p>}
            </div>
          </div>
        </div>

        {props.quickWin ? (
          <div className="mt-4 rounded-xl border border-brand/20 bg-brand/[0.06] px-4 py-3">
            <p className="text-xs leading-5 text-muted"><span className="font-black text-brand">Fastest win: </span>{props.quickWin}</p>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted"><span className="font-black text-fg">Estimated prep:</span> {band.prep}</p>
          {props.onContinue ? (
            <button
              onClick={props.onContinue}
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-black text-on-brand transition hover:bg-brand-strong"
            >
              {props.continueLabel || "Continue to full breakdown"} <ArrowRight className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
