import type { Metadata } from "next";
import ScoringAdminClient from "./ScoringAdminClient";

export const metadata: Metadata = {
  title: "Scoring Calibration | WorkZo AI",
  description: "Organization scoring profiles, company interview templates, weighted rubrics, and readiness score preview.",
  robots: { index: false, follow: false },
};

export default function ScoringAdminPage() {
  return <ScoringAdminClient />;
}
