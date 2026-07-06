import type { Metadata } from "next";
import CohortDashboardClient from "./CohortDashboardClient";

export const metadata: Metadata = {
  title: "Admin Dashboard — WorkZo AI",
  description: "Track interview readiness, engagement, and early-warning flags across your cohort or program.",
  // Not indexed: this is a partner/preview surface, not a public marketing page.
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <CohortDashboardClient />;
}
