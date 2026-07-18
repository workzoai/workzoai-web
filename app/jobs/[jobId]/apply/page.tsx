/*
 * app/jobs/[jobId]/apply/page.tsx
 *
 * The Smart Apply workspace (spec section 12). A guided, five-stage flow that
 * PREPARES an application: fit analysis, tailored CV, cover letter, interview prep,
 * and a final review where the user clicks through to the employer themselves.
 *
 * Nothing here submits an application. The last action is always the user opening
 * the employer's own page, having seen exactly what they are sending.
 */

import type { Metadata } from "next";
import ApplyWorkspace from "./ApplyWorkspace";

export const metadata: Metadata = {
  title: "Smart Apply | WorkZo",
  description: "Prepare a strong, honest application for this role.",
};

export default async function SmartApplyPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return <ApplyWorkspace jobId={jobId} />;
}
