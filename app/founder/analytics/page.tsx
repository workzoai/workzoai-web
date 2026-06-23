import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { isLocalhostOnly } from "@/lib/localOnly";
import FounderAnalyticsClient from "./FounderAnalyticsClient";

type SearchParams = Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function isFounderAuthorized(searchParams?: SearchParams): Promise<boolean> {
  if (await isLocalhostOnly()) return true;
  if (process.env.NODE_ENV === "development") return true;

  const h = await headers();
  const envSecret = process.env.FOUNDER_ANALYTICS_SECRET;
  if (!envSecret) return false;

  const headerSecret = h.get("x-founder-secret");
  if (headerSecret === envSecret) return true;

  const params = searchParams ? await Promise.resolve(searchParams) : {};
  const querySecret = firstParam(params.secret);
  return querySecret === envSecret;
}

export default async function FounderAnalyticsPage({ searchParams }: { searchParams?: SearchParams }) {
  const allowed = await isFounderAuthorized(searchParams);

  if (!allowed) {
    notFound();
  }

  return <FounderAnalyticsClient />;
}
