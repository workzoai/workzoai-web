import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isLocalhostOnly } from "@/lib/localOnly";

function isFounderAuthorized(headersList: Awaited<ReturnType<typeof headers>>): boolean {
  if (process.env.NODE_ENV === "development") return true;
  const secret = headersList.get("x-founder-secret");
  const envSecret = process.env.FOUNDER_ANALYTICS_SECRET;
  if (envSecret && secret === envSecret) return true;
  return false;
}

export default async function FounderPage() {
  const isLocal = await isLocalhostOnly();
  const h = await headers();
  const allowed = isLocal || isFounderAuthorized(h);

  if (!allowed) {
    // Return a blank 404-looking page — don't reveal the route exists
    return null;
  }

  redirect("/founder/analytics");
}
