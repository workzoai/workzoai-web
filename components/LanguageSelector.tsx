"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { APP_LANGUAGES, type AppLanguage, getStoredAppLanguage } from "@/lib/workzoAppLanguage";

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

type Props = {
  value?: AppLanguage;
  onChange?: (lang: AppLanguage) => void;
  compact?: boolean; // shows flag + code only (for nav bar)
  className?: string;
};

export default function LanguageSelector({ value, onChange, compact = false, className }: Props) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<AppLanguage>(value || getStoredAppLanguage());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) setCurrent(value);
  }, [value]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function select(lang: AppLanguage) {
    setCurrent(lang);
    onChange?.(lang);
    setOpen(false);
    try { window.localStorage.setItem("workzo_app_language", lang); } catch {}
  }

  const selected = APP_LANGUAGES.find((l) => l.code === current) || APP_LANGUAGES[0];

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] text-white backdrop-blur transition hover:bg-white/[0.12]",
          compact ? "px-2.5 py-2 text-xs font-bold" : "px-3.5 py-2.5 text-sm font-bold",
        )}
      >
        {compact
          ? <span className="font-black tracking-wide">{selected.code.toUpperCase()}</span>
          : <>
              <span aria-hidden="true">{selected.flag}</span>
              <span>{selected.nativeLabel}</span>
            </>
        }
        <ChevronDown className={cn("h-3.5 w-3.5 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-2xl border border-white/10 bg-[#071120]/95 py-1.5 shadow-2xl shadow-black/40 backdrop-blur-xl">
          {APP_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => select(lang.code)}
              className={cn(
                "flex w-full items-center gap-2.5 px-3.5 py-2 text-sm transition",
                lang.code === current
                  ? "bg-blue-500/20 font-black text-white"
                  : "font-bold text-slate-300 hover:bg-white/10 hover:text-white",
              )}
            >
              <span className="inline-flex h-5 w-7 shrink-0 items-center justify-center rounded-[3px] bg-white/10 text-[9px] font-black tracking-wide text-slate-300">
                {lang.code.toUpperCase()}
              </span>
              <span>{lang.nativeLabel}</span>
              <span className="ml-auto text-xs text-slate-500">{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
