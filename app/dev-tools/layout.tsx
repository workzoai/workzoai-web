import { notFound } from "next/navigation";
import type { ReactNode } from "react";

/**
 * app/dev-tools/layout.tsx — production gate.
 * Dev tools (usage bypass, enterprise mock, debug panels) must never be
 * reachable on the live site. Gating at the layout covers every current and
 * future page under /dev-tools automatically.
 */
export default function DevToolsLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production" && process.env.WORKZO_ENABLE_DEV_TOOLS !== "true") {
    notFound();
  }
  return <>{children}</>;
}
