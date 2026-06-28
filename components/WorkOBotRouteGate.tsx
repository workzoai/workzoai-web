"use client";

import { usePathname } from "next/navigation";
import WorkOBotFloating from "@/components/WorkOBotFloating";

export default function WorkOBotRouteGate() {
  const pathname = usePathname();

  const showFloatingBot = pathname === "/dashboard";

  if (!showFloatingBot) return null;

  return <WorkOBotFloating />;
}