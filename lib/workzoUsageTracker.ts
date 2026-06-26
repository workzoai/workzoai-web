"use client";

import { hasWorkZoAnalyticsConsent } from "@/lib/workzoPrivacyConsent";
import {
  getWorkZoPlanLimits,
  normalizeWorkZoPlan,
  type WorkZoPlanType,
} from "@/lib/workzoPlanLimits";

export type WorkZoUsageState = {
  monthKey: string;
  interviewsStarted: number;
  interviewsCompleted: number;
  reportsViewed: number;
  tavusInterviewsStarted: number;
  tavusMinutesUsed: number;
  upgradeClicks: number;
  lastUpdatedAt: string;
};

const WORKZO_USAGE_KEY = "workzo_usage_state_v2";
const WORKZO_PLAN_KEY = "workzo_plan_type";
const WORKZO_TEST_MODE_KEY = "workzo_founder_test_mode";
const WORKZO_TEST_LIMIT_OVERRIDE_KEY = "workzo_test_interview_limit_override";

function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function emptyUsage(): WorkZoUsageState {
  return {
    monthKey: getMonthKey(),
    interviewsStarted: 0,
    interviewsCompleted: 0,
    reportsViewed: 0,
    tavusInterviewsStarted: 0,
    tavusMinutesUsed: 0,
    upgradeClicks: 0,
    lastUpdatedAt: new Date().toISOString(),
  };
}

function normalizeUsage(value: Partial<WorkZoUsageState> | null): WorkZoUsageState {
  if (!value || value.monthKey !== getMonthKey()) return emptyUsage();
  return {
    monthKey: getMonthKey(),
    interviewsStarted: Number(value.interviewsStarted || 0),
    interviewsCompleted: Number(value.interviewsCompleted || 0),
    reportsViewed: Number(value.reportsViewed || 0),
    tavusInterviewsStarted: Number(value.tavusInterviewsStarted || 0),
    tavusMinutesUsed: Number(value.tavusMinutesUsed || 0),
    upgradeClicks: Number(value.upgradeClicks || 0),
    lastUpdatedAt: value.lastUpdatedAt || new Date().toISOString(),
  };
}

async function sendUsageEvent(eventName: string, metadata: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  if (!hasWorkZoAnalyticsConsent()) return;

  try {
    await fetch("/api/db/usage-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventName, plan: getWorkZoCurrentPlan(), metadata }),
    });
  } catch {}
}

export function isWorkZoFounderTestMode() {
  if (typeof window === "undefined") return false;
  try {
    const query = new URLSearchParams(window.location.search);
    if (query.get("test") === "1" || query.get("founder") === "1") {
      window.localStorage.setItem(WORKZO_TEST_MODE_KEY, "1");
      return true;
    }
    return window.localStorage.getItem(WORKZO_TEST_MODE_KEY) === "1";
  } catch {
    return false;
  }
}

export function enableWorkZoFounderTestMode() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WORKZO_TEST_MODE_KEY, "1");
    window.localStorage.setItem(WORKZO_TEST_LIMIT_OVERRIDE_KEY, "999");
    window.localStorage.setItem(WORKZO_PLAN_KEY, "premium_pro");
  } catch {}
}

export function disableWorkZoFounderTestMode() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(WORKZO_TEST_MODE_KEY);
    window.localStorage.removeItem(WORKZO_TEST_LIMIT_OVERRIDE_KEY);
  } catch {}
}

export function resetWorkZoTestingUsage() {
  if (typeof window === "undefined") return emptyUsage();
  const next = emptyUsage();
  try {
    window.localStorage.setItem(WORKZO_USAGE_KEY, JSON.stringify(next));
    window.localStorage.removeItem("workzo_pending_checkout");
    window.localStorage.removeItem("workzo_selected_plan_intent");
    window.localStorage.removeItem("workzo_allow_standard_start_once");
    window.localStorage.removeItem("workzo_pending_upgrade_route");
  } catch {}
  return next;
}

export function getWorkZoCurrentPlan(): WorkZoPlanType {
  if (typeof window === "undefined") return "free";
  try {
    const direct =
      window.localStorage.getItem(WORKZO_PLAN_KEY) ||
      window.localStorage.getItem("workzo_plan") ||
      window.localStorage.getItem("workzoPlan") ||
      window.localStorage.getItem("workzo_subscription_plan") ||
      window.localStorage.getItem("workzo_plan_tier");
    if (direct) return normalizeWorkZoPlan(direct);

    const rawSubscription =
      window.localStorage.getItem("workzo_subscription") ||
      window.localStorage.getItem("workzoSubscription") ||
      window.localStorage.getItem("subscription");

    if (rawSubscription) {
      const parsed = JSON.parse(rawSubscription) as Record<string, unknown>;
      return normalizeWorkZoPlan(parsed.plan || parsed.plan_tier || parsed.tier || parsed.status);
    }
  } catch {}
  return "free";
}

