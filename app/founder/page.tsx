import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isLocalhostOnly } from "@/lib/localOnly";

type SearchParams = Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function isFounderAuthorized(searchParams?: SearchParams): Promise<{ allowed: boolean; secret?: string }> {
  if (await isLocalhostOnly()) return { allowed: true };
  if (process.env.NODE_ENV === "development") return { allowed: true };

  const h = await headers();
  const envSecret = process.env.FOUNDER_ANALYTICS_SECRET;
  if (!envSecret) return { allowed: false };

  const headerSecret = h.get("x-founder-secret");
  if (headerSecret === envSecret) return { allowed: true };

  const params = searchParams ? await Promise.resolve(searchParams) : {};
  const querySecret = firstParam(params.secret);
  if (querySecret === envSecret) return { allowed: true, secret: querySecret };
  return { allowed: false };
}

export default async function FounderPage({ searchParams }: { searchParams?: SearchParams }) {
  const { allowed, secret } = await isFounderAuthorized(searchParams);

  if (!allowed) return null;

  redirect(secret ? `/founder/analytics?secret=${encodeURIComponent(secret)}` : "/founder/analytics");
}
