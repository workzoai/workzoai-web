/*
 * WorkZo AI - job description ownership
 *
 * THE BUG THIS EXISTS TO KILL
 *
 * `saveLatestInterviewSetup` writes to EIGHT localStorage keys, and it is called
 * from more than one feature. `app/jobs/page.tsx` calls it when a user selects a
 * job from the jobs board:
 *
 *     saveLatestInterviewSetup({ ...currentSetup, jobDescription: job.description })
 *
 * Onboarding, /cv, and /copilot all read that same bucket back. So selecting ONE
 * job on the jobs board silently became "the job description" for the entire
 * product: every CV rewrite, every cover letter, and every interview from that
 * point on was targeted at a job the user never pasted, and the onboarding field
 * kept refilling with it on every remount because the restore effect used
 * `setJobDescription(prev => prev || restored)`, and `prev` is "" again after a
 * remount.
 *
 * The user pastes their JD. The app quietly uses a different one. Nothing in the
 * CV pipeline is broken, and no amount of parser work would ever have fixed it.
 *
 * THE RULE
 *
 * A job description has an OWNER. Only the user can make one active.
 *
 *   - "user"   the person typed or pasted it. This is the only ACTIVE source.
 *   - "job"    the jobs board proposes one. This is an OFFER. It is never
 *              installed without an explicit action.
 *
 * Anything that is not user-owned is an offer. Offers are shown, never applied.
 * Offers expire, so a JD from three weeks ago cannot silently retarget a rewrite
 * the user starts today.
 *
 * Entity-free and feature-agnostic: no page, job board, or JD text is special-cased.
 */

export type WorkZoJdSource = "user" | "job";

export type WorkZoJdRecord = {
  text: string;
  source: WorkZoJdSource;
  /** Human label for an offer, e.g. "Data Engineer at ExampleCorp". */
  label?: string;
  updatedAt: string;
};

/** The user's own JD. The ONLY thing any feature may auto-apply. */
const ACTIVE_KEY = "workzo_jd_active";
/** A JD the jobs board wants to propose. Requires an explicit user action. */
const OFFER_KEY = "workzo_jd_offer";

/**
 * An offer goes stale. A month-old job posting must not be able to silently
 * retarget a CV the user rewrites today.
 */
const OFFER_TTL_MS = 24 * 60 * 60 * 1000;

function readRecord(key: string): WorkZoJdRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkZoJdRecord;
    if (!parsed || typeof parsed.text !== "string" || !parsed.text.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeRecord(key: string, record: WorkZoJdRecord | null) {
  if (typeof window === "undefined") return;
  try {
    if (!record) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(record));
  } catch {
    /* storage disabled, degrade quietly */
  }
}

function isExpired(record: WorkZoJdRecord, ttlMs: number): boolean {
  const t = Date.parse(record.updatedAt || "");
  if (!Number.isFinite(t)) return true;
  return Date.now() - t > ttlMs;
}

/* ------------------------------- active JD -------------------------------- */

/**
 * The JD the user actually chose. Safe to prefill into a field and safe to send
 * to /api/cv, /api/copilot, and the interview engine.
 */
export function readActiveJobDescription(): string {
  const record = readRecord(ACTIVE_KEY);
  return record?.source === "user" ? record.text : "";
}

/**
 * Called when the user types, pastes, or explicitly accepts an offer. This is
 * the ONLY function that can make a JD active.
 */
export function commitJobDescription(text: string): void {
  const clean = String(text || "").trim();

  // IMPORTANT: an empty value is not treated as an instruction to erase the
  // active JD. React-controlled fields render once with their initial empty
  // state before browser storage is restored. Treating that first render as a
  // delete caused refreshes to wipe the JD for every feature.
  //
  // Deliberate removal must go through clearJobDescription(), which keeps
  // hydration and explicit user intent separate.
  if (!clean) return;
  writeRecord(ACTIVE_KEY, {
    text: clean.slice(0, 20000),
    source: "user",
    updatedAt: new Date().toISOString(),
  });
}

export function clearJobDescription(): void {
  writeRecord(ACTIVE_KEY, null);
  writeRecord(OFFER_KEY, null);
}

/* -------------------------------- offers ---------------------------------- */

