import type { Metadata } from "next";
import ScoringAdminClient from "./ScoringAdminClient";

export const metadata: Metadata = {
  title: "Institution Scoring Settings | WorkZo AI",
  description: "Configure scoring profiles, company templates, weighted rubrics, and readiness calibration.",
  robots: { index: false, follow: false },
};

export default function InstitutionScoringPage() {
  return <ScoringAdminClient />;
}
