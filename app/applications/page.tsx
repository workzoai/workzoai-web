/*
 * app/applications/page.tsx
 *
 * The application tracker (spec section 17). A kanban-style board of everything the
 * user has applied to or saved, grouped by status, with follow-up in mind. Populated
 * by the "I applied" action in the Smart Apply workspace, and editable here.
 */

import type { Metadata } from "next";
import ApplicationsBoard from "./ApplicationsBoard";

export const metadata: Metadata = {
  title: "Your applications | WorkZo",
  description: "Track every job you have applied to, and follow up at the right time.",
};

export default function ApplicationsPage() {
  return <ApplicationsBoard />;
}