/**
 * The jobs board calls this instead of writing into the shared interview setup.
 * It proposes. It does not install.
 */
export function offerJobDescriptionFromJob(input: {
  text: string;
  title?: string;
  company?: string;
}): void {
  const clean = String(input.text || "").trim();
  if (!clean) return;
  const label = [input.title, input.company].filter(Boolean).join(" at ");
  writeRecord(OFFER_KEY, {
    text: clean.slice(0, 20000),
    source: "job",
    label: label || undefined,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Returns a pending offer for the UI to SHOW, with a Use / Dismiss choice.
 * Never call this to prefill a field directly.
 */
export function readPendingJobOffer(): WorkZoJdRecord | null {
  const record = readRecord(OFFER_KEY);
  if (!record) return null;
  if (isExpired(record, OFFER_TTL_MS)) {
    writeRecord(OFFER_KEY, null);
    return null;
  }
  return record;
}

/** The user pressed "Use this job". Promote the offer to active. */
export function acceptPendingJobOffer(): string {
  const record = readPendingJobOffer();
  if (!record) return "";
  commitJobDescription(record.text);
  writeRecord(OFFER_KEY, null);
  return record.text;
}

export function dismissPendingJobOffer(): void {
  writeRecord(OFFER_KEY, null);
}

/* ------------------------------- migration -------------------------------- */

/**
 * ONE-TIME PURGE.
 *
 * Existing users already have a foreign JD sitting in the eight shared setup
 * keys. Shipping the fix without this leaves the poisoned value in place, and
 * the bug appears "not fixed" until the user manually clears site data.
 *
 * Strips jobDescription/jdText out of every legacy setup key. It does NOT touch
 * the CV, the target role, or any other field. Idempotent, so it is safe to call
 * on every page load.
 */
/**
 * Every key that has ever held a shared `jobDescription` field.
 *
 * This list MUST stay exhaustive. A key that is missing here is a key that keeps
 * its stale JD forever, and any reader that falls back to it resurrects the bug.
 *
 * The first version of this list was written from memory and missed four keys
 * that are genuinely in the codebase (`workzo-interview-setup`, `-v2`, `-v3`,
 * and `workzo_setup`), while listing one that is not (`workzo_interview_setup`,
 * underscored). The harmless-looking ones are the dangerous ones: the v2 and v3
 * buckets are exactly what a long-lived browser still has sitting in it.
 *
 * To re-derive this list, grep the app for localStorage keys:
 *   grep -rho "localStorage\.\(get\|set\)Item(\s*[\"'\`][^\"'\`]*" app components lib
 */
const LEGACY_SETUP_KEYS = [
  "workzoInterviewSetup",
  "workzo_setup",
  "latestInterviewSetup",
  "workzo_latest_interview_setup",
  "onboardingSetup",
  "workzo-interview-setup",
  "workzo-interview-setup-v2",
  "workzo-interview-setup-v3",
  "workzo-interview-setup-v4",
  "workzo-latest-interview-setup",
  "workzo-interview-setup-latest",
];

/* Bumped to v2: the v1 purge ran with an incomplete key list, so browsers that
   already set the v1 flag would never clean the four keys added above. A new
   flag forces exactly one more purge pass for everyone. */
const PURGE_FLAG = "workzo_jd_ownership_migrated_v2";

export function purgeLegacySharedJobDescriptions(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(PURGE_FLAG)) return;

    for (const key of LEGACY_SETUP_KEYS) {
      for (const store of [window.localStorage, window.sessionStorage]) {
        const raw = store.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          if (!parsed || typeof parsed !== "object") continue;
          if (!("jobDescription" in parsed) && !("jdText" in parsed)) continue;
          delete parsed.jobDescription;
          delete parsed.jdText;
          store.setItem(key, JSON.stringify(parsed));
        } catch {
          /* malformed entry, leave it alone */
        }
      }
    }

    window.localStorage.setItem(PURGE_FLAG, new Date().toISOString());
    console.log("[WorkZo JD] purged foreign job descriptions from legacy shared setup keys");
  } catch {
    /* storage disabled, degrade quietly */
  }
}

export const __workzoJobDescriptionSourceVersion = "1.1.0";
