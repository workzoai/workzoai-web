import { headers } from "next/headers";

export function isLocalHostValue(value: string | null | undefined) {
  const host = (value || "").toLowerCase().trim();

  return (
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("[::1]") ||
    host.startsWith("0.0.0.0")
  );
}

export async function isLocalhostOnly() {
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  const h = await headers();

  const host = h.get("host");
  const forwardedHost = h.get("x-forwarded-host");

  return isLocalHostValue(host) || isLocalHostValue(forwardedHost);
}

export function isLocalRequestFromHeaders(source: Headers | Request | { headers?: Headers }) {
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  const h = source instanceof Headers ? source : source.headers;

  const host = h?.get("host");
  const forwardedHost = h?.get("x-forwarded-host");

  return isLocalHostValue(host) || isLocalHostValue(forwardedHost);
}