const WORKZO_DEV_PLAN_OVERRIDE_KEY = "workzo_dev_plan_override";

/**
 * Sets the current plan for this browser session.
 *
 * Writes to localStorage AND a cookie (so server-rendered pages like
 * /history and /billing/manage also see the override), and sets a
 * dev-override flag so fetchWorkZoAuthoritativePlan() does not silently
 * overwrite this value with the real DB plan on the next page load.
 *
 * @param plan - The plan to set
 * @param isDevOverride - If true, marks this as a manual dev/test override
 *   that should persist until explicitly cleared via clearWorkZoDevPlanOverride().
 */
export function setWorkZoCurrentPlan(plan: WorkZoPlanType, isDevOverride = false) {
  if (typeof window === "undefined") return;
  const normalized = normalizeWorkZoPlan(plan);
  try {
    window.localStorage.setItem(WORKZO_PLAN_KEY, normalized);
    window.localStorage.setItem("workzo_plan", normalized);
    window.localStorage.setItem("workzo_plan_type", normalized);
  } catch {}
  try {
    const maxAge = 60 * 60 * 24 * 30; // 30 days
    document.cookie = `workzo_plan=${normalized}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
    document.cookie = `workzo_plan_type=${normalized}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
  } catch {}
  if (isDevOverride) {
    try {
      window.localStorage.setItem(WORKZO_DEV_PLAN_OVERRIDE_KEY, normalized);
      const maxAge = 60 * 60 * 24 * 30;
      document.cookie = `${WORKZO_DEV_PLAN_OVERRIDE_KEY}=${normalized}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
    } catch {}
  }
}

/**
 * Returns the active dev plan override, if any. Used by
 * fetchWorkZoAuthoritativePlan() to decide whether to trust the DB plan
 * or keep the developer's manual override.
 */
export function getWorkZoDevPlanOverride(): WorkZoPlanType | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(WORKZO_DEV_PLAN_OVERRIDE_KEY);
    if (raw) return normalizeWorkZoPlan(raw);
  } catch {}
  return null;
}

/**
 * Clears any active dev plan override, restoring normal DB-driven plan resolution.
 */
export function clearWorkZoDevPlanOverride() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(WORKZO_DEV_PLAN_OVERRIDE_KEY);
    document.cookie = `${WORKZO_DEV_PLAN_OVERRIDE_KEY}=; Max-Age=0; Path=/; SameSite=Lax`;
  } catch {}
}

export function readWorkZoUsage(): WorkZoUsageState {
  if (typeof window === "undefined") return emptyUsage();
  try {
    const raw = window.localStorage.getItem(WORKZO_USAGE_KEY);
    return normalizeUsage(raw ? JSON.parse(raw) : null);
  } catch {
    return emptyUsage();
  }
}

export function writeWorkZoUsage(next: WorkZoUsageState) {
  if (typeof window === "undefined") return next;
  const value = { ...next, monthKey: getMonthKey(), lastUpdatedAt: new Date().toISOString() };
  try {
    window.localStorage.setItem(WORKZO_USAGE_KEY, JSON.stringify(value));
  } catch {}
  return value;
}

export function updateWorkZoUsage(updater: (usage: WorkZoUsageState) => WorkZoUsageState) {
  return writeWorkZoUsage(updater(readWorkZoUsage()));
}

function getEffectiveInterviewLimit(plan: WorkZoPlanType) {
  const limits = getWorkZoPlanLimits(plan);
  if (isWorkZoFounderTestMode()) {
    try {
      const override = Number(window.localStorage.getItem(WORKZO_TEST_LIMIT_OVERRIDE_KEY) || 999);
      return Number.isFinite(override) && override > 0 ? override : 999;
    } catch {
      return 999;
    }
  }
  if (limits.unlimitedVoiceInterviews) return 999999;
  return limits.interviewsPerMonth;
}

export function checkWorkZoInterviewAllowed(plan = getWorkZoCurrentPlan()) {
  const normalizedPlan = normalizeWorkZoPlan(plan);
  const usage = readWorkZoUsage();
  const used = usage.interviewsStarted;
  const limit = getEffectiveInterviewLimit(normalizedPlan);
  return {
    allowed: used < limit,
    reason: used < limit ? "ok" : "interview_limit_reached",
    remaining: Math.max(0, limit - used),
    limit,
    used,
    plan: normalizedPlan,
  };
}

export function checkWorkZoTavusAllowed(plan = getWorkZoCurrentPlan()) {
  const normalizedPlan = normalizeWorkZoPlan(plan);
  const usage = readWorkZoUsage();
  const limits = getWorkZoPlanLimits(normalizedPlan);

  if (isWorkZoFounderTestMode()) {
    return { allowed: true, reason: "test_mode", remaining: 999, limit: 999, used: usage.tavusInterviewsStarted, minutesRemaining: 999, minutesLimit: 999, minutesUsed: usage.tavusMinutesUsed, plan: normalizedPlan };
  }

  if (!limits.tavus) {
    return { allowed: false, reason: "video_recruiter_locked", remaining: 0, limit: limits.tavusInterviewsPerMonth, used: usage.tavusInterviewsStarted, minutesRemaining: 0, minutesLimit: limits.tavusMinutesPerMonth, minutesUsed: usage.tavusMinutesUsed, plan: normalizedPlan };
  }

  if (usage.tavusMinutesUsed >= limits.tavusMinutesPerMonth) {
    return { allowed: false, reason: "video_recruiter_minutes_limit", remaining: 0, limit: limits.tavusInterviewsPerMonth, used: usage.tavusInterviewsStarted, minutesRemaining: 0, minutesLimit: limits.tavusMinutesPerMonth, minutesUsed: usage.tavusMinutesUsed, plan: normalizedPlan };
  }

  return {
    allowed: true,
    reason: "ok",
    remaining: Math.max(0, limits.tavusInterviewsPerMonth - usage.tavusInterviewsStarted),
    limit: limits.tavusInterviewsPerMonth,
    used: usage.tavusInterviewsStarted,
    minutesRemaining: Math.max(0, limits.tavusMinutesPerMonth - usage.tavusMinutesUsed),
    minutesLimit: limits.tavusMinutesPerMonth,
    minutesUsed: usage.tavusMinutesUsed,
    plan: normalizedPlan,
  };
}

export function recordWorkZoCvUploaded(metadata: Record<string, unknown> = {}) {
  void sendUsageEvent("cv_uploaded", { ...metadata, testMode: isWorkZoFounderTestMode() });
}

export function recordWorkZoInterviewStarted() {
  const next = updateWorkZoUsage((usage) => ({ ...usage, interviewsStarted: usage.interviewsStarted + 1 }));
  void sendUsageEvent("interview_started", { usage: next, testMode: isWorkZoFounderTestMode() });
  return next;
}

export function recordWorkZoInterviewCompleted() {
  const next = updateWorkZoUsage((usage) => ({ ...usage, interviewsCompleted: usage.interviewsCompleted + 1 }));
  void sendUsageEvent("interview_completed", { usage: next, testMode: isWorkZoFounderTestMode() });
  return next;
}

export function recordWorkZoReportViewed() {
  const next = updateWorkZoUsage((usage) => ({ ...usage, reportsViewed: usage.reportsViewed + 1 }));
  void sendUsageEvent("results_viewed", { usage: next, testMode: isWorkZoFounderTestMode() });
  return next;
}

export function recordWorkZoTavusInterviewStarted() {
  const next = updateWorkZoUsage((usage) => ({ ...usage, tavusInterviewsStarted: usage.tavusInterviewsStarted + 1 }));
  void sendUsageEvent("video_recruiter_interview_started", { usage: next, testMode: isWorkZoFounderTestMode() });
  return next;
}

export function recordWorkZoTavusMinutes(minutes: number) {
  const safeMinutes = Math.max(0, Math.ceil(Number(minutes) || 0));
  const next = updateWorkZoUsage((usage) => ({ ...usage, tavusMinutesUsed: usage.tavusMinutesUsed + safeMinutes }));
  void sendUsageEvent("video_recruiter_minutes_used", { minutes: safeMinutes, usage: next, testMode: isWorkZoFounderTestMode() });
  return next;
}

export function recordWorkZoUpgradeClick() {
  const next = updateWorkZoUsage((usage) => ({ ...usage, upgradeClicks: usage.upgradeClicks + 1 }));
  void sendUsageEvent("upgrade_clicked", { usage: next, testMode: isWorkZoFounderTestMode() });
  return next;
}

export function getWorkZoUsageSummary(plan = getWorkZoCurrentPlan()) {
  const normalizedPlan = normalizeWorkZoPlan(plan);
  const usage = readWorkZoUsage();
  const limits = getWorkZoPlanLimits(normalizedPlan);
  const interviewLimit = getEffectiveInterviewLimit(normalizedPlan);
  const tavusAllowed = checkWorkZoTavusAllowed(normalizedPlan);

  return {
    plan: normalizedPlan,
    limits: { ...limits, interviewsPerMonth: interviewLimit, voiceInterviewsPerMonth: interviewLimit },
    usage,
    testMode: isWorkZoFounderTestMode(),
    interviewsRemaining: Math.max(0, interviewLimit - usage.interviewsStarted),
    tavusInterviewsRemaining: tavusAllowed.remaining,
    tavusMinutesRemaining: tavusAllowed.minutesRemaining,
    tavusMinutesUsed: usage.tavusMinutesUsed,
    tavusMinutesLimit: limits.tavusMinutesPerMonth,
  };
}
