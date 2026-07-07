/*
 * Maps the string icon names stored in the JSX-free free-tools registry
 * (lib/free-tools.ts) to real lucide-react components for the UI layer.
 *
 * Keeping this separate is deliberate: the registry stays importable from
 * server API routes without pulling in lucide, while every UI surface resolves
 * icons through one shared map here.
 */

import { FileSearch, FileText, MessageCircle, Sparkles, type LucideIcon } from "lucide-react";
import type { FreeToolIconName } from "@/lib/free-tools";

export const FREE_TOOL_ICONS: Record<FreeToolIconName, LucideIcon> = {
  FileSearch,
  Sparkles,
  FileText,
  MessageCircle,
};

export function getFreeToolIcon(name: FreeToolIconName): LucideIcon {
  return FREE_TOOL_ICONS[name] ?? Sparkles;
}
