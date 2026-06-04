"use client";

import { getWorkZoPlanLimits } from "@/lib/workzoPlanLimits";
import { getWorkZoCurrentPlan } from "@/lib/workzoUsageTracker";

export function canViewAdvancedReport() {
  return getWorkZoPlanLimits(getWorkZoCurrentPlan()).advancedReports;
}

export function getAdvancedReportLockedSections() {
  return [
    "Trust score",
    "Evidence quality",
    "Contradiction detection",
    "Weak answer coaching",
    "Retry weakest answer",
    "PDF export",
  ];
}
