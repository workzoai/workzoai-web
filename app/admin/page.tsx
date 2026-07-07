import type { Metadata } from "next";
import CohortDashboardClient from "./CohortDashboardClient";

export const metadata: Metadata = {
  title: "Talent Intelligence — WorkZo AI",
  description: "Cohort readiness heatmaps, rejection-risk signals, curriculum insights, recruiter benchmarks, and opt-in employer talent pipeline.",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <CohortDashboardClient />;
}
