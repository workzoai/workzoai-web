"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackWorkZoEvent } from "@/lib/workzoAnalytics";

const IGNORED_PREFIXES = ["/api", "/founder", "/_next"];

export default function WorkZoFounderAnalyticsTracker() {
  const pathname = usePathname() || "/";
  const lastTracked = useRef("");

  useEffect(() => {
    if (IGNORED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return;

    const query = typeof window !== "undefined" ? window.location.search || "" : "";
    const key = `${pathname}${query}`;
    if (lastTracked.current === key) return;
    lastTracked.current = key;

    trackWorkZoEvent({
      event: "page_view",
      metadata: {
        page: pathname,
        hasQuery: Boolean(query),
      },
    });
  }, [pathname]);

  return null;
}
