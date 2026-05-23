export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/* -------------------------------------------------------------------------- */
/*                            PREMIUM GLASSMORPHISM                            */
/* -------------------------------------------------------------------------- */

export const workzoGlass =
  "border border-white/[0.06] bg-white/[0.045] backdrop-blur-2xl";

export const workzoGlassStrong =
  "border border-white/[0.08] bg-white/[0.065] backdrop-blur-3xl";

export const workzoCard =
  "rounded-[28px] border border-white/[0.06] bg-[#081120]/88 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-2xl";

export const workzoCardSoft =
  "rounded-[24px] border border-white/[0.05] bg-white/[0.03] shadow-[0_10px_35px_rgba(0,0,0,0.18)] backdrop-blur-xl";

export const workzoGlowBlue =
  "shadow-[0_0_45px_rgba(59,130,246,0.18)]";

export const workzoGlowCyan =
  "shadow-[0_0_40px_rgba(34,211,238,0.14)]";

export const workzoGlowEmerald =
  "shadow-[0_0_40px_rgba(16,185,129,0.14)]";

export const workzoGlowDanger =
  "shadow-[0_0_35px_rgba(239,68,68,0.12)]";

/* -------------------------------------------------------------------------- */
/*                             INTERVIEW STATES                               */
/* -------------------------------------------------------------------------- */

export function recruiterStateGlow(state?: string) {
  switch (state) {
    case "engaged":
    case "interested":
      return workzoGlowEmerald;

    case "skeptical":
    case "pressuring":
      return workzoGlowDanger;

    case "recovering_trust":
      return workzoGlowCyan;

    default:
      return workzoGlowBlue;
  }
}

export function recruiterStateGradient(state?: string) {
  switch (state) {
    case "engaged":
    case "interested":
      return "from-emerald-400/20 via-cyan-400/10 to-blue-500/20";

    case "skeptical":
    case "pressuring":
      return "from-orange-400/20 via-rose-500/10 to-red-500/20";

    case "recovering_trust":
      return "from-cyan-400/20 via-sky-400/10 to-blue-500/20";

    default:
      return "from-blue-500/20 via-cyan-400/10 to-violet-500/20";
  }
}

/* -------------------------------------------------------------------------- */
/*                             PREMIUM TEXT STYLES                            */
/* -------------------------------------------------------------------------- */

export const workzoSectionLabel =
  "text-[11px] font-black uppercase tracking-[0.22em] text-cyan-300/85";

export const workzoHeadline =
  "tracking-[-0.03em] font-black text-white";

export const workzoMutedText =
  "text-slate-400";

export const workzoPremiumBorder =
  "border border-white/[0.06]";