import { redirect } from "next/navigation";

// /dashboard previously rendered the account settings page, which confused
// users coming from the results page expecting a "home" view.
// The real user home is the interview start page (/onboarding).
// Account settings live at /dashboard/settings.
export default function DashboardPage() {
  redirect("/onboarding");
}
