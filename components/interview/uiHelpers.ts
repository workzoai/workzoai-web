export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/* -------------------------------------------------------------------------- */
/*                            PREMIUM GLASSMORPHISM                            */
/* -------------------------------------------------------------------------- */

export const workzoGlass =
  "border border-line bg-surface-2/60 backdrop-blur-2xl";

export const workzoGlassStrong =
  "border border-line bg-surface-2/80 backdrop-blur-3xl";

export const workzoCard =
  "rounded-[28px] border border-line bg-surface shadow-[var(--wz-shadow-card)] backdrop-blur-2xl";

export const workzoCardSoft =
  "rounded-[24px] border border-line-soft bg-surface-2 shadow-[var(--wz-shadow-soft)] backdrop-blur-xl";

export const workzoGlowBlue =
  "shadow-[0_0_45px_rgba(37,99,235,0.18)]";

export const workzoGlowCyan =
  "shadow-[0_0_40px_rgba(37,99,235,0.16)]";

export const workzoGlowEmerald =
  "shadow-[0_0_40px_rgba(16,185,129,0.14)]";

export const workzoGlowDanger =
  "shadow-[0_0_35px_rgba(225,29,72,0.12)]";

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
      return "from-success/20 via-success/10 to-brand/20";

    case "skeptical":
    case "pressuring":
      return "from-warning/20 via-danger/10 to-danger/20";

    case "recovering_trust":
      return "from-brand/20 via-brand/10 to-brand/20";

    default:
      return "from-brand/20 via-brand/10 to-brand/20";
  }
}

/* -------------------------------------------------------------------------- */
/*                             PREMIUM TEXT STYLES                            */
/* -------------------------------------------------------------------------- */

export const workzoSectionLabel =
  "text-[11px] font-black uppercase tracking-[0.22em] text-brand";

export const workzoHeadline =
  "tracking-[-0.03em] font-black text-fg";

export const workzoMutedText =
  "text-muted";

export const workzoPremiumBorder =
  "border border-line";