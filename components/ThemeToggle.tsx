"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/workzoTheme";

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-muted transition-colors hover:text-brand hover:border-brand/40 ${className}`}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
