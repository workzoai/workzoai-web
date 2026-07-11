import type { Metadata } from "next";
import CohortDashboardClient from "./CohortDashboardClient";

export const metadata: Metadata = {
  title: "Institution Dashboard | WorkZo AI",
  description:
    "Institution-level cohort analytics, WIRI readiness, student risk signals, curriculum intelligence, and employer-ready talent visibility.",
  robots: { index: false, follow: false },
};

export default function InstitutionDashboardPage() {
  return <CohortDashboardClient />;
}
