"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type WorkZoTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "workzo_theme";

/**
 * Inline script injected before paint to avoid a flash of the wrong theme.
 * Default is light (no class); only adds `.dark` when the user previously chose it.
 * Kept dependency-free and tiny since it runs as a raw string in <head>.
 */
export const THEME_NO_FLASH_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});if(t==="dark"){document.documentElement.classList.add("dark");}}catch(e){}})();`;

type ThemeContextType = {
  theme: WorkZoTheme;
  setTheme: (theme: WorkZoTheme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
});

function applyThemeClass(theme: WorkZoTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Default light to match SSR output; the no-flash script + this effect
  // reconcile to the stored preference on the client.
  const [theme, setThemeState] = useState<WorkZoTheme>("light");

  useEffect(() => {
    let stored: WorkZoTheme | null = null;
    try {
      const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (raw === "light" || raw === "dark") stored = raw;
    } catch {}
    const initial = stored ?? "light";
    // Reconcile React state to the stored choice on mount. SSR renders light; the
    // no-flash script has already applied the real class to <html> before paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(initial);
    applyThemeClass(initial);
  }, []);

  const setTheme = useCallback((next: WorkZoTheme) => {
    setThemeState(next);
    applyThemeClass(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {}
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      applyThemeClass(next);
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {}
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
