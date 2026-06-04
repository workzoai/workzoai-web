"use client";

import { getWorkZoPlanLimits, normalizeWorkZoPlan, type WorkZoPlanType } from "@/lib/workzoPlanLimits";

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

const WORKZO_USAGE_KEY = "workzo_usage_state_v1";
const WORKZO_PLAN_KEY = "workzo_plan_type";

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

export function getWorkZoCurrentPlan(): WorkZoPlanType {
  if (typeof window === "undefined") return "free";
  try {
    const direct =
      window.localStorage.getItem(WORKZO_PLAN_KEY) ||
      window.localStorage.getItem("workzo_plan") ||
      window.localStorage.getItem("workzoPlan") ||
      window.localStorage.getItem("workzo_subscription_plan");
    if (direct) return normalizeWorkZoPlan(direct);

    const rawSubscription =
      window.localStorage.getItem("workzo_subscription") ||
      window.localStorage.getItem("workzoSubscription") ||
      window.localStorage.getItem("subscription");

    if (rawSubscription) {
      const parsed = JSON.parse(rawSubscription) as Record<string, unknown>;
      return normalizeWorkZoPlan(parsed.plan || parsed.tier || parsed.status);
    }
  } catch {}
  return "free";
}

export function setWorkZoCurrentPlan(plan: WorkZoPlanType) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WORKZO_PLAN_KEY, plan);
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

export function checkWorkZoInterviewAllowed(plan = getWorkZoCurrentPlan()) {
  const usage = readWorkZoUsage();
  const limits = getWorkZoPlanLimits(plan);
  const used = usage.interviewsStarted;
  const limit = limits.interviewsPerMonth;
  return { allowed: used < limit, reason: used < limit ? "ok" : "monthly_interview_limit", remaining: Math.max(0, limit - used), limit, used };
}

export function checkWorkZoTavusAllowed(plan = getWorkZoCurrentPlan()) {
  const usage = readWorkZoUsage();
  const limits = getWorkZoPlanLimits(plan);
  if (!limits.tavus) return { allowed: false, reason: "tavus_locked", remaining: 0, limit: limits.tavusInterviewsPerMonth, used: usage.tavusInterviewsStarted };
  if (usage.tavusInterviewsStarted >= limits.tavusInterviewsPerMonth) return { allowed: false, reason: "tavus_interview_limit", remaining: 0, limit: limits.tavusInterviewsPerMonth, used: usage.tavusInterviewsStarted };
  if (usage.tavusMinutesUsed >= limits.tavusMinutesPerMonth) return { allowed: false, reason: "tavus_minutes_limit", remaining: 0, limit: limits.tavusMinutesPerMonth, used: usage.tavusMinutesUsed };
  return { allowed: true, reason: "ok", remaining: Math.max(0, limits.tavusInterviewsPerMonth - usage.tavusInterviewsStarted), limit: limits.tavusInterviewsPerMonth, used: usage.tavusInterviewsStarted };
}

export function recordWorkZoInterviewStarted() {
  return updateWorkZoUsage((usage) => ({ ...usage, interviewsStarted: usage.interviewsStarted + 1 }));
}

export function recordWorkZoInterviewCompleted() {
  return updateWorkZoUsage((usage) => ({ ...usage, interviewsCompleted: usage.interviewsCompleted + 1 }));
}

export function recordWorkZoReportViewed() {
  return updateWorkZoUsage((usage) => ({ ...usage, reportsViewed: usage.reportsViewed + 1 }));
}

export function recordWorkZoTavusInterviewStarted() {
  return updateWorkZoUsage((usage) => ({ ...usage, tavusInterviewsStarted: usage.tavusInterviewsStarted + 1 }));
}

export function recordWorkZoTavusMinutes(minutes: number) {
  return updateWorkZoUsage((usage) => ({ ...usage, tavusMinutesUsed: usage.tavusMinutesUsed + Math.max(0, minutes) }));
}

export function recordWorkZoUpgradeClick() {
  return updateWorkZoUsage((usage) => ({ ...usage, upgradeClicks: usage.upgradeClicks + 1 }));
}

export function getWorkZoUsageSummary(plan = getWorkZoCurrentPlan()) {
  const usage = readWorkZoUsage();
  const limits = getWorkZoPlanLimits(plan);
  return {
    plan: normalizeWorkZoPlan(plan),
    limits,
    usage,
    interviewsRemaining: Math.max(0, limits.interviewsPerMonth - usage.interviewsStarted),
    tavusInterviewsRemaining: Math.max(0, limits.tavusInterviewsPerMonth - usage.tavusInterviewsStarted),
    tavusMinutesRemaining: Math.max(0, limits.tavusMinutesPerMonth - usage.tavusMinutesUsed),
  };
}
