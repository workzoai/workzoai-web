import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { isLocalhostOnly } from "@/lib/localOnly";
import FounderAnalyticsClient from "./FounderAnalyticsClient";

type SearchParams = Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function isFounderAuthorized(searchParams?: SearchParams): Promise<boolean> {
  // Always allow local development so the founder page can be opened at localhost.
  if (process.env.NODE_ENV === "development") return true;
  if (await isLocalhostOnly()) return true;

  const params = searchParams ? await Promise.resolve(searchParams) : {};
  const querySecret = firstParam(params.secret);
  const envSecret = process.env.FOUNDER_ANALYTICS_SECRET;

  // If no secret is configured, do not expose the page in production.
  if (!envSecret) return false;
  if (querySecret && querySecret === envSecret) return true;

  const h = await headers();
  const headerSecret = h.get("x-founder-secret");
  if (headerSecret && headerSecret === envSecret) return true;

  return false;
}

export default async function FounderAnalyticsPage({ searchParams }: { searchParams?: SearchParams }) {
  const allowed = await isFounderAuthorized(searchParams);
  if (!allowed) notFound();
  return <FounderAnalyticsClient />;
}
